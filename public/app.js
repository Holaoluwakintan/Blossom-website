/* Sow: daily posting app for Olaoluwa Michael. Plain JS, no build step. */
'use strict';
var CFG = window.SOW_CFG;
var sb = window.supabase.createClient(CFG.url, CFG.anon, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'sow-auth' } });
var S = { posts: [], files: {}, vfiles: {}, conn: null, session: null };
var $ = function (s, el) { return (el || document).querySelector(s); };
var view = $('#view');

// One card per platform. mode: tap = share sheet (Meta has no API for profiles/groups/Status/Channel),
// intent = opens X composer, video = Shorts file, auto = posts by itself once connected.
var PLAT = [
  { k: 'facebook',   ic: '📘', nm: 'Facebook profile', mode: 'tap',   cap: 'facebook', hint: 'Pick Facebook, then long-press → Paste for the caption' },
  { k: 'fb_groups',  ic: '👥', nm: 'Facebook groups',  mode: 'tap',   cap: 'facebook', hint: 'Pick Facebook → Share to a group → Paste' },
  { k: 'whatsapp',   ic: '🟢', nm: 'WhatsApp Status',  mode: 'tap',   cap: 'whatsapp', hint: 'Pick WhatsApp → My status' },
  { k: 'wa_channel', ic: '📣', nm: 'WhatsApp Channel', mode: 'tap',   cap: 'whatsapp', hint: 'Pick WhatsApp → your Channel' },
  { k: 'x',          ic: '𝕏',  nm: 'X (Twitter)',      mode: 'intent', cap: 'x' },
  { k: 'youtube',    ic: '▶️', nm: 'YouTube Shorts',   mode: 'video', cap: 'youtube_desc' },
  { k: 'fb_page',    ic: '🏳️', nm: 'Facebook Page',    mode: 'auto' },
  { k: 'site',       ic: '🌐', nm: 'Your website',     mode: 'auto' },
];
var PNAME = {}; PLAT.forEach(function (p) { PNAME[p.k] = p.nm; });

/* ---------- helpers ---------- */
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function wat() { return new Date(Date.now() + 3600e3); }                // Africa/Lagos = UTC+1, no DST
function today() { return wat().toISOString().slice(0, 10); }
function nowHM() { return wat().toISOString().slice(11, 16); }
function addDays(d, n) { var x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
function niceDate(d) { var x = new Date(d + 'T12:00:00Z'); return x.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }); }
function rel(d) { var t = today(); return d === t ? 'Today' : d === addDays(t, 1) ? 'Tomorrow' : d === addDays(t, -1) ? 'Yesterday' : niceDate(d); }
function toast(msg, ms) { var t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(function () { t.hidden = true; }, ms || 2600); }
function siteLink(p) { return p.link_url || (CFG.site + '/daily-verse/' + p.post_date); }
function mediaSrc(u) { return !u ? '' : /supabase\.co\//.test(u) ? u : '/api/img?u=' + encodeURIComponent(u); }
function thumb(p) { return p.thumb_url || mediaSrc(p.media_url); }

function capFor(p, k) {
  var c = (p.captions || {})[k]; if (c) return c;
  var verse = p.verse ? '“' + p.verse + '”\n— ' + p.reference + ' (KJV)' : '';
  if (k === 'x') {
    var room = 256, t = p.caption + (p.reference ? ' (' + p.reference + ')' : '');
    if (t.length > room) t = t.slice(0, room - 1) + '…';
    (p.hashtags || '').split(/\s+/).filter(Boolean).forEach(function (tag) { if ((t + ' ' + tag).length <= room) t += ' ' + tag; });
    return t + '\n' + siteLink(p);
  }
  if (k === 'whatsapp') return ['*' + p.title + '*', p.caption, verse].filter(Boolean).join('\n\n');
  if (k === 'youtube_title') return (p.title + ' | ' + (p.reference || 'Daily Verse') + ' #shorts').slice(0, 100);
  if (k === 'youtube_desc') return [p.caption, verse, 'Daily verse: ' + siteLink(p), (p.hashtags || '') + ' #shorts'].filter(Boolean).join('\n\n');
  return [p.caption, verse, p.hashtags].filter(Boolean).join('\n\n');
}

async function api(path, opts) {
  opts = opts || {};
  var s = (await sb.auth.getSession()).data.session;
  var h = { 'Content-Type': 'application/json' }; if (s) h.Authorization = 'Bearer ' + s.access_token;
  var r = await fetch(path, { method: opts.method || (opts.body ? 'POST' : 'GET'), headers: h, body: opts.body ? JSON.stringify(opts.body) : undefined });
  var ct = r.headers.get('content-type') || '';
  var j = ct.indexOf('json') >= 0 ? await r.json() : await r.text();
  if (!r.ok) throw new Error((j && j.error) || ('Error ' + r.status));
  return j;
}
async function copy(text) { try { await navigator.clipboard.writeText(text); return true; } catch (e) { return false; } }

/* ---------- data ---------- */
async function loadPosts() {
  var r = await sb.from('sp_posts').select('*').order('post_date').order('position');
  if (r.error) throw r.error;
  S.posts = r.data || [];
}
function focusPost() {
  var t = today(), live = S.posts.filter(function (p) { return p.status !== 'skipped'; });
  var td = live.filter(function (p) { return p.post_date === t; })[0];
  if (td) return { p: td, label: 'Today' };
  var nx = live.filter(function (p) { return p.post_date > t; })[0];
  if (nx) return { p: nx, label: rel(nx.post_date) };
  var last = live.filter(function (p) { return p.post_date < t; }).pop();
  return last ? { p: last, label: rel(last.post_date) } : null;
}
function manualKeys(posted) { return Object.keys(posted || {}).filter(function (k) { return k !== 'site'; }); }
function streak() {
  var byDay = {}; S.posts.forEach(function (p) { if (manualKeys(p.posted).length) byDay[p.post_date] = true; });
  var d = today(), n = 0; if (!byDay[d]) d = addDays(d, -1);
  while (byDay[d]) { n++; d = addDays(d, -1); }
  return n;
}
function showStreak() { var n = streak(), el = $('#streak'); el.hidden = false; el.textContent = '🔥 ' + n + (n === 1 ? ' day' : ' days'); el.title = 'Days in a row you posted'; }

async function setPosted(p, k, on) {
  var posted = Object.assign({}, p.posted || {});
  if (on) posted[k] = new Date().toISOString(); else delete posted[k];
  var r = await sb.from('sp_posts').update({ posted: posted }).eq('id', p.id).select().single();
  if (r.error) { toast('Could not save: ' + r.error.message); return; }
  Object.assign(p, r.data); showStreak();
}

/* Pre-fetch the picture as a File so the share sheet opens instantly (Android needs the tap to still be "fresh"). */
async function getFile(p, video) {
  var bag = video ? S.vfiles : S.files;
  if (bag[p.id]) return bag[p.id];
  var url = video ? p.video_url : p.media_url; if (!url) return null;
  var r = await fetch(mediaSrc(url)); if (!r.ok) throw new Error('download failed');
  var b = await r.blob();
  var name = (p.slug || p.post_date || 'post') + '-' + (p.title || 'verse').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + (video ? '.mp4' : '.jpg');
  bag[p.id] = new File([b], name, { type: b.type || (video ? 'video/mp4' : 'image/jpeg') });
  return bag[p.id];
}

async function shareFlow(p, capKey, platKey, video) {
  var text = capFor(p, capKey);
  var copied = await copy(text);
  var file = video ? S.vfiles[p.id] : S.files[p.id];
  if (!file) {
    try { file = await getFile(p, video); } catch (e) { file = null; }
    if (file) { toast((copied ? 'Caption copied. ' : '') + 'Ready, tap Share again'); render(); return; }
  }
  try {
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], text: text, title: p.title });
    } else if (navigator.share) {
      await navigator.share({ text: text + '\n' + (p.media_url || ''), title: p.title });
    } else {
      downloadUrl(video ? p.video_url : p.media_url); toast('Caption copied, picture saved. Open the app and paste.'); return;
    }
    if (platKey) { await setPosted(p, platKey, true); toast('✓ ' + PNAME[platKey] + ' marked. Caption is copied if you need to paste.', 3500); render(); }
    else toast('Shared ✓ Tap ✓ on each place you posted.', 3500);
  } catch (e) {
    if (e && e.name === 'AbortError') toast('Cancelled. Caption is still copied.');
    else toast('Could not open share: ' + (e.message || e));
  }
}
function downloadUrl(u) { if (!u) return; var a = document.createElement('a'); a.href = /supabase\.co\/storage/.test(u) ? u + (u.indexOf('?') < 0 ? '?' : '&') + 'download=' : u; a.download = ''; a.target = '_blank'; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove(); }

