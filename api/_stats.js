// Analytics from Michael's own ✓ marks, plus likes/comments/reach for connected APIs where the free API allows it.
import { db, watDate, getPref, setPref } from './_lib.js';
import { AUTO } from './_connectors.js';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const NAMES = { facebook: 'Facebook profile', fb_groups: 'Facebook groups', whatsapp: 'WhatsApp Status', wa_channel: 'WhatsApp Channel', instagram: 'Instagram', tiktok: 'TikTok', x: 'X', threads: 'Threads', linkedin: 'LinkedIn', pinterest: 'Pinterest', youtube: 'YouTube', fb_page: 'Facebook Page' };
const lagosDay = (iso) => new Date(new Date(iso).getTime() + 3600e3).toISOString().slice(0, 10);
function addDays(d, n) { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }

export async function refreshMetrics({ limit = 25 } = {}) {
  const since = addDays(watDate(), -30);
  const rows = await db(`sp_posts?select=id,post_date,remote,metrics&remote=neq.{}&post_date=gte.${since}&order=post_date.desc&limit=${limit}`);
  let n = 0; const errors = [];
  for (const p of rows) {
    const metrics = Object.assign({}, p.metrics || {});
    for (const [plat, rid] of Object.entries(p.remote || {})) {
      const fn = AUTO[plat] && AUTO[plat].metrics; if (!fn) continue;
      try { const m = await fn(rid); if (m) { metrics[plat] = Object.assign(m, { at: new Date().toISOString() }); n++; } }
      catch (e) { errors.push(plat + ': ' + e.message); }
    }
    await db('sp_posts?id=eq.' + p.id, { method: 'PATCH', body: { metrics } });
  }
  await setPref('metrics_at', new Date().toISOString());
  return { refreshed: n, posts: rows.length, errors: [...new Set(errors)].slice(0, 5) };
}

// Weekly summary (the bot can fetch it). days = window length ending today (WAT).
export async function summary(days = 7) {
  const today = watDate(), from = addDays(today, -(days - 1)), prevFrom = addDays(from, -days);
  const rows = await db('sp_posts?select=id,post_date,title,status,posted,metrics,platforms&order=post_date');
  const per = {}, prev = {}, byWeekday = [0, 0, 0, 0, 0, 0, 0], marksDays = new Set();
  let marks = 0, prevMarks = 0; const eng = { likes: 0, comments: 0, reach: 0, shares: 0 }; let top = null;
  for (const p of rows) {
    for (const [k, at] of Object.entries(p.posted || {})) {
      const d = lagosDay(at); marksDays.add(d); byWeekday[new Date(d + 'T12:00:00Z').getUTCDay()]++;
      if (d >= from && d <= today) { per[k] = (per[k] || 0) + 1; marks++; }
      else if (d >= prevFrom && d < from) { prev[k] = (prev[k] || 0) + 1; prevMarks++; }
    }
    if (p.post_date >= from && p.post_date <= today) {
      let score = 0;
      for (const m of Object.values(p.metrics || {})) { for (const f of ['likes', 'comments', 'reach', 'shares']) eng[f] += m[f] || 0; score += (m.likes || 0) + 3 * (m.comments || 0); }
      if (score && (!top || score > top.score)) top = { title: p.title, date: p.post_date, score };
    }
  }
  let streak = 0, d = marksDays.has(today) ? today : addDays(today, -1);
  while (marksDays.has(d)) { streak++; d = addDays(d, -1); }
  const best = byWeekday.map((n, i) => ({ day: DAYS[i], n })).filter((x) => x.n).sort((a, b) => b.n - a.n).slice(0, 2);
  const upcoming = rows.filter((p) => p.post_date && p.post_date > today && p.post_date <= addDays(today, 7) && p.status === 'queued').length;
  const platforms = Object.entries(per).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ platform: k, name: NAMES[k] || k, posts: n }));
  const lines = [
    `📊 Sow week (${from} → ${today})`,
    `Posted ${marks} time${marks === 1 ? '' : 's'}` + (prevMarks ? ` (last week ${prevMarks})` : '') + ` · 🔥 streak ${streak} day${streak === 1 ? '' : 's'}`,
    platforms.length ? platforms.map((p) => `${p.name} ${p.posts}`).join(' · ') : 'No ✓ marks yet this week.',
    eng.likes || eng.comments || eng.reach ? `❤️ ${eng.likes} likes · 💬 ${eng.comments} comments` + (eng.reach ? ` · 👀 ${eng.reach} reach` : '') : '',
    top ? `Top post: “${top.title}” (${top.date})` : '',
    best.length ? `Best days so far: ${best.map((b) => b.day).join(', ')}` : '',
    `${upcoming} post${upcoming === 1 ? '' : 's'} queued for the next 7 days.`,
  ].filter(Boolean);
  return { from, to: today, marks, prev_marks: prevMarks, streak, platforms, engagement: eng, top_post: top, best_days: best, upcoming_7d: upcoming, metrics_at: await getPref('metrics_at', null), text: lines.join('\n') };
}
