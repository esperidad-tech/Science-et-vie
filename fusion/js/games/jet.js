/* Les records de JET. Un tokamak vu en coupe, en forme de D : on garde le doigt appuyé pour
   chauffer son plasma et on lâche pour le laisser refroidir, afin de garder l'aiguille dans la
   zone verte. Trois tirs, comme trois records : 1997, 2021 et 2023. Si l'aiguille sort de la
   zone, le plasma s'éteint tout doucement (aucun emballement possible) et on recommence le tir. */
(function () {
  'use strict';
  const { lib } = window.RM;
  const { TAU, rand, clamp, lerp, ease, rgba, draw } = lib;

  /* Tous les textes du jeu, faciles à corriger */
  const TEXTES = {
    niveaux: [
      {
        annee: '1997',
        consigne: 'Garde le doigt appuyé pour chauffer, lâche pour laisser refroidir : reste dans la zone verte.',
        statut: '1997 : tiens 1 seconde dans la zone verte.',
        legende: 'pic de 16 MW',
        record: '1997 : 22 MJ (pic de 16 MW)',
      },
      {
        annee: '2021',
        consigne: 'Bravo ! Record suivant : garde l’aiguille dans la zone verte pendant 5 secondes.',
        statut: '2021 : tiens 5 secondes dans la zone verte.',
        legende: 'en 5 s',
        record: '2021 : 59 MJ en 5 s',
      },
      {
        annee: '2023',
        consigne: 'Dernier record : la zone verte est plus étroite. Tiens encore 5 secondes !',
        statut: '2023 : tiens 5 secondes. Regarde la jauge de combustible.',
        legende: 'en 5 s',
        record: '2023 : 69 MJ en 5 s avec 0,2 mg de combustible',
      },
    ],
    derniere: 'Record ! C’était la toute dernière campagne de JET.',
    unite: 'MJ',
    combustible: 'Combustible : 0,2 mg',
    record: 'Record de {annee} !',
    finTir: 'Record ! Le tir se termine : prépare-toi pour le suivant.',
    alerteChaud: 'Trop chaud : lâche !',
    alerteFroid: 'Trop froid : appuie !',
    eteint: 'Plasma éteint',
    tropChaud: 'Trop chaud ! Le plasma devient instable, touche la paroi et s’éteint tout doucement.',
    tropFroid: 'Trop froid ! Le plasma s’éteint tout doucement.',
    recommence: 'On recommence le tir de {annee} : garde le doigt appuyé pour chauffer.',
    fin: '69 MJ, c’est à peu près l’énergie de 2 litres d’essence.',
    finStatut: 'JET : de 1983 à 2023',
    bravo: '{bravo}',
  };

  /* Les trois tirs : durée à tenir (s), énergie atteinte (MJ) et zone verte (sur la jauge, de 0 à 1) */
  const DUREES = [1, 5, 5];
  const ENERGIES = [22, 59, 69];
  const ZONES = [[0.46, 0.8], [0.5, 0.77], [0.56, 0.72]];

  /* Le « thermostat » : chauffage quand on appuie, refroidissement naturel, petits coups de chaleur */
  const HEAT = 0.62;
  const COOL = 0.28;
  const LEAK = 0.03;
  const KICK_DOWN = 0.035;   /* chaque appui donne un petit coup de chaleur… */
  const KICK_TAP = 0.05;     /* … un peu plus fort si c'est une tape rapide */
  const KICK_RATE = 0.5;
  const DRIFT = [0.03, 0.05, 0.065];
  const GRACE = 0.45;        /* temps hors de la zone verte toléré avant l'extinction */
  const FAIL_T = 1.9;
  const WIN_T = 2.7;
  const A0 = Math.PI + 0.06;
  const A1 = TAU - 0.06;

  const fill = (s, o) => s.replace(/\{(\w+)\}/g, (m, k) => (o[k] == null ? m : o[k]));

  const CSS = `
.game[data-game="jet"] .game-canvas { -webkit-touch-callout: none; }
.game[data-game="jet"] .je-top { position: absolute; z-index: 3; inset: 0; pointer-events: none; }
.game[data-game="jet"] .je-years { position: absolute; left: 10px; top: 10px; display: flex; gap: 5px; }
.game[data-game="jet"] .je-yr {
  display: inline-flex; align-items: center; gap: 6px; min-height: 30px; padding: 4px 10px 5px;
  border-radius: 12px 14px 13px 11px; background: rgba(4, 20, 22, 0.9);
  box-shadow: inset 0 0 0 1px var(--line); color: var(--muted);
  font: 700 0.875rem/1 var(--font-text); font-variant-numeric: tabular-nums;
  transition: background 0.3s, color 0.3s, box-shadow 0.3s;
}
.game[data-game="jet"] .je-yr[data-state="now"] {
  background: var(--accent); color: var(--btn-fg); box-shadow: 0 0 0 3px rgba(78, 230, 200, 0.22);
}
.game[data-game="jet"] .je-yr[data-state="done"] { color: var(--fg); box-shadow: inset 0 0 0 1.5px rgba(78, 230, 200, 0.6); }
.game[data-game="jet"] .je-yr[data-state="done"]::before {
  content: ""; width: 9px; height: 5px; margin: -3px 0 0 1px;
  border-left: 2px solid var(--accent); border-bottom: 2px solid var(--accent); transform: rotate(-45deg);
}
.game[data-game="jet"] .je-read {
  position: absolute; right: 10px; top: 10px;
  display: grid; justify-items: end; gap: 4px; min-width: 92px; padding: 6px 11px 7px;
  border-radius: 14px 12px 15px 13px; background: rgba(4, 20, 22, 0.92); box-shadow: inset 0 0 0 1px var(--line);
  color: var(--fg); text-align: right;
}
.game[data-game="jet"] .je-line { display: flex; align-items: baseline; gap: 4px; }
.game[data-game="jet"] .je-num {
  font: 800 1.625rem/1 var(--font-display); font-variation-settings: "SOFT" 100;
  font-variant-numeric: tabular-nums; letter-spacing: -0.01em;
}
.game[data-game="jet"] .je-unit { font: 700 0.875rem/1 var(--font-text); color: var(--accent-ink); }
.game[data-game="jet"] .je-dots { display: flex; gap: 4px; }
.game[data-game="jet"] .je-dots i {
  width: 11px; height: 11px; border-radius: 50%;
  background: conic-gradient(var(--accent) calc(var(--f, 0) * 360deg), rgba(230, 247, 247, 0.16) 0);
  box-shadow: 0 0 0 1px rgba(230, 247, 247, 0.12);
}
.game[data-game="jet"] .je-dots i.is-full { background: var(--accent); box-shadow: 0 0 6px 1px rgba(78, 230, 200, 0.75); }
.game[data-game="jet"] .je-cap { max-width: 8.6rem; font: 600 0.75rem/1.25 var(--font-text); color: var(--muted); }
.game[data-game="jet"] .je-cap:empty { display: none; }
.game[data-game="jet"] .je-fuel {
  position: absolute; left: 10px; top: 47px;
  display: flex; align-items: center; gap: 7px; padding: 5px 11px 5px 7px; white-space: nowrap;
  border-radius: 13px 15px 12px 14px; background: rgba(4, 20, 22, 0.92); box-shadow: inset 0 0 0 1px var(--line);
  color: var(--fg); font: 600 0.8125rem/1.2 var(--font-text);
  opacity: 0; transform: translateY(-6px); transition: opacity 0.35s, transform 0.35s;
}
.game[data-game="jet"] .je-fuel.is-on { opacity: 1; transform: none; }
.game[data-game="jet"] .je-fuel[hidden] { display: none; }
.game[data-game="jet"] .je-tank {
  position: relative; flex: none; width: 12px; height: 24px; border-radius: 6px 6px 5px 5px;
  background: rgba(230, 247, 247, 0.08); box-shadow: inset 0 0 0 1.5px rgba(230, 247, 247, 0.45); overflow: hidden;
}
.game[data-game="jet"] .je-tank i {
  position: absolute; left: 2.5px; right: 2.5px; bottom: 2.5px; height: calc((100% - 5px) * var(--f, 1));
  border-radius: 3px; background: linear-gradient(#FFE0C2, var(--accent-2));
  box-shadow: 0 0 7px rgba(255, 159, 107, 0.8);
}
.game[data-game="jet"] .je-toast {
  position: absolute; z-index: 4; left: 50%; top: 40%;
  padding: 7px 14px 8px; border-radius: 14px 18px 16px 15px; white-space: nowrap;
  background: rgba(4, 20, 22, 0.88); color: var(--fg);
  box-shadow: inset 0 0 0 2px var(--tc, var(--accent)), 0 12px 24px -12px rgba(0, 0, 0, 0.8);
  font: 700 1rem/1.2 var(--font-display); font-variation-settings: "SOFT" 100;
  opacity: 0; visibility: hidden; transform: translate(-50%, -50%) scale(0.9);
  transition: opacity 0.22s, transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), visibility 0s linear 0.3s;
  pointer-events: none;
}
.game[data-game="jet"] .je-toast.is-on {
  opacity: 1; visibility: visible; transform: translate(-50%, -50%);
  transition: opacity 0.22s, transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), visibility 0s;
}
.game[data-game="jet"] .je-narrow .je-yr { padding: 4px 7px 5px; gap: 4px; font-size: 0.8125rem; }
.game[data-game="jet"] .je-narrow .je-years { gap: 4px; left: 8px; }
.game[data-game="jet"] .je-narrow .je-read { right: 8px; min-width: 80px; padding: 5px 9px 6px; }
.game[data-game="jet"] .je-narrow .je-num { font-size: 1.375rem; }
`;

  function seeded(seed) {
    let s = seed >>> 0 || 1;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }

  /* Grain très fin (pour donner de la matière au métal et au fond) */
  let GRAIN = null;
  function grain() {
    if (GRAIN) return GRAIN;
    const N = 96;
    const c = document.createElement('canvas');
    c.width = c.height = N;
    const g = c.getContext('2d');
    const im = g.createImageData(N, N);
    const nz = lib.makeNoise(31);
    const r = seeded(8);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const v = 0.62 * nz.fbm(x / 7, y / 7, 3) + 0.38 * r();
        const j = (y * N + x) * 4;
        const l = Math.round(v * 255);
        im.data[j] = l; im.data[j + 1] = l; im.data[j + 2] = l; im.data[j + 3] = 255;
      }
    }
    g.putImageData(im, 0, 0);
    GRAIN = c;
    return c;
  }

  /* Contour en D (jambe droite côté centre de la machine, ventre arrondi vers l'extérieur),
     rééchantillonné à pas réguliers : n points [x0, y0, x1, y1, …] */
  function dPts(xl, xr, yc, H, rr, n) {
    const raw = [];
    const quad = (x0, y0, cx, cy, x1, y1) => {
      for (let i = 1; i <= 12; i++) {
        const t = i / 12, u = 1 - t;
        raw.push(u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1);
      }
    };
    const cub = (x0, y0, ax, ay, bx, by, x1, y1) => {
      for (let i = 1; i <= 40; i++) {
        const t = i / 40, u = 1 - t;
        raw.push(u * u * u * x0 + 3 * u * u * t * ax + 3 * u * t * t * bx + t * t * t * x1,
          u * u * u * y0 + 3 * u * u * t * ay + 3 * u * t * t * by + t * t * t * y1);
      }
    };
    const W = xr - xl;
    raw.push(xl, yc - H + rr);
    quad(xl, yc - H + rr, xl, yc - H, xl + rr, yc - H);
    cub(xl + rr, yc - H, xl + W * 0.74, yc - H, xr, yc - H * 0.56, xr, yc);
    cub(xr, yc, xr, yc + H * 0.56, xl + W * 0.74, yc + H, xl + rr, yc + H);
    quad(xl + rr, yc + H, xl, yc + H, xl, yc + H - rr);
    for (let i = 1; i <= 16; i++) raw.push(xl, lerp(yc + H - rr, yc - H + rr, i / 16));
    /* longueurs cumulées puis points à intervalles réguliers */
    const m = raw.length / 2;
    const cum = new Float32Array(m);
    for (let i = 1; i < m; i++) cum[i] = cum[i - 1] + Math.hypot(raw[2 * i] - raw[2 * i - 2], raw[2 * i + 1] - raw[2 * i - 1]);
    const total = cum[m - 1];
    const out = new Float32Array(n * 2);
    let j = 0;
    for (let i = 0; i < n; i++) {
      const d = (i / n) * total;
      while (j < m - 2 && cum[j + 1] < d) j++;
      const t = cum[j + 1] > cum[j] ? (d - cum[j]) / (cum[j + 1] - cum[j]) : 0;
      out[2 * i] = lerp(raw[2 * j], raw[2 * j + 2], t);
      out[2 * i + 1] = lerp(raw[2 * j + 1], raw[2 * j + 3], t);
    }
    return out;
  }

  function hexMix(a, b, t) {
    const A = lib.hexToRgb(a), B = lib.hexToRgb(b);
    let s = '#';
    for (let i = 0; i < 3; i++) s += Math.round(lerp(A[i], B[i], clamp(t))).toString(16).padStart(2, '0');
    return s;
  }

  function pathPts(g, P) {
    g.moveTo(P[0], P[1]);
    for (let i = 2; i < P.length; i += 2) g.lineTo(P[i], P[i + 1]);
    g.closePath();
  }

  window.RM.games.jet = function (api) {
    const cv = api.canvas();
    const ctx = cv.ctx;
    const RMO = api.reducedMotion;
    const AMB = RMO ? 0.3 : 1;
    const nz = lib.makeNoise(53);
    api.style(CSS);
    cv.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    /* ---- étiquettes (DOM) : les trois records, l'énergie, le combustible ---- */
    const mk = (tag, cls, txt) => {
      const e = document.createElement(tag);
      if (cls) e.className = cls;
      if (txt != null) e.textContent = txt;
      return e;
    };
    const topBar = mk('div', 'je-top');
    topBar.setAttribute('aria-hidden', 'true');
    const yearsEl = mk('div', 'je-years');
    const yrEls = TEXTES.niveaux.map((n) => {
      const e = mk('span', 'je-yr', n.annee);
      yearsEl.appendChild(e);
      return e;
    });
    const readEl = mk('div', 'je-read');
    const lineEl = mk('span', 'je-line');
    const numEl = mk('b', 'je-num', '0');
    lineEl.append(numEl, mk('span', 'je-unit', TEXTES.unite));
    const dotsEl = mk('span', 'je-dots');
    const capEl = mk('span', 'je-cap', '');
    readEl.append(lineEl, dotsEl, capEl);
    const fuelEl = mk('div', 'je-fuel');
    const tankEl = mk('span', 'je-tank');
    const tankFill = mk('i');
    tankEl.appendChild(tankFill);
    fuelEl.append(tankEl, mk('span', 'je-fuel-txt', TEXTES.combustible));
    fuelEl.hidden = true;
    topBar.append(yearsEl, readEl, fuelEl);
    const toastEl = mk('div', 'je-toast');
    toastEl.setAttribute('aria-hidden', 'true');
    api.stage.append(topBar, toastEl);

    /* ---- géométrie ---- */
    const L = { U: 1, w: 0, h: 0 };
    let bg = null;
    let bandC = null;

    function layout(w, h) {
      const U = Math.min(w / 360, h / 450);
      const wide = w / h > 1.12;
      const top = 50 * U;
      let g, B;
      if (!wide) {
        const r = Math.min(w * 0.36, h * 0.27);
        g = { cx: w / 2, cy: h - 15 * U, r };
        B = { x: 0, y: top, w, h: g.cy - r - 20 * U - top };
      } else {
        /* scène large : la machine à gauche, la jauge à droite */
        const r = Math.min(h * 0.36, w * 0.17);
        g = { cx: w - r * 1.16 - 12 * U, cy: h * 0.5 + r * 0.5, r };
        B = { x: 0, y: top * 0.8, w: g.cx - r * 1.16 - 6 * U, h: h - top * 0.8 - 14 * U };
      }
      const kv = 1.55;
      /* toute la machine (du noyau de fer au port) doit tenir dans la largeur */
      const av = Math.min(B.h / (2 * kv * 1.2), B.w / 4.9);
      const cx = B.x + B.w * 0.5 + av * 0.22;
      const cy = B.y + B.h * 0.5;
      Object.assign(L, { U, w, h, wide, g, B, av, cx, cy, kv });
      const H = kv * av;
      L.H = H;
      /* chambre à vide (double paroi) et tuiles de la première paroi */
      const tw = av * 0.12;
      L.tw = tw;
      L.vOut = dPts(cx - av, cx + av, cy, H, av * 0.42, 132);
      L.vIn = dPts(cx - av + tw, cx + av - tw, cy, H - tw, av * 0.34, 132);
      L.vTile = dPts(cx - av + tw * 1.55, cx + av - tw * 1.55, cy, H - tw * 1.55, av * 0.31, 132);
      L.vMid = dPts(cx - av + tw * 0.5, cx + av - tw * 0.5, cy, H - tw * 0.5, av * 0.38, 132);
      /* bobine toroïdale (en D, bleue) */
      const tc = av * 0.17;
      L.tfH = H * 1.3;
      L.tfOut = dPts(cx - av * 1.5, cx + av * 1.62, cy, L.tfH, av * 0.62, 132);
      L.tfIn = dPts(cx - av * 1.5 + tc, cx + av * 1.62 - tc, cy, L.tfH - tc, av * 0.5, 132);
      L.tfMid1 = dPts(cx - av * 1.5 + tc * 0.34, cx + av * 1.62 - tc * 0.34, cy, L.tfH - tc * 0.34, av * 0.58, 132);
      L.tfMid2 = dPts(cx - av * 1.5 + tc * 0.67, cx + av * 1.62 - tc * 0.67, cy, L.tfH - tc * 0.67, av * 0.54, 132);
      /* solénoïde central et noyau de fer */
      L.sol = { x0: cx - av * 2.0, x1: cx - av * 1.6, y0: cy - L.tfH * 0.94, y1: cy + L.tfH * 0.94 };
      L.iron = { x0: cx - av * 2.6, x1: cx - av * 2.08 };
      /* bobines poloïdales (vues en coupe) */
      L.pf = [
        { x: cx + av * 1.98, y: cy - av * 1.0, w: av * 0.34, h: av * 0.42 },
        { x: cx + av * 1.98, y: cy + av * 1.0, w: av * 0.34, h: av * 0.42 },
      ];
      /* le port de chauffage, à l'horizontale sur le flanc extérieur */
      L.port = { x0: cx + av - tw * 0.6, x1: cx + av * 2.2, y: cy, hh: av * 0.15 };
      /* divertor (en bas de la chambre) */
      L.div = { y: cy + H - tw * 1.3 };
      /* plasma (forme de Miller : elongation, triangularité, décalage vers l'extérieur) */
      L.pl = { cx: cx + av * 0.06, cy: cy - av * 0.06, a: av * 0.72, k: 1.6, d: 0.36, shift: av * 0.08 };
      L.strike = [
        { x: cx - av * 0.2, y: L.div.y - av * 0.09 },
        { x: cx + av * 0.4, y: L.div.y - av * 0.1 },
      ];
      L.contact = { x: cx + av * 0.12, y: cy + H - tw * 1.6 };
    }

    const angOf = (t) => lerp(A0, A1, clamp(t));

    /* ---- matières ---- */
    function textureIn(g, x, y, w, h, alpha, op) {
      g.save();
      g.globalCompositeOperation = op || 'overlay';
      g.globalAlpha = alpha;
      g.fillStyle = g.createPattern(grain(), 'repeat');
      g.fillRect(x, y, w, h);
      g.restore();
    }

    function turns(g, x0, y0, w, h, cols, colA, colB) {
      const cw = w / cols;
      const rows = Math.max(1, Math.round(h / cw));
      const ch = h / rows;
      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
          const x = x0 + j * cw, y = y0 + i * ch;
          const gr = g.createLinearGradient(x, y, x + cw, y + ch);
          gr.addColorStop(0, colA);
          gr.addColorStop(1, colB);
          g.fillStyle = gr;
          draw.roundRect(g, x + cw * 0.1, y + ch * 0.1, cw * 0.8, ch * 0.8, cw * 0.22);
          g.fill();
        }
      }
    }

    function paintBg() {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(cv.w * cv.dpr));
      c.height = Math.max(1, Math.round(cv.h * cv.dpr));
      const g = c.getContext('2d');
      g.scale(cv.dpr, cv.dpr);
      const { w, h, U, av, cx, cy, H } = L;

      /* fond : bleu-vert profond, un peu éclairé derrière la machine */
      g.fillStyle = '#041416';
      g.fillRect(0, 0, w, h);
      draw.glow(g, cx, cy, Math.max(w, h) * 0.75, '#0F3C40', 0.85);
      draw.glow(g, w * 0.08, h * 0.04, w * 0.55, '#0E3438', 0.6);
      textureIn(g, 0, 0, w, h, 0.22);

      /* noyau de fer : la colonne centrale autour de laquelle tourne l'anneau */
      const I = L.iron;
      const yTop0 = -10, yBot1 = L.wide ? L.h + 10 : L.g.cy - L.g.r * 1.1;
      const ironFill = (x0, y0, x1, y1, vertical) => {
        const gr = vertical ? g.createLinearGradient(x0, 0, x1, 0) : g.createLinearGradient(0, y0, 0, y1);
        gr.addColorStop(0, '#1C3A3C');
        gr.addColorStop(0.45, '#14302F');
        gr.addColorStop(1, '#0A1D1F');
        g.fillStyle = gr;
        g.fillRect(x0, y0, x1 - x0, y1 - y0);
        g.save();
        g.beginPath();
        g.rect(x0, y0, x1 - x0, y1 - y0);
        g.clip();
        g.strokeStyle = 'rgba(170, 230, 222, 0.07)';
        g.lineWidth = 0.8;
        const step = 3.2 * U;
        g.beginPath();
        if (vertical) for (let x = x0 + step; x < x1; x += step) { g.moveTo(x, y0); g.lineTo(x, y1); }
        else for (let y = y0 + step; y < y1; y += step) { g.moveTo(x0, y); g.lineTo(x1, y); }
        g.stroke();
        g.restore();
        textureIn(g, x0, y0, x1 - x0, y1 - y0, 0.3);
      };
      g.save();
      g.shadowColor = 'rgba(0, 0, 0, 0.45)';
      g.shadowBlur = 14 * U;
      g.fillStyle = '#0A1D1F';
      g.fillRect(I.x0, yTop0, I.x1 - I.x0, yBot1 - yTop0);
      g.restore();
      ironFill(I.x0, yTop0, I.x1, yBot1, true);
      g.fillStyle = 'rgba(190, 240, 232, 0.16)';
      g.fillRect(I.x1 - 1, yTop0, 1, yBot1 - yTop0);

      /* solénoïde central : des spires bleues vues en coupe */
      const So = L.sol;
      g.fillStyle = '#0B2140';
      draw.roundRect(g, So.x0, So.y0, So.x1 - So.x0, So.y1 - So.y0, 3 * U);
      g.fill();
      turns(g, So.x0 + 1.5 * U, So.y0 + 1.5 * U, So.x1 - So.x0 - 3 * U, So.y1 - So.y0 - 3 * U, 3, '#4C8FE0', '#1C4A8C');
      g.fillStyle = 'rgba(255, 255, 255, 0.12)';
      g.fillRect(So.x0 + 1, So.y0 + 2, 1.2, So.y1 - So.y0 - 4);

      /* bobine toroïdale en D */
      g.save();
      g.shadowColor = 'rgba(0, 0, 0, 0.5)';
      g.shadowBlur = 16 * U;
      g.shadowOffsetY = 5 * U;
      g.beginPath();
      pathPts(g, L.tfOut);
      pathPts(g, L.tfIn);
      const tg = g.createLinearGradient(cx - av * 1.5, cy - L.tfH, cx + av * 1.6, cy + L.tfH);
      tg.addColorStop(0, '#5B9BEA');
      tg.addColorStop(0.35, '#2D66B8');
      tg.addColorStop(0.75, '#1B4688');
      tg.addColorStop(1, '#10305F');
      g.fillStyle = tg;
      g.fill('evenodd');
      g.restore();
      g.save();
      g.beginPath();
      pathPts(g, L.tfOut);
      pathPts(g, L.tfIn);
      g.clip('evenodd');
      textureIn(g, cx - av * 1.6, cy - L.tfH - 2, av * 3.4, L.tfH * 2 + 4, 0.25);
      g.lineWidth = 0.9;
      g.strokeStyle = 'rgba(8, 26, 60, 0.45)';
      g.beginPath();
      pathPts(g, L.tfMid1);
      g.stroke();
      g.beginPath();
      pathPts(g, L.tfMid2);
      g.stroke();
      g.restore();
      const hl = g.createLinearGradient(cx - av * 1.5, cy - L.tfH, cx + av * 0.6, cy);
      hl.addColorStop(0, 'rgba(190, 225, 255, 0.55)');
      hl.addColorStop(1, 'rgba(190, 225, 255, 0)');
      g.strokeStyle = hl;
      g.lineWidth = 1.2;
      g.beginPath();
      pathPts(g, L.tfOut);
      g.stroke();

      /* bobines poloïdales */
      for (const p of L.pf) {
        g.save();
        g.shadowColor = 'rgba(0, 0, 0, 0.5)';
        g.shadowBlur = 10 * U;
        g.shadowOffsetY = 3 * U;
        g.fillStyle = '#0B2140';
        draw.roundRect(g, p.x - p.w / 2, p.y - p.h / 2, p.w, p.h, 3 * U);
        g.fill();
        g.restore();
        const cols = Math.max(2, Math.round(p.w / (p.h / 2.2)));
        turns(g, p.x - p.w / 2 + 1.5 * U, p.y - p.h / 2 + 1.5 * U, p.w - 3 * U, p.h - 3 * U, cols, '#4C8FE0', '#1C4A8C');
      }

      /* chambre à vide : double paroi d'acier, tuiles, intérieur sombre */
      g.save();
      g.shadowColor = 'rgba(0, 0, 0, 0.6)';
      g.shadowBlur = 18 * U;
      g.shadowOffsetY = 6 * U;
      g.beginPath();
      pathPts(g, L.vOut);
      g.fillStyle = '#1D3034';
      g.fill();
      g.restore();
      g.beginPath();
      pathPts(g, L.vOut);
      pathPts(g, L.vIn);
      const sg = g.createLinearGradient(cx - av, cy - H, cx + av, cy + H);
      sg.addColorStop(0, '#B4CBCB');
      sg.addColorStop(0.3, '#7D9799');
      sg.addColorStop(0.7, '#4A6164');
      sg.addColorStop(1, '#273B3F');
      g.fillStyle = sg;
      g.fill('evenodd');
      g.save();
      g.beginPath();
      pathPts(g, L.vOut);
      pathPts(g, L.vIn);
      g.clip('evenodd');
      textureIn(g, cx - av - 2, cy - H - 2, av * 2 + 4, H * 2 + 4, 0.35);
      g.strokeStyle = 'rgba(10, 24, 28, 0.55)';
      g.lineWidth = 0.9;
      g.beginPath();
      pathPts(g, L.vMid);
      g.stroke();
      /* raidisseurs entre les deux parois */
      g.strokeStyle = 'rgba(10, 24, 28, 0.35)';
      g.beginPath();
      for (let i = 0; i < L.vOut.length / 2; i += 6) {
        g.moveTo(L.vOut[2 * i], L.vOut[2 * i + 1]);
        g.lineTo(L.vIn[2 * i], L.vIn[2 * i + 1]);
      }
      g.stroke();
      g.restore();
      g.beginPath();
      pathPts(g, L.vIn);
      const ig = g.createRadialGradient(L.pl.cx, L.pl.cy, av * 0.1, L.pl.cx, L.pl.cy, H * 1.05);
      ig.addColorStop(0, '#071A1D');
      ig.addColorStop(1, '#020809');
      g.fillStyle = ig;
      g.fill();
      /* tuiles de la première paroi */
      const n = L.vIn.length / 2;
      const rt = seeded(11);
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const v = rt();
        g.fillStyle = v < 0.33 ? '#22383C' : v < 0.66 ? '#1B2F33' : '#273F43';
        g.beginPath();
        g.moveTo(L.vIn[2 * i], L.vIn[2 * i + 1]);
        g.lineTo(L.vIn[2 * j], L.vIn[2 * j + 1]);
        g.lineTo(L.vTile[2 * j], L.vTile[2 * j + 1]);
        g.lineTo(L.vTile[2 * i], L.vTile[2 * i + 1]);
        g.closePath();
        g.fill();
      }
      g.strokeStyle = 'rgba(0, 0, 0, 0.5)';
      g.lineWidth = 0.6;
      g.beginPath();
      for (let i = 0; i < n; i += 2) {
        g.moveTo(L.vIn[2 * i], L.vIn[2 * i + 1]);
        g.lineTo(L.vTile[2 * i], L.vTile[2 * i + 1]);
      }
      g.stroke();
      g.strokeStyle = 'rgba(180, 230, 225, 0.14)';
      g.lineWidth = 0.8;
      g.beginPath();
      pathPts(g, L.vTile);
      g.stroke();

      /* divertor : un dôme et deux plaques, tout en bas */
      g.save();
      g.beginPath();
      pathPts(g, L.vTile);
      g.clip();
      const dy = L.div.y;
      g.beginPath();
      g.moveTo(cx - av * 0.95, dy + av * 0.3);
      g.lineTo(cx - av * 0.62, dy - av * 0.02);
      g.lineTo(cx - av * 0.36, dy - av * 0.12);
      g.lineTo(cx - av * 0.12, dy + av * 0.02);
      g.quadraticCurveTo(cx + av * 0.1, dy - av * 0.22, cx + av * 0.3, dy + av * 0.02);
      g.lineTo(cx + av * 0.52, dy - av * 0.13);
      g.lineTo(cx + av * 0.8, dy - av * 0.04);
      g.lineTo(cx + av * 1.1, dy + av * 0.3);
      g.closePath();
      const dg = g.createLinearGradient(0, dy - av * 0.2, 0, dy + av * 0.2);
      dg.addColorStop(0, '#41595C');
      dg.addColorStop(1, '#162629');
      g.fillStyle = dg;
      g.fill();
      g.strokeStyle = 'rgba(190, 235, 228, 0.25)';
      g.lineWidth = 0.9;
      g.stroke();
      g.restore();

      /* port de chauffage : un conduit qui traverse la bobine */
      const P = L.port;
      g.save();
      g.shadowColor = 'rgba(0, 0, 0, 0.5)';
      g.shadowBlur = 8 * U;
      const pg = g.createLinearGradient(0, P.y - P.hh * 1.9, 0, P.y + P.hh * 1.9);
      pg.addColorStop(0, '#9DB6B7');
      pg.addColorStop(0.5, '#56706F');
      pg.addColorStop(1, '#22373A');
      g.fillStyle = pg;
      draw.roundRect(g, P.x0, P.y - P.hh * 1.75, P.x1 - P.x0, P.hh * 3.5, 3 * U);
      g.fill();
      g.restore();
      g.fillStyle = '#030B0C';
      g.fillRect(P.x0 - L.tw * 0.8, P.y - P.hh, P.x1 - P.x0 + L.tw * 0.8, P.hh * 2);
      g.fillStyle = 'rgba(190, 235, 228, 0.18)';
      g.fillRect(P.x0, P.y - P.hh * 1.75, P.x1 - P.x0, 1);
      for (let x = P.x0 + 6 * U; x < P.x1 - 2 * U; x += 9 * U) {
        g.fillStyle = 'rgba(0, 0, 0, 0.35)';
        g.fillRect(x, P.y - P.hh * 1.75, 1.4, P.hh * 0.7);
        g.fillRect(x, P.y + P.hh, 1.4, P.hh * 0.75);
      }

      paintGaugeBase(g);
      return c;
    }

    /* socle de la jauge : une dalle sombre, des graduations, un flocon et une flamme */
    function paintGaugeBase(g) {
      const G = L.g, U = L.U;
      const R = G.r;
      const slab = () => {
        g.beginPath();
        g.arc(G.cx, G.cy, R * 1.16, Math.PI, TAU);
        if (L.wide) {
          const yb = G.cy + R * 0.3, rr = R * 0.2;
          g.lineTo(G.cx + R * 1.16, yb - rr);
          g.quadraticCurveTo(G.cx + R * 1.16, yb, G.cx + R * 1.16 - rr, yb);
          g.lineTo(G.cx - R * 1.16 + rr, yb);
          g.quadraticCurveTo(G.cx - R * 1.16, yb, G.cx - R * 1.16, yb - rr);
        } else {
          g.lineTo(G.cx + R * 1.16, L.h + 40);
          g.lineTo(G.cx - R * 1.16, L.h + 40);
        }
        g.closePath();
      };
      g.save();
      g.shadowColor = 'rgba(0, 0, 0, 0.55)';
      g.shadowBlur = 20 * U;
      g.shadowOffsetY = -2 * U;
      slab();
      const sg = g.createLinearGradient(0, G.cy - R * 1.16, 0, G.cy);
      sg.addColorStop(0, '#0D2A2D');
      sg.addColorStop(1, '#061719');
      g.fillStyle = sg;
      g.fill();
      g.restore();
      g.save();
      slab();
      g.clip();
      textureIn(g, G.cx - R * 1.2, G.cy - R * 1.2, R * 2.4, R * 1.4, 0.3);
      g.restore();
      g.strokeStyle = 'rgba(160, 235, 222, 0.2)';
      g.lineWidth = 1;
      g.beginPath();
      g.arc(G.cx, G.cy, R * 1.16 - 0.5, Math.PI + 0.02, TAU - 0.02);
      g.stroke();
      /* rainure de la bande */
      g.strokeStyle = 'rgba(0, 0, 0, 0.55)';
      g.lineWidth = R * 0.25;
      g.beginPath();
      g.arc(G.cx, G.cy, R * 0.89, A0 - 0.03, A1 + 0.03);
      g.stroke();
      /* graduations */
      for (let i = 0; i <= 20; i++) {
        const a = angOf(i / 20);
        const big = i % 5 === 0;
        const r0 = R * 1.035, r1 = R * (big ? 1.11 : 1.075);
        g.strokeStyle = big ? 'rgba(220, 245, 240, 0.6)' : 'rgba(220, 245, 240, 0.3)';
        g.lineWidth = big ? 1.6 : 1;
        g.beginPath();
        g.moveTo(G.cx + Math.cos(a) * r0, G.cy + Math.sin(a) * r0);
        g.lineTo(G.cx + Math.cos(a) * r1, G.cy + Math.sin(a) * r1);
        g.stroke();
      }
      /* flocon (froid) à gauche, flamme (chaud) à droite */
      const s = R * 0.085;
      const fx = G.cx - R * 0.6, fy = G.cy - R * 0.13;
      g.save();
      g.translate(fx, fy);
      g.strokeStyle = '#8FC7FF';
      g.lineWidth = 1.6;
      g.lineCap = 'round';
      for (let k = 0; k < 3; k++) {
        g.save();
        g.rotate((k * Math.PI) / 3);
        g.beginPath();
        g.moveTo(-s, 0);
        g.lineTo(s, 0);
        g.moveTo(s * 0.55, 0);
        g.lineTo(s * 0.8, -s * 0.28);
        g.moveTo(s * 0.55, 0);
        g.lineTo(s * 0.8, s * 0.28);
        g.moveTo(-s * 0.55, 0);
        g.lineTo(-s * 0.8, -s * 0.28);
        g.moveTo(-s * 0.55, 0);
        g.lineTo(-s * 0.8, s * 0.28);
        g.stroke();
        g.restore();
      }
      g.restore();
      const hx = G.cx + R * 0.6, hy = G.cy - R * 0.11;
      g.save();
      g.translate(hx, hy);
      const fg = g.createLinearGradient(0, -s * 1.4, 0, s);
      fg.addColorStop(0, '#FFE08A');
      fg.addColorStop(1, '#FF6B4A');
      g.fillStyle = fg;
      g.beginPath();
      g.moveTo(0, -s * 1.35);
      g.bezierCurveTo(s * 0.9, -s * 0.5, s * 0.95, s * 0.2, s * 0.55, s * 0.75);
      g.quadraticCurveTo(0, s * 1.1, -s * 0.55, s * 0.75);
      g.bezierCurveTo(-s * 0.95, s * 0.2, -s * 0.45, -s * 0.35, -s * 0.1, -s * 0.6);
      g.quadraticCurveTo(-s * 0.05, -s * 0.15, s * 0.1, -s * 0.05);
      g.quadraticCurveTo(s * 0.2, -s * 0.7, 0, -s * 1.35);
      g.closePath();
      g.fill();
      g.restore();
    }

    /* la bande colorée de la jauge (change avec la zone verte de chaque tir) */
    function bandColor(t, z) {
      if (t < z[0]) return lib.ramp([[0, '#2F5FD0'], [1, '#43B2EA']], t / z[0]);
      if (t <= z[1]) return lib.ramp([[0, '#3CCB76'], [0.5, '#6BE79B'], [1, '#3CCB76']], (t - z[0]) / (z[1] - z[0]));
      return lib.ramp([[0, '#FFB45E'], [1, '#FF5A48']], (t - z[1]) / (1 - z[1]));
    }

    function paintBand() {
      if (!cv.w) return;
      const c = bandC || document.createElement('canvas');
      c.width = Math.max(1, Math.round(cv.w * cv.dpr));
      c.height = Math.max(1, Math.round(cv.h * cv.dpr));
      const g = c.getContext('2d');
      g.setTransform(cv.dpr, 0, 0, cv.dpr, 0, 0);
      g.clearRect(0, 0, cv.w, cv.h);
      const G = L.g, z = S.zone;
      const rIn = G.r * 0.79, rOut = G.r, rM = (rIn + rOut) / 2;
      g.lineWidth = rOut - rIn;
      const N = 90;
      for (let i = 0; i < N; i++) {
        const t0 = i / N, t1 = (i + 1) / N;
        g.strokeStyle = bandColor((t0 + t1) / 2, z);
        g.beginPath();
        g.arc(G.cx, G.cy, rM, angOf(t0) - 0.004, angOf(t1) + 0.004);
        g.stroke();
      }
      /* relief : bord intérieur dans l'ombre, reflet près du bord extérieur */
      g.globalCompositeOperation = 'source-atop';
      const rg = g.createRadialGradient(G.cx, G.cy, rIn, G.cx, G.cy, rOut);
      rg.addColorStop(0, 'rgba(0, 0, 0, 0.42)');
      rg.addColorStop(0.45, 'rgba(0, 0, 0, 0)');
      rg.addColorStop(0.8, 'rgba(255, 255, 255, 0.22)');
      rg.addColorStop(1, 'rgba(0, 0, 0, 0.25)');
      g.fillStyle = rg;
      g.fillRect(G.cx - rOut, G.cy - rOut, rOut * 2, rOut * 2);
      g.globalCompositeOperation = 'source-over';
      /* bords de la zone verte */
      g.strokeStyle = 'rgba(240, 255, 246, 0.95)';
      g.lineWidth = 2;
      g.lineCap = 'round';
      for (const t of z) {
        const a = angOf(t);
        g.beginPath();
        g.moveTo(G.cx + Math.cos(a) * (rIn - 2), G.cy + Math.sin(a) * (rIn - 2));
        g.lineTo(G.cx + Math.cos(a) * (rOut + 2), G.cy + Math.sin(a) * (rOut + 2));
        g.stroke();
      }
      bandC = c;
    }

    /* ---- état ---- */
    const S = {
      level: 0, phase: 'idle', zone: ZONES[0], free: false,
      T: 0, P: 0, kick: 0, entered: false, inZone: false, outT: 0, timer: 0, E: 0,
      Lt: 0.2, inst: 0, sz: 0.8, dy: 0, rip: 0.02, kink: 0, warm: 0, flick: 1,
      ph1: 0, ph2: 0, ph3: 0, ph4: 0, dash: 0, t: 0, phaseT: 0,
      failKind: '', warn: '', flash: 0, flashed: false, toastT: 0, sec: 0, finishAt: 0,
    };
    const presses = new Set();

    /* particules du plasma (sur des surfaces emboîtées), faisceau de chauffage, étincelles */
    const parts = [];
    for (let i = 0; i < 140; i++) {
      parts.push({
        rho: Math.sqrt(rand(0.01, 0.92)), th: rand(TAU), w: rand(0.35, 1.1), sz: rand(0.6, 1.7),
        a: rand(0.35, 1), ph: rand(TAU), hot: Math.random() < 0.3,
      });
    }
    const beam = [];
    for (let i = 0; i < 56; i++) beam.push({ on: false, x: 0, y: 0, v: 0, a: 0, l: 0 });
    const sparks = [];
    for (let i = 0; i < 24; i++) sparks.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 1 });
    let waves = [];
    const pt = { x: 0, y: 0 };

    /* point d'une surface magnétique (rho de 0 au centre à 1 au bord), à l'angle th */
    function surf(rho, th, out) {
      const P = L.pl;
      const a = P.a * rho * S.sz;
      const r2 = rho * rho;
      const pert = 1 + S.rip * r2 * (0.5 * Math.sin(3 * th - S.ph1) + 0.3 * Math.sin(5 * th + S.ph2) + 0.2 * Math.sin(7 * th - S.ph3))
        + S.kink * r2 * Math.sin(2 * th - S.ph4);
      const d = P.d * rho;
      const k = lerp(1.25, P.k, rho);
      out.x = P.cx + P.shift * (1 - r2) * S.sz + a * pert * Math.cos(th + d * Math.sin(th));
      out.y = P.cy + S.dy - k * a * pert * Math.sin(th);
      return out;
    }
    function plasmaPath(rho, n) {
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        surf(rho, (i / n) * TAU, pt);
        if (i) ctx.lineTo(pt.x, pt.y);
        else ctx.moveTo(pt.x, pt.y);
      }
      ctx.closePath();
    }

    /* ---- DOM : années, énergie, points du chrono, combustible, message ---- */
    let shownNum = -1, shownDots = '', shownFuel = -1, shownCap = null;
    function setYears() {
      yrEls.forEach((e, i) => {
        let st = 'next';
        if (S.free || i < S.level || (i === S.level && S.phase === 'win')) st = 'done';
        else if (i === S.level) st = 'now';
        if (e.dataset.state !== st) e.dataset.state = st;
      });
    }
    function buildDots() {
      const n = DUREES[S.level];
      if (dotsEl.childElementCount !== n) {
        dotsEl.textContent = '';
        for (let i = 0; i < n; i++) dotsEl.appendChild(document.createElement('i'));
      }
      shownDots = '';
    }
    function setRead() {
      const v = Math.round(S.E);
      if (v !== shownNum) {
        shownNum = v;
        numEl.textContent = String(v);
      }
      const dur = DUREES[S.level];
      const f = clamp(S.timer / dur);
      const key = Math.round(f * 60) + '/' + dur;
      if (key !== shownDots) {
        shownDots = key;
        const kids = dotsEl.children;
        for (let i = 0; i < kids.length; i++) {
          const fi = clamp(f * kids.length - i);
          kids[i].style.setProperty('--f', fi.toFixed(3));
          kids[i].classList.toggle('is-full', fi >= 1);
        }
      }
      const cap = S.phase === 'win' || S.free ? TEXTES.niveaux[S.level].legende : '';
      if (cap !== shownCap) {
        shownCap = cap;
        capEl.textContent = lib.fr(cap);
      }
      const fuel = S.level === 2 ? 1 - clamp(S.timer / dur) : 1;
      const q = Math.round(fuel * 100);
      if (q !== shownFuel) {
        shownFuel = q;
        tankFill.style.setProperty('--f', (q / 100).toFixed(2));
      }
    }
    function setFuel() {
      const on = S.level === 2;
      if (on && fuelEl.hidden) {
        fuelEl.hidden = false;
        void fuelEl.offsetWidth;
        fuelEl.classList.add('is-on');
      } else if (!on && !fuelEl.hidden) {
        fuelEl.hidden = true;
        fuelEl.classList.remove('is-on');
      }
    }
    function toastOn(text, col, dur) {
      toastEl.textContent = lib.fr(text);
      toastEl.style.setProperty('--tc', col);
      toastEl.classList.add('is-on');
      S.toastT = dur || 0;
    }
    function toastOff() {
      toastEl.classList.remove('is-on');
      S.toastT = 0;
      S.warn = '';
    }
    function showGesture() {
      if (!cv.w) return;
      api.gesture('hold', { x: clamp((L.pl.cx / cv.w) * 100, 8, 92), y: clamp((L.pl.cy / cv.h) * 100, 10, 90) });
    }

    /* ---- déroulé ---- */
    function startLevel(i, retry) {
      S.level = i;
      S.zone = ZONES[i];
      S.phase = 'idle';
      S.phaseT = 0;
      S.entered = false;
      S.inZone = false;
      S.outT = 0;
      S.timer = 0;
      S.sec = 0;
      if (!S.free) S.E = 0;
      else S.timer = DUREES[i];
      S.flashed = false;
      paintBand();
      buildDots();
      setYears();
      setFuel();
      setRead();
      if (!S.free) {
        const N = TEXTES.niveaux[i];
        api.hint(retry ? fill(TEXTES.recommence, N) : N.consigne);
        api.status(N.statut);
        api.progress(i / 3);
        if (!retry) toastOff();
        if (i === 0 || retry) showGesture();
      }
    }

    function init() {
      presses.clear();
      S.free = false;
      S.finishAt = 0;
      S.T = 0;
      S.P = 0;
      S.kick = 0;
      S.Lt = 0.2;
      S.inst = 0;
      S.sz = 0.8;
      S.dy = 0;
      S.flash = 0;
      S.warm = 0;
      S.E = 0;
      waves = [];
      beam.forEach((b) => (b.on = false));
      sparks.forEach((s) => (s.on = false));
      toastOff();
      shownNum = -1;
      shownCap = null;
      shownFuel = -1;
      startLevel(0, false);
    }

    function fail(kind) {
      S.phase = 'fail';
      S.phaseT = 0;
      S.failKind = kind;
      S.flashed = false;
      S.kick = 0;
      if (!S.free) api.hint(kind === 'hot' ? TEXTES.tropChaud : TEXTES.tropFroid);
      toastOn(TEXTES.eteint, kind === 'hot' ? '#FF9F6B' : '#7FB6FF', 1.4);
      api.sfx.play('whoosh', { pitch: 0.5, volume: 0.45, gap: 0 });
      api.sfx.play('fail', { volume: 0.45, gap: 0 });
      api.buzz(12);
    }

    function win() {
      S.phase = 'win';
      S.phaseT = 0;
      S.timer = DUREES[S.level];
      S.E = ENERGIES[S.level];
      const N = TEXTES.niveaux[S.level];
      setYears();
      setRead();
      toastOn(fill(TEXTES.record, N), '#4EE6C8', 2.2);
      api.sfx.play('chime', { pitch: 1.3, gap: 0 });
      api.buzz(14);
      api.hint(S.level < 2 ? TEXTES.finTir : TEXTES.derniere);
      api.status(N.record);
      api.progress((S.level + 1) / 3);
      /* dernier record : on le laisse lire un instant, puis c'est la fête */
      if (S.level === 2) S.finishAt = S.t + 2.2;
    }

    function finish() {
      S.finishAt = 0;
      api.done(TEXTES.fin, TEXTES.finStatut);
      api.guide(null, 'laugh', TEXTES.bravo);
    }

    /* ---- gestes ---- */
    api.track(cv.canvas, {
      down(p) {
        presses.add(p.id);
        waves.push({ x: p.x, y: p.y, t: 0 });
        if (waves.length > 6) waves.shift();
        if (S.phase === 'idle' || S.phase === 'run') {
          if (S.phase === 'idle') {
            S.phase = 'run';
            S.phaseT = 0;
          }
          S.kick += KICK_DOWN;
          api.sfx.play('tick', { pitch: 1.1, volume: 0.5, gap: 50 });
          api.buzz(8);
        } else {
          api.sfx.play('tick', { pitch: 0.75, volume: 0.3, gap: 50 });
        }
      },
      up(p, e, cancelled) {
        presses.delete(p.id);
        if (!cancelled && p.dt < 300 && S.phase === 'run') S.kick += KICK_TAP;
      },
    }, { touchAction: 'pan-y' });

    /* ---- animation ---- */
    function spawnBeam() {
      for (const b of beam) {
        if (b.on) continue;
        const P = L.port;
        b.on = true;
        b.x = P.x1 + rand(0, 8) * L.U;
        b.y = P.y + rand(-0.75, 0.75) * P.hh;
        b.v = rand(230, 330) * L.U;
        b.a = rand(0.5, 1);
        b.l = rand(6, 13) * L.U;
        return;
      }
    }
    function spawnSpark(x, y) {
      for (const s of sparks) {
        if (s.on) continue;
        const a = rand(-Math.PI * 0.92, -Math.PI * 0.08);
        const sp = rand(14, 46) * L.U;
        s.on = true;
        s.x = x + rand(-6, 6) * L.U;
        s.y = y;
        s.vx = Math.cos(a) * sp;
        s.vy = Math.sin(a) * sp;
        s.age = 0;
        s.life = rand(0.7, 1.5);
        return;
      }
    }

    function update(dt) {
      S.t += dt;
      if (!L.pl) return;
      S.phaseT += dt;
      const z = S.zone;
      const running = S.phase === 'run' || S.phase === 'idle';
      const holding = presses.size > 0 && S.phase === 'run';

      /* chauffage lissé, coups de chaleur, refroidissement */
      S.P += ((holding ? 1 : 0) - S.P) * Math.min(1, dt / 0.08);
      if (running) {
        let k = 0;
        if (S.kick > 0) {
          k = Math.min(S.kick, KICK_RATE * dt);
          S.kick -= k;
        }
        const drift = S.phase === 'run' && S.entered ? DRIFT[S.level] * (nz.noise2(S.t * 0.8, S.level * 7.3 + 2) * 2 - 1) : 0;
        S.T += HEAT * S.P * dt + k - (COOL * S.T + LEAK) * dt + drift * dt;
        S.T = clamp(S.T, 0, 1.06);
      } else {
        S.T += (0 - S.T) * Math.min(1, dt * (S.phase === 'fail' ? 2.4 : 1.5));
      }
      if (holding) api.sfx.play('wind', { pitch: 0.7 + S.T * 0.9, volume: 0.2, gap: 420 });

      /* règles du tir */
      if (S.phase === 'run') {
        S.inZone = S.T >= z[0] && S.T <= z[1];
        if (S.inZone) {
          if (!S.entered) {
            S.entered = true;
            api.sfx.play('chime', { pitch: 1, volume: 0.5, gap: 0 });
          }
          S.outT = 0;
          if (S.warn) toastOff();
          if (!S.free) {
            S.timer += dt;
            const dur = DUREES[S.level];
            const sec = Math.floor(S.timer);
            if (sec > S.sec && S.timer < dur) {
              S.sec = sec;
              api.sfx.play('tick', { pitch: 1.6, volume: 0.6, gap: 0 });
            }
            S.E = ENERGIES[S.level] * clamp(S.timer / dur);
            api.progress((S.level + clamp(S.timer / dur)) / 3);
            if (S.timer >= dur) win();
          }
        } else if (S.entered) {
          S.outT += dt;
          const hot = S.T > z[1];
          const w = hot ? 'hot' : 'cold';
          if (S.outT > 0.12 && S.warn !== w) {
            S.warn = w;
            toastOn(hot ? TEXTES.alerteChaud : TEXTES.alerteFroid, hot ? '#FF9F6B' : '#7FB6FF', 0);
            api.sfx.play('tick', { pitch: 0.6, volume: 0.6, gap: 0 });
          }
          if (S.outT > GRACE) fail(w);
        }
      } else {
        S.inZone = false;
      }
      if (S.phase === 'fail' && S.phaseT > FAIL_T) {
        if (S.free) {
          S.phase = 'idle';
          S.phaseT = 0;
          S.entered = false;
        } else {
          startLevel(S.level, true);
        }
      }
      if (S.phase === 'win' && S.phaseT > WIN_T) {
        if (S.level < 2) startLevel(S.level + 1, false);
        else {
          S.free = true;
          startLevel(2, false);
        }
      }
      if (S.finishAt && S.t >= S.finishAt) finish();
      if (S.toastT > 0) {
        S.toastT -= dt;
        if (S.toastT <= 0) toastOff();
      }

      /* allure du plasma */
      const hotK = clamp((S.T - z[1]) / 0.06);
      let instT = S.phase === 'run' ? hotK : 0;
      let szT = lerp(0.66, 1, ease.outQuad(clamp(S.T / 0.6))) + 0.05 * hotK;
      let dyT = 0;
      let LtT;
      if (S.phase === 'idle') LtT = 0.32 + 0.06 * Math.sin(S.t * 1.7 * AMB);
      else if (S.phase === 'run') LtT = Math.max(0.32, clamp((S.T - 0.04) / 0.42));
      else if (S.phase === 'win') LtT = Math.max(0.32, clamp((S.T - 0.04) / 0.42));
      else LtT = 0;
      if (S.phase === 'fail') {
        if (S.failKind === 'hot') {
          const k = clamp(S.phaseT / 0.45);
          instT = 1;
          szT = 1.08;
          dyT = L.av * 0.55 * ease.inQuad(k);
          LtT = S.phaseT < 0.45 ? 1 : 0;
          if (!S.flashed && S.phaseT > 0.42) {
            S.flashed = true;
            S.flash = 1;
            for (let i = 0; i < 14; i++) spawnSpark(L.contact.x, L.contact.y);
            api.sfx.play('thud', { pitch: 1.4, volume: 0.35, gap: 0 });
          }
        } else {
          szT = 0.45;
          LtT = 0;
        }
      }
      const up = LtT > S.Lt;
      S.Lt += (LtT - S.Lt) * Math.min(1, dt / (up ? 0.16 : S.phase === 'fail' ? 0.45 : 0.3));
      S.inst += (instT - S.inst) * Math.min(1, dt / 0.25);
      S.sz += (szT - S.sz) * Math.min(1, dt / (S.phase === 'fail' ? 0.5 : 0.3));
      S.dy += (dyT - S.dy) * Math.min(1, dt / 0.12);
      S.rip = (0.03 + 0.08 * S.inst) * (RMO ? 0.5 : 1);
      S.kink = 0.1 * S.inst * (S.phase === 'fail' ? 1.5 : 1);
      S.flick = S.inst > 0.05 ? 1 - S.inst * 0.22 * (0.5 + 0.5 * Math.sin(S.t * 31) * Math.sin(S.t * 17)) : 1;
      const sp = (0.6 + 0.9 * clamp(S.T) + 2.2 * S.inst) * AMB;
      S.ph1 += dt * 1.3 * sp;
      S.ph2 += dt * 1.7 * sp;
      S.ph3 += dt * 2.3 * sp;
      S.ph4 += dt * (2.5 + 5 * S.inst) * (RMO ? 0.5 : 1);
      S.dash += dt * (10 + 30 * clamp(S.T)) * AMB;
      S.warm += ((S.phase === 'run' ? clamp(S.T) : 0) - S.warm) * Math.min(1, dt / 0.8);
      S.flash = Math.max(0, S.flash - dt * 1.4);

      for (const p of parts) {
        p.th += p.w * dt * (0.25 + 0.9 * clamp(S.T) + 1.6 * S.inst) * AMB;
      }
      /* faisceau de chauffage : il part du port et plonge dans le plasma */
      if (S.P > 0.05 && Math.random() < dt * 70 * S.P) spawnBeam();
      const xEnd = L.pl.cx + L.pl.a * 0.25;
      for (const b of beam) {
        if (!b.on) continue;
        b.x -= b.v * dt;
        if (b.x < xEnd) b.on = false;
      }
      for (const s of sparks) {
        if (!s.on) continue;
        s.age += dt;
        if (s.age >= s.life) {
          s.on = false;
          continue;
        }
        s.vy += 30 * L.U * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
      }
      waves = waves.filter((wv) => (wv.t += dt) < 0.6);
      setRead();
    }

    /* ---- dessin ---- */
    const RAMP_EDGE = [[0, '#3C1F6E'], [0.4, '#9A3FD6'], [0.7, '#FF5FD0'], [1, '#FFB0EA']];
    function drawPlasma() {
      const P = L.pl;
      const Lt = S.Lt * S.flick;
      /* même éteint, le gaz garde une petite lueur violette */
      const tc = Math.max(0.28, clamp(S.T / 0.85)) * (S.phase === 'fail' && S.failKind === 'cold' ? 0.5 : 1);
      ctx.save();
      ctx.beginPath();
      pathPts(ctx, L.vIn);
      ctx.clip();
      ctx.globalCompositeOperation = 'lighter';
      /* la paroi renvoie un peu de la lueur rose */
      if (Lt > 0.02) {
        ctx.strokeStyle = rgba('#FF6FD8', 0.16 * Lt);
        ctx.lineWidth = L.tw * 1.8;
        ctx.beginPath();
        pathPts(ctx, L.vIn);
        ctx.stroke();
      }
      /* halo */
      ctx.save();
      ctx.translate(P.cx, P.cy + S.dy);
      ctx.scale(1, P.k * 0.92);
      draw.glow(ctx, 0, 0, P.a * S.sz * 1.85, hexMix('#7A34C8', '#FF6FD8', tc), 0.45 * Lt);
      ctx.restore();
      /* couches emboîtées : du bord violet au cœur presque blanc */
      const layers = 16;
      for (let i = 0; i < layers; i++) {
        const k = i / (layers - 1);
        const rho = 1.05 - Math.pow(k, 0.85) * 0.93;
        const al = (0.075 + 0.04 * k) * Lt * (i === 0 ? 0.6 : 1);
        plasmaPath(rho, 72);
        ctx.fillStyle = k < 0.5
          ? lib.ramp(RAMP_EDGE, tc * (0.75 + k * 0.5), al)
          : lib.mix('#FF8FE0', '#FFF2FB', (k - 0.5) * 2 * (0.5 + 0.5 * tc), al);
        ctx.fill();
      }
      /* lignes de champ qui défilent */
      if (Lt > 0.05) {
        ctx.setLineDash([6 * L.U, 9 * L.U]);
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
          const rho = 0.38 + i * 0.25;
          ctx.lineDashOffset = -S.dash * (1 + i * 0.3);
          ctx.strokeStyle = rgba('#FFE3F7', (0.16 + 0.06 * i) * Lt);
          plasmaPath(rho, 72);
          ctx.stroke();
        }
        ctx.setLineDash([]);
      }
      /* particules */
      for (const p of parts) {
        surf(p.rho, p.th, pt);
        const tw = 0.7 + 0.3 * Math.sin(S.t * 3 + p.ph);
        const a = p.a * tw * Lt * (p.hot ? 1 : 0.7);
        if (a < 0.03) continue;
        const jit = S.inst * 2.2 * L.U;
        const x = pt.x + (jit ? rand(-jit, jit) : 0);
        const y = pt.y + (jit ? rand(-jit, jit) : 0);
        ctx.fillStyle = p.hot ? rgba('#FFF4FC', a) : rgba('#FF9BE6', a);
        const s = p.sz * L.U;
        ctx.fillRect(x - s / 2, y - s / 2, s, s);
      }
      /* points d'impact dans le divertor */
      if (Lt > 0.3 && S.phase !== 'fail') {
        const a = (Lt - 0.3) / 0.7;
        for (const sp of L.strike) draw.glow(ctx, sp.x, sp.y, L.av * 0.22, '#FF8FE0', 0.5 * a * (0.8 + 0.2 * Math.sin(S.t * 9 + sp.x)));
      }
      /* le plasma touche la paroi : une lueur douce, puis plus rien */
      if (S.flash > 0) {
        draw.glow(ctx, L.contact.x, L.contact.y, L.av * 0.9, '#FFD6F2', 0.75 * S.flash);
        draw.glow(ctx, L.contact.x, L.contact.y, L.av * 0.35, '#FFFFFF', 0.6 * S.flash);
      }
      ctx.restore();
      ctx.globalCompositeOperation = 'source-over';
    }

    function drawBeam() {
      const P = L.port;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      if (S.P > 0.02) {
        draw.glow(ctx, P.x0 + (P.x1 - P.x0) * 0.4, P.y, (P.x1 - P.x0) * 0.6, '#4EE6C8', 0.18 * S.P);
      }
      ctx.lineCap = 'round';
      ctx.lineWidth = 1.6 * L.U;
      for (const b of beam) {
        if (!b.on) continue;
        const fadeIn = clamp((L.port.x1 - b.x) / (12 * L.U) + 0.3);
        const fadeOut = clamp((b.x - (L.pl.cx + L.pl.a * 0.25)) / (L.pl.a * 0.6));
        const a = b.a * fadeIn * fadeOut;
        ctx.strokeStyle = rgba('#B8FFF0', a);
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x + b.l, b.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawSparks() {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const s of sparks) {
        if (!s.on) continue;
        const k = s.age / s.life;
        ctx.fillStyle = rgba(k < 0.4 ? '#FFE6F6' : '#FF9F6B', 0.85 * (1 - k));
        const r = 1.3 * L.U * (1 - k * 0.5);
        ctx.beginPath();
        ctx.arc(s.x, s.y, r, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }

    function zoneCol() {
      const z = S.zone;
      if (S.T < z[0]) return '#5FB8FF';
      if (S.T <= z[1]) return '#6BE79B';
      return '#FF8A5A';
    }

    function drawGauge() {
      const G = L.g, R = G.r;
      if (bandC) ctx.drawImage(bandC, 0, 0, cv.w, cv.h);
      const z = S.zone;
      /* la zone verte s'illumine quand l'aiguille y est */
      const rM = R * 0.895, bwd = R * 0.21;
      const lit = (t0, t1, col, a) => {
        ctx.strokeStyle = rgba(col, a);
        ctx.lineWidth = bwd;
        ctx.beginPath();
        ctx.arc(G.cx, G.cy, rM, angOf(t0), angOf(t1));
        ctx.stroke();
        ctx.strokeStyle = rgba(col, a * 0.9);
        ctx.lineWidth = 2.5 * L.U;
        ctx.beginPath();
        ctx.arc(G.cx, G.cy, R + 5 * L.U, angOf(t0), angOf(t1));
        ctx.stroke();
      };
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'butt';
      if (S.inZone) lit(z[0], z[1], '#9CFFC4', 0.26 + 0.1 * Math.sin(S.t * 8));
      /* alerte : la partie trop froide ou trop chaude clignote */
      if (S.warn === 'hot') lit(z[1], 1, '#FFB08A', 0.3 + 0.22 * Math.sin(S.t * 14));
      else if (S.warn === 'cold') lit(0, z[0], '#9CCBFF', 0.3 + 0.22 * Math.sin(S.t * 14));
      ctx.restore();

      /* aiguille */
      const shake = S.inst * 0.012 * Math.sin(S.t * 41) + (S.phase === 'run' ? 0.002 * Math.sin(S.t * 23) : 0);
      const a = angOf(S.T + shake);
      const len = R * 1.04, tail = R * 0.14, bw = R * 0.05;
      const shape = () => {
        ctx.beginPath();
        ctx.moveTo(-tail, -bw * 0.85);
        ctx.lineTo(len - bw, -bw * 0.22);
        ctx.quadraticCurveTo(len + bw * 0.3, 0, len - bw, bw * 0.22);
        ctx.lineTo(-tail, bw * 0.85);
        ctx.quadraticCurveTo(-tail - bw, 0, -tail, -bw * 0.85);
        ctx.closePath();
      };
      ctx.save();
      ctx.translate(G.cx + 2 * L.U, G.cy + 3 * L.U);
      ctx.rotate(a);
      shape();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.translate(G.cx, G.cy);
      ctx.rotate(a);
      shape();
      const ng = ctx.createLinearGradient(0, -bw, 0, bw);
      ng.addColorStop(0, '#FFFFFF');
      ng.addColorStop(0.55, '#DCEFEC');
      ng.addColorStop(1, '#93ADAA');
      ctx.fillStyle = ng;
      ctx.fill();
      ctx.restore();
      const tx = G.cx + Math.cos(a) * R * 0.9, ty = G.cy + Math.sin(a) * R * 0.9;
      ctx.globalCompositeOperation = 'lighter';
      draw.glow(ctx, tx, ty, R * 0.2, zoneCol(), 0.55);
      ctx.globalCompositeOperation = 'source-over';
      /* moyeu */
      const hr = R * 0.1;
      const hg = ctx.createRadialGradient(G.cx - hr * 0.35, G.cy - hr * 0.4, hr * 0.1, G.cx, G.cy, hr);
      hg.addColorStop(0, '#F2FBFA');
      hg.addColorStop(0.6, '#8FAEAB');
      hg.addColorStop(1, '#3E5655');
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.arc(G.cx, G.cy, hr, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#20393A';
      ctx.beginPath();
      ctx.arc(G.cx, G.cy, hr * 0.32, 0, TAU);
      ctx.fill();
    }

    function render() {
      if (!bg) return;
      ctx.drawImage(bg, 0, 0, cv.w, cv.h);
      /* le chauffage réchauffe un peu toute la scène */
      if (S.warm > 0.01) {
        ctx.globalCompositeOperation = 'lighter';
        draw.glow(ctx, L.pl.cx, L.pl.cy, L.av * 2.4, '#3A1E4A', 0.35 * S.warm * S.Lt);
        ctx.globalCompositeOperation = 'source-over';
      }
      drawBeam();
      drawPlasma();
      drawSparks();
      drawGauge();
      for (const wv of waves) {
        const k = wv.t / 0.6;
        ctx.strokeStyle = rgba('#E6FFF8', 0.65 * (1 - k));
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(wv.x, wv.y, lerp(8, 34, ease.outCubic(k)) * L.U, 0, TAU);
        ctx.stroke();
      }
    }

    cv.onResize((w, h) => {
      layout(w, h);
      topBar.classList.toggle('je-narrow', w < 340);
      bg = paintBg();
      paintBand();
      toastEl.style.left = (L.pl.cx / w) * 100 + '%';
      toastEl.style.top = ((L.cy - L.H * 0.7) / h) * 100 + '%';
      if (S.phase === 'idle' && S.level === 0 && !S.free && S.t < 1) showGesture();
    });

    api.loop((dt) => {
      update(dt);
      render();
    });

    /* pour les tests automatiques */
    api.root.__jet = () => ({
      phase: S.phase, level: S.level, T: S.T, zone: S.zone, timer: S.timer, E: S.E, free: S.free,
      inZone: S.inZone, entered: S.entered,
    });

    api.onReset(init);
    init();
    update(0.016);
    render();
  };
})();
