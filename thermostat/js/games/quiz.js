/* Le quiz final : on choisit qui joue (Naïm, Alicia, Siham, seul ou à plusieurs),
   puis chacun répond à son tour. Les enfants piochent dans les questions « enfants »,
   Siham dans les questions « adultes ». Après chaque réponse, une explication ;
   à la fin, un insigne en forme de galet pour chaque joueur.
   Les questions et les insignes du thème sont dans js/quiz-data.js (window.RM.quizData). */
(function () {
  'use strict';
  const { lib } = window.RM;

  const PLAYERS = ['naim', 'alicia', 'siham'];
  const ADULTS = { siham: true };
  /* nombre de questions par joueur selon le nombre de joueurs */
  const PER_PLAYER = { 1: 10, 2: 5, 3: 4 };
  const NUM = ['zéro', 'une', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze'];

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* m questions tirées au hasard, en gardant l'ordre des chapitres */
  function pick(list, m) {
    if (m >= list.length) return list.slice();
    const idx = shuffle(list.map((_, i) => i)).slice(0, m).sort((a, b) => a - b);
    return idx.map((i) => list[i]);
  }

  window.RM.games.quiz = function (api) {
    const stage = api.stage;
    const DATA = window.RM.quizData || {};
    const KID_Q = DATA.enfants || [];
    const ADULT_Q = DATA.adultes && DATA.adultes.length ? DATA.adultes : KID_Q;
    const BADGES = DATA.insignes || [{ min: 0, name: 'Bravo', text: '' }];
    const KIDS = window.RM.kids;
    const NAME = (k) => (KIDS ? KIDS.name(k) : k);
    const face = (k, expr) => (KIDS ? KIDS.svg(k, { expr: expr || 'smile' }) : '');

    api.style(`
      .game[data-game="quiz"] .game-stage { padding: clamp(18px, 4vw, 32px); border-radius: 22px 28px 24px 20px; }
      .game[data-game="quiz"] .qz-top { display: flex; align-items: center; gap: 10px; margin: 0 0 0.6rem; }
      .game[data-game="quiz"] .qz-top .qz-face { width: 44px; flex: none; }
      .game[data-game="quiz"] .qz-count { margin: 0; color: var(--muted); font-size: var(--step--1); font-variant-numeric: tabular-nums; }
      .game[data-game="quiz"] .qz-player { margin: 0; font-weight: 700; font-size: 1rem; color: var(--accent-ink); }
      .game[data-game="quiz"] .qz-tag {
        display: inline-block; margin-left: 6px; padding: 2px 9px 3px; border-radius: 999px; vertical-align: 1px;
        background: var(--accent); color: var(--btn-fg); font-size: 0.75rem; font-weight: 700; letter-spacing: 0.01em;
      }
      .game[data-game="quiz"] .qz-q {
        margin: 0 0 1.1rem; font-family: var(--font-display); font-weight: 750;
        font-variation-settings: "SOFT" 100, "opsz" 48; font-size: var(--step-2); line-height: 1.12; text-wrap: balance;
      }
      .game[data-game="quiz"] .qz-q.is-adult { font-size: var(--step-1); line-height: 1.18; }
      .game[data-game="quiz"] .qz-sub { margin: -0.5rem 0 1rem; color: var(--muted); }
      .game[data-game="quiz"] .qz-answers { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none; }
      .game[data-game="quiz"] .qz-a {
        width: 100%; min-height: 54px; padding: 12px 16px 12px 48px; position: relative; text-align: left;
        border: 0; border-radius: 16px 20px 17px 19px; background: rgba(255,255,255,0.08); color: var(--fg);
        box-shadow: inset 0 0 0 1.5px var(--line); font: 600 1.0625rem/1.35 var(--font-text); cursor: pointer;
        touch-action: manipulation; transition: background .25s, box-shadow .25s, opacity .25s, transform .12s;
      }
      .game[data-game="quiz"] .qz-a::before {
        content: ""; position: absolute; left: 16px; top: 50%; width: 18px; height: 18px; margin-top: -9px;
        border-radius: 50%; box-shadow: inset 0 0 0 2px var(--muted);
      }
      .game[data-game="quiz"] .qz-a:not([disabled]):hover { background: rgba(255,255,255,0.13); }
      .game[data-game="quiz"] .qz-a:not([disabled]):active { transform: scale(0.985); }
      .game[data-game="quiz"] .qz-a[disabled] { cursor: default; opacity: 0.55; }
      .game[data-game="quiz"] .qz-a.is-right { opacity: 1; background: rgba(139,216,106,0.2); box-shadow: inset 0 0 0 2px var(--accent); }
      .game[data-game="quiz"] .qz-a.is-right::before { background: var(--accent); box-shadow: none; }
      .game[data-game="quiz"] .qz-a.is-wrong { opacity: 1; background: rgba(255,120,120,0.16); box-shadow: inset 0 0 0 2px #FF9B9B; }
      .game[data-game="quiz"] .qz-a.is-wrong::before { background: #FF9B9B; box-shadow: none; }
      .game[data-game="quiz"] .qz-feedback { margin: 1rem 0 0; min-height: 1.5em; }
      .game[data-game="quiz"] .qz-feedback strong { color: var(--accent-ink); }
      .game[data-game="quiz"] .qz-feedback.is-wrong strong { color: #FFB3B3; }
      .game[data-game="quiz"] .qz-next { margin-top: 1rem; background: var(--accent); color: var(--btn-fg); }
      .game[data-game="quiz"] .qz-next[disabled] { opacity: 0.4; cursor: default; }

      .game[data-game="quiz"] .qz-who { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
      .game[data-game="quiz"] .qz-pick {
        position: relative; display: grid; justify-items: center; align-content: start; gap: 6px;
        width: 100%; min-width: 0; padding: 16px 6px 12px; border: 0; border-radius: 22px 26px 23px 25px;
        background: rgba(255,255,255,0.06); color: var(--fg); box-shadow: inset 0 0 0 1.5px var(--line);
        font: 700 1.05rem/1.15 var(--font-text); text-align: center; cursor: pointer; touch-action: manipulation;
        transition: background .2s, box-shadow .2s, transform .12s;
      }
      .game[data-game="quiz"] .qz-pick:hover { background: rgba(255,255,255,0.11); }
      .game[data-game="quiz"] .qz-pick:active { transform: scale(0.97); }
      .game[data-game="quiz"] .qz-pick .qz-face {
        display: block; width: min(78px, 82%); margin-bottom: 4px;
        filter: saturate(0.55) brightness(0.85); transition: transform .3s cubic-bezier(.2,1.5,.4,1), filter .25s;
      }
      .game[data-game="quiz"] .qz-pick small { display: block; font-weight: 400; font-size: 0.8rem; line-height: 1.2; color: var(--muted); }
      .game[data-game="quiz"] .qz-pick[aria-pressed="true"] { background: rgba(255,255,255,0.14); box-shadow: inset 0 0 0 2.5px var(--accent); }
      .game[data-game="quiz"] .qz-pick[aria-pressed="true"] .qz-face { filter: none; transform: scale(1.07) rotate(-3deg); }
      .game[data-game="quiz"] .qz-check {
        position: absolute; top: 8px; right: 8px; width: 24px; height: 24px; border-radius: 50%;
        box-shadow: inset 0 0 0 2px var(--line); transition: background .2s;
      }
      .game[data-game="quiz"] .qz-pick[aria-pressed="true"] .qz-check { background: var(--accent); box-shadow: none; }
      .game[data-game="quiz"] .qz-pick[aria-pressed="true"] .qz-check::after {
        content: ""; position: absolute; left: 8.5px; top: 4.5px; width: 6px; height: 11px;
        border: solid var(--btn-fg); border-width: 0 2.5px 2.5px 0; transform: rotate(45deg);
      }
      .game[data-game="quiz"] .qz-info { margin: 1rem 0 0; min-height: 1.4em; font-weight: 600; text-wrap: balance; }

      .game[data-game="quiz"] .qz-end { display: grid; gap: 1.2rem; text-align: center; padding-block: 0.3rem; }
      .game[data-game="quiz"] .qz-results { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(118px, 1fr)); }
      .game[data-game="quiz"] .qz-results.is-trio { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.6rem; }
      .game[data-game="quiz"] .qz-res { display: grid; gap: 0.6rem; justify-items: center; align-content: start; min-width: 0; }
      .game[data-game="quiz"] .qz-res .qz-face { width: 64px; margin-bottom: -22px; position: relative; z-index: 1; }
      .game[data-game="quiz"] .is-trio .qz-res .qz-face { width: 50px; margin-bottom: -18px; }
      .game[data-game="quiz"] .qz-badge {
        width: min(190px, 100%); aspect-ratio: 1.18; border-radius: 48% 52% 44% 56% / 55% 45% 55% 45%;
        background: linear-gradient(180deg, #A9E4E7 0 12%, #FF7C8F 12% 55%, #FF6FAE 55% 88%, #E05AB5 88% 100%);
        box-shadow: inset 0 -14px 24px rgba(0,0,0,0.25), inset 0 10px 18px rgba(255,255,255,0.35), 0 16px 30px -12px rgba(0,0,0,0.6);
        display: grid; place-items: center; transform: rotate(-4deg);
        animation: qz-pop .7s cubic-bezier(.2,1.4,.4,1) both;
      }
      .game[data-game="quiz"] .qz-badge.is-adult { background: linear-gradient(180deg, #FFE6A8 0 12%, #F7B267 12% 55%, #F4845F 55% 88%, #E0566B 88% 100%); }
      .game[data-game="quiz"] .qz-score {
        font-family: var(--font-display); font-weight: 900; font-variation-settings: "SOFT" 100, "opsz" 144;
        font-size: clamp(2.4rem, 10vw, 3.2rem); line-height: 1; color: #1B1230; transform: rotate(4deg);
      }
      .game[data-game="quiz"] .is-trio .qz-score { font-size: clamp(1.5rem, 6.5vw, 2.3rem); }
      .game[data-game="quiz"] .qz-score small { font-size: 0.45em; font-weight: 700; }
      .game[data-game="quiz"] .qz-title {
        margin: 0; font-family: var(--font-display); font-weight: 800; font-variation-settings: "SOFT" 100, "opsz" 72;
        font-size: 1.2rem; line-height: 1.15; overflow-wrap: anywhere;
      }
      .game[data-game="quiz"] .is-trio .qz-title { font-size: 0.95rem; }
      .game[data-game="quiz"] .qz-title span { display: block; font-size: 0.82em; font-weight: 700; color: var(--accent-ink); }
      .game[data-game="quiz"] .qz-text { margin: 0; max-width: 28rem; justify-self: center; }
      .game[data-game="quiz"] .qz-team { margin: 0; font-weight: 700; }
      @keyframes qz-pop { from { transform: rotate(-4deg) scale(0.4); opacity: 0; } to { transform: rotate(-4deg) scale(1); opacity: 1; } }
      @media (prefers-reduced-motion: reduce) {
        .game[data-game="quiz"] .qz-badge { animation: none; }
        .game[data-game="quiz"] .qz-pick .qz-face { transition: none; }
      }
    `);

    let players = [];   /* ex. ['naim'], ['naim', 'siham'] ou ['naim', 'alicia', 'siham'] */
    let order = [];     /* [{ k, item }] : à qui est la question, et laquelle */
    let idx = 0;
    let score = {};
    let asked = {};
    let chosen = new Set();

    function el(tag, cls, text) {
      const e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text != null) e.textContent = lib.fr(text);
      return e;
    }
    const together = (n) => (n >= 3 ? 'À vous trois' : 'À vous deux');

    function describe(sel) {
      const n = sel.length;
      if (!n) return 'Touchez au moins une photo.';
      const per = PER_PLAYER[n];
      if (n === 1) {
        const k = sel[0];
        return ADULTS[k]
          ? `${NUM[per][0].toUpperCase()}${NUM[per].slice(1)} questions de grands rien que pour toi, ${NAME(k)}.`
          : `${NUM[per][0].toUpperCase()}${NUM[per].slice(1)} questions rien que pour toi, ${NAME(k)}.`;
      }
      return `Chacun son tour : ${NUM[per]} questions chacun, ${NUM[per * n]} en tout.`;
    }

    function renderStart() {
      stage.textContent = '';
      chosen = new Set();
      stage.appendChild(el('h3', 'qz-q', 'Qui joue ?'));
      stage.appendChild(el('p', 'qz-sub', 'Touchez la photo de chaque joueur, puis lancez la partie.'));
      const box = el('div', 'qz-who');
      const info = el('p', 'qz-info', describe([]));
      info.setAttribute('aria-live', 'polite');
      const go = el('button', 'chip qz-next', 'C’est parti !');
      go.type = 'button';
      go.disabled = true;
      const refresh = () => {
        const sel = PLAYERS.filter((k) => chosen.has(k));
        info.textContent = lib.fr(describe(sel));
        go.disabled = !sel.length;
        if (sel.length) api.guide(sel.join(' '), 'smile', sel.length > 1 ? `${together(sel.length)} !` : `À toi, ${NAME(sel[0])} !`);
        else api.guide('all', 'smile', 'Qui joue ?');
      };
      PLAYERS.forEach((k) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'qz-pick';
        b.dataset.player = k;
        b.setAttribute('aria-pressed', 'false');
        b.innerHTML = `<span class="qz-check" aria-hidden="true"></span><span class="qz-face" aria-hidden="true">${face(k)}</span>`;
        const t = el('span', '', NAME(k));
        t.appendChild(el('small', '', ADULTS[k] ? 'Questions de grands' : 'Questions d’enfants'));
        b.appendChild(t);
        b.addEventListener('click', () => {
          const on = !chosen.has(k);
          if (on) chosen.add(k); else chosen.delete(k);
          b.setAttribute('aria-pressed', String(on));
          b.querySelector('.qz-face').innerHTML = face(k, on ? 'laugh' : 'smile');
          api.sfx.play('pop', { pitch: on ? 1.15 : 0.85 });
          api.buzz(8);
          refresh();
        });
        box.appendChild(b);
      });
      go.addEventListener('click', () => {
        const sel = PLAYERS.filter((k) => chosen.has(k));
        if (sel.length) start(sel);
      });
      stage.append(box, info, go);
      api.guide('all', 'smile', 'Qui joue ?');
      api.hint('Choisissez qui joue.');
    }

    function start(p) {
      players = p;
      const n = players.length;
      const total = PER_PLAYER[n] * n;
      const turns = Array.from({ length: total }, (_, t) => players[t % n]);
      const kids = pick(KID_Q, turns.filter((k) => !ADULTS[k]).length);
      const adults = pick(ADULT_Q, turns.filter((k) => ADULTS[k]).length);
      order = turns.map((k) => ({ k, item: ADULTS[k] ? adults.shift() : kids.shift() })).filter((o) => o.item);
      idx = 0;
      score = {};
      asked = {};
      players.forEach((k) => { score[k] = 0; asked[k] = 0; });
      api.sfx.play('chime');
      api.status(statusLine());
      renderQuestion();
      scrollIntoViewIfNeeded();
    }

    function renderQuestion() {
      const { k, item } = order[idx];
      stage.textContent = '';
      const top = el('div', 'qz-top');
      top.insertAdjacentHTML('beforeend', `<span class="qz-face" aria-hidden="true">${face(k)}</span>`);
      const meta = el('div', '');
      const who = el('p', 'qz-player', players.length > 1 ? `À toi, ${NAME(k)} !` : NAME(k));
      if (ADULTS[k]) who.appendChild(el('span', 'qz-tag', 'pour les grands'));
      meta.appendChild(who);
      meta.appendChild(el('p', 'qz-count', `Question ${idx + 1} sur ${order.length}`));
      top.appendChild(meta);
      stage.appendChild(top);
      const q = el('h3', 'qz-q' + (ADULTS[k] ? ' is-adult' : ''), item.q);
      q.tabIndex = -1;
      stage.appendChild(q);
      const list = el('ul', 'qz-answers');
      const answers = shuffle(item.a.map((text, i) => ({ text, right: i === 0 })));
      const buttons = answers.map((ans) => {
        const li = document.createElement('li');
        const b = el('button', 'qz-a', ans.text);
        b.type = 'button';
        b.addEventListener('click', () => choose(ans, b, buttons, answers));
        li.appendChild(b);
        list.appendChild(li);
        return b;
      });
      stage.appendChild(list);
      const fb = el('p', 'qz-feedback');
      fb.setAttribute('aria-live', 'polite');
      stage.appendChild(fb);
      api.guide(k, 'smile', `À toi, ${NAME(k)} !`);
      api.hint('Touche la bonne réponse.');
    }

    function statusLine() {
      return players.map((k) => `${NAME(k)} : ${score[k]} sur ${asked[k]}`).join('. ');
    }

    function choose(ans, button, buttons, answers) {
      const { k, item } = order[idx];
      buttons.forEach((b, i) => {
        b.disabled = true;
        if (answers[i].right) b.classList.add('is-right');
      });
      const fb = stage.querySelector('.qz-feedback');
      asked[k]++;
      fb.innerHTML = '';
      if (ans.right) {
        score[k]++;
        fb.append(el('strong', '', 'Bonne réponse ! '), document.createTextNode(lib.fr(item.why)));
        api.sfx.play('chime');
        api.buzz(10);
        api.guide(k, 'laugh', `Bien joué, ${NAME(k)} !`);
      } else {
        button.classList.add('is-wrong');
        fb.classList.add('is-wrong');
        fb.append(el('strong', '', 'Raté. '), document.createTextNode(lib.fr(item.why)));
        api.sfx.play('fail');
        api.buzz([8, 40, 8]);
        api.guide(k, 'wow', `Pas grave, ${NAME(k)} !`);
      }
      api.progress((idx + 1) / order.length);
      api.status(statusLine());
      const last = idx + 1 >= order.length;
      const nextName = !last && players.length > 1 ? NAME(order[idx + 1].k) : '';
      const next = el('button', 'chip qz-next', last ? 'Voir le résultat' : (nextName ? `Au tour de ${nextName}` : 'Question suivante'));
      next.type = 'button';
      next.addEventListener('click', () => {
        idx++;
        if (idx < order.length) {
          renderQuestion();
          const q = stage.querySelector('.qz-q');
          if (q) q.focus({ preventScroll: true });
          scrollIntoViewIfNeeded();
        } else {
          renderEnd();
        }
      });
      stage.appendChild(next);
      next.focus({ preventScroll: true });
    }

    function scrollIntoViewIfNeeded() {
      const r = api.root.getBoundingClientRect();
      if (r.top < 60) api.root.scrollIntoView({ behavior: api.reducedMotion ? 'auto' : 'smooth', block: 'start' });
    }

    function renderEnd() {
      stage.textContent = '';
      const n = players.length;
      const box = el('div', 'qz-end');
      const res = el('div', 'qz-results' + (n >= 3 ? ' is-trio' : ''));
      players.forEach((k) => {
        const ratio = asked[k] ? score[k] / asked[k] : 0;
        const badge = BADGES.find((b) => ratio >= b.min) || BADGES[BADGES.length - 1];
        const card = el('div', 'qz-res');
        card.insertAdjacentHTML('beforeend', `<span class="qz-face" aria-hidden="true">${face(k, ratio >= 0.6 ? 'laugh' : 'smile')}</span>`);
        const pebble = el('div', 'qz-badge' + (ADULTS[k] ? ' is-adult' : ''));
        const sc = el('div', 'qz-score');
        sc.innerHTML = `${score[k]}<small>/${asked[k]}</small>`;
        pebble.appendChild(sc);
        card.appendChild(pebble);
        const title = el('p', 'qz-title', NAME(k));
        title.appendChild(el('span', '', badge.name));
        card.appendChild(title);
        if (n === 1 && badge.text) card.appendChild(el('p', 'qz-text', badge.text));
        res.appendChild(card);
      });
      box.appendChild(res);
      const total = players.reduce((t, k) => t + score[k], 0);
      if (n > 1) box.appendChild(el('p', 'qz-team', `${together(n)} : ${total} bonne${total > 1 ? 's' : ''} réponse${total > 1 ? 's' : ''} sur ${order.length}.`));
      stage.appendChild(box);
      api.status('');
      api.done(`${total} bonne${total > 1 ? 's' : ''} réponse${total > 1 ? 's' : ''} sur ${order.length}.`, 'Pour rejouer, touche Recommencer.');
      if (n > 1) api.guide(players.join(' '), 'laugh', `Bravo ${n >= 3 ? 'à vous trois' : 'à vous deux'} !`);
      else api.guide(players[0], 'laugh', `Bravo, ${NAME(players[0])} !`);
      scrollIntoViewIfNeeded();
    }

    api.onReset(renderStart);
    renderStart();
  };
})();
