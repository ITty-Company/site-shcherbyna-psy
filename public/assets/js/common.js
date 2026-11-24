// common.js — мова (UA / RU), шапка й меню, курсор «Промінь», шторка «Приплив», заголовки «Прочинення», Focus Reveal, reveal-и.
export const Q = new URLSearchParams(location.search);
export const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const FINE = matchMedia('(pointer: fine)').matches;
export const MOBILE = matchMedia('(max-width: 760px)').matches || (matchMedia('(pointer: coarse)').matches && innerWidth < 1024);
export const STILL = Q.has('p') || Q.has('still');
export const LANG = document.documentElement.lang === 'ru' ? 'ru' : 'uk';
const S = {
  uk: { open: 'відчинити', menu: 'Меню', close: 'Закрити', step: 'Крок', req: 'Заповніть це поле', mail: 'Перевірте e-mail', phone: 'Перевірте номер телефону', choose: 'Оберіть послугу', contact: 'Залиште e-mail або телефон', fmt: 'Оберіть формат' },
  ru: { open: 'открыть', menu: 'Меню', close: 'Закрыть', step: 'Шаг', req: 'Заполните это поле', mail: 'Проверьте e-mail', phone: 'Проверьте номер телефона', choose: 'Выберите услугу', contact: 'Оставьте e-mail или телефон', fmt: 'Выберите формат' },
};
export const t = (k) => S[LANG][k] || S.uk[k] || '';
export const ss = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch {} },
  del(k) { try { sessionStorage.removeItem(k); } catch {} },
};
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

/* ---------- «Прочинення»: рядок відкривається з вертикальної щілини ---------- */
export function opSet(h, on) {
  if (!h) return;
  if (REDUCED || STILL) { h.classList.add('in', 'now'); return; }
  h.style.setProperty('--hw', (h.offsetWidth / 2).toFixed(0) + 'px');
  h.classList.toggle('in', on);
}
/* ---------- Focus Reveal: площина фокуса пробігає по рядку ---------- */
export function frPrep(el) {
  if (el._fr) return; el._fr = true;
  const walk = (node) => [...node.childNodes].forEach((n) => {
    if (n.nodeType === 3) {
      const frag = document.createDocumentFragment();
      n.textContent.split(/(\s+)/).forEach((part) => { if (!part) return; if (/^\s+$/.test(part)) frag.appendChild(document.createTextNode(part)); else { const s = document.createElement('span'); s.className = 'fw'; s.textContent = part; frag.appendChild(s); } });
      n.replaceWith(frag);
    } else if (n.nodeType === 1) walk(n);
  });
  walk(el);
  const ws = el.querySelectorAll('.fw'); const n = ws.length;
  ws.forEach((w, i) => w.style.setProperty('--d', (i / Math.max(1, n - 1) * 1.6).toFixed(3) + 's'));
}
export function frSet(el, on) { frPrep(el); if (REDUCED || STILL) { el.classList.add('in', 'now'); return; } el.classList.toggle('in', on); }

function initReveal() {
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    const el = e.target;
    if (el.classList.contains('op')) opSet(el, e.isIntersecting);
    else if (el.classList.contains('fr')) frSet(el, e.isIntersecting);
    else if (e.isIntersecting) el.classList.add('in');
  }), { threshold: 0.25, rootMargin: '0px 0px -6% 0px' });
  document.querySelectorAll('.op, .fr, [data-rv]').forEach((el) => { if (!el.closest('.copy')) { if (el.classList.contains('fr')) frPrep(el); io.observe(el); } });
  if (REDUCED || STILL) document.querySelectorAll('[data-rv]').forEach((el) => el.classList.add('in'));
}

