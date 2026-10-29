/* Ni trop près, ni trop loin : on fait glisser une planète le long de son orbite, du Soleil
   brûlant jusqu'au froid de l'espace, pour trouver la distance où l'eau reste liquide.
   Une bande verte révèle alors la bonne zone, entre Vénus et Mars.
   Version des petits : bande large, courte attente, textes simples. */
(function () {
  'use strict';
  const { lib } = window.RM;
  const { TAU, rand, clamp, lerp, invLerp, ease, rgba, draw } = lib;

  /* Tous les textes du jeu, faciles à corriger */
  const TEXTES = {
    chaud: 'Trop chaud : l’eau s’envole en vapeur !',
    bien: 'Juste bien : l’eau reste liquide !',
    froid: 'Trop froid : l’eau gèle !',
    consigneZone: 'Pose la planète dans la bande verte !',
    venus: 'Vénus',
    mars: 'Mars',
    zone: 'la bonne zone',
    clavier: 'La planète : flèches gauche et droite pour la rapprocher ou l’éloigner du Soleil.',
    fin: 'Ni trop près, ni trop loin : l’eau reste liquide !',
    finStatut: 'Mais il faut aussi une couverture invisible…',
  };

  const ZONE_IN = 0.28;   /* début de la bonne zone (fraction du rail, depuis le Soleil) */
  const ZONE_OUT = 0.66;  /* fin de la bonne zone : une bande large, pour un petit doigt */
  const HOLD = 1.2;       /* secondes à rester dans la zone pour réussir */
  const START_X = 0.82;   /* départ de la planète (fraction de la largeur, comme le doigt fantôme) */
  const RAIL_Y = 0.5;     /* hauteur du rail (fraction de la hauteur) */
  const VENUS_U = 0.19;   /* Vénus : dans la zone chaude, près de la limite intérieure */
  const MARS_U = 0.73;    /* Mars : juste après la limite extérieure */
  const LW = 288, LH = 144; /* carte de la planète (longitude × latitude) */
  const GW = 96, GH = 48;   /* cartes de Vénus et de Mars, vues de plus loin */

  const CSS = `
.game[data-game="boucle"] .bc-label {
  position: absolute; z-index: 2; left: 0; top: 0; margin: 0;
  padding: 2px 9px 3px; border-radius: 9px 12px 10px 11px;
  background: rgba(8, 17, 29, 0.66); color: #CBD8E8;
  font: 600 0.8125rem/1.2 var(--font-text); letter-spacing: 0.01em; white-space: nowrap;
  pointer-events: none; opacity: 0;
  transform: translate(-50%, -100%) translateY(5px);
  transition: opacity 0.7s ease, transform 0.7s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.game[data-game="boucle"] .bc-label.is-on { opacity: 1; transform: translate(-50%, -100%); }
.game[data-game="boucle"] .bc-label--zone { color: #BDEFA2; background: rgba(8, 17, 29, 0.72); transform: translate(-50%, -50%) translateY(6px); }
.game[data-game="boucle"] .bc-label--zone.is-on { transform: translate(-50%, -50%); }
.game[data-game="boucle"] .game-stage:focus-visible { outline-offset: -4px; }
`;

  function seeded(seed) {
    let s = seed >>> 0 || 1;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }
  /* Fait vieillir une liste d'effets et retire ceux qui sont finis, sans créer de tableau. */
  function age(list, dt) {
    let j = 0;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      e.t += dt;
      if (e.t < e.dur) list[j++] = e;
    }
    list.length = j;
  }
  function sstep(a, b, x) {
    const t = clamp((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  }
  const rgb = lib.hexToRgb;
  function setC(c, A) { c[0] = A[0]; c[1] = A[1]; c[2] = A[2]; return c; }
  function towards(c, A, t) {
    c[0] += (A[0] - c[0]) * t;
    c[1] += (A[1] - c[1]) * t;
    c[2] += (A[2] - c[2]) * t;
    return c;
  }

  /* Bruit de valeur 3D (déterministe) : on l'échantillonne directement sur la sphère,
     donc ni couture ni étirement aux pôles. cellEdge donne la distance au bord des
     cellules (Voronoï) : de quoi dessiner des fissures en polygones. */
  function makeNoise3(seed) {
    const r = seeded(seed);
    const perm = new Uint8Array(512);
    const p = [];
    for (let i = 0; i < 256; i++) p.push(i);
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      const t = p[i];
      p[i] = p[j];
      p[j] = t;
    }
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    const val = new Float32Array(256);
    for (let i = 0; i < 256; i++) val[i] = r();
    const jit = new Float32Array(768);
    for (let i = 0; i < 768; i++) jit[i] = 0.08 + r() * 0.84;
    function noise(x, y, z) {
      const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
      let u = x - xi, v = y - yi, w = z - zi;
      u = u * u * (3 - 2 * u);
      v = v * v * (3 - 2 * v);
      w = w * w * (3 - 2 * w);
      const a0 = perm[xi & 255], a1 = perm[(xi + 1) & 255];
      const b00 = perm[(a0 + yi) & 511], b01 = perm[(a0 + yi + 1) & 511];
      const b10 = perm[(a1 + yi) & 511], b11 = perm[(a1 + yi + 1) & 511];
      const c000 = val[perm[(b00 + zi) & 511]], c001 = val[perm[(b00 + zi + 1) & 511]];
      const c010 = val[perm[(b01 + zi) & 511]], c011 = val[perm[(b01 + zi + 1) & 511]];
      const c100 = val[perm[(b10 + zi) & 511]], c101 = val[perm[(b10 + zi + 1) & 511]];
      const c110 = val[perm[(b11 + zi) & 511]], c111 = val[perm[(b11 + zi + 1) & 511]];
      const x00 = c000 + (c100 - c000) * u, x10 = c010 + (c110 - c010) * u;
      const x01 = c001 + (c101 - c001) * u, x11 = c011 + (c111 - c011) * u;
      const y0 = x00 + (x10 - x00) * v, y1 = x01 + (x11 - x01) * v;
      return y0 + (y1 - y0) * w;
    }
    function fbm(x, y, z, oct) {
      let s = 0, amp = 0.5, f = 1, norm = 0;
      for (let i = 0; i < oct; i++) {
        s += amp * noise(x * f + i * 17.3, y * f + i * 9.1, z * f + i * 5.7);
        norm += amp;
        amp *= 0.5;
        f *= 2;
      }
      return s / norm;
    }
    function cellEdge(x, y, z) {
      const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
      let f1 = 1e9, f2 = 1e9;
      for (let i = -1; i <= 1; i++) {
        const cx = xi + i;
        const a = perm[cx & 255];
        for (let j = -1; j <= 1; j++) {
          const cy = yi + j;
          const b = perm[(a + cy) & 511];
          for (let k = -1; k <= 1; k++) {
            const cz = zi + k;
            const hh = perm[(b + cz) & 511] * 3;
            const dx = cx + jit[hh] - x, dy = cy + jit[hh + 1] - y, dz = cz + jit[hh + 2] - z;
            const d = dx * dx + dy * dy + dz * dz;
            if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
          }
        }
      }
      return Math.sqrt(f2) - Math.sqrt(f1);
    }
    return { noise, fbm, cellEdge };
  }

  /* Parcourt une carte (longitude × latitude) avec, pour chaque texel, son point sur la sphère. */
  function eachTexel(tw, th, fn) {
    for (let y = 0; y < th; y++) {
      const phi = (0.5 - (y + 0.5) / th) * Math.PI;
      const cp = Math.cos(phi), sp = Math.sin(phi);
      const la = Math.abs(phi) / (Math.PI / 2);
      for (let x = 0; x < tw; x++) {
        const t = ((x + 0.5) / tw) * TAU;
        fn(y * tw + x, cp * Math.cos(t), cp * Math.sin(t), sp, la);
      }
    }
  }

  /* Champs de la planète : relief, détail, nuages et fissures. Le calcul avance ligne par
     ligne (step), pour pouvoir l'étaler sur plusieurs images sans figer la page. */
  function fieldBuilder(tw, th, cracks) {
    const N = tw * th;
    const F = {
      tw, th, ready: false,
      elev: new Float32Array(N), det: new Float32Array(N), crack: new Float32Array(N),
      cloud: new Float32Array(N), lat: new Float32Array(N),
      sea: 0.5, dry: 0.3, top: 0.8, depth: 0.1,
    };
    const n = makeNoise3(11), m = makeNoise3(5), q = makeNoise3(29), c3 = makeNoise3(43);
    const tx = TAU / tw;
    const S1 = 3.4, S2 = 8.5;
    let y = 0;
    function row(yy) {
      const phi = (0.5 - (yy + 0.5) / th) * Math.PI;
      const cp = Math.cos(phi), sp = Math.sin(phi);
      const la = Math.abs(phi) / (Math.PI / 2);
      for (let x = 0; x < tw; x++) {
        const t = ((x + 0.5) / tw) * TAU;
        const X = cp * Math.cos(t), Y = cp * Math.sin(t), Z = sp;
        const i = yy * tw + x;
        F.lat[i] = la;
        F.elev[i] = n.fbm(X * 1.45 + 3, Y * 1.45 + 7, Z * 1.45 + 1, 5) - 0.07 * la * la;
        const d = m.fbm(X * 4.6, Y * 4.6, Z * 4.6, 3);
        F.det[i] = d;
        /* nuages : des tourbillons (domaine déformé), plus nombreux aux latitudes moyennes */
        const wx = q.fbm(X * 1.7 + 5, Y * 1.7, Z * 1.7, 2) - 0.5;
        const wy = q.fbm(X * 1.7, Y * 1.7 + 9, Z * 1.7 + 4, 2) - 0.5;
        const cl = q.fbm(X * 3.1 + wx * 2.2, Y * 3.1 + wy * 2.2, Z * 4.2, 4);
        F.cloud[i] = sstep(0.5, 0.63, cl) * (0.72 + 0.28 * Math.cos(la * 7.2));
        /* fissures : de grands polygones, recoupés par de plus petits */
        if (!cracks) continue;
        const e1 = c3.cellEdge(X * S1, Y * S1, Z * S1) / (S1 * tx);
        const e2 = c3.cellEdge(X * S2 + 40, Y * S2, Z * S2) / (S2 * tx);
        const thick = 1.1 + (d - 0.5) * 1.4;
        F.crack[i] = Math.max(1 - sstep(0.3, thick + 0.4, e1), 0.55 * (1 - sstep(0.2, 0.85, e2)));
      }
    }
    function finish() {
      const sorted = Float32Array.from(F.elev).sort();
      const at = (f) => sorted[Math.floor(f * (N - 1))];
      F.sea = at(0.6);
      F.dry = at(0.015);
      F.top = at(0.995);
      F.depth = Math.max(0.05, F.sea - at(0.02));
      F.ready = true;
    }
    F.step = (budget) => {
      const t0 = performance.now();
      while (y < th) {
        row(y++);
        if (performance.now() - t0 > budget) break;
      }
      if (y >= th && !F.ready) finish();
      return F.ready;
    };
    return F;
  }

  /* Vénus, vue de loin : une boule de nuages couleur de soufre, en bandes douces. */
  function paintVenus(out, tw, th) {
    const n = makeNoise3(41);
    const A = rgb('#F3E6BE'), B = rgb('#D9BC7A'), C = rgb('#BF9A55');
    const c = [0, 0, 0];
    eachTexel(tw, th, (i, X, Y, Z) => {
      const w = n.fbm(X * 1.6 + 2, Y * 1.6, Z * 1.6, 3);
      const b = 0.5 + 0.5 * Math.sin(Z * 9 + w * 6);
      setC(c, A);
      towards(c, B, b * 0.75);
      towards(c, C, sstep(0.55, 0.8, w) * 0.4);
      out[i * 3] = c[0]; out[i * 3 + 1] = c[1]; out[i * 3 + 2] = c[2];
    });
  }
  /* Mars, vue de loin : du rouille, des plaques sombres et une petite calotte blanche. */
  function paintMars(out, tw, th) {
    const n = makeNoise3(53);
    const A = rgb('#D0703F'), B = rgb('#A84B28'), D = rgb('#6E3420'), W = rgb('#F2EEE8');
    const c = [0, 0, 0];
    eachTexel(tw, th, (i, X, Y, Z, la) => {
      const e = n.fbm(X * 2 + 4, Y * 2, Z * 2, 4);
      setC(c, A);
      towards(c, B, sstep(0.45, 0.6, e));
      towards(c, D, sstep(0.6, 0.7, e) * 0.8);
      towards(c, W, sstep(0.84, 0.9, la + (e - 0.5) * 0.2));
      out[i * 3] = c[0]; out[i * 3 + 1] = c[1]; out[i * 3 + 2] = c[2];
    });
  }

  window.RM.games.boucle = function (api) {
    const cv = api.canvas();
    const ctx = cv.ctx;
    const stage = api.stage;
    const AMB = api.reducedMotion ? 0.25 : 1;
    api.style(CSS);

    /* ---- étiquettes ---- */
    function makeLabel(text, extra) {
      const el = document.createElement('p');
      el.className = 'bc-label' + (extra ? ' ' + extra : '');
      el.setAttribute('aria-hidden', 'true');
      el.textContent = lib.fr(text);
      stage.appendChild(el);
      return el;
    }
    const lbVenus = makeLabel(TEXTES.venus);
    const lbMars = makeLabel(TEXTES.mars);
    const lbZone = makeLabel(TEXTES.zone, 'bc-label--zone');

    /* ---- la scène est aussi un curseur au clavier ---- */
    stage.tabIndex = 0;
    stage.setAttribute('role', 'slider');
    stage.setAttribute('aria-label', TEXTES.clavier);
    stage.setAttribute('aria-valuemin', '0');
    stage.setAttribute('aria-valuemax', '100');

    /* ---- textures ---- */
    /* la planète : d'abord une carte légère (pour la première image), puis la carte fine,
       calculée petit à petit pendant les premières images */
    let F = fieldBuilder(LW / 2.5 | 0, LH / 2.5 | 0, false);
    F.step(Infinity);
    let fine = fieldBuilder(LW, LH, true);
    let surf = new Uint8ClampedArray(F.tw * F.th * 3);
    let wet = new Float32Array(F.tw * F.th);
    const venusTex = new Uint8ClampedArray(GW * GH * 3);
    const marsTex = new Uint8ClampedArray(GW * GH * 3);
    paintVenus(venusTex, GW, GH);
    paintMars(marsTex, GW, GH);
    const NOWET = new Float32Array(GW * GH);
    const NOCLOUD = new Float32Array(GW * GH);

    const COL = {
      deep: rgb('#16407C'), shallow: rgb('#2C82C6'), coast: rgb('#6CC0EA'),
      grass: rgb('#3F8A3A'), forest: rgb('#2C6A33'), olive: rgb('#71904A'), sand: rgb('#C6AB6C'), brown: rgb('#86684A'), rock: rgb('#B3A690'),
      seabed: rgb('#D7A56E'), salt: rgb('#F0DCB8'),
      hotA: rgb('#CD6A2E'), hotB: rgb('#7C3318'), crackHot: rgb('#3B170C'),
      snow: rgb('#F4F9FD'), snowShade: rgb('#D2E5F3'), seaIce: rgb('#C3E1F5'), iceCrack: rgb('#7DB2DC'), frost: rgb('#DDEFFA'),
    };
    const RIM = { bien: rgb('#86C8FF'), chaud: rgb('#FFB27A'), froid: rgb('#E2F3FF') };
    const tc = [0, 0, 0], hc = [0, 0, 0], ic = [0, 0, 0], lc = [0, 0, 0], wc = [0, 0, 0];
    let paintedH = -1, paintedC = -1;

    /* Peint la surface selon la chaleur (0..1) et le froid (0..1) :
       chaud, les océans s'évaporent et la terre se craquelle ; froid, la glace descend des pôles. */
    function paintSurface(hot, cold) {
      const qh = Math.round(hot * 40) / 40, qc = Math.round(cold * 40) / 40;
      if (qh === paintedH && qc === paintedC) return;
      paintedH = qh;
      paintedC = qc;
      const S = lerp(F.sea, F.dry, Math.pow(qh, 0.85));
      const iceLine = lerp(0.8, -0.34, qc);
      const crackK = sstep(0.12, 0.65, qh) * 0.92;
      const N = F.tw * F.th;
      const EPS = 0.009; /* largeur du rivage : les côtes sont adoucies, pas en escalier */
      for (let i = 0; i < N; i++) {
        const e = F.elev[i], d = F.det[i], la = F.lat[i], ck = F.crack[i];
        const c = tc;
        /* la terre ferme, ou le fond de mer asséché */
        const kw = 1 - sstep(S - EPS, S + EPS, e); /* 1 = eau liquide */
        if (kw < 1) {
          const kl = sstep(F.sea - EPS, F.sea + EPS, e);
          if (kl < 1) {
            /* fond de mer asséché : sel et vase, puis fissures */
            setC(c, COL.seabed);
            towards(c, COL.salt, clamp((F.sea - e) / F.depth) * 0.8);
            towards(c, COL.hotA, qh * 0.3);
            towards(c, COL.crackHot, ck * crackK * 0.85);
          }
          if (kl > 0) {
            const hg = clamp((e - F.sea) / (F.top - F.sea));
            setC(lc, COL.grass);
            towards(lc, COL.forest, sstep(0.45, 0.65, d) * 0.8);
            if (hg > 0.35) towards(lc, COL.olive, sstep(0.35, 0.6, hg));
            if (hg > 0.6) towards(lc, COL.brown, sstep(0.6, 0.82, hg));
            if (hg > 0.85) towards(lc, COL.rock, sstep(0.85, 1, hg));
            towards(lc, COL.sand, sstep(0.36, 0.26, d) * 0.6 * (1 - la));
            if (qh > 0) {
              setC(hc, COL.hotA);
              towards(hc, COL.hotB, sstep(0.35, 0.72, d));
              towards(lc, hc, qh * 0.92);
              towards(lc, COL.crackHot, ck * crackK);
            }
            if (kl >= 1) setC(c, lc);
            else towards(c, lc, kl);
          }
        }
        if (kw > 0) {
          setC(wc, COL.shallow);
          towards(wc, COL.deep, Math.pow(clamp((S - e) / F.depth), 0.7));
          const cd = S - e;
          if (cd < 0.016) towards(wc, COL.coast, clamp(1 - cd / 0.016));
          if (kw >= 1) setC(c, wc);
          else towards(c, wc, kw);
        }
        let w = kw;
        const gr = 0.9 + 0.2 * d;
        c[0] *= gr; c[1] *= gr; c[2] *= gr;
        /* la glace avance depuis les pôles */
        const m = sstep(iceLine - 0.03, iceLine + 0.05, la + (d - 0.5) * 0.32);
        if (m > 0) {
          if (w > 0) { setC(ic, COL.seaIce); towards(ic, COL.iceCrack, ck * 0.6); }
          else { setC(ic, COL.snow); towards(ic, COL.snowShade, sstep(0.45, 0.8, d)); }
          towards(c, ic, m);
          w *= 1 - m;
        }
        if (qc > 0) towards(c, COL.frost, qc * 0.14);
        const j = i * 3;
        surf[j] = c[0]; surf[j + 1] = c[1]; surf[j + 2] = c[2];
        wet[i] = w;
      }
    }

    /* ---- globe : vraie projection sphérique, éclairée par le Soleil (à gauche) ---- */
    const LIGHT = (() => {
      const v = [-0.8, -0.3, 0.52];
      const l = Math.hypot(v[0], v[1], v[2]);
      return v.map((x) => x / l);
    })();
    const HALF = (() => {
      const v = [LIGHT[0], LIGHT[1], LIGHT[2] + 1];
      const l = Math.hypot(v[0], v[1], v[2]);
      return v.map((x) => x / l);
    })();
    function makeSphere(rc, tw, th, dpr = cv.dpr) {
      const S = Math.max(4, Math.ceil((rc + 1.5) * 2 * dpr));
      const c = document.createElement('canvas');
      c.width = S;
      c.height = S;
      const g = c.getContext('2d');
      const img = g.createImageData(S, S);
      const R = rc * dpr, C = S / 2;
      const M = S * S;
      const pix = new Int32Array(M), lon = new Int16Array(M), row = new Int32Array(M);
      const lonF = new Float32Array(M), r0 = new Int32Array(M), r1 = new Int32Array(M), fy = new Float32Array(M);
      const shade = new Float32Array(M), spec = new Float32Array(M), rim = new Float32Array(M), cover = new Float32Array(M);
      const L0 = LIGHT[0], L1 = LIGHT[1], L2 = LIGHT[2], H0 = HALF[0], H1 = HALF[1], H2 = HALF[2];
      let n = 0;
      for (let y = 0; y < S; y++) {
        const dy = (y + 0.5 - C) / R;
        for (let x = 0; x < S; x++) {
          const dx = (x + 0.5 - C) / R;
          const dd = Math.sqrt(dx * dx + dy * dy);
          const cov = (1 - dd) * R + 0.5;
          if (cov <= 0) continue;
          const k = dd > 1 ? 1 / dd : 1;
          const nx = dx * k, ny = dy * k;
          const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
          const la = Math.asin(ny < -1 ? 1 : ny > 1 ? -1 : -ny);
          const ty = Math.min(th - 1, Math.max(0, Math.floor((0.5 - la / Math.PI) * th)));
          const txF = (Math.atan2(nx, nz) / TAU + 0.25) * tw;
          const tx = Math.floor(txF);
          const tyF = Math.min(th - 1, Math.max(0, (0.5 - la / Math.PI) * th - 0.5));
          const ty0 = Math.floor(tyF);
          lonF[n] = (((txF - 0.5) % tw) + tw) % tw;
          r0[n] = ty0 * tw;
          r1[n] = Math.min(th - 1, ty0 + 1) * tw;
          fy[n] = tyF - ty0;
          const ndl = nx * L0 + ny * L1 + nz * L2;
          const day = sstep(-0.14, 0.72, ndl);
          const ndh = Math.max(0, nx * H0 + ny * H1 + nz * H2);
          const ndh2 = ndh * ndh, ndh4 = ndh2 * ndh2, ndh8 = ndh4 * ndh4, ndh16 = ndh8 * ndh8;
          pix[n] = y * S + x;
          lon[n] = ((tx % tw) + tw) % tw;
          row[n] = ty * tw;
          shade[n] = 0.075 + 0.98 * Math.pow(day, 0.85);
          spec[n] = ndh16 * ndh16 * ndh2 * 0.85;
          const e = 1 - nz;
          rim[n] = e * e * Math.sqrt(e) * (0.2 + 0.8 * day);
          cover[n] = cov > 1 ? 1 : cov;
          n++;
        }
      }
      return {
        c, g, img, S, rc, tw, dpr,
        pix: pix.subarray(0, n), lon: lon.subarray(0, n), row: row.subarray(0, n),
        lonF: lonF.subarray(0, n), r0: r0.subarray(0, n), r1: r1.subarray(0, n), fy: fy.subarray(0, n),
        shade: shade.subarray(0, n), spec: spec.subarray(0, n), rim: rim.subarray(0, n), cover: cover.subarray(0, n),
      };
    }
    function paintSphere(sp, tex, wetMap, clouds, rot, rotC, cloudAmt, cloudCol, rimCol, rimAmt) {
      if (sp.smooth) {
        paintSmooth(sp, tex, wetMap, clouds, rot, rotC, cloudAmt, cloudCol, rimCol, rimAmt);
        return;
      }
      const d = sp.img.data;
      const n = sp.pix.length;
      const tw = sp.tw;
      const ro = ((Math.floor(rot) % tw) + tw) % tw, rc = ((Math.floor(rotC) % tw) + tw) % tw;
      for (let k = 0; k < n; k++) {
        const lo = sp.lon[k], rw = sp.row[k];
        const ti = rw + (lo + ro) % tw;
        const j3 = ti * 3;
        let r = tex[j3], g = tex[j3 + 1], b = tex[j3 + 2];
        const ca = clouds[rw + (lo + rc) % tw] * cloudAmt;
        r += (cloudCol[0] - r) * ca;
        g += (cloudCol[1] - g) * ca;
        b += (cloudCol[2] - b) * ca;
        const s = sp.shade[k];
        const spc = sp.spec[k] * wetMap[ti] * (1 - ca) * 255;
        const rm = sp.rim[k] * rimAmt;
        const o = sp.pix[k] * 4;
        d[o] = r * s + spc + rimCol[0] * rm;
        d[o + 1] = g * s + spc + rimCol[1] * rm;
        d[o + 2] = b * s + spc + rimCol[2] * rm;
        d[o + 3] = sp.cover[k] * 255;
      }
      sp.g.putImageData(sp.img, 0, 0);
    }
    /* Même chose, avec un filtrage bilinéaire : pour le grand globe de la loupe. */
    function paintSmooth(sp, tex, wetMap, clouds, rot, rotC, cloudAmt, cloudCol, rimCol, rimAmt) {
      const d = sp.img.data;
      const n = sp.pix.length;
      const tw = sp.tw;
      const ro = ((rot % tw) + tw) % tw, rc = ((rotC % tw) + tw) % tw;
      const lonF = sp.lonF, R0 = sp.r0, R1 = sp.r1, FY = sp.fy;
      for (let k = 0; k < n; k++) {
        const fy = FY[k], gy = 1 - fy;
        const a0 = R0[k], a1 = R1[k];
        let lx = lonF[k] + ro;
        let x0 = lx | 0;
        let fx = lx - x0;
        x0 %= tw;
        let x1 = x0 + 1 === tw ? 0 : x0 + 1;
        let w00 = (1 - fx) * gy, w01 = fx * gy, w10 = (1 - fx) * fy, w11 = fx * fy;
        let i00 = a0 + x0, i01 = a0 + x1, i10 = a1 + x0, i11 = a1 + x1;
        let r = tex[i00 * 3] * w00 + tex[i01 * 3] * w01 + tex[i10 * 3] * w10 + tex[i11 * 3] * w11;
        let g = tex[i00 * 3 + 1] * w00 + tex[i01 * 3 + 1] * w01 + tex[i10 * 3 + 1] * w10 + tex[i11 * 3 + 1] * w11;
        let b = tex[i00 * 3 + 2] * w00 + tex[i01 * 3 + 2] * w01 + tex[i10 * 3 + 2] * w10 + tex[i11 * 3 + 2] * w11;
        const wt = wetMap[i00] * w00 + wetMap[i01] * w01 + wetMap[i10] * w10 + wetMap[i11] * w11;
        lx = lonF[k] + rc;
        x0 = lx | 0;
        fx = lx - x0;
        x0 %= tw;
        x1 = x0 + 1 === tw ? 0 : x0 + 1;
        w00 = (1 - fx) * gy; w01 = fx * gy; w10 = (1 - fx) * fy; w11 = fx * fy;
        const ca = (clouds[a0 + x0] * w00 + clouds[a0 + x1] * w01 + clouds[a1 + x0] * w10 + clouds[a1 + x1] * w11) * cloudAmt;
        r += (cloudCol[0] - r) * ca;
        g += (cloudCol[1] - g) * ca;
        b += (cloudCol[2] - b) * ca;
        const s = sp.shade[k];
        const spc = sp.spec[k] * wt * (1 - ca) * 255;
        const rm = sp.rim[k] * rimAmt;
        const o = sp.pix[k] * 4;
        d[o] = r * s + spc + rimCol[0] * rm;
        d[o + 1] = g * s + spc + rimCol[1] * rm;
        d[o + 2] = b * s + spc + rimCol[2] * rm;
        d[o + 3] = sp.cover[k] * 255;
      }
      sp.g.putImageData(sp.img, 0, 0);
    }

    /* ---- état ---- */
    const G = { w: 1, h: 1, y: 0, sx: 0, Rs: 1, x0: 0, x1: 1, r: 10, u0: 0.8, ri: 1, ro: 2, Rb: 40, by: 60, bxMin: 0, bxMax: 1 };
    const P = { u: 0.8, tu: 0.8 };
    let sphere = null, bigSp = null, venusSp = null, marsSp = null;
    let bg = null, sunA = null, sunB = null, puff = null, zones = null, ringGlow = null;
    let lvapor = [];
    let time = 0;
    let frames = 0;
    let sunFade = 0;
    let moved = false;
    let reveal = 0;
    let zone = 'froid';
    let hold = 0;
    let holdShown = 0;
    let finished = false;
    let finishT = 0;
    let shownProgress = -1;
    let drag = null;
    let hot = 0, cold = 1;
    let vapor = [];
    let glints = [];
    let waves = [];
    let rings = [];
    let twinkles = [];
    let vaporAcc = 0, glintAcc = 0;

    const xOf = (u) => lerp(G.x0, G.x1, u);
    const uOf = (x) => clamp(invLerp(G.x0, G.x1, x));
    const zoneOf = (u) => (u < ZONE_IN ? 'chaud' : u > ZONE_OUT ? 'froid' : 'bien');

    /* ---- fonds pré-rendus ---- */
    function mk(wc, hc) {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(wc * cv.dpr));
      c.height = Math.max(1, Math.round(hc * cv.dpr));
      const g = c.getContext('2d');
      g.scale(cv.dpr, cv.dpr);
      return { c, g, w: wc, h: hc };
    }

    function makeBg() {
      const { w, h, sx, y: sy, Rs } = G;
      const B = mk(w, h);
      const g = B.g;
      g.fillStyle = '#08111D';
      g.fillRect(0, 0, w, h);
      const M = Math.max(w, h);
      draw.glow(g, w * 0.86, h * 0.14, M * 0.6, '#1B3B60', 0.5);
      draw.glow(g, w * 0.66, h * 1.02, M * 0.55, '#2D2A5C', 0.38);
      draw.glow(g, w * 1.04, h * 0.62, M * 0.38, '#123B4C', 0.35);
      /* étoiles (pas sur le Soleil) */
      const r = seeded(19);
      for (let i = 0; i < 150; i++) {
        const x = r() * w, y = r() * h;
        if (Math.hypot(x - sx, y - sy) < Rs * 1.3) continue;
        const s = 0.5 + r() * 1.1;
        const tint = r();
        g.fillStyle = tint < 0.15 ? `rgba(255,214,170,${0.25 + r() * 0.5})` : tint < 0.35 ? `rgba(170,205,255,${0.25 + r() * 0.5})` : `rgba(255,255,255,${0.18 + r() * 0.55})`;
        g.fillRect(x, y, s, s);
      }
      /* la lumière du Soleil */
      g.globalCompositeOperation = 'lighter';
      draw.glow(g, sx, sy, Rs * 3.3, '#FF9440', 0.2);
      draw.glow(g, sx, sy, Rs * 2.1, '#FFC857', 0.3);
      draw.glow(g, sx, sy, Rs * 1.4, '#FFE7A8', 0.42);
      g.globalCompositeOperation = 'source-over';
      return B;
    }

    /* Le Soleil : disque granuleux, plus clair au centre, plus orangé sur le bord. */
    function makeSun(seed) {
      const Rs = G.Rs;
      const D = Rs * 2 + 4;
      const T = Math.max(24, Math.round(D * (cv.dpr > 1.4 ? 0.8 : 0.7)));
      const c = document.createElement('canvas');
      c.width = T;
      c.height = T;
      const g = c.getContext('2d');
      const img = g.createImageData(T, T);
      const n = lib.makeNoise(seed);
      const C = T / 2, R = (Rs / D) * T, px = D / T;
      const A = [255, 249, 228], B = [255, 222, 128], E = [255, 160, 58], Fe = [222, 96, 32];
      const c3 = [0, 0, 0];
      const x0 = Math.max(0, Math.floor(C + (G.sx < 0 ? -G.sx * 0.5 : -R) * (T / D)) - 2);
      for (let y = 0; y < T; y++) {
        for (let x = x0; x < T; x++) {
          const dx = x + 0.5 - C, dy = y + 0.5 - C;
          const dd = Math.sqrt(dx * dx + dy * dy) / R;
          if (dd > 1.03) continue;
          const mu = Math.sqrt(Math.max(0, 1 - dd * dd));
          if (mu > 0.7) { setC(c3, B); towards(c3, A, (mu - 0.7) / 0.3); }
          else if (mu > 0.3) { setC(c3, E); towards(c3, B, (mu - 0.3) / 0.4); }
          else { setC(c3, Fe); towards(c3, E, mu / 0.3); }
          const v = n.fbm((x * px) / 4.2, (y * px) / 4.2, 3);
          const gr = 1 + (v - 0.5) * 0.42 * (0.4 + 0.6 * mu);
          const j = (y * T + x) * 4;
          img.data[j] = c3[0] * gr;
          img.data[j + 1] = c3[1] * gr;
          img.data[j + 2] = c3[2] * gr;
          img.data[j + 3] = clamp((1 - dd) * R + 0.5) * 255;
        }
      }
      g.putImageData(img, 0, 0);
      return { c, D };
    }

    function makePuff() {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d');
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,0.9)');
      gr.addColorStop(0.45, 'rgba(255,255,255,0.45)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 64);
      return c;
    }

    /* La zone habitable : un anneau autour du Soleil. Dedans, un voile chaud ; dehors, un voile froid. */
    function makeZones() {
      const { w, h, sx, y: sy, ri, ro, Rs } = G;
      const Z = mk(w, h);
      const g = Z.g;
      const far = Math.hypot(Math.max(Math.abs(w - sx), Math.abs(sx)), Math.max(sy, h - sy)) + 2;
      const f = (r) => clamp(r / far);
      const gr = g.createRadialGradient(sx, sy, 0, sx, sy, far);
      gr.addColorStop(0, rgba('#FF9A4D', 0.16));
      gr.addColorStop(f(Rs * 1.02), rgba('#FF9A4D', 0.16));
      gr.addColorStop(f(ri - 1), rgba('#FF9A4D', 0.07));
      gr.addColorStop(f(ri + 1), rgba('#8BD86A', 0.2));
      gr.addColorStop(f((ri + ro) / 2), rgba('#8BD86A', 0.13));
      gr.addColorStop(f(ro - 1), rgba('#8BD86A', 0.2));
      gr.addColorStop(f(ro + 1), rgba('#9FD8FF', 0.07));
      gr.addColorStop(1, rgba('#9FD8FF', 0.025));
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
      g.strokeStyle = rgba('#A6E88A', 0.55);
      g.lineWidth = 1.4;
      g.setLineDash([5, 5]);
      for (const r of [ri, ro]) {
        g.beginPath();
        g.arc(sx, sy, r, -Math.PI / 2, Math.PI / 2);
        g.stroke();
      }
      g.setLineDash([]);
      /* l'anneau seul, pour le faire briller quand la planète y est */
      const Rg = mk(w, h);
      Rg.g.beginPath();
      Rg.g.arc(sx, sy, ro, -Math.PI / 2, Math.PI / 2);
      Rg.g.arc(sx, sy, ri, Math.PI / 2, -Math.PI / 2, true);
      Rg.g.closePath();
      Rg.g.fillStyle = rgba('#8BD86A', 0.16);
      Rg.g.fill();
      zones = Z;
      ringGlow = Rg;
    }

    function placeLabels() {
      const gv = venusSp ? venusSp.rc : G.r * 0.8;
      const gm = marsSp ? marsSp.rc : G.r * 0.56;
      lbVenus.style.left = xOf(VENUS_U).toFixed(1) + 'px';
      lbVenus.style.top = (G.y - gv - 8).toFixed(1) + 'px';
      lbMars.style.left = xOf(MARS_U).toFixed(1) + 'px';
      lbMars.style.top = (G.y - gm - 8).toFixed(1) + 'px';
      /* l'étiquette de la zone se pose sur l'anneau, en bas de la scène */
      const rm = (G.ri + G.ro) / 2;
      const th = Math.asin(clamp((G.h * 0.86 - G.y) / rm, 0, Math.sin(1.2)));
      lbZone.style.left = clamp(G.sx + Math.cos(th) * rm, 72, G.w - 72).toFixed(1) + 'px';
      lbZone.style.top = (G.y + Math.sin(th) * rm).toFixed(1) + 'px';
    }

    function geometry(w, h) {
      G.w = w;
      G.h = h;
      G.y = Math.round(h * RAIL_Y);
      G.Rs = Math.min(w * 0.27, h * 0.4);
      G.sx = -G.Rs * 0.08;
      G.r = clamp(Math.min(w, h * 1.2) * 0.05, 15, 30);
      G.x0 = G.sx + G.Rs + Math.max(14, w * 0.035) + G.r * 0.4;
      G.x1 = w - G.r - Math.max(10, w * 0.02);
      G.ri = xOf(ZONE_IN) - G.sx;
      G.ro = xOf(ZONE_OUT) - G.sx;
      /* la loupe flotte au-dessus de la planète : le doigt ne la cache pas */
      G.Rb = clamp(Math.min(w, h) * 0.135, 38, 78);
      G.by = Math.max(G.Rb + 10, h * 0.19);
      const dy = G.y - G.by;
      G.bxMin = Math.max(G.Rb + 8, G.sx + Math.sqrt(Math.max(0, Math.pow(G.Rs + G.Rb + 10, 2) - dy * dy)));
      G.bxMax = w - G.Rb - 8;
      G.u0 = uOf(w * START_X);
      if (!moved) P.u = P.tu = G.u0;
      bg = makeBg();
      makeZones();
      sunA = makeSun(3);
      sunB = null;
      sunFade = 0;
      sphere = makeSphere(G.r, F.tw, F.th);
      bigSp = makeSphere(G.Rb - 5, F.tw, F.th, fine ? 1 : cv.dpr);
      bigSp.smooth = true;
      venusSp = makeSphere(G.r * 0.8, GW, GH);
      marsSp = makeSphere(G.r * 0.56, GW, GH);
      paintSphere(venusSp, venusTex, NOWET, NOCLOUD, 14, 0, 0, RIM.chaud, rgb('#FFE2A0'), 0.7);
      paintSphere(marsSp, marsTex, NOWET, NOCLOUD, 40, 0, 0, RIM.froid, rgb('#FFC2A0'), 0.5);
      twinkles = [];
      const r = seeded(31);
      for (let i = 0; i < 22; i++) {
        const x = r() * w, y = r() * h;
        if (Math.hypot(x - G.sx, y - G.y) < G.Rs * 1.5 || Math.abs(y - G.y) < G.r * 2) continue;
        twinkles.push({ x, y, s: 0.8 + r() * 1.3, f: 0.6 + r() * 1.6, ph: r() * TAU });
      }
      placeLabels();
    }

    /* ---- interaction ---- */
    function markMoved() {
      if (moved) return;
      moved = true;
      if (!finished) {
        api.progress(0.3);
        shownProgress = 0.3;
        api.hint(TEXTES.consigneZone);
      }
      lbVenus.classList.add('is-on');
      setTimeout(() => { if (moved) lbMars.classList.add('is-on'); }, 220);
      setTimeout(() => { if (moved) lbZone.classList.add('is-on'); }, 420);
    }

    function setTarget(u, user) {
      P.tu = clamp(u);
      if (user && Math.abs(P.tu - G.u0) > 0.01) markMoved();
      stage.setAttribute('aria-valuenow', String(Math.round(P.tu * 100)));
    }

    api.track(cv.canvas, {
      down(p) {
        const px = xOf(P.u);
        const near = Math.abs(p.x - px) < Math.max(G.r * 1.9, 30) && Math.abs(p.y - G.y) < Math.max(G.r * 2.2, 36);
        drag = { near, off: near ? px - p.x : 0, live: false };
        api.sfx.play('tick', { pitch: 1.1, gap: 60 });
      },
      move(p) {
        if (!drag) return;
        if (!drag.live) {
          const dx = p.x - p.x0, dy = p.y - p.y0;
          if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(dy) * 0.8) return;
          drag.live = true;
          api.buzz(8);
        }
        setTarget(uOf(p.x + drag.off), true);
      },
      up(p, e, cancelled) {
        const d = drag;
        drag = null;
        if (cancelled || !d) return;
        if (p.tap) {
          waves.push({ x: p.x, y: p.y, t: 0, dur: 0.6 });
          if (!d.near) {
            setTarget(uOf(p.x), true);
            api.sfx.play('whoosh', { volume: 0.35, pitch: 1.3 });
            api.buzz(8);
          }
        }
      },
    }, { touchAction: 'pan-y' });

    stage.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      api.gesture(null);
      setTarget(P.tu + (e.key === 'ArrowLeft' ? -0.05 : 0.05), true);
    });

    /* ---- progression ---- */
    function setProgress(v) {
      if (v === shownProgress) return;
      shownProgress = v;
      api.progress(v);
    }

    function win() {
      finished = true;
      finishT = 0;
      for (let i = 0; i < 3; i++) rings.push({ t: -i * 0.22, dur: 1.3 });
      api.done(TEXTES.fin, TEXTES.finStatut);
    }

    function init() {
      moved = false;
      reveal = 0;
      hold = 0;
      holdShown = 0;
      finished = false;
      finishT = 0;
      drag = null;
      vapor = [];
      lvapor = [];
      glints = [];
      waves = [];
      rings = [];
      shownProgress = -1;
      P.u = P.tu = G.u0;
      zone = zoneOf(P.u);
      lbVenus.classList.remove('is-on');
      lbMars.classList.remove('is-on');
      lbZone.classList.remove('is-on');
      stage.setAttribute('aria-valuenow', String(Math.round(P.u * 100)));
      stage.setAttribute('aria-valuetext', lib.fr(TEXTES[zone]));
      api.status(TEXTES[zone]);
      setProgress(0);
      api.gesture('drag', { x: START_X * 100, y: RAIL_Y * 100, dx: -100, dy: 0 });
    }

    /* ---- animation ---- */
    function climate(u) {
      hot = Math.pow(clamp((ZONE_IN + 0.004 - u) / 0.24), 0.8);
      cold = Math.pow(clamp((u - ZONE_OUT + 0.004) / 0.2), 0.8);
    }

    function update(dt) {
      time += dt;
      /* travaux de fond, étalés : la carte fine de la planète, puis le second Soleil */
      frames++;
      if (frames < 3) {
        /* on laisse d'abord la page s'afficher */
      } else if (fine) {
        if (fine.step(5)) {
          F = fine;
          fine = null;
          surf = new Uint8ClampedArray(F.tw * F.th * 3);
          wet = new Float32Array(F.tw * F.th);
          paintedH = -1;
          if (sphere) {
            sphere = makeSphere(G.r, F.tw, F.th);
            bigSp = makeSphere(G.Rb - 5, F.tw, F.th);
            bigSp.smooth = true;
          }
        }
      } else if (!sunB && sunA) {
        sunB = makeSun(8);
      }
      const k = 1 - Math.exp(-dt * (drag && drag.live ? 22 : 8));
      P.u += (P.tu - P.u) * k;
      if (Math.abs(P.tu - P.u) < 1e-4) P.u = P.tu;
      climate(P.u);
      if (moved && reveal < 1) reveal = Math.min(1, reveal + dt / 0.9);

      const z = zoneOf(P.u);
      if (z !== zone) {
        zone = z;
        stage.setAttribute('aria-valuetext', lib.fr(TEXTES[z]));
        if (!finished) api.status(TEXTES[z]);
        if (z === 'bien') { api.sfx.play('chime', { volume: 0.6, gap: 300 }); api.buzz(10); }
        else if (z === 'chaud') api.sfx.play('whoosh', { volume: 0.5, pitch: 0.8, gap: 300 });
        else api.sfx.play('crack', { volume: 0.6, gap: 300 });
      }
      if (!finished) {
        if (z === 'bien' && moved) {
          hold += dt;
          setProgress(0.6);
          if (hold >= HOLD) win();
        } else {
          hold = 0;
          if (moved) setProgress(0.3);
        }
      } else {
        finishT += dt;
      }
      holdShown += ((finished ? 0 : hold / HOLD) - holdShown) * Math.min(1, dt * 14);

      /* la vapeur s'échappe de la planète trop chaude, poussée loin du Soleil */
      const x = xOf(P.u), y = G.y, r = G.r;
      if (hot > 0.04) {
        vaporAcc += dt * hot * 16 * (api.reducedMotion ? 0.4 : 1);
        while (vaporAcc > 1 && vapor.length < 80) {
          vaporAcc -= 1;
          const a = rand(-1.9, 1.9);
          vapor.push({
            x: x + Math.cos(a) * r * 0.95, y: y + Math.sin(a) * r * 0.95,
            vx: Math.cos(a) * rand(6, 14) + rand(10, 22), vy: Math.sin(a) * rand(6, 14) - rand(2, 8),
            s: rand(2.5, 4.5), g: rand(5, 9), t: 0, dur: rand(1.4, 2.4), a: rand(0.22, 0.42) * (0.5 + hot * 0.5),
          });
        }
      } else vaporAcc = 0;
      for (let i = vapor.length - 1; i >= 0; i--) {
        const v = vapor[i];
        v.t += dt;
        if (v.t >= v.dur) { vapor.splice(i, 1); continue; }
        v.x += v.vx * dt;
        v.y += v.vy * dt;
        v.vx *= Math.pow(0.7, dt);
        v.s += v.g * dt;
      }
      /* dans la loupe, la vapeur monte de la surface, en coordonnées relatives au globe */
      if (hot > 0.04) {
        const rate = dt * hot * 30 * (api.reducedMotion ? 0.4 : 1);
        let tries = Math.floor(rate) + (Math.random() < rate % 1 ? 1 : 0);
        while (tries-- > 0 && lvapor.length < 46) {
          const a = rand(-2.7, 1.4);
          lvapor.push({ a, d: rand(0.7, 0.98), vx: rand(0.15, 0.35), vy: rand(-0.25, -0.08), s: rand(0.12, 0.2), t: 0, dur: rand(1.3, 2.2), al: rand(0.35, 0.6) });
        }
      }
      for (let i = lvapor.length - 1; i >= 0; i--) {
        const v = lvapor[i];
        v.t += dt;
        if (v.t >= v.dur) lvapor.splice(i, 1);
      }
      /* éclats de givre sur la planète gelée */
      if (cold > 0.3 && !api.reducedMotion) {
        glintAcc += dt * cold * 3.2;
        while (glintAcc > 1 && glints.length < 8) {
          glintAcc -= 1;
          const a = rand(TAU), d = Math.sqrt(Math.random()) * 0.8;
          const gx = Math.cos(a) * d, gy = Math.sin(a) * d;
          if (gx * LIGHT[0] + gy * LIGHT[1] < -0.25) continue;
          glints.push({ dx: gx, dy: gy, t: 0, dur: rand(0.45, 0.8), s: rand(2.5, 4.5) });
        }
      }
      age(glints, dt);
      age(waves, dt);
      age(rings, dt);
    }

    function drawSun() {
      const { sx, y: sy, Rs } = G;
      const breathe = Math.sin(time * 0.8 * AMB);
      ctx.globalCompositeOperation = 'lighter';
      draw.glow(ctx, sx, sy, Rs * (1.62 + 0.03 * breathe), '#FFB347', 0.2 + 0.04 * breathe);
      /* couronne : quelques lueurs qui respirent sur le bord */
      for (let i = 0; i < 3; i++) {
        const a = -0.85 + i * 0.85;
        const k = 0.5 + 0.5 * Math.sin(time * (0.5 + i * 0.17) * AMB + i * 2.3);
        draw.glow(ctx, sx + Math.cos(a) * Rs, sy + Math.sin(a) * Rs, Rs * (0.22 + 0.06 * k), '#FF9A45', 0.12 + 0.1 * k);
      }
      ctx.globalCompositeOperation = 'source-over';
      const D = sunA.D;
      ctx.drawImage(sunA.c, sx - D / 2, sy - D / 2, D, D);
      if (sunB) {
        ctx.globalAlpha = (0.5 + 0.5 * Math.sin(time * 0.45 * AMB)) * Math.min(1, sunFade);
        ctx.drawImage(sunB.c, sx - D / 2, sy - D / 2, D, D);
        ctx.globalAlpha = 1;
        sunFade += 0.02;
      }
    }

    function drawTwinkles() {
      if (api.reducedMotion) return;
      ctx.fillStyle = '#FFFFFF';
      for (const s of twinkles) {
        const a = 0.15 + 0.6 * (0.5 + 0.5 * Math.sin(time * s.f + s.ph));
        ctx.globalAlpha = a;
        ctx.fillRect(s.x - s.s / 2, s.y - s.s / 2, s.s, s.s);
        if (s.s > 1.7 && a > 0.55) {
          ctx.globalAlpha = (a - 0.55) * 0.8;
          ctx.fillRect(s.x - s.s * 2, s.y - 0.4, s.s * 4, 0.8);
          ctx.fillRect(s.x - 0.4, s.y - s.s * 2, 0.8, s.s * 4);
        }
      }
      ctx.globalAlpha = 1;
    }

    /* L'anneau de la zone habitable se déploie depuis le rail, vers le haut et vers le bas. */
    function drawZone() {
      if (reveal <= 0) return;
      const k = ease.outCubic(reveal);
      const { w, h } = G;
      ctx.save();
      if (k < 1) {
        const A = (Math.PI / 2) * k;
        ctx.beginPath();
        ctx.moveTo(G.sx, G.y);
        ctx.arc(G.sx, G.y, Math.hypot(w, h) * 1.5, -A, A);
        ctx.closePath();
        ctx.clip();
      }
      ctx.globalAlpha = Math.min(1, k * 1.4);
      ctx.drawImage(zones.c, 0, 0, w, h);
      const inside = zone === 'bien' || finished;
      if (inside) {
        ctx.globalAlpha = 0.45 + 0.4 * Math.sin(time * 3.2);
        ctx.drawImage(ringGlow.c, 0, 0, w, h);
      }
      ctx.restore();
    }

    /* La loupe : le même globe, en grand, pour voir l'eau s'évaporer ou geler. */
    function drawLoupe() {
      const px = xOf(P.u), py = G.y, r = G.r;
      const R = G.Rb, by = G.by;
      const bx = clamp(px, G.bxMin, G.bxMax);
      /* cône de zoom, de la planète vers la loupe */
      const ang = Math.atan2(by - py, bx - px);
      const n1 = ang + Math.PI / 2, n2 = ang - Math.PI / 2;
      const gr = ctx.createLinearGradient(px, py, bx, by);
      gr.addColorStop(0, rgba('#EEF4FB', 0.16));
      gr.addColorStop(1, rgba('#EEF4FB', 0.03));
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.moveTo(px + Math.cos(n1) * r * 1.05, py + Math.sin(n1) * r * 1.05);
      ctx.lineTo(bx + Math.cos(n1) * R, by + Math.sin(n1) * R);
      ctx.lineTo(bx + Math.cos(n2) * R, by + Math.sin(n2) * R);
      ctx.lineTo(px + Math.cos(n2) * r * 1.05, py + Math.sin(n2) * r * 1.05);
      ctx.closePath();
      ctx.fill();
      /* verre */
      ctx.fillStyle = 'rgba(5,11,20,0.9)';
      ctx.beginPath();
      ctx.arc(bx, by, R, 0, TAU);
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      ctx.arc(bx, by, R - 1, 0, TAU);
      ctx.clip();
      const gr2 = ctx.createRadialGradient(bx - R * 0.6, by, 0, bx - R * 0.6, by, R * 1.6);
      gr2.addColorStop(0, rgba('#FFC857', 0.16));
      gr2.addColorStop(1, rgba('#FFC857', 0));
      ctx.fillStyle = gr2;
      ctx.fillRect(bx - R, by - R, R * 2, R * 2);
      const gR = bigSp.rc;
      ctx.globalCompositeOperation = 'lighter';
      draw.glow(ctx, bx, by, gR * 1.35, hot > cold ? '#FF9A55' : cold > 0.05 ? '#CFEAFF' : '#7FC4FF', 0.22);
      ctx.globalCompositeOperation = 'source-over';
      const s = bigSp.S / bigSp.dpr;
      ctx.drawImage(bigSp.c, bx - s / 2, by - s / 2, s, s);
      /* vapeur qui s'échappe */
      for (const v of lvapor) {
        const q = v.t / v.dur;
        const d = v.d + q * 0.65;
        const x = bx + (Math.cos(v.a) * d + v.vx * q * 2) * gR;
        const y = by + (Math.sin(v.a) * d + v.vy * q * 2) * gR;
        const sz = (v.s + q * 0.22) * gR;
        ctx.globalAlpha = v.al * Math.sin(Math.PI * Math.min(1, q * 1.3 + 0.05));
        ctx.drawImage(puff, x - sz, y - sz, sz * 2, sz * 2);
      }
      ctx.globalAlpha = 1;
      /* éclats de givre */
      if (glints.length) {
        ctx.globalCompositeOperation = 'lighter';
        for (const g of glints) {
          const a = Math.sin(Math.PI * (g.t / g.dur));
          const gx = bx + g.dx * gR, gy = by + g.dy * gR;
          const L = g.s * 1.8 * (0.6 + 0.4 * a);
          ctx.fillStyle = rgba('#FFFFFF', 0.9 * a);
          ctx.fillRect(gx - L, gy - 0.6, L * 2, 1.2);
          ctx.fillRect(gx - 0.6, gy - L, 1.2, L * 2);
          draw.glow(ctx, gx, gy, L * 1.1, '#DDF2FF', 0.55 * a);
        }
        ctx.globalCompositeOperation = 'source-over';
      }
      /* reflet sur le verre */
      ctx.strokeStyle = 'rgba(255,255,255,0.13)';
      ctx.lineWidth = R * 0.08;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(bx, by, R * 0.86, -2.55, -1.75);
      ctx.stroke();
      ctx.lineCap = 'butt';
      ctx.restore();
      /* monture */
      const ring = zone === 'bien' ? '#B6F09A' : zone === 'chaud' ? '#FFB27A' : '#BFE3FF';
      ctx.strokeStyle = rgba(ring, 0.75);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(bx, by, R, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(bx, by, R + 3.5, 0, TAU);
      ctx.stroke();
    }

    function drawRail() {
      const y = G.y;
      const start = G.sx + G.Rs + 8;
      const k = reveal;
      for (let x = start; x <= G.w - 3; x += 7) {
        const u = (x - G.x0) / (G.x1 - G.x0);
        if (k < 1) {
          ctx.globalAlpha = 0.34 * (1 - k);
          ctx.fillStyle = '#EEF4FB';
          ctx.fillRect(x - 1.1, y - 1.1, 2.2, 2.2);
        }
        if (k > 0) {
          ctx.globalAlpha = 0.62 * k;
          ctx.fillStyle = u < ZONE_IN ? '#FFA066' : u > ZONE_OUT ? '#A9DCFF' : '#9BE47A';
          ctx.beginPath();
          ctx.arc(x, y, 1.35, 0, TAU);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }

    function drawGhosts() {
      if (reveal <= 0) return;
      const k = ease.outCubic(reveal);
      const list = [[venusSp, VENUS_U, '#FFD98A'], [marsSp, MARS_U, '#FF9A6A']];
      for (const [sp, u, col] of list) {
        const x = xOf(u), y = G.y;
        ctx.globalCompositeOperation = 'lighter';
        draw.glow(ctx, x, y, sp.rc * 1.8, col, 0.1 * k);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 0.52 * k;
        const s = sp.S / sp.dpr;
        ctx.drawImage(sp.c, x - s / 2, y - s / 2, s, s);
        ctx.globalAlpha = 1;
      }
    }

    function drawVapor() {
      if (!vapor.length) return;
      for (const v of vapor) {
        const q = v.t / v.dur;
        const a = v.a * Math.sin(Math.PI * Math.min(1, q * 1.4 + 0.05)) * (1 - q * 0.4);
        if (a <= 0.01) continue;
        ctx.globalAlpha = a;
        ctx.drawImage(puff, v.x - v.s, v.y - v.s, v.s * 2, v.s * 2);
      }
      ctx.globalAlpha = 1;
    }

    const CLOUD_WHITE = [255, 255, 255];
    const CLOUD_STEAM = [246, 230, 210];
    const cloudCol = [255, 255, 255];
    const rimCol = [0, 0, 0];

    function drawPlanet() {
      const x = xOf(P.u), y = G.y, r = G.r;
      setC(rimCol, RIM.bien);
      towards(rimCol, RIM.chaud, hot);
      towards(rimCol, RIM.froid, cold);
      setC(cloudCol, CLOUD_WHITE);
      towards(cloudCol, CLOUD_STEAM, hot);
      const glowHex = hot > cold ? '#FF9A55' : cold > 0.05 ? '#CFEAFF' : '#7FC4FF';
      ctx.globalCompositeOperation = 'lighter';
      draw.glow(ctx, x, y, r * 2, glowHex, 0.16 + 0.1 * Math.max(hot, cold));
      if (finished) {
        const pulse = 0.5 + 0.5 * Math.sin(finishT * 3);
        draw.glow(ctx, x, y, r * (2.3 + pulse * 0.4), '#8BD86A', 0.18 * Math.min(1, finishT * 2));
      }
      ctx.globalCompositeOperation = 'source-over';
      paintSurface(hot, cold);
      const rot = ((time * AMB) / 46 + 0.15) * F.tw;
      const rotC = ((time * AMB) / 33 + 0.35) * F.tw;
      const cloudAmt = 0.82 * (1 - 0.72 * hot) * (1 - 0.6 * cold);
      paintSphere(sphere, surf, wet, F.cloud, rot, rotC, cloudAmt, cloudCol, rimCol, 0.95);
      paintSphere(bigSp, surf, wet, F.cloud, rot, rotC, cloudAmt, cloudCol, rimCol, 0.8);
      const s = sphere.S / sphere.dpr;
      ctx.drawImage(sphere.c, x - s / 2, y - s / 2, s, s);

      /* éclats de givre */
      if (glints.length) {
        ctx.globalCompositeOperation = 'lighter';
        for (const g of glints) {
          const q = g.t / g.dur;
          const a = Math.sin(Math.PI * q);
          const gx = x + g.dx * r, gy = y + g.dy * r;
          const L = g.s * (0.6 + 0.4 * a);
          ctx.fillStyle = rgba('#FFFFFF', 0.85 * a);
          ctx.fillRect(gx - L, gy - 0.5, L * 2, 1);
          ctx.fillRect(gx - 0.5, gy - L, 1, L * 2);
          draw.glow(ctx, gx, gy, L * 1.2, '#DDF2FF', 0.5 * a);
        }
        ctx.globalCompositeOperation = 'source-over';
      }

      /* anneau de patience : il se remplit pendant que la planète reste dans la zone */
      if (holdShown > 0.01) {
        const R = r + 7;
        ctx.lineCap = 'round';
        ctx.strokeStyle = rgba('#8BD86A', 0.22);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, R, 0, TAU);
        ctx.stroke();
        ctx.strokeStyle = rgba('#B6F09A', 0.95);
        ctx.beginPath();
        ctx.arc(x, y, R, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(holdShown));
        ctx.stroke();
        ctx.lineCap = 'butt';
      }
      for (const rg of rings) {
        if (rg.t < 0) continue;
        const q = rg.t / rg.dur;
        ctx.strokeStyle = rgba('#B6F09A', 0.6 * (1 - q) * (1 - q));
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(x, y, r + 6 + ease.outCubic(q) * r * 2.2, 0, TAU);
        ctx.stroke();
      }
    }

    function drawWaves() {
      for (const wv of waves) {
        const q = wv.t / wv.dur;
        ctx.strokeStyle = rgba('#FFF1C9', 0.6 * (1 - q));
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(wv.x, wv.y, lerp(5, 26, ease.outCubic(q)), 0, TAU);
        ctx.stroke();
      }
    }

    function render() {
      if (!bg) return;
      const { w, h } = G;
      ctx.drawImage(bg.c, 0, 0, w, h);
      drawTwinkles();
      drawZone();
      drawSun();
      drawRail();
      drawGhosts();
      drawVapor();
      drawPlanet();
      drawLoupe();
      drawWaves();
    }

    puff = makePuff();
    cv.onResize(geometry);
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
