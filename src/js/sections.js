import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { applyContacts } from './config.js';
import { lazyVideos } from './video.js';

// Rhythm of the page: strong moments (film, symbol, collection, upgrade, belong) alternate with calm ones
// (manifesto, name, moments, values) so the motion leads the eye without crowding it.
export function initSections({ reduce, lenis, finePointer }) {
  applyContacts();
  const videos = lazyVideos({ reduce });

  // interactive pieces that work with or without motion
  const symbolCtl = symbolParts();
  filmControls();
  footerBasics({ lenis, reduce, finePointer, videos });
  if (finePointer) momentsCursor();
  if (reduce) return;

  manifesto();
  values();
  bento();
  moments();

  const mm = gsap.matchMedia();
  mm.add({ wide: '(min-width: 761px)', narrow: '(max-width: 760px)' }, (ctx) => {
    const wide = ctx.conditions.wide;
    film(wide);
    name(wide);
    if (wide) {
      symbolScroll(symbolCtl);
      collection();
    } else {
      symbolCtl.autoplay();
      collectionNarrow();
    }
    upgrade(wide, videos);
    belong(wide);
    closing();
    footerEnter();
  });
}

/* ---- 01 Manifesto: the sentence sharpens word by word as you scroll (Lia) */
function manifesto() {
  const title = document.querySelector('.manifesto__title');
  const note = document.querySelector('.manifesto__note');
  const pillars = document.querySelectorAll('.manifesto__pillars li');
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

/* ---- 02 Film: a small window in the dark opens until you are inside the film (Lusion reel, KPR) */
function film(wide) {
  const pin = document.querySelector('.film__pin');
  const foot = document.querySelector('.film__foot');
  if (!wide) {
    gsap.from(['.film__line', '.film__frame', foot], {
      y: 40, autoAlpha: 0, duration: 1.2, ease: 'expo.out', stagger: 0.1,
      scrollTrigger: { trigger: pin, start: 'top 75%', once: true },
    });
    return;
  }
  gsap.set(foot, { autoAlpha: 0, y: 16 });
  gsap.timeline({
    scrollTrigger: { trigger: pin, start: 'top top', end: '+=160%', pin: true, scrub: 0.6 },
  })
    .fromTo(pin, { '--ix': '36%', '--iy': '33%', '--r': '28px' }, { '--ix': '0%', '--iy': '0%', '--r': '0px', ease: 'power2.inOut', duration: 1 }, 0.1)
    .fromTo('.film__line--a', { x: 0 }, { x: '-2vw', ease: 'power1.in', duration: 0.8 }, 0.1)
    .fromTo('.film__line--b', { x: 0 }, { x: '2vw', ease: 'power1.in', duration: 0.8 }, 0.1)
    .fromTo('.film__video', { scale: 1.25 }, { scale: 1, ease: 'none', duration: 1.1 }, 0)
    .to(foot, { autoAlpha: 1, y: 0, ease: 'power2.out', duration: 0.25 }, 1)
    .to({}, { duration: 0.25 });
}

// chapters, play/pause and a running clock, like a film player stripped to its essentials
function filmControls() {
  const video = document.querySelector('.film__video');
  const buttons = [...document.querySelectorAll('.film__chapters button')];
  const toggle = document.querySelector('.film__toggle');
  const time = document.querySelector('.film__time');
  const marks = buttons.map((b) => +b.dataset.t);
  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  let userPaused = false;

  video.addEventListener('timeupdate', () => {
    const t = video.currentTime;
    const end = video.duration || 57.28;
    time.textContent = `${fmt(t)} / ${fmt(end)}`;
    buttons.forEach((b, i) => {
      const a = marks[i];
      const z = marks[i + 1] ?? end;
      b.classList.toggle('is-on', t >= a && t < z);
      b.style.setProperty('--p', gsap.utils.clamp(0, 1, (t - a) / (z - a)).toFixed(3));
    });
  });
  buttons.forEach((b) =>
    b.addEventListener('click', () => {
      video.currentTime = +b.dataset.t;
      if (!userPaused) video.play().catch(() => {});
    }),
  );
  toggle.addEventListener('click', () => {
    userPaused = !video.paused;
    if (userPaused) video.pause();
    else video.play().catch(() => {});
  });
  const sync = () => {
    toggle.textContent = video.paused ? 'Assistir' : 'Pausar';
    toggle.setAttribute('aria-pressed', String(video.paused));
  };
  video.addEventListener('play', sync);
  video.addEventListener('pause', sync);
  sync();
  // the visibility observer would restart it; respect an explicit pause
  video.addEventListener('play', () => userPaused && video.pause());
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
      ? { trigger: '.name__pin', start: 'top top', end: '+=120%', pin: true, scrub: 0.6 }
      : { trigger: '.name__pin', start: 'top 70%', end: 'bottom 60%', scrub: 0.6 },
  })
    .fromTo(up, { xPercent: -45 }, { xPercent: 0, ease: 'power3.inOut', duration: 1 }, 0)
    .fromTo(cls, { xPercent: 22 }, { xPercent: 0, ease: 'power3.inOut', duration: 1 }, 0)
    .fromTo(plus, { rotate: 0, width: '0.62em', autoAlpha: 1 }, { rotate: 180, width: '0em', autoAlpha: 0, ease: 'power3.inOut', duration: 0.9 }, 0.1)
    .to(defs, { autoAlpha: 1, y: 0, stagger: 0.1, duration: 0.4, ease: 'power2.out' }, 0.8)
    .to({}, { duration: 0.2 });
}

