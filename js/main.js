(() => {
  const root = document.documentElement;
  root.classList.add('js');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const gsap = window.gsap, ST = window.ScrollTrigger;
  const motion = !reduce && !!gsap && !!ST;
  if (gsap && ST) gsap.registerPlugin(ST);
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const hooks = {};

  /* ---------- Tokens de mouvement (miroir des variables CSS) ---------- */
  const bez = (a, b, c, d) => {
    const cx = 3 * a, bx = 3 * (c - a) - cx, ax = 1 - cx - bx, cy = 3 * b, by = 3 * (d - b) - cy, ay = 1 - cy - by;
    const X = t => ((ax * t + bx) * t + cx) * t, Y = t => ((ay * t + by) * t + cy) * t;
    return x => {
      if (x <= 0) return 0; if (x >= 1) return 1;
      let lo = 0, hi = 1, t = x;
      for (let i = 0; i < 24; i++) { const v = X(t); if (Math.abs(v - x) < 1e-4) break; v < x ? lo = t : hi = t; t = (lo + hi) / 2; }
      return Y(t);
    };
  };
  const E = { out: bez(.23, 1, .32, 1), io: bez(.77, 0, .175, 1) };   /* = --ease-out / --ease-in-out */
  const D = { micro: .12, short: .2, med: .35, long: .6 };              /* = --dur-* */

  /* ---------- Luminance / contraste AA ---------- */
  const lin = c => { c /= 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; };
  const lum = hex => {
    const n = parseInt(hex.slice(1), 16);
    return .2126 * lin(n >> 16) + .7152 * lin((n >> 8) & 255) + .0722 * lin(n & 255);
  };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };
  const INK = '#17171A', PAPER = '#ECE9E2', INK_MUTE = '#3A3A40', PAPER_MUTE = '#B9B5AD';
  let current = null;
  const hero = $('#hero');
  function setBg(hex, isHero) {
    root.style.setProperty('--tint', isHero ? '.45' : '.84');
    if (hex === current) return;
    const prev = current;
    current = hex;
    const light = ratio(hex, PAPER) < ratio(hex, INK);
    root.style.setProperty('--page-bg', hex);
    root.style.setProperty('--page-fg', light ? INK : PAPER);
    root.style.setProperty('--page-fg-mute', light ? INK_MUTE : PAPER_MUTE);
    root.dataset.tone = light ? 'light' : 'dark';
    if (prev && hooks.flash) hooks.flash();
  }
  window.__setBg = setBg;

  /* Fond selon bloc visible */
  const blocks = $$('[data-bg]').filter(el => el.tagName !== 'INPUT');
  const visible = new Set();
  const pick = () => {
    const mid = innerHeight / 2;
    let best = null, bestD = Infinity;
    visible.forEach(el => {
      const r = el.getBoundingClientRect();
      const d = mid >= r.top && mid <= r.bottom ? 0 : Math.min(Math.abs(r.top - mid), Math.abs(r.bottom - mid));
      if (d < bestD) { bestD = d; best = el; }
    });
    if (best) setBg(best.dataset.bg, best === hero);
  };
  const io = new IntersectionObserver(es => {
    es.forEach(e => e.isIntersecting ? visible.add(e.target) : visible.delete(e.target));
    pick();
  }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
  blocks.forEach(b => io.observe(b));
  setBg('#121214', true);

  /* ---------- Galeries ---------- */
  const photos = g => { const s = $$('.color-strip', g).find(x => !x.hidden); return s ? $$('.thumb', s) : []; };
  const setCurrent = (g, t) => { $$('.thumb', g).forEach(o => o.removeAttribute('aria-current')); t.setAttribute('aria-current', 'true'); };
  $$('.gallery').forEach(g => {
    const main = $('.gallery__main img', g);
    $$('.thumb', g).forEach(t => t.addEventListener('click', () => {
      setCurrent(g, t);
      if (hooks.swap && hooks.swap(g, t)) return;
      main.style.opacity = 0;
      const img = new Image();
      img.onload = () => { main.src = t.dataset.full; main.alt = t.dataset.alt; main.style.opacity = 1; };
      img.src = t.dataset.full;
    }));
  });

  /* Swipe tactile : glisser le doigt sur la photo = photo suivante/précédente (réutilise le clic sur les miniatures) */
  $$('.gallery').forEach(g => {
    const fm = $('.gallery__main', g); if (!fm) return;
    let x0 = 0, y0 = 0, t0 = 0, on = false;
    fm.addEventListener('touchstart', e => {
      if (e.touches.length !== 1) { on = false; return; }
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; t0 = Date.now(); on = true;
    }, { passive: true });
    fm.addEventListener('touchend', e => {
      if (!on) return; on = false;
      const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
      if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.3 || Date.now() - t0 > 700) return;
      const list = photos(g); if (list.length < 2) return;
      const i = Math.max(0, list.findIndex(o => o.getAttribute('aria-current') === 'true'));
      const n = list[(i + (dx < 0 ? 1 : list.length - 1)) % list.length];
      n.click();
      n.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    }, { passive: true });
  });

  /* Produits : coloris en pastilles (changent la photo, la planche, le fond et l'accent de la section) */
  $$('[data-product]').forEach(sec => {
    const name = $('.swatch-name', sec);
    const c0 = $('.swatch input:checked', sec);
    if (c0 && c0.dataset.accent) sec.style.setProperty('--sec-accent', c0.dataset.accent);
    $$('.swatch input', sec).forEach(r => r.addEventListener('change', () => {
      const apply = () => {
        sec.dataset.bg = r.dataset.bg;
        if (r.dataset.accent) sec.style.setProperty('--sec-accent', r.dataset.accent);
        setBg(r.dataset.bg, false);
        if (name) name.textContent = r.dataset.label;
        $$('.color-strip', sec).forEach(s => { s.hidden = s.dataset.color !== r.value; });
        const first = $(`.color-strip[data-color="${r.value}"] .thumb`, sec);
        hooks.silent = true; if (first) first.click(); hooks.silent = false;
        $$('.gallery__main', sec).forEach(f => f._upd && f._upd());
      };
      if (hooks.color) hooks.color(sec, r, apply); else apply();
    }));
  });

  /* ---------- Lenis ---------- */
  let lenis = null;
  if (motion && window.Lenis) {
    lenis = new Lenis({ lerp: .1, smoothWheel: true });
    lenis.on('scroll', ST.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
      const t = a.getAttribute('href') === '#' ? null : $(a.getAttribute('href'));
      if (!t) return;
      e.preventDefault();
      lenis.scrollTo(t, { offset: t.id === 'hero' ? 0 : -56, duration: 1.4 });
    }));
  }

  /* ---------- Lightbox ---------- */
  const lb = $('#lb'), lbi = $('img', lb);
  const close = () => { lb.hidden = true; lenis && lenis.start(); };
  $$('.look-track img').forEach(i => i.addEventListener('click', () => { lbi.src = i.src; lbi.alt = i.alt; lb.hidden = false; lenis && lenis.stop(); $('button', lb).focus(); }));
  lb.addEventListener('click', close);
  addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  /* ---------- Cadre HUD sur les photos (décor + compteur) ---------- */
  const uniform = document.body.classList.contains('uniform');
  const frames = $$('.gallery__main');
  if (uniform) frames.push(...$$('.cag__grid figure'));
  frames.forEach(f => {
    const hud = document.createElement('div'); hud.className = 'hud'; hud.setAttribute('aria-hidden', 'true');
    const cap = document.createElement('b'); hud.appendChild(cap); f.appendChild(hud);
    const g = f.closest('.gallery');
    const pad = n => String(n).padStart(2, '0');
    const upd = () => {
      if (g) {
        const th = photos(g);
        const i = th.findIndex(t => t.getAttribute('aria-current') === 'true');
        cap.textContent = th.length ? `IMG ${pad(i + 1)} / ${pad(th.length)}` : '';
      } else {
        const sibs = $$('figure', f.parentNode);
        cap.textContent = `IMG ${pad(sibs.indexOf(f) + 1)} / ${pad(sibs.length)}`;
      }
    };
    f._upd = upd; upd();
    if (g) g.addEventListener('click', e => { if (e.target.closest('.thumb')) setTimeout(upd, 0); });
  });

  /* ---------- Animations ---------- */
  const pre = $('.preloader');
  const killPre = () => { pre && pre.remove(); };
  if (!motion) { killPre(); return; }
  root.classList.add('fx');
  const small = innerWidth < 768;

  /* ambiance : n'anime que ce qui est à l'écran ; cadre HUD armé à la première vue */
  const live = new IntersectionObserver(es => es.forEach(e => {
    e.target.classList.toggle('is-live', e.isIntersecting);
    if (e.isIntersecting && e.target.querySelector(':scope > .hud')) e.target.classList.add('hud-on');
  }), { threshold: .25 });
  $$('.hero, .gallery__main, .cag__grid figure').forEach(el => live.observe(el));

  /* ===== Structure des cadres : fond décalé / photo (2 calques) / grade / HUD ===== */
  const stages = new Map();
  const HIDE = 'inset(100% 0 0 0)';

  function makeStage(inn, A) {
    const B = A.cloneNode(false);
    B.className = 'xf'; B.removeAttribute('id'); B.alt = ''; B.setAttribute('aria-hidden', 'true'); B.loading = 'eager';
    inn.appendChild(B);
    A.dataset.k = B.dataset.k = A.getAttribute('src'); A._alt = A.alt;
    let under = A, over = B, tw = null, tok = 0;
    const o = { f: 0 };
    const put = (el, t) => { el.src = t.dataset.full; el.dataset.k = t.dataset.full; el._alt = t.dataset.alt; };
    const roles = () => {
      under.style.zIndex = 1; over.style.zIndex = 2;
      under.alt = under._alt || ''; over.alt = '';
      under.removeAttribute('aria-hidden'); over.setAttribute('aria-hidden', 'true');
    };
    const clip = f => { over.style.clipPath = f <= 0 ? HIDE : `inset(${(1 - f) * 100}% 0 0 0)`; };
    const swapRoles = () => { const t = under; under = over; over = t; };
    over.style.clipPath = HIDE; roles();
    const finish = () => { tok++; if (tw) { tw.progress(1); tw = null; } };
    return {
      set(t) { finish(); put(under, t); clip(0); roles(); },
      pair(a, b, f) {
        if (tw) finish();
        if (under.dataset.k !== a.dataset.full) { if (over.dataset.k === a.dataset.full) swapRoles(); else put(under, a); }
        if (over.dataset.k !== b.dataset.full) put(over, b);
        roles(); clip(f);
      },
      go(t) {
        finish();
        if (under.dataset.k === t.dataset.full) return;
        put(over, t); roles(); clip(0);
        const my = ++tok;
        const run = () => {
          if (my !== tok) return;
          o.f = 0;
          tw = gsap.to(o, { f: 1, duration: D.long, ease: E.out, onUpdate: () => clip(o.f),
            onComplete: () => { swapRoles(); clip(0); roles(); tw = null; } });
        };
        (over.decode ? over.decode() : Promise.resolve()).then(run, run);
      }
    };
  }

  const mkEl = (tag, cls) => { const e = document.createElement(tag); e.className = cls; e.setAttribute('aria-hidden', 'true'); return e; };
  $$('.gallery__main, .cag__grid figure').forEach(f => {
    const A = $('img', f); if (!A) return;
    f.classList.add('is-pf');
    const pf = document.createElement('div'); pf.className = 'pf';
    const inn = document.createElement('div'); inn.className = 'pf-in';
    inn.appendChild(A); pf.appendChild(inn);
    const hud = $(':scope > .hud', f);
    f.insertBefore(pf, hud || null);
    f.insertBefore(mkEl('i', 'pf-back'), f.firstChild);
    const g = f.closest('.gallery');
    if (g) { pf.appendChild(mkEl('i', 'cwipe')); stages.set(g, makeStage(inn, A)); }
  });
  /* préchargement des vues d'une galerie quand elle approche */
  stages.forEach((_, g) => {
    const pio = new IntersectionObserver(es => {
      if (!es[0].isIntersecting) return;
      pio.disconnect();
      $$('.thumb', g).forEach(t => { const im = new Image(); im.src = t.dataset.full; });
    }, { rootMargin: '900px 0px' });
    pio.observe(g);
  });

  /* ===== Sections épinglées : le scroll feuillette les photos (desktop) ===== */
  const toY = (y, immediate) => {
    if (lenis) lenis.scrollTo(y, { immediate: !!immediate, duration: .9, easing: E.io });
    else scrollTo({ top: y, behavior: immediate ? 'instant' : 'smooth' });
  };
  const mm = gsap.matchMedia();
  mm.add('(min-width: 1024px) and (min-height: 680px)', () => {
    $$('[data-product]').forEach(sec => {
      const g = $('.gallery', sec), st = stages.get(g), fm = $('.gallery__main', g);
      if (!st) return;
      const maxN = Math.max(...$$('.color-strip', g).map(s => s.children.length));
      if (maxN < 2) return;
      sec.classList.add('is-pinned');
      sec._pin = ST.create({
        trigger: sec, start: 'top top', end: () => '+=' + Math.round((maxN - 1) * innerHeight * .55),
        pin: true, anticipatePin: 1, invalidateOnRefresh: true,
        onUpdate: self => {
          const list = photos(g), n = list.length;
          if (n < 2) return;
          const pos = Math.min(1, Math.max(0, self.progress)) * (n - 1);
          const i = Math.min(n - 2, Math.floor(pos)), f = pos - i;
          st.pair(list[i], list[i + 1], f);
          const t = list[f > .5 ? i + 1 : i];
          if (t.getAttribute('aria-current') !== 'true') { setCurrent(g, t); fm._upd && fm._upd(); }
        }
      });
    });
    return () => { $$('[data-product]').forEach(s => { s.classList.remove('is-pinned'); s._pin = null; }); };
  });

  /* clic miniature : dans la zone épinglée on défile jusqu'à la photo, sinon fondu en volet */
  hooks.swap = (g, t) => {
    const st = stages.get(g); if (!st) return false;
    const sec = g.closest('[data-product]'), pin = sec && sec._pin;
    const list = photos(g), i = list.indexOf(t);
    if (pin) {
      const y = scrollY, inR = y >= pin.start - 4 && y <= pin.end + 4;
      if (inR) {
        const target = pin.start + (list.length > 1 ? i / (list.length - 1) : 0) * (pin.end - pin.start);
        if (hooks.silent) { toY(target, true); st.set(t); } else toY(target);
        return true;
      }
    }
    if (hooks.silent) st.set(t); else st.go(t);
    return true;
  };

  /* changement de coloris : rideau de la couleur + glitch bref, le fond suit */
  let cTl = null, cPend = null;
  hooks.color = (sec, r, apply) => {
    const f = $('.gallery__main', sec), cw = f && $('.cwipe', f), pf = f && $('.pf', f);
    if (cTl) { cTl.kill(); if (cPend) { cPend(); cPend = null; } if (cw) gsap.set(cw, { scaleX: 0 }); }
    if (!cw) { apply(); return; }
    cw.style.background = r.dataset.accent || 'var(--accent)';
    cPend = apply;
    cTl = gsap.timeline({ onComplete: () => { cTl = null; } })
      .set(cw, { transformOrigin: '0 50%' })
      .fromTo(cw, { scaleX: 0 }, { scaleX: 1, duration: D.med * .8, ease: E.io })
      .add(() => {
        const a = cPend; cPend = null; a && a();
        pf.classList.remove('glitch'); void pf.offsetWidth; pf.classList.add('glitch');
      })
      .set(cw, { transformOrigin: '100% 50%' })
      .to(cw, { scaleX: 0, duration: D.med * 1.3, ease: E.out }, '+=.04');
  };

  /* grain bref à chaque changement de fond */
  const nz = document.createElement('div'); nz.className = 'noise'; nz.setAttribute('aria-hidden', 'true'); document.body.appendChild(nz);
  hooks.flash = () => { nz.classList.remove('on'); void nz.offsetWidth; nz.classList.add('on'); };
  nz.addEventListener('animationend', () => nz.classList.remove('on'));

  /* ===== Scroll global : fond photo, progression, hero, globe, indicateur de section ===== */
  const bgImg = $('.bgfx__img');
  gsap.fromTo(bgImg, { yPercent: 0, scale: 1 }, { yPercent: -5, scale: small ? 1.06 : 1.14, ease: 'none',
    scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: .8 } });
  gsap.to('.progress i', { scaleX: 1, ease: 'none', scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: .3 } });
  gsap.to('.hero__in', { y: -64, opacity: 0, ease: 'none', scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom 35%', scrub: true } });
  gsap.to('.globe--hero', { yPercent: -35, ease: 'none', scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true } });

  /* indicateur de section HUD (01 / 03), desktop et tablette */
  const secs = $$('.color-block');
  const nav = document.createElement('div'); nav.className = 'secnav'; nav.setAttribute('aria-hidden', 'true');
  nav.innerHTML = secs.map((s, i) => `<span class="secnav__i"><b>${String(i + 1).padStart(2, '0')}</b><i><u></u></i></span>`).join('');
  document.body.appendChild(nav);
  const items = $$('.secnav__i', nav), fills = $$('u', nav);
  const gs = window.__gs || (window.__gs = { spin: 0 });
  let lastY = scrollY;
  const drawNav = () => {
    const mid = innerHeight * .5;
    let any = false;
    secs.forEach((s, i) => {
      const el = s.parentElement.classList.contains('pin-spacer') ? s.parentElement : s;
      const r = el.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (mid - r.top) / r.height));
      const on = r.top < mid && r.bottom > mid;
      fills[i].style.transform = `scaleY(${p.toFixed(3)})`;
      items[i].classList.toggle('on', on);
      any = any || on;
    });
    nav.classList.toggle('show', any);
  };
  ST.create({ start: 0, end: () => ST.maxScroll(window), onUpdate: self => {
    drawNav();
    const y = self.scroll(); gs.spin = Math.max(-40, Math.min(40, gs.spin + (y - lastY) * .0035)); lastY = y; /* le globe tourne avec le scroll */
  } });
  ST.addEventListener('refresh', drawNav);

  /* spot souris sur le texte produit (desktop) */
  if (fine) $$('.split__text').forEach(t => {
    const s = document.createElement('i'); s.className = 'spot'; s.setAttribute('aria-hidden', 'true'); t.prepend(s);
    let x = 0, y = 0, raf = 0;
    const draw = () => { raf = 0; s.style.transform = `translate3d(${x}px,${y}px,0)`; };
    t.addEventListener('pointermove', e => { const r = t.getBoundingClientRect(); x = e.clientX - r.left; y = e.clientY - r.top; s.classList.add('on'); raf || (raf = requestAnimationFrame(draw)); });
    t.addEventListener('pointerleave', () => s.classList.remove('on'));
  });

  /* prix : compte jusqu'à la valeur à la première apparition */
  $$('.price').forEach(box => {
    const p = box.querySelector('.price__now') || box; /* promo : seul le prix actuel s'anime */
    const txt = p.textContent, m = txt.match(/[\d]+,[\d]+/);
    if (!m) return;
    const end = parseFloat(m[0].replace(',', '.')), o = { v: 0 };
    p.setAttribute('aria-label', txt);
    const pio = new IntersectionObserver(es => {
      if (!es[0].isIntersecting) return;
      pio.disconnect();
      p.textContent = txt.replace(m[0], '0,00');
      gsap.to(o, { v: end, duration: .9, ease: 'power3.out', delay: .15,
        onUpdate: () => { p.textContent = txt.replace(m[0], o.v.toFixed(2).replace('.', ',')); },
        onComplete: () => { p.textContent = txt; } });
      setTimeout(() => { p.textContent = txt; }, 2500); /* garde-fou : le prix final s'affiche toujours */
    }, { rootMargin: '0px 0px -8% 0px' });
    pio.observe(p);
  });

  /* split-text par mots, puis révélation ligne par ligne (masque) */
  const split = el => {
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    const out = [];
    el.childNodes.forEach(n => {
      if (n.nodeType !== 3) { out.push(n.cloneNode(true)); return; }
      n.textContent.split(/(\s+)/).forEach(t => {
        if (!t) return;
        if (!t.trim()) { out.push(document.createTextNode(' ')); return; }
        const w = document.createElement('span'); w.className = 'w'; w.setAttribute('aria-hidden', 'true');
        const i = document.createElement('span'); i.className = 'wi'; i.textContent = t;
        w.appendChild(i); out.push(w);
      });
    });
    el.replaceChildren(...out);
    return $$('.wi', el);
  };
  $$('.display').forEach(h => {
    const words = split(h);
    gsap.set(words, { yPercent: 115 });
    ST.create({ trigger: h, start: 'top 88%', once: true, onEnter: () => {
      const lines = []; let top = null;
      words.forEach(w => {
        const t = w.parentNode.offsetTop;
        if (top === null || Math.abs(t - top) > 4) { lines.push([]); top = t; }
        lines[lines.length - 1].push(w);
      });
      lines.forEach((ws, i) => gsap.to(ws, { yPercent: 0, duration: 1, ease: E.out, stagger: .04, delay: i * .12 }));
    } });
  });

  /* fondus */
  $$('.eyebrow, .lead, .buy, .swatches, .footer__in > *').forEach(el => {
    gsap.set(el, { autoAlpha: 0, y: 24 });
    ST.create({ trigger: el, start: 'top 92%', once: true, onEnter: () => gsap.to(el, { autoAlpha: 1, y: 0, duration: .9, ease: E.out }) });
  });

  /* cadres photo : volet d'entrée + parallax multi-couches (fond décalé, photo, compteur) */
  $$('.gallery__main, .cag__grid figure').forEach(f => {
    gsap.set(f, { clipPath: HIDE });
    ST.create({ trigger: f, start: 'top 92%', once: true, onEnter: () => gsap.to(f, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.2, ease: E.out, clearProps: 'clipPath' }) });
    const inn = $('.pf-in', f), back = $('.pf-back', f), hb = $('.hud b', f);
    const sc = { trigger: f, start: 'top bottom', end: 'bottom top', scrub: true };
    gsap.set(inn, { scale: 1.08 });
    gsap.fromTo(inn, { yPercent: -3.5 }, { yPercent: 3.5, ease: 'none', scrollTrigger: sc });
    if (back) gsap.fromTo(back, { y: 38 }, { y: -10, ease: 'none', scrollTrigger: sc });
    if (hb) gsap.fromTo(hb, { y: 10 }, { y: -10, ease: 'none', scrollTrigger: sc });
  });
  if ($('.cag__b')) gsap.fromTo('.cag__b', { y: 48 }, { y: -16, ease: 'none', scrollTrigger: { trigger: '.cag__grid', start: 'top bottom', end: 'bottom top', scrub: true } });

  /* packs : entrée en cascade (flou + montée), puis zoom lent des montages au défilement */
  const packs = $$('.pack');
  if (packs.length) {
    gsap.set(packs, { autoAlpha: 0, y: 56, filter: 'blur(10px)' });
    ST.batch(packs, { start: 'top 90%', once: true,
      onEnter: b => gsap.to(b, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: .9, ease: E.out, stagger: .12, clearProps: 'filter,transform' }) });
    packs.forEach(c => {
      const fig = $('.pack__fig', c), old = $('.price__old', c), eco = $('.pack__eco', c);
      gsap.fromTo($('img', fig), { scale: 1.16 }, { scale: 1, ease: 'none',
        scrollTrigger: { trigger: c, start: 'top bottom', end: 'bottom top', scrub: true } });
      /* reflet : une bande de lumière balaie la photo quand elle atteint le milieu de l'écran (mobile compris) */
      ST.create({ trigger: fig, start: 'center 60%', once: true, onEnter: () => fig.classList.add('is-lit') });
      /* prix : la barre se trace sur l'ancien prix, puis l'économie apparaît */
      gsap.set(old, { '--strike': '0%' }); gsap.set(eco, { autoAlpha: 0, y: 8, scale: .9 });
      gsap.timeline({ scrollTrigger: { trigger: $('.buy', c), start: 'top 88%', once: true }, delay: .2 })
        .to(old, { '--strike': '100%', duration: .5, ease: E.out })
        .to(eco, { autoAlpha: 1, y: 0, scale: 1, duration: .5, ease: 'back.out(2.2)' }, '-=.1');
    });
  }

  /* lignes d'accent des blocs couleur (hors sections épinglées) */
  $$('.color-block').forEach(b => {
    const w = $('.wrap', b);
    if (!w || b.classList.contains('is-pinned')) return;
    const l = document.createElement('i'); l.setAttribute('aria-hidden', 'true');
    l.style.cssText = 'display:block;height:1px;background:var(--line);transform-origin:left;margin-bottom:var(--s5);width:min(1280px,100% - 2 * var(--gut));margin-inline:auto;';
    b.insertBefore(l, w); l.style.marginBottom = '0'; l.style.position = 'relative'; l.style.top = 'calc(-1 * var(--s6))';
    gsap.fromTo(l, { scaleX: 0 }, { scaleX: 1, ease: E.out, duration: 1.4, scrollTrigger: { trigger: b, start: 'top 80%', once: true } });
  });

  if (fine) {
    /* tilt 3D léger des cadres + décalage du cadre HUD (profondeur) */
    $$('.gallery__main, .cag__grid figure').forEach(f => {
      const hud = $(':scope > .hud', f);
      const rx = gsap.quickTo(f, 'rotationX', { duration: .6, ease: 'power3.out' }), ry = gsap.quickTo(f, 'rotationY', { duration: .6, ease: 'power3.out' });
      const hx = hud && gsap.quickTo(hud, 'x', { duration: .6, ease: 'power3.out' }), hy = hud && gsap.quickTo(hud, 'y', { duration: .6, ease: 'power3.out' });
      gsap.set(f, { transformPerspective: 900 });
      f.addEventListener('pointermove', e => {
        const r = f.getBoundingClientRect(), px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5;
        ry(px * 6); rx(-py * 6); if (hud) { hx(-px * 10); hy(-py * 10); }
      });
      f.addEventListener('pointerleave', () => { rx(0); ry(0); if (hud) { hx(0); hy(0); } });
    });

    /* packs : tilt 3D + reflet qui suit le pointeur (adapté de « Optimized Tilt Card », sh20raj / 21st.dev) */
    $$('.pack').forEach(c => {
      const q = p => gsap.quickTo(c, p, { duration: .5, ease: 'power3.out' });
      const rx = q('rotationX'), ry = q('rotationY'), sc = q('scale');
      gsap.set(c, { transformPerspective: 1000 });
      c.addEventListener('pointermove', e => {
        const r = c.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        c.style.setProperty('--px', `${px * 100}%`); c.style.setProperty('--py', `${py * 100}%`);
        ry((px - .5) * 14); rx((.5 - py) * 14); sc(1.025);
      });
      c.addEventListener('pointerleave', () => { rx(0); ry(0); sc(1); });
    });

    /* CTA : aimantation dans un rayon de 70 px autour du bouton */
    const mags = $$('.more').map(b => ({ b, qx: gsap.quickTo(b, 'x', { duration: .5, ease: 'power3.out' }), qy: gsap.quickTo(b, 'y', { duration: .5, ease: 'power3.out' }) }));
    let mx = -999, my = -999, raf = 0;
    const tick = () => {
      raf = 0;
      mags.forEach(o => {
        const r = o.b.getBoundingClientRect();
        if (r.bottom < -100 || r.top > innerHeight + 100) return;
        const dx = mx - (r.left + r.width / 2), dy = my - (r.top + r.height / 2);
        const ex = Math.max(Math.abs(dx) - r.width / 2, 0), ey = Math.max(Math.abs(dy) - r.height / 2, 0);
        const on = Math.hypot(ex, ey) < 48; /* distance au bord du bouton */
        o.qx(on ? dx * .22 : 0); o.qy(on ? dy * .3 : 0);
      });
    };
    addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY; raf || (raf = requestAnimationFrame(tick)); }, { passive: true });

    /* curseur discret */
    const cur = document.createElement('div'); cur.className = 'cursor'; cur.setAttribute('aria-hidden', 'true'); document.body.appendChild(cur);
    const cx = gsap.quickTo(cur, 'x', { duration: .35, ease: 'power3.out' }), cy = gsap.quickTo(cur, 'y', { duration: .35, ease: 'power3.out' });
    addEventListener('pointermove', e => { cur.classList.add('on'); cx(e.clientX); cy(e.clientY); });
    document.addEventListener('pointerleave', () => cur.classList.remove('on'));
    document.addEventListener('pointerover', e => {
      cur.classList.toggle('big', !!e.target.closest('.gallery__main, .cag__grid figure'));
      cur.classList.toggle('hot', !!e.target.closest('a, button, .swatch'));
    });
  }

  /* préchargeur court + entrée de page chorégraphiée */
  const heads = $$('.topbar__logo, .topbar nav a, .ig--top');
  const gh = $('.globe--hero'), logo = $('.hero__logo'), cue = $('.scroll');
  gsap.set(heads, { autoAlpha: 0, y: -14 });
  if (gh) gsap.set(gh, { autoAlpha: 0, scale: .82 });
  if (logo) gsap.set(logo, { autoAlpha: 0, x: -24, clipPath: 'inset(0 100% 0 0)' });
  if (cue) gsap.set(cue, { autoAlpha: 0, y: 24 });
  const loaded = new Promise(r => { if (document.readyState === 'complete') r(); else addEventListener('load', r, { once: true }); });
  const t0 = performance.now();
  gsap.to('.preloader__bar i', { scaleX: .85, duration: 1.2, ease: 'power2.out' });
  Promise.race([loaded, new Promise(r => setTimeout(r, 1200))]).then(() => {
    const wait = Math.max(0, 900 - (performance.now() - t0));
    const tl = gsap.timeline({ delay: wait / 1000 })
      .to('.preloader__bar i', { scaleX: 1, duration: .25, ease: 'power2.out' })
      .to(pre, { yPercent: -100, duration: .8, ease: E.io }, '+=.05')
      .add(() => { pre.classList.add('done'); killPre(); ST.refresh(); })
      .to(gh || {}, { autoAlpha: 1, scale: 1, duration: 1.2, ease: E.out }, '-=.45')
      .to(logo || {}, { autoAlpha: 1, x: 0, clipPath: 'inset(0 0% 0 0)', duration: 1, ease: E.out, clearProps: 'clipPath' }, '<.12')
      .to(heads, { autoAlpha: 1, y: 0, duration: D.long, ease: E.out, stagger: .06 }, '-=.6')
      .to(cue || {}, { autoAlpha: 1, y: 0, duration: 1, ease: E.out }, '-=.3');
    setTimeout(() => { if (tl.progress() < 1) tl.progress(1); }, wait + 5000);
  });
})();