/* ---------- views ---------- */
function setTab(t) { document.querySelectorAll('.tabs a').forEach(function (a) { a.classList.toggle('on', a.dataset.t === t); }); }

function platCard(p, pl) {
  var posted = (p.posted || {})[pl.k], conn = S.conn || {}, st, acts = '', mode = pl.mode;
  if (pl.k === 'x' && conn.x && conn.x.connected) mode = 'auto';
  if (pl.k === 'youtube' && conn.youtube && conn.youtube.connected) mode = 'auto+video';
  var pill = mode === 'tap' ? '<span class="pill tap">1-tap</span>' : mode === 'intent' ? '<span class="pill tap">1-tap</span>' : mode.indexOf('auto') === 0 ? '<span class="pill auto">auto</span>' : '<span class="pill tap">video</span>';
  if (posted) st = '✓ Posted ' + new Date(posted).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' });
  if (pl.mode === 'tap') {
    st = st || pl.hint;
    acts = '<button class="btn sm" data-share="' + pl.k + '">Share</button>';
  } else if (pl.k === 'x') {
    st = st || (mode === 'auto' ? 'Posts itself at ' + p.post_time.slice(0, 5) : 'Opens X with the caption + your site link');
    acts = '<a class="btn sm" data-x="1" target="_blank" rel="noopener" href="https://x.com/intent/post?text=' + encodeURIComponent(capFor(p, 'x')) + '">Post to X</a>';
  } else if (pl.k === 'youtube') {
    if (!p.video_url) { st = st || 'No video for this post yet'; }
    else {
      st = st || (mode === 'auto+video' ? 'Uploads itself at ' + p.post_time.slice(0, 5) : 'Share the video to the YouTube app, or download it');
      acts = '<button class="btn sm" data-vshare="1">' + (S.vfiles[p.id] ? 'Share video' : 'Get video') + '</button><button class="btn sm ghost" data-vdl="1">⬇</button>';
    }
  } else if (pl.k === 'fb_page') {
    var on = conn.fb_page && conn.fb_page.connected;
    st = st || (on ? 'Posts itself at ' + p.post_time.slice(0, 5) : 'Not connected yet');
    if (!on) { pill = '<span class="pill off">soon</span>'; acts = '<a class="btn sm ghost" href="#connect">Why?</a>'; }
  } else if (pl.k === 'site') {
    st = st || ('Goes live by itself at ' + p.post_time.slice(0, 5));
    acts = '<a class="btn sm ghost" target="_blank" rel="noopener" href="' + esc(siteLink(p)) + '">View</a>';
  }
  return '<div class="plat' + (posted ? ' done' : '') + '" data-k="' + pl.k + '"><div class="ic">' + pl.ic + '</div><div class="grow"><div class="nm">' + esc(pl.nm) + ' ' + pill + '</div><div class="st">' + esc(st) + '</div></div><div class="acts">' + acts +
    (pl.k !== 'site' ? '<button class="chk" data-mark="' + pl.k + '" aria-label="Mark ' + esc(pl.nm) + ' posted">' + (posted ? '✓' : '') + '</button>' : '') + '</div></div>';
}

