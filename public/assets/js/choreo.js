// choreo.js — хореографія «Двері на березі». Чисті функції від progress p (0..1): без DOM, без стану.
// pose(p) → кут стулки, кноб, розліт, світло, море, сонце, камера. Скрол назад = той самий кадр.
export const SEGS = [
  { id: 'dveri',    t0: 0.00, t1: 0.08, step: 0 },
  { id: 'prytcha',  t0: 0.08, t1: 0.18, step: 0 },
  { id: 'zapyt',    t0: 0.18, t1: 0.32, step: 1 },
  { id: 'znayomstvo', t0: 0.32, t1: 0.42, step: 2 },
  { id: 'sesii',    t0: 0.42, t1: 0.54, step: 3 },
  { id: 'opora',    t0: 0.54, t1: 0.64, step: 4 },
  { id: 'tsiny',    t0: 0.64, t1: 0.78, step: 4 },
  { id: 'vidguky',  t0: 0.78, t1: 0.90, step: 4 },
  { id: 'zapys',    t0: 0.90, t1: 1.00, step: 4 },
];
// точки покою (магніти): екрани 1, 3, 4, 5, 7, 9
export const MAGNETS = [0.0, 0.27, 0.385, 0.53, 0.71, 0.97];
export const FOCUS = { dveri: 0, prytcha: 0.135, zapyt: 0.27, znayomstvo: 0.385, sesii: 0.53, opora: 0.6, tsiny: 0.71, vidguky: 0.84, zapys: 0.97 };

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const seg = (p, a, b) => clamp((p - a) / (b - a));
export const ss = (x) => x * x * (3 - 2 * x);
export const sss = (x) => x * x * x * (x * (x * 6 - 15) + 10);
export const lerp = (a, b, t) => a + (b - a) * t;
const ramp = (p, a, b) => ss(seg(p, a, b));
const D = Math.PI / 180;

/* ---------- деталі дверей: розліт по Z (задні першими) ---------- */
// off: зсув [x,y,z] см при повному розльоті; d: затримка старту (0..1 від фази).
// Назад (−z) їдуть задні першими, вперед (+z) — передні першими: шари ніколи не проходять один крізь одного.
export const PARTS = [
  { id: 'glow',     off: [0, 0, -150], d: 0.00 },
  { id: 'frame',    off: [0, 0, -70],  d: 0.06 },
  { id: 'transom',  off: [0, 34, -30], d: 0.12 },
  { id: 'skeleton', off: [0, 0, 26],   d: 0.28 },
  { id: 'panels',   off: [0, 0, 78],   d: 0.20 },
  { id: 'hinges',   off: [-34, 0, 92], d: 0.14 },
  { id: 'handle',   off: [30, 0, 132], d: 0.08 },
  { id: 'sill',     off: [0, -16, 20], d: 0.36 },
];
export const PANEL_SPREAD = 1.22; // філенки розходяться у площині
export function explodeOf(id, E) {
  const part = PARTS.find((x) => x.id === id);
  return ss(clamp((E - part.d) / (1 - 0.4)));
}

