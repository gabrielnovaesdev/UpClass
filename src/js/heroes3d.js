import {
  AdditiveBlending,
  BackSide,
  BoxGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  CylinderGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  PlaneGeometry,
  PMREMGenerator,
  RepeatWrapping,
  Scene,
  Shape,
  SphereGeometry,
  SRGBColorSpace,
  TubeGeometry,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/*
 * The objects of "Detalhes" besides the iPhone (iphone3d.js), each one something the customer actually gets:
 * a verified badge (Procedência), the Upclass bag with the box inside (Entrega) and a
 * message bubble (Atendimento). Each returns { obj, height, svg, animate }: `height` is the object's height in its
 * own units (the stage scales it), `svg` is false (they are built y up) and animate(t, grow) plays it — grow goes
 * 0 → 1 as its word reaches the middle of the screen.
 */

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function drawBolt(g, img, cx, cy, h, rot = 0) {
  if (!img) return;
  const w = (h * img.width) / img.height;
  g.save();
  g.translate(cx, cy);
  g.rotate(rot);
  g.drawImage(img, -w / 2, -h / 2, w, h);
  g.restore();
}

// paper and print grain, so flat colour never reads as plastic
function grain(g, w, h, amount) {
  const img = g.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
}

// the Upclass seal: a navy disc with the bolt and a thin ring in the brand gradient
function sealTexture(boltImg) {
  return canvasTexture(512, 512, (g, s) => {
    const c = s / 2;
    const ring = g.createLinearGradient(0, 0, s, s);
    ring.addColorStop(0, '#80ffff');
    ring.addColorStop(0.45, '#063ff1');
    ring.addColorStop(1, '#fc39ce');
    g.fillStyle = ring;
    g.beginPath(); g.arc(c, c, c, 0, Math.PI * 2); g.fill();
    const bg = g.createRadialGradient(c * 0.8, c * 0.7, 10, c, c, c);
    bg.addColorStop(0, '#0a07a8');
    bg.addColorStop(1, '#000229');
    g.fillStyle = bg;
    g.beginPath(); g.arc(c, c, c * 0.93, 0, Math.PI * 2); g.fill();
    drawBolt(g, boltImg, c, c, s * 0.62);
  });
}

/* A white product box, closed by the Upclass seal across the seam of the lid. Shared by Procedência and the box
   that comes out of the bag. Returns the group and the seal's material (its glow is animated). */
function whiteBox(boltImg, { W = 0.86, H = 1.56, D = 0.3 } = {}) {
  const box = new Group();
  // the lid's face: glossy white with the bolt debossed tone on tone
  const faceTex = canvasTexture(512, 930, (g, w, h) => {
    g.fillStyle = '#f7f6fb';
    g.fillRect(0, 0, w, h);
    g.globalAlpha = 0.07;
    drawBolt(g, boltImg, w / 2, h * 0.45, h * 0.32);
    g.globalAlpha = 1;
    grain(g, w, h, 4);
  });
  const white = new MeshPhysicalMaterial({ color: 0xf6f5fa, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.18, sheen: 0.4, sheenColor: 0xeee8ff });
  const face = new MeshPhysicalMaterial({ map: faceTex, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.18 });
  const matte = new MeshPhysicalMaterial({ color: 0xe9e7f1, roughness: 0.6 });

  const LID_H = H * 0.9;
  const base = new Mesh(new RoundedBoxGeometry(W - 0.012, H, D - 0.012, 4, 0.012), matte);
  box.add(base);
  // faces: +x, -x, +y, -y, +z, -z
  const lid = new Mesh(new RoundedBoxGeometry(W, LID_H, D, 5, 0.02), [white, white, white, white, face, face]);
  lid.position.y = (H - LID_H) / 2 + 0.004;
  box.add(lid);

  // the seal straddles the seam at the bottom of the front
  const sealTex = sealTexture(boltImg);
  // the cylinder's cap maps its texture a quarter turn off
  sealTex.center.set(0.5, 0.5);
  sealTex.rotation = Math.PI / 2;
  const sealMat = new MeshPhysicalMaterial({
    map: sealTex, emissive: 0xffffff, emissiveMap: sealTex, emissiveIntensity: 0.3,
    roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05,
  });
  const r = W * 0.15;
  const seal = new Mesh(new CylinderGeometry(r, r, 0.006, 72), [new MeshPhysicalMaterial({ color: 0x1a1866, roughness: 0.3 }), sealMat, sealMat]);
  seal.rotation.x = Math.PI / 2;
  const seamY = -H / 2 + (H - LID_H);
  seal.position.set(0, seamY, D / 2 + 0.006);
  box.add(seal);
  // its light, a soft halo the seal gives off when it glows
  const halo = new Mesh(new PlaneGeometry(r * 5, r * 5), new MeshBasicMaterial({
    map: canvasTexture(256, 256, (g, s) => {
      const glow = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      glow.addColorStop(0, 'rgba(252, 57, 206, 0.9)');
      glow.addColorStop(0.35, 'rgba(6, 63, 241, 0.35)');
      glow.addColorStop(1, 'rgba(6, 63, 241, 0)');
      g.fillStyle = glow;
      g.fillRect(0, 0, s, s);
    }),
    transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false,
  }));
  halo.position.set(0, seamY, D / 2 + 0.004);
  box.add(halo);
  return { box, sealMat, halo, H };
}

/* ---- Entrega: the Upclass bag of the visual identity, with the box coming out of it */
export function makeBag(boltImg) {
  const W = 1.04;
  const H = 1.22;
  const D = 0.44;
  const T = 0.008; // paper thickness
  const bag = new Group();

  // front and back: black at the top, warming into magenta, purple and blue, with the logo, as on the mockup
  const frontTex = canvasTexture(640, 750, (g, w, h) => {
    const base = g.createLinearGradient(0, 0, 0, h);
    base.addColorStop(0, '#26252d');
    base.addColorStop(0.3, '#3a2c48');
    base.addColorStop(0.62, '#7d4fd8');
    base.addColorStop(0.85, '#3d55f0');
    base.addColorStop(1, '#2f6bff');
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    const pink = g.createRadialGradient(w * 0.75, h * 0.32, 10, w * 0.75, h * 0.32, w * 0.75);
    pink.addColorStop(0, 'rgba(255, 79, 216, 0.85)');
    pink.addColorStop(0.5, 'rgba(217, 43, 130, 0.35)');
    pink.addColorStop(1, 'rgba(217, 43, 130, 0)');
    g.fillStyle = pink;
    g.fillRect(0, 0, w, h);
    const shade = g.createLinearGradient(0, 0, w, 0);
    shade.addColorStop(0, 'rgba(0, 0, 0, 0.35)');
    shade.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
    g.fillStyle = shade;
    g.fillRect(0, 0, w, h);
    // the fold of the gusset near the bottom
    g.fillStyle = 'rgba(255, 255, 255, 0.12)';
    g.fillRect(0, h * 0.86, w, 2);
    drawBolt(g, boltImg, w * 0.33, h * 0.59, h * 0.085);
    g.fillStyle = '#f4f2fb';
    g.font = '70px Ibrand, Gotham, sans-serif';
    g.textBaseline = 'middle';
    g.fillText('upclass', w * 0.38, h * 0.595);
    grain(g, w, h, 14);
  });
  // sides: the brand pattern, big chevrons of the bolt in magenta and blue on black
  const sideTex = canvasTexture(280, 750, (g, w, h) => {
    g.fillStyle = '#111016';
    g.fillRect(0, 0, w, h);
    for (let i = -1; i < 6; i++) drawBolt(g, boltImg, w * 0.5, i * h * 0.19 + h * 0.08, w * 1.25, -Math.PI / 2);
    g.fillStyle = 'rgba(17, 16, 22, 0.25)';
    g.fillRect(0, 0, w, h);
    grain(g, w, h, 14);
  });
  const paper = (map) => new MeshPhysicalMaterial({ map, roughness: 0.72, clearcoat: 0.15, clearcoatRoughness: 0.6, sheen: 0.5, sheenColor: 0xffffff, sheenRoughness: 0.6 });
  const front = paper(frontTex);
  const side = paper(sideTex);
  const inside = new MeshPhysicalMaterial({ color: 0x17141f, roughness: 0.85 });
  const rim = new MeshPhysicalMaterial({ color: 0x2a2733, roughness: 0.7 });

  // walls as thin slabs: faces +x, -x, +y, -y, +z (outside), -z (inside)
  const wall = (w, mat, x, z, ry) => {
    const m = new Mesh(new BoxGeometry(w, H, T), [mat, mat, rim, rim, mat, inside]); // the side edges carry the print: no dark line down the corners
    m.position.set(x, 0, z);
    m.rotation.y = ry;
    bag.add(m);
  };
  wall(W, front, 0, D / 2, 0);
  wall(W, front, 0, -D / 2, Math.PI);
  wall(D, side, W / 2, 0, Math.PI / 2);
  wall(D, side, -W / 2, 0, -Math.PI / 2);
  const bottom = new Mesh(new BoxGeometry(W, T, D), inside);
  bottom.position.y = -H / 2;
  bag.add(bottom);

  // twisted rope handles in magenta, knotted through the top of the front and back
  const ropeTex = canvasTexture(64, 64, (g, s) => {
    g.fillStyle = '#9d2286';
    g.fillRect(0, 0, s, s);
    g.strokeStyle = 'rgba(40, 0, 30, 0.5)';
    g.lineWidth = 9;
    for (let i = -s; i < 2 * s; i += 21) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + s, s); g.stroke(); }
    g.strokeStyle = 'rgba(255, 170, 235, 0.35)';
    g.lineWidth = 3;
    for (let i = -s + 8; i < 2 * s; i += 21) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + s, s); g.stroke(); }
  });
  ropeTex.wrapS = ropeTex.wrapT = RepeatWrapping;
  ropeTex.repeat.set(70, 1);
  const rope = new MeshPhysicalMaterial({ map: ropeTex, roughness: 0.55, sheen: 1, sheenColor: 0xff9be6, sheenRoughness: 0.4 });
  const knot = new MeshPhysicalMaterial({ color: 0x7c1a69, roughness: 0.5 });
  [1, -1].forEach((sz) => {
    const z = sz * (D / 2 + 0.006);
    const curve = new CatmullRomCurve3([
      new Vector3(-0.17, H / 2 - 0.08, z),
      new Vector3(-0.19, H / 2 + 0.12, z + sz * 0.01),
      new Vector3(-0.08, H / 2 + 0.36, z + sz * 0.02),
      new Vector3(0.08, H / 2 + 0.36, z + sz * 0.02),
      new Vector3(0.19, H / 2 + 0.12, z + sz * 0.01),
      new Vector3(0.17, H / 2 - 0.08, z),
    ]);
    bag.add(new Mesh(new TubeGeometry(curve, 96, 0.013, 12), rope));
    [-0.17, 0.17].forEach((x) => {
      const k = new Mesh(new SphereGeometry(0.022, 16, 12), knot);
      k.position.set(x, H / 2 - 0.08, z);
      bag.add(k);
    });
  });

  // the white box inside, its top and seal rising out of the bag
  const inner = whiteBox(boltImg, { W: 0.56, H: 1.0, D: 0.2 });
  inner.box.rotation.set(0, -0.12, 0.08);
  bag.add(inner.box);
  inner.sealMat.emissiveIntensity = 0.7;

  return {
    obj: bag,
    height: H + 0.5,
    svg: false,
    animate(t, grow) {
      const out = smooth(0.4, 1, grow);
      inner.box.position.set(0.04, -0.2 + out * (0.42 + Math.sin(t * 1.3) * 0.02), 0);
      inner.halo.material.opacity = out * 0.5;
      bag.rotation.z = Math.sin(t * 0.9) * 0.025;
    },
  };
}