/* ---------- шапка + меню ---------- */
function initHeader() {
  const hd = document.querySelector('.hd'), btn = document.querySelector('.menu-btn'), menu = document.getElementById('menu');
  if (!hd) return;
  const solid = () => hd.classList.toggle('solid', scrollY > 30 && !document.body.classList.contains('is-index'));
  addEventListener('scroll', solid, { passive: true }); solid();
  const set = (open) => {
    btn.setAttribute('aria-expanded', String(open)); btn.querySelector('span').textContent = open ? t('close') : t('menu');
    document.body.classList.toggle('menu-open', open);
    if (open) { menu.hidden = false; requestAnimationFrame(() => menu.classList.add('on')); setTimeout(() => menu.querySelector('a')?.focus(), 60); }
    else { menu.classList.remove('on'); setTimeout(() => { if (!menu.classList.contains('on')) menu.hidden = true; }, REDUCED ? 0 : 560); }
  };
  btn.addEventListener('click', () => set(btn.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', (e) => { if (e.target.closest('a[href^="#"]')) set(false); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { set(false); btn.focus(); } });
}

/* ---------- курсор «Промінь» ---------- */
export const cursor = { x: -100, y: -100, mode: '', el: null };
function initCursor() {
  const el = document.querySelector('.cur'); if (!el || !FINE) return; cursor.el = el; document.documentElement.classList.add('has-cur');
  let x = -100, y = -100, rx = -100, ry = -100;
  addEventListener('pointermove', (e) => { x = e.clientX; y = e.clientY; cursor.x = x; cursor.y = y; el.classList.add('on'); }, { passive: true });
  document.addEventListener('pointerleave', () => el.classList.remove('on'));
  document.addEventListener('pointerover', (e) => { el.classList.toggle('link', !!e.target.closest('a,button,select,input,textarea,label')); });
  const dot = el.querySelector('.cur-dot'), ring = el.querySelector('.cur-ring'), tx = el.querySelector('.cur-t');
  tx.textContent = t('open');
  const loop = () => {
    rx += (x - rx) * 0.2; ry += (y - ry) * 0.2;
    dot.style.transform = `translate(${x}px,${y}px)`; ring.style.transform = `translate(${rx}px,${ry}px)`; tx.style.transform = `translate(${rx}px,${ry}px)`;
    const link = el.classList.contains('link');
    el.classList.toggle('door', cursor.mode === 'door' && !link); el.classList.toggle('water', cursor.mode === 'water' && !link);
    requestAnimationFrame(loop);
  };
  loop();
}

/* ---------- шторка «Приплив» ---------- */
function initTide() {
  const tide = document.querySelector('.tide'); if (!tide) return;
  const root = document.documentElement;
  if (root.classList.contains('tide-in')) {
    ss.del('shch-tide');
    if (REDUCED) root.classList.remove('tide-in');
    else requestAnimationFrame(() => setTimeout(() => { tide.classList.add('down'); root.classList.remove('tide-in'); setTimeout(() => tide.classList.remove('down'), 900); }, 80));
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a'); if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank' || a.hasAttribute('download')) return;
    const u = new URL(a.href, location.href);
    if (u.origin !== location.origin || (u.pathname === location.pathname && (u.hash || u.search === location.search))) return;
    if (!/(\.html|\/)$/.test(u.pathname)) return;
    e.preventDefault();
    if (REDUCED) { location.href = u.href; return; }
    tide.classList.remove('down'); tide.classList.add('up');
    setTimeout(() => { ss.set('shch-tide', '1'); location.href = u.href; }, 720);
  });
  addEventListener('pageshow', (e) => { if (e.persisted) tide.classList.remove('up', 'down'); });
}

/* ---------- магнітні кнопки (лише CTA) ---------- */
function initMagnets() {
  if (!FINE || REDUCED) return;
  document.querySelectorAll('.btn.primary').forEach((b) => {
    b.addEventListener('pointermove', (e) => { const r = b.getBoundingClientRect(); b.style.transform = `translate(${((e.clientX - r.left) / r.width - 0.5) * 6}px,${((e.clientY - r.top) / r.height - 0.5) * 5}px)`; });
    b.addEventListener('pointerleave', () => { b.style.transform = ''; });
  });
}

export function initCommon() {
  initHeader(); initCursor(); initTide(); initMagnets(); initReveal();
  const y = document.getElementById('year'); if (y) y.textContent = String(new Date().getFullYear());
}
