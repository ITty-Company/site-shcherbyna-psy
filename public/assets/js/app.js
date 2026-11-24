// app.js — головна: чесний прелоадер → щілина-розкриття → сцена «Двері на березі»; скрол = одна timeline pose(p);
// виноски на філенках, лічильник кроків, лінія-горизонт, магніти, ?demo=1, ?p=, ?pre=1.
import { initCommon, Q, REDUCED, MOBILE, STILL, cursor, ss, opSet, frSet, clamp, t } from './common.js';
import { pose, SEGS, MAGNETS, FOCUS, sss, segAt, seg } from './choreo.js';

initCommon();
const DEMO = Q.get('demo') === '1';
const PFIX = Q.has('p') ? clamp(parseFloat(Q.get('p')) || 0) : null;
const body = document.body, pre = document.getElementById('pre'), preN = document.getElementById('pre-n'), preLine = document.querySelector('.pre-line i');
const canvas = document.getElementById('stage'), spacer = document.getElementById('spacer'), after = document.querySelector('.after');
const panels = [...document.querySelectorAll('.copy .pnl')].map((el) => ({ el, a: +el.dataset.a, b: +el.dataset.b, ops: [...el.querySelectorAll('.op')], frs: [...el.querySelectorAll('.fr')], o: -1, dir: 0 }));
const stepEl = document.getElementById('step'), hzLine = document.querySelector('.hz i'), ticks = [...document.querySelectorAll('.ticks button')];
const cos = [...document.querySelectorAll('.co')].map((el) => ({ el, i: +el.dataset.i, o: 0 }));
const prices = [...document.querySelectorAll('.tariffs .tf')], rvTrack = document.querySelector('.rv-track'), sunDot = document.querySelector('.sunline i');
if (Q.has('clean')) { const s = document.createElement('style'); s.textContent = '.hd,.copy,.cur,.co-layer{display:none!important}'; document.head.appendChild(s); }

/* ---------- чесний прелоадер ---------- */
let actual = 0, shown = 0;
const add = (v) => { actual = Math.min(1, actual + v); };
const PRE = Q.get('pre') === '1';
const skipPre = !PRE && (REDUCED || PFIX != null || !!ss.get('shch-pre') || (location.hash && SEGS.some((s) => '#' + s.id === location.hash)));
let preDone = false, skipReq = false; const preT0 = performance.now();
if (skipPre) pre.classList.add('quick');
function preTick() {
  if (preDone) return;
  const dt = 1 / 30; // повільний кадр рухає лічильник максимум на 1/30 с
  shown += Math.min(actual - shown, dt * 1.6) * (actual - shown > 0 ? 1 : 0);
  preN.textContent = String(Math.round(shown * 100)).padStart(3, '0');
  if (preLine) preLine.style.transform = `scaleX(${shown.toFixed(4)})`;
  requestAnimationFrame(preTick);
}
if (!skipPre) preTick();
const askSkip = () => { if (performance.now() - preT0 > 1000) skipReq = true; };
addEventListener('wheel', askSkip, { passive: true }); addEventListener('touchstart', askSkip, { passive: true });
addEventListener('keydown', (e) => { if (e.code === 'Space') askSkip(); });
document.fonts.ready.then(() => add(0.10));

