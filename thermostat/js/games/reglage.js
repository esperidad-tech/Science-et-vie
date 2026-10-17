/* Le thermostat en action. On réveille le volcan trois fois : le CO2 monte, l'aiguille file vers le rouge.
   Puis, en accéléré, la chaleur fait grossir les nuages, la pluie use les montagnes, la rivière porte
   les grains de roche jusqu'à l'océan où le calcaire s'entasse, et la brume de CO2 s'éclaircit :
   l'aiguille revient au milieu. Bonus : « Et s'il fait froid ? » montre le réglage dans l'autre sens. */
(function () {
  'use strict';
  const { lib } = window.RM;
  const { TAU, rand, clamp, lerp, ease, draw } = lib;

  /* Tous les textes du jeu, faciles à corriger */
  const TEXTES = {
    bouton: 'Réveiller le volcan',
    boutonFroid: 'Et s’il fait froid ?',
    encore: 'Encore ! Réveille le volcan.',
    derniere: 'Réveille-le une dernière fois.',
    eruption: (n) => `Éruption ${n} sur 3 : le CO2 monte, la Terre se réchauffe.`,
    tropChaud: 'Éruption 3 sur 3 : l’aiguille est dans le rouge.',
    regarde: 'Regarde le thermostat faire son travail.',
    chaud: 'Il fait chaud : il pleut davantage, les roches s’usent plus vite.',
    avalent: 'Les roches avalent le CO2 : la Terre se refroidit.',
    temps: (n) => `Temps écoulé : ${lib.num(n)} ans`,
    fin: 'Le thermostat a ramené la Terre vers le milieu.',
    finStatut: 'Plus il fait chaud, plus les roches avalent de CO2. Mais il a fallu des centaines de milliers d’années.',
    froid: 'Il fait froid : il pleut moins, le CO2 des volcans s’accumule.',
    regardeFroid: 'Regarde le volcan continuer de souffler.',
    encoreMilieu: 'Le thermostat a encore ramené la Terre vers le milieu.',
  };

  /* Les couleurs du thermostat : les mêmes que la barre en haut de la page */
  const RAMP = [[0, '#7FC8F8'], [0.3, '#5FB4E8'], [0.5, '#8BD86A'], [0.7, '#FFB347'], [1, '#FF4E3A']];
  const SKY_TOP = [[0, '#0A1A2E'], [0.5, '#0B1F23'], [1, '#2A140C']];
  const SKY_LOW = [[0, '#6A9CC4'], [0.5, '#3F7C7E'], [1, '#B0663A']];

  /* Le relief en coupe, en fractions de la scène */
  const SEA = 0.69;      /* niveau de la mer */
  const PLAIN = 0.676;   /* la plaine */
  const FLOOR = 0.905;   /* le fond de l'océan */
  const VOLC = { u: 0.15, hw: 0.19, h: 0.29, cut: 0.245 };
  const PEAKS = [[0.335, 0.105, 0.05], [0.425, 0.205, 0.062], [0.515, 0.14, 0.046]];
  const STRATA = ['#6A5A43', '#7C6B4F', '#5B4C3A', '#8C7A5A', '#514538', '#76664D', '#625342'];

  /* Le modèle, en « unités de jeu » (une illustration, pas une mesure) */
  const C0 = 0.3;          /* CO2 d'équilibre : l'aiguille au milieu */
  const KICK = 0.7 / 3;    /* CO2 soufflé par une éruption */
  const WK = 0.2;          /* vitesse à laquelle la pluie et les roches avalent le CO2 */
  const V0 = WK * 0.25;    /* les volcans soufflent toujours un peu */
  const BAND = 0.03;       /* écart au milieu pour dire « revenu au milieu » */

  const smooth = (t) => t * t * (3 - 2 * t);
  function seeded(seed) {
    let s = seed >>> 0 || 1;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }
  const toRGB = (stops) => stops.map(([t, c]) => [t, lib.hexToRgb(c)]);
  const RAMP_RGB = toRGB(RAMP), TOP_RGB = toRGB(SKY_TOP), LOW_RGB = toRGB(SKY_LOW);
  function rampRGB(stops, t, out) {
    t = clamp(t);
    let i = 1;
    while (i < stops.length - 1 && t > stops[i][0]) i++;
    const [t0, a] = stops[i - 1], [t1, b] = stops[i];
    const k = clamp((t - t0) / (t1 - t0));
    out[0] = Math.round(lerp(a[0], b[0], k));
    out[1] = Math.round(lerp(a[1], b[1], k));
    out[2] = Math.round(lerp(a[2], b[2], k));
    return out;
  }
  const css = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  function glowRGB(g, x, y, r, c, a) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, css(c, a));
    gr.addColorStop(1, css(c, 0));
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
  }

  /* Hauteur du sol (fraction de la scène) en u = x / largeur */
  function volcH(u) {
    const dv = Math.abs(u - VOLC.u) / VOLC.hw;
    if (dv >= 1) return 0;
    const cone = VOLC.h * Math.pow(1 - dv, 1.35);
    /* sommet arrondi (minimum doux), puis la cuvette du cratère */
    const k = 0.006;
    let hv = -k * Math.log(Math.exp(-cone / k) + Math.exp(-VOLC.cut / k));
    if (dv < 0.2) hv -= 0.017 * Math.pow(1 - (dv / 0.2) * (dv / 0.2), 1.6);
    return Math.max(0, hv);
  }
  function mountH(u, n) {
    let hm = 0;
    for (const [c, ph, s] of PEAKS) hm = Math.max(hm, ph * Math.exp(-Math.pow((u - c) / s, 2)));
    if (n && hm > 0.004) hm += (n.fbm(u * 24, 1.7, 3) - 0.5) * 0.028 * Math.min(1, hm / 0.06);
    return hm;
  }
  function surfN(u, n) {
    let y = PLAIN - Math.max(volcH(u), mountH(u, n));
    if (u > 0.71) {
      const k1 = smooth(clamp((u - 0.71) / 0.07));
      const k2 = smooth(clamp((u - 0.78) / 0.09));
      y = lerp(PLAIN, SEA + 0.024, k1) + (FLOOR - SEA - 0.024) * k2 + 0.004 * Math.sin(u * 61) * k2;
    }
    return y;
  }

  const CSS = `
.game[data-game="reglage"] .game-status { white-space: pre-line; }
.game[data-game="reglage"] .rg-btn {
  position: absolute; left: 50%; bottom: 12px; z-index: 4; transform: translateX(-50%); white-space: nowrap;
  background: var(--accent); color: var(--btn-fg); padding-inline: 14px 18px;
  box-shadow: 0 0 0 3px rgba(234, 245, 230, 0.22), 0 10px 22px -8px rgba(0, 0, 0, 0.75);
}
.game[data-game="reglage"] .rg-btn:active { transform: translateX(-50%) translateY(1px) scale(0.98); }
.game[data-game="reglage"] .rg-btn[hidden] { display: none; }
.game[data-game="reglage"] .rg-btn:not([hidden]) { animation: rg-in 0.45s cubic-bezier(0.2, 0.8, 0.2, 1.2); }
.game[data-game="reglage"] .rg-btn svg { width: 22px; height: 22px; flex: none; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.game[data-game="reglage"] .rg-btn.is-cold { background: #CFEAFF; color: #0B2A40; }
@keyframes rg-in { from { opacity: 0; transform: translateX(-50%) scale(0.7); } to { opacity: 1; transform: translateX(-50%); } }
`;
  const ICON_VOLCAN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 20.5h18l-6-9.5h-6z" fill="currentColor" stroke="none"/><path d="M10.5 8.2c-1.9-.3-2.4-2.6-.7-3.5 1-.5 2.1-.2 2.6.6.8-1.1 2.9-.9 3.2.7"/></svg>';
  const ICON_FROID = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5"/></svg>';

  window.RM.games.reglage = function (api) {
    const cv = api.canvas();
    const ctx = cv.ctx;
    const AMB = api.reducedMotion ? 0.3 : 1;
    api.style(CSS);

    /* ---- le bouton (alternative à la tape sur le volcan, puis bonus « froid ») ---- */
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip rg-btn';
    api.stage.appendChild(btn);
    function setButton(kind) {
      btn.dataset.kind = kind || '';
      if (!kind) {
        btn.hidden = true;
        return;
      }
      btn.classList.toggle('is-cold', kind === 'froid');
      btn.innerHTML = (kind === 'froid' ? ICON_FROID : ICON_VOLCAN) + '<span></span>';
      btn.lastChild.textContent = kind === 'froid' ? TEXTES.boutonFroid : TEXTES.bouton;
      btn.hidden = false;
    }

    /* ---- géométrie et textures ---- */
    const G = { w: 1, h: 1, sea: 1, shore: 1, cx: 1, cy: 1 };
    let surf = new Float32Array(4);
    let volcMask = new Uint8Array(4);
    let landTex = null, gaugeTex = null, hazeA = null, sunTex = null, molTex = null;
    let puffTex = [], cloudTex = [];
    let river = null;
    const CLOUDS = [[0.31, 0.383, 0], [0.43, 0.362, 1], [0.545, 0.388, 2]];

    function mk(wc, hc) {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(wc * cv.dpr));
      c.height = Math.max(1, Math.round(hc * cv.dpr));
      const g = c.getContext('2d');
      g.scale(cv.dpr, cv.dpr);
      return { c, g, w: wc, h: hc };
    }
    function surfAt(x) {
      const i = clamp(Math.floor(x), 0, G.w);
      const f = clamp(x - i, 0, 1);
      return lerp(surf[i], surf[i + 1], f);
    }

    function geometry(w, h) {
      G.w = w;
      G.h = h;
      /* le cadran, en haut */
      G.gR = Math.round(Math.min(w * 0.34, h * 0.215));
      G.gT = Math.max(10, Math.round(G.gR * 0.17));
      G.gcx = w / 2;
      G.gcy = Math.round(Math.max(12, h * 0.024) + G.gR + G.gT / 2 + 5);
      G.domeR = G.gR + G.gT / 2 + 11;
      G.domeB = G.gcy + G.gT * 0.5 + 12;
      /* le relief */
      const n = lib.makeNoise(11);
      surf = new Float32Array(w + 2);
      volcMask = new Uint8Array(w + 2);
      for (let x = 0; x <= w + 1; x++) {
        const u = x / w;
        surf[x] = surfN(u, n) * h;
        volcMask[x] = volcH(u) > 0.002 && volcH(u) >= mountH(u, n) ? 1 : 0;
      }
      G.sea = SEA * h;
      let sx = Math.round(w * 0.7);
      while (sx < w && surf[sx] < G.sea) sx++;
      G.shore = sx;
      G.cx = VOLC.u * w;
      G.cy = surfAt(G.cx);
      G.rimY = (PLAIN - VOLC.cut) * h;
      G.rimHW = Math.max(6, VOLC.hw * 0.08 * w);
      G.chX = G.cx;
      G.chY = h * 0.86;
      G.chRX = Math.max(18, Math.min(w * 0.07, h * 0.075));
      G.chRY = Math.max(10, h * 0.032);
      G.limeMax = Math.max(10, h * 0.05);
      buildRiver();
      buildLand();
      buildGauge();
      hazeA = buildHaze(5, '#F0A55C');
      sunTex = buildSun();
      buildMol();
      buildPuffs();
      buildClouds();
    }

    function buildRiver() {
      const x0 = G.w * 0.535, x1 = G.shore + 3;
      const pts = [];
      for (let x = x0; x <= x1; x += 3) pts.push(x, surfAt(x) + 0.4);
      pts.push(x1, G.sea + 0.5);
      const P = new Float32Array(pts);
      const L = new Float32Array(P.length / 2);
      for (let i = 1; i < L.length; i++) L[i] = L[i - 1] + Math.hypot(P[i * 2] - P[i * 2 - 2], P[i * 2 + 1] - P[i * 2 - 1]);
      river = { P, L, total: L[L.length - 1] };
    }
    function riverAt(s, out) {
      const { P, L, total } = river;
      s = clamp(s, 0, total);
      let i = 1;
      while (i < L.length - 1 && L[i] < s) i++;
      const k = (s - L[i - 1]) / Math.max(0.001, L[i] - L[i - 1]);
      out.x = lerp(P[i * 2 - 2], P[i * 2], k);
      out.y = lerp(P[i * 2 - 1], P[i * 2 + 1], k);
      return out;
    }

    function landPath(g) {
      g.beginPath();
      g.moveTo(-2, surf[0]);
      for (let x = 0; x <= G.w; x += 2) g.lineTo(x, surf[x]);
      g.lineTo(G.w + 2, surf[G.w]);
      g.lineTo(G.w + 2, G.h + 2);
      g.lineTo(-2, G.h + 2);
      g.closePath();
    }

    /* La coupe du sol : couches de roche qui se soulèvent sous les montagnes,
       basalte sombre du volcan, croûte de l'océan. */
    function buildLand() {
      const { w, h } = G;
      const R = mk(w, h);
      const g = R.g;
      const TW = w + 1, TH = h + 1;
      const t = document.createElement('canvas');
      t.width = TW;
      t.height = TH;
      const tg = t.getContext('2d');
      const img = tg.createImageData(TW, TH);
      const d = img.data;
      const n = lib.makeNoise(17);
      const STR = STRATA.map(lib.hexToRgb);
      const BAS = ['#403833', '#2F2926', '#4B3E36', '#37302C'].map(lib.hexToRgb);
      const OC = ['#323B3F', '#283135', '#3A4243'].map(lib.hexToRgb);
      const plainY = PLAIN * h;
      const layer = h * 0.03;
      const c = [0, 0, 0];
      const band = (pal, q, soft) => {
        const k = Math.floor(q);
        const A = pal[((k % pal.length) + pal.length) % pal.length];
        const B = pal[(((k - 1) % pal.length) + pal.length) % pal.length];
        const f = smooth(clamp((q - k) / soft));
        c[0] = lerp(B[0], A[0], f);
        c[1] = lerp(B[1], A[1], f);
        c[2] = lerp(B[2], A[2], f);
      };
      for (let y = 0; y < TH; y++) {
        for (let x = 0; x < TW; x++) {
          const s = surf[Math.min(w + 1, x)];
          const j = (y * TW + x) * 4;
          if (y < s - 2) {
            d[j + 3] = 0;
            continue;
          }
          const depth = Math.max(0, y - s);
          const nz = n.fbm(x / 26, y / 9, 3);
          const u = x / w;
          /* le cône du volcan (sous son propre profil), la croûte de l'océan (frontière en biais), les couches */
          const vh = volcH(u);
          const coneTop = (PLAIN - vh) * h;
          const coneBase = plainY + 14 * smooth(clamp(1 - (Math.abs(u - VOLC.u) / VOLC.hw) * 1.3)) + nz * 5 - 2;
          if (vh > 0.001 && y >= coneTop - 1 && y < coneBase) {
            band(BAS, (y - coneTop + nz * 8) / 6, 0.25);
          } else if (y > G.sea && x > G.shore - 4 + (y - G.sea) * 0.45 - nz * 14) {
            band(OC, (y + nz * 10) / 9, 0.3);
          } else {
            const bulge = (plainY - s) * 0.62 * Math.exp(-depth / (h * 0.22));
            band(STR, (y + bulge + nz * 12) / layer, 0.09);
          }
          /* volume : pentes tournées vers le Soleil (à droite) plus claires */
          const sl = (surf[Math.min(w + 1, x + 2)] - surf[Math.max(0, x - 2)]) / 4;
          const lit = 1 + 0.2 * clamp(sl * 1.6, -1, 1) * Math.exp(-depth / 12);
          const b = lit * (0.87 + nz * 0.26) * (1 - 0.4 * smooth(clamp((y - h * 0.7) / (h * 0.3))));
          d[j] = c[0] * b;
          d[j + 1] = c[1] * b;
          d[j + 2] = c[2] * b;
          d[j + 3] = 255;
        }
      }
      tg.putImageData(img, 0, 0);
      g.save();
      landPath(g);
      g.clip();
      g.imageSmoothingEnabled = true;
      g.drawImage(t, 0, 0, TW, TH);
      /* petits cailloux dans les couches */
      const r = seeded(23);
      for (let i = 0; i < Math.round((w * h) / 900); i++) {
        const x = r() * w, y = h * PLAIN + r() * h * 0.33;
        if (y < surfAt(x) + 4) continue;
        g.fillStyle = r() < 0.5 ? `rgba(20,14,10,${0.18 + r() * 0.2})` : `rgba(235,220,190,${0.08 + r() * 0.12})`;
        draw.blob(g, x, y, 0.8 + r() * 1.8, 0.3, i, 0, 8);
        g.fill();
      }
      /* ombre douce sous la surface : la coupe a de l'épaisseur */
      g.beginPath();
      for (let x = -2; x <= w + 2; x += 3) g.lineTo(x, surfAt(x) + 6);
      g.strokeStyle = 'rgba(10,8,6,0.22)';
      g.lineWidth = 9;
      g.stroke();
      /* la chambre de magma, creusée dans la roche */
      g.save();
      g.translate(G.chX, G.chY);
      g.scale(1, G.chRY / G.chRX);
      draw.blob(g, 0, 0, G.chRX * 1.08, 0.12, 2.1, 0, 30);
      g.restore();
      g.fillStyle = '#1C100C';
      g.fill();
      g.restore();

      /* la peau du sol : herbe en bas, roche nue en haut, cendres sur le volcan */
      g.lineCap = 'round';
      g.lineWidth = 3.2;
      for (let x = 0; x < G.shore + 2; x += 2) {
        const y0 = surfAt(x), y1 = surfAt(x + 2);
        const alt = (h * PLAIN - Math.min(y0, y1)) / (h * 0.2);
        g.strokeStyle = volcMask[x] ? (alt > 0.9 ? '#54423A' : '#3E3531') : lib.mix('#6C9A46', '#958B7C', smooth(clamp((alt - 0.22) / 0.42)));
        g.beginPath();
        g.moveTo(x, y0 + 1.3);
        g.lineTo(x + 2, y1 + 1.3);
        g.stroke();
      }
      g.beginPath();
      for (let x = 0; x <= G.shore; x += 2) g.lineTo(x, surfAt(x) - 0.2);
      g.strokeStyle = 'rgba(240,250,230,0.16)';
      g.lineWidth = 1;
      g.stroke();
      /* quelques arbres ronds dans la plaine */
      const trees = [0.6, 0.632, 0.662, 0.69];
      trees.forEach((u, i) => {
        const x = u * w + (r() - 0.5) * 6;
        if (x > G.shore - 8) return;
        const y = surfAt(x);
        const s = Math.max(2.6, w * 0.0105) * (0.85 + r() * 0.35);
        g.fillStyle = '#4A3526';
        g.fillRect(x - 0.7, y - s * 1.3, 1.4, s * 1.4);
        const gr = g.createRadialGradient(x - s * 0.35, y - s * 1.9, s * 0.2, x, y - s * 1.6, s * 1.2);
        gr.addColorStop(0, '#9BCB6B');
        gr.addColorStop(1, '#3F6E2C');
        g.fillStyle = gr;
        draw.blob(g, x, y - s * 1.6, s, 0.12, i * 1.7, 0, 14);
        g.fill();
      });
      landTex = R;
    }

    function domePath(g) {
      const { gcx, gcy, domeR, domeB } = G;
      const r = 14;
      g.beginPath();
      g.moveTo(gcx - domeR, gcy);
      g.arc(gcx, gcy, domeR, Math.PI, TAU);
      g.lineTo(gcx + domeR, domeB - r);
      g.quadraticCurveTo(gcx + domeR, domeB, gcx + domeR - r * 1.2, domeB);
      g.lineTo(gcx - domeR + r * 1.2, domeB);
      g.quadraticCurveTo(gcx - domeR, domeB, gcx - domeR, domeB - r);
      g.closePath();
    }

    /* Le cadran : un demi-cercle du bleu (froid) au rouge (chaud), comme un thermostat de maison */
    function buildGauge() {
      const { gcx, gcy, gR, gT } = G;
      const R = mk(G.w, Math.ceil(G.domeB + 24));
      const g = R.g;
      g.save();
      g.shadowColor = 'rgba(0,0,0,0.5)';
      g.shadowBlur = 18;
      g.shadowOffsetY = 6;
      domePath(g);
      g.fillStyle = 'rgba(6,18,12,0.74)';
      g.fill();
      g.restore();
      domePath(g);
      const gl = g.createRadialGradient(gcx - gR * 0.3, gcy - gR * 0.9, 4, gcx, gcy - gR * 0.3, G.domeR * 1.15);
      gl.addColorStop(0, 'rgba(234,245,230,0.16)');
      gl.addColorStop(1, 'rgba(234,245,230,0)');
      g.fillStyle = gl;
      g.fill();
      g.lineWidth = 1.2;
      g.strokeStyle = 'rgba(234,245,230,0.24)';
      g.stroke();
      /* rail sombre */
      g.lineCap = 'round';
      g.lineWidth = gT + 6;
      g.strokeStyle = 'rgba(0,0,0,0.4)';
      g.beginPath();
      g.arc(gcx, gcy, gR, Math.PI, TAU);
      g.stroke();
      /* l'arc coloré */
      g.lineCap = 'butt';
      g.lineWidth = gT;
      const N = 80, c = [0, 0, 0];
      for (let i = 0; i < N; i++) {
        const t0 = i / N, t1 = (i + 1) / N;
        g.strokeStyle = css(rampRGB(RAMP_RGB, (t0 + t1) / 2, c), 1);
        g.beginPath();
        g.arc(gcx, gcy, gR, Math.PI + t0 * Math.PI - 0.006, Math.PI + t1 * Math.PI + 0.006);
        g.stroke();
      }
      g.fillStyle = css(rampRGB(RAMP_RGB, 0, c), 1);
      g.beginPath();
      g.arc(gcx - gR, gcy, gT / 2, 0, TAU);
      g.fill();
      g.fillStyle = css(rampRGB(RAMP_RGB, 1, c), 1);
      g.beginPath();
      g.arc(gcx + gR, gcy, gT / 2, 0, TAU);
      g.fill();
      /* relief de l'arc */
      g.lineWidth = 2;
      g.strokeStyle = 'rgba(255,255,255,0.38)';
      g.beginPath();
      g.arc(gcx, gcy, gR + gT / 2 - 2.6, Math.PI + 0.05, TAU - 0.05);
      g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.25)';
      g.beginPath();
      g.arc(gcx, gcy, gR - gT / 2 + 1.6, Math.PI + 0.06, TAU - 0.06);
      g.stroke();
      /* graduations */
      g.lineCap = 'round';
      for (let i = 0; i <= 10; i++) {
        const a = Math.PI + (i / 10) * Math.PI;
        const mid = i === 5;
        const r1 = gR - gT / 2 - 5, r2 = r1 - (mid ? 11 : i % 5 === 0 ? 8 : 5);
        g.strokeStyle = mid ? 'rgba(234,245,230,0.95)' : 'rgba(234,245,230,0.4)';
        g.lineWidth = mid ? 2.6 : 1.6;
        g.beginPath();
        g.moveTo(gcx + Math.cos(a) * r1, gcy + Math.sin(a) * r1);
        g.lineTo(gcx + Math.cos(a) * r2, gcy + Math.sin(a) * r2);
        g.stroke();
      }
      /* le repère du milieu : un petit galet clair au-dessus de l'arc */
      const my = gcy - gR - gT / 2 - 7;
      g.fillStyle = '#EAF5E6';
      g.beginPath();
      g.moveTo(gcx, my + 5);
      g.lineTo(gcx - 5, my - 2);
      g.quadraticCurveTo(gcx, my - 5, gcx + 5, my - 2);
      g.closePath();
      g.fill();
      /* flocon (froid) et flamme (chaud) */
      const ix = gR * 0.68, iy = gcy - gR * 0.12, s = Math.max(5, gR * 0.07);
      g.strokeStyle = '#BFE4FF';
      g.lineWidth = 1.6;
      g.beginPath();
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI + Math.PI / 2;
        const dx = Math.cos(a) * s, dy = Math.sin(a) * s;
        g.moveTo(gcx - ix - dx, iy - dy);
        g.lineTo(gcx - ix + dx, iy + dy);
      }
      g.stroke();
      g.fillStyle = '#BFE4FF';
      g.beginPath();
      g.arc(gcx - ix, iy, 1.6, 0, TAU);
      g.fill();
      const fx = gcx + ix, fy = iy + s * 0.55;
      const fg = g.createLinearGradient(0, fy - s * 1.6, 0, fy);
      fg.addColorStop(0, '#FFD36B');
      fg.addColorStop(1, '#FF5A36');
      g.fillStyle = fg;
      g.beginPath();
      g.moveTo(fx, fy - s * 1.7);
      g.bezierCurveTo(fx + s * 0.35, fy - s * 1.05, fx + s * 0.95, fy - s * 0.75, fx + s * 0.75, fy - s * 0.2);
      g.quadraticCurveTo(fx + s * 0.55, fy + s * 0.15, fx, fy + s * 0.15);
      g.quadraticCurveTo(fx - s * 0.6, fy + s * 0.15, fx - s * 0.75, fy - s * 0.25);
      g.bezierCurveTo(fx - s * 0.85, fy - s * 0.8, fx - s * 0.2, fy - s * 0.95, fx, fy - s * 1.7);
      g.fill();
      gaugeTex = R;
    }

    /* La brume de CO2 : une texture de bruit qui boucle à l'horizontale */
    function buildHaze(seed, col) {
      const W = Math.max(40, Math.round(G.w / 3)), H = Math.max(30, Math.round((G.h * 0.62) / 3));
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const g = c.getContext('2d');
      const img = g.createImageData(W, H);
      const n = lib.makeNoise(seed);
      const rgb = lib.hexToRgb(col);
      for (let y = 0; y < H; y++) {
        /* plus épaisse près du sol, effacée en haut et en bas */
        const env = smooth(clamp(y / (H * 0.55))) * (1 - smooth(clamp((y - H * 0.86) / (H * 0.14))));
        for (let x = 0; x < W; x++) {
          const a = (x / W) * TAU;
          /* bruit sur un petit cylindre : des volutes étirées à l'horizontale, qui bouclent */
          const v = n.fbm(Math.cos(a) * 0.55 + 5, Math.sin(a) * 0.55 * 1.6 + y / (H / 5.5), 4);
          const j = (y * W + x) * 4;
          img.data[j] = rgb[0];
          img.data[j + 1] = rgb[1];
          img.data[j + 2] = rgb[2];
          img.data[j + 3] = 255 * clamp(0.18 + (v - 0.32) * 2.1) * env;
        }
      }
      g.putImageData(img, 0, 0);
      /* agrandie une fois pour toutes à la résolution de l'écran : à chaque image, une simple copie */
      const R = mk(G.w, Math.round(G.h * 0.62));
      R.g.imageSmoothingEnabled = true;
      R.g.drawImage(c, 0, 0, R.w, R.h);
      return R;
    }

    /* Le Soleil et son halo, préparés une fois */
    function buildSun() {
      const S = Math.ceil(Math.max(G.w, G.h) * 0.32);
      const R = mk(S * 2, S * 2);
      draw.glow(R.g, S, S, S, '#FFD9A0', 0.22);
      draw.glow(R.g, S, S, Math.max(12, G.w * 0.05), '#FFF3D6', 0.95);
      draw.glow(R.g, S, S, Math.max(7, G.w * 0.022), '#FFFFFF', 0.9);
      R.S = S;
      return R;
    }

    /* Une molécule de CO2 : un carbone entre deux oxygènes, avec un petit halo chaud */
    function buildMol() {
      const S = 18;
      const R = mk(S, S);
      const g = R.g;
      draw.glow(g, S / 2, S / 2, S / 2, '#FFB45A', 0.32);
      const atom = (x, rr, a, b) => {
        const gr = g.createRadialGradient(x - rr * 0.35, S / 2 - rr * 0.4, rr * 0.1, x, S / 2, rr);
        gr.addColorStop(0, b);
        gr.addColorStop(1, a);
        g.fillStyle = gr;
        g.beginPath();
        g.arc(x, S / 2, rr, 0, TAU);
        g.fill();
      };
      atom(S / 2 - 4.3, 2.4, '#D9573E', '#FFC2A6');
      atom(S / 2 + 4.3, 2.4, '#D9573E', '#FFC2A6');
      atom(S / 2, 2.7, '#4E4A45', '#C9C2B6');
      molTex = R;
    }

    function buildPuffs() {
      puffTex = ['#615650', '#ABA49A', '#D8D3CB'].map((col, k) => {
        const S = 64;
        const R = mk(S, S);
        const g = R.g;
        const r = seeded(70 + k);
        for (let i = 0; i < 7; i++) {
          const a = r() * TAU, dd = r() * S * 0.15;
          draw.glow(g, S / 2 + Math.cos(a) * dd, S / 2 + Math.sin(a) * dd, S * (0.24 + r() * 0.12), col, 0.5);
        }
        return R;
      });
    }

    function buildClouds() {
      cloudTex = [];
      const CW = Math.max(60, Math.round(Math.min(G.w, G.h * 0.85) * 0.2)), CH = Math.round(CW * 0.56);
      for (let k = 0; k < 3; k++) {
        const r = seeded(40 + k * 7);
        const blobs = [];
        const nb = 6 + k;
        for (let i = 0; i < nb; i++) {
          const t = (i + 0.5) / nb;
          const hump = Math.sin(t * Math.PI);
          const br = CH * (0.17 + 0.22 * hump + r() * 0.07);
          blobs.push([CW * (0.13 + 0.74 * t) + (r() - 0.5) * CW * 0.05, CH * 0.74 - br * 0.78, br]);
        }
        cloudTex.push({
          light: paintCloud(CW, CH, blobs, '#F4F7F2', '#C3CEC9', '#93A2A0'),
          dark: paintCloud(CW, CH, blobs, '#AEB8BA', '#6C787D', '#434E55'),
          CW, CH,
        });
      }
    }
    function paintCloud(CW, CH, blobs, top, mid, bot) {
      const R = mk(CW, CH);
      const g = R.g;
      const gr = g.createLinearGradient(0, CH * 0.1, 0, CH * 0.8);
      gr.addColorStop(0, top);
      gr.addColorStop(0.6, mid);
      gr.addColorStop(1, bot);
      g.save();
      g.shadowColor = 'rgba(255,255,255,0.25)';
      g.shadowBlur = 5;
      g.fillStyle = gr;
      g.beginPath();
      for (const [x, y, rr] of blobs) {
        g.moveTo(x + rr, y);
        g.arc(x, y, rr, 0, TAU);
      }
      g.moveTo(CW * 0.15, CH * 0.74);
      g.ellipse(CW * 0.5, CH * 0.7, CW * 0.36, CH * 0.06, 0, 0, TAU);
      g.fill();
      g.restore();
      for (const [x, y, rr] of blobs) {
        const h = g.createRadialGradient(x - rr * 0.3, y - rr * 0.45, 1, x - rr * 0.2, y - rr * 0.3, rr * 0.8);
        h.addColorStop(0, 'rgba(255,255,255,0.35)');
        h.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = h;
        g.beginPath();
        g.arc(x, y, rr, 0, TAU);
        g.fill();
      }
      return R;
    }

    /* ---- état ---- */
    let mode = 'feu';   /* feu → attente → regul → fin → libre (⇄ froid) */
    let co2 = C0, co2Pending = 0, temp = 0.5, rainK = 0.25, cloudK = 0.45, frostK = 0, limeK = 0.16;
    let nv = 0.5, nvV = 0, lastTick = 5;
    let regulOn = false, weatherOn = false;
    let erupts = 0, lastErupt = -9, waitT = 0, regT = 0, palier = 0, phrase = '', doneT = -1, chipT = -1, coldT = 0;
    let watch = '', misses = 0, act = 0, shake = 0, steamT = 0, puffT = 0, grainT = 0, rainT = 0;
    let time = 0;
    let mols = [], puffs = [], sparks = [], flows = [], drops = [], splashes = [], grains = [], rings = [], flashes = [];
    const tmp = { x: 0, y: 0 };
    const cTop = [0, 0, 0], cLow = [0, 0, 0], cNeedle = [0, 0, 0];
    const DASH = [3, 9], NODASH = [];

    /* ---- les molécules de CO2 ---- */
    function newMol(fromVolcano) {
      const m = {
        x: 0, y: 0, hx: 0, hy: 0, x0: 0, y0: 0, t: 0, dur: rand(1.8, 2.8),
        rot: rand(TAU), vr: rand(-0.8, 0.8), ph: rand(TAU), a: 0, state: 'float', sc: rand(0.85, 1.1),
      };
      pickHome(m);
      if (fromVolcano) {
        m.state = 'rise';
        m.x0 = G.cx + rand(-4, 4);
        m.y0 = G.rimY - 4;
        m.x = m.x0;
        m.y = m.y0;
      } else {
        m.x = m.hx;
        m.y = m.hy;
      }
      return m;
    }
    function pickHome(m) {
      for (let k = 0; k < 8; k++) {
        m.hx = rand(G.w * 0.02, G.w * 0.98);
        m.hy = rand(G.h * 0.1, G.h * 0.6);
        if (m.hy < surfAt(m.hx) - 22) return;
      }
      m.hy = G.h * 0.2;
    }
    function molTarget() {
      return Math.round(clamp(co2 / 1.0, 0, 1.15) * 62);
    }
    function balanceMols() {
      let alive = 0;
      for (const m of mols) if (m.state !== 'fall' && m.state !== 'fade') alive++;
      const target = molTarget();
      if (alive < target && mols.length < 90) {
        mols.push(newMol(true));
      } else if (alive > target) {
        /* trop de CO2 dans l'air : la pluie en entraîne vers les montagnes, ou il s'efface */
        let best = null, bd = 1e9;
        const aim = rand(G.w * 0.15, G.w * 0.75);
        for (const m of mols) {
          if (m.state !== 'float') continue;
          const d = Math.abs(m.x - aim);
          if (d < bd) {
            bd = d;
            best = m;
          }
        }
        if (!best) for (const m of mols) if (m.state === 'float' || m.state === 'rise') { best = m; break; }
        if (best) {
          if (rainK > 0.4 && mode !== 'froid') {
            best.state = 'fall';
            best.t = 0;
            best.x0 = best.x;
            best.y0 = best.y;
            best.hx = clamp(best.x + rand(-24, 24), G.w * 0.27, G.w * 0.6);
            best.hy = surfAt(best.hx) + 2;
            best.dur = rand(0.9, 1.4);
          } else {
            best.state = 'fade';
          }
        }
      }
    }

    /* ---- l'éruption ---- */
    function erupt() {
      lastErupt = time;
      act = 1;
      shake = api.reducedMotion ? 0 : 0.55;
      co2Pending += KICK;
      api.sfx.play('rumble', { pitch: rand(0.85, 1.1) });
      api.sfx.play('thud', { pitch: 0.8 });
      api.buzz(14);
      for (let i = 0; i < 44 && sparks.length < 120; i++) {
        sparks.push({
          x: G.cx + rand(-3, 3), y: G.rimY - 2, vx: rand(-75, 75), vy: -rand(150, 330),
          t: 0, life: rand(0.8, 1.5), r: rand(1.1, 2.6),
        });
      }
      for (let i = 0; i < 11; i++) {
        puffs.push({
          x: G.cx + rand(-6, 6), y: G.rimY - rand(0, 8), vx: rand(-22, 4), vy: -rand(48, 105),
          r: rand(7, 12), grow: rand(11, 21), t: -i * 0.07, life: rand(2.6, 3.8), spr: i % 3 === 2 ? 1 : 0, rot: rand(TAU),
        });
      }
      for (const dir of [-1, 1]) flows.push({ dir, t: 0, len: rand(0.5, 0.82), off: rand(-1.5, 1.5) });
      if (flows.length > 8) flows.splice(0, flows.length - 8);
      flashes.push({ x: G.cx, y: G.rimY, t: 0 });
    }

    function tapVolcano() {
      if (mode === 'feu') {
        if (time - lastErupt < 0.35 || erupts >= 3) return;
        erupts++;
        erupt();
        api.progress(erupts * 0.1);
        if (erupts < 3) {
          api.hint(erupts === 1 ? TEXTES.encore : TEXTES.derniere);
          api.status(TEXTES.eruption(erupts));
        } else {
          api.status(TEXTES.tropChaud);
          api.hint(TEXTES.regarde);
          setButton(null);
          mode = 'attente';
          waitT = 0;
        }
      } else if (mode === 'libre') {
        if (time - lastErupt < 0.5) return;
        erupt();
        watch = 'chaud';
        api.hint(TEXTES.regarde);
        api.status(TEXTES.chaud);
      } else {
        /* le volcan gronde, mais le thermostat est déjà au travail */
        puffs.push({ x: G.cx, y: G.rimY - 4, vx: rand(-8, 2), vy: -rand(30, 50), r: 6, grow: 10, t: 0, life: 1.6, spr: 1, rot: rand(TAU) });
        api.sfx.play('thud', { pitch: 1.2, volume: 0.4 });
      }
    }

    function startRegul() {
      mode = 'regul';
      regT = 0;
      regulOn = true;
      weatherOn = true;
      palier = 0;
      phrase = '';
      api.sfx.play('wind', { volume: 0.6 });
      api.guide(null, 'wow');
      updateRegStatus();
    }
    function updateRegStatus() {
      const p = Math.min(4, 1 + Math.floor(regT / 1.9));
      const ph = regT < 3.6 ? TEXTES.chaud : TEXTES.avalent;
      if (p === palier && ph === phrase) return;
      if (p !== palier && palier) api.sfx.play('tick', { pitch: 0.7, volume: 0.6 });
      palier = p;
      phrase = ph;
      api.status(ph + '\n' + TEXTES.temps(palier * 100000));
    }

    function startCold() {
      if (mode !== 'libre') return;
      mode = 'froid';
      coldT = 0;
      regulOn = false;
      watch = 'froid';
      setButton(null);
      api.hint(TEXTES.regardeFroid);
      api.status(TEXTES.froid);
      api.sfx.play('wind', { pitch: 1.4, volume: 0.6 });
      api.buzz(10);
    }

    btn.addEventListener('click', () => {
      if (btn.dataset.kind === 'froid') startCold();
      else tapVolcano();
    });

    function onVolcano(x, y) {
      return x < Math.max(G.w * 0.38, G.cx + 70) && y > G.rimY - 70 && y < G.h * 0.97;
    }
    api.track(cv.canvas, {
      down(p) {
        rings.push({ x: p.x, y: p.y, t: 0 });
      },
      up(p, e, cancelled) {
        if (cancelled || !p.tap) return;
        if (onVolcano(p.x, p.y)) {
          misses = 0;
          tapVolcano();
        } else {
          api.sfx.play('tick', { pitch: 0.8, volume: 0.6 });
          if (mode === 'feu' && ++misses >= 2) {
            misses = 0;
            showGesture();
          }
        }
      },
    }, { touchAction: 'pan-y' });

    function showGesture() {
      api.gesture('tap', { x: (G.cx / G.w) * 100, y: ((G.rimY + G.h * 0.07) / G.h) * 100 });
    }

    /* ---- animation ---- */
    function update(dt) {
      time += dt;

      /* les phases */
      if (mode === 'attente') {
        waitT += dt;
        if (waitT > 2.3 && co2Pending < 0.005) startRegul();
      } else if (mode === 'regul') {
        regT += dt;
        updateRegStatus();
        api.progress(0.3 + 0.68 * clamp((0.92 - temp) / 0.42));
        if (regT > 3 && Math.abs(temp - 0.5) < BAND) {
          mode = 'fin';
          doneT = 1.1;
          regT = Math.max(regT, 5.8);
          updateRegStatus();
          api.sfx.play('chime');
        }
      } else if (mode === 'fin') {
        doneT -= dt;
        if (doneT <= 0) {
          mode = 'libre';
          chipT = 1.8;
          api.done(TEXTES.fin, TEXTES.finStatut);
        }
      } else if (mode === 'froid') {
        coldT += dt;
        co2 += (0.03 - co2) * (1 - Math.exp(-dt * 3.2));
        if (coldT > 1.4) {
          mode = 'libre';
          regulOn = true;
        }
      }
      if (mode === 'libre') {
        if (chipT > 0) {
          chipT -= dt;
          if (chipT <= 0) setButton('froid');
        }
        if (watch && Math.abs(temp - 0.5) < BAND && co2Pending < 0.005 && time - lastErupt > 1.5) {
          watch = '';
          api.hint(TEXTES.encoreMilieu);
          api.sfx.play('chime', { volume: 0.7 });
          if (btn.hidden) chipT = 1.2;
        }
      }

      /* le modèle : les éruptions ajoutent du CO2, la pluie en avale */
      if (co2Pending > 0) {
        const r = Math.min(co2Pending, dt * Math.max(0.24, co2Pending * 1.3));
        co2 += r;
        co2Pending -= r;
      }
      if (regulOn) co2 += (V0 - WK * rainK) * dt;
      co2 = clamp(co2, 0, 1.15);
      const tEq = co2 >= C0 ? 0.5 + 0.6 * (co2 - C0) : 0.5 - 1.27 * (C0 - co2);
      temp += (tEq - temp) * (1 - Math.exp(-dt / 0.45));
      const wOn = weatherOn || mode === 'froid';
      const rainEq = wOn ? clamp(0.25 + 2.5 * (temp - 0.5)) : 0.25;
      rainK += (rainEq - rainK) * (1 - Math.exp(-dt / 0.6));
      const cloudEq = wOn ? clamp(0.45 + 1.25 * (temp - 0.5), 0.12, 1) : 0.45;
      cloudK += (cloudEq - cloudK) * (1 - Math.exp(-dt / 0.8));
      frostK += (clamp((0.38 - temp) / 0.2) - frostK) * (1 - Math.exp(-dt / 0.5));

      /* l'aiguille, montée sur un petit ressort */
      if (api.reducedMotion) {
        nv += (temp - nv) * (1 - Math.exp(-dt * 8));
      } else {
        nvV += ((temp - nv) * 70 - nvV * 10) * dt;
        nv += nvV * dt;
      }
      const tick = Math.round(clamp(nv) * 10);
      if (tick !== lastTick) {
        lastTick = tick;
        api.sfx.play('tick', { pitch: 0.8 + nv * 0.5, volume: 0.35, gap: 60 });
      }

      act = Math.max(0, act - dt * 0.45);
      shake = Math.max(0, shake - dt);

      /* le volcan fume toujours un peu ; quand il fait froid, il souffle plus fort */
      steamT -= dt;
      if (steamT <= 0) {
        steamT = rand(0.5, 0.9);
        puffs.push({ x: G.cx + rand(-3, 3), y: G.rimY - 3, vx: rand(-10, 2), vy: -rand(18, 30), r: 3, grow: rand(5, 8), t: 0, life: rand(2, 3), spr: 2, rot: rand(TAU), faint: true });
      }
      if (frostK > 0.15 || (mode === 'froid')) {
        puffT -= dt;
        if (puffT <= 0) {
          puffT = rand(0.9, 1.3);
          for (let i = 0; i < 3; i++) puffs.push({ x: G.cx + rand(-4, 4), y: G.rimY - 3, vx: rand(-14, 0), vy: -rand(35, 60), r: rand(5, 8), grow: rand(9, 14), t: -i * 0.1, life: rand(2.2, 3), spr: 1, rot: rand(TAU) });
          act = Math.max(act, 0.45);
          api.sfx.play('rumble', { pitch: 1.6, volume: 0.25, gap: 600 });
        }
      }

      balanceMols();

      /* molécules */
      let j = 0;
      for (const m of mols) {
        m.t += dt;
        m.rot += m.vr * dt * AMB;
        if (m.state === 'rise') {
          const k = clamp(m.t / m.dur);
          const e = ease.inOutSine(k);
          m.x = lerp(m.x0, m.hx, e) + Math.sin(k * Math.PI) * -18;
          m.y = lerp(m.y0, m.hy, ease.outCubic(k));
          m.a = Math.min(1, m.t * 3);
          if (k >= 1) {
            m.state = 'float';
            m.t = 0;
          }
        } else if (m.state === 'float') {
          m.hx += 3 * dt * AMB;
          if (m.hx > G.w + 10) m.hx -= G.w + 20;
          m.x += (m.hx + Math.sin(time * 0.5 + m.ph) * 9 * AMB - m.x) * Math.min(1, dt * 2);
          m.y += (m.hy + Math.cos(time * 0.43 + m.ph) * 6 * AMB - m.y) * Math.min(1, dt * 2);
          m.a = Math.min(1, m.a + dt * 1.5);
        } else if (m.state === 'fall') {
          const k = clamp(m.t / m.dur);
          m.x = lerp(m.x0, m.hx, k);
          m.y = lerp(m.y0, m.hy, ease.inQuad(k));
          if (k >= 1) {
            flashes.push({ x: m.x, y: m.y, t: 0, small: true });
            api.sfx.play('bubble', { pitch: rand(0.7, 1), volume: 0.25, gap: 140 });
            continue;
          }
        } else if (m.state === 'fade') {
          m.a -= dt * 1.6;
          if (m.a <= 0) continue;
        }
        mols[j++] = m;
      }
      mols.length = j;

      /* panache et étincelles */
      j = 0;
      for (const p of puffs) {
        p.t += dt;
        if (p.t < 0) {
          puffs[j++] = p;
          continue;
        }
        if (p.t >= p.life) continue;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy *= Math.exp(-dt * 0.55);
        p.r += p.grow * dt;
        puffs[j++] = p;
      }
      puffs.length = j;
      j = 0;
      for (const s of sparks) {
        s.t += dt;
        if (s.t >= s.life) continue;
        s.vy += 420 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        if (s.vy > 0 && s.y > surfAt(s.x) - 1) continue;
        sparks[j++] = s;
      }
      sparks.length = j;
      j = 0;
      for (const f of flows) if ((f.t += dt) < 7) flows[j++] = f;
      flows.length = j;

      /* la pluie tombe des nuages sur les montagnes */
      const rainRate = 260 * Math.pow(clamp(rainK), 1.5) * (1 - clamp((frostK - 0.4) / 0.3));
      rainT += dt * rainRate;
      while (rainT >= 1 && drops.length < 200) {
        rainT -= 1;
        const c = CLOUDS[Math.floor(Math.random() * 3)];
        const ct = cloudTex[c[2]];
        const sc = cloudScale();
        drops.push({ x: c[0] * G.w + rand(-0.36, 0.36) * ct.CW * sc, y: cloudY(c, ct.CH * sc) + ct.CH * 0.2 * sc, vy: rand(300, 400) });
      }
      if (rainT > 1) rainT = 0;
      j = 0;
      for (const d of drops) {
        d.y += d.vy * dt;
        d.x -= 26 * dt;
        if (d.y >= surfAt(d.x)) {
          if (splashes.length < 60) splashes.push({ x: d.x, y: surfAt(d.x), t: 0 });
          continue;
        }
        drops[j++] = d;
      }
      drops.length = j;
      j = 0;
      for (const s of splashes) if ((s.t += dt) < 0.3) splashes[j++] = s;
      splashes.length = j;
      if (rainK > 0.45) api.sfx.play('splash', { pitch: rand(1.4, 1.8), volume: 0.12 * rainK, gap: 380 });

      /* la pluie use la roche : des grains partent dans la rivière jusqu'à l'océan */
      grainT += dt * 16 * Math.pow(clamp(rainK), 2.2);
      while (grainT >= 1 && grains.length < 70) {
        grainT -= 1;
        grains.push({ s: rand(0, river.total * 0.35), v: rand(48, 72), state: 'river', x: 0, y: 0, vx: 0, vy: 0, t: 0, r: rand(1.3, 2.3), wob: rand(TAU) });
      }
      if (grainT > 1) grainT = 0;
      j = 0;
      for (const gr of grains) {
        gr.t += dt;
        if (gr.state === 'river') {
          gr.s += gr.v * (0.7 + rainK * 0.6) * dt;
          riverAt(gr.s, tmp);
          gr.x = tmp.x;
          gr.y = tmp.y - 0.6 + Math.sin(gr.t * 9 + gr.wob) * 0.5;
          if (gr.s >= river.total) {
            gr.state = 'sink';
            gr.vx = rand(16, 34);
            gr.vy = rand(10, 18);
            gr.t = 0;
          }
        } else if (gr.state === 'sink') {
          gr.vx *= Math.exp(-dt * 0.9);
          gr.vy = Math.min(gr.vy + 22 * dt, 34);
          gr.x = Math.min(G.w - 3, gr.x + gr.vx * dt);
          gr.y += gr.vy * dt;
          gr.x += Math.sin(gr.t * 3 + gr.wob) * 6 * dt;
          const fy = surfAt(gr.x) - limeThick(gr.x);
          if (gr.y >= fy) {
            gr.y = fy;
            gr.state = 'settle';
            gr.t = 0;
            limeK = Math.min(1, limeK + 0.0075);
            api.sfx.play('tick', { pitch: rand(1.6, 2), volume: 0.15, gap: 110 });
          }
        } else if (gr.t > 0.5) {
          continue;
        }
        grains[j++] = gr;
      }
      grains.length = j;

      j = 0;
      for (const r of rings) if ((r.t += dt) < 0.6) rings[j++] = r;
      rings.length = j;
      j = 0;
      for (const f of flashes) if ((f.t += dt) < 0.5) flashes[j++] = f;
      flashes.length = j;
    }

    function cloudScale() {
      return lerp(0.55, 1.28, cloudK);
    }
    /* les nuages restent sous le cadran */
    function cloudY(c, ch) {
      return Math.max(c[1] * G.h, G.domeB + ch * 0.55 + 3);
    }
    /* le calcaire s'entasse surtout au fond, très peu sur la pente */
    function limeThick(x) {
      const env = smooth(clamp((surfAt(x) - G.sea - G.h * 0.09) / (G.h * 0.1)));
      return lerp(1.2, G.limeMax, limeK) * (0.15 + 0.85 * env) * (0.92 + 0.08 * Math.sin(x * 0.13));
    }

    /* ---- dessin ---- */
    function drawSky() {
      const { w, h } = G;
      rampRGB(TOP_RGB, temp, cTop);
      rampRGB(LOW_RGB, temp, cLow);
      /* la brume teinte l'horizon */
      const hz = clamp(co2) * 0.35;
      cLow[0] = Math.round(lerp(cLow[0], 214, hz));
      cLow[1] = Math.round(lerp(cLow[1], 150, hz));
      cLow[2] = Math.round(lerp(cLow[2], 92, hz));
      const sk = ctx.createLinearGradient(0, 0, 0, h * PLAIN);
      sk.addColorStop(0, css(cTop, 1));
      sk.addColorStop(1, css(cLow, 1));
      ctx.fillStyle = sk;
      /* toute la scène est repeinte à chaque image (rien ne s'accumule) */
      ctx.fillRect(-6, -6, w + 12, h + 12);
      /* le Soleil, voilé par la brume */
      const veil = clamp(co2);
      ctx.globalAlpha = 1 - 0.35 * veil;
      ctx.drawImage(sunTex.c, w * 0.9 - sunTex.S, h * 0.1 - sunTex.S, sunTex.w, sunTex.h);
      ctx.globalAlpha = 1;
    }

    function drawHaze() {
      const { w, h } = G;
      const a = clamp(co2 / 1.0);
      const y0 = Math.round(h * 0.06 * cv.dpr) / cv.dpr;
      /* décalage arrondi au pixel de l'écran : la copie reste nette et rapide */
      const o1 = Math.round((((time * 7 * AMB) % w) + w) % w * cv.dpr) / cv.dpr;
      ctx.globalAlpha = clamp(0.08 + a * 0.85);
      ctx.drawImage(hazeA.c, o1 - w, y0, hazeA.w, hazeA.h);
      ctx.drawImage(hazeA.c, o1, y0, hazeA.w, hazeA.h);
      ctx.globalAlpha = 1;
    }

    function drawMols(sx, sy, front) {
      const dpr = cv.dpr;
      const S = 18;
      for (const m of mols) {
        if ((m.state === 'fall') !== front) continue;
        const a = clamp(m.a);
        if (a < 0.02) continue;
        const sc = m.sc * (m.state === 'fall' ? 1.1 : 1);
        const c = Math.cos(m.rot) * dpr * sc, s = Math.sin(m.rot) * dpr * sc;
        ctx.setTransform(c, s, -s, c, (m.x + sx) * dpr, (m.y + sy) * dpr);
        ctx.globalAlpha = a * (m.state === 'fall' ? 1 : 0.92);
        ctx.drawImage(molTex.c, -S / 2, -S / 2, S, S);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1;
    }

    function drawClouds() {
      const sc = cloudScale();
      const dark = clamp((rainK - 0.25) / 0.6);
      for (const c of CLOUDS) {
        const [u, , k] = c;
        const ct = cloudTex[k];
        const cw = ct.CW * sc, ch = ct.CH * sc;
        const x = u * G.w + Math.sin(time * 0.25 + k * 2) * 4 * AMB - cw / 2;
        const y = cloudY(c, ch) - ch * 0.55;
        ctx.globalAlpha = lerp(0.75, 1, clamp(cloudK * 1.6));
        ctx.drawImage(ct.light.c, x, y, cw, ch);
        if (dark > 0.01) {
          ctx.globalAlpha = dark * 0.9;
          ctx.drawImage(ct.dark.c, x, y, cw, ch);
        }
      }
      ctx.globalAlpha = 1;
    }

    function drawRain() {
      if (!drops.length && !splashes.length) return;
      ctx.beginPath();
      for (const d of drops) {
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + 26 * 0.032, d.y - d.vy * 0.032);
      }
      ctx.strokeStyle = 'rgba(190,228,250,0.7)';
      ctx.lineWidth = 1.3;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.fillStyle = 'rgba(200,235,250,0.7)';
      for (const s of splashes) {
        const k = s.t / 0.3;
        const r = 1 + 3 * k;
        ctx.globalAlpha = 1 - k;
        ctx.fillRect(s.x - r, s.y - 1 - 2 * k, 1.2, 1.2);
        ctx.fillRect(s.x + r - 1, s.y - 1 - 2 * k, 1.2, 1.2);
      }
      ctx.globalAlpha = 1;
    }

    function drawSnow() {
      if (frostK < 0.02) return;
      const { h } = G;
      const snowY = h * (PLAIN - 0.24) + h * 0.25 * frostK;
      ctx.beginPath();
      let open = false;
      const top = [];
      for (let x = 0; x <= G.shore; x += 3) {
        const y = surfAt(x);
        const th = clamp((snowY - y) * 0.4, 0, 7);
        const nearCrater = Math.abs(x - G.cx) < G.rimHW * 1.4;
        if (th > 0.3 && !nearCrater) {
          if (!open) {
            ctx.moveTo(x, y - 0.6);
            open = true;
            top.length = 0;
          }
          ctx.lineTo(x, y - 0.6);
          top.push(x, y + th);
        } else if (open) {
          for (let i = top.length - 2; i >= 0; i -= 2) ctx.lineTo(top[i], top[i + 1]);
          ctx.closePath();
          open = false;
        }
      }
      if (open) {
        for (let i = top.length - 2; i >= 0; i -= 2) ctx.lineTo(top[i], top[i + 1]);
        ctx.closePath();
      }
      ctx.fillStyle = `rgba(238,246,252,${clamp(frostK * 2.5) * 0.95})`;
      ctx.fill();
    }

    function drawRiver() {
      const P = river.P;
      const wid = lerp(2, 4.6, clamp(rainK));
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(P[0], P[1]);
      for (let i = 2; i < P.length; i += 2) ctx.lineTo(P[i], P[i + 1]);
      ctx.strokeStyle = 'rgba(22,70,92,0.9)';
      ctx.lineWidth = wid + 1.8;
      ctx.stroke();
      ctx.strokeStyle = frostK > 0.5 ? '#9CCBE0' : '#56B5DA';
      ctx.lineWidth = wid;
      ctx.stroke();
      ctx.setLineDash(DASH);
      ctx.lineDashOffset = -time * (24 + 40 * rainK) * AMB;
      ctx.strokeStyle = 'rgba(225,246,255,0.85)';
      ctx.lineWidth = Math.max(1, wid * 0.36);
      ctx.stroke();
      ctx.setLineDash(NODASH);
    }

    function drawFlows() {
      if (!flows.length) return;
      ctx.lineCap = 'round';
      for (const f of flows) {
        const grow = ease.outCubic(clamp(f.t / 1.6));
        const cool = clamp((f.t - 0.8) / 4);
        const fade = 1 - clamp((f.t - 5) / 2);
        const x0 = G.cx + f.dir * G.rimHW * 0.9;
        const x1 = G.cx + f.dir * (G.rimHW + VOLC.hw * G.w * f.len * grow);
        ctx.beginPath();
        const step = f.dir * 2;
        for (let x = x0; f.dir > 0 ? x <= x1 : x >= x1; x += step) ctx.lineTo(x, surfAt(x) + 1.4 + f.off * 0.3);
        ctx.globalAlpha = fade;
        ctx.strokeStyle = lib.mix('#FF7A2A', '#4A2219', cool);
        ctx.lineWidth = 3.4;
        ctx.stroke();
        if (cool < 0.9) {
          ctx.strokeStyle = lib.mix('#FFE08A', '#7A2E1C', cool);
          ctx.lineWidth = 1.3;
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }

    function drawMagma() {
      const glow = 0.2 + 0.8 * act;
      const pulse = 0.5 + 0.5 * Math.sin(time * 1.3);
      /* la cheminée : une fissure sombre où le magma monte */
      ctx.beginPath();
      const steps = 14;
      for (let i = 0; i <= steps; i++) {
        const k = i / steps;
        const y = lerp(G.chY - G.chRY * 0.6, G.cy + 1, k);
        ctx.lineTo(G.chX + Math.sin(k * 5 + 1) * 2.5, y);
      }
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(26,14,10,0.9)';
      ctx.lineWidth = 5.5;
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,104,40,${0.3 + 0.6 * glow})`;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,220,140,${0.12 + 0.85 * glow})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      /* la chambre : du magma qui bouillonne doucement */
      ctx.save();
      ctx.translate(G.chX, G.chY);
      ctx.scale(1, G.chRY / G.chRX);
      const R = G.chRX;
      const gr = ctx.createRadialGradient(-R * 0.25, -R * 0.3, 1, 0, 0, R);
      gr.addColorStop(0, `rgba(255,236,170,${0.8 + 0.2 * glow})`);
      gr.addColorStop(0.35, '#FFA03A');
      gr.addColorStop(0.75, '#D9481E');
      gr.addColorStop(1, '#7A2414');
      ctx.fillStyle = gr;
      draw.blob(ctx, 0, 0, R, 0.09, 2.1, time * 0.5 * AMB, 30);
      ctx.fill();
      ctx.strokeStyle = 'rgba(30,12,8,0.75)';
      ctx.lineWidth = 2.4;
      ctx.stroke();
      ctx.restore();
      ctx.globalCompositeOperation = 'lighter';
      draw.glow(ctx, G.chX, G.chY, G.chRX * 1.9, '#FF6A2A', 0.1 + 0.05 * pulse + 0.3 * act);
      /* le cratère rougeoie */
      draw.glow(ctx, G.cx, G.rimY + 3, 12 + 30 * act, '#FF8A3A', 0.3 + 0.12 * pulse + 0.55 * act);
      ctx.globalCompositeOperation = 'source-over';
    }

    function drawOcean(front) {
      const { w, h } = G;
      if (!front) {
        const sg = ctx.createLinearGradient(0, G.sea, 0, h * FLOOR);
        sg.addColorStop(0, frostK > 0.5 ? '#6FAFC4' : '#3C97AE');
        sg.addColorStop(1, '#0F3A4C');
        ctx.fillStyle = sg;
        ctx.fillRect(G.shore - 30, G.sea, w - G.shore + 34, h - G.sea + 2);
        /* rayons de lumière */
        ctx.globalAlpha = 0.07;
        ctx.fillStyle = '#DFF6FF';
        for (let i = 0; i < 4; i++) {
          const x = G.shore + (w - G.shore) * (0.15 + i * 0.24) + Math.sin(time * 0.4 + i) * 4 * AMB;
          ctx.beginPath();
          ctx.moveTo(x - 5, G.sea);
          ctx.lineTo(x + 5, G.sea);
          ctx.lineTo(x - 8, h * FLOOR);
          ctx.lineTo(x - 22, h * FLOOR);
          ctx.closePath();
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        return;
      }
      /* le calcaire au fond : une couche blanche qui s'épaissit */
      const xa = G.shore + 4;
      ctx.beginPath();
      ctx.moveTo(xa, surfAt(xa));
      for (let x = xa; x <= w + 3; x += 3) ctx.lineTo(x, surfAt(x) - limeThick(x));
      for (let x = w + 3; x >= xa; x -= 3) ctx.lineTo(x, surfAt(x) + 1.5);
      ctx.closePath();
      const T = lerp(1.5, G.limeMax, limeK);
      const lg = ctx.createLinearGradient(0, h * FLOOR - T, 0, h * FLOOR + 2);
      lg.addColorStop(0, '#F7F5EC');
      lg.addColorStop(1, '#D8D2C0');
      ctx.fillStyle = lg;
      ctx.fill();
      if (T > 6) {
        ctx.strokeStyle = 'rgba(150,140,118,0.35)';
        ctx.lineWidth = 0.8;
        for (const f of [0.35, 0.68]) {
          ctx.beginPath();
          for (let x = xa + G.w * 0.05; x <= w + 3; x += 4) ctx.lineTo(x, surfAt(x) - limeThick(x) * f);
          ctx.stroke();
        }
      }
      /* la surface de la mer */
      ctx.beginPath();
      for (let x = G.shore - 2; x <= w + 4; x += 4) ctx.lineTo(x, G.sea + Math.sin(x * 0.07 + time * 1.6 * AMB) * 1.1);
      ctx.strokeStyle = frostK > 0.5 ? 'rgba(240,250,255,0.9)' : 'rgba(220,246,255,0.75)';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }

    function drawGrains() {
      for (const gr of grains) {
        let col, a = 1;
        if (gr.state === 'river') col = '#A47E5A';
        else if (gr.state === 'sink') col = lib.mix('#A47E5A', '#F6F3EA', clamp(gr.t / 1.4));
        else {
          col = '#F6F3EA';
          a = 1 - gr.t / 0.5;
        }
        ctx.globalAlpha = a;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(gr.x, gr.y, gr.r, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function drawPuffs() {
      for (const p of puffs) {
        if (p.t < 0) continue;
        const k = p.t / p.life;
        const a = Math.min(1, p.t / 0.18) * Math.pow(1 - k, 1.3) * (p.faint ? 0.32 : 0.95);
        if (a < 0.01) continue;
        const spr = puffTex[p.spr];
        const s = p.r * 2.4;
        ctx.globalAlpha = a;
        ctx.drawImage(spr.c, p.x - s / 2, p.y - s / 2, s, s);
      }
      ctx.globalAlpha = 1;
      if (sparks.length) {
        ctx.globalCompositeOperation = 'lighter';
        for (const s of sparks) {
          const k = s.t / s.life;
          ctx.fillStyle = k < 0.4 ? '#FFE7A0' : lib.mix('#FFB347', '#FF4E2A', (k - 0.4) / 0.6, 1 - k * 0.6);
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r * (1 - k * 0.5), 0, TAU);
          ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
    }

    function drawGauge() {
      const { gcx, gcy, gR, gT } = G;
      ctx.drawImage(gaugeTex.c, 0, 0, gaugeTex.w, gaugeTex.h);
      const v = clamp(nv, -0.02, 1.02);
      const a = Math.PI + v * Math.PI;
      const c = Math.cos(a), s = Math.sin(a);
      rampRGB(RAMP_RGB, v, cNeedle);
      ctx.globalCompositeOperation = 'lighter';
      glowRGB(ctx, gcx + c * gR, gcy + s * gR, gT * 1.9, cNeedle, 0.55);
      if (v > 0.78) {
        const pulse = 0.5 + 0.5 * Math.sin(time * 6);
        glowRGB(ctx, gcx + gR, gcy, gT * 2.2, cNeedle, 0.25 * pulse * clamp((v - 0.78) / 0.1));
      }
      ctx.globalCompositeOperation = 'source-over';
      const L = gR - gT * 0.85, wd = Math.max(2.6, gT * 0.24);
      ctx.save();
      ctx.translate(gcx, gcy);
      ctx.rotate(a);
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = 5;
      ctx.shadowOffsetY = 2;
      ctx.beginPath();
      ctx.moveTo(-gT * 0.7, -wd);
      ctx.lineTo(L, -0.9);
      ctx.quadraticCurveTo(L + 3, 0, L, 0.9);
      ctx.lineTo(-gT * 0.7, wd);
      ctx.closePath();
      ctx.fillStyle = '#F4F2E8';
      ctx.fill();
      ctx.shadowColor = 'rgba(0,0,0,0)';
      ctx.beginPath();
      ctx.moveTo(L * 0.55, -wd * 0.45);
      ctx.lineTo(L, -0.5);
      ctx.lineTo(L, 0.5);
      ctx.lineTo(L * 0.55, wd * 0.45);
      ctx.closePath();
      ctx.fillStyle = css(cNeedle, 1);
      ctx.fill();
      ctx.restore();
      const hr = Math.max(6, gT * 0.55);
      const hg = ctx.createRadialGradient(gcx - hr * 0.35, gcy - hr * 0.4, 1, gcx, gcy, hr);
      hg.addColorStop(0, '#FFFFFF');
      hg.addColorStop(0.5, '#C9D2C6');
      hg.addColorStop(1, '#6E7C70');
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.arc(gcx, gcy, hr, 0, TAU);
      ctx.fill();
      ctx.fillStyle = css(cNeedle, 1);
      ctx.beginPath();
      ctx.arc(gcx, gcy, hr * 0.38, 0, TAU);
      ctx.fill();
    }

    function render() {
      const { w, h } = G;
      let sx = 0, sy = 0;
      if (shake > 0) {
        const k = shake / 0.55;
        sx = Math.sin(time * 53) * 2.2 * k;
        sy = Math.cos(time * 41) * 1.4 * k;
      }
      ctx.save();
      ctx.translate(sx, sy);
      drawSky();
      drawHaze();
      ctx.restore();
      drawMols(sx, sy, false);
      ctx.save();
      ctx.translate(sx, sy);
      drawClouds();
      drawOcean(false);
      ctx.drawImage(landTex.c, 0, 0, w, h);
      drawMagma();
      drawSnow();
      drawFlows();
      drawRiver();
      drawOcean(true);
      drawGrains();
      drawRain();
      drawPuffs();
      ctx.globalCompositeOperation = 'lighter';
      for (const f of flashes) {
        const k = f.t / 0.5;
        if (f.small) draw.glow(ctx, f.x, f.y, 4 + 8 * k, '#FFE2A8', 0.8 * (1 - k));
        else draw.glow(ctx, f.x, f.y, 20 + 50 * k, '#FFD27A', 0.9 * (1 - k));
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
      drawMols(sx, sy, true);
      drawGauge();
      for (const r of rings) {
        const k = r.t / 0.6;
        ctx.strokeStyle = `rgba(234,245,230,${0.8 * (1 - k)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(r.x, r.y, 6 + 28 * ease.outCubic(k), 0, TAU);
        ctx.stroke();
      }
    }

    function init() {
      mode = 'feu';
      co2 = C0;
      co2Pending = 0;
      temp = 0.5;
      rainK = 0.25;
      cloudK = 0.45;
      frostK = 0;
      limeK = 0.16;
      nv = 0.5;
      nvV = 0;
      lastTick = 5;
      regulOn = false;
      weatherOn = false;
      erupts = 0;
      lastErupt = -9;
      waitT = regT = coldT = 0;
      palier = 0;
      phrase = '';
      doneT = chipT = -1;
      watch = '';
      misses = 0;
      act = shake = 0;
      steamT = puffT = grainT = rainT = 0;
      puffs = [];
      sparks = [];
      flows = [];
      drops = [];
      splashes = [];
      grains = [];
      rings = [];
      flashes = [];
      mols = [];
      const n0 = molTarget();
      for (let i = 0; i < n0; i++) {
        const m = newMol(false);
        m.a = 1;
        mols.push(m);
      }
      /* un peu de pluie et quelques grains déjà en route : le paysage vit */
      for (let i = 0; i < 4; i++) grains.push({ s: rand(0, river.total), v: rand(48, 72), state: 'river', x: 0, y: 0, vx: 0, vy: 0, t: rand(1), r: rand(1.3, 2.3), wob: rand(TAU) });
      setButton('volcan');
      showGesture();
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
