import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

/*
 * The way to the end of the page (see finale.css): the promise, the upgrade, the values, belonging and the call.
 * Everything is driven by the scroll and runs both ways; nothing holds the page or takes the scroll away. Pins are
 * plain ScrollTrigger pins: one screen held while the scroll walks through it.
 * Built inside the page's gsap.matchMedia (sections.js): crossing the breakpoint rebuilds it, and the returned
 * function takes down what is not a tween (listeners, observers).
 */

const clamp01 = gsap.utils.clamp(0, 1);
const range = (v, a, b) => clamp01((v - a) / (b - a));
const lerp = (a, b, t) => a + (b - a) * t;

export function initFinale({ wide, finePointer, lenis, videos }) {
  const undo = [steps(wide, lenis, videos), upgrade(wide, videos), values(), belong(), closing(finePointer)];
  return () => undo.forEach((fn) => fn?.());
}

/* ---- 07 Promise: the index of the five promises, one frame for their pictures */
function steps(wide, lenis, videos) {
  const section = document.querySelector('.steps');
  const pin = section.querySelector('.steps__pin');
  const items = [...section.querySelectorAll('.step')];
  const buttons = items.map((li) => li.querySelector('.step__btn'));
  const track = section.querySelector('.steps__track');
  const video = section.querySelector('.step__media--video video');
  const head = document.querySelector('.promise__head');

  gsap.from(head.children, {
    y: 44, autoAlpha: 0, duration: 1.4, ease: 'expo.out', stagger: 0.1,
    scrollTrigger: { trigger: head, start: 'top 78%', once: true },
  });

  // the index needs room for the list and the frame side by side: wide screens only
  const live = wide && window.matchMedia('(min-width: 1024px)').matches;
  section.classList.toggle('is-live', live);
  const off = [];

  if (!live) {
    // a sequence: each promise opens as it comes in, its film plays while it is on screen
    video.dataset.autoplay = '';
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    }), { threshold: 0.2 });
    items.forEach((li) => io.observe(li));
    off.push(() => io.disconnect());
    buttons.forEach((b) => { b.disabled = true; }); // nothing to choose: they are all open
    return () => { off.forEach((fn) => fn()); buttons.forEach((b) => { b.disabled = false; }); items.forEach((li) => li.classList.remove('is-in')); };
  }

  delete video.dataset.autoplay; // it plays only while its promise is the one in focus
  // (its first second fades up from black: once loaded it waits a second in, so the frame never shows black)
  video.addEventListener('loadeddata', () => { if (video.currentTime < 0.9) video.currentTime = 1; }, { once: true });
  let active = -1;
  function focus(i) {
    if (i === active) return;
    items.forEach((li, k) => {
      li.classList.toggle('is-active', k === i);
      li.classList.toggle('was-active', k === active); // the last picture stays under the new one while it opens
      buttons[k].setAttribute('aria-current', k === i ? 'true' : 'false');
    });
    active = i;
    if (i === items.length - 1) { videos.load(video); video.play().catch(() => {}); } else video.pause();
  }
  const st = ScrollTrigger.create({
    trigger: pin,
    start: 'top top',
    end: () => `+=${items.length * 0.62 * window.innerHeight}`,
    pin: true,
    invalidateOnRefresh: true,
    onUpdate: (self) => {
      focus(Math.min(items.length - 1, Math.floor(self.progress * items.length)));
      track.style.setProperty('--p', self.progress.toFixed(4));
    },
    onLeave: () => video.pause(),
    onLeaveBack: () => video.pause(),
  });
  focus(0);
  // choosing a promise takes the page to its place in the index (the scroll stays the one way to move)
  buttons.forEach((b, i) => {
    const go = () => {
      const y = st.start + ((i + 0.5) / items.length) * (st.end - st.start);
      if (lenis) lenis.scrollTo(y, { duration: 1.1 });
      else window.scrollTo({ top: y, behavior: 'smooth' });
    };
    b.addEventListener('click', go);
    off.push(() => b.removeEventListener('click', go));
  });
  // the film starts buffering as the index comes near
  ScrollTrigger.create({ trigger: section, start: 'top 150%', once: true, onEnter: () => videos.load(video) });
  return () => {
    off.forEach((fn) => fn());
    video.pause();
    items.forEach((li) => li.classList.remove('is-active', 'was-active'));
  };
}

