/* Les fabricants d'oxygène : chaque tape sur un stromatolithe fait travailler ses
   cyanobactéries. Leurs bulles d'oxygène font d'abord rouiller le fer dissous, qui coule
   et se dépose en couches rouges et grises (fer rubané). Quand le fer est épuisé,
   l'oxygène s'échappe dans l'air et le ciel brumeux devient bleu. */
(function () {
  'use strict';
  const { lib } = window.RM;
  const { TAU, rand, clamp, lerp, ease, rgba, mix, pick, draw } = lib;

  /* Tous les textes du jeu, faciles à corriger */
  const TEXTES = {
    fer: (pct) => `Fer dissous dans l’océan : ${pct} %`,
    consigneAir: 'Continue de taper : sans fer à rouiller, l’oxygène s’échappe maintenant dans l’air.',
    air: 'Oxygène dans l’air : en hausse',
    fin: 'Le ciel se charge d’oxygène : c’est la Grande Oxydation, il y a environ 2,4 milliards d’années.',
    finStatut: 'Les couches rouges déposées au fond sont devenues des roches : les formations de fer rubané.',
  };

  window.RM.games.oxygene = function (api) {
    const cv = api.canvas();
    const ctx = cv.ctx;
    const AMB = api.reducedMotion ? 0.3 : 1; /* amplitude des mouvements d'ambiance */

    const N_IRON = 200;            /* particules de fer dissous */
    const CAPS = [3, 2, 2, 3, 2, 2, 2, 2]; /* fer que rouille chaque bulle d'une tape (18 par tape) */
    const UNITS_B = 40;            /* bulles qui doivent s'échapper dans l'air (~5 tapes) */
    const PASSIVE = 2.4;           /* photosynthèse automatique : une bulle toutes les 2,4 s */
    const CONTACT = 21;            /* distance de contact bulle / fer (px) */
    const RED_PER = 0.075 / N_IRON; /* épaisseur apportée par une particule (fraction de h) */
    const BAND_RED = 0.019;        /* épaisseur d'une bande rouge avant une bande grise */
    const GREY_TH = 0.008;         /* épaisseur d'une bande grise */
    const SEG = 24;                /* segments du contour d'un monticule */

    /* Stromatolithes : position, demi-largeur, hauteur (fractions de la scène) */
    const MOUNDS = [
      { x: 0.15, bw: 0.088, h: 0.13, seed: 1.3 },
      { x: 0.39, bw: 0.112, h: 0.19, seed: 4.1 },
      { x: 0.64, bw: 0.098, h: 0.15, seed: 7.7 },
      { x: 0.87, bw: 0.080, h: 0.11, seed: 2.9 },
    ];
    const TALLEST = 1;
    const LAM0 = 13;        /* couches de départ de chaque monticule */
    const GROW_H = 0.0065;  /* une tape = une fine couche de plus */
    const GROW_MAX = 0.075; /* croissance maximale */
    const EMBED = 6;        /* le pied du monticule s'enfonce dans le fond */

    const LIGHT = ['#B08A60', '#A7835B', '#BC9669', '#A98660'];
    const DARK = ['#7B5B3F', '#6F5038', '#84634A', '#76563C'];
    const REDS = ['#B6432A', '#A63B25', '#C04B2E', '#9E3722'];
    const GREYS = ['#CBC5BB', '#BDB7AE', '#D3CEC5'];
    const RAMP = []; /* couleurs du fer dissous vers la rouille */
    for (let i = 0; i < 8; i++) RAMP.push(mix('#C3CEAE', '#B6432A', i / 7));

    const C = {
      hazeTop: lib.hexToRgb('#5A2A1C'), hazeMid: lib.hexToRgb('#9A4E2C'), hazeHor: lib.hexToRgb('#D9935A'),
      blueTop: lib.hexToRgb('#7DB7E0'), blueMid: lib.hexToRgb('#A9D0EC'), blueHor: lib.hexToRgb('#D6EBF6'),
      seaTopA: lib.hexToRgb('#5F8763'), seaMidA: lib.hexToRgb('#38604A'), seaBotA: lib.hexToRgb('#1D3529'),
      seaTopB: lib.hexToRgb('#4A9C97'), seaMidB: lib.hexToRgb('#2B6A6C'), seaBotB: lib.hexToRgb('#163A3D'),
      sunHaze: lib.hexToRgb('#FFB46A'), sunClear: lib.hexToRgb('#FFF3D6'),
      filA: lib.hexToRgb('#35B892'), filB: lib.hexToRgb('#D2FFEC'),
    };

    const G = { w: 1, h: 1, seaY: 1, S: 1, U: 1, sunX: 0, sunY: 0 };
    let mounds = [];
    let parts = [];
    let bubbles = [];
    let queue = [];
    let puffs = [];
    let ripples = [];
    let rings = [];
    let pops = [];
    let bands = [];
    let dep = 0;          /* épaisseur totale déposée (fraction de h) */
    let pendingRed = 0;
    let pool = 0;         /* oxygène resté dissous : il rouille du fer au hasard */
    let poolT = 0;
    let rusted = 0;       /* particules de fer déjà touchées par l'oxygène */
    let committed = 0;    /* oxygène déjà libéré pour le fer (les bulles suivantes iront dans l'air) */
    let earlyAir = 0;     /* bulles sorties de l'eau juste avant l'épuisement du fer */
    let airUnits = 0;
    let phase = 'A';
    let finished = false;
    let passiveT = 0;
    let time = 0;
    let skyT = 0;
    let shownPct = -1;
    let rockCv = null, rayCv = null, hazeCv = null, cloudCv = null, grainCv = null, farCv = null;

    /* ---- petits outils ---- */
    function mixRGB(A, B, t) {
      return [Math.round(lerp(A[0], B[0], t)), Math.round(lerp(A[1], B[1], t)), Math.round(lerp(A[2], B[2], t))];
    }
    function css(c, a) { return `rgba(${c[0]},${c[1]},${c[2]},${a == null ? 1 : a})`; }
    function glowRGB(g, x, y, r, c, a) {
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, css(c, a));
      gr.addColorStop(1, css(c, 0));
      g.fillStyle = gr;
      g.beginPath();
      g.arc(x, y, r, 0, TAU);
      g.fill();
    }
    function mk(wc, hc) {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(wc * cv.dpr));
      c.height = Math.max(1, Math.round(hc * cv.dpr));
      const g = c.getContext('2d');
      g.scale(cv.dpr, cv.dpr);
      return { c, g, w: wc, h: hc };
    }
    /* ondulation commune à toutes les limites de couches du fond */
    function wv(x) {
      return Math.sin(x * 0.021 + 0.6) * 1.3 + Math.sin(x * 0.057 + 2.1) * 0.6;
    }
    function bandVar(x, i) {
      return i === 0 ? 0 : 0.45 * Math.sin(x * 0.043 + i * 1.9);
    }
    function floorY(x) {
      return G.S - dep * G.h + wv(x);
    }
    /* profil d'un monticule : 1 au sommet, 0 au pied (u de -1 à 1) */
    function prof(u, seed) {
      const a = Math.abs(u);
      if (a >= 1) return 0;
      const base = Math.pow(1 - Math.pow(a, 2.3), 0.55);
      return base * (1 + 0.04 * Math.sin(u * 6.3 + seed) + 0.02 * Math.sin(u * 13.1 + seed * 2.7));
    }
    /* ---- textures pré-rendues ---- */
    function buildRock() {
      const { w, h, S } = G;
      const top = S - 6;
      const R = mk(w, h - top + 2);
      const g = R.g;
      /* texture de roche litée, calculée en basse résolution puis lissée */
      const TW = Math.max(8, Math.round(w / 3)), TH = Math.max(4, Math.round(R.h / 3));
      const t = document.createElement('canvas');
      t.width = TW;
      t.height = TH;
      const tg = t.getContext('2d');
      const img = tg.createImageData(TW, TH);
      const n = lib.makeNoise(11);
      const A = lib.hexToRgb('#5A3A2E'), B = lib.hexToRgb('#2A1914'), Dk = lib.hexToRgb('#140A07');
      for (let y = 0; y < TH; y++) {
        const depth = y / TH;
        for (let x = 0; x < TW; x++) {
          const v = n.fbm(x / 9, y / 2.6 + n.noise2(x / 30, 3) * 2, 4);
          const strata = 0.5 + 0.5 * Math.sin(y * 1.15 + n.noise2(x / 14, y / 5) * 2.4);
          let c = mixRGB(A, B, clamp(depth * 0.9 + (0.55 - v) * 1.4));
          c = mixRGB(c, Dk, clamp(strata * 0.28 + depth * 0.25));
          const j = (y * TW + x) * 4;
          img.data[j] = c[0]; img.data[j + 1] = c[1]; img.data[j + 2] = c[2]; img.data[j + 3] = 255;
        }
      }
      tg.putImageData(img, 0, 0);
      g.save();
      g.beginPath();
      g.moveTo(0, R.h);
      for (let x = 0; x <= w + 6; x += 6) g.lineTo(x, S + wv(x) - top);
      g.lineTo(w + 6, R.h);
      g.closePath();
      g.clip();
      g.imageSmoothingEnabled = true;
      g.drawImage(t, 0, 0, w, R.h);
      /* quelques petits cailloux et grains clairs */
      for (let i = 0; i < 26; i++) {
        const x = rand(w), y = rand(8, R.h - 4), r = rand(1.5, 4);
        g.fillStyle = 'rgba(12,6,4,0.35)';
        draw.blob(g, x + 0.8, y + 1, r, 0.25, i, 0, 12);
        g.fill();
        g.fillStyle = rgba(pick(['#7C5A4A', '#6B4A3C', '#8E6A56']), 0.8);
        draw.blob(g, x, y, r, 0.25, i, 0, 12);
        g.fill();
      }
      for (let i = 0; i < 140; i++) {
        g.fillStyle = rgba(Math.random() < 0.5 ? '#D9B8A2' : '#0C0604', rand(0.12, 0.35));
        g.fillRect(rand(w), rand(R.h), rand(0.6, 1.4), rand(0.6, 1.1));
      }
      const vg = g.createLinearGradient(0, 0, 0, R.h);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(8,3,2,0.45)');
      g.fillStyle = vg;
      g.fillRect(0, 0, w, R.h);
      g.restore();
      g.beginPath();
      for (let x = 0; x <= w + 6; x += 6) {
        const y = S + wv(x) - top;
        if (x === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.strokeStyle = 'rgba(20,10,6,0.55)';
      g.lineWidth = 1.2;
      g.stroke();
      rockCv = R;
    }

    function buildRays() {
      const { w, seaY, S } = G;
      const H = S - seaY;
      const R = mk(w, H);
      const g = R.g;
      const n = 6;
      for (let i = 0; i < n; i++) {
        const x0 = w * (0.22 + 0.8 * (i + 0.5) / n) + rand(-12, 12);
        const wd = rand(10, 26);
        const slant = H * 0.42;
        const a = rand(0.07, 0.13);
        const gr = g.createLinearGradient(0, 0, 0, H);
        gr.addColorStop(0, `rgba(235,255,225,${a})`);
        gr.addColorStop(0.7, `rgba(235,255,225,${a * 0.25})`);
        gr.addColorStop(1, 'rgba(235,255,225,0)');
        g.fillStyle = gr;
        g.beginPath();
        g.moveTo(x0 - wd / 2, 0);
        g.lineTo(x0 + wd / 2, 0);
        g.lineTo(x0 + wd * 1.4 - slant, H);
        g.lineTo(x0 - wd * 1.4 - slant, H);
        g.closePath();
        g.fill();
      }
      rayCv = R;
    }

    function buildSky() {
      const { w, seaY } = G;
      /* textures qui bouclent sans couture : chaque nappe est aussi dessinée à ± w */
      const Hz = mk(w, seaY + 8);
      for (let i = 0; i < 10; i++) {
        const x = rand(w), y = rand(seaY * 0.1, seaY), r = rand(w * 0.25, w * 0.55), a = rand(0.2, 0.34);
        for (let k = -1; k <= 1; k++) {
          Hz.g.save();
          Hz.g.translate(x + k * w, y);
          Hz.g.scale(1, 0.18);
          draw.glow(Hz.g, 0, 0, r, i % 2 ? '#E7A06A' : '#B56A3E', a);
          Hz.g.restore();
        }
      }
      hazeCv = Hz;
      const Cl = mk(w, seaY + 8);
      for (let i = 0; i < 4; i++) {
        const y = rand(seaY * 0.22, seaY * 0.7);
        const x = w * (0.1 + 0.8 * i / 3) + rand(-20, 20);
        for (let j = 0; j < 5; j++) {
          const px = x + rand(-w * 0.07, w * 0.07), py = y + rand(-3, 3), r = rand(w * 0.05, w * 0.1), a = rand(0.3, 0.5);
          for (let k = -1; k <= 1; k++) {
            Cl.g.save();
            Cl.g.translate(px + k * w, py);
            Cl.g.scale(1, 0.3);
            draw.glow(Cl.g, 0, 0, r, '#FFFFFF', a);
            Cl.g.restore();
          }
        }
      }
      cloudCv = Cl;
    }

    function buildGrain() {
      const { w, h } = G;
      const R = mk(w, Math.ceil(h * 0.2));
      const g = R.g;
      const n = Math.round(w * R.h * 0.05);
      for (let i = 0; i < n; i++) {
        g.fillStyle = Math.random() < 0.55 ? `rgba(50,14,6,${rand(0.08, 0.28)})` : `rgba(255,225,205,${rand(0.06, 0.2)})`;
        g.fillRect(rand(w), rand(R.h), rand(0.6, 1.8), rand(0.5, 1));
      }
      grainCv = R;
    }

    function buildFar() {
      const { w, h } = G;
      const H = h * 0.16;
      const R = mk(w, H + 6);
      const g = R.g;
      const cnt = 7;
      for (let i = 0; i < cnt; i++) {
        const cx = (w * (i + rand(0.2, 0.8))) / cnt;
        const bw = rand(0.04, 0.07) * w;
        const hh = rand(0.04, 0.09) * h;
        g.beginPath();
        g.moveTo(cx - bw, H + 6);
        for (let k = 0; k <= 16; k++) {
          const u = -1 + k / 8;
          g.lineTo(cx + u * bw, H - hh * prof(u, i * 1.7));
        }
        g.lineTo(cx + bw, H + 6);
        g.closePath();
        g.fillStyle = 'rgba(26,50,38,0.5)';
        g.fill();
      }
      farCv = R;
    }

    /* ---- géométrie ---- */
    let lastW = 0, lastH = 0;
    cv.onResize((w, h) => {
      const sx = lastW ? w / lastW : 1;
      const sy = lastH ? h / lastH : 1;
      G.w = w;
      G.h = h;
      G.seaY = Math.round(h * 0.25);
      G.S = Math.round(h * 0.85);
      G.U = Math.min(h, w * 1.25);
      G.sunX = w * 0.76;
      G.sunY = h * 0.105;
      buildRock();
      buildRays();
      buildSky();
      buildGrain();
      buildFar();
      if (lastW) {
        for (const p of parts) { p.x *= sx; p.y *= sy; p.hx *= sx; p.hy *= sy; }
        for (const b of bubbles) { b.x *= sx; b.y *= sy; }
      }
      for (const m of mounds) m.dirty = true;
      lastW = w;
      lastH = h;
    });

    /* ---- stromatolithes ---- */
    function makeMound(d, i) {
      const m = { x: d.x, bw: d.bw, h: d.h, seed: d.seed, idx: i, lam: [], glow: 0, cache: null, dirty: true, fil: [] };
      for (let k = 0; k < LAM0; k++) {
        const t = (k + 1) / LAM0;
        m.lam.push({ hf: d.h * lerp(0.3, 1, t), wr: lerp(0.52, 1, Math.pow(t, 0.8)), col: k % 2 ? DARK[(k + i) % 4] : LIGHT[(k + i * 3) % 4], k: 1 });
      }
      const nf = Math.round(18 + d.bw * 120);
      for (let k = 0; k < nf; k++) {
        m.fil.push({ u: -0.88 + 1.76 * (k + rand(0.1, 0.9)) / nf, len: rand(3, 7.5), ph: rand(TAU), dot: Math.random() < 0.45 });
      }
      return m;
    }
    /* hauteur et demi-largeur d'une couche (la dernière arrive en douceur) */
    const D = { h: 0, w: 0 };
    function dims(m, i) {
      const L = m.lam[i];
      if (L.k >= 1 || i === 0) {
        D.h = L.hf * G.U;
        D.w = L.wr * m.bw * G.w;
        return D;
      }
      const P = m.lam[i - 1];
      const e = ease.outBack(L.k);
      D.h = lerp(P.hf, L.hf, e) * G.U;
      D.w = lerp(P.wr, L.wr, e) * m.bw * G.w;
      return D;
    }
    function moundBase(m) { return floorY(m.x * G.w) + EMBED; }
    function lamSeed(m, i) { return m.seed + i * 0.05; }
    /* point du contour extérieur et sa normale (vers l'extérieur) */
    const PT = { x: 0, y: 0, nx: 0, ny: -1 };
    function contour(m, u) {
      const n = m.lam.length - 1;
      dims(m, n);
      const oh = D.h, ow = D.w;
      const mx = m.x * G.w, by = moundBase(m), sd = lamSeed(m, n);
      const y0 = by - oh * prof(u, sd);
      const u2 = Math.min(0.999, u + 0.02);
      const tx = (u2 - u) * ow;
      const ty = (by - oh * prof(u2, sd)) - y0;
      const l = Math.hypot(tx, ty) || 1;
      PT.x = mx + u * ow;
      PT.y = y0;
      PT.nx = ty / l;
      PT.ny = -tx / l;
      return PT;
    }
    function insideMound(x, y, pad) {
      for (const m of mounds) {
        dims(m, m.lam.length - 1);
        const u = (x - m.x * G.w) / (D.w + pad);
        if (Math.abs(u) < 1 && y > moundBase(m) - D.h * prof(u, lamSeed(m, m.lam.length - 1)) - pad) return true;
      }
      return false;
    }

    function renderMound(m) {
      const Wm = Math.ceil(2 * 1.5 * m.bw * G.w + 12);
      const Hm = Math.ceil((m.h + GROW_MAX) * G.U * 1.2 + EMBED + 10);
      if (!m.cache || m.cache.w !== Wm || m.cache.h !== Hm || m.cache.dpr !== cv.dpr) {
        m.cache = mk(Wm, Hm);
        m.cache.dpr = cv.dpr;
      }
      const g = m.cache.g;
      g.clearRect(0, 0, Wm, Hm);
      const cx = Wm / 2, by = Hm - 2;
      const n = m.lam.length - 1;
      for (let i = n; i >= 0; i--) {
        dims(m, i);
        const hh = D.h, ww = D.w;
        const sd = lamSeed(m, i);
        g.beginPath();
        g.moveTo(cx - ww, by);
        for (let s = 0; s <= SEG; s++) {
          const u = -1 + (2 * s) / SEG;
          g.lineTo(cx + u * ww, by - hh * prof(u, sd));
        }
        g.closePath();
        g.fillStyle = m.lam[i].col;
        g.fill();
      }
      dims(m, n);
      const oh = D.h, ow = D.w;
      g.globalCompositeOperation = 'source-atop';
      /* lumière venue d'en haut à gauche, ombre à droite et au pied */
      const sh = g.createLinearGradient(cx - ow, 0, cx + ow, 0);
      sh.addColorStop(0, 'rgba(255,232,196,0.2)');
      sh.addColorStop(0.42, 'rgba(255,232,196,0)');
      sh.addColorStop(1, 'rgba(26,12,6,0.42)');
      g.fillStyle = sh;
      g.fillRect(0, 0, Wm, Hm);
      const vg = g.createLinearGradient(0, by - oh, 0, by);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(0.6, 'rgba(12,30,20,0.12)');
      vg.addColorStop(1, 'rgba(12,30,20,0.55)');
      g.fillStyle = vg;
      g.fillRect(0, 0, Wm, Hm);
      /* grains de sable piégés dans les couches (tirage fixe : pas de scintillement) */
      let s = m.idx * 977 + 13;
      const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
      for (let i = 0; i < 90; i++) {
        const u = r() * 2 - 1;
        const v = r();
        const x = cx + u * ow * 0.95;
        const y = by - oh * prof(u, m.seed) * v;
        g.fillStyle = r() < 0.5 ? `rgba(255,236,205,${0.12 + r() * 0.2})` : `rgba(40,20,10,${0.12 + r() * 0.25})`;
        g.fillRect(x, y, 0.8 + r() * 1.2, 0.8 + r() * 0.8);
      }
      g.globalCompositeOperation = 'source-over';
      m.dirty = false;
    }

    function grow(m) {
      const top = m.lam[m.lam.length - 1];
      if (top.hf - m.h >= GROW_MAX - 1e-6) return;
      const k = m.lam.length;
      m.lam.push({
        hf: top.hf + GROW_H,
        wr: top.wr + 0.5 * GROW_H / m.h,
        col: k % 2 ? DARK[(k + m.idx) % 4] : LIGHT[(k + m.idx * 3) % 4],
        k: 0,
      });
      m.dirty = true;
    }

    /* ---- fer dissous ---- */
    function spawnIron(p) {
      for (let t = 0; t < 30; t++) {
        p.x = rand(6, G.w - 6);
        p.y = rand(G.seaY + G.h * 0.045, G.S - G.h * 0.115);
        if (!insideMound(p.x, p.y, 5)) break;
      }
      p.hx = p.x;
      p.hy = p.y;
      p.ph = rand(TAU);
      p.f = rand(0.25, 0.6);
      p.amp = rand(3, 8);
      p.s = rand(1, 2.1);
      p.a = rand(0.5, 0.9);
      p.col = rgba('#C3CEAE', p.a);
      p.state = 'iron';
      p.ct = 0;
      p.vy = 0;
      p.vt = 0;
      p.sway = rand(TAU);
      return p;
    }
    function rust(p) {
      p.state = 'rust';
      p.ct = 0;
      p.vy = rand(2, 6);
      p.vt = rand(20, 34);
      rusted++;
      if (pops.length < 40) pops.push({ x: p.x, y: p.y, t: 0 });
      api.sfx.play('tick', { pitch: rand(1.05, 1.5), gap: 55, volume: 0.7 });
      updateStatus();
    }
    function deposit(amount) {
      const top = bands[bands.length - 1];
      if (top && top.type === 'red' && top.th < BAND_RED) {
        top.th += amount;
        dep += amount;
      } else if (top && top.type === 'red') {
        bands.push({ type: 'grey', th: 0, col: GREYS[bands.length % 3] });
        pendingRed += amount;
      } else if (top && top.type === 'grey' && top.th < GREY_TH) {
        pendingRed += amount;
      } else {
        bands.push({ type: 'red', th: amount + pendingRed, col: REDS[bands.length % 4] });
        dep += amount + pendingRed;
        pendingRed = 0;
      }
    }

    /* ---- bulles ---- */
    function emit(m, cap) {
      /* tant qu'il reste du fer à rouiller, la bulle lui est destinée ; sinon elle ira dans l'air */
      if (phase === 'A' && committed < N_IRON) committed += cap;
      else cap = 0;
      if (bubbles.length > 150) {
        if (cap > 0) pool += cap;
        else airUnit(null);
        return;
      }
      const P = contour(m, rand(-0.6, 0.6));
      bubbles.push({
        x: P.x + P.nx * 3, y: P.y + P.ny * 3, r: rand(1.7, 3.6), cap, air: cap === 0,
        sp: rand(55, 75), wob: rand(1.5, 3), ph: rand(TAU), t: 0, dying: false, life: 1,
      });
    }

    function init() {
      mounds = MOUNDS.map(makeMound);
      dep = 0;
      bands = [];
      pendingRed = 0;
      parts = [];
      for (let i = 0; i < N_IRON; i++) parts.push(spawnIron({}));
      bubbles = [];
      queue = [];
      puffs = [];
      ripples = [];
      rings = [];
      pops = [];
      pool = 0;
      poolT = 0;
      rusted = 0;
      committed = 0;
      earlyAir = 0;
      airUnits = 0;
      phase = 'A';
      finished = false;
      passiveT = 0;
      skyT = 0;
      skyS = 0;
      shownPct = -1;
      updateStatus();
      const m = mounds[TALLEST];
      dims(m, m.lam.length - 1);
      api.gesture('tap', { x: m.x * 100, y: ((moundBase(m) - D.h * 0.58) / G.h) * 100 });
    }

    /* ---- interaction ---- */
    function onTap(x, y) {
      rings.push({ x, y, t: 0 });
      if (y < G.seaY + 6) {
        api.sfx.play('pop', { pitch: rand(1.1, 1.4), volume: 0.5 });
        return;
      }
      /* le stromatolithe le plus proche du doigt */
      let best = null, bd = Infinity;
      for (const m of mounds) {
        dims(m, m.lam.length - 1);
        const mx = m.x * G.w, by = moundBase(m);
        const dx = Math.max(0, Math.abs(x - mx) - D.w * 0.7);
        const dy = Math.max(0, (by - D.h) - y) * 0.6;
        const d = Math.hypot(dx, dy);
        if (d < bd) { bd = d; best = m; }
      }
      if (!best) return;
      best.glow = 1;
      grow(best);
      CAPS.forEach((cap, i) => queue.push({ m: best, cap, t: i * 0.065 + rand(0, 0.03) }));
      api.buzz(8);
      api.sfx.play('bubble', { pitch: rand(0.8, 1.35), gap: 40 });
    }

    api.track(cv.canvas, {
      up(p, e, cancelled) {
        if (!cancelled && p.tap) onTap(p.x, p.y);
      },
    }, { touchAction: 'pan-y' });

    function updateStatus() {
      if (phase === 'A') {
        const pct = Math.round(100 * (1 - rusted / N_IRON));
        if (pct !== shownPct) {
          shownPct = pct;
          api.status(TEXTES.fer(pct));
        }
        api.progress(0.7 * clamp(rusted / N_IRON));
      } else if (!finished) {
        api.progress(0.7 + 0.3 * clamp(airUnits / UNITS_B));
      }
    }

    function startPhaseB() {
      phase = 'B';
      pool = 0;
      api.status(TEXTES.air);
      api.hint(TEXTES.consigneAir);
      api.sfx.play('chime', { volume: 0.6 });
      const n = earlyAir;
      earlyAir = 0;
      for (let i = 0; i < n; i++) airUnit(null);
    }

    function airUnit() {
      if (finished) return;
      if (phase === 'A') {
        earlyAir++;
        return;
      }
      airUnits++;
      skyT = clamp(airUnits / UNITS_B);
      updateStatus();
      if (airUnits >= UNITS_B) {
        finished = true;
        api.done(TEXTES.fin, TEXTES.finStatut);
      }
    }

    function escape(b) {
      ripples.push({ x: b.x, t: 0 });
      if (puffs.length < 70) {
        puffs.push({ x: b.x, y: G.seaY - 2, r: b.r * 1.1, vy: rand(26, 44), ph: rand(TAU), t: 0, dur: rand(1.6, 2.6) });
      }
      api.sfx.play('bubble', { pitch: rand(1.3, 1.8), volume: 0.45, gap: 90 });
      airUnit();
    }

    /* ---- animation ---- */
    let skyS = 0;   /* bleu du ciel affiché (suit skyT en douceur) */
    let DT = 0.016;
    function compact(arr, keep) {
      let j = 0;
      for (let i = 0; i < arr.length; i++) if (keep(arr[i])) arr[j++] = arr[i];
      arr.length = j;
    }
    const keepQueue = (q) => {
      q.t -= DT;
      if (q.t > 0) return true;
      emit(q.m, q.cap);
      return false;
    };
    const keepPuff = (p) => {
      p.t += DT;
      p.y -= p.vy * DT;
      p.vy *= Math.pow(0.55, DT);
      p.x += Math.sin(time * 2 + p.ph) * DT * 7 * AMB;
      return p.t < p.dur;
    };
    const keepT = (o) => (o.t += DT) < 0.7;

    function rustRandom() {
      const n = parts.length;
      let i = Math.floor(Math.random() * n);
      for (let k = 0; k < n; k++, i = (i + 1) % n) {
        if (parts[i].state === 'iron') { rust(parts[i]); return; }
      }
    }

    function update(dt) {
      DT = dt;
      time += dt;
      compact(queue, keepQueue);

      /* photosynthèse automatique, très lente */
      passiveT += dt;
      if (passiveT > PASSIVE) {
        passiveT = 0;
        emit(mounds[Math.floor(Math.random() * mounds.length)], 1);
      }

      for (const m of mounds) {
        if (m.glow > 0) m.glow = Math.max(0, m.glow - dt * 1.2);
        const L = m.lam[m.lam.length - 1];
        if (L.k < 1) {
          L.k = Math.min(1, L.k + dt * 2.4);
          m.dirty = true;
        }
        if (m.dirty) renderMound(m);
      }

      /* la bande grise (silice) se dépose doucement entre deux bandes rouges */
      const top = bands[bands.length - 1];
      if (top && top.type === 'grey' && top.th < GREY_TH) {
        const a = Math.min(GREY_TH - top.th, (dt * GREY_TH) / 1.1);
        top.th += a;
        dep += a;
        if (top.th >= GREY_TH && pendingRed > 0) {
          bands.push({ type: 'red', th: pendingRed, col: REDS[bands.length % 4] });
          dep += pendingRed;
          pendingRed = 0;
        }
      }

      /* l'oxygène resté dissous finit par rouiller un peu de fer ailleurs */
      if (phase === 'A' && pool > 0) {
        poolT += dt;
        while (pool > 0 && poolT > 0.05) {
          poolT -= 0.05;
          pool--;
          rustRandom();
        }
      } else {
        poolT = 0;
      }

      for (const p of parts) {
        if (p.state === 'iron') {
          p.x = p.hx + Math.sin(time * p.f + p.ph) * p.amp * AMB;
          p.y = p.hy + Math.cos(time * p.f * 0.8 + p.ph * 1.3) * p.amp * 0.45 * AMB;
        } else if (p.state === 'rust') {
          p.ct += dt;
          p.vy = Math.min(p.vt, p.vy + dt * 24);
          p.y += p.vy * dt;
          p.x += Math.sin(time * 1.3 + p.sway) * dt * 5 * AMB;
          if (p.y >= floorY(p.x) - 0.5) {
            p.state = 'gone';
            deposit(RED_PER);
          }
        }
      }

      let j = 0;
      for (let i = 0; i < bubbles.length; i++) {
        const b = bubbles[i];
        b.t += dt;
        let keep = true;
        if (b.dying) {
          b.life -= dt * 3;
          b.y -= b.sp * 0.4 * dt;
          if (b.life <= 0) keep = false;
        } else {
          b.sp = Math.min(130, b.sp + dt * 40);
          b.y -= b.sp * dt;
          b.x += Math.sin(time * b.wob + b.ph) * dt * 9 * AMB;
          if (phase === 'A' && b.cap > 0) {
            for (const p of parts) {
              if (p.state !== 'iron') continue;
              const dx = p.x - b.x, dy = p.y - b.y;
              if (dx * dx + dy * dy < CONTACT * CONTACT) {
                rust(p);
                b.cap--;
                if (b.cap <= 0) { b.dying = true; break; }
              }
            }
          }
          if (!b.dying && b.y < G.seaY + 3) {
            keep = false;
            if (phase === 'A' && !b.air) {
              pool += b.cap;
              ripples.push({ x: b.x, t: 0, small: true });
            } else {
              escape(b);
            }
          }
        }
        if (keep) bubbles[j++] = b;
      }
      bubbles.length = j;

      compact(puffs, keepPuff);
      compact(ripples, keepT);
      compact(rings, keepT);
      compact(pops, keepT);

      if (phase === 'A' && rusted >= N_IRON) startPhaseB();
      skyS += (skyT - skyS) * (1 - Math.exp(-dt * 1.6));
    }

    /* ---- dessin ---- */
    const surf = new Float32Array(200);
    function render() {
      const { w, h, seaY, S } = G;
      const k = ease.inOutSine(clamp(skyS));

      /* le ciel : brume orange-brun, puis bleu */
      const sg = ctx.createLinearGradient(0, 0, 0, seaY);
      sg.addColorStop(0, css(mixRGB(C.hazeTop, C.blueTop, k)));
      sg.addColorStop(0.6, css(mixRGB(C.hazeMid, C.blueMid, k)));
      sg.addColorStop(1, css(mixRGB(C.hazeHor, C.blueHor, k)));
      ctx.fillStyle = sg;
      ctx.fillRect(0, 0, w, seaY + 6);
      const sc = mixRGB(C.sunHaze, C.sunClear, k);
      const sr = Math.min(w, h) * 0.045;
      glowRGB(ctx, G.sunX, G.sunY, lerp(w * 0.36, w * 0.2, k), sc, lerp(0.34, 0.42, k));
      ctx.fillStyle = css(sc, lerp(0.5, 1, k));
      ctx.beginPath();
      ctx.arc(G.sunX, G.sunY, sr, 0, TAU);
      ctx.fill();
      if (k < 1) {
        const off = (time * 3 * AMB) % w;
        ctx.globalAlpha = 1 - k;
        ctx.drawImage(hazeCv.c, off, 0, w, hazeCv.h);
        ctx.drawImage(hazeCv.c, off - w, 0, w, hazeCv.h);
        ctx.globalAlpha = 1;
      }
      if (k > 0.01) {
        const off = (time * 5 * AMB) % w;
        ctx.globalAlpha = k * 0.85;
        ctx.drawImage(cloudCv.c, off, 0, w, cloudCv.h);
        ctx.drawImage(cloudCv.c, off - w, 0, w, cloudCv.h);
        ctx.globalAlpha = 1;
      }
      /* l'oxygène qui s'échappe dans l'air */
      ctx.lineWidth = 1.2;
      for (const p of puffs) {
        const q = p.t / p.dur;
        const a = (1 - q) * Math.min(1, p.t * 5);
        const r = p.r * (1 + q * 1.6);
        ctx.fillStyle = `rgba(255,255,255,${0.16 * a})`;
        ctx.strokeStyle = `rgba(255,255,255,${0.75 * a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }

      /* la mer : verdâtre tant qu'elle est chargée de fer */
      const clar = clamp(0.6 * (rusted / N_IRON) + 0.4 * k);
      const gg = ctx.createLinearGradient(0, seaY, 0, S);
      gg.addColorStop(0, css(mixRGB(C.seaTopA, C.seaTopB, clar)));
      gg.addColorStop(0.45, css(mixRGB(C.seaMidA, C.seaMidB, clar)));
      gg.addColorStop(1, css(mixRGB(C.seaBotA, C.seaBotB, clar)));
      let n = 0;
      for (let x = 0; x <= w + 8 && n < 198; x += 8) {
        surf[n++] = x;
        surf[n++] = seaY + Math.sin(x * 0.045 + time * 1.6 * AMB) * 1.3 + Math.sin(x * 0.11 - time * 2.3 * AMB) * 0.6;
      }
      ctx.beginPath();
      ctx.moveTo(0, S + 12);
      for (let i = 0; i < n; i += 2) ctx.lineTo(surf[i], surf[i + 1]);
      ctx.lineTo(surf[n - 2], S + 12);
      ctx.closePath();
      ctx.fillStyle = gg;
      ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = lerp(0.55, 1, k) * (0.82 + 0.18 * Math.sin(time * 0.8 * AMB));
      ctx.drawImage(rayCv.c, 0, seaY, w, rayCv.h);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.beginPath();
      for (let i = 0; i < n; i += 2) {
        if (i === 0) ctx.moveTo(surf[i], surf[i + 1]);
        else ctx.lineTo(surf[i], surf[i + 1]);
      }
      ctx.strokeStyle = `rgba(235,255,240,${lerp(0.35, 0.6, k)})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      /* stromatolithes lointains */
      ctx.drawImage(farCv.c, 0, S - farCv.h + 4 - dep * h, w, farCv.h);

      /* fer dissous (gris-vert) et rouille qui coule */
      for (const p of parts) {
        if (p.state === 'iron') {
          ctx.fillStyle = p.col;
          ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s * 0.8);
        } else if (p.state === 'rust') {
          const ci = Math.min(7, Math.floor((p.ct / 0.6) * 7));
          const s = p.s * 1.3;
          ctx.fillStyle = RAMP[ci];
          ctx.beginPath();
          ctx.arc(p.x, p.y, s * 0.62, 0, TAU);
          ctx.fill();
        }
      }

      /* les stromatolithes et leur tapis de cyanobactéries */
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const m of mounds) {
        const c = m.cache;
        if (!c) continue;
        const mx = m.x * w, by = moundBase(m);
        const last = m.lam.length - 1;
        dims(m, last);
        const oh = D.h, ow = D.w, sd = lamSeed(m, last);
        ctx.globalCompositeOperation = 'lighter';
        draw.glow(ctx, mx, by - oh * 0.75, ow * 1.7, '#5FF0C0', 0.07 + 0.42 * m.glow);
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(c.c, mx - c.w / 2, by - (c.h - 2), c.w, c.h);
        ctx.beginPath();
        for (let s = 0; s <= 30; s++) {
          const u = -0.95 + (1.9 * s) / 30;
          const x = mx + u * ow, y = by - oh * prof(u, sd) + 1.2;
          if (s === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = css(mixRGB(C.filA, C.filB, m.glow * 0.55), 0.92);
        ctx.lineWidth = 3.6;
        ctx.stroke();
        ctx.strokeStyle = css(C.filB, 0.22 + 0.5 * m.glow);
        ctx.lineWidth = 1.2;
        ctx.stroke();
        /* filaments qui ondulent */
        ctx.beginPath();
        for (const f of m.fil) {
          const P = contour(m, f.u);
          const sway = Math.sin(time * 2.1 * AMB + f.ph) * 1.8 * AMB;
          const len = f.len * (1 + 0.25 * m.glow);
          ctx.moveTo(P.x, P.y);
          ctx.lineTo(P.x + P.nx * len - P.ny * sway, P.y + P.ny * len + P.nx * sway);
        }
        ctx.strokeStyle = css(mixRGB(C.filA, C.filB, 0.25 + m.glow * 0.6), 0.85);
        ctx.lineWidth = 1.1;
        ctx.stroke();
        ctx.beginPath();
        for (const f of m.fil) {
          if (!f.dot) continue;
          const P = contour(m, f.u);
          const sway = Math.sin(time * 2.1 * AMB + f.ph) * 1.8 * AMB;
          const len = f.len * (1 + 0.25 * m.glow) + 0.6;
          const x = P.x + P.nx * len - P.ny * sway, y = P.y + P.ny * len + P.nx * sway;
          ctx.moveTo(x + 1.3, y);
          ctx.arc(x, y, 1.3, 0, TAU);
        }
        ctx.fillStyle = css(C.filB, 0.55 + 0.45 * m.glow);
        ctx.fill();
      }

      /* le fond : roche en coupe, puis couches rouges et grises (elles cachent le pied des monticules) */
      ctx.drawImage(rockCv.c, 0, S - 6, w, rockCv.h);
      let cum = 0;
      const xEnd = Math.ceil((w + 8) / 8) * 8;
      for (let i = 0; i < bands.length; i++) {
        const b = bands[i];
        if (b.th <= 0) continue;
        ctx.beginPath();
        for (let x = 0; x <= xEnd; x += 8) {
          const y = S + wv(x) - (cum + b.th) * h + bandVar(x, i + 1);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        for (let x = xEnd; x >= 0; x -= 8) ctx.lineTo(x, S + wv(x) - cum * h + bandVar(x, i) + 0.6);
        ctx.closePath();
        ctx.fillStyle = b.col;
        ctx.fill();
        cum += b.th;
      }
      if (dep > 0.001) {
        ctx.save();
        ctx.beginPath();
        for (let x = 0; x <= xEnd; x += 8) {
          const y = floorY(x);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.lineTo(xEnd, S + 4);
        ctx.lineTo(0, S + 4);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(grainCv.c, 0, S - dep * h - 2, w, grainCv.h);
        ctx.restore();
        ctx.beginPath();
        for (let x = 0; x <= xEnd; x += 8) {
          const y = floorY(x) + 0.5;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = 'rgba(255,190,160,0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      /* bulles d'oxygène */
      ctx.lineWidth = 1;
      for (const b of bubbles) {
        const r = b.r * (b.dying ? Math.max(0, b.life) : 1) * Math.min(1, b.t * 6);
        if (r < 0.3) continue;
        ctx.fillStyle = 'rgba(214,250,255,0.22)';
        ctx.strokeStyle = 'rgba(232,255,255,0.85)';
        ctx.beginPath();
        ctx.arc(b.x, b.y, r, 0, TAU);
        ctx.fill();
        ctx.stroke();
        const hs = Math.max(0.8, r * 0.38);
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillRect(b.x - r * 0.45, b.y - r * 0.5, hs, hs);
      }
      /* éclats de rouille, ronds à la surface, anneaux de tape */
      for (const p of pops) {
        const q = p.t / 0.7;
        if (q > 0.55) continue;
        const qq = q / 0.55;
        ctx.strokeStyle = `rgba(255,150,100,${0.8 * (1 - qq)})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2 + 7 * qq, 0, TAU);
        ctx.stroke();
      }
      for (const r of ripples) {
        const q = r.t / 0.7;
        ctx.strokeStyle = `rgba(240,255,250,${(r.small ? 0.35 : 0.7) * (1 - q)})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(r.x, seaY + 1, (r.small ? 3 : 4) + (r.small ? 8 : 14) * q, 1.2 + 2 * q, 0, 0, TAU);
        ctx.stroke();
      }
      for (const r of rings) {
        const q = ease.outCubic(r.t / 0.7);
        ctx.strokeStyle = `rgba(220,255,240,${0.75 * (1 - r.t / 0.7)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(r.x, r.y, 8 + 30 * q, 0, TAU);
        ctx.stroke();
      }
    }

    api.loop((dt) => {
      update(dt);
      render();
    });

    api.onReset(init);
    init();
    update(0.016);
    render();
  };
})();