/* The surroundings every object on the light sections reflects: a light lavender studio with a white softbox above,
   faint brand tints on the sides and a soft grey strip so metals keep their definition. The default room light has a
   dark floor, which the glossy objects picked up along their lower edges as a dark outline; here every grazing
   reflection is light. Used as the environment of the details stage and the floating field (detail3d.js). */
export function studioEnvironment(renderer) {
  const studio = new Scene();
  studio.add(new Mesh(new SphereGeometry(10, 32, 16), new MeshBasicMaterial({ color: 0xe6e4f6, side: BackSide })));
  const panel = (color, k, x, y, z, w, h) => {
    const m = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ color, side: BackSide }));
    m.material.color.multiplyScalar(k);
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    studio.add(m);
  };
  panel(0xffffff, 2.4, -2, 7, 4, 9, 5); // softbox above, a little to the left, like the key light
  panel(0xffe2f6, 1.2, -8, -1, -2, 5, 8); // pink on the left
  panel(0xdbe6ff, 1.2, 8, 2, -2, 5, 8); // blue on the right
  panel(0x8d8aa6, 1, 3, 1, -9, 4, 12); // a soft grey strip behind, for the metal's contrast
  const pmrem = new PMREMGenerator(renderer);
  const env = pmrem.fromScene(studio, 0.04).texture;
  pmrem.dispose();
  return env;
}