function renderToday() {
  setTab('today');
  var f = focusPost();
  if (!f) { view.innerHTML = '<div class="card center"><h2>Your bank is empty</h2><p class="muted">Import your content bank to get started.</p><a class="btn" href="#import">Import posts</a></div>'; return; }
  var p = f.p, plats = PLAT.filter(function (pl) { return (p.platforms || []).indexOf(pl.k) >= 0; });
  var early = p.post_date > today();
  var done = plats.filter(function (pl) { return (p.posted || {})[pl.k]; }).length;
  view.innerHTML =
    (early ? '<div class="card small"><b>Your first verse goes out ' + esc(rel(p.post_date).toLowerCase()) + ' at ' + esc(p.post_time.slice(0, 5)) + '.</b> Everything below is ready. You can share early if you like.</div>' : '') +
    '<div class="card hero"><div class="label"><span>' + esc(f.label) + ' · ' + esc(niceDate(p.post_date)) + ' · ' + esc(p.post_time.slice(0, 5)) + '</span><span>' + done + '/' + plats.length + ' done</span></div>' +
    (p.media_url ? '<img id="heroimg" src="' + esc(mediaSrc(p.media_url)) + '" alt="' + esc(p.title) + '">' : '') +
    '<div class="body"><h2>' + esc(p.title) + '</h2>' + (p.reference ? '<div class="ref">' + esc(p.reference) + '</div>' : '') + '<p class="cap">' + esc(p.caption) + '</p><p class="muted small">' + esc(p.hashtags) + '</p>' +
    '<button class="btn big" id="shareAll">📤 Share picture + caption</button>' +
    '<p class="small muted center" style="margin:8px 0 0">Copies the caption, then opens your phone\'s share menu with the picture. Pick Facebook, WhatsApp, anywhere.</p>' +
    '<div class="row" style="margin-top:10px"><button class="btn sm soft grow" id="aiBtn">✨ Rewrite for each platform</button><button class="btn sm ghost" id="editBtn">Edit</button></div></div></div>' +
    '<h3>Where it goes</h3><div class="plats">' + plats.map(function (pl) { return platCard(p, pl); }).join('') + '</div>' +
    '<details class="card"><summary>How Sow works</summary><ol class="steps small"><li><b>Share picture + caption</b> copies the caption and opens the share menu with the picture attached.</li><li>Pick Facebook or WhatsApp. If the caption box is empty, long-press and <b>Paste</b>.</li><li>Tap <b>✓</b> on each place you posted. Your 🔥 streak grows each day.</li><li>Your website updates by itself every morning. Facebook Page, YouTube and X go automatic once connected.</li></ol></details>';
  view.querySelector('#shareAll').onclick = function () { shareFlow(p, 'facebook', null); };
  view.querySelector('#editBtn').onclick = function () { openEdit(p); };
  view.querySelector('#aiBtn').onclick = function () { openEdit(p, true); };
  view.querySelectorAll('[data-share]').forEach(function (b) { b.onclick = function () { var pl = PLAT.filter(function (x) { return x.k === b.dataset.share; })[0]; shareFlow(p, pl.cap, pl.k); }; });
  view.querySelectorAll('[data-mark]').forEach(function (b) { b.onclick = async function () { var k = b.dataset.mark; await setPosted(p, k, !(p.posted || {})[k]); render(); }; });
  var xb = view.querySelector('[data-x]'); if (xb) xb.addEventListener('click', function () { copy(capFor(p, 'x')); setTimeout(function () { if (!(p.posted || {}).x && confirm('Did it post on X? Mark it done?')) setPosted(p, 'x', true).then(render); }, 1500); });
  var vs = view.querySelector('[data-vshare]'); if (vs) vs.onclick = function () { shareFlow(p, 'youtube_desc', 'youtube', true); };
  var vd = view.querySelector('[data-vdl]'); if (vd) vd.onclick = function () { copy(capFor(p, 'youtube_title') + '\n\n' + capFor(p, 'youtube_desc')); downloadUrl(p.video_url); toast('Video downloading. Title + description copied.'); };
  if (p.media_url) getFile(p).catch(function () {});   // warm the picture for an instant share sheet
}

