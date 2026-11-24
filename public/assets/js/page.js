// page.js — внутрішні сторінки: облегшена сцена тих самих дверей (mode 'lite'), своя поза для кожної сторінки,
// короткий скраб у hero; «Запити» — філенка висувається під активною групою; «Запис» — двері прочиняються з кожним полем.
import { initCommon, Q, REDUCED, MOBILE, STILL, cursor, t, clamp, LANG } from './common.js';
import { pose, ss as smooth, lerp } from './choreo.js';
initCommon();
const page = document.body.dataset.page;
const canvas = document.querySelector('.stage-lite');
const scrub = document.querySelector('[data-scrub]');
const scrubP = () => { if (!scrub) return 0; const r = scrub.getBoundingClientRect(); const h = scrub.offsetHeight - innerHeight; return h > 0 ? clamp(-r.top / h) : 0; };
const cam = (pos, target, fov = 34) => ({ pos, target, fov });
const mixCam = (a, b, k) => cam(a.pos.map((v, i) => lerp(v, b.pos[i], k)), a.target.map((v, i) => lerp(v, b.target[i], k)), lerp(a.fov, b.fov, k));

/* ---------- запити: активна група → філенка ---------- */
const groups = [...document.querySelectorAll('[data-panel]')];
let activePanel = -1, hoverPanel = -1;
if (groups.length) {
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { activePanel = +e.target.dataset.panel; groups.forEach((g) => g.classList.toggle('on', +g.dataset.panel === activePanel)); } }), { rootMargin: '-45% 0px -45% 0px' });
  groups.forEach((g) => { io.observe(g); g.addEventListener('pointerenter', () => { hoverPanel = +g.dataset.panel; }); g.addEventListener('pointerleave', () => { hoverPanel = -1; }); });
}

/* ---------- форма запису (ДЕМО: нічого не надсилається) ---------- */
const FORM = { open: 12, target: 12, done: 0 };
function initForm() {
  const form = document.getElementById('zapys-form'); if (!form) return;
  const sum = document.getElementById('sum'), sumTxt = document.getElementById('sum-txt'), priceEl = document.getElementById('f-price');
  const el = form.elements;
  const pre = Q.get('s'); if (pre && el.service.querySelector(`option[value="${pre}"]`)) el.service.value = pre;
  const PR = JSON.parse(document.getElementById('prices-json').textContent);
  const reMail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, rePhone = /^\+?[0-9 ()-]{8,18}$/;
  const checks = {
    name: () => el.name.value.trim().length >= 2 || t('req'),
    email: () => { const v = el.email.value.trim(); if (!v) return el.phone.value.trim() ? true : t('contact'); return reMail.test(v) || t('mail'); },
    phone: () => { const v = el.phone.value.trim(); if (!v) return el.email.value.trim() ? true : t('contact'); return rePhone.test(v) || t('phone'); },
    service: () => !!el.service.value || t('choose'),
    format: () => !!form.querySelector('[name=format]:checked') || t('fmt'),
  };
  const fieldOf = (k) => form.querySelector(`[data-f="${k}"]`);
  const show = (k, res) => { const f = fieldOf(k); if (!f) return; const bad = res !== true; f.classList.toggle('bad', bad); f.querySelector('.err').textContent = bad ? res : ''; };
  const score = () => Object.values(checks).filter((c) => c() === true).length;
  const upd = () => {
    FORM.target = 12 + score() * 13;
    const s = el.service.value, f = form.querySelector('[name=format]:checked')?.value;
    const row = PR[s];
    if (row && f) priceEl.textContent = row[f] || row.none; else if (row) priceEl.textContent = row.hint; else priceEl.textContent = '';
  };
  form.addEventListener('input', (e) => { const k = e.target.closest('[data-f]')?.dataset.f; if (k && fieldOf(k).classList.contains('bad')) show(k, checks[k]()); if (k === 'email' || k === 'phone') { if (fieldOf('email').classList.contains('bad')) show('email', checks.email()); if (fieldOf('phone').classList.contains('bad')) show('phone', checks.phone()); } upd(); });
  form.addEventListener('change', upd);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let first = null;
    for (const k in checks) { const r = checks[k](); show(k, r); if (r !== true && !first) first = fieldOf(k).querySelector('input,select'); }
    if (first) { first.focus(); return; }
    const f = form.querySelector('[name=format]:checked').value;
    const lines = [`${form.querySelector('[data-f=name] label').textContent}: ${el.name.value.trim()}`, `${form.querySelector('[data-f=service] label').textContent}: ${el.service.selectedOptions[0].textContent}`, `${form.querySelector('[data-f=format] legend').textContent}: ${f === 'online' ? 'Online' : 'Offline · València'}`];
    if (el.email.value.trim()) lines.push(`E-mail: ${el.email.value.trim()}`);
    if (el.phone.value.trim()) lines.push(`${form.querySelector('[data-f=phone] label').textContent}: ${el.phone.value.trim()}`);
    sumTxt.textContent = lines.join('\n');
    const msg = encodeURIComponent(lines.join('\n'));
    const wa = `https://wa.me/380671193211?text=${msg}`, mail = `mailto:shcherbyna.psy@hotmail.com?subject=${encodeURIComponent(el.service.selectedOptions[0].textContent)}&body=${msg}`;
    document.getElementById('sum-wa').href = wa; document.getElementById('sum-mail').href = mail;
    // без сервера: відкриваємо обраний канал із готовим текстом заявки
    if ((e.submitter && e.submitter.value) === 'mail') location.href = mail; else window.open(wa, '_blank', 'noopener');
    form.hidden = true; sum.hidden = false; sum.focus(); FORM.target = 104; FORM.done = 1;
  });
  document.getElementById('sum-edit').addEventListener('click', () => { sum.hidden = true; form.hidden = false; FORM.done = 0; upd(); el.name.focus(); });
  upd();
}
initForm();

