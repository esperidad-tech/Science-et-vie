/* Lecture à voix haute de chaque chapitre.
   Si un enregistrement existe dans AUDIO, on le joue ; sinon, la voix du téléphone lit le texte.
   Pour ajouter un enregistrement : déposer audio/<id du chapitre>.mp3 et l'ajouter ci-dessous. */
(function () {
  'use strict';

  const AUDIO = {
    /* debut: 'audio/debut.mp3', lune: 'audio/lune.mp3', … */
  };

  /* Voix françaises masculines, de la plus souhaitée à la moins souhaitée */
  const PREFERRED = ['thomas', 'daniel', 'nicolas', 'henri', 'paul', 'gregoire', 'grégoire', 'jacques', 'mathieu', 'antoine', 'remi', 'rémi', 'frd', 'frc', 'male', 'homme'];

  const synth = window.speechSynthesis || null;
  let voice = null;
  let current = null; /* { btn, audio } */

  function pickVoice() {
    if (!synth) return null;
    const voices = synth.getVoices().filter((v) => /^fr/i.test(v.lang));
    if (!voices.length) return null;
    const score = (v) => {
      const n = (v.name + ' ' + (v.voiceURI || '')).toLowerCase();
      let s = 0;
      const i = PREFERRED.findIndex((p) => n.includes(p));
      if (i >= 0) s += 100 - i;
      if (/fr[-_]fr/i.test(v.lang)) s += 10;
      if (/enhanced|premium|amélioré|natural|neural/.test(n)) s += 20;
      return s;
    };
    return voices.sort((a, b) => score(b) - score(a))[0];
  }
  if (synth) {
    voice = pickVoice();
    if ('onvoiceschanged' in synth) synth.onvoiceschanged = () => { voice = pickVoice(); };
  }

  function textOf(sec) {
    const parts = [];
    const add = (el) => { if (el && el.textContent.trim()) parts.push(el.textContent.trim()); };
    if (sec.classList.contains('hero')) {
      add(sec.querySelector('h1'));
      add(sec.querySelector('.hero-sub'));
      add(sec.querySelector('.lede'));
    } else {
      add(sec.querySelector('.when'));
      add(sec.querySelector('h2'));
      sec.querySelectorAll('.chapter-text p').forEach(add);
      const fact = sec.querySelector('.fact');
      if (fact) {
        add(fact.querySelector('h3'));
        fact.querySelectorAll('p, li').forEach(add);
      }
    }
    return parts.join('. ').replace(/\.\s*\./g, '.').replace(/\s+/g, ' ');
  }

  /* Les longues lectures s'arrêtent parfois sur iPhone : on découpe en phrases */
  function sentences(text) {
    return text.match(/[^.!?…]+[.!?…]*/g).map((s) => s.trim()).filter(Boolean);
  }

  function setState(btn, on) {
    btn.setAttribute('aria-pressed', String(on));
    btn.querySelector('.listen-label').textContent = on ? 'Arrêter' : btn.dataset.label;
  }

  function stop() {
    if (!current) return;
    const { btn, audio } = current;
    current = null;
    if (audio) { audio.pause(); audio.currentTime = 0; }
    if (synth) synth.cancel();
    setState(btn, false);
  }

  function play(sec, btn) {
    const was = current && current.btn === btn;
    stop();
    if (was) return;
    if (window.RM && window.RM.lib) window.RM.lib.buzz(8);
    const src = AUDIO[sec.id];
    if (src) {
      const audio = new Audio(src);
      current = { btn, audio };
      setState(btn, true);
      audio.addEventListener('ended', () => { if (current && current.audio === audio) stop(); });
      audio.addEventListener('error', () => { if (current && current.audio === audio) { stop(); speak(sec, btn); } });
      audio.play().catch(() => { if (current && current.audio === audio) { stop(); speak(sec, btn); } });
      return;
    }
    speak(sec, btn);
  }

  function speak(sec, btn) {
    if (!synth) {
      btn.querySelector('.listen-label').textContent = 'Lecture impossible ici';
      return;
    }
    if (!voice) voice = pickVoice();
    current = { btn, audio: null };
    setState(btn, true);
    const scripted = window.RM && window.RM.narration ? window.RM.narration.get(sec.id) : '';
    const list = sentences(scripted || textOf(sec));
    list.forEach((s, i) => {
      const u = new SpeechSynthesisUtterance(s);
      u.lang = (voice && voice.lang) || 'fr-FR';
      if (voice) u.voice = voice;
      u.rate = 0.94;
      u.pitch = 0.8;
      if (i === list.length - 1) u.onend = () => { if (current && current.btn === btn) stop(); };
      synth.speak(u);
    });
  }

  const ICONS = '<span class="listen-ic" aria-hidden="true">'
    + '<svg class="ic-play" viewBox="0 0 16 16"><path d="M4 2.5v11l9.5-5.5z"/></svg>'
    + '<svg class="ic-stop" viewBox="0 0 16 16"><rect x="3.5" y="3.5" width="9" height="9" rx="1.5"/></svg>'
    + '</span>';

  document.querySelectorAll('[data-chapter]').forEach((sec) => {
    if (sec.dataset.listen === 'off') return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'listen';
    btn.dataset.label = sec.classList.contains('hero') ? 'Écouter l’introduction' : 'Écouter l’histoire';
    btn.setAttribute('aria-pressed', 'false');
    btn.innerHTML = ICONS + '<span class="listen-label"></span><span class="listen-bars" aria-hidden="true"><i></i><i></i><i></i></span>';
    btn.querySelector('.listen-label').textContent = btn.dataset.label;
    btn.addEventListener('click', () => play(sec, btn));
    const anchor = sec.classList.contains('hero') ? sec.querySelector('.hero-foot .lede') : sec.querySelector('.chapter-head h2');
    if (!anchor) return;
    if (sec.classList.contains('hero')) anchor.insertAdjacentElement('beforebegin', btn);
    else anchor.insertAdjacentElement('afterend', btn);
  });

  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  window.addEventListener('pagehide', stop);

  window.RM = window.RM || {};
  window.RM.voice = { stop, textOf };
})();
