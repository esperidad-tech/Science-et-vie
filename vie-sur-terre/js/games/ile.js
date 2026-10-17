/* L’île : un volcan sous-marin grandit coulée après coulée jusqu’à percer la surface.
   Les lichens s’accrochent à la roche nue et préparent un sol, puis mousses, fougères
   et arbres prennent racine. Vue en coupe : ciel, mer, fond marin et ses strates.
   Quand l’île sort de l’eau, la caméra s’approche d’elle. */
(function () {
  'use strict';
  const { lib } = window.RM;
  const { TAU, rand, randInt, clamp, lerp, ease, rgba, mix, pick, draw } = lib;

  /* Tous les textes du jeu */
  const TEXTES = {
    eruption: 'Éruption ! Le volcan grandit sous la mer.',
    presque: 'Le sommet du volcan approche de la surface.',
    ile: 'Une île de roche nue sort de l’eau.',
    hint2: 'Tape l’île pour y semer des lichens.',
    lichens: (n, total) => `Taches de lichen : ${n} sur ${total}`,
    sol: 'Sous les lichens, la roche noire brunit : un sol se forme.',
    hint3: 'Le sol est prêt : tape encore pour faire pousser mousses, fougères, puis arbres.',
    mousse: 'Des touffes de mousse s’installent.',
    fougere: 'Des fougères se déploient.',
    arbre: 'Des arbres poussent.',
    rate: 'Tape sur l’île, juste au-dessus de l’eau.',
    fin: 'La roche nue est devenue une île verte.',
    finStatut: 'Lichens, mousses, puis plantes : la vie colonise encore ainsi les coulées de lave récentes.',
  };

  const ERUPTIONS = 8; /* tapes pour faire sortir l’île */
  const PATCHES = 6;   /* taches de lichen */
  const STEPS = 8;     /* poussées de végétation */
  const NSLOT = 22;    /* emplacements de plantes sur l’île */
  const NSOIL = 96;    /* échantillons de l’épaisseur du sol */
  const ZMAX = 1.8;    /* zoom maximal de la caméra sur l’île */
  const TOP_P = 1.6;   /* forme du sommet : 1 = cône pointu, 2 = dôme */

  const BASALT = ['#2C3032', '#25292B', '#2F2E30', '#222729', '#2B2D30', '#26292C', '#303236', '#24282A', '#2A2D30'];
  const LICHEN = ['#E8A33D', '#D98A2B', '#F2BE58', '#D4CF5E', '#B9C65A', '#A6B8A0', '#8FA78C'];
  const MOSS = ['#5D8D3A', '#76A746', '#4B7B33', '#8CBD58', '#6A9A3E'];

  window.RM.games.ile = function (api) {
    const cv = api.canvas();
    const ctx = cv.ctx;
    const CALM = api.reducedMotion;
    const nz = lib.makeNoise(23);

    /* ---------- état ---------- */
    let phase = 1;
    let taps = 0;
    let level = 0;          /* coulées empilées (réel, animé) */
    let emerged = false;
    let emergeT = 0;
    let patches = [];
    let soilSrc = [];
    let steps = 0;
    let finished = false;
    let finaleTick = 0;
    let time = 0;
    let lavaHeat = 0;
    let conduitHeat = 0.55;
    let chamber = 0.55;
    let vent = 0;
    let eruptT = 9;
    let ambientT = 0;
    let smokeT = 0;
    let misses = 0;
    let solTimer = -1;
    let lastPatchT = 0;
    let pendingGesture = false;
    let zoomK = 0;
    const heat = new Float32Array(ERUPTIONS + 1);
    const soil = new Float32Array(NSOIL);
    const green = new Float32Array(NSOIL);
    const soilU = new Float32Array(NSOIL);
    for (let s = 0; s < NSOIL; s++) soilU[s] = lerp(-0.99, 0.99, s / (NSOIL - 1));
    let slots = [];

    /* particules */
    let bubbles = [], trail = [], plume = [], bombs = [], steam = [], smoke = [], sparks = [], rings = [], flashes = [], pops = [];
    const snow = [];

    /* ---------- géométrie ---------- */
    const G = { w: 1, h: 1, cx: 0, seaY: 0, floorY: 0, D: 1, A: 1, peakY: 0, half: 1, df: 2, U: 1, step: 3, nx: 2, crater: 8, iC: 0, u0: -1, u1: 1 };
    const Hk = new Float32Array(ERUPTIONS + 1);
    const Wk = new Float32Array(ERUPTIONS + 1);
    let prof = [];
    let floorLine = new Float32Array(2);
    let outer = new Float32Array(2);
    let iL = -1, iR = -1;
    let bg = null, strata = null, grain = null, sp = null, rayGrad = null, veilGrad = null;
    const PUFF = {};
    const cam = { s: 1, x: 0, y: 0 };
    const camT = { s: 1, x: 0, y: 0 };

    /* Profil final du volcan : hauteur au-dessus du fond (px) à la distance d du centre.
       Sommet en cône arrondi au-dessus de l’eau, flancs qui s’évasent jusqu’au fond. */
    function finalShape(d) {
      if (d <= G.half) return G.D + G.A * (1 - Math.pow(d / G.half, TOP_P));
      if (d >= G.df) return 0;
      const t = (d - G.half) / (G.df - G.half);
      const m = -((TOP_P * G.A) / G.half) * (G.df - G.half) / G.D;
      const t2 = t * t, t3 = t2 * t;
      return G.D * Math.max(0, 2 * t3 - 3 * t2 + 1 + m * (t3 - 2 * t2 + t));
    }

    function layout(w, h) {
      G.w = w;
      G.h = h;
      G.cx = w / 2;
      G.U = Math.min(w, h) / 360;
      G.seaY = Math.round(h * 0.45);
      G.floorY = h * 0.865;
      G.D = G.floorY - G.seaY;
      G.A = clamp(h * 0.14, 40, 100);
      G.peakY = G.seaY - G.A;
      G.half = Math.min(w * 0.23, h * 0.3);
      G.df = clamp(G.half + G.D * 0.75, w * 0.42, w * 0.6);
      G.crater = G.half * 0.12;
      G.nx = Math.ceil(w / 3) + 1;
      G.step = w / (G.nx - 1);
      G.iC = Math.round(G.cx / G.step);

      const hUnder = G.D - Math.max(11, h * 0.03);
      for (let k = 0; k < ERUPTIONS; k++) {
        const t = k / (ERUPTIONS - 1);
        Hk[k] = hUnder * lerp(0.1, 1, Math.pow(t, 0.92));
        Wk[k] = lerp(0.3, 0.86, Math.pow(t, 0.8));
      }
      Hk[ERUPTIONS] = G.D + G.A;
      Wk[ERUPTIONS] = 1;
      buildProfiles();
      outer = new Float32Array(G.nx);
      computeOuter();

      const s = clamp((0.64 * w) / (2 * G.half), 1, ZMAX);
      camT.s = s;
      camT.x = clamp(w / 2 - G.cx * s, w - w * s, 0);
      camT.y = clamp(h * 0.6 - G.seaY * s, h - h * s, 0);
      updateCam();

      rayGrad = ctx.createLinearGradient(0, G.seaY, 0, G.floorY);
      rayGrad.addColorStop(0, 'rgba(196,240,222,0.11)');
      rayGrad.addColorStop(1, 'rgba(196,240,222,0)');
      veilGrad = ctx.createLinearGradient(0, G.seaY, 0, G.floorY);
      veilGrad.addColorStop(0, 'rgba(14,58,60,0)');
      veilGrad.addColorStop(0.012, 'rgba(14,58,60,0.28)');
      veilGrad.addColorStop(1, 'rgba(9,36,40,0.62)');

      bg = makeBg(w, h);
      strata = makeStrata(w, h);
      grain = makeGrain(w, h);
      sp = makeSprites(h);
      if (!PUFF.ash) {
        PUFF.ash = makePuff('#4F4842');
        PUFF.steam = makePuff('#F2F5EC');
        PUFF.smoke = makePuff('#8C8D87');
        PUFF.glow = makePuff('#FF8A3A');
      }
      snow.length = 0;
      for (let i = 0; i < 36; i++) snow.push({ x: rand(w), y: rand(G.seaY, G.floorY), s: rand(0.6, 1.5), v: rand(3, 9), ph: rand(TAU) });
    }

    function buildProfiles() {
      const { nx, step, cx, floorY } = G;
      floorLine = new Float32Array(nx);
      for (let i = 0; i < nx; i++) {
        const x = i * step;
        const e = (x - cx) / G.w;
        floorLine[i] = floorY + (nz.fbm(x / 80 + 3.3, 2.1, 3) - 0.5) * G.h * 0.04 + e * e * G.h * 0.05;
      }
      const H8 = G.D + G.A;
      prof = [];
      for (let k = 0; k <= ERUPTIONS; k++) {
        const arr = new Float32Array(nx);
        const last = k === ERUPTIONS;
        const hs = Hk[k] / H8, ws = Wk[k];
        const cw = G.crater * (last ? 1 : lerp(0.45, 0.8, k / ERUPTIONS));
        const cd = last ? G.crater * 0.9 : cw * 0.45;
        for (let i = 0; i < nx; i++) {
          const x = i * step;
          const d = Math.abs(x - cx);
          let e = hs * finalShape(d / ws);
          const fall = Math.sqrt(clamp(e / Hk[k]));
          e += (nz.fbm(x / 26 + 7.7, 5.3 + k * 0.37, 3) - 0.5) * Hk[k] * 0.06 * fall;
          e += (nz.noise2(x / 5.5 + k * 3.1, 8.8) - 0.5) * Math.min(4, Hk[k] * 0.02) * fall;
          const q = d / cw;
          e -= cd * Math.exp(-q * q);
          const qr = (d - cw * 1.35) / (cw * 0.75);
          e += cd * 0.32 * Math.exp(-qr * qr);
          e = Math.max(0, e);
          /* le pied du volcan épouse le relief du fond */
          const base = floorY + (floorLine[i] - floorY) * (1 - clamp(e / 25));
          arr[i] = Math.min(floorLine[i], base - e);
        }
        prof.push(arr);
      }
      /* chaque coulée recouvre entièrement la précédente */
      for (let k = ERUPTIONS - 1; k >= 0; k--) {
        const a = prof[k], b = prof[k + 1];
        for (let i = 0; i < nx; i++) {
          if (b[i] < floorLine[i] - 0.5 && a[i] < b[i] + 0.9) a[i] = Math.min(floorLine[i], b[i] + 0.9);
        }
      }
      const top = prof[ERUPTIONS];
      iL = -1;
      iR = -1;
      for (let i = 0; i < nx; i++) {
        if (top[i] < G.seaY - 0.5) {
          if (iL < 0) iL = i;
          iR = i;
        }
      }
      G.u0 = iL < 0 ? -1 : (iL * step - cx) / G.half;
      G.u1 = iR < 0 ? 1 : (iR * step - cx) / G.half;
    }

    function computeOuter() {
      const k = Math.min(ERUPTIONS, Math.floor(level));
      const f = level - k;
      if (k >= ERUPTIONS || f < 0.0005) {
        outer.set(prof[k]);
        return;
      }
      const a = prof[k], b = prof[k + 1];
      for (let i = 0; i < G.nx; i++) outer[i] = a[i] + (b[i] - a[i]) * f;
    }

    function updateCam() {
      const k = ease.inOutCubic(clamp(zoomK));
      cam.s = lerp(1, camT.s, k);
      cam.x = lerp(0, camT.x, k);
      cam.y = lerp(0, camT.y, k);
    }

    const ux = (u) => G.cx + u * G.half;
    function surfYAt(x) {
      const fi = clamp(x / G.step, 0, G.nx - 1.001);
      const i = Math.floor(fi);
      return lerp(outer[i], outer[i + 1], fi - i);
    }
    function slopeAt(x) {
      return Math.atan2(surfYAt(x + 2) - surfYAt(x - 2), 4);
    }
    function ventY() {
      return outer[G.iC];
    }
    function topY() {
      let m = Infinity;
      for (let i = 0; i < G.nx; i++) if (outer[i] < m) m = outer[i];
      return m;
    }

    /* ---------- pré-rendus ---------- */
    function layer(w, h, res) {
      const r = res || cv.dpr;
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(w * r));
      c.height = Math.max(1, Math.round(h * r));
      const g = c.getContext('2d');
      g.scale(r, r);
      return { c, g };
    }

    function makePuff(col) {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d');
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, rgba(col, 1));
      gr.addColorStop(0.45, rgba(col, 0.55));
      gr.addColorStop(1, rgba(col, 0));
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 64);
      return c;
    }

    function softEllipse(g, x, y, rx, ry, col, a) {
      g.save();
      g.translate(x, y);
      g.scale(rx / ry, 1);
      draw.glow(g, 0, 0, ry, col, a);
      g.restore();
    }

    function makeBg(w, h) {
      const { c, g } = layer(w, h);
      const sy = G.seaY;
      /* ciel du petit matin, voilé */
      const sky = g.createLinearGradient(0, 0, 0, sy + 3);
      sky.addColorStop(0, '#15322C');
      sky.addColorStop(0.45, '#2B574B');
      sky.addColorStop(0.82, '#7C9A7C');
      sky.addColorStop(1, '#C2C292');
      g.fillStyle = sky;
      g.fillRect(0, 0, w, sy + 3);
      const sx = w * 0.2, syy = sy - h * 0.1;
      draw.glow(g, sx, syy, h * 0.55, '#F2D59B', 0.32);
      draw.glow(g, sx, syy, h * 0.12, '#FFF0CC', 0.5);
      draw.glow(g, sx, syy, h * 0.03, '#FFF9EA', 0.95);
      /* nuages étirés */
      const clouds = [[0.66, 0.11, 0.2], [0.3, 0.2, 0.15], [0.86, 0.27, 0.13], [0.08, 0.31, 0.1]];
      clouds.forEach(([cx, cy, s], j) => {
        for (let i = 0; i < 6; i++) {
          const x = (cx + (i - 2.5) * s * 0.28 + Math.sin(i * 2.3 + j) * 0.02) * w;
          const y = cy * h + Math.sin(i * 1.7 + j * 3) * h * 0.008;
          const rx = s * w * rand(0.35, 0.55);
          const ry = h * rand(0.012, 0.022);
          softEllipse(g, x, y + ry * 0.6, rx, ry, '#2F5548', 0.22);
          softEllipse(g, x, y, rx, ry, '#E4E7CF', 0.2 + (cy > 0.25 ? 0.1 : 0));
        }
      });
      /* brume à l’horizon */
      const haze = g.createLinearGradient(0, sy - h * 0.06, 0, sy + 3);
      haze.addColorStop(0, 'rgba(232,226,190,0)');
      haze.addColorStop(1, 'rgba(232,226,190,0.35)');
      g.fillStyle = haze;
      g.fillRect(0, sy - h * 0.06, w, h * 0.06 + 3);

      /* mer */
      const sea = g.createLinearGradient(0, sy, 0, h);
      sea.addColorStop(0, '#2F8277');
      sea.addColorStop(0.1, '#22675F');
      sea.addColorStop(0.5, '#133F41');
      sea.addColorStop(1, '#0A2629');
      g.fillStyle = sea;
      g.fillRect(0, sy + 3, w, h - sy - 3);
      /* reflets juste sous la surface */
      for (let i = 0; i < 26; i++) {
        const x = rand(w), y = sy + 4 + Math.pow(Math.random(), 2) * h * 0.08;
        softEllipse(g, x, y, rand(10, 34) * G.U, rand(1, 2.2) * G.U, '#9FE0CC', rand(0.05, 0.14));
      }
      /* reliefs sous-marins lointains */
      g.fillStyle = rgba('#0F393A', 0.7);
      g.beginPath();
      g.moveTo(0, h);
      for (let i = 0; i <= 60; i++) {
        const x = (i / 60) * w;
        const e = Math.abs(x - G.cx) / w;
        const y = G.floorY - h * (0.025 + 0.08 * clamp(e * 2.2 - 0.2)) * (0.6 + nz.fbm(x / 60 + 40, 1, 3));
        g.lineTo(x, y);
      }
      g.lineTo(w, h);
      g.closePath();
      g.fill();
      /* assombrir les bords */
      const vig = g.createRadialGradient(w / 2, h * 0.7, h * 0.2, w / 2, h * 0.7, h * 0.85);
      vig.addColorStop(0, 'rgba(4,16,18,0)');
      vig.addColorStop(1, 'rgba(4,16,18,0.35)');
      g.fillStyle = vig;
      g.fillRect(0, sy + 3, w, h - sy);
      return c;
    }

    function makeStrata(w, h) {
      const { c, g } = layer(w, h);
      const { nx, step } = G;
      const depth = h - G.floorY + h * 0.06;
      const bands = [
        [0, '#4C4A41'], [0.12, '#36342E'], [0.27, '#4B4033'], [0.43, '#2E2C28'], [0.6, '#3F372F'], [0.79, '#28261F'],
      ];
      for (let b = 0; b < bands.length; b++) {
        const [off, col] = bands[b];
        g.beginPath();
        g.moveTo(0, h + 2);
        for (let i = 0; i < nx; i++) {
          const x = i * step;
          const y = floorLine[i] + off * depth + (b ? (nz.fbm(x / 46 + b * 7.1, b * 3.3, 3) - 0.5) * depth * 0.16 : 0);
          g.lineTo(x, y);
        }
        g.lineTo(w, h + 2);
        g.closePath();
        g.fillStyle = col;
        g.fill();
      }
      const fy = (x) => {
        const fi = clamp(x / step, 0, nx - 1.001);
        const i = Math.floor(fi);
        return lerp(floorLine[i], floorLine[i + 1], fi - i);
      };
      /* grain de la roche */
      for (let i = 0; i < 700; i++) {
        const x = rand(w);
        const y = fy(x) + 2 + Math.random() * (h - fy(x));
        g.fillStyle = Math.random() < 0.5 ? rgba('#0E0D0B', rand(0.2, 0.45)) : rgba('#8D8571', rand(0.1, 0.3));
        const s = rand(0.6, 1.8);
        g.fillRect(x, y, s, s * 0.7);
      }
      /* galets du fond */
      for (let i = 0; i < 26; i++) {
        const x = rand(w);
        const y = fy(x) + rand(0.5, 3);
        const r = rand(1.2, 3.2) * G.U;
        g.fillStyle = pick(['#57554B', '#4A473F', '#625E52']);
        g.beginPath();
        g.ellipse(x, y, r * 1.5, r, 0, 0, TAU);
        g.fill();
        g.fillStyle = rgba('#9C977F', 0.35);
        g.beginPath();
        g.ellipse(x - r * 0.3, y - r * 0.35, r * 0.7, r * 0.35, 0, 0, TAU);
        g.fill();
      }
      /* plus sombre en profondeur */
      const dk = g.createLinearGradient(0, G.floorY, 0, h);
      dk.addColorStop(0, 'rgba(8,10,10,0)');
      dk.addColorStop(1, 'rgba(8,10,10,0.45)');
      g.save();
      g.beginPath();
      g.moveTo(0, h + 2);
      for (let i = 0; i < nx; i++) g.lineTo(i * step, floorLine[i]);
      g.lineTo(w, h + 2);
      g.closePath();
      g.clip();
      g.fillStyle = dk;
      g.fillRect(0, G.floorY - h * 0.05, w, h);
      g.restore();
      /* liseré clair des sédiments */
      g.strokeStyle = rgba('#77745F', 0.6);
      g.lineWidth = 1.3;
      g.beginPath();
      for (let i = 0; i < nx; i++) {
        if (i) g.lineTo(i * step, floorLine[i] + 0.4);
        else g.moveTo(0, floorLine[0] + 0.4);
      }
      g.stroke();
      return c;
    }

    /* texture du basalte : marbrures et petites bulles de gaz figées */
    function makeGrain(w, h) {
      const s = 2;
      const gw = Math.ceil(w / s), gh = Math.ceil(h / s);
      const c0 = document.createElement('canvas');
      c0.width = gw;
      c0.height = gh;
      const g0 = c0.getContext('2d');
      const img = g0.createImageData(gw, gh);
      const d = img.data;
      for (let y = 0; y < gh; y++) {
        for (let x = 0; x < gw; x++) {
          const v = nz.fbm((x * s) / 16 + 100, (y * s) / 16, 3);
          const fine = nz.noise2((x * s) / 3 + 60, (y * s) / 3 + 20);
          const j = (y * gw + x) * 4;
          if (v > 0.52) {
            d[j] = 150; d[j + 1] = 160; d[j + 2] = 155;
            d[j + 3] = Math.min(255, (v - 0.52) * 240 + (fine > 0.8 ? 30 : 0));
          } else {
            d[j] = 0; d[j + 1] = 0; d[j + 2] = 0;
            d[j + 3] = Math.min(255, (0.52 - v) * 300 + (fine < 0.18 ? 50 : 0));
          }
        }
      }
      g0.putImageData(img, 0, 0);
      const { c, g } = layer(w, h);
      g.imageSmoothingEnabled = true;
      g.drawImage(c0, 0, 0, w, h);
      const n = Math.round((w * h) / 300);
      for (let i = 0; i < n; i++) {
        const x = rand(w), y = rand(h);
        const r = rand(0.5, 1.5) * G.U;
        g.fillStyle = rgba('#050607', 0.6);
        g.beginPath();
        g.arc(x, y, r, 0, TAU);
        g.fill();
        g.fillStyle = rgba('#9AA19C', 0.25);
        g.beginPath();
        g.arc(x + r * 0.2, y + r * 0.45, r * 0.55, 0, Math.PI);
        g.fill();
      }
      return c;
    }

    /* ---------- plantes : silhouettes pré-dessinées (nettes même zoomées) ---------- */
    function sprite(W, H) {
      const L = layer(W, H, cv.dpr * ZMAX);
      return { c: L.c, g: L.g, W, H };
    }

    /* une fronde : tige courbe garnie de folioles de part et d’autre */
    function frond(g, x0, y0, cx, cy, x1, y1, len, col, colTip, leaf, droop) {
      g.lineCap = 'round';
      g.strokeStyle = col;
      g.lineWidth = Math.max(0.6, len * 0.028);
      g.beginPath();
      g.moveTo(x0, y0);
      g.quadraticCurveTo(cx, cy, x1, y1);
      g.stroke();
      const N = Math.max(6, Math.round(len / 1.6));
      for (let j = 2; j <= N; j++) {
        const t = j / N;
        const mt = 1 - t;
        const px = mt * mt * x0 + 2 * mt * t * cx + t * t * x1;
        const py = mt * mt * y0 + 2 * mt * t * cy + t * t * y1;
        const tx = 2 * mt * (cx - x0) + 2 * t * (x1 - cx);
        const ty = 2 * mt * (cy - y0) + 2 * t * (y1 - cy);
        const tl = Math.hypot(tx, ty) || 1;
        const ax = tx / tl, ay = ty / tl;
        const ll = len * leaf * Math.sin(Math.PI * Math.min(1, t * 1.02)) * (1 - 0.25 * t) + 0.4;
        g.strokeStyle = mix(col, colTip, t * 0.85);
        g.lineWidth = Math.max(0.7, ll * 0.45);
        for (let sd = -1; sd <= 1; sd += 2) {
          g.beginPath();
          g.moveTo(px, py);
          g.lineTo(px + (-ay * sd * 0.8 + ax * 0.45) * ll, py + (ax * sd * 0.8 + ay * 0.45 + droop) * ll);
          g.stroke();
        }
      }
    }

    function spriteFern(H, seed) {
      const R = lib.makeNoise(seed).rnd;
      const sr = (a, b) => a + R() * (b - a);
      const W = H * 2.1;
      const S = sprite(W, H);
      const g = S.g;
      const bx = W / 2, by = H - 0.5;
      const n = 7;
      for (let i = 0; i < n; i++) {
        const k = i / (n - 1);
        const a = lerp(-1.25, 1.25, k) + sr(-0.1, 0.1);
        const len = H * lerp(0.98, 0.78, Math.abs(a) / 1.25) * sr(0.88, 1.02);
        const x1 = bx + Math.sin(a) * len * 1.05;
        const y1 = by - Math.cos(a) * len * 0.62 - (1 - Math.abs(a) / 1.25) * 0.25 * len;
        const cx = bx + Math.sin(a) * len * 0.4;
        const cy = by - len * 0.98;
        frond(g, bx, by, cx, cy, x1, y1, len, i % 2 ? '#376A30' : '#457F38', '#8FC46C', 0.17, 0.12);
      }
      /* une jeune crosse enroulée au centre */
      g.strokeStyle = '#7DB55A';
      g.lineWidth = Math.max(0.8, H * 0.035);
      g.beginPath();
      g.moveTo(bx, by);
      g.quadraticCurveTo(bx + H * 0.02, by - H * 0.35, bx + H * 0.08, by - H * 0.5);
      g.arc(bx + H * 0.08 - H * 0.05, by - H * 0.5, H * 0.05, 0, TAU * 0.8);
      g.stroke();
      return S;
    }

    function spriteTreeFern(H, seed) {
      const R = lib.makeNoise(seed).rnd;
      const sr = (a, b) => a + R() * (b - a);
      const W = H * 1.3;
      const S = sprite(W, H);
      const g = S.g;
      const bx = W / 2, top = H * 0.42;
      const tx = bx + sr(-0.05, 0.05) * H;
      /* tronc couvert des traces des anciennes feuilles */
      const tw = H * 0.045;
      const tg = g.createLinearGradient(tx - tw, 0, tx + tw, 0);
      tg.addColorStop(0, '#7A5E44');
      tg.addColorStop(1, '#3A2C20');
      g.fillStyle = tg;
      g.beginPath();
      g.moveTo(bx - tw * 1.3, H);
      g.quadraticCurveTo(bx - tw, (H + top) / 2, tx - tw * 0.8, top);
      g.lineTo(tx + tw * 0.8, top);
      g.quadraticCurveTo(bx + tw, (H + top) / 2, bx + tw * 1.3, H);
      g.closePath();
      g.fill();
      g.strokeStyle = rgba('#2A2018', 0.55);
      g.lineWidth = Math.max(0.6, H * 0.011);
      for (let y = top + H * 0.04; y < H - 2; y += H * 0.05) {
        const xm = lerp(tx, bx, (y - top) / (H - top));
        g.beginPath();
        g.moveTo(xm - tw * 0.8, y);
        g.quadraticCurveTo(xm, y + H * 0.02, xm + tw * 0.8, y);
        g.stroke();
      }
      /* couronne de grandes frondes arquées qui retombent */
      const n = 10;
      for (let i = 0; i < n; i++) {
        const a = lerp(-2.15, 2.15, i / (n - 1)) + sr(-0.08, 0.08);
        const len = H * sr(0.44, 0.52) * (1 - Math.abs(a) * 0.05);
        const sa = Math.sin(a), ca = Math.cos(a);
        const x1 = tx + sa * len;
        const y1 = top - ca * len * 0.6 + len * 0.25;
        const cx = tx + sa * len * 0.55;
        const cy = top - ca * len * 0.55 - len * 0.25;
        frond(g, tx, top, cx, cy, x1, y1, len, i % 2 ? '#2E5B2B' : '#3B7035', '#7DB35E', 0.15, 0.25);
      }
      g.fillStyle = '#2A4A24';
      g.beginPath();
      g.ellipse(tx, top + H * 0.01, H * 0.035, H * 0.022, 0, 0, TAU);
      g.fill();
      return S;
    }

    function spriteHorsetail(H, seed) {
      const R = lib.makeNoise(seed).rnd;
      const sr = (a, b) => a + R() * (b - a);
      const W = H * 0.8;
      const S = sprite(W, H);
      const g = S.g;
      g.lineCap = 'round';
      for (let s = 0; s < 3; s++) {
        const main = s === 1;
        const x0 = W / 2 + (s - 1) * W * 0.14;
        const hh = H * (main ? 0.97 : sr(0.62, 0.78));
        const lean = (s - 1) * W * sr(0.05, 0.1);
        const nodes = main ? 9 : 7;
        for (let i = 0; i < nodes; i++) {
          const t0 = i / nodes, t1 = (i + 1) / nodes;
          const xa = x0 + lean * t0 * t0, ya = H - hh * t0;
          const xb = x0 + lean * t1 * t1, yb = H - hh * t1;
          g.strokeStyle = main ? '#7A9C4A' : '#668C42';
          g.lineWidth = Math.max(1, lerp(H * (main ? 0.065 : 0.05), H * 0.028, t0));
          g.beginPath();
          g.moveTo(xa, ya);
          g.lineTo(xb, yb);
          g.stroke();
          /* verticille de fines branches à chaque nœud */
          if (i > 0) {
            const ll = H * (main ? 0.17 : 0.12) * (1 - t0 * 0.6);
            g.strokeStyle = rgba('#8DB75A', 0.95);
            g.lineWidth = Math.max(0.5, H * 0.011);
            for (let q = 0; q < 4; q++) {
              for (let sd = -1; sd <= 1; sd += 2) {
                const ang = sd * (0.6 + q * 0.3);
                g.beginPath();
                g.moveTo(xa, ya);
                g.quadraticCurveTo(xa + Math.sin(ang) * ll * 0.6, ya - Math.cos(ang) * ll * 0.4, xa + Math.sin(ang) * ll, ya + ll * 0.25);
                g.stroke();
              }
            }
            g.fillStyle = '#3F5E2B';
            g.fillRect(xa - H * 0.028, ya - H * 0.005, H * 0.056, H * 0.01);
          }
        }
        /* petit épi au sommet */
        const xt = x0 + lean, yt = H - hh;
        g.fillStyle = '#6A6F36';
        g.beginPath();
        g.ellipse(xt, yt - H * 0.025, H * 0.022, H * 0.045, 0, 0, TAU);
        g.fill();
      }
      return S;
    }

    function spriteConifer(H, seed) {
      const R = lib.makeNoise(seed).rnd;
      const sr = (a, b) => a + R() * (b - a);
      const W = H * 0.62;
      const S = sprite(W, H);
      const g = S.g;
      const bx = W / 2;
      g.fillStyle = '#4A3524';
      g.fillRect(bx - H * 0.022, H * 0.6, H * 0.044, H * 0.4);
      const tiers = 6;
      for (let i = 0; i < tiers; i++) {
        const t = i / tiers;
        const yb = H * (0.84 - t * 0.74);
        const wv = W * 0.5 * (1 - t * 0.72) * sr(0.88, 1.04);
        const ht = H * 0.22 * (1 - t * 0.3);
        const grd = g.createLinearGradient(bx - wv, 0, bx + wv, 0);
        grd.addColorStop(0, '#6FA463');
        grd.addColorStop(0.45, '#467D4C');
        grd.addColorStop(1, '#2A5236');
        g.fillStyle = grd;
        g.beginPath();
        g.moveTo(bx, yb - ht);
        g.quadraticCurveTo(bx + wv * 0.35, yb - ht * 0.45, bx + wv, yb + ht * 0.1);
        g.quadraticCurveTo(bx + wv * 0.4, yb - ht * 0.05, bx, yb - ht * 0.02);
        g.quadraticCurveTo(bx - wv * 0.4, yb - ht * 0.05, bx - wv, yb + ht * 0.1);
        g.quadraticCurveTo(bx - wv * 0.35, yb - ht * 0.45, bx, yb - ht);
        g.fill();
      }
      return S;
    }

    function makeSprites(h) {
      const fernH = clamp(h * 0.04, 13, 28);
      const treeH = clamp(h * 0.105, 36, 70);
      return {
        fern: [spriteFern(fernH, 3), spriteFern(fernH, 8), spriteFern(fernH, 13)],
        trees: [
          [spriteTreeFern(treeH, 5), spriteTreeFern(treeH * 0.9, 17)],
          [spriteHorsetail(treeH * 0.8, 7), spriteHorsetail(treeH * 0.72, 21)],
          [spriteConifer(treeH * 1.15, 9), spriteConifer(treeH * 1.05, 27)],
        ],
      };
    }

    cv.onResize((w, h) => layout(w, h));

    /* ---------- emplacements de végétation ---------- */
    function resetSlots() {
      slots = [];
      for (let i = 0; i < NSLOT; i++) {
        const u = lerp(-0.86, 0.86, i / (NSLOT - 1));
        const crater = Math.abs(u) < 0.2;
        const shore = Math.abs(u) > 0.8;
        slots.push({
          u,
          j: rand(-0.02, 0.02),
          stage: 0,
          cap: crater || shore ? 2 : 3,
          delay: 0,
          m: 0, f: 0, t: 0,
          tree: i % 2 === 0 ? Math.random() < 0.85 : Math.random() < 0.2,
          kind: i % 3,
          v: randInt(0, 1),
          fv: randInt(0, 2),
          sc: rand(0.82, 1.12),
          ph: rand(TAU),
          moss: [rand(-0.4, 0.4), rand(-0.4, 0.4), rand(-0.4, 0.4)].map((o) => ({ o, r: rand(1.8, 3.2), c: pick(MOSS) })),
        });
      }
      /* mélange des espèces d’arbres */
      for (let i = slots.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const k = slots[i].kind;
        slots[i].kind = slots[j].kind;
        slots[j].kind = k;
      }
    }

    function nearestSlot(u) {
      let best = 0, bd = Infinity;
      for (let i = 0; i < slots.length; i++) {
        const d = Math.abs(slots[i].u - u);
        if (d < bd) { bd = d; best = i; }
      }
      return best;
    }

    /* ---------- sol ---------- */
    function addSoil(u, amp, sigma, delay, dur) {
      const wts = new Float32Array(NSOIL);
      for (let s = 0; s < NSOIL; s++) {
        const q = (soilU[s] - u) / sigma;
        wts[s] = amp * Math.exp(-q * q);
      }
      soilSrc.push({ wts, t0: time, delay: delay || 0, dur: dur || 3.2 });
    }

    function updateSoil() {
      soil.fill(0);
      for (const src of soilSrc) {
        const g = ease.outCubic(clamp((time - src.t0 - src.delay) / src.dur));
        if (g <= 0) continue;
        for (let s = 0; s < NSOIL; s++) soil[s] += src.wts[s] * g;
      }
      for (let s = 0; s < NSOIL; s++) if (soil[s] > 12) soil[s] = 12;
      /* tapis de mousse */
      for (let s = 0; s < NSOIL; s++) {
        let gr = 0;
        const u = soilU[s];
        for (const sl of slots) {
          if (sl.m <= 0) continue;
          const q = (u - sl.u) / 0.075;
          const v = sl.m * Math.exp(-q * q);
          if (v > gr) gr = v;
        }
        green[s] = gr;
      }
    }

    /* ---------- initialisation ---------- */
    function init() {
      phase = 1;
      taps = 0;
      level = 0;
      emerged = false;
      emergeT = 0;
      patches = [];
      soilSrc = [];
      steps = 0;
      finished = false;
      finaleTick = 0;
      lavaHeat = 0;
      conduitHeat = 0.55;
      chamber = 0.55;
      vent = 0;
      eruptT = 9;
      ambientT = 0;
      smokeT = 0;
      misses = 0;
      solTimer = -1;
      lastPatchT = 0;
      pendingGesture = false;
      zoomK = 0;
      updateCam();
      heat.fill(0);
      soil.fill(0);
      green.fill(0);
      bubbles = []; trail = []; plume = []; bombs = []; steam = []; smoke = []; sparks = []; rings = []; flashes = []; pops = [];
      resetSlots();
      computeOuter();
      api.gesture('tap', { x: 50, y: 80 });
    }

    function gestureOnIsland(u) {
      const x = ux(u);
      const y = Math.min(surfYAt(x), G.seaY) - 5;
      api.gesture('tap', { x: ((x * cam.s + cam.x) / G.w) * 100, y: ((y * cam.s + cam.y) / G.h) * 100 });
    }

    /* ---------- interaction ---------- */
    function erupt(x, y) {
      taps++;
      heat[taps] = 1;
      chamber = 1.4;
      vent = 1;
      eruptT = 0;
      /* les bulles partent de l’eau, même si la tape tombe un peu au-dessus */
      const oy = Math.max(y, G.seaY + 14);
      rings.push({ x, y, t: 0, dur: 0.7, col: '#FFD08E', r0: 5, r1: 44 * G.U, w: 2 });
      flashes.push({ x, y: oy, t: 0, dur: 0.6, r: 36 * G.U });
      const vx = G.cx, vy = ventY();
      for (let i = 0; i < 13; i++) {
        trail.push({
          x0: x + rand(-9, 9), y0: oy + rand(-9, 9),
          x1: vx + rand(-5, 5), y1: vy + rand(-2, 6),
          t: -i * 0.03, dur: rand(0.42, 0.7),
          r: rand(1.4, 3.4) * G.U, bend: rand(-0.4, 0.4),
        });
      }
      api.sfx.play('thud', { pitch: rand(0.85, 1.1) });
      api.sfx.play('rumble', { gap: 260, volume: 0.75 });
      api.buzz(10);
      api.progress((taps / ERUPTIONS) * 0.35);
      api.status(taps >= ERUPTIONS - 2 ? TEXTES.presque : TEXTES.eruption);
    }

    function nearestSurface(px, py) {
      if (iL < 0) return null;
      let best = -1, bd = Infinity;
      for (let i = iL; i <= iR; i++) {
        const dx = i * G.step - px, dy = outer[i] - py;
        const d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = i; }
      }
      const R = Math.max(50, Math.min(G.w, G.h) * 0.18);
      if (best < 0 || bd > R * R) return null;
      const x = best * G.step;
      return { x, y: outer[best], u: clamp((x - G.cx) / G.half, G.u0 + 0.06, G.u1 - 0.06) };
    }

    function miss(x, y) {
      rings.push({ x, y, t: 0, dur: 0.5, col: '#DDE8DA', r0: 4, r1: 20 * G.U, w: 1.5 });
      api.sfx.play('tick', { pitch: 0.7, volume: 0.5 });
      if (!finished) api.status(TEXTES.rate);
      misses++;
      if (misses >= 2) {
        misses = 0;
        gestureOnIsland(phase === 2 ? -0.45 : 0.45);
      }
    }

    function burst(x, y, cols, n, spd) {
      for (let i = 0; i < n; i++) {
        if (sparks.length > 140) break;
        const a = rand(-Math.PI * 0.95, -Math.PI * 0.05);
        const v = rand(0.4, 1) * spd * G.U;
        sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, dur: rand(0.45, 0.8), r: rand(0.9, 1.9) * G.U, col: pick(cols) });
      }
    }

    /* place libre la plus proche pour une nouvelle tache (hors du cratère encore chaud) */
    function freeU(u) {
      const lo = G.u0 + 0.12, hi = G.u1 - 0.12;
      u = clamp(u, lo, hi);
      if (Math.abs(u) < 0.22) u = u < 0 ? -0.25 : 0.25;
      let best = u, bd = Infinity;
      for (let c = lo; c <= hi; c += 0.02) {
        if (Math.abs(c) < 0.22) continue;
        let ok = true;
        for (const p of patches) if (Math.abs(p.u - c) < 0.15) { ok = false; break; }
        if (!ok) continue;
        const dd = Math.abs(c - u);
        if (dd < bd) { bd = dd; best = c; }
      }
      return bd < 0.35 ? best : u;
    }

    function sowLichen(hit) {
      misses = 0;
      const u = freeU(hit.u);
      const span = rand(0.1, 0.13);
      const discs = [];
      const n = randInt(15, 21);
      for (let i = 0; i < n; i++) {
        const du = (Math.random() * 2 - 1) * span * Math.sqrt(Math.random());
        const big = Math.random() < 0.3;
        const col = pick(LICHEN);
        discs.push({
          du,
          r: big ? rand(3.2, 5) : rand(1.8, 3.2),
          lift: rand(-0.15, 0.3),
          sq: rand(0.5, 0.68),
          col,
          rim: mix(col, '#FFF4D6', 0.3, 0.55),
          dotCol: mix(col, '#4A2E12', 0.55),
          dot: Math.random() < 0.4,
          delay: rand(0, 0.4) + (Math.abs(du) / span) * 0.35,
        });
      }
      discs.sort((a, b) => b.r - a.r);
      patches.push({ u, span, discs, t0: time });
      addSoil(u, 8, span * 1.3, 0.5, 3.4);
      const x = ux(u), y = surfYAt(x);
      rings.push({ x, y, t: 0, dur: 0.55, col: '#F3D08A', r0: 4, r1: 24 * G.U, w: 2 });
      burst(x, y - 2, LICHEN, 10, 55);
      api.sfx.play('pop', { pitch: rand(0.9, 1.3) });
      api.buzz(8);
      lastPatchT = time;
      if (phase === 2) {
        const n2 = Math.min(PATCHES, patches.length);
        api.progress(0.35 + 0.3 * (n2 / PATCHES));
        api.status(TEXTES.lichens(n2, PATCHES));
        solTimer = n2 >= PATCHES ? 0.9 : 1.6;
      }
    }

    function bumpSlot(j, v, delay) {
      const s = slots[j];
      v = Math.min(s.cap, v);
      if (v > s.stage) {
        s.stage = v;
        s.delay = delay;
        return true;
      }
      return false;
    }

    /* une tape fait avancer la végétation à cet endroit (et un peu ailleurs) */
    function advance(u) {
      let c = nearestSlot(u);
      if (slots[c].stage >= slots[c].cap) {
        let best = -1, bd = 99;
        for (let j = 0; j < slots.length; j++) {
          if (slots[j].stage < slots[j].cap && Math.abs(j - c) < bd) { bd = Math.abs(j - c); best = j; }
        }
        if (best < 0 || bd > 4) return { c, ns: slots[c].stage };
        c = best;
      }
      const ns = Math.min(slots[c].cap, slots[c].stage + 1);
      bumpSlot(c, ns, 0);
      for (let d = 1; d <= 3; d++) {
        const v = d === 1 ? ns : ns - 1;
        if (c - d >= 0) bumpSlot(c - d, v, d * 0.09);
        if (c + d < slots.length) bumpSlot(c + d, v, d * 0.09);
      }
      /* la vie gagne aussi, doucement, le reste de l’île */
      let low = -1;
      for (let j = 0; j < slots.length; j++) {
        if (slots[j].stage < slots[j].cap && (low < 0 || slots[j].stage < slots[low].stage)) low = j;
      }
      if (low >= 0 && Math.abs(low - c) > 3) bumpSlot(low, slots[low].stage + 1, 0.5);
      addSoil(slots[c].u, 3.5, 0.2, 0, 1.6);
      return { c, ns };
    }

    function plant(hit) {
      misses = 0;
      const u = Math.abs(hit.u) < 0.16 ? (hit.u < 0 ? -0.2 : 0.2) : hit.u;
      const { c, ns } = advance(u);
      const s = slots[c];
      const x = ux(s.u), y = surfYAt(x);
      rings.push({ x, y, t: 0, dur: 0.55, col: '#BDE59A', r0: 4, r1: 26 * G.U, w: 2 });
      burst(x, y - 3, ['#9AD27C', '#C8EAA4', '#6FAE4F'], 9, 50);
      api.sfx.play('tick', { pitch: 1 + 0.15 * Math.max(1, ns) });
      api.buzz(8);
      if (finished) return;
      steps++;
      api.status(ns >= 3 && s.tree ? TEXTES.arbre : ns >= 2 ? TEXTES.fougere : TEXTES.mousse);
      api.progress(0.65 + 0.35 * Math.min(1, steps / STEPS));
      if (steps >= STEPS) {
        finished = true;
        finaleTick = 0;
        api.done(TEXTES.fin, TEXTES.finStatut);
      }
    }

    function onTap(sx, sy) {
      const x = (sx - cam.x) / cam.s;
      const y = (sy - cam.y) / cam.s;
      if (phase === 1) {
        if (taps < ERUPTIONS) erupt(x, y);
        else rings.push({ x, y, t: 0, dur: 0.5, col: '#FFD08E', r0: 4, r1: 20 * G.U, w: 1.5 });
        return;
      }
      const hit = nearestSurface(x, y);
      if (!hit) {
        miss(x, y);
        return;
      }
      if (phase === 2) sowLichen(hit);
      else plant(hit);
    }

    api.track(cv.canvas, {
      up(p, e, cancelled) {
        if (!cancelled && p.tap) onTap(p.x, p.y);
      },
    }, { touchAction: 'pan-y' });

    /* ---------- phases ---------- */
    function onEmerge() {
      emergeT = 0;
      lavaHeat = 1;
      const vy = ventY();
      for (let i = 0; i < 46; i++) {
        const x = lerp(ux(G.u0), ux(G.u1), Math.random());
        steam.push({ x, y: G.seaY - rand(0, 4), vx: rand(-10, 10) * G.U, vy: -rand(14, 34) * G.U, r: rand(5, 11) * G.U, gr: rand(6, 12) * G.U, t: -rand(0, 0.8), dur: rand(2.4, 4), a: rand(0.35, 0.6) });
      }
      for (let i = 0; i < 3; i++) pops.push({ x: G.cx, y: G.seaY, t: -i * 0.25, dur: 1.8, r0: G.half * 0.95, r1: G.w * 0.75, big: true });
      for (let i = 0; i < 10; i++) {
        const a = rand(-Math.PI * 0.8, -Math.PI * 0.2);
        const v = rand(60, 120) * G.U;
        bombs.push({ x: G.cx + rand(-4, 4), y: vy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, heat: 1, r: rand(1.2, 2.4) * G.U });
      }
      api.sfx.play('rumble', { pitch: 0.8, gap: 0 });
      api.sfx.play('splash', { gap: 0 });
      api.buzz(16);
      api.status(TEXTES.ile);
    }

    function startPhase2() {
      phase = 2;
      api.hint(TEXTES.hint2);
      api.gesture(null);
      pendingGesture = true;
    }

    function startPhase3() {
      phase = 3;
      if (solTimer > 0) api.status(TEXTES.sol);
      solTimer = -1;
      api.hint(TEXTES.hint3);
      api.progress(0.65);
      gestureOnIsland(0.45);
    }

    /* ---------- animation ---------- */
    function spawnBubble(x, y, big) {
      if (bubbles.length > 140) return;
      bubbles.push({ x, y, vy: -rand(26, 52) * G.U, r: (big ? rand(1.8, 3.6) : rand(0.9, 2)) * G.U, ph: rand(TAU), wob: rand(0.6, 1.6) });
    }

    function stepParticles(arr, dt, damp) {
      let m = 0;
      for (const p of arr) {
        p.t += dt;
        if (p.t < 0) { arr[m++] = p; continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy *= Math.pow(damp, dt);
        if (p.t < p.dur) arr[m++] = p;
      }
      arr.length = m;
    }

    function age(arr, dt) {
      let m = 0;
      for (const r of arr) {
        r.t += dt;
        if (r.t < r.dur) arr[m++] = r;
      }
      arr.length = m;
    }

    function update(dt) {
      time += dt;
      /* croissance du volcan */
      if (level < taps) {
        level += (taps - level) * (1 - Math.exp(-dt * 2.8)) + dt * 0.06;
        if (level > taps) level = taps;
        computeOuter();
      }
      for (let k = 0; k <= ERUPTIONS; k++) if (heat[k] > 0) heat[k] = Math.max(0, heat[k] - dt / 2.7);
      if (!emerged && taps >= ERUPTIONS && topY() < G.seaY - 1) {
        emerged = true;
        onEmerge();
      }
      if (emerged) emergeT += dt;
      if (phase === 1 && emerged && level >= ERUPTIONS - 0.02 && emergeT > 0.9) startPhase2();
      if (phase >= 2 && zoomK < 1) {
        zoomK = CALM ? 1 : Math.min(1, zoomK + dt / 1.8);
        updateCam();
        if (zoomK >= 1) {
          if (pendingGesture && !patches.length) gestureOnIsland(-0.45);
          pendingGesture = false;
        }
      }
      if (phase === 2 && patches.length >= PATCHES && time - lastPatchT > 2.4) startPhase3();
      if (solTimer > 0) {
        solTimer -= dt;
        if (solTimer <= 0 && phase === 2) api.status(TEXTES.sol);
      }

      /* chaleur : le volcan s’endort peu à peu */
      let lavaT = 0;
      if (emerged) {
        if (phase <= 2) lavaT = 0.9;
        else lavaT = finished ? 0 : lerp(0.6, 0.15, steps / STEPS);
      }
      lavaHeat += (lavaT - lavaHeat) * (1 - Math.exp(-dt * 0.5));
      const cT = emerged ? 0.1 + lavaHeat * 0.6 : 0.62;
      conduitHeat += (cT - conduitHeat) * (1 - Math.exp(-dt * 0.8));
      chamber += ((emerged ? 0.25 + lavaHeat * 0.4 : 0.58) - chamber) * (1 - Math.exp(-dt * 1.5));
      vent = Math.max(0, vent - dt * 0.8);

      /* éruption en cours : panache, bulles, bombes de lave */
      const vx = G.cx, vy = ventY();
      if (eruptT < 1.5) {
        const prev = eruptT;
        eruptT += dt;
        if (!emerged || eruptT < 0.4) {
          const rate = 30 * (1 - eruptT / 1.5);
          for (let i = 0; i < rate * dt * 2; i++) {
            if (plume.length < 120 && Math.random() < 0.55) {
              plume.push({ x: vx + rand(-4, 4) * G.U, y: vy - 2, vx: rand(-10, 10) * G.U, vy: -rand(24, 46) * G.U, r: rand(5, 9) * G.U, gr: rand(16, 30) * G.U, t: 0, dur: rand(2.4, 3.6), a: rand(0.45, 0.65) });
            }
            if (Math.random() < 0.6) spawnBubble(vx + rand(-6, 6) * G.U, vy - 3, Math.random() < 0.4);
          }
        }
        if (prev < 0.12 && eruptT >= 0.12) {
          for (let i = 0; i < 9; i++) {
            const a = rand(-Math.PI * 0.85, -Math.PI * 0.15);
            const v = rand(30, 70) * G.U;
            bombs.push({ x: vx + rand(-3, 3), y: vy - 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, heat: 1, r: rand(1.1, 2.3) * G.U });
          }
        }
      }
      /* bulles d’ambiance au sommet du volcan, tant qu’il est sous l’eau */
      ambientT += dt;
      if (!emerged && ambientT > (CALM ? 1.4 : 0.55)) {
        ambientT = 0;
        spawnBubble(vx + rand(-5, 5) * G.U, vy - 2, Math.random() < 0.3);
      }
      /* fumée du cratère */
      if (emerged) {
        smokeT += dt;
        const every = lerp(1.6, 0.16, lavaHeat);
        if (lavaHeat > 0.03 && smokeT > every && smoke.length < 60) {
          smokeT = 0;
          smoke.push({ x: vx + rand(-G.crater * 0.5, G.crater * 0.5), y: vy - 2, vx: rand(4, 11) * G.U, vy: -rand(12, 22) * G.U, r: rand(4, 7) * G.U, gr: rand(14, 24) * G.U, t: 0, dur: rand(3.5, 5.5), a: rand(0.24, 0.4) * clamp(lavaHeat * 1.4) });
        }
      }

      /* particules */
      let n = 0;
      for (const b of bubbles) {
        b.y += b.vy * dt;
        b.x += Math.sin(time * 5 * b.wob + b.ph) * 8 * dt * G.U;
        if (b.y > G.seaY + 2) bubbles[n++] = b;
        else if (pops.length < 30) pops.push({ x: b.x, y: G.seaY, t: 0, dur: 0.5, r0: 1, r1: b.r * 4 });
      }
      bubbles.length = n;
      n = 0;
      for (const p of trail) {
        p.t += dt / p.dur;
        if (p.t < 1) trail[n++] = p;
      }
      trail.length = n;
      n = 0;
      for (const p of plume) {
        p.t += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy *= Math.pow(0.55, dt);
        if (p.y < G.seaY + 14) {
          p.y = G.seaY + 14;
          p.vx *= 1 + dt * 2;
        }
        if (p.t < p.dur) plume[n++] = p;
      }
      plume.length = n;
      n = 0;
      for (const b of bombs) {
        b.t += dt;
        const under = b.y > G.seaY;
        b.vy += (under ? 55 : 150) * G.U * dt;
        const drag = Math.pow(under ? 0.25 : 0.8, dt);
        b.vx *= drag;
        b.vy *= drag;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.heat = Math.max(0, b.heat - dt * (under ? 0.9 : 0.5));
        if (b.y < surfYAt(b.x) && b.t < 4) bombs[n++] = b;
      }
      bombs.length = n;
      stepParticles(steam, dt, 0.75);
      stepParticles(smoke, dt, 0.75);
      n = 0;
      for (const s of sparks) {
        s.t += dt;
        s.vy += 90 * G.U * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        if (s.t < s.dur) sparks[n++] = s;
      }
      sparks.length = n;
      age(rings, dt);
      age(flashes, dt);
      age(pops, dt);
      if (!CALM) {
        for (const s of snow) {
          s.y += s.v * dt * G.U;
          s.x += Math.sin(time * 0.4 + s.ph) * 3 * dt;
          if (s.y > G.floorY) {
            s.y = G.seaY + 4;
            s.x = rand(G.w);
          }
        }
      }

      /* végétation */
      for (const s of slots) {
        if (s.stage <= 0) continue;
        if (s.delay > 0) { s.delay -= dt; continue; }
        if (s.stage >= 1) s.m = Math.min(1, s.m + dt / 0.6);
        if (s.stage >= 2) s.f = Math.min(1, s.f + dt / 0.75);
        if (s.stage >= 3) s.t = Math.min(1, s.t + dt / 0.95);
      }
      if (emerged) updateSoil();
      /* après la réussite, la végétation finit de couvrir l’île */
      if (finished) {
        finaleTick += dt;
        while (finaleTick > 0.14) {
          finaleTick -= 0.14;
          growRandom();
        }
      }
    }

    function growRandom() {
      let pickI = -1, cnt = 0;
      for (let i = 0; i < slots.length; i++) {
        if (slots[i].stage < slots[i].cap) {
          cnt++;
          if (Math.random() * cnt < 1) pickI = i;
        }
      }
      if (pickI < 0) return;
      const s = slots[pickI];
      s.stage++;
      addSoil(s.u, 3, 0.12, 0, 2);
    }

    /* ---------- dessin ---------- */
    function pathProfile(arr) {
      ctx.beginPath();
      ctx.moveTo(0, G.h + 2);
      for (let i = 0; i < G.nx; i++) ctx.lineTo(i * G.step, arr[i]);
      ctx.lineTo(G.w, G.h + 2);
      ctx.closePath();
    }

    function strokeTop(arr, onlyAbove) {
      ctx.beginPath();
      let on = false;
      for (let i = 0; i < G.nx; i++) {
        const y = arr[i];
        const ok = onlyAbove ? y < G.seaY - 0.5 : y < floorLine[i] - 1;
        if (ok) {
          if (!on) ctx.moveTo(i * G.step, y);
          else ctx.lineTo(i * G.step, y);
          on = true;
        } else {
          on = false;
        }
      }
      ctx.stroke();
    }

    function drawRays() {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = rayGrad;
      for (let i = 0; i < 4; i++) {
        const sway = CALM ? 0 : Math.sin(time * 0.23 + i * 1.7) * G.w * 0.03;
        const x0 = G.w * (0.1 + i * 0.27) + sway;
        const top = G.seaY + 3, bot = G.floorY;
        const wt = G.w * 0.03, wb = G.w * 0.085, sl = G.w * 0.1;
        ctx.beginPath();
        ctx.moveTo(x0 - wt, top);
        ctx.lineTo(x0 + wt, top);
        ctx.lineTo(x0 + sl + wb, bot);
        ctx.lineTo(x0 + sl - wb, bot);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    function waveY(x) {
      if (CALM) return G.seaY + Math.sin(x * 0.09) * 0.8;
      return G.seaY + Math.sin(x * 0.085 - time * 1.4) * 1.3 + Math.sin(x * 0.21 + time * 0.9) * 0.6;
    }

    function drawWaterBand() {
      ctx.fillStyle = '#2F8277';
      ctx.beginPath();
      ctx.moveTo(0, G.seaY + 5);
      for (let x = 0; x <= G.w + 4; x += 6) ctx.lineTo(x, waveY(x));
      ctx.lineTo(G.w, G.seaY + 5);
      ctx.closePath();
      ctx.fill();
    }

    function drawVolcano() {
      const kTop = Math.min(ERUPTIONS, Math.ceil(level - 0.0005));
      for (let k = kTop; k >= 0; k--) {
        const arr = k === kTop ? outer : prof[k];
        pathProfile(arr);
        ctx.fillStyle = heat[k] > 0.01 ? mix(BASALT[k], '#B83A1A', Math.pow(heat[k], 0.9)) : BASALT[k];
        ctx.fill();
      }
      /* limites des coulées : fins liserés roux */
      ctx.lineWidth = Math.max(1, G.U * 0.9);
      ctx.strokeStyle = rgba('#7E4636', 0.5);
      for (let k = kTop - 1; k >= 0; k--) strokeTop(prof[k], false);
      /* texture du basalte */
      ctx.save();
      pathProfile(outer);
      ctx.clip();
      ctx.globalAlpha = 0.85;
      ctx.drawImage(grain, 0, 0, G.w, G.h);
      ctx.globalAlpha = 1;
      ctx.restore();
      /* voile de l’eau sur la partie immergée */
      pathProfile(outer);
      ctx.fillStyle = veilGrad;
      ctx.fill();
      /* lave fraîche qui rougeoie */
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 1; k <= kTop; k++) {
        const hk = heat[k];
        if (hk < 0.02) continue;
        const outerArr = k === kTop ? outer : prof[k];
        const inner = prof[k - 1];
        ctx.beginPath();
        ctx.moveTo(0, outerArr[0]);
        for (let i = 1; i < G.nx; i++) ctx.lineTo(i * G.step, outerArr[i]);
        for (let i = G.nx - 1; i >= 0; i--) ctx.lineTo(i * G.step, inner[i]);
        ctx.closePath();
        ctx.fillStyle = rgba('#FF5A1E', 0.45 * hk);
        ctx.fill();
        ctx.strokeStyle = rgba('#FFC27A', 0.75 * hk);
        ctx.lineWidth = 1.6 * G.U;
        strokeTop(outerArr, false);
      }
      ctx.globalCompositeOperation = 'source-over';
      /* lumière du ciel sur la roche émergée */
      if (emerged) {
        ctx.strokeStyle = rgba('#A3B1A8', 0.45);
        ctx.lineWidth = 1.1;
        strokeTop(outer, true);
      }
    }

    function drawMagma() {
      const { w, h, cx } = G;
      const rx = Math.min(w * 0.2, h * 0.27), ry = h * 0.075;
      const cy = h + ry * 0.25;
      const a = clamp(chamber, 0, 1.5);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, ry / rx);
      const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      gr.addColorStop(0, rgba('#FFC060', clamp(0.75 * a)));
      gr.addColorStop(0.5, rgba('#E2531F', clamp(0.7 * a)));
      gr.addColorStop(0.85, rgba('#8E2A14', clamp(0.55 * a)));
      gr.addColorStop(1, 'rgba(90,24,12,0)');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(0, 0, rx, 0, TAU);
      ctx.fill();
      ctx.restore();
      /* cheminée */
      const vy = ventY() + 2;
      const wd = Math.max(3, h * 0.01);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(cx, h + 2);
      for (let y = h; y > vy; y -= 8) ctx.lineTo(cx + (nz.noise2(y / 20, 4.4) - 0.5) * 6 * G.U, y);
      ctx.lineTo(cx, vy);
      const ch = clamp(conduitHeat + vent * 0.4);
      ctx.strokeStyle = mix('#3A2522', '#F06A26', ch);
      ctx.lineWidth = wd;
      ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba('#FF8A3A', 0.25 * ch);
      ctx.lineWidth = wd * 2.8;
      ctx.stroke();
      ctx.strokeStyle = rgba('#FFE0A0', 0.45 * ch * ch);
      ctx.lineWidth = wd * 0.4;
      ctx.stroke();
      /* lueur à la bouche du volcan sous-marin */
      if (!emerged) {
        const pulse = CALM ? 0.3 : 0.26 + 0.08 * Math.sin(time * 2.2);
        const ga = clamp(pulse + vent * 0.8);
        const r = (18 + 34 * vent) * G.U;
        ctx.globalAlpha = ga;
        ctx.drawImage(PUFF.glow, cx - r, vy - r, r * 2, r * 2);
        ctx.globalAlpha = 1;
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    function soilPath(scale) {
      ctx.beginPath();
      for (let s = 0; s < NSOIL; s++) {
        const x = ux(soilU[s]);
        const y = surfYAt(x) - 0.3;
        if (s) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      for (let s = NSOIL - 1; s >= 0; s--) {
        const x = ux(soilU[s]);
        ctx.lineTo(x, surfYAt(x) + soil[s] * G.U * scale);
      }
      ctx.closePath();
    }

    function drawSoil() {
      let any = false;
      for (let s = 0; s < NSOIL; s++) if (soil[s] > 0.05) { any = true; break; }
      if (!any) return;
      /* trois horizons : roche altérée rousse, terre brune, humus sombre */
      soilPath(1);
      ctx.fillStyle = rgba('#7A4A2A', 0.9);
      ctx.fill();
      soilPath(0.66);
      ctx.fillStyle = '#5C3A22';
      ctx.fill();
      soilPath(0.3);
      ctx.fillStyle = '#41291A';
      ctx.fill();
      ctx.fillStyle = rgba('#C29563', 0.55);
      for (let s = 2; s < NSOIL; s += 3) {
        if (soil[s] < 3) continue;
        const x = ux(soilU[s]) + ((s * 7) % 5) - 2;
        ctx.fillRect(x, surfYAt(x) + soil[s] * G.U * (0.5 + ((s * 13) % 7) / 16), 1.1, 0.9);
      }
    }

    function drawLichens() {
      const U = G.U;
      for (const p of patches) {
        const age = time - p.t0;
        const cr = clamp(age / 1.1);
        if (cr > 0) {
          ctx.strokeStyle = rgba('#C98A34', 0.65 * cr);
          ctx.lineWidth = 2.2 * U;
          ctx.lineCap = 'round';
          ctx.beginPath();
          const u0 = p.u - p.span * cr, u1 = p.u + p.span * cr;
          for (let s = 0; s <= 10; s++) {
            const x = ux(lerp(u0, u1, s / 10));
            const y = surfYAt(x) + 0.4;
            if (s) ctx.lineTo(x, y);
            else ctx.moveTo(x, y);
          }
          ctx.stroke();
        }
        for (const d of p.discs) {
          const k = clamp((age - d.delay) / 0.4);
          if (k <= 0) continue;
          const sc = ease.outBack(k);
          const x = ux(p.u + d.du);
          const r = d.r * U * sc;
          const y = surfYAt(x) - d.r * U * d.lift;
          const rot = slopeAt(x);
          /* croûte plate et lobée, à la marge plus claire */
          ctx.fillStyle = d.rim;
          ctx.beginPath();
          ctx.ellipse(x, y, r * 1.12, r * d.sq * 1.12, rot, 0, TAU);
          ctx.fill();
          ctx.fillStyle = d.col;
          ctx.beginPath();
          ctx.ellipse(x, y, r, r * d.sq, rot, 0, TAU);
          ctx.fill();
          if (d.dot) {
            ctx.fillStyle = d.dotCol;
            ctx.beginPath();
            ctx.ellipse(x + r * 0.2, y - r * 0.08, Math.max(0.6, r * 0.26), Math.max(0.5, r * 0.18), rot, 0, TAU);
            ctx.fill();
          }
        }
      }
    }

    function drawMossCarpet() {
      let any = false;
      for (let s = 0; s < NSOIL; s++) if (green[s] > 0.02) { any = true; break; }
      if (!any) return;
      const T = 2.8 * G.U;
      ctx.beginPath();
      for (let s = 0; s < NSOIL; s++) {
        const x = ux(soilU[s]);
        const bump = 0.75 + 0.25 * Math.sin(s * 2.1) + 0.15 * Math.sin(s * 4.7 + 1);
        const y = surfYAt(x) - green[s] * T * bump;
        if (s) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      for (let s = NSOIL - 1; s >= 0; s--) {
        const x = ux(soilU[s]);
        ctx.lineTo(x, surfYAt(x) + green[s] * 1.4 * G.U);
      }
      ctx.closePath();
      ctx.fillStyle = '#4C7D34';
      ctx.fill();
      ctx.strokeStyle = rgba('#93C762', 0.85);
      ctx.lineWidth = 1.1 * G.U;
      ctx.beginPath();
      let on = false;
      for (let s = 0; s < NSOIL; s++) {
        if (green[s] < 0.15) { on = false; continue; }
        const x = ux(soilU[s]);
        const bump = 0.75 + 0.25 * Math.sin(s * 2.1) + 0.15 * Math.sin(s * 4.7 + 1);
        const y = surfYAt(x) - green[s] * T * bump + 0.5;
        if (!on) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        on = true;
      }
      ctx.stroke();
    }

    function drawPlants() {
      const U = G.U;
      /* arbres au fond, puis fougères, puis mousses au ras du sol */
      for (const s of slots) {
        if (!s.tree || s.t <= 0) continue;
        const spr = sp.trees[s.kind][s.v];
        const sc = s.sc * ease.outBack(s.t);
        const x = ux(s.u + s.j);
        const y = surfYAt(x) + 1.5 * U;
        const sw = CALM ? 0 : Math.sin(time * 0.9 + s.ph) * 0.025;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(sw);
        ctx.drawImage(spr.c, (-spr.W * sc) / 2, -spr.H * sc, spr.W * sc, spr.H * sc);
        ctx.restore();
      }
      for (const s of slots) {
        if (s.f <= 0) continue;
        const spr = sp.fern[s.fv];
        const big = s.stage >= 3 && !s.tree ? 1.25 : 1;
        const sc = big * (0.85 + 0.25 * s.sc) * ease.outBack(s.f);
        const x = ux(s.u - s.j);
        const y = surfYAt(x) + 1.2 * U;
        ctx.drawImage(spr.c, x - (spr.W * sc) / 2, y - spr.H * sc, spr.W * sc, spr.H * sc);
      }
      const step = (G.half * 1.72) / (NSLOT - 1);
      for (const s of slots) {
        if (s.m <= 0) continue;
        const k = ease.outBack(s.m);
        for (const c of s.moss) {
          const x = ux(s.u) + c.o * step * 1.6;
          const y = surfYAt(x) - 1.6 * U * s.m;
          const r = c.r * U * k;
          ctx.fillStyle = c.c;
          ctx.beginPath();
          ctx.ellipse(x, y - r * 0.3, r * 1.25, r * 0.8, slopeAt(x), 0, TAU);
          ctx.fill();
          ctx.fillStyle = rgba('#B6E08C', 0.55);
          ctx.beginPath();
          ctx.ellipse(x - r * 0.35, y - r * 0.75, r * 0.45, r * 0.25, 0, 0, TAU);
          ctx.fill();
        }
      }
    }

    function drawUnderFx() {
      /* lueur à l’endroit tapé */
      ctx.globalCompositeOperation = 'lighter';
      for (const f of flashes) {
        const k = f.t / f.dur;
        ctx.globalAlpha = (1 - k) * 0.85;
        const r = f.r * (0.6 + k * 0.6);
        ctx.drawImage(PUFF.glow, f.x - r, f.y - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      /* panache de cendres */
      for (const p of plume) {
        const k = p.t / p.dur;
        const r = p.r + p.gr * ease.outCubic(k);
        ctx.globalAlpha = p.a * (k < 0.12 ? k / 0.12 : 1 - (k - 0.12) / 0.88);
        ctx.drawImage(PUFF.ash, p.x - r, p.y - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
      /* bulles qui filent vers le volcan */
      for (const p of trail) {
        if (p.t <= 0) continue;
        const t = ease.inOutSine(clamp(p.t));
        const mx = (p.x0 + p.x1) / 2 - (p.y1 - p.y0) * p.bend;
        const my = (p.y0 + p.y1) / 2 + (p.x1 - p.x0) * p.bend;
        const mt = 1 - t;
        const x = mt * mt * p.x0 + 2 * mt * t * mx + t * t * p.x1;
        const y = mt * mt * p.y0 + 2 * mt * t * my + t * t * p.y1;
        const r = p.r * (1 - t * 0.5);
        ctx.strokeStyle = rgba('#D9FBEF', 0.8 * (1 - t * 0.6));
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.stroke();
        ctx.fillStyle = rgba('#FFFFFF', 0.6 * (1 - t * 0.6));
        ctx.fillRect(x - r * 0.45, y - r * 0.5, r * 0.4, r * 0.4);
      }
      /* bulles qui montent */
      ctx.strokeStyle = 'rgba(214,250,238,0.7)';
      ctx.lineWidth = 0.9;
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      for (const b of bubbles) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, TAU);
        ctx.stroke();
        ctx.fillRect(b.x - b.r * 0.5, b.y - b.r * 0.55, b.r * 0.45, b.r * 0.45);
      }
      /* bombes de lave */
      ctx.globalCompositeOperation = 'lighter';
      for (const b of bombs) {
        ctx.fillStyle = b.heat > 0.5 ? mix('#FF6A2A', '#FFE08A', (b.heat - 0.5) * 2) : mix('#3A1A12', '#FF6A2A', b.heat * 2);
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, TAU);
        ctx.fill();
        if (b.heat > 0.2) {
          ctx.globalAlpha = b.heat * 0.5;
          const r = b.r * 5;
          ctx.drawImage(PUFF.glow, b.x - r, b.y - r, r * 2, r * 2);
          ctx.globalAlpha = 1;
        }
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    function drawSurface() {
      const isl = emerged && iL >= 0;
      const xa = isl ? iL * G.step - 2 : G.w + 1;
      const xb = isl ? iR * G.step + 2 : G.w + 1;
      ctx.strokeStyle = rgba('#D4F1E4', 0.6);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      let on = false;
      for (let x = 0; x <= G.w + 4; x += 5) {
        if (x > xa && x < xb) { on = false; continue; }
        const y = waveY(x);
        if (!on) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        on = true;
      }
      ctx.stroke();
      /* écume au pied de l’île */
      if (isl) {
        for (let s = 0; s < 2; s++) {
          const x0 = s ? xb : xa;
          for (let i = 0; i < 4; i++) {
            const dx = (s ? 1 : -1) * (i * 4 + (CALM ? 0 : Math.sin(time * 1.6 + i) * 1.5)) * G.U;
            ctx.fillStyle = rgba('#F2FBF5', 0.55 - i * 0.11);
            ctx.beginPath();
            ctx.ellipse(x0 + dx, G.seaY + 0.5, (3.5 - i * 0.5) * G.U, 1.2 * G.U, 0, 0, TAU);
            ctx.fill();
          }
        }
      }
      /* ronds dans l’eau, vagues de l’émersion */
      for (const p of pops) {
        if (p.t < 0) continue;
        const k = p.t / p.dur;
        const r = lerp(p.r0, p.r1, ease.outCubic(k));
        ctx.strokeStyle = rgba('#E8FFF6', (p.big ? 0.55 : 0.5) * (1 - k));
        ctx.lineWidth = p.big ? 2 : 1;
        if (p.big) {
          for (let sd = -1; sd <= 1; sd += 2) {
            ctx.beginPath();
            ctx.moveTo(G.cx + sd * r, G.seaY - 1.5);
            ctx.lineTo(G.cx + sd * (r + 10 * G.U), G.seaY - 1.5);
            ctx.stroke();
          }
        } else {
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, r, r * 0.3, 0, 0, TAU);
          ctx.stroke();
        }
      }
    }

    function drawAboveFx() {
      /* lave rougeoyante au cratère */
      if (emerged && lavaHeat > 0.02) {
        const vy = ventY();
        const fl = CALM ? 1 : 0.85 + 0.15 * Math.sin(time * 7) * Math.sin(time * 2.3);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = clamp(lavaHeat * 0.7 * fl);
        const r = G.crater * 3.2;
        ctx.drawImage(PUFF.glow, G.cx - r, vy - r * 0.8, r * 2, r * 2);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        const gr = ctx.createRadialGradient(G.cx, vy, 0, G.cx, vy, G.crater);
        gr.addColorStop(0, rgba('#FFE7A0', lavaHeat));
        gr.addColorStop(0.45, rgba('#FF8A2B', lavaHeat));
        gr.addColorStop(1, rgba('#B0301A', lavaHeat * 0.9));
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.ellipse(G.cx, vy + 0.5, G.crater * 0.8, Math.max(1.6, G.crater * 0.26), 0, 0, TAU);
        ctx.fill();
      }
      for (const p of smoke) {
        const k = p.t / p.dur;
        const r = p.r + p.gr * ease.outCubic(k);
        ctx.globalAlpha = p.a * (k < 0.1 ? k / 0.1 : 1 - (k - 0.1) / 0.9);
        ctx.drawImage(PUFF.smoke, p.x - r, p.y - r, r * 2, r * 2);
      }
      for (const p of steam) {
        if (p.t < 0) continue;
        const k = p.t / p.dur;
        const r = p.r + p.gr * ease.outCubic(k);
        ctx.globalAlpha = p.a * (k < 0.12 ? k / 0.12 : 1 - (k - 0.12) / 0.88);
        ctx.drawImage(PUFF.steam, p.x - r, p.y - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
    }

    function drawSnow() {
      ctx.fillStyle = 'rgba(214,240,226,0.32)';
      for (const s of snow) ctx.fillRect(s.x, s.y, s.s, s.s);
    }

    function drawFeedback() {
      for (const r of rings) {
        const k = r.t / r.dur;
        ctx.strokeStyle = rgba(r.col, 0.8 * (1 - k));
        ctx.lineWidth = r.w;
        ctx.beginPath();
        ctx.arc(r.x, r.y, lerp(r.r0, r.r1, ease.outCubic(k)), 0, TAU);
        ctx.stroke();
      }
      for (const s of sparks) {
        const k = s.t / s.dur;
        ctx.fillStyle = rgba(s.col, 1 - k);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * (1 - k * 0.5), 0, TAU);
        ctx.fill();
      }
    }

    function render() {
      if (!bg) return;
      ctx.save();
      const d = cv.dpr;
      ctx.setTransform(d * cam.s, 0, 0, d * cam.s, d * cam.x, d * cam.y);
      ctx.drawImage(bg, 0, 0, G.w, G.h);
      drawRays();
      drawSnow();
      drawWaterBand();
      drawVolcano();
      ctx.drawImage(strata, 0, 0, G.w, G.h);
      drawMagma();
      if (emerged) {
        drawSoil();
        drawLichens();
        drawMossCarpet();
        drawPlants();
      }
      drawUnderFx();
      drawSurface();
      drawAboveFx();
      drawFeedback();
      ctx.restore();
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
