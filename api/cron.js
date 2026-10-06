// GET/POST /api/cron  (Authorization: Bearer CRON_SECRET)
// Called every 30 min by Supabase pg_cron (job "sow-autopost", same scheduler approach as the Michael AI bot).
// For every due post (date+time reached in WAT, not skipped, last 2 days): marks "site" live and
// auto-posts to each CONNECTED platform not yet posted. Idempotent through the per-platform posted flags.
import { json, db, safeEq, watDate, watTime, markPosted, log } from './_lib.js';
import { fbStatus, fbPost, ytStatus, ytUpload, xStatus, xPost } from './_connectors.js';

export default async function handler(req, res) {
  const auth = (req.headers.authorization || '').replace(/^Bearer /, '');
  if (!process.env.CRON_SECRET || !safeEq(auth, process.env.CRON_SECRET)) return json(res, 401, { error: 'bad key' });
  const dry = req.query && req.query.dry === '1';
  const today = watDate(), now = watTime();
  const y = new Date(Date.now() + 3600e3 - 86400e3).toISOString().slice(0, 10);
  const rows = await db(`sp_posts?select=*&status=neq.skipped&post_date=gte.${y}&post_date=lte.${today}&order=post_date,position`);
  const due = rows.filter((p) => p.post_date < today || p.post_time.slice(0, 5) <= now);
  const [fb, yt, x] = [await fbStatus(), await ytStatus(), xStatus()];
  const done = [];
  for (const p of due) {
    const pl = p.platforms || [], posted = p.posted || {};
    const tasks = [];
    if (pl.includes('site') && !posted.site) tasks.push(['site', async () => { await markPosted(p, 'site'); await log(p.id, 'site', true, 'live on site'); }]);
    if (pl.includes('fb_page') && fb.connected && !posted.fb_page) tasks.push(['fb_page', () => fbPost(p)]);
    if (pl.includes('youtube') && yt.connected && p.video_url && !posted.youtube) tasks.push(['youtube', () => ytUpload(p)]);
    if (pl.includes('x') && x.connected && !posted.x) tasks.push(['x', () => xPost(p)]);
    for (const [name, fn] of tasks) {
      if (dry) { done.push({ post: p.post_date, platform: name, dry: true }); continue; }
      try { await fn(); done.push({ post: p.post_date, platform: name, ok: true }); }
      catch (e) { await log(p.id, name, false, e.message); done.push({ post: p.post_date, platform: name, ok: false, error: e.message }); }
    }
    if (!dry && pl.filter((k) => !['site'].includes(k)).every((k) => (p.posted || {})[k]) && p.status === 'queued')
      await db('sp_posts?id=eq.' + p.id, { method: 'PATCH', body: { status: 'posted' } });
  }
  return json(res, 200, { ok: true, wat: today + ' ' + now, due: due.length, connected: { fb_page: fb.connected, youtube: yt.connected, x: x.connected }, done });
}
