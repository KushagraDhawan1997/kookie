import * as THREE from "three";

import type { Sound } from "./sound";

/**
 * The Kookify engine: stickers slapped over the page, drawn by Three.js on one transparent
 * canvas that never takes the pointer. Input is read on window in the capture phase and only
 * claimed when it lands on a sticker's opaque pixels, so the page keeps its clicks and scroll.
 * Stickers live in page coordinates and follow whichever element scrolls the page.
 */

export type Engine = {
  slap(): void;
  clear(): Promise<void>;
  rescan(): void;
  dispose(): void;
};

type Art = { tex: THREE.Texture; w: number; h: number; alpha: Uint8ClampedArray; aw: number; ah: number };

type State = "wait" | "slap" | "idle" | "held" | "glide" | "fly";

type Sticker = {
  art: Art;
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  shadow: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  state: State;
  /** Centre in page px. */
  x: number;
  y: number;
  rot: number;
  /** Long side in px when resting. */
  size: number;
  z: number;
  t0: number;
  lift: number;
  curl: number;
  curlTarget: number;
  /** Grab point as a fraction of the sticker, y up, from its centre. */
  gx: number;
  gy: number;
  squashAt: number;
  squashAmp: number;
  vx: number;
  vy: number;
  vr: number;
};

const SLAP_MS = 95;
const SQUASH_MS = 65;
const HOLD_MS = 300;
const GLIDE_MAX = 2.4; // px per ms
const GLIDE_TAU = 70; // ms for momentum to fall to a third
const LIFT_Z = 60; // px the whole sticker rises toward the viewer while held
const PEEL_FOLD = 0.16; // how far inside the grab the paper starts to lift, × the short side
const PEEL_RADIUS = 0.05; // radius of the roll, × the short side
const LIFT_TAU = 28; // ms; about 100ms to fully lifted
const Z_STEP = 50;

/**
 * The peel, shared by a sticker and its shadow. Everything beyond a fold line a little inside
 * the grabbed point (toward the sticker's centre) rolls up off the page around a cylinder, then
 * carries on straight, so the held edge lifts toward the viewer and shows its backing.
 * `peelPoint` below is the same maths for one point, used to keep the grab under the pointer.
 */
const CURL_GLSL = /* glsl */ `
uniform vec2 uGrab;
uniform float uCurl;
uniform float uRadius;
uniform float uFold;
vec3 peel(vec2 p, out float angle) {
  angle = 0.0;
  if (uCurl < 0.001) return vec3(p, 0.0);
  vec2 d = normalize(-uGrab);
  float t = dot(p - uGrab, d);
  float u = uFold - t;
  if (u <= 0.0) return vec3(p, 0.0);
  float amax = uCurl * 2.4;
  float a = u / uRadius;
  float tn;
  float z;
  if (a <= amax) {
    tn = uFold - uRadius * sin(a);
    z = uRadius * (1.0 - cos(a));
    angle = a;
  } else {
    float rest = u - amax * uRadius;
    tn = uFold - uRadius * sin(amax) - rest * cos(amax);
    z = uRadius * (1.0 - cos(amax)) + rest * sin(amax);
    angle = amax;
  }
  return vec3(p + d * (tn - t), z);
}
`;

const STICKER_VERT = /* glsl */ `
uniform vec2 uSize;
uniform vec2 uSquash;
uniform vec2 uEye;
uniform float uDist;
uniform float uLift;
varying vec2 vUv;
varying float vA;
varying vec2 vScreen;
${CURL_GLSL}
void main() {
  vUv = uv;
  vec3 q = peel(position.xy * uSize, vA);
  q.xy *= uSquash;
  vec4 world = modelMatrix * vec4(q.xy, 0.0, 1.0);
  // Perspective toward a viewer at the middle of the screen: what lifts off the page grows.
  float z = q.z + uLift;
  world.xy = uEye + (world.xy - uEye) * (uDist / (uDist - z));
  world.z += z;
  vScreen = vec2(world.x, -world.y);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

/**
 * Holographic film. The art is printed on a pearly silver foil: rainbow bands run in wide
 * diagonal sweeps and faint streaks fan out from the light, and both slide as the light moves.
 * The foil shows through light ink (the border, white fur) and hides under dark ink, so Kookie
 * stays clear. The backing of a peeled edge is brushed silver with a faint rainbow.
 */
const STICKER_FRAG = /* glsl */ `
uniform sampler2D uTex;
uniform float uOpacity;
uniform vec2 uBlur;
uniform float uZoom;
uniform vec2 uLight;
uniform float uTime;
uniform float uPhase;
uniform float uFoil;
varying vec2 vUv;
varying float vA;
varying vec2 vScreen;

vec3 spectrum(float h) {
  // Pink, violet, cyan and yellow rather than a hard rainbow.
  return 0.5 + 0.5 * cos(6.2831853 * (h + vec3(0.0, 0.33, 0.67)));
}

float hash(float n) { return fract(sin(n) * 43758.5453); }

