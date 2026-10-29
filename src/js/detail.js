import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import svgText from '../assets/bolt.svg?raw';
import { canRunGL } from './evo-section.js';

/*
 * 04 · Detalhes — what the mark means, word by word (after Noomo's "Digital made human").
 * The section pins and the words climb through it in perspective, at the same pace as the page, so the pin never
 * feels like a stop: far words lean back in a cool grey, the one in the middle stands in full ink with its line of
 * text, and receives its own 3D object (detail3d.js). Small brand pieces keep drifting in depth all the time.
 * Without WebGL, on weak devices and with reduced motion it stays a calm, static list (see the CSS).
 */

const START = -1.25; // the first word starts just below the fold, under the title
const END_PAD = 0.35; // and the last one is on its way up when the pin lets go

export function initDetail({ reduce, finePointer }) {
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
    slot = H * (pin.clientWidth < 760 ? 0.46 : 0.42);
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

  function frame(time) {
    const c = START + st.progress * (END - START);
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
    stage?.frame(c, slot, time, (c - START) * slot);
  }

  // runs only while the section is on screen
  let running = false;
  const start = () => { if (!running) { running = true; gsap.ticker.add(frame); } };
  const stop = () => { if (running) { running = false; gsap.ticker.remove(frame); } };
  new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()), { rootMargin: '10% 0px' }).observe(section);
  frame(0);
}