/* PBR materials go dark right at the silhouette: there the surface turns away from the camera (n·v → 0) and the
   lighting terms collapse, which reads as a thin dark outline against the light mist. Here the shading normal is
   bent a little towards the viewer only where it grazes, for the base layer and the clearcoat, so silhouettes stay
   as light as the faces around them. Geometry and outline are untouched. */
const graze = (n) => `{ vec3 vdir = normalize(vViewPosition); ${n} = normalize(${n} + vdir * max(0.0, 0.3 - dot(${n}, vdir))); }`;
export function softenSilhouettes(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
      if (!m.isMeshStandardMaterial || m.userData.softened) return;
      m.userData.softened = true;
      const prev = m.onBeforeCompile;
      m.onBeforeCompile = (shader, renderer) => {
        prev?.call(m, shader, renderer);
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${graze('normal')}`)
          .replace('#include <clearcoat_normal_fragment_maps>', `#include <clearcoat_normal_fragment_maps>\n#ifdef USE_CLEARCOAT\n${graze('clearcoatNormal')}\n#endif`);
      };
      m.needsUpdate = true;
    });
  });
}

/* ---- the soft, inflated objects (the verified badge and the message bubble) share one build and one skin */

// a flat outline inflated into a cushion: a thin core and a deep rounded bevel, the gradient projected from the front
function puffy(shape, { depth = 0.16, bevel = 0.17, size = 0.13, offset = -0.05 } = {}) {
  let geo = new ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: size, bevelOffset: offset, bevelSegments: 22, curveSegments: 96 });
  geo.translate(0, 0, -depth / 2);
  geo.computeBoundingBox();
  const b = geo.boundingBox;
  const pos = geo.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) - b.min.x) / (b.max.x - b.min.x);
    uv[i * 2 + 1] = (pos.getY(i) - b.min.y) / (b.max.y - b.min.y);
  }
  geo.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  return { geo: toCreasedNormals(geo, Math.PI / 2.6), front: depth / 2 + bevel };
}

