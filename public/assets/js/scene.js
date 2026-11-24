// scene.js — renderer, postFX (god rays + bloom + grade + фініш: зерно і щілина-розкриття), якість/адаптивний DPR,
// застосування пози, курсор «Промінь» (стулка піддається, брижі на воді), проекції для виносок.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildDoor, buildWorld, buildShaft, PANEL_LAYOUT, C, DOOR, WATER_Y } from './door.js';
import { PARTS, PANEL_SPREAD, explodeOf, clamp, ss, lerp } from './choreo.js';

export const QUALITY = [
  { dpr: 1.75, rays: true, bloom: true, shadow: 2048, spotShadow: true },
  { dpr: 1.5, rays: true, bloom: true, shadow: 1024, spotShadow: true },
  { dpr: 1.25, rays: false, bloom: true, shadow: 1024, spotShadow: false },
  { dpr: 1.0, rays: false, bloom: false, shadow: 1024, spotShadow: false },
];
const MOBILE = { dpr: 1.5, rays: false, bloom: false, shadow: 1024, spotShadow: false };
const LITE = { dpr: 1.75, rays: false, bloom: true, shadow: 1024, spotShadow: true };

const V = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
const RaysShader = {
  uniforms: { tDiffuse: { value: null }, uLight: { value: new THREE.Vector2(0.5, 0.5) }, uStr: { value: 0 } },
  vertexShader: V,
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uLight; uniform float uStr; varying vec2 vUv;
    void main(){ vec3 base = texture2D(tDiffuse, vUv).rgb; if (any(isnan(base)) || any(isinf(base))) base = vec3(0.0); base = min(base, vec3(48.0));
      if (uStr < 0.002) { gl_FragColor = vec4(base,1.0); return; }
      vec2 dt = (vUv - uLight) * (0.85/14.0); float j = fract(sin(dot(vUv, vec2(12.9898,78.233)))*43758.5453);
      vec2 uv = vUv - dt * j; float ill = 1.0; vec3 acc = vec3(0.0);
      for (int i=0;i<14;i++){ uv -= dt; vec3 s = texture2D(tDiffuse, uv).rgb; float l = dot(s, vec3(0.2126,0.7152,0.0722));
        acc += s * smoothstep(1.5, 3.2, l) * ill; ill *= 0.92; }
      gl_FragColor = vec4(base + acc * uStr * 0.08, 1.0); }`,
};
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uVig: { value: 0.18 }, uAspect: { value: 1 }, uWarm: { value: 0 } },
  vertexShader: V,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uVig, uAspect, uWarm; varying vec2 vUv;
    void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; float l = dot(c, vec3(0.2126,0.7152,0.0722));
      c = mix(c * vec3(0.985, 1.0, 1.02), c * vec3(1.04, 1.0, 0.95), smoothstep(0.02, 0.6, l));
      c *= mix(vec3(1.0), vec3(1.08, 1.0, 0.9), uWarm);
      vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0); c *= 1.0 - uVig * smoothstep(0.35, 1.1, length(q)) * 2.2;
      gl_FragColor = vec4(max(c, 0.0), 1.0); }`,
};
// після OutputPass (вже sRGB): зерно 3% + щілина-розкриття з центру (прелоадер → сцена)
const FinishShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uGrain: { value: 0.03 }, uReveal: { value: 1 }, uRes: { value: new THREE.Vector2(1, 1) }, uBg: { value: new THREE.Vector3(43 / 255, 33 / 255, 29 / 255) }, uEdge: { value: new THREE.Vector3(243 / 255, 180 / 255, 138 / 255) } },
  vertexShader: V,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uGrain, uReveal; uniform vec2 uRes; uniform vec3 uBg, uEdge; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
    void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; float l = dot(c, vec3(0.2126,0.7152,0.0722));
      c = mix(c, c*c*(3.0-2.0*c), 0.38);
      c += (h(floor(vUv*uRes) + fract(uTime)*91.7) - 0.5) * uGrain * (0.4 + l * 0.6);
      if (uReveal < 0.999) {
        float px = 1.0 / uRes.x; float hw = uReveal * 0.5 + px * 0.5; float d = abs(vUv.x - 0.5);
        float inside = 1.0 - smoothstep(hw - px, hw + px, d);
        float edge = exp(-abs(d - hw) / (px * 2.5)) * (1.0 - smoothstep(0.75, 1.0, uReveal));
        float shade = smoothstep(0.0, 0.25, d - hw) * 0.25;
        vec3 leaf = uBg * (1.0 - shade);
        c = mix(leaf, c, inside) + uEdge * edge * 0.9;
      }
      gl_FragColor = vec4(c, 1.0); }`,
};

export async function createScene({ canvas, mode = 'full', mobile = false, still = false, qFixed = null, step = async () => {} }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  if (!renderer.capabilities.isWebGL2) throw new Error('no-webgl2');
  renderer.toneMapping = THREE.AgXToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(C.depth, 1);
  const lite = mode === 'lite';
  const levels = mobile ? [MOBILE] : lite ? [LITE, QUALITY[2], QUALITY[3]] : QUALITY;
  let level = qFixed != null ? Math.min(+qFixed, levels.length - 1) : 0;
  const Q = () => levels[level];
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 4, 60000);
  await step(0.05, 'renderer');

  const W = buildWorld({ mobile, lite }); scene.add(W.world);
  await step(0.15, 'world');
  // PMREM власного неба (дзеркала латуні, скла, піску)
  const envScene = new THREE.Scene(); const envSky = W.skyMesh.clone(); envSky.scale.setScalar(0.01); envScene.add(envSky);
  W.sky.uSunDir.value.set(0, 0.12, -1).normalize(); W.sky.uZen.value.set(C.sea); W.sky.uHor.value.set('#EBCDB8'); W.sky.uGlow.value = 1.2;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(envScene, 0, 0.1, 1000).texture; scene.environment = null;
  await step(0.1, 'env');

  W.sandMat.envMap = env; W.sandMat.envMapIntensity = 0.5;
  const D = buildDoor(env, { mobile }); scene.add(D.door);
  const shaft = buildShaft({ mobile }); D.door.add(shaft.mesh, shaft.dust);
  await step(0.25, 'door');

  // світло: сонце (key), небо/пісок (hemi), промінь із-за дверей (spot)
  const sunL = new THREE.DirectionalLight('#F6C79A', 2.4); sunL.castShadow = true;
  sunL.shadow.camera.left = -420; sunL.shadow.camera.right = 420; sunL.shadow.camera.top = 420; sunL.shadow.camera.bottom = -420; sunL.shadow.camera.near = 50; sunL.shadow.camera.far = 9000; sunL.shadow.bias = -0.0004; sunL.shadow.normalBias = 0.6; sunL.shadow.radius = 4;
  scene.add(sunL, sunL.target);
  const hemi = new THREE.HemisphereLight('#E9D8CC', '#A08670', 1.1); scene.add(hemi);
  const fill = new THREE.DirectionalLight('#F4E2D4', 0.55); fill.position.set(-300, 260, 520); scene.add(fill); // м’яке заповнення з боку берега, без тіні
  const spot = new THREE.SpotLight(C.dawn, 0, 1400, 0.62, 0.75, 0); spot.position.set(0, 150, -190); spot.target.position.set(0, -10, 300);
  spot.castShadow = !mobile; spot.shadow.mapSize.set(1024, 1024); spot.shadow.camera.near = 40; spot.shadow.camera.far = 1600; spot.shadow.bias = -0.0006; spot.shadow.radius = 3;
  scene.add(spot, spot.target);
  scene.fog = new THREE.FogExp2('#E8D3C5', 6.3e-5);

  // post
  const rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: mobile ? 0 : 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const rays = new ShaderPass(RaysShader); composer.addPass(rays);
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.42, 0.5, 1.7); composer.addPass(bloom);
  const grade = new ShaderPass(GradeShader); composer.addPass(grade);
  composer.addPass(new OutputPass());
  const finish = new ShaderPass(FinishShader); composer.addPass(finish);

  const st = {
    w: 1, h: 1, dprScale: 1, frameAvg: 16, slowT: 0, fastT: 0, time: 0, reveal: 1, reduced: false, interactive: !still,
    cursor: { on: 0, nx: 0, ny: 0, overDoor: false, wx: 0, wz: 0, lastRip: 0, lx: 1e9, lz: 1e9 },
    tilt: { x: 0, y: 0, vx: 0, vy: 0 }, give: { a: 0, v: 0 }, rip: 0, extra: null,
  };
  function applyLevel() {
    const q = Q(); rays.enabled = true; st.raysOn = q.rays; bloom.enabled = q.bloom; // rays-прохід завжди: він же чистить NaN/Inf перед bloom
    sunL.shadow.mapSize.set(q.shadow, q.shadow); if (sunL.shadow.map) { sunL.shadow.map.dispose(); sunL.shadow.map = null; }
    spot.castShadow = q.spotShadow && !mobile;
    resize();
  }
  function resize() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    st.w = w; st.h = h;
    const dpr = Math.max(0.6, Math.min(devicePixelRatio || 1, Q().dpr) * st.dprScale);
    renderer.setPixelRatio(dpr); renderer.setSize(w, h, false);
    composer.setPixelRatio(dpr); composer.setSize(w, h);
    bloom.resolution.set(w * dpr / 2, h * dpr / 2);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    grade.uniforms.uAspect.value = w / h; finish.uniforms.uRes.value.set(w * dpr, h * dpr);
  }
  applyLevel();

  // компіляція шейдерів — частина чесного лічильника
  camera.position.set(0, 140, 640); camera.lookAt(0, 118, 0);
  renderer.compile(scene, camera); composer.render(0.016);
  await step(0.2, 'compile');

  /* ---------- курсор ---------- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), waterPl = new THREE.Plane(new THREE.Vector3(0, 1, 0), -WATER_Y), hit = new THREE.Vector3();
  const doorBox = new THREE.Box3();
  function pointer(cx, cy, active) {
    const c = st.cursor; if (!st.interactive) return;
    const r = canvas.getBoundingClientRect();
    c.nx = ((cx - r.left) / r.width) * 2 - 1; c.ny = -((cy - r.top) / r.height) * 2 + 1; c.on = active ? 1 : 0;
    if (!active) { c.overDoor = false; return; }
    ndc.set(c.nx, c.ny); ray.setFromCamera(ndc, camera);
    doorBox.setFromObject(D.frame).expandByScalar(4);
    c.overDoor = !!ray.ray.intersectBox(doorBox, hit);
    if (!c.overDoor && ray.ray.intersectPlane(waterPl, hit) && hit.z < -40) {
      const d = Math.hypot(hit.x - c.lx, hit.z - c.lz);
      if (d > 60 && st.time - c.lastRip > 0.14) { ripple(hit.x, hit.z, 0.7); c.lx = hit.x; c.lz = hit.z; c.lastRip = st.time; }
    }
  }
  function ripple(x, z, a = 1) { const r = W.seaU.uRip.value[st.rip++ % 6]; r.set(x, z, st.time, a); }
  function tap(cx, cy) {
    const r = canvas.getBoundingClientRect(); ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera);
    if (ray.ray.intersectPlane(waterPl, hit) && hit.z < -30) ripple(hit.x, hit.z, 1.2); else st.give.v += 2.2;
  }

  /* ---------- проекції ---------- */
  const v3 = new THREE.Vector3(), m4 = new THREE.Matrix4();
  function projectV(v) { v.project(camera); return [(v.x * 0.5 + 0.5) * st.w, (-v.y * 0.5 + 0.5) * st.h, v.z < 1 && Math.abs(v.x) < 1.15 && Math.abs(v.y) < 1.15]; }
  function project(x, y, z) { v3.set(x, y, z); return projectV(v3); }
  function projectPanel(i) { D.panels.getMatrixAt(i, m4); v3.setFromMatrixPosition(m4); D.body.localToWorld(v3); return projectV(v3); }

  /* ---------- небо/світло від сонця ---------- */
  const cz = { a: new THREE.Color('#4F6A72'), b: new THREE.Color('#5F7F86'), c: new THREE.Color('#82A4AA') };
  const chh = { a: new THREE.Color('#D6C0B6'), b: new THREE.Color('#EECDB6'), c: new THREE.Color('#EFE3D7'), f: new THREE.Color('#F7CFAF') };
  const sunWarm = new THREE.Color('#F6C79A'), sunDay = new THREE.Color('#FFF0E0'), tmp = new THREE.Color(), tmp2 = new THREE.Color();
  const sunDir = new THREE.Vector3();
  function applySky(o) {
    const asp0 = st.w / st.h, el = o.sunEl * Math.PI / 180, az = o.sunAz * Math.PI / 180 * (asp0 < 1 ? Math.max(0.35, asp0 * 0.8) : 1); // портрет: сонце в кадрі
    sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
    W.sky.uSunDir.value.copy(sunDir);
    const k1 = ss(clamp((o.sunEl + 7) / 10)), day = o.day;
    W.sky.uZen.value.copy(cz.a).lerp(cz.b, k1).lerp(cz.c, day);
    W.sky.uHor.value.copy(chh.a).lerp(chh.b, k1).lerp(chh.c, day).lerp(chh.f, o.flood * 0.6);
    W.sky.uGlow.value = lerp(0.8, 1.15, k1) * (1 - 0.6 * day) + o.flood * 0.25;
    W.sky.uDisc.value = 9 * ss(clamp((o.sunEl + 1.5) / 3)) * (1 - 0.5 * day);
    sunL.position.copy(sunDir).multiplyScalar(4000); sunL.target.position.set(0, 0, 0);
    sunL.intensity = 3.0 * ss(clamp((o.sunEl + 1) / 6)) + 0.6 * day;
    sunL.color.copy(sunWarm).lerp(sunDay, day);
    sunL.castShadow = sunL.intensity > 0.05;
    hemi.color.copy(W.sky.uZen.value).lerp(W.sky.uHor.value, 0.55); hemi.intensity = (1.1 + 0.9 * day + 0.3 * k1) * (1 - 0.3 * o.flood); fill.intensity = 0.55 * (1 - 0.5 * day) * (1 - 0.5 * o.flood);
    W.seaU.uChop.value = o.chop; W.seaU.uFlood.value = o.flood; W.seaU.uPath.value = o.path || 0;
    const fogK = 6.3e-5 * (1 + 0.5 * o.mist); W.seaU.uFogD.value = fogK; scene.fog.density = fogK;
    W.mistU.uMist.value = o.mist;
    // колір туману = горизонт у напрямку погляду
    const vx = camera.getWorldDirection(v3); const hl = Math.hypot(v3.x, v3.z) || 1; const cs = Math.max(0, (v3.x * sunDir.x + v3.z * sunDir.z) / hl / Math.hypot(sunDir.x, sunDir.z));
    tmp.copy(W.sky.uHor.value); tmp2.copy(W.sky.uGlowCol.value).multiplyScalar(W.sky.uGlow.value * 0.32 * (0.35 + 0.65 * cs * cs)); tmp.add(tmp2);
    scene.fog.color.copy(tmp);
  }

  /* ---------- поза ---------- */
  const camPos = new THREE.Vector3(), camTg = new THREE.Vector3();
  let raySrc = new THREE.Vector3();
  function apply(o, dt) {
    const t = st.time;
    applySky(o);
    // розліт
    const e = (id) => explodeOf(id, o.E);
    const off = (id) => PARTS.find((x) => x.id === id).off;
    const setOff = (obj, id, base) => { const k = e(id), f = off(id); obj.position.set(base.x + f[0] * k, base.y + f[1] * k, base.z + f[2] * k); };
    setOff(D.frame, 'frame', D.base.frame); setOff(D.transom, 'transom', D.base.transom); setOff(D.glow, 'glow', D.base.glow);
    setOff(D.sill, 'sill', D.base.sill); D.ao.material.opacity = 0.5 * (1 - explodeOf('sill', o.E)); setOff(D.skeleton, 'skeleton', D.base.skeleton); setOff(D.hinges, 'hinges', D.base.hinges); setOff(D.handle, 'handle', D.base.handle);
    if (o.pop) for (let i = 0; i < 6; i++) D.pop[i] += (o.pop[i] - D.pop[i]) * (1 - Math.exp(-dt * 9));
    if (o.heat) for (let i = 0; i < 6; i++) D.heat[i] += (o.heat[i] - D.heat[i]) * (1 - Math.exp(-dt * 6));
    const ep = e('panels'); D.setPanels(ep, PANEL_SPREAD);
    // стулка + кноб (+ «дихання» і піддатливість під курсором — аддитивно)
    const c = st.cursor, live = st.interactive && !st.reduced;
    const want = live && c.overDoor && o.E < 0.05 ? 4.5 : 0;
    st.give.v += ((want - st.give.a) * 190 - st.give.v * 19) * dt; st.give.a += st.give.v * dt;
    const breathe = live ? o.breathe * (0.45 + 0.45 * Math.sin(t * 0.9)) : 0;
    D.leaf.rotation.y = -(o.open + breathe + st.give.a) * Math.PI / 180;
    D.knob.rotation.z = -o.knob * Math.PI / 180;
    // світло
    const pulse = live ? 1 + 0.06 * Math.sin(t * 1.3) * o.breathe : 1;
    D.mats.glow.opacity = o.slit * pulse; D.glow.visible = o.slit > 0.003;
    D.mats.key.color.set(C.dawn).multiplyScalar(1 + 6 * o.slit);
    spot.intensity = o.beam * 5.2; spot.visible = o.beam > 0.01;
    // клин світла крізь проріз + пилинки (лише з боку берега, поки світло за дверима)
    const ang = (o.open + breathe + st.give.a) * Math.PI / 180, x0 = Math.min(45.5, -47.5 + 95 * Math.cos(ang) + 1), x1 = 47.5;
    const shaftOn = o.E > 0.02 ? 0 : clamp(o.beam) * (0.45 + 0.55 * clamp((x1 - x0) / 60)) * (o.p < 0.56 || o.p > 0.88 ? 1 : 0);
    shaft.update(x0, x1, shaftOn, (o.dust || 0) * (o.E > 0.02 ? 0 : 1), st.time, renderer.getPixelRatio());
    D.mats.sillMat.color.set(C.trav).lerp(tmp.set('#E9B992'), o.warm * 0.55);
    D.mats.travMat.color.set('#CDB59C').lerp(tmp.set('#E7BE9C'), o.warm * 0.3);
    grade.uniforms.uWarm.value = o.flood * 0.5 + o.warm * 0.15;
    // нахил дверей до курсора
    const T = st.tilt, tg = live ? 1 : 0;
    T.vx += ((c.ny * 0.022 * tg - T.x) * 38 - T.vx * 8.5) * dt; T.vy += ((c.nx * 0.03 * tg - T.y) * 38 - T.vy * 8.5) * dt; T.x += T.vx * dt; T.y += T.vy * dt;
    D.door.rotation.set(-T.x * 0.4 * o.breathe, T.y * (0.3 + 0.7 * o.breathe), 0);
    // камера (+ портретний аспект: ближче до центру, далі, двері вище)
    const asp = st.w / st.h, cm = o.cam;
    camPos.set(...cm.pos); camTg.set(...cm.target);
    if (asp < 1) {
      const dir = camTg.clone().sub(camPos); const dist = dir.length(); dir.normalize();
      const push = Math.min(dist, 760) * (1 - asp) * 1.05 * (1 - ss(clamp((dist - 900) / 700)));
      camPos.x *= 0.35 + 0.65 * asp; camTg.x *= 0.35 + 0.65 * asp;
      camPos.addScaledVector(dir, -push);
      camTg.y -= Math.min(dist, 760) * 0.11 * (1 - asp);
    }
    const par = live ? 1 : 0;
    const drift = 3 + 13 * o.breathe; // повільний дрейф камери (сильніше в hero)
    camPos.x += c.nx * 7 * par + Math.sin(t * 0.11) * drift * par; camPos.y += c.ny * 4 * par + Math.sin(t * 0.17) * (1.5 + 3 * o.breathe) * par; camPos.z += Math.sin(t * 0.07) * drift * 0.8 * par;
    camera.position.copy(camPos); camera.fov = cm.fov * (asp < 1 ? 1.08 : 1); camera.updateProjectionMatrix(); camera.lookAt(camTg);
    W.skyMesh.position.copy(camera.position);
    // god rays: щілина за дверима або сонце
    rays.uniforms.uStr.value = 0;
    if (st.raysOn) {
      if (o.p < 0.56 && o.slit > 0.02) { raySrc.set(0, 120, -5); D.door.localToWorld(raySrc); }
      else raySrc.copy(camera.position).addScaledVector(sunDir, 30000);
      const s = raySrc.clone().project(camera);
      const on = s.z < 1 ? clamp(1.4 - Math.max(Math.abs(s.x), Math.abs(s.y)) * 0.9) : 0;
      rays.uniforms.uLight.value.set(s.x * 0.5 + 0.5, s.y * 0.5 + 0.5); rays.uniforms.uStr.value = o.rays * on;
    }
  }

  function frame(dt, P) {
    dt = Math.min(dt, 1 / 20);
    if (!still) st.time += dt;
    W.seaU.uTime.value = still ? 3.0 : st.time; W.mistU.uTime.value = still ? 3.0 : st.time;
    finish.uniforms.uTime.value = still ? 0.5 : st.time; finish.uniforms.uReveal.value = st.reveal;
    const o = st.extra ? { ...P, ...st.extra } : P;
    apply(o, dt);
    composer.render(dt);
    if (!still && qFixed == null) {
      // адаптивність за реальним годинником: < 45 кадрів/с → спершу вимикаємо дорогі ефекти (рівень), потім знижуємо DPR;
      // > 57 кадрів/с 4 с поспіль → DPR назад до 1
      const now = performance.now();
      if (st.idle || !st.lastF || now - st.lastF > 200) { st.fc = 0; st.t0 = now; } // покій (30 к/с) або пауза — не міряємо
      st.lastF = now; st.fc = (st.fc || 0) + 1;
      if (now - st.t0 >= 1000) {
        const fps = st.fc * 1000 / (now - st.t0); st.fc = 0; st.t0 = now;
        if (fps < 45) { st.fastT = 0; if (++st.slowT >= 1) { st.slowT = 0; if (level < levels.length - 1) { level++; applyLevel(); } else if (st.dprScale > 0.8) { st.dprScale = Math.max(0.76, st.dprScale - 0.12); resize(); } } }
        else if (fps > 57) { st.slowT = 0; if (++st.fastT >= 4 && st.dprScale < 1) { st.fastT = 0; st.dprScale = Math.min(1, st.dprScale + 0.06); resize(); } }
        else { st.slowT = 0; st.fastT = 0; }
      }
    }
  }
  return {
    renderer, scene, camera, door: D, world: W, st, frame, resize, pointer, tap, ripple, project, projectPanel, PANEL_LAYOUT,
    get level() { return level; }, get dpr() { return renderer.getPixelRatio(); },
  };
}
