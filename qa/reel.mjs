// node qa/reel.mjs — PLAY ▶ REEL: hover frames, opening the film dialog by click and by keyboard, Esc, focus return;
// desktop stage and phone layout. Prints JSON; frames go to qa-out/reel/.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const out = 'qa-out/reel';
fs.mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new',
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const logs = [];
async function open(mobile) {
  const page = await browser.newPage();
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(m.text()); });
  page.on('pageerror', (e) => logs.push(e.message));
  if (mobile) await page.emulate({ viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
  else await page.setViewport({ width: 1440, height: 900 });
  await page.evaluateOnNewDocument(() => sessionStorage.setItem('upc-intro', '1'));
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2', timeout: 90000 });
  await wait(3000);
  return page;
}
const state = (p) => p.evaluate(() => {
  const d = document.querySelector('.evo__dialog'); const f = document.querySelector('.evo__film');
  return { open: d.open, filmPlaying: !f.paused, filmT: +f.currentTime.toFixed(2), active: document.activeElement.className, previewPaused: document.querySelector('.film__video').paused };
});
// desktop: scroll to the landing, hover, click, Esc, keyboard
const d = await open(false);
await d.evaluate(async () => {
  const top = document.querySelector('.evo').getBoundingClientRect().top + scrollY;
  const y = top + innerHeight * 2 * 0.86;
  const from = scrollY;
  for (let k = 1; k <= 30; k++) { window.scrollTo(0, from + ((y - from) * k) / 30); await new Promise((r) => requestAnimationFrame(r)); }
});
await wait(1500);
await d.screenshot({ path: `${out}/d-landing.png` });
const btn = await d.evaluate(() => { const r = document.querySelector('.evo__reel-btn').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width }; });
await d.mouse.move(btn.x, btn.y + 300);
await wait(400);
await d.mouse.move(btn.x, btn.y, { steps: 3 });
// full frames: a clipped capture resizes the page, which re-measures the pinned stage
for (let i = 0; i < 8; i++) { await d.screenshot({ path: `${out}/d-hover${i}.png` }); await wait(110); }
await d.mouse.click(btn.x, btn.y);
await wait(2500);
await d.screenshot({ path: `${out}/d-dialog.png` });
const afterClick = await state(d);
await d.keyboard.press('Escape');
await wait(800);
const afterEsc = await state(d);
await d.keyboard.press('Enter'); // focus is back on PLAY ▶ REEL
await wait(1500);
const afterEnter = await state(d);
if (afterEnter.open) await d.click('.evo__close');
await wait(600);
const afterClose = await state(d);
// phone
const m = await open(true);
await m.evaluate(() => document.querySelector('.evo').scrollIntoView({ block: 'start' }));
await wait(2500);
await m.screenshot({ path: `${out}/m-evo.png` });
await m.tap('.evo__reel');
await wait(2500);
await m.screenshot({ path: `${out}/m-dialog.png` });
const mobile = await state(m);
console.log(JSON.stringify({ btn, afterClick, afterEsc, afterEnter, afterClose, mobile, logs: [...new Set(logs)] }, null, 1));
await browser.close();