/* ---------- камера: позиція Catmull-Rom, напрям — yaw/pitch (без перевертань) ---------- */
// [p, pos, target, fov]
const CAMK = [
  [0.000, [-150, 140, 640], [-150, 118, 0], 34],
  [0.045, [-142, 137, 618], [-142, 117, 0], 34],
  [0.120, [235, 126, 405], [-100, 110, 70], 32],
  [0.170, [255, 122, 385], [-92, 108, 70], 32],
  [0.235, [-300, 140, 380], [40, 108, 34], 36],
  [0.300, [-318, 144, 396], [38, 108, 32], 36],
  [0.355, [-262, 142, 560], [-62, 108, 0], 34],
  [0.410, [-214, 134, 470], [-40, 104, 0], 33],
  [0.450, [-30, 118, 300], [0, 110, -100], 38],
  [0.488, [0, 110, 40], [0, 104, -400], 44],
  [0.520, [0, 100, -360], [0, 92, -3000], 40],
  [0.545, [0, 96, -500], [0, 84, -3000], 38],
  [0.590, [210, 40, -380], [-70, 74, 0], 34],
  [0.628, [180, 30, -320], [-60, 70, 0], 33],
  [0.668, [-440, 150, -40], [0, 110, 0], 36],
  [0.695, [-330, 115, 470], [52, 190, -1700], 40],
  [0.765, [-305, 112, 452], [60, 186, -1700], 40],
  [0.810, [-250, 122, 330], [0, 112, 0], 34],
  [0.880, [-212, 118, 300], [12, 114, 0], 34],
  [0.950, [-120, 150, 760], [-120, 120, -800], 34],
  [1.000, [-112, 146, 740], [-112, 118, -800], 34],
];
function toAng(pos, tg) {
  const dx = tg[0] - pos[0], dy = tg[1] - pos[1], dz = tg[2] - pos[2];
  return [Math.atan2(dx, dz), Math.atan2(dy, Math.hypot(dx, dz))];
}
const CAM = (() => {
  let prevYaw = null;
  return CAMK.map(([p, pos, tg, fov]) => {
    let [yaw, pitch] = toAng(pos, tg);
    if (prevYaw != null) { while (yaw - prevYaw > Math.PI) yaw -= 2 * Math.PI; while (yaw - prevYaw < -Math.PI) yaw += 2 * Math.PI; }
    prevYaw = yaw;
    const dist = Math.hypot(tg[0] - pos[0], tg[1] - pos[1], tg[2] - pos[2]);
    return { p, pos, yaw, pitch, fov, dist };
  });
})();
const cr = (a, b, c, d, t) => { const t2 = t * t, t3 = t2 * t; return 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3); };
export function camera(p) {
  p = clamp(p);
  let i = 0; while (i < CAM.length - 2 && p > CAM[i + 1].p) i++;
  const a = CAM[Math.max(0, i - 1)], b = CAM[i], c = CAM[i + 1], d = CAM[Math.min(CAM.length - 1, i + 2)];
  const t = sss(clamp((p - b.p) / (c.p - b.p)));
  const pos = [0, 1, 2].map((j) => cr(a.pos[j], b.pos[j], c.pos[j], d.pos[j], t));
  const yaw = lerp(b.yaw, c.yaw, t), pitch = lerp(b.pitch, c.pitch, t);
  const dist = lerp(b.dist, c.dist, t);
  const dir = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
  return { pos, target: [pos[0] + dir[0] * dist, pos[1] + dir[1] * dist, pos[2] + dir[2] * dist], fov: lerp(b.fov, c.fov, t), yaw, pitch };
}

/* ---------- сонце: висота/азимут (град.), денне світло ---------- */
// азимут 0 = за дверима (−z, над морем), + = праворуч
function sunOf(p) {
  // світанок: нижче горизонту → піднімається до проходу крізь двері
  if (p < 0.64) {
    const el = lerp(0.6, 4, ramp(p, 0.06, 0.52)) + 3 * ramp(p, 0.52, 0.62);
    return { el, az: lerp(-6, -2, ramp(p, 0, 0.62)) };
  }
  if (p < 0.78) {
    // цикл: пік → спад → новий початок (дуга зліва направо, потім схід за дверима)
    const k = seg(p, 0.64, 0.78);
    if (k < 0.78) {
      const u = k / 0.78;
      return { el: 7 + 14 * Math.sin(Math.PI * ss(u)) - 9 * ss(clamp((u - 0.7) / 0.3)), az: lerp(-12, 22, ss(u)) };
    }
    const u = (k - 0.78) / 0.22;
    return { el: lerp(-2, 3, ss(u)), az: lerp(22, -4, ss(u)) };
  }
  // відгуки → фінал: сонце низько, у фіналі рівно в проймі дверей з боку глядача
  const u = ramp(p, 0.78, 0.95);
  return { el: lerp(3, 3.2, u), az: lerp(-4, 8.9, ramp(p, 0.9, 0.95)) };
}
export const sun = sunOf;

