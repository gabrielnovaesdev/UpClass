import {
  AdditiveBlending,
  BackSide,
  CanvasTexture,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  SRGBColorSpace,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/*
 * An iPhone Pro in desert titanium, built to the real proportions (71.5 × 149.6 × 8.25 mm, scaled to 1.6 units tall):
 * flat titanium sides with softened edges, a matte glass back with the polished logo, the raised glass camera plateau
 * with its three lenses (titanium rings, layered dark glass), flash, LiDAR and microphone, the side buttons and the
 * USB-C port. The front shows the brand's screen.
 */

const MM = 1.6 / 149.6; // units per millimetre
const W = 71.5 * MM;
const H = 149.6 * MM;
const D = 8.25 * MM;
const R = 11.5 * MM; // corner radius of the body
const BEVEL = 0.7 * MM; // softened edge between the flat sides and the faces

const TITANIUM = 0xb3a08c;
const GLASS_BACK = 0xbfb4a8;

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

// a flat rounded panel whose UVs span the whole rectangle
function panel(w, h, r) {
  const geo = new ShapeGeometry(roundedRect(w, h, r), 16);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h + 0.5);
  return geo;
}

// a rounded slab centred on z = 0
function slab(w, h, r, depth, bevel) {
  const geo = new ExtrudeGeometry(roundedRect(w - 2 * bevel, h - 2 * bevel, Math.max(0.001, r - bevel)), {
    depth: Math.max(0.0005, depth - 2 * bevel), bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel,
    bevelSegments: 5, curveSegments: 18,
  });
  geo.translate(0, 0, -(depth - 2 * bevel) / 2);
  return geo;
}

function canvasTexture(size, draw, h = size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = h;
  draw(c.getContext('2d'), size, h);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// the front element of a lens: black glass with concentric layers and a cool reflection across it
function lensTexture() {
  return canvasTexture(256, (g, s) => {
    const c = s / 2;
    g.fillStyle = '#07080d';
    g.fillRect(0, 0, s, s);
    const rings = [[1, '#1b1c22'], [0.86, '#0b0c12'], [0.72, '#16171f'], [0.62, '#05060a'], [0.44, '#101320'], [0.3, '#030409']];
    rings.forEach(([r, col]) => { g.fillStyle = col; g.beginPath(); g.arc(c, c, c * r, 0, Math.PI * 2); g.fill(); });
    // coatings: violet and blue sheen on the inner glass
    const sheen = g.createRadialGradient(c * 0.8, c * 0.75, 2, c, c, c * 0.62);
    sheen.addColorStop(0, 'rgba(110, 120, 200, 0.32)');
    sheen.addColorStop(0.5, 'rgba(50, 45, 90, 0.18)');
    sheen.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.fillStyle = sheen;
    g.beginPath(); g.arc(c, c, c * 0.62, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(160, 170, 220, 0.18)';
    g.lineWidth = 2;
    [0.86, 0.62, 0.44].forEach((r) => { g.beginPath(); g.arc(c, c, c * r, 0, Math.PI * 2); g.stroke(); });
    // window reflection
    g.fillStyle = 'rgba(255, 255, 255, 0.5)';
    g.beginPath(); g.ellipse(c * 0.72, c * 0.68, c * 0.12, c * 0.06, -0.7, 0, Math.PI * 2); g.fill();
  });
}

// the textured glass of the back: the tone falls off a little towards the bottom, with a very fine grain
function backTexture() {
  return canvasTexture(256, (g, w, h) => {
    const base = '#' + GLASS_BACK.toString(16).padStart(6, '0');
    const grad = g.createLinearGradient(0, 0, w * 0.4, h);
    grad.addColorStop(0, '#c9bfb4');
    grad.addColorStop(0.45, base);
    grad.addColorStop(1, '#b0a497');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    const img = g.getImageData(0, 0, w, h);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 6;
      img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
    }
    g.putImageData(img, 0, 0);
  }, 512);
}

// the logo, as an alpha mask (white = polished)
function logoMask() {
  return canvasTexture(256, (g, s) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, s, s);
    g.save();
    g.translate(s * 0.5 - 50 * 2, s * 0.5 - 62 * 2);
    g.scale(2, 2);
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(50, 33);
    g.bezierCurveTo(42, 27, 30, 25, 20, 30);
    g.bezierCurveTo(8, 36, 3, 50, 4, 64);
    g.bezierCurveTo(5, 84, 16, 108, 30, 117);
    g.bezierCurveTo(37, 121, 42, 118, 50, 116);
    g.bezierCurveTo(58, 118, 63, 121, 70, 117);
    g.bezierCurveTo(80, 111, 88, 98, 94, 84);
    g.bezierCurveTo(80, 78, 74, 64, 78, 52);
    g.bezierCurveTo(80, 44, 85, 39, 90, 36);
    g.bezierCurveTo(82, 27, 70, 25, 60, 29);
    g.bezierCurveTo(56, 30, 53, 32, 50, 33);
    g.closePath();
    g.fill();
    // the leaf
    g.beginPath();
    g.moveTo(50, 28);
    g.bezierCurveTo(49, 16, 56, 6, 68, 3);
    g.bezierCurveTo(69, 15, 62, 26, 50, 28);
    g.closePath();
    g.fill();
    g.restore();
  });
}

