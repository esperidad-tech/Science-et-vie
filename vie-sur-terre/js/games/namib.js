/* Le Namib : le vent arrache la poussière d’argile du désert et l’emporte jusqu’à l’océan,
   où elle nourrit le plancton. Paysage en bloc au petit matin : le désert et la mer en
   perspective, et à l’avant une coupe (strates de sable, colonne d’eau). */
(function () {
  'use strict';
  const { lib } = window.RM;
  const { TAU, rand, randInt, clamp, lerp, ease, rgba, mix, pick, draw } = lib;

  /* Tous les textes du jeu */
  const TEXTES = {
    croissance: 'Plancton : en pleine croissance',
    faible: 'La poussière retombe avant la mer : balaye plus vite et plus loin.',
    sens: 'Balaye de gauche à droite, vers l’océan.',
    rate: 'Tape dans le désert, ou balaye vers l’océan.',
    poissons: 'Des bancs de petits poissons apparaissent.',
    fin: 'La poussière a nourri l’océan : le plancton prolifère.',
    finStatut: 'Le fer contenu dans ces poussières sert d’engrais au plancton, qui réagit en un ou deux jours.',
  };

  const NEED = 700;      /* grains d’argile tombés dans la mer pour une floraison complète */
  const PERS = 0.42;     /* aplatissement d’un cercle posé sur la mer, au premier plan */
  const ZC = 3.4;        /* les poussières retombent avant cette profondeur */
  const MAXSPECK = 290, MAXPUFF = 64, MAXPATCH = 18, MAXSTREAK = 32, MAXRIP = 32;

  const DUST = ['#E8CDB9', '#F1DED0', '#D9B49E', '#EFD6C3', '#E2C0AA'];

  window.RM.games.namib = function (api) {
    const cv = api.canvas();
    const ctx = cv.ctx;
    const CALM = api.reducedMotion;
    const nz = lib.makeNoise(57);

    /* ---------- état ---------- */
    let specks = [], puffs = [], streaks = [], ripples = [], rings = [], patches = [], schools = [];
    const motes = [], air = [], waves = [];
    let dustLevel = 1;
    let food = 0;          /* grains tombés dans la mer */
    let bloom = 0;         /* floraison affichée, 0..1 (suit food) */
    let finished = false;
    let started = false;
    let time = 0;
    let wind = 0;
    let msgT = 0;
    let weakT = -1;
    let misses = 0;
    let lastX = null;
    let moveAcc = 0;
    let bg = null, treesL = null, dustL = null, puffSpr = null;
    const bloomSpr = [];
    let oceanPath = null, waterPath = null;
    let crests = [];

    /* ---------- géométrie : un sol en perspective ----------
       X : position latérale (px au premier plan), z : profondeur (1 = bord avant, ∞ = horizon). */
    const G = { w: 1, h: 1, U: 1, hy: 0, fy: 0, D: 1, FH: 1, vx: 0, Zs: 1, coastH: 0, coastF: 0, cf: 0, px: 0, py: 0, prx: 1, pry: 1 };
    const gy = (z) => G.hy + G.D / z;
    const zy = (y) => G.D / Math.max(0.5, y - G.hy);
    const toSx = (X, z) => G.vx + (X - G.vx) / z;
    const toX = (x, z) => G.vx + (x - G.vx) * z;
    function coastX(y) {
      const t = clamp((y - G.hy) / G.D);
      return lerp(G.coastH, G.coastF, t) + Math.sin(t * 6.3 + 0.8) * G.w * 0.01;
    }
    function floorY(x) {
      const t = clamp((x - G.cf) / (G.w - G.cf));
      return G.fy + G.FH * 0.9 * (1 - Math.exp(-3.2 * t));
    }
    function inOcean(x, y) {
      return y > G.hy + 1 && y < G.fy && x > coastX(y) + 2 * G.U && x < G.w;
    }

    function layer(w, h, res) {
      const r = res || cv.dpr;
      const c = document.createElement('canvas');
      c.width = Math.max(2, Math.round(w * r));
      c.height = Math.max(2, Math.round(h * r));
      const g = c.getContext('2d');
      g.scale(r, r);
      return { c, g };
    }

    function softEllipse(g, x, y, rx, ry, col, a) {
      g.save();
      g.translate(x, y);
      g.scale(rx / ry, 1);
      draw.glow(g, 0, 0, ry, col, a);
      g.restore();
    }

    function layout(w, h) {
      /* la scène change de taille : la floraison et les poissons suivent, la poussière en vol s’efface */
      if (G.w > 24 && w > 24 && (G.w !== w || G.h !== h)) {
        const kx = w / G.w, ky = h / G.h;
        for (const p of patches) {
          p.X *= kx;
          p.r *= kx;
          p.rT *= kx;
        }
        for (const s of schools) {
          s.x *= kx;
          s.y *= ky;
          s.size *= kx;
          s.spd *= kx;
        }
        specks.length = 0;
        puffs.length = 0;
        streaks.length = 0;
        ripples.length = 0;
      }
      G.w = w;
      G.h = h;
      G.U = Math.min(w, h) / 360;
      G.hy = Math.round(h * 0.33);
      G.fy = Math.round(h * 0.76);
      G.D = G.fy - G.hy;
      G.FH = h - G.fy;
      G.vx = w * 0.5;
      G.Zs = G.D / PERS;
      G.coastH = w * 0.6;
      G.coastF = w * 0.535;
      G.cf = coastX(G.fy);
      G.prx = w * 0.19;
      G.pry = Math.max(4, (gy(1.25) - gy(1.8)) / 2);
      G.px = w * 0.29;
      G.py = (gy(1.25) + gy(1.8)) / 2;
      if (w < 24 || h < 24) {
        bg = null;
        return;
      }
      oceanPath = new Path2D();
      oceanPath.moveTo(coastX(G.hy), G.hy);
      for (let y = G.hy; y < G.fy; y += 3) oceanPath.lineTo(coastX(y), y);
      oceanPath.lineTo(G.cf, G.fy);
      oceanPath.lineTo(w + 1, G.fy);
      oceanPath.lineTo(w + 1, G.hy);
      oceanPath.closePath();
      waterPath = new Path2D();
      waterPath.moveTo(G.cf, G.fy);
      for (let x = G.cf; x <= w + 3; x += 3) waterPath.lineTo(x, floorY(x));
      waterPath.lineTo(w + 3, G.fy);
      waterPath.closePath();
      bg = makeBg(w, h);
      treesL = makeTrees(w, h);
      dustL = makeDustLayer();
      if (!puffSpr) puffSpr = makePuff();
      if (!bloomSpr.length) for (let i = 0; i < 3; i++) bloomSpr.push(makeBloomSprite(11 + i * 7));
      waves.length = 0;
      for (let i = 0; i < 30; i++) {
        const z = 1 + Math.pow(Math.random(), 1.4) * 6;
        const y = gy(z);
        waves.push({ X: toX(rand(coastX(y) + 4, w), z), z, len: rand(6, 16), ph: rand(TAU) });
      }
      motes.length = 0;
      for (let i = 0; i < 36; i++) motes.push({ x: rand(G.cf, w), y: rand(G.fy, h), ph: rand(TAU), s: rand(0.8, 1.6) });
      air.length = 0;
      for (let i = 0; i < 18; i++) air.push({ x: G.px + rand(-1, 1) * G.prx, y: G.py - rand(2, 30) * G.U, ph: rand(TAU), s: rand(0.7, 1.5) });
    }

    /* ---------- pré-rendus ---------- */
    function makePuff() {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d');
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(236,208,188,1)');
      gr.addColorStop(0.45, 'rgba(236,208,188,0.5)');
      gr.addColorStop(1, 'rgba(236,208,188,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 64);
      return c;
    }

    /* une floraison : des filaments enroulés en volutes, comme vus d’avion */
    function makeBloomSprite(seed) {
      const S = 160;
      const c = document.createElement('canvas');
      c.width = c.height = S;
      const g = c.getContext('2d');
      const N = lib.makeNoise(seed);
      const R = N.rnd;
      const vort = [];
      for (let i = 0; i < 4; i++) vort.push({ x: S * (0.25 + 0.5 * R()), y: S * (0.25 + 0.5 * R()), s: (R() < 0.5 ? -1 : 1) * (0.7 + R() * 0.8), r: S * (0.12 + 0.14 * R()) });
      const v = [0, 0];
      function vel(x, y) {
        let vx = 0.15, vy = 0;
        for (const o of vort) {
          const dx = x - o.x, dy = y - o.y;
          const k = o.s * Math.exp(-(dx * dx + dy * dy) / (o.r * o.r));
          vx += (-dy / o.r) * k;
          vy += (dx / o.r) * k;
        }
        const e = 3;
        vx += (N.fbm(x / 45, (y + e) / 45, 2) - N.fbm(x / 45, (y - e) / 45, 2)) * 25;
        vy -= (N.fbm((x + e) / 45, y / 45, 2) - N.fbm((x - e) / 45, y / 45, 2)) * 25;
        v[0] = vx;
        v[1] = vy;
        return v;
      }
      const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      gr.addColorStop(0, rgba('#2FBF9B', 0.45));
      gr.addColorStop(0.65, rgba('#2FBF9B', 0.24));
      gr.addColorStop(1, rgba('#2FBF9B', 0));
      g.fillStyle = gr;
      g.fillRect(0, 0, S, S);
      g.lineCap = 'round';
      g.lineJoin = 'round';
      for (let i = 0; i < 170; i++) {
        let x = S * (0.08 + 0.84 * R()), y = S * (0.08 + 0.84 * R());
        const light = R() < 0.45;
        g.strokeStyle = rgba(light ? '#8FE3B5' : '#2FBF9B', light ? 0.12 + R() * 0.32 : 0.16 + R() * 0.3);
        g.lineWidth = light ? 0.8 + R() * 2 : 1.5 + R() * 4;
        g.beginPath();
        g.moveTo(x, y);
        for (let k = 0; k < 28; k++) {
          const q = vel(x, y);
          const l = Math.hypot(q[0], q[1]) || 1;
          x += (q[0] / l) * 2.6;
          y += (q[1] / l) * 2.6;
          g.lineTo(x, y);
        }
        g.stroke();
      }
      g.globalCompositeOperation = 'destination-in';
      const m = g.createRadialGradient(S / 2, S / 2, S * 0.1, S / 2, S / 2, S * 0.5);
      m.addColorStop(0, 'rgba(0,0,0,1)');
      m.addColorStop(0.6, 'rgba(0,0,0,0.9)');
      m.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = m;
      draw.blob(g, S / 2, S / 2, S * 0.47, 0.14, seed, 0, 32);
      g.fill();
      g.globalCompositeOperation = 'source-over';
      return c;
    }

    /* une dune : longue pente douce face au vent (à gauche), crête vive,
       face d’éboulement raide et dans l’ombre (à droite) */
    function dune(g, d) {
      const { x0, x1, base, px, H } = d;
      const N = 48;
      const pts = [];
      for (let i = 0; i <= N; i++) {
        const x = lerp(x0, x1, i / N);
        let y;
        if (x <= px) {
          const t = (x - x0) / (px - x0);
          y = base - H * (0.55 * t * t * (3 - 2 * t) + 0.45 * Math.pow(t, 1.4));
        } else {
          y = base - H * Math.pow(1 - (x - px) / (x1 - px), 1.6);
        }
        y += (nz.noise2(x / 9 + d.seed, 3.3) - 0.5) * H * 0.03;
        pts.push(x, y);
      }
      const top = base - H;
      g.beginPath();
      g.moveTo(x0, base + 1);
      for (let i = 0; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
      g.lineTo(x1, base + 1);
      g.closePath();
      let gr = g.createLinearGradient(0, top, 0, base);
      gr.addColorStop(0, d.litTop);
      gr.addColorStop(1, d.lit);
      g.fillStyle = gr;
      g.fill();
      /* face à l’ombre */
      const xs = px + (x1 - px) * 0.22;
      g.beginPath();
      g.moveTo(px, top);
      g.quadraticCurveTo(px + (x1 - px) * 0.32, top + H * 0.5, xs, base + 1);
      g.lineTo(x1, base + 1);
      for (let i = pts.length - 2; i >= 0; i -= 2) if (pts[i] >= px) g.lineTo(pts[i], pts[i + 1]);
      g.closePath();
      gr = g.createLinearGradient(0, top, 0, base);
      gr.addColorStop(0, d.shade);
      gr.addColorStop(1, d.shadeLow);
      g.fillStyle = gr;
      g.fill();
      /* liseré de lumière sur la crête */
      g.strokeStyle = rgba('#FFE2BE', d.rim);
      g.lineWidth = Math.max(0.8, H * 0.03);
      g.lineCap = 'round';
      g.beginPath();
      let on = false;
      for (let i = 0; i < pts.length; i += 2) {
        const x = pts[i];
        if (x < lerp(x0, px, 0.55) || x > px) continue;
        if (!on) g.moveTo(x, pts[i + 1] + 0.5);
        else g.lineTo(x, pts[i + 1] + 0.5);
        on = true;
      }
      g.stroke();
      if (d.wisp) crests.push({ x: px, y: top, s: H / (G.h * 0.12), ph: rand(TAU) });
    }

    function makeBg(w, h) {
      const { c, g } = layer(w, h);
      const { hy, fy, U } = G;
      /* ciel du petit matin */
      const sky = g.createLinearGradient(0, 0, 0, hy);
      sky.addColorStop(0, '#F4C58A');
      sky.addColorStop(1, '#F9E3C0');
      g.fillStyle = sky;
      g.fillRect(0, 0, w, hy + 2);
      const sx = w * 0.15, sy = hy - h * 0.04;
      draw.glow(g, sx, sy, h * 0.55, '#FFF1D2', 0.55);
      draw.glow(g, sx, sy, h * 0.12, '#FFF8E8', 0.85);
      g.fillStyle = '#FFFBF1';
      g.beginPath();
      g.arc(sx, sy, h * 0.032, 0, TAU);
      g.fill();
      [[0.62, 0.1, 0.22], [0.36, 0.17, 0.16], [0.86, 0.22, 0.12], [0.5, 0.26, 0.1]].forEach(([cx, cy, s], j) => {
        for (let i = 0; i < 5; i++) {
          const x = (cx + (i - 2) * s * 0.3) * w;
          const y = cy * h + Math.sin(i * 1.9 + j) * h * 0.006;
          softEllipse(g, x, y, s * w * rand(0.3, 0.5), h * rand(0.008, 0.016), '#FFF6E8', 0.32);
        }
      });

      /* océan en perspective, reflets du ciel au loin */
      let gr = g.createLinearGradient(0, hy, 0, fy);
      gr.addColorStop(0, mix('#1E7FA0', '#F9E3C0', 0.5));
      gr.addColorStop(0.18, mix('#1E7FA0', '#F9E3C0', 0.22));
      gr.addColorStop(1, '#1E7FA0');
      g.fillStyle = gr;
      g.fill(oceanPath);
      g.save();
      g.clip(oceanPath);
      for (let i = 0; i < 260; i++) {
        const z = 1 + Math.pow(Math.random(), 1.3) * 9;
        const y = gy(z);
        const x = rand(coastX(y), w);
        const l = rand(8, 22) / z * U;
        g.strokeStyle = Math.random() < 0.55 ? rgba('#BDE6EE', 0.22) : rgba('#11617F', 0.22);
        g.lineWidth = Math.max(0.6, 1.4 / Math.sqrt(z));
        g.beginPath();
        g.moveTo(x - l, y);
        g.quadraticCurveTo(x, y - 1.2 / z, x + l, y);
        g.stroke();
      }
      g.restore();
      /* brume de mer à l’horizon */
      for (let i = 0; i < 6; i++) softEllipse(g, lerp(coastX(hy), w, i / 5), hy - h * 0.004, w * 0.16, h * 0.018, '#FFF8EE', 0.5);

      /* sable du désert */
      g.beginPath();
      g.moveTo(-1, hy);
      g.lineTo(coastX(hy), hy);
      for (let y = hy; y < fy; y += 3) g.lineTo(coastX(y), y);
      g.lineTo(G.cf, fy);
      g.lineTo(-1, fy);
      g.closePath();
      gr = g.createLinearGradient(0, hy, 0, fy);
      gr.addColorStop(0, '#EDAE84');
      gr.addColorStop(0.35, '#E28D58');
      gr.addColorStop(1, '#D27238');
      g.fillStyle = gr;
      g.fill();
      /* rides du sable */
      for (let i = 0; i < 240; i++) {
        const z = 1 + Math.pow(Math.random(), 1.2) * 4;
        const y = gy(z);
        const x = rand(-4, coastX(y) - 6 * U);
        const l = rand(6, 15) / z * U;
        const a = Math.random() < 0.5;
        g.strokeStyle = a ? rgba('#B95A2A', 0.22) : rgba('#F6BC8E', 0.28);
        g.lineWidth = Math.max(0.6, 1.3 / z);
        g.beginPath();
        g.moveTo(x - l, y);
        g.quadraticCurveTo(x, y - 1.6 / z, x + l, y + 0.3);
        g.stroke();
      }
      /* plage et sable mouillé le long de la côte */
      g.beginPath();
      for (let y = hy; y <= fy; y += 3) {
        const bw = Math.max(1, 0.034 * w * (y - hy) / G.D);
        if (y === hy) g.moveTo(coastX(y) - bw, y);
        else g.lineTo(coastX(y) - bw, y);
      }
      for (let y = fy; y >= hy; y -= 3) g.lineTo(coastX(y) + 0.5, y);
      g.closePath();
      g.fillStyle = '#F1C9A0';
      g.fill();
      g.beginPath();
      for (let y = hy; y <= fy; y += 3) {
        const bw = Math.max(0.6, 0.012 * w * (y - hy) / G.D);
        if (y === hy) g.moveTo(coastX(y) - bw, y);
        else g.lineTo(coastX(y) - bw, y);
      }
      for (let y = fy; y >= hy; y -= 3) g.lineTo(coastX(y) + 0.5, y);
      g.closePath();
      g.fillStyle = '#C89F80';
      g.fill();

      /* dunes, des plus lointaines aux plus proches */
      crests = [];
      const cH = (y) => coastX(y) - w * 0.012;
      const farB = hy + 1.5;
      for (let i = 0; i < 5; i++) {
        const x0 = (-0.12 + i * 0.15) * w;
        const x1 = Math.min(x0 + w * rand(0.22, 0.28), cH(farB));
        if (x1 - x0 < w * 0.06) continue;
        dune(g, { x0, x1, base: farB, px: lerp(x0, x1, 0.7), H: h * rand(0.03, 0.05), lit: '#F1B48E', litTop: '#F8CBA4', shade: '#DE9474', shadeLow: '#E7A584', rim: 0.35, seed: i });
      }
      const midB = gy(4.2);
      [[-0.16, 0.2, 0.085], [0.08, 0.4, 0.1], [0.32, 0.56, 0.07]].forEach(([a, b, H], i) => {
        const x0 = a * w, x1 = Math.min(b * w, cH(midB));
        dune(g, { x0, x1, base: midB, px: lerp(x0, x1, 0.7), H: H * h, lit: '#EE9A5E', litTop: '#F7B886', shade: '#C8612F', shadeLow: '#D6733F', rim: 0.5, seed: 10 + i, wisp: true });
      });
      const nearB = gy(2.5);
      [[-0.2, 0.22, 0.12, 0.72], [0.26, 0.56, 0.095, 0.68]].forEach(([a, b, H, pk], i) => {
        const x0 = a * w, x1 = Math.min(b * w, cH(nearB));
        /* ombre de la dune sur le sable */
        softEllipse(g, x1 - w * 0.02, nearB + 2 * U, w * 0.09, h * 0.012, '#8E3818', 0.28);
        dune(g, { x0, x1, base: nearB, px: lerp(x0, x1, pk), H: H * h, lit: '#E07B39', litTop: '#F0995A', shade: '#AD4720', shadeLow: '#C2562B', rim: 0.6, seed: 20 + i, wisp: true });
      });

      /* la cuvette d’argile blanche craquelée */
      const pan = makePan();
      g.drawImage(pan, G.px - G.prx, G.py - G.pry, G.prx * 2, G.pry * 2);

      /* coupe à l’avant : strates de sable et de grès */
      const FH = G.FH;
      const bands = [[0, '#D8743C'], [0.13, '#BE5B2B'], [0.3, '#E39C66'], [0.43, '#A8441D'], [0.62, '#C8733F'], [0.8, '#8E3818']];
      const by = (b, x) => (b === 0 ? fy : fy + bands[b][0] * FH + (nz.fbm(x / 70 + b * 3.7, b * 1.9, 3) - 0.5) * FH * 0.12);
      for (let b = 0; b < bands.length; b++) {
        g.beginPath();
        g.moveTo(-1, h + 1);
        for (let x = -1; x <= w + 4; x += 4) g.lineTo(x, by(b, x));
        g.lineTo(w + 4, h + 1);
        g.closePath();
        g.fillStyle = bands[b][1];
        g.fill();
      }
      /* litages obliques, souvenirs d’anciennes dunes */
      [2, 4].forEach((b) => {
        g.save();
        g.beginPath();
        g.moveTo(-1, by(b, -1));
        for (let x = -1; x <= w + 4; x += 4) g.lineTo(x, by(b, x));
        for (let x = w + 4; x >= -1; x -= 4) g.lineTo(x, by(b + 1, x));
        g.closePath();
        g.clip();
        g.strokeStyle = rgba(b === 2 ? '#F6C08E' : '#E89660', 0.45);
        g.lineWidth = Math.max(0.7, 0.9 * U);
        const t0 = fy + bands[b][0] * FH - FH * 0.08, t1 = fy + bands[b + 1][0] * FH + FH * 0.08;
        for (let x = -FH; x < w; x += 7 * U) {
          g.beginPath();
          g.moveTo(x, t0);
          g.quadraticCurveTo(x + (t1 - t0) * 1.1, t0 + (t1 - t0) * 0.35, x + (t1 - t0) * 1.6, t1);
          g.stroke();
        }
        g.restore();
      });
      for (let i = 0; i < 380; i++) {
        const x = rand(w), y = rand(fy + 1, h);
        g.fillStyle = Math.random() < 0.5 ? rgba('#5A230E', rand(0.15, 0.4)) : rgba('#F7C9A0', rand(0.12, 0.35));
        const s = rand(0.6, 1.6);
        g.fillRect(x, y, s, s * 0.8);
      }
      /* colonne d’eau en coupe */
      g.save();
      g.clip(waterPath);
      gr = g.createLinearGradient(0, fy, 0, h);
      gr.addColorStop(0, '#1E7FA0');
      gr.addColorStop(1, '#0E4A6E');
      g.fillStyle = gr;
      g.fillRect(G.cf - 2, fy, w - G.cf + 4, FH + 2);
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const x0 = lerp(G.cf, w, 0.2 + i * 0.3);
        const rg = g.createLinearGradient(0, fy, 0, h);
        rg.addColorStop(0, 'rgba(190,240,250,0.12)');
        rg.addColorStop(1, 'rgba(190,240,250,0)');
        g.fillStyle = rg;
        g.beginPath();
        g.moveTo(x0, fy);
        g.lineTo(x0 + w * 0.04, fy);
        g.lineTo(x0 + w * 0.1, h);
        g.lineTo(x0 + w * 0.02, h);
        g.closePath();
        g.fill();
      }
      g.globalCompositeOperation = 'source-over';
      g.restore();
      /* fond marin : liseré de sable */
      g.strokeStyle = '#E3B47E';
      g.lineWidth = 2.4 * U;
      g.beginPath();
      for (let x = G.cf; x <= w + 3; x += 3) {
        if (x === G.cf) g.moveTo(x, floorY(x) + 1);
        else g.lineTo(x, floorY(x) + 1);
      }
      g.stroke();
      /* arête du bloc */
      g.lineWidth = 1.3;
      g.strokeStyle = rgba('#F9D7B4', 0.85);
      g.beginPath();
      g.moveTo(0, fy + 0.5);
      g.lineTo(G.cf, fy + 0.5);
      g.stroke();
      g.strokeStyle = rgba('#D8F5FA', 0.85);
      g.beginPath();
      g.moveTo(G.cf, fy + 0.5);
      g.lineTo(w, fy + 0.5);
      g.stroke();
      return c;
    }

    /* craquelures : cellules de Voronoï calculées sur le sol (donc en perspective),
       épaisseur des fentes mesurée à l’écran */
    function makePan() {
      const W = Math.max(2, Math.ceil(G.prx * 2)), H = Math.max(2, Math.ceil(G.pry * 2));
      const r = cv.dpr;
      const PW = Math.round(W * r), PH = Math.round(H * r);
      const x0 = G.px - G.prx, y0 = G.py - G.pry;
      const zN = zy(y0 + H), zF = zy(y0);
      const Xmin = toX(x0, zF), Xmax = toX(x0 + W, zF);
      const Zmin = zN * G.Zs, Zmax = zF * G.Zs;
      const cell = 26 * G.U;
      const sxs = [], szs = [], sb = [];
      for (let gx = Xmin - cell; gx < Xmax + cell; gx += cell) {
        for (let gz = Zmin - cell; gz < Zmax + cell; gz += cell) {
          sxs.push(gx + rand(0.1, 0.9) * cell);
          szs.push(gz + rand(0.1, 0.9) * cell);
          sb.push(rand(-1, 1));
        }
      }
      const NS = sxs.length;
      const V = new Float32Array(PW * PH);
      const NI = new Int16Array(PW * PH);
      for (let py = 0; py < PH; py++) {
        const sy = y0 + (py + 0.5) / r;
        const z = zy(sy);
        const Zw = z * G.Zs;
        for (let px = 0; px < PW; px++) {
          const X = toX(x0 + (px + 0.5) / r, z);
          let f1 = 1e12, f2 = 1e12, i1 = 0;
          for (let i = 0; i < NS; i++) {
            const dx = X - sxs[i], dz = Zw - szs[i];
            const dd = dx * dx + dz * dz;
            if (dd < f1) { f2 = f1; f1 = dd; i1 = i; } else if (dd < f2) f2 = dd;
          }
          const j = py * PW + px;
          V[j] = Math.sqrt(f2) - Math.sqrt(f1);
          NI[j] = i1;
        }
      }
      const c = document.createElement('canvas');
      c.width = PW;
      c.height = PH;
      const g = c.getContext('2d');
      const img = g.createImageData(PW, PH);
      const d = img.data;
      const LT = lib.hexToRgb('#F5F0E4'), BS = lib.hexToRgb('#E9E2D0'), DK = lib.hexToRgb('#D3C8B2'), CR = lib.hexToRgb('#8A7B66');
      for (let py = 0; py < PH; py++) {
        for (let px = 0; px < PW; px++) {
          const j = py * PW + px;
          const xl = Math.max(0, px - 1), xr = Math.min(PW - 1, px + 1);
          const yu = Math.max(0, py - 1), yd = Math.min(PH - 1, py + 1);
          const gxv = (V[py * PW + xr] - V[py * PW + xl]) / (xr - xl || 1);
          const gyv = (V[yd * PW + px] - V[yu * PW + px]) / (yd - yu || 1);
          const e = V[j] / Math.max(0.02, Math.hypot(gxv, gyv));
          const b = sb[NI[j]];
          const n = nz.fbm(px / (14 * r) + 5, py / (6 * r) + 9, 3);
          let t = clamp(0.5 + b * 0.25 + (n - 0.5) * 0.8);
          let cr = t > 0.5 ? lerp(BS[0], LT[0], (t - 0.5) * 2) : lerp(DK[0], BS[0], t * 2);
          let cg = t > 0.5 ? lerp(BS[1], LT[1], (t - 0.5) * 2) : lerp(DK[1], BS[1], t * 2);
          let cb = t > 0.5 ? lerp(BS[2], LT[2], (t - 0.5) * 2) : lerp(DK[2], BS[2], t * 2);
          const thr = 0.75 * r;
          if (e < thr) {
            const k = 1 - e / thr;
            cr = lerp(cr, CR[0], k); cg = lerp(cg, CR[1], k); cb = lerp(cb, CR[2], k);
          } else if (e < thr * 3) {
            const k = (1 - (e - thr) / (thr * 2)) * 0.5;
            cr = lerp(cr, 255, k); cg = lerp(cg, 252, k); cb = lerp(cb, 244, k);
          }
          /* bord irrégulier, fondu dans le sable */
          const nx = ((px + 0.5) / r - G.prx) / G.prx, ny = ((py + 0.5) / r - G.pry) / G.pry;
          const rr = Math.hypot(nx, ny);
          const ang = Math.atan2(ny, nx);
          const edge = 0.9 + 0.06 * Math.sin(ang * 3 + 1) + 0.04 * Math.sin(ang * 7 + 2);
          const a = clamp((edge - rr) / 0.12);
          d[j * 4] = cr; d[j * 4 + 1] = cg; d[j * 4 + 2] = cb; d[j * 4 + 3] = 255 * a;
        }
      }
      g.putImageData(img, 0, 0);
      return c;
    }

    /* fine poussière beige-rosé posée sur la cuvette */
    function makeDustLayer() {
      const W = Math.max(2, Math.ceil(G.prx * 2)), H = Math.max(2, Math.ceil(G.pry * 2));
      const s = 2;
      const PW = Math.ceil(W / s), PH = Math.ceil(H / s);
      const c = document.createElement('canvas');
      c.width = PW;
      c.height = PH;
      const g = c.getContext('2d');
      const img = g.createImageData(PW, PH);
      const d = img.data;
      const C = lib.hexToRgb('#E7C3AE');
      for (let py = 0; py < PH; py++) {
        for (let px = 0; px < PW; px++) {
          const nx = ((px + 0.5) * s - G.prx) / G.prx, ny = ((py + 0.5) * s - G.pry) / G.pry;
          const rr = Math.hypot(nx, ny);
          const ang = Math.atan2(ny, nx);
          const edge = 0.86 + 0.06 * Math.sin(ang * 3 + 1) + 0.04 * Math.sin(ang * 5 + 4);
          const m = clamp((edge - rr) / 0.2);
          const n = nz.fbm((px * s) / 26 + 31, (py * s) / 9 + 17, 3);
          const j = (py * PW + px) * 4;
          d[j] = C[0]; d[j + 1] = C[1]; d[j + 2] = C[2];
          d[j + 3] = 255 * m * clamp(0.25 + (n - 0.35) * 1.6);
        }
      }
      g.putImageData(img, 0, 0);
      return c;
    }

    /* arbres morts, noirs : des branches qui se divisent, sans feuilles */
    function treeSegs(x, y, H, seed) {
      const R = lib.makeNoise(seed).rnd;
      const segs = [];
      function branch(bx, by, len, ang, wd, depth) {
        let cx = bx, cy = by, a = ang;
        const pts = [cx, cy];
        for (let i = 0; i < 3; i++) {
          a += (R() - 0.5) * 0.55;
          cx += (Math.cos(a) * len) / 3;
          cy += (Math.sin(a) * len) / 3;
          pts.push(cx, cy);
        }
        segs.push({ pts, wd });
        if (depth <= 0 || len < 1.6) return;
        const nb = depth > 3 ? 2 : R() < 0.55 ? 2 : 3;
        for (let i = 0; i < nb; i++) {
          const da = (i - (nb - 1) / 2) * (0.55 + R() * 0.4) + (R() - 0.5) * 0.3;
          branch(cx, cy, len * (0.62 + R() * 0.18), a + da, wd * 0.62, depth - 1);
        }
      }
      branch(x, y, H * 0.4, -Math.PI / 2 + (R() - 0.5) * 0.3, Math.max(1.4, H * 0.075), 4);
      return segs;
    }

    function strokeSegs(g, segs, map, wk) {
      g.lineCap = 'round';
      g.lineJoin = 'round';
      for (const s of segs) {
        g.lineWidth = s.wd * wk;
        g.beginPath();
        for (let i = 0; i < s.pts.length; i += 2) {
          const p = map ? map(s.pts[i], s.pts[i + 1]) : null;
          const px = p ? p[0] : s.pts[i], py = p ? p[1] : s.pts[i + 1];
          if (i) g.lineTo(px, py);
          else g.moveTo(px, py);
        }
        g.stroke();
      }
    }

    function makeTrees(w, h) {
      const { c, g } = layer(w, h);
      const spots = [[-0.45, -0.2, 1, 3], [0.3, 0.4, 1, 8], [0.74, -0.45, 0.72, 14]];
      for (const [ox, oy, k, seed] of spots) {
        const x = G.px + ox * G.prx, y = G.py + oy * G.pry;
        const H = (h * 0.18 * k) / zy(y);
        const segs = treeSegs(x, y, H, seed);
        /* ombre du matin couchée sur le sol : le soleil bas, à gauche, au fond,
           l’étire vers la droite et vers l’avant */
        const L = 1.05, Q = 0.32;
        const q = [0, 0];
        const map = (px, py) => {
          const hh = y - py;
          q[0] = px + L * hh;
          q[1] = y + Q * hh;
          return q;
        };
        g.strokeStyle = 'rgba(120,64,40,0.22)';
        strokeSegs(g, segs, map, 0.8);
        g.strokeStyle = '#1C1311';
        strokeSegs(g, segs, null, 1);
        g.fillStyle = '#1C1311';
        g.beginPath();
        g.ellipse(x, y, H * 0.06, H * 0.02, 0, 0, TAU);
        g.fill();
      }
      return c;
    }

    cv.onResize((w, h) => layout(w, h));

    /* ---------- état initial ---------- */
    function init() {
      specks = [];
      puffs = [];
      streaks = [];
      ripples = [];
      rings = [];
      patches = [];
      schools = [];
      dustLevel = 1;
      food = 0;
      bloom = 0;
      finished = false;
      started = false;
      wind = 0;
      msgT = 0;
      weakT = -1;
      misses = 0;
      lastX = null;
      moveAcc = 0;
      api.status('');
      api.progress(0);
      api.gesture('swipe', { x: 30, y: 60 });
    }

    function baseStatus() {
      if (finished) return;
      api.status(started && patches.length ? TEXTES.croissance : '');
    }
    function tempStatus(t, dur) {
      if (finished) return;
      api.status(t);
      msgT = dur || 2.8;
    }

    /* ---------- vent et poussière ---------- */
    function panPoint() {
      const a = rand(TAU), r = Math.sqrt(Math.random()) * 0.85;
      const x = G.px + Math.cos(a) * r * G.prx, y = G.py + Math.sin(a) * r * G.pry;
      const z = zy(y);
      return { x, y, z, X: toX(x, z) };
    }

    function spawnSpeck(S, t0) {
      const P = panPoint();
      const f = Math.min(0.985, S * rand(0.6, 1.15));
      const z1 = clamp(P.z + rand(-0.35, 1.6) * S, 1.06, ZC - 0.1);
      const Lx = lerp(P.x, G.w * 0.985, f);
      const sea = inOcean(Lx, gy(z1));
      if (specks.length >= MAXSPECK) {
        /* trop de grains en vol : un grain déjà parti vers la mer en portera deux */
        if (sea) {
          for (let k = 0; k < 6; k++) {
            const o = specks[Math.floor(Math.random() * specks.length)];
            if (o.sea && o.land < 0) { o.wt++; break; }
          }
        }
        return sea;
      }
      specks.push({
        X0: P.X, z0: P.z, X1: toX(Lx, z1), z1, t: t0, T: rand(1.2, 1.9) + f * 0.9,
        H: G.D * (0.12 + 0.3 * S * rand(0.55, 1.2)), ph: rand(TAU), r: rand(0.7, 1.7) * G.U, col: pick(DUST), land: -1, sea, wt: 1,
      });
      return sea;
    }

    function spawnPuff(S, t0) {
      if (puffs.length >= MAXPUFF) return;
      const P = panPoint();
      const f = Math.min(0.95, S * rand(0.4, 1.05));
      const z1 = clamp(P.z + rand(-0.2, 1.3) * S, 1.08, 4);
      const X1 = toX(lerp(P.x, G.w, f), z1);
      puffs.push({ X0: P.X, z0: P.z, X1, z1, t: t0, T: rand(2.6, 3.8), H: G.D * (0.1 + 0.3 * S * rand(0.6, 1.1)), ph: rand(TAU), r: rand(0.8, 1.3), a: rand(0.32, 0.48) });
    }

    function spawnStreak(S, t0, x, y, dir) {
      if (streaks.length >= MAXSTREAK) return;
      streaks.push({
        x: x == null ? rand(-0.3, 0.35) * G.w : x,
        y: y == null ? rand(G.hy - G.h * 0.12, G.fy - G.h * 0.04) : y + rand(-6, 6) * G.U,
        len: rand(0.1, 0.22) * G.w, spd: (0.55 + 0.6 * S) * G.w, t: t0, dur: rand(0.6, 1.1),
        amp: rand(2, 6) * G.U, fq: rand(0.02, 0.05) / G.U, ph: rand(TAU), a: 0.22 + 0.32 * S, wd: rand(1, 1.8) * G.U, dir: dir || 1,
      });
    }

    function gust(S, small) {
      started = true;
      const n = Math.round(small ? 70 + 60 * S : 90 + 110 * S);
      let sea = 0;
      const made = n;
      for (let i = 0; i < n; i++) if (spawnSpeck(S, -rand(0, 0.6))) sea++;
      const np = Math.round(8 + 24 * S);
      for (let i = 0; i < np; i++) spawnPuff(S, -rand(0, 0.9));
      const ns = Math.round(5 + 14 * S);
      for (let i = 0; i < ns; i++) spawnStreak(S, -rand(0, 0.45));
      dustLevel = Math.max(0.45, dustLevel - 0.1 * S);
      wind = Math.max(wind, S);
      api.sfx.play('whoosh', { volume: 0.35 + 0.5 * S, pitch: 0.8 + 0.3 * S, gap: 0 });
      api.sfx.play('wind', { volume: 0.4 + 0.6 * S, pitch: 0.8 + 0.4 * S, gap: 0 });
      api.buzz(10);
      /* si la plupart des grains retombent sur le sable, on conseille un geste plus ample */
      if (!small && sea / made < 0.4) weakT = 1.2;
      else weakT = -1;
    }

    /* chaque grain tombé dans l’eau nourrit la floraison la plus proche, ou en fait naître une.
       La taille des floraisons suit la quantité de poussière reçue : la progression mesure
       donc l’étendue du plancton. */
    function patchR(n) {
      return G.w * Math.min(0.24, 0.06 + 0.016 * Math.sqrt(n));
    }
    function nutrient(X, z, wt) {
      food += wt;
      let best = null, bd = Infinity;
      for (const p of patches) {
        const R = Math.max(p.rT, G.w * 0.14);
        const dx = (X - p.X) / R, dz = ((z - p.z) * G.Zs) / R;
        const dd = dx * dx + dz * dz;
        if (dd < bd) { bd = dd; best = p; }
      }
      if (!best || (bd > 1 && patches.length < MAXPATCH)) {
        best = { X, z, n: 0, r: 0, rT: 0, rot: rand(TAU), vr: rand(-0.06, 0.06), spr: randInt(0, bloomSpr.length - 1), a: 0, ph: rand(TAU) };
        patches.push(best);
        if (!finished && patches.length === 1 && msgT <= 0) baseStatus();
      }
      best.n += wt;
      best.rT = patchR(best.n);
    }

    /* ---------- gestes ---------- */
    function onTap(x, y) {
      const desert = x < coastX(clamp(y, G.hy, G.fy)) - 2;
      if (desert) {
        misses = 0;
        rings.push({ x, y, t: 0, dur: 0.55, col: '#FFF3E8', r0: 4, r1: 28 * G.U, w: 2 });
        for (let i = 0; i < 4; i++) spawnStreak(0.5, -i * 0.05, x - G.w * 0.05, y, 1);
        gust(0.7, true);
      } else {
        rings.push({ x, y, t: 0, dur: 0.6, col: '#D8F5FA', r0: 3, r1: 18 * G.U, w: 1.5 });
        if (inOcean(x, y) && ripples.length < MAXRIP) ripples.push({ x, y, t: 0, dur: 0.9, r: 10 * G.U, z: zy(y) });
        api.sfx.play('bubble', { pitch: 0.8, volume: 0.3 });
        misses++;
        if (misses >= 2) {
          misses = 0;
          tempStatus(TEXTES.rate);
          api.gesture('swipe', { x: 30, y: 60 });
        }
      }
    }

    api.track(cv.canvas, {
      down(p) {
        lastX = p.x;
        moveAcc = 0;
        rings.push({ x: p.x, y: p.y, t: 0, dur: 0.4, col: '#FFF3E8', r0: 3, r1: 14 * G.U, w: 1.5 });
      },
      move(p) {
        if (lastX == null) return;
        const dx = p.x - lastX;
        lastX = p.x;
        moveAcc += dx;
        if (moveAcc > 16 * G.U) {
          moveAcc = 0;
          spawnStreak(0.5, 0, p.x - G.w * 0.08, p.y, 1);
          if (p.x < coastX(clamp(p.y, G.hy, G.fy))) {
            for (let i = 0; i < 2; i++) spawnPuff(0.35, 0);
            for (let i = 0; i < 3; i++) spawnSpeck(0.4, 0);
          }
          api.sfx.play('wind', { volume: 0.35, pitch: 1.1, gap: 260 });
        } else if (moveAcc < -16 * G.U) {
          moveAcc = 0;
          spawnStreak(0.35, 0, p.x + G.w * 0.08, p.y, -1);
        }
      },
      up(p, e, cancelled) {
        lastX = null;
        if (cancelled) return;
        if (p.tap) {
          onTap(p.x, p.y);
          return;
        }
        const dx = p.x - p.x0, dy = p.y - p.y0;
        if (Math.abs(dx) < 24 || Math.abs(dx) < Math.abs(dy) * 0.8) return;
        if (dx > 0) {
          const spd = dx / Math.max(60, p.dt);
          const S = clamp(0.22 + 0.5 * clamp(dx / (0.55 * G.w)) + 0.4 * clamp(spd / 1.1), 0.25, 1);
          misses = 0;
          gust(S, false);
        } else {
          tempStatus(TEXTES.sens);
          api.sfx.play('wind', { pitch: 0.7, volume: 0.4 });
        }
      },
    }, { touchAction: 'pan-y' });

    /* ---------- animation ---------- */
    function trajectory(s, out) {
      const k = clamp(s.t / s.T);
      const e = ease.outQuad(k) * 0.8 + k * 0.2;
      const bump = Math.sin(Math.PI * k);
      const X = lerp(s.X0, s.X1, e) + Math.sin(time * 2 + s.ph) * 3 * G.U * bump;
      const z = lerp(s.z0, s.z1, e);
      const Y = s.H * Math.sin(Math.PI * Math.pow(k, 0.65)) * (1 + 0.18 * Math.sin(time * 3.1 + s.ph * 2));
      out.x = toSx(X, z);
      out.y = gy(z) - Y / z;
      out.z = z;
      out.k = k;
    }
    const tp = { x: 0, y: 0, z: 1, k: 0 };

    function update(dt) {
      time += dt;
      wind *= Math.pow(0.5, dt);
      dustLevel = Math.min(1, dustLevel + dt * 0.012);
      if (msgT > 0) {
        msgT -= dt;
        if (msgT <= 0) baseStatus();
      }
      if (weakT > 0) {
        weakT -= dt;
        if (weakT <= 0) tempStatus(TEXTES.faible, 3.2);
      }

      /* poussières */
      let n = 0;
      for (const s of specks) {
        if (s.land >= 0) {
          s.land += dt;
          if (s.land < 0.5) specks[n++] = s;
          continue;
        }
        s.t += dt;
        if (s.t >= s.T) {
          s.land = 0;
          if (s.sea) {
            nutrient(s.X1, s.z1, s.wt);
            const x = toSx(s.X1, s.z1), y = gy(s.z1);
            if (ripples.length < MAXRIP && Math.random() < 0.45) ripples.push({ x, y, t: 0, dur: rand(0.8, 1.2), r: rand(5, 9) * G.U / s.z1, z: s.z1 });
            api.sfx.play('bubble', { gap: 130, volume: 0.22, pitch: rand(0.8, 1.4) });
          }
        }
        specks[n++] = s;
      }
      specks.length = n;
      n = 0;
      for (const p of puffs) {
        p.t += dt;
        if (p.t < p.T) puffs[n++] = p;
      }
      puffs.length = n;
      n = 0;
      for (const s of streaks) {
        s.t += dt;
        if (s.t < s.dur) streaks[n++] = s;
      }
      streaks.length = n;
      n = 0;
      for (const r of ripples) {
        r.t += dt;
        if (r.t < r.dur) ripples[n++] = r;
      }
      ripples.length = n;
      n = 0;
      for (const r of rings) {
        r.t += dt;
        if (r.t < r.dur) rings[n++] = r;
      }
      rings.length = n;

      /* floraison : le plancton s’étale de plus en plus à mesure qu’il prolifère */
      const prog = clamp(food / NEED);
      bloom += (prog - bloom) * (1 - Math.exp(-dt * 1.2));
      const spread = 0.75 + 0.45 * bloom;
      for (const p of patches) {
        p.r += (p.rT * spread - p.r) * (1 - Math.exp(-dt * 0.9));
        p.a = Math.min(1, p.a + dt / 1.2);
        p.rot += p.vr * dt;
        p.X += dt * 1.5 * G.U;
      }
      if (!finished && food > 0) {
        api.progress(prog);
        if (prog >= 0.6 && schools.length < 1) {
          spawnSchool();
          tempStatus(TEXTES.poissons, 3.2);
        }
        if (prog >= 0.85 && schools.length < 2) spawnSchool();
        if (prog >= 1) {
          finished = true;
          if (schools.length < 3) spawnSchool();
          api.done(TEXTES.fin, TEXTES.finStatut);
        }
      }

      /* bancs de poissons */
      for (const s of schools) {
        s.t += dt;
        s.a = Math.min(1, s.a + dt / 1.6);
        const xL = lerp(G.cf, G.w, 0.3) + s.size, xR = G.w - s.size * 1.2;
        if (s.dir > 0 && s.x > xR) s.dir = -1;
        else if (s.dir < 0 && s.x < xL) s.dir = 1;
        const tgt = s.dir > 0 ? 0 : Math.PI;
        let da = tgt - s.hd;
        da -= Math.round(da / TAU) * TAU;
        s.hd += da * Math.min(1, dt * 1.4);
        s.x += Math.cos(s.hd) * s.spd * dt;
        const yMin = G.fy + G.FH * 0.2, yMax = Math.max(yMin + 2, floorY(s.x) - G.FH * 0.16);
        const yT = clamp(lerp(yMin, yMax, 0.5 + 0.4 * Math.sin(s.t * 0.45 + s.ph)), yMin, yMax);
        s.y += (yT - s.y) * Math.min(1, dt * 1.2);
      }

      /* ambiance : vagues, poussière en suspension, plancton */
      const sp = CALM ? 0.3 : 1;
      for (const wv of waves) {
        wv.X -= dt * 5 * G.U * sp;
        const y = gy(wv.z);
        if (toSx(wv.X, wv.z) < coastX(y) + 3) wv.X = toX(G.w + 4, wv.z);
      }
      for (const a of air) {
        a.x += dt * (6 + wind * 40) * G.U * sp;
        a.y += Math.sin(time * 0.9 + a.ph) * dt * 4 * G.U * sp;
        if (a.x > G.px + G.prx * 1.3) {
          a.x = G.px - G.prx * 1.1;
          a.y = G.py - rand(2, 30) * G.U;
        }
      }
      for (const m of motes) {
        m.x += Math.sin(time * 0.3 + m.ph) * dt * 3 * G.U * sp;
        m.y += Math.cos(time * 0.25 + m.ph) * dt * 2 * G.U * sp;
      }
    }

    function spawnSchool() {
      const n = randInt(11, 16);
      const fish = [];
      for (let i = 0; i < n; i++) fish.push({ ox: rand(-1, 1), oy: rand(-0.6, 0.6), ph: rand(TAU), s: rand(0.8, 1.15) });
      schools.push({ x: G.w + 26 * G.U, y: G.fy + G.FH * rand(0.3, 0.45), hd: Math.PI, dir: -1, spd: rand(15, 23) * G.U, t: 0, a: 0, fish, size: rand(8, 11) * G.U, ph: rand(TAU) });
    }

    /* ---------- dessin ---------- */
    function drawOcean() {
      if (bloom > 0.005) {
        ctx.fillStyle = rgba('#2FBF9B', 0.16 * bloom);
        ctx.fill(oceanPath);
      }
      ctx.save();
      ctx.clip(oceanPath);
      /* éclats des vagues */
      ctx.lineCap = 'round';
      for (const wv of waves) {
        const x = toSx(wv.X, wv.z), y = gy(wv.z);
        const l = (wv.len * G.U) / wv.z;
        const a = 0.35 * (0.5 + 0.5 * Math.sin(time * 1.3 + wv.ph));
        ctx.strokeStyle = rgba('#EAF8FA', a);
        ctx.lineWidth = Math.max(0.7, 1.5 / Math.sqrt(wv.z));
        ctx.beginPath();
        ctx.moveTo(x - l, y);
        ctx.quadraticCurveTo(x, y - 1.5 / wv.z, x + l, y);
        ctx.stroke();
      }
      /* floraison de plancton */
      for (const p of patches) {
        if (p.r < 0.5) continue;
        const x = toSx(p.X, p.z), y = gy(p.z);
        const br = 1 + 0.03 * Math.sin(time * 0.8 + p.ph);
        const rx = (p.r / p.z) * br, ry = ((p.r * PERS) / (p.z * p.z)) * br;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(rx, ry);
        ctx.rotate(p.rot);
        ctx.globalAlpha = p.a * 0.92;
        ctx.drawImage(bloomSpr[p.spr], -1, -1, 2, 2);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      /* ronds dans l’eau là où la poussière retombe */
      for (const r of ripples) {
        const k = r.t / r.dur;
        const rr = r.r * (0.3 + ease.outCubic(k));
        ctx.strokeStyle = rgba('#F4FBF8', 0.6 * (1 - k));
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(r.x, r.y, rr, (rr * PERS) / Math.max(1, r.z * 0.8), 0, 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
      /* écume le long de la côte */
      ctx.lineCap = 'round';
      for (let j = 0; j < 2; j++) {
        ctx.strokeStyle = rgba('#FFFFFF', (j ? 0.35 : 0.65) * (0.75 + 0.25 * Math.sin(time * 1.7 + j * 2)));
        ctx.beginPath();
        for (let y = G.hy + 2; y <= G.fy; y += 4) {
          const t = (y - G.hy) / G.D;
          const off = (1 + j * 3 + Math.sin(y * 0.35 + time * (CALM ? 0.3 : 1.6) + j) * 1.2) * t * G.U * 1.6;
          const x = coastX(y) + off;
          if (y === G.hy + 2) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.lineWidth = j ? 1 : 1.6;
        ctx.stroke();
      }
    }

    function drawWater() {
      const cov = bloom;
      if (cov < 0.01 && !schools.length) return;
      ctx.save();
      ctx.clip(waterPath);
      if (cov > 0.01) {
        const gr = ctx.createLinearGradient(0, G.fy, 0, G.fy + G.FH * 0.55);
        gr.addColorStop(0, rgba('#2FBF9B', 0.55 * cov));
        gr.addColorStop(1, rgba('#2FBF9B', 0));
        ctx.fillStyle = gr;
        ctx.fillRect(G.cf, G.fy, G.w - G.cf, G.FH * 0.55);
        const nm = Math.round(motes.length * cov);
        for (let i = 0; i < nm; i++) {
          const m = motes[i];
          ctx.fillStyle = rgba(i % 2 ? '#8FE3B5' : '#2FBF9B', 0.75);
          ctx.fillRect(m.x, m.y, m.s * G.U, m.s * G.U);
        }
      }
      for (const s of schools) {
        const ch = Math.cos(s.hd), sh = Math.sin(s.hd);
        for (const f of s.fish) {
          const ox = f.ox * s.size * 1.4 + Math.sin(time * 2.2 + f.ph) * 1.2 * G.U;
          const oy = f.oy * s.size + Math.cos(time * 1.7 + f.ph) * G.U;
          const fx = s.x + ox * ch - oy * sh, fyy = s.y + ox * sh + oy * ch;
          drawFish(fx, fyy, s.hd + Math.sin(time * 6 + f.ph) * 0.12, f.s * G.U, s.a);
        }
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    function drawFish(x, y, a, sc, al) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.scale(sc, Math.cos(a) < 0 ? -sc : sc);
      ctx.globalAlpha = al;
      ctx.fillStyle = '#B7DCE2';
      ctx.beginPath();
      ctx.ellipse(0, 0, 3.4, 1.25, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-2.8, 0);
      ctx.lineTo(-5.1, -1.5);
      ctx.lineTo(-5.1, 1.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#3E6D80';
      ctx.beginPath();
      ctx.ellipse(0.3, -0.5, 2.7, 0.55, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    function drawDesertFx() {
      /* poussière fine qui flotte au-dessus de la cuvette */
      for (const a of air) {
        ctx.fillStyle = rgba('#F6E6D8', 0.45 * (0.6 + 0.4 * Math.sin(time * 1.3 + a.ph)));
        ctx.fillRect(a.x, a.y, a.s * G.U, a.s * G.U);
      }
      /* sable arraché aux crêtes */
      const wv = 0.35 + wind * 0.9;
      ctx.lineCap = 'round';
      for (const c of crests) {
        for (let j = 0; j < 2; j++) {
          const ph = time * (1.3 + j * 0.5) + c.ph + j;
          const len = c.s * (12 + 8 * Math.sin(ph)) * (0.7 + wind * 1.5) * G.U;
          ctx.strokeStyle = rgba('#FBE3C8', (0.18 + 0.1 * Math.sin(ph * 1.3)) * wv);
          ctx.lineWidth = 1.1 * G.U;
          ctx.beginPath();
          ctx.moveTo(c.x, c.y + 0.5);
          ctx.quadraticCurveTo(c.x + len * 0.5, c.y - 1.5 - j, c.x + len, c.y + 1 + j * 2);
          ctx.stroke();
        }
      }
    }

    function drawPlume() {
      for (const p of puffs) {
        if (p.t <= 0) continue;
        trajectory(p, tp);
        const k = tp.k;
        const r = ((0.07 + 0.28 * k) * G.D * p.r) / tp.z;
        ctx.globalAlpha = p.a * Math.sin(Math.PI * Math.min(1, k * 1.05)) * (1 - 0.35 * k);
        ctx.drawImage(puffSpr, tp.x - r, tp.y - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
      for (const s of specks) {
        if (s.t <= 0) continue;
        let a;
        if (s.land >= 0) {
          a = 0.8 * (1 - s.land / 0.5);
          tp.x = toSx(s.X1, s.z1);
          tp.y = gy(s.z1);
          tp.z = s.z1;
        } else {
          trajectory(s, tp);
          a = 0.9 * Math.min(1, tp.k * 8);
        }
        const r = (s.r * 1.4) / Math.sqrt(tp.z);
        ctx.fillStyle = rgba(s.col, a);
        ctx.fillRect(tp.x - r / 2, tp.y - r / 2, r, r);
      }
    }

    function drawStreaks() {
      for (const s of streaks) {
        if (s.t <= 0) continue;
        const k = s.t / s.dur;
        const a = s.a * Math.sin(Math.PI * k);
        const head = s.x + s.dir * s.spd * s.t;
        ctx.lineWidth = s.wd;
        ctx.lineCap = 'round';
        for (let i = 0; i < 7; i++) {
          const t0 = i / 7, t1 = (i + 1) / 7;
          const xa = head - s.dir * s.len * (1 - t0), xb = head - s.dir * s.len * (1 - t1);
          const ya = s.y + Math.sin(xa * s.fq + s.ph) * s.amp, yb = s.y + Math.sin(xb * s.fq + s.ph) * s.amp;
          ctx.strokeStyle = rgba('#FFF8EF', a * t1);
          ctx.beginPath();
          ctx.moveTo(xa, ya);
          ctx.lineTo(xb, yb);
          ctx.stroke();
        }
      }
    }

    function drawRings() {
      for (const r of rings) {
        const k = r.t / r.dur;
        ctx.strokeStyle = rgba(r.col, 0.8 * (1 - k));
        ctx.lineWidth = r.w;
        ctx.beginPath();
        ctx.arc(r.x, r.y, lerp(r.r0, r.r1, ease.outCubic(k)), 0, TAU);
        ctx.stroke();
      }
    }

    function render() {
      if (!bg) return;
      ctx.drawImage(bg, 0, 0, G.w, G.h);
      drawOcean();
      drawWater();
      ctx.globalAlpha = 0.8 * dustLevel;
      ctx.drawImage(dustL, G.px - G.prx, G.py - G.pry, G.prx * 2, G.pry * 2);
      ctx.globalAlpha = 1;
      ctx.drawImage(treesL, 0, 0, G.w, G.h);
      drawDesertFx();
      drawPlume();
      drawStreaks();
      drawRings();
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