export function pose(p) {
  p = clamp(p);
  const E = ramp(p, 0.185, 0.25) * (1 - ramp(p, 0.30, 0.345));
  const knob = 40 * ramp(p, 0.335, 0.365) * (1 - ramp(p, 0.62, 0.66) * (1 - ramp(p, 0.9, 0.93)));
  const open = 25 * ramp(p, 0.355, 0.385)
    + 57 * ramp(p, 0.43, 0.47)                 // для прольоту — 82°
    - 60 * ramp(p, 0.56, 0.64)                 // з боку моря: прочинені ~22°
    + 58 * ramp(p, 0.89, 0.94) + 24 * ramp(p, 0.94, 0.995); // фінал — допрочиняється навстіж (104°)
  const slit = (0.35 + 0.65 * ramp(p, 0.03, 0.12)) * (1 - ramp(p, 0.44, 0.472)) + 0.12 * ramp(p, 0.9, 0.96);
  const beam = ramp(p, 0.08, 0.13) * 0.7 + ramp(p, 0.355, 0.39) * 0.9 - ramp(p, 0.47, 0.52) * 1.25 + ramp(p, 0.9, 0.96) * 0.4;
  const chop = p < 0.42 ? 2 : p < 0.54 ? lerp(2, 0.8, ramp(p, 0.42, 0.54)) : p < 0.64 ? lerp(0.8, 0.4, ramp(p, 0.54, 0.64))
    : p < 0.9 ? 0.4 + 0.12 * Math.sin(Math.PI * seg(p, 0.64, 0.78)) : lerp(0.4, 0.25, ramp(p, 0.9, 0.97));
  const s = sunOf(p);
  const day = clamp((s.el - 2) / 26);
  const warm = ramp(p, 0.55, 0.62) * (1 - 0.6 * ramp(p, 0.66, 0.7)) + 0.6 * ramp(p, 0.92, 0.99);
  const mist = 1 - 0.75 * ramp(p, 0.42, 0.56) - 0.25 * ramp(p, 0.9, 0.97);
  const rays = 0.3 * ramp(p, 0.03, 0.1) * (1 - ramp(p, 0.18, 0.23)) + 0.45 * ramp(p, 0.355, 0.39) * (1 - ramp(p, 0.47, 0.5))
    + 0.3 * ramp(p, 0.66, 0.7) * (1 - ramp(p, 0.76, 0.79)) + 0.3 * ramp(p, 0.92, 0.97);
  const breathe = 1 - ramp(p, 0.06, 0.1);   // «дихання» дверей лише в hero
  const flood = 0.6 * ramp(p, 0.93, 1);
  const path = 16000 * ramp(p, 0.88, 0.905) * (1 - ramp(p, 0.905, 0.99)); // фронт сонячної доріжки: біжить по воді до глядача
  const dust = ramp(p, 0.17, 0.215) * (1 - ramp(p, 0.445, 0.475)); // пилинки в промені між кроками            // тепла хвиля світла у фіналі
  const stepN = p < 0.18 ? 0 : p < 0.32 ? 1 : p < 0.42 ? 2 : p < 0.54 ? 3 : 4;
  return {
    p, E, knob, open: clamp(open, 0, 110), slit: clamp(slit), beam: clamp(beam, 0, 1.2), chop, sunEl: s.el, sunAz: s.az, day, warm, mist: clamp(mist),
    rays: clamp(rays), dust, path, breathe, flood, step: stepN, cam: camera(p),
  };
}
export const segAt = (p) => SEGS.find((s) => p < s.t1) || SEGS[SEGS.length - 1];
