import gsap from 'gsap';
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Texture,
  VideoTexture,
  WebGLRenderer,
} from 'three';
import svgText from '../assets/bolt.svg?raw';

/*
 * 02 · A evolução — the film takes a body.
 * The brand's bolt stands beside the title, drawn in thousands of points of light that shimmer and part around the
 * cursor. Scrolling turns them into a river that curves into the film: the panel grows out of the bolt's centre
 * while they pour into it, its colour revealed by a wipe along the bolt's diagonal, and on landing the native
 * <video> takes over, pixel-aligned, so the film stays sharp and fully controllable. A few points stay out as dust
 * around the film; on the way out they rise and fade into the light mist of the next section.
 * Points and panel are two draws; everything moves in the vertex shader, so the stage keeps a steady frame rate.
 */

const panelVert = /* glsl */ `
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
const panelFrag = /* glsl */ `
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

// Every point is placed in screen pixels and moved here: gather (scattered → bolt), stream (bolt → panel, along a
// curve), dust (the few that stay out drift around the film) and exit (they rise and fade).
const pointsVert = /* glsl */ `
  attribute vec2 aBolt;    // position in the bolt's box, 0..1
  attribute vec2 aPanel;   // where it lands in the panel, 0..1
  attribute vec2 aAway;    // scattered start / dust spot, in screen fractions
  attribute vec4 aSeed;    // delay, swing, phase, size
  attribute float aDust;   // 1: stays out of the film as dust
  uniform vec2 uRes;
  uniform vec4 uBoltRect;  // x, y, w, h in px
  uniform vec4 uPanelRect;
  uniform vec2 uPointer;
  uniform float uTime;
  uniform float uGather;
  uniform float uFlow;
  uniform float uExit;
  uniform float uPx;       // device pixels per css pixel
  varying float vAlpha;
  varying float vTone;

  float ease(float x) { return x * x * (3.0 - 2.0 * x); }

  void main() {
    float t = uTime;
    // the bolt, breathing a little; points part around the cursor
    vec2 bolt = uBoltRect.xy + aBolt * uBoltRect.zw;
    bolt += vec2(sin(t * 0.9 + aSeed.z * 6.283), cos(t * 0.75 + aSeed.z * 4.1)) * (1.2 + aSeed.w * 1.6);
    vec2 dp = bolt - uPointer;
    float r2 = dot(dp, dp);
    bolt += dp / (sqrt(r2) + 1.0) * 46.0 * exp(-r2 / 9800.0) * (1.0 - uFlow);

    // gather: from a loose cloud into the bolt, each point on its own beat
    float g = ease(clamp((uGather - aSeed.x * 0.5) / 0.5, 0.0, 1.0));
    vec2 scattered = aAway * uRes + (aBolt - 0.5) * uBoltRect.zw * 2.2;
    vec2 pos = mix(scattered, bolt, g);

    // stream: along a curve that swings out and dips before reaching its spot in the panel (or its dust spot)
    float f = clamp((uFlow - aSeed.x * 0.5) / 0.5, 0.0, 1.0);
    float fe = ease(f);
    vec2 inPanel = uPanelRect.xy + aPanel * uPanelRect.zw;
    vec2 dust = aAway * uRes + vec2(sin(t * 0.21 + aSeed.z * 9.0), cos(t * 0.17 + aSeed.z * 7.0)) * 26.0;
    vec2 target = mix(inPanel, dust, aDust);
    vec2 span = target - pos;
    vec2 side = vec2(-span.y, span.x);
    // one shared arc (out to the left and up, then down into the film), each point a little off it: a river
    vec2 ctrl = pos + span * 0.5 + side * (0.42 + (aSeed.y - 0.5) * 0.36) * (1.0 - aDust);
    pos = mix(mix(pos, ctrl, fe), mix(ctrl, target, fe), fe);

    // exit: everything still out rises with the page and thins away
    float ex = uExit * (0.7 + aSeed.y * 0.8);
    pos.y -= ex * uRes.y * 0.55;

    // the points that pour into the film shrink and fade as they arrive; the dust stays fine and faint
    float arrive = (1.0 - aDust) * smoothstep(0.62, 1.0, f);
    vAlpha = g * (1.0 - arrive) * (1.0 - smoothstep(0.0, 0.85, uExit)) * mix(1.0, 0.55, aDust * f);
    vTone = clamp(aBolt.y * 0.8 + aSeed.z * 0.35, 0.0, 1.0);

    // a little larger in mid-flight, as if they caught the light
    float size = (1.7 + aSeed.w * 2.8) * mix(1.0, 0.7, aDust * f) * (1.0 - arrive * 0.8) * (1.0 + sin(fe * 3.14159) * 0.5 * (1.0 - aDust));
    gl_PointSize = size * uPx;
    gl_Position = vec4(pos.x / uRes.x * 2.0 - 1.0, 1.0 - pos.y / uRes.y * 2.0, 0.0, 1.0);
  }
`;
const pointsFrag = /* glsl */ `
  uniform vec3 uCyan;
  uniform vec3 uBlue;
  uniform vec3 uPink;
  varying float vAlpha;
  varying float vTone;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    a *= a;
    // cyan at the top of the bolt, the brand's blue through the middle, pink towards the tail
    vec3 col = vTone < 0.5 ? mix(uCyan, uBlue, vTone * 2.0) : mix(uBlue, uPink, (vTone - 0.5) * 2.0);
    // a white-hot core in the bigger points
    col = mix(col, vec3(1.0), smoothstep(0.18, 0.0, d) * 0.45);
    gl_FragColor = vec4(col * 1.5, a * vAlpha);
    #include <colorspace_fragment>
  }
`;

