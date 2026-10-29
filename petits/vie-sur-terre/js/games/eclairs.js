/* L'étincelle de la vie : l'expérience de Miller (1952), dessinée.
   Une tape fait jaillir un éclair entre les deux pointes (électrodes) du grand ballon (le ciel de la
   jeune Terre). L'éclair soude les petites molécules de gaz en « briques de la vie » (des acides
   aminés) : elles descendent par le tube refroidi jusqu'au petit ballon (l'océan), dont l'eau se
   colore peu à peu. Version des petits : six briques suffisent. */
(function () {
  'use strict';
  const { lib } = window.RM;
  const { TAU, rand, clamp, lerp, ease, rgba, draw } = lib;

  const GOAL = 6;
  /* Tous les textes du jeu, faciles à corriger (la consigne de départ est la même que dans index.html) */
  const TEXTES = {
    depart: 'Tape entre les deux pointes pour faire un éclair.',
    premier: 'L’éclair a fabriqué une brique de la vie ! Tape encore.',
    orage: 'Garde le doigt appuyé : un orage d’éclairs !',
    attente: 'Regarde : les briques tombent dans l’eau !',
    compteur: 'Briques de la vie : {n} sur {total}',
    fin: 'Les éclairs ont fabriqué des briques de la vie !',
    finStatut: 'Ce n’est pas encore la vie, juste ses petites pièces.',
    bravo: '{bravo}',
    aToi: '{aToi}',
    gaz: 'Gaz',
    eau: 'Eau',
  };
  const fill = (s, n) => s.replace('{n}', n).replace('{total}', GOAL);

  /* perles des acides aminés : les mêmes couleurs que dans « La recette de la vie » */
  const MOL = ['#7DE8C9', '#FFB25B', '#B9A8FF', '#FF9DB4'];
  /* l'eau de l'océan : claire, puis rose, puis rouge foncé et trouble (comme dans l'expérience) */
  const TINT = [[0, '#CFEAFF'], [0.3, '#F8B4CC'], [0.6, '#E5677F'], [0.85, '#B02A3E'], [1, '#7C1828']];
  const INK = ['#F7A6C2', '#EE7F98', '#C93A50', '#8E1E30'];
  /* les gaz : un gros atome entouré de petits (angle, distance, devant ?), sans aucune étiquette */
  const GAS_TYPES = [
    { core: '#CBC6F6', r: 1, sat: [[0.3, 1.02, 1], [1.95, 0.98, 1], [3.45, 1.02, 0], [4.95, 0.96, 1]] },
    { core: '#A9D6F6', r: 0.98, sat: [[-0.45, 1, 1], [1.65, 1, 1], [3.75, 1, 0]] },
    { core: null, r: 0, sat: [] },
    { core: '#A2E6E4', r: 0.95, sat: [[0.62, 1.02, 1], [2.52, 1.02, 1]] },
  ];
  const GAS_MIX = [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3];

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
  const hexOk = (s, d) => (/^#[0-9a-f]{6}$/i.test(s || '') ? s : d);
  /* halo très doux, presque gaussien */
  function soft(col, size) {
    const c = mk(size, size);
    const g = c.getContext('2d');
    const o = size / 2;
    const gr = g.createRadialGradient(o, o, 0, o, o, o);
    gr.addColorStop(0, rgba(col, 1));
    gr.addColorStop(0.2, rgba(col, 0.6));
    gr.addColorStop(0.45, rgba(col, 0.2));
    gr.addColorStop(0.75, rgba(col, 0.05));
    gr.addColorStop(1, rgba(col, 0));
    g.fillStyle = gr;
    g.fillRect(0, 0, size, size);
    return c;
  }
  /* zigzag d'éclair par déplacement du point milieu : écrit 2^levels + 1 points dans pts
     à partir du point i et renvoie l'indice du dernier */
  function jag(pts, i, x0, y0, x1, y1, levels, rough) {
    const n = 1 << levels;
    pts[i * 2] = x0;
    pts[i * 2 + 1] = y0;
    pts[(i + n) * 2] = x1;
    pts[(i + n) * 2 + 1] = y1;
    for (let step = n; step > 1; step >>= 1) {
      const half = step >> 1;
      for (let k = 0; k < n; k += step) {
        const a = (i + k) * 2, b = (i + k + step) * 2, m = (i + k + half) * 2;
        const ax = pts[a], ay = pts[a + 1], bx = pts[b], by = pts[b + 1];
        const off = (Math.random() * 2 - 1) * rough;
        pts[m] = (ax + bx) / 2 - (by - ay) * off;
        pts[m + 1] = (ay + by) / 2 + (bx - ax) * off;
      }
    }
    return i + n;
  }
  /* polyligne aux coins arrondis, rééchantillonnée à pas constant (la vapeur et les gouttes y glissent) */
  function makePath(pts, radius, step) {
    const dense = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i], [cx, cy] = pts[i + 1];
      const l1 = Math.hypot(bx - ax, by - ay), l2 = Math.hypot(cx - bx, cy - by);
      const r = Math.min(radius, l1 / 2, l2 / 2);
      const p1 = [bx - ((bx - ax) / l1) * r, by - ((by - ay) / l1) * r];
      const p2 = [bx + ((cx - bx) / l2) * r, by + ((cy - by) / l2) * r];
      dense.push(p1);
      for (let k = 1; k < 10; k++) {
        const t = k / 10, u = 1 - t;
        dense.push([u * u * p1[0] + 2 * u * t * bx + t * t * p2[0], u * u * p1[1] + 2 * u * t * by + t * t * p2[1]]);
      }
      dense.push(p2);
    }
    dense.push(pts[pts.length - 1]);
    const cum = [0];
    let L = 0;
    for (let i = 1; i < dense.length; i++) {
      L += Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]);
      cum.push(L);
    }
    const n = Math.max(2, Math.ceil(L / step) + 1);
    const xs = new Float32Array(n), ys = new Float32Array(n), tx = new Float32Array(n), ty = new Float32Array(n);
    let j = 0;
    for (let i = 0; i < n; i++) {
      const s = (i / (n - 1)) * L;
      while (j < dense.length - 2 && cum[j + 1] < s) j++;
      const seg = cum[j + 1] - cum[j] || 1;
      const t = clamp((s - cum[j]) / seg);
      const dx = dense[j + 1][0] - dense[j][0], dy = dense[j + 1][1] - dense[j][1];
      const dl = Math.hypot(dx, dy) || 1;
      xs[i] = dense[j][0] + dx * t;
      ys[i] = dense[j][1] + dy * t;
      tx[i] = dx / dl;
      ty[i] = dy / dl;
    }
    return { xs, ys, tx, ty, n, L, ds: L / (n - 1), dense };
  }
  function pathAt(p, s, out) {
    const f = clamp(s / p.ds, 0, p.n - 1);
    const i = Math.min(p.n - 2, Math.floor(f)), t = f - i;
    out.x = p.xs[i] + (p.xs[i + 1] - p.xs[i]) * t;
    out.y = p.ys[i] + (p.ys[i + 1] - p.ys[i]) * t;
    out.tx = p.tx[i];
    out.ty = p.ty[i];
    return out;
  }

  window.RM.games.eclairs = function (api) {
    /* quatre calques : le décor (fixe), les nuages éclairés (seule leur opacité change),
       l'animation, et le verre par-dessus (fixe). On ne redessine que ce qui bouge. */
    const cvBg = api.canvas();
    const cvLit = api.canvas();
    const cv = api.canvas();
    const cvFront = api.canvas();
    const cvFlare = api.canvas();
    const ctx = cv.ctx;
    const RMo = api.reducedMotion;
    /* les nuages éclairés et le verre illuminé s'ajoutent à la lumière (mode « écran ») :
       à chaque éclair, on ne change que leur opacité */
    [cvLit, cvFlare].forEach((c) => {
      c.canvas.style.mixBlendMode = 'screen';
      c.canvas.style.opacity = '0';
    });
    let litShown = 0, flareShown = 0;
    const nz = lib.makeNoise(83);
    const C = {
      yellow: hexOk(api.css('--accent'), '#FFE45C'),
      blue: hexOk(api.css('--accent-2'), '#7FD8FF'),
    };
    api.style(
      '.game[data-game="eclairs"] .game-canvas { -webkit-touch-callout: none; }' +
      '.game[data-game="eclairs"] .ec-label { position: absolute; z-index: 2; transform: translate(-50%, -50%);' +
      ' padding: 2px 9px 3px; border-radius: 10px 12px 11px 9px; background: rgba(11,14,38,0.55);' +
      ' box-shadow: inset 0 0 0 1px var(--line); color: var(--muted); font: 600 0.8125rem/1.3 var(--font-text);' +
      ' pointer-events: none; white-space: nowrap; }'
    );
    cvFlare.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    /* deux petites étiquettes, comme dans le texte : de l'eau et des gaz */
    const labels = ['gaz', 'eau'].map((k) => {
      const el = document.createElement('span');
      el.className = 'ec-label';
      el.textContent = TEXTES[k];
      el.setAttribute('aria-hidden', 'true');
      api.stage.appendChild(el);
      return el;
    });

    /* ---- réglages, en « unités » : le grand ballon a un rayon de 1 et son centre est en (0, 0) ---- */
    const R2 = 0.5;          /* le petit ballon : l'océan */
    const TUBE = 0.13;       /* diamètre des tubes de verre */
    const SLEEVE = 0.125;    /* manchons de verre des électrodes */
    const XV = -0.64;        /* le long col du petit ballon monte tout droit jusqu'au grand */
    const XC = 1.14;         /* le réfrigérant, à droite */
    const EY = 0.1;          /* hauteur des électrodes */
    const TIP = 0.3;         /* demi-écart entre leurs pointes */
    const OUT_A = 0.5;       /* sortie du grand ballon (angle) */
    const ARM_A = -0.62;     /* bras par lequel l'eau revient dans le petit ballon */
    const JW = 0.3;          /* manchon d'eau froide du réfrigérant */
    const AR = 0.031, SR = 0.019, SG = 0.18;   /* atomes des gaz, taille de leur image */
    const BR = 0.048;        /* perles des acides aminés */
    const N_GAS = 30;
    const FORM = 0.42;       /* durée de la soudure d'un acide aminé */
    const FLOAT_V = 0.55, TUBE_V = 1.15, GAP = 0.16;
    const HOLD_T = 0.3, STORM_PROD = 0.5;
    const DEC = RMo ? 6 : 8.5;
    const FLASH = RMo ? 0.3 : 1;
    const WAVE = RMo ? 0.4 : 1;
    const TAP = 0, STORM = 1, VICTORY = 2, MINI = 3;

    const geo = {
      ready: false, w: 1, h: 1, dpr: 1, U: 100, PX: 0.01, ox: 0, oy: 0, rim: 0.02, c2y: 2, yg: 2.83, qy: 0.77,
      ws: 1.94, ycb: 1.4, ctop: 0.62, j0: 0.72, j1: 1.33, ex: 0.7, ey: 0.38, a0x: 0, a0y: 0, sJ: 0,
      wireL: null, wireR: null, bx: 0, by: 0, bw: 1, bh: 1,
    };
    let vaporLine = null, vaporPath = null, dropPath = null, dropFac = null;
    let bg = null, front = null, cloudBase = null, cloudLit = null, cloudH = 1, bloomA = null, bloomB = null;
    let gasSpr = [], beadSpr = [], inkSpr = [], SPR = null;
    let flameGrad = null, coreGrad = null, liqGrad = null, liqKey = -1;
    const X = (u) => geo.ox + u * geo.U;
    const Y = (v) => geo.oy + v * geo.U;
    function unitsOn(g, k) {
      g.setTransform(k * geo.U, 0, 0, k * geo.U, k * geo.ox, k * geo.oy);
    }
    function pxOn(g, k) {
      g.setTransform(k, 0, 0, k, 0, 0);
    }
    function drawSpr(s, x, y, r) {
      ctx.drawImage(s, x - r, y - r, r * 2, r * 2);
    }

    /* ---- état ---- */
    const gas = [];
    for (let i = 0; i < N_GAS; i++) gas.push({ x: 0, y: 0, vx: 0, vy: 0, a: 0, va: 0, type: 0, st: 0, t: 0, k: 1 });
    const aminos = [];
    for (let i = 0; i < 40; i++) {
      aminos.push({
        on: false, st: 0, x: 0, y: 0, vx: 0, vy: 0, ang: 0, va: 0, n: 3, c: [0, 0, 0, 0], t: 0, s: 0, gl: 1,
        sx: new Float32Array(4), sy: new Float32Array(4), gt: [0, 0, 0, 0], born: 0, fade: 1, hx: 0, hy: 0,
      });
    }
    const tubeQ = [];
    const MAXP = 280;
    const bolts = [];
    for (let i = 0; i < 7; i++) {
      bolts.push({
        on: false, t: 0, life: 0, pts: new Float32Array(MAXP * 2), mainN: 0, br: new Int16Array(60), nb: 0,
        mx: 0, my: 0, strikes: [0, 0, 0], peaks: [0, 0, 0], ns: 1, next: 0, I: 0, Is: 0, G: 0, w: 1, kind: 0, born: 0,
      });
    }
    const sparks = [];
    for (let i = 0; i < 170; i++) sparks.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, t: 0, life: 1, c: 0, g: 1 });
    const puffs = [];
    for (let i = 0; i < 30; i++) puffs.push({ on: false, s: 0, v: 0, o: 0, ph: 0, r: 0, a: 0, free: false, x: 0, y: 0, vx: 0, vy: 0, t: 0, rr: 0, al: 0 });
    const bubbles = [];
    for (let i = 0; i < 16; i++) bubbles.push({ on: false, x: 0, y: 0, vy: 0, r: 0, ph: 0 });
    const ripples = [];
    for (let i = 0; i < 6; i++) ripples.push({ on: false, x: 0, t: 0, a: 0 });
    const inks = [];
    for (let i = 0; i < 8; i++) inks.push({ on: false, x: 0, y: 0, t: 0, c: 0 });
    const rings = [];
    for (let i = 0; i < 6; i++) rings.push({ on: false, x: 0, y: 0, t: 0 });
    const dews = [];
    for (let i = 0; i < 6; i++) dews.push({ on: false, st: 0, s: 0, x: 0, y: 0, vx: 0, vy: 0, ang: 0 });
    /* fines particules en suspension : à la fin, l'eau est trouble */
    const specks = [];
    for (let i = 0; i < 40; i++) {
      const a = rand(0.15, Math.PI - 0.15), r = rand(0.05, 0.42);
      specks.push({ x: Math.cos(a) * r, y: Math.sin(a) * r * 0.95 - 0.02, s: rand(0.006, 0.013), ph: rand(TAU), f: rand(0.3, 0.9), al: rand(0.25, 0.7), c: Math.random() < 0.55 ? 1 : 0 });
    }
    const ambPts = new Float32Array(2 * 32);
    const presses = new Map();
    const Q = { x: 0, y: 0, tx: 0, ty: 1 };
    const P = { x: 0, y: 0 };
    const SX = new Float32Array(33), SY = new Float32Array(33);

    let time = 0, made = 0, arrived = 0, boltsN = 0, finished = false, finT = 0;
    let shownTint = 0, flash = 0, fx = 0, fy = 0, ambI = 0, ambT = 9, ambN = 0, ambNext = 4;
    let lastProd = -9, stormAcc = 0, stormNext = 0, storming = false, stormUsed = false, lastBuzz = -9;
    let hintStage = 0, gestureType = null, lastDown = -9, laughPending = false, laughEnd = 0;
    let crackleT = 1, puffAcc = 0, bubbleAcc = 0, dewT = 1, wireT = 9, victory = [], holdP = null, warmed = false;
    let frozen = false, testFreeze = -1, freezeAt = -1;   /* pour les tests automatiques */
    let bigT = -9, glowL = 0;

    /* ================= géométrie ================= */
    let layoutKey = '';
    function ensureLayout(w, h, dpr) {
      const key = w + 'x' + h + '@' + dpr;
      if (key !== layoutKey) {
        layoutKey = key;
        layout(w, h, dpr);
      }
      blit(cvBg, bg);
      blit(cvLit, cloudLit, cloudH);
      blit(cvFront, front);
      blit(cvFlare, front);
    }
    /* recopie une image prête dans un calque fixe (s'il a déjà la bonne taille) */
    function blit(c, img, hh) {
      if (!img || c.w !== geo.w || c.h !== geo.h || c.dpr !== geo.dpr) return;
      const g = c.ctx;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, c.canvas.width, c.canvas.height);
      g.drawImage(img, 0, 0, c.canvas.width, Math.round((hh || geo.h) * c.dpr));
      g.setTransform(c.dpr, 0, 0, c.dpr, 0, 0);
    }

    function layout(w, h, dpr) {
      geo.w = w;
      geo.h = h;
      geo.dpr = dpr;
      const Uw = (w * 0.95) / 3.06;
      /* une scène haute allonge le col du petit ballon */
      geo.c2y = clamp((h * 0.965) / Uw - 2.04, 2, 2.6);
      const H = geo.c2y + 2.04;
      geo.U = Math.min(Uw, (h * 0.965) / H);
      geo.PX = 1 / geo.U;
      geo.rim = 2.2 / geo.U;
      geo.ox = w / 2;
      geo.oy = (h - H * geo.U) / 2 + 1.05 * geo.U;
      geo.yg = geo.c2y + R2 + 0.33;
      geo.qy = Math.sqrt(1 - XV * XV);
      geo.ws = geo.c2y - 0.06;
      buildPaths();
      makeSprites();
      makeLayers(w, h);
      geo.ready = true;
      liqKey = -1;
      if (!warmed) prewarm();
      placeGesture();
      /* étiquettes : en haut à gauche du grand ballon, à gauche du petit */
      const small = geo.U < 60;
      labels[0].style.left = X(-1.08) + 'px';
      labels[0].style.top = Y(-0.82) + 'px';
      labels[1].style.left = X(XV - R2 - 0.28) + 'px';
      labels[1].style.top = Y(geo.c2y + 0.1) + 'px';
      labels.forEach((el) => { el.style.display = small ? 'none' : ''; });
    }

    function buildPaths() {
      const c2y = geo.c2y;
      vaporLine = [[XV, c2y - R2 + 0.06], [XV, geo.qy - 0.06]];
      vaporPath = makePath([[XV, geo.ws - 0.04], [XV, geo.qy - 0.22]], 0.1, 0.02);
      const ca = Math.cos(OUT_A), sa = Math.sin(OUT_A);
      const ax = Math.cos(ARM_A), ay = Math.sin(ARM_A);
      const a1x = XV + ax * (R2 + 0.24), a1y = c2y + ay * (R2 + 0.24);
      geo.a0x = XV + ax * (R2 - 0.1);
      geo.a0y = c2y + ay * (R2 - 0.1);
      geo.ycb = a1y - 0.16;
      geo.ctop = sa + (XC - ca) * Math.tan(OUT_A);
      geo.ex = ca * 0.8;
      geo.ey = sa * 0.8;
      dropPath = makePath([[geo.ex, geo.ey], [XC, geo.ctop], [XC, geo.ycb], [a1x, a1y], [geo.a0x, geo.a0y]], 0.12, 0.02);
      dropFac = new Float32Array(dropPath.n);
      for (let i = 0; i < dropPath.n; i++) dropFac[i] = 0.6 + 0.6 * Math.max(0, dropPath.ty[i]);
      geo.j0 = geo.ctop + 0.1;
      geo.j1 = geo.ycb - 0.08;
      geo.sJ = dropPath.L * 0.3;
      for (let i = 0; i < dropPath.n; i++) {
        if (Math.abs(dropPath.xs[i] - XC) < 0.01 && dropPath.ys[i] >= geo.j0) {
          geo.sJ = i * dropPath.ds;
          break;
        }
      }
      /* les fils électriques : ils pendent un peu et sortent de la scène */
      const edge = geo.w / 2 / geo.U + 0.25;
      geo.wireL = [-1.49, EY, -1.68, EY + 0.03, -(edge - 0.15), EY + 0.5, -edge, EY + 0.42];
      geo.wireR = [1.49, EY, 1.68, EY + 0.03, edge - 0.15, EY + 0.5, edge, EY + 0.42];
    }
    function bez(W, t, out) {
      const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
      out.x = a * W[0] + b * W[2] + c * W[4] + d * W[6];
      out.y = a * W[1] + b * W[3] + c * W[5] + d * W[7];
      return out;
    }

    /* ================= petites images prêtes à l'emploi ================= */
    function ball(g, x, y, r, col, a, dark) {
      const gr = g.createRadialGradient(x - r * 0.38, y - r * 0.42, r * 0.06, x, y, r);
      gr.addColorStop(0, rgba('#FFFFFF', a));
      gr.addColorStop(0.42, rgba(col, a));
      gr.addColorStop(1, lib.mix(col, dark || '#262A66', 0.55, a));
      g.fillStyle = gr;
      g.beginPath();
      g.arc(x, y, r, 0, TAU);
      g.fill();
    }
    function gasSprite(T) {
      const k = geo.U * geo.dpr;
      const S = Math.ceil(SG * k);
      const c = mk(S, S);
      const g = c.getContext('2d');
      g.setTransform(k, 0, 0, k, S / 2, S / 2);
      if (!T.core) {
        const r = SR * 1.2;
        ball(g, -r * 0.8, 0, r, '#E2ECFF', 0.95);
        ball(g, r * 0.8, 0, r, '#EEF4FF', 0.95);
        return c;
      }
      const rc = AR * T.r, dd = rc + SR * 0.5;
      for (const [a, f, fr] of T.sat) if (!fr) ball(g, Math.cos(a) * dd * f, Math.sin(a) * dd * f, SR * 0.92, '#D5DDF8', 0.8);
      ball(g, 0, 0, rc, T.core, 0.96);
      for (const [a, f, fr] of T.sat) if (fr) ball(g, Math.cos(a) * dd * f, Math.sin(a) * dd * f, SR, '#F2F5FF', 0.97);
      return c;
    }
    function beadSprite(col) {
      const r = BR * geo.U * geo.dpr;
      const S = Math.ceil(r * 2.6);
      const c = mk(S, S);
      const g = c.getContext('2d');
      const o = S / 2;
      const gr = g.createRadialGradient(o - r * 0.36, o - r * 0.4, r * 0.06, o, o, r);
      gr.addColorStop(0, '#FFFFFF');
      gr.addColorStop(0.32, col);
      gr.addColorStop(1, lib.mix(col, '#40204A', 0.5));
      g.fillStyle = gr;
      g.beginPath();
      g.arc(o, o, r, 0, TAU);
      g.fill();
      return c;
    }
    function makeSprites() {
      gasSpr = GAS_TYPES.map(gasSprite);
      beadSpr = MOL.map(beadSprite);
      if (!SPR) {
        SPR = {
          white: soft('#FFFFFF', 64), warm: soft('#FFE6A8', 64), yellow: soft(C.yellow, 64), blue: soft(C.blue, 64),
          fire: soft('#FF8A3D', 64), steam: soft('#E6EEFF', 32), cold: soft('#9FE0FF', 32),
        };
        inkSpr = INK.map((c) => soft(c, 48));
      }
    }

    /* ================= décor pré-rendu ================= */
    function makeClouds(w, h) {
      const s = 3;
      cloudH = Math.round(h * 0.72);
      const cw = Math.ceil(w / s), ch = Math.ceil(cloudH / s);
      cloudBase = mk(cw, ch);
      cloudLit = mk(cw, ch);
      const bctx = cloudBase.getContext('2d'), lctx = cloudLit.getContext('2d');
      const bi = bctx.createImageData(cw, ch), li = lctx.createImageData(cw, ch);
      const n = lib.makeNoise(11);
      const D = lib.hexToRgb('#151944'), B = lib.hexToRgb('#38418C'), L = lib.hexToRgb('#B9C7FF');
      for (let y = 0; y < ch; y++) {
        const py = y * s;
        const m = 1 - sstep(cloudH * 0.3, cloudH, py);
        for (let x = 0; x < cw; x++) {
          const px = x * s;
          const v = n.fbm(px / 120 + 3.3, py / 46 + 1.1, 5);
          const v2 = n.fbm(px / 120 + 3.3, (py - 8) / 46 + 1.1, 5);
          const dens = sstep(0.42, 0.7, v) * m;
          const top = clamp((v - v2) * 7 + 0.5);
          const j = (y * cw + x) * 4;
          bi.data[j] = lerp(D[0], B[0], top);
          bi.data[j + 1] = lerp(D[1], B[1], top);
          bi.data[j + 2] = lerp(D[2], B[2], top);
          bi.data[j + 3] = dens * 0.9 * 255;
          li.data[j] = L[0];
          li.data[j + 1] = L[1];
          li.data[j + 2] = L[2];
          li.data[j + 3] = Math.min(255, dens * (0.4 + 0.6 * top) * 330);
        }
      }
      bctx.putImageData(bi, 0, 0);
      lctx.putImageData(li, 0, 0);
    }

    function glassShapes(g, grow) {
      g.beginPath();
      g.arc(0, 0, 1 + grow, 0, TAU);
      g.fill();
      g.beginPath();
      g.arc(XV, geo.c2y, R2 + grow, 0, TAU);
      g.fill();
      g.lineCap = 'butt';
      g.lineJoin = 'round';
      g.lineWidth = TUBE + grow * 2;
      trace(g, vaporLine);
      g.stroke();
      trace(g, dropPath.dense);
      g.stroke();
      g.lineWidth = SLEEVE + grow * 2;
      g.beginPath();
      g.moveTo(-0.9, EY);
      g.lineTo(-1.27, EY);
      g.moveTo(0.9, EY);
      g.lineTo(1.27, EY);
      g.stroke();
    }
    function trace(g, pts) {
      g.beginPath();
      g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    }

    function makeLayers(w, h) {
      const d = geo.dpr;
      const W = Math.round(w * d), H = Math.round(h * d);
      makeClouds(w, h);
      const mask = mk(W, H);
      const m = mask.getContext('2d');
      unitsOn(m, d);
      m.fillStyle = m.strokeStyle = '#FFFFFF';
      glassShapes(m, 0);
      const tmp = mk(W, H);
      bg = mk(W, H);
      paintBg(bg.getContext('2d'), w, h, mask, tmp);
      front = mk(W, H);
      paintFront(front.getContext('2d'), mask, tmp);
      /* le halo des éclairs ne couvre que le grand ballon et ses abords */
      geo.bx = Math.max(0, Math.floor(X(-1.32)));
      geo.by = Math.max(0, Math.floor(Y(-1.25)));
      geo.bw = Math.min(w, Math.ceil(X(1.32))) - geo.bx;
      geo.bh = Math.min(h, Math.ceil(Y(1.3))) - geo.by;
      bloomA = mk(Math.ceil(geo.bw / 4), Math.ceil(geo.bh / 4));
      bloomB = mk(Math.ceil(geo.bw / 10), Math.ceil(geo.bh / 10));
      /* flamme du brûleur */
      const yb = geo.c2y + R2 + 0.13, yt = geo.c2y + R2;
      flameGrad = ctx.createLinearGradient(0, yb, 0, yt - 0.02);
      flameGrad.addColorStop(0, 'rgba(90,150,255,0.95)');
      flameGrad.addColorStop(0.3, 'rgba(255,170,80,0.9)');
      flameGrad.addColorStop(0.75, 'rgba(255,214,120,0.75)');
      flameGrad.addColorStop(1, 'rgba(255,236,170,0)');
      coreGrad = ctx.createLinearGradient(0, yb, 0, yb - (yb - yt) * 0.6);
      coreGrad.addColorStop(0, 'rgba(130,180,255,1)');
      coreGrad.addColorStop(1, 'rgba(190,215,255,0.15)');
    }

    function volcano(g, x, base, hgt, hw) {
      const top = base - hgt, cw = hw * 0.16;
      for (let i = 0; i < 5; i++) draw.glow(g, x + i * hw * 0.14, top - i * hgt * 0.38, hgt * (0.4 + i * 0.14), '#2C3062', 0.3);
      draw.glow(g, x, top + 2, hgt * 0.8, '#FF7A3A', 0.24);
      g.beginPath();
      g.moveTo(x - hw, base);
      g.quadraticCurveTo(x - hw * 0.35, base - hgt * 0.32, x - cw, top);
      g.lineTo(x - cw * 0.3, top + hgt * 0.05);
      g.lineTo(x + cw * 0.4, top + hgt * 0.04);
      g.lineTo(x + cw, top);
      g.quadraticCurveTo(x + hw * 0.35, base - hgt * 0.32, x + hw, base);
      g.closePath();
      const vg = g.createLinearGradient(0, top, 0, base);
      vg.addColorStop(0, '#1E2050');
      vg.addColorStop(1, '#111338');
      g.fillStyle = vg;
      g.fill();
      g.strokeStyle = 'rgba(255,140,80,0.5)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x - cw * 0.85, top + 0.6);
      g.lineTo(x + cw * 0.85, top + 0.6);
      g.stroke();
    }

    function paintBg(g, w, h, mask, tmp) {
      const d = geo.dpr, U = geo.U;
      pxOn(g, d);
      /* ciel d'orage */
      const sky = g.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#232962');
      sky.addColorStop(0.5, '#171C4A');
      sky.addColorStop(1, '#0D1030');
      g.fillStyle = sky;
      g.fillRect(0, 0, w, h);
      draw.glow(g, w * 0.86, h * 0.22, Math.max(w, h) * 0.45, '#4A3F9C', 0.22);
      draw.glow(g, w * 0.1, h * 0.12, Math.max(w, h) * 0.35, '#2F3A8C', 0.25);
      g.drawImage(cloudBase, 0, 0, w, cloudH);
      /* mer sombre et volcans au loin */
      const gy = Y(geo.yg);
      const hz = gy - 0.55 * U;
      draw.glow(g, w * 0.5, hz, w * 0.7, '#3B3488', 0.18);
      const sea = g.createLinearGradient(0, hz, 0, gy);
      sea.addColorStop(0, '#1B1E4E');
      sea.addColorStop(1, '#0E1131');
      g.fillStyle = sea;
      g.fillRect(0, hz, w, gy - hz + 3);
      const rn = lib.makeNoise(3).rnd;
      g.fillStyle = 'rgba(170,185,255,0.07)';
      for (let i = 0; i < 30; i++) {
        const y = hz + 2 + Math.pow(rn(), 1.5) * (gy - hz - 2);
        g.fillRect(rn() * w, y, 4 + rn() * 24, 1);
      }
      g.fillStyle = 'rgba(150,160,255,0.16)';
      g.fillRect(0, hz - 0.5, w, 1);
      volcano(g, w * 0.07, hz + 1, Math.min(h * 0.12, U * 0.5), Math.min(w * 0.16, U * 0.9));
      volcano(g, w * 0.94, hz + 1, Math.min(h * 0.085, U * 0.36), Math.min(w * 0.12, U * 0.66));
      /* le sol : des strates de roche */
      const n = lib.makeNoise(5);
      const bandH = Math.max(6, 0.075 * U);
      const COLS = ['#2C2552', '#221D40', '#302955', '#1D1937', '#282249', '#1A1632', '#241E42', '#1C1835'];
      const edgeY = (x, i) => gy + i * bandH + (n.fbm(x / 70, i * 3.7, 3) - 0.5) * bandH * (i === 0 ? 0.3 : 1.1);
      for (let i = 0; i < COLS.length; i++) {
        if (gy + (i - 0.5) * bandH > h) break;
        g.beginPath();
        g.moveTo(-2, h + 2);
        for (let x = -2; x <= w + 6; x += 6) g.lineTo(x, edgeY(x, i));
        g.lineTo(w + 6, h + 2);
        g.closePath();
        g.fillStyle = COLS[i];
        g.fill();
        if (i > 0) {
          g.strokeStyle = 'rgba(0,0,0,0.18)';
          g.lineWidth = 1;
          g.stroke();
        }
      }
      if (h - gy > 4) {
        const gr = lib.makeNoise(9).rnd;
        const cnt = Math.min(1600, (w * (h - gy)) / 26);
        for (let k = 0; k < cnt; k++) {
          const x = gr() * w, y = gy + 2 + gr() * (h - gy);
          g.fillStyle = gr() < 0.5 ? 'rgba(210,200,255,0.06)' : 'rgba(0,0,0,0.16)';
          g.fillRect(x, y, 1 + gr() * 1.5, 1 + gr() * 1.2);
        }
        for (let k = 0; k < 14; k++) {
          const x = gr() * w, y = gy + 3 + gr() * Math.min(h - gy, bandH * 3);
          const r = 1.2 + gr() * 3;
          const sg = g.createRadialGradient(x - r * 0.3, y - r * 0.4, 0, x, y, r * 1.2);
          sg.addColorStop(0, '#4A4278');
          sg.addColorStop(1, '#16132B');
          g.fillStyle = sg;
          g.beginPath();
          g.ellipse(x, y, r * 1.3, r, 0, 0, TAU);
          g.fill();
        }
      }
      g.strokeStyle = 'rgba(160,165,255,0.28)';
      g.lineWidth = 1;
      g.beginPath();
      for (let x = -2; x <= w + 6; x += 6) {
        if (x < 0) g.moveTo(x, edgeY(x, 0));
        else g.lineTo(x, edgeY(x, 0));
      }
      g.stroke();
      draw.glow(g, X(XV), gy, 0.7 * U, '#FF8A3D', 0.16);
      draw.glow(g, X(XC), Y((geo.j0 + geo.j1) / 2), 0.5 * U, '#5FB8FF', 0.08);

      /* fils, trépied et brûleur */
      unitsOn(g, d);
      wires(g);
      tripod(g, false);
      burner(g);

      /* l'intérieur du verre : une teinte légère, plus dense sur les bords */
      const t = tmp.getContext('2d');
      t.setTransform(1, 0, 0, 1, 0, 0);
      t.clearRect(0, 0, tmp.width, tmp.height);
      t.globalCompositeOperation = 'source-over';
      t.drawImage(mask, 0, 0);
      t.globalCompositeOperation = 'source-in';
      t.fillStyle = '#A9BCFF';
      t.fillRect(0, 0, tmp.width, tmp.height);
      t.globalCompositeOperation = 'source-over';
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = 0.07;
      g.drawImage(tmp, 0, 0);
      g.globalAlpha = 1;
      unitsOn(g, d);
      jacketBack(g);
      const haze = g.createRadialGradient(-0.15, -0.25, 0, -0.15, -0.25, 1.15);
      haze.addColorStop(0, 'rgba(150,130,240,0.12)');
      haze.addColorStop(1, 'rgba(150,130,240,0)');
      g.fillStyle = haze;
      g.beginPath();
      g.arc(0, 0, 1, 0, TAU);
      g.fill();
      fresnel(g, 0, 0, 1);
      fresnel(g, XV, geo.c2y, R2);
      rods(g);
    }

    function fresnel(g, cx, cy, R) {
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, R);
      gr.addColorStop(0, 'rgba(150,165,255,0)');
      gr.addColorStop(0.7, 'rgba(150,165,255,0)');
      gr.addColorStop(0.9, 'rgba(170,190,255,0.08)');
      gr.addColorStop(1, 'rgba(205,222,255,0.22)');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(cx, cy, R, 0, TAU);
      g.fill();
    }

    function wires(g) {
      g.lineCap = 'round';
      for (let side = 0; side < 2; side++) {
        const W = side ? geo.wireR : geo.wireL;
        g.beginPath();
        g.moveTo(W[0], W[1]);
        g.bezierCurveTo(W[2], W[3], W[4], W[5], W[6], W[7]);
        g.strokeStyle = side ? '#3B4690' : '#8E3F5E';
        g.lineWidth = 0.034;
        g.stroke();
        g.beginPath();
        g.moveTo(W[0], W[1] - 0.009);
        g.bezierCurveTo(W[2], W[3] - 0.009, W[4], W[5] - 0.009, W[6], W[7] - 0.009);
        g.strokeStyle = side ? 'rgba(170,185,255,0.35)' : 'rgba(255,170,200,0.32)';
        g.lineWidth = 0.008;
        g.stroke();
      }
    }

    function tripod(g, frontPart) {
      const yr = geo.c2y + R2 * 0.72, rx = 0.375, ry = 0.045, yg = geo.yg;
      g.lineCap = 'round';
      if (!frontPart) {
        g.strokeStyle = '#272A52';
        g.lineWidth = 0.02;
        g.beginPath();
        g.moveTo(XV + 0.04, yr - ry);
        g.lineTo(XV + 0.07, yg - 0.03);
        g.stroke();
        g.strokeStyle = '#3E4277';
        g.lineWidth = 0.025;
        g.beginPath();
        g.moveTo(XV - rx, yr);
        g.lineTo(XV - rx - 0.1, yg);
        g.moveTo(XV + rx, yr);
        g.lineTo(XV + rx + 0.1, yg);
        g.stroke();
        g.strokeStyle = 'rgba(180,190,255,0.25)';
        g.lineWidth = 0.007;
        g.beginPath();
        g.moveTo(XV - rx - 0.006, yr + 0.01);
        g.lineTo(XV - rx - 0.104, yg - 0.01);
        g.moveTo(XV + rx - 0.006, yr + 0.01);
        g.lineTo(XV + rx + 0.094, yg - 0.01);
        g.stroke();
        g.strokeStyle = '#2E3160';
        g.lineWidth = 0.024;
        g.beginPath();
        g.ellipse(XV, yr, rx, ry, 0, Math.PI, TAU);
        g.stroke();
      } else {
        g.strokeStyle = '#474C86';
        g.lineWidth = 0.026;
        g.beginPath();
        g.ellipse(XV, yr, rx, ry, 0, 0, Math.PI);
        g.stroke();
        g.strokeStyle = 'rgba(190,200,255,0.4)';
        g.lineWidth = 0.007;
        g.beginPath();
        g.ellipse(XV, yr - 0.007, rx, ry, 0, 0.35, Math.PI - 0.35);
        g.stroke();
      }
    }

    function burner(g) {
      const yb = geo.c2y + R2 + 0.13, yg = geo.yg;
      const foot = g.createLinearGradient(0, yg - 0.05, 0, yg);
      foot.addColorStop(0, '#5A5F94');
      foot.addColorStop(1, '#1B1D3D');
      g.fillStyle = foot;
      g.beginPath();
      g.ellipse(XV, yg - 0.015, 0.15, 0.035, 0, 0, TAU);
      g.fill();
      const body = g.createLinearGradient(XV - 0.045, 0, XV + 0.045, 0);
      body.addColorStop(0, '#262A55');
      body.addColorStop(0.32, '#8C92C8');
      body.addColorStop(0.6, '#4C5186');
      body.addColorStop(1, '#1C1F45');
      g.fillStyle = body;
      g.fillRect(XV - 0.04, yb, 0.08, yg - yb - 0.02);
      const ring = g.createLinearGradient(XV - 0.05, 0, XV + 0.05, 0);
      ring.addColorStop(0, '#6A4E24');
      ring.addColorStop(0.35, '#E9C985');
      ring.addColorStop(1, '#5C421E');
      g.fillStyle = ring;
      g.fillRect(XV - 0.05, yg - 0.1, 0.1, 0.03);
      g.fillStyle = '#12142E';
      g.beginPath();
      g.ellipse(XV - 0.015, yg - 0.055, 0.008, 0.012, 0, 0, TAU);
      g.ellipse(XV + 0.018, yg - 0.055, 0.008, 0.012, 0, 0, TAU);
      g.fill();
      g.fillStyle = '#0E1028';
      g.beginPath();
      g.ellipse(XV, yb, 0.04, 0.01, 0, 0, TAU);
      g.fill();
    }

    function jacketBack(g) {
      const x0 = XC - JW / 2, y0 = geo.j0, hh = geo.j1 - geo.j0;
      const gr = g.createLinearGradient(x0, 0, x0 + JW, 0);
      gr.addColorStop(0, 'rgba(120,205,255,0.34)');
      gr.addColorStop(0.45, 'rgba(110,190,250,0.16)');
      gr.addColorStop(1, 'rgba(70,130,230,0.32)');
      draw.roundRect(g, x0, y0, JW, hh, JW * 0.42);
      g.fillStyle = gr;
      g.fill();
    }

    function rods(g) {
      for (let s = -1; s <= 1; s += 2) {
        const xa = s * (TIP + 0.06), xb = s * 1.3;
        const gr = g.createLinearGradient(0, EY - 0.018, 0, EY + 0.018);
        gr.addColorStop(0, '#2E3258');
        gr.addColorStop(0.3, '#C3C8EC');
        gr.addColorStop(0.55, '#666C9C');
        gr.addColorStop(1, '#1F2244');
        g.fillStyle = gr;
        g.fillRect(Math.min(xa, xb), EY - 0.017, Math.abs(xb - xa), 0.034);
        /* la pointe s'affine */
        g.beginPath();
        g.moveTo(xa + s * 0.002, EY - 0.016);
        g.lineTo(s * TIP, EY - 0.005);
        g.lineTo(s * TIP, EY + 0.005);
        g.lineTo(xa + s * 0.002, EY + 0.016);
        g.closePath();
        g.fill();
        ball(g, s * TIP, EY, 0.012, '#E8ECFF', 1, '#3E4370');
      }
    }

    function paintFront(g, mask, tmp) {
      const d = geo.dpr, U = geo.U, t = tmp.getContext('2d'), W = tmp.width, H = tmp.height;
      /* bords du verre : une bande prise entre deux contours de la silhouette entière ;
         là où un tube rejoint un ballon, la soudure ne laisse pas de trait */
      function band(g0, g1, col) {
        t.globalCompositeOperation = 'source-over';
        t.setTransform(1, 0, 0, 1, 0, 0);
        t.clearRect(0, 0, W, H);
        unitsOn(t, d);
        t.fillStyle = t.strokeStyle = '#FFFFFF';
        glassShapes(t, -g0);
        t.globalCompositeOperation = 'destination-out';
        glassShapes(t, -g1);
        t.globalCompositeOperation = 'source-in';
        t.setTransform(1, 0, 0, 1, 0, 0);
        if (Array.isArray(col)) {
          /* plus lumineux du côté d'où vient la lumière (en haut à gauche) */
          const gr = t.createLinearGradient(0, 0, W * 0.8, H);
          gr.addColorStop(0, col[0]);
          gr.addColorStop(1, col[1]);
          t.fillStyle = gr;
        } else {
          t.fillStyle = col;
        }
        t.fillRect(0, 0, W, H);
        t.globalCompositeOperation = 'source-over';
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.drawImage(tmp, 0, 0);
      }
      band(0, 3.2 / U, 'rgba(196,220,255,0.18)');
      band(1.3 / U, 2.7 / U, 'rgba(6,8,34,0.3)');
      band(0, 1.15 / U, ['rgba(238,246,255,0.8)', 'rgba(200,220,255,0.38)']);
      band(3.9 / U, 4.8 / U, 'rgba(220,235,255,0.13)');
      /* reflets, gardés à l'intérieur du verre */
      t.setTransform(1, 0, 0, 1, 0, 0);
      t.clearRect(0, 0, W, H);
      unitsOn(t, d);
      sphereShine(t, 0, 0, 1, 1);
      sphereShine(t, XV, geo.c2y, R2, 0.85);
      tubeShine(t, vaporLine);
      tubeShine(t, dropPath.dense);
      tubeShine(t, [[-0.9, EY], [-1.27, EY]]);
      tubeShine(t, [[0.9, EY], [1.27, EY]]);
      t.globalCompositeOperation = 'destination-in';
      t.setTransform(1, 0, 0, 1, 0, 0);
      t.drawImage(mask, 0, 0);
      t.globalCompositeOperation = 'source-over';
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.drawImage(tmp, 0, 0);
      unitsOn(g, d);
      jacketFront(g);
      dew(g);
      seals(g);
      tripod(g, true);
    }

    /* reflet en croissant : une forme pleine, effilée aux deux bouts */
    function crescent(g, cx, cy, rm, a0, a1, wMax, col) {
      const N = 40;
      g.beginPath();
      for (let i = 0; i <= N; i++) {
        const a = lerp(a0, a1, i / N), w = wMax * Math.pow(Math.sin((Math.PI * i) / N), 0.85);
        const r = rm + w / 2;
        if (i) g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        else g.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      for (let i = N; i >= 0; i--) {
        const a = lerp(a0, a1, i / N), w = wMax * Math.pow(Math.sin((Math.PI * i) / N), 0.85);
        const r = rm - w / 2;
        g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      g.closePath();
      g.fillStyle = col;
      g.fill();
    }
    function sphereShine(g, cx, cy, R, k) {
      crescent(g, cx, cy, R * 0.85, 3.38, 5.0, R * 0.12, rgba('#FFFFFF', 0.12 * k));
      crescent(g, cx, cy, R * 0.85, 3.5, 4.88, R * 0.075, rgba('#FFFFFF', 0.2 * k));
      crescent(g, cx, cy, R * 0.92, 3.75, 4.6, R * 0.016, rgba('#FFFFFF', 0.55 * k));
      crescent(g, cx, cy, R * 0.88, 0.12, 1.4, R * 0.045, rgba('#CFE6FF', 0.13 * k));
      g.save();
      g.translate(cx - R * 0.43, cy - R * 0.5);
      g.rotate(-0.72);
      g.scale(1, 0.42);
      const sg = g.createRadialGradient(0, 0, 0, 0, 0, R * 0.1);
      sg.addColorStop(0, rgba('#FFFFFF', 0.9 * k));
      sg.addColorStop(1, rgba('#FFFFFF', 0));
      g.fillStyle = sg;
      g.beginPath();
      g.arc(0, 0, R * 0.1, 0, TAU);
      g.fill();
      g.restore();
    }

    function tubeShine(g, pts) {
      const off = TUBE * 0.22;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      for (let pass = 0; pass < 2; pass++) {
        g.strokeStyle = pass ? 'rgba(255,255,255,0.34)' : 'rgba(200,225,255,0.08)';
        g.lineWidth = pass ? 0.012 : 0.034;
        g.beginPath();
        let lnx = 0, lny = 0;
        for (let i = 0; i < pts.length - 1; i++) {
          const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
          const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1;
          let nx = -dy / l, ny = dx / l;
          if (nx * -0.6 + ny * -0.8 < 0) {
            nx = -nx;
            ny = -ny;
          }
          if (i === 0 || nx * lnx + ny * lny < 0.5) g.moveTo(ax + nx * off, ay + ny * off);
          g.lineTo(bx + nx * off, by + ny * off);
          lnx = nx;
          lny = ny;
        }
        g.stroke();
      }
    }

    function jacketFront(g) {
      const x0 = XC - JW / 2, y0 = geo.j0, hh = geo.j1 - geo.j0, r = JW * 0.42, PX = geo.PX;
      for (let k = 0; k < 2; k++) {
        const yy = k ? geo.j1 - 0.12 : geo.j0 + 0.12;
        draw.roundRect(g, XC + JW / 2 - 0.02, yy - 0.03, 0.13, 0.06, 0.02);
        g.fillStyle = 'rgba(150,210,255,0.16)';
        g.fill();
        g.strokeStyle = 'rgba(205,235,255,0.5)';
        g.lineWidth = 1.1 * PX;
        g.stroke();
      }
      draw.roundRect(g, x0, y0, JW, hh, r);
      g.strokeStyle = 'rgba(205,235,255,0.16)';
      g.lineWidth = 3.2 * PX;
      g.stroke();
      g.strokeStyle = 'rgba(215,240,255,0.6)';
      g.lineWidth = 1.15 * PX;
      g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.3)';
      g.lineWidth = 0.014;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(x0 + 0.045, y0 + r * 0.8);
      g.lineTo(x0 + 0.045, y0 + hh - r * 0.8);
      g.stroke();
    }

    function dew(g) {
      const rn = lib.makeNoise(17).rnd;
      for (let i = 0; i < 14; i++) {
        const side = rn() < 0.5 ? -1 : 1;
        const x = XC + side * (TUBE / 2 - geo.rim - 0.013), y = lerp(geo.j0 + 0.05, geo.j1 - 0.05, rn());
        const r = 0.006 + rn() * 0.007;
        g.fillStyle = 'rgba(225,242,255,0.4)';
        g.beginPath();
        g.arc(x, y, r, 0, TAU);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.8)';
        g.beginPath();
        g.arc(x - r * 0.35, y - r * 0.35, r * 0.35, 0, TAU);
        g.fill();
      }
    }

    function seals(g) {
      for (let s = -1; s <= 1; s += 2) {
        const x0 = s > 0 ? 1.262 : -1.262 - 0.085;
        const sg = g.createLinearGradient(0, EY - 0.07, 0, EY + 0.07);
        sg.addColorStop(0, '#5A5380');
        sg.addColorStop(0.35, '#2E2A4A');
        sg.addColorStop(1, '#16132A');
        draw.roundRect(g, x0, EY - 0.07, 0.085, 0.14, 0.024);
        g.fillStyle = sg;
        g.fill();
        const bx0 = s > 0 ? 1.347 : -1.347 - 0.1;
        const bg2 = g.createLinearGradient(0, EY - 0.024, 0, EY + 0.024);
        bg2.addColorStop(0, '#8A6A35');
        bg2.addColorStop(0.35, '#F2D492');
        bg2.addColorStop(1, '#6A4E24');
        g.fillStyle = bg2;
        g.fillRect(bx0, EY - 0.022, 0.1, 0.044);
        ball(g, s * 1.47, EY, 0.042, '#E2BA68', 1, '#5A3E14');
      }
    }

    /* ================= remise à zéro ================= */
    function placeGas(m, inlet) {
      if (inlet) {
        m.x = XV * 0.82 + rand(-0.08, 0.08);
        m.y = geo.qy - 0.28 + rand(-0.06, 0.06);
      } else {
        const a = rand(TAU), r = 0.8 * Math.sqrt(Math.random());
        m.x = Math.cos(a) * r;
        m.y = Math.sin(a) * r;
      }
      m.vx = rand(-0.04, 0.04);
      m.vy = rand(-0.04, 0.04);
      m.a = rand(TAU);
      m.va = rand(-0.8, 0.8);
    }

    function placeGesture() {
      if (!gestureType || !geo.ready) return;
      api.gesture(gestureType, { x: (X(0) / geo.w) * 100, y: (Y(EY) / geo.h) * 100 });
    }

    function prewarm() {
      warmed = true;
      for (let i = 0; i < 100; i++) {
        time += 1 / 30;
        ambientStep(1 / 30);
      }
    }

    function init() {
      time = 0;
      made = 0;
      arrived = 0;
      boltsN = 0;
      finished = false;
      finT = 0;
      shownTint = 0;
      flash = 0;
      bigT = -9;
      glowL = 0;
      ambI = 0;
      ambT = 9;
      ambN = 0;
      ambNext = rand(2.5, 5);
      lastProd = -9;
      stormAcc = 0;
      stormNext = 0;
      storming = false;
      stormUsed = false;
      lastBuzz = -9;
      hintStage = 0;
      lastDown = -9;
      laughPending = false;
      laughEnd = 0;
      crackleT = 0.8;
      dewT = 0.6;
      wireT = 9;
      victory = [];
      presses.clear();
      holdP = null;
      tubeQ.length = 0;
      [aminos, bolts, sparks, puffs, bubbles, ripples, inks, rings, dews].forEach((pool) => pool.forEach((o) => { o.on = false; }));
      gas.forEach((m, i) => {
        m.type = GAS_MIX[i % GAS_MIX.length];
        placeGas(m, false);
        m.st = 0;
        m.k = 1;
        m.t = 0;
      });
      liqKey = -1;
      api.hint(TEXTES.depart);
      api.status('');
      api.progress(0);
      gestureType = 'tap';
      placeGesture();
      warmed = false;
      if (geo.ready) prewarm();
    }

    /* ================= éclairs ================= */
    function addBranch(b, start, count, cls) {
      if (b.nb >= 20) return;
      b.br[b.nb * 3] = start;
      b.br[b.nb * 3 + 1] = count;
      b.br[b.nb * 3 + 2] = cls;
      b.nb++;
    }
    function freeBolt() {
      let o = null;
      for (const b of bolts) {
        if (!b.on) return b;
        if (!o || b.born < o.born) o = b;
      }
      return o;
    }
    function envelope(b) {
      if (RMo || b.kind === MINI) {
        b.ns = 1;
        b.strikes[0] = 0;
        b.peaks[0] = b.kind === MINI ? 0.7 : 0.85;
      } else {
        /* un vrai éclair clignote : deux ou trois décharges dans le même chenal */
        b.ns = b.kind === STORM || Math.random() < 0.25 ? 2 : 3;
        b.strikes[0] = 0;
        b.strikes[1] = rand(0.08, 0.12);
        b.strikes[2] = rand(0.19, 0.27);
        b.peaks[0] = 1;
        b.peaks[1] = rand(0.7, 0.95);
        b.peaks[2] = rand(0.55, 0.8);
      }
      b.next = 0;
      b.life = b.strikes[b.ns - 1] + (b.kind === MINI ? 0.3 : b.kind === STORM ? 0.55 : 0.75);
    }

    function spawnBolt(mx, my, kind, targets) {
      const b = freeBolt();
      b.on = true;
      b.t = 0;
      b.kind = kind;
      b.mx = mx;
      b.my = my;
      b.nb = 0;
      b.born = time;
      b.I = 0;
      b.Is = 0;
      b.G = 0;
      b.w = kind === STORM ? 0.85 : 1;
      const Pt = b.pts;
      const lv = kind === STORM ? 4 : 5;
      let i = jag(Pt, 0, -TIP, EY, mx, my, lv, 0.24);
      i = jag(Pt, i, mx, my, TIP, EY, lv, 0.24);
      b.mainN = i + 1;
      let p = b.mainN;
      /* des branches frappent les molécules qui vont se souder */
      if (targets) {
        for (const m of targets) {
          let best = 2, bd = 1e9;
          for (let k = 2; k < b.mainN - 2; k++) {
            const dx = Pt[k * 2] - m.x, dy = Pt[k * 2 + 1] - m.y, dd = dx * dx + dy * dy;
            if (dd < bd) {
              bd = dd;
              best = k;
            }
          }
          const s0 = p;
          p = jag(Pt, p, Pt[best * 2], Pt[best * 2 + 1], m.x, m.y, 3, 0.28) + 1;
          addBranch(b, s0, 9, 1);
        }
      }
      /* et d'autres se perdent dans le gaz */
      const nfree = RMo ? 2 : kind === STORM ? 1 + Math.floor(Math.random() * 2) : 3 + Math.floor(Math.random() * 3);
      for (let k = 0; k < nfree && p + 26 <= MAXP; k++) {
        const idx = 3 + Math.floor(Math.random() * (b.mainN - 6));
        const x0 = Pt[idx * 2], y0 = Pt[idx * 2 + 1];
        let tx = Pt[idx * 2 + 2] - Pt[idx * 2 - 2], ty = Pt[idx * 2 + 3] - Pt[idx * 2 - 1];
        const tl = Math.hypot(tx, ty) || 1;
        tx /= tl;
        ty /= tl;
        const ang = (Math.random() < 0.5 ? -1 : 1) * rand(0.35, 0.95);
        const c = Math.cos(ang), s = Math.sin(ang);
        const dx = tx * c - ty * s, dy = tx * s + ty * c;
        const len = rand(0.12, 0.32);
        const s0 = p;
        p = jag(Pt, p, x0, y0, x0 + dx * len, y0 + dy * len, 4, 0.3) + 1;
        addBranch(b, s0, 17, 1);
        if (Math.random() < 0.6) {
          const j = s0 + 5 + Math.floor(Math.random() * 7);
          const bx = Pt[j * 2], by = Pt[j * 2 + 1];
          const a2 = ang + (Math.random() < 0.5 ? -1 : 1) * rand(0.4, 0.8);
          const c2 = Math.cos(a2), s2 = Math.sin(a2);
          const s1 = p;
          p = jag(Pt, p, bx, by, bx + (tx * c2 - ty * s2) * len * 0.45, by + (tx * s2 + ty * c2) * len * 0.45, 3, 0.3) + 1;
          addBranch(b, s1, 9, 2);
        }
      }
      /* tout reste à l'intérieur du verre (pas besoin de découper au dessin) */
      for (let k = 0; k < p; k++) {
        const x = Pt[k * 2], y = Pt[k * 2 + 1], r = Math.hypot(x, y);
        if (r > 0.93) {
          Pt[k * 2] = (x * 0.93) / r;
          Pt[k * 2 + 1] = (y * 0.93) / r;
        }
      }
      envelope(b);
      return b;
    }

    /* petit crépitement entre les pointes, avant le premier éclair : « ici, il y a de l'électricité » */
    function spawnMini(side) {
      const b = freeBolt();
      b.on = true;
      b.t = 0;
      b.kind = MINI;
      b.nb = 0;
      b.born = time;
      b.w = 1;
      b.I = 0;
      b.Is = 0;
      b.G = 0;
      const x0 = side * TIP, x1 = x0 - side * rand(0.06, 0.13), y1 = EY + rand(-0.07, 0.07);
      b.mx = x1;
      b.my = y1;
      b.mainN = jag(b.pts, 0, x0, EY, x1, y1, 3, 0.3) + 1;
      envelope(b);
    }

    function ring(x, y) {
      let o = rings[0];
      for (const r of rings) {
        if (!r.on) {
          o = r;
          break;
        }
        if (r.t > o.t) o = r;
      }
      o.on = true;
      o.x = x;
      o.y = y;
      o.t = 0;
    }
    function spark(x, y, vx, vy, life, c, g) {
      for (const s of sparks) {
        if (s.on) continue;
        s.on = true;
        s.x = x;
        s.y = y;
        s.vx = vx;
        s.vy = vy;
        s.t = 0;
        s.life = life;
        s.c = c;
        s.g = g;
        return;
      }
    }
    function burst(x, y, n, speed) {
      for (let i = 0; i < n; i++) {
        const a = rand(TAU), v = rand(0.25, 1.1) * speed;
        spark(x, y, Math.cos(a) * v, Math.sin(a) * v - 0.15, rand(0.22, 0.55), i % 3, 1.6);
      }
    }
    /* l'onde de choc bouscule les molécules voisines */
    function shock(mx, my, k) {
      for (const m of gas) {
        if (m.st === 2) continue;
        const dx = m.x - mx, dy = m.y - my, d = Math.hypot(dx, dy);
        if (d > 0.5 || d < 1e-4) continue;
        const f = (1 - d / 0.5) * 0.22 * k;
        m.vx += (dx / d) * f;
        m.vy += (dy / d) * f;
        m.va += rand(-4, 4) * (1 - d / 0.5);
      }
    }
    function pickGas(cx, cy, n) {
      const cand = [];
      for (const m of gas) if (m.st === 0 || (m.st === 3 && m.k > 0.5)) cand.push(m);
      cand.sort((a, b) => ((a.x - cx) ** 2 + (a.y - cy) ** 2) - ((b.x - cx) ** 2 + (b.y - cy) ** 2));
      return cand.slice(0, n);
    }

    function makeAmino(cx, cy, n, picked) {
      let a = null;
      for (const o of aminos) {
        if (!o.on) {
          a = o;
          break;
        }
      }
      if (!a) {
        for (const o of aminos) if (o.st === 6 && (!a || o.born < a.born)) a = o;
        if (!a) return;
      }
      a.on = true;
      a.st = 1;
      a.t = 0;
      a.n = n;
      a.x = cx;
      a.y = cy;
      a.ang = rand(-0.5, 0.5);
      a.va = rand(-0.8, 0.8);
      a.vx = 0;
      a.vy = 0;
      a.gl = 1;
      a.fade = 1;
      a.born = time;
      let prev = -1;
      for (let j = 0; j < 4; j++) {
        let c = Math.floor(Math.random() * 4);
        if (c === prev) c = (c + 1 + Math.floor(Math.random() * 3)) % 4;
        a.c[j] = c;
        prev = c;
      }
      for (let j = 0; j < n; j++) {
        const m = picked[j];
        if (m) {
          a.sx[j] = m.x;
          a.sy[j] = m.y;
          a.gt[j] = m.type;
          m.st = 2;
          m.t = rand(1.0, 2.4);
        } else {
          a.sx[j] = cx + rand(-0.08, 0.08);
          a.sy[j] = cy + rand(-0.08, 0.08);
          a.gt[j] = -1;
        }
      }
      made++;
      if (made === 1 && !finished) {
        /* le compteur n'apparaît qu'à l'arrivée de la première brique dans l'eau (pas de « 0 sur 6 ») */
        hintStage = 1;
        api.hint(TEXTES.premier);
        laughPending = true;
      }
      api.sfx.play('chime', { pitch: 0.9 + Math.min(12, made) * 0.03, volume: 0.45, gap: 90 });
    }

    function fire(ux, uy, kind) {
      let mx = ux, my = uy;
      /* entre les pointes, l'arc bombe toujours un peu (le plus souvent vers le haut,
         comme l'air chaud qui monte) : l'éclair traverse le gaz au lieu de filer tout droit */
      if (Math.abs(my - EY) < 0.22 && Math.abs(mx) < TIP + 0.2) {
        my = EY + (Math.random() < 0.72 ? -1 : 1) * rand(0.24, 0.46);
        mx += rand(-0.14, 0.14);
      }
      const r = Math.hypot(mx, my), lim = 0.8;
      if (r > lim) {
        mx *= lim / r;
        my *= lim / r;
      }
      const productive = kind === TAP || (kind === STORM && time - lastProd >= STORM_PROD);
      let picked = null;
      if (productive) {
        const n = Math.random() < 0.5 ? 3 : 4;
        /* l'acide aminé se forme près de l'impact, un peu à l'écart des parois */
        const fr = Math.hypot(mx, my), fl = 0.66;
        const cx = fr > fl ? (mx * fl) / fr : mx, cy = fr > fl ? (my * fl) / fr : my;
        picked = pickGas(cx, cy, n);
        makeAmino(cx, cy, n, picked);
        lastProd = time;
      }
      spawnBolt(mx, my, kind, picked);
      if (testFreeze >= 0) {
        freezeAt = time + testFreeze;
        testFreeze = -1;
      }
      if (kind === TAP || kind === STORM) boltsN++;
      shock(mx, my, kind === STORM ? 0.6 : 1);
      burst(mx, my, kind === STORM ? 8 : 14, 1);
      burst(-TIP, EY, 3, 0.6);
      burst(TIP, EY, 3, 0.6);
      wireT = 0;
      if (kind === STORM) {
        api.sfx.play('crack', { pitch: rand(0.85, 1.3), volume: 0.8, gap: 50 });
        api.sfx.play('rumble', { pitch: rand(0.8, 1.1), volume: 0.3, gap: 700 });
        if (time - lastBuzz > 0.4) {
          api.buzz(8);
          lastBuzz = time;
        }
      } else {
        api.sfx.play('crack', { pitch: rand(0.8, 1.15), gap: 30 });
        api.sfx.play('rumble', { pitch: rand(0.85, 1.15), volume: 0.4, gap: 400 });
        if (kind === TAP) {
          api.buzz(12);
          lastBuzz = time;
        }
      }
    }

    /* ================= océan ================= */
    function surfY(x) {
      let y = geo.ws + Math.sin(x * 26 + time * 2.4) * 0.0045 * WAVE + Math.sin(x * 47 - time * 3.9) * 0.0025 * WAVE;
      for (let i = 0; i < ripples.length; i++) {
        const r = ripples[i];
        if (!r.on) continue;
        const dx = x - r.x;
        y += r.a * Math.exp((-dx * dx) / 0.012) * Math.sin(dx * 70 - r.t * 16) * Math.exp(-r.t * 2.8);
      }
      return y;
    }
    function ripple(x, a) {
      let o = ripples[0];
      for (const r of ripples) {
        if (!r.on) {
          o = r;
          break;
        }
        if (r.t > o.t) o = r;
      }
      o.on = true;
      o.x = x;
      o.t = 0;
      o.a = a;
    }
    function ink(x, y) {
      let o = inks[0];
      for (const k of inks) {
        if (!k.on) {
          o = k;
          break;
        }
        if (k.t > o.t) o = k;
      }
      o.on = true;
      o.x = x;
      o.y = y;
      o.t = 0;
      o.c = Math.min(3, Math.floor((arrived / GOAL) * 4));
    }

    function land(a) {
      a.st = 6;
      a.t = 0;
      a.y = surfY(a.x) + 0.015;
      a.vx = a.vx * 0.3 + rand(-0.12, 0.12);
      a.vy = 0.3;
      /* sa place dans l'océan : une spirale qui remplit le bas du ballon */
      const slot = arrived % 16;
      const hr = 0.07 + 0.29 * Math.sqrt((slot + 0.5) / 16), th = 0.25 + ((slot * 0.618034) % 1) * (Math.PI - 0.5);
      a.hx = Math.cos(th) * hr;
      a.hy = 0.04 + Math.sin(th) * hr * 0.9;
      a.ang = rand(TAU);
      a.va = rand(-0.6, 0.6);
      a.gl = 0.9;
      ripple(a.x, 0.016);
      ink(a.x, a.y + 0.07);
      for (let i = 0; i < 8; i++) spark(a.x + rand(-0.02, 0.02), a.y - 0.01, rand(-0.3, 0.3), rand(-0.95, -0.4), rand(0.25, 0.42), 3, 3.4);
      api.sfx.play('bubble', { pitch: rand(0.85, 1.2), volume: 0.8, gap: 60 });
      arrived++;
      if (!finished) {
        api.status(fill(TEXTES.compteur, Math.min(arrived, GOAL)));
        api.progress(Math.min(1, arrived / GOAL));
        if (arrived >= GOAL) finish();
      }
      /* pas trop de chaînes à la fois dans l'océan : la plus ancienne s'efface */
      let nSea = 0, old = null;
      for (const o of aminos) {
        if (!o.on || o.st !== 6) continue;
        nSea++;
        if (!old || o.born < old.born) old = o;
      }
      if (nSea > 16 && old) old.st = 7;
    }

    function finish() {
      finished = true;
      finT = 0;
      api.done(TEXTES.fin, TEXTES.finStatut);
      api.guide(null, 'laugh', TEXTES.bravo);
      laughPending = false;
      laughEnd = 0;
      gestureType = null;
      api.gesture(null);
      if (!RMo) victory = [0.35, 0.75, 1.2];
    }

    /* ================= animation ================= */
    function ambientStep(dt) {
      if (!geo.ready) return;
      const sp = RMo ? 0.4 : 1;
      /* les gaz flottent et tournent lentement dans le grand ballon */
      for (let i = 0; i < N_GAS; i++) {
        const m = gas[i];
        if (m.st === 2) {
          m.t -= dt;
          if (m.t <= 0) {
            placeGas(m, Math.random() < 0.4);
            m.st = 3;
            m.k = 0;
          }
          continue;
        }
        if (m.st === 3) {
          m.k += dt * 1.2;
          if (m.k >= 1) {
            m.k = 1;
            m.st = 0;
          }
        }
        m.vx += ((Math.random() - 0.5) * 0.9 - m.y * 0.06) * dt * sp;
        m.vy += ((Math.random() - 0.5) * 0.9 + m.x * 0.06) * dt * sp;
        const dr = Math.exp(-dt * 0.9);
        m.vx *= dr;
        m.vy *= dr;
        m.va *= Math.exp(-dt * 0.5);
        m.va += (Math.random() - 0.5) * dt * 0.8;
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        m.a += m.va * dt * sp;
        const r = Math.hypot(m.x, m.y);
        if (r > 0.84) {
          const nx = m.x / r, ny = m.y / r;
          m.x = nx * 0.84;
          m.y = ny * 0.84;
          const vr = m.vx * nx + m.vy * ny;
          if (vr > 0) {
            m.vx -= 1.6 * vr * nx;
            m.vy -= 1.6 * vr * ny;
          }
        }
      }
      /* comme un gaz, les molécules se repoussent doucement et occupent tout le ballon */
      for (let i = 0; i < N_GAS; i++) {
        const a = gas[i];
        if (a.st === 2) continue;
        for (let j = i + 1; j < N_GAS; j++) {
          const b = gas[j];
          if (b.st === 2) continue;
          const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
          if (d2 > 0.04 || d2 < 1e-8) continue;
          const d = Math.sqrt(d2), f = ((0.2 - d) * 1.4 * dt) / d;
          a.vx -= dx * f;
          a.vy -= dy * f;
          b.vx += dx * f;
          b.vy += dy * f;
        }
      }
      /* la vapeur monte de l'océan */
      puffAcc += dt * (RMo ? 3.5 : 6.5);
      while (puffAcc >= 1) {
        puffAcc -= 1;
        for (const p of puffs) {
          if (p.on) continue;
          p.on = true;
          p.s = 0;
          p.v = rand(0.3, 0.45);
          p.o = rand(-1, 1);
          p.ph = rand(TAU);
          p.r = rand(0.032, 0.048);
          p.a = rand(0.16, 0.28);
          p.free = false;
          p.t = 0;
          break;
        }
      }
      const neck = geo.c2y - R2;
      for (const p of puffs) {
        if (!p.on) continue;
        p.t += dt;
        if (!p.free) {
          p.s += p.v * dt;
          if (p.s >= vaporPath.L) {
            p.free = true;
            p.t = 0;
            pathAt(vaporPath, vaporPath.L, Q);
            p.x = Q.x;
            p.y = Q.y;
            p.vx = rand(-0.04, 0.14);
            p.vy = -p.v * 0.7;
          } else {
            pathAt(vaporPath, p.s, Q);
            const amp = lerp(TUBE * 0.2, 0.15, sstep(neck - 0.02, geo.ws - 0.04, Q.y));
            const o = p.o * amp + Math.sin(p.ph + time * 3) * amp * 0.2;
            p.x = Q.x - Q.ty * o;
            p.y = Q.y + Q.tx * o;
            p.rr = p.r;
            p.al = p.a * Math.min(1, p.t * 3);
          }
        } else {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vx *= Math.exp(-dt * 0.7);
          p.vy *= Math.exp(-dt * 0.8);
          p.rr = p.r + p.t * 0.06;
          p.al = p.a * (1 - p.t / 1.5);
          if (p.t > 1.5) p.on = false;
        }
      }
      /* l'eau bout doucement */
      bubbleAcc += dt * (RMo ? 2 : 4.5);
      while (bubbleAcc >= 1) {
        bubbleAcc -= 1;
        for (const b of bubbles) {
          if (b.on) continue;
          b.on = true;
          b.x = XV + rand(-0.2, 0.2);
          b.y = geo.c2y + R2 - 0.07;
          b.vy = -rand(0.06, 0.12);
          b.r = rand(0.005, 0.009);
          b.ph = rand(TAU);
          break;
        }
      }
      for (const b of bubbles) {
        if (!b.on) continue;
        b.vy -= 0.22 * dt;
        b.y += b.vy * dt;
        b.ph += dt * 9;
        b.x += Math.sin(b.ph) * 0.05 * dt;
        b.r = Math.min(b.r + dt * 0.006, 0.016);
        if (b.y - b.r <= surfY(b.x)) {
          b.on = false;
          ripple(b.x, 0.0035 * WAVE);
        }
      }
      /* des gouttelettes d'eau redescendent par le tube refroidi */
      for (const dw of dews) {
        if (!dw.on) continue;
        if (dw.st === 0) {
          const idx = Math.min(dropPath.n - 1, Math.round(dw.s / dropPath.ds));
          dw.s += TUBE_V * 0.8 * dropFac[idx] * dt;
          pathAt(dropPath, dw.s, Q);
          dw.x = Q.x;
          dw.y = Q.y;
          dw.ang = Math.atan2(Q.ty, Q.tx);
          if (dw.s >= dropPath.L) {
            dw.st = 1;
            dw.vx = Q.tx * 0.2;
            dw.vy = Q.ty * 0.4;
          }
        } else {
          dw.vy += 3.6 * dt;
          dw.x += dw.vx * dt;
          dw.y += dw.vy * dt;
          dw.ang = Math.atan2(dw.vy, dw.vx);
          if (dw.y >= surfY(dw.x)) {
            dw.on = false;
            ripple(dw.x, 0.005);
          }
        }
      }
      dewT -= dt;
      if (dewT <= 0) {
        dewT = rand(1.4, 2.6) * (RMo ? 1.6 : 1);
        for (const dw of dews) {
          if (dw.on) continue;
          dw.on = true;
          dw.st = 0;
          dw.s = geo.sJ + rand(0, 0.12);
          break;
        }
      }
      for (const r of ripples) if (r.on && (r.t += dt) > 1.5) r.on = false;
      for (const k of inks) if (k.on && (k.t += dt) > 2.6) k.on = false;
    }

    function tubeFree() {
      return !tubeQ.length || tubeQ[tubeQ.length - 1].s > GAP + 0.02;
    }
    function enterTube(a) {
      a.st = 4;
      a.s = 0;
      tubeQ.push(a);
    }

    function updateAminos(dt) {
      for (const a of aminos) {
        if (!a.on) continue;
        a.t += dt;
        if (a.st === 1) {
          a.ang += a.va * dt * 0.3;
          if (a.t >= FORM) {
            a.st = 2;
            a.t = 0;
            a.vx = rand(-0.05, 0.05);
            a.vy = rand(-0.08, 0);
          }
        } else if (a.st === 2 || a.st === 3) {
          a.ang += a.va * dt;
          a.va *= Math.exp(-dt * 0.5);
          a.gl += (0.4 - a.gl) * Math.min(1, dt * 1.6);
          const dx = geo.ex - a.x, dy = geo.ey - a.y, d = Math.hypot(dx, dy) || 1;
          if (a.st === 2) {
            const sp = FLOAT_V * Math.min(1, 0.3 + a.t * 1.2);
            const k = Math.min(1, dt * 2.4);
            a.vx += ((dx / d) * sp - a.vx) * k;
            a.vy += ((dy / d) * sp - a.vy) * k;
            a.x += a.vx * dt + Math.sin(time * 2.3 + a.born * 3) * 0.03 * dt;
            a.y += a.vy * dt;
            if (d < 0.07) {
              if (tubeFree()) enterTube(a);
              else a.st = 3;
            }
          } else {
            const k = Math.min(1, dt * 3);
            a.x += (geo.ex - 0.1 - 0.05 * Math.cos(time * 2.6 + a.born) - a.x) * k;
            a.y += (geo.ey - 0.12 + 0.04 * Math.sin(time * 2.6 + a.born) - a.y) * k;
            if (tubeFree()) enterTube(a);
          }
          const r = Math.hypot(a.x, a.y);
          if (r > 0.84) {
            a.x *= 0.84 / r;
            a.y *= 0.84 / r;
          }
        } else if (a.st === 5) {
          a.vy += 3.6 * dt;
          a.x += a.vx * dt;
          a.y += a.vy * dt;
          a.ang = Math.atan2(a.vy, a.vx);
          if (a.y >= surfY(a.x)) land(a);
        } else if (a.st === 6 || a.st === 7) {
          /* l'acide aminé dérive dans l'eau */
          if (a.st === 7) {
            a.fade -= dt * 0.8;
            if (a.fade <= 0) a.on = false;
          }
          /* chacun gagne sa place dans l'eau et s'y balance doucement : ils se répartissent
             dans tout l'océan au lieu de s'entasser */
          const hx = XV + a.hx + Math.sin(time * 0.7 + a.born * 2) * 0.03;
          const hy = geo.c2y + a.hy + Math.cos(time * 0.55 + a.born * 3) * 0.025;
          const kf = Math.min(1, dt * (a.t < 0.6 ? 0.6 : 1.6));
          a.vx += ((hx - a.x) * 1.1 - a.vx) * kf;
          a.vy += ((hy - a.y) * 1.1 - a.vy) * kf;
          a.x += a.vx * dt;
          a.y += a.vy * dt;
          a.ang += a.va * dt * 0.3;
          a.gl += ((finished ? 0.28 : 0.16) - a.gl) * Math.min(1, dt * 0.8);
          const dx = a.x - XV, dy = a.y - geo.c2y, r = Math.hypot(dx, dy), lim = R2 * 0.76;
          if (r > lim) {
            a.x = XV + (dx * lim) / r;
            a.y = geo.c2y + (dy * lim) / r;
            a.vx *= -0.5;
            a.vy *= -0.5;
          }
          if (a.y < geo.ws + 0.08) {
            a.y = geo.ws + 0.08;
            a.vy = Math.abs(a.vy);
          }
        }
      }
      /* dans le tube refroidi : chacun son tour, en file */
      for (let i = 0; i < tubeQ.length; i++) {
        const a = tubeQ[i];
        const idx = Math.min(dropPath.n - 1, Math.round(a.s / dropPath.ds));
        const v = TUBE_V * dropFac[idx];
        a.s += v * dt;
        if (i > 0) a.s = Math.min(a.s, tubeQ[i - 1].s - GAP);
        pathAt(dropPath, a.s, Q);
        a.x = Q.x;
        a.y = Q.y;
        a.ang = Math.atan2(Q.ty, Q.tx);
        a.gl += (0.6 - a.gl) * Math.min(1, dt * 2);
        if (a.s >= dropPath.L) {
          a.st = 5;
          a.vx = Q.tx * v * 0.5;
          a.vy = Q.ty * v * 0.6;
          tubeQ.splice(i, 1);
          i--;
        }
      }
    }

    function update(dt) {
      time += dt;
      if (!geo.ready) return;
      ambientStep(dt);
      /* orage : le doigt reste appuyé */
      if (holdP && presses.size) {
        if (time - holdP.t0 > HOLD_T) {
          if (!storming) {
            storming = true;
            stormUsed = true;
            stormAcc = 0;
            stormNext = 0;
          }
          stormAcc += dt;
          if (stormAcc >= stormNext) {
            stormAcc = 0;
            stormNext = rand(0.17, 0.27) * (RMo ? 1.5 : 1);
            const ux = (holdP.x - geo.ox) / geo.U, uy = (holdP.y - geo.oy) / geo.U;
            /* l'orage se répand autour du doigt, dans tout le gaz voisin */
            const ja = rand(TAU), jr = rand(0.1, 0.5);
            fire(ux + Math.cos(ja) * jr, uy + Math.sin(ja) * jr, STORM);
          }
        }
      } else {
        storming = false;
      }
      /* crépitements entre les pointes et éclairs lointains */
      if (!RMo) {
        crackleT -= dt;
        if (crackleT <= 0) {
          crackleT = boltsN ? rand(3, 6) : rand(1.3, 2.3);
          spawnMini(Math.random() < 0.5 ? -1 : 1);
          if (Math.random() < 0.4) spawnMini(Math.random() < 0.5 ? -1 : 1);
        }
        ambNext -= dt;
        if (ambNext <= 0) {
          ambNext = rand(4.5, 9);
          spawnAmb();
        }
        ambT += dt;
        ambI = 0;
        if (ambN) {
          ambI = 0.42 * Math.min(1, ambT / 0.05) * Math.exp(-Math.max(0, ambT - 0.05) * 5);
        }
      }
      /* les éclairs vivent, scintillent et s'éteignent */
      for (const b of bolts) {
        if (!b.on) continue;
        b.t += dt;
        while (b.next < b.ns && b.t >= b.strikes[b.next]) {
          if (b.kind !== MINI) {
            /* les grandes lueurs (nuages, verre, halo) ne flashent qu'à la première décharge,
               et pas plus d'une fois toutes les 0,4 s : seul le fin tracé de l'éclair scintille */
            if (b.next === 0 && time - bigT >= 0.4) {
              flash = Math.min(1.2, flash + 0.9 * FLASH * (b.kind === STORM ? 0.75 : 1));
              bigT = time;
              fx = b.mx;
              fy = b.my;
            }
            if (b.next > 0) api.sfx.play('crack', { pitch: rand(1.1, 1.4), volume: 0.45, gap: 30 });
          }
          b.next++;
        }
        let I = 0;
        for (let k = 0; k < b.next; k++) I = Math.max(I, b.peaks[k] * Math.exp(-(b.t - b.strikes[k]) * DEC));
        b.I = I;
        b.Is = b.peaks[0] * Math.exp(-b.t * 4.5);
        b.G = b.kind === MINI ? 0 : 0.5 * Math.exp(-b.t * 3.2) * (1 - Math.exp(-b.t * 30));
        if (b.t > b.life) b.on = false;
      }
      flash *= Math.exp(-dt * 6);
      /* pendant l'orage, une lueur soutenue plutôt qu'un stroboscope */
      glowL += ((storming ? 0.4 : 0) - glowL) * Math.min(1, dt * 2.5);
      wireT += dt;
      updateAminos(dt);
      for (const s of sparks) {
        if (!s.on) continue;
        s.t += dt;
        if (s.t >= s.life) {
          s.on = false;
          continue;
        }
        s.vy += s.g * dt;
        const dr = Math.exp(-dt * 2.2);
        s.vx *= dr;
        s.vy *= dr;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
      }
      for (const r of rings) if (r.on && (r.t += dt) > 0.5) r.on = false;
      shownTint += (Math.min(1, arrived / GOAL) - shownTint) * Math.min(1, dt * 1.2);
      /* consignes et visage du guide */
      if (!finished) {
        if (hintStage >= 1 && hintStage < 3 && made >= GOAL) {
          /* assez de briques : il n'y a plus qu'à les regarder descendre jusqu'à l'eau */
          hintStage = 3;
          api.hint(TEXTES.attente);
          if (gestureType) {
            gestureType = null;
            api.gesture(null);
          }
        } else if (hintStage === 1 && ((boltsN >= 3 && arrived >= 1) || boltsN >= 4)) {
          hintStage = 2;
          api.hint(TEXTES.orage);
          if (!stormUsed && !presses.size) {
            gestureType = 'hold';
            placeGesture();
          }
        }
        if (laughPending && time - lastDown > 0.95) {
          laughPending = false;
          api.guide(null, 'laugh', TEXTES.bravo);
          laughEnd = time + 2.4;
        }
        if (laughEnd && time > laughEnd) {
          laughEnd = 0;
          api.guide(null, 'smile', TEXTES.aToi);
        }
      } else {
        finT += dt;
        if (victory.length && finT >= victory[0]) {
          victory.shift();
          fire(rand(-0.55, 0.55), rand(-0.5, 0.35), VICTORY);
        }
      }
    }

    function spawnAmb() {
      const w = geo.w, h = geo.h;
      const left = Math.random() < 0.5;
      const x0 = (left ? rand(0.03, 0.17) : rand(0.83, 0.97)) * w, y0 = rand(0.04, 0.12) * h;
      const x1 = x0 + rand(-0.05, 0.05) * w, y1 = y0 + rand(0.16, 0.28) * h;
      jag(ambPts, 0, x0, y0, x1, y1, 4, 0.22);
      const j = 4 + Math.floor(Math.random() * 7);
      const bx = ambPts[j * 2], by = ambPts[j * 2 + 1];
      jag(ambPts, 17, bx, by, bx + rand(-0.06, 0.06) * w, by + rand(0.05, 0.1) * h, 3, 0.25);
      ambN = 26;
      ambT = 0;
    }

    /* ================= dessin ================= */
    function addPoly(g, Pt, s, n) {
      g.moveTo(Pt[s * 2], Pt[s * 2 + 1]);
      for (let i = 1; i < n; i++) g.lineTo(Pt[(s + i) * 2], Pt[(s + i) * 2 + 1]);
    }
    function addBranches(g, b, cls, half) {
      for (let k = 0; k < b.nb; k++) {
        const s = b.br[k * 3], n = b.br[k * 3 + 1], c = b.br[k * 3 + 2];
        if (cls >= 0 && c !== cls) continue;
        if (half === 1) addPoly(g, b.pts, s, (n >> 1) + 1);
        else if (half === 2) addPoly(g, b.pts, s + (n >> 1), n - (n >> 1));
        else addPoly(g, b.pts, s, n);
      }
    }

    function drawAmbBolt() {
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = C.blue;
      ctx.globalAlpha = ambI * 0.35;
      ctx.lineWidth = 4;
      ctx.beginPath();
      addPoly(ctx, ambPts, 0, 17);
      addPoly(ctx, ambPts, 17, 9);
      ctx.stroke();
      ctx.strokeStyle = '#FFFFFF';
      ctx.globalAlpha = Math.min(1, ambI * 1.3);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    function drawWirePulses() {
      if (wireT > 0.28) return;
      const k = wireT / 0.28;
      ctx.globalCompositeOperation = 'lighter';
      for (let side = 0; side < 2; side++) {
        bez(side ? geo.wireR : geo.wireL, 1 - k, Q);
        ctx.globalAlpha = 0.9 * (1 - k * 0.4);
        drawSpr(SPR.yellow, Q.x, Q.y, 0.1);
        drawSpr(SPR.white, Q.x, Q.y, 0.035);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    function drawJacketFlow() {
      const x0 = XC - JW / 2, hh = geo.j1 - geo.j0;
      ctx.save();
      draw.roundRect(ctx, x0, geo.j0, JW, hh, JW * 0.42);
      ctx.clip();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        const f = (time * (RMo ? 0.03 : 0.09) + i / 4) % 1;
        const y = geo.j1 + 0.16 - f * (hh + 0.32);
        const x = XC + (i % 2 ? 0.075 : -0.085);
        ctx.globalAlpha = 0.2 * Math.sin(Math.PI * f);
        ctx.drawImage(SPR.cold, x - 0.05, y - 0.16, 0.1, 0.32);
      }
      ctx.restore();
    }

    function drawFlame() {
      const yb = geo.c2y + R2 + 0.13, yt = geo.c2y + R2 - 0.004;
      const n1 = nz.noise2(time * 5.5, 0.3), n2 = nz.noise2(time * 8.3, 4.1);
      const H = (yb - yt) * (0.84 + 0.2 * n1);
      const sway = (n2 - 0.5) * 0.035 * (RMo ? 0.3 : 1);
      const x = XV, top = yb - H;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5 + 0.2 * n1;
      drawSpr(SPR.fire, x, yb - H * 0.45, 0.3);
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(x - 0.036, yb);
      ctx.bezierCurveTo(x - 0.05, yb - H * 0.5, x - 0.012 + sway * 0.4, yb - H * 0.8, x + sway, top);
      ctx.bezierCurveTo(x + 0.012 + sway * 0.4, yb - H * 0.8, x + 0.05, yb - H * 0.5, x + 0.036, yb);
      ctx.closePath();
      ctx.fillStyle = flameGrad;
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - 0.022, yb);
      ctx.bezierCurveTo(x - 0.026, yb - H * 0.3, x - 0.006, yb - H * 0.5, x + sway * 0.3, yb - H * 0.58);
      ctx.bezierCurveTo(x + 0.006, yb - H * 0.5, x + 0.026, yb - H * 0.3, x + 0.022, yb);
      ctx.closePath();
      ctx.fillStyle = coreGrad;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    function beadPos(a, j, br) {
      const lx = (j - (a.n - 1) / 2) * br * 2.05, ly = (j & 1 ? 1 : -1) * br * 0.5;
      const c = Math.cos(a.ang), s = Math.sin(a.ang);
      P.x = a.x + lx * c - ly * s;
      P.y = a.y + lx * s + ly * c;
      return P;
    }
    function drawChain(a, br, alpha, glow) {
      if (glow > 0.01) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = Math.min(1, glow * alpha);
        drawSpr(SPR.warm, a.x, a.y, br * (a.n + 2.5) * 1.5);
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.globalAlpha = alpha * 0.8;
      ctx.strokeStyle = '#FFF4DE';
      ctx.lineWidth = br * 0.42;
      ctx.beginPath();
      for (let j = 0; j < a.n; j++) {
        beadPos(a, j, br);
        if (j) ctx.lineTo(P.x, P.y);
        else ctx.moveTo(P.x, P.y);
      }
      ctx.stroke();
      ctx.globalAlpha = alpha;
      const s = br * 1.3;
      for (let j = 0; j < a.n; j++) {
        beadPos(a, j, br);
        ctx.drawImage(beadSpr[a.c[j]], P.x - s, P.y - s, s * 2, s * 2);
      }
      ctx.globalAlpha = 1;
    }
    function drawForming(a) {
      const k = clamp(a.t / FORM), e = ease.outCubic(k);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5 * (1 - k * 0.4);
      drawSpr(SPR.warm, a.x, a.y, BR * 8);
      ctx.globalCompositeOperation = 'source-over';
      if (k > 0.55) {
        ctx.globalAlpha = ((k - 0.55) / 0.45) * 0.8;
        ctx.strokeStyle = '#FFF4DE';
        ctx.lineWidth = BR * 0.42;
        ctx.beginPath();
        for (let j = 0; j < a.n; j++) {
          beadPos(a, j, BR);
          const x = lerp(a.sx[j], P.x, e), y = lerp(a.sy[j], P.y, e);
          if (j) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
      for (let j = 0; j < a.n; j++) {
        beadPos(a, j, BR);
        const x = lerp(a.sx[j], P.x, e), y = lerp(a.sy[j], P.y, e);
        if (a.gt[j] >= 0) {
          ctx.globalAlpha = (1 - k) * (1 - k);
          ctx.drawImage(gasSpr[a.gt[j]], x - SG / 2, y - SG / 2, SG, SG);
        }
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = (1 - k) * 0.95;
        drawSpr(SPR.white, x, y, 0.07);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = Math.min(1, k * 1.7);
        const s = BR * 1.3 * (0.5 + 0.5 * e);
        ctx.drawImage(beadSpr[a.c[j]], x - s, y - s, s * 2, s * 2);
      }
      ctx.globalAlpha = 1;
    }

    function drawGas() {
      const k = cv.dpr * geo.U, d = cv.dpr;
      for (let i = 0; i < N_GAS; i++) {
        const m = gas[i];
        if (m.st === 2 || m.k <= 0.01) continue;
        const c = Math.cos(m.a) * k, s = Math.sin(m.a) * k;
        ctx.setTransform(c, s, -s, c, d * (geo.ox + m.x * geo.U), d * (geo.oy + m.y * geo.U));
        ctx.globalAlpha = m.k * 0.92;
        ctx.drawImage(gasSpr[m.type], -SG / 2, -SG / 2, SG, SG);
      }
      ctx.globalAlpha = 1;
      unitsOn(ctx, d);
    }

    function drawTips() {
      let I = 0;
      for (const b of bolts) if (b.on) I = Math.max(I, b.I * (b.kind === MINI ? 0.5 : 1));
      const idle = RMo ? 0.24 : 0.2 + 0.08 * Math.sin(time * 2.6);
      ctx.globalCompositeOperation = 'lighter';
      for (let s = -1; s <= 1; s += 2) {
        ctx.globalAlpha = Math.min(1, idle + I * 0.8);
        drawSpr(SPR.blue, s * TIP, EY, 0.11 + I * 0.08);
        if (I > 0.05) {
          ctx.globalAlpha = Math.min(1, I);
          drawSpr(SPR.white, s * TIP, EY, 0.05);
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    /* deux passes nettes (jaune, puis cœur blanc) ; le halo bleu vient du calque flou */
    const PASSES = [[4.8, 0.55], [2, 1]];
    function drawBolts() {
      let any = false;
      for (const b of bolts) if (b.on) any = true;
      if (!any) return;
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const PX = geo.PX;
      for (const b of bolts) {
        if (!b.on) continue;
        const mini = b.kind === MINI;
        if (b.G > 0.03) {
          ctx.globalAlpha = b.G * 0.55;
          ctx.strokeStyle = '#B6A8FF';
          ctx.lineWidth = 2.4 * PX;
          ctx.beginPath();
          addPoly(ctx, b.pts, 0, b.mainN);
          ctx.stroke();
        }
        const I = b.I;
        if (I < 0.03) continue;
        const bf = 0.55 + 0.45 * Math.exp(-b.t * 7);
        for (let p = 0; p < 2; p++) {
          ctx.strokeStyle = p === 0 ? C.yellow : '#FFFFFF';
          const W = PASSES[p][0] * PX * b.w * (mini ? 0.45 : 1);
          ctx.globalAlpha = Math.min(1, PASSES[p][1] * I);
          ctx.lineWidth = W;
          ctx.beginPath();
          addPoly(ctx, b.pts, 0, b.mainN);
          ctx.stroke();
          if (b.nb) {
            ctx.globalAlpha = Math.min(1, PASSES[p][1] * I * bf);
            ctx.lineWidth = W * 0.6;
            ctx.beginPath();
            addBranches(ctx, b, 1, 1);
            ctx.stroke();
            ctx.lineWidth = W * 0.36;
            ctx.beginPath();
            addBranches(ctx, b, 1, 2);
            addBranches(ctx, b, 2, 0);
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    function drawSparks() {
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      ctx.lineWidth = 1.4 * geo.PX;
      for (let c = 0; c < 4; c++) {
        ctx.strokeStyle = c === 0 ? '#FFFFFF' : c === 1 ? C.yellow : c === 2 ? C.blue : '#E4F2FF';
        for (let q = 0; q < 3; q++) {
          let any = false;
          ctx.beginPath();
          for (const s of sparks) {
            if (!s.on || s.c !== c) continue;
            const f = s.t / s.life;
            if ((f < 0.33 ? 0 : f < 0.66 ? 1 : 2) !== q) continue;
            ctx.moveTo(s.x, s.y);
            ctx.lineTo(s.x - s.vx * 0.025, s.y - s.vy * 0.025);
            any = true;
          }
          if (!any) continue;
          ctx.globalAlpha = q === 0 ? 1 : q === 1 ? 0.6 : 0.28;
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    function drawVapor() {
      ctx.globalCompositeOperation = 'lighter';
      for (const p of puffs) {
        if (!p.on || p.al <= 0.005) continue;
        ctx.globalAlpha = p.al;
        drawSpr(SPR.steam, p.x, p.y, p.rr * 2.2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    function drawDrops() {
      const ry = TUBE / 2 - geo.rim - 0.008;
      for (const dw of dews) {
        if (!dw.on) continue;
        ctx.fillStyle = 'rgba(215,236,255,0.32)';
        ctx.beginPath();
        ctx.ellipse(dw.x, dw.y, 0.03, Math.min(ry, 0.024), dw.ang, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath();
        ctx.arc(dw.x - 0.008, dw.y - 0.008, 0.006, 0, TAU);
        ctx.fill();
      }
      for (const a of aminos) {
        if (!a.on || (a.st !== 4 && a.st !== 5)) continue;
        const fall = a.st === 5;
        /* la goutte brille et laisse une courte traînée */
        ctx.globalCompositeOperation = 'lighter';
        if (!fall) {
          for (let k = 1; k <= 3; k++) {
            pathAt(dropPath, Math.max(0, a.s - k * 0.05), Q);
            ctx.globalAlpha = 0.3 / k;
            drawSpr(SPR.warm, Q.x, Q.y, 0.055);
          }
        }
        ctx.globalAlpha = 0.55;
        drawSpr(SPR.warm, a.x, a.y, 0.13);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(247,186,206,0.45)';
        ctx.beginPath();
        ctx.ellipse(a.x, a.y, fall ? 0.052 : 0.064, fall ? 0.038 : ry, a.ang, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,236,244,0.65)';
        ctx.lineWidth = 0.9 * geo.PX;
        ctx.stroke();
        drawChain(a, 0.019, 1, 0);
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath();
        ctx.arc(a.x - 0.017, a.y - 0.017, 0.007, 0, TAU);
        ctx.fill();
      }
    }

    function drawLiquid() {
      const cx = XV, cy = geo.c2y, ri = R2 - geo.rim * 0.9, ws = geo.ws;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, ri, 0, TAU);
      ctx.clip();
      const half = Math.sqrt(Math.max(0, ri * ri - (ws - cy) * (ws - cy)));
      const xl = cx - half, xr = cx + half;
      const N = 32;
      for (let i = 0; i <= N; i++) {
        const x = lerp(xl - 0.01, xr + 0.01, i / N);
        const dw = Math.max(0, Math.min(x - xl, xr - x));
        SX[i] = x;
        SY[i] = surfY(x) - 0.03 * Math.exp(-dw / 0.03);
      }
      const key = Math.round(shownTint * 200);
      if (key !== liqKey) {
        liqKey = key;
        const k = shownTint;
        liqGrad = ctx.createLinearGradient(0, ws - 0.03, 0, cy + R2);
        liqGrad.addColorStop(0, lib.ramp(TINT, k, lerp(0.26, 0.72, k)));
        liqGrad.addColorStop(1, lib.ramp(TINT, Math.min(1, k + 0.1), lerp(0.38, 0.93, k)));
      }
      ctx.beginPath();
      ctx.moveTo(SX[0], SY[0]);
      for (let i = 1; i <= N; i++) ctx.lineTo(SX[i], SY[i]);
      ctx.lineTo(xr + 0.05, cy + R2 + 0.05);
      ctx.lineTo(xl - 0.05, cy + R2 + 0.05);
      ctx.closePath();
      ctx.fillStyle = liqGrad;
      ctx.fill();
      /* la couleur d'un acide aminé qui arrive se diffuse dans l'eau */
      for (const k of inks) {
        if (!k.on) continue;
        const f = k.t / 2.6;
        ctx.globalAlpha = 0.65 * Math.sin(Math.PI * Math.min(1, f * 1.4)) * (1 - f);
        drawSpr(inkSpr[k.c], k.x, k.y + f * 0.08, lerp(0.06, 0.34, ease.outCubic(f)));
      }
      ctx.globalAlpha = 1;
      /* l'eau se trouble */
      const turb = sstep(0.35, 1, shownTint);
      if (turb > 0.01) {
        for (let i = 0; i < specks.length; i++) {
          const p = specks[i];
          const x = cx + p.x + Math.sin(time * p.f + p.ph) * 0.025;
          const y = cy + p.y + Math.cos(time * p.f * 0.8 + p.ph) * 0.018;
          if (y < ws + 0.02) continue;
          ctx.globalAlpha = turb * p.al;
          ctx.fillStyle = p.c ? '#FFC9D4' : '#3A0812';
          ctx.fillRect(x - p.s / 2, y - p.s / 2, p.s, p.s);
        }
        ctx.globalAlpha = 1;
      }
      /* la chaleur du brûleur, par en dessous */
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.2 + 0.06 * Math.sin(time * 7);
      drawSpr(SPR.fire, cx, cy + R2 * 1.05, R2 * 0.9);
      if (finished) {
        ctx.globalAlpha = 0.1 + 0.06 * Math.sin(finT * 2.4);
        drawSpr(SPR.fire, cx, cy + 0.12, R2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      for (const a of aminos) if (a.on && (a.st === 6 || a.st === 7)) drawChain(a, BR * 0.52, 0.95 * a.fade, a.gl * 0.6);
      ctx.beginPath();
      for (const b of bubbles) {
        if (!b.on) continue;
        ctx.moveTo(b.x + b.r, b.y);
        ctx.arc(b.x, b.y, b.r, 0, TAU);
      }
      ctx.strokeStyle = 'rgba(235,245,255,0.55)';
      ctx.lineWidth = 0.9 * geo.PX;
      ctx.stroke();
      ctx.beginPath();
      for (const b of bubbles) {
        if (!b.on) continue;
        ctx.moveTo(b.x - b.r * 0.3 + b.r * 0.32, b.y - b.r * 0.35);
        ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.35, b.r * 0.32, 0, TAU);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fill();
      /* surface : un filet de lumière qui remonte le long du verre (le ménisque) */
      ctx.beginPath();
      ctx.moveTo(SX[0], SY[0]);
      for (let i = 1; i <= N; i++) ctx.lineTo(SX[i], SY[i]);
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 1.2 * geo.PX;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(20,16,50,0.25)';
      ctx.lineWidth = 1 * geo.PX;
      ctx.translate(0, 2.2 * geo.PX);
      ctx.stroke();
      ctx.restore();
    }

    function drawAminos() {
      for (const a of aminos) {
        if (!a.on) continue;
        if (a.st === 1) drawForming(a);
        else if (a.st === 2 || a.st === 3) drawChain(a, BR, 1, a.gl * (0.8 + 0.2 * Math.sin(time * 4 + a.born * 5)));
      }
    }

    function drawRings() {
      ctx.lineWidth = 2 * geo.PX;
      ctx.strokeStyle = C.yellow;
      for (const r of rings) {
        if (!r.on) continue;
        const k = r.t / 0.5;
        ctx.globalAlpha = 0.8 * (1 - k);
        ctx.beginPath();
        ctx.arc(r.x, r.y, lerp(0.04, 0.24, ease.outCubic(k)), 0, TAU);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    function drawBloom() {
      let any = flash > 0.02;
      for (const b of bolts) if (b.on) any = true;
      if (!any) return;
      for (let pass = 0; pass < 2; pass++) {
        const c = pass ? bloomB : bloomA;
        const kx = c.width / geo.bw, ky = c.height / geo.bh;
        const g = c.getContext('2d');
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = 1;
        g.clearRect(0, 0, c.width, c.height);
        g.setTransform(kx * geo.U, 0, 0, ky * geo.U, kx * (geo.ox - geo.bx), ky * (geo.oy - geo.by));
        g.globalCompositeOperation = 'lighter';
        g.lineCap = 'round';
        g.lineJoin = 'round';
        for (const b of bolts) {
          if (!b.on) continue;
          const mini = b.kind === MINI;
          const I = Math.min(b.I, b.Is) * (mini ? 0.6 : 1);
          if (I > 0.03) {
            const al = Math.min(1, I * (pass ? 0.36 : 0.6));
            g.strokeStyle = pass ? '#9C8CFF' : C.blue;
            g.lineWidth = (pass ? 20 : 8) * geo.PX * b.w * (mini ? 0.4 : 1);
            g.globalAlpha = al;
            g.beginPath();
            addPoly(g, b.pts, 0, b.mainN);
            g.stroke();
            if (b.nb) {
              g.globalAlpha = al * 0.55;
              g.lineWidth *= 0.6;
              g.beginPath();
              addBranches(g, b, -1, 0);
              g.stroke();
            }
          }
          if (b.G > 0.03 && pass === 1) {
            g.globalAlpha = b.G * 0.45;
            g.strokeStyle = '#A493FF';
            g.lineWidth = 12 * geo.PX;
            g.beginPath();
            addPoly(g, b.pts, 0, b.mainN);
            g.stroke();
          }
        }
        if (flash > 0.02 && pass === 1) {
          g.globalAlpha = Math.min(1, flash) * 0.25;
          g.drawImage(SPR.blue, fx - 0.45, fy - 0.45, 0.9, 0.9);
        }
        g.globalAlpha = 1;
      }
      pxOn(ctx, cv.dpr);
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(bloomA, geo.bx, geo.by, geo.bw, geo.bh);
      ctx.drawImage(bloomB, geo.bx, geo.by, geo.bw, geo.bh);
      ctx.globalCompositeOperation = 'source-over';
    }

    function render() {
      if (!geo.ready || !bg) return;
      const d = cv.dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, cv.canvas.width, cv.canvas.height);
      /* les nuages s'illuminent : on ne change que l'opacité de leur calque */
      const cl = Math.round(Math.min(1, flash * 1.05 + ambI * 1.3 + glowL * FLASH) * 50) / 50;
      if (cl !== litShown) {
        litShown = cl;
        cvLit.canvas.style.opacity = String(cl);
      }
      pxOn(ctx, d);
      if (ambI > 0.02 && ambN) drawAmbBolt();
      unitsOn(ctx, d);
      drawWirePulses();
      drawJacketFlow();
      drawFlame();
      drawLiquid();
      drawVapor();
      drawDrops();
      drawGas();
      drawTips();
      drawBolts();
      drawSparks();
      drawAminos();
      /* l'éclair illumine le verre : le calque des reflets s'ajoute, plus ou moins fort */
      const fl = Math.round(Math.min(1, flash * 1.1 + glowL * 0.5 * FLASH) * 50) / 50;
      if (fl !== flareShown) {
        flareShown = fl;
        cvFlare.canvas.style.opacity = String(fl);
      }
      if (flash > 0.01) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = Math.min(1, flash) * 0.16;
        drawSpr(SPR.blue, fx, fy, 1.1);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
      drawBloom();
      unitsOn(ctx, d);
      drawRings();
      pxOn(ctx, d);
    }

    /* ================= gestes ================= */
    api.track(cvFlare.canvas, {
      down(p) {
        lastDown = time;
        if (gestureType) {
          gestureType = null;
          api.gesture(null);
        }
        const q = { x: p.x, y: p.y, t0: time };
        presses.set(p.id, q);
        holdP = q;
        if (!geo.ready) return;
        const ux = (p.x - geo.ox) / geo.U, uy = (p.y - geo.oy) / geo.U;
        ring(ux, uy);
        fire(ux, uy, TAP);
      },
      move(p) {
        const q = presses.get(p.id);
        if (q) {
          q.x = p.x;
          q.y = p.y;
        }
      },
      up(p) {
        presses.delete(p.id);
        holdP = presses.size ? Array.from(presses.values()).pop() : null;
      },
    }, { touchAction: 'pan-y' });

    [cvBg, cvLit, cv, cvFront, cvFlare].forEach((c) => c.onResize((w, h) => ensureLayout(w, h, c.dpr)));

    /* pour les tests automatiques */
    api.root.__eclairs = () => ({
      made, arrived, bolts: boltsN, done: finished, storming, inTube: tubeQ.length,
      falling: aminos.filter((a) => a.on && a.st === 5).length,
      gap: geo.ready ? [X(0) / geo.w, Y(EY) / geo.h] : [0.5, 0.4],
      flask: geo.ready ? [X(0) / geo.w, Y(0) / geo.h, geo.U / geo.w, geo.U / geo.h] : null,
    });

    api.root.__eclairsFreeze = (v) => {
      frozen = !!v;
    };
    /* fige le jeu t secondes après le prochain éclair (pour photographier l'éclair à son pic) */
    api.root.__eclairsFreezeAfterBolt = (t) => {
      testFreeze = t;
    };

    api.loop((dt) => {
      if (!frozen) {
        update(Math.min(dt, freezeAt >= 0 ? Math.max(0, freezeAt - time) + 1e-4 : dt));
        if (freezeAt >= 0 && time >= freezeAt) {
          frozen = true;
          freezeAt = -1;
        }
      }
      render();
    });
    api.onReset(init);
    init();
    render();
  };
})();
