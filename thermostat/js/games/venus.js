/* Vénus, la jumelle brûlante : écran partagé, la Terre à gauche, Vénus à droite, vues en coupe.
   Chaque tape sur la falaise de calcaire libère le carbone enfermé : le ciel de la Terre jaunit
   et s'épaissit, l'océan s'évapore, le thermomètre grimpe… jusqu'à ressembler à Vénus.
   Ensuite, on peut remettre le carbone dans les roches et rejouer la scène à l'envers. */
(function () {
  'use strict';
  const { lib } = window.RM;
  const { TAU, rand, clamp, lerp, ease, rgba, draw } = lib;

  const TEXTES = {
    terre: 'Terre',
    venus: 'Vénus',
    degres: '{n} °C',
    liberer: 'Libérer le carbone',
    remettre: 'Remettre le carbone dans les roches',
    repart: 'Le carbone des roches repart dans l’air…',
    fournaise: 'La Terre devient une fournaise, comme Vénus.',
    retour: 'Le carbone retourne dans les roches : la Terre redevient bleue.',
    fin: 'Sans roches pour garder le carbone, la Terre deviendrait une fournaise.',
    finStatut: 'Chez nous, l’eau et les roches calcaires enferment le carbone. Sur Vénus, il est resté dans l’air.',
  };
  const deg = (n) => TEXTES.degres.replace('{n}', n).replace(' °', ' °');

  /* ---- réglages ---- */
  const T_TERRE = 15, T_VENUS = 465;     /* températures affichées */
  const T_MIN = -40, T_MAX = 500;        /* échelle des thermomètres */
  const N_TAPS = 6;                      /* tapes pour que la Terre ressemble à Vénus */
  const N_SPARK = 30;                    /* étincelles de carbone dans la falaise */
  const THERMO = [[0, '#7FC8F8'], [0.3, '#5FB4E8'], [0.5, '#8BD86A'], [0.7, '#FFB347'], [1, '#FF4E3A']];
  const SKY_E = ['#3A80C6', '#7DB8E6', '#CFEAF7'];
  const SKY_V = ['#8C4815', '#BB6C23', '#DD9940'];
  const LIME = ['#F5F2E8', '#E9E3D1', '#F9F7F0', '#DED8C6', '#F1ECDD', '#E4DDCA'];

  function mk(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  }
  function makePool(n) {
    const a = [];
    for (let i = 0; i < n; i++) a.push({ on: false });
    return a;
  }
  function grab(pool) {
    for (let i = 0; i < pool.length; i++) if (!pool[i].on) { pool[i].on = true; return pool[i]; }
    return null;
  }
  function clearPool(pool) {
    for (let i = 0; i < pool.length; i++) pool[i].on = false;
  }
  function sprite(col, kind) {
    const c = mk(64, 64);
    const g = c.getContext('2d');
    if (kind === 'puff') {
      [[32, 34, 22, 1], [22, 30, 14, 0.8], [42, 28, 15, 0.8], [30, 22, 13, 0.7], [40, 40, 13, 0.6]].forEach(([x, y, r, a]) => {
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, rgba(col, 0.6 * a));
        gr.addColorStop(0.6, rgba(col, 0.32 * a));
        gr.addColorStop(1, rgba(col, 0));
        g.fillStyle = gr;
        g.fillRect(0, 0, 64, 64);
      });
    } else {
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, rgba(col, 1));
      gr.addColorStop(0.22, rgba(col, 0.6));
      gr.addColorStop(0.55, rgba(col, 0.16));
      gr.addColorStop(1, rgba(col, 0));
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 64);
    }
    return c;
  }
  function hexMix(a, b, t) {
    const A = lib.hexToRgb(a), B = lib.hexToRgb(b);
    return [lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)];
  }
  const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

  window.RM.games.venus = function (api) {
    const cv = api.canvas();
    const ctx = cv.ctx;
    const RMO = api.reducedMotion;
    const nR = lib.makeNoise(19), nC = lib.makeNoise(43);
    const SPR = {
      puff: sprite('#D9CBA6', 'puff'), steam: sprite('#F4F1EA', 'puff'),
      gold: sprite('#FFE69A'), warm: sprite('#FFB04A'), white: sprite('#FFFFFF'),
    };

    /* ---- état ---- */
    let mode = 'play';       /* play → cook → after → rewind → play */
    let taps = 0;
    let kT = 0, kS = 0;      /* « vénusité » de la Terre : cible et valeur affichée */
    let time = 0;
    let nudge = 0;
    let shownT = -999;
    let shownProg = -1;
    let rewindLeft = 0, rewindAcc = 0;
    let pendingGesture = false;

    const puffs = makePool(120);
    const motes = makePool(40);
    const steam = makePool(40);
    const rings = makePool(8);
    const flashes = makePool(16);
    const sparks = [];

    /* ---- géométrie ---- */
    const geo = { ok: false, w: 1, h: 1, hw: 1, s: 1, cloudH: 0, cliffTop: 0, seaY: 0, bot: 0, plainY: 0, plainB: 0, cx0: 0, sunX: 0, sunY: 0, vSunX: 0, th: { y0: 0, y1: 0, xe: 0, xv: 0 } };
    const face = [];   /* x de la face de la falaise, tous les 2 px de hauteur */
    const topL = [];   /* y du haut de la falaise, tous les 2 px de largeur */
    let cliffPath = null;
    let earthGround = null, cliffCool = null, cliffHot = null, earthGlow = null, venusBg = null, venusGlow = null;
    let cloudBack = null, cloudFront = null;
    const skyCache = new Map();
    const hazeCache = new Map();
    let shadowGrad = null;

    function faceAt(y) {
      const i = clamp((y - geo.cliffTop) / 2, 0, face.length - 1);
      const i0 = Math.floor(i), i1 = Math.min(face.length - 1, i0 + 1);
      return lerp(face[i0], face[i1], i - i0);
    }
    function topAt(x) {
      const i = clamp((x - geo.cx0) / 2, 0, topL.length - 1);
      const i0 = Math.floor(i), i1 = Math.min(topL.length - 1, i0 + 1);
      return lerp(topL[i0], topL[i1], i - i0);
    }
    function inCliff(x, y, m) {
      if (x > geo.hw || y > geo.bot + m) return false;
      if (y < topAt(x) - m) return false;
      return x >= faceAt(clamp(y, geo.cliffTop, geo.bot)) - m;
    }

    /* ---- DOM : étiquettes, températures, bouton ---- */
    api.style(`
      .game[data-game="venus"] .vn-tag { position: absolute; z-index: 3; top: 10px; margin: 0; transform: translateX(-50%);
        padding: 4px 12px 5px; border-radius: 12px 15px 13px 10px; background: rgba(23, 15, 3, .55); color: #FCF2D6;
        font: 700 1.0625rem/1.1 var(--font-display); font-variation-settings: "SOFT" 100, "opsz" 24; pointer-events: none;
        box-shadow: 0 0 0 1px rgba(252, 242, 214, .18); }
      .game[data-game="venus"] .vn-temp { position: absolute; z-index: 3; margin: 0; padding: 3px 8px 4px;
        border-radius: 9px 11px 10px 8px; background: rgba(23, 15, 3, .62); color: #FCF2D6; white-space: nowrap;
        font: 800 .9375rem/1.1 var(--font-text); font-variant-numeric: tabular-nums; pointer-events: none; }
      .game[data-game="venus"] .vn-bar { position: absolute; z-index: 4; left: 0; right: 0; bottom: 10px; display: flex;
        justify-content: flex-start; padding: 0 10px; pointer-events: none; }
      .game[data-game="venus"] .vn-bar.is-wide { justify-content: center; }
      .game[data-game="venus"] .vn-chip { pointer-events: auto; max-width: calc(50% - 18px); text-align: center;
        font-size: .875rem; padding: 8px 12px; transition: opacity .3s ease; }
      .game[data-game="venus"] .vn-bar.is-wide .vn-chip { max-width: 100%; }
      .game[data-game="venus"] .vn-chip[hidden] { display: none; }
    `);
    function el(tag, cls, text) {
      const e = document.createElement(tag);
      e.className = cls;
      if (text) e.textContent = text;
      api.stage.appendChild(e);
      return e;
    }
    const tagE = el('p', 'vn-tag', TEXTES.terre);
    const tagV = el('p', 'vn-tag', TEXTES.venus);
    const tempE = el('p', 'vn-temp', deg(T_TERRE));
    const tempV = el('p', 'vn-temp', deg(T_VENUS));
    const bar = el('div', 'vn-bar');
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip vn-chip';
    bar.appendChild(chip);
    chip.addEventListener('click', () => {
      if (mode === 'play') liberer(null, null);
      else if (mode === 'after') startRewind();
    });

    function setChip(kind) {
      if (kind === 'none') {
        chip.hidden = true;
        return;
      }
      chip.hidden = false;
      chip.disabled = false;
      chip.textContent = kind === 'remettre' ? TEXTES.remettre : TEXTES.liberer;
      bar.classList.toggle('is-wide', kind === 'remettre');
    }

    /* ---- fonds pré-rendus (tirages reproductibles : même décor à chaque chargement) ---- */
    let seedRnd = Math.random;
    const srand = (a = 1, b) => (b === undefined ? seedRnd() * a : a + seedRnd() * (b - a));
    function strata(g, x0, x1, y0, y1, cols, lh, seed, seam) {
      const n = lib.makeNoise(seed);
      let k = 0;
      for (let y = y0 - lh; y < y1 + lh; y += lh * (0.75 + n.rnd() * 0.6)) {
        g.fillStyle = cols[k % cols.length];
        g.beginPath();
        g.moveTo(x0, y1 + 2);
        for (let x = x0; x <= x1 + 4; x += 4) g.lineTo(x, y + Math.sin(x * 0.025 + k) * lh * 0.15 + (n.noise2(x * 0.04, k * 2.3) - 0.5) * lh * 0.35);
        g.lineTo(x1 + 4, y1 + 2);
        g.closePath();
        g.fill();
        if (seam) {
          g.strokeStyle = seam;
          g.lineWidth = 0.8;
          g.beginPath();
          for (let x = x0; x <= x1 + 4; x += 4) {
            const yy = y + Math.sin(x * 0.025 + k) * lh * 0.15 + (n.noise2(x * 0.04, k * 2.3) - 0.5) * lh * 0.35;
            if (x === x0) g.moveTo(x, yy);
            else g.lineTo(x, yy);
          }
          g.stroke();
        }
        k++;
      }
    }
    function grain(g, x, y, w, h, dens, light, dark) {
      for (let i = 0; i < w * h * dens; i++) {
        g.fillStyle = seedRnd() < 0.5 ? light : dark;
        g.fillRect(x + seedRnd() * w, y + seedRnd() * h, 1.1, 1.1);
      }
    }

    function makeEarthLayers() {
      seedRnd = lib.makeNoise(101).rnd;
      const { w, h, hw, s } = geo;
      const d = cv.dpr;
      /* sol sous la mer : fond de sable, puis roche en strates */
      earthGround = mk(hw * d, h * d);
      let g = earthGround.getContext('2d');
      g.scale(d, d);
      g.save();
      g.beginPath();
      g.rect(0, geo.bot - 2, hw, h - geo.bot + 2);
      g.clip();
      strata(g, 0, hw, geo.bot + 4 * s, h, ['#6F6A63', '#5F5B55', '#7A746B', '#55524D', '#68625A'], 10 * s, 7, 'rgba(30,26,22,0.25)');
      grain(g, 0, geo.bot, hw, h - geo.bot, 0.05, 'rgba(255,250,240,0.10)', 'rgba(10,8,6,0.14)');
      g.fillStyle = '#CDB98E';
      g.beginPath();
      g.moveTo(0, geo.bot + 5 * s);
      for (let x = 0; x <= hw + 4; x += 4) g.lineTo(x, geo.bot - 1 + Math.sin(x * 0.07) * 1.2);
      g.lineTo(hw + 4, geo.bot + 5 * s);
      g.closePath();
      g.fill();
      g.restore();
      /* lueurs de chaleur dans le sol (n'apparaissent qu'à la fin) */
      earthGlow = mk(hw * d, h * d);
      g = earthGlow.getContext('2d');
      g.scale(d, d);
      g.strokeStyle = '#FF7A3D';
      g.shadowColor = '#FF5A1F';
      g.shadowBlur = 6;
      g.lineWidth = 1.2;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      for (let i = 0; i < 5; i++) {
        let x = (i + 0.3 + srand(0.4)) * (hw / 5), y = geo.bot + srand(2, 5);
        g.beginPath();
        g.moveTo(x, y);
        for (let k = 0; k < 4; k++) {
          const nx = x + srand(-4, 4) * s, ny = y + srand(7, 12) * s;
          g.quadraticCurveTo(x + srand(-3, 3) * s, (y + ny) / 2, nx, ny);
          x = nx;
          y = ny;
        }
        g.stroke();
      }
      g.lineWidth = 1;
      g.beginPath();
      for (let x = 0; x < hw; x += srand(6, 14)) {
        g.moveTo(x, geo.bot);
        g.lineTo(x + srand(-3, 3), geo.bot + srand(3, 7) * s);
      }
      g.stroke();

      /* la falaise blanche : couches de calcaire, rangées de silex */
      const x0 = geo.cx0;
      face.length = 0;
      for (let y = geo.cliffTop; y <= geo.bot + 2; y += 2) {
        const u = (y - geo.cliffTop) / 12 / s;
        const round = u < 1 ? Math.pow(1 - u, 2) * 9 * s : 0;
        face.push(x0 + (nR.noise2(y * 0.05, 1.3) - 0.5) * 9 * s + round + Math.sin(y * 0.21) * 1.2);
      }
      topL.length = 0;
      for (let x = x0; x <= hw + 4; x += 2) topL.push(geo.cliffTop + (nR.noise2(x * 0.05, 4.2) - 0.5) * 6 * s - (x - x0) * 0.04);
      cliffPath = new Path2D();
      cliffPath.moveTo(faceAt(geo.bot), geo.bot + 2);
      for (let y = geo.bot; y >= geo.cliffTop; y -= 2) cliffPath.lineTo(faceAt(y), y);
      for (let x = faceAt(geo.cliffTop); x <= hw + 4; x += 2) cliffPath.lineTo(x, topAt(x));
      cliffPath.lineTo(hw + 4, geo.bot + 2);
      cliffPath.closePath();

      cliffCool = mk(hw * d, h * d);
      g = cliffCool.getContext('2d');
      g.scale(d, d);
      g.save();
      g.clip(cliffPath);
      const lh = 11 * s;
      const n = lib.makeNoise(29);
      let k = 0;
      for (let y = geo.cliffTop - 6; y < geo.bot + lh; y += lh * (0.7 + n.rnd() * 0.6)) {
        const yy = (x) => y + Math.sin(x * 0.03 + k) * 1.4 + (n.noise2(x * 0.05, k * 1.7) - 0.5) * 2.4;
        g.fillStyle = LIME[k % LIME.length];
        g.beginPath();
        g.moveTo(0, geo.bot + 4);
        for (let x = x0 - 12; x <= hw + 4; x += 4) g.lineTo(x, yy(x));
        g.lineTo(hw + 4, geo.bot + 4);
        g.closePath();
        g.fill();
        g.strokeStyle = 'rgba(186,174,146,0.55)';
        g.lineWidth = 0.9;
        g.beginPath();
        for (let x = x0 - 12; x <= hw + 4; x += 4) {
          if (x === x0 - 12) g.moveTo(x, yy(x));
          else g.lineTo(x, yy(x));
        }
        g.stroke();
        /* rangée de silex sombres */
        if (k % 3 === 1) {
          g.fillStyle = '#5D5F66';
          for (let x = x0 + srand(2, 10); x < hw; x += srand(9, 16) * s) {
            g.beginPath();
            g.ellipse(x, yy(x) + lh * 0.45, srand(1.6, 2.8) * s, srand(1, 1.7) * s, srand(-0.3, 0.3), 0, TAU);
            g.fill();
          }
        }
        k++;
      }
      grain(g, x0 - 12, geo.cliffTop - 8, hw - x0 + 16, geo.bot - geo.cliffTop + 10, 0.06, 'rgba(255,255,255,0.35)', 'rgba(120,110,90,0.18)');
      /* la face, éclairée depuis la gauche ; l'intérieur un peu plus sombre */
      const sh = g.createLinearGradient(x0 - 10, 0, hw, 0);
      sh.addColorStop(0, 'rgba(255,255,250,0.25)');
      sh.addColorStop(0.18, 'rgba(255,255,250,0)');
      sh.addColorStop(1, 'rgba(90,80,60,0.12)');
      g.fillStyle = sh;
      g.fillRect(x0 - 12, geo.cliffTop - 10, hw - x0 + 16, geo.bot - geo.cliffTop + 14);
      g.restore();
      g.strokeStyle = 'rgba(150,138,112,0.6)';
      g.lineWidth = 1;
      g.stroke(cliffPath);
      /* version brûlante : même falaise, roussie */
      cliffHot = mk(hw * d, h * d);
      g = cliffHot.getContext('2d');
      g.drawImage(cliffCool, 0, 0);
      g.scale(d, d);
      g.globalCompositeOperation = 'source-atop';
      const hg = g.createLinearGradient(0, geo.cliffTop, 0, geo.bot);
      hg.addColorStop(0, 'rgba(150,80,30,0.5)');
      hg.addColorStop(1, 'rgba(120,45,18,0.62)');
      g.fillStyle = hg;
      g.fillRect(0, 0, hw, h);

      /* étincelles de carbone enfermées dans la roche */
      sparks.length = 0;
      let tries = 0;
      while (sparks.length < N_SPARK && tries++ < 2000) {
        const y = srand(geo.cliffTop + 10 * s, geo.bot - 6 * s);
        const x = srand(faceAt(y) + 7 * s, hw - 7 * s);
        if (!inCliff(x, y, -4)) continue;
        if (sparks.some((p) => Math.hypot(p.x - x, p.y - y) < 11 * s)) continue;
        sparks.push({ x, y, a: 1, alive: true, f: srand(1.5, 3.5), ph: srand(TAU), r: srand(2.2, 3.6) * s });
      }
    }

    /* bande de nuages qui boucle horizontalement (pour un défilement sans couture) */
    function makeCloudStrip(tw, ch, seed, top, bottom, edge0, alpha) {
      const q = Math.min(1.5, cv.dpr);
      const c = mk(tw * q, ch * q);
      const g = c.getContext('2d');
      const img = g.createImageData(c.width, c.height);
      const d = img.data;
      const n = lib.makeNoise(seed);
      const T = lib.hexToRgb(top), B = lib.hexToRgb(bottom);
      /* bruit enroulé sur un cylindre (bords qui se raccordent), étiré à l'horizontale : des bandes */
      const W = c.width, H = c.height, R = 1.5;
      for (let x = 0; x < W; x++) {
        const a = (x / W) * TAU;
        const ca = Math.cos(a) * R, sa = Math.sin(a) * R;
        const edge = edge0 + 0.36 * (n.fbm(ca * 1.2 + 3, sa * 1.2 + 7, 3) - 0.5) + 0.14 * (n.fbm(ca * 3.6 + 9, sa * 3.6 + 1, 2) - 0.5);
        for (let y = 0; y < H; y++) {
          const fy = y / H;
          const v = n.fbm(ca * 1.1 + 10, sa * 1.1 + fy * 7.5, 4);
          const dens = clamp((edge - fy) * 7 + (v - 0.5) * 1.8);
          if (dens <= 0) continue;
          const sh = clamp(0.8 + (v - 0.5) * 1.1 - fy * 0.2 - (1 - clamp((edge - fy) * 6)) * 0.14, 0.5, 1.15);
          const o = (y * W + x) * 4;
          d[o] = lerp(T[0], B[0], fy) * sh;
          d[o + 1] = lerp(T[1], B[1], fy) * sh;
          d[o + 2] = lerp(T[2], B[2], fy) * sh;
          d[o + 3] = Math.min(1, dens * 1.4) * alpha * 255;
        }
      }
      g.putImageData(img, 0, 0);
      return c;
    }

    function makeVenusLayers() {
      seedRnd = lib.makeNoise(202).rnd;
      const { w, h, hw, s } = geo;
      const d = cv.dpr;
      venusBg = mk(hw * d, h * d);
      let g = venusBg.getContext('2d');
      g.scale(d, d);
      /* air épais et orangé */
      const sky = g.createLinearGradient(0, 0, 0, geo.plainY);
      sky.addColorStop(0, SKY_V[0]);
      sky.addColorStop(0.45, SKY_V[1]);
      sky.addColorStop(1, SKY_V[2]);
      g.fillStyle = sky;
      g.fillRect(0, 0, hw, geo.plainY + 2);
      /* volcans boucliers lointains, noyés dans la brume */
      const hills = [[0.15, 0.5, 0.05], [0.62, 0.7, 0.07], [1.02, 0.45, 0.045]];
      hills.forEach(([fx, fw, fh]) => {
        g.fillStyle = 'rgba(150,78,34,0.55)';
        g.beginPath();
        g.moveTo((fx - fw / 2) * hw, geo.plainY + 1);
        g.quadraticCurveTo(fx * hw, geo.plainY - fh * h * 2, (fx + fw / 2) * hw, geo.plainY + 1);
        g.closePath();
        g.fill();
      });
      /* la plaine brûlante */
      const pg = g.createLinearGradient(0, geo.plainY, 0, geo.plainB);
      pg.addColorStop(0, '#7A3A18');
      pg.addColorStop(1, '#4A1F0D');
      g.fillStyle = pg;
      g.beginPath();
      g.moveTo(0, geo.plainY + 2);
      for (let x = 0; x <= hw + 4; x += 4) g.lineTo(x, geo.plainY + (nR.noise2(x * 0.04, 8.8) - 0.5) * 3 * s);
      g.lineTo(hw + 4, geo.plainB + 2);
      g.lineTo(0, geo.plainB + 2);
      g.closePath();
      g.fill();
      for (let i = 0; i < 26; i++) {
        const y = lerp(geo.plainY + 3, geo.plainB - 2, Math.pow(seedRnd(), 0.8));
        const x = srand(hw);
        g.fillStyle = seedRnd() < 0.5 ? 'rgba(40,14,6,0.45)' : 'rgba(170,90,45,0.35)';
        g.beginPath();
        g.ellipse(x, y, srand(4, 14) * s, srand(1, 2.2) * s, 0, 0, TAU);
        g.fill();
      }
      /* le sol en coupe : basalte sombre */
      g.save();
      g.beginPath();
      g.rect(0, geo.plainB, hw, h - geo.plainB);
      g.clip();
      strata(g, 0, hw, geo.plainB, h, ['#3E1D10', '#4D2614', '#36180C', '#552A16', '#2F150B'], 11 * s, 13, null);
      grain(g, 0, geo.plainB, hw, h - geo.plainB, 0.05, 'rgba(255,170,110,0.10)', 'rgba(0,0,0,0.18)');
      g.restore();
      /* fissures rougeoyantes (calque séparé, qui pulse) */
      venusGlow = mk(hw * d, h * d);
      g = venusGlow.getContext('2d');
      g.scale(d, d);
      g.strokeStyle = '#FF8A45';
      g.shadowColor = '#FF5A1F';
      g.shadowBlur = 7;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      for (let i = 0; i < 7; i++) {
        const dir = i % 2 ? 1 : -1;
        let x = (i + 0.25 + srand(0.5)) * (hw / 7) - dir * 22 * s, y = srand(geo.plainY + 4, geo.plainB - 3);
        g.lineWidth = srand(1, 1.8);
        g.beginPath();
        g.moveTo(x, y);
        for (let k = 0; k < 5; k++) {
          x += srand(5, 11) * s * dir;
          y += srand(-1.6, 1.6) * s;
          g.lineTo(x, clamp(y, geo.plainY + 3, geo.plainB - 2));
        }
        g.stroke();
      }
      g.lineWidth = 1.1;
      for (let i = 0; i < 5; i++) {
        let x = (i + 0.3 + srand(0.4)) * (hw / 5), y = geo.plainB + srand(2, 5);
        g.beginPath();
        g.moveTo(x, y);
        for (let k = 0; k < 4; k++) {
          const nx = x + srand(-4, 4) * s, ny = y + srand(7, 12) * s;
          g.quadraticCurveTo(x + srand(-3, 3) * s, (y + ny) / 2, nx, ny);
          x = nx;
          y = ny;
        }
        g.stroke();
      }
      const ch = geo.cloudH;
      const tw = Math.max(320, hw * 1.8);
      cloudBack = makeCloudStrip(tw, ch, 61, '#E8B65E', '#B97A2E', 0.86, 1);
      cloudFront = makeCloudStrip(tw * 1.25, ch, 83, '#FBE6A4', '#E0A24C', 0.66, 0.92);
    }

    function place() {
      const { w, hw, s } = geo;
      tagE.style.left = Math.round(hw / 2) + 'px';
      tagV.style.left = Math.round(hw + hw / 2) + 'px';
      const ty = Math.round(lerp(geo.th.y0, geo.th.y1, 0.42) - 11 * s);
      tempE.style.left = Math.round(geo.th.xe + 13 * s) + 'px';
      tempE.style.top = ty + 'px';
      tempV.style.right = Math.round(w - geo.th.xv + 13 * s) + 'px';
      tempV.style.left = 'auto';
      tempV.style.top = ty + 'px';
    }

    cv.onResize((w, h) => {
      /* taille transitoire (scène pas encore mise en page) : on attend la vraie */
      if (w < 120 || h < 160) return;
      geo.ok = true;
      geo.w = w;
      geo.h = h;
      geo.hw = w / 2;
      geo.s = clamp(Math.min(geo.hw / 179, h / 447), 0.8, 1.6);
      geo.cloudH = h * 0.32;
      geo.cliffTop = h * 0.4;
      geo.seaY = h * 0.6;
      geo.bot = h * 0.8;
      geo.plainY = h * 0.62;
      geo.plainB = h * 0.7;
      geo.cx0 = geo.hw * 0.4;
      geo.sunX = geo.hw * 0.66;
      geo.sunY = h * 0.18;
      geo.vSunX = geo.hw * 1.4;
      geo.th.y0 = h * 0.13;
      geo.th.y1 = h * 0.42;
      geo.th.xe = 17 * geo.s;
      geo.th.xv = w - 17 * geo.s;
      skyCache.clear();
      hazeCache.clear();
      shadowGrad = null;
      makeEarthLayers();
      makeVenusLayers();
      place();
      if (pendingGesture) {
        pendingGesture = false;
        showGesture();
      }
    });

    /* ---- déroulé ---- */
    function setProgress(p) {
      const q = Math.round(p * 100);
      if (q === shownProg) return;
      shownProg = q;
      api.progress(q / 100);
    }

    function init() {
      mode = 'play';
      taps = 0;
      kT = kS = 0;
      nudge = 0;
      shownT = -999;
      shownProg = -1;
      rewindLeft = 0;
      rewindAcc = 0;
      [puffs, motes, steam, rings, flashes].forEach(clearPool);
      sparks.forEach((p) => { p.alive = true; p.a = 1; p.claimed = false; });
      setChip('liberer');
      setProgress(0);
      api.status('');
      if (geo.ok) showGesture();
      else pendingGesture = true;
      updateTemp(true);
    }
    function showGesture() {
      const cx = (geo.cx0 + geo.hw) / 2 + 6 * geo.s;
      const cy = (geo.cliffTop + geo.bot) / 2;
      api.gesture('tap', { x: (cx / geo.w) * 100, y: (cy / geo.h) * 100 });
    }

    function ring(x, y) {
      const r = grab(rings);
      if (!r) return;
      r.x = x;
      r.y = y;
      r.t = 0;
    }
    function flash(x, y, r, kind) {
      const f = grab(flashes);
      if (!f) return;
      f.x = x; f.y = y; f.r = r; f.kind = kind; f.t = 0;
    }

    /* une tape sur la falaise (ou le bouton) : le carbone s'échappe */
    function liberer(x, y) {
      if (mode !== 'play') return;
      if (x == null) {
        /* depuis le bouton : un endroit vivant de la falaise */
        const alive = sparks.filter((p) => p.alive);
        const p = alive.length ? alive[Math.floor(Math.random() * alive.length)] : sparks[0];
        x = p.x;
        y = p.y;
      }
      taps++;
      kT = taps / N_TAPS;
      /* les étincelles les plus proches s'envolent */
      const alive = sparks.filter((p) => p.alive).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
      const nRel = taps >= N_TAPS ? alive.length : Math.min(alive.length, Math.ceil(N_SPARK / N_TAPS));
      for (let i = 0; i < nRel; i++) {
        const p = alive[i];
        p.alive = false;
        const m = grab(motes);
        if (m) {
          m.x = p.x;
          m.y = p.y;
          m.vx = rand(-14, 14) * geo.s;
          m.vy = -rand(55, 95) * geo.s;
          m.t = 0;
          m.dur = rand(1.1, 1.7);
          m.ph = rand(TAU);
        }
        flash(p.x, p.y, 9 * geo.s, 0);
      }
      for (let i = 0; i < 11; i++) {
        const q = grab(puffs);
        if (!q) break;
        q.x = x + rand(-10, 10) * geo.s;
        q.y = y + rand(-8, 8) * geo.s;
        q.vx = rand(-14, 14) * geo.s;
        q.vy = -rand(45, 85) * geo.s;
        q.size = rand(5, 8) * geo.s;
        q.t = 0;
        q.a = rand(0.55, 0.85);
        q.ph = rand(TAU);
        q.down = false;
      }
      ring(x, y);
      api.buzz(10);
      api.sfx.play('whoosh', { volume: 0.45, pitch: rand(0.9, 1.15), gap: 60 });
      api.sfx.play('bubble', { pitch: 0.7 + taps * 0.08, gap: 60 });
      if (taps >= N_TAPS) {
        mode = 'cook';
        chip.disabled = true;
        api.status(TEXTES.fournaise);
        api.guide(null, 'wow');
        api.sfx.play('rumble', { volume: 0.6 });
      } else {
        api.status(TEXTES.repart);
      }
      if (!api.isDone()) setProgress(0.9 * (taps / N_TAPS));
    }

    function startRewind() {
      mode = 'rewind';
      chip.disabled = true;
      rewindLeft = sparks.filter((p) => !p.alive).length;
      rewindAcc = 0;
      api.sfx.play('whoosh', { volume: 0.5, pitch: 0.7 });
      api.status(TEXTES.retour);
    }

    function endRewind() {
      mode = 'play';
      taps = 0;
      kT = 0;
      setChip('liberer');
      api.sfx.play('chime');
    }

    function updateTemp(force) {
      const T = kS > 0.995 ? T_VENUS : kS < 0.005 ? T_TERRE : Math.round(lerp(T_TERRE, T_VENUS, kS));
      if (T === shownT && !force) return;
      shownT = T;
      tempE.textContent = deg(T);
    }

    /* ---- interaction ---- */
    function onTap(x, y) {
      if (x < geo.hw && inCliff(x, y, 18 * geo.s)) {
        if (mode === 'play') {
          liberer(x, y);
          return;
        }
        ring(x, y);
        api.sfx.play('tick', { pitch: rand(0.9, 1.2) });
        return;
      }
      ring(x, y);
      api.sfx.play('tick', { pitch: rand(0.8, 1.1) });
      if (x < geo.hw && mode === 'play') nudge = 1;
      if (x > geo.hw) flash(x, y, 14 * geo.s, 1);
    }

    api.track(cv.canvas, {
      up(p, e, cancelled) {
        if (!cancelled && p.tap) onTap(p.x, p.y);
      },
    }, { touchAction: 'pan-y' });

    /* ---- animation ---- */
    function update(dt) {
      time += dt;
      nudge = Math.max(0, nudge - dt * 1.5);
      /* montée (ou descente) douce */
      const prevK = kS;
      const diff = kT - kS;
      const step = diff * (1 - Math.exp(-dt * 1.5)) + Math.sign(diff) * dt * 0.02;
      kS = Math.abs(step) >= Math.abs(diff) ? kT : kS + step;
      const speed = (kS - prevK) / Math.max(dt, 1e-3);
      updateTemp(false);
      if (mode === 'cook' && kS > 0.996) {
        mode = 'after';
        api.done(TEXTES.fin, TEXTES.finStatut);
        setChip('remettre');
      }
      if (mode === 'rewind') {
        /* la Terre redevient bleue au fur et à mesure que le carbone rentre dans la roche */
        let dead = 0;
        for (let i = 0; i < sparks.length; i++) if (!sparks[i].alive) dead++;
        kT = sparks.length ? dead / sparks.length : 0;
        rewindAcc += dt;
        const every = 2.2 / Math.max(1, N_SPARK);
        while (rewindLeft > 0 && rewindAcc > every) {
          rewindAcc -= every;
          spawnReturn();
        }
        let flying = false;
        for (let i = 0; i < puffs.length; i++) if (puffs[i].on && puffs[i].down) flying = true;
        if (rewindLeft <= 0 && kS < 0.004 && !flying) endRewind();
      }
      /* vapeur au-dessus de l'océan qui s'évapore */
      const water = waterLevel();
      if (water > 0.02 && speed > 0.005) {
        const n = Math.min(3, speed * 60 * dt * 10);
        for (let i = 0; i < n; i++) {
          if (Math.random() > n - i) break;
          const st = grab(steam);
          if (!st) break;
          st.x = rand(6, faceAt(seaSurface()) - 6);
          st.y = seaSurface();
          st.vx = rand(-6, 6) * geo.s;
          st.vy = -rand(16, 30) * geo.s;
          st.size = rand(4, 7) * geo.s;
          st.t = 0;
          st.dur = rand(1.2, 2);
        }
      }
      /* particules */
      for (let i = 0; i < puffs.length; i++) {
        const p = puffs[i];
        if (!p.on) continue;
        p.t += dt;
        if (p.down) {
          const k = clamp(p.t / p.dur);
          const e = ease.inOutCubic(k);
          p.x = lerp(p.x0, p.tx, e) + Math.sin(p.t * 3 + p.ph) * 4 * (1 - k);
          p.y = lerp(p.y0, p.ty, e);
          p.size = lerp(p.s0, 3 * geo.s, e);
          if (k >= 1) {
            p.on = false;
            if (p.target) {
              p.target.alive = true;
              p.target.a = 0;
              p.target.claimed = false;
              p.target = null;
            }
            flash(p.tx, p.ty, 8 * geo.s, 0);
            api.sfx.play('tick', { pitch: rand(1.1, 1.5), gap: 50, volume: 0.6 });
          }
        } else {
          p.vx += Math.sin(p.t * 2.2 + p.ph) * 18 * geo.s * dt;
          p.vy *= Math.exp(-dt * 0.25);
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.size = Math.min(26 * geo.s, p.size + dt * 11 * geo.s);
          if (p.y < geo.cloudH * 0.45 || p.t > 4) p.on = false;
        }
      }
      for (let i = 0; i < motes.length; i++) {
        const m = motes[i];
        if (!m.on) continue;
        m.t += dt;
        m.x += (m.vx + Math.sin(m.t * 4 + m.ph) * 12 * geo.s) * dt;
        m.y += m.vy * dt;
        if (m.t > m.dur) m.on = false;
      }
      for (let i = 0; i < steam.length; i++) {
        const p = steam[i];
        if (!p.on) continue;
        p.t += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.size += dt * 7 * geo.s;
        if (p.t > p.dur) p.on = false;
      }
      for (let i = 0; i < rings.length; i++) {
        const r = rings[i];
        if (r.on && (r.t += dt) > 0.6) r.on = false;
      }
      for (let i = 0; i < flashes.length; i++) {
        const f = flashes[i];
        if (f.on && (f.t += dt) > 0.5) f.on = false;
      }
      for (const p of sparks) if (p.alive && p.a < 1) p.a = Math.min(1, p.a + dt * 2.5);
    }

    function spawnReturn() {
      const dead = sparks.filter((p) => !p.alive && !p.claimed);
      rewindLeft--;
      if (!dead.length) return;
      const target = dead[Math.floor(Math.random() * dead.length)];
      target.claimed = true;
      const p = grab(puffs);
      if (!p) {
        target.alive = true;
        target.claimed = false;
        return;
      }
      p.down = true;
      p.target = target;
      p.x0 = rand(geo.hw * 0.1, geo.hw * 0.95);
      p.y0 = rand(geo.cloudH * 0.35, geo.cloudH * 0.8);
      p.x = p.x0;
      p.y = p.y0;
      p.tx = target.x;
      p.ty = target.y;
      p.t = 0;
      p.dur = rand(1.1, 1.5);
      p.s0 = rand(12, 18) * geo.s;
      p.size = p.s0;
      p.a = rand(0.6, 0.85);
      p.ph = rand(TAU);
    }

    function waterLevel() {
      return 1 - ease.inOutSine(clamp((kS - 0.08) / 0.78));
    }
    function seaSurface() {
      return lerp(geo.bot, geo.seaY, waterLevel());
    }

    /* ---- dessin ---- */
    function skyGrad(k) {
      const q = Math.round(k * 60);
      let g = skyCache.get(q);
      if (!g) {
        const t = q / 60;
        g = ctx.createLinearGradient(0, 0, 0, geo.bot);
        g.addColorStop(0, css(hexMix(SKY_E[0], SKY_V[0], t)));
        g.addColorStop(0.42, css(hexMix(SKY_E[1], SKY_V[1], t)));
        g.addColorStop(0.75, css(hexMix(SKY_E[2], SKY_V[2], t)));
        skyCache.set(q, g);
      }
      return g;
    }

    function drawClouds(x0, x1, alpha, phase) {
      if (alpha <= 0.01) return;
      const ch = geo.cloudH;
      /* ombre douce sous le plafond de nuages */
      if (!shadowGrad) {
        shadowGrad = ctx.createLinearGradient(0, ch * 0.5, 0, ch * 1.3);
        shadowGrad.addColorStop(0, 'rgba(70,30,6,0.32)');
        shadowGrad.addColorStop(1, 'rgba(70,30,6,0)');
      }
      ctx.globalAlpha = alpha;
      ctx.fillStyle = shadowGrad;
      ctx.fillRect(x0, ch * 0.5, x1 - x0, ch * 0.8);
      cloudLayer(cloudBack, RMO ? 2 : 7, phase, x0, x1, ch);
      cloudLayer(cloudFront, RMO ? 4 : 13, phase + 0.3, x0, x1, ch);
      ctx.globalAlpha = 1;
    }
    function cloudLayer(c, sp, o, x0, x1, ch) {
      const tw = c.width / Math.min(1.5, cv.dpr);
      const off = ((time * sp + o * tw) % tw + tw) % tw;
      for (let x = x0 - off; x < x1; x += tw) ctx.drawImage(c, x, 0, tw, ch);
    }

    function drawHaze(x0, x1, alpha) {
      if (alpha <= 0.01) return;
      const q = Math.round(alpha * 40);
      let g = hazeCache.get(q);
      if (!g) {
        g = ctx.createLinearGradient(0, geo.cloudH * 0.5, 0, geo.plainY + 6);
        g.addColorStop(0, 'rgba(222,150,70,0)');
        g.addColorStop(1, `rgba(226,150,72,${0.42 * (q / 40)})`);
        hazeCache.set(q, g);
      }
      ctx.fillStyle = g;
      ctx.fillRect(x0, geo.cloudH * 0.5, x1 - x0, geo.plainY + 6 - geo.cloudH * 0.5);
    }

    function thermo(x, T) {
      const s = geo.s;
      const y0 = geo.th.y0, y1 = geo.th.y1;
      const tw = 10 * s, br = 8.5 * s;
      ctx.beginPath();
      ctx.moveTo(x - tw / 2, y1 - br * 0.6);
      ctx.lineTo(x - tw / 2, y0);
      ctx.arc(x, y0, tw / 2, Math.PI, 0);
      ctx.lineTo(x + tw / 2, y1 - br * 0.6);
      ctx.arc(x, y1, br, -Math.PI / 2 + 0.62, Math.PI * 1.5 - 0.62);
      ctx.closePath();
      ctx.fillStyle = 'rgba(30,20,8,0.35)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(252,242,214,0.8)';
      ctx.lineWidth = 1.3;
      ctx.stroke();
      const f = clamp((T - T_MIN) / (T_MAX - T_MIN));
      const col = lib.ramp(THERMO, 0.5 + 0.5 * clamp((T - T_TERRE) / (T_VENUS - T_TERRE)));
      const lvl = lerp(y1 - br * 0.5, y0, f);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x, y1, br * 0.66, 0, TAU);
      ctx.fill();
      draw.roundRect(ctx, x - tw * 0.24, lvl, tw * 0.48, y1 - lvl, tw * 0.24);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.arc(x - br * 0.25, y1 - br * 0.25, br * 0.2, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(252,242,214,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 1; i < 6; i++) {
        const yy = lerp(y1 - br * 1.2, y0 + 4, i / 6);
        ctx.moveTo(x + tw / 2 + 2, yy);
        ctx.lineTo(x + tw / 2 + (i % 2 ? 5 : 7), yy);
      }
      ctx.stroke();
    }

    function drawEarth() {
      const { hw, h, s } = geo;
      const k = kS;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, hw, h);
      ctx.clip();
      /* ciel qui jaunit */
      ctx.fillStyle = skyGrad(k);
      ctx.fillRect(0, 0, hw, geo.bot + 2);
      /* le Soleil, voilé peu à peu */
      const sa = 1 - clamp(k * 1.3);
      if (sa > 0.01) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.55 * sa;
        const gr = 34 * s;
        ctx.drawImage(SPR.white, geo.sunX - gr, geo.sunY - gr, gr * 2, gr * 2);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = rgba('#FFF6D2', sa);
        ctx.beginPath();
        ctx.arc(geo.sunX, geo.sunY, 8.5 * s, 0, TAU);
        ctx.fill();
      }
      drawClouds(0, hw, ease.inOutSine(clamp(k * 1.15)), 0.37);
      drawHaze(0, hw, k);
      /* le sol, puis l'océan */
      ctx.drawImage(earthGround, 0, 0, hw, h);
      const wl = waterLevel();
      const sy = seaSurface();
      if (wl < 0.98) {
        /* fond de mer asséché : croûte de sel */
        ctx.fillStyle = rgba('#F3EEE0', 0.85 * (1 - wl));
        ctx.fillRect(0, geo.bot - 1.5, faceAt(geo.bot) + 2, 2.2);
      }
      if (wl > 0.002) {
        const fx = faceAt(sy) + 3;
        const wg = ctx.createLinearGradient(0, sy, 0, geo.bot);
        wg.addColorStop(0, rgba('#3F93D0', 0.94));
        wg.addColorStop(1, rgba('#1E5D95', 0.96));
        ctx.fillStyle = wg;
        ctx.fillRect(0, sy, fx, geo.bot - sy + 1);
        ctx.strokeStyle = 'rgba(235,248,255,0.85)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (let x = 0; x <= fx; x += 5) {
          const yy = sy + Math.sin(x * 0.11 + time * (RMO ? 0.5 : 2)) * 1.3;
          if (x === 0) ctx.moveTo(x, yy);
          else ctx.lineTo(x, yy);
        }
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        for (let i = 0; i < 4; i++) {
          const yy = sy + (i + 1) * 7 * s;
          if (yy > geo.bot - 3) break;
          const xx = ((time * (RMO ? 2 : 9) + i * 37) % (fx + 40)) - 20;
          ctx.fillRect(xx, yy, 18 * s, 1.2);
        }
      }
      /* la falaise de calcaire */
      ctx.drawImage(cliffCool, 0, 0, hw, h);
      if (k > 0.01) {
        ctx.globalAlpha = clamp(k * 1.1);
        ctx.drawImage(cliffHot, 0, 0, hw, h);
        ctx.globalAlpha = 1;
      }
      /* l'herbe du sommet, qui sèche */
      const gc = hexMix('#6DAE4A', '#8A5A2A', clamp(k * 1.4));
      ctx.strokeStyle = css(gc);
      ctx.lineWidth = 4.5 * s;
      ctx.lineCap = 'round';
      ctx.beginPath();
      const fx0 = faceAt(geo.cliffTop) + 4 * s;
      for (let x = fx0; x <= hw + 3; x += 3) {
        const yy = topAt(x) + 1.5 * s;
        if (x === fx0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
      ctx.lineWidth = 1.4 * s;
      ctx.beginPath();
      for (let x = fx0 + 4; x < hw - 4; x += 9 * s) {
        const yy = topAt(x);
        ctx.moveTo(x, yy);
        ctx.lineTo(x - 2 * s, yy - 4.5 * s * (1 - k * 0.6));
        ctx.moveTo(x + 2, yy);
        ctx.lineTo(x + 3 * s, yy - 3.5 * s * (1 - k * 0.6));
      }
      ctx.stroke();
      /* étincelles : le carbone enfermé */
      const glow = 1 + nudge * 0.8;
      ctx.globalCompositeOperation = 'lighter';
      for (const p of sparks) {
        if (!p.alive) continue;
        const tw = RMO ? 0.8 : 0.55 + 0.45 * Math.sin(time * p.f + p.ph);
        const a = p.a * tw * (1 - k * 0.7);
        if (a < 0.02) continue;
        const r = p.r * glow;
        ctx.globalAlpha = a * 0.75;
        ctx.drawImage(SPR.gold, p.x - r * 2.4, p.y - r * 2.4, r * 4.8, r * 4.8);
        ctx.globalAlpha = a;
        ctx.strokeStyle = '#FFF8DC';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(p.x - r, p.y);
        ctx.lineTo(p.x + r, p.y);
        ctx.moveTo(p.x, p.y - r);
        ctx.lineTo(p.x, p.y + r);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      /* chaleur qui rougeoie dans le sol */
      const hot = clamp((k - 0.55) / 0.45);
      if (hot > 0.01) {
        ctx.globalAlpha = hot * (0.75 + 0.25 * Math.sin(time * 1.6));
        ctx.drawImage(earthGlow, 0, 0, hw, h);
        ctx.globalAlpha = 1;
      }
      ctx.globalCompositeOperation = 'source-over';
      /* vapeur, bouffées de CO2, étincelles qui s'envolent */
      drawParticles();
      thermo(geo.th.xe, lerp(T_TERRE, T_VENUS, k));
      ctx.restore();
    }

    function drawVenus() {
      const { hw, w, h, s } = geo;
      ctx.save();
      ctx.beginPath();
      ctx.rect(hw, 0, hw, h);
      ctx.clip();
      ctx.drawImage(venusBg, hw, 0, hw, h);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.6 + 0.3 * Math.sin(time * (RMO ? 0.4 : 1.3));
      ctx.drawImage(venusGlow, hw, 0, hw, h);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      drawClouds(hw, w, 1, 0);
      /* le Soleil, à peine une lueur à travers les nuages */
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.28;
      const gr = 44 * s;
      ctx.drawImage(SPR.warm, geo.vSunX + hw * 0 - gr, geo.sunY - gr, gr * 2, gr * 2);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      drawHaze(hw, w, 1);
      /* air qui tremble de chaleur au-dessus de la plaine */
      ctx.strokeStyle = 'rgba(255,214,150,0.16)';
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 4; i++) {
        const y = geo.plainY - (6 + i * 7) * s;
        ctx.beginPath();
        for (let x = hw; x <= w; x += 6) {
          const yy = y + Math.sin(x * 0.09 + time * (RMO ? 0.6 : 3) + i * 1.7) * 1.6;
          if (x === hw) ctx.moveTo(x, yy);
          else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
      thermo(geo.th.xv, T_VENUS);
      ctx.restore();
    }

    function drawParticles() {
      const s = geo.s;
      for (let i = 0; i < steam.length; i++) {
        const p = steam[i];
        if (!p.on) continue;
        ctx.globalAlpha = 0.5 * Math.sin(Math.PI * (p.t / p.dur));
        ctx.drawImage(SPR.steam, p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
      }
      for (let i = 0; i < puffs.length; i++) {
        const p = puffs[i];
        if (!p.on) continue;
        let a;
        if (p.down) a = p.a * clamp(p.t * 4) * (1 - 0.4 * clamp(p.t / p.dur));
        else a = p.a * clamp(p.t * 4) * clamp((p.y - geo.cloudH * 0.45) / (geo.cloudH * 0.6));
        ctx.globalAlpha = a;
        ctx.drawImage(SPR.puff, p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < motes.length; i++) {
        const m = motes[i];
        if (!m.on) continue;
        const k = m.t / m.dur;
        const r = (6 - 3 * k) * s;
        ctx.globalAlpha = 1 - k;
        ctx.drawImage(SPR.gold, m.x - r, m.y - r, r * 2, r * 2);
      }
      for (let i = 0; i < flashes.length; i++) {
        const f = flashes[i];
        if (!f.on || f.kind !== 0) continue;
        const k = f.t / 0.5;
        const r = f.r * (0.6 + k);
        ctx.globalAlpha = 0.8 * (1 - k);
        ctx.drawImage(SPR.gold, f.x - r, f.y - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    function render() {
      const { h, hw } = geo;
      drawEarth();
      drawVenus();
      /* le trait fin qui sépare les deux planètes */
      ctx.fillStyle = 'rgba(23,15,3,0.35)';
      ctx.fillRect(hw - 2, 0, 4, h);
      ctx.fillStyle = 'rgba(252,242,214,0.75)';
      ctx.fillRect(hw - 0.75, 0, 1.5, h);
      /* éclats de chaleur sur Vénus, anneaux de toucher */
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < flashes.length; i++) {
        const f = flashes[i];
        if (!f.on || f.kind !== 1) continue;
        const k = f.t / 0.5;
        const r = f.r * (0.6 + k);
        ctx.globalAlpha = 0.6 * (1 - k);
        ctx.drawImage(SPR.warm, f.x - r, f.y - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < rings.length; i++) {
        const r = rings[i];
        if (!r.on) continue;
        const k = r.t / 0.6;
        ctx.strokeStyle = rgba('#FFF4D6', 0.8 * (1 - k));
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(r.x, r.y, lerp(6, 34 * geo.s, ease.outCubic(k)), 0, TAU);
        ctx.stroke();
      }
    }

    api.loop((dt) => {
      if (!geo.ok) return;
      update(dt);
      render();
    });

    api.onReset(init);
    init();
    if (geo.ok) {
      update(0.016);
      render();
    }
  };
})();
