/* La cage invisible : dans un tube droit, le plasma file le long des aimants et s'échappe par
   les deux bouts ; refermé en anneau, il tourne sans fin. Mais il dérive vers la paroi : le joueur
   glisse un arc magnétique le long de l'anneau pour le repousser au centre, où il chauffe jusqu'à
   150 000 000 °C. Rien n'explose jamais : un plasma qui touche la paroi pâlit et s'éteint
   calmement, puis on le rallume au palier précédent. */
(function () {
  'use strict';
  const { lib } = window.RM;
  const { TAU, rand, clamp, lerp, ease, rgba, draw } = lib;

  /* Tous les textes du jeu, faciles à corriger */
  const TEXTES = {
    tube: 'Dans un tube droit, le plasma s’échappe par les deux bouts. Tape le tube pour le refermer en anneau !',
    anneau: 'Glisse ton doigt le long de l’anneau : l’aimant repousse le plasma vers le centre.',
    anneauStatut: 'En anneau, le plasma tourne sans fin. Garde-le au centre pour le chauffer.',
    aimants: 'Aimants : −269 °C',
    temperature: 'Température du plasma',
    repereSoleil: '15 000 000 °C',
    repereSoleilNote: 'cœur du Soleil',
    sommet: '150 000 000 °C',
    soleil: '15 000 000 °C : aussi chaud que le cœur du Soleil ! Continue.',
    agite: 'Le plasma s’agite de plus en plus : suis-le avec l’aimant !',
    etincelles: 'De petites étincelles de fusion apparaissent !',
    eteint: 'Plasma éteint : il refroidit en quelques secondes, la réaction s’arrête toute seule.',
    reprise: (v) => `On le rallume : tu reprends à ${v} °C.`,
    fin: '150 000 000 °C : assez chaud pour la fusion ! Ta cage d’aimants tient le plasma au centre.',
    finStatut: '1951 : le stellarator — vers 1958 : le premier tokamak.',
    bravo: '{bravo}',
  };

  const CSS = `
.game[data-game="cage"] .cg-mag {
  position: absolute; z-index: 3; left: 12px; top: 10px; margin: 0;
  display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px 5px 8px;
  border-radius: 11px 14px 12px 10px; background: rgba(6, 18, 46, 0.66);
  box-shadow: inset 0 0 0 1px rgba(95, 212, 255, 0.3);
  font: 700 0.8125rem/1.1 var(--font-text); color: #AEEBFF; white-space: nowrap; pointer-events: none;
}
.game[data-game="cage"] .cg-mag svg { width: 15px; height: 15px; flex: none; }
.game[data-game="cage"] .cg-temp {
  position: absolute; z-index: 3; left: 14px; right: 14px; margin: 0; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis; pointer-events: none;
  font: 600 0.8125rem/1.15 var(--font-text); color: #CFC6F0;
}
.game[data-game="cage"] .cg-temp b { color: #FFC8F1; font-weight: 800; font-variant-numeric: tabular-nums; }
.game[data-game="cage"] .cg-mark {
  position: absolute; z-index: 3; margin: 0; white-space: nowrap; pointer-events: none;
  font: 700 0.75rem/1.25 var(--font-text); color: #E6DEFF; font-variant-numeric: tabular-nums;
}
.game[data-game="cage"] .cg-mark .cg-note { display: block; font-weight: 500; color: #B9ADE0; }
.game[data-game="cage"] .cg-mark--sun .cg-val { display: inline-flex; align-items: center; gap: 4px; }
.game[data-game="cage"] .cg-mark--sun svg { width: 13px; height: 13px; flex: none; }
.game[data-game="cage"] .cg-mark--sun .cg-note { padding-left: 17px; }
.game[data-game="cage"] .cg-mark--top { text-align: right; }
.game[data-game="cage"] .cg-pad {
  position: absolute; z-index: 2; touch-action: none; cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.game[data-game="cage"] .gesture-dot {
  box-shadow: 0 0 0 7px rgba(255, 255, 255, 0.22), 0 0 0 15px rgba(95, 212, 255, 0.3), 0 4px 14px rgba(0, 0, 0, 0.4);
}
`;

  const ICON_FROID = '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6"/>' +
    '<path d="M9.4 3.9 12 6.3l2.6-2.4M9.4 20.1 12 17.7l2.6 2.4M3.6 10.4l3.4.8 1-3.3M20.4 13.6l-3.4-.8-1 3.3M3.6 13.6l3.4-.8 1 3.3M20.4 10.4l-3.4.8-1-3.3"/></g></svg>';
  const ICON_SOLEIL = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5.2" fill="#FFB23F"/>' +
    '<g stroke="#FFC75F" stroke-width="2.2" stroke-linecap="round"><path d="M12 1.8v3.2M12 19v3.2M1.8 12H5M19 12h3.2M4.8 4.8 7 7M17 17l2.2 2.2M4.8 19.2 7 17M17 7l2.2-2.2"/></g></svg>';

  /* Réglages du jeu (schématiques) */
  const NS = 168;               /* points le long du tube */
  const N_COILS = 10;           /* bobines autour de l'anneau */
  const NF = 6;                 /* filaments torsadés du plasma */
  const MORPH = 1.7;            /* durée de la fermeture du tube (s) */
  const AUTO_CLOSE = 14;        /* sans geste, le tube se referme tout seul après ce délai (s) */
  const CENTER_SECONDS = 26;    /* secondes au centre pour monter jusqu'à 150 000 000 °C */
  const SOLEIL = 0.1;           /* 15 000 000 °C sur la jauge */
  const PALIERS = [0.1, 0.4, 0.7];
  const AGITE = 0.55;           /* au-dessus : les dérives accélèrent */
  const ETINCELLES = 0.8;       /* au-dessus : étincelles de fusion */
  const ARC_W = 0.085;          /* demi-largeur de l'arc magnétique (fraction de tour) */
  const BUMP_W = 0.05;          /* largeur d'une dérive (fraction de tour) */
  const PUSH = 1.8;             /* vitesse à laquelle l'aimant repousse une dérive */
  const CENTERED = 0.3;         /* en dessous, le plasma est « au centre » et chauffe */
  const FADE = 2.6, DARK = 0.7, RELIGHT = 1.3;
  const PALE = '#D3CDE6';       /* couleur d'un plasma qui refroidit */

  /* Couches du plasma : [part de l'épaisseur, élargissement (× demi-épaisseur), couleur, opacité] */
  const LAYERS = [
    [1, 0.9, '#5A2AD4', 0.11],
    [1, 0.45, '#9844F0', 0.16],
    [1, 0.16, '#DB57E6', 0.24],
    [1, 0, '#FF6FD8', 0.3],
    [0.66, 0, '#FFA6EA', 0.32],
  ];
  /* rampe d'éclairage d'une paroi d'acier, du bord de la chambre vers l'extérieur */
  const STEEL = ['#20232F', '#5B6278', '#A3ABC3', '#C9CFE0', '#959DB5', '#6A7189', '#454B60', '#2A2D3B'];

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
  const wrapS = (d) => d - Math.round(d);
  const smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  };

  window.RM.games.cage = function (api) {
    api.style(CSS);
    const stage = api.stage;
    const cv = api.canvas();
    const ctx = cv.ctx;
    const AMB = api.reducedMotion ? 0.3 : 1;

    /* ---- éléments DOM : étiquettes et zone tactile de l'anneau ---- */
    function el(tag, cls, html) {
      const e = document.createElement(tag);
      e.className = cls;
      e.setAttribute('aria-hidden', 'true');
      e.innerHTML = html;
      stage.appendChild(e);
      return e;
    }
    const pad = el('div', 'cg-pad', '');
    const magEl = el('p', 'cg-mag', ICON_FROID + '<span></span>');
    magEl.lastChild.textContent = lib.fr(TEXTES.aimants);
    const tempEl = el('p', 'cg-temp', '<span></span><b></b>');
    const tempLab = tempEl.firstChild;
    const tempVal = tempEl.lastChild;
    const markSun = el('p', 'cg-mark cg-mark--sun', '<span class="cg-val">' + ICON_SOLEIL + '<span></span></span><span class="cg-note"></span>');
    markSun.querySelector('.cg-val span').textContent = lib.fr(TEXTES.repereSoleil);
    markSun.querySelector('.cg-note').textContent = TEXTES.repereSoleilNote;
    const markTop = el('p', 'cg-mark cg-mark--top', '<span class="cg-val"></span>');
    markTop.firstChild.textContent = lib.fr(TEXTES.sommet);

    /* ---- géométrie ---- */
    const G = {
      w: 1, h: 1, cx: 0, cy: 0, Rmax: 100, cO: 8, wt: 6, Ro: 80, Ri: 40, hw: 20, Rm: 60, pt: 7, gap: 12,
      Ra: 90, cl: 60, L0: 200, Lj: 30, cwR: 12, cwT: 6, e: 0, L: 200, th: 0, R: 1e9, Cy: 0, closed: false,
      bulbR: 10, gh: 11, gy: 0, bx: 0, gx0: 0, gx1: 1, zoneBottom: 1, thick: 1,
    };
    const PX = new Float32Array(NS + 1), PY = new Float32Array(NS + 1);
    const NX = new Float32Array(NS + 1), NY = new Float32Array(NS + 1);
    const TX = new Float32Array(NS + 1), TY = new Float32Array(NS + 1);
    const OO = new Float32Array(NS + 1), OI = new Float32Array(NS + 1);
    const SP = { x: 0, y: 0, nx: 0, ny: 1, tx: 1, ty: 0 };

    let bg = null, tubeL = null, ringL = null, coilS = null, moteS = null, sparkS = null, gaugeGrad = null;

    /* La ligne centrale du tube : un segment droit qui se courbe en anneau (e de 0 à 1).
       C'est un arc de cercle de longueur L et d'ouverture th, dont le centre de gravité reste fixe. */
    function shape(e) {
      G.e = e;
      G.L = lerp(G.L0, TAU * G.Rm, e);
      G.th = TAU * e;
      G.closed = e >= 0.9999;
      if (G.th > 1e-4) {
        G.R = G.L / G.th;
        const half = G.th / 2;
        G.Cy = G.cy - (G.R * Math.sin(half)) / half;
      }
      for (let i = 0; i <= NS; i++) {
        pointAt(i / NS - 0.5);
        PX[i] = SP.x; PY[i] = SP.y; NX[i] = SP.nx; NY[i] = SP.ny; TX[i] = SP.tx; TY[i] = SP.ty;
      }
    }
    function pointAt(s) {
      if (G.th <= 1e-4) {
        SP.x = G.cx + G.L * s; SP.y = G.cy;
        SP.nx = 0; SP.ny = 1; SP.tx = 1; SP.ty = 0;
        return;
      }
      const a = s * G.th, sn = Math.sin(a), cs = Math.cos(a);
      SP.x = G.cx + G.R * sn; SP.y = G.Cy + G.R * cs;
      SP.nx = sn; SP.ny = cs; SP.tx = cs; SP.ty = -sn;
    }
    /* point du plasma : s le long du tube, f en travers (0 = bord intérieur, 1 = bord extérieur) */
    function sample(s, f) {
      let fi = (s + 0.5) * NS;
      if (G.closed) fi = ((fi % NS) + NS) % NS;
      else fi = clamp(fi, 0, NS - 1e-4);
      const i0 = Math.min(NS - 1, Math.floor(fi)), t = fi - i0, i1 = i0 + 1;
      const o0 = lerp(OI[i0], OO[i0], f), o1 = lerp(OI[i1], OO[i1], f);
      SP.x = lerp(PX[i0] + NX[i0] * o0, PX[i1] + NX[i1] * o1, t);
      SP.y = lerp(PY[i0] + NY[i0] * o0, PY[i1] + NY[i1] * o1, t);
    }
    function sOf(x, y) {
      return Math.atan2(x - G.cx, y - G.cy) / TAU;
    }
    function ringXY(s, r) {
      SP.x = G.cx + r * Math.sin(TAU * s);
      SP.y = G.cy + r * Math.cos(TAU * s);
    }

    function layout(w, h) {
      G.w = w;
      G.h = h;
      /* en bas : la jauge de température et ses repères */
      G.bulbR = clamp(h * 0.024, 8.5, 12);
      G.gh = Math.round(G.bulbR * 1.05);
      const markH = markSun.offsetHeight || 30;
      G.gy = h - 10 - markH - 5 - G.bulbR;
      G.bx = 14 + G.bulbR;
      G.gx0 = G.bx + G.bulbR * 0.55;
      G.gx1 = w - 16;
      const tempH = tempEl.offsetHeight || 16;
      const tempTop = G.gy - G.bulbR - 6 - tempH;
      tempEl.style.top = tempTop + 'px';
      const xs = lerp(G.gx0, G.gx1, SOLEIL);
      markSun.style.left = Math.max(6, xs - 7.5) + 'px';
      markSun.style.top = (G.gy + G.bulbR + 4) + 'px';
      markTop.style.right = Math.max(6, w - G.gx1 - 2) + 'px';
      markTop.style.top = (G.gy + G.bulbR + 4) + 'px';
      G.zoneBottom = tempTop - 6;

      /* l'anneau : le plus grand possible sans toucher l'étiquette des aimants */
      const mb = { l: magEl.offsetLeft, t: magEl.offsetTop, r: magEl.offsetLeft + magEl.offsetWidth, b: magEl.offsetTop + magEl.offsetHeight };
      const top = 6;
      G.cx = w / 2;
      let best = 0, bestCy = (top + G.zoneBottom) / 2;
      for (let k = 0; k <= 14; k++) {
        const cy = (top + G.zoneBottom) / 2 + k * 2;
        let R = Math.min(w / 2 - 6, cy - top, G.zoneBottom - cy);
        const nx = clamp(G.cx, mb.l, mb.r), ny = clamp(cy, mb.t, mb.b);
        R = Math.min(R, Math.hypot(G.cx - nx, cy - ny) - 3);
        if (R > best) { best = R; bestCy = cy; }
      }
      G.cy = bestCy;
      const R = (G.Rmax = clamp(best, 60, 250));
      G.cO = R * 0.07;
      G.wt = clamp(R * 0.068, 7, 16);
      G.Ro = R - G.cO - G.wt;
      G.Ri = R * 0.46;
      G.hw = (G.Ro - G.Ri) / 2;
      G.Rm = (G.Ro + G.Ri) / 2;
      G.pt = G.hw * 0.3;
      G.gap = G.hw - G.pt - 0.6;
      G.Ra = G.Ro + G.wt + G.cO * 0.62;
      G.cl = 2 * (G.hw + G.wt + G.cO * 0.9);
      G.L0 = Math.min(w * 0.7, TAU * G.Rm * 0.62);
      G.Lj = Math.max(24, (w - G.L0) / 2 - 2);
      G.cwR = clamp((TAU * G.Rm) / N_COILS * 0.2, 9, 18);
      G.cwT = clamp((G.L0 / N_COILS) * 0.36, 6, 13);

      const pl = Math.max(0, G.cx - R - 6), pt = Math.max(0, G.cy - R - 6);
      Object.assign(pad.style, {
        left: pl + 'px', top: pt + 'px',
        width: Math.min(w - pl, 2 * R + 12) + 'px',
        height: Math.max(40, Math.min(G.zoneBottom, G.cy + R + 6) - pt) + 'px',
      });
      G.padL = pl;
      G.padT = pt;

      coilS = buildCoil();
      moteS = buildMote();
      sparkS = buildSpark();
      bg = makeBg(w, h);
      shape(0);
      tubeL = mk(w, h, cv.dpr);
      paintVessel(tubeL.g, false, 1);
      shape(1);
      ringL = mk(w, h, cv.dpr);
      paintVessel(ringL.g, true, 0);
      shape(phase === 'ring' ? 1 : phase === 'morph' ? ease.inOutCubic(u) : 0);
      gaugeGrad = ctx.createLinearGradient(G.gx0, 0, G.gx1, 0);
      gaugeGrad.addColorStop(0, '#6F33F2');
      gaugeGrad.addColorStop(0.12, '#B04BF5');
      gaugeGrad.addColorStop(0.45, '#FF5CCE');
      gaugeGrad.addColorStop(0.8, '#FFA4E6');
      gaugeGrad.addColorStop(1, '#FFF0D2');
    }

    /* ---- dessins pré-rendus ---- */
    function makeBg(w, h) {
      const B = mk(w, h, cv.dpr);
      const g = B.g;
      const base = g.createRadialGradient(G.cx, G.cy, 0, G.cx, G.cy, Math.hypot(w, h) * 0.62);
      base.addColorStop(0, '#1B1243');
      base.addColorStop(0.5, '#100A2C');
      base.addColorStop(1, '#06041A');
      g.fillStyle = base;
      g.fillRect(0, 0, w, h);
      const r = seeded(17);
      /* dalle de béton sombre sous la machine : grain et petites taches */
      for (let i = 0; i < Math.round(w * h * 0.012); i++) {
        g.fillStyle = r() < 0.55 ? `rgba(190,170,255,${0.018 + r() * 0.035})` : `rgba(0,0,0,${0.06 + r() * 0.1})`;
        const s = 0.6 + r() * 1.4;
        g.fillRect(r() * w, r() * h, s, s);
      }
      /* plateforme circulaire : anneaux gravés très discrets */
      g.save();
      g.strokeStyle = 'rgba(185,173,224,0.06)';
      g.lineWidth = 1;
      [1.07, 1.16, 1.3].forEach((k) => {
        g.beginPath();
        g.arc(G.cx, G.cy, G.Rmax * k, 0, TAU);
        g.stroke();
      });
      g.setLineDash([2, 7]);
      g.beginPath();
      g.arc(G.cx, G.cy, G.Rmax * 1.22, 0, TAU);
      g.stroke();
      g.setLineDash([]);
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * TAU;
        g.beginPath();
        g.moveTo(G.cx + Math.cos(a) * G.Rmax * 1.08, G.cy + Math.sin(a) * G.Rmax * 1.08);
        g.lineTo(G.cx + Math.cos(a) * G.Rmax * 1.15, G.cy + Math.sin(a) * G.Rmax * 1.15);
        g.stroke();
      }
      g.restore();
      draw.glow(g, G.cx, G.cy, G.Rmax * 1.35, '#4B23A8', 0.3);
      draw.glow(g, G.cx, G.cy, G.Rmax * 0.8, '#7E3BD6', 0.12);
      /* bandeau de la jauge */
      const py = G.zoneBottom + 2;
      const pg = g.createLinearGradient(0, py, 0, h);
      pg.addColorStop(0, 'rgba(6,4,22,0)');
      pg.addColorStop(0.35, 'rgba(6,4,22,0.55)');
      pg.addColorStop(1, 'rgba(6,4,22,0.75)');
      g.fillStyle = pg;
      g.fillRect(0, py, w, h - py);
      paintGaugeGlass(g);
      /* vignette */
      const vg = g.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.4, w / 2, h * 0.45, Math.hypot(w, h) * 0.62);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(2,0,12,0.45)');
      g.fillStyle = vg;
      g.fillRect(0, 0, w, h);
      return B;
    }

    function gaugeTubePath(g, inset) {
      const { bx, gy, gx1, gh, bulbR } = G;
      const r = gh / 2 - inset;
      g.beginPath();
      g.moveTo(bx, gy - r);
      g.lineTo(gx1 - r, gy - r);
      g.arc(gx1 - r, gy, r, -Math.PI / 2, Math.PI / 2);
      g.lineTo(bx, gy + r);
      g.closePath();
      g.moveTo(bx + bulbR - inset, gy);
      g.arc(bx, gy, bulbR - inset, 0, TAU);
    }
    function paintGaugeGlass(g) {
      const { bx, gy, gx0, gx1, gh, bulbR } = G;
      g.save();
      gaugeTubePath(g, -2);
      g.fillStyle = 'rgba(190,175,255,0.16)';
      g.fill('nonzero');
      gaugeTubePath(g, 0);
      g.fillStyle = '#0A0620';
      g.fill('nonzero');
      g.restore();
      /* repères : 15 000 000 °C (cœur du Soleil), paliers, sommet */
      const tick = (t, big, col) => {
        const x = lerp(gx0, gx1, t);
        g.fillStyle = col;
        g.fillRect(x - 0.75, gy + gh / 2 + 2, 1.5, big ? 7 : 4);
        g.fillRect(x - 0.75, gy - gh / 2 - (big ? 7 : 4) - 2, 1.5, big ? 7 : 4);
      };
      PALIERS.forEach((p) => tick(p, p === SOLEIL, p === SOLEIL ? 'rgba(255,190,90,0.9)' : 'rgba(220,210,255,0.45)'));
      tick(1, true, 'rgba(255,240,215,0.85)');
      g.strokeStyle = 'rgba(255,255,255,0.12)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(bx + bulbR * 0.6, gy - gh / 2 + 2.2);
      g.lineTo(gx1 - gh / 2, gy - gh / 2 + 2.2);
      g.stroke();
    }

    /* Une bobine d'aimant : boîtier bleu, spires serrées, givre (elle est à −269 °C).
       La partie qui passe au-dessus de la chambre est en partie transparente. */
    function buildCoil() {
      const cw = G.cwR, cl = G.cl, P = 6;
      const S = mk(cw + P * 2, cl + P * 2, cv.dpr);
      const g = S.g;
      const x0 = P, y0 = P, mid = y0 + cl / 2, hh = G.hw - 1;
      const foot = cl / 2 - hh;
      const rr = Math.min(cw * 0.38, 5);
      const body = (gx, gw) => {
        const gr = g.createLinearGradient(gx, 0, gx + gw, 0);
        gr.addColorStop(0, '#0A2252');
        gr.addColorStop(0.24, '#2563C4');
        gr.addColorStop(0.44, '#7AC8FF');
        gr.addColorStop(0.6, '#3378D8');
        gr.addColorStop(1, '#0A1E48');
        return gr;
      };
      /* ombre portée sur la paroi */
      g.fillStyle = 'rgba(0,0,12,0.42)';
      draw.roundRect(g, x0 + 1.5, y0 + 2.5, cw, foot + 3, rr);
      g.fill();
      draw.roundRect(g, x0 + 1.5, mid + hh - 0.5, cw, foot + 3, rr);
      g.fill();
      /* sangle au-dessus de la chambre : étroite et translucide */
      const sw = cw * 0.46, sx = x0 + (cw - sw) / 2;
      g.globalAlpha = 0.26;
      g.fillStyle = body(sx, sw);
      g.fillRect(sx, mid - hh - 2, sw, 2 * hh + 4);
      g.globalAlpha = 0.4;
      g.fillStyle = '#A9E6FF';
      g.fillRect(sx + sw * 0.4, mid - hh, 0.8, 2 * hh);
      g.globalAlpha = 1;
      /* les deux pieds de la bobine, posés sur les parois */
      g.fillStyle = body(x0, cw);
      draw.roundRect(g, x0, y0, cw, foot + 1, rr);
      g.fill();
      draw.roundRect(g, x0, mid + hh - 1, cw, foot + 1, rr);
      g.fill();
      /* spires serrées */
      g.fillStyle = 'rgba(4,16,44,0.3)';
      for (let y = y0 + 2.5; y < y0 + cl - 2; y += 2.5) {
        if (Math.abs(y - mid) < hh) continue;
        g.fillRect(x0 + 1, y, cw - 2, 0.8);
      }
      g.fillStyle = 'rgba(210,244,255,0.5)';
      g.fillRect(x0 + cw * 0.38, y0 + 2, 1, foot - 3);
      g.fillRect(x0 + cw * 0.38, mid + hh + 1, 1, foot - 3);
      /* un peu de givre : ces aimants sont à −269 °C */
      const r = seeded(5);
      for (let i = 0; i < foot * 1.4; i++) {
        const end = r() < 0.5;
        const y = end ? y0 + r() * foot : mid + hh + r() * foot;
        const x = r() < 0.5 ? x0 + r() * 2 : x0 + cw - r() * 2;
        g.fillStyle = `rgba(232,250,255,${0.18 + r() * 0.4})`;
        const s = 0.6 + r() * 0.8;
        g.fillRect(x - s / 2, y - s / 2, s, s);
      }
      return S;
    }
    function buildMote() {
      const S = mk(16, 16, cv.dpr);
      draw.glow(S.g, 8, 8, 8, '#FF8BE4', 0.55);
      draw.glow(S.g, 8, 8, 3.2, '#FFFFFF', 0.95);
      return S;
    }
    function buildSpark() {
      const S = mk(28, 28, cv.dpr);
      const g = S.g;
      draw.glow(g, 14, 14, 14, '#FFD27A', 0.5);
      draw.glow(g, 14, 14, 5, '#FFFFFF', 1);
      g.strokeStyle = 'rgba(255,248,220,0.95)';
      g.lineWidth = 1.2;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(14, 3); g.lineTo(14, 25);
      g.moveTo(3, 14); g.lineTo(25, 14);
      g.stroke();
      g.lineWidth = 0.8;
      g.beginPath();
      g.moveTo(8, 8); g.lineTo(20, 20);
      g.moveTo(20, 8); g.lineTo(8, 20);
      g.stroke();
      return S;
    }

    /* La chambre (tube ou anneau) : paroi d'acier, fond sombre carrelé, ombre portée. */
    function pathOffset(g, off) {
      const n = G.closed ? NS : NS + 1;
      g.beginPath();
      for (let i = 0; i < n; i++) {
        const x = PX[i] + NX[i] * off, y = PY[i] + NY[i] * off;
        if (i) g.lineTo(x, y);
        else g.moveTo(x, y);
      }
      if (G.closed) g.closePath();
    }
    function paintVessel(g, closed, flangeA) {
      const { hw, wt } = G;
      g.save();
      g.lineJoin = 'round';
      g.lineCap = 'butt';
      g.save();
      g.translate(2.5, 6);
      pathOffset(g, 0);
      g.strokeStyle = 'rgba(2,0,10,0.32)';
      g.lineWidth = 2 * (hw + wt) + 12;
      g.stroke();
      g.strokeStyle = 'rgba(2,0,10,0.4)';
      g.lineWidth = 2 * (hw + wt) + 3;
      g.stroke();
      g.restore();
      /* paroi d'acier bombée : une rampe de lumière en travers de son épaisseur */
      const nS = STEEL.length, bw = wt / nS;
      for (let sd = -1; sd <= 1; sd += 2) {
        for (let k = 0; k < nS; k++) {
          pathOffset(g, sd * (hw + (k + 0.5) * bw));
          g.strokeStyle = STEEL[k];
          g.lineWidth = bw + 0.7;
          g.stroke();
        }
      }
      /* fines rayures du métal brossé */
      g.strokeStyle = 'rgba(255,255,255,0.05)';
      g.lineWidth = 0.6;
      for (let sd = -1; sd <= 1; sd += 2) {
        [0.3, 0.62, 0.8].forEach((k) => {
          pathOffset(g, sd * (hw + k * wt));
          g.stroke();
        });
      }
      pathOffset(g, 0);
      g.strokeStyle = '#120B2C';
      g.lineWidth = 2 * hw;
      g.stroke();
      /* lueur violette résiduelle sur le fond de la chambre */
      pathOffset(g, 0);
      g.strokeStyle = 'rgba(120,60,220,0.08)';
      g.lineWidth = hw * 1.1;
      g.stroke();
      /* carreaux de la première paroi */
      g.strokeStyle = 'rgba(175,155,255,0.07)';
      g.lineWidth = 1;
      [-0.34, 0.34].forEach((k) => {
        pathOffset(g, k * hw);
        g.stroke();
      });
      const nT = Math.round(G.L / 11);
      g.beginPath();
      for (let k = 0; k < nT; k++) {
        const i = Math.round((k / nT) * NS);
        g.moveTo(PX[i] - NX[i] * hw, PY[i] - NY[i] * hw);
        g.lineTo(PX[i] + NX[i] * hw, PY[i] + NY[i] * hw);
      }
      g.stroke();
      for (let sd = -1; sd <= 1; sd += 2) {
        pathOffset(g, sd * (hw - 2));
        g.strokeStyle = 'rgba(0,0,0,0.38)';
        g.lineWidth = 4;
        g.stroke();
      }
      g.restore();
      if (!closed && flangeA > 0.01) {
        for (let sd = -1; sd <= 1; sd += 2) {
          const i = sd < 0 ? 0 : NS;
          const a = Math.atan2(TY[i], TX[i]);
          g.save();
          g.globalAlpha = flangeA;
          g.translate(PX[i], PY[i]);
          g.rotate(a);
          const fh = 2 * (hw + wt) + 10, fw = 7;
          const fg = g.createLinearGradient(-fw / 2, 0, fw / 2, 0);
          fg.addColorStop(0, '#3B4055');
          fg.addColorStop(0.45, '#A9B1C9');
          fg.addColorStop(1, '#3A3F53');
          g.fillStyle = 'rgba(2,0,10,0.35)';
          draw.roundRect(g, -fw / 2 + 2, -fh / 2 + 4, fw, fh, 2.5);
          g.fill();
          g.fillStyle = fg;
          draw.roundRect(g, -fw / 2, -fh / 2, fw, fh, 2.5);
          g.fill();
          g.restore();
        }
      }
    }

    /* ---- état ---- */
    let phase = 'tube';     /* 'tube' | 'morph' | 'ring' */
    let u = 0, tubeT = 0;
    let T = 0;              /* température : 0 → 1 (= 150 000 000 °C) */
    let palier = 0, fadeFrom = 0;
    let plasma = 'on';      /* 'on' | 'fade' | 'dark' | 'relight' */
    let pT = 0, life = 1, paleK = 0, heatGlow = 0;
    let phi = 0.25, phiT = 0.25, arcHot = 0, pushing = 0, arcIn = 0;
    let dragging = false, won = false, wonT = 0;
    let flags = {};
    let time = 0;
    let shownTemp = '', shownLab = '';
    const bump = { on: false, s: 0, A: 0, drift: 0, wait: 2, peak: 0.5, rec: false };
    const contact = { t: -1, x: 0, y: 0 };

    const pool = (n, make) => Array.from({ length: n }, make);
    const MOTES = pool(60, () => ({ s: 0, f: 0.5, v: 0, size: 1, a: 1, j: -1, tw: 0 }));
    const KNOTS = pool(6, () => ({ s: 0, v: 0, tw: 0, j: -1 }));
    const STR = (() => {
      const r = seeded(29);
      return Array.from({ length: NF }, (_, j) => ({
        amp: 0.32 + r() * 0.12, rate: 0.8 + r() * 0.4, ph0: (TAU * j) / NF + r() * 0.5,
        nz: 0.12 + r() * 0.3, k: 1 + Math.floor(r() * 3), w: 1.1 + r() * 0.6, a: 0.24 + r() * 0.16,
      }));
    })();
    const SPARKS = pool(24, () => ({ on: false, s: 0, f: 0.5, t: 0, life: 0.5, size: 1 }));
    const BITS = pool(36, () => ({ on: false, x: 0, y: 0, vx: 0, vy: 0, t: 0, life: 0.6 }));
    const RIPPLES = pool(6, () => ({ on: false, x: 0, y: 0, t: 0 }));
    function take(arr) {
      for (let i = 0; i < arr.length; i++) if (!arr[i].on) return arr[i];
      return null;
    }

    function spawnMote(m, inner) {
      if (G.closed) {
        m.s = rand(-0.5, 0.5);
        m.v = (Math.random() < 0.5 ? -1 : 1) * rand(0.018, 0.05);
      } else {
        m.s = inner ? rand(-0.16, 0.16) : rand(-0.5, 0.5);
        m.v = (m.s < 0 ? -1 : 1) * rand(0.11, 0.24);
      }
      m.f = rand(0.12, 0.88);
      m.size = rand(0.6, 1.5);
      m.a = rand(0.45, 1);
      m.j = -1;
      m.tw = rand(TAU);
    }

    function spawnKnot(kn, i) {
      kn.s = G.closed ? i / KNOTS.length - 0.5 + rand(-0.04, 0.04) : rand(-0.1, 0.1);
      kn.v = G.closed ? (i % 2 ? 1 : -1) * rand(0.012, 0.03) : (kn.s < 0 ? -1 : 1) * rand(0.05, 0.09);
      kn.tw = rand(TAU);
      kn.j = -1;
    }

    const fmtT = (t) => lib.num(Math.round(t * 150) * 1000000);

    function setLabels() {
      const lab = T >= 0.0067 ? lib.fr(TEXTES.temperature + ' :') + ' ' : TEXTES.temperature;
      const val = T >= 0.0067 ? fmtT(T) + ' °C' : '';
      if (lab !== shownLab) { tempLab.textContent = lab; shownLab = lab; }
      if (val !== shownTemp) { tempVal.textContent = val; shownTemp = val; }
    }

    /* ---- gestes ---- */
    function ripple(x, y) {
      const r = take(RIPPLES);
      if (!r) return;
      r.on = true;
      r.x = x;
      r.y = y;
      r.t = 0;
    }
    function startMorph() {
      if (phase !== 'tube') return;
      phase = 'morph';
      u = 0;
      api.sfx.play('whoosh', { pitch: 0.8 });
    }
    function ringReady() {
      phase = 'ring';
      u = 1;
      shape(1);
      MOTES.forEach((m) => { if (m.j >= 0) spawnMote(m, false); });
      KNOTS.forEach(spawnKnot);
      bump.on = false;
      bump.wait = 2.2;
      api.sfx.play('chime', { pitch: 0.9 });
      api.hint(TEXTES.anneau);
      api.status(TEXTES.anneauStatut);
      showRingGesture();
    }
    function showRingGesture() {
      if (api.reducedMotion) {
        /* animations réduites : le doigt fantôme reste immobile, on montre une tape sur l'anneau */
        ringXY(wrapS(phi + 0.5), G.Ra);
        api.gesture('tap', { x: (SP.x / G.w) * 100, y: (SP.y / G.h) * 100 });
      } else {
        api.gesture('circle', { x: (G.cx / G.w) * 100, y: (G.cy / G.h) * 100, radius: Math.round(G.Ra) });
      }
    }
    function aim(x, y) {
      if (Math.hypot(x - G.cx, y - G.cy) < 6) return;
      phiT = sOf(x, y);
      arcHot = 1;
    }
    api.track(pad, {
      down(p) {
        const x = p.x + G.padL, y = p.y + G.padT;
        ripple(x, y);
        api.buzz(8);
        if (phase === 'tube') {
          startMorph();
          return;
        }
        if (phase === 'ring') {
          dragging = true;
          aim(x, y);
          api.sfx.play('tick', { pitch: 1.2, volume: 0.6 });
        }
      },
      move(p) {
        if (!dragging || phase !== 'ring') return;
        aim(p.x + G.padL, p.y + G.padT);
      },
      up() {
        dragging = false;
      },
    }, { touchAction: 'none' });

    /* ---- la partie ---- */
    function spawnBump() {
      bump.on = true;
      bump.s = wrapS(phi + 0.5 + rand(-0.3, 0.3));
      bump.A = 0.04;
      bump.peak = rand(0.35, 0.55);
      bump.rec = false;
      const k = clamp((T - AGITE) / (1 - AGITE));
      bump.drift = T > AGITE ? (Math.random() < 0.5 ? -1 : 1) * rand(0.012, 0.03) * (0.6 + k) : 0;
    }
    function clearBump(byArc) {
      bump.on = false;
      bump.A = 0;
      bump.wait = lerp(1.5, 0.55, T) * rand(0.8, 1.2) * (won ? 2 : 1);
      if (!byArc) return;
      api.sfx.play('bubble', { pitch: 1.25, volume: 0.6 });
      ringXY(bump.s, G.Ro - 2);
      for (let i = 0; i < 8; i++) {
        const b = take(BITS);
        if (!b) break;
        const a = rand(TAU);
        b.on = true;
        b.x = SP.x;
        b.y = SP.y;
        b.vx = Math.cos(a) * rand(15, 40);
        b.vy = Math.sin(a) * rand(15, 40);
        b.t = 0;
        b.life = rand(0.4, 0.7);
      }
    }
    function touchWall() {
      plasma = 'fade';
      pT = 0;
      fadeFrom = T;
      palier = 0;
      PALIERS.forEach((p) => { if (T >= p) palier = p; });
      ringXY(bump.s, G.Ro);
      contact.t = 0;
      contact.x = SP.x;
      contact.y = SP.y;
      bump.A = 1;
      api.status(TEXTES.eteint);
      api.sfx.play('thud', { volume: 0.35, pitch: 0.8 });
      api.sfx.play('wind', { pitch: 0.6, volume: 0.7 });
      api.buzz(12);
    }
    function win() {
      won = true;
      wonT = 0;
      T = 1;
      api.done(TEXTES.fin, TEXTES.finStatut);
      api.guide(null, 'laugh', TEXTES.bravo);
      for (let i = 0; i < 14; i++) spark(true);
    }
    function spark(big) {
      const s = take(SPARKS);
      if (!s) return;
      s.on = true;
      s.s = rand(-0.5, 0.5);
      s.f = rand(0.25, 0.75);
      s.t = 0;
      s.life = rand(0.35, 0.6) * (big ? 1.5 : 1);
      s.size = rand(0.7, 1.2) * (big ? 1.4 : 1);
      if (Math.random() < 0.4) api.sfx.play('tick', { pitch: rand(1.6, 2.2), volume: 0.35, gap: 140 });
    }

    function updateRing(dt) {
      if (plasma === 'on') {
        const g0 = lerp(0.11, 0.22, T);
        if (!bump.on) {
          bump.wait -= dt;
          if (bump.wait <= 0) spawnBump();
        } else {
          if (bump.drift) bump.s = wrapS(bump.s + bump.drift * dt);
          const d = Math.abs(wrapS(bump.s - phi));
          const covered = d < ARC_W + BUMP_W * 0.6;
          if (covered) {
            bump.A -= PUSH * dt;
            pushing = Math.min(1, pushing + dt * 8);
          } else if (won) {
            /* après la victoire, les dérives restent sages : elles montent un peu puis retombent */
            if (bump.A >= bump.peak) bump.rec = true;
            bump.A += (bump.rec ? -0.3 : g0 * 0.6) * dt;
          } else {
            bump.A += g0 * (1 + 1.6 * bump.A) * dt;
          }
          if (bump.A <= 0) clearBump(covered);
          else if (bump.A >= 1) touchWall();
        }
        const centered = !bump.on || bump.A < CENTERED;
        heatGlow = lerp(heatGlow, centered ? 1 : 0, 1 - Math.exp(-dt * 6));
        if (centered && !won) {
          T = Math.min(1, T + dt / CENTER_SECONDS);
          if (!flags.soleil && T >= SOLEIL) {
            flags.soleil = true;
            api.status(TEXTES.soleil);
            api.sfx.play('chime', { pitch: 1.1 });
          }
          if (!flags.agite && T >= AGITE) {
            flags.agite = true;
            api.hint(TEXTES.agite);
          }
          if (!flags.etincelles && T >= ETINCELLES) {
            flags.etincelles = true;
            api.status(TEXTES.etincelles);
          }
          PALIERS.forEach((p, i) => {
            if (T >= p && !flags['p' + i]) {
              flags['p' + i] = true;
              if (p !== SOLEIL) api.sfx.play('chime', { pitch: 1 + i * 0.12, volume: 0.6 });
            }
          });
          if (T >= 1) win();
        }
        life = 1;
        paleK = 0;
        G.thick = 1;
      } else if (plasma === 'fade') {
        pT += dt;
        const k = clamp(pT / FADE);
        life = 1 - ease.inOutSine(k);
        paleK = clamp(k * 1.7);
        G.thick = lerp(1, 0.78, k);
        T = lerp(fadeFrom, palier, ease.inOutSine(k));
        heatGlow *= Math.exp(-dt * 3);
        if (k >= 1) {
          plasma = 'dark';
          pT = 0;
          bump.on = false;
          T = palier;
        }
      } else if (plasma === 'dark') {
        pT += dt;
        life = 0;
        if (pT >= DARK) {
          plasma = 'relight';
          pT = 0;
          paleK = 0;
          api.sfx.play('whoosh', { pitch: 1.3, volume: 0.5 });
        }
      } else if (plasma === 'relight') {
        pT += dt;
        const k = clamp(pT / RELIGHT);
        life = ease.outCubic(k);
        G.thick = lerp(0.18, 1, ease.outCubic(k));
        if (k >= 1) {
          plasma = 'on';
          bump.wait = 1.8;
          api.status(TEXTES.reprise(fmtT(T)));
        }
      }
    }

    function computeBand() {
      const taper = 1 - G.e;
      const tt = time * AMB;
      for (let i = 0; i <= NS; i++) {
        const s = i / NS - 0.5;
        let k = 1 + 0.07 * Math.sin(s * TAU * 4 + tt * 1.1) + 0.05 * Math.sin(s * TAU * 9 - tt * 1.9);
        if (taper > 0) k *= 1 - taper * 0.3 * (2 * s) * (2 * s);
        k *= G.thick;
        let D = 0;
        if (bump.on && G.closed) {
          const q = wrapS(s - bump.s) / BUMP_W;
          D = bump.A * G.gap * Math.exp(-q * q);
        }
        OO[i] = Math.min(G.pt * k + D, G.hw - 0.6);
        OI[i] = Math.max(-G.pt * k + 0.35 * D, -G.hw + 0.6);
      }
    }

    function update(dt) {
      time += dt;
      phi = wrapS(phi + wrapS(phiT - phi) * (1 - Math.exp(-dt / 0.07)));
      arcHot = Math.max(0, arcHot - dt * (dragging ? 0 : 1.6));
      if (dragging) arcHot = 1;
      pushing = Math.max(0, pushing - dt * 3);
      if (phase === 'tube') {
        tubeT += dt;
        life = 1;
        if (tubeT > AUTO_CLOSE) startMorph();
      } else if (phase === 'morph') {
        u = Math.min(1, u + dt / MORPH);
        shape(ease.inOutCubic(u));
        if (u >= 1) ringReady();
      }
      arcIn = phase === 'ring' ? Math.min(1, arcIn + dt * 2.5) : 0;
      if (phase === 'ring') updateRing(dt);
      else heatGlow = 0;
      if (won) wonT += dt;
      computeBand();

      for (let i = 0; i < MOTES.length; i++) {
        const m = MOTES[i];
        if (m.j < 0) {
          m.s += m.v * dt * (0.4 + 0.6 * AMB) * (0.3 + 0.7 * life);
          if (G.closed) {
            if (m.s > 0.5) m.s -= 1;
            else if (m.s < -0.5) m.s += 1;
          } else if (m.s > 0.5 || m.s < -0.5) {
            m.j = 0;
          }
        } else {
          m.j += (Math.abs(m.v) * G.L * 1.4 + 26) * dt;
          if (m.j > G.Lj || G.closed) spawnMote(m, true);
        }
      }
      for (let i = 0; i < KNOTS.length; i++) {
        const kn = KNOTS[i];
        kn.s += kn.v * dt * (0.4 + 0.6 * AMB) * (0.3 + 0.7 * life);
        if (G.closed) {
          if (kn.s > 0.5) kn.s -= 1;
          else if (kn.s < -0.5) kn.s += 1;
        } else if (Math.abs(kn.s) > 0.5) {
          spawnKnot(kn, i);
        }
      }
      if (phase === 'ring' && plasma === 'on' && (T > ETINCELLES || won)) {
        const rate = won ? 6 : 2 + 8 * (T - ETINCELLES) / (1 - ETINCELLES);
        if (Math.random() < rate * dt * (api.reducedMotion ? 0.5 : 1)) spark(false);
      }
      for (let i = 0; i < SPARKS.length; i++) {
        const s = SPARKS[i];
        if (s.on && (s.t += dt) >= s.life) s.on = false;
      }
      if (pushing > 0.3 && plasma !== 'dark' && Math.random() < dt * 30) {
        const b = take(BITS);
        if (b) {
          const s = phi + rand(-ARC_W, ARC_W) * 0.9;
          ringXY(s, G.Ra - 2);
          b.on = true;
          b.x = SP.x;
          b.y = SP.y;
          const sp = rand(40, 75);
          b.vx = -Math.sin(TAU * s) * sp;
          b.vy = -Math.cos(TAU * s) * sp;
          b.t = 0;
          b.life = rand(0.35, 0.55);
        }
      }
      for (let i = 0; i < BITS.length; i++) {
        const b = BITS[i];
        if (!b.on) continue;
        b.t += dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.t >= b.life) b.on = false;
      }
      for (let i = 0; i < RIPPLES.length; i++) {
        const r = RIPPLES[i];
        if (r.on && (r.t += dt) >= 0.6) r.on = false;
      }
      if (contact.t >= 0) {
        contact.t += dt;
        if (contact.t > 2.2) contact.t = -1;
      }
      const pg = Math.round(T * 200) / 200;
      if (pg !== update.pg) {
        update.pg = pg;
        if (!won) api.progress(pg);
      }
      setLabels();
    }

    /* ---- rendu ---- */
    function pcol(hex, a) {
      return paleK > 0.001 ? lib.mix(hex, PALE, paleK, a) : rgba(hex, a);
    }
    function glowP(x, y, r, hex, a) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, pcol(hex, a));
      g.addColorStop(1, pcol(hex, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }
    function bandPath(frac, ex) {
      const lim = G.hw - 0.6;
      const n = G.closed ? NS : NS + 1;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const mid = (OO[i] + OI[i]) / 2;
        const o = Math.min(mid + (OO[i] - mid) * frac + ex, lim);
        const x = PX[i] + NX[i] * o, y = PY[i] + NY[i] * o;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      if (G.closed) ctx.closePath();
      for (let i = n - 1; i >= 0; i--) {
        const mid = (OO[i] + OI[i]) / 2;
        const o = Math.max(mid - (mid - OI[i]) * frac - ex, -lim);
        const x = PX[i] + NX[i] * o, y = PY[i] + NY[i] * o;
        if (G.closed && i === n - 1) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    }

    function drawJet(sd, B) {
      const i = sd < 0 ? 0 : NS;
      const ex = PX[i], ey = PY[i];
      const dx = TX[i] * sd, dy = TY[i] * sd;
      const nx = NX[i], ny = NY[i];
      const Lj = G.Lj * (0.86 + 0.14 * Math.sin(time * 3.1 * AMB + sd));
      const oo = OO[i], oi = OI[i];
      glowP(ex + dx * Lj * 0.22, ey + dy * Lj * 0.22, G.pt * 3.6, '#E46BF0', 0.16 * B);
      const ends = [[1.3, 3.0, '#8B3FF0', 0.22], [0.6, 2.4, '#E05BE8', 0.3], [0, 1.8, '#FFC2F0', 0.36]];
      for (let k = 0; k < 3; k++) {
        const [e, spread, col, a0] = ends[k];
        const a = a0 * B;
        const eo = oo + e * G.pt, ei = oi - e * G.pt;
        const gr = ctx.createLinearGradient(ex, ey, ex + dx * Lj, ey + dy * Lj);
        gr.addColorStop(0, pcol(col, a));
        gr.addColorStop(0.5, pcol(col, a * 0.38));
        gr.addColorStop(1, pcol(col, 0));
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.moveTo(ex + nx * eo, ey + ny * eo);
        ctx.quadraticCurveTo(ex + dx * Lj * 0.55 + nx * eo * (1 + spread) * 0.5, ey + dy * Lj * 0.55 + ny * eo * (1 + spread) * 0.5,
          ex + dx * Lj + nx * eo * spread, ey + dy * Lj + ny * eo * spread);
        ctx.lineTo(ex + dx * Lj + nx * ei * spread, ey + dy * Lj + ny * ei * spread);
        ctx.quadraticCurveTo(ex + dx * Lj * 0.55 + nx * ei * (1 + spread) * 0.5, ey + dy * Lj * 0.55 + ny * ei * (1 + spread) * 0.5,
          ex + nx * ei, ey + ny * ei);
        ctx.closePath();
        ctx.fill();
      }
      ctx.lineWidth = 1;
      for (let j = 0; j < 7; j++) {
        const o = lerp(oi, oo, 0.08 + 0.84 * (j / 6));
        const wob = Math.sin(time * 2.6 * AMB + j * 1.9 + sd) * 6;
        const gr = ctx.createLinearGradient(ex, ey, ex + dx * Lj, ey + dy * Lj);
        gr.addColorStop(0, pcol('#FFE3F8', 0.62 * B));
        gr.addColorStop(1, pcol('#FFE3F8', 0));
        ctx.strokeStyle = gr;
        ctx.beginPath();
        ctx.moveTo(ex + nx * o, ey + ny * o);
        ctx.quadraticCurveTo(ex + dx * Lj * 0.5 + nx * (o * 1.5 + wob), ey + dy * Lj * 0.5 + ny * (o * 1.5 + wob),
          ex + dx * Lj * 0.98 + nx * (o * 2.9 + wob * 1.6), ey + dy * Lj * 0.98 + ny * (o * 2.9 + wob * 1.6));
        ctx.stroke();
      }
    }

    /* dans le tube droit, les lignes du champ magnétique sortent par les bouts : le plasma les suit */
    function drawFieldLines() {
      const k = phase === 'tube' ? 1 : phase === 'morph' ? 1 - smooth(0.3, 0.85, u) : 0;
      if (k <= 0.01) return;
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineWidth = 1;
      ctx.strokeStyle = rgba('#5FD4FF', 0.26 * k);
      const offs = [-0.72, -0.28, 0.28, 0.72];
      for (let j = 0; j < offs.length; j++) {
        const o = offs[j] * G.hw;
        ctx.beginPath();
        for (let sd = -1; sd <= 1; sd += 2) {
          const i = sd < 0 ? 0 : NS;
          const dx = TX[i] * sd, dy = TY[i] * sd;
          const ex = PX[i] + NX[i] * o, ey = PY[i] + NY[i] * o;
          const L = G.Lj * 1.15;
          if (sd < 0) {
            ctx.moveTo(ex + dx * L + NX[i] * o * 2.6, ey + dy * L + NY[i] * o * 2.6);
            ctx.quadraticCurveTo(ex + dx * L * 0.5 + NX[i] * o * 0.6, ey + dy * L * 0.5 + NY[i] * o * 0.6, ex, ey);
            for (let n = 1; n <= NS; n++) ctx.lineTo(PX[n] + NX[n] * o, PY[n] + NY[n] * o);
          } else {
            ctx.quadraticCurveTo(ex + dx * L * 0.5 + NX[i] * o * 0.6, ey + dy * L * 0.5 + NY[i] * o * 0.6,
              ex + dx * L + NX[i] * o * 2.6, ey + dy * L + NY[i] * o * 2.6);
          }
        }
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    function drawPlasma() {
      if (life <= 0.002) return;
      const heat = phase === 'ring' ? T : 0;
      const B = life * (G.closed ? 1 : 0.88) * (0.82 + 0.18 * heat);
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < LAYERS.length; k++) {
        const [frac, ex, col, a] = LAYERS[k];
        bandPath(frac, ex * G.pt);
        ctx.fillStyle = pcol(col, a * B);
        ctx.fill('evenodd');
      }
      bandPath(0.34, 0);
      ctx.fillStyle = pcol('#FFF2FB', (0.22 + 0.26 * heat + 0.1 * heatGlow) * B);
      ctx.fill('evenodd');

      /* filaments torsadés : le plasma s'enroule le long des lignes de champ */
      const twist = lerp(5, 9, G.e);
      const flow = time * 2.2 * AMB * (0.3 + 0.7 * life);
      const tn = time * 0.7 * AMB;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let j = 0; j < NF; j++) {
        const st = STR[j];
        for (let pass = 0; pass < 2; pass++) {
          const front = pass === 1;
          ctx.beginPath();
          let pen = false;
          for (let i = 0; i <= NS; i++) {
            const s = i / NS - 0.5;
            const ph = twist * TAU * s + flow * st.rate + st.ph0 + st.nz * Math.sin(TAU * s * st.k + st.ph0 * 2 + tn);
            const z = Math.cos(ph);
            if ((z >= 0) !== front) { pen = false; continue; }
            const o = lerp(OI[i], OO[i], 0.5 + st.amp * Math.sin(ph));
            const x = PX[i] + NX[i] * o, y = PY[i] + NY[i] * o;
            if (pen) ctx.lineTo(x, y);
            else { ctx.moveTo(x, y); pen = true; }
          }
          ctx.strokeStyle = pcol(front ? '#FFE6F9' : '#E58CFF', (front ? st.a : st.a * 0.32) * B);
          ctx.lineWidth = front ? st.w : st.w * 0.7;
          ctx.stroke();
        }
      }
      /* nœuds plus chauds qui voyagent avec le plasma */
      for (let i = 0; i < KNOTS.length; i++) {
        const kn = KNOTS[i];
        if (kn.j >= 0) continue;
        sample(kn.s, 0.5);
        let a = 0.2 * B * (0.7 + 0.3 * Math.sin(time * 2 + kn.tw));
        if (!G.closed) a *= 1 - smooth(0.36, 0.5, Math.abs(kn.s));
        if (a > 0.01) glowP(SP.x, SP.y, G.pt * 2.8, '#FF9FE6', a);
      }
      ctx.beginPath();
      for (let i = 0; i <= NS; i++) {
        const o = lerp(OI[i], OO[i], 0.5 + 0.05 * Math.sin((i / NS) * TAU * 7 + time * 3 * AMB));
        const x = PX[i] + NX[i] * o, y = PY[i] + NY[i] * o;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.strokeStyle = pcol('#FFFFFF', (0.18 + 0.3 * heat) * B);
      ctx.lineWidth = 1.6;
      ctx.stroke();

      if (!G.closed) {
        const jk = phase === 'morph' ? 1 - smooth(0.5, 0.9, u) : 1;
        if (jk > 0.01) {
          drawJet(-1, B * jk);
          drawJet(1, B * jk);
        }
      }

      /* grains lumineux qui filent le long du tube */
      const MS = moteS.w;
      for (let i = 0; i < MOTES.length; i++) {
        const m = MOTES[i];
        let a = m.a * B * (0.7 + 0.3 * Math.sin(time * 4 + m.tw));
        if (m.j < 0) {
          sample(m.s, m.f);
        } else {
          const e = m.s < 0 ? 0 : NS, sd = m.s < 0 ? -1 : 1;
          const k = m.j / G.Lj;
          const o = lerp(OI[e], OO[e], m.f) * (1 + k * 1.6);
          SP.x = PX[e] + TX[e] * sd * m.j + NX[e] * o;
          SP.y = PY[e] + TY[e] * sd * m.j + NY[e] * o;
          a *= (1 - k) * (phase === 'morph' ? 1 - smooth(0.5, 0.9, u) : 1);
        }
        if (a < 0.02) continue;
        const sz = MS * m.size;
        ctx.globalAlpha = Math.min(1, a);
        ctx.drawImage(moteS.c, SP.x - sz / 2, SP.y - sz / 2, sz, sz);
      }
      ctx.globalAlpha = 1;

      /* étincelles de fusion */
      const SS = sparkS.w;
      for (let i = 0; i < SPARKS.length; i++) {
        const s = SPARKS[i];
        if (!s.on) continue;
        const k = s.t / s.life;
        sample(s.s, s.f);
        const sz = SS * s.size * (0.6 + 0.9 * Math.sin(Math.PI * Math.min(1, k * 1.4)));
        ctx.globalAlpha = (1 - k) * life;
        ctx.drawImage(sparkS.c, SP.x - sz / 2, SP.y - sz / 2, sz, sz);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    /* la paroi s'éclaire en rose là où le plasma s'approche */
    function drawWarning() {
      if (!bump.on || phase !== 'ring' || life < 0.02) return;
      const k = clamp((bump.A - 0.12) / 0.88);
      if (k <= 0) return;
      ctx.globalCompositeOperation = 'lighter';
      const pulse = 0.78 + 0.22 * Math.sin(time * 7);
      /* la paroi rosit là où le plasma s'approche */
      ringXY(bump.s, G.Ro + G.wt * 0.35);
      glowP(SP.x, SP.y, G.hw * (0.8 + 0.9 * k), '#FF77D6', 0.5 * k * pulse * life);
      const a0 = Math.PI / 2 - TAU * (bump.s + BUMP_W * 1.5), a1 = Math.PI / 2 - TAU * (bump.s - BUMP_W * 1.5);
      ctx.strokeStyle = pcol('#FFC2F0', 0.75 * k * pulse * life);
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(G.cx, G.cy, G.Ro + 0.8, a0, a1);
      ctx.stroke();
      /* repère pointillé : c'est ici qu'il faut amener l'aimant */
      const d = Math.abs(wrapS(bump.s - phi));
      if (plasma === 'on' && d > ARC_W * 0.6) {
        const b0 = Math.PI / 2 - TAU * (bump.s + ARC_W * 0.8), b1 = Math.PI / 2 - TAU * (bump.s - ARC_W * 0.8);
        ctx.setLineDash([3, 6]);
        ctx.lineDashOffset = -time * 14;
        ctx.strokeStyle = rgba('#BDF1FF', 0.75 * clamp(k * 2) * pulse);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(G.cx, G.cy, G.Ra, b0, b1);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    function drawCoils() {
      const k = phase === 'ring' ? 1 : G.e;
      const cw = lerp(G.cwT, G.cwR, k);
      const sx = cw / G.cwR;
      const dpr = cv.dpr;
      for (let c = 0; c < N_COILS; c++) {
        pointAt((c + 0.5) / N_COILS - 0.5);
        const a = Math.atan2(SP.ny, SP.nx) - Math.PI / 2;
        const ca = Math.cos(a), sa = Math.sin(a);
        ctx.setTransform(dpr * ca, dpr * sa, -dpr * sa, dpr * ca, dpr * SP.x, dpr * SP.y);
        ctx.drawImage(coilS.c, (-coilS.w * sx) / 2, -coilS.h / 2, coilS.w * sx, coilS.h);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function arcStroke(r, a0, a1, wdt, col, a) {
      ctx.strokeStyle = rgba(col, a);
      ctx.lineWidth = wdt;
      ctx.beginPath();
      ctx.arc(G.cx, G.cy, r, a0, a1);
      ctx.stroke();
    }
    /* l'arc magnétique du joueur, et ses lignes de champ qui appuient sur le plasma */
    function drawArc() {
      if (arcIn <= 0) return;
      const vis = ease.outCubic(arcIn);
      const span = ARC_W * vis;
      const a0 = Math.PI / 2 - TAU * (phi + span), a1 = Math.PI / 2 - TAU * (phi - span);
      const hot = (0.62 + 0.38 * Math.max(arcHot, pushing)) * vis;
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      /* zone où l'aimant appuie : une nappe bleue le long de la paroi */
      const f0 = Math.PI / 2 - TAU * (phi + span * 0.9), f1 = Math.PI / 2 - TAU * (phi - span * 0.9);
      arcStroke(G.Ro - G.hw * 0.2, f0, f1, G.hw * 0.55, '#5FD4FF', (0.035 + 0.06 * pushing) * hot);
      arcStroke(G.Ro - G.hw * 0.1, f0, f1, G.hw * 0.26, '#8FE4FF', (0.04 + 0.08 * pushing) * hot);
      arcStroke(G.Ra, a0, a1, 30, '#2B86FF', 0.14 * hot);
      arcStroke(G.Ra, a0, a1, 15, '#5FD4FF', 0.3 * hot);
      arcStroke(G.Ra, a0, a1, 7, '#BDF1FF', 0.75 * hot);
      arcStroke(G.Ra, a0, a1, 2.6, '#FFFFFF', 0.92 * vis);
      for (let k = 0; k < 4; k++) {
        const sp = span * (0.95 - k * 0.15);
        const depth = (G.Ra - G.Ro) + G.hw * (0.1 + 0.18 * k) * (0.6 + 0.6 * pushing);
        const wav = 0.5 + 0.5 * Math.sin(time * 6 * (0.4 + 0.6 * AMB) - k * 1.3);
        ctx.beginPath();
        for (let m = 0; m <= 26; m++) {
          const q = m / 26;
          const s = phi - sp + 2 * sp * q;
          const r = G.Ra - depth * Math.sin(Math.PI * q);
          const x = G.cx + r * Math.sin(TAU * s), y = G.cy + r * Math.cos(TAU * s);
          if (m) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        }
        ctx.strokeStyle = rgba('#86E2FF', (0.34 - k * 0.06) * hot * (0.65 + 0.35 * wav));
        ctx.lineWidth = 1.3;
        ctx.stroke();
      }
      for (let sd = -1; sd <= 1; sd += 2) {
        ringXY(phi + sd * span, G.Ra);
        draw.glow(ctx, SP.x, SP.y, 9, '#9FE8FF', 0.55 * hot);
      }
      for (let i = 0; i < BITS.length; i++) {
        const b = BITS[i];
        if (!b.on) continue;
        const k = b.t / b.life;
        ctx.fillStyle = rgba('#C8F3FF', 0.85 * (1 - k));
        ctx.fillRect(b.x - 1, b.y - 1, 2, 2);
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    function drawGauge() {
      const { bx, gy, gx0, gx1, gh, bulbR } = G;
      const xT = lerp(gx0, gx1, T);
      ctx.save();
      gaugeTubePath(ctx, 2);
      ctx.clip('nonzero');
      ctx.fillStyle = gaugeGrad;
      ctx.fillRect(bx - bulbR, gy - bulbR, xT - (bx - bulbR), bulbR * 2);
      if (heatGlow > 0.05 && phase === 'ring' && plasma === 'on' && !won) {
        const sx = lerp(bx, xT, (time * 0.8) % 1);
        const sh = ctx.createLinearGradient(sx - 24, 0, sx + 24, 0);
        sh.addColorStop(0, 'rgba(255,255,255,0)');
        sh.addColorStop(0.5, `rgba(255,255,255,${0.32 * heatGlow})`);
        sh.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = sh;
        ctx.fillRect(Math.max(bx, sx - 24), gy - gh, Math.min(48, xT - (sx - 24)), gh * 2);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(bx, gy - gh / 2 + 2.5, Math.max(0, xT - bx), 1.2);
      ctx.restore();
      ctx.globalCompositeOperation = 'lighter';
      draw.glow(ctx, bx, gy, bulbR * 1.9, '#C04DFF', 0.3 + 0.2 * T);
      if (T > 0.003) draw.glow(ctx, xT, gy, 16, '#FF9BE6', (0.3 + 0.35 * heatGlow) * (plasma === 'on' ? 1 : 0.5));
      for (let i = 0; i < PALIERS.length; i++) {
        if (T + 1e-6 < PALIERS[i]) continue;
        const x = lerp(gx0, gx1, PALIERS[i]);
        draw.glow(ctx, x, gy - gh / 2 - 5.5, 5, PALIERS[i] === SOLEIL ? '#FFC46B' : '#E7D8FF', 0.7);
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    function drawEffects() {
      if (contact.t >= 0) {
        const k = contact.t / 2.2;
        const a = Math.sin(Math.PI * Math.min(1, k * 1.25)) * (1 - k);
        ctx.globalCompositeOperation = 'lighter';
        draw.glow(ctx, contact.x, contact.y, G.hw * 1.6, '#F2E9FF', 0.35 * a);
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.lineWidth = 2;
      for (let i = 0; i < RIPPLES.length; i++) {
        const r = RIPPLES[i];
        if (!r.on) continue;
        const k = r.t / 0.6;
        ctx.strokeStyle = rgba('#DDF6FF', 0.7 * (1 - k));
        ctx.beginPath();
        ctx.arc(r.x, r.y, lerp(5, 30, ease.outCubic(k)), 0, TAU);
        ctx.stroke();
      }
    }

    function render() {
      const { w, h } = cv;
      if (!bg) return;
      ctx.drawImage(bg.c, 0, 0, w, h);
      if (phase === 'tube') ctx.drawImage(tubeL.c, 0, 0, w, h);
      else if (phase === 'ring') ctx.drawImage(ringL.c, 0, 0, w, h);
      else paintVessel(ctx, false, 1 - smooth(0.82, 1, u));
      drawFieldLines();
      drawPlasma();
      drawWarning();
      drawCoils();
      drawArc();
      drawGauge();
      drawEffects();
    }

    function init() {
      phase = 'tube';
      u = 0;
      tubeT = 0;
      T = 0;
      palier = 0;
      plasma = 'on';
      pT = 0;
      life = 1;
      paleK = 0;
      heatGlow = 0;
      phi = phiT = 0.25;
      arcHot = 0;
      pushing = 0;
      arcIn = 0;
      dragging = false;
      won = false;
      wonT = 0;
      flags = {};
      bump.on = false;
      bump.A = 0;
      bump.wait = 2;
      contact.t = -1;
      G.thick = 1;
      shape(0);
      MOTES.forEach((m) => spawnMote(m, false));
      KNOTS.forEach((kn, i) => { spawnKnot(kn, i); kn.s = rand(-0.45, 0.45); });
      [SPARKS, BITS, RIPPLES].forEach((arr) => arr.forEach((o) => { o.on = false; }));
      update.pg = -1;
      api.hint(TEXTES.tube);
      api.status('');
      api.progress(0);
      setLabels();
      api.gesture('tap', { x: 50, y: (G.cy / G.h) * 100 });
    }

    if (/[?&]debug\b/.test(location.search)) {
      api.root.__dbg = () => ({
        phase, u, T, plasma, life, won, phi, palier,
        bump: { on: bump.on, s: bump.s, A: bump.A },
        cx: G.cx, cy: G.cy, Ra: G.Ra, Rm: G.Rm, Rmax: G.Rmax, w: G.w, h: G.h,
      });
    }

    cv.onResize(layout);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => { if (cv.w) layout(cv.w, cv.h); });
    }
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
