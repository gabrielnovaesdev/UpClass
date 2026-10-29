import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const clamp01 = gsap.utils.clamp(0, 1);
const range = (t, a, b) => clamp01((t - a) / (b - a));
const inOut = gsap.parseEase('power2.inOut');
const out = gsap.parseEase('power3.out');
const lerp = (a, b, k) => a + (b - a) * k;

// WebGL only where it pays off: wide screens with a capable GPU and motion allowed.
export function canRunGL() {
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) return false;
  if (navigator.deviceMemory && navigator.deviceMemory < 4) return false;
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch (e) {
    return false;
  }
}

/* ---- controls: play/pause, chapters, running clock (all layouts) */
export function filmControls() {
  const video = document.querySelector('.film__video');
  const buttons = [...document.querySelectorAll('.film__chapters button')];
  const play = document.querySelector('.evo__play');
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
      const on = t >= a && t < z;
      b.classList.toggle('is-on', on);
      if (on) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
      b.style.setProperty('--p', clamp01((t - a) / (z - a)).toFixed(3));
    });
  });
  buttons.forEach((b) =>
    b.addEventListener('click', () => {
      video.currentTime = +b.dataset.t;
      if (!userPaused) video.play().catch(() => {});
    }),
  );
  play.addEventListener('click', () => {
    userPaused = !video.paused;
    if (userPaused) video.pause();
    else video.play().catch(() => {});
  });
  const sync = () => {
    const paused = video.paused;
    play.classList.toggle('is-paused', paused);
    play.setAttribute('aria-label', paused ? 'Reproduzir o filme' : 'Pausar o filme');
  };
  video.addEventListener('play', sync);
  video.addEventListener('pause', sync);
  sync();
  // the visibility observer would restart it; respect an explicit pause
  video.addEventListener('play', () => userPaused && video.pause());
}

