/* 192 lasers sur un grain de poivre (version des petits) : on allume les 12 groupes de lasers
   fixés sur la grande chambre sphérique (une tape allume un quart de la chambre, soit trois
   groupes), puis on tire au bon moment. Les 192 faisceaux convergent sur la minuscule bille de
   combustible, qui s'écrase : éclair de fusion.
   Les groupes de 16 faisceaux sont une simplification de jeu, pas l'organisation réelle du laser. */
(function () {
  'use strict';
  const { lib } = window.RM;
  const { TAU, rand, clamp, lerp, ease, rgba, mix, draw } = lib;

  /* Tous les textes du jeu, faciles à corriger */
  const TEXTES = {
    encore: 'Bien ! Touche les autres lasers.',
    prets: 'Tape quand l’anneau vert touche le cercle jaune !',
    pretsStatut: 'Les 192 lasers sont prêts !',
    tropTot: 'Un peu trop tôt ! Essaie encore.',
    tropTard: 'Un peu trop tard ! Essaie encore.',
    aide: 'La zone jaune grandit : tape quand l’anneau vert est dedans !',
    feu: 'Pile au bon moment !',
    fin: 'Les 192 lasers frappent la bille : un éclair de fusion !',
    finStatut: 'C’est arrivé pour de vrai en 2022, aux États-Unis.',
    bravo: '{bravo}',
  };

  const CSS = `
.game[data-game="lasers"] .gesture-dot {
  box-shadow: 0 0 0 7px rgba(255, 255, 255, 0.22), 0 0 0 15px rgba(57, 255, 158, 0.22), 0 4px 14px rgba(0, 0, 0, 0.45);
}
`;

  /* ---- réglages ---- */
  const GROUPS = 12, PER = 16, TOTAL = GROUPS * PER;
  const DEG = Math.PI / 180;
  /* 6 groupes en haut, 6 en bas ; les côtés restent libres (bras porte-cible, hublots) */
  const ANGLES = [207.5, 232.5, 257.5, 282.5, 307.5, 332.5, 27.5, 52.5, 77.5, 102.5, 127.5, 152.5].map((a) => a * DEG);
  const ORDER = [2, 3, 1, 4, 0, 5, 8, 9, 7, 10, 6, 11];   /* ordre des rappels du doigt fantôme */
  /* une tape allume tout un quart de la chambre : trois groupes voisins (0-2, 3-5, 6-8, 9-11),
     l'un après l'autre à partir de celui qu'on a touché ; quatre tapes suffisent */
  const PAR_TAPE = 3, CASCADE = 0.14;
  /* chambre (en rayons de sphère) */
  const SHELL_IN = 0.925, SHELL_OUT = 1;
  const MOD_R = 0.975, MOD_W = 0.3, MOD_D = 0.25;          /* modules : rayon, largeur, profondeur */
  const EXT = 1.13;                                         /* encombrement total, modules compris */
  const RING0 = 0.78, TARGET = 0.19;                        /* départ de l'anneau, cercle-cible */
  const T_HIT = 1.9, RING_GAP = 0.5;                        /* s pour atteindre le cercle ; pause */
  const WINDOWS = [0.7, 1.2, 99];                           /* fenêtre de tir (s) selon les ratés : au 2e raté, toute tape réussit */
  const SLOW = [1, 1.3, 1.5];                               /* l'anneau ralentit dès le 1er raté */
  const PULSE = 0.32, IGN = 0.62, FIRE_END = 1.5;           /* tir : trajet de la lumière, éclair, fin */
  const SPC = ['#FFF6D8', '#FFD43B', '#C8FFE4', '#FFA458', '#8FA59B'];

  /* 16 lentilles par module (grille 4 × 4), en coordonnées du module (x : le long de la paroi, y : vers le centre).
     Le module est un trapèze qui se rétrécit vers le centre de la chambre. */
  const MOD_IN = 0.8;                                       /* largeur du bord intérieur / bord extérieur */
  const SP_T = MOD_W / 4.6, SP_N = MOD_D / 4.8;
  const LENS = [];
  for (let r = 0; r < 4; r++) {
    const f = lerp(0.97, MOD_IN * 1.02, r / 3);
    for (let c = 0; c < 4; c++) LENS.push([(c - 1.5) * SP_T * f, (r - 1.5) * SP_N]);
  }
  const LENS_R = Math.min(SP_T * MOD_IN, SP_N) * 0.36;
  /* positions autour du centre, en rayons : lentilles, direction d'arrivée, modules, cônes, conduits */
  const LX = new Float32Array(TOTAL), LY = new Float32Array(TOTAL);
  const EX = new Float32Array(TOTAL), EY = new Float32Array(TOTAL);
  const MX = new Float32Array(GROUPS), MY = new Float32Array(GROUPS);
  const CONE = new Float32Array(GROUPS * 4), TUBE = new Float32Array(GROUPS * 4);
  for (let g = 0; g < GROUPS; g++) {
    const th = ANGLES[g], phi = th + Math.PI / 2, cp = Math.cos(phi), sp = Math.sin(phi);
    const mx = Math.cos(th) * MOD_R, my = Math.sin(th) * MOD_R;
    MX[g] = mx;
    MY[g] = my;
    const wx = (lx, ly) => mx + lx * cp - ly * sp;
    const wy = (lx, ly) => my + lx * sp + ly * cp;
    for (let k = 0; k < PER; k++) {
      const j = g * PER + k;
      const [lx, ly] = LENS[k];
      LX[j] = wx(lx, ly);
      LY[j] = wy(lx, ly);
      const d = Math.hypot(LX[j], LY[j]);
      EX[j] = LX[j] / d;
      EY[j] = LY[j] / d;
    }
    const cw = (MOD_W * MOD_IN) / 2 - 0.02;
    CONE[g * 4] = wx(-cw, MOD_D / 2);
    CONE[g * 4 + 1] = wy(-cw, MOD_D / 2);
    CONE[g * 4 + 2] = wx(cw, MOD_D / 2);
    CONE[g * 4 + 3] = wy(cw, MOD_D / 2);
    const tw = MOD_W * 0.22;
    TUBE[g * 4] = wx(-tw, -MOD_D / 2);
    TUBE[g * 4 + 1] = wy(-tw, -MOD_D / 2);
    TUBE[g * 4 + 2] = wx(tw, -MOD_D / 2);
    TUBE[g * 4 + 3] = wy(tw, -MOD_D / 2);
  }

  function mk(w, h, dpr) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * dpr));
    c.height = Math.max(1, Math.round(h * dpr));
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    return { c, g, w, h };
  }
  function seeded(seed) {
    let s = seed >>> 0 || 1;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }
  /* trapèze aux coins arrondis : bord extérieur (en haut) plus large que le bord intérieur */
  function trapez(g, cx, cy, wOut, wIn, d, r) {
    const y0 = cy - d / 2, y1 = cy + d / 2;
    const P = [[cx - wOut / 2, y0], [cx + wOut / 2, y0], [cx + wIn / 2, y1], [cx - wIn / 2, y1]];
    g.beginPath();
    g.moveTo(cx, y0);
    for (let i = 1; i <= 4; i++) {
      const p = P[i % 4], q = P[(i + 1) % 4];
      g.arcTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2, r);
    }
    g.closePath();
  }
  /* brume verte de la chambre (texture de bruit, faite une seule fois) */
  let HAZE = null;
  function hazeTexture() {
    if (HAZE) return HAZE;
    const N = 72;
    const c = document.createElement('canvas');
    c.width = N;
    c.height = N;
    const g = c.getContext('2d');
    const img = g.createImageData(N, N);
    const n = lib.makeNoise(31);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const v = n.fbm(x / 19, y / 19, 4);
        const k = clamp((v - 0.34) * 2);
        const j = (y * N + x) * 4;
        img.data[j] = 110;
        img.data[j + 1] = 255;
        img.data[j + 2] = 185;
        img.data[j + 3] = Math.round(k * k * 120);
      }
    }
    g.putImageData(img, 0, 0);
    HAZE = c;
    return c;
  }

  window.RM.games.lasers = function (api) {
    api.style(CSS);
    const stage = api.stage;
    const fig = api.root;
    const cv = api.canvas();
    const ctx = cv.ctx;
    const RM = api.reducedMotion;
    const AMB = RM ? 0.3 : 1;
    const hex = (v, d) => (/^#[0-9a-f]{6}$/i.test(v) ? v : d);
    const GREEN = hex(api.css('--accent'), '#39FF9E');
    const YELLOW = hex(api.css('--accent-2'), '#FFD43B');

    /* ---- géométrie ---- */
    const G = { w: 1, h: 1, cx: 0, cy: 0, R: 100, rb: 4 };
    const L = { cx: 0, cy: 0, R: 100, s: 1 };   /* position et taille de la chambre à l'écran */
    let bg = null, chamber = null, modOff = null, modOn = null, lensGlow = null;

    function geometry(w, h) {
      G.w = w;
      G.h = h;
      G.R = (Math.min(w, h) / 2 - 10) / EXT;
      G.cx = w / 2;
      G.cy = h / 2;
      G.rb = clamp(G.R * 0.03, 3.2, 6);
      L.cx = G.cx;
      L.cy = G.cy;
      L.R = G.R;
      buildSprites();
      bg = makeBg(w, h);
      if (stage.querySelector('.gesture') && gestureGroup >= 0) showGestureOn(gestureGroup);
    }

    /* ---- dessins pré-rendus ---- */
    function makeBg(w, h) {
      const B = mk(w, h, cv.dpr);
      const g = B.g;
      const base = g.createLinearGradient(0, 0, 0, h);
      base.addColorStop(0, '#04100B');
      base.addColorStop(1, '#020604');
      g.fillStyle = base;
      g.fillRect(0, 0, w, h);
      const M = Math.max(w, h);
      draw.glow(g, G.cx, G.cy, M * 0.78, '#0F3D28', 0.5);
      draw.glow(g, w * 0.12, h * 0.04, M * 0.5, '#123A2A', 0.3);
      draw.glow(g, w * 0.92, h * 0.98, M * 0.42, '#2E2A08', 0.22);
      /* béton du hall : grain fin */
      const rnd = seeded(23);
      const n = Math.round((w * h) / 170);
      for (let i = 0; i < n; i++) {
        g.fillStyle = rnd() < 0.45 ? `rgba(190,255,220,${0.012 + rnd() * 0.03})` : `rgba(0,0,0,${0.08 + rnd() * 0.14})`;
        g.fillRect(rnd() * w, rnd() * h, 1 + rnd(), 1 + rnd());
      }
      const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.hypot(w, h) * 0.62);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.6)');
      g.fillStyle = vg;
      g.fillRect(0, 0, w, h);
      return B;
    }

    /* La chambre : un vide sombre et brumeux, une coque d'acier épaisse, des hublots et le bras porte-cible */
    function makeChamber() {
      const R = G.R;
      const S = Math.ceil(R * 2.5);
      const C = mk(S, S, cv.dpr);
      const g = C.g;
      const c = S / 2;
      const Ri = R * SHELL_IN, Ro = R * SHELL_OUT, Rm = (Ri + Ro) / 2;
      draw.glow(g, c, c + R * 0.05, R * 1.22, '#000000', 0.6);
      draw.glow(g, c, c, R * 1.24, '#1E7A4E', 0.16);
      /* intérieur */
      const ig = g.createRadialGradient(c - R * 0.12, c - R * 0.2, R * 0.04, c, c, Ri);
      ig.addColorStop(0, '#0E281B');
      ig.addColorStop(0.55, '#06130C');
      ig.addColorStop(1, '#020705');
      g.fillStyle = ig;
      g.beginPath();
      g.arc(c, c, Ri, 0, TAU);
      g.fill();
      g.save();
      g.beginPath();
      g.arc(c, c, Ri, 0, TAU);
      g.clip();
      g.globalAlpha = 0.4;
      g.drawImage(hazeTexture(), c - Ri, c - Ri, Ri * 2, Ri * 2);
      g.globalAlpha = 1;
      /* paroi du fond : méridiens et parallèles très discrets, pour sentir la sphère */
      g.strokeStyle = 'rgba(170,255,210,0.05)';
      g.lineWidth = 1;
      [-58, -30, 0, 30, 58].forEach((lat) => {
        const la = lat * DEG;
        g.beginPath();
        g.ellipse(c, c + Math.sin(la) * Ri * 0.96, Math.cos(la) * Ri, Math.cos(la) * Ri * 0.26, 0, 0, TAU);
        g.stroke();
      });
      [24, 50, 74].forEach((lon) => {
        g.beginPath();
        g.ellipse(c, c, Math.sin(lon * DEG) * Ri, Ri, 0, 0, TAU);
        g.stroke();
      });
      const dv = g.createRadialGradient(c, c, Ri * 0.55, c, c, Ri);
      dv.addColorStop(0, 'rgba(0,0,0,0)');
      dv.addColorStop(1, 'rgba(0,0,0,0.6)');
      g.fillStyle = dv;
      g.fillRect(c - Ri, c - Ri, Ri * 2, Ri * 2);
      /* bras porte-cible : une fine tige qui entre par la gauche */
      const tipX = c - G.rb * 2.4, baseX = c - Ri - 2;
      const t0 = Math.max(1.6, R * 0.014), t1 = Math.max(0.6, R * 0.004);
      const ag = g.createLinearGradient(0, c - t0, 0, c + t0);
      ag.addColorStop(0, '#A9B8B0');
      ag.addColorStop(0.5, '#5D6B64');
      ag.addColorStop(1, '#262F2B');
      g.fillStyle = ag;
      g.beginPath();
      g.moveTo(baseX, c - t0);
      g.lineTo(tipX, c - t1);
      g.lineTo(tipX, c + t1);
      g.lineTo(baseX, c + t0);
      g.closePath();
      g.fill();
      g.fillStyle = '#7F8E86';
      g.beginPath();
      g.arc(tipX, c, Math.max(1, t1 * 1.6), 0, TAU);
      g.fill();
      g.restore();
      /* coque : anneau d'acier */
      const sg = g.createLinearGradient(c - Ro, c - Ro, c + Ro, c + Ro);
      sg.addColorStop(0, '#66756E');
      sg.addColorStop(0.45, '#36433D');
      sg.addColorStop(1, '#131A17');
      g.fillStyle = sg;
      g.beginPath();
      g.arc(c, c, Ro, 0, TAU);
      g.arc(c, c, Ri, 0, TAU, true);
      g.fill();
      g.save();
      g.beginPath();
      g.arc(c, c, Ro, 0, TAU);
      g.arc(c, c, Ri, 0, TAU, true);
      g.clip();
      const rnd = seeded(5);
      for (let i = 0; i < Math.round(R * 7); i++) {
        const a = rnd() * TAU, d = lerp(Ri, Ro, rnd());
        g.fillStyle = rnd() < 0.5 ? `rgba(225,255,240,${0.04 + rnd() * 0.09})` : `rgba(0,0,0,${0.1 + rnd() * 0.16})`;
        g.fillRect(c + Math.cos(a) * d, c + Math.sin(a) * d, 1, 1);
      }
      /* joints entre les plaques */
      [220, 245, 270, 295, 320, 40, 65, 90, 115, 140, 352, 8, 172, 188].forEach((deg) => {
        const a = deg * DEG, ca = Math.cos(a), sa = Math.sin(a);
        g.strokeStyle = 'rgba(0,0,0,0.5)';
        g.lineWidth = 1.2;
        g.beginPath();
        g.moveTo(c + ca * Ri, c + sa * Ri);
        g.lineTo(c + ca * Ro, c + sa * Ro);
        g.stroke();
        g.strokeStyle = 'rgba(220,255,236,0.12)';
        g.lineWidth = 0.8;
        g.beginPath();
        g.moveTo(c + Math.cos(a + 0.012) * Ri, c + Math.sin(a + 0.012) * Ri);
        g.lineTo(c + Math.cos(a + 0.012) * Ro, c + Math.sin(a + 0.012) * Ro);
        g.stroke();
      });
      g.restore();
      /* arêtes : reflet extérieur, ombre et liseré vert à l'intérieur */
      g.lineWidth = 1.3;
      g.strokeStyle = 'rgba(225,255,240,0.3)';
      g.beginPath();
      g.arc(c, c, Ro - 0.7, Math.PI * 0.92, Math.PI * 1.78);
      g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.65)';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(c, c, Ri + 1, 0, TAU);
      g.stroke();
      g.strokeStyle = rgba(GREEN, 0.16);
      g.lineWidth = 1;
      g.beginPath();
      g.arc(c, c, Ri - 0.5, 0, TAU);
      g.stroke();
      /* boulons */
      const br = Math.max(0.8, R * 0.0065);
      for (let deg = 2.5; deg < 360; deg += 5) {
        const a = deg * DEG;
        const x = c + Math.cos(a) * Rm, y = c + Math.sin(a) * Rm;
        g.fillStyle = 'rgba(0,0,0,0.55)';
        g.beginPath();
        g.arc(x + 0.4, y + 0.5, br, 0, TAU);
        g.fill();
        g.fillStyle = 'rgba(200,225,212,0.55)';
        g.beginPath();
        g.arc(x, y, br * 0.75, 0, TAU);
        g.fill();
      }
      /* hublots sur les côtés (dont celui du bras porte-cible) */
      [-14, 0, 14, 166, 180, 194].forEach((deg) => {
        const a = deg * DEG;
        const x = c + Math.cos(a) * Rm, y = c + Math.sin(a) * Rm;
        const pr = R * (deg === 0 ? 0.032 : 0.024);
        const pg = g.createRadialGradient(x - pr * 0.3, y - pr * 0.3, pr * 0.1, x, y, pr * 1.35);
        pg.addColorStop(0, '#A7B6AF');
        pg.addColorStop(0.6, '#56645D');
        pg.addColorStop(1, '#1A221F');
        g.fillStyle = pg;
        g.beginPath();
        g.arc(x, y, pr * 1.35, 0, TAU);
        g.fill();
        g.fillStyle = '#020604';
        g.beginPath();
        g.arc(x, y, pr * 0.8, 0, TAU);
        g.fill();
        g.fillStyle = rgba(GREEN, 0.25);
        g.beginPath();
        g.arc(x - pr * 0.25, y - pr * 0.25, pr * 0.22, 0, TAU);
        g.fill();
      });
      return C;
    }

    /* Un module de 16 lasers : boîtier d'acier en trapèze (il « vise » le centre), plaque sombre,
       quatre vis et une grille de 4 × 4 lentilles */
    function makeModule(on) {
      const R = G.R, W = MOD_W * R, Wi = W * MOD_IN, D = MOD_D * R;
      const pad = Math.ceil(R * 0.05) + 3;
      const S = mk(Math.ceil(W + pad * 2), Math.ceil(D + pad * 2), cv.dpr);
      const g = S.g;
      const cx = S.w / 2, cy = S.h / 2, cr = R * 0.04;
      g.fillStyle = 'rgba(0,0,0,0.55)';
      trapez(g, cx, cy + 1.6, W + 3, Wi + 3, D + 2, cr + 1);
      g.fill();
      const body = g.createLinearGradient(0, cy - D / 2, 0, cy + D / 2);
      body.addColorStop(0, '#5A6A62');
      body.addColorStop(0.16, '#33413A');
      body.addColorStop(0.7, '#1C2622');
      body.addColorStop(1, '#101714');
      g.fillStyle = body;
      trapez(g, cx, cy, W, Wi, D, cr);
      g.fill();
      /* biseau : arête claire dehors, arête sombre dedans */
      g.save();
      trapez(g, cx, cy, W, Wi, D, cr);
      g.clip();
      g.strokeStyle = 'rgba(235,255,244,0.28)';
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(cx - W / 2, cy - D / 2 + 0.8);
      g.lineTo(cx + W / 2, cy - D / 2 + 0.8);
      g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.5)';
      g.beginPath();
      g.moveTo(cx - Wi / 2, cy + D / 2 - 0.8);
      g.lineTo(cx + Wi / 2, cy + D / 2 - 0.8);
      g.stroke();
      g.restore();
      /* plaque des lentilles, légèrement creusée */
      const m = Math.max(2.2, R * 0.02);
      trapez(g, cx, cy, W - m * 2.4, Wi - m * 2.2, D - m * 2, cr * 0.6);
      const pl = g.createLinearGradient(0, cy - D / 2, 0, cy + D / 2);
      pl.addColorStop(0, on ? '#0D2A1D' : '#0B1411');
      pl.addColorStop(1, on ? '#071A11' : '#050A08');
      g.fillStyle = pl;
      g.fill();
      g.strokeStyle = on ? rgba(GREEN, 0.45) : 'rgba(210,240,225,0.14)';
      g.lineWidth = 1;
      g.stroke();
      /* quatre vis dans les coins */
      const sr = Math.max(0.7, R * 0.007);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
        const wx = (sy < 0 ? W : Wi) / 2 - m * 0.75;
        const px = cx + sx * wx, py = cy + sy * (D / 2 - m * 0.55);
        g.fillStyle = 'rgba(0,0,0,0.5)';
        g.beginPath();
        g.arc(px + 0.3, py + 0.4, sr, 0, TAU);
        g.fill();
        g.fillStyle = 'rgba(205,228,216,0.6)';
        g.beginPath();
        g.arc(px, py, sr * 0.8, 0, TAU);
        g.fill();
      });
      const lr = LENS_R * R;
      LENS.forEach(([lx, ly]) => {
        const px = cx + lx * R, py = cy + ly * R;
        const lg = g.createRadialGradient(px - lr * 0.3, py - lr * 0.35, lr * 0.1, px, py, lr);
        lg.addColorStop(0, on ? '#2C7A55' : '#1A2622');
        lg.addColorStop(1, on ? '#0A2E1E' : '#030605');
        g.fillStyle = lg;
        g.beginPath();
        g.arc(px, py, lr, 0, TAU);
        g.fill();
        g.strokeStyle = on ? rgba(GREEN, 0.55) : 'rgba(190,230,210,0.26)';
        g.lineWidth = 0.75;
        g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.42)';
        g.beginPath();
        g.arc(px - lr * 0.36, py - lr * 0.36, lr * 0.26, 0, TAU);
        g.fill();
      });
      return S;
    }

    function buildSprites() {
      chamber = makeChamber();
      modOff = makeModule(false);
      modOn = makeModule(true);
      const lr = LENS_R * G.R;
      const LG = Math.ceil(lr * 9);
      lensGlow = mk(LG, LG, cv.dpr);
      draw.glow(lensGlow.g, LG / 2, LG / 2, LG / 2, GREEN, 0.5);
      draw.glow(lensGlow.g, LG / 2, LG / 2, lr * 1.7, '#EAFFF3', 0.95);
    }

    /* ---- état ---- */
    /* wait : délai avant l'allumage d'un groupe, dans la cascade d'une tape (−1 : rien de prévu) */
    const groups = ANGLES.map(() => ({ on: false, t: 0, press: 0, flash: 0, call: 0, delay: 0, wait: -1 }));
    const GI = new Float32Array(GROUPS);       /* intensité des faisceaux de chaque groupe */
    const bead = { size: 1, ox: 0, oy: 0, squash: 0, rot: 0, heat: 0, alpha: 1, born: 1 };
    let phase = 'charge', phaseT = 0, time = 0;
    let charged = 0, allT = 0, idleT = 0, gestureGroup = -1;
    let ringT = -1, misses = 0, passes = 0, winOn = false, winGlow = 0, missRingR = -1;
    let missDir = 0, missHit = false, beadRenewed = false, ignited = false;
    let flash = 0, ember = 0, shake = 0, shockT = -1, echo = 0, echoT = 99;
    let frozen = false, freezeAt = null;      /* outils de test (adresse avec ?debug) */
    const presses = new Map();

    /* réservoirs d'objets réutilisés (aucune allocation dans la boucle) */
    const SPARK = Array.from({ length: 300 }, () => ({ on: false, x: 0, y: 0, vx: 0, vy: 0, t: 0, life: 1, c: 0, dot: false, sz: 1, drag: 0.3 }));
    const WAVE = Array.from({ length: 14 }, () => ({ on: false, x: 0, y: 0, t: 0, dur: 0.55, c: '#39FF9E', r1: 30 }));
    const MOTES = Array.from({ length: 28 }, () => ({ a: rand(TAU), r: Math.sqrt(rand(0.03, 0.72)), sp: rand(0.015, 0.06) * (Math.random() < 0.5 ? -1 : 1), ph: rand(TAU), tw: rand(0.5, 1.6), s: rand(0.8, 1.6) }));
    function take(arr) {
      for (let i = 0; i < arr.length; i++) if (!arr[i].on) return arr[i];
      return null;
    }

    function setPhase(p) {
      phase = p;
      phaseT = 0;
      fig.dataset.lzPhase = p;
    }
    function setWin(v) {
      if (v === winOn) return;
      winOn = v;
      fig.dataset.lzWin = v ? '1' : '0';
    }
    const tHit = () => T_HIT * SLOW[Math.min(misses, SLOW.length - 1)];
    const winSize = () => WINDOWS[Math.min(misses, WINDOWS.length - 1)];

    function resetBead() {
      bead.size = 1;
      bead.ox = 0;
      bead.oy = 0;
      bead.squash = 0;
      bead.rot = 0;
      bead.heat = 0;
      bead.alpha = 1;
    }

    function showGestureOn(gi) {
      gestureGroup = gi;
      const x = G.cx + MX[gi] * G.R, y = G.cy + MY[gi] * G.R;
      api.gesture('tap', { x: (x / G.w) * 100, y: (y / G.h) * 100 });
    }

    function addWave(x, y, c, r1) {
      const wv = take(WAVE);
      if (!wv) return;
      wv.on = true;
      wv.x = x;
      wv.y = y;
      wv.t = 0;
      wv.dur = 0.55;
      wv.c = c;
      wv.r1 = r1;
    }

    /* ---- interaction ---- */
    function hitGroup(x, y) {
      const dx = x - L.cx, dy = y - L.cy;
      const d = Math.hypot(dx, dy) / L.R;
      if (d < 0.42 || d > 1.4) return -1;
      const a = Math.atan2(dy, dx);
      let best = -1, bd = 21 * DEG;
      for (let i = 0; i < GROUPS; i++) {
        let da = Math.abs(a - ANGLES[i]) % TAU;
        if (da > Math.PI) da = TAU - da;
        if (da < bd) {
          bd = da;
          best = i;
        }
      }
      return best;
    }
    /* allumé, ou sur le point de l'être (cascade en cours) */
    const taken = (i) => groups[i].on || groups[i].wait >= 0;
    function nearestUncharged(x, y) {
      const a = Math.atan2(y - L.cy, x - L.cx);
      let best = -1, bd = Infinity;
      for (let i = 0; i < GROUPS; i++) {
        if (taken(i)) continue;
        let da = Math.abs(a - ANGLES[i]) % TAU;
        if (da > Math.PI) da = TAU - da;
        if (da < bd) {
          bd = da;
          best = i;
        }
      }
      return best;
    }

    /* une tape allume tout son quart de la chambre, en cascade à partir du groupe touché */
    function chargeQuarter(gi) {
      const q0 = gi - (gi % PAR_TAPE);
      for (let k = q0; k < q0 + PAR_TAPE; k++) {
        if (!taken(k)) groups[k].wait = Math.abs(k - gi) * CASCADE;
      }
      idleT = 0;
    }
    function chargeGroup(gi) {
      const g = groups[gi];
      g.on = true;
      g.wait = -1;
      g.t = 0;
      g.flash = 1;
      charged++;
      idleT = 0;
      api.progress((charged / GROUPS) * 0.6);
      api.sfx.play('bubble', { pitch: 0.75 + charged * 0.08, gap: 0 });
      api.buzz(10);
      if (charged === 1) api.hint(TEXTES.encore);
      if (charged === GROUPS) allT = 0;
    }

    function startArm() {
      setPhase('arm');
      api.gesture(null);
      api.hint(TEXTES.prets);
      api.status(TEXTES.pretsStatut);
      api.progress(0.65);
      api.sfx.play('chime', { pitch: 1.15 });
    }
    function startSync() {
      setPhase('sync');
      ringT = -0.2;
    }

    function judge(info) {
      if (info.ringT < 0) {
        api.sfx.play('tick', { pitch: 0.8 });
        return;
      }
      passes = 0;
      const tH = tHit();
      const err = info.ringT - tH;
      if (Math.abs(err) <= winSize() / 2) fireOk();
      else fireMiss(err < 0 ? 'tot' : 'tard', info.ringT);
    }

    function fireOk() {
      setPhase('fire');
      setWin(false);
      ignited = false;
      api.hint(TEXTES.feu);
      api.progress(0.8);
      api.sfx.play('whoosh', { pitch: 1.5, gap: 0 });
      api.buzz(12);
    }

    function fireMiss(kind, rt) {
      const v = (RING0 - TARGET) / tHit();
      missRingR = Math.max(0.04, RING0 - v * rt);
      misses++;
      setPhase('miss');
      setWin(false);
      missHit = false;
      beadRenewed = false;
      /* un côté arrive avant l'autre : la bille est poussée de travers */
      const side = rand(TAU);
      missDir = side + Math.PI;
      for (let i = 0; i < GROUPS; i++) {
        const c = Math.cos(ANGLES[i] - side);
        groups[i].delay = (1 - c) * 0.17 + rand(0, 0.05);
      }
      api.hint(kind === 'tot' ? TEXTES.tropTot : TEXTES.tropTard);
      api.sfx.play('whoosh', { pitch: 0.9, volume: 0.5, gap: 0 });
      api.buzz(10);
    }

    function sprayMiss() {
      for (let i = 0; i < 30; i++) {
        const s = take(SPARK);
        if (!s) break;
        const a = missDir + rand(-0.75, 0.75), sp = rand(0.2, 0.85);
        s.on = true;
        s.x = Math.cos(missDir) * 0.03;
        s.y = Math.sin(missDir) * 0.03;
        s.vx = Math.cos(a) * sp;
        s.vy = Math.sin(a) * sp;
        s.t = 0;
        s.life = rand(0.4, 0.9);
        s.c = i % 3 === 0 ? 1 : 3;
        s.dot = i % 2 === 0;
        s.sz = s.dot ? rand(0.7, 1.4) : 1.1;
        s.drag = 0.15;
      }
      api.sfx.play('thud', { gap: 0 });
      api.sfx.play('fail', { volume: 0.6, gap: 0 });
    }
    function puff() {
      for (let i = 0; i < 14; i++) {
        const s = take(SPARK);
        if (!s) break;
        const a = rand(TAU), sp = rand(0.03, 0.12);
        s.on = true;
        s.x = Math.cos(missDir) * 0.04;
        s.y = Math.sin(missDir) * 0.04;
        s.vx = Math.cos(a) * sp;
        s.vy = Math.sin(a) * sp - 0.04;
        s.t = 0;
        s.life = rand(0.7, 1.2);
        s.c = 4;
        s.dot = true;
        s.sz = rand(1.2, 2.4);
        s.drag = 0.5;
      }
    }

    function ignite() {
      ignited = true;
      flash = 1;
      ember = 1;
      shockT = 0;
      shake = RM ? 0 : 1;
      const n = RM ? 70 : 240;
      for (let i = 0; i < n; i++) {
        const s = take(SPARK);
        if (!s) break;
        const a = rand(TAU), sp = rand(0.45, 2.6);
        s.on = true;
        s.x = Math.cos(a) * 0.02;
        s.y = Math.sin(a) * 0.02;
        s.vx = Math.cos(a) * sp;
        s.vy = Math.sin(a) * sp;
        s.t = 0;
        s.life = rand(0.5, 1.35);
        s.c = Math.random() < 0.5 ? 0 : Math.random() < 0.65 ? 1 : 2;
        s.dot = Math.random() < 0.25;
        s.sz = s.dot ? rand(0.8, 1.6) : rand(1, 1.8);
        s.drag = 0.28;
      }
      api.sfx.play('crack', { gap: 0 });
      api.sfx.play('rumble', { gap: 0 });
      api.buzz(15);
    }

    /* la fusion a eu lieu : la chambre reste allumée, chaque tape relance un écho de lumière */
    function startFin() {
      setPhase('fin');
      api.done(TEXTES.fin, TEXTES.finStatut);
      api.guide(null, 'laugh', TEXTES.bravo);
    }

    function onTap(x, y, info) {
      if (phase === 'charge' && info.ph === 'charge') {
        let gi = info.gi;
        if (gi >= 0 && taken(gi)) groups[gi].flash = Math.max(groups[gi].flash, 0.5);
        /* à côté des lasers, ou sur un quart déjà allumé : on allume le quart éteint le plus proche */
        if (gi < 0 || taken(gi)) gi = nearestUncharged(x, y);
        if (gi < 0) {
          api.sfx.play('tick', { pitch: 1.4 });
          return;
        }
        chargeQuarter(gi);
        return;
      }
      if (phase === 'sync' && info.ph === 'sync') {
        judge(info);
        return;
      }
      if (phase === 'fin' && api.isDone()) {
        /* après la réussite : chaque tape relance un petit écho de lumière */
        echo = 1;
        echoT = 0;
        ember = Math.max(ember, 0.7);
        api.sfx.play('pop', { pitch: rand(0.9, 1.2) });
        return;
      }
      api.sfx.play('pop', { pitch: rand(0.8, 1.1), volume: 0.5 });
    }

    api.track(cv.canvas, {
      down(p) {
        const info = { gi: -1, ringT, ph: phase };
        if (phase === 'charge') {
          info.gi = hitGroup(p.x, p.y);
          if (info.gi >= 0) groups[info.gi].press = 1;
        }
        presses.set(p.id, info);
        addWave(p.x, p.y, phase === 'sync' ? YELLOW : GREEN, phase === 'charge' && info.gi >= 0 ? 26 : 34);
      },
      up(p, e, cancelled) {
        const info = presses.get(p.id);
        presses.delete(p.id);
        if (cancelled || !info) return;
        if (Math.hypot(p.x - p.x0, p.y - p.y0) > 26) return;
        onTap(p.x, p.y, info);
      },
    }, { touchAction: 'pan-y' });

    /* ---- animation ---- */
    function groupI(i) {
      const g = groups[i];
      if (!g.on) return 0;
      const base = 0.3 + 0.07 * Math.sin(time * 2.1 * AMB + i * 1.7);
      if (phase === 'charge' || phase === 'sync') {
        return g.t < 0.9 ? base + 0.75 * Math.pow(1 - g.t / 0.9, 2) : base;
      }
      if (phase === 'arm') return base + 0.55 * Math.sin(Math.PI * clamp(phaseT / 0.9));
      if (phase === 'miss') {
        const tt = phaseT - g.delay;
        if (tt < 0) return base;
        if (tt < PULSE + 0.1) return 1;
        return lerp(1, base, clamp((tt - PULSE - 0.1) / 0.5));
      }
      if (phase === 'fire') {
        if (phaseT < IGN + 0.04) return lerp(base, 1.15, clamp(phaseT / 0.06));
        return 1.15 * (1 - clamp((phaseT - IGN - 0.04) / 0.3));
      }
      return echo * 0.9;   /* fin : les lasers ont tiré, il ne reste que l'écho des tapes */
    }

    function update(dt) {
      time += dt;
      phaseT += dt;
      for (let i = 0; i < GROUPS; i++) {
        const g = groups[i];
        if (g.on) g.t += dt;
        if (g.wait >= 0) {
          g.wait -= dt;
          if (g.wait < 0) chargeGroup(i);
        }
        g.press = Math.max(0, g.press - dt * 5);
        g.flash = Math.max(0, g.flash - dt * 2.2);
        g.call = Math.max(0, g.call - dt * 1.3);
      }
      if (bead.born < 1) bead.born = Math.min(1, bead.born + dt / 0.45);
      shake = Math.max(0, shake - dt * 3.2);
      flash *= Math.exp(-dt * 4.2);
      if (flash < 0.003) flash = 0;
      /* après la victoire, une petite lueur reste allumée au centre de la chambre */
      if (ember > 0) ember = Math.max(phase === 'fin' ? 0.8 : 0, ember - dt * 0.4);
      echo = Math.max(0, echo - dt * 1.5);
      echoT += dt;
      if (shockT >= 0) {
        shockT += dt;
        if (shockT > 0.8) shockT = -1;
      }

      if (phase === 'charge') {
        idleT += dt;
        if (charged === GROUPS) {
          allT += dt;
          if (allT > 0.55) startArm();
        } else if (idleT > 4) {
          /* personne ne tape : le doigt fantôme montre un groupe encore éteint */
          idleT = 0;
          const gi = ORDER.find((k) => !taken(k));
          if (gi != null) {
            showGestureOn(gi);
            groups[gi].call = 1;
          }
        }
      } else if (phase === 'arm') {
        if (phaseT > 1.1) startSync();
      } else if (phase === 'sync') {
        ringT += dt;
        const tH = tHit(), v = (RING0 - TARGET) / tH;
        if (ringT >= 0 && RING0 - v * ringT <= 0.035) {
          /* l'anneau est passé sans qu'on tape : tous les deux passages, on aide un peu plus */
          ringT = -RING_GAP;
          passes++;
          if (passes % 2 === 0) {
            if (misses < WINDOWS.length - 1) {
              misses++;
              api.hint(TEXTES.aide);
            }
            api.gesture('tap', { x: (G.cx / G.w) * 100, y: (G.cy / G.h) * 100 });
          }
        }
        setWin(ringT >= 0 && Math.abs(ringT - tH) <= winSize() / 2);
      } else if (phase === 'miss') {
        const t = phaseT;
        if (!beadRenewed) {
          const k = clamp((t - PULSE * 0.9) / 0.35);
          const e = ease.outCubic(k);
          bead.squash = 0.62 * e;
          bead.ox = Math.cos(missDir) * 1.1 * e;
          bead.oy = Math.sin(missDir) * 1.1 * e;
          bead.rot = missDir;
          bead.heat = 0.45 * k;
        }
        if (!missHit && t >= PULSE * 0.9) {
          missHit = true;
          sprayMiss();
        }
        if (t > 0.85 && !beadRenewed) bead.alpha = Math.max(0, 1 - (t - 0.85) / 0.35);
        if (t > 0.9 && t - dt <= 0.9) puff();
        if (t > 1.25 && !beadRenewed) {
          /* une nouvelle bille prend la place de l'ancienne */
          beadRenewed = true;
          resetBead();
          bead.born = 0;
        }
        if (t > 1.85) {
          setPhase('sync');
          ringT = -0.35;
          missRingR = -1;
          api.hint(TEXTES.aide);
        }
      } else if (phase === 'fire') {
        const t = phaseT;
        if (t < IGN) {
          const k = clamp((t - PULSE) / (IGN - PULSE));
          bead.size = 1 - 0.62 * ease.inQuad(k);
          bead.heat = Math.max(0.3 * clamp(t / PULSE), k);
        } else if (!ignited) {
          ignite();
        }
        if (ignited) bead.alpha = Math.max(0, bead.alpha - dt * 9);
        if (t > FIRE_END) startFin();
      }

      for (let i = 0; i < SPARK.length; i++) {
        const s = SPARK[i];
        if (!s.on) continue;
        s.t += dt;
        if (s.t >= s.life) {
          s.on = false;
          continue;
        }
        const d = Math.pow(s.drag, dt);
        s.vx *= d;
        s.vy *= d;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
      }
      for (let i = 0; i < WAVE.length; i++) {
        const wv = WAVE[i];
        if (wv.on && (wv.t += dt) >= wv.dur) wv.on = false;
      }
      winGlow += ((winOn ? 1 : 0) - winGlow) * Math.min(1, dt * 16);
      for (let i = 0; i < GROUPS; i++) GI[i] = groupI(i);
      if (freezeAt) {
        const f = freezeAt;
        const hit = f.p === 'hit' ? phase === 'sync' && ringT >= tHit() + f.t : phase === f.p && phaseT >= f.t;
        if (hit) {
          frozen = true;
          freezeAt = null;
          fig.dataset.lzFrozen = '1';
        }
      }
    }

    /* ---- dessin ---- */
    function drawTubes() {
      /* conduits par où arrive la lumière des lasers, du bord de la scène jusqu'aux modules */
      const far = Math.max(G.w, G.h);
      for (let i = 0; i < GROUPS; i++) {
        const on = groups[i].on;
        const a = on ? 0.06 + GI[i] * 0.12 : 0.04;
        const ux = Math.cos(ANGLES[i]), uy = Math.sin(ANGLES[i]);
        const j = i * 4;
        const x1 = L.cx + TUBE[j] * L.R, y1 = L.cy + TUBE[j + 1] * L.R;
        const x2 = L.cx + TUBE[j + 2] * L.R, y2 = L.cy + TUBE[j + 3] * L.R;
        const ox = L.cx + ux * L.R * 1.05, oy = L.cy + uy * L.R * 1.05;
        const gr = ctx.createLinearGradient(ox, oy, ox + ux * far * 0.55, oy + uy * far * 0.55);
        gr.addColorStop(0, rgba(on ? GREEN : '#9FCDB8', a));
        gr.addColorStop(1, rgba(on ? GREEN : '#9FCDB8', 0));
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x2 + ux * far, y2 + uy * far);
        ctx.lineTo(x1 + ux * far, y1 + uy * far);
        ctx.closePath();
        ctx.fill();
      }
    }

    function drawCones() {
      /* lumière diffuse dans la chambre : un cône par groupe allumé */
      const grd = ctx.createRadialGradient(L.cx, L.cy, 0, L.cx, L.cy, L.R * MOD_R);
      grd.addColorStop(0, 'rgba(235,255,244,0.95)');
      grd.addColorStop(0.16, rgba(GREEN, 0.5));
      grd.addColorStop(1, rgba(GREEN, 0.16));
      ctx.fillStyle = grd;
      for (let i = 0; i < GROUPS; i++) {
        const I = GI[i];
        if (I <= 0.01) continue;
        ctx.globalAlpha = clamp(I * 0.12);
        const j = i * 4;
        ctx.beginPath();
        ctx.moveTo(L.cx + CONE[j] * L.R, L.cy + CONE[j + 1] * L.R);
        ctx.lineTo(L.cx + CONE[j + 2] * L.R, L.cy + CONE[j + 3] * L.R);
        ctx.lineTo(L.cx, L.cy);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function drawAim() {
      /* avant d'être chargés, chaque groupe montre en pointillés où il vise */
      if (phase !== 'charge') return;
      ctx.setLineDash([2, 6]);
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(200,255,225,0.1)';
      ctx.beginPath();
      for (let i = 0; i < GROUPS; i++) {
        if (groups[i].on) continue;
        const j = i * 4;
        const mx = (CONE[j] + CONE[j + 2]) / 2, my = (CONE[j + 1] + CONE[j + 3]) / 2;
        ctx.moveTo(L.cx + mx * L.R, L.cy + my * L.R);
        ctx.lineTo(L.cx + mx * L.R * 0.12, L.cy + my * L.R * 0.12);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    /* les faisceaux s'arrêtent à la surface de la bille, même quand elle s'écrase */
    function beamEnd() {
      return G.rb * L.s * Math.max(0.4, bead.size) * 0.85;
    }

    function drawBeams() {
      const rb = beamEnd();
      const gw = ctx.createRadialGradient(L.cx, L.cy, 0, L.cx, L.cy, L.R * MOD_R);
      gw.addColorStop(0, 'rgba(255,255,255,1)');
      gw.addColorStop(0.1, rgba(GREEN, 0.8));
      gw.addColorStop(0.55, rgba(GREEN, 0.4));
      gw.addColorStop(1, rgba(GREEN, 0.8));
      ctx.strokeStyle = gw;
      const wide = Math.max(2.4, L.R * 0.02), core = Math.max(0.7, L.R * 0.0055);
      for (let i = 0; i < GROUPS; i++) {
        const I = GI[i];
        if (I <= 0.01) continue;
        ctx.beginPath();
        for (let k = 0; k < PER; k++) {
          const j = i * PER + k;
          ctx.moveTo(L.cx + LX[j] * L.R, L.cy + LY[j] * L.R);
          ctx.lineTo(L.cx + EX[j] * rb, L.cy + EY[j] * rb);
        }
        ctx.lineWidth = wide;
        ctx.globalAlpha = clamp(I * 0.2);
        ctx.stroke();
        ctx.lineWidth = core;
        ctx.globalAlpha = clamp(I * 0.85);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    /* position (0 = lentille, 1 = bille) de l'éclat de lumière qui file dans les faisceaux du groupe i */
    function pulseS(i) {
      const g = groups[i];
      if (phase === 'charge' || phase === 'sync') return g.t < PULSE * 1.3 ? g.t / PULSE : -1;
      if (phase === 'arm') return phaseT / (PULSE * 1.7);
      if (phase === 'miss') return (phaseT - g.delay) / PULSE;
      if (phase === 'fire') return phaseT / PULSE;
      if (phase === 'fin') return echoT / PULSE;
      return -1;
    }
    /* Éclats de lumière : une tête brillante et une traîne qui s'efface, en trois tronçons */
    const PULSE_LEN = 0.17;
    const PULSE_PARTS = [[1, 0.62, 0.14], [0.62, 0.3, 0.38], [0.3, 0, 1]];
    function drawPulses() {
      const rb = beamEnd();
      const wide = Math.max(3, L.R * 0.022), core = Math.max(1, L.R * 0.007);
      ctx.lineCap = 'round';
      for (let q = 0; q < 3; q++) {
        const [fa, fb, alpha] = PULSE_PARTS[q];
        let any = false;
        ctx.beginPath();
        for (let i = 0; i < GROUPS; i++) {
          if (!groups[i].on) continue;
          const s = pulseS(i);
          if (s <= 0 || s >= 1 + PULSE_LEN) continue;
          const s0 = Math.max(0, s - PULSE_LEN * fa), s1 = Math.min(1, s - PULSE_LEN * fb);
          if (s1 <= s0) continue;
          any = true;
          for (let k = 0; k < PER; k++) {
            const j = i * PER + k;
            const ax = L.cx + LX[j] * L.R, ay = L.cy + LY[j] * L.R;
            const bx = L.cx + EX[j] * rb, by = L.cy + EY[j] * rb;
            ctx.moveTo(lerp(ax, bx, s0), lerp(ay, by, s0));
            ctx.lineTo(lerp(ax, bx, s1), lerp(ay, by, s1));
          }
        }
        if (!any) continue;
        ctx.strokeStyle = rgba(GREEN, 0.4 * alpha);
        ctx.lineWidth = wide;
        ctx.stroke();
        ctx.strokeStyle = rgba('#F2FFF8', 0.95 * alpha);
        ctx.lineWidth = core;
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
    }

    function drawModules() {
      const mw = modOff.w * L.s, mh = modOff.h * L.s;
      for (let i = 0; i < GROUPS; i++) {
        const x = L.cx + MX[i] * L.R, y = L.cy + MY[i] * L.R;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(ANGLES[i] + Math.PI / 2);
        ctx.drawImage(groups[i].on ? modOn.c : modOff.c, -mw / 2, -mh / 2, mw, mh);
        ctx.restore();
      }
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < GROUPS; i++) {
        const g = groups[i];
        const x = L.cx + MX[i] * L.R, y = L.cy + MY[i] * L.R;
        if (phase === 'charge' && !g.on) {
          /* invitation : un liseré jaune qui fait le tour des groupes encore éteints */
          const wv = RM ? 0.5 : Math.pow(Math.max(0, Math.sin(time * 2.6 - i * 0.52)), 3);
          const a = 0.22 + 0.5 * wv + g.call * 0.6;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(ANGLES[i] + Math.PI / 2);
          const W = MOD_W * L.R, D = MOD_D * L.R;
          trapez(ctx, 0, 0, W + 5, W * MOD_IN + 5, D + 5, L.R * 0.05);
          ctx.strokeStyle = rgba(YELLOW, clamp(a));
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.restore();
          if (wv + g.call > 0.05) draw.glow(ctx, x, y, L.R * 0.24, YELLOW, 0.1 * wv + g.call * 0.3);
        }
        if (g.press > 0) draw.glow(ctx, x, y, L.R * 0.27, '#FFFFFF', 0.32 * g.press);
        if (g.flash > 0) draw.glow(ctx, x, y, L.R * 0.36, GREEN, 0.6 * g.flash);
      }
    }

    function drawLenses() {
      const S = lensGlow.w * L.s;
      const dim = phase === 'fin' ? 0.55 : 1;
      for (let i = 0; i < GROUPS; i++) {
        const g = groups[i];
        if (!g.on) continue;
        const a = clamp(0.45 + GI[i] * 0.5 + g.flash * 0.5) * dim;
        for (let k = 0; k < PER; k++) {
          const lt = g.t - k * 0.02;      /* les 16 lentilles s'allument l'une après l'autre */
          if (lt < 0) continue;
          const j = i * PER + k;
          ctx.globalAlpha = clamp(a + clamp(1 - lt / 0.25) * 0.6);
          ctx.drawImage(lensGlow.c, L.cx + LX[j] * L.R - S / 2, L.cy + LY[j] * L.R - S / 2, S, S);
        }
      }
      ctx.globalAlpha = 1;
    }

    function drawMotes() {
      ctx.fillStyle = '#D2FFE8';
      const lit = 0.6 + 0.4 * (charged / GROUPS);
      for (let i = 0; i < MOTES.length; i++) {
        const m = MOTES[i];
        const a = m.a + time * m.sp * AMB;
        const x = L.cx + Math.cos(a) * m.r * L.R * SHELL_IN;
        const y = L.cy + Math.sin(a) * m.r * L.R * SHELL_IN * 0.92 + Math.sin(time * 0.35 * AMB + m.ph) * 3 * L.s;
        const tw = 0.5 + 0.5 * Math.sin(time * m.tw * AMB + m.ph);
        ctx.globalAlpha = (0.06 + 0.22 * tw * tw) * lit;
        const s = m.s * Math.max(0.6, L.s);
        ctx.fillRect(x - s / 2, y - s / 2, s, s);
      }
      ctx.globalAlpha = 1;
    }

    function drawTarget() {
      let vis = 0;
      if (phase === 'arm') vis = ease.outCubic(clamp(phaseT / 0.7));
      else if (phase === 'sync' || phase === 'miss') vis = 1;
      else if (phase === 'fire') vis = 1 - clamp(phaseT / 0.25);
      if (vis <= 0.01) return;
      const cx = L.cx, cy = L.cy, R = L.R;
      const tH = tHit(), v = (RING0 - TARGET) / tH;
      const half = (v * winSize()) / 2;
      const rIn = Math.max(TARGET - half, 0.05), rOut = Math.min(TARGET + half, RING0 - 0.02);
      let near = 0;
      if (phase === 'sync' && ringT >= 0) near = clamp(1 - Math.abs(ringT - tH) / (winSize() / 2 + 0.5));
      const hot = Math.max(winGlow, near * 0.35);
      ctx.globalAlpha = vis;
      /* zone de tir : l'anneau doit être dedans quand on tape */
      const bandA = 0.08 + 0.26 * hot;
      const tp = clamp((TARGET - rIn) / Math.max(0.001, rOut - rIn), 0.05, 0.95);
      const bgr = ctx.createRadialGradient(cx, cy, rIn * R, cx, cy, rOut * R);
      bgr.addColorStop(0, rgba(YELLOW, bandA * 0.3));
      bgr.addColorStop(tp, rgba(YELLOW, bandA));
      bgr.addColorStop(1, rgba(YELLOW, bandA * 0.3));
      ctx.beginPath();
      ctx.arc(cx, cy, rOut * R, 0, TAU);
      ctx.arc(cx, cy, rIn * R, 0, TAU, true);
      ctx.fillStyle = bgr;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = rgba(YELLOW, 0.24 + 0.36 * hot);
      ctx.beginPath();
      ctx.arc(cx, cy, rOut * R, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, rIn * R, 0, TAU);
      ctx.stroke();
      /* cercle-cible, avec quatre repères */
      const sc = phase === 'arm' ? lerp(1.8, 1, ease.outCubic(clamp(phaseT / 0.7))) : 1;
      const rt = TARGET * R * sc;
      ctx.lineWidth = 1.8 + hot * 1.6;
      ctx.strokeStyle = rgba(YELLOW, 0.8 + 0.2 * hot);
      ctx.beginPath();
      ctx.arc(cx, cy, rt, 0, TAU);
      ctx.stroke();
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let q = 0; q < 4; q++) {
        const a = q * (Math.PI / 2) + Math.PI / 4, ca = Math.cos(a), sa = Math.sin(a);
        ctx.moveTo(cx + ca * (rOut * R + 3), cy + sa * (rOut * R + 3));
        ctx.lineTo(cx + ca * (rOut * R + 3 + R * 0.05), cy + sa * (rOut * R + 3 + R * 0.05));
      }
      ctx.stroke();
      if (hot > 0.02) draw.glow(ctx, cx, cy, rt * 1.7, YELLOW, 0.3 * hot);
      /* l'anneau qui se resserre */
      if (phase === 'sync' && ringT >= 0) {
        const r = RING0 - v * ringT;
        const a = clamp(ringT / 0.25) * clamp((r - 0.035) / 0.08);
        ctx.beginPath();
        ctx.arc(cx, cy, r * R, 0, TAU);
        ctx.strokeStyle = rgba(GREEN, 0.22 * a);
        ctx.lineWidth = Math.max(8, R * 0.06);
        ctx.stroke();
        ctx.strokeStyle = rgba(GREEN, 0.75 * a);
        ctx.lineWidth = 3.4;
        ctx.stroke();
        ctx.strokeStyle = rgba('#DDFFEC', 0.9 * a);
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
      /* après un raté : l'anneau reste un instant là où il était au moment de la tape */
      if (phase === 'miss' && missRingR > 0) {
        const a = 1 - clamp((phaseT - 0.3) / 0.9);
        ctx.strokeStyle = rgba(GREEN, 0.85 * a);
        ctx.lineWidth = 2.4;
        ctx.setLineDash([6, 5]);
        ctx.beginPath();
        ctx.arc(cx, cy, missRingR * R, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.globalAlpha = 1;
    }

    function drawBead() {
      const sc = bead.born < 1 ? Math.max(0, ease.outBack(bead.born)) : 1;
      if (bead.alpha < 0.01 || sc < 0.01) return;
      const rb = G.rb * L.s;
      const r = rb * bead.size * sc;
      const x = L.cx + bead.ox * rb, y = L.cy + bead.oy * rb;
      const hot = bead.heat;
      ctx.globalCompositeOperation = 'lighter';
      draw.glow(ctx, x, y, r * (3.6 + hot * 5), hot > 0.5 ? '#FFF2C0' : YELLOW, (0.34 + hot * 0.5) * bead.alpha);
      ctx.globalCompositeOperation = 'source-over';
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(bead.rot);
      ctx.scale(1 - bead.squash * 0.5, 1 + bead.squash * 0.75);
      const gr = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
      gr.addColorStop(0, mix('#FFF8E2', '#FFFFFF', hot));
      gr.addColorStop(0.45, mix('#E8B95C', '#FFE58A', hot));
      gr.addColorStop(1, mix('#6E4716', '#FF9A3C', hot));
      ctx.globalAlpha = bead.alpha;
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    function drawBurst() {
      const cx = L.cx, cy = L.cy, R = L.R;
      const rb = G.rb * L.s;
      /* tir raté : la lumière arrive d'un côté avant l'autre, la bille gicle de travers */
      if (phase === 'miss' && phaseT > PULSE * 0.9) {
        const k = clamp((phaseT - PULSE * 0.9) / 0.7);
        const ux = Math.cos(missDir), uy = Math.sin(missDir);
        const d = rb * (1.5 + 4 * ease.outCubic(k));
        draw.glow(ctx, cx + ux * d, cy + uy * d, rb * (4.5 + 7 * k), '#FF9A4A', 0.7 * (1 - k));
        ctx.strokeStyle = rgba('#FFB070', 0.6 * (1 - k));
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx + ux * rb, cy + uy * rb, rb * (1.4 + 4.5 * ease.outCubic(k)), missDir - 0.9, missDir + 0.9);
        ctx.stroke();
      }
      /* la couche extérieure de la bille s'envole pendant que le cœur est écrasé */
      if (phase === 'fire' && phaseT > PULSE && phaseT < IGN + 0.2) {
        const k = clamp((phaseT - PULSE) / (IGN + 0.2 - PULSE));
        ctx.strokeStyle = rgba('#FFB070', 0.6 * (1 - k));
        ctx.lineWidth = 1.5 + 3 * (1 - k);
        ctx.beginPath();
        ctx.arc(cx, cy, rb * (1.3 + 5.5 * ease.outCubic(k)), 0, TAU);
        ctx.stroke();
        draw.glow(ctx, cx, cy, rb * (2 + 8 * k), '#FFE6A0', 0.5 * k);
      }
      if (ember > 0.01) {
        const b = ember * (0.85 + 0.15 * Math.sin(time * 3 * AMB));
        draw.glow(ctx, cx, cy, R * (0.07 + 0.16 * ember), '#FFC45A', 0.5 * b);
        draw.glow(ctx, cx, cy, R * 0.035 + 2, '#FFF6E0', 0.75 * b);
      }
      if (shockT >= 0) {
        /* onde de lumière qui file vers la paroi */
        const k = shockT / 0.8;
        const a = (1 - k) * (RM ? 0.5 : 1);
        ctx.beginPath();
        ctx.arc(cx, cy, lerp(0.03, SHELL_IN - 0.02, ease.outCubic(k)) * R, 0, TAU);
        ctx.strokeStyle = rgba('#FFD98A', 0.22 * a);
        ctx.lineWidth = R * (0.03 + 0.05 * (1 - k));
        ctx.stroke();
        ctx.strokeStyle = rgba('#FFF8E6', 0.85 * a);
        ctx.lineWidth = 1.2 + 1.6 * (1 - k);
        ctx.stroke();
      }
      ctx.lineCap = 'round';
      for (let i = 0; i < SPARK.length; i++) {
        const s = SPARK[i];
        if (!s.on) continue;
        const k = s.t / s.life;
        const wall = clamp((SHELL_IN - 0.03 - Math.hypot(s.x, s.y)) / 0.08);
        const a = Math.pow(1 - k, 1.4) * wall * (s.c === 4 ? 0.35 : 1);
        if (a < 0.02) continue;
        const x = cx + s.x * R, y = cy + s.y * R;
        ctx.globalAlpha = a;
        if (s.dot) {
          ctx.fillStyle = SPC[s.c];
          ctx.beginPath();
          ctx.arc(x, y, s.sz * (s.c === 4 ? 1 + k * 1.5 : 1), 0, TAU);
          ctx.fill();
        } else {
          ctx.strokeStyle = SPC[s.c];
          ctx.lineWidth = s.sz;
          ctx.beginPath();
          ctx.moveTo(x - s.vx * R * 0.035, y - s.vy * R * 0.035);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      ctx.lineCap = 'butt';
      if (flash > 0.01) {
        /* l'éclair de la fusion : un cœur blanc, un grand halo chaud, deux traits de lumière,
           et la paroi de la chambre qui s'illumine */
        const f = flash * (RM ? 0.35 : 1);
        const grow = 1 - flash;
        draw.glow(ctx, cx, cy, R * (0.45 + 1.2 * grow), '#FFE7A8', 0.75 * f);
        draw.glow(ctx, cx, cy, R * (0.1 + 0.25 * grow), '#FFFFFF', f);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(7, 0.22);
        draw.glow(ctx, 0, 0, R * 0.28, '#FFF6DA', 0.8 * f);
        ctx.restore();
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(0.18, 3.2);
        draw.glow(ctx, 0, 0, R * 0.3, '#FFF6DA', 0.45 * f);
        ctx.restore();
        ctx.strokeStyle = rgba('#FFE7A0', 0.55 * f);
        ctx.lineWidth = R * 0.05;
        ctx.beginPath();
        ctx.arc(cx, cy, R * (SHELL_IN + 0.01), 0, TAU);
        ctx.stroke();
      }
      if (echo > 0.01) draw.glow(ctx, cx, cy, R * (0.15 + 0.35 * (1 - echo)), '#FFF4D2', 0.4 * echo);
    }

    function drawWaves() {
      ctx.lineWidth = 1.8;
      for (let i = 0; i < WAVE.length; i++) {
        const wv = WAVE[i];
        if (!wv.on) continue;
        const k = wv.t / wv.dur;
        ctx.strokeStyle = rgba(wv.c, 0.75 * (1 - k));
        ctx.beginPath();
        ctx.arc(wv.x, wv.y, lerp(5, wv.r1, ease.outCubic(k)), 0, TAU);
        ctx.stroke();
      }
    }

    function render() {
      if (!bg) return;
      const w = G.w, h = G.h;
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.drawImage(bg.c, 0, 0, w, h);
      ctx.save();
      if (shake > 0.01) ctx.translate((Math.random() - 0.5) * 6 * shake, (Math.random() - 0.5) * 6 * shake);
      ctx.globalCompositeOperation = 'lighter';
      drawTubes();
      ctx.globalCompositeOperation = 'source-over';
      const cs = chamber.w * L.s;
      ctx.drawImage(chamber.c, L.cx - cs / 2, L.cy - cs / 2, cs, cs);
      ctx.globalCompositeOperation = 'lighter';
      drawMotes();
      drawAim();
      drawCones();
      drawBeams();
      drawTarget();
      ctx.globalCompositeOperation = 'source-over';
      drawBead();
      drawModules();
      ctx.globalCompositeOperation = 'lighter';
      drawLenses();
      drawPulses();
      drawBurst();
      ctx.globalCompositeOperation = 'source-over';
      drawWaves();
      ctx.restore();
      if (flash > 0.01) {
        /* toute la scène reçoit la lumière de l'éclair (très atténuée si l'animation est réduite) */
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = rgba('#FFF0D0', flash * flash * (RM ? 0.05 : 0.24));
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'source-over';
      }
    }

    api.loop((dt) => {
      if (!frozen) update(dt);
      render();
    });

    function init() {
      setPhase('charge');
      charged = 0;
      allT = 0;
      idleT = 0;
      misses = 0;
      passes = 0;
      ringT = -1;
      missRingR = -1;
      missHit = false;
      beadRenewed = false;
      ignited = false;
      flash = 0;
      ember = 0;
      shake = 0;
      shockT = -1;
      echo = 0;
      echoT = 99;
      winGlow = 0;
      groups.forEach((g) => {
        g.on = false;
        g.t = 0;
        g.press = 0;
        g.flash = 0;
        g.call = 0;
        g.delay = 0;
        g.wait = -1;
      });
      resetBead();
      bead.born = 1;
      SPARK.forEach((s) => { s.on = false; });
      WAVE.forEach((wv) => { wv.on = false; });
      presses.clear();
      winOn = true;
      setWin(false);
      api.status('');
      api.progress(0);
      showGestureOn(ORDER[0]);
    }

    /* Outils de test, seulement avec ?debug dans l'adresse : figer l'animation à un instant précis
       (phase et temps écoulé dans la phase, ou 'hit' : instant où l'anneau touche le cercle). */
    if (/[?&]debug\b/.test(location.search)) {
      fig.__lz = {
        freezeAt(p, t) {
          freezeAt = { p, t };
          frozen = false;
          fig.dataset.lzFrozen = '0';
        },
        go() {
          freezeAt = null;
          frozen = false;
          fig.dataset.lzFrozen = '0';
        },
        state: () => ({ phase, phaseT, ringT, misses, passes, winOn, charged }),
      };
    }

    cv.onResize(geometry);
    api.onReset(init);
    init();
    update(0.016);
    render();
  };
})();
