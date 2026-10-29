import {
  AmbientLight,
  Box3,
  DirectionalLight,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  NeutralToneMapping,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  Texture,
  Vector3,
  WebGLRenderer,
} from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import gsap from 'gsap';

export const VB_W = 323.2;
export const VB_H = 553.99;
// One solid, poured object: thickness is mostly a deep rounded bevel, never a stack of parts.
const BODY = { depth: 9, bevelThickness: 7, bevelSize: 3, bevelOffset: -3, bevelSegments: 24, curveSegments: 80 };
// Colour: the brand artwork rendered from the same PDF as the outlines, its printed outline stroke
// removed and colours bled past the edges so the rounded rim never shows a dark thread.
// Relief: a normal map baked from the logo's lit-face shape (heavily blurred), so the face swells
// out of the fold as one continuous surface instead of a separate raised layer.
const ART_URL = '/img/bolt-tex-1600.webp';
const RELIEF_URL = '/img/bolt-normal-1600.webp';

const imageCache = new Map();
function loadImage(src) {
  if (!imageCache.has(src)) {
    imageCache.set(src, new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    }));
  }
  return imageCache.get(src);
}

// Planar projection: every vertex, flank included, picks the artwork colour right under it.
function projectArt(geo) {
  const pos = geo.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = pos.getX(i);
    uv[i * 2 + 1] = pos.getY(i);
  }
  geo.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  return geo;
}

function shapesOf(svgText) {
  return new SVGLoader().parse(svgText).paths.map((p) => SVGLoader.createShapes(p));
}

/**
 * mode 'hero'  — floats behind the hero copy, spins with scroll, tilts towards the pointer.
 * mode 'intro' — centred and fully art-directed from outside through `rig` (see intro.js).
 * mode 'symbol' — centred, art-directed by the symbol section (see symbol.js); `rig.project` maps logo
 *                 coordinates to screen pixels so the HTML/SVG annotations stay locked to the 3D mark.
 */
