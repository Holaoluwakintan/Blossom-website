// Google Sheet live sync. The sheet is shared "Anyone with the link can view"; we read its CSV export
// (no Google login, no API key) and add/update/remove Sow posts by a stable key.
//   key = "<sheetId8>:id:<ID column>"           when the sheet has an ID column
//       = "<sheetId8>:d:<date>|<title>"         dated rows
//       = "<sheetId8>:u:<title>"                undated rows (date assigned once, then kept)
import { db, getPref, setPref, watDate } from './_lib.js';

export const FIELDS = [
  ['sheet_id', /^(id|key|post ?id|#|no\.?|number|s\/?n)$/i],
  ['post_date', /^(date|day|post ?date|publish|schedule)/i], ['post_time', /^(time|hour)/i], ['title', /^(title|headline|topic|name)/i],
  ['caption', /^(caption|text|post|content|body|message|copy)/i], ['verse', /^(verse|scripture|bible)/i], ['reference', /^(ref|reference|book|chapter)/i],
  ['hashtags', /^(hash|tags?)/i], ['media_url', /^(image|media|picture|photo|pic|img)/i], ['video_url', /^(video|reel|short)/i], ['link_url', /^(link|url|website)/i],
  ['platforms', /^(platform|channel|where|network)/i], ['first_comment', /^(first ?comment|comment)/i], ['status', /^(status|state|draft)/i],
];
export const PLAT_ALIAS = { facebook: 'facebook', fb: 'facebook', 'fb profile': 'facebook', profile: 'facebook', groups: 'fb_groups', 'fb groups': 'fb_groups', group: 'fb_groups', 'fb page': 'fb_page', page: 'fb_page',
  whatsapp: 'whatsapp', status: 'whatsapp', 'wa status': 'whatsapp', channel: 'wa_channel', 'wa channel': 'wa_channel', 'whatsapp channel': 'wa_channel', x: 'x', twitter: 'x', youtube: 'youtube', yt: 'youtube', shorts: 'youtube',
  instagram: 'instagram', ig: 'instagram', insta: 'instagram', tiktok: 'tiktok', 'tik tok': 'tiktok', threads: 'threads', linkedin: 'linkedin', 'linked in': 'linkedin', pinterest: 'pinterest', pin: 'pinterest' };
export const ALL_PLATS = ['facebook', 'fb_groups', 'whatsapp', 'wa_channel', 'instagram', 'tiktok', 'x', 'threads', 'linkedin', 'pinterest', 'youtube', 'fb_page'];

export function parseSheetUrl(url) {
  const m = String(url || '').match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/);
  if (!m) return null;
  const gid = (String(url).match(/[#&?]gid=(\d+)/) || [])[1] || '';
  return { id: m[1], gid };
}
export async function fetchCsv(sh) {
  const u = `https://docs.google.com/spreadsheets/d/${sh.id}/export?format=csv${sh.gid ? '&gid=' + sh.gid : ''}`;
  const r = await fetch(u, { redirect: 'follow' });
  const t = await r.text();
  if (!r.ok || /<html/i.test(t.slice(0, 300))) throw new Error('Google would not share the sheet. In the sheet tap Share → General access → "Anyone with the link" → Viewer.');
  return t;
}
export function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
}
const pad = (n) => String(n).padStart(2, '0');
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
// dayFirst: Nigeria writes day/month/year; a column that has a "13+" in the second slot is month-first.
export function cellDate(v, dayFirst = true) {
  const s = String(v || '').trim(); if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return m[1] + '-' + pad(m[2]) + '-' + pad(m[3]);
  m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})(?:\s|$)/);
  if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; const [d, mo] = dayFirst ? [m[1], m[2]] : [m[2], m[1]]; if (+mo > 12 || +d > 31) return null; return y + '-' + pad(mo) + '-' + pad(d); }
  m = s.toLowerCase().replace(/,/g, ' ').match(/^(?:[a-z]+\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3,9})\.?\s+(\d{4})$/);           // 7 Oct 2026, Wed 7th October 2026
  if (m && MONTHS[m[2].slice(0, 4)] || m && MONTHS[m[2].slice(0, 3)]) return m[3] + '-' + pad(MONTHS[m[2].slice(0, 4)] || MONTHS[m[2].slice(0, 3)]) + '-' + pad(m[1]);
  m = s.toLowerCase().replace(/,/g, ' ').match(/^(?:[a-z]+\s+)?([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?\s+(\d{4})$/);         // October 7, 2026
  if (m && (MONTHS[m[1].slice(0, 4)] || MONTHS[m[1].slice(0, 3)])) return m[3] + '-' + pad(MONTHS[m[1].slice(0, 4)] || MONTHS[m[1].slice(0, 3)]) + '-' + pad(m[2]);
  if (/^\d{5}(\.\d+)?$/.test(s)) { const n = +s; if (n > 30000 && n < 80000) return new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 864e5).toISOString().slice(0, 10); }
  return null;
}
export function guessDayFirst(values) {
  let dayFirst = 0, monthFirst = 0;
  for (const v of values) { const m = String(v || '').trim().match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-]\d{2,4}/); if (!m) continue; if (+m[1] > 12) dayFirst++; if (+m[2] > 12) monthFirst++; }
  return !(monthFirst > 0 && dayFirst === 0);
}
export function cellTime(v, def) {
  const s = String(v || '').trim(); if (!s) return def;
  const m = s.match(/^(\d{1,2})(?:[:.](\d{2}))?(?::\d{2})?\s*(am|pm|a\.m\.|p\.m\.)?$/i);
  if (!m) return def; let h = +m[1]; const ap = (m[3] || '').toLowerCase();
  if (ap.startsWith('p') && h < 12) h += 12; if (ap.startsWith('a') && h === 12) h = 0;
  if (h > 23 || +(m[2] || 0) > 59) return def;
  return pad(h) + ':' + (m[2] || '00');
}
export function normMedia(u) {
  u = String(u || '').trim(); if (!u) return null;
  const m = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?.*id=)([a-zA-Z0-9_-]{20,})/);
  return m ? 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w1080' : u;
}
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 60);
function addDays(d, n) { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }

