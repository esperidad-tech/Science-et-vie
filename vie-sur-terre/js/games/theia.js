/* La Lune, née d'un choc : une fronde cosmique. On tire Théia vers l'arrière, on vise la
   jeune Terre et on lâche. Le choc projette des débris qui forment un anneau, puis
   s'agglutinent en une Lune qui finit par tourner seule autour de la Terre. */
(function () {
  'use strict';
  const { lib } = window.RM;
  const { TAU, rand, clamp, lerp, ease, rgba, draw } = lib;

  const TEXTES = {
    rate: 'Raté de peu ! Vise un peu plus vers la Terre.',
    anneau: 'Les débris forment un anneau autour de la Terre…',
    fin: 'Les débris se sont rassemblés : la Lune est née.',
    finStatut: 'Au début, la Lune tournait bien plus près de la Terre qu’aujourd’hui.',
  };

  const smooth = (t) => {
    t = clamp(t);
    return t * t * (3 - 2 * t);
  };
  const wrapPi = (a) => {
    while (a > Math.PI) a -= TAU;
    while (a < -Math.PI) a += TAU;
    return a;
  };
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

  window.RM.games.theia = function (api) {
    const cv = api.canvas();
    const ctx = cv.ctx;
    const RM = api.reducedMotion;

    /* ---- réglages ---- */
    const N = 250;              /* débris projetés par le choc */
    const SQUASH = 0.34;        /* anneau vu de biais */
    const TILT = -0.16;         /* légère inclinaison de l'anneau */
    const STEP = 1 / 120;       /* pas fixe : la prévision et le vol sont identiques */
    /* vitesses en « distance Théia–Terre par seconde », gravité réglée pour pardonner */
    /* après tDecay, Théia est freinée et attirée plus fort : elle finit en spirale sur la Terre */
    const PHYS = { vmin: 0.35, vmax: 1.5, g: 0.9, gLate: 3, drag: 0.3, drag2: 2.2, tDecay: 1.3, hit: 0.9, assist: 0.12 };
    const LEAVE = 1.15;         /* qui s'éloigne au-delà de cette distance (× Théia–Terre) a raté */
    const OMEGA = TAU / 6.5;    /* rotation de l'anneau */
    const T_HINT = 0.6, T_RING = 2.0, T_ACC = 2.5, T_SPREAD = 2.1, T_TRAVEL = 0.4;
    const T_FLY_MAX = 4;        /* filet de sécurité : un vol ne dure jamais plus longtemps */

    /* couleurs des débris : du magma qui refroidit en roche grise */
    const HOT = ['#FFF3CF', '#FFD67E', '#FFAA55', '#FF8040'];
    const ROCK = ['#C4B8AC', '#A39589', '#8A7D74', '#D2C9BF'];
    const RING_HOT = lib.hexToRgb('#FFC48A'), RING_COOL = lib.hexToRgb('#CFC3B6');
    const STEPS = 12;
    const COLS = HOT.map((hc, p) => {
      const row = [];
      for (let s = 0; s <= STEPS; s++) row.push(lib.mix(hc, ROCK[p], s / STEPS));
      return row;
    });

    /* ---- état ---- */
    let bg = null, theiaSurf = null, theiaShade = null, moonSpr = null, glowHot = null, glowSoft = null;
    let phase = 'aim';          /* aim | pull | fly | miss | impact */
    let time = 0;
    let T = 0;                  /* temps depuis le choc */
    let missT = 0;
    let appear = 1;             /* retour de Théia après un raté */
    let nudge = 0;              /* Théia s'illumine quand on touche ailleurs */
    let slingA = 1;             /* la fronde s'efface après le choc */
    let finished = false, hinted = false, ringed = false, accInit = false, missed = false;
    let captured = 0, capturable = N, shownP = -1;
    let moonTh = 0, rhoM = 1, doneT = 0, moonFlash = 0;
    let ringDir = 1;            /* sens de rotation de l'anneau (celui de Théia autour de la Terre) */
    let shakeX = 0, shakeY = 0;
    const th = { x: 0, y: 0, vx: 0, vy: 0, t: 0, rot: 0, acc: 0 };
    const pull = { id: -1, sx: 0, sy: 0, len: 0, f: 0, ux: 0, uy: 1, disp: 0, lastF: 0 };
    const band = { t: 9, amp: 0, ux: 0, uy: 1 };
    const hit = { x: 0, y: 0, ux: 0, uy: 1, tx: 0, ty: 0 };
    const sim = { x: 0, y: 0, vx: 0, vy: 0, t: 0 };
    const P = { x: 0, y: 0 };
    const PREV_MAX = 80;
    const prev = new Float32Array(PREV_MAX * 2);
    let prevN = 0, prevHit = false;
    const prevImp = { x: 0, y: 0 };
    const TRAIL = 14;
    const trail = new Float32Array(TRAIL * 2);
    let trailN = 0, trailI = 0;
    const taps = [];
    const twinkles = [];
    const deb = [];
    for (let i = 0; i < N; i++) {
      deb.push({
        state: 0, back: false, x0: 0, y0: 0, vx: 0, vy: 0, k: 2, rho: 1, om: OMEGA, th0: 0, sp: 0,
        tb0: 0, tb1: 1, tf: 1, fx: 0, fy: 0, dm: 0, tc: 9, size: 1, pair: 0, hot: false, cr: 1,
        px: 0, py: 0, front: true, depth: 1, cool: 0, alpha: 1,
      });
    }

    /* ---- géométrie ---- */
    const geo = {
      w: 1, h: 1, S: 1, ex: 0, ey: 0, R0: 1, tr: 1, tx: 0, ty: 0, D: 1, A: 1, Rm: 1,
      maxPull: 80, grabR: 60, lx: 0, ly: 0, rx: 0, ry: 0,
    };
    function layout(w, h) {
      geo.w = w;
      geo.h = h;
      geo.S = Math.min(w, h);
      geo.ex = w * 0.5;
      geo.ey = h * 0.36;
      geo.R0 = geo.S * 0.12;
      geo.tr = geo.S * 0.07;
      geo.tx = w * 0.5;
      geo.ty = h * 0.82;
      geo.D = Math.hypot(geo.tx - geo.ex, geo.ty - geo.ey);
      geo.A = Math.min(geo.R0 * 2.55, w * 0.4);
      geo.Rm = geo.R0 * 0.34;
      geo.maxPull = clamp(geo.S * 0.24, 60, 130);
      geo.grabR = Math.max(60, geo.tr * 2.4);
      geo.lx = geo.tx - geo.tr * 1.9;
      geo.rx = geo.tx + geo.tr * 1.9;
      geo.ly = geo.ry = geo.ty + geo.tr * 0.35;
    }

    /* position à l'écran d'un point de l'anneau (angle, rayon relatif) */
    const COS_T = Math.cos(TILT), SIN_T = Math.sin(TILT);
    function ringPos(a, rho, out) {
      const lx = Math.cos(a) * rho * geo.A;
      const ly = Math.sin(a) * rho * geo.A * SQUASH;
      out.x = geo.ex + lx * COS_T - ly * SIN_T;
      out.y = geo.ey + lx * SIN_T + ly * COS_T;
    }
    function ringAngle(x, y) {
      const dx = x - geo.ex, dy = y - geo.ey;
      const lx = dx * COS_T + dy * SIN_T;
      const ly = (-dx * SIN_T + dy * COS_T) / SQUASH;
      return Math.atan2(ly, lx);
    }

    /* ---- textures de la jeune Terre (la même planète qu'à la fin du chapitre précédent) ---- */
    const LW = 320, LH = 160;
    const field = new Float32Array(LW * LH);
    (function makeField() {
      const n = lib.makeNoise(7);
      for (let y = 0; y < LH; y++) {
        for (let x = 0; x < LW; x++) {
          const a = (x / LW) * TAU;
          field[y * LW + x] = n.fbm(Math.cos(a) * 3.2 + 10, Math.sin(a) * 3.2 + y / 15.9, 4);
        }
      }
    })();
    function paintLava(thr, pal) {
      const c = document.createElement('canvas');
      c.width = LW;
      c.height = LH;
      const g = c.getContext('2d');
      const img = g.createImageData(LW, LH);
      const d = img.data;
      const C = {};
      Object.keys(pal).forEach((k) => { C[k] = lib.hexToRgb(pal[k]); });
      for (let i = 0; i < field.length; i++) {
        const v = field[i];
        let r, gg, b;
        if (v < thr) {
          const k = clamp((thr - v) * 6);
          r = lerp(C.hot[0], C.deep[0], k); gg = lerp(C.hot[1], C.deep[1], k); b = lerp(C.hot[2], C.deep[2], k);
        } else {
          const k = clamp((v - thr) * 7);
          r = lerp(C.crustA[0], C.crustB[0], k); gg = lerp(C.crustA[1], C.crustB[1], k); b = lerp(C.crustA[2], C.crustB[2], k);
        }
        const edge = Math.abs(v - thr);
        if (edge < 0.018) {
          const e = 1 - edge / 0.018;
          r = lerp(r, C.rim[0], e); gg = lerp(gg, C.rim[1], e); b = lerp(b, C.rim[2], e);
        }
        const j = i * 4;
        d[j] = r; d[j + 1] = gg; d[j + 2] = b; d[j + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      return c;
    }
    const lavaA = paintLava(0.6, { deep: '#E8501A', hot: '#FFB238', rim: '#FFF0B8', crustA: '#4A2118', crustB: '#1F0D0A' });
    const lavaB = paintLava(0.8, { deep: '#FF7A2A', hot: '#FFD772', rim: '#FFF8DA', crustA: '#8A3A1E', crustB: '#4A1A0E' });

    /* ---- sprites ---- */
    function makeCanvas(size) {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      return c;
    }
    function glowSprite(col, size) {
      const c = makeCanvas(size);
      const g = c.getContext('2d');
      draw.glow(g, size / 2, size / 2, size / 2, col, 1);
      return c;
    }
    function crater(g, x, y, cr, pal) {
      g.save();
      g.beginPath();
      g.arc(x, y, cr, 0, TAU);
      g.clip();
      g.fillStyle = rgba(pal.crater, 0.6);
      g.fillRect(x - cr, y - cr, cr * 2, cr * 2);
      g.fillStyle = rgba(pal.floor, 0.55);
      g.beginPath();
      g.arc(x + cr * 0.3, y + cr * 0.3, cr * 0.84, 0, TAU);
      g.fill();
      g.restore();
      g.lineWidth = Math.max(0.8, cr * 0.22);
      g.strokeStyle = rgba(pal.lit, 0.5);
      g.beginPath();
      g.arc(x, y, cr * 1.03, Math.PI * 0.95, Math.PI * 1.6);
      g.stroke();
      g.strokeStyle = rgba(pal.crater, 0.3);
      g.beginPath();
      g.arc(x, y, cr * 1.03, -Math.PI * 0.05, Math.PI * 0.6);
      g.stroke();
    }
    /* surface de roche cratérisée (sans éclairage : elle peut tourner) */
    function rockSurface(r, seed, pal, craters, maria) {
      const R = Math.max(4, r * cv.dpr);
      const size = Math.ceil(R * 2) + 2;
      const c = makeCanvas(size);
      const g = c.getContext('2d');
      const n = lib.makeNoise(seed);
      const img = g.createImageData(size, size);
      const d = img.data;
      const A = lib.hexToRgb(pal.a), B = lib.hexToRgb(pal.b), Cc = lib.hexToRgb(pal.c), Mm = lib.hexToRgb(pal.mare || pal.c);
      const cx = size / 2;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const dx = x + 0.5 - cx, dy = y + 0.5 - cx;
          const dd = Math.hypot(dx, dy);
          if (dd > R + 1) continue;
          const v = n.fbm(dx / R * 2.6 + 5, dy / R * 2.6 + 9, 5);
          const m = n.fbm(dx / R * 1.1 + 1, dy / R * 1.1 + 3, 3);
          const t = clamp((v - 0.28) * 2.3);
          let rr = lerp(Cc[0], A[0], t), gg = lerp(Cc[1], A[1], t), bb = lerp(Cc[2], A[2], t);
          const t2 = clamp((m - 0.48) * 3) * 0.55;
          rr = lerp(rr, B[0], t2); gg = lerp(gg, B[1], t2); bb = lerp(bb, B[2], t2);
          if (maria) {
            const mk = clamp((0.47 - m) * 9) * 0.75;
            rr = lerp(rr, Mm[0], mk); gg = lerp(gg, Mm[1], mk); bb = lerp(bb, Mm[2], mk);
          }
          const j = (y * size + x) * 4;
          d[j] = rr; d[j + 1] = gg; d[j + 2] = bb; d[j + 3] = 255 * clamp(R + 0.5 - dd);
        }
      }
      g.putImageData(img, 0, 0);
      g.save();
      g.beginPath();
      g.arc(cx, cx, R, 0, TAU);
      g.clip();
      for (let i = 0; i < craters; i++) {
        const a = n.rnd() * TAU, rr = Math.sqrt(n.rnd()) * R * 0.9;
        const cr = R * (0.05 + Math.pow(n.rnd(), 2) * 0.19);
        crater(g, cx + Math.cos(a) * rr, cx + Math.sin(a) * rr, cr, pal);
      }
      g.restore();
      return c;
    }
    /* éclairage fixe (lumière en haut à gauche, lueur orangée de la Terre au-dessus) */
    function shadeSprite(r, warm) {
      const R = Math.max(4, r * cv.dpr);
      const size = Math.ceil(R * 2) + 2;
      const c = makeCanvas(size);
      const g = c.getContext('2d');
      const cx = size / 2;
      g.beginPath();
      g.arc(cx, cx, R, 0, TAU);
      g.clip();
      const gr = g.createRadialGradient(cx - R * 0.38, cx - R * 0.42, R * 0.05, cx, cx, R * 1.04);
      gr.addColorStop(0, 'rgba(255,244,228,0.34)');
      gr.addColorStop(0.42, 'rgba(255,244,228,0)');
      gr.addColorStop(0.78, 'rgba(10,6,26,0.4)');
      gr.addColorStop(1, 'rgba(10,6,26,0.86)');
      g.fillStyle = gr;
      g.fillRect(0, 0, size, size);
      if (warm) {
        const wg = g.createLinearGradient(0, cx - R, 0, cx + R * 0.1);
        wg.addColorStop(0, 'rgba(255,140,60,0.42)');
        wg.addColorStop(1, 'rgba(255,140,60,0)');
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = wg;
        g.fillRect(0, 0, size, size);
      }
      return c;
    }
    function makeSprites() {
      theiaSurf = rockSurface(geo.tr, 11,
        { a: '#8E7B6B', b: '#B09A86', c: '#5B4A41', crater: '#3A2E29', floor: '#7C6A5C', lit: '#D2C1AF' }, 15, false);
      theiaShade = shadeSprite(geo.tr, true);
      const ms = rockSurface(geo.Rm, 23,
        { a: '#C9C4BE', b: '#DAD5CE', c: '#8F8A85', mare: '#6E6A67', crater: '#55514E', floor: '#A9A49E', lit: '#F2EEE8' }, 9, true);
      const sh = shadeSprite(geo.Rm, false);
      const g = ms.getContext('2d');
      g.drawImage(sh, 0, 0, ms.width, ms.height);
      moonSpr = ms;
      glowHot = glowSprite('#FFB060', 32);
      glowSoft = glowSprite('#FFE7C4', 48);
    }

    /* ---- fond : ciel étoilé, léger halo violet ---- */
    function makeBg(w, h) {
      const c = document.createElement('canvas');
      c.width = Math.round(w * cv.dpr);
      c.height = Math.round(h * cv.dpr);
      const g = c.getContext('2d');
      g.scale(cv.dpr, cv.dpr);
      g.fillStyle = '#0C0820';
      g.fillRect(0, 0, w, h);
      const M = Math.max(w, h);
      [
        [0.14, 0.1, 0.8, '#3A2380', 0.5],
        [0.95, 0.3, 0.55, '#5B2B83', 0.3],
        [0.5, 0.36, 0.42, '#3A2683', 0.5],
        [0.08, 0.95, 0.6, '#24164F', 0.55],
        [0.92, 0.98, 0.55, '#1B2766', 0.42],
      ].forEach(([x, y, r, col, a]) => draw.glow(g, x * w, y * h, r * M, col, a));
      /* une traînée de poussière d'étoiles en diagonale */
      g.save();
      g.translate(w * 0.5, h * 0.6);
      g.rotate(-0.6);
      g.save();
      g.scale(1, 0.16);
      draw.glow(g, 0, 0, M * 0.8, '#9483DE', 0.13);
      g.restore();
      for (let i = 0; i < 360; i++) {
        const x = rand(-1, 1) * M * 0.85;
        const y = gauss() * M * 0.08;
        g.fillStyle = rgba(['#FFFFFF', '#D6CCFF', '#FFE3C4'][i % 3], rand(0.08, 0.38));
        const s = rand(0.4, 1.1);
        g.fillRect(x, y, s, s);
      }
      g.restore();
      for (let i = 0; i < 120; i++) {
        g.fillStyle = rgba(['#FFFFFF', '#E2DAFF', '#FFEBD2', '#D2E9FF'][i % 4], rand(0.2, 0.75));
        const s = rand(0.5, 1.5);
        g.fillRect(rand(w), rand(h), s, s);
      }
      for (let i = 0; i < 6; i++) {
        const x = rand(w), y = rand(h);
        draw.glow(g, x, y, rand(5, 9), '#DCD6FF', 0.45);
        g.fillStyle = 'rgba(255,255,255,0.9)';
        g.beginPath();
        g.arc(x, y, 1.1, 0, TAU);
        g.fill();
      }
      return c;
    }
    function makeTwinkles(w, h) {
      twinkles.length = 0;
      const cols = ['#FFFFFF', '#DCD3FF', '#FFE6C8', '#CDE8FF'];
      for (let i = 0; i < 26; i++) {
        twinkles.push({ x: rand(w), y: rand(h), s: rand(0.9, 1.9), a: rand(0.35, 0.9), f: rand(0.8, 2.6), p: rand(TAU), c: cols[i % 4] });
      }
    }

    /* ---- physique de la fronde (gravité 2D simple) ---- */
    function stepBody(b, dt) {
      const late = b.t > PHYS.tDecay;
      const dx = geo.ex - b.x, dy = geo.ey - b.y;
      const d = Math.max(Math.hypot(dx, dy), geo.R0);
      const acc = PHYS.g * (late ? PHYS.gLate : 1) * geo.D * geo.D * geo.D / (d * d);
      b.vx += (dx / d) * acc * dt;
      b.vy += (dy / d) * acc * dt;
      const k = Math.exp(-(PHYS.drag + (late ? PHYS.drag2 : 0)) * dt);
      b.vx *= k;
      b.vy *= k;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.t += dt;
    }
    function hitTest(b) {
      return Math.hypot(b.x - geo.ex, b.y - geo.ey) < geo.R0 + geo.tr * PHYS.hit;
    }
    function outTest(b, m) {
      return b.x < -m || b.x > geo.w + m || b.y < -m || b.y > geo.h + m;
    }
    /* Théia file loin de la Terre : le tir est raté */
    function leaving(b) {
      const dx = b.x - geo.ex, dy = b.y - geo.ey;
      return b.t > 0.12 && dx * dx + dy * dy > geo.D * geo.D * LEAVE * LEAVE && dx * b.vx + dy * b.vy > 0;
    }
    function aimVelocity(x, y, ux, uy, f, out) {
      let a = Math.atan2(uy, ux);
      const toE = Math.atan2(geo.ey - y, geo.ex - x);
      a = toE + wrapPi(a - toE) * (1 - PHYS.assist);
      const sp = geo.D * lerp(PHYS.vmin, PHYS.vmax, f);
      out.vx = Math.cos(a) * sp;
      out.vy = Math.sin(a) * sp;
    }
    function roomAlong(x, y, ux, uy) {
      let t = 1e9;
      if (ux > 1e-6) t = Math.min(t, (geo.w - x) / ux);
      if (ux < -1e-6) t = Math.min(t, -x / ux);
      if (uy > 1e-6) t = Math.min(t, (geo.h - y) / uy);
      if (uy < -1e-6) t = Math.min(t, -y / uy);
      return t;
    }
    function setPull(dx, dy) {
      const len = Math.hypot(dx, dy);
      pull.len = len;
      pull.f = clamp(len / geo.maxPull);
      if (len < 0.5) {
        pull.disp = 0;
      } else {
        pull.ux = dx / len;
        pull.uy = dy / len;
        const room = roomAlong(geo.tx, geo.ty, pull.ux, pull.uy) - geo.tr * 0.35;
        const maxD = Math.max(8, Math.min(geo.maxPull * 0.9, room));
        pull.disp = maxD * Math.tanh(len / maxD);
      }
      th.x = geo.tx + pull.ux * pull.disp;
      th.y = geo.ty + pull.uy * pull.disp;
      computePreview();
    }
    function computePreview() {
      prevN = 0;
      prevHit = false;
      if (pull.len < 16) return;
      sim.x = th.x;
      sim.y = th.y;
      sim.t = 0;
      aimVelocity(th.x, th.y, -pull.ux, -pull.uy, pull.f, sim);
      for (let i = 1; i <= 330; i++) {
        stepBody(sim, STEP);
        if (hitTest(sim)) {
          prevHit = true;
          const dx = sim.x - geo.ex, dy = sim.y - geo.ey, d = Math.hypot(dx, dy) || 1;
          prevImp.x = geo.ex + dx / d * geo.R0;
          prevImp.y = geo.ey + dy / d * geo.R0;
          break;
        }
        if (outTest(sim, 0) || leaving(sim)) break;
        if (i % 5 === 0 && prevN < PREV_MAX) {
          prev[prevN * 2] = sim.x;
          prev[prevN * 2 + 1] = sim.y;
          prevN++;
        }
      }
    }

    /* ---- étapes du jeu ---- */
    function restTheia() {
      th.x = geo.tx;
      th.y = geo.ty;
      th.vx = th.vy = 0;
    }
    function launch(auto) {
      phase = 'fly';
      th.t = 0;
      th.acc = 0;
      trailN = 0;
      if (auto) {
        const dx = geo.ex - th.x, dy = geo.ey - th.y, d = Math.hypot(dx, dy) || 1;
        const sp = geo.D * lerp(PHYS.vmin, PHYS.vmax, 0.3);
        th.vx = dx / d * sp;
        th.vy = dy / d * sp;
        band.amp = 7;
        band.ux = 0;
        band.uy = 1;
      } else {
        aimVelocity(th.x, th.y, -pull.ux, -pull.uy, pull.f, th);
        band.amp = Math.max(7, pull.disp * 0.45);
        band.ux = pull.ux;
        band.uy = pull.uy;
      }
      band.t = 0;
      prevN = 0;
      api.gesture(null);
      api.progress(0.2);
      api.sfx.play('whoosh', { pitch: 0.8 + pull.f * 0.5, gap: 0 });
      api.buzz(10);
    }
    function miss() {
      phase = 'miss';
      missT = 0;
      missed = true;
      /* assez de vitesse pour qu'on la voie s'éloigner */
      const dx = th.x - geo.ex, dy = th.y - geo.ey, d = Math.hypot(dx, dy) || 1;
      const sp = Math.hypot(th.vx, th.vy), want = geo.D * 1.2;
      if (sp < want) {
        th.vx += (dx / d) * (want - sp);
        th.vy += (dy / d) * (want - sp);
      }
      api.sfx.play('whoosh', { pitch: 0.6, volume: 0.5, gap: 0 });
      api.hint(TEXTES.rate);
      api.progress(0);
    }
    function backToAim() {
      phase = 'aim';
      appear = 0;
      restTheia();
      pull.len = 0;
      pull.f = 0;
      pull.disp = 0;
      api.sfx.play('pop', { pitch: 0.7, volume: 0.6 });
      api.gesture('drag', { x: 50, y: 82, dx: 0, dy: 60 });
    }
    function impact() {
      phase = 'impact';
      T = 0;
      const dx = th.x - geo.ex, dy = th.y - geo.ey, d = Math.hypot(dx, dy) || 1;
      hit.ux = dx / d;
      hit.uy = dy / d;
      hit.x = geo.ex + hit.ux * geo.R0;
      hit.y = geo.ey + hit.uy * geo.R0;
      hit.tx = th.x;
      hit.ty = th.y;
      /* les débris partent surtout du côté où filait Théia, et l'anneau tourne dans ce sens */
      const tang = (-hit.uy * th.vx + hit.ux * th.vy) / (Math.hypot(th.vx, th.vy) || 1);
      ringDir = Math.abs(tang) < 0.05 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(tang);
      spawnDebris(ringDir);
      api.progress(0.4);
      /* après un raté, on ne laisse pas « Raté de peu » affiché pendant le choc */
      if (missed) {
        hinted = true;
        api.hint(TEXTES.anneau);
      }
      api.sfx.play('thud', { gap: 0 });
      api.sfx.play('rumble', { gap: 0 });
      api.buzz(15);
      /* plus besoin de glisser : la page peut de nouveau défiler par-dessus la scène */
      cv.canvas.style.touchAction = 'pan-y';
    }
    function spawnDebris(side) {
      const ux = hit.ux, uy = hit.uy;
      const tx = -uy * side, ty = ux * side;
      const R = geo.R0;
      capturable = 0;
      for (let i = 0; i < N; i++) {
        const d = deb[i];
        const s = Math.random() < 0.7 ? 1 : -1;
        const along = rand(0.55, 1);
        const out = rand(0.12, 0.8);
        let dx = tx * s * along + ux * out + rand(-0.22, 0.22);
        let dy = ty * s * along + uy * out + rand(-0.22, 0.22);
        const L = Math.hypot(dx, dy) || 1;
        dx /= L;
        dy /= L;
        const sp = R * rand(2.2, 5.6);
        d.k = rand(2.3, 3.3);
        d.x0 = hit.x + rand(-0.3, 0.3) * geo.tr;
        d.y0 = hit.y + rand(-0.3, 0.3) * geo.tr;
        d.vx = dx * sp;
        d.vy = dy * sp;
        d.state = 1;
        d.alpha = 1;
        d.pair = i % 4;
        d.hot = Math.random() < 0.62;
        d.cr = 1 / rand(1.2, 2.3);
        const r = Math.random();
        d.size = r < 0.68 ? rand(1, 1.8) : r < 0.94 ? rand(1.8, 2.7) : rand(2.7, 3.7);
        d.back = Math.random() < 0.08;
        if (d.back) {
          d.tb0 = rand(0.18, 0.36);
          d.tf = rand(0.5, 0.9);
          const a = Math.atan2(uy, ux) + rand(-1.1, 1.1);
          d.fx = geo.ex + Math.cos(a) * R * 0.85;
          d.fy = geo.ey + Math.sin(a) * R * 0.85;
        } else {
          capturable++;
          d.rho = clamp(1 + gauss() * 0.13, 0.72, 1.3);
          d.om = OMEGA * (1 + (1 - d.rho) * 0.3) * rand(0.97, 1.03);
          d.tb0 = rand(0.2, 0.42);
          d.tb1 = d.tb0 + rand(0.9, 1.45);
          /* le flot de débris s'étire et s'enroule autour de la Terre jusqu'à fermer l'anneau */
          d.sp = side * (s > 0 ? rand(0, 1.45) : -rand(0, 0.55)) * Math.PI;
          /* l'emplacement sur l'anneau suit la direction où le débris a été lancé */
          const tm = (d.tb0 + d.tb1) * 0.5;
          const e = (1 - Math.exp(-d.k * tm)) / d.k;
          d.th0 = ringAngle(d.x0 + d.vx * e, d.y0 + d.vy * e) - side * d.om * tm - d.sp * spread(tm);
        }
        d.px = d.x0;
        d.py = d.y0;
        d.front = true;
        d.depth = 1;
        d.cool = 0;
      }
    }
    function spread(t) {
      return smooth((t - 0.3) / 1.9);
    }
    function ringAngleOf(d, t) {
      return d.th0 + ringDir * d.om * t + d.sp * spread(t);
    }
    /* chaque débris rejoint la Lune d'autant plus tard qu'il en est loin sur l'anneau */
    function scheduleCaptures() {
      accInit = true;
      /* la Lune naît du côté visible de l'anneau et y grandit pendant qu'elle tourne */
      moonTh = ringDir > 0 ? 0.2 : Math.PI - 0.2;
      for (let i = 0; i < N; i++) {
        const d = deb[i];
        if (d.state !== 1 || d.back) continue;
        d.dm = wrapPi(ringAngleOf(d, T) - moonTh);
        d.tc = T + T_SPREAD * Math.pow(Math.abs(d.dm) / Math.PI, 0.8) + rand(0, 0.15);
      }
    }

    /* ---- interaction ---- */
    function addTap(x, y, big) {
      taps.push({ x, y, t: 0, dur: big ? 0.7 : 0.5, r: big ? 46 : 30 });
      if (taps.length > 8) taps.shift();
    }
    api.track(cv.canvas, {
      down(p) {
        if (phase === 'aim' && appear > 0.6) {
          const d = Math.hypot(p.x - th.x, p.y - th.y);
          if (d <= geo.grabR || p.y >= geo.h * 0.6) {
            phase = 'pull';
            pull.id = p.id;
            pull.sx = p.x;
            pull.sy = p.y;
            pull.lastF = 0;
            setPull(0, 0);
            api.sfx.play('tick', { pitch: 0.8 });
            api.buzz(6);
            return;
          }
          nudge = 1;
        }
        addTap(p.x, p.y, finished);
        if (finished) api.sfx.play('pop', { pitch: rand(0.9, 1.3) });
      },
      move(p) {
        if (phase !== 'pull' || p.id !== pull.id) return;
        setPull(p.x - pull.sx, p.y - pull.sy);
        /* petits cliquetis de tension */
        if (Math.abs(pull.f - pull.lastF) > 0.14) {
          pull.lastF = pull.f;
          api.sfx.play('tick', { pitch: 0.7 + pull.f * 0.8, volume: 0.6, gap: 50 });
        }
      },
      up(p, e, cancelled) {
        if (phase !== 'pull' || p.id !== pull.id) return;
        pull.id = -1;
        if (cancelled) {
          phase = 'aim';
          band.t = 0;
          band.amp = pull.disp * 0.4;
          band.ux = pull.ux;
          band.uy = pull.uy;
          restTheia();
          pull.len = pull.f = pull.disp = 0;
          prevN = 0;
          return;
        }
        if (p.tap || pull.len < 16) {
          restTheia();
          launch(true);
        } else {
          launch(false);
        }
      },
    }, { touchAction: 'none' });

    /* ---- animation ---- */
    function setProgress(p) {
      const q = Math.round(p * 100);
      if (q === shownP) return;
      shownP = q;
      api.progress(p);
    }
    function updateDebris() {
      for (let i = 0; i < N; i++) {
        const d = deb[i];
        if (d.state === 0) continue;
        d.cool = d.hot ? clamp(T * d.cr) : 1;
        if (d.back) {
          /* une partie des débris retombe sur la Terre */
          const e = (1 - Math.exp(-d.k * T)) / d.k;
          const k = smooth((T - d.tb0) / d.tf);
          d.px = lerp(d.x0 + d.vx * e, d.fx, k * k);
          d.py = lerp(d.y0 + d.vy * e, d.fy, k * k);
          d.front = true;
          d.depth = 1;
          d.alpha = 1 - clamp((k - 0.75) / 0.25);
          if (k >= 1) d.state = 0;
          continue;
        }
        if (d.state === 2) {
          /* happé par la Lune */
          const k = clamp((T - d.tc) / T_TRAVEL);
          ringPos(moonTh + d.dm * 0.4 * (1 - k), lerp(d.rho, rhoM, 0.6), P);
          const sx = P.x, sy = P.y;
          ringPos(moonTh, rhoM, P);
          const e = ease.inQuad(k);
          d.px = lerp(sx, P.x, e);
          d.py = lerp(sy, P.y, e);
          const s = Math.sin(moonTh);
          d.front = s >= 0;
          d.depth = 0.85 + 0.15 * s;
          if (k >= 1) {
            d.state = 0;
            captured++;
            moonFlash = Math.min(1, moonFlash + 0.2);
            api.sfx.play('tick', { pitch: rand(0.9, 1.5), volume: 0.7, gap: 45 });
          }
          continue;
        }
        let a, rho;
        if (accInit) {
          const k = clamp((T - T_ACC) / Math.max(0.001, d.tc - T_ACC));
          a = moonTh + d.dm * (1 - 0.6 * ease.inOutSine(k));
          rho = lerp(d.rho, rhoM, 0.6 * k);
          if (T >= d.tc) d.state = 2;
        } else {
          a = ringAngleOf(d, T);
          rho = d.rho;
        }
        ringPos(a, rho, P);
        const w = smooth((T - d.tb0) / (d.tb1 - d.tb0));
        if (w < 1) {
          const e = (1 - Math.exp(-d.k * T)) / d.k;
          d.px = lerp(d.x0 + d.vx * e, P.x, w);
          d.py = lerp(d.y0 + d.vy * e, P.y, w);
        } else {
          d.px = P.x;
          d.py = P.y;
        }
        const s = Math.sin(a);
        d.front = w < 0.5 || s >= 0;
        d.depth = w < 0.5 ? 1 : 0.8 + 0.2 * s;
      }
    }

    function update(dt) {
      time += dt;
      nudge *= Math.pow(0.05, dt);
      moonFlash *= Math.pow(0.02, dt);
      if (appear < 1) appear = Math.min(1, appear + dt / 0.45);
      band.t += dt;
      shakeX = shakeY = 0;

      if (phase === 'aim') {
        th.x = geo.tx;
        th.y = geo.ty + (RM ? 0 : Math.sin(time * 1.7) * 1.6);
        th.rot += dt * 0.18;
      } else if (phase === 'fly') {
        th.acc += dt;
        while (th.acc >= STEP && phase === 'fly') {
          th.acc -= STEP;
          stepBody(th, STEP);
          if (hitTest(th)) impact();
          else if (outTest(th, geo.tr * 1.05) || leaving(th) || th.t > T_FLY_MAX) miss();
        }
        th.rot += dt * 0.9;
        trail[trailI * 2] = th.x;
        trail[trailI * 2 + 1] = th.y;
        trailI = (trailI + 1) % TRAIL;
        trailN = Math.min(TRAIL, trailN + 1);
      } else if (phase === 'miss') {
        /* Théia continue sur sa lancée et quitte l'écran */
        missT += dt;
        th.x += th.vx * dt;
        th.y += th.vy * dt;
        th.rot += dt * 0.9;
        if (missT >= 0.6) backToAim();
      } else if (phase === 'impact') {
        T += dt;
        slingA = Math.max(0, 1 - T / 0.5);
        if (!RM && T < 0.6) {
          const a = 7 * Math.exp(-T * 9);
          shakeX = rand(-a, a);
          shakeY = rand(-a, a);
        }
        if (!hinted && T >= T_HINT) {
          hinted = true;
          api.hint(TEXTES.anneau);
        }
        if (!ringed && T >= T_RING) {
          ringed = true;
          setProgress(0.7);
        }
        if (!accInit && T >= T_ACC) scheduleCaptures();
        if (accInit) {
          rhoM = finished ? 1 + 0.12 * (1 - Math.exp(-(T - doneT) / 20)) : 1;
          moonTh += ringDir * OMEGA * Math.pow(rhoM, -1.5) * dt;
        }
        updateDebris();
        if (accInit && !finished) {
          setProgress(0.7 + 0.29 * (capturable ? captured / capturable : 1));
          if (captured >= capturable || T > T_ACC + T_SPREAD + T_TRAVEL + 1) {
            for (let i = 0; i < N; i++) deb[i].state = 0;
            captured = capturable;
            finished = true;
            doneT = T;
            api.done(TEXTES.fin, TEXTES.finStatut);
          }
        }
      }
      for (let i = taps.length - 1; i >= 0; i--) {
        taps[i].t += dt;
        if (taps[i].t >= taps[i].dur) taps.splice(i, 1);
      }
    }

    /* ---- dessin ---- */
    function drawTwinkles() {
      for (let i = 0; i < twinkles.length; i++) {
        const s = twinkles[i];
        const a = s.a * (RM ? 0.8 : 0.55 + 0.45 * Math.sin(time * s.f + s.p));
        ctx.globalAlpha = a;
        ctx.fillStyle = s.c;
        ctx.fillRect(s.x - s.s / 2, s.y - s.s / 2, s.s, s.s);
      }
      ctx.globalAlpha = 1;
    }

    function earthR() {
      if (phase !== 'impact') return geo.R0;
      return geo.R0 * (1 + 0.065 * ease.outCubic(clamp(T / 0.7)));
    }

    function drawEarth() {
      const x = geo.ex, y = geo.ey;
      let R = earthR();
      let flashW = 0, molten = 0, wob = 0;
      if (phase === 'impact') {
        flashW = T < 0.1 ? T / 0.1 : Math.max(0, 1 - (T - 0.1) / 1.7);
        flashW = flashW * flashW * (3 - 2 * flashW);
        molten = clamp(1 - (T - 0.5) / 3);
        wob = RM ? 0 : 0.045 * Math.sin(T * 15) * Math.exp(-T * 3.2);
      }
      const pulse = RM ? 0 : Math.sin(time * 1.3) * 0.04;
      ctx.globalCompositeOperation = 'lighter';
      draw.glow(ctx, x, y, R * (2.6 + pulse + flashW * 0.8), '#FF6A1A', 0.3 + flashW * 0.35);
      draw.glow(ctx, x, y, R * 1.5, '#FFB24A', 0.16 + flashW * 0.5);
      ctx.globalCompositeOperation = 'source-over';

      ctx.save();
      ctx.translate(x, y);
      if (wob) ctx.scale(1 + wob, 1 - wob);
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, TAU);
      ctx.clip();
      /* la texture défile : la planète tourne sur elle-même */
      const tw = R * 4.2, thh = R * 2.1;
      const off = (time * R * (RM ? 0.04 : 0.12)) % tw;
      ctx.drawImage(lavaA, -R - off, -thh / 2, tw, thh);
      ctx.drawImage(lavaA, -R - off + tw, -thh / 2, tw, thh);
      if (molten > 0.01) {
        ctx.globalAlpha = molten;
        ctx.drawImage(lavaB, -R - off, -thh / 2, tw, thh);
        ctx.drawImage(lavaB, -R - off + tw, -thh / 2, tw, thh);
        ctx.globalAlpha = 1;
      }
      if (flashW > 0.01) {
        ctx.fillStyle = rgba('#FFF6DA', flashW * 0.95);
        ctx.fillRect(-R, -R, R * 2, R * 2);
      }
      const sh = ctx.createRadialGradient(-R * 0.35, -R * 0.4, R * 0.1, 0, 0, R * 1.05);
      sh.addColorStop(0, 'rgba(255,236,200,0.24)');
      sh.addColorStop(0.55, 'rgba(0,0,0,0)');
      sh.addColorStop(1, 'rgba(14,6,30,0.72)');
      ctx.fillStyle = sh;
      ctx.fillRect(-R, -R, R * 2, R * 2);
      ctx.restore();
      /* liseré incandescent sur le bord */
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba('#FF9A4A', 0.22 + flashW * 0.4);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, R - 0.5, 0, TAU);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }

    function drawTheia(x, y, scale, alpha) {
      const r = geo.tr * scale;
      if (r < 0.5 || alpha <= 0.01) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x, y);
      ctx.save();
      ctx.rotate(th.rot);
      ctx.drawImage(theiaSurf, -r, -r, r * 2, r * 2);
      ctx.restore();
      ctx.drawImage(theiaShade, -r, -r, r * 2, r * 2);
      ctx.restore();
    }

    function bandPath(bx, by, pouch) {
      ctx.beginPath();
      ctx.moveTo(geo.lx, geo.ly);
      if (pouch) {
        /* courbe qui passe par (bx, by) : la poche qui tient Théia */
        const cx = 2 * bx - (geo.lx + geo.rx) / 2, cy = 2 * by - (geo.ly + geo.ry) / 2;
        ctx.quadraticCurveTo(cx, cy, geo.rx, geo.ry);
      } else {
        ctx.lineTo(bx, by);
        ctx.lineTo(geo.rx, geo.ry);
      }
    }

    function drawSling() {
      if (slingA <= 0.01) return;
      ctx.save();
      ctx.globalAlpha = slingA;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      let bx, by, pouch = true;
      if (phase === 'pull') {
        bx = th.x + pull.ux * geo.tr * 0.85;
        by = th.y + pull.uy * geo.tr * 0.85;
        pouch = false;
      } else if (phase === 'aim' && band.t > 0.35) {
        bx = geo.tx;
        by = th.y + geo.tr * 0.9;
      } else {
        const osc = band.amp * Math.cos(band.t * 34) * Math.exp(-band.t * 6);
        const k = phase === 'aim' ? smooth((band.t - 0.1) / 0.25) : 0;
        bx = geo.tx + band.ux * osc;
        by = lerp(geo.ly, th.y + geo.tr * 0.9, k) + band.uy * osc;
      }
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba('#9FD3FF', 0.16);
      ctx.lineWidth = 7;
      bandPath(bx, by, pouch);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = rgba('#D4ECFF', 0.85);
      ctx.lineWidth = lerp(2.4, 1.3, phase === 'pull' ? pull.f : 0);
      bandPath(bx, by, pouch);
      ctx.stroke();
      /* deux petits points d'ancrage lumineux */
      ctx.globalCompositeOperation = 'lighter';
      draw.glow(ctx, geo.lx, geo.ly, 10, '#9FD3FF', 0.55);
      draw.glow(ctx, geo.rx, geo.ry, 10, '#9FD3FF', 0.55);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#EAF6FF';
      ctx.beginPath();
      ctx.arc(geo.lx, geo.ly, 2.6, 0, TAU);
      ctx.arc(geo.rx, geo.ry, 2.6, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    function drawAura() {
      const sc = ease.outBack(appear);
      const r = geo.tr * sc;
      const f = phase === 'pull' ? pull.f : 0;
      ctx.globalCompositeOperation = 'lighter';
      draw.glow(ctx, th.x, th.y, r * 2.3, f > 0.02 ? '#FFC46B' : '#9FD3FF', 0.1 + nudge * 0.3 + f * 0.25);
      ctx.globalCompositeOperation = 'source-over';
      if (phase === 'aim') {
        const k = RM ? 0.5 : (time * 0.7) % 1;
        ctx.strokeStyle = rgba('#9FD3FF', (0.35 + nudge * 0.5) * (1 - k));
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(th.x, th.y, r * (1.2 + k * 0.7), 0, TAU);
        ctx.stroke();
      }
    }

    function drawPreview() {
      if (phase !== 'pull' || prevN === 0) return;
      const col = prevHit ? '#9FD3FF' : '#BDB2E0';
      ctx.fillStyle = col;
      for (let i = 0; i < prevN; i++) {
        const k = i / Math.max(1, prevN - 1);
        const flow = RM ? 1 : 0.62 + 0.38 * Math.sin(i * 0.9 - time * 9);
        ctx.globalAlpha = lerp(1, 0.4, k) * flow;
        ctx.beginPath();
        ctx.arc(prev[i * 2], prev[i * 2 + 1], lerp(3, 1.7, k), 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (prevHit) {
        const pr = RM ? 0 : Math.sin(time * 6) * 1.5;
        ctx.globalCompositeOperation = 'lighter';
        draw.glow(ctx, prevImp.x, prevImp.y, 16, '#CFE9FF', 0.55);
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(prevImp.x, prevImp.y, 7 + pr, 0, TAU);
        ctx.stroke();
      }
    }

    function drawTrail() {
      if (trailN < 2) return;
      ctx.globalCompositeOperation = 'lighter';
      for (let j = 0; j < trailN; j++) {
        const idx = (trailI - 1 - j + TRAIL * 2) % TRAIL;
        const k = j / TRAIL;
        const g = geo.tr * lerp(1.1, 0.4, k);
        ctx.globalAlpha = 0.28 * (1 - k);
        ctx.drawImage(glowSoft, trail[idx * 2] - g, trail[idx * 2 + 1] - g, g * 2, g * 2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    function drawRingGlow(front) {
      if (phase !== 'impact') return;
      let a = smooth((T - 0.9) / 1.3);
      if (accInit) a *= 1 - (capturable ? captured / capturable : 1);
      if (a < 0.01) return;
      const cool = clamp(T / 2.5);
      ctx.save();
      ctx.translate(geo.ex, geo.ey);
      ctx.rotate(TILT);
      ctx.scale(1, SQUASH);
      ctx.globalCompositeOperation = 'lighter';
      const a0 = front ? 0 : Math.PI, a1 = front ? Math.PI : TAU;
      /* une bande de poussière douce, sans bord net */
      const r0 = geo.A * 0.72, r1 = geo.A * 1.3;
      const g = ctx.createRadialGradient(0, 0, r0, 0, 0, r1);
      const c = Math.round(lerp(RING_HOT[0], RING_COOL[0], cool)) + ',' +
        Math.round(lerp(RING_HOT[1], RING_COOL[1], cool)) + ',' + Math.round(lerp(RING_HOT[2], RING_COOL[2], cool));
      g.addColorStop(0, `rgba(${c},0)`);
      g.addColorStop(0.42, `rgba(${c},${0.13 * a})`);
      g.addColorStop(0.5, `rgba(${c},${0.17 * a})`);
      g.addColorStop(0.58, `rgba(${c},${0.13 * a})`);
      g.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r1, a0, a1);
      ctx.arc(0, 0, r0, a1, a0, true);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    function drawDebris(front) {
      if (phase !== 'impact') return;
      for (let i = 0; i < N; i++) {
        const d = deb[i];
        if (d.state === 0 || d.front !== front) continue;
        const sz = d.size * d.depth;
        ctx.globalAlpha = (0.5 + 0.5 * d.depth) * d.alpha;
        ctx.fillStyle = COLS[d.pair][Math.round(d.cool * STEPS)];
        if (sz < 1.5) {
          ctx.fillRect(d.px - sz / 2, d.py - sz / 2, sz, sz);
        } else {
          ctx.beginPath();
          ctx.arc(d.px, d.py, sz * 0.6, 0, TAU);
          ctx.fill();
        }
      }
      /* halo des débris encore brûlants */
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < N; i++) {
        const d = deb[i];
        if (d.state === 0 || d.front !== front || !d.hot || d.cool > 0.85) continue;
        ctx.globalAlpha = (1 - d.cool) * 0.45 * d.depth * d.alpha;
        const g = d.size * 3.4;
        ctx.drawImage(glowHot, d.px - g, d.py - g, g * 2, g * 2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    function moonFront() {
      return Math.sin(moonTh) >= 0;
    }
    function drawMoon() {
      if (phase !== 'impact' || !accInit) return;
      ringPos(moonTh, rhoM, P);
      const s = Math.sin(moonTh);
      const frac = capturable ? captured / capturable : 1;
      const rm = geo.Rm * (0.2 + 0.8 * Math.cbrt(frac)) * (0.92 + 0.08 * s);
      const heat = finished ? Math.max(0, 1 - (T - doneT) / 2.5) * 0.35 : 1 - frac * 0.65;
      ctx.globalCompositeOperation = 'lighter';
      draw.glow(ctx, P.x, P.y, rm * 2.3, '#FFB070', 0.18 * heat + moonFlash * 0.18);
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(moonSpr, P.x - rm, P.y - rm, rm * 2, rm * 2);
      if (heat > 0.02) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = heat * 0.55;
        ctx.drawImage(glowHot, P.x - rm, P.y - rm, rm * 2, rm * 2);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
    }

    function drawImpact() {
      if (phase !== 'impact') return;
      /* Théia s'enfonce et fusionne avec la Terre */
      if (T < 0.45) {
        const k = T / 0.45;
        const x = lerp(hit.tx, hit.x - hit.ux * geo.tr * 0.5, ease.outQuad(k));
        const y = lerp(hit.ty, hit.y - hit.uy * geo.tr * 0.5, ease.outQuad(k));
        drawTheia(x, y, 1 - 0.7 * k, 1 - k);
      }
      ctx.globalCompositeOperation = 'lighter';
      if (T < 0.7) {
        const k = T / 0.7;
        draw.glow(ctx, hit.x, hit.y, geo.R0 * (1.2 + 1.6 * k), '#FFE9C0', 0.95 * (1 - k));
      }
      if (T < 0.85) {
        const k = T / 0.85;
        ctx.strokeStyle = rgba('#FFF0D2', 0.7 * (1 - k));
        ctx.lineWidth = 2.4 * (1 - k) + 0.6;
        ctx.beginPath();
        ctx.arc(hit.x, hit.y, lerp(geo.tr * 0.5, geo.R0 * 2.8, ease.outCubic(k)), 0, TAU);
        ctx.stroke();
      }
      if (T < 0.9) {
        const k = T / 0.9;
        ctx.strokeStyle = rgba('#9FD3FF', 0.32 * (1 - k) * (1 - k));
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(geo.ex, geo.ey, lerp(geo.R0, geo.R0 * 3.2, ease.outCubic(k)), 0, TAU);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    function drawTaps() {
      for (let i = 0; i < taps.length; i++) {
        const tp = taps[i];
        const k = tp.t / tp.dur;
        ctx.strokeStyle = rgba('#DDEBFF', 0.6 * (1 - k));
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(tp.x, tp.y, lerp(6, tp.r, ease.outCubic(k)), 0, TAU);
        ctx.stroke();
      }
    }

    function render() {
      const { w, h } = cv;
      if (bg) ctx.drawImage(bg, 0, 0, w, h);
      drawTwinkles();
      ctx.save();
      ctx.translate(shakeX, shakeY);
      drawRingGlow(false);
      drawDebris(false);
      if (!moonFront()) drawMoon();
      drawEarth();
      drawImpact();
      drawRingGlow(true);
      drawDebris(true);
      if (moonFront()) drawMoon();
      ctx.restore();

      if (phase === 'aim' || phase === 'pull') {
        drawSling();
        drawPreview();
        drawAura();
        drawTheia(th.x, th.y, ease.outBack(appear), clamp(appear * 2));
      } else if (phase === 'fly') {
        drawSling();
        drawTrail();
        drawTheia(th.x, th.y, 1, 1);
      } else if (phase === 'miss') {
        drawSling();
        drawTheia(th.x, th.y, 1, 1 - smooth(missT / 0.5));
      } else {
        drawSling();
      }
      drawTaps();
      /* éclair du choc (adouci si les animations sont réduites) */
      if (phase === 'impact' && T < 0.3) {
        ctx.fillStyle = rgba('#FFF4D6', (RM ? 0.16 : 0.4) * (1 - T / 0.3));
        ctx.fillRect(0, 0, w, h);
      }
    }

    /* ---- remise à zéro ---- */
    function init() {
      phase = 'aim';
      T = 0;
      missT = 0;
      appear = 1;
      nudge = 0;
      slingA = 1;
      finished = hinted = ringed = accInit = missed = false;
      captured = 0;
      capturable = N;
      shownP = -1;
      moonTh = 0;
      rhoM = 1;
      doneT = 0;
      moonFlash = 0;
      ringDir = 1;
      band.t = 9;
      band.amp = 0;
      pull.id = -1;
      pull.len = pull.f = pull.disp = 0;
      prevN = 0;
      trailN = 0;
      taps.length = 0;
      for (let i = 0; i < N; i++) deb[i].state = 0;
      th.rot = 0;
      restTheia();
      cv.canvas.style.touchAction = 'none';
      api.status('');
      api.gesture('drag', { x: 50, y: 82, dx: 0, dy: 60 });
    }

    cv.onResize((w, h) => {
      layout(w, h);
      bg = makeBg(w, h);
      makeSprites();
      makeTwinkles(w, h);
      if (phase === 'aim') restTheia();
      else if (phase === 'pull') setPull(0, 0);
    });

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
