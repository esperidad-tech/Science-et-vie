/* La Terre boule de neige : la glace part des pôles et avance vers l'équateur (elle renvoie la
   lumière du Soleil, il fait de plus en plus froid). Puis les volcans percent la glace : chaque
   tape souffle du CO2 dans un halo qui s'épaissit, jusqu'à la grande fonte, la pluie, et le dépôt
   d'une bande de calcaire dans la petite coupe du sol (les carbonates de couverture). */
(function () {
  'use strict';
  const { lib } = window.RM;
  const { TAU, rand, clamp, lerp, ease, rgba, draw } = lib;

  const TEXTES = {
    froid: 'La glace renvoie la lumière : il fait de plus en plus froid…',
    consigneVolcans: 'Tape les volcans pour qu’ils soufflent du CO2.',
    volcans: 'Les volcans percent la glace.',
    temps1: 'Temps écoulé : 1 million d’années. Le CO2 s’accumule, sans pluie pour l’avaler.',
    temps: 'Temps écoulé : {n} millions d’années. Le CO2 s’accumule, sans pluie pour l’avaler.',
    consigneFonte: 'Regarde la glace fondre.',
    fonte: 'La glace fond, de l’équateur vers les pôles.',
    pluie: 'Une forte pluie tombe : une bande de calcaire se dépose.',
    etiquette: 'Carbonates de couverture',
    fin: 'La couverture de CO2 a fait fondre la glace : la Terre est libérée !',
    finStatut: 'Pendant des millions d’années, les volcans ont soufflé du CO2 sans que la pluie puisse l’avaler.',
  };
  const fill = (s, n) => s.replace('{n}', n);

  /* ---- réglages ---- */
  const N_TAPS = 12;          /* tapes de volcan pour faire fondre la glace */
  const PHI0 = 64;            /* bord des calottes au départ (latitude, en degrés) */
  const PHI1 = 3;             /* la glace touche presque l'équateur */
  const PHI2 = 70;            /* après la fonte */
  const T_IDLE = 2;           /* démarrage automatique */
  const T_FREEZE = 8.5;       /* durée de l'emballement */
  const T_EMERGE = 1.5;       /* les volcans percent la glace */
  const T_MELT = 4.8;         /* la grande fonte */
  const TILT = 0.2;           /* pôle nord un peu tourné vers nous */
  const CB = Math.cos(TILT), SB = Math.sin(TILT);
  const LX = -0.6, LY = 0.36, LZ = 0.714;          /* direction du Soleil (à gauche, un peu devant) */
  const HX = -0.324, HY = 0.194, HZ = 0.926;       /* demi-vecteur pour le reflet sur l'océan */
  const DEG = 180 / Math.PI;
  const THERMO = [[0, '#7FC8F8'], [0.3, '#5FB4E8'], [0.5, '#8BD86A'], [0.7, '#FFB347'], [1, '#FF4E3A']];
  const HALO = [[0, '#9C93C4'], [0.6, '#B48AA6'], [1, '#D2666C']];

  /* continents (centres en coordonnées du disque, y vers le haut) et volcans posés dessus */
  const CONT = [
    { d: [-0.47, 0.3], a: 0.3, s: 0.15 },
    { d: [-0.2, 0.55], a: 0.16, s: 0.06 },
    { d: [0.36, 0.42], a: 0.5, s: 0.05 },
    { d: [-0.28, -0.42], a: 0.25, s: 0.1 },
    { d: [0.43, -0.24], a: 0.27, s: 0.12 },
    { d: [0.1, 0.02], a: 0.1, s: 0.025 },
  ];
  const VOLC = [[-0.5, 0.27], [0.36, 0.4], [-0.27, -0.45], [0.45, -0.25]];

  const HEX = {
    sand: '#DABD90', tan: '#C69E70', brown: '#A27A58', rock: '#8A7769', rust: '#B36C4C', dark: '#6E5E56',
    shallow: '#4DA4D2', sea: '#2470B2', deep: '#164B8A', atm: '#8CC6EE',
    snow: '#F8FBFE', dune: '#DDEAF4', shade: '#A6BFD6', crack: '#BCD0DE', iceAtm: '#B4D8F0', cloud: '#FCFEFF',
    skyWarmT: '#9FCFEE', skyWarmB: '#DDF0FA', skyColdT: '#CFE2EE', skyColdB: '#F1F6FA', skyStormT: '#7B8B9B', skyStormB: '#ADBAC5',
  };
  const P = {};
  Object.keys(HEX).forEach((k) => { P[k] = lib.hexToRgb(HEX[k]); });

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
  /* mélange de trois couleurs (tableaux RVB) : a→b selon t1, puis vers c selon t2 */
  function tri(a, b, c, t1, t2) {
    const r = lerp(lerp(a[0], b[0], t1), c[0], t2);
    const g = lerp(lerp(a[1], b[1], t1), c[1], t2);
    const bl = lerp(lerp(a[2], b[2], t1), c[2], t2);
    return `rgb(${r | 0},${g | 0},${bl | 0})`;
  }
  /* rectangle en forme de galet : chaque coin a son rayon */
  function pebbleRect(g, x, y, w, h, r) {
    const a = r * 1.1, b = r * 0.8, c = r * 1.25, d = r * 0.9;
    g.beginPath();
    g.moveTo(x + a, y);
    g.lineTo(x + w - b, y);
    g.quadraticCurveTo(x + w, y, x + w, y + b);
    g.lineTo(x + w, y + h - c);
    g.quadraticCurveTo(x + w, y + h, x + w - c, y + h);
    g.lineTo(x + d, y + h);
    g.quadraticCurveTo(x, y + h, x, y + h - d);
    g.lineTo(x, y + a);
    g.quadraticCurveTo(x, y, x + a, y);
    g.closePath();
  }
  /* sprite flou (halo, bouffée) dessiné une fois */
  function sprite(col, kind) {
    const c = mk(64, 64);
    const g = c.getContext('2d');
    if (kind === 'puff') {
      const blobs = [[32, 34, 22, 1], [22, 30, 14, 0.8], [42, 28, 15, 0.8], [30, 22, 13, 0.7], [40, 40, 13, 0.6]];
      blobs.forEach(([x, y, r, a]) => {
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, rgba(col, 0.55 * a));
        gr.addColorStop(0.6, rgba(col, 0.3 * a));
        gr.addColorStop(1, rgba(col, 0));
        g.fillStyle = gr;
        g.fillRect(0, 0, 64, 64);
      });
    } else {
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, rgba(col, 1));
      gr.addColorStop(0.22, rgba(col, 0.62));
      gr.addColorStop(0.55, rgba(col, 0.18));
      gr.addColorStop(1, rgba(col, 0));
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 64);
    }
    return c;
  }
  function lowerBound(arr, v) {
    let lo = 0, hi = arr.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (arr[mid] < v) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  window.RM.games.boule = function (api) {
    const cv = api.canvas();
    const ctx = cv.ctx;
    const RMO = api.reducedMotion;
    const nL = lib.makeNoise(11), nD = lib.makeNoise(23), nI = lib.makeNoise(37), nC = lib.makeNoise(53), nR = lib.makeNoise(71);

    const SPR = {
      warm: sprite('#FFB04A'), white: sprite('#FFFFFF'), lava: sprite('#FF7A2A'), shadow: sprite('#26303C'),
      co2a: sprite('#A69DCB', 'puff'), co2b: sprite('#D2686E', 'puff'), smoke: sprite('#B8B2C8', 'puff'),
    };

    /* ---- état ---- */
    let phase = 'idle';
    let pt = 0;
    let time = 0;
    let phi = PHI0;
    let taps = 0;
    let co2T = 0, co2S = 0;
    let temp = 0.5;
    let lastTap = 0;
    let nudge = 0;
    let arrowAcc = 0;
    let crackAcc = 0;
    let cloudK = 0, rainK = 0;
    let iceK = 0, meltK = 0, pebK = 0, capK = 0;
    let tagA = 0;
    let shownProg = -1;
    let statusStep = 0;
    let finished = false;
    let haloGrad = null, haloQ = -1, haloOuter = 0;
    let tintGrad = null, tintQ = -1;

    const arrows = makePool(18);
    const flashes = makePool(24);
    const puffs = makePool(90);
    const halo = makePool(150);
    const sparks = makePool(48);
    const shards = makePool(40);
    const wisps = makePool(24);
    const rings = makePool(8);
    const drops = makePool(64);
    const splashes = makePool(14);

    const volcs = VOLC.map((d, i) => ({ d, i, x: 0, y: 0, emerge: 0, heat: 0, bump: 0, wisp: 0, ph: i * 0.45, grad: null, cracks: [], slabs: [] }));
    volcs.forEach((v) => {
      for (let k = 0; k < 6; k++) v.cracks.push({ a: (k / 6) * TAU + rand(-0.3, 0.3), l: rand(1.5, 2.1), b: rand(-0.4, 0.4) });
      for (let k = 0; k < 7; k++) v.slabs.push({ a: (k / 7) * TAU + rand(-0.25, 0.25), f: rand(0.95, 1.2), L: rand(0.1, 0.16), rot: rand(TAU) });
    });

    /* ---- géométrie ---- */
    const geo = { ok: false, w: 1, h: 1, cx: 0, cy: 0, R: 1, s: 1, sx: 0, sy: 0, sr: 1, tx: 0, ty0: 0, ty1: 0, ix: 0, iy: 0, iw: 1, ih: 1, gy: 0, wy: 0 };
    let bg = null, rim = null, insetRock = null, insetPeb = null, insetCap = null;
    const twinkles = [];
    const icePebbles = [];

    /* ---- le globe : calculé pixel par pixel une fois (par petites tranches, sans bloquer la page),
       puis seule la bande où passe le bord de la glace est recolorée ---- */
    const glb = { S: 0, ready: false, cvs: null, g: null, img: null, A: null, B: null, I: null, L: null, order: null, keys: null, clouds: null, phi: -999 };
    let job = null;

    function toGlobe(nx, ny) {
      const z = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      return [nx, ny * CB + z * SB, -ny * SB + z * CB];
    }
    const CONT3 = CONT.map((c) => {
      const g = toGlobe(c.d[0], c.d[1]);
      return { x: g[0], y: g[1], z: g[2], a: c.a, s2: c.s };
    });

    function requestGlobe() {
      const S = Math.round(clamp(geo.R * 2 * Math.min(cv.dpr, 1.75), 96, 600));
      if (glb.ready && Math.abs(S - glb.S) / glb.S < 0.1) return;
      if (job && job.S === S) return;
      const n = S * S, CS = Math.ceil(S / 2);
      job = { S, CS, row: 0, A: new Uint8Array(n), B: new Uint8Array(n * 3), I: new Uint8Array(n * 3), L: new Float32Array(n), C: new Uint8ClampedArray(CS * CS * 4) };
      pump();
    }
    function pump() {
      setTimeout(() => {
        if (!job) return;
        buildRows(10);
        if (job) pump();
      }, 0);
    }
    function buildRows(budget) {
      const j = job;
      const t0 = performance.now();
      while (j.row < j.S) {
        buildRow(j, j.row++);
        if ((j.row & 3) === 0 && performance.now() - t0 > budget) break;
      }
      if (j.row >= j.S) finishGlobe(j);
    }

    function buildRow(j, row) {
      const S = j.S;
      const ny = 1 - ((row + 0.5) / S) * 2;
      for (let i = 0; i < S; i++) {
        const nx = ((i + 0.5) / S) * 2 - 1;
        const r2 = nx * nx + ny * ny;
        const edge = (1 - Math.sqrt(r2)) * S * 0.5 + 0.5;
        if (edge <= 0) continue;
        const p = row * S + i, q = p * 3;
        const alpha = edge >= 1 ? 255 : Math.round(edge * 255);
        j.A[p] = alpha;
        const z = Math.sqrt(Math.max(0, 1 - r2));
        const gx = nx, gy = ny * CB + z * SB, gz = -ny * SB + z * CB;
        const lat = Math.asin(clamp(gy, -1, 1)) * DEG;
        const dif = Math.max(0, nx * LX + ny * LY + z * LZ);
        const limb = Math.pow(1 - z, 2.4);
        /* terres et mers */
        let lv = 0.6 * nL.fbm(gx * 1.5 + 4.1, gy * 1.5 + 2.7, 5) + 0.4 * nL.fbm(gz * 1.5 + 9.3, gy * 1.5 + 6.1, 4);
        lv = 0.5 + (lv - 0.5) * 1.8;   /* côtes découpées : baies, péninsules, îles */
        for (let k = 0; k < CONT3.length; k++) {
          const c = CONT3[k];
          const dx = gx - c.x, dy = gy - c.y, dz = gz - c.z;
          lv += c.a * Math.exp(-(dx * dx + dy * dy + dz * dz) / c.s2);
        }
        lv -= 0.7;
        let r, g, b;
        if (lv > 0) {
          /* roche nue (pas encore de plantes sur les continents) */
          const e = clamp(lv / 0.15);
          let a0, a1, t;
          if (e < 0.06) { a0 = P.sand; a1 = P.tan; t = e / 0.06; }
          else if (e < 0.45) { a0 = P.tan; a1 = P.brown; t = (e - 0.06) / 0.39; }
          else { a0 = P.brown; a1 = P.rock; t = (e - 0.45) / 0.55; }
          r = lerp(a0[0], a1[0], t); g = lerp(a0[1], a1[1], t); b = lerp(a0[2], a1[2], t);
          const v = 0.7 * nD.fbm(gx * 6 + 3, gy * 6 + 1, 3) + 0.3 * nD.fbm(gz * 6 + 5, gx * 6 + 2, 3);
          const ru = clamp((v - 0.5) * 3.4);
          r = lerp(r, P.rust[0], ru * 0.45); g = lerp(g, P.rust[1], ru * 0.45); b = lerp(b, P.rust[2], ru * 0.45);
          const dk = clamp((0.42 - v) * 4);
          r = lerp(r, P.dark[0], dk * 0.3); g = lerp(g, P.dark[1], dk * 0.3); b = lerp(b, P.dark[2], dk * 0.3);
          /* relief : ombrage d'après la pente, éclairé depuis la gauche
             (domaine tourné pour que la grille du bruit ne se voie pas) */
          const ru2 = (gx * 0.87 - gy * 0.5) * 9 + 7, rv2 = (gx * 0.5 + gy * 0.87) * 9 + 3;
          const h0 = nD.fbm(ru2, rv2, 4);
          const hx = nD.fbm(ru2 + 0.087, rv2 + 0.05, 4) - h0;
          const hy = nD.fbm(ru2 - 0.05, rv2 + 0.087, 4) - h0;
          const sh = clamp(1 + (hx * 0.6 + hy * 0.36) * 2.6 * (0.5 + e), 0.78, 1.22);
          r *= sh; g *= sh; b *= sh;
        } else {
          const t1 = clamp(-lv / 0.028), t2 = clamp((-lv - 0.03) / 0.13);
          r = lerp(lerp(P.shallow[0], P.sea[0], t1), P.deep[0], t2);
          g = lerp(lerp(P.shallow[1], P.sea[1], t1), P.deep[1], t2);
          b = lerp(lerp(P.shallow[2], P.sea[2], t1), P.deep[2], t2);
        }
        const lit = 0.16 + 0.92 * Math.pow(dif, 0.8);
        r *= lit; g *= lit; b *= lit;
        if (lv <= 0) {
          const sp = Math.pow(Math.max(0, nx * HX + ny * HY + z * HZ), 80) * 120;
          r += sp; g += sp; b += sp;
        }
        const at = 0.6 * limb, al = 0.3 + 0.7 * dif;
        r = lerp(r, P.atm[0] * al, at); g = lerp(g, P.atm[1] * al, at); b = lerp(b, P.atm[2] * al, at);
        j.B[q] = clamp(r, 0, 255); j.B[q + 1] = clamp(g, 0, 255); j.B[q + 2] = clamp(b, 0, 255);
        /* glace : neige, congères, fines craquelures de banquise */
        const dn = clamp((nD.fbm(gx * 4.5 + 11, gy * 4.5 + 6, 3) - 0.42) * 2.5) * 0.6;
        let ir = lerp(P.snow[0], P.dune[0], dn), ig = lerp(P.snow[1], P.dune[1], dn), ib = lerp(P.snow[2], P.dune[2], dn);
        const ck = Math.abs(nI.fbm(gx * 5.5 + 2, gy * 5.5 + 3, 3) - 0.5);
        if (ck < 0.012) {
          const kk = (1 - ck / 0.012) * 0.45;
          ir = lerp(ir, P.crack[0], kk); ig = lerp(ig, P.crack[1], kk); ib = lerp(ib, P.crack[2], kk);
        }
        const shd = Math.pow(1 - dif, 1.5) * 0.5;
        ir = lerp(ir, P.shade[0], shd); ig = lerp(ig, P.shade[1], shd); ib = lerp(ib, P.shade[2], shd);
        const li = Math.min(1.05, 0.44 + 0.75 * Math.pow(dif, 0.7));
        ir *= li; ig *= li; ib *= li;
        const ai = 0.45 * limb;
        ir = lerp(ir, P.iceAtm[0] * al, ai); ig = lerp(ig, P.iceAtm[1] * al, ai); ib = lerp(ib, P.iceAtm[2] * al, ai);
        j.I[q] = clamp(ir, 0, 255); j.I[q + 1] = clamp(ig, 0, 255); j.I[q + 2] = clamp(ib, 0, 255);
        /* où la glace arrive en premier : bord irrégulier, un peu plus vite sur les terres */
        const jit = nI.fbm(gx * 2 + 1.7, gy * 1.6 + gz * 1.4 + 5.2, 3);
        const jit2 = nI.fbm(gx * 7 + 8, gz * 7 + gy * 5, 2);
        j.L[p] = Math.abs(lat) + (jit - 0.5) * 36 + (jit2 - 0.5) * 14 + (lv > 0 ? 3.5 : 0);
        /* nuages en tourbillons (pour la grande pluie), en demi-résolution */
        if ((row & 1) === 0 && (i & 1) === 0) {
          const wx = nC.fbm(gx * 1.8 + 2, gy * 1.8 + gz, 3), wy = nC.fbm(gz * 1.8 + 5, gy * 1.8 - gx, 3);
          const cdn = nC.fbm(gx * 2.8 + wx * 1.7 + 7.3, gy * 4.4 + wy * 1.7 + gz, 4);
          const ca = clamp((cdn - 0.5) * 5.5);
          if (ca > 0) {
            const lc = 0.5 + 0.58 * Math.pow(dif, 0.8);
            const o = ((row >> 1) * j.CS + (i >> 1)) * 4;
            j.C[o] = P.cloud[0] * lc; j.C[o + 1] = P.cloud[1] * lc; j.C[o + 2] = P.cloud[2] * lc;
            j.C[o + 3] = ca * 0.92 * alpha;
          }
        }
      }
    }

    function finishGlobe(j) {
      const S = j.S, n = S * S;
      const cc = mk(j.CS, j.CS);
      const cg = cc.getContext('2d');
      const cimg = cg.createImageData(j.CS, j.CS);
      cimg.data.set(j.C);
      cg.putImageData(cimg, 0, 0);
      /* pixels triés selon le moment où la glace les couvre */
      let count = 0;
      for (let p = 0; p < n; p++) if (j.A[p]) count++;
      const tmp = new Float64Array(count);
      let k = 0;
      for (let p = 0; p < n; p++) if (j.A[p]) tmp[k++] = Math.round((j.L[p] + 60) * 256) * 1048576 + p;
      tmp.sort();
      const order = new Uint32Array(count), keys = new Float32Array(count);
      for (k = 0; k < count; k++) {
        const v = tmp[k];
        const p = v % 1048576;
        order[k] = p;
        keys[k] = (v - p) / 1048576 / 256 - 60;
      }
      glb.S = S;
      glb.cvs = mk(S, S);
      glb.g = glb.cvs.getContext('2d');
      glb.img = glb.g.createImageData(S, S);
      glb.A = j.A; glb.B = j.B; glb.I = j.I; glb.L = j.L;
      glb.order = order; glb.keys = keys; glb.clouds = cc;
      glb.phi = -999;
      glb.ready = true;
      job = null;
    }

    function ensureGlobe() {
      if (!glb.ready && job && api.visible) buildRows(1e9);
    }

    function paintGlobe(ph) {
      const d = glb.img.data, A = glb.A, B = glb.B, I = glb.I, L = glb.L, order = glb.order, S = glb.S;
      let k0 = 0, k1 = order.length;
      if (glb.phi > -900) {
        k0 = lowerBound(glb.keys, Math.min(glb.phi, ph) - 3.4);
        k1 = lowerBound(glb.keys, Math.max(glb.phi, ph) + 1.6);
      }
      let rmin = S, rmax = -1;
      for (let k = k0; k < k1; k++) {
        const p = order[k];
        const q = p * 3, o = p * 4;
        let r = B[q], g = B[q + 1], b = B[q + 2];
        const dd = L[p] - ph;
        if (dd > -3.2) {
          let kk;
          if (dd >= 1.4) kk = 1;
          else if (dd >= 0) kk = 0.76 + 0.24 * (dd / 1.4);
          else kk = 0.42 * (1 + dd / 3.2);
          r += (I[q] - r) * kk;
          g += (I[q + 1] - g) * kk;
          b += (I[q + 2] - b) * kk;
          if (dd >= 0 && dd < 0.6) { r += 12; g += 12; b += 10; }
        }
        d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = A[p];
        const row = (p / S) | 0;
        if (row < rmin) rmin = row;
        if (row > rmax) rmax = row;
      }
      if (rmax >= rmin) glb.g.putImageData(glb.img, 0, 0, 0, rmin, S, rmax - rmin + 1);
      glb.phi = ph;
    }

    /* la glace couvre-t-elle ce point de l'écran ? */
    function iceAt(x, y) {
      if (!glb.ready) return false;
      const S = glb.S;
      const i = Math.floor(((x - (geo.cx - geo.R)) / (2 * geo.R)) * S);
      const j = Math.floor(((y - (geo.cy - geo.R)) / (2 * geo.R)) * S);
      if (i < 0 || j < 0 || i >= S || j >= S) return false;
      return glb.L[j * S + i] > phi;
    }

    /* ---- fonds pré-rendus ---- */
    function makeBg(w, h) {
      const c = mk(w * cv.dpr, h * cv.dpr);
      const g = c.getContext('2d');
      g.scale(cv.dpr, cv.dpr);
      const sky = g.createLinearGradient(0, 0, w * 0.5, h);
      sky.addColorStop(0, '#0D2036');
      sky.addColorStop(0.55, '#0B1B2E');
      sky.addColorStop(1, '#11304C');
      g.fillStyle = sky;
      g.fillRect(0, 0, w, h);
      draw.glow(g, w * 0.92, h * 0.12, Math.max(w, h) * 0.55, '#24527D', 0.32);
      draw.glow(g, w * 0.25, h * 1.02, Math.max(w, h) * 0.6, '#1E4C70', 0.28);
      const sn = lib.makeNoise(5);
      for (let i = 0; i < 110; i++) {
        const x = sn.rnd() * w, y = sn.rnd() * h;
        const s = 0.5 + sn.rnd() * 1.2;
        g.fillStyle = rgba(sn.rnd() < 0.3 ? '#CFE6FF' : '#FFFFFF', 0.18 + sn.rnd() * 0.55);
        g.fillRect(x, y, s, s);
      }
      /* le Soleil, au bord gauche */
      draw.glow(g, geo.sx, geo.sy, geo.sr * 3.4, '#FFC861', 0.28);
      draw.glow(g, geo.sx, geo.sy, geo.sr * 1.9, '#FFE7A8', 0.5);
      const sd = g.createRadialGradient(geo.sx + geo.sr * 0.2, geo.sy - geo.sr * 0.15, 0, geo.sx, geo.sy, geo.sr);
      sd.addColorStop(0, '#FFFDF2');
      sd.addColorStop(0.6, '#FFE9A0');
      sd.addColorStop(1, '#FFC24E');
      g.fillStyle = sd;
      g.beginPath();
      g.arc(geo.sx, geo.sy, geo.sr, 0, TAU);
      g.fill();
      /* ombre douce sous la coupe */
      g.save();
      g.shadowColor = 'rgba(0, 8, 20, 0.55)';
      g.shadowBlur = 16;
      g.shadowOffsetY = 6;
      pebbleRect(g, geo.ix, geo.iy, geo.iw, geo.ih, 15);
      g.fillStyle = '#20384E';
      g.fill();
      g.restore();
      return c;
    }

    function makeRim() {
      const R = geo.R;
      const size = R * 2.4;
      const c = mk(size * cv.dpr, size * cv.dpr);
      const g = c.getContext('2d');
      g.scale(cv.dpr, cv.dpr);
      g.translate(size / 2, size / 2);
      const gr = g.createRadialGradient(0, 0, R * 0.9, 0, 0, R * 1.12);
      gr.addColorStop(0, 'rgba(150,205,245,0)');
      gr.addColorStop(0.36, 'rgba(160,212,248,0.08)');
      gr.addColorStop(0.47, 'rgba(178,224,255,0.62)');
      gr.addColorStop(0.62, 'rgba(140,200,245,0.22)');
      gr.addColorStop(1, 'rgba(120,190,240,0)');
      g.fillStyle = gr;
      g.fillRect(-size / 2, -size / 2, size, size);
      g.globalCompositeOperation = 'destination-in';
      const lin = g.createLinearGradient(-R * 1.1, -R * 0.5, R * 1.1, R * 0.5);
      lin.addColorStop(0, 'rgba(0,0,0,1)');
      lin.addColorStop(0.55, 'rgba(0,0,0,0.6)');
      lin.addColorStop(1, 'rgba(0,0,0,0.18)');
      g.fillStyle = lin;
      g.fillRect(-size / 2, -size / 2, size, size);
      return c;
    }

    /* la petite coupe du sol : roche en strates, galets laissés par la glace, bande de calcaire */
    const PCOLS = ['#A39686', '#C2B29C', '#7C8C96', '#8E7766', '#D6C7B0', '#9AA6A0'];
    function makeInsetLayers() {
      const d = cv.dpr;
      const iw = geo.iw, rockH = geo.iy + geo.ih - geo.gy;
      insetRock = mk(iw * d, rockH * d);
      const g = insetRock.getContext('2d');
      g.scale(d, d);
      const cols = ['#7E6756', '#937963', '#6C5C51', '#8A735F', '#5E5047', '#776354'];
      const lh = Math.max(5, geo.ih * 0.08);
      for (let k = -1; k < rockH / lh + 2; k++) {
        g.fillStyle = cols[(k + 6) % cols.length];
        g.beginPath();
        g.moveTo(0, rockH + 2);
        for (let x = 0; x <= iw + 4; x += 4) {
          const y = k * lh + Math.sin(x * 0.03 + k * 1.3) * lh * 0.22 + (nR.noise2(x * 0.05, k * 3.1) - 0.5) * lh * 0.4;
          g.lineTo(x, y);
        }
        g.lineTo(iw + 4, rockH + 2);
        g.closePath();
        g.fill();
      }
      for (let i = 0; i < iw * rockH * 0.06; i++) {
        g.fillStyle = Math.random() < 0.5 ? 'rgba(255,240,220,0.10)' : 'rgba(20,10,5,0.12)';
        g.fillRect(Math.random() * iw, Math.random() * rockH, 1.2, 1.2);
      }
      const ps = Math.min(1.5, geo.ih / 72);
      /* les galets laissés par les glaciers */
      const pebH = geo.ih * 0.1;
      insetPeb = mk(iw * d, pebH * d);
      const pg = insetPeb.getContext('2d');
      pg.scale(d, d);
      pg.fillStyle = '#5A5550';
      pg.beginPath();
      pg.moveTo(0, pebH);
      for (let x = 0; x <= iw + 4; x += 5) pg.lineTo(x, pebH * 0.12 + nR.noise2(x * 0.08, 9.5) * pebH * 0.25);
      pg.lineTo(iw + 4, pebH);
      pg.closePath();
      pg.fill();
      for (let i = 0; i < iw / 4.2; i++) {
        const r = rand(1.2, 3.2) * ps;
        const x = rand(iw), y = rand(pebH * 0.35, pebH - r * 0.6);
        pg.fillStyle = PCOLS[i % PCOLS.length];
        pg.beginPath();
        pg.ellipse(x, y, r * 1.25, r, rand(-0.5, 0.5), 0, TAU);
        pg.fill();
        pg.fillStyle = 'rgba(255,255,255,0.28)';
        pg.beginPath();
        pg.ellipse(x - r * 0.35, y - r * 0.35, r * 0.45, r * 0.3, 0, 0, TAU);
        pg.fill();
      }
      /* la bande de calcaire crème, finement litée */
      const capH = geo.ih * 0.17;
      insetCap = mk(iw * d, capH * d);
      const cg = insetCap.getContext('2d');
      cg.scale(d, d);
      const cgr = cg.createLinearGradient(0, 0, 0, capH);
      cgr.addColorStop(0, '#FCF5E2');
      cgr.addColorStop(1, '#E9D9B4');
      cg.fillStyle = cgr;
      cg.fillRect(0, 0, iw, capH);
      for (let y = 1.5; y < capH; y += rand(1.7, 2.8)) {
        cg.strokeStyle = Math.random() < 0.6 ? 'rgba(190,162,110,0.42)' : 'rgba(255,252,240,0.75)';
        cg.lineWidth = 0.7;
        cg.beginPath();
        for (let x = 0; x <= iw; x += 6) {
          const yy = y + Math.sin(x * 0.045 + y) * 0.5;
          if (x === 0) cg.moveTo(x, yy);
          else cg.lineTo(x, yy);
        }
        cg.stroke();
      }
      /* galets prisonniers de la glace (ils tomberont à la fonte) */
      icePebbles.length = 0;
      for (let i = 0; i < Math.round(iw / 20); i++) {
        icePebbles.push({ fx: rand(0.03, 0.97), fy: rand(0.45, 0.92), r: rand(1.4, 2.8) * ps, col: PCOLS[i % PCOLS.length], delay: rand(0, 0.5) });
      }
    }

    /* ---- étiquette DOM de la bande de calcaire ---- */
    api.style(`
      .game[data-game="boule"] .bl-tag { position: absolute; z-index: 3; margin: 0; padding: 5px 10px 6px;
        border-radius: 10px 13px 11px 9px; background: #F6EDD5; color: #13324A;
        font: 700 .8125rem/1.1 var(--font-text); white-space: nowrap; pointer-events: none;
        box-shadow: 0 6px 14px -8px rgba(0, 0, 0, .6); opacity: 0; transform: translateY(6px);
        transition: opacity .6s ease, transform .6s ease; }
      .game[data-game="boule"] .bl-tag.is-on { opacity: 1; transform: none; }
    `);
    const tag = document.createElement('p');
    tag.className = 'bl-tag';
    tag.textContent = TEXTES.etiquette;
    tag.setAttribute('aria-hidden', 'true');
    api.stage.appendChild(tag);
    function placeTag() {
      tag.style.left = Math.round(geo.ix + 8) + 'px';
      tag.style.top = Math.round(geo.iy - 33) + 'px';
    }

    cv.onResize((w, h) => {
      /* taille transitoire (scène pas encore mise en page) : on attend la vraie */
      if (w < 120 || h < 160) return;
      geo.ok = true;
      geo.w = w;
      geo.h = h;
      geo.ih = clamp(h * 0.18, 62, 116);
      geo.iy = h - geo.ih - Math.max(10, h * 0.028);
      const avail = geo.iy - 30;
      geo.R = Math.min(w * 0.315, avail * 0.39);
      geo.s = geo.R / 115;
      geo.cx = w * (w > h * 1.15 ? 0.47 : 0.465);
      geo.cy = avail * 0.5 + 10;
      geo.sr = Math.min(w, h) * 0.2;
      geo.sx = -geo.sr * 0.55;
      geo.sy = geo.cy - geo.R * 0.6;
      geo.tx = Math.min(w - 24 * Math.max(0.8, geo.s), geo.cx + geo.R * 1.36 + 18);
      geo.ty0 = geo.cy - geo.R * 0.72;
      geo.ty1 = geo.cy + geo.R * 0.5;
      geo.iw = Math.min(w * 0.88, geo.R * 3.4, 560);
      geo.ix = (w - geo.iw) / 2;
      geo.gy = geo.iy + geo.ih * 0.66;
      geo.wy = geo.iy + geo.ih * 0.26;
      volcs.forEach((v) => {
        v.x = geo.cx + v.d[0] * geo.R;
        v.y = geo.cy - v.d[1] * geo.R;
        const W = 32 * geo.s;
        const gr = ctx.createLinearGradient(v.x - W / 2, 0, v.x + W / 2, 0);
        gr.addColorStop(0, '#A08A7E');
        gr.addColorStop(0.45, '#6F5C55');
        gr.addColorStop(1, '#2F2627');
        v.grad = gr;
      });
      twinkles.length = 0;
      for (let i = 0; i < 22; i++) {
        let x, y;
        do {
          x = rand(w);
          y = rand(geo.iy - 6);
        } while (Math.hypot(x - geo.cx, y - geo.cy) < geo.R * 1.3);
        twinkles.push({ x, y, s: rand(0.9, 1.8), f: rand(1.2, 3.2), p: rand(TAU) });
      }
      requestGlobe();
      bg = makeBg(w, h);
      rim = makeRim();
      makeInsetLayers();
      haloGrad = null;
      tintGrad = null;
      placeTag();
    });

    /* ---- déroulé ---- */
    function setProgress(p) {
      const q = Math.round(p * 100);
      if (q === shownProg) return;
      shownProg = q;
      api.progress(q / 100);
    }

    function init() {
      phase = 'idle';
      pt = 0;
      phi = PHI0;
      taps = 0;
      co2T = co2S = 0;
      temp = 0.5;
      lastTap = 0;
      nudge = 0;
      arrowAcc = 0;
      crackAcc = 0;
      cloudK = rainK = 0;
      iceK = meltK = pebK = capK = 0;
      tagA = 0;
      shownProg = -1;
      statusStep = 0;
      finished = false;
      [arrows, flashes, puffs, halo, sparks, shards, wisps, rings, drops, splashes].forEach(clearPool);
      volcs.forEach((v) => {
        v.emerge = 0;
        v.heat = 0;
        v.bump = 0;
        v.wisp = rand(0.4, 1.6);
      });
      tag.classList.remove('is-on');
      setProgress(0);
      api.status('');
      api.gesture('tap', { x: 50, y: 45 });
      glb.phi = -999;
      /* quelques flèches déjà en route pour la première image */
      for (let i = 0; i < 6; i++) {
        const a = spawnArrow();
        if (a) {
          const k = rand(0.2, 0.85);
          a.x = lerp(a.x, a.tx, k);
          a.y = lerp(a.y, a.ty, k);
          a.t = 1;
          a.len = 22 * Math.max(0.8, geo.s);
        }
      }
    }

    function startFreeze() {
      phase = 'freeze';
      pt = 0;
      api.gesture(null);
      api.status(TEXTES.froid);
      api.sfx.play('wind', { volume: 0.7 });
    }

    function startVolcans() {
      phase = 'volcans';
      pt = 0;
      api.hint(TEXTES.consigneVolcans);
      api.status(TEXTES.volcans);
      api.sfx.play('thud');
      api.sfx.play('crack', { pitch: 0.8 });
    }

    function startMelt() {
      phase = 'melt';
      pt = 0;
      api.hint(TEXTES.consigneFonte);
      api.status(TEXTES.fonte);
      api.gesture(null);
      api.guide(null, 'wow');
      api.sfx.play('crack', { pitch: 0.7 });
      api.sfx.play('whoosh', { volume: 0.6 });
    }

    function finish() {
      if (finished) return;
      finished = true;
      phase = 'free';
      pt = 0;
      api.done(TEXTES.fin, TEXTES.finStatut);
    }

    /* ---- lumière du Soleil ---- */
    function spawnArrow() {
      const a = grab(arrows);
      if (!a) return null;
      let nx, ny;
      do {
        nx = rand(-0.94, 0.3);
        ny = rand(-0.92, 0.92);
      } while (nx * nx + ny * ny > 0.84);
      a.tx = geo.cx + nx * geo.R;
      a.ty = geo.cy - ny * geo.R;
      const dx = a.tx - geo.sx, dy = a.ty - geo.sy;
      const d = Math.hypot(dx, dy);
      a.ux = dx / d;
      a.uy = dy / d;
      a.x = geo.sx + a.ux * geo.sr * 0.96;
      a.y = geo.sy + a.uy * geo.sr * 0.96;
      a.sp = (RMO ? 120 : 200) * Math.max(0.8, geo.s);
      a.state = 1;
      a.t = 0;
      a.len = 0;
      return a;
    }

    function flash(x, y, kind, r) {
      const f = grab(flashes);
      if (!f) return;
      f.x = x; f.y = y; f.kind = kind; f.r = r; f.t = 0;
      f.dur = kind === 2 ? 0.7 : 0.5;
    }

    function updateArrows(dt) {
      arrowAcc += dt;
      const every = RMO ? 0.42 : 0.17;
      while (arrowAcc > every) {
        arrowAcc -= every;
        spawnArrow();
      }
      const maxLen = 22 * Math.max(0.8, geo.s);
      for (let i = 0; i < arrows.length; i++) {
        const a = arrows[i];
        if (!a.on) continue;
        a.t += dt;
        a.len = Math.min(maxLen, a.len + a.sp * dt);
        a.x += a.ux * a.sp * dt;
        a.y += a.uy * a.sp * dt;
        if (a.state === 1) {
          if ((a.x - a.tx) * a.ux + (a.y - a.ty) * a.uy >= 0) {
            a.x = a.tx;
            a.y = a.ty;
            if (iceAt(a.tx, a.ty)) {
              /* la glace blanche renvoie la lumière vers l'espace */
              const nx = (a.tx - geo.cx) / geo.R, ny = (a.ty - geo.cy) / geo.R;
              const bx = -a.ux + nx * 0.95 + rand(-0.25, 0.25), by = -a.uy + ny * 0.95 + rand(-0.25, 0.25);
              const bd = Math.hypot(bx, by) || 1;
              a.ux = bx / bd;
              a.uy = by / bd;
              a.state = 2;
              a.t = 0;
              a.len = 4;
              flash(a.tx, a.ty, 1, 9 * geo.s);
            } else {
              /* l'océan sombre l'absorbe : il se réchauffe */
              a.on = false;
              flash(a.tx, a.ty, 0, 11 * geo.s);
            }
          }
        } else if (a.t > 1.8 || a.x < -40 || a.y < -40 || a.y > geo.h + 40 || a.x > geo.w + 40) {
          a.on = false;
        }
      }
    }

    function drawArrows() {
      const s = Math.max(0.8, geo.s);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const hl = 7 * s, ca = Math.cos(0.5), sa = Math.sin(0.5);
      for (let i = 0; i < arrows.length; i++) {
        const a = arrows[i];
        if (!a.on) continue;
        const fade = a.state === 2 ? clamp(1 - a.t / 1.5) : clamp(a.t / 0.2);
        if (fade <= 0.01) continue;
        const col = a.state === 2 ? '#FFF6C8' : '#FFD84A';
        const tx = a.x - a.ux * a.len, ty = a.y - a.uy * a.len;
        const bx = -a.ux, by = -a.uy;
        ctx.strokeStyle = rgba(col, 0.2 * fade);
        ctx.lineWidth = 7 * s;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(a.x, a.y);
        ctx.stroke();
        ctx.strokeStyle = rgba(col, 0.95 * fade);
        ctx.lineWidth = 2.4 * s;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(a.x, a.y);
        ctx.moveTo(a.x + (bx * ca - by * sa) * hl, a.y + (bx * sa + by * ca) * hl);
        ctx.lineTo(a.x, a.y);
        ctx.lineTo(a.x + (bx * ca + by * sa) * hl, a.y + (-bx * sa + by * ca) * hl);
        ctx.stroke();
      }
    }

    function drawFlashes() {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < flashes.length; i++) {
        const f = flashes[i];
        if (!f.on) continue;
        const k = f.t / f.dur;
        const r = f.r * (0.6 + k * 0.9);
        ctx.globalAlpha = (1 - k) * (f.kind === 1 ? 0.9 : 0.75);
        ctx.drawImage(f.kind === 1 ? SPR.white : f.kind === 2 ? SPR.lava : SPR.warm, f.x - r, f.y - r, r * 2, r * 2);
        if (f.kind === 1) {
          /* petite étincelle en croix sur la glace */
          ctx.strokeStyle = rgba('#FFFFFF', 0.85 * (1 - k));
          ctx.lineWidth = 1.2;
          const l = f.r * 0.9 * (1 - k * 0.4);
          ctx.beginPath();
          ctx.moveTo(f.x - l, f.y);
          ctx.lineTo(f.x + l, f.y);
          ctx.moveTo(f.x, f.y - l);
          ctx.lineTo(f.x, f.y + l);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    /* ---- volcans ---- */
    function volcH(v) {
      return 25 * geo.s * ease.outBack(clamp(v.emerge)) * (1 - v.bump * 0.14);
    }

    function nearestVolcano(x, y) {
      let best = null, bd = Math.max(32, 36 * geo.s);
      for (const v of volcs) {
        if (v.emerge < 0.55) continue;
        const d = Math.hypot(x - v.x, y - (v.y - 11 * geo.s));
        if (d < bd) { bd = d; best = v; }
      }
      return best;
    }

    function erupt(v) {
      v.heat = 1;
      v.bump = 1;
      const ox = v.x, oy = v.y - volcH(v);
      const ex = (v.x - geo.cx) / geo.R, ey = (v.y - geo.cy) / geo.R;
      for (let i = 0; i < 12; i++) {
        const p = grab(puffs);
        if (!p) break;
        let dx = ex * 0.8 + rand(-0.35, 0.35), dy = ey * 0.6 - 0.75 + rand(-0.2, 0.2);
        const dd = Math.hypot(dx, dy) || 1;
        dx /= dd;
        dy /= dd;
        const sp = rand(60, 130) * geo.s;
        p.x = ox + rand(-2, 2);
        p.y = oy + rand(-2, 1);
        p.vx = dx * sp;
        p.vy = dy * sp;
        p.t = 0;
        p.th = Math.atan2(oy - geo.cy, ox - geo.cx) + rand(-0.8, 0.8);
        p.rt = geo.R * rand(1.05, 1.1 + 0.15 * Math.min(1, co2T + 0.1));
        p.size = rand(4, 6.5) * geo.s;
        p.a = rand(0.6, 0.9);
        p.mix = rand(-0.12, 0.12);
      }
      for (let i = 0; i < 9; i++) {
        const s = grab(sparks);
        if (!s) break;
        s.x = ox;
        s.y = oy;
        const ang = -Math.PI / 2 + rand(-0.7, 0.7);
        const sp = rand(50, 120) * geo.s;
        s.vx = Math.cos(ang) * sp;
        s.vy = Math.sin(ang) * sp;
        s.t = 0;
        s.dur = rand(0.45, 0.8);
      }
      flash(ox, oy, 2, 18 * geo.s);
      api.sfx.play('rumble', { volume: 0.6, pitch: rand(0.9, 1.2), gap: 80 });
      api.sfx.play('whoosh', { volume: 0.35, pitch: rand(0.8, 1.1), gap: 80 });
      api.buzz(10);
    }

    function tapVolcano(v) {
      erupt(v);
      if (phase !== 'volcans' || taps >= N_TAPS) {
        co2T = Math.min(1.08, co2T + 0.02);
        return;
      }
      taps++;
      lastTap = pt;
      co2T = taps / N_TAPS;
      api.status(taps === 1 ? TEXTES.temps1 : fill(TEXTES.temps, taps));
      setProgress(0.3 + 0.6 * (taps / N_TAPS));
    }

    /* plaque de glace brisée (avec son épaisseur) */
    function drawSlab(x, y, L, rot, a) {
      ctx.globalAlpha = a;
      for (let pass = 0; pass < 2; pass++) {
        const oy = pass === 0 ? 1.6 : 0;
        ctx.fillStyle = pass === 0 ? '#8FA9BE' : '#F6FAFD';
        ctx.beginPath();
        for (let k = 0; k < 4; k++) {
          const ang = rot + k * (TAU / 4) + (k % 2 ? 0.35 : -0.2);
          const rr = L * (k % 2 ? 0.7 : 1);
          const px = x + Math.cos(ang) * rr, py = y + Math.sin(ang) * rr * 0.55 + oy;
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function drawSlabs(v, W, e, iceVis, front) {
      if (iceVis <= 0.01) return;
      const rx = W * 0.6 * lerp(0.55, 1, ease.outCubic(clamp(e * 1.3)));
      for (const sl of v.slabs) {
        const sa = Math.sin(sl.a);
        if ((sa > 0) !== front) continue;
        drawSlab(v.x + Math.cos(sl.a) * rx * sl.f, v.y + sa * rx * sl.f * 0.42, W * sl.L, sl.rot, clamp(e * 2) * iceVis);
      }
    }

    function drawVolcano(v) {
      const e = v.emerge;
      if (e <= 0) return;
      const s = geo.s;
      const x = v.x, y = v.y;
      const iceVis = phase === 'free' || phase === 'melt' ? clamp(1 - meltK * 1.3) : 1;
      const W = 32 * s * (1 + v.bump * 0.1);
      const H = volcH(v);
      const top = y - H;
      /* ombre douce au pied */
      const shr = W * 0.85;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, 0.42);
      ctx.globalAlpha = 0.5 * clamp(e * 2);
      ctx.drawImage(SPR.shadow, -shr, -shr, shr * 2, shr * 2);
      ctx.restore();
      ctx.globalAlpha = 1;
      /* la roche perce la glace : fines fissures et plaques brisées */
      if (iceVis > 0.01) {
        const k0 = clamp(e * 2) * iceVis;
        const hr = W * 0.62;
        ctx.strokeStyle = rgba('#86A0B5', 0.75 * k0);
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        for (const c of v.cracks) {
          const ca = Math.cos(c.a), sa = Math.sin(c.a);
          const l0 = hr * 1.05, l1 = hr * lerp(1.05, c.l, clamp(e * 1.3));
          ctx.moveTo(x + ca * l0, y + sa * l0 * 0.42);
          ctx.quadraticCurveTo(x + ca * (l0 + l1) * 0.5 + c.b * 3, y + sa * (l0 + l1) * 0.21 + c.b * 2, x + ca * l1, y + sa * l1 * 0.42);
        }
        ctx.stroke();
      }
      drawSlabs(v, W, e, iceVis, false);
      /* le cône */
      ctx.beginPath();
      ctx.moveTo(x - W / 2, y);
      ctx.bezierCurveTo(x - W * 0.3, y - H * 0.25, x - W * 0.16, y - H * 0.7, x - W * 0.12, top);
      ctx.quadraticCurveTo(x, top - H * 0.06, x + W * 0.12, top);
      ctx.bezierCurveTo(x + W * 0.16, y - H * 0.7, x + W * 0.3, y - H * 0.25, x + W / 2, y);
      ctx.quadraticCurveTo(x, y + W * 0.08, x - W / 2, y);
      ctx.closePath();
      ctx.fillStyle = v.grad;
      ctx.fill();
      /* rigoles de neige sur les flancs */
      ctx.strokeStyle = rgba('#F3F8FC', 0.8 * iceVis);
      ctx.lineWidth = 1.4 * s;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x - W * 0.08, top + H * 0.14);
      ctx.quadraticCurveTo(x - W * 0.14, top + H * 0.4, x - W * 0.24, top + H * 0.62);
      ctx.moveTo(x + W * 0.04, top + H * 0.18);
      ctx.lineTo(x + W * 0.09, top + H * 0.45);
      ctx.stroke();
      drawSlabs(v, W, e, iceVis, true);
      /* le cratère rougeoyant */
      const heat = v.heat;
      ctx.fillStyle = lib.mix('#C2411E', '#FFD27A', heat * 0.8);
      ctx.beginPath();
      ctx.ellipse(x, top + 0.4, W * 0.12 + 0.6, 2.2 * s, 0, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      const gr = (8 + 14 * heat + 1.5 * Math.sin(time * 4 + v.ph)) * s;
      ctx.globalAlpha = 0.55 + 0.4 * heat;
      ctx.drawImage(SPR.lava, x - gr, top - gr, gr * 2, gr * 2);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    /* onde qui pulse autour des volcans : « tape ici » */
    function drawVolcPings() {
      if (phase !== 'volcans') return;
      ctx.lineWidth = 2.2;
      for (const v of volcs) {
        if (v.emerge < 0.9) continue;
        const u = ((time * 0.62 + v.ph) % 1 + 1) % 1;
        const r = lerp(14, 36, ease.outCubic(u)) * geo.s * (1 + nudge * 0.25);
        const a = (0.75 + nudge * 0.25) * (1 - u) * (1 - v.heat * 0.7);
        if (a < 0.02) continue;
        ctx.strokeStyle = rgba('#FFB25B', a);
        ctx.beginPath();
        ctx.ellipse(v.x, v.y - 11 * geo.s, r, r * 0.92, 0, 0, TAU);
        ctx.stroke();
      }
    }

    /* ---- le halo de CO2 ---- */
    function drawHaloBase() {
      const q = Math.round(co2S * 60);
      if (q <= 0) return;
      if (q !== haloQ || !haloGrad) {
        haloQ = q;
        const k = q / 60;
        const t = Math.pow(Math.min(1, k), 1.4);
        const R = geo.R;
        haloOuter = R * (1.06 + 0.25 * k);
        const g = ctx.createRadialGradient(geo.cx, geo.cy, R * 0.96, geo.cx, geo.cy, haloOuter);
        g.addColorStop(0, lib.ramp(HALO, t, 0));
        g.addColorStop(0.1, lib.ramp(HALO, t, 0.2 + 0.5 * k));
        g.addColorStop(0.5, lib.ramp(HALO, t, 0.1 + 0.3 * k));
        g.addColorStop(1, lib.ramp(HALO, t, 0));
        haloGrad = g;
      }
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(geo.cx, geo.cy, haloOuter, 0, TAU);
      ctx.fill();
    }

    function drawHaloPuffs() {
      const k = Math.pow(Math.min(1, co2S), 1.4);
      const fade = phase === 'melt' || phase === 'free' ? clamp(0.3 + co2S * 0.7) : 1;
      for (let i = 0; i < halo.length; i++) {
        const h = halo[i];
        if (!h.on) continue;
        const x = geo.cx + Math.cos(h.th) * h.r, y = geo.cy + Math.sin(h.th) * h.r;
        const r = h.size;
        const kk = clamp(k + h.mix);
        const a = h.a * fade * clamp(h.t * 2);
        if (kk < 0.98) {
          ctx.globalAlpha = a * (1 - kk);
          ctx.drawImage(SPR.co2a, x - r, y - r, r * 2, r * 2);
        }
        if (kk > 0.02) {
          ctx.globalAlpha = a * kk;
          ctx.drawImage(SPR.co2b, x - r, y - r, r * 2, r * 2);
        }
      }
      ctx.globalAlpha = 1;
    }

    function drawLimbTint() {
      const q = Math.round(co2S * 40);
      if (q <= 0) return;
      if (q !== tintQ || !tintGrad) {
        tintQ = q;
        const k = q / 40;
        const t = Math.pow(Math.min(1, k), 1.4);
        const g = ctx.createRadialGradient(geo.cx, geo.cy, geo.R * 0.7, geo.cx, geo.cy, geo.R);
        g.addColorStop(0, lib.ramp(HALO, t, 0));
        g.addColorStop(1, lib.ramp(HALO, t, 0.36 * k));
        tintGrad = g;
      }
      ctx.fillStyle = tintGrad;
      ctx.beginPath();
      ctx.arc(geo.cx, geo.cy, geo.R, 0, TAU);
      ctx.fill();
    }

    /* ---- particules ---- */
    function updateParticles(dt) {
      const s = geo.s;
      for (let i = 0; i < puffs.length; i++) {
        const p = puffs[i];
        if (!p.on) continue;
        p.t += dt;
        const tx = geo.cx + Math.cos(p.th) * p.rt, ty = geo.cy + Math.sin(p.th) * p.rt;
        const pull = clamp((p.t - 0.25) / 0.7);
        p.vx += ((tx - p.x) * 7 - p.vx * 2.2) * pull * dt;
        p.vy += ((ty - p.y) * 7 - p.vy * 2.2) * pull * dt;
        const drag = Math.exp(-dt * 1.4 * (1 - pull));
        p.vx *= drag;
        p.vy *= drag;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.size = Math.min(11 * s, p.size + dt * 7 * s);
        if (p.t > 2.2 || (p.t > 0.8 && Math.hypot(tx - p.x, ty - p.y) < 3 * s)) {
          /* la bouffée rejoint le halo */
          let hq = grab(halo);
          if (!hq) hq = halo[Math.floor(Math.random() * halo.length)];
          hq.th = Math.atan2(p.y - geo.cy, p.x - geo.cx);
          hq.r = Math.hypot(p.x - geo.cx, p.y - geo.cy);
          hq.w = rand(0.025, 0.07) * (Math.random() < 0.5 ? -1 : 1) * (RMO ? 0.3 : 1);
          hq.size = p.size * rand(1.1, 1.6);
          hq.a = p.a * 0.36;
          hq.mix = p.mix;
          hq.t = 0.5;
          p.on = false;
        }
      }
      for (let i = 0; i < halo.length; i++) {
        const h = halo[i];
        if (!h.on) continue;
        h.t += dt;
        h.th += h.w * dt;
      }
      for (let i = 0; i < sparks.length; i++) {
        const p = sparks[i];
        if (!p.on) continue;
        p.t += dt;
        p.vy += 160 * s * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.t > p.dur) p.on = false;
      }
      for (let i = 0; i < shards.length; i++) {
        const p = shards[i];
        if (!p.on) continue;
        p.t += dt;
        p.vy += 150 * s * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        if (p.t > p.dur) p.on = false;
      }
      for (let i = 0; i < wisps.length; i++) {
        const p = wisps[i];
        if (!p.on) continue;
        p.t += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.size += dt * 6 * s;
        if (p.t > p.dur) p.on = false;
      }
      for (let i = 0; i < flashes.length; i++) {
        const f = flashes[i];
        if (f.on && (f.t += dt) >= f.dur) f.on = false;
      }
      for (let i = 0; i < rings.length; i++) {
        const r = rings[i];
        if (r.on && (r.t += dt) >= 0.6) r.on = false;
      }
    }

    function drawParticles() {
      const s = geo.s;
      /* fumerolles */
      for (let i = 0; i < wisps.length; i++) {
        const p = wisps[i];
        if (!p.on) continue;
        const k = p.t / p.dur;
        ctx.globalAlpha = 0.45 * Math.sin(Math.PI * k);
        ctx.drawImage(SPR.smoke, p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
      }
      /* bouffées de CO2 qui montent */
      const k0 = Math.pow(Math.min(1, co2S), 1.4);
      for (let i = 0; i < puffs.length; i++) {
        const p = puffs[i];
        if (!p.on) continue;
        const a = p.a * clamp(p.t * 5);
        const kk = clamp(k0 + p.mix);
        ctx.globalAlpha = a * (1 - kk);
        ctx.drawImage(SPR.co2a, p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
        if (kk > 0.02) {
          ctx.globalAlpha = a * kk;
          ctx.drawImage(SPR.co2b, p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
        }
      }
      ctx.globalAlpha = 1;
      /* éclats de glace */
      ctx.fillStyle = '#F2F8FC';
      for (let i = 0; i < shards.length; i++) {
        const p = shards[i];
        if (!p.on) continue;
        ctx.globalAlpha = 1 - p.t / p.dur;
        const r = p.r;
        ctx.beginPath();
        ctx.moveTo(p.x + Math.cos(p.rot) * r, p.y + Math.sin(p.rot) * r);
        ctx.lineTo(p.x + Math.cos(p.rot + 2.3) * r * 0.7, p.y + Math.sin(p.rot + 2.3) * r * 0.7);
        ctx.lineTo(p.x + Math.cos(p.rot + 4.1) * r * 0.8, p.y + Math.sin(p.rot + 4.1) * r * 0.8);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      /* gouttes de lave */
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < sparks.length; i++) {
        const p = sparks[i];
        if (!p.on) continue;
        const k = p.t / p.dur;
        const r = (5 - 3 * k) * s;
        ctx.globalAlpha = 1 - k;
        ctx.drawImage(SPR.lava, p.x - r, p.y - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      /* anneaux de toucher */
      for (let i = 0; i < rings.length; i++) {
        const r = rings[i];
        if (!r.on) continue;
        const k = r.t / 0.6;
        ctx.strokeStyle = rgba('#FFFFFF', 0.75 * (1 - k));
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(r.x, r.y, lerp(6, 34 * Math.max(0.8, s), ease.outCubic(k)), 0, TAU);
        ctx.stroke();
      }
    }

    function emergeBurst(v) {
      for (let i = 0; i < 9; i++) {
        const p = grab(shards);
        if (!p) break;
        const ang = -Math.PI / 2 + rand(-1.3, 1.3);
        const sp = rand(40, 95) * geo.s;
        p.x = v.x + rand(-4, 4);
        p.y = v.y - 3;
        p.vx = Math.cos(ang) * sp;
        p.vy = Math.sin(ang) * sp;
        p.r = rand(2, 4) * geo.s;
        p.rot = rand(TAU);
        p.vr = rand(-8, 8);
        p.t = 0;
        p.dur = rand(0.5, 0.9);
      }
      api.sfx.play('crack', { pitch: rand(0.8, 1.2), gap: 60 });
    }

    /* ---- la coupe ---- */
    const PEB_H = 0.1, CAP_H = 0.17;
    function floorY() {
      return geo.gy - geo.ih * PEB_H * pebK - geo.ih * CAP_H * capK;
    }
    function iceTopY() {
      return lerp(geo.wy, geo.iy + geo.ih * 0.1, iceK * (1 - meltK));
    }

    function updateInset(dt) {
      const rate = rainK * (RMO ? 60 : 170);
      let n = rate * dt;
      while (n > 0) {
        if (n < 1 && Math.random() > n) break;
        n -= 1;
        const d = grab(drops);
        if (!d) break;
        d.x = geo.ix + rand(-10, geo.iw);
        d.y = geo.iy - rand(0, 10);
        d.v = rand(240, 320) * Math.max(0.7, geo.ih / 72);
        d.l = rand(9, 15);
      }
      const surf = iceTopY();
      for (let i = 0; i < drops.length; i++) {
        const d = drops[i];
        if (!d.on) continue;
        d.y += d.v * dt;
        d.x += d.v * 0.18 * dt;
        if (d.y >= surf) {
          d.on = false;
          const sp = grab(splashes);
          if (sp) {
            sp.x = d.x;
            sp.y = surf;
            sp.t = 0;
          }
        }
      }
      for (let i = 0; i < splashes.length; i++) {
        const sp = splashes[i];
        if (sp.on && (sp.t += dt) > 0.35) sp.on = false;
      }
    }

    function drawInset() {
      const { ix, iy, iw, ih, gy, wy } = geo;
      ctx.save();
      pebbleRect(ctx, ix, iy, iw, ih, 15);
      ctx.clip();
      /* ciel */
      const cold = iceK * (1 - meltK);
      const storm = clamp(rainK * 1.1) * 0.85;
      const sg = ctx.createLinearGradient(0, iy, 0, gy);
      sg.addColorStop(0, tri(P.skyWarmT, P.skyColdT, P.skyStormT, cold, storm));
      sg.addColorStop(1, tri(P.skyWarmB, P.skyColdB, P.skyStormB, cold, storm));
      ctx.fillStyle = sg;
      ctx.fillRect(ix, iy, iw, gy - iy);
      /* roche en dessous */
      ctx.drawImage(insetRock, ix, gy, iw, iy + ih - gy);
      /* nouvelles couches : galets puis calcaire */
      const pebH = ih * PEB_H, capH = ih * CAP_H;
      if (pebK > 0) {
        ctx.globalAlpha = clamp(pebK * 1.5);
        ctx.drawImage(insetPeb, ix, gy - pebH * pebK, iw, pebH);
        ctx.globalAlpha = 1;
      }
      let capTop = gy - pebH * pebK;
      if (capK > 0) {
        const hh = capH * capK;
        capTop -= hh;
        ctx.drawImage(insetCap, 0, insetCap.height * (1 - capK), insetCap.width, insetCap.height * capK, ix, capTop, iw, hh);
        ctx.fillStyle = 'rgba(255,253,244,0.9)';
        ctx.fillRect(ix, capTop, iw, 1);
        if (capK < 1) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = 'rgba(255,244,208,0.3)';
          ctx.fillRect(ix, capTop - 2, iw, 4);
          ctx.globalCompositeOperation = 'source-over';
        }
      }
      const fy = floorY();
      /* l'eau (mer peu profonde) */
      const waterA = 1 - clamp(iceK * 1.6) * (1 - meltK);
      if (waterA > 0.01) {
        const wg = ctx.createLinearGradient(0, wy, 0, fy);
        wg.addColorStop(0, rgba('#62B3E2', 0.6 * waterA));
        wg.addColorStop(1, rgba('#2E7FB8', 0.66 * waterA));
        ctx.fillStyle = wg;
        ctx.fillRect(ix, wy, iw, fy - wy);
        ctx.strokeStyle = rgba('#EAF7FF', 0.85 * waterA);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let x = 0; x <= iw; x += 6) {
          const yy = wy + Math.sin(x * 0.09 + time * (RMO ? 0.6 : 2.2)) * (0.8 + rainK);
          if (x === 0) ctx.moveTo(ix + x, yy);
          else ctx.lineTo(ix + x, yy);
        }
        ctx.stroke();
      }
      /* la glace, qui s'épaissit puis fond */
      const iceAmt = iceK * (1 - meltK);
      if (iceAmt > 0.005) {
        const itop = iceTopY();
        const ib = Math.max(itop + 1, lerp(wy, fy, Math.min(1, iceK * 1.6)) * (1 - meltK) + wy * meltK);
        const ig = ctx.createLinearGradient(0, itop, 0, ib);
        ig.addColorStop(0, '#FAFDFF');
        ig.addColorStop(0.5, '#E3F0F8');
        ig.addColorStop(1, '#C3DCEC');
        ctx.globalAlpha = clamp(iceAmt * 3);
        ctx.fillStyle = ig;
        ctx.fillRect(ix, itop, iw, ib - itop);
        ctx.strokeStyle = 'rgba(160,195,220,0.5)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        for (let k = 1; k < 4; k++) {
          const yy = lerp(itop, ib, k / 4);
          ctx.moveTo(ix, yy);
          for (let x = 0; x <= iw; x += 10) ctx.lineTo(ix + x, yy + Math.sin(x * 0.05 + k * 2) * 0.8);
        }
        ctx.stroke();
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(ix, itop, iw, 1.2);
        /* galets prisonniers de la glace */
        if (phase !== 'melt' && phase !== 'free') {
          for (const p of icePebbles) {
            const yy = lerp(itop, ib, p.fy);
            if (yy > ib - p.r) continue;
            ctx.fillStyle = p.col;
            ctx.beginPath();
            ctx.ellipse(ix + p.fx * iw, yy, p.r * 1.2, p.r, 0.3, 0, TAU);
            ctx.fill();
          }
        }
        ctx.globalAlpha = 1;
      }
      /* galets qui tombent quand la glace fond */
      if (phase === 'melt') {
        for (const p of icePebbles) {
          const k = clamp((pt - 0.3 - p.delay) / 0.9);
          if (k >= 1) continue;
          const y0 = lerp(wy + 4, gy - 4, p.fy * 0.6);
          const yy = lerp(y0, gy - ih * 0.04, ease.inQuad(k));
          ctx.fillStyle = p.col;
          ctx.beginPath();
          ctx.ellipse(ix + p.fx * iw, yy, p.r * 1.2, p.r, 0.3, 0, TAU);
          ctx.fill();
        }
      }
      /* pluie */
      ctx.strokeStyle = 'rgba(232,244,253,0.85)';
      ctx.lineWidth = 1.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < drops.length; i++) {
        const d = drops[i];
        if (!d.on) continue;
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - d.l * 0.18, d.y - d.l);
      }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(235,247,255,0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < splashes.length; i++) {
        const sp = splashes[i];
        if (!sp.on) continue;
        const r = 1 + (sp.t / 0.35) * 4;
        ctx.moveTo(sp.x + r, sp.y);
        ctx.ellipse(sp.x, sp.y, r, r * 0.35, 0, 0, TAU);
      }
      ctx.stroke();
      ctx.restore();
      /* cadre du galet */
      pebbleRect(ctx, ix, iy, iw, ih, 15);
      ctx.strokeStyle = 'rgba(228,240,248,0.75)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      /* trait de rappel vers l'étiquette */
      if (tagA > 0.01) {
        const lx = ix + 29;
        const by = gy - pebH * pebK - capH * capK * 0.5;
        ctx.strokeStyle = rgba('#F6EDD5', 0.95 * tagA);
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(lx, iy - 6);
        ctx.lineTo(lx, by);
        ctx.stroke();
        ctx.fillStyle = rgba('#F6EDD5', tagA);
        ctx.beginPath();
        ctx.arc(lx, by, 3, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = rgba('#8A6A3A', 0.6 * tagA);
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    /* ---- thermomètre ---- */
    function drawThermo() {
      const s = Math.max(0.8, geo.s);
      const x = geo.tx, y0 = geo.ty0, y1 = geo.ty1;
      const tw = 11 * s, br = 9.5 * s;
      ctx.beginPath();
      ctx.moveTo(x - tw / 2, y1 - br * 0.6);
      ctx.lineTo(x - tw / 2, y0);
      ctx.arc(x, y0, tw / 2, Math.PI, 0);
      ctx.lineTo(x + tw / 2, y1 - br * 0.6);
      ctx.arc(x, y1, br, -Math.PI / 2 + 0.62, Math.PI * 1.5 - 0.62);
      ctx.closePath();
      ctx.fillStyle = 'rgba(225,240,250,0.16)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(225,240,250,0.7)';
      ctx.lineWidth = 1.3;
      ctx.stroke();
      const col = lib.ramp(THERMO, temp);
      const lvl = lerp(y1 - br * 0.5, y0, clamp(temp));
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
      /* graduations */
      ctx.strokeStyle = 'rgba(225,240,250,0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 1; i < 6; i++) {
        const yy = lerp(y1 - br * 1.2, y0 + 4, i / 6);
        ctx.moveTo(x + tw / 2 + 2, yy);
        ctx.lineTo(x + tw / 2 + (i % 2 ? 5 : 7), yy);
      }
      ctx.stroke();
      /* petit soleil en haut, petit flocon en bas */
      const sy = y0 - tw / 2 - 11 * s;
      ctx.fillStyle = '#FFC861';
      ctx.beginPath();
      ctx.arc(x, sy, 3.2 * s, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#FFC861';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        ctx.moveTo(x + Math.cos(a) * 4.8 * s, sy + Math.sin(a) * 4.8 * s);
        ctx.lineTo(x + Math.cos(a) * 6.6 * s, sy + Math.sin(a) * 6.6 * s);
      }
      ctx.stroke();
      const fx = x, fy = y1 + br + 10 * s;
      ctx.strokeStyle = '#BFE4FA';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI + Math.PI / 2;
        const l = 5.5 * s;
        ctx.moveTo(fx - Math.cos(a) * l, fy - Math.sin(a) * l);
        ctx.lineTo(fx + Math.cos(a) * l, fy + Math.sin(a) * l);
      }
      ctx.stroke();
    }

    /* ---- interaction ---- */
    function ring(x, y) {
      const r = grab(rings);
      if (!r) return;
      r.x = x;
      r.y = y;
      r.t = 0;
    }

    function onTap(x, y) {
      ring(x, y);
      if (phase === 'idle') {
        api.sfx.play('pop');
        api.buzz(8);
        startFreeze();
        return;
      }
      const v = nearestVolcano(x, y);
      if (v && (phase === 'volcans' || phase === 'melt' || phase === 'free')) {
        tapVolcano(v);
        return;
      }
      api.sfx.play('tick', { pitch: rand(0.9, 1.2) });
      if (phase === 'volcans') nudge = 1;
      if (Math.hypot(x - geo.cx, y - geo.cy) < geo.R) flash(x, y, 1, 8 * geo.s);
    }

    api.track(cv.canvas, {
      up(p, e, cancelled) {
        if (!cancelled && p.tap) onTap(p.x, p.y);
      },
    }, { touchAction: 'pan-y' });

    /* ---- animation ---- */
    function update(dt) {
      time += dt;
      pt += dt;
      nudge = Math.max(0, nudge - dt * 1.4);
      if (phase === 'idle') {
        if (pt > T_IDLE) startFreeze();
      } else if (phase === 'freeze') {
        const u = clamp(pt / T_FREEZE);
        phi = lerp(PHI0, PHI1, Math.pow(u, 1.9));
        iceK = Math.pow(u, 1.3);
        temp = lerp(0.5, 0.05, ease.inQuad(u));
        setProgress(0.3 * u);
        crackAcc += dt * (1 + u * 3);
        if (crackAcc > 0.9) {
          crackAcc = 0;
          api.sfx.play('crack', { pitch: rand(0.7, 1.3), volume: 0.5, gap: 200 });
        }
        if (u >= 1) startVolcans();
      } else if (phase === 'volcans') {
        for (const v of volcs) {
          const was = v.emerge;
          v.emerge = clamp((pt - v.i * 0.3) / 0.85);
          if (was <= 0 && v.emerge > 0) emergeBurst(v);
        }
        if (pt > T_EMERGE && taps === 0 && statusStep === 0) {
          statusStep = 1;
          const v = volcs[0];
          api.gesture('tap', { x: (v.x / geo.w) * 100, y: ((v.y - 11 * geo.s) / geo.h) * 100 });
        }
        temp = 0.05 + 0.1 * co2S;
        if (taps >= N_TAPS && pt - lastTap > 1.1) startMelt();
      } else if (phase === 'melt') {
        const u = clamp(pt / T_MELT);
        phi = lerp(PHI1, PHI2, ease.outCubic(clamp(pt / 3)));
        meltK = ease.inOutSine(clamp((pt - 0.2) / 1.6));
        cloudK = 0.8 * ease.outQuad(clamp((pt - 0.1) / 1.4));
        rainK = clamp((pt - 0.3) / 0.8);
        pebK = ease.outQuad(clamp((pt - 0.6) / 1.2));
        capK = ease.inOutSine(clamp((pt - 1.7) / 2.4));
        co2T = lerp(1, 0.72, capK);
        temp = lerp(0.15, 0.6, ease.inOutSine(clamp(pt / 3.6)));
        setProgress(Math.min(0.98, 0.9 + 0.1 * u));
        if (statusStep < 2 && pt > 1.7) {
          statusStep = 2;
          api.status(TEXTES.pluie);
          api.sfx.play('splash', { volume: 0.6 });
        }
        if (capK > 0.55) tag.classList.add('is-on');
        if (pt > 3.9 && statusStep < 3) {
          statusStep = 3;
          api.sfx.play('chime');
        }
        if (rainK > 0.3 && Math.random() < dt * 3) api.sfx.play('splash', { volume: 0.25, pitch: rand(0.8, 1.3), gap: 260 });
        if (pt >= T_MELT) finish();
      } else if (phase === 'free') {
        rainK = Math.max(0.18, rainK - dt * 0.12);
        cloudK = Math.max(0.5, cloudK - dt * 0.05);
        temp = Math.min(0.62, temp + dt * 0.01);
      }
      tagA += ((tag.classList.contains('is-on') ? 1 : 0) - tagA) * (1 - Math.exp(-dt * 4));
      co2S += (co2T - co2S) * (1 - Math.exp(-dt * 2.2));
      for (const v of volcs) {
        v.heat *= Math.exp(-dt * 2.2);
        v.bump *= Math.exp(-dt * 7);
        if (v.emerge > 0.9) {
          v.wisp -= dt;
          if (v.wisp <= 0) {
            v.wisp = rand(0.7, 1.6) * (RMO ? 2 : 1);
            const p = grab(wisps);
            if (p) {
              p.x = v.x + rand(-1, 1);
              p.y = v.y - volcH(v) - 2;
              p.vx = rand(-4, 4) * geo.s;
              p.vy = -rand(10, 18) * geo.s;
              p.size = 3 * geo.s;
              p.t = 0;
              p.dur = rand(1.2, 1.8);
            }
          }
        }
      }
      updateArrows(dt);
      updateParticles(dt);
      updateInset(dt);
      if (glb.ready && Math.abs(phi - glb.phi) > 0.04) paintGlobe(phi);
    }

    function drawPlaceholderGlobe() {
      /* le temps que le globe détaillé se calcule : une sphère bleue toute simple */
      const g = ctx.createRadialGradient(geo.cx - geo.R * 0.35, geo.cy - geo.R * 0.3, geo.R * 0.1, geo.cx, geo.cy, geo.R);
      g.addColorStop(0, '#4A9ED6');
      g.addColorStop(0.7, '#1F5E9C');
      g.addColorStop(1, '#0E2F55');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(geo.cx, geo.cy, geo.R, 0, TAU);
      ctx.fill();
    }

    function render() {
      const { w, h } = cv;
      ensureGlobe();
      if (glb.ready && Math.abs(phi - glb.phi) > 0.04) paintGlobe(phi);
      if (bg) ctx.drawImage(bg, 0, 0, w, h);
      /* étoiles qui scintillent */
      for (let i = 0; i < twinkles.length; i++) {
        const st = twinkles[i];
        const a = RMO ? 0.6 : 0.35 + 0.45 * Math.sin(time * st.f + st.p);
        ctx.fillStyle = rgba('#FFFFFF', clamp(a));
        ctx.fillRect(st.x, st.y, st.s, st.s);
      }
      /* halo de CO2 (derrière le globe) */
      drawHaloBase();
      drawHaloPuffs();
      /* le globe */
      if (glb.ready) {
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(glb.cvs, geo.cx - geo.R, geo.cy - geo.R, geo.R * 2, geo.R * 2);
        if (cloudK > 0.01) {
          ctx.globalAlpha = cloudK;
          ctx.drawImage(glb.clouds, geo.cx - geo.R, geo.cy - geo.R, geo.R * 2, geo.R * 2);
          ctx.globalAlpha = 1;
        }
      } else {
        drawPlaceholderGlobe();
      }
      drawLimbTint();
      const rs = geo.R * 2.4;
      ctx.drawImage(rim, geo.cx - rs / 2, geo.cy - rs / 2, rs, rs);
      for (const v of volcs) drawVolcano(v);
      drawVolcPings();
      drawArrows();
      drawFlashes();
      drawParticles();
      drawThermo();
      drawInset();
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
