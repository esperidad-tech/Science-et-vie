/* Le thermostat de la Terre — chef d'orchestre de la page :
   thermostat collant, sommaire, son, et montage des mini-jeux. */
(function () {
  'use strict';
  const { lib } = window.RM;
  const { clamp, lerp, fr } = lib;

  /* ---------- Le thermostat (barre collante) ----------
     Chaque chapitre porte data-thermo (0 = glacial, 0,5 = juste bien, 1 = brûlant)
     et data-thermo-label (le texte affiché). */
  const RAMP = [[0, '#7FC8F8'], [0.3, '#5FB4E8'], [0.5, '#8BD86A'], [0.7, '#FFB347'], [1, '#FF4E3A']];
  const thermoColor = (t) => lib.ramp(RAMP, clamp(t, 0, 1));

  const bar = document.querySelector('.timebar');
  const agoEl = bar && bar.querySelector('.tb-ago');
  const eonEl = bar && bar.querySelector('.tb-eon');
  const dotEl = bar && bar.querySelector('.tb-dot');
  const marker = bar && bar.querySelector('.tb-marker');
  const chapters = Array.from(document.querySelectorAll('[data-chapter]'));

  let shown = 0.5;
  let target = 0.5;
  let from = 0.5;
  let tweenT = 1;
  let label = '';

  function paintBar() {
    if (!marker) return;
    marker.style.setProperty('--pos', shown);
    const c = thermoColor(shown);
    marker.style.setProperty('--c', c);
    if (dotEl) dotEl.style.background = c;
  }

  function setChapter(ch) {
    if (!ch) return;
    chapters.forEach((c) => c.classList.toggle('is-current', c === ch));
    if (menuList) {
      menuList.querySelectorAll('a').forEach((a) => {
        if (a.getAttribute('href') === '#' + ch.id) a.setAttribute('aria-current', 'step');
        else a.removeAttribute('aria-current');
      });
    }
    label = ch.dataset.thermoLabel || '';
    if (agoEl) agoEl.textContent = fr(label);
    if (eonEl) eonEl.textContent = ch.dataset.title || '';
    const t = Number(ch.dataset.thermo);
    if (!Number.isFinite(t) || t === target) return;
    from = shown;
    target = t;
    tweenT = lib.reducedMotion ? 1 : 0;
    if (tweenT >= 1) shown = target;
    paintBar();
  }

  function tickBar(dt) {
    if (tweenT >= 1) return;
    tweenT = Math.min(1, tweenT + dt / 0.9);
    shown = lerp(from, target, lib.ease.outBack(tweenT));
    if (tweenT >= 1) shown = target;
    paintBar();
  }

  if ('IntersectionObserver' in window && chapters.length) {
    const io = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting);
      if (vis.length) setChapter(vis[vis.length - 1].target);
    }, { rootMargin: '-35% 0px -60% 0px', threshold: 0 });
    chapters.forEach((c) => io.observe(c));
  }
  paintBar();

  /* ---------- Sommaire ---------- */
  const menuBtn = document.querySelector('.tb-menu');
  const menu = document.getElementById('sommaire');
  const menuList = menu && menu.querySelector('ol');
  if (menu && menuList) {
    chapters.forEach((c) => {
      if (!c.dataset.title) return;
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = '#' + c.id;
      const t = document.createElement('span');
      t.className = 'toc-title';
      t.textContent = c.dataset.title;
      const w = document.createElement('span');
      w.className = 'toc-when';
      w.textContent = fr(c.dataset.when || '');
      const sw = document.createElement('span');
      sw.className = 'toc-swatch';
      sw.style.background = thermoColor(Number(c.dataset.thermo));
      a.append(sw, t, w);
      li.appendChild(a);
      menuList.appendChild(li);
    });
    const open = (v) => {
      menu.hidden = !v;
      menuBtn.setAttribute('aria-expanded', String(v));
      document.documentElement.classList.toggle('menu-open', v);
      if (v) {
        const cur = menuList.querySelector('[aria-current]') || menuList.querySelector('a');
        if (cur) cur.focus();
      } else {
        menuBtn.focus({ preventScroll: true });
      }
    };
    menuBtn.addEventListener('click', () => open(menu.hidden));
    menu.addEventListener('click', (e) => {
      if (e.target === menu || e.target.closest('.toc-close')) open(false);
      const a = e.target.closest('a');
      if (a) {
        menu.hidden = true;
        menuBtn.setAttribute('aria-expanded', 'false');
        document.documentElement.classList.remove('menu-open');
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !menu.hidden) open(false);
    });
  }

  /* ---------- Son ---------- */
  const soundBtn = document.querySelector('.tb-sound');
  function setSound(on) {
    lib.sfx.enabled = on;
    if (soundBtn) {
      soundBtn.setAttribute('aria-pressed', String(on));
      soundBtn.setAttribute('aria-label', on ? 'Couper le son' : 'Activer le son');
    }
    try { localStorage.setItem('rm-son', on ? '1' : '0'); } catch (e) { /* rien */ }
  }
  if (soundBtn) {
    let saved = false;
    try { saved = localStorage.getItem('rm-son') === '1'; } catch (e) { /* rien */ }
    setSound(false);
    if (saved) soundBtn.dataset.wanted = '1';
    soundBtn.addEventListener('click', () => {
      setSound(!lib.sfx.enabled);
      if (lib.sfx.enabled) lib.sfx.play('chime');
    });
  }

  /* ---------- Naïm et Alicia ---------- */
  const KIDS = window.RM.kids;
  const TURN = {
    naim: ['À toi, Naïm !', 'Bravo, Naïm !'],
    alicia: ['À toi, Alicia !', 'Bravo, Alicia !'],
    siham: ['À toi, Siham !', 'Bravo, Siham !'],
    both: ['À vous deux !', 'Bravo à vous deux !'],
    all: ['À vous trois !', 'Bravo à vous trois !'],
  };
  /* who : 'naim', 'alicia', 'siham', 'both' (les deux enfants), 'all' (les trois), ou une liste : 'naim siham' */
  function whoList(who) {
    if (who === 'both') return ['naim', 'alicia'];
    if (who === 'all') return ['naim', 'alicia', 'siham'];
    return String(who || '').split(/\s+/).filter(Boolean);
  }
  function turnFor(who) {
    if (TURN[who]) return TURN[who];
    return whoList(who).length >= 3 ? TURN.all : TURN.both;
  }
  function faces(who, expr) {
    if (!KIDS) return '';
    return whoList(who).map((n) => `<span class="guide-face">${KIDS.svg(n, { expr })}</span>`).join('');
  }
  function setGuide(fig, who, expr, turn) {
    const g = fig.querySelector('.guide');
    if (!g) return;
    if (who) {
      g.dataset.who = who;
      const n = whoList(who).length;
      g.classList.toggle('guide--both', n === 2);
      g.classList.toggle('guide--trio', n >= 3);
    }
    const w = g.dataset.who;
    g.querySelector('.guide-faces').innerHTML = faces(w, expr || 'smile');
    /* sans texte fourni : on garde l'actuel, sauf quand on change de joueur */
    const turnEl = g.querySelector('.guide-turn');
    if (turn) turnEl.textContent = turn;
    else if (who || !turnEl.textContent) turnEl.textContent = turnFor(w)[0];
  }
  document.querySelectorAll('.game[data-guide]').forEach((fig) => {
    const hint = fig.querySelector('.game-hint');
    if (!hint || !KIDS) return;
    const who = fig.dataset.guide;
    const g = document.createElement('div');
    g.className = 'guide';
    g.dataset.who = who;
    g.innerHTML = '<div class="guide-faces" aria-hidden="true"></div><div class="guide-body"><p class="guide-turn"></p></div>';
    hint.insertAdjacentElement('beforebegin', g);
    g.querySelector('.guide-body').appendChild(hint);
    setGuide(fig, who, 'smile');
  });
  document.querySelectorAll('[data-kids]').forEach((box) => {
    box.innerHTML = KIDS ? box.dataset.kids.split(' ').map((n) => `<span class="guide-face">${KIDS.svg(n, { expr: 'hero' })}</span>`).join('') : '';
  });

  /* ---------- Mini-jeux ---------- */
  const mounted = [];

  function makeApi(fig, name) {
    const stage = fig.querySelector('.game-stage');
    const hintEl = fig.querySelector('.game-hint');
    const statusEl = fig.querySelector('.game-status');
    const meter = fig.querySelector('.game-meter');
    const resetBtn = fig.querySelector('.game-reset');
    const defaults = {
      hint: hintEl ? fr(hintEl.textContent) : '',
      status: statusEl ? fr(statusEl.textContent) : '',
    };
    if (hintEl) hintEl.textContent = defaults.hint;
    const g = { fig, name, visible: false, loops: [], resets: [], done: false };

    const api = {
      name,
      root: fig,
      stage,
      lib,
      sfx: lib.sfx,
      buzz: lib.buzz,
      reducedMotion: lib.reducedMotion,
      canvas: (opts) => lib.makeCanvas(stage, opts),
      track: (el, handlers, opts) => lib.track(el, handlers, opts),
      loop(fn) { g.loops.push(fn); },
      onReset(fn) { g.resets.push(fn); },
      hint(t) { if (hintEl) hintEl.textContent = fr(t); },
      status(t) { if (statusEl) statusEl.textContent = t ? fr(t) : ''; },
      progress(p) {
        if (!meter) return;
        p = clamp(Number(p) || 0);
        meter.style.setProperty('--p', p.toFixed(4));
        meter.setAttribute('aria-valuenow', String(Math.round(p * 100)));
      },
      done(text, status) {
        if (g.done) return;
        g.done = true;
        fig.classList.add('is-done');
        api.progress(1);
        if (text) api.hint(text);
        api.status(status || '');
        lib.sfx.play('success', { gap: 0 });
        lib.buzz([14, 50, 14]);
        const colors = [api.css('--accent'), api.css('--fg'), api.css('--accent-2') || api.css('--accent')].filter(Boolean);
        lib.celebrate(stage, colors);
        const gd = fig.querySelector('.guide');
        if (gd) setGuide(fig, null, 'laugh', turnFor(gd.dataset.who)[1]);
      },
      isDone: () => g.done,
      guide(who, expr, turn) { setGuide(fig, who, expr, turn); },
      gesture(type, o) { return lib.showGesture(stage, type, o); },
      css(prop) { return getComputedStyle(fig).getPropertyValue(prop).trim(); },
      style(css) { lib.injectStyle(name, css); },
      get visible() { return g.visible; },
    };

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        g.done = false;
        fig.classList.remove('is-done');
        if (hintEl) hintEl.textContent = defaults.hint;
        if (statusEl) statusEl.textContent = defaults.status;
        api.progress(0);
        if (fig.dataset.guide) setGuide(fig, fig.dataset.guide, 'smile');
        g.resets.forEach((fn) => {
          try { fn(); } catch (err) { console.error(err); }
        });
        lib.sfx.play('whoosh', { volume: 0.5 });
      });
    }
    api.progress(0);
    return { g, api };
  }

  function mount(fig) {
    if (fig.dataset.mounted) return;
    fig.dataset.mounted = '1';
    const name = fig.dataset.game;
    const factory = window.RM.games[name];
    const stage = fig.querySelector('.game-stage');
    if (typeof factory !== 'function') {
      if (stage) stage.insertAdjacentHTML('beforeend', '<p class="game-error">Ce jeu n’est pas encore prêt.</p>');
      return;
    }
    const { g, api } = makeApi(fig, name);
    try {
      factory(api);
      mounted.push(g);
      fig.classList.add('is-ready');
    } catch (err) {
      console.error('Jeu « ' + name + ' » :', err);
      if (stage) stage.insertAdjacentHTML('beforeend', '<p class="game-error">Ce jeu n’a pas pu démarrer. Recharge la page pour réessayer.</p>');
    }
    /* Naïm ou Alicia s'émerveille quand on touche la scène */
    if (fig.dataset.guide && name !== 'quiz' && stage) {
      let wowTimer = 0;
      stage.addEventListener('pointerdown', () => {
        if (g.done) return;
        if (!wowTimer) setGuide(fig, null, 'wow', fig.querySelector('.guide-turn').textContent);
        clearTimeout(wowTimer);
        wowTimer = setTimeout(() => {
          wowTimer = 0;
          if (!g.done) setGuide(fig, null, 'smile', fig.querySelector('.guide-turn').textContent);
        }, 900);
      });
    }
    if (visObserver) visObserver.observe(fig);
    else g.visible = true;
  }

  let visObserver = null;
  if ('IntersectionObserver' in window) {
    visObserver = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        const g = mounted.find((m) => m.fig === e.target);
        if (g) g.visible = e.isIntersecting;
      });
    }, { rootMargin: '80px 0px', threshold: 0 });
  }

  const figs = Array.from(document.querySelectorAll('.game[data-game]'));
  if ('IntersectionObserver' in window) {
    const mountObserver = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          mount(e.target);
          mountObserver.unobserve(e.target);
        }
      });
    }, { rootMargin: '600px 0px' });
    figs.forEach((f) => mountObserver.observe(f));
  } else {
    figs.forEach(mount);
  }

  /* Une seule boucle d'animation pour toute la page */
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    tickBar(dt);
    if (!document.hidden) {
      for (let i = 0; i < mounted.length; i++) {
        const g = mounted[i];
        if (!g.visible) continue;
        for (let j = 0; j < g.loops.length; j++) {
          try { g.loops[j](dt, now / 1000); } catch (err) {
            console.error('Boucle « ' + g.name + ' » :', err);
            g.loops.splice(j, 1);
            j--;
          }
        }
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* Les boutons « Continuer » des jeux font défiler doucement vers le chapitre suivant */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    const el = id && document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: lib.reducedMotion ? 'auto' : 'smooth', block: 'start' });
    history.replaceState(null, '', '#' + id);
  });

})();