// map: {field: header name} saved from the Import screen; anything missing is auto-detected by header name.
export function columnIndex(head, map) {
  const idx = {}, used = new Set();
  for (const [f] of FIELDS) {
    const want = map && map[f];
    if (want) { const i = head.findIndex((h) => h.trim().toLowerCase() === String(want).trim().toLowerCase()); if (i >= 0) { idx[f] = i; used.add(i); } }
  }
  for (const [f, re] of FIELDS) {
    if (idx[f] !== undefined || (map && map[f] === '')) continue;
    const i = head.findIndex((h, k) => re.test(h.trim()) && !used.has(k)); if (i >= 0) { idx[f] = i; used.add(i); }
  }
  return idx;
}

export function sheetItems(aoa, sh, map, defTime = '06:00') {
  const head = aoa[0].map((h, i) => String(h).trim() || 'Column ' + (i + 1));
  const idx = columnIndex(head, map), rows = aoa.slice(1);
  const g = (r, f) => (idx[f] === undefined ? '' : String(r[idx[f]] == null ? '' : r[idx[f]]).trim());
  const dayFirst = guessDayFirst(rows.map((r) => g(r, 'post_date')));
  const pfx = sh.id.slice(0, 8) + ':', seen = {}, items = [];
  for (const r of rows) {
    const title = g(r, 'title'), cap = g(r, 'caption');
    if (!title && !cap) continue;
    const date = cellDate(g(r, 'post_date'), dayFirst);
    let pl = g(r, 'platforms').toLowerCase().split(/[,;\/|]+/).map((s) => PLAT_ALIAS[s.trim()]).filter(Boolean);
    if (pl.includes('facebook') && !pl.includes('fb_groups')) pl.push('fb_groups');
    if (pl.includes('whatsapp') && !pl.includes('wa_channel')) pl.push('wa_channel');
    let tags = g(r, 'hashtags'); if (tags && tags.indexOf('#') < 0) tags = tags.split(/[\s,]+/).filter(Boolean).map((t) => '#' + t).join(' ');
    const st = g(r, 'status').toLowerCase();
    const sid = g(r, 'sheet_id');
    let key = pfx + (sid ? 'id:' + sid : date ? 'd:' + date + '|' + norm(title || cap.slice(0, 40)) : 'u:' + norm(title || cap.slice(0, 40)));
    seen[key] = (seen[key] || 0) + 1; if (seen[key] > 1) key += '#' + seen[key];
    items.push({ key, has: { date: !!date, time: idx.post_time !== undefined && !!g(r, 'post_time'), platforms: idx.platforms !== undefined && pl.length > 0, status: !!st },
      row: { post_date: date, post_time: cellTime(g(r, 'post_time'), defTime), title: title || cap.slice(0, 40), caption: cap, verse: g(r, 'verse') || null, reference: g(r, 'reference') || null,
        hashtags: tags, media_url: normMedia(g(r, 'media_url')), video_url: g(r, 'video_url') || null, link_url: g(r, 'link_url') || null, first_comment: g(r, 'first_comment') || null,
        platforms: pl.length ? pl : ALL_PLATS.slice(),
        status: /draft/.test(st) ? 'draft' : /skip/.test(st) ? 'skipped' : 'queued' } });
  }
  return { head, idx, items, dayFirst };
}

