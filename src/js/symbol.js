import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import svgText from '../assets/bolt.svg?raw';
import { canRunGL } from './evo-section.js';

/*
 * 03 · O símbolo — the anatomy of the mark.
 * The 3D bolt from the hero (bolt3d.js, mode 'symbol') is taken apart in four chapters, each one a meaning
 * from the brand book: its construction (the outline is drawn over the mark), the two bolts (they separate
 * in depth and turn under a sweeping light), the arrows built into them (each bolt slides along its own
 * arrow) and the phone hidden between them (drawn in the gap). The SVG overlay is re-projected from the 3D
 * pose every frame, so the annotations stay locked to the object.
 * Desktop: the scroll drives a pinned timeline. Phones, reduced motion and weak devices: the chapter buttons
 * drive the same states without a pin (and without WebGL where it would not run well).
 */

// logo viewBox, as in bolt3d.js (kept here so this module does not pull three.js into the main chunk)
const VB_W = 323.2;
const VB_H = 553.99;
const BOX = [[117, 0, 323.2, 333], [0, 217, 206.4, 553.99]]; // each bolt's own frame for the trace
const PHONE = { x: 117, y: 193, w: 90, h: 160, rx: 16, notch: { x: 149, y: 202, w: 26, h: 7 } };
// the arrows embedded in each bolt: up through the upper one, down through the lower one
const ARROWS = [
  { bolt: 0, shaft: [[232, 150], [232, -30]], head: [[214, -10], [232, -30], [250, -10]] },
  { bolt: 1, shaft: [[92, 404], [92, 584]], head: [[74, 564], [92, 584], [110, 564]] },
];
// where each chapter's tag points: [x, y, bolt] (bolt null = the whole mark)
const ANCHORS = [[316.5, 185.8, 0], [236.8, 28, 0], [232, -30, 0], [207, 273, null]];
const REST = [0.2, 0.42, 0.66, 0.92]; // timeline position where each chapter reads best
const SEP = 70; // depth between the bolts in chapter 2, in logo units
const SLIDE = 34; // travel along the arrows in chapter 3

const clamp01 = gsap.utils.clamp(0, 1);
const range = (t, a, b) => clamp01((t - a) / (b - a));
const inOut = gsap.parseEase('power2.inOut');
const out = gsap.parseEase('power3.out');
const NS = 'http://www.w3.org/2000/svg';

