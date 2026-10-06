// Owner-only connector actions.
//   GET  /api/connect                      -> status of every channel
//   POST /api/connect {action:'youtube_link'}         -> Google consent URL (signed state, 10 min)
//   POST /api/connect {action:'post_now', platform, post_id}  -> post one item to fb_page | youtube | x now
//   POST /api/connect {action:'fb_set', page_id, page_token} -> save a Page token (from the Meta flow)
import { json, readBody, requireOwner, db, sign, setSecret, APP } from './_lib.js';
import { fbStatus, fbPost, ytStatus, ytConfigured, ytUpload, xStatus, xPost } from './_connectors.js';

export default async function handler(req, res) {
  const user = await requireOwner(req, res); if (!user) return;
  if (req.method === 'GET') {
    return json(res, 200, { fb_page: await fbStatus(), youtube: await ytStatus(), x: xStatus(), ai: { connected: !!process.env.GEMINI_API_KEY } });
  }
  const b = await readBody(req);
  try {
    if (b.action === 'youtube_link') {
      if (!ytConfigured()) return json(res, 409, { error: 'YouTube needs your Google app keys first (see Connect page).' });
      const state = sign({ u: user.id, exp: Date.now() + 600e3 });
      const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      u.search = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: APP + '/api/yt-callback', response_type: 'code',
        scope: 'https://www.googleapis.com/auth/youtube.upload', access_type: 'offline', prompt: 'consent', state }).toString();
      return json(res, 200, { url: u.toString() });
    }
    if (b.action === 'fb_set') {
      if (!/^\d{5,20}$/.test(b.page_id || '') || !(b.page_token || '').startsWith('EA')) return json(res, 400, { error: 'page id / token look wrong' });
      const r = await fetch(`https://graph.facebook.com/v21.0/${b.page_id}?fields=name&access_token=${encodeURIComponent(b.page_token)}`);
      const j = await r.json(); if (!r.ok) return json(res, 400, { error: 'Facebook said: ' + (j.error?.message || r.status) });
      await setSecret('fb_page_id', b.page_id); await setSecret('fb_page_token', b.page_token);
      return json(res, 200, { ok: true, page: j.name });
    }
    if (b.action === 'post_now') {
      const p = (await db('sp_posts?select=*&id=eq.' + encodeURIComponent(b.post_id || '')))[0];
      if (!p) return json(res, 404, { error: 'post not found' });
      const fn = { fb_page: fbPost, youtube: ytUpload, x: xPost }[b.platform];
      if (!fn) return json(res, 400, { error: 'unknown platform' });
      return json(res, 200, { ok: true, result: await fn(p) });
    }
    return json(res, 400, { error: 'unknown action' });
  } catch (e) { return json(res, 502, { error: String(e.message || e) }); }
}
