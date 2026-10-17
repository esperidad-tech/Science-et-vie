/* Les déchets radioactifs : une coupe du sol, du centre de stockage en surface jusqu'à la
   couche d'argile, à 500 m de profondeur. On range chaque déchet au bon endroit. */
(function () {
  'use strict';
  const { lib } = window.RM;
  const { TAU, rand, clamp, lerp, ease, rgba, mix, draw } = lib;

  /* ---------------- Les déchets (textes faciles à corriger) ----------------
     ou : 'surface' ou 'profond' ; barres : niveau de radioactivité dessiné sur la carte (1 à 4). */
  const DECHETS = [
    {
      id: 'gants', nom: 'Gants et combinaisons', niveau: 'Très faible activité', barres: 1, ou: 'surface',
      explication: 'Très peu radioactifs : ils sont stockés en surface.',
    },
    {
      id: 'outils', nom: 'Outils et filtres', niveau: 'Faible et moyenne activité, vie courte', barres: 2, ou: 'surface',
      explication: 'Leur radioactivité baisse en quelques centaines d’années : stockage en surface, sous surveillance.',
    },
    {
      id: 'pieces', nom: 'Pièces métalliques du réacteur', niveau: 'Moyenne activité, vie longue', barres: 3, ou: 'profond',
      explication: 'Radioactifs très longtemps : ils iront dans l’argile, à 500 m.',
    },
    {
      id: 'verre', nom: 'Colis de verre', niveau: 'Haute activité', barres: 4, ou: 'profond',
      explication: 'Les plus dangereux : coulés dans du verre, ils iront à 500 m sous terre.',
    },
  ];

  /* Tous les autres textes du jeu */
  const TEXTES = {
    surface: 'En surface',
    profond: 'À 500 m sous terre',
    bien: 'Bien rangé !',
    faux: 'Pas là !',
    range: (n, t) => `Déchets rangés : ${n} sur ${t}`,
    boutonSurface: (nom) => `Ranger « ${nom} » en surface`,
    boutonProfond: (nom) => `Ranger « ${nom} » à 500 m sous terre`,
    niveauAria: (n) => `Radioactivité : ${n} sur 4`,
    echelleHaut: '0 m',
    echelleBas: '500 m',
    tagSurface: 'Centre de stockage',
    tagProfond: 'Cigéo, à Bure',
    volume: 'Volume',
    radio: 'Radioactivité',
    haute: 'Haute activité',
    autres: 'Autres déchets',
    pctVolume: 'environ 0,2 %',
    pctRadio: 'environ 97 %',
    piscines: 'En France, tous les déchets de haute activité réunis : environ 4 700 m³, à peu près deux piscines olympiques.',
    fin: 'Chaque déchet est rangé au bon endroit.',
    finStatut: 'Les plus dangereux sont tout petits en volume, mais doivent rester isolés pendant des milliers d’années.',
  };

  /* Durée d'affichage de l'explication (elle se ferme aussi à la tape suivante) */
  const BULLE_MIN = 2.6;
  const BULLE_PAR_CAR = 0.04;
  const BULLE_MAX = 4.8;

  const BLEU = '#2F6E9E';       /* --accent du chapitre */
  const TERRE = '#C2502A';      /* --accent-2 */
  const ENCRE = '#2B241F';

  function seeded(seed) {
    let s = seed >>> 0 || 1;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }
  /* typographie : « 4 700 m³ » et « 97 % » ne se coupent jamais en fin de ligne */
  function insec(t) {
    return lib.fr(t).replace(/(\d) (?=\d{3}\b)/g, '$1 ').replace(/(\d) (m³|%)/g, '$1 $2');
  }
  function shade(hex, k, a = 1) {
    k = clamp(k, -1, 1);
    return k >= 0 ? mix(hex, '#FFFFFF', k, a) : mix(hex, '#000000', -k, a);
  }

  /* ================= Illustrations des cartes (coordonnées -1..1) ================= */
  function steelGrad(g, x0, x1, base) {
    const gr = g.createLinearGradient(x0, 0, x1, 0);
    gr.addColorStop(0, shade(base, -0.28));
    gr.addColorStop(0.28, shade(base, 0.55));
    gr.addColorStop(0.5, shade(base, 0.12));
    gr.addColorStop(1, shade(base, -0.38));
    return gr;
  }
  function capsule(g, x1, y1, x2, y2, r, col, hi) {
    g.lineCap = 'round';
    g.strokeStyle = col;
    g.lineWidth = r * 2;
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.stroke();
    if (hi) {
      g.strokeStyle = hi;
      g.lineWidth = r * 0.55;
      g.beginPath();
      g.moveTo(x1 - r * 0.35, y1);
      g.lineTo(x2 - r * 0.35, y2);
      g.stroke();
    }
  }

  function glove(g, x, y, s, ang, col) {
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    g.scale(s, s);
    const dark = shade(col, -0.22), hi = shade(col, 0.35, 0.8);
    /* doigts et pouce */
    capsule(g, -0.3, -0.05, -0.36, -0.72, 0.13, dark);
    capsule(g, -0.1, -0.05, -0.12, -0.9, 0.135, col, hi);
    capsule(g, 0.11, -0.05, 0.12, -0.86, 0.135, col, hi);
    capsule(g, 0.31, -0.05, 0.35, -0.66, 0.125, dark);
    capsule(g, -0.38, 0.28, -0.78, -0.12, 0.14, col, hi);
    /* paume */
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(-0.44, 0.55);
    g.lineTo(-0.46, -0.04);
    g.quadraticCurveTo(-0.45, -0.2, -0.28, -0.2);
    g.lineTo(0.3, -0.2);
    g.quadraticCurveTo(0.46, -0.2, 0.45, -0.04);
    g.lineTo(0.42, 0.55);
    g.closePath();
    g.fill();
    g.fillStyle = hi;
    g.fillRect(-0.3, -0.12, 0.16, 0.5);
    /* manchette */
    g.fillStyle = dark;
    draw.roundRect(g, -0.47, 0.5, 0.92, 0.42, 0.1);
    g.fill();
    g.fillStyle = shade(col, -0.35);
    g.fillRect(-0.47, 0.58, 0.92, 0.05);
    g.restore();
  }

  function drawGants(g) {
    /* combinaison de protection posée à plat */
    const suit = '#F7F4EE', suitShade = '#D4CCBE', trim = '#3D80B9';
    g.save();
    g.translate(-0.16, -0.04);
    capsule(g, -0.26, -0.3, -0.72, 0.14, 0.13, suitShade);
    capsule(g, 0.26, -0.3, 0.66, 0.1, 0.13, suitShade);
    capsule(g, -0.25, -0.31, -0.69, 0.11, 0.105, suit);
    capsule(g, 0.25, -0.31, 0.63, 0.07, 0.105, suit);
    capsule(g, -0.15, 0.3, -0.25, 0.86, 0.15, suitShade);
    capsule(g, 0.15, 0.3, 0.25, 0.86, 0.15, suitShade);
    capsule(g, -0.15, 0.3, -0.24, 0.84, 0.12, suit);
    capsule(g, 0.15, 0.3, 0.24, 0.84, 0.12, suit);
    const gr = g.createLinearGradient(-0.32, 0, 0.32, 0);
    gr.addColorStop(0, suitShade);
    gr.addColorStop(0.3, suit);
    gr.addColorStop(1, suitShade);
    g.fillStyle = gr;
    draw.roundRect(g, -0.32, -0.44, 0.64, 0.86, 0.16);
    g.fill();
    /* capuche */
    g.fillStyle = suitShade;
    g.beginPath();
    g.ellipse(0, -0.56, 0.2, 0.17, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#C9C0B2';
    g.beginPath();
    g.ellipse(0, -0.54, 0.12, 0.1, 0, 0, TAU);
    g.fill();
    /* fermeture éclair, poignets et chevilles */
    g.strokeStyle = '#9C9384';
    g.lineWidth = 0.035;
    g.beginPath();
    g.moveTo(0, -0.42);
    g.lineTo(0, 0.3);
    g.stroke();
    g.strokeStyle = trim;
    g.lineWidth = 0.09;
    g.lineCap = 'butt';
    for (const [x, y, a] of [[-0.7, 0.13, 0.9], [0.64, 0.09, -0.85], [-0.245, 0.9, 0.1], [0.245, 0.9, -0.1]]) {
      g.beginPath();
      g.moveTo(x - Math.cos(a) * 0.1, y - Math.sin(a) * 0.1);
      g.lineTo(x + Math.cos(a) * 0.1, y + Math.sin(a) * 0.1);
      g.stroke();
    }
    g.restore();
    /* deux gants */
    glove(g, 0.5, 0.36, 0.36, -0.55, '#F0B43C');
    glove(g, 0.66, 0.56, 0.34, -0.12, '#E39A2A');
  }

  function drawOutils(g) {
    /* cartouche de filtre plissée */
    const x0 = -0.62, x1 = -0.06, y0 = -0.62, y1 = 0.7;
    const gr = g.createLinearGradient(x0, 0, x1, 0);
    gr.addColorStop(0, '#CDB46E');
    gr.addColorStop(0.35, '#F3E3A8');
    gr.addColorStop(1, '#B89A52');
    g.fillStyle = gr;
    g.fillRect(x0, y0, x1 - x0, y1 - y0);
    g.lineWidth = 0.022;
    for (let i = 1; i < 12; i++) {
      const x = lerp(x0, x1, i / 12);
      g.strokeStyle = i % 2 ? 'rgba(120,92,36,0.45)' : 'rgba(255,250,225,0.6)';
      g.beginPath();
      g.moveTo(x, y0);
      g.lineTo(x, y1);
      g.stroke();
    }
    /* embouts métalliques */
    g.fillStyle = steelGrad(g, x0 - 0.04, x1 + 0.04, '#8E98A3');
    draw.roundRect(g, x0 - 0.04, y0 - 0.12, x1 - x0 + 0.08, 0.14, 0.04);
    g.fill();
    draw.roundRect(g, x0 - 0.04, y1 - 0.02, x1 - x0 + 0.08, 0.14, 0.04);
    g.fill();
    g.fillStyle = '#4F5862';
    g.beginPath();
    g.ellipse((x0 + x1) / 2, y0 - 0.12, 0.12, 0.035, 0, 0, TAU);
    g.fill();
    /* clé plate, en diagonale devant */
    g.save();
    g.translate(0.3, 0.14);
    g.rotate(0.62);
    const R = 0.21, a0 = Math.asin(0.085 / R);
    g.beginPath();
    g.arc(0, -0.62, R, -Math.PI / 2 + a0, Math.PI * 1.5 - a0);
    g.lineTo(-0.085, -0.6);
    g.lineTo(0.085, -0.6);
    g.closePath();
    g.fillStyle = steelGrad(g, -R, R, '#9AA4AE');
    g.fill();
    draw.roundRect(g, -0.08, -0.48, 0.16, 1.18, 0.08);
    g.fill();
    g.beginPath();
    g.arc(0, 0.6, 0.16, 0, TAU);
    g.fill();
    g.fillStyle = '#E8DFCF';
    g.beginPath();
    g.arc(0, 0.6, 0.075, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.75)';
    g.lineWidth = 0.025;
    g.beginPath();
    g.moveTo(-0.035, -0.42);
    g.lineTo(-0.035, 0.42);
    g.stroke();
    g.restore();
  }

  function drawPieces(g) {
    /* plaque perforée */
    g.save();
    g.translate(-0.22, -0.22);
    g.rotate(-0.12);
    g.fillStyle = steelGrad(g, -0.5, 0.5, '#8C939A');
    draw.roundRect(g, -0.5, -0.42, 1.0, 0.84, 0.06);
    g.fill();
    for (let j = 0; j < 4; j++) {
      for (let i = 0; i < 5; i++) {
        const x = -0.36 + i * 0.18 + (j % 2) * 0.09, y = -0.28 + j * 0.18;
        g.fillStyle = '#4A5056';
        g.beginPath();
        g.arc(x, y, 0.05, 0, TAU);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.35)';
        g.beginPath();
        g.arc(x + 0.012, y + 0.018, 0.05, 0.2, Math.PI - 0.2);
        g.fill();
      }
    }
    g.restore();
    /* gros tube couché, vu de trois quarts */
    const cx = 0.12, cy = 0.36, L = 0.62, r = 0.27;
    g.fillStyle = steelGrad(g, 0, 0, '#A2AAB2');
    const body = g.createLinearGradient(0, cy - r, 0, cy + r);
    body.addColorStop(0, '#7F878F');
    body.addColorStop(0.3, '#E4E8EB');
    body.addColorStop(0.55, '#A9B1B8');
    body.addColorStop(1, '#5E666E');
    g.fillStyle = body;
    g.beginPath();
    g.moveTo(cx - L / 2, cy - r);
    g.lineTo(cx + L / 2, cy - r);
    g.ellipse(cx + L / 2, cy, r * 0.42, r, 0, -Math.PI / 2, Math.PI / 2);
    g.lineTo(cx - L / 2, cy + r);
    g.closePath();
    g.fill();
    /* bout ouvert : on voit l'épaisseur du métal */
    g.fillStyle = '#C3C9CE';
    g.beginPath();
    g.ellipse(cx - L / 2, cy, r * 0.42, r, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#3F454B';
    g.beginPath();
    g.ellipse(cx - L / 2, cy, r * 0.27, r * 0.66, 0, 0, TAU);
    g.fill();
    /* écrous */
    for (const [x, y, s] of [[0.66, -0.36, 0.13], [0.52, -0.62, 0.1]]) {
      g.fillStyle = steelGrad(g, x - s, x + s, '#9AA2AA');
      g.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = k * TAU / 6 + 0.3;
        g.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
      }
      g.closePath();
      g.fill();
      g.fillStyle = '#4D545B';
      g.beginPath();
      g.arc(x, y, s * 0.45, 0, TAU);
      g.fill();
    }
  }

  function drawVerre(g) {
    /* conteneur en acier inoxydable, découpé pour montrer le verre */
    const hw = 0.36, top = -0.58, bot = 0.8;
    g.fillStyle = steelGrad(g, -hw, hw, '#A9B2BA');
    g.beginPath();
    g.moveTo(-hw, top);
    g.lineTo(-hw, bot);
    g.ellipse(0, bot, hw, 0.09, 0, Math.PI, 0, true);
    g.lineTo(hw, top);
    g.closePath();
    g.fill();
    /* collerette et poignée de levage */
    g.fillStyle = '#C9D0D6';
    g.beginPath();
    g.ellipse(0, top, hw, 0.09, 0, 0, TAU);
    g.fill();
    g.fillStyle = steelGrad(g, -0.1, 0.1, '#8E979F');
    g.fillRect(-0.09, top - 0.2, 0.18, 0.2);
    g.fillStyle = steelGrad(g, -0.2, 0.2, '#A1AAB2');
    g.beginPath();
    g.ellipse(0, top - 0.22, 0.2, 0.07, 0, 0, TAU);
    g.fill();
    /* fenêtre de coupe : le verre, sombre et brillant */
    const wx0 = -0.22, wx1 = 0.2, wy0 = -0.36, wy1 = 0.6;
    g.save();
    g.beginPath();
    g.moveTo(wx0, wy0);
    g.lineTo(wx1, wy0 - 0.03);
    g.lineTo(wx1, wy1);
    g.lineTo(wx0, wy1 + 0.03);
    g.closePath();
    g.clip();
    const gl = g.createLinearGradient(wx0, 0, wx1, 0);
    gl.addColorStop(0, '#0E1916');
    gl.addColorStop(0.45, '#2D4640');
    gl.addColorStop(1, '#101C19');
    g.fillStyle = gl;
    g.fillRect(wx0, wy0 - 0.05, wx1 - wx0, wy1 - wy0 + 0.1);
    const r = seeded(4);
    for (let i = 0; i < 9; i++) {
      g.strokeStyle = `rgba(150,200,185,${0.08 + r() * 0.14})`;
      g.lineWidth = 0.02 + r() * 0.02;
      g.beginPath();
      const y = lerp(wy0, wy1, r());
      g.moveTo(wx0, y);
      g.bezierCurveTo(wx0 + 0.15, y - 0.06, wx1 - 0.15, y + 0.08, wx1, y + (r() - 0.5) * 0.1);
      g.stroke();
    }
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.fillRect(wx0 + 0.06, wy0 + 0.04, 0.035, wy1 - wy0 - 0.12);
    g.restore();
    /* bord de la découpe */
    g.strokeStyle = 'rgba(255,255,255,0.7)';
    g.lineWidth = 0.03;
    g.beginPath();
    g.moveTo(wx0, wy0);
    g.lineTo(wx1, wy0 - 0.03);
    g.lineTo(wx1, wy1);
    g.lineTo(wx0, wy1 + 0.03);
    g.closePath();
    g.stroke();
    /* reflet vertical sur l'acier */
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.fillRect(hw - 0.1, top + 0.06, 0.04, bot - top - 0.12);
  }

  const PAINT = { gants: drawGants, outils: drawOutils, pieces: drawPieces, verre: drawVerre };

  function paintArt(cvs, id, size, dpr) {
    cvs.width = Math.max(1, Math.round(size * dpr));
    cvs.height = Math.max(1, Math.round(size * dpr));
    cvs.style.width = size + 'px';
    cvs.style.height = size + 'px';
    const g = cvs.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const bg = g.createRadialGradient(size * 0.45, size * 0.38, 2, size / 2, size / 2, size * 0.75);
    bg.addColorStop(0, '#FFFFFF');
    bg.addColorStop(0.55, '#F1EBDF');
    bg.addColorStop(1, '#DED4C2');
    g.fillStyle = bg;
    g.fillRect(0, 0, size, size);
    g.save();
    g.translate(size / 2, size * 0.86);
    g.scale(1, 0.16);
    draw.glow(g, 0, 0, size * 0.42, '#5A4632', 0.32);
    g.restore();
    const s = size * 0.4;
    g.save();
    g.translate(size / 2, size * 0.5);
    g.scale(s, s);
    PAINT[id](g);
    g.restore();
  }

  /* ================= Petits colis rangés dans la scène ================= */
  function drawPackage(g, id, x, y, s) {
    /* (x, y) : milieu du bas du colis ; s : échelle (px) */
    g.save();
    g.translate(x, y);
    g.fillStyle = 'rgba(40,30,20,0.25)';
    g.beginPath();
    g.ellipse(0, 0, 7 * s, 1.6 * s, 0, 0, TAU);
    g.fill();
    if (id === 'gants') {
      /* grand sac souple */
      const gr = g.createLinearGradient(-6 * s, 0, 6 * s, 0);
      gr.addColorStop(0, '#E9E4DA');
      gr.addColorStop(0.35, '#FBF9F4');
      gr.addColorStop(1, '#C8C0B2');
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(-6 * s, 0);
      g.quadraticCurveTo(-7 * s, -5 * s, -5.6 * s, -10 * s);
      g.lineTo(5.6 * s, -10 * s);
      g.quadraticCurveTo(7 * s, -5 * s, 6 * s, 0);
      g.closePath();
      g.fill();
      g.strokeStyle = BLEU;
      g.lineWidth = 1.1 * s;
      g.beginPath();
      g.moveTo(-4.4 * s, -10 * s);
      g.lineTo(-3.6 * s, -12.4 * s);
      g.moveTo(4.4 * s, -10 * s);
      g.lineTo(3.6 * s, -12.4 * s);
      g.stroke();
    } else if (id === 'outils') {
      /* fût métallique */
      const gr = g.createLinearGradient(-5 * s, 0, 5 * s, 0);
      gr.addColorStop(0, '#5D6C79');
      gr.addColorStop(0.3, '#B4C1CC');
      gr.addColorStop(1, '#4C5966');
      g.fillStyle = gr;
      g.fillRect(-5 * s, -12 * s, 10 * s, 12 * s);
      g.fillStyle = 'rgba(30,40,50,0.35)';
      g.fillRect(-5 * s, -8.5 * s, 10 * s, 0.9 * s);
      g.fillRect(-5 * s, -4 * s, 10 * s, 0.9 * s);
      g.fillStyle = '#93A2AF';
      g.beginPath();
      g.ellipse(0, -12 * s, 5 * s, 1.4 * s, 0, 0, TAU);
      g.fill();
    } else if (id === 'pieces') {
      /* conteneur en béton */
      const gr = g.createLinearGradient(-6.5 * s, 0, 6.5 * s, 0);
      gr.addColorStop(0, '#9A968E');
      gr.addColorStop(0.3, '#D6D2CA');
      gr.addColorStop(1, '#85817A');
      g.fillStyle = gr;
      g.fillRect(-6.5 * s, -11 * s, 13 * s, 11 * s);
      g.fillStyle = '#C3BFB7';
      g.fillRect(-7 * s, -12.4 * s, 14 * s, 1.8 * s);
      g.fillStyle = 'rgba(60,55,50,0.25)';
      g.fillRect(-6.5 * s, -6 * s, 13 * s, 0.7 * s);
    } else {
      /* colis de verre : conteneur inox élancé */
      const gr = g.createLinearGradient(-3.4 * s, 0, 3.4 * s, 0);
      gr.addColorStop(0, '#79838C');
      gr.addColorStop(0.3, '#EEF2F4');
      gr.addColorStop(1, '#6C757E');
      g.fillStyle = gr;
      g.fillRect(-3.4 * s, -13 * s, 6.8 * s, 13 * s);
      g.fillStyle = '#C9D0D6';
      g.beginPath();
      g.ellipse(0, -13 * s, 3.4 * s, 1 * s, 0, 0, TAU);
      g.fill();
      g.fillStyle = '#8E979F';
      g.fillRect(-1 * s, -15.2 * s, 2 * s, 2.2 * s);
    }
    g.restore();
  }

  const PG = '.game[data-game="dechets"]';
  const CSS = `
${PG} .dc-card { position: absolute; z-index: 4; left: 0; top: 0; display: flex; align-items: center; gap: 10px; padding: 8px 12px 8px 8px;
  background: #FFFDF8; color: ${ENCRE}; border-radius: 20px 24px 22px 18px / 18px 21px 24px 22px;
  box-shadow: 0 1px 0 rgba(255,255,255,0.9) inset, 0 16px 28px -16px rgba(60,40,20,0.6), 0 2px 6px rgba(60,40,20,0.16), 0 0 0 1px rgba(43,36,31,0.06);
  cursor: grab; will-change: transform; transform-origin: 50% 50%; -webkit-touch-callout: none; }
${PG} .dc-card.is-drag { cursor: grabbing; box-shadow: 0 26px 36px -18px rgba(60,40,20,0.65), 0 0 0 2px rgba(47,110,158,0.35); }
${PG} .dc-card.is-back { transition: transform 0.38s cubic-bezier(0.2, 0.9, 0.25, 1.15); }
${PG} .dc-card.is-in { animation: dc-in 0.55s cubic-bezier(0.2, 0.85, 0.25, 1.1) both; }
${PG} .dc-card.is-shake { animation: dc-shake 0.45s ease-in-out; }
${PG} .dc-card.is-wob { animation: dc-wob 0.5s ease-in-out; }
${PG} .dc-card.is-gone { transition: transform 0.2s ease-in, opacity 0.2s ease-in; opacity: 0; pointer-events: none; }
@keyframes dc-in { from { transform: translateX(120%) rotate(8deg); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes dc-shake { 0%, 100% { transform: translateX(0); } 18% { transform: translateX(-9px) rotate(-2deg); } 36% { transform: translateX(8px) rotate(2deg); } 54% { transform: translateX(-5px); } 72% { transform: translateX(3px); } }
@keyframes dc-wob { 0%, 100% { transform: none; } 30% { transform: translateY(5px) rotate(-1.5deg); } 60% { transform: translateY(-2px) rotate(1deg); } }
${PG} .dc-art { flex: none; display: block; border-radius: 14px 16px 15px 13px; box-shadow: inset 0 0 0 1px rgba(43,36,31,0.06); }
${PG} .dc-txt { min-width: 0; display: grid; gap: 4px; }
${PG} .dc-name { margin: 0; font: 800 var(--dc-fs, 1.0625rem)/1.12 var(--font-display); font-variation-settings: "SOFT" 100; letter-spacing: -0.01em; color: ${ENCRE}; }
${PG} .dc-lvl { margin: 0; font-size: 0.8125rem; line-height: 1.25; color: #5E544B; }
${PG} .dc-meter { display: flex; gap: 3px; margin-top: 1px; }
${PG} .dc-meter i { width: 15px; height: 6px; border-radius: 3px 2px 3px 2px; background: rgba(43,36,31,0.13); }
${PG} .dc-meter i.on { background: ${TERRE}; }
${PG} .dc-bar { position: absolute; z-index: 3; left: 8px; right: 8px; bottom: 8px; display: flex; gap: 8px; transition: opacity 0.4s, transform 0.4s; }
${PG} .dc-bar.is-gone { opacity: 0; transform: translateY(12px); pointer-events: none; }
${PG} .dc-bar .chip { flex: 1 1 auto; min-width: 0; padding-inline: 10px; gap: 6px; white-space: nowrap; transition: background-color 0.2s, color 0.2s, box-shadow 0.2s, transform 0.15s; }
${PG} .dc-bar .chip svg { width: 20px; height: 20px; flex: none; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
${PG} .dc-bar .chip.is-hot { background: ${BLEU}; color: #FFFDF8; box-shadow: 0 0 0 3px rgba(255,253,248,0.7), 0 8px 18px -8px rgba(0,0,0,0.6); transform: translateY(-2px); }
${PG} .dc-bar.is-narrow .chip { font-size: 0.875rem; padding-inline: 5px; gap: 4px; }
${PG} .dc-bar.is-narrow .chip svg { width: 17px; height: 17px; }
${PG} .dc-tag { position: absolute; z-index: 2; margin: 0; padding: 3px 8px 4px; border-radius: 9px 11px 10px 8px; pointer-events: none; white-space: nowrap;
  font: 700 0.6875rem/1.1 var(--font-text); letter-spacing: 0.01em; color: ${ENCRE}; background: rgba(255,253,248,0.82); box-shadow: 0 2px 6px -3px rgba(43,36,31,0.4); }
${PG} .dc-tag--deep { color: #F4F1EA; background: rgba(43,52,62,0.72); }
${PG} .dc-tag--depth { padding: 2px 6px 3px; font-variant-numeric: tabular-nums; }
${PG} .dc-tip { position: absolute; z-index: 5; left: 0; top: 0; padding: 10px 14px 12px; overflow: hidden; pointer-events: none;
  background: #FFFDF8; color: ${ENCRE}; border-radius: 18px 22px 20px 17px / 17px 19px 22px 20px;
  box-shadow: inset 4px 0 0 var(--dc-vc, ${BLEU}), 0 18px 30px -16px rgba(60,40,20,0.7), 0 0 0 1px rgba(43,36,31,0.06);
  opacity: 0; transform: translateY(8px) scale(0.98); transition: opacity 0.22s, transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1); }
${PG} .dc-tip.is-on { opacity: 1; transform: none; }
${PG} .dc-tip.is-shake { animation: dc-shake 0.42s ease-in-out; }
${PG} .dc-verdict { margin: 0 0 3px; font: 800 1.25rem/1.1 var(--font-display); font-variation-settings: "SOFT" 100; color: var(--dc-vc, ${BLEU}); }
${PG} .dc-explain { margin: 0; font-size: 0.9375rem; line-height: 1.38; }
${PG} .dc-timer { position: absolute; left: 0; bottom: 0; height: 3px; width: 100%; background: var(--dc-vc, ${BLEU}); transform-origin: 0 50%; opacity: 0.8; }
${PG} .dc-info { position: absolute; z-index: 5; left: 8px; right: 8px; top: 0; padding: 12px 14px 12px; pointer-events: none;
  background: rgba(255,253,248,0.96); color: ${ENCRE}; border-radius: 20px 24px 22px 18px / 18px 21px 24px 22px;
  box-shadow: 0 20px 34px -18px rgba(60,40,20,0.7), 0 0 0 1px rgba(43,36,31,0.07);
  opacity: 0; visibility: hidden; transform: translateY(10px); transition: opacity 0.35s, transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), visibility 0s linear 0.4s; }
${PG} .dc-info.is-on { opacity: 1; visibility: visible; transform: none; transition: opacity 0.35s, transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1); }
${PG} .dc-row { display: grid; grid-template-columns: var(--dc-lw, 6.8rem) minmax(0, 1fr); align-items: center; gap: 8px; margin: 0 0 3px; }
${PG} .dc-tw { position: relative; display: block; }
${PG} .dc-ring { position: absolute; left: -7px; top: 50%; width: 16px; height: 16px; margin-top: -8px; border-radius: 50%; border: 2px solid ${TERRE};
  opacity: 0; transition: opacity 0.3s 1.1s; }
${PG} .dc-info.is-grow .dc-ring { opacity: 1; animation: dc-ring 1.6s ease-out 1.2s infinite; }
@keyframes dc-ring { 0% { transform: scale(0.7); opacity: 1; } 100% { transform: scale(1.9); opacity: 0; } }
${PG} .dc-row > span { font: 800 0.875rem/1.1 var(--font-text); }
${PG} .dc-track { position: relative; display: flex; height: 18px; border-radius: 7px 5px 6px 5px; overflow: hidden; background: #E9E1D3; }
${PG} .dc-seg { height: 100%; width: 0; transition: width 1.1s cubic-bezier(0.25, 0.8, 0.25, 1); }
${PG} .dc-seg--ha { background: ${TERRE}; min-width: 0; }
${PG} .dc-seg--au { background: ${BLEU}; }
${PG} .dc-info.is-grow .dc-seg--ha { min-width: 3px; }
${PG} .dc-track b { position: absolute; top: 50%; transform: translateY(-50%); font: 800 0.75rem/1 var(--font-text); color: #FFFDF8; white-space: nowrap; opacity: 0; transition: opacity 0.4s 0.9s; }
${PG} .dc-info.is-grow .dc-track b { opacity: 1; }
${PG} .dc-note { margin: 2px 0 8px calc(var(--dc-lw, 6.8rem) + 2px); font: 800 0.75rem/1.1 var(--font-text); color: ${TERRE}; opacity: 0; transition: opacity 0.4s 1s; }
${PG} .dc-tag { transition: opacity 0.3s; }
${PG} .dc-tag.is-hidden { opacity: 0; }
${PG} .dc-info.is-grow .dc-note { opacity: 1; }
${PG} .dc-legend { display: flex; flex-wrap: wrap; gap: 4px 14px; margin: 7px 0 7px; font-size: 0.75rem; line-height: 1.2; color: #5E544B; }
${PG} .dc-legend span { display: inline-flex; align-items: center; gap: 5px; }
${PG} .dc-legend i { width: 10px; height: 10px; border-radius: 3px; }
${PG} .dc-pools { display: flex; gap: 8px; align-items: center; margin: 0; font-size: 0.75rem; line-height: 1.3; color: ${ENCRE}; }
${PG} .dc-pools svg { flex: none; width: 46px; height: 22px; }
${PG} .dc-info.is-narrow { padding: 10px 11px 10px; }
${PG} .dc-info.is-narrow .dc-pools { font-size: 0.6875rem; gap: 6px; }
${PG} .dc-info.is-narrow .dc-pools svg { width: 38px; height: 18px; }
${PG} .gesture-dot { background: rgba(255,255,255,0.96); box-shadow: 0 0 0 2px rgba(43,36,31,0.55), 0 0 0 9px rgba(43,36,31,0.16), 0 4px 14px rgba(43,36,31,0.45); }
${PG} .gesture-ring { border-color: rgba(43,36,31,0.75); }
@media (prefers-reduced-motion: reduce) {
  ${PG} .dc-card.is-in, ${PG} .dc-card.is-shake, ${PG} .dc-card.is-wob, ${PG} .dc-tip.is-shake { animation: none; }
}
`;

  const ICON_SURFACE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17.5h18"/><path d="M5.5 17.5v-5h5v5M13 17.5v-7.5l3-2 3 2v7.5"/><path d="M12 3.5v4M10 5.6l2 2 2-2"/></svg>';
  const ICON_DEEP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5.5h18M3 10h18M3 14.5h18"/><path d="M12 3v15.5M8.5 15l3.5 3.8 3.5-3.8"/></svg>';
  const POOLS = '<svg viewBox="0 0 46 22" aria-hidden="true"><rect x="1" y="3" width="20" height="16" rx="3" fill="#7FBCE0"/><rect x="25" y="3" width="20" height="16" rx="3" fill="#7FBCE0"/>' +
    '<path d="M2.5 8.5h17M2.5 13.5h17M26.5 8.5h17M26.5 13.5h17" stroke="#FFFDF8" stroke-width="1.2" stroke-dasharray="2 1.6"/>' +
    '<rect x="1" y="3" width="20" height="16" rx="3" fill="none" stroke="#2F6E9E" stroke-width="1.4"/><rect x="25" y="3" width="20" height="16" rx="3" fill="none" stroke="#2F6E9E" stroke-width="1.4"/></svg>';

  window.RM.games.dechets = function (api) {
    const stage = api.stage;
    const cv = api.canvas();
    const ctx = cv.ctx;
    const RMo = api.reducedMotion;
    api.style(CSS);
    const N = DECHETS.length;

    /* ---------------- DOM ---------------- */
    const card = document.createElement('div');
    card.className = 'dc-card';
    card.innerHTML = '<canvas class="dc-art" aria-hidden="true"></canvas><div class="dc-txt"><p class="dc-name"></p><p class="dc-lvl"></p><span class="dc-meter" role="img"><i></i><i></i><i></i><i></i></span></div>';
    const artCv = card.querySelector('.dc-art');
    const nameEl = card.querySelector('.dc-name');
    const lvlEl = card.querySelector('.dc-lvl');
    const meterEl = card.querySelector('.dc-meter');

    const bar = document.createElement('div');
    bar.className = 'dc-bar';
    const btnS = document.createElement('button');
    btnS.type = 'button';
    btnS.className = 'chip';
    btnS.innerHTML = ICON_SURFACE + '<span></span>';
    btnS.lastChild.textContent = TEXTES.surface;
    const btnP = document.createElement('button');
    btnP.type = 'button';
    btnP.className = 'chip';
    btnP.innerHTML = ICON_DEEP + '<span></span>';
    btnP.lastChild.textContent = TEXTES.profond;
    bar.append(btnS, btnP);

    const mkTag = (cls, text) => {
      const t = document.createElement('p');
      t.className = 'dc-tag ' + cls;
      t.setAttribute('aria-hidden', 'true');
      t.textContent = text;
      return t;
    };
    const tag0 = mkTag('dc-tag--depth', TEXTES.echelleHaut);
    const tag500 = mkTag('dc-tag--depth dc-tag--deep', TEXTES.echelleBas);
    const tagS = mkTag('', TEXTES.tagSurface);
    const tagP = mkTag('dc-tag--deep', TEXTES.tagProfond);

    const tip = document.createElement('div');
    tip.className = 'dc-tip';
    tip.setAttribute('role', 'status');
    tip.innerHTML = '<p class="dc-verdict"></p><p class="dc-explain"></p><span class="dc-timer"></span>';
    const verdictEl = tip.querySelector('.dc-verdict');
    const explainEl = tip.querySelector('.dc-explain');
    const timerEl = tip.querySelector('.dc-timer');

    const info = document.createElement('div');
    info.className = 'dc-info';
    info.setAttribute('role', 'img');
    info.innerHTML =
      '<div class="dc-row"><span></span><span class="dc-tw"><span class="dc-track"><span class="dc-seg dc-seg--ha"></span><span class="dc-seg dc-seg--au"></span></span><i class="dc-ring"></i></span></div>' +
      '<p class="dc-note"></p>' +
      '<div class="dc-row"><span></span><span class="dc-track"><span class="dc-seg dc-seg--ha"></span><span class="dc-seg dc-seg--au"></span><b></b></span></div>' +
      '<p class="dc-legend"><span><i></i></span><span><i></i></span></p>' +
      '<p class="dc-pools">' + POOLS + '<span></span></p>';
    const rowsI = info.querySelectorAll('.dc-row');
    rowsI[0].firstChild.textContent = TEXTES.volume;
    rowsI[1].firstChild.textContent = TEXTES.radio;
    info.querySelector('.dc-note').textContent = '↑ ' + insec(TEXTES.pctVolume);
    info.querySelector('.dc-track b').textContent = insec(TEXTES.pctRadio);
    const legs = info.querySelectorAll('.dc-legend span');
    legs[0].firstChild.style.background = TERRE;
    legs[0].append(TEXTES.haute);
    legs[1].firstChild.style.background = BLEU;
    legs[1].append(TEXTES.autres);
    info.querySelector('.dc-pools span').textContent = insec(TEXTES.piscines);
    info.setAttribute('aria-label', insec(`${TEXTES.volume} : ${TEXTES.haute} ${TEXTES.pctVolume}. ${TEXTES.radio} : ${TEXTES.haute} ${TEXTES.pctRadio}. ${TEXTES.piscines}`));
    const segs = info.querySelectorAll('.dc-seg');

    stage.append(tag0, tag500, tagS, tagP, card, bar, tip, info);

    /* ---------------- État ---------------- */
    let order = [];
    let idx = 0;           /* déchet en cours */
    let placed = 0;
    let state = 'idle';    /* idle | drag | fly | wait | info | done */
    let drag = null;
    let hover = null;      /* zone survolée pendant le glissé */
    let hoverShown = 0;
    let tipT = 0, tipDur = 0, tipOn = false, tipNext = false;
    let pkgs = [];         /* colis rangés (dans le canevas) */
    let sparks = [];
    let puffs = [];
    let time = 0;
    let cage = 0;          /* position de la cage dans le puits, 0 = surface, 1 = galerie */
    let cageTarget = 0;
    let finishT = -1;
    let infoTimer = 0;

    /* ---------------- Géométrie ---------------- */
    const G = { w: 1, h: 1 };
    let bg = null;
    let cloudSprite = null;

    function layout(w, h) {
      G.w = w;
      G.h = h;
      const s = (G.s = clamp(Math.min(w / 358, h / 448), 0.8, 1.6));
      G.btnH = 46;
      G.btnTop = h - 8 - G.btnH;
      G.cardW = Math.round(Math.min(w - 28, 340));
      G.cardH = Math.round(clamp(h * 0.19, 80, 104));
      G.dockX = Math.round((w - G.cardW) / 2);
      G.dockY = 8;
      G.gY = Math.round(G.dockY + G.cardH + clamp(h * 0.135, 44, 80));
      G.clayTop = Math.round(G.gY + (G.btnTop - G.gY) * 0.48);
      G.galY = Math.round(G.clayTop + (G.btnTop - G.clayTop) * 0.47);
      G.galH = Math.round(30 * s);
      G.split = (G.gY + G.clayTop) / 2 + 6;
      G.shaftX = Math.round(w * 0.19);
      G.shaftW = Math.round(10 * s);
      G.galX0 = G.shaftX - G.shaftW;
      G.galX1 = Math.round(w * 0.965);
      /* alvéoles de béton en surface */
      G.alv = [];
      const ax0 = w * 0.3, ax1 = w * 0.77;
      const nA = 4, gap = 5 * s;
      const aw = (ax1 - ax0 - gap * (nA - 1)) / nA;
      for (let i = 0; i < nA; i++) G.alv.push({ x: ax0 + i * (aw + gap), w: aw, h: 19 * s });
      G.slotS = { gants: 1, outils: 3 };
      /* emplacements dans la galerie profonde */
      G.slotP = { pieces: lerp(G.galX0, G.galX1, 0.44), verre: lerp(G.galX0, G.galX1, 0.7) };
      G.pkS = clamp(s * 1.3, 1.1, 1.9);
      /* les colis déjà rangés suivent la nouvelle mise en page */
      for (const pk of pkgs) {
        if (pk.zone === 'surface') pk.slot = G.alv[G.slotS[pk.id]];
        if (pk.rest && pk.zone === 'profond') {
          pk.x = G.slotP[pk.id];
          pk.y = G.galY + G.galH / 2 - 3 * s;
        }
      }
      /* éléments DOM */
      card.style.width = G.cardW + 'px';
      card.style.height = G.cardH + 'px';
      card.style.left = G.dockX + 'px';
      card.style.top = G.dockY + 'px';
      card.style.setProperty('--dc-fs', clamp(G.cardW / 19, 15, 19).toFixed(1) + 'px');
      const art = G.cardH - 16;
      paintArt(artCv, DECHETS[order[idx] != null ? order[idx] : 0].id, art, cv.dpr);
      bar.classList.toggle('is-narrow', w < 350);
      tip.style.width = G.cardW + 'px';
      tip.style.left = G.dockX + 'px';
      placeTags();
      bg = makeBg(w, h);
      if (state === 'info' || state === 'done') placeInfo();
    }

    function placeTags() {
      const s = G.s;
      tag0.style.left = '8px';
      tag0.style.top = (G.gY + 6) + 'px';
      tag500.style.left = '8px';
      tag500.style.top = (G.galY - 10) + 'px';
      tagS.style.right = Math.round(G.w * 0.05) + 'px';
      tagS.style.left = 'auto';
      tagS.style.top = (G.gY + 6) + 'px';
      tagP.style.right = Math.round(G.w * 0.04) + 'px';
      tagP.style.left = 'auto';
      tagP.style.top = (G.galY + G.galH / 2 + 7 * s) + 'px';
    }

    /* le panneau se place entre la surface et la galerie, sans cacher les colis rangés */
    function placeInfo() {
      const top = G.gY + 5;
      const room = G.galY - G.galH / 2 - 5 - top;
      info.classList.toggle('is-narrow', G.w < 340);
      info.style.setProperty('--dc-lw', G.w < 340 ? '6.4rem' : '6.8rem');
      info.style.top = top + 'px';
      const hh = info.offsetHeight;
      if (hh && hh < room) info.style.top = Math.round(top + (room - hh) / 2) + 'px';
    }

    /* ---------------- Le fond : ciel, surface, strates, argile ---------------- */
    function wavy(n, x, y0, amp, f, k) {
      return y0 + (n.fbm(x * f, k, 3) - 0.5) * amp;
    }

    function makeBg(w, h) {
      const s = G.s;
      const c = document.createElement('canvas');
      c.width = Math.round(w * cv.dpr);
      c.height = Math.round(h * cv.dpr);
      const g = c.getContext('2d');
      g.scale(cv.dpr, cv.dpr);
      const n = lib.makeNoise(17);
      const r = seeded(23);

      /* ciel */
      let gr = g.createLinearGradient(0, 0, 0, G.gY);
      gr.addColorStop(0, '#F5EFE4');
      gr.addColorStop(1, '#E7DBC6');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, G.gY + 2);
      draw.glow(g, w * 0.88, G.gY * 0.2, G.gY * 0.9, '#FFF4D2', 0.7);
      /* collines lointaines */
      g.beginPath();
      g.moveTo(0, G.gY);
      for (let x = 0; x <= w + 4; x += 4) g.lineTo(x, G.gY - 14 * s - (n.fbm(x * 0.008, 2.2, 3) - 0.3) * 26 * s);
      g.lineTo(w, G.gY);
      g.closePath();
      gr = g.createLinearGradient(0, G.gY - 34 * s, 0, G.gY);
      gr.addColorStop(0, '#C9C3A2');
      gr.addColorStop(1, '#B4AE8C');
      g.fillStyle = gr;
      g.fill();

      /* strates : chaque couche a sa matière */
      const layers = [
        { y: G.gY - 1, col: '#8F6E4D', col2: '#7A5B3E', amp: 3 },                               /* terre végétale */
        { y: G.gY + 10 * s, col: '#DCCDA9', col2: '#CDBB93', amp: 8, dots: '#B8A27A' },           /* calcaire */
        { y: lerp(G.gY, G.clayTop, 0.45), col: '#BFA984', col2: '#AD9672', amp: 10, lines: true }, /* marnes */
        { y: lerp(G.gY, G.clayTop, 0.72), col: '#D3C19B', col2: '#C2AE86', amp: 9, dots: '#AE9871' },
        { y: G.clayTop, col: '#8E9AA4', col2: '#727F8A', amp: 7, clay: true },                     /* argile */
      ];
      for (let i = 0; i < layers.length; i++) {
        const Ly = layers[i];
        const yBot = i + 1 < layers.length ? null : h;
        g.beginPath();
        g.moveTo(-4, h);
        for (let x = -4; x <= w + 4; x += 4) g.lineTo(x, wavy(n, x, Ly.y, Ly.amp * s, 0.012, i * 3.7));
        g.lineTo(w + 4, h);
        g.closePath();
        const top = Ly.y - Ly.amp * s;
        const bot = yBot || (layers[i + 1].y + layers[i + 1].amp * s);
        gr = g.createLinearGradient(0, top, 0, bot);
        gr.addColorStop(0, Ly.col);
        gr.addColorStop(1, Ly.col2);
        g.fillStyle = gr;
        g.fill();
        g.save();
        g.clip();
        if (Ly.dots) {
          for (let k = 0; k < 90 * s; k++) {
            const x = r() * w, y = lerp(top, bot, r());
            g.fillStyle = rgba(Ly.dots, 0.35 + r() * 0.3);
            g.beginPath();
            g.ellipse(x, y, (0.6 + r() * 1.6) * s, (0.4 + r() * 0.9) * s, r() * 3, 0, TAU);
            g.fill();
          }
          /* petits coquillages fossiles */
          for (let k = 0; k < 6; k++) {
            const x = r() * w, y = lerp(top + 6 * s, bot - 4 * s, r()), rr = (2 + r() * 2) * s;
            g.strokeStyle = rgba(Ly.col2, 0.9);
            g.lineWidth = 0.9 * s;
            g.beginPath();
            g.arc(x, y, rr, Math.PI * 1.05, Math.PI * 1.95);
            g.stroke();
            for (let q = 1; q < 4; q++) {
              const a = Math.PI * (1.05 + q * 0.22);
              g.beginPath();
              g.moveTo(x, y);
              g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
              g.stroke();
            }
          }
        }
        if (Ly.lines) {
          g.lineWidth = 1;
          for (let k = 0; k < 7; k++) {
            const y0 = lerp(top + 4 * s, bot - 4 * s, (k + 0.5) / 7);
            g.strokeStyle = k % 2 ? 'rgba(255,245,225,0.25)' : 'rgba(90,70,45,0.18)';
            g.beginPath();
            for (let x = -4; x <= w + 4; x += 6) {
              const y = wavy(n, x, y0, 4 * s, 0.02, 9 + k);
              if (x === -4) g.moveTo(x, y);
              else g.lineTo(x, y);
            }
            g.stroke();
          }
        }
        if (Ly.clay) {
          /* argile : fines feuilles horizontales, reflet mat */
          for (let k = 0; k < 26; k++) {
            const y0 = lerp(top + 3 * s, h, k / 26);
            g.strokeStyle = k % 3 ? 'rgba(40,52,64,0.12)' : 'rgba(230,238,245,0.14)';
            g.lineWidth = k % 3 ? 1 : 1.4;
            g.beginPath();
            for (let x = -4; x <= w + 4; x += 6) {
              const y = wavy(n, x, y0, 2.5 * s, 0.015, 30 + k);
              if (x === -4) g.moveTo(x, y);
              else g.lineTo(x, y);
            }
            g.stroke();
          }
          for (let k = 0; k < 160 * s; k++) {
            g.fillStyle = r() < 0.5 ? 'rgba(220,230,238,0.16)' : 'rgba(30,40,50,0.14)';
            g.fillRect(r() * w, lerp(top, h, r()), (0.8 + r() * 2) * s, 0.8 * s);
          }
        }
        g.restore();
        /* liseré sombre à la limite des couches */
        g.strokeStyle = 'rgba(60,45,30,0.16)';
        g.lineWidth = 1;
        g.beginPath();
        for (let x = -4; x <= w + 4; x += 4) {
          const y = wavy(n, x, Ly.y, Ly.amp * s, 0.012, i * 3.7);
          if (x === -4) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.stroke();
      }
      /* herbe sur la surface */
      g.fillStyle = '#93A05E';
      g.beginPath();
      g.moveTo(-4, G.gY + 3);
      for (let x = -4; x <= w + 4; x += 4) g.lineTo(x, wavy(n, x, G.gY - 1, 3 * s, 0.012, 0) - 1.5 * s);
      g.lineTo(w + 4, G.gY + 3);
      g.closePath();
      g.fill();

      /* échelle de profondeur, discrète */
      g.strokeStyle = 'rgba(43,36,31,0.4)';
      g.lineWidth = 1.2;
      g.setLineDash([3, 3]);
      g.beginPath();
      g.moveTo(5.5, G.gY);
      g.lineTo(5.5, G.galY);
      g.stroke();
      g.setLineDash([]);
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(2, G.gY);
      g.lineTo(10, G.gY);
      g.moveTo(2, G.galY);
      g.lineTo(10, G.galY);
      g.stroke();

      /* le puits qui descend jusqu'à l'argile */
      const sx = G.shaftX, sw = G.shaftW;
      g.fillStyle = '#C7C1B6';
      g.fillRect(sx - sw / 2 - 2 * s, G.gY, sw + 4 * s, G.galY - G.gY);
      gr = g.createLinearGradient(sx - sw / 2, 0, sx + sw / 2, 0);
      gr.addColorStop(0, '#2F363E');
      gr.addColorStop(0.5, '#47505A');
      gr.addColorStop(1, '#2A3138');
      g.fillStyle = gr;
      g.fillRect(sx - sw / 2, G.gY, sw, G.galY - G.gY);
      /* la galerie de stockage dans l'argile */
      const gx0 = G.galX0, gx1 = G.galX1, gy = G.galY, gh = G.galH;
      g.fillStyle = '#D2CEC6';
      draw.roundRect(g, gx0 - 2 * s, gy - gh / 2 - 2.5 * s, gx1 - gx0 + 4 * s, gh + 5 * s, gh / 2 + 2 * s);
      g.fill();
      gr = g.createLinearGradient(0, gy - gh / 2, 0, gy + gh / 2);
      gr.addColorStop(0, '#5C6670');
      gr.addColorStop(0.55, '#46505A');
      gr.addColorStop(1, '#3A434C');
      g.fillStyle = gr;
      draw.roundRect(g, gx0, gy - gh / 2, gx1 - gx0, gh, gh / 2);
      g.fill();
      /* anneaux de soutènement et lampes */
      g.strokeStyle = 'rgba(210,206,198,0.35)';
      g.lineWidth = 1.2 * s;
      for (let x = gx0 + gh; x < gx1 - gh / 2; x += 16 * s) {
        g.beginPath();
        g.moveTo(x, gy - gh / 2 + 1);
        g.lineTo(x, gy + gh / 2 - 1);
        g.stroke();
      }
      for (let x = gx0 + gh * 1.4; x < gx1 - gh; x += 32 * s) draw.glow(g, x, gy - gh / 2 + 3 * s, 6 * s, '#FFE2A0', 0.55);
      /* sol de la galerie */
      g.fillStyle = 'rgba(200,196,188,0.35)';
      g.fillRect(gx0 + gh / 2, gy + gh / 2 - 3 * s, gx1 - gx0 - gh, 1.5 * s);

      /* le centre de stockage en surface */
      const base = G.gY;
      /* clôture, derrière les installations */
      g.strokeStyle = 'rgba(90,80,70,0.4)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(G.w * 0.28, base - 7 * s);
      g.lineTo(G.w * 0.995, base - 7 * s);
      g.stroke();
      for (let x = G.w * 0.28; x < G.w * 0.995; x += 6 * s) {
        g.beginPath();
        g.moveTo(x, base);
        g.lineTo(x, base - 8 * s);
        g.stroke();
      }
      /* grand hangar à toit arrondi */
      const hx0 = G.w * 0.8, hx1 = G.w * 0.978, hh = 26 * s;
      g.fillStyle = '#ECE6DB';
      g.fillRect(hx0, base - hh, hx1 - hx0, hh);
      gr = g.createLinearGradient(0, base - hh - 9 * s, 0, base - hh);
      gr.addColorStop(0, '#86A0B6');
      gr.addColorStop(1, '#5F7A92');
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(hx0 - 1.5 * s, base - hh);
      g.quadraticCurveTo((hx0 + hx1) / 2, base - hh - 14 * s, hx1 + 1.5 * s, base - hh);
      g.closePath();
      g.fill();
      g.fillStyle = '#C9C1B4';
      g.fillRect(hx0, base - hh, hx1 - hx0, 2 * s);
      g.fillStyle = '#7C8A96';
      g.fillRect((hx0 + hx1) / 2 - 5 * s, base - 11 * s, 10 * s, 11 * s);
      g.fillStyle = 'rgba(255,255,255,0.35)';
      for (let x = hx0 + 3 * s; x < hx1 - 4 * s; x += 7 * s) g.fillRect(x, base - hh + 5 * s, 4 * s, 2 * s);
      /* alvéoles de béton (deux déjà remplies, deux libres) */
      const pre = [['outils', 'outils', 'outils'], null, ['outils', 'gants', 'outils'], null];
      G.alv.forEach((a, i) => {
        const y0 = base - a.h;
        gr = g.createLinearGradient(a.x, 0, a.x + a.w, 0);
        gr.addColorStop(0, '#8A8479');
        gr.addColorStop(0.5, '#A39D91');
        gr.addColorStop(1, '#8F897E');
        g.fillStyle = gr;
        g.fillRect(a.x, y0, a.w, a.h);
        g.fillStyle = 'rgba(0,0,0,0.12)';
        g.fillRect(a.x, y0, a.w, 3 * s);
        const items = pre[i];
        if (items) {
          const k = items.length;
          items.forEach((id, j) => drawPackage(g, id, a.x + 3 * s + (a.w - 6 * s) * (j + 0.5) / k, base, G.pkS * 0.62));
        }
        drawAlvWalls(g, a, base);
      });
      /* chevalement au-dessus du puits, avec sa grande roue */
      const top = base - 40 * s;
      g.strokeStyle = '#5E6874';
      g.lineWidth = 1.8 * s;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(sx - 11 * s, base);
      g.lineTo(sx - 1.5 * s, top);
      g.moveTo(sx + 11 * s, base);
      g.lineTo(sx + 1.5 * s, top);
      g.moveTo(sx - 7.6 * s, base - 13 * s);
      g.lineTo(sx + 7.6 * s, base - 13 * s);
      g.moveTo(sx - 4.4 * s, base - 26 * s);
      g.lineTo(sx + 4.4 * s, base - 26 * s);
      g.moveTo(sx - 7.6 * s, base - 13 * s);
      g.lineTo(sx + 4.4 * s, base - 26 * s);
      g.stroke();
      G.wheel = { x: sx, y: top + 1 * s, r: 5 * s };
      /* petit bâtiment d'accueil, toit de tuiles */
      g.fillStyle = '#EFE9DE';
      g.fillRect(sx - 30 * s, base - 13 * s, 15 * s, 13 * s);
      g.fillStyle = '#B85A3C';
      g.beginPath();
      g.moveTo(sx - 31.5 * s, base - 13 * s);
      g.lineTo(sx - 22.5 * s, base - 19 * s);
      g.lineTo(sx - 13.5 * s, base - 13 * s);
      g.closePath();
      g.fill();
      g.fillStyle = '#7F95A8';
      g.fillRect(sx - 27 * s, base - 9 * s, 3.5 * s, 3.5 * s);
      g.fillRect(sx - 21 * s, base - 9 * s, 3.5 * s, 3.5 * s);
      /* arbres */
      for (const [fx, rr] of [[0.035, 7], [0.075, 5.5], [0.265, 6], [0.99, 7]]) {
        const x = G.w * fx, y = base - rr * s * 0.9;
        gr = g.createRadialGradient(x - rr * 0.3 * s, y - rr * 0.4 * s, 1, x, y, rr * 1.1 * s);
        gr.addColorStop(0, '#8FA062');
        gr.addColorStop(1, '#5D6E3E');
        g.fillStyle = gr;
        draw.blob(g, x, y, rr * s, 0.15, fx * 20, 0, 16);
        g.fill();
      }
      return c;
    }

    /* murs et rebord d'une alvéole, dessinés devant les colis */
    function drawAlvWalls(g, a, base) {
      const s = G.s;
      const y0 = base - a.h;
      const gr = g.createLinearGradient(0, y0, 0, base);
      gr.addColorStop(0, '#E9E4DA');
      gr.addColorStop(1, '#CFC9BE');
      g.fillStyle = gr;
      g.fillRect(a.x, y0, 2.6 * s, a.h);
      g.fillRect(a.x + a.w - 2.6 * s, y0, 2.6 * s, a.h);
      g.fillRect(a.x, base - 3 * s, a.w, 3 * s);
      g.fillStyle = '#F1EDE5';
      g.fillRect(a.x - 0.6 * s, y0 - 1.2 * s, a.w + 1.2 * s, 1.8 * s);
      g.fillStyle = 'rgba(80,70,60,0.22)';
      g.fillRect(a.x, base - 0.8, a.w, 0.8);
    }

    function makeCloud() {
      const c = document.createElement('canvas');
      c.width = 200;
      c.height = 70;
      const g = c.getContext('2d');
      const r = seeded(31);
      for (let i = 0; i < 8; i++) {
        const t = i / 7;
        const x = 24 + t * 152, rr = 12 + 14 * Math.sin(Math.PI * t) + r() * 6, y = 58 - rr * 0.6;
        const gr = g.createRadialGradient(x - rr * 0.2, y - rr * 0.4, 1, x, y, rr);
        gr.addColorStop(0, 'rgba(255,255,255,0.95)');
        gr.addColorStop(0.75, 'rgba(250,244,234,0.6)');
        gr.addColorStop(1, 'rgba(250,244,234,0)');
        g.fillStyle = gr;
        g.beginPath();
        g.arc(x, y, rr, 0, TAU);
        g.fill();
      }
      return c;
    }

    /* ---------------- La carte ---------------- */
    function current() {
      return DECHETS[order[idx]];
    }

    function showCard(animate) {
      const d = current();
      if (!d) return;
      nameEl.textContent = d.nom;
      lvlEl.textContent = lib.fr(d.niveau);
      meterEl.setAttribute('aria-label', TEXTES.niveauAria(d.barres));
      meterEl.querySelectorAll('i').forEach((el, i) => el.classList.toggle('on', i < d.barres));
      paintArt(artCv, d.id, G.cardH - 16, cv.dpr);
      card.classList.remove('is-gone', 'is-back', 'is-shake', 'is-wob', 'is-drag', 'is-in');
      card.style.transform = '';
      card.style.opacity = '';
      card.style.display = '';
      if (animate && !RMo) {
        void card.offsetWidth;
        card.classList.add('is-in');
      }
      btnS.setAttribute('aria-label', TEXTES.boutonSurface(d.nom));
      btnP.setAttribute('aria-label', TEXTES.boutonProfond(d.nom));
      btnS.disabled = false;
      btnP.disabled = false;
      state = 'idle';
    }

    function cardCenter(dx, dy) {
      return [G.dockX + G.cardW / 2 + dx, G.dockY + G.cardH / 2 + dy];
    }

    function zoneAt(y, dy) {
      if (dy < 26) return null;
      return y < G.split ? 'surface' : 'profond';
    }

    function setHover(z) {
      if (z === hover) return;
      hover = z;
      btnS.classList.toggle('is-hot', z === 'surface');
      btnP.classList.toggle('is-hot', z === 'profond');
      if (z) api.sfx.play('tick', { pitch: z === 'surface' ? 1.15 : 0.85, gap: 60 });
    }

    /* le doigt fantôme part du dessin de la carte et descend jusqu'à la bonne zone */
    function showGesture() {
      const d = current();
      if (!d) return;
      const x = G.dockX + 8 + (G.cardH - 16) / 2;
      const y = G.dockY + G.cardH / 2;
      const ty = d.ou === 'surface' ? G.gY + 2 * G.s : G.galY;
      api.gesture('drag', { x: x / G.w * 100, y: y / G.h * 100, dx: 0, dy: Math.round(ty - y) });
    }

    /* la carte bouge sous le doigt : les écarts se mesurent en coordonnées de l'écran */
    api.track(card, {
      down(p, e) {
        if (state !== 'idle' || justDismissed(80)) return;
        drag = { dx: 0, dy: 0, x0: e.clientX, y0: e.clientY };
        card.classList.remove('is-in', 'is-back', 'is-shake', 'is-wob');
        card.classList.add('is-drag');
        state = 'drag';
        api.sfx.play('pop', { pitch: 1.2, volume: 0.6 });
        api.buzz(6);
      },
      move(p, e) {
        if (state !== 'drag' || !drag) return;
        drag.dx = e.clientX - drag.x0;
        drag.dy = e.clientY - drag.y0;
        /* la carte rapetisse et se soulève un peu au-dessus du doigt : on voit où elle va */
        const k = ease.outQuad(clamp(Math.max(0, drag.dy) / 110));
        const sc = lerp(1, 0.6, k);
        const lift = -k * G.cardH * 0.32;
        card.style.transform = `translate(${drag.dx.toFixed(1)}px, ${(drag.dy + lift).toFixed(1)}px) rotate(${(drag.dx / G.w * 10).toFixed(2)}deg) scale(${sc.toFixed(3)})`;
        const [, cy] = cardCenter(drag.dx, drag.dy);
        setHover(zoneAt(cy, drag.dy));
      },
      up(p, e, cancelled) {
        if (state !== 'drag' || !drag) return;
        card.classList.remove('is-drag');
        if (!cancelled && e && e.clientX != null) {
          drag.dx = e.clientX - drag.x0;
          drag.dy = e.clientY - drag.y0;
        }
        const { dx, dy } = drag;
        drag = null;
        const [cx, cy] = cardCenter(dx, dy);
        const z = cancelled ? null : zoneAt(cy, dy);
        setHover(null);
        state = 'idle';
        if (z) {
          choose(z, cx, cy, dx, dy);
          return;
        }
        /* retour au départ */
        card.classList.add('is-back');
        card.style.transform = '';
        if (!cancelled && Math.hypot(dx, dy) < 12) {
          /* une simple tape : la carte frétille et on montre le geste */
          setTimeout(() => {
            card.classList.remove('is-back');
            if (!RMo) {
              void card.offsetWidth;
              card.classList.add('is-wob');
            }
          }, 30);
          api.sfx.play('tick', { pitch: 0.9 });
          showGesture();
        }
      },
    }, { touchAction: 'none' });

    card.addEventListener('animationend', () => card.classList.remove('is-in', 'is-shake', 'is-wob'));
    tip.addEventListener('animationend', () => tip.classList.remove('is-shake'));
    btnS.addEventListener('click', () => onButton('surface'));
    btnP.addEventListener('click', () => onButton('profond'));
    function onButton(z) {
      if (state !== 'idle' || !current() || justDismissed(450)) return;
      api.gesture(null);
      const [cx, cy] = cardCenter(0, 0);
      choose(z, cx, cy, 0, 0);
    }

    /* toute nouvelle tape ferme l'explication ; si elle fait venir la carte suivante,
       cette même tape n'agit pas sur cette carte (encore jamais vue) */
    let dismissedAt = -1e9, dismissedNext = false;
    stage.addEventListener('pointerdown', () => {
      if (!tipOn) return;
      dismissedAt = performance.now();
      dismissedNext = tipNext;
      closeTip();
    }, true);
    const justDismissed = (ms) => dismissedNext && performance.now() - dismissedAt < ms;

    /* ---------------- Choix ---------------- */
    function choose(z, cx, cy, dx, dy) {
      const d = current();
      if (!d) return;
      api.gesture(null);
      if (d.ou === z) {
        state = 'fly';
        placed++;
        /* la carte se change en colis qui part vers sa place */
        card.classList.remove('is-back', 'is-in', 'is-shake', 'is-wob');
        card.style.transform = `translate(${dx}px, ${dy}px) scale(0.35)`;
        card.classList.add('is-gone');
        launchPackage(d, cx, cy);
        api.sfx.play('whoosh', { pitch: z === 'surface' ? 1.2 : 0.8, volume: 0.5 });
        api.buzz(10);
        api.status(TEXTES.range(placed, N));
        api.progress(placed / N * 0.8);
        showTip(true, d);
      } else {
        /* mauvais choix : la carte revient, avec une petite secousse */
        card.classList.add('is-back');
        card.style.transform = '';
        setTimeout(() => {
          card.classList.remove('is-back');
          if (!RMo) {
            void card.offsetWidth;
            card.classList.add('is-shake');
          }
        }, 360);
        api.sfx.play('fail');
        api.buzz(14);
        showTip(false, d);
      }
    }

    function showTip(ok, d) {
      verdictEl.textContent = lib.fr(ok ? TEXTES.bien : TEXTES.faux);
      explainEl.textContent = lib.fr(d.explication);
      tip.style.setProperty('--dc-vc', ok ? BLEU : TERRE);
      /* bonne réponse : la bulle prend la place de la carte ; sinon, juste en dessous */
      tip.style.top = (ok ? G.dockY : G.dockY + G.cardH + 8) + 'px';
      tip.classList.add('is-on');
      tip.classList.remove('is-shake');
      if (!ok && !RMo) {
        void tip.offsetWidth;
        tip.classList.add('is-shake');
      }
      tipOn = true;
      tipT = 0;
      tipDur = clamp(d.explication.length * BULLE_PAR_CAR, BULLE_MIN, BULLE_MAX) + (ok ? 0.4 : 0);
      tipNext = ok;
    }

    function closeTip() {
      if (!tipOn) return;
      tipOn = false;
      tip.classList.remove('is-on');
      if (tipNext) {
        tipNext = false;
        nextCard();
      }
    }

    function nextCard() {
      idx++;
      if (idx >= N) {
        finish();
        return;
      }
      showCard(true);
    }

    /* ---------------- Les colis ---------------- */
    function launchPackage(d, cx, cy) {
      const s = G.s;
      const pk = { id: d.id, zone: d.ou, t: 0, x: cx, y: cy, rest: false, landT: -1, segs: [] };
      if (d.ou === 'surface') {
        const a = G.alv[G.slotS[d.id]];
        const tx = a.x + a.w / 2, ty = G.gY;
        pk.segs.push({ x0: cx, y0: cy, x1: tx, y1: ty, dur: 0.6, arc: -40 * s, e: ease.inOutCubic });
        pk.slot = a;
      } else {
        const sx = G.shaftX, top = G.gY - 2 * s, bot = G.galY + G.galH / 2 - 3 * s;
        pk.segs.push({ x0: cx, y0: cy, x1: sx, y1: top, dur: 0.5, arc: -30 * s, e: ease.inOutCubic });
        pk.segs.push({ x0: sx, y0: top, x1: sx, y1: bot, dur: 1.05, arc: 0, e: ease.inOutSine, cage: true });
        pk.segs.push({ x0: sx, y0: bot, x1: G.slotP[d.id], y1: bot, dur: 0.6, arc: 0, e: ease.inOutCubic });
      }
      pk.seg = 0;
      pkgs.push(pk);
    }

    function landed(pk) {
      pk.rest = true;
      pk.landT = time;
      const s = G.s;
      api.sfx.play('thud', { pitch: pk.zone === 'surface' ? 1.2 : 0.9, volume: 0.7 });
      api.sfx.play('chime', { pitch: pk.zone === 'surface' ? 1.1 : 0.9 });
      for (let i = 0; i < 16 && sparks.length < 120; i++) {
        const a = -Math.PI / 2 + rand(-1.3, 1.3);
        const sp = rand(40, 120) * s;
        sparks.push({ x: pk.x, y: pk.y - 8 * s, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: rand(0.5, 0.9), r: rand(1.4, 2.8) * s, col: i % 3 ? BLEU : '#FFFFFF' });
      }
      if (pk.zone === 'surface') {
        for (let i = 0; i < 8; i++) puffs.push({ x: pk.x + rand(-8, 8) * s, y: G.gY - 2 * s, r: rand(2, 4) * s, t: 0, life: rand(0.5, 0.8), vx: rand(-14, 14) * s });
      }
      if (pk.zone === 'profond') cageTarget = 0;
      if (placed >= N && state !== 'info' && state !== 'done') {
        /* tous rangés : on laisse lire la dernière explication, puis l'infographie */
        tipNext = false;
        infoTimer = Math.max(0.9, tipDur - tipT + 0.2);
      }
    }

    /* ---------------- Fin : l'infographie ---------------- */
    function finish() {
      if (state === 'info' || state === 'done') return;
      state = 'info';
      closeTipSilent();
      bar.classList.add('is-gone');
      btnS.disabled = true;
      btnP.disabled = true;
      card.style.display = 'none';
      tag0.classList.add('is-hidden');
      tagS.classList.add('is-hidden');
      segs.forEach((el) => { el.style.width = '0'; });
      info.classList.remove('is-grow');
      info.classList.add('is-on');
      placeInfo();
      api.sfx.play('whoosh', { volume: 0.4 });
      setTimeout(() => {
        if (state !== 'info') return;
        info.classList.add('is-grow');
        segs[0].style.width = '0.2%';
        segs[1].style.width = '99.8%';
        segs[2].style.width = '97%';
        segs[3].style.width = '3%';
        api.sfx.play('bubble', { pitch: 0.9 });
      }, RMo ? 0 : 350);
      finishT = 0;
    }

    function closeTipSilent() {
      tipOn = false;
      tipNext = false;
      tip.classList.remove('is-on');
    }

    /* ---------------- Boucle ---------------- */
    function update(dt) {
      time += dt;
      if (tipOn) {
        tipT += dt;
        const k = clamp(tipT / tipDur);
        timerEl.style.transform = `scaleX(${(1 - k).toFixed(4)})`;
        if (k >= 1) closeTip();
      }
      if (infoTimer > 0) {
        infoTimer -= dt;
        if (infoTimer <= 0) finish();
      }
      if (finishT >= 0) {
        finishT += dt;
        if (state === 'info' && finishT > (RMo ? 0.6 : 1.8)) {
          state = 'done';
          api.progress(1);
          api.done(TEXTES.fin, TEXTES.finStatut);
        }
      }
      hoverShown += ((hover ? 1 : 0) - hoverShown) * Math.min(1, dt * 10);
      for (const pk of pkgs) {
        if (pk.rest) continue;
        const sg = pk.segs[pk.seg];
        pk.t += dt;
        const k = clamp(pk.t / sg.dur);
        const e = sg.e(k);
        pk.x = lerp(sg.x0, sg.x1, e);
        pk.y = lerp(sg.y0, sg.y1, e) + sg.arc * Math.sin(Math.PI * k);
        if (sg.cage) cage = k;
        if (k >= 1) {
          pk.seg++;
          pk.t = 0;
          if (pk.seg >= pk.segs.length) {
            pk.x = sg.x1;
            pk.y = sg.y1;
            landed(pk);
          } else if (pk.segs[pk.seg].cage) {
            cage = 0;
          }
        }
      }
      const moving = pkgs.some((p) => !p.rest && p.segs[p.seg] && p.segs[p.seg].cage);
      if (!moving) cage += (cageTarget - cage) * Math.min(1, dt * 1.2);
      let j = 0;
      for (const sp of sparks) {
        sp.t += dt;
        if (sp.t >= sp.life) continue;
        sp.vy += 160 * G.s * dt;
        sp.x += sp.vx * dt;
        sp.y += sp.vy * dt;
        sparks[j++] = sp;
      }
      sparks.length = j;
      j = 0;
      for (const p of puffs) {
        p.t += dt;
        if (p.t >= p.life) continue;
        p.x += p.vx * dt;
        p.y -= 6 * G.s * dt;
        puffs[j++] = p;
      }
      puffs.length = j;
    }

    function render() {
      const { w, h, s } = G;
      if (bg) ctx.drawImage(bg, 0, 0, w, h);
      /* deux nuages qui passent doucement */
      if (cloudSprite) {
        const sp = RMo ? 2 : 5;
        for (let i = 0; i < 2; i++) {
          const cw = (110 + i * 30) * s, ch = cw * 0.35;
          const span = w + cw;
          const x = ((time * sp * (1 + i * 0.4) + i * span * 0.55) % span) - cw;
          ctx.globalAlpha = 0.75;
          ctx.drawImage(cloudSprite, x, G.gY * (0.12 + i * 0.3), cw, ch);
        }
        ctx.globalAlpha = 1;
      }
      /* la zone visée s'éclaire pendant le glissé */
      if (hoverShown > 0.01 && hover) {
        const a = hoverShown;
        if (hover === 'surface') {
          const a0 = G.alv[0], a1 = G.alv[G.alv.length - 1];
          ctx.save();
          ctx.translate((a0.x + a1.x + a1.w) / 2, G.gY - 6 * s);
          ctx.scale(1, 0.35);
          draw.glow(ctx, 0, 0, (a1.x + a1.w - a0.x) * 0.75, BLEU, 0.35 * a);
          ctx.restore();
        } else {
          ctx.save();
          ctx.translate((G.galX0 + G.galX1) / 2, G.galY);
          ctx.scale(1, 0.22);
          draw.glow(ctx, 0, 0, (G.galX1 - G.galX0) * 0.6, '#9FD0F5', 0.55 * a);
          ctx.restore();
        }
      }
      /* places libres, en pointillés */
      const d = current();
      if (state !== 'info' && state !== 'done' && d) {
        const pulse = 0.55 + 0.45 * Math.sin(time * 3);
        ctx.setLineDash([3 * s, 2.5 * s]);
        ctx.lineWidth = 1.4;
        for (const id of ['gants', 'outils']) {
          if (pkgs.some((p) => p.id === id)) continue;
          const a = G.alv[G.slotS[id]];
          ctx.strokeStyle = rgba('#FFFDF8', (hover === 'surface' ? 0.95 : 0.5) * (hover === 'surface' ? 1 : pulse));
          ctx.strokeRect(a.x + 4 * s, G.gY - a.h + 3 * s, a.w - 8 * s, a.h - 6.5 * s);
        }
        for (const id of ['pieces', 'verre']) {
          if (pkgs.some((p) => p.id === id)) continue;
          const x = G.slotP[id];
          ctx.strokeStyle = rgba('#FFFDF8', (hover === 'profond' ? 0.95 : 0.4) * (hover === 'profond' ? 1 : pulse));
          ctx.strokeRect(x - 11 * s, G.galY - G.galH / 2 + 5 * s, 22 * s, G.galH - 9 * s);
        }
        ctx.setLineDash([]);
      }
      /* la cage du puits et la roue du chevalement */
      const cy = lerp(G.gY - 2 * s, G.galY + G.galH / 2 - 3 * s, cage);
      const ch = 19 * s;
      if (G.wheel) {
        const wh = G.wheel;
        ctx.strokeStyle = '#5E6874';
        ctx.lineWidth = 1.4 * s;
        ctx.beginPath();
        ctx.arc(wh.x, wh.y, wh.r, 0, TAU);
        ctx.stroke();
        const a = cage * 9;
        ctx.beginPath();
        for (let k = 0; k < 3; k++) {
          ctx.moveTo(wh.x + Math.cos(a + k * 2.09) * wh.r, wh.y + Math.sin(a + k * 2.09) * wh.r);
          ctx.lineTo(wh.x - Math.cos(a + k * 2.09) * wh.r, wh.y - Math.sin(a + k * 2.09) * wh.r);
        }
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(40,40,40,0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(G.shaftX, G.wheel ? G.wheel.y : G.gY - 30 * s);
      ctx.lineTo(G.shaftX, cy - ch);
      ctx.stroke();
      ctx.fillStyle = 'rgba(236,230,218,0.95)';
      ctx.fillRect(G.shaftX - G.shaftW / 2 + 0.5, cy - ch, G.shaftW - 1, 1.8 * s);
      ctx.fillRect(G.shaftX - G.shaftW / 2 + 0.5, cy, G.shaftW - 1, 1.8 * s);
      ctx.fillRect(G.shaftX - G.shaftW / 2 + 0.5, cy - ch, 1.2 * s, ch);
      ctx.fillRect(G.shaftX + G.shaftW / 2 - 0.5 - 1.2 * s, cy - ch, 1.2 * s, ch);
      /* colis rangés */
      for (const pk of pkgs) {
        let sc = G.pkS;
        if (pk.rest) {
          const k = clamp((time - pk.landT) / 0.35);
          sc *= 1 + 0.18 * Math.sin(k * Math.PI) * (1 - k);
        } else if (pk.seg === 0) {
          sc *= lerp(1.5, 1, ease.outCubic(clamp(pk.t / pk.segs[0].dur)));
        }
        const inShaft = !pk.rest && pk.segs[pk.seg] && pk.segs[pk.seg].cage;
        const deep = pk.zone === 'profond' && (pk.seg >= 1 || pk.rest);
        const scale = inShaft || deep ? sc * 0.78 : sc * (pk.zone === 'surface' && pk.rest ? 0.74 : 1);
        if (pk.zone === 'surface' && pk.rest) {
          const a = pk.slot;
          drawPackage(ctx, pk.id, a.x + a.w * 0.31, G.gY, scale);
          drawPackage(ctx, pk.id, a.x + a.w * 0.69, G.gY, scale);
          drawAlvWalls(ctx, a, G.gY);
        } else {
          drawPackage(ctx, pk.id, pk.x, pk.y, scale);
        }
        if (pk.rest && finishT >= 0 && pk.id === 'verre') {
          ctx.globalCompositeOperation = 'source-over';
          draw.glow(ctx, pk.x, pk.y - 6 * s, 16 * s, TERRE, 0.25 + 0.15 * Math.sin(time * 3));
        }
      }
      /* étincelles et poussière */
      for (const p of puffs) {
        const k = p.t / p.life;
        ctx.fillStyle = rgba('#CDBB93', 0.6 * (1 - k));
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (1 + k), 0, TAU);
        ctx.fill();
      }
      for (const sp of sparks) {
        const k = 1 - sp.t / sp.life;
        ctx.fillStyle = rgba(sp.col, 0.9 * k);
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, sp.r * k, 0, TAU);
        ctx.fill();
        if (sp.col === '#FFFFFF') {
          ctx.fillStyle = rgba(BLEU, 0.6 * k);
          ctx.fillRect(sp.x - sp.r * 2 * k, sp.y - 0.5, sp.r * 4 * k, 1);
          ctx.fillRect(sp.x - 0.5, sp.y - sp.r * 2 * k, 1, sp.r * 4 * k);
        }
      }
    }

    api.loop((dt) => {
      update(dt);
      render();
    });

    function shuffle() {
      /* toujours un déchet facile d'abord (les gants), puis un déchet profond, puis le reste au hasard */
      const deep = [2, 3].sort(() => Math.random() - 0.5);
      const rest = [1, deep[1]].sort(() => Math.random() - 0.5);
      return [0, deep[0], ...rest];
    }

    function init() {
      order = shuffle();
      idx = 0;
      placed = 0;
      state = 'idle';
      drag = null;
      hover = null;
      hoverShown = 0;
      pkgs = [];
      sparks = [];
      puffs = [];
      cage = 0;
      cageTarget = 0;
      finishT = -1;
      infoTimer = 0;
      tipOn = false;
      tipNext = false;
      tip.classList.remove('is-on', 'is-shake');
      info.classList.remove('is-on', 'is-grow');
      segs.forEach((el) => { el.style.width = '0'; });
      tag0.classList.remove('is-hidden');
      tagS.classList.remove('is-hidden');
      bar.classList.remove('is-gone');
      btnS.classList.remove('is-hot');
      btnP.classList.remove('is-hot');
      showCard(false);
      api.status(TEXTES.range(0, N));
      showGesture();
    }

    cloudSprite = makeCloud();
    cv.onResize((w, h) => layout(w, h));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (state === 'info' || state === 'done') placeInfo(); });
    api.onReset(init);
    init();
    update(0.016);
    render();
  };
})();