function renderQueue() {
  setTab('queue');
  var t = today();
  var past = S.posts.filter(function (p) { return p.post_date < t; }), up = S.posts.filter(function (p) { return p.post_date >= t; });
  function item(p) {
    var marks = manualKeys(p.posted).length;
    return '<div class="q-item' + (p.status === 'skipped' ? ' skipped' : '') + (p.post_date === t ? ' today' : '') + '" data-id="' + p.id + '">' +
      (thumb(p) ? '<img loading="lazy" src="' + esc(thumb(p)) + '" alt="">' : '<img alt="">') +
      '<div class="grow"><div class="d">' + esc(rel(p.post_date)) + ' · ' + esc(p.post_time.slice(0, 5)) + (p.status === 'skipped' ? ' · skipped' : marks ? ' · ✓ ' + marks + ' posted' : '') + '</div><div class="t">' + esc(p.title || '(no title)') + '</div><div class="d">' + esc((p.caption || '').slice(0, 70)) + '</div></div>' +
      '<div class="q-acts"><button class="icon-btn" data-up="' + p.id + '" aria-label="Move earlier">▲</button><button class="icon-btn" data-ed="' + p.id + '" aria-label="Edit">✎</button><button class="icon-btn" data-dn="' + p.id + '" aria-label="Move later">▼</button></div></div>';
  }
  view.innerHTML = '<div class="row"><h2 class="grow">Queue</h2><button class="btn sm" id="addBtn">+ Add post</button></div>' +
    '<p class="small muted">' + up.filter(function (p) { return p.status === 'queued'; }).length + ' posts queued. Use ▲ ▼ to swap days, ✎ to edit or skip.</p>' +
    '<div class="card">' + (up.length ? up.map(item).join('') : '<p class="muted">Nothing queued. Import more from your content bank.</p>') + '</div>' +
    (past.length ? '<details class="card"><summary>Earlier (' + past.length + ')</summary>' + past.slice().reverse().map(item).join('') + '</details>' : '');
  view.querySelector('#addBtn').onclick = function () {
    var last = S.posts.length ? S.posts[S.posts.length - 1].post_date : today();
    openEdit({ post_date: addDays(last > today() ? last : today(), 1), post_time: '06:00', title: '', caption: '', hashtags: '', platforms: PLAT.map(function (x) { return x.k; }), captions: {}, posted: {}, status: 'queued' });
  };
  view.querySelectorAll('[data-ed]').forEach(function (b) { b.onclick = function () { openEdit(byId(b.dataset.ed)); }; });
  view.querySelectorAll('[data-up]').forEach(function (b) { b.onclick = function () { swap(b.dataset.up, -1); }; });
  view.querySelectorAll('[data-dn]').forEach(function (b) { b.onclick = function () { swap(b.dataset.dn, 1); }; });
}
function byId(id) { return S.posts.filter(function (p) { return p.id === id; })[0]; }
async function swap(id, dir) {
  var i = S.posts.findIndex(function (p) { return p.id === id; }), j = i + dir;
  if (j < 0 || j >= S.posts.length) return;
  var a = S.posts[i], b = S.posts[j];
  var A = { post_date: b.post_date, post_time: b.post_time, position: b.position, slug: b.slug, link_url: b.link_url };
  var B = { post_date: a.post_date, post_time: a.post_time, position: a.position, slug: a.slug, link_url: a.link_url };
  if (A.post_date === B.post_date && A.position === B.position) { A.position = B.position + (dir > 0 ? 1 : -1); }
  var r1 = await sb.from('sp_posts').update(A).eq('id', a.id), r2 = await sb.from('sp_posts').update(B).eq('id', b.id);
  if (r1.error || r2.error) return toast('Could not move: ' + (r1.error || r2.error).message);
  await loadPosts(); render(); toast('Moved ✓');
}