/* What the iPhone reflects: a product-shot studio rather than the page's even mist. A quieter lavender surround with
   a large softbox above and long white strips at the sides, so the titanium, the glass and the cover catch crisp
   highlights against darker reflections instead of one flat tone. Only the iPhone uses it; the other objects keep
   the shared studio (heroes3d.js). */
function phoneEnvironment(renderer) {
  const studio = new Scene();
  studio.add(new Mesh(new SphereGeometry(10, 32, 16), new MeshBasicMaterial({ color: 0x9c9ab4, side: BackSide })));
  const light = (color, k, x, y, z, w, h) => {
    const m = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ color, side: DoubleSide }));
    m.material.color.multiplyScalar(k);
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    studio.add(m);
  };
  light(0xffffff, 3.2, -2, 7, 4, 8, 4); // softbox above, a little to the left, like the key light
  light(0xffffff, 2.6, 6, 0, 5, 1.2, 12); // long strip front right: the line down the frame and across the glass
  light(0xffffff, 1.8, -7, 0, 2, 1, 10); // thinner strip on the left
  light(0xffd9f2, 1.4, -6, -3, -5, 5, 6); // brand tints behind, faint
  light(0xd6e2ff, 1.4, 6, 3, -5, 5, 6);
  light(0xeeeefa, 1.2, 0, -7, 2, 10, 3); // a light floor, so no dark outline along the lower edges
  const pmrem = new PMREMGenerator(renderer);
  const env = pmrem.fromScene(studio, 0.02).texture;
  pmrem.dispose();
  return env;
}

