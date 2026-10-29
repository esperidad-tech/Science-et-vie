/* Les trois boîtes (version des petits) : autour des pastilles d'uranium, on construit dans
   l'ordre le tube de métal, la cuve d'acier puis le bâtiment en béton. À chaque boîte, moins de
   rayons sortent, jusqu'à ce que plus rien ne sorte. Ton calme et rassurant. */
(function () {
  'use strict';
  const { lib } = window.RM;
  const { TAU, rand, clamp, lerp, ease, rgba, draw } = lib;

  /* Tous les textes du jeu, faciles à corriger (les mots du chapitre).
     Les boutons ont deux lignes : le nom de la boîte, puis sa matière. */
  const TEXTES = {
    jauge: 'Rayons qui sortent',
    boutons: [['Le tube', 'de métal'], ['La cuve', 'd’acier'], ['Le bâtiment', 'en béton']],
    barrieres: [
      'Le tube de métal enferme l’uranium.',
      'L’énorme cuve d’acier enferme le tube.',
      'Le bâtiment en béton, très épais, enferme tout !',
    ],
    ordre: 'Commence par la plus petite : le tube de métal.',
    ordreSuite: 'D’abord la cuve d’acier, plus petite que le bâtiment.',
    fin: 'Trois boîtes, l’une dans l’autre : rien ne sort !',
    finStatut: 'Et on surveille tout, jour et nuit.',
  };

  /* Part de la radioactivité arrêtée par chaque barrière (pour les particules) et niveau de la jauge */
  const ARRET = [0.7, 0.67, 1];
  const JAUGE = [1, 0.3, 0.1, 0];
  const DUREES = [1.3, 1.7, 2.4];
  /* si l'enfant hésite aussi longtemps (s), le doigt fantôme montre le bouton suivant */
  const HESITE = 3;

  const ICONES = [
    '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8.5" y="2.5" width="7" height="19" rx="3.5"/><path d="M10.5 8h3M10.5 12h3M10.5 16h3"/></svg>',
    '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="2.5" width="14" height="19" rx="6.5" stroke-width="2.6"/><path d="M3.5 9h17"/></svg>',
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 21v-9a8.5 8.5 0 0 1 17 0v9"/><path d="M1.5 21h21"/></svg>',
  ];
  const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  const CSS = `
.game[data-game="barrieres"] .ba-ui {
  position: absolute; left: 0; right: 0; bottom: 10px; z-index: 4;
  display: grid; grid-template-columns: minmax(0, 1fr); gap: 9px; padding: 0 10px; pointer-events: none;
}
.game[data-game="barrieres"] .ba-gauge {
  display: flex; align-items: center; gap: 10px; padding: 0 4px;
  font: 600 0.8125rem/1.2 var(--font-text); color: var(--fg);
}
.game[data-game="barrieres"] .ba-glabel { flex: none; opacity: 0.88; }
.game[data-game="barrieres"] .ba-gbar {
  position: relative; flex: 1; height: 10px; border-radius: 6px 4px 5px 6px; overflow: hidden;
  background: rgba(255, 255, 255, 0.08); box-shadow: inset 0 0 0 1px rgba(238, 235, 232, 0.16);
}
.game[data-game="barrieres"] .ba-gbar i {
  position: absolute; left: 0; top: 0; bottom: 0; width: calc(var(--g, 1) * 100%);
  background: var(--gc, #E8A04F); border-radius: inherit;
}
.game[data-game="barrieres"] .ba-chips { display: flex; justify-content: center; gap: 8px; pointer-events: auto; }
.game[data-game="barrieres"] .ba-chip {
  flex: 1 1 0; min-width: 0; max-width: 160px; padding: 7px 6px 8px; gap: 3px; white-space: nowrap;
  flex-direction: column; line-height: 1.12;
  transition: background 0.3s, color 0.3s, box-shadow 0.3s;
}
.game[data-game="barrieres"] .ba-ic { display: inline-flex; flex: none; }
.game[data-game="barrieres"] .ba-lab { display: flex; flex-direction: column; align-items: center; }
.game[data-game="barrieres"] .ba-l2 { font-weight: 600; font-size: 0.875em; opacity: 0.8; }
.game[data-game="barrieres"] .ba-chip svg {
  width: 20px; height: 20px; flex: none; fill: none; stroke: currentColor;
  stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round;
}
.game[data-game="barrieres"] .ba-chip.is-built, .game[data-game="barrieres"] .ba-chip.is-built[disabled] {
  opacity: 1; background: var(--accent); color: var(--btn-fg); cursor: default;
}
.game[data-game="barrieres"] .ba-chip.is-hint { animation: ba-blink 1.1s ease-in-out infinite; }
.game[data-game="barrieres"] .ba-chip.is-wrong { animation: ba-shake 0.42s ease-in-out 1; }
@keyframes ba-blink {
  0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(232, 160, 79, 0), 0 6px 16px -8px rgba(0, 0, 0, 0.6); }
  50% { transform: scale(1.06); box-shadow: 0 0 0 6px rgba(232, 160, 79, 0.55), 0 6px 16px -8px rgba(0, 0, 0, 0.6); }
}
@keyframes ba-shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 50% { transform: translateX(4px); } 75% { transform: translateX(-2px); } }
.game[data-game="barrieres"] .ba-narrow .ba-chip { font-size: 0.875rem; padding: 6px 4px 7px; gap: 2px; }
.game[data-game="barrieres"] .ba-narrow .ba-chip svg { width: 18px; height: 18px; }
.game[data-game="barrieres"] .ba-narrow .ba-gauge { font-size: 0.75rem; gap: 8px; }
.game[data-game="barrieres"] .ba-tiny .ba-ic { display: none; }
.game[data-game="barrieres"] .ba-tiny .ba-chip { font-size: 0.8125rem; padding: 7px 3px; }
`;

  function seeded(seed) {
    let s = seed >>> 0 || 1;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }

  /* Points lumineux pré-rendus (jaune doux et vert pâle) */
  let SPR = null;
  function sprites() {
    if (SPR) return SPR;
    SPR = ['#F6DE7C', '#CDEB8E'].map((col) => {
      const N = 32;
      const c = document.createElement('canvas');
      c.width = c.height = N;
      const g = c.getContext('2d');
      const gr = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
      gr.addColorStop(0, 'rgba(255, 255, 250, 1)');
      gr.addColorStop(0.18, rgba(col, 0.95));
      gr.addColorStop(0.45, rgba(col, 0.3));
      gr.addColorStop(1, rgba(col, 0));
      g.fillStyle = gr;
      g.fillRect(0, 0, N, N);
      return c;
    });
    return SPR;
  }

  window.RM.games.barrieres = function (api) {
    const cv = api.canvas();
    const ctx = cv.ctx;
    const RMO = api.reducedMotion;
    api.style(CSS);

    /* ---- interface : jauge et boutons ---- */
    const ui = document.createElement('div');
    ui.className = 'ba-ui';
    const gauge = document.createElement('div');
    gauge.className = 'ba-gauge';
    gauge.innerHTML = '<span class="ba-glabel"></span><span class="ba-gbar" role="meter" aria-valuemin="0" aria-valuemax="100"><i></i></span>';
    gauge.firstChild.textContent = TEXTES.jauge;
    const gbar = gauge.querySelector('.ba-gbar');
    gbar.setAttribute('aria-label', TEXTES.jauge);
    const chipsRow = document.createElement('div');
    chipsRow.className = 'ba-chips';
    const chips = TEXTES.boutons.map((label, k) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip ba-chip';
      b.innerHTML = '<span class="ba-ic"></span><span class="ba-lab"><span></span><span class="ba-l2"></span></span>';
      const lab = b.querySelector('.ba-lab');
      lab.firstChild.textContent = label[0];
      lab.lastChild.textContent = label[1];
      b.setAttribute('aria-label', label.join(' '));
      b.addEventListener('click', () => choose(k));
      chipsRow.appendChild(b);
      return b;
    });
    ui.append(gauge, chipsRow);
    api.stage.appendChild(ui);

    /* la scène ne doit jamais défiler (focus clavier d'un bouton, par exemple) */
    api.stage.addEventListener('scroll', () => {
      if (api.stage.scrollLeft || api.stage.scrollTop) {
        api.stage.scrollLeft = 0;
        api.stage.scrollTop = 0;
      }
    });

    /* ---- géométrie (unités virtuelles, au moins 360 × 450) ---- */
    const G = { U: 1, VW: 360, VH: 450 };
    let bg = null, pellets = null;
    const layers = [null, null, null];

    function layout(w, h) {
      const U = Math.min(w / 360, h / 450);
      const VW = w / U, VH = h / U;
      const A = VH - 104 / U;
      const Gy = A > 330 ? A - (A - 330) * 0.45 : A;
      const cx = VW / 2, cy = Gy - 128;
      Object.assign(G, { U, VW, VH, Gy, cx, cy });
      G.pel = { n: 6, w: 26, h: 13, top: cy - 39 };
      G.gaine = { r: 18, top: cy - 55, bot: cy + 55, wall: 3.4 };
      G.cuve = { R: 64, top: cy - 100, bot: cy + 94, wall: 11, hTop: 40, hBot: 44 };
      G.enc = { hw: Math.min(150, VW / 2 - 18), wallTop: Gy - 166, ry: 112, wall: 15 };
    }

    /* ---- tests « dedans » pour arrêter les particules ---- */
    function insideGaine(x, y) {
      const g = G.gaine, r = g.r - g.wall;
      const yy = clamp(y, g.top + g.r, g.bot - g.r);
      return (x - G.cx) * (x - G.cx) + (y - yy) * (y - yy) < r * r;
    }
    function insideCuve(x, y) {
      const C = G.cuve, ri = C.R - C.wall;
      const fy = C.top + C.hTop, by = C.bot - C.hBot;
      const dx = (x - G.cx) / ri;
      if (y >= fy && y <= by) return Math.abs(dx) < 1;
      if (y < fy) {
        const dy = (y - fy) / (C.hTop - C.wall * 0.8);
        return dx * dx + dy * dy < 1;
      }
      const dy = (y - by) / (C.hBot - C.wall * 0.8);
      return dx * dx + dy * dy < 1;
    }
    function insideEnc(x, y) {
      const E = G.enc, ri = E.hw - E.wall;
      const dx = (x - G.cx) / ri;
      if (y >= E.wallTop) return Math.abs(dx) < 1;
      const dy = (y - E.wallTop) / (E.ry - E.wall);
      return dx * dx + dy * dy < 1;
    }
    const INSIDE = [insideGaine, insideCuve, insideEnc];

    /* ---- chemins ---- */
    function capsuleV(g, x, y0, y1, r) {
      g.beginPath();
      g.arc(x, y0 + r, r, Math.PI, 0);
      g.arc(x, y1 - r, r, 0, Math.PI);
      g.closePath();
    }
    function cuvePath(g, inset) {
      const C = G.cuve, R = C.R - inset;
      const fy = C.top + C.hTop, by = C.bot - C.hBot;
      g.beginPath();
      g.ellipse(G.cx, fy, R, C.hTop - inset * 0.8, 0, Math.PI, TAU);
      g.lineTo(G.cx + R, by);
      g.ellipse(G.cx, by, R, C.hBot - inset * 0.8, 0, 0, Math.PI);
      g.closePath();
    }
    function encPath(g, inset) {
      const E = G.enc, R = E.hw - inset;
      g.beginPath();
      g.moveTo(G.cx - R, G.Gy);
      g.lineTo(G.cx - R, E.wallTop);
      g.ellipse(G.cx, E.wallTop, R, E.ry - inset, 0, Math.PI, TAU);
      g.lineTo(G.cx + R, G.Gy);
      g.closePath();
    }
    function mk() {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(cv.w * cv.dpr));
      c.height = Math.max(1, Math.round(cv.h * cv.dpr));
      const g = c.getContext('2d');
      g.scale(cv.dpr * G.U, cv.dpr * G.U);
      return { c, g };
    }
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

    /* ---- fond : pénombre calme, sol en strates, emplacements des barrières en pointillés ---- */
    function paintBg() {
      const { c, g } = mk();
      const { VW, VH, Gy, cx, cy } = G;
      const sky = g.createLinearGradient(0, 0, 0, Gy);
      sky.addColorStop(0, '#0E0D0F');
      sky.addColorStop(1, '#1B1A1D');
      g.fillStyle = sky;
      g.fillRect(0, 0, VW, Gy + 1);
      draw.glow(g, cx, cy, 230, '#3B3A44', 0.5);
      draw.glow(g, cx, cy, 120, '#5A5536', 0.18);
      /* sol : dalle puis strates de roche */
      const strata = [['#3A3633', 0, 6], ['#2E2B2A', 6, 14], ['#262423', 20, 18], ['#211F1F', 38, 24], ['#1B1A1A', 62, 400]];
      for (const [col, y0, hh] of strata) {
        g.fillStyle = col;
        g.beginPath();
        g.moveTo(0, Gy + y0);
        const nz = lib.makeNoise(y0 + 5);
        for (let x = 0; x <= VW + 6; x += 6) g.lineTo(x, Gy + y0 + (y0 ? (nz.noise2(x / 40, y0) - 0.5) * 5 : 0));
        g.lineTo(VW + 6, Gy + y0 + hh + 6);
        g.lineTo(0, Gy + y0 + hh + 6);
        g.closePath();
        g.fill();
      }
      grainIn(g, 0, Gy, VW, VH - Gy, 0.4, 21);
      g.fillStyle = 'rgba(238, 235, 232, 0.16)';
      g.fillRect(0, Gy, VW, 0.8);
      const fade = g.createLinearGradient(0, Gy + 10, 0, VH);
      fade.addColorStop(0, 'rgba(10, 9, 10, 0)');
      fade.addColorStop(1, 'rgba(10, 9, 10, 0.75)');
      g.fillStyle = fade;
      g.fillRect(0, Gy, VW, VH - Gy);
      /* emplacements des trois barrières, à peine visibles */
      g.save();
      g.setLineDash([3, 5]);
      g.lineWidth = 1.2;
      g.strokeStyle = 'rgba(238, 235, 232, 0.13)';
      capsuleV(g, cx, G.gaine.top, G.gaine.bot, G.gaine.r);
      g.stroke();
      cuvePath(g, 0);
      g.stroke();
      encPath(g, 0);
      g.stroke();
      g.restore();
      return c;
    }

    /* ---- pastilles de combustible empilées ---- */
    function paintPellets() {
      const { c, g } = mk();
      const P = G.pel;
      for (let i = P.n - 1; i >= 0; i--) {
        const y = P.top + i * P.h;
        const x0 = G.cx - P.w / 2;
        const body = g.createLinearGradient(x0, 0, x0 + P.w, 0);
        body.addColorStop(0, '#7F8F38');
        body.addColorStop(0.35, '#D9E58A');
        body.addColorStop(0.7, '#B4C55A');
        body.addColorStop(1, '#6E7D2E');
        g.fillStyle = body;
        g.beginPath();
        g.moveTo(x0, y + 2);
        g.lineTo(x0, y + P.h - 1.2);
        g.ellipse(G.cx, y + P.h - 1.2, P.w / 2, 3.2, 0, Math.PI, 0, true);
        g.lineTo(x0 + P.w, y + 2);
        g.closePath();
        g.fill();
        g.fillStyle = '#EEF5B4';
        g.beginPath();
        g.ellipse(G.cx, y + 2, P.w / 2, 3.2, 0, 0, TAU);
        g.fill();
        g.fillStyle = 'rgba(150, 165, 70, 0.55)';
        g.beginPath();
        g.ellipse(G.cx, y + 2, P.w / 2 - 4, 1.6, 0, 0, TAU);
        g.fill();
      }
      return c;
    }

    /* ---- les barrières, pré-rendues entières (on les dévoile ou les déplace pendant leur construction) ---- */
    function paintGaine() {
      const { c, g } = mk();
      const B = G.gaine;
      capsuleV(g, G.cx, B.top, B.bot, B.r);
      g.fillStyle = 'rgba(215, 226, 238, 0.08)';
      g.fill();
      const mg = g.createLinearGradient(G.cx - B.r, 0, G.cx + B.r, 0);
      mg.addColorStop(0, '#7C8794');
      mg.addColorStop(0.12, '#F2F6FA');
      mg.addColorStop(0.3, '#A6B0BC');
      mg.addColorStop(0.75, '#C9D1DA');
      mg.addColorStop(0.9, '#F6F9FC');
      mg.addColorStop(1, '#6C7682');
      g.strokeStyle = mg;
      g.lineWidth = B.wall;
      capsuleV(g, G.cx, B.top + B.wall / 2, B.bot - B.wall / 2, B.r - B.wall / 2);
      g.stroke();
      g.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      g.lineWidth = 0.8;
      g.beginPath();
      g.moveTo(G.cx - B.r + 2.2, B.top + B.r);
      g.lineTo(G.cx - B.r + 2.2, B.bot - B.r);
      g.stroke();
      return c;
    }

    function paintCuve() {
      const { c, g } = mk();
      const C = G.cuve;
      const fy = C.top + C.hTop;
      /* pieds de la cuve, jusqu'au sol */
      g.fillStyle = '#34363C';
      for (const s of [-1, 1]) {
        draw.roundRect(g, G.cx + s * (C.R - 22) - 9, C.bot - 22, 18, G.Gy - (C.bot - 22), 3);
        g.fill();
      }
      /* paroi épaisse en coupe : anneau plein (règle pair-impair) */
      cuvePath(g, 0);
      const inner = new Path2D();
      const R = C.R - C.wall, by = C.bot - C.hBot;
      inner.ellipse(G.cx, fy, R, C.hTop - C.wall * 0.8, 0, Math.PI, TAU);
      inner.lineTo(G.cx + R, by);
      inner.ellipse(G.cx, by, R, C.hBot - C.wall * 0.8, 0, 0, Math.PI);
      inner.closePath();
      const outer = new Path2D();
      outer.ellipse(G.cx, fy, C.R, C.hTop, 0, Math.PI, TAU);
      outer.lineTo(G.cx + C.R, by);
      outer.ellipse(G.cx, by, C.R, C.hBot, 0, 0, Math.PI);
      outer.closePath();
      g.fillStyle = 'rgba(40, 46, 56, 0.35)';
      g.fill(inner);
      const ring = new Path2D();
      ring.addPath(outer);
      ring.addPath(inner);
      const sg = g.createLinearGradient(G.cx - C.R, 0, G.cx + C.R, 0);
      sg.addColorStop(0, '#454D58');
      sg.addColorStop(0.07, '#B9C2CC');
      sg.addColorStop(0.16, '#6A7480');
      sg.addColorStop(0.84, '#5C6672');
      sg.addColorStop(0.93, '#A9B3BE');
      sg.addColorStop(1, '#3E4650');
      g.fillStyle = sg;
      g.fill(ring, 'evenodd');
      g.save();
      g.clip(ring, 'evenodd');
      grainIn(g, G.cx - C.R, C.top, C.R * 2, C.bot - C.top, 0.25, 31);
      g.restore();
      /* bride du couvercle avec ses boulons */
      for (const s of [-1, 1]) {
        const x = G.cx + s * (C.R - C.wall / 2);
        g.fillStyle = '#7D8794';
        draw.roundRect(g, x - 10, fy - 4, 20, 8, 2);
        g.fill();
        g.fillStyle = '#D5DCE4';
        for (const dx of [-5, 0, 5]) {
          g.beginPath();
          g.arc(x + dx, fy, 1.4, 0, TAU);
          g.fill();
        }
      }
      return c;
    }

    function paintEnc() {
      const { c, g } = mk();
      const E = G.enc;
      const outer = new Path2D();
      outer.moveTo(G.cx - E.hw, G.Gy);
      outer.lineTo(G.cx - E.hw, E.wallTop);
      outer.ellipse(G.cx, E.wallTop, E.hw, E.ry, 0, Math.PI, TAU);
      outer.lineTo(G.cx + E.hw, G.Gy);
      outer.closePath();
      const ri = E.hw - E.wall;
      const inner = new Path2D();
      inner.moveTo(G.cx - ri, G.Gy);
      inner.lineTo(G.cx - ri, E.wallTop);
      inner.ellipse(G.cx, E.wallTop, ri, E.ry - E.wall, 0, Math.PI, TAU);
      inner.lineTo(G.cx + ri, G.Gy);
      inner.closePath();
      const ring = new Path2D();
      ring.addPath(outer);
      ring.addPath(inner);
      const cg = g.createLinearGradient(G.cx - E.hw, 0, G.cx + E.hw, 0);
      cg.addColorStop(0, '#8E877F');
      cg.addColorStop(0.08, '#B4ADA4');
      cg.addColorStop(0.5, '#9A938A');
      cg.addColorStop(0.92, '#7A746C');
      cg.addColorStop(1, '#5E5953');
      g.fillStyle = cg;
      g.fill(ring, 'evenodd');
      g.save();
      g.clip(ring, 'evenodd');
      grainIn(g, G.cx - E.hw, E.wallTop - E.ry, E.hw * 2, G.Gy - E.wallTop + E.ry, 0.5, 41);
      /* traces des coffrages */
      g.strokeStyle = 'rgba(40, 36, 32, 0.25)';
      g.lineWidth = 0.7;
      for (let y = G.Gy - 14; y > E.wallTop - E.ry; y -= 14) {
        g.beginPath();
        g.moveTo(G.cx - E.hw, y);
        g.lineTo(G.cx + E.hw, y);
        g.stroke();
      }
      const shade = g.createLinearGradient(0, E.wallTop - E.ry, 0, G.Gy);
      shade.addColorStop(0, 'rgba(255, 245, 230, 0.12)');
      shade.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
      g.fillStyle = shade;
      g.fillRect(G.cx - E.hw, E.wallTop - E.ry, E.hw * 2, G.Gy - E.wallTop + E.ry);
      g.restore();
      return c;
    }

    /* ---- état ---- */
    const MAXP = 340;
    const parts = Array.from({ length: MAXP }, () => ({ alive: false }));
    let pIdx = 0;
    const S = {};
    let waves = [];
    let dust = [];

    function chooseFate() {
      for (let k = 0; k < 3; k++) {
        if (S.eff[k] && (ARRET[k] >= 1 || Math.random() < ARRET[k])) return k;
      }
      return -1;
    }

    function spawn() {
      for (let k = 0; k < MAXP; k++) {
        const p = parts[(pIdx + k) % MAXP];
        if (p.alive) continue;
        pIdx = (pIdx + k + 1) % MAXP;
        const a = rand(TAU);
        const sp = rand(34, 62) * (RMO ? 0.6 : 1);
        p.alive = true;
        p.x = G.cx + Math.cos(a) * rand(4, 11);
        p.y = G.cy + rand(-36, 36);
        p.vx = Math.cos(a) * sp;
        p.vy = Math.sin(a) * sp;
        p.fate = chooseFate();
        p.stop = -1;
        p.t = 0;
        p.s = rand(0.9, 2);
        p.c = Math.random() < 0.65 ? 0 : 1;
        return p;
      }
      return null;
    }

    function stepParticles(dt) {
      S.acc += dt * 36;
      while (S.acc > 1) {
        S.acc -= 1;
        spawn();
      }
      const { VW, Gy } = G;
      for (let i = 0; i < MAXP; i++) {
        const p = parts[i];
        if (!p.alive) continue;
        p.t += dt;
        if (p.stop >= 0) {
          p.stop += dt;
          if (p.stop > 0.7) p.alive = false;
          continue;
        }
        const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;
        if (p.fate >= 0 && !INSIDE[p.fate](nx, ny)) {
          p.stop = 0;
          continue;
        }
        p.x = nx;
        p.y = ny;
        if (ny > Gy - 1) {
          p.stop = 0.3;
          continue;
        }
        if (nx < -10 || nx > VW + 10 || ny < -10) p.alive = false;
      }
    }

    function makeEffective(k) {
      if (S.eff[k]) return;
      S.eff[k] = true;
      for (const p of parts) {
        if (!p.alive || p.stop >= 0) continue;
        if ((p.fate === -1 || p.fate > k) && INSIDE[k](p.x, p.y) && (ARRET[k] >= 1 || Math.random() < ARRET[k])) p.fate = k;
      }
    }

    function next() {
      return S.built.indexOf(false);
    }

    function setChips() {
      chips.forEach((b, k) => {
        const done = S.built[k];
        b.classList.toggle('is-built', done);
        b.disabled = done;
        b.firstChild.innerHTML = done ? CHECK : ICONES[k];
      });
    }

    function gestureOn(k) {
      const b = chips[k];
      if (!b || !cv.w) return;
      /* le doigt vise l'icône (le nom reste lisible), ou le bouton entier si l'icône est cachée */
      const ic = b.querySelector('.ba-ic');
      const r = (ic && ic.offsetWidth ? ic : b).getBoundingClientRect();
      const s = api.stage.getBoundingClientRect();
      if (!s.width) return;
      api.gesture('tap', {
        x: clamp(((r.left + r.width / 2 - s.left) / s.width) * 100, 5, 95),
        y: clamp(((r.top + r.height / 2 - s.top) / s.height) * 100, 5, 95),
      });
    }

    function choose(k) {
      S.lastAct = S.t;
      const n = next();
      if (n < 0 || S.built[k]) return;
      if (k !== n) {
        api.status(n === 0 ? TEXTES.ordre : TEXTES.ordreSuite);
        chips[k].classList.remove('is-wrong');
        void chips[k].offsetWidth;
        chips[k].classList.add('is-wrong');
        chips[n].classList.add('is-hint');
        gestureOn(n);
        api.sfx.play('tick', { pitch: 0.6, volume: 0.7, gap: 0 });
        api.buzz(12);
        return;
      }
      chips.forEach((b) => b.classList.remove('is-hint', 'is-wrong'));
      S.hinted = false;
      S.built[k] = true;
      S.at[k] = S.t;
      S.nextSound[k] = 0;
      setChips();
      api.status(TEXTES.barrieres[k]);
      api.progress((k + 1) / 3);
      api.buzz(10);
      if (k === 0) api.sfx.play('whoosh', { pitch: 1.4, volume: 0.6, gap: 0 });
      if (k === 1) api.sfx.play('scrape', { gap: 0 });
      if (k === 2) api.sfx.play('rumble', { volume: 0.4, gap: 0 });
    }

    function init() {
      S.t = 0;
      S.acc = 0;
      S.built = [false, false, false];
      S.eff = [false, false, false];
      S.at = [-1, -1, -1];
      S.nextSound = [0, 0, 0];
      S.gauge = 1;
      S.shown = -1;
      S.finished = false;
      S.flash = 0;
      S.lastAct = 0;
      S.hinted = true;
      waves = [];
      dust = [];
      for (const p of parts) p.alive = false;
      /* on laisse la radioactivité se répandre un peu pour que la première image soit vivante */
      for (let i = 0; i < 90; i++) stepParticles(0.05);
      chips.forEach((b) => b.classList.remove('is-hint', 'is-wrong'));
      setChips();
      paintGauge();
      gestureOn(0);
    }

    function paintGauge() {
      const v = S.gauge;
      if (Math.abs(v - S.shown) < 0.002) return;
      S.shown = v;
      gbar.style.setProperty('--g', v.toFixed(4));
      gbar.style.setProperty('--gc', lib.ramp([[0, '#8FB8DE'], [0.12, '#B7B4A6'], [0.32, '#E8A04F'], [1, '#E8A04F']], v));
      gbar.setAttribute('aria-valuenow', String(Math.round(v * 100)));
    }

    api.track(cv.canvas, {
      up(p, e, cancelled) {
        if (cancelled || !p.tap) return;
        waves.push({ x: p.x / G.U, y: p.y / G.U, t: 0 });
        const d = Math.hypot(p.x / G.U - G.cx, p.y / G.U - G.cy);
        if (d < 50) S.flash = 1;
        api.sfx.play('pop', { pitch: rand(0.8, 1.1), volume: 0.5 });
      },
    }, { touchAction: 'pan-y' });

    /* ---- animation ---- */
    function prog(k) {
      return S.at[k] < 0 ? 0 : clamp((S.t - S.at[k]) / DUREES[k]);
    }

    function update(dt) {
      S.t += dt;
      S.flash = Math.max(0, S.flash - dt * 1.5);
      for (let k = 0; k < 3; k++) {
        const pr = prog(k);
        if (S.at[k] >= 0 && pr >= 0.88) makeEffective(k);
        /* petits bruits de chantier */
        if (S.at[k] >= 0 && pr < 1) {
          const e = S.t - S.at[k];
          if (k === 0 && S.nextSound[0] === 0 && e > 0.75) {
            S.nextSound[0] = 1;
            api.sfx.play('tick', { pitch: 1.6, gap: 0 });
            api.sfx.play('chime', { pitch: 1.3, volume: 0.6, gap: 0 });
          }
          if (k === 1 && S.nextSound[1] === 0 && e > 0.9) { S.nextSound[1] = 1; api.sfx.play('thud', { gap: 0 }); }
          if (k === 1 && S.nextSound[1] === 1 && e > 1.4) {
            S.nextSound[1] = 2;
            api.sfx.play('thud', { pitch: 1.2, gap: 0 });
            api.sfx.play('tick', { pitch: 1.3, gap: 0 });
          }
          if (k === 2 && e < 1.6 && e > S.nextSound[2]) {
            S.nextSound[2] = e + 0.22;
            api.sfx.play('thud', { pitch: 0.8 + e * 0.2, volume: 0.6, gap: 0 });
          }
        }
      }
      /* la jauge suit le nombre de barrières en place */
      const nEff = (S.eff[0] ? 1 : 0) + (S.eff[1] ? 1 : 0) + (S.eff[2] ? 1 : 0);
      const target = JAUGE[nEff];
      S.gauge += (target - S.gauge) * Math.min(1, dt * 2.6);
      if (Math.abs(S.gauge - target) < 0.003) S.gauge = target;
      paintGauge();
      if (!S.finished && S.at[2] >= 0 && prog(2) >= 1) {
        S.finished = true;
        api.done(TEXTES.fin, TEXTES.finStatut);
      }
      stepParticles(dt);
      /* si l'enfant hésite, le doigt fantôme montre le bouton suivant */
      const n = next();
      if (n > 0 && !S.hinted && S.t - S.lastAct > HESITE) {
        S.hinted = true;
        gestureOn(n);
      }
      /* poussière de béton pendant la construction de l'enceinte */
      if (S.at[2] >= 0 && prog(2) < 0.95 && dust.length < 40 && Math.random() < dt * 30) {
        const f = buildFront();
        if (f) dust.push({ x: f.x + rand(-6, 6), y: f.y, vx: rand(-8, 8), vy: rand(-12, -4), t: 0 });
      }
      for (let i = dust.length - 1; i >= 0; i--) {
        const d = dust[i];
        d.t += dt;
        d.vy += 30 * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        if (d.t > 0.9) dust.splice(i, 1);
      }
      waves = waves.filter((w) => (w.t += dt) < 0.6);
    }

    /* point où le béton est en train de couler (pour la poussière) */
    function buildFront() {
      const k = prog(2);
      const E = G.enc;
      const side = Math.random() < 0.5 ? -1 : 1;
      const wallH = G.Gy - E.wallTop;
      const kW = clamp(k / 0.55);
      if (kW < 1) return { x: G.cx + side * (E.hw - E.wall / 2), y: G.Gy - wallH * ease.inOutSine(kW) };
      const kD = clamp((k - 0.55) / 0.42);
      const a = Math.PI + kD * Math.PI / 2;
      return { x: G.cx + side * Math.abs(Math.cos(a)) * (E.hw - E.wall / 2), y: E.wallTop + Math.sin(a) * (E.ry - E.wall / 2) };
    }

    function blit(img, dx, dy) {
      ctx.drawImage(img, dx * G.U, dy * G.U, cv.w, cv.h);
    }

    function render() {
      if (!bg) return;
      const { w, h } = cv;
      ctx.drawImage(bg, 0, 0, w, h);
      const E = G.enc;

      /* l'enceinte : les murs montent depuis le sol, puis le dôme se referme */
      const kE = prog(2);
      if (S.at[2] >= 0) {
        if (kE >= 1) blit(layers[2], 0, 0);
        else {
          ctx.save();
          ctx.scale(G.U, G.U);
          const wallH = G.Gy - E.wallTop;
          const kW = clamp(kE / 0.55);
          const yW = G.Gy - wallH * ease.inOutSine(kW);
          ctx.beginPath();
          ctx.rect(0, yW, G.VW, G.Gy - yW + 2);
          const kD = clamp((kE - 0.55) / 0.42);
          if (kD > 0) {
            const R = E.hw * 2;
            ctx.moveTo(G.cx, E.wallTop + 0.5);
            ctx.arc(G.cx, E.wallTop + 0.5, R, Math.PI - 0.02, Math.PI + kD * Math.PI / 2);
            ctx.closePath();
            ctx.moveTo(G.cx, E.wallTop + 0.5);
            ctx.arc(G.cx, E.wallTop + 0.5, R, TAU - kD * Math.PI / 2, TAU + 0.02);
            ctx.closePath();
          }
          ctx.clip();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.drawImage(layers[2], 0, 0);
          ctx.restore();
          /* bord de béton frais */
          ctx.save();
          ctx.scale(G.U, G.U);
          ctx.globalCompositeOperation = 'lighter';
          if (kW < 1) {
            for (const s of [-1, 1]) draw.glow(ctx, G.cx + s * (E.hw - E.wall / 2), yW, 14, '#FFE1B0', 0.35);
          } else if (kD < 1) {
            const a = Math.PI + kD * Math.PI / 2;
            for (const s of [-1, 1]) {
              draw.glow(ctx, G.cx + s * Math.abs(Math.cos(a)) * (E.hw - E.wall / 2), E.wallTop + Math.sin(a) * (E.ry - E.wall / 2), 14, '#FFE1B0', 0.35);
            }
          }
          ctx.restore();
        }
      }

      /* la cuve : le corps monte du bas, puis le couvercle descend et se pose */
      const kC = prog(1);
      if (S.at[1] >= 0) {
        if (kC >= 1) blit(layers[1], 0, 0);
        else {
          const C = G.cuve;
          const fy = C.top + C.hTop;
          const rise = (1 - ease.outCubic(clamp(kC / 0.5))) * 150;
          const lid = (1 - ease.outBack(clamp((kC - 0.45) / 0.45))) * -130;
          ctx.save();
          ctx.globalAlpha = clamp(kC * 4);
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, (fy - 1 + rise) * G.U, w, h);
          ctx.clip();
          blit(layers[1], 0, rise);
          ctx.restore();
          if (kC > 0.45) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, w, (fy + lid + 4.5) * G.U);
            ctx.clip();
            blit(layers[1], 0, lid);
            ctx.restore();
          }
          ctx.restore();
        }
      }

      /* lueur douce du combustible */
      ctx.save();
      ctx.scale(G.U, G.U);
      const breath = 0.85 + 0.15 * Math.sin(S.t * (RMO ? 0.8 : 2.1));
      ctx.globalCompositeOperation = 'lighter';
      draw.glow(ctx, G.cx, G.cy, 70, '#C9E26A', (0.22 + 0.15 * S.flash) * breath);
      draw.glow(ctx, G.cx, G.cy, 34, '#F2F7B0', (0.18 + 0.2 * S.flash) * breath);
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
      ctx.drawImage(pellets, 0, 0, w, h);

      /* la gaine : le tube descend sur les pastilles et se referme */
      const kG = prog(0);
      if (S.at[0] >= 0) {
        if (kG >= 1) blit(layers[0], 0, 0);
        else {
          const drop = (1 - ease.outCubic(clamp(kG / 0.62))) * -(G.gaine.bot + 20);
          ctx.save();
          ctx.globalAlpha = clamp(kG * 3);
          blit(layers[0], 0, drop);
          ctx.restore();
        }
        /* reflet qui glisse sur le métal */
        const sh = ((S.t - S.at[0]) * (RMO ? 0.15 : 0.35)) % 1.6;
        if (kG > 0.6 && sh < 1) {
          ctx.save();
          ctx.scale(G.U, G.U);
          capsuleV(ctx, G.cx, G.gaine.top, G.gaine.bot, G.gaine.r);
          ctx.clip();
          const y = lerp(G.gaine.top - 20, G.gaine.bot + 20, sh);
          const lg = ctx.createLinearGradient(0, y - 14, 0, y + 14);
          lg.addColorStop(0, 'rgba(255, 255, 255, 0)');
          lg.addColorStop(0.5, 'rgba(255, 255, 255, 0.28)');
          lg.addColorStop(1, 'rgba(255, 255, 255, 0)');
          ctx.fillStyle = lg;
          ctx.fillRect(G.cx - G.gaine.r, y - 14, G.gaine.r * 2, 28);
          ctx.restore();
        }
      }

      /* particules de radioactivité */
      ctx.save();
      ctx.scale(G.U, G.U);
      ctx.globalCompositeOperation = 'lighter';
      const spr = sprites();
      for (let i = 0; i < MAXP; i++) {
        const p = parts[i];
        if (!p.alive) continue;
        let a = Math.min(1, p.t * 4);
        let s = p.s * 3.2;
        if (p.stop >= 0) {
          const k = p.stop / 0.7;
          a *= 1 - k;
          s *= 1 + 0.7 * Math.sin(Math.PI * Math.min(1, k * 2));
        } else {
          const edge = Math.min(p.x, G.VW - p.x, p.y);
          a *= clamp(edge / 40);
        }
        if (a < 0.02) continue;
        ctx.globalAlpha = a * 0.9;
        ctx.drawImage(spr[p.c], p.x - s, p.y - s, s * 2, s * 2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(200, 190, 175, 0.7)';
      for (const d of dust) {
        ctx.globalAlpha = 1 - d.t / 0.9;
        ctx.fillRect(d.x - 0.8, d.y - 0.8, 1.6, 1.6);
      }
      ctx.globalAlpha = 1;
      for (const wv of waves) {
        const k = wv.t / 0.6;
        ctx.strokeStyle = rgba('#EEEBE8', 0.6 * (1 - k));
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(wv.x, wv.y, lerp(4, 26, ease.outCubic(k)), 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
    }

    cv.onResize((w, h) => {
      ui.classList.toggle('ba-narrow', w < 380);
      ui.classList.toggle('ba-tiny', w < 330);
      layout(w, h);
      bg = paintBg();
      pellets = paintPellets();
      layers[0] = paintGaine();
      layers[1] = paintCuve();
      layers[2] = paintEnc();
      if (S.built && next() >= 0 && !S.t) gestureOn(next());
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
