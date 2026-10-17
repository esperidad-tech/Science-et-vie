/* Le tapis roulant des plaques. On pousse la plaque océanique (et son tapis de calcaire) contre le
   continent : elle plonge dans la fosse, le calcaire chauffe en profondeur et libère son carbone, qui
   remonte avec le magma ; un volcan grandit et recrache le CO2, le bord du continent se plisse en
   montagne, et la pluie commence à ronger cette roche toute neuve. */
(function () {
  'use strict';
  const { lib } = window.RM;
  const { TAU, rand, clamp, lerp, ease, draw } = lib;

  /* Tous les textes du jeu, faciles à corriger */
  const TEXTES = {
    bouton: 'Pousser la plaque',
    encore: 'Pousse encore la plaque.',
    derniere: 'Pousse-la une dernière fois.',
    regarde: 'Regarde le continent se plisser.',
    plonge: 'La plaque océanique plonge sous le continent.',
    chaleur: 'En profondeur, la chaleur libère le carbone du calcaire.',
    volcan: 'Le volcan recrache le CO2, et une montagne se dresse.',
    fin: 'Le tapis roulant a recyclé le carbone et fabriqué une montagne neuve.',
    finStatut: 'La pluie peut maintenant ronger cette roche fraîche : le thermostat continue.',
  };

  const smooth = (t) => t * t * (3 - 2 * t);
  function seeded(seed) {
    let s = seed >>> 0 || 1;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }

  const CSS = `
.game[data-game="plaques"] .pl-btn {
  position: absolute; left: 12px; bottom: 12px; z-index: 4; white-space: nowrap;
  background: var(--accent); color: var(--btn-fg); padding-inline: 14px 18px;
  box-shadow: 0 0 0 3px rgba(251, 234, 224, 0.2), 0 10px 22px -8px rgba(0, 0, 0, 0.8);
  transition: opacity 0.25s, filter 0.25s;
}
.game[data-game="plaques"] .pl-btn[aria-disabled="true"] { opacity: 0.5; filter: saturate(0.5); }
.game[data-game="plaques"] .pl-btn svg { width: 22px; height: 22px; flex: none; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
.game[data-game="plaques"] .pl-btn:not([aria-disabled="true"]) svg { animation: pl-nudge 1.6s ease-in-out infinite; }
@keyframes pl-nudge { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(3px); } }
`;
  const ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 15.5h11M3 11h7.5M13 7.5l6.5 5.5-6.5 5.5"/></svg>';

  window.RM.games.plaques = function (api) {
    const cv = api.canvas();
    const ctx = cv.ctx;
    const AMB = api.reducedMotion ? 0.3 : 1;
    api.style(CSS);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip pl-btn';
    btn.innerHTML = ICON + '<span></span>';
    btn.lastChild.textContent = TEXTES.bouton;
    api.stage.appendChild(btn);

    /* ---- géométrie ---- */
    const G = { w: 1, h: 1 };
    const DS = 2;                 /* pas de la trajectoire (px) */
    let PX = new Float32Array(2), PY = new Float32Array(2), PA = new Float32Array(2), NP = 2;
    let mantleTex = null, graniteTex = null, skyTex = null, molTex = null, puffTex = [], cloudTex = null;
    let conduit = null;           /* chemin du magma : de la plaque chaude à la chambre */
    let TH = [0, 0, 0];           /* positions de la plaque à la fin de chaque poussée */
    const P = { x: 0, y: 0, a: 0 }, P2 = { x: 0, y: 0, a: 0 }, tmp = { x: 0, y: 0 };

    function mk(wc, hc) {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(wc * cv.dpr));
      c.height = Math.max(1, Math.round(hc * cv.dpr));
      const g = c.getContext('2d');
      g.scale(cv.dpr, cv.dpr);
      return { c, g, w: wc, h: hc };
    }

    function geometry(w, h) {
      G.w = w;
      G.h = h;
      G.m = Math.min(w, h);
      G.sea = h * 0.31;
      G.y0 = h * 0.47;            /* dessus de la plaque, au large */
      G.xb = w * 0.36;            /* début de la courbure */
      G.yb = h * 0.49;
      G.Rb = Math.max(90, w * 0.38);
      G.dip = 0.76;               /* angle de plongée (rad) */
      G.T = Math.max(14, h * 0.05);        /* épaisseur de la plaque */
      G.Lmax = Math.max(8, h * 0.026);     /* épaisseur du calcaire */
      G.chan = G.Lmax + 3;                 /* jeu entre la plaque et le continent */
      G.csurf = h * 0.295;        /* surface du continent */
      G.cbase = h * 0.62;         /* base du continent */
      G.xcoast = w * 0.545;
      G.hotY = h * 0.7;           /* là où le calcaire chauffe */
      buildPath();
      G.sB = sAtX(G.xb);
      G.sQ = G.sB + w * 0.07;
      at(G.sQ, P);
      G.Qx = P.x + Math.sin(P.a) * G.chan;
      G.Qy = P.y - Math.cos(P.a) * G.chan;
      G.sHot = sAtY(G.hotY);
      G.sCB = sAtY(G.cbase + G.chan * 1.2);
      G.sEnd = Math.min((NP - 2) * DS, Math.min(sAtY(h + G.T * 2), sAtX(w + G.T * 2)));
      at(G.sHot + w * 0.06, P);
      G.xv = clamp(P.x, w * 0.72, w * 0.86);
      G.srcX = P.x;
      G.srcY = P.y - 4;
      G.vh = h * 0.115;
      G.vw = Math.max(24, Math.min(w * 0.09, h * 0.09));
      G.xm = w * 0.605;
      G.mw = Math.max(20, Math.min(w * 0.07, h * 0.075));
      G.mh = h * 0.13;
      G.chY = G.csurf + h * 0.12;
      G.chR = Math.max(9, G.m * 0.035);
      /* le calcaire : des tapis séparés, qui arrivent les uns après les autres */
      G.sFront0 = sAtX(w * 0.3);
      G.carpet = w * 0.5;
      G.per = w * 0.92;
      TH = [G.sB + w * 0.1 - G.sFront0, G.sHot + w * 0.035 - G.sFront0, 0];
      TH[2] = TH[1] + w * 0.17;
      buildConduit();
      mantleTex = buildMantle();
      graniteTex = buildGranite();
      skyTex = buildSky();
      buildMol();
      buildPuffs();
      cloudTex = buildCloud();
      /* l'état garde ses étapes si la scène change de taille */
      off = offT = stage > 0 ? TH[Math.min(stage, 3) - 1] + extra : 0;
    }

    /* La trajectoire du dessus de la plaque : plate au large, puis courbée, puis plongeante */
    function buildPath() {
      const { w, h } = G;
      const a0 = Math.atan2(G.yb - G.y0, G.xb);
      const x0 = -1.6 * w;
      const LA = (G.xb - x0) / Math.cos(a0);
      const LB = G.Rb * (G.dip - a0);
      const cx = G.xb - G.Rb * Math.sin(a0), cy = G.yb + G.Rb * Math.cos(a0);
      const ex = cx + G.Rb * Math.sin(G.dip), ey = cy - G.Rb * Math.cos(G.dip);
      const xs = [], ys = [], as = [];
      for (let s = 0; ; s += DS) {
        let x, y, a;
        if (s < LA) {
          x = x0 + s * Math.cos(a0);
          y = G.y0 + x * Math.tan(a0);
          a = a0;
        } else if (s < LA + LB) {
          a = a0 + (s - LA) / G.Rb;
          x = cx + G.Rb * Math.sin(a);
          y = cy - G.Rb * Math.cos(a);
        } else {
          a = G.dip;
          x = ex + (s - LA - LB) * Math.cos(a);
          y = ey + (s - LA - LB) * Math.sin(a);
        }
        xs.push(x);
        ys.push(y);
        as.push(a);
        if (y > h * 1.3 || x > w * 1.6) break;
      }
      PX = new Float32Array(xs);
      PY = new Float32Array(ys);
      PA = new Float32Array(as);
      NP = xs.length;
    }
    function at(s, o) {
      const f = clamp(s / DS, 0, NP - 1.001);
      const i = Math.floor(f), k = f - i;
      o.x = lerp(PX[i], PX[i + 1], k);
      o.y = lerp(PY[i], PY[i + 1], k);
      o.a = lerp(PA[i], PA[i + 1], k);
      return o;
    }
    function sAtX(x) {
      let lo = 0, hi = NP - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (PX[mid] < x) lo = mid;
        else hi = mid;
      }
      return hi * DS;
    }
    function sAtY(y) {
      for (let i = 0; i < NP; i++) if (PY[i] >= y) return i * DS;
      return (NP - 1) * DS;
    }
    /* y du dessus de la plaque à l'abscisse x */
    function plateYAt(x) {
      at(sAtX(x), P2);
      return P2.y;
    }

    /* épaisseur de calcaire à la coordonnée « matière » m (la matière avance avec la plaque) */
    function limeAt(m) {
      const q = G.sFront0 - m;
      if (q < 0) return 0;
      const r = q % G.per;
      if (r > G.carpet) return 0;
      return G.Lmax * smooth(clamp(Math.min(r / 10, (G.carpet - r) / 26)));
    }
    /* le calcaire qui chauffe s'amincit : il perd son carbone */
    function burnAt(y) {
      return 1 - 0.75 * smooth(clamp((y - G.hotY - 6) / (G.h * 0.12)));
    }

    function buildConduit() {
      const pts = [];
      const x0 = G.srcX, y0 = G.srcY, x1 = G.xv, y1 = G.chY + G.chR * 0.6;
      const n = 30;
      for (let i = 0; i <= n; i++) {
        const k = i / n;
        const x = lerp(x0, x1, smooth(k)) + Math.sin(k * 7 + 1) * 3 * (1 - k);
        pts.push(x, lerp(y0, y1, k));
      }
      const A = new Float32Array(pts);
      const L = new Float32Array(A.length / 2);
      for (let i = 1; i < L.length; i++) L[i] = L[i - 1] + Math.hypot(A[i * 2] - A[i * 2 - 2], A[i * 2 + 1] - A[i * 2 - 1]);
      conduit = { A, L, total: L[L.length - 1] };
    }
    function conduitAt(s, o) {
      const { A, L, total } = conduit;
      s = clamp(s, 0, total);
      let i = 1;
      while (i < L.length - 1 && L[i] < s) i++;
      const k = (s - L[i - 1]) / Math.max(0.001, L[i] - L[i - 1]);
      o.x = lerp(A[i * 2 - 2], A[i * 2], k);
      o.y = lerp(A[i * 2 - 1], A[i * 2 + 1], k);
      return o;
    }

    /* Le manteau : de la roche brûlante qui rougeoie, plus chaude en profondeur */
    function buildMantle() {
      const { w, h } = G;
      const y0 = Math.floor(h * 0.4);
      const H = h - y0 + 2;
      const R = mk(w, H);
      const W2 = Math.ceil(w / 2) + 1, H2 = Math.ceil(H / 2) + 1;
      const t = document.createElement('canvas');
      t.width = W2;
      t.height = H2;
      const tg = t.getContext('2d');
      const img = tg.createImageData(W2, H2);
      const n = lib.makeNoise(31);
      const A = lib.hexToRgb('#2A0B07'), B = lib.hexToRgb('#6A1C0D'), C = lib.hexToRgb('#B4441A'), D = lib.hexToRgb('#FF9A48');
      for (let y = 0; y < H2; y++) {
        const dy = (y * 2) / H;
        for (let x = 0; x < W2; x++) {
          const v = n.fbm(x / 26, y / 16, 4);
          /* quelques veines plus chaudes, étirées par les courants */
          const r = 1 - Math.abs(2 * n.fbm(x / 34 + 40, y / 12 + Math.sin(x / 40) * 1.2, 2) - 1);
          const k = clamp(dy * 1.05 + (v - 0.5) * 0.5 - 0.08);
          let c;
          if (k < 0.45) c = A.map((a, i) => lerp(a, B[i], k / 0.45));
          else c = B.map((b, i) => lerp(b, C[i], (k - 0.45) / 0.55));
          const hot = Math.pow(clamp((r - 0.8) * 5), 2) * (0.15 + dy * 0.8);
          const j = (y * W2 + x) * 4;
          img.data[j] = lerp(c[0], D[0], hot * 0.42);
          img.data[j + 1] = lerp(c[1], D[1], hot * 0.42);
          img.data[j + 2] = lerp(c[2], D[2], hot * 0.42);
          img.data[j + 3] = 255;
        }
      }
      tg.putImageData(img, 0, 0);
      R.g.imageSmoothingEnabled = true;
      R.g.drawImage(t, 0, 0, W2 * 2, H2 * 2);
      R.y0 = y0;
      return R;
    }

    /* Le granite du continent : brun-rose, moucheté de grains clairs et sombres */
    function buildGranite() {
      const { w, h } = G;
      const H = Math.ceil(h * 0.7);
      const R = mk(w, H);
      const g = R.g;
      const t = document.createElement('canvas');
      const W2 = Math.ceil(w / 2) + 1, H2 = Math.ceil(H / 2) + 1;
      t.width = W2;
      t.height = H2;
      const tg = t.getContext('2d');
      const img = tg.createImageData(W2, H2);
      const n = lib.makeNoise(53);
      const A = lib.hexToRgb('#AE7B69'), B = lib.hexToRgb('#94604F');
      for (let y = 0; y < H2; y++) {
        const deep = smooth(clamp((y * 2 - h * 0.22) / (h * 0.32)));
        for (let x = 0; x < W2; x++) {
          const v = n.fbm(x / 7, y / 7, 3);
          const k = clamp((v - 0.38) * 1.7);
          const j = (y * W2 + x) * 4;
          const dk = 1 - deep * 0.38;
          img.data[j] = lerp(B[0], A[0], k) * dk;
          img.data[j + 1] = lerp(B[1], A[1], k) * dk;
          img.data[j + 2] = lerp(B[2], A[2], k) * dk;
          img.data[j + 3] = 255;
        }
      }
      tg.putImageData(img, 0, 0);
      g.imageSmoothingEnabled = true;
      g.drawImage(t, 0, 0, W2 * 2, H2 * 2);
      /* les cristaux du granite : feldspath rose, quartz clair, mica sombre */
      const r = seeded(9);
      const N = Math.round((w * H) / 40);
      for (let i = 0; i < N; i++) {
        const x = r() * w, y = r() * H;
        const q = r();
        const fade = 1 - 0.4 * smooth(clamp((y - h * 0.22) / (h * 0.32)));
        if (q < 0.3) {
          g.fillStyle = `rgba(210,138,118,${(0.35 + r() * 0.3) * fade})`;
          g.fillRect(x, y, 1.6 + r() * 2.2, 1.2 + r() * 1.6);
        } else if (q < 0.62) {
          g.fillStyle = `rgba(242,228,214,${(0.3 + r() * 0.35) * fade})`;
          g.fillRect(x, y, 0.8 + r() * 1.4, 0.8 + r() * 1.2);
        } else {
          g.fillStyle = `rgba(30,18,16,${(0.3 + r() * 0.35) * fade})`;
          g.fillRect(x, y, 0.7 + r() * 1.1, 0.6 + r() * 0.9);
        }
      }
      return R;
    }

    function buildMol() {
      const S = 18;
      const R = mk(S, S);
      const g = R.g;
      draw.glow(g, S / 2, S / 2, S / 2, '#FFB45A', 0.3);
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
      puffTex = ['#5E524C', '#A39A90', '#D8D0C6'].map((col, k) => {
        const S = 64;
        const R = mk(S, S);
        const r = seeded(70 + k);
        for (let i = 0; i < 7; i++) {
          const a = r() * TAU, dd = r() * S * 0.15;
          draw.glow(R.g, S / 2 + Math.cos(a) * dd, S / 2 + Math.sin(a) * dd, S * (0.24 + r() * 0.12), col, 0.5);
        }
        return R;
      });
    }
    function buildCloud() {
      const CW = Math.max(70, Math.round(Math.min(G.w, G.h) * 0.3)), CH = Math.round(CW * 0.5);
      const R = mk(CW, CH);
      const g = R.g;
      const r = seeded(12);
      const blobs = [];
      for (let i = 0; i < 7; i++) {
        const t = (i + 0.5) / 7;
        const br = CH * (0.18 + 0.22 * Math.sin(t * Math.PI) + r() * 0.06);
        blobs.push([CW * (0.12 + 0.76 * t), CH * 0.72 - br * 0.75, br]);
      }
      const gr = g.createLinearGradient(0, 0, 0, CH);
      gr.addColorStop(0, '#E8E1DC');
      gr.addColorStop(0.6, '#9C9293');
      gr.addColorStop(1, '#5E5559');
      g.fillStyle = gr;
      g.beginPath();
      for (const [x, y, rr] of blobs) {
        g.moveTo(x + rr, y);
        g.arc(x, y, rr, 0, TAU);
      }
      g.moveTo(CW * 0.15, CH * 0.72);
      g.ellipse(CW * 0.5, CH * 0.68, CW * 0.37, CH * 0.07, 0, 0, TAU);
      g.fill();
      for (const [x, y, rr] of blobs) {
        const hl = g.createRadialGradient(x - rr * 0.3, y - rr * 0.45, 1, x - rr * 0.2, y - rr * 0.3, rr * 0.8);
        hl.addColorStop(0, 'rgba(255,245,235,0.35)');
        hl.addColorStop(1, 'rgba(255,245,235,0)');
        g.fillStyle = hl;
        g.beginPath();
        g.arc(x, y, rr, 0, TAU);
        g.fill();
      }
      R.CW = CW;
      R.CH = CH;
      return R;
    }

    /* ---- état ---- */
    let stage = 0;          /* poussées réussies (0 à 3) */
    let off = 0, offT = 0, extra = 0;
    let lock = 0, seqT = -1, finished = false;
    let drag = null, scrapeT = 0;
    let volcK = 0, foldK = 0, chamberK = 0, cloudA = 0, rainOn = 0, heatK = 0;
    let shake = 0, act = 0, time = 0, bubbleT = 0, blobT = 0, rainT = 0, grainT = 0, puffT = 0, popCount = 0;
    let bubbles = [], blobs = [], mols = [], puffs = [], sparks = [], flows = [], drops = [], grains = [], rings = [], flashes = [], streams = [];

    function initStreams() {
      streams = [];
      const loops = [
        { cx: 0.3, cy: 0.8, rx: 0.3, ry: 0.13, dir: 1 },
        { cx: 0.8, cy: 0.9, rx: 0.24, ry: 0.09, dir: -1 },
      ];
      for (let i = 0; i < 30; i++) {
        const L = loops[i % 2];
        streams.push({ L, a: rand(TAU), sp: rand(0.12, 0.2), len: rand(0.35, 0.7), wid: rand(1.4, 2.6) });
      }
    }

    function cap() {
      if (stage >= 3) return finished ? off + G.w * 0.25 : off;
      return TH[stage];
    }
    function canPush() {
      return lock <= 0 && !(stage >= 3 && !finished);
    }
    let btnState = '';
    function setBtn() {
      const v = canPush() ? 'false' : 'true';
      if (v === btnState) return;
      btnState = v;
      btn.setAttribute('aria-disabled', v);
    }
    function commitPush() {
      if (!canPush()) {
        resist();
        return;
      }
      const c = cap();
      if (finished) {
        offT = off + G.w * 0.25;
        extra += G.w * 0.25;
      } else {
        offT = c;
      }
      api.sfx.play('whoosh', { pitch: 0.6, volume: 0.5 });
      api.buzz(8);
    }
    function resist() {
      api.sfx.play('thud', { pitch: 1.4, volume: 0.35, gap: 250 });
      shake = Math.max(shake, 0.12);
    }

    btn.addEventListener('click', () => {
      api.gesture(null);
      commitPush();
    });

    function onPlate(x, y) {
      return x < G.w * 0.62 && y > G.sea - 16 && y < plateYAt(Math.min(x, G.w * 0.6)) + G.T + 40;
    }
    api.track(cv.canvas, {
      down(p) {
        rings.push({ x: p.x, y: p.y, t: 0 });
        drag = { x0: p.x, y0: p.y, off0: offT, moved: false };
      },
      move(p) {
        if (!drag) return;
        const dx = p.x - drag.x0;
        if (Math.abs(dx) > 8) drag.moved = true;
        if (!canPush()) {
          if (dx > 30 && !drag.warned) {
            drag.warned = true;
            resist();
          }
          return;
        }
        const want = drag.off0 + Math.max(0, dx) * 1.5;
        const c = finished ? drag.off0 + G.w * 0.25 : cap();
        offT = Math.max(offT, Math.min(want, c));
      },
      up(p, e, cancelled) {
        const d = drag;
        drag = null;
        if (!d || cancelled) return;
        const dx = p.x - d.x0;
        if (dx > 26 && canPush()) {
          if (finished) {
            const target = d.off0 + G.w * 0.25;
            extra += target - offT;
            offT = target;
          } else {
            offT = cap();
          }
          api.buzz(8);
        } else if (p.tap) {
          if (onPlate(p.x, p.y)) commitPush();
          else api.sfx.play('tick', { pitch: 0.8, volume: 0.6 });
        }
      },
    }, { touchAction: 'pan-y' });

    /* ---- les étapes ---- */
    function reach(k) {
      stage = k;
      if (k === 1) {
        lock = 1.0;
        api.status(TEXTES.plonge);
        api.hint(TEXTES.encore);
        api.progress(0.33);
        api.sfx.play('thud', { pitch: 0.7 });
        api.sfx.play('rumble', { pitch: 1.3, volume: 0.5 });
        api.buzz(12);
        shake = 0.3;
      } else if (k === 2) {
        lock = 1.4;
        api.status(TEXTES.chaleur);
        api.hint(TEXTES.derniere);
        api.progress(0.66);
        api.sfx.play('bubble', { pitch: 0.7 });
        api.sfx.play('rumble', { pitch: 1.1, volume: 0.5 });
        api.buzz(12);
      } else if (k === 3) {
        seqT = 0;
        api.hint(TEXTES.regarde);
        api.sfx.play('rumble', { pitch: 0.8 });
        api.buzz([12, 40, 12]);
        shake = 0.8;
      }
      setBtn();
    }

    function erupt(big) {
      act = 1;
      shake = Math.max(shake, big ? 0.6 : 0.25);
      api.sfx.play('rumble', { pitch: big ? 0.9 : 1.3, volume: big ? 1 : 0.5 });
      api.sfx.play('thud', { pitch: 0.8, volume: big ? 1 : 0.5 });
      if (big) api.buzz(14);
      const cx = G.xv, cy = craterY();
      for (let i = 0; i < (big ? 46 : 16) && sparks.length < 120; i++) {
        sparks.push({ x: cx + rand(-3, 3), y: cy - 2, vx: rand(-70, 70), vy: -rand(140, big ? 300 : 200), t: 0, life: rand(0.8, 1.4), r: rand(1.1, 2.5) });
      }
      for (let i = 0; i < (big ? 10 : 4); i++) {
        puffs.push({ x: cx + rand(-5, 5), y: cy - rand(0, 6), vx: rand(-4, 18), vy: -rand(40, big ? 90 : 60), r: rand(6, 10), grow: rand(10, 18), t: -i * 0.07, life: rand(2.4, 3.4), spr: i % 3 === 2 ? 1 : 0 });
      }
      if (big) for (const dir of [-1, 1]) flows.push({ dir, t: 0, len: rand(0.55, 0.85) });
      if (flows.length > 6) flows.splice(0, flows.length - 6);
      for (let i = 0; i < (big ? 14 : 5); i++) addMol(cx + rand(-4, 4), cy - 4);
      flashes.push({ x: cx, y: cy, t: 0 });
    }
    function addMol(x, y) {
      if (mols.length >= 32) return;
      let hx = 0, hy = 0;
      for (let k = 0; k < 8; k++) {
        hx = rand(G.w * 0.03, G.w * 0.97);
        hy = rand(G.h * 0.03, G.sea - 14);
        if (hy < topC(hx) - 14) break;
      }
      mols.push({ x, y, x0: x, y0: y, hx, hy, t: 0, dur: rand(1.6, 2.6), rot: rand(TAU), vr: rand(-0.8, 0.8), ph: rand(TAU), a: 0, state: 'rise', sc: rand(0.85, 1.05) });
    }

    /* ---- relief du continent ---- */
    function mountainH(x) {
      if (foldK <= 0) return 0;
      const u = (x - G.xm) / G.mw;
      const v = (x - G.xm - G.mw * 0.95) / (G.mw * 0.55);
      const z = (x - G.xm + G.mw * 0.85) / (G.mw * 0.55);
      return G.mh * foldK * (Math.exp(-u * u) + 0.5 * Math.exp(-v * v) + 0.32 * Math.exp(-z * z));
    }
    function volcanoH(x) {
      if (volcK <= 0) return 0;
      const d = Math.abs(x - G.xv) / G.vw;
      if (d >= 1) return 0;
      let hv = G.vh * Math.pow(1 - d, 1.25);
      if (d < 0.2) hv -= G.vh * 0.1 * (1 - (d / 0.2) * (d / 0.2));
      return hv * volcK;
    }
    function topC(x) {
      const coast = smooth(clamp((x - G.xcoast) / (G.w * 0.03)));
      return lerp(G.sea + 2, G.csurf, coast) - Math.max(mountainH(x), volcanoH(x)) + Math.sin(x * 0.09) * 0.8;
    }
    function craterY() {
      return G.csurf - G.vh * 0.9 * volcK;
    }

    /* ---- animation ---- */
    function update(dt) {
      time += dt;
      lock = Math.max(0, lock - dt);
      shake = Math.max(0, shake - dt);
      act = Math.max(0, act - dt * 0.5);

      /* la plaque avance vers sa cible */
      const prev = off;
      const diff = offT - off;
      if (drag) off += diff * (1 - Math.exp(-dt * 16));
      else off += Math.sign(diff) * Math.min(Math.abs(diff), Math.max(30, Math.abs(diff) * 3.2) * dt);
      const moved = off - prev;
      if (moved > 0.3) {
        scrapeT -= dt;
        if (scrapeT <= 0) {
          scrapeT = 0.12;
          api.sfx.play('scrape', { pitch: rand(0.6, 0.8), volume: 0.5 });
        }
      }
      if (!finished && stage < 3 && off >= TH[stage] - 0.5) reach(stage + 1);
      setBtn();

      /* le calcaire en profondeur chauffe et libère son carbone */
      heatK += ((stage >= 2 ? 1 : 0) - heatK) * (1 - Math.exp(-dt * 1.5));
      if (stage >= 2) {
        bubbleT += dt * (finished ? 5 : 7);
        while (bubbleT >= 1) {
          bubbleT -= 1;
          spawnBubble();
        }
        blobT += dt * 2.2;
        while (blobT >= 1) {
          blobT -= 1;
          if (blobs.length < 26) blobs.push({ s: rand(0, 8), v: rand(20, 30), r: rand(3, 5.5), ph: rand(TAU), t: 0 });
        }
      }
      chamberK += ((stage >= 2 ? 1 : 0) - chamberK) * (1 - Math.exp(-dt * 0.8));

      /* la troisième poussée : volcan, montagne, puis la pluie */
      if (seqT >= 0) {
        const t0 = seqT;
        seqT += dt;
        volcK = ease.outCubic(clamp(seqT / 1.4));
        foldK = ease.inOutSine(clamp((seqT - 0.2) / 2.4));
        if (t0 < 1.4 && seqT >= 1.4) {
          erupt(true);
          api.status(TEXTES.volcan);
          api.progress(0.9);
          api.guide(null, 'wow');
        }
        if (seqT < 2.6 && Math.random() < dt * 8) shake = Math.max(shake, 0.15);
        cloudA = clamp((seqT - 3) / 1.2);
        rainOn = clamp((seqT - 3.6) / 0.8);
        if (!finished && seqT > 6.4) {
          finished = true;
          api.done(TEXTES.fin, TEXTES.finStatut);
        }
      }

      /* le volcan continue de souffler quand le CO2 arrive */
      if (volcK > 0.95) {
        puffT -= dt;
        if (puffT <= 0) {
          puffT = rand(0.8, 1.4);
          puffs.push({ x: G.xv + rand(-3, 3), y: craterY() - 2, vx: rand(0, 10), vy: -rand(18, 30), r: 3, grow: rand(5, 9), t: 0, life: rand(2, 3), spr: 2, faint: true });
        }
        if (popCount >= 10) {
          popCount = 0;
          erupt(false);
        }
      }

      updateParticles(dt);
    }

    function spawnBubble() {
      if (bubbles.length >= 60) return;
      /* une bulle naît là où du calcaire chauffe */
      for (let k = 0; k < 6; k++) {
        const s = G.sHot + rand(-G.w * 0.02, G.w * 0.2);
        const L = limeAt(s - off);
        if (L < 1) continue;
        at(s, P);
        const nx = Math.sin(P.a), ny = -Math.cos(P.a);
        bubbles.push({
          state: 'free', x: P.x + nx * L * 0.5, y: P.y + ny * L * 0.5, s: 0, v: rand(38, 55), r: rand(1.8, 3.4), ph: rand(TAU), t: 0,
        });
        return;
      }
    }

    function updateParticles(dt) {
      let j = 0;
      /* bulles de CO2 : elles rejoignent le chemin du magma, puis la chambre, puis le volcan */
      for (const b of bubbles) {
        b.t += dt;
        if (b.state === 'free') {
          conduitAt(4, tmp);
          const dx = tmp.x - b.x, dy = tmp.y - b.y;
          const d = Math.hypot(dx, dy);
          if (d < 4) {
            b.state = 'up';
            b.s = 4;
          } else {
            b.x += (dx / d) * b.v * 0.8 * dt + Math.sin(b.t * 5 + b.ph) * 8 * dt;
            b.y += (dy / d) * b.v * 0.8 * dt;
          }
        } else if (b.state === 'up') {
          b.s += b.v * dt;
          conduitAt(b.s, tmp);
          b.x = tmp.x + Math.sin(b.t * 4 + b.ph) * 2.5;
          b.y = tmp.y;
          if (b.s >= conduit.total) {
            if (volcK > 0.9) {
              b.state = 'vent';
              b.t = 0;
            } else {
              popCount = Math.min(popCount, 9);
              continue;
            }
          }
        } else if (b.state === 'vent') {
          const y1 = craterY();
          b.y -= b.v * 1.2 * dt;
          b.x = G.xv + Math.sin(b.t * 6 + b.ph) * 1.5;
          if (b.y <= y1 + 2) {
            popCount++;
            if (Math.random() < 0.35) addMol(G.xv + rand(-3, 3), y1 - 3);
            continue;
          }
        }
        bubbles[j++] = b;
      }
      bubbles.length = j;
      j = 0;
      for (const m of blobs) {
        m.t += dt;
        m.s += m.v * dt;
        if (m.s >= conduit.total) continue;
        blobs[j++] = m;
      }
      blobs.length = j;

      /* molécules de CO2 dans l'air */
      j = 0;
      for (const m of mols) {
        m.t += dt;
        m.rot += m.vr * dt * AMB;
        if (m.state === 'rise') {
          const k = clamp(m.t / m.dur);
          m.x = lerp(m.x0, m.hx, ease.inOutSine(k));
          m.y = lerp(m.y0, m.hy, ease.outCubic(k));
          m.a = Math.min(1, m.t * 3);
          if (k >= 1) m.state = 'float';
        } else {
          m.hx += 4 * dt * AMB;
          if (m.hx > G.w + 10) m.hx -= G.w + 20;
          m.x += (m.hx + Math.sin(time * 0.5 + m.ph) * 8 * AMB - m.x) * Math.min(1, dt * 2);
          m.y += (m.hy + Math.cos(time * 0.4 + m.ph) * 5 * AMB - m.y) * Math.min(1, dt * 2);
        }
        mols[j++] = m;
      }
      mols.length = j;

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
        if (s.vy > 0 && s.y > topC(s.x)) continue;
        sparks[j++] = s;
      }
      sparks.length = j;
      j = 0;
      for (const f of flows) if ((f.t += dt) < 7) flows[j++] = f;
      flows.length = j;

      /* la pluie sur la montagne neuve, et les grains qui s'en détachent */
      if (rainOn > 0) {
        rainT += dt * 110 * rainOn;
        while (rainT >= 1 && drops.length < 140) {
          rainT -= 1;
          drops.push({ x: G.xm + rand(-0.42, 0.42) * cloudTex.CW, y: cloudYc() + cloudTex.CH * 0.2, vy: rand(280, 360) });
        }
        grainT += dt * 5 * rainOn;
        while (grainT >= 1 && grains.length < 40) {
          grainT -= 1;
          const x = G.xm + rand(-0.8, 1.6) * G.mw;
          if (mountainH(x) < G.mh * foldK * 0.3) continue;
          grains.push({ x, y: topC(x), vx: 0, dir: Math.sign(x - G.xm - G.mw * 0.4) || 1, t: 0, r: rand(1.3, 2.3), state: 'roll', col: Math.random() < 0.4 ? '#D9B79A' : '#A87563' });
        }
        if (grainT > 1) grainT = 0;
      }
      j = 0;
      for (const d of drops) {
        d.y += d.vy * dt;
        d.x -= 20 * dt;
        if (d.y >= topC(d.x)) {
          if (Math.random() < 0.5) flashes.push({ x: d.x, y: topC(d.x), t: 0.3, small: true });
          continue;
        }
        drops[j++] = d;
      }
      drops.length = j;
      j = 0;
      for (const g of grains) {
        g.t += dt;
        if (g.state === 'roll') {
          const slope = (topC(g.x + 1) - topC(g.x - 1)) / 2;
          const dir = slope > 0.05 ? 1 : slope < -0.05 ? -1 : g.dir;
          g.dir = dir;
          g.vx = lerp(g.vx, dir * (14 + Math.abs(slope) * 60), Math.min(1, dt * 4));
          g.x += g.vx * dt;
          if (g.x < G.xcoast - 2) {
            g.state = 'sink';
            g.t = 0;
          } else g.y = topC(g.x) - g.r * 0.6;
          if (Math.abs(slope) < 0.04 && g.t > 1.2) {
            g.state = 'rest';
            g.t = 0;
          }
        } else if (g.state === 'sink') {
          g.y += 22 * dt;
          g.x -= 6 * dt;
          if (g.t > 1.6) continue;
        } else if (g.t > 1.2) continue;
        grains[j++] = g;
      }
      grains.length = j;

      for (const s of streams) s.a += s.sp * s.L.dir * dt * AMB;
      j = 0;
      for (const r of rings) if ((r.t += dt) < 0.6) rings[j++] = r;
      rings.length = j;
      j = 0;
      for (const f of flashes) if ((f.t += dt) < 0.5) flashes[j++] = f;
      flashes.length = j;
    }
    function cloudYc() {
      return Math.max(G.h * 0.02, G.csurf - G.mh * 1.05 - cloudTex.CH * 0.95);
    }

    /* ---- dessin ---- */
    /* Un ciel de soir : indigo en haut, orange au ras de l'horizon, quelques nuages roses */
    function buildSky() {
      const { w, h } = G;
      const R = mk(w, Math.ceil(G.sea + 6));
      const g = R.g;
      const sk = g.createLinearGradient(0, 0, 0, G.sea);
      sk.addColorStop(0, '#1D1930');
      sk.addColorStop(0.5, '#4A2E45');
      sk.addColorStop(0.85, '#B2593F');
      sk.addColorStop(1, '#E58A55');
      g.fillStyle = sk;
      g.fillRect(0, 0, w, G.sea + 6);
      draw.glow(g, w * 0.86, G.sea, Math.max(w, h) * 0.32, '#FFC27A', 0.45);
      draw.glow(g, w * 0.86, G.sea - 2, Math.max(14, w * 0.06), '#FFE9C2', 0.95);
      const r = seeded(4);
      for (let i = 0; i < 5; i++) {
        const cx = r() * w, cy = G.sea * (0.35 + r() * 0.4), rw = w * (0.12 + r() * 0.16);
        for (let k = 0; k < 4; k++) {
          g.save();
          g.translate(cx + (r() - 0.5) * rw, cy + (r() - 0.5) * 4);
          g.scale(1, 0.18);
          draw.glow(g, 0, 0, rw * (0.5 + r() * 0.5), i % 2 ? '#F2A27E' : '#C9708A', 0.22);
          g.restore();
        }
      }
      for (let i = 0; i < 34; i++) {
        g.fillStyle = `rgba(255,240,230,${0.25 + r() * 0.55})`;
        const s = 0.6 + r() * 1.1;
        g.fillRect(r() * w, r() * G.sea * 0.45, s, s);
      }
      return R;
    }
    function drawSky() {
      const { w, h } = G;
      ctx.fillStyle = '#2A0B07';
      ctx.fillRect(-6, -6, w + 12, h + 12);
      ctx.drawImage(skyTex.c, 0, 0, skyTex.w, skyTex.h);
    }

    function drawMantle() {
      ctx.drawImage(mantleTex.c, 0, mantleTex.y0, mantleTex.w, mantleTex.h);
      /* lents courants dans le manteau : des traînées douces qui tournent en boucle */
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      for (const s of streams) {
        const L = s.L;
        ctx.beginPath();
        for (let k = 0; k <= 8; k++) {
          const a = s.a - L.dir * s.len * 0.7 * (k / 8);
          const wob = 1 + 0.08 * Math.sin(a * 3 + s.wid * 4);
          const x = L.cx * G.w + Math.cos(a) * L.rx * G.w * wob;
          const y = L.cy * G.h + Math.sin(a) * L.ry * G.h * wob;
          if (k === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = 'rgba(255,165,95,0.07)';
        ctx.lineWidth = s.wid * 2.2;
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    /* l'eau, de la surface jusqu'à la plaque et au flanc du continent */
    function drawOcean() {
      const { w } = G;
      const sVis = sAtX(-4);
      ctx.beginPath();
      ctx.moveTo(-4, G.sea);
      ctx.lineTo(G.xcoast + 2, G.sea);
      ctx.quadraticCurveTo(G.xcoast - 4, (G.sea + G.Qy) / 2, G.Qx, G.Qy);
      at(G.sQ, P);
      ctx.lineTo(P.x, P.y);
      for (let s = G.sQ; s >= sVis; s -= 6) {
        at(s, P);
        ctx.lineTo(P.x, P.y - limeAt(s - off) * burnAt(P.y) + 1);
      }
      ctx.lineTo(-4, plateYAt(0));
      ctx.closePath();
      const g = ctx.createLinearGradient(0, G.sea, 0, G.Qy + 10);
      g.addColorStop(0, '#2C7C8C');
      g.addColorStop(0.55, '#174E5E');
      g.addColorStop(1, '#0A2731');
      ctx.fillStyle = g;
      ctx.fill();
      /* rayons de lumière */
      ctx.save();
      ctx.clip();
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = '#DFF6FF';
      for (let i = 0; i < 4; i++) {
        const x = w * (0.06 + i * 0.12) + Math.sin(time * 0.4 + i) * 4 * AMB;
        ctx.beginPath();
        ctx.moveTo(x - 5, G.sea);
        ctx.lineTo(x + 6, G.sea);
        ctx.lineTo(x - 10, G.Qy);
        ctx.lineTo(x - 26, G.Qy);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      for (let x = -4; x <= G.xcoast + 4; x += 4) ctx.lineTo(x, G.sea + Math.sin(x * 0.07 + time * 1.5 * AMB) * 1.1);
      ctx.strokeStyle = 'rgba(200,240,240,0.75)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    /* la plaque océanique (basalte) et son tapis de calcaire */
    function drawPlate() {
      const { h } = G;
      const s0 = sAtX(-6);
      const s1 = G.sEnd;
      const step = 4;
      ctx.beginPath();
      for (let s = s0; s <= s1; s += step) {
        at(s, P);
        if (s === s0) ctx.moveTo(P.x, P.y);
        else ctx.lineTo(P.x, P.y);
      }
      for (let s = s1; s >= s0; s -= step) {
        at(s, P);
        ctx.lineTo(P.x - Math.sin(P.a) * G.T, P.y + Math.cos(P.a) * G.T);
      }
      ctx.closePath();
      const g = ctx.createLinearGradient(0, G.y0, 0, h);
      g.addColorStop(0, '#3A3E43');
      g.addColorStop(0.35, '#33363A');
      g.addColorStop(0.75, '#5A2C20');
      g.addColorStop(1, '#8A3A20');
      ctx.fillStyle = g;
      ctx.fill();
      /* rayures qui avancent avec la plaque : on voit le tapis roulant bouger */
      ctx.lineWidth = 2;
      const per = 18;
      const m0 = Math.floor((s0 - off) / per) * per;
      for (let m = m0; m + off <= s1; m += per) {
        const s = m + off;
        if (s < s0) continue;
        at(s, P);
        const nx = -Math.sin(P.a), ny = Math.cos(P.a);
        const k = ((Math.round(m / per) % 3) + 3) % 3;
        ctx.strokeStyle = k === 0 ? 'rgba(255,240,230,0.1)' : 'rgba(0,0,0,0.18)';
        ctx.beginPath();
        ctx.moveTo(P.x + nx * 2, P.y + ny * 2);
        ctx.lineTo(P.x + nx * (G.T - 2), P.y + ny * (G.T - 2));
        ctx.stroke();
      }
      /* bord supérieur clair, bord inférieur sombre */
      ctx.beginPath();
      for (let s = s0; s <= s1; s += step) {
        at(s, P);
        ctx.lineTo(P.x, P.y + 0.8);
      }
      ctx.strokeStyle = 'rgba(160,170,175,0.45)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.beginPath();
      for (let s = s0; s <= s1; s += step) {
        at(s, P);
        ctx.lineTo(P.x - Math.sin(P.a) * G.T, P.y + Math.cos(P.a) * G.T);
      }
      ctx.strokeStyle = 'rgba(20,6,4,0.55)';
      ctx.lineWidth = 2;
      ctx.stroke();

      /* le tapis de calcaire, en couches blanches */
      ctx.beginPath();
      let open = false;
      const back = [];
      const runEnd = () => {
        for (let i = back.length - 2; i >= 0; i -= 2) ctx.lineTo(back[i], back[i + 1]);
        ctx.closePath();
        open = false;
        back.length = 0;
      };
      for (let s = s0; s <= s1; s += 3) {
        const L = limeAt(s - off);
        at(s, P);
        const Lb = L * burnAt(P.y);
        if (Lb > 0.35) {
          const tx = P.x + Math.sin(P.a) * Lb, ty = P.y - Math.cos(P.a) * Lb;
          if (!open) {
            ctx.moveTo(tx, ty);
            open = true;
          } else ctx.lineTo(tx, ty);
          back.push(P.x, P.y + 0.6);
        } else if (open) runEnd();
      }
      if (open) runEnd();
      const lg = ctx.createLinearGradient(0, G.hotY - G.h * 0.08, 0, G.hotY + G.h * 0.08);
      lg.addColorStop(0, '#F3EEE2');
      lg.addColorStop(0.55, lib.mix('#F3EEE2', '#FFB070', heatK));
      lg.addColorStop(1, lib.mix('#E6DCC8', '#FF7A30', heatK));
      ctx.fillStyle = lg;
      ctx.fill();
      ctx.strokeStyle = 'rgba(140,120,95,0.4)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      /* les couches du calcaire */
      ctx.beginPath();
      for (const f of [0.36, 0.7]) {
        let run = false;
        for (let s = s0; s <= s1; s += 3) {
          at(s, P);
          const Lb = limeAt(s - off) * burnAt(P.y);
          if (Lb > 2) {
            const x = P.x + Math.sin(P.a) * Lb * f, y = P.y - Math.cos(P.a) * Lb * f;
            if (run) ctx.lineTo(x, y);
            else ctx.moveTo(x, y);
            run = true;
          } else run = false;
        }
      }
      ctx.strokeStyle = 'rgba(150,130,100,0.45)';
      ctx.lineWidth = 0.9;
      ctx.stroke();
      /* lueur du calcaire qui chauffe */
      if (heatK > 0.02) {
        ctx.globalCompositeOperation = 'lighter';
        for (let s = G.sHot - 10; s < G.sHot + G.w * 0.22; s += 14) {
          const L = limeAt(s - off);
          if (L < 1) continue;
          at(s, P);
          draw.glow(ctx, P.x, P.y - 3, 14, '#FF8A3D', 0.22 * heatK * (0.7 + 0.3 * Math.sin(time * 3 + s)));
        }
        ctx.globalCompositeOperation = 'source-over';
      }
    }

    /* le continent : granite, couverture de couches qui se plissent, volcan */
    function continentPath() {
      const { w } = G;
      ctx.beginPath();
      ctx.moveTo(G.Qx, G.Qy);
      ctx.quadraticCurveTo(G.xcoast - 4, (G.sea + G.Qy) / 2, G.xcoast, topC(G.xcoast));
      for (let x = G.xcoast; x <= w + 4; x += 3) ctx.lineTo(x, topC(x));
      ctx.lineTo(w + 4, G.cbase);
      /* la base : plate au fond, puis posée sur la plaque qui plonge */
      at(G.sCB, P);
      ctx.lineTo(P.x + Math.sin(P.a) * G.chan, G.cbase);
      for (let s = G.sCB; s >= G.sQ; s -= 6) {
        at(s, P);
        ctx.lineTo(P.x + Math.sin(P.a) * G.chan, P.y - Math.cos(P.a) * G.chan);
      }
      ctx.closePath();
    }
    function coverY(x, k) {
      /* les couches de la couverture : elles suivent le relief et se froissent près de la montagne */
      const t = topC(x);
      const near = Math.exp(-Math.pow((x - G.xm - G.mw * 0.3) / (G.mw * 2.2), 2));
      const wig = foldK * near * G.h * 0.012 * Math.sin((x - G.xm) * 0.11 + k * 0.9) * (1 + k * 0.4);
      const lift = Math.max(mountainH(x), 0) * (0.1 + 0.08 * k);
      return t + G.h * 0.014 * (k + 1) + wig + lift;
    }
    function drawContinent() {
      const { w } = G;
      ctx.save();
      continentPath();
      ctx.clip();
      ctx.drawImage(graniteTex.c, 0, G.csurf - G.mh * 1.2 - 10, graniteTex.w, graniteTex.h);
      /* la couverture de couches, au-dessus du granite */
      const COLS = ['#C9A27A', '#A9774E', '#D8B88E', '#8E6444'];
      for (let k = COLS.length - 1; k >= 0; k--) {
        ctx.beginPath();
        ctx.moveTo(G.xcoast - 20, topC(G.xcoast) - 2);
        for (let x = G.xcoast - 20; x <= w + 4; x += 3) ctx.lineTo(x, topC(x) - 2);
        for (let x = w + 4; x >= G.xcoast - 20; x -= 3) ctx.lineTo(x, coverY(x, k));
        ctx.closePath();
        ctx.fillStyle = COLS[k];
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(70,40,25,0.3)';
      ctx.lineWidth = 0.9;
      for (let k = 0; k < COLS.length; k++) {
        ctx.beginPath();
        for (let x = G.xcoast - 20; x <= w + 4; x += 3) ctx.lineTo(x, coverY(x, k));
        ctx.stroke();
      }
      /* ombre douce sous la surface, et bord du continent plus sombre */
      ctx.beginPath();
      for (let x = G.xcoast - 10; x <= w + 4; x += 4) ctx.lineTo(x, topC(x) + 5);
      ctx.strokeStyle = 'rgba(30,12,8,0.12)';
      ctx.lineWidth = 8;
      ctx.stroke();
      const eg = ctx.createLinearGradient(G.Qx - 10, 0, G.xcoast + G.w * 0.08, 0);
      eg.addColorStop(0, 'rgba(25,10,6,0.45)');
      eg.addColorStop(1, 'rgba(25,10,6,0)');
      ctx.fillStyle = eg;
      ctx.fillRect(G.Qx - 12, G.sea - G.mh * 1.3, G.w * 0.2, G.h * 0.6);
      ctx.restore();
      /* la terre végétale sur le dessus */
      ctx.beginPath();
      for (let x = G.xcoast + 2; x <= w + 4; x += 3) ctx.lineTo(x, topC(x) + 0.6);
      ctx.strokeStyle = '#6E7A3C';
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      ctx.stroke();
      /* quelques arbres ronds */
      for (const [u, s] of TREES) {
        const x = u * w;
        const a = 1 - clamp(Math.max(volcanoH(x), mountainH(x)) / (G.mh * 0.25));
        if (a <= 0.02) continue;
        ctx.globalAlpha = a;
        drawTree(x, topC(x), s * Math.max(2.6, G.m * 0.011));
      }
      ctx.globalAlpha = 1;
      if (foldK > 0.3) {
        /* roche nue, toute fraîche, au sommet de la montagne */
        ctx.beginPath();
        for (let x = G.xm - G.mw * 1.4; x <= G.xm + G.mw * 2; x += 3) {
          if (mountainH(x) < G.mh * 0.55) {
            ctx.moveTo(x, topC(x));
            continue;
          }
          ctx.lineTo(x, topC(x) + 0.5);
        }
        ctx.strokeStyle = `rgba(214,180,150,${clamp((foldK - 0.3) * 2)})`;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      if (volcK > 0.01) drawCone();
      /* le magma qui monte de la plaque chaude jusqu'au volcan */
      if (chamberK > 0.01) drawMagmaInside();
    }

    const TREES = [[0.585, 0.9], [0.708, 1], [0.948, 1.1], [0.978, 0.85]];
    function drawTree(x, y, s) {
      ctx.fillStyle = '#4A3526';
      ctx.fillRect(x - 0.7, y - s * 1.3, 1.4, s * 1.4);
      const gr = ctx.createRadialGradient(x - s * 0.35, y - s * 1.9, s * 0.2, x, y - s * 1.6, s * 1.2);
      gr.addColorStop(0, '#A7C46A');
      gr.addColorStop(1, '#4A6B2C');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(x, y - s * 1.6, s, 0, TAU);
      ctx.fill();
    }

    function drawMagmaInside() {
      const k = chamberK;
      /* le chemin du magma */
      const { A } = conduit;
      ctx.beginPath();
      ctx.moveTo(A[0], A[1]);
      for (let i = 2; i < A.length; i += 2) ctx.lineTo(A[i], A[i + 1]);
      if (volcK > 0.05) ctx.lineTo(G.xv, craterY() + 4);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = `rgba(40,10,4,${0.7 * k})`;
      ctx.lineWidth = 7;
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,110,40,${0.75 * k})`;
      ctx.lineWidth = 3.4;
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,220,140,${(0.3 + 0.5 * act) * k})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      /* la chambre */
      const R = G.chR * (0.5 + 0.5 * k);
      ctx.save();
      ctx.translate(G.xv, G.chY);
      ctx.scale(1, 0.62);
      const gr = ctx.createRadialGradient(-R * 0.3, -R * 0.3, 1, 0, 0, R * 1.4);
      gr.addColorStop(0, '#FFE7A8');
      gr.addColorStop(0.4, '#FF9A3A');
      gr.addColorStop(1, '#B83A18');
      ctx.fillStyle = gr;
      draw.blob(ctx, 0, 0, R * 1.4, 0.1, 3, time * 0.6 * AMB, 24);
      ctx.fill();
      ctx.strokeStyle = 'rgba(40,12,6,0.7)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
      ctx.globalCompositeOperation = 'lighter';
      draw.glow(ctx, G.xv, G.chY, R * 3, '#FF7A2A', 0.18 * k + 0.2 * act);
      ctx.globalCompositeOperation = 'source-over';
    }

    function drawCone() {
      const x0 = G.xv - G.vw, x1 = G.xv + G.vw;
      /* le cône posé sur le sol (sans recouvrir la montagne voisine) */
      ctx.beginPath();
      for (let x = x0; x <= x1; x += 2) ctx.lineTo(x, G.csurf - Math.max(volcanoH(x), mountainH(x)) + Math.sin(x * 0.09) * 0.8);
      for (let x = x1; x >= x0; x -= 2) ctx.lineTo(x, G.csurf - mountainH(x) + 3);
      ctx.closePath();
      const g = ctx.createLinearGradient(G.xv - G.vw * 0.5, craterY(), G.xv + G.vw * 0.6, G.csurf);
      g.addColorStop(0, '#5A4A44');
      g.addColorStop(1, '#2B2220');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = 'rgba(0,0,0,0.22)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 5; i++) {
        ctx.beginPath();
        for (let x = x0; x <= x1; x += 3) ctx.lineTo(x, G.csurf - volcanoH(x) + i * G.vh * 0.18 * volcK);
        ctx.stroke();
      }
      ctx.restore();
      /* le cratère rougeoie */
      ctx.globalCompositeOperation = 'lighter';
      draw.glow(ctx, G.xv, craterY() + 2, 10 + 24 * act, '#FF8A3A', 0.35 + 0.55 * act);
      ctx.globalCompositeOperation = 'source-over';
      /* coulées de lave */
      ctx.lineCap = 'round';
      for (const f of flows) {
        const grow = ease.outCubic(clamp(f.t / 1.5));
        const cool = clamp((f.t - 0.8) / 4);
        const fade = 1 - clamp((f.t - 5) / 2);
        const xa = G.xv + f.dir * G.vw * 0.16, xb = G.xv + f.dir * G.vw * (0.16 + 0.84 * f.len * grow);
        ctx.beginPath();
        for (let x = xa; f.dir > 0 ? x <= xb : x >= xb; x += f.dir * 2) ctx.lineTo(x, G.csurf - volcanoH(x) + 1.2);
        ctx.globalAlpha = fade;
        ctx.strokeStyle = lib.mix('#FF7A2A', '#4A2219', cool);
        ctx.lineWidth = 3;
        ctx.stroke();
        if (cool < 0.9) {
          ctx.strokeStyle = lib.mix('#FFE08A', '#7A2E1C', cool);
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }

    function drawChannel() {
      /* le chenal sous le bord du continent, où glisse le calcaire */
      ctx.beginPath();
      for (let s = G.sQ; s <= G.sCB; s += 6) {
        at(s, P);
        ctx.lineTo(P.x + Math.sin(P.a) * G.chan, P.y - Math.cos(P.a) * G.chan);
      }
      for (let s = G.sCB; s >= G.sQ; s -= 6) {
        at(s, P);
        ctx.lineTo(P.x, P.y);
      }
      ctx.closePath();
      ctx.fillStyle = '#2A1712';
      ctx.fill();
    }

    function drawBubbles() {
      /* gouttes de magma */
      ctx.globalCompositeOperation = 'lighter';
      for (const m of blobs) {
        conduitAt(m.s, tmp);
        const x = tmp.x + Math.sin(m.t * 2 + m.ph) * 2;
        draw.glow(ctx, x, tmp.y, m.r * 2.6, '#FF7A2A', 0.5);
      }
      ctx.globalCompositeOperation = 'source-over';
      for (const m of blobs) {
        conduitAt(m.s, tmp);
        const x = tmp.x + Math.sin(m.t * 2 + m.ph) * 2;
        ctx.fillStyle = '#FFB25A';
        ctx.beginPath();
        ctx.arc(x, tmp.y, m.r * 0.8, 0, TAU);
        ctx.fill();
      }
      /* bulles de CO2 */
      ctx.lineWidth = 1.3;
      for (const b of bubbles) {
        const a = Math.min(1, b.t * 4);
        ctx.globalAlpha = a;
        ctx.fillStyle = 'rgba(95,224,198,0.28)';
        ctx.strokeStyle = '#8FF2DC';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillRect(b.x - b.r * 0.45, b.y - b.r * 0.5, 1.1, 1.1);
      }
      ctx.globalAlpha = 1;
    }

    function drawAir() {
      const dpr = cv.dpr;
      for (const m of mols) {
        const c = Math.cos(m.rot) * dpr * m.sc, s = Math.sin(m.rot) * dpr * m.sc;
        ctx.setTransform(c, s, -s, c, m.x * dpr, m.y * dpr);
        ctx.globalAlpha = clamp(m.a) * 0.95;
        ctx.drawImage(molTex.c, -9, -9, 18, 18);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1;
      for (const p of puffs) {
        if (p.t < 0) continue;
        const k = p.t / p.life;
        const a = Math.min(1, p.t / 0.18) * Math.pow(1 - k, 1.3) * (p.faint ? 0.32 : 0.95);
        if (a < 0.01) continue;
        const s = p.r * 2.4;
        ctx.globalAlpha = a;
        ctx.drawImage(puffTex[p.spr].c, p.x - s / 2, p.y - s / 2, s, s);
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
      if (cloudA > 0.01) {
        ctx.globalAlpha = cloudA;
        const x = G.xm + G.mw * 0.3 - cloudTex.CW / 2 + Math.sin(time * 0.3) * 3 * AMB;
        ctx.drawImage(cloudTex.c, x, cloudYc(), cloudTex.CW, cloudTex.CH);
        ctx.globalAlpha = 1;
      }
      if (drops.length) {
        ctx.beginPath();
        for (const d of drops) {
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x + 0.6, d.y - d.vy * 0.03);
        }
        ctx.strokeStyle = 'rgba(200,225,240,0.7)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
      for (const g of grains) {
        const a = g.state === 'roll' ? 1 : 1 - clamp(g.t / (g.state === 'sink' ? 1.6 : 1.2));
        ctx.globalAlpha = a;
        ctx.fillStyle = g.col;
        ctx.beginPath();
        ctx.arc(g.x, g.y, g.r, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function render() {
      let sx = 0, sy = 0;
      if (shake > 0 && !api.reducedMotion) {
        const k = Math.min(1, shake / 0.6);
        sx = Math.sin(time * 51) * 2.2 * k;
        sy = Math.cos(time * 43) * 1.3 * k;
      }
      ctx.save();
      ctx.translate(sx, sy);
      drawSky();
      drawMantle();
      drawOcean();
      drawPlate();
      drawChannel();
      drawContinent();
      drawBubbles();
      ctx.restore();
      if (sx || sy) ctx.setTransform(cv.dpr, 0, 0, cv.dpr, cv.dpr * sx, cv.dpr * sy);
      drawAir();
      ctx.setTransform(cv.dpr, 0, 0, cv.dpr, 0, 0);
      ctx.globalCompositeOperation = 'lighter';
      for (const f of flashes) {
        const k = f.t / 0.5;
        if (f.small) draw.glow(ctx, f.x, f.y, 3 + 5 * k, '#DDEFFF', 0.6 * (1 - k));
        else draw.glow(ctx, f.x, f.y, 20 + 40 * k, '#FFD27A', 0.9 * (1 - k));
      }
      ctx.globalCompositeOperation = 'source-over';
      for (const r of rings) {
        const k = r.t / 0.6;
        ctx.strokeStyle = `rgba(251,234,224,${0.8 * (1 - k)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(r.x, r.y, 6 + 28 * ease.outCubic(k), 0, TAU);
        ctx.stroke();
      }
    }

    function showGesture() {
      const y = plateYAt(G.w * 0.25) + G.T * 0.45;
      api.gesture('drag', { x: 22, y: (y / G.h) * 100, dx: 110, dy: 0 });
    }

    function init() {
      stage = 0;
      off = offT = extra = 0;
      lock = 0;
      seqT = -1;
      finished = false;
      drag = null;
      volcK = foldK = chamberK = cloudA = rainOn = heatK = 0;
      shake = act = 0;
      bubbleT = blobT = rainT = grainT = puffT = 0;
      popCount = 0;
      bubbles = [];
      blobs = [];
      mols = [];
      puffs = [];
      sparks = [];
      flows = [];
      drops = [];
      grains = [];
      rings = [];
      flashes = [];
      initStreams();
      btnState = '';
      setBtn();
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
