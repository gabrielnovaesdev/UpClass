import {
  CanvasTexture,
  Color,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  NeutralToneMapping,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';
import { makeIphone } from './iphone3d.js';
import { makeBadge, makeBag, makeBubble, softenSilhouettes, studioEnvironment } from './heroes3d.js';
import { porcelainMaterial, voxelIcons } from './voxels3d.js';

/*
 * Two 3D stages that share one look:
 * - the stage of "Detalhes" (detail.js drives it), a canvas over that section with one object per word, rising with
 *   it and turning on its own: a real iPhone (iPhone), a verified badge (Procedência), the
 *   Upclass bag with the box inside (Entrega) and a message bubble (Atendimento);
 * - the field (flow.js drives it), a canvas in the sky shared by the name, the details, the collection and the
 *   moments: pixel icons of the store and its mark built from solid blocks (voxels3d.js), matte porcelain,
 *   scattered in depth as in Noomo's background. They drift and sway all
 *   the time and slide with the scroll at a speed that depends on their distance, so the space reads as deep and
 *   carries on from one section to the next.
 * The light mist of the page is the fog, so the far pieces dissolve into it.
 */

const MIST = 0xdfe0f4;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const rand = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })(); // stable layout

// the phone's screen: the brand's navy with the bolt glowing in the middle and the island on top
function screenTexture(boltImg) {
  const c = document.createElement('canvas');
  c.width = 360;
  c.height = 740;
  const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 0, c.height);
  bg.addColorStop(0, '#02007c');
  bg.addColorStop(0.55, '#000229');
  bg.addColorStop(1, '#14004f');
  g.fillStyle = bg;
  g.fillRect(0, 0, c.width, c.height);
  const glow = g.createRadialGradient(180, 380, 10, 180, 380, 240);
  glow.addColorStop(0, 'rgba(252, 57, 206, 0.45)');
  glow.addColorStop(1, 'rgba(252, 57, 206, 0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, c.width, c.height);
  if (boltImg) {
    const h = 300;
    const w = (h * boltImg.width) / boltImg.height;
    g.drawImage(boltImg, (c.width - w) / 2, 380 - h / 2, w, h);
  }
  g.fillStyle = '#000';
  g.beginPath();
  g.roundRect(135, 26, 90, 26, 13);
  g.fill();
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}


