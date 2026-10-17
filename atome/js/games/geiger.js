/* Le compteur Geiger : on promène la sonde au-dessus de quatre objets posés sur une vieille table
   de laboratoire. Le compteur crépite plus ou moins vite selon l'objet : l'eau presque pas,
   la banane un peu, le granite un peu plus, et le vieux réveil peint au radium très vite. */
(function () {
  'use strict';
  const { lib } = window.RM;
  const { TAU, rand, clamp, lerp, ease, rgba, draw } = lib;

  /* Tous les textes du jeu, faciles à corriger */
  const TEXTES = {
    statut: (n) => `Objets analysés : ${n} sur 4`,
    question: 'Lequel fait le plus crépiter le compteur ? Touche-le.',
    encore: 'Écoute encore : un autre objet crépite plus fort.',
    fin: 'Le vieux réveil au radium fait crépiter le compteur !',
    finStatut: 'La radioactivité existe partout dans la nature, en toute petite quantité. Marie Curie a étudié le radium toute sa vie.',
    objets: {
      eau: { nom: 'Verre d’eau', texte: 'Presque rien : le compteur entend seulement la radioactivité naturelle qui nous entoure.' },
      banane: { nom: 'Banane', texte: 'Elle contient du potassium, dont une infime partie est radioactive. Aucun danger !' },
      granite: { nom: 'Granite', texte: 'Certaines roches, comme le granite, contiennent un peu d’uranium naturel.' },
      reveil: { nom: 'Vieux réveil', texte: 'Autrefois, on peignait les aiguilles avec du radium pour qu’elles brillent dans le noir. On a arrêté : c’était dangereux pour les personnes qui les peignaient.' },
    },
  };

  /* Cadence des crépitements (schématique, par seconde) : bruit de fond partout, puis selon l'objet */
  const FOND = 0.35;
  const CADENCE = { eau: 0.7, banane: 2.2, granite: 4.6, reveil: 17 };
  const DWELL = 1;      /* secondes au-dessus d'un objet pour l'analyser */

  const CSS = `
.game[data-game="geiger"] .gg-label {
  position: absolute; z-index: 4; left: 0; top: 0;
  width: max-content; max-width: min(17rem, calc(100% - 20px));
  margin: 0; padding: 9px 13px 11px;
  border-radius: 13px 17px 15px 12px / 15px 13px 17px 14px;
  background: #F3EBD4; color: #1E271C;
  font-size: 0.9rem; line-height: 1.38;
  box-shadow: 0 0 0 1px rgba(80, 60, 30, 0.18), 0 14px 26px -12px rgba(0, 0, 0, 0.7);
  pointer-events: none; opacity: 0; visibility: hidden;
  transform: translateY(6px) scale(0.97); transform-origin: var(--ax, 50%) 100%;
  transition: opacity 0.2s, transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1.1), visibility 0s 0.25s;
}
.game[data-game="geiger"] .gg-label.is-on {
  opacity: 1; visibility: visible; transform: none;
  transition: opacity 0.2s, transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1.1), visibility 0s;
}
.game[data-game="geiger"] .gg-label[data-side="below"] { transform-origin: var(--ax, 50%) 0; }
.game[data-game="geiger"] .gg-label.is-compact {
  max-width: calc(100% - 16px); padding: 7px 11px 8px; font-size: 0.8125rem; line-height: 1.3;
}
.game[data-game="geiger"] .gg-label.is-compact .gg-name { font-size: 0.75rem; margin-bottom: 1px; }
.game[data-game="geiger"] .gg-label::after {
  content: ""; position: absolute; left: var(--ax, 50%); width: 12px; height: 12px;
  margin-left: -6px; background: inherit; border-radius: 2px; transform: rotate(45deg);
}
.game[data-game="geiger"] .gg-label[data-side="above"]::after { bottom: -5px; }
.game[data-game="geiger"] .gg-label[data-side="below"]::after { top: -5px; }
.game[data-game="geiger"] .gg-label[data-side="side"]::after { display: none; }
.game[data-game="geiger"] .gg-name {
  display: flex; align-items: center; gap: 5px; margin-bottom: 2px;
  font-size: 0.8125rem; font-weight: 800; letter-spacing: 0.01em; color: #3F6B1E;
}
.game[data-game="geiger"] .gg-name svg { width: 15px; height: 15px; flex: none; }
.game[data-game="geiger"] .gg-hit {
  position: absolute; z-index: 3; padding: 0; margin: 0; border: 0; border-radius: 50%;
  background: transparent; pointer-events: none; opacity: 0;
}
.game[data-game="geiger"] .gg-hit:focus-visible { opacity: 1; outline: 2.5px dashed #C4F383; outline-offset: 4px; }
.game[data-game="geiger"] .game-canvas { cursor: grab; }
.game[data-game="geiger"] .game-canvas.is-grab { cursor: grabbing; }
.game[data-game="geiger"] .gesture-dot {
  box-shadow: 0 0 0 7px rgba(255, 255, 255, 0.25), 0 0 0 15px rgba(184, 240, 106, 0.28), 0 4px 14px rgba(0, 0, 0, 0.45);
}
`;
  const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#5E9A2C"/>' +
    '<path d="M6.8 12.4l3.4 3.4 7-7.4" fill="none" stroke="#F3EBD4" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function seeded(seed) {
    let s = seed >>> 0 || 1;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }
  function mk(w, h, dpr) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * dpr));
    c.height = Math.max(1, Math.round(h * dpr));
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    return { c, g, w, h };
  }
  /* Ombre douce et ovale sur la table */
  function softShadow(g, x, y, rx, ry, a) {
    g.save();
    g.translate(x, y);
    g.scale(1, ry / rx);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
    gr.addColorStop(0, `rgba(8,5,2,${a})`);
    gr.addColorStop(0.55, `rgba(8,5,2,${a * 0.55})`);
    gr.addColorStop(1, 'rgba(8,5,2,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(0, 0, rx, 0, TAU);
    g.fill();
    g.restore();
  }

  /* Chiffres du cadran tracés au trait (boîte 0,6 × 1), comme peints au pinceau */
  const DIGIT = {
    1: (g) => { g.moveTo(0.14, 0.2); g.lineTo(0.34, 0.02); g.lineTo(0.34, 1); },
    2: (g) => {
      g.moveTo(0.04, 0.27);
      g.quadraticCurveTo(0.08, 0.0, 0.31, 0.0);
      g.quadraticCurveTo(0.58, 0.02, 0.55, 0.3);
      g.quadraticCurveTo(0.5, 0.52, 0.04, 1);
      g.lineTo(0.6, 1);
    },
    3: (g) => {
      g.moveTo(0.06, 0.1);
      g.quadraticCurveTo(0.3, -0.06, 0.52, 0.12);
      g.quadraticCurveTo(0.62, 0.4, 0.26, 0.46);
      g.quadraticCurveTo(0.66, 0.5, 0.57, 0.8);
      g.quadraticCurveTo(0.42, 1.06, 0.04, 0.9);
    },
    6: (g) => {
      g.moveTo(0.52, 0.04);
      g.quadraticCurveTo(0.08, 0.14, 0.07, 0.66);
      g.moveTo(0.57, 0.72);
      g.ellipse(0.32, 0.72, 0.25, 0.27, 0, 0, TAU);
    },
  };
  function strokeDigits(g, str, x, y, size, rot) {
    const dw = size * 0.6, gap = size * 0.14;
    const total = str.length * dw + (str.length - 1) * gap;
    g.save();
    g.translate(x, y);
    if (rot) g.rotate(rot);
    g.translate(-total / 2, -size / 2);
    for (let i = 0; i < str.length; i++) {
      g.save();
      g.translate(i * (dw + gap), 0);
      g.scale(size, size);
      g.beginPath();
      DIGIT[str[i]](g);
      g.restore();
      g.stroke();
    }
    g.restore();
  }

  /* Vieux réveil : boîtier de laiton, deux cloches, cadran sombre où les aiguilles, les points
     et les chiffres brillent d'un vert pâle (peinture au radium d'autrefois). */
  function paintClock(g, cx, cy, R) {
    const base = cy + R * 1.42;
    softShadow(g, cx + R * 0.3, base + 1, R * 1.25, R * 0.28, 0.55);
    /* pieds */
    g.lineCap = 'round';
    for (const s of [-1, 1]) {
      g.strokeStyle = '#6E5428';
      g.lineWidth = R * 0.13;
      g.beginPath();
      g.moveTo(cx + s * R * 0.5, cy + R * 0.78);
      g.lineTo(cx + s * R * 0.78, base - R * 0.04);
      g.stroke();
      g.fillStyle = '#B9974F';
      g.beginPath();
      g.ellipse(cx + s * R * 0.8, base - R * 0.02, R * 0.13, R * 0.07, 0, 0, TAU);
      g.fill();
    }
    /* cloches et marteau */
    for (const s of [-1, 1]) {
      const a = -Math.PI / 2 + s * 0.68;
      const bx = cx + Math.cos(a) * R * 1.02, by = cy + Math.sin(a) * R * 1.02;
      g.save();
      g.translate(bx, by);
      g.rotate(a + Math.PI / 2);
      const bg = g.createLinearGradient(-R * 0.42, 0, R * 0.42, 0);
      bg.addColorStop(0, '#5E4A22');
      bg.addColorStop(0.32, '#F1D58E');
      bg.addColorStop(0.6, '#B8954A');
      bg.addColorStop(1, '#4A3816');
      g.fillStyle = bg;
      g.beginPath();
      g.moveTo(-R * 0.42, R * 0.06);
      g.bezierCurveTo(-R * 0.42, -R * 0.42, R * 0.42, -R * 0.42, R * 0.42, R * 0.06);
      g.closePath();
      g.fill();
      g.fillStyle = '#C9A962';
      g.beginPath();
      g.arc(0, -R * 0.33, R * 0.06, 0, TAU);
      g.fill();
      g.restore();
    }
    g.strokeStyle = '#8A6C34';
    g.lineWidth = R * 0.06;
    g.beginPath();
    g.moveTo(cx, cy - R * 0.96);
    g.lineTo(cx, cy - R * 1.34);
    g.stroke();
    g.fillStyle = '#D8BC78';
    g.beginPath();
    g.arc(cx, cy - R * 1.36, R * 0.08, 0, TAU);
    g.fill();
    /* boîtier */
    const cg = g.createRadialGradient(cx - R * 0.4, cy - R * 0.45, R * 0.1, cx, cy, R * 1.05);
    cg.addColorStop(0, '#FBE7B0');
    cg.addColorStop(0.45, '#C6A05A');
    cg.addColorStop(0.85, '#7A5A26');
    cg.addColorStop(1, '#4B3714');
    g.fillStyle = cg;
    g.beginPath();
    g.arc(cx, cy, R, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(255,240,200,0.5)';
    g.lineWidth = R * 0.04;
    g.beginPath();
    g.arc(cx, cy, R * 0.93, Math.PI * 1.05, Math.PI * 1.6);
    g.stroke();
    /* cadran sombre */
    const r2 = R * 0.8;
    const dg = g.createRadialGradient(cx - r2 * 0.2, cy - r2 * 0.25, r2 * 0.1, cx, cy, r2);
    dg.addColorStop(0, '#26302A');
    dg.addColorStop(1, '#0D1310');
    g.fillStyle = dg;
    g.beginPath();
    g.arc(cx, cy, r2, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.6)';
    g.lineWidth = R * 0.05;
    g.stroke();
    /* peinture lumineuse : points, chiffres, aiguilles (avec un halo) */
    const LUM = '#D6FFB0';
    g.save();
    g.shadowColor = 'rgba(184,240,106,0.9)';
    g.shadowBlur = R * 0.22;
    g.fillStyle = LUM;
    for (let i = 0; i < 12; i++) {
      if (i % 3 === 0) continue;
      const a = (i / 12) * TAU - Math.PI / 2;
      g.beginPath();
      g.arc(cx + Math.cos(a) * r2 * 0.8, cy + Math.sin(a) * r2 * 0.8, R * 0.055, 0, TAU);
      g.fill();
    }
    g.strokeStyle = LUM;
    g.lineWidth = Math.max(1, R * 0.06);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const ds = R * 0.24;
    strokeDigits(g, '12', cx, cy - r2 * 0.72, ds);
    strokeDigits(g, '3', cx + r2 * 0.74, cy, ds);
    strokeDigits(g, '6', cx, cy + r2 * 0.72, ds);
    strokeDigits(g, '6', cx - r2 * 0.74, cy, ds, Math.PI);
    /* aiguilles à 10 h 10 */
    const hand = (ang, len, wid) => {
      const ux = Math.cos(ang), uy = Math.sin(ang);
      g.beginPath();
      g.moveTo(cx - uy * wid, cy + ux * wid);
      g.lineTo(cx + ux * len * 0.72 - uy * wid * 1.6, cy + uy * len * 0.72 + ux * wid * 1.6);
      g.lineTo(cx + ux * len, cy + uy * len);
      g.lineTo(cx + ux * len * 0.72 + uy * wid * 1.6, cy + uy * len * 0.72 - ux * wid * 1.6);
      g.lineTo(cx + uy * wid, cy - ux * wid);
      g.closePath();
      g.fill();
    };
    hand(-Math.PI / 2 - (2 / 12) * TAU + (10 / 60) * (TAU / 12), r2 * 0.5, R * 0.05);
    hand(-Math.PI / 2 + (10 / 60) * TAU, r2 * 0.74, R * 0.04);
    g.restore();
    g.fillStyle = '#C9A962';
    g.beginPath();
    g.arc(cx, cy, R * 0.07, 0, TAU);
    g.fill();
    /* verre bombé */
    const gl = g.createLinearGradient(cx - r2, cy - r2, cx + r2 * 0.2, cy + r2 * 0.2);
    gl.addColorStop(0, 'rgba(255,255,255,0.22)');
    gl.addColorStop(0.45, 'rgba(255,255,255,0.03)');
    gl.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gl;
    g.beginPath();
    g.arc(cx, cy, r2, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.lineWidth = R * 0.035;
    g.beginPath();
    g.arc(cx, cy, r2 * 0.88, Math.PI * 1.1, Math.PI * 1.42);
    g.stroke();
  }

  /* Verre d'eau : verre épais un peu évasé, eau légèrement bleutée, reflets et ménisque */
  function paintGlass(g, cx, base, W, H) {
    softShadow(g, cx + W * 0.28, base + 1, W * 0.62, W * 0.13, 0.45);
    /* tache de lumière concentrée par l'eau sur la table */
    const sp = g.createRadialGradient(cx + W * 0.62, base + 2, 0, cx + W * 0.62, base + 2, W * 0.5);
    sp.addColorStop(0, 'rgba(255,236,190,0.35)');
    sp.addColorStop(1, 'rgba(255,236,190,0)');
    g.save();
    g.translate(0, base + 2);
    g.scale(1, 0.32);
    g.translate(0, -(base + 2));
    g.fillStyle = sp;
    g.beginPath();
    g.arc(cx + W * 0.62, base + 2, W * 0.5, 0, TAU);
    g.fill();
    g.restore();
    const top = base - H, tw = W / 2, bw = W * 0.4, ry = W * 0.11;
    const xAt = (y) => lerp(bw, tw, (base - y) / H);
    const body = () => {
      g.beginPath();
      g.moveTo(cx - tw, top);
      g.lineTo(cx - bw, base - ry);
      g.ellipse(cx, base - ry, bw, ry, 0, Math.PI, 0, true);
      g.lineTo(cx + tw, top);
      g.closePath();
    };
    /* paroi arrière, très légère */
    body();
    g.fillStyle = 'rgba(200,225,220,0.08)';
    g.fill();
    /* eau */
    const wl = base - H * 0.68;
    const wx = xAt(wl);
    g.save();
    body();
    g.clip();
    const wg = g.createLinearGradient(0, wl, 0, base);
    wg.addColorStop(0, 'rgba(165,215,225,0.42)');
    wg.addColorStop(1, 'rgba(80,140,150,0.55)');
    g.fillStyle = wg;
    g.fillRect(cx - tw - 2, wl, W + 4, base - wl + 2);
    g.restore();
    g.fillStyle = 'rgba(205,240,245,0.5)';
    g.beginPath();
    g.ellipse(cx, wl, wx, ry * 0.9, 0, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.lineWidth = 1;
    g.beginPath();
    g.ellipse(cx, wl, wx, ry * 0.9, 0, 0.1, Math.PI - 0.1);
    g.stroke();
    /* fond épais du verre */
    g.fillStyle = 'rgba(220,240,235,0.25)';
    g.beginPath();
    g.ellipse(cx, base - ry * 1.4, bw * 0.96, ry * 0.9, 0, 0, TAU);
    g.fill();
    /* contour et reflets */
    g.strokeStyle = 'rgba(230,248,242,0.55)';
    g.lineWidth = 1.4;
    body();
    g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.6)';
    g.lineWidth = 1.3;
    g.beginPath();
    g.ellipse(cx, top, tw, ry, 0, 0, TAU);
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.42)';
    g.beginPath();
    g.moveTo(cx - tw * 0.78, top + ry * 1.6);
    g.lineTo(cx - tw * 0.6, top + ry * 1.6);
    g.lineTo(cx - bw * 0.55, base - ry * 2.2);
    g.lineTo(cx - bw * 0.72, base - ry * 2.2);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.beginPath();
    g.moveTo(cx + tw * 0.62, top + ry * 1.8);
    g.lineTo(cx + tw * 0.72, top + ry * 1.8);
    g.lineTo(cx + bw * 0.68, base - ry * 2.4);
    g.lineTo(cx + bw * 0.58, base - ry * 2.4);
    g.closePath();
    g.fill();
  }

  /* Banane couchée : croissant jaune, arêtes, bouts bruns et petites taches de sucre */
  function paintBanana(g, cx, base, L, T) {
    softShadow(g, cx + L * 0.06, base + 1, L * 0.55, T * 0.42, 0.5);
    const N = 26;
    const top = [], bot = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const x = cx + (t - 0.5) * L;
      const mid = base - T * 0.62 - Math.pow(Math.abs(t - 0.5) * 2, 2) * T * 1.15;
      const th = T * Math.pow(Math.sin(Math.PI * clamp(t * 0.96 + 0.02)), 0.55) * 0.5;
      top.push([x, mid - th]);
      bot.push([x, mid + th]);
    }
    const shape = () => {
      g.beginPath();
      g.moveTo(top[0][0], top[0][1]);
      for (let i = 1; i <= N; i++) g.lineTo(top[i][0], top[i][1]);
      for (let i = N; i >= 0; i--) g.lineTo(bot[i][0], bot[i][1]);
      g.closePath();
    };
    shape();
    const bg = g.createLinearGradient(0, base - T * 1.9, 0, base);
    bg.addColorStop(0, '#FFF0A0');
    bg.addColorStop(0.45, '#F7D24A');
    bg.addColorStop(0.8, '#D9A82A');
    bg.addColorStop(1, '#9C6E18');
    g.fillStyle = bg;
    g.fill();
    g.save();
    shape();
    g.clip();
    /* arêtes de la peau */
    g.lineWidth = 1;
    for (const k of [0.38, 0.62]) {
      g.strokeStyle = k < 0.5 ? 'rgba(255,250,215,0.45)' : 'rgba(150,105,20,0.35)';
      g.beginPath();
      for (let i = 2; i <= N - 2; i++) {
        const y = lerp(top[i][1], bot[i][1], k);
        if (i === 2) g.moveTo(top[i][0], y);
        else g.lineTo(top[i][0], y);
      }
      g.stroke();
    }
    /* taches de sucre */
    const r = seeded(17);
    for (let i = 0; i < 14; i++) {
      const j = 4 + Math.floor(r() * (N - 8));
      const y = lerp(top[j][1], bot[j][1], 0.2 + r() * 0.6);
      g.fillStyle = `rgba(110,70,20,${0.25 + r() * 0.35})`;
      g.beginPath();
      g.ellipse(top[j][0] + r() * 4, y, 0.8 + r() * 1.4, 0.6 + r(), r() * 3, 0, TAU);
      g.fill();
    }
    /* reflet */
    g.strokeStyle = 'rgba(255,255,240,0.55)';
    g.lineWidth = Math.max(1.2, T * 0.09);
    g.lineCap = 'round';
    g.beginPath();
    for (let i = 6; i <= N - 7; i++) {
      const y = lerp(top[i][1], bot[i][1], 0.22);
      if (i === 6) g.moveTo(top[i][0], y);
      else g.lineTo(top[i][0], y);
    }
    g.stroke();
    g.restore();
    /* queue (à gauche) et bout (à droite) */
    const s0 = [(top[1][0] + bot[1][0]) / 2, (top[1][1] + bot[1][1]) / 2];
    g.strokeStyle = '#7A5524';
    g.lineWidth = T * 0.22;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(s0[0] + T * 0.1, s0[1]);
    g.quadraticCurveTo(s0[0] - T * 0.3, s0[1] - T * 0.12, s0[0] - T * 0.5, s0[1] - T * 0.42);
    g.stroke();
    g.fillStyle = '#4A3015';
    g.beginPath();
    g.ellipse(s0[0] - T * 0.52, s0[1] - T * 0.45, T * 0.13, T * 0.1, 0.6, 0, TAU);
    g.fill();
    const e0 = [(top[N - 1][0] + bot[N - 1][0]) / 2, (top[N - 1][1] + bot[N - 1][1]) / 2];
    g.fillStyle = '#3E2A14';
    g.beginPath();
    g.ellipse(e0[0] + T * 0.06, e0[1] - T * 0.02, T * 0.12, T * 0.1, -0.5, 0, TAU);
    g.fill();
  }

  /* Caillou de granite : galet moucheté de rose (feldspath), de gris clair (quartz) et de noir (mica) */
  function paintGranite(g, cx, base, rx, ry) {
    softShadow(g, cx + rx * 0.2, base, rx * 1.15, ry * 0.42, 0.55);
    const cy = base - ry * 0.95;
    const shape = () => {
      g.save();
      g.translate(cx, cy);
      g.scale(1, ry / rx);
      draw.blob(g, 0, 0, rx, 0.07, 2.2, 0, 40);
      g.restore();
    };
    shape();
    g.fillStyle = '#B79C98';
    g.fill();
    g.save();
    shape();
    g.clip();
    const r = seeded(31);
    const area = Math.PI * rx * ry;
    for (let i = 0; i < area / 9; i++) {
      const x = cx + (r() * 2 - 1) * rx, y = cy + (r() * 2 - 1) * ry;
      const k = r();
      let col, s;
      if (k < 0.34) { col = r() < 0.5 ? '#E2A99C' : '#CF8B80'; s = 1.6 + r() * 3.2; }
      else if (k < 0.62) { col = r() < 0.5 ? '#EEEAE6' : '#C9C4C2'; s = 1.2 + r() * 2.6; }
      else if (k < 0.86) { col = '#8E8486'; s = 1 + r() * 2; }
      else { col = '#1D1A1C'; s = 0.8 + r() * 1.8; }
      g.fillStyle = col;
      g.globalAlpha = 0.65 + r() * 0.35;
      g.beginPath();
      const n = 5;
      const a0 = r() * TAU;
      for (let j = 0; j < n; j++) {
        const a = a0 + (j / n) * TAU;
        const rr = s * (0.6 + r() * 0.5);
        if (j === 0) g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8);
        else g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8);
      }
      g.closePath();
      g.fill();
    }
    g.globalAlpha = 1;
    const sh = g.createRadialGradient(cx - rx * 0.35, cy - ry * 0.5, rx * 0.1, cx, cy, rx * 1.1);
    sh.addColorStop(0, 'rgba(255,245,230,0.35)');
    sh.addColorStop(0.5, 'rgba(255,245,230,0)');
    sh.addColorStop(1, 'rgba(20,10,10,0.55)');
    g.fillStyle = sh;
    g.fillRect(cx - rx - 2, cy - ry - 2, rx * 2 + 4, ry * 2 + 4);
    g.restore();
    g.fillStyle = 'rgba(255,255,255,0.22)';
    g.beginPath();
    g.ellipse(cx - rx * 0.38, cy - ry * 0.52, rx * 0.22, ry * 0.12, -0.3, 0, TAU);
    g.fill();
  }

  window.RM.games.geiger = function (api) {
    api.style(CSS);
    const stage = api.stage;
    const cv = api.canvas();
    const ctx = cv.ctx;
    const AMB = api.reducedMotion ? 0.3 : 1;

    /* ---- étiquette d'analyse et boutons invisibles (clavier) ---- */
    const label = document.createElement('div');
    label.className = 'gg-label';
    label.setAttribute('aria-live', 'polite');
    label.innerHTML = '<p class="gg-name">' + CHECK + '<span></span></p><span class="gg-text"></span>';
    stage.appendChild(label);
    const labelName = label.querySelector('.gg-name span');
    const labelText = label.querySelector('.gg-text');
    label.style.margin = '0';

    const KEYS = ['reveil', 'eau', 'banane', 'granite'];
    const objs = KEYS.map((key) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'gg-hit';
      b.setAttribute('aria-label', TEXTES.objets[key].nom);
      stage.appendChild(b);
      return { key, btn: b, cx: 0, cy: 0, rx: 30, ry: 30, sprite: null, sx: 0, sy: 0, dwell: 0, armed: true, done: false, shake: 0, glow: 0, box: [0, 0, 0, 0] };
    });
    const O = {};
    objs.forEach((o) => { O[o.key] = o; });

    /* ---- géométrie ---- */
    const G = { w: 1, h: 1, u: 1, tableTop: 1, frontY: 1, bx0: 0, bx1: 1, by0: 0, by1: 1, bw: 1, bh: 1, dcx: 0, dcy: 0, dr: 1, Lp: 80, dp: 13 };
    const ANG = -2.2;                      /* la sonde pointe vers le haut, un peu à gauche */
    const UX = Math.cos(ANG), UY = Math.sin(ANG);
    const GRIP = 0.6;                      /* où le doigt tient la sonde (part de la longueur depuis la pointe) */
    let bg = null, probeC = null;

    function geometry(w, h) {
      G.w = w;
      G.h = h;
      /* scène très large : les quatre objets sur une seule rangée */
      G.wide = w / h > 1.2;
      const u = G.wide ? Math.min(w * 0.75, h * 1.05) : Math.min(w, h * 0.82);
      G.u = u;
      G.tableTop = Math.round(h * (G.wide ? 0.46 : 0.4));
      G.frontY = Math.round(h * 0.935);
      G.bw = clamp(w * 0.34, 112, 200);
      G.bh = G.bw * 0.74;
      G.bx1 = w - 12;
      G.bx0 = G.bx1 - G.bw;
      G.by0 = 12;
      G.by1 = G.by0 + G.bh;
      G.dcx = G.bx0 + G.bw * 0.5;
      G.dcy = G.by0 + G.bh * 0.62;
      G.dr = G.bw * 0.34;
      G.ilx = G.bx0 + G.bw * 0.17;
      G.ily = G.by0 + G.bh * 0.82;
      G.jx = G.bx1;
      G.jy = G.by0 + G.bh * 0.66;
      G.lx = w * 0.42;
      G.ly = Math.round(h * 0.1);
      G.Lp = clamp(u * 0.25, 72, 122);
      G.dp = G.Lp * 0.16;
      const backBase = h * 0.625, frontBase = h * 0.865;
      const AT = G.wide
        ? { reveil: [0.13, frontBase], banane: [0.38, frontBase], granite: [0.62, frontBase], eau: [0.86, frontBase] }
        : { reveil: [0.25, backBase], eau: [0.75, backBase], banane: [0.29, frontBase], granite: [0.735, frontBase] };
      /* réveil */
      const R = u * 0.1;
      let o = O.reveil;
      let base = AT.reveil[1];
      o.R = R;
      o.cx = w * AT.reveil[0];
      o.cy = base - R * 1.42;
      o.rx = Math.max(R * 1.4, 32);
      o.ry = Math.max(R * 1.55, 32);
      o.hcy = o.cy - R * 0.05;
      o.box = [o.cx - R * 1.4, o.cy - R * 1.48, o.cx + R * 1.6, base + R * 0.4];
      o.vis = [o.cx - R * 1.05, o.cy - R * 1.4, o.cx + R * 1.05, base];
      /* verre d'eau */
      o = O.eau;
      base = AT.eau[1];
      o.W = u * 0.15;
      o.H = u * 0.24;
      o.cx = w * AT.eau[0];
      o.base = base;
      o.cy = base - o.H / 2;
      o.hcy = o.cy;
      o.rx = Math.max(o.W * 0.9, 32);
      o.ry = Math.max(o.H * 0.62, 32);
      o.box = [o.cx - o.W * 0.62, base - o.H - o.W * 0.16, o.cx + o.W * 1.15, base + o.W * 0.2];
      o.vis = [o.cx - o.W * 0.5, base - o.H - o.W * 0.1, o.cx + o.W * 0.5, base];
      /* banane */
      o = O.banane;
      base = AT.banane[1];
      o.L = u * 0.33;
      o.T = u * 0.085;
      o.cx = w * AT.banane[0];
      o.base = base;
      o.cy = base - o.T * 0.95;
      o.hcy = o.cy;
      o.rx = Math.max(o.L * 0.56, 32);
      o.ry = Math.max(o.T * 1.6, 32);
      o.box = [o.cx - o.L * 0.66, base - o.T * 2.1, o.cx + o.L * 0.66, base + o.T * 0.55];
      o.vis = [o.cx - o.L * 0.55, base - o.T * 1.9, o.cx + o.L * 0.52, base];
      /* granite */
      o = O.granite;
      base = AT.granite[1];
      o.gx = u * 0.12;
      o.gy = u * 0.076;
      o.cx = w * AT.granite[0];
      o.base = base;
      o.cy = base - o.gy * 0.95;
      o.hcy = o.cy;
      o.rx = Math.max(o.gx * 1.3, 32);
      o.ry = Math.max(o.gy * 1.6, 32);
      o.box = [o.cx - o.gx * 1.22, base - o.gy * 2.15, o.cx + o.gx * 1.45, base + o.gy * 0.55];
      o.vis = [o.cx - o.gx * 1.08, base - o.gy * 2, o.cx + o.gx * 1.08, base];
      label.classList.toggle('is-compact', h < 400 || w < 330);
      buildSprites();
      bg = makeBg(w, h);
      probeC = makeProbe();
      objs.forEach((ob) => {
        const s = ob.btn.style;
        s.left = (ob.cx - ob.rx) + 'px';
        s.top = (ob.hcy - ob.ry) + 'px';
        s.width = ob.rx * 2 + 'px';
        s.height = ob.ry * 2 + 'px';
      });
      if (probe) {
        if (!moved) placeProbeHome();
        clampProbe();
      }
      if (labelFor) placeLabel(labelFor);
    }

    function buildSprites() {
      const dpr = cv.dpr;
      objs.forEach((o) => {
        const [x0, y0, x1, y1] = o.box;
        const s = mk(x1 - x0, y1 - y0, dpr);
        s.g.translate(-x0, -y0);
        if (o.key === 'reveil') paintClock(s.g, o.cx, o.cy, o.R);
        else if (o.key === 'eau') paintGlass(s.g, o.cx, o.base, o.W, o.H);
        else if (o.key === 'banane') paintBanana(s.g, o.cx, o.base, o.L, o.T);
        else paintGranite(s.g, o.cx, o.base, o.gx, o.gy);
        o.sprite = s;
        o.sx = x0;
        o.sy = y0;
      });
    }

    /* La sonde, dessinée à l'horizontale (pointe à droite) puis tournée au moment du rendu */
    function makeProbe() {
      const L = G.Lp, d = G.dp;
      const P = mk(L + 10, d * 1.6 + 10, cv.dpr);
      const g = P.g;
      const cy = P.h / 2;
      g.translate(4, 0);
      const cyl = (x0, x1, dd, stops) => {
        const gr = g.createLinearGradient(0, cy - dd / 2, 0, cy + dd / 2);
        stops.forEach(([t, c]) => gr.addColorStop(t, c));
        g.fillStyle = gr;
        draw.roundRect(g, x0, cy - dd / 2, x1 - x0, dd, Math.min(dd * 0.3, 4));
        g.fill();
      };
      /* poignée en bakélite, bagues de prise */
      cyl(0, L * 0.42, d * 1.12, [[0, '#120C08'], [0.28, '#5A4535'], [0.5, '#2E2219'], [1, '#0D0805']]);
      for (let i = 0; i < 4; i++) {
        const x = L * (0.1 + i * 0.075);
        g.fillStyle = 'rgba(0,0,0,0.45)';
        g.fillRect(x, cy - d * 0.56, 1.4, d * 1.12);
        g.fillStyle = 'rgba(255,230,200,0.12)';
        g.fillRect(x + 1.4, cy - d * 0.56, 1, d * 1.12);
      }
      /* bague de laiton */
      cyl(L * 0.41, L * 0.47, d * 1.28, [[0, '#4A3510'], [0.3, '#F0D188'], [0.55, '#B58A3E'], [1, '#3D2A0C']]);
      /* tube d'aluminium */
      cyl(L * 0.46, L * 0.93, d, [[0, '#4D5458'], [0.25, '#F2F5F6'], [0.45, '#AEB6BA'], [0.8, '#6C7479'], [1, '#30363A']]);
      /* fenêtre du tube, grillagée */
      cyl(L * 0.92, L, d * 1.1, [[0, '#23292C'], [0.3, '#8D979C'], [0.6, '#4C5559'], [1, '#1A1F22']]);
      g.fillStyle = 'rgba(10,14,16,0.85)';
      g.beginPath();
      g.ellipse(L - 1, cy, 1.6, d * 0.42, 0, 0, TAU);
      g.fill();
      g.fillStyle = 'rgba(200,215,220,0.6)';
      for (let k = -2; k <= 2; k++) {
        g.beginPath();
        g.arc(L * 0.955, cy + k * d * 0.16, 0.7, 0, TAU);
        g.fill();
      }
      return P;
    }

    /* Fond pré-rendu : mur et étagère, lampe, table de bois, boîtier du compteur (sans l'aiguille) */
    function makeBg(w, h) {
      const B = mk(w, h, cv.dpr);
      const g = B.g;
      const T = G.tableTop, F = G.frontY;
      /* mur : enduit vert sombre */
      const wg = g.createLinearGradient(0, 0, 0, T);
      wg.addColorStop(0, '#0C1610');
      wg.addColorStop(1, '#1B2A20');
      g.fillStyle = wg;
      g.fillRect(0, 0, w, T + 2);
      const n = lib.makeNoise(9);
      const tw = Math.max(8, Math.round(w / 3)), th = Math.max(8, Math.round(T / 3));
      const tex = document.createElement('canvas');
      tex.width = tw;
      tex.height = th;
      const tg = tex.getContext('2d');
      const img = tg.createImageData(tw, th);
      for (let y = 0; y < th; y++) {
        for (let x = 0; x < tw; x++) {
          const v = n.fbm(x / 9, y / 9, 4);
          const j = (y * tw + x) * 4;
          const c = v > 0.5 ? 255 : 0;
          img.data[j] = c;
          img.data[j + 1] = c;
          img.data[j + 2] = c;
          img.data[j + 3] = Math.round(Math.abs(v - 0.5) * 70);
        }
      }
      tg.putImageData(img, 0, 0);
      g.drawImage(tex, 0, 0, w, T);
      /* lueur chaude de la lampe sur le mur */
      g.globalCompositeOperation = 'lighter';
      draw.glow(g, G.lx, G.ly + 10, Math.max(w, h) * 0.55, '#FFB867', 0.16);
      g.globalCompositeOperation = 'source-over';
      /* plinthe */
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(0, T - 10, w, 10);
      g.fillStyle = 'rgba(255,220,170,0.06)';
      g.fillRect(0, T - 10, w, 1);
      /* étagère et flacons, à gauche */
      const sx0 = w * 0.04, sx1 = w * 0.27, sy = Math.round(T * 0.58);
      g.fillStyle = '#3A2516';
      g.fillRect(sx0, sy, sx1 - sx0, 5);
      g.fillStyle = 'rgba(255,220,170,0.18)';
      g.fillRect(sx0, sy, sx1 - sx0, 1);
      softShadow(g, (sx0 + sx1) / 2, sy + 8, (sx1 - sx0) * 0.55, 5, 0.4);
      const fl = (x, fw, fh, col) => {
        g.fillStyle = rgba(col, 0.28);
        g.strokeStyle = 'rgba(220,240,225,0.35)';
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x - fw * 0.14, sy - fh);
        g.lineTo(x - fw * 0.14, sy - fh * 0.6);
        g.lineTo(x - fw / 2, sy);
        g.lineTo(x + fw / 2, sy);
        g.lineTo(x + fw * 0.14, sy - fh * 0.6);
        g.lineTo(x + fw * 0.14, sy - fh);
        g.closePath();
        g.fill();
        g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.25)';
        g.fillRect(x - fw * 0.3, sy - fh * 0.35, 1.5, fh * 0.3);
      };
      const fs = clamp(G.u * 0.07, 18, 34);
      fl(sx0 + (sx1 - sx0) * 0.25, fs, fs * 1.25, '#8FD1A8');
      fl(sx0 + (sx1 - sx0) * 0.62, fs * 0.8, fs * 1.05, '#D9C27A');
      g.fillStyle = 'rgba(200,230,210,0.22)';
      g.beginPath();
      g.arc(sx0 + (sx1 - sx0) * 0.88, sy - fs * 0.32, fs * 0.32, 0, TAU);
      g.fill();
      g.strokeStyle = 'rgba(220,240,225,0.35)';
      g.stroke();
      /* table : plateau de bois sombre veiné */
      const tg2 = g.createLinearGradient(0, T, 0, F);
      tg2.addColorStop(0, '#2A1A10');
      tg2.addColorStop(1, '#4A2E1B');
      g.fillStyle = tg2;
      g.fillRect(0, T, w, F - T);
      const r = seeded(5);
      for (let k = 0; k < 46; k++) {
        const y0 = T + r() * (F - T);
        const amp = 1 + r() * 3, fq = 0.01 + r() * 0.02, ph = r() * 9;
        g.strokeStyle = r() < 0.6 ? `rgba(20,10,4,${0.15 + r() * 0.25})` : `rgba(160,110,70,${0.06 + r() * 0.1})`;
        g.lineWidth = 0.6 + r() * 1.4;
        g.beginPath();
        for (let x = -4; x <= w + 4; x += 6) {
          const y = y0 + Math.sin(x * fq + ph) * amp + n.noise2(x / 40, y0 / 10) * 4;
          if (x === -4) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.stroke();
      }
      /* joints des planches */
      [0.33, 0.68].forEach((t) => {
        const y = lerp(T, F, t);
        g.fillStyle = 'rgba(0,0,0,0.4)';
        g.fillRect(0, y, w, 1.5);
        g.fillStyle = 'rgba(255,210,160,0.06)';
        g.fillRect(0, y + 1.5, w, 1);
      });
      /* bord avant de la table */
      const eg = g.createLinearGradient(0, F, 0, h);
      eg.addColorStop(0, '#5E3B22');
      eg.addColorStop(0.15, '#3A2414');
      eg.addColorStop(1, '#1A0F08');
      g.fillStyle = eg;
      g.fillRect(0, F, w, h - F);
      g.fillStyle = 'rgba(255,215,160,0.25)';
      g.fillRect(0, F, w, 1);
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.fillRect(0, T, w, 3);
      /* flaque de lumière de la lampe sur la table */
      g.save();
      g.translate(G.lx, lerp(T, F, 0.45));
      g.scale(1, 0.45);
      g.globalCompositeOperation = 'lighter';
      draw.glow(g, 0, 0, w * 0.75, '#FFB867', 0.22);
      g.restore();
      /* lampe suspendue : fil, abat-jour émaillé, ampoule */
      const lx = G.lx, ly = G.ly, lr = clamp(G.u * 0.11, 30, 58);
      g.strokeStyle = '#0A0A08';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(lx, 0);
      g.lineTo(lx, ly - lr * 0.45);
      g.stroke();
      g.globalCompositeOperation = 'lighter';
      draw.glow(g, lx, ly + lr * 0.12, lr * 2.2, '#FFD28A', 0.35);
      g.globalCompositeOperation = 'source-over';
      const sg = g.createLinearGradient(lx - lr, 0, lx + lr, 0);
      sg.addColorStop(0, '#16261A');
      sg.addColorStop(0.35, '#3C5C42');
      sg.addColorStop(1, '#101A12');
      g.fillStyle = sg;
      g.beginPath();
      g.moveTo(lx - lr * 0.22, ly - lr * 0.5);
      g.quadraticCurveTo(lx - lr * 0.3, ly - lr * 0.1, lx - lr, ly + lr * 0.12);
      g.lineTo(lx + lr, ly + lr * 0.12);
      g.quadraticCurveTo(lx + lr * 0.3, ly - lr * 0.1, lx + lr * 0.22, ly - lr * 0.5);
      g.closePath();
      g.fill();
      g.fillStyle = '#FFE7B5';
      g.beginPath();
      g.ellipse(lx, ly + lr * 0.12, lr, lr * 0.16, 0, 0, TAU);
      g.fill();
      draw.glow(g, lx, ly + lr * 0.16, lr * 0.45, '#FFFFFF', 0.9);
      /* le compteur Geiger posé sur sa console, en haut à droite */
      paintBox(g);
      /* vignette douce */
      const vg = g.createRadialGradient(w * 0.5, h * 0.55, Math.min(w, h) * 0.35, w * 0.5, h * 0.55, Math.hypot(w, h) * 0.62);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.45)');
      g.fillStyle = vg;
      g.fillRect(0, 0, w, h);
      return B;
    }

    /* Boîtier du compteur : bakélite olive, cadran crème avec son arc gradué, voyant, haut-parleur */
    function paintBox(g) {
      const { bx0, by0, bw, bh, by1 } = G;
      /* console murale */
      g.fillStyle = '#2E1D11';
      g.fillRect(bx0 - 10, by1, G.w - bx0 + 10, 6);
      g.fillStyle = 'rgba(255,215,160,0.2)';
      g.fillRect(bx0 - 10, by1, G.w - bx0 + 10, 1);
      g.fillStyle = '#24160C';
      g.beginPath();
      g.moveTo(bx0 + bw * 0.2, by1 + 6);
      g.lineTo(bx0 + bw * 0.2 + 7, by1 + 6);
      g.lineTo(bx0 + bw * 0.2 + 3, by1 + 22);
      g.closePath();
      g.fill();
      softShadow(g, bx0 + bw / 2, by1 + 2, bw * 0.55, 5, 0.6);
      /* poignée */
      g.strokeStyle = '#8B8F87';
      g.lineWidth = 3;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(bx0 + bw * 0.3, by0 + 3);
      g.quadraticCurveTo(bx0 + bw * 0.5, by0 - 14, bx0 + bw * 0.7, by0 + 3);
      g.stroke();
      /* boîtier */
      const cg = g.createLinearGradient(bx0, by0, bx0 + bw * 0.3, by1);
      cg.addColorStop(0, '#556347');
      cg.addColorStop(0.5, '#38432F');
      cg.addColorStop(1, '#1E251A');
      g.fillStyle = cg;
      draw.roundRect(g, bx0, by0, bw, bh, 10);
      g.fill();
      g.strokeStyle = 'rgba(230,240,210,0.18)';
      g.lineWidth = 1.2;
      g.stroke();
      [[0.06, 0.08], [0.94, 0.08], [0.06, 0.92], [0.94, 0.92]].forEach(([fx, fy]) => {
        g.fillStyle = '#9EA394';
        g.beginPath();
        g.arc(bx0 + bw * fx, by0 + bh * fy, 1.8, 0, TAU);
        g.fill();
      });
      /* fenêtre du cadran */
      const fx0 = bx0 + bw * 0.1, fy0 = by0 + bh * 0.1, fw = bw * 0.8, fh = bh * 0.56;
      g.fillStyle = '#151A12';
      draw.roundRect(g, fx0 - 2, fy0 - 2, fw + 4, fh + 4, 9);
      g.fill();
      const fg = g.createLinearGradient(0, fy0, 0, fy0 + fh);
      fg.addColorStop(0, '#F4EBD0');
      fg.addColorStop(1, '#D9CDAA');
      g.fillStyle = fg;
      draw.roundRect(g, fx0, fy0, fw, fh, 7);
      g.fill();
      /* arc gradué : vert, jaune, puis rouge */
      const { dcx, dcy, dr } = G;
      const a0 = -Math.PI * 0.84, a1 = -Math.PI * 0.16;
      const band = (t0, t1, col) => {
        g.strokeStyle = col;
        g.lineWidth = Math.max(3, dr * 0.1);
        g.lineCap = 'butt';
        g.beginPath();
        g.arc(dcx, dcy, dr * 0.88, lerp(a0, a1, t0), lerp(a0, a1, t1));
        g.stroke();
      };
      band(0, 0.45, '#6FA83A');
      band(0.45, 0.75, '#E0B23A');
      band(0.75, 1, '#C9573A');
      g.strokeStyle = '#3A3428';
      for (let i = 0; i <= 20; i++) {
        const a = lerp(a0, a1, i / 20);
        const big = i % 5 === 0;
        g.lineWidth = big ? 1.6 : 0.9;
        g.beginPath();
        g.moveTo(dcx + Math.cos(a) * dr * (big ? 0.66 : 0.72), dcy + Math.sin(a) * dr * (big ? 0.66 : 0.72));
        g.lineTo(dcx + Math.cos(a) * dr * 0.8, dcy + Math.sin(a) * dr * 0.8);
        g.stroke();
      }
      /* voyant, haut-parleur et bouton */
      g.fillStyle = '#20150C';
      g.beginPath();
      g.arc(G.ilx, G.ily, bw * 0.055, 0, TAU);
      g.fill();
      const spx = bx0 + bw * 0.52, spy = by0 + bh * 0.82, spr = bw * 0.12;
      g.fillStyle = '#1A2016';
      g.beginPath();
      g.arc(spx, spy, spr, 0, TAU);
      g.fill();
      g.fillStyle = '#5B6650';
      for (let k = 0; k < 19; k++) {
        const rr = k === 0 ? 0 : k < 7 ? spr * 0.42 : spr * 0.78;
        const aa = k === 0 ? 0 : k < 7 ? (k / 6) * TAU : ((k - 7) / 12) * TAU;
        g.beginPath();
        g.arc(spx + Math.cos(aa) * rr, spy + Math.sin(aa) * rr, Math.max(0.8, spr * 0.1), 0, TAU);
        g.fill();
      }
      const kx = bx0 + bw * 0.83, ky = by0 + bh * 0.82, kr = bw * 0.075;
      const kg = g.createRadialGradient(kx - kr * 0.3, ky - kr * 0.3, 0, kx, ky, kr);
      kg.addColorStop(0, '#4C4036');
      kg.addColorStop(1, '#14100C');
      g.fillStyle = kg;
      g.beginPath();
      g.arc(kx, ky, kr, 0, TAU);
      g.fill();
      g.strokeStyle = '#C9C1AE';
      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(kx, ky);
      g.lineTo(kx + kr * 0.6, ky - kr * 0.6);
      g.stroke();
      /* prise du câble, sur le flanc droit */
      g.fillStyle = '#7D7F78';
      draw.roundRect(g, G.jx - 2, G.jy - 4, 7, 8, 2);
      g.fill();
    }

    /* ---- état ---- */
    const probe = { x: 0, y: 0, tx: 0, ty: 0 };   /* pointe de la sonde (actuelle et visée) */
    let moved = false, grabbing = null, glide = null;
    let phase = 'explore', analysed = 0, labelFor = null;
    let rate = 0, needle = 0, needleV = 0, lampFlash = 0, tipFlash = 0, time = 0;
    let shownStatus = null, over = null;
    const TAU_N = 1;                                  /* lissage de l'aiguille (s) */
    const RIP = Array.from({ length: 28 }, () => ({ on: false, x: 0, y: 0, t: 0, touch: false }));

    function setStatus(s) {
      if (s === shownStatus) return;
      shownStatus = s;
      api.status(s);
    }
    function placeProbeHome() {
      probe.x = probe.tx = G.w * 0.5;
      probe.y = probe.ty = G.h * (G.wide ? 0.6 : 0.735);
    }
    function clampProbe() {
      probe.tx = clamp(probe.tx, 10, G.w - 10);
      probe.ty = clamp(probe.ty, 10, G.h - 8);
    }

    /* objet sous un point : celui dont la zone (ovale généreux) contient le point */
    function objAt(x, y) {
      let best = null, bd = 1;
      for (let i = 0; i < objs.length; i++) {
        const o = objs[i];
        const dx = (x - o.cx) / o.rx, dy = (y - o.hcy) / o.ry;
        const d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = o; }
      }
      return best;
    }

    /* ---- étiquette d'analyse : placée là où elle cache le moins de choses ---- */
    function overlap(x, y, lw, lh, r) {
      const ox = Math.min(x + lw, r[2]) - Math.max(x, r[0]);
      const oy = Math.min(y + lh, r[3]) - Math.max(y, r[1]);
      return ox > 0 && oy > 0 ? ox * oy : 0;
    }
    function placeLabel(o) {
      const W = G.w, H = G.h, M = 8, gap = 10;
      const lw = label.offsetWidth, lh = label.offsetHeight;
      if (!lw) return;
      const [vx0, vy0, vx1, vy1] = o.vis;
      const cands = [
        ['above', o.cx - lw / 2, vy0 - gap - lh],
        ['below', o.cx - lw / 2, vy1 + gap],
        ['side', vx1 + gap, o.hcy - lh / 2],
        ['side', vx0 - gap - lw, o.hcy - lh / 2],
      ];
      let best = null, bs = Infinity;
      for (const [side, x0, y0] of cands) {
        const out = side === 'side'
          ? Math.max(0, M - x0) + Math.max(0, x0 + lw - (W - M))
          : Math.max(0, M - y0) + Math.max(0, y0 + lh - (H - M));
        const x = clamp(x0, M, W - M - lw), y = clamp(y0, M, H - M - lh);
        let pen = out * 60;
        pen += overlap(x, y, lw, lh, o.vis) * 6;
        /* pendant la lecture, mieux vaut cacher un moment le boîtier qu'un autre objet */
        pen += overlap(x, y, lw, lh, [G.bx0, G.by0, G.bx1, G.by1]);
        const wo = phase === 'explore' ? 2.5 : 4;
        for (let i = 0; i < objs.length; i++) if (objs[i] !== o) pen += overlap(x, y, lw, lh, objs[i].vis) * wo;
        if (side === 'side') pen += 400;
        if (pen < bs) { bs = pen; best = [out > 0 ? 'side' : side, x, y]; }
      }
      label.dataset.side = best[0];
      label.style.setProperty('--ax', clamp(o.cx - best[1], 16, lw - 16).toFixed(1) + 'px');
      label.style.left = best[1].toFixed(1) + 'px';
      label.style.top = best[2].toFixed(1) + 'px';
    }
    function showLabel(o) {
      labelName.textContent = TEXTES.objets[o.key].nom;
      labelText.textContent = lib.fr(TEXTES.objets[o.key].texte);
      label.classList.remove('is-on');
      labelFor = o;
      placeLabel(o);
      void label.offsetWidth;
      label.classList.add('is-on');
    }
    function hideLabel() {
      label.classList.remove('is-on');
      labelFor = null;
    }

    /* ---- la sonde suit le doigt ; taper un objet l'y amène ---- */
    function distSeg(px, py, ax, ay, bx, by) {
      const vx = bx - ax, vy = by - ay;
      const t = clamp(((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy || 1));
      return Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
    }
    function glideTo(o) {
      glide = { x0: probe.x, y0: probe.y, x1: o.cx, y1: o.hcy, t: 0, dur: 0.35, target: o };
      probe.tx = o.cx;
      probe.ty = o.hcy;
      moved = true;
    }
    function choose(o) {
      glideTo(o);
      api.buzz(8);
      if (phase !== 'question') return;
      if (o.key === 'reveil') {
        phase = 'fin';
        o.glow = 1;
        showLabel(o);
        api.done(TEXTES.fin, TEXTES.finStatut);
        shownStatus = TEXTES.finStatut;
      } else {
        o.shake = 1;
        setStatus(TEXTES.encore);
        api.sfx.play('fail', { volume: 0.35 });
      }
    }
    api.track(cv.canvas, {
      down(p) {
        glide = null;
        ripple(p.x, p.y, true);
        const hx = probe.x - UX * G.Lp, hy = probe.y - UY * G.Lp;
        if (distSeg(p.x, p.y, probe.x, probe.y, hx, hy) < Math.max(26, G.dp * 2)) {
          grabbing = { ox: probe.x - p.x, oy: probe.y - p.y };
        } else {
          /* au doigt, la pointe reste un peu en avant pour qu'on voie ce qu'elle survole */
          const k = p.type === 'mouse' ? 0 : G.Lp * GRIP;
          grabbing = { ox: UX * k, oy: UY * k };
        }
        probe.tx = p.x + grabbing.ox;
        probe.ty = p.y + grabbing.oy;
        clampProbe();
        moved = true;
        cv.canvas.classList.add('is-grab');
      },
      move(p) {
        if (!grabbing) return;
        probe.tx = p.x + grabbing.ox;
        probe.ty = p.y + grabbing.oy;
        clampProbe();
      },
      up(p, e, cancelled) {
        cv.canvas.classList.remove('is-grab');
        grabbing = null;
        if (cancelled || !p.tap) return;
        const o = objAt(p.x, p.y);
        if (o) choose(o);
        else if (labelFor) hideLabel();
      },
    }, { touchAction: 'none' });
    objs.forEach((o) => {
      o.btn.addEventListener('click', () => {
        api.gesture(null);
        choose(o);
      });
    });

    /* ---- crépitements du compteur ---- */
    function ripple(x, y, touch) {
      for (let i = 0; i < RIP.length; i++) {
        const r = RIP[i];
        if (r.on) continue;
        r.on = true;
        r.x = x;
        r.y = y;
        r.t = 0;
        r.touch = touch;
        break;
      }
    }
    function click() {
      rate += 1 / TAU_N;
      lampFlash = 1;
      tipFlash = 1;
      ripple(probe.x, probe.y, false);
      api.sfx.play('tick', { gap: 0, pitch: rand(0.85, 1.25), volume: rand(0.55, 1) });
    }
    function rateAt(x, y) {
      let r = FOND;
      for (let i = 0; i < objs.length; i++) {
        const o = objs[i];
        const dx = (x - o.cx) / o.rx, dy = (y - o.hcy) / o.ry;
        const d = Math.sqrt(dx * dx + dy * dy);
        const k = clamp((1.5 - d) / 0.5);
        if (k > 0) r += (CADENCE[o.key] - FOND) * k;
      }
      return r;
    }

    function analyse(o) {
      o.done = true;
      o.badgeT = 0;
      o.glow = 0.7;
      analysed++;
      if (analysed === 4) phase = 'question';
      showLabel(o);
      api.sfx.play('chime', { pitch: 1 + analysed * 0.08 });
      api.buzz(10);
      setStatus(TEXTES.statut(analysed));
      api.progress((analysed / 4) * 0.8);
      if (analysed === 4) api.hint(TEXTES.question);
    }

    function update(dt) {
      time += dt;
      /* déplacement de la sonde */
      if (glide) {
        glide.t += dt;
        const k = ease.inOutCubic(clamp(glide.t / glide.dur));
        probe.x = lerp(glide.x0, glide.x1, k);
        probe.y = lerp(glide.y0, glide.y1, k);
        if (glide.t >= glide.dur) {
          /* objet touché : l'écoute est déjà un peu avancée */
          const o = glide.target;
          if (o && !o.done && phase === 'explore') o.dwell = Math.max(o.dwell, 0.4);
          glide = null;
        }
      } else {
        const k = 1 - Math.exp(-dt * 22);
        probe.x += (probe.tx - probe.x) * k;
        probe.y += (probe.ty - probe.y) * k;
      }
      /* objet survolé, temps d'écoute, analyse */
      over = objAt(probe.x, probe.y);
      for (let i = 0; i < objs.length; i++) {
        const o = objs[i];
        if (o === over) o.dwell = Math.min(DWELL * 1.5, o.dwell + dt);
        else o.dwell = Math.max(0, o.dwell - dt * 0.8);
        if (o.dwell < DWELL * 0.5) o.armed = true;
        if (o.shake > 0) o.shake = Math.max(0, o.shake - dt * 2.2);
        if (o.glow > 0 && phase !== 'fin') o.glow = Math.max(0, o.glow - dt * 0.8);
        if (o.done) o.badgeT = Math.min(1, (o.badgeT || 0) + dt * 2.5);
      }
      if (over && !glide) {
        if (labelFor && labelFor !== over && over.dwell > 0.25) hideLabel();
        /* une seule fois par visite : analyse, ou rappel de l'étiquette */
        if (over.dwell >= DWELL && over.armed) {
          over.armed = false;
          if (!over.done) analyse(over);
          else if (labelFor !== over) showLabel(over);
        }
      }
      /* tirage des crépitements (au hasard, à la cadence de l'endroit) */
      const lam = rateAt(probe.x, probe.y) * dt;
      let n = 0;
      const L = Math.exp(-lam);
      let pr = Math.random();
      while (pr > L && n < 6) {
        n++;
        pr *= Math.random();
      }
      for (let i = 0; i < n; i++) click();
      /* aiguille : ressort amorti vers le niveau lissé */
      rate *= Math.exp(-dt / TAU_N);
      const target = clamp(Math.log(1 + rate) / Math.log(25));
      needleV += ((target - needle) * 140 - needleV * 15) * dt;
      needle = clamp(needle + needleV * dt, -0.02, 1.03);
      lampFlash = Math.max(0, lampFlash - dt * 9);
      tipFlash = Math.max(0, tipFlash - dt * 7);
      for (let i = 0; i < RIP.length; i++) {
        const r = RIP[i];
        if (r.on && (r.t += dt) > 0.4) r.on = false;
      }
    }

    /* ---- dessin ---- */
    function render() {
      const w = cv.w, h = cv.h;
      if (!bg) return;
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.drawImage(bg.c, 0, 0, w, h);
      const tt = time * AMB;

      /* objets (le mauvais choix tremble un peu) */
      for (let i = 0; i < objs.length; i++) {
        const o = objs[i];
        const sh = o.shake > 0 ? Math.sin(o.shake * 34) * 4 * o.shake : 0;
        ctx.drawImage(o.sprite.c, o.sx + sh, o.sy, o.sprite.w, o.sprite.h);
      }
      /* lueur verte de la peinture au radium */
      const C = O.reveil;
      ctx.globalCompositeOperation = 'lighter';
      draw.glow(ctx, C.cx, C.cy, C.R * (1.25 + C.glow * 0.8), '#B8F06A', 0.1 + 0.03 * Math.sin(tt * 1.7) + C.glow * 0.25);
      ctx.globalCompositeOperation = 'source-over';

      /* objet écouté : anneau d'écoute qui se remplit */
      if (over && !over.done && phase === 'explore') {
        const k = clamp(over.dwell / DWELL);
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(184,240,106,0.22)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(over.cx, over.hcy, over.rx * 0.96, over.ry * 0.96, 0, 0, TAU);
        ctx.stroke();
        if (k > 0.01) {
          ctx.strokeStyle = '#C4F383';
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.ellipse(over.cx, over.hcy, over.rx * 0.96, over.ry * 0.96, 0, -Math.PI / 2, -Math.PI / 2 + k * TAU);
          ctx.stroke();
        }
      }
      /* pastilles des objets analysés */
      for (let i = 0; i < objs.length; i++) {
        const o = objs[i];
        if (!o.done) continue;
        const s = ease.outBack(clamp(o.badgeT || 0));
        const bx = o.vis[2] - 2, by = o.vis[1] + 4, br = 9 * s;
        if (br < 0.5) continue;
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.arc(bx + 1, by + 2, br, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#5E9A2C';
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#F3EBD4';
        ctx.lineWidth = 2.2 * s;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(bx - br * 0.45, by + br * 0.02);
        ctx.lineTo(bx - br * 0.12, by + br * 0.34);
        ctx.lineTo(bx + br * 0.48, by - br * 0.3);
        ctx.stroke();
      }

      /* câble, ombre et sonde */
      const hx = probe.x - UX * G.Lp, hy = probe.y - UY * G.Lp;
      /* le câble pend le long du bord droit puis rejoint la poignée par en dessous */
      const jx = G.jx + 4, jy = G.jy;
      const dd = Math.hypot(hx - jx, hy - jy);
      const c1x = Math.min(G.w - 3, jx + 9), c1y = jy + dd * 0.55;
      const c2x = hx - UX * dd * 0.32, c2y = hy - UY * dd * 0.32;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#120F0B';
      ctx.lineWidth = 3.6;
      ctx.beginPath();
      ctx.moveTo(jx, jy);
      ctx.bezierCurveTo(c1x, c1y, c2x, c2y, hx, hy);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,235,210,0.14)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(jx - 0.8, jy - 0.8);
      ctx.bezierCurveTo(c1x - 0.8, c1y - 0.8, c2x - 0.8, c2y - 0.8, hx - 0.8, hy - 0.8);
      ctx.stroke();
      const mx = (probe.x + hx) / 2, my = (probe.y + hy) / 2;
      ctx.save();
      ctx.translate(mx + 9, my + 13);
      ctx.rotate(ANG);
      ctx.fillStyle = 'rgba(5,3,1,0.28)';
      ctx.beginPath();
      ctx.ellipse(0, 0, G.Lp * 0.5, G.dp * 0.55, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.translate(probe.x, probe.y);
      ctx.rotate(ANG);
      ctx.drawImage(probeC.c, -(G.Lp + 4), -probeC.h / 2, probeC.w, probeC.h);
      ctx.restore();

      /* chaque crépitement : un éclat à la pointe et une petite onde */
      ctx.globalCompositeOperation = 'lighter';
      if (tipFlash > 0.02) draw.glow(ctx, probe.x, probe.y, 8 + 10 * tipFlash, '#D4FF9A', 0.7 * tipFlash);
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineWidth = 1.6;
      for (let i = 0; i < RIP.length; i++) {
        const r = RIP[i];
        if (!r.on) continue;
        const k = r.t / 0.4;
        ctx.strokeStyle = r.touch ? `rgba(255,255,255,${0.6 * (1 - k)})` : `rgba(196,243,131,${0.75 * (1 - k)})`;
        ctx.beginPath();
        ctx.arc(r.x, r.y, lerp(5, r.touch ? 30 : 26, ease.outCubic(k)), 0, TAU);
        ctx.stroke();
      }

      /* boîtier : voyant et aiguille */
      ctx.globalCompositeOperation = 'lighter';
      if (lampFlash > 0.02) draw.glow(ctx, G.ilx, G.ily, G.bw * 0.16, '#FFB347', 0.8 * lampFlash);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = lib.mix('#5A3A16', '#FFD27A', lampFlash);
      ctx.beginPath();
      ctx.arc(G.ilx, G.ily, G.bw * 0.04, 0, TAU);
      ctx.fill();
      const a = lerp(-Math.PI * 0.84, -Math.PI * 0.16, needle);
      const nx = Math.cos(a), ny = Math.sin(a);
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(60,40,20,0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(G.dcx + 1.5 - nx * G.dr * 0.12, G.dcy + 2);
      ctx.lineTo(G.dcx + 1.5 + nx * G.dr * 0.86, G.dcy + 2 + ny * G.dr * 0.86);
      ctx.stroke();
      ctx.strokeStyle = '#2A1810';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(G.dcx - nx * G.dr * 0.12, G.dcy - ny * G.dr * 0.12);
      ctx.lineTo(G.dcx + nx * G.dr * 0.86, G.dcy + ny * G.dr * 0.86);
      ctx.stroke();
      ctx.fillStyle = '#1B120C';
      ctx.beginPath();
      ctx.arc(G.dcx, G.dcy, Math.max(3, G.dr * 0.08), 0, TAU);
      ctx.fill();
      /* reflet sur la vitre du cadran */
      const fx0 = G.bx0 + G.bw * 0.1, fy0 = G.by0 + G.bh * 0.1, fw = G.bw * 0.8, fh = G.bh * 0.56;
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath();
      ctx.moveTo(fx0 + fw * 0.08, fy0);
      ctx.lineTo(fx0 + fw * 0.34, fy0);
      ctx.lineTo(fx0 + fw * 0.12, fy0 + fh);
      ctx.lineTo(fx0 - fw * 0.02, fy0 + fh);
      ctx.closePath();
      ctx.fill();
    }

    api.loop((dt) => {
      update(dt);
      render();
    });

    function showGesture() {
      const b = O.banane;
      const gx = probe.x - UX * G.Lp * GRIP, gy = probe.y - UY * G.Lp * GRIP;
      api.gesture('drag', { x: (gx / G.w) * 100, y: (gy / G.h) * 100, dx: Math.round(b.cx - probe.x), dy: Math.round(b.hcy - probe.y) });
    }

    function init() {
      objs.forEach((o) => {
        o.dwell = 0;
        o.armed = true;
        o.done = false;
        o.shake = 0;
        o.glow = 0;
        o.badgeT = 0;
      });
      analysed = 0;
      phase = 'explore';
      over = null;
      hideLabel();
      rate = 0;
      needle = 0;
      needleV = 0;
      lampFlash = 0;
      tipFlash = 0;
      RIP.forEach((r) => { r.on = false; });
      grabbing = null;
      glide = null;
      moved = false;
      cv.canvas.classList.remove('is-grab');
      placeProbeHome();
      shownStatus = null;
      setStatus(TEXTES.statut(0));
      showGesture();
    }

    if (/[?&]debug\b/.test(location.search)) {
      api.root.__dbg = () => ({
        probe: { x: probe.x, y: probe.y }, needle, phase, w: G.w, h: G.h,
        objs: objs.map((o) => ({ key: o.key, cx: o.cx, cy: o.hcy, rx: o.rx, ry: o.ry, done: o.done })),
      });
    }

    cv.onResize(geometry);
    api.onReset(init);
    init();
    update(0.016);
    render();
  };
})();
