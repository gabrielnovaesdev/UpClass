// node qa/interact.mjs — touch phone (320px): the details and the cards run pinned without sideways scrolling, the film
// player fits; desktop: the details' 3D stage renders only on screen, keyboard skip link and menu, section order after
// every pin refreshed; no-WebGL / weak device: the details fall back to the static list. Prints JSON with console errors.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
fs.mkdirSync('qa-out', { recursive: true });
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new',
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
const logs = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function open(mobile, w = 390, { weak = false } = {}) {
  const page = await browser.newPage();
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(m.text()); });
  page.on('pageerror', (e) => logs.push(e.message));
  if (mobile) await page.emulate({ viewport: { width: w, height: 760, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
  else await page.setViewport({ width: 1440, height: 900 });
  if (weak) await page.evaluateOnNewDocument(() => Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 2 }));
  await page.evaluateOnNewDocument(() => sessionStorage.setItem('upc-intro', '1'));
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2', timeout: 90000 });
  await wait(3000);
  return page;
}
const glide = (page, sel, frac) => page.evaluate(async (sel, frac) => {
  const el = document.querySelector(sel);
  const y = el.getBoundingClientRect().top + scrollY + el.offsetHeight * frac;
  const from = scrollY;
  for (let k = 1; k <= 16; k++) { window.scrollTo(0, from + ((y - from) * k) / 16); await new Promise((r) => requestAnimationFrame(r)); }
}, sel, frac);

// ---- phone, 320px: details and cards mid-pin
const p = await open(true, 320);
await glide(p, '.detail', 0.4);
await wait(1500);
await p.screenshot({ path: 'qa-out/int_detail_m320.png' });
const det = await p.evaluate(() => ({
  live: document.querySelector('.detail').classList.contains('is-live'),
  inMiddle: [...document.querySelectorAll('.detail__item')].map((li) => +getComputedStyle(li).getPropertyValue('--k') || 0).map((k) => +k.toFixed(2)),
  overflowX: document.documentElement.scrollWidth - innerWidth,
}));
await glide(p, '.collection', 0.45);
await wait(1500);
await p.screenshot({ path: 'qa-out/int_cards_m320.png' });
const cards = await p.evaluate(() => ({
  live: document.querySelector('.collection').classList.contains('is-live'),
  onScreen: [...document.querySelectorAll('.card')].filter((c) => { const r = c.getBoundingClientRect(); return r.right > 0 && r.left < innerWidth && getComputedStyle(c).visibility !== 'hidden'; }).length,
  overflowX: document.documentElement.scrollWidth - innerWidth,
}));
await p.evaluate(() => document.querySelector('.evo').scrollIntoView({ block: 'start' }));
await wait(2000);
const evoM = await p.evaluate(() => { const r = document.querySelector('.evo__player').getBoundingClientRect(); const v = document.querySelector('.film__video'); return { w: r.width, h: r.height, ratio: +(r.width / r.height).toFixed(3), src: v.currentSrc.split('/').pop(), paused: v.paused }; });

// ---- desktop: the 3D stage only draws while the section is on screen
const d = await open(false);
const drawCount = () => d.evaluate(async () => {
  const c = document.querySelector('.detail__gl');
  const gl = c.getContext('webgl2');
  let n = 0;
  const names = ['drawElements', 'drawArrays'];
  const orig = names.map((k) => gl[k]);
  names.forEach((k, i) => { gl[k] = (...a) => { n++; return orig[i].apply(gl, a); }; });
  await new Promise((r) => setTimeout(r, 600));
  names.forEach((k, i) => { gl[k] = orig[i]; });
  return n;
});
await glide(d, '.detail', 0.35);
await wait(2000);
const drawsOn = await drawCount();
await d.evaluate(() => window.scrollTo(0, 0));
await wait(1200);
const drawsOff = await drawCount();
// keyboard: skip link, then the menu opens and closes with Escape
await d.keyboard.press('Tab');
await wait(500);
const skip = await d.evaluate(() => ({ el: document.activeElement.className, outline: getComputedStyle(document.activeElement).outlineStyle, top: Math.round(document.activeElement.getBoundingClientRect().top) }));
await d.keyboard.press('Tab');
await d.keyboard.press('Enter');
await wait(900);
const menuOpen = await d.evaluate(() => document.querySelector('.nav__menu').getAttribute('aria-expanded'));
await d.keyboard.press('Escape');
await wait(900);
const menuClosed = await d.evaluate(() => document.querySelector('.nav__menu').getAttribute('aria-expanded'));
// section boundaries: every section in order, no overlaps after refresh
const order = await d.evaluate(() => [...document.querySelectorAll('main section, body > footer')].map((s) => { const r = s.getBoundingClientRect(); return [s.className.split(' ')[0], Math.round(r.top + scrollY), Math.round(r.height)]; }));

// ---- weak device (2 cores): static details, nothing pinned there
const w = await open(false, 1440, { weak: true });
await glide(w, '.detail', 0.2);
await wait(1200);
await w.screenshot({ path: 'qa-out/int_detail_weak.png' });
const weak = await w.evaluate(() => ({ live: document.querySelector('.detail').classList.contains('is-live'), items: document.querySelectorAll('.detail__item').length }));

console.log(JSON.stringify({ det, cards, evoM, drawsOn, drawsOff, skip, menuOpen, menuClosed, order, weak, logs: [...new Set(logs)] }));
await browser.close();
