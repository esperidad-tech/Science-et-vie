/* Anthropocène : sur une plage, seize galets. Cinq d'entre eux sont des roches fabriquées
   par les humains. On tape un galet pour le soulever et lire ce qu'il est. */
(function () {
  'use strict';
  const { lib } = window.RM;
  const { TAU, clamp, lerp, rand, ease, rgba, draw } = lib;

  const TEXTES = {
    compteur: (n, total) => `Roches humaines : ${n} / ${total}`,
    humaine: 'Fabriquée par les humains',
    naturelle: 'Roche naturelle',
    galet: (i, n) => `Galet ${i} sur ${n}`,
    fin: 'Tu as trouvé les 5 roches humaines.',
    finStatut: 'Béton, brique, verre, enrobé, plastique : les géologues du futur les retrouveront dans les couches de notre époque.',
    roches: {
      plastiglomerat: { nom: 'Plastiglomérat', info: 'Du plastique fondu mêlé à du sable, des coquillages et de la roche. Décrit pour la première fois sur une plage d’Hawaï.' },
      beton: { nom: 'Béton', info: 'Du ciment, du sable et des graviers : la roche artificielle la plus fabriquée au monde.' },
      brique: { nom: 'Brique', info: 'De l’argile cuite au four.' },
      verre: { nom: 'Verre de mer', info: 'Du sable fondu devenu bouteille, puis poli par les vagues.' },
      enrobe: { nom: 'Enrobé', info: 'Des graviers collés par du bitume, tiré du pétrole : un morceau de route.' },
      granite: { nom: 'Granite', info: 'Né d’un magma refroidi lentement en profondeur.' },
      basalte: { nom: 'Basalte', info: 'Une lave refroidie, la roche des fonds océaniques.' },
      silex: { nom: 'Silex', info: 'De la silice venue surtout d’éponges marines, durcie dans la craie.' },
      calcaire: { nom: 'Calcaire', info: 'Fait de coquilles accumulées au fond de la mer. Regarde l’empreinte !' },
      quartz: { nom: 'Quartz', info: 'Un minéral très dur : c’est lui qui forme l’essentiel du sable des plages.' },
      gres: { nom: 'Grès', info: 'Du sable devenu roche.' },
    },
  };

  /* forme et taille de chaque sorte de galet */
  const KINDS = {
    granite: { human: false, scale: 1.0, asp: 0.8, wob: 0.08 },
    basalte: { human: false, scale: 1.04, asp: 0.78, wob: 0.1 },
    silex: { human: false, scale: 0.97, asp: 0.8, wob: 0.15 },
    calcaire: { human: false, scale: 1.08, asp: 0.8, wob: 0.07 },
    quartz: { human: false, scale: 0.9, asp: 0.84, wob: 0.07 },
    gres: { human: false, scale: 1.0, asp: 0.8, wob: 0.09 },
    plastiglomerat: { human: true, scale: 1.06, asp: 0.82, wob: 0.17 },
    beton: { human: true, scale: 1.0, asp: 0.8, wob: 0.13 },
    brique: { human: true, scale: 1.12, asp: 0.74, wob: 0.035 },
    verre: { human: true, scale: 0.98, asp: 0.82, wob: 0.07 },
    enrobe: { human: true, scale: 0.98, asp: 0.82, wob: 0.15 },
  };
  /* ordre des galets sur la plage (de gauche à droite, rangée par rangée) */
  const LAYOUT = [
    'granite', 'enrobe', 'quartz', 'basalte',
    'silex', 'gres', 'brique', 'calcaire',
    'beton', 'basalte', 'granite', 'verre',
    'quartz', 'plastiglomerat', 'silex', 'gres',
  ];
  const TOTAL_HUMAN = LAYOUT.filter((k) => KINDS[k].human).length;

  const CSS = `
    .game[data-game="anthropocene"] .an-label {
      position: absolute; z-index: 4; left: 0; top: 0;
      width: max-content; max-width: min(17rem, calc(100% - 16px));
      margin: 0; padding: 9px 13px 10px;
      border-radius: 14px 17px 15px 13px;
      background: rgba(30, 33, 36, 0.95); color: #F4F3EF;
      font-size: 0.9rem; line-height: 1.36;
      box-shadow: 0 12px 26px -12px rgba(0, 0, 0, 0.65);
      pointer-events: none; opacity: 0; visibility: hidden;
      transform: translateY(5px) scale(0.98); transform-origin: var(--ax, 50%) 100%;
      transition: opacity 0.18s, transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1), visibility 0s 0.2s;
    }
    .game[data-game="anthropocene"] .an-label.is-on {
      opacity: 1; visibility: visible; transform: none;
      transition: opacity 0.18s, transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1), visibility 0s;
    }
    .game[data-game="anthropocene"] .an-label[data-side="below"] { transform-origin: var(--ax, 50%) 0; }
    .game[data-game="anthropocene"] .an-label::after {
      content: ""; position: absolute; left: var(--ax, 50%); width: 12px; height: 12px;
      margin-left: -6px; background: inherit; border-radius: 2px; transform: rotate(45deg);
    }
    .game[data-game="anthropocene"] .an-label[data-side="above"]::after { bottom: -5px; }
    .game[data-game="anthropocene"] .an-label[data-side="below"]::after { top: -5px; }
    .game[data-game="anthropocene"] .an-label[data-side="side"]::after { display: none; }
    .game[data-game="anthropocene"] .an-kicker {
      display: block; margin-bottom: 1px;
      font-size: 0.875rem; font-weight: 700; letter-spacing: 0;
      color: #9FD8D3;
    }
    .game[data-game="anthropocene"] .an-label.is-human .an-kicker { color: #FF8DB9; }
    .game[data-game="anthropocene"] .an-label strong { display: block; font-size: 1.0625rem; line-height: 1.25; margin-bottom: 2px; }
    .game[data-game="anthropocene"] .an-hit {
      position: absolute; z-index: 3; padding: 0; margin: 0; border: 0; border-radius: 50%;
      background: transparent; pointer-events: none; opacity: 0;
    }
    .game[data-game="anthropocene"] .an-hit:focus-visible { opacity: 1; outline: 2.5px dashed #1E2124; outline-offset: 9px; }
    .game[data-game="anthropocene"] .game-canvas { cursor: default; }
    .game[data-game="anthropocene"] .game-canvas.is-over { cursor: pointer; }
    .game[data-game="anthropocene"] .gesture-dot {
      box-shadow: 0 0 0 7px rgba(255, 255, 255, 0.32), 0 0 0 9px rgba(30, 33, 36, 0.28), 0 4px 14px rgba(0, 0, 0, 0.4);
    }
    .game[data-game="anthropocene"] .gesture-ring { border-color: #FFFFFF; box-shadow: 0 0 0 1.5px rgba(30, 33, 36, 0.4); }
  `;

  /* ---- outils de texture ---- */
  function smooth(e0, e1, x) {
    const t = clamp((x - e0) / (e1 - e0));
    return t * t * (3 - 2 * t);
  }
  function hash(ix, iy, s) {
    let h = (Math.imul(ix | 0, 374761393) + Math.imul(iy | 0, 668265263) + Math.imul(Math.round(s * 7), 982451653)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  /* bruit cellulaire : distances aux deux germes les plus proches, identifiant et centre de la cellule */
  const W = { f1: 0, f2: 0, id: 0, cx: 0, cy: 0 };
  function worley(x, y, s, jit) {
    const ix = Math.floor(x), iy = Math.floor(y);
    let f1 = 9, f2 = 9, bx = 0, by = 0, cx = 0, cy = 0;
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        const gx = ix + i, gy = iy + j;
        const px = gx + 0.5 + (hash(gx, gy, s) - 0.5) * jit;
        const py = gy + 0.5 + (hash(gx, gy, s + 17.3) - 0.5) * jit;
        const dx = px - x, dy = py - y;
        const d = dx * dx + dy * dy;
        if (d < f1) {
          f2 = f1;
          f1 = d;
          bx = gx;
          by = gy;
          cx = px;
          cy = py;
        } else if (d < f2) f2 = d;
      }
    }
    W.f1 = Math.sqrt(f1);
    W.f2 = Math.sqrt(f2);
    W.id = hash(bx, by, s + 41.9);
    W.cx = cx;
    W.cy = cy;
    return W;
  }
  const C = (hex) => lib.hexToRgb(hex).map((v) => v / 255);
  function setC(M, c, k) {
    M.r += (c[0] - M.r) * k;
    M.g += (c[1] - M.g) * k;
    M.b += (c[2] - M.b) * k;
  }
  function setC3(M, r, g, b, k) {
    M.r += (r - M.r) * k;
    M.g += (g - M.g) * k;
    M.b += (b - M.b) * k;
  }
  function mulC(M, k) {
    M.r *= k;
    M.g *= k;
    M.b *= k;
  }

  const COL = {
    feld1: C('#DCA99B'), feld2: C('#C88F82'), feld3: C('#D3AEA4'), qtzG: C('#A6A4A1'), biot: C('#272627'), white: C('#ECE7E0'),
    patina: C('#6E6E70'),
    mold: C('#AFA690'),
    qEdge: C('#B5BCC3'), qMilk: C('#F8F7F3'), qVein: C('#AAA498'), qIron: C('#D49E6C'),
    pgBas: C('#3A3836'), pgSand: C('#C9B48E'), pgShell: C('#EDE7DB'), pgRed: C('#D4473A'), pgYel: C('#E9B92F'),
    pgBlue: C('#2F86C7'), pgGreen: C('#3FA06A'), plA: C('#3B7BB8'), plB: C('#ECEAE4'), plC: C('#EC7A36'),
    bG1: C('#C9B99D'), bG2: C('#8F857A'), bG3: C('#66615C'), bG4: C('#DAD5CC'), rust: C('#8F5230'),
    eG1: C('#8E8B86'), eG2: C('#B7B1A7'), eG3: C('#5E5B56'), eG4: C('#8B6252'), eG5: C('#A89A84'),
  };

  /* empreinte de coquillage (relief en creux, en px) — un bivalve ovale à côtes rayonnantes */
  function fossilH(u, v, S, P) {
    const ex = u / (S * 0.5), ey = v / (S * 0.56);
    const e = Math.sqrt(ex * ex + ey * ey);
    if (e > 1.12) return 0;
    const inside = 1 - smooth(0.88, 1.06, e);
    const hx = u, hy = S * 0.5 - v; /* charnière en bas */
    const rho = Math.sqrt(hx * hx + hy * hy);
    const phi = Math.atan2(hx, hy);
    const ribs = Math.cos(phi * 15);
    const growth = Math.sin(rho * 1.3);
    const wear = 0.55 + 0.45 * P.nz.noise2(u * 0.22 + 40, v * 0.22 + 9);
    return -inside * (1.5 + (ribs * 0.62 + growth * 0.24) * wear * smooth(1.5, 5, rho));
  }

  /* chaque matière remplit M : couleur (0..1), brillance, relief (pente en px/px), transparence */
  const MAT = {
    granite(M, x, y, d, P) {
      const n = P.nz.fbm(x * 0.07 + P.o1, y * 0.07 + P.o2, 3);
      let c, edge;
      worley(x / 5.8, y / 5.8, P.seed, 0.95);
      if (W.id < 0.3) { /* grands cristaux de feldspath rose */
        c = W.id < 0.15 ? COL.feld1 : COL.feld2;
        edge = (W.f2 - W.f1) * 2.6;
      } else {
        worley(x / 2, y / 2, P.seed + 7, 0.95);
        const id = W.id;
        c = id < 0.36 ? COL.qtzG : id < 0.62 ? COL.feld3 : id < 0.88 ? COL.biot : COL.white;
        edge = (W.f2 - W.f1) * 1.15;
      }
      M.r = c[0];
      M.g = c[1];
      M.b = c[2];
      mulC(M, 0.9 + 0.2 * n + 0.1 * (P.nz.noise2(x * 0.8 + P.o2, y * 0.8 + P.o1) - 0.5));
      if (edge < 0.45) mulC(M, 0.82 + edge * 0.4);
      M.gloss = 0.2;
      M.shin = 24;
    },
    basalte(M, x, y, d, P) {
      const n = P.nz.fbm(x * 0.09 + P.o1, y * 0.09 + P.o2, 3);
      const f = P.nz.noise2(x * 1.1 + P.o2, y * 1.1 + P.o1);
      const v = 0.19 + 0.05 * n + 0.03 * f;
      M.r = v * 0.97;
      M.g = v;
      M.b = v * 1.06;
      const rim = smooth(0.75, 1, d) * 0.05;
      M.r += rim;
      M.g += rim * 0.92;
      M.b += rim * 0.85;
      worley(x / 5.5, y / 5.5, P.seed + 3, 1);
      if (W.id < 0.2) { /* petites bulles de gaz figées */
        const vr = 0.6 + W.id * 6;
        const dx = x - W.cx * 5.5, dy = y - W.cy * 5.5;
        const r = Math.sqrt(dx * dx + dy * dy);
        if (r < vr) {
          mulC(M, 0.55 + 0.3 * (r / vr));
          const k = 1.4 / (vr * vr);
          M.bx -= dx * k;
          M.by -= dy * k;
        }
      }
      M.gloss = 0.05;
      M.shin = 8;
    },
    silex(M, x, y, d, P) {
      const n = P.nz.fbm(x * 0.06 + P.o1, y * 0.06 + P.o2, 3);
      const rx = x - P.fx, ry = y - P.fy;
      const rr = Math.sqrt(rx * rx + ry * ry) + 1e-3;
      const ph = rr * 0.5 + n * 4;
      const v = 0.085 + 0.02 * Math.sin(ph) + 0.035 * (n - 0.5);
      M.r = v * 1.04;
      M.g = v;
      M.b = v * 1.12;
      const bk = 0.16 * Math.cos(ph); /* ondes de la cassure conchoïdale */
      M.bx += (rx / rr) * bk;
      M.by += (ry / rr) * bk;
      M.gloss = 0.9;
      M.shin = 70;
      const side = (x * Math.cos(P.ca) + y * Math.sin(P.ca)) / (Math.sqrt(x * x + y * y) + 1e-3);
      const nl = P.nz.fbm(x * 0.035 + P.o2 + 7, y * 0.035 + P.o1, 3);
      const cr = d + (nl - 0.5) * 0.42 + P.crust + side * d * 0.16;
      const k = smooth(0.69, 0.725, cr);
      const band = smooth(0.6, 0.69, cr) * (1 - k);
      if (band > 0) setC(M, COL.patina, band * 0.55);
      if (k > 0) { /* croûte blanche, crayeuse et mate */
        const t = P.nz.fbm(x * 0.3 + P.o2, y * 0.3 + P.o1, 3);
        const t2 = P.nz.fbm(x * 0.3 + P.o2 + 0.6, y * 0.3 + P.o1, 3);
        const t3 = P.nz.fbm(x * 0.3 + P.o2, y * 0.3 + P.o1 + 0.6, 3);
        let c = 0.9 + 0.09 * t;
        setC3(M, c, c * 0.975, c * 0.925, k);
        M.gloss = lerp(M.gloss, 0.025, k);
        M.shin = lerp(M.shin, 6, k);
        M.bx += (t2 - t) * 0.8 * k;
        M.by += (t3 - t) * 0.8 * k;
        M.ao = lerp(1, 0.4, k);
        M.wrap = 0.35 * k;
      }
    },
    calcaire(M, x, y, d, P) {
      const n = P.nz.fbm(x * 0.07 + P.o1, y * 0.07 + P.o2, 3);
      const f = P.nz.noise2(x * 0.7 + P.o2, y * 0.7 + P.o1);
      const v = 0.79 + 0.07 * n + 0.04 * (f - 0.5);
      M.r = v;
      M.g = v * 0.965;
      M.b = v * 0.885;
      worley(x / 2.8, y / 2.8, P.seed + 5, 1);
      if (W.id < 0.1 && W.f1 < 0.2) mulC(M, 0.84);
      M.gloss = 0.07;
      M.shin = 10;
      const c = Math.cos(P.fa), s = Math.sin(P.fa);
      const ux = x - P.fx, uy = y - P.fy;
      const u = ux * c + uy * s, w = -ux * s + uy * c;
      const S = P.fs;
      if (Math.abs(u) < S * 0.6 && Math.abs(w) < S * 0.66) {
        const e = 0.45;
        const h0 = fossilH(u, w, S, P);
        const gu = (fossilH(u + e, w, S, P) - fossilH(u - e, w, S, P)) / (2 * e);
        const gv = (fossilH(u, w + e, S, P) - fossilH(u, w - e, S, P)) / (2 * e);
        M.bx -= gu * c - gv * s;
        M.by -= gu * s + gv * c;
        setC(M, COL.mold, clamp(-h0 * 0.16));
      }
    },
    quartz(M, x, y, d, P) {
      const n = P.nz.fbm(x * 0.05 + P.o1, y * 0.05 + P.o2, 3);
      const v = 0.82 + 0.07 * n;
      M.r = v;
      M.g = v * 0.993;
      M.b = v * 0.975;
      setC(M, COL.qEdge, smooth(0.5, 1, d) * 0.42);
      const cl = P.nz.fbm(x * 0.11 + P.o2 + 9, y * 0.11 + P.o1, 3);
      setC(M, COL.qMilk, smooth(0.45, 0.7, cl) * 0.55);
      const vn = Math.abs(P.nz.fbm(x * 0.045 + P.o1 + 20, y * 0.045 + 3, 3) - 0.5);
      if (vn < 0.012) setC(M, COL.qVein, (1 - vn / 0.012) * 0.22);
      const st = P.nz.fbm(x * 0.06 + cl * 2.5 + 40, y * 0.06 + P.o2, 3);
      setC(M, COL.qIron, smooth(0.64, 0.8, st) * 0.2);
      M.gloss = 0.16;
      M.shin = 12;
      M.wrap = 0.55;
      M.glow = 0.5;
      M.ao = 0.8;
    },
    gres(M, x, y, d, P) {
      const n = P.nz.fbm(x * 0.07 + P.o1, y * 0.07 + P.o2, 3);
      const bed = Math.sin((x * P.bs + y * P.bc) * 0.42 + n * 6);
      const v = 0.69 + 0.035 * bed + 0.07 * (n - 0.5);
      M.r = v * 1.1;
      M.g = v * 0.91;
      M.b = v * 0.66;
      const gr = hash(Math.floor(x * 2.2), Math.floor(y * 2.2), P.seed);
      mulC(M, 0.92 + 0.13 * gr);
      if (gr > 0.986) setC3(M, 0.95, 0.93, 0.88, 0.65);
      else if (gr < 0.01) mulC(M, 0.62);
      M.gloss = 0.035;
      M.shin = 6;
    },
    plastiglomerat(M, x, y, d, P) {
      const wx = P.nz.fbm(x * 0.045 + P.o1, y * 0.045 + P.o2, 3);
      const wy = P.nz.fbm(x * 0.045 + P.o2 + 13, y * 0.045 + P.o1 + 7, 3);
      const sw = P.nz.fbm(x * 0.06 + wx * 3, y * 0.06 + wy * 3, 3);
      const melt = smooth(0.5, 0.56, sw + P.melt);
      /* sable, coquillages, bouts de roche et éclats de plastique pris ensemble */
      const gr = hash(Math.floor(x * 2), Math.floor(y * 2), P.seed);
      M.r = COL.pgSand[0] * (0.84 + 0.22 * gr);
      M.g = COL.pgSand[1] * (0.84 + 0.22 * gr);
      M.b = COL.pgSand[2] * (0.84 + 0.22 * gr);
      if (gr > 0.93) setC(M, COL.pgBas, 0.7);
      worley(x / 4.2, y / 4.2, P.seed + 9, 1);
      const id = W.id;
      let frag = 0;
      if (id < 0.62) {
        const k = smooth(0.5, 1.1, (W.f2 - W.f1) * 2.6 + (P.nz.noise2(x * 0.5 + 9, y * 0.5) - 0.5) * 0.9);
        if (k > 0) {
          const t = id / 0.62;
          const c = t < 0.34 ? COL.pgBas : t < 0.52 ? COL.pgShell : t < 0.64 ? COL.pgRed
            : t < 0.76 ? COL.pgYel : t < 0.88 ? COL.pgBlue : COL.pgGreen;
          const vv = 0.9 + 0.18 * P.nz.noise2(x * 0.8 + P.o1, y * 0.8);
          setC3(M, c[0] * vv, c[1] * vv, c[2] * vv, k);
          frag = t >= 0.52 ? k : 0;
        }
      }
      if (melt > 0) { /* plastique fondu en volutes */
        const band = Math.sin(sw * 46 + wx * 9);
        const t = smooth(-0.35, 0.35, band);
        setC3(M, lerp(COL.plA[0], COL.plB[0], t), lerp(COL.plA[1], COL.plB[1], t), lerp(COL.plA[2], COL.plB[2], t), melt);
        const thr = 1 - smooth(0.05, 0.12, Math.abs(Math.sin(sw * 23 + wy * 5)));
        if (thr > 0) setC(M, COL.plC, melt * thr * 0.85);
        const rim = smooth(0.49, 0.53, sw + P.melt) * (1 - smooth(0.53, 0.58, sw + P.melt));
        M.bx += (wx - 0.5) * rim * 1.4;
        M.by += (wy - 0.5) * rim * 1.4;
      }
      M.gloss = lerp(lerp(0.06, 0.5, frag), 0.75, melt);
      M.shin = lerp(lerp(8, 30, frag), 45, melt);
    },
    beton(M, x, y, d, P) {
      const n = P.nz.fbm(x * 0.08 + P.o1, y * 0.08 + P.o2, 3);
      const f = hash(Math.floor(x * 2), Math.floor(y * 2), P.seed);
      const v = 0.6 + 0.06 * n + 0.035 * (f - 0.5);
      M.r = v;
      M.g = v * 0.99;
      M.b = v * 0.955;
      if (f > 0.992) mulC(M, 0.5); /* bulles d'air */
      worley(x / 6, y / 6, P.seed + 11, 0.9);
      if (W.id < 0.5) { /* graviers */
        const cx = W.cx * 6, cy = W.cy * 6;
        const e = (W.f2 - W.f1) * 3;
        const k = smooth(0.6, 1.5, e + (P.nz.noise2(x * 0.45 + 3, y * 0.45 + P.o2) - 0.5) * 1.6);
        if (k > 0) {
          const t = W.id / 0.5;
          const c = t < 0.3 ? COL.bG1 : t < 0.55 ? COL.bG2 : t < 0.8 ? COL.bG3 : COL.bG4;
          const vv = 0.9 + 0.2 * P.nz.noise2(x * 0.7 + P.o1, y * 0.7);
          setC3(M, c[0] * vv, c[1] * vv, c[2] * vv, k);
          const dx = x - cx, dy = y - cy, len = Math.sqrt(dx * dx + dy * dy) + 0.01;
          const slope = 4 * k * (1 - k) * 0.9;
          M.bx += (dx / len) * slope;
          M.by += (dy / len) * slope;
        }
      }
      const sx = x - P.rx, sy = y - P.ry;
      const rs = Math.exp(-(sx * sx + sy * sy) / (P.rs * P.rs)) * (0.7 + 0.6 * n);
      if (rs > 0.01) setC(M, COL.rust, clamp(rs) * 0.72);
      M.gloss = 0.035;
      M.shin = 6;
    },
    brique(M, x, y, d, P) {
      const n = P.nz.fbm(x * 0.06 + P.o1, y * 0.06 + P.o2, 3);
      const f = P.nz.noise2(x * 0.75 + P.o2, y * 0.75 + P.o1);
      const g = hash(Math.floor(x * 2), Math.floor(y * 2), P.seed);
      M.r = 0.71 + 0.07 * n + 0.03 * f;
      M.g = 0.335 + 0.045 * n + 0.02 * f;
      M.b = 0.205 + 0.03 * n;
      mulC(M, 0.93 + 0.11 * g);
      if (g > 0.99) setC3(M, 0.93, 0.83, 0.68, 0.6);
      else if (g < 0.008) mulC(M, 0.55);
      mulC(M, 1 - smooth(0.58, 0.78, P.nz.fbm(x * 0.05 + 30, y * 0.05 + P.o1, 2)) * 0.22);
      worley(x / 7, y / 7, P.seed + 21, 1);
      if (W.id < 0.16) { /* petits trous de la terre cuite */
        const dx = x - W.cx * 7, dy = y - W.cy * 7;
        const r = Math.sqrt(dx * dx + dy * dy), vr = 0.6 + W.id * 7;
        if (r < vr) {
          mulC(M, 0.6 + 0.3 * (r / vr));
          const k = 1.2 / (vr * vr);
          M.bx -= dx * k;
          M.by -= dy * k;
        }
      }
      const mx = x * P.mc + y * P.ms; /* reste de mortier sur un côté */
      const mk = smooth(P.mt - 1.5, P.mt + 1.5, mx + (n - 0.5) * 16 + (f - 0.5) * 5);
      if (mk > 0) {
        const t = P.nz.fbm(x * 0.28 + 5, y * 0.28 + P.o2, 3);
        setC3(M, 0.79 + 0.1 * t, 0.77 + 0.1 * t, 0.72 + 0.09 * t, mk);
        if (hash(Math.floor(x * 2.4), Math.floor(y * 2.4), P.seed + 2) > 0.97) mulC(M, 0.82 + 0.1 * mk);
        const slope = 4 * mk * (1 - mk) * 0.8;
        M.bx -= P.mc * slope;
        M.by -= P.ms * slope;
      }
      M.gloss = 0.03;
      M.shin = 6;
    },
    verre(M, x, y, d, P) {
      const n = P.nz.fbm(x * 0.05 + P.o1, y * 0.05 + P.o2, 3);
      const fr = P.nz.noise2(x * 1.3 + P.o2, y * 1.3 + P.o1);
      const th = smooth(0.3, 1, d);
      M.r = lerp(0.36, 0.14, th) + 0.04 * n;
      M.g = lerp(0.66, 0.4, th) + 0.05 * n;
      M.b = lerp(0.47, 0.27, th) + 0.03 * n;
      setC3(M, 0.8, 0.9, 0.84, 0.16 + 0.12 * fr); /* surface dépolie */
      worley(x / 6.5, y / 6.5, P.seed + 13, 1);
      if (W.id < 0.3) { /* petits chocs en croissant */
        const dx = x - W.cx * 6.5, dy = y - W.cy * 6.5;
        const r = Math.sqrt(dx * dx + dy * dy);
        const ca = Math.cos(Math.atan2(dy, dx) - W.id * 40);
        if (r > 1 && r < 2.1 && ca > 0.2) setC3(M, 0.93, 0.98, 0.94, 0.45 * smooth(0.2, 0.7, ca) * (1 - Math.abs(r - 1.55) / 0.55));
      }
      M.gloss = 0.32;
      M.shin = 9;
      M.wrap = 0.7;
      M.glow = 0.6;
      M.alpha = lerp(0.74, 0.95, th);
    },
    enrobe(M, x, y, d, P) {
      const n = P.nz.fbm(x * 0.09 + P.o1, y * 0.09 + P.o2, 3);
      const v = 0.085 + 0.035 * n;
      M.r = v * 1.03;
      M.g = v;
      M.b = v * 0.96;
      M.gloss = 0.8;
      M.shin = 65;
      M.warm = 1;
      worley(x / 4.4, y / 4.4, P.seed + 17, 0.95);
      if (W.id < 0.64) { /* gravillons concassés, à facettes */
        const e = (W.f2 - W.f1) * 2.2;
        const k = smooth(0.35, 0.9, e + (P.nz.noise2(x * 0.5, y * 0.5 + P.o1) - 0.5) * 0.7);
        if (k > 0) {
          const t = W.id / 0.64;
          const c = t < 0.32 ? COL.eG1 : t < 0.58 ? COL.eG2 : t < 0.8 ? COL.eG3 : t < 0.9 ? COL.eG4 : COL.eG5;
          const vv = 0.88 + 0.22 * P.nz.noise2(x * 0.9 + P.o2, y * 0.9);
          setC3(M, c[0] * vv, c[1] * vv, c[2] * vv, k);
          M.gloss = lerp(M.gloss, 0.1, k);
          M.shin = lerp(M.shin, 14, k);
          const fa = W.id * 47.3;
          M.bx += Math.cos(fa) * 0.45 * k;
          M.by += Math.sin(fa) * 0.45 * k;
        }
      }
    },
  };
  /* ---- un galet : forme, relief en dôme, matière, lumière ---- */
  const LIGHT = (() => {
    const x = -0.45, y = -0.62, z = 0.64;
    const l = Math.hypot(x, y, z);
    return [x / l, y / l, z / l];
  })();
  const HALF = (() => {
    const x = LIGHT[0], y = LIGHT[1], z = LIGHT[2] + 1;
    const l = Math.hypot(x, y, z);
    return [x / l, y / l, z / l];
  })();
  const SKY = C('#EEF2F2');

  /* rayon du contour dans la direction a (unités de rayon), proche de draw.blob */
  function shapeR(a, P) {
    const s = P.seed, w = P.wob;
    return 1 + w * (Math.sin(a * 3 + s) * 0.5 + Math.sin(a * 5 - s * 1.7) * 0.3 + Math.sin(a * 2 + s * 2.3) * 0.2);
  }
  /* brique : un pavé aux coins usés (super-ellipse) */
  function shapeRBrick(a) {
    const c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
    return Math.pow(Math.pow(c, 5) + Math.pow(s, 5), -1 / 5) * 0.86;
  }

  function makeParams(kind, seed, R) {
    const nz = lib.makeNoise(1000 + seed * 37);
    const r = nz.rnd;
    const K = KINDS[kind];
    const P = {
      kind, nz, seed: seed * 1.37 + 0.5, wob: K.wob, o1: r() * 50, o2: r() * 50,
      rot: (r() - 0.5) * 1.4, asp: K.asp, brick: kind === 'brique',
      dome: kind === 'brique' ? 0.45 : kind === 'verre' ? 0.62 : kind === 'enrobe' ? 0.58 : 0.82,
    };
    if (kind === 'silex') {
      P.fx = (r() - 0.5) * R * 0.5;
      P.fy = (r() - 0.5) * R * 0.5;
      P.crust = r() * 0.08 - 0.06;
      P.ca = r() * TAU;
    }
    if (kind === 'calcaire') {
      P.fx = (r() - 0.5) * R * 0.18;
      P.fy = (r() - 0.5) * R * 0.14;
      P.fa = (r() - 0.5) * 0.9;
      P.fs = R * 0.95;
    }
    if (kind === 'gres') {
      const a = r() * TAU;
      P.bs = Math.sin(a);
      P.bc = Math.cos(a);
    }
    if (kind === 'plastiglomerat') P.melt = 0.02 + r() * 0.04;
    if (kind === 'beton') {
      P.ra = -0.6 + (r() - 0.5) * 0.8; /* le fer sort par le haut à droite */
      P.rx = Math.cos(P.ra) * R * 0.78;
      P.ry = Math.sin(P.ra) * R * 0.78 * P.asp;
      P.rs = R * 0.38;
    }
    if (kind === 'brique') {
      const a = r() < 0.5 ? 0.25 : Math.PI - 0.25;
      P.mc = Math.cos(a);
      P.ms = Math.sin(a);
      P.mt = R * 0.55;
    }
    return P;
  }

  const M = { r: 0, g: 0, b: 0, gloss: 0, shin: 8, bx: 0, by: 0, wrap: 0, glow: 0, alpha: 1, warm: 0, ao: 1 };

  /* dessine le galet dans un canevas carré, éclairé en haut à gauche ; renvoie { cv, size } */
  /* ts : échelle des textures (1 = galets de téléphone), pour garder le même grain à toute taille */
  function renderPebble(kind, seed, R, dpr, draft, ts) {
    ts = ts || 1;
    const P = makeParams(kind, seed, R * ts);
    /* le béton a besoin de place pour son fer qui dépasse */
    const half = kind === 'beton' ? R * 1.32 + 6 : R * (1.06 + P.wob) + 4;
    const size = Math.ceil(half * 2);
    const q = draft ? 0.7 : dpr;
    const N = Math.ceil(size * q);
    const c = document.createElement('canvas');
    c.width = c.height = N;
    const g = c.getContext('2d');
    const img = g.createImageData(N, N);
    const D = img.data;
    const cr = Math.cos(P.rot), sr = Math.sin(P.rot);
    const inv = 1 / q;
    const aa = (draft ? 1.8 : 1.2) / R;
    const rMax = (P.brick ? 1.2 : 1 + P.wob) + aa * 2;
    for (let j = 0; j < N; j++) {
      const py = (j + 0.5) * inv - half;
      for (let i = 0; i < N; i++) {
        const px = (i + 0.5) * inv - half;
        /* coordonnées propres du galet (tourné, aplati) */
        const lx = px * cr + py * sr;
        const ly = (-px * sr + py * cr) / P.asp;
        const rr = Math.sqrt(lx * lx + ly * ly) / R;
        if (rr > rMax) continue;
        const a = Math.atan2(ly, lx);
        const edge = P.brick ? shapeRBrick(a) : shapeR(a, P);
        const d = rr / edge;
        if (d > 1 + aa * 1.5) continue;
        const cov = clamp((1 + aa * 0.5 - d) / aa);
        if (cov <= 0) continue;
        /* dôme : normale tirée du profil, en coordonnées écran */
        const dd = Math.min(d, 0.995);
        const prof = P.brick ? (dd < 0.7 ? 0 : (dd - 0.7) / 0.3) : dd;
        const slope = P.dome * prof / Math.sqrt(Math.max(0.02, 1 - prof * prof));
        const ux = lx / (rr * R + 1e-6), uy = ly / (rr * R + 1e-6);
        let nxl = ux * slope, nyl = (uy * slope) / P.asp;
        M.r = M.g = M.b = 0.5;
        M.gloss = 0.1;
        M.shin = 10;
        M.bx = 0;
        M.by = 0;
        M.wrap = 0;
        M.glow = 0;
        M.alpha = 1;
        M.warm = 0;
        M.ao = 1;
        MAT[kind](M, lx * ts, ly * ts, d, P);
        nxl += M.bx;
        nyl += M.by;
        /* retour en coordonnées écran */
        const nx = nxl * cr - nyl * sr, ny = nxl * sr + nyl * cr;
        const nl = 1 / Math.sqrt(nx * nx + ny * ny + 1);
        const Nx = nx * nl, Ny = ny * nl, Nz = nl;
        const ndl = Nx * LIGHT[0] + Ny * LIGHT[1] + Nz * LIGHT[2];
        const diff = M.wrap ? Math.max(0, (ndl + M.wrap) / (1 + M.wrap)) : Math.max(0, ndl);
        const ao = 1 - 0.32 * M.ao * smooth(0.55, 1, d);
        const ndh = Math.max(0, Nx * HALF[0] + Ny * HALF[1] + Nz * HALF[2]);
        const spec = M.gloss * Math.pow(ndh, M.shin) * (0.45 + 0.55 * ao);
        const sky = (0.62 + 0.38 * Nz) * (0.75 + 0.25 * ao);
        let rC = M.r * (0.36 * sky + 0.8 * diff * ao) + spec;
        let gC = M.g * (0.37 * sky + 0.77 * diff * ao) + spec * (M.warm ? 0.93 : 1);
        let bC = M.b * (0.4 * sky + 0.72 * diff * ao) + spec * (M.warm ? 0.82 : 1);
        if (M.glow) { /* lumière qui traverse la matière, côté opposé à la lampe */
          const sx = ux * cr - uy * sr, sy = ux * sr + uy * cr;
          const back = smooth(0.25, 0.95, d) * Math.max(0, -(sx * LIGHT[0] + sy * LIGHT[1]) * 1.2) * M.glow;
          rC += M.r * back * 0.5;
          gC += M.g * back * 0.5;
          bC += M.b * back * 0.5;
        }
        const rim = smooth(0.82, 1, d) * 0.1 * Math.max(0, 0.3 - ndl);
        rC += SKY[0] * rim;
        gC += SKY[1] * rim;
        bC += SKY[2] * rim;
        const k = (j * N + i) * 4;
        D[k] = clamp(rC) * 255;
        D[k + 1] = clamp(gC) * 255;
        D[k + 2] = clamp(bC) * 255;
        D[k + 3] = cov * M.alpha * 255;
      }
    }
    g.putImageData(img, 0, 0);
    g.setTransform(q, 0, 0, q, half * q, half * q);
    if (kind === 'beton') drawRebar(g, P, R);
    if (kind === 'verre' || kind === 'quartz') {
      /* un reflet doux, mais sans brillance de verre neuf */
      g.globalCompositeOperation = 'screen';
      draw.glow(g, -R * 0.3, -R * 0.3 * P.asp, R * 0.5, '#FFFFFF', kind === 'verre' ? 0.14 : 0.1);
      g.globalCompositeOperation = 'source-over';
    }
    return { cv: c, size, half, P };
  }

  /* bout de fer à béton rouillé qui dépasse du galet */
  function drawRebar(g, P, R) {
    const a = P.ra;
    const x0 = Math.cos(a) * R * 0.52, y0 = Math.sin(a) * R * 0.52 * P.asp;
    const len = R * 0.62;
    const x1 = x0 + Math.cos(a - 0.18) * len, y1 = y0 + Math.sin(a - 0.18) * len;
    const w = Math.max(3.2, R * 0.16);
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(40,20,10,0.35)';
    g.lineWidth = w * 1.1;
    g.beginPath();
    g.moveTo(x0 + 1.5, y0 + 2.5);
    g.lineTo(x1 + 2, y1 + 3);
    g.stroke();
    const grd = g.createLinearGradient(x0 - Math.sin(a) * w, y0 + Math.cos(a) * w, x0 + Math.sin(a) * w, y0 - Math.cos(a) * w);
    grd.addColorStop(0, '#5B2A17');
    grd.addColorStop(0.45, '#A65A2E');
    grd.addColorStop(0.7, '#C77A43');
    grd.addColorStop(1, '#6E331C');
    g.strokeStyle = grd;
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
    /* nervures du fer et pustules de rouille */
    const nx = Math.cos(a - 0.18), ny = Math.sin(a - 0.18);
    for (let t = 0.12; t < 0.95; t += 0.14) {
      const cx = x0 + (x1 - x0) * t, cy = y0 + (y1 - y0) * t;
      g.strokeStyle = 'rgba(60,25,12,0.55)';
      g.lineWidth = 1.1;
      g.beginPath();
      g.moveTo(cx - ny * w * 0.48 + nx * 1.2, cy + nx * w * 0.48 + ny * 1.2);
      g.lineTo(cx + ny * w * 0.48 - nx * 1.2, cy - nx * w * 0.48 - ny * 1.2);
      g.stroke();
    }
    const rr = P.nz.rnd;
    for (let i = 0; i < 9; i++) {
      const t = rr();
      const cx = x0 + (x1 - x0) * t + (rr() - 0.5) * w * 0.7, cy = y0 + (y1 - y0) * t + (rr() - 0.5) * w * 0.7;
      g.fillStyle = rr() < 0.5 ? 'rgba(196,110,52,0.8)' : 'rgba(110,48,22,0.7)';
      g.beginPath();
      g.arc(cx, cy, rr() * w * 0.22 + 0.4, 0, TAU);
      g.fill();
    }
    /* la tranche, coupée net */
    g.fillStyle = '#7B3C20';
    g.beginPath();
    g.ellipse(x1, y1, w * 0.5, w * 0.38, a - 0.18, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(214,150,96,0.6)';
    g.beginPath();
    g.ellipse(x1 - 0.5, y1 - 0.5, w * 0.28, w * 0.2, a - 0.18, 0, TAU);
    g.fill();
  }
  /* ---- la plage vue de dessus : sable sec en bas, sable mouillé vers le haut, la mer tout en haut ---- */
  function buildBeach(w, h, dpr, shore) {
    const s = Math.min(0.6, 300 / Math.max(w, h));
    const RW = Math.max(8, Math.round(w * s)), RH = Math.max(8, Math.round(h * s));
    const nz = lib.makeNoise(61);
    const rnd = nz.rnd;
    const m = Math.min(w, h);
    const c = document.createElement('canvas');
    c.width = RW;
    c.height = RH;
    const g = c.getContext('2d');
    const img = g.createImageData(RW, RH);
    const d = img.data;
    const DRY = C('#D9C7A3'), DRY2 = C('#CDB892'), WET = C('#9E8E70'), WET2 = C('#87785E');
    for (let y = 0; y < RH; y++) {
      const fy = y / s;
      for (let x = 0; x < RW; x++) {
        const fx = x / s;
        const X = fx / m, Y = fy / m;
        const n = nz.fbm(X * 3.1 + 2.3, Y * 3.1 + 5.1, 4);
        const n2 = nz.fbm(X * 9 + 11, Y * 9 + 3, 3);
        const line = shore(fx) + (n - 0.5) * m * 0.05;
        const wet = 1 - smooth(line, line + m * 0.3, fy);
        let r = lerp(DRY[0], DRY2[0], n2), gg = lerp(DRY[1], DRY2[1], n2), b = lerp(DRY[2], DRY2[2], n2);
        const wr = lerp(WET[0], WET2[0], n), wg = lerp(WET[1], WET2[1], n), wb = lerp(WET[2], WET2[2], n);
        r = lerp(r, wr, wet * 0.95);
        gg = lerp(gg, wg, wet * 0.95);
        b = lerp(b, wb, wet * 0.95);
        const sheen = (1 - smooth(line, line + m * 0.07, fy)) * 0.07;
        r += sheen;
        gg += sheen;
        b += sheen * 1.1;
        /* rides laissées par le ressac sur le sable sec */
        const rip = Math.sin((fy + (n - 0.5) * m * 0.35) * 0.19 + Math.sin(fx * 0.013) * 2.2);
        const ripK = (1 - wet) * 0.035 * smooth(0.2, 0.9, n2 + 0.3) + wet * 0.025;
        const f = 1 + rip * ripK + (rnd() - 0.5) * 0.09;
        /* laisse de mer : une bande plus sombre, pleine de petits débris, à la limite du sable mouillé */
        const tide = Math.exp(-Math.pow((fy - (line + m * 0.31)) / (m * 0.02), 2)) * (0.5 + n2) * 0.08;
        const k = (y * RW + x) * 4;
        d[k] = clamp(r * f - tide) * 255;
        d[k + 1] = clamp(gg * f - tide * 1.05) * 255;
        d[k + 2] = clamp(b * f - tide * 1.1) * 255;
        d[k + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    /* calque pleine résolution : grains de sable, coquillages broyés */
    const out = document.createElement('canvas');
    out.width = Math.round(w * dpr);
    out.height = Math.round(h * dpr);
    const o = out.getContext('2d');
    o.imageSmoothingEnabled = true;
    o.drawImage(c, 0, 0, out.width, out.height);
    o.setTransform(dpr, 0, 0, dpr, 0, 0);
    const grains = Math.round(w * h * 0.06);
    for (let i = 0; i < grains; i++) {
      const x = rnd() * w, y = rnd() * h;
      const t = rnd();
      o.fillStyle = t < 0.45 ? 'rgba(255,250,236,0.5)' : t < 0.8 ? 'rgba(120,98,66,0.32)' : t < 0.93 ? 'rgba(70,58,46,0.4)' : 'rgba(190,120,96,0.4)';
      const sz = rnd() < 0.85 ? 0.7 : 1.3;
      o.fillRect(x, y, sz, sz);
    }
    for (let i = 0; i < Math.round(w * h / 2600); i++) {
      const x = rnd() * w, y = shore(x) + m * 0.14 + rnd() * (h - shore(x));
      o.save();
      o.translate(x, y);
      o.rotate(rnd() * TAU);
      const sz = 1.2 + rnd() * 2.4;
      o.fillStyle = rnd() < 0.5 ? 'rgba(246,240,228,0.75)' : 'rgba(214,196,170,0.7)';
      o.beginPath();
      o.ellipse(0, 0, sz, sz * 0.6, 0, 0, TAU);
      o.fill();
      o.restore();
    }
    return out;
  }
  window.RM.games.anthropocene = function (api) {
    const stage = api.stage;
    api.style(CSS);
    const bgCv = api.canvas();
    const cv = api.canvas();
    const ctx = cv.ctx;
    const bctx = bgCv.ctx;
    bgCv.canvas.style.pointerEvents = 'none';
    const ACCENT = '#D6286F';
    const TEAL = '#1E8C8C';

    let beach = null;
    let pebbles = [];
    let found = 0;
    let time = 0;
    let open = null;      /* galet dont l'étiquette est affichée */
    let hoverP = null;
    let doneTimer = 0;
    let texScale = 1;
    let seaGrad = null, seaGradH = 0;
    let labelW = 0, labelH = 0;
    let sea = { top: 0, base: 0 };
    let foam = null;
    const ripples = [];
    const sparks = [];
    for (let i = 0; i < 120; i++) sparks.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, t: 0, life: 1, s: 1, col: '#fff' });
    let sIdx = 0;

    const label = document.createElement('p');
    label.className = 'an-label';
    label.setAttribute('aria-live', 'polite');
    stage.appendChild(label);

    /* ligne du rivage (limite du sable mouillé) */
    function shore(x) {
      return sea.base + Math.sin(x / cv.w * 5.1 + 0.6) * sea.amp + Math.sin(x / cv.w * 11.3 + 2) * sea.amp * 0.35;
    }

    /* ---- placement : 4 colonnes × 4 rangées, avec un décalage fixe pour casser la grille ---- */
    const JIT = [
      [0.1, -0.12], [-0.18, 0.08], [0.16, 0.14], [-0.06, -0.08],
      [-0.12, 0.1], [0.2, -0.06], [-0.04, 0.16], [0.08, -0.14],
      [0.18, -0.04], [-0.14, -0.12], [0.06, 0.12], [-0.2, 0.04],
      [-0.06, 0.14], [0.14, -0.1], [-0.16, 0.02], [0.12, 0.16],
    ];
    /* grilles possibles (indices de LAYOUT, rangée par rangée) : on garde celle qui donne les plus gros galets.
       Les roches humaines restent bien réparties dans chacune. */
    const GRIDS = [
      [[0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11], [12, 13, 14, 15]],
      [[0, 1, 2, 3, 6, 7], [4, 5, 8, 9, 11], [12, 13, 10, 14, 15]],
      [[0, 1, 2, 3, 4, 5, 6, 7], [8, 9, 10, 11, 12, 13, 14, 15]],
    ];
    function layout(w, h) {
      const m = Math.min(w, h);
      const top = sea.base + m * 0.1;
      const bottom = h - m * 0.045;
      let best = null;
      GRIDS.forEach((rows, gi) => {
        const ch = (bottom - top) / rows.length;
        let cw = w;
        rows.forEach((r) => { cw = Math.min(cw, w / r.length); });
        const R = Math.min(cw * 0.4, ch * 0.54) * (gi === 0 ? 1.06 : 1);
        if (!best || R > best.R) best = { rows, R, ch };
      });
      const rows = best.rows, ch = best.ch;
      const R = Math.max(20, best.R / (rows === GRIDS[0] ? 1.06 : 1));
      texScale = clamp(33 / R, 0.5, 1.4);
      const out = [];
      rows.forEach((r, ry) => {
        const cw = w / r.length;
        r.forEach((i, cx) => {
          const kind = LAYOUT[i];
          const K = KINDS[kind];
          const j = JIT[i];
          const r = R * K.scale, ext = r * (1.04 + K.wob) + 3;
          out[i] = {
            kind, i, human: K.human, R: r,
            x: clamp(cw * (cx + 0.5) + j[0] * cw * 0.4, ext, w - ext),
            y: clamp(top + ch * (ry + 0.5) + j[1] * ch * 0.38, sea.base + ext * 0.7, h - ext * 0.9),
          };
        });
      });
      return out;
    }

    /* les galets détaillés sont calculés un par un, en tâche de fond ; en attendant, un brouillon flou */
    let queue = [];
    function buildPebbles(w, h) {
      const old = pebbles;
      const L = layout(w, h);
      pebbles = L.map((p, i) => {
        const tex = renderPebble(p.kind, i + 1, p.R, cv.dpr, true, texScale);
        const prev = old[i];
        return Object.assign(p, {
          tex, fine: null, fineA: 0, found: prev ? prev.found : false, seen: prev ? prev.seen : false,
          lift: prev ? prev.lift : 0, liftT: 0, ring: prev && prev.found ? 1 : 0, wob: 0, pulse: 0,
          rx: Math.max(23, p.R * 1.02), ry: Math.max(23, p.R * Math.max(KINDS[p.kind].asp, 0.78) * 1.02),
        });
      });
      if (open) open = pebbles[open.i];
      if (hoverP) hoverP = pebbles[hoverP.i];
      /* d'abord les galets du milieu, que l'œil voit en premier */
      queue = pebbles.slice().sort((a, b) => Math.abs(a.y - h * 0.55) - Math.abs(b.y - h * 0.55));
      schedule();
    }
    /* une tâche courte par galet, dès le montage du jeu (avant qu'il n'arrive à l'écran) */
    let pumpTimer = 0;
    const idle = window.requestIdleCallback ? (fn) => window.requestIdleCallback(fn, { timeout: 90 }) : (fn) => setTimeout(fn, 16);
    function schedule() {
      if (!pumpTimer) pumpTimer = idle(pump);
    }
    function pump(deadline) {
      pumpTimer = 0;
      /* au moins un galet, puis d'autres tant que le navigateur a du temps libre */
      do {
        const pb = queue.shift();
        if (!pb) return;
        pb.fine = renderPebble(pb.kind, pb.i + 1, pb.R, cv.dpr, false, texScale);
        pb.fineA = api.visible && !api.reducedMotion ? 0.001 : 1;
        pb.ringP = null;
      } while (queue.length && deadline && deadline.timeRemaining && deadline.timeRemaining() > 12);
      if (queue.length) schedule();
    }

    /* écume : une frange de bulles le long des vagues, pré-rendue */
    function buildFoam(w) {
      const c = document.createElement('canvas');
      c.width = Math.round(w * cv.dpr);
      c.height = Math.round(40 * cv.dpr);
      const g = c.getContext('2d');
      g.scale(cv.dpr, cv.dpr);
      const nz = lib.makeNoise(9);
      for (let i = 0; i < w * 1.4; i++) {
        const x = nz.rnd() * w;
        const y = 14 + (nz.rnd() - 0.5) * 16 * nz.rnd();
        const r = 0.5 + nz.rnd() * nz.rnd() * 2.6;
        g.fillStyle = `rgba(255,255,255,${0.22 + nz.rnd() * 0.5})`;
        g.beginPath();
        g.arc(x, y, r, 0, TAU);
        g.fill();
      }
      return c;
    }

    function drawBg() {
      if (!beach) return;
      bctx.setTransform(1, 0, 0, 1, 0, 0);
      bctx.clearRect(0, 0, bgCv.canvas.width, bgCv.canvas.height);
      bctx.drawImage(beach, 0, 0, bgCv.canvas.width, bgCv.canvas.height);
      bctx.setTransform(bgCv.dpr, 0, 0, bgCv.dpr, 0, 0);
    }
    bgCv.onResize(drawBg);
    cv.onResize((w, h) => {
      const m = Math.min(w, h);
      sea = { base: clamp(h * 0.13, 36, 92), amp: m * 0.018 };
      beach = buildBeach(w, h, cv.dpr, shore);
      foam = buildFoam(w);
      buildPebbles(w, h);
      seaGrad = null;
      drawBg();
      if (open) {
        labelFor = null;
        placeLabel(open);
      }
    });

    /* ---- ombres (sprites partagés) ---- */
    function shadowSprite(c0, a0, a1, mid) {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d');
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, rgba(c0, a0));
      gr.addColorStop(mid, rgba(c0, a1));
      gr.addColorStop(1, rgba(c0, 0));
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 64);
      return c;
    }
    const SH_SOFT = shadowSprite('#4A3A24', 0.42, 0.24, 0.55);
    const SH_HARD = shadowSprite('#3A2C1A', 0.62, 0.5, 0.7);

    /* contour du galet (pour l'anneau), dans le repère du galet */
    function ringPath(pb, gap) {
      const P = pb.tex.P;
      const cr = Math.cos(P.rot), sr = Math.sin(P.rot);
      const path = new Path2D();
      let len = 0, px = 0, py = 0;
      for (let i = 0; i <= 48; i++) {
        const a = (i / 48) * TAU;
        const e = P.brick ? shapeRBrick(a) : shapeR(a, P);
        const lx = Math.cos(a) * pb.R * e, ly = Math.sin(a) * pb.R * e * P.asp;
        let x = lx * cr - ly * sr, y = lx * sr + ly * cr;
        const l = Math.hypot(x, y) || 1;
        x += (x / l) * gap;
        y += (y / l) * gap;
        if (i === 0) path.moveTo(x, y);
        else {
          path.lineTo(x, y);
          len += Math.hypot(x - px, y - py);
        }
        px = x;
        py = y;
      }
      path.closePath();
      return { path, len };
    }

    function liftOff(pb) {
      return pb.lift * pb.R * 0.16;
    }

    /* ---- la mer : vagues douces, écume, reflets ---- */
    function edgeY(x, run, ph) {
      const m = Math.min(cv.w, cv.h);
      return shore(x) - m * 0.045 + run + Math.sin(x * 0.045 + ph * 1.3) * m * 0.006 + Math.sin(x * 0.11 - ph * 0.9) * m * 0.003;
    }
    function seaPath(run, ph, dy) {
      ctx.beginPath();
      ctx.moveTo(0, -2);
      ctx.lineTo(cv.w, -2);
      for (let x = cv.w; x >= -6; x -= 6) ctx.lineTo(x, edgeY(x, run, ph) + dy);
      ctx.closePath();
    }
    function edgeLine(run, ph, dy) {
      ctx.beginPath();
      for (let x = -6; x <= cv.w + 6; x += 6) {
        const y = edgeY(x, run, ph) + dy;
        if (x === -6) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    }
    function drawSea(t) {
      const m = Math.min(cv.w, cv.h);
      const ph = api.reducedMotion ? 2 : t;
      const sw = 0.5 + 0.5 * Math.sin(ph * 0.95);
      const run = m * 0.055 * ease.inOutSine(sw);
      if (!seaGrad || seaGradH !== cv.h) {
        seaGradH = cv.h;
        const b = sea.base;
        seaGrad = ctx.createLinearGradient(0, 0, 0, b + m * 0.03);
        seaGrad.addColorStop(0, 'rgba(34,94,108,1)');
        seaGrad.addColorStop(0.45, 'rgba(46,121,128,0.98)');
        seaGrad.addColorStop(0.78, 'rgba(84,152,150,0.86)');
        seaGrad.addColorStop(1, 'rgba(150,196,184,0.42)');
      }
      /* sable mouillé brillant laissé par la vague qui se retire */
      const wetA = 0.22 * (1 - sw);
      if (wetA > 0.01) {
        ctx.fillStyle = `rgba(250,250,240,${(wetA * 0.35).toFixed(3)})`;
        seaPath(m * 0.055, ph, 2);
        ctx.fill();
      }
      ctx.fillStyle = seaGrad;
      seaPath(run, ph, 0);
      ctx.fill();
      /* vagues qui arrivent du large */
      ctx.save();
      seaPath(run, ph, 0);
      ctx.clip();
      for (let k = 0; k < 3; k++) {
        const q = api.reducedMotion ? (k + 0.5) / 3 : (ph * 0.13 + k / 3) % 1;
        const a = Math.sin(q * Math.PI) * 0.5;
        if (a < 0.02) continue;
        ctx.strokeStyle = `rgba(236,248,244,${a.toFixed(3)})`;
        ctx.lineWidth = 1 + 1.6 * q;
        ctx.beginPath();
        for (let x = -6; x <= cv.w + 6; x += 8) {
          const yE = edgeY(x, run, ph);
          const y = lerp(sea.base * 0.08, yE - 5, q) + Math.sin(x * 0.03 + k * 2 + ph * 0.5) * 3;
          if (x === -6) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      /* reflets du ciel */
      for (let i = 0; i < 10; i++) {
        const gx = ((i * 97.3) % 1) * cv.w + ((i * 37) % 23);
        const gx2 = (gx + (api.reducedMotion ? 0 : ph * 6 * (i % 2 ? 1 : -1))) % cv.w;
        const gy = sea.base * (0.15 + ((i * 0.37) % 0.6));
        const tw = api.reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(ph * 2.3 + i * 1.7);
        ctx.fillStyle = `rgba(255,255,255,${(0.35 * tw).toFixed(3)})`;
        ctx.fillRect((gx2 + cv.w) % cv.w, gy, 5 + (i % 3) * 3, 1.4);
      }
      ctx.restore();
      /* écume au bord de l'eau */
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(255,255,255,0.32)';
      ctx.lineWidth = 7;
      edgeLine(run, ph, -3);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.88)';
      ctx.lineWidth = 1.8;
      edgeLine(run, ph, 0);
      ctx.stroke();
      if (foam) {
        const fw = foam.width / cv.dpr;
        const off = api.reducedMotion ? 0 : (ph * 4) % fw;
        for (let x = 0; x < cv.w; x += 8) {
          const sx = ((x + off) % (fw - 8)) * cv.dpr;
          ctx.drawImage(foam, sx, 0, 8 * cv.dpr, foam.height, x, edgeY(x + 4, run, ph) - 17, 8, 40 * (foam.height / cv.dpr / 40));
        }
      }
    }

    /* ---- dessin des galets ---- */
    function drawShadow(pb) {
      const P = pb.tex.P;
      const L = pb.lift;
      const glass = pb.kind === 'verre' || pb.kind === 'quartz' ? 0.7 : 1;
      ctx.save();
      ctx.translate(pb.x + pb.R * (0.12 + 0.2 * L), pb.y + pb.R * (0.16 + 0.26 * L));
      ctx.rotate(P.rot);
      ctx.globalAlpha = (0.95 - 0.35 * L) * glass;
      ctx.scale(pb.R * (1.12 + 0.16 * L), pb.R * P.asp * (1.12 + 0.16 * L));
      ctx.drawImage(SH_SOFT, -1, -1, 2, 2);
      ctx.restore();
      if (L < 0.98) {
        ctx.save();
        ctx.translate(pb.x + pb.R * 0.05, pb.y + pb.R * 0.08);
        ctx.rotate(P.rot);
        ctx.globalAlpha = (1 - L) * 0.9 * glass;
        ctx.scale(pb.R * 1.0, pb.R * P.asp * 1.0);
        ctx.drawImage(SH_HARD, -1, -1, 2, 2);
        ctx.restore();
      }
    }
    function drawPebble(pb) {
      const t = pb.fine && pb.fineA >= 1 ? pb.fine : pb.tex;
      const lo = liftOff(pb);
      const sc = 1 + pb.lift * 0.07 + pb.pulse * 0.05;
      const x = pb.x, y = pb.y - lo;
      ctx.save();
      ctx.translate(x, y);
      if (sc !== 1) ctx.scale(sc, sc);
      ctx.drawImage(t.cv, -t.half, -t.half, t.size, t.size);
      if (pb.fine && pb.fineA < 1) {
        ctx.globalAlpha = ease.inOutSine(pb.fineA);
        ctx.drawImage(pb.fine.cv, -pb.fine.half, -pb.fine.half, pb.fine.size, pb.fine.size);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
      if (pb.ring > 0) {
        if (!pb.ringP) pb.ringP = ringPath(pb, Math.max(5, pb.R * 0.16));
        const k = clamp(pb.ring);
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(sc, sc);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        if (k < 1) ctx.setLineDash([pb.ringP.len * k, pb.ringP.len]);
        ctx.strokeStyle = 'rgba(255,255,255,0.75)';
        ctx.lineWidth = 6.5;
        ctx.stroke(pb.ringP.path);
        ctx.strokeStyle = ACCENT;
        ctx.lineWidth = 3.4;
        ctx.stroke(pb.ringP.path);
        ctx.restore();
      }
    }

    function render() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.canvas.width, cv.canvas.height);
      ctx.setTransform(cv.dpr, 0, 0, cv.dpr, 0, 0);
      drawSea(time);
      for (const pb of pebbles) if (pb !== open) drawShadow(pb);
      for (const pb of pebbles) if (pb !== open) drawPebble(pb);
      /* ondes au toucher */
      for (const r of ripples) {
        const k = r.t / r.dur;
        ctx.save();
        ctx.translate(r.x, r.y);
        ctx.strokeStyle = rgba(r.col, 0.75 * (1 - k));
        ctx.lineWidth = 2.4 * (1 - k) + 0.6;
        const s = lerp(r.r0, r.r1, ease.outCubic(k));
        ctx.scale(s, s * r.asp);
        ctx.beginPath();
        ctx.arc(0, 0, 1, 0, TAU);
        ctx.restore();
        ctx.stroke();
      }
      if (open) {
        drawShadow(open);
        drawPebble(open);
      }
      for (let i = 0; i < sparks.length; i++) {
        const s = sparks[i];
        if (!s.on) continue;
        const k = s.t / s.life;
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = s.col;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.s * (1 - k * 0.5), 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function update(dt) {
      time += dt;
      for (const pb of pebbles) {
        if (pb.fine && pb.fineA < 1) pb.fineA = Math.min(1, pb.fineA + dt * 3.5);
        const target = pb === open ? 1 : pb === hoverP ? 0.22 : 0;
        pb.lift += (target - pb.lift) * (1 - Math.pow(0.0008, dt));
        if (Math.abs(pb.lift - target) < 0.002) pb.lift = target;
        if (pb.found && pb.ring < 1) pb.ring = Math.min(1, pb.ring + dt * 2.6);
        if (pb.pulse > 0) pb.pulse = Math.max(0, pb.pulse - dt * 3.5);
      }
      for (let i = ripples.length - 1; i >= 0; i--) {
        ripples[i].t += dt;
        if (ripples[i].t >= ripples[i].dur) ripples.splice(i, 1);
      }
      for (let i = 0; i < sparks.length; i++) {
        const s = sparks[i];
        if (!s.on) continue;
        s.t += dt;
        if (s.t >= s.life) {
          s.on = false;
          continue;
        }
        const dr = Math.pow(0.05, dt);
        s.vx *= dr;
        s.vy = s.vy * dr + 30 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
      }
      if (open && open.lift < 0.999) placeLabel(open);
    }

    /* ---- étiquette ---- */
    let labelFor = null;
    function fillLabel(pb) {
      const T = TEXTES.roches[pb.kind];
      label.replaceChildren();
      const kick = document.createElement('span');
      kick.className = 'an-kicker';
      kick.textContent = pb.human ? TEXTES.humaine : TEXTES.naturelle;
      const nm = document.createElement('strong');
      nm.textContent = lib.fr(T.nom);
      label.append(kick, nm, document.createTextNode(lib.fr(T.info)));
      label.classList.toggle('is-human', pb.human);
      labelFor = pb;
      labelW = label.offsetWidth;
      labelH = label.offsetHeight;
    }
    function placeLabel(pb) {
      if (labelFor !== pb) fillLabel(pb);
      const W = cv.w, H = cv.h, M = 8;
      const lw = labelW, lh = labelH;
      if (!lw) return;
      const lo = liftOff(pb);
      const cx = pb.x, top = pb.y - lo - pb.R * pb.tex.P.asp * 1.06 - 12, bot = pb.y - lo + pb.R * 1.06 + 12;
      let side = 'above', y = top - lh;
      if (y < M + 2) {
        side = 'below';
        y = bot;
      }
      if (side === 'below' && y + lh > H - M) {
        /* ni au-dessus ni au-dessous : à côté du galet */
        side = 'side';
        y = clamp(pb.y - lh / 2, M, H - M - lh);
      }
      let x;
      if (side === 'side') {
        const right = pb.x + pb.R * 1.15 + 10;
        x = right + lw <= W - M ? right : pb.x - pb.R * 1.15 - 10 - lw;
        x = clamp(x, M, W - M - lw);
      } else {
        x = clamp(cx - lw / 2, M, W - M - lw);
      }
      label.dataset.side = side;
      label.style.setProperty('--ax', clamp(cx - x, 16, lw - 16).toFixed(1) + 'px');
      label.style.transform = '';
      label.style.left = x.toFixed(1) + 'px';
      label.style.top = y.toFixed(1) + 'px';
    }
    function showLabel(pb) {
      fillLabel(pb);
      label.classList.remove('is-on');
      placeLabel(pb);
      void label.offsetWidth;
      label.classList.add('is-on');
    }
    function hideLabel() {
      label.classList.remove('is-on');
      open = null;
    }

    /* ---- retours visuels ---- */
    function burst(x, y, col, n) {
      if (api.reducedMotion) return;
      for (let i = 0; i < n; i++) {
        const s = sparks[sIdx];
        sIdx = (sIdx + 1) % sparks.length;
        const a = rand(TAU), v = rand(40, 120);
        s.on = true;
        s.x = x + Math.cos(a) * 6;
        s.y = y + Math.sin(a) * 6;
        s.vx = Math.cos(a) * v;
        s.vy = Math.sin(a) * v - 30;
        s.t = 0;
        s.life = rand(0.45, 0.8);
        s.s = rand(1.4, 2.8);
        s.col = col;
      }
    }

    function updateStatus() {
      api.status(TEXTES.compteur(found, TOTAL_HUMAN));
      api.progress(found / TOTAL_HUMAN);
    }

    function pick(pb) {
      api.gesture(null);
      if (open === pb) {
        /* deuxième tape : on repose le galet */
        hideLabel();
        api.sfx.play('tick', { pitch: 0.8 });
        return;
      }
      open = pb;
      pb.pulse = 1;
      pb.seen = true;
      ripples.push({ x: pb.x, y: pb.y, t: 0, dur: 0.6, r0: pb.R * 0.9, r1: pb.R * 1.7, asp: pb.tex.P.asp, col: pb.human ? ACCENT : '#FFFFFF' });
      showLabel(pb);
      if (pb.human) {
        if (!pb.found) {
          pb.found = true;
          pb.ring = 0;
          found++;
          updateStatus();
          burst(pb.x, pb.y - pb.R * 0.2, ACCENT, 16);
          burst(pb.x, pb.y - pb.R * 0.2, '#FFFFFF', 8);
          api.sfx.play('chime', { pitch: 0.9 + found * 0.06 });
          api.buzz(12);
          if (found >= TOTAL_HUMAN && !api.isDone()) {
            doneTimer = setTimeout(() => {
              doneTimer = 0;
              if (found >= TOTAL_HUMAN) api.done(TEXTES.fin, TEXTES.finStatut);
            }, 450);
          }
        } else {
          api.sfx.play('chime', { pitch: 1.2, volume: 0.5 });
        }
      } else {
        burst(pb.x, pb.y - pb.R * 0.2, TEAL, 6);
        api.sfx.play('pop', { pitch: rand(0.9, 1.15) });
        api.buzz(8);
      }
    }

    function hitTest(x, y) {
      let best = null, bd = 1e9;
      for (const pb of pebbles) {
        const dx = (x - pb.x) / pb.rx, dy = (y - (pb.y - liftOff(pb))) / pb.ry;
        const d = dx * dx + dy * dy;
        if (d < 1.25 && d < bd) {
          bd = d;
          best = pb;
        }
      }
      return best;
    }

    api.track(cv.canvas, {
      up(p, e, cancelled) {
        if (cancelled || !p.tap) return;
        const pb = hitTest(p.x, p.y);
        if (pb) pick(pb);
        else if (open) {
          hideLabel();
          api.sfx.play('tick', { pitch: 0.7, volume: 0.6 });
        } else {
          ripples.push({ x: p.x, y: p.y, t: 0, dur: 0.5, r0: 4, r1: 26, asp: 0.7, col: '#FFFFFF' });
        }
      },
      hover(p) {
        if (p.type !== 'mouse') return;
        const pb = hitTest(p.x, p.y);
        hoverP = pb;
        cv.canvas.classList.toggle('is-over', !!pb);
      },
    }, { touchAction: 'pan-y' });
    cv.canvas.addEventListener('pointerleave', () => {
      hoverP = null;
      cv.canvas.classList.remove('is-over');
    });

    /* ---- clavier : un bouton invisible par galet, suivi du focus ---- */
    const hits = LAYOUT.map((kind, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'an-hit';
      b.setAttribute('aria-label', TEXTES.galet(i + 1, LAYOUT.length));
      b.addEventListener('click', (e) => {
        if (e.detail !== 0) return; /* seulement au clavier : le canevas gère le toucher */
        pick(pebbles[i]);
      });
      stage.appendChild(b);
      return b;
    });
    function placeHits() {
      pebbles.forEach((pb, i) => {
        const b = hits[i];
        b.style.left = (pb.x - pb.rx).toFixed(1) + 'px';
        b.style.top = (pb.y - pb.ry).toFixed(1) + 'px';
        b.style.width = (pb.rx * 2).toFixed(1) + 'px';
        b.style.height = (pb.ry * 2).toFixed(1) + 'px';
      });
    }
    cv.onResize(placeHits);

    /* ---- remise à zéro ---- */
    function reset() {
      clearTimeout(doneTimer);
      doneTimer = 0;
      found = 0;
      hideLabel();
      labelFor = null;
      hoverP = null;
      ripples.length = 0;
      for (let i = 0; i < sparks.length; i++) sparks[i].on = false;
      for (const pb of pebbles) {
        pb.found = false;
        pb.seen = false;
        pb.lift = 0;
        pb.ring = 0;
        pb.pulse = 0;
      }
      updateStatus();
      const DARK = ['basalte', 'silex', 'granite'];
      const nat = pebbles.filter((pb) => DARK.indexOf(pb.kind) >= 0 && pb.y > cv.h * 0.3 && pb.y < cv.h * 0.85);
      const g = nat[(Math.random() * nat.length) | 0] || pebbles[0];
      api.gesture('tap', { x: (g.x / cv.w) * 100, y: (g.y / cv.h) * 100 });
    }

    api.loop((dt) => {
      update(dt);
      render();
    });
    api.onReset(reset);
    reset();
    update(0.016);
    render();
  };
})();
