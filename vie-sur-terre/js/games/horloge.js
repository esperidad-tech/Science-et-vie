/* Toute l'histoire de la Terre ramenée à une journée de 24 heures.
   On fait tourner l'aiguille (ou on passe d'un événement à l'autre) pour lire l'heure de chaque étape. */
(function () {
  'use strict';
  const { lib } = window.RM;
  const { clamp, ease } = lib;

  const AGE = 4.54e9;
  const NS = 'http://www.w3.org/2000/svg';

  /* Âges en années. L'heure est calculée : 0 h = naissance de la Terre, 24 h = aujourd'hui. */
  const EVENTS = [
    { ga: 4.54e9, title: 'La Terre se forme', note: 'Un amas de poussières devient une boule de roche en fusion.' },
    { ga: 4.5e9, title: 'La Lune naît', note: 'Les débris du choc avec Théia se rassemblent.' },
    { ga: 4.4e9, title: 'Les premiers océans', note: 'La vapeur des volcans retombe en pluie.' },
    { ga: 3.8e9, title: 'Premiers indices de vie', note: 'Des traces encore discutées par les scientifiques.' },
    { ga: 3.48e9, title: 'Premiers stromatolithes', note: 'Des tapis de microbes bâtissent des roches en couches : les plus vieilles traces sûres de vie.' },
    { ga: 2.4e9, title: 'La Grande Oxydation', note: 'L’oxygène des cyanobactéries envahit l’air.' },
    { ga: 1.65e9, title: 'Premières cellules à noyau', note: 'Les lointains ancêtres des algues, des champignons et des animaux.' },
    { ga: 5.75e8, title: 'Premiers animaux', note: 'Des êtres mous, sans squelette, au fond des mers.' },
    { ga: 4.7e8, title: 'Les plantes sortent de l’eau', note: 'Lichens et mousses préparent les premiers sols.' },
    { ga: 2.3e8, title: 'Premiers dinosaures', note: 'Ils vont vivre plus de 160 millions d’années, et régner sur la terre ferme pendant plus de 130.' },
    { ga: 9.0e7, title: 'La craie d’Étretat', note: 'Du plancton s’empile au fond d’une mer chaude.' },
    { ga: 6.6e7, title: 'Fin des dinosaures', note: 'Un astéroïde géant percute la Terre.' },
    { ga: 3.0e5, title: 'Homo sapiens', note: 'Six secondes avant minuit. Toute l’histoire écrite tient dans le dernier dixième de seconde.', last: true },
  ].map((e) => ({ ...e, f: 1 - e.ga / AGE }));

  /* Éons pour l'anneau, aux couleurs de l'échelle des temps géologiques */
  const EONS = [
    { name: 'Hadéen', from: 4.54e9, to: 4.0e9, color: '#AE027E' },
    { name: 'Archéen', from: 4.0e9, to: 2.5e9, color: '#F0047F' },
    { name: 'Protérozoïque', from: 2.5e9, to: 5.39e8, color: '#F73563' },
    { name: 'Paléozoïque', from: 5.39e8, to: 2.52e8, color: '#99C08D' },
    { name: 'Mésozoïque', from: 2.52e8, to: 6.6e7, color: '#67C5CA' },
    { name: 'Cénozoïque', from: 6.6e7, to: 0, color: '#F2F91D' },
  ];

  function svg(tag, attrs, parent) {
    const el = document.createElementNS(NS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  }

  const C = 200; /* centre du viewBox */
  const R = 166; /* rayon de l'anneau */

  function pt(f, r) {
    const a = f * Math.PI * 2;
    return [C + Math.sin(a) * r, C - Math.cos(a) * r];
  }
  function arc(f0, f1, r) {
    const [x0, y0] = pt(f0, r);
    const [x1, y1] = pt(f1, r);
    const large = f1 - f0 > 0.5 ? 1 : 0;
    return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  }

  function clock(f) {
    const total = clamp(f) * 86400;
    let h = Math.floor(total / 3600);
    let m = Math.floor((total % 3600) / 60);
    const s = Math.floor(total % 60);
    if (h >= 24) { h = 23; m = 59; }
    const hh = String(h).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    if (h === 23 && m === 59) return `${hh} h ${mm} min ${String(s).padStart(2, '0')} s`;
    return `${hh} h ${mm}`;
  }

  function ago(years) {
    if (years < 0.5) return 'aujourd’hui';
    if (years >= 1e9) {
      const v = Math.round(years / 1e7) / 100;
      return `il y a ${v.toLocaleString('fr-FR')} milliard${v >= 2 ? 's' : ''} d’années`;
    }
    if (years >= 1e6) {
      const v = Math.round(years / 1e6);
      return `il y a ${v.toLocaleString('fr-FR')} million${v >= 2 ? 's' : ''} d’années`;
    }
    const v = Math.round(years / 1000) * 1000;
    return `il y a ${v.toLocaleString('fr-FR')} ans`;
  }

  function eonAt(years) {
    return EONS.find((e) => years <= e.from && years > e.to) || EONS[EONS.length - 1];
  }

  window.RM.games.horloge = function (api) {
    const stage = api.stage;
    api.style(`
      .game[data-game="horloge"] .game-stage { display: grid; place-items: center; }
      .game[data-game="horloge"] .hc-svg { position: absolute; inset: 0; width: 100%; height: 100%; touch-action: none; cursor: grab; }
      .game[data-game="horloge"] .hc-svg:active { cursor: grabbing; }
      .game[data-game="horloge"] .hc-card {
        position: relative; z-index: 2; width: 46%; max-width: 13rem; text-align: center;
        pointer-events: none; display: grid; gap: 0.2rem; justify-items: center;
      }
      .game[data-game="horloge"] .hc-time {
        font-family: var(--font-display); font-weight: 800; font-variation-settings: "SOFT" 100, "opsz" 72;
        font-size: clamp(1.7rem, 7.2vw, 2.6rem); line-height: 1; letter-spacing: -0.02em;
        font-variant-numeric: lining-nums tabular-nums; color: var(--accent);
      }
      .game[data-game="horloge"] .hc-title { font-weight: 800; font-size: clamp(0.98rem, 3.9vw, 1.15rem); line-height: 1.25; margin-top: 0.25rem; }
      .game[data-game="horloge"] .hc-ago { color: var(--muted); font-size: clamp(0.8rem, 3.3vw, 0.95rem); line-height: 1.3; }
      .game[data-game="horloge"] .hc-note { font-size: clamp(0.78rem, 3.2vw, 0.92rem); line-height: 1.35; margin-top: 0.3rem; color: var(--fg); }
      .game[data-game="horloge"] .hc-nav { display: flex; gap: 10px; justify-content: space-between; }
      .game[data-game="horloge"] .hc-nav .chip { flex: 1; background: var(--panel); color: var(--fg); box-shadow: inset 0 0 0 1px var(--line); }
      .game[data-game="horloge"] .hc-mark { cursor: pointer; }
    `);

    /* ---- cadran ---- */
    const root = svg('svg', { viewBox: '0 0 400 400', class: 'hc-svg', 'aria-hidden': 'true' });
    stage.appendChild(root);
    svg('circle', { cx: C, cy: C, r: 188, fill: 'rgba(255,255,255,0.025)' }, root);
    svg('circle', { cx: C, cy: C, r: R - 22, fill: 'rgba(9,20,33,0.85)', stroke: 'rgba(234,242,251,0.08)', 'stroke-width': 1 }, root);

    /* anneau des éons (épaisseur réelle de chaque éon dans la journée) */
    const ring = svg('g', {}, root);
    EONS.forEach((e) => {
      const f0 = 1 - e.from / AGE;
      const f1 = 1 - e.to / AGE;
      svg('path', { d: arc(f0, Math.min(f1, 0.99999), R), stroke: e.color, 'stroke-width': 22, fill: 'none' }, ring);
    });
    /* graduations des heures */
    const ticks = svg('g', { stroke: 'rgba(234,242,251,0.45)', 'stroke-linecap': 'round' }, root);
    for (let h = 0; h < 24; h++) {
      const f = h / 24;
      const big = h % 6 === 0;
      const [x0, y0] = pt(f, R - 30);
      const [x1, y1] = pt(f, R - (big ? 42 : 36));
      svg('line', { x1: x0, y1: y0, x2: x1, y2: y1, 'stroke-width': big ? 2.5 : 1.5 }, ticks);
      if (big && h > 0) {
        const [tx, ty] = pt(f, R - 56);
        const t = svg('text', {
          x: tx, y: ty + 5, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700,
          fill: 'rgba(234,242,251,0.7)', 'font-family': 'Atkinson Hyperlegible Next, system-ui, sans-serif',
        }, root);
        t.textContent = `${h} h`;
      }
    }

    /* repères d'événements */
    const marks = EVENTS.map((e, i) => {
      if (e.last) return null;
      const [x, y] = pt(e.f, R);
      const g = svg('g', { class: 'hc-mark', 'data-i': i }, root);
      svg('circle', { cx: x, cy: y, r: 16, fill: 'transparent' }, g);
      const dot = svg('circle', { cx: x, cy: y, r: 5.5, fill: '#FFFFFF', stroke: '#091421', 'stroke-width': 2.5 }, g);
      return { g, dot };
    });

    /* petits dessins posés sur le bord de l'anneau, à l'heure exacte de leur événement :
       le premier dinosaure, l'astéroïde, un humain (mêmes formes et couleurs que le jeu « dinos ») */
    (function drawPics() {
      const pics = svg('g', { class: 'hc-pics', 'aria-hidden': 'true', 'pointer-events': 'none' }, root);
      const defs = svg('defs', {}, pics);
      const at = (ga, r, s, flip) => {
        const f = 1 - ga / AGE;
        const [x, y] = pt(f, r);
        return `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${(f * 360).toFixed(2)}) scale(${flip ? -s : s} ${s})`;
      };
      /* forme de membre : deux cercles reliés par leurs tangentes */
      const capsule = (x1, y1, r1, x2, y2, r2) => {
        const a = Math.atan2(y2 - y1, x2 - x1);
        const off = Math.acos(clamp((r1 - r2) / Math.hypot(x2 - x1, y2 - y1), -1, 1));
        const p = (x, y, r, t) => `${(x + Math.cos(t) * r).toFixed(2)} ${(y + Math.sin(t) * r).toFixed(2)}`;
        return `M ${p(x1, y1, r1, a + off)} A ${r1} ${r1} 0 1 1 ${p(x1, y1, r1, a - off)} L ${p(x2, y2, r2, a - off)} A ${r2} ${r2} 0 0 1 ${p(x2, y2, r2, a + off)} Z`;
      };
      /* tous les contours d'abord, puis tous les remplissages : un seul trait autour des membres */
      const limbs = (g, parts, fill, line, sw) => {
        const gs = svg('g', { fill: 'none', stroke: line, 'stroke-width': sw, 'stroke-linejoin': 'round' }, g);
        const gf = svg('g', { fill }, g);
        parts.forEach((c) => {
          const d = capsule(...c);
          svg('path', { d }, gs);
          svg('path', { d }, gf);
        });
      };
      const shape = (g, d, fill, line, sw) => svg('path', { d, fill, stroke: line, 'stroke-width': sw, 'stroke-linejoin': 'round', 'paint-order': 'stroke' }, g);
      const oval = (g, cx, cy, rx, ry, fill, line, sw) => svg('ellipse', { cx, cy, rx, ry, fill, stroke: line, 'stroke-width': sw, 'paint-order': 'stroke' }, g);
      const grad = (id, attrs, stops) => {
        const gr = svg(attrs.r ? 'radialGradient' : 'linearGradient', Object.assign({ id, gradientUnits: 'userSpaceOnUse' }, attrs), defs);
        stops.forEach(([o, c, a]) => svg('stop', { offset: o, 'stop-color': c, 'stop-opacity': a == null ? 1 : a }, gr));
      };

      /* le petit dinosaure coureur, debout sur l'anneau, tourné vers minuit */
      const DS = 0.26, DW = 2 * 0.8 / (DS * 0.9), DL = '#774921';
      const BODY = 'M 29 -71 C 25 -64 21 -59 14 -57 C 4 -56 -6 -54 -14 -50 C -30 -46 -48 -47 -70 -52 C -75 -53 -76 -48.5 -71 -48 C -50 -41 -32 -34 -16 -30 C -6 -24 12 -24 22 -32 C 27 -36 30 -42 32 -50 C 34 -56 37 -61 41 -64 Z';
      const HEAD = 'M 30 -70 C 30 -80 40 -86 49 -84 C 56 -82 60 -76 61 -71 C 62 -66 60 -63.5 56 -63 C 50 -62 42 -62 37 -64 C 32 -65 30 -67 30 -70 Z';
      grad('hc-pic-dg', { x1: 0, y1: -86, x2: 0, y2: -20 }, [[0, '#FFB874'], [0.45, '#FF9E45'], [1, '#C6803C']]);
      svg('path', { d: BODY }, svg('clipPath', { id: 'hc-pic-dc' }, defs));
      const dino = svg('g', { transform: at(2.3e8, 178.5, DS) }, pics);
      limbs(dino, [[-1, -36, 8.4, 0.5, -19, 3.8], [0.5, -19, 3.8, -5, -4, 3], [-5, -4, 3, 3, -2.3, 2.3]], '#B7783A', DL, DW);
      limbs(dino, [[19, -42, 2.6, 21.2, -35.4, 2.1], [21.2, -35.4, 2.1, 27.1, -34.2, 1.6]], '#B7783A', DL, DW);
      shape(dino, BODY, 'url(#hc-pic-dg)', DL, DW);
      const belly = svg('g', { 'clip-path': 'url(#hc-pic-dc)' }, dino);
      svg('ellipse', { cx: 6, cy: -27, rx: 21, ry: 8.5, fill: '#FFE6B8' }, belly);
      [[-4, -51, 4.2, 2.4], [8, -53, 3.2, 2], [-18, -47, 3.6, 2.1], [-33, -46, 2.8, 1.6]].forEach(([cx, cy, rx, ry]) => {
        svg('ellipse', { cx, cy, rx, ry, fill: '#E0762A' }, belly);
      });
      limbs(dino, [[2, -35, 8.4, 9, -19.5, 3.8], [9, -19.5, 3.8, 5, -4, 3], [5, -4, 3, 13, -2.3, 2.3]], 'url(#hc-pic-dg)', DL, DW);
      shape(dino, HEAD, 'url(#hc-pic-dg)', DL, DW);
      svg('ellipse', { cx: 49, cy: -67.5, rx: 3.4, ry: 2.1, fill: 'rgba(255,118,128,0.45)' }, dino);
      svg('ellipse', { cx: 44, cy: -74, rx: 6.6, ry: 7.1, fill: '#FFFDF4', stroke: DL, 'stroke-width': DW * 0.45 }, dino);
      svg('ellipse', { cx: 44.8, cy: -73.2, rx: 4.3, ry: 4.7, fill: '#1E120A' }, dino);
      svg('circle', { cx: 43.2, cy: -75.4, r: 1.7, fill: '#FFFFFF' }, dino);
      svg('path', { d: 'M 50.5 -65.4 Q 54.5 -63.4 58.6 -65.8', fill: 'none', stroke: DL, 'stroke-width': DW * 0.6, 'stroke-linecap': 'round' }, dino);
      limbs(dino, [[22, -41, 2.6, 24.2, -34.4, 2.1], [24.2, -34.4, 2.1, 30.1, -33.2, 1.6]], 'url(#hc-pic-dg)', DL, DW);

      /* l'astéroïde qui file vers l'anneau, avec sa traînée de feu */
      grad('hc-pic-at', { x1: -7.6, y1: -15.1, x2: 0, y2: 0 }, [[0, '#FF5A1E', 0], [0.6, '#FF9640', 0.75], [1, '#FFF4CC', 1]]);
      grad('hc-pic-ah', { cx: 0.5, cy: 0.5, r: 9.5 }, [[0, '#FFB14A', 0.9], [1, '#FFB14A', 0]]);
      const ast = svg('g', { transform: at(6.6e7, 186.5, 1) }, pics);
      svg('path', { d: 'M 3.9 -1.9 L -7.6 -15.1 L -3.9 1.9 Z', fill: 'url(#hc-pic-at)' }, ast);
      svg('circle', { cx: 0.5, cy: 0.5, r: 9.5, fill: 'url(#hc-pic-ah)' }, ast);
      shape(ast, 'M -4.4 -0.6 C -4.2 -3.6 -1.2 -4.8 1.4 -4.3 C 3.9 -3.8 4.8 -1.2 4.4 1.4 C 4 3.9 1.3 4.8 -1.3 4.4 C -3.6 4 -4.6 2 -4.4 -0.6 Z', '#5B3A2A', '#3A2418', 0.9);
      svg('ellipse', { cx: 1.7, cy: 1.5, rx: 2.3, ry: 1.9, fill: '#FFB45A' }, ast);
      svg('ellipse', { cx: 2.3, cy: 2.1, rx: 1.1, ry: 0.9, fill: '#FFF0C0' }, ast);
      svg('circle', { cx: -1.6, cy: -1.4, r: 0.85, fill: '#46301F' }, ast);

      /* un humain, tout en haut, juste avant minuit, qui se retourne vers les dinosaures */
      const HS = 0.215, HW = 2 * 0.75 / (HS * 0.9);
      const SKIN = '#B07850', SKIND = '#8C5E40', HAIR = '#24170F', CLOTH = '#E2B062', CLOTHD = '#A88046', HL = '#4B3120';
      grad('hc-pic-hh', { cx: 0, cy: -52, r: 64 }, [[0, '#FFD27A', 0.5], [1, '#FFD27A', 0]]);
      const hum = svg('g', { transform: at(3.0e5, 176.5, HS, true) }, pics);
      svg('circle', { cx: 0, cy: -52, r: 64, fill: 'url(#hc-pic-hh)' }, hum);
      limbs(hum, [[-3, -40, 5, -4, -5, 4.2]], SKIND, HL, HW);
      oval(hum, -1.5, -2.6, 5.2, 2.7, SKIND, HL, HW);
      limbs(hum, [[4, -40, 5.2, 5, -5, 4.4]], SKIN, HL, HW);
      oval(hum, 7.5, -2.6, 5.4, 2.8, SKIN, HL, HW);
      limbs(hum, [[-5, -68, 3.8, -8, -50, 3.2], [-8, -50, 3.2, -7, -38, 3]], SKIND, HL, HW);
      shape(hum, 'M -9 -72 C -11 -60 -10 -50 -9 -44 L 9 -44 C 10 -52 10 -62 8 -72 C 4 -75 -5 -75 -9 -72 Z', SKIN, HL, HW);
      shape(hum, 'M -10 -50 C -11 -40 -12 -32 -11 -24 Q 0 -20 11 -25 C 11 -32 10 -42 9 -50 Z', CLOTH, HL, HW);
      shape(hum, 'M -8 -72 L -2 -72 L 9 -50 L 3 -50 Z', CLOTHD, HL, HW * 0.8);
      svg('circle', { cx: -0.6, cy: -86.4, r: 11.2, fill: HAIR }, hum);
      oval(hum, 2, -84, 9.8, 9.8, SKIN, HL, HW);
      svg('path', { d: 'M -7.5 -88 C -6 -97 4 -99 10 -92 C 6 -95 -1 -95 -3 -88 Z', fill: HAIR }, hum);
      svg('circle', { cx: 6.8, cy: -85.2, r: 1.7, fill: '#1C120C' }, hum);
      svg('path', { d: 'M 5.4 -79.6 Q 7.4 -78 9.2 -80', fill: 'none', stroke: HL, 'stroke-width': HW * 0.5, 'stroke-linecap': 'round' }, hum);
      limbs(hum, [[5, -68, 4, 6.6, -55.1, 3.4], [6.6, -55.1, 3.4, 8.1, -43.2, 3]], SKIN, HL, HW);
    })();

    /* aiguille */
    const hand = svg('g', {}, root);
    /* l'aiguille part du bord du cadran pour laisser le centre lisible */
    svg('line', { x1: C, y1: C - 118, x2: C, y2: C - (R - 14), stroke: 'var(--fg)', 'stroke-width': 4, 'stroke-linecap': 'round' }, hand);
    svg('circle', { cx: C, cy: C - R, r: 15, fill: 'var(--accent)', stroke: '#091421', 'stroke-width': 3 }, hand);

    /* carte centrale */
    const card = document.createElement('div');
    card.className = 'hc-card';
    card.setAttribute('aria-live', 'polite');
    card.innerHTML = '<div class="hc-time"></div><div class="hc-title"></div><div class="hc-ago"></div><div class="hc-note"></div>';
    stage.appendChild(card);
    const elTime = card.querySelector('.hc-time');
    const elTitle = card.querySelector('.hc-title');
    const elAgo = card.querySelector('.hc-ago');
    const elNote = card.querySelector('.hc-note');

    /* boutons précédent / suivant sous le cadran */
    const nav = document.createElement('div');
    nav.className = 'hc-nav';
    nav.innerHTML = '<button type="button" class="chip hc-prev" aria-label="Événement précédent">Précédent</button><button type="button" class="chip hc-next" aria-label="Événement suivant">Suivant</button>';
    stage.insertAdjacentElement('afterend', nav);
    const btnPrev = nav.querySelector('.hc-prev');
    const btnNext = nav.querySelector('.hc-next');

    /* ---- état ---- */
    let f = 0;          /* position de l'aiguille (0 → 1) */
    let anim = null;    /* { from, to, t, dur } */
    let shownKey = '';
    const seen = new Set();

    function nearestEvent(pos) {
      if (pos > 0.9975) return EVENTS.length - 1; /* les dernières minutes appartiennent aux humains */
      let best = -1;
      let bd = 1;
      EVENTS.forEach((e, i) => {
        if (e.last) return;
        const d = Math.abs(e.f - pos);
        if (d < bd) { bd = d; best = i; }
      });
      return bd < 0.0042 ? best : -1; /* ± 6 minutes */
    }

    function show() {
      const i = nearestEvent(f);
      const key = i >= 0 ? 'e' + i : 't' + Math.round(f * 1440);
      if (key === shownKey) return;
      shownKey = key;
      if (i >= 0) {
        const e = EVENTS[i];
        elTime.textContent = clock(e.f);
        elTitle.textContent = lib.fr(e.title);
        elAgo.textContent = ago(e.ga);
        elNote.textContent = lib.fr(e.note);
        if (!seen.has(i)) {
          seen.add(i);
          if (marks[i]) marks[i].dot.setAttribute('fill', 'var(--accent)');
          api.sfx.play('chime', { pitch: 0.8 + i * 0.05 });
          api.buzz(8);
          api.progress(seen.size / EVENTS.length);
          api.status(`Événements découverts : ${seen.size} sur ${EVENTS.length}`);
          if (seen.size === EVENTS.length) {
            api.done('Tu as parcouru toute l’histoire de la Terre.', 'Notre espèce n’occupe que les toutes dernières secondes de cette journée.');
          }
        }
      } else {
        const years = AGE * (1 - f);
        elTime.textContent = clock(f);
        elTitle.textContent = eonAt(years).name;
        elAgo.textContent = ago(years);
        elNote.textContent = '';
      }
    }

    function setF(v) {
      f = clamp(v, 0, 0.99999);
      hand.setAttribute('transform', `rotate(${(f * 360).toFixed(3)} ${C} ${C})`);
      show();
    }

    function goTo(target) {
      anim = { from: f, to: target, t: 0, dur: api.reducedMotion ? 0.01 : 0.65 };
      api.sfx.play('tick');
    }

    function step(dir) {
      api.gesture(null);
      const cur = nearestEvent(f);
      let idx;
      if (dir > 0) {
        idx = EVENTS.findIndex((e, i) => e.f > f + 0.0005 && i !== cur);
        if (idx < 0) idx = EVENTS.length - 1;
      } else {
        idx = -1;
        for (let i = EVENTS.length - 1; i >= 0; i--) {
          if (EVENTS[i].f < f - 0.0005 && i !== cur) { idx = i; break; }
        }
        if (idx < 0) idx = 0;
      }
      const e = EVENTS[idx];
      goTo(e.last ? 0.99999 : e.f);
    }

    btnNext.addEventListener('click', () => step(1));
    btnPrev.addEventListener('click', () => step(-1));

    /* ---- glisser l'aiguille ---- */
    function fromPointer(p) {
      const r = root.getBoundingClientRect();
      const s = r.width / 400;
      const x = (p.x - (r.width / 2)) / s;
      const y = (p.y - (r.height / 2)) / s;
      if (Math.hypot(x, y) < 26) return null;
      let a = Math.atan2(x, -y) / (Math.PI * 2);
      if (a < 0) a += 1;
      return a;
    }
    let lastA = null;
    api.track(root, {
      down(p) {
        anim = null;
        /* tape sur un repère : l'aiguille y saute */
        const v = fromPointer(p);
        if (v == null) return;
        lastA = v;
        let snap = null;
        EVENTS.forEach((e) => {
          if (!e.last && Math.abs(e.f - v) < 0.012) snap = e.f;
        });
        if (snap != null) goTo(snap);
        else setF(v);
      },
      move(p) {
        const v = fromPointer(p);
        if (v == null) return;
        /* on évite les sauts de minuit à 23 h 59 quand on dépasse le haut du cadran */
        if (lastA != null && Math.abs(v - lastA) > 0.5) {
          setF(lastA > 0.5 ? 0.99999 : 0);
          return;
        }
        lastA = v;
        anim = null;
        setF(v);
      },
      up() { lastA = null; },
    }, { touchAction: 'none' });

    /* clavier : flèches pour avancer de 15 minutes */
    stage.tabIndex = 0;
    stage.setAttribute('aria-label', 'Cadran : flèches gauche et droite pour tourner l’aiguille');
    stage.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { setF(f + 1 / 96); e.preventDefault(); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { setF(f - 1 / 96); e.preventDefault(); }
    });

    api.loop((dt) => {
      if (!anim) return;
      anim.t += dt;
      const k = clamp(anim.t / anim.dur);
      setF(anim.from + (anim.to - anim.from) * ease.inOutCubic(k));
      if (k >= 1) anim = null;
    });

    function reset() {
      anim = null;
      seen.clear();
      marks.forEach((m) => m && m.dot.setAttribute('fill', '#FFFFFF'));
      shownKey = '';
      setF(0);
      api.gesture('circle', { x: 50, y: 50, radius: Math.round(stage.clientWidth * 0.36) });
    }
    api.onReset(reset);
    reset();
  };
})();
