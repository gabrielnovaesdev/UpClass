import {
  AmbientLight,
  Box3,
  DirectionalLight,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  NeutralToneMapping,
  PCFShadowMap,
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
import { createShatter } from './shatter.js';

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
 * The brand mark as one poured object: two extruded bolts carrying the artwork (see the notes on BODY,
 * ART_URL and the face material). Shared by the hero and intro stage and by the "Detalhes" section (detail3d.js).
 * Returns `model` (svg → world, y flipped; scale it by world units per svg unit) and the two `bolts`.
 */
export async function buildMark(renderer, svgText) {
  const [img, reliefImg] = await Promise.all([loadImage(ART_URL), loadImage(RELIEF_URL)]);
  const model = new Group();
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
  const centre = { x: VB_W / 2, y: VB_H / 2 };
  bolts.forEach((b) => b.position.set(b.userData.home.x - centre.x, b.userData.home.y - centre.y, b.userData.home.z));
  bolts.forEach((b) => (b.userData.home = b.position.clone()));
  return { model, bolts, face, rim };
}

// The hero's reflection on its glossy floor: copies of the mark's materials that fade out with the distance below the
// floor line (world y), so the mirrored bolt dissolves into the floor the way it would on lacquer.
function reflectionOf(material, uniforms) {
  const m = material.clone();
  m.transparent = true;
  m.depthWrite = false;
  m.customProgramCacheKey = () => 'upc-reflection';
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = `varying float vWorldY;\n${shader.vertexShader.replace(
      '#include <project_vertex>',
      '#include <project_vertex>\n  vWorldY = (modelMatrix * vec4(transformed, 1.0)).y;',
    )}`;
    shader.fragmentShader = `uniform float uFloor;\nuniform float uFade;\nuniform float uAmount;\nvarying float vWorldY;\n${shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      '#include <dithering_fragment>\n  gl_FragColor.a *= uAmount * smoothstep(uFloor - uFade, uFloor, vWorldY);',
    )}`;
  };
  return m;
}

/**
 * mode 'hero'  — the mark on its stage: it stands over a glossy floor with its reflection, glints as a light circles
 *                it, tilts towards the pointer, and flies wherever `flight()` sends it (hero.js takes it from the hero
 *                down into the manifesto). Its host is a fixed layer the size of the screen.
 * mode 'intro' — centred and fully art-directed from outside through `rig` (see intro.js).
 */
