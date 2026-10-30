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
  const navEl = document.querySelector('.nav');
  const mirror = hero.querySelector('.hero__mirror');

  // ---- The mirror floor. Its line sits just under the resting mark (the same numbers as the mark's pose in
  //      bolt3d.js); the wordmark is lowered to stand on it, and the floor is painted with its reflection.
  const floorAt = () => (stage.clientWidth < 760 ? 0.625 : 0.8);
  let mirrorDirty = true;
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
    const rect = line.getBoundingClientRect();
    const restY = rect.top - (gsap.getProperty(word, 'y') || 0) - stage.getBoundingClientRect().top;
    const baseline = restY + parseFloat(cs.paddingTop) + (lineH - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2 + m.fontBoundingBoxAscent;
    const gap = H * 0.006;
    const sink = (parseFloat(word.style.getPropertyValue('--sink')) || 0) + (floor - gap - baseline);
    word.style.setProperty('--sink', `${sink.toFixed(1)}px`);
    const textX = rect.left - (gsap.getProperty(word, 'x') || 0) + parseFloat(cs.paddingLeft);

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
    mirrorDirty = false;
    mirrorPainted?.();
  }
  // repainted at rest only (the wordmark has to be in its place to be measured)
  new ResizeObserver(() => { if (window.scrollY < 4) paintMirror(); else mirrorDirty = true; }).observe(stage);

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

  // ---- The flight: the mark rises a little off its mirror, dives through it — the mirror shatters and its shards
  //      fall (shatter.js) — sinks below the line, then turns back up into the light while the curtain lifts, sweeps
  //      across the screen and comes down to the end of the manifesto's last line (.manifesto__seat), as large as its
  //      capitals. From there it stays with the line and leaves with the page. It follows the scroll, softened over
  //      time, so even a coarse wheel turns into a long, even glide.
  const seat = document.querySelector('.manifesto__seat');
  const floorEl = hero.querySelector('.hero__floor');
  const LAND = 0.46; // where it lands in the manifesto's own timeline (sections.js), just after the last line rose
  const smooth = (a, b, v) => { const t = gsap.utils.clamp(0, 1, (v - a) / (b - a)); return t * t * (3 - 2 * t); };
  // the way, in screen fractions [x, y, scale], after the resting pose and before the seat
  const way = (home) => (stage.clientWidth < 760
    ? [[0.5, home.y - 0.05, 1.03], [0.5, home.y + 0.32, 0.95], [0.6, 0.88, 0.8], [0.3, 0.64, 0.62], [0.66, 0.42, 0.5]]
    : [[0.5, home.y - 0.06, 1.03], [0.5, home.y + 0.36, 0.95], [0.6, 0.94, 0.8], [0.29, 0.66, 0.64], [0.66, 0.42, 0.52]]);
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
    landScroll = st ? st.start + (st.end - st.start) * LAND : window.innerHeight * 3.2;
  };
  ScrollTrigger.addEventListener('refresh', measureLand);
  const inOut = gsap.parseEase('sine.inOut');
  let fp = 0; // flight progress as drawn
  let parked = false;
  let broken = false;
  let hidden = false;
  // The break belongs to the scroll, not to the clock: it starts where the mark's tip reaches the mirror on its path
  // (found once per layout, so it never depends on where the mark happens to be later on its way), and its shards
  // are posed from how far the page has gone since — stop scrolling and they hang in the air, scroll back and they
  // fly back into the mirror.
  const BREAK_PER_SCREEN = 1.6; // seconds of the break's clock per screen of scroll
  let impactFp = 1;
  function findImpact() {
    const home = bolt.home();
    const pts = [[home.x, home.y, 1], ...way(home), [0.5, 0.4, 0.3]]; // (the seat does not reach this part of the path)
    for (let f = 0; f <= 0.8; f += 0.0005) {
      const u = inOut(f);
      if (along(pts, u, 1) + home.h * along(pts, u, 2) * 0.5 >= floorAt()) { impactFp = f; return; }
    }
  }
  function fly(time, deltaMs) {
    if (!bolt) return;
    const dt = Math.min(0.05, deltaMs / 1000);
    // the drawn progress glides after the scroll (time based, the same at any frame rate)
    const target = gsap.utils.clamp(0, 1, window.scrollY / landScroll);
    fp += (target - fp) * (1 - Math.exp(-dt * 3.4));
    if (Math.abs(target - fp) < 0.00005) fp = target;
    if (fp < 0.0005) {
      bolt.flight(null);
      if (mirrorDirty && window.scrollY < 4) paintMirror();
    } else {
      const home = bolt.home();
      const r = seat.getBoundingClientRect();
      const W = window.innerWidth;
      const H = window.innerHeight;
      const end = [(r.left + r.width / 2) / W, (r.top + r.height / 2) / H, r.height / (home.h * H)];
      const pts = [[home.x, home.y, 1], ...way(home), end];
      const u = inOut(fp);
      const x = along(pts, u, 0);
      const y = along(pts, u, 1);
      const sc = along(pts, u, 2);
      const ahead = along(pts, Math.min(1, u + 0.01), 0);
      bolt.flight({
        x, y, s: sc,
        turn: u * Math.PI * 4, // two full turns on the way, facing you again as it lands
        bank: gsap.utils.clamp(-0.4, 0.4, -(ahead - x) * 12),
        idle: 1 - 0.75 * smooth(0, 0.5, fp),
        refl: fp >= impactFp ? 0 : 1,
      });
      // once it has left the top of the screen with the page, nothing more to draw
      const away = fp > 0.985 && r.bottom < -40;
      if (away !== parked) { parked = away; bolt.hold(away); }
    }
    broken = bolt.mirror.built && fp >= impactFp;
    bolt.mirror.at(broken ? ((fp - impactFp) * landScroll * BREAK_PER_SCREEN) / window.innerHeight : 0);
    // once broken, the painted floor is gone: the shards are the floor
    if (broken !== hidden) { hidden = broken; floorEl.style.visibility = broken ? 'hidden' : ''; }
  }

  boltReady.then((b) => {
    if (!b?.home) return;
    document.documentElement.classList.add('flight'); // the seat's flat mark gives way to the flying one
    // the shards are cut from the painted floor, and recut whenever it is repainted (while the mirror is whole)
    mirrorPainted = () => { if (!broken) { b.mirror.build(mirror, floorAt(), 0.5); findImpact(); } };
    if (!mirrorDirty) mirrorPainted();
    gsap.ticker.add(fly);
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
    boltReady.then((b) => b && b.appear && b.appear());
    return tl;
  }

  return { enter };
}
