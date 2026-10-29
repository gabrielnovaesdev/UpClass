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

/* ---- controls (all layouts): the preview loop's pause button, PLAY ▶ REEL and the film dialog with its chapters */
export function filmControls({ lenis }) {
  const section = document.querySelector('.evo');
  const preview = section.querySelector('.film__video');
  const play = section.querySelector('.evo__play');
  const reel = section.querySelector('.evo__reel');
  const dialog = section.querySelector('.evo__dialog');
  const film = dialog.querySelector('.evo__film');
  const buttons = [...dialog.querySelectorAll('.film__chapters button')];
  const marks = buttons.map((b) => +b.dataset.t);
  let userPaused = false;

  // the preview loop: an explicit pause wins over the visibility observer that restarts it
  play.addEventListener('click', () => {
    userPaused = !preview.paused;
    if (userPaused) preview.pause();
    else preview.play().catch(() => {});
  });
  const sync = () => {
    play.classList.toggle('is-paused', preview.paused);
    play.setAttribute('aria-label', preview.paused ? 'Reproduzir a prévia do filme' : 'Pausar a prévia do filme');
  };
  preview.addEventListener('play', sync);
  preview.addEventListener('pause', sync);
  preview.addEventListener('play', () => (userPaused || dialog.open) && preview.pause());
  sync();

  // the full film, in a dialog over the page (Esc and the close button leave; focus returns to PLAY)
  const seek = (t) => {
    const go = () => { film.currentTime = t; film.play().catch(() => {}); };
    if (film.readyState >= 1) go();
    else film.addEventListener('loadedmetadata', go, { once: true });
  };
  const open = (t = 0) => {
    if (!dialog.open) dialog.showModal();
    lenis?.stop();
    preview.pause();
    if (film.preload === 'none') { film.preload = 'auto'; film.load(); }
    seek(t);
  };
  reel.addEventListener('click', () => open(0));
  dialog.querySelector('.evo__close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); }); // backdrop
  dialog.addEventListener('close', () => {
    film.pause();
    lenis?.start();
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches; // the preview never autoplays there
    if (!userPaused && !calm) preview.play().catch(() => {});
  });
  buttons.forEach((b) => b.addEventListener('click', () => seek(+b.dataset.t)));
  film.addEventListener('timeupdate', () => {
    const t = film.currentTime;
    const end = film.duration || 57.28;
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

  // outside the desktop stage, the letters gather once the film comes into view (see sections.css)
  new IntersectionObserver(([e], io) => {
    if (e.isIntersecting) { section.classList.add('is-in'); io.disconnect(); }
  }, { threshold: 0.4 }).observe(preview.parentElement);
}

/* ---- desktop stage: the film panel travels from the slot to the player (see evolution.js), then the pin
   releases and the page scrolls on with the film and its ribbon */
export async function evolutionStage({ videos }) {
  const section = document.querySelector('.evo');
  const pin = section.querySelector('.evo__pin');
  const slot = section.querySelector('.evo__slot');
  const player = section.querySelector('.evo__player');
  const video = section.querySelector('.film__video');
  const intro = section.querySelector('.evo__intro');
  const reel = section.querySelector('.evo__reel');
  const reelBtn = reel.querySelector('.evo__reel-btn');
  const letters = [...reel.querySelectorAll('.evo__reel-l')].map((el) => ({
    el, d: +el.style.getPropertyValue('--d'), side: el.closest('.evo__reel-word--a') ? -1 : 1,
  }));

  section.classList.add('is-gl');
  pin.append(reel); // on the stage the label rides the travelling panel, not the hidden player
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
    reel.style.setProperty('--reel-fs', `${(to.w * 0.074).toFixed(1)}px`);
    reelSize = [reel.offsetWidth, reel.offsetHeight];
  };

  let reelSize = [0, 0];
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
    const k = inOut(range(t, 0.12, 0.62)); // travel
    const settle = 1 - k;
    s.rect = { x: lerp(from.x, to.x, k), y: lerp(from.y, to.y, k), w: lerp(from.w, to.w, k), h: lerp(from.h, to.h, k) };
    // resting, it leans towards the title and follows the cursor; travelling, it straightens out
    s.tiltY = (-0.42 + pointer.sx * 0.5) * settle;
    s.tiltX = (0.14 + pointer.sy * 0.3) * settle;
    s.curl = Math.sin(k * Math.PI) * 0.32;
    s.bend = Math.sin(k * Math.PI) * 0.1 + gsap.utils.clamp(-0.3, 0.3, speed / 4000);
    s.wipe = out(range(t, 0.3, 0.64));
    // the ribbon draws itself in and stays: after the landing the page simply scrolls on, film and ribbon together
    s.ribbonB = out(range(t, 0.0, 0.4));
    s.ribbonA = 0;
    s.alpha = 1 - range(t, 0.7, 0.74);

    const fadeIntro = range(t, 0.08, 0.3);
    intro.style.opacity = String(1 - fadeIntro);
    intro.style.transform = `translate3d(0, ${-fadeIntro * 8}vh, 0)`;
    const handoff = range(t, 0.64, 0.7);
    player.style.opacity = String(handoff);
    player.style.visibility = handoff > 0 ? 'visible' : 'hidden';

    // PLAY ▶ REEL rides the panel; its letters arrive from far apart and settle one by one, then the button
    const r = s.rect;
    const sc = r.w / to.w;
    reel.style.opacity = String(range(t, 0.18, 0.3));
    reel.style.transform = `translate3d(${(r.x + r.w / 2 - reelSize[0] / 2).toFixed(1)}px, ${(r.y + r.h / 2 - reelSize[1] / 2).toFixed(1)}px, 0) scale(${sc.toFixed(4)})`;
    letters.forEach(({ el, d, side }) => {
      const g = out(range(t, 0.28 + d * 0.05, 0.56 + d * 0.05));
      el.style.transform = `translate3d(${(side * (1 - g) * (1.1 + d * 0.6)).toFixed(3)}em, ${((1 - g) * (d % 2 ? 0.2 : -0.2)).toFixed(3)}em, 0)`;
      el.style.opacity = String(0.2 + 0.8 * g);
    });
    const b = out(range(t, 0.52, 0.68));
    reelBtn.style.setProperty('--in', b.toFixed(3));
    reel.style.pointerEvents = b > 0.9 ? 'auto' : 'none';
    reel.tabIndex = b > 0.9 ? 0 : -1;
  }

  gsap.timeline({
    scrollTrigger: {
      trigger: pin,
      start: 'top top',
      end: '+=200%',
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
  gsap.from(['.evo__intro > *', '.evo__player'], {
    y: 36, autoAlpha: 0, duration: 1.2, ease: 'expo.out', stagger: 0.08,
    scrollTrigger: { trigger: '.evo', start: 'top 70%', once: true },
  });
}
