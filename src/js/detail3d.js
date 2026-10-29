import {
  CanvasTexture,
  Color,
  DirectionalLight,
  ExtrudeGeometry,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  NeutralToneMapping,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  CylinderGeometry,
  WebGLRenderer,
} from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildMark, VB_H } from './bolt3d.js';

/*
 * The 3D stage of "Detalhes" (detail.js drives it). One canvas over the section holds:
 * - one object per word, rising with it and turning on its own: the mark in pearl (Construção), the mark in its
 *   colours (Dois raios), the two bolts sliding along their arrows (Upgrade) and a phone (Celular);
 * - a field of small brand pieces (bolts, phones, arrows) in frosted pearl, spread in depth: they drift and turn
 *   all the time and slide with the scroll at a speed that depends on their distance, so the space reads as deep.
 * The light mist of the page is the fog, so the far pieces dissolve into it.
 */

const MIST = 0xdfe0f4;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const rand = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })(); // stable layout

function roundedRect(w, h, r) {
  const s = new Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// a flat rounded panel whose UVs span the whole rectangle (ShapeGeometry would use raw coordinates)
function panel(w, h, r) {
  const geo = new ShapeGeometry(roundedRect(w, h, r), 12);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h + 0.5);
  return geo;
}

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

function makePhone(boltImg) {
  const W = 0.78;
  const H = 1.6;
  const D = 0.085;
  const phone = new Group();
  const frame = new MeshPhysicalMaterial({ color: 0xd9d5ef, metalness: 0.9, roughness: 0.26, clearcoat: 0.6, clearcoatRoughness: 0.2 });
  phone.add(new Mesh(new RoundedBoxGeometry(W, H, D, 6, 0.11), frame));
  const screen = new Mesh(panel(W - 0.06, H - 0.06, 0.085), new MeshBasicMaterial({ map: screenTexture(boltImg), toneMapped: false }));
  screen.position.z = D / 2 + 0.002;
  phone.add(screen);
  // the back: frosted glass in the brand's lilac, a camera plateau with three lenses
  const back = new Mesh(panel(W - 0.05, H - 0.05, 0.09), new MeshPhysicalMaterial({ color: 0xbdb6ee, roughness: 0.45, clearcoat: 0.5, iridescence: 0.35 }));
  back.position.z = -D / 2 - 0.002;
  back.rotation.y = Math.PI;
  phone.add(back);
  const plateau = new Mesh(new RoundedBoxGeometry(0.34, 0.34, 0.03, 4, 0.06), new MeshPhysicalMaterial({ color: 0xcfc9f3, metalness: 0.4, roughness: 0.3, clearcoat: 1 }));
  plateau.position.set(0.17, 0.55, -D / 2 - 0.012);
  phone.add(plateau);
  const lensMat = new MeshPhysicalMaterial({ color: 0x0b0c2a, metalness: 0.3, roughness: 0.08, clearcoat: 1 });
  const lensGeo = new CylinderGeometry(0.058, 0.058, 0.04, 28);
  [[0.1, 0.62], [0.1, 0.48], [0.24, 0.55]].forEach(([x, y]) => {
    const l = new Mesh(lensGeo, lensMat);
    l.rotation.x = Math.PI / 2;
    l.position.set(x, y, -D / 2 - 0.03);
    phone.add(l);
  });
  phone.userData.height = H;
  return phone;
}

function centred(geo) {
  geo.computeBoundingBox();
  const b = geo.boundingBox;
  const h = b.max.y - b.min.y;
  geo.translate(-(b.min.x + b.max.x) / 2, -(b.min.y + b.max.y) / 2, -(b.min.z + b.max.z) / 2);
  geo.scale(1 / h, 1 / h, 1 / h); // unit height
  geo.rotateX(Math.PI); // svg y points down; a turn (not a mirror) keeps the faces pointing outwards
  return geo;
}

