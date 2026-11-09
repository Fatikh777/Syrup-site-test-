import * as THREE from "three";
import { RoomEnvironment } from "../vendor/RoomEnvironment.js";

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

/* Смешивание цветов по кратчайшей дуге оттенка, без «грязи» и лишних цветов */
const _ha = {}, _hb = {};
function mixHue(out, a, b, t) {
  a.getHSL(_ha); b.getHSL(_hb);
  let dh = _hb.h - _ha.h;
  if (dh > 0.5) dh -= 1;
  if (dh < -0.5) dh += 1;
  const h = (_ha.h + dh * t + 1) % 1;
  return out.setHSL(h, lerp(_ha.s, _hb.s, t), lerp(_ha.l, _hb.l, t));
}

/* Псевдо-штрихкод: ширины полос по строке */
function barPattern(seed, n) {
  let s = 0;
  for (const ch of seed) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  const out = [];
  for (let i = 0; i < n; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    out.push(1 + (s >>> 28) % 4);
  }
  return out;
}

function drawBarcode(ctx, x, y, w, h, seed) {
  const bars = barPattern(seed, 34);
  const total = bars.reduce((a, b) => a + b, 0) * 1.6;
  const unit = w / total;
  let cx = x;
  bars.forEach((b, i) => {
    if (i % 2 === 0) ctx.fillRect(cx, y, b * unit, h);
    cx += b * unit * 1.6;
  });
}

