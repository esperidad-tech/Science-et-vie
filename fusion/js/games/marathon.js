/* Le marathon du plasma : la coupe d'un tokamak, avec son plasma en forme de D au-dessus du
   diverteur. Le joueur garde le doigt appuyé (chauffage allumé) et le glisse à gauche ou à droite
   pour garder le plasma au centre pendant que des vagues de perturbation le poussent. Le temps
   est accéléré : 1 s de jeu = 30 s de plasma. Paliers : les records d'EAST et de WEST, puis
   l'objectif de Wendelstein 7-X. Rien n'explose : sans chauffage, ou s'il touche la paroi,
   le plasma s'éteint calmement et l'on repart du dernier palier atteint. */
(function () {
  'use strict';
  const { lib } = window.RM;
  const { TAU, rand, clamp, lerp, ease, rgba, draw } = lib;

  /* Tous les textes du jeu, faciles à corriger */
  const TEXTES = {
    consigne: 'Garde le doigt appuyé pour chauffer, et glisse-le pour garder le plasma au centre.',
    chrono: 'secondes de plasma',
    unite: 's',
    paliers: [
      { s: 403, court: '403\u00A0s', long: '403\u00A0s (EAST, 2023)' },
      { s: 1066, court: '1 066\u00A0s', long: '1 066\u00A0s (EAST, janvier 2025)' },
      { s: 1337, court: '1 337\u00A0s', long: '1 337\u00A0s = 22\u00A0min 17\u00A0s (WEST, 12 février 2025)' },
      { s: 1800, court: '1 800\u00A0s', long: '1 800\u00A0s : l’objectif de Wendelstein 7-X, 30\u00A0minutes' },
    ],
    prochain: (p) => `Prochain palier : ${p}`,
    temperature: '50 000 000 °C',
    chauffage: '2 MW de chauffage',
    coupe: 'Chauffage coupé : remets vite ton doigt !',
    eteintDoigt: 'Plus de chauffage : le plasma refroidit en quelques secondes, la réaction s’arrête toute seule.',
    eteintParoi: 'Le plasma a touché la paroi : il refroidit en quelques secondes, la réaction s’arrête toute seule.',
    rallume: (p) => `Appuie pour rallumer le plasma : tu repars de ${p}.`,
    fin: 'Plus de 1 337\u00A0s : tu bats le record de WEST !',
    finStatut: 'Continue jusqu’à 1 800\u00A0s : l’objectif de Wendelstein 7-X, 30\u00A0minutes.',
    bonus: '1 800\u00A0s : l’objectif de Wendelstein 7-X, 30\u00A0minutes. Champion !',
    bravo: '{bravo}',
  };

  const CSS = `
.game[data-game="marathon"] .mt-clock { position: absolute; z-index: 3; left: 14px; top: 9px; margin: 0; pointer-events: none; white-space: nowrap; }
.game[data-game="marathon"] .mt-num {
  font: 800 1.875rem/1 var(--font-text); font-variant-numeric: tabular-nums; letter-spacing: -0.01em;
  color: #FFF4EA; text-shadow: 0 0 18px rgba(255, 138, 61, 0.5);
}
.game[data-game="marathon"] .mt-unit { margin-left: 4px; font: 700 1.0625rem/1 var(--font-text); color: #FFC7A0; }
.game[data-game="marathon"] .mt-cap { display: block; margin-top: 3px; font: 600 0.75rem/1.1 var(--font-text); color: #A6B3D9; letter-spacing: 0.02em; }
.game[data-game="marathon"] .mt-tags {
  position: absolute; z-index: 3; right: 12px; top: 9px; display: flex; flex-direction: column; align-items: flex-end; gap: 5px;
  pointer-events: none; opacity: 0; transform: translateY(-5px); transition: opacity 0.5s, transform 0.5s;
}
.game[data-game="marathon"] .mt-tags.is-on { opacity: 1; transform: none; }
.game[data-game="marathon"] .mt-tag {
  display: inline-flex; align-items: center; gap: 5px; padding: 4px 9px 4px 7px; border-radius: 10px 12px 11px 9px;
  background: rgba(7, 15, 36, 0.74); box-shadow: inset 0 0 0 1px rgba(255, 138, 61, 0.42);
  font: 700 0.75rem/1.1 var(--font-text); color: #FFD9BE; white-space: nowrap; font-variant-numeric: tabular-nums;
}
.game[data-game="marathon"] .mt-tag svg { width: 13px; height: 13px; flex: none; }
.game[data-game="marathon"] .mt-track { position: absolute; z-index: 3; left: 16px; right: 16px; height: 28px; pointer-events: none; }
.game[data-game="marathon"] .mt-rail {
  position: absolute; left: 0; right: 0; top: 4px; height: 6px; border-radius: 4px 3px 4px 3px; overflow: hidden;
  background: rgba(166, 179, 217, 0.15); box-shadow: inset 0 0 0 1px rgba(166, 179, 217, 0.2);
}
.game[data-game="marathon"] .mt-fill {
  position: absolute; left: 0; top: 0; bottom: 0; width: calc(var(--p, 0) * 100%); border-radius: inherit;
  background: linear-gradient(90deg, #B84CF0, #FF6FD8 55%, #FF8A3D);
}
.game[data-game="marathon"] .mt-notch {
  position: absolute; top: 1px; width: 2px; height: 12px; margin-left: -1px; border-radius: 1px; background: rgba(234, 240, 255, 0.5);
}
.game[data-game="marathon"] .mt-notch.is-hit { background: #FFD2B0; box-shadow: 0 0 7px rgba(255, 138, 61, 0.95); }
.game[data-game="marathon"] .mt-lab {
  position: absolute; top: 15px; transform: translateX(-50%); white-space: nowrap;
  font: 700 0.6875rem/1 var(--font-text); color: #A6B3D9; font-variant-numeric: tabular-nums;
}
.game[data-game="marathon"] .mt-lab.is-last { transform: translateX(-100%); }
.game[data-game="marathon"] .mt-lab.is-up { top: -12px; }
.game[data-game="marathon"] .mt-lab.is-hit { color: #FFD2B0; }
.game[data-game="marathon"] .mt-toast {
  position: absolute; z-index: 4; left: 50%; max-width: 84%; padding: 7px 12px 8px; text-align: center; pointer-events: none;
  border-radius: 12px 15px 13px 11px; background: rgba(7, 15, 36, 0.84);
  box-shadow: inset 0 0 0 1.5px rgba(255, 138, 61, 0.65), 0 10px 24px -10px rgba(0, 0, 0, 0.7);
  font: 700 0.875rem/1.25 var(--font-text); color: #FFF4EA;
  opacity: 0; transform: translate(-50%, 6px); transition: opacity 0.35s, transform 0.35s;
}
.game[data-game="marathon"] .mt-toast.is-on { opacity: 1; transform: translate(-50%, 0); }
.game[data-game="marathon"] .mt-toast svg { width: 15px; height: 15px; vertical-align: -2px; margin-right: 5px; }
.game[data-game="marathon"] .mt-t1 { display: block; white-space: nowrap; }
.game[data-game="marathon"] .mt-t2 { display: block; font-weight: 600; font-size: 0.8125rem; color: #FFD2B0; }
.game[data-game="marathon"] .mt-t2:empty { display: none; }
.game[data-game="marathon"] .mt-pad { position: absolute; z-index: 2; left: 0; right: 0; bottom: 0; touch-action: none; -webkit-tap-highlight-color: transparent; }
.game[data-game="marathon"] .gesture-dot {
  box-shadow: 0 0 0 7px rgba(255, 255, 255, 0.22), 0 0 0 15px rgba(255, 138, 61, 0.3), 0 4px 14px rgba(0, 0, 0, 0.4);
}
`;

  const ICON_THERMO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4.5a2 2 0 0 1 4 0v9.2a4.2 4.2 0 1 1-4 0z" fill="none" stroke="#FF9BE6" stroke-width="2"/>' +
    '<circle cx="12" cy="17.4" r="2.2" fill="#FF6FD8"/><path d="M12 15.2V8" stroke="#FF6FD8" stroke-width="2" stroke-linecap="round"/></svg>';
  const ICON_CHAUFFE = '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="#FF8A3D" stroke-width="2.2" stroke-linecap="round">' +
    '<path d="M6 20c-2.2-3 2.2-5 0-8.5S6 6 6 4M12 20c-2.2-3 2.2-5 0-8.5S12 6 12 4M18 20c-2.2-3 2.2-5 0-8.5S18 6 18 4"/></g></svg>';
  const ICON_OK = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#FF8A3D"/><path d="m7.5 12.4 3 3 6-6.4" fill="none" stroke="#0E1B3D" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  /* Réglages du jeu (schématiques) */
  const SPEEDUP = 30;           /* 1 s de jeu = 30 s de plasma */
  const GRACE = 2;              /* doigt levé plus de 2 s : le plasma s'éteint */
  const FADE = 2.6, RELIGHT = 0.9;
  const TPUSH = 0.85;           /* durée de la poussée d'une vague (s) */
  const DRIFT = 0.22;           /* un plasma décentré a tendance à s'écarter encore : il faut le recentrer */
  const NP = 84;                /* points par surface */
  const NV = 120;               /* points du contour de la chambre */
  const PALE = '#D3CDE6';
  /* difficulté par palier : [intervalle entre deux vagues (s), force (× marge jusqu'à la paroi)] */
  const STAGES = [[[3.0, 3.6], [0.5, 0.62]], [[2.5, 3.0], [0.58, 0.72]], [[2.2, 2.6], [0.64, 0.8]], [[1.9, 2.3], [0.7, 0.88]]];
  const STEEL = ['#20232F', '#5B6278', '#A3ABC3', '#C9CFE0', '#959DB5', '#6A7189', '#454B60', '#2A2D3B'];
  const BLUE = ['#0A1E48', '#1D4EA6', '#3C82E0', '#7CC9FF', '#A9E4FF', '#5FA6F0', '#2A64C4', '#0E2A62'];

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

  window.RM.games.marathon = function (api) {
    api.style(CSS);
    const stage = api.stage;
    const cv = api.canvas();
    const ctx = cv.ctx;
    const AMB = api.reducedMotion ? 0.3 : 1;
    const PAL = TEXTES.paliers;

    /* ---- éléments DOM : chrono, paliers, étiquettes de WEST, message de palier ---- */
    function el(tag, cls, html, parent) {
      const e = document.createElement(tag);
      e.className = cls;
      e.setAttribute('aria-hidden', 'true');
      e.innerHTML = html;
      (parent || stage).appendChild(e);
      return e;
    }
    const pad = el('div', 'mt-pad', '');
    const clock = el('p', 'mt-clock', '<span class="mt-num">0</span><span class="mt-unit"></span><span class="mt-cap"></span>');
    const numEl = clock.querySelector('.mt-num');
    clock.querySelector('.mt-unit').textContent = TEXTES.unite;
    clock.querySelector('.mt-cap').textContent = TEXTES.chrono;
    const tags = el('div', 'mt-tags', '<span class="mt-tag">' + ICON_THERMO + '<span></span></span><span class="mt-tag">' + ICON_CHAUFFE + '<span></span></span>');
    const tagEls = tags.querySelectorAll('.mt-tag > span');
    tagEls[0].textContent = lib.fr(TEXTES.temperature);
    tagEls[1].textContent = lib.fr(TEXTES.chauffage);
    const track = el('div', 'mt-track', '<div class="mt-rail"><div class="mt-fill"></div></div>');
    const fill = track.querySelector('.mt-fill');
    const notches = [], labs = [];
    PAL.forEach((p, i) => {
      const n = el('span', 'mt-notch', '', track);
      n.style.left = (p.s / PAL[PAL.length - 1].s) * 100 + '%';
      notches.push(n);
      const l = el('span', 'mt-lab' + (i === PAL.length - 1 ? ' is-last' : ''), '', track);
      l.style.left = (p.s / PAL[PAL.length - 1].s) * 100 + '%';
      l.textContent = lib.fr(p.court);
      labs.push(l);
    });
    const toast = el('p', 'mt-toast', '<span class="mt-t1">' + ICON_OK + '<span></span></span><span class="mt-t2"></span>');
    const toastTxt = toast.querySelector('.mt-t1 > span');
    const toastSub = toast.querySelector('.mt-t2');

    /* ---- géométrie ---- */
    const G = {
      w: 1, h: 1, top: 80, R0: 0, cyv: 0, av: 80, kv: 1.35, dv: 0.42, wv: 9, gapC: 5, coilW: 10,
      ap: 40, kp: 1.45, dp: 0.36, Yc: 0, ydiv: 0, XL: 30, XR: 30, C: 30, vw: 60,
    };
    const VX = new Float32Array(NV), VY = new Float32Array(NV), VNX = new Float32Array(NV), VNY = new Float32Array(NV);
    const SX = new Float32Array(NP), SY = new Float32Array(NP);
    let interior = null, bg = null, moteS = null;

    /* contour en D : x = R0 + a·cos(θ + δ·sin θ), y = cy − κ·a·sin θ */
    function dPoint(cx, cy, a, k, d, th) {
      return [cx + a * Math.cos(th + d * Math.sin(th)), cy - k * a * Math.sin(th)];
    }
    function vessel() {
      for (let i = 0; i < NV; i++) {
        const th = (i / NV) * TAU;
        const [x, y] = dPoint(G.R0, G.cyv, G.av, G.kv, G.dv, th);
        const e = 1e-3;
        const [x1, y1] = dPoint(G.R0, G.cyv, G.av, G.kv, G.dv, th + e);
        const [x0, y0] = dPoint(G.R0, G.cyv, G.av, G.kv, G.dv, th - e);
        const tx = x1 - x0, ty = y1 - y0, l = Math.hypot(tx, ty) || 1;
        VX[i] = x; VY[i] = y; VNX[i] = -ty / l; VNY[i] = tx / l;
      }
    }
    function vPath(g, off) {
      g.beginPath();
      for (let i = 0; i < NV; i++) {
        const x = VX[i] + VNX[i] * off, y = VY[i] + VNY[i] * off;
        if (i) g.lineTo(x, y);
        else g.moveTo(x, y);
      }
      g.closePath();
    }
    function inside(x, y) {
      let c = false;
      for (let i = 0, j = NV - 1; i < NV; j = i++) {
        if ((VY[i] > y) !== (VY[j] > y) && x < ((VX[j] - VX[i]) * (y - VY[i])) / (VY[j] - VY[i]) + VX[i]) c = !c;
      }
      return c;
    }
    /* le bord du plasma (sans ses ondulations) tient-il dans la chambre, décalé de X ? */
    function fits(X) {
      for (let i = 0; i < 64; i++) {
        const th = (i / 64) * TAU;
        const [x, y] = dPoint(G.R0 + X, G.Yc, G.ap + 2.5, G.kp, G.dp, th);
        if (!inside(x, y)) return false;
      }
      return true;
    }

    function layout(w, h) {
      G.w = w;
      G.h = h;
      const clockH = clock.offsetHeight || 50;
      const trackTop = 9 + clockH + 7;
      track.style.top = trackTop + 'px';
      G.top = trackTop + 30;
      toast.style.top = (G.top + 8) + 'px';
      pad.style.top = (G.top - 4) + 'px';
      G.padT = G.top - 4;
      const availH = h - G.top - 6;
      G.wv = clamp(Math.min(w, h) * 0.024, 7, 13);
      G.gapC = clamp(Math.min(w, h) * 0.012, 4, 7);
      G.coilW = clamp(Math.min(w, h) * 0.028, 8, 15);
      const ext = G.wv + G.gapC + G.coilW + 3;
      G.av = Math.max(40, Math.min((availH - 2 * ext) / (2 * G.kv), (w - 2 * ext - 70) / 2, 230));
      G.R0 = w / 2 + G.av * 0.08;
      G.cyv = G.top + availH / 2;
      G.ydiv = G.cyv + G.kv * G.av * 0.8;
      G.ap = G.av * 0.56;
      G.Yc = G.cyv - G.av * 0.13;
      G.vw = G.av * 0.95;
      vessel();
      /* jusqu'où le plasma peut glisser de chaque côté avant de toucher la paroi */
      let lo = 0, hi = G.av;
      for (let k = 0; k < 18; k++) { const m = (lo + hi) / 2; if (fits(m)) lo = m; else hi = m; }
      G.XR = lo;
      lo = 0; hi = G.av;
      for (let k = 0; k < 18; k++) { const m = (lo + hi) / 2; if (fits(-m)) lo = m; else hi = m; }
      G.XL = lo;
      G.C = Math.min(G.XL, G.XR);
      interior = new Path2D();
      for (let i = 0; i < NV; i++) {
        if (i) interior.lineTo(VX[i], VY[i]);
        else interior.moveTo(VX[i], VY[i]);
      }
      interior.closePath();
      moteS = mk(16, 16, cv.dpr);
      draw.glow(moteS.g, 8, 8, 8, '#FF8BE4', 0.55);
      draw.glow(moteS.g, 8, 8, 3.2, '#FFFFFF', 0.95);
      bg = makeBg(w, h);
      placeTrack();
      fitLabels();
    }
    /* sur une scène étroite, les repères 1 066 et 1 337 se touchent : on retire l'unité, puis on les décale */
    function fitLabels() {
      const overlap = () => {
        for (let i = 1; i < labs.length; i++) {
          const a = labs[i - 1].getBoundingClientRect(), b = labs[i].getBoundingClientRect();
          if (a.width && a.right + 5 > b.left && a.top === b.top) return true;
        }
        return false;
      };
      labs.forEach((l, i) => {
        l.textContent = lib.fr(PAL[i].court);
        l.classList.remove('is-up');
      });
      if (overlap()) labs.forEach((l, i) => { l.textContent = lib.num(PAL[i].s); });
      if (overlap()) labs.forEach((l, i) => { if (i === 2) l.classList.add('is-up'); });
    }

    /* ---- décor pré-rendu : hall, solénoïde central, bobines bleues, chambre d'acier, diverteur ---- */
    function coilBox(g, x, y, bw, bh, grid) {
      const gr = g.createLinearGradient(x, 0, x + bw, 0);
      gr.addColorStop(0, '#0A2252');
      gr.addColorStop(0.24, '#2563C4');
      gr.addColorStop(0.44, '#7AC8FF');
      gr.addColorStop(0.6, '#3378D8');
      gr.addColorStop(1, '#0A1E48');
      g.fillStyle = 'rgba(0,0,12,0.45)';
      draw.roundRect(g, x + 2, y + 3, bw, bh, Math.min(5, bw * 0.3));
      g.fill();
      g.fillStyle = gr;
      draw.roundRect(g, x, y, bw, bh, Math.min(5, bw * 0.3));
      g.fill();
      g.fillStyle = 'rgba(4,16,44,0.32)';
      for (let yy = y + 2.5; yy < y + bh - 2; yy += 2.6) g.fillRect(x + 1, yy, bw - 2, 0.8);
      if (grid) for (let xx = x + 3; xx < x + bw - 2; xx += 3) g.fillRect(xx, y + 1, 0.8, bh - 2);
      const r = seeded(Math.round(x * 7 + y));
      for (let i = 0; i < (bw + bh) * 0.5; i++) {
        g.fillStyle = `rgba(232,250,255,${0.15 + r() * 0.4})`;
        const s = 0.6 + r() * 0.8;
        const onTop = r() < 0.5;
        g.fillRect(onTop ? x + r() * bw : x + (r() < 0.5 ? r() * 2 : bw - r() * 2), onTop ? y + r() * 2 : y + r() * bh, s, s);
      }
    }
    function makeBg(w, h) {
      const B = mk(w, h, cv.dpr);
      const g = B.g;
      const base = g.createLinearGradient(0, 0, 0, h);
      base.addColorStop(0, '#0B1634');
      base.addColorStop(0.5, '#08112A');
      base.addColorStop(1, '#050B1C');
      g.fillStyle = base;
      g.fillRect(0, 0, w, h);
      const r = seeded(23);
      for (let i = 0; i < Math.round(w * h * 0.01); i++) {
        g.fillStyle = r() < 0.55 ? `rgba(170,190,255,${0.016 + r() * 0.03})` : `rgba(0,0,0,${0.06 + r() * 0.1})`;
        const s = 0.6 + r() * 1.3;
        g.fillRect(r() * w, r() * h, s, s);
      }
      draw.glow(g, G.R0, G.cyv, G.av * 2.2, '#1B2C66', 0.55);
      draw.glow(g, G.R0, G.Yc, G.av * 1.2, '#4A2A8C', 0.18);
      /* bandeau du chrono */
      const tg = g.createLinearGradient(0, 0, 0, G.top);
      tg.addColorStop(0, 'rgba(3,7,20,0.55)');
      tg.addColorStop(1, 'rgba(3,7,20,0)');
      g.fillStyle = tg;
      g.fillRect(0, 0, w, G.top);

      const ext = G.wv + G.gapC;
      /* solénoïde central, à gauche (l'axe de l'anneau) */
      const sx1 = G.R0 - G.av - ext - G.coilW - 10;
      const sw = clamp(G.av * 0.18, 10, 22);
      if (sx1 - sw > 4) {
        const top = G.cyv - G.kv * G.av * 0.92, bot = G.cyv + G.kv * G.av * 0.92;
        coilBox(g, sx1 - sw, top, sw, bot - top, false);
      }
      /* grande bobine en D qui entoure la chambre */
      const nB = BLUE.length, bw = G.coilW / nB;
      g.save();
      g.lineJoin = 'round';
      g.translate(2, 4);
      vPath(g, ext + G.coilW / 2);
      g.strokeStyle = 'rgba(0,0,12,0.45)';
      g.lineWidth = G.coilW + 2;
      g.stroke();
      g.restore();
      for (let k = 0; k < nB; k++) {
        vPath(g, ext + (k + 0.5) * bw);
        g.strokeStyle = BLUE[k];
        g.lineWidth = bw + 0.7;
        g.stroke();
      }
      g.strokeStyle = 'rgba(4,16,44,0.35)';
      g.lineWidth = 0.8;
      g.beginPath();
      for (let i = 0; i < NV; i += 1) {
        const a = ext + 1, b = ext + G.coilW - 1;
        g.moveTo(VX[i] + VNX[i] * a, VY[i] + VNY[i] * a);
        g.lineTo(VX[i] + VNX[i] * b, VY[i] + VNY[i] * b);
      }
      g.stroke();
      for (let i = 0; i < NV * 1.6; i++) {
        const k = Math.floor(r() * NV);
        const off = ext + G.coilW - r() * 2.2;
        g.fillStyle = `rgba(232,250,255,${0.15 + r() * 0.4})`;
        g.fillRect(VX[k] + VNX[k] * off, VY[k] + VNY[k] * off, 0.9, 0.9);
      }
      /* bobines de forme (vues en coupe : des paquets de conducteurs) */
      const o = ext + G.coilW + 7;
      const pf = [[0.32, 1.25, 1], [0.95, 0.62, 0.8], [0.95, -0.55, 0.8], [0.3, -1.22, 1]];
      pf.forEach(([fx, fy, s]) => {
        const bw2 = G.coilW * 2.1 * s, bh2 = G.coilW * 1.55 * s;
        const x = G.R0 + fx * G.av + (fx > 0.6 ? o * 0.55 : 0);
        const y = G.cyv - fy * G.av * G.kv * 0.82 + (fy > 0 ? -o * 0.45 : o * 0.45);
        coilBox(g, x - bw2 / 2, y - bh2 / 2, bw2, bh2, true);
      });
      /* chambre d'acier */
      g.save();
      g.translate(2, 5);
      vPath(g, G.wv / 2);
      g.strokeStyle = 'rgba(0,0,12,0.42)';
      g.lineWidth = G.wv + 4;
      g.stroke();
      g.restore();
      vPath(g, 0);
      g.fillStyle = '#0B1230';
      g.fill();
      const nS = STEEL.length, sb = G.wv / nS;
      for (let k = 0; k < nS; k++) {
        vPath(g, (k + 0.5) * sb);
        g.strokeStyle = STEEL[k];
        g.lineWidth = sb + 0.7;
        g.stroke();
      }
      g.save();
      g.clip(interior);
      /* carreaux de la première paroi */
      g.strokeStyle = 'rgba(160,180,255,0.07)';
      g.lineWidth = 1;
      for (let i = 0; i < NV; i += 3) {
        g.beginPath();
        g.moveTo(VX[i], VY[i]);
        g.lineTo(VX[i] - VNX[i] * 9, VY[i] - VNY[i] * 9);
        g.stroke();
      }
      vPath(g, -9);
      g.stroke();
      const ig = g.createRadialGradient(G.R0, G.Yc, G.ap * 0.4, G.R0, G.Yc, G.av * 1.5);
      ig.addColorStop(0, 'rgba(120,70,220,0.16)');
      ig.addColorStop(1, 'rgba(0,0,0,0.25)');
      g.fillStyle = ig;
      g.fillRect(0, 0, w, h);
      /* le diverteur : une bande sombre de tuiles, en bas */
      const dg = g.createLinearGradient(0, G.ydiv, 0, G.cyv + G.kv * G.av);
      dg.addColorStop(0, '#2A3148');
      dg.addColorStop(0.12, '#141A2C');
      dg.addColorStop(1, '#0B0F1C');
      g.fillStyle = dg;
      g.fillRect(0, G.ydiv, w, h - G.ydiv);
      g.fillStyle = 'rgba(200,215,255,0.35)';
      g.fillRect(0, G.ydiv, w, 1);
      g.fillStyle = 'rgba(0,0,0,0.45)';
      for (let x = G.R0 - G.av * 1.2; x < G.R0 + G.av * 1.2; x += 7) g.fillRect(x, G.ydiv + 1, 1, h);
      for (let y = G.ydiv + 6; y < h; y += 6) g.fillRect(0, y, w, 0.8);
      g.restore();
      /* repères du centre */
      g.fillStyle = 'rgba(200,225,255,0.12)';
      for (let y = G.Yc - G.kp * G.ap - 6; y < G.ydiv - 4; y += 9) g.fillRect(G.R0 - 0.5, y, 1, 4);
      /* l'antenne de chauffage, sur la paroi de droite */
      const ax = G.R0 + G.av - 3, ay = G.Yc;
      g.fillStyle = '#3A4157';
      draw.roundRect(g, ax - 7, ay - G.av * 0.2, 9, G.av * 0.4, 2.5);
      g.fill();
      g.fillStyle = '#12182A';
      for (let k = -2; k <= 2; k++) g.fillRect(ax - 5, ay + k * G.av * 0.07 - 1.2, 6, 2.4);
      /* vignette */
      const vg = g.createRadialGradient(w / 2, h * 0.55, Math.min(w, h) * 0.38, w / 2, h * 0.55, Math.hypot(w, h) * 0.62);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,3,12,0.42)');
      g.fillStyle = vg;
      g.fillRect(0, 0, w, h);
      return B;
    }

    /* ---- état ---- */
    let state = 'idle';     /* 'idle' | 'run' | 'fade' | 'off' | 'relight' | 'fin' */
    let X = 0, vPoke = 0, pokeT = -1, pokeDir = 0;
    let plasmaS = 0, fadeFrom = 0, lastPalier = 0, reached = -1;
    let life = 1, paleK = 0, hv = 0.6, offT = 0, sT = 0, nextWave = 1.6, lastDir = 0, sameDir = 0;
    let push = 0, pushDir = 1, won = false, coupeShown = false, toastT = -1, tagsOn = false;
    let time = 0;
    const active = new Set();
    const contact = { t: -1, x: 0, y: 0 };
    const pool = (n, make) => Array.from({ length: n }, make);
    const WAVES = pool(4, () => ({ on: false, dir: 1, x: 0, warn: 0, S: 0, hit: false, pt: -1 }));
    const MOTES = pool(36, () => ({ rho: 0.5, th: 0, w: 1, size: 1, a: 1 }));
    const WISPS = pool(22, (_, i) => ({
      rho: i < 5 ? rand(1.02, 1.14) : rand(0.3, 0.98), th: rand(TAU), span: rand(0.7, 1.7),
      w: rand(0.35, 0.8), wid: rand(0.9, 1.7), a: rand(0.22, 0.45), ph: rand(TAU),
    }));
    const RIPPLES = pool(6, () => ({ on: false, x: 0, y: 0, t: 0 }));
    const HEAT = pool(18, () => ({ on: false, x: 0, y: 0, vx: 0, t: 0, life: 1 }));
    function take(arr) {
      for (let i = 0; i < arr.length; i++) if (!arr[i].on) return arr[i];
      return null;
    }
    MOTES.forEach((m) => {
      m.rho = rand(0.22, 1);
      m.th = rand(TAU);
      m.w = rand(0.45, 1) * (m.rho < 0.5 ? 1.3 : 1);
      m.size = rand(0.45, 1.0);
      m.a = rand(0.45, 1);
    });

    function stageIdx() {
      for (let i = 0; i < PAL.length; i++) if (plasmaS < PAL[i].s) return i;
      return PAL.length - 1;
    }
    function palLabel(v) {
      for (let i = 0; i < PAL.length; i++) if (PAL[i].s === v) return PAL[i].court;
      return '0 ' + TEXTES.unite;
    }
    function nextStatus() {
      const i = reached + 1;
      if (i < PAL.length) api.status(TEXTES.prochain(PAL[i].long));
    }
    function placeTrack() {
      fill.style.setProperty('--p', clamp(plasmaS / PAL[PAL.length - 1].s).toFixed(4));
    }
    /* le message d'un palier, sur deux lignes : le chiffre, puis la machine et la date */
    function showToast(txt) {
      const t = lib.fr(txt);
      let i = t.indexOf(' ('), a = t, b = '';
      if (i > 0) { a = t.slice(0, i); b = t.slice(i + 1); }
      else if ((i = t.indexOf('\u00A0: ')) > 0) { a = t.slice(0, i + 2); b = t.slice(i + 3); }
      toastTxt.textContent = a;
      toastSub.textContent = b;
      toast.classList.add('is-on');
      toastT = 0;
    }
    function setTags(on) {
      if (on === tagsOn) return;
      tagsOn = on;
      tags.classList.toggle('is-on', on);
    }
    let shownNum = '';
    function setClock() {
      const n = lib.num(Math.floor(plasmaS));
      if (n !== shownNum) {
        numEl.textContent = n;
        shownNum = n;
      }
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
    function heatOn() {
      offT = 0;
      if (coupeShown) {
        coupeShown = false;
        if (won) api.status(TEXTES.finStatut);
        else nextStatus();
      }
    }
    api.track(pad, {
      down(p) {
        active.add(p.id);
        const x = p.x, y = p.y + G.padT;
        ripple(x, y);
        api.buzz(8);
        heatOn();
        if (state === 'idle') {
          state = 'run';
          nextWave = 1.4;
          api.sfx.play('bubble', { pitch: 0.7 });
        } else if (state === 'off') {
          state = 'relight';
          sT = 0;
          X = 0;
          WAVES.forEach((wv) => { wv.on = false; });
          api.sfx.play('whoosh', { pitch: 1.2, volume: 0.6 });
          if (!won) api.hint(TEXTES.consigne);
        } else {
          api.sfx.play('tick', { pitch: 0.9, volume: 0.5 });
        }
      },
      move(p) {
        if (!active.has(p.id)) return;
        if (state === 'run' || state === 'relight' || state === 'fin' || state === 'idle') {
          X = clamp(X + p.dx, -G.XL * 0.92, G.XR * 0.92);
        }
      },
      up(p, e) {
        active.delete(p.id);
        if (p.tap && (state === 'run' || state === 'fin')) {
          heatOn();
          hv = 1;
          /* tape à côté du plasma : il est poussé de l'autre côté ; tape dessus : il chauffe, c'est tout */
          if (Math.abs(p.x - (G.R0 + X)) > G.ap * 0.5) {
            pokeDir = p.x < G.R0 + X ? 1 : -1;
            pokeT = 0;
            api.sfx.play('pop', { pitch: rand(0.9, 1.1), volume: 0.7 });
          }
        }
      },
    }, { touchAction: 'none' });

    /* ---- la partie ---- */
    function spawnWave() {
      const wv = take(WAVES);
      if (!wv) return;
      const [, [s0, s1]] = STAGES[stageIdx()];
      let dir = Math.random() < 0.5 ? 1 : -1;
      /* une vague vient plus souvent du côté qui écarte encore le plasma du centre */
      if (Math.abs(X) > 0.15 * G.C && Math.random() < 0.6) dir = X > 0 ? 1 : -1;
      if (dir === lastDir && sameDir >= 2) dir = -dir;
      sameDir = dir === lastDir ? sameDir + 1 : 0;
      lastDir = dir;
      wv.on = true;
      wv.dir = dir;
      wv.warn = 0.65;
      wv.x = dir > 0 ? G.R0 - G.av : G.R0 + G.av;
      wv.S = rand(s0, s1) * G.C;
      wv.hit = false;
      wv.pt = -1;
      api.sfx.play('wind', { pitch: 0.75, volume: 0.45, gap: 300 });
    }
    function extinguish(why) {
      if (why === 'paroi') {
        contact.t = 0;
        contact.x = X > 0 ? G.R0 + G.av - 2 : G.R0 - G.av + 2;
        contact.y = G.Yc;
      }
      state = 'fade';
      sT = 0;
      fadeFrom = plasmaS;
      coupeShown = false;
      api.status(why === 'paroi' ? TEXTES.eteintParoi : TEXTES.eteintDoigt);
      api.sfx.play('wind', { pitch: 0.55, volume: 0.7, gap: 0 });
      if (why === 'paroi') api.buzz(12);
    }
    function reach(i) {
      reached = i;
      lastPalier = PAL[i].s;
      notches[i].classList.add('is-hit');
      labs[i].classList.add('is-hit');
      showToast(PAL[i].long);
      api.sfx.play('chime', { pitch: 1 + i * 0.1 });
      if (PAL[i].s === 1337 && !won) {
        won = true;
        api.done(TEXTES.fin, TEXTES.finStatut);
        api.guide(null, 'laugh', TEXTES.bravo);
      } else if (i === PAL.length - 1) {
        state = 'fin';
        plasmaS = PAL[i].s;
        WAVES.forEach((wv) => { wv.on = false; });
        api.status(TEXTES.bonus);
        lib.celebrate(stage, ['#FF8A3D', '#FF6FD8', '#7FD8FF', '#FFFFFF']);
        api.sfx.play('success', { gap: 0 });
      } else {
        nextStatus();
      }
    }

    function update(dt) {
      time += dt;
      const pressed = active.size > 0;
      /* chauffage : allumé tant qu'un doigt appuie */
      if (pressed) {
        hv = Math.min(1, hv + dt * 4);
        offT = 0;
      } else if (state === 'run') {
        offT += dt;
        hv = Math.max(0, 1 - offT / GRACE) * 0.9;
        if (offT > 1.05 && !coupeShown) {
          coupeShown = true;
          api.status(TEXTES.coupe);
        }
        if (offT > GRACE) extinguish('doigt');
      } else if (state === 'fin') {
        hv = Math.max(0.55, hv - dt * 0.5);
      } else if (state === 'idle') {
        hv = 0.6;
      }

      let vWave = 0;
      for (let i = 0; i < WAVES.length; i++) {
        const wv = WAVES[i];
        if (!wv.on) continue;
        if (wv.warn > 0) {
          wv.warn -= dt;
          continue;
        }
        wv.x += wv.dir * G.vw * dt;
        const edge = G.R0 + X - wv.dir * G.ap;
        if (!wv.hit && (wv.dir > 0 ? wv.x >= edge : wv.x <= edge) && (state === 'run' || state === 'relight')) {
          wv.hit = true;
          wv.pt = 0;
          pushDir = wv.dir;
          api.sfx.play('thud', { pitch: 1.4, volume: 0.25, gap: 200 });
        }
        if (wv.pt >= 0 && wv.pt < TPUSH) {
          vWave += wv.dir * wv.S * (Math.PI / (2 * TPUSH)) * Math.sin((Math.PI * wv.pt) / TPUSH);
          wv.pt += dt;
        }
        if ((wv.dir > 0 && wv.x > G.R0 + G.av * 1.05) || (wv.dir < 0 && wv.x < G.R0 - G.av * 1.05)) wv.on = false;
      }
      push = lerp(push, Math.min(1, Math.abs(vWave) / (G.C * 1.2)), 1 - Math.exp(-dt * 8));
      if (pokeT >= 0) {
        const P = G.C * 0.36, TP = 0.32;
        vPoke = pokeDir * P * (Math.PI / (2 * TP)) * Math.sin((Math.PI * pokeT) / TP);
        pokeT += dt;
        if (pokeT >= TP) { pokeT = -1; vPoke = 0; }
      }

      if (state === 'run' || state === 'fin') {
        const jitter = Math.sin(time * 1.3) * 1.5 + Math.sin(time * 2.9 + 1) * 1;
        X += (vWave + vPoke + (state === 'run' ? DRIFT * X : 0) + jitter * AMB) * dt;
        if (state === 'run') {
          if (X >= G.XR) { X = G.XR; extinguish('paroi'); }
          else if (X <= -G.XL) { X = -G.XL; extinguish('paroi'); }
        } else {
          X = clamp(X, -G.XL * 0.9, G.XR * 0.9);
        }
        if (state === 'run') {
          plasmaS += dt * SPEEDUP;
          for (let i = reached + 1; i < PAL.length; i++) if (plasmaS >= PAL[i].s) reach(i);
          nextWave -= dt;
          if (nextWave <= 0 && state === 'run') {
            spawnWave();
            const [[i0, i1]] = STAGES[stageIdx()];
            nextWave = rand(i0, i1);
          }
        }
        life = 1;
        paleK = 0;
      } else if (state === 'fade') {
        sT += dt;
        const k = clamp(sT / FADE);
        life = 1 - ease.inOutSine(k);
        paleK = clamp(k * 1.7);
        hv = Math.max(0, hv - dt);
        plasmaS = lerp(fadeFrom, lastPalier, ease.inOutSine(k));
        if (k >= 1) {
          state = 'off';
          plasmaS = lastPalier;
          WAVES.forEach((wv) => { wv.on = false; });
          const t = TEXTES.rallume(palLabel(lastPalier));
          if (won) api.status(t);
          else api.hint(t);
          api.gesture('hold', { x: (G.R0 / G.w) * 100, y: (G.Yc / G.h) * 100 });
        }
      } else if (state === 'off') {
        life = 0;
      } else if (state === 'relight') {
        sT += dt;
        const k = clamp(sT / RELIGHT);
        life = ease.outCubic(k);
        paleK = 0;
        if (k >= 1) {
          state = 'run';
          nextWave = 1.6;
          if (won) api.status(TEXTES.finStatut);
          else nextStatus();
        }
      }

      const st = plasmaS;
      setTags(st >= 1066 && st <= 1337 + 45 && state !== 'off');
      if (toastT >= 0) {
        toastT += dt;
        if (toastT > 2.8) {
          toast.classList.remove('is-on');
          toastT = -1;
        }
      }
      const pg = won ? 1 : clamp(plasmaS / 1337);
      const q = Math.round(pg * 200) / 200;
      if (q !== update.pg) {
        update.pg = q;
        if (!won) api.progress(q);
      }
      placeTrack();
      setClock();

      const spin = dt * (0.4 + 0.6 * AMB) * (0.25 + 0.75 * life) * (0.6 + 0.4 * hv);
      for (let i = 0; i < MOTES.length; i++) MOTES[i].th += MOTES[i].w * spin;
      for (let i = 0; i < WISPS.length; i++) WISPS[i].th += WISPS[i].w * spin;
      for (let i = 0; i < RIPPLES.length; i++) {
        const r = RIPPLES[i];
        if (r.on && (r.t += dt) >= 0.6) r.on = false;
      }
      if (contact.t >= 0 && (contact.t += dt) > 2.2) contact.t = -1;
      if (hv > 0.5 && life > 0.5 && Math.random() < dt * 14 * hv) {
        const hp = take(HEAT);
        if (hp) {
          hp.on = true;
          hp.x = G.R0 + G.av - 8;
          hp.y = G.Yc + rand(-G.av * 0.16, G.av * 0.16);
          hp.vx = -rand(40, 70);
          hp.t = 0;
          hp.life = rand(0.5, 0.8);
        }
      }
      for (let i = 0; i < HEAT.length; i++) {
        const hp = HEAT[i];
        if (!hp.on) continue;
        hp.t += dt;
        hp.x += hp.vx * dt;
        if (hp.t >= hp.life || hp.x < G.R0 + X + G.ap * 0.85) hp.on = false;
      }
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

    /* point d'une surface magnétique : rho = 1 au bord du plasma, plus petit vers le cœur */
    const DP = { x: 0, y: 0 };
    function dXY(rho, th, scale) {
      const r = rho * scale;
      const a = G.ap * r;
      const kap = lerp(1.15, G.kp, Math.min(1, rho));
      const del = G.dp * Math.min(1, rho);
      const sh = G.ap * 0.1 * (1 - Math.min(1, rho) * Math.min(1, rho));
      DP.x = G.R0 + X + sh + a * Math.cos(th + del * Math.sin(th));
      DP.y = G.Yc - kap * a * Math.sin(th);
    }
    /* le bord du plasma, qui ondule et s'écrase un peu du côté où une vague le pousse */
    function computeEdge(scale) {
      const tt = time * AMB;
      const agit = 1 + 2.2 * push;
      const imp = pushDir > 0 ? Math.PI : 0;
      const a = G.ap * scale;
      for (let i = 0; i < NP; i++) {
        const th = (i / NP) * TAU;
        let wob = (0.022 * Math.sin(3 * th + tt * 0.9) + 0.014 * Math.sin(5 * th - tt * 1.4 + 1)) * agit;
        const c = Math.cos(th - imp);
        if (c > 0) wob -= 0.08 * push * c * c * c * c;
        SX[i] = G.R0 + X + a * (1 + wob) * Math.cos(th + G.dp * Math.sin(th));
        SY[i] = G.Yc - G.kp * a * (1 + wob) * Math.sin(th);
      }
    }
    function edgePath() {
      ctx.beginPath();
      ctx.moveTo(SX[0], SY[0]);
      for (let i = 1; i < NP; i++) ctx.lineTo(SX[i], SY[i]);
      ctx.closePath();
    }

    function drawPlasma() {
      if (life <= 0.002) return;
      const scale = state === 'relight' ? lerp(0.3, 1, life) : state === 'fade' ? lerp(0.86, 1, life) : 1;
      computeEdge(scale);
      const B = life * (0.55 + 0.45 * hv);
      const cx = G.R0 + X;
      ctx.globalCompositeOperation = 'lighter';
      glowP(cx, G.Yc, G.ap * 1.9 * scale, '#7A3BE0', 0.24 * B);
      /* les deux « jambes » du plasma qui descendent vers le diverteur */
      const bi = Math.round(NP * 0.75), bx = SX[bi], by = SY[bi];
      const lx = bx - G.ap * 0.42, rx = bx + G.ap * 0.5, ly = G.ydiv + 1;
      for (let pass = 0; pass < 2; pass++) {
        ctx.lineWidth = pass ? 1.6 : 6;
        ctx.strokeStyle = pcol(pass ? '#FFD3F4' : '#E05BE8', (pass ? 0.55 : 0.16) * B);
        ctx.beginPath();
        ctx.moveTo(bx, by - 2);
        ctx.quadraticCurveTo(bx - G.ap * 0.12, by + (ly - by) * 0.55, lx, ly);
        ctx.moveTo(bx, by - 2);
        ctx.quadraticCurveTo(bx + G.ap * 0.16, by + (ly - by) * 0.55, rx, ly);
        ctx.stroke();
      }
      glowP(lx, ly, 13, '#FF9B6B', 0.5 * B);
      glowP(rx, ly, 13, '#FF9B6B', 0.5 * B);
      /* corps lumineux : de plus en plus chaud vers le cœur */
      ctx.save();
      edgePath();
      ctx.clip();
      ctx.translate(cx + G.ap * 0.07 * scale, G.Yc);
      ctx.scale(1, G.kp);
      const R = G.ap * 1.04 * scale;
      const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
      gr.addColorStop(0, pcol('#FFF6FD', 0.95 * B));
      gr.addColorStop(0.2, pcol('#FFB8EE', 0.78 * B));
      gr.addColorStop(0.5, pcol('#FF6FD8', 0.6 * B));
      gr.addColorStop(0.8, pcol('#C64DEE', 0.42 * B));
      gr.addColorStop(1, pcol('#8A3CE8', 0.3 * B));
      ctx.fillStyle = gr;
      ctx.fillRect(-R * 1.6, -R * 1.2, R * 3.2, R * 2.4);
      ctx.restore();
      /* liseré doux du bord, en forme de D */
      edgePath();
      ctx.lineJoin = 'round';
      ctx.strokeStyle = pcol('#B44CF0', 0.1 * B);
      ctx.lineWidth = 12;
      ctx.stroke();
      ctx.strokeStyle = pcol('#FF7FDC', 0.16 * B);
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.strokeStyle = pcol('#FFD6F5', 0.26 * B);
      ctx.lineWidth = 1.4;
      ctx.stroke();
      /* filaments : des mèches lumineuses qui tournent le long des lignes de champ,
         certaines s'échappent un peu du bord */
      ctx.lineCap = 'round';
      for (let i = 0; i < WISPS.length; i++) {
        const wp = WISPS[i];
        const n = 12;
        dXY(wp.rho, wp.th, scale);
        const x0 = DP.x, y0 = DP.y;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        for (let m = 1; m <= n; m++) {
          const t = m / n;
          const rr = wp.rho * (1 + 0.05 * Math.sin(t * TAU + time * 1.7 * AMB + wp.ph));
          dXY(rr, wp.th + wp.span * t, scale);
          ctx.lineTo(DP.x, DP.y);
        }
        const g = ctx.createLinearGradient(x0, y0, DP.x, DP.y);
        g.addColorStop(0, pcol('#FFE6F9', 0));
        g.addColorStop(0.5, pcol('#FFE6F9', wp.a * B));
        g.addColorStop(1, pcol('#FFE6F9', 0));
        ctx.strokeStyle = g;
        ctx.lineWidth = wp.wid;
        ctx.stroke();
      }
      /* grains lumineux qui tournent avec le plasma */
      const MS = moteS.w;
      for (let i = 0; i < MOTES.length; i++) {
        const m = MOTES[i];
        dXY(m.rho, m.th, scale);
        const al = m.a * B * (0.7 + 0.3 * Math.sin(time * 4 + i));
        if (al < 0.02) continue;
        const sz = MS * m.size;
        ctx.globalAlpha = Math.min(1, al);
        ctx.drawImage(moteS.c, DP.x - sz / 2, DP.y - sz / 2, sz, sz);
      }
      ctx.globalAlpha = 1;
      glowP(cx + G.ap * 0.08, G.Yc, G.ap * 0.4 * scale, '#FFFFFF', (0.16 + 0.12 * hv) * B);
      ctx.globalCompositeOperation = 'source-over';
    }

    /* la paroi rosit du côté où le plasma s'approche */
    function drawWarn() {
      if (life < 0.05) return;
      ctx.globalCompositeOperation = 'lighter';
      const kR = smooth(0.45, 1, X / G.XR), kL = smooth(0.45, 1, -X / G.XL);
      const pulse = 0.8 + 0.2 * Math.sin(time * 8);
      if (kR > 0) glowP(G.R0 + G.av, G.Yc, G.av * 0.55, '#FF77D6', 0.5 * kR * pulse * life);
      if (kL > 0) glowP(G.R0 - G.av, G.Yc, G.av * 0.55, '#FF77D6', 0.5 * kL * pulse * life);
      ctx.globalCompositeOperation = 'source-over';
    }

    function drawWaves() {
      ctx.save();
      ctx.clip(interior);
      ctx.globalCompositeOperation = 'lighter';
      const H = G.kv * G.av;
      for (let i = 0; i < WAVES.length; i++) {
        const wv = WAVES[i];
        if (!wv.on) continue;
        if (wv.warn > 0) {
          /* la paroi s'éclaire : une vague arrive de ce côté */
          const k = 1 - wv.warn / 0.65;
          const wx = wv.dir > 0 ? G.R0 - G.av : G.R0 + G.av;
          glowP(wx, G.Yc, G.av * 0.55, '#FFB36B', 0.5 * Math.sin(Math.PI * Math.min(1, k * 1.2)) + 0.08);
          continue;
        }
        const travel = Math.abs(wv.x - (wv.dir > 0 ? G.R0 - G.av : G.R0 + G.av)) / (2 * G.av);
        /* en frappant le plasma, la vague lui donne son élan et s'efface */
        const spent = wv.pt >= 0 ? 1 - 0.75 * smooth(0, 0.45, wv.pt) : 1;
        const fade = (1 - smooth(0.68, 1.02, travel)) * smooth(0, 0.06, travel) * spent;
        for (let e = 0; e < 3; e++) {
          const xo = wv.x - wv.dir * e * 12;
          const a = (e === 0 ? 0.6 : e === 1 ? 0.3 : 0.15) * fade;
          for (let pass = 0; pass < 3; pass++) {
            if (e > 0 && pass === 0) continue;
            ctx.beginPath();
            for (let m = 0; m <= 26; m++) {
              const y = G.cyv - H + (2 * H * m) / 26;
              const q = (y - G.Yc) / H;
              const x = xo - wv.dir * 22 * q * q + Math.sin(y * 0.08 + time * 8 * AMB + e) * 2.5;
              if (m) ctx.lineTo(x, y);
              else ctx.moveTo(x, y);
            }
            ctx.strokeStyle = rgba(pass === 2 ? '#FFE6CC' : '#FF9E52', pass === 2 ? a : pass === 1 ? a * 0.4 : a * 0.16);
            ctx.lineWidth = pass === 2 ? 1.8 : pass === 1 ? 6 : 18;
            ctx.stroke();
          }
        }
        /* chevrons : la vague pousse dans ce sens */
        ctx.strokeStyle = rgba('#FFE6CC', 0.7 * fade);
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (let c = -2; c <= 2; c++) {
          const y = G.Yc + c * H * 0.32;
          const q = (y - G.Yc) / H;
          const x = wv.x - wv.dir * 22 * q * q + wv.dir * 9;
          ctx.beginPath();
          ctx.moveTo(x - wv.dir * 6, y - 6);
          ctx.lineTo(x, y);
          ctx.lineTo(x - wv.dir * 6, y + 6);
          ctx.stroke();
        }
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
    }

    function drawHeating() {
      const ax = G.R0 + G.av - 4, ay = G.Yc;
      const k = hv * life;
      ctx.globalCompositeOperation = 'lighter';
      glowP(ax, ay, G.av * 0.32, '#FF8A3D', 0.15 + 0.45 * k);
      if (k > 0.05) {
        const tip = G.R0 + X + G.ap * 0.9;
        const gr = ctx.createLinearGradient(ax, 0, tip, 0);
        gr.addColorStop(0, rgba('#FFB070', 0.22 * k));
        gr.addColorStop(1, rgba('#FFB070', 0));
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.moveTo(ax, ay - G.av * 0.17);
        ctx.lineTo(tip, ay - G.av * 0.3);
        ctx.lineTo(tip, ay + G.av * 0.3);
        ctx.lineTo(ax, ay + G.av * 0.17);
        ctx.closePath();
        ctx.fill();
      }
      for (let i = 0; i < HEAT.length; i++) {
        const hp = HEAT[i];
        if (!hp.on) continue;
        const a = (1 - hp.t / hp.life) * k;
        ctx.fillStyle = rgba('#FFC48F', 0.85 * a);
        ctx.fillRect(hp.x - 1.2, hp.y - 1.2, 2.4, 2.4);
      }
      /* repère du centre : il s'allume quand le plasma est bien centré */
      const cK = 1 - smooth(0.12, 0.35, Math.abs(X) / G.C);
      const ty = G.Yc - G.kp * G.ap - 14, by2 = G.ydiv - 8;
      [ty, by2].forEach((y, j) => {
        const d = j ? 1 : -1;
        ctx.fillStyle = rgba('#9FE3FF', 0.25 + 0.6 * cK * life);
        ctx.beginPath();
        ctx.moveTo(G.R0 - 6, y + d * 5);
        ctx.lineTo(G.R0 + 6, y + d * 5);
        ctx.lineTo(G.R0, y - d * 3);
        ctx.closePath();
        ctx.fill();
      });
      ctx.globalCompositeOperation = 'source-over';
    }

    function drawEffects() {
      if (contact.t >= 0) {
        const k = contact.t / 2.2;
        const a = Math.sin(Math.PI * Math.min(1, k * 1.25)) * (1 - k);
        ctx.globalCompositeOperation = 'lighter';
        glowP(contact.x, contact.y, G.av * 0.4, '#F2E9FF', 0.6 * a);
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.lineWidth = 2;
      for (let i = 0; i < RIPPLES.length; i++) {
        const r = RIPPLES[i];
        if (!r.on) continue;
        const k = r.t / 0.6;
        ctx.strokeStyle = rgba('#FFE7D2', 0.7 * (1 - k));
        ctx.beginPath();
        ctx.arc(r.x, r.y, lerp(5, 30, ease.outCubic(k)), 0, TAU);
        ctx.stroke();
      }
    }

    function render() {
      const { w, h } = cv;
      if (!bg) return;
      ctx.drawImage(bg.c, 0, 0, w, h);
      drawHeating();
      drawPlasma();
      drawWarn();
      drawWaves();
      drawEffects();
    }

    function init() {
      state = 'idle';
      X = 0;
      vPoke = 0;
      pokeT = -1;
      plasmaS = 0;
      fadeFrom = 0;
      lastPalier = 0;
      reached = -1;
      life = 1;
      paleK = 0;
      hv = 0.6;
      offT = 0;
      sT = 0;
      nextWave = 1.6;
      lastDir = 0;
      sameDir = 0;
      push = 0;
      won = false;
      coupeShown = false;
      active.clear();
      [WAVES, RIPPLES, HEAT].forEach((arr) => arr.forEach((o) => { o.on = false; }));
      notches.forEach((n) => n.classList.remove('is-hit'));
      labs.forEach((l) => l.classList.remove('is-hit'));
      toast.classList.remove('is-on');
      toastT = -1;
      contact.t = -1;
      setTags(false);
      update.pg = -1;
      api.hint(TEXTES.consigne);
      nextStatus();
      api.progress(0);
      placeTrack();
      setClock();
      api.gesture('rub', { x: ((G.R0 || cv.w / 2) / (G.w || 1)) * 100, y: ((G.Yc || cv.h / 2) / (G.h || 1)) * 100 });
    }

    if (/[?&]debug\b/.test(location.search)) {
      api.root.__dbg = () => ({
        state, X, plasmaS, reached, lastPalier, won, hv, offT, life,
        XL: G.XL, XR: G.XR, C: G.C, R0: G.R0, Yc: G.Yc, ap: G.ap, av: G.av, top: G.top, w: G.w, h: G.h,
        waves: WAVES.filter((wv) => wv.on).map((wv) => ({ dir: wv.dir, x: wv.x, warn: wv.warn, hit: wv.hit, pt: wv.pt })),
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
