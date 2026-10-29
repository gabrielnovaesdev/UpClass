// node qa/sections.mjs <desktop|mobile> — one capture per section (scrolled into its pin) + console errors
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const mode = process.argv[2] || 'desktop';
const out = `qa-out/sections-${mode}`;
fs.mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new',
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
const page = await browser.newPage();
const logs = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(m.text()); });
page.on('pageerror', (e) => logs.push(e.message));
if (mode === 'mobile') await page.emulate({ viewport: { width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
else await page.setViewport({ width: 1440, height: 900 });
await page.evaluateOnNewDocument(() => sessionStorage.setItem('upc-intro', '1'));
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2', timeout: 90000 });
await new Promise((r) => setTimeout(r, 3000));
const names = await page.evaluate(() => [...document.querySelectorAll('main > section, main > .flow > section')].map((s) => s.className.split(' ')[0]));
for (const [i, n] of names.entries()) {
  await page.evaluate(async (n) => {
    const y = document.querySelector(`.${n}`).getBoundingClientRect().top + scrollY + innerHeight * 0.6;
    const from = scrollY;
    for (let k = 1; k <= 12; k++) { window.scrollTo(0, from + ((y - from) * k) / 12); await new Promise((r) => requestAnimationFrame(r)); }
  }, n);
  await new Promise((r) => setTimeout(r, 1300));
  await page.screenshot({ path: `${out}/${String(i).padStart(2, '0')}-${n}.png` });
}
console.log(JSON.stringify({ names, overflowX: await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), logs: [...new Set(logs)] }));
await browser.close();
