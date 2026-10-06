// Google Sheet: one-time import + LIVE SYNC (owner only).
//   GET  /api/sheet?url=<Google Sheets link>          -> CSV text of that tab (for the one-time import screen)
//   GET  /api/sheet?status=1                          -> live-sync settings + last result
//   POST /api/sheet {action:'connect', url, map?, undated?:'schedule'|'bank'}  -> save the sheet, sync now
//   POST /api/sheet {action:'sync'}                   -> sync now
//   POST /api/sheet {action:'disconnect'}             -> stop syncing (posts already in Sow stay)
// The cron (every 30 min) also syncs; the app syncs when opened if the last sync is over 10 min old.
// The sheet must be shared "Anyone with the link can view".
import { json, readBody, requireOwner, getPref, setPref } from './_lib.js';
import { parseSheetUrl, fetchCsv, runSync } from './_sheet.js';

export default async function handler(req, res) {
  const user = await requireOwner(req, res); if (!user) return;
  const q = req.query || {};
  try {
    if (req.method === 'GET' && q.status) return json(res, 200, { sheet: await getPref('sheet', null) });
    if (req.method === 'GET') {
      const sh = parseSheetUrl(q.url);
      if (!sh) return json(res, 400, { error: 'That does not look like a Google Sheets link' });
      let t; try { t = await fetchCsv(sh); } catch (e) { return json(res, 403, { error: e.message }); }
      res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); return res.end(t);
    }
    const b = await readBody(req);
    if (b.action === 'connect') {
      const sh = parseSheetUrl(b.url);
      if (!sh) return json(res, 400, { error: 'That does not look like a Google Sheets link' });
      try { await fetchCsv(sh); } catch (e) { return json(res, 403, { error: e.message }); }
      const map = {}; for (const [k, v] of Object.entries(b.map || {})) if (typeof v === 'string' && v.length < 80) map[k] = v;
      await setPref('sheet', { url: String(b.url).slice(0, 300), id: sh.id, gid: sh.gid, map, undated: b.undated === 'bank' ? 'bank' : 'schedule', connected_at: new Date().toISOString() });
      const result = await runSync({ force: true });
      return json(res, result.error ? 422 : 200, { ok: !result.error, result, sheet: await getPref('sheet', null), error: result.error });
    }
    if (b.action === 'sync') {
      const result = await runSync({ force: true });
      return json(res, 200, { ok: !result.error, result, sheet: await getPref('sheet', null) });
    }
    if (b.action === 'settings') {
      const cfg = await getPref('sheet', null); if (!cfg) return json(res, 404, { error: 'no sheet' });
      if (b.undated) cfg.undated = b.undated === 'bank' ? 'bank' : 'schedule';
      await setPref('sheet', cfg); return json(res, 200, { ok: true, sheet: cfg });
    }
    if (b.action === 'disconnect') { await setPref('sheet', null); return json(res, 200, { ok: true }); }
    return json(res, 400, { error: 'unknown action' });
  } catch (e) { return json(res, 500, { error: String(e.message || e) }); }
}
