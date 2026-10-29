// node qa/interact.mjs — symbol chapters by tap (320px phone) and keyboard (desktop), film player on the phone,
// section order after every pin refreshed; prints JSON with console errors
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
fs.mkdirSync('qa-out', { recursive: true });
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new',
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
const logs = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function open(mobile, w = 390) {
  const page = await browser.newPage();
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(m.text()); });
  page.on('pageerror', (e) => logs.push(e.message));
  if (mobile) await page.emulate({ viewport: { width: w, height: 760, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
  else await page.setViewport({ width: 1440, height: 900 });
  await page.evaluateOnNewDocument(() => sessionStorage.setItem('upc-intro', '1'));
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2', timeout: 90000 });
  await wait(3000);
  return page;
}
// phone (320px, the narrowest): scroll to the stage, tap chapter 4
let p = await open(true, 320);
await p.evaluate(() => document.querySelector('.sym__stage').scrollIntoView({ block: 'start' }));
await wait(2500);
await p.tap('.sym__chapter:nth-child(4) button');
await wait(1800);
await p.evaluate(() => document.querySelector('.sym__stage').scrollIntoView({ block: 'start' }));
await wait(600);
await p.screenshot({ path: 'qa-out/int_m320.png' });
const m = await p.evaluate(() => ({
  pressed: [...document.querySelectorAll('.sym__chapter button')].map((b) => b.getAttribute('aria-pressed')),
  overflowX: document.documentElement.scrollWidth - innerWidth,
}));
// evo on the phone
await p.evaluate(() => document.querySelector('.evo').scrollIntoView({ block: 'start' }));
await wait(2000);
await p.screenshot({ path: 'qa-out/int_evo_m320.png', fullPage: false });
const evoM = await p.evaluate(() => { const r = document.querySelector('.evo__player').getBoundingClientRect(); const v = document.querySelector('.film__video'); return { w: r.width, h: r.height, ratio: +(r.width / r.height).toFixed(3), src: v.currentSrc.split('/').pop(), paused: v.paused }; });
// desktop: keyboard to chapter 3
const d = await open(false);
await d.evaluate(() => document.querySelector('.sym').scrollIntoView({ block: 'start' }));
await wait(1500);
const y0 = await d.evaluate(() => scrollY);
await d.focus('.sym__chapter:nth-child(3) button');
await d.keyboard.press('Enter');
await wait(2600);
await d.screenshot({ path: 'qa-out/int_kb.png' });
const k = await d.evaluate((y0) => ({ moved: Math.round(scrollY - y0), pressed: [...document.querySelectorAll('.sym__chapter button')].map((b) => b.getAttribute('aria-pressed')), focusVisible: getComputedStyle(document.activeElement).outlineStyle }), y0);
// section boundaries: every section in order, no overlaps after refresh
const order = await d.evaluate(() => [...document.querySelectorAll('main > section, body > section')].map((s) => { const r = s.getBoundingClientRect(); return [s.className.split(' ')[0], Math.round(r.top + scrollY), Math.round(r.height)]; }));
console.log(JSON.stringify({ m, evoM, k, order, logs: [...new Set(logs)] }, null, 1));
await browser.close();
