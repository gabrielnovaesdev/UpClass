// node qa/wheel.mjs <fromSelector> <viewports> <outDir> — scrolls with the real mouse wheel (through Lenis, as a person
// would) from a section for N screen heights, capturing a frame every few notches and measuring frame pacing the whole
// way (median FPS, p95 and worst frame). Desktop 1440×900.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const [sel = '.hero', vpArg = '2.5', out = './qa-out/wheel'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new',
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
const page = await browser.newPage();
const logs = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(m.text()); });
page.on('pageerror', (e) => logs.push(e.message));
await page.setViewport({ width: 1440, height: 900 });
await page.evaluateOnNewDocument(() => sessionStorage.setItem('upc-intro', '1'));
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2', timeout: 90000 });
await new Promise((r) => setTimeout(r, 3000));
await page.evaluate((s) => window.scrollTo(0, document.querySelector(s).getBoundingClientRect().top + scrollY), sel);
await new Promise((r) => setTimeout(r, 1500));
await page.mouse.move(720, 450);
await page.evaluate(() => {
  window.__frames = [];
  let last = performance.now();
  const loop = (now) => { window.__frames.push(now - last); last = now; window.__raf = requestAnimationFrame(loop); };
  window.__raf = requestAnimationFrame(loop);
});
const notches = Math.round((900 * +vpArg) / 80);
for (let i = 0; i < notches; i++) {
  await page.mouse.wheel({ deltaY: 80 });
  await new Promise((r) => setTimeout(r, 70));
  if (i % 4 === 0) await page.screenshot({ path: `${out}/${String(i / 4).padStart(3, '0')}.jpg`, type: 'jpeg', quality: 70 });
}
await new Promise((r) => setTimeout(r, 1200));
await page.screenshot({ path: `${out}/zz-rest.jpg`, type: 'jpeg', quality: 70 });
const pacing = await page.evaluate(() => {
  cancelAnimationFrame(window.__raf);
  // screenshots stall the page: drop the frames that straddle them
  const t = window.__frames.slice(2).filter((x) => x < 250).sort((a, b) => a - b);
  return { frames: t.length, medianFps: +(1000 / t[Math.floor(t.length / 2)]).toFixed(1), p95ms: +t[Math.floor(t.length * 0.95)].toFixed(1), worstMs: +t[t.length - 1].toFixed(1) };
});
console.log(JSON.stringify({ pacing, scrollY: await page.evaluate(() => Math.round(scrollY)), logs: [...new Set(logs)] }));
await browser.close();