/* ---------- edit sheet ---------- */
function openEdit(p, aiFirst) {
  var isNew = !p.id, m = $('#modal'), caps = p.captions || {};
  m.innerHTML = '<div class="sheet"><div class="row"><h2 class="grow">' + (isNew ? 'New post' : 'Edit post') + '</h2><button class="btn sm ghost" id="mClose">Close</button></div>' +
    '<div class="row"><div class="grow"><label>Date</label><input type="date" id="fDate" value="' + esc(p.post_date) + '"></div><div style="width:120px"><label>Time (WAT)</label><input type="time" id="fTime" value="' + esc((p.post_time || '06:00').slice(0, 5)) + '"></div></div>' +
    '<label>Title</label><input id="fTitle" value="' + esc(p.title) + '">' +
    '<label>Caption</label><textarea id="fCap">' + esc(p.caption) + '</textarea>' +
    '<div class="row"><div class="grow"><label>Bible verse (optional)</label><textarea id="fVerse" style="min-height:60px">' + esc(p.verse || '') + '</textarea></div></div>' +
    '<div class="row"><div class="grow"><label>Reference</label><input id="fRef" value="' + esc(p.reference || '') + '"></div><div class="grow"><label>Hashtags</label><input id="fTags" value="' + esc(p.hashtags || '') + '"></div></div>' +
    '<label>Picture</label><div class="row">' + (p.media_url ? '<img src="' + esc(thumb(p)) + '" style="width:54px;height:96px;object-fit:cover;border-radius:8px">' : '') + '<input class="grow" id="fMedia" placeholder="Image link (Drive or web)" value="' + esc(p.media_url || '') + '"></div>' +
    '<label class="btn sm ghost" style="display:inline-flex;margin-top:6px">📷 Upload picture<input type="file" id="fFile" accept="image/*" hidden></label>' +
    '<label>Post to</label><div class="row wrap">' + PLAT.map(function (pl) { return '<label style="display:inline-flex;gap:6px;align-items:center;margin:2px 8px 2px 0;font-weight:500;color:var(--ink)"><input type="checkbox" style="width:auto" value="' + pl.k + '"' + ((p.platforms || []).indexOf(pl.k) >= 0 ? ' checked' : '') + '> ' + pl.nm + '</label>'; }).join('') + '</div>' +
    '<div class="ai-box" id="aiBox"><div class="row"><b class="grow">✨ Captions per platform</b><button class="btn sm soft" id="aiGo">' + (Object.keys(caps).length ? 'Rewrite again' : 'Write them') + '</button></div><p class="small muted">AI writes a long Facebook post, a short X post, a YouTube title and description, a WhatsApp version and a website note. Edit anything.</p>' +
    [['facebook', 'Facebook'], ['whatsapp', 'WhatsApp'], ['x', 'X (≤280)'], ['youtube_title', 'YouTube title'], ['youtube_desc', 'YouTube description'], ['site', 'Website note']].map(function (c) { return '<label>' + c[1] + '</label><textarea data-cap="' + c[0] + '" style="min-height:' + (c[0] === 'youtube_title' ? 50 : 80) + 'px">' + esc(caps[c[0]] || '') + '</textarea>'; }).join('') + '<div class="small muted" id="xCount"></div></div>' +
    '<div class="row" style="margin-top:14px"><button class="btn grow" id="mSave">Save</button>' + (isNew ? '' : '<button class="btn ghost" id="mSkip">' + (p.status === 'skipped' ? 'Unskip' : 'Skip') + '</button><button class="btn ghost" id="mDel" aria-label="Delete">🗑</button>') + '</div></div>';
  m.hidden = false;
  var xc = function () { var v = m.querySelector('[data-cap="x"]').value; m.querySelector('#xCount').textContent = v ? 'X post: ' + xLen(v) + '/280' : ''; };
  m.querySelector('[data-cap="x"]').oninput = xc; xc();
  m.querySelector('#mClose').onclick = closeModal;
  m.onclick = function (e) { if (e.target === m) closeModal(); };
  m.querySelector('#fFile').onchange = async function (e) {
    var f = e.target.files[0]; if (!f) return; toast('Uploading picture…', 8000);
    try { var url = await uploadImage(f); m.querySelector('#fMedia').value = url; toast('Picture uploaded ✓'); } catch (err) { toast('Upload failed: ' + err.message); }
  };
  function gather() {
    var plats = Array.prototype.map.call(m.querySelectorAll('input[type=checkbox]:checked'), function (c) { return c.value; });
    var captions = {}; m.querySelectorAll('[data-cap]').forEach(function (t) { if (t.value.trim()) captions[t.dataset.cap] = t.value.trim(); });
    var d = m.querySelector('#fDate').value || today(), media = m.querySelector('#fMedia').value.trim() || null;
    var o = { post_date: d, post_time: m.querySelector('#fTime').value || '06:00', title: m.querySelector('#fTitle').value.trim(), caption: m.querySelector('#fCap').value.trim(),
      verse: m.querySelector('#fVerse').value.trim() || null, reference: m.querySelector('#fRef').value.trim() || null, hashtags: m.querySelector('#fTags').value.trim(),
      media_url: normMedia(media), platforms: plats, captions: captions, slug: d, link_url: CFG.site + '/daily-verse/' + d };
    if (media !== p.media_url) o.thumb_url = null;
    return o;
  }
  m.querySelector('#aiGo').onclick = async function (e) {
    var b = e.target; b.disabled = true; b.textContent = 'Writing…';
    try {
      var o = gather(), r;
      if (p.id) { var base = Object.assign({}, o); delete base.captions; var u = await sb.from('sp_posts').update(base).eq('id', p.id); if (u.error) throw u.error; }
      r = await api('/api/rewrite', { body: p.id ? { post_id: p.id } : { post: Object.assign({}, p, o) } });
      if (p.id) { var cur = byId(p.id); if (cur) cur.captions = Object.assign({}, cur.captions || {}, r.captions); }
      Object.keys(r.captions).forEach(function (k) { var t = m.querySelector('[data-cap="' + k + '"]'); if (t) t.value = r.captions[k]; });
      xc(); toast('✨ Written. Edit anything, then Save.');
    } catch (err) { toast(err.message, 4000); }
    b.disabled = false; b.textContent = 'Rewrite again';
  };
  m.querySelector('#mSave').onclick = async function () {
    var o = gather(), r;
    if (!o.title && !o.caption) return toast('Add a title or caption');
    r = isNew ? await sb.from('sp_posts').insert(Object.assign(o, { source: 'manual' })) : await sb.from('sp_posts').update(o).eq('id', p.id);
    if (r.error) return toast('Could not save: ' + r.error.message);
    S.files = {}; closeModal(); await loadPosts(); render(); toast('Saved ✓');
  };
  if (!isNew) {
    m.querySelector('#mSkip').onclick = async function () {
      var r = await sb.from('sp_posts').update({ status: p.status === 'skipped' ? 'queued' : 'skipped' }).eq('id', p.id);
      if (r.error) return toast(r.error.message); closeModal(); await loadPosts(); render(); toast(p.status === 'skipped' ? 'Back in the queue' : 'Skipped');
    };
    m.querySelector('#mDel').onclick = async function () {
      if (!confirm('Delete this post from the bank?')) return;
      var r = await sb.from('sp_posts').delete().eq('id', p.id); if (r.error) return toast(r.error.message);
      closeModal(); await loadPosts(); render(); toast('Deleted');
    };
  }
  if (aiFirst) { m.querySelector('#aiBox').scrollIntoView(); if (!Object.keys(caps).length) m.querySelector('#aiGo').click(); }
}
function closeModal() { var m = $('#modal'); m.hidden = true; m.innerHTML = ''; }
function xLen(t) { return t.replace(/https?:\/\/\S+/g, '12345678901234567890123').length; }
function normMedia(u) {
  if (!u) return null;
  var m = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?.*id=)([a-zA-Z0-9_-]{20,})/);
  return m ? 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w1080' : u;
}
async function uploadImage(file) {
  var img = await createImageBitmap(file), scale = Math.min(1, 1080 / img.width), c = document.createElement('canvas');
  c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  var blob = await new Promise(function (r) { c.toBlob(r, 'image/jpeg', 0.86); });
  var path = 'uploads/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.jpg';
  var r = await sb.storage.from('sow-media').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (r.error) throw r.error;
  return sb.storage.from('sow-media').getPublicUrl(path).data.publicUrl;
}

