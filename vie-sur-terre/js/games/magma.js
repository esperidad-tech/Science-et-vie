/* Refroidir, puis pleuvoir : on frotte l'océan de lave pour qu'il se couvre d'une croûte
   de basalte, puis on fait pleuvoir pour remplir les premiers océans. */
(function () {
  'use strict';
  const { lib } = window.RM;
  const { TAU, rand, clamp, lerp, ease, rgba, draw } = lib;

  const TEXTES = {
    croute: 'Croûte formée : {n} %',
    pluie: 'Il pleut ! Tape les nuages pour remplir l’océan.',
    eau: 'Océan rempli : {n} %',
    fin: 'Les premiers océans recouvrent la planète.',
    finStatut: 'Des millions d’années de pluie, résumées en quelques gestes.',
  };
  /* insère le nombre et une espace insécable avant « % » */
  const fill = (s, n) => s.replace('{n}', n).replace(' %', ' %');

  const sstep = (a, b, t) => {
    t = clamp((t - a) / (b - a));
    return t * t * (3 - 2 * t);
  };
  function mk(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  }

  /* Bruit de valeur périodique : les textures de lave bouclent sans couture. */
  function periodicNoise(seed) {
    const rnd = lib.makeNoise(seed).rnd;
    const tab = new Float32Array(65536);
    for (let i = 0; i < 65536; i++) tab[i] = rnd();
    function lat(ix, iy, P, o) {
      ix %= P;
      if (ix < 0) ix += P;
      iy %= P;
      if (iy < 0) iy += P;
      return tab[(((iy + o) & 255) << 8) | ((ix + o * 7) & 255)];
    }
    function n2(x, y, P, o) {
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = x - xi, yf = y - yi;
      const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      const a = lat(xi, yi, P, o), b = lat(xi + 1, yi, P, o);
      const c = lat(xi, yi + 1, P, o), d = lat(xi + 1, yi + 1, P, o);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    }
    function fbm(x, y, P, oct) {
      let s = 0, amp = 0.5, f = 1, norm = 0;
      for (let k = 0; k < oct; k++) {
        s += amp * n2(x * f, y * f, P * f, k * 41);
        norm += amp;
        amp *= 0.5;
        f *= 2;
      }
      return s / norm;
    }
    return { fbm };
  }

  window.RM.games.magma = function (api) {
    const cv = api.canvas();
    const ctx = cv.ctx;
    const RM = api.reducedMotion;

    /* ---- réglages ---- */
    const CELL = 12;          /* taille visée d'une cellule de chaleur (px) */
    const MS = 6;             /* pixels du masque par cellule (bords doux) */
    const R_RUB = 34, R_TAP = 82;
    const RUB_K = 0.011;      /* refroidissement par pixel parcouru par le doigt */
    const HOLD_K = 0.55;      /* refroidissement par seconde, doigt immobile */
    const SOLID = 0.5;        /* sous ce seuil, la lave se fige en croûte */
    const COOL = 0.16, COOL_FAST = 0.7;
    const SPREAD = 0.05;      /* la croûte gagne un peu sur ses bords */
    const AUTO_AT = 0.85;
    const HZ = 0.35;          /* horizon de la vue de côté (fraction de la hauteur) */
    const T_TILT = 1.8;
    const RAIN_STEP = 0.1;    /* hausse du niveau par averse : une dizaine de tapes */
    const DRIZZLE = 0.0025;   /* pluie légère : hausse par seconde */
    const PERSP = 2.4;        /* force de la perspective du sol */
    const LS = 0.6;           /* la lave est calculée à cette échelle (elle est floue par nature) */

    /* ---- état ---- */
    let phase = 'cool';       /* cool | auto | tilt | rain */
    let time = 0, phaseT = 0, finished = false, hinted = false;
    let cols = 0, rows = 0, heat = null, solidN = 0;
    let maskDirty = true, composeDirty = true, crackBudget = 0;
    let shownCrust = -1, shownWater = -1, shownProg = -1;
    let pressed = false, pid = -1, fx = 0, fy = 0;
    let level = 0, target = 0, rainTaps = 0;
    let stormK = 0;

    const geo = { w: 1, h: 1, Hy: 1, M: 1 };

    /* ---- textures de lave (pré-calculées, en motifs qui bouclent) ---- */
    const LT = 200;
    const LAVA = [
      [0, 104, 18, 8], [0.22, 190, 48, 12], [0.46, 244, 106, 22],
      [0.66, 255, 164, 50], [0.85, 255, 220, 118], [1, 255, 246, 202],
    ];
    const lavaBase = mk(LT, LT), lavaVeins = mk(LT, LT);
    (function makeLava() {
      const pn = periodicNoise(5);
      const gb = lavaBase.getContext('2d'), gv = lavaVeins.getContext('2d');
      const ib = gb.createImageData(LT, LT), iv = gv.createImageData(LT, LT);
      const db = ib.data, dv = iv.data;
      const P = 5, P2 = 6;
      for (let y = 0; y < LT; y++) {
        for (let x = 0; x < LT; x++) {
          const u = (x / LT) * P, v = (y / LT) * P;
          const wx = pn.fbm(u + 1.3, v + 0.7, P, 3) - 0.5;
          const wy = pn.fbm(u + 2.9, v + 3.1, P, 3) - 0.5;
          const n = pn.fbm(u + wx * 2.6, v + wy * 2.6, P, 5);
          const t = clamp((n - 0.27) / 0.48);
          let k = 1;
          while (k < LAVA.length - 1 && t > LAVA[k][0]) k++;
          const A = LAVA[k - 1], B = LAVA[k];
          const f = (t - A[0]) / (B[0] - A[0]);
          const j = (y * LT + x) * 4;
          db[j] = lerp(A[1], B[1], f);
          db[j + 1] = lerp(A[2], B[2], f);
          db[j + 2] = lerp(A[3], B[3], f);
          db[j + 3] = 255;
          /* veines sombres : la peau de lave qui refroidit en surface */
          const u2 = (x / LT) * P2, v2 = (y / LT) * P2;
          const m = pn.fbm(u2 + wx * 1.5 + 0.4, v2 + wy * 1.5 + 0.9, P2, 4);
          const r = 1 - Math.abs(2 * m - 1);
          const a = Math.max(sstep(0.8, 0.97, r) * 0.82, sstep(0.55, 0.9, r) * 0.26);
          dv[j] = 70;
          dv[j + 1] = 13;
          dv[j + 2] = 6;
          dv[j + 3] = a * 255;
        }
      }
      gb.putImageData(ib, 0, 0);
      gv.putImageData(iv, 0, 0);
    })();

    /* La vue de dessus se compose à la résolution CSS, puis s'affiche en une seule fois. */
    let low = null, lowCtx = null, lavaC = null, lavaCtx = null;
    let patA = null, patB = null, canPat = false;
    const mA = typeof DOMMatrix === 'function' ? new DOMMatrix() : null;
    const mB = typeof DOMMatrix === 'function' ? new DOMMatrix() : null;
    function makeLayers(w, h) {
      low = mk(w, h);
      lowCtx = low.getContext('2d');
      lavaC = mk(w * LS, h * LS);
      lavaCtx = lavaC.getContext('2d');
      patA = lavaCtx.createPattern(lavaBase, 'repeat');
      patB = lavaCtx.createPattern(lavaVeins, 'repeat');
      canPat = !!(patA && mA && typeof patA.setTransform === 'function');
    }

    /* ---- croûte de basalte : plaques, fissures, petites bulles ---- */
    let crustTex = null, cracksTex = null, crustComp = null, glowComp = null;
    let CW = 0, CH = 0;
    function makeCrust(W, H) {
      const n = lib.makeNoise(23);
      const rnd = n.rnd;
      const CS = 40;
      const gx = Math.ceil(W / CS) + 3, gy = Math.ceil(H / CS) + 3;
      const px = new Float32Array(gx * gy), py = new Float32Array(gx * gy), pv = new Float32Array(gx * gy);
      for (let j = 0; j < gy; j++) {
        for (let i = 0; i < gx; i++) {
          const k = j * gx + i;
          px[k] = (i - 1 + 0.12 + 0.76 * rnd()) * CS;
          py[k] = (j - 1 + 0.12 + 0.76 * rnd()) * CS;
          pv[k] = rnd();
        }
      }
      const a = mk(W, H), b = mk(W, H);
      const ga = a.getContext('2d'), gb = b.getContext('2d');
      const ia = ga.createImageData(W, H), ib = gb.createImageData(W, H);
      const da = ia.data, db = ib.data;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const wx = x + (n.noise2(x * 0.035, y * 0.035) - 0.5) * 18;
          const wy = y + (n.noise2(x * 0.035 + 17.3, y * 0.035 + 41.9) - 0.5) * 18;
          const ci = Math.floor(wx / CS) + 1, cj = Math.floor(wy / CS) + 1;
          let best = 1e12, bk = 0;
          for (let dj = -1; dj <= 1; dj++) {
            const jj = cj + dj;
            if (jj < 0 || jj >= gy) continue;
            for (let di = -1; di <= 1; di++) {
              const ii = ci + di;
              if (ii < 0 || ii >= gx) continue;
              const k = jj * gx + ii;
              const dx = px[k] - wx, dy = py[k] - wy;
              const d2 = dx * dx + dy * dy;
              if (d2 < best) {
                best = d2;
                bk = k;
              }
            }
          }
          const ax = px[bk], ay = py[bk];
          let edge = 1e9;
          for (let dj = -1; dj <= 1; dj++) {
            const jj = cj + dj;
            if (jj < 0 || jj >= gy) continue;
            for (let di = -1; di <= 1; di++) {
              const ii = ci + di;
              if (ii < 0 || ii >= gx) continue;
              const k = jj * gx + ii;
              if (k === bk) continue;
              const ex = px[k] - ax, ey = py[k] - ay;
              const L = Math.sqrt(ex * ex + ey * ey) || 1;
              const d = (((ax + px[k]) * 0.5 - wx) * ex + ((ay + py[k]) * 0.5 - wy) * ey) / L;
              if (d < edge) edge = d;
            }
          }
          const big = n.noise2(x * 0.011 + 5, y * 0.011 + 9);
          const fine = n.noise2(x * 0.09 + 3, y * 0.09 + 7);
          let v = 26 + big * 22 + fine * 16 + (pv[bk] - 0.5) * 18 + (rnd() - 0.5) * 10;
          v *= lerp(0.26, 1, sstep(0.4, 2.2, edge));
          /* léger relief sur le bord des plaques */
          v += sstep(2.2, 3.1, edge) * (1 - sstep(3.1, 5.5, edge)) * 10;
          /* quelques reflets rouille sur la roche */
          const rust = sstep(0.62, 0.8, big) * 10;
          const j4 = (y * W + x) * 4;
          da[j4] = v * 1.08 + rust;
          da[j4 + 1] = v * 0.98 + rust * 0.3;
          da[j4 + 2] = v * 0.93;
          da[j4 + 3] = 255;
          const c = 1 - sstep(0.2, 3.6, edge);
          db[j4] = 255;
          db[j4 + 1] = 64 + 150 * c * c;
          db[j4 + 2] = 20 + 60 * c * c;
          db[j4 + 3] = 255 * c;
        }
      }
      ga.putImageData(ia, 0, 0);
      gb.putImageData(ib, 0, 0);
      /* petites bulles de gaz figées dans la roche */
      for (let i = 0; i < (W * H) / 240; i++) {
        const x = rnd() * W, y = rnd() * H, r = 0.5 + rnd() * rnd() * 1.6;
        ga.fillStyle = 'rgba(8,6,5,0.55)';
        ga.beginPath();
        ga.arc(x, y, r, 0, TAU);
        ga.fill();
        ga.fillStyle = 'rgba(120,108,98,0.22)';
        ga.beginPath();
        ga.arc(x + r * 0.35, y + r * 0.45, r * 0.6, 0, Math.PI);
        ga.fill();
      }
      crustTex = a;
      cracksTex = b;
      CW = W;
      CH = H;
      crustComp = mk(W, H);
      glowComp = mk(W, H);
    }

    /* ---- grille de chaleur et masques (petite image agrandie avec lissage) ----
       Chaque pixel du masque lit la grille à une position un peu tordue par du bruit :
       les bords entre lave et croûte deviennent organiques au lieu de suivre la grille. */
    let MW = 1, MH = 1, maskC = null, warmC = null, rimC = null, mImg = null, wImg = null, rImg = null;
    let nz = null, sIdx = null, sFx = null, sFy = null;
    function makeGrid() {
      cols = Math.max(10, Math.round(geo.w / CELL));
      rows = Math.max(10, Math.round(geo.h / CELL));
      heat = new Float32Array(cols * rows).fill(1);
      MW = cols * MS;
      MH = rows * MS;
      maskC = mk(MW, MH);
      warmC = mk(MW, MH);
      rimC = mk(MW, MH);
      mImg = maskC.getContext('2d').createImageData(MW, MH);
      wImg = warmC.getContext('2d').createImageData(MW, MH);
      rImg = rimC.getContext('2d').createImageData(MW, MH);
      const n = lib.makeNoise(41), nw = lib.makeNoise(43);
      const N = MW * MH;
      nz = new Float32Array(N);
      sIdx = new Int32Array(N);
      sFx = new Float32Array(N);
      sFy = new Float32Array(N);
      const wf = 1 / (MS * 2.4);
      for (let y = 0; y < MH; y++) {
        for (let x = 0; x < MW; x++) {
          const i = y * MW + x;
          nz[i] = n.fbm(x / 4.5, y / 4.5, 3) - 0.5;
          const wx = (nw.fbm(x * wf, y * wf, 3) - 0.5) * 3;
          const wy = (nw.fbm(x * wf + 31.7, y * wf + 17.3, 3) - 0.5) * 3;
          const cxp = clamp((x + 0.5) / MS - 0.5 + wx, 0, cols - 1.001);
          const cyp = clamp((y + 0.5) / MS - 0.5 + wy, 0, rows - 1.001);
          const ix = Math.floor(cxp), iy = Math.floor(cyp);
          sIdx[i] = iy * cols + ix;
          sFx[i] = cxp - ix;
          sFy[i] = cyp - iy;
        }
      }
      maskDirty = true;
    }
    function updateMasks() {
      const md = mImg.data, wd = wImg.data, rd = rImg.data;
      const N = MW * MH;
      for (let i = 0; i < N; i++) {
        const k = sIdx[i], f = sFx[i];
        const a0 = heat[k], a1 = heat[k + 1], b0 = heat[k + cols], b1 = heat[k + cols + 1];
        const t = a0 + (a1 - a0) * f;
        const hb = t + (b0 + (b1 - b0) * f - t) * sFy[i];
        const q = (SOLID - hb) * 4 + nz[i] * 1.5;
        const s = clamp(q + 0.5);
        const a = s * s * (3 - 2 * s);
        const warm = a * clamp(hb / SOLID);
        const j = i * 4;
        md[j] = md[j + 1] = md[j + 2] = 255;
        md[j + 3] = a * 255;
        wd[j] = wd[j + 1] = wd[j + 2] = 255;
        wd[j + 3] = warm * warm * 255;
        rd[j] = 255;
        rd[j + 1] = 200;
        rd[j + 2] = 100;
        rd[j + 3] = 4 * a * (1 - a) * 235;
      }
      maskC.getContext('2d').putImageData(mImg, 0, 0);
      warmC.getContext('2d').putImageData(wImg, 0, 0);
      rimC.getContext('2d').putImageData(rImg, 0, 0);
      maskDirty = false;
      composeDirty = true;
    }
    /* croûte + fissures encore tièdes, réunies en un seul calque (seulement quand elles changent) */
    function composeCrust() {
      if (!composeDirty) return;
      composeDirty = false;
      let g = glowComp.getContext('2d');
      g.globalCompositeOperation = 'source-over';
      g.clearRect(0, 0, CW, CH);
      g.drawImage(warmC, 0, 0, CW, CH);
      g.globalCompositeOperation = 'source-in';
      g.drawImage(cracksTex, 0, 0);
      g.globalCompositeOperation = 'source-over';
      g = crustComp.getContext('2d');
      g.globalCompositeOperation = 'source-over';
      g.clearRect(0, 0, CW, CH);
      g.drawImage(maskC, 0, 0, CW, CH);
      g.globalCompositeOperation = 'source-in';
      g.drawImage(crustTex, 0, 0);
      g.globalCompositeOperation = 'lighter';
      g.drawImage(glowComp, 0, 0);
      g.globalCompositeOperation = 'source-over';
    }

    /* ---- particules (réserves fixes : pas d'allocation dans la boucle) ---- */
    const puffs = [];
    for (let i = 0; i < 150; i++) puffs.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, r0: 1, r1: 1, t: 0, life: 1, a: 1, smoke: false });
    const drops = [];
    for (let i = 0; i < 330; i++) drops.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, end: 0, len: 1, cls: 0 });
    const rings = [];
    for (let i = 0; i < 100; i++) rings.push({ on: false, x: 0, y: 0, t: 0, dur: 1, r: 1, sq: 1, a: 1, kind: 0 });
    let puffI = 0, dropI = 0, ringI = 0;
    function takeFrom(arr, start) {
      for (let k = 1; k <= arr.length; k++) {
        const i = (start + k) % arr.length;
        if (!arr[i].on) return i;
      }
      return -1;
    }
    function steam(x, y, big) {
      const i = takeFrom(puffs, puffI);
      if (i < 0) return;
      puffI = i;
      const p = puffs[i];
      p.on = true;
      p.smoke = false;
      p.x = x + rand(-5, 5);
      p.y = y + rand(-5, 5);
      p.vx = rand(-9, 9);
      p.vy = -rand(22, 46);
      p.r0 = big ? rand(10, 16) : rand(6, 10);
      p.r1 = p.r0 * rand(2.2, 3.2);
      p.t = 0;
      p.life = rand(1.2, 2.1);
      p.a = big ? rand(0.34, 0.46) : rand(0.22, 0.36);
    }
    function smoke(x, y, s) {
      const i = takeFrom(puffs, puffI);
      if (i < 0) return;
      puffI = i;
      const p = puffs[i];
      p.on = true;
      p.smoke = true;
      p.x = x + rand(-3, 3) * s;
      p.y = y;
      p.vx = rand(4, 14) * s;
      p.vy = -rand(14, 26) * s;
      p.r0 = rand(4, 7) * s;
      p.r1 = p.r0 * rand(3.5, 5);
      p.t = 0;
      p.life = rand(2.4, 3.6);
      p.a = rand(0.32, 0.5);
    }
    function ring(x, y, r, dur, kind, sq, a) {
      const i = takeFrom(rings, ringI);
      if (i < 0) return;
      ringI = i;
      const g = rings[i];
      g.on = true;
      g.x = x;
      g.y = y;
      g.t = 0;
      g.dur = dur;
      g.r = r;
      g.kind = kind;
      g.sq = sq;
      g.a = a;
    }

    /* ---- sprites ---- */
    function softSprite(r, g, b, mid) {
      const c = mk(64, 64);
      const x = c.getContext('2d');
      const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, `rgba(${r},${g},${b},1)`);
      gr.addColorStop(0.45, `rgba(${r},${g},${b},${mid})`);
      gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
      x.fillStyle = gr;
      x.fillRect(0, 0, 64, 64);
      return c;
    }
    const steamSpr = softSprite(255, 246, 236, 0.45);
    const smokeSpr = softSprite(40, 36, 36, 0.55);

    /* ---- décor de la phase pluie : ciel, nuages, cônes volcaniques ---- */
    let skyWarm = null, skyStorm = null, hazeWarm = null, hazeStorm = null, vignette = null;
    let ground = null;
    const clouds = [];
    const cones = [];
    const waves = [];
    let shoreN = null;
    const SKY_S = 0.5;
    function makeSky(storm) {
      const { w, Hy } = geo;
      const H = Hy * 1.2;
      const c = mk(w * SKY_S, H * SKY_S);
      const g = c.getContext('2d');
      g.scale(SKY_S, SKY_S);
      const gr = g.createLinearGradient(0, 0, 0, Hy);
      if (storm) {
        gr.addColorStop(0, '#0E1116');
        gr.addColorStop(0.55, '#20252D');
        gr.addColorStop(1, '#58606A');
      } else {
        gr.addColorStop(0, '#170807');
        gr.addColorStop(0.55, '#3A140D');
        gr.addColorStop(1, '#8E3517');
      }
      g.fillStyle = gr;
      g.fillRect(0, 0, w, H);
      const n = lib.makeNoise(storm ? 61 : 67);
      for (let i = 0; i < 16; i++) {
        const x = n.rnd() * w, y = n.rnd() * Hy * 0.8, r = (0.12 + n.rnd() * 0.2) * w;
        g.save();
        g.translate(x, y);
        g.scale(1, 0.4);
        draw.glow(g, 0, 0, r, storm ? '#3A4049' : '#1C0806', storm ? 0.32 : 0.45);
        g.restore();
      }
      g.save();
      g.translate(w / 2, Hy);
      g.scale(1, 0.18);
      draw.glow(g, 0, 0, w * 0.75, storm ? '#93A0AB' : '#FF7A30', storm ? 0.22 : 0.3);
      g.restore();
      return c;
    }
    function makeHaze(storm) {
      const { Hy, h } = geo;
      const g = ctx.createLinearGradient(0, Hy - 2, 0, Hy + (h - Hy) * 0.42);
      if (storm) {
        g.addColorStop(0, 'rgba(88,96,106,0.92)');
        g.addColorStop(0.35, 'rgba(60,66,76,0.45)');
        g.addColorStop(1, 'rgba(40,44,52,0)');
      } else {
        g.addColorStop(0, 'rgba(142,53,23,0.9)');
        g.addColorStop(0.35, 'rgba(90,30,14,0.42)');
        g.addColorStop(1, 'rgba(50,16,8,0)');
      }
      return g;
    }
    /* un gros nuage doux : des boules arrondies sur une base presque plate */
    function cloudSprite(cw, chh, seed, dark) {
      const c = mk(cw, chh);
      const g = c.getContext('2d');
      const n = lib.makeNoise(seed);
      const baseY = chh * 0.8;
      const col = dark ? '74,78,86' : '150,156,166';
      const N = 9;
      for (let i = 0; i < N; i++) {
        const t = i / (N - 1);
        const arch = Math.sin(t * Math.PI);
        const r = chh * (0.15 + 0.24 * arch * (0.75 + n.rnd() * 0.5));
        const x = lerp(cw * 0.15, cw * 0.85, t) + (n.rnd() - 0.5) * cw * 0.05;
        const y = baseY - r * (0.5 + 0.3 * n.rnd());
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, `rgba(${col},1)`);
        gr.addColorStop(0.7, `rgba(${col},0.94)`);
        gr.addColorStop(1, `rgba(${col},0)`);
        g.fillStyle = gr;
        g.beginPath();
        g.arc(x, y, r, 0, TAU);
        g.fill();
      }
      g.save();
      g.translate(cw / 2, baseY - chh * 0.06);
      g.scale(1, 0.22);
      const bg = g.createRadialGradient(0, 0, 0, 0, 0, cw * 0.4);
      bg.addColorStop(0, `rgba(${col},0.95)`);
      bg.addColorStop(0.75, `rgba(${col},0.8)`);
      bg.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = bg;
      g.beginPath();
      g.arc(0, 0, cw * 0.4, 0, TAU);
      g.fill();
      g.restore();
      /* dessus éclairé, dessous plus sombre */
      g.globalCompositeOperation = 'source-atop';
      const v = g.createLinearGradient(0, 0, 0, chh);
      v.addColorStop(0, dark ? 'rgba(140,146,156,0.28)' : 'rgba(214,220,228,0.42)');
      v.addColorStop(0.45, 'rgba(0,0,0,0)');
      v.addColorStop(1, dark ? 'rgba(16,18,24,0.72)' : 'rgba(40,44,52,0.6)');
      g.fillStyle = v;
      g.fillRect(0, 0, cw, chh);
      return c;
    }
    function makeClouds() {
      const { w, h, Hy } = geo;
      const keep = clouds.map((c) => c.rain);
      clouds.length = 0;
      const spec = [[0.15, 0.03, 0.92], [0.5, 0.0, 1.05], [0.85, 0.045, 0.9]];
      spec.forEach(([x, y, s], i) => {
        const cw = Math.max(150, w * 0.52) * s;
        const chh = Math.min(cw * 0.5, Hy * 0.8);
        clouds.push({
          x: x * w, y: y * h, cw, chh,
          spr: cloudSprite(cw, chh, 70 + i * 3, false),
          dark: cloudSprite(cw, chh, 70 + i * 3, true),
          rain: keep[i] || 0, bump: 0, ph: rand(TAU),
        });
      });
    }

    /* cônes volcaniques : silhouette concave, ravines, coulées encore chaudes */
    const D0 = 0.07, POW = 1.55;
    function coneProfile(cn, x) {
      const cx = cn.W / 2;
      const half = x < cx ? cx : cx * cn.skew;
      const d = Math.abs(x - cx) / half;
      if (d >= 1) return 0;
      let v;
      if (d < D0) v = cn.H * (1 - 0.05 * (1 - (d / D0) * (d / D0)));
      else v = cn.H * Math.pow(1 - (d - D0) / (1 - D0), POW);
      return Math.max(0, v + (cn.n.noise2(x * 0.05, cn.seed) - 0.5) * cn.H * 0.06 * (1 - d));
    }
    function coneHalfAt(cn, up) {
      const r = clamp(up / cn.Hc);
      const d = D0 + (1 - D0) * (1 - Math.pow(r, 1 / POW));
      return (d * cn.W) / 2;
    }
    function makeCone(spec, i) {
      const { w, h, Hy } = geo;
      const Hc = spec.hgt * h;
      const W = spec.half * 2 * Math.min(w, h * 0.95);
      const n = lib.makeNoise(90 + i);
      const cn = { W, H: Hc, seed: 3 + i * 7, n, skew: 0.88 + n.rnd() * 0.12 };
      const pad = Math.max(12, Hc * 0.1);
      const s = cv.dpr;
      const c = mk(W * s, (Hc + pad) * s);
      const g = c.getContext('2d');
      g.scale(s, s);
      const base = Hc + pad, cx = W / 2;
      g.beginPath();
      g.moveTo(0, base);
      for (let x = 0; x <= W; x += 1.5) g.lineTo(x, base - coneProfile(cn, x));
      g.lineTo(W, base);
      g.closePath();
      const gr = g.createLinearGradient(0, 0, W, 0);
      gr.addColorStop(0, '#564C45');
      gr.addColorStop(0.4, '#3A332E');
      gr.addColorStop(0.62, '#28221F');
      gr.addColorStop(1, '#161311');
      g.fillStyle = gr;
      g.fill();
      g.save();
      g.clip();
      /* le haut capte la lueur du ciel */
      const tg = g.createLinearGradient(0, pad, 0, base);
      tg.addColorStop(0, 'rgba(255,170,120,0.1)');
      tg.addColorStop(0.5, 'rgba(0,0,0,0)');
      tg.addColorStop(1, 'rgba(0,0,0,0.25)');
      g.fillStyle = tg;
      g.fillRect(0, 0, W, base);
      /* grain de la roche */
      for (let k = 0; k < (W * Hc) / 22; k++) {
        const x = n.rnd() * W, y = pad + n.rnd() * Hc;
        g.fillStyle = n.rnd() < 0.5 ? 'rgba(255,240,225,0.05)' : 'rgba(0,0,0,0.2)';
        g.fillRect(x, y, 1 + n.rnd() * 2, 1 + n.rnd());
      }
      /* ravines qui descendent du sommet */
      const gul = 9 + Math.round(W / 40);
      for (let k = 0; k < gul; k++) {
        const t = (k + 0.5) / gul;
        const ex = lerp(cx - W * 0.47, cx + W * 0.47 * cn.skew, t) + (n.rnd() - 0.5) * W * 0.04;
        const sx = cx + (ex - cx) * 0.1;
        const sy = pad + Hc * (0.05 + n.rnd() * 0.1);
        const ey = base - Hc * (0.02 + n.rnd() * 0.2);
        const mx = lerp(sx, ex, 0.55) + (n.rnd() - 0.5) * W * 0.05;
        const my = lerp(sy, ey, 0.42);
        g.strokeStyle = `rgba(0,0,0,${0.22 + n.rnd() * 0.14})`;
        g.lineWidth = 0.8 + n.rnd() * 1.3;
        g.beginPath();
        g.moveTo(sx, sy);
        g.quadraticCurveTo(mx, my, ex, ey);
        g.stroke();
        g.strokeStyle = 'rgba(255,232,214,0.06)';
        g.lineWidth = 0.9;
        g.beginPath();
        g.moveTo(sx - 1, sy);
        g.quadraticCurveTo(mx - 1.4, my, ex - 1.8, ey);
        g.stroke();
      }
      /* coulées encore chaudes et lueur du cratère */
      g.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 2; k++) {
        const side = k ? 1 : -1;
        const sx = cx + side * W * 0.025, sy = pad + Hc * 0.05;
        const L = 0.28 + n.rnd() * 0.22;
        const ex = cx + side * W * (0.1 + n.rnd() * 0.08), ey = pad + Hc * L;
        const lg = g.createLinearGradient(sx, sy, ex, ey);
        lg.addColorStop(0, 'rgba(255,150,64,0.75)');
        lg.addColorStop(1, 'rgba(255,80,24,0)');
        g.strokeStyle = lg;
        g.lineWidth = 1.4 + n.rnd() * 0.8;
        g.beginPath();
        g.moveTo(sx, sy);
        g.bezierCurveTo(sx + side * W * 0.02, sy + Hc * L * 0.35, ex - side * W * 0.03, ey - Hc * L * 0.3, ex, ey);
        g.stroke();
      }
      draw.glow(g, cx, pad + Hc * 0.03, Math.max(9, W * 0.11), '#FF7A2A', 0.55);
      /* la base se fond dans le sol */
      g.globalCompositeOperation = 'destination-out';
      const fh = Math.min(14, Hc * 0.14);
      const fg = g.createLinearGradient(0, base - fh, 0, base);
      fg.addColorStop(0, 'rgba(0,0,0,0)');
      fg.addColorStop(1, 'rgba(0,0,0,0.7)');
      g.fillStyle = fg;
      g.fillRect(0, base - fh, W, fh);
      g.restore();
      return { c, W, Hc, pad, spec, cn, x: spec.x * w, base: Hy + spec.base * (h - Hy), smokeT: rand(1) };
    }
    const CONES = [
      { x: 0.57, base: 0.16, hgt: 0.16, half: 0.1 },
      { x: 0.81, base: 0.38, hgt: 0.3, half: 0.18 },
      { x: 0.19, base: 0.62, hgt: 0.5, half: 0.27 },
    ];
    function makeScenery() {
      cones.length = 0;
      CONES.forEach((sp, i) => cones.push(makeCone(sp, i)));
      skyWarm = makeSky(false);
      skyStorm = makeSky(true);
      hazeWarm = makeHaze(false);
      hazeStorm = makeHaze(true);
      makeClouds();
      waves.length = 0;
      for (let i = 0; i < 70; i++) waves.push({ x: rand(geo.w), v: Math.pow(rand(), 0.8), ph: rand(TAU), sp: rand(4, 12) });
      const n = lib.makeNoise(83);
      const N = Math.ceil(geo.w / 6) + 2;
      shoreN = new Float32Array(N);
      for (let i = 0; i < N; i++) shoreN[i] = n.fbm(i * 0.11, 3.7, 3) - 0.5;
      /* assombrit doucement les bords de la lave (dessiné à l'échelle du calque de lave) */
      const vg = lavaCtx.createRadialGradient(geo.w / 2 * LS, geo.h * 0.48 * LS, geo.M * 0.25 * LS,
        geo.w / 2 * LS, geo.h * 0.5 * LS, Math.hypot(geo.w, geo.h) * 0.62 * LS);
      vg.addColorStop(0, 'rgba(40,6,4,0)');
      vg.addColorStop(1, 'rgba(40,6,4,0.55)');
      vignette = vg;
    }

    /* perspective du sol : v (0 = loin, 1 = près) → hauteur relative à l'écran (0 = horizon) */
    function persp(v) {
      const z = 1 + (1 - v) * (PERSP - 1);
      return (1 / z - 1 / PERSP) / (1 - 1 / PERSP);
    }
    function groundY(v, e) {
      return lerp(v * geo.h, geo.Hy + (geo.h - geo.Hy) * persp(v), e);
    }
    const STRIPS = 60;
    function drawGroundStrips(g, src, e) {
      for (let k = 0; k < STRIPS; k++) {
        const v0 = k / STRIPS, v1 = (k + 1) / STRIPS;
        const y0 = groundY(v0, e), y1 = groundY(v1, e);
        g.drawImage(src, 0, v0 * CH, CW, CH / STRIPS, 0, y0, geo.w, y1 - y0 + 0.7);
      }
    }
    function makeGround() {
      const s = Math.min(cv.dpr, 1.5);
      ground = mk(geo.w * s, geo.h * s);
      const g = ground.getContext('2d');
      g.scale(s, s);
      drawGroundStrips(g, crustTex, 1);
      const gr = g.createLinearGradient(0, geo.Hy, 0, geo.h);
      gr.addColorStop(0, 'rgba(0,0,0,0.35)');
      gr.addColorStop(0.5, 'rgba(0,0,0,0)');
      gr.addColorStop(1, 'rgba(120,110,104,0.08)');
      g.fillStyle = gr;
      g.fillRect(0, geo.Hy, geo.w, geo.h - geo.Hy);
    }

    function layout(w, h) {
      geo.w = w;
      geo.h = h;
      geo.Hy = h * HZ;
      geo.M = Math.min(w, h);
      const need = !crustTex || Math.abs(CW - w) > w * 0.2 || Math.abs(CH - h) > h * 0.2;
      if (need) makeCrust(Math.round(w), Math.round(h));
      makeLayers(w, h);
      makeScenery();
      if (phase === 'rain') makeGround();
      maskDirty = true;
      composeDirty = true;
    }

    /* ---- refroidir ---- */
    function cellsOf(x, y, R, fn) {
      const cw = geo.w / cols, chh = geo.h / rows;
      const i0 = Math.max(0, Math.floor((x - R) / cw)), i1 = Math.min(cols - 1, Math.floor((x + R) / cw));
      const j0 = Math.max(0, Math.floor((y - R) / chh)), j1 = Math.min(rows - 1, Math.floor((y + R) / chh));
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const dx = (i + 0.5) * cw - x, dy = (j + 0.5) * chh - y;
          const q = Math.sqrt(dx * dx + dy * dy) / R;
          if (q < 1) fn(j * cols + i, q);
        }
      }
    }
    function cool(idx, amt) {
      const h0 = heat[idx];
      if (h0 <= 0) return;
      const h1 = Math.max(0, h0 - amt);
      heat[idx] = h1;
      maskDirty = true;
      if (h0 >= SOLID && h1 < SOLID) solidified(idx);
    }
    function solidified(idx) {
      solidN++;
      crackBudget++;
      if (Math.random() < 0.4) {
        const cw = geo.w / cols, chh = geo.h / rows;
        steam(((idx % cols) + 0.5) * cw, (Math.floor(idx / cols) + 0.5) * chh, false);
      }
    }
    let stampAmt = 0;
    const stampFn = (idx, q) => {
      const f = 1 - q * q;
      cool(idx, stampAmt * f * f);
    };
    /* une tape fige un disque de croûte encore tiède (ses fissures rougeoient un moment) */
    const tapFn = (idx, q) => {
      const goal = q < 0.7 ? 0.42 : lerp(0.42, 1, (q - 0.7) / 0.3);
      if (heat[idx] > goal) cool(idx, heat[idx] - goal);
    };
    function stamp(x, y, amt) {
      stampAmt = amt;
      cellsOf(x, y, R_RUB, stampFn);
    }
    function rubSegment(x0, y0, x1, y1) {
      const L = Math.hypot(x1 - x0, y1 - y0);
      if (L < 0.5) return;
      const n = Math.max(1, Math.ceil(L / (R_RUB / 3)));
      for (let k = 1; k <= n; k++) stamp(lerp(x0, x1, k / n), lerp(y0, y1, k / n), RUB_K * (L / n));
      api.sfx.play('scrape', { pitch: 0.8 + Math.min(0.7, L / 60), volume: 0.6, gap: 70 });
    }
    function tapCool(x, y) {
      cellsOf(x, y, R_TAP, tapFn);
      ring(x, y, R_TAP, 0.6, 0, 1, 0.75);
      for (let k = 0; k < 5; k++) steam(x + rand(-20, 20), y + rand(-20, 20), true);
      api.sfx.play('crack', { pitch: rand(0.8, 1.1), gap: 60 });
      api.buzz(10);
    }

    /* ---- pluie ---- */
    function shoreBase() {
      return lerp(geo.h + 6, geo.Hy, level);
    }
    function shoreY(x, base) {
      const amp = 12 * clamp((base - geo.Hy) / (geo.h - geo.Hy));
      const i = clamp(Math.floor(x / 6), 0, shoreN.length - 1);
      const sway = RM ? 0 : Math.sin(time * 1.2 + x * 0.04) * 0.25;
      return base + amp * (shoreN[i] * 1.6 + sway * 0.4);
    }
    function nearestCloud(x, y) {
      let best = 0, bd = 1e9;
      for (let i = 0; i < clouds.length; i++) {
        const c = clouds[i];
        const d = Math.abs(c.x - x) + Math.abs(c.y + c.chh * 0.5 - y) * 0.35;
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
      return clouds[best];
    }
    function spawnDrop(c, strong) {
      const i = takeFrom(drops, dropI);
      if (i < 0) return;
      dropI = i;
      const d = drops[i];
      const depth = rand();
      d.on = true;
      d.cls = depth < 0.35 ? 0 : depth < 0.75 ? 1 : 2;
      d.x = c.x + rand(-0.34, 0.34) * c.cw;
      d.y = c.y + c.chh * rand(0.6, 0.76);
      d.end = lerp(geo.Hy + 4, geo.h - 2, Math.pow(depth, 0.85));
      d.vy = lerp(420, 760, depth) * (strong ? 1 : 0.92);
      d.vx = -d.vy * 0.12;
      d.len = lerp(7, 18, depth);
    }
    function rainTap(x, y) {
      rainTaps++;
      const c = nearestCloud(x, y);
      c.rain = Math.min(1.4, c.rain + 1);
      c.bump = 1;
      ring(x, y, 34, 0.5, 2, 1, 0.6);
      if (!finished) target = Math.min(1, target + RAIN_STEP);
      api.sfx.play('splash', { pitch: rand(0.85, 1.15), gap: 40 });
      api.sfx.play('wind', { volume: 0.45, gap: 300 });
      api.buzz(8);
    }

    /* ---- interaction ---- */
    api.track(cv.canvas, {
      down(p) {
        if (phase === 'cool' || phase === 'auto') {
          pressed = true;
          pid = p.id;
          fx = p.x;
          fy = p.y;
          stamp(p.x, p.y, 0.05);
          ring(p.x, p.y, R_RUB, 0.45, 0, 1, 0.6);
          api.sfx.play('scrape', { pitch: 0.9, volume: 0.5, gap: 70 });
          api.buzz(8);
        }
      },
      move(p) {
        if (!pressed || p.id !== pid) return;
        rubSegment(fx, fy, p.x, p.y);
        fx = p.x;
        fy = p.y;
      },
      up(p, e, cancelled) {
        const moved = Math.hypot(p.x - p.x0, p.y - p.y0);
        if (pressed && p.id === pid) {
          pressed = false;
          if (!cancelled && moved < 14 && (phase === 'cool' || phase === 'auto')) tapCool(p.x, p.y);
          return;
        }
        if (phase === 'rain' && !cancelled && moved < 30) rainTap(p.x, p.y);
      },
    }, { touchAction: 'none' });

    /* ---- progression ---- */
    function hud() {
      const total = cols * rows;
      let prog;
      if (phase === 'cool' || phase === 'auto' || phase === 'tilt') {
        const pct = Math.floor((solidN / total) * 100 + 1e-6);
        prog = phase === 'cool' ? 0.6 * clamp(solidN / total / AUTO_AT) : 0.6;
        if (pct !== shownCrust && phase !== 'tilt') {
          shownCrust = pct;
          api.status(pct > 0 ? fill(TEXTES.croute, pct) : '');
        }
      } else {
        prog = 0.6 + 0.4 * level;
        const pct = Math.round(level * 100);
        if (hinted && !finished && pct !== shownWater) {
          shownWater = pct;
          api.status(fill(TEXTES.eau, pct));
        }
      }
      const q = Math.round(prog * 200);
      if (q !== shownProg) {
        shownProg = q;
        api.progress(prog);
      }
    }

    /* ---- animation ---- */
    function updateHeat(dt) {
      const auto = phase !== 'cool';
      const coolRate = auto ? COOL_FAST : COOL;
      let changed = false;
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const idx = j * cols + i;
          const h0 = heat[idx];
          if (h0 <= 0) continue;
          if (h0 < SOLID) {
            heat[idx] = Math.max(0, h0 - coolRate * dt);
            changed = true;
            continue;
          }
          let d = 0;
          if (auto) {
            d = 0.6 * dt;
          } else {
            let ns = 0;
            if (i > 0 && heat[idx - 1] < SOLID) ns++;
            if (i < cols - 1 && heat[idx + 1] < SOLID) ns++;
            if (j > 0 && heat[idx - cols] < SOLID) ns++;
            if (j < rows - 1 && heat[idx + cols] < SOLID) ns++;
            if (ns) d = SPREAD * dt * ns * 0.25;
          }
          if (d > 0) {
            const h1 = h0 - d;
            heat[idx] = h1;
            changed = true;
            if (h1 < SOLID) solidified(idx);
          }
        }
      }
      if (changed) maskDirty = true;
      /* bouffées de vapeur au-dessus de la croûte encore tiède */
      const total = cols * rows;
      for (let k = 0; k < 3; k++) {
        const idx = Math.floor(Math.random() * total);
        const hv = heat[idx];
        if (hv > 0.1 && hv < SOLID && Math.random() < 0.5 * (hv / SOLID)) {
          steam(((idx % cols) + 0.5) * (geo.w / cols), (Math.floor(idx / cols) + 0.5) * (geo.h / rows), false);
        }
      }
      if (crackBudget > 0) {
        api.sfx.play('crack', { pitch: rand(0.75, 1.3), volume: 0.45, gap: 110 });
        crackBudget = 0;
      }
    }

    function cloudForm(i) {
      if (phase !== 'rain') return 0;
      return sstep(0, 1, (phaseT - 0.15 - i * 0.22) / 1.5);
    }

    function update(dt) {
      time += dt;
      phaseT += dt;
      if (phase === 'cool' || phase === 'auto') {
        if (pressed) stamp(fx, fy, HOLD_K * dt);
        updateHeat(dt);
        const total = cols * rows;
        if (phase === 'cool' && solidN >= total * AUTO_AT) {
          /* le reste de la lave se fige tout seul */
          phase = 'auto';
          phaseT = 0;
          api.gesture(null);
          api.sfx.play('crack', { pitch: 0.7, gap: 0 });
        }
        if (phase === 'auto' && solidN >= total && phaseT > 1.25) {
          phase = 'tilt';
          phaseT = 0;
          pressed = false;
          api.sfx.play('rumble', { gap: 0 });
        }
      } else if (phase === 'tilt') {
        updateHeat(dt);
        if (phaseT >= T_TILT) {
          phase = 'rain';
          phaseT = 0;
          makeGround();
          /* plus besoin de frotter : la page peut de nouveau défiler par-dessus la scène */
          cv.canvas.style.touchAction = 'pan-y';
          api.sfx.play('wind', { volume: 0.6, gap: 0 });
        }
      } else if (phase === 'rain') {
        stormK = clamp(phaseT / 2.6);
        if (!hinted && phaseT >= 1.3) {
          hinted = true;
          api.hint(TEXTES.pluie);
          if (!rainTaps) api.gesture('tap', { x: 35, y: 15 });
        }
        target = Math.min(1, target + DRIZZLE * dt);
        level = Math.min(target, level + 0.16 * dt);
        if (!finished && level >= 0.995) {
          level = target = 1;
          finished = true;
          api.done(TEXTES.fin, TEXTES.finStatut);
        }
        /* averses et pluie légère */
        for (let i = 0; i < clouds.length; i++) {
          const c = clouds[i];
          const form = cloudForm(i);
          c.bump = Math.max(0, c.bump - dt * 2.5);
          c.rain = Math.max(0, c.rain - dt / 1.3);
          let n = (150 * Math.min(1, c.rain) + 2.4 * form) * dt;
          while (n > 0) {
            if (n >= 1 || Math.random() < n) spawnDrop(c, c.rain > 0.05);
            n -= 1;
          }
        }
      }
      if (phase === 'tilt' || phase === 'rain') {
        /* les volcans fument */
        for (let i = 0; i < cones.length; i++) {
          const cn = cones[i];
          cn.smokeT -= dt;
          if ((phase === 'rain' || phaseT > T_TILT * 0.6) && cn.smokeT <= 0) {
            cn.smokeT = RM ? 0.9 : rand(0.22, 0.42);
            smoke(cn.x, cn.base - cn.Hc + 2, clamp(cn.Hc / (geo.h * 0.3), 0.55, 1.4));
          }
        }
      }
      /* particules */
      const slow = RM ? 0.5 : 1;
      for (let i = 0; i < puffs.length; i++) {
        const p = puffs[i];
        if (!p.on) continue;
        p.t += dt;
        if (p.t >= p.life) {
          p.on = false;
          continue;
        }
        p.x += p.vx * dt * slow;
        p.y += p.vy * dt * slow;
        if (p.smoke) p.vx += dt * 6;
      }
      for (let i = 0; i < drops.length; i++) {
        const d = drops[i];
        if (!d.on) continue;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        if (d.y >= d.end) {
          d.on = false;
          const wet = level > 0.01 && d.end >= shoreY(d.x, shoreBase()) + 1;
          const k = (d.end - geo.Hy) / (geo.h - geo.Hy);
          if (Math.random() < 0.55) ring(d.x, d.end, lerp(2.5, 9, k), lerp(0.25, 0.45, k), wet ? 1 : 3, 0.32, wet ? 0.55 : 0.4);
        }
      }
      for (let i = 0; i < rings.length; i++) {
        const g = rings[i];
        if (!g.on) continue;
        g.t += dt;
        if (g.t >= g.dur) g.on = false;
      }
      hud();
    }

    /* ---- dessin ---- */
    /* l'océan de lave coule lentement : deux motifs qui glissent dans des sens différents */
    function drawLava() {
      const g = lavaCtx;
      const w = lavaC.width, h = lavaC.height;
      const sp = RM ? 0.25 : 1;
      /* sur une grande scène, le motif grandit aussi : on ne voit pas qu'il se répète */
      const big = Math.max(1, Math.max(geo.w, geo.h) / 450);
      const sa = 2.0 * LS * big, sb = 1.7 * LS * big;
      const ax = (time * 5 * sp * LS) % (LT * sa), ay = (time * 8 * sp * LS) % (LT * sa);
      const bx = (time * 7 * sp * LS) % (LT * sb), by = (time * 3 * sp * LS) % (LT * sb);
      if (canPat) {
        mA.a = mA.d = sa;
        mA.e = -ax;
        mA.f = -ay;
        patA.setTransform(mA);
        g.fillStyle = patA;
        g.fillRect(0, 0, w, h);
        mB.a = mB.d = sb;
        mB.e = bx;
        mB.f = -by;
        patB.setTransform(mB);
        g.fillStyle = patB;
        g.fillRect(0, 0, w, h);
      } else {
        const ta = LT * sa, tb = LT * sb;
        for (let y = -ay; y < h; y += ta) for (let x = -ax; x < w; x += ta) g.drawImage(lavaBase, x, y, ta, ta);
        for (let y = -by; y < h; y += tb) for (let x = bx - tb; x < w; x += tb) g.drawImage(lavaVeins, x, y, tb, tb);
      }
      /* zones plus chaudes qui dérivent lentement */
      g.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 3; k++) {
        const t = time * 0.07 * sp + k * 2.1;
        const x = w * (0.5 + 0.38 * Math.sin(t * 1.3 + k)), y = h * (0.5 + 0.36 * Math.cos(t + k * 1.7));
        draw.glow(g, x, y, geo.M * 0.42 * LS, '#FFC94F', 0.12);
      }
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = vignette;
      g.fillRect(0, 0, w, h);
    }

    /* vue de dessus : lave, croûte et fissures tièdes, liseré des bords, en un seul calque */
    function drawTopView() {
      const { w, h } = geo;
      drawLava();
      if (maskDirty) updateMasks();
      composeCrust();
      const g = lowCtx;
      g.drawImage(lavaC, 0, 0, w, h);
      if (solidN > 0 || maskDirty) {
        g.drawImage(crustComp, 0, 0, w, h);
        g.globalCompositeOperation = 'lighter';
        g.drawImage(rimC, 0, 0, w, h);
        g.globalCompositeOperation = 'source-over';
      }
      ctx.drawImage(low, 0, 0, w, h);
    }

    function drawPuffs(smokeOnly) {
      for (let i = 0; i < puffs.length; i++) {
        const p = puffs[i];
        if (!p.on || p.smoke !== smokeOnly) continue;
        const k = p.t / p.life;
        const r = lerp(p.r0, p.r1, ease.outQuad(k));
        ctx.globalAlpha = p.a * Math.min(1, k * 5) * (1 - k);
        ctx.drawImage(p.smoke ? smokeSpr : steamSpr, p.x - r, p.y - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
    }

    function drawRings(kind, col) {
      for (let i = 0; i < rings.length; i++) {
        const g = rings[i];
        if (!g.on || g.kind !== kind) continue;
        const k = g.t / g.dur;
        ctx.strokeStyle = rgba(col, g.a * (1 - k));
        if (kind === 3) {
          /* sur la roche sèche, la goutte éclabousse */
          const r = lerp(1, g.r * 0.6, ease.outCubic(k));
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(g.x - r * 0.5, g.y);
          ctx.lineTo(g.x - r * 1.2, g.y - r * 0.9);
          ctx.moveTo(g.x + r * 0.5, g.y);
          ctx.lineTo(g.x + r * 1.2, g.y - r * 0.9);
          ctx.stroke();
          continue;
        }
        ctx.lineWidth = kind === 1 ? 1 : 1.8;
        ctx.beginPath();
        const r = lerp(kind === 1 ? 1 : 6, g.r, ease.outCubic(k));
        ctx.ellipse(g.x, g.y, r, r * g.sq, 0, 0, TAU);
        ctx.stroke();
      }
    }

    function drawFinger() {
      if (!pressed) return;
      ctx.globalCompositeOperation = 'lighter';
      draw.glow(ctx, fx, fy, R_RUB * 1.1, '#FFF1DE', 0.12);
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(255,240,222,0.5)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(fx, fy, R_RUB, 0, TAU);
      ctx.stroke();
    }

    function drawSky() {
      const H = geo.Hy * 1.2;
      ctx.drawImage(skyWarm, 0, 0, geo.w, H);
      if (stormK > 0) {
        ctx.globalAlpha = stormK;
        ctx.drawImage(skyStorm, 0, 0, geo.w, H);
        ctx.globalAlpha = 1;
      }
    }

    /* brume au loin : elle suit le bord lointain du sol pendant que la caméra bascule */
    function drawHaze(e) {
      const top = groundY(0, e);
      ctx.save();
      ctx.translate(0, top - geo.Hy);
      ctx.globalAlpha = Math.min(1, e * 1.4) * (1 - stormK);
      ctx.fillStyle = hazeWarm;
      ctx.fillRect(0, geo.Hy - 2, geo.w, (geo.h - geo.Hy) * 0.45);
      if (stormK > 0) {
        ctx.globalAlpha = stormK;
        ctx.fillStyle = hazeStorm;
        ctx.fillRect(0, geo.Hy - 2, geo.w, (geo.h - geo.Hy) * 0.45);
      }
      ctx.restore();
    }

    function drawClouds() {
      for (let i = 0; i < clouds.length; i++) {
        const c = clouds[i];
        const f = cloudForm(i);
        if (f <= 0.01) continue;
        const drift = RM ? 0 : Math.sin(time * 0.08 + c.ph) * 10;
        const s = lerp(0.7, 1, ease.outCubic(f)) * (1 + 0.05 * c.bump);
        const cw = c.cw * s, chh = c.chh * s;
        const x = c.x + drift - cw / 2, y = c.y + c.chh * (1 - s) * 0.5;
        ctx.globalAlpha = f;
        ctx.drawImage(c.spr, x, y, cw, chh);
        const dk = Math.min(1, c.rain) * f;
        if (dk > 0.01) {
          ctx.globalAlpha = dk;
          ctx.drawImage(c.dark, x, y, cw, chh);
        }
      }
      ctx.globalAlpha = 1;
    }

    function coneWaterline(cn, base) {
      if (base >= cn.base) return Infinity;
      const s = clamp((cn.base - base) / (cn.base - geo.Hy));
      return cn.base - s * 0.42 * cn.Hc;
    }

    function drawConeShadow(cn, alpha) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(cn.x + cn.W * 0.06, cn.base - 1);
      ctx.scale(1, 0.13);
      draw.glow(ctx, 0, 0, cn.W * 0.62, '#000000', 0.5);
      ctx.restore();
    }

    function drawCone(cn, alpha, rise, wl) {
      const s = 1 / cv.dpr;
      const W = cn.W, Ht = cn.Hc + cn.pad;
      const x = cn.x - W / 2, y = cn.base - Ht;
      ctx.save();
      ctx.globalAlpha = alpha;
      if (wl < Infinity) {
        ctx.beginPath();
        ctx.rect(x - 2, y - 2, W + 4, wl - y + 2);
        ctx.clip();
      }
      if (rise !== 1) {
        ctx.translate(cn.x, cn.base);
        ctx.scale(lerp(1.15, 1, Math.min(1, rise)), rise);
        ctx.translate(-cn.x, -cn.base);
      }
      ctx.drawImage(cn.c, x, y, cn.c.width * s, cn.c.height * s);
      ctx.restore();
      if (wl < Infinity) {
        /* reflet du cône dans l'eau, puis une petite ligne d'écume */
        const hw = coneHalfAt(cn, cn.base - wl);
        ctx.save();
        ctx.beginPath();
        ctx.rect(x - 2, wl, W + 4, Math.min(geo.h - wl, (wl - (cn.base - cn.Hc)) * 0.7));
        ctx.clip();
        ctx.globalAlpha = 0.2 * alpha;
        ctx.translate(0, wl * 2);
        ctx.scale(1, -1);
        ctx.drawImage(cn.c, x, y, cn.c.width * s, cn.c.height * s);
        ctx.restore();
        ctx.strokeStyle = rgba('#D8E8F0', 0.45 * alpha);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(cn.x, wl, hw, Math.max(1.5, hw * 0.09), 0, 0, Math.PI);
        ctx.stroke();
      }
    }

    function drawWater() {
      if (level <= 0.001) return;
      const { w, h } = geo;
      const base = shoreBase();
      ctx.beginPath();
      ctx.moveTo(-2, h + 2);
      for (let x = -2; x <= w + 6; x += 6) ctx.lineTo(x, shoreY(x, base));
      ctx.lineTo(w + 6, h + 2);
      ctx.closePath();
      /* transparente au bord, de plus en plus opaque vers le large */
      const top = Math.min(base - 14, h - 2);
      const gr = ctx.createLinearGradient(0, top, 0, top + 100);
      gr.addColorStop(0, 'rgba(130,156,170,0.6)');
      gr.addColorStop(0.16, 'rgba(92,122,138,0.8)');
      gr.addColorStop(0.55, 'rgba(56,84,100,0.92)');
      gr.addColorStop(1, 'rgba(40,64,80,0.97)');
      ctx.fillStyle = gr;
      ctx.fill();
      ctx.save();
      ctx.clip();
      const dg = ctx.createLinearGradient(0, top + 100, 0, h);
      dg.addColorStop(0, 'rgba(14,26,36,0)');
      dg.addColorStop(1, 'rgba(14,26,36,0.45)');
      ctx.fillStyle = dg;
      ctx.fillRect(0, top + 100, w, Math.max(0, h - top - 100));
      /* reflet du ciel au bord de l'eau */
      const rg = ctx.createLinearGradient(0, top, 0, top + 34);
      rg.addColorStop(0, 'rgba(196,212,222,0.42)');
      rg.addColorStop(1, 'rgba(196,212,222,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(0, top, w, 34);
      /* petites vagues */
      ctx.strokeStyle = 'rgba(214,232,242,0.22)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const span = h - geo.Hy;
      for (let i = 0; i < waves.length; i++) {
        const wv = waves[i];
        const y = geo.Hy + span * persp(wv.v) + (RM ? 0 : Math.sin(time * 1.5 + wv.ph) * 1.2 * wv.v);
        const x = (((wv.x + time * wv.sp * (RM ? 0.2 : 1)) % (w + 40)) + w + 40) % (w + 40) - 20;
        if (y < shoreY(x, base) + 4) continue;
        const L = lerp(5, 24, wv.v);
        ctx.moveTo(x - L / 2, y);
        ctx.quadraticCurveTo(x, y - 1.5 * wv.v, x + L / 2, y);
      }
      ctx.stroke();
      ctx.restore();
    }

    const RAIN_COL = ['rgba(186,204,216,0.28)', 'rgba(196,214,226,0.4)', 'rgba(206,224,236,0.55)'];
    const RAIN_W = [0.7, 1, 1.3];
    function drawRain() {
      for (let c = 0; c < 3; c++) {
        ctx.strokeStyle = RAIN_COL[c];
        ctx.lineWidth = RAIN_W[c];
        ctx.beginPath();
        let any = false;
        for (let i = 0; i < drops.length; i++) {
          const d = drops[i];
          if (!d.on || d.cls !== c) continue;
          any = true;
          const k = d.len / d.vy;
          ctx.moveTo(d.x - d.vx * k, d.y - d.len);
          ctx.lineTo(d.x, d.y);
        }
        if (any) ctx.stroke();
      }
    }

    function render() {
      const { w, h } = geo;
      if (phase === 'cool' || phase === 'auto') {
        drawTopView();
        drawPuffs(false);
        drawRings(0, '#FFF1DE');
        drawFinger();
        return;
      }
      /* la caméra bascule : on passe de la vue de dessus à la vue de côté */
      const e = phase === 'tilt' ? ease.inOutCubic(clamp(phaseT / T_TILT)) : 1;
      drawSky();
      if (phase === 'rain') drawClouds();
      if (phase === 'tilt') {
        if (maskDirty) updateMasks();
        composeCrust();
        drawGroundStrips(ctx, crustComp, e);
      } else {
        ctx.drawImage(ground, 0, 0, w, h);
      }
      drawHaze(e);
      /* les volcans se dressent quand le sol est à plat */
      const show = phase === 'tilt' ? sstep(0.55, 1, phaseT / T_TILT) : 1;
      for (let i = 0; i < cones.length; i++) drawConeShadow(cones[i], show);
      const base = shoreBase();
      drawWater();
      for (let i = 0; i < cones.length; i++) {
        const cn = cones[i];
        if (show <= 0.01) break;
        drawCone(cn, Math.min(1, show * 4), ease.outBack(show), phase === 'rain' && level > 0.001 ? coneWaterline(cn, base) : Infinity);
      }
      drawPuffs(true);
      drawPuffs(false);
      if (phase === 'rain') {
        drawRain();
        drawRings(1, '#DCECF4');
        drawRings(3, '#B8B2AC');
        drawRings(2, '#E6F1F7');
      }
    }

    /* ---- remise à zéro ---- */
    function init() {
      phase = 'cool';
      phaseT = 0;
      finished = false;
      hinted = false;
      solidN = 0;
      crackBudget = 0;
      shownCrust = shownWater = shownProg = -1;
      pressed = false;
      pid = -1;
      level = target = 0;
      rainTaps = 0;
      stormK = 0;
      for (let i = 0; i < puffs.length; i++) puffs[i].on = false;
      for (let i = 0; i < drops.length; i++) drops[i].on = false;
      for (let i = 0; i < rings.length; i++) rings[i].on = false;
      for (let i = 0; i < clouds.length; i++) {
        clouds[i].rain = 0;
        clouds[i].bump = 0;
      }
      makeGrid();
      cv.canvas.style.touchAction = 'none';
      api.status('');
      api.gesture('rub', { x: 50, y: 55 });
    }

    cv.onResize((w, h) => {
      layout(w, h);
      /* la grille de chaleur suit la taille de la scène (seulement avant le premier geste) */
      if (heat && solidN === 0 && (Math.round(w / CELL) !== cols || Math.round(h / CELL) !== rows)) makeGrid();
    });

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