// glossy brand plastic: cyan and blue at the top right, as the upper bolt; magenta at the bottom left, as the lower one
function brandSkin() {
  const tex = canvasTexture(512, 512, (g, w, h) => {
    const grad = g.createLinearGradient(w * 0.85, 0, w * 0.1, h);
    grad.addColorStop(0, '#80ffff');
    grad.addColorStop(0.3, '#3d7bff');
    grad.addColorStop(0.55, '#063ff1');
    grad.addColorStop(0.8, '#8b3cf7');
    grad.addColorStop(1, '#fc39ce');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    const light = g.createRadialGradient(w * 0.4, h * 0.22, 0, w * 0.4, h * 0.22, w * 0.5);
    light.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
    light.addColorStop(1, 'rgba(255, 255, 255, 0)');
    g.fillStyle = light;
    g.fillRect(0, 0, w, h);
  });
  return new MeshPhysicalMaterial({
    map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.32,
    roughness: 0.28, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05,
    iridescence: 0.35, iridescenceIOR: 1.4, sheen: 0.6, sheenColor: 0xd9e6ff, envMapIntensity: 1.2,
  });
}

const pearlMaterial = () => new MeshPhysicalMaterial({ color: 0xffffff, emissive: 0xf1effa, emissiveIntensity: 0.45, roughness: 0.18, clearcoat: 1, iridescence: 0.4 });

