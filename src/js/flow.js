import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import svgText from '../assets/bolt.svg?raw';
import { canRunGL } from './evo-section.js';

/*
 * The name, the details, the collection and the moments live in one light space (.flow). Its sky is held to the
 * screen while they scroll through it (see the CSS), so nothing changes colour at a section's edge. Over the whole
 * flow the glows wander slowly across it, and the small brand pieces of the details (detail3d.js) float in it from
 * the first section to the last, sliding with the scroll in depth: the thread that ties the four together.
 * With reduced motion the sky is still one, just calm; without WebGL it has no pieces.
 */
export function initFlow({ reduce, finePointer }) {
  const flow = document.querySelector('.flow');
  if (reduce) return;
  const sky = flow.querySelector('.flow__sky');
  const canvas = flow.querySelector('.flow__gl');

  const drift = { trigger: flow, start: 'top bottom', end: 'bottom top', scrub: 1.5 };
  // (on touch screens the glows hold still: three layers wider than the screen, moving, cost more than they give)
  if (finePointer) gsap.timeline({ scrollTrigger: drift, defaults: { ease: 'sine.inOut', duration: 1 } })
    .to('.flow__glow--warm', { keyframes: { xPercent: [0, -34, -12, 10], yPercent: [0, 12, -6, 8] } }, 0)
    .to('.flow__glow--pink', { keyframes: { xPercent: [0, 26, 48, 20], yPercent: [0, -18, -8, -22] } }, 0)
    .to('.flow__glow--cool', { keyframes: { xPercent: [0, -10, -30, -8], yPercent: [0, -14, 6, -10] } }, 0);

  if (!canRunGL()) return;
  flow.classList.add('is-gl');

  let top = 0; // page position and height of the flow, measured on refresh (no layout reads per frame)
  let height = 1;
  let H = 1;
  const measure = () => {
    top = flow.getBoundingClientRect().top + window.scrollY;
    height = flow.offsetHeight;
    H = sky.clientHeight;
  };
  measure();
  ScrollTrigger.addEventListener('refresh', measure);

  let field = null;
  import('./detail3d.js')
    .then(({ createField }) => { field = createField(canvas, sky, svgText, { lite: !finePointer }); })
    .catch(() => flow.classList.remove('is-gl'));

  if (finePointer) {
    flow.addEventListener('pointermove', (e) => field?.pointer(e.clientX / window.innerWidth - 0.5, e.clientY / window.innerHeight - 0.5));
    flow.addEventListener('pointerleave', () => field?.pointer(0, 0));
  }
  new ResizeObserver(() => { H = sky.clientHeight; field?.resize(); }).observe(sky);

  function frame(time) {
    const rTop = top - window.scrollY;
    // the pieces gather as the flow comes in and thin out as it leaves, instead of being cut by its edges
    const fadeIn = (H - rTop) / (H * 0.6);
    const fadeOut = (rTop + height - H * 0.35) / (H * 0.6);
    canvas.style.opacity = gsap.utils.clamp(0, 1, Math.min(fadeIn, fadeOut)).toFixed(3);
    field?.frame(time, -rTop);
  }

  // renders only while the flow is on screen
  let running = false;
  const start = () => { if (!running) { running = true; gsap.ticker.add(frame); } };
  const stop = () => { if (running) { running = false; gsap.ticker.remove(frame); } };
  new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop())).observe(flow);
}

/*
 * The manifesto, right under the hero, opens the same sky: the glows drift with the scroll and a lighter flock of
 * the same pieces floats behind the sentence, so the light space of the page begins here and the details further
 * down feel like a return to it.
 */
export function initManifestoSky({ reduce, finePointer }) {
  const section = document.querySelector('.manifesto');
  if (reduce) return;
  const sky = section.querySelector('.manifesto__sky');
  const canvas = section.querySelector('.manifesto__gl');

  if (finePointer) gsap.timeline({ scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: 1.5 }, defaults: { ease: 'sine.inOut', duration: 1 } })
    .to(sky.querySelector('.flow__glow--warm'), { keyframes: { xPercent: [0, -18, 6], yPercent: [0, 8, -4] } }, 0)
    .to(sky.querySelector('.flow__glow--pink'), { keyframes: { xPercent: [0, 20, 34], yPercent: [0, -12, -18] } }, 0)
    .to(sky.querySelector('.flow__glow--cool'), { keyframes: { xPercent: [0, -12, -22], yPercent: [0, -8, 4] } }, 0);

  if (!canRunGL()) return;
  section.classList.add('is-gl');
  let top = 0;
  const measure = () => { top = section.getBoundingClientRect().top + window.scrollY; };
  measure();
  ScrollTrigger.addEventListener('refresh', measure);

  let field = null;
  import('./detail3d.js')
    .then(({ createField }) => { field = createField(canvas, sky, svgText, { lite: !finePointer, count: finePointer ? 15 : 9 }); })
    .catch(() => section.classList.remove('is-gl'));
  if (finePointer) {
    section.addEventListener('pointermove', (e) => field?.pointer(e.clientX / window.innerWidth - 0.5, e.clientY / window.innerHeight - 0.5));
    section.addEventListener('pointerleave', () => field?.pointer(0, 0));
  }
  new ResizeObserver(() => field?.resize()).observe(sky);

  const frame = (time) => field?.frame(time, window.scrollY - top);
  let running = false;
  const start = () => { if (!running) { running = true; gsap.ticker.add(frame); } };
  const stop = () => { if (running) { running = false; gsap.ticker.remove(frame); } };
  new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop())).observe(section);
}
