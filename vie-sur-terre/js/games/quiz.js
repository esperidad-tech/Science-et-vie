/* Le quiz final : dix questions, une explication après chaque réponse,
   et un insigne en forme de galet strié aux couleurs des éons. */
(function () {
  'use strict';
  const { lib } = window.RM;

  const QUESTIONS = [
    {
      q: 'De quoi la Terre est-elle née ?',
      a: ['D’un nuage de poussières et de roches', 'D’un morceau arraché au Soleil', 'D’une énorme comète glacée'],
      why: 'Les poussières se sont agglutinées jusqu’à former une boule de roche brûlante.',
    },
    {
      q: 'Comment la Lune s’est-elle formée, selon le scénario le plus admis ?',
      a: ['Après un choc géant entre la Terre et une autre planète', 'Elle a été capturée en passant près de la Terre', 'Elle s’est détachée du Soleil'],
      why: 'Les débris du choc avec Théia se sont rassemblés en orbite.',
    },
    {
      q: 'Quels ingrédients étaient réunis quand la vie est apparue ?',
      a: ['De la chaleur, de l’eau liquide et des minéraux', 'De la glace, du sel et du vent', 'Du sable, de l’oxygène et de la lumière'],
      why: 'Il n’y avait presque pas d’oxygène à l’époque. Comment ces ingrédients ont donné la vie reste une énigme.',
    },
    {
      q: 'Qui a rempli l’air d’oxygène ?',
      a: ['Des microbes : les cyanobactéries', 'Les volcans', 'Les premières forêts'],
      why: 'Bien avant les plantes, ces microbes faisaient déjà de la photosynthèse.',
    },
    {
      q: 'Au début, où est passé cet oxygène ?',
      a: ['Il a fait rouiller le fer dissous dans l’océan', 'Il s’est échappé dans l’espace', 'Il a gelé au fond des mers'],
      why: 'La rouille s’est déposée en couches rouges : les formations de fer rubané.',
    },
    {
      q: 'Grâce à quoi des milliers de minéraux nouveaux sont-ils apparus ?',
      a: ['À l’oxygène produit par la vie', 'Au froid des glaciations', 'Aux météorites tombées sur Terre'],
      why: 'L’oxygène a transformé les roches et fait naître malachite, azurite, turquoise et bien d’autres.',
    },
    {
      q: 'De quoi est faite la craie des falaises d’Étretat ?',
      a: ['De minuscules plaques de plancton', 'De coquilles d’huîtres broyées', 'De lave refroidie'],
      why: 'Deux centimètres tous les mille ans, pendant 20 millions d’années.',
    },
    {
      q: 'Que font les lichens sur une roche nue ?',
      a: ['Ils la rongent et préparent un sol', 'Ils la font fondre', 'Ils la transforment en sable de plage'],
      why: 'Leurs acides attaquent les minéraux : c’est le début d’un sol où d’autres plantes pourront pousser.',
    },
    {
      q: 'D’où vient la couleur de l’ocre rouge des peintures préhistoriques ?',
      a: ['D’un oxyde de fer, l’hématite', 'Du sang des animaux chassés', 'De pétales de fleurs écrasés'],
      why: 'C’est une sorte de rouille, rendue possible par l’oxygène.',
    },
    {
      q: 'Si l’histoire de la Terre tenait en 24 heures, quand arriverait notre espèce ?',
      a: ['Quelques secondes avant minuit', 'Vers midi', 'Vers 20 heures'],
      why: 'Homo sapiens arriverait à 23 h 59 min 54 s.',
    },
  ];

  /* Insignes selon la part de bonnes réponses */
  const BADGES = [
    { min: 1, name: 'Roche mère', text: 'Un sans-faute. Toute l’histoire, de la poussière d’étoiles au béton.' },
    { min: 0.8, name: 'Falaise de craie', text: 'Solide, construite couche après couche. Presque parfait !' },
    { min: 0.6, name: 'Lichen pionnier', text: 'Bien accroché ! Encore un petit effort pour devenir une falaise.' },
    { min: 0.4, name: 'Cyanobactérie', text: 'Tu commences à changer l’atmosphère. Rejoue pour faire mieux !' },
    { min: 0, name: 'Grain de poussière', text: 'Tout commence par là. Relis les chapitres et retente ta chance.' },
  ];

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  window.RM.games.quiz = function (api) {
    const stage = api.stage;
    const KIDS = window.RM.kids;
    const NAME = (k) => (KIDS ? KIDS.name(k) : k);
    const face = (k, expr) => (KIDS ? KIDS.svg(k, { expr: expr || 'smile' }) : '');

    api.style(`
      .game[data-game="quiz"] .game-stage { padding: clamp(18px, 4vw, 32px); border-radius: 22px 28px 24px 20px; }
      .game[data-game="quiz"] .qz-top { display: flex; align-items: center; gap: 10px; margin: 0 0 0.6rem; }
      .game[data-game="quiz"] .qz-top .qz-face { width: 40px; flex: none; }
      .game[data-game="quiz"] .qz-count { margin: 0; color: var(--muted); font-size: var(--step--1); font-variant-numeric: tabular-nums; }
      .game[data-game="quiz"] .qz-player { margin: 0; font-weight: 700; font-size: 1rem; color: var(--accent-ink); }
      .game[data-game="quiz"] .qz-q {
        margin: 0 0 1.1rem; font-family: var(--font-display); font-weight: 750;
        font-variation-settings: "SOFT" 100, "opsz" 48; font-size: var(--step-2); line-height: 1.12; text-wrap: balance;
      }
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
      .game[data-game="quiz"] .qz-who { display: grid; gap: 12px; }
      .game[data-game="quiz"] .qz-pick {
        display: flex; align-items: center; gap: 14px; width: 100%; min-height: 76px; padding: 10px 16px 10px 10px;
        border: 0; border-radius: 22px 26px 23px 25px; background: rgba(255,255,255,0.08); color: var(--fg);
        box-shadow: inset 0 0 0 1.5px var(--line); font: 700 1.15rem/1.2 var(--font-text); text-align: left; cursor: pointer;
        touch-action: manipulation;
      }
      .game[data-game="quiz"] .qz-pick:hover { background: rgba(255,255,255,0.13); }
      .game[data-game="quiz"] .qz-pick:active { transform: scale(0.985); }
      .game[data-game="quiz"] .qz-pick .qz-faces { display: flex; flex: none; }
      .game[data-game="quiz"] .qz-pick .qz-face { width: 58px; }
      .game[data-game="quiz"] .qz-pick .qz-face + .qz-face { margin-left: -18px; }
      .game[data-game="quiz"] .qz-pick small { display: block; font-weight: 400; font-size: 0.9rem; color: var(--muted); margin-top: 2px; }
      .game[data-game="quiz"] .qz-end { display: grid; gap: 1.2rem; text-align: center; padding-block: 0.3rem; }
      .game[data-game="quiz"] .qz-results { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(118px, 1fr)); }
      .game[data-game="quiz"] .qz-res { display: grid; gap: 0.6rem; justify-items: center; }
      .game[data-game="quiz"] .qz-res .qz-face { width: 64px; margin-bottom: -22px; position: relative; z-index: 1; }
      .game[data-game="quiz"] .qz-badge {
        width: min(190px, 100%); aspect-ratio: 1.18; border-radius: 48% 52% 44% 56% / 55% 45% 55% 45%;
        background: linear-gradient(180deg, #A9E4E7 0 12%, #FF7C8F 12% 55%, #FF6FAE 55% 88%, #E05AB5 88% 100%);
        box-shadow: inset 0 -14px 24px rgba(0,0,0,0.25), inset 0 10px 18px rgba(255,255,255,0.35), 0 16px 30px -12px rgba(0,0,0,0.6);
        display: grid; place-items: center; transform: rotate(-4deg);
        animation: qz-pop .7s cubic-bezier(.2,1.4,.4,1) both;
      }
      .game[data-game="quiz"] .qz-score {
        font-family: var(--font-display); font-weight: 900; font-variation-settings: "SOFT" 100, "opsz" 144;
        font-size: clamp(2.4rem, 10vw, 3.2rem); line-height: 1; color: #1B1230; transform: rotate(4deg);
      }
      .game[data-game="quiz"] .qz-score small { font-size: 0.45em; font-weight: 700; }
      .game[data-game="quiz"] .qz-title {
        margin: 0; font-family: var(--font-display); font-weight: 800; font-variation-settings: "SOFT" 100, "opsz" 72;
        font-size: 1.2rem; line-height: 1.15;
      }
      .game[data-game="quiz"] .qz-text { margin: 0; max-width: 28rem; justify-self: center; }
      .game[data-game="quiz"] .qz-team { margin: 0; font-weight: 700; }
      @keyframes qz-pop { from { transform: rotate(-4deg) scale(0.4); opacity: 0; } to { transform: rotate(-4deg) scale(1); opacity: 1; } }
    `);

    let players = [];   /* ['naim'], ['alicia'] ou ['naim', 'alicia'] */
    let order = [];
    let idx = 0;
    let score = {};
    let asked = {};

    function el(tag, cls, text) {
      const e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text != null) e.textContent = lib.fr(text);
      return e;
    }
    const who = () => players[idx % players.length];

    function renderStart() {
      stage.textContent = '';
      stage.appendChild(el('h3', 'qz-q', 'Qui joue ?'));
      const box = el('div', 'qz-who');
      const opts = [
        { p: ['naim'], label: NAME('naim'), sub: 'Dix questions rien que pour toi.' },
        { p: ['alicia'], label: NAME('alicia'), sub: 'Dix questions rien que pour toi.' },
        { p: ['naim', 'alicia'], label: 'Les deux', sub: 'Chacun son tour, cinq questions chacun.' },
      ];
      opts.forEach((o) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'qz-pick';
        b.innerHTML = `<span class="qz-faces" aria-hidden="true">${o.p.map((k) => `<span class="qz-face">${face(k)}</span>`).join('')}</span>`;
        const t = el('span', '', o.label);
        t.appendChild(el('small', '', o.sub));
        b.appendChild(t);
        b.addEventListener('click', () => start(o.p));
        box.appendChild(b);
      });
      stage.appendChild(box);
      api.guide('both', 'smile', 'À vous deux !');
      api.hint('Choisissez qui joue.');
    }

    function start(p) {
      players = p;
      order = QUESTIONS.slice();
      idx = 0;
      score = {};
      asked = {};
      players.forEach((k) => { score[k] = 0; asked[k] = 0; });
      api.sfx.play('chime');
      renderQuestion();
    }

    function renderQuestion() {
      const item = order[idx];
      const k = who();
      stage.textContent = '';
      const top = el('div', 'qz-top');
      top.insertAdjacentHTML('beforeend', `<span class="qz-face" aria-hidden="true">${face(k)}</span>`);
      const meta = el('div', '');
      meta.appendChild(el('p', 'qz-player', players.length > 1 ? `À toi, ${NAME(k)} !` : NAME(k)));
      meta.appendChild(el('p', 'qz-count', `Question ${idx + 1} sur ${order.length}`));
      top.appendChild(meta);
      stage.appendChild(top);
      const q = el('h3', 'qz-q', item.q);
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
      const k = who();
      buttons.forEach((b, i) => {
        b.disabled = true;
        if (answers[i].right) b.classList.add('is-right');
      });
      const fb = stage.querySelector('.qz-feedback');
      const item = order[idx];
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
      const nextName = !last && players.length > 1 ? NAME(players[(idx + 1) % players.length]) : '';
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
      const box = el('div', 'qz-end');
      const res = el('div', 'qz-results');
      players.forEach((k) => {
        const ratio = asked[k] ? score[k] / asked[k] : 0;
        const badge = BADGES.find((b) => ratio >= b.min);
        const card = el('div', 'qz-res');
        card.insertAdjacentHTML('beforeend', `<span class="qz-face" aria-hidden="true">${face(k, ratio >= 0.6 ? 'laugh' : 'smile')}</span>`);
        const pebble = el('div', 'qz-badge');
        const sc = el('div', 'qz-score');
        sc.innerHTML = `${score[k]}<small>/${asked[k]}</small>`;
        pebble.appendChild(sc);
        card.appendChild(pebble);
        card.appendChild(el('p', 'qz-title', `${NAME(k)} : ${badge.name}`));
        if (players.length === 1) card.appendChild(el('p', 'qz-text', badge.text));
        res.appendChild(card);
      });
      box.appendChild(res);
      const total = players.reduce((t, k) => t + score[k], 0);
      if (players.length > 1) box.appendChild(el('p', 'qz-team', `À vous deux : ${total} bonnes réponses sur ${order.length}.`));
      stage.appendChild(box);
      api.status('');
      const who1 = players.length > 1 ? 'both' : players[0];
      api.done(`${total} bonne${total > 1 ? 's' : ''} réponse${total > 1 ? 's' : ''} sur ${order.length}.`, 'Pour rejouer, touche Recommencer.');
      api.guide(who1, 'laugh', who1 === 'both' ? 'Bravo à vous deux !' : `Bravo, ${NAME(who1)} !`);
      scrollIntoViewIfNeeded();
    }

    api.onReset(renderStart);
    renderStart();
  };
})();