/* ---- Procedência: a verified badge — the wavy-edged seal everyone knows — with a check that draws itself */
export function makeBadge() {
  // the rosette: a circle with twelve soft scallops
  const R = 1;
  const s = new Shape();
  const N = 360;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const r = R * (1 + 0.075 * Math.cos(12 * a));
    if (i === 0) s.moveTo(r * Math.cos(a), r * Math.sin(a));
    else s.lineTo(r * Math.cos(a), r * Math.sin(a));
  }
  const { geo, front } = puffy(s, { depth: 0.14, bevel: 0.16, size: 0.12 });
  const badge = new Group();
  badge.add(new Mesh(geo, brandSkin()));

  // the check, a pearl stroke with rounded ends, on both faces; it is drawn from its short arm to its long one
  const pearl = pearlMaterial();
  const path = new CatmullRomCurve3([
    new Vector3(-0.4, 0.02, 0), new Vector3(-0.27, -0.12, 0), new Vector3(-0.12, -0.27, 0),
    new Vector3(0.1, -0.03, 0), new Vector3(0.28, 0.17, 0), new Vector3(0.44, 0.35, 0),
  ], false, 'catmullrom', 0.08);
  const SEG = 160;
  const RAD = 10;
  const tubeGeo = new TubeGeometry(path, SEG, 0.085, RAD, false);
  const capGeo = new SphereGeometry(0.085, 32, 20);
  const checks = [1, -1].map((face) => {
    const g = new Group();
    g.position.z = face * (front - 0.03);
    g.scale.set(face, 1, 0.5); // mirrored on the back so it reads the right way round from there too
    const tube = new Mesh(tubeGeo.clone(), pearl);
    const start = new Mesh(capGeo, pearl);
    const end = new Mesh(capGeo, pearl);
    start.position.copy(path.getPoint(0));
    g.add(tube, start, end);
    badge.add(g);
    return { tube, start, end };
  });

  return {
    obj: badge,
    height: 3.1, // a smaller presence than the iPhone and the bag
    svg: false,
    animate(t, grow) {
      // eased in and out, so the stroke starts gently and settles without a jolt
      const k = smooth(0.35, 0.95, grow);
      const segs = Math.round(k * SEG);
      checks.forEach(({ tube, start, end }) => {
        tube.geometry.setDrawRange(0, segs * RAD * 6);
        start.visible = end.visible = segs > 0;
        end.position.copy(path.getPointAt(Math.max(0.001, segs / SEG)));
      });
      badge.rotation.z = Math.sin(t * 0.7) * 0.03;
    },
  };
}

