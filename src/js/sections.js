import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { applyContacts } from './config.js';
import { lazyVideos } from './video.js';
import { canRunGL, evolutionFlat, evolutionStage, filmControls } from './evo-section.js';
import { initDetail } from './detail.js';
import { initFlow } from './flow.js';
import { initMorph } from './morph.js';

// Rhythm of the page: strong moments (film, details, collection, upgrade, belong) alternate with calm ones
// (manifesto, name, moments, values) so the motion leads the eye without crowding it. The name, the details, the
// collection and the moments share one sky (.flow, see flow.js); the other light sections and the footer use the
// same mist (.atmo), so they read as one continuous space.
export function initSections({ reduce, lenis, finePointer }) {
  applyContacts();
  const videos = lazyVideos({ reduce });

  // interactive pieces that work with or without motion
  filmControls({ lenis });
  // the film stage is WebGL on capable desktops; everywhere else it is a calm, fully functional player
  const evoGL = !reduce && finePointer && window.matchMedia('(min-width: 761px)').matches && canRunGL();
  if (evoGL) evolutionStage({ videos }).catch(() => document.querySelector('.evo').classList.remove('is-gl'));
  else evolutionFlat({ reduce });
  footerBasics({ lenis, reduce });
  initMorph({ reduce });
  if (finePointer) momentsCursor({ reduce });
  initFlow({ reduce, finePointer });
  if (reduce) return;

  manifesto();
  // the details pin (see detail.js) is created here; ScrollTrigger.sort() below puts it back in page order
  initDetail({ reduce, finePointer, lenis });
  values();
  bento();
  moments();

  const mm = gsap.matchMedia();
  mm.add({ wide: '(min-width: 761px)', narrow: '(max-width: 760px)' }, (ctx) => {
    const wide = ctx.conditions.wide;
    name(wide);
    const undoCollection = collection(wide);
    upgrade(wide, videos);
    belong(wide);
    closing();
    footerEnter();
    return undoCollection;
  });
  // pins were created out of page order (the name pin after the details pin): refresh them top to bottom
  ScrollTrigger.sort();
}

/* ---- 01 Manifesto: the sentence sharpens word by word as you scroll (Lia).
   It starts under the pinned hero: while it rises, its inner layer is held to the screen, so when the hero's dark
   ground lifts the manifesto is already there, and its title rises from below into place, with the scroll (Noomo). */
