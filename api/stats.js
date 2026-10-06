// Analytics.
//   GET  /api/stats?summary=week   (header x-sow-key: SOW_API_KEY, for the WhatsApp bot; or the owner's session)
//        -> {from, to, marks, streak, platforms:[{platform,name,posts}], engagement:{likes,comments,reach,shares}, top_post, best_days, upcoming_7d, text}
//        ?days=N for another window (1-90). `text` is a ready-to-send WhatsApp message.
//   POST /api/stats {action:'refresh'}  (owner) -> pulls likes/comments/reach from connected platforms now
import { json, readBody, requireOwner, safeEq } from './_lib.js';
import { summary, refreshMetrics } from './_stats.js';

export default async function handler(req, res) {
  const key = req.headers['x-sow-key'] || (req.query && req.query.key);
  const byKey = !!process.env.SOW_API_KEY && safeEq(key, process.env.SOW_API_KEY);
  if (!byKey) { const u = await requireOwner(req, res); if (!u) return; }
  try {
    if (req.method === 'POST') {
      const b = await readBody(req);
      if (b.action === 'refresh') return json(res, 200, { ok: true, ...(await refreshMetrics({ limit: 25 })) });
      return json(res, 400, { error: 'unknown action' });
    }
    const days = Math.max(1, Math.min(90, +((req.query || {}).days) || 7));
    return json(res, 200, await summary(days));
  } catch (e) { return json(res, 500, { error: String(e.message || e) }); }
}
