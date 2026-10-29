// QA harness for the local site: real Chrome + GPU, wheel-free deterministic scrolling through one section.
// node qa/shoot.mjs <desktop|mobile|desktop-reduce> <sectionSelector> <outDir> [steps] [pinFactor]
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const [mode = 'desktop', sel = '.evo', out = './qa', stepsArg = '10', factorArg = '3.4'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--mute-audio'],
});
const page = await browser.newPage();
const logs = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
if (mode.startsWith('mobile')) {
  await page.emulate({ viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
} else {
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
}
if (mode.endsWith('reduce')) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
await page.evaluateOnNewDocument(() => sessionStorage.setItem('upc-intro', '1'));
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2', timeout: 90000 });
await new Promise((r) => setTimeout(r, 3500));

const top = await page.evaluate((s) => document.querySelector(s).getBoundingClientRect().top + scrollY, sel);
const steps = +stepsArg;
const span = await page.evaluate((f) => innerHeight * f, +factorArg);
const t0 = Date.now();
for (let i = 0; i <= steps; i++) {
  const y = top - (i === 0 ? 0 : 0) + (span * i) / steps;
  // step the scroll in small increments so scrub/velocity behave like a real wheel
  await page.evaluate(async (target) => {
    const from = scrollY;
    for (let k = 1; k <= 8; k++) { window.scrollTo(0, from + ((target - from) * k) / 8); await new Promise((r) => requestAnimationFrame(r)); }
  }, y);
  await new Promise((r) => setTimeout(r, 900));
  await page.screenshot({ path: `${out}/${String(i).padStart(2, '0')}.png` });
}
// frame pacing while scrubbing through the section
const fps = await page.evaluate(async (args) => {
  const [a, b] = args;
  const times = [];
  let last = performance.now();
  for (let i = 0; i < 120; i++) {
    window.scrollTo(0, a + ((b - a) * i) / 120);
    await new Promise((r) => requestAnimationFrame(r));
    const now = performance.now(); times.push(now - last); last = now;
  }
  times.sort((x, y) => x - y);
  return { median: +(1000 / times[60]).toFixed(1), p95ms: +times[114].toFixed(1) };
}, [top, top + span]);
console.log(JSON.stringify({ fps, logs: [...new Set(logs)].slice(0, 15), secs: (Date.now() - t0) / 1000 }));
await browser.close();
