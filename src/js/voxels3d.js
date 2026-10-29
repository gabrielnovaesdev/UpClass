import {
  BackSide,
  BufferGeometry,
  CanvasTexture,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
} from 'three';

/*
 * The floating field's pieces, in the language of Noomo's background: pixel icons built out of solid blocks, crisp
 * and matte, catching the brand's coloured rim lights on their steps. The icons speak for the store: its mark, the
 * phone, headphones, a watch, the bag, a message, the verified check, the upgrade arrow, a heart and a spark.
 *
 * Each icon is drawn as a grid: '#' a block one unit deep, '+' a raised block (deeper, on both faces) for the
 * details that should stand out, '.' empty. The mesher emits only the faces that can be seen (a side face only where
 * the neighbour is lower), so even the most detailed icon stays a light, single draw.
 */

const ICONS = {
  // the mark: the two bolts of the logo, one above the other
  logo: [
    '......++++',
    '.....++++.',
    '....++++..',
    '...+++++..',
    '..+++++++.',
    '....++++..',
    '...++++...',
    '..+++.....',
    '....####..',
    '...####...',
    '..#######.',
    '...####...',
    '..####....',
    '.####.....',
    '.###......',
    '.##.......',
  ],
  phone: [
    '.+++++++++.',
    '+++++#+++++',
    '++#######++',
    '++#######++',
    '++#######++',
    '++#######++',
    '++#######++',
    '++#######++',
    '++#######++',
    '++#######++',
    '++#######++',
    '++#######++',
    '+++++++++++',
    '++++#+#++++',
    '.+++++++++.',
  ],
  headphones: [
    '....######....',
    '..##########..',
    '.###......###.',
    '.##........##.',
    '##..........##',
    '##..........##',
    '##..........##',
    '+++........+++',
    '++++......++++',
    '++++......++++',
    '++++......++++',
    '++++......++++',
    '.+++......+++.',
  ],
  watch: [
    '..######..',
    '..######..',
    '..######..',
    '.++++++++.',
    '++######++',
    '++######++',
    '++######+++',
    '++######++',
    '++######++',
    '.++++++++.',
    '..######..',
    '..######..',
    '..######..',
  ],
  bag: [
    '....####....',
    '...##..##...',
    '...#....#...',
    '...#....#...',
    '############',
    '############',
    '#####++#####',
    '####++######',
    '###+++++####',
    '#####++#####',
    '####++######',
    '############',
    '.##########.',
  ],
  message: [
    '..##########..',
    '.############.',
    '##############',
    '##############',
    '###++##++##++#',
    '###++##++##++#',
    '##############',
    '##############',
    '.############.',
    '..##########..',
    '..###.........',
    '.###..........',
    '.##...........',
  ],
  check: [
    '.....####.....',
    '..##########..',
    '.############.',
    '##############',
    '###########++#',
    '##########++##',
    '#++######++###',
    '##++####++####',
    '###++##++#####',
    '####++++######',
    '.####++######.',
    '..##########..',
    '....######....',
  ],
  arrow: [
    '....++....',
    '...++++...',
    '..++++++..',
    '.++++++++.',
    '++++++++++',
    '...####...',
    '...####...',
    '...####...',
    '...####...',
    '...####...',
    '...####...',
  ],
  heart: [
    '..###...###..',
    '.#####.#####.',
    '#++##########',
    '#+###########',
    '#############',
    '.###########.',
    '..#########..',
    '...#######...',
    '....#####....',
    '.....###.....',
    '......#......',
  ],
  spark: [
    '....#....',
    '....#....',
    '...###...',
    '..##+##..',
    '##++++##.',
    '..##+##..',
    '...###...',
    '....#....',
    '....#....',
  ].map((r) => r.padEnd(9, '.')),
};

const DEPTH = { '#': 1, '+': 1.6 };

