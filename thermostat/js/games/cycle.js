/* Le voyage du carbone : un atome sort du volcan, passe dans la pluie, ronge la roche,
   descend la rivière, devient coquille, s'entasse au fond de l'océan, puis la plaque
   l'entraîne sous le continent et le volcan le recrache. On le guide étape par étape. */
(function () {
  'use strict';
  const { lib } = window.RM;
  const { TAU, rand, clamp, lerp, ease, rgba, draw } = lib;

  /* Tous les textes du jeu, faciles à corriger */
  const TEXTES = {
    etapes: [
      'Le volcan souffle du CO2 dans l’air.',
      'La pluie capture un peu de CO2 et devient légèrement acide.',
      'La pluie ronge la roche : le carbone part avec l’eau.',
      'La rivière emporte tout vers l’océan.',
      'Un coquillage s’en sert pour fabriquer sa coquille de calcaire.',
      'Les coquilles s’entassent au fond : le carbone est enfermé dans la roche.',
      'La plaque plonge sous le continent ; le volcan recrache le CO2.',
    ],
    noms: ['Volcan', 'Nuage', 'Roche', 'Rivière', 'Coquillage', 'Fond de l’océan', 'Plaque qui plonge'],
    scene: 'Coupe d’un paysage, du volcan au fond de l’océan : touche l’étape qui s’allume pour faire voyager l’atome de carbone.',
    clavier: (nom) => `Faire voyager l’atome de carbone. Étape suivante : ${nom}.`,
    fin: 'Le carbone a fait le tour complet du cycle !',
    finStatut: 'En vrai, ce voyage prend des millions d’années.',
  };

  /* ---- le paysage, en fractions de la scène (x de la largeur, y de la hauteur) ---- */
  const SEA = 0.47; /* niveau de la mer */
  const LAND = [
    [-0.02, 0.41], [0.04, 0.385], [0.08, 0.335], [0.11, 0.3], [0.145, 0.236], [0.16, 0.222], [0.17, 0.233],
    [0.18, 0.222], [0.195, 0.24], [0.23, 0.3], [0.26, 0.334], [0.28, 0.33], [0.31, 0.292], [0.335, 0.258],
    [0.355, 0.238], [0.375, 0.252], [0.39, 0.268], [0.405, 0.262], [0.42, 0.256], [0.44, 0.28], [0.46, 0.31],
    [0.495, 0.365], [0.53, 0.425], [0.565, 0.47],
  ];
  const SLOPE = [[0.565, 0.47], [0.6, 0.54], [0.632, 0.625], [0.658, 0.705], [0.675, 0.748]];
  const FLOOR = [[0.675, 0.748], [0.7, 0.732], [0.74, 0.71], [0.8, 0.693], [0.9, 0.686], [1.02, 0.681]];
  const PLATE_TOP = [[1.02, 0.716], [0.8, 0.724], [0.72, 0.746], [0.68, 0.77], [0.62, 0.806], [0.52, 0.872], [0.42, 0.94], [0.32, 1.02]];
  const PLATE_BOT = [[0.43, 1.03], [0.5, 0.96], [0.59, 0.894], [0.66, 0.848], [0.72, 0.818], [0.8, 0.794], [1.02, 0.788]];
  const MOHO = [[0.555, 0.85], [0.47, 0.806], [0.36, 0.77], [0.2, 0.755], [-0.02, 0.752]];
  const CONE = [
    [0.03, 0.392], [0.06, 0.36], [0.08, 0.335], [0.11, 0.3], [0.145, 0.236], [0.16, 0.222], [0.17, 0.233],
    [0.18, 0.222], [0.195, 0.24], [0.23, 0.3], [0.26, 0.334], [0.275, 0.345], [0.25, 0.375], [0.17, 0.4], [0.08, 0.405],
  ];
  const CRATER = [0.17, 0.228];
  const CHAMBER = [0.2, 0.585];
  const MELT = [[0.43, 0.92], [0.38, 0.865], [0.32, 0.8], [0.265, 0.72], [0.22, 0.64]];
  const MOUND = [0.8, 0.65];
  const CLOUD = [0.47, 0.105];

  function landY(fx) {
    for (let i = 1; i < LAND.length; i++) {
      if (fx <= LAND[i][0]) {
        const [x0, y0] = LAND[i - 1], [x1, y1] = LAND[i];
        return lerp(y0, y1, (fx - x0) / (x1 - x0));
      }
    }
    return SEA;
  }
  const RIVER = [];
  for (let fx = 0.405; fx <= 0.5651; fx += 0.016) RIVER.push([fx, landY(fx) + 0.006]);

  /* Les sept étapes : où toucher, et le chemin de l'atome jusqu'à son nouveau repos. */
  const UP = [[0.2, 0.585], [0.196, 0.5], [0.184, 0.4], [0.174, 0.3], [0.17, 0.232], [0.183, 0.172], [0.212, 0.128], [0.25, 0.1]];
  const STATIONS = [
    { tap: [0.17, 0.215], path: UP, dur: 1.8 },
    { tap: [0.47, 0.105], path: [[0.25, 0.1], [0.31, 0.066], [0.38, 0.07], [0.43, 0.108], [0.47, 0.15]], dur: 1.5 },
    { tap: [0.4, 0.29], path: [[0.47, 0.15], [0.457, 0.19], [0.432, 0.232], [0.405, 0.266]], dur: 0.9, fall: true },
    { tap: [0.5, 0.385], path: RIVER, dur: 2 },
    { tap: [0.8, 0.583], path: [[0.565, 0.468], [0.61, 0.5], [0.68, 0.54], [0.745, 0.566], [0.8, 0.588]], dur: 1.6 },
    { tap: [0.92, 0.695], path: [[0.8, 0.588], [0.845, 0.604], [0.885, 0.643], [0.92, 0.7]], dur: 1.4, fall: true },
    {
      tap: [0.57, 0.87],
      path: [[0.92, 0.7], [0.86, 0.703], [0.8, 0.707], [0.73, 0.727], [0.68, 0.755], [0.62, 0.79], [0.55, 0.838],
        [0.48, 0.885], [0.43, 0.918]].concat(MELT.slice(1), UP.slice(1)),
      dur: 6.2,
    },
  ];

  const CSS = `
.game[data-game="cycle"] .cy-label {
  position: absolute; z-index: 2; left: 0; top: 0; margin: 0;
  padding: 3px 10px 4px; border-radius: 10px 13px 11px 12px;
  background: rgba(6, 28, 34, 0.8); color: #BFF5EA; box-shadow: inset 0 0 0 1px rgba(95, 224, 198, 0.55);
  font: 700 0.8125rem/1.2 var(--font-text); white-space: nowrap; pointer-events: none;
  opacity: 0; transform: translate(-50%, -50%) scale(0.9);
  transition: opacity 0.35s ease, transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1.3);
}
.game[data-game="cycle"] .cy-label.is-on { opacity: 1; transform: translate(-50%, -50%); }
.game[data-game="cycle"] .game-stage:focus-visible { outline-offset: -4px; }
`;

  function seeded(seed) {
    let s = seed >>> 0 || 1;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }
  function age(list, dt) {
    let j = 0;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      e.t += dt;
      if (e.t < e.dur) list[j++] = e;
    }
    list.length = j;
  }

  window.RM.games.cycle = function (api) {
    const cv = api.canvas();
    const ctx = cv.ctx;
    const stage = api.stage;
    const AMB = api.reducedMotion ? 0.3 : 1;
    api.style(CSS);

    const label = document.createElement('p');
    label.className = 'cy-label';
    label.setAttribute('aria-hidden', 'true');
    stage.appendChild(label);
    cv.canvas.setAttribute('role', 'img');
    cv.canvas.removeAttribute('aria-hidden');
    cv.canvas.setAttribute('aria-label', TEXTES.scene);

    const G = { w: 1, h: 1, s: 1, hit: 32 };
    const X = (fx) => fx * G.w;
    const Y = (fy) => fy * G.h;

    /* ---- chemins : courbes de Catmull-Rom, parcourues à vitesse régulière ---- */
    function makePath(pts) {
      const P = pts.map(([fx, fy]) => [X(fx), Y(fy)]);
      const out = [];
      for (let i = 0; i < P.length - 1; i++) {
        const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
        for (let k = 0; k < 12; k++) {
          const t = k / 12, t2 = t * t, t3 = t2 * t;
          out.push([
            0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
            0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
          ]);
        }
      }
      out.push(P[P.length - 1]);
      const len = [0];
      for (let i = 1; i < out.length; i++) len.push(len[i - 1] + Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1]));
      return { pts: out, len, total: len[len.length - 1] };
    }
    function pathAt(p, u, o) {
      const d = clamp(u) * p.total;
      let lo = 0, hi = p.len.length - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (p.len[mid] < d) lo = mid; else hi = mid;
      }
      const seg = p.len[hi] - p.len[lo] || 1;
      const k = (d - p.len[lo]) / seg;
      o[0] = lerp(p.pts[lo][0], p.pts[hi][0], k);
      o[1] = lerp(p.pts[lo][1], p.pts[hi][1], k);
      return o;
    }

    /* tracé lissé d'une liste de points (fractions) */
    function trace(g, pts, closed, start) {
      const P = pts.map(([fx, fy]) => [X(fx), Y(fy)]);
      const n = P.length;
      if (!start) g.beginPath();
      if (closed) {
        g.moveTo((P[n - 1][0] + P[0][0]) / 2, (P[n - 1][1] + P[0][1]) / 2);
        for (let i = 0; i < n; i++) {
          const a = P[i], b = P[(i + 1) % n];
          g.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
        }
        g.closePath();
      } else {
        if (start) g.lineTo(P[0][0], P[0][1]); else g.moveTo(P[0][0], P[0][1]);
        for (let i = 1; i < n - 1; i++) g.quadraticCurveTo(P[i][0], P[i][1], (P[i][0] + P[i + 1][0]) / 2, (P[i][1] + P[i + 1][1]) / 2);
        g.lineTo(P[n - 1][0], P[n - 1][1]);
      }
    }

    function mk(wc, hc) {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(wc * cv.dpr));
      c.height = Math.max(1, Math.round(hc * cv.dpr));
      const g = c.getContext('2d');
      g.scale(cv.dpr, cv.dpr);
      return { c, g, w: wc, h: hc };
    }
    function speckle(g, n, r, cols, x0, y0, x1, y1, smin, smax) {
      for (let i = 0; i < n; i++) {
        g.fillStyle = cols[Math.floor(r() * cols.length)];
        const s = smin + r() * (smax - smin);
        g.fillRect(lerp(x0, x1, r()), lerp(y0, y1, r()), s, s);
      }
    }

    /* ---- le décor fixe ---- */
    let bg = null, cloudSp = null, puffSp = null, dustSp = null;
    let paths = [];
    let platePath = null;
    function makeBg() {
      const { w, h, s } = G;
      const B = mk(w, h);
      const g = B.g;
      const r = seeded(9);
      /* ciel */
      let gr = g.createLinearGradient(0, 0, 0, Y(SEA));
      gr.addColorStop(0, '#03131A');
      gr.addColorStop(0.55, '#0A3340');
      gr.addColorStop(1, '#1F5A64');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, Y(SEA) + 2);
      for (let i = 0; i < 40; i++) {
        g.fillStyle = `rgba(230,246,243,${0.15 + r() * 0.45})`;
        const sz = 0.5 + r();
        g.fillRect(r() * w, r() * Y(0.2), sz, sz);
      }
      g.globalCompositeOperation = 'lighter';
      draw.glow(g, X(0.98), Y(SEA), Math.max(w, h) * 0.45, '#FFB25B', 0.16);
      g.globalCompositeOperation = 'source-over';
      /* manteau, tout en bas */
      gr = g.createLinearGradient(0, Y(0.72), 0, h);
      gr.addColorStop(0, '#3A150D');
      gr.addColorStop(1, '#5A2312');
      g.fillStyle = gr;
      g.fillRect(0, Y(0.7), w, h - Y(0.7));
      g.globalCompositeOperation = 'lighter';
      draw.glow(g, X(0.38), Y(0.9), Math.max(w, h) * 0.22, '#FF7A2A', 0.3);
      draw.glow(g, X(0.24), Y(0.7), Math.max(w, h) * 0.16, '#FF8A3A', 0.2);
      g.globalCompositeOperation = 'source-over';
      /* océan */
      g.beginPath();
      g.moveTo(X(0.565), Y(SEA));
      g.lineTo(X(1.02), Y(SEA));
      trace(g, FLOOR.slice().reverse(), false, true);
      trace(g, SLOPE.slice().reverse(), false, true);
      g.closePath();
      gr = g.createLinearGradient(0, Y(SEA), 0, Y(0.75));
      gr.addColorStop(0, '#2C93A6');
      gr.addColorStop(0.45, '#13606F');
      gr.addColorStop(1, '#0A3A46');
      g.fillStyle = gr;
      g.fill();
      g.save();
      g.clip();
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) {
        const x = X(0.62 + i * 0.09);
        const lg = g.createLinearGradient(x, Y(SEA), x - w * 0.06, Y(0.72));
        lg.addColorStop(0, 'rgba(160,240,230,0.12)');
        lg.addColorStop(1, 'rgba(160,240,230,0)');
        g.fillStyle = lg;
        g.beginPath();
        g.moveTo(x - 6 * s, Y(SEA));
        g.lineTo(x + 10 * s, Y(SEA));
        g.lineTo(x - w * 0.05, Y(0.74));
        g.lineTo(x - w * 0.09, Y(0.74));
        g.closePath();
        g.fill();
      }
      g.globalCompositeOperation = 'source-over';
      g.restore();
      /* la plaque océanique (basalte) qui plonge sous le continent */
      g.beginPath();
      trace(g, PLATE_TOP, false);
      trace(g, PLATE_BOT, false, true);
      g.closePath();
      gr = g.createLinearGradient(X(1), Y(0.72), X(0.4), Y(1));
      gr.addColorStop(0, '#3E4D4C');
      gr.addColorStop(0.6, '#2C3838');
      gr.addColorStop(1, '#3B2420');
      g.fillStyle = gr;
      g.fill();
      g.save();
      g.clip();
      speckle(g, 260, r, ['rgba(10,16,16,0.45)', 'rgba(150,170,165,0.18)', 'rgba(90,110,105,0.3)'], 0, Y(0.7), w, h, 0.7, 2);
      /* coussins de lave, sous les sédiments */
      g.fillStyle = 'rgba(80,98,96,0.35)';
      for (let fx = 0.7; fx < 1.02; fx += 0.035) {
        const fy = lerp(0.746, 0.716, (fx - 0.72) / 0.3) + 0.016;
        draw.blob(g, X(fx), Y(fy), 5 * s, 0.25, fx * 40, 0, 12);
        g.fill();
      }
      /* chaleur en profondeur */
      g.globalCompositeOperation = 'lighter';
      draw.glow(g, X(0.42), Y(0.97), Math.max(w, h) * 0.18, '#FF6A2A', 0.35);
      g.globalCompositeOperation = 'source-over';
      g.restore();
      g.strokeStyle = 'rgba(160,190,185,0.4)';
      g.lineWidth = 1.2;
      trace(g, PLATE_TOP, false);
      g.stroke();
      /* sédiments : les couches de calcaire blanc */
      g.beginPath();
      trace(g, FLOOR, false);
      trace(g, PLATE_TOP.slice(0, 4), false, true);
      g.closePath();
      gr = g.createLinearGradient(0, Y(0.68), 0, Y(0.76));
      gr.addColorStop(0, '#F2EFE6');
      gr.addColorStop(1, '#CFC9B8');
      g.fillStyle = gr;
      g.fill();
      g.save();
      g.clip();
      g.strokeStyle = 'rgba(150,140,115,0.45)';
      g.lineWidth = 0.8;
      for (let k = 1; k <= 3; k++) {
        g.beginPath();
        for (let fx = 0.68; fx <= 1.02; fx += 0.02) {
          const top = lerp(0.748, 0.681, clamp((fx - 0.675) / 0.25));
          const bot = lerp(0.77, 0.716, clamp((fx - 0.68) / 0.34));
          const yy = Y(lerp(top, bot, k / 4)) + Math.sin(fx * 40 + k) * 0.6;
          if (fx === 0.68) g.moveTo(X(fx), yy); else g.lineTo(X(fx), yy);
        }
        g.stroke();
      }
      speckle(g, 70, r, ['rgba(255,255,255,0.7)', 'rgba(170,160,135,0.5)'], X(0.68), Y(0.68), w, Y(0.77), 0.8, 1.8);
      g.restore();
      /* la croûte du continent (granite) */
      g.beginPath();
      trace(g, LAND, false);
      trace(g, SLOPE.slice(1), false, true);
      trace(g, [[0.62, 0.806], [0.555, 0.85]], false, true);
      trace(g, MOHO.slice(1), false, true);
      g.lineTo(X(-0.02), Y(0.75));
      g.closePath();
      gr = g.createLinearGradient(0, Y(0.22), 0, Y(0.76));
      gr.addColorStop(0, '#BCA39A');
      gr.addColorStop(0.45, '#9D857E');
      gr.addColorStop(1, '#6E5A57');
      g.fillStyle = gr;
      g.fill();
      g.save();
      g.clip();
      speckle(g, 900, r, ['rgba(40,30,30,0.55)', 'rgba(226,160,150,0.5)', 'rgba(250,244,240,0.5)', 'rgba(70,55,55,0.4)'], 0, Y(0.2), X(0.66), Y(0.86), 0.7, 1.9);
      /* des strates : bandes plus claires et plus sombres qui suivent le relief */
      const n = lib.makeNoise(31);
      for (let k = 1; k <= 6; k++) {
        const f = k / 7;
        g.beginPath();
        for (let fx = -0.02; fx <= 0.7; fx += 0.01) {
          const top = fx < 0.565 ? landY(fx) : lerp(SEA, 0.75, (fx - 0.565) / 0.11);
          const yy = lerp(top + 0.02, 0.76, f) + (n.noise2(fx * 9, k * 2.3) - 0.5) * 0.025;
          if (fx === -0.02) g.moveTo(X(fx), Y(yy)); else g.lineTo(X(fx), Y(yy));
        }
        g.strokeStyle = k % 2 ? 'rgba(255,236,228,0.13)' : 'rgba(40,24,24,0.16)';
        g.lineWidth = (k % 2 ? 5 : 3) * s;
        g.stroke();
      }
      /* le bas de la croûte, plus sombre */
      gr = g.createLinearGradient(0, Y(0.5), 0, Y(0.78));
      gr.addColorStop(0, 'rgba(40,20,20,0)');
      gr.addColorStop(1, 'rgba(40,20,20,0.35)');
      g.fillStyle = gr;
      g.fillRect(0, Y(0.5), X(0.7), Y(0.3));
      g.restore();
      /* liseré du talus sous-marin */
      g.strokeStyle = 'rgba(20,50,58,0.55)';
      g.lineWidth = 2 * s;
      trace(g, SLOPE, false);
      g.stroke();
      /* herbe sur la plaine côtière */
      g.strokeStyle = 'rgba(120,170,90,0.7)';
      g.lineWidth = 2.2 * s;
      g.lineCap = 'round';
      g.beginPath();
      trace(g, LAND.filter(([fx]) => fx > 0.46 && fx < 0.56).concat([[0.562, 0.468]]), false);
      g.stroke();
      g.beginPath();
      trace(g, LAND.filter(([fx]) => fx < 0.07), false);
      g.stroke();
      g.lineCap = 'butt';
      /* le volcan */
      trace(g, CONE, true);
      gr = g.createLinearGradient(0, Y(0.22), 0, Y(0.405));
      gr.addColorStop(0, '#5E4038');
      gr.addColorStop(0.7, 'rgba(50,36,33,1)');
      gr.addColorStop(1, 'rgba(50,36,33,0.15)');
      g.fillStyle = gr;
      g.fill();
      g.save();
      g.clip();
      g.strokeStyle = 'rgba(140,100,85,0.35)';
      g.lineWidth = 1;
      for (let k = 1; k <= 4; k++) {
        g.beginPath();
        const dy = k * 0.032;
        g.moveTo(X(0.02 + k * 0.012), Y(0.36 + dy * 0.6));
        g.quadraticCurveTo(X(0.17), Y(0.2 + dy), X(0.285 - k * 0.01), Y(0.33 + dy * 0.6));
        g.stroke();
      }
      speckle(g, 160, r, ['rgba(20,12,10,0.5)', 'rgba(150,110,90,0.3)'], X(0.03), Y(0.22), X(0.29), Y(0.43), 0.7, 1.6);
      /* coulée figée sur le flanc */
      g.strokeStyle = 'rgba(255,120,60,0.35)';
      g.lineWidth = 2.4 * s;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(X(0.18), Y(0.232));
      g.quadraticCurveTo(X(0.205), Y(0.29), X(0.235), Y(0.33));
      g.stroke();
      g.lineCap = 'butt';
      g.restore();
      /* la cheminée et la chambre magmatique */
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = 'rgba(255,110,40,0.35)';
      g.lineWidth = 9 * s;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(X(0.198), Y(0.56));
      g.bezierCurveTo(X(0.19), Y(0.45), X(0.178), Y(0.34), X(CRATER[0]), Y(CRATER[1]));
      g.stroke();
      g.globalCompositeOperation = 'source-over';
      g.strokeStyle = '#FF7A34';
      g.lineWidth = 3.2 * s;
      g.stroke();
      g.strokeStyle = 'rgba(255,220,140,0.8)';
      g.lineWidth = 1.2 * s;
      g.stroke();
      g.lineCap = 'butt';
      /* le magma qui monte depuis la plaque */
      g.globalCompositeOperation = 'lighter';
      g.lineCap = 'round';
      g.strokeStyle = 'rgba(255,100,40,0.12)';
      g.lineWidth = 22 * s;
      trace(g, MELT, false);
      g.stroke();
      g.strokeStyle = 'rgba(255,120,50,0.14)';
      g.lineWidth = 10 * s;
      g.stroke();
      g.strokeStyle = 'rgba(255,160,80,0.2)';
      g.lineWidth = 3 * s;
      g.stroke();
      g.lineCap = 'butt';
      draw.glow(g, X(CHAMBER[0]), Y(CHAMBER[1]), X(0.13), '#FF8A3A', 0.45);
      g.globalCompositeOperation = 'source-over';
      g.save();
      g.translate(X(CHAMBER[0]), Y(CHAMBER[1]));
      g.scale(X(0.065), Y(0.032));
      draw.blob(g, 0, 0, 1, 0.12, 3, 0, 24);
      g.restore();
      gr = g.createRadialGradient(X(CHAMBER[0]) - X(0.02), Y(CHAMBER[1]) - Y(0.01), 1, X(CHAMBER[0]), Y(CHAMBER[1]), X(0.07));
      gr.addColorStop(0, '#FFE08A');
      gr.addColorStop(0.45, '#FF8A2E');
      gr.addColorStop(1, '#C2361A');
      g.fillStyle = gr;
      g.fill();
      /* le rocher sous-marin, avec ses algues */
      g.save();
      g.translate(X(MOUND[0]), Y(MOUND[1]));
      g.scale(X(0.07), Y(0.05));
      draw.blob(g, 0, 0, 1, 0.1, 5, 0, 24);
      g.restore();
      gr = g.createLinearGradient(0, Y(0.59), 0, Y(0.7));
      gr.addColorStop(0, '#5E6E66');
      gr.addColorStop(1, '#2E3B38');
      g.fillStyle = gr;
      g.fill();
      g.strokeStyle = 'rgba(120,200,150,0.55)';
      g.lineWidth = 1.6 * s;
      g.lineCap = 'round';
      for (let i = 0; i < 5; i++) {
        const fx = MOUND[0] + (i - 2) * 0.022;
        const y0 = Y(MOUND[1] - 0.04 + Math.abs(i - 2) * 0.01);
        g.beginPath();
        g.moveTo(X(fx), y0);
        g.quadraticCurveTo(X(fx) + (i % 2 ? 4 : -4) * s, y0 - 9 * s, X(fx) + (i % 2 ? -1 : 2) * s, y0 - 16 * s);
        g.stroke();
      }
      g.lineCap = 'butt';
      /* coquillages posés au fond */
      [[0.72, 0.712], [0.875, 0.69], [0.965, 0.686], [0.755, 0.704]].forEach(([fx, fy], i) => {
        shellAt(g, X(fx), Y(fy) - 2 * s, 4.2 * s * (i % 2 ? 0.9 : 1.1), i % 2 === 0, 1, i);
      });
      return B;
    }

    /* Un coquillage : une coque striée, ou une spirale. grow : 0 → 1 (la coquille se forme). */
    function shellAt(g, x, y, R, spiral, grow, seed) {
      if (grow <= 0) return;
      g.save();
      g.translate(x, y);
      if (spiral) {
        const turns = 2.4 * grow;
        g.beginPath();
        for (let a = 0; a <= turns * TAU; a += 0.2) {
          const rr = R * (0.15 + 0.85 * (a / (2.4 * TAU)));
          const px = Math.cos(a + seed) * rr, py = Math.sin(a + seed) * rr * 0.85;
          if (a === 0) g.moveTo(px, py); else g.lineTo(px, py);
        }
        g.strokeStyle = 'rgba(120,95,70,0.8)';
        g.lineWidth = Math.max(1, R * 0.32);
        g.lineCap = 'round';
        g.stroke();
        g.strokeStyle = '#F6EBD8';
        g.lineWidth = Math.max(0.8, R * 0.2);
        g.stroke();
        g.lineCap = 'butt';
      } else {
        const a1 = Math.PI * (1 + grow);
        g.beginPath();
        g.moveTo(0, 0);
        g.arc(0, 0, R, Math.PI, a1);
        g.closePath();
        g.fillStyle = '#F1E4CF';
        g.fill();
        g.strokeStyle = 'rgba(150,110,80,0.75)';
        g.lineWidth = 0.8;
        g.stroke();
        for (let k = 1; k < 5; k++) {
          const a = Math.PI + (k / 5) * Math.PI;
          if (a > a1) break;
          g.beginPath();
          g.moveTo(0, 0);
          g.lineTo(Math.cos(a) * R, Math.sin(a) * R);
          g.stroke();
        }
      }
      g.restore();
    }

    function makeCloud() {
      const s = G.s;
      const W = Math.min(X(0.32), Y(0.11) * 2.6), H = W / 2.35;
      const C = mk(W, H);
      const g = C.g;
      const blobs = [[0.28, 0.6, 0.2], [0.45, 0.42, 0.27], [0.64, 0.5, 0.23], [0.78, 0.66, 0.15], [0.16, 0.7, 0.13], [0.52, 0.72, 0.2]];
      blobs.forEach(([fx, fy, fr], i) => {
        const gr = g.createRadialGradient(fx * W - fr * W * 0.3, fy * H - fr * W * 0.4, 1, fx * W, fy * H, fr * W);
        gr.addColorStop(0, '#DCE8EC');
        gr.addColorStop(0.7, '#9FB5BE');
        gr.addColorStop(1, '#7E959F');
        g.fillStyle = gr;
        draw.blob(g, fx * W, fy * H, fr * W, 0.08, i, 0, 20);
        g.fill();
      });
      return { c: C.c, w: W, h: H, s };
    }
    function makeDust() {
      const c = document.createElement('canvas');
      c.width = c.height = 48;
      const g = c.getContext('2d');
      const gr = g.createRadialGradient(24, 24, 0, 24, 24, 24);
      gr.addColorStop(0, 'rgba(200,175,165,0.9)');
      gr.addColorStop(1, 'rgba(200,175,165,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 48, 48);
      return c;
    }
    function makePuff() {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d');
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,0.95)');
      gr.addColorStop(0.5, 'rgba(255,255,255,0.45)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 64);
      return c;
    }

    function geometry(w, h) {
      G.w = w;
      G.h = h;
      G.s = clamp(Math.min(w, h) / 358, 0.85, 1.45);
      G.hit = Math.max(32, Math.min(w, h) * 0.09);
      bg = makeBg();
      cloudSp = makeCloud();
      paths = STATIONS.map((st) => makePath(st.path));
      platePath = makePath(PLATE_TOP.slice(0, 7).map(([fx, fy], i) => [fx, fy + 0.035 - (i > 4 ? 0.004 : 0)]));
      riverPath = makePath(RIVER);
      meltPath = makePath(MELT);
      if (!atom.moving) setAtomRest();
      placeLabel();
    }

    /* ---- état ---- */
    const atom = { x: 0, y: 0, moving: false, k: -1, t: 0, path: null, dur: 1, trail: [], heat: 0, fired: {} };
    let riverPath = null, meltPath = null;
    let next = 0;          /* prochaine étape à toucher (0 = volcan) */
    let rest = -1;         /* dernière étape terminée : l'atome est à son repos (−1 : dans la chambre) */
    let lit = [];          /* étapes déjà parcourues dans ce tour */
    let misses = 0;
    let nudge = 0;
    let finished = false;
    let loopDone = false;
    let layers = 0;
    let layerGrow = 0;
    let plateShift = 0;
    let plateSlide = 0;
    let riverBoost = 0;
    let rainBoost = 0;
    let shellGrow = 0;
    let gestureT = -1;
    let time = 0;
    let puffs = [], bits = [], dust = [], waves = [], blobsUp = [];
    let rain = [], smoke = [], plankton = [];
    const tmp = [0, 0];

    function setAtomRest() {
      if (rest < 0) { atom.x = X(CHAMBER[0]); atom.y = Y(CHAMBER[1]); return; }
      const p = paths[rest];
      atom.x = p.pts[p.pts.length - 1][0];
      atom.y = p.pts[p.pts.length - 1][1];
    }

    /* L'étiquette se pose au-dessus, en dessous ou à côté de la station : là où elle tient
       dans la scène sans cacher l'atome ni la station. */
    function placeLabel() {
      const st = STATIONS[next];
      const x = X(st.tap[0]), y = Y(st.tap[1]);
      label.textContent = lib.fr(TEXTES.noms[next]);
      const lw = label.offsetWidth || 90, lh = label.offsetHeight || 24;
      const gap = G.hit * 0.72;
      const cands = [[x, y - gap - lh / 2], [x, y + gap + lh / 2], [x - gap - lw / 2, y], [x + gap + lw / 2, y]];
      let best = cands[0], bestScore = -1e9;
      cands.forEach(([cx, cy], i) => {
        const fx = clamp(cx, lw / 2 + 6, G.w - lw / 2 - 6), fy = clamp(cy, lh / 2 + 6, G.h - lh / 2 - 6);
        let score = -Math.abs(fx - cx) - Math.abs(fy - cy) - i * 6;
        const da = Math.hypot(Math.max(0, Math.abs(atom.x - fx) - lw / 2), Math.max(0, Math.abs(atom.y - fy) - lh / 2));
        if (da < 16) score -= 200;
        const ds = Math.hypot(Math.max(0, Math.abs(x - fx) - lw / 2), Math.max(0, Math.abs(y - fy) - lh / 2));
        if (ds < G.hit * 0.6) score -= 300;
        if (score > bestScore) { bestScore = score; best = [fx, fy]; }
      });
      label.style.left = best[0].toFixed(1) + 'px';
      label.style.top = best[1].toFixed(1) + 'px';
    }
    function showNext() {
      placeLabel();
      label.classList.add('is-on');
      stage.setAttribute('aria-label', lib.fr(TEXTES.clavier(TEXTES.noms[next])));
    }

    function go(k) {
      const st = STATIONS[k];
      if (k === 1 && loopDone) {
        lit = [true];
        loopDone = false;
      }
      lit[k] = true;
      misses = 0;
      nudge = 0;
      label.classList.remove('is-on');
      api.gesture(null);
      gestureT = -1;
      api.status(TEXTES.etapes[k]);
      if (!finished) api.progress((k + 1) / STATIONS.length);
      api.buzz(10);
      atom.moving = true;
      atom.k = k;
      atom.t = 0;
      atom.dur = st.dur * (api.reducedMotion ? 0.8 : 1);
      atom.path = paths[k];
      atom.fired = {};
      if (k === 0) { api.sfx.play('rumble', { volume: 0.6 }); }
      if (k === 1) { api.sfx.play('whoosh', { volume: 0.4 }); }
      if (k === 2) { api.sfx.play('splash', { volume: 0.4, pitch: 1.4 }); }
      if (k === 3) { api.sfx.play('splash', { volume: 0.5 }); riverBoost = 1; }
      if (k === 4) { api.sfx.play('bubble'); shellGrow = 0; }
      if (k === 5) { api.sfx.play('bubble', { pitch: 0.7 }); }
      if (k === 6) { api.sfx.play('scrape', { volume: 0.6, gap: 0 }); }
    }

    function arrive(k) {
      atom.moving = false;
      rest = k;
      next = k === STATIONS.length - 1 ? 1 : k + 1;
      if (k === STATIONS.length - 1) {
        loopDone = true;
        if (!finished) {
          finished = true;
          api.done(TEXTES.fin, TEXTES.finStatut);
        }
      }
      showNext();
      if (!finished) gestureT = 0.7;
    }

    /* événements au fil du trajet : bouffée, goutte, roche qui s'effrite… */
    function fire(name, fn) {
      if (atom.fired[name]) return;
      atom.fired[name] = true;
      fn();
    }
    function puffAt(x, y, n, spread, col) {
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + rand(-spread, spread);
        const v = rand(22, 56) * G.s;
        puffs.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, s: rand(5, 10) * G.s, g: rand(14, 26) * G.s, t: 0, dur: rand(1.1, 1.9), col: col || 0 });
      }
    }
    function travelEvents(k, u) {
      const cx = X(CRATER[0]), cy = Y(CRATER[1]);
      if (k === 0 && u > 0.55) fire('puff', () => { puffAt(cx, cy, 20, 0.6); waves.push({ x: cx, y: cy, t: 0, dur: 0.7, col: '#FFB25B', R: 30 }); api.sfx.play('whoosh', { volume: 0.6 }); });
      if (k === 1 && u > 0.92) fire('drop', () => { rainBoost = 1; });
      if (k === 2 && u > 0.97) fire('crack', () => {
        api.sfx.play('crack');
        waves.push({ x: atom.x, y: atom.y, t: 0, dur: 0.5, col: '#9FD8FF', R: 18 });
        for (let i = 0; i < 15; i++) {
          bits.push({ x: atom.x + rand(-7, 7) * G.s, y: atom.y + rand(-2, 4) * G.s, vx: rand(8, 55) * G.s, vy: rand(-45, -5) * G.s, s: rand(2.2, 4.6) * G.s, t: 0, dur: rand(0.9, 1.5), rot: rand(TAU) });
        }
        for (let i = 0; i < 5; i++) {
          puffs.push({ x: atom.x + rand(-5, 5) * G.s, y: atom.y, vx: rand(4, 20) * G.s, vy: -rand(4, 14) * G.s, s: rand(4, 7) * G.s, g: rand(8, 14) * G.s, t: 0, dur: rand(0.8, 1.2), col: 1 });
        }
      });
      if (k === 4 && u > 0.9) fire('shell', () => { api.sfx.play('chime', { volume: 0.6 }); waves.push({ x: atom.x, y: atom.y, t: 0, dur: 0.8, col: '#F6EBD8', R: 22 }); });
      if (k === 5 && u > 0.96) fire('layer', () => {
        layers = Math.min(3, layers + 1);
        layerGrow = 0;
        api.sfx.play('thud', { volume: 0.5 });
        for (let i = 0; i < 26; i++) dust.push({ x: X(rand(0.7, 1)), y: Y(rand(0.6, 0.66)), vy: rand(6, 14) * G.s, t: 0, dur: rand(1, 1.8) });
      });
      if (k === 6) {
        if (u > 0.3) fire('melt', () => { api.sfx.play('rumble', { volume: 0.5 }); });
        if (u > 0.9) fire('puff2', () => { puffAt(cx, cy, 24, 0.7); waves.push({ x: cx, y: cy, t: 0, dur: 0.8, col: '#FFB25B', R: 34 }); api.sfx.play('whoosh', { volume: 0.7 }); });
      }
    }

    /* ---- interaction ---- */
    function onTap(x, y) {
      waves.push({ x, y, t: 0, dur: 0.5, col: '#BFF5EA', R: 22 });
      if (atom.moving) return;
      const st = STATIONS[next];
      const d = Math.hypot(x - X(st.tap[0]), y - Y(st.tap[1]));
      if (d <= G.hit || misses >= 2) {
        go(next);
        return;
      }
      misses++;
      nudge = 1;
      api.sfx.play('tick', { pitch: 0.8 });
    }
    api.track(cv.canvas, {
      up(p, e, cancelled) {
        if (!cancelled && p.tap) onTap(p.x, p.y);
      },
    }, { touchAction: 'pan-y' });
    /* au clavier : Entrée ou Espace font avancer l'atome */
    stage.tabIndex = 0;
    stage.setAttribute('role', 'button');
    stage.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      if (!atom.moving) go(next);
    });

    /* ---- animation ---- */
    function update(dt) {
      time += dt;
      if (atom.moving) {
        atom.t += dt;
        const k = atom.k;
        let u = clamp(atom.t / atom.dur);
        const st = STATIONS[k];
        const e = st.fall ? ease.inQuad(u) : ease.inOutSine(u);
        pathAt(atom.path, e, tmp);
        atom.x = tmp[0];
        atom.y = tmp[1];
        travelEvents(k, u);
        if (k === 6) {
          /* la plaque glisse pendant le premier tiers du voyage */
          plateSlide = u < 0.4 ? 1 : Math.max(0, plateSlide - dt * 2);
          plateShift += dt * (u < 0.4 ? 26 : 4) * G.s;
          atom.heat = clamp(Math.min((e - 0.3) / 0.12, (0.78 - e) / 0.12));
        } else atom.heat = 0;
        if (u >= 1) arrive(k);
      } else {
        atom.heat = Math.max(0, atom.heat - dt);
        if (rest < 0 || rest === 0 || rest === 6) {
          /* gaz dans l'air (ou au repos dans la chambre) : il flotte un peu */
          atom.y += Math.sin(time * 2) * 0.05 * AMB;
        }
      }
      if (atom.moving || Math.random() < 0.5) {
        atom.trail.push({ x: atom.x, y: atom.y, t: 0, dur: 0.6 });
        if (atom.trail.length > 26) atom.trail.shift();
      }
      age(atom.trail, dt);
      plateShift += dt * 2.5 * AMB * G.s;
      if (!atom.moving || atom.k !== 6) plateSlide = Math.max(0, plateSlide - dt * 2);
      riverBoost = Math.max(0, riverBoost - dt * 0.5);
      rainBoost = Math.max(0, rainBoost - dt * 0.6);
      nudge = Math.max(0, nudge - dt * 1.5);
      if (rest === 4 || (atom.moving && atom.k === 4)) shellGrow = Math.min(1, shellGrow + dt * 0.9);
      layerGrow = Math.min(1, layerGrow + dt * 0.8);
      if (gestureT > 0) {
        gestureT -= dt;
        if (gestureT <= 0 && !atom.moving && !finished) {
          const st = STATIONS[next];
          api.gesture('tap', { x: st.tap[0] * 100, y: st.tap[1] * 100 });
        }
      }

      /* pluie sous le nuage */
      const rate = (8 + rainBoost * 30) * AMB;
      if (Math.random() < rate * dt) {
        const fx = rand(CLOUD[0] - 0.1, CLOUD[0] + 0.09);
        rain.push({ x: X(fx), y: Y(CLOUD[1] + 0.04), vy: rand(150, 200) * G.s, t: 0, dur: 2, gy: Y(landY(Math.min(fx, 0.57))) });
      }
      for (let i = rain.length - 1; i >= 0; i--) {
        const d = rain[i];
        d.y += d.vy * dt;
        d.x -= d.vy * 0.06 * dt;
        if (d.y >= d.gy) {
          if (Math.random() < 0.3) waves.push({ x: d.x, y: d.gy, t: 0, dur: 0.3, col: '#9FD8FF', R: 4 });
          rain.splice(i, 1);
        }
      }
      /* fumée du volcan */
      if (Math.random() < dt * 3 * AMB) {
        smoke.push({ x: X(CRATER[0]) + rand(-2, 2), y: Y(CRATER[1]) - 2, vx: rand(4, 12) * G.s, vy: -rand(10, 18) * G.s, s: rand(3, 5) * G.s, g: rand(5, 9) * G.s, t: 0, dur: rand(2.5, 3.5) });
      }
      for (const p of smoke) { p.x += p.vx * dt; p.y += p.vy * dt; p.s += p.g * dt; }
      age(smoke, dt);
      for (const p of puffs) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= Math.pow(0.4, dt); p.vy *= Math.pow(0.4, dt); p.s += p.g * dt; }
      age(puffs, dt);
      for (const b of bits) { b.x += b.vx * dt; b.y += b.vy * dt; b.vy += 120 * G.s * dt; b.rot += dt * 6; }
      age(bits, dt);
      for (const d of dust) d.y += d.vy * dt;
      age(dust, dt);
      age(waves, dt);
      /* plancton */
      for (const p of plankton) {
        p.x += Math.sin(time * 0.6 + p.ph) * 3 * dt * AMB;
        p.y += Math.cos(time * 0.5 + p.ph * 1.7) * 2 * dt * AMB;
      }
      /* magma qui monte */
      if (Math.random() < dt * 1.2 * AMB) blobsUp.push({ u: 0, v: rand(0.12, 0.2), s: rand(2, 3.5) * G.s, t: 0, dur: 9 });
      for (const b of blobsUp) b.u += b.v * dt * AMB;
      for (let i = blobsUp.length - 1; i >= 0; i--) if (blobsUp[i].u >= 1) blobsUp.splice(i, 1);
      age(blobsUp, dt);
    }

    function drawPlate() {
      /* des chevrons qui avancent : la plaque glisse vers le continent et plonge */
      const p = platePath;
      const step = 26 * G.s;
      const off = plateShift % step;
      ctx.strokeStyle = rgba(plateSlide > 0.05 ? '#BFF5EA' : '#BED7D2', 0.32 + 0.5 * plateSlide);
      ctx.lineWidth = (1.6 + plateSlide) * G.s;
      ctx.lineCap = 'round';
      for (let d = off; d < p.total - 4; d += step) {
        const u = d / p.total;
        pathAt(p, u, tmp);
        const x = tmp[0], y = tmp[1];
        pathAt(p, Math.min(1, u + 0.01), tmp);
        const a = Math.atan2(tmp[1] - y, tmp[0] - x);
        const L = 5 * G.s;
        ctx.beginPath();
        ctx.moveTo(x - Math.cos(a - 0.6) * L, y - Math.sin(a - 0.6) * L);
        ctx.lineTo(x, y);
        ctx.lineTo(x - Math.cos(a + 0.6) * L, y - Math.sin(a + 0.6) * L);
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
    }

    function drawLayers() {
      if (!layers) return;
      const g = ctx;
      const th = (layers - 1 + ease.outCubic(layerGrow)) * 2.4 * G.s;
      if (th <= 0.1) return;
      g.fillStyle = '#FBF8EF';
      g.beginPath();
      trace(g, FLOOR.slice(1), false);
      for (let i = FLOOR.length - 1; i >= 1; i--) g.lineTo(X(FLOOR[i][0]), Y(FLOOR[i][1]) - th);
      g.closePath();
      g.fill();
      g.strokeStyle = 'rgba(160,150,125,0.5)';
      g.lineWidth = 0.7;
      g.stroke();
    }

    function drawRiver() {
      const p = riverPath;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#2E86B8';
      ctx.lineWidth = 4.5 * G.s;
      ctx.beginPath();
      for (let i = 0; i < p.pts.length; i++) {
        if (i === 0) ctx.moveTo(p.pts[i][0], p.pts[i][1]); else ctx.lineTo(p.pts[i][0], p.pts[i][1]);
      }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(140,215,245,0.7)';
      ctx.lineWidth = 1.6 * G.s;
      ctx.stroke();
      if (riverBoost > 0.02) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = rgba('#7FE3FF', 0.35 * riverBoost);
        ctx.lineWidth = 9 * G.s;
        ctx.beginPath();
        for (let i = 0; i < p.pts.length; i++) {
          if (i === 0) ctx.moveTo(p.pts[i][0], p.pts[i][1]); else ctx.lineTo(p.pts[i][0], p.pts[i][1]);
        }
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      }
      /* le courant : des reflets qui descendent */
      const n = 6 + Math.round(riverBoost * 6);
      const sp = (0.12 + riverBoost * 0.35) * AMB;
      for (let i = 0; i < n; i++) {
        const u = ((time * sp + i / n) % 1 + 1) % 1;
        pathAt(p, u, tmp);
        const a = 0.55 + riverBoost * 0.45;
        ctx.fillStyle = rgba('#E6FBFF', a * Math.sin(Math.PI * u));
        ctx.beginPath();
        ctx.arc(tmp[0], tmp[1], (1.4 + riverBoost) * G.s, 0, TAU);
        ctx.fill();
      }
      ctx.lineCap = 'butt';
      ctx.lineJoin = 'miter';
    }

    function drawSea() {
      /* surface de l'eau, avec de petites vagues */
      ctx.strokeStyle = 'rgba(190,245,235,0.55)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let x = X(0.565); x <= G.w + 2; x += 4) {
        const y = Y(SEA) + Math.sin(x * 0.08 + time * 1.6 * AMB) * 1.1;
        if (x === X(0.565)) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      for (const p of plankton) {
        ctx.fillStyle = p.col;
        ctx.globalAlpha = 0.5 + 0.4 * Math.sin(time * 2 + p.ph);
        ctx.fillRect(p.x, p.y, p.s, p.s);
      }
      ctx.globalAlpha = 1;
    }

    function drawMagma() {
      const k = 0.5 + 0.5 * Math.sin(time * 1.4 * AMB);
      ctx.globalCompositeOperation = 'lighter';
      draw.glow(ctx, X(CHAMBER[0]), Y(CHAMBER[1]), X(0.1) * (1 + 0.1 * k), '#FF9A3A', 0.18 + 0.12 * k);
      draw.glow(ctx, X(CRATER[0]), Y(CRATER[1]), 14 * G.s * (1 + 0.2 * k), '#FF7A30', 0.4 + 0.2 * k);
      for (const b of blobsUp) {
        pathAt(meltPath, b.u, tmp);
        ctx.fillStyle = 'rgba(255,190,90,0.75)';
        ctx.beginPath();
        ctx.arc(tmp[0], tmp[1], b.s, 0, TAU);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    function drawSky() {
      for (const p of smoke) {
        const q = p.t / p.dur;
        ctx.globalAlpha = 0.28 * Math.sin(Math.PI * Math.min(1, q * 1.5)) * (1 - q * 0.5);
        ctx.drawImage(puffSp, p.x - p.s, p.y - p.s, p.s * 2, p.s * 2);
      }
      ctx.globalAlpha = 1;
      const bob = Math.sin(time * 0.6 * AMB) * 1.5 * G.s;
      const cx = X(CLOUD[0]) + Math.sin(time * 0.25 * AMB) * 3 * G.s;
      const cy = Y(CLOUD[1]) + bob;
      ctx.drawImage(cloudSp.c, cx - cloudSp.w / 2, cy - cloudSp.h / 2, cloudSp.w, cloudSp.h);
      ctx.strokeStyle = 'rgba(170,220,240,0.6)';
      ctx.lineWidth = 1.1;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (const d of rain) {
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + 0.6 * G.s, d.y - 7 * G.s);
      }
      ctx.stroke();
      ctx.lineCap = 'butt';
    }

    function drawLoop() {
      /* la boucle du voyage : pointillé discret, éclairé sur les étapes déjà faites */
      const step = 9 * G.s;
      for (let k = 0; k < paths.length; k++) {
        const p = paths[k];
        let upTo = lit[k] ? 1 : 0;
        if (atom.moving && atom.k === k) {
          const u = clamp(atom.t / atom.dur);
          upTo = STATIONS[k].fall ? ease.inQuad(u) : ease.inOutSine(u);
        }
        for (let d = step * 0.5; d < p.total; d += step) {
          const on = d / p.total <= upTo;
          ctx.fillStyle = on ? 'rgba(95,224,198,0.62)' : 'rgba(230,246,243,0.16)';
          pathAt(p, d / p.total, tmp);
          ctx.beginPath();
          ctx.arc(tmp[0], tmp[1], on ? 1.4 * G.s : 1.1 * G.s, 0, TAU);
          ctx.fill();
        }
      }
    }

    function drawStations() {
      for (let k = 0; k < STATIONS.length; k++) {
        const st = STATIONS[k];
        const x = X(st.tap[0]), y = Y(st.tap[1]);
        if (k === next && !atom.moving) continue;
        ctx.strokeStyle = lit[k] ? 'rgba(95,224,198,0.7)' : 'rgba(230,246,243,0.3)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(x, y, 4.5 * G.s, 0, TAU);
        ctx.stroke();
        if (lit[k]) {
          ctx.fillStyle = 'rgba(95,224,198,0.85)';
          ctx.beginPath();
          ctx.arc(x, y, 2.2 * G.s, 0, TAU);
          ctx.fill();
        }
      }
      if (atom.moving) return;
      /* la prochaine étape pulse */
      const st = STATIONS[next];
      const x = X(st.tap[0]), y = Y(st.tap[1]);
      const ph = (time * 0.9) % 1;
      const R = 17 * G.s * (1 + 0.08 * Math.sin(time * 5) + nudge * 0.35);
      ctx.globalCompositeOperation = 'lighter';
      draw.glow(ctx, x, y, R * 2.2, '#5FE0C6', 0.25 + nudge * 0.3);
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = rgba('#5FE0C6', 0.6 * (1 - ph));
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, R + ph * 18 * G.s, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = '#8FF0DC';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(x, y, R, 0, TAU);
      ctx.stroke();
    }

    function drawFx() {
      for (const p of puffs) {
        const q = p.t / p.dur;
        ctx.globalAlpha = (p.col ? 0.5 : 0.72) * (1 - q) * Math.min(1, q * 6 + 0.3);
        ctx.drawImage(p.col ? dustSp : puffSp, p.x - p.s, p.y - p.s, p.s * 2, p.s * 2);
      }
      ctx.globalAlpha = 1;
      for (const b of bits) {
        const q = b.t / b.dur;
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.rot);
        ctx.globalAlpha = 1 - q * q;
        ctx.fillStyle = '#B59A92';
        ctx.fillRect(-b.s / 2, -b.s / 2, b.s, b.s * 0.8);
        ctx.fillStyle = 'rgba(40,30,30,0.6)';
        ctx.fillRect(-b.s / 2, b.s * 0.1, b.s * 0.5, b.s * 0.3);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      for (const d of dust) {
        const q = d.t / d.dur;
        ctx.fillStyle = rgba('#FFFFFF', 0.8 * Math.sin(Math.PI * q));
        ctx.fillRect(d.x, d.y, 1.6 * G.s, 1.6 * G.s);
      }
      for (const wv of waves) {
        const q = wv.t / wv.dur;
        ctx.strokeStyle = rgba(wv.col, 0.7 * (1 - q));
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(wv.x, wv.y, lerp(3, wv.R * G.s, ease.outCubic(q)), 0, TAU);
        ctx.stroke();
      }
    }

    /* L'atome de carbone : une petite sphère sombre, avec un halo. Ce qui l'entoure change :
       une goutte, une coquille, une couche de calcaire, puis la chaleur des profondeurs. */
    function drawAtom() {
      const { x, y } = atom;
      const s = G.s;
      for (const p of atom.trail) {
        const q = p.t / p.dur;
        ctx.fillStyle = rgba('#5FE0C6', 0.35 * (1 - q));
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.2 * s * (1 - q), 0, TAU);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'lighter';
      draw.glow(ctx, x, y, 20 * s, atom.heat > 0.05 ? '#FF8A3A' : '#5FE0C6', 0.55);
      ctx.globalCompositeOperation = 'source-over';
      /* dans une goutte de pluie */
      const inDrop = (atom.moving && (atom.k === 2 || (atom.k === 1 && atom.t / atom.dur > 0.85))) || (!atom.moving && rest === 1);
      if (inDrop) {
        ctx.fillStyle = 'rgba(150,215,245,0.4)';
        ctx.strokeStyle = 'rgba(200,240,255,0.85)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        const R = 9 * s;
        ctx.moveTo(x, y - R * 1.9);
        ctx.bezierCurveTo(x + R * 0.5, y - R * 0.9, x + R, y - R * 0.2, x + R, y + R * 0.15);
        ctx.arc(x, y + R * 0.15, R, 0, Math.PI);
        ctx.bezierCurveTo(x - R, y - R * 0.2, x - R * 0.5, y - R * 0.9, x, y - R * 1.9);
        ctx.fill();
        ctx.stroke();
      }
      /* dans l'eau de la roche et de la rivière */
      if ((!atom.moving && rest === 2) || (atom.moving && atom.k === 3)) {
        ctx.fillStyle = 'rgba(120,200,240,0.35)';
        ctx.beginPath();
        ctx.arc(x, y, 8 * s, 0, TAU);
        ctx.fill();
      }
      /* la coquille se forme autour */
      if ((atom.moving && atom.k === 4 && atom.t / atom.dur > 0.7) || (!atom.moving && rest === 4) || (atom.moving && atom.k === 5)) {
        const g = atom.moving && atom.k === 4 ? clamp((atom.t / atom.dur - 0.7) / 0.3) * 0.5 + shellGrow * 0.5 : 1;
        shellAt(ctx, x, y, 11 * s, true, ease.outCubic(clamp(g)), 0.6);
      }
      /* enfermé dans le calcaire */
      if ((!atom.moving && rest === 5) || (atom.moving && atom.k === 6 && atom.t / atom.dur < 0.3)) {
        ctx.fillStyle = 'rgba(250,246,236,0.85)';
        draw.roundRect(ctx, x - 9 * s, y - 5 * s, 18 * s, 10 * s, 4 * s);
        ctx.fill();
        ctx.strokeStyle = 'rgba(150,140,115,0.6)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
      const R = 6.4 * s;
      const gr = ctx.createRadialGradient(x - R * 0.35, y - R * 0.4, R * 0.1, x, y, R);
      gr.addColorStop(0, atom.heat > 0.05 ? '#FFD39A' : '#9AA3AC');
      gr.addColorStop(0.55, atom.heat > 0.05 ? lib.mix('#4A5058', '#E0652A', atom.heat) : '#4A5058');
      gr.addColorStop(1, '#1E2226');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(x, y, R, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.ellipse(x - R * 0.35, y - R * 0.4, R * 0.3, R * 0.18, -0.5, 0, TAU);
      ctx.fill();
    }

    function render() {
      if (!bg) return;
      ctx.drawImage(bg.c, 0, 0, G.w, G.h);
      drawMagma();
      drawPlate();
      drawLayers();
      drawSea();
      drawRiver();
      drawSky();
      drawLoop();
      drawStations();
      drawFx();
      drawAtom();
    }

    function init() {
      atom.moving = false;
      atom.k = -1;
      atom.heat = 0;
      atom.trail.length = 0;
      next = 0;
      rest = -1;
      lit = [];
      misses = 0;
      nudge = 0;
      finished = false;
      loopDone = false;
      layers = 0;
      layerGrow = 0;
      riverBoost = 0;
      rainBoost = 0;
      shellGrow = 0;
      gestureT = -1;
      puffs = []; bits = []; dust = []; waves = [];
      setAtomRest();
      showNext();
      api.gesture('tap', { x: STATIONS[0].tap[0] * 100, y: STATIONS[0].tap[1] * 100 });
    }

    function makePlankton() {
      plankton = [];
      const r = seeded(21);
      for (let i = 0; i < 34; i++) {
        plankton.push({
          x: X(0.62 + r() * 0.38), y: Y(SEA + 0.02 + r() * 0.13), s: (0.9 + r() * 1.3) * G.s, ph: r() * TAU,
          col: r() < 0.6 ? '#9BF0C8' : '#E6FBF4',
        });
      }
    }

    puffSp = makePuff();
    dustSp = makeDust();
    cv.onResize((w, h) => {
      geometry(w, h);
      makePlankton();
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
