/* Le règne des dinosaures : un voyage dans le temps.
   En bas, la frise du temps va de 230 millions d'années à aujourd'hui, à l'échelle (linéaire).
   On fait glisser le curseur (ou on touche un médaillon, ou « Précédent / Suivant ») et le paysage
   change d'époque : premiers petits dinosaures, géants au long cou, tyrannosaure et tricératops,
   l'astéroïde, les mammifères, puis une famille humaine autour du feu, tout au bout de la frise.
   Version des petits : arriver chez les humains suffit pour gagner, même sans avoir vu tous les moments. */
(function () {
  'use strict';
  const { lib } = window.RM;
  const { TAU, rand, clamp, lerp, ease, rgba, mix, draw } = lib;

  /* ================= Tous les textes du jeu ================= */
  const TEXTES = {
    /* consigne de départ : la même que dans index.html (main.js la remet au « Rejouer ») */
    consigne: 'Fais glisser le curseur du temps, jusqu’à aujourd’hui.',
    continuer: 'Continue vers la droite, ou touche « Suivant ».',
    loupe: 'Regarde la loupe : les humains sont tout au bout !',
    fin: 'Les humains sont arrivés bien après les dinosaures !',
    finStatut: 'Aucun humain n’a jamais vu de dinosaure géant.',
    bravo: '{bravo}',
    precedent: 'Précédent',
    suivant: 'Suivant',
    ariaPrecedent: 'Moment précédent',
    ariaSuivant: 'Moment suivant',
    ariaScene: 'Frise du temps : flèches gauche et droite pour changer de moment',
    debut: 'il y a 230 millions d’années',
    aujourdhui: 'aujourd’hui',
    /* une phrase simple par moment, avec les mots du chapitre */
    moments: [
      {
        quand: 'Il y a 230 millions d’années',
        titre: 'Les premiers dinosaures',
        texte: 'Ils sont petits et courent sur deux pattes.',
      },
      {
        quand: 'Il y a 150 millions d’années',
        titre: 'Les géants au long cou',
        texte: 'Certains sont plus longs que deux autobus !',
      },
      {
        quand: 'Il y a 66 millions d’années',
        titre: 'Le tyrannosaure et le tricératops',
        texte: 'Ce sont les derniers grands dinosaures.',
      },
      {
        quand: 'Il y a 66 millions d’années',
        titre: 'Un énorme caillou tombe sur la Terre',
        texte: 'Boum ! Le ciel devient tout sombre.',
        titre2: 'Les dinosaures disparaissent',
        texte2: 'Tous, sauf une famille : les oiseaux !',
      },
      {
        quand: 'Après les dinosaures',
        titre: 'Place aux animaux à poils !',
        texte: 'Sans les dinosaures, ils peuvent grandir.',
      },
      {
        quand: 'Beaucoup, beaucoup plus tard',
        titre: 'Des humains comme nous !',
        texte: 'Une famille se réchauffe autour du feu.',
      },
    ],
  };

  /* ================= Le temps ================= */
  const SPAN = 230;                                       /* millions d'années couverts par la frise */
  const MOMENTS = [230, 150, 68, 66, 33, 0.3].map((t) => ({ t, f: 1 - t / SPAN }));
  const N = MOMENTS.length;
  /* où le paysage bascule d'un moment au suivant quand on fait glisser le curseur */
  const ZONES = [0.17, 0.526, 0.7087, 0.785, 0.99];
  const F_DINO_END = 1 - 66 / SPAN;                       /* fin du règne des dinosaures */
  const F_HUMANS = 1 - 0.3 / SPAN;                        /* arrivée d'Homo sapiens */
  const ZOOM_MAX = 330;                                   /* grossissement final de la loupe */
  const SETTLED = 60;                                     /* l'astéroïde est déjà tombé */
  const TRANS = 0.65;                                     /* durée d'un changement d'époque (s) */

  function zoneOf(f) {
    let i = 0;
    while (i < ZONES.length && f >= ZONES[i]) i++;
    return i;
  }
  const smooth = (a, b, v) => {
    const t = clamp((v - a) / (b - a));
    return t * t * (3 - 2 * t);
  };

  /* ================= Style ================= */
  const CSS = `
.game[data-game="dinos"] .game-canvas { cursor: grab; }
.game[data-game="dinos"] .game-canvas.is-dragging { cursor: grabbing; }
.game[data-game="dinos"] .dn-label {
  position: absolute; z-index: 3; left: 9px; right: 9px; top: 9px; max-width: 27rem;
  margin: 0; padding: 7px 11px 8px;
  border-radius: 13px 17px 15px 12px;
  background: rgba(9, 27, 26, 0.7);
  -webkit-backdrop-filter: blur(5px); backdrop-filter: blur(5px);
  box-shadow: 0 10px 22px -14px rgba(0, 0, 0, 0.75), inset 0 0 0 1px rgba(239, 248, 242, 0.1);
  color: var(--fg); pointer-events: none;
}
.game[data-game="dinos"] .dn-when {
  display: block; font-family: var(--font-display); font-style: italic; font-weight: 600;
  font-variation-settings: "SOFT" 100, "opsz" 24; font-size: 0.84rem; line-height: 1.18; color: var(--accent);
}
.game[data-game="dinos"] .dn-title { display: block; margin-top: 1px; font-weight: 800; font-size: 1.0625rem; line-height: 1.2; }
.game[data-game="dinos"] .dn-text { display: block; margin-top: 2px; font-size: 0.92rem; line-height: 1.3; color: rgba(239, 248, 242, 0.9); }
.game[data-game="dinos"] .dn-small .dn-title { font-size: 0.94rem; }
.game[data-game="dinos"] .dn-small .dn-when, .game[data-game="dinos"] .dn-small .dn-text { font-size: 0.78rem; }
.game[data-game="dinos"] .dn-end {
  position: absolute; z-index: 2; margin: 0; font-size: 0.75rem; line-height: 1.1; color: var(--muted);
  pointer-events: none; white-space: nowrap; transition: opacity 0.35s;
}
.game[data-game="dinos"] .dn-nav { display: flex; gap: 10px; }
.game[data-game="dinos"] .dn-nav .chip { flex: 1; background: var(--panel); color: var(--fg); box-shadow: inset 0 0 0 1px var(--line); }
.game[data-game="dinos"] .dn-nav .chip:not([disabled]):hover { box-shadow: inset 0 0 0 1.5px var(--accent); }
`;

  /* ================= Briques de dessin ================= */
  function ell(g, x, y, rx, ry, rot) {
    g.beginPath();
    g.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot || 0, 0, TAU);
  }
  /* contour (une teinte plus foncée) puis remplissage : un seul trait autour de la forme */
  function sf(g, fill, line, k) {
    g.lineWidth = k * 2;
    g.strokeStyle = line;
    g.stroke();
    g.fillStyle = fill;
    g.fill();
  }
  function dot(g, x, y, r, col) {
    ell(g, x, y, r, r);
    g.fillStyle = col;
    g.fill();
  }
  function curve(g, x0, y0, cx, cy, x1, y1, col, w) {
    g.beginPath();
    g.moveTo(x0, y0);
    g.quadraticCurveTo(cx, cy, x1, y1);
    g.lineWidth = w;
    g.strokeStyle = col;
    g.stroke();
  }
  /* forme de membre : deux cercles reliés par leurs tangentes */
  function capsule(g, x1, y1, r1, x2, y2, r2) {
    const dx = x2 - x1, dy = y2 - y1;
    const d = Math.hypot(dx, dy);
    g.beginPath();
    if (d <= Math.abs(r1 - r2) + 0.01) {
      g.arc(r1 > r2 ? x1 : x2, r1 > r2 ? y1 : y2, Math.max(r1, r2), 0, TAU);
      return;
    }
    const a = Math.atan2(dy, dx);
    const off = Math.acos(clamp((r1 - r2) / d, -1, 1));
    g.arc(x1, y1, r1, a + off, a - off + TAU);
    g.arc(x2, y2, r2, a - off, a + off);
    g.closePath();
  }
  /* plusieurs capsules d'un seul tenant : tous les contours, puis tous les remplissages */
  const SEG = new Float32Array(36);
  function limbs(g, n, fill, line, k) {
    g.lineWidth = k * 2;
    g.strokeStyle = line;
    for (let i = 0; i < n; i++) {
      const s = i * 6;
      capsule(g, SEG[s], SEG[s + 1], SEG[s + 2], SEG[s + 3], SEG[s + 4], SEG[s + 5]);
      g.stroke();
    }
    g.fillStyle = fill;
    for (let i = 0; i < n; i++) {
      const s = i * 6;
      capsule(g, SEG[s], SEG[s + 1], SEG[s + 2], SEG[s + 3], SEG[s + 4], SEG[s + 5]);
      g.fill();
    }
  }
  function seg(i, x1, y1, r1, x2, y2, r2) {
    const s = i * 6;
    SEG[s] = x1; SEG[s + 1] = y1; SEG[s + 2] = r1; SEG[s + 3] = x2; SEG[s + 4] = y2; SEG[s + 5] = r2;
  }
  function vgrad(g, y0, y1, stops) {
    const gr = g.createLinearGradient(0, y0, 0, y1);
    for (let i = 0; i < stops.length; i++) gr.addColorStop(stops[i][0], stops[i][1]);
    return gr;
  }

  /* Tube effilé le long d'une courbe de Bézier (cou, queue, corne, trompe) */
  const TN = 12;
  const TL = new Float32Array((TN + 1) * 2);
  const TR = new Float32Array((TN + 1) * 2);
  const bz = (a, b, c, d, t) => {
    const u = 1 - t;
    return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
  };
  const bzd = (a, b, c, d, t) => {
    const u = 1 - t;
    return 3 * u * u * (b - a) + 6 * u * t * (c - b) + 3 * t * t * (d - c);
  };
  function tube(g, c, r0, r1, pw) {
    let fa = 0;
    for (let i = 0; i <= TN; i++) {
      const t = i / TN;
      const x = bz(c[0], c[2], c[4], c[6], t), y = bz(c[1], c[3], c[5], c[7], t);
      let dx = bzd(c[0], c[2], c[4], c[6], t), dy = bzd(c[1], c[3], c[5], c[7], t);
      const d = Math.hypot(dx, dy) || 1;
      dx /= d;
      dy /= d;
      const r = lerp(r0, r1, pw ? Math.pow(t, pw) : t);
      TL[i * 2] = x + dy * r;
      TL[i * 2 + 1] = y - dx * r;
      TR[i * 2] = x - dy * r;
      TR[i * 2 + 1] = y + dx * r;
      if (i === TN) fa = Math.atan2(dy, dx);
    }
    g.beginPath();
    g.moveTo(TR[0], TR[1]);
    g.lineTo(TL[0], TL[1]);
    for (let i = 1; i < TN; i++) {
      g.quadraticCurveTo(TL[i * 2], TL[i * 2 + 1], (TL[i * 2] + TL[i * 2 + 2]) / 2, (TL[i * 2 + 1] + TL[i * 2 + 3]) / 2);
    }
    g.lineTo(TL[TN * 2], TL[TN * 2 + 1]);
    g.arc(c[6], c[7], Math.max(0.01, r1), fa - Math.PI / 2, fa + Math.PI / 2);
    for (let i = TN - 1; i > 0; i--) {
      g.quadraticCurveTo(TR[i * 2], TR[i * 2 + 1], (TR[i * 2] + TR[i * 2 - 2]) / 2, (TR[i * 2 + 1] + TR[i * 2 - 1]) / 2);
    }
    g.closePath();
  }

  /* Genou par cinématique inverse (deux segments a et b) ; bend = 1 : genou vers l'avant */
  const KN = [0, 0, 0, 0];
  function ik(hx, hy, ax, ay, a, b, bend) {
    let dx = ax - hx, dy = ay - hy;
    let d = Math.hypot(dx, dy);
    const dm = (a + b) * 0.995;
    if (d > dm) {
      dx *= dm / d;
      dy *= dm / d;
      d = dm;
    }
    d = Math.max(d, 0.01);
    const base = Math.atan2(dy, dx);
    const c = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1);
    const ang = base - bend * Math.acos(c);
    KN[0] = hx + Math.cos(ang) * a;
    KN[1] = hy + Math.sin(ang) * a;
    KN[2] = hx + dx;
    KN[3] = hy + dy;
    return KN;
  }
  /* Trajet du pied pendant la marche : appui (le pied recule au sol) puis pas (il revient en l'air) */
  const FT = [0, 0];
  function gaitFoot(ph, run, S, H) {
    let p = ph % TAU;
    if (p < 0) p += TAU;
    if (p < Math.PI) {
      FT[0] = lerp(S, -S, p / Math.PI) * run;
      FT[1] = 0;
    } else {
      const q = (p - Math.PI) / Math.PI;
      FT[0] = lerp(-S, S, ease.inOutSine(q)) * run;
      FT[1] = -Math.sin(q * Math.PI) * H * run;
    }
    return FT;
  }

  /* Feuille effilée (fronde de fougère, palme, plume), éventuellement dentelée */
  function leaf(g, x, y, cx, cy, ex, ey, wd, teeth) {
    const n = teeth ? 16 : 9;
    g.beginPath();
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i <= n; i++) {
        const t = side < 0 ? i / n : 1 - i / n;
        const u = 1 - t;
        const px = u * u * x + 2 * u * t * cx + t * t * ex;
        const py = u * u * y + 2 * u * t * cy + t * t * ey;
        const dx = 2 * u * (cx - x) + 2 * t * (ex - cx);
        const dy = 2 * u * (cy - y) + 2 * t * (ey - cy);
        const d = Math.hypot(dx, dy) || 1;
        let r = wd * 0.5 * Math.sin(Math.min(1, t * 1.25 + 0.04) * Math.PI) * (1 - t * 0.25);
        if (teeth && i % 2 === 1) r *= 1.6;
        const nx = (-dy / d) * side, ny = (dx / d) * side;
        if (side < 0 && i === 0) g.moveTo(px + nx * r, py + ny * r);
        else g.lineTo(px + nx * r, py + ny * r);
      }
    }
    g.closePath();
  }
  function feather(g, x, y, ang, len, wd, fill, line, k) {
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(len * 0.3, -wd, len * 0.78, -wd * 0.9, len, 0);
    g.bezierCurveTo(len * 0.78, wd * 0.8, len * 0.3, wd * 0.8, 0, 0);
    g.closePath();
    sf(g, fill, line, k);
    g.restore();
  }

  /* Œil tout rond, avec ses reflets ; fermé en arc quand l'animal est content */
  function eye(g, x, y, r, a, k) {
    const P = a.pal;
    if (a.happy > 0.5) {
      g.beginPath();
      g.moveTo(x - r * 0.8, y + r * 0.25);
      g.quadraticCurveTo(x, y - r * 0.85, x + r * 0.8, y + r * 0.25);
      g.lineWidth = Math.max(k * 1.8, r * 0.28);
      g.strokeStyle = P.line;
      g.stroke();
      return;
    }
    g.save();
    g.translate(x, y);
    g.scale(1, 1 - a.blink * 0.9);
    ell(g, 0, 0, r, r * 1.08);
    g.fillStyle = '#FFFDF4';
    g.fill();
    g.lineWidth = k;
    g.strokeStyle = P.line;
    g.stroke();
    g.save();
    g.clip();
    const ix = a.lookX * r * 0.3, iy = a.lookY * r * 0.32 + r * 0.06;
    ell(g, ix, iy, r * 0.7, r * 0.77);
    g.fillStyle = P.iris;
    g.fill();
    ell(g, ix, iy + r * 0.04, r * 0.44, r * 0.5);
    g.fillStyle = '#140D08';
    g.fill();
    ell(g, ix - r * 0.24, iy - r * 0.3, r * 0.27, r * 0.25);
    g.fillStyle = '#FFFFFF';
    g.fill();
    ell(g, ix + r * 0.25, iy + r * 0.3, r * 0.11, r * 0.1);
    g.fill();
    g.restore();
    g.restore();
  }

  function pal(base, belly, spot, more) {
    return Object.assign({
      base,
      belly,
      spot,
      light: mix(base, '#FFF6E2', 0.3),
      shade: mix(base, '#10201E', 0.24),
      far: mix(base, '#10201E', 0.3),
      line: mix(base, '#140C08', 0.58),
      cheek: 'rgba(255,118,128,0.42)',
      iris: '#4C2C16',
    }, more || {});
  }

  /* ================= Les animaux (de profil, tournés vers la droite, pieds en y = 0) ================= */

  /* ---- petit dinosaure coureur (et sa version à plumes) ---- */
  const RL = { a: 17, b: 16, ank: 4, foot: 8, S: 12, H: 8, r0: 8.4, r1: 3.8, r2: 3, r3: 2.3 };
  function legB(g, hx, hy, ph, run, rest, L, fill, line, k) {
    gaitFoot(ph, run, L.S, L.H);
    const fx = hx + FT[0] + rest * (1 - run);
    const fy = FT[1];
    const kn = ik(hx, hy, fx, fy - L.ank, L.a, L.b, 1);
    const kx = kn[0], ky = kn[1], ex = kn[2], ey = kn[3];
    seg(0, ex, ey, L.r2, ex + L.foot, fy - L.r3, L.r3);
    seg(1, kx, ky, L.r1, ex, ey, L.r2);
    seg(2, hx, hy, L.r0, kx, ky, L.r1);
    limbs(g, 3, fill, line, k);
  }
  function armB(g, sx, sy, sw, fill, line, k, feath) {
    const ex = sx + Math.cos(1.25 + sw) * 7, ey = sy + Math.sin(1.25 + sw) * 7;
    const hx = ex + Math.cos(0.2 + sw * 0.6) * 6, hy = ey + Math.sin(0.2 + sw * 0.6) * 6;
    if (feath) {
      feather(g, ex, ey, 2.5 + sw * 0.5, 12, 3.2, feath, line, k);
      feather(g, (ex + hx) / 2, (ey + hy) / 2, 2.2 + sw * 0.5, 12, 3.2, feath, line, k);
      feather(g, hx, hy, 1.9 + sw * 0.5, 11, 3, feath, line, k);
    }
    seg(0, sx, sy, 2.6, ex, ey, 2.1);
    seg(1, ex, ey, 2.1, hx, hy, 1.6);
    limbs(g, 2, fill, line, k);
  }
  function runnerBody(g, w) {
    const ty = w * 5;
    g.beginPath();
    g.moveTo(29, -71);
    g.bezierCurveTo(25, -64, 21, -59, 14, -57);
    g.bezierCurveTo(4, -56, -6, -54, -14, -50);
    g.bezierCurveTo(-30, -46, -48, -47 + ty * 0.4, -70, -52 + ty);
    g.bezierCurveTo(-75, -53 + ty, -76, -48.5 + ty, -71, -48 + ty);
    g.bezierCurveTo(-50, -41 + ty * 0.4, -32, -34, -16, -30);
    g.bezierCurveTo(-6, -24, 12, -24, 22, -32);
    g.bezierCurveTo(27, -36, 30, -42, 32, -50);
    g.bezierCurveTo(34, -56, 37, -61, 41, -64);
    g.closePath();
  }
  function runnerHead(g) {
    g.beginPath();
    g.moveTo(30, -70);
    g.bezierCurveTo(30, -80, 40, -86, 49, -84);
    g.bezierCurveTo(56, -82, 60, -76, 61, -71);
    g.bezierCurveTo(62, -66, 60, -63.5, 56, -63);
    g.bezierCurveTo(50, -62, 42, -62, 37, -64);
    g.bezierCurveTo(32, -65, 30, -67, 30, -70);
    g.closePath();
  }
  function drawRunner(g, a, k) {
    const P = a.pal;
    const run = a.gait, ph = a.phase;
    const fe = a.kind === 'feather';
    const bob = -Math.abs(Math.sin(ph)) * 3 * run + Math.sin(a.t * 2.1 + a.seed) * 0.7 * (1 - run);
    const wag = Math.sin(a.t * 2.3 + a.seed) * (0.45 + 0.55 * run) + a.react * Math.sin(a.t * 18) * 0.8;
    const flap = fe ? Math.sin(a.t * 3 + a.seed) * 0.25 + a.react * Math.sin(a.t * 20) * 0.7 : 0;
    legB(g, -1, -35 + bob, ph + Math.PI, run, -4, RL, P.far, P.line, k);
    armB(g, 19, -42 + bob, Math.sin(ph + Math.PI) * 0.55 * run - flap, P.far, P.line, k, fe ? P.feather2 : null);
    if (fe) {
      const ty = -51 + bob + wag * 5;
      feather(g, -66, ty, Math.PI - 0.32 + wag * 0.1, 18, 4.4, P.feather2, P.line, k);
      feather(g, -67, ty + 1, Math.PI + 0.02 + wag * 0.1, 21, 4.8, P.feather, P.line, k);
      feather(g, -66, ty + 2, Math.PI + 0.36 + wag * 0.1, 17, 4.2, P.feather2, P.line, k);
    }
    g.save();
    g.translate(0, bob);
    runnerBody(g, wag);
    sf(g, a.grad, P.line, k);
    g.save();
    g.clip();
    ell(g, 6, -27, 21, 8.5);
    g.fillStyle = P.belly;
    g.fill();
    g.fillStyle = P.spot;
    if (fe) {
      ell(g, 0, -54, 16, 3.6, -0.06);
      g.fill();
      ell(g, -30, -47 + wag * 2, 12, 2.6, 0.1);
      g.fill();
    } else {
      ell(g, -4, -51, 4.2, 2.4, -0.1);
      g.fill();
      ell(g, 8, -53, 3.2, 2, 0);
      g.fill();
      ell(g, -18, -47, 3.6, 2.1, 0.15);
      g.fill();
      ell(g, -33, -46 + wag * 2, 2.8, 1.6, 0.1);
      g.fill();
      ell(g, -46, -47 + wag * 3, 2.2, 1.3, 0.1);
      g.fill();
    }
    g.restore();
    g.restore();
    legB(g, 2, -35 + bob, ph, run, 3, RL, a.grad, P.line, k);
    g.save();
    g.translate(35, -64 + bob);
    g.rotate(a.nod);
    g.translate(-35, 64);
    if (fe) {
      feather(g, 38, -82, -2.2, 13, 3.4, P.feather, P.line, k);
      feather(g, 35, -80, -2.55, 12, 3.2, P.feather2, P.line, k);
      feather(g, 33, -77, -2.85, 10, 3, P.feather, P.line, k);
    }
    runnerHead(g);
    sf(g, a.grad, P.line, k);
    ell(g, 49, -67.5, 3.4, 2.1);
    g.fillStyle = P.cheek;
    g.fill();
    eye(g, 44, -74, 5.6, a, k);
    curve(g, 50.5, -65.4, 54.5, -63.4, 58.6, -65.8, P.line, k * 1.3);
    dot(g, 58.8, -71.2, 0.85, P.line);
    g.restore();
    armB(g, 22, -41 + bob, Math.sin(ph) * 0.55 * run + flap, a.grad, P.line, k, fe ? P.feather : null);
  }

  /* ---- géant au long cou ---- */
  const SN = new Float32Array(8);
  const STRIPE = new Float32Array(8);
  /* corps et queue d'un seul trait : la queue s'effile en douceur depuis la croupe */
  function sauroBody(g, w) {
    g.beginPath();
    g.moveTo(58, -112);
    g.bezierCurveTo(36, -142, -30, -146, -60, -122);
    g.bezierCurveTo(-92, -100, -142, -70 + w * 0.4, -206 + w, -50 + w * 0.6);
    g.bezierCurveTo(-211 + w, -49 + w * 0.6, -211 + w, -44.5 + w * 0.6, -205 + w, -44 + w * 0.6);
    g.bezierCurveTo(-152, -52 + w * 0.3, -104, -58, -72, -64);
    g.bezierCurveTo(-50, -46, 40, -44, 62, -64);
    g.bezierCurveTo(74, -76, 74, -98, 58, -112);
    g.closePath();
  }
  /* patte en colonne, un peu fléchie, avec un large pied rond */
  function pillar(g, tx, ty, ph, run, bend, r0, r1, fill, line, k) {
    gaitFoot(ph, run, 10, 6);
    const fx = tx + FT[0] + bend * 2, fy = FT[1];
    const L = (-ty - r1 * 0.9) * 0.51;
    const kn = ik(tx, ty, fx, fy - r1 * 0.9, L, L, bend);
    seg(0, kn[0], kn[1], (r0 + r1) / 2, kn[2], kn[3], r1);
    seg(1, tx, ty, r0, kn[0], kn[1], (r0 + r1) / 2);
    limbs(g, 2, fill, line, k);
    ell(g, kn[2] + 1, fy - r1 * 0.42, r1 * 1.15, r1 * 0.5);
    sf(g, fill, line, k);
    g.fillStyle = 'rgba(255,246,226,0.8)';
    for (let i = -1; i <= 1; i++) {
      ell(g, kn[2] + 3.5 + i * r1 * 0.42, fy - r1 * 0.22, r1 * 0.16, r1 * 0.12);
      g.fill();
    }
  }
  function drawSauro(g, a, k) {
    const P = a.pal, t = a.t;
    const eat = a.eat;
    const sw = Math.sin(t * 0.5 + a.seed);
    const sw2 = Math.sin(t * 0.75 + a.seed * 2);
    const br = Math.sin(t * 1.1) * 1.2;
    const run = a.gait, ph = a.phase;
    const lo = 13; /* corps bas sur pattes : plus rond, plus mignon */
    pillar(g, 30, -84 + lo, ph + Math.PI, run, -1, 16, 13, P.far, P.line, k);
    pillar(g, -52, -84 + lo, ph, run, 1, 17, 13.5, P.far, P.line, k);
    /* cou : il se tend vers l'arbre pour brouter, puis revient */
    const tx = lerp(110, 126, eat) + sw * 5;
    const ty = lerp(-204, -219, eat) + Math.sin(t * 0.5 + a.seed + 1) * 3 + a.nodY;
    SN[0] = 44; SN[1] = -106 + lo; SN[2] = 84; SN[3] = -122 + lo;
    SN[4] = lerp(98, 106, eat) + sw * 3; SN[5] = lerp(-170, -180, eat); SN[6] = tx; SN[7] = ty;
    tube(g, SN, 31, 12.5, 0.9);
    sf(g, a.grad, P.line, k);
    /* dessous du cou plus clair */
    g.save();
    g.clip();
    for (let i = 0; i < 8; i++) STRIPE[i] = SN[i] + (i % 2 === 0 ? 9 : 7);
    tube(g, STRIPE, 17, 5, 0.9);
    g.fillStyle = P.belly;
    g.globalAlpha *= 0.7;
    g.fill();
    g.globalAlpha /= 0.7;
    g.fillStyle = P.spot;
    for (let i = 0; i < 4; i++) {
      const tt = 0.22 + i * 0.19;
      const x = bz(SN[0], SN[2], SN[4], SN[6], tt), y = bz(SN[1], SN[3], SN[5], SN[7], tt);
      const dx = bzd(SN[0], SN[2], SN[4], SN[6], tt), dy = bzd(SN[1], SN[3], SN[5], SN[7], tt);
      const d = Math.hypot(dx, dy) || 1;
      const r = lerp(31, 12.5, Math.pow(tt, 0.9));
      ell(g, x + (dy / d) * r * 0.55, y - (dx / d) * r * 0.55, r * 0.34, r * 0.22, Math.atan2(dy, dx));
      g.fill();
    }
    g.restore();
    g.save();
    g.translate(0, br * 0.3 + lo);
    const wag = sw2 * 7 + a.react * Math.sin(t * 12) * 8;
    sauroBody(g, wag);
    sf(g, a.grad, P.line, k);
    g.save();
    g.clip();
    ell(g, -10, -48, 74, 15);
    g.fillStyle = P.belly;
    g.fill();
    g.fillStyle = P.spot;
    ell(g, -34, -128, 9, 5, 0.2);
    g.fill();
    ell(g, -10, -135, 8.5, 4.6, 0.05);
    g.fill();
    ell(g, 14, -132, 7, 4, -0.1);
    g.fill();
    ell(g, -60, -112, 7, 4, 0.55);
    g.fill();
    ell(g, -92, -94 + wag * 0.15, 5.5, 3.2, 0.6);
    g.fill();
    ell(g, -124, -78 + wag * 0.3, 4.2, 2.5, 0.5);
    g.fill();
    ell(g, 34, -122, 5.5, 3.4, -0.3);
    g.fill();
    g.restore();
    g.restore();
    pillar(g, 44, -82 + lo, ph, run, -1, 17, 13.5, a.grad, P.line, k);
    pillar(g, -40, -82 + lo, ph + Math.PI, run, 1, 18, 14, a.grad, P.line, k);
    /* tête */
    g.save();
    g.translate(tx, ty);
    g.rotate(-0.05 + eat * 0.42 + a.nod + Math.sin(t * 7) * 0.05 * eat);
    g.beginPath();
    g.moveTo(-10, -9);
    g.bezierCurveTo(-4, -17, 12, -19, 22, -14);
    g.bezierCurveTo(29, -11, 33, -5, 32, 1);
    g.bezierCurveTo(31, 7, 24, 9, 15, 8);
    g.bezierCurveTo(5, 8, -5, 7, -10, 3);
    g.bezierCurveTo(-13, -1, -13, -5, -10, -9);
    g.closePath();
    sf(g, a.gradH, P.line, k);
    ell(g, 23, -13.5, 2.4, 1.2, -0.3);
    g.fillStyle = P.line;
    g.fill();
    ell(g, 18, 2.5, 4, 2.4);
    g.fillStyle = P.cheek;
    g.fill();
    eye(g, 8, -6, 5.2, a, k);
    curve(g, 19, 3.6, 25, 6.2, 30.5, 2.2, P.line, k * 1.3);
    g.restore();
  }

  /* ---- dinosaure à plaques ---- */
  const STEG_SP = [42, -42, 30, -66, 2, -80, -24, -71];
  const STEG_TL = new Float32Array(8);
  const PLATES = [[0, 0.1, 9], [0, 0.28, 15], [0, 0.48, 21], [0, 0.68, 25], [0, 0.88, 24], [1, 0.12, 19], [1, 0.36, 14], [1, 0.6, 10]];
  /* patte de quadrupède (deux segments et un pied) */
  function quadLeg(g, tx, ty, ph, run, S, H, a1, b1, r0, r1, r2, bend, fill, line, k, rest) {
    gaitFoot(ph, run, S, H);
    const fx = tx + FT[0] + rest * (1 - run), fy = FT[1];
    const kn = ik(tx, ty, fx, fy - r2, a1, b1, bend);
    const kx = kn[0], ky = kn[1], ex = kn[2], ey = kn[3];
    seg(0, kx, ky, r1, ex, ey, r2);
    seg(1, tx, ty, r0, kx, ky, r1);
    limbs(g, 2, fill, line, k);
    ell(g, ex + r2 * 0.3, ey + r2 * 0.4, r2 * 1.25, r2 * 0.62);
    sf(g, fill, line, k);
  }
  function plate(g, x, y, ang, sz, fill, line, k) {
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    const bw = sz * 0.44;
    g.beginPath();
    g.moveTo(-bw, 3);
    g.bezierCurveTo(-bw * 1.15, -sz * 0.45, -bw * 0.5, -sz * 0.86, 0, -sz);
    g.bezierCurveTo(bw * 0.5, -sz * 0.86, bw * 1.15, -sz * 0.45, bw, 3);
    g.closePath();
    sf(g, fill, line, k);
    curve(g, 0, -sz * 0.12, -bw * 0.12, -sz * 0.5, 0, -sz * 0.78, 'rgba(255,248,220,0.35)', k * 1.6);
    g.restore();
  }
  function drawSteg(g, a, k) {
    const P = a.pal, run = a.gait, ph = a.phase;
    const bob = -Math.abs(Math.sin(ph)) * 1.6 * run + Math.sin(a.t * 1.5) * 0.5 * (1 - run);
    const wag = Math.sin(a.t * 1.6 + a.seed) * (0.6 + run * 0.4) + a.react * Math.sin(a.t * 14) * 1.2;
    quadLeg(g, 26, -32 + bob, ph + Math.PI * 0.5, run, 9, 6, 15, 14, 7, 5.5, 5, -1, P.far, P.line, k, 3);
    quadLeg(g, -26, -42 + bob, ph + Math.PI * 1.5, run, 10, 7, 21, 20, 10, 6.5, 5.5, 1, P.far, P.line, k, -3);
    g.save();
    g.translate(0, bob);
    STEG_TL[0] = -24; STEG_TL[1] = -71; STEG_TL[2] = -50; STEG_TL[3] = -62;
    STEG_TL[4] = -76; STEG_TL[5] = -55 + wag * 2; STEG_TL[6] = -100; STEG_TL[7] = -48 + wag * 5;
    /* pointes au bout de la queue */
    for (let i = 0; i < 2; i++) {
      const tt = 0.8 + i * 0.13;
      const x = bz(STEG_TL[0], STEG_TL[2], STEG_TL[4], STEG_TL[6], tt), y = bz(STEG_TL[1], STEG_TL[3], STEG_TL[5], STEG_TL[7], tt) + 3;
      for (let s = -1; s <= 1; s += 2) {
        const ang = -Math.PI / 2 + s * 0.75 + (s > 0 ? 0.25 : 0);
        const L = 15 - i * 2;
        SN[0] = x; SN[1] = y; SN[2] = x + Math.cos(ang) * L * 0.4; SN[3] = y + Math.sin(ang) * L * 0.4;
        SN[4] = x + Math.cos(ang) * L * 0.75; SN[5] = y + Math.sin(ang) * L * 0.75; SN[6] = x + Math.cos(ang) * L; SN[7] = y + Math.sin(ang) * L;
        tube(g, SN, 3.4, 0.9);
        sf(g, s > 0 ? P.spike : P.spikeFar, P.line, k);
      }
    }
    /* deux rangées de plaques, celle du fond d'abord */
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < PLATES.length; i++) {
        const pl = PLATES[i];
        const c = pl[0] ? STEG_TL : STEG_SP;
        const tt = clamp(pl[1] + (row === 0 ? 0.09 : 0), 0, 1);
        const x = bz(c[0], c[2], c[4], c[6], tt), y = bz(c[1], c[3], c[5], c[7], tt);
        const dx = bzd(c[0], c[2], c[4], c[6], tt), dy = bzd(c[1], c[3], c[5], c[7], tt);
        const d = Math.hypot(dx, dy) || 1;
        const nx = -dy / d, ny = dx / d;
        const wig = a.react * Math.sin(a.t * 16 + i) * 0.12;
        plate(g, x, y, Math.atan2(nx, -ny) + wig, pl[2] * (row === 0 ? 0.92 : 1), row === 0 ? P.plateFar : P.plate, P.line, k);
      }
    }
    /* tête */
    g.save();
    g.translate(38, -38);
    g.rotate(a.graze * 0.34 + a.nod);
    g.translate(-38, 38);
    g.beginPath();
    g.moveTo(32, -46);
    g.bezierCurveTo(46, -50, 57, -49, 65, -44);
    g.bezierCurveTo(72, -40, 77, -34, 75, -29);
    g.bezierCurveTo(72, -25, 63, -24, 55, -26);
    g.bezierCurveTo(47, -27, 40, -27, 32, -29);
    g.closePath();
    sf(g, a.grad, P.line, k);
    ell(g, 66, -31.5, 3, 1.9);
    g.fillStyle = P.cheek;
    g.fill();
    eye(g, 61, -38, 4.4, a, k);
    curve(g, 66, -28.6, 69.5, -27.4, 73, -29.2, P.line, k * 1.2);
    dot(g, 73.6, -35, 0.7, P.line);
    g.restore();
    /* corps */
    g.beginPath();
    g.moveTo(44, -40);
    g.bezierCurveTo(32, -62, 2, -76, -22, -68);
    g.bezierCurveTo(-46, -61, -70, -53 + wag * 2, -102, -48 + wag * 5);
    g.bezierCurveTo(-107, -47 + wag * 5, -108, -42 + wag * 5, -103, -41 + wag * 5);
    g.bezierCurveTo(-76, -38 + wag * 2, -54, -32, -38, -28);
    g.bezierCurveTo(-20, -18, 22, -18, 40, -26);
    g.bezierCurveTo(46, -30, 47, -36, 44, -40);
    g.closePath();
    sf(g, a.grad, P.line, k);
    g.save();
    g.clip();
    ell(g, 2, -21, 40, 8);
    g.fillStyle = P.belly;
    g.fill();
    g.fillStyle = P.spot;
    ell(g, -8, -60, 7, 4, 0.1);
    g.fill();
    ell(g, 12, -56, 5.5, 3.4, -0.3);
    g.fill();
    ell(g, -26, -54, 5, 3, 0.25);
    g.fill();
    ell(g, -50, -50 + wag, 4, 2.4, 0.2);
    g.fill();
    g.restore();
    g.restore();
    quadLeg(g, 30, -30 + bob, ph + Math.PI * 1.5, run, 9, 6, 15, 14, 7.5, 6, 5.2, -1, a.grad, P.line, k, -2);
    quadLeg(g, -22, -40 + bob, ph + Math.PI * 0.5, run, 10, 7, 21, 20, 11, 7, 6, 1, a.grad, P.line, k, 3);
  }

  /* ---- tyrannosaure ---- */
  const TREX_LEG = { a: 28, b: 27, ank: 5, foot: 14, S: 14, H: 10, r0: 17, r1: 8.5, r2: 6.2, r3: 4.4 };
  function trexArm(g, sx, sy, a, fill, line, k, far) {
    const sw = Math.sin(a.t * (far ? 9 : 10) + (far ? 1 : 0)) * 0.7 * a.wave + 0.12 * Math.sin(a.t * 1.3);
    const ex = sx + 4.5, ey = sy + 5.5;
    const ang = -0.3 + sw;
    const hx = ex + Math.cos(ang) * 6.5, hy = ey + Math.sin(ang) * 6.5;
    seg(0, sx, sy, 3.4, ex, ey, 2.7);
    seg(1, ex, ey, 2.7, hx, hy, 2.2);
    seg(2, hx, hy, 1.6, hx + Math.cos(ang + 0.5) * 3.2, hy + Math.sin(ang + 0.5) * 3.2, 1.1);
    seg(3, hx, hy, 1.6, hx + Math.cos(ang - 0.2) * 3.6, hy + Math.sin(ang - 0.2) * 3.6, 1.1);
    limbs(g, 4, fill, line, k);
  }
  function drawTrex(g, a, k) {
    const P = a.pal, run = a.gait, ph = a.phase;
    const bob = -Math.abs(Math.sin(ph)) * 2.6 * run + Math.sin(a.t * 1.7) * 0.8 * (1 - run);
    const wag = Math.sin(a.t * 1.5 + a.seed) * (0.6 + 0.4 * run);
    legB(g, -5, -58 + bob, ph + Math.PI, run, -6, TREX_LEG, P.far, P.line, k);
    trexArm(g, 28, -58 + bob, a, P.far, P.line, k, true);
    g.save();
    g.translate(0, bob);
    const ty = wag * 6;
    g.beginPath();
    g.moveTo(30, -88);
    g.bezierCurveTo(16, -94, -8, -92, -24, -82);
    g.bezierCurveTo(-52, -72, -84, -66 + ty * 0.5, -122, -64 + ty);
    g.bezierCurveTo(-126, -63 + ty, -126, -59 + ty, -121, -58.5 + ty);
    g.bezierCurveTo(-84, -55 + ty * 0.5, -54, -50, -28, -46);
    g.bezierCurveTo(-12, -38, 16, -40, 30, -54);
    g.bezierCurveTo(36, -62, 40, -72, 44, -80);
    g.closePath();
    sf(g, a.grad, P.line, k);
    g.save();
    g.clip();
    ell(g, 10, -42, 30, 11, -0.15);
    g.fillStyle = P.belly;
    g.fill();
    g.fillStyle = P.spot;
    for (let i = 0; i < 6; i++) {
      const x = 14 - i * 19;
      const y = -90 + i * 4.2 + (i > 2 ? ty * 0.25 * (i - 2) : 0);
      ell(g, x, y, 4.2 - i * 0.35, 9 - i * 0.6, 0.25);
      g.fill();
    }
    g.restore();
    g.restore();
    legB(g, -1, -58 + bob, ph, run, 5, TREX_LEG, a.grad, P.line, k);
    /* grosse tête */
    g.save();
    g.translate(32, -86 + bob);
    g.rotate(a.nod - a.lookUp * 0.38);
    g.translate(-32, 86);
    g.beginPath();
    g.moveTo(28, -90);
    g.bezierCurveTo(28, -106, 40, -118, 56, -119);
    g.bezierCurveTo(70, -120, 84, -116, 90, -108);
    g.bezierCurveTo(95, -101, 95, -93, 90, -89);
    g.bezierCurveTo(84, -83, 66, -81, 52, -83);
    g.bezierCurveTo(42, -84, 34, -84, 28, -90);
    g.closePath();
    sf(g, a.grad, P.line, k);
    /* petite arcade au-dessus de l'œil */
    curve(g, 49, -113.5, 55, -116.8, 61, -114.2, P.spot, k * 1.5);
    ell(g, 66, -94.5, 5, 3);
    g.fillStyle = P.cheek;
    g.fill();
    eye(g, 55, -104, 6.6, a, k);
    /* sourire et deux petites dents arrondies */
    g.fillStyle = '#FFFBF0';
    g.strokeStyle = P.line;
    g.lineWidth = k * 0.9;
    for (let i = 0; i < 2; i++) {
      const x = 81 + i * 4.2;
      g.beginPath();
      g.moveTo(x - 1.6, -90.4 + i * 0.2);
      g.quadraticCurveTo(x, -86.6 + i * 0.2, x + 1.6, -90.6 + i * 0.2);
      g.closePath();
      g.fill();
      g.stroke();
    }
    curve(g, 61, -92, 75, -86.5, 90, -91.5, P.line, k * 1.4);
    ell(g, 88.5, -105, 1.4, 1, -0.3);
    g.fillStyle = P.line;
    g.fill();
    g.restore();
    trexArm(g, 31, -57 + bob, a, a.grad, P.line, k, false);
  }

  /* ---- tricératops ---- */
  function drawTrice(g, a, k) {
    const P = a.pal, run = a.gait, ph = a.phase;
    const bob = -Math.abs(Math.sin(ph)) * 1.5 * run + Math.sin(a.t * 1.4) * 0.5 * (1 - run);
    const wag = Math.sin(a.t * 1.7 + a.seed) * 0.8 + a.react * Math.sin(a.t * 14);
    quadLeg(g, 20, -34 + bob, ph + Math.PI, run, 9, 6, 17, 16, 9, 7, 6, -1, P.far, P.line, k, 3);
    quadLeg(g, -40, -38 + bob, ph, run, 9, 6, 19, 18, 10.5, 7.5, 6.2, 1, P.far, P.line, k, -3);
    g.save();
    g.translate(0, bob);
    const ty = wag * 3;
    g.beginPath();
    g.moveTo(30, -60);
    g.bezierCurveTo(12, -76, -30, -78, -52, -62);
    g.bezierCurveTo(-64, -56, -80, -50 + ty * 0.5, -98, -42 + ty);
    g.bezierCurveTo(-101, -41 + ty, -101, -37 + ty, -97, -37 + ty);
    g.bezierCurveTo(-82, -40 + ty * 0.5, -68, -38, -56, -34);
    g.bezierCurveTo(-40, -18, 18, -18, 34, -32);
    g.bezierCurveTo(40, -40, 40, -52, 30, -60);
    g.closePath();
    sf(g, a.grad, P.line, k);
    g.save();
    g.clip();
    ell(g, -8, -22, 40, 9);
    g.fillStyle = P.belly;
    g.fill();
    g.fillStyle = P.spot;
    ell(g, -30, -66, 7, 4, 0.15);
    g.fill();
    ell(g, -8, -70, 6, 3.6, 0);
    g.fill();
    ell(g, 12, -64, 5, 3, -0.3);
    g.fill();
    ell(g, -50, -56, 4.6, 2.8, 0.4);
    g.fill();
    g.restore();
    g.restore();
    quadLeg(g, 24, -32 + bob, ph, run, 9, 6, 17, 16, 9.5, 7.5, 6.4, -1, a.grad, P.line, k, -2);
    quadLeg(g, -34, -36 + bob, ph + Math.PI, run, 9, 6, 19, 18, 11, 8, 6.6, 1, a.grad, P.line, k, 3);
    /* tête : collerette, cornes, bec */
    g.save();
    g.translate(34, -54 + bob);
    g.rotate(a.graze * 0.36 + a.nod - a.lookUp * 0.2);
    const R0 = 25, cx0 = -5, cy0 = -6, A0 = -2.8, A1 = -0.5, n = 9;
    g.beginPath();
    g.moveTo(cx0 + Math.cos(A0) * 8, cy0 + Math.sin(A0) * 8 + 16);
    g.lineTo(cx0 + Math.cos(A0) * R0, cy0 + Math.sin(A0) * R0);
    for (let i = 1; i <= n; i++) {
      const a0 = lerp(A0, A1, (i - 1) / n), a1 = lerp(A0, A1, i / n), am = (a0 + a1) / 2;
      g.quadraticCurveTo(cx0 + Math.cos(am) * (R0 + 6), cy0 + Math.sin(am) * (R0 + 6), cx0 + Math.cos(a1) * R0, cy0 + Math.sin(a1) * R0);
    }
    g.lineTo(16, 4);
    g.closePath();
    sf(g, P.frill, P.line, k);
    g.save();
    g.clip();
    g.beginPath();
    g.arc(cx0, cy0, R0 - 6, A0 - 0.2, A1 + 0.2);
    g.lineWidth = 4;
    g.strokeStyle = P.frill2;
    g.stroke();
    g.fillStyle = P.frillDot;
    for (let i = 0; i < 6; i++) {
      const an = lerp(A0 + 0.25, A1 - 0.15, i / 5);
      dot(g, cx0 + Math.cos(an) * (R0 - 0.5), cy0 + Math.sin(an) * (R0 - 0.5), 2.2, P.frillDot);
    }
    g.restore();
    /* corne du fond */
    SN[0] = 5; SN[1] = -6; SN[2] = 7; SN[3] = -16; SN[4] = 11; SN[5] = -25; SN[6] = 19; SN[7] = -31;
    tube(g, SN, 3.3, 0.8, 0.9);
    sf(g, P.hornFar, P.line, k);
    g.beginPath();
    g.moveTo(-6, -4);
    g.bezierCurveTo(6, -12, 22, -11, 32, -3);
    g.bezierCurveTo(38, 1, 42, 7, 41, 13);
    g.bezierCurveTo(40, 18, 35, 20, 30, 18);
    g.bezierCurveTo(22, 21, 8, 19, 0, 13);
    g.bezierCurveTo(-6, 9, -9, 2, -6, -4);
    g.closePath();
    sf(g, a.gradH, P.line, k);
    g.beginPath();
    g.moveTo(33, 4);
    g.bezierCurveTo(39, 6, 42, 10, 41, 14);
    g.bezierCurveTo(40, 18, 35, 20, 30, 18);
    g.bezierCurveTo(32, 14, 33, 9, 33, 4);
    g.closePath();
    sf(g, P.beak, P.line, k * 0.8);
    SN[0] = 32; SN[1] = 0; SN[2] = 34; SN[3] = -3; SN[4] = 35; SN[5] = -6; SN[6] = 35; SN[7] = -11;
    tube(g, SN, 3, 0.8);
    sf(g, P.horn, P.line, k);
    SN[0] = 11; SN[1] = -6; SN[2] = 14; SN[3] = -17; SN[4] = 19; SN[5] = -27; SN[6] = 28; SN[7] = -32;
    tube(g, SN, 3.8, 0.9, 0.9);
    sf(g, P.horn, P.line, k);
    ell(g, 23, 9.5, 4, 2.4);
    g.fillStyle = P.cheek;
    g.fill();
    eye(g, 13, 1, 4.8, a, k);
    curve(g, 23.5, 13.5, 28.5, 15.8, 33, 12.6, P.line, k * 1.2);
    dot(g, 35.5, 3.5, 0.8, P.line);
    g.restore();
  }

  /* ---- oiseau ---- */
  function birdWing(g, fl, fill, line, k, far) {
    g.save();
    g.translate(far ? 2 : -1, far ? -4.5 : -3);
    g.rotate(-0.3 - fl * 1.0);
    g.scale(1, 0.5 + 0.5 * Math.abs(fl));
    g.beginPath();
    g.moveTo(3, 1);
    g.bezierCurveTo(-1, -8, -9, -15, -18, -14);
    g.bezierCurveTo(-15, -10, -12, -5, -6, 2);
    g.closePath();
    sf(g, fill, line, k);
    g.restore();
  }
  function drawBird(g, a, k) {
    const P = a.pal;
    const fl = a.perch ? 0 : Math.sin(a.phase);
    if (a.perch && a.peck) {
      g.translate(0, 9);
      g.rotate(a.peck * 0.55);
      g.translate(0, -9);
    }
    if (!a.perch) birdWing(g, fl, P.far, P.line, k, true);
    g.beginPath();
    g.moveTo(-6, -1);
    g.lineTo(-17, -5.5);
    g.quadraticCurveTo(-19.5, -1.5, -17, 2.5);
    g.closePath();
    sf(g, P.tail, P.line, k);
    ell(g, 0, 0, 9.5, 7, -0.12);
    sf(g, P.base, P.line, k);
    g.save();
    ell(g, 0, 0, 9.5, 7, -0.12);
    g.clip();
    ell(g, 4.5, 3.5, 6.5, 4.8);
    g.fillStyle = P.belly;
    g.fill();
    g.restore();
    ell(g, 8.5, -5.5, 5.4, 5.2);
    sf(g, P.base, P.line, k);
    g.beginPath();
    g.moveTo(13, -7);
    g.quadraticCurveTo(18.5, -5.4, 13.2, -3.6);
    g.closePath();
    sf(g, P.beak, P.line, k * 0.8);
    eye(g, 10, -6.6, 2.4, a, k * 0.7);
    if (a.perch) {
      ell(g, -2, -1.5, 8, 4.6, -0.22);
      sf(g, P.wing, P.line, k);
      g.lineWidth = 1.3;
      g.strokeStyle = P.line;
      g.beginPath();
      g.moveTo(-1, 6);
      g.lineTo(-2, 10);
      g.moveTo(3, 6);
      g.lineTo(3.5, 10);
      g.stroke();
    } else {
      birdWing(g, fl, P.wing, P.line, k, false);
    }
  }

  /* ---- petit mammifère (musaraigne) ---- */
  function drawShrew(g, a, k) {
    const P = a.pal;
    const tw = Math.sin(a.t * 3 + a.seed) * 3;
    const sn = Math.sin(a.t * 9) * 0.6 * (0.5 + 0.5 * Math.sin(a.t * 0.7));
    g.beginPath();
    g.moveTo(-10, -7);
    g.bezierCurveTo(-18, -8, -24, -14 + tw, -31, -12 + tw);
    g.lineWidth = k * 2 + 2.2;
    g.strokeStyle = P.line;
    g.stroke();
    g.lineWidth = 2.2;
    g.strokeStyle = P.tail;
    g.stroke();
    ell(g, -6, -2, 3.4, 2.2);
    sf(g, P.far, P.line, k);
    ell(g, 7, -2, 3.2, 2.2);
    sf(g, P.far, P.line, k);
    g.beginPath();
    g.moveTo(-12, -6);
    g.bezierCurveTo(-12, -16, 4, -19, 11, -14);
    g.bezierCurveTo(16, -10, 14, -3, 8, -2);
    g.bezierCurveTo(0, -1, -10, -1, -12, -6);
    g.closePath();
    sf(g, a.grad, P.line, k);
    g.save();
    g.translate(0, sn * 0.4);
    g.beginPath();
    g.moveTo(6, -15);
    g.bezierCurveTo(10, -21, 17, -19, 21, -14);
    g.bezierCurveTo(24, -11, 24.5, -9, 22.5, -8.5);
    g.bezierCurveTo(17, -7, 11, -7, 7, -9);
    g.closePath();
    sf(g, a.grad, P.line, k);
    ell(g, 10, -19.5, 4, 4.2);
    sf(g, P.base, P.line, k);
    ell(g, 10.3, -19.3, 2.3, 2.5);
    g.fillStyle = P.ear;
    g.fill();
    dot(g, 23.6, -10 + sn * 0.3, 1.5, '#E5858A');
    eye(g, 15.5, -13.8, 2.7, a, k * 0.8);
    g.lineWidth = 0.6;
    g.strokeStyle = 'rgba(60,40,30,0.55)';
    g.beginPath();
    g.moveTo(21, -10);
    g.lineTo(27, -12 + sn);
    g.moveTo(21, -9.5);
    g.lineTo(27.5, -9 + sn);
    g.stroke();
    g.restore();
  }

  /* ---- mammifère à bois (cerf) ---- */
  const NK = new Float32Array(8);
  function drawDeer(g, a, k) {
    const P = a.pal, run = a.gait, ph = a.phase;
    const gz = a.graze;
    const br = Math.sin(a.t * 1.6) * 0.6;
    quadLeg(g, 20, -46, ph + Math.PI, run, 8, 6, 22, 22, 4.4, 3.2, 2.8, -1, P.far, P.line, k, 2);
    quadLeg(g, -20, -48, ph, run, 8, 6, 23, 22, 5.4, 3.4, 2.8, 1, P.far, P.line, k, -2);
    ell(g, -31, -62, 3.6, 6, 0.6);
    sf(g, P.belly, P.line, k);
    const hx = lerp(36, 48, gz), hy = lerp(-88, -28, gz);
    NK[0] = 17; NK[1] = -60; NK[2] = 25; NK[3] = lerp(-72, -58, gz);
    NK[4] = lerp(31, 44, gz); NK[5] = lerp(-82, -42, gz); NK[6] = hx; NK[7] = hy;
    tube(g, NK, 10.5, 7);
    sf(g, a.grad, P.line, k);
    g.beginPath();
    g.moveTo(26, -66 + br);
    g.bezierCurveTo(10, -73 + br, -20, -73 + br, -30, -63);
    g.bezierCurveTo(-37, -55, -33, -44, -22, -42);
    g.bezierCurveTo(-6, -38, 16, -40, 27, -46);
    g.bezierCurveTo(33, -52, 32, -62, 26, -66 + br);
    g.closePath();
    sf(g, a.grad, P.line, k);
    g.save();
    g.clip();
    ell(g, 0, -40, 28, 7);
    g.fillStyle = P.belly;
    g.fill();
    g.restore();
    quadLeg(g, 24, -46, ph, run, 8, 6, 22, 22, 4.6, 3.3, 2.9, -1, a.grad, P.line, k, -2);
    quadLeg(g, -16, -48, ph + Math.PI, run, 8, 6, 23, 22, 5.8, 3.5, 2.9, 1, a.grad, P.line, k, 2);
    g.save();
    g.translate(hx, hy);
    g.rotate(lerp(0.25, 1.2, gz) + a.nod);
    g.lineWidth = k * 2 + 2.2;
    g.strokeStyle = P.line;
    g.beginPath();
    g.moveTo(-1, -8);
    g.quadraticCurveTo(-4, -17, -2, -25);
    g.moveTo(-2.8, -16);
    g.lineTo(3.5, -21);
    g.moveTo(-2.4, -21.5);
    g.lineTo(-8, -26);
    g.stroke();
    g.lineWidth = 2.2;
    g.strokeStyle = P.antler;
    g.stroke();
    ell(g, -5, -8, 7, 2.8, -0.55);
    sf(g, P.far, P.line, k);
    g.beginPath();
    g.moveTo(-6, -5);
    g.bezierCurveTo(-2, -11, 8, -10, 14, -6);
    g.bezierCurveTo(19, -3, 22, 1, 20, 4);
    g.bezierCurveTo(16, 7, 6, 6, 0, 4);
    g.bezierCurveTo(-5, 2, -8, -1, -6, -5);
    g.closePath();
    sf(g, a.gradH, P.line, k);
    dot(g, 19.6, 1.4, 2, '#3A2A22');
    ell(g, 10, 2, 3, 1.8);
    g.fillStyle = P.cheek;
    g.fill();
    eye(g, 5, -3.2, 3.4, a, k);
    ell(g, -7, -10, 7.5, 3.1, -0.8);
    sf(g, P.base, P.line, k);
    ell(g, -7, -10, 4.6, 1.6, -0.8);
    g.fillStyle = P.belly;
    g.fill();
    g.restore();
  }

  /* ---- grand mammifère à trompe ---- */
  function drawMammoth(g, a, k) {
    const P = a.pal, run = a.gait, ph = a.phase;
    const br = Math.sin(a.t * 1.2) * 0.8;
    const curl = Math.sin(a.t * 0.9 + a.seed) * 5 + a.react * Math.sin(a.t * 10) * 6;
    const flap = Math.sin(a.t * 1.3) * 0.08 + a.react * Math.sin(a.t * 12) * 0.2;
    quadLeg(g, 26, -52, ph + Math.PI, run, 8, 5, 21, 21, 12, 11, 10.5, -1, P.far, P.line, k, 2);
    quadLeg(g, -34, -54, ph, run, 8, 5, 22, 22, 13, 11.5, 10.5, 1, P.far, P.line, k, -2);
    curve(g, -50, -78, -60, -66, -58, -50, P.line, k * 2 + 2.4);
    curve(g, -50, -78, -60, -66, -58, -50, P.base, 2.4);
    ell(g, -58, -48, 2.6, 4);
    sf(g, P.spot, P.line, k);
    g.beginPath();
    g.moveTo(30, -98 + br);
    g.bezierCurveTo(10, -114 + br, -36, -112 + br, -52, -90);
    g.bezierCurveTo(-62, -74, -58, -48, -44, -40);
    g.bezierCurveTo(-20, -32, 20, -32, 36, -42);
    g.bezierCurveTo(48, -52, 48, -86, 30, -98 + br);
    g.closePath();
    sf(g, a.grad, P.line, k);
    g.save();
    g.clip();
    ell(g, -4, -36, 44, 10);
    g.fillStyle = P.belly;
    g.fill();
    g.lineWidth = 1.2;
    g.strokeStyle = 'rgba(70,50,40,0.18)';
    for (let i = 0; i < 4; i++) curve(g, -40 + i * 18, -96 + Math.abs(i - 1.5) * 4, -36 + i * 18, -84, -40 + i * 18, -72, 'rgba(70,50,40,0.18)', 1.2);
    g.restore();
    quadLeg(g, 30, -52, ph, run, 8, 5, 21, 21, 12.5, 11.5, 11, -1, a.grad, P.line, k, -2);
    quadLeg(g, -28, -54, ph + Math.PI, run, 8, 5, 22, 22, 13.5, 12, 11, 1, a.grad, P.line, k, 2);
    /* tête, défense, trompe, oreille */
    ell(g, 42, -80 + br * 0.5, 23, 22);
    sf(g, a.grad, P.line, k);
    SN[0] = 52; SN[1] = -60; SN[2] = 60; SN[3] = -50; SN[4] = 70; SN[5] = -49; SN[6] = 76; SN[7] = -56;
    tube(g, SN, 2.8, 1.1);
    sf(g, P.tusk, P.line, k);
    SN[0] = 57; SN[1] = -72 + br * 0.5; SN[2] = 68; SN[3] = -62; SN[4] = 68 + curl * 0.6; SN[5] = -38;
    SN[6] = 63 + curl; SN[7] = -22 + Math.abs(curl) * 0.5;
    tube(g, SN, 7.2, 3.4);
    sf(g, a.grad, P.line, k);
    g.save();
    g.clip();
    for (let i = 0; i < 5; i++) {
      const tt = 0.3 + i * 0.14;
      const x = bz(SN[0], SN[2], SN[4], SN[6], tt), y = bz(SN[1], SN[3], SN[5], SN[7], tt);
      curve(g, x - 7, y - 1, x, y + 2.2, x + 7, y - 1, 'rgba(70,50,40,0.25)', 1.1);
    }
    g.restore();
    g.save();
    g.translate(30, -86 + br * 0.5);
    g.rotate(0.12 + flap);
    ell(g, 0, 8, 12.5, 17.5);
    sf(g, P.ear, P.line, k);
    ell(g, 1, 9, 7.5, 11.5);
    g.fillStyle = P.earIn;
    g.fill();
    g.restore();
    ell(g, 55, -73, 3.6, 2.3);
    g.fillStyle = P.cheek;
    g.fill();
    eye(g, 50, -84 + br * 0.5, 4.4, a, k);
  }

  /* ---- humains (dessinés simplement) ---- */
  function humanHead(g, x, y, r, a, k) {
    const P = a.pal;
    /* boucles serrées à l'arrière du crâne */
    g.fillStyle = P.hair;
    for (let i = 0; i < 7; i++) {
      const an = Math.PI * (0.62 + i * 0.16);
      dot(g, x - r * 0.12 + Math.cos(an) * r * 0.86, y - r * 0.08 + Math.sin(an) * r * 0.86, r * 0.42, P.hair);
    }
    ell(g, x + r * 0.08, y + r * 0.04, r, r * 1.02);
    sf(g, P.skin, P.line, k);
    g.save();
    ell(g, x + r * 0.08, y + r * 0.04, r, r * 1.02);
    g.clip();
    ell(g, x - r * 0.38, y - r * 0.5, r * 0.98, r * 0.72, -0.25);
    g.fillStyle = P.hair;
    g.fill();
    g.restore();
    for (let i = 0; i < 5; i++) dot(g, x - r * 0.62 + i * r * 0.32, y - r * 0.86 + Math.abs(i - 1.5) * r * 0.06, r * 0.27, P.hair);
    ell(g, x - r * 0.28, y + r * 0.1, r * 0.2, r * 0.26);
    g.fillStyle = P.skinD;
    g.fill();
    ell(g, x + r * 0.55, y + r * 0.3, r * 0.24, r * 0.15);
    g.fillStyle = P.cheek;
    g.fill();
    if (a.happy > 0.5 || a.blink > 0.6) {
      curve(g, x + r * 0.32, y - r * 0.05, x + r * 0.46, y - r * 0.28, x + r * 0.62, y - r * 0.05, P.line, Math.max(k * 1.5, r * 0.12));
    } else {
      dot(g, x + r * 0.47, y - r * 0.08, r * 0.15, '#1C120C');
      dot(g, x + r * 0.43, y - r * 0.14, r * 0.05, '#FFFFFF');
    }
    curve(g, x + r * 0.4, y + r * 0.46, x + r * 0.58, y + r * 0.6, x + r * 0.76, y + r * 0.42, P.line, Math.max(k * 1.2, r * 0.09));
  }
  function drawSitter(g, a, k) {
    const P = a.pal;
    const br = Math.sin(a.t * 1.7 + a.seed) * 0.7;
    const poke = Math.sin(a.t * 0.9 + a.seed) * 0.08 + a.react * Math.sin(a.t * 12) * 0.12;
    seg(0, -2, -9, 6.5, 15, -15, 5);
    seg(1, 15, -15, 4.8, 19, -4, 4);
    limbs(g, 2, P.skinD, P.line, k);
    g.beginPath();
    g.moveTo(-12, -3);
    g.bezierCurveTo(-14, -18, -9, -34 + br, -1, -38 + br);
    g.bezierCurveTo(7, -40 + br, 12, -32, 11, -14);
    g.bezierCurveTo(11, -8, 6, -3, -12, -3);
    g.closePath();
    sf(g, P.cloth, P.line, k);
    curve(g, -7, -34 + br, 0, -24, 9, -18, P.clothD, 2);
    seg(0, 0, -8, 7, 18, -13, 5.4);
    seg(1, 18, -13, 5.2, 22, -4, 4.3);
    limbs(g, 2, P.skin, P.line, k);
    ell(g, 25, -2.6, 5.4, 2.8);
    sf(g, P.skin, P.line, k);
    g.save();
    g.translate(3, -32 + br);
    g.rotate(poke);
    curve(g, 15, 7, 24, 12, 33, 19, P.line, 2.2 + k * 2);
    curve(g, 15, 7, 24, 12, 33, 19, '#7A5434', 2.2);
    dot(g, 33.5, 19.4, 1.8, '#FFB347');
    seg(0, 0, 0, 4.2, 9, 8, 3.6);
    seg(1, 9, 8, 3.6, 16, 7, 3.2);
    limbs(g, 2, P.skin, P.line, k);
    g.restore();
    humanHead(g, 2, -50 + br, 10.5, a, k);
  }
  function drawChild(g, a, k) {
    const P = a.pal;
    const br = Math.sin(a.t * 2 + a.seed) * 0.6;
    const sway = Math.sin(a.t * 1.1 + a.seed) * 0.05 + a.react * Math.sin(a.t * 14) * 0.08;
    g.save();
    g.rotate(sway);
    g.beginPath();
    g.moveTo(-9, -2);
    g.bezierCurveTo(-11, -14, -7, -25 + br, 0, -27 + br);
    g.bezierCurveTo(6, -28 + br, 9, -22, 8, -10);
    g.bezierCurveTo(8, -5, 4, -2, -9, -2);
    g.closePath();
    sf(g, P.cloth, P.line, k);
    seg(0, 0, -6, 5, 9, -18, 4);
    seg(1, 9, -18, 3.8, 12, -3, 3.2);
    limbs(g, 2, P.skin, P.line, k);
    ell(g, 14, -2, 4, 2.2);
    sf(g, P.skin, P.line, k);
    seg(0, 1, -22 + br, 3.2, 10, -17, 2.8);
    limbs(g, 1, P.skin, P.line, k);
    humanHead(g, 2, -36 + br, 9.5, a, k);
    g.restore();
  }
  function drawStander(g, a, k) {
    const P = a.pal;
    const br = Math.sin(a.t * 1.5 + a.seed) * 0.8;
    const pt = a.point;
    seg(0, -3, -40, 5, -4, -5, 4.2);
    limbs(g, 1, P.skinD, P.line, k);
    ell(g, -1.5, -2.6, 5.2, 2.7);
    sf(g, P.skinD, P.line, k);
    seg(0, 4, -40, 5.2, 5, -5, 4.4);
    limbs(g, 1, P.skin, P.line, k);
    ell(g, 7.5, -2.6, 5.4, 2.8);
    sf(g, P.skin, P.line, k);
    seg(0, -5, -68 + br, 3.8, -8, -50, 3.2);
    seg(1, -8, -50, 3.2, -7, -38, 3);
    limbs(g, 2, P.skinD, P.line, k);
    g.beginPath();
    g.moveTo(-9, -72 + br);
    g.bezierCurveTo(-11, -60, -10, -50, -9, -44);
    g.lineTo(9, -44);
    g.bezierCurveTo(10, -52, 10, -62, 8, -72 + br);
    g.bezierCurveTo(4, -75 + br, -5, -75 + br, -9, -72 + br);
    g.closePath();
    sf(g, P.skin, P.line, k);
    g.beginPath();
    g.moveTo(-10, -50);
    g.bezierCurveTo(-11, -40, -12, -32, -11, -24);
    g.quadraticCurveTo(0, -20, 11, -25);
    g.bezierCurveTo(11, -32, 10, -42, 9, -50);
    g.closePath();
    sf(g, P.cloth, P.line, k);
    g.beginPath();
    g.moveTo(-8, -72 + br);
    g.lineTo(-2, -72 + br);
    g.lineTo(9, -50);
    g.lineTo(3, -50);
    g.closePath();
    sf(g, P.clothD, P.line, k * 0.8);
    humanHead(g, 1, -84 + br, 10.5, a, k);
    /* bras proche : il se lève pour montrer le ciel */
    const ang = lerp(1.45, -0.72, pt) + Math.sin(a.t * 1.3) * 0.04;
    const ex = 5 + Math.cos(ang) * 13, ey = -68 + br + Math.sin(ang) * 13;
    const ang2 = ang - 0.3 * pt;
    const hx = ex + Math.cos(ang2) * 12, hy = ey + Math.sin(ang2) * 12;
    seg(0, 5, -68 + br, 4, ex, ey, 3.4);
    seg(1, ex, ey, 3.4, hx, hy, 3);
    seg(2, hx, hy, 2.6, hx + Math.cos(ang2) * 4.5, hy + Math.sin(ang2) * 4.5, 1.2);
    limbs(g, 3, P.skin, P.line, k);
  }
  /* feu de camp : pierres, bûches, flammes */
  function drawFire(g, x, y, s, t, boost) {
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    const k = 1.1 / s;
    for (let i = 0; i < 7; i++) {
      const an = Math.PI * (1.05 + i * 0.13);
      ell(g, Math.cos(an) * 17, 1 + Math.sin(an) * -2.2 - 1.5, 4.6 - (i % 2), 3.2, 0);
      sf(g, i % 2 ? '#7D7A73' : '#8E8A80', '#4A4640', k);
    }
    seg(0, -15, -1, 3.4, 13, -6, 3);
    seg(1, -13, -6, 3.2, 15, -1, 3.2);
    limbs(g, 2, '#6B4A30', '#3E2A1C', k);
    dot(g, 15, -1, 2.2, '#C89C6A');
    dot(g, -15, -1, 2.2, '#C89C6A');
    g.globalCompositeOperation = 'lighter';
    const fl = (h, w, ox, ph, col, al) => {
      const hh = h * (1 + 0.14 * Math.sin(t * 9 + ph) + 0.08 * Math.sin(t * 13.7 + ph * 2)) * (1 + boost * 0.5);
      const tip = ox + Math.sin(t * 6 + ph) * w * 0.35;
      g.beginPath();
      g.moveTo(ox - w, -2);
      g.bezierCurveTo(ox - w, -hh * 0.45, tip - w * 0.3, -hh * 0.72, tip, -hh);
      g.bezierCurveTo(tip + w * 0.3, -hh * 0.72, ox + w, -hh * 0.45, ox + w, -2);
      g.quadraticCurveTo(ox, w * 0.5, ox - w, -2);
      g.globalAlpha = al;
      g.fillStyle = col;
      g.fill();
    };
    fl(30, 10, -3, 0, '#FF5A24', 0.75);
    fl(26, 9, 5, 2, '#FF7A2E', 0.7);
    fl(22, 7.5, 0, 4, '#FFAE3B', 0.85);
    fl(14, 5, 1, 1, '#FFF0A8', 0.9);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    g.restore();
  }

  /* Caractéristiques de chaque espèce : hauteur de référence, zone à toucher, boîte englobante */
  const KINDS = {
    runner: { h: 86, draw: drawRunner, hit: [-4, -48, 44], box: [-80, -92, 148, 98], sh: 34 },
    feather: { h: 90, draw: drawRunner, hit: [-4, -48, 44], box: [-92, -96, 162, 102], sh: 34 },
    sauro: { h: 232, draw: drawSauro, hit: [6, -110, 100], box: [-218, -246, 384, 252], sh: 92 },
    steg: { h: 104, draw: drawSteg, hit: [-14, -50, 58], box: [-114, -112, 200, 118], sh: 70 },
    trex: { h: 122, draw: drawTrex, hit: [6, -70, 66], box: [-130, -128, 232, 134], sh: 72 },
    trice: { h: 96, draw: drawTrice, hit: [0, -46, 60], box: [-104, -104, 156, 110], sh: 66 },
    bird: { h: 24, draw: drawBird, hit: [0, -2, 20], box: [-24, -26, 48, 40], sh: 0 },
    shrew: { h: 24, draw: drawShrew, hit: [0, -10, 20], box: [-36, -28, 66, 32], sh: 16 },
    deer: { h: 112, draw: drawDeer, hit: [6, -58, 50], box: [-42, -122, 110, 128], sh: 34 },
    mammoth: { h: 118, draw: drawMammoth, hit: [4, -64, 66], box: [-70, -122, 152, 128], sh: 56 },
    sitter: { h: 62, draw: drawSitter, hit: [4, -30, 32], box: [-26, -66, 66, 70], sh: 22 },
    child: { h: 48, draw: drawChild, hit: [2, -24, 26], box: [-22, -52, 44, 56], sh: 16 },
    stander: { h: 98, draw: drawStander, hit: [0, -50, 34], box: [-26, -128, 62, 134], sh: 16 },
  };

  /* ================= Décors (pré-rendus pour chaque époque) ================= */
  function layer(w, h, dpr) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * dpr));
    c.height = Math.max(1, Math.round(h * dpr));
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    g.lineJoin = 'round';
    g.lineCap = 'round';
    return { c, g };
  }
  function skyGrad(g, w, y1, stops) {
    const gr = g.createLinearGradient(0, 0, 0, y1);
    stops.forEach((s) => gr.addColorStop(s[0], s[1]));
    g.fillStyle = gr;
    g.fillRect(0, 0, w, y1 + 1);
  }
  function softEll(g, x, y, rx, ry, col, a) {
    g.save();
    g.translate(x, y);
    g.scale(rx / ry, 1);
    draw.glow(g, 0, 0, ry, col, a);
    g.restore();
  }
  function hills(g, w, bottom, base, amp, sc, nz, sy, col, plateau) {
    g.beginPath();
    g.moveTo(-4, bottom);
    for (let x = -4; x <= w + 4; x += 3) {
      let n = nz.fbm(x / sc + sy * 13.1, sy * 3.7, 4);
      if (plateau) n = n > plateau ? plateau + (n - plateau) * 0.12 : n;
      g.lineTo(x, base - amp * n);
    }
    g.lineTo(w + 4, bottom);
    g.closePath();
    g.fillStyle = col;
    g.fill();
  }
  function groundFill(g, w, y0, y1, stops) {
    const gr = g.createLinearGradient(0, y0, 0, y1);
    stops.forEach((s) => gr.addColorStop(s[0], s[1]));
    g.fillStyle = gr;
    g.fillRect(0, y0, w, y1 - y0);
  }
  function speckle(g, w, y0, y1, n, cols, rnd, smin, smax) {
    for (let i = 0; i < n; i++) {
      const y = y0 + Math.pow(rnd(), 0.8) * (y1 - y0);
      const k = (y - y0) / (y1 - y0);
      g.fillStyle = cols[Math.floor(rnd() * cols.length)];
      const s = lerp(smin, smax, k) * (0.6 + rnd() * 0.8);
      g.fillRect(rnd() * w, y, s, s * 0.6);
    }
  }
  function araucaria(g, x, y, h, col, col2, trunk, rnd) {
    g.strokeStyle = trunk;
    g.lineWidth = Math.max(1.2, h * 0.032);
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x - h * 0.02, y - h * 0.5, x + h * 0.01, y - h * 0.88);
    g.stroke();
    const top = y - h;
    for (let i = 0; i < 7; i++) {
      const ty = top + h * 0.05 + i * h * 0.07;
      const span = h * (0.07 + 0.045 * i) * (0.85 + rnd() * 0.3);
      for (let s = -1; s <= 1; s += 2) {
        g.beginPath();
        g.moveTo(x, ty - h * 0.01);
        g.quadraticCurveTo(x + s * span * 0.6, ty - h * 0.035, x + s * span, ty + h * 0.045);
        g.quadraticCurveTo(x + s * span * 0.55, ty + h * 0.03, x, ty + h * 0.03);
        g.closePath();
        g.fillStyle = s < 0 ? col2 : col;
        g.fill();
      }
    }
    ell(g, x, top + h * 0.03, h * 0.04, h * 0.055);
    g.fillStyle = col;
    g.fill();
  }
  function frond(g, x, y, ang, len, droop, col, wd) {
    const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len;
    const cx = x + Math.cos(ang) * len * 0.55, cy = y + Math.sin(ang) * len * 0.55 - len * 0.16;
    leaf(g, x, y, cx, cy + droop * len * 0.1, ex, ey + droop * len * 0.42, wd || len * 0.24, true);
    g.fillStyle = col;
    g.fill();
  }
  function fernBush(g, x, y, s, col, col2, rnd) {
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.4 + (rnd() - 0.5) * 0.15;
      frond(g, x, y, a, s * (0.75 + rnd() * 0.35), Math.abs(i - 3) * 0.35, i % 2 ? col : col2);
    }
  }
  function treeFern(g, x, y, h, col, col2, trunk, rnd) {
    g.strokeStyle = trunk;
    g.lineWidth = Math.max(1.5, h * 0.05);
    const tx = x + h * 0.05;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x - h * 0.04, y - h * 0.5, tx, y - h);
    g.stroke();
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI / 2 + (i - 4) * 0.36;
      frond(g, tx, y - h, a, h * (0.42 + rnd() * 0.12), 0.6 + Math.abs(i - 4) * 0.25, i % 2 ? col : col2);
    }
  }
  function cycad(g, x, y, h, col, col2, trunk, rnd) {
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI / 2 + (i - 4) * 0.33 + (rnd() - 0.5) * 0.1;
      frond(g, x, y - h * 0.32, a, h * (0.62 + rnd() * 0.2), 0.25 + Math.abs(i - 4) * 0.12, i % 2 ? col : col2, h * 0.16);
    }
    ell(g, x, y - h * 0.16, h * 0.11, h * 0.18);
    g.fillStyle = trunk;
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.18)';
    g.lineWidth = 1;
    for (let j = 0; j < 4; j++) curve(g, x - h * 0.1, y - h * (0.04 + j * 0.07), x, y - h * (0.0 + j * 0.07), x + h * 0.1, y - h * (0.04 + j * 0.07), 'rgba(0,0,0,0.2)', 1);
  }
  function horsetail(g, x, y, h, col, rnd) {
    for (let j = 0; j < 5; j++) {
      const sx = x + (j - 2) * h * 0.07, hh = h * (0.6 + rnd() * 0.45), lean = (rnd() - 0.5) * 0.2;
      g.strokeStyle = col;
      g.lineWidth = Math.max(1, h * 0.035);
      g.beginPath();
      g.moveTo(sx, y);
      g.lineTo(sx + lean * hh, y - hh);
      g.stroke();
      g.lineWidth = Math.max(0.6, h * 0.016);
      for (let n = 1; n < 6; n++) {
        const t = n / 6;
        const nx = sx + lean * hh * t, ny = y - hh * t;
        const l = h * 0.09 * (1 - t * 0.5);
        g.beginPath();
        g.moveTo(nx - l, ny + l * 0.6);
        g.lineTo(nx, ny);
        g.lineTo(nx + l, ny + l * 0.6);
        g.stroke();
      }
    }
  }
  function palm(g, x, y, h, col, col2, trunk, lean, rnd) {
    const tx = x + lean * h, ty = y - h;
    g.strokeStyle = trunk;
    g.lineWidth = Math.max(1.6, h * 0.05);
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + lean * h * 0.2, y - h * 0.6, tx, ty);
    g.stroke();
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI / 2 + (i - 3.5) * 0.45 + (rnd() - 0.5) * 0.1;
      frond(g, tx, ty, a, h * (0.4 + rnd() * 0.1), 0.9 + Math.abs(i - 3.5) * 0.2, i % 2 ? col : col2, h * 0.11);
    }
  }
  function roundTree(g, x, y, h, cols, trunk, rnd, flowers) {
    g.strokeStyle = trunk;
    g.lineWidth = Math.max(1.5, h * 0.06);
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + h * 0.03, y - h * 0.35, x - h * 0.02, y - h * 0.55);
    g.moveTo(x + h * 0.01, y - h * 0.38);
    g.quadraticCurveTo(x + h * 0.12, y - h * 0.45, x + h * 0.16, y - h * 0.6);
    g.stroke();
    const blobs = [[-0.2, 0.62, 0.24], [0.18, 0.66, 0.24], [0, 0.8, 0.27], [-0.26, 0.82, 0.18], [0.26, 0.84, 0.18], [0.02, 0.98, 0.2]];
    for (let pass = 0; pass < 3; pass++) {
      for (const [bx, by, br] of blobs) {
        const r = h * br * (pass === 0 ? 1 : pass === 1 ? 0.78 : 0.42);
        const ox = pass === 2 ? -r * 0.5 : pass === 1 ? -r * 0.12 : 0;
        const oy = pass === 2 ? -r * 0.55 : pass === 1 ? -r * 0.15 : 0;
        draw.blob(g, x + bx * h + ox, y - by * h + oy, r, 0.08, bx * 9 + by, 0, 18);
        g.fillStyle = cols[pass];
        g.fill();
      }
    }
    if (flowers) {
      for (let i = 0; i < 26; i++) {
        const b = blobs[Math.floor(rnd() * blobs.length)];
        const an = rnd() * TAU, rr = Math.sqrt(rnd()) * b[2] * h * 0.85;
        flower(g, x + b[0] * h + Math.cos(an) * rr, y - b[1] * h + Math.sin(an) * rr, Math.max(1.4, h * 0.022), flowers[i % flowers.length], '#FFE680');
      }
    }
  }
  function flower(g, x, y, r, col, center) {
    g.fillStyle = col;
    for (let i = 0; i < 5; i++) {
      const an = (i / 5) * TAU;
      ell(g, x + Math.cos(an) * r * 0.75, y + Math.sin(an) * r * 0.75, r * 0.62, r * 0.62);
      g.fill();
    }
    dot(g, x, y, r * 0.42, center);
  }
  function acacia(g, x, y, h, col, rnd) {
    g.strokeStyle = col;
    g.lineWidth = Math.max(1.5, h * 0.05);
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + h * 0.02, y - h * 0.4, x - h * 0.02, y - h * 0.55);
    g.moveTo(x - h * 0.01, y - h * 0.5);
    g.quadraticCurveTo(x - h * 0.2, y - h * 0.62, x - h * 0.34, y - h * 0.78);
    g.moveTo(x - h * 0.01, y - h * 0.52);
    g.quadraticCurveTo(x + h * 0.18, y - h * 0.66, x + h * 0.32, y - h * 0.8);
    g.stroke();
    g.fillStyle = col;
    const parts = [[-0.32, 0.82, 0.3], [0.3, 0.84, 0.32], [0, 0.88, 0.36], [-0.12, 0.94, 0.26], [0.16, 0.95, 0.24]];
    for (const [px, py, pw] of parts) {
      ell(g, x + px * h, y - py * h, pw * h, pw * h * 0.24 * (0.85 + rnd() * 0.3));
      g.fill();
    }
  }
  function rock(g, x, y, r, col, hi, rnd) {
    draw.blob(g, x, y - r * 0.45, r, 0.14, rnd() * 9, 0, 16);
    g.fillStyle = col;
    g.fill();
    g.save();
    g.clip();
    ell(g, x - r * 0.3, y - r * 0.85, r * 0.7, r * 0.4, -0.2);
    g.fillStyle = hi;
    g.fill();
    g.restore();
  }
  function grass(g, x, y, h, col, rnd) {
    g.strokeStyle = col;
    g.lineWidth = Math.max(0.8, h * 0.08);
    for (let i = 0; i < 5; i++) {
      const dx = (i - 2) * h * 0.12, lean = (i - 2) * h * 0.18 + (rnd() - 0.5) * h * 0.2;
      g.beginPath();
      g.moveTo(x + dx, y);
      g.quadraticCurveTo(x + dx + lean * 0.3, y - h * 0.6, x + dx + lean, y - h * (0.8 + rnd() * 0.3));
      g.stroke();
    }
  }
  function clouds(g, w, list, col, a) {
    list.forEach(([cx, cy, s, h]) => {
      for (let i = 0; i < 6; i++) {
        const x = (cx + (i - 2.5) * s * 0.27 + Math.sin(i * 2.3) * 0.02) * w;
        softEll(g, x, cy + Math.sin(i * 1.7) * h * 0.25, s * w * (0.36 + Math.abs(Math.sin(i * 3.1)) * 0.2), h, col, a);
      }
    });
  }
  function grain(g, w, h, rnd, n) {
    for (let i = 0; i < n; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
      g.fillRect(rnd() * w, rnd() * h, 1.2, 1.2);
    }
    /* un peu d'ombre au premier plan et sur les bords : de la profondeur */
    const vg = g.createLinearGradient(0, h * 0.72, 0, h);
    vg.addColorStop(0, 'rgba(8,20,18,0)');
    vg.addColorStop(1, 'rgba(8,20,18,0.24)');
    g.fillStyle = vg;
    g.fillRect(0, h * 0.72, w, h * 0.28 + 1);
    const sg = g.createRadialGradient(w / 2, h * 0.55, Math.min(w, h) * 0.35, w / 2, h * 0.55, Math.max(w, h) * 0.85);
    sg.addColorStop(0, 'rgba(8,20,18,0)');
    sg.addColorStop(1, 'rgba(8,20,18,0.2)');
    g.fillStyle = sg;
    g.fillRect(0, 0, w, h);
  }

  /* 0. Il y a 230 millions d'années : une plaine sèche et rouge, au lever du soleil */
  function paintTrias(g, w, L, hz, U) {
    const nz = lib.makeNoise(11), rnd = nz.rnd;
    skyGrad(g, w, hz + 2, [[0, '#2A5960'], [0.42, '#B4846B'], [0.8, '#EDB884'], [1, '#F8DBA5']]);
    const sx = w * 0.24, sy = hz - L * 0.05;
    draw.glow(g, sx, sy, L * 0.6, '#FFD9A0', 0.34);
    draw.glow(g, sx, sy, L * 0.13, '#FFEBC8', 0.65);
    draw.glow(g, sx, sy, L * 0.035, '#FFFAEC', 1);
    clouds(g, w, [[0.66, L * 0.3, 0.3, L * 0.018], [0.2, L * 0.36, 0.2, L * 0.014], [0.86, L * 0.42, 0.2, L * 0.012]], '#FFE6C4', 0.4);
    hills(g, w, hz + 2, hz - L * 0.01, L * 0.16, 70 * U, nz, 1, '#C08C7C', 0.55);
    hills(g, w, hz + 2, hz + 3, L * 0.09, 42 * U, nz, 2, '#9E6352', 0.62);
    groundFill(g, w, hz, L + 6, [[0, '#C98A5E'], [0.45, '#A9633F'], [1, '#7C412A']]);
    for (let i = 0; i < 26; i++) {
      const y = hz + 4 + Math.pow(rnd(), 1.4) * (L - hz);
      softEll(g, rnd() * w, y, (20 + rnd() * 50) * U, (1 + rnd() * 2) * U, rnd() < 0.5 ? '#E3A777' : '#6E3A26', 0.25);
    }
    speckle(g, w, hz + 2, L + 4, 700, ['rgba(70,30,18,0.4)', 'rgba(240,190,140,0.35)', 'rgba(110,55,32,0.4)'], rnd, 0.6, 2.4);
    /* une mare au loin, entourée de prêles et de fougères */
    const px = w * 0.64, py = hz + L * 0.05;
    ell(g, px, py, w * 0.15, L * 0.02);
    g.fillStyle = '#86BDB2';
    g.fill();
    ell(g, px - w * 0.02, py - L * 0.004, w * 0.09, L * 0.007);
    g.fillStyle = 'rgba(240,250,240,0.5)';
    g.fill();
    horsetail(g, px - w * 0.15, py + 2, 24 * U, '#5F8B48', rnd);
    horsetail(g, px + w * 0.14, py + 1, 20 * U, '#6E9A52', rnd);
    fernBush(g, px + w * 0.06, py + L * 0.014, 13 * U, '#5C8A43', '#7AA756', rnd);
    araucaria(g, w * 0.88, hz + 6, L * 0.34, '#3A5B3E', '#2F4C34', '#4A3424', rnd);
    araucaria(g, w * 0.97, hz + 8, L * 0.26, '#35553A', '#2B4630', '#4A3424', rnd);
    araucaria(g, w * 0.06, hz + 5, L * 0.22, '#3E6043', '#33503A', '#4A3424', rnd);
    /* fentes de la terre sèche */
    g.strokeStyle = 'rgba(80,36,20,0.28)';
    g.lineWidth = 1;
    for (let i = 0; i < 14; i++) {
      let x = rnd() * w, y = hz + L * 0.08 + rnd() * (L - hz - L * 0.1);
      g.beginPath();
      g.moveTo(x, y);
      for (let j = 0; j < 4; j++) {
        x += (rnd() - 0.3) * 16 * U;
        y += (rnd() - 0.5) * 3 * U;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    rock(g, w * 0.1, L * 0.99, 18 * U, '#8C553F', 'rgba(255,214,170,0.3)', rnd);
    rock(g, w * 0.94, L * 0.97, 14 * U, '#7E4B37', 'rgba(255,214,170,0.28)', rnd);
    rock(g, w * 0.46, L * 0.77, 7 * U, '#9A5E45', 'rgba(255,214,170,0.3)', rnd);
    rock(g, w * 0.3, L * 0.7, 5 * U, '#9A5E45', 'rgba(255,214,170,0.3)', rnd);
    rock(g, w * 0.8, L * 0.74, 6 * U, '#94583F', 'rgba(255,214,170,0.28)', rnd);
    fernBush(g, w * 0.26, L * 0.71, 12 * U, '#5C8A43', '#77A456', rnd);
    fernBush(g, w * 0.83, L * 0.75, 14 * U, '#557F3F', '#6E9A4E', rnd);
    horsetail(g, w * 0.36, L * 0.69, 14 * U, '#6E9A52', rnd);
    fernBush(g, w * 0.02, L + 4, 30 * U, '#4F7E3E', '#6B9A4C', rnd);
    horsetail(g, w * 0.99, L + 2, 34 * U, '#5A8644', rnd);
    grain(g, w, L, rnd, 900);
  }

  /* 1. Vers 150 millions d'années : une forêt chaude et humide au bord d'un lac */
  function paintJura(g, w, L, hz, U, T) {
    const nz = lib.makeNoise(23), rnd = nz.rnd;
    skyGrad(g, w, hz + 2, [[0, '#285F62'], [0.5, '#7FC1AE'], [1, '#E2F0C9']]);
    draw.glow(g, w * 0.78, L * 0.18, L * 0.5, '#FFF4D2', 0.3);
    clouds(g, w, [[0.3, L * 0.22, 0.32, L * 0.02], [0.8, L * 0.32, 0.25, L * 0.016]], '#F2FAEA', 0.4);
    hills(g, w, hz + 2, hz - L * 0.03, L * 0.15, 80 * U, nz, 1, '#8DBCAA', 0);
    hills(g, w, hz + 2, hz - L * 0.0, L * 0.09, 50 * U, nz, 2, '#6CA48A', 0);
    /* lac */
    const ly = hz + 1;
    const lg = g.createLinearGradient(0, ly, 0, ly + L * 0.07);
    lg.addColorStop(0, '#CFEADB');
    lg.addColorStop(1, '#79B7A6');
    g.fillStyle = lg;
    g.fillRect(0, ly - 1, w, L * 0.07);
    for (let i = 0; i < 18; i++) softEll(g, rnd() * w, ly + rnd() * L * 0.06, (8 + rnd() * 26) * U, 0.9 * U, '#FFFFFF', 0.35);
    /* lisière : conifères et fougères arborescentes */
    for (let i = 0; i < 16; i++) {
      const x = (i / 15) * w + (rnd() - 0.5) * w * 0.05;
      const h = L * (0.1 + rnd() * 0.12);
      if (i % 3 === 0) treeFern(g, x, ly + 2, h * 0.8, '#3F7A5A', '#34684C', '#3B2E22', rnd);
      else araucaria(g, x, ly + 2, h, '#3A7054', '#2F5F47', '#3B2E22', rnd);
    }
    groundFill(g, w, ly + L * 0.06, L + 6, [[0, '#6FAA58'], [0.4, '#53904A'], [1, '#356C36']]);
    speckle(g, w, ly + L * 0.06, L + 4, 650, ['rgba(20,60,30,0.35)', 'rgba(200,240,160,0.3)', 'rgba(40,90,45,0.35)'], rnd, 0.6, 2.2);
    for (let i = 0; i < 40; i++) grass(g, rnd() * w, ly + L * 0.08 + Math.pow(rnd(), 0.7) * (L - ly), (4 + rnd() * 6) * U, rnd() < 0.5 ? '#3F7D3D' : '#7DB85C', rnd);
    /* le grand arbre où le géant vient brouter */
    araucaria(g, T.x, T.base, T.base - T.top, '#2F6B4C', '#285D41', '#4A3626', rnd);
    treeFern(g, w * 0.08, L * 0.8, L * 0.3, '#3E8152', '#4F9460', '#4A3626', rnd);
    cycad(g, w * 0.03, L + 2, 40 * U, '#4F9356', '#64A866', '#7A5A3A', rnd);
    cycad(g, w * 0.97, L + 4, 34 * U, '#4A8C52', '#5FA062', '#7A5A3A', rnd);
    fernBush(g, w * 0.5, L + 6, 26 * U, '#4A8A47', '#64A55A', rnd);
    grain(g, w, L, rnd, 900);
  }

  /* 2 et 3. Fin du Crétacé : prairie fleurie au soleil… puis le même paysage sous la poussière */
  function paintCreta(g, w, L, hz, U, dark) {
    const nz = lib.makeNoise(37), rnd = nz.rnd;
    if (!dark) {
      skyGrad(g, w, hz + 2, [[0, '#356585'], [0.48, '#D9AE80'], [1, '#FCE6B2']]);
      draw.glow(g, w * 0.2, hz - L * 0.12, L * 0.55, '#FFE2A8', 0.4);
      draw.glow(g, w * 0.2, hz - L * 0.12, L * 0.05, '#FFF6DE', 0.95);
      clouds(g, w, [[0.62, L * 0.28, 0.3, L * 0.02], [0.18, L * 0.38, 0.18, L * 0.012]], '#FFF1D8', 0.45);
    } else {
      skyGrad(g, w, hz + 2, [[0, '#1B1718'], [0.5, '#3E2E2B'], [1, '#7A4A33']]);
      draw.glow(g, w * 0.86, hz, L * 0.5, '#B8452A', 0.45);
      draw.glow(g, w * 0.86, hz, L * 0.15, '#FF8A4A', 0.35);
      clouds(g, w, [[0.5, L * 0.22, 0.6, L * 0.05], [0.3, L * 0.38, 0.5, L * 0.04], [0.75, L * 0.42, 0.5, L * 0.035]], '#6A5048', 0.45);
    }
    hills(g, w, hz + 2, hz - L * 0.02, L * 0.14, 75 * U, nz, 1, dark ? '#3A2F2C' : '#94B07E', 0);
    hills(g, w, hz + 2, hz + 1, L * 0.08, 48 * U, nz, 2, dark ? '#2E2624' : '#76A064', 0);
    groundFill(g, w, hz, L + 6, dark ? [[0, '#5A4A3C'], [0.5, '#45382E'], [1, '#2E2520']] : [[0, '#9CBE63'], [0.5, '#76A24C'], [1, '#527E37']]);
    speckle(g, w, hz + 2, L + 4, 700, dark ? ['rgba(150,140,130,0.35)', 'rgba(20,14,10,0.4)'] : ['rgba(40,80,30,0.35)', 'rgba(240,250,200,0.3)'], rnd, 0.6, 2.4);
    const leafC = dark ? ['#2E2A26', '#3A332D', '#4A4038'] : ['#3F7A45', '#559455', '#79B465'];
    const fl = dark ? null : ['#FF8FB1', '#FFFFFF', '#FFC3D5'];
    palm(g, w * 0.07, hz + L * 0.03, L * 0.26, dark ? '#2C2724' : '#4B8A4A', dark ? '#383029' : '#5E9C55', dark ? '#2A2220' : '#6B5238', 0.12, rnd);
    roundTree(g, w * 0.3, hz + L * 0.02, L * 0.2, leafC, dark ? '#2A2220' : '#5A4232', rnd, fl);
    palm(g, w * 0.92, hz + L * 0.04, L * 0.3, dark ? '#2C2724' : '#4B8A4A', dark ? '#383029' : '#5E9C55', dark ? '#2A2220' : '#6B5238', -0.14, rnd);
    roundTree(g, w * 0.76, hz + L * 0.02, L * 0.16, leafC, dark ? '#2A2220' : '#5A4232', rnd, fl);
    for (let i = 0; i < 46; i++) grass(g, rnd() * w, hz + L * 0.05 + Math.pow(rnd(), 0.7) * (L - hz), (4 + rnd() * 6) * U, dark ? '#4A3E34' : (rnd() < 0.5 ? '#5F9440' : '#A6CC6A'), rnd);
    if (!dark) {
      for (let i = 0; i < 70; i++) {
        const y = hz + L * 0.06 + Math.pow(rnd(), 0.8) * (L - hz - L * 0.06);
        const s = lerp(1.2, 3.2, (y - hz) / (L - hz)) * U;
        flower(g, rnd() * w, y, s, ['#FF8FB1', '#FFFFFF', '#FFE45C', '#FFB4CB'][i % 4], '#FFD34D');
      }
    }
    const bushC = dark ? ['#2A2622', '#352F29', '#433A32'] : ['#3E7843', '#4F9150', '#6EAE5E'];
    for (const [bx, by, bs] of [[0.02, 1.0, 34], [0.98, 0.99, 30], [0.5, 1.02, 24]]) {
      roundTree(g, bx * w, by * L + bs * U * 0.6, bs * U * 1.6, bushC, 'rgba(0,0,0,0)', rnd, dark ? null : ['#FF8FB1', '#FFFFFF']);
    }
    grain(g, w, L, rnd, 900);
  }

  /* 4. Après les dinosaures : prairie et forêt de feuillus, ciel dégagé */
  function paintCeno(g, w, L, hz, U) {
    const nz = lib.makeNoise(53), rnd = nz.rnd;
    skyGrad(g, w, hz + 2, [[0, '#2D6A8A'], [0.55, '#89C3D8'], [1, '#E8F2D8']]);
    draw.glow(g, w * 0.82, L * 0.16, L * 0.5, '#FFF6D8', 0.35);
    for (const [cx, cy, s] of [[0.25, 0.26, 1], [0.7, 0.34, 0.75]]) {
      for (let i = 0; i < 7; i++) {
        const x = cx * w + (i - 3) * 12 * U * s, y = cy * L - Math.sin((i / 6) * Math.PI) * 9 * U * s;
        dot(g, x, y + 3 * U, (8 + Math.sin(i * 2.1) * 3) * U * s, 'rgba(200,225,235,0.8)');
        dot(g, x - 1.5 * U, y, (8 + Math.sin(i * 2.1) * 3) * U * s, 'rgba(255,255,255,0.88)');
      }
    }
    hills(g, w, hz + 2, hz - L * 0.04, L * 0.15, 85 * U, nz, 1, '#9CC18A', 0);
    hills(g, w, hz + 2, hz - L * 0.0, L * 0.09, 55 * U, nz, 2, '#79A866', 0);
    groundFill(g, w, hz, L + 6, [[0, '#94BF62'], [0.5, '#76A64B'], [1, '#527F36']]);
    speckle(g, w, hz + 2, L + 4, 650, ['rgba(40,80,30,0.35)', 'rgba(240,250,200,0.3)'], rnd, 0.6, 2.3);
    const leaf1 = ['#3E7A3E', '#55944C', '#86BD62'];
    const leaf2 = ['#4A8040', '#629C4E', '#94C66C'];
    roundTree(g, w * 0.06, hz + L * 0.04, L * 0.28, leaf1, '#5E4630', rnd, null);
    roundTree(g, w * 0.18, hz + L * 0.02, L * 0.18, leaf2, '#5E4630', rnd, null);
    roundTree(g, w * 0.95, hz + L * 0.05, L * 0.3, leaf2, '#5E4630', rnd, null);
    roundTree(g, w * 0.84, hz + L * 0.01, L * 0.15, leaf1, '#5E4630', rnd, null);
    for (let i = 0; i < 60; i++) grass(g, rnd() * w, hz + L * 0.05 + Math.pow(rnd(), 0.7) * (L - hz), (5 + rnd() * 7) * U, rnd() < 0.5 ? '#5F9440' : '#A8CF6E', rnd);
    for (let i = 0; i < 24; i++) {
      const y = hz + L * 0.08 + Math.pow(rnd(), 0.8) * (L - hz - L * 0.08);
      flower(g, rnd() * w, y, lerp(1, 2.6, (y - hz) / (L - hz)) * U, i % 2 ? '#FFFFFF' : '#FFE45C', '#FFC94D');
    }
    rock(g, w * 0.04, L + 2, 16 * U, '#7F7E72', 'rgba(255,255,240,0.3)', rnd);
    grain(g, w, L, rnd, 900);
  }

  /* 5. Il y a environ 300 000 ans, en Afrique : la savane au crépuscule */
  function paintAfrique(g, w, L, hz, U) {
    const nz = lib.makeNoise(71), rnd = nz.rnd;
    skyGrad(g, w, hz + 2, [[0, '#151E44'], [0.4, '#4F3C6E'], [0.74, '#C0667A'], [1, '#FFB46A']]);
    for (let i = 0; i < 80; i++) {
      const y = Math.pow(rnd(), 1.5) * hz * 0.6;
      g.fillStyle = `rgba(255,250,235,${(0.35 + rnd() * 0.6) * (1 - y / (hz * 0.6))})`;
      const s = rnd() < 0.15 ? 1.6 : 0.9;
      g.fillRect(rnd() * w, y, s, s);
    }
    draw.glow(g, w * 0.62, hz, L * 0.6, '#FF9E5A', 0.45);
    draw.glow(g, w * 0.62, hz, L * 0.12, '#FFE0A0', 0.6);
    clouds(g, w, [[0.3, L * 0.36, 0.4, L * 0.012], [0.8, L * 0.4, 0.3, L * 0.01]], '#FFC08A', 0.35);
    hills(g, w, hz + 2, hz - L * 0.01, L * 0.12, 90 * U, nz, 1, '#6F4660', 0.5);
    hills(g, w, hz + 2, hz + 2, L * 0.06, 60 * U, nz, 2, '#553447', 0.55);
    groundFill(g, w, hz, L + 6, [[0, '#B98451'], [0.45, '#94663C'], [1, '#5E3F26']]);
    speckle(g, w, hz + 2, L + 4, 600, ['rgba(60,35,20,0.35)', 'rgba(255,220,160,0.3)'], rnd, 0.6, 2.2);
    acacia(g, w * 0.86, hz + L * 0.03, L * 0.27, '#2C2030', rnd);
    acacia(g, w * 0.12, hz + L * 0.01, L * 0.14, '#3A2A38', rnd);
    acacia(g, w * 0.33, hz + 1, L * 0.08, '#4A3444', rnd);
    for (let i = 0; i < 90; i++) {
      const y = hz + L * 0.03 + Math.pow(rnd(), 0.6) * (L - hz);
      grass(g, rnd() * w, y, lerp(3, 12, (y - hz) / (L - hz)) * U, rnd() < 0.5 ? '#D9A85E' : '#A87A44', rnd);
    }
    grain(g, w, L, rnd, 900);
  }

  /* bande du bas : les couches de roche où est gravée la frise */
  function paintBand(w, hb, dpr) {
    const { c, g } = layer(w, hb, dpr);
    const nz = lib.makeNoise(91), rnd = nz.rnd;
    const strata = ['#3A2D23', '#2E2620', '#36302A', '#29241F', '#322B25', '#25211C', '#2B2620'];
    g.fillStyle = '#211C17';
    g.fillRect(0, 0, w, hb);
    for (let i = 0; i < strata.length; i++) {
      const y0 = (i / strata.length) * hb;
      g.beginPath();
      g.moveTo(-2, hb + 2);
      for (let x = -2; x <= w + 4; x += 4) g.lineTo(x, y0 + (i ? (nz.fbm(x / 70 + i * 3.1, i * 1.7, 3) - 0.5) * hb * 0.16 : 0));
      g.lineTo(w + 4, hb + 2);
      g.closePath();
      g.fillStyle = strata[i];
      g.fill();
    }
    for (let i = 0; i < (w * hb) / 30; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(255,240,220,0.06)' : 'rgba(0,0,0,0.18)';
      const s = 0.6 + rnd() * 1.4;
      g.fillRect(rnd() * w, rnd() * hb, s, s * 0.7);
    }
    /* petits fossiles : ammonites et coquillages */
    g.strokeStyle = 'rgba(214,190,160,0.16)';
    g.lineWidth = 1;
    for (let i = 0; i < Math.round(w / 90); i++) {
      const x = (i + 0.3 + rnd() * 0.4) * (w / Math.round(w / 90)), y = hb * (0.2 + rnd() * 0.7), r = 3 + rnd() * 3;
      g.beginPath();
      for (let th = 0; th < 4 * Math.PI; th += 0.3) {
        const rr = r * Math.exp(-0.16 * (4 * Math.PI - th));
        const px = x + Math.cos(th) * rr, py = y + Math.sin(th) * rr;
        if (th === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.stroke();
    }
    const sh = g.createLinearGradient(0, 0, 0, 16);
    sh.addColorStop(0, 'rgba(0,0,0,0.5)');
    sh.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sh;
    g.fillRect(0, 0, w, 16);
    g.fillStyle = 'rgba(255,236,200,0.14)';
    g.fillRect(0, 0, w, 1.2);
    return c;
  }

  /* ================= Le jeu ================= */
  window.RM.games.dinos = function (api) {
    const stage = api.stage;
    const CALM = api.reducedMotion;
    api.style(CSS);
    const cv = api.canvas();
    const ctx = cv.ctx;
    const COL = {
      acc: api.css('--accent') || '#FFA94D',
      acc2: api.css('--accent-2') || '#C7E86B',
      fg: api.css('--fg') || '#EFF8F2',
    };
    const SEG_COL = [COL.acc2, '#E8B86E', '#FFE45C']; /* dinosaures, mammifères, humains */

    /* ---- étiquette de l'époque, bouts de la frise, boutons ---- */
    const label = document.createElement('p');
    label.className = 'dn-label';
    label.setAttribute('aria-live', 'polite');
    label.innerHTML = '<span class="dn-when"></span><span class="dn-title"></span><span class="dn-text"></span>';
    stage.appendChild(label);
    const elWhen = label.querySelector('.dn-when');
    const elTitle = label.querySelector('.dn-title');
    const elText = label.querySelector('.dn-text');
    const endL = document.createElement('p');
    endL.className = 'dn-end';
    endL.textContent = lib.fr(TEXTES.debut);
    const endR = document.createElement('p');
    endR.className = 'dn-end';
    endR.textContent = lib.fr(TEXTES.aujourdhui);
    stage.append(endL, endR);

    const nav = document.createElement('div');
    nav.className = 'dn-nav';
    const btnPrev = document.createElement('button');
    btnPrev.type = 'button';
    btnPrev.className = 'chip dn-prev';
    btnPrev.textContent = TEXTES.precedent;
    btnPrev.setAttribute('aria-label', TEXTES.ariaPrecedent);
    const btnNext = document.createElement('button');
    btnNext.type = 'button';
    btnNext.className = 'chip dn-next';
    btnNext.textContent = TEXTES.suivant;
    btnNext.setAttribute('aria-label', TEXTES.ariaSuivant);
    nav.append(btnPrev, btnNext);
    stage.insertAdjacentElement('afterend', nav);

    function setLabelText(i, phase2) {
      const m = TEXTES.moments[i];
      elWhen.textContent = lib.fr(m.quand);
      elTitle.textContent = lib.fr(phase2 ? m.titre2 : m.titre);
      elText.textContent = lib.fr(phase2 ? m.texte2 : m.texte);
    }

    /* ---- géométrie ---- */
    const G = { w: 1, h: 1, L: 1, Hb: 1, hz: 1, U: 1, x0: 0, x1: 1, ty: 0, th: 8, iy: 0, ir: 16, safeTop: 90, lensR: 50, lensX: 0, lensY: 0 };
    const TREE = { x: 0, top: 0, base: 0 };
    const icx = new Float32Array(N); /* centre des médaillons */
    let bgs = new Array(7).fill(null);
    let band = null;
    let snap = null, snapB = null;
    let icons = null;
    let buf = null, bufCtx = null;
    const SPR = {};

    const X = (f) => G.x0 + f * (G.x1 - G.x0);

    function sprite(col, size, a0, a1) {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const g = c.getContext('2d');
      const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      gr.addColorStop(0, rgba(col, a0));
      gr.addColorStop(0.35, rgba(col, a1));
      gr.addColorStop(1, rgba(col, 0));
      g.fillStyle = gr;
      g.fillRect(0, 0, size, size);
      return c;
    }
    SPR.shadow = sprite('#081614', 64, 0.6, 0.38);
    SPR.warm = sprite('#FF9A3C', 128, 0.9, 0.35);
    SPR.light = sprite('#FFF1C2', 128, 1, 0.4);
    SPR.puff = sprite('#4C3B33', 64, 0.9, 0.55);
    SPR.ember = sprite('#FFB14A', 32, 1, 0.5);
    SPR.puffHot = sprite('#FF6A2A', 64, 0.8, 0.35);

    /* ---- les acteurs ---- */
    const actors = [];
    const P = {
      orange: pal('#FF9E45', '#FFE6B8', '#E0762A'),
      teal: pal('#3FBFAE', '#DDF6EA', '#2A9A8A'),
      lime: pal('#A9D24F', '#F1F8D4', '#82AE36'),
      feather: pal('#3D9FD0', '#E4F4FA', '#2B7FAD', { feather: '#FFA94D', feather2: '#FFD166' }),
      sauro: pal('#DDA65E', '#F7E5C0', '#B98340'),
      sauroFar: pal('#CDB18C', '#EFE3CB', '#B59A76', { line: 'rgba(120,96,70,0.9)' }),
      steg: pal('#7DB35A', '#E7F2C6', '#5F9442', { plate: '#FF9A45', plateFar: '#D9782F', spike: '#FFF1D6', spikeFar: '#D9C9AE' }),
      trex: pal('#58AE8E', '#EAF2C8', '#3F8C70'),
      trice: pal('#EE8B5C', '#FCE2C8', '#CF6B40', { frill: '#FFC560', frill2: '#F39A4B', frillDot: '#C7E86B', horn: '#FFF3DC', hornFar: '#E3D3B8', beak: '#9B6A50' }),
      birdB: pal('#4FA8E0', '#FFB25B', '#2F86BE', { tail: '#2F86BE', wing: '#3A93CF', beak: '#FFC24D' }),
      birdY: pal('#FFD25E', '#FFF2C4', '#E0A93A', { tail: '#3FBFAE', wing: '#3FBFAE', beak: '#FF9E45' }),
      shrew: pal('#B98458', '#F2DFC6', '#946540', { tail: '#D9A7A0', ear: '#F2A3A3' }),
      deer: pal('#C98E55', '#F4E1C4', '#A06E3C', { antler: '#EADBC0' }),
      mammoth: pal('#A08E84', '#D2C5BB', '#7E6E64', { ear: '#B29F94', earIn: '#D9A9A0', tusk: '#FFF6E6' }),
    };
    function humanPal(skin, cloth) {
      return {
        skin, skinD: mix(skin, '#1A0E08', 0.22), hair: '#24170F', cloth, clothD: mix(cloth, '#1A0E08', 0.28),
        line: mix(skin, '#120A06', 0.6), cheek: 'rgba(214,92,82,0.4)', iris: '#2A1A10',
      };
    }
    P.h1 = humanPal('#8A5A3C', '#C98A4B');
    P.h2 = humanPal('#A06B48', '#D9A55A');
    P.h3 = humanPal('#6E4430', '#A65E3F');

    function addActor(kind, mask, o) {
      const a = Object.assign({
        kind, mask, alpha: 0, vis: 0, fx: 0.5, gy: 0.85, size: 60, dir: 1, dirK: 1, t: rand(10), seed: rand(TAU),
        phase: rand(TAU), gait: 0, blink: 0, blinkK: 0, blinkT: rand(1, 4), happy: 0, react: 0, hopT: 9, hopH: 10, lift: 0,
        nod: 0, nodY: 0, lookX: 0, lookY: 0, lookUp: 0, graze: 0, eat: 0, wave: 0, point: 0, grow: 1, perch: false,
        x: 0, y: 0, s: 1, state: 'idle', timer: rand(1, 3), speed: 0,
      }, o);
      a.home = { fx: a.fx, dir: a.dir };
      a.spec = KINDS[kind];
      prep(a, ctx);
      actors.push(a);
      return a;
    }
    function prep(a, g) {
      const p = a.pal;
      const st = (y0, y1) => vgrad(g, y0, y1, [[0, p.light], [0.45, p.base], [1, p.shade]]);
      switch (a.kind) {
        case 'runner': case 'feather': a.grad = st(-86, -20); break;
        case 'sauro': a.grad = vgrad(g, -236, -44, [[0, p.light], [0.4, p.base], [0.85, p.base], [1, p.shade]]); a.gradH = st(-20, 10); break;
        case 'steg': a.grad = st(-80, -16); break;
        case 'trex': a.grad = st(-122, -34); break;
        case 'trice': a.grad = st(-78, -18); a.gradH = st(-14, 20); break;
        case 'deer': a.grad = st(-74, -36); a.gradH = st(-11, 7); break;
        case 'mammoth': a.grad = st(-112, -28); break;
        case 'shrew': a.grad = st(-21, -1); break;
        default: a.grad = p.base;
      }
    }
    const B = (...ms) => ms.reduce((m, i) => m | (1 << i), 0);

    /* 230 millions d'années : trois petits coureurs, qui courent en petite bande */
    const RUN = { x: 0.4, v: 46, gait: 0, state: 'stop', timer: 1.2 };
    addActor('runner', B(0), { pal: P.orange, off: 0, gy: 0.9, size: 54 });
    addActor('runner', B(0), { pal: P.teal, off: -0.31, gy: 0.84, size: 44 });
    addActor('runner', B(0), { pal: P.lime, off: 0.3, gy: 0.96, size: 38 });
    /* 150 millions d'années */
    const sauro = addActor('sauro', B(1), { pal: P.sauro, fx: 0.56, gy: 0.8, size: 200 });
    addActor('steg', B(1), { pal: P.steg, fx: 0.3, gy: 0.93, size: 64, speed: 16, state: 'walk', timer: 4, fxMin: 0.2, fxMax: 0.42 });
    addActor('feather', B(1), { pal: P.feather, fx: 0.86, gy: 0.96, size: 36, dir: -1 });
    /* 68 à 66 millions d'années (ils restent au début de l'astéroïde) ; les géants au long cou sont toujours là, au loin */
    const sauroFar = addActor('sauro', B(2, 3), { pal: P.sauroFar, fx: 0.67, gy: 0.6, size: 50, dir: -1, far: true });
    const trex = addActor('trex', B(2, 3), { pal: P.trex, fx: 0.24, gy: 0.82, size: 104, speed: 18, state: 'walk', timer: 3, fxMin: 0.15, fxMax: 0.34 });
    const trice = addActor('trice', B(2, 3), { pal: P.trice, fx: 0.66, gy: 0.93, size: 66 });
    /* 66 millions d'années : les oiseaux s'envolent, un petit mammifère pointe le museau */
    [0, 1, 2, 3].forEach((i) => addActor('bird', B(3), { pal: i % 2 ? P.birdY : P.birdB, size: 20, idx: i, perch: false }));
    const shrew4 = addActor('shrew', B(3), { pal: P.shrew, fx: 0.16, gy: 0.95, size: 17 });
    /* après : les mammifères grandissent et se diversifient */
    addActor('mammoth', B(4), { pal: P.mammoth, fx: 0.7, gy: 0.84, size: 108, dir: -1, delay: 0.5 });
    addActor('deer', B(4), { pal: P.deer, fx: 0.3, gy: 0.9, size: 76, delay: 0.25 });
    const shrew5 = addActor('shrew', B(4), { pal: P.shrew, fx: 0.1, gy: 0.96, size: 18, delay: 0 });
    addActor('bird', B(4), { pal: P.birdB, size: 18, idx: 9 });
    /* environ 300 000 ans : la famille autour du feu */
    const sitter = addActor('sitter', B(5), { pal: P.h1, fx: 0.19, gy: 0.9, size: 46 });
    addActor('child', B(5), { pal: P.h2, fx: 0.3, gy: 0.93, size: 34 });
    addActor('stander', B(5), { pal: P.h3, fx: 0.56, gy: 0.9, size: 66, dir: -1 });
    const FIRE = { fx: 0.42, gy: 0.93 };
    actors.sort((a, b) => a.gy - b.gy);

    /* ---- état ---- */
    let pos = 0;            /* curseur sur la frise (0 → 1) */
    let cur = 0;            /* moment affiché */
    let posAnim = null;
    let drag = null;
    let tb = 1;             /* avancement du changement d'époque */
    let tDir = 1;
    let shownT = 0;
    let found = new Array(N).fill(false);
    let nFound = 0;
    let furthest = 0;       /* moment le plus récent atteint : il fait avancer la barre de progression */
    let finished = false;
    let time = 0;
    let seq = SETTLED;      /* chronologie de l'astéroïde (s) */
    let phase2 = false;
    let humT = 0;
    let lensK = 0;
    let zoomK = 0;
    let mamT = 0;
    let wowT = 0;
    let lastWhoosh = -1;
    let moved = false;
    let hintShown = '';
    let pulse = 0;
    let fireBoost = 0;

    /* ---- particules (tableaux réservés une fois pour toutes) ---- */
    const motes = Array.from({ length: 36 }, () => ({ x: Math.random(), y: Math.random(), vx: 0, vy: 0, s: 1, ph: rand(TAU) }));
    const ash = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), v: rand(0.02, 0.06), s: rand(0.6, 1.8), ph: rand(TAU) }));
    const sparks = Array.from({ length: 34 }, () => ({ on: false, x: 0, y: 0, vx: 0, vy: 0, t: 0, life: 1 }));
    const bursts = Array.from({ length: 60 }, () => ({ on: false, x: 0, y: 0, vx: 0, vy: 0, t: 0, life: 1, col: '#fff', s: 2 }));
    const rings = [];
    const puffs = Array.from({ length: 16 }, (_, i) => ({ i, ox: rand(), oy: rand(), r: rand(0.6, 1.2) }));
    const flies = [0, 1].map((i) => ({ i, ph: rand(TAU) }));
    const stars = Array.from({ length: 14 }, () => ({ x: Math.random(), y: Math.random(), ph: rand(TAU), s: rand(0.8, 1.6) }));
    let sparkI = 0, burstI = 0;

    function spark(x, y, vx, vy, life) {
      const s = sparks[sparkI++ % sparks.length];
      s.on = true; s.x = x; s.y = y; s.vx = vx; s.vy = vy; s.t = 0; s.life = life;
    }
    function burst(x, y, n, cols, sp) {
      for (let i = 0; i < n; i++) {
        const b = bursts[burstI++ % bursts.length];
        const an = rand(TAU), v = rand(0.4, 1) * sp;
        b.on = true; b.x = x; b.y = y; b.vx = Math.cos(an) * v; b.vy = Math.sin(an) * v - sp * 0.3;
        b.t = 0; b.life = rand(0.45, 0.8); b.col = cols[i % cols.length]; b.s = rand(1.4, 2.6);
      }
    }

    /* ---- mise en page ---- */
    function measureLabel() {
      let mx = 0;
      for (let i = 0; i < N; i++) {
        setLabelText(i, false);
        mx = Math.max(mx, label.offsetHeight);
        if (i === 3) {
          setLabelText(i, true);
          mx = Math.max(mx, label.offsetHeight);
        }
      }
      setLabelText(cur, cur === 3 && phase2);
      return label.offsetTop + mx;
    }

    function place(a) {
      a.x = a.fx * G.w;
      a.y = a.gy * G.L;
      let s = (a.size * G.U) / a.spec.h;
      if (a.kind === 'sauro') s = Math.min(s, (a.y - G.safeTop - 10) / 236);
      a.s = s * a.grow;
    }

    function layout(w, h) {
      G.w = w;
      G.h = h;
      G.Hb = Math.round(clamp(h * 0.235, 96, 132));
      G.L = h - G.Hb;
      G.hz = Math.round(G.L * 0.56);
      G.U = Math.min(w / 360, G.L / 342);
      G.pad = Math.max(24, Math.round(w * 0.07));
      G.x0 = G.pad;
      G.x1 = w - G.pad;
      G.ir = Math.round(clamp(G.Hb * 0.165, 15, 21));
      G.iy = G.L + G.ir + 9;
      G.ty = G.L + Math.round(G.Hb * 0.62);
      G.th = clamp(Math.round(G.Hb * 0.08), 7, 10);
      G.lensR = Math.round(clamp(Math.min(w, G.L) * 0.16, 40, 72));
      G.lensX = w - G.lensR - 14;
      G.lensY = G.L - G.lensR - 16;
      stage.classList.toggle('dn-small', w < 340 || h < 420);
      G.safeTop = measureLabel() + 6;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      for (const a of actors) place(a);
      /* l'arbre où le géant vient brouter */
      TREE.x = Math.min(w - 8, sauro.x + 150 * sauro.s);
      TREE.top = sauro.y - 246 * sauro.s;
      TREE.base = G.hz + G.L * 0.07;
      /* médaillons : position honnête, puis écartés juste assez pour ne pas se chevaucher */
      const gap = G.ir * 2 + 5;
      for (let i = 0; i < N; i++) icx[i] = clamp(X(MOMENTS[i].f), G.ir + 4, w - G.ir - 4);
      for (let it = 0; it < 30; it++) {
        for (let i = 1; i < N; i++) {
          const d = icx[i] - icx[i - 1];
          if (d < gap) {
            const push = (gap - d) / 2;
            icx[i - 1] -= push;
            icx[i] += push;
          }
        }
        for (let i = 0; i < N; i++) icx[i] = clamp(icx[i], G.ir + 4, w - G.ir - 4);
      }
      endL.style.left = Math.max(8, G.x0 - 14) + 'px';
      endL.style.top = (G.ty + G.th / 2 + 8) + 'px';
      endR.style.right = Math.max(8, w - G.x1 - 14) + 'px';
      endR.style.top = (G.ty + G.th / 2 + 8) + 'px';
      bgs = new Array(7).fill(null);
      band = paintBand(w, G.Hb, cv.dpr);
      snap = layer(w, G.L, cv.dpr);
      snapB = layer(w, G.L, cv.dpr);
      icons = null;
      bufCtx = null;
    }

    function getBg(i) {
      if (!bgs[i]) {
        const { c, g } = layer(G.w, G.L, cv.dpr);
        const args = [g, G.w, G.L, G.hz, G.U];
        if (i === 0) paintTrias(...args);
        else if (i === 1) paintJura(...args, TREE);
        else if (i === 2) paintCreta(...args, false);
        else if (i === 6) paintCreta(...args, true);
        else if (i === 4) paintCeno(...args);
        else if (i === 5) paintAfrique(...args);
        bgs[i] = c;
      }
      return bgs[i];
    }
    const darkK = () => smooth(1.95, 3.7, seq);
    function drawSceneBg(g, i) {
      if (i === 3) {
        g.drawImage(getBg(2), 0, 0, G.w, G.L);
        const k = darkK();
        if (k > 0) {
          g.globalAlpha = k;
          g.drawImage(getBg(6), 0, 0, G.w, G.L);
          g.globalAlpha = 1;
        }
      } else {
        g.drawImage(getBg(i), 0, 0, G.w, G.L);
      }
    }
    /* les fonds se préparent un par un, à l'avance, pour ne jamais bloquer un changement d'époque */
    let prefetchT = 0;
    function prefetch(dt) {
      prefetchT -= dt;
      if (prefetchT > 0 || tb < 1) return;
      prefetchT = 0.25;
      const order = [cur, cur + 1, cur - 1, 2, 6, cur + 2, 0, 1, 4, 5];
      for (const i of order) {
        if (i >= 0 && i <= 6 && i !== 3 && !bgs[i]) {
          getBg(i);
          return;
        }
      }
      if (!icons) makeIcons();
    }

    /* ---- médaillons de la frise ---- */
    function iconActor(kind, p, extra) {
      const a = Object.assign({
        kind, pal: p, t: 0.6, seed: 0.5, phase: 0.6, gait: 0, blink: 0, happy: 0, react: 0, nod: 0, nodY: 0, lookX: 0.3, lookY: 0,
        lookUp: 0, graze: 0, eat: 0, wave: 0, point: 0.9, perch: false, spec: KINDS[kind],
      }, extra || {});
      prep(a, ctx);
      return a;
    }
    const ICONS = [
      { a: iconActor('runner', P.orange), s: 0.27, ox: 0, oy: 0.55 },
      { a: iconActor('sauro', P.sauro), s: 0.104, ox: -0.3, oy: 0.8 },
      { a: iconActor('trex', P.trex), s: 0.19, ox: -0.26, oy: 0.82 },
      null,
      { a: iconActor('mammoth', P.mammoth, { dir: -1 }), s: 0.2, ox: 0.06, oy: 0.68, dir: -1 },
      { a: iconActor('stander', P.h2, { point: 0 }), s: 0.31, ox: 0.04, oy: 1.12, dir: -1 },
    ];
    function drawAsteroidIcon(g, cx, cy, r) {
      const tx = cx - r * 0.75, ty = cy - r * 0.75;
      const gr = g.createLinearGradient(tx, ty, cx, cy);
      gr.addColorStop(0, 'rgba(255,120,40,0)');
      gr.addColorStop(1, 'rgba(255,190,90,0.95)');
      g.beginPath();
      g.moveTo(tx, ty);
      g.lineTo(cx + r * 0.22, cy - r * 0.32);
      g.lineTo(cx - r * 0.32, cy + r * 0.22);
      g.closePath();
      g.fillStyle = gr;
      g.fill();
      draw.glow(g, cx + r * 0.12, cy + r * 0.12, r * 0.7, '#FFB14A', 0.6);
      draw.blob(g, cx + r * 0.12, cy + r * 0.12, r * 0.36, 0.18, 2.2, 0, 12);
      g.fillStyle = '#6E5A4E';
      g.fill();
      g.lineWidth = 1;
      g.strokeStyle = '#3A2C24';
      g.stroke();
      dot(g, cx + r * 0.02, cy + r * 0.02, r * 0.09, '#4E4038');
      dot(g, cx + r * 0.24, cy + r * 0.2, r * 0.06, '#4E4038');
    }
    function makeIcons() {
      const r = G.ir, S = Math.ceil(r * 2 + 8);
      icons = [];
      for (let i = 0; i < N; i++) {
        const pair = [];
        for (let lit = 0; lit < 2; lit++) {
          const { c, g } = layer(S, S, cv.dpr);
          const cx = S / 2, cy = S / 2;
          draw.blob(g, cx, cy, r, 0.05, i * 1.7 + 1, 0, 24);
          g.fillStyle = lit ? '#21463F' : '#17302D';
          g.fill();
          g.save();
          g.clip();
          draw.glow(g, cx, cy - r * 0.35, r * 1.2, lit ? '#4F8F78' : '#2E4D47', 0.75);
          if (i === 5) draw.glow(g, cx - r * 0.35, cy + r * 0.7, r * 1.25, '#FFB45A', 0.75);
          if (i === 3) drawAsteroidIcon(g, cx, cy, r);
          else {
            const ic = ICONS[i];
            const s = (ic.s * r) / 18;
            g.save();
            g.translate(cx + ic.ox * r, cy + ic.oy * r);
            g.scale(s * (ic.dir || 1), s);
            ic.a.spec.draw(g, ic.a, 1.1 / s);
            g.restore();
          }
          if (!lit) {
            g.fillStyle = 'rgba(14,32,30,0.58)';
            g.fillRect(0, 0, S, S);
          }
          g.restore();
          draw.blob(g, cx, cy, r, 0.05, i * 1.7 + 1, 0, 24);
          g.lineWidth = 1.6;
          g.strokeStyle = lit ? rgba(COL.acc2, 0.85) : 'rgba(239,248,242,0.22)';
          g.stroke();
          pair.push(c);
        }
        icons.push(pair);
      }
    }

    /* ---- texte, boutons, consignes ---- */
    function showLabel(anim) {
      setLabelText(cur, cur === 3 && phase2);
      if (anim && !CALM && label.animate) {
        label.animate([{ opacity: 0.2, transform: 'translateY(-4px)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: 'ease-out' });
      }
    }
    function updateNav() {
      btnPrev.disabled = cur === 0;
      btnNext.disabled = cur === N - 1;
    }
    function hint(t) {
      if (finished || hintShown === t) return;
      hintShown = t;
      api.hint(t);
    }
    /* il suffit d'aller jusqu'au bout de la frise : pas besoin d'avoir vu tous les moments */
    function updateHint() {
      if (finished || !moved) return;
      hint(cur === N - 1 ? TEXTES.loupe : TEXTES.continuer);
    }

    /* ---- changer d'époque ---- */
    /* Instantané du fond affiché (y compris un fondu en cours), dans le second tampon, puis échange */
    function snapshot(fresh) {
      const g = snapB.g;
      g.globalAlpha = 1;
      g.clearRect(0, 0, G.w, G.L);
      if (tb < 1 && !fresh) {
        g.drawImage(snap.c, 0, 0, G.w, G.L);
        g.globalAlpha = ease.inOutSine(tb);
      }
      drawSceneBg(g, cur);
      g.globalAlpha = 1;
      const t = snap;
      snap = snapB;
      snapB = t;
    }
    function setMoment(i) {
      if (i === cur) return;
      const from = cur;
      snapshot(false);
      tb = 0;
      tDir = i > from ? 1 : -1;
      cur = i;
      shownT = 0;
      if (i === 3) {
        seq = from < 3 ? 0 : SETTLED;
        phase2 = seq >= SETTLED;
      }
      if (i === 4) mamT = from === 5 ? 9 : 0;
      if (i === 5) humT = 0;
      moved = true;
      if (i > furthest && !finished) {
        furthest = i;
        api.progress(furthest / N);
      }
      showLabel(true);
      updateNav();
      updateHint();
      if (time - lastWhoosh > 0.3) {
        lastWhoosh = time;
        api.sfx.play('whoosh', { volume: 0.4, pitch: 0.8 + i * 0.07 });
      }
    }
    function discover(i) {
      if (found[i]) return;
      found[i] = true;
      nFound++;
      api.sfx.play('chime', { pitch: 0.85 + i * 0.08 });
      api.buzz(10);
      rings.push({ x: icx[i], y: G.iy, t: 0, dur: 0.8, r0: G.ir, r1: G.ir * 2.2, col: COL.acc2 });
      burst(icx[i], G.iy, 10, [COL.acc2, '#FFFFFF', COL.acc], 70);
      updateHint();
    }
    function finish() {
      finished = true;
      api.done(TEXTES.fin, TEXTES.finStatut);
      api.guide(null, 'laugh', TEXTES.bravo);
    }

    /* ---- le curseur ---- */
    function animatePos(to, dur, jump) {
      posAnim = { from: pos, to, t: 0, dur: CALM ? Math.min(dur, 0.25) : dur, jump };
    }
    function goTo(i) {
      api.gesture(null);
      i = clamp(i, 0, N - 1);
      if (i !== cur) setMoment(i);
      const d = Math.abs(MOMENTS[i].f - pos);
      animatePos(MOMENTS[i].f, lerp(0.45, 1.1, Math.min(1, d * 1.6)), true);
      api.sfx.play('tick');
    }
    function step(dir) {
      goTo(cur + dir);
    }
    function snapToZone() {
      const z = zoneOf(pos);
      animatePos(MOMENTS[z].f, 0.35, false);
      api.sfx.play('tick', { pitch: 1.1 });
    }
    btnPrev.addEventListener('click', () => step(-1));
    btnNext.addEventListener('click', () => step(1));
    stage.tabIndex = 0;
    stage.setAttribute('aria-label', TEXTES.ariaScene);
    stage.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { step(1); e.preventDefault(); }
      if (e.key === 'ArrowLeft') { step(-1); e.preventDefault(); }
    });

    function iconAt(x, y) {
      if (y < G.L || y > G.iy + G.ir + 10) return -1;
      let best = -1, bd = Math.max(G.ir + 6, 24);
      for (let i = 0; i < N; i++) {
        const d = Math.hypot(x - icx[i], y - G.iy);
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
      return best;
    }
    function setPosFromX(x) {
      pos = clamp((x - G.x0) / (G.x1 - G.x0));
    }

    api.track(cv.canvas, {
      down(p) {
        drag = { band: p.y >= G.L, icon: iconAt(p.x, p.y), x0: p.x, y0: p.y, active: false, grabX: 0, grabPos: 0 };
      },
      move(p) {
        if (!drag) return;
        const dx = p.x - drag.x0, dy = p.y - drag.y0;
        if (!drag.active) {
          if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 0.8) {
            drag.active = true;
            drag.grabX = p.x;
            drag.grabPos = pos;
            posAnim = null;
            cv.canvas.classList.add('is-dragging');
            api.gesture(null);
          } else return;
        }
        if (drag.band) setPosFromX(p.x);
        else pos = clamp(drag.grabPos + (p.x - drag.grabX) / (G.x1 - G.x0));
      },
      up(p, e, cancelled) {
        const d = drag;
        drag = null;
        cv.canvas.classList.remove('is-dragging');
        if (!d) return;
        if (d.active) {
          snapToZone();
          return;
        }
        if (cancelled || !p.tap) return;
        if (d.band) {
          if (d.icon >= 0) {
            rings.push({ x: icx[d.icon], y: G.iy, t: 0, dur: 0.5, r0: G.ir * 0.8, r1: G.ir * 1.7, col: '#FFFFFF' });
            goTo(d.icon);
          } else if (p.y > G.iy + G.ir - 4) {
            setPosFromX(p.x);
            snapToZone();
          }
        } else {
          poke(p.x, p.y);
        }
      },
    }, { touchAction: 'pan-y' });

    /* toucher le paysage : l'animal touché réagit */
    function poke(x, y) {
      rings.push({ x, y, t: 0, dur: 0.55, r0: 4, r1: 30 * G.U, col: '#FFFFFF' });
      api.buzz(8);
      let best = null, bd = Infinity;
      for (const a of actors) {
        if (a.alpha < 0.5) continue;
        const sp = a.spec;
        const hx = a.x + sp.hit[0] * a.s * a.dir, hy = a.y - a.lift + sp.hit[1] * a.s;
        const d = Math.hypot(x - hx, y - hy);
        if (d < sp.hit[2] * a.s + 12 && d < bd) {
          bd = d;
          best = a;
        }
      }
      if (cur === 5 && Math.hypot(x - FIRE.fx * G.w, y - FIRE.gy * G.L + 12 * G.U) < 34 * G.U) {
        fireBoost = 1;
        for (let i = 0; i < 12; i++) spark(FIRE.fx * G.w + rand(-8, 8) * G.U, FIRE.gy * G.L - 10 * G.U, rand(-30, 30), rand(-120, -50), rand(0.8, 1.6));
        api.sfx.play('crack', { pitch: rand(0.8, 1.2) });
        return;
      }
      if (best) {
        best.react = 1;
        best.hopT = 0;
        best.hopH = best.kind === 'sauro' || best.kind === 'mammoth' ? 0 : clamp(best.s * 40, 6, 16);
        if (best.kind === 'trex') best.wave = 1;
        if (best.kind === 'stander') best.point = 1;
        if (best.kind === 'bird' && !best.perch) best.phase += 2;
        const big = best.spec.h * best.s;
        api.sfx.play('pop', { pitch: clamp(1.5 - big / 160, 0.45, 1.4) });
        burst(x, y, 6, ['#FFFFFF', COL.acc2, COL.acc], 50);
      } else {
        api.sfx.play('tick', { pitch: rand(0.9, 1.2) });
        burst(x, y, 4, ['#FFFFFF', COL.acc2], 36);
      }
    }

    /* ---- animation des acteurs ---- */
    function visOf(a) {
      if (a.kind === 'trex' || a.kind === 'trice' || a === sauroFar) {
        if (cur === 2) return 1;
        if (cur === 3) return 1 - smooth(2.2, 3.7, seq);
        return 0;
      }
      if (a.kind === 'bird' && a.idx < 9) return cur === 3 && seq > 2.05 ? 1 : 0;
      if (a === shrew4) return cur === 3 && seq > 4.2 ? 1 : 0;
      return (a.mask >> cur) & 1;
    }
    function walkTo(a, dt, sp) {
      const v = a.speed * a.gait * sp;
      a.fx += (a.dir * v * G.U * dt) / G.w;
      a.phase += (v * dt * TAU) / (4 * 12 * Math.max(a.s, 0.05) * 1.1);
    }
    function updActor(a, dt) {
      const sp = CALM ? 0.45 : 1;
      a.t += dt * (CALM ? 0.5 : 1);
      a.blinkT -= dt;
      if (a.blinkT <= 0) {
        a.blinkT = rand(2.2, 5.5);
        a.blinkK = 0.16;
      }
      if (a.blinkK > 0) {
        a.blinkK -= dt;
        a.blink = Math.sin(clamp(1 - a.blinkK / 0.16) * Math.PI);
      } else a.blink = 0;
      a.react = Math.max(0, a.react - dt * 0.8);
      a.happy = a.react > 0.3 ? 1 : 0;
      a.hopT += dt;
      a.lift = a.hopT < 0.42 ? Math.sin((a.hopT / 0.42) * Math.PI) * a.hopH * G.U : 0;
      a.lookX = Math.sin(a.t * 0.37 + a.seed) * 0.5;
      a.lookY = 0;
      a.dirK += (a.dir - a.dirK) * Math.min(1, dt * 13);
      const asteroid = cur === 3 && seq > 0.45 && seq < 2.4;
      switch (a.kind) {
        case 'runner': {
          a.gait = RUN.gait;
          a.nod = (1 - a.gait) * Math.sin(a.t * 1.3 + a.seed) * 0.14 - a.react * 0.1;
          a.fx = ((((RUN.x + a.off + 0.25) % 1.5) + 1.5) % 1.5) - 0.25;
          a.phase += (RUN.v * RUN.gait * sp * G.U * dt * TAU) / (4 * RL.S * Math.max(a.s, 0.05));
          break;
        }
        case 'feather': {
          a.timer -= dt;
          if (a.timer <= 0) {
            a.timer = rand(1.6, 3.2);
            a.hopT = 0;
            a.hopH = 7;
          }
          a.nod = Math.sin(a.t * 1.6) * 0.1;
          break;
        }
        case 'sauro': {
          const cyc = (a.t * 0.11 + a.seed) % 1;
          a.eat = a.far ? 0 : smooth(0.05, 0.2, cyc) * (1 - smooth(0.55, 0.72, cyc));
          a.nod = -a.react * 0.25 * Math.sin(a.react * Math.PI);
          a.nodY = a.react * 10 * Math.sin(a.react * Math.PI);
          break;
        }
        case 'steg': case 'trex': {
          if (a.state === 'walk') {
            a.gait = Math.min(1, a.gait + dt * 2);
            a.graze = Math.max(0, a.graze - dt * 2);
            if ((a.dir > 0 && a.fx > a.fxMax) || (a.dir < 0 && a.fx < a.fxMin)) {
              a.state = 'pause';
              a.timer = rand(2.2, 4);
            }
          } else {
            a.gait = Math.max(0, a.gait - dt * 2);
            if (a.kind === 'steg') a.graze = Math.min(1, a.graze + dt * 1.5);
            a.timer -= dt;
            if (a.timer <= 0) {
              a.state = 'walk';
              a.dir = -a.dir;
            }
          }
          if (a.kind === 'trex') {
            a.wave = Math.max(a.react, (1 - a.gait) * smooth(0.6, 0.9, Math.sin(a.t * 0.5)));
            a.lookUp += ((asteroid ? 1 : 0) - a.lookUp) * Math.min(1, dt * 4);
            a.nod = Math.sin(a.t * 1.1) * 0.04 * (1 - a.gait);
          }
          if (cur === 3 && seq < 3.5) {
            a.gait = Math.max(0, a.gait - dt * 4);
            if (a.kind === 'trex') a.dir = 1; /* il se tourne vers la lueur */
          } else walkTo(a, dt, sp);
          if (asteroid) a.lookY = -1;
          break;
        }
        case 'trice': {
          const cyc = (a.t * 0.16 + a.seed) % 1;
          a.graze = smooth(0.1, 0.25, cyc) * (1 - smooth(0.6, 0.75, cyc)) * (asteroid ? 0 : 1);
          a.nod = Math.sin(a.t * 6) * 0.05 * a.graze - a.react * 0.15 * Math.sin(a.t * 12);
          a.lookUp += ((asteroid ? 1 : 0) - a.lookUp) * Math.min(1, dt * 4);
          if (asteroid) a.lookY = -1;
          break;
        }
        case 'bird': {
          a.phase += dt * (a.perch ? 0 : 15) * (CALM ? 0.5 : 1);
          a.peck = a.perch ? Math.pow(Math.max(0, Math.sin(a.t * 2.2 + a.seed)), 8) : 0;
          if (a.idx < 9) birdPath(a);
          else {
            const u = ((a.t * 0.05 + 0.3) % 1.4) - 0.2;
            a.fx = u;
            a.gy = 0.24 + Math.sin(a.t * 0.7) * 0.03;
            a.dir = 1;
            a.dirK = 1;
          }
          break;
        }
        case 'shrew': {
          a.nod = 0;
          if (a === shrew5) {
            const u = Math.sin(a.t * 0.4 + a.seed);
            a.dir = Math.cos(a.t * 0.4 + a.seed) > 0 ? 1 : -1;
            a.fx = a.home.fx + u * 0.04;
          }
          break;
        }
        case 'deer': {
          const cyc = (a.t * 0.12 + a.seed) % 1;
          a.graze = smooth(0.1, 0.22, cyc) * (1 - smooth(0.55, 0.68, cyc));
          a.nod = Math.sin(a.t * 5) * 0.04 * a.graze - a.react * 0.2 * Math.sin(a.t * 10);
          break;
        }
        case 'stander': {
          const cyc = (a.t * 0.13 + a.seed) % 1;
          a.point = Math.max(smooth(0.2, 0.32, cyc) * (1 - smooth(0.62, 0.75, cyc)), a.react > 0 ? 1 : 0, a.point * Math.pow(0.2, dt));
          break;
        }
        default:
          break;
      }
      if (a.grow < 1 || a.kind === 'mammoth' || a.kind === 'deer' || a === shrew5) {
        if (a.mask & B(4)) {
          const k = clamp((mamT - a.delay) / 1.1);
          a.grow = lerp(0.35, 1, ease.outBack(k));
        }
      }
      if (a === shrew4) a.grow = cur === 3 ? ease.outBack(clamp((seq - 4.2) / 0.7)) : 1;
      place(a);
    }
    /* les oiseaux du moment de l'astéroïde : envol depuis les buissons, ronde, puis deux se posent */
    const PERCH = [[0.4, 0.9], [0.53, 0.93]];
    function birdPath(a) {
      const i = a.idx;
      const u = seq - (2.05 + i * 0.18);
      const top = (G.safeTop + 14) / G.L;
      const sx = [0.22, 0.5, 0.78, 0.35][i], sy = 0.9;
      const cx = [0.3, 0.55, 0.7, 0.45][i], cy = Math.max(top + 0.08, [0.42, 0.36, 0.46, 0.4][i]);
      const R = [0.16, 0.12, 0.1, 0.2][i], om = [0.7, -0.9, 0.8, -0.6][i];
      const lu = smooth(0, 1.6, u);
      const an = u * om + i * 1.7;
      let fx = lerp(sx, cx + Math.cos(an) * R, lu);
      let gy = Math.max(top, lerp(sy, cy + Math.sin(an) * R * 0.45, lu));
      a.perch = false;
      if (i < 2) {
        /* deux oiseaux se posent par terre et picorent */
        const land = smooth(3.4 + i * 0.6, 4.6 + i * 0.6, u);
        fx = lerp(fx, PERCH[i][0], land);
        gy = lerp(gy, PERCH[i][1] - (10 * a.s) / G.L, land);
        a.perch = land > 0.98;
      }
      const dx = fx - a.fx;
      if (Math.abs(dx) > 0.0005 && !a.perch) a.dir = dx > 0 ? 1 : -1;
      if (a.perch) a.dir = i === 0 ? 1 : -1;
      a.fx = fx;
      a.gy = gy;
    }

    /* ---- boucle ---- */
    function update(dt) {
      time += dt;
      if (posAnim) {
        posAnim.t += dt;
        const k = clamp(posAnim.t / posAnim.dur);
        pos = lerp(posAnim.from, posAnim.to, ease.inOutCubic(k));
        if (k >= 1) posAnim = null;
      }
      if (!posAnim || !posAnim.jump) {
        const z = zoneOf(pos);
        if (z !== cur) setMoment(z);
      }
      tb = Math.min(1, tb + dt / (CALM ? 0.35 : TRANS));
      const settled = tb >= 1 && !(drag && drag.active) && !(posAnim && !posAnim.jump);
      if (settled) shownT += dt;
      if (cur === 3 && seq < SETTLED) {
        const before = seq;
        seq += dt;
        if (before < 0.5 && seq >= 0.5) api.sfx.play('whoosh', { pitch: 0.6, volume: 0.8 });
        if (before < 1.9 && seq >= 1.9) {
          api.sfx.play('rumble');
          api.sfx.play('thud', { pitch: 0.6 });
          api.buzz(15);
          if (!finished) {
            api.guide(null, 'wow');
            wowT = 2.4;
          }
        }
        if (!phase2 && seq >= 3.1) {
          phase2 = true;
          showLabel(true);
        }
      }
      if (wowT > 0) {
        wowT -= dt;
        if (wowT <= 0 && !finished) api.guide(null, 'smile');
      }
      if (cur === 4) mamT += dt;
      if (cur === 5) humT += dt;
      const lensT = cur === 5 ? smooth(0.7, 1.3, humT) : 0;
      lensK += (lensT - lensK) * Math.min(1, dt * (cur === 5 ? 6 : 9));
      zoomK = cur === 5 ? smooth(1.3, 3.6, humT) : Math.max(0, zoomK - dt * 2);
      if (!found[cur]) {
        const ready = cur === 3
          ? (seq < SETTLED ? seq >= 3.3 && shownT > 0.5 : shownT > 1.4)
          : cur === 5 ? humT > 2 && shownT > 1 : shownT > 1.4;
        if (ready) discover(cur);
      }
      /* arrivé chez les humains : on gagne dès que la loupe a fini de grossir */
      if (!finished && cur === N - 1 && humT > 3.8) finish();
      pulse += dt;
      fireBoost = Math.max(0, fireBoost - dt * 1.5);
      RUN.timer -= dt;
      if (RUN.timer <= 0) {
        if (RUN.state === 'run') {
          RUN.state = 'stop';
          RUN.timer = rand(1.5, 2.6);
        } else {
          RUN.state = 'run';
          RUN.timer = rand(3.2, 5);
        }
      }
      RUN.gait += ((RUN.state === 'run' ? 1 : 0) - RUN.gait) * Math.min(1, dt * 2.5);
      RUN.x += (RUN.v * RUN.gait * (CALM ? 0.45 : 1) * G.U * dt) / G.w;
      for (const a of actors) {
        const v = visOf(a);
        const sp = v > a.alpha ? (a.kind === 'bird' || a === shrew4 ? 6 : 3.2) : cur === 3 && (a === trex || a === trice || a === sauroFar) ? 1.4 : 4;
        a.alpha = v > a.alpha ? Math.min(v, a.alpha + dt * sp) : Math.max(v, a.alpha - dt * sp);
        if (a.alpha > 0.001 || v > 0) updActor(a, dt);
      }
      /* particules */
      const amb = CALM ? 0.4 : 1;
      for (const m of motes) {
        m.ph += dt;
        m.x += (Math.sin(m.ph * 0.7) * 0.004 + 0.003) * dt * amb;
        m.y += Math.cos(m.ph * 0.5) * 0.004 * dt * amb - (cur === 2 ? -0.01 : 0.002) * dt * amb;
        if (m.x > 1.02) m.x = -0.02;
        if (m.y > 1) m.y = 0.1;
        if (m.y < 0.05) m.y = 0.95;
      }
      for (const p of ash) {
        p.y += p.v * dt * amb;
        p.ph += dt;
        p.x += Math.sin(p.ph) * 0.003 * dt;
        if (p.y > 1) {
          p.y = 0;
          p.x = Math.random();
        }
      }
      if (cur === 5 && Math.random() < dt * (CALM ? 3 : 7)) {
        spark(FIRE.fx * G.w + rand(-6, 6) * G.U, FIRE.gy * G.L - 14 * G.U, rand(-10, 10), rand(-70, -35), rand(0.8, 1.5));
      }
      for (const s of sparks) {
        if (!s.on) continue;
        s.t += dt;
        s.x += (s.vx + Math.sin(s.t * 6 + s.vy) * 12) * dt;
        s.y += s.vy * dt;
        if (s.t > s.life) s.on = false;
      }
      for (const b of bursts) {
        if (!b.on) continue;
        b.t += dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.vy += 120 * dt;
        if (b.t > b.life) b.on = false;
      }
      for (let i = rings.length - 1; i >= 0; i--) {
        rings[i].t += dt;
        if (rings[i].t > rings[i].dur) rings.splice(i, 1);
      }
      prefetch(dt);
    }

    /* ---- dessin ---- */
    function drawActor(a) {
      const sp = a.spec;
      const dx = a.s * (Math.abs(a.dirK) < 0.12 ? Math.sign(a.dirK || 1) * 0.12 : a.dirK);
      if (sp.sh && a.alpha > 0.01) {
        const rx = sp.sh * a.s, ry = rx * 0.2;
        const fade = 1 - clamp(a.lift / 30);
        ctx.globalAlpha = a.alpha * 0.55 * fade;
        ctx.drawImage(SPR.shadow, a.x - rx + sp.hit[0] * dx * 0.3, a.y - ry * 0.6, rx * 2, ry * 2);
        ctx.globalAlpha = 1;
      }
      if (a.alpha >= 0.995) {
        ctx.save();
        ctx.translate(a.x, a.y - a.lift);
        ctx.scale(dx, a.s);
        sp.draw(ctx, a, 1.15 / a.s);
        ctx.restore();
        return;
      }
      /* en fondu : on dessine l'animal à part, pour que ses membres ne se voient pas en transparence */
      const bx = sp.box, dpr = cv.dpr;
      const x0 = dx > 0 ? bx[0] * dx : (bx[0] + bx[2]) * dx;
      const bw = Math.ceil(bx[2] * Math.abs(dx) + 8), bh = Math.ceil(bx[3] * a.s + 8);
      const left = Math.floor(a.x + x0 - 4), top = Math.floor(a.y - a.lift + bx[1] * a.s - 4);
      if (!bufCtx || buf.width < bw * dpr || buf.height < bh * dpr) {
        buf = document.createElement('canvas');
        buf.width = Math.ceil(Math.max(bw, buf ? buf.width / dpr : 0, 120) * dpr);
        buf.height = Math.ceil(Math.max(bh, 120, buf ? buf.height / dpr : 0) * dpr);
        bufCtx = buf.getContext('2d');
        bufCtx.lineJoin = 'round';
        bufCtx.lineCap = 'round';
      }
      bufCtx.setTransform(1, 0, 0, 1, 0, 0);
      bufCtx.clearRect(0, 0, bw * dpr + 2, bh * dpr + 2);
      bufCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bufCtx.translate(a.x - left, a.y - a.lift - top);
      bufCtx.scale(dx, a.s);
      sp.draw(bufCtx, a, 1.15 / a.s);
      ctx.globalAlpha = a.alpha;
      ctx.drawImage(buf, 0, 0, bw * dpr, bh * dpr, left, top, bw, bh);
      ctx.globalAlpha = 1;
    }

    const AP = [0, 0];
    const TRX = new Float32Array(13), TRY = new Float32Array(13);
    function astPos(k) {
      const sx = G.w * 0.03, sy = G.safeTop + 4, ex = G.w * 0.86, ey = G.hz - 2;
      const e = ease.inQuad(clamp(k));
      AP[0] = lerp(sx, ex, e);
      AP[1] = lerp(sy, ey, e) - Math.sin(e * Math.PI) * G.L * 0.035;
      return AP;
    }
    function drawAsteroid() {
      if (cur !== 3 || seq < 0.45 || seq > 4) return;
      const k = clamp((seq - 0.5) / 1.4);
      if (seq >= 0.5 && k < 1) {
        const r = (3.2 + 3.2 * k) * G.U;
        /* la traînée de feu : un ruban effilé le long du chemin déjà parcouru… */
        const n = 12;
        for (let i = 0; i <= n; i++) {
          astPos(Math.max(0, k - i * 0.026));
          TRX[i] = AP[0];
          TRY[i] = AP[1];
        }
        ctx.beginPath();
        for (let side = -1; side <= 1; side += 2) {
          for (let j = 0; j <= n; j++) {
            const i = side < 0 ? j : n - j;
            const a0 = Math.max(0, i - 1), a1 = Math.min(n, i + 1);
            const dx = TRX[a0] - TRX[a1], dy = TRY[a0] - TRY[a1];
            const d = Math.hypot(dx, dy) || 1;
            const wd = r * 1.15 * (1 - i / (n + 1)) * side;
            const px = TRX[i] - (dy / d) * wd, py = TRY[i] + (dx / d) * wd;
            if (side < 0 && j === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
        }
        ctx.closePath();
        const gr = ctx.createLinearGradient(TRX[n], TRY[n], TRX[0], TRY[0]);
        gr.addColorStop(0, 'rgba(255,90,30,0)');
        gr.addColorStop(0.55, 'rgba(255,140,50,0.55)');
        gr.addColorStop(1, 'rgba(255,246,206,0.95)');
        ctx.fillStyle = gr;
        ctx.fill();
        /* … et des lueurs qui s'y ajoutent */
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 14; i >= 1; i--) {
          const kk = k - i * 0.02;
          if (kk < 0) continue;
          astPos(kk);
          const f = 1 - i / 15;
          const rr = r * (1.1 + f * 2.8);
          ctx.globalAlpha = 0.5 * f * f + 0.08;
          ctx.drawImage(i > 7 ? SPR.puffHot : SPR.warm, AP[0] - rr, AP[1] - rr, rr * 2, rr * 2);
        }
        astPos(k);
        const x = AP[0], y = AP[1];
        ctx.globalAlpha = 1;
        ctx.drawImage(SPR.warm, x - r * 6.5, y - r * 6.5, r * 13, r * 13);
        ctx.drawImage(SPR.light, x - r * 2.8, y - r * 2.8, r * 5.6, r * 5.6);
        ctx.globalCompositeOperation = 'source-over';
        draw.blob(ctx, x, y, r, 0.1, 3.3, 0, 12);
        ctx.fillStyle = '#5B3A2A';
        ctx.fill();
        ctx.save();
        ctx.clip();
        dot(ctx, x + r * 0.45, y + r * 0.3, r * 0.85, '#FFB45A');
        dot(ctx, x + r * 0.62, y + r * 0.45, r * 0.45, '#FFF0C0');
        ctx.restore();
        if (Math.random() < 0.7) spark(x, y, rand(-50, -10) * G.U, rand(-30, 10) * G.U, rand(0.25, 0.55));
      }
      /* l'impact, loin derrière l'horizon : un dôme de lumière et une onde qui file sur l'horizon */
      if (seq > 1.9) {
        astPos(1);
        const ex = AP[0], ey = AP[1];
        const u = seq - 1.9;
        const R = G.w * 0.36 * ease.outCubic(clamp(u / 0.8));
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, G.w, ey + 2);
        ctx.clip();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = clamp(1.3 - u * 0.6);
        ctx.drawImage(SPR.warm, ex - R, ey - R, R * 2, R * 2);
        ctx.globalAlpha = clamp(1 - u * 0.7);
        ctx.drawImage(SPR.light, ex - R * 0.55, ey - R * 0.55, R * 1.1, R * 1.1);
        ctx.globalCompositeOperation = 'source-over';
        ctx.restore();
        ctx.globalAlpha = 1;
      }
    }
    function drawDust() {
      if (cur !== 3) return;
      const k = smooth(2, 3, seq) * (1 - smooth(5.5, 8, seq));
      if (k <= 0.01) return;
      const u = seq - 2;
      for (const p of puffs) {
        const x = G.w * (0.95 - (u * 0.18 + p.ox * 0.9) % 1.15);
        const y = G.hz - G.L * (0.04 + p.oy * 0.36);
        const r = G.L * 0.16 * p.r * (0.8 + u * 0.1);
        ctx.globalAlpha = k * 0.42;
        ctx.drawImage(SPR.puff, x - r, y - r * 0.6, r * 2, r * 1.2);
      }
      ctx.globalAlpha = 1;
    }
    function drawParticles() {
      /* poussières dorées, pollen, pétales : un peu de vie dans l'air */
      const tbk = ease.inOutSine(tb);
      if (cur !== 3 && cur !== 5) {
        const col = cur === 0 ? '#FFE3B0' : cur === 2 ? '#FFC3D5' : '#F4FFD6';
        for (let i = 0; i < motes.length; i++) {
          const m = motes[i];
          const a = (0.35 + 0.3 * Math.sin(m.ph * 1.7)) * tbk;
          ctx.globalAlpha = a;
          ctx.fillStyle = col;
          const x = m.x * G.w, y = G.L * (0.15 + m.y * 0.8);
          if (cur === 2) {
            ell(ctx, x, y, 2 * G.U, 1.2 * G.U, m.ph);
            ctx.fill();
          } else ctx.fillRect(x, y, 1.6, 1.6);
        }
        ctx.globalAlpha = 1;
      }
      if (cur === 3) {
        const k = darkK() * tbk;
        if (k > 0.01) {
          ctx.fillStyle = '#CFC3B8';
          for (const p of ash) {
            ctx.globalAlpha = k * 0.55;
            ctx.fillRect(p.x * G.w, p.y * G.L, p.s, p.s);
          }
          ctx.globalAlpha = 1;
        }
      }
      ctx.globalCompositeOperation = 'lighter';
      for (const s of sparks) {
        if (!s.on) continue;
        const k = 1 - s.t / s.life;
        ctx.globalAlpha = k;
        ctx.drawImage(SPR.ember, s.x - 3, s.y - 3, 6, 6);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      for (const b of bursts) {
        if (!b.on) continue;
        ctx.globalAlpha = 1 - b.t / b.life;
        ctx.fillStyle = b.col;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.s, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    /* libellules (150 millions d'années) et papillons (fin du Crétacé) */
    function drawFlyers() {
      if (cur !== 1 && cur !== 2) return;
      const k = ease.inOutSine(tb);
      for (const f of flies) {
        const t = time * (CALM ? 0.4 : 1) + f.ph * 10;
        const x = G.w * (0.5 + 0.38 * Math.sin(t * 0.23 + f.i * 2) + 0.06 * Math.sin(t * 1.3));
        const y = G.L * (cur === 1 ? 0.6 : 0.7) + G.L * 0.1 * Math.sin(t * 0.41 + f.i) + 4 * Math.sin(t * 2.1);
        ctx.globalAlpha = k;
        ctx.save();
        ctx.translate(x, y);
        const fs = G.U * (cur === 2 ? 1.45 : 1.3);
        ctx.scale(fs, fs);
        if (cur === 1) {
          const fl = Math.sin(t * 40) * 0.3;
          ctx.fillStyle = 'rgba(220,250,255,0.55)';
          for (const s of [-1, 1]) {
            ell(ctx, -1, s * 4, 6, 1.8, s * (0.2 + fl));
            ctx.fill();
            ell(ctx, 3, s * 3.5, 5, 1.6, -s * (0.1 + fl));
            ctx.fill();
          }
          ctx.strokeStyle = '#2F7FA8';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-9, 0);
          ctx.lineTo(6, 0);
          ctx.stroke();
          dot(ctx, 6.5, 0, 1.8, '#3FA0C8');
        } else {
          const fl = Math.abs(Math.sin(t * 9 + f.i));
          const col = f.i ? '#FFE45C' : '#FF8FB1';
          ctx.fillStyle = col;
          for (const s of [-1, 1]) {
            ctx.save();
            ctx.scale(s * (0.25 + 0.75 * fl), 1);
            ell(ctx, 3.6, -2.5, 4, 3.2, 0.4);
            ctx.fill();
            ell(ctx, 2.6, 2.4, 2.8, 2.2, -0.3);
            ctx.fill();
            ctx.restore();
          }
          ctx.fillStyle = '#4A3328';
          ell(ctx, 0, 0, 0.9, 3.4);
          ctx.fill();
        }
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
    function drawStars() {
      if (cur !== 5) return;
      const k = ease.inOutSine(tb);
      ctx.fillStyle = '#FFF8E2';
      for (const s of stars) {
        const a = (0.4 + 0.6 * Math.abs(Math.sin(time * (CALM ? 0.4 : 1.1) + s.ph))) * k;
        ctx.globalAlpha = a;
        const x = s.x * G.w, y = G.safeTop + s.y * (G.hz * 0.55 - G.safeTop * 0.5);
        ctx.fillRect(x - s.s / 2, y - s.s / 2, s.s, s.s);
      }
      ctx.globalAlpha = 1;
    }
    function drawCampfire() {
      if (cur !== 5 && !(tb < 1 && sitter.alpha > 0.01)) return;
      const a = sitter.alpha;
      if (a <= 0.01) return;
      const x = FIRE.fx * G.w, y = FIRE.gy * G.L;
      const fk = 1 + Math.sin(time * 7) * 0.05 + Math.sin(time * 11.3) * 0.04 + fireBoost * 0.3;
      ctx.globalCompositeOperation = 'lighter';
      const R = G.L * 0.36 * fk;
      ctx.globalAlpha = a * 0.42;
      ctx.drawImage(SPR.warm, x - R, y - R * 0.75, R * 2, R * 1.5);
      /* au moment de l'arrivée, une grande lumière chaude met la famille en valeur */
      const bloom = cur === 5 ? smooth(0.1, 0.6, humT) * (1 - smooth(1.6, 3.2, humT)) : 0;
      if (bloom > 0.01) {
        const Rb = G.w * 0.55;
        ctx.globalAlpha = bloom * 0.55;
        ctx.drawImage(SPR.light, x - Rb, y - Rb * 0.8, Rb * 2, Rb * 1.6);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = a;
      drawFire(ctx, x, y, G.U * 0.95, time * (CALM ? 0.5 : 1), fireBoost);
      ctx.globalAlpha = 1;
    }
    function drawFlash() {
      if (cur !== 3 || seq < 1.88 || seq > 2.7) return;
      const u = seq - 1.88;
      const a = (CALM ? 0.3 : 0.75) * (u < 0.08 ? u / 0.08 : 1 - smooth(0.08, 0.8, u));
      ctx.fillStyle = `rgba(255,244,214,${a})`;
      ctx.fillRect(0, 0, G.w, G.L);
    }
    function drawTimeWave() {
      if (tb >= 1 || CALM) return;
      const k = ease.inOutSine(tb);
      const x = tDir > 0 ? lerp(-0.25, 1.25, k) * G.w : lerp(1.25, -0.25, k) * G.w;
      const wv = G.w * 0.3;
      const gr = ctx.createLinearGradient(x - wv, 0, x + wv, 0);
      gr.addColorStop(0, 'rgba(255,248,225,0)');
      gr.addColorStop(0.5, `rgba(255,248,225,${0.22 * Math.sin(k * Math.PI)})`);
      gr.addColorStop(1, 'rgba(255,248,225,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, G.w, G.L);
    }

    /* la loupe : le tout dernier bout de la frise, très grossi */
    function drawLoupe() {
      if (lensK < 0.01) return;
      const k = ease.outBack(clamp(lensK));
      const R = G.lensR * k;
      if (R < 8) return;
      const cx = G.lensX, cy = G.lensY;
      const px = X(1) - 2, py = G.ty, r1 = 7;
      const dx = cx - px, dy = cy - py;
      const d = Math.hypot(dx, dy) || 1;
      const nx = -dy / d, ny = dx / d;
      ctx.globalAlpha = clamp(lensK);
      ctx.strokeStyle = 'rgba(255,228,92,0.75)';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(px + nx * r1, py + ny * r1);
      ctx.lineTo(cx + nx * R, cy + ny * R);
      ctx.moveTo(px - nx * r1, py - ny * r1);
      ctx.lineTo(cx - nx * R, cy - ny * R);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, r1, 0, TAU);
      ctx.stroke();
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, TAU);
      ctx.fillStyle = '#132A27';
      ctx.fill();
      ctx.clip();
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i % 2 ? 'rgba(255,240,220,0.035)' : 'rgba(0,0,0,0.12)';
        ctx.fillRect(cx - R, cy - R + (i * R) / 2, R * 2, R / 4);
      }
      const Z = Math.exp(Math.log(ZOOM_MAX) * ease.inOutSine(clamp(zoomK)));
      const right = cx + R * 0.66, len = R * 1.4;
      const LX = (f) => right - (1 - f) * len * Z;
      const yy = cy + R * 0.3, hh = Math.max(7, R * 0.2);
      const segs = [[0, F_DINO_END], [F_DINO_END, F_HUMANS], [F_HUMANS, 1]];
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      draw.roundRect(ctx, cx - R - 4, yy - hh / 2 - 3, right - cx + R + 8, hh + 6, (hh + 6) / 2);
      ctx.fill();
      for (let i = 0; i < 3; i++) {
        const a0 = Math.max(LX(segs[i][0]), cx - R - 10), a1 = LX(segs[i][1]);
        if (a1 <= a0) continue;
        ctx.fillStyle = SEG_COL[i];
        ctx.fillRect(a0, yy - hh / 2, a1 - a0, hh);
      }
      const hx0 = LX(F_HUMANS), hw = right - hx0;
      if (hw > 3) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = clamp(lensK) * 0.6 * (0.8 + 0.2 * Math.sin(time * 3));
        ctx.drawImage(SPR.light, hx0 + hw / 2 - hw, yy - hw, hw * 2, hw * 2);
        ctx.globalAlpha = clamp(lensK);
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(right - 1, yy - hh / 2 - 4, 2, hh + 8);
      /* petits repères : un dinosaure qui file vers la gauche, l'humain qui apparaît */
      const dk = 1 - smooth(0.05, 0.4, zoomK);
      if (dk > 0.01) {
        const s = R * 0.0048;
        ctx.globalAlpha = clamp(lensK) * dk;
        ctx.save();
        ctx.translate((LX(0) + LX(F_DINO_END)) / 2, yy - hh / 2 - 2);
        ctx.scale(s, s);
        ICONS[0].a.spec.draw(ctx, ICONS[0].a, 1.1 / s);
        ctx.restore();
      }
      const hk = smooth(14, 30, hw);
      if (hk > 0.01) {
        const s = R * 0.0068;
        const fx = hx0 + hw / 2, fy = yy - hh / 2 - 3;
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = clamp(lensK) * hk * 0.7;
        ctx.drawImage(SPR.warm, fx - R * 0.5, fy - R * 0.75, R, R);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = clamp(lensK) * hk;
        ctx.save();
        ctx.translate(fx, fy);
        ctx.scale(-s, s);
        ICONS[5].a.spec.draw(ctx, ICONS[5].a, 1.1 / s);
        ctx.restore();
      }
      ctx.restore();
      ctx.globalAlpha = clamp(lensK);
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, TAU);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#FFE45C';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, R - 5, -2.5, -1.6);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    function drawBand() {
      ctx.drawImage(band, 0, G.L, G.w, G.Hb);
      const x0 = G.x0, x1 = G.x1, ty = G.ty, th = G.th;
      ctx.fillStyle = 'rgba(0,0,0,0.42)';
      draw.roundRect(ctx, x0 - 6, ty - th / 2 - 4, x1 - x0 + 12, th + 8, (th + 8) / 2);
      ctx.fill();
      ctx.save();
      draw.roundRect(ctx, x0 - 3, ty - th / 2, x1 - x0 + 6, th, th / 2);
      ctx.clip();
      const segs = [[0, F_DINO_END], [F_DINO_END, F_HUMANS], [F_HUMANS, 1]];
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = SEG_COL[i];
        const a0 = i === 0 ? x0 - 4 : X(segs[i][0]);
        const a1 = i === 2 ? x1 + 4 : X(segs[i][1]);
        ctx.fillRect(a0, ty - th / 2, Math.max(1, a1 - a0), th);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillRect(x0 - 4, ty - th / 2, x1 - x0 + 8, th * 0.32);
      ctx.restore();
      /* repères exacts et fils vers les médaillons */
      ctx.lineWidth = 1.2;
      for (let i = 0; i < N; i++) {
        const tx = X(MOMENTS[i].f);
        const on = i === cur;
        ctx.strokeStyle = on ? rgba(COL.acc, 0.9) : 'rgba(239,248,242,0.35)';
        ctx.beginPath();
        ctx.moveTo(icx[i], G.iy + G.ir + 1);
        ctx.lineTo(icx[i], G.iy + G.ir + 4);
        ctx.lineTo(tx, ty - th / 2 - 5);
        ctx.stroke();
        ctx.fillStyle = on ? COL.acc : 'rgba(239,248,242,0.8)';
        ctx.fillRect(tx - 1, ty - th / 2 - 3, 2, th + 6);
      }
      /* médaillons */
      if (!icons) makeIcons();
      /* le médaillon suivant pulse doucement : il montre le chemin vers aujourd'hui */
      const next = (moved || nFound > 0) && !finished && cur < N - 1 ? cur + 1 : -1;
      for (let i = 0; i < N; i++) {
        const img = icons[i][found[i] ? 1 : 0];
        const S = img.width / cv.dpr;
        const on = i === cur;
        const sc = on ? 1.1 : 1;
        if (on) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.45;
          ctx.drawImage(SPR.warm, icx[i] - G.ir * 1.9, G.iy - G.ir * 1.9, G.ir * 3.8, G.ir * 3.8);
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = 'source-over';
        }
        ctx.drawImage(img, icx[i] - (S * sc) / 2, G.iy - (S * sc) / 2, S * sc, S * sc);
        if (on) {
          ctx.beginPath();
          ctx.arc(icx[i], G.iy, G.ir * sc + 2.5, 0, TAU);
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = COL.acc;
          ctx.stroke();
        } else if (i === next && !CALM) {
          const k = (pulse % 1.6) / 1.6;
          ctx.beginPath();
          ctx.arc(icx[i], G.iy, G.ir + 2 + k * 7, 0, TAU);
          ctx.lineWidth = 2;
          ctx.strokeStyle = `rgba(255,255,255,${0.55 * (1 - k)})`;
          ctx.stroke();
        }
      }
      /* le curseur */
      const kx = X(pos);
      const big = drag && drag.active;
      const r = (big ? 13 : 11) * Math.min(1.15, Math.max(0.9, G.U));
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = big ? 0.75 : 0.5;
      ctx.drawImage(SPR.warm, kx - r * 2.6, ty - r * 2.6, r * 5.2, r * 5.2);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.beginPath();
      ctx.arc(kx, ty + 1.5, r, 0, TAU);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(kx, ty, r, 0, TAU);
      ctx.fillStyle = COL.acc;
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#FFF7E8';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(kx, ty, r * 0.42, 0, TAU);
      ctx.fillStyle = '#FFF7E8';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(kx - r * 0.35, ty - r * 0.4, r * 0.22, 0, TAU);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fill();
    }

    function render() {
      if (!band || !snap) return;
      const shake = cur === 3 && !CALM && seq > 1.9 && seq < 2.6 ? (1 - (seq - 1.9) / 0.7) * 4 * G.U : 0;
      ctx.save();
      if (shake) ctx.translate(Math.sin(time * 60) * shake, Math.cos(time * 47) * shake * 0.6);
      if (tb < 1) {
        ctx.drawImage(snap.c, 0, 0, G.w, G.L);
        ctx.globalAlpha = ease.inOutSine(tb);
        drawSceneBg(ctx, cur);
        ctx.globalAlpha = 1;
      } else {
        drawSceneBg(ctx, cur);
      }
      drawStars();
      drawAsteroid();
      drawDust();
      for (const a of actors) if (a.alpha > 0.01) drawActor(a);
      drawCampfire();
      drawFlyers();
      drawParticles();
      drawFlash();
      drawTimeWave();
      for (const rg of rings) {
        if (rg.y >= G.L) continue;
        const k = rg.t / rg.dur;
        ctx.strokeStyle = rgba(rg.col, 0.75 * (1 - k));
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(rg.x, rg.y, lerp(rg.r0, rg.r1, ease.outCubic(k)), 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
      drawBand();
      drawLoupe();
      for (const rg of rings) {
        if (rg.y < G.L) continue;
        const k = rg.t / rg.dur;
        ctx.strokeStyle = rgba(rg.col, 0.8 * (1 - k));
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(rg.x, rg.y, lerp(rg.r0, rg.r1, ease.outCubic(k)), 0, TAU);
        ctx.stroke();
      }
    }

    api.loop((dt) => {
      update(dt);
      render();
    });

    cv.onResize((w, h) => {
      layout(w, h);
      snapshot(true);
      if (!finished && !moved) showGesture();
    });

    function showGesture() {
      if (!G.w || G.w < 2) return;
      api.gesture('drag', {
        x: ((X(0) + 4) / G.w) * 100,
        y: (G.ty / G.h) * 100,
        dx: Math.round(X(MOMENTS[1].f) - X(0) - 8),
        dy: 0,
      });
    }

    function reset() {
      pos = 0;
      posAnim = null;
      drag = null;
      cur = 0;
      tb = 1;
      shownT = 0;
      found = new Array(N).fill(false);
      nFound = 0;
      furthest = 0;
      finished = false;
      seq = SETTLED;
      phase2 = false;
      humT = 0;
      mamT = 0;
      lensK = 0;
      zoomK = 0;
      wowT = 0;
      moved = false;
      hintShown = '';
      fireBoost = 0;
      rings.length = 0;
      RUN.x = 0.4;
      RUN.gait = 0;
      RUN.state = 'stop';
      RUN.timer = 1.2;
      for (const s of sparks) s.on = false;
      for (const b of bursts) b.on = false;
      for (const a of actors) {
        a.fx = a.home.fx;
        a.dir = a.home.dir;
        a.dirK = a.dir;
        a.alpha = (a.mask & 1) ? 1 : 0;
        a.react = 0;
        a.hopT = 9;
        a.grow = 1;
      }
      cv.canvas.classList.remove('is-dragging');
      showLabel(false);
      updateNav();
      if (G.w > 2) {
        snapshot(true);
        showGesture();
      }
    }
    api.onReset(reset);
    reset();
    update(0.016);
    render();
  };
})();
