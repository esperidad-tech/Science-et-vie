/* Roche mère — outils partagés par tous les mini-jeux.
   Scripts classiques (pas de modules) : tout passe par l'objet global RM.
   Chaque jeu s'enregistre avec RM.games.nom = function (api) { … }. */
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
  const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);

  const ease = {
    inQuad: (t) => t * t,
    outQuad: (t) => 1 - (1 - t) * (1 - t),
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
    outBack: (t) => {
      const c1 = 1.70158, c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
    outElastic: (t) => {
      if (t === 0 || t === 1) return t;
      return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1;
    },
  };

  /* Typographie française : espace insécable avant : ; ! ? » et après «. */
  function fr(s) {
    return String(s == null ? '' : s)
      .replace(/ ([:;!?»%])/g, '\u00A0$1')
      .replace(/« /g, '«\u00A0')
      .replace(/(\d) (?=\d{3}(?!\d))/g, '$1\u202F')
      .replace(/(\d) (?=(?:°C|°|km|cm|mm|m³|m|kg|g|ppm|mSv|MW|GW|TWh|kWh)(?![a-zA-Zàâäéèêëîïôöûüç]))/g, '$1\u00A0');
  }

  /* Nombres à la française : 1 234,5 */
  function num(n, digits = 0) {
    return Number(n).toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }

  /* Couleurs */
  function hexToRgb(hex) {
    let h = String(hex).trim().replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgba(hex, a = 1) {
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  }
  function mix(hexA, hexB, t, a = 1) {
    const A = hexToRgb(hexA), B = hexToRgb(hexB);
    const c = A.map((v, i) => Math.round(lerp(v, B[i], clamp(t))));
    return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  }
  /* Dégradé à plusieurs arrêts : stops = [[0,'#000'],[0.5,'#f00'],[1,'#fff']] */
  function ramp(stops, t, a = 1) {
    t = clamp(t);
    for (let i = 1; i < stops.length; i++) {
      if (t <= stops[i][0]) {
        const [t0, c0] = stops[i - 1];
        const [t1, c1] = stops[i];
        return mix(c0, c1, invLerp(t0, t1, t), a);
      }
    }
    return rgba(stops[stops.length - 1][1], a);
  }

  /* Bruit de valeur 2D (déterministe) pour les textures de roche, de lave, etc. */
  function makeNoise(seed = 1) {
    const perm = new Uint8Array(512);
    let s = seed >>> 0 || 1;
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    const p = Array.from({ length: 256 }, (_, i) => i);
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    const val = (x, y) => perm[(perm[x & 255] + y) & 511] / 255;
    const smooth = (t) => t * t * (3 - 2 * t);
    function noise2(x, y) {
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = x - xi, yf = y - yi;
      const a = val(xi, yi), b = val(xi + 1, yi), c = val(xi, yi + 1), d = val(xi + 1, yi + 1);
      const u = smooth(xf), v = smooth(yf);
      return lerp(lerp(a, b, u), lerp(c, d, u), v);
    }
    function fbm(x, y, oct = 4) {
      let sum = 0, amp = 0.5, f = 1, norm = 0;
      for (let i = 0; i < oct; i++) {
        sum += amp * noise2(x * f, y * f);
        norm += amp;
        amp *= 0.5;
        f *= 2;
      }
      return sum / norm;
    }
    return { noise2, fbm, rnd };
  }

  /* Canevas net sur écrans haute densité, redimensionné avec son conteneur.
     Les coordonnées de dessin sont en pixels CSS. */
  function makeCanvas(stage, opts = {}) {
    const maxDpr = opts.maxDpr || 2;
    const canvas = document.createElement('canvas');
    canvas.className = 'game-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    stage.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const state = { canvas, ctx, w: 0, h: 0, dpr: 1 };
    const listeners = [];
    function fit() {
      const r = stage.getBoundingClientRect();
      const w = Math.max(1, Math.round(r.width));
      const h = Math.max(1, Math.round(r.height));
      /* une scène encore en cours de mise en page n'a pas de vraie taille : on attend */
      if (w < 40 || h < 40) return;
      const dpr = Math.min(maxDpr, window.devicePixelRatio || 1);
      if (w === state.w && h === state.h && dpr === state.dpr) return;
      state.w = w;
      state.h = h;
      state.dpr = dpr;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      listeners.forEach((fn) => fn(w, h));
    }
    if ('ResizeObserver' in window) new ResizeObserver(fit).observe(stage);
    else window.addEventListener('resize', fit);
    fit();
    state.fit = fit;
    state.onResize = (fn) => {
      listeners.push(fn);
      if (state.w) fn(state.w, state.h);
    };
    /* Efface tout le canevas (en tenant compte de la densité) */
    state.clear = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    };
    return state;
  }

  /* Suivi du doigt / de la souris (Pointer Events), coordonnées relatives à l'élément.
     touchAction : 'none' (le jeu capte tout, pour les glisser-déposer libres),
                   'pan-y' (le défilement vertical reste possible : idéal pour taper ou balayer horizontalement).
     Les gestionnaires reçoivent p = { x, y, x0, y0, dx, dy, id, t0, dt, tap }. */
  function track(el, handlers = {}, opts = {}) {
    const touchAction = opts.touchAction || 'none';
    el.style.touchAction = touchAction;
    el.style.webkitUserSelect = 'none';
    el.style.userSelect = 'none';
    const active = new Map();
    const pos = (e) => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top, id: e.pointerId, type: e.pointerType };
    };
    function onDown(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const p = pos(e);
      p.t0 = performance.now();
      p.x0 = p.x;
      p.y0 = p.y;
      p.dx = 0;
      p.dy = 0;
      active.set(e.pointerId, p);
      if (opts.capture !== false && el.setPointerCapture) {
        try { el.setPointerCapture(e.pointerId); } catch (err) { /* rien */ }
      }
      if (handlers.down) handlers.down(p, e);
    }
    function onMove(e) {
      const prev = active.get(e.pointerId);
      const p = pos(e);
      if (!prev) {
        if (handlers.hover) handlers.hover(p, e);
        return;
      }
      p.t0 = prev.t0;
      p.x0 = prev.x0;
      p.y0 = prev.y0;
      p.dx = p.x - prev.x;
      p.dy = p.y - prev.y;
      active.set(e.pointerId, p);
      if (handlers.move) handlers.move(p, e);
    }
    function onUp(e) {
      const prev = active.get(e.pointerId);
      if (!prev) return;
      active.delete(e.pointerId);
      const p = pos(e);
      p.t0 = prev.t0;
      p.x0 = prev.x0;
      p.y0 = prev.y0;
      p.dx = p.x - prev.x;
      p.dy = p.y - prev.y;
      p.dt = performance.now() - prev.t0;
      p.tap = p.dt < 350 && Math.hypot(p.x - p.x0, p.y - p.y0) < 14;
      if (handlers.up) handlers.up(p, e, e.type === 'pointercancel');
    }
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('lostpointercapture', (e) => { if (active.has(e.pointerId)) onUp(e); });
    return {
      active,
      get pressed() { return active.size > 0; },
      destroy() {
        el.removeEventListener('pointerdown', onDown);
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerup', onUp);
        el.removeEventListener('pointercancel', onUp);
      },
    };
  }

  /* Petits sons synthétisés (Web Audio), désactivés par défaut. */
  const sfx = {
    enabled: false,
    ctx: null,
    last: {},
    noiseBuf: null,
    ensure() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.45;
        this.master.connect(this.ctx.destination);
        const len = this.ctx.sampleRate * 1.5;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    },
    tone(type, f0, f1, dur, gain = 0.3, delay = 0) {
      const c = this.ctx, t = c.currentTime + delay;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.02, dur / 4));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + dur + 0.05);
    },
    noise(filterType, f0, f1, dur, gain = 0.3, q = 1) {
      const c = this.ctx, t = c.currentTime;
      const src = c.createBufferSource();
      src.buffer = this.noiseBuf;
      const f = c.createBiquadFilter();
      f.type = filterType;
      f.Q.value = q;
      f.frequency.setValueAtTime(f0, t);
      if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.04, dur / 3));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(this.master);
      src.start(t, Math.random() * 0.5);
      src.stop(t + dur + 0.05);
    },
    /* nom : pop, tick, bubble, whoosh, rumble, splash, crack, chime, success, thud, scrape, wind, fail */
    play(name, opt = {}) {
      if (!this.enabled) return;
      const now = performance.now();
      const gap = opt.gap == null ? 35 : opt.gap;
      if (this.last[name] && now - this.last[name] < gap) return;
      this.last[name] = now;
      if (!this.ensure()) return;
      const p = opt.pitch || 1;
      const v = opt.volume == null ? 1 : opt.volume;
      switch (name) {
        case 'pop': this.tone('sine', 620 * p, 180 * p, 0.12, 0.28 * v); break;
        case 'tick': this.tone('triangle', 1400 * p, 1100 * p, 0.05, 0.12 * v); break;
        case 'bubble': this.tone('sine', 260 * p, 900 * p, 0.14, 0.2 * v); break;
        case 'whoosh': this.noise('bandpass', 300 * p, 2400 * p, 0.45, 0.35 * v, 0.8); break;
        case 'wind': this.noise('bandpass', 500 * p, 900 * p, 0.8, 0.22 * v, 0.6); break;
        case 'rumble': this.noise('lowpass', 160 * p, 60 * p, 1.1, 0.6 * v, 0.7); break;
        case 'splash': this.noise('highpass', 1500 * p, 600 * p, 0.35, 0.3 * v, 0.5); break;
        case 'crack': this.noise('highpass', 2500 * p, 1800 * p, 0.07, 0.35 * v, 0.7); break;
        case 'scrape': this.noise('bandpass', 900 * p, 700 * p, 0.09, 0.22 * v, 2); break;
        case 'thud': this.tone('sine', 140 * p, 45 * p, 0.28, 0.5 * v); break;
        case 'chime':
          this.tone('sine', 880 * p, 880 * p, 0.5, 0.18 * v);
          this.tone('sine', 1320 * p, 1320 * p, 0.6, 0.1 * v, 0.06);
          break;
        case 'success':
          [523, 659, 784, 1047].forEach((f, i) => this.tone('triangle', f * p, f * p, 0.35, 0.16 * v, i * 0.09));
          break;
        case 'fail': this.tone('square', 220 * p, 140 * p, 0.22, 0.08 * v); break;
        default: this.tone('sine', 440 * p, 440 * p, 0.1, 0.2 * v);
      }
    },
  };

  /* Petite vibration (Android) pour accompagner les gestes. */
  function buzz(pattern = 8) {
    if (reducedMotion) return;
    if (navigator.vibrate) {
      try { navigator.vibrate(pattern); } catch (e) { /* rien */ }
    }
  }

  /* Styles propres à un jeu, injectés une seule fois. */
  const injected = new Set();
  function injectStyle(id, css) {
    if (injected.has(id)) return;
    injected.add(id);
    const s = document.createElement('style');
    s.dataset.for = id;
    s.textContent = css;
    document.head.appendChild(s);
  }

  /* Indication de geste animée par-dessus la scène (doigt fantôme).
     type : tap, hold, drag, rub, swipe, circle. x, y en % de la scène.
     Pour drag : dx, dy en % (direction du geste). */
  function showGesture(stage, type, o = {}) {
    let el = stage.querySelector('.gesture');
    if (!type) {
      if (el) el.remove();
      return null;
    }
    if (!el) {
      el = document.createElement('div');
      el.className = 'gesture';
      el.setAttribute('aria-hidden', 'true');
      el.innerHTML = '<span class="gesture-ring"></span><span class="gesture-dot"></span>';
      stage.appendChild(el);
    }
    el.dataset.type = type;
    el.style.left = (o.x == null ? 50 : o.x) + '%';
    el.style.top = (o.y == null ? 50 : o.y) + '%';
    el.style.setProperty('--gx', (o.dx == null ? 0 : o.dx) + 'px');
    el.style.setProperty('--gy', (o.dy == null ? 0 : o.dy) + 'px');
    if (o.radius) el.style.setProperty('--gr', o.radius + 'px');
    const hide = () => {
      el.remove();
      stage.removeEventListener('pointerdown', hide, true);
    };
    if (o.persist !== true) stage.addEventListener('pointerdown', hide, true);
    return el;
  }

  /* Gerbe de particules en DOM (célébration commune à tous les jeux). */
  function celebrate(host, colors) {
    if (reducedMotion || !host) return;
    const box = document.createElement('div');
    box.className = 'confetti';
    box.setAttribute('aria-hidden', 'true');
    const cs = colors && colors.length ? colors : ['#fff'];
    for (let i = 0; i < 26; i++) {
      const s = document.createElement('i');
      const a = rand(-Math.PI, 0);
      const d = rand(60, 170);
      s.style.setProperty('--tx', Math.cos(a) * d + 'px');
      s.style.setProperty('--ty', Math.sin(a) * d + 'px');
      s.style.setProperty('--r', rand(-260, 260) + 'deg');
      s.style.setProperty('--d', rand(0.7, 1.2) + 's');
      s.style.background = pick(cs);
      if (Math.random() < 0.5) s.style.borderRadius = '50%';
      box.appendChild(s);
    }
    host.appendChild(box);
    setTimeout(() => box.remove(), 1500);
  }

  /* Petits dessins réutilisables */
  const draw = {
    /* Halo lumineux radial */
    glow(ctx, x, y, r, color, alpha = 1) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(color, alpha));
      g.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    },
    /* Forme organique (galet, cellule) : rayon modulé par quelques harmoniques */
    blob(ctx, x, y, r, wobble = 0.12, seed = 0, t = 0, points = 28) {
      ctx.beginPath();
      for (let i = 0; i <= points; i++) {
        const a = (i / points) * TAU;
        const k = 1 + wobble * (Math.sin(a * 3 + seed + t) * 0.5 + Math.sin(a * 5 - seed * 1.7 + t * 0.7) * 0.3 + Math.sin(a * 2 + seed * 2.3) * 0.2);
        const px = x + Math.cos(a) * r * k;
        const py = y + Math.sin(a) * r * k;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    },
    /* Rectangle aux coins arrondis */
    roundRect(ctx, x, y, w, h, r) {
      const rr = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.arcTo(x + w, y, x + w, y + h, rr);
      ctx.arcTo(x + w, y + h, x, y + h, rr);
      ctx.arcTo(x, y + h, x, y, rr);
      ctx.arcTo(x, y, x + w, y, rr);
      ctx.closePath();
    },
  };

  window.RM = window.RM || {};
  window.RM.games = window.RM.games || {};
  window.RM.lib = {
    TAU, reducedMotion, clamp, lerp, invLerp, rand, randInt, pick, dist, ease,
    fr, num, hexToRgb, rgba, mix, ramp, makeNoise, makeCanvas, track, sfx, buzz,
    injectStyle, showGesture, celebrate, draw,
  };
})();