/* ---- 08 Upgrade: the call parts around the bolt; the film grows out of the bolt and the view dives into it */
function upgrade(wide, videos) {
  const pin = document.querySelector('.upgrade__pin');
  const win = document.querySelector('.upgrade__window');
  const video = document.querySelector('.upgrade__video');
  const words = document.querySelector('.upgrade__words');
  const copy = document.querySelector('.upgrade__copy');
  const title = document.querySelector('.upgrade__title');
  const RATIO = 323.2 / 553.99;
  // bolt centre (between the two bolts) and a point well inside the upper bolt's body to dive into
  const CENTER = [0.5, 0.5];
  const INSIDE = [215 / 323.2, 172 / 553.99];
  const state = { grow: 0, dive: 0, time: 0, part: 0, enter: 0 };

  function paint() {
    const W = pin.clientWidth;
    const H = pin.clientHeight;
    const base = H * (wide ? 0.46 : 0.42) * (1 + state.grow * 0.5);
    const h = base * Math.pow(48, state.dive); // exponential so the zoom feels constant
    const w = h * RATIO;
    const k = gsap.parseEase('power2.inOut')(Math.min(1, state.dive * 1.6));
    const ax = CENTER[0] + (INSIDE[0] - CENTER[0]) * k;
    const ay = CENTER[1] + (INSIDE[1] - CENTER[1]) * k;
    win.style.setProperty('--mw', `${w}px`);
    win.style.setProperty('--mh', `${h}px`);
    win.style.setProperty('--mx', `${W / 2 - ax * w}px`);
    win.style.setProperty('--my', `${H / 2 - ay * h}px`);
    // the two halves of the call keep just clear of the bolt, then drift apart and out as it dives (side by side on
    // landscape screens, above and below it on portrait ones, as the CSS lays them out)
    const upright = H > W * 1.25;
    const room = (upright ? h : w) * 1.08 + (upright ? H : W) * (0.5 * state.part + 0.22 * (1 - state.enter));
    words.style.setProperty('--half', `${(room / 2).toFixed(1)}px`);
    words.style.opacity = String(1 - k);
  }

  // desktop: the film is scrubbed by the scroll; touch: it simply plays (seeking is costly there)
  let seekPending = false;
  function seek() {
    if (!wide || !video.duration) return;
    const t = state.time * (video.duration - 0.05);
    if (seekPending || Math.abs(video.currentTime - t) < 1 / 30) return;
    seekPending = true;
    video.currentTime = t;
  }
  const onSeeked = () => { seekPending = false; seek(); };
  video.addEventListener('seeked', onSeeked);
  if (!wide) video.dataset.autoplay = '';
  else delete video.dataset.autoplay;
  video.loop = !wide;
  gsap.timeline({ scrollTrigger: { trigger: pin, start: 'top 200%', once: true, onEnter: () => videos.load(video) } });

  gsap.set(copy.children, { autoAlpha: 0, y: 20 });
  // as the section comes up, the two halves come in from wider apart (the same --half: no transform of their own,
  // which GSAP would merge with their CSS translate)
  gsap.to(state, {
    enter: 1, ease: 'none',
    scrollTrigger: { trigger: pin, start: 'top bottom', end: 'top top', scrub: 0.6 },
    onUpdate: paint,
  });
  const tl = gsap.timeline({
    scrollTrigger: wide
      ? { trigger: pin, start: 'top top', end: '+=240%', pin: true, scrub: 0.5, onRefresh: paint }
      : { trigger: pin, start: 'top top', end: '+=160%', pin: true, scrub: 0.5, onRefresh: paint },
    onUpdate: () => { paint(); seek(); },
  });
  tl.to(state, { grow: 1, ease: 'power1.inOut', duration: 0.55 }, 0)
    .to(state, { part: 1, ease: 'power2.in', duration: 0.5 }, 0.3)
    .to(state, { time: 1, ease: 'none', duration: 1 }, 0)
    .to(state, { dive: 1, ease: 'power2.in', duration: 0.4 }, wide ? 0.5 : 0.45)
    .to('.upgrade__halo', { scale: 2.4, autoAlpha: 0, ease: 'power1.in', duration: 0.3 }, wide ? 0.5 : 0.45)
    .to(copy.children, { autoAlpha: 1, y: 0, ease: 'power2.out', duration: 0.12, stagger: 0.04 }, 0.82)
    .fromTo(title, { scale: 0.94 }, { scale: 1, ease: 'power2.out', duration: 0.18 }, 0.82)
    .to(pin, { '--out': 1, ease: 'power1.in', duration: 0.12 }, 0.98) // the film sinks into the ink below
    .to({}, { duration: 0.02 });
  paint();
  // (crossing the breakpoint rebuilds this section: the old scrub must stop seeking the film)
  return () => video.removeEventListener('seeked', onSeeked);
}

