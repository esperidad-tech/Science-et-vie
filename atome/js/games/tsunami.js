/* Le tsunami et la centrale : avant l'arrivée de la vague, on rehausse la digue et/ou on monte
   les groupes électrogènes de secours sur la colline. Si la vague noie les secours, le
   refroidissement s'arrête (comme à Fukushima) ; sinon la centrale reste refroidie. */
(function () {
  'use strict';
  const { lib } = window.RM;
  const { TAU, rand, clamp, lerp, ease, rgba, draw } = lib;

  /* Tous les textes du jeu, faciles à corriger */
  const TEXTES = {
    boutons: ['Rehausser la digue', 'Monter les secours', 'Lancer la vague'],
    digue: (n) => (n < 3 ? `La digue monte : ${n} cran${n > 1 ? 's' : ''} sur 3.` : 'La digue monte : 3 crans sur 3, elle est au plus haut.'),
    secours: 'Les secours sont en haut de la colline, reliés à la centrale par un câble.',
    vague: 'La vague arrive…',
    digueTient: 'La digue arrête la vague.',
    secoursTiennent: 'L’eau passe la digue, mais les secours, en hauteur, restent au sec.',
    double: 'Double protection : rien ne passe.',
    echec: 'Les secours sont noyés : c’est ce qui s’est passé à Fukushima. Protège mieux la centrale !',
    fin: 'La centrale reste refroidie malgré la vague !',
    finStatut: 'Après Fukushima, les centrales ont été mieux protégées contre l’eau et les pannes.',
  };

  const CRANS = 3;          /* crans de digue qui suffisent */
  const CRAN_H = 32;        /* hauteur d'un cran (unités virtuelles) */
  const CRETE = 104;        /* hauteur de la vague au-dessus de la mer, contre la digue :
                               plus haute que la digue à 2 crans, plus basse qu'à 3 crans */
  const OK = '#5FE08E';     /* voyant vert */
  const KO = '#FF8A3D';     /* voyant orange */

  const ICONES = [
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V12h14v9M5 16.5h14M12 12v4.5M8.5 16.5V21M15.5 16.5V21"/><path d="M12 9V2.5M9 5.5l3-3 3 3"/></svg>',
    '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="12" width="12" height="8.5" rx="1.8"/><path d="M6.5 15.5h6M18.5 20.5V9M15.5 12l3-3 3 3"/></svg>',
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 16.5c2.5 0 3-2.5 5.5-2.5s3 2.5 5.5 2.5 3-2.5 5.5-2.5h2.5"/><path d="M3 11.5C3 6.5 7 3.5 11 3.5c3 0 5 2 5 4.5-2.5-1.2-5.5 0-5.5 3.5"/></svg>',
  ];
  const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  const CSS = `
.game[data-game="tsunami"] .ts-chips {
  position: absolute; left: 0; right: 0; bottom: 10px; z-index: 4;
  display: flex; justify-content: center; gap: 7px; padding: 0 8px;
}
.game[data-game="tsunami"] .ts-chip {
  flex: 1 1 0; min-width: 0; max-width: 196px; min-height: 52px; padding: 7px 9px; gap: 7px;
  font-size: 0.875rem; line-height: 1.15; text-align: left;
  transition: background 0.3s, color 0.3s, opacity 0.3s;
}
.game[data-game="tsunami"] .ts-ic { display: inline-flex; flex: none; }
.game[data-game="tsunami"] .ts-chip svg {
  width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.9;
  stroke-linecap: round; stroke-linejoin: round;
}
.game[data-game="tsunami"] .ts-go { background: var(--accent); color: var(--btn-fg); }
.game[data-game="tsunami"] .ts-chip.is-full, .game[data-game="tsunami"] .ts-chip.is-full[disabled] {
  opacity: 1; background: rgba(232, 245, 252, 0.22); color: var(--fg); cursor: default;
  box-shadow: inset 0 0 0 1.5px rgba(232, 245, 252, 0.4);
}
.game[data-game="tsunami"] .ts-chip.is-nudge { animation: ts-nudge 0.5s ease-in-out 1; }
.game[data-game="tsunami"] .ts-narrow .ts-ic { display: none; }
.game[data-game="tsunami"] .ts-narrow .ts-chip { text-align: center; padding: 7px 6px; }
.game[data-game="tsunami"] .ts-tiny { gap: 5px; padding: 0 6px; }
.game[data-game="tsunami"] .ts-tiny .ts-chip { font-size: 0.8125rem; padding: 6px 4px; }
@keyframes ts-nudge { 0%, 100% { transform: scale(1); } 40% { transform: scale(1.08); } }
`;

  function seeded(seed) {
    let s = seed >>> 0 || 1;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }
  const smooth = (u) => u * u * (3 - 2 * u);

  window.RM.games.tsunami = function (api) {
    const cv = api.canvas();
    const ctx = cv.ctx;
    const RMO = api.reducedMotion;
    const AMB = RMO ? 0.3 : 1;
    api.style(CSS);

    /* ---- les trois boutons ---- */
    const row = document.createElement('div');
    row.className = 'ts-chips';
    const chips = TEXTES.boutons.map((label, k) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip ts-chip' + (k === 2 ? ' ts-go' : '');
      b.innerHTML = '<span class="ts-ic"></span><span></span>';
      b.firstChild.innerHTML = ICONES[k];
      b.lastChild.textContent = label;
      b.addEventListener('click', () => action(k));
      row.appendChild(b);
      return b;
    });
    api.stage.appendChild(row);

    /* la scène ne doit jamais défiler (focus clavier d'un bouton, par exemple) */
    api.stage.addEventListener('scroll', () => {
      if (api.stage.scrollLeft || api.stage.scrollTop) {
        api.stage.scrollLeft = 0;
        api.stage.scrollTop = 0;
      }
    });

    /* ---- géométrie (unités virtuelles, au moins 360 × 450) ---- */
    const G = { U: 1, VW: 360, VH: 450 };
    let bg = null;

    function hillY(x) {
      if (x <= G.foot) return G.Lg;
      if (x >= G.edge) return G.Py;
      return G.Lg - (G.Lg - G.Py) * smooth((x - G.foot) / (G.edge - G.foot));
    }

    function layout(w, h) {
      const U = Math.min(w / 360, h / 450);
      const VW = w / U, VH = h / U;
      const ui = 72 / U;
      const room = VH - ui - 70;
      const Lg = room > 320 ? room - (room - 320) * 0.4 : room;
      const extra = VW - 360;
      Object.assign(G, { U, VW, VH, Lg, Sy: Lg + 8 });
      G.wx0 = 76 + extra * 0.55;
      G.wx1 = G.wx0 + 18;
      G.wBase = G.Sy - 20;                     /* haut de la digue sans cran */
      G.px0 = G.wx1 + 8;
      G.px1 = G.px0 + 112;
      G.ptop = Lg - 150;
      G.bx0 = G.px0 - 4;
      G.bx1 = G.px1 + 6;
      G.bbot = Lg + 64;
      G.foot = G.px1 + 6 + extra * 0.05;
      G.edge = G.foot + 74 + extra * 0.15;
      G.Py = Lg - 110;
      G.plat0 = G.edge + 4;
      G.plat1 = Math.min(VW - 3, G.plat0 + 62);
      G.hatch = G.bx1 - 16;
      G.gw = 30;
      G.gh = 21;
      /* le cœur et sa boucle d'eau de refroidissement */
      G.vx = G.px0 + 34;
      G.vt = Lg - 124;
      G.vb = Lg - 26;
      G.vr = 16;
      G.hx = G.px0 + 80;
      G.pumpX = (G.vx + G.hx) / 2 - 2;
      G.lamp = { x: G.px1 - 17, y: G.ptop + 24 };
      buildPaths();
    }

    /* chemins des deux groupes électrogènes : du sous-sol jusqu'à la plateforme */
    let paths = [];
    function buildPaths() {
      const yIn = G.bbot - 5 - G.gh / 2;
      const yOut = G.Lg - G.gh / 2 - 1;
      const starts = [G.bx0 + 26, G.bx0 + 70];
      const ends = [G.plat0 + 17, Math.min(G.plat0 + 45, G.plat1 - G.gw / 2)];
      paths = [0, 1].map((i) => {
        const pts = [];
        pts.push([starts[i], yIn], [G.hatch, yIn], [G.hatch, yOut], [G.foot, yOut]);
        for (let k = 1; k <= 14; k++) {
          const x = lerp(G.foot, G.edge, k / 14);
          pts.push([x, hillY(x) - G.gh / 2 - 1]);
        }
        pts.push([ends[i], G.Py - G.gh / 2 - 1 - i * 3]);
        const cum = [0];
        for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
        return { pts, cum, len: cum[cum.length - 1] };
      });
      /* le câble suit la route, depuis le mur de la centrale */
      G.cable = [[G.px1 - 2, G.Lg - 14], [G.px1 + 4, G.Lg - 2], [G.foot, G.Lg - 2]];
      for (let k = 1; k <= 14; k++) {
        const x = lerp(G.foot, G.edge, k / 14);
        G.cable.push([x, hillY(x) - 2]);
      }
      G.cable.push([G.plat0 + 6, G.Py - 2]);
    }
    function pathAt(P, f, out) {
      const d = clamp(f) * P.len;
      let i = 1;
      while (i < P.cum.length - 1 && P.cum[i] < d) i++;
      const t = (d - P.cum[i - 1]) / Math.max(1e-6, P.cum[i] - P.cum[i - 1]);
      out.x = lerp(P.pts[i - 1][0], P.pts[i][0], t);
      out.y = lerp(P.pts[i - 1][1], P.pts[i][1], t);
      out.a = Math.atan2(P.pts[i][1] - P.pts[i - 1][1], P.pts[i][0] - P.pts[i - 1][0]);
      if (Math.abs(out.a) > 1.35) out.a = 0;
      return out;
    }

    /* ---- textures ---- */
    function grainIn(g, x, y, w, h, alpha, seed) {
      const nz = lib.makeNoise(seed);
      const N = 72;
      const t = document.createElement('canvas');
      t.width = t.height = N;
      const tg = t.getContext('2d');
      const im = tg.createImageData(N, N);
      const r = seeded(seed + 3);
      for (let i = 0; i < N * N; i++) {
        const v = 0.6 * nz.fbm((i % N) / 6, Math.floor(i / N) / 6, 3) + 0.4 * r();
        const l = Math.round(v * 255);
        im.data[i * 4] = l; im.data[i * 4 + 1] = l; im.data[i * 4 + 2] = l; im.data[i * 4 + 3] = 255;
      }
      tg.putImageData(im, 0, 0);
      g.save();
      g.globalCompositeOperation = 'overlay';
      g.globalAlpha = alpha;
      g.fillStyle = g.createPattern(t, 'repeat');
      g.fillRect(x, y, w, h);
      g.restore();
    }

    /* ---- fond pré-rendu : ciel, colline, sol en strates, bâtiment et sous-sol ---- */
    function paintBg() {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(cv.w * cv.dpr));
      c.height = Math.max(1, Math.round(cv.h * cv.dpr));
      const g = c.getContext('2d');
      g.scale(cv.dpr * G.U, cv.dpr * G.U);
      const { VW, VH, Lg, Sy } = G;

      /* ciel du soir, calme, avec la lune */
      const sky = g.createLinearGradient(0, 0, 0, Sy);
      sky.addColorStop(0, '#061726');
      sky.addColorStop(0.5, '#0D3049');
      sky.addColorStop(1, '#286781');
      g.fillStyle = sky;
      g.fillRect(0, 0, VW, Sy + 1);
      draw.glow(g, VW * 0.1, Sy - 10, VW * 0.55, '#8FD8EE', 0.16);
      const rs = seeded(8);
      for (let i = 0; i < 46; i++) {
        const y = rs() * Sy * 0.55;
        g.fillStyle = rgba('#FFFFFF', (0.1 + rs() * 0.5) * (1 - y / (Sy * 0.6)));
        const s = 0.5 + rs() * 0.8;
        g.fillRect(rs() * VW, y, s, s);
      }
      const mx = VW * 0.17, my = Math.max(34, G.Py * 0.42), mr = 11;
      draw.glow(g, mx, my, mr * 6, '#CFEFFF', 0.16);
      draw.glow(g, mx, my, mr * 2.4, '#E8F7FF', 0.2);
      const mg = g.createRadialGradient(mx - mr * 0.35, my - mr * 0.35, 1, mx, my, mr);
      mg.addColorStop(0, '#FBFEFF');
      mg.addColorStop(1, '#C9E4EE');
      g.fillStyle = mg;
      g.beginPath();
      g.arc(mx, my, mr, 0, TAU);
      g.fill();
      g.fillStyle = 'rgba(150, 190, 205, 0.35)';
      for (const [dx, dy, r] of [[-3, -2, 2.4], [3.5, 3, 1.8], [-1, 5, 1.3]]) {
        g.beginPath();
        g.arc(mx + dx, my + dy, r, 0, TAU);
        g.fill();
      }
      /* traînées de nuages, éclairées par la lune */
      const streak = (fx, fy, len, th, seed) => {
        const rr = seeded(seed);
        const cx = VW * fx, cy = G.Py * fy;
        for (let i = 0; i < 8; i++) {
          const x = cx + (i / 7 - 0.5) * len + (rr() - 0.5) * 10, y = cy + (rr() - 0.5) * th * 1.4;
          const rx = len * (0.12 + rr() * 0.12), ry = th * (0.35 + rr() * 0.4);
          const gr = g.createLinearGradient(0, y - ry, 0, y + ry);
          gr.addColorStop(0, 'rgba(170, 215, 235, 0.2)');
          gr.addColorStop(1, 'rgba(60, 110, 140, 0)');
          g.fillStyle = gr;
          g.beginPath();
          g.ellipse(x, y, rx, ry, 0, 0, TAU);
          g.fill();
        }
      };
      streak(0.42, 0.3, 130, 5, 2);
      streak(0.8, 0.55, 100, 4, 5);
      /* crête lointaine, bleutée, derrière la colline et la centrale */
      const nz = lib.makeNoise(4);
      g.beginPath();
      g.moveTo(G.wx1, Sy);
      for (let x = G.wx1; x <= VW + 6; x += 4) {
        const u = clamp((x - G.wx1) / 90);
        g.lineTo(x, Sy - smooth(u) * (Sy - G.Py + 26) * (0.55 + 0.45 * nz.fbm(x / 46, 1.3, 3)));
      }
      g.lineTo(VW + 6, Sy);
      g.closePath();
      g.fillStyle = 'rgba(26, 66, 90, 0.85)';
      g.fill();

      /* sol en coupe : strates de roche sous la terre ferme */
      const strata = [['#4A5A55', 0], ['#3C4A48', 10], ['#33403F', 26], ['#2B3637', 48], ['#232D30', 76], ['#1D2629', 116]];
      strata.forEach(([col, y0], i) => {
        g.fillStyle = col;
        g.beginPath();
        const n2 = lib.makeNoise(i + 11);
        g.moveTo(G.wx0, Lg + y0);
        for (let x = G.wx0; x <= VW + 6; x += 6) g.lineTo(x, Lg + y0 + (y0 ? (n2.noise2(x / 34, i) - 0.5) * 6 : 0));
        g.lineTo(VW + 6, VH + 2);
        g.lineTo(G.wx0, VH + 2);
        g.closePath();
        g.fill();
      });
      grainIn(g, G.wx0, Lg, VW - G.wx0, VH - Lg, 0.3, 23);
      /* colline */
      g.beginPath();
      g.moveTo(G.foot - 4, Lg + 1);
      for (let x = G.foot - 4; x <= VW + 6; x += 3) g.lineTo(x, hillY(x));
      g.lineTo(VW + 6, Lg + 70);
      g.lineTo(G.foot - 4, Lg + 70);
      g.closePath();
      const hg = g.createLinearGradient(G.foot, G.Py, VW, Lg);
      hg.addColorStop(0, '#2E6B5D');
      hg.addColorStop(0.6, '#1F5049');
      hg.addColorStop(1, '#183F3C');
      g.fillStyle = hg;
      g.fill();
      g.save();
      g.clip();
      grainIn(g, G.foot - 4, G.Py - 4, VW - G.foot + 10, Lg - G.Py + 74, 0.18, 31);
      const lgh = g.createLinearGradient(G.foot, 0, G.foot + 50, 0);
      lgh.addColorStop(0, 'rgba(160, 230, 210, 0.16)');
      lgh.addColorStop(1, 'rgba(160, 230, 210, 0)');
      g.fillStyle = lgh;
      g.fillRect(G.foot - 4, G.Py - 4, 60, Lg - G.Py + 10);
      g.restore();
      /* herbe sur le bord de la colline */
      const rgr = seeded(29);
      g.strokeStyle = 'rgba(150, 220, 190, 0.45)';
      g.lineWidth = 0.8;
      g.beginPath();
      for (let x = G.foot; x <= VW + 4; x += 2.5 + rgr() * 3) {
        const y = hillY(x);
        g.moveTo(x, y + 0.5);
        g.lineTo(x + (rgr() - 0.5) * 2, y - 1.5 - rgr() * 2.2);
      }
      g.stroke();
      /* route de service : un ruban plus clair */
      g.strokeStyle = 'rgba(205, 220, 210, 0.22)';
      g.lineWidth = 3;
      g.lineCap = 'round';
      g.beginPath();
      for (let k = 0; k <= 30; k++) {
        const x = lerp(G.px1 + 4, G.plat1, k / 30);
        if (k) g.lineTo(x, hillY(x) - 0.5); else g.moveTo(x, hillY(x) - 0.5);
      }
      g.stroke();
      /* petits arbres sur la colline */
      const rt = seeded(17);
      for (let k = 0; k < 6; k++) {
        const x = lerp(G.foot + 30, VW - 4, rt());
        if (x > G.plat0 - 8 && x < G.plat1 + 6) continue;
        const y = hillY(x) + 1;
        const r = 3.5 + rt() * 3;
        g.fillStyle = '#163A36';
        g.fillRect(x - 0.6, y - r, 1.2, r);
        g.beginPath();
        g.arc(x, y - r * 1.25, r, 0, TAU);
        const tg = g.createLinearGradient(x - r, y - 2 * r, x + r, y);
        tg.addColorStop(0, '#4B8A70');
        tg.addColorStop(1, '#173F38');
        g.fillStyle = tg;
        g.fill();
      }
      /* plateforme vide en haut de la colline */
      g.fillStyle = '#8D9AA0';
      draw.roundRect(g, G.plat0, G.Py - 3, G.plat1 - G.plat0, 6, 2);
      g.fill();
      g.fillStyle = 'rgba(255, 255, 255, 0.35)';
      g.fillRect(G.plat0 + 2, G.Py - 3, G.plat1 - G.plat0 - 4, 1);
      g.fillStyle = '#5E6B70';
      g.fillRect(G.plat0 + 3, G.Py + 3, G.plat1 - G.plat0 - 6, 3);

      /* fond marin et rive (le côté mer de la digue) */
      g.fillStyle = '#183140';
      g.beginPath();
      g.moveTo(0, VH + 2);
      g.lineTo(0, Sy + 110);
      g.quadraticCurveTo(G.wx0 * 0.6, Sy + 80, G.wx0, Lg + 34);
      g.lineTo(G.wx0, VH + 2);
      g.closePath();
      g.fill();

      /* dalle de la terre ferme, devant la centrale */
      g.fillStyle = '#5D6B6C';
      g.fillRect(G.wx1, Lg - 1, G.foot - G.wx1 + 2, 4);
      g.fillStyle = 'rgba(220, 240, 245, 0.25)';
      g.fillRect(G.wx1, Lg - 1, G.foot - G.wx1 + 2, 0.8);

      /* sous-sol en coupe */
      g.fillStyle = '#7C878A';
      g.fillRect(G.bx0, Lg + 2, G.bx1 - G.bx0, G.bbot - Lg);
      g.save();
      g.beginPath();
      g.rect(G.bx0, Lg + 2, G.bx1 - G.bx0, G.bbot - Lg);
      g.clip();
      grainIn(g, G.bx0, Lg, G.bx1 - G.bx0, G.bbot - Lg + 4, 0.4, 51);
      g.restore();
      const big = g.createLinearGradient(0, Lg + 6, 0, G.bbot - 5);
      big.addColorStop(0, '#13262F');
      big.addColorStop(1, '#1B3640');
      g.fillStyle = big;
      g.fillRect(G.bx0 + 5, Lg + 6, G.bx1 - G.bx0 - 10, G.bbot - Lg - 11);
      draw.glow(g, (G.bx0 + G.bx1) / 2, Lg + 12, 44, '#FFE2A8', 0.12);
      g.fillStyle = '#FFE8C0';
      g.fillRect((G.bx0 + G.bx1) / 2 - 4, Lg + 7, 8, 1.4);
      /* trappe vers la surface */
      g.fillStyle = '#13262F';
      g.fillRect(G.hatch - G.gw / 2 - 2, Lg - 1, G.gw + 4, 8);
      g.fillStyle = '#9AA6A8';
      g.fillRect(G.hatch - G.gw / 2 - 4, Lg - 2, 2.5, 5);
      g.fillRect(G.hatch + G.gw / 2 + 1.5, Lg - 2, 2.5, 5);

      /* bâtiment réacteur en coupe */
      const P = { x0: G.px0, x1: G.px1, top: G.ptop };
      g.fillStyle = 'rgba(0, 0, 0, 0.3)';
      g.fillRect(P.x0 + 4, P.top + 6, P.x1 - P.x0, Lg - P.top - 6);
      const wg = g.createLinearGradient(P.x0, 0, P.x1, 0);
      wg.addColorStop(0, '#C7D3D6');
      wg.addColorStop(0.5, '#A6B4B8');
      wg.addColorStop(1, '#7E8C91');
      g.fillStyle = wg;
      draw.roundRect(g, P.x0, P.top, P.x1 - P.x0, Lg - P.top + 2, 3);
      g.fill();
      g.save();
      g.beginPath();
      g.rect(P.x0, P.top, P.x1 - P.x0, Lg - P.top);
      g.clip();
      grainIn(g, P.x0, P.top, P.x1 - P.x0, Lg - P.top, 0.35, 61);
      g.restore();
      const ig = g.createLinearGradient(0, P.top + 8, 0, Lg);
      ig.addColorStop(0, '#0E2433');
      ig.addColorStop(1, '#173546');
      g.fillStyle = ig;
      g.fillRect(P.x0 + 7, P.top + 9, P.x1 - P.x0 - 14, Lg - P.top - 10);
      g.fillStyle = '#9AA8AD';
      g.fillRect(P.x0 - 3, P.top - 3, P.x1 - P.x0 + 6, 4);
      g.fillStyle = 'rgba(255, 255, 255, 0.04)';
      g.fillRect(P.x0 + 7, Lg - 80, P.x1 - P.x0 - 14, 2);
      draw.glow(g, (P.x0 + P.x1) / 2, P.top + 14, 46, '#FFE2A8', 0.1);
      /* cuve du réacteur */
      const vx = G.vx, vt = G.vt, vb = G.vb, vr = G.vr;
      g.beginPath();
      g.arc(vx, vt + vr, vr, Math.PI, 0);
      g.arc(vx, vb - vr, vr, 0, Math.PI);
      g.closePath();
      const sg = g.createLinearGradient(vx - vr, 0, vx + vr, 0);
      sg.addColorStop(0, '#47565E');
      sg.addColorStop(0.35, '#C5D0D5');
      sg.addColorStop(1, '#3E4B53');
      g.fillStyle = sg;
      g.fill();
      g.fillStyle = '#0B1E2A';
      g.beginPath();
      g.arc(vx, vt + vr, vr - 4, Math.PI, 0);
      g.arc(vx, vb - vr, vr - 4, 0, Math.PI);
      g.closePath();
      g.fill();
      /* échangeur et pompe */
      g.fillStyle = sg;
      draw.roundRect(g, G.hx - 10, Lg - 112, 20, 60, 6);
      g.fill();
      g.fillStyle = '#0B1E2A';
      draw.roundRect(g, G.hx - 6.5, Lg - 108.5, 13, 53, 4.5);
      g.fill();
      /* tuyaux de la boucle (vides) */
      g.strokeStyle = '#6E7E86';
      g.lineWidth = 6;
      g.lineJoin = 'round';
      g.beginPath();
      loopPath(g);
      g.stroke();
      g.strokeStyle = '#0B1E2A';
      g.lineWidth = 2.6;
      g.beginPath();
      loopPath(g);
      g.stroke();
      g.fillStyle = sg;
      g.beginPath();
      g.arc(G.pumpX, Lg - 36, 6.5, 0, TAU);
      g.fill();
      g.fillStyle = '#2A3A44';
      g.beginPath();
      g.arc(G.pumpX, Lg - 36, 2.4, 0, TAU);
      g.fill();
      /* pupitre du voyant */
      g.fillStyle = '#22343E';
      draw.roundRect(g, G.lamp.x - 10, G.lamp.y - 8, 20, 16, 3);
      g.fill();
      g.strokeStyle = 'rgba(200, 225, 235, 0.35)';
      g.lineWidth = 0.8;
      g.stroke();
      return c;
    }

    function loopPath(g) {
      const Lg = G.Lg;
      g.moveTo(G.vx + G.vr - 3, Lg - 100);
      g.lineTo(G.hx - 8, Lg - 100);
      g.moveTo(G.hx - 8, Lg - 62);
      g.lineTo(G.hx - 20, Lg - 62);
      g.lineTo(G.hx - 20, Lg - 36);
      g.lineTo(G.vx + G.vr - 3, Lg - 36);
    }

    /* ---- état ---- */
    const S = {};
    let spray = [];
    let dust = [];
    let bubbles = [];
    const tmp = { x: 0, y: 0, a: 0 };
    const tmpLead = { x: 0, y: 0, a: 0 };
    const DASH = [4, 4];

    function init() {
      S.t = 0;
      S.phase = 'prep';
      S.digue = 0;
      S.digueVis = 0;
      S.digueAt = -1;
      S.secours = false;
      S.secAt = -1;
      S.waveAt = -1;
      S.outcome = null;
      S.flood = 0;          /* hauteur d'eau sur la terre ferme (0..1) */
      S.floodFront = 0;     /* avancée de l'inondation (0..1) */
      S.basement = 0;       /* remplissage du sous-sol (0..1) */
      S.cool = 1;           /* refroidissement (1 = l'eau circule) */
      S.lampsOk = true;
      S.failAt = -1;
      S.statusSet = 0;
      S.doneCalled = false;
      S.flow = 0;
      S.moving = false;
      S.arrived = false;
      S.hump = 0;
      S.xc = -100;
      S.sig = 60;
      spray = [];
      dust = [];
      bubbles = [];
      setChips();
      gestureOn(0);
    }

    function setChips() {
      const busy = S.phase === 'wave' || S.phase === 'fail';
      const fullD = S.digue >= CRANS;
      chips[0].classList.toggle('is-full', fullD);
      chips[0].firstChild.innerHTML = fullD ? CHECK : ICONES[0];
      chips[0].disabled = busy || fullD;
      chips[1].classList.toggle('is-full', S.secours);
      chips[1].firstChild.innerHTML = S.secours ? CHECK : ICONES[1];
      chips[1].disabled = busy || S.secours;
      chips[2].disabled = busy;
    }

    function gestureOn(k) {
      const b = chips[k];
      if (!b || !cv.w) return;
      const r = b.getBoundingClientRect();
      const s = api.stage.getBoundingClientRect();
      if (!s.width) return;
      api.gesture('tap', {
        x: clamp(((r.left + r.width / 2 - s.left) / s.width) * 100, 5, 95),
        y: clamp(((r.top + r.height / 2 - s.top) / s.height) * 100, 5, 95),
      });
    }

    function progress() {
      api.progress(Math.min(CRANS, S.digue) * 0.1 + (S.secours ? 0.3 : 0));
    }

    function action(k) {
      if (S.phase === 'wave' || S.phase === 'fail') return;
      if (k === 0) {
        if (S.digue >= CRANS) return;
        S.digue++;
        S.digueAt = S.t;
        api.status(TEXTES.digue(S.digue));
        api.sfx.play('thud', { pitch: 0.9 + S.digue * 0.1, gap: 0 });
        api.sfx.play('scrape', { gap: 0 });
        api.buzz(10);
        const top = G.wBase - (S.digue - 1) * CRAN_H;
        for (let i = 0; i < 12; i++) dust.push({ x: lerp(G.wx0, G.wx1, Math.random()), y: top, vx: rand(-14, 14), vy: rand(-22, -6), t: 0 });
        progress();
      } else if (k === 1) {
        if (S.secours) return;
        S.secours = true;
        S.secAt = S.t;
        S.moving = true;
        api.status(TEXTES.secours);
        api.sfx.play('rumble', { volume: 0.4, pitch: 1.4, gap: 0 });
        api.buzz(10);
        progress();
      } else {
        launch();
      }
      setChips();
    }

    function launch() {
      S.phase = 'wave';
      S.waveAt = S.t;
      S.outcome = null;
      S.statusSet = 0;
      api.status(TEXTES.vague);
      api.sfx.play('whoosh', { pitch: 0.6, gap: 0 });
      api.sfx.play('rumble', { volume: 0.5, gap: 0 });
      api.gesture(null);
      setChips();
    }

    api.track(cv.canvas, {
      up(p, e, cancelled) {
        if (cancelled || !p.tap) return;
        const x = p.x / G.U, y = p.y / G.U;
        for (let i = 0; i < 6; i++) spray.push({ x, y, vx: rand(-30, 30), vy: rand(-50, -10), t: 0, life: rand(0.4, 0.7), r: rand(0.8, 1.6) });
        api.sfx.play('pop', { pitch: rand(0.9, 1.2), volume: 0.5 });
      },
    }, { touchAction: 'pan-y' });

    /* ---- la mer et la vague ---- */
    function seaY(x) {
      const t = S.t * AMB;
      let y = G.Sy + Math.sin(x * 0.07 + t * 1.6) * 1.6 + Math.sin(x * 0.031 - t * 0.9) * 2.2;
      if (S.hump > 0.01) {
        const u = (x - S.xc) / S.sig;
        const f = u < 0 ? Math.exp(-u * u) : Math.exp(-(u * 1.7) * (u * 1.7));
        y -= S.hump * f;
      }
      return y;
    }

    function update(dt) {
      S.t += dt;
      const t = S.t;
      S.digueVis += (Math.min(S.digue, CRANS) - S.digueVis) * Math.min(1, dt * 9);
      if (Math.abs(S.digueVis - S.digue) < 0.002) S.digueVis = S.digue;

      /* la vague */
      if (S.phase === 'wave' || (S.waveAt >= 0 && S.hump > 0.01)) {
        const e = t - S.waveAt;
        const IMPACT = 1.9;
        if (e < IMPACT) {
          const k = e / IMPACT;
          S.xc = lerp(-110, G.wx0 - 16, ease.inOutSine(k));
          S.sig = lerp(64, 34, k);
          S.hump = lerp(16, CRETE, ease.inQuad(k));
        } else {
          if (!S.outcome && S.phase === 'wave') impact();
          const k = clamp((e - IMPACT - 0.22) / 1.4);
          S.hump = CRETE * (1 - ease.outCubic(k)) * (S.outcome === 'blocked' ? 1.05 : 0.9);
          S.xc = G.wx0 - 16 - (S.outcome === 'blocked' ? 24 * ease.outCubic(k) : -6 * k);
          if (k >= 1) S.hump = 0;
        }
        if (S.phase === 'wave' && S.outcome) {
          const ei = e - IMPACT;
          if (S.outcome !== 'blocked') {
            S.flood = clamp(ei / 0.5);
            S.floodFront = clamp(ei / 0.8);
            S.basement = clamp((ei - 0.35) / 0.9);
          }
          if (S.outcome === 'blocked' && ei > 0.4 && S.statusSet === 0) {
            S.statusSet = 1;
            api.status(S.secours ? TEXTES.double : TEXTES.digueTient);
          }
          if (S.outcome === 'dry' && ei > 0.8 && S.statusSet === 0) {
            S.statusSet = 1;
            api.status(TEXTES.secoursTiennent);
          }
          if (S.outcome === 'flooded' && S.basement > 0.62 && S.lampsOk) {
            S.lampsOk = false;
            S.failAt = t;
            S.phase = 'fail';
            api.status(TEXTES.echec);
            api.sfx.play('fail', { gap: 0 });
            api.buzz([12, 40, 12]);
            api.guide(null, 'wow');
            setChips();
          }
          if (S.outcome !== 'flooded' && ei > (S.outcome === 'blocked' ? 2.0 : 2.6)) success();
        }
      }

      /* échec : on attend un peu, puis l'eau se retire et on revient à la préparation */
      if (S.phase === 'fail') {
        const e = t - S.failAt;
        if (e > 2.5) {
          const k = clamp((e - 2.5) / 1.0);
          S.flood = 1 - k;
          S.basement = 1 - k;
          if (k >= 1) {
            S.phase = 'prep';
            S.lampsOk = true;
            S.flood = 0;
            S.floodFront = 0;
            S.basement = 0;
            S.waveAt = -1;
            api.sfx.play('chime', { pitch: 0.8, gap: 0 });
            api.guide(null, 'smile');
            setChips();
            gestureOn(S.digue < CRANS ? 0 : S.secours ? 2 : 1);
          }
        }
      } else if ((S.phase === 'done' || S.phase === 'prep') && (S.flood > 0 || S.basement > 0)) {
        S.flood = Math.max(0, S.flood - dt * 0.8);
        S.basement = Math.max(0, S.basement - dt * 0.8);
        if (S.flood === 0) S.floodFront = 0;
      }
      /* l'eau circule tant que les voyants sont verts */
      S.cool += ((S.lampsOk ? 1 : 0) - S.cool) * Math.min(1, dt * 3);
      S.flow += dt * 26 * S.cool;
      /* les secours arrivent sur la plateforme */
      if (S.moving && t - S.secAt > 2.35) {
        S.moving = false;
        if (!S.arrived) {
          S.arrived = true;
          api.sfx.play('chime', { pitch: 1.1, gap: 0 });
        }
        setChips();
      }

      /* gouttes, poussière, bulles */
      for (let i = spray.length - 1; i >= 0; i--) {
        const s = spray[i];
        s.t += dt;
        s.vy += 140 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        if (s.t > s.life) spray.splice(i, 1);
      }
      for (let i = dust.length - 1; i >= 0; i--) {
        const d = dust[i];
        d.t += dt;
        d.vy += 60 * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        if (d.t > 0.7) dust.splice(i, 1);
      }
      if (S.basement > 0.05 && bubbles.length < 20 && Math.random() < dt * 14) {
        bubbles.push({ x: rand(G.bx0 + 8, G.bx1 - 8), y: G.bbot - 6, vy: -rand(10, 20), t: 0 });
      }
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        b.t += dt;
        b.y += b.vy * dt;
        const top = lerp(G.bbot - 5, G.Lg + 6, S.basement);
        if (b.y < top + 1 || b.t > 3) bubbles.splice(i, 1);
      }
    }

    function impact() {
      const blocked = S.digue >= CRANS;
      S.outcome = blocked ? 'blocked' : S.secours ? 'dry' : 'flooded';
      api.sfx.play('splash', { gap: 0 });
      api.sfx.play('thud', { pitch: 0.6, gap: 0 });
      api.buzz(14);
      const top = G.wBase - S.digue * CRAN_H;
      const n = blocked ? 70 : 36;
      for (let i = 0; i < n; i++) {
        spray.push({
          x: G.wx0 - rand(0, 10), y: top + rand(-4, 10),
          vx: rand(-60, blocked ? 10 : 50), vy: -rand(60, blocked ? 170 : 110),
          t: 0, life: rand(0.7, 1.3), r: rand(1, 2.6),
        });
      }
    }

    function success() {
      if (S.phase === 'done') return;
      const both = S.digue >= CRANS && S.secours;
      S.phase = 'done';
      setChips();
      if (!S.doneCalled) {
        S.doneCalled = true;
        api.done(TEXTES.fin, (both ? TEXTES.double + ' ' : '') + TEXTES.finStatut);
      } else {
        api.status((both ? TEXTES.double + ' ' : '') + TEXTES.finStatut);
      }
    }

    /* ---- dessin ---- */
    function drawWall() {
      const h = S.digueVis * CRAN_H;
      const top = G.wBase - h;
      const x0 = G.wx0, x1 = G.wx1;
      const bot = G.Lg + 34;
      const cg = ctx.createLinearGradient(x0, 0, x1, 0);
      cg.addColorStop(0, '#B9C3C5');
      cg.addColorStop(0.5, '#9AA6A9');
      cg.addColorStop(1, '#6F7B7F');
      ctx.fillStyle = cg;
      ctx.fillRect(x0, top, x1 - x0, bot - top);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fillRect(x0, top, x1 - x0, 1);
      /* joints : un trait entre chaque cran, et des joints verticaux décalés */
      ctx.strokeStyle = 'rgba(40, 52, 58, 0.55)';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      const n = Math.ceil(S.digueVis - 0.001);
      for (let i = 0; i <= n; i++) {
        const y = G.wBase - i * CRAN_H;
        if (y < top - 0.5) break;
        ctx.moveTo(x0, y);
        ctx.lineTo(x1, y);
        const yn = Math.max(top, y - CRAN_H);
        if (i < n) {
          const jx = i % 2 ? x0 + 6 : x0 + 12;
          ctx.moveTo(jx, y);
          ctx.lineTo(jx, yn);
        }
      }
      ctx.moveTo(x0 + 9, G.wBase);
      ctx.lineTo(x0 + 9, G.Sy + 6);
      ctx.stroke();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
      ctx.fillRect(x1 - 3, top, 3, bot - top);
    }

    function drawSea() {
      const x1 = G.wx0 + 0.5;
      ctx.beginPath();
      ctx.moveTo(-6, G.VH + 2);
      const step = 4;
      for (let x = -6; x <= x1; x += step) ctx.lineTo(x, seaY(x));
      ctx.lineTo(x1, seaY(x1));
      ctx.lineTo(x1, G.VH + 2);
      ctx.closePath();
      const top = G.Sy - CRETE - 10;
      const sg = ctx.createLinearGradient(0, top, 0, G.VH);
      sg.addColorStop(0, '#7FDCF4');
      sg.addColorStop(0.3, '#3FA6CF');
      sg.addColorStop(0.5, '#1D6F98');
      sg.addColorStop(1, '#0A2F48');
      ctx.fillStyle = sg;
      ctx.fill();
      /* liseré clair et écume */
      ctx.strokeStyle = 'rgba(200, 245, 255, 0.75)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let x = -6; x <= x1; x += step) {
        if (x === -6) ctx.moveTo(x, seaY(x));
        else ctx.lineTo(x, seaY(x));
      }
      ctx.stroke();
      if (S.hump > 8) {
        const k = S.hump / CRETE;
        ctx.fillStyle = 'rgba(240, 252, 255, 0.85)';
        for (let i = 0; i < 16; i++) {
          const x = S.xc + (i / 15 - 0.6) * S.sig * 1.1;
          if (x > x1 || x < -6) continue;
          const y = seaY(x) + 2 + Math.sin(i * 2.3 + S.t * 6) * 1.5;
          const r = (1 + (i % 3) * 0.8) * (0.6 + 0.6 * k);
          ctx.beginPath();
          ctx.arc(x, y, r, 0, TAU);
          ctx.fill();
        }
        /* petite volute douce au sommet, penchée vers l'avant */
        const cx = S.xc, cy = seaY(S.xc);
        if (k > 0.3 && cx < x1 - 6) {
          const Lc = S.sig * 0.5 * k, Hc = 16 * k;
          ctx.beginPath();
          ctx.moveTo(cx - Lc * 0.5, cy + 2);
          ctx.bezierCurveTo(cx - Lc * 0.1, cy - Hc * 0.75, cx + Lc * 0.9, cy - Hc * 0.75, cx + Lc * 1.05, cy + Hc * 0.25);
          ctx.bezierCurveTo(cx + Lc * 0.85, cy + Hc * 0.02, cx + Lc * 0.55, cy + Hc * 0.1, cx + Lc * 0.45, cy + Hc * 0.55);
          ctx.quadraticCurveTo(cx + Lc * 0.1, cy + Hc * 0.4, cx - Lc * 0.5, cy + 2);
          ctx.closePath();
          const cg = ctx.createLinearGradient(0, cy - Hc, 0, cy + Hc);
          cg.addColorStop(0, '#C9F4FF');
          cg.addColorStop(1, '#5CC4E6');
          ctx.fillStyle = cg;
          ctx.globalAlpha = clamp((k - 0.3) * 3);
          ctx.fill();
          ctx.strokeStyle = 'rgba(245, 253, 255, 0.85)';
          ctx.lineWidth = 1.6;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
    }

    function drawOverflow() {
      if (!S.outcome || S.outcome === 'blocked') return;
      const e = S.t - S.waveAt - 1.9;
      if (e < 0) return;
      const top = G.wBase - S.digue * CRAN_H;
      /* nappe qui passe par-dessus la digue */
      const k = clamp(1 - Math.max(0, e - 0.5) / 0.9) * clamp(e / 0.15);
      if (k > 0.01) {
        ctx.beginPath();
        ctx.moveTo(G.wx0 - 2, top - 8 * k);
        ctx.quadraticCurveTo(G.wx1 + 10, top - 10 * k, G.wx1 + 18, G.Lg - 2);
        ctx.lineTo(G.wx1 + 4, G.Lg - 2);
        ctx.quadraticCurveTo(G.wx1 + 2, top + 4, G.wx0 - 2, top);
        ctx.closePath();
        ctx.fillStyle = rgba('#5CC6E6', 0.8 * k);
        ctx.fill();
        ctx.strokeStyle = rgba('#E6FAFF', 0.8 * k);
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }

    function drawFlood() {
      if (S.flood <= 0.01) return;
      const hf = 20 * S.flood;
      const xs = G.wx1;
      const xe = lerp(xs + 4, G.foot + 16, S.floodFront);
      const wy = (x) => G.Lg - hf + Math.sin(x * 0.12 + S.t * 3) * 1.2 * S.flood;
      ctx.beginPath();
      ctx.moveTo(xs, G.Lg + 2);
      for (let x = xs; x <= xe; x += 4) ctx.lineTo(x, Math.min(wy(x), hillY(x)));
      for (let x = xe; x >= xs; x -= 4) ctx.lineTo(x, hillY(x) + 2);
      ctx.closePath();
      ctx.fillStyle = rgba('#3FA9D2', 0.55);
      ctx.fill();
      ctx.strokeStyle = rgba('#D8F6FF', 0.6);
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = xs; x <= xe; x += 4) {
        const y = Math.min(wy(x), hillY(x));
        if (x === xs) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    function drawBasementWater() {
      if (S.basement <= 0.01) return;
      const top = lerp(G.bbot - 5, G.Lg + 6, S.basement);
      ctx.save();
      ctx.beginPath();
      ctx.rect(G.bx0 + 5, G.Lg + 6, G.bx1 - G.bx0 - 10, G.bbot - G.Lg - 11);
      ctx.clip();
      ctx.beginPath();
      ctx.moveTo(G.bx0, G.bbot);
      for (let x = G.bx0; x <= G.bx1; x += 4) ctx.lineTo(x, top + Math.sin(x * 0.2 + S.t * 4) * 1.2);
      ctx.lineTo(G.bx1, G.bbot);
      ctx.closePath();
      ctx.fillStyle = rgba('#3FA9D2', 0.6);
      ctx.fill();
      ctx.fillStyle = 'rgba(220, 245, 255, 0.7)';
      for (const b of bubbles) {
        ctx.beginPath();
        ctx.arc(b.x + Math.sin(b.t * 7) * 1.5, b.y, 1.2, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
      /* l'eau qui tombe par la trappe */
      if (S.phase === 'wave' && S.basement < 1) {
        ctx.fillStyle = rgba('#5CC6E6', 0.6);
        ctx.fillRect(G.hatch - 8, G.Lg - 2, 16, top - G.Lg + 2);
      }
    }

    function drawGenerator(x, y, a, lampOk, run) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      const w = G.gw, h = G.gh;
      const shake = run ? Math.sin(S.t * 40 + x) * 0.35 : 0;
      ctx.translate(0, shake);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(-w / 2 + 2, h / 2 - 1, w - 2, 2);
      const bg2 = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
      bg2.addColorStop(0, '#E2A548');
      bg2.addColorStop(1, '#9C6A25');
      ctx.fillStyle = bg2;
      draw.roundRect(ctx, -w / 2, -h / 2, w, h, 3);
      ctx.fill();
      ctx.fillStyle = 'rgba(60, 36, 10, 0.55)';
      for (let i = 0; i < 4; i++) ctx.fillRect(-w / 2 + 4 + i * 3, -h / 2 + 5, 1.4, h - 10);
      ctx.fillStyle = '#3A2B1C';
      draw.roundRect(ctx, w / 2 - 12, -h / 2 + 4, 8, 6, 1.5);
      ctx.fill();
      ctx.fillStyle = '#5B4A3A';
      ctx.fillRect(-w / 2 + 3, -h / 2 - 4, 3, 4);
      const col = lampOk ? OK : KO;
      ctx.globalCompositeOperation = 'lighter';
      draw.glow(ctx, w / 2 - 8, -h / 2 + 7, 7, col, 0.7);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(w / 2 - 8, -h / 2 + 7, 1.8, 0, TAU);
      ctx.fill();
      ctx.restore();
      if (run && Math.random() < 0.05 && !RMO) dust.push({ x: x - G.gw / 2 + 4, y: y - G.gh / 2 - 4, vx: rand(-3, 3), vy: -rand(8, 14), t: 0, smoke: true });
    }

    function drawPlant() {
      /* la boucle d'eau bleue qui refroidit le cœur */
      const c = S.cool;
      ctx.save();
      ctx.setLineDash(DASH);
      ctx.lineDashOffset = -S.flow;
      ctx.strokeStyle = lib.mix('#4E6A78', '#6FD3F0', c);
      ctx.lineWidth = 2.6;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      loopPath(ctx);
      ctx.stroke();
      ctx.restore();
      /* eau dans la cuve et dans l'échangeur */
      const water = lib.mix('#1E3E52', '#2E8FC0', c * 0.85);
      ctx.fillStyle = water;
      const vx = G.vx, vr = G.vr - 4;
      ctx.beginPath();
      ctx.arc(vx, G.vt + G.vr, vr, Math.PI, 0);
      ctx.arc(vx, G.vb - G.vr, vr, 0, Math.PI);
      ctx.closePath();
      ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      draw.glow(ctx, vx, G.Lg - 66, 26, '#6FD3F0', 0.25 * c);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#F2C230';
      for (const dx of [-6, 0, 6]) {
        ctx.fillRect(vx + dx - 1.7, G.Lg - 92, 3.4, 48);
      }
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      for (const dx of [-6, 0, 6]) ctx.fillRect(vx + dx - 1.7, G.Lg - 92, 1, 48);
      ctx.fillStyle = water;
      draw.roundRect(ctx, G.hx - 6.5, G.Lg - 108.5, 13, 53, 4.5);
      ctx.fill();
      /* petites vagues dans l'échangeur quand l'eau circule */
      if (c > 0.05) {
        ctx.strokeStyle = rgba('#BFF0FF', 0.5 * c);
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
          const y = G.Lg - 100 + ((S.flow * 0.6 + i * 16) % 48);
          ctx.beginPath();
          ctx.moveTo(G.hx - 4, y);
          ctx.quadraticCurveTo(G.hx, y - 2, G.hx + 4, y);
          ctx.stroke();
        }
      }
      /* le voyant du refroidissement */
      const col = S.lampsOk ? OK : KO;
      const pulse = S.lampsOk ? 1 : 0.6 + 0.4 * Math.sin(S.t * 6);
      ctx.globalCompositeOperation = 'lighter';
      draw.glow(ctx, G.lamp.x, G.lamp.y, 11, col, 0.75 * pulse);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(G.lamp.x, G.lamp.y, 2.6, 0, TAU);
      ctx.fill();
    }

    function drawGenerators() {
      const run = S.lampsOk;
      if (S.secAt < 0) {
        /* au sous-sol, reliés au plafond */
        const xs = [G.bx0 + 26, G.bx0 + 70];
        const y = G.bbot - 5 - G.gh / 2;
        const pmx = G.pumpX;
        ctx.strokeStyle = '#2B2F33';
        ctx.lineWidth = 1.4;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        for (const x of xs) {
          ctx.moveTo(x - 4, y - G.gh / 2);
          ctx.lineTo(x - 4, G.Lg - 2.5);
        }
        ctx.moveTo(xs[0] - 4, G.Lg - 2.5);
        ctx.lineTo(xs[1] - 4, G.Lg - 2.5);
        ctx.moveTo(pmx, G.Lg - 2.5);
        ctx.lineTo(pmx, G.Lg - 29.5);
        ctx.stroke();
        xs.forEach((x) => drawGenerator(x, y, 0, S.lampsOk, run));
        return;
      }
      const e = S.t - S.secAt;
      const f = [clamp((e - 0.3) / 2.0), clamp(e / 2.0)];
      const lead = pathAt(paths[0], ease.inOutCubic(f[0]), tmpLead);
      ctx.strokeStyle = '#2B2F33';
      ctx.lineWidth = 1.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      if (lead.y > G.Lg - G.gh / 2 - 3 && lead.x < G.hatch + 1) {
        /* encore au sous-sol : le câble remonte au plafond */
        ctx.beginPath();
        for (let i = 0; i < 2; i++) {
          const q = pathAt(paths[i], ease.inOutCubic(f[i]), tmp);
          if (q.y - G.gh / 2 <= G.Lg + 6) continue;
          ctx.moveTo(q.x - 4, q.y - G.gh / 2);
          ctx.lineTo(q.x - 4, G.Lg + 6);
        }
        ctx.stroke();
      } else {
        /* le câble suit la route, de la centrale jusqu'au premier groupe */
        ctx.beginPath();
        ctx.moveTo(G.cable[0][0], G.cable[0][1]);
        for (let i = 1; i < G.cable.length; i++) {
          const [x, y] = G.cable[i];
          if (f[0] < 1 && x > lead.x - 6) {
            ctx.lineTo(lead.x - 8, lead.y + G.gh / 2 - 3);
            break;
          }
          ctx.lineTo(x, y);
        }
        if (f[0] >= 1) ctx.lineTo(G.plat0 + 20 - G.gw / 2 + 2, G.Py - 5);
        ctx.stroke();
      }
      /* dans la centrale : du mur jusqu'à la pompe */
      ctx.beginPath();
      ctx.moveTo(G.px1 - 2, G.Lg - 14);
      ctx.lineTo(G.pumpX + 3, G.Lg - 14);
      ctx.lineTo(G.pumpX + 3, G.Lg - 31);
      ctx.stroke();
      for (let i = 1; i >= 0; i--) {
        pathAt(paths[i], ease.inOutCubic(f[i]), tmp);
        drawGenerator(tmp.x, tmp.y, tmp.a, true, run);
      }
    }

    function render() {
      if (!bg) return;
      const { w, h } = cv;
      ctx.drawImage(bg, 0, 0, w, h);
      ctx.save();
      ctx.scale(G.U, G.U);
      drawPlant();
      drawGenerators();
      drawBasementWater();
      drawSea();
      drawWall();
      drawOverflow();
      drawFlood();
      /* gouttes d'écume */
      ctx.fillStyle = 'rgba(235, 250, 255, 0.9)';
      for (const s of spray) {
        ctx.globalAlpha = clamp(1 - s.t / s.life);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, TAU);
        ctx.fill();
      }
      for (const d of dust) {
        ctx.globalAlpha = clamp(1 - d.t / 0.7) * (d.smoke ? 0.35 : 0.8);
        ctx.fillStyle = d.smoke ? '#C8D4D8' : '#B8C2C4';
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.smoke ? 2 + d.t * 4 : 1.1, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    cv.onResize((w, h) => {
      layout(w, h);
      bg = paintBg();
      row.classList.toggle('ts-narrow', w < 380);
      row.classList.toggle('ts-tiny', w < 330);
      if (S.phase === 'prep' && S.digue === 0 && !S.secours && S.t < 0.5) gestureOn(0);
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