// renderer, camera, mist and the brand's lights: what both stages share
function baseStage(canvas, host, lite) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lite ? 1.5 : 1.75));
  renderer.toneMapping = NeutralToneMapping;
  renderer.outputColorSpace = SRGBColorSpace;

  const scene = new Scene();
  scene.fog = new Fog(MIST, 11, 24);
  scene.environment = studioEnvironment(renderer);
  const camera = new PerspectiveCamera(30, 1, 0.1, 60);
  camera.position.set(0, 0, 12);
  const key = new DirectionalLight(0xffffff, 1.1);
  key.position.set(-4, 5, 6);
  const rimPink = new DirectionalLight(0xff4fd8, 1.2);
  rimPink.position.set(-6, -3, -2);
  const rimBlue = new DirectionalLight(0x2f6bff, 1.2);
  rimBlue.position.set(6, 4, -3);
  scene.add(new HemisphereLight(0xffffff, new Color(MIST), 0.9), key, rimPink, rimBlue);

  const view = { visibleH: 1, aspect: 1, hostH: 1 };
  function resize() {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = view.aspect = w / h;
    camera.updateProjectionMatrix();
    view.visibleH = 2 * camera.position.z * Math.tan((camera.fov * Math.PI) / 360);
    view.hostH = h;
  }
  resize();

  // the camera leans a little towards the pointer
  const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
  function lean() {
    ptr.x += (ptr.tx - ptr.x) * 0.04;
    ptr.y += (ptr.ty - ptr.y) * 0.04;
    camera.position.x = ptr.x * 0.6;
    camera.position.y = -ptr.y * 0.4;
    camera.lookAt(0, 0, 0);
  }

  return {
    renderer, scene, camera, view, resize, lean,
    pointer(x, y) { ptr.tx = x; ptr.ty = y; },
    dispose() {
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}

export async function createDetailStage(canvas, host, svgText, { lite = false } = {}) {
  const base = baseStage(canvas, host, lite);
  const { renderer, scene, camera, view } = base;

  // ---- the four protagonists, in the order of the words (heroes3d.js, iphone3d.js)
  const boltImg = await loadImage('/img/bolt-art-700.webp');
  await document.fonts?.ready; // the name on the bag is drawn in Ibrand
  const phone = makeIphone(screenTexture(boltImg));
  const heroes = [
    { obj: phone, height: phone.userData.height, svg: false }, // iPhone
    makeBadge(), // Procedência
    makeBag(boltImg), // Entrega
    makeBubble(), // Atendimento
  ].map((hero) => {
    const holder = new Group();
    holder.add(hero.obj);
    holder.userData = hero;
    scene.add(holder);
    return holder;
  });
  softenSilhouettes(scene);
  // compile every material now, off the main thread where the browser allows it: otherwise the first frame an
  // object appears in stalls the page for seconds, right in the middle of its flight
  await (renderer.compileAsync ? renderer.compileAsync(scene, camera) : Promise.resolve(renderer.compile(scene, camera)));
  // one draw with everything on stage uploads the textures too, then the canvas is cleared
  renderer.render(scene, camera);
  heroes.forEach((holder) => { holder.visible = false; });
  renderer.render(scene, camera);

  return {
    resize: base.resize,
    pointer: base.pointer,
    dispose: base.dispose,
    /**
     * c: the scroll cursor (index of the word at the centre, fractional); slot: pixels between two words; t: seconds;
     * flights: per object, p 0 → 1 as it flies in (timed by detail.js while the page holds on its word).
     */
    frame(c, slot, t, flights) {
      const { visibleH, aspect, hostH } = view;
      const pxToWorld = visibleH / hostH;
      const narrow = aspect < 0.8;
      const objH = visibleH * (narrow ? 0.15 : 0.36);
      base.lean();

      const viewW = visibleH * aspect;
      let any = false;
      heroes.forEach((holder, i) => {
        const d = i - c;
        const u = flights[i]?.p ?? 0;
        // hidden until its flight starts, and again once its word has scrolled out of the top
        holder.visible = u > 0.001 && d > -1.75;
        if (!holder.visible) return;
        any = true;
        // e: 0 → 1 over the flight, eased in and out (smootherstep), so it starts gently, keeps going and settles
        // without a stop
        const e = u * u * u * (u * (u * 6 - 15) + 10);
        // alternate sides: the first comes from the right and settles on the left, the next the other way round
        const dir = i % 2 ? -1 : 1;
        const settle = -dir * viewW * (narrow ? 0.13 : 0.335);
        // a smooth curve in space (cubic Bézier in x and depth): far and small behind the text, then closer and
        // larger until it rests beside its word
        const k = 1 - e;
        const b0 = k * k * k;
        const b1 = 3 * k * k * e;
        const b2 = 3 * k * e * e;
        const b3 = e * e * e;
        const x = b0 * dir * viewW * 1.0 + b1 * dir * viewW * 0.45 + b2 * settle * 1.2 + b3 * settle;
        const z = b0 * -9 + b1 * -7 + b2 * -1.6 + b3 * 0.8;
        // it rides with its word: beside it on wide screens, just above it on narrow ones, where the word fills the width
        const y = -d * slot * pxToWorld + (narrow ? 0.13 : 0.03) * visibleH;
        const unit = objH / holder.userData.height;
        holder.userData.obj.scale.set(unit, holder.userData.svg ? -unit : unit, unit);
        holder.scale.setScalar((0.3 + 0.7 * e) * smooth(0, 0.08, u));
        holder.position.set(x, y, z);
        // a discreet turn along the way, then a slow idle spin
        holder.rotation.y = t * 0.35 + i * 1.3 + k * dir * 1.1;
        holder.rotation.x = Math.sin(t * 0.5 + i) * 0.1;
        holder.rotation.z = k * dir * 0.18 + Math.sin(t * 0.37 + i * 2) * 0.04;
        holder.userData.animate?.(t, e);
      });
      // nothing on stage: one last clear, then no more draws until a word brings its object back
      if (any || base.drawn) renderer.render(scene, camera);
      base.drawn = any;
    },
  };
}

export function createField(canvas, host, svgText, { lite = false } = {}) {
  const base = baseStage(canvas, host, lite);
  const { renderer, scene, camera, view } = base;

  const geos = voxelIcons();
  const glass = porcelainMaterial(); // matte porcelain, as in the reference (voxels3d.js)
  // scattered in depth like Noomo's icons; the nearest are the largest, the far ones dissolve into the mist
  const pieces = [];
  const count = lite ? 10 : 18;
  for (let i = 0; i < count; i++) {
    const m = new Mesh(geos[i % geos.length], glass);
    // never in the band where the protagonists of the details come to rest (about two thirds out to each side):
    // most pieces live at the edges of the screen, a few far back behind the words, small and misted
    const deep = i % 3 === 0;
    const z = deep ? -4.5 + rand() * 2 : -2 + rand() * 4.5;
    m.userData = {
      x: (i % 2 ? 1 : -1) * (deep ? 0.1 + rand() * 0.28 : 0.95 + rand() * 0.16), y: rand(), z,
      s: 0.55 + rand() * 0.45,
      rx: rand() * 6, ry: rand() * 6,
      vx: (rand() - 0.5) * 0.5, vy: 0.2 + rand() * 0.5,
      depth: 0.6 + ((z + 3) / 6) * 0.8, // nearer pieces slide faster with the scroll
    };
    m.scale.setScalar(m.userData.s);
    scene.add(m);
    pieces.push(m);
  }

  return {
    resize: base.resize,
    pointer: base.pointer,
    dispose: base.dispose,
    /** t: seconds; scrolled: pixels scrolled through the whole flow (for the parallax). */
    frame(t, scrolled) {
      const { visibleH, aspect, hostH } = view;
      const pxToWorld = visibleH / hostH;
      base.lean();
      const spanY = visibleH * 1.9;
      pieces.forEach((m) => {
        const u = m.userData;
        const zH = 2 * (camera.position.z - u.z) * Math.tan((camera.fov * Math.PI) / 360); // visible height at that depth
        const y = u.y * spanY + scrolled * pxToWorld * u.depth * 0.55 + t * 0.06 * u.vy;
        const wrapped = (((y % spanY) + spanY) % spanY) - spanY / 2;
        m.position.set(u.x * zH * aspect * 0.5 + Math.sin(t * 0.2 + u.rx) * 0.2, wrapped * (zH / visibleH), u.z);
        // a slow sway rather than a spin: each piece keeps showing its face, so it reads as what it is
        m.rotation.set(Math.sin(t * 0.22 * (0.6 + u.vy) + u.rx) * 0.45, Math.sin(t * 0.18 * (0.6 + u.vy) + u.ry) * 0.9, Math.sin(t * 0.26 + u.ry) * 0.3);
      });
      renderer.render(scene, camera);
    },
  };
}
