/* La réaction en chaîne : un neutron casse un noyau d'uranium, qui libère deux ou trois autres
   neutrons. Les barres de contrôle avalent les neutrons : en les enfonçant ou en les remontant,
   on garde la réaction stable, ni éteinte ni emballée. Jamais d'explosion : si la puissance reste
   trop longtemps dans le rouge, les barres tombent toutes seules (arrêt automatique). */
(function () {
  'use strict';
  const { lib } = window.RM;
  const { TAU, rand, clamp, lerp, ease, draw } = lib;

  /* Tous les textes du jeu, faciles à corriger */
  const TEXTES = {
    bouton: 'Lancer un neutron',
    puissance: 'Puissance',
    enfoncees: 'Barres enfoncées',
    remontees: 'Barres remontées',
    curseur: 'Barres de contrôle',
    valeur: (pct) => `Barres remontées à ${pct} %`,
    eteint: 'La réaction s’éteint : remonte un peu les barres.',
    demarre: 'La réaction démarre : les fissions se multiplient.',
    relance: 'Relance un neutron pour redémarrer la réaction.',
    vert: 'Réaction stable : bravo !',
    rouge: 'Trop vite ! Enfonce les barres.',
    arret: 'Arrêt automatique : les barres tombent toutes seules. Relance un neutron.',
    fin: 'Réaction stable : chaque fission en provoque juste une autre.',
    finStatut: 'C’est le travail des pilotes d’une centrale, jour et nuit.',
  };

  const CSS = `
.game[data-game="fission"] .fi-launch {
  position: absolute; z-index: 4; left: 12px; top: 7px; white-space: nowrap;
  background: #EAF3FF; color: #081428; padding: 9px 15px 9px 11px;
  box-shadow: 0 0 0 3px rgba(63, 169, 255, 0.35), 0 8px 18px -8px rgba(0, 0, 0, 0.7);
}
.game[data-game="fission"] .fi-launch svg { width: 20px; height: 20px; flex: none; }
.game[data-game="fission"] .fi-launch.is-call { animation: fi-call 1.5s ease-in-out infinite; }
@keyframes fi-call {
  0%, 100% { box-shadow: 0 0 0 3px rgba(63, 169, 255, 0.35), 0 8px 18px -8px rgba(0, 0, 0, 0.7); }
  50% { box-shadow: 0 0 0 7px rgba(63, 169, 255, 0.55), 0 8px 18px -8px rgba(0, 0, 0, 0.7); }
}
.game[data-game="fission"] .fi-plabel {
  position: absolute; z-index: 3; right: 12px; top: 30px; margin: 0;
  font: 700 0.8125rem/1 var(--font-text); letter-spacing: 0.01em; color: #BFD8F2;
  pointer-events: none;
}
.game[data-game="fission"] .fi-deck { position: absolute; z-index: 4; left: 14px; right: 14px; bottom: 10px; }
.game[data-game="fission"] .fi-labels {
  display: flex; justify-content: space-between; gap: 10px; margin: 0 2px;
  font: 600 0.8125rem/1.1 var(--font-text); color: #BFD8F2; pointer-events: none;
}
.game[data-game="fission"] .fi-lab { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
.game[data-game="fission"] .fi-deck.is-narrow .fi-labels { font-size: 0.75rem; gap: 6px; margin: 0; }
.game[data-game="fission"] .fi-deck.is-narrow .fi-lab svg { width: 12px; height: 12px; }
.game[data-game="fission"] .fi-lab svg { width: 14px; height: 14px; flex: none; fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; opacity: 0.85; }
.game[data-game="fission"] .fi-slider {
  position: relative; height: 46px; margin-top: 3px; cursor: pointer; outline: none;
  -webkit-tap-highlight-color: transparent;
}
.game[data-game="fission"] .fi-track {
  position: absolute; left: 4px; right: 4px; top: 50%; height: 12px; margin-top: -6px;
  border-radius: 7px 6px 7px 6px;
  background: linear-gradient(180deg, #050C18, #0F1E33 70%, #18304D);
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.8), 0 1px 0 rgba(191, 216, 242, 0.14);
}
.game[data-game="fission"] .fi-track::before {
  content: ""; position: absolute; left: 10px; right: 10px; top: 50%; height: 2px; margin-top: -1px;
  background: repeating-linear-gradient(90deg, rgba(191, 216, 242, 0.32) 0 2px, transparent 2px 10%);
}
.game[data-game="fission"] .fi-handle {
  position: absolute; left: 0; top: 0; width: 56px; height: 46px; margin-left: -28px;
  border-radius: 19px 23px 20px 22px / 22px 19px 23px 20px;
  background: radial-gradient(120% 90% at 35% 25%, #FFFFFF, #DCE8F5 45%, #9DB3CC);
  box-shadow: 0 0 0 1px rgba(8, 20, 40, 0.35), 0 8px 16px -6px rgba(0, 0, 0, 0.75);
  transform: translateX(var(--x, 0px)); will-change: transform;
  transition: box-shadow 0.2s;
}
.game[data-game="fission"] .fi-handle::before {
  content: ""; position: absolute; left: 50%; top: 50%; width: 16px; height: 18px; margin: -9px 0 0 -8px;
  background: linear-gradient(90deg, #3E5470 0 2.5px, transparent 2.5px 6.75px, #3E5470 6.75px 9.25px, transparent 9.25px 13.5px, #3E5470 13.5px 16px);
  border-radius: 2px; opacity: 0.75;
}
.game[data-game="fission"] .fi-slider.is-drag .fi-handle,
.game[data-game="fission"] .fi-slider:focus-visible .fi-handle {
  box-shadow: 0 0 0 4px rgba(63, 169, 255, 0.55), 0 8px 16px -6px rgba(0, 0, 0, 0.75);
}
.game[data-game="fission"] .fi-slider.is-locked { cursor: default; }
.game[data-game="fission"] .gesture-dot {
  box-shadow: 0 0 0 7px rgba(255, 255, 255, 0.25), 0 0 0 15px rgba(63, 169, 255, 0.3), 0 4px 14px rgba(0, 0, 0, 0.4);
}
`;

  const ICON_N = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="15" cy="12" r="4.2" fill="#2F8FE6"/>' +
    '<circle cx="15" cy="12" r="7" fill="none" stroke="#2F8FE6" stroke-opacity="0.35" stroke-width="1.6"/>' +
    '<path d="M2.5 12h6.5M4.5 8h4M4.5 16h4" fill="none" stroke="#081428" stroke-width="2" stroke-linecap="round"/></svg>';
  const ICON_DOWN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v15M6.5 13.5 12 19l5.5-5.5"/></svg>';
  const ICON_UP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20V5M6.5 10.5 12 5l5.5 5.5"/></svg>';

  /* Réglages de la simulation (schématique) */
  const COLS = 6, ROWS = 5;     /* 30 noyaux */
  const NU = 2.5;               /* 2 ou 3 neutrons par fission */
  const P_ESC = 0.1;            /* part des neutrons qui sortent du cœur */
  const POS0 = 0.27;            /* curseur au départ : barres très enfoncées */
  const GREEN_LO = 0.28, RED_LO = 0.72;   /* zones de la jauge */
  const F_MAX = 8;              /* fissions par seconde pour une jauge pleine */
  const TAU_RATE = 1.3;         /* lissage du compte des fissions (s) */
  const TAU_FAST = 0.7;         /* compte rapide, pour la contre-réaction */
  const GAIN = 1.8;             /* contre-réaction qui stabilise la puissance */
  const GREEN_GOAL = 4;         /* secondes cumulées dans le vert */
  const RED_MAX = 2;            /* secondes dans le rouge avant l'arrêt automatique */
  const MAX_N = 90;             /* neutrons en vol au maximum */
  /* multiplication sans contre-réaction selon la position du curseur (0 = barres enfoncées, 1 = remontées) */
  const K_PTS = [[0, 0.3], [0.38, 1.0], [0.47, 1.3], [0.8, 1.8], [1, 2.25]];
  /* niveau d'équilibre de la jauge selon la position du curseur */
  const L_PTS = [[0, 0], [0.38, 0], [0.46, 0.3], [0.62, 0.48], [0.78, 0.62], [0.88, 0.84], [1, 1]];

  function piecewise(pts, x) {
    for (let i = 1; i < pts.length; i++) {
      if (x <= pts[i][0]) {
        const [a, ka] = pts[i - 1];
        const [b, kb] = pts[i];
        return lerp(ka, kb, (x - a) / (b - a));
      }
    }
    return pts[pts.length - 1][1];
  }
  const k0Of = (pos) => piecewise(K_PTS, pos);
  const lstarOf = (pos) => piecewise(L_PTS, pos);

  function mk(w, h, dpr) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * dpr));
    c.height = Math.max(1, Math.round(h * dpr));
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    return { c, g, w, h };
  }
  function seeded(seed) {
    let s = seed >>> 0 || 1;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }

  /* Noyau d'uranium : sphère jaune-vert, un peu granuleuse (des nucléons serrés), avec un halo. */
  function paintNucleus(g, cx, cy, R, seed) {
    draw.glow(g, cx, cy, R * 1.75, '#DDF06A', 0.26);
    const body = g.createRadialGradient(cx - R * 0.38, cy - R * 0.42, R * 0.08, cx, cy, R * 1.02);
    body.addColorStop(0, '#FFFBD2');
    body.addColorStop(0.35, '#F4E86C');
    body.addColorStop(0.72, '#C4D03C');
    body.addColorStop(1, '#7A8C22');
    g.fillStyle = body;
    g.beginPath();
    g.arc(cx, cy, R, 0, TAU);
    g.fill();
    g.save();
    g.beginPath();
    g.arc(cx, cy, R, 0, TAU);
    g.clip();
    /* nucléons : petites bosses douces disposées en spirale */
    const r = seeded(seed);
    const n = 19;
    for (let i = 0; i < n; i++) {
      const rr = R * 0.86 * Math.sqrt((i + 0.5) / n);
      const a = i * 2.39996 + seed;
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr;
      const br = R * (0.25 + r() * 0.06);
      const edge = rr / R;
      const hi = g.createRadialGradient(x - br * 0.35, y - br * 0.4, 0, x, y, br);
      hi.addColorStop(0, `rgba(255,255,226,${0.32 * (1 - edge * 0.6)})`);
      hi.addColorStop(0.55, 'rgba(255,255,226,0)');
      hi.addColorStop(0.85, `rgba(70,80,10,${0.1 + 0.12 * edge})`);
      hi.addColorStop(1, 'rgba(70,80,10,0)');
      g.fillStyle = hi;
      g.beginPath();
      g.arc(x, y, br, 0, TAU);
      g.fill();
    }
    /* grain fin */
    for (let i = 0; i < Math.round(R * R * 0.9); i++) {
      const a = r() * TAU, d = Math.sqrt(r()) * R;
      g.fillStyle = r() < 0.5 ? `rgba(255,255,230,${0.12 + r() * 0.18})` : `rgba(60,66,8,${0.1 + r() * 0.16})`;
      g.fillRect(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 0.7, 0.7);
    }
    /* ombre propre et reflet bleu de l'eau sur le bord */
    const sh = g.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.5, cx, cy, R * 1.05);
    sh.addColorStop(0, 'rgba(0,0,0,0)');
    sh.addColorStop(1, 'rgba(10,30,20,0.45)');
    g.fillStyle = sh;
    g.fillRect(cx - R, cy - R, R * 2, R * 2);
    g.restore();
    g.strokeStyle = 'rgba(140,205,255,0.35)';
    g.lineWidth = Math.max(0.8, R * 0.07);
    g.beginPath();
    g.arc(cx, cy, R * 0.96, 0.15 * Math.PI, 0.75 * Math.PI);
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.beginPath();
    g.ellipse(cx - R * 0.36, cy - R * 0.42, R * 0.2, R * 0.13, -0.6, 0, TAU);
    g.fill();
  }

  /* Fragment de fission : petite sphère orangée et chaude */
  function paintFragment(g, cx, cy, R) {
    draw.glow(g, cx, cy, R * 2.1, '#FFB25C', 0.45);
    const body = g.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
    body.addColorStop(0, '#FFF3C4');
    body.addColorStop(0.5, '#FFB347');
    body.addColorStop(1, '#C0562A');
    g.fillStyle = body;
    g.beginPath();
    g.arc(cx, cy, R, 0, TAU);
    g.fill();
  }

  window.RM.games.fission = function (api) {
    api.style(CSS);
    const stage = api.stage;
    const cv = api.canvas();
    const ctx = cv.ctx;
    const AMB = api.reducedMotion ? 0.25 : 1;

    /* ---- éléments DOM : bouton, étiquette de la jauge, curseur des barres ---- */
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip fi-launch';
    btn.innerHTML = ICON_N + '<span></span>';
    btn.lastChild.textContent = TEXTES.bouton;
    stage.appendChild(btn);

    const plabel = document.createElement('p');
    plabel.className = 'fi-plabel';
    plabel.setAttribute('aria-hidden', 'true');
    plabel.textContent = TEXTES.puissance;
    stage.appendChild(plabel);

    const deck = document.createElement('div');
    deck.className = 'fi-deck';
    deck.innerHTML = '<div class="fi-labels" aria-hidden="true"><span class="fi-lab">' + ICON_DOWN + '<span></span></span>' +
      '<span class="fi-lab"><span></span>' + ICON_UP + '</span></div>' +
      '<div class="fi-slider" role="slider" tabindex="0" aria-valuemin="0" aria-valuemax="100">' +
      '<span class="fi-track"></span><span class="fi-handle"></span></div>';
    const labs = deck.querySelectorAll('.fi-lab > span');
    labs[0].textContent = TEXTES.enfoncees;
    labs[1].textContent = TEXTES.remontees;
    const slider = deck.querySelector('.fi-slider');
    const handle = deck.querySelector('.fi-handle');
    slider.setAttribute('aria-label', TEXTES.curseur);
    stage.appendChild(deck);

    /* ---- géométrie ---- */
    const G = {
      w: 1, h: 1, bandH: 62, deckTop: 1, cx0: 0, cx1: 1, cy0: 0, cy1: 1, sx: 1, sy: 1, R: 10,
      hw: 4, ex: 0, ey: 0, gx: 0, gw: 16, gy0: 0, gy1: 1, V: 100, trackW: 1,
    };
    const nuclei = [];
    for (let i = 0; i < COLS * ROWS; i++) {
      nuclei.push({ c: i % COLS, r: Math.floor(i / COLS), x: 0, y: 0, state: 'ok', wait: 0, grow: 1, ph: rand(TAU), v: i % 3, glint: 0 });
    }
    const rods = [];
    for (let i = 0; i < COLS - 1; i++) rods.push({ x: 0 });

    let bg = null, caus = null, rodC = null, ghostC = null, fragC = null, neuC = null;
    const nucC = [];
    let gaugeGrad = null;

    function geometry(w, h) {
      G.w = w;
      G.h = h;
      G.bandH = 62;
      deck.classList.toggle('is-narrow', w < 330);
      const deckH = deck.offsetHeight || 64;
      G.deckTop = h - 10 - deckH;
      const colW = clamp(w * 0.11, 38, 54);
      G.cx0 = 18;
      G.cx1 = w - 12 - colW;
      G.cy0 = G.bandH;
      G.cy1 = G.deckTop - 14;
      G.sx = (G.cx1 - G.cx0) / COLS;
      G.sy = (G.cy1 - G.cy0) / ROWS;
      const cell = Math.min(G.sx, G.sy);
      G.R = clamp(cell * 0.3, 8, 26);
      G.hw = clamp(G.sx * 0.1, 3, 7.5);
      G.V = cell * 3.1;
      G.ex = G.cx0 - 3;
      G.ey = (G.cy0 + G.cy1) / 2;
      G.gx = w - 12 - colW / 2;
      G.gw = clamp(colW * 0.4, 15, 22);
      G.gy0 = G.cy0 + 8;
      G.gy1 = G.cy1 + 6;
      nuclei.forEach((n) => {
        n.x = G.cx0 + (n.c + 0.5) * G.sx;
        n.y = G.cy0 + (n.r + 0.5) * G.sy;
      });
      rods.forEach((rd, i) => { rd.x = G.cx0 + (i + 1) * G.sx; });
      plabel.style.top = (G.bandH - 25) + 'px';
      G.trackW = slider.clientWidth || (w - 28);
      buildSprites();
      bg = makeBg(w, h);
      caus = makeCaustics();
      gaugeGrad = ctx.createLinearGradient(0, G.gy1, 0, G.gy0);
      gaugeGrad.addColorStop(0, '#2E6FE8');
      gaugeGrad.addColorStop(GREEN_LO - 0.015, '#58B4FF');
      gaugeGrad.addColorStop(GREEN_LO + 0.015, '#3DCB6C');
      gaugeGrad.addColorStop(RED_LO - 0.015, '#9BE36A');
      gaugeGrad.addColorStop(RED_LO + 0.015, '#FF5A45');
      gaugeGrad.addColorStop(1, '#FF8F6A');
      placeHandle();
    }

    function buildSprites() {
      const dpr = cv.dpr, R = G.R;
      const S = Math.ceil(R * 1.8) * 2 + 4;
      nucC.length = 0;
      for (let v = 0; v < 3; v++) {
        const s = mk(S, S, dpr);
        paintNucleus(s.g, S / 2, S / 2, R, 3 + v * 7);
        nucC.push(s);
      }
      ghostC = mk(S, S, dpr);
      const gg = ghostC.g;
      gg.fillStyle = 'rgba(4,14,32,0.28)';
      gg.beginPath();
      gg.arc(S / 2, S / 2, R * 0.92, 0, TAU);
      gg.fill();
      gg.strokeStyle = 'rgba(150,210,255,0.26)';
      gg.lineWidth = 1.2;
      gg.setLineDash([2.5, 3]);
      gg.stroke();
      const FS = Math.ceil(R * 0.62 * 2.1) * 2 + 4;
      fragC = mk(FS, FS, dpr);
      paintFragment(fragC.g, FS / 2, FS / 2, R * 0.62);
      const nr = clamp(R * 0.2, 2, 3.6);
      const NS = Math.ceil(nr * 4) * 2;
      neuC = mk(NS, NS, dpr);
      draw.glow(neuC.g, NS / 2, NS / 2, nr * 4, '#6CC2FF', 0.55);
      draw.glow(neuC.g, NS / 2, NS / 2, nr * 1.8, '#D8F0FF', 0.9);
      neuC.g.fillStyle = '#FFFFFF';
      neuC.g.beginPath();
      neuC.g.arc(NS / 2, NS / 2, nr, 0, TAU);
      neuC.g.fill();
      G.nr = nr;
      /* barre de contrôle : acier sombre, bout arrondi, liseré bleu de l'eau */
      const hw = G.hw, RW = Math.ceil(hw * 2 + 4), L = Math.ceil(G.cy1 - G.cy0 + 8);
      rodC = mk(RW, L, dpr);
      const g = rodC.g, x0 = RW / 2 - hw, x1 = RW / 2 + hw;
      const gr = g.createLinearGradient(x0, 0, x1, 0);
      gr.addColorStop(0, '#11161E');
      gr.addColorStop(0.3, '#5A6880');
      gr.addColorStop(0.5, '#3A4558');
      gr.addColorStop(0.82, '#222A36');
      gr.addColorStop(1, '#0E131A');
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(x0, 0);
      g.lineTo(x1, 0);
      g.lineTo(x1, L - hw);
      g.arc(RW / 2, L - hw, hw, 0, Math.PI);
      g.closePath();
      g.fill();
      for (let y = L - hw * 2 - G.sy * 0.5; y > 0; y -= G.sy * 0.5) {
        g.fillStyle = 'rgba(0,0,0,0.35)';
        g.fillRect(x0, y, hw * 2, 1);
        g.fillStyle = 'rgba(190,210,235,0.12)';
        g.fillRect(x0, y + 1, hw * 2, 0.8);
      }
      g.fillStyle = 'rgba(110,185,255,0.3)';
      g.fillRect(x1 - 1.1, 0, 1.1, L - hw);
      g.fillStyle = 'rgba(255,255,255,0.1)';
      g.fillRect(x0 + hw * 0.5, 0, Math.max(1, hw * 0.3), L - hw);
      G.rodLen = L;
    }

    /* Fond pré-rendu : tête du réacteur, eau bleue de la piscine, canaux de combustible,
       cadre du cœur, pupitre, et le tube de la jauge. */
    function makeBg(w, h) {
      const B = mk(w, h, cv.dpr);
      const g = B.g;
      const { cx0, cx1, cy0, cy1, bandH, deckTop } = G;
      /* eau */
      const wg = g.createLinearGradient(0, bandH, 0, deckTop);
      wg.addColorStop(0, '#0B2B58');
      wg.addColorStop(0.55, '#082043');
      wg.addColorStop(1, '#05142B');
      g.fillStyle = wg;
      g.fillRect(0, 0, w, h);
      /* carrelage de la piscine, vu à travers l'eau */
      const rnd = seeded(11);
      const T = clamp(Math.min(w, h) * 0.06, 16, 30);
      g.strokeStyle = 'rgba(140,200,255,0.05)';
      g.lineWidth = 1;
      for (let y = bandH; y < deckTop; y += T) {
        g.beginPath();
        for (let x = 0; x <= w; x += 12) g.lineTo(x, y + Math.sin(x * 0.05 + y) * 1.2);
        g.stroke();
      }
      for (let x = 0; x < w; x += T) {
        g.beginPath();
        for (let y = bandH; y <= deckTop; y += 12) g.lineTo(x + Math.sin(y * 0.05 + x) * 1.2, y);
        g.stroke();
      }
      /* lueur bleue autour du cœur */
      const mx = (cx0 + cx1) / 2, my = (cy0 + cy1) / 2;
      const big = Math.max(cx1 - cx0, cy1 - cy0);
      draw.glow(g, mx, my, big * 0.85, '#3FA9FF', 0.3);
      draw.glow(g, mx, my, big * 0.5, '#8CCBFF', 0.12);
      /* canaux de combustible (une colonne de noyaux chacun) */
      for (let c = 0; c < COLS; c++) {
        const x = cx0 + (c + 0.5) * G.sx;
        const cw = G.sx * 0.64;
        draw.roundRect(g, x - cw / 2, cy0 + 3, cw, cy1 - cy0 - 6, cw * 0.45);
        g.fillStyle = 'rgba(140,205,255,0.06)';
        g.fill();
        g.strokeStyle = 'rgba(160,220,255,0.12)';
        g.lineWidth = 1;
        g.stroke();
        for (let r = 1; r < ROWS; r++) {
          const y = cy0 + r * G.sy;
          g.fillStyle = 'rgba(170,220,255,0.13)';
          g.fillRect(x - cw / 2 + 2, y - 0.75, cw - 4, 1.5);
        }
      }
      /* cadre du cœur et plaque de support */
      draw.roundRect(g, cx0 - 6, cy0 - 2, cx1 - cx0 + 12, cy1 - cy0 + 12, 10);
      g.strokeStyle = 'rgba(170,215,255,0.26)';
      g.lineWidth = 2;
      g.stroke();
      const pg = g.createLinearGradient(0, cy1 + 2, 0, cy1 + 10);
      pg.addColorStop(0, '#5E708A');
      pg.addColorStop(1, '#253247');
      g.fillStyle = pg;
      draw.roundRect(g, cx0 - 6, cy1 + 2, cx1 - cx0 + 12, 8, 3);
      g.fill();
      for (let c = 0; c < COLS; c++) {
        g.fillStyle = 'rgba(6,16,32,0.7)';
        g.beginPath();
        g.ellipse(cx0 + (c + 0.5) * G.sx, cy1 + 6, G.sx * 0.16, 1.6, 0, 0, TAU);
        g.fill();
      }
      /* source de neutrons dans la paroi gauche */
      draw.roundRect(g, G.ex - 6, G.ey - 13, 10, 26, 4);
      g.fillStyle = '#16273F';
      g.fill();
      g.strokeStyle = 'rgba(170,215,255,0.35)';
      g.lineWidth = 1;
      g.stroke();
      /* tête du réacteur : bandeau sombre, poutre d'acier et passages des barres */
      const hg = g.createLinearGradient(0, 0, 0, bandH);
      hg.addColorStop(0, '#0A1628');
      hg.addColorStop(1, '#0D1D33');
      g.fillStyle = hg;
      g.fillRect(0, 0, w, bandH);
      for (let i = 0; i < 260; i++) {
        g.fillStyle = rnd() < 0.5 ? `rgba(160,190,230,${0.03 + rnd() * 0.05})` : `rgba(0,0,0,${0.08 + rnd() * 0.12})`;
        g.fillRect(rnd() * w, rnd() * bandH, 1 + rnd() * 1.5, 1);
      }
      const bmg = g.createLinearGradient(0, bandH - 9, 0, bandH);
      bmg.addColorStop(0, '#71819A');
      bmg.addColorStop(0.35, '#4A586E');
      bmg.addColorStop(1, '#222C3B');
      g.fillStyle = bmg;
      g.fillRect(0, bandH - 9, w, 9);
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.fillRect(0, bandH - 9, w, 1);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(0, bandH, w, 2);
      rods.forEach((rd) => {
        const cw = G.hw * 2 + 8;
        const cg = g.createLinearGradient(rd.x - cw / 2, 0, rd.x + cw / 2, 0);
        cg.addColorStop(0, '#1C2533');
        cg.addColorStop(0.35, '#7F90AA');
        cg.addColorStop(1, '#1A2230');
        g.fillStyle = cg;
        draw.roundRect(g, rd.x - cw / 2, bandH - 11, cw, 12, 2.5);
        g.fill();
      });
      /* pupitre de commande */
      const dg = g.createLinearGradient(0, deckTop - 8, 0, h);
      dg.addColorStop(0, '#0E1C30');
      dg.addColorStop(1, '#081222');
      g.fillStyle = dg;
      g.fillRect(0, deckTop - 8, w, h - deckTop + 8);
      g.fillStyle = 'rgba(191,216,242,0.14)';
      g.fillRect(0, deckTop - 8, w, 1);
      for (let i = 0; i < 70; i++) {
        g.fillStyle = `rgba(170,200,240,${0.025 + rnd() * 0.04})`;
        g.fillRect(rnd() * w, deckTop - 6 + rnd() * (h - deckTop), 10 + rnd() * 40, 1);
      }
      /* tube de la jauge */
      const { gx, gw, gy0, gy1 } = G;
      draw.roundRect(g, gx - gw / 2 - 3, gy0 - 3, gw + 6, gy1 - gy0 + 6, gw / 2 + 3);
      g.fillStyle = '#0A1424';
      g.fill();
      g.strokeStyle = 'rgba(191,216,242,0.3)';
      g.lineWidth = 1.2;
      g.stroke();
      const zone = (a, b, col) => {
        g.fillStyle = col;
        const ya = lerp(gy1, gy0, a), yb = lerp(gy1, gy0, b);
        g.fillRect(gx - gw / 2, yb, gw, ya - yb);
      };
      g.save();
      draw.roundRect(g, gx - gw / 2, gy0, gw, gy1 - gy0, gw / 2);
      g.clip();
      zone(0, GREEN_LO, 'rgba(63,140,255,0.2)');
      zone(GREEN_LO, RED_LO, 'rgba(70,200,110,0.2)');
      zone(RED_LO, 1, 'rgba(255,90,70,0.22)');
      g.restore();
      [GREEN_LO, RED_LO].forEach((v) => {
        const y = lerp(gy1, gy0, v);
        g.fillStyle = 'rgba(220,235,250,0.55)';
        g.fillRect(gx + gw / 2 + 4, y - 0.75, 6, 1.5);
        g.fillRect(gx - gw / 2 - 10, y - 0.75, 6, 1.5);
      });
      /* légère vignette */
      const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.6);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,4,12,0.35)');
      g.fillStyle = vg;
      g.fillRect(0, 0, w, h);
      return B;
    }

    /* Reflets mouvants de la lumière dans l'eau (caustiques), texture basse résolution */
    function makeCaustics() {
      const W = G.cx1 - G.cx0 + 80, H = G.cy1 - G.cy0 + 80;
      const sc = 2.5;
      const tw = Math.max(8, Math.round(W / sc)), th = Math.max(8, Math.round(H / sc));
      const c = document.createElement('canvas');
      c.width = tw;
      c.height = th;
      const g = c.getContext('2d');
      const img = g.createImageData(tw, th);
      const n = lib.makeNoise(5);
      for (let y = 0; y < th; y++) {
        for (let x = 0; x < tw; x++) {
          const v = n.fbm(x / 11, y / 11, 3);
          const k = Math.pow(1 - Math.abs(Math.sin(v * 15)), 6);
          const j = (y * tw + x) * 4;
          img.data[j] = 150;
          img.data[j + 1] = 215;
          img.data[j + 2] = 255;
          img.data[j + 3] = Math.round(k * 230);
        }
      }
      g.putImageData(img, 0, 0);
      return { c, w: W, h: H };
    }

    /* ---- état ---- */
    let pos = POS0;
    let rate = 0, fast = 0, level = 0, greenT = 0, redT = 0;
    let started = false, afterScram = false, scram = null, bounceT = -1;
    let lastFission = -10, time = 0, emitFlash = 0;
    let firstFission = false, dragTimer = -1, sliderTouched = false;
    let shownStatus = null, shownProg = -1, ariaPct = -1, zone = 'bleu', callOn = false, guideTimer = 0;

    /* réservoirs d'objets réutilisés (aucune allocation dans la boucle) */
    const pool = (n, make) => Array.from({ length: n }, make);
    const NEU = pool(MAX_N, () => ({ on: false, x: 0, y: 0, vx: 0, vy: 0, age: 0, out: 0, ttl: Infinity, plan: '', target: -1, guided: false }));
    const FRAG = pool(48, () => ({ on: false, x: 0, y: 0, vx: 0, vy: 0, t: 0, s: 1, spin: 0 }));
    const FLASH = pool(32, () => ({ on: false, x: 0, y: 0, t: 0, kind: '' }));
    const WAVE = pool(24, () => ({ on: false, x: 0, y: 0, t: 0, dur: 0.5, r1: 40, tap: false }));
    const PUFF = pool(90, () => ({ on: false, x: 0, y: 0, vx: 0, vy: 0, t: 0, life: 0.5, dark: true }));
    const SPARK = pool(Math.round(34 * AMB) + 6, () => ({ u: Math.random(), v: Math.random(), ph: rand(TAU), sp: rand(0.6, 1.6) }));
    function take(arr) {
      for (let i = 0; i < arr.length; i++) if (!arr[i].on) return arr[i];
      return null;
    }

    function rodBottom() {
      const off = bounceT >= 0 ? Math.sin(bounceT * 26) * Math.exp(-bounceT * 7) * 5 : 0;
      return G.cy0 + 3 + (1 - pos) * (G.cy1 - G.cy0 - 6) + off;
    }

    /* Premier obstacle rencontré par un rayon : noyau, barre ou sortie du cœur */
    const HIT = { kind: 'out', idx: -1, t: Infinity };
    function rayCast(x, y, dx, dy, skip) {
      let best = Infinity;
      HIT.kind = 'out';
      HIT.idx = -1;
      HIT.t = Infinity;
      const hr = G.R * 0.95 + G.nr;
      for (let i = 0; i < nuclei.length; i++) {
        const n = nuclei[i];
        if (i === skip || n.state !== 'ok') continue;
        const ox = n.x - x, oy = n.y - y;
        const b = ox * dx + oy * dy;
        if (b <= 0) continue;
        const disc = b * b - (ox * ox + oy * oy - hr * hr);
        if (disc < 0) continue;
        const t = b - Math.sqrt(disc);
        if (t > 0 && t < best) { best = t; HIT.kind = 'nuc'; HIT.idx = i; HIT.t = t; }
      }
      const rb = rodBottom(), rh = G.hw + G.nr * 0.5, ya = G.cy0 - 2;
      for (let i = 0; i < rods.length; i++) {
        const rx = rods[i].x;
        let t0 = 0, t1 = Infinity;
        if (Math.abs(dx) < 1e-9) {
          if (x < rx - rh || x > rx + rh) continue;
        } else {
          let a = (rx - rh - x) / dx, b = (rx + rh - x) / dx;
          if (a > b) { const s = a; a = b; b = s; }
          t0 = Math.max(t0, a);
          t1 = Math.min(t1, b);
        }
        if (Math.abs(dy) < 1e-9) {
          if (y < ya || y > rb) continue;
        } else {
          let a = (ya - y) / dy, b = (rb - y) / dy;
          if (a > b) { const s = a; a = b; b = s; }
          t0 = Math.max(t0, a);
          t1 = Math.min(t1, b);
        }
        if (t0 <= t1 && t0 < best) { best = t0; HIT.kind = 'rod'; HIT.idx = i; HIT.t = t0; }
      }
    }

    function pendingFissions() {
      let n = 0;
      for (let i = 0; i < NEU.length; i++) {
        const m = NEU[i];
        if (m.on && m.plan === 'nuc' && m.target >= 0 && nuclei[m.target].state === 'ok') n++;
      }
      return n;
    }
    function inFlight() {
      let n = 0;
      for (let i = 0; i < NEU.length; i++) if (NEU[i].on) n++;
      return n;
    }

    function spawnNeutron(x, y, dx, dy, plan, target, guided) {
      const m = take(NEU);
      if (!m) return null;
      const v = G.V * (guided ? 2.6 : rand(0.9, 1.1));
      m.on = true;
      m.x = x;
      m.y = y;
      m.vx = dx * v;
      m.vy = dy * v;
      m.age = 0;
      m.out = 0;
      m.ttl = Infinity;
      m.plan = plan;
      m.target = target;
      m.guided = guided;
      return m;
    }

    /* Choisit une direction au hasard qui mène à l'issue voulue (noyau, barre ou sortie),
       pour que la réaction suive le réglage des barres sans tricher sur les trajectoires. */
    function aimAndSpawn(x, y, src, want) {
      let fdx = 1, fdy = 0, fk = '', fi = -1, ft = Infinity;
      let adx = 0, ady = 0, ak = '', ai = -1, at = Infinity;
      for (let k = 0; k < 32; k++) {
        const a = Math.random() * TAU;
        const dx = Math.cos(a), dy = Math.sin(a);
        rayCast(x, y, dx, dy, src);
        if (HIT.kind === want) {
          fdx = dx; fdy = dy; fk = HIT.kind; fi = HIT.idx; ft = HIT.t;
          break;
        }
        /* repli : une autre issue sans fission (barre ou sortie) */
        if (!ak || (ak === 'nuc' && HIT.kind !== 'nuc')) {
          adx = dx; ady = dy; ak = HIT.kind; ai = HIT.idx; at = HIT.t;
        }
      }
      let fade = false;
      if (!fk) {
        fdx = adx; fdy = ady; fk = ak; fi = ai; ft = at;
        /* aucune issue sans fission : le neutron est absorbé par l'eau en chemin */
        if (want !== 'nuc' && fk === 'nuc') fade = true;
      }
      const m = spawnNeutron(x + fdx * G.R * 0.7, y + fdy * G.R * 0.7, fdx, fdy, fade ? 'fade' : fk, fade ? -1 : fi, false);
      if (m && fade) m.ttl = (Math.max(0, ft - G.R) * rand(0.35, 0.7)) / Math.hypot(m.vx, m.vy);
    }

    function emit(x, y, src) {
      const n = Math.random() < 0.5 ? 2 : 3;
      const k0 = k0Of(pos);
      const ls = lstarOf(pos);
      /* barres bien réglées : la puissance revient d'elle-même vers son niveau d'équilibre */
      const cap = ls >= GREEN_LO ? Math.max(k0, 2) : k0;
      const keff = clamp(Math.min(cap, 1 + GAIN * (ls - clamp(fast / F_MAX))), 0, 2.3);
      const pRod = clamp(1 - P_ESC - k0 / NU, 0, 0.9);
      const pF = clamp(keff / NU, 0, 1 - pRod);
      /* barres bien réglées : la chaîne ne doit pas s'éteindre par malchance */
      const protect = ls >= GREEN_LO && pendingFissions() === 0;
      for (let i = 0; i < n; i++) {
        let want;
        if (protect && i === 0) want = 'nuc';
        else {
          const u = Math.random();
          want = u < pRod ? 'rod' : u < pRod + pF ? 'nuc' : 'out';
        }
        aimAndSpawn(x, y, src, want);
      }
    }

    function addFlash(x, y, kind) {
      const f = take(FLASH);
      if (!f) return;
      f.on = true;
      f.x = x;
      f.y = y;
      f.t = 0;
      f.kind = kind;
    }
    function addWave(x, y, r1, dur, tap) {
      const wv = take(WAVE);
      if (!wv) return;
      wv.on = true;
      wv.x = x;
      wv.y = y;
      wv.t = 0;
      wv.r1 = r1;
      wv.dur = dur;
      wv.tap = tap;
    }
    function addFrag(x, y, vx, vy, s) {
      const f = take(FRAG);
      if (!f) return;
      f.on = true;
      f.x = x;
      f.y = y;
      f.vx = vx;
      f.vy = vy;
      f.t = 0;
      f.s = s;
      f.spin = rand(TAU);
    }
    function addPuff(x, y, dark) {
      const p = take(PUFF);
      if (!p) return;
      const a = rand(TAU), v = rand(10, 34);
      p.on = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * v;
      p.vy = Math.sin(a) * v;
      p.t = 0;
      p.life = rand(0.3, 0.6);
      p.dark = dark;
    }

    function fission(i) {
      const n = nuclei[i];
      n.state = 'gone';
      n.wait = rand(2, 3);
      n.grow = 0;
      rate += 1 / TAU_RATE;
      fast += 1 / TAU_FAST;
      lastFission = time;
      const a = rand(TAU);
      const sp = Math.min(G.sx, G.sy) * rand(1.5, 2);
      addFrag(n.x, n.y, Math.cos(a) * sp, Math.sin(a) * sp, 1);
      addFrag(n.x, n.y, -Math.cos(a) * sp * 1.12, -Math.sin(a) * sp * 1.12, 0.84);
      addFlash(n.x, n.y, 'fis');
      addWave(n.x, n.y, Math.min(G.sx, G.sy) * 0.95, 0.45, false);
      for (let k = 0; k < 4; k++) addPuff(n.x, n.y, false);
      emit(n.x, n.y, i);
      api.sfx.play('pop', { pitch: rand(0.85, 1.35), volume: 0.5, gap: 45 });
      if (!firstFission) {
        firstFission = true;
        dragTimer = 0.9;
      }
    }

    function absorb(m) {
      m.on = false;
      addFlash(m.x, m.y, 'abs');
      for (let k = 0; k < 4; k++) addPuff(m.x, m.y, true);
      api.sfx.play('scrape', { pitch: rand(1.3, 1.7), volume: 0.16, gap: 90 });
    }

    /* ---- lancer un neutron depuis la source, vers un noyau ---- */
    function nearestAvailable(x, y, colFirst) {
      let best = -1, bd = Infinity;
      for (let pass = colFirst ? 0 : 1; pass < 2 && best < 0; pass++) {
        for (let i = 0; i < nuclei.length; i++) {
          const n = nuclei[i];
          if (n.state !== 'ok' || (pass === 0 && n.c !== 0)) continue;
          const d = Math.hypot(n.x - x, n.y - y);
          if (d < bd) { bd = d; best = i; }
        }
      }
      return best;
    }
    function launch(ti) {
      started = true;
      afterScram = false;
      emitFlash = 1;
      if (ti < 0) {
        spawnNeutron(G.ex + 4, G.ey, 1, 0, 'out', -1, false);
        return;
      }
      const t = nuclei[ti];
      const dx = t.x - (G.ex + 4), dy = t.y - G.ey;
      const d = Math.hypot(dx, dy) || 1;
      spawnNeutron(G.ex + 4, G.ey, dx / d, dy / d, 'nuc', ti, true);
      api.sfx.play('whoosh', { pitch: 1.6, volume: 0.3 });
    }

    btn.addEventListener('click', () => {
      api.gesture(null);
      api.buzz(8);
      launch(nearestAvailable(G.ex, G.ey, true));
    });

    function onTap(x, y) {
      addWave(x, y, Math.min(G.sx, G.sy) * 0.9, 0.45, true);
      api.buzz(8);
      if (x < G.cx0 - 12 || x > G.cx1 + 12 || y < G.cy0 - 6 || y > G.cy1 + 12) {
        api.sfx.play('tick', { pitch: 0.8, volume: 0.5 });
        return;
      }
      launch(nearestAvailable(x, y, false));
    }
    api.track(cv.canvas, {
      up(p, e, cancelled) {
        if (!cancelled && p.tap) onTap(p.x, p.y);
      },
    }, { touchAction: 'pan-y' });

    /* ---- curseur des barres ---- */
    function placeHandle() {
      const W = slider.clientWidth || G.trackW;
      const x = 28 + pos * (W - 56);
      handle.style.setProperty('--x', x.toFixed(1) + 'px');
      const pct = Math.round(pos * 100);
      if (pct !== ariaPct) {
        ariaPct = pct;
        slider.setAttribute('aria-valuenow', String(pct));
        slider.setAttribute('aria-valuetext', TEXTES.valeur(pct));
      }
    }
    function setPos(v, user) {
      v = clamp(v);
      if (Math.abs(v - pos) < 1e-4) return;
      const before = Math.round(pos * 12);
      pos = v;
      if (user && Math.round(pos * 12) !== before) api.sfx.play('tick', { pitch: 0.7 + pos * 0.7, volume: 0.45, gap: 20 });
      placeHandle();
    }
    let grab = null;
    api.track(slider, {
      down(p) {
        if (scram) return;
        sliderTouched = true;
        const W = slider.clientWidth;
        const hx = 28 + pos * (W - 56);
        grab = { off: Math.abs(p.x - hx) < 34 ? p.x - hx : 0 };
        slider.classList.add('is-drag');
        if (!grab.off) setPos((p.x - 28) / (W - 56), true);
      },
      move(p) {
        if (!grab || scram) return;
        const W = slider.clientWidth;
        setPos((p.x - grab.off - 28) / (W - 56), true);
      },
      up() {
        grab = null;
        slider.classList.remove('is-drag');
      },
    }, { touchAction: 'pan-y' });
    slider.addEventListener('keydown', (e) => {
      if (scram) return;
      const step = { ArrowRight: 0.05, ArrowUp: 0.05, ArrowLeft: -0.05, ArrowDown: -0.05, PageUp: 0.15, PageDown: -0.15, Home: -1, End: 1 }[e.key];
      if (step === undefined) return;
      e.preventDefault();
      sliderTouched = true;
      setPos(pos + step, true);
    });

    function setStatus(s) {
      if (s === shownStatus) return;
      shownStatus = s;
      api.status(s);
    }

    function showDrag() {
      const W = slider.clientWidth || G.trackW;
      const hx = deck.offsetLeft + slider.offsetLeft + 28 + pos * (W - 56);
      const hy = deck.offsetTop + slider.offsetTop + slider.offsetHeight / 2;
      api.gesture('drag', { x: (hx / G.w) * 100, y: (hy / G.h) * 100, dx: Math.round((0.64 - pos) * (W - 56)), dy: 0 });
    }

    /* Arrêt automatique : les barres tombent d'un coup et avalent les neutrons. */
    function startScram() {
      scram = { t: 0, from: pos, landed: false };
      afterScram = true;
      redT = 0;
      grab = null;
      slider.classList.remove('is-drag');
      slider.classList.add('is-locked');
      api.sfx.play('whoosh', { pitch: 0.6, volume: 0.6 });
      api.buzz(15);
      const turn = api.root.querySelector('.guide-turn');
      const said = turn ? turn.textContent : undefined;
      api.guide(null, 'wow', said);
      clearTimeout(guideTimer);
      guideTimer = setTimeout(() => api.guide(null, api.isDone() ? 'laugh' : 'smile', said), 1500);
    }

    /* Barres bien réglées : si plus aucun neutron ne file vers un noyau, l'un d'eux rebondit
       dans l'eau vers un noyau, pour que la chaîne ne s'éteigne pas par simple malchance. */
    function repair() {
      if (pendingFissions() > 0) return;
      for (let i = NEU.length - 1; i >= 0; i--) {
        const m = NEU[i];
        if (!m.on || m.guided || m.out > 0) continue;
        const sp = Math.hypot(m.vx, m.vy);
        for (let k = 0; k < 24; k++) {
          const a = Math.random() * TAU;
          const dx = Math.cos(a), dy = Math.sin(a);
          rayCast(m.x, m.y, dx, dy, -1);
          if (HIT.kind === 'nuc') {
            m.vx = dx * sp;
            m.vy = dy * sp;
            m.plan = 'nuc';
            m.target = HIT.idx;
            m.ttl = Infinity;
            return;
          }
        }
      }
    }

    function update(dt) {
      time += dt;
      emitFlash = Math.max(0, emitFlash - dt * 3);
      if (dragTimer >= 0) {
        dragTimer -= dt;
        if (dragTimer < 0 && !sliderTouched && !api.isDone()) showDrag();
      }
      if (scram) {
        scram.t += dt;
        const k = clamp(scram.t / 0.55);
        pos = lerp(scram.from, 0, ease.inQuad(k));
        placeHandle();
        if (k >= 1 && !scram.landed) {
          scram.landed = true;
          bounceT = 0;
          api.sfx.play('thud', { volume: 0.8 });
          api.buzz(12);
        }
        if (scram.t > 1) {
          scram = null;
          slider.classList.remove('is-locked');
        }
      }
      if (bounceT >= 0) {
        bounceT += dt;
        if (bounceT > 1) bounceT = -1;
      }

      /* neutrons : vol en ligne droite, barres, noyaux, sortie du cœur */
      const rb = rodBottom(), rh = G.hw + G.nr * 0.4;
      const hr = G.R * 0.95 + G.nr, hr2 = hr * hr;
      for (let j = 0; j < NEU.length; j++) {
        const m = NEU[j];
        if (!m.on) continue;
        m.age += dt;
        if (m.out > 0) {
          m.out += dt;
          m.x += m.vx * dt;
          m.y += m.vy * dt;
          if (m.out > 0.2) m.on = false;
          continue;
        }
        if (m.ttl !== Infinity) {
          m.ttl -= dt;
          if (m.ttl <= 0) {
            m.out = 0.001;
            continue;
          }
        }
        const steps = Math.max(1, Math.ceil((Math.hypot(m.vx, m.vy) * dt) / 4));
        const sdt = dt / steps;
        for (let s = 0; s < steps && m.on; s++) {
          m.x += m.vx * sdt;
          m.y += m.vy * sdt;
          if (m.guided) {
            const t = nuclei[m.target];
            if (t.state !== 'ok') {
              m.guided = false;
              m.plan = '';
            } else {
              if ((m.x - t.x) * (m.x - t.x) + (m.y - t.y) * (m.y - t.y) < hr2) {
                m.on = false;
                fission(m.target);
              }
              continue;
            }
          }
          if (m.y < rb && m.y > G.cy0 - 2) {
            for (let i = 0; i < rods.length; i++) {
              if (Math.abs(m.x - rods[i].x) < rh) { absorb(m); break; }
            }
            if (!m.on) break;
          }
          for (let i = 0; i < nuclei.length; i++) {
            const n = nuclei[i];
            if (n.state !== 'ok') continue;
            const dx = m.x - n.x, dy = m.y - n.y;
            if (dx * dx + dy * dy < hr2) {
              m.on = false;
              fission(i);
              break;
            }
          }
          if (!m.on) break;
          if (m.x < G.cx0 - 8 || m.x > G.cx1 + 8 || m.y < G.cy0 - 3 || m.y > G.cy1 + 10) {
            m.out = 0.001;
            break;
          }
        }
      }

      /* combustible neuf : les noyaux cassés réapparaissent lentement */
      for (let i = 0; i < nuclei.length; i++) {
        const n = nuclei[i];
        if (n.state === 'gone') {
          n.wait -= dt;
          n.grow = clamp(1 - n.wait / 0.6);
          if (n.wait <= 0) {
            n.state = 'ok';
            n.grow = 1;
            n.glint = 1;
          }
        }
        if (n.glint > 0) n.glint = Math.max(0, n.glint - dt * 2.2);
      }
      for (let i = 0; i < FRAG.length; i++) {
        const f = FRAG[i];
        if (!f.on) continue;
        f.t += dt;
        const k = Math.exp(-dt * 3.2);
        f.vx *= k;
        f.vy *= k;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        if (f.t > 0.85) f.on = false;
      }
      for (let i = 0; i < FLASH.length; i++) {
        const f = FLASH[i];
        if (f.on && (f.t += dt) > 0.4) f.on = false;
      }
      for (let i = 0; i < WAVE.length; i++) {
        const wv = WAVE[i];
        if (wv.on && (wv.t += dt) > wv.dur) wv.on = false;
      }
      for (let i = 0; i < PUFF.length; i++) {
        const p = PUFF[i];
        if (!p.on) continue;
        p.t += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.94;
        p.vy *= 0.94;
        if (p.t > p.life) p.on = false;
      }

      /* puissance : nombre de fissions par seconde, lissé */
      rate *= Math.exp(-dt / TAU_RATE);
      fast *= Math.exp(-dt / TAU_FAST);
      level += (clamp(rate / F_MAX) - level) * (1 - Math.exp(-dt / 0.5));
      const alive = inFlight() > 0 || time - lastFission < 0.5;
      const sus = lstarOf(pos) >= GREEN_LO;
      if (sus && alive && !scram) repair();
      if (level >= RED_LO) zone = 'rouge';
      else if (level >= GREEN_LO && sus && alive) zone = 'vert';
      else zone = 'bleu';
      if (zone === 'rouge' && !scram) {
        redT += dt;
        if (redT > RED_MAX) startScram();
      } else if (level < RED_LO - 0.05) {
        redT = 0;
      }
      if (zone === 'vert' && !api.isDone()) {
        greenT += dt;
        const p = clamp(greenT / GREEN_GOAL);
        if (p - shownProg >= 0.01) {
          shownProg = p;
          api.progress(p);
        }
        if (greenT >= GREEN_GOAL) {
          shownStatus = TEXTES.finStatut;
          api.done(TEXTES.fin, TEXTES.finStatut);
        }
      }
      if (afterScram && zone === 'vert') afterScram = false;
      let s;
      if (afterScram) s = TEXTES.arret;
      else if (!started) s = '';
      else if (zone === 'rouge') s = TEXTES.rouge;
      else if (zone === 'vert') s = api.isDone() ? TEXTES.finStatut : TEXTES.vert;
      else if (alive) s = sus ? TEXTES.demarre : TEXTES.eteint;
      else s = sus ? TEXTES.relance : TEXTES.eteint;
      setStatus(s);
      const call = started && !alive && (sus || afterScram);
      if (call !== callOn) {
        callOn = call;
        btn.classList.toggle('is-call', call);
      }
    }

    /* ---- dessin ---- */
    function render() {
      const w = cv.w, h = cv.h;
      if (!bg) return;
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.drawImage(bg.c, 0, 0, w, h);
      const mx = (G.cx0 + G.cx1) / 2, my = (G.cy0 + G.cy1) / 2;
      const tt = time * AMB;

      /* eau : reflets mouvants, lueur bleue qui suit la puissance, scintillements */
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, G.bandH, w, G.deckTop - 8 - G.bandH);
      ctx.clip();
      ctx.globalCompositeOperation = 'lighter';
      const ox = G.cx0 - 40, oy = G.cy0 - 40;
      ctx.globalAlpha = 0.08 + level * 0.06;
      ctx.drawImage(caus.c, ox + Math.sin(tt * 0.31) * 18, oy + Math.cos(tt * 0.23) * 14, caus.w, caus.h);
      ctx.globalAlpha = 0.06 + level * 0.05;
      ctx.save();
      ctx.translate(ox + caus.w - Math.sin(tt * 0.27 + 1) * 20, oy - Math.cos(tt * 0.35 + 2) * 16);
      ctx.scale(-1, 1);
      ctx.drawImage(caus.c, 0, 0, caus.w, caus.h);
      ctx.restore();
      ctx.globalAlpha = 1;
      draw.glow(ctx, mx, my, Math.max(G.cx1 - G.cx0, G.cy1 - G.cy0) * 0.72, '#3FA9FF', 0.06 + level * 0.34);
      ctx.fillStyle = '#D6F0FF';
      for (let i = 0; i < SPARK.length; i++) {
        const sp = SPARK[i];
        const a = Math.pow(Math.max(0, Math.sin(tt * sp.sp * 2 + sp.ph)), 12) * 0.85;
        if (a < 0.03) continue;
        const x = G.cx0 + sp.u * (G.cx1 - G.cx0);
        const y = G.cy0 + ((sp.v + tt * 0.004 * sp.sp) % 1) * (G.cy1 - G.cy0);
        ctx.globalAlpha = a;
        ctx.fillRect(x - 0.6, y - 2.2, 1.2, 4.4);
        ctx.fillRect(x - 2.2, y - 0.6, 4.4, 1.2);
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      /* source de neutrons */
      ctx.globalCompositeOperation = 'lighter';
      draw.glow(ctx, G.ex - 1, G.ey, 9 + emitFlash * 22, '#8FD3FF', 0.4 + emitFlash * 0.6);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = emitFlash > 0.05 ? '#FFFFFF' : '#9ED8FF';
      draw.roundRect(ctx, G.ex - 3, G.ey - 8, 4, 16, 2);
      ctx.fill();

      /* noyaux */
      const S = nucC[0].w;
      const bobA = api.reducedMotion ? 0 : 0.7;
      for (let i = 0; i < nuclei.length; i++) {
        const n = nuclei[i];
        const bob = Math.sin(time * 1.3 + n.ph) * bobA;
        if (n.state === 'ok') {
          ctx.drawImage(nucC[n.v].c, n.x - S / 2, n.y - S / 2 + bob, S, S);
          if (n.glint > 0) {
            ctx.globalCompositeOperation = 'lighter';
            draw.glow(ctx, n.x, n.y + bob, G.R * 1.8, '#F6FFB0', n.glint * 0.5);
            ctx.globalCompositeOperation = 'source-over';
          }
        } else {
          ctx.globalAlpha = 1 - n.grow * 0.85;
          ctx.drawImage(ghostC.c, n.x - S / 2, n.y - S / 2, S, S);
          if (n.grow > 0) {
            const s = S * (0.3 + 0.7 * ease.outBack(n.grow));
            ctx.globalAlpha = clamp(n.grow * 1.6);
            ctx.drawImage(nucC[n.v].c, n.x - s / 2, n.y - s / 2 + bob, s, s);
          }
          ctx.globalAlpha = 1;
        }
      }

      /* barres de contrôle */
      const rb = rodBottom();
      const visH = clamp(rb - G.cy0, 0, rodC.h);
      const lit = zone === 'rouge' || scram;
      for (let i = 0; i < rods.length; i++) {
        const rx = rods[i].x;
        if (visH > 0.5) {
          ctx.fillStyle = 'rgba(0,8,22,0.28)';
          ctx.fillRect(rx + G.hw - 0.5, G.cy0, 3.5, Math.max(0, visH - G.hw));
          ctx.drawImage(rodC.c, 0, (rodC.h - visH) * cv.dpr, rodC.c.width, visH * cv.dpr, rx - rodC.w / 2, G.cy0, rodC.w, visH);
        }
        const on = lit ? (Math.sin(time * 10) > 0 ? 1 : 0.25) : 0.6;
        ctx.fillStyle = lit ? `rgba(255,176,64,${on})` : 'rgba(120,230,150,0.55)';
        ctx.beginPath();
        ctx.arc(rx, G.bandH - 8.5, 1.9, 0, TAU);
        ctx.fill();
      }

      /* fragments, éclairs, ondes, éclats (dans l'eau seulement) */
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, G.bandH, w, G.deckTop - 8 - G.bandH);
      ctx.clip();
      const FS = fragC.w;
      for (let i = 0; i < FRAG.length; i++) {
        const f = FRAG[i];
        if (!f.on) continue;
        const k = f.t / 0.85;
        const s = FS * f.s * (1 - k * 0.35);
        ctx.globalAlpha = 1 - ease.inQuad(k);
        ctx.drawImage(fragC.c, f.x - s / 2, f.y - s / 2, s, s);
      }
      ctx.globalAlpha = 1;
      for (let i = 0; i < FLASH.length; i++) {
        const f = FLASH[i];
        if (!f.on) continue;
        const k = f.t / 0.4;
        if (f.kind === 'fis') {
          ctx.globalCompositeOperation = 'lighter';
          draw.glow(ctx, f.x, f.y, G.R * (1.1 + 2.1 * ease.outCubic(k)), '#FFF2C0', 0.85 * (1 - k));
          ctx.globalCompositeOperation = 'source-over';
        } else {
          ctx.fillStyle = `rgba(2,6,14,${0.6 * (1 - k)})`;
          ctx.beginPath();
          ctx.arc(f.x, f.y, 3 + 6 * k, 0, TAU);
          ctx.fill();
        }
      }
      ctx.lineWidth = 1.6;
      for (let i = 0; i < WAVE.length; i++) {
        const wv = WAVE[i];
        if (!wv.on) continue;
        const k = wv.t / wv.dur;
        ctx.strokeStyle = wv.tap ? `rgba(255,255,255,${0.7 * (1 - k)})` : `rgba(190,230,255,${0.5 * (1 - k)})`;
        ctx.beginPath();
        ctx.arc(wv.x, wv.y, lerp(G.R * 0.8, wv.r1, ease.outCubic(k)), 0, TAU);
        ctx.stroke();
      }
      for (let i = 0; i < PUFF.length; i++) {
        const p = PUFF[i];
        if (!p.on) continue;
        const a = 1 - p.t / p.life;
        if (p.dark) {
          ctx.fillStyle = `rgba(150,175,205,${0.55 * a})`;
          ctx.fillRect(p.x - 0.9, p.y - 0.9, 1.8, 1.8);
        } else {
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = `rgba(255,220,150,${0.8 * a})`;
          ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
          ctx.globalCompositeOperation = 'source-over';
        }
      }

      /* neutrons : petits points bleu-blanc avec une traîne */
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      const NS = neuC.w;
      for (let i = 0; i < NEU.length; i++) {
        const m = NEU[i];
        if (!m.on) continue;
        const a = m.out > 0 ? clamp(1 - m.out / 0.2) : 1;
        const tl = m.guided ? 0.07 : 0.1;
        ctx.strokeStyle = m.guided ? '#CDEBFF' : '#7CC4FF';
        ctx.lineWidth = G.nr * 1.2;
        ctx.globalAlpha = 0.18 * a;
        ctx.beginPath();
        ctx.moveTo(m.x - m.vx * tl, m.y - m.vy * tl);
        ctx.lineTo(m.x - m.vx * tl * 0.45, m.y - m.vy * tl * 0.45);
        ctx.stroke();
        ctx.globalAlpha = 0.42 * a;
        ctx.beginPath();
        ctx.moveTo(m.x - m.vx * tl * 0.5, m.y - m.vy * tl * 0.5);
        ctx.lineTo(m.x, m.y);
        ctx.stroke();
        ctx.globalAlpha = a;
        ctx.drawImage(neuC.c, m.x - NS / 2, m.y - NS / 2, NS, NS);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();

      /* jauge de puissance */
      const { gx, gw, gy0, gy1 } = G;
      const ly = lerp(gy1, gy0, level);
      ctx.save();
      draw.roundRect(ctx, gx - gw / 2, gy0, gw, gy1 - gy0, gw / 2);
      ctx.clip();
      ctx.fillStyle = gaugeGrad;
      ctx.fillRect(gx - gw / 2, ly, gw, gy1 - ly);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(gx - gw / 2, ly - 1, gw, 2);
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(gx - gw / 2 + 3, gy0, 2.5, gy1 - gy0);
      ctx.restore();
      ctx.globalCompositeOperation = 'lighter';
      if (zone === 'rouge') draw.glow(ctx, gx, lerp(gy1, gy0, 0.86), gw * 2.6, '#FF4A3A', 0.3 + 0.2 * Math.sin(time * 9));
      else if (zone === 'vert') draw.glow(ctx, gx, ly, gw * 2.2, '#6BE07A', 0.3);
      ctx.globalCompositeOperation = 'source-over';
      const zc = level >= RED_LO ? '#FF7A5E' : level >= GREEN_LO ? '#8BE07A' : '#6CB8FF';
      const px = gx - gw / 2 - 5;
      ctx.fillStyle = zc;
      ctx.beginPath();
      ctx.moveTo(px + 3, ly);
      ctx.lineTo(px - 5, ly - 6);
      ctx.quadraticCurveTo(px - 10, ly, px - 5, ly + 6);
      ctx.closePath();
      ctx.fill();
    }

    api.loop((dt) => {
      update(dt);
      render();
    });

    function init() {
      pos = POS0;
      rate = 0;
      fast = 0;
      level = 0;
      greenT = 0;
      redT = 0;
      started = false;
      afterScram = false;
      scram = null;
      bounceT = -1;
      lastFission = -10;
      emitFlash = 0;
      firstFission = false;
      dragTimer = -1;
      sliderTouched = false;
      grab = null;
      zone = 'bleu';
      clearTimeout(guideTimer);
      slider.classList.remove('is-drag', 'is-locked');
      btn.classList.remove('is-call');
      callOn = false;
      [NEU, FRAG, FLASH, WAVE, PUFF].forEach((arr) => arr.forEach((o) => { o.on = false; }));
      nuclei.forEach((n) => {
        n.state = 'ok';
        n.wait = 0;
        n.grow = 1;
        n.glint = 0;
      });
      shownStatus = null;
      setStatus('');
      shownProg = 0;
      placeHandle();
      const t = nuclei[2 * COLS + 2];
      api.gesture('tap', { x: (t.x / G.w) * 100, y: (t.y / G.h) * 100 });
    }

    if (/[?&]debug\b/.test(location.search)) {
      api.root.__dbg = () => ({ pos, level, rate, fast, zone, flying: inFlight(), greenT, redT, lstar: lstarOf(pos), broken: nuclei.filter((n) => n.state !== 'ok').length });
    }

    cv.onResize(geometry);
    api.onReset(init);
    init();
    update(0.016);
    render();
  };
})();
