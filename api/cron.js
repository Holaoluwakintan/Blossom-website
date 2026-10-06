// GET/POST /api/cron  (Authorization: Bearer CRON_SECRET)
// Called every 30 min by Supabase pg_cron (job "sow-autopost").
//  1. Google Sheet live sync (if a sheet is connected).
//  2. Auto-posts every due post (date + time reached in WAT, queued, last 2 days) to each platform that is
//     CONNECTED, switched on (auto), in his channel list and in the post's platforms. A platform's time slot,
//     when set, replaces the post's own time for that platform. Idempotent through the per-platform posted flags.
//  3. Keeps the Threads login fresh; pulls likes/comments/reach every 6 hours.
import { json, db, safeEq, watDate, watTime, log, getPref, effTime } from './_lib.js';
import { AUTO, thRefreshIfNeeded } from './_connectors.js';
import { runSync } from './_sheet.js';
import { refreshMetrics } from './_stats.js';

export default async function handler(req, res) {
  const auth = (req.headers.authorization || '').replace(/^Bearer /, '');
  if (!process.env.CRON_SECRET || !safeEq(auth, process.env.CRON_SECRET)) return json(res, 401, { error: 'bad key' });
  const dry = req.query && req.query.dry === '1';
  const out = { ok: true };
  if (!dry) { try { out.sheet = await runSync(); } catch (e) { out.sheet = { error: e.message }; } }
  const today = watDate(), now = watTime();
  const y = new Date(Date.now() + 3600e3 - 86400e3).toISOString().slice(0, 10);
  const [slots, auto, channels] = [await getPref('slots', {}), await getPref('auto', {}), await getPref('channels', null)];
  const rows = await db(`sp_posts?select=*&status=in.(queued,posted)&post_date=gte.${y}&post_date=lte.${today}&order=post_date,post_time,position`);
  const conn = {};
  for (const [k, a] of Object.entries(AUTO)) { try { conn[k] = !!(await a.status()).connected && auto[k] !== false && (!channels || channels.includes(k)); } catch { conn[k] = false; } }
  const done = []; let due = 0;
  for (const p of rows) {
    const pl = p.platforms || [], posted = p.posted || {};
    let any = false;
    for (const [k, a] of Object.entries(AUTO)) {
      if (!pl.includes(k) || !conn[k] || posted[k]) continue;
      if (!(p.post_date < today || effTime(p, k, slots) <= now)) continue;
      if (a.needs && !a.needs(p)) continue;
      any = true;
      if (dry) { done.push({ post: p.post_date, platform: k, dry: true }); continue; }
      try { await a.post(p); done.push({ post: p.post_date, platform: k, ok: true }); }
      catch (e) { await log(p.id, k, false, e.message); done.push({ post: p.post_date, platform: k, ok: false, error: e.message }); }
    }
    if (any) due++;
    const mine = pl.filter((k) => !channels || channels.includes(k));
    if (!dry && mine.length && mine.every((k) => (p.posted || {})[k]) && p.status === 'queued')
      await db('sp_posts?id=eq.' + p.id, { method: 'PATCH', body: { status: 'posted' } });
  }
  if (!dry) {
    try { out.threads_refresh = await thRefreshIfNeeded(); } catch (e) { out.threads_refresh = e.message; }
    const last = await getPref('metrics_at', null);
    if (!last || Date.now() - new Date(last) > 6 * 3600e3) { try { out.metrics = await refreshMetrics({ limit: 20 }); } catch (e) { out.metrics = { error: e.message }; } }
  }
  return json(res, 200, Object.assign(out, { wat: today + ' ' + now, due, connected: conn, done }));
}
