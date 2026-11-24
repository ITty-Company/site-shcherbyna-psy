// door.js — процедурна модель «Двері на березі»: арочна рама, стулка (каркас + 6 філенок), фрамуга-скло,
// латунний кноб із замковою щілиною, петлі, травертиновий поріг, світло за дверима; море (Gerstner), небо, пісок, туман.
// Одиниці — сантиметри. Двері стоять на x=0, поріг зверху y=0, лице дверей дивиться на +z (берег), море — −z.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const C = {
  pudra: '#F4E9E1', depth: '#2B211D', terra: '#9A4630', sea: '#1F4E5A', dawn: '#F3B48A', trav: '#DCC8B4', sand: '#6B5850', foam: '#FBF6F1',
};
export const DOOR = { W: 110, R: 55, RI: 48, SPRING: 175, H: 230, LEAF_W: 95, LEAF_H: 173.2, LEAF_Y: 0.8, PIVOT: [-47.5, 0, 5.6], T: 5 };
export const WATER_Y = -14;
export const sandH = (x, z) => -12 + (z > 0 ? z * 0.015 : z * 0.09) + 1.2 * Math.sin(x * 0.011 + z * 0.004) * Math.sin(z * 0.013 - x * 0.002) * (z > -10 ? 1 : 0.3);