export async function createBolt(canvas, svgText, { host, mode = 'hero' }) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.toneMapping = NeutralToneMapping;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap; // (PCFSoft is gone from three: asking for it recompiles every shader on the first shadow pass)

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

  const { model, bolts, face, rim } = await buildMark(renderer, svgText);
  const spin = new Group(); // overall pose: scroll, pointer, idle float
  spin.add(model);
  scene.add(spin);

  const state = { appear: 0, scroll: 0, px: 0, py: 0, tx: 0, ty: 0, f: null };

  // the reflection (hero only): a mirrored copy of the mark under the floor line, drawn with the fading materials
  const reflU = { uFloor: { value: 0 }, uFade: { value: 1 }, uAmount: { value: 0 } };
  let refl = null;
  if (mode === 'hero') {
    const swap = new Map([[face, reflectionOf(face, reflU)], [rim, reflectionOf(rim, reflU)]]);
    refl = model.clone();
    refl.traverse((o) => {
      if (!o.isMesh) return;
      o.material = o.material.map((m) => swap.get(m) ?? m);
      o.castShadow = false;
      o.receiveShadow = false;
    });
    refl.matrixAutoUpdate = false;
    scene.add(refl);
  }
  const mirror = new Matrix4();
  // the mirror floor, ready to break (hero only, see shatter.js)
  const glass = mode === 'hero' ? createShatter({ scene, lite: host.clientWidth < 760 }) : null;
  let glassT = 0; // the break's clock, set by the scroll (hero.js)
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
    const frac = mode === 'intro' ? introFrac(w, h) : narrow ? 0.32 : 0.46;
    state.frac = frac;
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
    glass?.at(glassT);
    if (mode === 'hero' && !state.freeze) { // freeze: dev-only pose lock for side-by-side checks
      state.px += (state.tx - state.px) * 0.05;
      state.py += (state.ty - state.py) * 0.05;
      const a = state.appear;
      // where the flight has taken it (screen fractions, scale, extra turn and bank); at rest it is home
      const f = state.f ?? { x: 0.5, y: 0.5 - baseY / visibleH, s: 1, turn: 0, bank: 0, idle: 1, refl: 1 };
      const idle = f.idle;
      spin.rotation.y = (-0.3 + Math.sin(time * 0.42) * 0.16 + state.px * 0.5) * idle + f.turn - (1 - a) * 2.4;
      spin.rotation.x = (Math.sin(time * 0.36) * 0.06 + state.py * 0.28) * idle;
      spin.rotation.z = Math.sin(time * 0.27) * 0.025 * idle + f.bank;
      spin.position.x = (f.x - 0.5) * visibleH * camera.aspect;
      spin.position.y = (0.5 - f.y) * visibleH + Math.sin(time * 0.75) * visibleH * 0.012 * idle;
      spin.scale.setScalar((0.72 + 0.28 * a) * f.s);
      // a light slowly circling the mark: its glints travel over the fold and the rim, like a product on a turntable
      key.position.set(-4 + Math.sin(time * 0.31) * 2.6, 4.5 + Math.cos(time * 0.23) * 1.2, 3.2);
      rimPink.intensity = 2.2 + Math.sin(time * 0.5) * 0.5;
      rimBlue.intensity = 2.2 - Math.sin(time * 0.5) * 0.5;
      // the floor lies a little under the resting mark; the reflection fades with the lift-off
      const floor = baseY - visibleH * state.frac * 0.5 - visibleH * 0.035;
      reflU.uFloor.value = floor;
      reflU.uFade.value = visibleH * state.frac * 0.62;
      reflU.uAmount.value = 0.42 * f.refl * a;
      refl.visible = f.refl > 0.001;
      if (refl.visible) {
        spin.updateMatrixWorld(true);
        mirror.set(1, 0, 0, 0, 0, -1, 0, 2 * floor, 0, 0, 1, 0, 0, 0, 0, 1);
        refl.matrix.multiplyMatrices(mirror, model.matrixWorld);
        refl.matrixWorldNeedsUpdate = true;
      }
    }
    renderer.render(scene, camera);
  }
  let held = false; // out of the frame (the hero's hand-over): no frames, even though its host is still on screen
  let inView = false;
  const start = () => { if (!running && !held) { running = true; gsap.ticker.add(tick); } };
  const stop = () => { if (running) { running = false; gsap.ticker.remove(tick); } };

  if (import.meta.env.DEV) window[`__bolt_${mode}`] = { face, rim, renderer, scene, camera, key, rimPink, rimBlue, state, spin };

  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  const io = new IntersectionObserver(([e]) => { inView = e.isIntersecting; if (inView) start(); else stop(); }, { threshold: 0 });
  io.observe(host); // render only while on screen
  start();

  return {
    hold(on) {
      if (on === held) return;
      held = on;
      if (held) stop();
      else if (inView) start();
    },
    appear() {
      gsap.to(canvas, { opacity: 1, duration: 0.6, ease: 'power1.out' });
      gsap.to(state, { appear: 1, duration: 2.4, ease: 'expo.out' });
    },
    /** f: { x, y (centre, fractions of the screen), s (scale), turn, bank (radians), idle (0–1), refl (0–1) }, or null for home. */
    flight(f) {
      state.f = f;
    },
    /**
     * The mirror floor (hero): build(picture, floor, x) cuts the floor below `floor` (fraction of the screen) into
     * shards carrying `picture` (its 2D canvas), breaking from `x`; at(t) poses the break t seconds in (t ≤ 0:
     * whole).
     */
    mirror: {
      build(picture, floor, x) {
        const vw = visibleH * camera.aspect;
        const top = (0.5 - floor) * visibleH;
        const tex = glass.build({ left: -vw / 2, right: vw / 2, top, bottom: -visibleH / 2 }, { x: (x - 0.5) * vw, y: top }, picture);
        // shaders and the picture on the GPU now, so the break itself never waits on them
        const was = glass.group.visible;
        glass.group.visible = true; // (compile skips what is hidden)
        renderer.compile(scene, camera);
        glass.group.visible = was;
        renderer.initTexture(tex);
      },
      at(t) { glassT = t; },
      get built() { return glass.built; },
    },
    /** the resting pose: centre (fraction of the screen) and height (fraction of the screen) at full size. */
    home() {
      return { x: 0.5, y: 0.5 - baseY / visibleH, h: state.frac };
    },
    pointer(x, y) {
      state.tx = x;
      state.ty = y;
    },
    // direct handles for the intro choreography
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

// On screen the intro mark is exactly as tall as the SVG opening it hands over to.
export function introFrac(w, h) {
  return Math.min(h * 0.42, w * 0.9 * (VB_H / VB_W), 520) / h;
}