// points inside the bolt's two halves, some on their outline so the shape reads crisp
function sampleBolt(count) {
  const vb = svgText.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
  const paths = [...svgText.matchAll(/ d="([^"]+)"/g)].map((m) => new Path2D(m[1]));
  const g = document.createElement('canvas').getContext('2d');
  g.lineWidth = 5;
  const out = new Float32Array(count * 2);
  for (let i = 0; i < count; ) {
    const x = vb[0] + Math.random() * vb[2];
    const y = vb[1] + Math.random() * vb[3];
    const edge = i % 4 === 0; // a quarter of them trace the outline
    if (paths.some((p) => (edge ? g.isPointInStroke(p, x, y) : g.isPointInPath(p, x, y)))) {
      out[i * 2] = (x - vb[0]) / vb[2];
      out[i * 2 + 1] = (y - vb[1]) / vb[3];
      i++;
    }
  }
  return { points: out, aspect: vb[2] / vb[3] };
}

export async function createEvolution({ host, canvas, video, poster, lite = false }) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = SRGBColorSpace;

  const scene = new Scene();
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
    new ShaderMaterial({ uniforms, vertexShader: panelVert, fragmentShader: panelFrag, transparent: true, depthTest: false, depthWrite: false }),
  );
  panel.renderOrder = 1;
  scene.add(panel);
  const useVideo = () => { if (uniforms.uTex.value !== videoTex) uniforms.uTex.value = videoTex; };
  video.addEventListener('playing', useVideo);
  if (video.readyState >= 2 && !video.paused) useVideo();

  // ---- the points of light
  const COUNT = lite ? 3200 : 6400;
  const DUST = 0.12;
  const { points: boltPts, aspect } = sampleBolt(COUNT);
  const panelPts = new Float32Array(COUNT * 2);
  const away = new Float32Array(COUNT * 2);
  const seed = new Float32Array(COUNT * 4);
  const dust = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    panelPts.set([Math.random(), Math.random()], i * 2);
    const isDust = Math.random() < DUST;
    dust[i] = isDust ? 1 : 0;
    // dust keeps to the margins around the film; the cloud that gathers into the bolt starts around it
    const ax = isDust ? (Math.random() < 0.5 ? Math.random() * 0.14 : 0.86 + Math.random() * 0.14) : 0.45 + Math.random() * 0.55;
    away.set([isDust ? (Math.random() < 0.3 ? Math.random() : ax) : ax, Math.random()], i * 2);
    // the delay follows the bolt's diagonal, so the river leaves from its tip first
    const along = boltPts[i * 2] * 0.35 + (1 - boltPts[i * 2 + 1]) * 0.65;
    seed.set([gsap.utils.clamp(0, 1, along * 0.8 + Math.random() * 0.2), Math.random(), Math.random(), Math.random() ** 2], i * 4);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(new Float32Array(COUNT * 3), 3)); // placed in the shader
  geo.setAttribute('aBolt', new Float32BufferAttribute(boltPts, 2));
  geo.setAttribute('aPanel', new Float32BufferAttribute(panelPts, 2));
  geo.setAttribute('aAway', new Float32BufferAttribute(away, 2));
  geo.setAttribute('aSeed', new Float32BufferAttribute(seed, 4));
  geo.setAttribute('aDust', new Float32BufferAttribute(dust, 1));
  const pu = {
    uRes: { value: [1, 1] },
    uBoltRect: { value: [0, 0, 1, 1] },
    uPanelRect: { value: [0, 0, 1, 1] },
    uPointer: { value: [-9999, -9999] },
    uTime: { value: 0 },
    uGather: { value: 0 },
    uFlow: { value: 0 },
    uExit: { value: 0 },
    uPx: { value: dpr },
    uCyan: { value: new Color('#7ff3ff') },
    uBlue: { value: new Color('#2f6bff') },
    uPink: { value: new Color('#fc39ce') },
  };
  const points = new Points(geo, new ShaderMaterial({
    uniforms: pu, vertexShader: pointsVert, fragmentShader: pointsFrag,
    transparent: true, depthTest: false, depthWrite: false, blending: AdditiveBlending,
  }));
  points.frustumCulled = false; // every position comes from the shader
  points.renderOrder = 2;
  scene.add(points);

  // world units per pixel on the z = 0 plane
  let W = 1, H = 1, upp = 1;
  const toWorld = (x, y) => [(x - W / 2) * upp, (H / 2 - y) * upp];

  // state driven by the scroll timeline in evo-section.js
  const state = {
    rect: { x: 0, y: 0, w: 100, h: 56 }, // panel rect in host pixels
    bolt: { x: 0, y: 0, w: 10, h: 10 }, // the bolt's box in host pixels
    tiltX: 0, tiltY: 0, bend: 0, curl: 0, wipe: 0, alpha: 1,
    gather: 0, flow: 0, exit: 0,
    pointer: [-9999, -9999],
    aspect,
  };

  function resize() {
    W = host.clientWidth;
    H = host.clientHeight;
    if (!W || !H) return;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    upp = (2 * camera.position.z * Math.tan((camera.fov * Math.PI) / 360)) / H;
    pu.uRes.value = [W, H];
  }

  function frame(time) {
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

    const b = state.bolt;
    pu.uBoltRect.value = [b.x, b.y, b.w, b.h];
    pu.uPanelRect.value = [x, y, w, h];
    pu.uPointer.value = state.pointer;
    pu.uTime.value = time;
    pu.uGather.value = state.gather;
    pu.uFlow.value = state.flow;
    pu.uExit.value = state.exit;
    points.visible = state.gather > 0 && state.exit < 1;
    renderer.render(scene, camera);
  }

  let running = false;
  const start = () => { if (!running) { running = true; gsap.ticker.add(frame); } };
  const stop = () => { if (running) { running = false; gsap.ticker.remove(frame); } };
  resize();
  // compile both programs and upload the poster now: the panel first shows mid-scroll, where a stall would show
  renderer.compile(scene, camera);
  renderer.initTexture(posterTex);
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
      geo.dispose();
      renderer.dispose(); renderer.forceContextLoss();
    },
  };
}