export function makeIphone(screenTex, renderer) {
  const phone = new Group();

  // ---- materials
  // brushed titanium: satin metal, a little lighter along the brushing; it lives on its reflections, so it takes the
  // studio a little brighter than the other objects do
  const titanium = new MeshPhysicalMaterial({
    color: TITANIUM, metalness: 1, roughness: 0.22, anisotropy: 0.65, clearcoat: 0.4, clearcoatRoughness: 0.2, envMapIntensity: 1.9,
  });
  // the back: textured matte glass (a dielectric, so no metalness: that only greyed it), the colour of the frame a
  // shade lighter, with a soft satin sheen from the coat
  const backGlass = new MeshPhysicalMaterial({
    color: 0xffffff, map: backTexture(), metalness: 0, roughness: 0.38, clearcoat: 0.7, clearcoatRoughness: 0.28, envMapIntensity: 1.5,
  });
  // the camera plateau is polished glass of the same tint
  const plateauGlass = new MeshPhysicalMaterial({
    color: 0xd6c7b6, metalness: 0.2, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.7,
  });
  const ringMat = new MeshPhysicalMaterial({ color: 0xdccbb8, metalness: 0.85, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.8 });
  const lensMat = new MeshPhysicalMaterial({ map: lensTexture(), metalness: 0.2, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.4 });
  const darkMat = new MeshPhysicalMaterial({ color: 0x14141a, metalness: 0.4, roughness: 0.25, clearcoat: 1 });

  // ---- body: flat titanium sides, softened edges
  phone.add(new Mesh(slab(W, H, R, D, BEVEL), titanium));

  // ---- front: the screen behind a thin black border
  const front = new Group();
  front.position.z = D / 2;
  const glassFront = new Mesh(panel(W - 2 * BEVEL - 0.002, H - 2 * BEVEL - 0.002, R - BEVEL), new MeshPhysicalMaterial({ color: 0x050507, roughness: 0.05, clearcoat: 1 }));
  glassFront.position.z = 0.0012;
  const screen = new Mesh(panel(W - 2 * BEVEL - 2.6 * MM, H - 2 * BEVEL - 2.6 * MM, R - BEVEL - 1.2 * MM), new MeshBasicMaterial({ map: screenTex, toneMapped: false }));
  screen.position.z = 0.0018;
  // the cover glass over the screen: black and added on top, so only its reflection of the studio shows
  const cover = new Mesh(panel(W - 2 * BEVEL - 0.002, H - 2 * BEVEL - 0.002, R - BEVEL), new MeshPhysicalMaterial({
    color: 0x000000, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 0.6,
    transparent: true, blending: AdditiveBlending, depthWrite: false,
  }));
  cover.position.z = 0.0024;
  front.add(glassFront, screen, cover);
  phone.add(front);

  // ---- back, laid out as you see it from behind (camera top left)
  const back = new Group();
  back.rotation.y = Math.PI;
  back.position.z = -D / 2;
  phone.add(back);
  const glass = new Mesh(panel(W - 2 * BEVEL - 0.5 * MM, H - 2 * BEVEL - 0.5 * MM, R - BEVEL - 0.3 * MM), backGlass);
  glass.position.z = 0.0012;
  back.add(glass);

  // the polished logo, a little above the middle
  const logoH = 15 * MM;
  const logo = new Mesh(new PlaneGeometry(logoH, logoH), new MeshPhysicalMaterial({
    color: 0xc4b3a1, metalness: 0.8, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05, alphaMap: logoMask(), transparent: true,
  }));
  logo.position.set(0, 4 * MM, 0.0022);
  back.add(logo);

  // the camera plateau: 37 mm square, 4 mm from the edges, rising in two steps like the real one
  const P = 37.5 * MM;
  const cam = new Group();
  cam.position.set(-W / 2 + 4.6 * MM + P / 2, H / 2 - 4.6 * MM - P / 2, 0);
  back.add(cam);
  const plateau = new Mesh(slab(P, P, 10.5 * MM, 1.4 * MM, 0.5 * MM), plateauGlass);
  plateau.position.z = 0.7 * MM;
  cam.add(plateau);
  const top = 1.4 * MM;

  // three lenses: titanium ring, a darker inner bezel and the glass element
  const lensR = 8.3 * MM;
  const ringGeo = new CylinderGeometry(lensR, lensR, 1.9 * MM, 64);
  const bezelGeo = new CylinderGeometry(lensR * 0.8, lensR * 0.8, 1.95 * MM, 64);
  const glassGeo = new CylinderGeometry(lensR * 0.74, lensR * 0.74, 2 * MM, 64);
  [[-0.245, 0.245], [-0.245, -0.245], [0.25, 0]].forEach(([x, y]) => {
    const lens = new Group();
    lens.position.set(x * P, y * P, top);
    [[ringGeo, ringMat], [bezelGeo, darkMat], [glassGeo, lensMat]].forEach(([geo, mat], k) => {
      const m = new Mesh(geo, mat);
      m.rotation.x = Math.PI / 2;
      m.position.z = 0.95 * MM + k * 0.03 * MM;
      lens.add(m);
    });
    cam.add(lens);
  });
  // flash (warm frosted), LiDAR (dark) and the microphone
  const flash = new Mesh(new CylinderGeometry(2.9 * MM, 2.9 * MM, 0.4 * MM, 40), new MeshPhysicalMaterial({ color: 0xf3ead8, roughness: 0.5, transmission: 0.3, clearcoat: 1 }));
  flash.rotation.x = Math.PI / 2;
  flash.position.set(0.27 * P, 0.3 * P, top + 0.2 * MM);
  const lidar = new Mesh(new CylinderGeometry(3 * MM, 3 * MM, 0.4 * MM, 40), darkMat);
  lidar.rotation.x = Math.PI / 2;
  lidar.position.set(0.27 * P, -0.3 * P, top + 0.2 * MM);
  const mic = new Mesh(new CylinderGeometry(0.7 * MM, 0.7 * MM, 0.3 * MM, 20), darkMat);
  mic.rotation.x = Math.PI / 2;
  mic.position.set(0.02 * P, 0.4 * P, top + 0.15 * MM);
  cam.add(flash, lidar, mic);

  // ---- buttons on the titanium sides
  const button = (len, x, y) => {
    const b = new Mesh(new RoundedBoxGeometry(1.1 * MM, len, 3.2 * MM, 4, 0.5 * MM), titanium);
    b.position.set(x, y, 0);
    phone.add(b);
  };
  const sx = W / 2 + 0.1 * MM;
  button(5.2 * MM, -sx, H / 2 - 27 * MM); // action button
  button(9 * MM, -sx, H / 2 - 40 * MM); // volume up
  button(9 * MM, -sx, H / 2 - 52 * MM); // volume down
  button(17 * MM, sx, H / 2 - 44 * MM); // side button
  // camera control: flush sapphire in a titanium surround
  const control = new Mesh(new RoundedBoxGeometry(1 * MM, 15 * MM, 3.6 * MM, 4, 0.5 * MM), new MeshPhysicalMaterial({ color: 0xb59f88, metalness: 0.6, roughness: 0.1, clearcoat: 1 }));
  control.position.set(W / 2 + 0.1 * MM, -H / 2 + 52 * MM, 0);
  phone.add(control);

  // ---- bottom: USB-C port between the speaker and microphone holes
  const port = new Mesh(new RoundedBoxGeometry(9 * MM, 1.2 * MM, 3.2 * MM, 4, 0.6 * MM), darkMat);
  port.position.set(0, -H / 2, 0);
  phone.add(port);
  const holeGeo = new CylinderGeometry(0.55 * MM, 0.55 * MM, 0.6 * MM, 12);
  [-1, 1].forEach((side) => {
    for (let i = 0; i < 6; i++) {
      const h = new Mesh(holeGeo, darkMat);
      h.position.set(side * (9.5 + i * 1.7) * MM, -H / 2 - 0.05 * MM, 0);
      phone.add(h);
    }
  });

  if (renderer) {
    const env = phoneEnvironment(renderer);
    phone.traverse((o) => { if (o.material?.isMeshStandardMaterial) o.material.envMap = env; });
  }

  phone.userData.height = H;
  return phone;
}