/* ---- 04 Symbol: bolts, arrows and the hidden phone, one idea at a time */
function symbolParts() {
  const fig = document.querySelector('.symbol__fig');
  const items = [...document.querySelectorAll('.symbol__part')];
  const count = document.querySelector('.symbol__count-n');
  const names = items.map((li) => li.dataset.part);
  let current = 0;
  let timer = null;

  // normalise stroke lengths so a single dasharray draws every path
  fig.querySelectorAll('.symbol__arrows path, .symbol__phone rect').forEach((p) => p.setAttribute('pathLength', '1'));

  function set(i) {
    if (i === current && fig.dataset.part === names[i]) return;
    current = i;
    fig.dataset.part = names[i];
    items.forEach((li, k) => {
      li.classList.toggle('is-active', k === i);
      li.querySelector('button').setAttribute('aria-pressed', String(k === i));
    });
    count.textContent = `0${i + 1}`;
  }
  items.forEach((li, i) =>
    li.querySelector('button').addEventListener('click', () => {
      clearInterval(timer);
      timer = null;
      set(i);
    }),
  );
  return {
    set,
    autoplay() {
      // on touch screens the three ideas take turns while the section is on screen
      const io = new IntersectionObserver(([e]) => {
        if (e.isIntersecting && !timer) timer = setInterval(() => set((current + 1) % names.length), 3600);
        else if (!e.isIntersecting) { clearInterval(timer); timer = null; }
      }, { threshold: 0.4 });
      io.observe(fig);
    },
  };
}

function symbolScroll(ctl) {
  gsap.from(['.symbol__head > *', '.symbol__parts'], {
    y: 30, autoAlpha: 0, duration: 1.2, ease: 'expo.out', stagger: 0.08,
    scrollTrigger: { trigger: '.symbol__pin', start: 'top 70%', once: true },
  });
  gsap.timeline({
    scrollTrigger: {
      trigger: '.symbol__pin', start: 'top top', end: '+=210%', pin: true, scrub: 0.8,
      onUpdate: (self) => ctl.set(Math.min(2, Math.floor(self.progress * 3))),
    },
  })
    .fromTo('.symbol__svg', { scale: 0.86, rotate: -6 }, { scale: 1.04, rotate: 3, ease: 'none', duration: 1 }, 0);
}

/* ---- 05 Collection: a pinned track of glass cards turning in 3D over outlined type (Lia) */
function collection() {
  const pin = document.querySelector('.collection__pin');
  const track = document.querySelector('.collection__track');
  const cards = [...track.children];
  const marquee = document.querySelector('.collection__marquee');
  const head = document.querySelector('.collection__head');

  const distance = () => {
    const last = cards[cards.length - 1];
    const lastCentre = last.offsetLeft + last.offsetWidth / 2;
    return lastCentre - window.innerWidth / 2;
  };

  // each card turns according to how far it sits from the centre of the screen
  function turn() {
    const mid = window.innerWidth / 2;
    for (const card of cards) {
      const r = card.getBoundingClientRect();
      const d = gsap.utils.clamp(-1.6, 1.6, (r.left + r.width / 2 - mid) / mid);
      card.style.transform = `translateZ(${-Math.abs(d) * 140}px) rotateY(${d * -26}deg) scale(${1 - Math.abs(d) * 0.06})`;
      card.firstElementChild.style.setProperty('--sheen', `${d * 70}%`);
    }
  }

  gsap.timeline({
    scrollTrigger: {
      trigger: pin,
      start: 'top top',
      end: () => `+=${distance() * 1.1}`,
      pin: true,
      scrub: 0.6,
      invalidateOnRefresh: true,
      onUpdate: turn,
      onRefresh: turn,
    },
  })
    .to(track, { x: () => -distance(), ease: 'none', duration: 1 }, 0)
    .to(marquee, { xPercent: -38, ease: 'none', duration: 1 }, 0)
    .to('.collection__progress i', { scaleX: 1, ease: 'none', duration: 1 }, 0)
    .to(head, { autoAlpha: 0, y: -20, ease: 'power1.in', duration: 0.25 }, 0.3);

  gsap.from(cards, {
    y: 60, autoAlpha: 0, duration: 1.2, ease: 'expo.out', stagger: 0.08,
    scrollTrigger: { trigger: pin, start: 'top 70%', once: true },
  });
  turn();
}

