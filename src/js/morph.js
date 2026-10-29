import gsap from 'gsap';
import boltSvg from '../assets/bolt.svg?raw';

/*
 * Footer mark: one hairline that keeps turning into what the store sells — the bolt, a phone, headphones, a watch,
 * earbuds — and back. Every icon is up to three closed contours in a 64×64 box; each contour is resampled to the same
 * number of points, so any two icons can blend point by point. A contour an icon does not have shrinks into the
 * middle of its partner and disappears.
 */

const N = 120;
const HOLD = 1.5; // seconds resting on each icon
const MORPH = 1.15; // seconds between two icons

const boltPaths = [...boltSvg.matchAll(/\sd="([^"]+)"/g)].map((m) => m[1]);
const BOLT_K = 56 / 553.99;
const boltContour = (d) => ({ d, k: BOLT_K, ox: 32 - (323.2 * BOLT_K) / 2, oy: 4 });

const ICONS = [
  // the mark
  boltPaths.map(boltContour),
  // phone: body and island
  [
    { d: 'M25 4H39A6 6 0 0 1 45 10V54A6 6 0 0 1 39 60H25A6 6 0 0 1 19 54V10A6 6 0 0 1 25 4Z' },
    { d: 'M29.5 8.5H34.5A1.5 1.5 0 0 1 34.5 11.5H29.5A1.5 1.5 0 0 1 29.5 8.5Z' },
  ],
  // headphones: band and two cups
  [
    { d: 'M9 40A23 23 0 0 1 55 40H52A20 20 0 0 0 12 40Z' },
    { d: 'M10 36H14A4 4 0 0 1 18 40V52A4 4 0 0 1 14 56H10A4 4 0 0 1 6 52V40A4 4 0 0 1 10 36Z' },
    { d: 'M50 36H54A4 4 0 0 1 58 40V52A4 4 0 0 1 54 56H50A4 4 0 0 1 46 52V40A4 4 0 0 1 50 36Z' },
  ],
  // watch: case and the two halves of the band
  [
    { d: 'M25 17H39A7 7 0 0 1 46 24V40A7 7 0 0 1 39 47H25A7 7 0 0 1 18 40V24A7 7 0 0 1 25 17Z' },
    { d: 'M23 17L25 5H39L41 17Z' },
    { d: 'M23 47L25 59H39L41 47Z' },
  ],
  // earbuds
  [
    { d: 'M22 11A9 9 0 0 1 30.5 23L30 48A2.6 2.6 0 0 1 24.8 48L24.6 28.6A9 9 0 1 1 22 11Z' },
    { d: 'M42 11A9 9 0 0 0 33.5 23L34 48A2.6 2.6 0 0 0 39.2 48L39.4 28.6A9 9 0 1 0 42 11Z' },
  ],
];

const NS = 'http://www.w3.org/2000/svg';

function sample(svg, { d, k = 1, ox = 0, oy = 0 }) {
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('d', d);
  svg.appendChild(p);
  const len = p.getTotalLength();
  const pts = [];
  for (let i = 0; i < N; i++) {
    const q = p.getPointAtLength((i / N) * len);
    pts.push([q.x * k + ox, q.y * k + oy]);
  }
  p.remove();
  // same winding everywhere, so a morph never turns a shape inside out
  let area = 0;
  for (let i = 0; i < N; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % N];
    area += x1 * y2 - x2 * y1;
  }
  return area < 0 ? pts.reverse() : pts;
}

const centroid = (pts) => pts.reduce((c, [x, y]) => [c[0] + x / pts.length, c[1] + y / pts.length], [0, 0]);
const collapsed = (pt) => Array.from({ length: N }, () => [pt[0], pt[1]]);

// start the target contour at the point that best matches the source, so the line slides instead of twisting
function align(a, b) {
  let best = 0;
  let bestD = Infinity;
  for (let s = 0; s < N; s += 2) {
    let dist = 0;
    for (let i = 0; i < N; i += 4) {
      const p = a[i];
      const q = b[(i + s) % N];
      dist += (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2;
    }
    if (dist < bestD) { bestD = dist; best = s; }
  }
  return b.map((_, i) => b[(i + best) % N]);
}

function toPath(contours) {
  let d = '';
  for (const c of contours) {
    const [x0, y0] = c[0];
    let w = 0;
    for (const [x, y] of c) w = Math.max(w, Math.abs(x - x0) + Math.abs(y - y0));
    if (w < 0.6) continue; // a contour that has shrunk away is not drawn (a round cap would leave a dot)
    d += `M${c[0][0].toFixed(2)} ${c[0][1].toFixed(2)}`;
    for (let i = 1; i < c.length; i++) d += `L${c[i][0].toFixed(2)} ${c[i][1].toFixed(2)}`;
    d += 'Z';
  }
  return d;
}

export function initMorph({ reduce }) {
  const svg = document.querySelector('.footer__morph');
  const path = svg?.querySelector('.footer__morph-path');
  if (!path) return;
  const icons = ICONS.map((icon) => icon.map((c) => sample(svg, c)));
  if (reduce) {
    path.setAttribute('d', toPath(icons[0]));
    return;
  }

  // pairs of contour lists ready to blend: icon i → icon i + 1
  const pairs = icons.map((from, i) => {
    const to = icons[(i + 1) % icons.length];
    const A = [];
    const B = [];
    for (let k = 0; k < Math.max(from.length, to.length); k++) {
      const a = from[k] || collapsed(centroid(to[k]));
      const b = to[k] || collapsed(centroid(from[k]));
      A.push(a);
      B.push(align(a, b));
    }
    return [A, B];
  });

  const ease = gsap.parseEase('power3.inOut');
  const cycle = HOLD + MORPH;
  let t0 = null;
  let last = '';
  function frame(time) {
    if (t0 === null) t0 = time;
    const t = (time - t0) % (cycle * icons.length);
    const i = Math.floor(t / cycle);
    const local = t - i * cycle;
    const k = local < HOLD ? 0 : ease((local - HOLD) / MORPH);
    const [A, B] = pairs[i];
    const mixed = A.map((a, c) => a.map((p, j) => [p[0] + (B[c][j][0] - p[0]) * k, p[1] + (B[c][j][1] - p[1]) * k]));
    const d = toPath(mixed);
    if (d !== last) path.setAttribute('d', (last = d));
  }
  path.setAttribute('d', toPath(icons[0]));

  let running = false;
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !running) { running = true; gsap.ticker.add(frame); }
    else if (!e.isIntersecting && running) { running = false; gsap.ticker.remove(frame); }
  }).observe(svg);
}
