import gsap from 'gsap';
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
  const canvas3d = hero.querySelector('.hero__3d');
  const words = hero.querySelectorAll('[data-words]');
  const scrollCue = hero.querySelector('.hero__scroll');
  const wipe = hero.querySelector('.wipe');
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
        .then(({ createBolt }) => createBolt(canvas3d, svgText, { host: stage, mode: 'hero' }))
        .then((b) => (bolt = b))
        .catch(() => document.documentElement.classList.add('no-webgl'))
    : Promise.resolve(document.documentElement.classList.add('no-webgl'));

  // ---- Light that follows the cursor across the wordmark; it rests behind the bolt when idle
  const light = { x: 50, y: 52, tx: 50, ty: 52 };
  gsap.ticker.add(() => {
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

  // ---- Pixel wipe cells, ordered bottom-up with a little scatter so the edge reads as a staircase
  function buildWipe(cols, rows) {
    wipe.style.setProperty('--cols', cols);
    wipe.style.setProperty('--rows', rows);
    wipe.innerHTML = '';
    const cells = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = document.createElement('i');
        i.style.transformOrigin = (r + c) % 2 ? 'left' : 'right';
        wipe.appendChild(i);
        const scatter = ((c * 7 + r * 3) % 5) / 5; // deterministic, no Math.random flicker on refresh
        cells.push({ el: i, order: (rows - 1 - r) * 0.9 + scatter * 1.4 + (c % 2) * 0.3 });
      }
    }
    return cells.sort((a, b) => a.order - b.order).map((c) => c.el);
  }

  // ---- Scroll: hero pins, the bolt makes a full turn, the wordmark opens up, then the next section tiles in
  const mm = gsap.matchMedia();
  mm.add({ wide: '(min-width: 901px)', narrow: '(max-width: 900px)' }, (ctx) => {
    const cells = ctx.conditions.wide ? buildWipe(5, 3) : buildWipe(3, 4);
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: hero,
        start: 'top top',
        end: () => `+=${window.innerHeight * 1.5}`,
        pin: true,
        scrub: 0.5,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          bolt?.scroll(self.progress);
          nav.setTheme(self.progress > 0.74 ? 'light' : 'dark');
        },
      },
    });
    tl.to(bg, { scale: 1.08, yPercent: -3, ease: 'none', duration: 1 }, 0)
      .to(word, { scale: 1.14, autoAlpha: 0.35, ease: 'none', duration: 0.8 }, 0)
      .to('.hero__content', { yPercent: -4, autoAlpha: 0.4, ease: 'none', duration: 0.8 }, 0)
      .to(cells, { scaleX: 1, ease: 'power2.inOut', duration: 0.2, stagger: { each: 0.026 } }, 0.38)
      // hold on the fully tiled frame so the scrub lag never lets the hero peek out when the pin releases
      .to({}, { duration: 0.3 });
    return () => { wipe.innerHTML = ''; };
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
