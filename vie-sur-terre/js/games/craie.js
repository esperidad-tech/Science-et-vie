/* Le plancton bâtisseur de falaises : garder le doigt sur la mer fait tomber la neige de
   coccolithes, qui devient de la craie ; on soulève la craie, elle devient une falaise ;
   les vagues y creusent une grotte, puis une arche, et finissent par détacher une aiguille. */
(function () {
  'use strict';
  const { lib } = window.RM;
  const { TAU, rand, clamp, lerp, invLerp, ease, rgba, draw } = lib;

  /* Tous les textes du jeu, faciles à corriger */
  const TEXTES = {
    regle: 'La neige de plancton dépose 2 cm de craie tous les 1 000 ans.',
    craie: (m, duree) => `Craie : ${m} m, en ${duree}`,
    ans: (n) => `${lib.num(n)} ans`,
    millions: (v) => `${lib.num(v, v % 1 ? 1 : 0)} million${v >= 2 ? 's' : ''} d’années`,
    consigneSoulever: 'Soulève la craie : touche le bouton, ou pousse la craie vers le haut.',
    bouton: 'Soulever la craie',
    soulevement: 'Regarde : la craie sort de la mer et devient une falaise.',
    consigneVagues: 'Tape les vagues pour sculpter la falaise.',
    grotte: 'Une grotte se creuse au pied de la falaise.',
    arche: 'La grotte a percé la falaise : voilà une arche !',
    pointe: 'Les vagues attaquent maintenant la pointe de la falaise.',
    fin: 'Les vagues ont percé une arche dans la craie, comme à Étretat.',
    finStatut: 'La mer continue de grignoter ces falaises aujourd’hui.',
  };

  function seeded(seed) {
    let s = seed >>> 0 || 1;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }
  function mixRGB(A, B, t) {
    return [Math.round(lerp(A[0], B[0], t)), Math.round(lerp(A[1], B[1], t)), Math.round(lerp(A[2], B[2], t))];
  }

  /* Un coccolithophoridé : une petite sphère couverte de plaques ovales qui se chevauchent.
     n : nombre de plaques ; detail : nervures rayonnantes (pour la loupe). */
  function paintCocco(g, cx, cy, R, n, seed, detail) {
    const body = g.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R * 1.02);
    body.addColorStop(0, '#FFFFFF');
    body.addColorStop(0.6, '#D9E6EC');
    body.addColorStop(1, '#93AFC0');
    g.fillStyle = body;
    g.beginPath();
    g.arc(cx, cy, R, 0, TAU);
    g.fill();
    const r = seeded(seed);
    const rotA = r() * TAU, rotB = r() * TAU;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const yy = 1 - (2 * (i + 0.5)) / n;
      const rad = Math.sqrt(1 - yy * yy);
      const th = i * 2.399963 + rotA;
      const x = Math.cos(th) * rad, z = Math.sin(th) * rad;
      const c = Math.cos(rotB), s = Math.sin(rotB);
      pts.push([x, yy * c - z * s, yy * s + z * c, r()]);
    }
    pts.sort((A, B) => A[2] - B[2]);
    const a = R * (detail ? 0.5 : 0.62);
    for (const [x, y, z, q] of pts) {
      if (z < -0.32) continue;
      const fz = Math.max(0.2, z);
      const ax = a * (0.88 + q * 0.24);
      const ay = ax * 0.8;
      const lum = clamp(0.5 + 0.5 * (-0.45 * x - 0.55 * y + 0.7 * z));
      g.save();
      g.translate(cx + x * R * 0.97, cy + y * R * 0.97);
      g.rotate(Math.atan2(y, x));
      const rx = ay * fz, ry = ax;
      g.beginPath();
      g.ellipse(0, 0, rx, ry, 0, 0, TAU);
      g.fillStyle = lib.mix('#8FAABB', '#FFFFFF', lum);
      g.fill();
      g.lineWidth = Math.max(0.5, R * (detail ? 0.022 : 0.05));
      g.strokeStyle = `rgba(70,100,120,${0.25 + 0.3 * (1 - lum)})`;
      g.stroke();
      g.beginPath();
      g.ellipse(0, 0, rx * 0.46, ry * 0.46, 0, 0, TAU);
      g.fillStyle = lib.mix('#7F9CB0', '#EEF4F7', lum * 0.9);
      g.fill();
      if (detail && fz > 0.3) {
        g.beginPath();
        for (let k = 0; k < 14; k++) {
          const t = (k / 14) * TAU;
          g.moveTo(Math.cos(t) * rx * 0.5, Math.sin(t) * ry * 0.5);
          g.lineTo(Math.cos(t) * rx * 0.9, Math.sin(t) * ry * 0.9);
        }
        g.lineWidth = Math.max(0.5, R * 0.012);
        g.strokeStyle = `rgba(80,110,130,${0.18 + 0.25 * (1 - lum)})`;
        g.stroke();
        g.beginPath();
        g.ellipse(-rx * 0.08, -ry * 0.1, rx * 0.16, ry * 0.18, 0, 0, TAU);
        g.fillStyle = `rgba(255,255,255,${0.35 * lum})`;
        g.fill();
      }
      g.restore();
    }
  }

  const CSS = `
.game[data-game="craie"] .cr-lift {
  position: absolute; left: 50%; top: 36%; z-index: 4; transform: translate(-50%, -50%); white-space: nowrap;
  background: #1C6E9E; color: #FFFFFF; padding-inline: 20px;
  box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.55), 0 10px 22px -8px rgba(10, 40, 70, 0.7);
}
.game[data-game="craie"] .cr-lift:active { transform: translate(-50%, -50%) translateY(1px) scale(0.98); }
.game[data-game="craie"] .cr-lift::after {
  content: ""; position: absolute; inset: -4px; border-radius: inherit; pointer-events: none;
  border: 2px solid rgba(255, 255, 255, 0.9); animation: cr-pulse 1.6s ease-out infinite;
}
.game[data-game="craie"] .cr-lift[hidden] { display: none; }
.game[data-game="craie"] .cr-lift:not([hidden]) { animation: cr-in 0.45s cubic-bezier(0.2, 0.8, 0.2, 1.2); }
@keyframes cr-in { from { opacity: 0; transform: translate(-50%, -50%) scale(0.7); } to { opacity: 1; transform: translate(-50%, -50%); } }
.game[data-game="craie"] .cr-lift svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round; }
@keyframes cr-pulse { 0% { transform: scale(1); opacity: 0.9; } 100% { transform: scale(1.18, 1.5); opacity: 0; } }
.game[data-game="craie"] .cr-grab { position: absolute; left: 0; right: 0; bottom: 0; z-index: 3; cursor: grab; touch-action: none; }
.game[data-game="craie"] .cr-grab[hidden] { display: none; }
.game[data-game="craie"] .gesture-dot { box-shadow: 0 0 0 7px rgba(255, 255, 255, 0.25), 0 0 0 16px rgba(12, 52, 84, 0.38), 0 4px 14px rgba(0, 0, 0, 0.35); }
`;

  window.RM.games.craie = function (api) {
    const cv = api.canvas();
    const ctx = cv.ctx;
    const AMB = api.reducedMotion ? 0.3 : 1;
    api.style(CSS);

    const HOLD_TIME = 6.5;   /* secondes d'appui pour toute la phase 1 */
    const TAP_BONUS = 0.6;   /* une tape vaut 0,6 s d'appui */
    const SNOW_TAU = 0.5;    /* inertie de la neige : elle continue un instant après le lâcher */
    const MAX_M = 400;       /* épaisseur de craie à la fin de la phase 1 (m) */
    const LIFT_DUR = 2.1;    /* durée du soulèvement (s) */
    const WAVES = 8;         /* vagues pour sculpter l'arche et l'aiguille */
    const FLINT_ROWS = [0.15, 0.33, 0.5, 0.67, 0.84];

    /* ---- bouton du soulèvement ---- */
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip cr-lift';
    btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5.5M6 11l6-6 6 6"/></svg><span></span>';
    btn.lastChild.textContent = TEXTES.bouton;
    btn.hidden = true;
    api.stage.appendChild(btn);

    /* ---- géométrie ---- */
    const G = { w: 1, h: 1, m: 1, sea0: 0, floor: 1, T: 1, lift: 1, water: 1, tipX: 1 };
    let chalkTex = null, baseTex = null, rayTex = null, cloudTex = null, loupeTex = null;
    let sprites = [];
    let flintRows = [];   /* { k, y (dans la texture), nodules: [...], born, baked } */

    const TEX_TOP = 30; /* marge au-dessus du bloc dans la texture (relief du sommet) */
    function geometry(w, h) {
      G.w = w;
      G.h = h;
      G.m = Math.min(w, h);
      G.sea0 = Math.round(h * 0.12);   /* surface de la mer au début */
      G.floor = Math.round(h * 0.92);  /* fond de la mer */
      G.T = Math.round(h * 0.45);      /* épaisseur de la craie à la fin de la phase 1 */
      G.lift = Math.round(h * 0.13);   /* hauteur du soulèvement */
      G.water = Math.round(h * 0.76);  /* niveau de la mer au pied de la falaise */
      G.tipX = w * 0.9;                /* bout de la falaise */
      G.archCx = w * 0.56;
      G.archHW = w * 0.1;
      G.archH = h * 0.3;
      G.gapCx = w * 0.775;
      G.gapHW = w * 0.025;
      G.horizon = Math.round(h * 0.6);
      G.loupeR = Math.round(clamp(G.m * 0.135, 38, 70));
      G.loupeX = w - G.loupeR - 14;
      G.loupeY = G.sea0 + G.loupeR + 10;
      G.coccoR = clamp(G.m * 0.02, 5, 9);
      buildTextures();
      blockCv = mk(w, h);
      buildStreaks();
      grab.style.top = (((G.floor - G.T) / h) * 100).toFixed(2) + '%';
      if (pinC) {
        pinC.ax = G.loupeX - G.loupeR * 1.25;
        pinC.ay = G.loupeY + G.loupeR * 1.5;
      }
      blockDirty = true;
    }

    function mk(wc, hc) {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(wc * cv.dpr));
      c.height = Math.max(1, Math.round(hc * cv.dpr));
      const g = c.getContext('2d');
      g.scale(cv.dpr, cv.dpr);
      return { c, g, w: wc, h: hc };
    }

    /* Texture de craie : crème, litée, très légèrement grumeleuse.
       Repère de la texture : le haut du bloc complet est à y = TEX_TOP, sa base à y = TEX_TOP + T. */
    function buildChalk() {
      const { w, T } = G;
      const H = T + TEX_TOP;
      const R = mk(w, H);
      const g = R.g;
      const TW = Math.max(8, Math.round(w / 3)), TH = Math.max(8, Math.round(H / 3));
      const t = document.createElement('canvas');
      t.width = TW;
      t.height = TH;
      const tg = t.getContext('2d');
      const img = tg.createImageData(TW, TH);
      const n = lib.makeNoise(23);
      const A = lib.hexToRgb('#F7F4EA'), B = lib.hexToRgb('#E4DDC8'), Cc = lib.hexToRgb('#FFFFFB');
      for (let y = 0; y < TH; y++) {
        for (let x = 0; x < TW; x++) {
          const v = n.fbm(x / 7, y / 3.2, 4);
          const bed = 0.5 + 0.5 * Math.sin((y * 3) / 2.6 + n.noise2(x / 18, y / 9) * 2.2);
          let c = mixRGB(A, B, clamp((v - 0.42) * 1.6 + bed * 0.22));
          if (v < 0.36) c = mixRGB(c, Cc, clamp((0.36 - v) * 4));
          const j = (y * TW + x) * 4;
          img.data[j] = c[0]; img.data[j + 1] = c[1]; img.data[j + 2] = c[2]; img.data[j + 3] = 255;
        }
      }
      tg.putImageData(img, 0, 0);
      g.imageSmoothingEnabled = true;
      g.drawImage(t, 0, 0, w, H);
      /* litage : fines lignes un peu plus sombres */
      const r = seeded(4);
      for (let y = TEX_TOP + 6; y < H; y += 6 + r() * 7) {
        g.beginPath();
        for (let x = 0; x <= w + 8; x += 8) {
          const yy = y + Math.sin(x * 0.03 + y) * 0.8 + (r() - 0.5) * 0.6;
          if (x === 0) g.moveTo(x, yy);
          else g.lineTo(x, yy);
        }
        g.strokeStyle = `rgba(150,135,105,${0.08 + r() * 0.12})`;
        g.lineWidth = 0.8 + r() * 0.6;
        g.stroke();
      }
      for (let i = 0; i < 260; i++) {
        g.fillStyle = r() < 0.55 ? `rgba(170,155,125,${0.12 + r() * 0.2})` : `rgba(255,255,255,${0.3 + r() * 0.4})`;
        g.fillRect(r() * w, r() * H, 0.6 + r() * 1.2, 0.6 + r());
      }
      chalkTex = R;
      for (const row of flintRows) if (row.baked) bakeRow(row);
    }

    function buildBase() {
      const { w, h } = G;
      const H = Math.round(h * 0.3);
      const R = mk(w, H);
      const g = R.g;
      const gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, '#5E676B');
      gr.addColorStop(1, '#2E363B');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, H);
      const r = seeded(9);
      for (let i = 0; i < 40; i++) {
        g.fillStyle = `rgba(20,26,30,${0.2 + r() * 0.3})`;
        draw.blob(g, r() * w, r() * H, 1.5 + r() * 3.5, 0.3, i, 0, 10);
        g.fill();
      }
      for (let i = 0; i < 160; i++) {
        g.fillStyle = r() < 0.5 ? `rgba(200,210,215,${0.08 + r() * 0.15})` : `rgba(0,0,0,${0.1 + r() * 0.2})`;
        g.fillRect(r() * w, r() * H, 1, 1);
      }
      baseTex = R;
    }

    function buildRays() {
      const { w, h } = G;
      const H = Math.round(h * 0.6);
      const R = mk(w, H);
      const g = R.g;
      const r = seeded(13);
      for (let i = 0; i < 6; i++) {
        const x0 = w * (0.1 + 0.85 * (i + 0.5) / 6) + (r() - 0.5) * 20;
        const wd = 10 + r() * 18;
        const gr = g.createLinearGradient(0, 0, 0, H);
        gr.addColorStop(0, 'rgba(255,255,255,0.16)');
        gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr;
        g.beginPath();
        g.moveTo(x0 - wd / 2, 0);
        g.lineTo(x0 + wd / 2, 0);
        g.lineTo(x0 + wd * 1.5 - H * 0.3, H);
        g.lineTo(x0 - wd * 1.5 - H * 0.3, H);
        g.closePath();
        g.fill();
      }
      rayTex = R;
    }

    function buildClouds() {
      const { w, h } = G;
      const R = mk(w, Math.round(h * 0.6));
      const g = R.g;
      const r = seeded(31);
      for (let i = 0; i < 4; i++) {
        const cx = w * (0.08 + 0.28 * i) + (r() - 0.5) * 30, cy = h * (0.06 + r() * 0.14);
        for (let j = 0; j < 6; j++) {
          const px = cx + (r() - 0.5) * w * 0.16, py = cy + (r() - 0.5) * 6, rr = w * (0.04 + r() * 0.05), a = 0.5 + r() * 0.3;
          for (let k = -1; k <= 1; k++) {
            g.save();
            g.translate(px + k * w, py);
            g.scale(1, 0.38);
            draw.glow(g, 0, 0, rr, '#FFFFFF', a);
            g.restore();
          }
        }
      }
      cloudTex = R;
    }

    /* coccolithophoridés en petits sprites (rendus en haute définition) */
    function buildSprites() {
      sprites = [];
      const R = G.coccoR;
      const S = Math.ceil(R * 2 + 4);
      for (let i = 0; i < 4; i++) {
        const sp = mk(S, S);
        paintCocco(sp.g, S / 2, S / 2, R, 15, 101 + i * 37, false);
        sprites.push(sp);
      }
    }

    /* la loupe : un coccolithophoridé en grand */
    function buildLoupe() {
      const L = G.loupeR;
      const S = Math.ceil(L * 2 + 24);
      const R = mk(S, S);
      const g = R.g;
      const cx = S / 2, cy = S / 2;
      g.save();
      g.beginPath();
      g.arc(cx, cy, L, 0, TAU);
      g.clip();
      const bg = g.createRadialGradient(cx - L * 0.3, cy - L * 0.35, L * 0.1, cx, cy, L);
      bg.addColorStop(0, '#3D8CBC');
      bg.addColorStop(1, '#174A72');
      g.fillStyle = bg;
      g.fillRect(cx - L, cy - L, L * 2, L * 2);
      const r = seeded(77);
      for (let i = 0; i < 18; i++) {
        g.fillStyle = `rgba(220,240,250,${0.15 + r() * 0.25})`;
        g.beginPath();
        g.arc(cx + (r() - 0.5) * L * 1.8, cy + (r() - 0.5) * L * 1.8, 0.6 + r() * 1.2, 0, TAU);
        g.fill();
      }
      /* deux plaques détachées qui flottent */
      for (let i = 0; i < 3; i++) {
        const px = cx + [-0.62, 0.55, 0.4][i] * L, py = cy + [0.5, -0.55, 0.62][i] * L;
        g.save();
        g.translate(px, py);
        g.rotate(r() * TAU);
        g.beginPath();
        g.ellipse(0, 0, L * 0.11, L * 0.08, 0, 0, TAU);
        g.fillStyle = '#EAF2F5';
        g.fill();
        g.beginPath();
        g.ellipse(0, 0, L * 0.05, L * 0.035, 0, 0, TAU);
        g.fillStyle = '#9DB6C4';
        g.fill();
        g.restore();
      }
      paintCocco(g, cx, cy + L * 0.02, L * 0.56, 28, 5, true);
      /* reflet du verre */
      const gl = g.createLinearGradient(cx - L, cy - L, cx + L * 0.3, cy + L * 0.3);
      gl.addColorStop(0, 'rgba(255,255,255,0.22)');
      gl.addColorStop(0.45, 'rgba(255,255,255,0)');
      g.fillStyle = gl;
      g.fillRect(cx - L, cy - L, L * 2, L * 2);
      g.restore();
      /* monture */
      g.lineWidth = 5;
      g.strokeStyle = '#1C6E9E';
      g.beginPath();
      g.arc(cx, cy, L + 1.5, 0, TAU);
      g.stroke();
      g.lineWidth = 1.4;
      g.strokeStyle = 'rgba(255,255,255,0.85)';
      g.beginPath();
      g.arc(cx, cy, L - 1, 0, TAU);
      g.stroke();
      g.lineWidth = 2;
      g.strokeStyle = 'rgba(255,255,255,0.55)';
      g.beginPath();
      g.arc(cx, cy, L - 5, Math.PI * 1.08, Math.PI * 1.42);
      g.stroke();
      loupeTex = R;
    }

    function buildTextures() {
      buildChalk();
      buildBase();
      buildRays();
      buildClouds();
      buildSprites();
      buildLoupe();
    }

    /* ---- rognons de silex ---- */
    function makeRows() {
      const r = seeded(Math.floor(Math.random() * 1e9));
      flintRows = FLINT_ROWS.map((k) => {
        const nod = [];
        let x = 6 + r() * 14;
        while (x < G.w + 10) {
          nod.push({ x, dy: (r() - 0.5) * 4, rx: 2.6 + r() * 4.2, ry: 2 + r() * 2, seed: r() * 10, rot: (r() - 0.5) * 0.5 });
          x += 16 + r() * 26;
        }
        return { k, nod, born: -1, baked: false, w0: G.w };
      });
    }
    function rowY(row) { return TEX_TOP + G.T * (1 - row.k); }
    function paintNodule(g, n, y, s, row) {
      g.save();
      g.translate((n.x * G.w) / row.w0, y + n.dy);
      g.rotate(n.rot);
      g.scale(s, s * (n.ry / n.rx));
      g.fillStyle = 'rgba(60,50,35,0.18)';
      draw.blob(g, 0.6, 1.4, n.rx * 1.12, 0.22, n.seed, 0, 14);
      g.fill();
      const gr = g.createRadialGradient(-n.rx * 0.3, -n.rx * 0.4, 0.5, 0, 0, n.rx * 1.1);
      gr.addColorStop(0, '#5B5A62');
      gr.addColorStop(0.55, '#2F2E35');
      gr.addColorStop(1, '#1A191E');
      g.fillStyle = gr;
      draw.blob(g, 0, 0, n.rx, 0.22, n.seed, 0, 14);
      g.fill();
      g.restore();
    }
    function bakeRow(row) {
      const y = rowY(row);
      for (const n of row.nod) paintNodule(chalkTex.g, n, y, 1, row);
      row.baked = true;
    }

    /* traînées verticales de la falaise (elles apparaissent quand la craie sort de l'eau) */
    function buildStreaks() {
      const { w, T } = G;
      const H = T + TEX_TOP;
      const R = mk(w, H);
      const g = R.g;
      const r = seeded(57);
      for (let i = 0; i < Math.round(w / 9); i++) {
        const x = r() * w, y0 = TEX_TOP + r() * T * 0.4, len = T * (0.25 + r() * 0.6), wd = 1 + r() * 3;
        const gr = g.createLinearGradient(0, y0, 0, y0 + len);
        const dark = r() < 0.6;
        const a = 0.05 + r() * 0.1;
        gr.addColorStop(0, dark ? `rgba(120,110,90,${a})` : `rgba(255,255,255,${a * 2})`);
        gr.addColorStop(1, 'rgba(120,110,90,0)');
        g.fillStyle = gr;
        g.fillRect(x, y0, wd, len);
      }
      streakTex = R;
    }

    /* ---- état ---- */
    const PLATE_RATE = 46;   /* plaques de neige par seconde d'appui */
    const N_BASE = 24;       /* plancton qui flotte toujours près de la surface */
    let phase = 'neige';     /* neige → pret → leve → vagues */
    let fill = 0, hold = null, pinC = null, loupeA = 1, snowI = 0, snowX = 0, snowY = 0;
    let liftT = 0, liftFrom = 0, preview = 0, previewShown = 0;
    let riseK = 0, seaK = 0, shapeK = 0, grassK = 0;
    let coccos = [], plates = [], drops = [], crumbs = [], foams = [], rings = [], breakers = [];
    let carve = 0, archD = 0, archT = 0, gapD = 0, gapT = 0, needleD = 0, needleT = 0;
    let archPierced = false, gapPierced = false, pierceFlash = 0;
    let finished = false, doneTimer = -1, shownM = -1;
    let time = 0, bloomT = 0, snowT = 0, ambT = 0, waveT = 2;
    let blockCv = null, streakTex = null, blockDirty = true;

    /* ---- géométrie de la craie ---- */
    function topY(x) {
      const base = G.floor - Math.max(fill * G.T, 4) - G.lift * riseK;
      const ripple = Math.sin(x * 0.035 + 0.4) * 1.4 + Math.sin(x * 0.09 + 1.3) * 0.7;
      const k = shapeK;
      if (k <= 0) return base + ripple;
      const hills = Math.sin(x * 0.011 + 0.8) * 4 + Math.sin(x * 0.027 + 2) * 2;
      const tip = Math.pow(clamp((x - G.w * 0.6) / (G.w * 0.3)), 1.6) * G.h * 0.03;
      return base + ripple * (1 - k) + k * (hills + tip);
    }
    function faceX(y) {
      return lerp(G.w + 40, G.tipX, shapeK) + shapeK * (Math.sin(y * 0.06 + 1) * 2.5 + Math.sin(y * 0.17) * 1.2);
    }
    function seaY() { return lerp(G.sea0, G.water, seaK); }

    /* ---- plancton et neige ---- */
    function newCocco(x, y, bloom) {
      return {
        x, y, vx: rand(-4, 4), ph: rand(TAU), age: 0, dying: false,
        life: bloom ? rand(2.5, 5) : rand(8, 16), s: bloom ? 0 : 1, sp: Math.floor(Math.random() * 4), bloom, fade: 1,
      };
    }
    function seedCoccos() {
      coccos = [];
      /* celle que montre la loupe */
      pinC = newCocco(0, 0, false);
      pinC.pin = true;
      pinC.ax = G.loupeX - G.loupeR * 1.25;
      pinC.ay = G.loupeY + G.loupeR * 1.5;
      pinC.x = pinC.ax;
      pinC.y = pinC.ay;
      coccos.push(pinC);
      for (let i = 0; i < N_BASE; i++) {
        const c = newCocco(rand(10, G.w - 10), rand(G.sea0 + 10, G.sea0 + G.h * 0.2), false);
        c.age = rand(0, c.life * 0.8);
        coccos.push(c);
      }
    }
    function addPlate(x, y, vy) {
      if (plates.length >= 300) return;
      plates.push({ x, y, vy, ph: rand(TAU), sz: rand(1.2, 2.2), spin: rand(2, 5), land: -1, t: 0 });
    }

    /* ---- la craie s'épaissit ---- */
    function grow(dk) {
      if (phase !== 'neige') return;
      fill = Math.min(1, fill + dk);
      blockDirty = true;
      for (const row of flintRows) {
        if (row.born < 0 && fill > row.k + 0.03) {
          row.born = time;
          api.sfx.play('pop', { pitch: 0.55, volume: 0.5 });
        }
      }
      updateStatus();
      api.progress(0.6 * fill);
      if (fill >= 1) ready();
    }
    function updateStatus() {
      const m = Math.floor((fill * MAX_M) / 10 + 1e-6) * 10;
      if (m === shownM) return;
      shownM = m;
      if (m === 0) {
        api.status(TEXTES.regle);
        return;
      }
      const years = m * 50000; /* 2 cm tous les 1 000 ans : 1 m tous les 50 000 ans */
      api.status(TEXTES.craie(m, years < 1e6 ? TEXTES.ans(years) : TEXTES.millions(years / 1e6)));
    }

    /* ---- soulever ---- */
    const grab = document.createElement('div');
    grab.className = 'cr-grab';
    grab.setAttribute('aria-hidden', 'true');
    grab.hidden = true;
    api.stage.appendChild(grab);

    let readyAt = 0;
    function ready() {
      phase = 'pret';
      hold = null;
      readyAt = performance.now();
      btn.hidden = false;
      grab.hidden = false;
      api.hint(TEXTES.consigneSoulever);
      api.sfx.play('chime', { volume: 0.7 });
      api.gesture('drag', { x: 26, y: 78, dx: 0, dy: -70 });
    }
    function startLift(e) {
      if (phase !== 'pret') return;
      /* le bouton vient d'apparaître sous un doigt qui tapait la mer : on attend un peu */
      if (e && e.type === 'click' && performance.now() - readyAt < 650) return;
      phase = 'leve';
      liftT = 0;
      liftFrom = riseK;
      for (const c of coccos) c.dying = true;
      for (const p of plates) p.land = Math.max(p.land, 0.2);
      btn.hidden = true;
      grab.hidden = true;
      api.gesture(null);
      api.hint(TEXTES.soulevement);
      api.sfx.play('rumble');
      api.buzz(15);
    }
    function startWaves() {
      phase = 'vagues';
      liftT = 1;
      riseK = seaK = shapeK = grassK = 1;
      coccos = [];
      plates = [];
      loupeA = 0;
      api.hint(TEXTES.consigneVagues);
      api.status('');
      api.progress(0.7);
      showWaveGesture();
      blockDirty = true;
    }
    function showWaveGesture() {
      api.gesture('tap', { x: (G.archCx / G.w) * 100 + 4, y: ((G.water + G.h * 0.1) / G.h) * 100 });
    }
    btn.addEventListener('click', startLift);
    api.track(grab, {
      move(p) {
        if (phase !== 'pret') return;
        preview = clamp((p.y0 - p.y) / 130);
      },
      up(p, e, cancelled) {
        if (phase !== 'pret') return;
        const up = p.y0 - p.y;
        const fast = p.dt < 300 && up > 30;
        if (!cancelled && (preview > 0.4 || fast)) startLift();
        else {
          preview = 0;
          if (!cancelled && p.tap) api.sfx.play('tick', { pitch: 0.8 });
        }
      },
    }, { touchAction: 'none' });

    /* ---- vagues ---- */
    const FOOT = [0.18, 0.36, 0.69, 0.85];
    function footTarget(x) {
      let best = FOOT[0] * G.w;
      for (const f of FOOT) if (Math.abs(f * G.w - x) < Math.abs(best - x)) best = f * G.w;
      return best;
    }
    /* Une vague part du doigt et file vers le pied de la falaise ; celles du joueur
       visent la grotte (puis la pointe), celles de la houle tapent un peu partout. */
    function launchWave(x, y, carving, target) {
      let n = carve;
      for (const b of breakers) if (b.carve) n++;
      const doCarve = carving && n < WAVES;
      const tx = doCarve ? (n < 4 ? G.archCx : G.gapCx) : (target == null ? footTarget(x) : target);
      const x0 = clamp(x, 8, G.w - 8);
      const y0 = Math.max(y, G.water + 12);
      const d = Math.hypot(tx - x0, y0 - G.water);
      breakers.push({ x0, y0, tx, t: 0, dur: clamp(d / 420, 0.28, 0.6), carve: doCarve, big: carving });
    }
    function crash(b) {
      const W = G.water;
      const n = b.big ? 26 : 9;
      for (let i = 0; i < n && drops.length < 110; i++) {
        drops.push({
          x: b.tx + rand(-16, 16), y: W - rand(0, 4), vx: rand(-55, 55), vy: -rand(b.big ? 110 : 60, b.big ? 270 : 140),
          t: 0, life: rand(0.6, 1.1), r: rand(1, 2.6),
        });
      }
      foams.push({ x: b.tx, y: W + 1, t: 0, dur: b.big ? 1.6 : 1.1, r: b.big ? 26 : 14 });
      if (b.big) {
        api.sfx.play('splash', { pitch: rand(0.85, 1.1) });
        api.buzz(10);
      } else {
        api.sfx.play('splash', { pitch: rand(1.2, 1.4), volume: 0.2, gap: 300 });
      }
      if (b.carve) applyCarve();
    }
    function addCrumbs(x, y, spread, n) {
      for (let i = 0; i < n && crumbs.length < 90; i++) {
        crumbs.push({
          x: x + rand(-spread, spread), y: y + rand(-spread * 0.5, spread * 0.3), vx: rand(-30, 30), vy: rand(-40, 20),
          s: rand(1.2, 3.4), col: Math.random() < 0.3 ? '#D9D2BE' : '#F3EFE3', t: 0,
        });
      }
    }
    const ARCH_STEPS = [0.38, 0.58, 0.76];
    const GAP_STEPS = [0.3, 0.55, 0.8, 1];
    function applyCarve() {
      if (carve >= WAVES) return;
      carve++;
      const W = G.water;
      if (carve <= 3) {
        archT = ARCH_STEPS[carve - 1];
        addCrumbs(G.archCx, W - G.archH * archT * 0.8, G.archHW * archT * 0.6, 8);
        if (carve === 1) api.status(TEXTES.grotte);
      } else if (carve === 4) {
        archT = 1;
        archPierced = true;
        pierceFlash = 1;
        addCrumbs(G.archCx, W - G.archH * 0.75, G.archHW * 0.6, 14);
        api.status(TEXTES.arche);
        api.sfx.play('crack', { pitch: 0.8 });
        api.sfx.play('chime', { pitch: 1.1, volume: 0.7 });
      } else {
        gapT = GAP_STEPS[carve - 5];
        if (carve >= 6) gapPierced = true;
        if (carve === 5) api.status(TEXTES.pointe);
        const top = topY(G.gapCx);
        addCrumbs(G.gapCx, lerp(W, top, gapT * 0.9), G.w * 0.02, carve === 8 ? 26 : 8);
        if (carve === 8) {
          needleT = 1;
          doneTimer = 1.1;
          api.sfx.play('crack', { pitch: 0.6 });
          api.sfx.play('rumble', { pitch: 1.4, volume: 0.6 });
        }
      }
      api.progress(0.7 + (0.3 * carve) / WAVES);
      blockDirty = true;
    }

    /* ---- commandes ---- */
    cv.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.canvas.style.webkitTouchCallout = 'none';
    api.track(cv.canvas, {
      down(p) {
        if (phase === 'neige') {
          hold = { x: p.x, y: Math.max(p.y, seaY() + 6), t: 0 };
          rings.push({ x: p.x, y: p.y, t: 0 });
          api.buzz(8);
        } else if (phase === 'pret') {
          rings.push({ x: p.x, y: p.y, t: 0 });
        }
      },
      move(p) {
        if (hold) {
          hold.x = p.x;
          hold.y = Math.max(p.y, seaY() + 6);
        }
      },
      up(p, e, cancelled) {
        const wasHold = !!hold;
        hold = null;
        if (cancelled) return;
        if (phase === 'neige' && wasHold && p.tap) {
          /* une tape vaut un petit appui : une bouffée de plancton */
          for (let i = 0; i < 5; i++) bloom(p.x, p.y);
          snowI = Math.min(1.6, snowI + TAP_BONUS / SNOW_TAU);
          snowX = p.x;
          snowY = Math.max(p.y, seaY() + 6);
        } else if (phase === 'vagues' && p.tap) {
          rings.push({ x: p.x, y: p.y, t: 0 });
          if (p.y > G.water - G.h * 0.2) {
            launchWave(p.x, p.y, true);
            api.sfx.play('splash', { pitch: 1.6, volume: 0.25 });
          } else {
            /* trop haut : on remontre où taper */
            api.sfx.play('tick', { pitch: 0.8 });
            showWaveGesture();
          }
        }
      },
    }, { touchAction: 'pan-y' });

    function bloom(x, y) {
      if (coccos.length >= 140) return;
      const a = rand(TAU), d = rand(8, 48);
      const top = topY(x) - 10;
      coccos.push(newCocco(clamp(x + Math.cos(a) * d, 6, G.w - 6), clamp(y + Math.sin(a) * d * 0.8, seaY() + 8, Math.max(seaY() + 9, top)), true));
    }
    /* une plaque de neige sous le doigt : le rideau va du doigt jusqu'au fond */
    function snowAt(x, y) {
      const px = clamp(x + (Math.random() + Math.random() + Math.random() - 1.5) * 40, 2, G.w - 2);
      const top = topY(px);
      const yy = y + Math.pow(Math.random(), 1.6) * Math.max(0, top - y);
      addPlate(px, Math.min(yy, top - 6), rand(95, 140));
    }

    /* chaque plaque qui se pose épaissit la couche de craie */


    /* ---- animation ---- */
    function update(dt) {
      time += dt;
      const sy = seaY();

      /* l'appui fait tomber la neige ; elle continue un instant après le lâcher */
      if (phase === 'neige') {
        if (hold) {
          hold.t += dt;
          snowX = hold.x;
          snowY = hold.y;
          bloomT += dt;
          while (bloomT > 0.07) {
            bloomT -= 0.07;
            bloom(hold.x, hold.y);
          }
        }
        snowI += ((hold ? 1 : 0) - snowI) * (1 - Math.exp(-dt / SNOW_TAU));
        if (snowI > 0.01) {
          grow((snowI * dt) / HOLD_TIME);
          snowT += dt * PLATE_RATE * Math.min(1.5, snowI);
          while (snowT >= 1) {
            snowT -= 1;
            snowAt(snowX, snowY);
          }
          api.sfx.play('tick', { pitch: rand(1.6, 2.2), volume: 0.25, gap: 140 });
        } else {
          snowI = 0;
        }
      }
      /* un peu de neige tombe toute seule, sans rien épaissir */
      if (phase === 'neige' || phase === 'pret') {
        ambT += dt;
        if (ambT > (api.reducedMotion ? 0.8 : 0.32)) {
          ambT = 0;
          const c = coccos[Math.floor(Math.random() * coccos.length)];
          if (c && !c.pin) addPlate(c.x, c.y + 4, rand(55, 80));
        }
      }

      /* soulèvement */
      if (phase === 'pret') {
        const pv = previewShown;
        previewShown += (preview - previewShown) * (1 - Math.exp(-dt * 12));
        riseK = previewShown * 0.12;
        if (Math.abs(previewShown - pv) > 1e-4) blockDirty = true;
      } else if (phase === 'leve') {
        liftT = Math.min(1, liftT + dt / LIFT_DUR);
        const k = ease.inOutCubic(liftT);
        riseK = lerp(liftFrom, 1, k);
        seaK = ease.inOutSine(clamp(invLerp(0.05, 0.85, liftT)));
        shapeK = ease.inOutCubic(clamp(invLerp(0.25, 0.95, liftT)));
        grassK = ease.outCubic(clamp(invLerp(0.65, 1, liftT)));
        blockDirty = true;
        api.progress(0.6 + 0.1 * liftT);
        if (Math.random() < dt * 30) addCrumbs(rand(G.w * 0.1, G.tipX), topY(G.w * 0.5) + rand(0, 20), 6, 1);
        if (liftT >= 1) startWaves();
      }

      for (const row of flintRows) if (row.born >= 0 && !row.baked) blockDirty = true;

      /* le plancton */
      let j = 0;
      for (const c of coccos) {
        c.age += dt;
        if (c.pin) {
          c.x = c.ax + Math.sin(time * 0.6) * 3 * AMB;
          c.y = c.ay + Math.cos(time * 0.8) * 2 * AMB;
          if (phase !== 'neige') loupeA = Math.max(0, loupeA - dt * 2.5);
          coccos[j++] = c;
          continue;
        }
        c.x += (c.vx + Math.sin(time * 0.7 + c.ph) * 5) * dt * AMB;
        c.y += Math.cos(time * 0.9 + c.ph) * 3 * dt * AMB;
        c.y = Math.max(c.y, sy + 7);
        if (c.x < -8) c.x = G.w + 8;
        if (c.x > G.w + 8) c.x = -8;
        c.s = Math.min(1, c.s + dt * 3.5);
        if (c.dying) c.fade -= dt * 2.2;
        else if (c.bloom && c.age > c.life) c.fade -= dt * 1.5;
        if (c.fade <= 0) {
          /* elle meurt : ses plaques tombent */
          if (phase === 'neige' || phase === 'pret') for (let k = 0; k < 2; k++) addPlate(c.x + rand(-3, 3), c.y, rand(60, 90));
          continue;
        }
        coccos[j++] = c;
      }
      coccos.length = j;
      if ((phase === 'neige' || phase === 'pret') && coccos.length < N_BASE + 1) {
        const c = newCocco(rand(10, G.w - 10), rand(sy + 12, sy + G.h * 0.14), false);
        c.s = 0;
        coccos.push(c);
      }

      /* la neige de plaques */
      j = 0;
      for (const p of plates) {
        if (p.land >= 0) {
          p.land -= dt;
          if (p.land < 0) continue;
          plates[j++] = p;
          continue;
        }
        p.y += p.vy * dt;
        p.x += Math.sin(time * p.spin + p.ph) * 14 * dt * AMB;
        p.t += dt;
        const ty = topY(p.x);
        if (p.y >= ty) {
          p.y = ty;
          p.land = 0.35;
        }
        plates[j++] = p;
      }
      plates.length = j;

      /* les vagues */
      waveT -= dt;
      if (phase === 'vagues' && waveT <= 0) {
        waveT = api.reducedMotion ? 5 : rand(2.2, 3.4);
        launchWave(rand(G.w * 0.1, G.w * 0.95), G.water + G.h * rand(0.08, 0.15), false);
      }
      j = 0;
      for (const b of breakers) {
        b.t += dt;
        if (b.t >= b.dur) {
          crash(b);
          continue;
        }
        breakers[j++] = b;
      }
      breakers.length = j;
      j = 0;
      for (const d of drops) {
        d.t += dt;
        if (d.t >= d.life) continue;
        d.vy += 520 * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        if (d.y > G.water + 4 && d.vy > 0) continue;
        drops[j++] = d;
      }
      drops.length = j;
      j = 0;
      for (const c of crumbs) {
        c.t += dt;
        c.vy += 300 * dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        if (c.y > G.water + 6 || c.t > 2) continue;
        crumbs[j++] = c;
      }
      crumbs.length = j;
      j = 0;
      for (const f of foams) if ((f.t += dt) < f.dur) foams[j++] = f;
      foams.length = j;
      j = 0;
      for (const r of rings) if ((r.t += dt) < 0.6) rings[j++] = r;
      rings.length = j;

      /* la falaise se creuse en douceur */
      const ka = 1 - Math.exp(-dt * 5);
      const pa = archD, pg = gapD, pn = needleD;
      archD += (archT - archD) * ka;
      gapD += (gapT - gapD) * ka;
      needleD += (needleT - needleD) * (1 - Math.exp(-dt * 2.5));
      if (Math.abs(archD - pa) + Math.abs(gapD - pg) + Math.abs(needleD - pn) > 1e-4) blockDirty = true;
      pierceFlash = Math.max(0, pierceFlash - dt * 1.4);

      if (doneTimer > 0) {
        doneTimer -= dt;
        if (doneTimer <= 0 && !finished) {
          finished = true;
          api.done(TEXTES.fin, TEXTES.finStatut);
        }
      }
    }

    /* ---- la falaise (pré-rendue quand elle change) ---- */
    function archPath(g, cx, hw, hh, W, seed) {
      g.beginPath();
      g.moveTo(cx - hw, W + 16);
      const n = 22;
      for (let i = 0; i <= n; i++) {
        const t = Math.PI - (i / n) * Math.PI;
        const s = Math.sin(t);
        const wob = 1 + 0.035 * Math.sin(t * 5 + seed) * s + 0.02 * Math.sin(t * 11 + seed * 2);
        g.lineTo(cx + hw * Math.cos(t) * wob, W - hh * Math.pow(s, 0.62) * wob);
      }
      g.lineTo(cx + hw, W + 16);
      g.closePath();
    }
    /* la grotte s'élargit d'abord, puis monte jusqu'à percer */
    function archDims() {
      const e = archD;
      return [G.archHW * lerp(0.4, 1, Math.pow(e, 0.6)), G.archH * lerp(0.1, 1, Math.pow(e, 1.5))];
    }
    /* la petite arche de la pointe, dont la voûte finira par s'effondrer */
    function gapDims() {
      const e = gapD;
      return [G.gapHW * lerp(0.7, 1.5, e), (G.water - topY(G.gapCx)) * lerp(0.22, 0.66, e)];
    }
    /* une grotte pas encore percée : un creux d'ombre */
    function drawCave(g, cx, hw, hh, W, seed) {
      archPath(g, cx, hw, hh, W, seed);
      const gr = g.createRadialGradient(cx + hw * 0.1, W - hh * 0.15, hh * 0.05, cx, W - hh * 0.3, Math.max(hw, hh) * 1.05);
      gr.addColorStop(0, '#34434B');
      gr.addColorStop(0.5, '#66747A');
      gr.addColorStop(1, '#B9BCB0');
      g.fillStyle = gr;
      g.fill();
      g.save();
      g.clip();
      g.strokeStyle = 'rgba(255,255,255,0.3)';
      g.lineWidth = 2;
      archPath(g, cx - 2, hw, hh, W, seed);
      g.stroke();
      g.restore();
    }
    /* une grotte percée : un trou, avec l'épaisseur de la roche sur le bord */
    function cutHole(g, cx, hw, hh, W, seed) {
      g.globalCompositeOperation = 'destination-out';
      archPath(g, cx, hw, hh, W, seed);
      g.fillStyle = '#000';
      g.fill();
      g.globalCompositeOperation = 'source-atop';
      /* l'épaisseur de la roche : une ombre douce sur le bord du trou */
      archPath(g, cx, hw, hh, W, seed);
      g.strokeStyle = 'rgba(120,112,92,0.22)';
      g.lineWidth = 14;
      g.stroke();
      g.strokeStyle = 'rgba(110,104,86,0.3)';
      g.lineWidth = 5;
      g.stroke();
      archPath(g, cx, hw + 7.5, hh + 7.5, W, seed);
      g.strokeStyle = 'rgba(255,255,255,0.4)';
      g.lineWidth = 1.2;
      g.stroke();
      g.globalCompositeOperation = 'source-over';
    }

    function blockOutline(g, bottom, extra) {
      const xr = faceX(topY(G.w));
      g.beginPath();
      g.moveTo(-2, bottom + 2);
      for (let x = -2; x < xr; x += 6) g.lineTo(x, topY(x) - extra);
      const yt = topY(xr) - extra;
      for (let y = yt; y < bottom + 2; y += 6) g.lineTo(faceX(y) + extra, y);
      g.lineTo(faceX(bottom) + extra, bottom + 2);
      g.closePath();
      return xr;
    }

    function drawGrass(g, xr) {
      const k = grassK;
      g.beginPath();
      for (let x = -2; x <= xr - 1; x += 4) g.lineTo(x, topY(x) - 1.5 - k * (1.5 + Math.sin(x * 0.7) * 0.8));
      for (let x = Math.floor(xr - 1); x >= -2; x -= 4) g.lineTo(x, topY(x) + 2.5 + 3 * k);
      g.closePath();
      const top = G.floor - G.T - G.lift;
      const gr = g.createLinearGradient(0, top - 6, 0, top + 12);
      gr.addColorStop(0, '#93CC64');
      gr.addColorStop(1, '#4E8C35');
      g.globalAlpha = k;
      g.fillStyle = gr;
      g.fill();
      /* touffes */
      g.beginPath();
      const r = seeded(3);
      for (let x = 0; x < xr - 2; x += 2.6) {
        const y = topY(x) - 1;
        const hh = (1.5 + r() * 3.5) * k;
        g.moveTo(x, y);
        g.lineTo(x + (r() - 0.5) * 2.2, y - hh);
      }
      g.strokeStyle = '#6BAA45';
      g.lineWidth = 1.1;
      g.stroke();
      /* ombre sous l'herbe */
      g.beginPath();
      for (let x = -2; x <= xr - 1; x += 6) g.lineTo(x, topY(x) + 4 + 3 * k);
      g.strokeStyle = 'rgba(110,100,70,0.25)';
      g.lineWidth = 2;
      g.stroke();
      g.globalAlpha = 1;
    }

    function drawNeedle(g, texY, nd) {
      const [gw] = gapDims();
      const W = G.water;
      const xl = G.gapCx + gw * (1 + 0.5 * nd), xr = G.tipX - nd * G.w * 0.012;
      const mid = (xl + xr) / 2 + nd * 1.5;
      const half = (xr - xl) / 2;
      const yTop = topY(mid) + G.h * 0.035 * nd;
      const yb = W + 16;
      const hwN = (t) => half * (1 - nd * (0.3 * t + 0.7 * Math.pow(t, 6)));
      g.save();
      g.beginPath();
      const N = 14;
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const y = lerp(yb, yTop, t);
        g.lineTo(mid - hwN(t) + Math.sin(y * 0.09) * 1.2, y);
      }
      for (let i = N; i >= 0; i--) {
        const t = i / N;
        const y = lerp(yb, yTop, t);
        g.lineTo(mid + hwN(t) + Math.sin(y * 0.07 + 2) * 1.2, y);
      }
      g.closePath();
      g.clip();
      g.drawImage(chalkTex.c, 0, texY, G.w, chalkTex.h);
      g.drawImage(streakTex.c, 0, texY, G.w, streakTex.h);
      const sh = g.createLinearGradient(mid - half, 0, mid + half, 0);
      sh.addColorStop(0, 'rgba(255,255,255,0.18)');
      sh.addColorStop(0.5, 'rgba(255,255,255,0)');
      sh.addColorStop(1, 'rgba(80,86,92,0.32)');
      g.fillStyle = sh;
      g.fillRect(mid - half - 2, yTop - 2, half * 2 + 4, yb - yTop + 4);
      const wet = g.createLinearGradient(0, W - G.h * 0.07, 0, W);
      wet.addColorStop(0, 'rgba(110,128,112,0)');
      wet.addColorStop(1, 'rgba(110,128,112,0.5)');
      g.fillStyle = wet;
      g.fillRect(mid - half - 2, W - G.h * 0.07, half * 2 + 4, G.h * 0.07 + 18);
      g.restore();
    }

    function renderBlock() {
      const g = blockCv.g;
      const { w, h } = G;
      const W = G.water;
      g.clearRect(0, 0, w, h);
      const bottom = G.floor - G.lift * riseK;
      const texY = bottom - G.T - TEX_TOP;
      g.save();
      const xr = blockOutline(g, bottom, 0);
      g.clip();
      g.drawImage(chalkTex.c, 0, texY, w, chalkTex.h);
      /* rognons de silex qui apparaissent */
      for (const row of flintRows) {
        if (row.born < 0 || row.baked) continue;
        const s = clamp((time - row.born) / 0.5);
        for (const n of row.nod) paintNodule(g, n, texY + rowY(row), ease.outBack(s), row);
        if (s >= 1) bakeRow(row);
      }
      const top = G.floor - Math.max(fill * G.T, 4) - G.lift * riseK;
      if (shapeK > 0) {
        g.globalAlpha = shapeK;
        g.drawImage(streakTex.c, 0, texY, w, streakTex.h);
        g.globalAlpha = 1;
        const side = g.createLinearGradient(xr - 18, 0, xr + 2, 0);
        side.addColorStop(0, 'rgba(80,86,92,0)');
        side.addColorStop(1, `rgba(80,86,92,${0.32 * shapeK})`);
        g.fillStyle = side;
        g.fillRect(xr - 18, 0, 22, h);
        const wet = g.createLinearGradient(0, W - h * 0.07, 0, W);
        wet.addColorStop(0, 'rgba(110,128,112,0)');
        wet.addColorStop(1, `rgba(110,128,112,${0.5 * seaK})`);
        g.fillStyle = wet;
        g.fillRect(0, W - h * 0.07, w, h * 0.07 + 18);
      }
      /* lumière venue d'en haut */
      const lg = g.createLinearGradient(0, top - 4, 0, top + G.T * 0.5);
      lg.addColorStop(0, 'rgba(255,255,255,0.22)');
      lg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = lg;
      g.fillRect(0, top - 6, w, G.T * 0.5 + 8);
      g.restore();

      if (grassK > 0) drawGrass(g, xr);
      else {
        /* la neige fraîche, toute blanche, sur le dessus */
        g.beginPath();
        for (let x = -2; x <= w + 6; x += 6) g.lineTo(x, topY(x) + 0.8);
        g.strokeStyle = 'rgba(255,255,255,0.9)';
        g.lineWidth = 2.2;
        g.stroke();
      }

      if (phase === 'vagues') {
        if (archD > 0.002) {
          const [hw, hh] = archDims();
          if (archPierced) cutHole(g, G.archCx, hw, hh, W, 1.3);
          else drawCave(g, G.archCx, hw, hh, W, 1.3);
        }
        if (gapD > 0.002) {
          const [gw, gh] = gapDims();
          if (gapPierced) cutHole(g, G.gapCx, gw, gh, W, 4.2);
          else drawCave(g, G.gapCx, gw, gh, W, 4.2);
        }
        if (gapD > 0.9 && needleD > 0.001) {
          /* la voûte s'effondre : il ne reste que la falaise et l'aiguille */
          const [gw] = gapDims();
          const xe = G.gapCx - gw * 0.85;
          g.globalCompositeOperation = 'destination-out';
          g.fillStyle = '#000';
          g.beginPath();
          g.moveTo(w + 4, -4);
          g.lineTo(xe + 3, -4);
          for (let y = 0; y <= W + 18; y += 8) g.lineTo(xe + Math.sin(y * 0.09 + 1.7) * 2.2 + Math.sin(y * 0.23) * 1.1, y);
          g.lineTo(w + 4, W + 18);
          g.closePath();
          g.fill();
          g.globalCompositeOperation = 'source-atop';
          const eg = g.createLinearGradient(xe - 14, 0, xe, 0);
          eg.addColorStop(0, 'rgba(90,96,100,0)');
          eg.addColorStop(1, 'rgba(90,96,100,0.3)');
          g.fillStyle = eg;
          g.fillRect(xe - 14, 0, 16, W + 18);
          g.globalCompositeOperation = 'source-over';
          drawNeedle(g, texY, needleD);
        }
      }
    }

    /* ---- dessin de la scène ---- */
    function waveLines(y0, y1, Hz) {
      const a = seaK;
      if (a <= 0.01) return;
      ctx.lineWidth = 1.2;
      const off = (time * 0.12 * AMB) % 1;
      for (let i = 0; i < 11; i++) {
        const f = (i + 1 - off) / 11;
        const y = Hz + (G.h - Hz) * Math.pow(f, 1.7);
        if (y < y0 || y > y1) continue;
        ctx.strokeStyle = `rgba(255,255,255,${a * (0.12 + 0.22 * f)})`;
        ctx.beginPath();
        for (let x = -6; x <= G.w + 12; x += 12) {
          const yy = y + Math.sin(x * 0.045 + i * 2.1 + time * 0.8 * AMB) * (0.6 + 1.6 * f);
          if (x === -6) ctx.moveTo(x, yy);
          else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
    }

    function render() {
      const { w, h } = G;
      const W = seaY();
      const Hz = lerp(G.sea0, G.horizon, seaK);
      ctx.save();
      if (phase === 'leve' && !api.reducedMotion) {
        const k = Math.sin(liftT * Math.PI);
        ctx.translate(Math.sin(time * 47) * 1.3 * k, Math.cos(time * 39) * 0.8 * k);
      }
      /* le ciel */
      const sk = ctx.createLinearGradient(0, 0, 0, Math.max(Hz, 10));
      sk.addColorStop(0, '#BCDDEF');
      sk.addColorStop(1, '#EFF7F8');
      ctx.fillStyle = sk;
      ctx.fillRect(-4, -4, w + 8, Hz + 5);
      ctx.save();
      ctx.beginPath();
      ctx.rect(-4, -4, w + 8, Hz + 4);
      ctx.clip();
      const off = (time * 4 * AMB) % w;
      ctx.drawImage(cloudTex.c, off, 0, w, cloudTex.h);
      ctx.drawImage(cloudTex.c, off - w, 0, w, cloudTex.h);
      ctx.restore();
      /* la mer, au loin ou en coupe */
      const sg = ctx.createLinearGradient(0, Hz, 0, h);
      sg.addColorStop(0, lib.mix('#86C7E6', '#B3D9EA', seaK));
      sg.addColorStop(0.3, lib.mix('#3E95C6', '#78B6D7', seaK));
      sg.addColorStop(1, lib.mix('#164F7D', '#2F7DB0', seaK));
      ctx.fillStyle = sg;
      ctx.fillRect(-4, Hz, w + 8, h - Hz + 4);
      if (seaK < 1) {
        ctx.globalAlpha = 1 - seaK;
        ctx.drawImage(rayTex.c, 0, G.sea0, w, rayTex.h);
        ctx.globalAlpha = 1;
      }
      if (seaK > 0) {
        ctx.fillStyle = `rgba(255,255,255,${0.55 * seaK})`;
        ctx.fillRect(-4, Hz - 0.5, w + 8, 1.2);
        waveLines(Hz, W, Hz);
      }
      /* le socle, puis la craie */
      ctx.drawImage(baseTex.c, 0, G.floor - G.lift * riseK - 2, w, baseTex.h);
      if (blockDirty) {
        renderBlock();
        blockDirty = false;
      }
      ctx.drawImage(blockCv.c, 0, 0, w, h);
      if (pierceFlash > 0) {
        const [, hh] = archDims();
        draw.glow(ctx, G.archCx, G.water - hh * 0.4, G.archHW * 2.4, '#FFFFFF', 0.7 * pierceFlash);
      }

      /* l'eau devant : légère en coupe, opaque au pied de la falaise */
      ctx.globalAlpha = lerp(0.12, 1, seaK);
      ctx.fillStyle = sg;
      ctx.fillRect(-4, W, w + 8, h - W + 4);
      ctx.globalAlpha = 1;
      if (seaK > 0) waveLines(W + 1, h + 4, Hz);
      if (seaK < 1) {
        /* la surface vue en coupe */
        ctx.beginPath();
        for (let x = -6; x <= w + 12; x += 10) {
          const y = W + Math.sin(x * 0.05 + time * 1.4 * AMB) * 1.2;
          if (x === -6) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(255,255,255,${0.75 * (1 - seaK)})`;
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
      if (phase === 'vagues' || seaK > 0.95) drawFoot();

      /* le plancton et sa neige */
      if (coccos.length) {
        if (hold && phase === 'neige') draw.glow(ctx, hold.x, hold.y, 70, '#FFFFFF', 0.28);
        for (const c of coccos) {
          const sp = sprites[c.sp];
          const sc = (c.pin ? 1.15 : 1) * c.s;
          const a = clamp(c.fade) * (c.pin ? loupeA : 1);
          if (a < 0.02 || sc < 0.05) continue;
          ctx.globalAlpha = a;
          ctx.drawImage(sp.c, c.x - (sp.w * sc) / 2, c.y - (sp.h * sc) / 2, sp.w * sc, sp.h * sc);
        }
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = '#FFFFFF';
      for (const p of plates) {
        ctx.globalAlpha = p.land >= 0 ? p.land / 0.35 : 0.95 * Math.min(1, p.t * 5);
        const sw = p.sz * (0.5 + 0.5 * Math.abs(Math.cos(time * p.spin + p.ph)));
        ctx.fillRect(p.x - sw, p.y - p.sz * 0.55, sw * 2, p.sz * 1.1);
      }
      ctx.globalAlpha = 1;
      if (loupeA > 0.01) drawLoupe();

      /* vagues, écume, embruns */
      for (const b of breakers) drawBreaker(b);
      for (const f of foams) {
        const k = f.t / f.dur;
        ctx.fillStyle = `rgba(255,255,255,${0.75 * (1 - k)})`;
        ctx.beginPath();
        ctx.ellipse(f.x, f.y + 2, f.r * (0.6 + 1.2 * ease.outCubic(k)), 3 + 3 * k, 0, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      for (const d of drops) {
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r * (1 - (d.t / d.life) * 0.5), 0, TAU);
        ctx.fill();
      }
      for (const c of crumbs) {
        ctx.fillStyle = c.col;
        ctx.fillRect(c.x - c.s / 2, c.y - c.s / 2, c.s, c.s * 0.8);
      }
      for (const r of rings) {
        const k = r.t / 0.6;
        ctx.strokeStyle = `rgba(255,255,255,${0.85 * (1 - k)})`;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(r.x, r.y, 8 + 30 * ease.outCubic(k), 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
    }

    /* l'écume au pied de la falaise */
    function drawFoot() {
      const W = G.water;
      const xr = needleD > 0 ? G.tipX : faceX(W);
      let skipA = -1, skipB = -1, skipC = -1, skipD = -1;
      if (archPierced) {
        const [hw] = archDims();
        skipA = G.archCx - hw + 4;
        skipB = G.archCx + hw - 4;
      }
      if (gapPierced) {
        const [gw] = gapDims();
        skipC = G.gapCx - gw + 3;
        skipD = G.gapCx + gw + 3;
      }
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath();
      for (let x = 0; x < xr; x += 5) {
        if ((x > skipA && x < skipB) || (x > skipC && x < skipD)) continue;
        const k = 0.5 + 0.5 * Math.sin(time * 2.2 * AMB + x * 0.21);
        ctx.moveTo(x + 3.5 + k, W + 1);
        ctx.ellipse(x, W + 1, 3 + k * 1.5, 1.3 + k * 0.6, 0, 0, TAU);
      }
      ctx.fill();
    }

    function drawBreaker(b) {
      const k = ease.inOutSine(clamp(b.t / b.dur));
      const W = G.water;
      const x = lerp(b.x0, b.tx, k);
      const y = lerp(b.y0, W + 3, k);
      const sc = lerp(1, 0.62, k);
      const wv = (b.big ? 48 : 34) * sc, hv = (b.big ? 11 : 7) * sc;
      ctx.fillStyle = 'rgba(150,212,236,0.6)';
      ctx.beginPath();
      ctx.ellipse(x, y + hv * 0.5, wv, hv * 0.9, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - wv, y + hv * 0.4);
      ctx.quadraticCurveTo(x, y - hv * 1.5, x + wv, y + hv * 0.4);
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineWidth = (b.big ? 3.2 : 2.2) * sc;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      for (let i = 0; i < 4; i++) {
        const fx = x + (i - 1.5) * wv * 0.5;
        ctx.beginPath();
        ctx.arc(fx, y + hv * (1.2 + 0.3 * Math.sin(i * 2 + b.t * 9)), 1.6 * sc, 0, TAU);
        ctx.fill();
      }
    }

    /* la loupe et le fil qui la relie au plancton grossi */
    function drawLoupe() {
      const L = G.loupeR;
      const cx = G.loupeX, cy = G.loupeY;
      const px = pinC.x, py = pinC.y;
      const r1 = G.coccoR * 2;
      const dx = cx - px, dy = cy - py;
      const d = Math.hypot(dx, dy) || 1;
      const nx = -dy / d, ny = dx / d;
      ctx.globalAlpha = loupeA;
      ctx.strokeStyle = 'rgba(28,110,158,0.75)';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(px + nx * r1, py + ny * r1);
      ctx.lineTo(cx + nx * L, cy + ny * L);
      ctx.moveTo(px - nx * r1, py - ny * r1);
      ctx.lineTo(cx - nx * L, cy - ny * L);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, r1, 0, TAU);
      ctx.stroke();
      ctx.drawImage(loupeTex.c, cx - loupeTex.w / 2, cy - loupeTex.h / 2, loupeTex.w, loupeTex.h);
      ctx.globalAlpha = 1;
    }

    function init() {
      phase = 'neige';
      fill = 0;
      hold = null;
      liftT = 0;
      liftFrom = 0;
      preview = 0;
      previewShown = 0;
      riseK = seaK = shapeK = grassK = 0;
      plates = [];
      drops = [];
      crumbs = [];
      foams = [];
      rings = [];
      breakers = [];
      carve = 0;
      archD = archT = gapD = gapT = needleD = needleT = 0;
      archPierced = gapPierced = false;
      pierceFlash = 0;
      finished = false;
      doneTimer = -1;
      shownM = -1;
      bloomT = snowT = ambT = 0;
      snowI = 0;
      waveT = 2;
      loupeA = 1;
      btn.hidden = true;
      grab.hidden = true;
      makeRows();
      buildChalk();
      seedCoccos();
      updateStatus();
      blockDirty = true;
      api.gesture('hold', { x: 50, y: 30 });
    }

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
