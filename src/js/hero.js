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

  // ---- Scroll: the hero pins and the bolt makes a full turn; then everything travels up with the scroll — the wordmark
  //      comes closer and rises out of the frame, the bolt follows it, the dark ground lifts away — and the manifesto,
  //      already waiting underneath on the light mist, rises into place (its half lives in sections.js, manifesto()).
  //      A short scrub keeps it close to the finger and the wheel.
  const object = hero.querySelector('.hero__object');
  const content = hero.querySelector('.hero__content');
  const vh = () => window.innerHeight;
  gsap.set(word, { '--stroke': 'rgba(241, 239, 250, 0.24)' });
  gsap.timeline({
    scrollTrigger: {
      trigger: hero,
      start: 'top top',
      end: () => `+=${vh() * 1.5}`,
      pin: true,
      scrub: finePointer ? 0.35 : 0.2,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        bolt?.scroll(self.progress);
        nav.setTheme(self.progress > 0.6 ? 'light' : 'dark');
      },
    },
  })
    .to(bg, { scale: 1.1, ease: 'none', duration: 1 }, 0)
    .to(content, { y: () => -vh() * 0.3, autoAlpha: 0, ease: 'power1.in', duration: 0.38 }, 0)
    .to(word, { y: () => -vh() * 1.1, scale: 1.6, ease: 'power2.in', duration: 0.9 }, 0)
    .to(object, { y: () => -vh() * 1.25, scale: 1.3, ease: 'power2.in', duration: 0.86 }, 0.06)
    // the dark ground lifts away under a soft edge (no grey cross-fade): the light manifesto shows from the bottom
    // (it starts once the manifesto sits fully under the screen: a third of the pin, see .motion .manifesto)
    .set(stage, { backgroundColor: 'rgba(0, 2, 41, 0)' }, 0.42)
    .fromTo(bg, { '--lift': '0%' }, { '--lift': '100%', ease: 'power1.inOut', duration: 0.48 }, 0.42)
    .set(bg, { autoAlpha: 0 }, 0.9) // swept away: drop the layer so its composited edge leaves no trace
    .to(stage, { '--grain': 0, ease: 'none', duration: 0.4 }, 0.44)
    .to(word, { '--stroke': 'rgba(0, 2, 41, 0.3)', ease: 'none', duration: 0.4 }, 0.46)
    // hold on the empty, light frame so the scrub lag never shows a remnant of the hero when the pin lets go
    .to({}, { duration: 0.22 });

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