/* ---- 09 Values: the title rises, the quotes come in line by line, the value passing the middle stands in ink */
function values() {
  const head = document.querySelector('.values__title');
  gsap.from(head, {
    yPercent: 24, autoAlpha: 0, duration: 1.5, ease: 'expo.out',
    scrollTrigger: { trigger: head, start: 'top 82%', once: true },
  });
  const quotes = [...document.querySelectorAll('.mv')];
  const splits = quotes.map((q) => SplitText.create(q.querySelector('.mv__text'), { type: 'lines', mask: 'lines', linesClass: 'line' }));
  quotes.forEach((q, i) => {
    gsap.timeline({ scrollTrigger: { trigger: q, start: 'top 80%', once: true } })
      .from(q.querySelector('.mv__label'), { autoAlpha: 0, y: 12, duration: 1, ease: 'expo.out' }, 0)
      .from(splits[i].lines, { yPercent: 105, duration: 1.3, ease: 'expo.out', stagger: 0.07 }, 0.08);
  });

  // the spotlight: each value's ink follows its distance from the middle of the screen
  const list = document.querySelector('.values__list');
  const rows = [...list.querySelectorAll('.value')];
  let centres = [];
  const measure = () => {
    const top = list.getBoundingClientRect().top + window.scrollY;
    centres = rows.map((r) => top + r.offsetTop + r.offsetHeight / 2);
  };
  const last = rows.map(() => -1);
  const light = () => {
    const mid = window.scrollY + window.innerHeight * 0.52;
    const reach = window.innerHeight * 0.26;
    rows.forEach((r, i) => {
      const t = 1 - clamp01(Math.abs(mid - centres[i]) / reach);
      const on = Math.round(t * t * (3 - 2 * t) * 40) / 40; // (in steps of 2.5%: far fewer repaints of large type)
      if (on !== last[i]) { last[i] = on; r.style.setProperty('--on', on); }
    });
  };
  const st = ScrollTrigger.create({
    trigger: list, start: 'top bottom', end: 'bottom top',
    onRefresh: () => { measure(); light(); },
    onUpdate: light,
  });
  measure();
  light();
  return () => { splits.forEach((s) => s.revert()); st.kill(); rows.forEach((r) => r.style.removeProperty('--on')); };
}

