import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';
// Gotham here is the subset embedded in the brand manual; Montserrat (closest open design) fills the few missing glyphs.
import '@fontsource/montserrat/latin-400.css';
import boltSvg from '../assets/bolt.svg?raw';
import { playIntro } from './intro.js';
import { initHero } from './hero.js';
import { initNav } from './nav.js';
import { initSections } from './sections.js';

gsap.registerPlugin(ScrollTrigger, SplitText);
// on phones the address bar shows and hides while scrolling: no full recalculation (and jump) every time it does
ScrollTrigger.config({ ignoreMobileResize: true });

const root = document.documentElement;
window.__upcReady = true;
const reduce = root.classList.contains('reduce-motion');
const finePointer = matchMedia('(pointer: fine)').matches;
const boltPaths = [...boltSvg.matchAll(/\sd="([^"]+)"/g)].map((m) => m[1]);

// Smooth scroll only where it helps: desktop pointers, motion allowed. Touch keeps native scrolling.
let lenis = null;
if (finePointer && !reduce) {
  lenis = new Lenis({ lerp: 0.1 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

// dev aid: ?slow=0.2 plays every animation at that speed
if (import.meta.env.DEV) {
  const slow = parseFloat(new URLSearchParams(location.search).get('slow'));
  if (slow) gsap.globalTimeline.timeScale(slow);
}

// fonts and the hero backdrop: what the first frame after the intro needs
const heroImg = document.querySelector('.hero__bg img');
const ready = Promise.race([
  Promise.all([document.fonts.ready, heroImg.decode().catch(() => {})]),
  new Promise((r) => setTimeout(r, 4000)),
]);

const nav = initNav({ lenis, reduce });
const hero = initHero({ svgText: boltSvg, reduce, finePointer, nav });
initSections({ reduce, lenis, finePointer });

(async () => {
  if (root.classList.contains('has-intro')) {
    lenis?.stop();
    window.scrollTo(0, 0);
    let revealed = false;
    try {
      await playIntro({ paths: boltPaths, svgText: boltSvg, ready, onReveal: () => { revealed = true; hero.enter(); } });
    } catch (e) {
      // the intro could not play (a chunk failed to load): never leave the page behind its veil
      document.querySelector('.intro')?.remove();
      if (!revealed) hero.enter();
    }
    try { sessionStorage.setItem('upc-intro', '1'); } catch (e) {}
    root.classList.remove('has-intro');
    lenis?.start();
  } else {
    await ready;
    hero.enter();
  }
  root.classList.remove('is-loading');
  ScrollTrigger.refresh();
})();
