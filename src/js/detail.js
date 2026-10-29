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
 * Each word is a stop that the scroll plays: as it reaches the middle the words hold still for a while and the
 * scroll flies its object in, so the flight goes exactly as fast as the hand. A landed object stays landed until the
 * page is reloaded: scrolling back up and down again never replays it.
 * Without WebGL, on weak devices and with reduced motion it stays a calm, static list (see the CSS).
 */

const START = -1.25; // the first word starts just below the fold, under the title
const END_PAD = 0.35; // and the last one is on its way up when the pin lets go
// the pin's length in slots (the room between two words): the way in, a dwell on each word while its object flies,
// the travel between two words, the way out. The way in and out are twice as long as the distance they cover and
// eased, so the words leave and join the page at the page's own speed
const IN = -START * 2;
const DWELL = 0.8;
const TRAVEL = 0.9;
const OUT = END_PAD * 2;

export function initDetail({ reduce, finePointer }) {
  const section = document.querySelector('.detail');
  if (reduce || !canRunGL()) return;
  section.classList.add('is-live');

  const pin = section.querySelector('.detail__pin');
  const head = section.querySelector('.detail__head');
  const canvas = section.querySelector('.detail__gl');
  const items = [...section.querySelectorAll('.detail__item')];
  const words = items.map((li) => li.querySelector('.detail__word'));
  const last = items.length - 1;
  // where the cursor (in slots of scroll, 0 at the pin's start) reaches each word, and the pin's whole length
  const arrive = items.map((_, i) => IN + i * (DWELL + TRAVEL));
  const LENGTH = arrive[last] + DWELL + OUT;
  const sine = gsap.parseEase('sine.inOut');
  // the word at the centre (fractional) for a cursor r
  function wordAt(r) {
    if (r <= IN) { const x = Math.max(0, r) / IN; return START - START * (1 - (1 - x) * (1 - x)); }
    const leave = arrive[last] + DWELL;
    if (r >= leave) { const x = Math.min(1, (r - leave) / OUT); return last + END_PAD * x * x; }
    const i = Math.min(last, Math.floor((r - IN) / (DWELL + TRAVEL)));
    const into = r - arrive[i] - DWELL;
    return into <= 0 ? i : i + sine(into / TRAVEL);
  }
  // how far a word's object has flown for a cursor r: it sets off while its word is still coming up and lands
  // before the dwell is over, so there is a beat of stillness before the next word moves
  const flightAt = (r, i) => {
    const from = arrive[i] - (i ? TRAVEL * 0.45 : IN * 0.25);
    return gsap.utils.clamp(0, 1, (r - from) / (arrive[i] + DWELL * 0.85 - from));
  };

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
    end: () => `+=${LENGTH * slot}`,
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

  // ---- the flights: played by the scroll, and kept once landed (p never goes back down)
  const flights = items.map(() => ({ p: 0 }));
  if (import.meta.env.DEV) window.__detail = { flights }; // dev aid: QA scripts read the flights

  let r = 0; // the cursor as drawn: it follows the scroll with a little easing, so even a coarse scroll moves smoothly
  let c = START;
  let prevT = 0;
  function frame(time) {
    const dt = Math.min(0.05, prevT ? time - prevT : 0);
    prevT = time;
    r += (st.progress * LENGTH - r) * (1 - Math.exp(-dt * 7));
    c = wordAt(r);
    flights.forEach((f, i) => { f.p = Math.max(f.p, flightAt(r, i)); });

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
