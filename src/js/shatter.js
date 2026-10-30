import {
  CanvasTexture,
  Color,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  Shape,
  SRGBColorSpace,
} from 'three';

/*
 * The hero's mirror floor, breaking. When the mark dives through it, the floor (painted in a 2D canvas by hero.js)
 * is swapped for the very same picture cut into shards of glass: fine wedges around the point of impact, wider
 * pieces further out, as real tempered glass breaks. The cracks open first, then the pieces burst — the nearest
 * up and towards you, the rest outwards — tumble, catch the light on their faces and edges, and fall out of the
 * frame. The break runs on the scroll, not on the clock: stop and it freezes mid-air, go back and the shards fly
 * back into the mirror.
 * Everything is built in advance (the impact is always under the mark's resting place), so the moment of the break
 * costs nothing.
 */

const rand = (() => { let s = 11; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();

// a convex polygon cut by the half-plane closer to `a` than to `b` (one step of a Voronoi cell)
function clip(poly, a, b) {
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const nx = b[0] - a[0];
  const ny = b[1] - a[1];
  const side = (p) => (p[0] - mx) * nx + (p[1] - my) * ny; // < 0: on a's side
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const sp = side(p);
    const sq = side(q);
    if (sp <= 0) out.push(p);
    if ((sp < 0) !== (sq < 0)) {
      const t = sp / (sp - sq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return out;
}

export function createShatter({ scene, lite = false }) {
  const group = new Group();
  group.visible = false;
  scene.add(group);

  let tex = null;
  const face = new MeshPhysicalMaterial({
    color: 0x000000, // the picture is the mirror itself: shown as emission, untouched by the lights
    emissive: new Color(0xffffff),
    emissiveIntensity: 1,
    roughness: 0.08,
    metalness: 0,
    specularIntensity: 0.7,
    clearcoat: 0.4,
    clearcoatRoughness: 0.03,
    // only a breath of the room on the glass: the glints come from the brand's pink and blue lights as each piece turns
    envMapIntensity: 0.05,
    toneMapped: false,
  });
  // the cut edges of the glass: thin, bright, a little lavender, as thick glass looks from the side
  const edge = new MeshBasicMaterial({ color: 0xbdb4f0, transparent: true, opacity: 0.38, toneMapped: false });

  let shards = [];
  let built = null;

  /**
   * Cut the floor into shards. region: the mirror in world units { left, right, top, bottom }; impact: { x, y };
   * picture: the 2D canvas the floor is painted in (it is the shards' texture).
   */
  function build(region, impact, picture) {
    shards.forEach((s) => { s.mesh.geometry.dispose(); group.remove(s.mesh); });
    shards = [];
    tex?.dispose();
    tex = new CanvasTexture(picture);
    tex.colorSpace = SRGBColorSpace;
    face.emissiveMap = tex;
    face.needsUpdate = true;

    const { left, right, top, bottom } = region;
    const W = right - left;
    const H = top - bottom;
    const unit = H; // the scale of the break follows the mirror's own size
    // sites: rings around the impact, tight and many near it (long thin wedges), sparse further out, plus a few
    // scattered over the whole floor so the far glass breaks into large plates
    const sites = [[impact.x, impact.y - unit * 0.012]];
    const rings = lite ? 5 : 7;
    for (let k = 1; k <= rings; k++) {
      const r = unit * 0.05 * Math.pow(1.62, k);
      const n = (lite ? 5 : 7) + k * (lite ? 2 : 3);
      const off = rand() * Math.PI * 2;
      for (let j = 0; j < n; j++) {
        const a = off + ((j + 0.15 + rand() * 0.7) / n) * Math.PI * 2;
        const rr = r * (0.82 + rand() * 0.36);
        sites.push([impact.x + Math.cos(a) * rr * 1.5, impact.y + Math.sin(a) * rr]);
      }
    }
    for (let j = 0; j < (lite ? 8 : 14); j++) sites.push([left + rand() * W, bottom + rand() * H]);
    const inside = sites.filter((p) => p[0] > left && p[0] < right && p[1] < top && p[1] > bottom);

    const frame = [[left, bottom], [right, bottom], [right, top], [left, top]];
    const depth = unit * 0.014;
    inside.forEach((site, i) => {
      let cell = frame;
      for (let j = 0; j < inside.length && cell.length > 2; j++) if (j !== i) cell = clip(cell, site, inside[j]);
      if (cell.length < 3) return;
      let cx = 0;
      let cy = 0;
      cell.forEach((p) => { cx += p[0]; cy += p[1]; });
      cx /= cell.length;
      cy /= cell.length;
      const shape = new Shape(cell.map(([x, y]) => ({ x: x - cx, y: y - cy })));
      const geo = new ExtrudeGeometry(shape, { depth, bevelEnabled: false });
      geo.translate(0, 0, -depth);
      // the picture lands on each piece exactly where that piece was in the mirror
      const pos = geo.attributes.position;
      const uv = new Float32Array(pos.count * 2);
      for (let v = 0; v < pos.count; v++) {
        uv[v * 2] = (pos.getX(v) + cx - left) / W;
        uv[v * 2 + 1] = (pos.getY(v) + cy - bottom) / H;
      }
      geo.setAttribute('uv', new Float32BufferAttribute(uv, 2));
      const mesh = new Mesh(geo, [face, edge]);
      mesh.position.set(cx, cy, 0);
      group.add(mesh);

      // its flight: the nearer the impact, the sooner it goes and the harder it is thrown
      const dx = cx - impact.x;
      const dy = cy - impact.y;
      const d = Math.hypot(dx, dy) || 1e-3;
      const near = Math.exp(-d / (unit * 0.28));
      const speed = unit * (0.35 + 2.1 * near) * (0.8 + rand() * 0.4);
      shards.push({
        mesh,
        home: [cx, cy],
        delay: 0.012 + (d / unit) * 0.09 + rand() * 0.03,
        v: [(dx / d) * speed * 0.9, unit * (0.9 * near + 0.08) + (dy / d) * speed * 0.25, unit * (0.4 + rand() * 2.2) * (0.3 + near)],
        w: [(rand() - 0.5) * 7 * (0.4 + near), (rand() - 0.5) * 7 * (0.4 + near), (rand() - 0.5) * 3],
      });
    });
    built = { unit, bottom };
    return tex;
  }

  return {
    group,
    build,
    get built() { return !!built; },
    /**
     * Pose the break at `t`: seconds of the break's own clock, which the scroll drives (hero.js), so the glass
     * freezes when the page stops and flies back into the mirror when the page goes back up. t ≤ 0: the mirror is
     * whole.
     */
    at(t) {
      if (!built || t <= 0) { group.visible = false; return; }
      const g = built.unit * 8.5; // gravity, in the mirror's own scale
      const crack = Math.min(1, t / 0.05);
      let any = false;
      shards.forEach((s) => {
        const u = Math.max(0, t - s.delay);
        const m = s.mesh;
        // the cracks open (each piece shrinks a hair around its centre) a moment before it leaves
        m.scale.setScalar(1 - 0.016 * crack);
        m.position.set(
          s.home[0] + s.v[0] * u,
          s.home[1] + s.v[1] * u - 0.5 * g * u * u,
          Math.min(2.2, s.v[2] * u),
        );
        m.rotation.set(s.w[0] * u, s.w[1] * u, s.w[2] * u);
        m.visible = m.position.y > built.bottom - built.unit * 1.2;
        any ||= m.visible;
      });
      group.visible = any;
    },
  };
}