/* ---------- пози сторінок ---------- */
const CFG = {
  'pro-mene': (lp, time) => {
    const P = pose(0.02); const k = smooth(lp);
    P.knob = 40 * k; P.open = 14 * smooth(clamp((lp - 0.35) / 0.65)); P.slit = 0.45 + 0.5 * k; P.beam = 0.5 * k; P.rays = 0; P.breathe = 0.4;
    P.sunEl = -3 + 5 * k; P.sunAz = -4; P.day = 0; P.mist = 0.8;
    P.cam = mixCam(cam([96, 112, 86], [8, 98, -4], 30), cam([170, 128, 220], [-14, 104, 0], 32), k);
    return P;
  },
  zapyty: (lp, time) => {
    const P = pose(0.03); P.breathe = 0.3; P.slit = 0.7; P.beam = 0.3; P.rays = 0; P.sunEl = -2; P.sunAz = -4;
    const act = hoverPanel >= 0 ? hoverPanel : activePanel;
    P.pop = [0, 1, 2, 3, 4, 5].map((i) => (i === act ? 1 : 0)); P.heat = P.pop;
    P.cam = cam([60 + Math.sin(time * 0.2) * 8, 104, 300], [4, 92, 0], 34);
    return P;
  },
  formaty: (lp, time) => {
    const P = pose(0.672 + 0.1 * lp); P.rays = 0; P.open = 22 + 20 * smooth(lp); P.slit = 0; P.beam = 0;
    P.cam = mixCam(cam([-300, 108, 430], [250, 186, -1700], 40), cam([-250, 96, 330], [230, 150, -1700], 38), smooth(lp));
    return P;
  },
  vidguky: (lp, time) => {
    const P = pose(0.8 + 0.08 * lp); P.rays = 0; P.chop = 0.32;
    P.cam = mixCam(cam([-320, 96, -600], [-20, 112, 0], 34), cam([-170, 104, -430], [10, 114, 0], 34), smooth(lp));
    return P;
  },
  zapys: (lp, time) => {
    const P = pose(0.39); FORM.open += (FORM.target - FORM.open) * 0.06;
    P.open = FORM.open; P.knob = 40; P.slit = 0.7 + 0.3 * FORM.done; P.beam = 0.9 + 0.2 * FORM.done; P.rays = 0; P.flood = FORM.done * 0.8; P.warm = 0.3 + 0.5 * FORM.done; P.breathe = 0;
    P.cam = cam([-250, 142, 560], [-20, 104, 0], 34);
    if (FORM.done) { P.sunEl = lerp(P.sunEl, 3.2, 0.9); }
    return P;
  },
  '404': (lp, time) => {
    const P = pose(0.0); P.slit = 0; P.beam = 0; P.rays = 0; P.sunEl = -4; P.sunAz = 30; P.mist = 1; P.breathe = 0.2;
    P.cam = cam([430 + Math.sin(time * 0.12) * 20, 122, 150], [0, 104, -80], 34);
    return P;
  },
};

/* ---------- сцена ---------- */
async function boot() {
  if (!canvas) return;
  let S;
  try {
    const m = await import('./scene.js');
    S = await m.createScene({ canvas, mode: 'lite', mobile: MOBILE, still: STILL, qFixed: Q.get('q') });
  } catch (err) {
    console.warn('3D недоступне:', err && err.message);
    canvas.hidden = true; document.documentElement.classList.add('no-gl'); document.querySelector('.nogl')?.removeAttribute('hidden'); return;
  }
  S.st.reduced = REDUCED; window.__scene = S;
  const cfg = CFG[page] || CFG['404'];
  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);
  addEventListener('resize', () => S.resize());
  const host = canvas.closest('.stage-host') || canvas.parentElement;
  host.addEventListener('pointermove', (e) => { if (e.pointerType === 'touch') return; const over = !e.target.closest('a,button,input,select,label,.hero-copy,.card'); S.pointer(e.clientX, e.clientY, over); cursor.mode = over ? (S.st.cursor.overDoor ? 'door' : '') : ''; });
  host.addEventListener('pointerleave', () => { S.pointer(-9999, -9999, false); cursor.mode = ''; });
  host.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch' && !e.target.closest('a,button,input,select,label')) S.tap(e.clientX, e.clientY); });
  let last = performance.now(), lp = scrubP(), time = 0, frames = 0, fpsT = last; window.__fps = 0;
  S.st.reveal = 1;
  const loop = (now) => {
    requestAnimationFrame(loop);
    const dt = Math.min(0.1, (now - last) / 1000); last = now; time += dt;
    frames++; if (now - fpsT > 1000) { window.__fps = Math.round(frames * 1000 / (now - fpsT)); frames = 0; fpsT = now; }
    lp += (scrubP() - lp) * (STILL ? 1 : 1 - Math.exp(-5 * dt));
    if (!visible || document.hidden) return;
    S.frame(dt, cfg(lp, STILL ? 0 : time));
  };
  requestAnimationFrame(loop);
}
boot();
