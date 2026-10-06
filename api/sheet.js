// GET /api/sheet?url=<Google Sheets link>  (owner only) -> CSV text of that sheet tab.
// The sheet must be shared "Anyone with the link can view" (or published).
import { json, requireOwner } from './_lib.js';
export default async function handler(req, res) {
  const user = await requireOwner(req, res); if (!user) return;
  const url = String((req.query || {}).url || '');
  const m = url.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/);
  if (!m) return json(res, 400, { error: 'That does not look like a Google Sheets link' });
  const gid = (url.match(/[#&?]gid=(\d+)/) || [])[1];
  const csvUrl = `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv${gid ? '&gid=' + gid : ''}`;
  const r = await fetch(csvUrl, { redirect: 'follow' });
  const t = await r.text();
  if (!r.ok || /<html/i.test(t.slice(0, 200))) return json(res, 403, { error: 'Google would not share it. In the sheet tap Share → General access → "Anyone with the link" → Viewer, then try again.' });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.end(t);
}
