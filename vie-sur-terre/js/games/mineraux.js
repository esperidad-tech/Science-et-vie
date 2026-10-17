/* La vie, créatrice de minéraux : un jeu de cartes à balayer. À gauche les minéraux
   qui existaient avant la vie, à droite ceux qui sont nés grâce à elle (grâce à l'oxygène). */
(function () {
  'use strict';
  const { lib } = window.RM;
  const { TAU, rand, clamp, lerp, ease, rgba, mix, draw } = lib;

  /* Les cartes (textes faciles à corriger). vie : true = « Grâce à la vie » (à droite). */
  const MINERAUX = [
    {
      id: 'olivine', nom: 'Olivine', aspect: 'Vert olive, dans les laves.', vie: false,
      explication: 'L’olivine cristallise dans le magma. On en trouve même dans des météorites : elle n’a pas eu besoin de la vie.',
    },
    {
      id: 'malachite', nom: 'Malachite', aspect: 'Vert vif, en bandes.', vie: true,
      explication: 'La malachite naît quand l’oxygène attaque des minerais de cuivre. Sans l’oxygène fabriqué par la vie, pas de malachite.',
    },
    {
      id: 'quartz', nom: 'Quartz', aspect: 'Transparent, en prismes pointus.', vie: false,
      explication: 'Le quartz cristallise dans des roches comme le granite. Il n’a pas eu besoin de la vie.',
    },
    {
      id: 'azurite', nom: 'Azurite', aspect: 'Bleu profond.', vie: true,
      explication: 'Cousine bleue de la malachite, l’azurite est elle aussi un produit de l’oxygène.',
    },
    {
      id: 'feldspath', nom: 'Feldspath', aspect: 'Rose ou blanc, très commun.', vie: false,
      explication: 'Le feldspath est le minéral le plus abondant de la croûte terrestre. Il se forme dans les roches en fusion.',
    },
    {
      id: 'turquoise', nom: 'Turquoise', aspect: 'Bleu-vert, sans transparence.', vie: true,
      explication: 'La turquoise se forme près de la surface, quand de l’eau chargée d’oxygène circule dans les roches.',
    },
  ];

  /* Tous les autres textes du jeu */
  const TEXTES = {
    avant: 'Avant la vie',
    vie: 'Grâce à la vie',
    exact: 'Exact !',
    faux: 'Pas tout à fait…',
    carte: (i, n) => `${i} / ${n}`,
    score: (s, n) => `Score : ${s} / ${n}`,
    fin: (s, n) => `Collection triée : ${s} sur ${n}.`,
    finStatut: 'Avec l’oxygène, la vie a fait apparaître des milliers de minéraux nouveaux.',
    boutonAvant: (nom) => `${nom} : avant la vie`,
    boutonVie: (nom) => `${nom} : grâce à la vie`,
    bienTrie: 'bien trié',
    malTrie: 'à revoir',
  };

  /* Durée d'affichage du bandeau : au moins 2,2 s, un peu plus si le texte est long
     (il se ferme aussi à la tape suivante). */
  const BANDEAU_MIN = 2.2;
  const BANDEAU_PAR_CAR = 0.036;
  const BANDEAU_MAX = 4.5;

  /* Couleur dominante de chaque minéral (halo, étincelles, vignettes) */
  const TEINTE = {
    olivine: '#A9BE3C', malachite: '#3FBF7A', quartz: '#DDEBFA',
    azurite: '#3D6FE6', feldspath: '#EBA48A', turquoise: '#4FD1C0',
  };

  /* ================= Dessin des minéraux (coordonnées normalisées -1..1) ================= */
  /* éclaircit (k > 0) ou assombrit (k < 0) une couleur */
  function shade(hex, k, a = 1) {
    k = clamp(k, -1, 1);
    return k >= 0 ? mix(hex, '#FFFFFF', k, a) : mix(hex, '#000000', -k, a);
  }
  function poly(g, pts) {
    g.beginPath();
    g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.closePath();
  }
  /* Étincelle à quatre branches */
  function glint(g, x, y, r, a) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    draw.glow(g, x, y, r * 1.6, '#FFFFFF', 0.35 * a);
    g.fillStyle = `rgba(255,255,255,${0.95 * a})`;
    g.beginPath();
    g.moveTo(x, y - r);
    g.lineTo(x + r * 0.13, y - r * 0.13);
    g.lineTo(x + r, y);
    g.lineTo(x + r * 0.13, y + r * 0.13);
    g.lineTo(x, y + r);
    g.lineTo(x - r * 0.13, y + r * 0.13);
    g.lineTo(x - r, y);
    g.lineTo(x - r * 0.13, y - r * 0.13);
    g.closePath();
    g.fill();
    g.restore();
  }
  function seeded(seed) {
    let s = seed >>> 0 || 1;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }

  /* Prisme hexagonal vu de côté, posé en (x, y), incliné de ang.
     o.tip : hauteur de la pointe ; o.col : couleur ; o.alpha : transparence (quartz). */
  function prism(g, x, y, ang, a, H, o) {
    const T = o.tip;
    const k = 0.45, e = a * 0.14;
    const yt = -H, ytc = -H - T * 0.14, ap = -H - T;
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    const faces = [
      [[-a, 0, -a * k, e, -a * k, ytc, -a, yt], 0.32],
      [[-a * k, e, a * k, e, a * k, ytc, -a * k, ytc], 0.0],
      [[a * k, e, a, 0, a, yt, a * k, ytc], -0.42],
      [[-a, yt, -a * k, ytc, 0, ap], 0.55],
      [[-a * k, ytc, a * k, ytc, 0, ap], 0.22],
      [[a * k, ytc, a, yt, 0, ap], -0.2],
    ];
    for (const [pts, lum] of faces) {
      poly(g, pts);
      if (o.alpha < 1) {
        const gr = g.createLinearGradient(0, ap, 0, e);
        gr.addColorStop(0, shade(o.col, lum + 0.35, o.alpha + 0.2));
        gr.addColorStop(1, shade(o.col, lum - 0.1, o.alpha * 0.6));
        g.fillStyle = gr;
      } else {
        const gr = g.createLinearGradient(-a, ap, a, e);
        gr.addColorStop(0, shade(o.col, lum + 0.18));
        gr.addColorStop(1, shade(o.col, lum - 0.18));
        g.fillStyle = gr;
      }
      g.fill();
    }
    /* arêtes claires, fines */
    g.lineJoin = 'round';
    g.strokeStyle = o.alpha < 1 ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.28)';
    g.lineWidth = o.lw;
    g.beginPath();
    g.moveTo(-a * k, e); g.lineTo(-a * k, ytc);
    g.moveTo(a * k, e); g.lineTo(a * k, ytc);
    g.moveTo(-a, yt); g.lineTo(-a * k, ytc); g.lineTo(a * k, ytc); g.lineTo(a, yt);
    g.moveTo(-a * k, ytc); g.lineTo(0, ap); g.lineTo(a * k, ytc);
    g.stroke();
    g.strokeStyle = o.alpha < 1 ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.16)';
    poly(g, [-a, 0, -a * k, e, a * k, e, a, 0, a, yt, 0, ap, -a, yt]);
    g.stroke();
    /* reflets internes */
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = o.alpha < 1 ? 'rgba(255,255,255,0.4)' : 'rgba(200,225,255,0.22)';
    poly(g, [-a * k + a * 0.1, e * 0.5, -a * k + a * 0.22, e * 0.6, -a * k + a * 0.22, ytc + T * 0.05, -a * k + a * 0.1, ytc]);
    g.fill();
    g.globalCompositeOperation = 'source-over';
    g.restore();
    return [x + Math.sin(ang) * (H + T), y - Math.cos(ang) * (H + T)];
  }

  /* Roche support (gangue), galet sombre et texturé */
  function matrix(g, x, y, rx, ry, base, seed) {
    const r = seeded(seed);
    g.save();
    g.translate(x, y);
    g.scale(1, ry / rx);
    draw.blob(g, 0, 0, rx, 0.16, seed, 0, 30);
    g.restore();
    const gr = g.createRadialGradient(x - rx * 0.3, y - ry * 0.6, rx * 0.1, x, y, rx * 1.1);
    gr.addColorStop(0, shade(base, 0.22));
    gr.addColorStop(0.6, base);
    gr.addColorStop(1, shade(base, -0.55));
    g.fillStyle = gr;
    g.fill();
    g.save();
    g.clip();
    for (let i = 0; i < 70; i++) {
      g.fillStyle = r() < 0.5 ? `rgba(255,240,225,${0.05 + r() * 0.12})` : `rgba(0,0,0,${0.1 + r() * 0.2})`;
      const s = 0.012 + r() * 0.03;
      g.fillRect(x + (r() * 2 - 1) * rx, y + (r() * 2 - 1) * ry, s, s);
    }
    g.restore();
  }

  /* Le devant de la roche, redessiné par-dessus le pied des cristaux :
     ils ont l'air de sortir de la pierre. */
  function matrixFront(g, x, y, rx, ry, base, seed, cut) {
    g.save();
    g.beginPath();
    g.rect(-2, cut, 4, 3);
    g.clip();
    matrix(g, x, y, rx, ry, base, seed);
    g.restore();
    /* liseré clair à la lisière, là où les cristaux sortent de la roche */
    g.save();
    g.beginPath();
    g.rect(-2, cut - 0.004, 4, 0.03);
    g.clip();
    g.translate(x, y);
    g.scale(1, ry / rx);
    draw.blob(g, 0, 0, rx, 0.16, seed, 0, 30);
    g.restore();
    g.fillStyle = 'rgba(255,255,255,0.08)';
    g.fill();
  }

  function drawQuartz(g, lw) {
    matrix(g, 0, 0.62, 0.8, 0.27, '#5E5853', 7);
    const col = '#D8E6F2';
    const o = { tip: 0.26, col, alpha: 0.42, lw };
    prism(g, -0.44, 0.64, -0.5, 0.11, 0.44, o);
    prism(g, 0.44, 0.64, 0.55, 0.12, 0.52, o);
    prism(g, 0.2, 0.62, 0.22, 0.14, 0.76, o);
    prism(g, -0.2, 0.64, -0.2, 0.16, 0.8, { tip: 0.32, col, alpha: 0.42, lw });
    const tip = prism(g, 0.02, 0.68, 0.02, 0.19, 0.95, { tip: 0.38, col, alpha: 0.46, lw });
    matrixFront(g, 0, 0.62, 0.8, 0.27, '#5E5853', 7, 0.66);
    glint(g, tip[0] - 0.02, tip[1] + 0.08, 0.12, 1);
    glint(g, -0.3, 0.0, 0.07, 0.8);
  }

  function drawAzurite(g, lw) {
    matrix(g, 0, 0.6, 0.82, 0.28, '#5A4A3E', 11);
    const col = '#2C56C8';
    const o = { tip: 0.14, col, alpha: 1, lw };
    const set = [
      [-0.55, 0.56, -0.75, 0.12, 0.3], [0.56, 0.56, 0.8, 0.12, 0.3],
      [-0.32, 0.5, -0.42, 0.15, 0.48], [0.34, 0.52, 0.5, 0.16, 0.44],
      [0.12, 0.5, 0.18, 0.18, 0.6], [-0.12, 0.54, -0.12, 0.19, 0.62],
    ];
    let top = null;
    for (const [x, y, an, a, H] of set) {
      const t = prism(g, x, y + 0.04, an, a, H, { tip: o.tip + a * 0.3, col, alpha: 1, lw });
      if (!top || t[1] < top[1]) top = t;
    }
    matrixFront(g, 0, 0.6, 0.82, 0.28, '#5A4A3E', 11, 0.6);
    /* petites boules d'azurite au pied */
    const r = seeded(5);
    for (let i = 0; i < 7; i++) {
      const x = -0.5 + r() * 1.0, y = 0.6 + r() * 0.1, rr = 0.05 + r() * 0.05;
      const gr = g.createRadialGradient(x - rr * 0.4, y - rr * 0.5, rr * 0.1, x, y, rr);
      gr.addColorStop(0, '#7FA6FF');
      gr.addColorStop(0.5, '#2A4FC0');
      gr.addColorStop(1, '#0E2366');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(x, y, rr, 0, TAU);
      g.fill();
    }
    glint(g, top[0] + 0.02, top[1] + 0.1, 0.1, 0.9);
    glint(g, 0.36, 0.08, 0.06, 0.7);
  }

  function drawFeldspath(g, lw) {
    /* support de granite moucheté */
    matrix(g, 0, 0.62, 0.82, 0.24, '#8E8A86', 21);
    const r = seeded(9);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = r() < 0.6 ? 'rgba(20,20,24,0.7)' : 'rgba(240,236,228,0.7)';
      g.beginPath();
      g.arc(-0.7 + r() * 1.4, 0.5 + r() * 0.24, 0.012 + r() * 0.02, 0, TAU);
      g.fill();
    }
    function block(ox, oy, s, col, seed) {
      const F = [-0.5, 0.36, 0.22, 0.46, 0.26, -0.3, -0.46, -0.4];
      const Sd = [0.22, 0.46, 0.56, 0.24, 0.6, -0.48, 0.26, -0.3];
      const Tp = [-0.46, -0.4, 0.26, -0.3, 0.6, -0.48, -0.08, -0.6];
      const Ch = [-0.46, -0.4, 0.26, -0.3, 0.2, -0.42, -0.44, -0.5];
      const tr = (p) => p.map((v, i) => (i % 2 ? oy + v * s : ox + v * s));
      const faces = [[F, -0.02], [Sd, -0.36], [Tp, 0.32], [Ch, 0.46]];
      for (const [pts, lum] of faces) {
        const P = tr(pts);
        poly(g, P);
        const gr = g.createLinearGradient(P[0], P[1], P[4], P[5]);
        gr.addColorStop(0, shade(col, lum + 0.1));
        gr.addColorStop(1, shade(col, lum - 0.12));
        g.fillStyle = gr;
        g.fill();
      }
      /* stries de clivage sur la face avant */
      const P = tr(F);
      g.save();
      poly(g, P);
      g.clip();
      const rr = seeded(seed);
      g.lineWidth = lw * 0.8;
      for (let i = 0; i < 9; i++) {
        const t = (i + rr()) / 9;
        g.strokeStyle = rr() < 0.5 ? 'rgba(255,255,255,0.2)' : 'rgba(90,40,30,0.16)';
        g.beginPath();
        g.moveTo(lerp(P[0], P[6], t) - s * 0.1, lerp(P[1], P[7], t));
        g.lineTo(lerp(P[2], P[4], t) + s * 0.1, lerp(P[3], P[5], t));
        g.stroke();
      }
      g.restore();
      g.strokeStyle = 'rgba(255,255,255,0.32)';
      g.lineWidth = lw;
      g.lineJoin = 'round';
      g.beginPath();
      const Q = tr(Tp);
      g.moveTo(P[6], P[7]); g.lineTo(P[4], P[5]); g.lineTo(Q[4], Q[5]);
      g.moveTo(P[4], P[5]); g.lineTo(P[2], P[3]);
      g.stroke();
    }
    block(-0.42, 0.2, 0.62, '#EDE6DA', 4);
    block(0.1, 0.32, 1.0, '#E59E86', 8);
    glint(g, 0.32, -0.16, 0.08, 0.85);
  }

  function drawOlivine(g) {
    /* bloc de lave sombre et bulleuse */
    g.save();
    g.scale(1, 0.78);
    draw.blob(g, 0, 0.12, 0.86, 0.14, 3.3, 0, 36);
    g.restore();
    const gr = g.createRadialGradient(-0.3, -0.35, 0.05, 0, 0.1, 1);
    gr.addColorStop(0, '#5A5652');
    gr.addColorStop(0.55, '#34312F');
    gr.addColorStop(1, '#161514');
    g.fillStyle = gr;
    g.fill();
    g.save();
    g.clip();
    const r = seeded(17);
    for (let i = 0; i < 26; i++) {
      const x = (r() * 2 - 1) * 0.8, y = (r() * 2 - 1) * 0.6 + 0.08, rr = 0.025 + r() * 0.05;
      if (Math.hypot(x * 1.1, (y - 0.08) * 1.6) < 0.5) continue;
      g.fillStyle = 'rgba(8,8,8,0.75)';
      g.beginPath();
      g.ellipse(x, y, rr, rr * 0.8, 0, 0, TAU);
      g.fill();
      g.strokeStyle = 'rgba(160,150,140,0.35)';
      g.lineWidth = 0.012;
      g.beginPath();
      g.ellipse(x, y + rr * 0.1, rr, rr * 0.8, 0, 0.2, Math.PI - 0.2);
      g.stroke();
    }
    g.restore();
    /* nodule de grains d'olivine */
    const cols = ['#9DB436', '#B2C744', '#869E2A', '#C3D357', '#7F9426'];
    const grains = [];
    const rr = seeded(31);
    for (let i = 0; i < 26; i++) {
      const a = rr() * TAU, d = Math.sqrt(rr()) * 0.46;
      grains.push([Math.cos(a) * d * 1.15, 0.06 + Math.sin(a) * d * 0.72, 0.075 + rr() * 0.07, rr()]);
    }
    grains.sort((A, B) => A[1] - B[1]);
    for (const [x, y, s, q] of grains) {
      const n = 5 + Math.floor(q * 3);
      const pts = [];
      for (let k = 0; k < n; k++) {
        const an = (k / n) * TAU + q * 2;
        const rad = s * (0.75 + 0.35 * Math.abs(Math.sin(an * 2.3 + q * 9)));
        pts.push(x + Math.cos(an) * rad, y + Math.sin(an) * rad * 0.85);
      }
      const c = cols[Math.floor(q * cols.length) % cols.length];
      g.fillStyle = shade(c, -0.45);
      poly(g, pts.map((v, i) => (i % 2 ? v + s * 0.12 : v)));
      g.fill();
      poly(g, pts);
      const gg = g.createLinearGradient(x - s, y - s, x + s, y + s);
      gg.addColorStop(0, shade(c, 0.35));
      gg.addColorStop(0.5, c);
      gg.addColorStop(1, shade(c, -0.3));
      g.fillStyle = gg;
      g.fill();
      /* facette claire */
      g.fillStyle = 'rgba(255,255,220,0.28)';
      poly(g, [pts[0], pts[1], pts[2], pts[3], x, y]);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.75)';
      g.fillRect(x - s * 0.35, y - s * 0.4, s * 0.16, s * 0.12);
    }
    glint(g, -0.12, -0.12, 0.09, 0.9);
    glint(g, 0.26, 0.2, 0.06, 0.7);
  }

  function drawMalachite(g) {
    g.save();
    g.scale(1, 0.8);
    draw.blob(g, 0, 0.06, 0.84, 0.1, 5.1, 0, 40);
    g.restore();
    g.save();
    g.clip();
    g.fillStyle = '#0D5434';
    g.fillRect(-1, -1, 2, 2);
    const seq = ['#0B4A2E', '#1D7E4C', '#39A866', '#0F5C38', '#6BD39A', '#1A7044', '#2F9A5C', '#A6EBC4', '#13603B', '#4BBE7C'];
    const centers = [[-0.34, 0.16, 0.95, 1.2], [0.4, -0.05, 0.62, 3.4], [0.12, 0.42, 0.4, 2.2]];
    for (const [cx, cy, R, sd] of centers) {
      let i = 0;
      for (let rad = R; rad > 0.03; rad -= 0.035 + 0.03 * Math.abs(Math.sin(rad * 17 + sd))) {
        g.fillStyle = seq[(i++ + Math.floor(sd)) % seq.length];
        draw.blob(g, cx, cy, rad, 0.09, sd, 0, 34);
        g.fill();
      }
    }
    /* poli : ombre sur le bord, reflet doux */
    const sh = g.createRadialGradient(-0.25, -0.3, 0.1, 0, 0, 0.95);
    sh.addColorStop(0, 'rgba(255,255,255,0.18)');
    sh.addColorStop(0.55, 'rgba(255,255,255,0)');
    sh.addColorStop(1, 'rgba(0,20,10,0.6)');
    g.fillStyle = sh;
    g.fillRect(-1, -1, 2, 2);
    g.restore();
    g.save();
    g.translate(-0.3, -0.32);
    g.rotate(-0.4);
    g.scale(1, 0.32);
    draw.glow(g, 0, 0, 0.36, '#FFFFFF', 0.45);
    g.restore();
    glint(g, -0.42, -0.3, 0.07, 0.8);
  }

  function drawTurquoise(g, lw) {
    g.save();
    g.scale(1, 0.84);
    draw.blob(g, 0, 0.08, 0.78, 0.17, 8.2, 0, 40);
    g.restore();
    const gr = g.createRadialGradient(-0.25, -0.25, 0.05, 0, 0.05, 0.9);
    gr.addColorStop(0, '#8FE8DA');
    gr.addColorStop(0.45, '#46BFB0');
    gr.addColorStop(1, '#1E7F7A');
    g.fillStyle = gr;
    g.fill();
    g.save();
    g.clip();
    const r = seeded(77);
    /* marbrures */
    for (let i = 0; i < 18; i++) {
      draw.glow(g, (r() * 2 - 1) * 0.7, (r() * 2 - 1) * 0.6, 0.12 + r() * 0.2, r() < 0.5 ? '#B5F2E6' : '#1A6F69', 0.25);
    }
    /* fines veines de roche brune (la « toile ») */
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (let i = 0; i < 9; i++) {
      let x = (r() * 2 - 1) * 0.8, y = (r() * 2 - 1) * 0.7;
      let an = r() * TAU;
      g.strokeStyle = `rgba(70,52,34,${0.5 + r() * 0.3})`;
      g.lineWidth = lw * (0.8 + r() * 1.2);
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 7; k++) {
        an += (r() - 0.5) * 1.6;
        x += Math.cos(an) * 0.11;
        y += Math.sin(an) * 0.11;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    g.restore();
    g.save();
    g.translate(-0.24, -0.3);
    g.rotate(-0.5);
    g.scale(1, 0.4);
    draw.glow(g, 0, 0, 0.34, '#FFFFFF', 0.3);
    g.restore();
  }

  const PAINT = {
    olivine: drawOlivine, malachite: drawMalachite, quartz: drawQuartz,
    azurite: drawAzurite, feldspath: drawFeldspath, turquoise: drawTurquoise,
  };

  /* Dessine un minéral dans un canevas (fond velours, halo, ombre portée) */
  function paintArt(cvs, id, wCss, hCss, dpr, withBg) {
    cvs.width = Math.max(1, Math.round(wCss * dpr));
    cvs.height = Math.max(1, Math.round(hCss * dpr));
    cvs.style.width = wCss + 'px';
    cvs.style.height = hCss + 'px';
    const g = cvs.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, wCss, hCss);
    const s = Math.min(wCss * 0.42, hCss * 0.46);
    const cx = wCss / 2, cy = hCss * 0.5;
    if (withBg) {
      const bg = g.createRadialGradient(cx, cy * 0.9, 4, cx, cy, Math.max(wCss, hCss) * 0.75);
      bg.addColorStop(0, '#22384A');
      bg.addColorStop(0.6, '#142433');
      bg.addColorStop(1, '#0B1520');
      g.fillStyle = bg;
      g.fillRect(0, 0, wCss, hCss);
      const r = seeded(id.length * 31);
      for (let i = 0; i < 40; i++) {
        g.fillStyle = `rgba(200,225,255,${0.04 + r() * 0.1})`;
        g.fillRect(r() * wCss, r() * hCss, 1, 1);
      }
    }
    draw.glow(g, cx, cy, s * 1.5, TEINTE[id], withBg ? 0.3 : 0.22);
    g.save();
    g.translate(cx, cy + s * 0.72);
    g.scale(1, 0.18);
    draw.glow(g, 0, 0, s * 0.95, '#000000', 0.55);
    g.restore();
    g.save();
    g.translate(cx, cy);
    g.scale(s, s);
    PAINT[id](g, 1.1 / s);
    g.restore();
  }

  const COL_AVANT = '#FFB46A';
  const COL_VIE = '#7BE495';

  const CSS = `
.game[data-game="mineraux"] .mn-stack { position: absolute; z-index: 1; inset: 0 0 68px 0; touch-action: pan-y; }
.game[data-game="mineraux"] .mn-card {
  position: absolute; left: 0; top: 0; width: var(--mn-cw); height: var(--mn-ch);
  display: flex; flex-direction: column; padding: 8px;
  background: linear-gradient(170deg, #F6F8FA, #E3E9EF);
  color: #13212E; border-radius: 22px 26px 24px 20px / 20px 22px 26px 24px;
  box-shadow: 0 1px 0 rgba(255,255,255,0.7) inset, 0 18px 30px -16px rgba(0,0,0,0.75), 0 2px 6px rgba(0,0,0,0.25);
  will-change: transform; transform-origin: 50% 85%;
  transition: transform 0.32s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.3s;
}
.game[data-game="mineraux"] .mn-card::after {
  content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
  background: rgba(8, 16, 24, var(--mn-dim, 0)); transition: background 0.3s;
}
.game[data-game="mineraux"] .mn-card.is-drag, .game[data-game="mineraux"] .mn-card.is-wob { transition: none; }
.game[data-game="mineraux"] .mn-card.is-fly { transition: transform 0.45s cubic-bezier(0.35, 0.3, 0.7, 1), opacity 0.45s ease-in; }
.game[data-game="mineraux"] .mn-stack.is-wide .mn-card { flex-direction: row; }
.game[data-game="mineraux"] .mn-stack.is-wide .mn-label { width: 44%; display: flex; flex-direction: column; justify-content: center; padding: 8px 12px; }
.game[data-game="mineraux"] .mn-stack.is-wide .mn-count { top: 8px; right: 10px; }
.game[data-game="mineraux"] .mn-art { position: relative; flex: 1 1 auto; min-height: 0; overflow: hidden;
  border-radius: 16px 19px 17px 15px / 15px 16px 19px 17px; background: #0F1C28; }
.game[data-game="mineraux"] .mn-art canvas { position: absolute; left: 0; top: 0; display: block; }
.game[data-game="mineraux"] .mn-tint { position: absolute; inset: 0; opacity: 0; pointer-events: none; }
.game[data-game="mineraux"] .mn-stamp {
  position: absolute; left: 50%; top: 12px; transform: translateX(-50%) rotate(-5deg) scale(0.9);
  padding: 5px 12px 6px; border: 3px solid currentColor; border-radius: 12px 15px 13px 14px;
  background: rgba(10, 20, 29, 0.72); white-space: nowrap; opacity: 0; pointer-events: none;
  font: 800 1.05rem/1 var(--font-display); font-variation-settings: "SOFT" 100; letter-spacing: 0.01em;
}
.game[data-game="mineraux"] .mn-stamp--avant { color: ${COL_AVANT}; transform: translateX(-50%) rotate(5deg) scale(0.9); }
.game[data-game="mineraux"] .mn-stamp--vie { color: ${COL_VIE}; }
.game[data-game="mineraux"] .mn-label { flex: none; position: relative; padding: 10px 8px 6px; }
.game[data-game="mineraux"] .mn-name {
  margin: 0; font-family: var(--font-display); font-weight: 800; font-variation-settings: "SOFT" 100;
  font-size: var(--mn-fs); line-height: 1; letter-spacing: -0.015em; color: #13212E;
}
.game[data-game="mineraux"] .mn-aspect { margin: 6px 0 0; font-size: 0.95rem; line-height: 1.35; color: #4A5B6B; }
.game[data-game="mineraux"] .mn-count {
  position: absolute; right: 8px; top: 12px; font-size: 0.8rem; font-weight: 700; color: #6B7C8C;
  font-variant-numeric: tabular-nums;
}
.game[data-game="mineraux"] .mn-bar {
  position: absolute; z-index: 2; left: 12px; right: 12px; bottom: 12px; display: flex; gap: 10px;
}
.game[data-game="mineraux"] .mn-bar .chip { flex: 1 1 0; min-width: 0; padding-inline: 10px; transition: background 0.2s, box-shadow 0.2s, transform 0.15s; }
.game[data-game="mineraux"] .mn-bar svg { width: 16px; height: 16px; flex: none; fill: none; stroke: currentColor; stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round; }
.game[data-game="mineraux"] .mn-bar.is-narrow { left: 8px; right: 8px; gap: 8px; }
.game[data-game="mineraux"] .mn-bar.is-narrow .chip { font-size: 0.875rem; padding-inline: 6px; gap: 2px; }
.game[data-game="mineraux"] .mn-bar.is-narrow svg { width: 13px; height: 13px; }
.game[data-game="mineraux"] .mn-bar .chip.is-near-avant { background: ${COL_AVANT}; }
.game[data-game="mineraux"] .mn-bar .chip.is-near-vie { background: ${COL_VIE}; }
.game[data-game="mineraux"] .mn-fx { position: absolute; inset: 0; pointer-events: none; z-index: 3; }
.game[data-game="mineraux"] .mn-banner {
  position: absolute; inset: 0; z-index: 4; display: flex; align-items: flex-end; padding: 12px;
  background: linear-gradient(to top, rgba(5, 11, 17, 0.8), rgba(5, 11, 17, 0.35) 55%, rgba(5, 11, 17, 0) 85%);
  opacity: 0; visibility: hidden; pointer-events: none; transition: opacity 0.25s, visibility 0s 0.25s;
}
.game[data-game="mineraux"] .mn-banner.is-on { opacity: 1; visibility: visible; transition: opacity 0.25s; }
.game[data-game="mineraux"] .mn-panel {
  position: relative; width: 100%; overflow: hidden; padding: 14px 16px 16px;
  background: #13212E; color: #E8EEF5; border-radius: 18px 22px 20px 17px / 17px 19px 22px 20px;
  box-shadow: inset 0 0 0 1px rgba(232,238,245,0.14), 0 16px 30px -14px rgba(0,0,0,0.8);
  transform: translateY(14px); transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.game[data-game="mineraux"] .mn-banner.is-on .mn-panel { transform: none; }
.game[data-game="mineraux"] .mn-panel.is-shake { animation: mn-shake 0.42s ease-in-out; }
.game[data-game="mineraux"] .mn-verdict {
  margin: 0 0 6px; font-family: var(--font-display); font-weight: 800; font-variation-settings: "SOFT" 100;
  font-size: 1.45rem; line-height: 1.05; color: var(--mn-vc, #5FD0E6);
}
.game[data-game="mineraux"] .mn-explain { margin: 0; font-size: 1rem; line-height: 1.42; }
.game[data-game="mineraux"] .mn-timer { position: absolute; left: 0; bottom: 0; height: 3px; width: 100%;
  background: var(--mn-vc, #5FD0E6); transform-origin: 0 50%; opacity: 0.85; }
@keyframes mn-shake { 0%, 100% { transform: translateX(0); } 18% { transform: translateX(-8px); } 36% { transform: translateX(7px); } 54% { transform: translateX(-5px); } 72% { transform: translateX(3px); } }
.game[data-game="mineraux"] .mn-coll {
  position: absolute; z-index: 2; inset: 0; display: none; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px;
  padding: 16px 12px 14px; align-content: center;
}
.game[data-game="mineraux"] .mn-coll.is-on { display: grid; animation: mn-in 0.5s cubic-bezier(0.2, 0.8, 0.2, 1); }
@keyframes mn-in { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
.game[data-game="mineraux"] .mn-col { display: grid; gap: 8px; align-content: start; min-width: 0; }
.game[data-game="mineraux"] .mn-colhead {
  margin: 0 0 2px; padding: 7px 10px; border-radius: 12px 14px 12px 13px; text-align: center;
  font: 800 1rem/1.1 var(--font-display); font-variation-settings: "SOFT" 100; color: #0E1A24;
}
.game[data-game="mineraux"] .mn-item {
  position: relative; display: flex; align-items: center; gap: 9px; min-height: 44px; min-width: 0; width: 100%; padding: 6px 28px 6px 6px; border: 0; text-align: left;
  border-radius: 14px 17px 15px 16px; background: rgba(232, 238, 245, 0.07); color: #E8EEF5;
  box-shadow: inset 0 0 0 1px rgba(232, 238, 245, 0.12); font: 700 0.95rem/1.15 var(--font-text); cursor: pointer;
  animation: mn-in 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
}
.game[data-game="mineraux"] .mn-item canvas { flex: none; border-radius: 10px; }
.game[data-game="mineraux"] .mn-item:active { transform: scale(0.98); }
.game[data-game="mineraux"] .mn-iname { flex: 1 1 auto; min-width: 0; overflow-wrap: normal; word-break: normal; hyphens: auto; }
.game[data-game="mineraux"] .mn-mark {
  position: absolute; top: 6px; right: 6px; display: grid; place-items: center; width: 20px; height: 20px; border-radius: 50%;
  background: rgba(123, 228, 149, 0.16); color: ${COL_VIE};
}
.game[data-game="mineraux"] .mn-item.is-wrong { box-shadow: inset 0 0 0 2px rgba(255, 180, 106, 0.75); }
.game[data-game="mineraux"] .mn-item.is-wrong .mn-mark { background: ${COL_AVANT}; color: #13212E; }
.game[data-game="mineraux"] .mn-mark svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
.game[data-game="mineraux"] .mn-mark svg { width: 14px; height: 14px; }
.game[data-game="mineraux"] .mn-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
`;

  window.RM.games.mineraux = function (api) {
    const stage = api.stage;
    const cv = api.canvas();
    const ctx = cv.ctx;
    const RM_ = api.reducedMotion;
    api.style(CSS);

    const N = MINERAUX.length;
    const ARROW_L = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5.5 8 12l6.5 6.5"/></svg>';
    const ARROW_R = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 5.5 16 12l-6.5 6.5"/></svg>';

    /* ---- DOM ---- */
    const stack = document.createElement('div');
    stack.className = 'mn-stack';
    const bar = document.createElement('div');
    bar.className = 'mn-bar';
    const btnAvant = document.createElement('button');
    btnAvant.type = 'button';
    btnAvant.className = 'chip';
    btnAvant.innerHTML = ARROW_L + '<span></span>';
    btnAvant.lastChild.textContent = TEXTES.avant;
    const btnVie = document.createElement('button');
    btnVie.type = 'button';
    btnVie.className = 'chip';
    btnVie.innerHTML = '<span></span>' + ARROW_R;
    btnVie.firstChild.textContent = TEXTES.vie;
    bar.append(btnAvant, btnVie);
    const fx = document.createElement('canvas');
    fx.className = 'mn-fx';
    fx.setAttribute('aria-hidden', 'true');
    const fctx = fx.getContext('2d');
    const coll = document.createElement('div');
    coll.className = 'mn-coll';
    const banner = document.createElement('div');
    banner.className = 'mn-banner';
    banner.setAttribute('role', 'status');
    banner.innerHTML = '<div class="mn-panel"><p class="mn-verdict"></p><p class="mn-explain"></p><span class="mn-timer"></span></div>';
    const panel = banner.firstChild;
    const verdictEl = panel.querySelector('.mn-verdict');
    const explainEl = panel.querySelector('.mn-explain');
    const timerEl = panel.querySelector('.mn-timer');
    stage.append(stack, bar, coll, fx, banner);

    /* ---- état ---- */
    let order = [];
    let cards = [];        /* éléments DOM, dans l'ordre de la pile */
    let idx = 0;           /* carte du dessus */
    let score = 0;
    let answers = [];
    let state = 'idle';    /* idle | drag | fly | banner | done */
    let bannerT = 0, bannerDur = 0, bannerNext = false;
    let drag = null;
    let lean = 0;          /* -1..1 : vers quel côté penche la carte (fond, boutons) */
    let leanShown = 0;
    let sparks = [];
    let G = { w: 1, h: 1, cw: 200, ch: 260, cx: 0, cy: 0 };
    let bg = null;
    let dirty = true;
    let time = 0;
    let pending = null;    /* bandeau à montrer juste après l'envol de la carte */

    /* ---- fond d'ardoise ---- */
    function makeBg(w, h) {
      const c = document.createElement('canvas');
      c.width = Math.round(w * cv.dpr);
      c.height = Math.round(h * cv.dpr);
      const g = c.getContext('2d');
      g.scale(cv.dpr, cv.dpr);
      const gr = g.createLinearGradient(0, 0, w * 0.4, h);
      gr.addColorStop(0, '#13222F');
      gr.addColorStop(1, '#09121A');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
      /* feuillets de l'ardoise : fines lignes obliques */
      const n = lib.makeNoise(5);
      g.lineWidth = 1;
      for (let i = -h; i < w + h; i += 7) {
        const v = n.noise2(i * 0.05, 1.3);
        g.strokeStyle = v > 0.5 ? `rgba(160,190,215,${(v - 0.5) * 0.12})` : `rgba(0,0,0,${(0.5 - v) * 0.3})`;
        g.beginPath();
        g.moveTo(i, 0);
        g.bezierCurveTo(i + h * 0.18, h * 0.3, i + h * 0.2, h * 0.7, i + h * 0.42, h);
        g.stroke();
      }
      for (let i = 0; i < 160; i++) {
        g.fillStyle = Math.random() < 0.5 ? `rgba(190,215,235,${rand(0.03, 0.1)})` : `rgba(0,0,0,${rand(0.08, 0.2)})`;
        g.fillRect(rand(w), rand(h), rand(0.6, 1.8), rand(0.6, 1.4));
      }
      const vg = g.createRadialGradient(w / 2, h * 0.42, Math.min(w, h) * 0.2, w / 2, h * 0.5, Math.max(w, h) * 0.75);
      vg.addColorStop(0, 'rgba(95,208,230,0.07)');
      vg.addColorStop(1, 'rgba(0,0,0,0.45)');
      g.fillStyle = vg;
      g.fillRect(0, 0, w, h);
      return c;
    }

    /* ---- mise en page ---- */
    function layout() {
      const w = cv.w, h = cv.h;
      const sh = h - 68;
      const wide = w / sh > 1.25;
      let cw, ch;
      if (wide) {
        ch = Math.max(90, sh - 40);
        cw = Math.min(w - 48, ch * 2.1, 560);
      } else {
        cw = Math.min(w * 0.8, 340, (sh - 40) / 1.2);
        ch = Math.min(sh - 40, cw * 1.36);
      }
      cw = Math.round(cw);
      ch = Math.round(ch);
      G = { w, h, cw, ch, cx: Math.round((w - cw) / 2), cy: Math.round((sh - ch - 20) / 2 + 2), wide };
      stack.classList.toggle('is-wide', wide);
      bar.classList.toggle('is-narrow', w < 360);
      stack.style.setProperty('--mn-cw', cw + 'px');
      stack.style.setProperty('--mn-ch', ch + 'px');
      const fs = wide ? clamp(ch * 0.2, 18, 34) : clamp(cw * 0.115, 22, 40);
      stack.style.setProperty('--mn-fs', fs.toFixed(1) + 'px');
      fx.width = Math.round(w * cv.dpr);
      fx.height = Math.round(h * cv.dpr);
      fx.style.width = w + 'px';
      fx.style.height = h + 'px';
      fctx.setTransform(cv.dpr, 0, 0, cv.dpr, 0, 0);
      bg = makeBg(w, h);
      for (const c of cards) c.style.left = G.cx + 'px';
      for (const c of cards) c.style.top = G.cy + 'px';
      placeAll();
      paintAll();
      dirty = true;
    }
    cv.onResize(() => layout());
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (cards.length) paintAll(); });

    function paintAll() {
      for (let i = 0; i < cards.length; i++) {
        if (i < idx) continue;
        const c = cards[i];
        const art = c.querySelector('.mn-art');
        const aw = art.clientWidth, ah = art.clientHeight;
        if (!aw || !ah) continue;
        const cvs = art.querySelector('canvas');
        paintArt(cvs, c.dataset.id, aw, ah, cv.dpr, true);
      }
    }

    /* position de chaque carte selon sa profondeur dans la pile */
    function placeCard(c, d) {
      if (d < 0) return;
      const dd = Math.min(d, 2);
      c.style.zIndex = String(20 - d);
      c.style.opacity = d > 2 ? '0' : '1';
      c.style.setProperty('--mn-dim', String([0, 0.28, 0.5][dd]));
      c.style.transform = d === 0 ? 'none' : `translateY(${dd * 11}px) scale(${1 - dd * 0.05})`;
      c.setAttribute('aria-hidden', d === 0 ? 'false' : 'true');
    }
    function placeAll() {
      for (let i = 0; i < cards.length; i++) placeCard(cards[i], i - idx);
    }

    function buildCards() {
      for (const c of cards) c.remove();
      cards = order.map((k, i) => {
        const m = MINERAUX[k];
        const c = document.createElement('div');
        c.className = 'mn-card';
        c.dataset.id = m.id;
        c.innerHTML = '<div class="mn-art"><canvas aria-hidden="true"></canvas><div class="mn-tint"></div>' +
          '<span class="mn-stamp mn-stamp--avant"></span><span class="mn-stamp mn-stamp--vie"></span></div>' +
          '<div class="mn-label"><p class="mn-name"></p><p class="mn-aspect"></p><span class="mn-count"></span></div>';
        c.querySelector('.mn-stamp--avant').textContent = TEXTES.avant;
        c.querySelector('.mn-stamp--vie').textContent = TEXTES.vie;
        c.querySelector('.mn-name').textContent = m.nom;
        c.querySelector('.mn-aspect').textContent = m.aspect;
        c.querySelector('.mn-count').textContent = TEXTES.carte(i + 1, N);
        const cvs = c.querySelector('canvas');
        cvs.style.width = '100%';
        cvs.style.height = '100%';
        c.style.left = G.cx + 'px';
        c.style.top = G.cy + 'px';
        stack.appendChild(c);
        return c;
      });
      placeAll();
      paintAll();
      labelButtons();
    }

    function labelButtons() {
      const c = cards[idx];
      const m = c && MINERAUX[order[idx]];
      btnAvant.setAttribute('aria-label', m ? TEXTES.boutonAvant(m.nom) : TEXTES.avant);
      btnVie.setAttribute('aria-label', m ? TEXTES.boutonVie(m.nom) : TEXTES.vie);
      btnAvant.disabled = !m;
      btnVie.disabled = !m;
    }

    function shuffle() {
      const ids = MINERAUX.map((_, i) => i);
      for (let tries = 0; tries < 40; tries++) {
        for (let i = ids.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [ids[i], ids[j]] = [ids[j], ids[i]];
        }
        /* pas trois cartes du même côté à la suite */
        let ok = true;
        for (let i = 2; i < ids.length; i++) {
          const a = MINERAUX[ids[i]].vie, b = MINERAUX[ids[i - 1]].vie, c = MINERAUX[ids[i - 2]].vie;
          if (a === b && b === c) ok = false;
        }
        if (ok) break;
      }
      return ids;
    }

    /* ---- retour visuel pendant le glissé ---- */
    function setLean(v) {
      lean = clamp(v, -1, 1);
      const c = cards[idx];
      if (!c) return;
      const a = Math.max(0, -lean), b = Math.max(0, lean);
      const sa = c.querySelector('.mn-stamp--avant'), sv = c.querySelector('.mn-stamp--vie');
      sa.style.opacity = String(ease.outQuad(clamp(a * 1.4)));
      sv.style.opacity = String(ease.outQuad(clamp(b * 1.4)));
      sa.style.transform = `translateX(-50%) rotate(5deg) scale(${0.9 + 0.1 * clamp(a * 1.4)})`;
      sv.style.transform = `translateX(-50%) rotate(-5deg) scale(${0.9 + 0.1 * clamp(b * 1.4)})`;
      const tint = c.querySelector('.mn-tint');
      tint.style.opacity = String(Math.max(a, b) * 0.6);
      tint.style.background = lean < 0
        ? `linear-gradient(90deg, ${rgba(COL_AVANT, 0.55)}, ${rgba(COL_AVANT, 0)} 75%)`
        : `linear-gradient(270deg, ${rgba(COL_VIE, 0.55)}, ${rgba(COL_VIE, 0)} 75%)`;
      btnAvant.classList.toggle('is-near-avant', lean < -0.55);
      btnVie.classList.toggle('is-near-vie', lean > 0.55);
    }

    function threshold() { return clamp(0.3 * G.w, 70, 150); }

    /* ---- glisser la carte ---- */
    let wob = 0;
    api.track(stack, {
      down(p) {
        if (state !== 'idle' || !cards[idx]) return;
        const now = performance.now();
        /* ce contact vient de fermer le bandeau : il ne trie pas la carte suivante, encore jamais vue */
        if (now - dismissedAt < 60) return;
        drag = { x0: p.x, y0: p.y, hist: [[p.x, now]], moved: false };
        cards[idx].classList.add('is-drag');
        state = 'drag';
      },
      move(p) {
        if (state !== 'drag' || !drag) return;
        const dx = p.x - drag.x0;
        const dy = (p.y - drag.y0) * 0.2;
        if (Math.abs(dx) > 6) drag.moved = true;
        const now = performance.now();
        drag.hist.push([p.x, now]);
        while (drag.hist.length > 2 && now - drag.hist[0][1] > 90) drag.hist.shift();
        const rot = (dx / G.w) * 16;
        cards[idx].style.transform = `translate(${dx}px, ${dy}px) rotate(${rot}deg)`;
        setLean(dx / threshold());
        dirty = true;
      },
      up(p, e, cancelled) {
        if (state !== 'drag' || !drag) return;
        const c = cards[idx];
        c.classList.remove('is-drag');
        const dx = p.x - drag.x0;
        const h0 = drag.hist[0];
        const vx = h0 ? (p.x - h0[0]) / Math.max(16, performance.now() - h0[1]) : 0;
        drag = null;
        state = 'idle';
        if (!cancelled && (Math.abs(dx) > threshold() || (Math.abs(vx) > 0.55 && Math.abs(dx) > 24 && Math.sign(vx) === Math.sign(dx)))) {
          choose(dx > 0 ? 'vie' : 'avant');
          return;
        }
        /* retour à la pile */
        placeCard(c, 0);
        setLean(0);
        dirty = true;
        if (!cancelled && p.tap) {
          /* une simple tape : la carte frétille pour montrer qu'elle se glisse */
          wob = 1;
          c.classList.add('is-wob');
          api.sfx.play('tick', { pitch: 0.9 });
          api.gesture('swipe', { x: 50, y: 45 });
        }
      },
    }, { touchAction: 'pan-y' });

    btnAvant.addEventListener('click', () => onButton('avant'));
    btnVie.addEventListener('click', () => onButton('vie'));
    function onButton(side) {
      if (state === 'banner') { closeBanner(); return; }
      /* la tape qui vient de fermer le bandeau ne répond pas à la carte suivante */
      if (state !== 'idle' || performance.now() - dismissedAt < 380) return;
      api.gesture(null);
      choose(side);
    }
    /* Toute nouvelle tape dans la scène ferme le bandeau. */
    let dismissedAt = -1e9;
    stage.addEventListener('pointerdown', () => {
      if (state === 'banner' || state === 'info') {
        dismissedAt = performance.now();
        closeBanner();
      }
    }, true);
    stage.addEventListener('keydown', (e) => {
      if ((state === 'banner' || state === 'info') && (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape')) {
        dismissedAt = performance.now();
        closeBanner();
        e.preventDefault();
      }
    }, true);

    /* ---- choix ---- */
    function choose(side) {
      const c = cards[idx];
      if (!c) return;
      const m = MINERAUX[order[idx]];
      const ok = m.vie === (side === 'vie');
      if (ok) score++;
      answers.push({ k: order[idx], ok });
      state = 'fly';
      setLean(side === 'vie' ? 1 : -1);
      c.classList.add('is-fly');
      const dir = side === 'vie' ? 1 : -1;
      const cur = c.style.transform;
      const m2 = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(cur || '');
      const y = m2 ? parseFloat(m2[2]) : 0;
      c.style.transform = `translate(${dir * (G.w + G.cw * 0.6)}px, ${y - 30}px) rotate(${dir * 26}deg)`;
      c.style.opacity = '0';
      api.sfx.play('whoosh', { pitch: dir > 0 ? 1.15 : 0.9, volume: 0.6 });
      burst(dir, ok, m.id);
      pending = { ok, m, t: 0.16 };
      api.progress(answers.length / N);
      api.status(TEXTES.score(score, N));
      if (ok) {
        api.sfx.play('chime', { pitch: rand(0.95, 1.1) });
        api.buzz(8);
      } else {
        api.sfx.play('fail');
        api.buzz(14);
      }
      dirty = true;
    }

    function showBanner(ok, m, info) {
      if (info) {
        verdictEl.textContent = m.nom;
        panel.style.setProperty('--mn-vc', m.vie ? COL_VIE : COL_AVANT);
      } else {
        verdictEl.textContent = lib.fr(ok ? TEXTES.exact : TEXTES.faux);
        panel.style.setProperty('--mn-vc', ok ? COL_VIE : COL_AVANT);
      }
      explainEl.textContent = lib.fr(m.explication);
      banner.classList.add('is-on');
      panel.classList.remove('is-shake');
      if (!ok && !info && !RM_) {
        void panel.offsetWidth;
        panel.classList.add('is-shake');
      }
      bannerDur = clamp(m.explication.length * BANDEAU_PAR_CAR, BANDEAU_MIN, BANDEAU_MAX);
      bannerT = 0;
      if (state === 'fly' || state === 'banner') state = 'banner';
      else state = info ? 'info' : 'banner';
      bannerNext = !info;
    }

    function closeBanner() {
      banner.classList.remove('is-on');
      const wasNext = bannerNext;
      bannerNext = false;
      if (state === 'info') {
        state = 'done';
        return;
      }
      state = 'idle';
      if (wasNext) nextCard();
    }

    function nextCard() {
      const c = cards[idx];
      if (c) c.style.display = 'none';
      idx++;
      setLean(0);
      placeAll();
      labelButtons();
      if (idx >= N) finish();
    }

    /* ---- fin : la collection triée ---- */
    function finish() {
      state = 'done';
      bar.style.visibility = 'hidden';
      coll.innerHTML = '';
      const cols = [false, true].map((vie) => {
        const col = document.createElement('div');
        col.className = 'mn-col';
        const head = document.createElement('p');
        head.className = 'mn-colhead';
        head.style.background = vie ? COL_VIE : COL_AVANT;
        head.textContent = vie ? TEXTES.vie : TEXTES.avant;
        col.appendChild(head);
        coll.appendChild(col);
        return col;
      });
      const rowsH = G.wide ? G.h - 100 : (G.h - 110) / 3 - 16;
      /* la vignette laisse toujours la place d'écrire le nom en entier */
      const colW = (G.w - 34) / 2;
      const th = Math.round(clamp(Math.min(G.wide ? rowsH / 3 - 16 : rowsH, colW * 0.34), 32, 76));
      let n = 0;
      MINERAUX.forEach((m, k) => {
        const ans = answers.find((a) => a.k === k);
        const ok = !ans || ans.ok;
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'mn-item' + (ok ? '' : ' is-wrong');
        b.style.animationDelay = (0.08 * n++) + 's';
        const t = document.createElement('canvas');
        t.setAttribute('aria-hidden', 'true');
        const s = document.createElement('span');
        s.className = 'mn-iname';
        s.textContent = m.nom;
        const mark = document.createElement('span');
        mark.className = 'mn-mark';
        mark.innerHTML = ok ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 12.5l4 4 9-9"/></svg>'
          : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6.5v7"/><path d="M12 17.6v.2"/></svg>';
        const sr = document.createElement('span');
        sr.className = 'mn-sr';
        sr.textContent = ok ? TEXTES.bienTrie : TEXTES.malTrie;
        mark.appendChild(sr);
        b.append(t, s, mark);
        b.addEventListener('click', () => {
          if (state !== 'done') return;
          api.sfx.play('pop', { pitch: rand(0.9, 1.2) });
          showBanner(true, m, true);
        });
        cols[m.vie ? 1 : 0].appendChild(b);
        paintArt(t, m.id, th, th, cv.dpr, true);
      });
      coll.classList.add('is-on');
      api.done(TEXTES.fin(score, N), TEXTES.finStatut);
    }

    /* ---- étincelles ---- */
    function burst(dir, ok, id) {
      const x = dir > 0 ? G.w - 26 : 26;
      const y = G.cy + G.ch * 0.45;
      const col = ok ? TEINTE[id] : '#9AA8B5';
      const n = ok ? 34 : 10;
      for (let i = 0; i < n && sparks.length < 120; i++) {
        const a = (dir > 0 ? Math.PI : 0) + rand(-1.1, 1.1);
        const sp = rand(60, ok ? 260 : 90);
        sparks.push({ x, y: y + rand(-40, 40), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - rand(20, 90), t: 0, life: rand(0.5, 1.1), s: rand(1.5, 3.4), col, star: ok && Math.random() < 0.3 });
      }
    }

    /* ---- boucle ---- */
    let fxClear = true;
    function render() {
      if (dirty || Math.abs(leanShown - lean) > 0.002) {
        leanShown += (lean - leanShown) * 0.3;
        if (Math.abs(leanShown - lean) < 0.003) leanShown = lean;
        const { w, h } = G;
        if (bg) ctx.drawImage(bg, 0, 0, w, h);
        const l = Math.max(0, -leanShown), r = Math.max(0, leanShown);
        ctx.save();
        ctx.translate(0, h * 0.42);
        ctx.scale(0.55, 1);
        draw.glow(ctx, 0, 0, h * 0.6, COL_AVANT, 0.1 + 0.32 * l);
        ctx.restore();
        ctx.save();
        ctx.translate(w, h * 0.42);
        ctx.scale(0.55, 1);
        draw.glow(ctx, 0, 0, h * 0.6, COL_VIE, 0.1 + 0.32 * r);
        ctx.restore();
        dirty = false;
      }
      if (sparks.length || !fxClear) {
        fctx.clearRect(0, 0, G.w, G.h);
        fctx.globalCompositeOperation = 'lighter';
        for (const s of sparks) {
          const k = 1 - s.t / s.life;
          if (s.star) {
            fctx.fillStyle = rgba('#FFFFFF', 0.9 * k);
            const r = s.s * 2 * k;
            fctx.fillRect(s.x - r, s.y - 0.6, r * 2, 1.2);
            fctx.fillRect(s.x - 0.6, s.y - r, 1.2, r * 2);
          }
          draw.glow(fctx, s.x, s.y, s.s * 3, s.col, 0.8 * k);
        }
        fctx.globalCompositeOperation = 'source-over';
        fxClear = sparks.length === 0;
      }
    }

    function update(dt) {
      time += dt;
      if (state === 'banner' || state === 'info') {
        bannerT += dt;
        const k = clamp(bannerT / bannerDur);
        timerEl.style.transform = `scaleX(${1 - k})`;
        if (k >= 1) closeBanner();
      }
      if (pending) {
        pending.t -= dt;
        if (pending.t <= 0) {
          const p = pending;
          pending = null;
          showBanner(p.ok, p.m);
        }
      }
      if (wob > 0 && cards[idx]) {
        const c = cards[idx];
        if (state !== 'idle') {
          wob = 0;
          c.classList.remove('is-wob');
        } else {
          wob = Math.max(0, wob - dt * 2.2);
          const a = Math.sin((1 - wob) * Math.PI * 4) * 4 * wob;
          c.style.transform = wob > 0 ? `rotate(${a.toFixed(2)}deg)` : 'none';
          if (wob === 0) c.classList.remove('is-wob');
        }
      }
      let j = 0;
      for (const s of sparks) {
        s.t += dt;
        if (s.t >= s.life) continue;
        s.vy += 220 * dt;
        s.vx *= Math.pow(0.3, dt);
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        sparks[j++] = s;
      }
      sparks.length = j;
    }

    function init() {
      order = shuffle();
      idx = 0;
      score = 0;
      answers = [];
      state = 'idle';
      drag = null;
      sparks = [];
      lean = 0;
      leanShown = 0;
      wob = 0;
      pending = null;
      bannerNext = false;
      banner.classList.remove('is-on');
      coll.classList.remove('is-on');
      coll.innerHTML = '';
      bar.style.visibility = '';
      buildCards();
      setLean(0);
      api.status(TEXTES.score(0, N));
      dirty = true;
      api.gesture('swipe', { x: 50, y: 45 });
    }

    api.loop((dt) => {
      update(dt);
      render();
    });
    api.onReset(init);
    init();
    render();
  };
})();