/* ---------- сцена ---------- */
let S = null;
const state = { p: PFIX ?? 0, target: PFIX ?? 0, demo: { t: 0, p: 0, done: false, duration: 0 } };
window.__demo = state.demo;
async function boot() {
  await new Promise((r) => requestAnimationFrame(() => r()));
  try {
    const mod = await import('./scene.js');
    S = await mod.createScene({ canvas, mode: 'full', mobile: MOBILE, still: STILL, qFixed: Q.get('q'), step: async (v) => { add(v); await new Promise((r) => setTimeout(r, 0)); } });
  } catch (err) {
    console.warn('3D недоступне:', err && err.message);
    document.querySelector('.nogl').hidden = false; canvas.hidden = true; document.documentElement.classList.add('no-gl'); actual = 1; finishPre(true); return;
  }
  S.st.reduced = REDUCED; window.__scene = S;
  S.st.reveal = skipPre ? 1 : 0;
  addEventListener('resize', () => S.resize());
  let good = 0; const t0 = performance.now(); let last = t0;
  await new Promise((res) => {
    const f = (now) => {
      const dt = now - last; last = now;
      S.frame(Math.min(dt / 1000, 1 / 30), pose(state.p));
      if (dt < 34) { good++; add(0.1 / 24); }
      if (good >= 24 || now - t0 > 4000 || skipPre) { actual = 1; res(); } else requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  });
  finishPre(false);
  requestAnimationFrame(loop);
}
let revealT = -1;
function finishPre(noGL) {
  const go = () => {
    preDone = true; preN.textContent = '100'; if (preLine) preLine.style.transform = 'scaleX(1)';
    body.classList.remove('is-locked'); ss.set('shch-pre', '1');
    if (PFIX != null) jumpTo(PFIX);
    else if (location.hash) { const s = SEGS.find((x) => '#' + x.id === location.hash); if (s) jumpTo(FOCUS[s.id]); }
    if (skipPre || noGL || !S) { pre.classList.add('out'); setTimeout(() => pre.remove(), 700); return; }
    document.documentElement.style.setProperty('--rv', '0'); pre.classList.add('slit');
    setTimeout(() => { pre.classList.add('gone'); revealT = performance.now(); }, skipReq ? 0 : 420);
    setTimeout(() => pre.remove(), 2400);
  };
  if (skipReq || skipPre || noGL) go(); else { const ch = () => (shown >= 0.999 || skipReq) ? go() : requestAnimationFrame(ch); ch(); }
}

/* ---------- скрол → p ---------- */
const range = () => Math.max(1, spacer.offsetHeight - innerHeight);
const scrollP = () => clamp(scrollY / range());
function jumpTo(p) { scrollTo({ top: p * range(), behavior: 'instant' }); state.target = state.p = p; }
let glide = null;
function glideTo(p) {
  const from = scrollY, to = p * range(), dist = Math.abs(p - scrollP());
  const dur = REDUCED ? 0.01 : 0.9 + 2.2 * dist; const t0 = performance.now();
  const ease = (x) => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
  glide = (now) => { const k = Math.min(1, (now - t0) / 1000 / dur); scrollTo({ top: from + (to - from) * ease(k), behavior: 'instant' }); if (k >= 1) glide = null; };
}
ticks.forEach((b) => b.addEventListener('click', () => glideTo(FOCUS[b.dataset.seg])));
document.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => { const id = a.getAttribute('href').slice(1); if (FOCUS[id] != null) { e.preventDefault(); glideTo(FOCUS[id]); } }));
let scrollTimer = 0;
addEventListener('scroll', () => {
  clearTimeout(scrollTimer);
  if (DEMO || STILL || REDUCED || glide) return;
  scrollTimer = setTimeout(() => {
    const p = scrollP(); if (p >= 0.999 || scrollY > range()) return;
    const m = MAGNETS.find((m) => Math.abs(m - p) < 0.02 && Math.abs(m - p) > 0.002);
    if (m != null) glideTo(m);
  }, 200);
}, { passive: true });
['wheel', 'touchstart', 'keydown'].forEach((ev) => addEventListener(ev, () => { glide = null; }, { passive: true }));

/* ---------- demo director (детермінований прогін) ---------- */
const DKEYS = [[0, 0], [3, 0], [6.5, 0.135], [9.5, 0.14], [13, 0.27], [16, 0.275], [19, 0.385], [21.5, 0.39], [26, 0.53], [28.5, 0.535], [31.5, 0.6], [33.5, 0.62], [40, 0.775], [42, 0.79], [47, 0.885], [51, 0.97], [54, 1]];
state.demo.duration = DKEYS.at(-1)[0] + 2.4;
function demoP(tt) { if (tt <= 0) return 0; for (let i = 1; i < DKEYS.length; i++) if (tt <= DKEYS[i][0]) { const a = DKEYS[i - 1], b = DKEYS[i]; return a[1] + (b[1] - a[1]) * sss((tt - a[0]) / (b[0] - a[0])); } return 1; }

