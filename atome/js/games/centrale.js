/* De l'atome à la lampe : une centrale nucléaire en coupe qu'on met en marche, étape par étape,
   du cœur du réacteur jusqu'aux fenêtres de la ville. Pour finir, une petite question sur le
   nuage blanc qui sort de la tour de refroidissement. */
(function () {
  'use strict';
  const { lib } = window.RM;
  const { TAU, rand, clamp, lerp, ease, rgba, draw } = lib;

  /* Tous les textes du jeu, faciles à corriger */
  const TEXTES = {
    etapes: [
      'Les barres remontent : la fission chauffe l’eau.',
      'L’eau chauffée fait bouillir une autre eau, qui devient vapeur.',
      'La vapeur fait tourner la turbine.',
      'L’alternateur change ce mouvement en électricité.',
      'L’électricité voyage dans les lignes.',
      'La ville s’allume !',
    ],
    question: 'Et ce nuage blanc qui sort de la tour, c’est quoi ?',
    fumee: 'De la fumée',
    vapeur: 'De la vapeur d’eau',
    faux: 'Pas de feu dans une centrale nucléaire : ce nuage, c’est de l’eau qui s’évapore.',
    fin: 'Bravo : c’est de la vapeur d’eau, pas de la fumée !',
    finStatut: 'De l’atome à la lampe : fission, chaleur, vapeur, turbine, électricité.',
  };

  /* Délai (s) avant que l'élément suivant ne se laisse déclencher, après chaque étape */
  const DELAIS = [1.5, 1.3, 1.4, 1.1, 1.3, 2.3];
  /* Si l'enfant hésite aussi longtemps (s), le doigt fantôme revient sur l'élément suivant */
  const HESITE = 4;
  const DASH_EAU = [4, 4];
  const DASH_VAPEUR = [2.5, 4.5];

  const CSS = `
.game[data-game="centrale"] .ce-q {
  position: absolute; left: 0; right: 0; bottom: 12px; z-index: 4;
  display: flex; flex-wrap: wrap; justify-content: center; gap: 8px 10px; padding: 0 10px;
  transition: opacity .45s ease, transform .45s ease, visibility 0s linear 0s;
}
.game[data-game="centrale"] .ce-q.is-off {
  opacity: 0; transform: translateY(14px); visibility: hidden; pointer-events: none;
  transition: opacity .45s ease, transform .45s ease, visibility 0s linear .45s;
}
.game[data-game="centrale"] .ce-q .chip { transition: background .25s, color .25s, opacity .25s; }
.game[data-game="centrale"] .ce-q.ce-narrow { gap: 6px 8px; padding: 0 6px; }
.game[data-game="centrale"] .ce-q.ce-narrow .chip { font-size: 0.8125rem; padding: 8px 10px; }
.game[data-game="centrale"] .ce-q .chip.is-wrong { opacity: .55; animation: ce-shake .42s ease-in-out 1; }
.game[data-game="centrale"] .ce-q .chip.is-hint { animation: ce-glow 1.3s ease-in-out infinite; }
.game[data-game="centrale"] .ce-q .chip.is-right {
  background: var(--accent); color: var(--btn-fg);
  box-shadow: 0 0 0 4px rgba(63, 169, 255, .35), 0 6px 16px -8px rgba(0, 0, 0, .6);
}
@keyframes ce-shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 50% { transform: translateX(5px); } 75% { transform: translateX(-3px); } }
@keyframes ce-glow {
  0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(63, 169, 255, 0), 0 6px 16px -8px rgba(0, 0, 0, .6); }
  50% { transform: scale(1.06); box-shadow: 0 0 0 6px rgba(63, 169, 255, .6), 0 6px 16px -8px rgba(0, 0, 0, .6); }
}
`;

  function seeded(seed) {
    let s = seed >>> 0 || 1;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }

  /* Grain de béton, partagé (motif répété) */
  let GRAIN = null;
  function grain() {
    if (GRAIN) return GRAIN;
    const N = 80;
    const c = document.createElement('canvas');
    c.width = c.height = N;
    const g = c.getContext('2d');
    const im = g.createImageData(N, N);
    const nz = lib.makeNoise(17);
    const r = seeded(4);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const v = 0.6 * nz.fbm(x / 6, y / 6, 3) + 0.4 * r();
        const j = (y * N + x) * 4;
        const l = Math.round(v * 255);
        im.data[j] = l; im.data[j + 1] = l; im.data[j + 2] = l; im.data[j + 3] = 255;
      }
    }
    g.putImageData(im, 0, 0);
    GRAIN = c;
    return c;
  }

  /* Bouffées de vapeur : quelques boules douces qui se chevauchent, ombrées par-dessous
     et teintées de rose du côté du couchant (pré-rendues une fois) */
  let PUFF = null;
  function puffSprites() {
    if (PUFF) return PUFF;
    PUFF = [0, 1, 2].map((k) => {
      const N = 96;
      const c = document.createElement('canvas');
      c.width = c.height = N;
      const g = c.getContext('2d');
      const r = seeded(70 + k * 13);
      for (let i = 0; i < 8; i++) {
        const a = r() * TAU, d = r() * N * 0.16;
        const x = N / 2 + Math.cos(a) * d * 1.25, y = N / 2 + Math.sin(a) * d * 0.8;
        const rad = N * (0.15 + r() * 0.13);
        const gr = g.createRadialGradient(x, y, 0, x, y, rad);
        gr.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        gr.addColorStop(0.55, 'rgba(255, 255, 255, 0.55)');
        gr.addColorStop(1, 'rgba(255, 255, 255, 0)');
        g.fillStyle = gr;
        g.beginPath();
        g.arc(x, y, rad, 0, TAU);
        g.fill();
      }
      g.globalCompositeOperation = 'source-atop';
      const sh = g.createLinearGradient(0, N * 0.25, 0, N * 0.85);
      sh.addColorStop(0, 'rgba(255, 255, 255, 0)');
      sh.addColorStop(1, 'rgba(118, 132, 170, 0.6)');
      g.fillStyle = sh;
      g.fillRect(0, 0, N, N);
      const wm = g.createLinearGradient(0, 0, N * 0.6, 0);
      wm.addColorStop(0, 'rgba(255, 186, 156, 0.5)');
      wm.addColorStop(1, 'rgba(255, 186, 156, 0)');
      g.fillStyle = wm;
      g.fillRect(0, 0, N, N);
      return c;
    });
    return PUFF;
  }

  window.RM.games.centrale = function (api) {
    const cv = api.canvas();
    const ctx = cv.ctx;
    const RMO = api.reducedMotion;
    const AMB = RMO ? 0.35 : 1;
    api.style(CSS);

    /* ---- la question finale : deux boutons ---- */
    const qBar = document.createElement('div');
    qBar.className = 'ce-q is-off';
    function chip(label, fn) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = label;
      b.addEventListener('click', fn);
      return b;
    }
    const btnFumee = chip(TEXTES.fumee, () => answer(false));
    const btnVapeur = chip(TEXTES.vapeur, () => answer(true));
    qBar.append(btnFumee, btnVapeur);
    api.stage.appendChild(qBar);

    /* la scène ne doit jamais défiler (focus clavier d'un bouton, par exemple) */
    api.stage.addEventListener('scroll', () => {
      if (api.stage.scrollLeft || api.stage.scrollTop) {
        api.stage.scrollLeft = 0;
        api.stage.scrollTop = 0;
      }
    });

    /* ---- géométrie (unités virtuelles : la scène fait au moins 360 × 450) ---- */
    const L = { U: 1, VW: 360, VH: 450 };
    let bg = null;
    let wires = [];
    let town = [];
    let ripples = [];

    function towerR(y) {
      const T = L.tower;
      return T.rt * Math.sqrt(1 + Math.pow((y - T.yt) / T.b, 2));
    }

    function armsOf(P) {
      const h = P.base - P.top;
      return [{ y: P.top + h * 0.15, hw: h * 0.2 }, { y: P.top + h * 0.33, hw: h * 0.25 }];
    }

    function layout(w, h) {
      const U = Math.min(w / 360, h / 450);
      const VW = w / U, VH = h / U;
      const CW = Math.min(VW, 470);
      const ox = (VW - CW) / 2;
      const xs = CW - 360;
      const Tb = VH - 64;                          /* pied des maisons */
      const G1 = Tb - 138 - (VH - 450) * 0.3;      /* sol de la centrale */
      const LF = Tb - G1;
      Object.assign(L, { U, VW, VH, CW, ox, Tb, G1, LF });

      /* bâtiment réacteur (dôme) */
      const dx0 = ox + 8 + xs * 0.08;
      const DW = clamp(CW * 0.4, 144, 176);
      const D = L.dome = { x0: dx0, x1: dx0 + DW, base: G1, wallTop: G1 - 64, capH: DW * 0.38, t: 7 };
      D.cx = (D.x0 + D.x1) / 2;
      D.top = D.wallTop - D.capH;
      const V = L.vessel = { x: D.x0 + DW * 0.31, top: G1 - 100, bot: G1 - 12, r: 19 };
      V.coreTop = G1 - 58;
      V.coreBot = G1 - 22;
      L.sg = { x: D.x0 + DW * 0.72, top: G1 - 99, mid: G1 - 66, bot: G1 - 12, ru: 13, rl: 10, water: G1 - 60 };
      L.yHot = G1 - 54;
      L.yCold = G1 - 26;

      /* salle des machines */
      const hx0 = D.x1 + 8 + xs * 0.2;
      const hx1 = ox + CW - 8 - xs * 0.08;
      const H = L.hall = { x0: hx0, x1: hx1, top: G1 - 98, base: G1 };
      const inner = hx1 - hx0 - 10;
      const gx = hx0 + 5 + Math.max(7, (inner - 138) * 0.4);
      const ty = G1 - 38;
      L.turb = { x0: gx, x1: gx + 84, y: ty, discs: [{ x: gx + 17, r: 11 }, { x: gx + 41, r: 16 }, { x: gx + 67, r: 21 }] };
      L.alt = { x0: gx + 92, x1: gx + 138, y: ty, r: 17 };
      L.ySteam = G1 - 84;

      /* tour de refroidissement, derrière la salle des machines : une hyperboloïde large,
         dont on voit le haut, la taille fine puis le début de l'évasement */
      const T = L.tower = { cx: hx0 + (hx1 - hx0) * 0.5, top: H.top - 88, base: G1, rt: 22 };
      T.b = 88 / 1.9;
      T.yt = T.top + 0.55 * T.b;

      /* rivière, pylônes, ville */
      L.riverTop = G1 + LF * 0.09;
      L.riverBot = G1 + LF * 0.22;
      L.p1 = { x: ox + CW * 0.89, base: G1 + LF * 0.66, top: G1 - 10 };
      L.p2 = { x: ox + CW * 0.63, base: G1 + LF * 0.86, top: G1 + LF * 0.32 };
      L.pole = { x: ox + CW * 0.455, base: Tb + 1, top: Tb - 38 };
      L.townX1 = ox + CW * 0.43;

      buildTown();
      buildWires();
      buildRipples();

      /* trajets des flux d'eau et de vapeur (calculés une fois) */
      const SGx = L.sg;
      L.hotPts = [[V.x + V.r - 3, L.yHot], [SGx.x - SGx.rl + 2, L.yHot]];
      L.coldPts = [[SGx.x - SGx.rl + 2, L.yCold], [V.x + V.r - 3, L.yCold]];
      L.steamPts = [[SGx.x + SGx.ru - 2, L.ySteam], [L.turb.x0 + 9, L.ySteam], [L.turb.x0 + 9, ty - 12]];

      /* zones à toucher (et anneaux lumineux) */
      L.tg = [
        { cx: V.x, cy: (V.top + V.bot) / 2 - 3, rx: V.r + 7, ry: (V.bot - V.top) / 2 + 9 },
        { cx: L.sg.x, cy: (L.sg.top + L.sg.bot) / 2, rx: L.sg.ru + 7, ry: (L.sg.bot - L.sg.top) / 2 + 7 },
        { cx: (L.turb.x0 + L.turb.x1) / 2, cy: ty, rx: 50, ry: 30 },
        { cx: (L.alt.x0 + L.alt.x1) / 2 + 2, cy: ty, rx: 32, ry: 27 },
        { cx: (L.p1.x + L.p2.x) / 2, cy: (L.p1.top + L.p2.base) / 2, rx: (L.p1.x - L.p2.x) / 2 + 30, ry: (L.p2.base - L.p1.top) / 2 + 6 },
        { cx: (4 + L.townX1) / 2, cy: Tb - 25, rx: (L.townX1 - 4) / 2 + 6, ry: 34 },
      ];
      L.towerBox = { cx: T.cx, cy: T.top + 26, rx: 40, ry: 48 };
    }

    /* ---- la petite ville ---- */
    function buildTown() {
      const r = seeded(21);
      const x1 = L.townX1;
      town = [];
      const rows = [
        { base: L.Tb - 10, x: -6, wMin: 15, wMax: 24, hMin: 24, hMax: 50, gap: 1, back: true },
        { base: L.Tb, x: 3, wMin: 20, wMax: 30, hMin: 17, hMax: 33, gap: 4, back: false },
      ];
      for (const row of rows) {
        let x = row.x;
        while (x < x1 - (row.back ? 10 : 18)) {
          const w = lerp(row.wMin, row.wMax, r());
          const h = lerp(row.hMin, row.hMax, r());
          const gable = r() < (row.back ? 0.35 : 0.75);
          const b = { x, w, h, base: row.base, gable, back: row.back, roofH: gable ? w * 0.36 : 3, windows: [], lit: 0 };
          const cols = Math.max(1, Math.floor((w - 5) / 7));
          const nrow = Math.max(1, Math.floor((h - 7) / 9));
          const sx = (w - cols * 7 + 3) / 2;
          for (let i = 0; i < nrow; i++) {
            for (let j = 0; j < cols; j++) {
              if (!row.back && i === nrow - 1 && j === Math.floor(cols / 2) && h < 26) continue; /* place de la porte */
              b.windows.push({ x: x + sx + j * 7, y: row.base - h + 5 + i * 9, on: r() < 0.88, d: r() });
            }
          }
          town.push(b);
          x += w + row.gap + r() * 4;
        }
      }
      /* ordre d'allumage : un peu au hasard, mais en vague depuis le pylône */
      town.forEach((bd) => bd.windows.forEach((wd) => {
        wd.delay = clamp(1 - (wd.x + 6) / (x1 + 6)) * 1.1 + wd.d * 0.9;
      }));
      L.lamps = [x1 * 0.18, x1 * 0.55, x1 * 0.92].map((x) => ({ x, y: L.Tb + 6 }));
    }

    /* ---- les fils électriques (échantillonnés pour faire voyager les impulsions) ---- */
    function buildWires() {
      const A = L.alt, H = L.hall;
      const a1 = armsOf(L.p1), a2 = armsOf(L.p2);
      const poleArm = { y: L.pole.top + 4, hw: 7 };
      const bush = [{ x: H.x1 + 4, y: L.G1 - 58 }, { x: H.x1 + 4, y: L.G1 - 46 }];
      const house = town.filter((b) => !b.back).reduce((m, b) => (b.x > m.x ? b : m), town[0]);
      const end = { x: house.x + house.w, y: house.base - house.h + 4 };
      L.bush = bush;
      wires = [0, 1].map((k) => {
        const pts = [];
        const add = (x, y) => pts.push(x, y);
        /* dans la salle des machines : du bornier de l'alternateur jusqu'au mur */
        const tx = A.x1 - 9 + k * 4;
        add(tx, A.y - A.r - 6);
        add(tx, bush[k].y);
        add(H.x1 - 2, bush[k].y);
        add(bush[k].x, bush[k].y);
        /* dehors : portées en chaînette */
        const span = (x0, y0, x1, y1, sag) => {
          for (let i = 1; i <= 24; i++) {
            const t = i / 24;
            add(lerp(x0, x1, t), lerp(y0, y1, t) + sag * 4 * t * (1 - t));
          }
        };
        const r1 = { x: L.p1.x + a1[k].hw, y: a1[k].y + 3 };
        const l1 = { x: L.p1.x - a1[k].hw, y: a1[k].y + 3 };
        const r2 = { x: L.p2.x + a2[k].hw, y: a2[k].y + 3 };
        const l2 = { x: L.p2.x - a2[k].hw, y: a2[k].y + 3 };
        const pr = { x: L.pole.x + (k ? -poleArm.hw : poleArm.hw), y: poleArm.y + 2 };
        span(bush[k].x, bush[k].y, r1.x, r1.y, 6);
        add(l1.x, l1.y);
        span(l1.x, l1.y, r2.x, r2.y, 9);
        add(l2.x, l2.y);
        span(l2.x, l2.y, pr.x, pr.y, 7);
        if (k === 0) {
          add(L.pole.x, pr.y);
          span(L.pole.x, pr.y, end.x, end.y, 4);
        }
        /* longueurs cumulées */
        const n = pts.length / 2;
        const cum = new Float32Array(n);
        for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(pts[2 * i] - pts[2 * i - 2], pts[2 * i + 1] - pts[2 * i - 1]);
        return { pts: new Float32Array(pts), cum, len: cum[n - 1], inside: 3 };
      });
    }

    function wireAt(wr, d, out) {
      const { pts, cum } = wr;
      let lo = 0, hi = cum.length - 1;
      while (hi - lo > 1) {
        const m = (lo + hi) >> 1;
        if (cum[m] < d) lo = m; else hi = m;
      }
      const t = cum[hi] > cum[lo] ? clamp((d - cum[lo]) / (cum[hi] - cum[lo])) : 0;
      out.x = lerp(pts[2 * lo], pts[2 * hi], t);
      out.y = lerp(pts[2 * lo + 1], pts[2 * hi + 1], t);
      return out;
    }

    function buildRipples() {
      const r = seeded(9);
      ripples = [];
      for (let i = 0; i < 16; i++) {
        ripples.push({ x: r() * L.VW, y: lerp(L.riverTop + 3, L.riverBot - 2, r()), len: 5 + r() * 12, ph: r() * TAU, sp: 2 + r() * 4 });
      }
    }

    /* ---- chemins ---- */
    function capsuleV(g, x, y0, y1, r) {
      g.beginPath();
      g.arc(x, y0 + r, r, Math.PI, 0);
      g.arc(x, y1 - r, r, 0, Math.PI);
      g.closePath();
    }
    function domePath(g, inset) {
      const D = L.dome;
      g.beginPath();
      g.moveTo(D.x0 + inset, D.base);
      g.lineTo(D.x0 + inset, D.wallTop);
      g.ellipse(D.cx, D.wallTop, (D.x1 - D.x0) / 2 - inset, D.capH - inset, 0, Math.PI, TAU);
      g.lineTo(D.x1 - inset, D.base);
      g.closePath();
    }
    function sgPath(g, inset) {
      const S = L.sg;
      const ru = S.ru - inset, rl = S.rl - inset;
      g.beginPath();
      g.arc(S.x, S.top + ru + inset, ru, Math.PI, 0);
      g.lineTo(S.x + ru, S.mid - 5);
      g.lineTo(S.x + rl, S.mid + 5);
      g.arc(S.x, S.bot - rl - inset, rl, 0, Math.PI);
      g.lineTo(S.x - rl, S.mid + 5);
      g.lineTo(S.x - ru, S.mid - 5);
      g.closePath();
    }
    function hallPath(g, inset) {
      const H = L.hall;
      g.beginPath();
      g.moveTo(H.x0 + inset, H.base);
      g.lineTo(H.x0 + inset, H.top + 9 + inset);
      g.quadraticCurveTo((H.x0 + H.x1) / 2, H.top - 5 + inset * 1.6, H.x1 - inset, H.top + 9 + inset);
      g.lineTo(H.x1 - inset, H.base);
      g.closePath();
    }
    function towerPath(g, y0, y1) {
      const T = L.tower;
      g.beginPath();
      for (let i = 0; i <= 24; i++) {
        const y = lerp(y0, y1, i / 24);
        g.lineTo(T.cx - towerR(y), y);
      }
      for (let i = 24; i >= 0; i--) {
        const y = lerp(y0, y1, i / 24);
        g.lineTo(T.cx + towerR(y), y);
      }
      g.closePath();
    }
    function steelH(g, x0, x1, dark, light) {
      const gr = g.createLinearGradient(x0, 0, x1, 0);
      gr.addColorStop(0, dark);
      gr.addColorStop(0.32, light);
      gr.addColorStop(0.7, lib.mix(dark, light, 0.45));
      gr.addColorStop(1, dark);
      return gr;
    }
    function steelV(g, y0, y1, dark, light) {
      const gr = g.createLinearGradient(0, y0, 0, y1);
      gr.addColorStop(0, lib.mix(dark, light, 0.6));
      gr.addColorStop(0.3, light);
      gr.addColorStop(1, dark);
      return gr;
    }
    function pipe(g, pts, wdt) {
      g.lineJoin = 'round';
      g.lineCap = 'round';
      g.beginPath();
      pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.strokeStyle = '#6B7895';
      g.lineWidth = wdt;
      g.stroke();
      g.strokeStyle = 'rgba(214, 226, 242, 0.35)';
      g.lineWidth = wdt * 0.25;
      g.save();
      g.translate(0, -wdt * 0.22);
      g.stroke();
      g.restore();
      g.strokeStyle = '#0B1830';
      g.lineWidth = wdt * 0.42;
      g.stroke();
    }
    function textureIn(g, x, y, w, h, alpha) {
      g.save();
      g.globalCompositeOperation = 'overlay';
      g.globalAlpha = alpha;
      g.fillStyle = g.createPattern(grain(), 'repeat');
      g.fillRect(x, y, w, h);
      g.restore();
    }

    /* ---- fond pré-rendu : paysage au crépuscule et toutes les parties fixes ---- */
    function paintBg() {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(cv.w * cv.dpr));
      c.height = Math.max(1, Math.round(cv.h * cv.dpr));
      const g = c.getContext('2d');
      g.scale(cv.dpr * L.U, cv.dpr * L.U);
      const { VW, VH, G1, Tb } = L;

      /* ciel du soir */
      const sky = g.createLinearGradient(0, 0, 0, G1);
      sky.addColorStop(0, '#060F22');
      sky.addColorStop(0.42, '#0F2049');
      sky.addColorStop(0.7, '#2A3166');
      sky.addColorStop(0.87, '#7A4E74');
      sky.addColorStop(1, '#D88660');
      g.fillStyle = sky;
      g.fillRect(0, 0, VW, G1 + 2);
      draw.glow(g, VW * 0.08, G1, VW * 0.62, '#FFB46E', 0.42);
      draw.glow(g, VW * 0.75, G1 - 10, VW * 0.45, '#E07A6A', 0.16);
      const rs = seeded(5);
      for (let i = 0; i < 52; i++) {
        const y = rs() * G1 * 0.55;
        const x = rs() * VW;
        const s = 0.5 + rs() * 0.9;
        g.fillStyle = rgba('#FFFFFF', (0.12 + rs() * 0.55) * (1 - y / (G1 * 0.6)));
        g.fillRect(x, y, s, s);
      }
      /* traînées de nuages, éclairées par-dessous par le soleil couché */
      const streak = (fx, fy, len, th, seed) => {
        const rr = seeded(seed);
        const cx = VW * fx, cy = G1 * fy;
        for (let i = 0; i < 9; i++) {
          const x = cx + (i / 8 - 0.5) * len + (rr() - 0.5) * 10, y = cy + (rr() - 0.5) * th * 1.4;
          const rx = len * (0.12 + rr() * 0.12), ry = th * (0.35 + rr() * 0.4);
          const gr = g.createLinearGradient(0, y - ry, 0, y + ry);
          gr.addColorStop(0, 'rgba(70, 62, 112, 0)');
          gr.addColorStop(0.6, 'rgba(120, 86, 136, 0.16)');
          gr.addColorStop(1, 'rgba(240, 160, 136, 0.24)');
          g.fillStyle = gr;
          g.beginPath();
          g.ellipse(x, y, rx, ry, 0, 0, TAU);
          g.fill();
        }
      };
      streak(0.16, 0.6, 150, 6, 3);
      streak(0.55, 0.42, 120, 4, 7);
      streak(0.86, 0.68, 110, 5, 12);
      /* collines lointaines */
      const ridge = (yb, amp, seed, col, fx) => {
        const n = lib.makeNoise(seed);
        g.beginPath();
        g.moveTo(0, G1 + 1);
        for (let x = 0; x <= VW + 6; x += 5) g.lineTo(x, yb - amp * n.fbm(x / fx + seed, seed * 0.37, 3));
        g.lineTo(VW + 6, G1 + 1);
        g.closePath();
        g.fillStyle = col;
        g.fill();
      };
      ridge(G1 - 6, 58, 3, 'rgba(70, 58, 108, 0.75)', 70);
      ridge(G1 + 2, 34, 8, '#1E2350', 45);

      /* tour de refroidissement */
      const T = L.tower;
      const yLow = L.hall.top + 12;
      g.save();
      towerPath(g, T.top, yLow);
      const rLow = towerR(yLow);
      const tgr = g.createLinearGradient(T.cx - rLow, 0, T.cx + rLow, 0);
      tgr.addColorStop(0, '#D3ABA0');
      tgr.addColorStop(0.28, '#A097AD');
      tgr.addColorStop(0.7, '#555A80');
      tgr.addColorStop(1, '#2C3253');
      g.fillStyle = tgr;
      g.fill();
      g.clip();
      textureIn(g, T.cx - rLow, T.top - 4, rLow * 2, yLow - T.top + 4, 0.4);
      /* nervures verticales du voile de béton, qui suivent la courbe */
      g.lineWidth = 0.6;
      for (let i = -6; i <= 6; i++) {
        const f = i / 7;
        g.strokeStyle = `rgba(20, 24, 50, ${0.07 + 0.05 * Math.abs(f)})`;
        g.beginPath();
        for (let j = 0; j <= 12; j++) {
          const y = lerp(T.top, yLow, j / 12);
          const x = T.cx + f * towerR(y);
          if (j) g.lineTo(x, y); else g.moveTo(x, y);
        }
        g.stroke();
      }
      g.lineWidth = 0.7;
      for (let i = 1; i < 6; i++) {
        const y = lerp(T.top, yLow, i / 6);
        const r = towerR(y);
        g.strokeStyle = 'rgba(16, 20, 44, 0.14)';
        g.beginPath();
        g.ellipse(T.cx, y, r, r * 0.12, 0, 0.05, Math.PI - 0.05);
        g.stroke();
      }
      /* lumière du couchant sur le bord gauche */
      const lg = g.createLinearGradient(T.cx - rLow, 0, T.cx - rLow * 0.4, 0);
      lg.addColorStop(0, 'rgba(255, 196, 160, 0.35)');
      lg.addColorStop(1, 'rgba(255, 196, 160, 0)');
      g.fillStyle = lg;
      g.fillRect(T.cx - rLow, T.top, rLow, yLow - T.top);
      g.restore();
      const rT = towerR(T.top);
      g.fillStyle = '#1C2140';
      g.beginPath();
      g.ellipse(T.cx, T.top, rT, rT * 0.2, 0, 0, TAU);
      g.fill();
      g.strokeStyle = 'rgba(240, 214, 200, 0.7)';
      g.lineWidth = 1;
      g.beginPath();
      g.ellipse(T.cx, T.top, rT, rT * 0.2, 0, 0.1, Math.PI - 0.1);
      g.stroke();

      /* bâtiment réacteur : coque de béton coupée, intérieur visible */
      const D = L.dome;
      g.save();
      g.fillStyle = 'rgba(0, 0, 0, 0.35)';
      g.beginPath();
      g.ellipse(D.cx + 6, G1 + 1, (D.x1 - D.x0) * 0.56, 4, 0, 0, TAU);
      g.fill();
      domePath(g, 0);
      const dg = g.createLinearGradient(D.x0, 0, D.x1, 0);
      dg.addColorStop(0, '#D2B4AA');
      dg.addColorStop(0.25, '#9D97AE');
      dg.addColorStop(1, '#3E4569');
      g.fillStyle = dg;
      g.fill();
      g.clip();
      textureIn(g, D.x0, D.top, D.x1 - D.x0, G1 - D.top, 0.45);
      g.restore();
      domePath(g, D.t);
      const ig = g.createLinearGradient(0, D.top, 0, G1);
      ig.addColorStop(0, '#0A1529');
      ig.addColorStop(1, '#152A4B');
      g.fillStyle = ig;
      g.fill();
      g.save();
      domePath(g, D.t);
      g.clip();
      g.strokeStyle = 'rgba(0, 0, 0, 0.35)';
      g.lineWidth = 6;
      domePath(g, D.t - 3);
      g.stroke();
      g.restore();
      /* liseré de lumière du couchant sur la gauche du dôme */
      g.strokeStyle = 'rgba(255, 214, 180, 0.55)';
      g.lineWidth = 1.2;
      g.beginPath();
      g.ellipse(D.cx, D.wallTop, (D.x1 - D.x0) / 2 - 0.6, D.capH - 0.6, 0, Math.PI * 1.02, Math.PI * 1.45);
      g.stroke();
      g.fillStyle = '#26324F';
      g.fillRect(D.x0 + D.t, G1 - 6, D.x1 - D.x0 - D.t * 2, 6);

      /* puits du réacteur, cuve d'acier et mécanismes des barres */
      const V = L.vessel;
      g.fillStyle = '#1F2C4B';
      draw.roundRect(g, V.x - 27, G1 - 44, 54, 39, 4);
      g.fill();
      textureIn(g, V.x - 27, G1 - 44, 54, 39, 0.3);
      g.fillStyle = steelH(g, V.x - 3, V.x + 3, '#5B6782', '#B8C3D4');
      for (const dx of [-7, 0, 7]) {
        draw.roundRect(g, V.x + dx - 1.8, V.top - 7, 3.6, 9, 1.4);
        g.fill();
      }
      capsuleV(g, V.x, V.top, V.bot, V.r);
      g.fillStyle = steelH(g, V.x - V.r, V.x + V.r, '#344058', '#B4C0D2');
      g.fill();
      capsuleV(g, V.x, V.top + 4, V.bot - 4, V.r - 4);
      g.fillStyle = '#0A1A33';
      g.fill();

      /* circuit primaire : branche chaude en haut, froide en bas, avec sa pompe */
      const SG = L.sg;
      pipe(g, [[V.x + V.r - 3, L.yHot], [SG.x - SG.rl + 2, L.yHot]], 6);
      pipe(g, [[SG.x - SG.rl + 2, L.yCold], [V.x + V.r - 3, L.yCold]], 6);
      const pmx = (V.x + V.r + SG.x - SG.rl) / 2;
      g.fillStyle = steelV(g, L.yCold - 6, L.yCold + 6, '#3E4A63', '#C3CDDD');
      g.beginPath();
      g.arc(pmx, L.yCold, 5.5, 0, TAU);
      g.fill();
      g.fillStyle = '#26314B';
      g.beginPath();
      g.arc(pmx, L.yCold, 2.2, 0, TAU);
      g.fill();

      /* générateur de vapeur */
      sgPath(g, 0);
      g.fillStyle = steelH(g, SG.x - SG.ru, SG.x + SG.ru, '#344058', '#B4C0D2');
      g.fill();
      sgPath(g, 3.5);
      g.fillStyle = '#0B1A33';
      g.fill();

      /* salle des machines : bardage métallique, intérieur éclairé */
      const H = L.hall;
      g.fillStyle = 'rgba(0, 0, 0, 0.35)';
      g.beginPath();
      g.ellipse((H.x0 + H.x1) / 2 + 6, G1 + 1, (H.x1 - H.x0) * 0.55, 4, 0, 0, TAU);
      g.fill();
      g.save();
      hallPath(g, 0);
      const hg = g.createLinearGradient(H.x0, 0, H.x1, 0);
      hg.addColorStop(0, '#9C94AE');
      hg.addColorStop(0.35, '#646C8E');
      hg.addColorStop(1, '#353C60');
      g.fillStyle = hg;
      g.fill();
      g.clip();
      g.strokeStyle = 'rgba(10, 14, 34, 0.22)';
      g.lineWidth = 0.8;
      for (let x = H.x0 + 2; x < H.x1; x += 3.2) {
        g.beginPath();
        g.moveTo(x, H.top - 6);
        g.lineTo(x, G1);
        g.stroke();
      }
      g.restore();
      hallPath(g, 5);
      const hig = g.createLinearGradient(0, H.top, 0, G1);
      hig.addColorStop(0, '#0D1A33');
      hig.addColorStop(1, '#18294A');
      g.fillStyle = hig;
      g.fill();
      g.save();
      hallPath(g, 5);
      g.clip();
      g.fillStyle = 'rgba(255, 255, 255, 0.03)';
      for (let x = H.x0 + 26; x < H.x1 - 10; x += 34) g.fillRect(x, H.top, 5, G1 - H.top);
      g.strokeStyle = 'rgba(160, 176, 206, 0.35)';
      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(H.x0 + 5, H.top + 22);
      g.lineTo(H.x1 - 5, H.top + 22);
      g.stroke();
      for (const fx of [0.22, 0.55, 0.85]) {
        const lx = lerp(H.x0, H.x1, fx);
        draw.glow(g, lx, H.top + 14, 22, '#FFD7A0', 0.16);
        g.fillStyle = '#FFE6BE';
        g.fillRect(lx - 3, H.top + 11, 6, 1.6);
      }
      g.restore();
      g.fillStyle = '#26324F';
      g.fillRect(H.x0 + 5, G1 - 6, H.x1 - H.x0 - 10, 6);

      /* tuyau de vapeur : du générateur de vapeur jusqu'à la turbine */
      const Tu = L.turb;
      pipe(g, [[SG.x + SG.ru - 2, L.ySteam], [Tu.x0 + 9, L.ySteam], [Tu.x0 + 9, Tu.y - 12]], 5);

      /* socle, turbine et alternateur */
      const A = L.alt;
      g.fillStyle = '#273454';
      draw.roundRect(g, Tu.x0 - 6, Tu.y + 18, A.x1 - Tu.x0 + 12, G1 - 6 - (Tu.y + 18), 3);
      g.fill();
      textureIn(g, Tu.x0 - 6, Tu.y + 18, A.x1 - Tu.x0 + 12, G1 - Tu.y - 24, 0.3);
      g.beginPath();
      g.moveTo(Tu.x0, Tu.y - 14);
      g.lineTo(Tu.x1, Tu.y - 25);
      g.lineTo(Tu.x1, Tu.y + 25);
      g.lineTo(Tu.x0, Tu.y + 14);
      g.closePath();
      const cg = g.createLinearGradient(0, Tu.y - 25, 0, Tu.y + 25);
      cg.addColorStop(0, '#22304F');
      cg.addColorStop(0.5, '#141F38');
      cg.addColorStop(1, '#1B2742');
      g.fillStyle = cg;
      g.fill();
      g.strokeStyle = '#6A79A0';
      g.lineWidth = 1.6;
      g.stroke();
      g.strokeStyle = 'rgba(220, 230, 245, 0.35)';
      g.lineWidth = 0.8;
      g.beginPath();
      g.moveTo(Tu.x0 + 1, Tu.y - 13);
      g.lineTo(Tu.x1 - 1, Tu.y - 24);
      g.stroke();
      g.lineCap = 'round';
      g.strokeStyle = steelV(g, Tu.y - 2, Tu.y + 2, '#55617C', '#C9D3E2');
      g.lineWidth = 3.2;
      g.beginPath();
      g.moveTo(Tu.x0 - 8, Tu.y);
      g.lineTo(A.x0 + 2, Tu.y);
      g.stroke();
      g.fillStyle = '#4B5876';
      draw.roundRect(g, Tu.x0 - 9, Tu.y - 5, 6, 23, 2);
      g.fill();
      draw.roundRect(g, Tu.x1 + 1, Tu.y - 5, 6, 23, 2);
      g.fill();
      /* corps de l'alternateur */
      draw.roundRect(g, A.x0, A.y - A.r, A.x1 - A.x0, A.r * 2, 7);
      g.fillStyle = steelV(g, A.y - A.r, A.y + A.r, '#26304B', '#8A99B4');
      g.fill();
      for (let i = 0; i < 5; i++) {
        const bx = A.x0 + 6 + i * 7.4;
        g.fillStyle = steelV(g, A.y - A.r, A.y + A.r, '#6B3B1E', '#E0A066');
        g.fillRect(bx, A.y - A.r + 2.5, 3.6, A.r * 2 - 5);
      }
      g.fillStyle = '#0E1628';
      g.beginPath();
      g.ellipse(A.x1, A.y, 6.5, A.r - 1, 0, 0, TAU);
      g.fill();
      g.strokeStyle = '#97A4BE';
      g.lineWidth = 1.2;
      g.stroke();
      g.fillStyle = '#56627F';
      draw.roundRect(g, A.x1 - 15, A.y - A.r - 7, 13, 8, 2);
      g.fill();

      /* rive de la centrale : strates de roche */
      const rt = L.riverTop, rb = L.riverBot;
      const strata = [['#40456A', 0], ['#33385B', 0.35], ['#292D4C', 0.7]];
      strata.forEach(([col, f]) => {
        g.fillStyle = col;
        g.fillRect(0, G1 + (rt - G1) * f, VW, (rt - G1) * 0.36 + 0.5);
      });
      textureIn(g, 0, G1, VW, rt - G1, 0.35);
      g.fillStyle = 'rgba(255, 210, 170, 0.35)';
      g.fillRect(0, G1, VW, 0.8);
      /* rivière */
      const rg = g.createLinearGradient(0, rt, 0, rb);
      rg.addColorStop(0, '#7B5674');
      rg.addColorStop(0.45, '#3A3E72');
      rg.addColorStop(1, '#1F2856');
      g.fillStyle = rg;
      g.fillRect(0, rt, VW, rb - rt);
      draw.glow(g, VW * 0.12, rt + 2, VW * 0.4, '#FFB070', 0.22);
      /* plaine */
      const pg = g.createLinearGradient(0, rb, 0, VH);
      pg.addColorStop(0, '#16253F');
      pg.addColorStop(1, '#0A1426');
      g.fillStyle = pg;
      g.fillRect(0, rb, VW, VH - rb);
      g.fillStyle = 'rgba(150, 170, 210, 0.18)';
      g.fillRect(0, rb, VW, 0.8);
      textureIn(g, 0, rb, VW, VH - rb, 0.18);
      /* une rangée de peupliers sur la berge */
      const pops = [0.02, 0.07, 0.12, 0.3, 0.36, 0.46, 0.76, 0.98];
      pops.forEach((fx, i) => {
        const x = L.ox + L.CW * fx + (L.ox > 0 && fx < 0.2 ? -L.ox * (1 - fx * 4) : 0);
        const base = rb + 5;
        const hgt = 20 + ((i * 7) % 3) * 5, wd = 3.6 + (i % 2) * 1.2;
        g.fillStyle = '#0B1529';
        g.fillRect(x - 0.6, base - 4, 1.2, 4);
        g.beginPath();
        g.ellipse(x, base - 3 - hgt / 2, wd, hgt / 2, 0, 0, TAU);
        const pgr = g.createLinearGradient(x - wd, 0, x + wd, 0);
        pgr.addColorStop(0, '#4A4366');
        pgr.addColorStop(0.35, '#22304F');
        pgr.addColorStop(1, '#111D36');
        g.fillStyle = pgr;
        g.fill();
      });
      /* route et premier plan */
      const fg = g.createLinearGradient(0, Tb, 0, VH);
      fg.addColorStop(0, 'rgba(10, 18, 34, 0)');
      fg.addColorStop(1, 'rgba(6, 12, 24, 0.6)');
      g.fillStyle = fg;
      g.fillRect(0, Tb, VW, VH - Tb);
      g.fillStyle = '#1A2642';
      g.fillRect(0, Tb + 3, VW, 9);
      g.fillStyle = 'rgba(160, 180, 220, 0.16)';
      g.fillRect(0, Tb + 3, VW, 0.7);
      g.fillStyle = 'rgba(255, 220, 170, 0.12)';
      for (let x = 4; x < VW; x += 16) g.fillRect(x, Tb + 7.2, 7, 0.9);
      /* buissons bas de l'autre côté de la route */
      const rh = seeded(52);
      for (let x = -4; x < VW + 8; x += 6 + rh() * 14) {
        const r = 2.6 + rh() * 4;
        const y = Tb + 14 + r * 0.4;
        const bgr = g.createLinearGradient(x - r, y - r, x + r, y + r);
        bgr.addColorStop(0, '#2A3456');
        bgr.addColorStop(1, '#0E182C');
        g.fillStyle = bgr;
        g.beginPath();
        g.ellipse(x, y, r * 1.3, r, 0, Math.PI, TAU);
        g.closePath();
        g.fill();
      }

      /* pylônes et câbles (éteints) */
      pylon(g, L.p1);
      pylon(g, L.p2);
      g.strokeStyle = '#7C8AB0';
      g.lineWidth = 1.3;
      g.beginPath();
      g.moveTo(L.pole.x, L.pole.base);
      g.lineTo(L.pole.x, L.pole.top);
      g.moveTo(L.pole.x - 8, L.pole.top + 4);
      g.lineTo(L.pole.x + 8, L.pole.top + 4);
      g.stroke();
      g.fillStyle = '#5E6A8C';
      draw.roundRect(g, L.pole.x - 3, L.pole.top + 10, 6, 7, 1.5);
      g.fill();
      for (const b of L.bush) {
        g.fillStyle = '#9AA6C2';
        draw.roundRect(g, L.hall.x1 - 1, b.y - 1.8, 6, 3.6, 1.2);
        g.fill();
      }
      g.strokeStyle = 'rgba(120, 136, 176, 0.75)';
      g.lineWidth = 0.9;
      for (const wr of wires) {
        g.beginPath();
        for (let i = 0; i < wr.pts.length / 2; i++) {
          if (i === 0) g.moveTo(wr.pts[0], wr.pts[1]);
          else g.lineTo(wr.pts[2 * i], wr.pts[2 * i + 1]);
        }
        g.stroke();
      }

      /* la ville, fenêtres éteintes */
      for (const b of town) {
        const top = b.base - b.h;
        const body = g.createLinearGradient(b.x, top, b.x + b.w, b.base);
        body.addColorStop(0, b.back ? '#1E2A48' : '#283658');
        body.addColorStop(1, b.back ? '#141D36' : '#18233F');
        g.fillStyle = body;
        g.fillRect(b.x, top, b.w, b.h);
        g.fillStyle = b.back ? '#262848' : '#33335A';
        g.beginPath();
        if (b.gable) {
          g.moveTo(b.x - 2, top + 0.5);
          g.lineTo(b.x + b.w / 2, top - b.roofH);
          g.lineTo(b.x + b.w + 2, top + 0.5);
        } else {
          g.rect(b.x - 1, top - 3, b.w + 2, 3);
        }
        g.closePath();
        g.fill();
        g.strokeStyle = 'rgba(255, 196, 160, 0.45)';
        g.lineWidth = 0.8;
        g.beginPath();
        if (b.gable) {
          g.moveTo(b.x - 2, top + 0.5);
          g.lineTo(b.x + b.w / 2, top - b.roofH);
        } else {
          g.moveTo(b.x - 1, top - 3);
          g.lineTo(b.x + b.w + 1, top - 3);
        }
        g.stroke();
        for (const wd of b.windows) {
          g.fillStyle = '#0C1428';
          g.fillRect(wd.x, wd.y, 3.8, 4.8);
        }
        if (!b.back && b.h < 26) {
          g.fillStyle = '#0B1222';
          g.fillRect(b.x + b.w / 2 - 2, b.base - 7, 4, 7);
        }
      }
      for (const lp of L.lamps) {
        g.strokeStyle = '#4C5A80';
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(lp.x, lp.y + 4);
        g.lineTo(lp.x, lp.y - 9);
        g.lineTo(lp.x + 3, lp.y - 10);
        g.stroke();
      }
      return c;
    }

    function pylon(g, P) {
      const h = P.base - P.top;
      const wB = h * 0.15, wT = h * 0.035, yN = P.top + h * 0.12;
      g.save();
      g.strokeStyle = '#8492B8';
      g.lineWidth = 1.1;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(P.x - wB, P.base);
      g.lineTo(P.x - wT, yN);
      g.moveTo(P.x + wB, P.base);
      g.lineTo(P.x + wT, yN);
      const n = 5;
      for (let i = 0; i < n; i++) {
        const ya = lerp(P.base, yN, i / n), yb = lerp(P.base, yN, (i + 1) / n);
        const wa = lerp(wB, wT, i / n), wb = lerp(wB, wT, (i + 1) / n);
        g.moveTo(P.x - wa, ya);
        g.lineTo(P.x + wb, yb);
        g.moveTo(P.x + wa, ya);
        g.lineTo(P.x - wb, yb);
        g.moveTo(P.x - wb, yb);
        g.lineTo(P.x + wb, yb);
      }
      g.moveTo(P.x - wT, yN);
      g.lineTo(P.x, P.top);
      g.lineTo(P.x + wT, yN);
      for (const a of armsOf(P)) {
        g.moveTo(P.x - a.hw, a.y);
        g.lineTo(P.x + a.hw, a.y);
        g.moveTo(P.x - a.hw, a.y);
        g.lineTo(P.x - wT * 1.4, a.y + 4);
        g.moveTo(P.x + a.hw, a.y);
        g.lineTo(P.x + wT * 1.4, a.y + 4);
      }
      g.stroke();
      g.fillStyle = '#B7C2DC';
      for (const a of armsOf(P)) {
        g.fillRect(P.x - a.hw - 0.8, a.y, 1.6, 3.2);
        g.fillRect(P.x + a.hw - 0.8, a.y, 1.6, 3.2);
      }
      g.restore();
    }

    /* ---- état ---- */
    const S = {};
    let puffs = [];
    let bubbles = [];
    let sparks = [];
    let pulses = [];
    let waves = [];
    let wisps = [];
    const tmp = { x: 0, y: 0 };

    function init() {
      S.t = 0;
      S.step = 0;
      S.phase = 'steps';
      S.at = [-1, -1, -1, -1, -1, -1];
      S.readyAt = 0;
      S.queued = false;
      S.miss = 0;
      S.lenient = false;
      S.turbA = 0;
      S.turbW = 0;
      S.plume = 0;
      S.puffAcc = 0;
      S.pulseAcc = 0;
      S.lastLit = 0;
      S.doneAt = -1;
      S.laughed = false;
      S.lastTap = 0;
      S.hinted = true;
      puffs = [];
      bubbles = [];
      sparks = [];
      pulses = [];
      waves = [];
      wisps = [];
      town.forEach((b) => (b.lit = 0));
      qBar.classList.add('is-off');
      [btnFumee, btnVapeur].forEach((b) => {
        b.classList.remove('is-wrong', 'is-hint', 'is-right');
        b.disabled = false;
      });
      showGesture(0);
    }

    function showGesture(k) {
      const b = L.tg[k];
      if (!b || !cv.w) return;
      const px = k === 4 ? L.p2.x : b.cx;
      const py = k === 4 ? (L.p2.top + L.p2.base) / 2 : k === 0 ? L.vessel.top + 18 : b.cy;
      api.gesture('tap', { x: clamp((px * L.U) / cv.w * 100, 6, 94), y: clamp((py * L.U) / cv.h * 100, 6, 94) });
    }

    const since = (k) => (S.at[k] < 0 ? -1 : S.t - S.at[k]);

    function trigger(k) {
      S.at[k] = S.t;
      S.step = k + 1;
      S.miss = 0;
      S.lenient = false;
      S.queued = false;
      S.hinted = false;
      S.readyAt = S.t + DELAIS[k];
      api.status(TEXTES.etapes[k]);
      api.progress(S.step / 7);
      api.buzz(10);
      const sfx = api.sfx;
      if (k === 0) { sfx.play('rumble', { volume: 0.5, gap: 0 }); sfx.play('chime', { pitch: 0.8, gap: 0 }); }
      if (k === 1) sfx.play('bubble', { gap: 0 });
      if (k === 2) sfx.play('whoosh', { gap: 0 });
      if (k === 3) { sfx.play('crack', { gap: 0 }); sfx.play('chime', { pitch: 1.25, gap: 0 }); }
      if (k === 4) sfx.play('tick', { pitch: 1.5, gap: 0 });
      if (k === 5) sfx.play('chime', { pitch: 1.5, gap: 0 });
      if (k === 3) {
        const A = L.alt;
        for (let i = 0; i < 18; i++) spark(A.x1 - 8, A.y - A.r - 6, 1);
      }
    }

    function startQuestion() {
      S.phase = 'question';
      api.hint(TEXTES.question);
      qBar.classList.remove('is-off');
      api.sfx.play('pop', { gap: 0 });
      puffBurst(4);
    }

    function answer(ok) {
      if (S.phase !== 'question') return;
      if (ok) {
        btnVapeur.classList.remove('is-hint');
        btnVapeur.classList.add('is-right');
        S.phase = 'done';
        S.doneAt = S.t;
        puffBurst(8);
        api.done(TEXTES.fin, TEXTES.finStatut);
      } else {
        btnFumee.classList.remove('is-wrong');
        void btnFumee.offsetWidth;
        btnFumee.classList.add('is-wrong');
        btnVapeur.classList.add('is-hint');
        api.status(TEXTES.faux);
        api.sfx.play('fail', { gap: 0 });
        api.buzz(12);
      }
    }

    function inBox(b, x, y) {
      const m = 30 / L.U;
      return Math.abs(x - b.cx) <= Math.max(b.rx, m) + 3 && Math.abs(y - b.cy) <= Math.max(b.ry, m) + 3;
    }

    function onTap(x, y) {
      S.lastTap = S.t;
      if (S.phase === 'steps' && S.step < 6) {
        const k = S.step;
        if (inBox(L.tg[k], x, y) || S.lenient) {
          waves.push({ x, y, t: 0, dur: 0.6, good: true });
          if (S.t >= S.readyAt) trigger(k);
          else {
            S.queued = true;
            api.sfx.play('tick', { gap: 0 });
          }
          return;
        }
        waves.push({ x, y, t: 0, dur: 0.5, good: false });
        api.sfx.play('tick', { pitch: 0.7, volume: 0.6 });
        if (S.t >= S.readyAt) {
          S.miss++;
          if (S.miss >= 2) S.lenient = true;
          showGesture(k);
        }
        return;
      }
      waves.push({ x, y, t: 0, dur: 0.6, good: true });
      if (inBox(L.towerBox, x, y)) {
        puffBurst(3);
        api.sfx.play('whoosh', { volume: 0.4 });
      } else {
        api.sfx.play('pop', { pitch: rand(0.9, 1.2), volume: 0.6 });
      }
    }

    api.track(cv.canvas, {
      up(p, e, cancelled) {
        if (cancelled || !p.tap) return;
        onTap(p.x / L.U, p.y / L.U);
      },
    }, { touchAction: 'pan-y' });

    /* ---- particules ---- */
    function puff(x, y, big) {
      if (puffs.length > 46) return;
      puffs.push({
        x, y, vx: rand(5, 9), vy: -rand(6, 10) * (big ? 1.25 : 1),
        r0: rand(10, 14), r1: rand(36, 52) * (big ? 1.1 : 1), age: 0, life: rand(6.5, 8.5), a: rand(0.55, 0.8),
        v: Math.floor(Math.random() * 3),
      });
    }
    function puffBurst(n) {
      const T = L.tower, rT = towerR(T.top);
      for (let i = 0; i < n; i++) puff(T.cx + rand(-0.7, 0.7) * rT, T.top - rand(0, 6), true);
    }
    function spark(x, y, power) {
      if (sparks.length > 60) return;
      const a = rand(-Math.PI * 0.95, -Math.PI * 0.05);
      const sp = rand(20, 60) * power;
      sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, age: 0, life: rand(0.35, 0.8) });
    }

    /* ---- animation ---- */
    function update(dt) {
      S.t += dt;
      const t = S.t;

      /* déroulé des étapes */
      if (S.phase === 'steps') {
        if (S.step < 6 && S.queued && t >= S.readyAt) trigger(S.step);
        else if (S.step === 6 && t >= S.readyAt) startQuestion();
        else if (S.step < 6 && !S.hinted && t - S.readyAt > HESITE && t - S.lastTap > HESITE) {
          S.hinted = true;
          showGesture(S.step);
        }
      }
      if (S.at[5] >= 0 && !S.laughed && t - S.at[5] > 1.4) {
        S.laughed = true;
        if (!api.isDone()) api.guide(null, 'laugh');
      }
      if (S.phase === 'done' && S.doneAt >= 0 && t - S.doneAt > 2.6 && !qBar.classList.contains('is-off')) {
        qBar.classList.add('is-off');
      }

      /* turbine : de plus en plus vite */
      const s3 = since(2);
      const wT = s3 < 0 ? 0 : 12 * ease.inQuad(clamp(s3 / 3.2));
      S.turbW = wT;
      S.turbA += S.turbW * dt;

      /* panache de la tour : il grandit quand la centrale tourne */
      const target = [0, 0, 0.35, 0.6, 0.7, 0.85, 1][S.step];
      S.plume += (target - S.plume) * Math.min(1, dt * 0.8);
      S.puffAcc += dt * S.plume * 2.8 * (RMO ? 0.6 : 1);
      while (S.puffAcc > 1) {
        S.puffAcc -= 1;
        const T = L.tower, rT = towerR(T.top);
        puff(T.cx + rand(-0.65, 0.65) * rT, T.top, false);
      }
      for (let i = puffs.length - 1; i >= 0; i--) {
        const p = puffs[i];
        p.age += dt;
        if (p.age >= p.life) { puffs.splice(i, 1); continue; }
        p.x += p.vx * dt * AMB;
        p.y += p.vy * dt * AMB;
        p.vx += dt * 1.6;
        p.vy *= Math.pow(0.82, dt);
      }

      /* bulles dans le générateur de vapeur */
      const s2 = since(1);
      if (s2 >= 0 && bubbles.length < 26 && Math.random() < dt * 22 * clamp(s2 / 0.8)) {
        const SG = L.sg;
        bubbles.push({ x: SG.x + rand(-6.5, 6.5), y: SG.bot - 6, vy: -rand(14, 26), r: rand(0.8, 1.8), ph: rand(TAU) });
        if (Math.random() < 0.08) api.sfx.play('bubble', { pitch: rand(0.9, 1.4), volume: 0.25, gap: 180 });
      }
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        b.y += b.vy * dt;
        b.x += Math.sin(S.t * 6 + b.ph) * dt * 4;
        if (b.y < L.sg.water + 1) bubbles.splice(i, 1);
      }

      /* volutes de vapeur dans la turbine */
      if (s3 >= 0 && wisps.length < 10 && Math.random() < dt * 8) {
        const Tu = L.turb;
        wisps.push({ x: Tu.x0 + 4, y: Tu.y + rand(-6, 6), age: 0, life: rand(0.8, 1.3) });
      }
      for (let i = wisps.length - 1; i >= 0; i--) {
        const w = wisps[i];
        w.age += dt;
        if (w.age >= w.life) wisps.splice(i, 1);
      }

      /* étincelles de l'alternateur */
      const s4 = since(3);
      if (s4 >= 0 && Math.random() < dt * (s4 < 1.5 ? 30 : 4)) {
        const A = L.alt;
        spark(A.x1 - 8 + rand(-3, 3), A.y - A.r - 6, s4 < 1.5 ? 1 : 0.6);
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.age += dt;
        if (s.age >= s.life) { sparks.splice(i, 1); continue; }
        s.vy += 120 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
      }

      /* impulsions électriques le long des fils */
      const s5 = since(4);
      if (s5 >= 0) {
        S.pulseAcc += dt;
        if (S.pulseAcc > 0.24 && pulses.length < 40) {
          S.pulseAcc = 0;
          for (let k = 0; k < wires.length; k++) pulses.push({ w: k, d: k * 6, sp: rand(105, 125) });
        }
      }
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i];
        p.d += p.sp * dt;
        if (p.d >= wires[p.w].len) pulses.splice(i, 1);
      }

      /* fenêtres qui s'allument une à une */
      const s6 = since(5);
      if (s6 >= 0) {
        let lit = 0;
        for (const b of town) {
          let n = 0, on = 0;
          for (const wd of b.windows) {
            if (!wd.on) continue;
            n++;
            if (s6 > wd.delay) on++;
          }
          b.lit = n ? on / n : 0;
          lit += on;
        }
        if (lit > S.lastLit) {
          api.sfx.play('tick', { pitch: rand(1.2, 1.8), volume: 0.4, gap: 70 });
          S.lastLit = lit;
        }
      }

      waves = waves.filter((w) => (w.t += dt) < w.dur);
    }

    /* ---- dessin des parties animées ---- */
    function drawReactor() {
      const V = L.vessel;
      const s1 = since(0);
      const rods = s1 < 0 ? 0 : ease.inOutCubic(clamp(s1 / 1.3));
      const heat = s1 < 0 ? 0 : ease.inOutSine(clamp((s1 - 0.25) / 1.9));
      const blue = clamp((heat - 0.45) / 0.55);
      const flick = 0.92 + 0.08 * Math.sin(S.t * 7.3) * Math.sin(S.t * 3.1);

      ctx.save();
      capsuleV(ctx, V.x, V.top + 4, V.bot - 4, V.r - 4);
      ctx.clip();
      ctx.fillStyle = lib.mix('#0A1A33', '#0F5FB0', blue * 0.85);
      ctx.fillRect(V.x - V.r, V.top, V.r * 2, V.bot - V.top);
      if (heat > 0) {
        ctx.globalCompositeOperation = 'lighter';
        draw.glow(ctx, V.x, (V.coreTop + V.coreBot) / 2, 30, '#FF6A3D', 0.5 * clamp(heat * 2) * (1 - blue * 0.6));
        draw.glow(ctx, V.x, (V.coreTop + V.coreBot) / 2, 34, '#3FA9FF', 0.75 * blue * flick);
        ctx.globalCompositeOperation = 'source-over';
      }
      /* assemblages de combustible */
      const fc = lib.ramp([[0, '#4A3A2C'], [0.35, '#C8492C'], [0.65, '#FF9A4A'], [1, '#FFF0C8']], heat);
      for (const dx of [-10.2, -3.4, 3.4, 10.2]) {
        ctx.fillStyle = fc;
        ctx.fillRect(V.x + dx - 2.1, V.coreTop, 4.2, V.coreBot - V.coreTop);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.fillRect(V.x + dx - 2.1, V.coreTop, 1.2, V.coreBot - V.coreTop);
      }
      if (heat < 0.2) {
        ctx.globalCompositeOperation = 'lighter';
        draw.glow(ctx, V.x, V.coreBot - 6, 14, '#FF5A2A', 0.18 * (0.7 + 0.3 * Math.sin(S.t * 2)));
        ctx.globalCompositeOperation = 'source-over';
      }
      /* barres de contrôle et leur araignée */
      const off = -rods * 28;
      const ys = V.coreTop - 10 + off;
      ctx.fillStyle = '#2A3248';
      for (const dx of [-6.8, 0, 6.8]) ctx.fillRect(V.x + dx - 1.3, ys, 2.6, 46);
      ctx.fillStyle = 'rgba(190, 205, 230, 0.4)';
      for (const dx of [-6.8, 0, 6.8]) ctx.fillRect(V.x + dx - 1.3, ys, 0.8, 46);
      ctx.fillStyle = '#56627F';
      draw.roundRect(ctx, V.x - 9, ys - 3, 18, 3.5, 1.5);
      ctx.fill();
      ctx.fillRect(V.x - 0.9, V.top, 1.8, ys - V.top);
      ctx.restore();

      if (blue > 0) {
        ctx.globalCompositeOperation = 'lighter';
        draw.glow(ctx, V.x, (V.coreTop + V.coreBot) / 2, 46, '#3FA9FF', 0.22 * blue * flick);
        ctx.globalCompositeOperation = 'source-over';
      }
      return heat;
    }

    function flowLine(pts, col, alpha, speed, dash, width) {
      if (alpha <= 0.01) return;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.setLineDash(dash);
      ctx.lineDashOffset = -speed;
      ctx.strokeStyle = rgba(col, alpha);
      ctx.lineWidth = width;
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
      ctx.restore();
    }

    function drawLoop(heat) {
      const V = L.vessel, SG = L.sg;
      const s1 = since(0);
      const flow = s1 < 0 ? 0 : clamp((s1 - 0.5) / 1.2);
      const off = S.t * 22;
      flowLine(L.hotPts, '#FF8A4A', 0.95 * flow, off, DASH_EAU, 2.4);
      flowLine(L.coldPts, '#6CC6FF', 0.85 * flow, off, DASH_EAU, 2.4);

      /* générateur de vapeur : eau, tubes en U, bulles, vapeur */
      const s2 = since(1);
      const boil = s2 < 0 ? 0 : clamp(s2 / 0.8);
      const steam = s2 < 0 ? 0 : clamp((s2 - 0.3) / 1.0);
      ctx.save();
      sgPath(ctx, 3.5);
      ctx.clip();
      ctx.fillStyle = lib.mix('#0E2648', '#16467A', boil * 0.6);
      ctx.fillRect(SG.x - SG.ru, SG.water, SG.ru * 2, SG.bot - SG.water);
      ctx.fillStyle = 'rgba(160, 200, 255, 0.35)';
      ctx.fillRect(SG.x - SG.ru, SG.water, SG.ru * 2, 0.8);
      /* tubes en U (le circuit primaire passe dedans) */
      const tc = lib.mix('#4A5670', '#FF8A4A', flow * 0.9);
      ctx.strokeStyle = tc;
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 3; i++) {
        const yT = L.yHot + i * 3, yB = L.yCold - i * 3, xr = SG.x + 6 - i * 3;
        ctx.beginPath();
        ctx.moveTo(SG.x - SG.rl, yT);
        ctx.lineTo(xr - 3, yT);
        ctx.quadraticCurveTo(xr, yT, xr, yT + 3);
        ctx.lineTo(xr, yB - 3);
        ctx.quadraticCurveTo(xr, yB, xr - 3, yB);
        ctx.lineTo(SG.x - SG.rl, yB);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(220, 238, 255, 0.85)';
      for (const b of bubbles) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, TAU);
        ctx.fill();
      }
      if (steam > 0) {
        for (let i = 0; i < 4; i++) {
          const yy = SG.top + 8 + i * 7 + Math.sin(S.t * 2 + i) * 1.5;
          draw.glow(ctx, SG.x + Math.sin(S.t * 1.3 + i * 2) * 3, yy, 11, '#F2F7FF', 0.45 * steam);
        }
      }
      ctx.restore();

      /* vapeur dans le tuyau jusqu'à la turbine */
      flowLine(L.steamPts, '#F4F8FF', 0.9 * steam, S.t * 30, DASH_VAPEUR, 2.2);
    }

    function drawTurbine() {
      const Tu = L.turb;
      const blur = clamp(S.turbW / 10);
      ctx.save();
      ctx.lineCap = 'round';
      for (const w of wisps) {
        const k = w.age / w.life;
        const x = lerp(Tu.x0 + 6, Tu.x1 - 2, k);
        const spread = lerp(8, 22, k);
        draw.glow(ctx, x, w.y + Math.sin(k * 9 + w.y) * spread * 0.4, 6 + k * 6, '#EAF3FF', 0.25 * Math.sin(Math.PI * k));
      }
      for (const d of Tu.discs) {
        const rx = d.r * 0.34, ry = d.r;
        const N = 12;
        if (blur > 0.05) {
          ctx.fillStyle = rgba('#C9D6EA', 0.2 * blur);
          ctx.beginPath();
          ctx.ellipse(d.x, Tu.y, rx + 1, ry, 0, 0, TAU);
          ctx.fill();
        }
        for (let pass = 0; pass < 2; pass++) {
          for (let i = 0; i < N; i++) {
            const a = S.turbA + i * (TAU / N) + d.r;
            const c = Math.cos(a), s = Math.sin(a);
            if ((c > 0) !== (pass === 1)) continue;
            const lum = 0.35 + 0.65 * Math.max(0, c);
            ctx.strokeStyle = lib.mix('#46557A', '#E8EFF8', lum, 1 - blur * 0.45);
            ctx.lineWidth = 1.7;
            ctx.beginPath();
            ctx.moveTo(d.x + c * rx * 0.28, Tu.y + s * ry * 0.28);
            ctx.lineTo(d.x + c * rx, Tu.y + s * ry);
            ctx.stroke();
          }
          if (pass === 0) {
            ctx.fillStyle = '#7F8CA8';
            ctx.beginPath();
            ctx.ellipse(d.x, Tu.y, rx * 0.3 + 1, ry * 0.28, 0, 0, TAU);
            ctx.fill();
          }
        }
      }
      ctx.restore();
    }

    function drawAlternator() {
      const A = L.alt;
      const s4 = since(3);
      const ex = s4 < 0 ? 0 : clamp(s4 / 0.8);
      const a = S.turbA;
      const rx = 6.5, ry = A.r - 1;
      ctx.save();
      if (ex > 0) {
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 5; i++) {
          const bx = A.x0 + 6 + i * 7.4;
          ctx.fillStyle = rgba('#FFB45A', 0.3 * ex * (0.7 + 0.3 * Math.sin(S.t * 9 + i)));
          ctx.fillRect(bx, A.y - A.r + 2.5, 3.6, A.r * 2 - 5);
        }
        draw.glow(ctx, A.x1, A.y, 30, '#3FA9FF', 0.28 * ex);
        ctx.globalCompositeOperation = 'source-over';
      }
      /* le rotor (un aimant à deux pôles) tourne avec l'arbre */
      const c = Math.cos(a), s = Math.sin(a);
      const p1x = A.x1 + c * rx * 0.75, p1y = A.y + s * ry * 0.75;
      const p2x = A.x1 - c * rx * 0.75, p2y = A.y - s * ry * 0.75;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#8E9AB4';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(p1x, p1y);
      ctx.lineTo(p2x, p2y);
      ctx.stroke();
      ctx.fillStyle = lib.mix('#7A6A3A', '#F2C230', 0.3 + 0.7 * ex);
      ctx.beginPath();
      ctx.arc(p1x, p1y, 2.6, 0, TAU);
      ctx.fill();
      ctx.fillStyle = lib.mix('#3A5A7A', '#3FA9FF', 0.3 + 0.7 * ex);
      ctx.beginPath();
      ctx.arc(p2x, p2y, 2.6, 0, TAU);
      ctx.fill();
      /* le champ qui tourne */
      if (ex > 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineWidth = 1.6;
        for (let k = 0; k < 2; k++) {
          const b = a + k * Math.PI;
          ctx.strokeStyle = rgba(k ? '#7FC8FF' : '#FFD873', 0.75 * ex);
          ctx.beginPath();
          ctx.ellipse(A.x1, A.y, rx * 1.9, ry * 1.32, 0, b - 0.55, b + 0.55);
          ctx.stroke();
          ctx.strokeStyle = rgba(k ? '#7FC8FF' : '#FFD873', 0.35 * ex);
          ctx.beginPath();
          ctx.ellipse(A.x1, A.y, rx * 2.6, ry * 1.6, 0, b - 0.4, b + 0.4);
          ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
      /* étincelles */
      ctx.globalCompositeOperation = 'lighter';
      for (const sp of sparks) {
        const k = sp.age / sp.life;
        ctx.strokeStyle = rgba(k < 0.4 ? '#FFF6D0' : '#FFC24A', 1 - k);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(sp.x, sp.y);
        ctx.lineTo(sp.x - sp.vx * 0.03, sp.y - sp.vy * 0.03);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
      return ex;
    }

    function drawWires(ex) {
      const s5 = since(4);
      const live = s5 < 0 ? 0 : clamp(s5 / 0.6);
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      /* le câble qui sort de l'alternateur s'allume dès l'étape 4, la ligne à l'étape 5 */
      for (const wr of wires) {
        const n = wr.pts.length / 2;
        for (let pass = 0; pass < 2; pass++) {
          const upto = pass === 0 ? wr.inside + 1 : n;
          const from = pass === 0 ? 0 : wr.inside;
          const a = pass === 0 ? ex : live;
          if (a <= 0.01) continue;
          ctx.strokeStyle = rgba('#F2C230', 0.55 * a);
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          for (let i = from; i < upto; i++) {
            if (i === from) ctx.moveTo(wr.pts[2 * i], wr.pts[2 * i + 1]);
            else ctx.lineTo(wr.pts[2 * i], wr.pts[2 * i + 1]);
          }
          ctx.stroke();
        }
      }
      ctx.globalCompositeOperation = 'lighter';
      for (const p of pulses) {
        const wr = wires[p.w];
        wireAt(wr, p.d, tmp);
        draw.glow(ctx, tmp.x, tmp.y, 6, '#FFD873', 0.85);
        ctx.fillStyle = '#FFF8DC';
        ctx.beginPath();
        ctx.arc(tmp.x, tmp.y, 1.3, 0, TAU);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
    }

    function drawTown() {
      const s6 = since(5);
      if (s6 < 0) return;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const b of town) {
        if (b.lit > 0) draw.glow(ctx, b.x + b.w / 2, b.base - b.h * 0.5, Math.max(b.w, b.h) * 0.9, '#FFB547', 0.16 * b.lit);
      }
      ctx.globalCompositeOperation = 'source-over';
      for (const b of town) {
        for (const wd of b.windows) {
          if (!wd.on) continue;
          const k = clamp((s6 - wd.delay) / 0.25);
          if (k <= 0) continue;
          ctx.fillStyle = rgba(b.back ? '#F7C25A' : '#FFD87A', k);
          ctx.fillRect(wd.x, wd.y, 3.8, 4.8);
          if (k < 1) {
            ctx.globalCompositeOperation = 'lighter';
            draw.glow(ctx, wd.x + 1.9, wd.y + 2.4, 9, '#FFE2A0', 0.6 * (1 - k));
            ctx.globalCompositeOperation = 'source-over';
          }
        }
      }
      ctx.globalCompositeOperation = 'lighter';
      L.lamps.forEach((lp, i) => {
        const k = clamp((s6 - 0.3 - i * 0.25) / 0.3);
        if (k <= 0) return;
        draw.glow(ctx, lp.x + 3, lp.y - 9, 14, '#FFC66B', 0.5 * k);
        draw.glow(ctx, lp.x + 3, lp.y + 4, 12, '#FFC66B', 0.18 * k);
      });
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
    }

    function drawPlume() {
      const spr = puffSprites();
      for (const p of puffs) {
        const k = p.age / p.life;
        const a = p.a * Math.min(1, k * 4) * Math.pow(1 - k, 1.3);
        if (a < 0.01) continue;
        const r = lerp(p.r0, p.r1, ease.outQuad(k));
        ctx.globalAlpha = a;
        ctx.drawImage(spr[p.v], p.x - r, p.y - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
    }

    function drawRipples() {
      ctx.lineCap = 'round';
      const avoid = L.p1.x;
      for (const r of ripples) {
        const x = (r.x + S.t * r.sp * AMB) % (L.VW + 20) - 10;
        if (Math.abs(x - avoid) < 18) continue;
        const a = 0.18 + 0.16 * Math.sin(S.t * 1.4 * AMB + r.ph);
        ctx.strokeStyle = rgba('#F3C9A8', a);
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(x, r.y);
        ctx.lineTo(x + r.len, r.y);
        ctx.stroke();
      }
    }

    function ring(b, col) {
      const t = S.t;
      const k = (t % 1.5) / 1.5;
      const base = 0.7 + 0.3 * Math.sin(t * 4);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      draw.glow(ctx, b.cx, b.cy, Math.max(b.rx, b.ry) * 1.25, '#3FA9FF', 0.1 * base);
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineWidth = 2;
      ctx.strokeStyle = rgba(col, 0.8 * base);
      ctx.beginPath();
      ctx.ellipse(b.cx, b.cy, b.rx + 3, b.ry + 3, 0, 0, TAU);
      ctx.stroke();
      const s = 1 + 0.2 * ease.outCubic(k);
      ctx.strokeStyle = rgba(col, 0.55 * (1 - k));
      ctx.lineWidth = 2.6 * (1 - k) + 0.4;
      ctx.beginPath();
      ctx.ellipse(b.cx, b.cy, (b.rx + 3) * s, (b.ry + 3) * s, 0, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

    function render() {
      const { w, h } = cv;
      if (!bg) return;
      ctx.drawImage(bg, 0, 0, w, h);
      ctx.save();
      ctx.scale(L.U, L.U);
      drawRipples();
      drawPlume();
      const heat = drawReactor();
      drawLoop(heat);
      drawTurbine();
      const ex = drawAlternator();
      drawWires(ex);
      drawTown();
      /* anneau sur l'élément à toucher */
      if (S.phase === 'steps' && S.step < 6 && S.t >= S.readyAt) {
        if (S.step === 4) {
          const P1 = L.p1, P2 = L.p2;
          ring({ cx: P1.x, cy: (P1.top + P1.base) / 2, rx: 24, ry: (P1.base - P1.top) / 2 + 4 }, '#BFE4FF');
          ring({ cx: P2.x, cy: (P2.top + P2.base) / 2, rx: 22, ry: (P2.base - P2.top) / 2 + 4 }, '#BFE4FF');
        } else {
          ring(L.tg[S.step], '#BFE4FF');
        }
      }
      if (S.phase === 'question') ring(L.towerBox, '#E6F2FF');
      for (const wv of waves) {
        const k = wv.t / wv.dur;
        ctx.strokeStyle = rgba(wv.good ? '#E6F2FF' : '#9FB6D6', 0.75 * (1 - k));
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(wv.x, wv.y, lerp(4, wv.good ? 30 : 20, ease.outCubic(k)), 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
    }

    cv.onResize((w, h) => {
      qBar.classList.toggle('ce-narrow', w < 340);
      layout(w, h);
      bg = paintBg();
      if (S.phase === 'steps' && S.t < 0.5 && S.step === 0) showGesture(0);
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