function pieceGeometries(svgText) {
  const [upper] = new SVGLoader().parse(svgText).paths.map((p) => SVGLoader.createShapes(p));
  const bolt = centred(new ExtrudeGeometry(upper, { depth: 28, bevelEnabled: true, bevelThickness: 10, bevelSize: 6, bevelSegments: 3, curveSegments: 10 }));
  const phone = new RoundedBoxGeometry(0.5, 1, 0.08, 3, 0.08);
  // an arrow, as in the arrows built into the mark
  const a = new Shape();
  a.moveTo(0, 0.5); a.lineTo(0.42, 0.06); a.lineTo(0.16, 0.06); a.lineTo(0.16, -0.5);
  a.lineTo(-0.16, -0.5); a.lineTo(-0.16, 0.06); a.lineTo(-0.42, 0.06); a.lineTo(0, 0.5);
  const arrow = new ExtrudeGeometry(a, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 2 });
  arrow.translate(0, 0, -0.05);
  return [bolt, phone, arrow];
}

export async function createDetailStage(canvas, host, svgText, { lite = false } = {}) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lite ? 1.5 : 1.75));
  renderer.toneMapping = NeutralToneMapping;
  renderer.outputColorSpace = SRGBColorSpace;

  const scene = new Scene();
  scene.fog = new Fog(MIST, 11, 24);
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
  pmrem.dispose();
  const camera = new PerspectiveCamera(30, 1, 0.1, 60);
  camera.position.set(0, 0, 12);
  const key = new DirectionalLight(0xffffff, 1.1);
  key.position.set(-4, 5, 6);
  const rimPink = new DirectionalLight(0xff4fd8, 1.2);
  rimPink.position.set(-6, -3, -2);
  const rimBlue = new DirectionalLight(0x2f6bff, 1.2);
  rimBlue.position.set(6, 4, -3);
  scene.add(new HemisphereLight(0xffffff, new Color(MIST), 0.9), key, rimPink, rimBlue);

  // ---- the four protagonists
  const [colour, upgrade, pearl, boltImg] = await Promise.all([
    buildMark(renderer, svgText),
    buildMark(renderer, svgText),
    buildMark(renderer, svgText),
    loadImage('/img/bolt-art-700.webp'),
  ]);
  // Construção: the mark in polished chrome with a pearly film, like a precision part
  const pearlMat = new MeshPhysicalMaterial({
    color: 0xe4e0fb, roughness: 0.14, metalness: 1, clearcoat: 1, clearcoatRoughness: 0.06,
    iridescence: 0.55, iridescenceIOR: 1.4, iridescenceThicknessRange: [220, 560], envMapIntensity: 1.6,
  });
  pearl.model.traverse((m) => { if (m.isMesh) m.material = pearlMat; });
  const phone = makePhone(boltImg);
  const heroes = [pearl.model, colour.model, upgrade.model, phone].map((obj, i) => {
    const holder = new Group();
    holder.add(obj);
    holder.userData = { obj, height: i === 3 ? phone.userData.height : VB_H, svg: i < 3 };
    holder.visible = false;
    scene.add(holder);
    return holder;
  });

  // ---- the field of small pieces
  const geos = pieceGeometries(svgText);
  // frosted pearl: lit from inside a little, so no face ever turns grey against the mist
  const glass = new MeshPhysicalMaterial({
    color: 0xffffff, emissive: 0xd9d6f6, emissiveIntensity: 0.55, roughness: 0.45, metalness: 0,
    clearcoat: 1, clearcoatRoughness: 0.2, iridescence: 0.5, iridescenceIOR: 1.3,
    transparent: true, opacity: 0.88, envMapIntensity: 1,
  });
  const pieces = [];
  const count = lite ? 14 : 26;
  for (let i = 0; i < count; i++) {
    const m = new Mesh(geos[i % 3], glass);
    const z = -9 + rand() * 10.5;
    m.userData = {
      x: (rand() - 0.5) * 2, y: rand(), z,
      s: (i % 3 === 0 ? 0.42 : 0.36) * (0.7 + rand() * 0.6),
      rx: rand() * 6, ry: rand() * 6,
      vx: (rand() - 0.5) * 0.5, vy: 0.2 + rand() * 0.5,
      depth: 0.55 + ((z + 9) / 10.5) * 0.7, // nearer pieces slide faster with the scroll
    };
    m.scale.setScalar(m.userData.s);
    scene.add(m);
    pieces.push(m);
  }

  let visibleH = 1;
  let aspect = 1;
  let hostH = 1;
  function resize() {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = aspect = w / h;
    camera.updateProjectionMatrix();
    visibleH = 2 * camera.position.z * Math.tan((camera.fov * Math.PI) / 360);
    hostH = h;
  }
  resize();

  const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
  return {
    resize,
    pointer(x, y) { ptr.tx = x; ptr.ty = y; },
    /**
     * c: the scroll cursor (index of the word at the centre, fractional); slot: pixels between two words;
     * t: seconds; scrolled: pixels scrolled through the section (for the field's parallax).
     */
    frame(c, slot, t, scrolled) {
      const pxToWorld = visibleH / hostH;
      const narrow = aspect < 0.8;
      const objH = visibleH * (narrow ? 0.2 : 0.3);
      ptr.x += (ptr.tx - ptr.x) * 0.04;
      ptr.y += (ptr.ty - ptr.y) * 0.04;
      camera.position.x = ptr.x * 0.6;
      camera.position.y = -ptr.y * 0.4;
      camera.lookAt(0, 0, 0);

      heroes.forEach((holder, i) => {
        const d = i - c;
        // pops in as its word reaches the middle, stays with it on the way up, then lets go
        const show = smooth(0.62, 0.1, d) * smooth(-1.6, -1.0, d);
        holder.visible = show > 0.002;
        if (!holder.visible) return;
        const grow = 1 - Math.pow(1 - show, 3);
        const unit = objH / holder.userData.height;
        holder.userData.obj.scale.set(unit, holder.userData.svg ? -unit : unit, unit);
        holder.scale.setScalar(0.35 + 0.65 * grow);
        holder.position.set(0, -d * slot * pxToWorld + (narrow ? 0.035 : 0.02) * visibleH, 0.8);
        holder.rotation.y = t * 0.55 + i * 1.3 + (1 - grow) * 2.2;
        holder.rotation.x = Math.sin(t * 0.5 + i) * 0.14;
        holder.rotation.z = Math.sin(t * 0.37 + i * 2) * 0.05;
        if (i === 2) {
          // the arrows built into the bolts: the upper one goes up, the lower one goes down, and back
          const k = Math.sin(t * 1.6) * 0.5 + 0.5;
          upgrade.bolts[0].position.y = upgrade.bolts[0].userData.home.y - k * 46;
          upgrade.bolts[1].position.y = upgrade.bolts[1].userData.home.y + k * 46;
        }
      });

      const spanY = visibleH * 1.9;
      pieces.forEach((m) => {
        const u = m.userData;
        const zH = 2 * (camera.position.z - u.z) * Math.tan((camera.fov * Math.PI) / 360); // visible height at that depth
        const y = u.y * spanY + scrolled * pxToWorld * u.depth * 0.55 + t * 0.06 * u.vy;
        const wrapped = (((y % spanY) + spanY) % spanY) - spanY / 2;
        m.position.set(u.x * zH * aspect * 0.55 + Math.sin(t * 0.2 + u.rx) * 0.3, wrapped * (zH / visibleH), u.z);
        m.rotation.set(u.rx + t * 0.3 * u.vy, u.ry + t * 0.4 * (u.vx + 0.3), Math.sin(t * 0.3 + u.ry) * 0.4);
      });
      renderer.render(scene, camera);
    },
    dispose() {
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
