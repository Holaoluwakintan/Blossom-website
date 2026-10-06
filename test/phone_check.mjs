
import fs from 'node:fs';
import Browserbase from '@browserbasehq/sdk';
import { chromium } from 'playwright-core';
const APP = 'https://sow-ng.vercel.app', SHOTS = '/home/user/tab/files/social-post/screenshots', PASS = process.env.SOW_PASSCODE;
const cap = JSON.parse(fs.readFileSync('/home/user/tab/.vendor-capability.json', 'utf8'));
const bb = new Browserbase({ apiKey: cap.token, baseURL: cap.base_url + '/browserbase' });
const s = await bb.sessions.create({ projectId: 'f2ae15a0-a894-4419-977f-d52f52483f0c', userMetadata: { task: process.env.TAB_TASK_ID || 'sow-nosite' }, timeout: 300 });
const b = await chromium.connectOverCDP(s.connectUrl);
const UA = 'Mozilla/5.0 (Linux; Android 15; 25028RN03Y Build/AP3A) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const ctx = await b.newContext({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA });
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
const R = {};
try {
  await p.goto(APP, { waitUntil: 'networkidle' }); await p.waitForSelector('#pc', { timeout: 20000 });
  await p.fill('#pc', PASS); await p.click('#pcGo'); await p.waitForSelector('#shareAll', { timeout: 25000 });
  R.uid = await p.evaluate(() => JSON.parse(localStorage.getItem('sow-auth') || '{}').user?.id);
  await p.waitForTimeout(2500);
  await p.screenshot({ path: SHOTS + '/nosite-today.png' });
  await p.screenshot({ path: SHOTS + '/nosite-today-full.png', fullPage: true });
  const t = await p.textContent('#view');
  R.today_title = await p.textContent('.hero h2');
  R.today_cards = await p.$$eval('.plat', (e) => e.map((x) => x.dataset.k));
  R.today_has_site = /website|daily-verse|olaoluwamichael/i.test(t) || (await p.content()).includes('daily-verse');
  R.x_href = decodeURIComponent((await p.$eval('[data-x]', (a) => a.href)).split('text=')[1]);
  await p.goto(APP + '/#connect'); await p.waitForSelector('#signOut', { timeout: 20000 }); await p.waitForTimeout(1500);
  await p.screenshot({ path: SHOTS + '/nosite-connect.png' });
  await p.screenshot({ path: SHOTS + '/nosite-connect-full.png', fullPage: true });
  const c = await p.textContent('#view');
  R.connect_cards = await p.$$eval('#view h3, #view .card b', (e) => e.map((x) => x.textContent).slice(0, 12));
  R.connect_has_site = /website|daily verse|daily-verse|your site/i.test(c);
  await p.goto(APP + '/#import'); await p.waitForTimeout(1500);
  R.import_has_site = /website|daily-verse/i.test(await p.textContent('#view'));
  await p.evaluate(() => (window.sb || null) && null);
} catch (e) { R.error = e.message; await p.screenshot({ path: SHOTS + '/nosite-error.png' }).catch(() => {}); }
R.page_errors = errs;
console.log(JSON.stringify(R, null, 1));
await b.close(); await bb.sessions.update(s.id, { status: 'REQUEST_RELEASE', projectId: 'f2ae15a0-a894-4419-977f-d52f52483f0c' }).catch(() => {});
