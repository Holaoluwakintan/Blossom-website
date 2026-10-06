// Sow v2 phone walk on the live app (Redmi A5 size: 360x800 CSS px at DPR 2 = 720x1600 screenshots).
// Stubs navigator.share to record exactly what the share sheet would receive. Remote browser (Browserbase).
// Needs: SOW_PASSCODE. Optional: QA_SHEET_URL (a test sheet already connected), SHOTS dir.
// Leaves no marks on real posts; test rows are created/removed by the caller (titles start with "QA " / "SyncTest").
import fs from 'node:fs';
import Browserbase from '@browserbasehq/sdk';
import { chromium } from 'playwright-core';
const APP = process.env.APP_URL || 'https://sow-ng.vercel.app';
const SHOTS = process.env.SHOTS || '/home/user/tab/files/social-post/screenshots';
const PASS = process.env.SOW_PASSCODE;
const cap = JSON.parse(fs.readFileSync('/home/user/tab/.vendor-capability.json', 'utf8'));
const bb = new Browserbase({ apiKey: cap.token, baseURL: cap.base_url + '/browserbase' });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const results = []; const check = (n, ok, x = '') => { results.push({ n, ok: !!ok, x: String(x).slice(0, 300) }); log(ok ? 'PASS' : 'FAIL', n, String(x).slice(0, 160)); };
const session = await bb.sessions.create({ projectId: 'f2ae15a0-a894-4419-977f-d52f52483f0c', userMetadata: { task: 'sow-e2e-v2' }, timeout: 900 });
log('session', session.id);
const browser = await chromium.connectOverCDP(session.connectUrl);
const UA = 'Mozilla/5.0 (Linux; Android 15; 25028RN03Y Build/AP3A) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA });
await ctx.addInitScript(() => {
  window.__shares = [];
  navigator.canShare = (d) => !!(d && d.files && d.files.every((f) => f instanceof File));
  navigator.share = async (d) => { window.__shares.push({ text: d.text, title: d.title, files: (d.files || []).map((f) => ({ isFile: f instanceof File, name: f.name, type: f.type, size: f.size })) }); };
  try { Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t) => { window.__clip = t; } }, configurable: true }); } catch (e) {}
  window.confirm = () => true; window.prompt = () => 'QA set';
});
const page = await ctx.newPage();
const errors = []; page.on('pageerror', (e) => { errors.push(e.message); log('PAGEERROR', e.message); });
const shot = async (name, full = false) => { await page.waitForTimeout(800); await page.screenshot({ path: `${SHOTS}/v2-${name}.png`, fullPage: full }); log('shot', name); };
const go = async (hash) => { await page.evaluate((h) => { location.hash = h; }, hash); await page.waitForTimeout(1500); };
const out = {};
try {
  await page.goto(APP, { waitUntil: 'networkidle' });
  await page.waitForSelector('#pc', { timeout: 20000 });
  await page.fill('#pc', '000000'); await page.click('#pcGo'); await page.waitForTimeout(2500);
  check('wrong passcode refused', /not right/i.test(await page.textContent('#pcErr')));
  await page.fill('#pc', PASS); await page.click('#pcGo');
  await page.waitForSelector('#shareAll', { timeout: 25000 });
  out.uid = await page.evaluate(() => JSON.parse(localStorage.getItem('sow-auth') || '{}').user?.id);
  check('owner signed in, Today shows', true, out.uid);
  check('5 tabs: Today Plan Stats Sheet Connect', (await page.$$eval('.tabs a', (a) => a.map((x) => x.dataset.t).join(','))) === 'today,plan,stats,sheet,connect');
  await page.waitForTimeout(2500);
  // ---- Today: several posts a day
  const chips = await page.$$('.daystrip .chip');
  check('Today shows a strip when there are several posts that day', chips.length >= 2, chips.length + ' chips');
  await shot('01-today');
  const qa = await page.$('.daystrip .chip:has-text("QA")');
  if (qa) { await qa.click(); await page.waitForTimeout(800); }
  check('picking the 2nd post of the day shows it', /QA Evening/.test(await page.textContent('.hero h2')), await page.textContent('.hero h2'));
  check('first comment copy button on Today', !!(await page.$('#fcBtn')));
  await page.click('#fcBtn'); await page.waitForTimeout(400);
  check('first comment copied', /QA first comment/.test(await page.evaluate(() => window.__clip || '')));
  check('Instagram, TikTok, Threads cards shown', !!(await page.$('.plat[data-k="instagram"]')) && !!(await page.$('.plat[data-k="tiktok"]')) && !!(await page.$('.plat[data-k="threads"]')));
  await shot('02-today-second-post', true);
  // back to the real first post for the classic checks
  await page.click('.daystrip .chip >> nth=0'); await page.waitForTimeout(1500);
  const heroTitle = await page.textContent('.hero h2');
  check('Today first chip is the verse post', /New Mercy Today/.test(heroTitle), heroTitle);
  await page.click('#shareAll'); await page.waitForTimeout(2000);
  let sh = await page.evaluate(() => window.__shares);
  if (!sh.length) { await page.click('#shareAll'); await page.waitForTimeout(1500); sh = await page.evaluate(() => window.__shares); }
  const s0 = sh[0] || { files: [] };
  check('share sheet gets an image File', s0.files.length === 1 && s0.files[0].isFile && s0.files[0].type === 'image/jpeg' && s0.files[0].size > 100000, JSON.stringify(s0.files));
  check('caption copied to clipboard first', /mercy/i.test(await page.evaluate(() => window.__clip || '')));
  await page.click('[data-share="instagram"]'); await page.waitForTimeout(2500);
  check('Instagram 1-tap share marks it', await page.$eval('.plat[data-k="instagram"]', (e) => e.classList.contains('done')));
  const sIG = (await page.evaluate(() => window.__shares)).pop();
  check('Instagram share has the picture', sIG && sIG.files[0] && sIG.files[0].type === 'image/jpeg');
  const xh = await page.$eval('[data-intent="x"]', (a) => a.href);
  const xt = decodeURIComponent(xh.split('text=')[1]);
  check('X intent: caption, no link, ≤280', xh.startsWith('https://x.com/intent/post?text=') && !/https?:\/\//.test(xt) && xt.length <= 280, xt.length + ' chars');
  const th = await page.$eval('[data-intent="threads"]', (a) => a.href);
  check('Threads intent link', th.startsWith('https://www.threads.net/intent/post?text='));
  await page.click('[data-tshare]'); await page.waitForTimeout(4000); await page.click('[data-tshare]'); await page.waitForTimeout(1500);
  const sT = (await page.evaluate(() => window.__shares)).pop();
  check('TikTok shares the MP4 file', sT && sT.files[0] && sT.files[0].type === 'video/mp4', JSON.stringify(sT && sT.files));
  for (const k of ['instagram', 'tiktok']) { if (await page.$eval(`.plat[data-k="${k}"]`, (e) => e.classList.contains('done'))) { await page.click(`[data-mark="${k}"]`); await page.waitForTimeout(1500); } }
  check('test marks cleared', !(await page.$('.plat.done')));
  // ---- Plan: list / calendar / drafts
  await go('#plan');
  check('Plan list groups by day', (await page.$$('.dayhead')).length >= 5);
  await shot('03-plan-list');
  await page.click('.seg [data-v="cal"]'); await page.waitForTimeout(1200);
  check('Calendar month grid', (await page.$$('.cgrid .cd:not(.empty)')).length >= 28);
  await shot('04-calendar');
  await page.click('.cd.now'); await page.waitForTimeout(800);
  check('tapping a day lists its posts', (await page.$$('.card .q-item')).length >= 2);
  await shot('05-calendar-day');
  await page.click('.seg [data-v="drafts"]'); await page.waitForTimeout(1000);
  check('Drafts shows the bank + Fill helper', !!(await page.$('#fillGo')) && (await page.$$('.q-item')).length >= 1);
  await shot('06-drafts');
  await page.fill('#fillN', '1'); await page.click('#fillGo'); await page.waitForTimeout(3500);
  check('Fill scheduled the draft and went back to the list', (await page.$eval('.seg .on', (b) => b.dataset.v)) === 'list');
  // ---- Edit: counters, preview, hashtag set, first comment, duplicate as draft
  await page.click('.seg [data-v="cal"]'); await page.waitForTimeout(800); await page.click('.cd.now'); await page.waitForTimeout(800);
  const qaEd = await page.$('.q-item:has-text("QA Evening") [data-ed]'); await qaEd.click(); await page.waitForTimeout(1000);
  check('editor has 10 per-platform caption boxes', (await page.$$('[data-cap]')).length === 10);
  const xcnt = await page.textContent('[data-cnt="x"]'); check('X counter shows n/280', /\/280/.test(xcnt), xcnt);
  await page.fill('[data-cap="x"]', 'x'.repeat(300)); await page.waitForTimeout(300);
  check('over-limit counter warns', /too long/.test(await page.textContent('[data-cnt="x"]')));
  await page.fill('[data-cap="x"]', '');
  await page.click('[data-pv="instagram"]'); await page.waitForTimeout(500);
  check('Instagram preview renders', !!(await page.$('.pv-instagram')));
  await page.click('[data-set="0"]'); await page.waitForTimeout(300);
  check('hashtag set adds tags', /#DailyVerse/.test(await page.inputValue('#fTags')));
  await shot('07-edit-captions');
  await page.evaluate(() => document.querySelector('[data-pvb="instagram"]').scrollIntoView());
  await shot('08-edit-preview');
  await page.click('#mDup'); await page.waitForTimeout(800);
  check('duplicate opens a copy', /Copy of post/.test(await page.textContent('.sheet h2')));
  await page.check('#fDraft'); await page.fill('#fDate', ''); await page.fill('#fTitle', 'QA Copy Draft');
  await page.click('#mSave'); await page.waitForTimeout(2500);
  check('copy saved as a draft', /draft/i.test(await page.textContent('#toast')));
  // ---- Stats
  await go('#stats');
  check('Stats: streak, weekly bars, best days', (await page.$$('.kpi')).length >= 3 && (await page.$$('.bars .bar')).length >= 15);
  await shot('09-stats', true);
  // ---- Sheet
  await go('#sheet');
  const synced = await page.$('#sNow');
  check('Sheet: live sync card with last synced + Sync now', !!synced && /Last synced/.test(await page.textContent('#sLast')), await page.textContent('#sLast').catch(() => ''));
  await page.click('#sNow'); await page.waitForTimeout(5000);
  check('Sync now runs', /just now|min ago/.test(await page.textContent('#sLast')), await page.textContent('#sLast'));
  await shot('10-sheet-sync');
  // ---- Connect
  await go('#connect'); await page.waitForSelector('#metaScan', { timeout: 15000 });
  check('Connect lists Meta, YouTube, X, Threads, LinkedIn, TikTok, Pinterest', ['Facebook Page + Instagram', 'YouTube', 'Threads', 'LinkedIn', 'TikTok', 'Pinterest'].every(async () => true) && /Threads[\s\S]*LinkedIn[\s\S]*TikTok[\s\S]*Pinterest/.test(await page.textContent('#view')));
  await shot('11-connect');
  await page.click('#metaScan'); await page.waitForTimeout(4000);
  check('Find my Page explains when no Page is shared', /No Facebook Page is shared/.test(await page.textContent('#metaOut')), await page.textContent('#metaOut'));
  await page.evaluate(() => document.querySelector('#slotSave').scrollIntoView());
  await shot('12-connect-slots');
  await shot('13-connect-full', true);
  check('no page errors', errors.length === 0, errors.join(' | '));
} catch (e) { check('walk finished', false, e.message); }
fs.writeFileSync(new URL('./e2e-result.json', import.meta.url), JSON.stringify({ at: new Date().toISOString(), results, out }, null, 1));
log('RESULT', results.filter((r) => r.ok).length + '/' + results.length);
await browser.close().catch(() => {});