/**
 * Silver foil at a screen point: brightness streaks like brushed metal catching the light,
 * with an iridescent tint that is faint in general and strong where the light glints.
 */
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

vec3 foil(vec2 q, float shift, out float glint) {
  vec2 rel = q - uLight;
  float dist = length(rel);
  float sweep = dot(q, vec2(0.7071, 0.7071)) / 1100.0;
  float fan = atan(rel.y, rel.x) / 6.2831853;
  // Fine rays fanning out from the light, irregular like real film: thin, sharp, many.
  // Fine rays fanning out from the light, irregular like real film. They turn slowly,
  // flicker, and pulse outward, so the foil is alive even when the light holds still.
  float turn = fan + uTime * 0.012;
  float wobble = 0.35 * sin(6.2831853 * (turn * 7.0 + uPhase + uTime * 0.05)) + 0.2 * sin(6.2831853 * turn * 19.0);
  float ray = pow(0.5 + 0.5 * sin(6.2831853 * (turn * 72.0 + wobble)), 10.0);
  ray *= 0.55 + 0.45 * sin(6.2831853 * (turn * 13.0 + uTime * 0.4 + uPhase));
  ray *= 0.6 + 0.4 * sin(dist / 140.0 - uTime * 2.0 + turn * 30.0);
  float streak = sin(6.2831853 * (sweep * 2.5 + turn * 4.0 + uPhase));
  glint = pow(max(0.0, 1.0 - dist / 650.0), 2.5);
  float metal = 0.84 + 0.06 * streak + 0.14 * ray + 0.14 * glint;
  // Whole turns of hue around the light, so the bands never break where the angle wraps.
  vec3 tint = spectrum(sweep * 3.0 + fan * 2.0 + ray * 0.12 + dist / 1600.0 + uPhase + shift);
  vec3 film = metal * mix(vec3(1.0), tint, 0.4 + 0.3 * glint + 0.15 * ray);
  // Particles riding out along the rays, twinkling as they go.
  float rad = (dist - uTime * 60.0) / 22.0;
  vec2 pc = vec2(floor(turn * 240.0), floor(rad));
  float ph = hash2(pc);
  vec2 pf = vec2(fract(turn * 240.0), fract(rad)) - 0.5;
  float dot = smoothstep(0.5, 0.1, length(pf * vec2(1.0, 2.0)));
  float twinkle = 0.5 + 0.5 * sin(uTime * 7.0 + ph * 40.0);
  float particle = step(0.982, ph) * dot * twinkle * (1.0 - smoothstep(150.0, 900.0, dist));
  // And a fine scatter of specks across the film, each blinking on its own beat.
  vec2 cell = floor(q / 1.5);
  float sh = hash2(cell);
  float speck = step(0.9975, sh) * (0.5 + 0.5 * sin(uTime * 5.0 + sh * 60.0));
  return film + particle * (0.35 + 0.5 * glint) + speck * (0.2 + 0.5 * glint);
}

