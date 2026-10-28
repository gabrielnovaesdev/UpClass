import gsap from 'gsap';

const NS = 'http://www.w3.org/2000/svg';
const ART = '/img/bolt-art-1600.webp';
const MIN_LOAD = 0.9; // seconds: the opening breath is never cut short

function el(tag, attrs = {}, parent) {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  parent?.appendChild(n);
  return n;
}

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch (e) {
    return false;
  }
}

/**
 * 1 · load   — darkness and a single soft breath of brand light while assets arrive
 * 2 · arrive — the two 3D bolts fly in from opposite ends (the "update" arrows of the symbol) and lock
 * 3 · light  — a glint sweeps across the relief and carries on through the name, which resolves into focus
 * 4 · open   — the 3D mark hands over to an identical vector opening with a lit edge
 * 5 · dive   — the camera dives through the upper bolt into the page
 */
export async function playIntro({ paths, svgText, ready, onReveal }) {
  const root = document.querySelector('.intro');
  const svg = root.querySelector('.intro__svg');
  const maskBg = root.querySelector('.intro__mask-bg');
  const veil = root.querySelector('.intro__veil');
  const hole = root.querySelector('.intro__hole');
  const mark = root.querySelector('.intro__mark');
  const glow = root.querySelector('.intro__glow');
  const canvas = root.querySelector('.intro__3d');
  const word = root.querySelector('.intro__word');
  const stage = document.querySelector('.hero__stage');
  const small = window.innerWidth < 760;

  // ---- 1 · load: one slow breath of light in the dark, nothing to read
  gsap.set(word, { autoAlpha: 0 });
  const breath = gsap.fromTo(glow, { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 0.22, scale: 0.8, duration: 1.6, ease: 'sine.inOut', yoyo: true, repeat: -1 });

  const { createBolt, introFrac, VB_W, VB_H } = await import('./bolt3d.js');
  const FOCUS = { x: 253, y: 224 }; // inside the thick stroke of the upper bolt
  const bolt = hasWebGL()
    ? createBolt(canvas, svgText, { host: root, mode: 'intro' }).catch(() => null)
    : Promise.resolve(null);
  const [rig] = await Promise.all([bolt, ready, new Promise((r) => setTimeout(r, MIN_LOAD * 1000))]);
  breath.kill();

  // ---- SVG opening, sized to match the 3D mark exactly when it faces the camera
  paths.forEach((d) => el('path', { d, fill: '#000' }, hole));
  // without WebGL the flat artwork stands in for the 3D mark
  const flat = rig ? null : el('image', { href: ART, width: VB_W, height: VB_H, opacity: 0 }, mark);
  const edge = el('g', { opacity: 0 }, mark);
  paths.forEach((d) =>
    el('path', { d, fill: 'none', stroke: 'url(#g-intro-edge)', 'stroke-width': 1.4, 'vector-effect': 'non-scaling-stroke' }, edge)
  );

  const s = { z: 1, cx: 0, hole: 0, edge: 0, veil: 1, flat: 0 };
  let L = {};
  function layout() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    for (const r of [maskBg, veil]) { r.setAttribute('width', W); r.setAttribute('height', H); }
    const k = (introFrac(W, H) * H) / VB_H;
    L = { W, H, k, x0: (W - VB_W * k) / 2, y0: (H - VB_H * k) / 2 };
    word.style.top = `${L.y0 + VB_H * k + Math.max(18, H * 0.035)}px`;
    apply();
    root.classList.add('is-laid');
  }
  function apply() {
    const { W, H, k, x0, y0 } = L;
    const fx0 = x0 + FOCUS.x * k;
    const fy0 = y0 + FOCUS.y * k;
    const fx = fx0 + (W / 2 - fx0) * s.cx;
    const fy = fy0 + (H / 2 - fy0) * s.cx;
    const t = `translate(${fx} ${fy}) scale(${k * s.z}) translate(${-FOCUS.x} ${-FOCUS.y})`;
    hole.setAttribute('transform', t);
    mark.setAttribute('transform', t);
    hole.setAttribute('opacity', s.hole);
    edge.setAttribute('opacity', s.edge);
    veil.setAttribute('opacity', s.veil);
    flat?.setAttribute('opacity', s.flat);
  }
  layout();
  window.addEventListener('resize', layout);

  return new Promise((resolve) => {
    const tl = gsap.timeline({
      onUpdate: apply,
      onComplete: () => {
        window.removeEventListener('resize', layout);
        window.removeEventListener('keydown', onKey);
        rig?.dispose();
        root.remove();
        resolve();
      },
    });

    tl.to(glow, { autoAlpha: 0.12, scale: 0.9, duration: 0.6, ease: 'power2.out' }, 0);

    if (rig) {
      const { spin, bolts, key } = rig.rig;
      const [up, lo] = bolts;
      const span = VB_H * rig.rig.unit * 1.15;
      // ---- 2 · arrive: from opposite corners, tumbling, then lock
      tl.set(canvas, { autoAlpha: 1 }, 0.15)
        .fromTo(up.position,
        { x: up.userData.home.x + span * 0.55, y: up.userData.home.y + span, z: 2.2 },
        { x: up.userData.home.x, y: up.userData.home.y, z: up.userData.home.z, duration: 1.6, ease: 'expo.out' }, 0.15)
        .fromTo(lo.position,
          { x: lo.userData.home.x - span * 0.55, y: lo.userData.home.y - span, z: 2.2 },
          { x: lo.userData.home.x, y: lo.userData.home.y, z: lo.userData.home.z, duration: 1.6, ease: 'expo.out' }, 0.22)
        .fromTo(up.rotation, { x: -0.9, y: Math.PI * 1.25, z: 0.5 }, { x: 0, y: 0, z: 0, duration: 1.8, ease: 'expo.out' }, 0.15)
        .fromTo(lo.rotation, { x: 0.9, y: -Math.PI * 1.25, z: 0.5 }, { x: 0, y: 0, z: 0, duration: 1.8, ease: 'expo.out' }, 0.22)
        .fromTo(spin.rotation, { y: 0.9, x: 0.25 }, { y: 0, x: 0, duration: 2.6, ease: 'expo.out' }, 0.15)
        .fromTo(spin.scale, { x: 0.82, y: 0.82, z: 0.82 }, { x: 1, y: 1, z: 1, duration: 2.2, ease: 'expo.out' }, 0.15)
      // ---- 3 · light: the lock flashes, a glint runs across the relief
        .addLabel('lock', 0.95)
        .to(glow, { autoAlpha: 1, scale: 1.05, duration: 0.5, ease: 'power2.out' }, 'lock')
        .to(glow, { autoAlpha: 0.45, scale: 1, duration: 1.2, ease: 'power2.out' }, 'lock+=0.5')
        .fromTo(key.position, { x: -7 }, { x: 6, duration: 1.5, ease: 'power2.inOut' }, 'lock')
        .fromTo(key, { intensity: 0.5 }, { intensity: 1.1, duration: 0.6, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 'lock+=0.2')
      // the name: tracking closes in and the focus sharpens, then the same glint passes through it
        .fromTo(word, { autoAlpha: 0, letterSpacing: '0.42em', filter: 'blur(14px)', y: 10 },
          { autoAlpha: 1, letterSpacing: '-0.01em', filter: 'blur(0px)', y: 0, duration: 1.5, ease: 'expo.out' }, 'lock+=0.25')
        .fromTo(word, { '--sx': '-40%' }, { '--sx': '140%', duration: 1.3, ease: 'power2.inOut' }, 'lock+=0.55')
        .to(word, { autoAlpha: 0, filter: 'blur(10px)', y: -6, duration: 0.5, ease: 'power2.in' }, 'lock+=1.75')
      // ---- 4 · open: the 3D mark hands over to the vector opening
        .addLabel('open', 'lock+=2.05')
        .to(key.position, { x: -4, duration: 0.6, ease: 'power2.out' }, 'open-=0.4')
        .to(s, { edge: 1, duration: 0.3, ease: 'power1.out' }, 'open')
        .to(s, { hole: 1, duration: 0.5, ease: 'power2.inOut' }, 'open')
        .to(canvas, { autoAlpha: 0, duration: 0.45, ease: 'power2.inOut' }, 'open+=0.05');
    } else {
      tl.to(s, { flat: 1, duration: 0.8, ease: 'power2.out' }, 0.2)
        .fromTo(word, { autoAlpha: 0, letterSpacing: '0.42em', filter: 'blur(14px)' },
          { autoAlpha: 1, letterSpacing: '-0.01em', filter: 'blur(0px)', duration: 1.4, ease: 'expo.out' }, 0.5)
        .to(word, { autoAlpha: 0, duration: 0.4 }, 1.9)
        .addLabel('open', 2.2)
        .to(s, { edge: 1, duration: 0.3 }, 'open')
        .to(s, { hole: 1, duration: 0.5, ease: 'power2.inOut' }, 'open')
        .to(s, { flat: 0, duration: 0.45 }, 'open+=0.05');
    }

    // ---- 5 · dive
    tl.addLabel('dive', 'open+=0.45')
      .to(glow, { autoAlpha: 0, duration: 0.6 }, 'dive')
      .to(s, { z: small ? 70 : 95, duration: 1.2, ease: 'expo.in' }, 'dive')
      .to(s, { cx: 1, duration: 1.2, ease: 'power2.in' }, 'dive')
      .to(s, { edge: 0, duration: 0.6, ease: 'power1.in' }, 'dive+=0.4')
      .to(s, { veil: 0, duration: 0.3, ease: 'none' }, 'dive+=0.95')
      .fromTo(
        stage,
        { scale: 1.16, filter: small ? 'none' : 'blur(10px)' },
        { scale: 1, filter: 'blur(0px)', duration: 1.9, ease: 'expo.out', clearProps: 'filter,transform' },
        'dive+=0.55'
      )
      .add(() => onReveal?.(), 'dive+=0.8');

    // Skippable: click or Escape fast-forwards
    const finish = () => tl.timeScale(4);
    const onKey = (e) => e.key === 'Escape' && finish();
    root.addEventListener('click', finish);
    window.addEventListener('keydown', onKey);
  });
}