// one icon → one geometry, about one unit tall, centred, faces flat-shaded
function mesh(rows) {
  const H = rows.length;
  const W = Math.max(...rows.map((r) => r.length));
  const depth = (x, y) => (y < 0 || y >= H || x < 0 || x >= W ? 0 : DEPTH[rows[y][x]] || 0);
  const s = 1 / Math.max(W, H); // block size
  const pos = [];
  const nor = [];
  const quad = (a, b, c, d, n) => {
    for (const p of [a, b, c, a, c, d]) pos.push(...p);
    for (let i = 0; i < 6; i++) nor.push(...n);
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const h = depth(x, y);
      if (!h) continue;
      const x0 = (x - W / 2) * s;
      const x1 = x0 + s;
      const y1 = (H / 2 - y) * s; // grid rows go down, space goes up
      const y0 = y1 - s;
      const z = (h * s) / 2;
      quad([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], [0, 0, 1]); // front
      quad([x1, y0, -z], [x0, y0, -z], [x0, y1, -z], [x1, y1, -z], [0, 0, -1]); // back
      // a side only where the neighbour is lower: the strip between its depth and ours, on both faces
      const sides = [
        [x + 1, y, [x1, y0], [x1, y1], [1, 0, 0]],
        [x - 1, y, [x0, y1], [x0, y0], [-1, 0, 0]],
        [x, y - 1, [x1, y1], [x0, y1], [0, 1, 0]],
        [x, y + 1, [x0, y0], [x1, y0], [0, -1, 0]],
      ];
      for (const [nx, ny, [ax, ay], [bx, by], n] of sides) {
        const hn = depth(nx, ny);
        if (hn >= h) continue;
        const zn = (hn * s) / 2;
        if (hn === 0) {
          quad([ax, ay, -z], [bx, by, -z], [bx, by, z], [ax, ay, z], n);
        } else {
          quad([ax, ay, zn], [bx, by, zn], [bx, by, z], [ax, ay, z], n);
          quad([ax, ay, -z], [bx, by, -z], [bx, by, -zn], [ax, ay, -zn], n);
        }
      }
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  geo.computeBoundingSphere();
  return geo;
}

export function voxelIcons() {
  return Object.values(ICONS).map(mesh);
}

/* The room the pieces reflect: the page itself. A lavender sphere like the mist, with the sky's lights as soft panels
   around it — the warm glow above, the brand's pink low on the left, its blue up on the right, a breath of cyan below —
   so every face of a block mirrors the colours that are on the screen as it sways, the way glazed porcelain would. */
export function skyEnvironment(renderer) {
  const room = new Scene();
  room.add(new Mesh(new SphereGeometry(10, 32, 16), new MeshBasicMaterial({ color: 0xbab6de, side: BackSide })));
  const panel = (color, k, x, y, z, w, h) => {
    const m = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ color, side: BackSide }));
    m.material.color.multiplyScalar(k);
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    room.add(m);
  };
  panel(0xfff3f8, 2, 0, 9, 0, 12, 6); // the warm glow overhead
  panel(0xff4fd0, 1.6, -9, -1, 2, 7, 12); // pink on the left
  panel(0x3f74ff, 1.6, 9, 1, 2, 7, 12); // blue on the right
  panel(0x8ff2ff, 1.1, 0, -9, 2, 12, 5); // cyan from below
  panel(0xffffff, 1.35, 0, 0, 9, 9, 7); // the screen in front: faces turned to you read bright
  const pmrem = new PMREMGenerator(renderer);
  const env = pmrem.fromScene(room, 0.03).texture;
  pmrem.dispose();
  return env;
}

/* Glazed porcelain for the floating pieces: a lavender body (never paper white, so it stands out from the mist), a
   clear glaze that mirrors the room above, and a thin pearly film that turns pink to blue as the faces tilt. Three
   tints, so the field is not uniform. */
export function glazeMaterials(env, { lite = false } = {}) {
  const tints = [
    0xebe4f6, // pink-leaning
    0xe3e6f8, // blue-leaning
    0xe8e4f4, // violet, in between
  ];
  return tints.map((color) => new MeshPhysicalMaterial({
    color, envMap: env, envMapIntensity: 0.62,
    roughness: 0.24, metalness: 0,
    clearcoat: 0.55, clearcoatRoughness: 0.14,
    iridescence: lite ? 0 : 0.22, iridescenceIOR: 1.35, iridescenceThicknessRange: [160, 480],
  }));
}
