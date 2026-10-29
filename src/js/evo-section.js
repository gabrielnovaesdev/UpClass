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

/* ---- desktop stage (see evolution.js). One pin, in three acts:
   1. the bolt of light beside the title pours into the film, which grows out of it to the player;
   2. the film holds, full size, for PLAY ▶ REEL;
   3. the film rises and steps back, the dark lifts away under a soft edge and the dust rises with it: the light
      section is already underneath (the flow starts under this pin's last screen, see the overlap below), so
      when the pin lets go the page is simply in the mist. */
const PIN = 3.2; // screens of scroll the stage holds for
const LIFT = [0.76, 0.98]; // the part of it where the dark lifts away

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
  const ambient = section.querySelector('.evo__ambient');
  const nav = document.querySelector('.nav');

  // The light flow slides under this pin's last stretch: from the start of the lift on, it fills the screen beneath
  // the stage. Its first section is pushed down by the same amount, so nothing after it moves.
  const root = document.documentElement;
  // The name then arrives a little before the pin lets go, so the mist is never empty for long.
  const overlap = () => pin.offsetHeight + (1 - LIFT[0]) * PIN * window.innerHeight;
  const setOverlap = () => {
    root.style.setProperty('--evo-overlap', `${Math.round(overlap())}px`);
    root.style.setProperty('--evo-lead', `${Math.round(window.innerHeight * 0.55)}px`);
  };
  setOverlap();
  ScrollTrigger.addEventListener('refreshInit', setOverlap);

  // the points gather into the bolt the first time the stage comes into view
  new IntersectionObserver(([e], io) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    gsap.to(s, { gather: 1, duration: 2.4, ease: 'power2.out' });
  }, { threshold: 0.25 }).observe(pin);

  // the film starts buffering as the section approaches, so the panel plays real frames on arrival
  gsap.timeline({ scrollTrigger: { trigger: section, start: 'top 180%', once: true, onEnter: () => videos.load(video) } });

  let from = { x: 0, y: 0, w: 1, h: 1 };
  let to = { x: 0, y: 0, w: 1, h: 1 };
  let stageH = 1;
  const measure = () => {
    const p = pin.getBoundingClientRect();
    const rel = (el) => { const r = el.getBoundingClientRect(); return { x: r.left - p.left, y: r.top - p.top, w: r.width, h: r.height }; };
    player.style.transform = ''; // measured at rest, without the exit's offset
    const slotR = rel(slot);
    to = rel(player); // includes its centring transform: exactly where the native video will show
    stageH = p.height;
    // the bolt stands where the slot is, tall; the film grows out of its centre
    const bh = Math.min(p.height * 0.58, p.width * 0.36);
    const bw = bh * s.aspect;
    const bcx = slotR.x + slotR.w / 2;
    const bcy = p.height * 0.52;
    s.bolt = { x: bcx - bw / 2, y: bcy - bh / 2, w: bw, h: bh };
    from = { x: bcx - bw * 0.18, y: bcy - bw * 0.1, w: bw * 0.36, h: bw * 0.2 };
    reel.style.setProperty('--reel-fs', `${(to.w * 0.074).toFixed(1)}px`);
    reelSize = [reel.offsetWidth, reel.offsetHeight];
  };

  let reelSize = [0, 0];
  let t = 0;
  let speed = 0;
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  const px = { x: -9999, y: -9999 }; // the pointer in stage pixels, for the points to part around it
  pin.addEventListener('pointermove', (e) => {
    const r = pin.getBoundingClientRect();
    pointer.x = (e.clientX - r.left) / r.width - 0.5;
    pointer.y = (e.clientY - r.top) / r.height - 0.5;
    px.x = e.clientX - r.left;
    px.y = e.clientY - r.top;
  });
  pin.addEventListener('pointerleave', () => { pointer.x = 0; pointer.y = 0; px.x = -9999; px.y = -9999; });

  let lastTheme = '';
  function paint() {
    pointer.sx += (pointer.x - pointer.sx) * 0.08;
    pointer.sy += (pointer.y - pointer.sy) * 0.08;
    speed *= 0.9;

    // act 1: the river of light, the panel growing out of the bolt and turning to colour
    s.flow = range(t, 0.04, 0.5);
    const k = inOut(range(t, 0.1, 0.5)); // travel
    const settle = 1 - k;
    // act 3: the film rises out of the frame, stepping back a little, and the dark lifts away right behind it
    // (it stays opaque: never a see-through film over the mist)
    const ex = gsap.parseEase('power2.in')(range(t, 0.72, 0.95));
    const lift = inOut(range(t, LIFT[0], LIFT[1]));
    s.exit = range(t, 0.7, 1);

    const rest = { x: lerp(from.x, to.x, k), y: lerp(from.y, to.y, k), w: lerp(from.w, to.w, k), h: lerp(from.h, to.h, k) };
    const sc = 1 - ex * 0.12;
    const rise = ex * stageH * 1.12;
    s.rect = { x: rest.x + (rest.w * (1 - sc)) / 2, y: rest.y + (rest.h * (1 - sc)) / 2 - rise, w: rest.w * sc, h: rest.h * sc };
    // growing, it leans in towards the title and follows the cursor; full size, it straightens out
    s.tiltY = (-0.36 + pointer.sx * 0.4) * settle;
    s.tiltX = (0.1 + pointer.sy * 0.24) * settle;
    s.curl = Math.sin(k * Math.PI) * 0.26;
    s.bend = Math.sin(k * Math.PI) * 0.08 + gsap.utils.clamp(-0.24, 0.24, speed / 4500);
    s.wipe = out(range(t, 0.22, 0.5));
    s.alpha = out(range(t, 0.08, 0.26)) * (1 - range(t, 0.56, 0.6));
    s.pointer = [px.x, px.y];

    const fadeIntro = range(t, 0.06, 0.26);
    intro.style.opacity = String(1 - fadeIntro);
    intro.style.transform = `translate3d(0, ${-fadeIntro * 8}vh, 0)`;
    // the native film takes over on landing and leaves rising out of the frame. Before that it is already drawn,
    // just invisibly (opacity 0 would skip it, and its first real frame would stall the scroll at the hand-over)
    const handoff = range(t, 0.5, 0.56) * (t < 0.96 ? 1 : 0);
    player.style.opacity = String(t < 0.96 ? Math.max(0.002, handoff) : 0);
    player.inert = handoff < 0.5;
    player.style.transform = ex > 0 ? `translate(-50%, calc(-50% - ${rise.toFixed(1)}px)) scale(${sc.toFixed(4)})` : '';

    // the dark ground and its glow lift away; the capsule turns light once the edge has passed under it
    pin.style.setProperty('--lift', `${(lift * 100).toFixed(2)}%`);
    pin.style.setProperty('--ground', lift > 0.999 ? '0' : '1'); // swept away: drop the layer, no trace of its edge
    ambient.style.opacity = String(1 - lift);
    // (held every frame of the lift: the flow's own trigger fires as it slides under, while the top is still dark)
    if (t > 0.7 && t < 1) {
      const theme = lift > 0.86 ? 'light' : 'dark';
      if (nav.dataset.theme !== theme) nav.dataset.theme = theme;
      lastTheme = theme;
    } else if (lastTheme && t <= 0.7) {
      nav.dataset.theme = 'dark';
      lastTheme = '';
    }

    // PLAY ▶ REEL rides the panel; its letters arrive from far apart and settle one by one, then the button
    const r = s.rect;
    const rs = r.w / to.w;
    reel.style.opacity = String(range(t, 0.16, 0.26) * (1 - range(t, 0.74, 0.86)));
    reel.style.transform = `translate3d(${(r.x + r.w / 2 - reelSize[0] / 2).toFixed(1)}px, ${(r.y + r.h / 2 - reelSize[1] / 2).toFixed(1)}px, 0) scale(${rs.toFixed(4)})`;
    letters.forEach(({ el, d, side }) => {
      const g = out(range(t, 0.24 + d * 0.04, 0.46 + d * 0.04));
      el.style.transform = `translate3d(${(side * (1 - g) * (1.1 + d * 0.6)).toFixed(3)}em, ${((1 - g) * (d % 2 ? 0.2 : -0.2)).toFixed(3)}em, 0)`;
      el.style.opacity = String(0.2 + 0.8 * g);
    });
    const b = out(range(t, 0.42, 0.56)) * (1 - range(t, 0.74, 0.8));
    reelBtn.style.setProperty('--in', b.toFixed(3));
    reel.style.pointerEvents = b > 0.9 ? 'auto' : 'none';
    reel.tabIndex = b > 0.9 ? 0 : -1;
  }

  gsap.timeline({
    scrollTrigger: {
      trigger: pin,
      start: 'top top',
      end: () => `+=${PIN * window.innerHeight}`,
      pin: true,
      scrub: 0.8,
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
