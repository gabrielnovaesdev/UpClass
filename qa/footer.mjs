// node qa/footer.mjs — footer on desktop and on a 320px phone: layout, the morphing mark (keeps changing, pauses off
// screen, static with reduced motion), keyboard focus on links and contacts, "Voltar ao topo"; prints JSON
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
fs.mkdirSync('qa-out', { recursive: true });
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new',
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
const logs = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function open({ mobile = false, w = 390, reduce = false } = {}) {
  const page = await browser.newPage();
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(m.text()); });
  page.on('pageerror', (e) => logs.push(e.message));
  if (mobile) await page.emulate({ viewport: { width: w, height: 720, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
  else await page.setViewport({ width: 1440, height: 900 });
  if (reduce) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.evaluateOnNewDocument(() => sessionStorage.setItem('upc-intro', '1'));
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2', timeout: 90000 });
  await wait(2500);
  return page;
}
async function toBottom(page) {
  await page.evaluate(async () => {
    for (let k = 0; k < 60; k++) { window.scrollTo(0, document.documentElement.scrollHeight); await new Promise((r) => requestAnimationFrame(r)); }
  });
  await wait(2200);
}
const morphShapes = (page, n, gap) => page.evaluate(async (n, gap) => {
  const p = document.querySelector('.footer__morph-path');
  const out = [];
  for (let i = 0; i < n; i++) { out.push(p.getAttribute('d').length + ':' + p.getAttribute('d').slice(0, 24)); await new Promise((r) => setTimeout(r, gap)); }
  return new Set(out).size;
}, n, gap);

const result = {};
// desktop
const d = await open();
await toBottom(d);
await d.screenshot({ path: 'qa-out/footer_d.png' });
result.desktop = await d.evaluate(() => {
  const f = document.querySelector('.footer').getBoundingClientRect();
  const m = document.querySelector('.footer__morph').getBoundingClientRect();
  return { footerTop: Math.round(f.top), footerH: Math.round(f.height), morph: [Math.round(m.left), Math.round(m.top), Math.round(m.width)], overflowX: document.documentElement.scrollWidth - innerWidth };
});
result.desktop.morphDistinct = await morphShapes(d, 24, 250); // 6 s ≈ two full changes
// keyboard: tab from the footer title into its links and contacts
await d.evaluate(() => document.querySelector('.footer__title').setAttribute('tabindex', '-1'));
await d.focus('.footer__title');
const focus = [];
for (let i = 0; i < 6; i++) {
  await d.keyboard.press('Tab');
  focus.push(await d.evaluate(() => { const a = document.activeElement; const s = getComputedStyle(a); return `${a.className.split(' ')[0]}|${s.outlineStyle}`; }));
}
result.desktop.focus = focus;
await d.screenshot({ path: 'qa-out/footer_d_focus.png' });
await d.focus('.footer__up');
await d.keyboard.press('Enter');
await wait(3200);
result.desktop.backToTop = await d.evaluate(() => Math.round(scrollY));

// phone 320
const m = await open({ mobile: true, w: 320 });
await toBottom(m);
await m.screenshot({ path: 'qa-out/footer_m320.png' });
result.m320 = await m.evaluate(() => ({ overflowX: document.documentElement.scrollWidth - innerWidth, footerH: Math.round(document.querySelector('.footer').getBoundingClientRect().height) }));
result.m320.morphDistinct = await morphShapes(m, 16, 250);

// reduced motion: the mark rests on the bolt
const r = await open({ reduce: true });
await toBottom(r);
result.reduce = { morphDistinct: await morphShapes(r, 8, 300) };
await r.screenshot({ path: 'qa-out/footer_reduce.png' });

console.log(JSON.stringify({ ...result, logs: [...new Set(logs)] }, null, 1));
await browser.close();
