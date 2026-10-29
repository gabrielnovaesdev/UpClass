import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch (e) {
    return false;
  }
}

export function initHero({ svgText, reduce, finePointer, nav }) {
  const hero = document.querySelector('.hero');
  const stage = hero.querySelector('.hero__stage');
  const bg = hero.querySelector('.hero__bg');
  const word = hero.querySelector('.hero__word');
  const wordLines = hero.querySelectorAll('.hero__word-line');
  const mark = document.querySelector('.mark');
  const canvas3d = mark.querySelector('.mark__gl');
  const set = hero.querySelector('.hero__set');
  const words = hero.querySelectorAll('[data-words]');
  const scrollCue = hero.querySelector('.hero__scroll');
  const navEl = document.querySelector('.nav');

  if (reduce) {
    return { enter() {} };
  }

  // the outline wordmark rises letter by letter; the lit copy fades in as one layer
  // (background-clip:text breaks on transformed child spans, so it is never split)
  const wordLit = hero.querySelector('.hero__word-lit');
  const charSets = [SplitText.create(hero.querySelector('.hero__word-outline'), { type: 'chars' }).chars];
  gsap.set(wordLit, { autoAlpha: 0 });
  const wordSplits = [...words].map((el) => SplitText.create(el, { type: 'words' }));
  gsap.set(charSets, { yPercent: 18, autoAlpha: 0 });
  gsap.set(wordSplits.map((s) => s.words), { autoAlpha: 0 });
  gsap.set([...wordLines, ...words], { visibility: 'visible' });
  gsap.set(scrollCue, { autoAlpha: 0 });
  gsap.set(navEl, { autoAlpha: 0, y: -12 });

  // ---- 3D bolt (loaded lazily so the first paint never waits on three.js)
  let bolt = null;
  const boltReady = hasWebGL()
    ? import('./bolt3d.js')
        .then(({ createBolt }) => createBolt(canvas3d, svgText, { host: mark, mode: 'hero' }))
        .then((b) => (bolt = b))
        .catch(() => document.documentElement.classList.add('no-webgl'))
    : Promise.resolve(document.documentElement.classList.add('no-webgl'));

  // ---- Light that follows the cursor across the wordmark; it rests behind the bolt when idle
  // (it repaints the whole wordmark, so only while the light is actually moving, and never during the hand-over)
  const light = { x: 50, y: 52, tx: 50, ty: 52 };
  let leaving = false;
  gsap.ticker.add(() => {
    if (leaving || (Math.abs(light.tx - light.x) < 0.02 && Math.abs(light.ty - light.y) < 0.02)) return;
    light.x += (light.tx - light.x) * 0.08;
    light.y += (light.ty - light.y) * 0.08;
    word.style.setProperty('--mx', `${light.x.toFixed(2)}%`);
    word.style.setProperty('--my', `${light.y.toFixed(2)}%`);
  });

  if (finePointer) {
    const bx = gsap.quickTo(bg, 'x', { duration: 1.6, ease: 'power3.out' });
    const by = gsap.quickTo(bg, 'y', { duration: 1.6, ease: 'power3.out' });
    const wx = gsap.quickTo(word, 'x', { duration: 1.8, ease: 'power3.out' });
    stage.addEventListener('pointermove', (e) => {
      const nx = e.clientX / window.innerWidth - 0.5;
      const ny = e.clientY / window.innerHeight - 0.5;
      bx(nx * -26);
      by(ny * -18);
      wx(nx * -14); // the wordmark drifts against the bolt: two depths
      light.tx = (e.clientX / window.innerWidth) * 100;
      light.ty = (e.clientY / window.innerHeight) * 100;
      bolt?.pointer(nx, ny);
    });
    stage.addEventListener('pointerleave', () => {
      light.tx = 50;
      light.ty = 52;
      bolt?.pointer(0, 0);
    });
  }

  // ---- Scroll: the hand-over to the manifesto, in the language of the film section's way out.
  //      1. the copy goes, the wordmark and the bolt rise out of the frame (the bolt finishing its turn), and the glow
  //         behind them goes down to the plain dark ground — dark on dark, never a grey wash;
  //      2. the dark curtain lifts away under its soft edge (a transform, no repaint) and the manifesto, already
  //         waiting underneath on the light mist (sections.js, manifesto()), is simply there.
  //      Everything that moves is its own layer and moves by transform and opacity only.
  const object = hero.querySelector('.hero__object');
  const content = hero.querySelector('.hero__content');
  const ground = hero.querySelector('.hero__ground');
  const vh = () => window.innerHeight;
  // The curtain starts as soon as the manifesto sits fully under the screen (the last screen of the pin, see
  // .motion .manifesto: from 0.7 / 1.7 on); its edge comes up from below while the bolt is still leaving at the top.
  const PIN = 1.7; // screens
  const LIFT = [0.42, 0.92];
  const liftEase = gsap.parseEase('power1.inOut');
  const lift = (p) => liftEase(gsap.utils.clamp(0, 1, (p - LIFT[0]) / (LIFT[1] - LIFT[0])));
  gsap.timeline({
    scrollTrigger: {
      trigger: hero,
      start: 'top top',
      end: () => `+=${vh() * PIN}`,
      pin: true,
      scrub: finePointer ? 0.6 : 0.3,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        const p = self.progress;
        if (leaving !== p > 0.01) { leaving = p > 0.01; hero.classList.toggle('is-leaving', leaving); }
        // the capsule turns light once the curtain's edge has passed under it
        nav.setTheme(lift(p) > 0.75 ? 'light' : 'dark');
      },
    },
  })
    // (opacity, not autoAlpha: flipping visibility at zero rebuilds the layers mid-scroll and costs a frame)
    .to(content, { y: () => -vh() * 0.16, opacity: 0, ease: 'power2.in', duration: 0.24 }, 0)
    .to(word, { y: () => -vh() * 1.15, scale: 1.12, ease: 'power2.in', duration: 0.6 }, 0.02)
    .to(word, { opacity: 0, ease: 'power1.in', duration: 0.2 }, 0.42)
    .to(object, { opacity: 0, ease: 'power1.in', duration: 0.2 }, 0.04)
    .to(set, { opacity: 0, ease: 'power1.in', duration: 0.3 }, 0.08)
    .to(bg, { scale: 1.06, opacity: 0, ease: 'power1.inOut', duration: 0.32 }, 0.24)
    .fromTo(ground, { yPercent: 0 }, { yPercent: -100, ease: liftEase, duration: LIFT[1] - LIFT[0] }, LIFT[0])
    // hold on the light frame so the scrub lag never shows a remnant of the hero when the pin lets go (and keep the
    // timeline exactly 1 long, so its time is the scroll progress the nav reads above)
    .to({}, { duration: 1 - LIFT[1] }, LIFT[1]);

  // ---- The flight: the mark lifts off its floor, sweeps across the screen while the curtain lifts, and comes down to
  //      the end of the manifesto's last line (.manifesto__seat), as large as its capitals. From there it stays with
  //      the line and leaves with the page. Driven by the scroll (eased a little, so a coarse wheel still glides).
  const seat = document.querySelector('.manifesto__seat');
  const LAND = 0.46; // where it lands in the manifesto's own timeline (sections.js), just after the last line rose
  const smooth = (a, b, v) => { const t = gsap.utils.clamp(0, 1, (v - a) / (b - a)); return t * t * (3 - 2 * t); };
  // the path in screen fractions: off its floor up to the right, across to the left, then down into the seat
  const WAY = window.matchMedia('(max-width: 760px)').matches
    ? [[0.72, 0.3, 0.8], [0.3, 0.44, 0.55]]
    : [[0.73, 0.34, 0.78], [0.28, 0.5, 0.5]];
  const catmull = (a, b, c, d, t) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  function along(pts, u, k) {
    const n = pts.length - 1;
    const i = Math.min(n - 1, Math.floor(u * n));
    const t = u * n - i;
    const at = (j) => pts[gsap.utils.clamp(0, n, j)][k];
    return catmull(at(i - 1), at(i), at(i + 1), at(i + 2), t);
  }
  let landScroll = 1;
  const measureLand = () => {
    const st = ScrollTrigger.getById('manifesto');
    landScroll = st ? st.start + (st.end - st.start) * LAND : window.innerHeight * 2.4;
  };
  ScrollTrigger.addEventListener('refresh', measureLand);
  let fp = 0; // flight progress as drawn
  let parked = false;
  function fly() {
    if (!bolt) return;
    fp += (gsap.utils.clamp(0, 1, window.scrollY / landScroll) - fp) * 0.18;
    if (fp < 0.0005) { bolt.flight(null); return; }
    const home = bolt.home();
    const r = seat.getBoundingClientRect();
    const W = window.innerWidth;
    const H = window.innerHeight;
    const end = [(r.left + r.width / 2) / W, (r.top + r.height / 2) / H, r.height / (home.h * H)];
    const pts = [[home.x, home.y, 1], ...WAY, end];
    const u = gsap.parseEase('power1.inOut')(fp);
    const x = along(pts, u, 0);
    const y = along(pts, u, 1);
    const ahead = along(pts, Math.min(1, u + 0.01), 0);
    bolt.flight({
      x, y,
      s: along(pts, u, 2),
      turn: u * Math.PI * 4, // two full turns on the way, facing you again as it lands
      bank: gsap.utils.clamp(-0.45, 0.45, -(ahead - x) * 14),
      idle: 1 - 0.75 * smooth(0, 0.6, fp),
      refl: 1 - smooth(0, 0.14, fp),
    });
    // once it has left the top of the screen with the page, nothing more to draw
    const away = fp > 0.985 && r.bottom < -40;
    if (away !== parked) { parked = away; bolt.hold(away); }
  }
  gsap.ticker.add(fly);

  // the floor line sits just under the resting mark: the stage's horizon follows it at any screen size
  boltReady.then((b) => {
    if (!b?.home) return;
    document.documentElement.classList.add('flight'); // the seat's flat mark gives way to the flying one
    const place = () => { const h = b.home(); stage.style.setProperty('--floor', `${((h.y + h.h / 2 + 0.035) * 100).toFixed(2)}%`); };
    place();
    new ResizeObserver(place).observe(mark);
  });

  // ---- Entrance (after the intro, or immediately on return visits)
  function enter() {
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    charSets.forEach((chars) => {
      tl.to(chars, { yPercent: 0, autoAlpha: 1, duration: 1.6, stagger: { each: 0.06, from: 'center' } }, 0);
    });
    tl.to(wordLit, { autoAlpha: 0.8, duration: 1.8, ease: 'power2.out' }, 0.6)
      .to(navEl, { autoAlpha: 1, y: 0, duration: 1.2 }, 0.25);
    wordSplits.forEach((s, i) => {
      tl.to(s.words, { autoAlpha: 1, duration: 0.5, ease: 'power2.out', stagger: { each: 0.025, from: 'random' } }, 0.45 + i * 0.08);
    });
    tl.to(scrollCue, { autoAlpha: 1, duration: 1 }, 1);
    boltReady.then((b) => b && b.appear && b.appear());
    return tl;
  }

  return { enter };
}