export function createScene(canvas, opts) {
  const STORY = opts.story;
  const mobile = () => window.innerWidth < 761;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  // слабые устройства сразу получают меньшее разрешение
  const weak = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 3;
  let dpr = Math.min(window.devicePixelRatio || 1, mobile() ? 1.5 : 2);
  if (weak) dpr = Math.min(dpr, 1);
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 11);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

  /* ---------- Фон: градиент + огромное слово вкуса ---------- */
  const bgUniforms = {
    uIn: { value: new THREE.Color(STORY[0].bgIn) },
    uOut: { value: new THREE.Color(STORY[0].bgOut) },
    uTexA: { value: null },
    uTexB: { value: null },
    uMix: { value: 0 },
    uTime: { value: 0 },
    uAspect: { value: 1 },
    uCenter: { value: new THREE.Vector2(0.3, 0) },
    uPointer: { value: new THREE.Vector2(0, 0) },
    uShift: { value: 0 }
  };
  const bgMat = new THREE.ShaderMaterial({
    uniforms: bgUniforms,
    depthWrite: false,
    toneMapped: false,
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 uIn; uniform vec3 uOut;
      uniform sampler2D uTexA; uniform sampler2D uTexB;
      uniform float uMix; uniform float uTime; uniform float uAspect; uniform float uShift;
      uniform vec2 uCenter; uniform vec2 uPointer;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        vec2 p = vUv - 0.5; p.x *= uAspect;
        float d = length(p - uCenter);
        vec3 col = mix(uIn, uOut, smoothstep(0.0, 0.95, d));
        // мягкие «облака» цвета
        vec2 b1 = vec2(sin(uTime * .21) * .5, cos(uTime * .17) * .3);
        vec2 b2 = vec2(cos(uTime * .13) * .6, sin(uTime * .19) * .35);
        col += uIn * 0.22 * exp(-length(p - b1) * 3.0);
        col = mix(col, uOut, 0.25 * exp(-length(p - b2) * 2.5));
        col += uIn * 0.18 * exp(-length(p - uPointer * vec2(uAspect, 1.0) * .5) * 4.0);
        // слово
        vec2 tuv = vUv + vec2(0.0, uShift);
        float ta = texture2D(uTexA, tuv).a;
        float tb = texture2D(uTexB, tuv).a;
        float t = mix(ta, tb, uMix);
        col = mix(col, vec3(1.0), t * 0.16);
        // зерно и виньетка
        col += (hash(vUv * 900.0 + uTime) - 0.5) * 0.035;
        col *= 1.0 - 0.35 * smoothstep(0.5, 1.2, length(vUv - 0.5) * 1.6);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `
  });
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), bgMat);
  bg.position.z = -5;
  scene.add(bg);

  let wordTextures = [];
  function buildWordTextures(aspect) {
    wordTextures.forEach((t) => t.dispose());
    const W = 1600, H = Math.round(W / aspect);
    wordTextures = STORY.map((f) => {
      const c = document.createElement("canvas");
      c.width = W; c.height = H;
      const ctx = c.getContext("2d");
      const word = f.ru.toUpperCase();
      let size = Math.min(H * 0.42, W / (word.length * 0.78));
      ctx.font = `900 ${size}px Unbounded, "Arial Black", sans-serif`;
      const mw = ctx.measureText(word).width;
      if (mw > W * 0.96) { size *= (W * 0.96) / mw; ctx.font = `900 ${size}px Unbounded, "Arial Black", sans-serif`; }
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(word, W / 2, H * (mobile() ? 0.34 : 0.5));
      // контурная копия ниже
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = Math.max(2, size * 0.012);
      ctx.strokeStyle = "#fff";
      ctx.strokeText(word, W / 2, H * (mobile() ? 0.34 : 0.5) + size * 0.95);
      ctx.strokeText(word, W / 2, H * (mobile() ? 0.34 : 0.5) - size * 0.95);
      const tex = new THREE.CanvasTexture(c);
      tex.minFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      return tex;
    });
  }

  /* ---------- Бутылка ---------- */
  const bottle = new THREE.Group();
  const inner = new THREE.Group();
  bottle.add(inner);
  scene.add(bottle);
  const H = 3.32;
  inner.position.y = -H / 2;

  const P = (r, y) => new THREE.Vector2(r, y);
  const glassProfile = [
    P(0.0, 0.0), P(0.5, 0.0), P(0.6, 0.02), P(0.645, 0.08), P(0.66, 0.2),
    P(0.66, 1.92), P(0.645, 2.06), P(0.58, 2.2), P(0.46, 2.33), P(0.33, 2.44),
    P(0.25, 2.54), P(0.225, 2.64), P(0.22, 2.75), P(0.22, 3.0), P(0.25, 3.02),
    P(0.25, 3.1), P(0.2, 3.12)
  ];
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: 0.03, transmission: 1, thickness: 0.6,
    ior: 1.5, envMapIntensity: 1.1, clearcoat: 1, clearcoatRoughness: 0.02,
    specularIntensity: 1, attenuationColor: new THREE.Color("#f4fff8"), attenuationDistance: 6
  });
  const glass = new THREE.Mesh(new THREE.LatheGeometry(glassProfile, 128), glassMat);
  inner.add(glass);

  const liquidProfile = [
    P(0.0, 0.07), P(0.52, 0.07), P(0.6, 0.12), P(0.618, 0.24),
    P(0.618, 1.98), P(0.6, 2.02), P(0.0, 2.02)
  ];
  const liquidMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(STORY[0].liquid), roughness: 0.25, metalness: 0,
    clearcoat: 0.6, clearcoatRoughness: 0.15,
    emissive: new THREE.Color(STORY[0].liquid), emissiveIntensity: 0.35
  });
  const liquid = new THREE.Mesh(new THREE.LatheGeometry(liquidProfile, 96), liquidMat);
  inner.add(liquid);

  // пузырьки внутри жидкости
  const BUBBLES = mobile() ? 24 : 48;
  const bubbleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, emissive: new THREE.Color(STORY[0].liquid), emissiveIntensity: 0.6 });
  const bubbles = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 10), bubbleMat, BUBBLES);
  const bubbleData = [];
  for (let i = 0; i < BUBBLES; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 0.5;
    bubbleData.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, y: 0.1 + Math.random() * 1.85, s: 0.008 + Math.random() * 0.022, v: 0.12 + Math.random() * 0.3, w: Math.random() * 6 });
  }
  inner.add(bubbles);

  // крышка
  const capMat = new THREE.MeshPhysicalMaterial({ color: 0x0d0d0d, roughness: 0.32, metalness: 0.2, clearcoat: 0.8 });
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.275, 0.285, 0.46, 64), capMat);
  cap.position.y = 3.1;
  inner.add(cap);
  const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.275, 0.03, 64), capMat);
  capTop.position.y = 3.34;
  inner.add(capTop);
  const ringMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(STORY[0].liquid), roughness: 0.3, metalness: 0.4, emissive: new THREE.Color(STORY[0].liquid), emissiveIntensity: 0.3 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.287, 0.014, 12, 64), ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 2.93;
  inner.add(ring);

  // этикетка
  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = 1400; labelCanvas.height = 600;
  const labelCtx = labelCanvas.getContext("2d");
  const labelTex = new THREE.CanvasTexture(labelCanvas);
  labelTex.colorSpace = THREE.SRGBColorSpace;
  labelTex.anisotropy = 8;
  const theta = Math.PI * 1.25;
  const labelMat = new THREE.MeshStandardMaterial({ map: labelTex, roughness: 0.55, side: THREE.DoubleSide });
  const label = new THREE.Mesh(new THREE.CylinderGeometry(0.672, 0.672, 1.12, 128, 1, true, -theta / 2, theta), labelMat);
  label.position.y = 1.08;
  inner.add(label);

  function drawLabel(f) {
    const c = labelCtx, W = labelCanvas.width, Hh = labelCanvas.height;
    c.clearRect(0, 0, W, Hh);
    c.fillStyle = "#f5eee2"; c.fillRect(0, 0, W, Hh);
    // цветная полоса вкуса
    c.fillStyle = f.liquid; c.fillRect(0, Hh - 70, W, 70);
    c.fillStyle = "#14100c";
    c.fillRect(0, 26, W, 4); c.fillRect(0, Hh - 92, W, 4);
    c.textAlign = "center"; c.textBaseline = "alphabetic";
    c.font = "900 92px Unbounded, 'Arial Black', sans-serif";
    c.fillText("BARCODE", W / 2, 150);
    c.font = "400 40px Unbounded, sans-serif";
    c.fillText("S  Y  R  U  P", W / 2, 206);
    // штрихкод
    drawBarcode(c, W / 2 - 170, 236, 340, 110, f.en);
    c.font = "600 22px Manrope, sans-serif";
    c.fillText("4 870 " + f.num + "0 033 1", W / 2, 376);
    // название вкуса
    c.fillStyle = f.liquid;
    let size = 78;
    c.font = `900 ${size}px Unbounded, 'Arial Black', sans-serif`;
    while (c.measureText(f.en.toUpperCase()).width > 760 && size > 30) { size -= 4; c.font = `900 ${size}px Unbounded, sans-serif`; }
    c.save(); c.shadowColor = "rgba(0,0,0,.18)"; c.shadowOffsetY = 3;
    c.fillText(f.en.toUpperCase(), W / 2, 466);
    c.restore();
    c.fillStyle = "#14100c";
    c.font = "700 22px Manrope, sans-serif";
    c.fillText("НАТУРАЛЬНЫЙ СИРОП  ·  1000 ML", W / 2, 498);
    c.fillStyle = "#fff";
    c.font = "800 26px Manrope, sans-serif";
    c.fillText("СДЕЛАНО В КЫРГЫЗСТАНЕ", W / 2, Hh - 25);
    labelTex.needsUpdate = true;
  }
  drawLabel(STORY[0]);

  /* ---------- Капли вокруг ---------- */
  const DROPS = mobile() ? 7 : 12;
  const dropMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(STORY[0].liquid), roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05, emissive: new THREE.Color(STORY[0].liquid), emissiveIntensity: 0.25 });
  const dropGeo = new THREE.SphereGeometry(1, 40, 40);
  const drops = [];
  const dropGroup = new THREE.Group();
  scene.add(dropGroup);
  for (let i = 0; i < DROPS; i++) {
    const m = new THREE.Mesh(dropGeo, dropMat);
    const s = 0.05 + Math.random() * 0.17;
    m.scale.setScalar(s);
    const d = {
      m, base: s, a: (i / DROPS) * Math.PI * 2 + Math.random() * 0.4,
      r: 1.4 + Math.random() * 1.6, y: (Math.random() - 0.5) * 3.4,
      sp: 0.08 + Math.random() * 0.12, ph: Math.random() * 6, depth: (Math.random() - 0.5) * 2.4
    };
    drops.push(d);
    dropGroup.add(m);
  }

  /* ---------- Свет ---------- */
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(-3, 4, 5);
  scene.add(key);
  const rim = new THREE.PointLight(0xffffff, 18, 20);
  rim.position.set(3.5, 1.5, -1.5);
  scene.add(rim);
  const fill = new THREE.PointLight(0xffffff, 8, 20);
  fill.position.set(-3, -2, 3);
  scene.add(fill);
  scene.add(new THREE.AmbientLight(0xffffff, 0.3));

  /* ---------- Состояние ---------- */
  const state = {
    progress: 0, flavor: 0, pointer: new THREE.Vector2(), pointerS: new THREE.Vector2(),
    velocity: 0, tilt: 0, rot: 0, labelIdx: 0, running: false, visW: 1, visH: 1, appearStart: -1
  };
  const cA = new THREE.Color(), cB = new THREE.Color(), tmp = new THREE.Color();
  const cols = STORY.map((f) => ({ liquid: new THREE.Color(f.liquid), bgIn: new THREE.Color(f.bgIn), bgOut: new THREE.Color(f.bgOut) }));
  const mat4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3();

  function resize() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const dist = camera.position.z - bg.position.z;
    const ph = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * dist * 1.08;
    bg.scale.set(ph * camera.aspect, ph, 1);
    bgUniforms.uAspect.value = camera.aspect;
    state.visH = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    state.visW = state.visH * camera.aspect;
    buildWordTextures(camera.aspect);
  }

  function layout(p) {
    const m = mobile();
    const intro = 1 - smooth(0.0, 0.1, p);
    let scale, x, y;
    if (m) {
      scale = (state.visH * lerp(0.42, 0.4, intro)) / H;
      x = 0;
      y = state.visH * lerp(0.2, 0.17, intro);
    } else {
      scale = (state.visH * lerp(0.74, 0.8, intro)) / H;
      x = state.visW * lerp(0.17, 0.2, intro);
      y = -state.visH * 0.01;
    }
    return { scale, x, y };
  }

  const clock = new THREE.Clock();
  function frame() {
    if (!state.running) return;
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    state.pointerS.lerp(state.pointer, 0.06);
    const p = state.progress;

    // цвета вкуса
    const f = clamp(state.flavor, 0, STORY.length - 1);
    const i = Math.min(Math.floor(f), STORY.length - 2);
    const k = smooth(0.3, 0.7, f - i);
    mixHue(cA, cols[i].liquid, cols[i + 1].liquid, k);
    liquidMat.color.copy(cA); liquidMat.emissive.copy(cA);
    bubbleMat.emissive.copy(cA);
    ringMat.color.copy(cA); ringMat.emissive.copy(cA);
    dropMat.color.copy(cA); dropMat.emissive.copy(cA);
    mixHue(bgUniforms.uIn.value, cols[i].bgIn, cols[i + 1].bgIn, k);
    mixHue(bgUniforms.uOut.value, cols[i].bgOut, cols[i + 1].bgOut, k);
    bgUniforms.uTexA.value = wordTextures[i];
    bgUniforms.uTexB.value = wordTextures[i + 1];
    bgUniforms.uMix.value = smooth(0.35, 0.65, f - i);
    bgUniforms.uTime.value = t;
    bgUniforms.uPointer.value.copy(state.pointerS);
    bgUniforms.uShift.value = ((f - i) - 0.5) * 0.04;

    const li = Math.round(f);
    if (li !== state.labelIdx) { state.labelIdx = li; drawLabel(STORY[li]); }

    // появление после загрузки
    let ap = 0;
    if (state.appearStart >= 0) {
      const at = clamp((performance.now() - state.appearStart) / 1800, 0, 1);
      ap = 1 - Math.pow(2, -10 * at);
      if (at >= 1) ap = 1;
    }

    // положение и вращение
    const L = layout(p);
    bottle.scale.setScalar(L.scale * (0.6 + 0.4 * ap));
    bottle.visible = ap > 0.001;
    bottle.position.x = L.x;
    bottle.position.y = L.y + Math.sin(t * 1.1) * 0.06 * L.scale - (1 - ap) * state.visH * 0.5;
    bgUniforms.uCenter.value.set((L.x / state.visW) * camera.aspect, L.y / state.visH);

    const targetRot = p * Math.PI * 4 + state.pointerS.x * 0.35 + t * 0.12 - (1 - ap) * 3.5;
    state.rot = lerp(state.rot, targetRot, 0.08);
    bottle.rotation.y = state.rot;
    state.tilt = lerp(state.tilt, clamp(state.velocity * 0.004, -0.25, 0.25), 0.08);
    bottle.rotation.z = -0.06 + state.tilt + Math.sin(t * 0.7) * 0.02;
    bottle.rotation.x = state.pointerS.y * 0.12;

    // пузырьки
    for (let b = 0; b < BUBBLES; b++) {
      const d = bubbleData[b];
      d.y += d.v * dt * (1 + Math.abs(state.velocity) * 0.01);
      if (d.y > 1.95) d.y = 0.1;
      v3.set(d.x + Math.sin(t * 2 + d.w) * 0.02, d.y, d.z);
      s3.setScalar(d.s);
      mat4.compose(v3, q, s3);
      bubbles.setMatrixAt(b, mat4);
    }
    bubbles.instanceMatrix.needsUpdate = true;

    // капли
    dropGroup.position.x = L.x;
    dropGroup.position.y = L.y;
    const spread = mobile() ? 0.62 : 1;
    drops.forEach((d) => {
      const a = d.a + t * d.sp + p * 3;
      d.m.position.set(Math.cos(a) * d.r * spread, d.y * spread + Math.sin(t + d.ph) * 0.15, Math.sin(a) * d.r * 0.8 + d.depth);
      d.m.scale.setScalar(d.base * ap);
    });

    renderer.render(scene, camera);
    watchFps();
  }

  /* Если кадров мало, упрощаем картинку по шагам:
     1) меньше разрешение, 2) ещё меньше, 3) простое прозрачное стекло без преломления */
  const perf = { frames: 0, since: 0, last: 0, level: 0, skip: 30 };
  function watchFps() {
    const now = performance.now();
    const gap = now - perf.last;
    perf.last = now;
    if (gap > 250) { perf.since = now; perf.frames = 0; return; } // вкладка была скрыта или пауза
    if (perf.skip > 0) { perf.skip--; perf.since = performance.now(); perf.frames = 0; return; }
    perf.frames++;
    const elapsed = performance.now() - perf.since;
    if (elapsed < 2000) return;
    const fps = (perf.frames * 1000) / elapsed;
    perf.frames = 0;
    perf.since = performance.now();
    if (fps >= 40 || perf.level >= 3) return;
    perf.level++;
    if (perf.level <= 2) {
      dpr = Math.max(0.75, dpr * 0.7);
      renderer.setPixelRatio(dpr);
      renderer.setSize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight, false);
    } else {
      glassMat.transmission = 0;
      glassMat.transparent = true;
      glassMat.opacity = 0.28;
      glassMat.needsUpdate = true;
      bubbles.visible = false;
    }
    perf.skip = 20;
  }

  resize();
  bgUniforms.uTexA.value = wordTextures[0];
  bgUniforms.uTexB.value = wordTextures[1];

  return {
    resize,
    setProgress(p, f) { state.progress = p; state.flavor = f; },
    setPointer(x, y) { state.pointer.set(x, y); },
    setVelocity(v) { state.velocity = v; },
    appear() { state.appearStart = performance.now(); },
    start() { if (!state.running) { state.running = true; perf.skip = 30; clock.getDelta(); frame(); } },
    stop() { state.running = false; },
    renderOnce() { const r = state.running; state.running = true; frame(); state.running = r; },
    redrawText() { buildWordTextures(camera.aspect); drawLabel(STORY[state.labelIdx]); }
  };
}
