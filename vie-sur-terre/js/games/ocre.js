/* Atelier d'ocre : peindre une paroi de grès avec quatre pigments minéraux,
   au doigt ou au pochoir (la main posée, la couleur soufflée autour). */
(function () {
  'use strict';
  const { lib } = window.RM;
  const { TAU, clamp, lerp, rand, ease, mix, hexToRgb } = lib;

  const TEXTES = {
    palette: 'Pigments',
    pigments: {
      rouge: { nom: 'Ocre rouge', info: 'De l’hématite, un oxyde de fer.' },
      jaune: { nom: 'Ocre jaune', info: 'De la goethite, un autre oxyde de fer.' },
      blanc: { nom: 'Argile blanche', info: 'De l’argile blanche, broyée très fin.' },
      charbon: { nom: 'Charbon', info: 'Du bois brûlé, broyé en poudre.' },
    },
    pochoir: { nom: 'Pochoir de main', info: 'Pose la main et souffle la couleur autour, comme les premiers artistes.' },
    consignePinceau: 'Peins sur la paroi avec ton doigt.',
    consignePochoir: 'Tape sur la paroi pour poser ta main.',
    statut: (pct) => `Ta fresque : ${pct} %`,
    enregistrer: 'Enregistrer',
    enregistrerAria: 'Enregistrer ta fresque en image',
    fichier: 'ma-fresque.png',
    fin: 'Belle fresque !',
    finStatut: 'Ton œuvre utilise les mêmes pigments que les plus anciennes peintures des humains.',
  };

  /* ink : couleur réellement déposée. Les pigments sombres se mélangent à la roche
     (multiply, encre éclaircie pour retomber sur la teinte voulue), les clairs la couvrent. */
  const PIGMENTS = [
    { id: 'rouge', swatch: '#9E3B22', ink: '#E2725C', mode: 'multiply', alpha: 1, dust: '#B44A2C' },
    { id: 'jaune', swatch: '#C98B2B', ink: '#DA9B34', mode: 'source-over', alpha: 0.88, dust: '#DDA445' },
    { id: 'blanc', swatch: '#EDE6D6', ink: '#F0E9DA', mode: 'source-over', alpha: 0.84, dust: '#F6F0E4' },
    { id: 'charbon', swatch: '#2A2421', ink: '#4A4440', mode: 'multiply', alpha: 0.96, dust: '#2E2724' },
  ];
  const PIG = {};
  PIGMENTS.forEach((p) => { PIG[p.id] = p; });

  const DONE_AT = 0.12;   /* part de la paroi à couvrir */
  const GX = 40, GY = 50; /* grille d'estimation de la surface peinte */

  /* ---- la main (unités locales : doigts vers le haut, pouce à droite) ---- */
  const PALM = { cx: 0, cy: 0.12, hx: 0.19, hy: 0.19, r: 0.11 };
  const FINGERS = [
    [-0.15, 0.0, -0.25, 0.24, 0.04],
    [-0.06, -0.05, -0.09, 0.31, 0.046],
    [0.035, -0.06, 0.03, 0.34, 0.048],
    [0.12, -0.04, 0.17, 0.3, 0.046],
    [0.16, 0.16, 0.92, 0.27, 0.056], /* pouce */
  ].map(([x, y, a, l, r]) => ({ ax: x, ay: y, bx: x + Math.sin(a) * l, by: y - Math.cos(a) * l, r }));
  const ARM = { ax: 0, ay: 0.3, bx: 0, by: 1.4, r: 0.135 };

  function sdSeg(px, py, s) {
    const pax = px - s.ax, pay = py - s.ay, bax = s.bx - s.ax, bay = s.by - s.ay;
    const h = clamp((pax * bax + pay * bay) / (bax * bax + bay * bay));
    const dx = pax - bax * h, dy = pay - bay * h;
    return Math.sqrt(dx * dx + dy * dy) - s.r;
  }
  function sdPalm(px, py) {
    const qx = Math.abs(px - PALM.cx) - PALM.hx + PALM.r;
    const qy = Math.abs(py - PALM.cy) - PALM.hy + PALM.r;
    const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
    return Math.sqrt(ox * ox + oy * oy) + Math.min(Math.max(qx, qy), 0) - PALM.r;
  }
  function smin(a, b, k) {
    const h = clamp(0.5 + 0.5 * (b - a) / k);
    return lerp(b, a, h) - k * h * (1 - h);
  }
  /* distance signée au bord de la main (négative dedans) */
  function handSd(px, py) {
    let d = smin(sdPalm(px, py), sdSeg(px, py, ARM), 0.06);
    for (let i = 0; i < FINGERS.length; i++) d = smin(d, sdSeg(px, py, FINGERS[i]), 0.028);
    return d;
  }
  function handSvg() {
    let s = '<svg viewBox="-0.43 -0.49 1.04 1.04" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-linecap="round">';
    s += `<rect x="${PALM.cx - PALM.hx}" y="${PALM.cy - PALM.hy}" width="${PALM.hx * 2}" height="${PALM.hy * 2}" rx="${PALM.r}" fill="currentColor" stroke="none"/>`;
    FINGERS.forEach((f) => {
      s += `<path d="M${f.ax.toFixed(3)} ${f.ay.toFixed(3)}L${f.bx.toFixed(3)} ${f.by.toFixed(3)}" stroke-width="${(f.r * 2).toFixed(3)}"/>`;
    });
    s += `<path d="M0 0.2L0 0.7" stroke-width="${ARM.r * 2}"/>`;
    return s + '</g></svg>';
  }

  /* ---- petits outils ---- */
  function smooth(e0, e1, x) {
    const t = clamp((x - e0) / (e1 - e0));
    return t * t * (3 - 2 * t);
  }
  /* bruit lent calculé sur une grille grossière, puis interpolé */
  function coarse(gw, gh, fn) {
    const a = new Float32Array((gw + 1) * (gh + 1));
    for (let j = 0; j <= gh; j++) for (let i = 0; i <= gw; i++) a[j * (gw + 1) + i] = fn(i / gw, j / gh);
    return a;
  }
  function sampleC(a, gw, gh, u, v) {
    const x = u * gw, y = v * gh;
    const i = Math.min(gw - 1, x | 0), j = Math.min(gh - 1, y | 0);
    const fx = x - i, fy = y - j, k = j * (gw + 1) + i;
    const top = a[k] + (a[k + 1] - a[k]) * fx;
    const bot = a[k + gw + 1] + (a[k + gw + 2] - a[k + gw + 1]) * fx;
    return top + (bot - top) * fy;
  }
  const ROCK = [[0, '#80593B'], [0.32, '#8E6446'], [0.74, '#AE8059'], [1, '#BC8E65']].map(([t, c]) => [t, hexToRgb(c)]);
  function rampRgb(t, out) {
    for (let i = 1; i < ROCK.length; i++) {
      if (t <= ROCK[i][0] || i === ROCK.length - 1) {
        const [t0, a] = ROCK[i - 1];
        const [t1, b] = ROCK[i];
        const k = clamp((t - t0) / (t1 - t0));
        out[0] = a[0] + (b[0] - a[0]) * k;
        out[1] = a[1] + (b[1] - a[1]) * k;
        out[2] = a[2] + (b[2] - a[2]) * k;
        return;
      }
    }
  }
  function mixInto(out, c, k) {
    out[0] += (c[0] - out[0]) * k;
    out[1] += (c[1] - out[1]) * k;
    out[2] += (c[2] - out[2]) * k;
  }

  /* ---- la paroi : couleur du grès (albédo, que la peinture recouvre) + carte de lumière
     (relief, grain, lampe, bords sombres) posée par-dessus la peinture à chaque affichage. */
  function buildWall(W, H) {
    const s = Math.min(0.75, 440 / Math.max(W, H));
    const RW = Math.max(8, Math.round(W * s)), RH = Math.max(8, Math.round(H * s));
    const m = Math.min(W, H);
    const nz = lib.makeNoise(23);
    const rnd = nz.rnd;
    const N = RW * RH;
    const gw = Math.ceil(RW / 4), gh = Math.ceil(RH / 4);
    const kx = W / m, ky = H / m;
    const AZ = coarse(gw, gh, (u, v) => nz.fbm(u * kx * 1.9 + 41.3, v * ky * 1.9 + 13.7, 3));
    const AG = coarse(gw, gh, (u, v) => nz.fbm(u * kx * 2.3 + 71.9, v * ky * 2.3 + 29.1, 3));
    const hgt = new Float32Array(N);
    const k1 = new Float32Array(N);
    const k2 = new Float32Array(N);
    const tooth = new Float32Array(N);
    for (let y = 0; y < RH; y++) {
      const fy = y / s, Y = fy / m;
      for (let x = 0; x < RW; x++) {
        const fx = x / s, X = fx / m;
        /* domaines tournés : pas de motif aligné sur la grille du bruit */
        const n1 = nz.fbm(X * 2.2 + Y * 1.35 + 4.1, Y * 2.2 - X * 1.35 + 7.3, 3);
        const n2 = nz.fbm(X * 7.1 - Y * 4.6 + 19.7, Y * 7.1 + X * 4.6 + 2.2, 3);
        const n3 = nz.noise2(x * 0.43 + y * 0.25 + 3.3, y * 0.43 - x * 0.25 + 8.1);
        const n4 = nz.noise2(X * 29 + Y * 16 + 51.3, Y * 29 - X * 16 + 12.9);
        const bed = Math.sin(Y * 17 + (n1 - 0.5) * 9 + (n2 - 0.5) * 2.4);
        const i = y * RW + x;
        hgt[i] = n1 * 15 + n2 * 10 + n4 * 1.6 + n3 * 0.5 + bed * 1.1; /* hauteur en px */
        k1[i] = n1;
        k2[i] = n2 + bed * 0.04;
        /* « dent » de la roche : le pigment accroche d'abord les bosses */
        tooth[i] = clamp(0.58 + (n2 - 0.5) * 1.5 + (n3 - 0.5) * 1.15);
      }
    }

    /* couleur du grès, taches minérales et coulées blanchâtres */
    const IRON = hexToRgb('#A65D3C'), GREY = hexToRgb('#9C8D7D');
    const stains = [['#4A3124', 0.5], ['#3E2B22', 0.4], ['#A9583A', 0.42], ['#E4D7C2', 0.3], ['#5B3B2A', 0.38], ['#B8703F', 0.32]]
      .map(([c, a]) => ({ x: rnd() * W, y: (0.05 + rnd() * 0.8) * H, r: m * (0.05 + rnd() * 0.11), sx: 0.6 + rnd() * 1.1, c: hexToRgb(c), a }));
    /* voiles de calcite : de larges coulées pâles, irrégulières */
    const drips = [0, 1].map(() => ({
      x: (0.2 + rnd() * 0.65) * W, y: rnd() * H * 0.2, len: H * (0.3 + rnd() * 0.3),
      wd: m * (0.035 + rnd() * 0.03), ph: rnd() * 6, c: hexToRgb('#E6DAC6'), a: 0.26,
    }));
    const alb = document.createElement('canvas');
    alb.width = RW;
    alb.height = RH;
    const ag = alb.getContext('2d');
    const aImg = ag.createImageData(RW, RH);
    const ad = aImg.data;
    const col = [0, 0, 0];
    const toothC = document.createElement('canvas');
    toothC.width = RW;
    toothC.height = RH;
    const tg = toothC.getContext('2d');
    const tImg = tg.createImageData(RW, RH);
    const td = tImg.data;
    for (let y = 0; y < RH; y++) {
      const v = y / (RH - 1), fy = y / s;
      for (let x = 0; x < RW; x++) {
        const u = x / (RW - 1), fx = x / s;
        const i = y * RW + x;
        const n1 = k1[i], n2 = k2[i];
        td[i * 4 + 3] = 255 * lerp(0.5, 1, tooth[i]);
        rampRgb(clamp(0.52 + (n1 - 0.5) * 1.8 + (n2 - 0.5) * 0.6), col);
        mixInto(col, IRON, smooth(0.5, 0.72, sampleC(AZ, gw, gh, u, v)) * 0.42);
        mixInto(col, GREY, smooth(0.55, 0.78, sampleC(AG, gw, gh, u, v)) * 0.32);
        for (let k = 0; k < stains.length; k++) {
          const st = stains[k];
          const dx = (fx - st.x) / (st.r * st.sx), dy = (fy - st.y) / st.r;
          if (dx > 1.7 || dx < -1.7 || dy > 1.7 || dy < -1.7) continue;
          const kk = smooth(1, 0.3, Math.sqrt(dx * dx + dy * dy) + (n2 - 0.5) * 1.1) * st.a;
          if (kk > 0) mixInto(col, st.c, kk);
        }
        for (let k = 0; k < drips.length; k++) {
          const dr = drips[k];
          if (fy < dr.y || fy > dr.y + dr.len) continue;
          const off = fx - (dr.x + Math.sin(fy * 0.017 + dr.ph) * 14 + (n1 - 0.5) * 30);
          const wd = dr.wd * (0.55 + 0.9 * n1) * (0.7 + 0.6 * (fy - dr.y) / dr.len);
          const veil = smooth(0.38, 0.72, n2 + (k1[i] - 0.5) * 0.3);
          const kk = Math.exp(-(off * off) / (wd * wd)) * smooth(dr.y, dr.y + 40, fy) *
            (1 - smooth(dr.y + dr.len * 0.3, dr.y + dr.len, fy)) * dr.a * veil;
          if (kk > 0.004) mixInto(col, dr.c, kk);
        }
        const f = 0.965 + 0.07 * rnd();
        const j = i * 4;
        ad[j] = col[0] * f;
        ad[j + 1] = col[1] * f;
        ad[j + 2] = col[2] * f;
        ad[j + 3] = 255;
      }
    }
    ag.putImageData(aImg, 0, 0);
    tg.putImageData(tImg, 0, 0);

    /* éclairage : une lampe à graisse posée à gauche, lumière rasante qui fait ressortir le relief.
       Carte lue en mode 'hard-light' : 128 = neutre, plus sombre = ombre, plus clair = reflet. */
    const light = document.createElement('canvas');
    light.width = RW;
    light.height = RH;
    const lg = light.getContext('2d');
    const lImg = lg.createImageData(RW, RH);
    const ld = lImg.data;
    const LX = -0.14 * W, LY = 0.6 * H, LZ = 0.45 * m;
    const fall = 0.95 * Math.max(W, H * 0.9);
    const GR = 0.95 * W;
    for (let y = 0; y < RH; y++) {
      const fy = y / s;
      const yu = y > 0 ? -RW : 0, yd = y < RH - 1 ? RW : 0;
      const sy = s / ((yd - yu) / RW || 1);
      for (let x = 0; x < RW; x++) {
        const fx = x / s;
        const i = y * RW + x;
        const xl = x > 0 ? -1 : 0, xr = x < RW - 1 ? 1 : 0;
        const gx = (hgt[i + xr] - hgt[i + xl]) * s / (xr - xl || 1);
        const gy = (hgt[i + yd] - hgt[i + yu]) * sy;
        const nl = 1 / Math.sqrt(gx * gx + gy * gy + 1);
        let lx = LX - fx, ly = LY - fy, lz = LZ;
        const dd = Math.sqrt(lx * lx + ly * ly + lz * lz);
        lx /= dd; ly /= dd; lz /= dd;
        const diff = Math.max(0, (-gx * lx - gy * ly + lz) * nl);
        const rel = clamp(diff / lz, 0.12, 2.6);
        const att = 1 / (1 + (dd / fall) * (dd / fall));
        const vx = (fx / W - 0.5) / 0.6, vy = (fy / H - 0.5) / 0.64;
        const vig = 1 - 0.45 * smooth(0.6, 1.15, Math.sqrt(vx * vx + vy * vy));
        const lum = (0.3 + 0.75 * att) * vig;
        let gr = 1 - 0.07 * rnd();
        if (rnd() < 0.005) gr *= 0.55 + 0.3 * rnd();
        const base = lum * lerp(1, Math.min(rel, 1), 0.82) * gr;
        const hi = Math.max(0, rel - 1) * att * 0.55;
        const gk = Math.max(0, 1 - Math.hypot(fx - LX, fy - LY) / GR);
        const glow = gk * gk * 0.32;
        const j = i * 4;
        ld[j] = 127.5 * Math.min(2, base + hi * 0.9 + glow);
        ld[j + 1] = 127.5 * Math.min(2, base * (0.86 + 0.1 * lum) + hi * 0.66 + glow * 0.62);
        ld[j + 2] = 127.5 * Math.min(2, base * (0.7 + 0.18 * lum) + hi * 0.42 + glow * 0.25);
        ld[j + 3] = 255;
      }
    }
    lg.putImageData(lImg, 0, 0);

    /* fissures : de simples lignes brisées, dessinées plus tard à pleine résolution */
    const cracks = [];
    function grow(x, y, a0, len, w0, depth) {
      const pts = [x, y];
      let a = a0;
      for (let d = 0; d < len; d += 3) {
        a += (rnd() - 0.5) * 0.55 + (a0 - a) * 0.06;
        x += Math.cos(a) * 3;
        y += Math.sin(a) * 3;
        pts.push(x, y);
        if (depth < 2 && rnd() < 0.02) {
          grow(x, y, a + (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd() * 0.7), len * (0.2 + rnd() * 0.3), w0 * 0.62, depth + 1);
        }
      }
      cracks.push({ pts, w0 });
    }
    grow(W * (0.55 + rnd() * 0.2), -4, Math.PI * (0.5 + (rnd() - 0.5) * 0.3), H * 0.55, 1.7, 0);
    grow(W + 4, H * (0.15 + rnd() * 0.2), Math.PI * (0.85 + rnd() * 0.1), W * 0.5, 1.4, 0);
    grow(W * (0.1 + rnd() * 0.25), H * (0.45 + rnd() * 0.2), -Math.PI * (0.3 + rnd() * 0.2), W * 0.35, 1.2, 0);
    grow(W * (0.3 + rnd() * 0.4), H + 4, -Math.PI * (0.5 + (rnd() - 0.5) * 0.4), H * 0.4, 1.5, 0);
    return { alb, light, tooth: toothC, cracks, lamp: { x: LX, y: LY, r: GR } };
  }

  /* ---- tampons de pinceau : grains, bords irréguliers ---- */
  let MASKS = null;
  function makeStampMasks() {
    const out = [];
    const N = 64;
    for (let v = 0; v < 4; v++) {
      const c = document.createElement('canvas');
      c.width = c.height = N;
      const g = c.getContext('2d');
      const img = g.createImageData(N, N);
      const d = img.data;
      const nz = lib.makeNoise(101 + v * 17);
      const rnd = nz.rnd;
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          const u = ((x + 0.5) / N) * 2 - 1, w = ((y + 0.5) / N) * 2 - 1;
          const r = Math.sqrt(u * u + w * w);
          const a = Math.atan2(w, u);
          const edge = 0.62 + 0.24 * (nz.fbm(Math.cos(a) * 1.4 + 5, Math.sin(a) * 1.4 + 5, 3) - 0.5);
          let al = clamp((edge - r) / 0.14 + 0.35);
          al *= 0.5 + 0.7 * nz.noise2(x * 0.5, y * 0.5);
          if (rnd() < 0.14) al *= 0.3;
          if (r > edge && r < 0.98 && rnd() < 0.045) al = Math.max(al, 0.35 + 0.4 * rnd());
          const j = (y * N + x) * 4;
          d[j] = d[j + 1] = d[j + 2] = 255;
          d[j + 3] = clamp(al) * 255;
        }
      }
      g.putImageData(img, 0, 0);
      out.push(c);
    }
    return out;
  }

  const CSS = `
    .game[data-game="ocre"] .game-canvas { cursor: crosshair; }
    .game[data-game="ocre"] .oc-tray {
      position: absolute; z-index: 3; left: 8px; right: 8px; bottom: 8px;
      display: flex; gap: 5px; padding: 5px;
      border-radius: 22px 26px 24px 20px / 20px 24px 26px 22px;
      background: rgba(24, 15, 11, 0.66);
      -webkit-backdrop-filter: blur(8px) saturate(1.2); backdrop-filter: blur(8px) saturate(1.2);
      box-shadow: 0 10px 24px -12px rgba(0, 0, 0, 0.8), inset 0 0 0 1px rgba(246, 232, 216, 0.1);
    }
    .game[data-game="ocre"] .oc-chip {
      flex: 1 1 0; min-width: 0; flex-direction: column; justify-content: flex-start; gap: 4px;
      min-height: 62px; padding: 7px 3px 6px;
      border-radius: 15px 18px 16px 17px;
      background: rgba(246, 232, 216, 0.06); color: #F6E8D8; box-shadow: none;
      font-size: 0.75rem; line-height: 1.12; text-align: center;
      transition: background-color 0.2s, box-shadow 0.2s;
    }
    .game[data-game="ocre"] .oc-chip:hover { background: rgba(246, 232, 216, 0.12); }
    .game[data-game="ocre"] .oc-chip[aria-pressed="true"] {
      background: rgba(246, 232, 216, 0.17);
      box-shadow: 0 0 0 2.5px #E8B54D, 0 0 18px -2px rgba(232, 181, 77, 0.55);
    }
    .game[data-game="ocre"] .oc-chip.is-ink { box-shadow: inset 0 0 0 1.5px rgba(246, 232, 216, 0.45); }
    .game[data-game="ocre"] .oc-dot {
      flex: none; width: 24px; height: 24px; border-radius: 50% 46% 52% 48%;
      background: radial-gradient(circle at 34% 30%, var(--cl) 0, var(--c) 48%, var(--cd) 100%);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.45), inset 0 -2px 3px rgba(0, 0, 0, 0.22);
    }
    .game[data-game="ocre"] .oc-dot--hand {
      border-radius: 50%; overflow: hidden; box-shadow: none; color: #EBCFAE;
      background: radial-gradient(circle, var(--c) 0 42%, rgba(0, 0, 0, 0) 74%);
    }
    .game[data-game="ocre"] .oc-dot--hand svg { display: block; width: 100%; height: 100%; }
    .game[data-game="ocre"] .oc-name { display: block; max-width: 100%; text-wrap: balance; }
    .game[data-game="ocre"] .oc-tip {
      position: absolute; left: 50%; bottom: calc(100% + 8px);
      width: max-content; max-width: min(calc(100% - 8px), 21rem);
      margin: 0; padding: 8px 12px 9px;
      border-radius: 14px 17px 15px 13px;
      background: rgba(20, 12, 9, 0.9); color: #F6E8D8;
      font-size: 0.875rem; line-height: 1.35; text-align: center;
      box-shadow: 0 8px 20px -10px rgba(0, 0, 0, 0.8), inset 0 0 0 1px rgba(246, 232, 216, 0.08);
      opacity: 0; transform: translate(-50%, 6px);
      transition: opacity 0.25s, transform 0.25s; pointer-events: none;
    }
    .game[data-game="ocre"] .oc-tip.is-on { opacity: 1; transform: translate(-50%, 0); }
    .game[data-game="ocre"] .oc-tip strong { display: block; color: #E8B54D; font-size: 0.8125rem; letter-spacing: 0.01em; }
    .game[data-game="ocre"] .oc-save {
      position: absolute; z-index: 3; top: 10px; right: 10px;
      gap: 6px; padding: 8px 13px 8px 10px;
      background: rgba(24, 15, 11, 0.62); color: #F6E8D8;
      -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
      box-shadow: inset 0 0 0 1px rgba(246, 232, 216, 0.16);
      font-size: 0.875rem; transition: background-color 0.2s;
    }
    .game[data-game="ocre"] .oc-save:hover { background: rgba(24, 15, 11, 0.8); }
    .game[data-game="ocre"] .oc-save.is-saved { background: rgba(232, 181, 77, 0.3); }
    .game[data-game="ocre"] .oc-save[hidden] { display: none; }
    .game[data-game="ocre"] .oc-save svg {
      width: 18px; height: 18px; fill: none; stroke: currentColor;
      stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;
    }
    @media (min-width: 700px) {
      .game[data-game="ocre"] .oc-chip { font-size: 0.8125rem; min-height: 66px; }
      .game[data-game="ocre"] .oc-dot { width: 26px; height: 26px; }
    }
    .game[data-game="ocre"] .oc-narrow .oc-tray { left: 6px; right: 6px; bottom: 6px; gap: 3px; padding: 4px; }
    .game[data-game="ocre"] .oc-narrow .oc-chip { font-size: 0.6875rem; padding: 6px 1px 5px; letter-spacing: -0.01em; }
    .game[data-game="ocre"] .oc-narrow .oc-save { top: 8px; right: 8px; padding: 7px 11px 7px 9px; font-size: 0.8125rem; }
    .game[data-game="ocre"] .oc-short .oc-chip { min-height: 46px; padding: 4px 2px; }
    .game[data-game="ocre"] .oc-short .oc-name { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    .game[data-game="ocre"] .oc-short .oc-dot { width: 28px; height: 28px; }
  `;

  window.RM.games.ocre = function (api) {
    const stage = api.stage;
    const cv = api.canvas();
    const ctx = cv.ctx;
    api.style(CSS);
    if (!MASKS) MASKS = makeStampMasks();

    /* ---- état ---- */
    let wall = null;              /* albédo, carte de lumière, fissures */
    let surface = null, sctx = null;     /* paroi + peinture, pleine résolution */
    let lightFull = null;         /* carte de lumière pleine résolution (mode hard-light) */
    let strokeBuf = null, bctx = null;   /* trait en cours, avant d'être fixé sur la paroi */
    let toothBuf = null, tctx = null;    /* trait filtré par le grain de la roche */
    let bufPig = null;
    let bufUsed = false;
    let pigment = PIG.rouge;
    let tool = 'pinceau';
    let painted = 0;
    let dirty = true;
    let time = 0;
    let hover = null;
    let nextHand = null;
    let baseR = 15;
    let shownPct = -1;
    const grid = new Uint8Array(GX * GY);
    const strokes = new Map();
    const sprays = [];
    const tints = {};
    const fnz = lib.makeNoise(77);

    /* ---- particules (réserve fixe, réutilisée) ---- */
    const POOL = 280;
    const parts = [];
    for (let i = 0; i < POOL; i++) parts.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, g: 0, t: 0, life: 1, s: 1, a: 1, col: '#fff', drag: 0.3 });
    let pIdx = 0;
    let pLive = 0;
    function emit(x, y, vx, vy, g, life, s, a, col, drag) {
      const p = parts[pIdx];
      pIdx = (pIdx + 1) % POOL;
      p.on = true;
      p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.g = g;
      p.t = 0; p.life = life; p.s = s; p.a = a; p.col = col;
      p.drag = drag == null ? 0.3 : drag;
    }

    /* ---- calques ---- */
    function layer() {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(cv.w * cv.dpr));
      c.height = Math.max(1, Math.round(cv.h * cv.dpr));
      return c;
    }
    function scaled(c) {
      const g = c.getContext('2d');
      g.setTransform(cv.dpr, 0, 0, cv.dpr, 0, 0);
      return g;
    }
    function paintBase() {
      sctx.globalCompositeOperation = 'source-over';
      sctx.globalAlpha = 1;
      sctx.imageSmoothingEnabled = true;
      sctx.drawImage(wall.alb, 0, 0, cv.w, cv.h);
    }
    function strokeCracks(g, wk, ox, oy, color) {
      g.strokeStyle = color;
      g.lineCap = 'round';
      for (const c of wall.cracks) {
        const n = c.pts.length / 2;
        for (let k = 1; k < n; k++) {
          g.lineWidth = Math.max(0.35, c.w0 * wk * Math.pow(Math.sin(Math.PI * k / n), 0.5));
          g.beginPath();
          g.moveTo(c.pts[k * 2 - 2] + ox, c.pts[k * 2 - 1] + oy);
          g.lineTo(c.pts[k * 2] + ox, c.pts[k * 2 + 1] + oy);
          g.stroke();
        }
      }
    }
    function buildLightFull() {
      const c = layer();
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = true;
      g.drawImage(wall.light, 0, 0, c.width, c.height);
      /* grain fin du grès, à la résolution de l'écran */
      const img = g.getImageData(0, 0, c.width, c.height);
      const d = img.data;
      const rnd = lib.makeNoise(5).rnd;
      for (let i = 0; i < d.length; i += 4) {
        let k = 0.95 + rnd() * 0.1;
        const r = rnd();
        if (r < 0.0025) k *= 0.7;
        else if (r > 0.998) k *= 1.18;
        d[i] = Math.min(255, d[i] * k);
        d[i + 1] = Math.min(255, d[i + 1] * k);
        d[i + 2] = Math.min(255, d[i + 2] * k);
      }
      g.putImageData(img, 0, 0);
      g.setTransform(cv.dpr, 0, 0, cv.dpr, 0, 0);
      /* fissures : creux dans l'ombre, lèvre éclairée du côté de la lampe */
      strokeCracks(g, 3.6, -0.6, 0.2, 'rgba(46,28,18,0.16)');
      strokeCracks(g, 1, -0.3, 0, 'rgba(22,12,8,0.62)');
      strokeCracks(g, 0.6, 0.9, 0.4, 'rgba(255,222,176,0.24)');
      return c;
    }
    function buildFlicker() {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const g = c.getContext('2d');
      const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,170,80,1)');
      gr.addColorStop(0.4, 'rgba(255,140,60,0.45)');
      gr.addColorStop(1, 'rgba(255,120,40,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 128, 128);
      return c;
    }

    /* silhouette de la main : ombre portée pendant le pochoir et aperçu au survol */
    const SIL = { x: -0.47, y: -0.58, s: 1.12 };
    function makeSil(color, outline) {
      const N = 168;
      const c = document.createElement('canvas');
      c.width = c.height = N;
      const g = c.getContext('2d');
      const img = g.createImageData(N, N);
      const d = img.data;
      const [r, gg, b] = hexToRgb(color);
      const px = SIL.s / N;
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          const lx = SIL.x + (x + 0.5) * px, ly = SIL.y + (y + 0.5) * px;
          const sd = handSd(lx, ly);
          let a = outline ? clamp(1 - Math.abs(sd + px) / (px * 1.6)) : clamp(0.5 - sd / (px * 1.4));
          a *= 1 - smooth(0.36, 0.54, ly);
          const j = (y * N + x) * 4;
          d[j] = r; d[j + 1] = gg; d[j + 2] = b; d[j + 3] = a * 255;
        }
      }
      g.putImageData(img, 0, 0);
      return c;
    }
    let silShadow = null, silLine = null; /* créées au premier usage */

    function tintFor(pig) {
      if (tints[pig.id]) return tints[pig.id];
      tints[pig.id] = MASKS.map((m) => {
        const c = document.createElement('canvas');
        c.width = m.width;
        c.height = m.height;
        const g = c.getContext('2d');
        g.drawImage(m, 0, 0);
        g.globalCompositeOperation = 'source-in';
        g.fillStyle = pig.ink;
        g.fillRect(0, 0, c.width, c.height);
        return c;
      });
      return tints[pig.id];
    }

    /* ---- surface peinte (grille d'échantillonnage) ---- */
    function markCell(i, j) {
      const k = j * GX + i;
      if (grid[k]) return false;
      grid[k] = 1;
      painted++;
      return true;
    }
    function markDisc(x, y, r) {
      const cw = cv.w / GX, ch = cv.h / GY;
      const i0 = Math.max(0, Math.floor((x - r) / cw)), i1 = Math.min(GX - 1, Math.floor((x + r) / cw));
      const j0 = Math.max(0, Math.floor((y - r) / ch)), j1 = Math.min(GY - 1, Math.floor((y + r) / ch));
      let changed = false;
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const dx = (i + 0.5) * cw - x, dy = (j + 0.5) * ch - y;
          if (dx * dx + dy * dy <= r * r && markCell(i, j)) changed = true;
        }
      }
      if (changed) progressChanged();
    }
    function progressChanged() {
      if (api.isDone()) return;
      const target = GX * GY * DONE_AT;
      api.progress(painted / target);
      const pct = Math.min(100, Math.round((painted / target) * 100));
      if (pct !== shownPct && pct < 100) {
        shownPct = pct;
        api.status(TEXTES.statut(pct));
      }
      if (painted >= target) {
        api.done(TEXTES.fin, TEXTES.finStatut);
        dirty = true;
      }
    }

    /* ---- pinceau ---- */
    /* le pigment accroche d'abord les bosses du grès : trait × « dent » de la roche */
    function toothed(src) {
      tctx.globalCompositeOperation = 'copy';
      tctx.drawImage(src, 0, 0);
      tctx.globalCompositeOperation = 'destination-in';
      tctx.drawImage(wall.tooth, 0, 0, toothBuf.width, toothBuf.height);
      tctx.globalCompositeOperation = 'source-over';
      return toothBuf;
    }
    function bake() {
      if (!bufUsed || !bufPig) return;
      sctx.globalCompositeOperation = bufPig.mode;
      sctx.globalAlpha = bufPig.alpha;
      sctx.drawImage(toothed(strokeBuf), 0, 0, cv.w, cv.h);
      sctx.globalAlpha = 1;
      sctx.globalCompositeOperation = 'source-over';
      bctx.setTransform(1, 0, 0, 1, 0, 0);
      bctx.clearRect(0, 0, strokeBuf.width, strokeBuf.height);
      bctx.setTransform(cv.dpr, 0, 0, cv.dpr, 0, 0);
      bufUsed = false;
      dirty = true;
    }
    function stampAt(x, y, r, a) {
      if (bufPig !== pigment) {
        bake();
        bufPig = pigment;
      }
      const t = tintFor(pigment);
      const img = t[(Math.random() * t.length) | 0];
      const rot = Math.random() * TAU;
      const c = Math.cos(rot) * cv.dpr, s = Math.sin(rot) * cv.dpr;
      bctx.setTransform(c, s, -s, c, x * cv.dpr, y * cv.dpr);
      bctx.globalAlpha = clamp(a);
      bctx.drawImage(img, -r, -r, r * 2, r * 2);
      /* quelques éclaboussures au bord du trait */
      if (Math.random() < 0.05) {
        const ang = Math.random() * TAU, dd = r * rand(1.05, 1.6), sr = r * rand(0.08, 0.2);
        bctx.globalAlpha = clamp(a * 1.4);
        bctx.drawImage(img, Math.cos(ang) * dd - sr, Math.sin(ang) * dd - sr, sr * 2, sr * 2);
      }
      bctx.globalAlpha = 1;
      bctx.setTransform(cv.dpr, 0, 0, cv.dpr, 0, 0);
      bufUsed = true;
      dirty = true;
      markDisc(x, y, r * 0.6);
    }
    function dab(st) {
      for (let i = 0; i < 4; i++) {
        stampAt(st.x + rand(-1.5, 1.5), st.y + rand(-1.5, 1.5), baseR * rand(0.88, 1.04), 0.42);
      }
    }
    function strokeTo(st, x, y, now) {
      const dx = x - st.x, dy = y - st.y;
      const len = Math.hypot(dx, dy);
      if (len < 0.5) return;
      const ms = Math.max(4, now - st.t);
      st.v = lerp(st.v, (len / ms) * 1000, 0.3);
      const k = clamp(st.v / 1500);
      const r1 = baseR * lerp(1.06, 0.72, k);
      const a1 = lerp(0.56, 0.2, k) * st.load;
      const r0 = st.r, a0 = st.a;
      let d = st.left;
      while (d <= len) {
        const t = d / len;
        const jx = rand(-0.06, 0.06) * r1, jy = rand(-0.06, 0.06) * r1;
        stampAt(st.x + dx * t + jx, st.y + dy * t + jy, lerp(r0, r1, t) * rand(0.92, 1.06), lerp(a0, a1, t));
        d += Math.max(1.6, lerp(r0, r1, t) * 0.4);
      }
      st.left = d - len;
      st.r = r1;
      st.a = a1;
      st.dist += len;
      st.load = Math.max(0.62, 1 - st.dist / (cv.w * 6));
      /* un peu de poudre qui tombe du doigt */
      st.dust += len;
      while (st.dust > 16) {
        st.dust -= 16;
        if (!api.reducedMotion) {
          emit(x + rand(-0.6, 0.6) * r1, y + rand(-0.4, 0.6) * r1, rand(-8, 8), rand(5, 25), 80,
            rand(0.5, 1.1), rand(0.8, 1.8), rand(0.5, 0.9), pigment.dust);
        }
      }
      st.x = x;
      st.y = y;
      st.t = now;
      api.sfx.play('scrape', { pitch: lerp(0.85, 1.25, k), volume: lerp(0.35, 0.7, k), gap: 120 });
    }

    /* ---- pochoir : la main posée reste vierge, la couleur est soufflée autour ---- */
    function handScale() {
      return clamp(0.32 * Math.min(cv.w, cv.h * 1.1), 70, 210);
    }
    function newHand() {
      return { rot: rand(-0.28, 0.28), flip: Math.random() < 0.5 ? -1 : 1 };
    }
    function drawSil(img, x, y, hand, S, a, ox, oy) {
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(x + ox, y + oy);
      ctx.rotate(hand.rot);
      ctx.scale(S * hand.flip, S);
      ctx.drawImage(img, SIL.x, SIL.y, SIL.s, SIL.s);
      ctx.restore();
    }
    function makeSpray(x, y, pig, hand) {
      const S = handScale();
      const R = S * 0.98;
      const q = Math.min(cv.dpr, 1.5);
      const N = Math.max(8, Math.ceil(R * 2 * q));
      const tex = document.createElement('canvas');
      tex.width = tex.height = N;
      const g = tex.getContext('2d');
      const img = g.createImageData(N, N);
      const d = img.data;
      const col = hexToRgb(pig.ink);
      const cos = Math.cos(hand.rot), sin = Math.sin(hand.rot);
      const inv = 1 / S, fl = hand.flip;
      const step = (R * 2) / N;
      const halo = 0.1 * S, reach = 0.5 * S;
      const seed = rand(0, 200);
      const edges = [];
      let r = (Math.random() * 4294967296) >>> 0;
      for (let j = 0; j < N; j++) {
        const wy = -R + (j + 0.5) * step;
        for (let i = 0; i < N; i++) {
          const wx = -R + (i + 0.5) * step;
          const lx = (wx * cos + wy * sin) * inv * fl;
          const ly = (-wx * sin + wy * cos) * inv;
          if (ly > 0.9 || ly < -0.95 || lx > 0.95 || lx < -0.8) continue;
          const sd = handSd(lx, ly) * S;
          if (sd < -1 || sd > reach) continue;
          const n = fnz.fbm((x + wx) * 0.05 + seed, (y + wy) * 0.05, 3);
          let dens = Math.exp(-Math.max(0, sd) / (halo * (0.5 + 1.0 * n)));
          dens *= 1 - smooth(reach * 0.4, reach, sd + (n - 0.5) * reach * 0.8);
          dens *= 1 - smooth(0.3, 0.6, ly + (n - 0.5) * 0.22);
          if (dens < 0.004) continue;
          r = (r * 1664525 + 1013904223) >>> 0;
          const u = r / 4294967296;
          let a = dens * 0.95 + (u < dens * 0.9 ? 0.25 + 0.35 * u : 0);
          a *= smooth(-1, 1.6, sd);
          const k = (j * N + i) * 4;
          d[k] = col[0];
          d[k + 1] = col[1];
          d[k + 2] = col[2];
          d[k + 3] = clamp(a) * 255;
          if (sd > 0.3 && sd < 2.4 && u > 0.97 && edges.length < 240) {
            /* point du bord et direction vers l'extérieur, pour la brume de pigment */
            const e = 0.01;
            let nx = (handSd(lx + e, ly) - handSd(lx - e, ly)) * fl;
            let ny = handSd(lx, ly + e) - handSd(lx, ly - e);
            const nn = Math.hypot(nx, ny) || 1;
            nx /= nn;
            ny /= nn;
            edges.push(x + wx, y + wy, nx * cos - ny * sin, nx * sin + ny * cos);
          }
        }
      }
      g.putImageData(img, 0, 0);
      /* le grain de la roche retient plus ou moins la poudre soufflée */
      const tw = wall.tooth.width / cv.w, th = wall.tooth.height / cv.h;
      g.globalCompositeOperation = 'destination-in';
      g.drawImage(wall.tooth, (x - R) * tw, (y - R) * th, R * 2 * tw, R * 2 * th, 0, 0, N, N);
      g.globalCompositeOperation = 'source-over';
      /* cases de la grille couvertes par le nuage */
      const cells = [];
      const cw = cv.w / GX, ch = cv.h / GY;
      const i0 = Math.max(0, Math.floor((x - R) / cw)), i1 = Math.min(GX - 1, Math.floor((x + R) / cw));
      const j0 = Math.max(0, Math.floor((y - R) / ch)), j1 = Math.min(GY - 1, Math.floor((y + R) / ch));
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const wx = (i + 0.5) * cw - x, wy = (j + 0.5) * ch - y;
          const lx = (wx * cos + wy * sin) * inv * fl;
          const ly = (-wx * sin + wy * cos) * inv;
          const sd = handSd(lx, ly) * S;
          if (sd > 0 && sd < reach * 0.45 && ly < 0.4) cells.push(j * GX + i);
        }
      }
      return { tex, bx: x - R, by: y - R, bw: R * 2, x, y, S, pig, hand, edges, cells, t: 0, dur: 0.78, puff: false };
    }
    function bakeSpray(sp) {
      sctx.globalCompositeOperation = sp.pig.mode;
      sctx.globalAlpha = sp.pig.alpha;
      sctx.drawImage(sp.tex, sp.bx, sp.by, sp.bw, sp.bw);
      sctx.globalAlpha = 1;
      sctx.globalCompositeOperation = 'source-over';
      let changed = false;
      for (const k of sp.cells) if (markCell(k % GX, (k / GX) | 0)) changed = true;
      if (changed) progressChanged();
      dirty = true;
    }
    function placeHand(x, y) {
      if (!silShadow) silShadow = makeSil('#1A0F0A', false);
      if (sprays.length >= 4) bakeSpray(sprays.shift());
      const sp = makeSpray(x, y, pigment, nextHand);
      sprays.push(sp);
      nextHand = newHand();
      dirty = true;
      api.sfx.play('whoosh', { pitch: rand(0.9, 1.15), volume: 0.8, gap: 60 });
      api.buzz(10);
    }

    /* ---- composition : paroi + trait en cours + pochoirs + lumière ---- */
    let comp = null, cctx = null;
    function compose() {
      cctx.globalCompositeOperation = 'source-over';
      cctx.globalAlpha = 1;
      cctx.drawImage(surface, 0, 0, cv.w, cv.h);
      if (bufUsed && bufPig) {
        cctx.globalCompositeOperation = bufPig.mode;
        cctx.globalAlpha = bufPig.alpha;
        cctx.drawImage(toothed(strokeBuf), 0, 0, cv.w, cv.h);
      }
      for (const sp of sprays) {
        const k = 1 - Math.pow(1 - clamp(sp.t / (sp.dur * 0.85)), 2);
        if (k <= 0) continue;
        cctx.globalCompositeOperation = sp.pig.mode;
        cctx.globalAlpha = sp.pig.alpha * k;
        cctx.drawImage(sp.tex, sp.bx, sp.by, sp.bw, sp.bw);
      }
      cctx.globalCompositeOperation = 'hard-light';
      cctx.globalAlpha = 1;
      cctx.drawImage(lightFull, 0, 0, cv.w, cv.h);
      cctx.globalCompositeOperation = 'source-over';
      dirty = false;
    }

    /* ---- animation ---- */
    function update(dt) {
      time += dt;
      for (let i = sprays.length - 1; i >= 0; i--) {
        const sp = sprays[i];
        sp.t += dt;
        if (!sp.puff && sp.t > 0.3) {
          sp.puff = true;
          api.sfx.play('whoosh', { pitch: rand(1.05, 1.3), volume: 0.45, gap: 60 });
        }
        if (sp.t < sp.dur * 0.85 && sp.edges.length && !api.reducedMotion) {
          const n = sp.t < 0.12 ? 1 : 4;
          for (let k = 0; k < n; k++) {
            const e = ((Math.random() * sp.edges.length / 4) | 0) * 4;
            const v = rand(18, 70);
            emit(sp.edges[e], sp.edges[e + 1], sp.edges[e + 2] * v + rand(-8, 8), sp.edges[e + 3] * v + rand(-8, 8),
              0, rand(0.35, 0.75), rand(0.7, 1.7), rand(0.35, 0.75), sp.pig.dust, 0.04);
          }
        }
        dirty = true;
        if (sp.t >= sp.dur) {
          sprays.splice(i, 1);
          bakeSpray(sp);
        }
      }
      for (let i = 0; i < POOL; i++) {
        const p = parts[i];
        if (!p.on) continue;
        p.t += dt;
        if (p.t >= p.life) {
          p.on = false;
          continue;
        }
        const dr = Math.pow(p.drag, dt);
        p.vx *= dr;
        p.vy = p.vy * dr + p.g * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    }

    function render() {
      if (!comp) return;
      if (dirty) compose();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.drawImage(comp, 0, 0, cv.w, cv.h);
      /* la flamme de la lampe vacille */
      if (!api.reducedMotion) {
        const f = fnz.noise2(time * 2.1, 3.7) * 0.65 + fnz.noise2(time * 5.3, 9.1) * 0.35;
        const L = wall.lamp;
        const r = L.r * (1.02 + 0.05 * f);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.02 + 0.08 * f;
        ctx.drawImage(flick, L.x - r, L.y - r, r * 2, r * 2);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
      }
      /* la main posée pendant qu'on souffle, puis qui se retire */
      for (const sp of sprays) {
        const t = sp.t, D = sp.dur;
        const a = 0.62 * smooth(0, 0.06, t) * (1 - smooth(D * 0.66, D, t));
        if (a < 0.01) continue;
        const lift = smooth(D * 0.45, D, t);
        drawSil(silShadow, sp.x, sp.y, sp.hand, sp.S * (1 + lift * 0.06), a, 1.5 + lift * 9, 2 + lift * 11);
      }
      /* poudre de pigment */
      for (let i = 0; i < POOL; i++) {
        const p = parts[i];
        if (!p.on) continue;
        const k = p.t / p.life;
        ctx.globalAlpha = p.a * (1 - k) * Math.min(1, p.t * 14);
        ctx.fillStyle = p.col;
        ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
      }
      ctx.globalAlpha = 1;
      /* aperçu à la souris */
      if (hover && !strokes.size && !sprays.length) {
        if (tool === 'pochoir') {
          if (!silShadow) silShadow = makeSil('#1A0F0A', false);
          if (!silLine) silLine = makeSil('#FFF1DE', true);
          const S = handScale();
          drawSil(silShadow, hover.x, hover.y, nextHand, S, 0.16, 0, 0);
          drawSil(silLine, hover.x, hover.y, nextHand, S, 0.7, 0, 0);
        } else {
          ctx.strokeStyle = 'rgba(255,241,222,0.55)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(hover.x, hover.y, baseR * 0.85, 0, TAU);
          ctx.stroke();
        }
      }
    }

    /* ---- palette (DOM) ---- */
    const tray = document.createElement('div');
    tray.className = 'oc-tray';
    tray.setAttribute('role', 'group');
    tray.setAttribute('aria-label', TEXTES.palette);
    const chips = {};
    function addChip(id, name, dot) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip oc-chip';
      b.setAttribute('aria-pressed', 'false');
      const nm = document.createElement('span');
      nm.className = 'oc-name';
      nm.textContent = name;
      b.append(dot, nm);
      b.addEventListener('click', () => choose(id));
      tray.appendChild(b);
      chips[id] = b;
    }
    PIGMENTS.forEach((p) => {
      const dot = document.createElement('span');
      dot.className = 'oc-dot';
      dot.setAttribute('aria-hidden', 'true');
      dot.style.setProperty('--c', p.swatch);
      dot.style.setProperty('--cl', mix(p.swatch, '#FFFFFF', 0.32));
      dot.style.setProperty('--cd', mix(p.swatch, '#000000', 0.38));
      addChip(p.id, TEXTES.pigments[p.id].nom, dot);
    });
    const handDot = document.createElement('span');
    handDot.className = 'oc-dot oc-dot--hand';
    handDot.setAttribute('aria-hidden', 'true');
    handDot.innerHTML = handSvg();
    addChip('pochoir', TEXTES.pochoir.nom, handDot);
    const tip = document.createElement('p');
    tip.className = 'oc-tip';
    tip.setAttribute('aria-live', 'polite');
    tray.appendChild(tip);
    stage.appendChild(tray);

    let tipTimer = 0;
    function showTip(id) {
      const t = id === 'pochoir' ? TEXTES.pochoir : TEXTES.pigments[id];
      const b = document.createElement('strong');
      b.textContent = lib.fr(t.nom);
      tip.replaceChildren(b, document.createTextNode(lib.fr(t.info)));
      tip.classList.add('is-on');
      clearTimeout(tipTimer);
      tipTimer = setTimeout(hideTip, clamp(1400 + t.info.length * 26, 2000, 3500));
    }
    function hideTip() {
      clearTimeout(tipTimer);
      tip.classList.remove('is-on');
    }
    function choose(id, quiet) {
      if (id === 'pochoir') tool = 'pochoir';
      else {
        tool = 'pinceau';
        pigment = PIG[id];
      }
      const sel = tool === 'pochoir' ? 'pochoir' : pigment.id;
      for (const k in chips) {
        chips[k].setAttribute('aria-pressed', String(k === sel));
        chips[k].classList.toggle('is-ink', tool === 'pochoir' && k === pigment.id);
      }
      handDot.style.setProperty('--c', pigment.swatch);
      cv.canvas.style.cursor = tool === 'pochoir' ? 'pointer' : 'crosshair';
      if (quiet) return;
      showTip(id);
      if (!api.isDone()) api.hint(tool === 'pochoir' ? TEXTES.consignePochoir : TEXTES.consignePinceau);
      api.sfx.play('tick', { pitch: tool === 'pochoir' ? 0.8 : 1.15 });
    }

    /* ---- enregistrer l'image ---- */
    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'chip oc-save';
    saveBtn.setAttribute('aria-label', TEXTES.enregistrerAria);
    saveBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.5v10.5M7.5 10.5L12 15l4.5-4.5M5 19.5h14"/></svg>';
    saveBtn.appendChild(document.createTextNode(TEXTES.enregistrer));
    let inFrame = true;
    try { inFrame = window.self !== window.top; } catch (err) { inFrame = true; }
    /* dans l'aperçu Claude, les téléchargements sont bloqués : on cache le bouton */
    saveBtn.hidden = inFrame || window.RM_NO_DOWNLOAD === true;
    saveBtn.addEventListener('click', () => {
      if (!comp || !comp.toBlob) return;
      if (dirty) compose();
      comp.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = TEXTES.fichier;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        saveBtn.classList.add('is-saved');
        setTimeout(() => saveBtn.classList.remove('is-saved'), 900);
      }, 'image/png');
      api.sfx.play('chime', { volume: 0.6 });
    });
    stage.appendChild(saveBtn);

    /* ---- taille de la scène ---- */
    const flick = buildFlicker();
    cv.onResize((w, h) => {
      const old = surface;
      if (old) {
        bake();
        while (sprays.length) bakeSpray(sprays.shift());
      }
      wall = buildWall(w, h);
      surface = layer();
      sctx = scaled(surface);
      lightFull = buildLightFull();
      strokeBuf = layer();
      bctx = scaled(strokeBuf);
      toothBuf = layer();
      tctx = toothBuf.getContext('2d');
      tctx.imageSmoothingEnabled = true;
      bufUsed = false;
      comp = layer();
      cctx = scaled(comp);
      paintBase();
      if (old && painted > 0) sctx.drawImage(old, 0, 0, w, h);
      baseR = clamp(w * 0.046, 12, 26);
      stage.classList.toggle('oc-narrow', w < 340);
      stage.classList.toggle('oc-short', h < 300);
      dirty = true;
    });

    /* ---- interaction ---- */
    api.track(cv.canvas, {
      down(p) {
        hover = null;
        hideTip();
        if (tool === 'pochoir') {
          placeHand(p.x, p.y);
          return;
        }
        const st = { x: p.x, y: p.y, t: performance.now(), v: 0, r: baseR, a: 0.46, left: 0, dist: 0, load: 1, dust: 0 };
        strokes.set(p.id, st);
        dab(st);
        if (!api.reducedMotion) {
          for (let i = 0; i < 6; i++) {
            const a = rand(TAU), v = rand(10, 40);
            emit(p.x + Math.cos(a) * baseR * 0.6, p.y + Math.sin(a) * baseR * 0.6, Math.cos(a) * v, Math.sin(a) * v,
              60, rand(0.4, 0.8), rand(0.8, 1.6), rand(0.5, 0.85), pigment.dust, 0.2);
          }
        }
        api.sfx.play('scrape', { pitch: 0.9, volume: 0.6, gap: 120 });
      },
      move(p) {
        const st = strokes.get(p.id);
        if (st) strokeTo(st, p.x, p.y, performance.now());
      },
      up(p, e, cancelled) {
        const st = strokes.get(p.id);
        if (st) {
          if (!cancelled) strokeTo(st, p.x, p.y, performance.now());
          strokes.delete(p.id);
        }
        if (!strokes.size) bake();
        if (e && e.pointerType === 'mouse' && !cancelled) hover = { x: p.x, y: p.y };
      },
      hover(p) {
        if (p.type === 'mouse') hover = { x: p.x, y: p.y };
      },
    }, { touchAction: 'none' });
    cv.canvas.addEventListener('pointerleave', () => { hover = null; });

    /* ---- remise à neuf ---- */
    function reset() {
      strokes.clear();
      sprays.length = 0;
      for (let i = 0; i < POOL; i++) parts[i].on = false;
      grid.fill(0);
      painted = 0;
      shownPct = -1;
      bctx.setTransform(1, 0, 0, 1, 0, 0);
      bctx.clearRect(0, 0, strokeBuf.width, strokeBuf.height);
      bctx.setTransform(cv.dpr, 0, 0, cv.dpr, 0, 0);
      bufUsed = false;
      bufPig = null;
      paintBase();
      dirty = true;
      hover = null;
      nextHand = newHand();
      choose('rouge', true);
      hideTip();
      saveBtn.classList.remove('is-saved');
      api.progress(0);
      api.gesture('drag', { x: 30, y: 40, dx: 120, dy: 40 });
    }

    api.loop((dt) => {
      update(dt);
      render();
    });
    api.onReset(reset);
    reset();
    render();
  };
})();
