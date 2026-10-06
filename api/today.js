// GET /api/today  (for the Michael AI WhatsApp bot)
//   auth: header "x-sow-key: <SOW_API_KEY>" (or ?key=)
//   ?which=today (default) | next | date=YYYY-MM-DD
// POST /api/today?action=mark  {post_id, platform}  -> marks a platform posted (same key)
import { json, readBody, db, safeEq, watDate, watTime, captionFor, markPosted, APP } from './_lib.js';

function shape(p, label) {
  if (!p) return null;
  return {
    label, id: p.id, date: p.post_date, time: p.post_time?.slice(0, 5), title: p.title, verse: p.verse, reference: p.reference,
    caption: p.caption, hashtags: p.hashtags, image_url: p.media_url, video_url: p.video_url,
    link: p.link_url || null, status: p.status, posted: p.posted || {},
    text: { whatsapp: captionFor(p, 'whatsapp'), facebook: captionFor(p, 'facebook'), x: captionFor(p, 'x') },
    app_url: APP + '/#today',
  };
}

export default async function handler(req, res) {
  const key = req.headers['x-sow-key'] || (req.query && req.query.key);
  if (!process.env.SOW_API_KEY || !safeEq(key, process.env.SOW_API_KEY)) return json(res, 401, { error: 'bad key' });
  const q = req.query || {};
  if (req.method === 'POST' && q.action === 'mark') {
    const b = await readBody(req);
    const p = (await db('sp_posts?select=*&id=eq.' + encodeURIComponent(b.post_id || '')))[0];
    if (!p) return json(res, 404, { error: 'post not found' });
    if (!/^[a-z_]{1,20}$/.test(b.platform || '')) return json(res, 400, { error: 'platform?' });
    await markPosted(p, b.platform);
    return json(res, 200, { ok: true, posted: p.posted });
  }
  const today = watDate();
  if (q.date) {
    const rows = await db('sp_posts?select=*&post_date=eq.' + encodeURIComponent(q.date) + '&order=position');
    return json(res, 200, { today, post: shape(rows[0], 'date') });
  }
  if (q.which === 'next') {
    const rows = await db(`sp_posts?select=*&status=eq.queued&or=(post_date.gt.${today},and(post_date.eq.${today},post_time.gt.${watTime()}))&order=post_date,position&limit=1`);
    return json(res, 200, { today, post: shape(rows[0], 'next') });
  }
  const rows = await db('sp_posts?select=*&status=neq.skipped&post_date=eq.' + today + '&order=position&limit=1');
  if (rows[0]) return json(res, 200, { today, post: shape(rows[0], 'today') });
  const nxt = await db('sp_posts?select=*&status=neq.skipped&post_date=gt.' + today + '&order=post_date,position&limit=1');
  return json(res, 200, { today, post: null, next: shape(nxt[0], 'next') });
}
