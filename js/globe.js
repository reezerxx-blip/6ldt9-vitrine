/* Globe 6.LDT.9 : logo reconstruit en 3D (Three.js), rotation continue sur l'axe vertical.
   Usage : <div class="globe" data-globe data-parallax></div> */
(function () {
  'use strict';
  var INK = 0xece9e2, RED = 0xe10600;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var items = [];
  var running = false;
  var pointer = { x: 0, y: 0 };
  var fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

  function fallback(el) {
    el.classList.add('globe--static');
    el.textContent = '';
    var img = new Image();
    img.src = 'assets/img/logo-globe.png';
    img.alt = '';
    img.decoding = 'async';
    img.setAttribute('aria-hidden', 'true');
    el.appendChild(img);
  }

  function webgl() {
    try {
      var c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) { return false; }
  }

  function circle(r, seg, fn) {
    var pts = [];
    for (var i = 0; i <= seg; i++) { var a = i / seg * Math.PI * 2; pts.push(fn(r, a)); }
    return pts;
  }

  function build(THREE, tex, accent) {
    var root = new THREE.Group();
    var spin = new THREE.Group();
    root.add(spin);
    var line = function (pts, color, op) {
      var g = new THREE.BufferGeometry().setFromPoints(pts);
      return new THREE.Line(g, new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: op }));
    };
    // masque : cache l'arrière du fil de fer
    var mask = new THREE.Mesh(new THREE.SphereGeometry(0.985, 48, 32), new THREE.MeshBasicMaterial({ colorWrite: false }));
    mask.renderOrder = 0;
    spin.add(mask);
    // méridiens
    var M = 16, k, i;
    for (k = 0; k < M; k++) {
      var th = k / M * Math.PI * 2;
      var pts = [];
      for (i = 0; i <= 64; i++) {
        var ph = -Math.PI / 2 + i / 64 * Math.PI;
        pts.push(new THREE.Vector3(Math.cos(ph) * Math.cos(th), Math.sin(ph), Math.cos(ph) * Math.sin(th)));
      }
      var m = line(pts, INK, .92); m.renderOrder = 1; spin.add(m);
    }
    // parallèles (écart au niveau de la bande centrale, comme sur le logo)
    [-66, -50, -35, -21, 21, 35, 50, 66].forEach(function (d) {
      var la = d * Math.PI / 180, r = Math.cos(la), y = Math.sin(la);
      var l = line(circle(r, 96, function (rr, a) { return new THREE.Vector3(rr * Math.cos(a), y, rr * Math.sin(a)); }), INK, .92);
      l.renderOrder = 1; spin.add(l);
    });
    // deux anneaux concentriques
    var ringMat = function (c, o) { return new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o }); };
    var r1 = new THREE.Mesh(new THREE.TorusGeometry(1.42, .014, 8, 160), ringMat(INK, .95));
    var r2 = new THREE.Mesh(new THREE.TorusGeometry(1.31, .008, 8, 160), ringMat(accent ? RED : INK, accent ? .7 : .8));
    r1.renderOrder = r2.renderOrder = 1;
    spin.add(r1, r2);
    // texte + étoiles : plan face caméra
    var w = 2.5, h = w * 136 / 942;
    var plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
    plane.position.z = 1.05; plane.renderOrder = 5;
    root.add(plane);
    return { root: root, spin: spin, plane: plane };
  }

  function mount(el, THREE, tex) {
    var accent = el.hasAttribute('data-accent');
    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
    } catch (e) { fallback(el); return; }
    renderer.setClearColor(0x000000, 0);
    var cv = renderer.domElement;
    cv.setAttribute('aria-hidden', 'true');
    el.textContent = '';
    el.appendChild(cv);
    var scene = new THREE.Scene();
    var cam = new THREE.PerspectiveCamera(30, 1, .1, 50);
    cam.position.z = 8.4;
    var o = build(THREE, tex, accent);
    scene.add(o.root);
    var it = {
      el: el, renderer: renderer, scene: scene, cam: cam, o: o, vis: true, t: Math.random() * 6,
      par: el.hasAttribute('data-parallax') && fine, tx: 0, ty: 0
    };
    function size() {
      var s = Math.max(40, el.clientWidth);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(s, s, false);
      cv.style.width = cv.style.height = '100%';
    }
    size();
    if (window.ResizeObserver) new ResizeObserver(size).observe(el); else addEventListener('resize', size);
    if (window.IntersectionObserver) {
      new IntersectionObserver(function (e) { it.vis = e[0].isIntersecting; kick(); }, { rootMargin: '80px' }).observe(el);
    }
    cv.addEventListener('webglcontextlost', function (e) { e.preventDefault(); it.dead = true; fallback(el); });
    items.push(it);
    draw(it, 0);
  }

  function draw(it, dt) {
    it.t += dt;
    var o = it.o;
    it.tx += (((it.par ? pointer.y : 0) * .22) - it.tx) * .05;
    it.ty += (((it.par ? pointer.x : 0) * .3) - it.ty) * .05;
    o.spin.rotation.y = reduce ? 0 : it.t * .55 + (window.__gs ? window.__gs.spin : 0); /* + rotation liee au scroll */
    o.root.rotation.x = .2 + it.tx;
    o.root.rotation.y = it.ty;
    o.plane.rotation.y = -it.ty * .6 + Math.sin(it.t * .6) * .06;
    it.renderer.render(it.scene, it.cam);
  }

  var last = 0;
  function frame(now) {
    var dt = Math.min(.05, (now - last) / 1000); last = now;
    var any = false;
    for (var i = items.length - 1; i >= 0; i--) {
      var it = items[i];
      if (it.dead || !it.el.isConnected) {
        if (!it.dead) { it.renderer.dispose(); }
        items.splice(i, 1); continue;
      }
      if (!it.vis) continue;
      any = true; draw(it, dt);
    }
    if (any && !document.hidden) requestAnimationFrame(frame); else running = false;
  }
  function kick() {
    if (running || document.hidden || reduce) return;
    running = true; last = performance.now(); requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', kick);
  if (fine) addEventListener('pointermove', function (e) {
    pointer.x = e.clientX / innerWidth * 2 - 1; pointer.y = e.clientY / innerHeight * 2 - 1;
  }, { passive: true });

  var els = [].slice.call(document.querySelectorAll('[data-globe]'));
  if (!els.length) return;
  if (reduce || !window.THREE || !webgl()) { els.forEach(fallback); return; }
  var THREE = window.THREE;
  var tex = new THREE.TextureLoader().load('assets/img/logo-globe-text.png', function () { kick(); });
  if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
  tex.anisotropy = 4;
  els.forEach(function (el) { mount(el, THREE, tex); });
  kick();
})();