export function initSymbol({ reduce, lenis, wide }) {
  const section = document.querySelector('.sym');
  const pin = section.querySelector('.sym__pin');
  const stage = section.querySelector('.sym__stage');
  const canvas = section.querySelector('.sym__gl');
  const img = section.querySelector('.sym__fallback');
  const overlay = section.querySelector('.sym__overlay');
  const trace = overlay.querySelector('.sym__trace');
  const arrowPaths = [...overlay.querySelectorAll('.sym__arrow')];
  const phoneG = overlay.querySelector('.sym__phone');
  const lead = overlay.querySelector('.sym__lead');
  const tag = section.querySelector('.sym__tag');
  const tagText = section.querySelector('.sym__tag-text');
  const items = [...section.querySelectorAll('.sym__chapter')];

  const gl = !reduce && canRunGL();
  const pinned = gl && wide;
  section.classList.toggle('is-flat', !gl);
  section.classList.toggle('is-pinned', pinned);

  // ---- overlay geometry, built once from the logo itself
  const shapes = [...new DOMParser().parseFromString(svgText, 'image/svg+xml').querySelectorAll('path')].map((p) => p.getAttribute('d'));
  const traceGroups = shapes.map((d) => {
    const g = document.createElementNS(NS, 'g');
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    p.setAttribute('pathLength', '1');
    g.append(p);
    trace.append(g);
    return g;
  });
  const [body, notch] = phoneG.querySelectorAll('rect');
  Object.entries({ x: PHONE.x, y: PHONE.y, width: PHONE.w, height: PHONE.h, rx: PHONE.rx }).forEach(([k, v]) => body.setAttribute(k, v));
  Object.entries({ x: PHONE.notch.x, y: PHONE.notch.y, width: PHONE.notch.w, height: PHONE.notch.h, rx: 3.5 }).forEach(([k, v]) => notch.setAttribute(k, v));
  [body, notch, ...arrowPaths].forEach((el) => el.setAttribute('pathLength', '1'));

  // ---- projection: logo units → stage pixels, from the live 3D pose or from the flat artwork
  let rig = null;
  let imgRect = { x: 0, y: 0, w: 1, h: 1 };
  const measure = () => {
    const s = stage.getBoundingClientRect();
    const r = img.getBoundingClientRect();
    imgRect = { x: r.left - s.left, y: r.top - s.top, w: r.width, h: r.height };
  };
  const offsets = [{ y: 0 }, { y: 0 }]; // flat mode echo of the chapter-3 slide
  const project = (x, y, b = null) => {
    if (rig) return rig.project(x, y, b == null ? null : rig.bolts[b]);
    const dy = b == null ? 0 : offsets[b].y;
    return [imgRect.x + (x / VB_W) * imgRect.w, imgRect.y + ((y + dy) / VB_H) * imgRect.h];
  };
  // an affine frame from three projected corners: exact head-on, close enough for the small tilts used here
  function frame(g, b, x0, y0, x1, y1) {
    const o = project(x0, y0, b);
    const a = project(x1, y0, b);
    const c = project(x0, y1, b);
    const ma = [(a[0] - o[0]) / (x1 - x0), (a[1] - o[1]) / (x1 - x0)];
    const mc = [(c[0] - o[0]) / (y1 - y0), (c[1] - o[1]) / (y1 - y0)];
    const e = [o[0] - x0 * ma[0] - y0 * mc[0], o[1] - x0 * ma[1] - y0 * mc[1]];
    g.setAttribute('transform', `matrix(${ma[0]} ${ma[1]} ${mc[0]} ${mc[1]} ${e[0]} ${e[1]})`);
  }
  const pt = (p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;

  // ---- state
  const state = { t: pinned ? 0 : 0.02 };
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  let chapter = -1;
  let tagSize = [0, 0];

  function setChapter(c) {
    if (c === chapter) return;
    chapter = c;
    items.forEach((li, k) => {
      li.classList.toggle('is-active', k === c);
      li.querySelector('button').setAttribute('aria-pressed', String(k === c));
    });
    tagText.textContent = items[c].dataset.tag;
    tagSize = [tag.offsetWidth, tag.offsetHeight];
  }

  function paint() {
    const t = state.t;
    const probe = project(0, 0, 0);
    if (!Number.isFinite(probe[0]) || !Number.isFinite(probe[1])) return; // layout or 3D pose not ready yet
    pointer.sx += (pointer.x - pointer.sx) * 0.06;
    pointer.sy += (pointer.y - pointer.sy) * 0.06;
    setChapter(Math.min(3, Math.floor(t * 4)));

    const draw = out(range(t, 0.02, 0.18));
    const traceOn = 1 - range(t, 0.24, 0.3);
    const sep = inOut(range(t, 0.26, 0.36)) * (1 - inOut(range(t, 0.46, 0.54)));
    const slide = inOut(range(t, 0.54, 0.62)) * (1 - inOut(range(t, 0.72, 0.8)));
    const arrows = out(range(t, 0.56, 0.66)) * (1 - range(t, 0.74, 0.78));
    const phone = out(range(t, 0.8, 0.92));
    const solid = 0.18 + 0.82 * range(t, 0.06, 0.2); // the outline comes first, then the body fills it

    if (rig) {
      const [up, lo] = rig.bolts;
      up.position.set(up.userData.home.x, up.userData.home.y - SLIDE * slide, up.userData.home.z + SEP * sep);
      lo.position.set(lo.userData.home.x, lo.userData.home.y + SLIDE * slide, lo.userData.home.z - SEP * sep);
      rig.spin.rotation.set(-sep * 0.1 + pointer.sy * 0.1, sep * 0.62 + pointer.sx * 0.18, 0);
      // the key light sweeps across while the bolts stand apart, and leans towards the cursor
      rig.key.position.x = -4 + 6 * Math.sin(Math.PI * range(t, 0.24, 0.54)) + pointer.sx * 2;
      rig.key.position.y = 4.5 - pointer.sy * 2;
      canvas.style.opacity = String(solid);
    } else {
      offsets[0].y = -SLIDE * slide;
      offsets[1].y = SLIDE * slide;
      img.style.opacity = String(solid);
    }

    traceGroups.forEach((g, b) => frame(g, b, ...BOX[b]));
    trace.style.opacity = String(traceOn);
    trace.style.strokeDashoffset = String(1 - draw);
    ARROWS.forEach((a, i) => {
      const [s0, s1] = a.shaft.map(([x, y]) => project(x, y, a.bolt));
      const h = a.head.map(([x, y]) => project(x, y, a.bolt));
      arrowPaths[i].setAttribute('d', `M${pt(s0)} L${pt(s1)} M${pt(h[0])} L${pt(h[1])} L${pt(h[2])}`);
      arrowPaths[i].style.strokeDashoffset = String(1 - arrows);
    });
    frame(phoneG, null, PHONE.x, PHONE.y, PHONE.x + PHONE.w, PHONE.y + PHONE.h);
    phoneG.style.strokeDashoffset = String(1 - phone);
    phoneG.style.setProperty('--fill', String(range(t, 0.88, 0.96)));

    // the tag: its own window inside each chapter, tied to its anchor by a hairline
    const local = t * 4 - chapter;
    const vis = range(local, 0.3, 0.55) * (chapter === 3 ? 1 : 1 - range(local, 0.88, 1));
    const [ax, ay, ab] = ANCHORS[chapter];
    const [px, py] = project(ax, ay, ab);
    const W = stage.clientWidth;
    const H = stage.clientHeight;
    const [tw, th] = tagSize;
    let tx;
    let ty;
    let lx;
    let ly;
    if (W < 760) {
      // phones: the tag sits under the mark, no leader line across it
      tx = (W - tw) / 2;
      ty = H - th;
      lead.style.opacity = '0';
    } else {
      // clear of the mark itself, and of the menu bar
      const right = Math.max(px, project(VB_W, VB_H / 2)[0]) + 48;
      const flip = right + tw > W - 16;
      tx = flip ? px - 56 - tw : right;
      ty = Math.min(H - th - 16, Math.max(96, py - 56 - th / 2));
      lx = flip ? tx + tw : tx;
      ly = ty + th / 2;
      lead.setAttribute('d', `M${px.toFixed(1)} ${py.toFixed(1)} L${lx.toFixed(1)} ${ly.toFixed(1)}`);
      lead.style.opacity = String(vis);
    }
    tag.style.opacity = String(vis);
    tag.style.transform = `translate3d(${tx.toFixed(1)}px, ${(ty + (1 - vis) * 8).toFixed(1)}px, 0)`;
  }

  // ---- chapters: buttons everywhere; on desktop they scroll to the chapter, elsewhere they animate to it
  let st = null;
  items.forEach((li, i) =>
    li.querySelector('button').addEventListener('click', () => {
      if (st) {
        const y = st.start + REST[i] * (st.end - st.start);
        if (lenis) lenis.scrollTo(y, { duration: 1.4 });
        else window.scrollTo({ top: y, behavior: 'smooth' });
      } else {
        gsap.to(state, { t: REST[i], duration: reduce ? 0 : 1.2, ease: 'power2.inOut', overwrite: true, onUpdate: paint });
      }
    }),
  );

  // ---- pointer: light and a little parallax (desktop only — nothing depends on it)
  pin.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const r = pin.getBoundingClientRect();
    pointer.x = (e.clientX - r.left) / r.width - 0.5;
    pointer.y = (e.clientY - r.top) / r.height - 0.5;
  });
  pin.addEventListener('pointerleave', () => { pointer.x = 0; pointer.y = 0; });

  // ---- the scroll timeline (desktop) or a first draw on arrival (elsewhere)
  if (pinned) {
    st = ScrollTrigger.create({
      trigger: pin, start: 'top top', end: '+=320%', pin: true, scrub: 0.8,
      animation: gsap.to(state, { t: 1, ease: 'none', duration: 1 }),
      onRefresh: () => { measure(); paint(); },
    });
  } else {
    ScrollTrigger.create({
      trigger: section, start: 'top 60%', once: true,
      onEnter: () => gsap.to(state, { t: REST[0], duration: reduce ? 0 : 1.6, ease: 'power2.out', onUpdate: paint }),
    });
  }
  if (!reduce) {
    gsap.from([...section.querySelectorAll('.sym__head > *'), section.querySelector('.sym__chapters')], {
      y: 30, autoAlpha: 0, duration: 1.2, ease: 'expo.out', stagger: 0.08,
      scrollTrigger: { trigger: pin, start: 'top 70%', once: true },
    });
  }

  // ---- render loop: only while the section is on screen (bolt3d stops its own renderer the same way)
  let ticking = false;
  const loop = () => paint();
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !ticking) { ticking = true; gsap.ticker.add(loop, false, true); } // before bolt3d renders
    else if (!e.isIntersecting && ticking) { ticking = false; gsap.ticker.remove(loop); }
  }).observe(stage);
  new ResizeObserver(() => { measure(); paint(); }).observe(stage);
  img.addEventListener('load', () => { measure(); paint(); });
  measure();
  paint();

  // ---- the 3D mark, loaded as the section approaches
  if (gl) {
    ScrollTrigger.create({
      trigger: section, start: 'top 250%', once: true,
      onEnter: () =>
        import('./bolt3d.js')
          .then(({ createBolt }) => createBolt(canvas, svgText, { host: stage, mode: 'symbol' }))
          .then((bolt) => {
            rig = bolt.rig;
            // desktop: the mark stands right of the copy; the camera frames it there, not by moving the copy
            const place = () => {
              const visH = 2 * rig.camera.position.z * Math.tan((rig.camera.fov * Math.PI) / 360);
              rig.spin.position.x = wide ? visH * rig.camera.aspect * 0.18 : 0;
            };
            place();
            new ResizeObserver(place).observe(stage);
            paint();
            section.classList.add('is-ready');
          })
          .catch(() => section.classList.add('is-flat')),
    });
  }
}
