/* La recette de la vie : on réunit chaleur, eau et minéraux dans une source chaude du fond
   de l'océan. Des molécules s'y assemblent en chaînes, puis en premières cellules
   qu'on fait se diviser d'une tape. */
(function () {
  'use strict';
  const { lib } = window.RM;
  const { TAU, rand, clamp, lerp, ease, rgba, draw } = lib;

  const TEXTES = {
    chaleur: 'Chaleur',
    eau: 'Eau',
    mineraux: 'Minéraux',
    ingredients: 'Ingrédients : {n} sur 3',
    prend: 'La recette prend…',
    divise: 'Tape une cellule pour qu’elle se divise.',
    cellules: 'Cellules : {n}',
    fin: 'Tes cellules se multiplient : la vie a commencé.',
    finStatut: 'Personne ne sait encore exactement comment les premières cellules sont apparues : c’est l’une des grandes questions de la science.',
  };
  const fill = (s, n) => s.replace('{n}', n);

  /* petites icônes dessinées à la main (24 × 24) */
  const ICONS = {
    chaleur: '<path fill="#F2622E" d="M12 2.6c.7 2.7 2.6 4.3 4.1 6 1.4 1.6 2.3 3.3 2.3 5.4A6.4 6.4 0 0 1 12 20.4 6.4 6.4 0 0 1 5.6 14c0-2.4 1.1-4.3 2.7-5.8.1 1.5.8 2.7 2 3.4-.4-3.2.4-6.4 1.7-9z"/>' +
      '<path fill="#FFC15A" d="M12 12.2c1.2 1.3 2.4 2.4 2.4 4.1a2.4 2.4 0 0 1-4.8 0c0-1.6 1-2.8 2.4-4.1z"/>',
    eau: '<path fill="#2E9BD6" d="M12 3c3 3.9 6.3 7.6 6.3 11.2a6.3 6.3 0 0 1-12.6 0C5.7 10.6 9 6.9 12 3z"/>' +
      '<path fill="none" stroke="#CFEFFF" stroke-width="1.6" stroke-linecap="round" d="M9 14.4a3.1 3.1 0 0 0 2.7 3.2"/>',
    mineraux: '<path fill="#3FB79E" d="M12 2.8l3.2 4.4v10.6L12 21l-3.2-3.2V7.2z"/>' +
      '<path fill="#A6EEDC" d="M12 2.8V21l-3.2-3.2V7.2z"/>' +
      '<path fill="#8A7FE8" d="M6.3 9.4l2.1 2.6v6.6l-2.1 1.9-2.1-1.9V12z"/>' +
      '<path fill="#B9A8FF" d="M17.7 8.2l2.1 2.6v7.6l-2.1 1.8-2.1-1.8v-7.6z"/>',
  };
  const CHECK = '<path fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" d="M5 12.6l4.3 4.2L19.2 7"/>';
  const ING = ['chaleur', 'eau', 'mineraux'];
  const MOL = ['#7DE8C9', '#FFB25B', '#B9A8FF', '#FF9DB4'];

  const sstep = (a, b, t) => {
    t = clamp((t - a) / (b - a));
    return t * t * (3 - 2 * t);
  };
  /* rayon d'une forme organique (même formule que draw.blob) */
  const blobK = (a, seed, wob, t) =>
    1 + wob * (Math.sin(a * 3 + seed + t) * 0.5 + Math.sin(a * 5 - seed * 1.7 + t * 0.7) * 0.3 + Math.sin(a * 2 + seed * 2.3) * 0.2);
  function mk(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  }

  window.RM.games.recette = function (api) {
    const cv = api.canvas();
    const ctx = cv.ctx;
    const RM = api.reducedMotion;
    const nz = lib.makeNoise(57);

    /* ---- réglages ---- */
    const START = 3, GOAL = 16, MAX = 28;
    const T_SPAWN = 2.5;      /* les molécules apparaissent pendant ce temps */
    const T_WRAP = 4.0;       /* puis les membranes se forment… */
    const D_WRAP = 1.0;
    const T_PLAY = 5.3;       /* …et on peut faire se diviser les cellules */
    const LINK = 8.5;         /* écart entre deux perles d'une chaîne */
    const D_DIV = 0.9;        /* durée d'une division */
    /* chaînes : longueur, destination (fraction de la scène), deviendra une cellule ? */
    const CHAINS = [
      { n: 7, hx: 0.22, hy: 0.5, cell: true },
      { n: 8, hx: 0.79, hy: 0.29, cell: true },
      { n: 6, hx: 0.8, hy: 0.6, cell: true },
      { n: 5, hx: 0.17, hy: 0.25, cell: false },
      { n: 6, hx: 0.66, hy: 0.13, cell: false },
      { n: 4, hx: 0.27, hy: 0.71, cell: false },
      { n: 5, hx: 0.92, hy: 0.45, cell: false },
    ];

    /* ---- état ---- */
    let phase = 'ing';        /* ing | build | play */
    let time = 0, bt = 0, finished = false, firstTap = false, barGone = false;
    let nHave = 0, shownP = -1, autoT = 0, spawnAcc = 0, spawned = 0;
    const have = { chaleur: false, eau: false, mineraux: false };
    const K = { chaleur: 0, eau: 0, mineraux: 0 };
    const tAdd = { chaleur: -9, eau: -9, mineraux: -9 };

    const plume = [], bubbles = [], snow = [], tracers = [], beads = [], ripples = [], flashes = [];
    for (let i = 0; i < 90; i++) plume.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, r0: 1, r1: 1, t: 0, life: 1 });
    for (let i = 0; i < 36; i++) bubbles.push({ on: false, x: 0, y: 0, vy: 0, r: 1, t: 0, ph: 0 });
    for (let i = 0; i < 41; i++) beads.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, x0: 0, y0: 0, col: 0, chain: null, linked: false, t: 0 });
    for (let i = 0; i < 10; i++) ripples.push({ on: false, x: 0, y: 0, t: 0, r: 1 });
    for (let i = 0; i < 24; i++) flashes.push({ on: false, x: 0, y: 0, t: 0, col: '#FFFFFF' });
    let chains = [];
    let cells = [];
    const P = { x: 0, y: 0 };

    /* ---- géométrie ---- */
    const geo = { w: 1, h: 1, S: 1, cx: 0, gy: 0, top: 0, hw0: 1, hw1: 1, vx: 0, vy: 0, R: 16 };
    let GY = null;
    let blocks = [], mainB = [];
    let crystals = [], pores = [], wall = [];
    let crystC = null, crystBaked = false, hotY = 0;
    let beadSpr = [], sparkSpr = null;
    const BEAD_R = 4;
    let bg = null, chim = null, hot = null, chimBox = { x: 0, y: 0, w: 1, h: 1 };
    let glowWarm = null, glowMint = null, plumeSpr = null, warmSpr = null;

    function groundAt(x) {
      return GY[clamp(Math.round(x / 4), 0, GY.length - 1)];
    }
    /* demi-largeur de la cheminée à la hauteur y */
    function chimHalf(y) {
      if (y < geo.top) return geo.hw1 * 0.8;
      return lerp(geo.hw1, geo.hw0, clamp((y - geo.top) / (geo.gy - geo.top)));
    }

    function layout(w, h) {
      geo.w = w;
      geo.h = h;
      geo.S = Math.min(w, h * 0.85);
      geo.cx = w * 0.5;
      geo.gy = h * 0.84;
      geo.top = h * 0.4;
      geo.hw0 = geo.S * 0.11;
      geo.hw1 = geo.S * 0.05;
      geo.R = clamp(geo.S * 0.046, 13, 24);
      const n = lib.makeNoise(37);
      const N = Math.ceil(w / 4) + 2;
      GY = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const x = i * 4;
        const m = Math.exp(-Math.pow((x - geo.cx) / (geo.hw0 * 2.6), 2));
        GY[i] = h * 0.838 + (n.fbm(x * 0.011, 1.7, 3) - 0.5) * h * 0.06 - m * h * 0.014;
      }
      buildChimney();
      makeSprites();
      bg = makeBg(w, h);
      makeTracers();
      makeSnow();
    }

    /* ---- la cheminée : une tour bosselée de minéraux, faite de blocs soudés ---- */
    function buildChimney() {
      const n = lib.makeNoise(19);
      const H = geo.gy - geo.top;
      const N = 12;
      blocks = [];
      let wob = 0;
      const main = [];
      for (let i = 0; i < N; i++) {
        const t = i / (N - 1);
        const hw = lerp(geo.hw0, geo.hw1, Math.pow(t, 0.8)) * (0.84 + n.rnd() * 0.3);
        wob = (wob + (n.rnd() - 0.5) * geo.S * 0.024) * 0.75;
        /* des blocs plus hauts que leur écart : ils se chevauchent et la tour paraît d'un seul tenant */
        main.push({
          cx: geo.cx + wob, cy: geo.gy - (H * (i + 0.5)) / N, rx: hw,
          ry: (H / N) * (0.62 + n.rnd() * 0.22), seed: n.rnd() * 20, tone: n.rnd(), tilt: (n.rnd() - 0.5) * 0.3,
        });
      }
      for (let i = 0; i < N; i++) {
        const b = main[i];
        /* bosses sur les côtés */
        if (i > 0 && i < N - 2 && n.rnd() < 0.6) {
          const s = n.rnd() < 0.5 ? -1 : 1;
          blocks.push({
            cx: b.cx + s * b.rx * (0.7 + n.rnd() * 0.15), cy: b.cy + (n.rnd() - 0.3) * b.ry * 0.6,
            rx: b.rx * (0.36 + n.rnd() * 0.16), ry: b.ry * (0.7 + n.rnd() * 0.3), seed: n.rnd() * 20,
            tone: n.rnd(), tilt: 0, knob: true,
          });
        }
        blocks.push(b);
        /* deux corniches, comme sur les vraies cheminées */
        if (i === 3 || i === 7) {
          blocks.push({
            cx: b.cx + (n.rnd() - 0.5) * 4, cy: b.cy - b.ry * 0.35, rx: b.rx * 1.42, ry: b.ry * 0.36,
            seed: n.rnd() * 20, tone: n.rnd(), tilt: (n.rnd() - 0.5) * 0.12, ledge: true,
          });
        }
      }
      mainB = main;
      const tb = main[N - 1];
      geo.vx = tb.cx;
      geo.vy = tb.cy - tb.ry * 0.8;
      /* points sur la paroi (d'où partent les molécules) */
      wall = [];
      main.forEach((b) => {
        for (let s = -1; s <= 1; s += 2) {
          for (let k = 0; k < 2; k++) {
            const a = (s > 0 ? 0 : Math.PI) + (k - 0.5) * 0.7;
            const q = blobK(a, b.seed, 0.1, 0) * 1.05;
            wall.push({ x: b.cx + Math.cos(a) * b.rx * q, y: b.cy + Math.sin(a) * b.ry * q, s });
          }
        }
      });
      /* cristaux (en petites grappes de prismes) et pores qui couvriront les parois */
      const rnd = lib.makeNoise(23).rnd;
      crystals = [];
      pores = [];
      const COLS = ['#E9FFF8', '#B4F3E2', '#FFE6B8', '#D6E8FF', '#D2C6FF'];
      for (let i = 0; i < 60; i++) {
        const b = main[Math.floor(rnd() * (N - 1))];
        const edge = rnd() < 0.55;
        const a = edge ? (rnd() < 0.5 ? 0 : Math.PI) + (rnd() - 0.5) * 1.9 : rnd() * TAU;
        const rf = edge ? 0.97 : 0.25 + 0.6 * Math.sqrt(rnd());
        const q = blobK(a, b.seed, 0.1, 0);
        const x = b.cx + Math.cos(a) * b.rx * rf * q, y = b.cy + Math.sin(a) * b.ry * rf * q;
        /* sur le bord, ils pointent vers l'extérieur ; sur la face, on les voit de face (plus courts) */
        const out = Math.atan2(Math.sin(a) * b.rx, Math.cos(a) * b.ry);
        const ang = edge ? out + (rnd() - 0.5) * 0.5 : -Math.PI / 2 + (rnd() - 0.5) * 2.4;
        const len = edge ? 3.2 + rnd() * 3.6 : 2 + rnd() * 2;
        const col = COLS[Math.floor(rnd() * COLS.length)];
        const k = 2 + Math.floor(rnd() * 2);
        const prisms = [];
        for (let j = 0; j < k; j++) {
          prisms.push({ da: (j - (k - 1) / 2) * (0.32 + rnd() * 0.2), L: len * (0.6 + rnd() * 0.5), W: 0.8 + rnd() * 0.7 });
        }
        crystals.push({
          x, y, ang, prisms, col, d: rnd() * 1.1, f: 0.5 + rnd() * 1.4, ph: rnd() * TAU, s: len,
          sx: x + Math.cos(ang) * len * 0.8, sy: y + Math.sin(ang) * len * 0.8,
        });
      }
      for (let i = 0; i < 34; i++) {
        const b = main[Math.floor(rnd() * N)];
        const a = rnd() * TAU, rf = 0.2 + 0.65 * Math.sqrt(rnd());
        pores.push({ x: b.cx + Math.cos(a) * b.rx * rf, y: b.cy + Math.sin(a) * b.ry * rf, s: 1.2 + rnd() * 2, d: rnd() * 1.1 });
      }
      crystBaked = false;
    }
    function blockPath(g, b, grow) {
      g.save();
      g.translate(b.cx, b.cy);
      if (b.tilt) g.rotate(b.tilt);
      g.scale(b.rx * grow, b.ry * grow);
      draw.blob(g, 0, 0, 1, b.ledge ? 0.16 : 0.1, b.seed, 0, 26);
      g.restore();
    }
    function towerPath(g) {
      g.beginPath();
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        const ct = Math.cos(b.tilt || 0), st = Math.sin(b.tilt || 0);
        const wob = b.ledge ? 0.16 : 0.1;
        for (let k = 0; k <= 26; k++) {
          const a = (k / 26) * TAU;
          const q = blobK(a, b.seed, wob, 0);
          const lx = Math.cos(a) * b.rx * q, ly = Math.sin(a) * b.ry * q;
          const x = b.cx + lx * ct - ly * st, y = b.cy + lx * st + ly * ct;
          if (k === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.closePath();
      }
    }

    function makeSprites() {
      const dpr = cv.dpr;
      const pad = 18;
      const x0 = geo.cx - geo.hw0 * 1.9 - pad, x1 = geo.cx + geo.hw0 * 1.9 + pad;
      const y0 = geo.top - geo.S * 0.08 - pad, y1 = geo.gy + geo.hw0 * 0.6 + pad;
      chimBox = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
      let c = mk(chimBox.w * dpr, chimBox.h * dpr);
      let g = c.getContext('2d');
      g.scale(dpr, dpr);
      g.translate(-x0, -y0);
      /* ombre douce derrière la tour */
      g.save();
      g.translate(geo.cx, (geo.top + geo.gy) / 2);
      g.scale(geo.hw0 * 1.8, (geo.gy - geo.top) * 0.62);
      draw.glow(g, 0, 0, 1, '#000000', 0.35);
      g.restore();
      /* d'abord la silhouette entière, d'un seul tenant */
      towerPath(g);
      const base = g.createLinearGradient(0, geo.top, 0, geo.gy);
      base.addColorStop(0, '#6A5F55');
      base.addColorStop(1, '#4A3A2E');
      g.fillStyle = base;
      g.fill();
      /* puis chaque bloc, du bas vers le haut, avec l'ombre qu'il porte sur le bloc du dessous */
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        if (i > 0) {
          g.save();
          g.globalCompositeOperation = 'source-atop';
          g.translate(b.cx, b.cy + b.ry * 0.7);
          g.scale(b.rx * 1.1, b.ry * 0.55);
          draw.glow(g, 0, 0, 1, '#120A06', 0.45);
          g.restore();
        }
        blockPath(g, b, 1);
        const gr = g.createRadialGradient(b.cx - b.rx * 0.45, b.cy - b.ry * 0.62, 0, b.cx, b.cy, Math.max(b.rx, b.ry) * 1.3);
        gr.addColorStop(0, lib.mix('#BC9670', '#A79E90', b.tone));
        gr.addColorStop(0.52, lib.mix('#80644C', '#6E685E', b.tone));
        gr.addColorStop(1, lib.mix('#3A2A20', '#2E2B28', b.tone));
        g.fillStyle = gr;
        g.fill();
        /* un fin liseré éclairé sur le haut du bloc */
        g.save();
        g.clip();
        g.translate(b.cx, b.cy - b.ry * 0.12);
        g.scale(b.rx, b.ry);
        g.strokeStyle = 'rgba(255,226,186,0.16)';
        g.lineWidth = 0.12;
        g.beginPath();
        g.arc(0, 0, 0.92, -2.7, -0.6);
        g.stroke();
        g.restore();
      }
      /* grain, coulures minérales, lumière froide venue du dessus */
      g.globalCompositeOperation = 'source-atop';
      const n = lib.makeNoise(29);
      for (let k = 0; k < (chimBox.w * chimBox.h) / 8; k++) {
        const x = x0 + n.rnd() * chimBox.w, y = y0 + n.rnd() * chimBox.h;
        g.fillStyle = n.rnd() < 0.5 ? 'rgba(255,236,210,0.08)' : 'rgba(0,0,0,0.18)';
        g.fillRect(x, y, 1 + n.rnd() * 1.6, 1 + n.rnd() * 1.6);
      }
      for (let k = 0; k < 26; k++) {
        const x = geo.cx + (n.rnd() - 0.5) * geo.hw0 * 2;
        const y = geo.top + n.rnd() * (geo.gy - geo.top);
        const L = 6 + n.rnd() * 22;
        g.strokeStyle = n.rnd() < 0.6 ? 'rgba(40,24,14,0.3)' : 'rgba(214,170,110,0.16)';
        g.lineWidth = 0.8 + n.rnd() * 1.4;
        g.beginPath();
        g.moveTo(x, y);
        g.quadraticCurveTo(x + (n.rnd() - 0.5) * 4, y + L * 0.5, x + (n.rnd() - 0.5) * 3, y + L);
        g.stroke();
      }
      const lg = g.createLinearGradient(geo.cx - geo.hw0 * 1.5, 0, geo.cx + geo.hw0 * 1.5, 0);
      lg.addColorStop(0, 'rgba(140,230,215,0.16)');
      lg.addColorStop(0.35, 'rgba(140,230,215,0)');
      lg.addColorStop(0.75, 'rgba(0,10,12,0.12)');
      lg.addColorStop(1, 'rgba(0,10,12,0.38)');
      g.fillStyle = lg;
      g.fillRect(x0, y0, chimBox.w, chimBox.h);
      g.globalCompositeOperation = 'source-over';
      /* l'ouverture au sommet */
      g.save();
      g.translate(geo.vx, geo.vy + 1);
      g.scale(geo.hw1 * 0.62, geo.hw1 * 0.22);
      g.fillStyle = '#120D0B';
      g.beginPath();
      g.arc(0, 0, 1, 0, TAU);
      g.fill();
      g.restore();
      /* éboulis au pied de la tour */
      const rocks = lib.makeNoise(31);
      for (let k = 0; k < 26; k++) {
        const t = rocks.rnd();
        const x = geo.cx + (t - 0.5) * geo.hw0 * 3.6;
        const y = geo.gy + (rocks.rnd() - 0.3) * geo.hw0 * 0.35;
        const r = (2 + rocks.rnd() * 5) * (1.2 - Math.abs(t - 0.5));
        const sg = g.createRadialGradient(x - r * 0.3, y - r * 0.4, 0, x, y, r * 1.2);
        sg.addColorStop(0, lib.mix('#5E5248', '#4A5552', rocks.rnd()));
        sg.addColorStop(1, '#141A1A');
        g.fillStyle = sg;
        g.beginPath();
        g.ellipse(x, y, r * 1.3, r, 0, 0, TAU);
        g.fill();
      }
      chim = c;

      /* fissures chaudes de la base (affichées quand on ajoute la chaleur) */
      c = mk(chimBox.w * dpr, chimBox.h * dpr);
      g = c.getContext('2d');
      g.scale(dpr, dpr);
      g.translate(-x0, -y0);
      g.save();
      towerPath(g);
      g.clip();
      /* la roche chauffe par en dessous : une lueur qui monte depuis la base */
      const hg = g.createLinearGradient(0, geo.gy + 4, 0, geo.gy - (geo.gy - geo.top) * 0.55);
      hg.addColorStop(0, 'rgba(255,92,30,0.62)');
      hg.addColorStop(0.45, 'rgba(255,92,30,0.22)');
      hg.addColorStop(1, 'rgba(255,92,30,0)');
      g.fillStyle = hg;
      g.fillRect(x0, y0, chimBox.w, chimBox.h);
      g.lineCap = 'round';
      g.lineJoin = 'round';
      /* joints entre les blocs du bas, qui rougeoient */
      for (let i = 0; i < Math.min(6, mainB.length); i++) {
        const b = mainB[i];
        const k = 1 - i / 6;
        g.beginPath();
        for (let j = 0; j <= 14; j++) {
          const a = 0.15 * Math.PI + (j / 14) * 0.7 * Math.PI;
          const q = blobK(a, b.seed, 0.1, 0) * 0.95;
          const x = b.cx + Math.cos(a) * b.rx * q, y = b.cy + Math.sin(a) * b.ry * q;
          if (j === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.strokeStyle = rgba('#FF4A14', 0.32 * k);
        g.lineWidth = 5;
        g.stroke();
        g.strokeStyle = rgba('#FFB06A', 0.8 * k);
        g.lineWidth = 1.2;
        g.stroke();
      }
      /* fissures sinueuses qui remontent depuis le pied */
      const fis = lib.makeNoise(41);
      for (let k = 0; k < 6; k++) {
        let x = geo.cx + (fis.rnd() - 0.5) * geo.hw0 * 1.4;
        let y = geo.gy + 2;
        const L = (geo.gy - geo.top) * (0.1 + fis.rnd() * 0.22);
        g.beginPath();
        g.moveTo(x, y);
        for (let s = 0; s < 9; s++) {
          const nx = x + (fis.rnd() - 0.5) * 7, ny = y - L / 9;
          g.quadraticCurveTo(x + (fis.rnd() - 0.5) * 4, (y + ny) / 2, nx, ny);
          x = nx;
          y = ny;
        }
        g.strokeStyle = 'rgba(255,80,30,0.28)';
        g.lineWidth = 3.5;
        g.stroke();
        g.strokeStyle = 'rgba(255,196,128,0.75)';
        g.lineWidth = 0.9;
        g.stroke();
      }
      g.restore();
      /* on ne garde que le bas de la tour, là où la roche chauffe : moins de pixels à mélanger */
      hotY = Math.max(chimBox.y, geo.gy - (geo.gy - geo.top) * 0.62);
      const hc = mk(chimBox.w * dpr, (chimBox.y + chimBox.h - hotY) * dpr);
      hc.getContext('2d').drawImage(c, 0, (hotY - chimBox.y) * dpr, c.width, hc.height, 0, 0, hc.width, hc.height);
      hot = hc;
      /* la cheminée couverte de minéraux (préparée au moment où ils ont fini de pousser) */
      crystC = mk(chimBox.w * dpr, chimBox.h * dpr);
      crystBaked = false;
      /* perles des chaînes et étincelles des cristaux, prêtes à l'emploi */
      beadSpr = MOL.map((col) => {
        const s = mk((BEAD_R * 2 + 2) * dpr, (BEAD_R * 2 + 2) * dpr);
        const x = s.getContext('2d');
        x.scale(dpr, dpr);
        const o = BEAD_R + 1;
        x.fillStyle = col;
        x.beginPath();
        x.arc(o, o, BEAD_R, 0, TAU);
        x.fill();
        x.fillStyle = 'rgba(255,255,255,0.65)';
        x.beginPath();
        x.arc(o - BEAD_R * 0.35, o - BEAD_R * 0.38, BEAD_R * 0.36, 0, TAU);
        x.fill();
        return s;
      });
      sparkSpr = (function () {
        const z = 40;
        const s = mk(z, z);
        const x = s.getContext('2d');
        draw.glow(x, z / 2, z / 2, z / 2, '#7DE8C9', 0.9);
        x.strokeStyle = 'rgba(255,255,255,0.95)';
        x.lineWidth = 1.6;
        x.lineCap = 'round';
        x.beginPath();
        x.moveTo(z * 0.17, z / 2);
        x.lineTo(z * 0.83, z / 2);
        x.moveTo(z / 2, z * 0.17);
        x.lineTo(z / 2, z * 0.83);
        x.stroke();
        return s;
      })();

      glowWarm = glowSprite('#FF7A30', 64);
      glowMint = glowSprite('#7DE8C9', 64);
      warmSpr = glowSprite('#FFB070', 48);
      plumeSpr = (function () {
        const s = mk(64, 64);
        const x = s.getContext('2d');
        const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
        gr.addColorStop(0, 'rgba(18,14,12,0.95)');
        gr.addColorStop(0.5, 'rgba(22,18,16,0.6)');
        gr.addColorStop(1, 'rgba(26,22,20,0)');
        x.fillStyle = gr;
        x.fillRect(0, 0, 64, 64);
        return s;
      })();
    }
    function glowSprite(col, size) {
      const c = mk(size, size);
      draw.glow(c.getContext('2d'), size / 2, size / 2, size / 2, col, 1);
      return c;
    }

    /* ---- fond : eau profonde, cheminées lointaines, sol rocheux ---- */
    function distantChimney(g, x, base, H, hw, seed, col) {
      const n = lib.makeNoise(seed);
      const N = 6;
      g.fillStyle = col;
      let wob = 0;
      for (let i = 0; i < N; i++) {
        const t = i / (N - 1);
        wob = (wob + (n.rnd() - 0.5) * hw * 0.5) * 0.7;
        g.save();
        g.translate(x + wob, base - (H * (i + 0.5)) / N);
        g.scale(lerp(hw, hw * 0.5, t) * (0.85 + n.rnd() * 0.3), (H / N) * 0.7);
        draw.blob(g, 0, 0, 1, 0.12, n.rnd() * 10, 0, 20);
        g.restore();
        g.fill();
      }
      /* un panache figé, très pâle */
      for (let k = 0; k < 6; k++) {
        g.save();
        g.translate(x + k * hw * 0.35, base - H - k * H * 0.22);
        g.scale(hw * (1.1 + k * 0.4), hw * (0.9 + k * 0.3));
        draw.glow(g, 0, 0, 1, '#061416', 0.35 - k * 0.04);
        g.restore();
      }
    }
    function makeBg(w, h) {
      const c = mk(w * cv.dpr, h * cv.dpr);
      const g = c.getContext('2d');
      g.scale(cv.dpr, cv.dpr);
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#0C3B3C');
      gr.addColorStop(0.5, '#072A2C');
      gr.addColorStop(1, '#03161A');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
      const M = Math.max(w, h);
      [
        [0.18, 0.12, 0.62, '#145552', 0.32],
        [0.88, 0.3, 0.5, '#104849', 0.28],
        [0.5, 0.62, 0.46, '#0D3F3F', 0.45],
      ].forEach(([x, y, r, col, a]) => draw.glow(g, x * w, y * h, r * M, col, a));
      const n = lib.makeNoise(33);
      for (let i = 0; i < (w * h) / 160; i++) {
        g.fillStyle = `rgba(150,226,210,${0.02 + n.rnd() * 0.05})`;
        g.fillRect(n.rnd() * w, n.rnd() * h, 1, 1);
      }
      const S = geo.S;
      distantChimney(g, w * 0.12, h * 0.81, h * 0.2, S * 0.04, 71, 'rgba(10,44,44,0.95)');
      distantChimney(g, w * 0.86, h * 0.8, h * 0.28, S * 0.05, 73, 'rgba(10,44,44,0.95)');
      distantChimney(g, w * 0.7, h * 0.81, h * 0.12, S * 0.03, 75, 'rgba(12,50,50,0.9)');
      /* brume de profondeur devant les cheminées lointaines */
      const hz = g.createLinearGradient(0, h * 0.55, 0, h * 0.84);
      hz.addColorStop(0, 'rgba(8,42,44,0)');
      hz.addColorStop(1, 'rgba(8,42,44,0.55)');
      g.fillStyle = hz;
      g.fillRect(0, h * 0.55, w, h * 0.3);
      /* le sol */
      g.beginPath();
      g.moveTo(0, h);
      for (let x = 0; x <= w + 4; x += 4) g.lineTo(x, groundAt(x));
      g.lineTo(w, h);
      g.closePath();
      const sg = g.createLinearGradient(0, h * 0.78, 0, h);
      sg.addColorStop(0, '#0E2C2C');
      sg.addColorStop(0.4, '#0A2122');
      sg.addColorStop(1, '#051314');
      g.fillStyle = sg;
      g.fill();
      g.save();
      g.clip();
      /* strates et taches de minéraux autour de la source */
      for (let k = 0; k < 5; k++) {
        const y0 = h * (0.87 + k * 0.03);
        g.strokeStyle = `rgba(120,170,160,${0.05 + n.rnd() * 0.04})`;
        g.lineWidth = 1;
        g.beginPath();
        for (let x = 0; x <= w; x += 8) g.lineTo(x, y0 + Math.sin(x * 0.03 + k) * 2 + (n.noise2(x * 0.02, k) - 0.5) * 6);
        g.stroke();
      }
      g.save();
      g.translate(geo.cx, geo.gy + 4);
      g.scale(geo.hw0 * 3.4, geo.hw0 * 0.7);
      draw.glow(g, 0, 0, 1, '#7A5A34', 0.3);
      g.restore();
      for (let i = 0; i < 70; i++) {
        const x = n.rnd() * w;
        const y = groundAt(x) + 2 + Math.pow(n.rnd(), 1.6) * (h - groundAt(x));
        const r = 1.5 + n.rnd() * n.rnd() * 9;
        const pg = g.createRadialGradient(x - r * 0.3, y - r * 0.45, 0, x, y, r * 1.25);
        pg.addColorStop(0, lib.mix('#3C5552', '#4D4740', n.rnd()));
        pg.addColorStop(1, '#081415');
        g.fillStyle = pg;
        g.beginPath();
        g.ellipse(x, y, r * 1.35, r, 0, 0, TAU);
        g.fill();
      }
      g.restore();
      /* reflet froid sur l'arête du sol */
      g.strokeStyle = 'rgba(125,232,201,0.08)';
      g.lineWidth = 1.5;
      g.beginPath();
      for (let x = 0; x <= w + 4; x += 4) g.lineTo(x, groundAt(x) + 1);
      g.stroke();
      return c;
    }

    function makeTracers() {
      tracers.length = 0;
      for (let i = 0; i < 24; i++) {
        tracers.push({
          s: i % 2 ? 1 : -1,
          a: geo.w * rand(0.07, 0.17), b: geo.h * rand(0.08, 0.19),
          yc: lerp(geo.top + geo.h * 0.04, geo.gy - geo.h * 0.11, rand()),
          th: rand(TAU), om: rand(0.55, 1.0), len: rand(0.6, 1.0), ph: rand(TAU),
        });
      }
    }
    function makeSnow() {
      snow.length = 0;
      for (let i = 0; i < 46; i++) {
        snow.push({ x: rand(geo.w), y: rand(geo.h * 0.85), vy: rand(5, 14), s: rand(0.7, 1.8), a: rand(0.2, 0.6), ph: rand(TAU) });
      }
    }
    function tracerPos(tr, th, out) {
      const y = tr.yc + tr.b * Math.sin(th);
      const hw = chimHalf(y) + 7;
      const xc = geo.cx + tr.s * (hw + tr.a);
      out.x = xc - tr.s * tr.a * Math.cos(th) + Math.sin(th * 3 + tr.ph) * 3;
      out.y = y + Math.cos(th * 2 + tr.ph) * 2.5;
    }

    /* ---- les boutons d'ingrédients ---- */
    api.style(`
      .game[data-game="recette"] .rc-chips { position: absolute; left: 0; right: 0; bottom: 12px; z-index: 4;
        display: flex; justify-content: center; gap: 8px; padding: 0 10px;
        transition: opacity .6s ease, transform .6s ease, visibility 0s linear 0s; }
      .game[data-game="recette"] .rc-chips.is-gone { opacity: 0; transform: translateY(16px); visibility: hidden;
        transition: opacity .6s ease, transform .6s ease, visibility 0s linear .6s; }
      .game[data-game="recette"] .rc-chip { flex: 0 1 auto; min-width: 0; padding: 9px 13px 9px 10px; gap: 6px; }
      .game[data-game="recette"] .rc-ic { width: 20px; height: 20px; flex: none; }
      .game[data-game="recette"] .rc-chip[disabled] { opacity: 1; background: var(--accent); color: var(--btn-fg);
        box-shadow: 0 0 0 3px rgba(125, 232, 201, .25), 0 6px 16px -8px rgba(0, 0, 0, .6); }
      .game[data-game="recette"] .rc-narrow { gap: 6px; padding: 0 6px; }
      .game[data-game="recette"] .rc-narrow .rc-chip { padding: 8px 10px 8px 8px; font-size: .875rem; gap: 5px; }
      .game[data-game="recette"] .rc-pulse .rc-chip:not([disabled]) { animation: recette-pulse 2.4s ease-in-out infinite; }
      .game[data-game="recette"] .rc-pulse .rc-chip:nth-child(2) { animation-delay: .3s; }
      .game[data-game="recette"] .rc-pulse .rc-chip:nth-child(3) { animation-delay: .6s; }
      .game[data-game="recette"] .rc-nudge .rc-chip:not([disabled]) { animation: recette-nudge .5s ease-in-out 1; }
      @keyframes recette-pulse {
        0%, 100% { transform: scale(1); box-shadow: 0 6px 16px -8px rgba(0, 0, 0, .6), 0 0 0 0 rgba(125, 232, 201, 0); }
        50% { transform: scale(1.05); box-shadow: 0 6px 16px -8px rgba(0, 0, 0, .6), 0 0 0 5px rgba(125, 232, 201, .38); }
      }
      @keyframes recette-nudge { 0%, 100% { transform: scale(1); } 40% { transform: scale(1.12); } }
    `);
    const bar = document.createElement('div');
    bar.className = 'rc-chips';
    const chips = {};
    ING.forEach((key) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip rc-chip';
      const ic = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      ic.setAttribute('class', 'rc-ic');
      ic.setAttribute('viewBox', '0 0 24 24');
      ic.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span');
      label.textContent = TEXTES[key];
      b.append(ic, label);
      b.addEventListener('click', () => addIngredient(key));
      bar.appendChild(b);
      chips[key] = { b, ic };
    });
    api.stage.appendChild(bar);
    function resetChips() {
      ING.forEach((key) => {
        chips[key].b.disabled = false;
        chips[key].ic.innerHTML = ICONS[key];
      });
      bar.classList.remove('is-gone', 'rc-nudge');
      bar.classList.toggle('rc-pulse', !RM);
      barGone = false;
    }
    function nudgeChips() {
      if (RM) return;
      bar.classList.remove('rc-nudge', 'rc-pulse');
      void bar.offsetWidth;
      bar.classList.add('rc-nudge');
      setTimeout(() => {
        bar.classList.remove('rc-nudge');
        if (phase === 'ing') bar.classList.add('rc-pulse');
      }, 520);
    }

    /* ---- ingrédients ---- */
    function addIngredient(key) {
      if (phase !== 'ing' || have[key]) return;
      have[key] = true;
      tAdd[key] = time;
      nHave++;
      chips[key].b.disabled = true;
      chips[key].ic.innerHTML = CHECK;
      api.buzz(10);
      if (key === 'chaleur') {
        api.sfx.play('rumble', { volume: 0.6, gap: 0 });
        flash(geo.cx, geo.gy - 8, '#FF9A50');
      } else if (key === 'eau') {
        api.sfx.play('splash', { gap: 0 });
        for (let i = 0; i < 10; i++) spawnBubble(true);
      } else {
        api.sfx.play('chime', { gap: 0 });
      }
      api.progress(nHave * 0.15);
      if (nHave < 3) api.status(fill(TEXTES.ingredients, nHave));
      else startBuild();
    }

    function startBuild() {
      phase = 'build';
      bt = 0;
      spawnAcc = 0;
      spawned = 0;
      api.status(TEXTES.prend);
      chains = CHAINS.map((c, i) => {
        const side = c.hx < 0.5 ? -1 : 1;
        const wy = clamp(c.hy * geo.h, geo.top + 12, geo.gy - 24);
        return {
          list: [], n: c.n, side, sx: geo.cx + side * (chimHalf(wy) + 3), sy: wy,
          hx: c.hx * geo.w, hy: c.hy * geo.h, ax: 0, ay: 0, t0: i * 0.1,
          state: 'grow', alpha: 1, cell: c.cell, ph: rand(TAU), wt: 0, first: i === 0, flying: 0,
        };
      });
      chains.forEach((c) => {
        c.ax = c.sx;
        c.ay = c.sy;
      });
    }

    function spawnBead() {
      /* chaque perle va vers une chaîne qui n'a pas encore sa longueur */
      let c = null;
      for (let k = 0; k < chains.length; k++) {
        const cc = chains[(spawned + k) % chains.length];
        if (cc.list.length + cc.flying < cc.n) {
          c = cc;
          break;
        }
      }
      if (!c) return false;
      const b = free(beads);
      if (!b) return false;
      let best = null, bd = 1e9;
      for (let k = 0; k < 8; k++) {
        const wp = wall[Math.floor(Math.random() * wall.length)];
        if (wp.s !== c.side) continue;
        const d = Math.abs(wp.y - c.sy) + Math.random() * 40;
        if (d < bd) {
          bd = d;
          best = wp;
        }
      }
      if (!best) best = wall[0];
      b.on = true;
      b.linked = false;
      b.chain = c;
      c.flying++;
      b.x = best.x;
      b.y = best.y;
      b.vx = best.s * rand(10, 30);
      b.vy = rand(-10, 10);
      b.col = Math.floor(Math.random() * MOL.length);
      b.t = 0;
      flash(b.x, b.y, MOL[b.col]);
      spawned++;
      return true;
    }

    /* premier élément libre d'une réserve (pas d'allocation) */
    function free(arr) {
      for (let i = 0; i < arr.length; i++) if (!arr[i].on) return arr[i];
      return null;
    }
    function flash(x, y, col) {
      const f = free(flashes);
      if (!f) return;
      f.on = true;
      f.x = x;
      f.y = y;
      f.t = 0;
      f.col = col;
    }
    function ripple(x, y, r) {
      const q = free(ripples);
      if (!q) return;
      q.on = true;
      q.x = x;
      q.y = y;
      q.t = 0;
      q.r = r;
    }
    function spawnBubble(fromBase) {
      const b = free(bubbles);
      if (!b) return;
      b.on = true;
      if (fromBase || Math.random() < 0.4) {
        b.x = geo.cx + rand(-1, 1) * geo.hw0 * 1.4;
        b.y = geo.gy - rand(0, 10);
      } else {
        const wp = wall[Math.floor(Math.random() * wall.length)];
        b.x = wp.x;
        b.y = wp.y;
      }
      b.vy = -rand(16, 34);
      b.r = rand(1.2, 3.4);
      b.t = 0;
      b.ph = rand(TAU);
    }

    /* ---- cellules ---- */
    function makeCell(x, y, r, cols, anchor) {
      return {
        x, y, vx: 0, vy: 0, r, R: geo.R, cols, seed: rand(20), spin: rand(TAU),
        dir: Math.random() < 0.5 ? -1 : 1, div: null, bump: 0, anchor, ax: x, ay: y, born: time,
      };
    }
    function countAfter() {
      let n = cells.length;
      for (let i = 0; i < cells.length; i++) if (cells[i].div) n++;
      return n;
    }
    function freeSpace(x, y, self) {
      let m = Math.min(x, geo.w - x, y, groundAt(x) - y);
      if (Math.abs(x - geo.cx) < chimHalf(y) + 4 && y > geo.top - 10) m = Math.min(m, 0);
      for (let i = 0; i < cells.length; i++) {
        const c = cells[i];
        if (c === self) continue;
        m = Math.min(m, Math.hypot(c.x - x, c.y - y) - c.r);
      }
      return m;
    }
    function startDivision(c) {
      releaseSprite(c);
      /* la cellule s'allonge dans la direction où il y a le plus de place */
      let best = 0, bs = -1e9;
      const off = rand(TAU);
      for (let k = 0; k < 8; k++) {
        const a = off + (k / 8) * Math.PI;
        const dx = Math.cos(a) * c.r * 1.4, dy = Math.sin(a) * c.r * 1.4;
        const s = Math.min(freeSpace(c.x + dx, c.y + dy, c), freeSpace(c.x - dx, c.y - dy, c));
        if (s > bs) {
          bs = s;
          best = a;
        }
      }
      c.div = { t: 0, ang: best };
      c.anchor = false;
      api.sfx.play('bubble', { pitch: rand(0.85, 1.2), gap: 30 });
      api.buzz(10);
    }
    function split(c) {
      const a = c.div.ang, ca = Math.cos(a), sa = Math.sin(a);
      const d = c.r * 1.32, r = c.r * 0.74;
      const b = makeCell(c.x - ca * d, c.y - sa * d, r, c.cols, false);
      b.vx = -ca * 34;
      b.vy = -sa * 34;
      b.spin = c.spin;
      c.x += ca * d;
      c.y += sa * d;
      c.r = r;
      c.vx = ca * 34;
      c.vy = sa * 34;
      c.div = null;
      c.seed = rand(20);
      c.bump = 0.12;
      b.bump = 0.12;
      cells.push(b);
      flash(c.x - ca * d * 0.5, c.y - sa * d * 0.5, '#CFFFF0');
      api.sfx.play('pop', { pitch: rand(1.1, 1.4), volume: 0.6, gap: 20 });
      onCount();
    }
    function onCount() {
      const n = cells.length;
      if (!finished) {
        api.status(fill(TEXTES.cellules, n));
        setProgress(0.6 + 0.4 * clamp((n - START) / (GOAL - START)));
        if (n >= GOAL) {
          finished = true;
          autoT = 2.5;
          api.done(TEXTES.fin, TEXTES.finStatut);
        }
      }
    }
    function setProgress(p) {
      const q = Math.round(p * 200);
      if (q === shownP) return;
      shownP = q;
      api.progress(p);
    }

    /* ---- interaction ---- */
    api.track(cv.canvas, {
      up(p, e, cancelled) {
        if (cancelled || !p.tap) return;
        onTap(p.x, p.y);
      },
    }, { touchAction: 'pan-y' });

    function onTap(x, y) {
      ripple(x, y, 26);
      if (phase !== 'play') {
        api.sfx.play('pop', { pitch: rand(0.8, 1.1), volume: 0.5 });
        if (phase === 'ing') nudgeChips();
        return;
      }
      let best = null, bd = 1e9;
      for (let i = 0; i < cells.length; i++) {
        const c = cells[i];
        if (c.div) continue;
        const d = Math.hypot(c.x - x, c.y - y);
        if (d < Math.max(c.r * 2.1, 30) && d < bd) {
          bd = d;
          best = c;
        }
      }
      if (!best) {
        api.sfx.play('pop', { pitch: rand(0.8, 1.1), volume: 0.5 });
        return;
      }
      if (!firstTap) {
        firstTap = true;
        api.gesture(null);
      }
      if (countAfter() >= MAX) {
        best.bump = 0.3;
        api.sfx.play('pop', { pitch: 1.3, volume: 0.6 });
        return;
      }
      startDivision(best);
    }

    /* ---- animation ---- */
    function update(dt) {
      time += dt;
      const slow = RM ? 0.4 : 1;
      for (let i = 0; i < 3; i++) {
        const key = ING[i];
        K[key] = have[key] ? Math.min(1, K[key] + dt / 1.1) : 0;
      }

      /* panache de fluide chaud */
      if (K.chaleur > 0) {
        let n = 24 * K.chaleur * dt * (RM ? 0.6 : 1);
        while (n > 0) {
          if (n >= 1 || Math.random() < n) {
            const p = free(plume);
            if (p) {
              p.on = true;
              p.x = geo.vx + rand(-2, 2);
              p.y = geo.vy;
              p.vx = rand(-6, 6);
              p.vy = -rand(52, 72);
              p.r0 = rand(2.5, 4);
              p.r1 = rand(18, 34) * (geo.S / 360);
              p.t = 0;
              p.life = rand(3, 4.2);
            }
          }
          n -= 1;
        }
      }
      for (let i = 0; i < plume.length; i++) {
        const p = plume[i];
        if (!p.on) continue;
        p.t += dt * slow;
        if (p.t >= p.life || p.y < -60) {
          p.on = false;
          continue;
        }
        /* le fluide chaud ralentit en montant et s'étale en volutes */
        const k = Math.exp(-dt * 0.55 * slow);
        p.vy *= k;
        const curl = nz.noise2(p.x * 0.03, p.y * 0.03 + time * 0.25) - 0.5;
        p.vx = p.vx * k + (3 + curl * 70 * Math.min(1, p.t)) * dt * slow;
        p.x += p.vx * dt * slow;
        p.y += p.vy * dt * slow;
      }

      /* eau : bulles et courants */
      if (K.eau > 0 && Math.random() < 7 * K.eau * dt) spawnBubble(false);
      if (K.chaleur > 0 && K.eau > 0 && Math.random() < 3 * dt) spawnBubble(true);
      for (let i = 0; i < bubbles.length; i++) {
        const b = bubbles[i];
        if (!b.on) continue;
        b.t += dt;
        b.y += b.vy * dt * slow;
        b.x += Math.sin(b.t * 3 + b.ph) * 10 * dt * slow;
        if (b.y < -10) b.on = false;
      }
      for (let i = 0; i < tracers.length; i++) tracers[i].th -= tracers[i].om * dt * slow;
      for (let i = 0; i < snow.length; i++) {
        const s = snow[i];
        s.y += s.vy * dt * slow;
        s.x += Math.sin(time * 0.3 + s.ph) * 3 * dt;
        if (s.y > groundAt(s.x)) {
          s.y = -4;
          s.x = rand(geo.w);
        }
      }

      if (phase === 'build') updateBuild(dt);
      if (phase === 'play' || cells.length) updateCells(dt);
      if (finished && phase === 'play') {
        /* après la réussite, les cellules continuent à se diviser d'elles-mêmes */
        autoT -= dt;
        if (autoT <= 0) {
          autoT = rand(2.6, 4.2);
          if (countAfter() < MAX) {
            const free = cells.filter((c) => !c.div && time - c.born > 2);
            if (free.length) startDivision(free[Math.floor(Math.random() * free.length)]);
          }
        }
      }

      for (let i = 0; i < ripples.length; i++) {
        const q = ripples[i];
        if (!q.on) continue;
        q.t += dt / 0.55;
        if (q.t >= 1) q.on = false;
      }
      for (let i = 0; i < flashes.length; i++) {
        const f = flashes[i];
        if (!f.on) continue;
        f.t += dt / 0.5;
        if (f.t >= 1) f.on = false;
      }
    }

    function updateBuild(dt) {
      bt += dt;
      setProgress(0.45 + 0.15 * clamp(bt / T_PLAY));
      if (!barGone && bt > 1.0) {
        barGone = true;
        bar.classList.add('is-gone');
      }
      if (bt < T_SPAWN + 0.6) {
        spawnAcc += dt * (41 / T_SPAWN);
        while (spawnAcc >= 1) {
          spawnAcc -= 1;
          spawnBead();
        }
      }
      /* les perles libres filent vers le bout de leur chaîne */
      for (let i = 0; i < beads.length; i++) {
        const b = beads[i];
        if (!b.on || b.linked) continue;
        b.t += dt;
        const c = b.chain;
        const tail = c.list.length ? c.list[c.list.length - 1] : null;
        const tx = tail ? tail.x : c.ax, ty = tail ? tail.y : c.ay;
        const dx = tx - b.x, dy = ty - b.y, d = Math.hypot(dx, dy) || 1;
        const sp = Math.min(95, 30 + d * 1.4);
        const wob = (nz.noise2(i * 3.1, time * 1.5) - 0.5) * 60;
        b.vx = lerp(b.vx, (dx / d) * sp - (dy / d) * wob, Math.min(1, dt * 3));
        b.vy = lerp(b.vy, (dy / d) * sp + (dx / d) * wob, Math.min(1, dt * 3));
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (d < LINK * 1.3 || b.t > 2.6) {
          b.linked = true;
          c.flying--;
          c.list.push(b);
          flash(b.x, b.y, MOL[b.col]);
          api.sfx.play('tick', { pitch: rand(0.9, 1.5), volume: 0.6, gap: 60 });
        }
      }
      /* chaque chaîne s'éloigne de la paroi vers sa place dans l'eau */
      for (let ci = 0; ci < chains.length; ci++) {
        const c = chains[ci];
        const k = sstep(0, 1, (bt - c.t0) / 3.4);
        c.ax = lerp(c.sx, c.hx, k) + Math.sin(time * 0.9 + c.ph) * 4;
        c.ay = lerp(c.sy, c.hy, k) + Math.cos(time * 0.7 + c.ph) * 3;
        if (c.state === 'grow') {
          const L = c.list;
          if (L.length) {
            L[0].x = lerp(L[0].x, c.ax, Math.min(1, dt * 5));
            L[0].y = lerp(L[0].y, c.ay, Math.min(1, dt * 5));
          }
          for (let j = 1; j < L.length; j++) {
            const p = L[j - 1], q = L[j];
            const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1;
            const wig = Math.sin(time * 2.2 + j * 0.9 + c.ph) * 0.45;
            q.x = lerp(q.x, p.x + (dx / d) * LINK - (dy / d) * wig, 0.5);
            q.y = lerp(q.y, p.y + (dy / d) * LINK + (dx / d) * wig, 0.5);
          }
          if (bt >= T_WRAP + (c.cell ? (ci % 3) * 0.12 : 0)) {
            c.state = c.cell ? 'wrap' : 'fade';
            c.wt = 0;
            for (let j = 0; j < L.length; j++) {
              L[j].x0 = L[j].x;
              L[j].y0 = L[j].y;
            }
          }
        } else if (c.state === 'wrap') {
          /* une fine membrane se referme autour de la chaîne */
          c.wt += dt / D_WRAP;
          const e = ease.inOutCubic(clamp(c.wt));
          const L = c.list;
          for (let j = 0; j < L.length; j++) {
            coilPos(j, L.length, c.ax, c.ay, geo.R, time * 0.5, P);
            L[j].x = lerp(L[j].x0, P.x, e);
            L[j].y = lerp(L[j].y0, P.y, e);
          }
          if (c.wt >= 1) {
            const cols = L.map((b) => b.col);
            cells.push(makeCell(c.ax, c.ay, geo.R, cols, c.first));
            L.forEach((b) => { b.on = false; });
            c.state = 'done';
            api.sfx.play('bubble', { pitch: 0.8, gap: 0 });
          }
        } else if (c.state === 'fade') {
          c.wt += dt / 1.2;
          c.alpha = 1 - clamp(c.wt);
          const L = c.list;
          for (let j = 0; j < L.length; j++) {
            L[j].x += (L[j].x - geo.cx) * dt * 0.15;
            L[j].y -= dt * 6;
          }
          if (c.wt >= 1) {
            L.forEach((b) => { b.on = false; });
            c.state = 'done';
          }
        }
      }
      if (bt >= T_PLAY) {
        phase = 'play';
        chains = [];
        for (let i = 0; i < beads.length; i++) beads[i].on = false;
        api.hint(TEXTES.divise);
        api.status(fill(TEXTES.cellules, cells.length));
        setProgress(0.6);
        const c0 = cells.find((c) => c.anchor) || cells[0];
        if (c0) api.gesture('tap', { x: (c0.x / geo.w) * 100, y: (c0.y / geo.h) * 100 });
      }
    }

    /* la chaîne repliée à l'intérieur d'une cellule */
    function coilPos(j, n, x, y, r, spin, out) {
      const u = n > 1 ? j / (n - 1) : 0.5;
      const lx = (u - 0.5) * 1.15 * r;
      const ly = 0.24 * r * Math.sin(u * TAU * 0.9 + time * 1.2);
      const cs = Math.cos(spin), sn = Math.sin(spin);
      out.x = x + lx * cs - ly * sn;
      out.y = y + lx * sn + ly * cs;
    }

    function updateCells(dt) {
      const slow = RM ? 0.35 : 1;
      const n0 = cells.length;
      for (let i = 0; i < n0; i++) {
        const c = cells[i];
        if (c.r < c.R) c.r = Math.min(c.R, c.r + dt * c.R * 0.1);
        c.bump *= Math.pow(0.02, dt);
        c.spin += dt * 0.45 * c.dir * slow;
        if (c.div) {
          c.div.t += dt / D_DIV;
          if (c.div.t >= 1) split(c);
          continue;
        }
        c.vx += (nz.noise2(c.seed, time * 0.22) - 0.5) * 26 * dt * slow;
        c.vy += (nz.noise2(c.seed + 40, time * 0.22) - 0.5) * 22 * dt * slow;
        /* elles restent dans l'eau claire, entre le haut de la scène et le pied de la cheminée */
        const yTop = geo.h * 0.1, yBot = geo.gy - geo.h * 0.1;
        if (c.y < yTop) c.vy += (yTop - c.y) * dt * 2.5;
        if (c.y > yBot) c.vy -= (c.y - yBot) * dt * 2.5;
        if (c.anchor) {
          c.vx += (c.ax - c.x) * dt * 4;
          c.vy += (c.ay - c.y) * dt * 4;
        }
      }
      /* les cellules se repoussent doucement */
      const n = cells.length;
      for (let i = 0; i < n; i++) {
        const a = cells[i];
        for (let j = i + 1; j < n; j++) {
          const b = cells[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const want = (a.r + b.r) * 1.3 + 10;
          const d2 = dx * dx + dy * dy;
          if (d2 > want * want) continue;
          const d = Math.sqrt(d2) || 0.01;
          const f = ((want - d) / want) * 90 * dt;
          const ux = dx / d, uy = dy / d;
          if (!a.div) {
            a.vx -= ux * f;
            a.vy -= uy * f;
          }
          if (!b.div) {
            b.vx += ux * f;
            b.vy += uy * f;
          }
        }
      }
      for (let i = 0; i < n; i++) {
        const c = cells[i];
        const m = c.r + 8;
        /* parois de la scène, sol, cheminée */
        if (c.x < m) c.vx += (m - c.x) * dt * 8;
        if (c.x > geo.w - m) c.vx -= (c.x - geo.w + m) * dt * 8;
        if (c.y < m) c.vy += (m - c.y) * dt * 8;
        const gy = groundAt(c.x) - c.r - 6;
        if (c.y > gy) c.vy -= (c.y - gy) * dt * 8;
        if (c.y > geo.top - c.r - 14) {
          const hw = chimHalf(c.y) + c.r + 8;
          const dx = c.x - geo.cx;
          if (Math.abs(dx) < hw) c.vx += Math.sign(dx || 1) * (hw - Math.abs(dx)) * dt * 9;
        }
        const k = Math.exp(-1.7 * dt);
        c.vx *= k;
        c.vy *= k;
        const sp = Math.hypot(c.vx, c.vy);
        if (sp > 80) {
          c.vx *= 80 / sp;
          c.vy *= 80 / sp;
        }
        c.x += c.vx * dt * (c.div ? 0.3 : 1);
        c.y += c.vy * dt * (c.div ? 0.3 : 1);
      }
    }

    /* ---- dessin ---- */
    function drawShimmer() {
      /* l'eau brûlante tremble au-dessus de la cheminée */
      const amp = 2.2 * K.chaleur * (RM ? 0.4 : 1);
      if (amp < 0.05) return;
      const dpr = cv.dpr;
      const zw = Math.max(70, geo.hw1 * 5.5);
      const x0 = Math.max(0, geo.vx - zw / 2);
      const y0 = Math.max(0, geo.vy - geo.h * 0.24), y1 = geo.vy + geo.h * 0.05;
      const H = y1 - y0, step = 3;
      const bx = chimBox.x, by = chimBox.y;
      for (let y = y0; y < y1; y += step) {
        const u = (y - y0) / H;
        const off = amp * Math.sin(Math.PI * u) * Math.sin(time * 7 + y * 0.12);
        ctx.drawImage(bg, x0 * dpr, y * dpr, zw * dpr, step * dpr, x0 + off, y, zw, step);
        if (y + step > by && y < by + chimBox.h) {
          const sy = Math.max(0, y - by);
          ctx.drawImage(crystBaked ? crystC : chim, (x0 - bx) * dpr, sy * dpr, zw * dpr, step * dpr, x0 + off, by + sy, zw, step);
        }
      }
    }

    function drawSnow() {
      ctx.fillStyle = '#CFEFE6';
      for (let i = 0; i < snow.length; i++) {
        const s = snow[i];
        ctx.globalAlpha = s.a;
        ctx.fillRect(s.x, s.y, s.s, s.s);
      }
      ctx.globalAlpha = 1;
    }

    const TR_SEG = 9;
    function drawTracers() {
      if (K.eau <= 0.01) return;
      ctx.lineCap = 'round';
      ctx.lineWidth = 1.5;
      for (let j = 0; j < TR_SEG; j++) {
        ctx.strokeStyle = rgba('#8FF0D6', 0.42 * K.eau * (1 - j / TR_SEG));
        ctx.beginPath();
        for (let i = 0; i < tracers.length; i++) {
          const tr = tracers[i];
          const a0 = tr.th + (j / TR_SEG) * tr.len, a1 = tr.th + ((j + 1) / TR_SEG) * tr.len;
          tracerPos(tr, a0, P);
          ctx.moveTo(P.x, P.y);
          tracerPos(tr, a1, P);
          ctx.lineTo(P.x, P.y);
        }
        ctx.stroke();
      }
    }

    function drawBubbles() {
      ctx.lineWidth = 1;
      for (let i = 0; i < bubbles.length; i++) {
        const b = bubbles[i];
        if (!b.on) continue;
        const a = Math.min(1, b.t * 3) * 0.75;
        ctx.strokeStyle = rgba('#CFFFF2', a);
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, TAU);
        ctx.stroke();
        ctx.fillStyle = rgba('#FFFFFF', a * 0.8);
        ctx.fillRect(b.x - b.r * 0.45, b.y - b.r * 0.5, 1, 1);
      }
    }

    function drawChimneyFx() {
      /* chaleur : la base rougeoie */
      const hk = K.chaleur;
      if (hk > 0.01) {
        const fl = RM ? 1 : 0.85 + 0.15 * Math.sin(time * 5.3) * Math.sin(time * 3.1);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = hk * fl;
        ctx.drawImage(hot, chimBox.x, hotY, chimBox.w, chimBox.y + chimBox.h - hotY);
        ctx.globalAlpha = 1;
        ctx.save();
        ctx.translate(geo.cx, geo.gy - geo.hw0 * 0.2);
        ctx.scale(geo.hw0 * 2.4, geo.hw0 * 1.3);
        ctx.globalAlpha = 0.5 * hk * fl;
        ctx.drawImage(glowWarm, -1, -1, 2, 2);
        ctx.restore();
        ctx.globalAlpha = 0.55 * hk;
        const vg = geo.hw1 * 2.4;
        ctx.drawImage(warmSpr, geo.vx - vg, geo.vy - vg, vg * 2, vg * 2);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
      /* minéraux : les parois se couvrent de pores et de petits cristaux qui scintillent */
      const mt = time - tAdd.mineraux;
      if (have.mineraux) {
        if (!crystBaked) {
          drawMinerals(ctx, mt);
          /* une fois tous formés, on les fige avec la cheminée dans une seule image */
          if (mt > 1.8) {
            const g = crystC.getContext('2d');
            g.setTransform(1, 0, 0, 1, 0, 0);
            g.clearRect(0, 0, crystC.width, crystC.height);
            g.drawImage(chim, 0, 0);
            g.setTransform(cv.dpr, 0, 0, cv.dpr, -chimBox.x * cv.dpr, -chimBox.y * cv.dpr);
            drawMinerals(g, 9);
            crystBaked = true;
          }
        }
        /* reflets qui scintillent */
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < crystals.length; i++) {
          const c = crystals[i];
          if (mt < c.d + 0.3) continue;
          const tw = Math.pow(Math.max(0, Math.sin(time * c.f + c.ph)), 12) * K.mineraux * (RM ? 0.5 : 1);
          if (tw < 0.05) continue;
          const r = (2.5 + c.s * 0.9) * 1.5;
          ctx.globalAlpha = tw;
          ctx.drawImage(sparkSpr, c.sx - r, c.sy - r, r * 2, r * 2);
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
    }

    /* pores et grappes de prismes, qui poussent un à un */
    function drawMinerals(g, mt) {
      for (let i = 0; i < pores.length; i++) {
        const p = pores[i];
        const k = ease.outCubic(clamp((mt - p.d) / 0.5));
        if (k <= 0) continue;
        const r = p.s * k;
        g.fillStyle = 'rgba(16,9,6,0.72)';
        g.beginPath();
        g.ellipse(p.x, p.y, r * 1.15, r * 0.9, 0, 0, TAU);
        g.fill();
        g.strokeStyle = 'rgba(236,206,166,0.22)';
        g.lineWidth = 0.8;
        g.beginPath();
        g.ellipse(p.x, p.y + 0.4, r * 1.2, r * 0.95, 0, 0.15 * Math.PI, 0.85 * Math.PI);
        g.stroke();
      }
      for (let i = 0; i < crystals.length; i++) {
        const c = crystals[i];
        const k = ease.outBack(clamp((mt - c.d) / 0.45));
        if (k <= 0) continue;
        for (let j = 0; j < c.prisms.length; j++) {
          const pr = c.prisms[j];
          const a = c.ang + pr.da;
          const ca = Math.cos(a), sa = Math.sin(a);
          const L = pr.L * k, W = pr.W * Math.min(1, k);
          const nx = -sa * W, ny = ca * W;
          const bx = c.x - ca * 0.6, by = c.y - sa * 0.6;
          const sx = c.x + ca * L * 0.72, sy = c.y + sa * L * 0.72;
          const tx = c.x + ca * L, ty = c.y + sa * L;
          /* face éclairée */
          g.fillStyle = c.col;
          g.globalAlpha = 0.92;
          g.beginPath();
          g.moveTo(bx + nx, by + ny);
          g.lineTo(sx + nx, sy + ny);
          g.lineTo(tx, ty);
          g.lineTo(sx, sy);
          g.lineTo(bx, by);
          g.closePath();
          g.fill();
          /* face à l'ombre */
          g.fillStyle = 'rgba(30,60,70,0.55)';
          g.beginPath();
          g.moveTo(bx - nx, by - ny);
          g.lineTo(sx - nx, sy - ny);
          g.lineTo(tx, ty);
          g.lineTo(sx, sy);
          g.lineTo(bx, by);
          g.closePath();
          g.fill();
          g.globalAlpha = 1;
        }
      }
    }

    function drawPlume() {
      for (let i = 0; i < plume.length; i++) {
        const p = plume[i];
        if (!p.on) continue;
        const k = p.t / p.life;
        const r = lerp(p.r0, p.r1, ease.outQuad(k));
        ctx.globalAlpha = 0.34 * Math.min(1, k * 8) * Math.pow(1 - k, 1.2);
        ctx.drawImage(plumeSpr, p.x - r, p.y - r, r * 2, r * 2);
      }
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < plume.length; i++) {
        const p = plume[i];
        if (!p.on || p.t > 0.7) continue;
        const k = p.t / 0.7;
        const r = lerp(p.r0, p.r1, ease.outQuad(p.t / p.life)) * 0.9;
        ctx.globalAlpha = 0.45 * (1 - k) * K.chaleur;
        ctx.drawImage(warmSpr, p.x - r, p.y - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    /* une perle (molécule), dessinée à partir d'une petite image prête à l'emploi */
    function drawBead(x, y, r, ci, a) {
      const s = r / BEAD_R, o = (BEAD_R + 1) * s;
      ctx.globalAlpha = a;
      ctx.drawImage(beadSpr[ci], x - o, y - o, o * 2, o * 2);
      ctx.globalAlpha = 1;
    }

    function drawChains() {
      if (phase !== 'build') return;
      for (let ci = 0; ci < chains.length; ci++) {
        const c = chains[ci];
        if (c.state === 'done') continue;
        const L = c.list;
        if (L.length > 1) {
          ctx.globalAlpha = c.alpha;
          ctx.strokeStyle = 'rgba(227,245,240,0.6)';
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.moveTo(L[0].x, L[0].y);
          for (let j = 1; j < L.length; j++) ctx.lineTo(L[j].x, L[j].y);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        const br = c.state === 'wrap' ? lerp(3.1, geo.R * 0.13, ease.inOutCubic(clamp(c.wt))) : 3.1;
        for (let j = 0; j < L.length; j++) drawBead(L[j].x, L[j].y, br, L[j].col, c.alpha);
        if (c.state === 'wrap') drawForming(c);
      }
      for (let i = 0; i < beads.length; i++) {
        const b = beads[i];
        if (b.on && !b.linked) drawBead(b.x, b.y, 3.1, b.col, Math.min(1, b.t * 5));
      }
    }

    function drawForming(c) {
      const k = clamp(c.wt), R = geo.R;
      /* de petits grains se rassemblent en membrane */
      const e = ease.outCubic(k);
      const rr = lerp(R * 2.3, R, e);
      ctx.fillStyle = '#CFFFF0';
      for (let i = 0; i < 22; i++) {
        const a = (i / 22) * TAU + time * 0.6;
        ctx.globalAlpha = Math.min(1, k * 3) * (1 - sstep(0.7, 1, k));
        ctx.beginPath();
        ctx.arc(c.ax + Math.cos(a) * rr, c.ay + Math.sin(a) * rr, 1.5, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      const m = sstep(0.45, 1, k);
      if (m > 0) drawCellBody(c.ax, c.ay, R * lerp(0.85, 1, m), c.ph * 3, time, m);
    }

    function drawCellBody(x, y, r, seed, t, alpha) {
      ctx.globalAlpha = 0.2 * alpha;
      ctx.drawImage(glowMint, x - r * 2.3, y - r * 2.3, r * 4.6, r * 4.6);
      ctx.globalAlpha = alpha;
      draw.blob(ctx, x, y, r, 0.075, seed, RM ? 0 : t * 1.3, 30);
      ctx.fillStyle = 'rgba(125,232,201,0.13)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(125,232,201,0.18)';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(205,255,240,0.8)';
      ctx.lineWidth = 1.3;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.32)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.72, -2.5, -1.7);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    function drawInnerChain(x, y, r, cols, spin, alpha) {
      const n = cols.length;
      ctx.globalAlpha = alpha * 0.7;
      ctx.strokeStyle = 'rgba(227,245,240,0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let j = 0; j < n; j++) {
        coilPos(j, n, x, y, r, spin, P);
        if (j === 0) ctx.moveTo(P.x, P.y);
        else ctx.lineTo(P.x, P.y);
      }
      ctx.stroke();
      const br = Math.max(1.5, r * 0.13);
      for (let j = 0; j < n; j++) {
        coilPos(j, n, x, y, r, spin, P);
        drawBead(P.x, P.y, br, cols[j], alpha);
      }
    }

    /* contour organique ajouté au tracé en cours (même forme que draw.blob) */
    function blobInto(g, x, y, r, wob, seed, t, pts) {
      for (let i = 0; i <= pts; i++) {
        const a = (i / pts) * TAU;
        const k = blobK(a, seed, wob, t);
        const px = x + Math.cos(a) * r * k, py = y + Math.sin(a) * r * k;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.closePath();
    }
    /* perles des chaînes intérieures : position, rayon et couleur, regroupées pour le dessin */
    const BMAX = MAX * 10;
    const BX = new Float32Array(BMAX), BY = new Float32Array(BMAX), BR = new Float32Array(BMAX);
    const BC = new Uint8Array(BMAX);

    /* contour d'une cellule qui se divise (axe x, unité = rayon) */
    const OUT = new Float32Array(240);
    function divShape(k, seed, t) {
      let n = 0;
      const wob = RM ? 0.03 : 0.06;
      if (k < 0.3) {
        const e = ease.inOutSine(k / 0.3);
        const sx = 1 + 0.35 * e, sy = 1 - 0.2 * e;
        for (let i = 0; i < 48; i++) {
          const a = (i / 48) * TAU;
          const q = blobK(a, seed, wob, t);
          OUT[n++] = Math.cos(a) * sx * q;
          OUT[n++] = Math.sin(a) * sy * q;
        }
        return n / 2;
      }
      const kb = (k - 0.3) / 0.7;
      const s = lerp(0.55, 1.32, ease.inOutSine(kb));
      const rc = lerp(0.8, 0.74, kb);
      const w = 0.8 * (1 - sstep(0, 0.82, kb));
      const B = 1.0, cb = Math.cos(B), sb = Math.sin(B);
      const M = 22;
      const ex = s - rc * cb, ey = rc * sb, cyb = 2 * w - ey;
      for (let i = 0; i <= M; i++) {
        const a = B - Math.PI + (i / M) * (TAU - 2 * B);
        const q = 1 + (blobK(a, seed, wob, t) - 1) * Math.sin((Math.PI * i) / M);
        OUT[n++] = s + Math.cos(a) * rc * q;
        OUT[n++] = Math.sin(a) * rc * q;
      }
      for (let i = 1; i < 8; i++) {
        const u = i / 8;
        OUT[n++] = (1 - u) * (1 - u) * ex - u * u * ex;
        OUT[n++] = (1 - u) * (1 - u) * ey + 2 * (1 - u) * u * cyb + u * u * ey;
      }
      for (let i = 0; i <= M; i++) {
        const a = B + (i / M) * (TAU - 2 * B);
        const q = 1 + (blobK(a + 1.3, seed, wob, t) - 1) * Math.sin((Math.PI * i) / M);
        OUT[n++] = -s + Math.cos(a) * rc * q;
        OUT[n++] = Math.sin(a) * rc * q;
      }
      for (let i = 1; i < 8; i++) {
        const u = i / 8;
        OUT[n++] = -(1 - u) * (1 - u) * ex + u * u * ex;
        OUT[n++] = -((1 - u) * (1 - u) * ey + 2 * (1 - u) * u * cyb + u * u * ey);
      }
      return n / 2;
    }

    function drawDividing(c) {
      const k = clamp(c.div.t);
      const t = RM ? 0 : time * 1.3;
      const n = divShape(k, c.seed, t);
      const ca = Math.cos(c.div.ang), sa = Math.sin(c.div.ang);
      const s = k < 0.3 ? 0 : lerp(0.55, 1.32, ease.inOutSine((k - 0.3) / 0.7));
      ctx.globalAlpha = 0.2;
      for (let side = -1; side <= 1; side += 2) {
        const gx = c.x + ca * s * c.r * side, gy = c.y + sa * s * c.r * side;
        const gr = c.r * 2.1;
        ctx.drawImage(glowMint, gx - gr, gy - gr, gr * 2, gr * 2);
      }
      ctx.globalAlpha = 1;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.div.ang);
      ctx.scale(c.r, c.r);
      ctx.beginPath();
      ctx.moveTo(OUT[0], OUT[1]);
      for (let i = 1; i < n; i++) ctx.lineTo(OUT[i * 2], OUT[i * 2 + 1]);
      ctx.closePath();
      ctx.fillStyle = 'rgba(125,232,201,0.15)';
      ctx.fill();
      ctx.lineWidth = 4 / c.r;
      ctx.strokeStyle = 'rgba(125,232,201,0.18)';
      ctx.stroke();
      ctx.lineWidth = 1.3 / c.r;
      ctx.strokeStyle = 'rgba(205,255,240,0.85)';
      ctx.stroke();
      ctx.restore();
      /* la chaîne se recopie : une dans chaque moitié */
      if (k < 0.3) {
        drawInnerChain(c.x, c.y, c.r * (1 + 0.3 * k), c.cols, c.spin, 1);
      } else {
        const ss = s * 0.92;
        drawInnerChain(c.x + ca * ss * c.r, c.y + sa * ss * c.r, c.r * 0.74, c.cols, c.spin, 1);
        drawInnerChain(c.x - ca * ss * c.r, c.y - sa * ss * c.r, c.r * 0.74, c.cols, c.spin + 0.6, 1);
      }
    }

    /* Chaque cellule au repos est pré-rendue (halo + membrane) dans une petite image, recalculée
       quelques fois par seconde pour que la membrane continue d'onduler : rapide même à 28. */
    function cellR(c) {
      return c.r * (1 + c.bump * Math.sin((time - c.born) * 18));
    }
    const SPR_PAD = 2.4;      /* le halo déborde de la membrane */
    const sprPool = [];
    function cellSprite(c) {
      if (!c.spr) {
        c.spr = sprPool.pop() || mk(1, 1);
        c.sprT = -9;
      }
      const r = c.r;
      const half = Math.ceil(r * SPR_PAD);
      const need = Math.ceil(half * 2 * cv.dpr);
      const due = time - c.sprT > (RM ? 1e9 : 0.14) || Math.abs(c.sprR - r) > 0.4;
      if (!due && c.spr.width === need) return c.spr;
      if (c.spr.width !== need) c.spr.width = c.spr.height = need;
      const g = c.spr.getContext('2d');
      g.setTransform(cv.dpr, 0, 0, cv.dpr, half * cv.dpr, half * cv.dpr);
      g.clearRect(-half, -half, half * 2, half * 2);
      g.globalAlpha = 0.2;
      g.drawImage(glowMint, -r * 2.3, -r * 2.3, r * 4.6, r * 4.6);
      g.globalAlpha = 1;
      g.beginPath();
      blobInto(g, 0, 0, r, 0.075, c.seed, RM ? 0 : time * 1.3, 26);
      g.fillStyle = 'rgba(125,232,201,0.13)';
      g.fill();
      g.strokeStyle = 'rgba(125,232,201,0.18)';
      g.lineWidth = 4;
      g.stroke();
      g.strokeStyle = 'rgba(205,255,240,0.8)';
      g.lineWidth = 1.3;
      g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.32)';
      g.lineWidth = 1.2;
      g.beginPath();
      g.arc(0, 0, r * 0.72, -2.5, -1.7);
      g.stroke();
      c.sprT = time - Math.random() * 0.05;
      c.sprR = r;
      c.sprH = half;
      return c.spr;
    }
    function releaseSprite(c) {
      if (c.spr) sprPool.push(c.spr);
      c.spr = null;
    }
    function drawCells() {
      const n = cells.length;
      if (!n) return;
      /* membranes (avec leur halo) */
      for (let i = 0; i < n; i++) {
        const c = cells[i];
        if (c.div) continue;
        const spr = cellSprite(c);
        const s = cellR(c) / c.r, hh = c.sprH * s;
        ctx.drawImage(spr, c.x - hh, c.y - hh, hh * 2, hh * 2);
      }
      /* cellules en train de se diviser */
      for (let i = 0; i < n; i++) if (cells[i].div) drawDividing(cells[i]);
      /* chaînes intérieures : un tracé pour les liens, puis les perles groupées par couleur */
      let m = 0;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const c = cells[i];
        if (c.div) continue;
        const r = cellR(c), L = c.cols.length, br = Math.max(1.5, r * 0.13);
        for (let j = 0; j < L; j++) {
          coilPos(j, L, c.x, c.y, r, c.spin, P);
          if (j === 0) ctx.moveTo(P.x, P.y);
          else ctx.lineTo(P.x, P.y);
          if (m < BMAX) {
            BX[m] = P.x;
            BY[m] = P.y;
            BR[m] = br;
            BC[m] = c.cols[j];
            m++;
          }
        }
      }
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = 'rgba(227,245,240,0.7)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalAlpha = 1;
      for (let ci = 0; ci < MOL.length; ci++) {
        ctx.beginPath();
        for (let k = 0; k < m; k++) {
          if (BC[k] !== ci) continue;
          ctx.moveTo(BX[k] + BR[k], BY[k]);
          ctx.arc(BX[k], BY[k], BR[k], 0, TAU);
        }
        ctx.fillStyle = MOL[ci];
        ctx.fill();
      }
      /* petit reflet sur chaque perle */
      ctx.beginPath();
      for (let k = 0; k < m; k++) {
        const rr = BR[k] * 0.36;
        const hx = BX[k] - BR[k] * 0.35, hy = BY[k] - BR[k] * 0.38;
        ctx.moveTo(hx + rr, hy);
        ctx.arc(hx, hy, rr, 0, TAU);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.fill();
    }

    function drawFx() {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < flashes.length; i++) {
        const f = flashes[i];
        if (!f.on) continue;
        const r = 4 + 10 * f.t;
        ctx.globalAlpha = 0.8 * (1 - f.t);
        draw.glow(ctx, f.x, f.y, r, f.col, 0.9);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < ripples.length; i++) {
        const q = ripples[i];
        if (!q.on) continue;
        ctx.strokeStyle = rgba('#DFFFF5', 0.6 * (1 - q.t));
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(q.x, q.y, lerp(5, q.r, ease.outCubic(q.t)), 0, TAU);
        ctx.stroke();
      }
    }

    function render() {
      const { w, h } = geo;
      if (bg) ctx.drawImage(bg, 0, 0, w, h);
      drawSnow();
      drawTracers();
      ctx.drawImage(crystBaked ? crystC : chim, chimBox.x, chimBox.y, chimBox.w, chimBox.h);
      drawShimmer();
      drawChimneyFx();
      drawPlume();
      drawBubbles();
      drawChains();
      drawCells();
      drawFx();
    }

    /* ---- remise à zéro ---- */
    function init() {
      phase = 'ing';
      bt = 0;
      finished = false;
      firstTap = false;
      nHave = 0;
      shownP = -1;
      autoT = 0;
      spawnAcc = 0;
      spawned = 0;
      ING.forEach((k) => {
        have[k] = false;
        K[k] = 0;
        tAdd[k] = -9;
      });
      crystBaked = false;
      plume.forEach((p) => { p.on = false; });
      bubbles.forEach((p) => { p.on = false; });
      beads.forEach((p) => { p.on = false; });
      ripples.forEach((p) => { p.on = false; });
      flashes.forEach((p) => { p.on = false; });
      chains = [];
      cells.forEach(releaseSprite);
      cells = [];
      resetChips();
      api.status('');
      api.gesture(null);
    }

    cv.onResize((w, h) => {
      layout(w, h);
      bar.classList.toggle('rc-narrow', w < 350);
    });

    /* pour les tests automatiques : positions des cellules (fractions de la scène) */
    api.root.__cells = () => cells.map((c) => [c.x / geo.w, c.y / geo.h, !!c.div]);

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
