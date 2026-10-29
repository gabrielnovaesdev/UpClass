import gsap from 'gsap';
import {
  CatmullRomCurve3,
  Color,
  DirectionalLight,
  AmbientLight,
  Float32BufferAttribute,
  Mesh,
  MeshPhysicalMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Texture,
  TubeGeometry,
  Vector3,
  VideoTexture,
  WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/*
 * 02 · A evolução — the film takes a body.
 * A WebGL panel plays the brand film as a texture. It starts small, in the brand's blue duotone, beside the
 * title; a glossy ribbon in the brand gradient wraps it (in front of and behind it — real depth, which is
 * why this is WebGL and not CSS). Scrolling pulls the panel to the player: it bows with the scroll speed,
 * colour is revealed by a wipe along the bolt's diagonal, and on landing the native <video> takes over,
 * pixel-aligned, so the film stays sharp, correctly framed and fully controllable.
 */

const vert = /* glsl */ `
  uniform float uBend;   // bow along the width, from scroll speed
  uniform float uCurl;   // diagonal twist while travelling
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    p.z += sin(uv.x * 3.14159265) * uBend;
    p.z += (uv.x - 0.5) * (uv.y - 0.5) * 2.0 * uCurl;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const frag = /* glsl */ `
  uniform sampler2D uTex;
  uniform vec2 uSize;     // panel size in px, for the rounded corners
  uniform float uRadius;
  uniform float uWipe;    // 0 = all duotone, 1 = full colour
  uniform float uAlpha;
  varying vec2 vUv;
  float roundBox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
  void main() {
    vec2 px = (vUv - 0.5) * uSize;
    float d = roundBox(px, uSize * 0.5, uRadius);
    float edge = 1.0 - smoothstep(-1.0, 0.5, d);
    vec3 c = texture2D(uTex, vUv).rgb;
    // brand duotone: navy → electric blue → cyan, driven by luminance
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    vec3 navy = vec3(0.004, 0.0, 0.2);
    vec3 blue = vec3(0.002, 0.051, 0.88);
    vec3 cyan = vec3(0.216, 1.0, 1.0);
    vec3 duo = l < 0.55 ? mix(navy, blue, l / 0.55) : mix(blue, cyan, (l - 0.55) / 0.45);
    // the reveal travels along the bolt's lean (≈ 60°), a thin pink seam of light at its front
    float diag = vUv.x * 0.62 + (1.0 - vUv.y) * 0.38;
    float front = uWipe * 1.3 - 0.15;
    float m = smoothstep(front - 0.06, front + 0.06, diag);
    vec3 col = mix(c, duo, m);
    float seam = (1.0 - smoothstep(0.0, 0.012, abs(diag - front))) * step(0.001, uWipe) * step(uWipe, 0.999);
    col += vec3(0.99, 0.22, 0.81) * seam * 0.6;
    gl_FragColor = vec4(col, edge * uAlpha);
    #include <colorspace_fragment>
  }
`;

// path of the ribbon in stage space: x/y as fractions of the stage, z in front (+) / behind (–) the panel
const RIBBON = [
  [-0.08, 0.06, -0.2], [0.18, 0.12, -0.1], [0.5, 0.02, -0.3], [0.78, 0.1, -0.5], [0.97, 0.24, -0.4],
  [0.99, 0.46, 0.35], [0.76, 0.62, 0.55], [0.56, 0.5, 0.2], [0.6, 0.3, -0.45], [0.9, 0.28, -0.3],
  [1.08, 0.62, 0.2], [0.82, 0.92, 0.4], [0.4, 0.86, 0.1], [0.12, 1.1, -0.1],
];
// mostly the brand's electric blue, warming to pink only towards its tail — colour, not glow
const RIBBON_STOPS = ['#2a6bff', '#063ff1', '#0a2ad8', '#3b2fe0', '#c63bd6'].map((h) => new Color(h));

export async function createEvolution({ host, canvas, video, poster }) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = SRGBColorSpace;

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.add(new AmbientLight(0xffffff, 0.4));
  const key = new DirectionalLight(0xffffff, 1.6);
  key.position.set(-2, 3, 4);
  scene.add(key);

  const camera = new PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 10);

  // ---- the film panel
  const posterTex = new Texture(poster);
  posterTex.colorSpace = SRGBColorSpace;
  posterTex.needsUpdate = true;
  const videoTex = new VideoTexture(video);
  videoTex.colorSpace = SRGBColorSpace;
  const uniforms = {
    uTex: { value: posterTex },
    uSize: { value: [1, 1] },
    uRadius: { value: 24 },
    uWipe: { value: 0 },
    uAlpha: { value: 1 },
    uBend: { value: 0 },
    uCurl: { value: 0 },
  };
  const panel = new Mesh(
    new PlaneGeometry(1, 1, 64, 36),
    new ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: true }),
  );
  scene.add(panel);
  const useVideo = () => { if (uniforms.uTex.value !== videoTex) uniforms.uTex.value = videoTex; };
  video.addEventListener('playing', useVideo);
  if (video.readyState >= 2 && !video.paused) useVideo();

  // ---- the ribbon
  const ribbonMat = new MeshPhysicalMaterial({
    vertexColors: true, roughness: 0.42, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.3, envMapIntensity: 0.55,
  });
  let ribbon = null;
  let ribbonCount = 0;

  // world units per pixel on the z = 0 plane
  let W = 1, H = 1, upp = 1;
  const toWorld = (x, y) => [(x - W / 2) * upp, (H / 2 - y) * upp];

  function buildRibbon() {
    if (ribbon) { ribbon.geometry.dispose(); scene.remove(ribbon); }
    const depth = Math.min(W, H) * upp * 0.35;
    const pts = RIBBON.map(([x, y, z]) => { const [wx, wy] = toWorld(x * W, y * H); return new Vector3(wx, wy, z * depth); });
    const curve = new CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
    const radius = Math.max(6, Math.min(W, H) * 0.0105) * upp;
    const geo = new TubeGeometry(curve, 720, radius, 20, false);
    // colour runs along the length of the ribbon
    const uv = geo.attributes.uv;
    const col = new Float32Array(uv.count * 3);
    const c = new Color();
    for (let i = 0; i < uv.count; i++) {
      const t = uv.getX(i) * (RIBBON_STOPS.length - 1);
      const k = Math.min(RIBBON_STOPS.length - 2, Math.floor(t));
      c.copy(RIBBON_STOPS[k]).lerp(RIBBON_STOPS[k + 1], t - k);
      col.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new Float32BufferAttribute(col, 3));
    ribbonCount = geo.index.count;
    ribbon = new Mesh(geo, ribbonMat);
    scene.add(ribbon);
    applyRibbon();
  }

  // state driven by the scroll timeline in sections.js
  const state = {
    rect: { x: 0, y: 0, w: 100, h: 56 }, // panel rect in host pixels
    tiltX: 0, tiltY: 0, bend: 0, curl: 0, wipe: 0, alpha: 1,
    ribbonA: 0, ribbonB: 0, // visible window of the ribbon along its length (0..1)
  };

  function applyRibbon() {
    if (!ribbon) return;
    const a = Math.floor((state.ribbonA * ribbonCount) / 6) * 6;
    const b = Math.floor((state.ribbonB * ribbonCount) / 6) * 6;
    ribbon.geometry.setDrawRange(a, Math.max(0, b - a));
    ribbon.visible = b - a > 0;
  }

  function resize() {
    W = host.clientWidth;
    H = host.clientHeight;
    if (!W || !H) return;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    upp = (2 * camera.position.z * Math.tan((camera.fov * Math.PI) / 360)) / H;
    buildRibbon();
  }

  function frame() {
    const { x, y, w, h } = state.rect;
    const [cx, cy] = toWorld(x + w / 2, y + h / 2);
    panel.position.set(cx, cy, 0);
    panel.scale.set(w * upp, h * upp, 1);
    panel.rotation.set(state.tiltX, state.tiltY, 0);
    uniforms.uSize.value = [w, h];
    uniforms.uRadius.value = Math.min(26, w * 0.04);
    uniforms.uWipe.value = state.wipe;
    uniforms.uAlpha.value = state.alpha;
    uniforms.uBend.value = state.bend * h * upp;
    uniforms.uCurl.value = state.curl * h * upp;
    panel.visible = state.alpha > 0.001;
    applyRibbon();
    renderer.render(scene, camera);
  }

  let running = false;
  const start = () => { if (!running) { running = true; gsap.ticker.add(frame); } };
  const stop = () => { if (running) { running = false; gsap.ticker.remove(frame); } };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  const io = new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()), { threshold: 0 });
  io.observe(host); // no rendering while the section is off screen
  start();

  return {
    state,
    dispose() {
      stop(); ro.disconnect(); io.disconnect();
      video.removeEventListener('playing', useVideo);
      renderer.dispose(); renderer.forceContextLoss();
    },
  };
}
