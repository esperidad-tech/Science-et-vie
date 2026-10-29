/* Poussières d'étoiles : chaque tape provoque des collisions qui collent la poussière
   à la jeune Terre, jusqu'à former une boule de roche en fusion.
   Version des petits : une demi-douzaine de tapes suffit, la barre de progression montre l'avancée. */
(function () {
  'use strict';
  const { lib } = window.RM;
  const { TAU, rand, clamp, lerp, ease, rgba, ramp, draw } = lib;

  /* Tous les textes du jeu, faciles à corriger.
     La consigne de départ est celle d'index.html : « Tape dans le nuage : les poussières se collent pour faire la Terre. » */
  const TEXTES = {
    fin: 'Voilà la Terre : une boule de roche brûlante !',
  };

  window.RM.games.poussiere = function (api) {
    const cv = api.canvas();
    const ctx = cv.ctx;

    const DUST = ['#FFC46B', '#FFD9A0', '#FF8FB1', '#C9B6FF', '#FFFFFF', '#F5A06B'];
    const TARGET = 80;    /* poussières à réunir (une tape en attire 8 à 14 : environ 6 tapes) */
    const N = 430;        /* poussières dans le nuage */
    const SQUASH = 0.5;   /* disque vu de biais */
    const SPEED = api.reducedMotion ? 0.07 : 0.22;

    let parts = [];
    let waves = [];
    let flashes = [];
    let mass = 0;
    let shownPct = -1;
    let passive = 0;
    let finished = false;
    let finishT = 0;
    let bump = 0;
    let time = 0;
    let bg = null;

    /* ---- textures ---- */
    /* Surface de la planète : des plaques de croûte sombre sur un océan de lave.
       Plus la Terre grossit et chauffe, plus la lave gagne du terrain. */
    const LW = 320, LH = 160;
    const field = new Float32Array(LW * LH);
    (function makeField() {
      const n = lib.makeNoise(7);
      for (let y = 0; y < LH; y++) {
        for (let x = 0; x < LW; x++) {
          /* bruit enroulé sur un cylindre pour que la texture boucle sans couture */
          const a = (x / LW) * TAU;
          const v = n.fbm(Math.cos(a) * 3.2 + 10, Math.sin(a) * 3.2 + y / 15.9, 4);
          field[y * LW + x] = v;
        }
      }
    })();
    const lava = document.createElement('canvas');
    lava.width = LW;
    lava.height = LH;
    const lctx = lava.getContext('2d');
    const limg = lctx.createImageData(LW, LH);
    let lavaHeat = -1;
    const C = {
      deep: lib.hexToRgb('#E8501A'), hot: lib.hexToRgb('#FFB238'), rim: lib.hexToRgb('#FFF0B8'),
      crustA: lib.hexToRgb('#4A2118'), crustB: lib.hexToRgb('#1F0D0A'),
    };
    function paintLava(heat) {
      const q = Math.round(heat * 50) / 50;
      if (q === lavaHeat) return;
      lavaHeat = q;
      const th = lerp(0.3, 0.6, q);
      const d = limg.data;
      for (let i = 0; i < field.length; i++) {
        const v = field[i];
        let c;
        const edge = Math.abs(v - th);
        if (v < th) {
          const k = clamp((th - v) * 6);
          c = [lerp(C.hot[0], C.deep[0], k), lerp(C.hot[1], C.deep[1], k), lerp(C.hot[2], C.deep[2], k)];
        } else {
          const k = clamp((v - th) * 7);
          c = [lerp(C.crustA[0], C.crustB[0], k), lerp(C.crustA[1], C.crustB[1], k), lerp(C.crustA[2], C.crustB[2], k)];
        }
        if (edge < 0.018) {
          const r = 1 - edge / 0.018;
          c = [lerp(c[0], C.rim[0], r), lerp(c[1], C.rim[1], r), lerp(c[2], C.rim[2], r)];
        }
        const j = i * 4;
        d[j] = c[0]; d[j + 1] = c[1]; d[j + 2] = c[2]; d[j + 3] = 255;
      }
      lctx.putImageData(limg, 0, 0);
    }

    function makeBg(w, h) {
      const c = document.createElement('canvas');
      c.width = Math.round(w * cv.dpr);
      c.height = Math.round(h * cv.dpr);
      const g = c.getContext('2d');
      g.scale(cv.dpr, cv.dpr);
      g.fillStyle = '#0E0A24';
      g.fillRect(0, 0, w, h);
      const blobs = [
        [0.18, 0.22, 0.75, '#3B2A86', 0.55],
        [0.85, 0.78, 0.7, '#7A2A62', 0.4],
        [1.02, -0.02, 0.55, '#FFB45A', 0.35],
        [0.5, 0.55, 0.5, '#2B2368', 0.5],
      ];
      blobs.forEach(([x, y, r, col, a]) => draw.glow(g, x * w, y * h, r * Math.max(w, h), col, a));
      /* le disque de poussières, vu de biais */
      g.save();
      g.translate(geo.cx, geo.cy);
      g.scale(1, SQUASH);
      draw.glow(g, 0, 0, geo.D * 1.08, '#B98BFF', 0.16);
      draw.glow(g, 0, 0, geo.D * 0.7, '#FFC46B', 0.1);
      g.restore();
      for (let i = 0; i < 70; i++) {
        g.fillStyle = rgba('#FFFFFF', rand(0.15, 0.6));
        const s = rand(0.5, 1.4);
        g.fillRect(rand(w), rand(h), s, s);
      }
      return c;
    }

    /* ---- géométrie ---- */
    const geo = { cx: 0, cy: 0, D: 1 };
    cv.onResize((w, h) => {
      geo.cx = w / 2;
      geo.cy = h * 0.52;
      geo.D = Math.min(w, h / (SQUASH * 1.6)) * 0.47;
      bg = makeBg(w, h);
    });

    function planetR() {
      return lerp(0.07, 0.4, Math.sqrt(clamp(mass / TARGET)));
    }

    function spawn(p, outer) {
      p.rn = outer ? rand(0.88, 1.05) : lerp(0.42, 1.04, Math.sqrt(Math.random()));
      p.th = rand(TAU);
      p.z = rand(-1, 1) * rand(0.4, 1);
      p.size = rand(0.8, 2.4);
      p.col = DUST[Math.floor(Math.random() * DUST.length)];
      p.a = rand(0.45, 1);
      p.tw = rand(1, 4);
      p.ph = rand(TAU);
      p.state = 'orbit';
      p.fadeIn = outer ? 0 : 1;
      p.wait = 0;
      p.fall = null;
      return p;
    }

    function init() {
      parts = Array.from({ length: N }, () => spawn({}, false));
      waves = [];
      flashes = [];
      mass = 0;
      shownPct = -1;
      passive = 0;
      finished = false;
      finishT = 0;
      bump = 0;
      updateProgress();
      api.gesture('tap', { x: 26, y: 68 });
    }

    function screen(p) {
      const x = geo.cx + Math.cos(p.th) * p.rn * geo.D;
      const y = geo.cy + Math.sin(p.th) * p.rn * geo.D * SQUASH + p.z * geo.D * 0.05;
      return [x, y];
    }

    function startFall(p) {
      if (p.state !== 'orbit') return false;
      p.state = 'fall';
      p.fall = { t: 0, dur: rand(0.55, 1.05), r0: p.rn, z0: p.z };
      return true;
    }

    /* ---- interaction ---- */
    function onTap(x, y) {
      if (finished) {
        waves.push({ x, y, t: 0, dur: 0.7 });
        api.sfx.play('pop', { pitch: rand(0.8, 1.2) });
        return;
      }
      waves.push({ x, y, t: 0, dur: 0.6 });
      api.sfx.play('pop', { pitch: rand(0.85, 1.25) });
      api.buzz(8);
      const R = geo.D * 0.33;
      const near = [];
      for (const p of parts) {
        if (p.state !== 'orbit' || p.fadeIn < 0.5) continue;
        const [px, py] = screen(p);
        const d = Math.hypot(px - x, py - y);
        near.push([d, p]);
      }
      near.sort((a, b) => a[0] - b[0]);
      let n = 0;
      for (const [d, p] of near) {
        if (n >= 14) break;
        if (d < R || n < 8) {
          if (startFall(p)) n++;
        }
      }
    }

    api.track(cv.canvas, {
      up(p, e, cancelled) {
        if (!cancelled && p.tap) onTap(p.x, p.y);
      },
    }, { touchAction: 'pan-y' });

    /* pas de texte pendant la partie : la barre de progression et la boule qui grossit suffisent */
    function updateProgress() {
      const pct = Math.round(clamp(mass / TARGET) * 100);
      if (pct === shownPct) return;
      shownPct = pct;
      api.progress(pct / 100);
    }

    function merge(p) {
      mass++;
      bump = Math.min(0.14, bump + 0.03);
      flashes.push({ th: p.th, t: 0 });
      api.sfx.play('tick', { pitch: rand(0.8, 1.3), gap: 45 });
      p.state = 'dead';
      p.wait = rand(0.4, 2.5);
      updateProgress();
      if (!finished && mass >= TARGET) {
        finished = true;
        finishT = 0;
        api.sfx.play('rumble');
        api.done(TEXTES.fin);
      }
    }

    /* ---- animation ---- */
    function update(dt) {
      time += dt;
      bump *= Math.pow(0.02, dt);
      const pr = planetR();
      passive += dt;
      if (!finished && passive > 1.3) {
        passive = 0;
        const cand = parts.filter((p) => p.state === 'orbit' && p.rn < 0.6);
        if (cand.length) startFall(cand[Math.floor(Math.random() * cand.length)]);
      }
      for (const p of parts) {
        if (p.state === 'orbit') {
          p.th += SPEED * Math.pow(Math.max(p.rn, 0.2), -1.5) * dt;
          if (p.fadeIn < 1) p.fadeIn = Math.min(1, p.fadeIn + dt * 0.8);
          if (finished) {
            p.rn += dt * 0.12 * (1 + finishT * 0.3);
            p.a *= Math.pow(0.6, dt);
          } else if (p.rn < pr + 0.012) {
            startFall(p);
          }
        } else if (p.state === 'fall') {
          const f = p.fall;
          f.t += dt;
          const k = clamp(f.t / f.dur);
          const e = ease.inQuad(k);
          p.rn = lerp(f.r0, pr * 0.85, e);
          p.z = lerp(f.z0, 0, e);
          p.th += SPEED * 3.2 * Math.pow(Math.max(p.rn, 0.2), -1.5) * dt;
          if (k >= 1) merge(p);
        } else if (p.state === 'dead' && !finished) {
          p.wait -= dt;
          if (p.wait <= 0) spawn(p, true);
        }
      }
      if (finished) finishT += dt;
      waves = waves.filter((w) => (w.t += dt) < w.dur);
      flashes = flashes.filter((f) => (f.t += dt) < 0.45);
    }

    function drawDust(p, front) {
      const s = Math.sin(p.th);
      if ((s >= 0) !== front) return;
      const [x, y] = screen(p);
      const depth = 0.75 + 0.25 * s;
      const tw = 0.75 + 0.25 * Math.sin(time * p.tw + p.ph);
      const a = p.a * tw * p.fadeIn * depth;
      if (a < 0.02) return;
      const size = p.size * depth * (p.state === 'fall' ? 1.25 : 1);
      ctx.fillStyle = rgba(p.col, a);
      if (size < 1.3) {
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
      } else {
        ctx.beginPath();
        ctx.arc(x, y, size * 0.7, 0, TAU);
        ctx.fill();
      }
      if (p.state === 'fall') {
        const tx = geo.cx + Math.cos(p.th - 0.18) * (p.rn + 0.03) * geo.D;
        const ty = geo.cy + Math.sin(p.th - 0.18) * (p.rn + 0.03) * geo.D * SQUASH;
        ctx.strokeStyle = rgba(p.col, a * 0.5);
        ctx.lineWidth = size * 0.6;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    }

    function drawPlanet() {
      const heat = clamp(mass / TARGET);
      const R = planetR() * geo.D * (1 + bump * 0.35);
      const x = geo.cx;
      const y = geo.cy;
      const pulse = finished ? 0.08 * Math.sin(finishT * 2.4) : 0;
      ctx.globalCompositeOperation = 'lighter';
      draw.glow(ctx, x, y, R * (2.1 + heat * 1.6 + pulse * 4), heat > 0.35 ? '#FF7A1A' : '#9A4430', 0.18 + heat * 0.32);
      ctx.globalCompositeOperation = 'source-over';

      paintLava(heat);
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, R, 0, TAU);
      ctx.clip();
      /* la texture défile : la planète tourne sur elle-même */
      const tw = R * 4.2;
      const th = R * 2.1;
      const off = (time * R * 0.18) % tw;
      ctx.drawImage(lava, x - R - off, y - th / 2, tw, th);
      ctx.drawImage(lava, x - R - off + tw, y - th / 2, tw, th);
      /* au début, un caillou sombre ; à la fin, un océan de lave */
      ctx.fillStyle = rgba('#2A1A1C', 0.55 * (1 - heat));
      ctx.fillRect(x - R, y - R, R * 2, R * 2);
      const sh = ctx.createRadialGradient(x - R * 0.35, y - R * 0.4, R * 0.1, x, y, R * 1.05);
      sh.addColorStop(0, 'rgba(255,236,200,0.22)');
      sh.addColorStop(0.55, 'rgba(0,0,0,0)');
      sh.addColorStop(1, 'rgba(14,6,30,0.7)');
      ctx.fillStyle = sh;
      ctx.fillRect(x - R, y - R, R * 2, R * 2);
      ctx.restore();

      ctx.globalCompositeOperation = 'lighter';
      for (const f of flashes) {
        const k = f.t / 0.45;
        const fx = x + Math.cos(f.th) * R;
        const fy = y + Math.sin(f.th) * R * 0.9;
        draw.glow(ctx, fx, fy, 6 + 10 * k, '#FFE2A8', 0.9 * (1 - k));
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    function render() {
      const { w, h } = cv;
      if (bg) ctx.drawImage(bg, 0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      for (const p of parts) if (p.state !== 'dead') drawDust(p, false);
      ctx.globalCompositeOperation = 'source-over';
      drawPlanet();
      ctx.globalCompositeOperation = 'lighter';
      for (const p of parts) if (p.state !== 'dead') drawDust(p, true);
      ctx.globalCompositeOperation = 'source-over';
      for (const wv of waves) {
        const k = wv.t / wv.dur;
        ctx.strokeStyle = rgba('#FFE7C2', 0.7 * (1 - k));
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(wv.x, wv.y, lerp(6, geo.D * 0.33, ease.outCubic(k)), 0, TAU);
        ctx.stroke();
      }
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
