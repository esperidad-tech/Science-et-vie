/* Colle les noyaux : on lance un noyau de deutérium sur un noyau de tritium. Les deux noyaux se
   repoussent (le halo autour du tritium) : trop lent, le deutérium rebondit ; assez rapide, donc
   assez chaud, il passe et les deux noyaux fusionnent en un noyau d'hélium et un neutron. */
(function () {
  'use strict';
  const { lib } = window.RM;
  const { TAU, rand, clamp, lerp, ease, rgba, draw } = lib;

  /* Tous les textes du jeu, faciles à corriger */
  const TEXTES = {
    consigne: 'Lance le noyau de deutérium vers le tritium, très vite, pour qu’ils se collent.',
    lent: 'Trop lent : les noyaux se repoussent ! Lance plus vite.',
    presque: 'Presque ! Les noyaux se repoussent encore. Un peu plus vite !',
    astuce: 'Astuce : garde le doigt appuyé sur le deutérium, puis lâche.',
    charge: 'Ça chauffe ! Lâche quand l’aiguille dépasse « assez chaud ».',
    rate: 'Raté ! Vise le tritium, au milieu.',
    haut: 'Lance le deutérium, en bas, vers le tritium.',
    vers: 'Lance-le vers le tritium, en haut !',
    un: 'Ils se collent ! Voilà un noyau d’hélium et un neutron.',
    bouge: 'Bravo ! Attention : le tritium bouge de plus en plus vite.',
    vise: 'Vise bien : il bouge encore plus vite !',
    statut: (n) => `Fusions : ${n} sur 5`,
    legende: 'deutérium + tritium → hélium + 1 neutron',
    vitesse: 'vitesse',
    assezChaud: 'assez chaud',
    energie: 'énergie',
    fin: 'À poids égal : près de 4 millions de fois plus d’énergie que le charbon ou le pétrole !',
    finStatut: '33 mg de deutérium dans 1 litre d’eau de mer',
    bravo: '{bravo}',
  };

  const GOAL = 5;              /* fusions à réussir */
  const S_HOT = 0.5;           /* repère « assez chaud » sur le compteur (0 à 1) */
  const CHARGE_T = 1.0;        /* appui long : secondes pour charger à fond */
  /* le tritium s'agite après chaque fusion : amplitude (× largeur) et vitesse */
  const LEVELS = [[0, 0], [0.1, 0.55], [0.15, 0.8], [0.2, 1.05], [0.24, 1.3]];
  const PROTON = '#FF5D7A', NEUTRON = '#B9C3D6';

  const CSS = `
.game[data-game="noyaux"] .ny-zone {
  position: absolute; left: 0; right: 0; bottom: 0; top: 60%; z-index: 2;
  -webkit-tap-highlight-color: transparent; -webkit-touch-callout: none;
}
.game[data-game="noyaux"] .ny-legend {
  position: absolute; z-index: 3; left: 50%; top: 10px; transform: translateX(-50%);
  width: max-content; max-width: calc(100% - 20px); margin: 0; padding: 6px 12px 7px;
  display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 2px 7px;
  font: 700 0.8125rem/1.3 var(--font-text); color: #FBEAF4;
  background: rgba(18, 6, 15, 0.74); border-radius: 14px 17px 15px 16px;
  box-shadow: inset 0 0 0 1px rgba(251, 234, 244, 0.14), 0 8px 18px -10px rgba(0, 0, 0, 0.8);
  pointer-events: none;
}
.game[data-game="noyaux"] .ny-grp { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
.game[data-game="noyaux"] .ny-part { display: inline-flex; align-items: center; gap: 4px; }
.game[data-game="noyaux"] .ny-part svg { flex: none; height: 14px; width: auto; }
.game[data-game="noyaux"] .ny-sep { color: #FF8299; font-weight: 800; }
.game[data-game="noyaux"] .ny-legend.is-wide { font-size: 0.9375rem; padding: 7px 15px 8px; gap: 3px 8px; }
.game[data-game="noyaux"] .ny-legend.is-wide .ny-part svg { height: 16px; }
.game[data-game="noyaux"] .ny-lab {
  position: absolute; z-index: 3; left: 0; top: 0; margin: 0; white-space: nowrap; pointer-events: none;
  font: 700 0.75rem/1 var(--font-text); letter-spacing: 0.02em; color: rgba(251, 234, 244, 0.72);
}
.game[data-game="noyaux"] .ny-hot {
  padding: 4px 8px 5px; border-radius: 8px 11px 9px 10px;
  color: #2A0E1A; background: #FFB27A;
  box-shadow: 0 0 0 2px rgba(255, 138, 92, 0.28), 0 6px 14px -8px rgba(0, 0, 0, 0.8);
  transition: background-color .2s, box-shadow .2s, transform .2s;
}
.game[data-game="noyaux"] .ny-hot.is-on {
  background: #FFE07A; transform: scale(1.07);
  box-shadow: 0 0 0 3px rgba(255, 200, 90, 0.5), 0 0 18px rgba(255, 196, 90, 0.75);
}
.game[data-game="noyaux"] .gesture-dot {
  box-shadow: 0 0 0 7px rgba(255, 255, 255, 0.25), 0 0 0 15px rgba(255, 93, 122, 0.3), 0 4px 14px rgba(0, 0, 0, 0.4);
}
`;

  /* Petits noyaux dessinés dans la légende (décoratifs) */
  const dot = (x, y, r, c) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/><circle cx="${x - r * 0.32}" cy="${y - r * 0.34}" r="${r * 0.32}" fill="#fff" fill-opacity="0.55"/>`;
  const ICON = {
    d: `<svg viewBox="0 0 20 13" aria-hidden="true">${dot(6.5, 6.5, 4.6, PROTON)}${dot(13.5, 6.5, 4.6, NEUTRON)}</svg>`,
    t: `<svg viewBox="0 0 20 17" aria-hidden="true">${dot(6.5, 11, 4.4, NEUTRON)}${dot(13.5, 11, 4.4, NEUTRON)}${dot(10, 5, 4.4, PROTON)}</svg>`,
    he: `<svg viewBox="0 0 20 20" aria-hidden="true">${dot(10, 5, 4.2, NEUTRON)}${dot(5, 10, 4.2, PROTON)}${dot(15, 10, 4.2, PROTON)}${dot(10, 15, 4.2, NEUTRON)}</svg>`,
    n: `<svg viewBox="0 0 12 12" aria-hidden="true">${dot(6, 6, 4.8, NEUTRON)}</svg>`,
  };

  function buildLegend(el, text) {
    const m = /^(.*?)\s*\+\s*(.*?)\s*→\s*(.*?)\s*\+\s*(.*)$/.exec(text);
    if (!m) { el.textContent = text; return; }
    const span = (cls, html, label) => {
      const s = document.createElement('span');
      s.className = cls;
      if (html) s.innerHTML = html;
      if (label) s.appendChild(document.createTextNode(label));
      return s;
    };
    /* deux groupes : si la place manque, le second passe à la ligne */
    const g1 = span('ny-grp'), g2 = span('ny-grp');
    g1.append(span('ny-part', ICON.d, m[1]), span('ny-sep', '', ' + '), span('ny-part', ICON.t, m[2]));
    g2.append(span('ny-sep', '', ' → '), span('ny-part', ICON.he, m[3]), span('ny-sep', '', ' + '), span('ny-part', ICON.n, m[4]));
    el.append(g1, g2);
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
  const approach = (v, target, k) => v + (target - v) * clamp(k);
  const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

  /* Bille brillante (proton ou neutron) avec une ombre douce */
  function ballSprite(rad, cols, dpr) {
    const S = Math.ceil(rad * 2 + 10);
    const B = mk(S, S, dpr);
    const g = B.g, c = S / 2;
    const sx = c + rad * 0.14, sy = c + rad * 0.22;
    const sh = g.createRadialGradient(sx, sy, rad * 0.5, sx, sy, rad * 1.42);
    sh.addColorStop(0, 'rgba(8,0,6,0.55)');
    sh.addColorStop(1, 'rgba(8,0,6,0)');
    g.fillStyle = sh;
    g.beginPath();
    g.arc(sx, sy, rad * 1.42, 0, TAU);
    g.fill();
    const b = g.createRadialGradient(c - rad * 0.36, c - rad * 0.4, rad * 0.06, c, c, rad);
    b.addColorStop(0, cols.hi);
    b.addColorStop(0.42, cols.body);
    b.addColorStop(0.86, cols.shade);
    b.addColorStop(1, cols.rim);
    g.fillStyle = b;
    g.beginPath();
    g.arc(c, c, rad, 0, TAU);
    g.fill();
    /* grain très fin : une matière, pas du plastique */
    const r = seeded(cols.seed);
    g.save();
    g.beginPath();
    g.arc(c, c, rad, 0, TAU);
    g.clip();
    for (let i = 0; i < rad * rad * 1.2; i++) {
      const a = r() * TAU, d = Math.sqrt(r()) * rad;
      g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.08)';
      g.fillRect(c + Math.cos(a) * d, c + Math.sin(a) * d, 0.8, 0.8);
    }
    g.restore();
    g.strokeStyle = cols.light;
    g.lineWidth = Math.max(0.8, rad * 0.12);
    g.beginPath();
    g.arc(c, c, rad * 0.88, 0.12 * Math.PI, 0.6 * Math.PI);
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.78)';
    g.beginPath();
    g.ellipse(c - rad * 0.36, c - rad * 0.42, rad * 0.27, rad * 0.16, -0.6, 0, TAU);
    g.fill();
    return B;
  }

  window.RM.games.noyaux = function (api) {
    api.style(CSS);
    const stage = api.stage;
    const cv = api.canvas();
    const ctx = cv.ctx;
    const AMB = api.reducedMotion ? 0.3 : 1;
    const fr = lib.fr;

    /* ---- éléments DOM : légende, étiquettes, zone de lancer ---- */
    const legend = document.createElement('p');
    legend.className = 'ny-legend';
    buildLegend(legend, TEXTES.legende);
    stage.appendChild(legend);
    const label = (cls, text) => {
      const p = document.createElement('p');
      p.className = 'ny-lab ' + cls;
      p.textContent = fr(text);
      p.setAttribute('aria-hidden', 'true');
      stage.appendChild(p);
      return p;
    };
    const labSpeed = label('ny-lab-v', TEXTES.vitesse);
    const labHot = label('ny-hot', TEXTES.assezChaud);
    const labEnergy = label('ny-lab-e', TEXTES.energie);
    const zone = document.createElement('div');
    zone.className = 'ny-zone';
    stage.appendChild(zone);

    /* ---- géométrie ---- */
    const G = {
      w: 1, h: 1, U: 100, rb: 10, RH: 60, rc: 24, tx: 0, ty: 0, px: 0, py: 0, zoneTop: 0,
      dx: 0, dy: 0, dr: 30, bx: 0, by: 0, bw: 100, bh: 12, top: 40,
    };
    let bg = null, sprP = null, sprN = null, gTrack = null, gHot = null, gSeg = null;

    function place(el, x, y) {
      el.style.left = Math.round(x) + 'px';
      el.style.top = Math.round(y) + 'px';
    }

    function geometry(w, h) {
      G.w = w;
      G.h = h;
      legend.classList.toggle('is-wide', w >= 480);
      const lh = legend.offsetHeight || 46;
      G.top = 10 + lh;
      G.U = Math.min(w, h * 0.85);
      G.rb = clamp(G.U * 0.034, 9, 16);
      G.RH = clamp(G.U * 0.2, 52, 118);
      G.rc = G.rb * 2.3;
      G.ky = clamp(0.35 * (h / w) / 1.25, 0.12, 0.35);
      const ayMax = LEVELS[LEVELS.length - 1][0] * w * G.ky;
      G.tx = w / 2;
      G.ty = Math.max(h * 0.4, G.top + G.RH + ayMax + 10);
      /* compteur de vitesse en bas à gauche, barre d'énergie en bas à droite */
      G.dr = clamp(w * 0.1, 28, 44);
      G.dx = 16 + G.dr + 6;
      G.dy = h - 27;
      G.bw = clamp(w * 0.27, 88, 160);
      G.bh = clamp(G.U * 0.032, 10, 14);
      G.bx = w - 18 - G.bw;
      G.by = G.dy - G.dr * 0.5 - G.bh / 2;
      /* le berceau, au milieu en bas ; plus bas encore si le compteur et la barre ne le gênent pas */
      G.px = w / 2;
      const half = G.rb * 2.9;
      const free = G.px - half > G.dx + G.dr + 52 && G.px + half < G.bx - 32;
      G.py = free ? h - Math.max(G.rb * 3.6, h * 0.13) : h - clamp(h * 0.2, 64, 120);
      G.zoneTop = Math.round(Math.min(G.py - G.rb * 4, Math.max(h * 0.55, G.ty + G.RH + ayMax * 0.5)));
      zone.style.top = G.zoneTop + 'px';
      const sw = labSpeed.offsetWidth || 40, ew = labEnergy.offsetWidth || 44;
      const hw = labHot.offsetWidth || 80, hh = labHot.offsetHeight || 22;
      place(labSpeed, G.dx - sw / 2, G.dy + 6);
      place(labEnergy, G.bx + G.bw / 2 - ew / 2 - 6, G.by + G.bh + 8);
      const ma = Math.PI + Math.PI * S_HOT;
      const mx = G.dx + Math.cos(ma) * (G.dr + 12), my = G.dy + Math.sin(ma) * (G.dr + 12);
      place(labHot, clamp(mx - hw / 2, 8, w - hw - 8), my - hh - 4);
      G.hotY = my - 4;
      G.hotX = clamp(mx, 8 + hw * 0.2, w - 8 - hw * 0.2);
      /* dégradés du compteur */
      gTrack = ctx.createLinearGradient(G.dx - G.dr, 0, G.dx, 0);
      gTrack.addColorStop(0, '#5D6E96');
      gTrack.addColorStop(1, '#B9C3D6');
      gHot = ctx.createLinearGradient(G.dx, 0, G.dx + G.dr, 0);
      gHot.addColorStop(0, '#FF8A3D');
      gHot.addColorStop(1, '#FFE07A');
      gSeg = ctx.createLinearGradient(0, G.by, 0, G.by + G.bh);
      gSeg.addColorStop(0, '#FFF6CF');
      gSeg.addColorStop(0.5, '#FFE07A');
      gSeg.addColorStop(1, '#F2A93B');
      buildSprites();
      bg = makeBg(w, h);
      if (D.state === 'rest' || D.state === 'spawn') { D.x = G.px; D.y = G.py; }
      if (gestureType && stage.querySelector('.gesture')) showGesture(gestureType);
    }

    let gestureType = null;
    function showGesture(type) {
      gestureType = type;
      const gx = (G.px / G.w) * 100, gy = (G.py / G.h) * 100;
      if (type === 'drag') api.gesture('drag', { x: gx, y: gy, dx: 0, dy: -Math.round(Math.max(40, G.py - G.ty - G.RH * 0.5)) });
      else api.gesture('hold', { x: gx, y: gy });
    }

    function buildSprites() {
      const dpr = cv.dpr;
      sprP = ballSprite(G.rb, { hi: '#FFE1E7', body: PROTON, shade: '#C22C4F', rim: '#6A0F27', light: 'rgba(255,190,210,0.55)', seed: 3 }, dpr);
      sprN = ballSprite(G.rb, { hi: '#FFFFFF', body: NEUTRON, shade: '#7E89A1', rim: '#3F4659', light: 'rgba(220,235,255,0.6)', seed: 8 }, dpr);
    }

    /* Fond pré-rendu : un laboratoire plongé dans la nuit, quelques traces de particules
       très pâles, la piste de lancer et les cadres du compteur et de la barre d'énergie. */
    function makeBg(w, h) {
      const B = mk(w, h, cv.dpr);
      const g = B.g;
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#24102A');
      gr.addColorStop(0.55, '#170814');
      gr.addColorStop(1, '#0E040B');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
      draw.glow(g, G.tx, G.ty, G.RH * 3.2, '#7A2A5E', 0.32);
      draw.glow(g, w * 0.12, h * 0.9, w * 0.5, '#3A1238', 0.4);
      draw.glow(g, w * 0.95, h * 0.15, w * 0.45, '#2B1640', 0.45);
      const r = seeded(21);
      /* traces de particules, comme dans une chambre à brouillard */
      g.lineCap = 'round';
      for (let i = 0; i < 9; i++) {
        let x = r() * w, y = r() * h, a = r() * TAU;
        const curl = (r() - 0.5) * 0.05, n = 30 + Math.floor(r() * 50);
        g.strokeStyle = `rgba(255,214,232,${0.035 + r() * 0.05})`;
        g.lineWidth = 0.8 + r() * 0.9;
        g.beginPath();
        g.moveTo(x, y);
        for (let k = 0; k < n; k++) {
          a += curl;
          x += Math.cos(a) * 4;
          y += Math.sin(a) * 4;
          g.lineTo(x, y);
        }
        g.stroke();
      }
      for (let i = 0; i < 70; i++) {
        g.fillStyle = `rgba(255,226,240,${0.08 + r() * 0.3})`;
        const s = 0.5 + r() * 1.1;
        g.fillRect(r() * w, r() * h, s, s);
      }
      /* le berceau du deutérium */
      g.save();
      g.translate(G.px, G.py + G.rb * 1.2);
      g.scale(1, 0.32);
      draw.glow(g, 0, 0, G.rb * 4.2, '#FF5D7A', 0.28);
      g.strokeStyle = 'rgba(255,170,195,0.45)';
      g.lineWidth = 2.5;
      g.beginPath();
      g.arc(0, 0, G.rb * 2.6, 0, TAU);
      g.stroke();
      g.strokeStyle = 'rgba(255,170,195,0.18)';
      g.lineWidth = 7;
      g.stroke();
      g.restore();
      /* cadre du compteur de vitesse */
      g.fillStyle = 'rgba(10,3,8,0.55)';
      g.beginPath();
      g.arc(G.dx, G.dy, G.dr + 9, Math.PI, TAU);
      g.lineTo(G.dx + G.dr + 9, G.dy + 4);
      g.lineTo(G.dx - G.dr - 9, G.dy + 4);
      g.closePath();
      g.fill();
      g.strokeStyle = 'rgba(251,234,244,0.12)';
      g.lineWidth = 1;
      g.stroke();
      /* cadre de la barre d'énergie */
      draw.roundRect(g, G.bx - 26, G.by - 6, G.bw + 32, G.bh + 12, (G.bh + 12) / 2);
      g.fillStyle = 'rgba(10,3,8,0.55)';
      g.fill();
      g.strokeStyle = 'rgba(251,234,244,0.12)';
      g.stroke();
      /* éclair dessiné devant la barre */
      const ex = G.bx - 14, ey = G.by + G.bh / 2, s = G.bh * 0.62;
      g.fillStyle = '#FFE07A';
      g.beginPath();
      g.moveTo(ex + s * 0.25, ey - s);
      g.lineTo(ex - s * 0.45, ey + s * 0.12);
      g.lineTo(ex + s * 0.02, ey + s * 0.12);
      g.lineTo(ex - s * 0.22, ey + s);
      g.lineTo(ex + s * 0.5, ey - s * 0.18);
      g.lineTo(ex + s * 0.04, ey - s * 0.18);
      g.closePath();
      g.fill();
      return B;
    }

    /* ---- état ---- */
    const D = {
      x: 0, y: 0, vx: 0, vy: 0, state: 'rest', t: 0, s: 0, strong: false, vis: 1, spin: 0,
      phi: 0, r: 0, r0: 0, rTurn: 0, tin: 0.3, fuse: false, inPhase: true, from: null, trail: [],
    };
    for (let i = 0; i < 12; i++) D.trail.push({ x: 0, y: 0 });
    const T = { x: 0, y: 0, alive: true, k: 1, wait: 0, ph: 0, amp: 0, spin: 0 };
    let press = null;
    const samples = [];
    let count = 0, finished = false, bounces = 0, misses = 0, astuce = false, chargeHint = false;
    let needle = 0, peak = 0, peakA = 0, liveS = 0, hotOn = false, lit = 0, segFlash = [0, 0, 0, 0, 0];
    let dent = 0, dentV = 0, dentPhi = Math.PI / 2, haloPulse = 0, statusOn = false, time = 0, trailN = 0;
    let hes = [], neutrons = [], sparks = [], flashes = [], bolts = [], waves = [];
    let hintKey = '', showHold = -1;
    const motes = [];
    for (let i = 0; i < 26; i++) motes.push({ u: Math.random(), v: Math.random(), s: rand(0.6, 1.6), a: rand(0.12, 0.4), sp: rand(0.006, 0.02), ph: rand(TAU) });

    function setHint(key) {
      if (finished || hintKey === key) return;
      hintKey = key;
      api.hint(TEXTES[key]);
    }
    function updateStatus() {
      if (finished || !statusOn) return;
      api.status(TEXTES.statut(count));
    }

    function level() { return LEVELS[Math.min(count, LEVELS.length - 1)]; }
    function haloR() { return G.RH * ease.outCubic(clamp(T.k)); }

    /* ---- interaction ---- */
    function toCanvas(p) { return { x: p.x, y: p.y + G.zoneTop }; }
    /* l'heure de l'événement lui-même : la mesure reste juste même si la page est occupée */
    function pushSample(x, y, e) {
      const t = e && e.timeStamp > 0 ? e.timeStamp : performance.now();
      samples.push({ t, x, y });
      if (samples.length > 24) samples.shift();
    }
    function velocity(win) {
      if (samples.length < 2) return { vx: 0, vy: 0 };
      const last = samples[samples.length - 1];
      let first = samples[0];
      for (let i = samples.length - 2; i >= 0; i--) {
        first = samples[i];
        if (last.t - samples[i].t >= win) break;
      }
      const dt = Math.max(16, last.t - first.t) / 1000;
      return { vx: (last.x - first.x) / dt, vy: (last.y - first.y) / dt };
    }
    /* vitesse du lancer : la plus grande vitesse des 160 dernières millisecondes (mesurée sur au
       moins 30 ms), pour ne pas compter le petit temps mort avant que le doigt se lève */
    const rel = { vx: 0, vy: 0, sp: 0 };
    function releaseVelocity() {
      rel.vx = 0;
      rel.vy = 0;
      rel.sp = 0;
      const n = samples.length;
      if (n < 2) return rel;
      const last = samples[n - 1];
      for (let i = n - 1; i >= 1; i--) {
        const a = samples[i];
        if (last.t - a.t > 160) break;
        let j = i - 1;
        while (j > 0 && a.t - samples[j].t < 30) j--;
        const b = samples[j];
        const dt = Math.max(10, a.t - b.t) / 1000;
        const vx = (a.x - b.x) / dt, vy = (a.y - b.y) / dt, sp = Math.hypot(vx, vy);
        if (sp > rel.sp) {
          rel.vx = vx;
          rel.vy = vy;
          rel.sp = sp;
        }
      }
      return rel;
    }
    const V_FULL = () => clamp(3.6 * G.U, 1100, 2000);

    api.track(zone, {
      down(p, e) {
        const c = toCanvas(p);
        if (D.state !== 'rest' || press) {
          waves.push({ x: c.x, y: c.y, t: 0, dur: 0.45, r1: 28 });
          return;
        }
        press = { id: p.id, x0: c.x, y0: c.y, t0: performance.now(), ox: D.x - c.x, oy: D.y - c.y, charge: 0 };
        samples.length = 0;
        pushSample(c.x, c.y, e);
        D.state = 'press';
        D.t = 0;
        waves.push({ x: D.x, y: D.y, t: 0, dur: 0.35, r1: G.rb * 2.8, pink: true });
        api.sfx.play('tick', { pitch: 1.2 });
        api.buzz(6);
      },
      move(p, e) {
        if (!press || p.id !== press.id) return;
        const c = toCanvas(p);
        pushSample(c.x, c.y, e);
        if (D.state === 'press' && Math.hypot(c.x - press.x0, c.y - press.y0) > 10) {
          D.state = 'drag';
          press.charge = 0;
        }
        if (D.state === 'drag') {
          D.x = clamp(c.x + press.ox, G.rb * 2, G.w - G.rb * 2);
          D.y = clamp(c.y + press.oy, G.zoneTop + G.rb * 1.6, G.h - G.rb * 1.6);
          const v = velocity(80);
          liveS = clamp(Math.hypot(v.vx, v.vy) / V_FULL());
        }
      },
      up(p, e, cancelled) {
        if (!press || p.id !== press.id) return;
        const pr = press;
        press = null;
        if (cancelled) { goReturn(); return; }
        const c = toCanvas(p);
        pushSample(c.x, c.y, e);
        if (D.state === 'drag') {
          const v = releaseVelocity();
          const sp = v.sp;
          const tx = T.x - D.x, ty = T.y - D.y;
          if (sp < V_FULL() * 0.05 || v.vx * tx + v.vy * ty <= 0) {
            /* pas vraiment lancé (ou lancé à l'envers) : il revient sur son berceau */
            api.sfx.play('pop', { pitch: 0.8, volume: 0.5 });
            if (sp >= V_FULL() * 0.05) setHint('vers');
            goReturn();
            return;
          }
          launch(clamp(sp / V_FULL()), v.vx / sp, v.vy / sp, false);
        } else if (D.state === 'press') {
          /* appui long : il part tout droit vers le tritium, avec la vitesse chargée */
          const s = Math.max(pr.charge, 0.08);
          const a = Math.atan2(T.y - D.y, T.x - D.x);
          launch(s, Math.cos(a), Math.sin(a), true);
        }
      },
    }, { touchAction: 'none' });
    zone.addEventListener('contextmenu', (e) => e.preventDefault());

    /* une tape dans le haut de la scène : petite onde, et le halo frémit si on le touche */
    api.track(cv.canvas, {
      up(p, e, cancelled) {
        if (cancelled || !p.tap) return;
        waves.push({ x: p.x, y: p.y, t: 0, dur: 0.5, r1: 30 });
        if (T.alive && Math.hypot(p.x - T.x, p.y - T.y) < haloR() * 1.1) {
          dentPhi = Math.atan2(p.y - T.y, p.x - T.x);
          dentV += G.RH * 1.6;
          api.sfx.play('bubble', { pitch: 0.8 });
        } else {
          api.sfx.play('tick', { pitch: 0.7 });
        }
        if (D.state === 'rest') setHint('haut');
      },
    }, { touchAction: 'pan-y' });

    function launch(s, ux, uy, strong) {
      D.state = 'fly';
      D.s = s;
      D.strong = strong;
      D.t = 0;
      const v = lerp(0.9, 2.3, s) * G.U;
      D.vx = ux * v;
      D.vy = uy * v;
      peak = s;
      peakA = 1;
      trailN = 0;
      api.sfx.play('whoosh', { pitch: 0.7 + s * 0.8, volume: 0.4 + s * 0.4 });
      api.buzz(8);
      if (!statusOn) {
        statusOn = true;
        updateStatus();
      }
    }

    function goReturn() {
      D.state = 'return';
      D.t = 0;
      D.from = { x: D.x, y: D.y };
    }
    function respawn(delay) {
      D.state = 'spawn';
      D.t = -(delay || 0);
      D.vis = 0;
      D.x = G.px;
      D.y = G.py;
    }

    function enterHalo() {
      D.state = 'halo';
      D.inPhase = true;
      D.t = 0;
      D.phi = Math.atan2(D.y - T.y, D.x - T.x);
      D.r0 = Math.hypot(D.y - T.y, D.x - T.x);
      D.fuse = D.s >= S_HOT;
      if (D.fuse) {
        D.rTurn = G.rc;
        D.tin = lerp(0.34, 0.2, (D.s - S_HOT) / (1 - S_HOT));
      } else {
        const q = Math.pow(D.s / S_HOT, 1.3);
        D.rTurn = lerp(G.RH * 0.86, G.rc * 1.3, q);
        D.tin = lerp(0.16, 0.34, q);
      }
      api.sfx.play('scrape', { pitch: 0.7 + D.s * 0.6, volume: 0.5 });
    }

    function bounce() {
      D.inPhase = false;
      D.t = 0;
      const x = T.x + Math.cos(D.phi) * D.r, y = T.y + Math.sin(D.phi) * D.r;
      waves.push({ x, y, t: 0, dur: 0.5, r1: G.rb * 3.5, pink: true });
      for (let i = 0; i < 8; i++) {
        const a = D.phi + rand(-1.1, 1.1), sp = G.U * rand(0.2, 0.55);
        sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: rand(0.3, 0.55), c: '#FFB3C4' });
      }
      api.sfx.play('bubble', { pitch: 0.6 + D.s * 0.5 });
      api.buzz(10);
      bounces++;
      if (bounces >= 2 && !astuce) {
        astuce = true;
        setHint('astuce');
        showHold = 0.9;
      } else if (!astuce || bounces % 3 === 0) {
        setHint(D.s >= S_HOT * 0.75 ? 'presque' : 'lent');
      }
    }

    function miss() {
      misses++;
      respawn(0.25);
      if (misses >= 2 && !astuce) {
        astuce = true;
        setHint('astuce');
        showGesture('hold');
      } else {
        setHint('rate');
      }
    }

    function fusion() {
      const x = T.x + Math.cos(D.phi) * G.rc * 0.45, y = T.y + Math.sin(D.phi) * G.rc * 0.45;
      flashes.push({ x, y, t: 0, dur: 0.75 });
      waves.push({ x, y, t: 0, dur: 0.7, r1: G.RH * 1.5, pink: false });
      for (let i = 0; i < 26; i++) {
        const a = rand(TAU), sp = G.U * rand(0.3, 1.1);
        sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: rand(0.35, 0.8), c: i % 3 ? '#FFF2D6' : '#FF9DB4' });
      }
      if (sparks.length > 200) sparks.splice(0, sparks.length - 200);
      /* l'hélium s'en va doucement, le neutron file hors de la scène */
      const side = x < G.w / 2 ? -1 : x > G.w / 2 ? 1 : (Math.random() < 0.5 ? -1 : 1);
      hes.push({ x, y, vx: side * G.U * rand(0.12, 0.16), vy: G.U * rand(-0.02, 0.04), t: 0, spin: rand(TAU) });
      if (hes.length > 4) hes.shift();
      const na = rand(-Math.PI * 0.9, -Math.PI * 0.1);
      const nsp = G.U * 1.9;
      neutrons.push({ x, y, vx: Math.cos(na) * nsp, vy: Math.sin(na) * nsp, t: 0, hx: x, hy: y });
      /* une étincelle d'énergie part remplir la barre */
      const seg = Math.min(GOAL - 1, finished ? GOAL - 1 : count);
      bolts.push({ x0: x, y0: y, t: 0, dur: 0.8, seg });
      T.alive = false;
      T.wait = 1.0;
      dent = 0;
      dentV = -G.RH * 3;
      haloPulse = 1;
      D.state = 'gone';
      D.t = 0;
      api.sfx.play('crack', { pitch: 0.9 });
      api.sfx.play('chime', { pitch: 1 + count * 0.08 });
      api.buzz(14);
      if (finished) return;
      count++;
      updateStatus();
      api.progress(count / GOAL);
      if (count >= GOAL) {
        api.done(TEXTES.fin, TEXTES.finStatut);
        api.guide(null, 'laugh', TEXTES.bravo);
        finished = true;
        return;
      }
      setHint(count === 1 ? 'un' : count === 2 ? 'bouge' : 'vise');
    }

    /* ---- animation ---- */
    function update(dt) {
      time += dt;

      /* le tritium : immobile au début, puis de plus en plus agité */
      const [la, lw] = level();
      T.amp = approach(T.amp, la * G.w, dt * 1.2);
      T.ph += lw * dt;
      T.spin += dt * 0.35 * AMB;
      const bob = Math.sin(time * 1.4) * 1.5 * AMB;
      const bx = G.tx + T.amp * Math.sin(T.ph);
      const by = G.ty + T.amp * G.ky * Math.sin(1.7 * T.ph + 0.6) + bob;
      if (T.alive) {
        T.k = Math.min(1, T.k + dt / 0.8);
        T.x = bx;
        T.y = lerp(-G.RH, by, ease.outCubic(T.k));
      } else {
        T.wait -= dt;
        if (T.wait <= 0) {
          T.alive = true;
          T.k = 0;
          T.x = bx;
          T.y = -G.RH;
        }
      }

      /* le doigt fantôme de l'astuce, quand le deutérium est revenu sur son berceau */
      if (showHold >= 0) {
        showHold -= dt;
        if (showHold < 0) {
          if (!finished && D.state === 'rest') showGesture('hold');
          else showHold = 0.2;
        }
      }

      /* le deutérium */
      D.t += dt;
      D.spin += dt * (D.state === 'fly' ? 6 : 0.6) * AMB;
      if (D.state === 'rest') {
        D.x = approach(D.x, G.px, dt * 8);
        D.y = approach(D.y, G.py + Math.sin(time * 2) * 1.5 * AMB, dt * 8);
        D.vis = Math.min(1, D.vis + dt * 4);
      } else if (D.state === 'press') {
        press.charge = clamp((D.t - 0.1) / CHARGE_T);
        if (D.t > 0.3 && !chargeHint) {
          chargeHint = true;
          setHint('charge');
        }
        const sh = press.charge * G.rb * 0.16 * AMB;
        D.x = G.px + Math.sin(time * 61) * sh;
        D.y = G.py + Math.cos(time * 53) * sh;
      } else if (D.state === 'fly') {
        if (T.alive && T.k > 0.7) {
          const want = Math.atan2(T.y - D.y, T.x - D.x), cur = Math.atan2(D.vy, D.vx);
          const da = angDiff(want, cur);
          if (Math.abs(da) < (D.strong ? Math.PI : 0.8)) {
            const turn = (D.strong ? 9 : 3.2) * dt;
            const na = cur + clamp(da, -turn, turn), sp = Math.hypot(D.vx, D.vy);
            D.vx = Math.cos(na) * sp;
            D.vy = Math.sin(na) * sp;
          }
        }
        D.x += D.vx * dt;
        D.y += D.vy * dt;
        if (T.alive && T.k > 0.7 && Math.hypot(D.x - T.x, D.y - T.y) <= haloR()) enterHalo();
        else if (D.x < -40 || D.x > G.w + 40 || D.y < -40 || D.y > G.h + 40) miss();
      } else if (D.state === 'halo') {
        const k = clamp(D.t / D.tin);
        if (D.inPhase) {
          D.r = lerp(D.r0, D.rTurn, ease.outQuad(k));
          if (k >= 1) {
            if (D.fuse) fusion();
            else bounce();
          }
        } else {
          D.r = lerp(D.rTurn, G.RH * 1.04, ease.inQuad(k));
          if (k >= 1) {
            D.state = 'back';
            D.t = 0;
            const sp = lerp(0.9, 2.3, D.s) * G.U * 0.65;
            D.vx = Math.cos(D.phi) * sp;
            D.vy = Math.sin(D.phi) * sp;
          }
        }
        if (D.state === 'halo') {
          D.x = T.x + Math.cos(D.phi) * D.r;
          D.y = T.y + Math.sin(D.phi) * D.r;
          dentPhi = D.phi;
        }
      } else if (D.state === 'back') {
        D.x += D.vx * dt;
        D.y += D.vy * dt;
        const f = Math.pow(0.04, dt);
        D.vx *= f;
        D.vy *= f;
        if (D.t > 0.45) {
          if (D.x < -10 || D.x > G.w + 10 || D.y < -10 || D.y > G.h + 10) respawn(0);
          else goReturn();
        }
      } else if (D.state === 'return') {
        const k = clamp(D.t / 0.55);
        const e = ease.inOutCubic(k);
        D.x = lerp(D.from.x, G.px, e);
        D.y = lerp(D.from.y, G.py, e) - Math.sin(Math.PI * k) * G.rb * 1.5;
        if (k >= 1) D.state = 'rest';
      } else if (D.state === 'spawn') {
        if (D.t >= 0) {
          D.vis = clamp(D.t / 0.35);
          D.x = G.px;
          D.y = G.py + (1 - ease.outCubic(D.vis)) * G.rb * 2.5;
          if (D.vis >= 1) D.state = 'rest';
        }
      } else if (D.state === 'gone') {
        /* le deutérium revient quand le nouveau tritium est presque en place */
        if (D.t > 0.6 && T.alive && T.k > 0.45) respawn(0);
      }

      /* traînée */
      if (D.state === 'fly' || D.state === 'halo' || D.state === 'back') {
        D.trail.unshift(D.trail.pop());
        D.trail[0].x = D.x;
        D.trail[0].y = D.y;
        trailN = Math.min(D.trail.length, trailN + 1);
      } else {
        trailN = Math.max(0, trailN - 1);
        if (trailN > 0) {
          D.trail.unshift(D.trail.pop());
          D.trail[0].x = D.x;
          D.trail[0].y = D.y;
        }
      }

      /* le halo se creuse quand le deutérium pousse, puis rebondit comme un trampoline */
      const target = D.state === 'halo' ? Math.max(0, G.RH - D.r) * 0.62 : 0;
      const acc = 230 * (target - dent) - 13 * dentV;
      dentV += acc * dt;
      dent += dentV * dt;
      haloPulse *= Math.pow(0.15, dt);

      /* compteur de vitesse */
      let want = 0;
      if (D.state === 'press') want = press.charge;
      else if (D.state === 'drag') want = liveS;
      else if (D.state === 'fly' || D.state === 'halo') want = D.s;
      needle = approach(needle, want, dt * (want > needle ? 14 : 2.4));
      if (D.state === 'rest') peakA = Math.max(0, peakA - dt * 0.5);
      const on = needle >= S_HOT - 0.004;
      if (on !== hotOn) {
        hotOn = on;
        labHot.classList.toggle('is-on', on);
        if (on && (D.state === 'press' || D.state === 'drag')) {
          api.sfx.play('tick', { pitch: 1.7 });
          api.buzz(8);
        }
      }

      /* particules */
      for (const m of motes) {
        m.v -= m.sp * dt * AMB;
        m.u += Math.sin(time * 0.3 + m.ph) * 0.004 * dt * AMB;
        if (m.v < -0.02) { m.v = 1.02; m.u = Math.random(); }
      }
      for (const a of hes) {
        a.t += dt;
        a.x += a.vx * dt;
        a.y += a.vy * dt;
        a.spin += dt * 0.5;
      }
      let j = 0;
      for (let i = 0; i < hes.length; i++) if (hes[i].t < 2.6) hes[j++] = hes[i];
      hes.length = j;
      for (const n of neutrons) {
        n.t += dt;
        n.hx = n.x;
        n.hy = n.y;
        n.x += n.vx * dt;
        n.y += n.vy * dt;
      }
      j = 0;
      for (let i = 0; i < neutrons.length; i++) {
        const n = neutrons[i];
        if (n.x > -60 && n.x < G.w + 60 && n.y > -60 && n.y < G.h + 60) neutrons[j++] = n;
      }
      neutrons.length = j;
      for (const s of sparks) {
        s.t += dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        const f = Math.pow(0.1, dt);
        s.vx *= f;
        s.vy *= f;
      }
      j = 0;
      for (let i = 0; i < sparks.length; i++) if (sparks[i].t < sparks[i].life) sparks[j++] = sparks[i];
      sparks.length = j;
      for (const f of flashes) f.t += dt;
      j = 0;
      for (let i = 0; i < flashes.length; i++) if (flashes[i].t < flashes[i].dur) flashes[j++] = flashes[i];
      flashes.length = j;
      for (const wv of waves) wv.t += dt;
      j = 0;
      for (let i = 0; i < waves.length; i++) if (waves[i].t < waves[i].dur) waves[j++] = waves[i];
      waves.length = j;
      for (const b of bolts) {
        b.t += dt;
        if (b.t >= b.dur && !b.done) {
          b.done = true;
          lit = Math.max(lit, b.seg + 1);
          segFlash[b.seg] = 1;
          api.sfx.play('tick', { pitch: 1.4 + b.seg * 0.1 });
        }
      }
      j = 0;
      for (let i = 0; i < bolts.length; i++) if (!bolts[i].done) bolts[j++] = bolts[i];
      bolts.length = j;
      for (let i = 0; i < GOAL; i++) segFlash[i] *= Math.pow(0.08, dt);
    }

    /* ---- dessin ---- */
    function drawBall(spr, x, y, s) {
      const S = spr.w * s;
      ctx.drawImage(spr.c, x - S / 2, y - S / 2, S, S);
    }
    /* noyaux : listes de billes (p = proton, n = neutron) disposées autour du centre */
    const D_LAY = [['n', 0], ['p', Math.PI]];
    const T_LAY = [['n', Math.PI / 2 + TAU / 3], ['n', Math.PI / 2 + (2 * TAU) / 3], ['p', Math.PI / 2]];
    const HE_LAY = [['n', -Math.PI / 2], ['p', Math.PI], ['p', 0], ['n', Math.PI / 2]];
    function drawNucleus(lay, x, y, rot, spread, s) {
      const d = G.rb * spread * s;
      for (const [k, a] of lay) {
        drawBall(k === 'p' ? sprP : sprN, x + Math.cos(a + rot) * d, y + Math.sin(a + rot) * d, s);
      }
    }

    function haloPath(x, y, R) {
      ctx.beginPath();
      const n = 72;
      const wob = (0.6 + haloPulse * 4) * AMB;
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * TAU;
        const da = angDiff(a, dentPhi);
        const gss = Math.exp(-(da * da) / (2 * 0.42 * 0.42));
        const rr = R - dent * gss + Math.sin(a * 6 + time * 2.2) * wob + Math.sin(a * 3 - time * 1.3) * wob * 0.8;
        const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    }

    function drawHalo() {
      if (!T.alive) return;
      const R = haloR();
      if (R < 2) return;
      const { x, y } = T;
      /* le champ qui repousse : une bulle rose, plus dense vers le bord */
      const g = ctx.createRadialGradient(x, y, R * 0.18, x, y, R * 1.02);
      g.addColorStop(0, 'rgba(255,93,122,0)');
      g.addColorStop(0.55, 'rgba(255,93,122,0.07)');
      g.addColorStop(0.86, 'rgba(255,120,150,0.17)');
      g.addColorStop(1, 'rgba(255,150,175,0.3)');
      ctx.fillStyle = g;
      haloPath(x, y, R);
      ctx.fill();
      /* ondes qui partent du noyau vers l'extérieur : « ça repousse » */
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 3; i++) {
        const k = ((time * 0.55 * AMB + i / 3) % 1);
        ctx.strokeStyle = `rgba(255,170,195,${0.22 * Math.sin(Math.PI * k)})`;
        ctx.beginPath();
        ctx.arc(x, y, lerp(R * 0.3, R * 0.93, k), 0, TAU);
        ctx.stroke();
      }
      /* la membrane */
      haloPath(x, y, R);
      ctx.strokeStyle = 'rgba(255,140,170,0.16)';
      ctx.lineWidth = 7;
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,205,220,${0.5 + 0.3 * clamp(Math.abs(dent) / (G.RH * 0.3))})`;
      ctx.lineWidth = 1.7;
      ctx.stroke();
      /* là où le deutérium appuie, la membrane s'illumine */
      const pr = clamp(Math.abs(dent) / (G.RH * 0.25));
      if (pr > 0.02) {
        ctx.globalCompositeOperation = 'lighter';
        const r = R - dent;
        draw.glow(ctx, x + Math.cos(dentPhi) * r, y + Math.sin(dentPhi) * r, G.rb * (2.5 + 2 * pr), '#FF9DB8', 0.45 * pr);
        ctx.globalCompositeOperation = 'source-over';
      }
    }

    function drawGauge() {
      const { dx, dy, dr } = G;
      ctx.lineCap = 'round';
      ctx.lineWidth = 7;
      ctx.strokeStyle = gTrack;
      ctx.beginPath();
      ctx.arc(dx, dy, dr, Math.PI, Math.PI + Math.PI * S_HOT);
      ctx.stroke();
      ctx.strokeStyle = gHot;
      ctx.beginPath();
      ctx.arc(dx, dy, dr, Math.PI + Math.PI * S_HOT, TAU);
      ctx.stroke();
      ctx.lineCap = 'butt';
      /* graduations */
      for (let i = 0; i <= 10; i++) {
        const a = Math.PI + (i / 10) * Math.PI;
        ctx.strokeStyle = 'rgba(251,234,244,0.35)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(dx + Math.cos(a) * (dr - 7), dy + Math.sin(a) * (dr - 7));
        ctx.lineTo(dx + Math.cos(a) * (dr - 10), dy + Math.sin(a) * (dr - 10));
        ctx.stroke();
      }
      /* le repère « assez chaud » relié à son étiquette */
      const ma = Math.PI + Math.PI * S_HOT;
      ctx.strokeStyle = hotOn ? '#FFE07A' : 'rgba(255,190,140,0.9)';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(dx + Math.cos(ma) * (dr - 6), dy + Math.sin(ma) * (dr - 6));
      ctx.lineTo(dx + Math.cos(ma) * (dr + 8), dy + Math.sin(ma) * (dr + 8));
      ctx.lineTo(G.hotX, G.hotY);
      ctx.stroke();
      if (hotOn) {
        ctx.globalCompositeOperation = 'lighter';
        draw.glow(ctx, dx + Math.cos(ma) * dr, dy + Math.sin(ma) * dr, 16, '#FFD27A', 0.5);
        ctx.globalCompositeOperation = 'source-over';
      }
      /* la vitesse du dernier lancer, en fantôme */
      if (peakA > 0.02) {
        const pa = Math.PI + Math.PI * clamp(peak);
        ctx.strokeStyle = `rgba(255,255,255,${0.55 * peakA})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(dx + Math.cos(pa) * (dr - 5), dy + Math.sin(pa) * (dr - 5));
        ctx.lineTo(dx + Math.cos(pa) * (dr + 5), dy + Math.sin(pa) * (dr + 5));
        ctx.stroke();
      }
      /* l'aiguille */
      const na = Math.PI + Math.PI * clamp(needle);
      const nx = dx + Math.cos(na) * (dr - 4), ny = dy + Math.sin(na) * (dr - 4);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(dx + 1, dy + 1.5);
      ctx.lineTo(nx + 1, ny + 1.5);
      ctx.stroke();
      ctx.strokeStyle = '#FFF4F8';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(dx, dy);
      ctx.lineTo(nx, ny);
      ctx.stroke();
      ctx.fillStyle = PROTON;
      ctx.beginPath();
      ctx.arc(dx, dy, 4.5, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.arc(dx - 1.3, dy - 1.4, 1.5, 0, TAU);
      ctx.fill();
      ctx.lineCap = 'butt';
    }

    function drawEnergy() {
      const { bx, by, bw, bh } = G;
      const gap = 3, sw = (bw - gap * (GOAL - 1)) / GOAL;
      for (let i = 0; i < GOAL; i++) {
        const x = bx + i * (sw + gap);
        draw.roundRect(ctx, x, by, sw, bh, Math.min(4, bh / 2));
        if (i < lit) {
          ctx.fillStyle = gSeg;
          ctx.fill();
          const f = segFlash[i] + (finished ? 0.25 + 0.2 * Math.sin(time * 4 + i) : 0);
          if (f > 0.02) {
            ctx.globalCompositeOperation = 'lighter';
            draw.glow(ctx, x + sw / 2, by + bh / 2, sw * 0.9 + f * 10, '#FFE7A0', 0.6 * clamp(f));
            ctx.globalCompositeOperation = 'source-over';
          }
        } else {
          ctx.fillStyle = 'rgba(251,234,244,0.08)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(251,234,244,0.16)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    function render() {
      if (!bg) return;
      const { w, h } = cv;
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.drawImage(bg.c, 0, 0, w, h);
      for (const m of motes) {
        ctx.fillStyle = `rgba(255,214,232,${m.a * (0.6 + 0.4 * Math.sin(time * 1.3 + m.ph))})`;
        ctx.beginPath();
        ctx.arc(m.u * w, m.v * h, m.s, 0, TAU);
        ctx.fill();
      }

      /* flèches douces au-dessus du berceau : c'est par là qu'on lance */
      if (D.state === 'rest' && !finished) {
        for (let i = 0; i < 3; i++) {
          const k = (time * 0.7 * AMB + i / 3) % 1;
          const y = G.py - G.rb * 2.6 - k * G.rb * 4;
          const a = Math.sin(Math.PI * k) * 0.45;
          const s = G.rb * 0.8;
          ctx.strokeStyle = `rgba(255,190,210,${a})`;
          ctx.lineWidth = 2.2;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(G.px - s, y + s * 0.55);
          ctx.lineTo(G.px, y);
          ctx.lineTo(G.px + s, y + s * 0.55);
          ctx.stroke();
        }
        ctx.lineCap = 'butt';
      }

      drawHalo();

      /* l'hélium qui s'en va */
      for (const a of hes) {
        const s = a.t < 0.45 ? ease.outBack(clamp(a.t / 0.45)) : 1;
        const al = 1 - clamp((a.t - 1.5) / 1.1);
        ctx.globalCompositeOperation = 'lighter';
        draw.glow(ctx, a.x, a.y, G.rb * 4, '#FFD98A', (0.35 + 0.4 * (1 - clamp(a.t / 1.2))) * al);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = al;
        drawNucleus(HE_LAY, a.x, a.y, a.spin, 0.74, s);
        ctx.globalAlpha = 1;
      }

      /* le tritium */
      if (T.alive) {
        ctx.globalCompositeOperation = 'lighter';
        draw.glow(ctx, T.x, T.y, G.rb * 3.6, '#FF7A9A', 0.3);
        ctx.globalCompositeOperation = 'source-over';
        drawNucleus(T_LAY, T.x, T.y, T.spin, 0.64, 1);
      }

      /* la traînée et le deutérium */
      const hot = D.s >= S_HOT && (D.state === 'fly' || D.state === 'halo');
      if (trailN > 1) {
        ctx.lineCap = 'round';
        for (let i = 1; i < trailN; i++) {
          const a = D.trail[i - 1], b = D.trail[i];
          const k = 1 - i / trailN;
          ctx.strokeStyle = hot ? `rgba(255,236,190,${0.5 * k})` : `rgba(255,150,180,${0.42 * k})`;
          ctx.lineWidth = G.rb * 1.5 * k;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
        ctx.lineCap = 'butt';
      }
      if (D.state !== 'gone' && D.vis > 0.01) {
        const charge = D.state === 'press' ? press.charge : D.state === 'drag' ? liveS : (D.state === 'fly' || D.state === 'halo') ? D.s : 0;
        ctx.globalCompositeOperation = 'lighter';
        draw.glow(ctx, D.x, D.y, G.rb * (3 + 2.2 * charge), charge >= S_HOT ? '#FFE3A8' : '#FF7A9A', (0.25 + 0.4 * charge) * D.vis);
        if (D.state === 'press') {
          /* la charge : un anneau qui se referme autour du noyau */
          const k = (time * 2.2) % 1;
          ctx.strokeStyle = `rgba(255,226,200,${0.5 * (1 - k) * (0.4 + charge)})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(D.x, D.y, G.rb * lerp(4.2, 2, k), 0, TAU);
          ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = D.vis;
        const rot = D.state === 'fly' || D.state === 'halo' ? Math.atan2(D.vy, D.vx) + D.spin * 0.3 : D.spin * 0.4 + 0.3;
        drawNucleus(D_LAY, D.x, D.y, rot, 0.56, 1);
        ctx.globalAlpha = 1;
      }

      /* neutrons qui filent */
      ctx.lineCap = 'round';
      for (const n of neutrons) {
        const sp = Math.hypot(n.vx, n.vy) || 1;
        const ux = n.vx / sp, uy = n.vy / sp;
        ctx.strokeStyle = 'rgba(200,214,240,0.32)';
        ctx.lineWidth = G.rb * 1.1;
        ctx.beginPath();
        ctx.moveTo(n.x - ux * G.rb * 6, n.y - uy * G.rb * 6);
        ctx.lineTo(n.x, n.y);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(235,242,255,0.5)';
        ctx.lineWidth = G.rb * 0.4;
        ctx.stroke();
        drawBall(sprN, n.x, n.y, 0.95);
      }
      ctx.lineCap = 'butt';

      /* éclairs, ondes, étincelles, énergie */
      ctx.globalCompositeOperation = 'lighter';
      for (const f of flashes) {
        const k = f.t / f.dur;
        draw.glow(ctx, f.x, f.y, G.RH * (0.5 + 1.8 * ease.outCubic(k)), '#FFF6E8', 0.95 * (1 - k));
        draw.glow(ctx, f.x, f.y, G.RH * (0.3 + 0.9 * ease.outCubic(k)), '#FF9DB8', 0.6 * (1 - k));
      }
      for (const s of sparks) {
        const k = s.t / s.life;
        ctx.fillStyle = rgba(s.c, 0.9 * (1 - k));
        ctx.fillRect(s.x - 1.2, s.y - 1.2, 2.4, 2.4);
      }
      for (const b of bolts) {
        const k = ease.inOutCubic(clamp(b.t / b.dur));
        const gap = 3, sw = (G.bw - gap * (GOAL - 1)) / GOAL;
        const x1 = G.bx + b.seg * (sw + gap) + sw / 2, y1 = G.by + G.bh / 2;
        const cx = lerp(b.x0, x1, 0.5) + G.w * 0.18, cy = Math.min(b.y0, y1) - G.h * 0.05;
        const u = 1 - k;
        const x = u * u * b.x0 + 2 * u * k * cx + k * k * x1;
        const y = u * u * b.y0 + 2 * u * k * cy + k * k * y1;
        draw.glow(ctx, x, y, 12, '#FFE7A0', 0.9);
        ctx.fillStyle = '#FFFBEA';
        ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
      }
      ctx.globalCompositeOperation = 'source-over';
      for (const wv of waves) {
        const k = wv.t / wv.dur;
        ctx.strokeStyle = wv.pink ? `rgba(255,170,195,${0.8 * (1 - k)})` : `rgba(255,244,236,${0.7 * (1 - k)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(wv.x, wv.y, lerp(6, wv.r1, ease.outCubic(k)), 0, TAU);
        ctx.stroke();
      }

      drawGauge();
      drawEnergy();
    }

    api.loop((dt) => {
      update(dt);
      render();
    });

    function init() {
      press = null;
      samples.length = 0;
      count = 0;
      finished = false;
      bounces = 0;
      misses = 0;
      astuce = false;
      chargeHint = false;
      needle = 0;
      peak = 0;
      peakA = 0;
      liveS = 0;
      hotOn = false;
      labHot.classList.remove('is-on');
      lit = 0;
      segFlash = [0, 0, 0, 0, 0];
      dent = 0;
      dentV = 0;
      dentPhi = Math.PI / 2;
      haloPulse = 0;
      statusOn = false;
      trailN = 0;
      hes = [];
      neutrons = [];
      sparks = [];
      flashes = [];
      bolts = [];
      waves = [];
      T.alive = true;
      T.k = 1;
      T.ph = 0;
      T.amp = 0;
      T.x = G.tx;
      T.y = G.ty;
      D.state = 'rest';
      D.vis = 1;
      D.s = 0;
      D.x = G.px;
      D.y = G.py;
      hintKey = '';
      showHold = -1;
      setHint('consigne');
      api.status('');
      api.progress(0);
      showGesture('drag');
    }

    if (/[?&]debug\b/.test(location.search)) {
      api.root.__dbg = () => ({
        state: D.state, s: D.s, count, finished, bounces, misses, needle,
        T: { x: T.x, y: T.y, alive: T.alive }, D: { x: D.x, y: D.y }, zoneTop: G.zoneTop, w: G.w, h: G.h,
      });
    }

    cv.onResize(geometry);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => { if (cv.w > 1) geometry(cv.w, cv.h); });
    }
    api.onReset(init);
    init();
    update(0.016);
    render();
  };
})();
