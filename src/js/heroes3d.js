import {
  BufferGeometry,
  CanvasTexture,
  EdgesGeometry,
  EllipseCurve,
  Group,
  Line,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshPhysicalMaterial,
  SRGBColorSpace,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { VB_H } from './bolt3d.js';

/*
 * The objects of "Detalhes" besides the iPhone (iphone3d.js). Each one returns { obj, height, svg, animate }:
 * `height` is the object's height in its own units (the stage scales it), `svg` says it is built in svg units
 * (y pointing down), and animate(t, grow) plays it — grow goes 0 → 1 as its word reaches the middle of the screen.
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
  tex.anisotropy = 4;
  return tex;
}

function drawBolt(g, img, cx, cy, h) {
  if (!img) return;
  const w = (h * img.width) / img.height;
  g.drawImage(img, cx - w / 2, cy - h / 2, w, h);
}

/* ---- Procedência: the Upclass box, its lid opening on the glow inside */
export function makeBox(boltImg) {
  const W = 0.92;
  const H = 1.5;
  const D = 0.4;
    const box = new Group();

  // the lid's face: the brand's navy, the light of the bolt and the name, like the real packaging
  const faceTex = canvasTexture(512, 836, (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, w * 0.3, h);
    bg.addColorStop(0, '#0a07a8');
    bg.addColorStop(0.5, '#02007c');
    bg.addColorStop(1, '#000229');
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    const glow = g.createRadialGradient(w / 2, h * 0.44, 10, w / 2, h * 0.44, w * 0.7);
    glow.addColorStop(0, 'rgba(252, 57, 206, 0.42)');
    glow.addColorStop(1, 'rgba(252, 57, 206, 0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, w, h);
    drawBolt(g, boltImg, w / 2, h * 0.44, h * 0.36);
    g.fillStyle = 'rgba(241, 239, 250, 0.92)';
    g.font = '58px Ibrand, Gotham, sans-serif';
    g.textAlign = 'center';
    g.fillText('upclass', w / 2, h * 0.86);
  });
  // inside: soft lilac paper lit by the bolt
  const innerTex = canvasTexture(512, 836, (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#f6f3ff');
    bg.addColorStop(1, '#d9d3f7');
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    const glow = g.createRadialGradient(w / 2, h / 2, 6, w / 2, h / 2, w * 0.55);
    glow.addColorStop(0, 'rgba(252, 57, 206, 0.5)');
    glow.addColorStop(0.5, 'rgba(6, 63, 241, 0.16)');
    glow.addColorStop(1, 'rgba(6, 63, 241, 0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, w, h);
    drawBolt(g, boltImg, w / 2, h / 2, h * 0.3);
  });

  const navy = new MeshPhysicalMaterial({ color: 0x07084a, roughness: 0.32, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.12 });
  // the lid's sides catch the brand gradient, from magenta to blue
  const edge = new MeshPhysicalMaterial({ color: 0xd92b82, roughness: 0.22, metalness: 0.35, clearcoat: 1, iridescence: 0.7, iridescenceIOR: 1.5 });
  const face = new MeshPhysicalMaterial({
    map: faceTex, emissive: 0xffffff, emissiveMap: faceTex, emissiveIntensity: 0.6, roughness: 0.45, clearcoat: 0.35, clearcoatRoughness: 0.3, envMapIntensity: 0.5,
  });
  // the base: soft lilac paper, lit from inside by the bolt
  const paper = new MeshPhysicalMaterial({ map: innerTex, emissive: 0xffffff, emissiveMap: innerTex, emissiveIntensity: 0.45, roughness: 0.55, clearcoat: 0.3 });

  // box faces: +x, -x, +y, -y, +z, -z
  const base = new Mesh(new RoundedBoxGeometry(W - 0.035, H, D - 0.035, 4, 0.02), [paper, paper, paper, navy, paper, paper]);
  box.add(base);
  // the lid covers all but a band at the bottom and slides up, as on the real box
  const LID_H = H * 0.86;
  const lid = new Mesh(new RoundedBoxGeometry(W, LID_H, D, 5, 0.03), [edge, edge, navy, navy, face, face]);
  const closedY = (H - LID_H) / 2 + 0.006;
  lid.position.y = closedY;
  box.add(lid);

  return {
    obj: box,
    height: H * 1.25,
    svg: false,
    animate(t, grow) {
      // the lid rises once the word arrives, then floats a little above the base
      const open = smooth(0.4, 1, grow);
      lid.position.y = closedY + open * (H * 0.32 + Math.sin(t * 1.2) * H * 0.025);
      lid.rotation.z = open * Math.sin(t * 0.8) * 0.03;
    },
  };
}

/* ---- Precisão: the mark drawn by its construction lines, then poured into chrome */
export function makeConstruction(mark) {
  const chrome = new MeshPhysicalMaterial({
    color: 0xe4e0fb, roughness: 0.14, metalness: 1, clearcoat: 1, clearcoatRoughness: 0.06,
    iridescence: 0.55, iridescenceIOR: 1.4, iridescenceThicknessRange: [220, 560], envMapIntensity: 1.6,
    transparent: true, opacity: 0,
  });
  const ink = new LineBasicMaterial({ color: 0x063ff1, transparent: true, opacity: 1 });
  const guideInk = new LineBasicMaterial({ color: 0x5b4bd6, transparent: true, opacity: 0.6 });
  mark.model.traverse((m) => {
    if (!m.isMesh) return;
    m.material = chrome;
    const lines = new LineSegments(new EdgesGeometry(m.geometry, 28), ink);
    m.parent.add(lines);
    lines.position.copy(m.position);
  });

  // the guides of the drawing: circles around the mark and the diagonal its two bolts share
  const guides = new Group();
  const circle = (r) => new Line(new BufferGeometry().setFromPoints(new EllipseCurve(0, 0, r, r).getPoints(96).map((p) => new Vector3(p.x, p.y, 0))), guideInk);
  [118, 196, 300].forEach((r) => guides.add(circle(r)));
  const diag = new Line(new BufferGeometry().setFromPoints([new Vector3(-240, 330, 0), new Vector3(240, -330, 0)]), guideInk);
  const cross = new Line(new BufferGeometry().setFromPoints([new Vector3(-330, 0, 0), new Vector3(330, 0, 0)]), guideInk);
  guides.add(diag, cross);
  mark.model.add(guides);

  return {
    obj: mark.model,
    height: VB_H,
    svg: true,
    animate(t, grow) {
      const k = smooth(0.35, 1, grow);
      chrome.opacity = k;
      chrome.depthWrite = k > 0.9;
      ink.opacity = 0.12 + 0.88 * (1 - k);
      guideInk.opacity = 0.14 + 0.5 * (1 - k);
      guides.rotation.z = t * 0.12;
      // an exploded view that closes as the drawing becomes the object
      mark.bolts[0].position.z = mark.bolts[0].userData.home.z + (1 - k) * 70;
      mark.bolts[1].position.z = mark.bolts[1].userData.home.z - (1 - k) * 70;
    },
  };
}

/* ---- Pós-venda: the two bolts in crystal, coming together and staying together */
export function makeCrystal(mark) {
  const crystal = (color, glow) => new MeshPhysicalMaterial({
    color, emissive: glow, emissiveIntensity: 0.4, metalness: 0.1, roughness: 0.06,
    clearcoat: 1, clearcoatRoughness: 0.02, iridescence: 0.9, iridescenceIOR: 1.6, iridescenceThicknessRange: [180, 620],
    specularIntensity: 1, envMapIntensity: 2.4, transparent: true, opacity: 0.82,
  });
  const mats = [crystal(0x8fb0ff, 0x2f6bff), crystal(0xff9be0, 0xfc39ce)];
  mark.bolts.forEach((bolt, i) => bolt.traverse((m) => { if (m.isMesh) m.material = mats[i]; }));

  return {
    obj: mark.model,
    height: VB_H,
    svg: true,
    animate(t, grow) {
      const meet = smooth(0.25, 1, grow);
      const apart = 1 - meet + (Math.sin(t * 1.4) * 0.5 + 0.5) * 0.05 * meet; // together, with a slow heartbeat
      const [a, b] = mark.bolts;
      a.position.set(a.userData.home.x + apart * 95, a.userData.home.y - apart * 125, a.userData.home.z);
      b.position.set(b.userData.home.x - apart * 95, b.userData.home.y + apart * 125, b.userData.home.z);
      a.rotation.z = -apart * 0.35;
      b.rotation.z = -apart * 0.35;
    },
  };
}