function manifesto() {
  const inner = document.querySelector('.manifesto__inner');
  const title = document.querySelector('.manifesto__title');
  const note = document.querySelector('.manifesto__note');
  const pillars = document.querySelectorAll('.manifesto__pillars li');
  const handOver = { trigger: '.manifesto', end: 'top top', invalidateOnRefresh: true };
  gsap.fromTo(inner, { y: () => -window.innerHeight }, { y: 0, ease: 'none', scrollTrigger: { ...handOver, start: 'top bottom', scrub: true } });
  gsap.fromTo(title, { y: () => window.innerHeight * 0.32 }, { y: 0, ease: 'power2.out', scrollTrigger: { ...handOver, start: 'top 85%', scrub: 0.4 } });
  // split inside the accent too, so the gradient word resolves with the rest
  const words = SplitText.create(title, { type: 'words', wordsClass: 'word' }).words;
  const narrow = window.matchMedia('(max-width: 760px)').matches;
  gsap.set(words, narrow ? { opacity: 0.12 } : { opacity: 0.1, filter: 'blur(14px)' });
  gsap.set([note, pillars], { autoAlpha: 0, y: 16 });
  gsap.timeline({
    scrollTrigger: { trigger: '.manifesto__pin', start: 'top top', end: '+=130%', pin: !narrow, scrub: 0.6, ...(narrow && { start: 'top 75%', end: 'bottom 70%' }) },
  })
    .to(words, { opacity: 1, filter: 'blur(0px)', ease: 'none', duration: 0.5, stagger: 0.12 })
    .to(note, { autoAlpha: 0.72, y: 0, duration: 0.5, ease: 'power2.out' })
    .to(pillars, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power2.out', stagger: 0.15 }, '<0.1')
    .to({}, { duration: 0.3 });
}

/* ---- 03 Name: "up" and "class" travel towards each other until the plus disappears (Mana) */
function name(wide) {
  const up = document.querySelector('.name__up');
  const cls = document.querySelector('.name__class');
  const plus = document.querySelector('.name__plus');
  const defs = document.querySelectorAll('.name__def, .name__sum');
  gsap.set(defs, { autoAlpha: 0, y: 20 });
  gsap.timeline({
    scrollTrigger: wide
      ? { trigger: '.name__pin', start: 'top top', end: '+=150%', pin: true, scrub: 0.6 }
      : { trigger: '.name__pin', start: 'top 70%', end: 'bottom 60%', scrub: 0.6 },
  })
    .fromTo(up, { xPercent: -45 }, { xPercent: 0, ease: 'power3.inOut', duration: 1 }, 0)
    .fromTo(cls, { xPercent: 22 }, { xPercent: 0, ease: 'power3.inOut', duration: 1 }, 0)
    .fromTo(plus, { rotate: 0, width: '0.62em', autoAlpha: 1 }, { rotate: 180, width: '0em', autoAlpha: 0, ease: 'power3.inOut', duration: 0.9 }, 0.1)
    .to(defs, { autoAlpha: 1, y: 0, stagger: 0.1, duration: 0.4, ease: 'power2.out' }, 0.8)
    .to({}, { duration: 0.2 });
}

/* ---- 05 Collection: frosted cards fly an arc across the title in depth (Noomo).
   The section pins; at the pace of the scroll the cards rise one after the other from the lower right corner, arc
   over the middle of the screen and go down towards the lower left, banking along the curve, turned a little
   towards the middle of the screen and a touch larger at the top of the arc. They keep floating (a slow sway) even
   when the scroll stops, pass in front of the title and their glass blurs it. Reduced motion keeps the static row
   (see the CSS). */
function collection(wide) {
  const section = document.querySelector('.collection');
  const pin = section.querySelector('.collection__pin');
  const cards = [...section.querySelectorAll('.card')];
  section.classList.add('is-live');
  // distance between two cards along the arc (0 … 1 is one full crossing) and the height of its top (card centre)
  const GAP = wide ? 0.21 : 0.46;
  const APEX = wide ? 0.58 : 0.6;
  const SPAN = 1 + (cards.length - 1) * GAP; // the first card enters at 0, the last one has left at SPAN
  let W = 1;
  let H = 1;
  let cw = 1;
  let ch = [];
  // the arc: a quadratic curve from just off the lower right corner, over the middle, to just off the lower left
  const P = { x0: 0, x1: 0, x2: 0, y0: 0, y1: 0 };
  const measure = () => {
    W = pin.clientWidth;
    H = pin.clientHeight;
    cw = cards[0].offsetWidth;
    ch = cards.map((c) => c.offsetHeight);
    P.x0 = W + cw * 0.75;
    P.x1 = W / 2;
    P.x2 = -cw * 0.75;
    P.y0 = H + Math.max(...ch) * 0.7;
    P.y1 = 2 * H * APEX - P.y0; // puts the top of the curve (its middle) at APEX
  };
  measure();
  const travel = () => (P.x0 - P.x2) * SPAN;

  const st = ScrollTrigger.create({
    trigger: pin,
    start: 'top top',
    end: () => `+=${travel() * (wide ? 0.85 : 1.25)}`,
    pin: true,
    invalidateOnRefresh: true,
    onRefresh: measure,
  });

  let p = 0;
  let vel = 0;
  function frame(time) {
    const prev = p;
    p += (st.progress - p) * 0.12;
    vel += ((p - prev) * travel() - vel) * 0.1; // px per frame, smoothed: the cards lean into the motion
    const lean = gsap.utils.clamp(-10, 10, vel * 0.5);
    cards.forEach((card, i) => {
      const s = p * SPAN - i * GAP;
      if (s <= 0 || s >= 1) { card.style.visibility = 'hidden'; return; }
      card.style.visibility = '';
      const u = 1 - s;
      const bx = u * u * P.x0 + 2 * u * s * P.x1 + s * s * P.x2;
      const by = (u * u + s * s) * P.y0 + 2 * u * s * P.y1;
      // direction of travel: banks the card up while it climbs and down while it falls
      const dx = 2 * u * (P.x1 - P.x0) + 2 * s * (P.x2 - P.x1);
      const dy = 2 * (u - s) * (P.y1 - P.y0);
      const bank = (Math.atan2(-dy, -dx) * 180) / Math.PI;
      const x = bx - cw / 2;
      const y = by - ch[i] / 2 + Math.sin(time * 0.7 + i * 1.7) * H * 0.012;
      const cx = bx / W - 0.5; // -0.5 … 0.5 across the screen
      const ry = -cx * 34 + lean;
      const rx = Math.cos(time * 0.5 + i * 1.3) * 3;
      const rz = bank * 0.2 + Math.sin(time * 0.45 + i) * 1.4;
      const k = 0.9 + 0.12 * Math.sin(Math.PI * s);
      card.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) perspective(1100px) rotateY(${ry.toFixed(2)}deg) rotateX(${rx.toFixed(2)}deg) rotateZ(${rz.toFixed(2)}deg) scale(${k.toFixed(3)})`;
      card.style.setProperty('--ex', `${ry > 0 ? -3 : 3}px`);
    });
  }
  let running = false;
  const io = new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !running) { running = true; gsap.ticker.add(frame); }
    else if (!e.isIntersecting && running) { running = false; gsap.ticker.remove(frame); }
  });
  io.observe(section);
  frame(0);

  // matchMedia revert (crossing 760 px): back to a clean state before the other layout builds its own
  return () => {
    io.disconnect();
    gsap.ticker.remove(frame);
    st.kill();
    section.classList.remove('is-live');
    cards.forEach((c) => { c.style.transform = ''; c.style.visibility = ''; });
  };
}

/* ---- 06 Moments: calm rows; the picture follows the cursor on desktop */
function moments() {
  // the heading rises line by line, each one out of its own mask
  SplitText.create('.moments__title', { type: 'lines', mask: 'lines', autoSplit: true, onSplit: (self) =>
    gsap.from(self.lines, {
      yPercent: 105, duration: 1.4, ease: 'expo.out', stagger: 0.09,
      scrollTrigger: { trigger: '.moments__head', start: 'top 80%', once: true },
    }),
  });
  document.querySelectorAll('.moment').forEach((row) => {
    gsap.fromTo(row.querySelectorAll('.moment__title, .moment__text, .moment__media'), { y: 26, autoAlpha: 0 }, {
      y: 0, autoAlpha: 1, duration: 1.1, ease: 'expo.out', stagger: 0.06,
      clearProps: 'transform,opacity,visibility', // hand the row back to the CSS focus states
      scrollTrigger: { trigger: row, start: 'top 88%', once: true },
    });
  });
}

// The print opens from its centre, leans in 3D with the pointer's motion and the picture drifts the other way inside
// it, so it reads as a photograph held up beside the row. Keyboard focus brings it beside the focused row's title.
function momentsCursor({ reduce }) {
  const list = document.querySelector('.moments__list');
  const box = document.querySelector('.moments__cursor');
  const shots = [...box.children];
  const rows = [...list.children];
  const xTo = gsap.quickTo(box, 'x', { duration: 0.7, ease: 'power3.out' });
  const yTo = gsap.quickTo(box, 'y', { duration: 0.7, ease: 'power3.out' });
  const tilt = { duration: 0.9, ease: 'power3.out' };
  const ryTo = gsap.quickTo(box, 'rotationY', tilt);
  const rxTo = gsap.quickTo(box, 'rotationX', tilt);
  const rzTo = gsap.quickTo(box, 'rotation', tilt);
  const pxTo = gsap.quickTo(shots, 'xPercent', { duration: 1.2, ease: 'power3.out' });
  const pyTo = gsap.quickTo(shots, 'yPercent', { duration: 1.2, ease: 'power3.out' });
  const closed = 'inset(50% 50% 50% 50% round 14px)';
  const open = 'inset(0% 0% 0% 0% round 14px)';
  gsap.set(box, { xPercent: -50, yPercent: -50, transformPerspective: 700, autoAlpha: 0, scale: 0.9, clipPath: reduce ? open : closed });

  let half = 0; // half the print's width, read once per visit rather than on every move
  let shown = false;
  const pick = (i) => shots.forEach((s, k) => s.classList.toggle('is-on', k === i));
  const show = () => {
    if (shown) return;
    shown = true;
    half = box.offsetWidth / 2;
    gsap.to(box, { autoAlpha: 1, scale: 1, clipPath: open, duration: reduce ? 0.3 : 0.8, ease: 'expo.out', overwrite: 'auto' });
  };
  const hide = () => {
    if (!shown) return;
    shown = false;
    gsap.to(box, { autoAlpha: 0, scale: 0.9, clipPath: reduce ? open : closed, duration: 0.45, ease: 'power2.in', overwrite: 'auto' });
  };
  const settle = () => { ryTo(0); rxTo(0); rzTo(0); pxTo(0); pyTo(0); };

  rows.forEach((row, i) => {
    row.addEventListener('pointerenter', () => pick(i));
    row.addEventListener('focus', () => {
      pick(i);
      show();
      // beside the end of the title's words (not its column), centred on the row
      const range = document.createRange();
      range.selectNodeContents(row.querySelector('.moment__title'));
      const r = row.getBoundingClientRect();
      xTo(range.getBoundingClientRect().right + half + 28);
      yTo(r.top + r.height / 2);
      settle();
    });
  });
  list.addEventListener('focusout', (e) => { if (!list.contains(e.relatedTarget) && !list.matches(':hover')) hide(); });
  list.addEventListener('pointerenter', show);
  list.addEventListener('pointerleave', () => { if (!list.contains(document.activeElement)) hide(); settle(); });

  let lastX = 0;
  let lastY = 0;
  let rest = 0;
  list.addEventListener('pointermove', (e) => {
    show();
    // when the pointer stops, the print comes back to rest
    clearTimeout(rest);
    rest = setTimeout(settle, 120);
    // just right of the pointer, whatever the print's size
    xTo(e.clientX + half + 28);
    yTo(e.clientY);
    if (!reduce) {
      const vx = gsap.utils.clamp(-30, 30, e.clientX - lastX);
      const vy = gsap.utils.clamp(-30, 30, e.clientY - lastY);
      ryTo(vx * 0.5);
      rxTo(-vy * 0.4);
      rzTo(vx * 0.12);
      pxTo(-vx * 0.12);
      pyTo(-vy * 0.12);
    }
    lastX = e.clientX;
    lastY = e.clientY;
  });
}

/* ---- 07 Promise: tiles rise in a soft cascade; pictures settle inside them (Pangram) */
function bento() {
  gsap.from(['.promise__title', '.promise__lead'], {
    y: 40, autoAlpha: 0, duration: 1.3, ease: 'expo.out', stagger: 0.1,
    scrollTrigger: { trigger: '.promise__head', start: 'top 80%', once: true },
  });
  document.querySelectorAll('.tile').forEach((tile, i) => {
    gsap.from(tile, {
      y: 70, autoAlpha: 0, duration: 1.3, ease: 'expo.out', delay: (i % 3) * 0.08,
      scrollTrigger: { trigger: tile, start: 'top 90%', once: true },
    });
    const media = tile.querySelector('.tile__media img, .tile__media video');
    if (media) {
      gsap.fromTo(media, { yPercent: -4, scale: 1.16 }, {
        yPercent: 4, scale: 1.06, ease: 'none',
        scrollTrigger: { trigger: tile, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    }
  });
}

/* ---- 08 Upgrade: the film plays inside the bolt, then the bolt opens until you are in it (Farm, KPR) */
function upgrade(wide, videos) {
  const pin = document.querySelector('.upgrade__pin');
  const win = document.querySelector('.upgrade__window');
  const video = document.querySelector('.upgrade__video');
  const marquee = document.querySelector('.upgrade__marquee');
  const copy = document.querySelector('.upgrade__copy');
  const title = document.querySelector('.upgrade__title');
  const RATIO = 323.2 / 553.99;
  // bolt centre (between the two bolts) and a point well inside the upper bolt's body to dive into
  const CENTER = [0.5, 0.5];
  const INSIDE = [215 / 323.2, 172 / 553.99];
  const state = { grow: 0, dive: 0, time: 0 };

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
  video.addEventListener('seeked', () => { seekPending = false; seek(); });
  if (!wide) video.dataset.autoplay = '';
  else delete video.dataset.autoplay;
  video.loop = !wide;
  // start buffering as soon as the section gets close, so the first scrub frames are ready
  gsap.timeline({ scrollTrigger: { trigger: pin, start: 'top 200%', once: true, onEnter: () => videos.load(video) } });

  gsap.set(copy.children, { autoAlpha: 0, y: 20 });
  const tl = gsap.timeline({
    scrollTrigger: wide
      ? { trigger: pin, start: 'top top', end: '+=240%', pin: true, scrub: 0.5, onRefresh: paint }
      : { trigger: pin, start: 'top bottom', end: 'bottom top', scrub: 0.5, onRefresh: paint },
    onUpdate: () => { paint(); seek(); },
  });
  tl.to(state, { grow: 1, ease: 'power1.inOut', duration: 0.55 }, 0)
    .to(state, { time: 1, ease: 'none', duration: 1 }, 0)
    .to(state, { dive: 1, ease: 'power2.in', duration: 0.4 }, wide ? 0.5 : 0.45)
    .to('.upgrade__halo', { scale: 2.4, autoAlpha: 0, ease: 'power1.in', duration: 0.3 }, wide ? 0.5 : 0.45)
    .fromTo(marquee, { xPercent: 0 }, { xPercent: -33.333, ease: 'none', duration: 1 }, 0)
    .to(copy.children, { autoAlpha: 1, y: 0, ease: 'power2.out', duration: 0.12, stagger: 0.04 }, 0.82)
    .fromTo(title, { scale: 0.94 }, { scale: 1, ease: 'power2.out', duration: 0.18 }, 0.82)
    .to({}, { duration: 0.1 });
  paint();
}

/* ---- 09 Values: calm — hairlines draw, words settle */
function values() {
  const items = document.querySelectorAll('.value');
  gsap.set('.value__rule', { scaleX: 0 });
  gsap.set(['.value__num', '.value__title', '.value__text'], { autoAlpha: 0, y: 18 });
  const tl = gsap.timeline({ scrollTrigger: { trigger: '.values__list', start: 'top 82%', once: true } });
  items.forEach((item, i) => {
    tl.to(item.querySelector('.value__rule'), { scaleX: 1, duration: 1.4, ease: 'expo.out' }, i * 0.1)
      .to(item.querySelectorAll('.value__num, .value__title, .value__text'),
        { autoAlpha: 1, y: 0, duration: 1, ease: 'expo.out', stagger: 0.07 }, i * 0.1 + 0.2);
  });
  gsap.from('.values__title', {
    yPercent: 30, autoAlpha: 0, duration: 1.4, ease: 'expo.out',
    scrollTrigger: { trigger: '.values__head', start: 'top 80%', once: true },
  });
  gsap.from('.mv', {
    y: 40, autoAlpha: 0, duration: 1.3, ease: 'expo.out', stagger: 0.12,
    scrollTrigger: { trigger: '.values__mv', start: 'top 82%', once: true },
  });
}

/* ---- 10 Belong: four columns of the brand in use drift at different speeds around the statement */
function belong(wide) {
  const pin = document.querySelector('.belong__pin');
  const cols = document.querySelectorAll('.belong__col');
  const words = SplitText.create('.belong__title', { type: 'words', wordsClass: 'word' }).words;
  const tl = gsap.timeline({
    scrollTrigger: wide
      ? { trigger: pin, start: 'top top', end: '+=120%', pin: true, scrub: 0.6 }
      : { trigger: pin, start: 'top bottom', end: 'bottom top', scrub: 0.6 },
  });
  const speeds = [-34, -12, -44, -20];
  cols.forEach((c, i) => tl.fromTo(c, { yPercent: speeds[i] * -0.3 }, { yPercent: speeds[i], ease: 'none', duration: 1 }, 0));
  tl.fromTo(words, { opacity: 0.15 }, { opacity: 1, ease: 'none', duration: 0.35, stagger: 0.04 }, 0.05)
    .from('.belong__text', { autoAlpha: 0, y: 20, ease: 'power2.out', duration: 0.2 }, 0.55);
}

/* ---- 11 Closing: the call to action holds still while the footer card rises over it */
function closing() {
  const pin = document.querySelector('.closing__pin');
  const copy = document.querySelector('.closing__copy');
  gsap.from(copy.children, {
    y: 30, autoAlpha: 0, duration: 1.3, ease: 'expo.out', stagger: 0.1,
    scrollTrigger: { trigger: pin, start: 'top 60%', once: true },
  });
  gsap.timeline({
    scrollTrigger: { trigger: pin, start: 'top top', end: '+=100%', pin: true, scrub: 0.5 },
  })
    .to('.closing__bg', { scale: 1.12, ease: 'none', duration: 1 }, 0)
    .to(copy, { scale: 0.9, yPercent: -8, autoAlpha: 0, ease: 'power1.in', duration: 0.9 }, 0.1);
}

/* ---- Footer: its lines settle as it rises over the call to action */
function footerEnter() {
  gsap.from(['.footer__title', '.footer__channels li', '.footer__cols > *', '.footer__bottom > *'], {
    y: 34, autoAlpha: 0, duration: 1.3, ease: 'expo.out', stagger: 0.05,
    scrollTrigger: { trigger: '.footer', start: 'top 55%', once: true },
  });
}

function footerBasics({ lenis, reduce }) {
  document.querySelector('.footer__year').textContent = new Date().getFullYear();

  // local time at the store
  const time = document.querySelector('.footer__time');
  const clock = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
  const tick = () => (time.textContent = clock.format(new Date()));
  tick();
  setInterval(tick, 15000);

  document.querySelector('[data-scroll-top]').addEventListener('click', () => {
    if (lenis) lenis.scrollTo(0, { duration: 2.2 });
    else window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  });
}