// touch screens keep native horizontal swiping; only the outlined type drifts with the page
function collectionNarrow() {
  gsap.to('.collection__marquee', {
    xPercent: -45, ease: 'none',
    scrollTrigger: { trigger: '.collection', start: 'top bottom', end: 'bottom top', scrub: true },
  });
}

/* ---- 06 Moments: calm rows; the picture follows the cursor on desktop */
function moments() {
  gsap.from('.moments__title', {
    yPercent: 25, autoAlpha: 0, duration: 1.4, ease: 'expo.out',
    scrollTrigger: { trigger: '.moments__head', start: 'top 80%', once: true },
  });
  document.querySelectorAll('.moment').forEach((row) => {
    gsap.fromTo(row.querySelectorAll('.moment__num, .moment__title, .moment__text, .moment__media'), { y: 26, autoAlpha: 0 }, {
      y: 0, autoAlpha: 1, duration: 1.1, ease: 'expo.out', stagger: 0.06,
      scrollTrigger: { trigger: row, start: 'top 88%', once: true },
    });
  });
}

function momentsCursor() {
  const list = document.querySelector('.moments__list');
  const box = document.querySelector('.moments__cursor');
  const shots = [...box.children];
  const rows = [...list.children];
  const xTo = gsap.quickTo(box, 'x', { duration: 0.7, ease: 'power3.out' });
  const yTo = gsap.quickTo(box, 'y', { duration: 0.7, ease: 'power3.out' });
  const rTo = gsap.quickTo(box, 'rotate', { duration: 0.9, ease: 'power3.out' });
  let lastX = 0;
  gsap.set(box, { xPercent: -50, yPercent: -50, scale: 0.6, autoAlpha: 0 });

  rows.forEach((row, i) =>
    row.addEventListener('pointerenter', () => shots.forEach((s, k) => s.classList.toggle('is-on', k === i))),
  );
  list.addEventListener('pointerenter', () => gsap.to(box, { autoAlpha: 1, scale: 1, duration: 0.6, ease: 'expo.out' }));
  list.addEventListener('pointerleave', () => gsap.to(box, { autoAlpha: 0, scale: 0.6, duration: 0.5, ease: 'power2.in' }));
  list.addEventListener('pointermove', (e) => {
    xTo(e.clientX + window.innerWidth * 0.14);
    yTo(e.clientY);
    rTo(gsap.utils.clamp(-8, 8, (e.clientX - lastX) * 0.4));
    lastX = e.clientX;
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

/* ---- Footer: the card settles onto the paper; the mark resolves out of light inside it */
function footerEnter() {
  const card = document.querySelector('.footer__card');
  gsap.fromTo(card, { scale: 0.92 }, {
    scale: 1, ease: 'none',
    scrollTrigger: { trigger: '.footer', start: 'top bottom', end: 'top top', scrub: 0.6 },
  });
  gsap.from(['.footer__title', '.footer__channels li'], {
    y: 40, autoAlpha: 0, duration: 1.3, ease: 'expo.out', stagger: 0.08,
    scrollTrigger: { trigger: '.footer', start: 'top 55%', once: true },
  });
}

function footerBasics({ lenis, reduce, finePointer, videos }) {
  const card = document.querySelector('.footer__card');
  const video = document.querySelector('.footer__video');
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

  // the logo film plays once each time the footer comes into view and rests on its last frame
  if (reduce) {
    video.poster = '/video/logo-resolve-poster.webp';
  } else {
    new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      videos.load(video);
      if (video.paused && (video.ended || video.currentTime === 0)) {
        video.currentTime = 0;
        video.play().catch(() => {});
      }
    }, { threshold: 0.45 }).observe(video);
  }

  if (finePointer && !reduce) {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      gsap.to(card, {
        '--gx': `${((e.clientX - r.left) / r.width) * 100}%`,
        '--gy': `${((e.clientY - r.top) / r.height) * 100}%`,
        duration: 1.2, ease: 'power3.out', overwrite: 'auto',
      });
    });
  }
}