/* ---------- seeded rng + canvas-текстури ---------- */
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function canvasTex(size, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); draw(g, size);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t;
}
// лайм-вош: м’які плями + вертикальні мазки пензля
function limewash(size) {
  const R = rng(7);
  return canvasTex(size, (g, s) => {
    g.fillStyle = '#f2ebe4'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 140; i++) { const x = R() * s, y = R() * s, r = 20 + R() * 90, a = 0.012 + R() * 0.022; const gr = g.createRadialGradient(x, y, 0, x, y, r); const v = R() > 0.5 ? 255 : 205; gr.addColorStop(0, `rgba(${v},${v - 8},${v - 14},${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
    for (let i = 0; i < 500; i++) { const x = R() * s, y = R() * s, h = 20 + R() * 80; g.fillStyle = `rgba(${R() > 0.5 ? '255,255,255' : '160,140,128'},${0.012 + R() * 0.02})`; g.fillRect(x, y, 2 + R() * 3, h); }
  });
}
// фарбоване дерево: поздовжні волокна + сучки під лайм-вошем (колір) і окремо — рельєф
function woodGrain(size, bump = false) {
  const R = rng(bump ? 21 : 23);
  return canvasTex(size, (g, s) => {
    g.fillStyle = bump ? '#808080' : '#f3ebe3'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 260; i++) {
      const x0 = R() * s, w = 0.6 + R() * 2.2, a = bump ? 0.18 + R() * 0.3 : 0.02 + R() * 0.045, ph = R() * 6, amp = 1 + R() * 3;
      const v = R() > 0.45 ? 0 : 255; g.strokeStyle = bump ? `rgba(${v},${v},${v},${a})` : `rgba(120,92,72,${a})`;
      g.lineWidth = w; g.beginPath();
      for (let y = -4; y <= s + 4; y += 8) { const x = x0 + Math.sin(y * 0.012 + ph) * amp + Math.sin(y * 0.05 + ph * 2) * 0.6; y < 0 ? g.moveTo(x, y) : g.lineTo(x, y); }
      g.stroke();
    }
    for (let i = 0; i < 3; i++) { const x = R() * s, y = R() * s; const gr = g.createRadialGradient(x, y, 0, x, y, 10 + R() * 10); gr.addColorStop(0, bump ? 'rgba(0,0,0,.35)' : 'rgba(120,90,70,.08)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - 24, y - 24, 48, 48); }
  }, !bump);
}
// травертин: горизонтальні шари + пори
function travertine(size) {
  const R = rng(11);
  return canvasTex(size, (g, s) => {
    g.fillStyle = '#e9ddd0'; g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 2) { const v = Math.sin(y * 0.05 + Math.sin(y * 0.013) * 3) * 0.5 + 0.5; g.fillStyle = `rgba(170,140,112,${0.04 + v * 0.06})`; g.fillRect(0, y, s, 2); }
    for (let i = 0; i < 2600; i++) { const x = R() * s, y = R() * s, w = 0.6 + R() * 3.2, h = 0.4 + R() * 0.9; g.fillStyle = `rgba(110,86,70,${0.12 + R() * 0.26})`; g.beginPath(); g.ellipse(x, y, w, h, 0, 0, Math.PI * 2); g.fill(); }
  });
}
function sandBump(size) {
  const R = rng(3);
  return canvasTex(size, (g, s) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 9000; i++) { const v = (R() * 255) | 0; g.fillStyle = `rgba(${v},${v},${v},0.35)`; g.fillRect(R() * s, R() * s, 1.5, 1.5); }
    for (let y = 0; y < s; y++) { const v = Math.sin(y * 0.35 + Math.sin(y * 0.05) * 2) * 0.5 + 0.5; g.fillStyle = `rgba(255,255,255,${v * 0.07})`; g.fillRect(0, y, s, 1); }
  }, false);
}

/* ---------- геометрія дверей ---------- */
const ni = (g) => (g.index ? g.toNonIndexed() : g);
function archOutline() {
  const { R, RI, SPRING } = DOOR, s = new THREE.Shape();
  s.moveTo(-R, 0); s.lineTo(-RI, 0); s.lineTo(-RI, SPRING);
  for (let i = 0; i <= 48; i++) { const a = Math.PI - (i / 48) * Math.PI; s.lineTo(RI * Math.cos(a), SPRING + RI * Math.sin(a)); }
  s.lineTo(RI, 0); s.lineTo(R, 0); s.lineTo(R, SPRING);
  for (let i = 0; i <= 56; i++) { const a = (i / 56) * Math.PI; s.lineTo(R * Math.cos(a), SPRING + R * Math.sin(a)); }
  s.lineTo(-R, 0);
  return s;
}
function frameGeometry() {
  const g = new THREE.ExtrudeGeometry(archOutline(), { depth: 14, bevelEnabled: true, bevelThickness: 1.2, bevelSize: 1.2, bevelSegments: 2, curveSegments: 24 });
  g.translate(0, 0, -7); g.computeVertexNormals();
  // транец (перекладина над стулкою)
  const bar = new RoundedBoxGeometry(96, 4.4, 12, 2, 0.8); bar.translate(0, DOOR.SPRING + 2.0, 0);
  return mergeGeometries([ni(g), ni(bar)]);
}
function glowGeometry() {
  const s = new THREE.Shape(), { RI, SPRING } = DOOR;
  s.moveTo(-RI, 0); s.lineTo(RI, 0); s.lineTo(RI, SPRING);
  s.absarc(0, SPRING, RI, 0, Math.PI, false); s.lineTo(-RI, 0);
  const g = new THREE.ShapeGeometry(s, 24); g.translate(0, 0, -5.5); return g;
}
function transomGeometry() {
  const s = new THREE.Shape(); s.moveTo(-46.5, 0); s.lineTo(46.5, 0); s.absarc(0, 0, 46.5, 0, Math.PI, false);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.8, bevelEnabled: false, curveSegments: 32 }); g.translate(0, DOOR.SPRING + 4.2, -0.4); return g;
}
// променеві горбильки фрамуги (латунь)
function muntinGeometry() {
  const parts = [];
  for (let i = 1; i < 4; i++) { const a = (i / 4) * Math.PI; const b = new THREE.BoxGeometry(1.1, 44, 1.6); b.translate(0, 22, 0); b.rotateZ(a - Math.PI / 2); b.translate(0, DOOR.SPRING + 4.2, 0.6); parts.push(b.toNonIndexed()); }
  const ring = new THREE.TorusGeometry(8, 0.55, 6, 24, Math.PI); ring.translate(0, DOOR.SPRING + 4.2, 0.6); parts.push(ring.toNonIndexed());
  return mergeGeometries(parts);
}
// каркас стулки: 2 стояки, 4 перекладини, середник — у локальних координатах стулки (x 0..95 від петель)
const RAILS = [{ y: 10.8, h: 20 }, { y: 62, h: 9 }, { y: 118, h: 9 }, { y: 167.6, h: 12 }];
export const PANEL_LAYOUT = (() => {
  const rows = [[20.8, 57.5], [66.5, 113.5], [122.5, 161.6]], cols = [[11, 43.5], [51.5, 84]], out = [];
  // порядок: знизу вгору, зліва направо → 6 тем
  rows.forEach(([a, b]) => cols.forEach(([l, r]) => out.push({ x: (l + r) / 2, y: (a + b) / 2, w: r - l, h: b - a })));
  return out;
})();
function skeletonGeometry() {
  const T = DOOR.T, H = DOOR.LEAF_H, y0 = DOOR.LEAF_Y, parts = [];
  const add = (w, h, x, y) => { const b = new RoundedBoxGeometry(w, h, T, 2, 0.7); b.translate(x, y, 0); parts.push(b); };
  add(11, H, 5.5, y0 + H / 2); add(11, H, 89.5, y0 + H / 2);
  RAILS.forEach((r) => add(73.4, r.h, 47.5, r.y));
  [[20.8, 57.5], [66.5, 113.5], [122.5, 161.6]].forEach(([a, b]) => add(8.2, b - a + 0.4, 47.5, (a + b) / 2));
  // задня дошка між філенками (щоб не просвічувало)
  const back = new THREE.BoxGeometry(74, H - 2, 1.2); back.translate(47.5, y0 + H / 2, -1.6); parts.push(back);
  return mergeGeometries(parts.map(ni));
}
// філенка-«подушка»: одиничний розмір 32×40, масштабується по висоті ряду
function panelGeometry() {
  const s = new THREE.Shape(), w = 29.5, h = 37.5, r = 1.2;
  s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const g = new THREE.ExtrudeGeometry(s, { depth: 1.4, bevelEnabled: true, bevelThickness: 1.3, bevelSize: 3.2, bevelSegments: 4, curveSegments: 4 });
  g.translate(0, 0, -0.7); g.computeVertexNormals(); return g;
}
function knobGeometry() {
  const pts = [[0, 0], [3.7, 0], [3.8, 0.5], [3.2, 0.9], [1.25, 1.4], [1.0, 3.2], [1.3, 4.0], [2.7, 4.8], [3.1, 6.0], [2.9, 7.2], [2.0, 8.0], [0.8, 8.3], [0, 8.35]].map(([x, y]) => new THREE.Vector2(x, y));
  const g = new THREE.LatheGeometry(pts, 48);
  // рифлення бульби — щоб поворот кноба було видно
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = THREE.MathUtils.smoothstep(y, 4.2, 5.4) * (1 - THREE.MathUtils.smoothstep(y, 7.2, 8.1)); const f = 1 + 0.075 * Math.cos(10 * Math.atan2(z, x)) * k; p.setXYZ(i, x * f, y, z * f); }
  g.computeVertexNormals(); g.rotateX(Math.PI / 2); return g;
}
function keyholeGeometry() {
  const s = new THREE.Shape(); s.absarc(0, 1.1, 0.75, -0.35, Math.PI + 0.35, false); s.lineTo(-0.55, -1.4); s.lineTo(0.55, -1.4); s.closePath();
  const g = new THREE.ShapeGeometry(s, 12); return g;
}
function hingeGeometry() {
  const parts = [];
  [20, 88, 156].forEach((y) => {
    const c = new THREE.CylinderGeometry(1.15, 1.15, 13, 16); c.translate(-0.2, y, 2.9); parts.push(c.toNonIndexed());
    const cap = new THREE.SphereGeometry(1.15, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2); cap.translate(-0.2, y + 6.5, 2.9); parts.push(cap.toNonIndexed());
    const pl = new THREE.BoxGeometry(5.5, 11, 0.35); pl.translate(2.4, y, 2.65); parts.push(pl.toNonIndexed());
  });
  return mergeGeometries(parts);
}

/* ---------- спільний GLSL неба ---------- */
export const SKY_GLSL = /* glsl */`
uniform vec3 uSunDir, uZen, uHor, uGlowCol, uSunCol; uniform float uGlow, uDisc;
vec3 skyCol(vec3 d){
  float e = d.y; float t = pow(clamp(e, 0.0, 1.0), 0.42);
  vec3 c = mix(uHor, uZen, t);
  float cs = max(dot(normalize(vec3(d.x, max(e, 0.0), d.z)), uSunDir), 0.0);
  float band = exp(-abs(e) * 14.0);
  c += uGlowCol * uGlow * (pow(cs, 5.0) * 0.55 + pow(cs, 48.0) * 0.9) * (1.0 - t * 0.6);
  c += uGlowCol * uGlow * 0.32 * band * (0.35 + 0.65 * cs * cs);
  return c;
}`;
function skyUniforms() {
  return {
    uSunDir: { value: new THREE.Vector3(0, 0.05, -1).normalize() }, uZen: { value: new THREE.Color(C.sea) }, uHor: { value: new THREE.Color(C.pudra) },
    uGlowCol: { value: new THREE.Color(C.dawn) }, uSunCol: { value: new THREE.Color('#FFE2C4') }, uGlow: { value: 1 }, uDisc: { value: 10 },
  };
}

/* ---------- збірка дверей ---------- */
export function buildDoor(env, { mobile = false } = {}) {
  const door = new THREE.Group(); door.name = 'door';
  const limeMap = limewash(mobile ? 256 : 512), travMap = travertine(mobile ? 256 : 512);
  travMap.repeat.set(1 / 60, 1 / 60); // UV extrude у см → 60 см на тайл
  const grain = woodGrain(mobile ? 256 : 512), grainB = woodGrain(mobile ? 256 : 512, true);
  const leafMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#F0DFD0'), map: grain, bumpMap: grainB, bumpScale: 0.9, roughness: 0.52, clearcoat: 0.32, clearcoatRoughness: 0.38, sheen: 0.25, sheenColor: new THREE.Color('#F3B48A'), envMap: env, envMapIntensity: 0.7 });
  const panelMat = leafMat.clone(); panelMat.color = new THREE.Color('#F3E4D6');
  panelMat.map = grain.clone(); panelMat.map.repeat.set(1 / 36, 1 / 36); panelMat.map.needsUpdate = true;
  panelMat.bumpMap = grainB.clone(); panelMat.bumpMap.repeat.set(1 / 36, 1 / 36); panelMat.bumpMap.needsUpdate = true; void limeMap;
  const travMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#D8C2AA'), map: travMap, bumpMap: travMap, bumpScale: 1.4, roughness: 0.8, envMap: env, envMapIntensity: 0.55 });
  const brass = new THREE.MeshStandardMaterial({ color: new THREE.Color('#D2A867'), metalness: 1, roughness: 0.2, envMap: env, envMapIntensity: 1.9 });
  const glass = new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#F6D9C2'), roughness: 0.06, metalness: 0, transparent: true, opacity: 0.32, envMap: env, envMapIntensity: 1.4, depthWrite: false });
  const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(C.dawn).multiplyScalar(4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: true });
  const keyMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(C.dawn).multiplyScalar(6), toneMapped: true });

  const frame = new THREE.Mesh(frameGeometry(), travMat); frame.castShadow = frame.receiveShadow = true; door.add(frame);
  const muntins = new THREE.Mesh(muntinGeometry(), brass); frame.add(muntins);
  const transom = new THREE.Mesh(transomGeometry(), glass); transom.renderOrder = 2; door.add(transom);
  const glow = new THREE.Mesh(glowGeometry(), glowMat); glow.renderOrder = 3; door.add(glow);

  // поріг-травертин 140×12×40
  const sillG = new RoundedBoxGeometry(140, 12, 40, 3, 1.2); sillG.translate(0, -6, 2);
  const sillTex = travertine(mobile ? 256 : 512); sillTex.repeat.set(2, 0.5);
  const sillMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(C.trav), map: sillTex, bumpMap: sillTex, bumpScale: 1.2, roughness: 0.78, envMap: env, envMapIntensity: 0.5 });
  const sill = new THREE.Mesh(sillG, sillMat); sill.castShadow = sill.receiveShadow = true; door.add(sill);

  const aoTex = canvasTex(128, (g, s2) => { const gr = g.createRadialGradient(s2 / 2, s2 / 2, 0, s2 / 2, s2 / 2, s2 / 2); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.55, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, s2, s2); }, false);
  const ao = new THREE.Mesh(new THREE.PlaneGeometry(230, 110), new THREE.MeshBasicMaterial({ color: new THREE.Color('#3a2a22'), alphaMap: aoTex, transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
  ao.rotation.x = -Math.PI / 2; ao.position.set(0, -11.3, 4); ao.renderOrder = 1; door.add(ao); // м’яка контактна тінь на піску
  const leaf = new THREE.Group(); leaf.position.set(...DOOR.PIVOT); door.add(leaf);
  const body = new THREE.Group(); body.position.z = -DOOR.T / 2; leaf.add(body);
  const skeleton = new THREE.Mesh(skeletonGeometry(), leafMat); skeleton.castShadow = skeleton.receiveShadow = true; body.add(skeleton);
  const panels = new THREE.InstancedMesh(panelGeometry(), panelMat, 6); panels.castShadow = true; panels.receiveShadow = true;
  panels.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(18).fill(1), 3);
  body.add(panels);
  const hinges = new THREE.Mesh(hingeGeometry(), brass); hinges.castShadow = true; body.add(hinges);

  // кноб + розетка + замкова щілина (з обох боків)
  const handle = new THREE.Group(); handle.position.set(85.5, 96, 0); body.add(handle);
  const knobG = knobGeometry();
  const knobF = new THREE.Mesh(knobG, brass); knobF.position.z = DOOR.T / 2 + 0.6; knobF.castShadow = true; handle.add(knobF);
  const knobB = new THREE.Mesh(knobG, brass); knobB.rotation.y = Math.PI; knobB.position.z = -DOOR.T / 2 - 0.6; handle.add(knobB);
  const ros = new THREE.CylinderGeometry(3.9, 4.1, 0.8, 40); ros.rotateX(Math.PI / 2);
  const rosF = new THREE.Mesh(ros, brass); rosF.position.z = DOOR.T / 2 + 0.4; handle.add(rosF);
  const rosB = rosF.clone(); rosB.position.z = -DOOR.T / 2 - 0.4; handle.add(rosB);
  const plate = new RoundedBoxGeometry(4.2, 7.5, 0.6, 2, 0.5); const plateM = new THREE.Mesh(plate, brass); plateM.position.set(0, -11, DOOR.T / 2 + 0.3); handle.add(plateM);
  const key = new THREE.Mesh(keyholeGeometry(), keyMat); key.position.set(0, -11, DOOR.T / 2 + 0.62); handle.add(key);
  const knobPivot = new THREE.Group(); knobPivot.add(knobF); handle.add(knobPivot); // кноб обертається довкола осі z

  const base = { frame: frame.position.clone(), transom: transom.position.clone(), glow: glow.position.clone(), sill: sill.position.clone(), skeleton: skeleton.position.clone(), hinges: hinges.position.clone(), handle: handle.position.clone() };
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), col = new THREE.Color();
  const pop = new Float32Array(6), heat = new Float32Array(6), HEAT = new THREE.Color('#FFD9BE');
  function setPanels(E, spread = 1) {
    PANEL_LAYOUT.forEach((L, i) => {
      const cx = 47.5, cy = DOOR.LEAF_Y + DOOR.LEAF_H / 2;
      const k = E * (spread - 1);
      ps.set(L.x + (L.x - cx) * k, L.y + (L.y - cy) * k * 0.55, (E ? E * 78 : 0) + pop[i] * 10);
      sc.set(L.w / 29.5 * 0.94 + 0.06, L.h / 37.5 * 0.97, 1 + pop[i] * 0.4);
      q.identity(); m4.compose(ps, q, sc); panels.setMatrixAt(i, m4);
      col.set('#ffffff').lerp(HEAT, heat[i] * 0.55); panels.setColorAt(i, col);
    });
    panels.instanceMatrix.needsUpdate = true; panels.instanceColor.needsUpdate = true;
  }
  setPanels(0);
  const glowMats = { glow: glowMat, key: keyMat, travMat, sillMat, glass };
  return { door, ao, leaf, body, frame, transom, glow, sill, skeleton, panels, hinges, handle, knob: knobPivot, base, setPanels, pop, heat, mats: glowMats, leafMat };
}

/* ---------- світ: небо, море, пісок, туман ---------- */
export function buildWorld({ mobile = false, lite = false } = {}) {
  const sky = skyUniforms();
  const world = new THREE.Group();
  // небо
  const skyMat = new THREE.ShaderMaterial({
    uniforms: { ...sky }, side: THREE.BackSide, depthWrite: false,
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); vec4 p = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*p; gl_Position.z = gl_Position.w*0.99999; }`,
    fragmentShader: SKY_GLSL + `varying vec3 vD; void main(){ vec3 d = normalize(vD); vec3 c = skyCol(d);
      float cs = dot(d, uSunDir); c += uSunCol * uDisc * smoothstep(0.99955, 0.99975, cs) * smoothstep(-0.004, 0.006, d.y);
      if (d.y < 0.0) c = skyCol(vec3(d.x, 0.0, d.z));
      gl_FragColor = vec4(c, 1.0); }`,
  });
  const skyMesh = new THREE.Mesh(new THREE.SphereGeometry(40000, 48, 24), skyMat); skyMesh.renderOrder = -10; skyMesh.frustumCulled = false; world.add(skyMesh);

  // море: сітка зі згущенням біля дверей
  const N = lite || mobile ? 160 : 256, RAD = 42000;
  const sg = new THREE.PlaneGeometry(2, 2, N, N); sg.rotateX(-Math.PI / 2);
  const sp = sg.attributes.position;
  for (let i = 0; i < sp.count; i++) { const u = sp.getX(i), v = sp.getZ(i); sp.setXYZ(i, Math.sign(u) * u * u * RAD, WATER_Y, Math.sign(v) * v * v * RAD - 200); }
  sg.computeBoundingSphere(); sg.boundingSphere.radius = RAD * 2;
  const seaU = {
    ...sky, uTime: { value: 0 }, uChop: { value: 2 }, uFogD: { value: 6.3e-5 }, uDeep: { value: new THREE.Color('#173F4A') }, uShallow: { value: new THREE.Color('#6F8B88') },
    uSand: { value: new THREE.Color('#A89380') }, uRip: { value: Array.from({ length: 6 }, () => new THREE.Vector4(0, 0, -99, 0)) }, uFlood: { value: 0 }, uPath: { value: 0 },
  };
  const WAVES = `
  const int NW = 5;
  const vec4 W[5] = vec4[5](vec4(0.20,1.0,900.0,9.0), vec4(-0.55,0.84,520.0,5.0), vec4(0.72,0.69,300.0,3.0), vec4(-0.18,0.98,170.0,1.5), vec4(0.45,-0.9,110.0,0.7));
  float shoreA(vec2 p){ return smoothstep(-26.0, -240.0, p.y); }
  vec3 gerst(vec2 p, float t, float chop, out vec3 nrm){
    vec3 o = vec3(0.0); vec3 tx = vec3(1.0,0.0,0.0), bz = vec3(0.0,0.0,1.0);
    float sa = shoreA(p);
    for (int i=0;i<NW;i++){
      vec2 d = normalize(W[i].xy); float L = W[i].z; float k = 6.2831853/L; float c = sqrt(981.0/k);
      float A = W[i].w * chop * 0.5 * sa; float Q = min(1.0, chop) * 0.55 / (k * W[i].w * float(NW) + 1e-4);
      float f = k*(dot(d,p) - c*t*0.35);
      float cf = cos(f), sf = sin(f);
      o.x += Q*A*d.x*cf; o.z += Q*A*d.y*cf; o.y += A*sf;
      tx += vec3(-Q*d.x*d.x*k*A*sf, d.x*k*A*cf, -Q*d.x*d.y*k*A*sf);
      bz += vec3(-Q*d.x*d.y*k*A*sf, d.y*k*A*cf, -Q*d.y*d.y*k*A*sf);
    }
    nrm = normalize(cross(bz, tx)); return o;
  }`;
  const seaMat = new THREE.ShaderMaterial({
    uniforms: seaU,
    vertexShader: `uniform float uTime, uChop; varying vec3 vW; varying vec2 vP; varying float vH;` + WAVES + `
      void main(){ vec2 p = position.xz; vec3 n; vec3 o = gerst(p, uTime, uChop, n);
        float far = 1.0 - smoothstep(6000.0, 20000.0, length(p - cameraPosition.xz));
        vec3 w = vec3(p.x + o.x*far, position.y + o.y*far, p.y + o.z*far); vW = w; vP = p; vH = o.y*far;
        gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0); }`,
    fragmentShader: SKY_GLSL + `uniform float uTime, uChop, uFogD, uFlood, uPath; uniform vec3 uDeep, uShallow, uSand; uniform vec4 uRip[6]; varying vec3 vW; varying vec2 vP; varying float vH;` + WAVES + `
      float h21(vec2 p){ return fract(sin(dot(p, vec2(41.3,289.1)))*43758.5); }
      float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
      void main(){
        vec3 n; gerst(vP, uTime, uChop, n);
        float dist = length(vW - cameraPosition);
        float fine = 1.0 - smoothstep(1500.0, 9000.0, dist);
        // дрібні брижі
        vec2 q = vP*0.045; float t = uTime;
        vec2 rip = vec2(sin(q.x*1.7 + t*1.3 + sin(q.y*1.1)), cos(q.y*2.1 - t*1.1 + sin(q.x*0.7))) * 0.07 * (0.35 + uChop*0.4) * fine;
        rip += vec2(sin(q.x*4.3 - t*2.0 + q.y*1.9), cos(q.y*3.7 + t*1.7 - q.x*1.3)) * 0.035 * (0.3+uChop*0.4) * fine;
        // кола-брижі від курсора/тапу
        for (int i=0;i<6;i++){ vec4 r = uRip[i]; float age = t - r.z; if (age < 0.0 || age > 4.0) continue;
          vec2 dv = vP - r.xy; float d = length(dv); float front = age*95.0; float w = exp(-abs(d-front)*0.045) * exp(-age*1.1) * r.w;
          rip += normalize(dv + 1e-3) * sin((d-front)*0.16) * w * 0.55; }
        n = normalize(n + vec3(rip.x, 0.0, rip.y));
        vec3 V = normalize(cameraPosition - vW);
        vec3 R = reflect(-V, n); R.y = abs(R.y);
        float F = 0.02 + 0.98*pow(1.0 - max(dot(n, V), 0.0), 5.0);
        vec3 refl = skyCol(R);
        float sp = max(dot(R, uSunDir), 0.0);
        float shin = mix(1400.0, 160.0, clamp(uChop/2.0, 0.0, 1.0));
        float sunUp = smoothstep(-0.03, 0.03, uSunDir.y);
        vec3 spec = uSunCol * (pow(sp, shin)*uDisc*0.9 + pow(sp, shin*0.08)*0.55*uGlow) * sunUp;
        spec *= uPath < 1.0 ? 1.0 : smoothstep(uPath - 700.0, uPath + 700.0, dist);
        float depth = (WATER_Y_ - (-12.0 + vP.y*0.09)) + vH;
        vec3 body = mix(uShallow, uDeep, smoothstep(0.0, 26.0, depth));
        body = mix(uSand*0.85, body, smoothstep(0.0, 5.0, depth));
        vec3 col = mix(body, refl, F) + spec;
        // піна: гребені + лінія прибою
        float nz = vn(vP*0.03 + vec2(t*0.2, -t*0.15)) * 0.6 + vn(vP*0.09 - t*0.3)*0.4;
        float crest = smoothstep(0.55, 1.0, vH / (4.0*uChop+0.5)) * smoothstep(0.35, 0.8, nz) * clamp(uChop-0.3, 0.0, 1.0);
        float surf = smoothstep(7.0, 1.5, depth + sin(t*0.9 + vP.x*0.004)*2.0) * smoothstep(0.25, 0.7, nz) * (0.4 + 0.3*uChop);
        col = mix(col, vec3(0.93,0.9,0.86)*(0.6 + 0.4*uGlow), clamp(crest*0.6 + surf*0.75, 0.0, 0.85) * fine);
        col += uGlowCol * uFlood * 0.25 * F;
        // туман до кольору горизонту
        float f = 1.0 - exp(-pow(dist*uFogD, 2.0));
        col = mix(col, skyCol(vec3(-V.x, 0.0, -V.z)), f);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`.replace('WATER_Y_', WATER_Y.toFixed(1)),
  });
  const sea = new THREE.Mesh(sg, seaMat); sea.frustumCulled = false; world.add(sea);

  // пісок
  const SN = lite || mobile ? 110 : 170, SR = 9000;
  const sandG = new THREE.PlaneGeometry(2, 2, SN, SN); sandG.rotateX(-Math.PI / 2);
  const ap = sandG.attributes.position, cols = new Float32Array(ap.count * 3), wetA = new Float32Array(ap.count);
  const dry = new THREE.Color('#E8D7C4'), wet = new THREE.Color('#B9A08A'), cc = new THREE.Color();
  for (let i = 0; i < ap.count; i++) {
    const u = ap.getX(i), v = ap.getZ(i); const x = Math.sign(u) * u * u * SR;
    const zz = v >= 0 ? v * v * SR : -v * v * 1200;
    const y = sandH(x, zz); ap.setXYZ(i, x, y, zz);
    const w = THREE.MathUtils.smoothstep(-zz, -80, 22); wetA[i] = w;
    cc.copy(dry).lerp(wet, w); cols[i * 3] = cc.r; cols[i * 3 + 1] = cc.g; cols[i * 3 + 2] = cc.b;
  }
  sandG.setAttribute('color', new THREE.BufferAttribute(cols, 3)); sandG.setAttribute('wet', new THREE.BufferAttribute(wetA, 1)); sandG.computeVertexNormals();
  const bump = sandBump(256); bump.repeat.set(1, 1);
  const sandMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, bumpMap: bump, bumpScale: 0.6 });
  sandMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float wet; varying float vWet; varying vec2 vSandUv;').replace('#include <uv_vertex>', '#include <uv_vertex>\nvWet = wet; vSandUv = position.xz / 140.0;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vWet; varying vec2 vSandUv;')
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(roughness, 0.3, vWet);')
      .replace('#include <bumpmap_pars_fragment>', THREE.ShaderChunk.bumpmap_pars_fragment.replace(/vBumpMapUv/g, 'vSandUv'));
  };
  // bumpMap використовує власний UV з позиції
  const sand = new THREE.Mesh(sandG, sandMat); sand.receiveShadow = true; world.add(sand);

  // туман-чанки над морем
  const mistMat = new THREE.ShaderMaterial({
    uniforms: { ...sky, uTime: { value: 0 }, uMist: { value: 1 }, uSeed: { value: 0 } }, transparent: true, depthWrite: false,
    vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: SKY_GLSL + `uniform float uTime, uMist, uSeed; varying vec2 vUv; varying vec3 vW;
      float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float a=0.5, s=0.0; for(int i=0;i<4;i++){ s+=a*vn(p); p*=2.03; a*=0.5; } return s; }
      void main(){ vec2 p = vUv*vec2(9.0,1.6) + vec2(uTime*0.012 + uSeed, 0.0);
        float n = fbm(p + vec2(sin(p.y*1.3 + uTime*0.02), cos(p.x*0.6 + uSeed))*0.45);
        float edge = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x) * smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.45, vUv.y);
        float a = smoothstep(0.38, 0.8, n) * edge * uMist * 0.55;
        vec3 d = normalize(vW - cameraPosition); vec3 c = skyCol(vec3(d.x, 0.02, d.z)) * 1.04;
        gl_FragColor = vec4(c, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mist = [];
  const MI = lite || mobile ? [[-2600, 120, 0.3]] : [[-2000, 100, 0.1], [-4600, 220, 1.3]];
  MI.forEach(([z, y, s]) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(9000, 520), mistMat.clone()); m.material.uniforms = { ...mistMat.uniforms, ...sky, uSeed: { value: s }, uTime: mistMat.uniforms.uTime, uMist: mistMat.uniforms.uMist }; m.position.set(0, y, z); m.renderOrder = 5; world.add(m); mist.push(m); });
  // sky.uniforms спільні для неба/моря/туману — тож один запис оновлює все
  return { world, sky, skyMesh, sea, seaU, sand, sandMat, mist, mistU: mistMat.uniforms };
}

/* ---------- промінь крізь проріз (клин світла до піску) + пилинки ---------- */
// світло падає з-за дверей згори: кожна точка прорізу (висота h) світить на пісок у z = 6 + (h + 11) / 183 * L
export function buildShaft({ mobile = false } = {}) {
  const L = 300, g = new THREE.BufferGeometry();
  // 6 вершин: двері низ/верх × x0/x1, пісок далеко × x0/x1; vT = 0 біля дверей → 1 на піску
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6 * 3), 3));
  g.setAttribute('vt', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 0, 1, 1]), 1));
  g.setIndex([2, 3, 5, 2, 5, 4, /* похила грань */ 0, 2, 4, /* бічна */ 1, 5, 3 /* бічна */]);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uOn: { value: 0 }, uCol: { value: new THREE.Color(C.dawn) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'attribute float vt; varying float vT; void main(){ vT = vt; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uOn; uniform vec3 uCol; varying float vT; void main(){ float a = uOn * pow(clamp(1.0 - vT, 0.0, 1.0), 1.4) * 0.34; gl_FragColor = vec4(uCol * a, a); }',
  });
  const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = 6;
  const N = mobile ? 140 : 360, R = rng(5), pa = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { pa[i * 3] = R(); pa[i * 3 + 1] = R(); pa[i * 3 + 2] = R(); }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pa, 3));
  const pmat = new THREE.ShaderMaterial({
    uniforms: { uOn: { value: 0 }, uTime: { value: 0 }, uX0: { value: 40 }, uX1: { value: 47 }, uL: { value: L }, uPix: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `uniform float uTime, uX0, uX1, uL, uPix; varying float vA;
      void main(){ vec3 r = position; float h = 4.0 + r.y * 168.0; float u = fract(r.z + uTime * 0.012 * (0.5 + r.x));
        vec3 p = vec3(mix(uX0, uX1, r.x), mix(h, -11.0, u), 6.0 + u * (h + 11.0) / 183.0 * uL);
        p += vec3(sin(uTime * 0.7 + r.y * 40.0), sin(uTime * 0.5 + r.z * 30.0), cos(uTime * 0.6 + r.x * 50.0)) * 3.0;
        vA = (1.0 - u) * smoothstep(0.0, 0.08, u) * (0.4 + 0.6 * fract(r.x * 13.7));
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = clamp(420.0 * uPix / max(-mv.z, 1.0), 1.5, 9.0); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uOn; varying float vA; void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); float a = smoothstep(0.5, 0.0, d) * vA * uOn; gl_FragColor = vec4(vec3(1.0, 0.86, 0.72) * a * 2.4, a); }`,
  });
  const dust = new THREE.Points(pg, pmat); dust.frustumCulled = false; dust.renderOrder = 7;
  const P = g.attributes.position;
  function update(x0, x1, on, dustOn, time, pix) {
    const set = (i, x, y, z) => P.setXYZ(i, x, y, z);
    const zf = 6 + (172 + 11) / 183 * L;
    set(0, x0, 1, 6); set(1, x1, 1, 6); set(2, x0, 172, 6); set(3, x1, 172, 6); set(4, x0 - 18, -11, zf); set(5, x1 + 18, -11, zf);
    P.needsUpdate = true; mat.uniforms.uOn.value = on; mesh.visible = on > 0.004;
    pmat.uniforms.uOn.value = dustOn; pmat.uniforms.uTime.value = time; pmat.uniforms.uX0.value = x0; pmat.uniforms.uX1.value = x1; pmat.uniforms.uPix.value = pix; dust.visible = dustOn > 0.004;
  }
  return { mesh, dust, update };
}