/* ---- desktop stage: the film panel travels from the slot to the player (see evolution.js) */
export async function evolutionStage({ videos }) {
  const section = document.querySelector('.evo');
  const pin = section.querySelector('.evo__pin');
  const slot = section.querySelector('.evo__slot');
  const player = section.querySelector('.evo__player');
  const video = section.querySelector('.film__video');
  const intro = section.querySelector('.evo__intro');
  const foot = section.querySelector('.film__foot');
  const wordA = section.querySelector('.evo__word--a');
  const wordB = section.querySelector('.evo__word--b');

  section.classList.add('is-gl');
  const poster = new Image();
  poster.src = video.getAttribute('poster');
  await poster.decode().catch(() => {});
  const { createEvolution } = await import('./evolution.js');
  const gl = await createEvolution({ host: pin, canvas: section.querySelector('.evo__gl'), video, poster });
  const s = gl.state;

  // the film starts buffering as the section approaches, so the panel plays real frames on arrival
  gsap.timeline({ scrollTrigger: { trigger: section, start: 'top 180%', once: true, onEnter: () => videos.load(video) } });

  let from = { x: 0, y: 0, w: 1, h: 1 };
  let to = { x: 0, y: 0, w: 1, h: 1 };
  const measure = () => {
    const p = pin.getBoundingClientRect();
    const rel = (el) => { const r = el.getBoundingClientRect(); return { x: r.left - p.left, y: r.top - p.top, w: r.width, h: r.height }; };
    from = rel(slot);
    to = rel(player); // includes its centring transform: exactly where the native video will show
  };

  let t = 0;
  let speed = 0;
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  pin.addEventListener('pointermove', (e) => {
    const r = pin.getBoundingClientRect();
    pointer.x = (e.clientX - r.left) / r.width - 0.5;
    pointer.y = (e.clientY - r.top) / r.height - 0.5;
  });
  pin.addEventListener('pointerleave', () => { pointer.x = 0; pointer.y = 0; });

  function paint() {
    pointer.sx += (pointer.x - pointer.sx) * 0.08;
    pointer.sy += (pointer.y - pointer.sy) * 0.08;
    speed *= 0.9;
    const k = inOut(range(t, 0.16, 0.66)); // travel
    const settle = 1 - k;
    s.rect = { x: lerp(from.x, to.x, k), y: lerp(from.y, to.y, k), w: lerp(from.w, to.w, k), h: lerp(from.h, to.h, k) };
    // resting, it leans towards the title and follows the cursor; travelling, it straightens out
    s.tiltY = (-0.42 + pointer.sx * 0.5) * settle;
    s.tiltX = (0.14 + pointer.sy * 0.3) * settle;
    s.curl = Math.sin(k * Math.PI) * 0.32;
    s.bend = Math.sin(k * Math.PI) * 0.1 + gsap.utils.clamp(-0.3, 0.3, speed / 4000);
    s.wipe = out(range(t, 0.34, 0.7));
    s.ribbonB = out(range(t, 0.0, 0.42));
    s.ribbonA = inOut(range(t, 0.5, 0.86));
    s.alpha = 1 - range(t, 0.84, 0.9);

    const fadeIntro = range(t, 0.1, 0.32);
    intro.style.opacity = String(1 - fadeIntro);
    intro.style.transform = `translate3d(0, ${-fadeIntro * 8}vh, 0)`;
    // the two words ride the travelling panel — one above its left corner, one below its right corner —
    // in the dark around it, never over the film, and always inside the screen
    const words = range(t, 0.16, 0.28) * (1 - range(t, 0.52, 0.62));
    const gap = 18;
    const r = s.rect;
    const maxX = pin.clientWidth - wordB.offsetWidth - 16;
    wordA.style.opacity = wordB.style.opacity = String(words);
    wordA.style.transform = `translate3d(${Math.max(16, r.x)}px, ${r.y - gap - wordA.offsetHeight}px, 0)`;
    wordB.style.transform = `translate3d(${Math.min(maxX, r.x + r.w - wordB.offsetWidth)}px, ${r.y + r.h + gap}px, 0)`;

    const handoff = range(t, 0.82, 0.88);
    player.style.opacity = String(handoff);
    player.style.visibility = handoff > 0 ? 'visible' : 'hidden';
    const ui = range(t, 0.86, 0.94);
    foot.style.opacity = String(ui);
    foot.style.visibility = ui > 0 ? 'visible' : 'hidden';
    foot.style.transform = `translate3d(0, ${(1 - ui) * 14}px, 0)`;
  }

  gsap.timeline({
    scrollTrigger: {
      trigger: pin,
      start: 'top top',
      end: '+=240%',
      pin: true,
      scrub: 0.7,
      invalidateOnRefresh: true,
      onRefresh: () => { measure(); paint(); },
      onUpdate: (self) => { speed = self.getVelocity(); },
    },
  }).to({ v: 0 }, {
    v: 1, ease: 'none', duration: 1,
    onUpdate() { t = this.targets()[0].v; },
  });

  // DOM and uniform updates run only while the stage is on screen
  let ticking = false;
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !ticking) { ticking = true; gsap.ticker.add(paint); }
    else if (!e.isIntersecting && ticking) { ticking = false; gsap.ticker.remove(paint); }
  }).observe(pin);
  measure();
  paint();
  // this pin is created after the rest of the page measured itself: put it back in page order, re-measure
  ScrollTrigger.sort();
  ScrollTrigger.refresh();
}

/* ---- phones, reduced motion, no WebGL: a calm reveal */
export function evolutionFlat({ reduce }) {
  if (reduce) return;
  gsap.from(['.evo__intro > *', '.evo__player', '.evo__ticker', '.film__foot'], {
    y: 36, autoAlpha: 0, duration: 1.2, ease: 'expo.out', stagger: 0.08,
    scrollTrigger: { trigger: '.evo', start: 'top 70%', once: true },
  });
}
