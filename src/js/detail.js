import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import svgText from '../assets/bolt.svg?raw';
import { canRunGL } from './evo-section.js';

/*
 * 04 · Detalhes — what the mark means, word by word (after Noomo's "Digital made human").
 * The section pins and the words climb through it in perspective, at the same pace as the page, so the pin never
 * feels like a stop: far words lean back in a cool grey, the one in the middle stands in full ink with its line of
 * text, and receives its own 3D object (detail3d.js). The small brand pieces drifting around it belong to the sky
 * shared with the neighbouring sections (flow.js).
 * Each word is a stop: when it reaches the middle the page holds still while its object flies in (in time, not
 * with the scroll, so every frame of the flight is drawn), and lets go once it has landed. Scrolling back up sends
 * the object away again, so the stop comes back on the way down.
 * Without WebGL, on weak devices and with reduced motion it stays a calm, static list (see the CSS).
 */

const START = -1.25; // the first word starts just below the fold, under the title
const END_PAD = 0.35; // and the last one is on its way up when the pin lets go
const FLIGHT = 2.6; // seconds an object takes to land beside its word

export function initDetail({ reduce, finePointer, lenis }) {
  const section = document.querySelector('.detail');
  if (reduce || !canRunGL()) return;
  section.classList.add('is-live');

  const pin = section.querySelector('.detail__pin');
  const head = section.querySelector('.detail__head');
  const canvas = section.querySelector('.detail__gl');
  const items = [...section.querySelectorAll('.detail__item')];
  const words = items.map((li) => li.querySelector('.detail__word'));
  const END = items.length - 1 + END_PAD;

  let H = 1;
  let slot = 1;
  let wordH = [];
  let top = 0; // the section's page position and height, for the edge fade (no layout reads per frame)
  let height = 1;
  const measure = () => {
    top = section.getBoundingClientRect().top + window.scrollY;
    height = section.offsetHeight;
    H = pin.clientHeight;
    slot = H * (pin.clientWidth < 760 ? 0.62 : 0.66); // generous room between the words
    wordH = words.map((w) => w.offsetHeight);
  };
  measure();

  const st = ScrollTrigger.create({
    trigger: pin,
    start: 'top top',
    end: () => `+=${(END - START) * slot}`,
    pin: true,
    invalidateOnRefresh: true,
    onRefresh: measure,
  });

  let stage = null;
  import('./detail3d.js')
    .then(({ createDetailStage }) => createDetailStage(canvas, pin, svgText, { lite: !finePointer }))
    .then((s) => { stage = s; })
    .catch(() => {});

  if (finePointer) {
    pin.addEventListener('pointermove', (e) => stage?.pointer(e.clientX / window.innerWidth - 0.5, e.clientY / window.innerHeight - 0.5));
    pin.addEventListener('pointerleave', () => stage?.pointer(0, 0));
  }
  new ResizeObserver(() => { measure(); stage?.resize(); }).observe(pin);

  // ---- the stops: hold the page on a word until its object has landed
  const flights = items.map(() => ({ p: 0, go: false, landed: false })); // p: 0 → 1 over FLIGHT seconds
  let held = -1;
  let holdY = 0;
  if (import.meta.env.DEV) window.__detail = { flights, held: () => held }; // dev aid: QA scripts read the stops
  const root = document.documentElement;
  const stopAt = (i) => st.start + ((i - START) / (END - START)) * (st.end - st.start);
  const KEYS = new Set(['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Space', ' ', 'End', 'Home']);
  const block = (e) => { if (held >= 0 && (e.type !== 'keydown' || KEYS.has(e.key))) e.preventDefault(); };
  ['wheel', 'touchmove', 'keydown'].forEach((type) => window.addEventListener(type, block, { passive: false }));
  function hold(i) {
    held = i;
    holdY = stopAt(i);
    flights[i].go = true;
    // glide back onto the word if the scroll went a little past it, then keep the page still. Lenis does it on
    // desktop; with native scrolling (touch) the frame loop pulls the page onto the word and keeps it there, which
    // also stops the momentum of a flick that blocking the events alone would let through
    if (lenis) lenis.scrollTo(holdY, { duration: 0.9, lock: true, force: true, onComplete: () => { if (held === i) lenis.stop(); } });
    else root.classList.add('is-holding');
  }
  function release() {
    held = -1;
    lenis?.start();
    root.classList.remove('is-holding');
  }

  let c = START; // the cursor as drawn: it follows the scroll with a little easing, so even a coarse scroll moves smoothly
  let prevTarget = START;
  let last = 0;
  function frame(time) {
    const dt = Math.min(0.05, last ? time - last : 0);
    last = time;
    const target = START + st.progress * (END - START);
    c += (target - c) * (1 - Math.exp(-dt * 7));

    // a word reached on the way down whose object has not landed yet: stop there (once the 3D stage is ready;
    // until then, or if the page got past the word some other way, the object simply flies without the stop)
    if (held < 0 && stage && target > prevTarget) {
      for (let i = 0; i < items.length; i++) {
        if (!flights[i].go && prevTarget < i + 0.02 && target >= i - 0.02) { hold(i); break; }
      }
    }
    prevTarget = target;
    if (held >= 0 && !lenis) {
      const y = window.scrollY;
      if (Math.abs(holdY - y) > 0.5) window.scrollTo(0, y + (holdY - y) * (1 - Math.exp(-dt * 9)));
    }
    flights.forEach((f, i) => {
      if (!f.go && held !== i && target >= i - 0.02 && (held < 0 ? !stage || target > i + 0.3 : true)) f.go = true;
      if (f.go) f.p = Math.min(1, f.p + dt / FLIGHT);
      else f.p = Math.max(0, f.p - dt / (FLIGHT * 0.6));
      if (f.go && f.p >= 1 && !f.landed) { f.landed = true; if (held === i) release(); }
      // well back above the word: the object leaves, and the stop comes back
      if (held !== i && target < i - 0.8) { f.go = false; f.landed = false; }
    });

    // before and after the pin the whole section simply scrolls with the page; inside it the words take over
    head.style.transform = `translate3d(0, ${(-(c - START) * slot).toFixed(1)}px, 0)`;
    items.forEach((li, i) => {
      const d = i - c;
      const a = Math.abs(d);
      const y = d * slot;
      const hidden = Math.abs(y) > H * 0.85;
      li.style.visibility = hidden ? 'hidden' : '';
      if (hidden) return;
      const tilt = gsap.utils.clamp(-1.4, 1.4, d) * 30;
      li.style.transform = `translate3d(0, ${(y - wordH[i] / 2).toFixed(1)}px, ${(-a * 150).toFixed(1)}px) rotateX(${tilt.toFixed(2)}deg)`;
      li.style.setProperty('--k', (1 - Math.min(1, a / 0.85)).toFixed(3));
      li.style.setProperty('--t', (1 - gsap.utils.clamp(0, 1, (a - 0.1) / 0.26)).toFixed(3));
    });
    // the 3D field fades at the section's edges instead of being cut by them
    const rTop = top - window.scrollY;
    canvas.style.opacity = gsap.utils.clamp(0, 1, Math.min((H - rTop) / (H * 0.5), (rTop + height) / (H * 0.5))).toFixed(3);
    stage?.frame(c, slot, time, flights);
  }

  // runs only while the section is on screen
  let running = false;
  const start = () => { if (!running) { running = true; gsap.ticker.add(frame); } };
  const stop = () => { if (running) { running = false; gsap.ticker.remove(frame); } };
  new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()), { rootMargin: '10% 0px' }).observe(section);
  frame(0);
}