/* ---- 10 Belonging: from inside the store's wall, the view pulls back to the brand's whole world */
function belong() {
  const pin = document.querySelector('.belong__pin');
  const world = pin.querySelector('.belong__world');
  const heart = pin.querySelector('.belong__tile--heart');
  const lens = pin.querySelector('.belong__lens');
  const veil = pin.querySelector('.belong__veil');
  const text = pin.querySelector('.belong__text');
  const split = SplitText.create('.belong__title', { type: 'words', wordsClass: 'word' });
  const WS = 1.32; // how much closer the world starts
  const zoomEase = gsap.parseEase('power3.inOut');

  // the heart tile's box with the world at rest (scale 1), relative to the pin: where the lens comes to rest
  let rest = { x: 0, y: 0, w: 1, h: 1 };
  let W = 1;
  let H = 1;
  let radius = 16;
  const measure = () => {
    W = pin.clientWidth;
    H = pin.clientHeight;
    const prev = world.style.getPropertyValue('--ws');
    world.style.setProperty('--ws', '1');
    const p = pin.getBoundingClientRect();
    const r = heart.getBoundingClientRect();
    rest = { x: r.left - p.left, y: r.top - p.top, w: r.width, h: r.height };
    radius = parseFloat(getComputedStyle(heart).borderTopLeftRadius) || 16;
    world.style.setProperty('--ws', prev || '1');
  };

  const state = { p: 0 };
  function paint() {
    const z = zoomEase(range(state.p, 0.04, 0.62));
    const ws = lerp(WS, 1, z);
    world.style.setProperty('--ws', ws.toFixed(4));
    // the heart tile, as it is now (the world scales about the middle of the screen)
    const cx = W / 2 + (rest.x + rest.w / 2 - W / 2) * ws;
    const cy = H / 2 + (rest.y + rest.h / 2 - H / 2) * ws;
    const tw = rest.w * ws;
    const th = rest.h * ws;
    // the lens keeps the picture's proportions (one uniform scale) and crops itself down to the tile
    const end = Math.max(tw / W, th / H);
    const s = lerp(1, end, z);
    const ix = ((W - tw / end) / 2) * z;
    const iy = ((H - th / end) / 2) * z;
    lens.style.transform = `translate3d(${(cx - (W * s) / 2).toFixed(2)}px, ${(cy - (H * s) / 2).toFixed(2)}px, 0) scale(${s.toFixed(5)})`;
    lens.style.clipPath = `inset(${iy.toFixed(2)}px ${ix.toFixed(2)}px round ${((radius * ws * z) / s).toFixed(2)}px)`;
    veil.style.setProperty('--veil', range(state.p, 0.42, 0.7).toFixed(3));
    pin.style.setProperty('--in', (1 - range(state.p, 0, 0.12)).toFixed(3));
  }

  gsap.set(split.words, { autoAlpha: 0, yPercent: 40 });
  gsap.set(text, { autoAlpha: 0, y: 20 });
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: pin, start: 'top top', end: '+=190%', pin: true, scrub: 0.6,
      onRefresh: () => { measure(); paint(); },
    },
    onUpdate: paint,
  });
  tl.to(state, { p: 1, ease: 'none', duration: 1 }, 0)
    .to(split.words, { autoAlpha: 1, yPercent: 0, ease: 'power3.out', duration: 0.22, stagger: 0.025 }, 0.56)
    .to(text, { autoAlpha: 1, y: 0, ease: 'power2.out', duration: 0.14 }, 0.8);
  measure();
  paint();
  return () => split.revert();
}

/* ---- 11 The call: the promise rises over its reflection, the call follows; the pill leans towards the pointer */
function closing(finePointer) {
  const pin = document.querySelector('.closing__pin');
  const lines = pin.querySelectorAll('.closing__title:not(.closing__title--echo) .closing__line');
  const echo = pin.querySelectorAll('.closing__title--echo .closing__line');
  const act = pin.querySelector('.closing__act');
  const cta = pin.querySelector('.closing__cta');
  gsap.timeline({ scrollTrigger: { trigger: pin, start: 'top 62%', once: true } })
    .from(lines, { yPercent: 70, autoAlpha: 0, duration: 1.5, ease: 'expo.out', stagger: 0.1 }, 0)
    .from(echo, { yPercent: 70, autoAlpha: 0, duration: 1.5, ease: 'expo.out', stagger: 0.1 }, 0) // (mirrored: it rises from the line)
    .from('.closing__horizon', { scaleX: 0, duration: 1.6, ease: 'expo.out' }, 0.1)
    .from(act.children, { y: 24, autoAlpha: 0, duration: 1.2, ease: 'expo.out', stagger: 0.08 }, 0.35);
  // as the footer rises over it, the stage steps back
  gsap.timeline({ scrollTrigger: { trigger: pin, start: 'top top', end: '+=100%', pin: true, scrub: 0.5 } })
    .to('.closing__bg', { scale: 1.12, ease: 'none', duration: 1 }, 0)
    .to(['.closing__stage', act], { scale: 0.92, yPercent: -8, autoAlpha: 0, ease: 'power2.in', duration: 0.55 }, 0.05);

  if (!finePointer) return null;
  // the pill leans a little towards a pointer that comes near, and settles back when it leaves
  const x = gsap.quickTo(cta, 'x', { duration: 0.6, ease: 'power3.out' });
  const y = gsap.quickTo(cta, 'y', { duration: 0.6, ease: 'power3.out' });
  const move = (e) => {
    const r = cta.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const near = Math.hypot(dx, dy) < Math.max(r.width, 160);
    x(near ? dx * 0.18 : 0);
    y(near ? dy * 0.28 : 0);
  };
  const leave = () => { x(0); y(0); };
  pin.addEventListener('pointermove', move);
  pin.addEventListener('pointerleave', leave);
  return () => { pin.removeEventListener('pointermove', move); pin.removeEventListener('pointerleave', leave); };
}
