/* La couverture invisible : le Soleil chauffe le sol, le sol renvoie des infrarouges.
   Les molécules de CO2 les attrapent et en renvoient une partie vers le sol.
   On règle l'épaisseur de la couverture pour amener la Terre de −18 °C à 15 °C.
   Version des petits : quatre touches suffisent, zone verte large, toucher le ciel ajoute
   toujours (le bouton enlève), et le doigt fantôme montre ce bouton si on en met trop. */
(function () {
  'use strict';
  const { lib } = window.RM;
  const { TAU, rand, clamp, lerp, invLerp, ease, rgba, draw } = lib;

  /* Tous les textes du jeu, faciles à corriger */
  const TEXTES = {
    temperature: (t) => `Température : ${degres(t)}`,
    ajouter: 'Ajouter du CO2',
    enlever: 'Enlever du CO2',
    tropChaud: 'Trop chaud ! Enlève un peu de CO2.',
    zoneChaude: 'trop chaud',
    scene: 'Le ciel de la Terre : touche-le pour ajouter du CO2. Le bouton « Enlever du CO2 » en retire.',
    fin: '15 °C : juste assez de couverture !',
    finStatut: 'Avec trop de couverture, la Terre aurait de la fièvre.',
  };
  /* −18 → « −18 °C » (vrai signe moins, espace insécable) */
  function degres(t, court) {
    let r = Math.round(t);
    if (r === 0) r = 0;
    return (r < 0 ? '−' : '') + Math.abs(r) + (court ? '°' : ' °C');
  }

  /* Modèle schématique : 0 molécule → −18 °C, 4 molécules → 15 °C, 8 molécules → 42 °C ;
     une courbe douce passe par ces trois points (environ 7 à 9 °C de plus par molécule). */
  const MAX_MOL = 8;
  const tempOf = (n) => -18 + 9 * n - 0.1875 * n * n;
  const ZONE_MIN = 10, ZONE_MAX = 20;   /* la zone verte du thermomètre (seules 4 molécules y tombent) */
  const HOT_FROM = 30;                  /* début de la zone rouge « trop chaud » */
  const T_MIN = -25, T_MAX = 55;        /* échelle du thermomètre */
  const HOLD = 1.2;                     /* secondes dans la zone verte pour réussir */

  const CSS = `
.game[data-game="serre"] .se-bar {
  position: absolute; left: 8px; right: 8px; bottom: 10px; z-index: 3;
  display: flex; justify-content: center; gap: 8px; pointer-events: none;
}
.game[data-game="serre"] .se-bar .chip { pointer-events: auto; flex: 0 1 auto; min-width: 0; white-space: nowrap; transition: opacity 0.25s, transform 0.15s; }
.game[data-game="serre"] .se-bar .chip svg { width: 16px; height: 16px; flex: none; fill: none; stroke: currentColor; stroke-width: 2.8; stroke-linecap: round; }
.game[data-game="serre"] .se-bar .se-add { background: #FFE3D8; color: #5C1D08; }
.game[data-game="serre"] .se-bar .se-del { background: rgba(234, 246, 248, 0.94); color: #0F2733; }
.game[data-game="serre"] .se-bar.is-narrow { gap: 6px; }
.game[data-game="serre"] .se-bar.is-narrow .chip { font-size: 0.84rem; padding-inline: 10px; gap: 0.3em; }
.game[data-game="serre"] .se-bar.is-tiny .chip svg { display: none; }
.game[data-game="serre"] .se-hot {
  position: absolute; z-index: 2; margin: 0; pointer-events: none;
  font: 700 0.75rem/1.1 var(--font-text); color: #FFB199; letter-spacing: 0.02em; white-space: nowrap;
  transform: translate(-100%, -50%);
}
.game[data-game="serre"] .se-read {
  position: absolute; z-index: 2; margin: 0; pointer-events: none;
  font: 800 0.75rem/1 var(--font-text); color: #FFFFFF; white-space: nowrap;
  font-variant-numeric: tabular-nums; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
  transform: translate(-50%, -50%);
}
`;

  function seeded(seed) {
    let s = seed >>> 0 || 1;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }
  function age(list, dt) {
    let j = 0;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      e.t += dt;
      if (e.t < e.dur) list[j++] = e;
    }
    list.length = j;
  }

  window.RM.games.serre = function (api) {
    const cv = api.canvas();
    const ctx = cv.ctx;
    const stage = api.stage;
    const AMB = api.reducedMotion ? 0.35 : 1;
    api.style(CSS);
    const FONT = getComputedStyle(document.body).fontFamily;

    /* ---- boutons et étiquettes ---- */
    const ICON_PLUS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
    const ICON_MINUS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>';
    const bar = document.createElement('div');
    bar.className = 'se-bar';
    function chip(text, icon, cls) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip ' + cls;
      b.innerHTML = icon + '<span></span>';
      b.lastChild.textContent = lib.fr(text);
      bar.appendChild(b);
      return b;
    }
    const btnAdd = chip(TEXTES.ajouter, ICON_PLUS, 'se-add');
    const btnDel = chip(TEXTES.enlever, ICON_MINUS, 'se-del');
    stage.appendChild(bar);
    const lbHot = document.createElement('p');
    lbHot.className = 'se-hot';
    lbHot.setAttribute('aria-hidden', 'true');
    lbHot.textContent = lib.fr(TEXTES.zoneChaude);
    stage.appendChild(lbHot);
    const readout = document.createElement('p');
    readout.className = 'se-read';
    readout.setAttribute('aria-hidden', 'true');
    stage.appendChild(readout);
    cv.canvas.setAttribute('role', 'img');
    cv.canvas.removeAttribute('aria-hidden');
    cv.canvas.setAttribute('aria-label', lib.fr(TEXTES.scene));

    /* ---- géométrie ---- */
    const G = {
      w: 1, h: 1, s: 1, atmTop: 0, yg: 0, sunX: 0, sunY: 0, sunR: 10,
      tx: 0, tubeW: 16, tubeTop: 0, bulbY: 0, bulbR: 16, scaleTop: 0, scaleBot: 1,
      mx0: 0, mx1: 1, my0: 0, my1: 1, lake0: 0, lake1: 0, lakeY: 0, landTop: 0, landH: 1,
    };
    const yOfT = (t) => lerp(G.scaleBot, G.scaleTop, invLerp(T_MIN, T_MAX, t));
    /* Relief du sol (collines douces), avec un petit lac au milieu */
    function groundY(x) {
      const { w, h } = G;
      let y = G.yg + h * 0.022 * Math.sin((x / w) * TAU * 0.85 + 0.7) + h * 0.01 * Math.sin((x / w) * TAU * 2.2 + 2.1);
      if (x > G.lake0 && x < G.lake1) {
        const k = Math.sin(Math.PI * (x - G.lake0) / (G.lake1 - G.lake0));
        y = Math.max(y, G.lakeY + k * h * 0.035);
      }
      return y;
    }

    let bg = null, landBien = null, landFroid = null, landChaud = null, thermo = null;
    let spC = null, spO = null, glowSp = null;
    let hazeHot = null, hazeCold = null, groundGlow = null;

    function mk(wc, hc) {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(wc * cv.dpr));
      c.height = Math.max(1, Math.round(hc * cv.dpr));
      const g = c.getContext('2d');
      g.scale(cv.dpr, cv.dpr);
      return { c, g, w: wc, h: hc };
    }

    function profilePath(g, x0, x1, bottom) {
      g.beginPath();
      g.moveTo(x0, bottom);
      for (let x = x0; x <= x1 + 0.1; x += 3) g.lineTo(x, groundY(x));
      g.lineTo(x1, bottom);
      g.closePath();
    }

    /* Le décor fixe : l'espace, le Soleil, la bande d'atmosphère et les strates du sous-sol. */
    function makeBg() {
      const { w, h, atmTop, yg } = G;
      const B = mk(w, h);
      const g = B.g;
      g.fillStyle = '#081820';
      g.fillRect(0, 0, w, h);
      let gr = g.createLinearGradient(0, 0, 0, atmTop + 20);
      gr.addColorStop(0, '#02070B');
      gr.addColorStop(1, '#0A1F2B');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, atmTop + 20);
      const r = seeded(5);
      for (let i = 0; i < 70; i++) {
        const x = r() * w, y = r() * (atmTop - 6);
        const s = 0.5 + r() * 1.1;
        g.fillStyle = `rgba(235,246,255,${0.2 + r() * 0.55})`;
        g.fillRect(x, y, s, s);
      }
      /* l'atmosphère : un voile bleu, plus dense près du sol */
      gr = g.createLinearGradient(0, atmTop - 16, 0, yg + 10);
      gr.addColorStop(0, 'rgba(90,165,210,0)');
      gr.addColorStop(0.08, 'rgba(90,165,210,0.16)');
      gr.addColorStop(0.55, 'rgba(98,176,218,0.27)');
      gr.addColorStop(1, 'rgba(140,205,235,0.48)');
      g.fillStyle = gr;
      g.fillRect(0, atmTop - 16, w, yg + 10 - (atmTop - 16));
      /* bord de l'atmosphère : un liseré lumineux */
      gr = g.createLinearGradient(0, atmTop - 7, 0, atmTop + 7);
      gr.addColorStop(0, 'rgba(160,220,245,0)');
      gr.addColorStop(0.5, 'rgba(160,220,245,0.22)');
      gr.addColorStop(1, 'rgba(160,220,245,0)');
      g.fillStyle = gr;
      g.fillRect(0, atmTop - 7, w, 14);
      /* le Soleil, dans un coin */
      g.globalCompositeOperation = 'lighter';
      draw.glow(g, G.sunX, G.sunY, G.sunR * 5.5, '#FFB347', 0.2);
      draw.glow(g, G.sunX, G.sunY, G.sunR * 2.6, '#FFC857', 0.4);
      g.globalCompositeOperation = 'source-over';
      gr = g.createRadialGradient(G.sunX - G.sunR * 0.3, G.sunY - G.sunR * 0.3, G.sunR * 0.1, G.sunX, G.sunY, G.sunR);
      gr.addColorStop(0, '#FFFBE8');
      gr.addColorStop(0.5, '#FFE08A');
      gr.addColorStop(1, '#FFA640');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(G.sunX, G.sunY, G.sunR, 0, TAU);
      g.fill();
      /* le sous-sol : des strates de terre et de roche */
      const layers = [
        [0, '#5A4030', '#3E2B20'],
        [0.07, '#8A6238', '#6C4A2A'],
        [0.15, '#4C525C', '#363B43'],
      ];
      const n = lib.makeNoise(17);
      layers.forEach(([dy, top, bot], i) => {
        const y0 = yg + dy * h;
        g.beginPath();
        g.moveTo(0, h);
        for (let x = 0; x <= w + 3; x += 3) {
          const base = i === 0 ? groundY(x) : y0 + (n.noise2(x / 60, i * 3) - 0.5) * h * 0.03 + (groundY(x) - yg) * 0.5;
          g.lineTo(x, base);
        }
        g.lineTo(w, h);
        g.closePath();
        const lg = g.createLinearGradient(0, y0, 0, h);
        lg.addColorStop(0, top);
        lg.addColorStop(1, bot);
        g.fillStyle = lg;
        g.fill();
      });
      /* cailloux et grains */
      for (let i = 0; i < 90; i++) {
        const x = r() * w, y = yg + h * 0.03 + r() * (h - yg);
        if (y < groundY(x) + 6) continue;
        g.fillStyle = r() < 0.5 ? `rgba(20,14,10,${0.2 + r() * 0.3})` : `rgba(220,200,170,${0.08 + r() * 0.14})`;
        draw.blob(g, x, y, 1 + r() * 2.6, 0.3, i, 0, 10);
        g.fill();
      }
      return B;
    }

    /* Le plan commun aux trois paysages : herbe, fleurs, arbres. */
    let LAY = null;
    function makeLayout() {
      const { w, h, s: sc } = G;
      const r = seeded(3);
      const blades = [], flowers = [];
      for (let i = 0; i < 120; i++) {
        const x = r() * (G.tx - G.tubeW * 2);
        const hh = (3 + r() * 5) * sc, b1 = (r() - 0.5) * 3, b2 = (r() - 0.5) * 4, c = r() < 0.5 ? 0 : 1;
        if (x > G.lake0 - 2 && x < G.lake1 + 2) continue;
        blades.push({ x, y: groundY(x) + 1, hh, b1, b2, c });
      }
      for (let i = 0; i < 16; i++) {
        const x = r() * (G.tx - G.tubeW * 2);
        if (x > G.lake0 && x < G.lake1) continue;
        flowers.push({ x, y: groundY(x) - 2.5 * sc, c: i % 4 });
      }
      const trees = [0.07, 0.18, 0.3, 0.66].map((fx, i) => {
        const x = fx * w;
        return { x, y: groundY(x) + 2, th: h * (0.05 + (i % 2) * 0.012), cr: h * (0.03 + (i % 2) * 0.006) };
      });
      LAY = { blades, flowers, trees };
    }

    /* Trois versions du paysage (gelé, vert, desséché), mêlées selon la température. */
    function makeLand(kind) {
      const { w, h, s } = G;
      const L = mk(w, G.landH);
      const g = L.g;
      g.translate(0, -G.landTop);
      const r = seeded(kind === 'bien' ? 3 : kind === 'froid' ? 7 : 11);
      const C = {
        bien: { top: '#5DB04E', mid: '#3D8B3E', edge: '#2B6B33' },
        froid: { top: '#F4F9FD', mid: '#D5E7F3', edge: '#AFCBE0' },
        chaud: { top: '#D9B04E', mid: '#B98935', edge: '#8E6328' },
      }[kind];
      /* la couche de surface : herbe, neige ou terre sèche */
      g.save();
      profilePath(g, 0, w, groundY(0) + h * 0.06);
      g.clip();
      const gr = g.createLinearGradient(0, G.yg - h * 0.04, 0, G.yg + h * 0.06);
      gr.addColorStop(0, C.top);
      gr.addColorStop(0.45, C.mid);
      gr.addColorStop(1, rgba(C.edge, 0));
      g.fillStyle = gr;
      g.fillRect(0, G.yg - h * 0.06, w, h * 0.14);
      g.restore();
      g.strokeStyle = rgba(kind === 'froid' ? '#FFFFFF' : C.top, 0.8);
      g.lineWidth = 1.5;
      g.beginPath();
      for (let x = 0; x <= w; x += 3) {
        if (x > G.lake0 + 4 && x < G.lake1 - 4) { g.moveTo(x + 3, groundY(x + 3)); continue; }
        if (x === 0) g.moveTo(x, groundY(x)); else g.lineTo(x, groundY(x));
      }
      g.stroke();
      /* le lac */
      const lx0 = G.lake0 + 3, lx1 = G.lake1 - 3;
      g.beginPath();
      g.moveTo(lx0, G.lakeY);
      for (let x = lx0; x <= lx1; x += 2) g.lineTo(x, groundY(x));
      g.lineTo(lx1, G.lakeY);
      g.closePath();
      if (kind === 'bien') {
        const lg = g.createLinearGradient(0, G.lakeY, 0, G.lakeY + h * 0.035);
        lg.addColorStop(0, '#5FB8E6');
        lg.addColorStop(1, '#1D5F93');
        g.fillStyle = lg;
        g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.55)';
        g.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
          const yy = G.lakeY + 2 + i * 3;
          const xa = lerp(lx0, lx1, 0.2 + i * 0.12), xb = lerp(lx0, lx1, 0.45 + i * 0.1);
          g.beginPath();
          g.moveTo(xa, yy);
          g.lineTo(xb, yy);
          g.stroke();
        }
      } else if (kind === 'froid') {
        const lg = g.createLinearGradient(0, G.lakeY, 0, G.lakeY + h * 0.035);
        lg.addColorStop(0, '#EAF6FD');
        lg.addColorStop(1, '#9CC8E6');
        g.fillStyle = lg;
        g.fill();
        g.save();
        g.clip();
        g.strokeStyle = 'rgba(110,160,200,0.6)';
        g.lineWidth = 0.8;
        for (let i = 0; i < 6; i++) {
          let x = lerp(lx0, lx1, r()), y = G.lakeY + 1;
          g.beginPath();
          g.moveTo(x, y);
          for (let k = 0; k < 4; k++) {
            x += (r() - 0.5) * 14 * s;
            y += r() * 5 * s;
            g.lineTo(x, y);
          }
          g.stroke();
        }
        g.restore();
      } else {
        const lg = g.createLinearGradient(0, G.lakeY, 0, G.lakeY + h * 0.035);
        lg.addColorStop(0, '#C9A57A');
        lg.addColorStop(1, '#8C6A48');
        g.fillStyle = lg;
        g.fill();
        g.save();
        g.clip();
        g.strokeStyle = 'rgba(70,40,20,0.65)';
        g.lineWidth = 0.9;
        for (let i = 0; i < 9; i++) {
          let x = lerp(lx0, lx1, r()), y = G.lakeY + r() * 3;
          g.beginPath();
          g.moveTo(x, y);
          for (let k = 0; k < 3; k++) {
            x += (r() - 0.5) * 12 * s;
            y += (r() - 0.3) * 4 * s;
            g.lineTo(x, y);
          }
          g.stroke();
        }
        g.restore();
      }
      /* Herbe, fleurs et arbres : les mêmes formes dans les trois paysages (seules les
         couleurs changent), pour que le fondu de l'un à l'autre ne laisse rien transparaître. */
      const P = {
        bien: { blade: ['#7CCB5E', '#4E9E45'], flower: ['#FFE07A', '#FF9FB0', '#FFFFFF', '#C9A2FF'], trunk: '#5E4330',
          leaf: ['#2F7A36', '#3A8C3E', '#4BA048', '#5DB451'], shine: 'rgba(255,255,255,0.14)' },
        froid: { blade: ['#EAF5FB', '#BFD8EA'], flower: ['#FFFFFF', '#E3F0F8', '#FFFFFF', '#D4E8F5'], trunk: '#5B4636',
          leaf: ['#B9D2E4', '#CFE2EF', '#F3F8FC', '#E2EEF6'], shine: 'rgba(255,255,255,0.6)' },
        chaud: { blade: ['#E8C873', '#B88B3E'], flower: ['#9A6B35', '#B07A3C', '#8A5A2B', '#A87038'], trunk: '#5A3E2A',
          leaf: ['#8E5222', '#AC6A2A', '#C7873A', '#D39A48'], shine: 'rgba(255,230,170,0.16)' },
      }[kind];
      for (const b of LAY.blades) {
        g.strokeStyle = rgba(P.blade[b.c], 0.92);
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(b.x, b.y);
        g.quadraticCurveTo(b.x + b.b1, b.y - b.hh * 0.6, b.x + b.b2, b.y - b.hh);
        g.stroke();
      }
      for (const f of LAY.flowers) {
        g.fillStyle = P.flower[f.c];
        g.beginPath();
        g.arc(f.x, f.y, 1.4 * s, 0, TAU);
        g.fill();
      }
      LAY.trees.forEach((t, i) => {
        const { x, y, th, cr } = t;
        g.strokeStyle = P.trunk;
        g.lineWidth = 3 * s;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x, y - th);
        g.stroke();
        g.lineWidth = 1.6 * s;
        g.beginPath();
        g.moveTo(x, y - th * 0.55);
        g.lineTo(x - cr * 0.7, y - th - cr * 0.15);
        g.moveTo(x, y - th * 0.7);
        g.lineTo(x + cr * 0.75, y - th - cr * 0.25);
        g.stroke();
        g.lineCap = 'butt';
        const cy = y - th - cr * 0.3;
        [[-0.45, 0.15, 0.75], [0.45, 0.1, 0.72], [0, -0.3, 0.85], [-0.1, -0.05, 0.6]].forEach(([dx, dy, k], j) => {
          g.fillStyle = P.leaf[j];
          draw.blob(g, x + dx * cr, cy + dy * cr, cr * k, 0.12, i * 3 + j, 0, 18);
          g.fill();
        });
        g.fillStyle = P.shine;
        draw.blob(g, x - cr * 0.2, cy - cr * 0.6, cr * 0.38, 0.12, i, 0, 12);
        g.fill();
        if (kind === 'chaud') {
          /* feuilles grillées : quelques taches sombres */
          g.fillStyle = 'rgba(80,40,15,0.35)';
          for (let k = 0; k < 4; k++) {
            draw.blob(g, x + (r() - 0.5) * cr * 1.4, cy + (r() - 0.5) * cr, cr * 0.16, 0.3, k + i, 0, 8);
            g.fill();
          }
        }
      });
      /* givre qui scintille, ou craquelures de sécheresse */
      if (kind === 'froid') {
        for (let i = 0; i < 40; i++) {
          const x = r() * w;
          const y = groundY(x) + r() * h * 0.03;
          g.fillStyle = `rgba(255,255,255,${0.5 + r() * 0.5})`;
          g.fillRect(x, y, 1.2, 1.2);
        }
      } else if (kind === 'chaud') {
        g.strokeStyle = 'rgba(90,55,25,0.45)';
        g.lineWidth = 0.8;
        for (let i = 0; i < 22; i++) {
          let x = r() * w;
          if (x > G.lake0 && x < G.lake1) continue;
          let y = groundY(x) + 2 + r() * h * 0.02;
          g.beginPath();
          g.moveTo(x, y);
          for (let k = 0; k < 3; k++) {
            x += (r() - 0.5) * 9 * s;
            y += r() * 3 * s;
            g.lineTo(x, y);
          }
          g.stroke();
        }
      }
      return L;
    }

    /* Le thermomètre, sans son liquide : verre, graduations, zone verte et zone rouge. */
    function makeThermo() {
      const { tx, tubeW, tubeTop, bulbY, bulbR } = G;
      const T = mk(G.w, G.h);
      const g = T.g;
      const half = tubeW / 2;
      const yHot = yOfT(HOT_FROM), yTop = tubeTop;
      /* ombre douce */
      g.fillStyle = 'rgba(0,0,0,0.25)';
      draw.roundRect(g, tx - half - 3, yTop - 3, tubeW + 6, bulbY - yTop + 6, half + 3);
      g.fill();
      /* verre */
      g.fillStyle = 'rgba(230,245,250,0.16)';
      draw.roundRect(g, tx - half, yTop, tubeW, bulbY - yTop, half);
      g.fill();
      g.beginPath();
      g.arc(tx, bulbY, bulbR, 0, TAU);
      g.fill();
      /* zone rouge en haut */
      const gr = g.createLinearGradient(0, yTop, 0, yHot);
      gr.addColorStop(0, 'rgba(255,78,58,0.55)');
      gr.addColorStop(1, 'rgba(255,122,77,0.18)');
      g.fillStyle = gr;
      draw.roundRect(g, tx - half + 2, yTop + 2, tubeW - 4, yHot - yTop, half - 2);
      g.fill();
      /* zone verte : un repère qui dépasse du tube */
      const yz0 = yOfT(ZONE_MAX), yz1 = yOfT(ZONE_MIN);
      g.fillStyle = 'rgba(139,216,106,0.5)';
      draw.roundRect(g, tx - half - 9, yz0, tubeW + 18, yz1 - yz0, 4);
      g.fill();
      g.strokeStyle = 'rgba(190,240,160,0.9)';
      g.lineWidth = 1.2;
      g.stroke();
      /* graduations tous les 5 °C */
      g.strokeStyle = 'rgba(234,246,248,0.45)';
      g.lineWidth = 1;
      for (let t = -25; t <= 55; t += 5) {
        const y = Math.round(yOfT(t)) + 0.5;
        const L = t % 10 === 0 ? 5 : 3;
        g.beginPath();
        g.moveTo(tx - half - L, y);
        g.lineTo(tx - half, y);
        g.stroke();
      }
      /* les deux repères écrits : −18 °C et 15 °C */
      const fs = Math.round(clamp(G.s * 12, 11, 14));
      g.font = `700 ${fs}px ${FONT}`;
      g.textAlign = 'right';
      g.textBaseline = 'middle';
      [[-18, '#BFE3FF'], [15, '#C6F2A8']].forEach(([t, col]) => {
        const y = yOfT(t);
        g.strokeStyle = rgba(col, 0.95);
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(tx - half - 12, y);
        g.lineTo(tx + half, y);
        g.stroke();
        g.fillStyle = 'rgba(8,24,32,0.7)';
        const label = lib.fr(degres(t));
        const tw = g.measureText(label).width;
        draw.roundRect(g, tx - half - 18 - tw - 6, y - fs * 0.75, tw + 12, fs * 1.5, 6);
        g.fill();
        g.fillStyle = col;
        g.fillText(label, tx - half - 18, y + 0.5);
      });
      /* reflet du verre */
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(tx - half * 0.45, yTop + half + 2);
      g.lineTo(tx - half * 0.45, bulbY - bulbR - 2);
      g.stroke();
      g.strokeStyle = 'rgba(230,245,250,0.55)';
      g.lineWidth = 1.2;
      draw.roundRect(g, tx - half, yTop, tubeW, bulbY - yTop - bulbR * 0.8, half);
      g.stroke();
      g.beginPath();
      g.arc(tx, bulbY, bulbR, 0, TAU);
      g.stroke();
      return T;
    }

    function atomSprite(r, light, base, dark) {
      const S = Math.ceil((r + 1.5) * 2 * cv.dpr);
      const c = document.createElement('canvas');
      c.width = c.height = S;
      const g = c.getContext('2d');
      g.scale(cv.dpr, cv.dpr);
      const R = S / cv.dpr / 2;
      const gr = g.createRadialGradient(R - r * 0.35, R - r * 0.4, r * 0.08, R, R, r);
      gr.addColorStop(0, light);
      gr.addColorStop(0.55, base);
      gr.addColorStop(1, dark);
      g.fillStyle = gr;
      g.beginPath();
      g.arc(R, R, r, 0, TAU);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.beginPath();
      g.ellipse(R - r * 0.34, R - r * 0.42, r * 0.28, r * 0.17, -0.5, 0, TAU);
      g.fill();
      return { c, half: R };
    }
    function glowSprite() {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d');
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,150,100,0.9)');
      gr.addColorStop(0.4, 'rgba(255,122,77,0.4)');
      gr.addColorStop(1, 'rgba(255,122,77,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 64);
      return c;
    }

    function geometry(w, h) {
      const m = Math.min(w, h);
      G.w = w;
      G.h = h;
      G.s = clamp(m / 358, 0.85, 1.4);
      G.atmTop = Math.round(h * 0.17);
      G.yg = Math.round(h * 0.7);
      G.sunR = Math.round(clamp(m * 0.06, 16, 32));
      G.sunX = Math.round(w * 0.075 + G.sunR * 0.4);
      G.sunY = Math.round(h * 0.075);
      G.tubeW = Math.round(clamp(m * 0.05, 15, 24));
      G.bulbR = Math.round(clamp(m * 0.05, 16, 25));
      G.tx = Math.round(w - G.bulbR - Math.max(12, w * 0.03));
      G.tubeTop = Math.round(h * 0.05);
      G.bulbY = Math.round(G.yg - h * 0.02 - G.bulbR * 0.3);
      G.scaleBot = G.bulbY - G.bulbR - 4;
      G.scaleTop = G.tubeTop + G.tubeW * 0.6;
      G.lake0 = w * 0.38;
      G.lake1 = w * 0.56;
      G.lakeY = G.yg + h * 0.012;
      G.landTop = Math.round(G.yg - h * 0.17);
      G.landH = Math.round(h * 0.27);
      G.mx0 = 18 * G.s;
      G.mx1 = G.tx - G.tubeW / 2 - 66 * G.s;
      G.my0 = G.atmTop + 18 * G.s;
      G.my1 = G.yg - h * 0.11;
      bg = makeBg();
      makeLayout();
      landBien = makeLand('bien');
      landFroid = makeLand('froid');
      landChaud = makeLand('chaud');
      thermo = makeThermo();
      spC = atomSprite(7 * G.s, '#9AA3AC', '#4A5058', '#202428');
      spO = atomSprite(6 * G.s, '#FFA48C', '#D9452F', '#8A1F12');
      hazeHot = ctx.createLinearGradient(0, G.atmTop, 0, G.yg);
      hazeHot.addColorStop(0, 'rgba(255,122,77,0.04)');
      hazeHot.addColorStop(1, 'rgba(255,140,60,0.26)');
      hazeCold = ctx.createLinearGradient(0, G.atmTop, 0, G.yg);
      hazeCold.addColorStop(0, 'rgba(220,240,255,0)');
      hazeCold.addColorStop(1, 'rgba(220,240,255,0.16)');
      groundGlow = ctx.createLinearGradient(0, G.yg - h * 0.08, 0, G.yg + h * 0.03);
      groundGlow.addColorStop(0, 'rgba(255,122,77,0)');
      groundGlow.addColorStop(0.75, 'rgba(255,122,77,0.32)');
      groundGlow.addColorStop(1, 'rgba(255,122,77,0)');
      for (const mo of mols) keepInside(mo);
      lbHot.style.left = (G.tx - G.tubeW / 2 - 10) + 'px';
      lbHot.style.top = yOfT((HOT_FROM + T_MAX) / 2 + 3) + 'px';
      readout.style.left = G.tx + 'px';
      readout.style.top = (G.bulbY + 0.5) + 'px';
      readout.style.fontSize = Math.round(clamp(G.bulbR * 0.62, 10.5, 15)) + 'px';
      bar.classList.toggle('is-narrow', w < 380);
      bar.classList.toggle('is-tiny', w < 320);
    }

    /* ---- état ---- */
    let mols = [];
    let suns = [];
    let irs = [];
    let flashes = [];
    let pops = [];
    let waves = [];
    let T = tempOf(0);
    let target = T;
    let hold = 0;
    let holdShown = 0;
    let finished = false;
    let shownDeg = null;
    let shownProgress = -1;
    let tooHotHint = false;
    let zoneState = 'froid';
    let redState = false;
    let sunAcc = 0;
    let time = 0;

    function keepInside(m) {
      m.x = clamp(m.x, G.mx0, G.mx1);
      m.y = clamp(m.y, G.my0, G.my1);
    }

    function addMolecule(x, y) {
      if (mols.length >= MAX_MOL) return null;
      const m = {
        x, y, vx: rand(-8, 8), vy: rand(-6, 6), ang: rand(TAU), va: rand(-0.5, 0.5),
        vib: 0, vt: 0, born: 0, ph: rand(TAU),
      };
      keepInside(m);
      mols.push(m);
      waves.push({ x: m.x, y: m.y, t: 0, dur: 0.5, col: '#EAF6F8' });
      api.sfx.play('bubble', { pitch: rand(0.9, 1.15) });
      api.buzz(8);
      changed();
      return m;
    }
    function removeMolecule(m) {
      const i = mols.indexOf(m);
      if (i < 0) return;
      mols.splice(i, 1);
      pops.push({ x: m.x, y: m.y, ang: m.ang, t: 0, dur: 0.45 });
      api.sfx.play('pop', { pitch: rand(0.9, 1.2) });
      api.buzz(8);
      for (const r of irs) if (r.held === m) release(r, m);
      changed();
    }
    /* une place libre dans l'atmosphère, loin des autres molécules */
    function freeSpot() {
      let best = null, bestD = -1;
      for (let k = 0; k < 14; k++) {
        const x = rand(G.mx0, G.mx1), y = rand(G.my0, G.my1);
        let d = 1e9;
        for (const m of mols) d = Math.min(d, Math.hypot(m.x - x, m.y - y));
        if (d > bestD) { bestD = d; best = [x, y]; }
      }
      return best;
    }

    function changed() {
      target = tempOf(mols.length);
      btnAdd.disabled = mols.length >= MAX_MOL;
      btnDel.disabled = mols.length === 0;
      helpTooHot();
    }
    /* trop de CO2 : le doigt fantôme montre le bouton pour en enlever (il revient après chaque
       touche tant qu'il fait trop chaud, et s'en va dès qu'on est revenu à la bonne quantité) */
    let helpShown = false;
    function helpTooHot() {
      if (!finished && target > ZONE_MAX + 0.5) {
        const sr = stage.getBoundingClientRect(), br = btnDel.getBoundingClientRect();
        if (sr.width > 0 && br.width > 0) {
          api.gesture('tap', {
            x: ((br.left + br.width / 2 - sr.left) / sr.width) * 100,
            y: ((br.top + br.height / 2 - sr.top) / sr.height) * 100,
          });
          helpShown = true;
        }
      } else if (helpShown) {
        api.gesture(null);
        helpShown = false;
      }
    }

    function setProgress(v) {
      v = Math.round(v * 100) / 100;
      if (v === shownProgress) return;
      shownProgress = v;
      api.progress(v);
    }

    /* ---- interaction ---- */
    function molAt(x, y) {
      let best = null, bd = Math.max(24, 20 * G.s);
      for (const m of mols) {
        const d = Math.hypot(m.x - x, m.y - y);
        if (d < bd) { bd = d; best = m; }
      }
      return best;
    }
    function onTap(x, y) {
      if (x > G.tx - G.tubeW / 2 - 30 * G.s && y < G.bulbY + G.bulbR + 6) {
        waves.push({ x, y, t: 0, dur: 0.45, col: '#EAF6F8' });
        api.sfx.play('tick');
        return;
      }
      /* Pour les petits, toucher le ciel ajoute toujours du CO2 (on enlève avec le bouton) :
         deux tapes au même endroit ne s'annulent pas. Déjà une molécule sous le doigt ?
         La nouvelle se pose juste à côté. */
      if (molAt(x, y)) {
        const a = rand(TAU);
        x += Math.cos(a) * 34 * G.s;
        y += Math.sin(a) * 34 * G.s;
      }
      if (mols.length >= MAX_MOL) {
        waves.push({ x, y, t: 0, dur: 0.5, col: '#FF7A4D' });
        api.sfx.play('fail');
        return;
      }
      addMolecule(clamp(x, G.mx0, G.mx1), clamp(y, G.my0, G.my1));
    }
    api.track(cv.canvas, {
      up(p, e, cancelled) {
        if (!cancelled && p.tap) onTap(p.x, p.y);
      },
    }, { touchAction: 'pan-y' });
    btnAdd.addEventListener('click', () => {
      const s = freeSpot();
      if (s) addMolecule(s[0], s[1]);
    });
    btnDel.addEventListener('click', () => {
      if (!mols.length) return;
      /* on retire la molécule la plus récente */
      removeMolecule(mols[mols.length - 1]);
    });

    /* ---- les rayons ---- */
    function spawnSun() {
      const tx = rand(G.w * 0.04, G.mx1 + 24 * G.s);
      const ty = groundY(tx);
      const a = Math.atan2(ty - G.sunY, tx - G.sunX);
      const d0 = G.sunR * 1.1;
      suns.push({ x: G.sunX + Math.cos(a) * d0, y: G.sunY + Math.sin(a) * d0, a, tx, ty, t: 0 });
    }
    function spawnIR(x, y, a, delay) {
      if (irs.length >= 46) return;
      irs.push({ x, y, a, ph: rand(TAU), wait: delay || 0, held: null, last: null, cool: 0, out: 0, alpha: 0, ground: 0 });
    }
    function release(r, m) {
      r.held = null;
      r.last = m;
      r.cool = 0.35;
      /* renvoyé au hasard, mais plus souvent vers le sol */
      r.a = Math.random() < 0.62 ? rand(0.18, 0.82) * Math.PI : -rand(0.18, 0.82) * Math.PI;
      r.x = m.x + Math.cos(r.a) * 10 * G.s;
      r.y = m.y + Math.sin(r.a) * 10 * G.s;
    }

    /* distance d'un point à l'axe O=C=O d'une molécule */
    const OFF = () => 11.8 * G.s;
    function hitsMol(m, x, y) {
      const ca = Math.cos(m.ang), sa = Math.sin(m.ang);
      const dx = x - m.x, dy = y - m.y;
      const t = clamp(dx * ca + dy * sa, -OFF(), OFF());
      return Math.hypot(dx - ca * t, dy - sa * t) < 8.5 * G.s;
    }

    function updateRays(dt) {
      const speedSun = 250 * G.s, speedIR = 74 * G.s;
      sunAcc += dt * 5.5 * (api.reducedMotion ? 0.6 : 1);
      while (sunAcc > 1) {
        sunAcc -= 1;
        spawnSun();
      }
      for (let i = suns.length - 1; i >= 0; i--) {
        const r = suns[i];
        r.x += Math.cos(r.a) * speedSun * dt;
        r.y += Math.sin(r.a) * speedSun * dt;
        if (r.y >= r.ty) {
          flashes.push({ x: r.tx, y: r.ty, t: 0, dur: 0.35, col: '#FFC857', r: 7 * G.s });
          if (Math.random() < 0.8) spawnIR(r.tx, r.ty - 2, -Math.PI / 2 + rand(-0.55, 0.55), 0.25);
          suns.splice(i, 1);
        }
      }
      for (let i = irs.length - 1; i >= 0; i--) {
        const r = irs[i];
        if (r.wait > 0) { r.wait -= dt; continue; }
        if (r.held) {
          r.hold -= dt;
          if (r.hold <= 0) release(r, r.held);
          continue;
        }
        r.alpha = Math.min(1, r.alpha + dt * 5);
        r.cool -= dt;
        r.ph += dt * 13;
        r.x += Math.cos(r.a) * speedIR * dt;
        r.y += Math.sin(r.a) * speedIR * dt;
        if (r.x < -20 || r.x > G.w + 20 || r.y < -20) { irs.splice(i, 1); continue; }
        if (r.y < G.atmTop) {
          /* parti dans l'espace : la chaleur s'échappe */
          r.out += dt;
          if (r.out > 1.2) { irs.splice(i, 1); continue; }
        } else if (Math.sin(r.a) > 0 && r.y >= groundY(r.x) - 1) {
          /* revenu au sol : le sol se réchauffe, puis renvoie un infrarouge */
          flashes.push({ x: r.x, y: groundY(r.x), t: 0, dur: 0.45, col: '#FF7A4D', r: 9 * G.s });
          if (Math.random() < 0.72 && r.x < G.tx - G.tubeW) {
            r.y = groundY(r.x) - 2;
            r.a = -Math.PI / 2 + rand(-0.55, 0.55);
            r.wait = 0.3;
            r.alpha = 0;
            r.last = null;
          } else irs.splice(i, 1);
          continue;
        } else {
          for (const m of mols) {
            if (m === r.last && r.cool > 0) continue;
            if (m.born < 0.6) continue;
            if (hitsMol(m, r.x, r.y)) {
              r.held = m;
              r.hold = 0.14;
              m.vib = 1;
              break;
            }
          }
        }
      }
    }

    /* ---- animation ---- */
    function update(dt) {
      time += dt;
      /* la température suit le CO2, en douceur */
      T += (target - T) * (1 - Math.exp(-dt * 1.9));
      if (Math.abs(target - T) < 0.02) T = target;
      const deg = Math.round(T);
      if (deg !== shownDeg) {
        shownDeg = deg;
        readout.textContent = degres(T, true);
        if (!finished) api.status(TEXTES.temperature(T));
      }
      const inZone = T >= ZONE_MIN && T <= ZONE_MAX;
      const z = inZone ? 'bien' : T > ZONE_MAX ? 'chaud' : 'froid';
      if (z !== zoneState) {
        if (z === 'bien' && target >= ZONE_MIN && target <= ZONE_MAX) { api.sfx.play('chime', { volume: 0.7, gap: 400 }); api.buzz(10); }
        zoneState = z;
      }
      const red = T > HOT_FROM;
      if (red !== redState) {
        if (red) api.sfx.play('rumble', { volume: 0.4, gap: 800 });
        redState = red;
      }
      if (!finished) {
        /* on ne gagne qu'avec la bonne quantité de CO2, pas en passant par la zone verte */
        if (inZone && target >= ZONE_MIN && target <= ZONE_MAX) {
          hold += dt;
          if (hold >= HOLD) {
            finished = true;
            api.done(TEXTES.fin, TEXTES.finStatut);
          }
        } else hold = 0;
        const near = clamp(1 - Math.abs(T - 15) / 33);
        if (!finished) setProgress(0.88 * near + 0.1 * clamp(hold / HOLD));
        /* trop de CO2 : un petit conseil */
        const tooHot = target > ZONE_MAX + 0.5;
        if (tooHot !== tooHotHint) {
          tooHotHint = tooHot;
          if (!finished) api.hint(tooHot ? TEXTES.tropChaud : defaultHint);
        }
      }
      holdShown += ((finished ? 0 : hold / HOLD) - holdShown) * Math.min(1, dt * 12);

      /* les molécules flottent */
      const sp = AMB;
      for (const m of mols) {
        m.born = Math.min(1, m.born + dt / 0.35);
        m.vt += dt;
        m.vib = Math.max(0, m.vib - dt * 2.2);
        m.vx += Math.sin(time * 0.7 + m.ph) * 4 * dt;
        m.vy += Math.cos(time * 0.9 + m.ph * 1.3) * 3 * dt;
        const v = Math.hypot(m.vx, m.vy);
        if (v > 12) { m.vx *= 12 / v; m.vy *= 12 / v; }
        m.x += m.vx * dt * sp;
        m.y += m.vy * dt * sp;
        m.ang += m.va * dt * sp;
        if (m.x < G.mx0) { m.x = G.mx0; m.vx = Math.abs(m.vx); }
        if (m.x > G.mx1) { m.x = G.mx1; m.vx = -Math.abs(m.vx); }
        if (m.y < G.my0) { m.y = G.my0; m.vy = Math.abs(m.vy); }
        if (m.y > G.my1) { m.y = G.my1; m.vy = -Math.abs(m.vy); }
      }
      /* elles s'écartent un peu les unes des autres */
      const minD = 40 * G.s;
      for (let i = 0; i < mols.length; i++) {
        for (let j = i + 1; j < mols.length; j++) {
          const a = mols[i], b = mols[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const d = Math.hypot(dx, dy);
          if (d > 0.01 && d < minD) {
            const push = (minD - d) * 0.8 * dt;
            a.x -= (dx / d) * push; a.y -= (dy / d) * push;
            b.x += (dx / d) * push; b.y += (dy / d) * push;
          }
        }
      }
      updateRays(dt);
      age(flashes, dt);
      age(pops, dt);
      age(waves, dt);
    }

    function drawLand() {
      const wF = clamp((1 - T) / 14);
      const wH = clamp((T - 21) / 14);
      const y = G.landTop;
      ctx.drawImage(landBien.c, 0, y, G.w, G.landH);
      if (wF > 0.005) {
        ctx.globalAlpha = wF;
        ctx.drawImage(landFroid.c, 0, y, G.w, G.landH);
      }
      if (wH > 0.005) {
        ctx.globalAlpha = wH;
        ctx.drawImage(landChaud.c, 0, y, G.w, G.landH);
      }
      ctx.globalAlpha = 1;
      /* voile : chaleur ou froid dans l'air */
      if (wH > 0.005) {
        ctx.globalAlpha = wH;
        ctx.fillStyle = hazeHot;
        ctx.fillRect(0, G.atmTop, G.w, G.yg - G.atmTop);
      }
      if (wF > 0.005) {
        ctx.globalAlpha = wF;
        ctx.fillStyle = hazeCold;
        ctx.fillRect(0, G.atmTop, G.w, G.yg - G.atmTop);
      }
      /* le sol chaud rayonne */
      const warm = clamp((T + 18) / 60);
      ctx.globalAlpha = 0.2 + 0.8 * warm;
      ctx.fillStyle = groundGlow;
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillRect(0, G.yg - G.h * 0.08, G.tx - G.tubeW, G.h * 0.11);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }

    function drawSunGlow() {
      const k = 0.5 + 0.5 * Math.sin(time * 1.3 * AMB);
      ctx.globalCompositeOperation = 'lighter';
      draw.glow(ctx, G.sunX, G.sunY, G.sunR * (1.9 + 0.25 * k), '#FFD27A', 0.22 + 0.1 * k);
      ctx.globalCompositeOperation = 'source-over';
    }

    function drawSunRays() {
      ctx.lineCap = 'round';
      const L = 20 * G.s;
      for (const r of suns) {
        const ca = Math.cos(r.a), sa = Math.sin(r.a);
        /* une longue traînée pâle, puis le trait lumineux */
        ctx.strokeStyle = 'rgba(255,200,87,0.1)';
        ctx.lineWidth = 2 * G.s;
        ctx.beginPath();
        ctx.moveTo(r.x - ca * L * 3, r.y - sa * L * 3);
        ctx.lineTo(r.x, r.y);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,200,87,0.22)';
        ctx.lineWidth = 5 * G.s;
        ctx.beginPath();
        ctx.moveTo(r.x - ca * L, r.y - sa * L);
        ctx.lineTo(r.x, r.y);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,230,150,0.95)';
        ctx.lineWidth = 1.8 * G.s;
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
    }

    function drawIR() {
      const seg = 3.3 * G.s, A = 2.4 * G.s, N = 7;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      for (const r of irs) {
        if (r.wait > 0 || r.held) continue;
        const ca = Math.cos(r.a), sa = Math.sin(r.a);
        const fade = r.alpha * (r.out > 0 ? Math.max(0, 1 - r.out / 1.2) : 1);
        if (fade <= 0.02) continue;
        ctx.beginPath();
        for (let k = 0; k <= N; k++) {
          const d = k * seg;
          const off = Math.sin(r.ph - k * 0.95) * A * (1 - k / (N + 2));
          const x = r.x - ca * d - sa * off;
          const y = r.y - sa * d + ca * off;
          if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.globalAlpha = fade;
        ctx.strokeStyle = 'rgba(255,122,77,0.3)';
        ctx.lineWidth = 4.5 * G.s;
        ctx.stroke();
        ctx.strokeStyle = '#FF9A70';
        ctx.lineWidth = 1.7 * G.s;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.lineCap = 'butt';
      ctx.lineJoin = 'miter';
    }

    function drawMols() {
      const off = OFF();
      for (const m of mols) {
        const sc = ease.outBack(clamp(m.born));
        const ca = Math.cos(m.ang), sa = Math.sin(m.ang);
        const osc = Math.sin(m.vt * 40) * m.vib * 2.6 * G.s;
        const d1 = (off + osc) * sc, d2 = (off - osc) * sc;
        if (m.vib > 0.02) {
          /* elle vient d'attraper un infrarouge : elle vibre et rougeoie */
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.8 * m.vib;
          const R = 28 * G.s;
          ctx.drawImage(glowSp, m.x - R, m.y - R, R * 2, R * 2);
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = 'source-over';
        }
        const hO = spO.half * sc, hC = spC.half * sc;
        ctx.drawImage(spO.c, m.x - ca * d1 - hO, m.y - sa * d1 - hO, hO * 2, hO * 2);
        ctx.drawImage(spO.c, m.x + ca * d2 - hO, m.y + sa * d2 - hO, hO * 2, hO * 2);
        ctx.drawImage(spC.c, m.x - hC, m.y - hC, hC * 2, hC * 2);
      }
      /* les molécules enlevées s'éparpillent */
      for (const p of pops) {
        const q = p.t / p.dur;
        const k = ease.outCubic(q);
        ctx.globalAlpha = 1 - q;
        const ca = Math.cos(p.ang), sa = Math.sin(p.ang);
        const d = off + k * 26 * G.s;
        const sc = 1 - q * 0.6;
        const hO = spO.half * sc, hC = spC.half * sc;
        ctx.drawImage(spO.c, p.x - ca * d - hO, p.y - sa * d - hO - k * 6, hO * 2, hO * 2);
        ctx.drawImage(spO.c, p.x + ca * d - hO, p.y + sa * d - hO - k * 6, hO * 2, hO * 2);
        ctx.drawImage(spC.c, p.x - hC, p.y - hC + k * 10, hC * 2, hC * 2);
        ctx.globalAlpha = 1;
      }
    }

    const RAMP = [[0, '#7FC8F8'], [0.3, '#5FB4E8'], [0.5, '#8BD86A'], [0.7, '#FFB347'], [1, '#FF4E3A']];
    function liquidColor(t) {
      /* −18 °C : bleu glacé ; 15 °C : vert ; au-delà de 40 °C : rouge */
      let k;
      if (t < 15) k = lerp(0.05, 0.5, clamp((t + 18) / 33));
      else k = lerp(0.5, 1, clamp((t - 15) / 30));
      return lib.ramp(RAMP, k);
    }

    function drawThermo() {
      ctx.drawImage(thermo.c, 0, 0, G.w, G.h);
      const { tx, bulbY, bulbR, tubeW } = G;
      const inner = tubeW * 0.42;
      const col = liquidColor(T);
      const yT = yOfT(T);
      const inZone = T >= ZONE_MIN && T <= ZONE_MAX;
      if (inZone || finished) {
        const k = 0.5 + 0.5 * Math.sin(time * 4);
        ctx.globalCompositeOperation = 'lighter';
        draw.glow(ctx, tx, yOfT(15), tubeW * 1.8, '#8BD86A', 0.25 + 0.2 * k);
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.fillStyle = col;
      draw.roundRect(ctx, tx - inner / 2, yT, inner, bulbY - yT, inner / 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(tx, bulbY, bulbR - 3.5, 0, TAU);
      ctx.fill();
      const gr = ctx.createRadialGradient(tx - bulbR * 0.35, bulbY - bulbR * 0.4, 1, tx, bulbY, bulbR);
      gr.addColorStop(0, 'rgba(255,255,255,0.35)');
      gr.addColorStop(0.5, 'rgba(255,255,255,0)');
      gr.addColorStop(1, 'rgba(0,0,0,0.25)');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(tx, bulbY, bulbR - 3.5, 0, TAU);
      ctx.fill();
      /* niveau : un petit trait clair */
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillRect(tx - inner / 2, yT, inner, 1.5);
      /* anneau de patience autour du réservoir */
      if (holdShown > 0.01) {
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(139,216,106,0.25)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(tx, bulbY, bulbR + 5, 0, TAU);
        ctx.stroke();
        ctx.strokeStyle = '#B6F09A';
        ctx.beginPath();
        ctx.arc(tx, bulbY, bulbR + 5, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(holdShown));
        ctx.stroke();
        ctx.lineCap = 'butt';
      }
    }

    function drawFx() {
      ctx.globalCompositeOperation = 'lighter';
      for (const f of flashes) {
        const q = f.t / f.dur;
        draw.glow(ctx, f.x, f.y, f.r * (0.8 + q * 0.8), f.col, 0.6 * (1 - q));
      }
      ctx.globalCompositeOperation = 'source-over';
      for (const wv of waves) {
        const q = wv.t / wv.dur;
        ctx.strokeStyle = rgba(wv.col, 0.65 * (1 - q));
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(wv.x, wv.y, lerp(6, 26 * G.s, ease.outCubic(q)), 0, TAU);
        ctx.stroke();
      }
    }

    function render() {
      if (!bg) return;
      ctx.drawImage(bg.c, 0, 0, G.w, G.h);
      drawSunGlow();
      drawLand();
      drawSunRays();
      drawIR();
      drawMols();
      drawThermo();
      drawFx();
    }

    const defaultHint = api.root.querySelector('.game-hint') ? api.root.querySelector('.game-hint').textContent : '';

    function init() {
      mols = [];
      suns = [];
      irs = [];
      flashes = [];
      pops = [];
      waves = [];
      T = target = tempOf(0);
      hold = 0;
      holdShown = 0;
      finished = false;
      shownDeg = null;
      shownProgress = -1;
      tooHotHint = false;
      zoneState = 'froid';
      redState = false;
      changed();
      setProgress(0);
      /* quelques rayons déjà en route : la scène vit dès la première image */
      for (let i = 0; i < 6; i++) {
        spawnSun();
        const r = suns[suns.length - 1];
        const k = Math.random();
        r.x = lerp(r.x, r.tx, k * 0.9);
        r.y = lerp(r.y, r.ty, k * 0.9);
      }
      for (let i = 0; i < 8; i++) {
        const x = rand(G.w * 0.05, G.mx1);
        spawnIR(x, lerp(groundY(x) - 4, G.atmTop - 10, Math.random()), -Math.PI / 2 + rand(-0.5, 0.5), 0);
        irs[irs.length - 1].alpha = 1;
      }
      api.gesture('tap', { x: 30, y: 40 });
    }

    glowSp = glowSprite();
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