/* ---------- UI від пози ---------- */
let curSeg = null, lastStep = -1, lastPrice = -2;
function updCallouts(P) {
  if (!S || MOBILE || innerWidth < 900) return;
  const o = clamp((P.p - 0.205) / 0.012) * clamp((0.305 - P.p) / 0.012);
  const pts = cos.map((c) => { const [x, y, vis] = S.projectPanel(c.i); return { c, x, y, vis }; });
  const maxX = Math.max(...pts.map((q) => q.x)), minX = Math.min(...pts.map((q) => q.x));
  const left = maxX + 80 + 270 > innerWidth; // немає місця праворуч → колонка ліворуч
  const lx = left ? minX - 80 : maxX + 80;
  // колонка виносок: рівний крок по вертикалі, без накладань
  const order = [...pts].sort((a, b) => a.y - b.y), gap = 104, mid = order.reduce((s, q) => s + q.y, 0) / order.length;
  order.forEach((q, k) => { q.by = mid + (k - (order.length - 1) / 2) * gap; });
  for (const q of pts) {
    const el = q.c.el, oo = q.vis ? o : 0;
    if (oo <= 0.001) { if (q.c.o !== 0) { el.style.opacity = 0; el.classList.remove('vis'); q.c.o = 0; } continue; }
    el.style.opacity = oo.toFixed(3); el.classList.add('vis'); q.c.o = oo;
    el.style.transform = `translate(${q.x.toFixed(1)}px,${q.y.toFixed(1)}px)`;
    el.classList.toggle('left', left);
    el.style.setProperty('--lead', Math.max(28, Math.abs(lx - q.x)).toFixed(0) + 'px');
    el.style.setProperty('--dy', (q.by - q.y).toFixed(1) + 'px');
  }
}
function updUI(P) {
  const p = P.p;
  for (const pn of panels) {
    const f = 0.012;
    const o = (pn.a < 0 ? 1 : clamp((p - pn.a + f * 0.5) / f)) * (pn.b > 1 ? 1 : clamp((pn.b + f * 0.5 - p) / f));
    if (Math.abs(o - pn.o) > 0.001) { pn.el.style.opacity = o.toFixed(3); pn.el.classList.toggle('vis', o > 0.01); pn.o = o; }
    const want = o > 0.6 ? 1 : o < 0.02 ? -1 : 0;
    if (want && want !== pn.dir && (S ? S.st.reveal > 0.6 : true)) { pn.dir = want; pn.ops.forEach((h) => opSet(h, want > 0)); pn.frs.forEach((h) => frSet(h, want > 0)); }
  }
  const s = segAt(p);
  if (s !== curSeg) {
    curSeg = s; const i = SEGS.indexOf(s);
    ticks.forEach((b, j) => b.classList.toggle('on', j === i));
    if (!STILL && !DEMO && S && S.st.reveal >= 1) history.replaceState(null, '', '#' + s.id);
  }
  if (P.step !== lastStep) { lastStep = P.step; stepEl.textContent = '0' + Math.max(1, P.step); stepEl.parentElement.classList.toggle('dim', P.step === 0); }
  hzLine.style.transform = `scaleX(${p.toFixed(4)})`;
  // ціни: картка світиться, коли сонце проходить її мітку
  const k = seg(p, 0.655, 0.775), act = p > 0.645 && p < 0.79 ? Math.min(4, Math.floor(k * 5)) : -1;
  if (act !== lastPrice) { lastPrice = act; prices.forEach((c, j) => c.classList.toggle('lit', j === act)); }
  if (sunDot) sunDot.style.transform = `translateX(${(k * 100).toFixed(2)}%)`;
  // стрічка відгуків їде зі скролом
  if (rvTrack) { const r = seg(p, 0.785, 0.895); const max = rvTrack.scrollWidth - rvTrack.parentElement.clientWidth; rvTrack.style.transform = `translate3d(${(-r * Math.max(0, max)).toFixed(1)}px,0,0)`; }
  updCallouts(P);
}

/* ---------- цикл ---------- */
let last = performance.now(), frames = 0, fpsT = last, idleT = 0, skip = false;
window.__fps = 0;
addEventListener('pointermove', (e) => {
  if (!S || e.pointerType === 'touch') return;
  const over = !e.target.closest('a,button,.hd,.after,.menu,.pnl .card,.rv') && scrollY < range() + 10;
  S.pointer(e.clientX, e.clientY, over);
  cursor.mode = over ? (S.st.cursor.overDoor ? 'door' : 'water') : '';
  if (cursor.mode === 'water' && !(e.clientY > innerHeight * 0.35)) cursor.mode = '';
  idleT = 0;
}, { passive: true });
document.addEventListener('pointerleave', () => { if (S) S.pointer(-9999, -9999, false); cursor.mode = ''; });
addEventListener('pointerdown', (e) => { if (S && e.pointerType === 'touch' && !e.target.closest('a,button')) S.tap(e.clientX, e.clientY); }, { passive: true });
const easeIO = (x) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  frames++; if (now - fpsT > 1000) { window.__fps = Math.round(frames * 1000 / (now - fpsT)); frames = 0; fpsT = now; }
  if (glide) glide(now);
  if (revealT > 0 && S) { const k = clamp((now - revealT) / 1500); S.st.reveal = easeIO(k); document.documentElement.style.setProperty('--rv', clamp(k * 1.6 - 0.35).toFixed(3)); if (k >= 1) revealT = -1; idleT = 0; }
  if (DEMO) {
    state.demo.t += dt;
    if (S && S.st.reveal >= 1) { const td = Math.max(0, state.demo.t - 2.2); state.target = demoP(td); state.demo.done = td >= DKEYS.at(-1)[0]; }
    state.p = state.target;
  } else if (PFIX != null) state.p = state.target = PFIX;
  else {
    state.target = scrollP();
    state.p += (state.target - state.p) * (1 - Math.exp(-5 * dt));
    if (Math.abs(state.target - state.p) < 1e-5) state.p = state.target;
  }
  state.demo.p = state.p;
  const P = pose(state.p);
  updUI(P);
  idleT += dt;
  const covered = after.getBoundingClientRect().top <= 0;
  const idle = !DEMO && !Q.has('bench') && idleT > 2 && Math.abs(state.target - state.p) < 1e-4 && revealT < 0;
  skip = idle ? !skip : false;
  if (S) S.st.idle = idle;
  if (S && !covered && !skip && !document.hidden) S.frame(idle ? dt * 2 : dt, P);
}
addEventListener('scroll', () => { idleT = 0; }, { passive: true });
boot();