export async function createBolt(canvas, svgText, { host, mode = 'hero' }) {
  const [img, reliefImg] = await Promise.all([loadImage(ART_URL), loadImage(RELIEF_URL)]);

  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.toneMapping = NeutralToneMapping;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const camera = new PerspectiveCamera(22, 1, 0.1, 100);
  camera.position.set(0, 0, 10);

  // Key light from the upper left, like the highlight baked into the artwork; it casts the fold shadows.
  const ambient = new AmbientLight(0xffffff, 0.04);
  const key = new DirectionalLight(0xffffff, 0.5);
  key.position.set(-4, 4.5, 3.2); // grazing, so every step throws a visible shadow
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.radius = 4;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  Object.assign(key.shadow.camera, { left: -1.6, right: 1.6, top: 1.6, bottom: -1.6, near: 1, far: 20 });
  const rimPink = new DirectionalLight(0xff4fd8, 2.2);
  rimPink.position.set(-6, -3, -2);
  const rimBlue = new DirectionalLight(0x2f6bff, 2.2);
  rimBlue.position.set(6, 4, -3);
  scene.add(ambient, key, rimPink, rimBlue);

  const art = new Texture(img);
  art.colorSpace = SRGBColorSpace;
  art.flipY = false; // shape y grows downward, like the image rows
  art.repeat.set(1 / VB_W, 1 / VB_H); // cap UVs are raw shape coordinates
  art.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  art.needsUpdate = true;
  const relief = new Texture(reliefImg);
  relief.flipY = false;
  relief.repeat.copy(art.repeat);
  relief.anisotropy = art.anisotropy;
  relief.needsUpdate = true;

  // Rim: the rounded edge, coloured by the artwork and genuinely lit so the object reads as solid.
  const rim = new MeshPhysicalMaterial({
    map: art,
    emissive: 0xffffff,
    emissiveMap: art,
    emissiveIntensity: 0.55,
    roughness: 0.38,
    metalness: 0,
    specularIntensity: 0.4,
    clearcoat: 0.6,
    clearcoatRoughness: 0.1,
    envMapIntensity: 0.25,
    toneMapped: false,
  });
  // Face: exactly the logo. Its colour is pure artwork: no diffuse light and no base specular (that
  // layer alone lifted the navy fold from rgb(3,0,133) to a grey-lilac). Gloss comes only from a thin,
  // sharp clearcoat, bent by the relief map into highlights along the fold.
  const face = new MeshPhysicalMaterial({
    color: 0x000000,
    emissive: 0xffffff,
    emissiveMap: art,
    emissiveIntensity: 1,
    roughness: 0.5,
    metalness: 0,
    specularIntensity: 0,
    clearcoat: 0.5,
    clearcoatRoughness: 0.06,
    envMapIntensity: 0.3,
    normalMap: relief,
    toneMapped: false,
  });
  face.normalScale.set(0.7, 0.7);
  const spin = new Group(); // overall pose: scroll, pointer, idle float
  const model = new Group(); // svg → world (y flipped)
  spin.add(model);
  scene.add(spin);

  const silhouettes = shapesOf(svgText);
  const bolts = silhouettes.map((shapes) => {
    const bolt = new Group();
    const geo = projectArt(new ExtrudeGeometry(shapes, { ...BODY, bevelEnabled: true }));
    geo.translate(0, 0, -BODY.depth / 2);
    // smooth normals across the bevel rings: no facets, light glides over the curves
    const body = new Mesh(toCreasedNormals(geo, Math.PI / 2.6), [face, rim]); // group 0 = caps, group 1 = rim
    body.castShadow = true;
    body.receiveShadow = true;
    bolt.add(body);
    // pivot each bolt on its own centre so the intro can spin them independently
    const bb = new Box3().setFromObject(bolt);
    const c = bb.getCenter(new Vector3());
    bolt.children.forEach((m) => m.position.sub(c));
    bolt.position.copy(c);
    bolt.userData.home = c.clone();
    model.add(bolt);
    return bolt;
  });
  model.position.set(0, 0, 0);
  const centre = { x: VB_W / 2, y: VB_H / 2 };
  bolts.forEach((b) => b.position.set(b.userData.home.x - centre.x, b.userData.home.y - centre.y, b.userData.home.z));
  bolts.forEach((b) => (b.userData.home = b.position.clone()));

  const state = { appear: 0, scroll: 0, px: 0, py: 0, tx: 0, ty: 0 };
  let visibleH = 1;
  let baseY = 0;
  let unit = 1; // world units per svg unit

  function resize() {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    visibleH = 2 * camera.position.z * Math.tan((camera.fov * Math.PI) / 360);
    const narrow = w < 760;
    const frac = mode === 'intro' ? introFrac(w, h) : mode === 'symbol' ? symbolFrac(w, h) : narrow ? 0.3 : 0.4;
    baseY = mode === 'hero' ? visibleH * (narrow ? 0.07 : -0.035) : 0; // portrait screens lift the hero bolt clear of the copy
    unit = (visibleH * frac) / VB_H;
    model.scale.set(unit, -unit, unit); // svg y-axis points down
    // keep the shadow frustum hugging the mark at any size
    const r = VB_H * unit * 0.75;
    Object.assign(key.shadow.camera, { left: -r, right: r, top: r, bottom: -r });
    key.shadow.camera.updateProjectionMatrix();
  }

  let running = false;
  function tick(time) {
    if (mode === 'hero' && !state.freeze) { // freeze: dev-only pose lock for side-by-side checks
      state.px += (state.tx - state.px) * 0.05;
      state.py += (state.ty - state.py) * 0.05;
      const a = state.appear;
      spin.rotation.y =
        -0.3 + Math.sin(time * 0.42) * 0.16 + state.px * 0.5 + state.scroll * Math.PI * 2 - (1 - a) * 2.4;
      spin.rotation.x = Math.sin(time * 0.36) * 0.06 + state.py * 0.28;
      spin.rotation.z = Math.sin(time * 0.27) * 0.025;
      spin.position.y = baseY + Math.sin(time * 0.75) * visibleH * 0.012 - state.scroll * visibleH * 0.04;
      spin.scale.setScalar(0.72 + 0.28 * a);
    }
    renderer.render(scene, camera);
  }
  const start = () => { if (!running) { running = true; gsap.ticker.add(tick); } };
  const stop = () => { if (running) { running = false; gsap.ticker.remove(tick); } };

  if (import.meta.env.DEV) window[`__bolt_${mode}`] = { face, rim, renderer, scene, camera, key, rimPink, rimBlue, state, spin };

  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  const io = new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()), { threshold: 0 });
  io.observe(host); // render only while on screen
  start();

  return {
    appear() {
      gsap.to(canvas, { opacity: 1, duration: 0.6, ease: 'power1.out' });
      gsap.to(state, { appear: 1, duration: 2.4, ease: 'expo.out' });
    },
    scroll(p) {
      state.scroll = gsap.utils.clamp(0, 1, p / 0.8);
    },
    pointer(x, y) {
      state.tx = x;
      state.ty = y;
    },
    // direct handles for the intro and symbol choreography
    rig: {
      spin, bolts, key, rimPink, rimBlue, camera,
      get unit() { return unit; },
      // logo-space point (svg units, y down) on a given bolt → pixel position inside the host
      project(x, y, bolt = null, z = 0) {
        const v = new Vector3(x - VB_W / 2, y - VB_H / 2, z);
        spin.updateMatrixWorld(true);
        if (bolt) bolt.localToWorld(v.sub(bolt.userData.home)); // follows that bolt's own move and turn
        else model.localToWorld(v);
        v.project(camera);
        return [((v.x + 1) / 2) * host.clientWidth, ((1 - v.y) / 2) * host.clientHeight];
      },
      render: () => renderer.render(scene, camera),
    },
    dispose() {
      stop();
      ro.disconnect();
      io.disconnect();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}

// The symbol section gives the mark most of the screen height beside the copy; on phones it fills its own stage.
export function symbolFrac(w, h) {
  return w < 760 ? 0.82 : 0.56;
}

// On screen the intro mark is exactly as tall as the SVG opening it hands over to.
export function introFrac(w, h) {
  return Math.min(h * 0.42, w * 0.9 * (VB_H / VB_W), 520) / h;
}
