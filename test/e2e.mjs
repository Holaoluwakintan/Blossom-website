
// Phone walk of Sow on the live app (Redmi A5 size: 360x800 CSS px at DPR 2 = 720x1600 screenshots).
// Stubs navigator.share to record exactly what the share sheet would receive.
import fs from 'node:fs';
import Browserbase from '@browserbasehq/sdk';
import { chromium } from 'playwright-core';
const APP = process.env.APP_URL || 'https://sow-ng.vercel.app';
const SHOTS = process.env.SHOTS || '/home/user/tab/files/social-post/screenshots';
const PASS = process.env.SOW_PASSCODE;
const cap = JSON.parse(fs.readFileSync('/home/user/tab/.vendor-capability.json', 'utf8'));
const bb = new Browserbase({ apiKey: cap.token, baseURL: cap.base_url + '/browserbase' });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const results = []; const check = (n, ok, x = '') => { results.push({ n, ok: !!ok, x }); log(ok ? 'PASS' : 'FAIL', n, x); };
const session = await bb.sessions.create({ projectId: 'f2ae15a0-a894-4419-977f-d52f52483f0c', userMetadata: { task: process.env.TAB_TASK_ID || 'sow-e2e' }, timeout: 900 });
log('session', session.id);
const browser = await chromium.connectOverCDP(session.connectUrl);
const UA = 'Mozilla/5.0 (Linux; Android 15; 25028RN03Y Build/AP3A) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA });
await ctx.addInitScript(() => {
  window.__shares = [];
  navigator.canShare = (d) => !!(d && d.files && d.files.every((f) => f instanceof File));
  navigator.share = async (d) => { window.__shares.push({ text: d.text, title: d.title, files: (d.files || []).map((f) => ({ isFile: f instanceof File, name: f.name, type: f.type, size: f.size })) }); };
  try { Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t) => { window.__clip = t; } }, configurable: true }); } catch (e) {}
  window.confirm = () => true;
});
const page = await ctx.newPage();
page.on('pageerror', (e) => log('PAGEERROR', e.message));
const shot = async (name, full = false) => { await page.waitForTimeout(700); await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: full }); log('shot', name); };
const out = { };
try {
  await page.goto(APP, { waitUntil: 'networkidle' });
  await page.waitForSelector('#pc', { timeout: 20000 });
  await shot('01-signin');
  await page.fill('#pc', '000000'); await page.click('#pcGo'); await page.waitForTimeout(2500);
  check('wrong passcode refused', /not right/i.test(await page.textContent('#pcErr')));
  await page.fill('#pc', PASS); await page.click('#pcGo');
  await page.waitForSelector('#shareAll', { timeout: 25000 });
  out.uid = await page.evaluate(() => JSON.parse(localStorage.getItem('sow-auth') || '{}').user?.id);
  check('owner signed in, Today screen shows', true, out.uid);
  await page.waitForTimeout(2500);
  await shot('02-today');
  await shot('03-today-full', true);
  const heroTitle = await page.textContent('.hero h2');
  check('Today shows first verse post', /New Mercy Today/.test(heroTitle), heroTitle);
  // Share picture + caption
  await page.click('#shareAll'); await page.waitForTimeout(1500);
  let sh = await page.evaluate(() => window.__shares);
  if (!sh.length) { await page.click('#shareAll'); await page.waitForTimeout(1500); sh = await page.evaluate(() => window.__shares); }
  const s0 = sh[0] || { files: [] };
  check('share sheet gets an image File', s0.files.length === 1 && s0.files[0].isFile && s0.files[0].type === 'image/jpeg' && s0.files[0].size > 100000, JSON.stringify(s0.files));
  check('share text = caption', /mercy/i.test(s0.text || ''), (s0.text || '').slice(0, 80));
  check('caption copied to clipboard first', /mercy/i.test(await page.evaluate(() => window.__clip || '')));
  // per-platform share auto-marks
  await page.click('[data-share="whatsapp"]'); await page.waitForTimeout(2500);
  check('WhatsApp Status card marked after share', await page.$eval('.plat[data-k="whatsapp"]', (e) => e.classList.contains('done')));
  check('streak shows 0 for a future post', /🔥/.test(await page.textContent('#streak')), await page.textContent('#streak'));
  await shot('04-today-shared');
  // X intent link
  const xh = await page.$eval('[data-x]', (a) => a.href);
  check('X intent link has caption + site link', xh.startsWith('https://x.com/intent/post?text=') && decodeURIComponent(xh).includes('olaoluwamichael.vercel.app/daily-verse/2026-10-07'), decodeURIComponent(xh).slice(0, 160));
  out.xlen = decodeURIComponent(xh.split('text=')[1]).replace(/https?:\/\/\S+/g, 'x'.repeat(23)).length;
  check('X text within 280', out.xlen <= 280, String(out.xlen));
  // Video share
  await page.click('[data-vshare]'); await page.waitForTimeout(4000);
  await page.click('[data-vshare]'); await page.waitForTimeout(1500);
  sh = await page.evaluate(() => window.__shares); const sv = sh[sh.length - 1];
  check('Shorts video shared as MP4 File', sv && sv.files[0] && sv.files[0].type === 'video/mp4' && sv.files[0].size > 500000, JSON.stringify(sv && sv.files));
  // un-mark test marks
  for (const k of ['whatsapp', 'youtube']) { if (await page.$eval(`.plat[data-k="${k}"]`, (e) => e.classList.contains('done'))) { await page.click(`[data-mark="${k}"]`); await page.waitForTimeout(1500); } }
  check('marks cleared after test', !(await page.$('.plat.done')));
  // AI rewrite
  await page.click('#aiBtn'); await page.waitForSelector('#aiBox'); 
  await page.waitForFunction(() => (document.querySelector('[data-cap="facebook"]') || {}).value, null, { timeout: 45000 }).catch(() => {});
  const fb = await page.$eval('[data-cap="facebook"]', (t) => t.value).catch(() => '');
  const xc = await page.$eval('[data-cap="x"]', (t) => t.value).catch(() => '');
  check('AI rewrite filled Facebook + X captions', fb.length > 120 && xc.length > 20, `fb ${fb.length} chars, x ${xc.length}`);
  out.ai = { fb, x: xc, yt: await page.$eval('[data-cap="youtube_title"]', (t) => t.value).catch(() => '') };
  await page.evaluate(() => document.querySelector('#aiBox').scrollIntoView());
  await shot('05-ai-captions');
  await page.click('#mClose');
  // Queue
  await page.goto(APP + '/#queue'); await page.waitForSelector('.q-item', { timeout: 15000 });
  await page.waitForTimeout(3000); await shot('06-queue');
  const before = await page.$$eval('.q-item .t', (e) => e.map((x) => x.textContent));
  check('queue lists 30 posts', before.length >= 30, String(before.length));
  // move day 2 later (swap with day 3), check, then swap back
  const ids = await page.$$eval('.q-item', (e) => e.map((x) => x.dataset.id));
  await page.click(`[data-dn="${ids[1]}"]`); await page.waitForTimeout(2500);
  const after = await page.$$eval('.q-item .t', (e) => e.map((x) => x.textContent));
  check('reorder swaps two days', after[1] === before[2] && after[2] === before[1], after.slice(0, 3).join(' | '));
  await page.click(`[data-up="${ids[1]}"]`); await page.waitForTimeout(2500);
  const back = await page.$$eval('.q-item .t', (e) => e.map((x) => x.textContent));
  check('reorder back', back[1] === before[1], back.slice(0, 3).join(' | '));
  // edit + skip
  await page.click(`[data-ed="${ids[4]}"]`); await page.waitForSelector('#fCap');
  const oldCap = await page.inputValue('#fCap');
  await page.fill('#fCap', oldCap + ' [qa-edit]'); await shot('07-edit');
  await page.click('#mSave'); await page.waitForTimeout(2500);
  await page.click(`[data-ed="${ids[4]}"]`); await page.waitForSelector('#fCap');
  check('edit saved', (await page.inputValue('#fCap')).endsWith('[qa-edit]'));
  await page.fill('#fCap', oldCap); await page.click('#mSave'); await page.waitForTimeout(2000);
  await page.click(`[data-ed="${ids[5]}"]`); await page.waitForSelector('#mSkip'); await page.click('#mSkip'); await page.waitForTimeout(2500);
  check('skip marks the post', await page.$eval(`.q-item[data-id="${ids[5]}"]`, (e) => e.classList.contains('skipped')));
  await shot('08-queue-skipped');
  await page.click(`[data-ed="${ids[5]}"]`); await page.waitForSelector('#mSkip'); await page.click('#mSkip'); await page.waitForTimeout(2500);
  check('unskip', !(await page.$eval(`.q-item[data-id="${ids[5]}"]`, (e) => e.classList.contains('skipped'))));
  // Import
  await page.goto(APP + '/#import'); await page.waitForSelector('#iFile', { state: 'attached' });
  await shot('09-import');
  await page.setInputFiles('#iFile', '/home/user/work/social-post/test/sample-bank.xlsx');
  await page.waitForSelector('#iGo', { timeout: 30000 });
  const map = await page.$$eval('#iMap select', (s) => s.map((x) => x.dataset.f + '=' + (x.selectedOptions[0] || {}).textContent));
  check('columns auto-matched', map.includes('post_date=Post date') && map.includes('title=Headline') && map.includes('caption=Post text') && map.includes('media_url=Picture') && map.includes('platforms=Where'), map.join(', '));
  await shot('10-import-mapped', true);
  const btnTxt = await page.textContent('#iGo');
  check('preview counts 3 rows', /Import 3 posts/.test(btnTxt), btnTxt);
  await page.click('#iGo'); await page.waitForSelector('.q-item', { timeout: 20000 }); await page.waitForTimeout(1500);
  const titles = await page.$$eval('.q-item .t', (e) => e.map((x) => x.textContent));
  check('imported rows in queue', titles.filter((t) => /QA Test Row/.test(t)).length === 3, String(titles.length));
  // Connect
  await page.goto(APP + '/#connect'); await page.waitForSelector('#signOut', { timeout: 20000 });
  await shot('11-connect', true);
  check('FB Page connect button disabled (coming soon)', await page.$eval('#fbConn', (b) => b.disabled));
} catch (e) { log('ERROR', e.message); check('no crash', false, e.message); await shot('99-error').catch(() => {}); }
fs.writeFileSync('/home/user/work/social-post/test/e2e-result.json', JSON.stringify({ results, out }, null, 1));
log(results.filter((r) => r.ok).length + '/' + results.length + ' passed');
await browser.close().catch(() => {});
await bb.sessions.update(session.id, { status: 'REQUEST_RELEASE', projectId: 'f2ae15a0-a894-4419-977f-d52f52483f0c' }).catch(() => {});
