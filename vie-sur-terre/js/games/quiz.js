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

  const BADGES = [
    { min: 10, name: 'Roche mère', text: 'Un sans-faute. Tu connais toute l’histoire, de la poussière d’étoiles au béton.' },
    { min: 8, name: 'Falaise de craie', text: 'Solide, construite couche après couche. Presque parfait !' },
    { min: 6, name: 'Lichen pionnier', text: 'Tu t’accroches bien. Encore un petit effort pour devenir une falaise.' },
    { min: 4, name: 'Cyanobactérie', text: 'Tu commences à changer l’atmosphère. Rejoue pour faire mieux !' },
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
    api.style(`
      .game[data-game="quiz"] .game-stage { padding: clamp(18px, 4vw, 32px); border-radius: 22px 28px 24px 20px; }
      .game[data-game="quiz"] .qz-count { margin: 0 0 0.5rem; color: var(--muted); font-size: var(--step--1); font-variant-numeric: tabular-nums; }
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
      .game[data-game="quiz"] .qz-end { display: grid; gap: 1rem; justify-items: center; text-align: center; padding-block: 0.5rem; }
      .game[data-game="quiz"] .qz-badge {
        width: min(230px, 62%); aspect-ratio: 1.18; border-radius: 48% 52% 44% 56% / 55% 45% 55% 45%;
        background: linear-gradient(180deg, #A9E4E7 0 12%, #FF7C8F 12% 55%, #FF6FAE 55% 88%, #E05AB5 88% 100%);
        box-shadow: inset 0 -14px 24px rgba(0,0,0,0.25), inset 0 10px 18px rgba(255,255,255,0.35), 0 16px 30px -12px rgba(0,0,0,0.6);
        display: grid; place-items: center; transform: rotate(-4deg);
        animation: qz-pop .7s cubic-bezier(.2,1.4,.4,1) both;
      }
      .game[data-game="quiz"] .qz-score {
        font-family: var(--font-display); font-weight: 900; font-variation-settings: "SOFT" 100, "opsz" 144;
        font-size: clamp(2.6rem, 11vw, 3.6rem); line-height: 1; color: #1B1230; transform: rotate(4deg);
      }
      .game[data-game="quiz"] .qz-score small { font-size: 0.45em; font-weight: 700; }
      .game[data-game="quiz"] .qz-title {
        margin: 0; font-family: var(--font-display); font-weight: 800; font-variation-settings: "SOFT" 100, "opsz" 72;
        font-size: var(--step-2); line-height: 1.1;
      }
      .game[data-game="quiz"] .qz-text { margin: 0; max-width: 28rem; }
      @keyframes qz-pop { from { transform: rotate(-4deg) scale(0.4); opacity: 0; } to { transform: rotate(-4deg) scale(1); opacity: 1; } }
    `);

    let order = [];
    let idx = 0;
    let score = 0;

    function el(tag, cls, text) {
      const e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text != null) e.textContent = lib.fr(text);
      return e;
    }

    function renderQuestion() {
      const item = order[idx];
      stage.textContent = '';
      stage.appendChild(el('p', 'qz-count', `Question ${idx + 1} sur ${order.length}`));
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
    }

    function choose(ans, button, buttons, answers) {
      buttons.forEach((b, i) => {
        b.disabled = true;
        if (answers[i].right) b.classList.add('is-right');
      });
      const fb = stage.querySelector('.qz-feedback');
      const item = order[idx];
      if (ans.right) {
        score++;
        fb.innerHTML = '';
        fb.append(el('strong', '', 'Bonne réponse ! '), document.createTextNode(lib.fr(item.why)));
        api.sfx.play('chime');
        api.buzz(10);
      } else {
        button.classList.add('is-wrong');
        fb.classList.add('is-wrong');
        fb.innerHTML = '';
        fb.append(el('strong', '', 'Raté. '), document.createTextNode(lib.fr(item.why)));
        api.sfx.play('fail');
        api.buzz([8, 40, 8]);
      }
      api.progress((idx + 1) / order.length);
      api.status(`Score : ${score} sur ${idx + 1}`);
      const next = el('button', 'chip qz-next', idx + 1 < order.length ? 'Question suivante' : 'Voir mon résultat');
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
      const badge = BADGES.find((b) => score >= b.min);
      stage.textContent = '';
      const box = el('div', 'qz-end');
      const pebble = el('div', 'qz-badge');
      const sc = el('div', 'qz-score');
      sc.innerHTML = `${score}<small>/${order.length}</small>`;
      pebble.appendChild(sc);
      box.appendChild(pebble);
      box.appendChild(el('p', 'qz-title', `Tu es : ${badge.name}`));
      box.appendChild(el('p', 'qz-text', badge.text));
      stage.appendChild(box);
      api.status('');
      api.done(`${score} bonne${score > 1 ? 's' : ''} réponse${score > 1 ? 's' : ''} sur ${order.length}.`, 'Pour rejouer, touche Recommencer.');
      scrollIntoViewIfNeeded();
    }

    function start() {
      order = QUESTIONS.slice();
      idx = 0;
      score = 0;
      renderQuestion();
    }

    api.onReset(start);
    start();
  };
})();
