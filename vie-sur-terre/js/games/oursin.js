/* L’oursin : en tournant sur lui-même, il racle la roche avec ses dents et ses piquants
   et se creuse un abri. Vue de dessus d’un fond rocheux sous l’eau, lumière ondulante. */
(function () {
  'use strict';
  const { lib } = window.RM;
  const { TAU, rand, clamp, lerp, ease, rgba, pick, draw } = lib;

  /* Tous les textes du jeu */
  const TEXTES = {
    profondeur: (cm) => `Profondeur de l’abri : ${cm} cm`,
    rate: 'Fais tourner ton doigt autour de l’oursin, ou tape dessus.',
    fin: 'L’oursin est à l’abri dans son trou.',
    finStatut: 'Avec leurs dents et leurs piquants, certains oursins creusent lentement leur abri dans la roche.',
  };

  const TURNS = 6;          /* tours de doigt pour finir le trou */
  const MAX_CM = 5;         /* profondeur affichée à la fin */
  const TAP_TURNS = 0.25;   /* une tape sur l’oursin vaut ce nombre de tours (plus lent que tourner) */
  const GOAL = TURNS * TAU;
  const LIGHT = Math.atan2(-1, -1); /* la lumière vient d’en haut à gauche */
  const SEUIL = 0.47;       /* relief : au-dessus, la dalle de roche ; en dessous, l’eau plus profonde */

  const DUST = ['#F2EBDD', '#E2D7C2', '#FBF7EE', '#D4C8B1'];
  const CORAL = ['#B98890', '#C99CA2', '#A9798A', '#D3AEB0'];

  /* piquants : 4 étages × 4 éclairages, base sombre et pointe plus claire */
  const SP_BASE = [['#12060F', '#1B0B1E', '#24112A', '#2D1734'], ['#1E0D24', '#2A1532', '#361D40', '#43264F'], ['#2A1432', '#381E42', '#472853', '#573364'], ['#352040', '#462B52', '#573864', '#6A4778']];
  const SP_TIP = [['#3B2342', '#4A2E52', '#5A3963', '#6B4675'], ['#55345F', '#674072', '#7A4E86', '#8F5F9C'], ['#6A4675', '#7E5689', '#93679E', '#A97BB4'], ['#7C5888', '#92699E', '#A87CB4', '#BE92C9']];

  window.RM.games.oursin = function (api) {
    const cv = api.canvas();
    const ctx = cv.ctx;
    const CALM = api.reducedMotion;
    const nz = lib.makeNoise(41);

    /* ---------- état ---------- */
    let dig = 0;          /* angle cumulé utile (radians) */
    let digPending = 0;   /* creusement en attente (tapes) */
    let depthK = 0;       /* profondeur dessinée, 0..1 */
    let rot = 0;          /* rotation de l’oursin */
    let spinVel = 0;      /* vitesse de rotation (rad/s), inertie */
    let effort = 0;       /* intensité du raclage, pour les effets */
    let finished = false;
    let shownCm = -1;
    let misses = 0;
    let rateT = 0;
    let touched = false;
    let pressing = false;
    let lastAng = null;
    let nextTurn = TAU;
    let leanK = 0;
    let leanA = 0;
    let time = 0;
    let dustT = 0;
    let dust = [], puffs = [], rings = [];
    const specks = [];
    const trail = [];
    for (let i = 0; i < 22; i++) trail.push({ x: 0, y: 0, t: -9 });
    let trailHead = 0;
    const finger = { x: 0, y: 0, on: false, hoverT: -9 };

    /* ---------- géométrie et pré-rendus ---------- */
    const G = { w: 1, h: 1, cx: 0, cy: 0, S: 1, R: 1, L: 1, U: 1 };
    let bg = null, shadeSpr = null, patSpr = null, hiSpr = null, puffSpr = null;
    let algae = [], spines = [], feet = [], rimSpecks = [], grooves = [];
    let cau = null, cctx = null, caw = 0, cah = 0, caImg = null, caMask = null;

    function layer(w, h) {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(w * cv.dpr));
      c.height = Math.max(1, Math.round(h * cv.dpr));
      const g = c.getContext('2d');
      g.scale(cv.dpr, cv.dpr);
      return { c, g };
    }

    function height(x, y) {
      const S = G.S;
      const d = Math.hypot(x - G.cx, y - G.cy) / (S * 0.8);
      return 0.58 * nz.fbm(x / (S * 0.42) + 3.1, y / (S * 0.42) + 7.4, 4) + 0.5 * (1 - d) + 0.05;
    }
    const smooth = (a, b, v) => {
      const t = clamp((v - a) / (b - a));
      return t * t * (3 - 2 * t);
    };

    function makeBg(w, h) {
      const s = 2;
      const gw = Math.ceil(w / s), gh = Math.ceil(h / s);
      const c0 = document.createElement('canvas');
      c0.width = gw;
      c0.height = gh;
      const g0 = c0.getContext('2d');
      const img = g0.createImageData(gw, gh);
      const d = img.data;
      const A = lib.hexToRgb('#9C8F7E'), B = lib.hexToRgb('#7E7264');
      const LT = lib.hexToRgb('#B8AC96'), DK = lib.hexToRgb('#5E554A'), OC = lib.hexToRgb('#A08A68');
      const W1 = lib.hexToRgb('#1E6F7A'), W2 = lib.hexToRgb('#0E3F4A'), WALL = lib.hexToRgb('#4C463F');
      const k1 = G.S / 360;
      const fb = (x, y, sc, ox, oy, o) => nz.fbm(x / (sc * k1) + ox, y / (sc * k1) + oy, o);
      for (let y = 0; y < gh; y++) {
        for (let x = 0; x < gw; x++) {
          const px = x * s + 1, py = y * s + 1;
          const H = height(px, py);
          const j = (y * gw + x) * 4;
          /* eau plus profonde : turquoise près de la dalle, bleu au large */
          const deep = clamp((SEUIL - H) * 5);
          const tt = clamp((px / w) * 0.4 + (py / h) * 0.6);
          let wr = lerp(lerp(W1[0], W2[0], tt * 0.45), W2[0], deep);
          let wg = lerp(lerp(W1[1], W2[1], tt * 0.45), W2[1], deep);
          let wb = lerp(lerp(W1[2], W2[2], tt * 0.45), W2[2], deep);
          const sand = nz.noise2(px / (3 * k1) + 9, py / (3 * k1) + 4) * 8 - 4;
          wr += sand; wg += sand; wb += sand;
          if (height(px - 8 * k1, py - 8 * k1) > SEUIL) { /* ombre portée par la dalle */
            wr *= 0.72; wg *= 0.78; wb *= 0.82;
          }
          /* roche calcaire : marbrures, taches ocre, creux sombres, relief éclairé d’en haut à gauche */
          const n1 = fb(px, py, 30, 11, 5, 4);
          const n2 = fb(px, py, 9, 40, 21, 3);
          const n4 = fb(px, py, 60, 70, 33, 2);
          let t = clamp((n1 - 0.32) * 2.2);
          let r = lerp(A[0], B[0], t), g = lerp(A[1], B[1], t), b = lerp(A[2], B[2], t);
          const oc = clamp((n4 - 0.55) * 4) * 0.55;
          r = lerp(r, OC[0], oc); g = lerp(g, OC[1], oc); b = lerp(b, OC[2], oc);
          if (n2 > 0.58) {
            const k = clamp((n2 - 0.58) * 4) * 0.7;
            r = lerp(r, LT[0], k); g = lerp(g, LT[1], k); b = lerp(b, LT[2], k);
          } else if (n2 < 0.36) {
            const k = clamp((0.36 - n2) * 4) * 0.7;
            r = lerp(r, DK[0], k); g = lerp(g, DK[1], k); b = lerp(b, DK[2], k);
          }
          const sh = (fb(px - 2, py - 2, 30, 11, 5, 3) - fb(px + 2, py + 2, 30, 11, 5, 3)) * 300;
          r += sh; g += sh; b += sh;
          /* paroi de la dalle qui plonge vers l’eau, en dégradé doux */
          const lip = smooth(SEUIL, SEUIL + 0.035, H);
          r = lerp(WALL[0], r, lip); g = lerp(WALL[1], g, lip); b = lerp(WALL[2], b, lip);
          const m = smooth(SEUIL - 0.006, SEUIL + 0.006, H);
          d[j] = lerp(wr, r, m); d[j + 1] = lerp(wg, g, m); d[j + 2] = lerp(wb, b, m); d[j + 3] = 255;
        }
      }
      g0.putImageData(img, 0, 0);
      /* masque des caustiques : franches sur la roche, plus douces en eau profonde */
      caMask = new Float32Array(caw * cah);
      for (let y = 0; y < cah; y++) {
        for (let x = 0; x < caw; x++) {
          const H = height(((x + 0.5) * w) / caw, ((y + 0.5) * h) / cah);
          caMask[y * caw + x] = lerp(0.35, 1, smooth(SEUIL - 0.08, SEUIL + 0.02, H));
        }
      }

      const { c, g } = layer(w, h);
      g.imageSmoothingEnabled = true;
      g.drawImage(c0, 0, 0, w, h);
      const U = G.U;
      const free = (x, y, m) => height(x, y) > SEUIL + (m || 0.02) && Math.hypot(x - G.cx, y - G.cy) > G.R * 2.6;
      /* croûtes d’algues calcaires, roses */
      for (let i = 0, n = 0; i < 300 && n < 6; i++) {
        const x = rand(w), y = rand(h);
        if (!free(x, y, 0.04)) continue;
        n++;
        const r = rand(7, 15) * U;
        g.save();
        draw.blob(g, x, y, r, 0.35, rand(10), 0, 24);
        g.clip();
        g.fillStyle = rgba('#B08088', 0.4);
        g.fillRect(x - r * 1.5, y - r * 1.5, r * 3, r * 3);
        for (let k = 0; k < 40; k++) {
          g.fillStyle = rgba(pick(CORAL), rand(0.3, 0.65));
          g.beginPath();
          g.arc(x + rand(-r, r) * 1.2, y + rand(-r, r) * 1.2, rand(0.8, 2.6) * U, 0, TAU);
          g.fill();
        }
        g.restore();
        draw.blob(g, x, y, r, 0.35, 0, 0, 24);
        g.strokeStyle = rgba('#EBD3D1', 0.35);
        g.lineWidth = 1.2 * U;
        g.stroke();
      }
      /* fissures fines, effilées */
      g.lineCap = 'round';
      for (let i = 0, n = 0; i < 80 && n < 6; i++) {
        let x = rand(w), y = rand(h);
        if (!free(x, y, 0.06)) continue;
        n++;
        let a = rand(TAU);
        const steps = 6 + Math.floor(rand(9));
        for (let k = 0; k < steps; k++) {
          const nxp = x + Math.cos(a) * 4.5 * U, nyp = y + Math.sin(a) * 4.5 * U;
          if (height(nxp, nyp) < SEUIL + 0.03) break;
          const wd = (1 - k / steps) * 1.4 * U + 0.4;
          g.strokeStyle = rgba('#D3C7B2', 0.4);
          g.lineWidth = wd * 0.7;
          g.beginPath();
          g.moveTo(x + 0.9, y + 0.9);
          g.lineTo(nxp + 0.9, nyp + 0.9);
          g.stroke();
          g.strokeStyle = rgba('#51473C', 0.6);
          g.lineWidth = wd;
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(nxp, nyp);
          g.stroke();
          x = nxp;
          y = nyp;
          a += rand(-0.7, 0.7);
        }
      }
      /* petits trous du calcaire et grains clairs */
      for (let i = 0; i < 420; i++) {
        const x = rand(w), y = rand(h);
        if (height(x, y) < SEUIL + 0.012) continue;
        if (Math.random() < 0.55) {
          const r = Math.pow(Math.random(), 2) * 2.4 * U + 0.5;
          g.fillStyle = rgba('#3A322A', rand(0.45, 0.8));
          g.beginPath();
          g.arc(x, y, r, 0, TAU);
          g.fill();
          g.strokeStyle = rgba('#D8CCB6', 0.5);
          g.lineWidth = Math.max(0.6, r * 0.45);
          g.beginPath();
          g.arc(x, y, r, 0.05 * Math.PI, 0.55 * Math.PI);
          g.stroke();
        } else {
          g.fillStyle = rgba(Math.random() < 0.6 ? '#D9CFBC' : '#6A6055', rand(0.3, 0.7));
          const sz = rand(0.6, 1.5);
          g.fillRect(x, y, sz, sz);
        }
      }
      /* débris de coquillages */
      for (let i = 0, n = 0; i < 300 && n < 14; i++) {
        const x = rand(w), y = rand(h);
        if (!free(x, y)) continue;
        n++;
        const r = rand(1.4, 3) * U;
        const a = rand(TAU);
        g.fillStyle = rgba('#F3EEE2', 0.8);
        g.beginPath();
        g.ellipse(x, y, r * 1.4, r, a, 0, Math.PI);
        g.fill();
        g.strokeStyle = rgba('#B7AA92', 0.6);
        g.lineWidth = 0.6;
        for (let k = 1; k < 3; k++) {
          g.beginPath();
          g.ellipse(x, y, r * 1.4 * k / 3, r * k / 3, a, 0, Math.PI);
          g.stroke();
        }
      }
      /* voile d’eau, très léger, et bords plus sombres */
      const tint = g.createLinearGradient(0, 0, w, h);
      tint.addColorStop(0, rgba('#2A8A93', 0.12));
      tint.addColorStop(1, rgba('#0E3F4A', 0.26));
      g.fillStyle = tint;
      g.fillRect(0, 0, w, h);
      const vig = g.createRadialGradient(G.cx, G.cy, G.S * 0.35, G.cx, G.cy, Math.hypot(w, h) * 0.6);
      vig.addColorStop(0, 'rgba(6,34,42,0)');
      vig.addColorStop(1, 'rgba(6,34,42,0.5)');
      g.fillStyle = vig;
      g.fillRect(0, 0, w, h);
      return c;
    }

    /* algues : touffes de lanières qui ondulent avec la houle */
    function makeAlgae() {
      algae = [];
      const S = G.S;
      const kinds = [
        { col: '#6E7F2E', tip: '#B3C063', wd: 0.016, len: [0.09, 0.15], n: [5, 7], fork: true },
        { col: '#4F8A3E', tip: '#9BD07A', wd: 0.024, len: [0.06, 0.1], n: [4, 6], fork: false },
        { col: '#8A4E3A', tip: '#CC8A6A', wd: 0.009, len: [0.06, 0.11], n: [8, 11], fork: false },
        { col: '#73702F', tip: '#C2B868', wd: 0.014, len: [0.08, 0.13], n: [5, 7], fork: true },
      ];
      const base = rand(TAU);
      const flow = rand(TAU);
      for (let i = 0; i < 4; i++) {
        let spot = null;
        for (let tries = 0; tries < 60 && !spot; tries++) {
          const a = base + (i / 4) * TAU + rand(-0.5, 0.5);
          const rr = rand(0.3, 0.42);
          const x = G.cx + Math.cos(a) * rr * G.w;
          const y = G.cy + Math.sin(a) * rr * G.h;
          const m = G.S * 0.12;
          if (x < m || y < m || x > G.w - m || y > G.h - m) continue;
          if (height(x, y) > SEUIL + 0.03) spot = [x, y];
        }
        if (!spot) continue;
        const K = kinds[i % kinds.length];
        const blades = [];
        const nb = K.n[0] + Math.floor(rand(K.n[1] - K.n[0] + 1));
        for (let k = 0; k < nb; k++) {
          blades.push({
            a: flow + rand(-1.1, 1.1),
            len: S * rand(K.len[0], K.len[1]),
            wd: S * K.wd * rand(0.75, 1.2),
            ph: rand(TAU),
            fork: K.fork && Math.random() < 0.7,
            fa: rand(0.25, 0.45) * (Math.random() < 0.5 ? -1 : 1),
          });
        }
        algae.push({ x: spot[0], y: spot[1], K, blades });
      }
    }

    function makeUrchinSprites() {
      const R = G.R;
      const D = Math.ceil(R * 2.3);
      const half = D / 2;
      /* volume du corps (fixe : la lumière ne tourne pas) */
      let L = layer(D, D);
      let g = L.g;
      const gr = g.createRadialGradient(half - R * 0.34, half - R * 0.4, R * 0.04, half, half, R);
      gr.addColorStop(0, '#7A528C');
      gr.addColorStop(0.32, '#4B2958');
      gr.addColorStop(0.72, '#2A1232');
      gr.addColorStop(1, '#14070F');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(half, half, R, 0, TAU);
      g.fill();
      shadeSpr = { c: L.c, D };
      /* motif qui tourne avec l’oursin : cinq doubles rangées de pores, tubercules, disque central */
      L = layer(D, D);
      g = L.g;
      g.translate(half, half);
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * TAU;
        for (let sd = -1; sd <= 1; sd += 2) {
          for (let i = 0; i < 9; i++) {
            const t = i / 8;
            const rr = lerp(0.24, 0.93, t) * R;
            const aa = a + sd * lerp(0.05, 0.16, t);
            g.fillStyle = rgba('#B58FC2', 0.55 - t * 0.25);
            g.beginPath();
            g.arc(Math.cos(aa) * rr, Math.sin(aa) * rr, R * lerp(0.022, 0.034, t), 0, TAU);
            g.fill();
          }
        }
        const b = a + TAU / 10;
        for (let i = 0; i < 6; i++) {
          const t = i / 5;
          const rr = lerp(0.3, 0.9, t) * R;
          for (let sd = -1; sd <= 1; sd += 2) {
            const aa = b + sd * lerp(0.08, 0.2, t);
            const x = Math.cos(aa) * rr, y = Math.sin(aa) * rr;
            g.fillStyle = rgba('#1A0A1F', 0.7);
            g.beginPath();
            g.arc(x, y, R * 0.05, 0, TAU);
            g.fill();
            g.fillStyle = rgba('#9A72A8', 0.55);
            g.beginPath();
            g.arc(x - R * 0.012, y - R * 0.012, R * 0.022, 0, TAU);
            g.fill();
          }
        }
      }
      g.fillStyle = '#6D4C78';
      g.beginPath();
      g.arc(0, 0, R * 0.17, 0, TAU);
      g.fill();
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * TAU + TAU / 10;
        g.fillStyle = '#8E6B9A';
        g.beginPath();
        g.arc(Math.cos(a) * R * 0.13, Math.sin(a) * R * 0.13, R * 0.04, 0, TAU);
        g.fill();
      }
      g.fillStyle = '#1C0D22';
      g.beginPath();
      g.arc(0, 0, R * 0.07, 0, TAU);
      g.fill();
      patSpr = { c: L.c, D };
      /* reflet humide et contre-jour (fixes) */
      L = layer(D, D);
      g = L.g;
      draw.glow(g, half - R * 0.36, half - R * 0.42, R * 0.5, '#F4E6FF', 0.26);
      g.strokeStyle = rgba('#B9A6C8', 0.22);
      g.lineWidth = R * 0.06;
      g.beginPath();
      g.arc(half, half, R * 0.94, 0.05 * Math.PI, 0.55 * Math.PI);
      g.stroke();
      hiSpr = { c: L.c, D };
    }

    function makePuff() {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d');
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(236,228,212,1)');
      gr.addColorStop(0.45, 'rgba(236,228,212,0.5)');
      gr.addColorStop(1, 'rgba(236,228,212,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 64);
      return c;
    }

    /* piquants : des anneaux sur la sphère, vus de dessus (raccourcis près du sommet) */
    function makeSpines() {
      spines = [];
      const ringsDef = [[118, 24], [104, 28], [90, 28], [76, 24], [62, 19], [48, 15], [34, 10], [20, 5]];
      ringsDef.forEach(([deg, n], ri) => {
        const phi = (deg * Math.PI) / 180;
        for (let i = 0; i < n; i++) {
          spines.push({
            a: ((i + (ri % 2) * 0.5) / n) * TAU + rand(-0.06, 0.06),
            sinPhi: Math.sin(phi),
            back: deg > 90,
            len: rand(0.82, 1.06),
            wd: rand(0.85, 1.15),
            ph: rand(TAU),
            fq: rand(0.8, 1.8),
            tone: deg > 90 ? 0 : deg > 70 ? 1 : deg > 45 ? 2 : 3,
          });
        }
      });
      feet = [];
      for (let k = 0; k < 5; k++) {
        for (let i = 0; i < 3; i++) {
          feet.push({ a: (k / 5) * TAU + (i - 1) * 0.07, ph: rand(TAU), fq: rand(0.25, 0.5), len: rand(0.9, 1.2) });
        }
      }
      rimSpecks = [];
      for (let i = 0; i < 90; i++) rimSpecks.push({ a: rand(TAU), r: 1 + Math.pow(Math.random(), 1.6) * 0.45, s: rand(0.7, 2), c: pick(DUST), th: rand(0.04, 1) });
      grooves = [];
      for (let i = 0; i < 7; i++) grooves.push({ r: lerp(0.5, 0.95, i / 6), a0: rand(TAU), len: rand(1.2, 2.6) * Math.PI, th: rand(0.2, 0.8) });
    }

    function layout(w, h) {
      G.w = w;
      G.h = h;
      G.cx = w / 2;
      G.cy = h / 2;
      G.S = Math.min(w, h);
      G.U = G.S / 360;
      G.R = G.S * 0.1;
      G.L = G.R * 0.95;
      const cs = Math.max(4, Math.max(w, h) / 110); /* calque de caustiques plafonné (perf.) */
      caw = Math.max(32, Math.round(w / cs));
      cah = Math.max(32, Math.round(h / cs));
      cau = document.createElement('canvas');
      cau.width = caw;
      cau.height = cah;
      cctx = cau.getContext('2d');
      caImg = cctx.createImageData(caw, cah);
      bg = makeBg(w, h);
      makeAlgae();
      makeUrchinSprites();
      if (!puffSpr) puffSpr = makePuff();
      specks.length = 0;
      for (let i = 0; i < 46; i++) specks.push({ x: rand(w), y: rand(h), s: rand(0.6, 1.6), a: rand(0.2, 0.5), vx: 0, vy: 0, ph: rand(TAU) });
      if (!touched) showGesture();
    }
    makeSpines();
    cv.onResize((w, h) => layout(w, h));

    function showGesture() {
      api.gesture('circle', { x: 50, y: 50, radius: Math.round(G.R * 2) });
    }

    /* ---------- état initial ---------- */
    function init() {
      dig = 0;
      digPending = 0;
      depthK = 0;
      rot = rand(TAU);
      spinVel = 0;
      effort = 0;
      finished = false;
      shownCm = -1;
      misses = 0;
      rateT = 0;
      touched = false;
      pressing = false;
      lastAng = null;
      nextTurn = TAU;
      leanK = 0;
      dustT = 0;
      dust = [];
      puffs = [];
      rings = [];
      for (const t of trail) t.t = -9;
      finger.on = false;
      updateStatus();
      showGesture();
    }

    function progress() {
      return clamp(dig / GOAL);
    }

    function updateStatus() {
      const p = progress();
      api.progress(p);
      const cm = Math.min(MAX_CM, Math.floor(p * MAX_CM + 1e-6));
      if (cm === shownCm || rateT > 0) return;
      if (shownCm >= 0 && cm > shownCm) {
        api.sfx.play('tick', { pitch: 0.8 + cm * 0.1, gap: 0 });
        api.buzz(10);
      }
      shownCm = cm;
      if (!finished) api.status(TEXTES.profondeur(cm));
    }

    function holeR() {
      return G.R * lerp(1.1, 1.62, ease.outQuad(depthK));
    }

    /* ---------- creusement ---------- */
    function emitDust(n, aroundA) {
      const Rh = holeR();
      for (let i = 0; i < n; i++) {
        if (dust.length > 320) break;
        const a = aroundA == null ? rand(TAU) : aroundA + rand(-0.9, 0.9);
        const r0 = Rh * rand(0.8, 1.05);
        const v = rand(16, 56) * G.U;
        dust.push({
          x: G.cx + Math.cos(a) * r0, y: G.cy + Math.sin(a) * r0,
          vx: Math.cos(a) * v, vy: Math.sin(a) * v,
          t: 0, dur: rand(0.8, 1.7), r: rand(0.8, 2.2) * G.U, c: pick(DUST),
        });
      }
    }

    function puffAt(a) {
      if (puffs.length > 26) return;
      const Rh = holeR();
      puffs.push({ x: G.cx + Math.cos(a) * Rh, y: G.cy + Math.sin(a) * Rh, vx: Math.cos(a) * 12, vy: Math.sin(a) * 12, t: 0, dur: rand(1.3, 2.2), r0: G.R * 0.3, r1: G.R * rand(0.7, 1.05), a: rand(0.3, 0.45) });
    }

    function addDig(amount, a) {
      if (finished) {
        effort = Math.min(1.5, effort + amount * 0.6);
        if (Math.random() < 0.35) emitDust(1, a);
        return;
      }
      dig += amount;
      effort = Math.min(1.5, effort + amount * 1.2);
      emitDust(Math.min(6, 1 + Math.round(amount * 9)), a);
      dustT += amount;
      if (dustT > 0.8) {
        dustT = 0;
        puffAt(a == null ? rand(TAU) : a);
      }
      api.sfx.play('scrape', { gap: 80, pitch: rand(0.85, 1.2), volume: 0.8 });
      while (dig >= nextTurn) {
        nextTurn += TAU;
        api.buzz(8);
      }
      updateStatus();
      if (dig >= GOAL) {
        dig = GOAL;
        finished = true;
        digPending = 0;
        for (let i = 0; i < 7; i++) puffAt((i / 7) * TAU);
        rings.push({ x: G.cx, y: G.cy, t: 0, dur: 1.1, r0: holeR(), r1: holeR() * 1.9, col: '#FFE08A', w: 2.5 });
        api.done(TEXTES.fin, TEXTES.finStatut);
      }
    }

    function onMove(x, y) {
      const dx = x - G.cx, dy = y - G.cy;
      const d = Math.hypot(dx, dy);
      if (d >= G.R * 0.4 && d <= G.R * 3) {
        const a = Math.atan2(dy, dx);
        if (lastAng !== null) {
          let da = a - lastAng;
          if (da > Math.PI) da -= TAU;
          else if (da < -Math.PI) da += TAU;
          da = clamp(da, -0.9, 0.9);
          rot += da * 0.55;
          spinVel = lerp(spinVel, da * 0.55 * 60, 0.25);
          addDig(Math.abs(da), a);
        }
        lastAng = a;
      } else {
        lastAng = null;
      }
    }

    function onTap(x, y) {
      const d = Math.hypot(x - G.cx, y - G.cy);
      if (d < G.R * 2.3) {
        misses = 0;
        if (!finished) digPending += TAP_TURNS * TAU;
        spinVel += 1.6;
        effort = Math.min(1.5, effort + 0.4);
        rings.push({ x, y, t: 0, dur: 0.5, col: '#FFE08A', r0: 4, r1: G.R * 0.9, w: 2 });
        api.buzz(8);
      } else {
        rings.push({ x, y, t: 0, dur: 0.6, col: '#CFF4F8', r0: 3, r1: G.R * 0.8, w: 1.5 });
        api.sfx.play('tick', { pitch: 0.7, volume: 0.4 });
        misses++;
        if (misses >= 2 && !finished) {
          misses = 0;
          rateT = 2.6;
          api.status(TEXTES.rate);
          showGesture();
        }
      }
    }

    function addTrail(x, y) {
      const p = trail[trailHead];
      p.x = x;
      p.y = y;
      p.t = time;
      trailHead = (trailHead + 1) % trail.length;
    }

    api.track(cv.canvas, {
      down(p) {
        touched = true;
        pressing = true;
        lastAng = null;
        finger.x = p.x;
        finger.y = p.y;
        finger.on = true;
        addTrail(p.x, p.y);
        rings.push({ x: p.x, y: p.y, t: 0, dur: 0.45, col: '#E6FBFF', r0: 3, r1: 18 * G.U, w: 1.5 });
        onMove(p.x, p.y);
      },
      move(p) {
        finger.x = p.x;
        finger.y = p.y;
        if (!pressing) return;
        addTrail(p.x, p.y);
        onMove(p.x, p.y);
      },
      up(p, e, cancelled) {
        pressing = false;
        lastAng = null;
        finger.on = false;
        if (!cancelled && p.tap) onTap(p.x, p.y);
      },
      hover(p) {
        finger.x = p.x;
        finger.y = p.y;
        finger.hoverT = time;
      },
    }, { touchAction: 'none' });

    /* ---------- animation ---------- */
    function update(dt) {
      time += dt;
      if (rateT > 0) {
        rateT -= dt;
        if (rateT <= 0) {
          shownCm = -1;
          updateStatus();
        }
      }
      /* creusement des tapes, réparti dans le temps */
      if (digPending > 0) {
        const step = Math.min(digPending, dt * 4);
        digPending -= step;
        addDig(step, null);
      }
      if (!pressing) rot += spinVel * dt;
      spinVel *= Math.pow(0.06, dt);
      effort *= Math.pow(0.12, dt);
      depthK += (progress() - depthK) * (1 - Math.exp(-dt * 3.5));

      /* les piquants s’orientent vers le doigt */
      const near = finger.on || time - finger.hoverT < 0.25;
      let target = 0;
      if (near) {
        const d = Math.hypot(finger.x - G.cx, finger.y - G.cy);
        target = clamp(1 - (d - G.R) / (G.R * 3.5)) * 0.8;
        const a = Math.atan2(finger.y - G.cy, finger.x - G.cx);
        let da = a - leanA;
        if (da > Math.PI) da -= TAU;
        else if (da < -Math.PI) da += TAU;
        leanA += da * Math.min(1, dt * 10);
      }
      leanK += (target - leanK) * Math.min(1, dt * 5);

      /* poussières de roche */
      let n = 0;
      for (const p of dust) {
        p.t += dt;
        const drag = Math.pow(0.18, dt);
        p.vx = p.vx * drag + 6 * dt;
        p.vy = p.vy * drag + 3 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.t < p.dur) dust[n++] = p;
      }
      dust.length = n;
      n = 0;
      for (const p of puffs) {
        p.t += dt;
        p.x += (p.vx + 7) * dt;
        p.y += (p.vy + 4) * dt;
        p.vx *= Math.pow(0.3, dt);
        p.vy *= Math.pow(0.3, dt);
        if (p.t < p.dur) puffs[n++] = p;
      }
      puffs.length = n;
      n = 0;
      for (const r of rings) {
        r.t += dt;
        if (r.t < r.dur) rings[n++] = r;
      }
      rings.length = n;

      /* particules en suspension, entraînées par le tourbillon */
      const swirl = clamp(Math.abs(spinVel) * 0.12 + effort * 0.5, 0, 1.3) * (spinVel < 0 ? -1 : 1);
      for (const s of specks) {
        const dx = s.x - G.cx, dy = s.y - G.cy;
        const d = Math.max(G.R, Math.hypot(dx, dy));
        const f = (swirl * 40 * (G.R * 2.5)) / d;
        s.vx += ((-dy / d) * f - s.vx) * Math.min(1, dt * 2);
        s.vy += ((dx / d) * f - s.vy) * Math.min(1, dt * 2);
        const drift = CALM ? 0 : 1;
        s.x += (s.vx + drift * (4 + Math.sin(time * 0.5 + s.ph) * 3)) * dt;
        s.y += (s.vy + drift * (2 + Math.cos(time * 0.4 + s.ph) * 3)) * dt;
        if (s.x < -4) s.x += G.w + 8;
        if (s.x > G.w + 4) s.x -= G.w + 8;
        if (s.y < -4) s.y += G.h + 8;
        if (s.y > G.h + 4) s.y -= G.h + 8;
      }
    }

    /* ---------- dessin ---------- */
    function drawCaustics() {
      const t = time * (CALM ? 0.12 : 0.5);
      const d = caImg.data;
      const f = (15 / G.S) * (G.w / caw);
      let j = 0;
      for (let y = 0; y < cah; y++) {
        const fy = y * f;
        for (let x = 0; x < caw; x++) {
          const fx = x * f;
          const v1 = Math.sin(fx * 1.3 + t * 0.9 + Math.sin(fy * 0.9 - t * 0.7) * 1.6);
          const v2 = Math.sin(fy * 1.2 - t * 0.8 + Math.sin(fx * 0.8 + t * 0.6) * 1.7);
          const v3 = Math.sin((fx - fy) * 0.8 + t * 0.5 + Math.sin(fx * 0.5 + fy * 0.6 - t * 0.4) * 1.4);
          let c = 1 - Math.abs(v1 + v2 + v3) / 3;
          c *= c;
          c *= c;
          c *= c;
          d[j] = 214; d[j + 1] = 255; d[j + 2] = 240; d[j + 3] = c * caMask[y * caw + x] * 88;
          j += 4;
        }
      }
      cctx.putImageData(caImg, 0, 0);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(cau, 0, 0, G.w, G.h);
      ctx.restore();
    }

    function drawAlgae() {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const tuft of algae) {
        const K = tuft.K;
        for (const b of tuft.blades) {
          ribbon(tuft.x, tuft.y, b.a, b.len, b.wd, b.ph, K.col, K.tip, b.fork ? b.fa : 0);
        }
        ctx.fillStyle = rgba('#3F3A22', 0.85);
        ctx.beginPath();
        ctx.arc(tuft.x, tuft.y, G.S * 0.008, 0, TAU);
        ctx.fill();
      }
    }

    /* une lanière qui ondule : une onde parcourt la lame de la base vers la pointe */
    const RIB = 9;
    const rx = new Float32Array(RIB + 1), ry = new Float32Array(RIB + 1), ra = new Float32Array(RIB + 1);
    function ribbon(x, y, a0, len, wd, ph, col, tip, fork) {
      const seg = len / RIB;
      let px = x, py = y;
      const speed = CALM ? 0.3 : 1.5;
      for (let i = 0; i <= RIB; i++) {
        const t = i / RIB;
        const a = a0 + Math.sin(time * speed - t * 4.2 + ph) * 0.28 * t + Math.sin(time * 0.5 + ph) * 0.12;
        rx[i] = px;
        ry[i] = py;
        ra[i] = a;
        px += Math.cos(a) * seg;
        py += Math.sin(a) * seg;
      }
      const half = fork ? Math.floor(RIB * 0.55) : RIB;
      fillBlade(0, half, wd, col, tip, fork ? 0.7 : 0);
      if (fork) {
        /* la lame se divise en deux */
        for (let sd = -1; sd <= 1; sd += 2) {
          const bx = rx[half], by = ry[half];
          let qx = bx, qy = by;
          const n = RIB - half;
          ctx.strokeStyle = rgba(tip, 0.75);
          ctx.lineWidth = wd * 0.65;
          ctx.beginPath();
          ctx.moveTo(qx, qy);
          for (let i = 1; i <= n; i++) {
            const a = ra[half + i - 1] + sd * fork * (0.6 + i / n);
            qx += Math.cos(a) * seg * 0.95;
            qy += Math.sin(a) * seg * 0.95;
            ctx.lineTo(qx, qy);
          }
          ctx.stroke();
        }
      }
    }

    function fillBlade(i0, i1, wd, col, tip, keep) {
      ctx.beginPath();
      for (let i = i0; i <= i1; i++) {
        const t = (i - i0) / (i1 - i0);
        const w = wd * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, t * (keep ? 0.6 : 1) + 0.12)));
        const nx = -Math.sin(ra[i]) * w * 0.5, ny = Math.cos(ra[i]) * w * 0.5;
        if (i === i0) ctx.moveTo(rx[i] + nx, ry[i] + ny);
        else ctx.lineTo(rx[i] + nx, ry[i] + ny);
      }
      for (let i = i1; i >= i0; i--) {
        const t = (i - i0) / (i1 - i0);
        const w = wd * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, t * (keep ? 0.6 : 1) + 0.12)));
        const nx = -Math.sin(ra[i]) * w * 0.5, ny = Math.cos(ra[i]) * w * 0.5;
        ctx.lineTo(rx[i] - nx, ry[i] - ny);
      }
      ctx.closePath();
      ctx.fillStyle = rgba(col, 0.9);
      ctx.fill();
      ctx.strokeStyle = rgba(tip, 0.5);
      ctx.lineWidth = Math.max(0.6, wd * 0.18);
      ctx.beginPath();
      ctx.moveTo(rx[i0], ry[i0]);
      for (let i = i0 + 1; i <= i1; i++) ctx.lineTo(rx[i], ry[i]);
      ctx.stroke();
    }

    function drawSpecks() {
      for (const s of specks) {
        ctx.fillStyle = rgba('#E9FFF8', s.a);
        ctx.fillRect(s.x, s.y, s.s, s.s);
      }
    }

    /* le trou : poussière autour, paroi éclairée d’un côté, fond dans l’ombre */
    function drawHoleBack() {
      const k = depthK;
      if (k < 0.004) return;
      const { cx, cy } = G;
      const Rh = holeR();
      /* poussière de roche blanche déposée autour de l’ouverture */
      let g = ctx.createRadialGradient(cx, cy, Rh * 0.95, cx, cy, Rh * 1.5);
      g.addColorStop(0, `rgba(238,230,214,${0.42 * k})`);
      g.addColorStop(1, 'rgba(238,230,214,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, Rh * 1.5, 0, TAU);
      ctx.fill();
      for (const s of rimSpecks) {
        if (s.th > k) continue;
        ctx.fillStyle = s.c;
        const r = Rh * s.r;
        ctx.fillRect(cx + Math.cos(s.a) * r, cy + Math.sin(s.a) * r, s.s, s.s);
      }
      /* paroi : sombre du côté de la lumière (en haut à gauche), claire en face */
      const dx = Math.cos(LIGHT) * Rh, dy = Math.sin(LIGHT) * Rh;
      g = ctx.createLinearGradient(cx + dx, cy + dy, cx - dx, cy - dy);
      g.addColorStop(0, `rgba(30,24,20,${0.95 * Math.min(1, k * 3)})`);
      g.addColorStop(0.5, `rgba(92,82,70,${0.9 * Math.min(1, k * 3)})`);
      g.addColorStop(1, `rgba(206,194,172,${0.9 * Math.min(1, k * 3)})`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, Rh, 0, TAU);
      ctx.fill();
      /* fond du trou */
      const Rf = Rh * (1 - 0.22 * k);
      const ox = -Math.cos(LIGHT) * Rh * 0.08 * k, oy = -Math.sin(LIGHT) * Rh * 0.08 * k;
      g = ctx.createRadialGradient(cx + ox, cy + oy, Rf * 0.2, cx + ox, cy + oy, Rf);
      g.addColorStop(0, `rgba(74,64,56,${k})`);
      g.addColorStop(1, `rgba(46,38,33,${k})`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx + ox, cy + oy, Rf, 0, TAU);
      ctx.fill();
      /* stries laissées par les dents */
      ctx.lineWidth = 1;
      for (const gv of grooves) {
        ctx.strokeStyle = `rgba(230,220,200,${0.25 * k * gv.th})`;
        ctx.beginPath();
        ctx.arc(cx + ox, cy + oy, Rf * gv.r, gv.a0 + rot * 0.3, gv.a0 + rot * 0.3 + gv.len);
        ctx.stroke();
      }
    }

    function drawHoleFront() {
      const k = depthK;
      if (k < 0.004) return;
      const { cx, cy } = G;
      const Rh = holeR();
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, Rh, 0, TAU);
      ctx.clip();
      /* plus on descend, moins la lumière arrive */
      const g = ctx.createRadialGradient(cx, cy, Rh * 0.3, cx, cy, Rh);
      g.addColorStop(0, `rgba(12,8,14,${0.1 * k})`);
      g.addColorStop(1, `rgba(12,8,14,${0.5 * k})`);
      ctx.fillStyle = g;
      ctx.fillRect(cx - Rh, cy - Rh, Rh * 2, Rh * 2);
      /* ombre portée par le rebord, côté lumière */
      const off = Rh * 0.3 * k;
      ctx.fillStyle = `rgba(10,8,8,${0.45 * k})`;
      ctx.beginPath();
      ctx.arc(cx, cy, Rh, 0, TAU);
      ctx.moveTo(cx + off + Rh, cy + off);
      ctx.arc(cx + off, cy + off, Rh, 0, TAU, true);
      ctx.fill('evenodd');
      ctx.restore();
      /* arête du rebord : nette du côté ombré, à peine marquée en face */
      ctx.lineWidth = Math.max(1, Rh * 0.035);
      ctx.strokeStyle = `rgba(232,222,204,${0.55 * k})`;
      ctx.beginPath();
      ctx.arc(cx, cy, Rh, Math.PI * 0.95, Math.PI * 1.55);
      ctx.stroke();
      ctx.strokeStyle = `rgba(60,50,42,${0.4 * k})`;
      ctx.beginPath();
      ctx.arc(cx, cy, Rh * 1.01, Math.PI * 0.05, Math.PI * 0.45);
      ctx.stroke();
    }

    function drawUrchin() {
      const { cx, cy, R, L } = G;
      const k = depthK;
      const sc = lerp(1, 0.85, ease.inOutSine(k));
      const jit = Math.min(1, effort) * 0.7;
      const x = cx + (jit ? Math.sin(time * 53) * jit : 0);
      const y = cy + (jit ? Math.cos(time * 47) * jit : 0);
      const Rb = R * sc;
      const breathe = finished ? 0.4 : 1;
      const wig = CALM ? 0.25 : 1;

      /* ombre portée sur la roche (elle disparaît dans le trou) */
      if (k < 0.95) {
        ctx.save();
        ctx.translate(x + R * 0.22, y + R * 0.28);
        draw.glow(ctx, 0, 0, R * 2.05, '#0B1A1C', 0.4 * (1 - k));
        ctx.restore();
      }

      ctx.save();
      const clipR = lerp(R * 3.2, holeR() * 0.995, ease.inOutSine(clamp(k * 1.15)));
      ctx.beginPath();
      ctx.arc(cx, cy, clipR, 0, TAU);
      ctx.clip();

      /* pieds ambulacraires : fins tubes à ventouse qui sortent entre les piquants */
      const out = clamp(1 - effort * 1.2) * (finished ? 1 : 0.85);
      if (out > 0.05) {
        ctx.lineCap = 'round';
        for (const f of feet) {
          const e = (0.55 + 0.45 * Math.sin(time * f.fq * TAU * 0.25 + f.ph)) * out;
          if (e < 0.1) continue;
          const a = f.a + rot + Math.sin(time * 0.6 + f.ph) * 0.05;
          const r0 = Rb * 0.9, r1 = Rb + L * sc * f.len * (0.6 + 0.55 * e);
          const ca = Math.cos(a), sa = Math.sin(a);
          ctx.strokeStyle = rgba('#D9C3E6', 0.4 * e);
          ctx.lineWidth = Math.max(0.7, R * 0.022);
          ctx.beginPath();
          ctx.moveTo(x + ca * r0, y + sa * r0);
          ctx.lineTo(x + ca * r1, y + sa * r1);
          ctx.stroke();
          ctx.fillStyle = rgba('#F1E4F7', 0.7 * e);
          ctx.beginPath();
          ctx.arc(x + ca * r1, y + sa * r1, Math.max(0.8, R * 0.035), 0, TAU);
          ctx.fill();
        }
      }

      /* piquants du dessous (frange), le corps, puis les piquants du dessus */
      drawSpines(x, y, Rb, sc, true, breathe, wig);
      const D = shadeSpr.D * sc;
      ctx.drawImage(shadeSpr.c, x - D / 2, y - D / 2, D, D);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.drawImage(patSpr.c, -D / 2, -D / 2, D, D);
      ctx.restore();
      ctx.drawImage(hiSpr.c, x - D / 2, y - D / 2, D, D);
      drawSpines(x, y, Rb, sc, false, breathe, wig);
      ctx.restore();
    }

    function drawSpines(x, y, Rb, sc, back, breathe, wig) {
      /* au fond du trou, les piquants se redressent : vus de dessus, ils paraissent plus courts */
      const L = G.L * sc * lerp(1, 0.55, ease.inOutSine(depthK));
      const R = G.R;
      const lean = leanK;
      for (let i = 0; i < spines.length; i++) {
        const s = spines[i];
        if (s.back !== back) continue;
        let a = s.a + rot + Math.sin(time * s.fq + s.ph) * 0.06 * wig * breathe;
        if (lean > 0.01) {
          let da = leanA - a;
          da -= Math.round(da / TAU) * TAU;
          a += lean * 0.32 * Math.sin(da) * (1 - (Math.abs(da) / Math.PI) * 0.4);
        }
        const ca = Math.cos(a), sa = Math.sin(a);
        const len = L * s.len * (1 + Math.sin(time * 0.8 + s.ph) * 0.03 * wig);
        const rb = Rb * s.sinPhi * (back ? 1 : 0.98);
        const rt = (Rb + len) * s.sinPhi;
        const bx = x + ca * rb, by = y + sa * rb;
        const tx = x + ca * rt, ty = y + sa * rt;
        const hw = R * 0.052 * s.wd * (back ? 0.9 : 1);
        const nx = -sa * hw, ny = ca * hw;
        let li = Math.cos(a - LIGHT);
        li = li > 0.5 ? 3 : li > 0 ? 2 : li > -0.5 ? 1 : 0;
        ctx.fillStyle = SP_BASE[s.tone][li];
        ctx.beginPath();
        ctx.moveTo(bx + nx, by + ny);
        ctx.lineTo(tx, ty);
        ctx.lineTo(bx - nx, by - ny);
        ctx.closePath();
        ctx.fill();
        const mx = (bx + tx) * 0.5 + (tx - bx) * 0.05, my = (by + ty) * 0.5 + (ty - by) * 0.05;
        ctx.fillStyle = SP_TIP[s.tone][li];
        ctx.beginPath();
        ctx.moveTo(mx + nx * 0.42, my + ny * 0.42);
        ctx.lineTo(tx, ty);
        ctx.lineTo(mx - nx * 0.42, my - ny * 0.42);
        ctx.closePath();
        ctx.fill();
      }
    }

    function drawFx() {
      for (const p of puffs) {
        const k = p.t / p.dur;
        const r = lerp(p.r0, p.r1, ease.outCubic(k));
        ctx.globalAlpha = p.a * (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85);
        ctx.drawImage(puffSpr, p.x - r, p.y - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
      for (const p of dust) {
        const k = p.t / p.dur;
        ctx.fillStyle = p.c;
        ctx.globalAlpha = 0.95 * (1 - k);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      /* trace lumineuse du doigt dans l’eau */
      ctx.lineCap = 'round';
      for (let i = 1; i < trail.length; i++) {
        const a = trail[(trailHead + i - 1) % trail.length];
        const b = trail[(trailHead + i) % trail.length];
        const age = time - b.t;
        if (age > 0.45 || time - a.t > 0.5 || b.t - a.t > 0.2) continue;
        ctx.strokeStyle = rgba('#E6FBFF', 0.35 * (1 - age / 0.45));
        ctx.lineWidth = 3.5 * (1 - age / 0.45) + 0.5;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      for (const r of rings) {
        const k = r.t / r.dur;
        ctx.strokeStyle = rgba(r.col, 0.8 * (1 - k));
        ctx.lineWidth = r.w;
        ctx.beginPath();
        ctx.arc(r.x, r.y, lerp(r.r0, r.r1, ease.outCubic(k)), 0, TAU);
        ctx.stroke();
      }
    }

    function render() {
      if (!bg) return;
      ctx.drawImage(bg, 0, 0, G.w, G.h);
      drawAlgae();
      drawHoleBack();
      drawUrchin();
      drawHoleFront();
      drawCaustics();
      drawSpecks();
      drawFx();
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
