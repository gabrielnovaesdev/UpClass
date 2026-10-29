import { BufferGeometry, CanvasTexture, Float32BufferAttribute, MeshMatcapMaterial, SRGBColorSpace } from 'three';

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

/* The pieces' material: porcelain painted into a matcap, so every icon reads the same wherever it floats — faces turned
   to you bright white, faces turning away a cool grey-blue, the steps picking up the brand's pink on one side and blue
   on the other. Nothing in it is darker than that grey-blue, so no edge can ever turn into a dark outline. */
export function porcelainMaterial() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#b9bedb';
  g.fillRect(0, 0, 256, 256);
  const body = g.createRadialGradient(108, 96, 6, 128, 128, 128);
  body.addColorStop(0, '#ffffff');
  body.addColorStop(0.45, '#f6f6fd');
  body.addColorStop(0.72, '#e2e4f3');
  body.addColorStop(0.9, '#c9cde6');
  body.addColorStop(1, '#bcc1de');
  g.fillStyle = body;
  g.beginPath(); g.arc(128, 128, 128, 0, Math.PI * 2); g.fill();
  const tint = (x, y, col) => {
    const t = g.createRadialGradient(x, y, 0, x, y, 120);
    t.addColorStop(0, col);
    t.addColorStop(1, 'rgba(255, 255, 255, 0)');
    g.fillStyle = t;
    g.fillRect(0, 0, 256, 256);
  };
  tint(40, 200, 'rgba(252, 57, 206, 0.22)'); // pink from the lower left
  tint(220, 70, 'rgba(70, 120, 255, 0.2)'); // blue from the upper right
  const matcap = new CanvasTexture(c);
  matcap.colorSpace = SRGBColorSpace;
  return new MeshMatcapMaterial({ matcap });
}