const SYNC_FIELDS = ['title', 'caption', 'verse', 'reference', 'hashtags', 'media_url', 'video_url', 'link_url', 'first_comment'];
const same = (a, b) => JSON.stringify(a == null || a === '' ? null : a) === JSON.stringify(b == null || b === '' ? null : b);

// Runs one sync. Returns {added, updated, removed, total, unchanged}. Saves the result in sp_prefs.sheet.
export async function runSync({ force = false } = {}) {
  const cfg = await getPref('sheet', null);
  if (!cfg || !cfg.id) return { skipped: 'no sheet' };
  const result = { at: new Date().toISOString(), added: 0, updated: 0, removed: 0, total: 0, unchanged: 0, drafts: 0 };
  try {
    const aoa = parseCsv(await fetchCsv(cfg));
    if (aoa.length < 2) throw new Error('The sheet has no rows under the header row.');
    const slots = await getPref('slots', {});
    const { items, idx, head } = sheetItems(aoa, cfg, cfg.map || {}, (slots && slots.default) || '06:00');
    result.total = items.length;
    result.columns = Object.fromEntries(Object.entries(idx).map(([f, i]) => [f, head[i]]));
    if (idx.title === undefined && idx.caption === undefined) throw new Error('No Title or Caption column found. Name a column "Title" or "Caption".');
    const pfx = cfg.id.slice(0, 8) + ':';
    const existing = await db('sp_posts?select=*&sheet_key=like.' + encodeURIComponent(pfx + '*'));
    const byKey = Object.fromEntries(existing.map((p) => [p.sheet_key, p]));
    const today = watDate();
    const all = await db('sp_posts?select=post_date&post_date=not.is.null&status=neq.draft&order=post_date.desc&limit=1');
    let next = addDays(all[0] && all[0].post_date > today ? all[0].post_date : today, 1);
    const inserts = [];
    for (const it of items) {
      const cur = byKey[it.key], r = it.row;
      if (!cur) {
        const o = Object.assign({}, r, { sheet_key: it.key, source: 'sheet', slug: r.post_date });
        if (!r.post_date) {
          if (cfg.undated === 'bank' || r.status === 'draft') { o.status = 'draft'; o.post_date = null; o.slug = null; result.drafts++; }
          else { o.post_date = next; o.slug = next; next = addDays(next, 1); }
        }
        inserts.push(o); continue;
      }
      if (cur.status === 'posted' || (cur.post_date && cur.post_date < today) || Object.keys(cur.posted || {}).length) { result.unchanged++; continue; }
      const patch = {};
      for (const f of SYNC_FIELDS) if (!same(cur[f], r[f])) patch[f] = r[f];
      if (it.has.date && cur.post_date !== r.post_date) { patch.post_date = r.post_date; patch.slug = r.post_date; if (cur.status === 'draft' && r.status !== 'draft') patch.status = 'queued'; }
      if (it.has.time && String(cur.post_time).slice(0, 5) !== r.post_time) patch.post_time = r.post_time;
      if (it.has.platforms && !same(cur.platforms, r.platforms)) patch.platforms = r.platforms;
      if (it.has.status && cur.status !== r.status && !(r.status === 'queued' && !cur.post_date)) patch.status = r.status;
      if (patch.title !== undefined || patch.caption !== undefined || patch.verse !== undefined) patch.captions = {};
      if (patch.media_url !== undefined) patch.thumb_url = null;
      if (Object.keys(patch).length) { await db('sp_posts?id=eq.' + cur.id, { method: 'PATCH', body: patch }); result.updated++; }
      else result.unchanged++;
    }
    if (inserts.length) { await db('sp_posts', { method: 'POST', body: inserts }); result.added = inserts.length; }
    // Rows deleted from the sheet: remove them from Sow only if they were never posted and are not in the past.
    const keys = new Set(items.map((i) => i.key));
    const gone = items.length ? existing.filter((p) => !keys.has(p.sheet_key) && !Object.keys(p.posted || {}).length && p.status !== 'posted' && (!p.post_date || p.post_date >= today)) : [];
    if (gone.length) { await db('sp_posts?id=in.(' + gone.map((p) => p.id).join(',') + ')', { method: 'DELETE' }); result.removed = gone.length; }
    cfg.last_synced = result.at; cfg.last_result = result; cfg.last_error = null;
  } catch (e) {
    result.error = String(e.message || e); cfg.last_error = result.error; cfg.last_try = result.at;
  }
  await setPref('sheet', cfg);
  return result;
}
