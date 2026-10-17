/* Quand les continents bougent. Sur une carte ancienne centrée sur le pôle Sud, on éloigne l'Amérique
   du Sud puis l'Australie de l'Antarctique : un courant se met à tourner tout autour du pôle, les eaux
   chaudes sont déviées, le CO2 de l'air baisse et la glace recouvre le continent. Puis la carte bascule
   vers l'Asie : l'Inde remonte, percute l'Asie, l'Himalaya se plisse et la mousson ronge ses pentes. */
(function () {
  'use strict';
  const { lib } = window.RM;
  const { TAU, rand, clamp, lerp, ease, draw } = lib;

  /* Tous les textes du jeu, faciles à corriger */
  const TEXTES = {
    consigneAU: 'Éloigne maintenant l’Australie.',
    regardeCourant: 'Regarde le courant faire le tour de l’Antarctique.',
    passage1: 'Un passage s’ouvre entre l’Amérique du Sud et l’Antarctique.',
    passage2: 'Un deuxième passage s’ouvre, entre l’Australie et l’Antarctique.',
    glace: 'Le CO2 baisse et un courant isole l’Antarctique des eaux chaudes : il se couvre de glace.',
    consigneInde: 'Fais remonter l’Inde jusqu’à l’Asie.',
    approche: 'L’Inde remonte vers l’Asie.',
    choc: 'Choc ! L’Inde pousse contre l’Asie : l’Himalaya se plisse et monte.',
    regardeMousson: 'Regarde la mousson arroser les montagnes.',
    himalaya: 'Selon certains chercheurs, l’usure de l’Himalaya a avalé beaucoup de CO2 : la Terre se refroidit lentement.',
    fin: 'Les continents ont bougé, et la Terre s’est refroidie.',
    finStatut: 'La baisse du CO2, un courant autour de l’Antarctique, de nouvelles montagnes : la géographie change le climat.',
    jauge: 'CO2',
  };

  const C_LAND = { base: '#D6CB9C', rim: '#9C8A5A' };
  const C_ANT = { base: '#A9B47A', rim: '#6F7B47' };
  const C_IND = { base: '#D7BA86', rim: '#A07E4E' };
  const INK = '#5E4A30';
  const WARM = '#D45F2A';
  const COLD = '#1F6FA8';

  const smooth = (t) => t * t * (3 - 2 * t);
  function seeded(seed) {
    let s = seed >>> 0 || 1;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }
  const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

  /* Courbe fermée et douce qui passe près d'une liste de points [x0, y0, x1, y1, …] */
  function smoothClosed(g, pts) {
    const N = pts.length / 2;
    g.moveTo((pts[0] + pts[2 * N - 2]) / 2, (pts[1] + pts[2 * N - 1]) / 2);
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      g.quadraticCurveTo(pts[2 * i], pts[2 * i + 1], (pts[2 * i] + pts[2 * j]) / 2, (pts[2 * i + 1] + pts[2 * j + 1]) / 2);
    }
    g.closePath();
  }

  /* Formes simplifiées (originales) des continents, en unités locales */
  const SA_PTS = [0, 0, 0.1, -0.06, 0.28, -0.1, 0.5, -0.15, 0.72, -0.22, 0.92, -0.32, 1.1, -0.46, 1.28, -0.58, 1.48, -0.62,
    1.68, -0.57, 1.86, -0.44, 2.0, -0.25, 2.06, -0.04, 2.0, 0.12, 1.84, 0.2, 1.6, 0.22, 1.34, 0.2, 1.1, 0.17, 0.86, 0.14,
    0.62, 0.12, 0.4, 0.09, 0.2, 0.06, 0.08, 0.03];
  const AU_PTS = [-0.62, 0.05, -0.55, -0.18, -0.38, -0.33, -0.12, -0.38, 0.05, -0.3, 0.12, -0.42, 0.26, -0.36, 0.45, -0.28,
    0.6, -0.1, 0.62, 0.12, 0.5, 0.27, 0.22, 0.32, 0.08, 0.25, -0.1, 0.33, -0.35, 0.3, -0.55, 0.22];
  const IN_PTS = [-0.36, -0.22, -0.2, -0.3, 0.0, -0.335, 0.2, -0.3, 0.34, -0.25, 0.3, -0.12, 0.25, 0.0, 0.18, 0.12, 0.11, 0.24,
    0.05, 0.35, 0.01, 0.44, -0.05, 0.36, -0.1, 0.24, -0.15, 0.1, -0.2, -0.02, -0.3, -0.04, -0.39, -0.1, -0.33, -0.15, -0.39, -0.18];
  const AS_PTS = [-3.2, -0.3, -2.2, -0.3, -1.75, -0.24, -1.5, -0.16, -1.38, -0.02, -1.26, 0.06, -1.12, 0.05, -1.02, -0.08,
    -0.94, -0.22, -0.82, -0.32, -0.7, -0.36, -0.58, -0.42, -0.46, -0.45, -0.36, -0.5, -0.22, -0.52, -0.08, -0.545, 0.06, -0.55,
    0.2, -0.53, 0.32, -0.5, 0.42, -0.45, 0.5, -0.41, 0.58, -0.4, 0.66, -0.32, 0.7, -0.2, 0.73, -0.06, 0.77, 0.08, 0.8, 0.22,
    0.84, 0.24, 0.86, 0.12, 0.9, 0.0, 0.96, -0.1, 1.05, -0.2, 1.2, -0.26, 1.4, -0.3, 1.65, -0.27, 1.9, -0.32, 3.2, -0.34,
    3.2, -3, -3.2, -3];

  const CSS = `
.game[data-game="geographie"] .ge-grab { position: absolute; left: 0; top: 0; z-index: 2; border-radius: 50%; cursor: grab; touch-action: none; }
.game[data-game="geographie"] .ge-grab:active { cursor: grabbing; }
.game[data-game="geographie"] .ge-grab[hidden] { display: none; }
.game[data-game="geographie"] .gesture-dot { box-shadow: 0 0 0 6px rgba(255, 255, 255, 0.4), 0 0 0 15px rgba(18, 52, 84, 0.42), 0 4px 14px rgba(0, 0, 0, 0.35); }
.game[data-game="geographie"] .gesture-ring { border-color: rgba(18, 52, 84, 0.85); }
.game[data-game="geographie"] .ge-co2 {
  position: absolute; left: 12px; bottom: 12px; z-index: 3; width: 48px; padding: 8px 0 9px;
  display: grid; justify-items: center; gap: 6px; pointer-events: none;
  background: rgba(247, 243, 232, 0.93); color: #1F2A33; border-radius: 15px 17px 14px 16px;
  box-shadow: 0 0 0 1px rgba(31, 42, 51, 0.2), 0 8px 16px -10px rgba(31, 42, 51, 0.6);
  font: 800 0.8125rem/1 var(--font-text);
}
.game[data-game="geographie"] .ge-co2-tube {
  position: relative; width: 16px; height: 66px; border-radius: 9px; overflow: hidden;
  background: rgba(31, 42, 51, 0.07); box-shadow: inset 0 0 0 1.5px rgba(31, 42, 51, 0.38);
}
.game[data-game="geographie"] .ge-co2-tube i {
  position: absolute; left: 2px; right: 2px; bottom: 2px; height: calc(var(--lvl, 0.8) * (100% - 4px));
  border-radius: 7px; background: linear-gradient(#E58A4A, #C2502A);
}
.game[data-game="geographie"] .ge-co2.is-down .ge-co2-tube i { animation: ge-pulse 0.9s ease-in-out infinite; }
@keyframes ge-pulse { 50% { filter: brightness(1.25); } }
`;

  window.RM.games.geographie = function (api) {
    const cv = api.canvas();
    const ctx = cv.ctx;
    const AMB = api.reducedMotion ? 0.3 : 1;
    api.style(CSS);

    /* ---- la jauge de CO2 (DOM) ---- */
    const gauge = document.createElement('div');
    gauge.className = 'ge-co2';
    gauge.setAttribute('aria-hidden', 'true');
    gauge.innerHTML = '<span></span><span class="ge-co2-tube"><i></i></span>';
    gauge.firstChild.textContent = TEXTES.jauge;
    api.stage.appendChild(gauge);
    let shownLvl = -1, downT = 0;
    function setGauge(v, dt) {
      const q = Math.round(v * 400) / 400;
      if (q < shownLvl - 1e-6) downT = 0.6;
      else downT = Math.max(0, downT - dt);
      gauge.classList.toggle('is-down', downT > 0);
      if (q === shownLvl) return;
      shownLvl = q;
      gauge.style.setProperty('--lvl', q.toFixed(4));
    }

    /* ---- poignées pour glisser les continents (le reste de la scène laisse défiler la page) ---- */
    function makeGrab() {
      const el = document.createElement('div');
      el.className = 'ge-grab';
      el.setAttribute('aria-hidden', 'true');
      el.hidden = true;
      api.stage.appendChild(el);
      return { el, x: -1, y: -1, r: -1 };
    }
    const grabSA = makeGrab(), grabAU = makeGrab(), grabIN = makeGrab();
    function placeGrab(gb, x, y, r, show) {
      if (gb.el.hidden === show) gb.el.hidden = !show;
      if (!show) return;
      x = clamp(x, r * 0.6, G.w - r * 0.6);
      y = clamp(y, r * 0.6, G.h - r * 0.6);
      if (Math.abs(x - gb.x) < 0.5 && Math.abs(y - gb.y) < 0.5 && r === gb.r) return;
      gb.x = x;
      gb.y = y;
      if (r !== gb.r) {
        gb.r = r;
        gb.el.style.width = gb.el.style.height = 2 * r + 'px';
      }
      gb.el.style.transform = `translate(${(x - r).toFixed(1)}px, ${(y - r).toFixed(1)}px)`;
    }

    /* ---- géométrie ---- */
    const G = { w: 1, h: 1 };
    let bg1 = null, bg2 = null, paper = null, landNoise = null;
    let sprSA = null, sprAU = null, sprAN = null, sprIN = null, cloudSpr = null;
    let pathAN = null, pathSA = null, pathAU = null, pathIN = null;

    function mk(wc, hc) {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(wc * cv.dpr));
      c.height = Math.max(1, Math.round(hc * cv.dpr));
      const g = c.getContext('2d');
      g.scale(cv.dpr, cv.dpr);
      return { c, g, w: wc, h: hc };
    }

    function antR(a) {
      const t = G.thS;
      return 1 + 0.1 * Math.sin(2 * a + 0.6) + 0.07 * Math.sin(3 * a - 1.2) + 0.04 * Math.sin(5 * a + 2)
        + 0.36 * Math.exp(-Math.pow(wrapA(a - t) / 0.1, 2))
        - 0.22 * Math.exp(-Math.pow(wrapA(a - t - 0.5) / 0.22, 2))
        - 0.2 * Math.exp(-Math.pow(wrapA(a - t - Math.PI - 0.4) / 0.28, 2));
    }

    function geometry(w, h) {
      G.w = w;
      G.h = h;
      G.U = Math.min(w, h) / 2;
      /* étape 1 : vue de dessus, centrée sur le pôle Sud */
      G.cx = w / 2;
      G.cy = h * 0.48;
      G.RA = G.U * 0.4;
      G.thS = -2.25;
      G.thA = 0.8;
      G.dSA = G.RA * 1.47;
      G.mSA = G.RA * 0.62;
      G.dAU = G.RA * 1.5;
      G.mAU = G.RA * 0.75;
      G.ring = G.RA * 1.62;
      /* étape 2 : l'Asie et l'Inde (carte un peu plus rapprochée) */
      G.ax = w / 2;
      G.ay = h / 2;
      G.U2 = Math.min(w * 0.62, h * 0.56);
      G.in0 = 0.44;     /* centre de l'Inde au départ (unités) */
      G.in1 = -0.2;     /* centre de l'Inde quand elle touche l'Asie */
      G.base = G.ay + (G.in1 - 0.31) * G.U2;   /* pied de l'Himalaya */
      buildPaths();
      landNoise = buildLandNoise();
      paper = buildPaper();
      bg1 = buildBg1();
      bg2 = buildBg2();
      sprAN = landSprite(pathAN, C_ANT, 3, forest);
      sprSA = landSprite(pathSA, C_LAND, 5, andes);
      sprAU = landSprite(pathAU, C_LAND, 7);
      sprIN = landSprite(pathIN, C_IND, 11);
      cloudSpr = buildCloud();
      buildWarm();
    }

    function buildPaths() {
      const { cx, cy, RA } = G;
      const pts = [];
      for (let i = 0; i < 90; i++) {
        const a = (i / 90) * TAU;
        const r = antR(a) * RA;
        pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      pathAN = new Path2D();
      smoothClosed(pathAN, pts);
      G.penX = cx + Math.cos(G.thS) * antR(G.thS) * RA * 0.97;
      G.penY = cy + Math.sin(G.thS) * antR(G.thS) * RA * 0.97;
      /* Amérique du Sud : la pointe tournée vers le pôle */
      const cs = Math.cos(G.thS), sn = Math.sin(G.thS);
      const ox = cx + cs * G.dSA, oy = cy + sn * G.dSA;
      const sa = [];
      for (let i = 0; i < SA_PTS.length; i += 2) {
        const lx = SA_PTS[i] * RA, ly = SA_PTS[i + 1] * RA;
        sa.push(ox + lx * cs - ly * sn, oy + lx * sn + ly * cs);
      }
      pathSA = new Path2D();
      smoothClosed(pathSA, sa);
      G.saTipX = ox;
      G.saTipY = oy;
      G.saCx = ox + cs * RA * 0.95;
      G.saCy = oy + sn * RA * 0.95;
      G.saPts = sa;
      /* Australie : son côté plat tourné vers le pôle */
      const rho = G.thA + Math.PI / 2;
      const ca = Math.cos(rho), sa2 = Math.sin(rho);
      const ax = cx + Math.cos(G.thA) * G.dAU, ay = cy + Math.sin(G.thA) * G.dAU;
      const au = [];
      for (let i = 0; i < AU_PTS.length; i += 2) {
        const lx = AU_PTS[i] * RA * 1.15, ly = AU_PTS[i + 1] * RA * 1.15;
        au.push(ax + lx * ca - ly * sa2, ay + lx * sa2 + ly * ca);
      }
      pathAU = new Path2D();
      smoothClosed(pathAU, au);
      /* une petite île, entre l'Australie et l'Antarctique */
      const tas = [];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        const lx = (0.22 + Math.cos(a) * 0.09 * (1 + 0.2 * Math.sin(a * 3))) * RA * 1.15;
        const ly = (0.47 + Math.sin(a) * 0.07) * RA * 1.15;
        tas.push(ax + lx * ca - ly * sa2, ay + lx * sa2 + ly * ca);
      }
      smoothClosed(pathAU, tas);
      G.auX = ax;
      G.auY = ay;
      G.auRho = rho;
      /* l'Inde, et une petite île au bout */
      /* (dessinée à sa place finale, contre l'Asie : au départ, on la décale vers le bas) */
      const U2 = G.U2;
      const ip = [];
      for (let i = 0; i < IN_PTS.length; i += 2) ip.push(G.ax + IN_PTS[i] * U2, G.ay + (IN_PTS[i + 1] + G.in1) * U2);
      pathIN = new Path2D();
      smoothClosed(pathIN, ip);
      const sl = [];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        sl.push(G.ax + (0.1 + Math.cos(a) * 0.032) * U2, G.ay + (0.46 + G.in1 + Math.sin(a) * 0.05) * U2);
      }
      smoothClosed(pathIN, sl);
    }

    function buildLandNoise() {
      const { w, h } = G;
      const W2 = Math.ceil(w / 2) + 1, H2 = Math.ceil(h / 2) + 1;
      const t = document.createElement('canvas');
      t.width = W2;
      t.height = H2;
      const tg = t.getContext('2d');
      const img = tg.createImageData(W2, H2);
      const n = lib.makeNoise(19);
      for (let y = 0; y < H2; y++) {
        for (let x = 0; x < W2; x++) {
          const v = n.fbm(x / 14, y / 14, 4);
          const g2 = n.fbm(x / 40 + 9, y / 40, 2);
          const j = (y * W2 + x) * 4;
          /* vert dans les creux, ocre sur les reliefs */
          const k = clamp((g2 - 0.42) * 2.2);
          img.data[j] = lerp(126, 196, k);
          img.data[j + 1] = lerp(146, 160, k);
          img.data[j + 2] = lerp(86, 100, k);
          img.data[j + 3] = 255 * clamp(0.1 + Math.abs(v - 0.5) * 0.9) * 0.55;
        }
      }
      tg.putImageData(img, 0, 0);
      return t;
    }

    /* Le papier : taches douces et bords un peu plus sombres, comme une vieille carte */
    function buildPaper() {
      const { w, h } = G;
      const R = mk(w, h);
      const g = R.g;
      const W2 = Math.ceil(w / 3) + 1, H2 = Math.ceil(h / 3) + 1;
      const t = document.createElement('canvas');
      t.width = W2;
      t.height = H2;
      const tg = t.getContext('2d');
      const img = tg.createImageData(W2, H2);
      const n = lib.makeNoise(77);
      for (let y = 0; y < H2; y++) {
        for (let x = 0; x < W2; x++) {
          const v = n.fbm(x / 13, y / 13, 4);
          const j = (y * W2 + x) * 4;
          img.data[j] = 160;
          img.data[j + 1] = 140;
          img.data[j + 2] = 105;
          img.data[j + 3] = 255 * clamp((v - 0.48) * 0.42);
        }
      }
      tg.putImageData(img, 0, 0);
      g.imageSmoothingEnabled = true;
      g.drawImage(t, 0, 0, W2 * 3, H2 * 3);
      const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.62);
      vg.addColorStop(0, 'rgba(120,100,70,0)');
      vg.addColorStop(1, 'rgba(120,100,70,0.28)');
      g.fillStyle = vg;
      g.fillRect(0, 0, w, h);
      return R;
    }

    function oceanBase(g) {
      const { w, h } = G;
      const gr = g.createRadialGradient(w / 2, h * 0.45, 10, w / 2, h / 2, Math.hypot(w, h) * 0.6);
      gr.addColorStop(0, '#C9E3F0');
      gr.addColorStop(1, '#A7CADF');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
      /* le grain du vieux papier, cuit une fois pour toutes dans le fond */
      g.globalCompositeOperation = 'multiply';
      g.drawImage(paper.c, 0, 0, w, h);
      g.globalCompositeOperation = 'source-over';
    }

    function buildBg1() {
      const { w, h, cx, cy, RA } = G;
      const R = mk(w, h);
      const g = R.g;
      oceanBase(g);
      /* graticule polaire */
      g.strokeStyle = 'rgba(31,70,104,0.17)';
      g.lineWidth = 1;
      for (let k = 1; k <= 5; k++) {
        g.beginPath();
        g.arc(cx, cy, RA * 0.95 * k, 0, TAU);
        g.stroke();
      }
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * TAU;
        g.beginPath();
        g.moveTo(cx + Math.cos(a) * RA * 0.3, cy + Math.sin(a) * RA * 0.3);
        g.lineTo(cx + Math.cos(a) * Math.hypot(w, h), cy + Math.sin(a) * Math.hypot(w, h));
        g.stroke();
      }
      /* petites vagues gravées */
      const r = seeded(31);
      g.strokeStyle = 'rgba(31,70,104,0.14)';
      for (let i = 0; i < 26; i++) {
        const x = r() * w, y = r() * h;
        if (Math.hypot(x - cx, y - cy) < RA * 1.9) continue;
        g.beginPath();
        g.moveTo(x, y);
        g.quadraticCurveTo(x + 4, y - 3, x + 8, y);
        g.quadraticCurveTo(x + 12, y + 3, x + 16, y);
        g.stroke();
      }
      return R;
    }

    function buildBg2() {
      const { w, h, ax, ay } = G;
      const U = G.U2;
      const R = mk(w, h);
      const g = R.g;
      oceanBase(g);
      g.strokeStyle = 'rgba(31,70,104,0.15)';
      g.lineWidth = 1;
      const step = U * 0.45;
      for (let x = ax - Math.ceil(ax / step) * step; x <= w; x += step) {
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x, h);
        g.stroke();
      }
      for (let y = ay - Math.ceil(ay / step) * step; y <= h; y += step) {
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(w, y);
        g.stroke();
      }
      const r = seeded(32);
      g.strokeStyle = 'rgba(31,70,104,0.14)';
      for (let i = 0; i < 22; i++) {
        const x = r() * w, y = ay + r() * (h - ay);
        g.beginPath();
        g.moveTo(x, y);
        g.quadraticCurveTo(x + 4, y - 3, x + 8, y);
        g.quadraticCurveTo(x + 12, y + 3, x + 16, y);
        g.stroke();
      }
      /* l'Asie */
      const pts = [];
      for (let i = 0; i < AS_PTS.length; i += 2) pts.push(ax + AS_PTS[i] * U, ay + AS_PTS[i + 1] * U);
      const pa = new Path2D();
      smoothClosed(pa, pts);
      paintLand(g, pa, C_LAND, 13);
      /* quelques vieilles collines, loin de l'endroit du choc */
      const hills = [[-0.95, -0.46], [-0.8, -0.62], [-1.12, -0.36], [0.82, -0.46], [0.98, -0.38], [0.7, -0.66], [-0.5, -0.8], [0.45, -0.85]];
      for (const [hx, hy] of hills) hill(g, ax + hx * U, ay + hy * U, U * 0.045, U * 0.04, 0);
      /* rose des vents */
      const rr = Math.max(18, G.U * 0.14);
      rose(g, w - rr * 1.45, h - rr * 1.45, rr);
      return R;
    }

    function rose(g, x, y, r) {
      g.save();
      g.translate(x, y);
      g.globalAlpha = 0.75;
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU - Math.PI / 2;
        const L = k % 2 ? r * 0.55 : r;
        const wd = r * (k % 2 ? 0.12 : 0.17);
        for (const side of [-1, 1]) {
          g.beginPath();
          g.moveTo(0, 0);
          g.lineTo(Math.cos(a) * L, Math.sin(a) * L);
          g.lineTo(Math.cos(a + side * Math.PI / 2) * wd, Math.sin(a + side * Math.PI / 2) * wd);
          g.closePath();
          g.fillStyle = side < 0 ? '#C2502A' : '#F3E6CC';
          g.fill();
          g.strokeStyle = INK;
          g.lineWidth = 0.8;
          g.stroke();
        }
      }
      g.beginPath();
      g.arc(0, 0, r * 0.12, 0, TAU);
      g.fillStyle = '#F3E6CC';
      g.fill();
      g.stroke();
      g.beginPath();
      g.arc(0, 0, r * 0.72, 0, TAU);
      g.strokeStyle = 'rgba(94,74,48,0.45)';
      g.stroke();
      g.restore();
    }

    /* une colline ou une montagne à l'ancienne : un profil éclairé à gauche */
    function hill(g, x, y, wd, ht, snow) {
      g.beginPath();
      g.moveTo(x - wd, y);
      g.quadraticCurveTo(x - wd * 0.35, y - ht * 0.6, x - wd * 0.05, y - ht);
      g.quadraticCurveTo(x + wd * 0.4, y - ht * 0.55, x + wd, y);
      g.closePath();
      g.fillStyle = '#E3D2A8';
      g.fill();
      g.beginPath();
      g.moveTo(x - wd * 0.05, y - ht);
      g.quadraticCurveTo(x + wd * 0.4, y - ht * 0.55, x + wd, y);
      g.lineTo(x + wd * 0.1, y);
      g.closePath();
      g.fillStyle = '#A88A5C';
      g.fill();
      if (snow > 0) {
        g.save();
        g.globalAlpha = snow;
        g.beginPath();
        g.moveTo(x - wd * 0.05, y - ht);
        g.quadraticCurveTo(x - wd * 0.2, y - ht * 0.82, x - wd * 0.34, y - ht * 0.62);
        g.lineTo(x - wd * 0.12, y - ht * 0.7);
        g.lineTo(x + wd * 0.06, y - ht * 0.6);
        g.lineTo(x + wd * 0.2, y - ht * 0.7);
        g.quadraticCurveTo(x + wd * 0.12, y - ht * 0.85, x - wd * 0.05, y - ht);
        g.fillStyle = '#FFFFFF';
        g.fill();
        g.restore();
      }
      g.beginPath();
      g.moveTo(x - wd, y);
      g.quadraticCurveTo(x - wd * 0.35, y - ht * 0.6, x - wd * 0.05, y - ht);
      g.quadraticCurveTo(x + wd * 0.4, y - ht * 0.55, x + wd, y);
      g.strokeStyle = INK;
      g.lineWidth = 1;
      g.stroke();
    }

    /* Peint une terre : halo d'eau peu profonde, papier teinté, ombre du rivage, trait d'encre */
    function paintLand(g, path, cols, seed, extra) {
      g.save();
      g.shadowColor = 'rgba(31,111,168,0.5)';
      g.shadowBlur = 12;
      g.fillStyle = cols.base;
      g.fill(path);
      g.restore();
      g.save();
      g.clip(path);
      g.drawImage(landNoise, 0, 0, G.w + 2, G.h + 2);
      g.globalAlpha = 0.45;
      g.strokeStyle = cols.rim;
      g.lineWidth = 9;
      g.stroke(path);
      g.globalAlpha = 1;
      const r = seeded(seed);
      for (let i = 0; i < 60; i++) {
        g.fillStyle = `rgba(94,74,48,${0.08 + r() * 0.12})`;
        g.fillRect(r() * G.w, r() * G.h, 1, 1);
      }
      if (extra) extra(g);
      g.restore();
      g.strokeStyle = INK;
      g.lineWidth = 1.4;
      g.stroke(path);
    }
    function landSprite(path, cols, seed, extra) {
      const R = mk(G.w, G.h);
      paintLand(R.g, path, cols, seed, extra);
      return R;
    }
    /* la cordillère le long de la côte ouest de l'Amérique du Sud */
    function andes(g) {
      const cs = Math.cos(G.thS), sn = Math.sin(G.thS);
      for (let k = 0; k < 6; k++) {
        const lx = (0.42 + k * 0.27) * G.RA, ly = 0.02 * G.RA;
        const x = G.saTipX + lx * cs - ly * sn, y = G.saTipY + lx * sn + ly * cs;
        hill(g, x, y, G.RA * 0.085, G.RA * 0.1, 0);
      }
    }
    /* avant la glace : un continent vert, avec des forêts et des lacs */
    function forest(g) {
      const r = seeded(44);
      const { cx, cy, RA } = G;
      for (let i = 0; i < 70; i++) {
        const a = r() * TAU, d = Math.sqrt(r()) * RA * 0.95;
        const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
        g.fillStyle = r() < 0.8 ? `rgba(70,96,52,${0.35 + r() * 0.3})` : 'rgba(31,111,168,0.35)';
        g.beginPath();
        g.arc(x, y, 1.4 + r() * 1.8, 0, TAU);
        g.fill();
      }
    }

    function buildCloud() {
      const CW = Math.max(44, Math.round(G.U2 * 0.3)), CH = Math.round(CW * 0.55);
      const R = mk(CW, CH);
      const g = R.g;
      const r = seeded(21);
      const blobs = [];
      for (let i = 0; i < 6; i++) {
        const t = (i + 0.5) / 6;
        const br = CH * (0.2 + 0.2 * Math.sin(t * Math.PI) + r() * 0.06);
        blobs.push([CW * (0.14 + 0.72 * t), CH * 0.66 - br * 0.6, br]);
      }
      g.save();
      g.shadowColor = 'rgba(31,70,104,0.35)';
      g.shadowBlur = 6;
      g.shadowOffsetY = 2;
      g.fillStyle = '#FBFCFD';
      g.beginPath();
      for (const [x, y, rr] of blobs) {
        g.moveTo(x + rr, y);
        g.arc(x, y, rr, 0, TAU);
      }
      g.fill();
      g.restore();
      g.strokeStyle = 'rgba(94,74,48,0.55)';
      g.lineWidth = 1;
      g.beginPath();
      for (const [x, y, rr] of blobs) {
        g.moveTo(x + rr, y);
        g.arc(x, y, rr, 0, TAU);
      }
      g.stroke();
      g.fillStyle = '#FBFCFD';
      g.beginPath();
      for (const [x, y, rr] of blobs) {
        g.moveTo(x + rr - 1.2, y);
        g.arc(x, y, rr - 1.2, 0, TAU);
      }
      g.fill();
      const sh = g.createLinearGradient(0, CH * 0.3, 0, CH * 0.85);
      sh.addColorStop(0, 'rgba(160,180,195,0)');
      sh.addColorStop(1, 'rgba(160,180,195,0.55)');
      g.fillStyle = sh;
      g.fill();
      R.CW = CW;
      R.CH = CH;
      return R;
    }

    /* ---- les courants chauds : ils descendent vers l'Antarctique, puis sont déviés ---- */
    let warm = [];
    function buildWarm() {
      const { w, h, cx, cy, RA } = G;
      const starts = [[w * 1.02, h * 0.06, -0.6], [-w * 0.02, h * 0.3, -2.9], [w * 0.3, h * 1.02, 2.0], [w * 1.02, h * 0.42, 0.15]];
      warm = starts.map(([sx, sy, a]) => {
        const ex = cx + Math.cos(a) * RA * 1.12, ey = cy + Math.sin(a) * RA * 1.12;
        /* une fois déviés : ils tournent avant l'anneau et repartent le long de lui */
        const t = a + 0.75;
        const dx = cx + Math.cos(t) * G.ring * 1.3, dy = cy + Math.sin(t) * G.ring * 1.3;
        const mx = cx + Math.cos(a) * G.ring * 1.25, my = cy + Math.sin(a) * G.ring * 1.25;
        return { sx, sy, ex, ey, dx, dy, mx, my, c1x: lerp(sx, ex, 0.4) + (sy - ey) * 0.12, c1y: lerp(sy, ey, 0.4) - (sx - ex) * 0.12 };
      });
    }

    /* ---- état ---- */
    let step = 1;
    let sepSA = 0, sepSAT = 0, sepAU = 0, sepAUT = 0, openSA = false, openAU = false;
    let p1T = -1, ringK = 0, defK = 0, iceK = 0, transT = -1;
    let indK = 0, indKT = 0, dockT = -1, hK = 0, cloudK = 0, rainK = 0, eroK = 0;
    let lvl = 0.8, finished = false, shake = 0, time = 0, bridgeSnap = 0, statusSet = '';
    let grab = null, rings = [], sparks = [], silt = [];

    function setStatus(t) {
      if (statusSet === t) return;
      statusSet = t;
      api.status(t);
    }

    /* ---- gestes ---- */
    function stagePos(e) {
      const r = api.stage.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    }
    function bindGrab(gb, which) {
      api.track(gb.el, {
        down(p, e) {
          const [x, y] = stagePos(e);
          rings.push({ x, y, t: 0 });
          grab = { which, x0: x, y0: y, s0: which === 'SA' ? sepSAT : which === 'AU' ? sepAUT : indKT, moved: false };
          api.sfx.play('tick', { pitch: 1.2, volume: 0.5 });
          api.buzz(8);
        },
        move(p, e) {
          if (!grab || grab.which !== which) return;
          const [x, y] = stagePos(e);
          const dx = x - grab.x0, dy = y - grab.y0;
          if (Math.hypot(dx, dy) > 10) grab.moved = true;
          if (which === 'SA' && !openSA) {
            const proj = dx * Math.cos(G.thS) + dy * Math.sin(G.thS);
            sepSAT = clamp(grab.s0 + proj / G.mSA, 0, 1);
          } else if (which === 'AU' && openSA && !openAU) {
            const proj = dx * Math.cos(G.thA) + dy * Math.sin(G.thA);
            sepAUT = clamp(grab.s0 + proj / G.mAU, 0, 1);
          } else if (which === 'IN' && step === 2 && dockT < 0) {
            indKT = clamp(grab.s0 + -dy / ((G.in0 - G.in1) * G.U2), 0, 1);
          }
        },
        up(p, e, cancelled) {
          const gr = grab;
          grab = null;
          if (!gr || cancelled) return;
          if (p.tap) {
            tapContinent(which);
            return;
          }
          /* bien lancé ? le continent finit seul son voyage */
          if (which === 'SA' && !openSA && sepSAT - gr.s0 > 0.2) sepSAT = 1;
          else if (which === 'AU' && openSA && !openAU && sepAUT - gr.s0 > 0.2) sepAUT = 1;
          else if (which === 'IN' && step === 2 && dockT < 0 && indKT - gr.s0 > 0.2) indKT = 1;
          else return;
          api.sfx.play('whoosh', { pitch: 1.1, volume: 0.4 });
        },
      }, { touchAction: 'none' });
    }
    bindGrab(grabSA, 'SA');
    bindGrab(grabAU, 'AU');
    bindGrab(grabIN, 'IN');

    /* une tape fait avancer le continent d'un tiers du chemin */
    function tapContinent(which) {
      if (which === 'SA' && !openSA) sepSAT = Math.min(1, sepSAT + 0.34);
      else if (which === 'AU') {
        if (!openSA) {
          api.sfx.play('tick', { pitch: 0.7 });
          gestureSA();
          return;
        }
        if (!openAU) sepAUT = Math.min(1, sepAUT + 0.34);
      } else if (which === 'IN' && step === 2 && dockT < 0) indKT = Math.min(1, indKT + 0.34);
      api.sfx.play('whoosh', { pitch: 1.3, volume: 0.35 });
    }

    /* une tape à côté compte aussi, si elle vise à peu près le bon continent */
    api.track(cv.canvas, {
      down(p) {
        rings.push({ x: p.x, y: p.y, t: 0 });
      },
      up(p, e, cancelled) {
        if (cancelled || !p.tap) return;
        const near = (gb) => !gb.el.hidden && Math.hypot(p.x - gb.x, p.y - gb.y) < gb.r * 1.7;
        if (step === 1 && transT < 0 && !openSA && near(grabSA)) tapContinent('SA');
        else if (step === 1 && transT < 0 && openSA && !openAU && near(grabAU)) tapContinent('AU');
        else if (step === 2 && dockT < 0 && p.y > G.base + G.U2 * 0.05) tapContinent('IN');
        else api.sfx.play('tick', { pitch: 0.9, volume: 0.5 });
      },
    }, { touchAction: 'pan-y' });

    function gestureSA() {
      const cs = Math.cos(G.thS), sn = Math.sin(G.thS);
      const x = G.saTipX + cs * G.RA * 0.55, y = G.saTipY + sn * G.RA * 0.55;
      api.gesture('drag', { x: (x / G.w) * 100, y: (y / G.h) * 100, dx: Math.round(cs * 70), dy: Math.round(sn * 70) });
    }
    function gestureAU() {
      const cs = Math.cos(G.thA), sn = Math.sin(G.thA);
      api.gesture('drag', { x: (G.auX / G.w) * 100, y: (G.auY / G.h) * 100, dx: Math.round(cs * 70), dy: Math.round(sn * 70) });
    }
    function gestureIN() {
      const y = G.ay + (G.in0 - 0.05) * G.U2;
      api.gesture('drag', { x: (G.ax / G.w) * 100, y: (y / G.h) * 100, dx: 0, dy: -Math.round(G.U2 * 0.45) });
    }

    /* ---- animation ---- */
    function update(dt) {
      time += dt;
      shake = Math.max(0, shake - dt);
      bridgeSnap = Math.max(0, bridgeSnap - dt);
      const kf = 1 - Math.exp(-dt * (grab ? 14 : 6));
      sepSA += (sepSAT - sepSA) * kf;
      sepAU += (sepAUT - sepAU) * kf;
      indK += (indKT - indK) * kf;

      if (step === 1) {
        if (!openSA && sepSA >= 0.6) {
          openSA = true;
          sepSAT = 1;
          bridgeSnap = 0.6;
          api.status(TEXTES.passage1);
          statusSet = TEXTES.passage1;
          api.hint(TEXTES.consigneAU);
          api.progress(0.3);
          api.sfx.play('crack', { pitch: 0.9 });
          api.sfx.play('splash');
          api.buzz(12);
          for (let i = 0; i < 14; i++) sparks.push({ x: G.penX + Math.cos(G.thS) * G.RA * 0.3, y: G.penY + Math.sin(G.thS) * G.RA * 0.3, vx: rand(-40, 40), vy: rand(-40, 40), t: 0, life: rand(0.5, 0.9) });
          gestureAU();
        }
        if (!openAU && sepAU >= 0.6) {
          openAU = true;
          sepAUT = 1;
          api.status(TEXTES.passage2);
          statusSet = TEXTES.passage2;
          api.hint(TEXTES.regardeCourant);
          api.progress(0.5);
          api.sfx.play('splash', { pitch: 0.8 });
          api.sfx.play('chime');
          api.buzz(12);
          api.gesture(null);
          p1T = 0;
        }
        if (p1T >= 0) {
          p1T += dt;
          ringK = clamp(p1T / 1.0);
          defK = ease.inOutSine(clamp((p1T - 0.4) / 1.4));
          iceK = ease.inOutSine(clamp((p1T - 1.0) / 2.8));
          if (p1T > 1.0) {
            setStatus(TEXTES.glace);
            api.progress(0.5 + 0.1 * iceK);
          }
          if (p1T > 1.0 && p1T - dt <= 1.0) api.sfx.play('wind', { pitch: 1.3 });
          if (p1T > 5.4 && transT < 0) {
            transT = 0;
            api.sfx.play('whoosh', { pitch: 0.7 });
          }
        }
        if (transT >= 0) {
          transT += dt / 1.5;
          if (transT >= 1) {
            transT = -1;
            step = 2;
            api.hint(TEXTES.consigneInde);
            setStatus('');
            gestureIN();
          }
        }
      } else {
        if (dockT < 0 && indK > 0.02) {
          setStatus(TEXTES.approche);
          api.progress(0.6 + 0.2 * indK);
        }
        if (dockT < 0 && indK >= 0.985) {
          dockT = 0;
          indKT = 1;
          shake = 0.7;
          api.status(TEXTES.choc);
          statusSet = TEXTES.choc;
          api.hint(TEXTES.regardeMousson);
          api.progress(0.8);
          api.sfx.play('thud', { pitch: 0.7 });
          api.sfx.play('rumble');
          api.buzz([14, 40, 14]);
          api.guide(null, 'wow');
          api.gesture(null);
        }
        if (dockT >= 0) {
          dockT += dt;
          hK = ease.outCubic(clamp(dockT / 2.2));
          cloudK = ease.inOutSine(clamp((dockT - 1.4) / 2.2));
          rainK = clamp((dockT - 3.2) / 0.8);
          eroK = clamp((dockT - 3.4) / 3.2);
          if (dockT > 3.4 && !finished) {
            setStatus(TEXTES.himalaya);
            api.progress(0.8 + 0.15 * eroK);
          }
          if (dockT > 3.2 && dockT - dt <= 3.2) api.sfx.play('splash', { pitch: 1.5, volume: 0.5 });
          if (rainK > 0) api.sfx.play('splash', { pitch: rand(1.6, 2), volume: 0.12, gap: 450 });
          if (!finished && dockT > 7.2) {
            finished = true;
            api.done(TEXTES.fin, TEXTES.finStatut);
          }
          /* les grains emportés par les rivières */
          if (eroK > 0 && silt.length < 50 && Math.random() < dt * 14) silt.push({ r: Math.random() < 0.5 ? 0 : 1, s: 0, v: rand(0.25, 0.4) });
        }
      }

      /* le CO2 de l'air baisse pendant que les passages s'ouvrent, puis avec l'usure de l'Himalaya */
      lvl = 0.8 - 0.07 * sepSA - 0.07 * sepAU - 0.05 * iceK - 0.12 * eroK;
      setGauge(lvl, dt);

      let j = 0;
      for (const r of rings) if ((r.t += dt) < 0.6) rings[j++] = r;
      rings.length = j;
      j = 0;
      for (const s of sparks) {
        s.t += dt;
        if (s.t >= s.life) continue;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        sparks[j++] = s;
      }
      sparks.length = j;
      j = 0;
      for (const s of silt) {
        s.s += s.v * dt;
        if (s.s >= 1) continue;
        silt[j++] = s;
      }
      silt.length = j;
    }

    /* ---- dessin de l'étape 1 ---- */
    function saOff() {
      return [Math.cos(G.thS) * G.mSA * sepSA, Math.sin(G.thS) * G.mSA * sepSA];
    }
    function auOff() {
      return [Math.cos(G.thA) * G.mAU * sepAU, Math.sin(G.thA) * G.mAU * sepAU];
    }

    function drawArrowHead(x, y, a, s, col) {
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
      ctx.lineTo(x + Math.cos(a + 2.5) * s, y + Math.sin(a + 2.5) * s);
      ctx.lineTo(x + Math.cos(a - 2.5) * s, y + Math.sin(a - 2.5) * s);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
    }

    function drawWarm() {
      const D = [7, 7];
      ctx.lineCap = 'round';
      for (const c of warm) {
        const k = defK;
        /* point d'arrivée : la côte, ou un virage avant l'anneau */
        const ex = lerp(c.ex, c.dx, k), ey = lerp(c.ey, c.dy, k);
        const c2x = lerp(lerp(c.c1x, c.ex, 0.6), c.mx, k), c2y = lerp(lerp(c.c1y, c.ey, 0.6), c.my, k);
        ctx.beginPath();
        ctx.moveTo(c.sx, c.sy);
        ctx.bezierCurveTo(c.c1x, c.c1y, c2x, c2y, ex, ey);
        ctx.strokeStyle = 'rgba(212,95,42,0.25)';
        ctx.lineWidth = 7;
        ctx.setLineDash(NODASH);
        ctx.stroke();
        ctx.setLineDash(D);
        ctx.lineDashOffset = -time * 22 * AMB;
        ctx.strokeStyle = WARM;
        ctx.lineWidth = 2.6;
        ctx.stroke();
        ctx.setLineDash(NODASH);
        const a = Math.atan2(ey - c2y, ex - c2x);
        drawArrowHead(ex, ey, a, 6.5, WARM);
        if (k < 0.5) {
          /* l'eau chaude réchauffe la côte */
          ctx.globalCompositeOperation = 'multiply';
          draw.glow(ctx, ex, ey, 18, '#F2B07A', 0.5 * (1 - k * 2));
          ctx.globalCompositeOperation = 'source-over';
        }
      }
    }
    const NODASH = [];

    function drawRing() {
      if (ringK <= 0) return;
      const { cx, cy } = G;
      const R = G.ring;
      ctx.save();
      ctx.globalAlpha = ringK;
      ctx.strokeStyle = 'rgba(31,111,168,0.22)';
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([10, 9]);
      ctx.lineDashOffset = -time * 30 * AMB;
      ctx.strokeStyle = COLD;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, TAU * ringK);
      ctx.stroke();
      ctx.setLineDash(NODASH);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU + time * 0.35 * AMB;
        if (a % TAU > TAU * ringK) continue;
        drawArrowHead(cx + Math.cos(a) * R, cy + Math.sin(a) * R, a + Math.PI / 2, 7, COLD);
      }
      ctx.restore();
    }

    function drawBridge() {
      if (sepSA >= 0.55 && bridgeSnap <= 0) return;
      const [ox, oy] = saOff();
      const x0 = G.penX, y0 = G.penY;
      const x1 = G.saTipX + ox, y1 = G.saTipY + oy;
      const k = clamp(sepSA / 0.55);
      const wd = G.RA * 0.075;
      const mid = wd * (1 - 0.8 * k);
      const nx = -Math.sin(G.thS), ny = Math.cos(G.thS);
      if (sepSA < 0.55) {
        /* l'isthme : une bande de terre qui s'étire et s'amincit quand on tire */
        const ex = Math.cos(G.thS) * 4, ey = Math.sin(G.thS) * 4;
        const ax0 = x0 - ex, ay0 = y0 - ey, ax1 = x1 + ex, ay1 = y1 + ey;
        const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
        const cw = 2 * mid - wd;
        const side = (s) => {
          ctx.moveTo(ax0 + nx * wd * s, ay0 + ny * wd * s);
          ctx.quadraticCurveTo(mx + nx * cw * s, my + ny * cw * s, ax1 + nx * wd * s, ay1 + ny * wd * s);
        };
        ctx.beginPath();
        side(1);
        ctx.lineTo(ax1 - nx * wd, ay1 - ny * wd);
        ctx.quadraticCurveTo(mx - nx * cw, my - ny * cw, ax0 - nx * wd, ay0 - ny * wd);
        ctx.closePath();
        const gr = ctx.createLinearGradient(x0, y0, x1, y1);
        gr.addColorStop(0, C_ANT.base);
        gr.addColorStop(1, C_LAND.base);
        ctx.fillStyle = gr;
        ctx.fill();
        ctx.beginPath();
        side(1);
        side(-1);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      } else {
        /* l'eau s'engouffre dans le passage */
        const s = bridgeSnap / 0.6;
        draw.glow(ctx, (x0 + x1) / 2, (y0 + y1) / 2, G.RA * 0.5, '#FFFFFF', 0.7 * s);
      }
    }

    function drawIce() {
      if (iceK <= 0.001) return;
      const { cx, cy, RA } = G;
      ctx.save();
      ctx.clip(pathAN);
      const R = RA * 1.75 * iceK;
      const gr = ctx.createRadialGradient(cx - RA * 0.2, cy - RA * 0.25, 2, cx, cy, Math.max(4, R));
      gr.addColorStop(0, '#FFFFFF');
      gr.addColorStop(0.7, '#F1F8FC');
      gr.addColorStop(1, '#D3E8F4');
      ctx.fillStyle = gr;
      ctx.beginPath();
      draw.blob(ctx, cx, cy, Math.max(2, R), 0.09, 1.7, 0, 48);
      ctx.fill();
      /* fines lignes de glace qui coule vers la côte */
      ctx.strokeStyle = `rgba(120,165,195,${0.35 * iceK})`;
      ctx.lineWidth = 0.9;
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * TAU + 0.2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * RA * 0.25, cy + Math.sin(a) * RA * 0.25);
        ctx.quadraticCurveTo(cx + Math.cos(a + 0.12) * RA * 0.6, cy + Math.sin(a + 0.12) * RA * 0.6, cx + Math.cos(a) * Math.min(R, RA * 1.1), cy + Math.sin(a) * Math.min(R, RA * 1.1));
        ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.4;
      ctx.stroke(pathAN);
    }

    function renderPolar() {
      const { w, h } = G;
      ctx.drawImage(bg1.c, 0, 0, w, h);
      drawWarm();
      drawRing();
      ctx.drawImage(sprAN.c, 0, 0, w, h);
      /* tant que l'Antarctique n'a pas de glace : des taches de végétation */
      drawIce();
      drawBridge();
      const [sx, sy] = saOff();
      ctx.drawImage(sprSA.c, sx, sy, w, h);
      const [ax, ay] = auOff();
      ctx.drawImage(sprAU.c, ax, ay, w, h);
      if (sparks.length) {
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        for (const s of sparks) {
          const k = s.t / s.life;
          ctx.globalAlpha = 1 - k;
          ctx.beginPath();
          ctx.arc(s.x, s.y, 2.2 * (1 - k * 0.5), 0, TAU);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }

    /* ---- dessin de l'étape 2 ---- */
    function indY() {
      return lerp(G.in0, G.in1, indK) * G.U2;
    }
    const PEAKS = [[-0.3, 0.55, 0.62], [-0.2, 0.8, 0.3], [-0.1, 0.92, 0.1], [0, 1, 0], [0.1, 0.95, 0.12], [0.2, 0.82, 0.28], [0.29, 0.6, 0.5]];
    const BACK = [[-0.25, 0.6, 0.5], [-0.05, 0.75, 0.2], [0.15, 0.7, 0.35]];
    function drawHimalaya() {
      if (hK <= 0) return;
      const { ax, base } = G;
      const U = G.U2;
      /* le plateau derrière les montagnes */
      ctx.save();
      ctx.globalAlpha = 0.6 * hK;
      ctx.beginPath();
      ctx.ellipse(ax, base - U * 0.12, U * 0.42, U * 0.09, 0, 0, TAU);
      ctx.fillStyle = '#E2CFA2';
      ctx.fill();
      ctx.restore();
      for (const list of [BACK, PEAKS]) {
        const back = list === BACK;
        for (const [px, ph, delay] of list) {
          const k = clamp((hK - delay * 0.35) / 0.65);
          if (k <= 0) continue;
          const x = ax + px * U;
          const y = base + U * 0.02 - (back ? U * 0.055 : 0);
          const ht = U * 0.16 * ph * ease.outBack(k) * (back ? 0.9 : 1);
          const wd = U * (back ? 0.1 : 0.078);
          hill(ctx, x, y, wd, ht, clamp((k - 0.5) * 2.5));
        }
      }
    }
    /* deux rivières qui descendent des montagnes, traversent la plaine et rejoignent la mer */
    const RIV = [[0.04, 0.1, 0.2, 0.17, 0.37, 0.37], [-0.07, 0.1, -0.21, 0.16, -0.39, 0.35]];
    function riverPts(r, t, out) {
      const [x0, y0, x1, y1, x2, y2] = RIV[r];
      const U = G.U2, u = 1 - t;
      out.x = G.ax + (u * u * x0 + 2 * u * t * x1 + t * t * x2) * U;
      out.y = G.base + (u * u * y0 + 2 * u * t * y1 + t * t * y2) * U + Math.sin(t * 9 + r) * U * 0.008;
      return out;
    }
    const RP = { x: 0, y: 0 };
    function drawRivers() {
      if (eroK <= 0) return;
      const L = clamp(eroK * 1.6);
      ctx.lineCap = 'round';
      for (let r = 0; r < 2; r++) {
        ctx.beginPath();
        for (let i = 0; i <= 24; i++) {
          const t = (i / 24) * L;
          riverPts(r, t, RP);
          if (i === 0) ctx.moveTo(RP.x, RP.y);
          else ctx.lineTo(RP.x, RP.y);
        }
        ctx.strokeStyle = 'rgba(47,127,184,0.35)';
        ctx.lineWidth = 4.5;
        ctx.stroke();
        ctx.strokeStyle = '#2F7FB8';
        ctx.lineWidth = 2.2;
        ctx.stroke();
        if (L >= 1) {
          /* l'éventail de boue à l'embouchure */
          riverPts(r, 1, RP);
          ctx.globalAlpha = 0.6 * clamp((eroK - 0.6) / 0.4);
          ctx.fillStyle = '#B08A5A';
          ctx.beginPath();
          ctx.ellipse(RP.x, RP.y + G.U2 * 0.015, G.U2 * 0.06 * eroK, G.U2 * 0.035 * eroK, 0, 0, TAU);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
      ctx.fillStyle = '#7A5A36';
      for (const s of silt) {
        if (s.s > L) continue;
        riverPts(s.r, s.s, RP);
        ctx.beginPath();
        ctx.arc(RP.x, RP.y, 1.7, 0, TAU);
        ctx.fill();
      }
    }
    /* les nuages de la mousson : ils arrivent de la mer et s'arrêtent contre les montagnes */
    const CLOUDS = [[-0.25, 0.08, 0], [0.0, 0.06, 0.2], [0.25, 0.08, 0.35]];
    function drawMonsoon() {
      if (cloudK <= 0) return;
      const { ax, base } = G;
      const U = G.U2;
      for (const [cx0, cy0, d] of CLOUDS) {
        const k = clamp((cloudK - d * 0.3) / 0.7);
        if (k <= 0) continue;
        const x = ax + cx0 * U + Math.sin(time * 0.4 + cx0 * 7) * 2 * AMB;
        const y = base + (cy0 + (1 - ease.outCubic(k)) * 1.2) * U;
        if (rainK > 0) {
          /* la pluie, en petits traits obliques sous le nuage */
          ctx.strokeStyle = `rgba(47,127,184,${0.6 * rainK})`;
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const fx = x + (i / 5 - 0.5) * cloudSpr.CW * 0.7;
            const ph = ((time * 1.6 * AMB + i * 0.37) % 1);
            const fy = y + cloudSpr.CH * 0.3 + ph * U * 0.07;
            ctx.moveTo(fx, fy);
            ctx.lineTo(fx - 2.5, fy + 5);
          }
          ctx.stroke();
        }
        ctx.globalAlpha = Math.min(1, k * 1.5);
        ctx.drawImage(cloudSpr.c, x - cloudSpr.CW / 2, y - cloudSpr.CH / 2, cloudSpr.CW, cloudSpr.CH);
        ctx.globalAlpha = 1;
      }
    }
    /* le vent de mousson : des flèches qui montent de la mer */
    function drawWind() {
      if (cloudK <= 0 || cloudK >= 1) return;
      const { ax, ay } = G;
      const U = G.U2;
      ctx.save();
      ctx.globalAlpha = Math.sin(cloudK * Math.PI) * 0.8;
      ctx.strokeStyle = COLD;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.lineDashOffset = -time * 30;
      for (const ox of [-0.55, 0.55]) {
        ctx.beginPath();
        ctx.moveTo(ax + ox * U, ay + 0.95 * U);
        ctx.quadraticCurveTo(ax + ox * U * 0.6, ay + 0.2 * U, ax + ox * U * 0.35, ay - 0.15 * U);
        ctx.stroke();
      }
      ctx.setLineDash(NODASH);
      for (const ox of [-0.55, 0.55]) {
        const a = Math.atan2(-0.35 * U, -ox * U * 0.25);
        drawArrowHead(ax + ox * U * 0.35, ay - 0.15 * U, a, 6, COLD);
      }
      ctx.restore();
    }

    function renderAsia() {
      const { w, h } = G;
      ctx.drawImage(bg2.c, 0, 0, w, h);
      drawWind();
      ctx.drawImage(sprIN.c, 0, indY() - G.in1 * G.U2, w, h);
      drawRivers();
      drawHimalaya();
      drawMonsoon();
    }

    function render() {
      const { w, h } = G;
      let sx = 0, sy = 0;
      if (shake > 0 && !api.reducedMotion) {
        const k = Math.min(1, shake / 0.7);
        sx = Math.sin(time * 53) * 2.4 * k;
        sy = Math.cos(time * 41) * 1.6 * k;
      }
      ctx.fillStyle = '#B5D4E6';
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.translate(sx, sy);
      if (step === 1 && transT < 0) {
        renderPolar();
      } else if (transT >= 0) {
        /* la carte bascule : le pôle s'en va en tournant, l'Asie arrive */
        const e = ease.inOutCubic(clamp(transT));
        ctx.save();
        ctx.translate(w / 2, h / 2);
        const s2 = lerp(1.25, 1, e);
        ctx.scale(s2, s2);
        ctx.translate(-w / 2, -h / 2 + (1 - e) * h * 0.25);
        renderAsia();
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = 1 - e;
        ctx.translate(w / 2, h * 0.48);
        ctx.rotate(e * 1.1);
        const s1 = lerp(1, 0.55, e);
        ctx.scale(s1, s1);
        ctx.translate(-w / 2, -h * 0.48 - e * h * 0.2);
        renderPolar();
        ctx.restore();
      } else {
        renderAsia();
      }
      ctx.restore();
      for (const r of rings) {
        const k = r.t / 0.6;
        ctx.strokeStyle = `rgba(31,70,104,${0.7 * (1 - k)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(r.x, r.y, 6 + 26 * ease.outCubic(k), 0, TAU);
        ctx.stroke();
      }
      placeHandles();
    }

    function placeHandles() {
      const r = Math.max(36, G.RA * 0.75);
      const s1 = step === 1 && transT < 0;
      const [sx, sy] = saOff();
      placeGrab(grabSA, G.saCx + sx, G.saCy + sy, r, s1 && !openSA);
      const [ax, ay] = auOff();
      placeGrab(grabAU, G.auX + ax, G.auY + ay, r, s1 && !openAU);
      placeGrab(grabIN, G.ax, G.ay + indY(), Math.max(40, G.U2 * 0.3), step === 2 && dockT < 0);
    }

    function init() {
      step = 1;
      sepSA = sepSAT = sepAU = sepAUT = 0;
      openSA = openAU = false;
      p1T = -1;
      ringK = defK = iceK = 0;
      transT = -1;
      indK = indKT = 0;
      dockT = -1;
      hK = cloudK = rainK = eroK = 0;
      finished = false;
      shake = bridgeSnap = 0;
      statusSet = '';
      grab = null;
      rings = [];
      sparks = [];
      silt = [];
      shownLvl = -1;
      downT = 0;
      lvl = 0.8;
      setGauge(lvl, 0);
      gestureSA();
    }

    cv.onResize(geometry);
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
