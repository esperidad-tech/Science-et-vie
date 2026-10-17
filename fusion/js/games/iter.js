/* Monte ITER : la fosse du tokamak vue de dessus, en Provence. Les 9 modules de l'anneau arrivent
   un par un, suspendus au pont roulant. On fait glisser chacun jusqu'à son emplacement, puis on
   l'ajuste tout doucement jusqu'à ce que le viseur passe du rouge au vert : le module descend.
   Les modules 7 à 9 sont plus délicats : le pont roulant se balance un peu. Anneau fermé : on
   imagine le plasma qui s'allumera un jour à l'intérieur. */
(function () {
  'use strict';
  const { lib } = window.RM;
  const { TAU, rand, clamp, lerp, ease, rgba, draw } = lib;

  /* Tous les textes du jeu, faciles à corriger */
  const TEXTES = {
    consigne: 'Fais glisser chaque morceau de l’anneau jusqu’à sa place, au millimètre près.',
    approche: 'Doucement : glisse tout petit, jusqu’à ce que le viseur passe au vert.',
    tapeEncore: 'Tape encore : le module s’ajuste au millimètre.',
    astuce: 'Astuce : tu peux aussi taper. Le module va tout seul à sa place, puis s’ajuste.',
    suivant: 'Module posé ! Fais glisser le suivant jusqu’à sa place.',
    juillet: 'En juillet 2026, le vrai chantier en était là : 6 modules sur 9.',
    balance: 'Les modules 7 à 9 sont attendus jusqu’à mi-2027. Attention : le pont roulant se balance un peu !',
    encoreDeux: 'Module posé ! Encore deux. Attends que le module se calme avant de viser.',
    dernier: 'Plus qu’un module pour fermer l’anneau !',
    ferme: 'L’anneau est fermé ! Un jour, le plasma s’allumera là-dedans.',
    compteur: 'Modules : {n} sur 9',
    repere: '6 sur 9 en juillet 2026',
    poids: '1 module ≈ 1 100 tonnes',
    complet: 'ITER complet : 23 000 tonnes = 3 tours Eiffel',
    fin: '2034 : premiers plasmas — 2036 : pleine puissance magnétique — 2039 : deutérium-tritium',
    finStatut: 'But : 500 MW de fusion pour 50 MW de chauffage',
    bravo: 'Bravo, Alicia !',
  };

  const N = 9;
  const HW = Math.PI / N;        /* demi-largeur d'un emplacement (20°) */
  const GAP = 0.011;             /* petit joint entre deux modules (rad) */
  const TOL = [6, 3.6];          /* tolérance du viseur (px à l'échelle 1) : modules 1 à 6, puis 7 à 9 */
  const DWELL = [0.2, 0.3];      /* temps au vert avant que le module descende (s) */
  const APPROACH = 46;           /* près de l'emplacement, le glissement devient fin */
  const GAIN = [0.38, 0.3];      /* … et le module ne suit plus qu'une partie du geste */
  const ARRIVE_T = 1.0;
  const LOWER_T = 1.0;
  const RELEASE_T = 0.35;
  const LEAVE_T = 0.55;
  const KA = 0.08;               /* balancement : réaction du module aux à-coups du pont roulant */
  const SWAY_W = 3.6;
  const SWAY_Z = 0.14;

  const fill = (s, o) => s.replace(/\{(\w+)\}/g, (m, k) => (o[k] == null ? m : o[k]));

  const CSS = `
.game[data-game="iter"] .game-canvas { -webkit-touch-callout: none; cursor: grab; }
.game[data-game="iter"] .game-canvas.is-grab { cursor: grabbing; }
.game[data-game="iter"] .it-hud { position: absolute; inset: 0; z-index: 3; pointer-events: none; }
.game[data-game="iter"] .gesture-dot {
  background: rgba(38, 34, 28, 0.86);
  box-shadow: 0 0 0 7px rgba(38, 34, 28, 0.2), 0 0 0 9px rgba(255, 253, 248, 0.7), 0 4px 14px rgba(0, 0, 0, 0.3);
}
.game[data-game="iter"] .gesture-ring { border-color: rgba(38, 34, 28, 0.75); }
.game[data-game="iter"] .it-count {
  position: absolute; left: 10px; top: 10px; padding: 7px 11px 8px;
  border-radius: 14px 17px 15px 13px; background: rgba(247, 242, 232, 0.95);
  box-shadow: 0 8px 18px -12px rgba(38, 34, 28, 0.6), inset 0 0 0 1px rgba(38, 34, 28, 0.12);
  color: var(--fg);
}
.game[data-game="iter"] .it-count-txt {
  margin: 0 0 6px; font: 700 0.9375rem/1.1 var(--font-text); font-variant-numeric: tabular-nums;
}
.game[data-game="iter"] .it-cells { position: relative; display: flex; gap: 3px; padding-bottom: 7px; }
.game[data-game="iter"] .it-cells i {
  width: 12px; height: 10px; border-radius: 3px 4px 3px 4px;
  background: rgba(38, 34, 28, 0.1); box-shadow: inset 0 0 0 1px rgba(38, 34, 28, 0.16);
  transition: background 0.3s;
}
.game[data-game="iter"] .it-cells i:nth-child(n+7) { background: transparent; box-shadow: inset 0 0 0 1.5px rgba(38, 34, 28, 0.32); }
.game[data-game="iter"] .it-cells i.is-on { background: var(--accent); box-shadow: inset 0 -2px 0 rgba(110, 55, 0, 0.35); }
.game[data-game="iter"] .it-cells i.is-new { animation: it-pop 0.5s cubic-bezier(0.2, 0.8, 0.2, 1); }
.game[data-game="iter"] .it-cells::after {
  content: ""; position: absolute; left: 0; top: 13px; width: 87px; height: 4px;
  border: 2px solid var(--accent-2); border-top: 0; border-radius: 0 0 3px 3px;
}
.game[data-game="iter"] .it-mark {
  display: block; font: 700 0.75rem/1.2 var(--font-text); color: var(--accent-2); white-space: nowrap;
}
.game[data-game="iter"] .it-sign {
  position: absolute; left: 10px; bottom: 10px; max-width: calc(100% - 20px);
  display: flex; align-items: center; gap: 8px; padding: 6px 12px 7px 7px;
  border-radius: 12px 15px 13px 14px; background: rgba(247, 242, 232, 0.95);
  box-shadow: 0 8px 18px -12px rgba(38, 34, 28, 0.6), inset 0 0 0 1px rgba(38, 34, 28, 0.12);
  color: var(--fg); font: 700 0.8125rem/1.25 var(--font-text);
}
.game[data-game="iter"] .it-sign::before {
  content: ""; flex: none; align-self: stretch; width: 9px; min-height: 20px; border-radius: 3px;
  background: repeating-linear-gradient(-45deg, #F2B807 0 4px, #2A2620 4px 8px);
}
.game[data-game="iter"] .it-sign.is-end {
  box-shadow: 0 10px 22px -12px rgba(38, 34, 28, 0.7), inset 0 0 0 2px var(--accent);
  animation: it-pop2 0.6s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.game[data-game="iter"] .it-narrow .it-count { padding: 6px 9px 7px; }
.game[data-game="iter"] .it-narrow .it-count-txt { font-size: 0.875rem; }
.game[data-game="iter"] .it-narrow .it-sign { font-size: 0.75rem; }
@keyframes it-pop { 0% { transform: scale(0.4); } 60% { transform: scale(1.3); } 100% { transform: scale(1); } }
@keyframes it-pop2 { 0% { transform: translateY(8px) scale(0.94); opacity: 0.4; } 100% { transform: none; opacity: 1; } }
`;

  function seeded(seed) {
    let s = seed >>> 0 || 1;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }

  /* Grain de béton, partagé (motif répété) */
  let GRAIN = null;
  function grain() {
    if (GRAIN) return GRAIN;
    const M = 96;
    const c = document.createElement('canvas');
    c.width = c.height = M;
    const g = c.getContext('2d');
    const im = g.createImageData(M, M);
    const nz = lib.makeNoise(23);
    const r = seeded(6);
    for (let y = 0; y < M; y++) {
      for (let x = 0; x < M; x++) {
        const v = 0.55 * nz.fbm(x / 9, y / 9, 3) + 0.45 * r();
        const j = (y * M + x) * 4;
        const l = Math.round(v * 255);
        im.data[j] = l; im.data[j + 1] = l; im.data[j + 2] = l; im.data[j + 3] = 255;
      }
    }
    g.putImageData(im, 0, 0);
    GRAIN = c;
    return c;
  }

  window.RM.games.iter = function (api) {
    const cv = api.canvas();
    const ctx = cv.ctx;
    const RMO = api.reducedMotion;
    const AMB = RMO ? 0 : 1;
    api.style(CSS);
    cv.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    /* ---- étiquettes (DOM) : compteur avec son repère, panneau du poids ---- */
    const mk = (tag, cls, txt) => {
      const e = document.createElement(tag);
      if (cls) e.className = cls;
      if (txt != null) e.textContent = txt;
      return e;
    };
    const hud = mk('div', 'it-hud');
    hud.setAttribute('aria-hidden', 'true');
    const countEl = mk('div', 'it-count');
    const countTxt = mk('p', 'it-count-txt', '');
    const cellsEl = mk('div', 'it-cells');
    const cellEls = [];
    for (let i = 0; i < N; i++) {
      const c = mk('i');
      cellsEl.appendChild(c);
      cellEls.push(c);
    }
    countEl.append(countTxt, cellsEl, mk('span', 'it-mark', lib.fr(TEXTES.repere)));
    const signEl = mk('div', 'it-sign', lib.fr(TEXTES.poids));
    hud.append(countEl, signEl);
    api.stage.appendChild(hud);

    /* ---- géométrie ---- */
    const L = { U: 1, w: 0, h: 0, R: 1 };
    let bg = null, topC = null, placedC = null, bridgeC = null, trolleyC = null;
    let sprites = [], shadows = [];

    function layout(w, h) {
      const U = Math.min(w / 360, h / 450);
      const wide = w / h > 1.15;
      const R = Math.min(w / 2 - 12 * U, h / 2 - 34 * U) / 1.1;
      const cx = w / 2, cy = h / 2 + (wide ? 0 : 6 * U);
      const r1 = R * 0.36, r2 = R * 0.8, rm = (r1 + r2) / 2, dr = r2 - r1;
      Object.assign(L, { U, w, h, wide, R, cx, cy, r1, r2, rm, dr });
      L.Rin = R * 0.95;
      L.Rout = R * 1.05;
      L.Rb = R * 0.88;
      L.Rhaz = R * 1.1;
      L.slots = [];
      for (let k = 0; k < N; k++) {
        const a = -Math.PI / 2 + (k * TAU) / N;
        L.slots.push({ a, x: cx + Math.cos(a) * rm, y: cy + Math.sin(a) * rm });
      }
      const hw = HW - GAP;
      const pts = [
        [r2 * Math.cos(hw) - rm, r2 * Math.sin(hw)],
        [r1 * Math.cos(hw) - rm, r1 * Math.sin(hw)],
        [r2 + 0.14 * dr - rm, 0.18 * dr],
        [(r2 + 0.07 * dr) * Math.cos(hw * 0.55) - rm, (r2 + 0.07 * dr) * Math.sin(hw * 0.55) + 0.08 * dr],
        [(r1 - 0.08 * dr) * Math.cos(hw * 0.55) - rm, (r1 - 0.08 * dr) * Math.sin(hw * 0.55) + 0.08 * dr],
      ];
      L.modR = Math.max(...pts.map(([x, y]) => Math.hypot(x, y))) + 2 * U;
      L.G = L.modR * 1.07 + 7 * U;
      L.gw = 11 * U;
      L.park = { x: w - L.modR - 10 * U, y: wide ? h * 0.3 : L.G + L.gw / 2 + 16 * U };
      L.top = -L.modR - L.G - 30 * U;
      L.tol = [TOL[0] * U, TOL[1] * U];
      L.approach = APPROACH * U;
    }

    const newCanvas = () => {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(cv.w * cv.dpr));
      c.height = Math.max(1, Math.round(cv.h * cv.dpr));
      return c;
    };
    function textureIn(g, x, y, w, h, alpha, op) {
      g.save();
      g.globalCompositeOperation = op || 'overlay';
      g.globalAlpha = alpha;
      g.fillStyle = g.createPattern(grain(), 'repeat');
      g.fillRect(x, y, w, h);
      g.restore();
    }
    function sectorPath(g, cx, cy, ri, ro, a0, a1) {
      g.beginPath();
      g.arc(cx, cy, ro, a0, a1);
      g.arc(cx, cy, ri, a1, a0, true);
      g.closePath();
    }
    function ringPath(g, cx, cy, ri, ro) {
      g.beginPath();
      g.arc(cx, cy, ro, 0, TAU);
      g.moveTo(cx + ri, cy);
      g.arc(cx, cy, ri, 0, TAU, true);
    }

    /* ---- fond : dalle de béton, liseré de sécurité, mur de protection, fond de la fosse ---- */
    function paintBg() {
      const c = newCanvas();
      const g = c.getContext('2d');
      g.scale(cv.dpr, cv.dpr);
      const { w, h, U, R, cx, cy, r1, r2 } = L;

      const fg = g.createLinearGradient(0, 0, w, h);
      fg.addColorStop(0, '#E7DFCE');
      fg.addColorStop(1, '#CBBFA8');
      g.fillStyle = fg;
      g.fillRect(0, 0, w, h);
      textureIn(g, 0, 0, w, h, 0.5);
      const rs = seeded(41);
      for (let i = 0; i < 7; i++) draw.glow(g, rs() * w, rs() * h, (40 + rs() * 80) * U, '#7E6C52', 0.06 + rs() * 0.05);
      /* joints des dalles */
      const step = 96 * U;
      g.lineWidth = 1;
      for (let x = (cx % step) - step / 2; x < w; x += step) {
        g.strokeStyle = 'rgba(86, 72, 52, 0.18)';
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x, h);
        g.stroke();
        g.strokeStyle = 'rgba(255, 252, 244, 0.4)';
        g.beginPath();
        g.moveTo(x + 1, 0);
        g.lineTo(x + 1, h);
        g.stroke();
      }
      for (let y = (cy % step) - step / 2; y < h; y += step) {
        g.strokeStyle = 'rgba(86, 72, 52, 0.18)';
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(w, y);
        g.stroke();
        g.strokeStyle = 'rgba(255, 252, 244, 0.4)';
        g.beginPath();
        g.moveTo(0, y + 1);
        g.lineTo(w, y + 1);
        g.stroke();
      }
      /* zone de dépôt peinte au sol, là où arrivent les modules */
      const P = L.park;
      g.save();
      g.translate(P.x, P.y);
      const zr = L.modR * 0.98;
      g.strokeStyle = 'rgba(232, 134, 12, 0.55)';
      g.lineWidth = 2 * U;
      g.setLineDash([7 * U, 5 * U]);
      g.beginPath();
      g.arc(0, 0, zr, 0, TAU);
      g.stroke();
      g.setLineDash([]);
      g.restore();

      /* dans le coin, un peu de matériel de chantier : une palette de tôles et deux cônes */
      const kx = w - 46 * U, ky = h - 40 * U;
      if (Math.hypot(kx - cx, ky - cy) > L.Rhaz + 40 * U) {
        g.save();
        g.translate(kx, ky);
        g.rotate(-0.12);
        g.fillStyle = 'rgba(60, 44, 24, 0.22)';
        draw.roundRect(g, -22 * U + 4 * U, -15 * U + 5 * U, 44 * U, 30 * U, 3 * U);
        g.fill();
        g.fillStyle = '#B48A5A';
        draw.roundRect(g, -22 * U, -15 * U, 44 * U, 30 * U, 2.5 * U);
        g.fill();
        g.fillStyle = 'rgba(80, 52, 24, 0.45)';
        for (let i = 0; i < 4; i++) g.fillRect(-22 * U, -15 * U + i * 8 * U + 6 * U, 44 * U, 1.4 * U);
        for (let i = 0; i < 3; i++) {
          const o = i * 2.2 * U;
          const pg = g.createLinearGradient(-18 * U, -12 * U, 18 * U, 12 * U);
          pg.addColorStop(0, '#D7DBDE');
          pg.addColorStop(1, '#8D9499');
          g.fillStyle = 'rgba(40, 36, 30, 0.25)';
          g.fillRect(-17 * U + o + 1.5 * U, -11 * U - o + 1.5 * U, 32 * U, 21 * U);
          g.fillStyle = pg;
          g.fillRect(-17 * U + o, -11 * U - o, 32 * U, 21 * U);
        }
        g.restore();
        for (const [ox, oy] of [[-46, 6], [-36, -24]]) {
          const x = kx + ox * U, y = ky + oy * U;
          g.fillStyle = 'rgba(60, 44, 24, 0.25)';
          g.beginPath();
          g.arc(x + 3 * U, y + 4 * U, 8 * U, 0, TAU);
          g.fill();
          g.fillStyle = '#2E2922';
          draw.roundRect(g, x - 8 * U, y - 8 * U, 16 * U, 16 * U, 3 * U);
          g.fill();
          const cg = g.createRadialGradient(x - 2 * U, y - 2 * U, 0, x, y, 7 * U);
          cg.addColorStop(0, '#FFB15A');
          cg.addColorStop(1, '#E06A0A');
          g.fillStyle = cg;
          g.beginPath();
          g.arc(x, y, 6.5 * U, 0, TAU);
          g.fill();
          g.strokeStyle = '#F7F2E8';
          g.lineWidth = 1.8 * U;
          g.beginPath();
          g.arc(x, y, 3.8 * U, 0, TAU);
          g.stroke();
          g.fillStyle = '#FFD9A8';
          g.beginPath();
          g.arc(x, y, 1.4 * U, 0, TAU);
          g.fill();
        }
      }

      /* ombre douce autour de la fosse */
      draw.glow(g, cx + 6 * U, cy + 8 * U, L.Rhaz * 1.25, '#6B5A40', 0.25);

      /* liseré de sécurité jaune et noir */
      ringPath(g, cx, cy, L.Rout, L.Rhaz);
      g.fillStyle = '#EDB40A';
      g.fill('evenodd');
      g.save();
      ringPath(g, cx, cy, L.Rout, L.Rhaz);
      g.clip('evenodd');
      const M = Math.round((TAU * L.Rhaz) / (10 * U));
      g.fillStyle = '#2E2922';
      for (let i = 0; i < M; i += 2) {
        const a0 = (i / M) * TAU, a1 = ((i + 1) / M) * TAU, sk = (1.1 / M) * TAU;
        g.beginPath();
        g.moveTo(cx + Math.cos(a0) * L.Rout, cy + Math.sin(a0) * L.Rout);
        g.lineTo(cx + Math.cos(a1) * L.Rout, cy + Math.sin(a1) * L.Rout);
        g.lineTo(cx + Math.cos(a1 + sk) * (L.Rhaz + 2), cy + Math.sin(a1 + sk) * (L.Rhaz + 2));
        g.lineTo(cx + Math.cos(a0 + sk) * (L.Rhaz + 2), cy + Math.sin(a0 + sk) * (L.Rhaz + 2));
        g.closePath();
        g.fill();
      }
      textureIn(g, cx - L.Rhaz, cy - L.Rhaz, L.Rhaz * 2, L.Rhaz * 2, 0.45);
      g.restore();

      /* sommet du mur de protection (béton clair) */
      ringPath(g, cx, cy, L.Rin, L.Rout);
      const bgr = g.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
      bgr.addColorStop(0, '#EEE7D9');
      bgr.addColorStop(1, '#C9BDA6');
      g.fillStyle = bgr;
      g.fill('evenodd');
      g.save();
      ringPath(g, cx, cy, L.Rin, L.Rout);
      g.clip('evenodd');
      textureIn(g, cx - L.Rout, cy - L.Rout, L.Rout * 2, L.Rout * 2, 0.55);
      g.strokeStyle = 'rgba(90, 76, 56, 0.25)';
      g.lineWidth = 0.8;
      g.beginPath();
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * TAU;
        g.moveTo(cx + Math.cos(a) * L.Rin, cy + Math.sin(a) * L.Rin);
        g.lineTo(cx + Math.cos(a) * L.Rout, cy + Math.sin(a) * L.Rout);
      }
      g.stroke();
      g.fillStyle = 'rgba(70, 60, 46, 0.45)';
      for (let i = 0; i < 48; i++) {
        const a = ((i + 0.5) / 48) * TAU, rr = (L.Rin + L.Rout) / 2;
        g.beginPath();
        g.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 1.1 * U, 0, TAU);
        g.fill();
      }
      g.restore();
      g.strokeStyle = 'rgba(255, 252, 244, 0.6)';
      g.lineWidth = 1;
      g.beginPath();
      g.arc(cx, cy, L.Rout - 0.5, Math.PI * 0.9, Math.PI * 1.65);
      g.stroke();

      /* paroi intérieure du puits : à l'ombre en haut à gauche, éclairée en bas à droite */
      ringPath(g, cx, cy, L.Rb, L.Rin);
      const wg = g.createLinearGradient(cx - R * 0.7, cy - R * 0.7, cx + R * 0.7, cy + R * 0.7);
      wg.addColorStop(0, '#5E5446');
      wg.addColorStop(0.5, '#86796A');
      wg.addColorStop(1, '#B9AC97');
      g.fillStyle = wg;
      g.fill('evenodd');

      /* fond de la fosse : la base d'acier du cryostat */
      g.save();
      g.beginPath();
      g.arc(cx, cy, L.Rb, 0, TAU);
      g.clip();
      const fl = g.createRadialGradient(cx, cy, r1 * 0.5, cx, cy, L.Rb);
      fl.addColorStop(0, '#A9ABA8');
      fl.addColorStop(0.7, '#979A98');
      fl.addColorStop(1, '#6F716F');
      g.fillStyle = fl;
      g.fillRect(cx - L.Rb, cy - L.Rb, L.Rb * 2, L.Rb * 2);
      textureIn(g, cx - L.Rb, cy - L.Rb, L.Rb * 2, L.Rb * 2, 0.35);
      g.strokeStyle = 'rgba(40, 42, 44, 0.22)';
      g.lineWidth = 1;
      g.beginPath();
      for (let i = 0; i < 36; i++) {
        const a = (i / 36) * TAU;
        g.moveTo(cx + Math.cos(a) * r1 * 0.95, cy + Math.sin(a) * r1 * 0.95);
        g.lineTo(cx + Math.cos(a) * L.Rb, cy + Math.sin(a) * L.Rb);
      }
      g.stroke();
      for (const rr of [r1 * 1.02, r2 * 1.02, L.Rb * 0.97]) {
        g.beginPath();
        g.arc(cx, cy, rr, 0, TAU);
        g.stroke();
      }
      /* l'ombre du mur tombe sur le fond, en haut à gauche */
      const sh = g.createLinearGradient(cx - R * 0.95, cy - R * 0.95, cx, cy);
      sh.addColorStop(0, 'rgba(30, 24, 16, 0.42)');
      sh.addColorStop(0.45, 'rgba(30, 24, 16, 0)');
      g.fillStyle = sh;
      g.fillRect(cx - L.Rb, cy - L.Rb, L.Rb * 2, L.Rb * 2);
      g.restore();
      const ao = g.createRadialGradient(cx, cy, L.Rb * 0.8, cx, cy, L.Rb);
      ao.addColorStop(0, 'rgba(20, 16, 10, 0)');
      ao.addColorStop(1, 'rgba(20, 16, 10, 0.3)');
      g.fillStyle = ao;
      g.beginPath();
      g.arc(cx, cy, L.Rb, 0, TAU);
      g.fill();

      /* puits central (pour le futur solénoïde) */
      const cw = g.createRadialGradient(cx - r1 * 0.2, cy - r1 * 0.2, 0, cx, cy, r1 * 0.86);
      cw.addColorStop(0, '#4A443C');
      cw.addColorStop(1, '#2B2722');
      g.fillStyle = cw;
      g.beginPath();
      g.arc(cx, cy, r1 * 0.86, 0, TAU);
      g.fill();
      g.strokeStyle = 'rgba(230, 222, 206, 0.55)';
      g.lineWidth = 1.2;
      g.beginPath();
      g.arc(cx, cy, r1 * 0.86, Math.PI * 0.2, Math.PI * 1.1);
      g.stroke();

      /* les 9 emplacements : tracés peints, cales d'appui et croix de visée */
      for (let k = 0; k < N; k++) {
        const s = L.slots[k];
        sectorPath(g, cx, cy, r1, r2, s.a - HW + GAP, s.a + HW - GAP);
        g.fillStyle = 'rgba(46, 40, 32, 0.12)';
        g.fill();
        g.strokeStyle = 'rgba(232, 134, 12, 0.7)';
        g.lineWidth = 1.4 * U;
        g.setLineDash([5 * U, 4 * U]);
        g.stroke();
        g.setLineDash([]);
        for (const f of [0.16, 0.86]) {
          const rr = r1 + (r2 - r1) * f;
          g.save();
          g.translate(cx + Math.cos(s.a) * rr, cy + Math.sin(s.a) * rr);
          g.rotate(s.a);
          g.fillStyle = 'rgba(78, 82, 86, 0.55)';
          draw.roundRect(g, -2.5 * U, -6 * U, 5 * U, 12 * U, 1.5 * U);
          g.fill();
          g.fillStyle = 'rgba(255, 255, 255, 0.25)';
          g.fillRect(-2.5 * U, -6 * U, 1 * U, 12 * U);
          g.restore();
        }
        g.save();
        g.translate(s.x, s.y);
        g.strokeStyle = 'rgba(38, 34, 28, 0.3)';
        g.lineWidth = 1 * U;
        g.beginPath();
        g.arc(0, 0, 4 * U, 0, TAU);
        g.moveTo(-7 * U, 0);
        g.lineTo(7 * U, 0);
        g.moveTo(0, -7 * U);
        g.lineTo(0, 7 * U);
        g.stroke();
        g.restore();
      }
      return c;
    }

    /* ---- rails du pont roulant (tout en haut de la vue) ---- */
    function paintTop() {
      const c = newCanvas();
      const g = c.getContext('2d');
      g.scale(cv.dpr, cv.dpr);
      const { w, h, U } = L;
      const rw = 9 * U;
      for (const x0 of [2 * U, w - 2 * U - rw]) {
        g.fillStyle = 'rgba(60, 48, 32, 0.18)';
        g.fillRect(x0 + 10 * U, 0, rw, h);
        const gr = g.createLinearGradient(x0, 0, x0 + rw, 0);
        gr.addColorStop(0, '#9A9EA2');
        gr.addColorStop(0.45, '#C9CDD0');
        gr.addColorStop(1, '#5F6367');
        g.fillStyle = gr;
        g.fillRect(x0, 0, rw, h);
        g.fillStyle = 'rgba(40, 42, 46, 0.5)';
        g.fillRect(x0 + rw * 0.45, 0, 1.2, h);
        for (let y = 10 * U; y < h; y += 22 * U) {
          g.fillStyle = 'rgba(40, 42, 46, 0.55)';
          g.beginPath();
          g.arc(x0 + rw * 0.22, y, 1.1 * U, 0, TAU);
          g.arc(x0 + rw * 0.78, y + 0.01, 1.1 * U, 0, TAU);
          g.fill();
        }
      }
      return c;
    }

    /* ---- le pont roulant : deux poutres orange, chariot et treuil ---- */
    function paintBridge() {
      const { w, U, G, gw } = L;
      const H = Math.ceil(2 * G + gw + 40 * U);
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(w * cv.dpr));
      c.height = Math.max(1, Math.round(H * cv.dpr));
      const g = c.getContext('2d');
      g.scale(cv.dpr, cv.dpr);
      const y0 = 10 * U + gw / 2;            /* axe de la poutre du haut */
      const ys = [y0, y0 + 2 * G];
      /* ombres portées sur le sol */
      g.fillStyle = 'rgba(60, 44, 24, 0.17)';
      for (const y of ys) g.fillRect(0, y - gw / 2 + 16 * U, w, gw);
      for (const y of ys) {
        const gr = g.createLinearGradient(0, y - gw / 2, 0, y + gw / 2);
        gr.addColorStop(0, '#FFB54E');
        gr.addColorStop(0.35, '#EE8E15');
        gr.addColorStop(1, '#A45A06');
        g.fillStyle = gr;
        g.fillRect(0, y - gw / 2, w, gw);
        g.fillStyle = 'rgba(255, 236, 200, 0.6)';
        g.fillRect(0, y - gw / 2, w, 1);
        g.strokeStyle = 'rgba(110, 56, 0, 0.35)';
        g.lineWidth = 1;
        g.beginPath();
        for (let x = 6 * U; x < w; x += 13 * U) {
          g.moveTo(x, y - gw / 2 + 1.5);
          g.lineTo(x, y + gw / 2 - 1.5);
        }
        g.stroke();
      }
      /* sommiers d'extrémité, posés sur les rails */
      for (const x0 of [0, w - 16 * U]) {
        const gr = g.createLinearGradient(x0, 0, x0 + 16 * U, 0);
        gr.addColorStop(0, '#5B5F63');
        gr.addColorStop(0.5, '#8D9195');
        gr.addColorStop(1, '#46494C');
        g.fillStyle = gr;
        draw.roundRect(g, x0, y0 - gw / 2 - 6 * U, 16 * U, 2 * G + gw + 12 * U, 3 * U);
        g.fill();
        g.fillStyle = '#2E3033';
        for (const yy of [y0 - gw / 2 - 2 * U, y0 + 2 * G + gw / 2 - 2 * U]) {
          draw.roundRect(g, x0 + 4 * U, yy, 8 * U, 4 * U, 1.5 * U);
          g.fill();
        }
      }
      return { c, H, y0 };
    }

    /* le chariot : un cadre ouvert posé sur les deux poutres (le module pend au milieu),
       avec le treuil sur la poutre du haut et les poulies sur celle du bas */
    function paintTrolley() {
      const { U, G, gw } = L;
      const half = L.modR * 1.02 + 6 * U;
      const W = Math.ceil(2 * half + 10 * U);
      const H = Math.ceil(2 * G + gw + 24 * U);
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(W * cv.dpr));
      c.height = Math.max(1, Math.round(H * cv.dpr));
      const g = c.getContext('2d');
      g.scale(cv.dpr, cv.dpr);
      const xm = W / 2;
      const yT = 12 * U + gw / 2, yB = yT + 2 * G;   /* axes des deux poutres */
      const steel = (x0, x1) => {
        const gr = g.createLinearGradient(x0, 0, x1, 0);
        gr.addColorStop(0, '#5E6266');
        gr.addColorStop(0.5, '#A7ABAF');
        gr.addColorStop(1, '#45484B');
        return gr;
      };
      /* ombres des longerons */
      g.fillStyle = 'rgba(40, 30, 18, 0.2)';
      for (const sx of [-1, 1]) g.fillRect(xm + sx * half - 2.5 * U + 7 * U, yT + 9 * U, 5 * U, yB - yT);
      /* longerons (le long des côtés) et traverses (au-dessus des poutres) */
      for (const sx of [-1, 1]) {
        const x = xm + sx * half;
        g.fillStyle = steel(x - 2.5 * U, x + 2.5 * U);
        draw.roundRect(g, x - 2.5 * U, yT - 6 * U, 5 * U, yB - yT + 12 * U, 2 * U);
        g.fill();
      }
      for (const y of [yT, yB]) {
        const gr = g.createLinearGradient(0, y - 4 * U, 0, y + 4 * U);
        gr.addColorStop(0, '#B9BDC0');
        gr.addColorStop(1, '#55585B');
        g.fillStyle = gr;
        draw.roundRect(g, xm - half - 2.5 * U, y - 3.5 * U, half * 2 + 5 * U, 7 * U, 2 * U);
        g.fill();
      }
      /* treuil : un tambour strié, avec son moteur orange */
      const dw = 46 * U, dh = 15 * U;
      const dg = g.createLinearGradient(0, yT - dh / 2, 0, yT + dh / 2);
      dg.addColorStop(0, '#D3D6D8');
      dg.addColorStop(0.45, '#8E9295');
      dg.addColorStop(1, '#3E4144');
      g.fillStyle = 'rgba(40, 30, 18, 0.22)';
      draw.roundRect(g, xm - dw / 2 + 5 * U, yT - dh / 2 + 7 * U, dw, dh, 5 * U);
      g.fill();
      g.fillStyle = dg;
      draw.roundRect(g, xm - dw / 2, yT - dh / 2, dw, dh, 5 * U);
      g.fill();
      g.strokeStyle = 'rgba(30, 32, 34, 0.4)';
      g.lineWidth = 0.8;
      g.beginPath();
      for (let x = xm - dw / 2 + 5 * U; x < xm + dw / 2 - 4 * U; x += 2.6 * U) {
        g.moveTo(x, yT - dh / 2 + 2 * U);
        g.lineTo(x, yT + dh / 2 - 2 * U);
      }
      g.stroke();
      const mg = g.createLinearGradient(0, yT - dh / 2, 0, yT + dh / 2);
      mg.addColorStop(0, '#FFB54E');
      mg.addColorStop(1, '#A85D06');
      g.fillStyle = mg;
      draw.roundRect(g, xm + dw / 2 - 1 * U, yT - dh * 0.42, 13 * U, dh * 0.84, 3 * U);
      g.fill();
      /* poulies sur la poutre du bas */
      g.fillStyle = dg;
      draw.roundRect(g, xm - 13 * U, yB - 5.5 * U, 26 * U, 11 * U, 4 * U);
      g.fill();
      g.fillStyle = 'rgba(30, 32, 34, 0.55)';
      for (const sx of [-6, 6]) {
        g.beginPath();
        g.arc(xm + sx * U, yB, 2.2 * U, 0, TAU);
        g.fill();
      }
      return { c, W, H, yT };
    }

    /* ---- un module : secteur de la chambre à vide (acier) + deux bobines toroïdales (bleues) ---- */
    function moduleArt(g, sil) {
      const { r1, r2, rm, dr, U } = L;
      const hw = HW - GAP;
      const ro = r2 - 0.015 * dr, ri = r1 + 0.015 * dr;
      g.beginPath();
      g.arc(-rm, 0, ro, -hw, hw);
      g.arc(-rm, 0, ri, hw, -hw, true);
      g.closePath();
      if (sil) {
        g.fill();
      } else {
        const gr = g.createRadialGradient(-rm, 0, ri, -rm, 0, ro);
        gr.addColorStop(0, '#6A7176');
        gr.addColorStop(0.16, '#AAB1B5');
        gr.addColorStop(0.42, '#E9ECEC');
        gr.addColorStop(0.6, '#D2D7D9');
        gr.addColorStop(0.86, '#99A1A6');
        gr.addColorStop(1, '#6A7277');
        g.fillStyle = gr;
        g.fill();
        g.save();
        g.clip();
        textureIn(g, -rm + ri - 4, -ro, ro - ri + 8 + rm, ro * 2, 0.18);
        g.restore();
        g.strokeStyle = 'rgba(38, 44, 50, 0.24)';
        g.lineWidth = 0.8;
        for (const f of [0.3, 0.7]) {
          g.beginPath();
          g.arc(-rm, 0, ri + (ro - ri) * f, -hw, hw);
          g.stroke();
        }
        g.beginPath();
        for (const f of [-0.82, 0.82]) {
          const a = hw * f;
          g.moveTo(-rm + Math.cos(a) * ri, Math.sin(a) * ri);
          g.lineTo(-rm + Math.cos(a) * ro, Math.sin(a) * ro);
        }
        g.stroke();
        g.strokeStyle = 'rgba(255, 255, 255, 0.55)';
        g.lineWidth = 1;
        g.beginPath();
        g.arc(-rm, 0, ro - 0.8, -hw, hw);
        g.stroke();
        g.strokeStyle = 'rgba(34, 38, 42, 0.5)';
        g.lineWidth = 1;
        g.beginPath();
        g.arc(-rm, 0, ro, -hw, hw);
        g.arc(-rm, 0, ri, hw, -hw, true);
        g.closePath();
        g.stroke();
      }
      /* le grand port du haut, vers l'extérieur */
      const px0 = r2 - 0.17 * dr - rm, px1 = r2 + 0.14 * dr - rm, ph = 0.16 * dr;
      draw.roundRect(g, px0, -ph, px1 - px0, ph * 2, 2.5 * U);
      if (sil) {
        g.fill();
      } else {
        const pg = g.createLinearGradient(0, -ph, 0, ph);
        pg.addColorStop(0, '#DADFE1');
        pg.addColorStop(0.5, '#A7AEB2');
        pg.addColorStop(1, '#737B80');
        g.fillStyle = pg;
        g.fill();
        g.fillStyle = '#7D858A';
        draw.roundRect(g, px0 + (px1 - px0) * 0.42, -ph * 0.62, (px1 - px0) * 0.44, ph * 1.24, 1.8 * U);
        g.fill();
        g.fillStyle = 'rgba(40, 44, 48, 0.5)';
        for (const yy of [-0.42, 0, 0.42]) {
          g.beginPath();
          g.arc(px1 - (px1 - px0) * 0.08, yy * ph, 0.8 * U, 0, TAU);
          g.fill();
        }
      }
      /* deux bobines toroïdales (aimants bleus) */
      for (const sgn of [-1, 1]) {
        g.save();
        g.translate(-rm, 0);
        g.rotate(sgn * hw * 0.55);
        const x0 = r1 - 0.08 * dr, x1 = r2 + 0.07 * dr, bw = 0.075 * dr;
        draw.roundRect(g, x0, -bw, x1 - x0, bw * 2, bw * 0.7);
        if (sil) {
          g.fill();
        } else {
          const cg = g.createLinearGradient(0, -bw, 0, bw);
          cg.addColorStop(0, '#78A9E6');
          cg.addColorStop(0.35, '#3D7CCB');
          cg.addColorStop(1, '#1D4A86');
          g.fillStyle = cg;
          g.fill();
          g.strokeStyle = 'rgba(12, 32, 66, 0.35)';
          g.lineWidth = 0.8;
          g.beginPath();
          for (let x = x0 + 5 * U; x < x1 - 2 * U; x += 6 * U) {
            g.moveTo(x, -bw + 1);
            g.lineTo(x, bw - 1);
          }
          g.stroke();
          g.fillStyle = 'rgba(220, 236, 255, 0.55)';
          g.fillRect(x0 + bw * 0.6, -bw + 0.8, x1 - x0 - bw * 1.2, 1);
        }
        g.restore();
      }
    }

    function renderModule(k, shadow) {
      const pad = (shadow ? 18 : 3) * L.U;
      const S = Math.ceil((L.modR + pad) * 2);
      const c = document.createElement('canvas');
      c.width = c.height = Math.max(1, Math.round(S * cv.dpr));
      const g = c.getContext('2d');
      if (!shadow) {
        g.setTransform(cv.dpr, 0, 0, cv.dpr, 0, 0);
        g.save();
        g.translate(S / 2, S / 2);
        g.rotate(L.slots[k].a);
        moduleArt(g, false);
        g.restore();
        /* lumière rasante venue d'en haut à gauche */
        g.globalCompositeOperation = 'source-atop';
        const lg = g.createLinearGradient(0, 0, S, S);
        lg.addColorStop(0, 'rgba(255, 250, 238, 0.24)');
        lg.addColorStop(0.5, 'rgba(255, 250, 238, 0)');
        lg.addColorStop(1, 'rgba(40, 30, 18, 0.22)');
        g.fillStyle = lg;
        g.fillRect(0, 0, S, S);
        g.globalCompositeOperation = 'source-over';
      } else {
        const tmp = document.createElement('canvas');
        tmp.width = tmp.height = c.width;
        const t = tmp.getContext('2d');
        t.setTransform(cv.dpr, 0, 0, cv.dpr, 0, 0);
        t.translate(S / 2, S / 2);
        t.rotate(L.slots[k].a);
        t.fillStyle = '#000';
        moduleArt(t, true);
        g.shadowColor = 'rgba(58, 44, 26, 1)';
        g.shadowBlur = 7 * L.U * cv.dpr;
        g.shadowOffsetX = c.width;
        g.drawImage(tmp, -c.width, 0);
      }
      return { c, S };
    }

    function buildSprites() {
      sprites = [];
      shadows = [];
      for (let k = 0; k < N; k++) {
        sprites.push(renderModule(k, false));
        shadows.push(renderModule(k, true));
      }
    }

    function paintPlaced() {
      if (!cv.w || !sprites.length) return;
      placedC = newCanvas();
      const g = placedC.getContext('2d');
      g.scale(cv.dpr, cv.dpr);
      const U = L.U;
      g.globalAlpha = 0.5;
      for (let k = 0; k < N; k++) {
        if (!S.placed[k]) continue;
        const sl = L.slots[k], sh = shadows[k];
        g.drawImage(sh.c, sl.x - sh.S / 2 + 3 * U, sl.y - sh.S / 2 + 4 * U, sh.S, sh.S);
      }
      g.globalAlpha = 1;
      for (let k = 0; k < N; k++) {
        if (!S.placed[k]) continue;
        const sl = L.slots[k], sp = sprites[k];
        g.drawImage(sp.c, sl.x - sp.S / 2, sl.y - sp.S / 2, sp.S, sp.S);
      }
    }

    /* ---- état ---- */
    const S = {
      k: 0, n: 0, placed: new Array(N).fill(false), phase: 'free', pt: 0, t: 0,
      goalX: 0, goalY: 0, tx: 0, ty: 0, vx: 0, vy: 0, ax: 0, ay: 0,
      sx: 0, sy: 0, svx: 0, svy: 0, dwell: 0, green: false, anim: null, h: 1, cab: 1,
      drag: null, approached: false, usedTap: false, lastInput: 0, gestT: 0,
      dim: 0, closedT: 0, shake: 0, pending: null, lx: 0, ly: 0, doneSent: false, pulse: 0,
    };
    let dust = [];
    let sparks = [];
    let waves = [];
    const plasma = [];
    for (let i = 0; i < 170; i++) plasma.push({ a: rand(TAU), r: rand(-1, 1), w: rand(0.6, 1.4), sz: rand(0.8, 2), ph: rand(TAU) });

    const tolNow = () => L.tol[S.k < 6 ? 0 : 1];
    const modPos = () => ({ x: S.tx + S.sx, y: S.ty + S.sy });
    function errNow() {
      const sl = L.slots[S.k];
      return Math.hypot(S.tx + S.sx - sl.x, S.ty + S.sy - sl.y);
    }

    function setCount(fresh) {
      countTxt.textContent = lib.fr(fill(TEXTES.compteur, { n: S.n }));
      cellEls.forEach((c, i) => {
        c.classList.toggle('is-on', i < S.n);
        if (fresh && i === S.n - 1) {
          c.classList.remove('is-new');
          void c.offsetWidth;
          c.classList.add('is-new');
        }
      });
    }

    function showGesture() {
      if (!cv.w || S.phase !== 'free') return;
      const p = modPos();
      const sl = L.slots[S.k];
      api.gesture('drag', {
        x: clamp((p.x / cv.w) * 100, 6, 94), y: clamp((p.y / cv.h) * 100, 6, 94),
        dx: Math.round((sl.x - p.x) * 0.9), dy: Math.round((sl.y - p.y) * 0.9),
      });
      S.gestT = S.t;
    }

    function init() {
      const P = L.park || { x: 0, y: 0 };
      S.k = 0;
      S.n = 0;
      S.placed.fill(false);
      S.phase = 'free';
      S.pt = 0;
      S.pendingAt = 0;
      S.freeT = 0;
      S.tipShown = false;
      S.goalX = S.tx = P.x;
      S.goalY = S.ty = P.y;
      S.vx = S.vy = S.ax = S.ay = 0;
      S.sx = S.sy = S.svx = S.svy = 0;
      S.dwell = 0;
      S.green = false;
      S.anim = null;
      S.h = 1;
      S.cab = 1;
      S.drag = null;
      S.approached = false;
      S.usedTap = false;
      S.lastInput = S.t;
      S.dim = 0;
      S.closedT = 0;
      S.shake = 0;
      S.pending = null;
      S.doneSent = false;
      S.pulse = 0;
      dust = [];
      sparks = [];
      waves = [];
      cv.canvas.classList.remove('is-grab');
      signEl.classList.remove('is-end');
      signEl.textContent = lib.fr(TEXTES.poids);
      setCount(false);
      api.status(fill(TEXTES.compteur, { n: 0 }));
      api.progress(0);
      paintPlaced();
      showGesture();
    }

    /* ---- étapes d'un module ---- */
    function enterFree() {
      S.phase = 'free';
      S.pt = 0;
      S.freeT = 0;
      S.dwell = 0;
      S.green = false;
      S.approached = false;
      S.lastInput = S.t;
      if (S.k === 6) {
        const at = S.pendingAt || 0;
        S.pending = { at: Math.max(S.t, at), text: TEXTES.balance };
      }
    }

    function startAuto() {
      const sl = L.slots[S.k];
      const tol = tolNow();
      const ang = rand(TAU);
      const off = tol * (S.k < 6 ? 2.6 : 3) + 4 * L.U;
      const x1 = sl.x + Math.cos(ang) * off, y1 = sl.y + Math.sin(ang) * off;
      const d = Math.hypot(x1 - S.goalX, y1 - S.goalY);
      S.anim = { kind: 'auto', x0: S.goalX, y0: S.goalY, x1, y1, dur: clamp(d / (420 * L.U), 0.5, 1.1) };
      S.phase = 'auto';
      S.pt = 0;
      api.sfx.play('whoosh', { pitch: 0.6, volume: 0.35, gap: 0 });
    }

    function startAdjust() {
      const sl = L.slots[S.k];
      const d = Math.hypot(sl.x - S.goalX, sl.y - S.goalY);
      S.anim = { kind: 'adjust', x0: S.goalX, y0: S.goalY, x1: sl.x, y1: sl.y, dur: clamp(d / (60 * L.U), 0.3, 0.6) };
      S.phase = 'adjust';
      S.pt = 0;
      api.sfx.play('scrape', { pitch: 0.8, volume: 0.3, gap: 0 });
    }

    function startLower() {
      const p = modPos();
      S.phase = 'lower';
      S.pt = 0;
      S.lx = p.x;
      S.ly = p.y;
      S.drag = null;
      cv.canvas.classList.remove('is-grab');
      api.gesture(null);
      api.sfx.play('chime', { pitch: 1.25, gap: 0 });
      api.sfx.play('rumble', { volume: 0.35, gap: 0 });
      api.buzz(10);
    }

    function land() {
      const k = S.k;
      S.placed[k] = true;
      S.n++;
      paintPlaced();
      setCount(true);
      api.status(fill(TEXTES.compteur, { n: S.n }));
      api.progress(S.n / N);
      api.sfx.play('thud', { gap: 0 });
      api.buzz(14);
      S.shake = RMO ? 0 : 1;
      /* poussière de béton et petites étincelles aux joints */
      const sl = L.slots[k];
      for (let i = 0; i < 26; i++) {
        const a = sl.a + rand(-HW, HW);
        const r = Math.random() < 0.5 ? L.r2 : lerp(L.r1, L.r2, Math.random() < 0.5 ? 0 : 1);
        const x = L.cx + Math.cos(a) * r, y = L.cy + Math.sin(a) * r;
        const d = Math.atan2(y - sl.y, x - sl.x);
        const sp = rand(14, 40) * L.U;
        dust.push({ x, y, vx: Math.cos(d) * sp, vy: Math.sin(d) * sp, r0: rand(3, 6) * L.U, r1: rand(12, 22) * L.U, age: 0, life: rand(0.8, 1.4) });
      }
      for (const sgn of [-1, 1]) {
        const a = sl.a + sgn * HW;
        for (let i = 0; i < 4; i++) {
          const r = rand(L.r1, L.r2);
          const x = L.cx + Math.cos(a) * r, y = L.cy + Math.sin(a) * r;
          const d = rand(TAU), sp = rand(30, 80) * L.U;
          sparks.push({ x, y, vx: Math.cos(d) * sp, vy: Math.sin(d) * sp, age: 0, life: rand(0.25, 0.5) });
        }
      }
      if (dust.length > 120) dust.splice(0, dust.length - 120);
      /* ce que raconte Alicia après chaque module */
      const n = S.n;
      S.pending = null;
      if (n === 6) {
        api.hint(TEXTES.juillet);
        S.pendingAt = S.t + 3;
      } else if (n === 7) api.hint(TEXTES.encoreDeux);
      else if (n === 8) api.hint(TEXTES.dernier);
      else if (n === 9) api.hint(TEXTES.ferme);
      else api.hint(TEXTES.suivant);
      S.phase = 'release';
      S.pt = 0;
    }

    /* ---- gestes ---- */
    function gainNow() {
      const sl = L.slots[S.k];
      const e = Math.hypot(S.goalX - sl.x, S.goalY - sl.y);
      const g0 = GAIN[S.k < 6 ? 0 : 1];
      const f = clamp((e - tolNow()) / L.approach);
      return lerp(g0, 1, f * f * (3 - 2 * f));
    }

    /* l'alternative simple : une tape amène le module au-dessus de son emplacement,
       une deuxième tape l'ajuste au millimètre */
    function onTap() {
      if (S.phase === 'free') {
        S.usedTap = true;
        if (errNow() > L.approach * 0.8) startAuto();
        else startAdjust();
        return;
      }
      if (S.phase === 'done' || S.phase === 'closed') {
        S.pulse = 1;
        api.sfx.play('pop', { pitch: rand(0.9, 1.3), volume: 0.5 });
      }
    }

    api.track(cv.canvas, {
      down(p) {
        waves.push({ x: p.x, y: p.y, t: 0 });
        if (waves.length > 6) waves.shift();
        S.lastInput = S.t;
        if (S.drag) return;
        S.drag = { id: p.id, moved: 0 };
        cv.canvas.classList.add('is-grab');
        api.sfx.play('tick', { pitch: 1.1, volume: 0.45, gap: 40 });
        api.buzz(8);
      },
      move(p) {
        if (!S.drag || p.id !== S.drag.id) return;
        const d = Math.hypot(p.dx, p.dy);
        S.drag.moved += d;
        S.lastInput = S.t;
        if (S.phase !== 'free') return;
        const g = gainNow();
        const m = L.modR * 0.55;
        S.goalX = clamp(S.goalX + p.dx * g, m, cv.w - m);
        S.goalY = clamp(S.goalY + p.dy * g, m, cv.h - m);
        if (d > 3) api.sfx.play('scrape', { pitch: 0.6 + g * 0.4, volume: 0.18, gap: 140 });
        if (!S.approached) {
          const sl = L.slots[S.k];
          if (Math.hypot(S.goalX - sl.x, S.goalY - sl.y) < L.approach) {
            S.approached = true;
            if (S.k < 2 && !S.usedTap) api.hint(TEXTES.approche);
          }
        }
      },
      up(p, e, cancelled) {
        if (!S.drag || p.id !== S.drag.id) return;
        const wasTap = !cancelled && p.tap && S.drag.moved < 14;
        S.drag = null;
        cv.canvas.classList.remove('is-grab');
        if (wasTap) {
          onTap();
          if (S.phase === 'auto') api.hint(TEXTES.tapeEncore);
          return;
        }
        /* modules 1 à 6 : si on lâche tout près, le module finit de s'ajuster tout seul */
        if (S.phase === 'free' && S.k < 6) {
          const er = errNow(), tol = tolNow();
          if (er > tol * 0.6 && er < tol * 2.6) startAdjust();
        }
      },
    }, { touchAction: 'none' });

    /* ---- animation ---- */
    function update(dt) {
      S.t += dt;
      if (!L.slots) return;
      S.pt += dt;
      const { U } = L;
      const off = L.top;
      const attached = S.phase !== 'release' && S.phase !== 'leave' && S.phase !== 'closed' && S.phase !== 'done';

      switch (S.phase) {
        case 'arrive': {
          const k = ease.outCubic(clamp(S.pt / ARRIVE_T));
          S.goalX = L.park.x;
          S.goalY = lerp(off, L.park.y, k);
          if (S.pt >= ARRIVE_T) enterFree();
          break;
        }
        case 'auto':
        case 'adjust': {
          const A = S.anim;
          const k = (A.kind === 'auto' ? ease.inOutCubic : ease.outCubic)(clamp(S.pt / A.dur));
          S.goalX = lerp(A.x0, A.x1, k);
          S.goalY = lerp(A.y0, A.y1, k);
          if (A.kind === 'adjust') {
            S.svx *= Math.exp(-8 * dt);
            S.svy *= Math.exp(-8 * dt);
            S.sx *= Math.exp(-5 * dt);
            S.sy *= Math.exp(-5 * dt);
          }
          if (S.pt >= A.dur) {
            S.phase = 'free';
            S.pt = 0;
          }
          break;
        }
        case 'lower': {
          const sl = L.slots[S.k];
          const k = ease.outCubic(clamp(S.pt / 0.3));
          S.goalX = lerp(S.lx, sl.x, k);
          S.goalY = lerp(S.ly, sl.y, k);
          S.h = 1 - ease.inOutCubic(clamp(S.pt / LOWER_T));
          if (S.pt >= LOWER_T) {
            S.h = 0;
            land();
          }
          break;
        }
        case 'release':
          S.cab = 1 - clamp(S.pt / RELEASE_T);
          if (S.pt >= RELEASE_T) {
            S.phase = S.n >= N ? 'closed' : 'leave';
            S.pt = 0;
            S.lx = S.tx;
            S.ly = S.ty;
            if (S.phase === 'closed') {
              S.closedT = 0;
              signEl.textContent = lib.fr(TEXTES.complet);
              signEl.classList.add('is-end');
              api.sfx.play('chime', { pitch: 0.8, gap: 0 });
            }
          }
          break;
        case 'leave': {
          const k = Math.pow(clamp(S.pt / LEAVE_T), 3);
          S.goalX = lerp(S.lx, L.park.x, k);
          S.goalY = lerp(S.ly, off, k);
          if (S.pt >= LEAVE_T) {
            S.k = Math.min(N - 1, S.k + 1);
            S.h = 1;
            S.cab = 1;
            S.sx = S.sy = S.svx = S.svy = 0;
            S.phase = 'arrive';
            S.pt = 0;
            S.tx = S.goalX = L.park.x;
            S.ty = S.goalY = off;
          }
          break;
        }
        case 'closed':
        case 'done': {
          S.closedT += dt;
          const k = clamp(S.closedT / 0.9);
          S.goalX = lerp(S.lx, L.park.x, ease.inQuad(k));
          S.goalY = lerp(S.ly, off, ease.inQuad(k));
          S.dim += (1 - S.dim) * Math.min(1, dt * 1.6 * clamp((S.closedT - 0.3) / 0.3));
          if (S.phase === 'closed' && S.closedT > 3.4) {
            S.phase = 'done';
            if (!S.doneSent) {
              S.doneSent = true;
              api.done(TEXTES.fin, TEXTES.finStatut);
              api.guide(null, 'laugh', TEXTES.bravo);
            }
          }
          break;
        }
        default:
          break;
      }

      /* le pont roulant suit son objectif, en douceur */
      const px = S.tx, py = S.ty;
      const f = Math.min(1, dt / 0.05);
      S.tx += (S.goalX - S.tx) * f;
      S.ty += (S.goalY - S.ty) * f;
      const vx = (S.tx - px) / Math.max(dt, 1e-3), vy = (S.ty - py) / Math.max(dt, 1e-3);
      S.ax = clamp((vx - S.vx) / Math.max(dt, 1e-3), -5000 * U, 5000 * U);
      S.ay = clamp((vy - S.vy) / Math.max(dt, 1e-3), -5000 * U, 5000 * U);
      S.vx = vx;
      S.vy = vy;

      /* balancement (modules 7 à 9) : un pendule amorti, entretenu par un petit mouvement d'ambiance */
      if (S.k >= 6 && attached && S.phase !== 'lower' && S.phase !== 'arrive') {
        const w0 = SWAY_W, z = SWAY_Z;
        const ambX = AMB * 1.4 * U * Math.sin(S.t * 1.15);
        const ambY = AMB * 1.0 * U * Math.sin(S.t * 0.83 + 1.3);
        const zz = RMO ? 0.5 : z;
        S.svx += (-w0 * w0 * (S.sx - ambX) - 2 * zz * w0 * S.svx - KA * S.ax) * dt;
        S.svy += (-w0 * w0 * (S.sy - ambY) - 2 * zz * w0 * S.svy - KA * S.ay) * dt;
        S.sx = clamp(S.sx + S.svx * dt, -26 * U, 26 * U);
        S.sy = clamp(S.sy + S.svy * dt, -26 * U, 26 * U);
      } else {
        const d = Math.exp(-(S.phase === 'lower' ? 10 : 4) * dt);
        S.sx *= d;
        S.sy *= d;
        S.svx *= d;
        S.svy *= d;
      }

      /* viseur : au vert assez longtemps, le module descend */
      if (S.phase === 'free') {
        const er = errNow(), tol = tolNow();
        if (er <= tol) {
          S.dwell += dt;
          if (!S.green) {
            S.green = true;
            api.sfx.play('tick', { pitch: 1.8, volume: 0.6, gap: 0 });
          }
        } else {
          S.dwell = Math.max(0, S.dwell - dt * 3);
          if (er > tol * 1.4) S.green = false;
        }
        if (S.dwell >= DWELL[S.k < 6 ? 0 : 1]) startLower();
        else if (!S.drag && S.t - S.lastInput > 6 && S.t - S.gestT > 7) showGesture();
        S.freeT += dt;
        if (S.freeT > 12 && !S.usedTap && !S.tipShown) {
          S.tipShown = true;
          api.hint(TEXTES.astuce);
        }
      }
      if (S.pending && S.t >= S.pending.at && S.phase !== 'release' && S.phase !== 'leave') {
        api.hint(S.pending.text);
        S.pending = null;
      }

      S.shake = Math.max(0, S.shake - dt * 4);
      S.pulse = Math.max(0, S.pulse - dt * 1.5);
      for (let i = dust.length - 1; i >= 0; i--) {
        const d = dust[i];
        d.age += dt;
        if (d.age >= d.life) {
          dust.splice(i, 1);
          continue;
        }
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.vx *= Math.pow(0.15, dt);
        d.vy *= Math.pow(0.15, dt);
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.age += dt;
        if (s.age >= s.life) {
          sparks.splice(i, 1);
          continue;
        }
        s.x += s.vx * dt;
        s.y += s.vy * dt;
      }
      for (const p of plasma) p.a += p.w * dt * (RMO ? 0.25 : 1);
      waves = waves.filter((wv) => (wv.t += dt) < 0.6);
    }

    /* ---- dessin ---- */
    function drawSlotHint() {
      if (!(S.phase === 'free' || S.phase === 'auto' || S.phase === 'adjust' || S.phase === 'arrive')) return;
      const sl = L.slots[S.k];
      const { cx, cy, r1, r2, U } = L;
      const a = 0.5 + 0.35 * Math.sin(S.t * 4.2);
      sectorPath(ctx, cx, cy, r1, r2, sl.a - HW + GAP, sl.a + HW - GAP);
      ctx.fillStyle = rgba('#E8860C', 0.1 + 0.08 * a);
      ctx.fill();
      ctx.setLineDash([7 * U, 5 * U]);
      ctx.lineDashOffset = -S.t * 18 * U;
      ctx.strokeStyle = rgba('#E8860C', 0.55 + 0.4 * a);
      ctx.lineWidth = 2.6 * U;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    function drawDust() {
      for (const d of dust) {
        const k = d.age / d.life;
        const r = lerp(d.r0, d.r1, ease.outCubic(k));
        const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, r);
        g.addColorStop(0, rgba('#E9E0CF', 0.55 * (1 - k)));
        g.addColorStop(1, rgba('#E9E0CF', 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(d.x, d.y, r, 0, TAU);
        ctx.fill();
      }
    }

    function drawHanging() {
      const attached = S.phase === 'free' || S.phase === 'auto' || S.phase === 'adjust' || S.phase === 'arrive' || S.phase === 'lower';
      if (!attached || !sprites.length) return;
      const k = S.k;
      const { U } = L;
      const p = modPos();
      const hh = S.h;
      const sc = 1 + 0.06 * hh;
      const sh = shadows[k], sp = sprites[k];
      ctx.globalAlpha = 0.3 + 0.2 * (1 - hh);
      const ox = (3 + 13 * hh) * U, oy = (4 + 17 * hh) * U;
      ctx.drawImage(sh.c, p.x - (sh.S * sc) / 2 + ox, p.y - (sh.S * sc) / 2 + oy, sh.S * sc, sh.S * sc);
      ctx.globalAlpha = 1;
      ctx.drawImage(sp.c, p.x - (sp.S * sc) / 2, p.y - (sp.S * sc) / 2, sp.S * sc, sp.S * sc);
    }

    function drawCables() {
      const showMod = S.phase === 'free' || S.phase === 'auto' || S.phase === 'adjust' || S.phase === 'arrive' || S.phase === 'lower' || S.phase === 'release';
      if (!showMod) return;
      const { U, G } = L;
      const sl = L.slots[S.k];
      const p = S.phase === 'release' ? { x: sl.x, y: sl.y } : modPos();
      const k = S.cab;
      const hx = lerp(S.tx, p.x, k), hy = lerp(S.ty, p.y, k);
      const sc = 1 + 0.06 * S.h;
      ctx.lineCap = 'round';
      /* élingues : du crochet aux deux points de levage du module */
      if (k > 0.05) {
        const c = Math.cos(sl.a), s = Math.sin(sl.a);
        const lug = 0.3 * L.dr * sc;
        ctx.strokeStyle = rgba('#3A352E', 0.8 * k);
        ctx.lineWidth = 1.3 * U;
        ctx.beginPath();
        for (const sg of [-1, 1]) {
          const lx = p.x - s * lug * sg, ly = p.y + c * lug * sg;
          ctx.moveTo(hx, hy);
          ctx.lineTo(lx, ly);
        }
        ctx.stroke();
        ctx.fillStyle = rgba('#E8860C', k);
        for (const sg of [-1, 1]) {
          ctx.beginPath();
          ctx.arc(p.x - s * lug * sg, p.y + c * lug * sg, 2.2 * U, 0, TAU);
          ctx.fill();
        }
      }
      /* câbles du treuil jusqu'au crochet */
      ctx.strokeStyle = 'rgba(46, 42, 36, 0.8)';
      ctx.lineWidth = 1.2 * U;
      ctx.beginPath();
      for (const dx of [-8, 8]) {
        ctx.moveTo(S.tx + dx * U, S.ty - G + 5 * U);
        ctx.lineTo(hx + dx * 0.25 * U, hy - 3 * U);
        ctx.moveTo(S.tx + dx * U, S.ty + G - 3 * U);
        ctx.lineTo(hx + dx * 0.25 * U, hy + 3 * U);
      }
      ctx.stroke();
      /* moufle (le crochet) */
      const gr = ctx.createLinearGradient(hx - 5 * U, 0, hx + 5 * U, 0);
      gr.addColorStop(0, '#55514A');
      gr.addColorStop(0.5, '#8C877E');
      gr.addColorStop(1, '#3E3A34');
      ctx.fillStyle = gr;
      draw.roundRect(ctx, hx - 5 * U, hy - 6.5 * U, 10 * U, 13 * U, 3 * U);
      ctx.fill();
      ctx.fillStyle = '#E8860C';
      ctx.fillRect(hx - 5 * U, hy - 1.2 * U, 10 * U, 2.4 * U);
    }

    function drawCrane() {
      if (!bridgeC || !trolleyC) return;
      const { w, G, gw, U } = L;
      const by = S.ty;
      const B = bridgeC;
      if (by + G + gw + 30 * U < 0) return;
      ctx.drawImage(B.c, 0, by - G - B.y0, w, B.H);
      const T = trolleyC;
      ctx.drawImage(T.c, S.tx - T.W / 2, by - G - T.yT, T.W, T.H);
    }

    function drawReticle(x, y, err, tol, lock) {
      const { U } = L;
      const r = 15 * U;
      let col;
      if (err <= tol) col = '#2E9E4F';
      else col = lib.mix('#E39B0B', '#D2412F', clamp((err - tol) / (tol * 3)));
      const cross = () => {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.moveTo(x - r * 1.55, y);
        ctx.lineTo(x - r * 0.45, y);
        ctx.moveTo(x + r * 0.45, y);
        ctx.lineTo(x + r * 1.55, y);
        ctx.moveTo(x, y - r * 1.55);
        ctx.lineTo(x, y - r * 0.45);
        ctx.moveTo(x, y + r * 0.45);
        ctx.lineTo(x, y + r * 1.55);
      };
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255, 253, 248, 0.9)';
      ctx.lineWidth = 5.2 * U;
      cross();
      ctx.stroke();
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.6 * U;
      cross();
      ctx.stroke();
      if (lock > 0) {
        ctx.strokeStyle = 'rgba(255, 253, 248, 0.9)';
        ctx.lineWidth = 6 * U;
        ctx.beginPath();
        ctx.arc(x, y, r + 6 * U, -Math.PI / 2, -Math.PI / 2 + lock * TAU);
        ctx.stroke();
        ctx.strokeStyle = '#2E9E4F';
        ctx.lineWidth = 3.4 * U;
        ctx.beginPath();
        ctx.arc(x, y, r + 6 * U, -Math.PI / 2, -Math.PI / 2 + lock * TAU);
        ctx.stroke();
      }
    }

    function drawTarget(x, y) {
      const { U } = L;
      const s = 7 * U;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255, 253, 248, 0.85)';
      ctx.lineWidth = 4 * U;
      ctx.beginPath();
      ctx.moveTo(x - s, y);
      ctx.lineTo(x + s, y);
      ctx.moveTo(x, y - s);
      ctx.lineTo(x, y + s);
      ctx.stroke();
      ctx.strokeStyle = '#26221C';
      ctx.lineWidth = 1.8 * U;
      ctx.stroke();
    }

    function drawHUD() {
      const ph = S.phase;
      if (!(ph === 'free' || ph === 'auto' || ph === 'adjust' || ph === 'arrive' || ph === 'lower')) return;
      const sl = L.slots[S.k];
      if (ph !== 'lower') drawTarget(sl.x, sl.y);
      if (ph === 'arrive') return;
      const p = modPos();
      const tol = tolNow();
      const err = ph === 'lower' ? 0 : errNow();
      const lock = ph === 'lower' ? 1 : clamp(S.dwell / DWELL[S.k < 6 ? 0 : 1]);
      ctx.globalAlpha = ph === 'lower' ? clamp(1 - S.pt / 0.6) : 1;
      if (ctx.globalAlpha > 0.01) drawReticle(p.x, p.y, err, tol, lock);
      ctx.globalAlpha = 1;
    }

    function drawIgnition() {
      if (S.dim <= 0.001) return;
      const { cx, cy, rm, dr, r1, r2, U } = L;
      /* on éteint la lumière dans la fosse (le sol du chantier reste clair) */
      const dg = ctx.createRadialGradient(cx, cy, L.Rb, cx, cy, L.Rhaz * 1.18);
      dg.addColorStop(0, rgba('#120F24', 0.66 * S.dim));
      dg.addColorStop(0.35, rgba('#120F24', 0.4 * S.dim));
      dg.addColorStop(1, rgba('#120F24', 0));
      ctx.fillStyle = dg;
      ctx.beginPath();
      ctx.arc(cx, cy, L.Rhaz * 1.18, 0, TAU);
      ctx.fill();
      const t = S.closedT;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      /* les aimants s'allument un à un, tout autour de l'anneau */
      ctx.lineCap = 'butt';
      for (let k = 0; k < N; k++) {
        for (const sg of [-1, 1]) {
          const i = k * 2 + (sg > 0 ? 1 : 0);
          const on = clamp((t - 0.8 - i * 0.06) / 0.25);
          if (on <= 0) continue;
          const a = L.slots[k].a + sg * (HW - GAP) * 0.55;
          const c = Math.cos(a), s = Math.sin(a);
          const x0 = cx + c * (r1 - 0.06 * dr), y0 = cy + s * (r1 - 0.06 * dr);
          const x1 = cx + c * (r2 + 0.05 * dr), y1 = cy + s * (r2 + 0.05 * dr);
          ctx.strokeStyle = rgba('#4F9DFF', 0.2 * on);
          ctx.lineWidth = 0.3 * dr;
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.stroke();
          ctx.strokeStyle = rgba('#A8D6FF', 0.5 * on);
          ctx.lineWidth = 0.09 * dr;
          ctx.stroke();
        }
      }
      /* le plasma : un anneau rose qui s'allume et tourne */
      const ign = ease.inOutSine(clamp((t - 2.0) / 1.1));
      if (ign > 0) {
        const ext = ign * Math.PI;
        const a0 = -Math.PI / 2;
        const glow = (0.85 + 0.15 * Math.sin(S.t * 2.3)) * (1 + 0.4 * S.pulse);
        ctx.save();
        if (ext < Math.PI - 0.001) {
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.arc(cx, cy, r2 * 1.3, a0 - ext, a0 + ext);
          ctx.closePath();
          ctx.clip();
        }
        const g = ctx.createRadialGradient(cx, cy, rm - 0.42 * dr, cx, cy, rm + 0.42 * dr);
        g.addColorStop(0, 'rgba(255, 111, 216, 0)');
        g.addColorStop(0.5, rgba('#FF6FD8', 0.62 * glow));
        g.addColorStop(1, 'rgba(255, 111, 216, 0)');
        ctx.fillStyle = g;
        ringPath(ctx, cx, cy, rm - 0.42 * dr, rm + 0.42 * dr);
        ctx.fill('evenodd');
        const g2 = ctx.createRadialGradient(cx, cy, rm - 0.14 * dr, cx, cy, rm + 0.14 * dr);
        g2.addColorStop(0, 'rgba(255, 230, 248, 0)');
        g2.addColorStop(0.5, rgba('#FFE6F8', 0.7 * glow));
        g2.addColorStop(1, 'rgba(255, 230, 248, 0)');
        ctx.fillStyle = g2;
        ringPath(ctx, cx, cy, rm - 0.14 * dr, rm + 0.14 * dr);
        ctx.fill('evenodd');
        for (const p of plasma) {
          let da = ((p.a - a0) % TAU + TAU) % TAU;
          if (da > Math.PI) da = TAU - da;
          if (da > ext) continue;
          const rr = rm + p.r * 0.3 * dr * (0.8 + 0.2 * Math.sin(S.t * 2 + p.ph));
          const x = cx + Math.cos(p.a) * rr, y = cy + Math.sin(p.a) * rr;
          ctx.fillStyle = rgba(p.r > 0.5 ? '#FFFFFF' : '#FF9BE6', 0.75 * glow);
          ctx.fillRect(x - p.sz * U * 0.5, y - p.sz * U * 0.5, p.sz * U, p.sz * U);
        }
        ctx.restore();
        /* l'éclair de l'allumage, au départ */
        const fl = clamp(1 - Math.abs(t - 2.1) / 0.5);
        if (fl > 0) draw.glow(ctx, cx + Math.cos(a0) * rm, cy + Math.sin(a0) * rm, dr * 1.2, '#FFD6F2', 0.8 * fl);
      }
      ctx.restore();
    }

    function drawSparks() {
      if (!sparks.length) return;
      ctx.lineCap = 'round';
      for (const s of sparks) {
        const k = s.age / s.life;
        ctx.strokeStyle = rgba(k < 0.4 ? '#FFF6D8' : '#FFB347', 1 - k);
        ctx.lineWidth = 1.4 * L.U;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - s.vx * 0.04, s.y - s.vy * 0.04);
        ctx.stroke();
      }
    }

    function render() {
      if (!bg) return;
      const { w, h, U } = L;
      ctx.save();
      if (S.shake > 0) ctx.translate(rand(-1, 1) * S.shake * 1.6 * U, rand(-1, 1) * S.shake * 1.6 * U);
      ctx.drawImage(bg, 0, 0, w, h);
      if (placedC) ctx.drawImage(placedC, 0, 0, w, h);
      drawSlotHint();
      drawDust();
      drawHanging();
      drawCables();
      if (topC) ctx.drawImage(topC, 0, 0, w, h);
      drawCrane();
      drawIgnition();
      drawHUD();
      drawSparks();
      for (const wv of waves) {
        const k = wv.t / 0.6;
        ctx.strokeStyle = rgba(S.dim > 0.5 ? '#FFE6F8' : '#26221C', 0.45 * (1 - k));
        ctx.lineWidth = 2 * U;
        ctx.beginPath();
        ctx.arc(wv.x, wv.y, lerp(8, 30, ease.outCubic(k)) * U, 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
    }

    let prev = null;
    cv.onResize((w, h) => {
      /* garder la position du module par rapport à la fosse */
      const old = prev && { cx: L.cx, cy: L.cy, R: L.R, park: { ...L.park }, top: L.top };
      layout(w, h);
      hud.classList.toggle('it-narrow', w < 340);
      if (old) {
        const map = (x, y) => [L.cx + ((x - old.cx) * L.R) / old.R, L.cy + ((y - old.cy) * L.R) / old.R];
        [S.tx, S.ty] = map(S.tx, S.ty);
        [S.goalX, S.goalY] = map(S.goalX, S.goalY);
        [S.lx, S.ly] = map(S.lx, S.ly);
        if (S.anim) {
          [S.anim.x0, S.anim.y0] = map(S.anim.x0, S.anim.y0);
          [S.anim.x1, S.anim.y1] = map(S.anim.x1, S.anim.y1);
        }
        if (S.phase === 'free' && Math.hypot(old.park.x - S.tx, old.park.y - S.ty) < 2) {
          S.tx = S.goalX = L.park.x;
          S.ty = S.goalY = L.park.y;
        }
      } else {
        S.tx = S.goalX = L.park.x;
        S.ty = S.goalY = L.park.y;
      }
      prev = true;
      bg = paintBg();
      topC = paintTop();
      bridgeC = paintBridge();
      trolleyC = paintTrolley();
      buildSprites();
      paintPlaced();
      if (S.phase === 'free' && S.k === 0 && S.t < 1) showGesture();
    });

    api.loop((dt) => {
      update(dt);
      render();
    });

    /* pour les tests automatiques */
    api.root.__iter = () => {
      if (!L.slots) return null;
      const sl = L.slots[S.k];
      const p = modPos();
      return {
        phase: S.phase, k: S.k, n: S.n, err: errNow(), tol: tolNow(), dwell: S.dwell,
        mx: p.x, my: p.y, sx: sl.x, sy: sl.y, tx: S.tx, ty: S.ty, w: cv.w, h: cv.h, sway: Math.hypot(S.sx, S.sy),
      };
    };

    api.onReset(init);
    init();
    update(0.016);
    render();
  };
})();