/* ---------- import (Excel / CSV / Google Sheets) ---------- */
var FIELDS = [
  ['post_date', 'Date', /^(date|day|post ?date|publish|schedule)/i], ['post_time', 'Time', /^(time|hour)/i], ['title', 'Title', /^(title|headline|topic|name)/i],
  ['caption', 'Caption', /^(caption|text|post|content|body|message|copy)/i], ['verse', 'Bible verse', /^(verse|scripture|bible)/i], ['reference', 'Reference', /^(ref|reference|book|chapter)/i],
  ['hashtags', 'Hashtags', /^(hash|tags?)/i], ['media_url', 'Image link', /^(image|media|picture|photo|pic|img|url|link)/i], ['video_url', 'Video link', /^(video|reel|short)/i],
  ['platforms', 'Platforms', /^(platform|channel|where|network)/i],
];
var IMP = { rows: null, head: null, map: {} };
function loadSheetJS() {
  if (window.XLSX) return Promise.resolve();
  return new Promise(function (ok, no) { var s = document.createElement('script'); s.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.mini.min.js'; s.onload = ok; s.onerror = function () { no(new Error('Could not load the Excel reader. Check your data.')); }; document.head.appendChild(s); });
}
function renderImport() {
  setTab('import');
  view.innerHTML = '<h2>Import your content bank</h2><p class="small muted">Each row = one post. Excel (.xlsx), CSV or a Google Sheet. You choose which column is which.</p>' +
    '<div class="card"><label class="btn" style="color:#fff;margin:0">📂 Choose Excel / CSV file<input type="file" id="iFile" accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden></label>' +
    '<label>Or paste a Google Sheets link</label><div class="row"><input id="iUrl" placeholder="https://docs.google.com/spreadsheets/d/…"><button class="btn sm" id="iLoad">Load</button></div>' +
    '<p class="small muted">The sheet must be shared as “Anyone with the link → Viewer”.</p>' +
    '<p class="small"><a href="/template/sow-content-bank-template.xlsx" download>⬇ Download the template (.xlsx)</a>' + (CFG.sheetCopy ? ' · <a href="' + CFG.sheetCopy + '" target="_blank" rel="noopener">Copy the Google Sheet template</a>' : '') + '</p></div>' +
    '<div id="iMap"></div>';
  $('#iFile').onchange = async function (e) {
    var f = e.target.files[0]; if (!f) return;
    try { toast('Reading ' + f.name + '…'); await loadSheetJS(); var buf = await f.arrayBuffer(); parseWorkbook(XLSX.read(buf, { type: 'array', cellDates: true })); }
    catch (err) { toast(err.message, 4000); }
  };
  $('#iLoad').onclick = async function () {
    var u = $('#iUrl').value.trim(); if (!u) return;
    try { toast('Loading sheet…'); await loadSheetJS(); var csv = await api('/api/sheet?url=' + encodeURIComponent(u)); parseWorkbook(XLSX.read(csv, { type: 'string', cellDates: true })); }
    catch (err) { toast(err.message, 5000); }
  };
}
function parseWorkbook(wb) {
  var ws = wb.Sheets[wb.SheetNames[0]];
  var aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' }).filter(function (r) { return r.some(function (c) { return String(c).trim() !== ''; }); });
  if (aoa.length < 2) return toast('No rows found under the header row');
  IMP.head = aoa[0].map(function (h, i) { return String(h).trim() || ('Column ' + (i + 1)); }); IMP.rows = aoa.slice(1); IMP.map = {};
  FIELDS.forEach(function (f) { var i = IMP.head.findIndex(function (h, k) { return f[2].test(h) && Object.values(IMP.map).indexOf(k) < 0; }); if (i >= 0) IMP.map[f[0]] = i; });
  renderMapping();
}
function lastDate() { var d = today(); S.posts.forEach(function (p) { if (p.post_date > d) d = p.post_date; }); return d; }
function renderMapping() {
  var opts = function (sel) { return '<option value="">(none)</option>' + IMP.head.map(function (h, i) { return '<option value="' + i + '"' + (sel === i ? ' selected' : '') + '>' + esc(h) + '</option>'; }).join(''); };
  $('#iMap').innerHTML = '<div class="card"><h3>1. Match your columns</h3><p class="small muted">' + IMP.rows.length + ' rows found.</p>' +
    '<table class="tbl">' + FIELDS.map(function (f) { return '<tr><th style="width:38%">' + f[1] + '</th><td><select data-f="' + f[0] + '">' + opts(IMP.map[f[0]]) + '</select></td></tr>'; }).join('') + '</table>' +
    '<label>Rows with no date start on</label><input type="date" id="iStart" value="' + addDays(lastDate(), 1) + '">' +
    '<label>Default time (WAT)</label><input type="time" id="iTime" value="06:00"></div><div id="iPrev"></div>';
  $('#iMap').querySelectorAll('select').forEach(function (s) { s.onchange = function () { if (s.value === '') delete IMP.map[s.dataset.f]; else IMP.map[s.dataset.f] = +s.value; renderPreview(); }; });
  $('#iStart').onchange = renderPreview; $('#iTime').onchange = renderPreview;
  renderPreview();
}
function cellDate(v) {
  if (v instanceof Date) return v.getFullYear() + '-' + String(v.getMonth() + 1).padStart(2, '0') + '-' + String(v.getDate()).padStart(2, '0');
  var s = String(v || '').trim(); if (!s) return null;
  var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0');
  m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);                 // Nigeria writes day/month/year
  if (m) { var y = m[3].length === 2 ? '20' + m[3] : m[3]; return y + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0'); }
  if (typeof v === 'number' && v > 30000 && v < 80000) { var d = new Date(Date.UTC(1899, 11, 30) + v * 864e5); return d.toISOString().slice(0, 10); }
  var t = Date.parse(s); return isNaN(t) ? null : new Date(t + 3600e3).toISOString().slice(0, 10);
}
function cellTime(v, def) {
  if (v instanceof Date) return String(v.getHours()).padStart(2, '0') + ':' + String(v.getMinutes()).padStart(2, '0');
  if (typeof v === 'number' && v < 1) { var mins = Math.round(v * 1440); return String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0'); }
  var m = String(v || '').trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!m) return def; var h = +m[1]; if (m[3] && /pm/i.test(m[3]) && h < 12) h += 12; if (m[3] && /am/i.test(m[3]) && h === 12) h = 0;
  return String(h).padStart(2, '0') + ':' + (m[2] || '00');
}
var PLAT_ALIAS = { facebook: 'facebook', fb: 'facebook', 'fb profile': 'facebook', profile: 'facebook', groups: 'fb_groups', 'fb groups': 'fb_groups', group: 'fb_groups', 'fb page': 'fb_page', page: 'fb_page',
  whatsapp: 'whatsapp', status: 'whatsapp', 'wa status': 'whatsapp', channel: 'wa_channel', 'wa channel': 'wa_channel', 'whatsapp channel': 'wa_channel', x: 'x', twitter: 'x', youtube: 'youtube', yt: 'youtube', shorts: 'youtube', site: 'site', website: 'site', web: 'site', blog: 'site' };
function buildRows() {
  var start = $('#iStart').value || addDays(lastDate(), 1), defT = $('#iTime').value || '06:00', next = start, out = [];
  var g = function (r, f) { return IMP.map[f] === undefined ? '' : r[IMP.map[f]]; };
  IMP.rows.forEach(function (r) {
    var title = String(g(r, 'title') || '').trim(), cap = String(g(r, 'caption') || '').trim();
    if (!title && !cap) return;
    var d = cellDate(g(r, 'post_date')); if (!d) { d = next; next = addDays(next, 1); }
    var pl = String(g(r, 'platforms') || '').toLowerCase().split(/[,;\/|]+/).map(function (s) { return PLAT_ALIAS[s.trim()]; }).filter(Boolean);
    if (pl.indexOf('facebook') >= 0 && pl.indexOf('fb_groups') < 0) pl.push('fb_groups');
    if (pl.indexOf('whatsapp') >= 0 && pl.indexOf('wa_channel') < 0) pl.push('wa_channel');
    var tags = String(g(r, 'hashtags') || '').trim(); if (tags && tags.indexOf('#') < 0) tags = tags.split(/[\s,]+/).filter(Boolean).map(function (t) { return '#' + t; }).join(' ');
    out.push({ post_date: d, post_time: cellTime(g(r, 'post_time'), defT), title: title || cap.slice(0, 40), caption: cap, verse: String(g(r, 'verse') || '').trim() || null,
      reference: String(g(r, 'reference') || '').trim() || null, hashtags: tags, media_url: normMedia(String(g(r, 'media_url') || '').trim()), video_url: String(g(r, 'video_url') || '').trim() || null,
      platforms: pl.length ? pl : PLAT.map(function (x) { return x.k; }), source: 'import', slug: d, link_url: CFG.site + '/daily-verse/' + d });
  });
  return out;
}
function renderPreview() {
  var rows = buildRows(), el = $('#iPrev');
  el.innerHTML = '<div class="card"><h3>2. Preview</h3><p class="small muted">' + rows.length + ' posts will be added' + (rows.length > 6 ? ', first 6 shown' : '') + '.</p><div class="prev">' +
    rows.slice(0, 6).map(function (p) { return '<div class="pc">' + (p.media_url ? '<img loading="lazy" src="' + esc(mediaSrc(p.media_url)) + '" alt="">' : '') + '<b>' + esc(niceDate(p.post_date)) + ' · ' + esc(p.post_time) + '</b><br>' + esc(p.title) + '<div class="muted">' + esc(p.caption.slice(0, 80)) + '</div><div class="muted">' + p.platforms.length + ' platforms</div></div>'; }).join('') +
    '</div><button class="btn big" id="iGo" style="margin-top:12px"' + (rows.length ? '' : ' disabled') + '>3. Import ' + rows.length + ' posts</button></div>';
  var b = $('#iGo'); if (b) b.onclick = async function () {
    b.disabled = true; b.textContent = 'Importing…';
    var r = await sb.from('sp_posts').insert(rows);
    if (r.error) { b.disabled = false; b.textContent = 'Try again'; return toast('Import failed: ' + r.error.message, 5000); }
    await loadPosts(); toast('✓ Imported ' + rows.length + ' posts'); location.hash = '#queue';
  };
}

/* ---------- connect ---------- */
async function renderConnect() {
  setTab('connect');
  view.innerHTML = '<h2>Connect</h2><div class="loading">Checking…</div>';
  try { S.conn = await api('/api/connect'); } catch (e) { S.conn = S.conn || {}; }
  var c = S.conn, q = (location.hash.split('?')[1] || '');
  var ytOn = c.youtube && c.youtube.connected, ytCfg = c.youtube && c.youtube.configured, xOn = c.x && c.x.connected, fbOn = c.fb_page && c.fb_page.connected;
  view.innerHTML = '<h2>Connect</h2><p class="small muted"><b>Auto</b> = posts by itself on time. <b>1-tap</b> = Sow gets it ready, you tap Share once. Facebook does not allow any app to post to a personal profile, groups or WhatsApp Status, so those stay 1-tap. That keeps your 248K account safe.</p>' +
    (/youtube=connected/.test(q) ? '<div class="card">✅ YouTube connected.</div>' : '') + (/youtube_error=/.test(q) ? '<div class="card err">YouTube: ' + esc(decodeURIComponent(q.split('youtube_error=')[1] || '')) + '</div>' : '') +
    card('🌐', 'Your website', '<span class="pill auto">auto · on</span>', 'Every morning your site\'s Daily Verse page shows the day\'s post by itself, with a preview picture when the link is shared.', '<a class="btn sm ghost" target="_blank" rel="noopener" href="' + CFG.site + '/daily-verse">Open Daily Verse page</a>') +
    card('📘', 'Facebook profile, groups', '<span class="pill tap">1-tap</span>', 'Share → Facebook. No robot logins, so no ban risk.', '') +
    card('🟢', 'WhatsApp Status, Channel', '<span class="pill tap">1-tap</span>', 'Share → WhatsApp → My status or your Channel.', '') +
    card('🏳️', 'Facebook Page', fbOn ? '<span class="pill auto">auto · on</span>' : '<span class="pill off">coming soon</span>',
      fbOn ? 'Connected. Posts the picture + caption at the post time.' : 'Your Page can post by itself (picture + caption). It needs one Meta permission screen (pages_manage_posts). Tab will switch it on with you.',
      '<button class="btn sm" ' + (fbOn ? '' : 'disabled') + ' id="fbConn">' + (fbOn ? 'Connected ✓' : 'Connect Facebook Page') + '</button>') +
    card('▶️', 'YouTube Shorts', ytOn ? '<span class="pill auto">auto · on</span>' : ytCfg ? '<span class="pill tap">ready to connect</span>' : '<span class="pill off">needs setup</span>',
      ytOn ? 'Connected. Each day\'s short video uploads by itself. Until Google reviews the app, uploads stay private and you tap Public in YouTube Studio.' :
      'Every verse already has a 12-second Short. Today: tap Share video → YouTube. For auto upload, add your Google app keys (Tab will help), then tap Connect.',
      '<button class="btn sm" id="ytConn" ' + (ytCfg && !ytOn ? '' : 'disabled') + '>' + (ytOn ? 'Connected ✓' : 'Connect YouTube') + '</button>') +
    card('𝕏', 'X (Twitter)', xOn ? '<span class="pill auto">auto · on</span>' : '<span class="pill tap">1-tap</span>',
      xOn ? 'Connected. Posts the caption + your site link (the link shows the picture).' : 'Post to X opens X with the caption and your site link ready. Auto posting needs a free X developer account (Tab will help).', '') +
    card('✨', 'AI captions', c.ai && c.ai.connected ? '<span class="pill auto">on</span>' : '<span class="pill off">off</span>', 'Rewrites each post for Facebook, X, YouTube, WhatsApp and your site, on your free Google AI key.', '') +
    card('💬', 'Your WhatsApp bot', '<span class="pill tap">next</span>', 'Soon: text your Michael AI bot “today\'s post” and it sends the picture and caption back.', '') +
    '<div class="card small"><button class="btn sm ghost" id="signOut">Sign out of Sow on this phone</button></div>';
  var yb = $('#ytConn'); if (yb && ytCfg && !ytOn) yb.onclick = async function () { try { var r = await api('/api/connect', { body: { action: 'youtube_link' } }); location.href = r.url; } catch (e) { toast(e.message, 4000); } };
  $('#signOut').onclick = async function () { if (!confirm('Sign out? You will need the passcode again.')) return; await sb.auth.signOut(); location.reload(); };
}
function card(ic, t, pill, txt, act) { return '<div class="card"><div class="row"><span style="font-size:22px">' + ic + '</span><b class="grow">' + esc(t) + '</b>' + pill + '</div><p class="small muted" style="margin:8px 0">' + txt + '</p>' + act + '</div>'; }

/* ---------- sign in (owner passcode) ---------- */
function renderSignin(msg) {
  $('#tabs').hidden = true; $('#streak').hidden = true; document.body.classList.add('signin-mode');
  view.innerHTML = '<div class="signin"><div class="logo">Sow</div><p class="muted">Michael\'s daily posting app</p><input id="pc" inputmode="numeric" autocomplete="one-time-code" maxlength="12" placeholder="••••••"><br><button class="btn" id="pcGo">Open Sow</button><p class="small err" id="pcErr">' + esc(msg || '') + '</p><p class="small muted">Enter your passcode once. This phone stays signed in.</p></div>';
  var go = async function () {
    var code = $('#pc').value.trim(); if (!code) return; $('#pcGo').disabled = true; $('#pcErr').textContent = '';
    try {
      var s = (await sb.auth.getSession()).data.session;
      if (!s) { var a = await sb.auth.signInAnonymously(); if (a.error) throw a.error; }
      var r = await sb.rpc('sp_claim_owner', { p_passcode: code }); if (r.error) throw r.error;
      if (!r.data) throw new Error('That passcode is not right');
      boot();
    } catch (e) { $('#pcErr').textContent = e.message || String(e); $('#pcGo').disabled = false; }
  };
  $('#pcGo').onclick = go; $('#pc').onkeydown = function (e) { if (e.key === 'Enter') go(); };
}

/* ---------- router ---------- */
function render() {
  var h = (location.hash || '#today').slice(1).split('?')[0];
  closeModalIfNav();
  if (h === 'queue') renderQueue(); else if (h === 'import') renderImport(); else if (h === 'connect') renderConnect(); else renderToday();
}
function closeModalIfNav() {}
window.addEventListener('hashchange', function () { closeModal(); render(); window.scrollTo(0, 0); });

async function boot() {
  try {
    var s = (await sb.auth.getSession()).data.session;
    if (!s) return renderSignin();
    var own = await sb.rpc('sp_is_owner'); if (own.error || !own.data) return renderSignin(own.error ? '' : '');
    $('#tabs').hidden = false; document.body.classList.remove('signin-mode');
    await loadPosts(); showStreak(); render();
    api('/api/connect').then(function (c) { S.conn = c; if ((location.hash || '#today').indexOf('#today') === 0 || !location.hash) render(); }).catch(function () {});
  } catch (e) { view.innerHTML = '<div class="card err">Could not load: ' + esc(e.message || e) + '<br><button class="btn sm" onclick="location.reload()">Try again</button></div>'; }
}
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(function () {});
boot();
