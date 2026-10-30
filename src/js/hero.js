import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { handoff } from './handoff.js';

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
  const navEl = document.querySelector('.nav');
  const mirror = hero.querySelector('.hero__mirror');

  // ---- The mirror floor. Its line sits just under the resting mark (the same numbers as the mark's pose in
  //      bolt3d.js); the wordmark is lowered to stand on it, and the floor is painted with its reflection.
  const narrowNow = () => window.matchMedia('(max-width: 760px)').matches; // the CSS breakpoint, exactly
  const floorAt = () => (narrowNow() ? 0.625 : 0.8);
  let mirrorPainted = null;
  async function paintMirror() {
    await document.fonts.ready;
    const W = stage.clientWidth;
    const H = stage.clientHeight;
    if (!W || !H) return;
    const floor = floorAt() * H;
    set.style.setProperty('--floor', `${(floorAt() * 100).toFixed(2)}%`);
    const g = mirror.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const h = H - floor;
    mirror.width = Math.round(W * dpr);
    mirror.height = Math.round(h * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    // stand the wordmark on the floor: its baseline a hair above the line
    const line = hero.querySelector('.hero__word-outline');
    const cs = getComputedStyle(line);
    const fs = parseFloat(cs.fontSize);
    g.font = `${fs}px Ibrand`;
    const m = g.measureText('upclass');
    const lineH = parseFloat(cs.lineHeight) || fs * 0.8;
    // (by layout offsets, which no transform touches: the hand-over's rise and scale, the intro's zoom, the scroll)
    const own = new DOMMatrixReadOnly(cs.transform === 'none' ? undefined : cs.transform);
    const restY = word.offsetTop + line.offsetTop + own.m42;
    const baseline = restY + parseFloat(cs.paddingTop) + (lineH - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2 + m.fontBoundingBoxAscent;
    const gap = H * 0.006;
    const sink = (parseFloat(word.style.getPropertyValue('--sink')) || 0) + (floor - gap - baseline);
    word.style.setProperty('--sink', `${sink.toFixed(1)}px`);
    const textX = word.offsetLeft + line.offsetLeft + own.m41 + parseFloat(cs.paddingLeft);

    // the lacquer: deep indigo under the horizon, down to the page's ink
    const lacquer = g.createLinearGradient(0, 0, 0, h);
    lacquer.addColorStop(0, '#150c46');
    lacquer.addColorStop(0.4, '#080539');
    lacquer.addColorStop(1, '#000229');
    g.fillStyle = lacquer;
    g.fillRect(0, 0, W, h);
    // the colour the mark throws on it, pink to the left and blue to the right
    const pool = (x, col) => {
      g.save();
      g.translate(x, 0);
      g.scale(1, 0.2);
      const r = Math.min(H * 0.46, W * 0.3);
      const rg = g.createRadialGradient(0, 0, 0, 0, 0, r);
      rg.addColorStop(0, col);
      rg.addColorStop(1, 'rgba(0, 0, 0, 0)');
      g.fillStyle = rg;
      g.fillRect(-r, -r, r * 2, r * 2);
      g.restore();
    };
    pool(W * 0.47, 'rgba(252, 57, 206, 0.34)');
    pool(W * 0.53, 'rgba(63, 116, 255, 0.34)');

    // the wordmark's reflection: the light that lives in its letters and their outline, upside down, fading out
    const layer = document.createElement('canvas');
    layer.width = mirror.width;
    layer.height = mirror.height;
    const lg = layer.getContext('2d');
    lg.setTransform(dpr, 0, 0, dpr, 0, 0);
    lg.font = g.font;
    const flipped = (draw) => { lg.save(); lg.translate(textX, gap); lg.scale(1, -1); draw(); lg.restore(); };
    flipped(() => {
      const lit = lg.createLinearGradient(0, 0, m.width, 0);
      lit.addColorStop(0.08, '#80ffff');
      lit.addColorStop(0.38, '#063ff1');
      lit.addColorStop(0.58, '#8b3cf7');
      lit.addColorStop(0.82, '#fc39ce');
      lg.fillStyle = lit;
      lg.fillText('upclass', 0, 0);
    });
    // the lit letters glow only around the middle, as they do above the floor
    lg.globalCompositeOperation = 'destination-in';
    const spot = lg.createRadialGradient(W / 2, 0, 0, W / 2, 0, W * 0.3);
    spot.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
    spot.addColorStop(0.45, 'rgba(0, 0, 0, 0.2)');
    spot.addColorStop(1, 'rgba(0, 0, 0, 0)');
    lg.fillStyle = spot;
    lg.fillRect(0, 0, W, h);
    lg.globalCompositeOperation = 'source-over';
    flipped(() => {
      lg.lineWidth = 1;
      lg.strokeStyle = 'rgba(241, 239, 250, 0.2)';
      lg.strokeText('upclass', 0, 0);
    });
    // the further below the line, the fainter
    lg.globalCompositeOperation = 'destination-in';
    const fade = lg.createLinearGradient(0, 0, 0, fs * 0.85);
    fade.addColorStop(0, 'rgba(0, 0, 0, 0.62)');
    fade.addColorStop(0.5, 'rgba(0, 0, 0, 0.2)');
    fade.addColorStop(1, 'rgba(0, 0, 0, 0)');
    lg.fillStyle = fade;
    lg.fillRect(0, 0, W, h);
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(layer, 0, 0);
    g.restore();

    // the sheen of the lacquer just under the line, and the line itself: a hairline of the brand's light
    g.save();
    g.translate(W / 2, 0);
    g.scale(1, 0.12);
    const sheen = g.createRadialGradient(0, 0, 0, 0, 0, W * 0.42);
    sheen.addColorStop(0, 'rgba(170, 160, 255, 0.2)');
    sheen.addColorStop(1, 'rgba(170, 160, 255, 0)');
    g.fillStyle = sheen;
    g.fillRect(-W / 2, 0, W, W * 0.42);
    g.restore();
    const horizon = g.createLinearGradient(0, 0, W, 0);
    horizon.addColorStop(0.06, 'rgba(128, 255, 255, 0)');
    horizon.addColorStop(0.3, 'rgba(128, 255, 255, 0.28)');
    horizon.addColorStop(0.5, 'rgba(214, 196, 255, 0.78)');
    horizon.addColorStop(0.7, 'rgba(252, 57, 206, 0.32)');
    horizon.addColorStop(0.94, 'rgba(252, 57, 206, 0)');
    g.fillStyle = horizon;
    g.fillRect(0, 0, W, 1);
    mirrorPainted?.();
  }
  // repainted when the stage changes size (once it has settled: a window drag would otherwise repaint every frame)
  let paintTimer = 0;
  new ResizeObserver(() => { clearTimeout(paintTimer); paintTimer = setTimeout(paintMirror, 120); }).observe(stage);

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
    stage.addEventListener('pointermove', (e) => {
      const nx = e.clientX / window.innerWidth - 0.5;
      const ny = e.clientY / window.innerHeight - 0.5;
      bx(nx * -26);
      by(ny * -18);
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
  const PIN = 2.6; // screens
  const LIFT = [0.5, 0.93];
  const liftEase = gsap.parseEase('power1.inOut');
  const lift = (p) => liftEase(gsap.utils.clamp(0, 1, (p - LIFT[0]) / (LIFT[1] - LIFT[0])));
  const heroTl = gsap.timeline({
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
    .to(content, { y: () => -vh() * 0.12, opacity: 0, ease: 'power2.in', duration: 0.14 }, 0)
    .to(object, { opacity: 0, ease: 'power1.in', duration: 0.12 }, 0.02)
    // after the mirror has broken under it, the wordmark rises out of the frame and the stage goes dark
    .to(word, { y: () => -vh() * 1.15, scale: 1.12, ease: 'power2.in', duration: 0.42 }, 0.42)
    .to(word, { opacity: 0, ease: 'power1.in', duration: 0.16 }, 0.66)
    .to(set, { opacity: 0, ease: 'power1.in', duration: 0.2 }, 0.44)
    .to(bg, { scale: 1.06, opacity: 0, ease: 'power1.inOut', duration: 0.3 }, 0.44)
    .fromTo(ground, { yPercent: 0 }, { yPercent: -100, ease: liftEase, duration: LIFT[1] - LIFT[0] }, LIFT[0])
    // hold on the light frame so the scrub lag never shows a remnant of the hero when the pin lets go (and keep the
    // timeline exactly 1 long, so its time is the scroll progress the nav reads above)
    .to({}, { duration: 1 - LIFT[1] }, LIFT[1]);

  // ---- The flight. The mark rises a little off its mirror and dives through it — the mirror shatters (shatter.js) —
  //      sinks below the line, turns back up into the light while the curtain lifts, and then comes down the
  //      manifesto slowly, behind its words as they rise. It keeps going down to meet the film's bolt of light, stops
  //      exactly over it, and burns away into it: its light becomes the points (handoff.js, evolution.js).
  //      Every stop on the way is a scroll position taken from the sections themselves, and the path runs through
  //      them on a curve that is smooth in time (no change of speed at a stop). The scroll it follows is softened
  //      over time, so even a coarse wheel turns into a long, even glide; and since everything is a function of
  //      that scroll, stopping freezes it and going back plays it backwards.
  const floorEl = hero.querySelector('.hero__floor');
  const smooth = (a, b, v) => { const t = gsap.utils.clamp(0, 1, (v - a) / (b - a)); return t * t * (3 - 2 * t); };
  // the poses after the resting one [x, y, scale] (screen fractions): up off the mirror, through it, under it,
  // back up into the light, into the top of the manifesto, behind its words, down towards the film
  const poses = (home, narrow) => (narrow
    ? [[0.5, home.y - 0.05, 1.03], [0.5, home.y + 0.32, 0.95], [0.6, 0.88, 0.8], [0.3, 0.62, 0.62], [0.64, 0.2, 0.46], [0.5, 0.42, 0.6], [0.42, 0.78, 0.66]]
    : [[0.5, home.y - 0.06, 1.03], [0.5, home.y + 0.36, 0.95], [0.6, 0.94, 0.8], [0.3, 0.64, 0.64], [0.64, 0.2, 0.44], [0.5, 0.5, 0.6], [0.4, 0.86, 0.72]]);
  // when it reaches each pose: scroll positions (px), measured on every refresh
  let knots = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  const BURN = 0.75; // screens of scroll it burns away over, once the film's section is in place (within its LEAD)
  function measureKnots() {
    const H = window.innerHeight;
    const heroEnd = heroTl.scrollTrigger?.end ?? H * PIN;
    const evoST = ScrollTrigger.getById('evo');
    const evo = document.querySelector('.evo');
    const evoTop = evoST ? evoST.start : evo.getBoundingClientRect().top + window.scrollY;
    // on phones the manifesto is not pinned (it scrolls through in about a screen) and the film has no bolt of
    // light: the mark goes behind the words as they pass the middle and burns away before the film arrives
    // (lines: where the manifesto's words have risen, about 42% into its own timeline, see sections.js)
    const mST = ScrollTrigger.getById('manifesto');
    const lines = mST ? mST.start + (mST.end - mST.start) * 0.42 : heroEnd + 0.5 * H;
    const k = narrowNow()
      ? [0, 0.3 * H, 1.0 * H, 1.45 * H, 1.75 * H, lines - 0.3 * H, lines + 0.05 * H, lines + 0.25 * H, lines + 0.38 * H]
      : [0, 0.35 * H, 1.25 * H, 1.85 * H, 2.35 * H, heroEnd + 0.12 * H, heroEnd + 0.75 * H, evoTop - 0.6 * H, evoTop];
    for (let i = 1; i < k.length; i++) k[i] = Math.max(k[i], k[i - 1] + 0.1 * H); // always forwards
    knots = k;
  }
  ScrollTrigger.addEventListener('refresh', measureKnots);
  // a cubic Hermite curve through the poses, timed by the knots (tangents from the neighbours, divided by time),
  // resting at both ends
  function pathAt(pts, T) {
    const n = pts.length - 1;
    if (T <= knots[0]) return pts[0];
    if (T >= knots[n]) return pts[n];
    let i = 0;
    while (i < n - 1 && T > knots[i + 1]) i++;
    const t0 = knots[i];
    const t1 = knots[i + 1];
    const h = t1 - t0;
    const u = (T - t0) / h;
    const tan = (j) => (j <= 0 || j >= n ? pts[j].map(() => 0) : pts[j].map((v, c) => (pts[j + 1][c] - pts[j - 1][c]) / (knots[j + 1] - knots[j - 1])));
    const m0 = tan(i);
    const m1 = tan(i + 1);
    const u2 = u * u;
    const u3 = u2 * u;
    return pts[i].map((p0, c) => (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * h * m0[c] + (-2 * u3 + 3 * u2) * pts[i + 1][c] + (u3 - u2) * h * m1[c]);
  }
  // the film's bolt of light, as a pose (where the mark has to stop); on phones the film has no stage: it simply
  // burns away low on the screen
  function meeting(home) {
    const t = handoff.target?.();
    if (!t || !t.h) return [0.5, 0.75, 0.5];
    const VH = mark.clientHeight || window.innerHeight;
    return [(t.x + t.w / 2) / window.innerWidth, (t.y + t.h / 2) / VH, t.h / (home.h * VH)];
  }
  // behind the words: wherever the manifesto's title is on screen (it is pinned on wide screens, it scrolls on phones)
  function behindWords(p) {
    const r = title.getBoundingClientRect();
    return [p[0], gsap.utils.clamp(0.2, 0.8, (r.top + r.height * 0.55) / (mark.clientHeight || window.innerHeight)), p[2]];
  }
  const allPoses = (home) => {
    const ps = poses(home, narrowNow());
    ps[5] = behindWords(ps[5]);
    return [[home.x, home.y, 1], ...ps, meeting(home)];
  };

  let sy = 0; // the scroll as followed
  let parked = false;
  let broken = false;
  let hidden = false;
  // The break belongs to the scroll, not to the clock: it starts where the mark's tip reaches the mirror on its path
  // (found once per layout), and its shards are posed from how far the page has gone since — stop scrolling and
  // they hang in the air, scroll back and they fly back into the mirror.
  const BREAK_PER_SCREEN = 1.6; // seconds of the break's clock per screen of scroll
  let impact = Infinity;
  function findImpact() {
    const home = bolt.home();
    const pts = allPoses(home);
    for (let T = 0; T <= knots[3]; T += 2) {
      const p = pathAt(pts, T);
      if (p[1] + home.h * p[2] * 0.5 >= floorAt()) { impact = T; return; }
    }
  }
  ScrollTrigger.addEventListener('refresh', () => { if (bolt?.mirror.built) findImpact(); });

  // the manifesto's words stand in front of the mark: a copy of its title, laid exactly over it, above the mark's
  // layer (the real title stays underneath for everything else: reading, selecting, the screen reader)
  const title = document.querySelector('.manifesto__title');
  const titleTexts = [...title.querySelectorAll('.manifesto__text')];
  const cover = title.cloneNode(true);
  cover.removeAttribute('id');
  cover.setAttribute('aria-hidden', 'true');
  cover.classList.add('mark__cover');
  cover.style.visibility = 'hidden';
  const coverTexts = [...cover.querySelectorAll('.manifesto__text')];
  let coverOn = false;
  let titleSeen = false;
  new IntersectionObserver(([e]) => { titleSeen = e.isIntersecting; }).observe(title);
  function lay() {
    // (only once the hero's curtain is up, as drawn: until then the real title is under it)
    const on = titleSeen && heroTl.progress() >= 0.93;
    if (on !== coverOn) { coverOn = on; cover.style.visibility = on ? '' : 'hidden'; }
    if (!on) return;
    const r = title.getBoundingClientRect();
    cover.style.width = `${r.width}px`;
    cover.style.transform = `translate3d(${r.left.toFixed(1)}px, ${r.top.toFixed(1)}px, 0)`;
    titleTexts.forEach((el, i) => { coverTexts[i].style.transform = el.style.transform; });
  }

  let restAt = -1; // the scroll the frame was last computed for, while resting at either end of the way
  let shardsStale = false; // the floor was repainted while broken: recut the shards once it is whole again
  function fly(time, deltaMs) {
    if (!bolt) return;
    const dt = Math.min(0.05, deltaMs / 1000);
    const H = window.innerHeight;
    const VH = mark.clientHeight || H;
    // the followed scroll glides after the real one (time based, the same at any frame rate)
    sy += (window.scrollY - sy) * (1 - Math.exp(-dt * 3.4));
    if (Math.abs(window.scrollY - sy) < 0.3) sy = window.scrollY;
    const end = knots[knots.length - 1];
    const resting = sy === window.scrollY && (sy < 0.5 || parked);
    if (resting && restAt === sy) { if (coverOn) lay(); return; }
    restAt = resting ? sy : -1;
    if (sy < 0.5) {
      bolt.flight(null);
    } else {
      const home = bolt.home();
      const pts = allPoses(home);
      const [x, y, sc] = pathAt(pts, sy);
      const ahead = pathAt(pts, sy + H * 0.03)[0];
      const settle = 1 - smooth(knots[7], end, sy); // facing you, still, as it meets the bolt of light
      const spin = gsap.parseEase('sine.inOut')(gsap.utils.clamp(0, 1, sy / end));
      bolt.flight({
        x, y, s: sc,
        turn: spin * Math.PI * 6, // three full turns over the whole way: facing you again at the meeting
        bank: gsap.utils.clamp(-0.4, 0.4, -(ahead - x) * 12) * settle,
        idle: (1 - 0.7 * smooth(0, knots[3], sy)) * settle,
        refl: sy >= impact ? 0 : 1,
      });
      // the meeting: the mark burns away over its own box, and the points are born from it there
      const burn = gsap.utils.clamp(0, 1, (sy - end) / ((narrowNow() ? 0.45 : BURN) * H));
      const h = home.h * VH * sc;
      const w = h * home.aspect;
      handoff.from = { x: x * window.innerWidth - w / 2, y: y * VH - h / 2, w, h };
      handoff.gather = burn;
      bolt.dissolve(burn);
      // burnt away: one last (empty) frame, then nothing more to draw until the page comes back
      const gone = burn >= 1;
      if (gone !== parked) {
        parked = gone;
        if (gone) bolt.rig.render();
        bolt.hold(gone);
      }
    }
    broken = bolt.mirror.built && sy >= impact;
    if (shardsStale && !broken) { shardsStale = false; mirrorPainted(); }
    bolt.mirror.at(broken ? ((sy - impact) * BREAK_PER_SCREEN) / H : 0);
    // once broken, the painted floor is gone: the shards are the floor
    if (broken !== hidden) { hidden = broken; floorEl.style.visibility = broken ? 'hidden' : ''; }
    lay();
  }

  boltReady.then((b) => {
    if (!b?.home) return;
    handoff.active = true; // the film's points will be born from the mark
    document.body.append(cover);
    measureKnots();
    sy = window.scrollY; // a reload half way down starts there, instead of flying the whole way in a blink
    // the shards are cut from the painted floor, and recut whenever it is repainted (while the mirror is whole)
    mirrorPainted = () => {
      if (broken) { shardsStale = true; return; }
      b.mirror.build(mirror, floorAt(), 0.5);
      findImpact();
      restAt = -1;
    };
    if (mirror.width > 300) mirrorPainted(); // (painted already: cut it now)
    gsap.ticker.add(fly);
  });
  ScrollTrigger.addEventListener('refresh', () => { restAt = -1; });

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
    boltReady.then((b) => b && b.appear && b.appear());
    return tl;
  }

  return { enter };
}
