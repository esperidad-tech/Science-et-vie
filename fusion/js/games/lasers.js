/* 192 lasers sur un grain de poivre : on charge les 12 groupes de lasers fixés sur la grande
   chambre sphérique, puis on tire au bon moment. Les 192 faisceaux convergent sur la minuscule
   bille de combustible, qui s'écrase : éclair de fusion. Trois barres comparent ensuite l'énergie
   envoyée sur la cible, celle produite par la fusion et l'électricité prise au réseau.
   Les groupes de 16 faisceaux sont une simplification de jeu, pas l'organisation réelle du laser. */
(function () {
  'use strict';
  const { lib } = window.RM;
  const { TAU, rand, clamp, lerp, ease, rgba, mix, draw } = lib;

  /* Tous les textes du jeu, faciles à corriger */
  const TEXTES = {
    encore: 'Bien ! Allume les 12 groupes. Tu peux taper avec plusieurs doigts.',
    compteur: (n) => `Lasers : ${n} sur 192`,
    prets: 'Tous les lasers sont prêts ! Tape quand l’anneau vert touche le cercle jaune.',
    tropTot: 'Trop tôt : la bille s’écrase de travers. Retente !',
    tropTard: 'Trop tard : la bille s’écrase de travers. Retente !',
    aide: 'La zone jaune s’agrandit. Tape quand l’anneau vert est dedans !',
    feu: 'Pile au bon moment ! Les 192 lasers frappent la bille en même temps.',
    barres: [
      { nom: 'Envoyé sur la cible', valeur: '2,05 MJ' },
      { nom: 'Produit par la fusion', valeur: '3,15 MJ' },
      { nom: 'Électricité prise au réseau', valeur: 'environ 300 MJ' },
    ],
    fin: 'Le 5 décembre 2022 : la cible rend plus d’énergie qu’elle n’en reçoit !',
    finStatut: 'Record : 8,6 MJ (7 avril 2025). 11 réussites de décembre 2022 à juin 2026.',
    bravo: '{bravo}',
  };
  /* Les mêmes énergies, en mégajoules : elles donnent la longueur des barres */
  const MJ = [2.05, 3.15, 300];
  /* espace insécable entre un nombre et « MJ » */
  const nb = (s) => String(s).replace(/(\d) (MJ)/g, '$1\u00A0$2');

  const CSS = `
.game[data-game="lasers"] .lz-lab {
  position: absolute; z-index: 3; left: 0; top: 0; margin: 0;
  font: 600 0.8125rem/1.3 var(--font-text); color: #D6F2E4; letter-spacing: 0.005em;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.75);
  pointer-events: none; opacity: 0; transform: translateY(5px);
  transition: opacity 0.45s ease, transform 0.45s ease;
}
.game[data-game="lasers"] .lz-lab.is-on { opacity: 1; transform: none; }
.game[data-game="lasers"] .lz-lab.is-narrow { font-size: 0.75rem; }
.game[data-game="lasers"] .lz-lab b { font-weight: 800; color: var(--lz-c); white-space: nowrap; }
.game[data-game="lasers"] .lz-sw {
  display: inline-block; width: 9px; height: 9px; margin-right: 7px; vertical-align: 0.02em;
  border-radius: 4px 5px 3px 5px; background: var(--lz-c); box-shadow: 0 0 8px var(--lz-c);
}
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
  /* chambre (en rayons de sphère) */
  const SHELL_IN = 0.925, SHELL_OUT = 1;
  const MOD_R = 0.975, MOD_W = 0.3, MOD_D = 0.25;          /* modules : rayon, largeur, profondeur */
  const EXT = 1.13;                                         /* encombrement total, modules compris */
  const RING0 = 0.78, TARGET = 0.19;                        /* départ de l'anneau, cercle-cible */
  const T_HIT = 1.9, RING_GAP = 0.5;                        /* s pour atteindre le cercle ; pause */
  const WINDOWS = [0.35, 0.35, 0.35, 0.75, 1.2, 99];        /* fenêtre de tir (s) selon les ratés */
  const SLOW = [1, 1, 1, 1.25, 1.4, 1.5];                   /* l'anneau ralentit après 3 ratés */
  const PULSE = 0.32, IGN = 0.62, FIRE_END = 1.8;           /* tir : trajet de la lumière, éclair, fin */
  /* bilan (s après l'éclair) : panneau, barre 1, barre 2, réussite, recul de l'échelle, ruban du réseau */
  const BIL = { panel: [0.72, 1.15], l1: 1.1, b1: [1.2, 1.85], l2: 1.9, b2: [2.05, 2.75], done: 2.85, zoom: [5.0, 5.8], l3: 5.2, rib: [5.8, 9.0] };
  const ELEC = '#DCE8E2';                                   /* électricité du réseau : blanc grisé */
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
  /* rectangle en forme de galet : un rayon différent à chaque coin */
  function pebble(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r[0], y);
    g.lineTo(x + w - r[1], y);
    g.arcTo(x + w, y, x + w, y + r[1], r[1]);
    g.lineTo(x + w, y + h - r[2]);
    g.arcTo(x + w, y + h, x + w - r[2], y + h, r[2]);
    g.lineTo(x + r[3], y + h);
    g.arcTo(x, y + h, x, y + h - r[3], r[3]);
    g.lineTo(x, y + r[0]);
    g.arcTo(x, y, x + r[0], y, r[0]);
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
    const BAR_COL = [GREEN, YELLOW, ELEC];

    /* ---- étiquettes des barres (DOM) ---- */
    const labs = TEXTES.barres.map((b, i) => {
      const p = document.createElement('p');
      p.className = 'lz-lab';
      p.style.setProperty('--lz-c', BAR_COL[i]);
      const sw = document.createElement('i');
      sw.className = 'lz-sw';
      sw.setAttribute('aria-hidden', 'true');
      const t = document.createElement('span');
      t.textContent = lib.fr(b.nom + ' : ');
      const v = document.createElement('b');
      v.textContent = nb(b.valeur);
      p.append(sw, t, v);
      stage.appendChild(p);
      return p;
    });

    /* ---- géométrie ---- */
    const G = {
      w: 1, h: 1, cx: 0, cy: 0, R: 100, rb: 4, bx: 0, by: 0, bR: 50,
      P: { x: 0, y: 0, w: 1, h: 1 }, pad: 14, x0: 0, rowW: 1, labY: [0, 0, 0], barY: [0, 0], TB: 10,
      foldY0: 0, pitch: 8, TR: 5, nRows: 4, u1: 1, u2: 1, Ltot: 1,
    };
    const L = { cx: 0, cy: 0, R: 100, s: 1 };   /* mise en page du moment (jeu → bilan) */
    let bg = null, chamber = null, modOff = null, modOn = null, lensGlow = null, panelC = null, ribGrad = null;

    function geometry(w, h) {
      G.w = w;
      G.h = h;
      G.R = (Math.min(w, h) / 2 - 10) / EXT;
      G.cx = w / 2;
      G.cy = h / 2;
      G.rb = clamp(G.R * 0.03, 3.2, 6);
      if (w / h > 1.15) {
        /* scène large : la chambre à gauche, le tableau à droite */
        const left = w * 0.45;
        G.bR = Math.min(left / 2 - 10, h / 2 - 12) / EXT;
        G.bx = left / 2 + 6;
        G.by = h / 2;
        G.P = { x: left + 4, y: 14, w: w - left - 18, h: h - 28 };
      } else {
        /* scène haute : la chambre en haut, le tableau dessous */
        G.bR = clamp(Math.min(w, h * 0.8) * 0.17, 40, 140);
        G.bx = w / 2;
        G.by = 10 + G.bR * EXT;
        const top = G.by + G.bR * EXT + 8;
        G.P = { x: 12, y: top, w: w - 24, h: h - top - 12 };
      }
      layoutPanel();
      buildSprites();
      bg = makeBg(w, h);
      curLayout();
      if (stage.querySelector('.gesture') && gestureGroup >= 0) showGestureOn(gestureGroup);
    }

    function layoutPanel() {
      const P = G.P;
      G.pad = clamp(P.w * 0.05, 12, 20);
      G.x0 = P.x + G.pad;
      G.rowW = P.w - G.pad * 2;
      labs.forEach((l) => {
        l.classList.toggle('is-narrow', G.rowW < 270);
        l.style.width = G.rowW + 'px';
      });
      const hs = labs.map((l) => l.offsetHeight || 18);
      G.TB = clamp(P.h * 0.045, 9, 14);
      let y = P.y + G.pad;
      G.labY[0] = y;
      y += hs[0] + 6;
      G.barY[0] = y + G.TB / 2;
      y += G.TB + 13;
      G.labY[1] = y;
      y += hs[1] + 6;
      G.barY[1] = y + G.TB / 2;
      y += G.TB + 16;
      G.labY[2] = y;
      y += hs[2] + 8;
      G.foldY0 = y;
      const foldH = Math.max(24, P.y + P.h - G.pad - y);
      G.pitch = clamp(foldH / 13, 6, 14);
      G.TR = G.pitch * 0.6;
      G.nRows = Math.max(2, Math.floor((foldH - G.TR) / G.pitch) + 1);
      /* longueur du ruban replié : il s'arrête aux deux tiers de sa dernière rangée */
      const r = G.pitch / 2;
      const first = G.rowW - r, mid = G.rowW - 2 * r, turn = Math.PI * r;
      G.Ltot = first + (G.nRows - 2) * (turn + mid) + turn + mid * 0.65;
      G.u2 = G.Ltot / MJ[2];                 /* échelle finale : px par MJ */
      G.u1 = (G.rowW * 0.9) / MJ[1];         /* échelle de départ, pour bien voir 2,05 et 3,15 */
      ribGrad = ctx.createLinearGradient(0, G.foldY0, 0, G.foldY0 + G.nRows * G.pitch);
      ribGrad.addColorStop(0, '#E9F2EE');
      ribGrad.addColorStop(1, '#A2B6AD');
      labs.forEach((l, i) => {
        l.style.left = G.x0 + 'px';
        l.style.top = G.labY[i] + 'px';
      });
    }

    function curLayout() {
      const k = ease.inOutCubic(clamp(layK));
      L.cx = lerp(G.cx, G.bx, k);
      L.cy = lerp(G.cy, G.by, k);
      L.R = lerp(G.R, G.bR, k);
      L.s = L.R / G.R;
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

    function makePanel() {
      const P = G.P, pad = 12;
      const S = mk(P.w + pad * 2, P.h + pad * 2, cv.dpr);
      S.pad = pad;
      const g = S.g;
      const x = pad, y = pad;
      const q = Math.min(P.w, P.h) / 4;
      const r = [Math.min(18, q), Math.min(24, q), Math.min(16, q), Math.min(22, q)];
      g.save();
      g.shadowColor = 'rgba(0,0,0,0.6)';
      g.shadowBlur = 16 * cv.dpr;
      g.shadowOffsetY = 4 * cv.dpr;
      pebble(g, x, y, P.w, P.h, r);
      g.fillStyle = 'rgba(4,14,10,0.92)';
      g.fill();
      g.restore();
      const gr = g.createLinearGradient(0, y, 0, y + P.h);
      gr.addColorStop(0, 'rgba(16,42,30,0.95)');
      gr.addColorStop(1, 'rgba(5,15,11,0.96)');
      pebble(g, x, y, P.w, P.h, r);
      g.fillStyle = gr;
      g.fill();
      g.strokeStyle = 'rgba(233,255,244,0.16)';
      g.lineWidth = 1;
      g.stroke();
      g.save();
      pebble(g, x, y, P.w, P.h, r);
      g.clip();
      const hl = g.createLinearGradient(0, y, 0, y + 46);
      hl.addColorStop(0, 'rgba(200,255,225,0.08)');
      hl.addColorStop(1, 'rgba(200,255,225,0)');
      g.fillStyle = hl;
      g.fillRect(x, y, P.w, 46);
      const rnd = seeded(41);
      for (let i = 0; i < Math.round((P.w * P.h) / 260); i++) {
        g.fillStyle = rnd() < 0.5 ? `rgba(200,255,225,${0.015 + rnd() * 0.03})` : `rgba(0,0,0,${0.08 + rnd() * 0.1})`;
        g.fillRect(x + rnd() * P.w, y + rnd() * P.h, 1, 1);
      }
      g.restore();
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
      panelC = makePanel();
    }

    /* ---- état ---- */
    const groups = ANGLES.map(() => ({ on: false, t: 0, press: 0, flash: 0, call: 0, delay: 0 }));
    const GI = new Float32Array(GROUPS);       /* intensité des faisceaux de chaque groupe */
    const bead = { size: 1, ox: 0, oy: 0, squash: 0, rot: 0, heat: 0, alpha: 1, born: 1 };
    let phase = 'charge', phaseT = 0, time = 0;
    let charged = 0, allT = 0, idleT = 0, gestureGroup = -1;
    let ringT = -1, misses = 0, winOn = false, winGlow = 0, missRingR = -1;
    let missDir = 0, missHit = false, beadRenewed = false, ignited = false;
    let flash = 0, ember = 0, shake = 0, shockT = -1, echo = 0, echoT = 99, layK = 0, doneGlow = 0;
    let camDur = 1, doneCalled = false, sndB1 = false, sndB2 = false, sndZoom = false, sndRib = false;
    let ribRow = -1, ribRowNow = 0;
    let frozen = false, freezeAt = null;      /* outils de test (adresse avec ?debug) */
    const labOn = [false, false, false];
    const LAB_T = [BIL.l1, BIL.l2, BIL.l3];
    const HEAD = [0, 0];
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
    const tHit = () => T_HIT * SLOW[Math.min(misses, 5)];
    const winSize = () => WINDOWS[Math.min(misses, 5)];

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
    function nearestUncharged(x, y) {
      const a = Math.atan2(y - L.cy, x - L.cx);
      let best = -1, bd = Infinity;
      for (let i = 0; i < GROUPS; i++) {
        if (groups[i].on) continue;
        let da = Math.abs(a - ANGLES[i]) % TAU;
        if (da > Math.PI) da = TAU - da;
        if (da < bd) {
          bd = da;
          best = i;
        }
      }
      return best;
    }

    function chargeGroup(gi) {
      const g = groups[gi];
      g.on = true;
      g.t = 0;
      g.flash = 1;
      charged++;
      idleT = 0;
      api.status(TEXTES.compteur(charged * PER));
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

    function startBilan() {
      setPhase('bilan');
      camDur = RM ? 0.5 : 1.05;
      doneCalled = false;
      sndB1 = sndB2 = sndZoom = sndRib = false;
      ribRow = -1;
    }

    function onTap(x, y, info) {
      if (phase === 'charge' && info.ph === 'charge') {
        const gi = info.gi;
        if (gi < 0) {
          const n = nearestUncharged(x, y);
          if (n >= 0) groups[n].call = 1;
          api.sfx.play('tick', { pitch: 0.7 });
          return;
        }
        const g = groups[gi];
        if (g.on) {
          g.flash = Math.max(g.flash, 0.5);
          api.sfx.play('tick', { pitch: 1.4 });
          return;
        }
        chargeGroup(gi);
        return;
      }
      if (phase === 'sync' && info.ph === 'sync') {
        judge(info);
        return;
      }
      if (phase === 'bilan' && api.isDone()) {
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
      return echo * 0.9;   /* bilan : les lasers ont tiré, il ne reste que l'écho des tapes */
    }

    function update(dt) {
      time += dt;
      phaseT += dt;
      for (let i = 0; i < GROUPS; i++) {
        const g = groups[i];
        if (g.on) g.t += dt;
        g.press = Math.max(0, g.press - dt * 5);
        g.flash = Math.max(0, g.flash - dt * 2.2);
        g.call = Math.max(0, g.call - dt * 1.3);
      }
      if (bead.born < 1) bead.born = Math.min(1, bead.born + dt / 0.45);
      shake = Math.max(0, shake - dt * 3.2);
      flash *= Math.exp(-dt * 4.2);
      if (flash < 0.003) flash = 0;
      if (ember > 0) ember = Math.max(phase === 'bilan' ? 0.3 : 0, ember - dt * 0.4);
      echo = Math.max(0, echo - dt * 1.5);
      echoT += dt;
      doneGlow = Math.max(0, doneGlow - dt * 0.6);
      if (shockT >= 0) {
        shockT += dt;
        if (shockT > 0.8) shockT = -1;
      }

      if (phase === 'charge') {
        idleT += dt;
        if (charged === GROUPS) {
          allT += dt;
          if (allT > 0.55) startArm();
        } else if (idleT > 6) {
          /* personne ne tape : le doigt fantôme montre un groupe encore éteint */
          idleT = 0;
          const gi = ORDER.find((k) => !groups[k].on);
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
        if (ringT >= 0 && RING0 - v * ringT <= 0.035) ringT = -RING_GAP;
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
          if (misses >= 3) api.hint(TEXTES.aide);
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
        if (t > FIRE_END) startBilan();
      } else if (phase === 'bilan') {
        const bt = phaseT;
        layK = clamp(bt / camDur);
        for (let i = 0; i < 3; i++) {
          const on = bt >= LAB_T[i];
          if (on !== labOn[i]) {
            labOn[i] = on;
            labs[i].classList.toggle('is-on', on);
          }
        }
        if (!sndB1 && bt >= BIL.b1[0]) {
          sndB1 = true;
          api.sfx.play('tick', { pitch: 1, gap: 0 });
        }
        if (!sndB2 && bt >= BIL.b2[0]) {
          sndB2 = true;
          api.sfx.play('tick', { pitch: 1.35, gap: 0 });
        }
        if (!doneCalled && bt >= BIL.done) {
          doneCalled = true;
          doneGlow = 1;
          api.done(nb(TEXTES.fin), nb(TEXTES.finStatut));
          api.guide(null, 'laugh', TEXTES.bravo);
        }
        if (!sndZoom && bt >= BIL.zoom[0]) {
          sndZoom = true;
          api.sfx.play('whoosh', { pitch: 0.7, volume: 0.4, gap: 0 });
        }
        if (!sndRib && bt >= BIL.rib[0]) {
          sndRib = true;
          api.sfx.play('scrape', { pitch: 0.8, gap: 0 });
        }
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
      curLayout();
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
      const fade = 1 - ease.inOutCubic(clamp(layK));
      if (fade <= 0.01) return;
      const far = Math.max(G.w, G.h);
      for (let i = 0; i < GROUPS; i++) {
        const on = groups[i].on;
        const a = fade * (on ? 0.06 + GI[i] * 0.12 : 0.04);
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
      if (phase === 'bilan') return echoT / PULSE;
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
      const dim = phase === 'bilan' ? 0.55 : 1;
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

    /* ---- le tableau des énergies ---- */
    function drawBar(len, y, T, c0, c1, glow) {
      if (len < 0.5) return;
      const x0 = G.x0, top = y - T / 2, rr = Math.min(T / 2, len);
      const gr = ctx.createLinearGradient(x0, 0, x0 + Math.max(len, 1), 0);
      gr.addColorStop(0, c0);
      gr.addColorStop(1, c1);
      ctx.save();
      ctx.shadowColor = rgba(glow, 0.75);
      ctx.shadowBlur = 12 * cv.dpr;
      ctx.beginPath();
      ctx.moveTo(x0, top);
      ctx.lineTo(x0 + len - rr, top);
      ctx.arc(x0 + len - rr, y, rr, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(x0, top + T);
      ctx.closePath();
      ctx.fillStyle = gr;
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.32)';
      ctx.fillRect(x0, top + T * 0.18, Math.max(0, len - rr), Math.max(0.8, T * 0.15));
    }

    /* Le ruban de l'électricité du réseau : il se replie en rangées, comme un serpent */
    function ribbonPath(len) {
      const r = G.pitch / 2, xL = G.x0, xR = G.x0 + G.rowW;
      let x = xL, y = G.foldY0 + G.TR / 2, dir = 1, rem = len;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let row = 0; row < G.nRows; row++) {
        ribRowNow = row;
        const xe = dir > 0 ? xR - r : xL + r;
        const seg = Math.abs(xe - x);
        if (rem <= seg) {
          x += dir * rem;
          ctx.lineTo(x, y);
          HEAD[0] = x;
          HEAD[1] = y;
          return;
        }
        ctx.lineTo(xe, y);
        rem -= seg;
        x = xe;
        if (row === G.nRows - 1) break;
        const turn = Math.PI * r, cyy = y + r;
        if (rem <= turn) {
          const a = rem / r;
          if (dir > 0) {
            ctx.arc(x, cyy, r, -Math.PI / 2, -Math.PI / 2 + a, false);
            HEAD[0] = x + r * Math.sin(a);
          } else {
            ctx.arc(x, cyy, r, -Math.PI / 2, -Math.PI / 2 - a, true);
            HEAD[0] = x - r * Math.sin(a);
          }
          HEAD[1] = cyy - r * Math.cos(a);
          return;
        }
        ctx.arc(x, cyy, r, -Math.PI / 2, Math.PI / 2, dir < 0);
        rem -= turn;
        y += 2 * r;
        dir = -dir;
      }
      HEAD[0] = x;
      HEAD[1] = y;
    }

    function drawBilan() {
      const bt = phaseT;
      const pa = ease.outCubic(clamp((bt - BIL.panel[0]) / (BIL.panel[1] - BIL.panel[0])));
      if (pa <= 0.01) return;
      ctx.globalAlpha = pa;
      ctx.drawImage(panelC.c, G.P.x - panelC.pad, G.P.y - panelC.pad + (1 - pa) * 14, panelC.w, panelC.h);
      const zk = ease.inOutCubic(clamp((bt - BIL.zoom[0]) / (BIL.zoom[1] - BIL.zoom[0])));
      const u = G.u1 * Math.pow(G.u2 / G.u1, zk);    /* on « recule » : l'échelle diminue */
      const T = lerp(G.TB, G.TR, zk);
      /* ligne de départ commune aux trois barres */
      const yb0 = G.barY[0] - G.TB / 2 - 5;
      const yb1 = labOn[2] ? G.foldY0 + (G.nRows - 1) * G.pitch + G.TR + 4 : G.barY[1] + G.TB / 2 + 5;
      ctx.fillStyle = 'rgba(233,255,244,0.26)';
      ctx.fillRect(G.x0 - 2, yb0, 1, yb1 - yb0);
      const g1 = ease.outCubic(clamp((bt - BIL.b1[0]) / (BIL.b1[1] - BIL.b1[0])));
      const g2 = ease.outCubic(clamp((bt - BIL.b2[0]) / (BIL.b2[1] - BIL.b2[0])));
      drawBar(MJ[0] * u * g1, G.barY[0], T, '#0E7444', GREEN, GREEN);
      drawBar(MJ[1] * u * g2, G.barY[1], T, '#987000', YELLOW, YELLOW);
      ctx.globalAlpha = 1;
      if (doneGlow > 0.01 && g2 > 0) {
        /* la fusion a rendu plus que ce que la cible a reçu : la barre jaune dépasse */
        ctx.globalCompositeOperation = 'lighter';
        const ex = G.x0 + MJ[1] * u * g2;
        draw.glow(ctx, ex, G.barY[1], 18 + 10 * (1 - doneGlow), '#FFF3B0', 0.8 * doneGlow);
        ctx.globalCompositeOperation = 'source-over';
      }
      const rk = clamp((bt - BIL.rib[0]) / (BIL.rib[1] - BIL.rib[0]));
      if (rk > 0) {
        ribbonPath(G.Ltot * ease.inOutSine(rk));
        ctx.lineJoin = 'round';
        ctx.lineCap = 'butt';
        ctx.save();
        ctx.shadowColor = 'rgba(220,240,230,0.35)';
        ctx.shadowBlur = 7 * cv.dpr;
        ctx.strokeStyle = ribGrad;
        ctx.lineWidth = G.TR;
        ctx.stroke();
        ctx.restore();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = Math.max(0.7, G.TR * 0.2);
        ctx.stroke();
        ctx.lineJoin = 'miter';
        if (ribRowNow !== ribRow) {
          ribRow = ribRowNow;
          if (ribRow > 0) api.sfx.play('tick', { pitch: 0.9 + ribRow * 0.04, volume: 0.5, gap: 40 });
        }
        if (rk < 1) {
          ctx.globalCompositeOperation = 'lighter';
          draw.glow(ctx, HEAD[0], HEAD[1], G.TR * 3.2, '#FFFFFF', 0.85);
          ctx.globalCompositeOperation = 'source-over';
        }
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
      if (phase === 'bilan') drawBilan();
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
      layK = 0;
      winGlow = 0;
      doneGlow = 0;
      doneCalled = false;
      ribRow = -1;
      groups.forEach((g) => {
        g.on = false;
        g.t = 0;
        g.press = 0;
        g.flash = 0;
        g.call = 0;
        g.delay = 0;
      });
      resetBead();
      bead.born = 1;
      SPARK.forEach((s) => { s.on = false; });
      WAVE.forEach((wv) => { wv.on = false; });
      presses.clear();
      for (let i = 0; i < 3; i++) {
        labOn[i] = false;
        labs[i].classList.remove('is-on');
      }
      winOn = true;
      setWin(false);
      curLayout();
      api.status(TEXTES.compteur(0));
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
        state: () => ({ phase, phaseT, ringT, misses, winOn, layK, charged }),
      };
    }

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => { if (G.w > 1) layoutPanel(); });
    }

    cv.onResize(geometry);
    api.onReset(init);
    init();
    update(0.016);
    render();
  };
})();
