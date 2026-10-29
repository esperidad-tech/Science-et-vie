/* Allume le Soleil : le doigt posé sur le cœur, c'est la gravité qui serre. Le cœur se
   resserre et chauffe jusqu'à 15 millions de degrés ; alors les noyaux d'hydrogène arrivent
   quatre par quatre, se collent en un noyau d'hélium, et la masse qui manque part en lumière. */
(function () {
  'use strict';
  const { lib } = window.RM;
  const { TAU, rand, clamp, lerp, ease, rgba, draw } = lib;

  /* Tous les textes du jeu, faciles à corriger */
  const TEXTES = {
    consigne: 'Garde le doigt appuyé sur le cœur du Soleil pour le serrer et le chauffer.',
    tape: 'Bien ! Tape encore et encore, ou garde le doigt appuyé.',
    lache: 'Ne lâche pas : le cœur se relâche et refroidit !',
    centre: 'Appuie au milieu du Soleil, sur son cœur.',
    chaud: 'Le cœur est à 15 000 000 °C : les noyaux se collent ! Garde le doigt appuyé.',
    premier: 'Voilà un noyau d’hélium, et de la lumière ! Continue d’appuyer.',
    froid: 'Le cœur refroidit : appuie encore pour le garder chaud !',
    repart: 'C’est reparti : les noyaux se collent !',
    statut: (n) => `Hélium : ${n} sur 10`,
    temperature: '15 000 000 °C',
    legende: '4 hydrogène → 1 hélium + lumière',
    fin: 'Chaque seconde, le Soleil transforme 600 millions de tonnes d’hydrogène en hélium.',
    finStatut: 'L’hélium est 0,7 % plus léger : la différence devient lumière.',
    bravo: '{bravo}',
  };

  const GOAL = 10;            /* noyaux d'hélium à fabriquer */
  const FILL_T = 6.5;         /* secondes d'appui pour remplir la jauge */
  const FALL_T = 14;          /* secondes pour la vider quand on lâche (elle redescend doucement) */
  const FUSE_MIN = 0.85;      /* sous ce niveau la fusion s'arrête : environ 2 s après avoir lâché */
  const TAP_PRESS = 0.45;     /* une tape compte comme un petit moment d'appui (s) */
  const GROUP_EVERY = 2.5;    /* un groupe de 4 hydrogènes toutes les … s */
  const GROUP_DUR = 1.6;      /* voyage d'un groupe jusqu'au point de rencontre (s) */
  const TOUCH_T = 0.22;       /* les 4 noyaux se touchent… puis fusionnent */
  const CORE0 = 0.48;         /* rayon du cœur relâché (en rayons du Soleil) */
  const CORE1 = 0.34;         /* rayon du cœur serré */
  const RAD = 0.7;            /* limite entre la zone radiative et la zone de convection */
  const N_H = 8;              /* noyaux d'hydrogène qui flottent dans le cœur */

  const CSS = `
.game[data-game="soleil"] .game-canvas { -webkit-touch-callout: none; }
.game[data-game="soleil"] .so-temp {
  position: absolute; z-index: 3; left: 0; top: 0; margin: 0;
  padding: 6px 11px 6px 10px; white-space: nowrap;
  font: 800 0.875rem/1 var(--font-text); letter-spacing: 0.01em; font-variant-numeric: tabular-nums;
  color: rgba(255, 241, 226, 0.7); background: rgba(26, 9, 3, 0.7);
  border-radius: 11px 14px 12px 13px;
  box-shadow: inset 0 0 0 1.5px rgba(255, 224, 122, 0.3);
  pointer-events: none;
  transition: color .35s, background-color .35s, box-shadow .35s;
}
.game[data-game="soleil"] .so-temp.is-wide { font-size: 1rem; padding: 7px 13px 7px 12px; }
.game[data-game="soleil"] .so-temp.is-hot {
  color: #2A1206; background: #FFE07A;
  box-shadow: 0 0 0 3px rgba(255, 178, 63, 0.45), 0 0 26px rgba(255, 196, 90, 0.8);
}
.game[data-game="soleil"] .so-legend {
  position: absolute; z-index: 3; left: 50%; bottom: 10px; transform: translateX(-50%);
  width: max-content; max-width: calc(100% - 20px); margin: 0; padding: 7px 12px 7px 10px;
  display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 3px 6px;
  font: 700 0.8125rem/1.2 var(--font-text); color: #FFF1E2;
  background: rgba(26, 9, 3, 0.72); border-radius: 15px 18px 16px 17px;
  box-shadow: inset 0 0 0 1px rgba(255, 241, 226, 0.14), 0 8px 18px -10px rgba(0, 0, 0, 0.8);
  pointer-events: none;
}
.game[data-game="soleil"] .so-part { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
.game[data-game="soleil"] .so-part svg { flex: none; height: 12px; width: auto; }
.game[data-game="soleil"] .so-sep { color: #FFC566; font-weight: 800; }
.game[data-game="soleil"] .so-legend.is-wide { font-size: 0.9375rem; padding: 8px 15px 8px 13px; gap: 3px 8px; }
.game[data-game="soleil"] .so-legend.is-wide .so-part svg { height: 14px; }
.game[data-game="soleil"] .so-legend.is-narrow { font-size: 0.75rem; padding: 6px 9px; gap: 2px 4px; }
.game[data-game="soleil"] .so-legend.is-narrow .so-part svg { height: 11px; }
`;

  /* Petits dessins de la légende (décoratifs) */
  const ICON_H4 = '<svg viewBox="0 0 27 12" aria-hidden="true">' +
    [3.5, 10, 16.5, 23].map((x) => `<circle cx="${x}" cy="6" r="3" fill="#F2453D"/><circle cx="${x - 0.9}" cy="5" r="0.95" fill="#FFD0C4"/>`).join('') + '</svg>';
  const ICON_HE = '<svg viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="5.6" fill="#FFD84A" stroke="#E0901A" stroke-width="1.2"/>' +
    '<circle cx="5.3" cy="5.2" r="1.6" fill="#FFF8D6"/></svg>';
  const ICON_LUM = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M7 0.4Q8 6 13.6 7Q8 8 7 13.6Q6 8 0.4 7Q6 6 7 0.4Z" fill="#FFF0B8"/></svg>';

  function buildLegend(el, text) {
    const m = /^(.*?)\s*→\s*(.*?)\s*\+\s*(.*)$/.exec(text);
    if (!m) { el.textContent = text; return; }
    const part = (icon, label) => {
      const s = document.createElement('span');
      s.className = 'so-part';
      s.innerHTML = icon;
      s.appendChild(document.createTextNode(label));
      return s;
    };
    const sep = (t) => {
      const s = document.createElement('span');
      s.className = 'so-sep';
      s.textContent = t;
      return s;
    };
    el.append(part(ICON_H4, m[1]), sep(' → '), part(ICON_HE, m[2]), sep(' + '), part(ICON_LUM, m[3]));
  }

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
  const smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  };
  /* rapproche v de cible à la vitesse k (par seconde), sans dépasser */
  const approach = (v, target, k) => v + (target - v) * clamp(k);

  /* Couleurs des couches du Soleil (RVB) */
  const RGB = (h) => lib.hexToRgb(h);
  const RAD_STOPS = [[0, RGB('#FFA244')], [0.5, RGB('#F57A2A')], [1, RGB('#CC4C17')]];
  const RING0 = RGB('#7E2409'), RING1 = RGB('#BC4512');
  function rampInto(stops, t, out) {
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    for (let i = 1; i < stops.length; i++) {
      if (t <= stops[i][0]) {
        const a = stops[i - 1], b = stops[i];
        const k = (t - a[0]) / (b[0] - a[0]);
        out[0] = a[1][0] + (b[1][0] - a[1][0]) * k;
        out[1] = a[1][1] + (b[1][1] - a[1][1]) * k;
        out[2] = a[1][2] + (b[1][2] - a[1][2]) * k;
        return out;
      }
    }
    const l = stops[stops.length - 1][1];
    out[0] = l[0]; out[1] = l[1]; out[2] = l[2];
    return out;
  }

  /* Le Soleil en coupe : la zone radiative, lisse et à peine striée (pixel par pixel), puis la
     zone de convection, couverte de granules : des bulles claires qui se serrent les unes contre
     les autres, grosses en profondeur et fines près de la surface, et le bord brillant de la surface.
     Deux variantes (graine) qu'on fond l'une dans l'autre pour faire « bouillir » les granules. */
  function paintDisc(R, scale, seed) {
    const D = Math.ceil(R * 2 * scale) + 2;
    const c = document.createElement('canvas');
    c.width = c.height = D;
    const g = c.getContext('2d');
    const im = g.createImageData(D, D);
    const d = im.data;
    const ctr = D / 2;
    const Rs = R * scale;
    const nz = lib.makeNoise(31);
    const col = [0, 0, 0];
    for (let y = 0; y < D; y++) {
      for (let x = 0; x < D; x++) {
        const j = (y * D + x) * 4;
        const dx = x + 0.5 - ctr, dy = y + 0.5 - ctr;
        const dd = Math.sqrt(dx * dx + dy * dy);
        const a = clamp(Rs - dd + 0.5);
        if (a <= 0) { d[j + 3] = 0; continue; }
        const r = dd / Rs;
        const grain = (nz.noise2(x * 0.9, y * 0.9) - 0.5) * 0.07;
        /* fondu sur un pixel et demi entre les deux zones, pour un bord net mais sans crénelage */
        const m = smooth(-0.75, 0.75, dd - Rs * RAD);
        let rr = 0, gg = 0, bb = 0;
        if (m < 1) {
          const band = 1 + 0.03 * Math.sin(r * 62 + nz.fbm(x / (Rs * 0.18), y / (Rs * 0.18), 3) * 5);
          rampInto(RAD_STOPS, r / RAD, col);
          /* un liseré un peu plus clair au bord de la zone radiative */
          const k = band * (1 + grain * 0.6) * (1 + 0.1 * smooth(RAD - 0.03, RAD, r));
          rr = col[0] * k; gg = col[1] * k; bb = col[2] * k;
        }
        if (m > 0) {
          const t = clamp((r - RAD) / (1 - RAD)), k = 1 + grain;
          rr = lerp(rr, lerp(RING0[0], RING1[0], t) * k, m);
          gg = lerp(gg, lerp(RING0[1], RING1[1], t) * k, m);
          bb = lerp(bb, lerp(RING0[2], RING1[2], t) * k, m);
        }
        d[j] = clamp(rr, 0, 255);
        d[j + 1] = clamp(gg, 0, 255);
        d[j + 2] = clamp(bb, 0, 255);
        d[j + 3] = a * 255;
      }
    }
    g.putImageData(im, 0, 0);

    g.save();
    g.translate(ctr, ctr);
    g.scale(scale, scale);
    g.beginPath();
    g.arc(0, 0, R + 0.5, 0, TAU);
    g.arc(0, 0, R * RAD, 0, TAU, true);
    g.clip();
    const r = seeded(seed);
    const N = Math.round(clamp(R * 10, 900, 2400));
    for (let i = 0; i < N; i++) {
      const dep = r();
      const rad = R * lerp(RAD + 0.025, 0.985, dep);
      const a = r() * TAU;
      const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
      const sb = R * lerp(0.062, 0.028, dep) * (0.75 + r() * 0.5);
      const br = 0.8 + r() * 0.32;
      const hot = lib.mix('#E2601B', '#FFC770', dep * br, 1);
      const mid = lib.mix('#AE3C0E', '#F27A22', dep * br, 1);
      const gr = g.createRadialGradient(x - sb * 0.18, y - sb * 0.18, 0, x, y, sb);
      gr.addColorStop(0, hot);
      gr.addColorStop(0.5, mid);
      gr.addColorStop(0.8, mid.replace(/,1\)$/, ',0.7)'));
      gr.addColorStop(1, mid.replace(/,1\)$/, ',0)'));
      g.fillStyle = gr;
      g.beginPath();
      g.arc(x, y, sb, 0, TAU);
      g.fill();
    }
    /* ombre au fond de la zone de convection, lumière au bord de la surface */
    const sh = g.createRadialGradient(0, 0, R * RAD, 0, 0, R * (RAD + 0.08));
    sh.addColorStop(0, 'rgba(50,8,0,0.2)');
    sh.addColorStop(1, 'rgba(50,8,0,0)');
    g.fillStyle = sh;
    g.fillRect(-R, -R, R * 2, R * 2);
    const rim = g.createRadialGradient(0, 0, R * 0.9, 0, 0, R);
    rim.addColorStop(0, 'rgba(255,227,166,0)');
    rim.addColorStop(0.7, 'rgba(255,227,166,0.1)');
    rim.addColorStop(0.92, 'rgba(255,236,186,0.5)');
    rim.addColorStop(1, 'rgba(255,244,210,0.3)');
    g.fillStyle = rim;
    g.fillRect(-R, -R, R * 2, R * 2);
    g.restore();
    return { c, w: D / scale, h: D / scale };
  }

  /* Tourbillons de plasma du cœur (en lumière, ajoutés au dégradé du cœur) */
  function paintSwirl(Rc, scale) {
    const D = Math.ceil(Rc * 2 * scale) + 2;
    const c = document.createElement('canvas');
    c.width = c.height = D;
    const g = c.getContext('2d');
    const im = g.createImageData(D, D);
    const d = im.data;
    const n = lib.makeNoise(57);
    const ctr = D / 2, Rs = Rc * scale, f = 1 / (Rs * 0.32);
    for (let y = 0; y < D; y++) {
      for (let x = 0; x < D; x++) {
        const j = (y * D + x) * 4;
        const dx = x - ctr, dy = y - ctr;
        const r = Math.sqrt(dx * dx + dy * dy) / Rs;
        if (r >= 1) { d[j + 3] = 0; continue; }
        const wx = n.fbm(dx * f + 3.1, dy * f + 7.7, 3);
        const wy = n.fbm(dx * f + 11.4, dy * f + 1.9, 3);
        const v = n.fbm(dx * f * 1.4 + wx * 2.4, dy * f * 1.4 + wy * 2.4, 4);
        const b = Math.pow(smooth(0.42, 0.78, v), 1.4) * (1 - smooth(0.78, 1, r));
        d[j] = 255; d[j + 1] = 236; d[j + 2] = 190;
        d[j + 3] = b * 255;
      }
    }
    g.putImageData(im, 0, 0);
    return { c, w: D / scale, h: D / scale };
  }

  /* Couronne : un halo, de grands jets en pétales, des filaments fins et quelques boucles
     de plasma posées sur le bord (dessin flou : basse résolution suffisante). */
  function paintCorona(R, dpr) {
    const ext = 1.95;
    const S = Math.ceil(R * ext * 2);
    const C = mk(S, S, dpr);
    const g = C.g;
    const r = seeded(5);
    g.translate(S / 2, S / 2);
    g.globalCompositeOperation = 'lighter';
    const gr = g.createRadialGradient(0, 0, R * 0.9, 0, 0, R * ext);
    gr.addColorStop(0, 'rgba(255,214,140,0.6)');
    gr.addColorStop(0.16, 'rgba(255,170,80,0.24)');
    gr.addColorStop(0.45, 'rgba(255,140,60,0.08)');
    gr.addColorStop(1, 'rgba(255,120,40,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(0, 0, R * ext, 0, TAU);
    g.fill();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + r() * 0.6, len = R * (0.4 + r() * 0.5), wd = R * (0.12 + r() * 0.14);
      g.save();
      g.rotate(a);
      const lg = g.createLinearGradient(R * 0.95, 0, R + len, 0);
      lg.addColorStop(0, 'rgba(255,226,165,0.24)');
      lg.addColorStop(1, 'rgba(255,200,120,0)');
      g.fillStyle = lg;
      g.beginPath();
      g.moveTo(R * 0.95, -wd);
      g.quadraticCurveTo(R + len * 0.4, -wd * 0.75, R + len, 0);
      g.quadraticCurveTo(R + len * 0.4, wd * 0.75, R * 0.95, wd);
      g.closePath();
      g.fill();
      g.restore();
    }
    for (let i = 0; i < 150; i++) {
      const a = r() * TAU, len = R * (0.1 + Math.pow(r(), 2) * 0.72), wd = R * (0.004 + r() * 0.013);
      const al = 0.08 + r() * 0.22;
      g.save();
      g.rotate(a);
      const lg = g.createLinearGradient(R * 0.97, 0, R + len, 0);
      lg.addColorStop(0, `rgba(255,238,196,${al})`);
      lg.addColorStop(1, 'rgba(255,220,160,0)');
      g.fillStyle = lg;
      g.beginPath();
      g.moveTo(R * 0.97, -wd);
      g.lineTo(R + len, 0);
      g.lineTo(R * 0.97, wd);
      g.closePath();
      g.fill();
      g.restore();
    }
    /* une frange de petites flammèches tout autour du bord */
    for (let i = 0; i < 220; i++) {
      const a = (i / 220) * TAU + r() * 0.02, len = R * (0.015 + r() * 0.035), wd = R * (0.006 + r() * 0.006);
      g.save();
      g.rotate(a);
      g.fillStyle = `rgba(255,180,110,${0.18 + r() * 0.25})`;
      g.beginPath();
      g.moveTo(R * 0.99, -wd);
      g.quadraticCurveTo(R + len * 0.6, -wd * 0.4, R + len, (r() - 0.5) * wd);
      g.quadraticCurveTo(R + len * 0.6, wd * 0.4, R * 0.99, wd);
      g.closePath();
      g.fill();
      g.restore();
    }
    return C;
  }

  /* Bille brillante (noyau) avec une ombre douce */
  function ballSprite(rad, cols, dpr) {
    const S = Math.ceil(rad * 2 + 10);
    const B = mk(S, S, dpr);
    const g = B.g, c = S / 2;
    const sx = c + rad * 0.14, sy = c + rad * 0.24;
    const sh = g.createRadialGradient(sx, sy, rad * 0.5, sx, sy, rad * 1.45);
    sh.addColorStop(0, cols.shadow);
    sh.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sh;
    g.beginPath();
    g.arc(sx, sy, rad * 1.45, 0, TAU);
    g.fill();
    const b = g.createRadialGradient(c - rad * 0.36, c - rad * 0.4, rad * 0.06, c, c, rad);
    b.addColorStop(0, cols.hi);
    b.addColorStop(0.42, cols.body);
    b.addColorStop(0.85, cols.shade);
    b.addColorStop(1, cols.rim);
    g.fillStyle = b;
    g.beginPath();
    g.arc(c, c, rad, 0, TAU);
    g.fill();
    g.strokeStyle = cols.light;
    g.lineWidth = Math.max(0.8, rad * 0.13);
    g.beginPath();
    g.arc(c, c, rad * 0.88, 0.12 * Math.PI, 0.62 * Math.PI);
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.beginPath();
    g.ellipse(c - rad * 0.36, c - rad * 0.42, rad * 0.27, rad * 0.16, -0.6, 0, TAU);
    g.fill();
    return B;
  }

  window.RM.games.soleil = function (api) {
    api.style(CSS);
    const stage = api.stage;
    const cv = api.canvas();
    const ctx = cv.ctx;
    const AMB = api.reducedMotion ? 0.3 : 1;

    /* ---- étiquettes : la température à atteindre (au bout de la jauge), la légende ---- */
    const tempEl = document.createElement('p');
    tempEl.className = 'so-temp';
    tempEl.textContent = lib.fr(TEXTES.temperature);
    stage.appendChild(tempEl);
    const legend = document.createElement('p');
    legend.className = 'so-legend';
    buildLegend(legend, TEXTES.legende);
    stage.appendChild(legend);

    /* ---- géométrie et dessins pré-rendus ---- */
    const G = { w: 1, h: 1, cx: 0, cy: 0, R: 60, rH: 5, rHe: 8, gR: 70, gA0: 0.95, gA1: -0.82, gW: 7 };
    let bg = null, corona = null, discA = null, discB = null, swirl = null, streak = null;
    let sprH = null, sprHe = null, gaugeGrad = null;

    function geometry(w, h) {
      G.w = w;
      G.h = h;
      legend.classList.toggle('is-narrow', w < 340);
      legend.classList.toggle('is-wide', w >= 480);
      tempEl.classList.toggle('is-wide', w >= 480);
      const lh = legend.offsetHeight || 32;
      const avail = h - lh - 30;
      G.R = Math.max(40, Math.min((avail / 2) * 0.96, (w / 2 - 16) / 1.2));
      G.cx = w / 2;
      G.cy = 12 + avail / 2;
      G.gW = clamp(G.R * 0.05, 5, 10);
      G.gR = G.R + Math.max(13, G.R * 0.1);
      G.rH = clamp(G.R * 0.042, 4, 9);
      G.rHe = G.rH * 1.5;
      const ex = G.cx + Math.cos(G.gA1) * G.gR, ey = G.cy + Math.sin(G.gA1) * G.gR;
      const lw = tempEl.offsetWidth || 104, lhh = tempEl.offsetHeight || 26;
      tempEl.style.left = Math.round(clamp(ex - lw * 0.3, 10, w - lw - 10)) + 'px';
      tempEl.style.top = Math.round(clamp(ey - lhh - 9, 8, h - lhh - 8)) + 'px';
      const bx = G.cx + Math.cos(G.gA0) * G.gR, by = G.cy + Math.sin(G.gA0) * G.gR;
      gaugeGrad = ctx.createLinearGradient(bx, by, ex, ey);
      gaugeGrad.addColorStop(0, '#C2281C');
      gaugeGrad.addColorStop(0.45, '#FF7A1A');
      gaugeGrad.addColorStop(0.8, '#FFC23F');
      gaugeGrad.addColorStop(1, '#FFF6CC');
      const sc = Math.min(cv.dpr, 1.5);
      discA = paintDisc(G.R, sc, 101);
      discB = paintDisc(G.R, sc, 202);
      swirl = paintSwirl(G.R * CORE0 * 1.1, Math.min(cv.dpr, 1.25));
      corona = paintCorona(G.R, Math.min(cv.dpr, 1.25));
      buildSprites();
      bg = makeBg(w, h);
      if (stage.querySelector('.gesture')) api.gesture('hold', { x: (G.cx / w) * 100, y: (G.cy / h) * 100 });
    }

    function buildSprites() {
      const dpr = cv.dpr;
      sprH = ballSprite(G.rH, {
        hi: '#FFC2B4', body: '#F2453D', shade: '#B01E1E', rim: '#6E0E0E', light: 'rgba(255,190,120,0.55)', shadow: 'rgba(70,6,0,0.5)',
      }, dpr);
      sprHe = ballSprite(G.rHe, {
        hi: '#FFFDE8', body: '#FFDC4E', shade: '#E8A21C', rim: '#9C5A06', light: 'rgba(255,255,220,0.7)', shadow: 'rgba(90,30,0,0.55)',
      }, dpr);
      /* rayon de lumière : une traînée dont la tête est à droite */
      const L = Math.max(30, G.R * 0.36), W = Math.max(5, G.rH * 1.25);
      streak = mk(L, W, dpr);
      const g = streak.g;
      const lg = g.createLinearGradient(0, 0, L, 0);
      lg.addColorStop(0, 'rgba(255,200,100,0)');
      lg.addColorStop(0.7, 'rgba(255,214,130,0.4)');
      lg.addColorStop(1, 'rgba(255,244,205,0.95)');
      g.fillStyle = lg;
      g.beginPath();
      g.moveTo(0, W / 2 - 0.3);
      g.lineTo(L - W / 2, 0.6);
      g.arc(L - W / 2, W / 2, W / 2 - 0.6, -Math.PI / 2, Math.PI / 2);
      g.lineTo(0, W / 2 + 0.3);
      g.closePath();
      g.fill();
      const lc = g.createLinearGradient(0, 0, L, 0);
      lc.addColorStop(0, 'rgba(255,255,255,0)');
      lc.addColorStop(1, 'rgba(255,255,255,1)');
      g.fillStyle = lc;
      g.fillRect(L * 0.3, W / 2 - 0.7, L * 0.7 - 1, 1.4);
    }

    function makeBg(w, h) {
      const B = mk(w, h, cv.dpr);
      const g = B.g;
      const gr = g.createRadialGradient(G.cx, G.cy, G.R * 0.6, G.cx, G.cy, Math.max(w, h) * 0.9);
      gr.addColorStop(0, '#45180A');
      gr.addColorStop(0.4, '#200A04');
      gr.addColorStop(1, '#0A0302');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
      const r = seeded(9);
      for (let i = 0; i < 110; i++) {
        const x = r() * w, y = r() * h, s = 0.5 + r() * 1.2;
        if (Math.hypot(x - G.cx, y - G.cy) < G.R * 1.02) continue;
        g.fillStyle = `rgba(255,236,214,${0.12 + r() * 0.5})`;
        g.fillRect(x, y, s, s);
      }
      for (let i = 0; i < 9; i++) {
        const x = r() * w, y = r() * h;
        /* pas d'étoile brillante près de la jauge ni sous la légende */
        if (Math.hypot(x - G.cx, y - G.cy) < G.gR + 34 || y > h - 60) continue;
        draw.glow(g, x, y, 5, '#FFE6C8', 0.4);
        g.fillStyle = 'rgba(255,248,236,0.85)';
        g.fillRect(x - 0.7, y - 0.7, 1.4, 1.4);
      }
      return B;
    }

    /* ---- état ---- */
    const fingers = new Map();   /* doigts posés sur le Soleil */
    const hs = [];               /* hydrogènes qui flottent dans le cœur */
    for (let i = 0; i < N_H; i++) hs.push({ u: 0, v: 0, a: 0, ph: 0 });
    let groups = [], he = [], rays = [], sparks = [], flashes = [], rings = [], bursts = [], flares = [];
    let heat = 0, squeezeV = 0, tapBoost = 0, phase = 'serre', count = 0, finished = false;
    let hotState = false, spawnT = 0, ringT = 0, idleT = 0, tickStep = 0, lum = 0, pulse = 0, bloom = 0;
    let started = false, hintKey = '', shownProg = -1, time = 0, rot = 0, tempHot = false;

    function coreR() {
      return G.R * lerp(CORE0, CORE1, ease.inOutSine(heat));
    }

    function setHint(key) {
      if (hintKey === key) return;
      hintKey = key;
      api.hint(TEXTES[key]);
    }
    function updateStatus() {
      if (finished) return;
      api.status(phase === 'fusion' ? TEXTES.statut(count) : '');
    }
    function updateProgress() {
      const p = phase === 'serre' ? 0.25 * heat : 0.25 + 0.75 * clamp(count / GOAL);
      if (Math.abs(p - shownProg) < 0.005) return;
      shownProg = p;
      if (!finished) api.progress(p);
    }

    /* ---- interaction ---- */
    function pressStart(p) {
      started = true;
      bursts.push({ x: p.x, y: p.y, t: 0, dur: 0.55, on: true });
      api.sfx.play('thud', { pitch: 0.75, volume: 0.6 });
      api.buzz(8);
    }
    api.track(cv.canvas, {
      down(p) {
        const inside = Math.hypot(p.x - G.cx, p.y - G.cy) <= G.R * 1.15;
        if (!inside) {
          bursts.push({ x: p.x, y: p.y, t: 0, dur: 0.45, on: false });
          api.sfx.play('tick', { pitch: 0.7 });
          if (phase === 'serre' && !finished) setHint('centre');
          return;
        }
        fingers.set(p.id, { x: p.x, y: p.y });
        pressStart(p);
      },
      move(p) {
        const f = fingers.get(p.id);
        if (f) { f.x = p.x; f.y = p.y; }
      },
      up(p, e, cancelled) {
        if (!fingers.has(p.id)) return;
        fingers.delete(p.id);
        if (cancelled || !p.tap) return;
        /* une tape compte comme un petit moment d'appui */
        tapBoost = Math.max(tapBoost, TAP_PRESS);
        if (phase === 'serre' && !finished && hintKey !== 'tape') setHint('tape');
      },
    }, { touchAction: 'pan-y' });
    cv.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    /* ---- fusion ---- */
    function startFusion() {
      phase = 'fusion';
      hotState = true;
      spawnT = 0.35;
      setHint('chaud');
      updateStatus();
      flashes.push({ x: G.cx, y: G.cy, t: 0, dur: 0.9, big: true });
      pulse = Math.min(1.6, pulse + 0.8);
      api.sfx.play('chime', { pitch: 0.85 });
      api.buzz(12);
    }

    function spawnGroup() {
      const pa = rand(TAU), pr = Math.sqrt(Math.random()) * 0.42;
      const g = { px: Math.cos(pa) * pr, py: Math.sin(pa) * pr, k: 0, state: 'come', tt: 0, spin: rand(TAU), vis: 0, cold: 0, dead: false, balls: [] };
      const base = rand(TAU);
      for (let i = 0; i < 4; i++) {
        const a = base + (i / 4) * TAU + rand(-0.35, 0.35);
        const rs = rand(1.25, 1.55);
        g.balls.push({ sx: Math.cos(a) * rs, sy: Math.sin(a) * rs, oa: Math.PI / 4 + (i / 4) * TAU, ph: rand(TAU), f: rand(9, 13), x: 0, y: 0 });
      }
      groups.push(g);
    }

    function emitRays(x, y, n, spd) {
      const base = rand(TAU);
      for (let i = 0; i < n; i++) {
        rays.push({ x, y, a: base + (i / n) * TAU + rand(-0.16, 0.16), d: rand(0, 8), sp: G.R * rand(1.5, 2.1) * (spd || 1), w: rand(0.75, 1.2), out: false });
      }
      if (rays.length > 80) rays.splice(0, rays.length - 80);
    }

    function fuse(g) {
      g.dead = true;
      const cr = coreR();
      const x = G.cx + g.px * cr, y = G.cy + g.py * cr;
      he.push({ u: g.px, v: g.py, vu: 0, vv: 0, t: 0, out: -1 });
      flashes.push({ x, y, t: 0, dur: 0.6, big: false });
      emitRays(x, y, 9);
      for (let i = 0; i < 16; i++) {
        const a = rand(TAU), s = G.R * rand(0.25, 0.9);
        sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, life: rand(0.35, 0.7) });
      }
      if (sparks.length > 160) sparks.splice(0, sparks.length - 160);
      pulse = Math.min(1.6, pulse + 0.55);
      api.buzz(10);
      if (finished) {
        api.sfx.play('chime', { pitch: rand(1.1, 1.5), volume: 0.6 });
        /* après la victoire, les plus vieux héliums s'effacent pour laisser la place */
        let alive = 0;
        for (const a of he) if (a.out < 0) alive++;
        for (const a of he) {
          if (alive <= 12) break;
          if (a.out < 0) { a.out = 0; alive--; }
        }
        return;
      }
      count++;
      api.sfx.play('chime', { pitch: 0.9 + count * 0.06 });
      api.sfx.play('whoosh', { pitch: 1.6, volume: 0.35 });
      updateStatus();
      if (count === 1) setHint('premier');
      if (count >= GOAL) win();
    }

    function win() {
      finished = true;
      bloom = 1;
      emitRays(G.cx, G.cy, 26, 1.15);
      flashes.push({ x: G.cx, y: G.cy, t: 0, dur: 1.3, big: true });
      api.sfx.play('rumble', { volume: 0.7 });
      api.done(TEXTES.fin, TEXTES.finStatut);
      api.guide(null, 'laugh', TEXTES.bravo);
    }

    /* ---- animation ---- */
    function update(dt) {
      time += dt;
      rot += dt * 0.02 * AMB;
      if (tapBoost > 0) tapBoost = Math.max(0, tapBoost - dt);
      const pressing = fingers.size > 0 || tapBoost > 0;
      squeezeV = approach(squeezeV, pressing ? 1 : 0, dt * (pressing ? 6 : 2.2));
      if (pressing) {
        heat = Math.min(1, heat + dt / FILL_T);
        idleT = 0;
        ringT -= dt;
        if (ringT <= 0 && rings.length < 10) {
          ringT = 0.26;
          rings.push({ k: 0 });
        }
      } else {
        heat = Math.max(0, heat - dt / FALL_T);
        idleT += dt;
      }

      if (phase === 'serre') {
        const step = Math.floor(heat * 10 + 1e-6);
        if (step > tickStep && pressing) api.sfx.play('tick', { pitch: 0.8 + step * 0.09, gap: 0 });
        tickStep = step;
        if (heat >= 1) startFusion();
        else if (!pressing && heat > 0.04 && idleT > 0.5 && hintKey !== 'tape') setHint('lache');
      }
      const hot = phase === 'fusion' && heat >= FUSE_MIN;
      if (phase === 'fusion') {
        if (!hot && hotState) {
          hotState = false;
          if (!finished) setHint('froid');
        } else if (hot && !hotState) {
          hotState = true;
          if (!finished) setHint('repart');
        }
        if (hot) {
          spawnT -= dt;
          if (spawnT <= 0 && groups.length < 2) {
            spawnGroup();
            spawnT = GROUP_EVERY;
          }
        }
      }
      if (hot !== tempHot) {
        tempHot = hot;
        tempEl.classList.toggle('is-hot', hot);
      }

      /* groupes de 4 hydrogènes */
      for (let i = 0; i < groups.length; i++) {
        const g = groups[i];
        if (g.state === 'come') {
          if (hot) {
            g.k = Math.min(1, g.k + dt / GROUP_DUR);
            g.cold = 0;
            g.vis = Math.min(1, g.vis + dt / 0.3);
          } else {
            /* trop froid : ils s'écartent, puis repartent */
            g.k = Math.max(0, g.k - dt * 0.35);
            g.cold += dt;
            if (g.cold > 1.6) {
              g.vis -= dt / 0.6;
              if (g.vis <= 0) g.dead = true;
            }
          }
          if (g.k >= 1) {
            g.state = 'touch';
            g.tt = 0;
            api.sfx.play('pop', { pitch: 1.35, volume: 0.6 });
          }
        } else {
          g.tt += dt;
          if (g.tt >= TOUCH_T) fuse(g);
        }
      }
      let j = 0;
      for (let i = 0; i < groups.length; i++) if (!groups[i].dead) groups[j++] = groups[i];
      groups.length = j;

      /* hydrogènes du cœur : plus c'est chaud, plus ils s'agitent */
      const sp = (0.1 + 0.8 * heat) * (api.reducedMotion ? 0.5 : 1);
      for (const p of hs) {
        p.a += (Math.random() - 0.5) * dt * 7;
        p.u += Math.cos(p.a) * sp * dt;
        p.v += Math.sin(p.a) * sp * dt;
        const r = Math.hypot(p.u, p.v);
        if (r > 0.82) {
          p.u *= 0.82 / r;
          p.v *= 0.82 / r;
          p.a = Math.atan2(-p.v, -p.u) + rand(-0.7, 0.7);
        }
      }

      /* héliums : ils se poussent un peu et restent dans le cœur */
      const cr = coreR();
      const minD = (G.rHe * 2.08) / cr;
      const lim = 1 - (G.rHe * 1.2) / cr;
      for (const a of he) {
        a.t += dt;
        if (a.out >= 0) a.out += dt;
        a.vu += (Math.random() - 0.5) * dt * (0.4 + heat) * 1.2;
        a.vv += (Math.random() - 0.5) * dt * (0.4 + heat) * 1.2;
        const damp = Math.pow(0.2, dt);
        a.vu *= damp;
        a.vv *= damp;
        a.u += a.vu * dt;
        a.v += a.vv * dt;
      }
      for (let i = 0; i < he.length; i++) {
        const a = he[i];
        for (let k = i + 1; k < he.length; k++) {
          const b = he[k];
          const dx = b.u - a.u, dy = b.v - a.v;
          const d = Math.hypot(dx, dy) || 1e-4;
          if (d < minD) {
            const push = (minD - d) * 0.5;
            const nx = dx / d, ny = dy / d;
            a.u -= nx * push; a.v -= ny * push;
            b.u += nx * push; b.v += ny * push;
          }
        }
        const r = Math.hypot(a.u, a.v);
        if (r > lim) {
          a.u *= lim / r;
          a.v *= lim / r;
          a.vu *= -0.3;
          a.vv *= -0.3;
        }
      }
      j = 0;
      for (let i = 0; i < he.length; i++) if (he[i].out < 0.8) he[j++] = he[i];
      he.length = j;

      /* quand un rayon sort par la surface, un petit éclat s'allume sur le bord */
      const lim2 = (G.R * 0.985) * (G.R * 0.985);
      for (const r of rays) {
        r.d += r.sp * dt;
        if (!r.out) {
          const hx = r.x + Math.cos(r.a) * r.d - G.cx, hy = r.y + Math.sin(r.a) * r.d - G.cy;
          if (hx * hx + hy * hy >= lim2) {
            r.out = true;
            if (flares.length < 40) flares.push({ x: G.cx + hx, y: G.cy + hy, t: 0 });
          }
        }
      }
      for (const f of flares) f.t += dt;
      j = 0;
      for (let i = 0; i < flares.length; i++) if (flares[i].t < 0.5) flares[j++] = flares[i];
      flares.length = j;
      const rmax = G.R * 1.95 + G.R * 0.36;
      j = 0;
      for (let i = 0; i < rays.length; i++) if (rays[i].d < rmax) rays[j++] = rays[i];
      rays.length = j;
      for (const s of sparks) {
        s.t += dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vx *= Math.pow(0.12, dt);
        s.vy *= Math.pow(0.12, dt);
      }
      j = 0;
      for (let i = 0; i < sparks.length; i++) if (sparks[i].t < sparks[i].life) sparks[j++] = sparks[i];
      sparks.length = j;
      for (const f of flashes) f.t += dt;
      j = 0;
      for (let i = 0; i < flashes.length; i++) if (flashes[i].t < flashes[i].dur) flashes[j++] = flashes[i];
      flashes.length = j;
      for (const rg of rings) rg.k += dt / 0.9;
      j = 0;
      for (let i = 0; i < rings.length; i++) if (rings[i].k < 1) rings[j++] = rings[i];
      rings.length = j;
      for (const b of bursts) b.t += dt;
      j = 0;
      for (let i = 0; i < bursts.length; i++) if (bursts[i].t < bursts[i].dur) bursts[j++] = bursts[i];
      bursts.length = j;

      lum = approach(lum, finished ? 1 : clamp(count / GOAL), dt * 1.6);
      pulse *= Math.pow(0.12, dt);
      if (finished) bloom = lerp(0.3, bloom, Math.pow(0.35, dt));
      updateProgress();
    }

    function drawRot(sp, x, y, ang, sc, flip) {
      const w = sp.w * sc, h = sp.h * sc;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      if (flip) ctx.scale(-1, 1);
      ctx.drawImage(sp.c, -w / 2, -h / 2, w, h);
      ctx.restore();
    }

    function render() {
      if (!bg) return;
      const { w, h } = cv;
      const { cx, cy, R } = G;
      const L = clamp(lum + pulse * 0.35 + bloom * 0.5, 0, 1.8);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.drawImage(bg.c, 0, 0, w, h);

      /* couronne (deux calques qui tournent en sens contraire) */
      ctx.globalCompositeOperation = 'lighter';
      const cs = (1 + 0.05 * lum + 0.12 * bloom + 0.02 * pulse) * (1 - squeezeV * 0.012);
      ctx.globalAlpha = clamp(0.55 + 0.3 * L, 0, 0.95);
      drawRot(corona, cx, cy, time * 0.012 * AMB, cs);
      ctx.globalAlpha = clamp(0.28 + 0.22 * L, 0, 0.6);
      drawRot(corona, cx, cy, 2.1 - time * 0.008 * AMB, cs * 1.05, true);
      ctx.globalAlpha = 1;
      draw.glow(ctx, cx, cy, R * (1.5 + 0.25 * L), '#FF9A3A', 0.16 + 0.16 * L);

      /* le disque, qui « bout » doucement */
      ctx.globalCompositeOperation = 'source-over';
      const ds = 1 - squeezeV * 0.025 + Math.sin(time * 1.3) * 0.002 * AMB;
      drawRot(discA, cx, cy, rot, ds);
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(time * 0.4 * AMB);
      drawRot(discB, cx, cy, rot, ds);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'lighter';
      draw.glow(ctx, cx, cy, R * 0.98, '#FFB850', 0.07 * L + 0.1 * pulse);

      /* la gravité qui serre : des anneaux qui se resserrent vers le cœur */
      const cr = coreR();
      for (const rg of rings) {
        const k = rg.k, s = Math.sin(Math.PI * k);
        const rr = lerp(R * 0.99, cr * 1.04, ease.inQuad(k));
        ctx.strokeStyle = `rgba(255,226,180,${0.11 * s})`;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(cx, cy, rr, 0, TAU);
        ctx.stroke();
        ctx.strokeStyle = `rgba(255,240,214,${0.2 * s})`;
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';

      drawCore(cr);

      /* hydrogènes qui flottent */
      const sH = sprH.w;
      const jit = (0.012 + 0.05 * heat) * AMB;
      for (const p of hs) {
        const x = cx + (p.u + Math.sin(time * 23 + p.a * 5) * jit) * cr;
        const y = cy + (p.v + Math.cos(time * 19 + p.a * 3) * jit) * cr;
        ctx.drawImage(sprH.c, x - sH / 2, y - sH / 2, sH, sH);
      }
      /* héliums (après la victoire, une seule lueur douce pour tout le groupe) */
      const sHe = sprHe.w;
      if (finished && he.length) {
        ctx.globalCompositeOperation = 'lighter';
        draw.glow(ctx, cx, cy, cr * 1.25, '#FFF0A0', 0.28 + 0.1 * Math.sin(time * 3));
        ctx.globalCompositeOperation = 'source-over';
      }
      for (const a of he) {
        const k = clamp(a.t / 0.5);
        const s = sHe * (a.t < 0.5 ? ease.outBack(k) : 1);
        const x = cx + a.u * cr, y = cy + a.v * cr;
        const al = a.out >= 0 ? 1 - a.out / 0.8 : 1;
        if (a.t < 1.2) {
          ctx.globalCompositeOperation = 'lighter';
          const gl = 1 - a.t / 1.2;
          draw.glow(ctx, x, y, G.rHe * (2.2 + 1.5 * gl), '#FFF0A0', 0.5 * gl * al);
          ctx.globalCompositeOperation = 'source-over';
        }
        ctx.globalAlpha = al;
        ctx.drawImage(sprHe.c, x - s / 2, y - s / 2, s, s);
        ctx.globalAlpha = 1;
      }
      /* groupes de 4 hydrogènes qui se rejoignent */
      for (const g of groups) {
        const e = ease.inOutCubic(g.k);
        const sq = g.state === 'touch' ? lerp(1, 0.6, ease.inQuad(g.tt / TOUCH_T)) : 1;
        const off = (0.95 * sq * G.rH) / cr;
        const gx = cx + g.px * cr, gy = cy + g.py * cr;
        const near = g.state === 'touch' ? 1 : e;
        const vis = clamp(g.vis);
        for (const b of g.balls) {
          const tx = g.px + Math.cos(b.oa + g.spin) * off, ty = g.py + Math.sin(b.oa + g.spin) * off;
          const jj = (0.04 + 0.08 * heat) * (1 - e * 0.85) * AMB;
          const u = lerp(b.sx, tx, e) + Math.sin(time * b.f + b.ph) * jj;
          const v = lerp(b.sy, ty, e) + Math.cos(time * b.f * 1.13 + b.ph) * jj;
          b.x = cx + u * cr;
          b.y = cy + v * cr;
        }
        /* un halo clair autour de chaque noyau du groupe, et au point de rencontre */
        ctx.globalCompositeOperation = 'lighter';
        draw.glow(ctx, gx, gy, G.rH * (3 + 3 * near), '#FFE2A0', (0.05 + 0.42 * near * near) * vis);
        for (const b of g.balls) draw.glow(ctx, b.x, b.y, G.rH * 2.5, '#FFE6B8', 0.42 * vis);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = vis;
        for (const b of g.balls) ctx.drawImage(sprH.c, b.x - sH / 2, b.y - sH / 2, sH, sH);
        ctx.globalAlpha = 1;
      }

      /* éclairs, rayons et étincelles de la fusion */
      ctx.globalCompositeOperation = 'lighter';
      for (const f of flashes) {
        const k = f.t / f.dur;
        if (f.big) {
          draw.glow(ctx, f.x, f.y, R * (0.6 + 1.6 * ease.outCubic(k)), '#FFF4D0', 0.75 * (1 - k));
        } else {
          draw.glow(ctx, f.x, f.y, G.rHe * (2 + 7 * ease.outCubic(k)), '#FFFBE8', 0.95 * (1 - k));
          ctx.strokeStyle = `rgba(255,250,225,${0.7 * (1 - k)})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(f.x, f.y, G.rHe * (1 + 6 * ease.outCubic(k)), 0, TAU);
          ctx.stroke();
        }
      }
      const SL = streak.w, SW = streak.h;
      const fadeFrom = R * 1.25, fadeTo = R * 1.95;
      for (const r of rays) {
        const a = clamp(1 - (r.d - fadeFrom) / (fadeTo - fadeFrom)) * clamp(r.d / (R * 0.12));
        if (a <= 0.01) continue;
        ctx.globalAlpha = a;
        ctx.save();
        ctx.translate(r.x, r.y);
        ctx.rotate(r.a);
        ctx.drawImage(streak.c, r.d - SL, -SW * r.w / 2, SL, SW * r.w);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      for (const f of flares) {
        const k = f.t / 0.5;
        draw.glow(ctx, f.x, f.y, lerp(5, 20, ease.outCubic(k)), '#FFF2C4', 0.75 * (1 - k));
      }
      for (const s of sparks) {
        const k = s.t / s.life;
        ctx.fillStyle = `rgba(255,244,200,${0.9 * (1 - k)})`;
        ctx.fillRect(s.x - 1.1, s.y - 1.1, 2.2, 2.2);
      }
      if (bloom > 0.31) {
        /* la victoire : tout le Soleil s'illumine */
        draw.glow(ctx, cx, cy, R * 1.15, '#FFE6A8', (bloom - 0.3) * 0.5);
        draw.glow(ctx, cx, cy, R * 2.2, '#FFD27A', (bloom - 0.3) * 0.35);
      }
      ctx.globalCompositeOperation = 'source-over';

      drawGauge();

      /* doigts posés et petites ondes au contact */
      for (const b of bursts) {
        const k = b.t / b.dur;
        ctx.strokeStyle = b.on ? `rgba(255,240,205,${0.75 * (1 - k)})` : `rgba(255,230,210,${0.45 * (1 - k)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(b.x, b.y, lerp(8, b.on ? 44 : 30, ease.outCubic(k)), 0, TAU);
        ctx.stroke();
      }
      fingers.forEach((f) => {
        const rr = 25 + Math.sin(time * 9) * 2.5;
        ctx.globalCompositeOperation = 'lighter';
        draw.glow(ctx, f.x, f.y, rr * 1.4, '#FFE6B0', 0.22);
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = 'rgba(255,244,220,0.55)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(f.x, f.y, rr, 0, TAU);
        ctx.stroke();
      });
    }

    function drawCore(cr) {
      const { cx, cy } = G;
      const hh = ease.inOutSine(heat);
      ctx.globalCompositeOperation = 'lighter';
      draw.glow(ctx, cx, cy, cr * 2, '#FFA536', 0.2 + 0.28 * hh + 0.2 * pulse);
      ctx.globalCompositeOperation = 'source-over';
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr * 1.1);
      g.addColorStop(0, lib.mix('#FFD47E', '#FFFBEA', hh));
      g.addColorStop(0.5, lib.mix('#FFA238', '#FFDF86', hh));
      g.addColorStop(0.84, lib.mix('#FF7A1A', '#FFAA38', hh));
      g.addColorStop(1, lib.mix('#FF7A1A', '#FFAA38', hh, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, cr * 1.1, 0, TAU);
      ctx.fill();
      /* tourbillons de plasma */
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, TAU);
      ctx.clip();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.2 + 0.18 * hh;
      drawRot(swirl, cx, cy, time * (0.12 + 0.45 * hh) * AMB, cr / (G.R * CORE0));
      ctx.globalAlpha = 1;
      ctx.restore();
      /* contour du cœur, qui invite à le toucher tant qu'on ne l'a pas fait */
      const inv = started ? 0 : 0.5 + 0.5 * Math.sin(time * 2.6);
      ctx.strokeStyle = `rgba(255,246,214,${0.14 + 0.1 * hh + 0.3 * inv})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, cr * (1.02 + 0.05 * inv), 0, TAU);
      ctx.stroke();
    }

    /* Jauge de température : un thermomètre courbé le long du Soleil */
    function drawGauge() {
      const { cx, cy, gR, gA0, gA1, gW } = G;
      const bx = cx + Math.cos(gA0) * gR, by = cy + Math.sin(gA0) * gR;
      /* le tube de verre : une ombre douce, un verre sombre translucide et un liseré clair */
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(12,3,1,0.35)';
      ctx.lineWidth = gW + 9;
      ctx.beginPath();
      ctx.arc(cx, cy, gR, gA1, gA0);
      ctx.stroke();
      ctx.fillStyle = 'rgba(12,3,1,0.35)';
      ctx.beginPath();
      ctx.arc(bx, by, gW * 1.35 + 5, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,232,196,0.34)';
      ctx.lineWidth = gW + 4.5;
      ctx.beginPath();
      ctx.arc(cx, cy, gR, gA1, gA0);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,232,196,0.34)';
      ctx.beginPath();
      ctx.arc(bx, by, gW * 1.35 + 2.3, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(58,20,8,0.82)';
      ctx.lineWidth = gW + 2;
      ctx.beginPath();
      ctx.arc(cx, cy, gR, gA1, gA0);
      ctx.stroke();
      ctx.fillStyle = 'rgba(58,20,8,0.9)';
      ctx.beginPath();
      ctx.arc(bx, by, gW * 1.35 + 1, 0, TAU);
      ctx.fill();
      /* graduations */
      for (let i = 1; i <= 10; i++) {
        const a = lerp(gA0, gA1, i / 10);
        const big = i === 10;
        const r0 = gR + gW / 2 + 4.5, r1 = r0 + (big ? 7 : i === 5 ? 5.5 : 4);
        ctx.strokeStyle = big ? 'rgba(255,240,200,0.9)' : 'rgba(255,226,190,0.5)';
        ctx.lineWidth = big ? 2.4 : 1.6;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        ctx.stroke();
      }
      ctx.fillStyle = lib.mix('#B8261C', '#FF8A1E', heat);
      ctx.beginPath();
      ctx.arc(bx, by, gW * 1.35 - 0.5, 0, TAU);
      ctx.fill();
      /* le liquide monte */
      const af = gA0 - (gA0 - gA1) * heat;
      ctx.strokeStyle = gaugeGrad;
      ctx.lineWidth = gW;
      ctx.beginPath();
      ctx.arc(cx, cy, gR, af, gA0);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = Math.max(1, gW * 0.22);
      ctx.beginPath();
      ctx.arc(cx, cy, gR - gW * 0.18, af, gA0);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.arc(bx - gW * 0.4, by - gW * 0.45, gW * 0.32, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      const hx = cx + Math.cos(af) * gR, hy = cy + Math.sin(af) * gR;
      draw.glow(ctx, hx, hy, gW * 2.6, '#FFD07A', 0.25 + 0.5 * squeezeV);
      if (phase === 'fusion' && heat >= FUSE_MIN) {
        const ex = cx + Math.cos(gA1) * gR, ey = cy + Math.sin(gA1) * gR;
        draw.glow(ctx, ex, ey, gW * 4.5, '#FFE7A0', 0.35 + 0.15 * Math.sin(time * 5));
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    function init() {
      fingers.clear();
      heat = 0;
      squeezeV = 0;
      tapBoost = 0;
      phase = 'serre';
      count = 0;
      finished = false;
      hotState = false;
      spawnT = 0;
      ringT = 0;
      idleT = 0;
      tickStep = 0;
      lum = 0;
      pulse = 0;
      bloom = 0;
      started = false;
      shownProg = -1;
      groups = [];
      he = [];
      rays = [];
      sparks = [];
      flashes = [];
      rings = [];
      bursts = [];
      flares = [];
      hs.forEach((p, i) => {
        const a = (i / N_H) * TAU + rand(-0.3, 0.3), r = Math.sqrt(rand(0.05, 0.6));
        p.u = Math.cos(a) * r;
        p.v = Math.sin(a) * r;
        p.a = rand(TAU);
      });
      tempEl.classList.remove('is-hot');
      tempHot = false;
      hintKey = '';
      setHint('consigne');
      api.status('');
      api.progress(0);
      const gx = G.w > 1 ? (G.cx / G.w) * 100 : 50;
      const gy = G.h > 1 ? (G.cy / G.h) * 100 : 45;
      api.gesture('hold', { x: gx, y: gy });
    }

    if (/[?&]debug\b/.test(location.search)) {
      api.root.__dbg = () => ({ heat, phase, count, groups: groups.length, he: he.length, rays: rays.length, finished });
    }

    cv.onResize(geometry);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => { if (cv.w > 1) geometry(cv.w, cv.h); });
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
