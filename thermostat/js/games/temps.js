/* Trop vite pour le thermostat : un graphique du CO2 de l'air avec un zoom dans le temps.
   Le curseur (ou les trois boutons) règle la fenêtre, de 800 000 ans à 200 ans.
   La courbe est SCHÉMATIQUE : elle respecte les bornes connues (≈ 180 ppm en période glaciaire,
   ≈ 280 à 300 ppm en période chaude, cycles d'environ 100 000 ans, ≈ 280 ppm avant l'ère
   industrielle, plus de 420 ppm aujourd'hui) sans prétendre reproduire les mesures. */
(function () {
  'use strict';
  const { lib } = window.RM;
  const { TAU, clamp, lerp, ease, rgba } = lib;

  const TEXTES = {
    titre: 'CO2 de l’air (ppm)',
    curseur: 'Fenêtre de temps',
    /* (dans les nombres, l'espace des milliers est insécable : « 800 000 » ne se coupe pas) */
    v800: '800 000 ans',
    v10: '10 000 ans',
    v200: '200 ans',
    s800: 'En 800 000 ans, le CO2 n’avait jamais dépassé 300 ppm.',
    s10: 'Pendant 10 000 ans, le CO2 est resté presque stable.',
    s200: 'En 200 ans, nous avons fait grimper le CO2 de 280 à plus de 420 ppm.',
    encore: 'Regarde aussi la vue « {v} ».',
    fantome: 'Le thermostat des roches mettra des centaines de milliers d’années à faire redescendre le CO2.',
    fin: 'Le CO2 n’avait jamais été aussi haut depuis au moins 800 000 ans.',
    finStatut: 'Le thermostat de la Terre est bien trop lent pour suivre notre rythme.',
    ilya: 'il y a {n} ans',
    ans: '{n} ans',
    aujourdhui: 'aujourd’hui',
    seuil: '300 ppm',
    vue: ', vue explorée',
  };

  /* ---- la courbe schématique ---- */
  const Y_MIN = 150, Y_MAX = 450;              /* échelle verticale (ppm) */
  const TICKS = [180, 280, 420];
  const L800 = Math.log10(800000), L200 = Math.log10(200);
  const pOf = (years) => (L800 - Math.log10(years)) / (L800 - L200);
  const yearsOf = (p) => Math.pow(10, lerp(L800, L200, clamp(p)));
  const VIEWS = [
    { key: 'v800', years: 800000 },
    { key: 'v10', years: 10000 },
    { key: 'v200', years: 200 },
  ];
  VIEWS.forEach((v) => { v.p = pOf(v.years); v.label = TEXTES[v.key]; v.status = TEXTES['s' + v.key.slice(1)]; });

  /* l'ère industrielle : de 280 à un peu plus de 420 ppm en 200 ans, de plus en plus vite */
  const K_IND = 3.6, E_IND = Math.exp(K_IND) - 1;
  const indus = (t) => 280 + 144 * (Math.exp(K_IND * (1 - t / 200)) - 1) / E_IND;
  /* le futur « fantôme » : le thermostat des roches fait redescendre le CO2, très lentement */
  const ghost = (f) => 280 + 144 * Math.exp(-f / 160000);

  const STEP = 250;
  const NAT = (function buildNatural() {
    const n = lib.makeNoise(77);
    const NT = Math.round(820000 / STEP) + 1;
    const a = new Float32Array(NT);
    /* cycles d'environ 100 000 ans : lente descente, remontée plus rapide (valeurs schématiques) */
    const V = [264, 287, 279, 297, 284, 276, 281, 273, 278];
    const M = [186, 194, 187, 197, 183, 191, 184, 189, 186];
    const J = [0, 3500, -4000, 5000, -2500, 4000, -3000, 2000, 0];
    const peaks = [], mins = [];
    for (let j = 0; j < 9; j++) {
      const P = 11000 + j * 99000 + J[j];
      peaks.push(P);
      mins.push(P + 9500 + (j % 3) * 1200);
    }
    const smooth = (u) => u * u * (3 - 2 * u);
    /* les 11 000 dernières années : presque plat, entre 260 et 280 ppm */
    const HOLO = [[200, 280], [2000, 277], [5000, 268], [8000, 260], [11000, 264]];
    function holocene(t) {
      for (let i = 1; i < HOLO.length; i++) {
        if (t <= HOLO[i][0]) {
          const u = (t - HOLO[i - 1][0]) / (HOLO[i][0] - HOLO[i - 1][0]);
          return lerp(HOLO[i - 1][1], HOLO[i][1], smooth(clamp(u)));
        }
      }
      return HOLO[HOLO.length - 1][1];
    }
    for (let i = 0; i < NT; i++) {
      const t = i * STEP;
      let v;
      if (t <= 11000) {
        v = holocene(Math.max(200, t)) + (n.fbm(t / 700, 9.1, 2) - 0.5) * 2.4 * clamp((t - 200) / 800);
      } else {
        let j = 0;
        while (j < 7 && t > peaks[j + 1]) j++;
        if (t <= mins[j]) {
          const u = (mins[j] - t) / (mins[j] - peaks[j]);
          v = M[j] + (V[j] - M[j]) * smooth(clamp(u));
        } else {
          /* une première marche vers le bas, un long palier qui ondule, puis la descente vers le minimum */
          const u = clamp((peaks[j + 1] - t) / (peaks[j + 1] - mins[j]));
          const shape = 0.4 * smooth(clamp(u / 0.22)) + 0.6 * smooth(clamp((u - 0.4) / 0.6));
          v = V[j + 1] + (M[j] - V[j + 1]) * shape + 7 * Math.sin(u * TAU * 2.2 + j) * Math.sin(Math.PI * u);
        }
        v += (n.fbm(t / 6000, 3.3, 3) - 0.5) * 6;
      }
      a[i] = clamp(v, 181, 299);
    }
    return a;
  })();
  function co2(t) {
    if (t <= 200) return indus(Math.max(0, t));
    const f = t / STEP;
    const i = Math.min(NAT.length - 2, Math.floor(f));
    return lerp(NAT[i], NAT[i + 1], f - i);
  }

  function roundNice(n) {
    const mag = Math.pow(10, Math.floor(Math.log10(n)) - 1);
    return Math.round(n / mag) * mag;
  }

  window.RM.games.temps = function (api) {
    const cv = api.canvas();
    const ctx = cv.ctx;
    const RMO = api.reducedMotion;

    const COL = {
      fg: api.css('--fg') || '#F1F1F3',
      muted: api.css('--muted') || '#B3B6BE',
      accent: api.css('--accent') || '#FF5A4E',
      accent2: api.css('--accent-2') || '#FFC857',
      stage: api.css('--stage') || '#111317',
      nat: '#86BCE6',
      rock: '#D8C3A0',
      panel: '#171A20',
    };
    let FAM = getComputedStyle(document.body).fontFamily;
    const font = (size, weight) => `${weight || 600} ${size}px ${FAM}`;

    /* ---- état ---- */
    let pT = 1, pH = 1;            /* position du curseur : cible et poignée affichée */
    let logW = Math.log10(200);    /* fenêtre affichée (log10 des années), lissée */
    let dragging = false;
    let dragOff = 0;
    let time = 0;
    let seen = {};
    let dwell = {};
    let nSeen = 0;
    let statusView = null;
    let ghostOn = false, ghostT = 0;
    let doneSent = false;
    let shownProg = -1;
    let pulse = 0;
    let pendingGesture = false;
    const rings = [];

    /* ---- géométrie ---- */
    const geo = { ok: false, w: 1, h: 1, px: 10, py: 10, pw: 1, ph: 1, x0: 0, x1: 1, y0: 0, y1: 1, sliderY: 0 };
    let bg = null;
    let areaNat = null, areaInd = null;
    const yOf = (v) => lerp(geo.y1, geo.y0, (v - Y_MIN) / (Y_MAX - Y_MIN));

    /* ---- DOM : titre, curseur, raccourcis ---- */
    api.style(`
      .game[data-game="temps"] .tp-title { position: absolute; z-index: 2; margin: 0; pointer-events: none;
        color: var(--fg); font: 700 .875rem/1.1 var(--font-text); letter-spacing: .01em; opacity: .92; }
      .game[data-game="temps"] .tp-slider { position: absolute; z-index: 3; left: 14px; right: 14px; bottom: 62px; height: 52px;
        cursor: pointer; outline: none; -webkit-tap-highlight-color: transparent; }
      .game[data-game="temps"] .tp-track { position: absolute; left: 24px; right: 24px; top: 50%; height: 10px; margin-top: -5px;
        border-radius: 6px 5px 6px 4px; box-shadow: inset 0 0 0 1px rgba(241, 241, 243, .1);
        background: linear-gradient(90deg, rgba(134, 188, 230, .38), rgba(241, 241, 243, .16) 62%, rgba(255, 90, 78, .6)); }
      .game[data-game="temps"] .tp-tick { position: absolute; top: 50%; width: 6px; height: 6px; margin: -3px 0 0 -3px;
        border-radius: 50%; background: rgba(241, 241, 243, .55); }
      .game[data-game="temps"] .tp-handle { position: absolute; top: 50%; left: 0; width: 46px; height: 46px; margin: -23px 0 0 -23px;
        border-radius: 48% 52% 50% 50% / 52% 48% 52% 48%; background: #F1F1F3;
        box-shadow: 0 6px 16px -6px rgba(0, 0, 0, .7), 0 0 0 4px rgba(255, 90, 78, .0); transition: box-shadow .25s ease; pointer-events: none; }
      .game[data-game="temps"] .tp-handle::before, .game[data-game="temps"] .tp-handle::after { content: ""; position: absolute; top: 15px; bottom: 15px;
        width: 2.5px; border-radius: 2px; background: #6B6F78; }
      .game[data-game="temps"] .tp-handle::before { left: 17.5px; }
      .game[data-game="temps"] .tp-handle::after { right: 17.5px; }
      .game[data-game="temps"] .tp-slider:focus-visible .tp-handle,
      .game[data-game="temps"] .tp-slider.is-active .tp-handle { box-shadow: 0 6px 16px -6px rgba(0, 0, 0, .7), 0 0 0 5px rgba(255, 90, 78, .55); }
      .game[data-game="temps"] .tp-chips { position: absolute; z-index: 3; left: 0; right: 0; bottom: 10px; display: flex;
        justify-content: center; gap: 6px; padding: 0 8px; }
      .game[data-game="temps"] .tp-chip { flex: 0 1 auto; min-width: 0; padding: 8px 11px; font-size: .8125rem; white-space: nowrap;
        background: rgba(241, 241, 243, .92); transition: background .3s ease, color .3s ease; }
      .game[data-game="temps"] .tp-chip.is-seen { background: #FFC857; color: #1D2026; }
      .game[data-game="temps"] .tp-roomy .tp-chip.is-seen::after { content: ""; width: 5px; height: 9px; margin: -3px 1px 0 3px;
        border: solid currentColor; border-width: 0 2.2px 2.2px 0; transform: rotate(45deg); }
      .game[data-game="temps"] .tp-chip.is-hint { animation: temps-nudge 1.8s ease-in-out infinite; }
      @keyframes temps-nudge { 0%, 100% { box-shadow: 0 6px 16px -8px rgba(0, 0, 0, .6), 0 0 0 0 rgba(255, 200, 87, 0); }
        50% { box-shadow: 0 6px 16px -8px rgba(0, 0, 0, .6), 0 0 0 4px rgba(255, 200, 87, .45); } }
      @media (prefers-reduced-motion: reduce) { .game[data-game="temps"] .tp-chip.is-hint { animation: none; } }
    `);
    const title = document.createElement('p');
    title.className = 'tp-title';
    title.textContent = TEXTES.titre;
    api.stage.appendChild(title);

    const slider = document.createElement('div');
    slider.className = 'tp-slider';
    slider.setAttribute('role', 'slider');
    slider.setAttribute('tabindex', '0');
    slider.setAttribute('aria-label', TEXTES.curseur);
    slider.setAttribute('aria-valuemin', '0');
    slider.setAttribute('aria-valuemax', '100');
    slider.innerHTML = '<div class="tp-track"></div><div class="tp-handle"></div>';
    const track = slider.querySelector('.tp-track');
    const handle = slider.querySelector('.tp-handle');
    VIEWS.forEach((v) => {
      const t = document.createElement('i');
      t.className = 'tp-tick';
      t.style.left = (v.p * 100).toFixed(2) + '%';
      track.appendChild(t);
    });
    api.stage.appendChild(slider);

    const chipBar = document.createElement('div');
    chipBar.className = 'tp-chips';
    VIEWS.forEach((v) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip tp-chip';
      b.textContent = v.label;
      b.addEventListener('click', () => {
        pT = v.p;
        pulse = 1;
        api.gesture(null);
        api.sfx.play('tick', { pitch: 1 + v.p * 0.4 });
      });
      v.chip = b;
      chipBar.appendChild(b);
    });
    api.stage.appendChild(chipBar);

    function trackBox() {
      const sr = slider.getBoundingClientRect();
      const tr = track.getBoundingClientRect();
      return { left: tr.left - sr.left, width: Math.max(1, tr.width), sr };
    }
    let shownH = -1;
    function setHandle() {
      if (Math.abs(pH - shownH) < 0.0004) return;
      shownH = pH;
      handle.style.left = `calc(24px + (100% - 48px) * ${pH.toFixed(4)})`;
      const yrs = yearsOf(pH);
      slider.setAttribute('aria-valuenow', String(Math.round(pH * 100)));
      slider.setAttribute('aria-valuetext', TEXTES.ans.replace('{n}', lib.num(roundNice(yrs))));
    }

    api.track(slider, {
      down(p) {
        const tb = trackBox();
        const hx = tb.left + pH * tb.width;
        dragging = true;
        slider.classList.add('is-active');
        if (Math.abs(p.x - hx) < 30) {
          dragOff = p.x - hx;
        } else {
          dragOff = 0;
          pT = clamp((p.x - tb.left) / tb.width);
        }
        api.sfx.play('tick', { pitch: 1.2 });
      },
      move(p) {
        if (!dragging) return;
        const tb = trackBox();
        pT = clamp((p.x - dragOff - tb.left) / tb.width);
        pH = pT;
      },
      up() {
        dragging = false;
        slider.classList.remove('is-active');
      },
    }, { touchAction: 'pan-y' });

    slider.addEventListener('keydown', (e) => {
      let d = 0;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') d = -0.05;
      else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') d = 0.05;
      else if (e.key === 'PageDown') d = -0.2;
      else if (e.key === 'PageUp') d = 0.2;
      else if (e.key === 'Home') d = -1;
      else if (e.key === 'End') d = 1;
      else return;
      e.preventDefault();
      pT = clamp(pT + d);
      api.gesture(null);
    });

    /* une tape sur le graphique : petite onde, et la poignée s'anime pour montrer quoi faire */
    api.track(cv.canvas, {
      up(p, e, cancelled) {
        if (cancelled || !p.tap) return;
        rings.push({ x: p.x, y: p.y, t: 0 });
        if (rings.length > 6) rings.shift();
        pulse = 1;
        api.sfx.play('tick', { pitch: 0.9 });
      },
    }, { touchAction: 'pan-y' });

    /* ---- fond pré-rendu : panneau, quadrillage, graduations ---- */
    function pebbleRect(g, x, y, w, h, r) {
      const a = r * 1.1, b = r * 0.8, c = r * 1.25, d = r * 0.9;
      g.beginPath();
      g.moveTo(x + a, y);
      g.lineTo(x + w - b, y);
      g.quadraticCurveTo(x + w, y, x + w, y + b);
      g.lineTo(x + w, y + h - c);
      g.quadraticCurveTo(x + w, y + h, x + w - c, y + h);
      g.lineTo(x + d, y + h);
      g.quadraticCurveTo(x, y + h, x, y + h - d);
      g.lineTo(x, y + a);
      g.quadraticCurveTo(x, y, x + a, y);
      g.closePath();
    }

    function makeBg(w, h) {
      const c = document.createElement('canvas');
      c.width = Math.round(w * cv.dpr);
      c.height = Math.round(h * cv.dpr);
      const g = c.getContext('2d');
      g.scale(cv.dpr, cv.dpr);
      g.fillStyle = COL.stage;
      g.fillRect(0, 0, w, h);
      /* fumées très douces dans le fond */
      lib.draw.glow(g, w * 0.85, h * 0.1, Math.max(w, h) * 0.6, '#3A2A2E', 0.35);
      lib.draw.glow(g, w * 0.1, h * 0.9, Math.max(w, h) * 0.55, '#232A36', 0.4);
      /* le panneau du graphique, en forme de galet, grain de béton */
      g.save();
      g.shadowColor = 'rgba(0,0,0,0.5)';
      g.shadowBlur = 14;
      g.shadowOffsetY = 5;
      pebbleRect(g, geo.px, geo.py, geo.pw, geo.ph, 16);
      g.fillStyle = COL.panel;
      g.fill();
      g.restore();
      g.save();
      pebbleRect(g, geo.px, geo.py, geo.pw, geo.ph, 16);
      g.clip();
      const n = lib.makeNoise(9);
      for (let i = 0; i < geo.pw * geo.ph * 0.05; i++) {
        g.fillStyle = n.rnd() < 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.12)';
        g.fillRect(geo.px + n.rnd() * geo.pw, geo.py + n.rnd() * geo.ph, 1.2, 1.2);
      }
      g.restore();
      pebbleRect(g, geo.px + 0.5, geo.py + 0.5, geo.pw - 1, geo.ph - 1, 16);
      g.strokeStyle = 'rgba(241,241,243,0.08)';
      g.lineWidth = 1;
      g.stroke();
      /* quadrillage : filets pleins et discrets */
      g.strokeStyle = 'rgba(241,241,243,0.11)';
      g.lineWidth = 1;
      g.beginPath();
      TICKS.forEach((v) => {
        const y = Math.round(yOf(v)) + 0.5;
        g.moveTo(geo.x0, y);
        g.lineTo(geo.x1, y);
      });
      g.stroke();
      /* graduations */
      g.fillStyle = COL.muted;
      g.font = font(12, 700);
      g.textAlign = 'right';
      g.textBaseline = 'middle';
      TICKS.forEach((v) => g.fillText(String(v), geo.x0 - 8, yOf(v)));
      /* le plus haut niveau naturel : 300 ppm, en pointillés */
      const y3 = Math.round(yOf(300)) + 0.5;
      g.strokeStyle = rgba(COL.accent2, 0.85);
      g.lineWidth = 1.5;
      g.setLineDash([6, 5]);
      g.beginPath();
      g.moveTo(geo.x0, y3);
      g.lineTo(geo.x1, y3);
      g.stroke();
      g.setLineDash([]);
      g.font = font(11.5, 700);
      g.textAlign = 'left';
      g.textBaseline = 'alphabetic';
      const tw = g.measureText(TEXTES.seuil).width;
      g.fillStyle = COL.panel;
      g.globalAlpha = 0.85;
      lib.draw.roundRect(g, geo.x0 + 4, y3 - 19, tw + 10, 16, 6);
      g.fill();
      g.globalAlpha = 1;
      g.fillStyle = COL.fg;
      g.fillText(TEXTES.seuil, geo.x0 + 9, y3 - 7);
      return c;
    }

    function layout(w, h) {
      /* taille transitoire (scène pas encore mise en page) : on attend la vraie */
      if (w < 120 || h < 220) return;
      geo.ok = true;
      geo.w = w;
      geo.h = h;
      geo.px = 10;
      geo.py = 10;
      geo.pw = w - 20;
      geo.ph = h - 10 - 128;
      geo.x0 = geo.px + 46;
      geo.x1 = geo.px + geo.pw - 16;
      geo.y0 = geo.py + 40;
      geo.y1 = geo.py + geo.ph - 30;
      geo.sliderY = h - 62 - 26;
      areaNat = ctx.createLinearGradient(0, geo.y0, 0, geo.y1);
      areaNat.addColorStop(0, rgba(COL.nat, 0.16));
      areaNat.addColorStop(1, rgba(COL.nat, 0.02));
      areaInd = ctx.createLinearGradient(0, geo.y0, 0, geo.y1);
      areaInd.addColorStop(0, rgba(COL.accent, 0.2));
      areaInd.addColorStop(1, rgba(COL.accent, 0.03));
      title.style.left = Math.round(geo.px + 14) + 'px';
      title.style.top = Math.round(geo.py + 11) + 'px';
      chipBar.classList.toggle('tp-roomy', w >= 360);
      bg = makeBg(w, h);
      if (pendingGesture) {
        pendingGesture = false;
        showGesture();
      }
    }
    cv.onResize(layout);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        FAM = getComputedStyle(document.body).fontFamily;
        if (geo.w > 1) bg = makeBg(geo.w, geo.h);
      });
    }

    /* ---- déroulé ---- */
    function setProgress(p) {
      const q = Math.round(p * 100);
      if (q === shownProg) return;
      shownProg = q;
      api.progress(q / 100);
    }

    function init() {
      pT = pH = 1;
      logW = Math.log10(200);
      dragging = false;
      seen = {};
      dwell = {};
      nSeen = 0;
      statusView = null;
      ghostOn = false;
      ghostT = 0;
      doneSent = false;
      shownProg = -1;
      pulse = 0;
      rings.length = 0;
      slider.classList.remove('is-active');
      VIEWS.forEach((v) => {
        v.chip.classList.remove('is-seen', 'is-hint');
        v.chip.setAttribute('aria-label', v.label);
      });
      shownH = -1;
      setHandle();
      setProgress(0);
      api.status('');
      if (geo.ok) showGesture();
      else pendingGesture = true;
    }
    function showGesture() {
      const tb = { left: 14 + 24, width: geo.w - 28 - 48 };
      api.gesture('drag', { x: ((tb.left + tb.width) / geo.w) * 100, y: (geo.sliderY / geo.h) * 100, dx: -Math.round(tb.width * 0.55), dy: 0 });
    }

    function markSeen(v) {
      seen[v.key] = true;
      nSeen++;
      v.chip.classList.add('is-seen');
      v.chip.classList.remove('is-hint');
      v.chip.setAttribute('aria-label', v.label + TEXTES.vue);
      api.sfx.play('chime', { pitch: 0.9 + nSeen * 0.12 });
      api.buzz(8);
      if (!doneSent) setProgress(0.3 * nSeen);
      const left = VIEWS.filter((x) => !seen[x.key]);
      if (nSeen === 2 && left.length === 1) {
        api.hint(TEXTES.encore.replace('{v}', left[0].label));
        left[0].chip.classList.add('is-hint');
      }
      if (nSeen === 3 && !ghostOn) {
        ghostOn = true;
        ghostT = 0;
        api.status(TEXTES.fantome);
        api.guide(null, 'wow');
      }
    }

    /* ---- animation ---- */
    function update(dt) {
      time += dt;
      pulse = Math.max(0, pulse - dt * 1.2);
      if (!dragging) {
        const d = pT - pH;
        pH = Math.abs(d) < 0.001 ? pT : pH + d * (1 - Math.exp(-dt * (RMO ? 30 : 9)));
      }
      setHandle();
      const target = lerp(L800, L200, pH);
      logW += (target - logW) * (1 - Math.exp(-dt * (RMO ? 30 : 6)));
      /* quelle vue regarde-t-on ? */
      let near = null;
      for (const v of VIEWS) {
        const dl = Math.abs(logW - Math.log10(v.years));
        if (dl < 0.1) {
          near = v;
          dwell[v.key] = (dwell[v.key] || 0) + dt;
          if (!seen[v.key] && dwell[v.key] > 0.7) markSeen(v);
        } else {
          dwell[v.key] = 0;
        }
      }
      const quiet = ghostOn && ghostT < 4;
      if (near && near !== statusView && !quiet) {
        statusView = near;
        api.status(near.status);
      }
      if (ghostOn) {
        ghostT += dt;
        if (!doneSent && ghostT > 3.4) {
          doneSent = true;
          statusView = near;
          api.done(TEXTES.fin, TEXTES.finStatut);
        }
      }
      for (let i = rings.length - 1; i >= 0; i--) {
        rings[i].t += dt;
        if (rings[i].t > 0.6) rings.splice(i, 1);
      }
    }

    function render() {
      const { w, h } = geo;
      if (bg) ctx.drawImage(bg, 0, 0, w, h);
      const W = Math.pow(10, logW);
      const gk = ghostOn ? ease.inOutCubic(clamp(ghostT / 1)) : 0;
      const gd = ghostOn ? ease.outCubic(clamp((ghostT - 0.8) / 1.6)) : 0;
      const xNow = lerp(geo.x1, geo.x0 + (geo.x1 - geo.x0) * 0.7, gk);
      const span = xNow - geo.x0;
      const xOf = (t) => xNow - (t / W) * span;

      ctx.save();
      ctx.beginPath();
      ctx.rect(geo.x0 - 1, geo.py + 4, geo.x1 - geo.x0 + 12, geo.ph - 8);
      ctx.clip();
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      /* la partie naturelle (bulles d'air de la glace) */
      const tSplit = Math.min(W, 200);
      if (W > 200) {
        const xs = xOf(200);
        const nS = Math.max(2, Math.ceil((xs - geo.x0) / 1.5));
        ctx.beginPath();
        for (let i = 0; i <= nS; i++) {
          const t = lerp(W, 200, i / nS);
          const x = xOf(t), y = yOf(co2(t));
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.lineTo(xs, geo.y1);
        ctx.lineTo(geo.x0, geo.y1);
        ctx.closePath();
        ctx.fillStyle = areaNat;
        ctx.fill();
        ctx.beginPath();
        for (let i = 0; i <= nS; i++) {
          const t = lerp(W, 200, i / nS);
          const x = xOf(t), y = yOf(co2(t));
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = COL.nat;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      /* la flambée récente */
      const xa = xOf(tSplit);
      const nI = Math.max(2, Math.ceil((xNow - xa) / 1.5));
      ctx.beginPath();
      for (let i = 0; i <= nI; i++) {
        const t = lerp(tSplit, 0, i / nI);
        const x = xOf(t), y = yOf(co2(t));
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.lineTo(xNow, geo.y1);
      ctx.lineTo(xa, geo.y1);
      ctx.closePath();
      ctx.fillStyle = areaInd;
      ctx.fill();
      ctx.beginPath();
      for (let i = 0; i <= nI; i++) {
        const t = lerp(tSplit, 0, i / nI);
        const x = xOf(t), y = yOf(co2(t));
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = rgba(COL.accent, 0.25);
      ctx.lineWidth = 7;
      ctx.stroke();
      ctx.strokeStyle = COL.accent;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      /* le futur, en fantôme : le thermostat des roches */
      if (ghostOn && gd > 0) {
        const F = W * ((geo.x1 - xNow) / span) * gd;
        const nG = Math.max(2, Math.ceil(((geo.x1 - xNow) * gd) / 2));
        ctx.beginPath();
        for (let i = 0; i <= nG; i++) {
          const f = (F * i) / nG;
          const x = xNow + (f / W) * span, y = yOf(ghost(f));
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.setLineDash([6, 6]);
        ctx.lineDashOffset = RMO ? 0 : -time * 10;
        ctx.strokeStyle = rgba(COL.rock, 0.9);
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.restore();
      /* « aujourd'hui » : un filet vertical quand le futur apparaît */
      if (gk > 0) {
        ctx.strokeStyle = rgba(COL.fg, 0.16 * gk);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(Math.round(xNow) + 0.5, geo.y0 - 6);
        ctx.lineTo(Math.round(xNow) + 0.5, geo.y1);
        ctx.stroke();
      }
      /* le point d'aujourd'hui, avec son anneau couleur du fond */
      const yN = yOf(co2(0));
      const pr = RMO ? 0 : (time * 0.8) % 1;
      ctx.strokeStyle = rgba(COL.accent, 0.5 * (1 - pr));
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(xNow, yN, 6 + pr * 12, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = COL.panel;
      ctx.beginPath();
      ctx.arc(xNow, yN, 6.5, 0, TAU);
      ctx.fill();
      ctx.fillStyle = COL.accent;
      ctx.beginPath();
      ctx.arc(xNow, yN, 4.5, 0, TAU);
      ctx.fill();
      /* graduations du temps */
      ctx.font = font(12, 600);
      ctx.fillStyle = COL.muted;
      ctx.textBaseline = 'alphabetic';
      const ly = geo.y1 + 19;
      ctx.textAlign = 'left';
      ctx.fillText(TEXTES.ilya.replace('{n}', lib.num(roundNice(W))), geo.x0, ly);
      ctx.textAlign = gk > 0.5 ? 'center' : 'right';
      ctx.fillStyle = COL.fg;
      ctx.fillText(TEXTES.aujourdhui, gk > 0.5 ? xNow : geo.x1 + 4, ly);
      /* petite onde quand on touche le graphique */
      for (const r of rings) {
        const k = r.t / 0.6;
        ctx.strokeStyle = rgba(COL.fg, 0.6 * (1 - k));
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(r.x, r.y, 6 + 26 * ease.outCubic(k), 0, TAU);
        ctx.stroke();
      }
      /* la poignée « respire » pour montrer où agir */
      if (pulse > 0) handle.style.transform = `scale(${1 + 0.12 * Math.sin(pulse * Math.PI)})`;
      else if (handle.style.transform) handle.style.transform = '';
    }

    api.loop((dt) => {
      if (!geo.ok) return;
      update(dt);
      render();
    });

    api.onReset(init);
    init();
    if (geo.ok) {
      update(0.016);
      render();
    }
  };
})();