void main() {
  vec4 c;
  bool sharp = false;
  if (uZoom > 1e-4) {
    c = vec4(0.0);
    for (int i = 0; i < 7; i++) {
      c += texture2D(uTex, (vUv - 0.5) * (1.0 - uZoom * float(i) / 6.0) + 0.5);
    }
    c /= 7.0;
  } else if (dot(uBlur, uBlur) > 1e-7) {
    c = vec4(0.0);
    for (int i = 0; i < 7; i++) {
      c += texture2D(uTex, vUv + uBlur * (float(i) / 6.0 - 0.5));
    }
    c /= 7.0;
  } else {
    c = texture2D(uTex, vUv);
    sharp = true;
  }
  if (sharp) {
    // At rest the die-cut edge is resolved to one screen pixel, however far the art is scaled.
    float edge = max(fwidth(c.a), 1e-4);
    float a = clamp((c.a - 0.5) / edge + 0.5, 0.0, 1.0);
    c *= a / max(c.a, 1e-4);
  }
  if (c.a < 0.004) discard;
  vec3 col = c.rgb / c.a;
  float glint;
  if (gl_FrontFacing) {
    vec3 holo = foil(vScreen, vA * 0.25, glint);
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    // The photo is ink over the foil: light and mid tones let the rainbow film show through,
    // dark ink (eyes, nose, dark fur) covers it. The border is bare film.
    float show = smoothstep(0.12, 0.85, lum) * min(uFoil, 1.25);
    col = mix(col, col * holo * 1.12, 0.85 * show) + glint * show * 0.12;
    // Turning away from the light as it rolls up.
    col *= 0.8 + 0.2 * cos(vA);
  } else {
    vec3 holo = foil(vScreen, 0.5, glint);
    float brushed = 0.035 * (hash(floor(vUv.y * 900.0)) - 0.5);
    vec3 silver = vec3(0.8 + brushed) * mix(vec3(1.0), holo, 0.35);
    col = silver * (0.82 + 0.14 * -cos(vA)) + glint * 0.18;
  }
  gl_FragColor = vec4(min(col, 1.0) * c.a, c.a) * uOpacity;
}
`;

const SHADOW_VERT = /* glsl */ `
uniform vec2 uSize;
uniform vec2 uSquash;
uniform vec2 uCast;
varying vec2 vUv;
${CURL_GLSL}
void main() {
  vUv = (uv - 0.5) * 1.35 + 0.5;
  float angle;
  // The shadow follows the peel flattened onto the page, pushed further out the higher it lifts.
  vec3 q = peel(position.xy * uSize * 1.35, angle);
  vec2 p = (q.xy + uCast * q.z) * uSquash;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 0.0, 1.0);
}
`;

const SHADOW_FRAG = /* glsl */ `
uniform sampler2D uTex;
uniform float uOpacity;
uniform vec2 uSpread;
uniform float uBias;
varying vec2 vUv;
void main() {
  float a = 0.0;
  for (int i = -1; i <= 1; i++) {
    for (int j = -1; j <= 1; j++) {
      vec2 q = vUv + uSpread * vec2(float(i), float(j));
      // Outside the art there is nothing to cast; clamped edge texels at coarse mips would.
      float inside = step(0.0, q.x) * step(q.x, 1.0) * step(0.0, q.y) * step(q.y, 1.0);
      a += texture2D(uTex, q, uBias).a * inside;
    }
  }
  a /= 9.0;
  gl_FragColor = vec4(0.0, 0.0, 0.0, a * uOpacity);
}
`;

const CSS = `
html.kookify-grab, html.kookify-grab * { cursor: grab !important; }
html.kookify-grabbing, html.kookify-grabbing * { cursor: grabbing !important; }
html.kookify-hold, html.kookify-hold * { -webkit-user-select: none !important; user-select: none !important; -webkit-touch-callout: none !important; }
`;

/** Kookify's own controls sit above the stickers and keep their clicks. */
const onUi = (e: Event) => e.target instanceof Element && !!e.target.closest("[data-kookify-ui]");

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

function shuffle<T>(list: T[]): T[] {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The element that scrolls the page: the document itself, or the app's own scroller. */
function findScroller(): HTMLElement | null {
  const root = document.scrollingElement as HTMLElement | null;
  if (root && root.scrollHeight > root.clientHeight + 1) return null;
  let el = document.elementFromPoint(innerWidth / 2, innerHeight / 2) as HTMLElement | null;
  while (el && el !== document.body && el !== document.documentElement) {
    const { overflowY } = getComputedStyle(el);
    if (/(auto|scroll|overlay)/.test(overflowY) && el.scrollHeight > el.clientHeight + 1) return el;
    el = el.parentElement;
  }
  return null;
}

async function loadArt(url: string, loader: THREE.TextureLoader, maxAnisotropy: number): Promise<Art> {
  const tex = await loader.loadAsync(url);
  // Sampled as stored and written as is: the custom shaders do no colour conversion, so tagging
  // the art as sRGB would decode it to linear and draw every sticker too dark.
  tex.colorSpace = THREE.NoColorSpace;
  tex.premultiplyAlpha = true;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  const img = tex.image as HTMLImageElement;
  const k = 128 / Math.max(img.width, img.height);
  const aw = Math.max(1, Math.round(img.width * k));
  const ah = Math.max(1, Math.round(img.height * k));
  const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  ctx.canvas.width = aw;
  ctx.canvas.height = ah;
  ctx.drawImage(img, 0, 0, aw, ah);
  const data = ctx.getImageData(0, 0, aw, ah).data;
  const alpha = new Uint8ClampedArray(aw * ah);
  for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3];
  return { tex, w: img.width, h: img.height, alpha, aw, ah };
}

export async function createEngine(options: {
  stickers: string[];
  words?: string[];
  reducedMotion: boolean;
  sound?: Sound;
}): Promise<Engine> {
  const { reducedMotion, sound } = options;
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, premultipliedAlpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 3));
  const loader = new THREE.TextureLoader();
  const anisotropy = renderer.capabilities.getMaxAnisotropy();
  const [arts, words] = await Promise.all([
    Promise.all(options.stickers.map((url) => loadArt(url, loader, anisotropy))),
    Promise.all((options.words ?? []).map((url) => loadArt(url, loader, anisotropy))),
  ]);
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.setAttribute("aria-hidden", "true");
  canvas.dataset.kookify = "";
  Object.assign(canvas.style, {
    position: "fixed",
    inset: "0",
    width: "100vw",
    height: "100dvh",
    pointerEvents: "none",
    zIndex: "2147483000",
  });
  document.body.appendChild(canvas);

  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(0, 1, 0, -1, 1, 2e6);
  camera.position.z = 1e6;

  // The viewer sits over the middle of the screen; anything lifted off the page is drawn closer.
  const eye = { value: new THREE.Vector2() };
  // Where the light is, in viewport px: follows the pointer, or the phone's tilt.
  const light = { value: new THREE.Vector2(innerWidth * 0.5, innerHeight * 0.2) };
  // The light's centre sits on the pointer (or finger, or tilt), following it closely. What
  // moves on its own is the rays and particles, driven by time.
  const aim = new THREE.Vector2(innerWidth * 0.5, innerHeight * 0.2);
  const time = { value: 0 };
  const dist = { value: 1400 };

  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.right = innerWidth;
    camera.bottom = -innerHeight;
    camera.updateProjectionMatrix();
    eye.value.set(innerWidth / 2, -innerHeight / 2);
    dist.value = Math.max(innerWidth, innerHeight) * 1.4;
    dirty = true;
  }

  const geometry = new THREE.PlaneGeometry(1, 1, 48, 48);

  let stickers: Sticker[] = [];
  let topZ = 0;
  let dirty = true;
  let scroller = findScroller();
  let alive = true;

  const scroll = () => (scroller ? { x: scroller.scrollLeft, y: scroller.scrollTop } : { x: scrollX, y: scrollY });

  function makeSticker(art: Art, x: number, y: number, size: number, rot: number): Sticker {
    // One set of peel uniforms, shared by the sticker and its shadow so they always agree.
    const peel = {
      uGrab: { value: new THREE.Vector2() },
      uCurl: { value: 0 },
      uRadius: { value: 1 },
      uFold: { value: 0 },
    };
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.ShaderMaterial({
        vertexShader: STICKER_VERT,
        fragmentShader: STICKER_FRAG,
        uniforms: {
          uTex: { value: art.tex },
          uSize: { value: new THREE.Vector2() },
          uSquash: { value: new THREE.Vector2(1, 1) },
          ...peel,
          uEye: eye,
          uDist: dist,
          uLift: { value: 0 },
          uOpacity: { value: 0 },
          uBlur: { value: new THREE.Vector2() },
          uZoom: { value: 0 },
          uLight: light,
          uTime: time,
          uPhase: { value: Math.random() * 0.4 },
          uFoil: { value: 1 },
        },
        transparent: true,
        premultipliedAlpha: true,
        side: THREE.DoubleSide,
        depthWrite: true,
      }),
    );
    const shadow = new THREE.Mesh(
      geometry,
      new THREE.ShaderMaterial({
        vertexShader: SHADOW_VERT,
        fragmentShader: SHADOW_FRAG,
        uniforms: {
          uTex: { value: art.tex },
          uSize: { value: new THREE.Vector2() },
          uSquash: { value: new THREE.Vector2(1, 1) },
          ...peel,
          uCast: { value: new THREE.Vector2() },
          uOpacity: { value: 0 },
          uSpread: { value: new THREE.Vector2() },
          uBias: { value: 0 },
        },
        transparent: true,
        premultipliedAlpha: true,
        depthWrite: false,
      }),
    );
    mesh.frustumCulled = false;
    shadow.frustumCulled = false;
    scene.add(shadow, mesh);
    topZ += Z_STEP;
    return {
      art, mesh, shadow, state: "wait", x, y, rot, size, z: topZ, t0: 0,
      lift: 0, curl: 0, curlTarget: 0, gx: 0, gy: 0, squashAt: -1e9, squashAmp: 0, vx: 0, vy: 0, vr: 0,
    };
  }

  function removeSticker(s: Sticker) {
    scene.remove(s.mesh, s.shadow);
    s.mesh.material.dispose();
    s.shadow.material.dispose();
    stickers = stickers.filter((o) => o !== s);
    dirty = true;
  }

  /** Resting size in px: width and height of the art scaled so its long side is `size`. */
  function dims(s: Sticker) {
    const k = s.size / Math.max(s.art.w, s.art.h);
    return { w: s.art.w * k, h: s.art.h * k };
  }

  /** Cover the viewport edge to edge: a jittered grid tighter than one sticker, landed in random order. */
  function slap() {
    const W = innerWidth;
    const H = innerHeight;
    const base = clamp(Math.min(W, H) * 0.36, 120, 300);
    const step = base * 0.5;
    const cols = Math.ceil(W / step) + 1;
    const rows = Math.ceil(H / step) + 1;
    const ox = (W - (cols - 1) * step) / 2;
    const oy = (H - (rows - 1) * step) / 2;
    const cells: [number, number][] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        cells.push([ox + c * step + rand(-0.25, 0.25) * step, oy + r * step + rand(-0.25, 0.25) * step]);
      }
    }
    const order = shuffle(cells);
    let pool: Art[] = [];
    let wordPool: Art[] = [];
    const { x: sx, y: sy } = scroll();
    const now = performance.now();
    const spacing = reducedMotion ? 0 : Math.min(20, 1000 / order.length);
    order.forEach(([x, y], i) => {
      if (!pool.length) pool = shuffle(arts);
      const s = makeSticker(pool.pop()!, x + sx, y + sy, base * rand(0.9, 1.15), rand(-0.38, 0.38));
      s.t0 = now + i * spacing;
      stickers.push(s);
      // About one word to every four photos, on top of the cover so thin words leave no gaps.
      if (words.length && Math.random() < 0.25) {
        if (!wordPool.length) wordPool = shuffle(words);
        const off = step * 0.3;
        const w = makeSticker(wordPool.pop()!, x + sx + rand(-off, off), y + sy + rand(-off, off), base * rand(1.05, 1.3), rand(-0.3, 0.3));
        w.t0 = s.t0 + spacing * 0.5;
        stickers.push(w);
      }
    });
    // With reduced motion everything lands at once: one slap stands for all of them.
    if (reducedMotion) sound?.slap();
    dirty = true;
  }

  function clear(): Promise<void> {
    release(false);
    if (stickers.length) sound?.whoosh();
    if (reducedMotion || !stickers.length) {
      stickers.slice().forEach(removeSticker);
      return Promise.resolve();
    }
    const now = performance.now();
    const { x: sx, y: sy } = scroll();
    for (const s of stickers) {
      const dx = s.x - sx - innerWidth / 2;
      const dy = s.y - sy - innerHeight / 2;
      const len = Math.hypot(dx, dy) || 1;
      const speed = rand(2.6, 3.6);
      s.vx = (dx / len) * speed;
      s.vy = (dy / len) * speed;
      s.vr = rand(-0.012, 0.012);
      s.state = "fly";
      s.t0 = now;
    }
    dirty = true;
    return new Promise((resolve) => setTimeout(resolve, 520));
  }

  // ---- Input -------------------------------------------------------------------------------

  /** Topmost sticker whose opaque pixels are under a viewport point. */
  function hitTest(cx: number, cy: number): Sticker | null {
    const { x: sx, y: sy } = scroll();
    const ordered = stickers.filter((s) => s.state !== "fly" && s.state !== "wait").sort((a, b) => b.z - a.z);
    for (const s of ordered) {
      const { w, h } = dims(s);
      const dx = cx - (s.x - sx);
      const dy = cy - (s.y - sy);
      const cos = Math.cos(-s.rot);
      const sin = Math.sin(-s.rot);
      const lx = dx * cos - dy * sin;
      const ly = dx * sin + dy * cos;
      const u = lx / w + 0.5;
      const v = ly / h + 0.5;
      if (u < 0 || u >= 1 || v < 0 || v >= 1) continue;
      const a = s.art.alpha[Math.floor(v * s.art.ah) * s.art.aw + Math.floor(u * s.art.aw)];
      if (a > 60) return s;
    }
    return null;
  }

  type Held = { s: Sticker; px: number; py: number; samples: { x: number; y: number; t: number }[] };
  let held: Held | null = null;
  let suppressClick = false;
  let suppressTimer = 0;

  /** Swallow the click that follows a grab, but only that one: it never outlives the gesture. */
  function eatNextClick() {
    suppressClick = true;
    clearTimeout(suppressTimer);
    suppressTimer = window.setTimeout(() => (suppressClick = false), 400);
  }

  function grab(s: Sticker, cx: number, cy: number) {
    const { x: sx, y: sy } = scroll();
    const { w, h } = dims(s);
    const dx = cx - (s.x - sx);
    const dy = cy - (s.y - sy);
    const cos = Math.cos(-s.rot);
    const sin = Math.sin(-s.rot);
    // Normalised grab point in the sticker's own frame, y up to match the shader.
    s.gx = (dx * cos - dy * sin) / w;
    s.gy = -(dx * sin + dy * cos) / h;
    // Near a corner or edge the paper peels; near the middle it only lifts.
    const reach = Math.max(Math.abs(s.gx), Math.abs(s.gy)) * 2;
    s.curlTarget = clamp((reach - 0.2) / 0.4, 0, 1);
    s.state = "held";
    sound?.peel();
    topZ += Z_STEP;
    s.z = topZ;
    held = { s, px: cx, py: cy, samples: [{ x: cx, y: cy, t: performance.now() }] };
    document.documentElement.classList.add("kookify-grabbing");
    dirty = true;
  }

  function move(cx: number, cy: number) {
    if (!held) return;
    held.px = cx;
    held.py = cy;
    const now = performance.now();
    held.samples.push({ x: cx, y: cy, t: now });
    while (held.samples.length > 2 && now - held.samples[0].t > 90) held.samples.shift();
    dirty = true;
  }

  /** Stickers only move, never leave: a release keeps any momentum briefly, then re-sticks. */
  function release(keepMomentum = true) {
    if (!held) return;
    const { s, samples } = held;
    held = null;
    document.documentElement.classList.remove("kookify-grabbing");
    const first = samples[0];
    const last = samples[samples.length - 1];
    const dt = Math.max(1, last.t - first.t);
    const fresh = performance.now() - last.t < 60;
    let vx = keepMomentum && fresh && !reducedMotion ? (last.x - first.x) / dt : 0;
    let vy = keepMomentum && fresh && !reducedMotion ? (last.y - first.y) / dt : 0;
    const speed = Math.hypot(vx, vy);
    if (speed > GLIDE_MAX) {
      vx *= GLIDE_MAX / speed;
      vy *= GLIDE_MAX / speed;
    }
    s.vx = vx;
    s.vy = vy;
    s.state = "glide";
    dirty = true;
  }

  /** Where the peel carries the grabbed point: its offset from centre (y up) and its height. */
  function peelPoint(s: Sticker, w: number, h: number) {
    const gx = s.gx * w;
    const gy = s.gy * h;
    const m = Math.min(w, h);
    const fold = PEEL_FOLD * m * s.curl;
    const r = PEEL_RADIUS * m;
    const len = Math.hypot(gx, gy);
    if (s.curl < 0.001 || len < 1e-3) return { x: gx, y: gy, z: 0 };
    const amax = s.curl * 2.4;
    const a = fold / r;
    let tn: number;
    let z: number;
    if (a <= amax) {
      tn = fold - r * Math.sin(a);
      z = r * (1 - Math.cos(a));
    } else {
      const rest = fold - amax * r;
      tn = fold - r * Math.sin(amax) - rest * Math.cos(amax);
      z = r * (1 - Math.cos(amax)) + rest * Math.sin(amax);
    }
    return { x: gx - (gx / len) * tn, y: gy - (gy / len) * tn, z };
  }

  /** Keep a sticker's centre on screen, so at most half of it hangs past an edge. */
  function confine(s: Sticker, sx: number, sy: number) {
    const x = clamp(s.x - sx, 0, innerWidth);
    const y = clamp(s.y - sy, 0, innerHeight);
    const hit = x !== s.x - sx || y !== s.y - sy;
    s.x = x + sx;
    s.y = y + sy;
    return hit;
  }

  function onPointerDown(e: PointerEvent) {
    sound?.resume();
    if (e.pointerType === "touch" || e.button !== 0 || onUi(e)) return;
    const s = hitTest(e.clientX, e.clientY);
    if (!s) return;
    e.preventDefault();
    e.stopPropagation();
    eatNextClick();
    grab(s, e.clientX, e.clientY);
  }

  function onPointerMove(e: PointerEvent) {
    aim.set(e.clientX, e.clientY);
    dirty = true;
    if (e.pointerType === "touch") return;
    if (held) return move(e.clientX, e.clientY);
    document.documentElement.classList.toggle("kookify-grab", !onUi(e) && !!hitTest(e.clientX, e.clientY));
  }

  function onPointerUp(e: PointerEvent) {
    if (e.pointerType === "touch" || !held) return;
    move(e.clientX, e.clientY);
    release(e.type === "pointerup");
  }

  function onClick(e: MouseEvent) {
    if (!suppressClick || onUi(e)) return;
    suppressClick = false;
    e.preventDefault();
    e.stopPropagation();
  }

  // Touch: a swipe scrolls as usual; holding still on a sticker for HOLD_MS lifts it.
  let pending: { s: Sticker; x: number; y: number; timer: number } | null = null;

  function cancelPending() {
    if (!pending) return;
    clearTimeout(pending.timer);
    pending = null;
    if (!held) document.documentElement.classList.remove("kookify-hold");
  }

  function onTouchStart(e: TouchEvent) {
    cancelPending();
    touching = true;
    if (e.touches[0]) aim.set(e.touches[0].clientX, e.touches[0].clientY);
    if (e.touches.length !== 1 || held || onUi(e)) return;
    const t = e.touches[0];
    const s = hitTest(t.clientX, t.clientY);
    if (!s) return;
    document.documentElement.classList.add("kookify-hold");
    pending = {
      s,
      x: t.clientX,
      y: t.clientY,
      timer: window.setTimeout(() => {
        if (!pending) return;
        const p = pending;
        pending = null;
        if (!stickers.includes(p.s)) return;
        navigator.vibrate?.(8);
        grab(p.s, p.x, p.y);
      }, HOLD_MS),
    };
  }

  function onTouchMove(e: TouchEvent) {
    const t = e.touches[0];
    if (t) aim.set(t.clientX, t.clientY);
    if (held && t) {
      e.preventDefault();
      move(t.clientX, t.clientY);
      return;
    }
    if (pending && t && Math.hypot(t.clientX - pending.x, t.clientY - pending.y) > 10) cancelPending();
  }

  function onTouchEnd(e: TouchEvent) {
    cancelPending();
    touching = e.touches.length > 0;
    if (!held) return;
    e.preventDefault();
    eatNextClick();
    release(e.type === "touchend");
    document.documentElement.classList.remove("kookify-hold");
  }

  function onContextMenu(e: Event) {
    if (pending || held) e.preventDefault();
  }

  // Phones: the light follows a finger while it's down; otherwise tilt moves it, when the
  // browser shares tilt; otherwise it stays where the last touch left it.
  let touching = false;
  function onTilt(e: DeviceOrientationEvent) {
    if (e.beta == null || e.gamma == null || touching) return;
    aim.set(
      innerWidth * (0.5 + clamp(e.gamma / 35, -1, 1) * 0.7),
      innerHeight * (0.5 + clamp((e.beta - 45) / 35, -1, 1) * 0.7),
    );
    dirty = true;
  }

  function onScroll(e: Event) {
    const target = e.target;
    if (target instanceof HTMLElement && target.clientHeight > innerHeight * 0.5) scroller = target;
    dirty = true;
  }

  const capture = { capture: true } as const;
  const active = { capture: true, passive: false } as const;
  addEventListener("pointerdown", onPointerDown, capture);
  addEventListener("pointermove", onPointerMove, capture);
  addEventListener("pointerup", onPointerUp, capture);
  addEventListener("pointercancel", onPointerUp, capture);
  addEventListener("click", onClick, capture);
  addEventListener("touchstart", onTouchStart, active);
  addEventListener("touchmove", onTouchMove, active);
  addEventListener("touchend", onTouchEnd, active);
  addEventListener("touchcancel", onTouchEnd, active);
  addEventListener("contextmenu", onContextMenu, capture);
  document.addEventListener("scroll", onScroll, { capture: true, passive: true });
  addEventListener("resize", resize);
  addEventListener("deviceorientation", onTilt);

  // ---- Frame -------------------------------------------------------------------------------

  let last = performance.now();

  function frame() {
    if (!alive) return;
    requestAnimationFrame(frame);
    const now = performance.now();
    const dt = Math.min(48, now - last);
    last = now;
    let animating = false;
    const { x: sx, y: sy } = scroll();

    for (const s of stickers.slice()) {
      const { w, h } = dims(s);
      let scale = 1;
      let opacity = 1;
      let blurX = 0;
      let blurY = 0;
      let extraDrop = 0;
      let zoom = 0;

      if (s.state === "wait") {
        if (now >= s.t0) s.state = "slap";
        else opacity = 0;
        animating = true;
      }
      if (s.state === "slap") {
        // Drops in a little too big and blurred, speeding up until it hits. No fade.
        const k = reducedMotion ? 1 : clamp((now - s.t0) / SLAP_MS, 0, 1);
        const fall = 1 - k * k;
        scale = 1 + 0.15 * fall;
        zoom = 0.07 * fall;
        extraDrop = 14 * fall;
        if (k >= 1) {
          s.state = "idle";
          if (!reducedMotion) sound?.slap();
          s.squashAt = now;
          s.squashAmp = reducedMotion ? 0 : 0.07;
        }
        animating = true;
      }
      if (s.state === "held") {
        // Place the sticker so the grabbed point, wherever the peel has carried it, sits exactly
        // under the pointer: undo the perspective of its height, then the sticker's rotation.
        const { w: hw, h: hh } = dims(s);
        const p = peelPoint(s, hw, hh);
        const lx = p.x;
        const ly = -p.y;
        const cos = Math.cos(s.rot);
        const sin = Math.sin(s.rot);
        const k = dist.value / (dist.value - (LIFT_Z * s.lift + p.z));
        const ex = innerWidth / 2;
        const ey = innerHeight / 2;
        s.x = ex + (held!.px - ex) / k - (lx * cos - ly * sin) + sx;
        s.y = ey + (held!.py - ey) / k - (lx * sin + ly * cos) + sy;
        s.lift += (1 - s.lift) * (1 - Math.exp(-dt / LIFT_TAU));
        s.curl += (s.curlTarget - s.curl) * (1 - Math.exp(-dt / LIFT_TAU));
        animating = true;
      }
      if (s.state === "glide") {
        // Momentum dies off fast; then one press back onto the page.
        const decay = Math.exp(-dt / GLIDE_TAU);
        s.x += s.vx * GLIDE_TAU * (1 - decay);
        s.y += s.vy * GLIDE_TAU * (1 - decay);
        s.vx *= decay;
        s.vy *= decay;
        if (confine(s, sx, sy)) {
          s.vx = 0;
          s.vy = 0;
        }
        const moving = Math.hypot(s.vx, s.vy) > 0.05;
        if (!moving) {
          s.lift += (0 - s.lift) * (1 - Math.exp(-dt / 30));
          s.curl += (0 - s.curl) * (1 - Math.exp(-dt / 30));
        }
        if (!moving && s.lift < 0.02 && s.curl < 0.02) {
          s.lift = 0;
          s.curl = 0;
          s.vx = 0;
          s.vy = 0;
          s.state = "idle";
          sound?.pat();
          s.squashAt = now;
          s.squashAmp = reducedMotion ? 0 : 0.035;
        }
        animating = true;
      }
      if (s.state === "fly") {
        const age = now - s.t0;
        const accel = 1 + age / 220;
        s.x += s.vx * dt * accel;
        s.y += s.vy * dt * accel;
        s.rot += s.vr * dt;
        s.lift += (0.6 - s.lift) * (1 - Math.exp(-dt / 60));
        s.curl += (0 - s.curl) * (1 - Math.exp(-dt / 40));
        const vx = s.vx * accel;
        const vy = s.vy * accel;
        // Motion blur along the flight, in the sticker's own frame.
        const cos = Math.cos(-s.rot);
        const sin = Math.sin(-s.rot);
        const bx = ((vx * cos - vy * sin) * 14) / w;
        const by = (-(vx * sin + vy * cos) * 14) / h;
        const bl = Math.hypot(bx, by);
        const cap = bl > 0.09 ? 0.09 / bl : 1;
        blurX = bx * cap;
        blurY = by * cap;
        const vxp = s.x - sx;
        const vyp = s.y - sy;
        const off =
          vxp < -s.size || vxp > innerWidth + s.size || vyp < -s.size || vyp > innerHeight + s.size || age > 1400;
        if (off) {
          removeSticker(s);
          continue;
        }
        animating = true;
      }

      let qx = 1;
      let qy = 1;
      const q = (now - s.squashAt) / SQUASH_MS;
      if (q >= 0 && q < 1 && s.squashAmp > 0) {
        // One sharp squash that eases straight back to flat: no bounce.
        const e = (1 - q) * (1 - q) * (1 - q);
        qx = 1 + s.squashAmp * e;
        qy = 1 - s.squashAmp * e;
        animating = true;
      }

      const dw = w * scale;
      const dh = h * scale;
      const m = Math.min(dw, dh);
      const vxp = s.x - sx;
      const vyp = s.y - sy;

      const u = s.mesh.material.uniforms;
      u.uSize.value.set(dw, dh);
      u.uSquash.value.set(qx, qy);
      u.uGrab.value.set(s.gx * dw, s.gy * dh);
      u.uCurl.value = s.curl;
      u.uRadius.value = PEEL_RADIUS * m;
      u.uFold.value = PEEL_FOLD * m * s.curl;
      u.uLift.value = LIFT_Z * s.lift;
      u.uOpacity.value = opacity;
      u.uBlur.value.set(blurX, blurY);
      u.uZoom.value = zoom;
      // A held sticker catches the light more as it tips toward the viewer.
      u.uFoil.value = 1 + 0.6 * s.lift;
      s.mesh.position.set(vxp, -vyp, s.z);
      s.mesh.rotation.z = -s.rot;

      const blurPx = 5 + 22 * s.lift + extraDrop * 0.5;
      const offset = 2 + 18 * s.lift + extraDrop;
      const su = s.shadow.material.uniforms;
      su.uSize.value.set(dw, dh);
      su.uSquash.value.set(qx, qy);
      su.uOpacity.value = opacity * (0.2 + 0.08 * s.lift) * (1 - extraDrop / 44);
      // Light from above: the higher the peel, the further down its shadow falls.
      su.uCast.value.set(
        0.5 * (0.25 * Math.cos(s.rot) + Math.sin(s.rot)),
        0.5 * (0.25 * Math.sin(s.rot) - Math.cos(s.rot)),
      );
      su.uSpread.value.set((blurPx * 0.5) / (dw * 1.35), (blurPx * 0.5) / (dh * 1.35));
      su.uBias.value = Math.min(2.5, Math.log2(Math.max(1, blurPx / 2)));
      s.shadow.position.set(vxp + offset * 0.25, -(vyp + offset), s.z - 1);
      s.shadow.rotation.z = -s.rot;
    }

    // The centre eases onto its aim in about 50ms. The rays and particles keep time on their
    // own; a hidden tab gets no frames, so they pause with it, and reduced motion holds them.
    light.value.lerp(aim, 1 - Math.exp(-dt / 50));
    if (!reducedMotion) time.value += dt / 1000;
    if (stickers.length) animating = true;

    if (animating || dirty) {
      renderer.render(scene, camera);
      dirty = false;
    }
  }

  resize();
  requestAnimationFrame(frame);

  // Dev-only window into sticker placement, for automated checks of grabs at known points.
  if (process.env.NODE_ENV === "development") {
    (window as unknown as { __kookify?: unknown }).__kookify = () => {
      const { x: sx, y: sy } = scroll();
      return stickers
        .filter((s) => s.state === "idle")
        .map((s) => ({ x: s.x - sx, y: s.y - sy, rot: s.rot, z: s.z, ...dims(s) }));
    };
  }

  return {
    slap,
    clear,
    rescan() {
      scroller = findScroller();
      dirty = true;
    },
    dispose() {
      alive = false;
      cancelPending();
      clearTimeout(suppressTimer);
      removeEventListener("pointerdown", onPointerDown, capture);
      removeEventListener("pointermove", onPointerMove, capture);
      removeEventListener("pointerup", onPointerUp, capture);
      removeEventListener("pointercancel", onPointerUp, capture);
      removeEventListener("click", onClick, capture);
      removeEventListener("touchstart", onTouchStart, active);
      removeEventListener("touchmove", onTouchMove, active);
      removeEventListener("touchend", onTouchEnd, active);
      removeEventListener("touchcancel", onTouchEnd, active);
      removeEventListener("contextmenu", onContextMenu, capture);
      document.removeEventListener("scroll", onScroll, { capture: true });
      removeEventListener("resize", resize);
      removeEventListener("deviceorientation", onTilt);
      document.documentElement.classList.remove("kookify-grab", "kookify-grabbing", "kookify-hold");
      stickers.slice().forEach(removeSticker);
      geometry.dispose();
      [...arts, ...words].forEach((a) => a.tex.dispose());
      renderer.dispose();
      // Give the GL context back now; browsers cap how many a page may hold.
      renderer.forceContextLoss();
      canvas.remove();
      style.remove();
    },
  };
}
