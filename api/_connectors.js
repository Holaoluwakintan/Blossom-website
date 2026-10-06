// Auto-posting connectors. Each is OFF until Michael connects the account; then the cron
// (and the "Post now" buttons) use it. Secrets live in sp_secrets (service-role only) or env.
import crypto from 'node:crypto';
import { getSecret, setSecret, captionFor, markPosted, log } from './_lib.js';

// ---------- Facebook Page (Graph API, pages_manage_posts) ----------
export async function fbStatus() {
  const id = await getSecret('fb_page_id'), tok = await getSecret('fb_page_token');
  return { connected: !!(id && tok), page_id: id || null };
}
export async function fbPost(post) {
  const id = await getSecret('fb_page_id'), tok = await getSecret('fb_page_token');
  if (!id || !tok) throw new Error('Facebook Page not connected');
  const msg = captionFor(post, 'facebook');
  const params = new URLSearchParams({ caption: msg, access_token: tok });
  let r;
  if (post.media_url) { params.set('url', post.media_url); r = await fetch(`https://graph.facebook.com/v21.0/${id}/photos`, { method: 'POST', body: params }); }
  else { params.delete('caption'); params.set('message', msg); r = await fetch(`https://graph.facebook.com/v21.0/${id}/feed`, { method: 'POST', body: params }); }
  const j = await r.json();
  if (!r.ok || j.error) throw new Error('Facebook: ' + (j.error?.message || r.status));
  await markPosted(post, 'fb_page'); await log(post.id, 'fb_page', true, j.post_id || j.id);
  return j;
}

// ---------- YouTube Shorts (Data API v3, youtube.upload) ----------
export function ytConfigured() { return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET); }
export async function ytStatus() { return { configured: ytConfigured(), connected: !!(await getSecret('yt_refresh_token')) }; }
async function ytAccess() {
  const rt = await getSecret('yt_refresh_token');
  if (!rt || !ytConfigured()) throw new Error('YouTube not connected');
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, refresh_token: rt, grant_type: 'refresh_token' }) });
  const j = await r.json(); if (!j.access_token) throw new Error('YouTube token: ' + (j.error_description || j.error || r.status));
  return j.access_token;
}
export async function ytExchange(code, redirect_uri) {
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({
    code, client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, redirect_uri, grant_type: 'authorization_code' }) });
  const j = await r.json();
  if (!j.refresh_token) throw new Error('Google did not return a refresh token (' + (j.error_description || j.error || 'remove the app at myaccount.google.com/permissions and try again') + ')');
  await setSecret('yt_refresh_token', j.refresh_token);
  return true;
}
export async function ytUpload(post, privacy = process.env.YT_PRIVACY || 'public') {
  if (!post.video_url) throw new Error('No video for this post');
  const at = await ytAccess();
  const vid = await fetch(post.video_url); if (!vid.ok) throw new Error('video fetch ' + vid.status);
  const bytes = Buffer.from(await vid.arrayBuffer());
  const meta = { snippet: { title: captionFor(post, 'youtube_title'), description: captionFor(post, 'youtube_desc'), categoryId: '22', tags: (post.hashtags || '').replace(/#/g, '').split(/\s+/).filter(Boolean) },
                 status: { privacyStatus: privacy, selfDeclaredMadeForKids: false } };
  const init = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST', headers: { Authorization: 'Bearer ' + at, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': 'video/mp4', 'X-Upload-Content-Length': String(bytes.length) },
    body: JSON.stringify(meta) });
  if (!init.ok) throw new Error('YouTube init: ' + (await init.text()).slice(0, 200));
  const up = await fetch(init.headers.get('location'), { method: 'PUT', headers: { 'Content-Type': 'video/mp4' }, body: bytes });
  const j = await up.json(); if (!up.ok) throw new Error('YouTube upload: ' + JSON.stringify(j).slice(0, 200));
  await markPosted(post, 'youtube'); await log(post.id, 'youtube', true, 'https://youtube.com/shorts/' + j.id + ' (' + (j.status?.privacyStatus || privacy) + ')');
  return { id: j.id, url: 'https://youtube.com/shorts/' + j.id, privacy: j.status?.privacyStatus };
}

// ---------- X (API v2, OAuth 1.0a user context; text + link, the link's card shows the image) ----------
export function xStatus() { return { connected: !!(process.env.X_API_KEY && process.env.X_API_SECRET && process.env.X_ACCESS_TOKEN && process.env.X_ACCESS_SECRET) }; }
function pct(s) { return encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase()); }
export async function xPost(post) {
  if (!xStatus().connected) throw new Error('X not connected');
  const url = 'https://api.x.com/2/tweets', text = captionFor(post, 'x');
  const o = { oauth_consumer_key: process.env.X_API_KEY, oauth_nonce: crypto.randomBytes(16).toString('hex'), oauth_signature_method: 'HMAC-SHA1',
              oauth_timestamp: String(Math.floor(Date.now() / 1000)), oauth_token: process.env.X_ACCESS_TOKEN, oauth_version: '1.0' };
  const base = 'POST&' + pct(url) + '&' + pct(Object.keys(o).sort().map((k) => pct(k) + '=' + pct(o[k])).join('&'));
  o.oauth_signature = crypto.createHmac('sha1', pct(process.env.X_API_SECRET) + '&' + pct(process.env.X_ACCESS_SECRET)).update(base).digest('base64');
  const hdr = 'OAuth ' + Object.keys(o).sort().map((k) => pct(k) + '="' + pct(o[k]) + '"').join(', ');
  const r = await fetch(url, { method: 'POST', headers: { Authorization: hdr, 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
  const j = await r.json(); if (!r.ok) throw new Error('X: ' + (j.detail || j.title || r.status));
  await markPosted(post, 'x'); await log(post.id, 'x', true, j.data?.id);
  return j.data;
}