/* ---- Atendimento: a message bubble, soft and puffy, in the brand gradient, someone typing inside it */
export function makeBubble() {
  // the outline of the reference: a wide oval with a curved tail pointing down and to the left
  const RX = 1;
  const RY = 0.78;
  const a0 = (262 * Math.PI) / 180; // where the tail leaves the oval…
  const a1 = (240 * Math.PI) / 180; // …and where it comes back
  const FILLET = (6 * Math.PI) / 180; // the oval stops a little before each corner where the tail joins it
  const at = (a) => [RX * Math.cos(a), RY * Math.sin(a)];
  const mix = (p, q, k) => [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k];
  const s = new Shape();
  const A = at(a1); // the two corners
  const B = at(a0);
  // the tip is a small arc, not a point: wider than the rounded edge, so the inflated rim never folds over itself
  const TC = [-0.72, -1.02];
  const RT = 0.045;
  const ux = TC[0] - (A[0] + B[0]) / 2;
  const uy = TC[1] - (A[1] + B[1]) / 2;
  const ul = Math.hypot(ux, uy);
  const [px, py] = [-uy / ul, ux / ul]; // across the tail, towards its right edge
  const tipA = [TC[0] - px * RT, TC[1] - py * RT];
  const tipB = [TC[0] + px * RT, TC[1] + py * RT];
  const angA = Math.atan2(-py, -px);
  let angB = Math.atan2(py, px);
  if (angB < angA) angB += Math.PI * 2;
  // each corner is rounded by a short curve through it, so body and tail read as one continuous surface
  const fA = mix(A, tipA, 0.16);
  const fB = mix(B, tipB, 0.16);
  const start = at(a0 + FILLET);
  s.moveTo(start[0], start[1]);
  s.absellipse(0, 0, RX, RY, a0 + FILLET, a1 - FILLET + Math.PI * 2, false);
  s.quadraticCurveTo(A[0], A[1], fA[0], fA[1]);
  s.quadraticCurveTo(-0.59, -0.885, tipA[0], tipA[1]);
  s.absarc(TC[0], TC[1], RT, angA, angB, false);
  s.quadraticCurveTo(-0.45, -0.885, fB[0], fB[1]);
  s.quadraticCurveTo(B[0], B[1], start[0], start[1]);

  const { geo, front } = puffy(s, { depth: 0.22, bevel: 0.12, size: 0.06, offset: -0.015 });
  geo.translate(0, 0.12, 0);
  // the stage scales the outer group; the soft squash plays on the inner one
  const bubble = new Group();
  const body = new Group();
  bubble.add(body);
  body.add(new Mesh(geo, brandSkin()));

  // three pearl dots, typing, on both faces
  const pearl = pearlMaterial();
  const dotGeo = new SphereGeometry(0.105, 40, 28);
  const dots = [];
  [1, -1].forEach((face) => {
    [-0.36, 0, 0.36].forEach((x, i) => {
      const d = new Mesh(dotGeo, pearl);
      d.scale.z = 0.55;
      d.position.set(x * face, 0.12, face * (front - 0.02));
      d.userData.i = i;
      body.add(d);
      dots.push(d);
    });
  });

  return {
    obj: bubble,
    height: 3.0, // a smaller presence than the iPhone and the bag
    svg: false,
    animate(t, grow) {
      const live = smooth(0.3, 1, grow);
      dots.forEach((d) => {
        // the classic typing wave: each dot rises and brightens in turn
        const k = Math.max(0, Math.sin(t * 5 - d.userData.i * 0.9));
        d.position.y = 0.12 + k * 0.07 * live;
        d.scale.setScalar(0.85 + k * 0.2 * live);
        d.scale.z *= 0.55;
      });
      // a soft squash, like something just arrived
      const pop = 1 + Math.sin(t * 1.6) * 0.012 * live;
      body.scale.set(pop, 2 - pop, 1);
    },
  };
}
