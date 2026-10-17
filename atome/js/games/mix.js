/* Le mix électrique : une petite ville vue de côté, du lever du soleil au lever suivant.
   Cinq sources d'électricité à allumer ou éteindre, deux jauges en haut (électricité, CO2)
   et, en bas, la courbe de consommation de la ville qui se remplit au fil de la journée. */
(function () {
  'use strict';
  const { lib } = window.RM;
  const { TAU, clamp, lerp, invLerp, ease, rgba, mix, draw } = lib;

  /* ---------------- Textes du jeu (faciles à corriger) ---------------- */
  const TEXTES = {
    sources: {
      nucleaire: { nom: 'Nucléaire', desc: 'Production forte et constante, jour et nuit. Démarre lentement.', co2: 12 },
      solaire: { nom: 'Solaire', desc: 'Produit seulement le jour : fort à midi, rien la nuit.', co2: 45 },
      eolien: { nom: 'Éolien', desc: 'Sa production varie avec le vent, en rafales irrégulières.', co2: 11 },
      barrage: { nom: 'Barrage', desc: 'Peut produire à tout moment, mais sa réserve d’eau est limitée.', co2: 24 },
      gaz: { nom: 'Gaz', desc: 'Puissance réglable instantanément, mais beaucoup de CO2.', co2: 490 },
    },
    co2Ligne: (v) => `Environ ${v} g de CO2 par kilowattheure.`,
    co2Note: 'Grammes de CO2 par kilowattheure, sur toute la durée de vie (médianes du GIEC).',
    infoBouton: (nom) => `Informations : ${nom}`,
    lancer: 'Lancer la journée',
    recommencer: 'Recommencer la journée',
    jaugeElec: 'Électricité',
    jaugeCo2: 'CO2',
    legendeConso: 'Consommation',
    legendeProd: 'Production',
    consigneAvant: 'Allume des sources, puis touche « Lancer la journée ».',
    consigneJour: 'Surveille les jauges : allume ou éteins des sources pendant la journée.',
    consigneEchec: 'Change ton mélange d’énergies, puis recommence la journée.',
    heure: (h, msg) => `${h} h — ${msg}`,
    manque: 'il manque de l’électricité !',
    barrageVide: 'le barrage est vide.',
    demarre: 'la centrale nucléaire démarre lentement…',
    gazCo2: 'le gaz envoie beaucoup de CO2.',
    ok: 'toute la ville a de l’électricité.',
    causes: {
      soir: 'Il a manqué de l’électricité le soir : le solaire ne produit plus la nuit.',
      co2: 'Beaucoup de CO2 : le gaz pollue. Essaie d’autres sources.',
      barrage: 'Il a manqué de l’électricité : le barrage s’est vidé trop tôt.',
      vent: 'Il a manqué de l’électricité quand le vent a faibli.',
      demarrage: 'Il a manqué de l’électricité : la centrale nucléaire démarre lentement.',
      matin: 'Il a manqué de l’électricité le matin : le soleil était encore bas.',
      pointe: 'Il a manqué de l’électricité le soir, quand la ville en consomme le plus.',
      peu: 'Il a manqué de l’électricité : il faut plus de sources.',
      noir: 'La ville est restée dans le noir : allume des sources d’électricité.',
    },
    fin: 'La ville est restée allumée toute la journée, avec peu de CO2.',
    finStatut: 'Chaque énergie a ses forces et ses faiblesses : il faut les combiner.',
    graduations: ['6 h', '12 h', '18 h', '0 h', '6 h'],
  };

  /* ---------------- Réglages (équilibrés par simulation) ----------------
     Unités arbitraires : la consommation de pointe vaut 92. Une seconde de jeu = une heure. */
  const JOUR = 24;            /* durée de la journée, en secondes */
  const H0 = 6;               /* elle commence à 6 h du matin */
  const CONSO = [[0, 52], [3, 46], [5, 46], [6, 50], [7, 58], [8, 68], [9, 70], [12, 70], [14, 66], [16, 68],
    [17.5, 78], [19, 92], [20, 90], [21, 80], [22, 68], [23, 58], [24, 52]];
  /* vent : profil lent (creux en fin d'après-midi) + rafales irrégulières */
  const VENT = [[0, 26], [2, 24], [4, 20], [6, 18], [8, 22], [10, 27], [12, 19], [13.5, 29], [15, 22], [16.5, 12],
    [18, 7], [19.5, 6], [21, 12], [22.5, 21], [24, 26]];
  const P_NUC = 60, P_SOL = 54, P_BAR = 36, P_GAZ = 80;
  const RESERVE = 150;        /* eau du barrage : 150 unités × heure (un peu plus de 4 h à pleine puissance) */
  const RAMPE = 3;            /* le nucléaire atteint sa puissance en 3 s */
  const TOLERANCE = 0.03;     /* « presque jamais manqué » : moins de 3 % de la consommation non servie */
  const CO2_MAX = 45000;      /* seuil de la journée (nucléaire + solaire + barrage ≈ 29 000) */
  const CO2_PLEIN = 60000;    /* jauge pleine */
  const ORDER = ['nucleaire', 'solaire', 'eolien', 'barrage', 'gaz'];
  const STACK = ['nucleaire', 'barrage', 'eolien', 'solaire', 'gaz'];
  const INFO_ORDER = ['nucleaire', 'eolien', 'solaire', 'barrage', 'gaz'];
  /* couleur sur fond sombre (graphique, anneaux) et encre sur fond clair (étiquette) */
  const COL = { nucleaire: '#3FA9FF', solaire: '#F2C230', eolien: '#C9CFF0', barrage: '#2FC4A0', gaz: '#E8794A' };
  const INK = { nucleaire: '#1C7FD6', solaire: '#C99A00', eolien: '#6772A8', barrage: '#139C7D', gaz: '#D0592A' };

  /* ---------------- Petits outils ---------------- */
  function smooth(e0, e1, x) {
    const t = clamp((x - e0) / (e1 - e0));
    return t * t * (3 - 2 * t);
  }
  function seeded(seed) {
    let s = seed >>> 0 || 1;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }
  function interp(table, h) {
    for (let i = 1; i < table.length; i++) {
      if (h <= table[i][0]) {
        const [h0, a] = table[i - 1], [h1, b] = table[i];
        const k = (h - h0) / (h1 - h0);
        return a + (b - a) * k * k * (3 - 2 * k);
      }
    }
    return table[table.length - 1][1];
  }
  const consumption = (h) => interp(CONSO, h);
  function solarAt(h) {
    if (h < 7 || h > 19) return 0;
    return P_SOL * Math.pow(Math.sin(Math.PI * (h - 7) / 12), 1.2);
  }
  /* hauteur du soleil : il se lève juste avant 6 h et se couche vers 19 h 45 */
  const RISE = 5.85, SPAN = 13.9;
  const sunElev = (h) => Math.sin(Math.PI * (h - RISE) / SPAN);
  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }
  const withSub = (s) => escapeHtml(lib.fr(s)).replace(/CO2/g, 'CO<sub>2</sub>');

  /* ---------------- Icônes (dessinées, allumées / éteintes) ---------------- */
  const ICONS = {
    nucleaire: '<svg viewBox="0 0 32 32" aria-hidden="true"><g class="ic-on ic-steam"><circle cx="12.6" cy="8.6" r="3.1"/><circle cx="17.4" cy="6.4" r="3.8"/><circle cx="21.8" cy="8.9" r="2.8"/></g>' +
      '<path class="ic-f1" d="M8.6 29C10.4 23 10.9 18.2 9.6 13h12.8c-1.3 5.2-.8 10 1 16z"/><ellipse class="ic-f2" cx="16" cy="13" rx="6.4" ry="1.5"/>' +
      '<path class="ic-acc-s" d="M9.9 24.6h12.2"/></svg>',
    solaire: '<svg viewBox="0 0 32 32" aria-hidden="true"><g class="ic-on ic-rays"><path d="M23 1.6v2.2M23 13.2v2.2M16.1 8.5h2.2M27.7 8.5h2.2M18.1 3.6l1.5 1.5M26.4 11.9l1.5 1.5M18.1 13.4l1.5-1.5M26.4 5.1l1.5-1.5"/></g>' +
      '<circle class="ic-acc" cx="23" cy="8.5" r="3.4"/><path class="ic-f1" d="M2.8 28.4 8.6 16.6h18.6l-5.8 11.8z"/>' +
      '<path class="ic-grid" d="M5.7 22.5h18.6M14.8 16.6l-5.8 11.8M21 16.6l-5.8 11.8"/></svg>',
    eolien: '<svg viewBox="0 0 32 32" aria-hidden="true"><path class="ic-f1" d="M15.1 30.5l.6-17h.6l.6 17z"/>' +
      '<g class="ic-rotor"><path class="ic-f1" d="M16 13c-1.1-3.6-1-7.4 0-10.6 1 3.2 1.1 7 0 10.6z"/><path class="ic-f1" d="M16 13c-1.1-3.6-1-7.4 0-10.6 1 3.2 1.1 7 0 10.6z" transform="rotate(120 16 13)"/>' +
      '<path class="ic-f1" d="M16 13c-1.1-3.6-1-7.4 0-10.6 1 3.2 1.1 7 0 10.6z" transform="rotate(240 16 13)"/></g><circle class="ic-acc" cx="16" cy="13" r="2"/></svg>',
    barrage: '<svg viewBox="0 0 32 32" aria-hidden="true"><path class="ic-f2" d="M1.5 29.5V10.5c3.3 1.6 7.6 3.1 13 3.5v15.5z"/>' +
      '<rect class="ic-water" x="2.5" y="11" width="13" height="18.5"/><path class="ic-f1" d="M15 8.5h4.4l5.8 21H15z"/>' +
      '<path class="ic-on ic-flow" d="M25.6 22.4c1.6 1.3 2.6 3.2 3.2 6.2M27.4 20.6c1.4 1 2.4 2.6 2.9 4.6"/></svg>',
    gaz: '<svg viewBox="0 0 32 32" aria-hidden="true"><g class="ic-on ic-smoke"><circle cx="24.2" cy="5.6" r="2.7"/><circle cx="27.6" cy="2.8" r="2"/></g>' +
      '<rect class="ic-f2" x="21.8" y="8" width="4.6" height="21.5" rx=".8"/><rect class="ic-acc" x="21.8" y="11" width="4.6" height="1.8"/>' +
      '<path class="ic-f1" d="M2.6 29.5V17.8l6.2-3.2v3.2l6.2-3.2v3.2l6.2-3.2v14.9z"/>' +
      '<path class="ic-on ic-flame" d="M10.6 27.2c-2-1.6-1.6-3.6.6-5.4-.1 1.3.6 2 1.3 2.3.3-.9.2-1.7-.3-2.5 1.9 1 2.7 2.8 1.6 4.8-.8 1-2.4 1.4-3.2.8z"/></svg>',
  };
  const INFO_SVG = '<span aria-hidden="true">i</span>';
  const BOLT_SVG = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M8.6.8 2.8 8.1h3.8l-1.3 5.1 6-7.6H7.5z" fill="#F2C230"/></svg>';
  const MOL_SVG = '<svg viewBox="0 0 16 10" aria-hidden="true"><circle cx="3" cy="5" r="2.4" fill="#FF8C7A"/><circle cx="13" cy="5" r="2.4" fill="#FF8C7A"/><circle cx="8" cy="5" r="3" fill="#C9CEE6"/></svg>';
  const SUNRISE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 18h17M7 18a5 5 0 0 1 10 0M12 6.2v2.6M5.3 9.6l1.8 1.6M18.7 9.6l-1.8 1.6"/></svg>';
  const AGAIN_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 12a7.5 7.5 0 1 1-2.6-5.7"/><path d="M19.6 4.2v4.4h-4.4"/></svg>';

  const G = '.game[data-game="mix"]';
  const CSS = `
${G} .mx-gauges { position: absolute; z-index: 3; left: 8px; right: 8px; top: 8px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px; pointer-events: none; }
${G} .mx-g { min-width: 0; padding: 6px 10px 8px; border-radius: 14px 17px 15px 16px / 15px 14px 17px 15px; background: rgba(10, 14, 36, 0.58);
  box-shadow: inset 0 0 0 1px rgba(238, 240, 251, 0.13); color: #EEF0FB; -webkit-backdrop-filter: blur(5px); backdrop-filter: blur(5px); transition: box-shadow .25s; }
${G} .mx-gl { display: flex; align-items: center; gap: 5px; margin: 0; font: 700 0.8125rem/1 var(--font-text); white-space: nowrap; }
${G} .mx-gl svg { width: 14px; height: 14px; flex: none; }
${G} .mx-gl sub { font-size: 0.72em; vertical-align: -0.2em; line-height: 0; }
${G} .mx-gt { position: relative; display: block; height: 8px; margin-top: 6px; }
${G} .mx-gtr { position: absolute; inset: 0; overflow: hidden; border-radius: 5px 4px 5px 4px; background: rgba(238, 240, 251, 0.14); }
${G} .mx-gf { position: absolute; inset: 0; transform-origin: 0 50%; transform: scaleX(0); border-radius: inherit; background: #F2C230; transition: background-color .25s; will-change: transform; }
${G} .mx-gm { position: absolute; top: -3px; bottom: -3px; left: 75%; width: 2px; margin-left: -1px; border-radius: 1px; background: #EEF0FB; box-shadow: 0 0 0 1px rgba(10, 14, 36, 0.5); }
${G} .mx-g.is-low { box-shadow: inset 0 0 0 1.5px rgba(255, 93, 108, 0.75); }
${G} .mx-g.is-low .mx-gf { background: #FF5D6C; }
${G} .mx-g--co2 .mx-gf { background: #B9C0DA; }
${G} .mx-g--co2.is-warn .mx-gf { background: #FFA14A; }
${G} .mx-g--co2.is-fast .mx-gf { animation: mx-fast .8s ease-in-out infinite; }
@keyframes mx-fast { 50% { filter: brightness(1.35); } }
${G} .mx-launch { position: absolute; z-index: 4; left: 50%; top: 40%; transform: translate(-50%, -50%); gap: 8px; padding: 11px 20px 11px 15px;
  background: #F2C230; color: #1A1530; font-size: 1rem; box-shadow: 0 0 0 6px rgba(242, 194, 48, 0.22), 0 12px 26px -10px rgba(0, 0, 0, 0.75);
  transition: opacity .35s, transform .35s, visibility 0s linear 0s; white-space: nowrap; }
${G} .mx-launch:active { transform: translate(-50%, -48%) scale(0.98); }
${G} .mx-launch.is-gone { opacity: 0; visibility: hidden; transform: translate(-50%, -30%) scale(0.94); transition: opacity .35s, transform .35s, visibility 0s linear .35s; }
${G} .mx-launch svg { width: 22px; height: 22px; flex: none; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
${G} .mx-launch.is-pulse { animation: mx-pulse 2.2s ease-in-out infinite; }
@keyframes mx-pulse { 50% { box-shadow: 0 0 0 11px rgba(242, 194, 48, 0.12), 0 12px 26px -10px rgba(0, 0, 0, 0.75); } }
${G} .mx-legend { position: absolute; z-index: 2; display: flex; gap: 12px; align-items: center; pointer-events: none;
  font: 700 0.6875rem/1 var(--font-text); color: #ABB1D6; white-space: nowrap; }
${G} .mx-legend span { display: inline-flex; align-items: center; gap: 5px; }
${G} .mx-legend i { display: inline-block; width: 14px; height: 2px; border-radius: 1px; background: #EEF0FB; }
${G} .mx-legend i.mx-lp { height: 8px; width: 12px; border-radius: 2px; background: linear-gradient(#E8794A 0 22%, #F2C230 22% 50%, #2FC4A0 50% 68%, #3FA9FF 68%); }
${G} .mx-bar { position: absolute; z-index: 3; left: 8px; right: 8px; bottom: 8px; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; }
${G} .mx-src { position: relative; min-width: 0; }
${G} .mx-btn { width: 100%; height: var(--mx-ch, 58px); min-height: 44px; flex-direction: column; gap: 4px; padding: 7px 2px 6px;
  background: rgba(238, 240, 251, 0.07); color: rgba(238, 240, 251, 0.88); box-shadow: inset 0 0 0 1px rgba(238, 240, 251, 0.17);
  font-size: var(--mx-fs, 12.5px); line-height: 1; letter-spacing: -0.005em; transition: background-color .2s, color .2s, box-shadow .25s;
  -webkit-touch-callout: none; }
${G} .mx-btn > span { display: block; max-width: 100%; padding-top: 2px; white-space: nowrap; }
${G} .mx-btn svg { width: var(--mx-is, 26px); height: var(--mx-is, 26px); flex: none; overflow: visible; }
${G} .mx-src.is-on .mx-btn { background: #F4F5FB; color: #171A2E; box-shadow: 0 0 0 2px var(--mx-c), 0 0 18px -3px var(--mx-c), 0 6px 16px -8px rgba(0, 0, 0, 0.6); }
${G} .mx-src.is-empty .mx-btn { opacity: 0.5; }
${G} .mx-src.is-bump .mx-btn { animation: mx-bump .4s ease-out; }
@keyframes mx-bump { 30% { transform: scale(1.06); } }
${G} .mx-i { position: absolute; z-index: 1; top: 3px; right: 3px; width: 19px; height: 19px; padding: 0 0 1px; border: 0; border-radius: 50%;
  display: grid; place-items: center; background: rgba(238, 240, 251, 0.14); color: rgba(238, 240, 251, 0.95); cursor: pointer; touch-action: manipulation;
  font: italic 800 13px/1 var(--font-display); }
${G} .mx-i::before { content: ""; position: absolute; inset: -5px -3px -4px -4px; }
${G} .mx-src.is-on .mx-i { background: rgba(23, 26, 46, 0.08); color: #3A3F5C; }
${G} .mx-btn .ic-f1 { fill: currentColor; opacity: .5; transition: fill .25s, opacity .25s; }
${G} .mx-btn .ic-f2 { fill: currentColor; opacity: .3; transition: fill .25s, opacity .25s; }
${G} .mx-btn .ic-acc { fill: currentColor; opacity: .45; transition: fill .25s, opacity .25s; }
${G} .mx-btn .ic-acc-s, ${G} .mx-btn .ic-grid { fill: none; stroke: currentColor; stroke-width: 1.4; opacity: .35; stroke-linecap: round; }
${G} .mx-btn .ic-water { fill: #3AA7C9; opacity: .55; }
${G} .mx-btn .ic-on { opacity: 0; transition: opacity .3s; }
${G} .mx-btn .ic-rays, ${G} .mx-btn .ic-flow { fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; }
${G} .mx-src.is-on .ic-on { opacity: 1; }
${G} .mx-src.is-on .ic-f1 { fill: #6F7A99; opacity: 1; }
${G} .mx-src.is-on .ic-f2 { fill: #AEB7CE; opacity: 1; }
${G} .mx-src.is-on .ic-acc { fill: var(--mx-k); opacity: 1; }
${G} .mx-src.is-on .ic-acc-s { stroke: var(--mx-k); opacity: 1; stroke-width: 1.8; }
${G} .mx-src.is-on .ic-water { fill: #2EA6D6; opacity: 1; }
${G} .mx-src.is-on .ic-steam { fill: #B9C6DE; }
${G} .mx-src.is-on .ic-rays { stroke: #E3AE00; }
${G} .mx-src.is-on .ic-grid { stroke: rgba(255, 255, 255, 0.7); opacity: 1; }
${G} .mx-src[data-k="solaire"].is-on .ic-f1 { fill: #2F5DA6; }
${G} .mx-src.is-on .ic-flow { stroke: #2EA6D6; }
${G} .mx-src.is-on .ic-smoke { fill: #9C928B; }
${G} .mx-src.is-on .ic-flame { fill: #FF8A3D; }
${G} .mx-src.is-on .ic-rotor { animation: mx-spin 1.6s linear infinite; transform-origin: 16px 13px; }
${G} .mx-src.is-on .ic-steam { animation: mx-rise 2.4s ease-in-out infinite; }
${G} .mx-src.is-on .ic-smoke { animation: mx-rise 1.8s ease-in-out infinite; }
@keyframes mx-spin { to { transform: rotate(360deg); } }
@keyframes mx-rise { 50% { transform: translateY(-1.4px); } }
@media (prefers-reduced-motion: reduce) {
  ${G} .mx-src.is-on .ic-rotor, ${G} .mx-src.is-on .ic-steam, ${G} .mx-src.is-on .ic-smoke, ${G} .mx-g--co2.is-fast .mx-gf, ${G} .mx-launch.is-pulse { animation: none; }
}
${G} .mx-tip { position: absolute; z-index: 6; left: 8px; bottom: 80px; width: min(312px, calc(100% - 16px)); padding: 12px 14px 11px;
  border-radius: 18px 22px 20px 17px / 17px 19px 22px 20px; background: #F4F5FB; color: #171A2E;
  box-shadow: 0 18px 36px -14px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(0, 0, 0, 0.04);
  opacity: 0; visibility: hidden; transform: translateY(8px); pointer-events: none;
  transition: opacity .2s, transform .25s cubic-bezier(.2, .8, .2, 1), visibility 0s linear .25s; }
${G} .mx-tip.is-on { opacity: 1; visibility: visible; transform: none; transition: opacity .2s, transform .25s cubic-bezier(.2, .8, .2, 1); }
${G} .mx-tip::after { content: ""; position: absolute; bottom: -6px; left: var(--mx-ax, 50%); width: 13px; height: 13px; margin-left: -6.5px;
  background: inherit; transform: rotate(45deg); border-radius: 0 0 4px 0; }
${G} .mx-th { display: flex; align-items: center; gap: 8px; margin: 0 0 5px; font: 800 1.125rem/1.1 var(--font-display); }
${G} .mx-th i { width: 11px; height: 11px; flex: none; border-radius: 50%; background: var(--mx-k); box-shadow: 0 0 0 3px rgba(23, 26, 46, 0.07); }
${G} .mx-td { margin: 0 0 4px; font-size: 0.875rem; line-height: 1.35; }
${G} .mx-tc { margin: 0 0 8px; font-size: 0.875rem; line-height: 1.35; font-weight: 800; }
${G} .mx-tc sub, ${G} .mx-tn sub, ${G} .mx-td sub { font-size: 0.72em; vertical-align: -0.2em; line-height: 0; }
${G} .mx-rows { display: grid; gap: 4px; }
${G} .mx-row { display: grid; grid-template-columns: 5.3em minmax(0, 1fr) 2.2em; align-items: center; gap: 6px; font-size: 0.75rem; line-height: 1.1; color: #5A5F78; }
${G} .mx-row b { position: relative; display: block; height: 7px; border-radius: 4px 3px 4px 3px; background: #DFE2EE; overflow: hidden; }
${G} .mx-row b i { position: absolute; left: 0; top: 0; bottom: 0; width: var(--v); min-width: 3px; border-radius: inherit; background: #8E94AE; }
${G} .mx-row.is-sel { color: #171A2E; font-weight: 800; }
${G} .mx-row.is-sel b i { background: var(--mx-k); }
${G} .mx-row span:last-child { text-align: right; font-variant-numeric: tabular-nums; }
${G} .mx-tn { margin: 7px 0 0; font-size: 0.6875rem; line-height: 1.3; color: #6A6F88; }
`;

  /* ---------------- Palettes du paysage : jour, crépuscule, nuit ---------------- */
  const PAL = {
    day: {
      far: '#93A7CB', farShade: '#8398BF', mount: '#7385AC', mountShade: '#5B6B93', mountLight: '#9AA9C8', bed: '#56637A',
      concrete: '#D7D3C9', concreteShade: '#A6A49C', hill: '#6E9870', hillShade: '#55805D', plain: '#89A86B', plainFar: '#A3BC8B',
      tree: '#3E6E4B', treeLight: '#5C8E5E', wall: '#E8E0D1', wallShade: '#C2B8A8', roof: '#B9614A', roofShade: '#8F4637', flat: '#A3A8B2',
      panel: '#2A4E86', panelHi: '#7DA3DA', steel: '#8F98A8', ground: '#6D8C55', road: '#8C8E92', glass: '#93B6DA', glassShade: '#6D8FB6',
      stack: '#C9C4BA', mast: '#F1F2F4', dome: '#DCD8CF',
    },
    dusk: {
      far: '#A784A8', farShade: '#906F98', mount: '#71608E', mountShade: '#4E426F', mountLight: '#B98C9E', bed: '#463A5A',
      concrete: '#E3B79A', concreteShade: '#9D7A78', hill: '#5D6A5F', hillShade: '#46514A', plain: '#7A7E5A', plainFar: '#918A6A',
      tree: '#34473B', treeLight: '#55604A', wall: '#F0C6A2', wallShade: '#AE8A80', roof: '#B65846', roofShade: '#7E3E3C', flat: '#9C8A90',
      panel: '#3B3F70', panelHi: '#F0A47C', steel: '#9A8790', ground: '#5B6247', road: '#7A6E72', glass: '#F4B78C', glassShade: '#B07E78',
      stack: '#D8B49E', mast: '#F2D9C9', dome: '#E8C2A6',
    },
    night: {
      far: '#252D57', farShade: '#1F274D', mount: '#1D2449', mountShade: '#151B3B', mountLight: '#2E3768', bed: '#121733',
      concrete: '#3B4271', concreteShade: '#272D56', hill: '#18213F', hillShade: '#121933', plain: '#1A2340', plainFar: '#202A4A',
      tree: '#101830', treeLight: '#1A2444', wall: '#2C3462', wallShade: '#1F264B', roof: '#2B2851', roofShade: '#1F1C3F', flat: '#2A3058',
      panel: '#18224A', panelHi: '#3A4A80', steel: '#394166', ground: '#141B36', road: '#1C2240', glass: '#1E2550', glassShade: '#171D42',
      stack: '#363D68', mast: '#5D6694', dome: '#353C6A',
    },
  };
  const SKY = [
    [-0.4, '#060918', '#0B1030', '#151B45'],
    [-0.14, '#0F1640', '#232A62', '#4A3A75'],
    [0.0, '#24326C', '#6E5A90', '#EE8C6C'],
    [0.12, '#3A5B9C', '#8EA3CE', '#F6C99C'],
    [0.32, '#3C7AC2', '#85B3E1', '#CBE3F3'],
    [1.0, '#3878C6', '#7CAFE5', '#C6E0F5'],
  ];
  const SKY_U = SKY.map((r) => invLerp(-0.4, 1, r[0]));
  const SKY_STOPS = [1, 2, 3].map((c) => SKY.map((r, i) => [SKY_U[i], r[c]]));

  window.RM.games.mix = function (api) {
    const stage = api.stage;
    const cv = api.canvas();
    const ctx = cv.ctx;
    const RMo = api.reducedMotion;
    api.style(CSS);

    /* ---------------- DOM : jauges, bouton, sources, étiquette ---------------- */
    const gauges = document.createElement('div');
    gauges.className = 'mx-gauges';
    gauges.innerHTML =
      '<div class="mx-g mx-g--elec"><p class="mx-gl">' + BOLT_SVG + '<span></span></p><span class="mx-gt"><span class="mx-gtr"><span class="mx-gf"></span></span><span class="mx-gm"></span></span></div>' +
      '<div class="mx-g mx-g--co2"><p class="mx-gl">' + MOL_SVG + '<span></span></p><span class="mx-gt"><span class="mx-gtr"><span class="mx-gf"></span></span><span class="mx-gm"></span></span></div>';
    const gElec = gauges.children[0], gCo2 = gauges.children[1];
    gElec.querySelector('.mx-gl span').textContent = TEXTES.jaugeElec;
    gCo2.querySelector('.mx-gl span').innerHTML = withSub(TEXTES.jaugeCo2);
    const fElec = gElec.querySelector('.mx-gf'), fCo2 = gCo2.querySelector('.mx-gf');
    gCo2.querySelector('.mx-gm').style.left = (CO2_MAX / CO2_PLEIN * 100) + '%';

    const launch = document.createElement('button');
    launch.type = 'button';
    launch.className = 'chip mx-launch';
    const launchIc = document.createElement('span');
    launchIc.style.display = 'contents';
    const launchTx = document.createElement('span');
    launch.append(launchIc, launchTx);

    const legend = document.createElement('div');
    legend.className = 'mx-legend';
    legend.setAttribute('aria-hidden', 'true');
    legend.innerHTML = '<span><i></i></span><span><i class="mx-lp"></i></span>';
    legend.children[0].append(TEXTES.legendeConso);
    legend.children[1].append(TEXTES.legendeProd);

    const bar = document.createElement('div');
    bar.className = 'mx-bar';
    const chips = {};
    ORDER.forEach((k) => {
      const S = TEXTES.sources[k];
      const wrap = document.createElement('div');
      wrap.className = 'mx-src';
      wrap.dataset.k = k;
      wrap.style.setProperty('--mx-c', COL[k]);
      wrap.style.setProperty('--mx-k', INK[k]);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip mx-btn';
      b.setAttribute('aria-pressed', 'false');
      b.innerHTML = ICONS[k] + '<span></span>';
      b.lastChild.textContent = S.nom;
      const i = document.createElement('button');
      i.type = 'button';
      i.className = 'mx-i';
      i.innerHTML = INFO_SVG;
      i.setAttribute('aria-label', TEXTES.infoBouton(S.nom));
      wrap.append(b, i);
      bar.appendChild(wrap);
      chips[k] = { wrap, b, i, water: b.querySelector('.ic-water') };
    });

    const tip = document.createElement('div');
    tip.className = 'mx-tip';
    tip.setAttribute('role', 'status');
    tip.innerHTML = '<p class="mx-th"><i></i><span></span></p><p class="mx-td"></p><p class="mx-tc"></p><div class="mx-rows"></div><p class="mx-tn"></p>';
    const tipName = tip.querySelector('.mx-th span'), tipDesc = tip.querySelector('.mx-td'), tipCo2 = tip.querySelector('.mx-tc');
    const tipRows = tip.querySelector('.mx-rows');
    tip.querySelector('.mx-tn').innerHTML = withSub(TEXTES.co2Note);
    const rows = {};
    INFO_ORDER.forEach((k) => {
      const r = document.createElement('div');
      r.className = 'mx-row';
      r.style.setProperty('--mx-k', INK[k]);
      r.innerHTML = '<span></span><b><i></i></b><span></span>';
      r.children[0].textContent = TEXTES.sources[k].nom;
      r.children[2].textContent = lib.num(TEXTES.sources[k].co2);
      r.querySelector('i').style.setProperty('--v', (TEXTES.sources[k].co2 / 490 * 100).toFixed(2) + '%');
      tipRows.appendChild(r);
      rows[k] = r;
    });
    stage.append(gauges, legend, launch, bar, tip);

    /* ---------------- État ---------------- */
    const on = { nucleaire: false, solaire: false, eolien: false, barrage: false, gaz: false };
    const prod = { nucleaire: 0, solaire: 0, eolien: 0, barrage: 0, gaz: 0 };
    let phase = 'idle';         /* idle | day | end */
    let dayT = 0;
    let hour = H0;
    let clock = 0;              /* horloge réelle (rafales, animations) */
    let time = 0;
    let ramp = 0;
    let water = 1;
    let damUsed = false;
    let damMsgT = 0;
    let refill = 0;
    let co2 = 0, co2Rate = 0;
    let unmet = 0, demandSum = 0;
    let causes = {};
    let need = 50, total = 0, ratio = 0, lowCarbon = 0;
    let windNow = 18;
    let elecShown = 0, co2Shown = 0;
    let infoOpen = null, infoT = 0;
    let longTimer = 0, suppressClick = false;
    let reGesture = 0, gestureAgain = true;
    let shownStatus = '', shownProg = -1;
    let sunE = 0, dayW = 0, nightW = 0, darkW = 0;
    let rings = [], puffs = [], exhaust = [], mols = [], foam = [];
    let puffAcc = 0, exhAcc = 0, molAcc = 0, foamAcc = 0;
    const rotor = [0, 0, 0];
    let rotorW = 0;
    let gustSeed = 7;
    let gustTab = new Float32Array(256);
    const NS = 240;
    const rec = new Float32Array(NS * 7);
    let recN = 0;
    let clouds = [];

    function makeGust(seed) {
      const r = seeded(seed);
      for (let i = 0; i < 256; i++) gustTab[i] = r();
    }
    function gust(t) {
      const x = t * 1.7;
      const j = Math.floor(x), f = x - j;
      const a = gustTab[j & 255], b = gustTab[(j + 1) & 255];
      return (a + (b - a) * f * f * (3 - 2 * f) - 0.5) * 2;
    }
    const windAt = (t, h) => Math.max(2, interp(VENT, h) * (1 + 0.28 * gust(t)));

    /* ---------------- Géométrie ---------------- */
    const L = { w: 1, h: 1 };
    let layers = null;     /* { back: [jour, crépuscule, nuit], front: [...], console, stars, puff: [jour, nuit], clouds } */
    let town = [];
    let lamps = [];
    let panels = [];
    let consoLine = new Float32Array(97);

    function layout(w, h) {
      L.w = w;
      L.h = h;
      L.chipsH = Math.round(clamp(h * 0.13, 52, 64));
      L.chipsTop = h - 8 - L.chipsH;
      L.chartH = Math.round(clamp(h * 0.165, 62, 104));
      L.chartY = L.chipsTop - 8 - L.chartH;
      L.chartX = 8;
      L.chartW = w - 16;
      L.consoleTop = L.chartY - 6;
      L.base = L.consoleTop - 4;
      const s = (L.s = clamp(Math.min(w / 358, L.consoleTop / 294), 0.78, 1.8));
      /* le graphique */
      L.px = L.chartX + 10;
      L.pw = L.chartW - 20;
      L.py = L.chartY + 19;
      L.ph = L.chartH - 19 - 15;
      /* ciel, soleil */
      L.sunH = L.base - 30 * s;
      L.sunTop = Math.max(76, L.consoleTop * 0.27);
      /* montagnes et lac (rive gauche) */
      L.lkT = L.base - 82 * s;
      L.lkB = L.base - 54 * s;
      L.lkX0 = w * 0.025;
      L.lkX1 = w * 0.236;
      L.damX = w * 0.236;
      L.damTop = L.lkT - 4 * s;
      L.damFoot = L.lkB + 9 * s;
      L.damW = 4.2 * s;
      L.damBase = 21 * s;
      /* centrale au gaz */
      L.gasX = w * 0.30;
      L.gasY = L.base - 22 * s;
      L.stackX = w * 0.30 + 21 * s;
      L.stackTop = L.gasY - 64 * s;
      /* ville */
      L.townX0 = w * 0.37;
      L.townX1 = w * 0.685;
      /* centrale nucléaire */
      L.towerX = w * 0.758;
      L.towerY = L.base - 15 * s;
      L.towerH = 56 * s;
      L.towerW = 34 * s;
      L.domeX = w * 0.835;
      /* éoliennes */
      L.turb = [
        { x: w * 0.888, y: L.base - 70 * s, r: 13 * s, ph: 0 },
        { x: w * 0.948, y: L.base - 84 * s, r: 15 * s, ph: 1.3 },
        { x: w * 1.006, y: L.base - 66 * s, r: 12 * s, ph: 2.4 },
      ];
      /* points d'ancrage des anneaux (retour quand on touche une source) */
      L.anchor = {
        nucleaire: [L.towerX, L.towerY - L.towerH * 0.5],
        solaire: [w * 0.16, L.base - 12 * s],
        eolien: [L.turb[0].x, L.turb[0].y],
        barrage: [L.damX + 4 * s, (L.lkT + L.lkB) / 2],
        gaz: [L.stackX, L.gasY - 22 * s],
      };
      for (let i = 0; i <= 96; i++) consoLine[i] = consumption((H0 + i / 4) % 24);

      makeTown();
      makePanels();
      layers = {
        back: ['day', 'dusk', 'night'].map((k) => paintBack(PAL[k])),
        front: ['day', 'dusk', 'night'].map((k) => paintFront(PAL[k], k)),
        console: paintConsole(),
        stars: paintStars(),
        puff: [paintPuff('#FFFFFF', '#C3CCDD'), paintPuff('#6A739E', '#3E4673')],
        cloud: [paintCloudSet('#FFFFFF', '#D3DCEC'), paintCloudSet('#FFE0CC', '#D99AAE'), paintCloudSet('#4A5488', '#2E3668')],
        town: town.map((b) => paintBuildingLights(b)),
        lamp: sprite(9 * s, (g, R) => draw.glow(g, R, R, R, '#FFC870', 1)),
        lampG: sprite(7 * s, (g, R) => draw.glow(g, R, R, R, '#FFB54A', 1)),
      };
      makeClouds();

      /* DOM */
      bar.style.height = L.chipsH + 'px';
      stage.style.setProperty('--mx-ch', L.chipsH + 'px');
      stage.style.setProperty('--mx-fs', clamp(w / 28.5, 11, 14).toFixed(1) + 'px');
      stage.style.setProperty('--mx-is', Math.round(clamp(L.chipsH * 0.45, 22, 30)) + 'px');
      launch.style.top = Math.round(clamp(L.consoleTop * 0.42, 92, L.consoleTop - 60)) + 'px';
      legend.style.left = (L.chartX + 11) + 'px';
      legend.style.top = (L.chartY + 6) + 'px';
      tip.style.bottom = (h - L.chipsTop + 10) + 'px';
      if (infoOpen) placeTip(infoOpen);
      if (phase === 'idle' && !api.isDone() && stage.querySelector('.gesture')) showLaunchGesture();
    }

    /* ---------------- Peinture des fonds (pré-rendus) ---------------- */
    /* canevas hors écran ; y0 : haut de la zone utile (on ne garde que ce qui est dessiné) */
    function makeCanvas(hh, y0 = 0) {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(L.w * cv.dpr));
      c.height = Math.max(1, Math.round((hh - y0) * cv.dpr));
      c.y0 = y0;
      c.hh = hh - y0;
      const g = c.getContext('2d');
      g.scale(cv.dpr, cv.dpr);
      g.translate(0, -y0);
      return [c, g];
    }
    function sprite(R, paint) {
      const c = document.createElement('canvas');
      c.width = c.height = Math.max(2, Math.round(R * 2 * cv.dpr));
      const g = c.getContext('2d');
      g.scale(cv.dpr, cv.dpr);
      paint(g, R);
      return c;
    }

    /* crête : somme de bosses douces + bruit */
    function ridge(x, bumps, n, amp) {
      let y = 0;
      for (const [bx, bh, bw] of bumps) {
        const d = (x - bx) / bw;
        y = Math.max(y, bh * Math.exp(-d * d));
      }
      return y + (n.fbm(x * 0.03, 3.1, 3) - 0.5) * amp;
    }

    function paintBack(P) {
      const { w, s } = L;
      const [c, g] = makeCanvas(L.consoleTop, Math.max(0, Math.floor(L.base - 175 * s)));
      const n = lib.makeNoise(3);
      /* collines lointaines sur toute la largeur */
      g.beginPath();
      g.moveTo(0, L.base);
      for (let x = 0; x <= w + 4; x += 4) {
        const y = L.base - 40 * s - ridge(x, [[w * 0.62, 22 * s, w * 0.16], [w * 0.92, 30 * s, w * 0.14]], n, 10 * s);
        g.lineTo(x, y);
      }
      g.lineTo(w, L.base);
      g.closePath();
      let gr = g.createLinearGradient(0, L.base - 90 * s, 0, L.base);
      gr.addColorStop(0, P.far);
      gr.addColorStop(1, P.farShade);
      g.fillStyle = gr;
      g.fill();

      /* montagnes de gauche, avec leurs strates */
      const bumps = [[w * 0.02, 118 * s, w * 0.12], [w * 0.16, 136 * s, w * 0.13], [w * 0.3, 104 * s, w * 0.11], [w * 0.44, 66 * s, w * 0.1], [w * 0.09, 96 * s, w * 0.16]];
      const top = (x) => L.base - ridge(x, bumps, n, 9 * s);
      g.beginPath();
      g.moveTo(-4, L.base);
      for (let x = -4; x <= w * 0.62; x += 3) g.lineTo(x, top(x));
      g.lineTo(w * 0.62, L.base);
      g.closePath();
      gr = g.createLinearGradient(0, L.base - 160 * s, 0, L.base);
      gr.addColorStop(0, P.mountLight);
      gr.addColorStop(0.35, P.mount);
      gr.addColorStop(1, P.mountShade);
      g.fillStyle = gr;
      g.fill();
      g.save();
      g.clip();
      /* versants à l'ombre : là où la crête descend vers la droite */
      for (let x = 0; x <= w * 0.62; x += 2) {
        const slope = top(x + 2) - top(x - 2);
        if (slope > 0) {
          g.fillStyle = rgba(P.mountShade, clamp(slope / (5 * s)) * 0.55);
          g.fillRect(x, top(x), 2, L.base - top(x));
        }
      }
      /* strates de roche */
      g.lineWidth = Math.max(1, 1.1 * s);
      for (let k = 0; k < 16; k++) {
        const y0 = L.base - 150 * s + k * 10 * s;
        g.strokeStyle = k % 2 ? rgba(P.mountLight, 0.22) : rgba(P.mountShade, 0.3);
        g.beginPath();
        for (let x = -4; x <= w * 0.62; x += 6) {
          const y = y0 + (x * 0.16) + (n.noise2(x * 0.02, k * 1.7) - 0.5) * 9 * s;
          if (x === -4) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.stroke();
      }
      g.restore();

      /* le fond de la retenue d'eau (visible quand le lac se vide) */
      lakePath(g);
      gr = g.createLinearGradient(0, L.lkT, 0, L.lkB);
      gr.addColorStop(0, P.mountShade);
      gr.addColorStop(1, P.bed);
      g.fillStyle = gr;
      g.fill();
      g.save();
      g.clip();
      for (let i = 0; i < 40; i++) {
        g.fillStyle = rgba(i % 2 ? P.mountLight : '#000000', 0.12);
        g.fillRect(lerp(L.lkX0, L.lkX1, n.rnd()), lerp(L.lkT, L.lkB, n.rnd()), 2 * s, 1.2 * s);
      }
      g.restore();
      return c;
    }

    function streamPath(g) {
      const s = L.s, x0 = L.damX + L.damBase + 8 * s, y0 = L.damFoot - 0.5 * s;
      g.beginPath();
      g.moveTo(x0, y0);
      g.bezierCurveTo(x0 + 8 * s, y0 + 1 * s, x0 + 6 * s, y0 + 10 * s, x0 + 14 * s, L.base - 24 * s);
      g.quadraticCurveTo(x0 + 20 * s, L.base - 21 * s, x0 + 26 * s, L.base - 20 * s);
    }

    /* la cuvette du lac, fermée à droite par le barrage */
    function lakePath(g) {
      const s = L.s;
      g.beginPath();
      g.moveTo(L.lkX0, L.lkT - 2 * s);
      g.bezierCurveTo(L.lkX0 + (L.lkX1 - L.lkX0) * 0.25, L.lkT + 4 * s, L.lkX0 + (L.lkX1 - L.lkX0) * 0.32, L.lkB, L.lkX0 + (L.lkX1 - L.lkX0) * 0.55, L.lkB);
      g.lineTo(L.lkX1 + 1, L.lkB + 1 * s);
      g.lineTo(L.lkX1 + 1, L.lkT - 2 * s);
      g.closePath();
    }

    function tree(g, x, y, r, P, seed) {
      const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.1, x, y, r * 1.1);
      gr.addColorStop(0, P.treeLight);
      gr.addColorStop(1, P.tree);
      g.fillStyle = gr;
      draw.blob(g, x, y, r, 0.16, seed, 0, 16);
      g.fill();
    }

    function paintFront(P, key) {
      const { w, s } = L;
      const [c, g] = makeCanvas(L.consoleTop, Math.max(0, Math.floor(L.base - 112 * s)));
      const n = lib.makeNoise(9);
      const rnd = seeded(41);

      /* le terrain qui descend du barrage vers la plaine */
      g.beginPath();
      g.moveTo(L.damX - 8 * s, L.damFoot - 1 * s);
      g.bezierCurveTo(L.damX + 20 * s, L.damFoot - 2 * s, L.damX + 34 * s, L.base - 30 * s, L.damX + 58 * s, L.base - 22 * s);
      g.lineTo(L.damX + 58 * s, L.base);
      g.lineTo(L.damX - 8 * s, L.base);
      g.closePath();
      let gr = g.createLinearGradient(0, L.damFoot, 0, L.base);
      gr.addColorStop(0, P.hill);
      gr.addColorStop(1, P.hillShade);
      g.fillStyle = gr;
      g.fill();
      /* le barrage : un mur de béton, vertical côté lac, en pente côté vallée */
      g.beginPath();
      g.moveTo(L.damX, L.damTop);
      g.lineTo(L.damX + L.damW, L.damTop);
      g.bezierCurveTo(L.damX + L.damW + 3 * s, L.damTop + 10 * s, L.damX + L.damBase - 6 * s, L.damFoot - 6 * s, L.damX + L.damBase, L.damFoot);
      g.lineTo(L.damX - 1.5 * s, L.damFoot);
      g.closePath();
      gr = g.createLinearGradient(L.damX, 0, L.damX + L.damBase, 0);
      gr.addColorStop(0, P.concrete);
      gr.addColorStop(0.35, P.concrete);
      gr.addColorStop(1, P.concreteShade);
      g.fillStyle = gr;
      g.fill();
      g.save();
      g.clip();
      g.strokeStyle = rgba(P.concreteShade, 0.55);
      g.lineWidth = 0.7 * s;
      for (let k = 1; k < 6; k++) {
        const y = lerp(L.damTop, L.damFoot, k / 6);
        g.beginPath();
        g.moveTo(L.damX, y);
        g.lineTo(L.damX + L.damBase, y);
        g.stroke();
      }
      g.fillStyle = rgba('#000000', 0.08);
      g.fillRect(L.damX, L.damTop, 1.2 * s, L.damFoot - L.damTop);
      g.restore();
      /* la crête, avec sa petite route */
      g.fillStyle = rgba('#FFFFFF', key === 'night' ? 0.1 : 0.4);
      g.fillRect(L.damX - 0.8 * s, L.damTop - 1.2 * s, L.damW + 2 * s, 1.6 * s);
      /* l'usine au pied du barrage */
      g.fillStyle = P.wallShade;
      g.fillRect(L.damX + L.damBase - 1 * s, L.damFoot - 5 * s, 9 * s, 5.5 * s);
      g.fillStyle = P.flat;
      g.fillRect(L.damX + L.damBase - 1.6 * s, L.damFoot - 6.2 * s, 10.2 * s, 1.6 * s);

      /* collines de droite (éoliennes) */
      g.beginPath();
      g.moveTo(w * 0.66, L.base);
      for (let x = w * 0.66; x <= w + 4; x += 3) {
        const y = L.base - 18 * s - ridge(x, [[w * 0.95, 46 * s, w * 0.12], [w * 0.84, 30 * s, w * 0.07]], n, 5 * s);
        g.lineTo(x, y);
      }
      g.lineTo(w + 4, L.base);
      g.closePath();
      gr = g.createLinearGradient(0, L.base - 70 * s, 0, L.base);
      gr.addColorStop(0, P.hill);
      gr.addColorStop(1, P.hillShade);
      g.fillStyle = gr;
      g.fill();

      /* mâts des éoliennes */
      for (const t of L.turb) {
        const foot = L.base - 18 * s - ridge(t.x, [[w * 0.95, 46 * s, w * 0.12], [w * 0.84, 30 * s, w * 0.07]], n, 5 * s) + 3 * s;
        g.fillStyle = P.mast;
        g.beginPath();
        g.moveTo(t.x - 1.3 * s, foot);
        g.lineTo(t.x - 0.55 * s, t.y);
        g.lineTo(t.x + 0.55 * s, t.y);
        g.lineTo(t.x + 1.3 * s, foot);
        g.closePath();
        g.fill();
        g.fillStyle = rgba('#000000', 0.12);
        g.fillRect(t.x + 0.1 * s, t.y, 0.9 * s, foot - t.y);
        g.fillStyle = P.mast;
        draw.roundRect(g, t.x - 1.6 * s, t.y - 1.4 * s, 4.6 * s, 2.8 * s, 1.2 * s);
        g.fill();
      }

      /* la plaine */
      g.beginPath();
      g.moveTo(-4, L.base);
      for (let x = -4; x <= w + 4; x += 4) {
        const y = L.base - 24 * s - (n.fbm(x * 0.012, 7.7, 3) - 0.5) * 12 * s + (x < L.damX + L.damBase * 2 ? (1 - x / (L.damX + L.damBase * 2)) * -4 * s : 0);
        g.lineTo(x, y);
      }
      g.lineTo(w + 4, L.base);
      g.closePath();
      gr = g.createLinearGradient(0, L.base - 34 * s, 0, L.base);
      gr.addColorStop(0, P.plainFar);
      gr.addColorStop(1, P.plain);
      g.fillStyle = gr;
      g.fill();
      /* ruisseau qui sort de l'usine du barrage */
      g.strokeStyle = key === 'night' ? '#2A3A70' : key === 'dusk' ? '#C88E8E' : '#7FB2DC';
      g.lineWidth = 2.2 * s;
      g.lineCap = 'round';
      streamPath(g);
      g.stroke();
      /* herbe : petites touches de lumière */
      for (let i = 0; i < 160; i++) {
        const x = rnd() * w, y = L.base - rnd() * 22 * s;
        g.fillStyle = rgba(rnd() < 0.5 ? P.plainFar : P.tree, 0.25);
        g.fillRect(x, y, 1.6 * s, 0.9 * s);
      }

      /* centrale au gaz : halle à toit en dents de scie, cheminée, réservoirs */
      const gx = L.gasX, gy = L.gasY;
      g.fillStyle = P.wallShade;
      g.beginPath();
      g.moveTo(gx, gy);
      g.lineTo(gx, gy - 11 * s);
      for (let k = 0; k < 3; k++) {
        g.lineTo(gx + k * 6.5 * s + 6.5 * s, gy - 15 * s);
        g.lineTo(gx + k * 6.5 * s + 6.5 * s, gy - 11 * s);
      }
      g.lineTo(gx + 19.5 * s, gy);
      g.closePath();
      g.fill();
      g.fillStyle = rgba('#FFFFFF', key === 'night' ? 0.05 : 0.18);
      for (let k = 0; k < 3; k++) g.fillRect(gx + k * 6.5 * s + 0.5 * s, gy - 10 * s, 5.5 * s, 2 * s);
      /* réservoirs ronds */
      for (let k = 0; k < 2; k++) {
        const tx = gx - 7 * s - k * 7.5 * s, ty = gy - 3.5 * s;
        gr = g.createRadialGradient(tx - 1.5 * s, ty - 2 * s, 0.5 * s, tx, ty, 4.5 * s);
        gr.addColorStop(0, P.concrete);
        gr.addColorStop(1, P.concreteShade);
        g.fillStyle = gr;
        g.beginPath();
        g.arc(tx, ty, 3.6 * s, Math.PI, 0);
        g.lineTo(tx + 3.6 * s, gy);
        g.lineTo(tx - 3.6 * s, gy);
        g.closePath();
        g.fill();
      }
      /* la cheminée, rayée */
      const sx = L.stackX, sw = 3.6 * s;
      gr = g.createLinearGradient(sx - sw / 2, 0, sx + sw / 2, 0);
      gr.addColorStop(0, P.stack);
      gr.addColorStop(1, P.concreteShade);
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(sx - sw * 0.62, gy);
      g.lineTo(sx - sw * 0.45, L.stackTop);
      g.lineTo(sx + sw * 0.45, L.stackTop);
      g.lineTo(sx + sw * 0.62, gy);
      g.closePath();
      g.fill();
      g.fillStyle = key === 'night' ? '#4A2E46' : '#B5503F';
      for (let k = 0; k < 2; k++) g.fillRect(sx - sw * 0.47, L.stackTop + (2 + k * 5) * s, sw * 0.94, 2 * s);

      /* centrale nucléaire : tour de refroidissement, bâtiment réacteur, salle des machines */
      const tx = L.towerX, ty = L.towerY, th = L.towerH, tw = L.towerW;
      const hw0 = tw / 2, hwT = tw * 0.33, hwW = tw * 0.27;
      g.beginPath();
      g.moveTo(tx - hw0, ty);
      g.bezierCurveTo(tx - hw0 * 0.86, ty - th * 0.45, tx - hwW, ty - th * 0.6, tx - hwW, ty - th * 0.72);
      g.bezierCurveTo(tx - hwW, ty - th * 0.85, tx - hwT * 0.98, ty - th * 0.95, tx - hwT, ty - th);
      g.lineTo(tx + hwT, ty - th);
      g.bezierCurveTo(tx + hwT * 0.98, ty - th * 0.95, tx + hwW, ty - th * 0.85, tx + hwW, ty - th * 0.72);
      g.bezierCurveTo(tx + hwW, ty - th * 0.6, tx + hw0 * 0.86, ty - th * 0.45, tx + hw0, ty);
      g.closePath();
      gr = g.createLinearGradient(tx - hw0, 0, tx + hw0, 0);
      gr.addColorStop(0, P.concrete);
      gr.addColorStop(0.55, P.concrete);
      gr.addColorStop(1, P.concreteShade);
      g.fillStyle = gr;
      g.fill();
      g.save();
      g.clip();
      for (let k = 0; k < 9; k++) {
        g.fillStyle = rgba(P.concreteShade, 0.12 + rnd() * 0.1);
        g.fillRect(tx - hw0 + rnd() * tw, ty - th, 0.8 * s, th);
      }
      g.fillStyle = rgba(P.concreteShade, 0.35);
      g.fillRect(tx - hw0, ty - 4 * s, tw, 4 * s);
      g.restore();
      g.fillStyle = P.concreteShade;
      g.beginPath();
      g.ellipse(tx, ty - th, hwT, 1.6 * s, 0, 0, TAU);
      g.fill();
      /* bâtiment du réacteur : cylindre à dôme */
      const dx = L.domeX, dw = 7.5 * s, dy = L.base - 13 * s;
      gr = g.createLinearGradient(dx - dw, 0, dx + dw, 0);
      gr.addColorStop(0, P.dome);
      gr.addColorStop(1, P.concreteShade);
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(dx - dw, dy);
      g.lineTo(dx - dw, dy - 13 * s);
      g.ellipse(dx, dy - 13 * s, dw, dw * 0.85, 0, Math.PI, 0);
      g.lineTo(dx + dw, dy);
      g.closePath();
      g.fill();
      g.fillStyle = P.wallShade;
      g.fillRect(dx - dw - 16 * s, dy - 9 * s, 16.5 * s, 9 * s);
      g.fillStyle = rgba('#FFFFFF', key === 'night' ? 0.05 : 0.2);
      g.fillRect(dx - dw - 15 * s, dy - 7.5 * s, 14 * s, 1.6 * s);

      /* arbres */
      const trees = [[0.27, 9, 4.6], [0.355, 12, 4.4], [0.7, 10, 5], [0.72, 6, 4], [0.86, 8, 4.8], [0.9, 4, 3.8], [0.985, 9, 5.2], [0.215, 16, 4.2]];
      trees.forEach(([fx, dy2, r], i) => tree(g, w * fx, L.base - dy2 * s, r * s, P, i * 1.7 + 0.4));

      /* champ de panneaux solaires */
      for (const p of panels) {
        g.fillStyle = P.steel;
        g.fillRect(p.legX, p.legY, 0.9 * s, p.legH);
        g.beginPath();
        g.moveTo(p.pts[0], p.pts[1]);
        g.lineTo(p.pts[2], p.pts[3]);
        g.lineTo(p.pts[4], p.pts[5]);
        g.lineTo(p.pts[6], p.pts[7]);
        g.closePath();
        gr = g.createLinearGradient(p.pts[0], p.pts[1], p.pts[4], p.pts[5]);
        gr.addColorStop(0, P.panelHi);
        gr.addColorStop(0.45, P.panel);
        gr.addColorStop(1, P.panel);
        g.fillStyle = gr;
        g.fill();
        g.strokeStyle = rgba(P.panelHi, 0.5);
        g.lineWidth = 0.5 * s;
        g.beginPath();
        g.moveTo((p.pts[0] + p.pts[2]) / 2, (p.pts[1] + p.pts[3]) / 2);
        g.lineTo((p.pts[6] + p.pts[4]) / 2, (p.pts[7] + p.pts[5]) / 2);
        g.stroke();
      }

      /* la ville */
      for (const b of town) paintBuilding(g, b, P, key);
      /* la route au pied de la ville */
      g.fillStyle = P.road;
      g.fillRect(L.townX0 - 10 * s, L.base - 2.2 * s, (L.townX1 - L.townX0) + 20 * s, 2.6 * s);
      g.fillStyle = P.ground;
      g.fillRect(0, L.base, w, L.consoleTop - L.base);
      /* lampadaires (mâts) */
      g.fillStyle = P.steel;
      for (const lp of lamps) {
        g.fillRect(lp.x - 0.4 * s, lp.y, 0.8 * s, L.base - lp.y);
        g.fillRect(lp.x - 0.4 * s, lp.y, 2.2 * s, 0.8 * s);
      }
      return c;
    }

    /* ---------------- La ville ---------------- */
    function makeTown() {
      const s = L.s;
      const r = seeded(11);
      town = [];
      /* rang du fond : immeubles ; rang de devant : maisons à toit de tuiles */
      let x = L.townX0 + 3 * s;
      while (x < L.townX1 - 12 * s) {
        const bw = (13 + r() * 10) * s;
        const bh = (30 + r() * 30) * s;
        town.push({ x, w: Math.min(bw, L.townX1 - x), h: bh, row: 0, roof: r() < 0.3 ? 'pitched' : 'flat', seed: r() });
        x += bw + (1.5 + r() * 3) * s;
      }
      /* une tour un peu plus haute au milieu */
      const mid = town[Math.floor(town.length / 2)];
      if (mid) { mid.h = 64 * s; mid.roof = 'flat'; mid.tall = true; }
      x = L.townX0 - 2 * s;
      while (x < L.townX1 - 8 * s) {
        const bw = (11 + r() * 8) * s;
        const bh = (12 + r() * 8) * s;
        town.push({ x, w: Math.min(bw, L.townX1 + 4 * s - x), h: bh, row: 1, roof: 'pitched', seed: r() });
        x += bw + (2.5 + r() * 4) * s;
      }
      /* fenêtres, quartiers (pour les coupures par endroits) */
      for (const b of town) {
        b.y = L.base - (b.row ? 0 : 6 * s) - b.h;
        b.yb = L.base - (b.row ? 0 : 6 * s);
        const roofH = b.roof === 'pitched' ? Math.min(b.w * 0.42, 8 * s) : 0;
        b.roofH = roofH;
        b.win = [];
        const ww = 2.4 * s, wh = 3.2 * s;
        const cols = Math.max(1, Math.floor((b.w - 3 * s) / (4.6 * s)));
        const rows2 = Math.max(1, Math.floor((b.h - roofH - 5 * s) / (6.2 * s)));
        const gx = (b.w - cols * ww) / (cols + 1);
        for (let j = 0; j < rows2; j++) {
          for (let i = 0; i < cols; i++) {
            const wx = b.x + gx + i * (ww + gx);
            const wy = b.y + roofH + 3 * s + j * 6.2 * s;
            if (wy + wh > b.yb - 2 * s) continue;
            b.win.push([wx, wy, ww, wh, r() < 0.72]);
          }
        }
        const cx = b.x + b.w / 2;
        const q = cx < lerp(L.townX0, L.townX1, 0.36) ? 0.62 : cx < lerp(L.townX0, L.townX1, 0.68) ? 0.3 : 0.88;
        b.rank = clamp(q + (r() - 0.5) * 0.16, 0.02, 0.98);
        b.pw = 0;
        b.flick = 0;
      }
      town.sort((a, b2) => a.row - b2.row);
      lamps = [];
      const nl = Math.max(4, Math.round((L.townX1 - L.townX0) / (24 * s)));
      for (let i = 0; i < nl; i++) {
        const lx = lerp(L.townX0 + 4 * s, L.townX1 - 4 * s, (i + 0.5) / nl);
        let best = town[0];
        for (const b of town) if (Math.abs(b.x + b.w / 2 - lx) < Math.abs(best.x + best.w / 2 - lx)) best = b;
        lamps.push({ x: lx, y: L.base - 9 * L.s, b: best });
      }
    }

    function paintBuilding(g, b, P, key) {
      const s = L.s;
      const front = b.row === 1;
      let gr = g.createLinearGradient(b.x, 0, b.x + b.w, 0);
      gr.addColorStop(0, front ? P.wall : mix(P.wall, P.wallShade, 0.25));
      gr.addColorStop(1, P.wallShade);
      g.fillStyle = gr;
      g.fillRect(b.x, b.y + b.roofH, b.w, b.yb - b.y - b.roofH);
      if (b.roof === 'pitched') {
        g.fillStyle = P.roof;
        g.beginPath();
        g.moveTo(b.x - 1 * s, b.y + b.roofH + 0.5 * s);
        g.lineTo(b.x + b.w / 2, b.y);
        g.lineTo(b.x + b.w + 1 * s, b.y + b.roofH + 0.5 * s);
        g.closePath();
        g.fill();
        g.fillStyle = P.roofShade;
        g.beginPath();
        g.moveTo(b.x + b.w / 2, b.y);
        g.lineTo(b.x + b.w + 1 * s, b.y + b.roofH + 0.5 * s);
        g.lineTo(b.x + b.w / 2, b.y + b.roofH + 0.5 * s);
        g.closePath();
        g.fill();
      } else {
        g.fillStyle = P.flat;
        g.fillRect(b.x - 0.6 * s, b.y - 1.4 * s, b.w + 1.2 * s, 1.8 * s);
        if (b.tall) {
          g.fillStyle = P.steel;
          g.fillRect(b.x + b.w * 0.6, b.y - 6 * s, 0.7 * s, 5 * s);
        }
      }
      /* fenêtres (vitres le jour, sombres la nuit) */
      for (const [wx, wy, ww, wh] of b.win) {
        g.fillStyle = P.glass;
        g.fillRect(wx, wy, ww, wh);
        g.fillStyle = P.glassShade;
        g.fillRect(wx, wy + wh * 0.55, ww, wh * 0.45);
      }
      if (front) {
        g.fillStyle = P.roofShade;
        g.fillRect(b.x + b.w * 0.5 - 1.3 * s, b.yb - 4.6 * s, 2.6 * s, 4.6 * s);
      }
      /* ombre portée douce à droite */
      g.fillStyle = rgba('#000000', key === 'night' ? 0.15 : 0.1);
      g.fillRect(b.x + b.w, b.y + b.roofH + 2 * s, 1.2 * s, b.yb - b.y - b.roofH - 2 * s);
    }

    /* Calques des fenêtres allumées (et éteintes) de chaque immeuble */
    function paintBuildingLights(b) {
      const s = L.s;
      const pad = 8 * s;
      const W = b.w + pad * 2, H = b.yb - b.y + pad * 2;
      const mk = () => {
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(W * cv.dpr));
        c.height = Math.max(1, Math.round(H * cv.dpr));
        const g = c.getContext('2d');
        g.scale(cv.dpr, cv.dpr);
        g.translate(pad - b.x, pad - b.y);
        return [c, g];
      };
      const [lit, g] = mk();
      for (const [wx, wy, ww, wh, isLit] of b.win) {
        if (!isLit) continue;
        draw.glow(g, wx + ww / 2, wy + wh / 2, 6 * s, '#FFC65A', 0.22);
      }
      for (const [wx, wy, ww, wh, isLit] of b.win) {
        if (!isLit) continue;
        const gr = g.createLinearGradient(0, wy, 0, wy + wh);
        gr.addColorStop(0, '#FFF0B8');
        gr.addColorStop(1, '#FFC24A');
        g.fillStyle = gr;
        g.fillRect(wx, wy, ww, wh);
      }
      const [dead, g2] = mk();
      for (const [wx, wy, ww, wh] of b.win) {
        g2.fillStyle = 'rgba(14,17,40,0.9)';
        g2.fillRect(wx, wy, ww, wh);
      }
      return { lit, dead, x: b.x - pad, y: b.y - pad, w: W, h: H };
    }

    function makePanels() {
      const s = L.s;
      panels = [];
      const x0 = L.w * 0.02, x1 = L.w * 0.285;
      for (let row = 0; row < 3; row++) {
        const y = L.base - (17 - row * 6.5) * s;
        const pw = (8.5 + row * 1.4) * s, ph = (3.6 + row * 0.6) * s, gap = (2 + row * 0.4) * s;
        const shift = row * 2 * s;
        for (let x = x0 + shift + (row === 1 ? 3 * s : 0); x + pw < x1 + row * 4 * s; x += pw + gap) {
          /* parallélogramme incliné vers le ciel */
          panels.push({
            pts: [x, y, x + pw, y, x + pw + 1.8 * s, y - ph, x + 1.8 * s, y - ph],
            legX: x + pw * 0.5, legY: y, legH: 2.8 * s,
          });
        }
      }
    }

    function paintConsole() {
      const { w, h, s } = L;
      const [c, g] = makeCanvas(h, Math.max(0, L.consoleTop - 4));
      const H = h - L.consoleTop;
      /* bord doux entre le paysage et le pupitre */
      let gr = g.createLinearGradient(0, L.consoleTop - 4, 0, L.consoleTop + 18);
      gr.addColorStop(0, 'rgba(10,14,36,0)');
      gr.addColorStop(0.25, 'rgba(10,14,36,0.85)');
      gr.addColorStop(1, '#0A0E24');
      g.fillStyle = gr;
      g.fillRect(0, L.consoleTop - 4, w, H + 4);
      /* panneau du graphique */
      draw.roundRect(g, L.chartX, L.chartY, L.chartW, L.chartH, 14);
      gr = g.createLinearGradient(0, L.chartY, 0, L.chartY + L.chartH);
      gr.addColorStop(0, '#141A3D');
      gr.addColorStop(1, '#0E1330');
      g.fillStyle = gr;
      g.fill();
      g.strokeStyle = 'rgba(238,240,251,0.09)';
      g.lineWidth = 1;
      g.stroke();
      /* lignes de repère, graduations des heures */
      const muted = api.css('--muted') || '#ABB1D6';
      const fam = getComputedStyle(document.body).fontFamily;
      g.font = `700 ${Math.round(clamp(10 * s, 10, 12))}px ${fam}`;
      g.textBaseline = 'alphabetic';
      for (let i = 0; i <= 4; i++) {
        const x = L.px + (i / 4) * L.pw;
        g.strokeStyle = 'rgba(238,240,251,0.07)';
        g.beginPath();
        g.moveTo(x + 0.5, L.py - 2);
        g.lineTo(x + 0.5, L.py + L.ph);
        g.stroke();
        const t = TEXTES.graduations[i];
        g.fillStyle = muted;
        g.textAlign = i === 0 ? 'left' : i === 4 ? 'right' : 'center';
        g.fillText(t, x, L.chartY + L.chartH - 4);
      }
      g.strokeStyle = 'rgba(238,240,251,0.16)';
      g.beginPath();
      g.moveTo(L.px, L.py + L.ph + 0.5);
      g.lineTo(L.px + L.pw, L.py + L.ph + 0.5);
      g.stroke();
      return c;
    }

    function paintStars() {
      const [c, g] = makeCanvas(L.sunH);
      const r = seeded(5);
      for (let i = 0; i < 90; i++) {
        const x = r() * L.w, y = Math.pow(r(), 1.4) * (L.sunH - 10);
        const sz = 0.5 + r() * 1.2;
        g.fillStyle = `rgba(235,240,255,${0.25 + r() * 0.6})`;
        g.fillRect(x, y, sz, sz);
      }
      return c;
    }

    function paintPuff(light, shade) {
      const c = document.createElement('canvas');
      const R = 32;
      c.width = c.height = R * 2;
      const g = c.getContext('2d');
      const gr = g.createRadialGradient(R * 0.8, R * 0.75, 2, R, R, R);
      gr.addColorStop(0, light);
      gr.addColorStop(0.6, rgba(shade, 0.85));
      gr.addColorStop(1, rgba(shade, 0));
      g.fillStyle = gr;
      draw.blob(g, R, R, R * 0.92, 0.12, 2.3, 0, 22);
      g.fill();
      return c;
    }

    function paintCloudSet(light, shade) {
      const out = [];
      for (let k = 0; k < 3; k++) {
        const c = document.createElement('canvas');
        const W = 120, H = 52;
        c.width = W * 2;
        c.height = H * 2;
        const g = c.getContext('2d');
        g.scale(2, 2);
        const r = seeded(20 + k * 7);
        /* un nuage plat : des boules douces posées sur une base horizontale */
        g.save();
        g.beginPath();
        g.rect(0, 0, W, 34);
        g.clip();
        for (let i = 0; i < 9; i++) {
          const t = i / 8;
          const x = 14 + t * 92 + (r() - 0.5) * 6;
          const rr = (6 + 9 * Math.sin(Math.PI * t) + r() * 4);
          const y = 33 - rr * 0.55;
          const gr = g.createRadialGradient(x - rr * 0.25, y - rr * 0.45, 1, x, y, rr);
          gr.addColorStop(0, rgba(light, 0.9));
          gr.addColorStop(0.75, rgba(shade, 0.55));
          gr.addColorStop(1, rgba(shade, 0));
          g.fillStyle = gr;
          g.beginPath();
          g.arc(x, y, rr, 0, TAU);
          g.fill();
        }
        g.restore();
        const base = g.createLinearGradient(0, 28, 0, 36);
        base.addColorStop(0, rgba(shade, 0.35));
        base.addColorStop(1, rgba(shade, 0));
        g.fillStyle = base;
        g.fillRect(12, 28, 96, 8);
        out.push(c);
      }
      return out;
    }

    function makeClouds() {
      const s = L.s;
      const r = seeded(13);
      clouds = [0, 1, 2].map((k) => ({
        k, x: (k / 3 + r() * 0.12) * (L.w + 120 * s), y: L.sunTop - 18 * s + (0.05 + ((k * 2) % 3) * 0.16) * (L.sunH - L.sunTop),
        sc: (0.42 + r() * 0.2) * s, sp: 0.6 + r() * 0.5,
      }));
    }

    /* ---------------- Simulation ---------------- */
    function causeNow(h) {
      if (!ORDER.some((k) => on[k])) return damUsed && water <= 0 ? 'barrage' : 'noir';
      if (damUsed && water <= 0.001) return 'barrage';
      if (on.nucleaire && ramp < 0.98) return 'demarrage';
      if (on.eolien && windNow < 10) return 'vent';
      if (on.solaire && (h >= 17 || h < 6)) return 'soir';
      if (on.solaire && h < 10) return 'matin';
      if (h >= 17 || h < 1) return 'pointe';
      return 'peu';
    }

    function simulate(dt) {
      const running = phase === 'day' && !infoOpen;
      if (running) dayT = Math.min(JOUR, dayT + dt);
      hour = phase === 'day' ? (H0 + dayT) % 24 : H0;
      windNow = windAt(clock, hour);
      if (on.nucleaire) {
        if (phase !== 'day') ramp = 1;
        else if (running) ramp = Math.min(1, ramp + dt / RAMPE);
      } else {
        ramp = 0;
      }
      need = consumption(hour);
      prod.nucleaire = on.nucleaire ? P_NUC * ramp : 0;
      prod.solaire = on.solaire ? solarAt(hour) : 0;
      prod.eolien = on.eolien ? windNow : 0;
      prod.barrage = on.barrage && water > 0 ? P_BAR : 0;
      lowCarbon = prod.nucleaire + prod.solaire + prod.eolien + prod.barrage;
      prod.gaz = on.gaz ? clamp(need - lowCarbon, 0, P_GAZ) : 0;
      total = lowCarbon + prod.gaz;
      ratio = total / need;
      co2Rate = 0;
      if (!running) return;
      if (prod.barrage > 0) {
        damUsed = true;
        water -= prod.barrage * dt / RESERVE;
        if (water <= 0) {
          water = 0;
          damEmptied();
        }
      }
      const f = lowCarbon > need ? need / lowCarbon : 1;
      co2Rate = (prod.nucleaire * 12 + prod.solaire * 45 + prod.eolien * 11 + prod.barrage * 24) * f + prod.gaz * 490;
      co2 += co2Rate * dt;
      const u = Math.max(0, need - total);
      unmet += u * dt;
      demandSum += need * dt;
      if (u > 0.3) {
        const c = causeNow(hour);
        causes[c] = (causes[c] || 0) + u * dt;
      }
      record();
      if (dayT >= JOUR) endDay();
    }

    function record() {
      const i = Math.min(NS - 1, Math.floor(dayT / JOUR * NS));
      while (recN <= i) {
        const o = recN * 7;
        for (let j = 0; j < 5; j++) rec[o + j] = prod[STACK[j]];
        rec[o + 5] = need;
        rec[o + 6] = Math.max(0, need - total);
        recN++;
      }
    }

    function damEmptied() {
      on.barrage = false;
      chips.barrage.wrap.classList.add('is-empty');
      chips.barrage.b.setAttribute('aria-disabled', 'true');
      refreshChip('barrage');
      damMsgT = 2.6;
      api.sfx.play('thud', { pitch: 0.8 });
    }

    /* ---------------- Déroulement ---------------- */
    function startDay() {
      closeInfo();
      phase = 'day';
      dayT = 0;
      water = 1;
      refill = 0;
      damUsed = false;
      damMsgT = 0;
      co2 = 0;
      co2Shown = 0;
      unmet = 0;
      demandSum = 0;
      causes = {};
      recN = 0;
      gustSeed = (gustSeed * 7 + 3) % 997;
      makeGust(gustSeed);
      if (on.nucleaire) ramp = 1;
      chips.barrage.wrap.classList.remove('is-empty');
      chips.barrage.b.removeAttribute('aria-disabled');
      setLaunch(false);
      api.gesture(null);
      clearTimeout(reGesture);
      api.hint(TEXTES.consigneJour);
      shownStatus = '';
      api.sfx.play('chime', { pitch: 1.05 });
      api.buzz(10);
      if (!RMo) rings.push({ x: L.w * 0.08, y: L.sunH, t: 0, col: '#FFD27A', big: true });
    }

    function endDay() {
      phase = 'end';
      hour = H0;
      /* le lac se remplit pour la journée suivante */
      refill = water < 1 ? 1.6 : 0;
      chips.barrage.wrap.classList.remove('is-empty');
      chips.barrage.b.removeAttribute('aria-disabled');
      const ur = unmet / Math.max(1, demandSum);
      const okElec = ur <= TOLERANCE;
      const okCo2 = co2 <= CO2_MAX;
      setLaunch(true, TEXTES.recommencer, AGAIN_SVG);
      if (okElec && okCo2) {
        if (!api.isDone()) {
          api.done(TEXTES.fin, TEXTES.finStatut);
        } else {
          api.hint(TEXTES.fin);
          api.status(TEXTES.finStatut);
          api.sfx.play('success', { gap: 0 });
        }
        shownStatus = '#fin';
        for (const k of ORDER) if (on[k]) rings.push({ x: L.anchor[k][0], y: L.anchor[k][1], t: 0, col: COL[k] });
        return;
      }
      let cause = 'co2';
      if (!okElec) {
        let best = -1;
        for (const k in causes) if (causes[k] > best) { best = causes[k]; cause = k; }
        if (best < 0) cause = 'peu';
      }
      api.hint(TEXTES.consigneEchec);
      api.status(TEXTES.causes[cause]);
      shownStatus = '#fin';
      api.progress(0.92);
      api.sfx.play('fail');
      api.buzz(14);
    }

    function setLaunch(show, label, icon) {
      if (show) {
        launchTx.textContent = label;
        launchIc.innerHTML = icon;
        launch.classList.remove('is-gone');
        launch.classList.toggle('is-pulse', !RMo);
        launch.disabled = false;
      } else {
        launch.classList.add('is-gone');
        launch.classList.remove('is-pulse');
        launch.disabled = true;
      }
    }

    /* le doigt fantôme se pose sur l'icône du bouton, pour laisser le texte lisible */
    function showLaunchGesture() {
      const y = (parseFloat(launch.style.top) || L.consoleTop * 0.42) / L.h * 100;
      const sr = stage.getBoundingClientRect(), ir = launch.querySelector('svg');
      let x = 50;
      if (ir && sr.width) {
        const r = ir.getBoundingClientRect();
        if (r.width) x = (r.left + r.width / 2 - sr.left) / sr.width * 100;
      }
      api.gesture('tap', { x, y });
    }

    /* ---------------- Interaction ---------------- */
    function refreshChip(k) {
      const c = chips[k];
      c.wrap.classList.toggle('is-on', on[k]);
      c.b.setAttribute('aria-pressed', String(on[k]));
    }

    function toggle(k) {
      if (k === 'barrage' && water <= 0 && phase === 'day') {
        bump(k);
        damMsgT = 2.2;
        api.sfx.play('fail', { volume: 0.6 });
        return;
      }
      on[k] = !on[k];
      if (k === 'nucleaire' && on[k]) ramp = phase === 'day' ? 0 : 1;
      refreshChip(k);
      bump(k);
      const [ax, ay] = L.anchor[k];
      rings.push({ x: ax, y: ay, t: 0, col: on[k] ? COL[k] : '#9AA1C4' });
      api.sfx.play(on[k] ? 'pop' : 'tick', { pitch: on[k] ? 1.15 : 0.8 });
      api.buzz(8);
      if (phase === 'idle' && gestureAgain) {
        gestureAgain = false;
        clearTimeout(reGesture);
        reGesture = setTimeout(() => {
          if (phase === 'idle' && !stage.querySelector('.gesture')) showLaunchGesture();
        }, 1500);
      }
      if (phase === 'idle') api.hint(TEXTES.consigneAvant);
    }

    function bump(k) {
      if (RMo) return;
      const w = chips[k].wrap;
      w.classList.remove('is-bump');
      void w.offsetWidth;
      w.classList.add('is-bump');
    }

    function placeTip(k) {
      const c = chips[k].wrap;
      const sr = stage.getBoundingClientRect();
      const r = c.getBoundingClientRect();
      const tw = tip.offsetWidth || Math.min(312, L.w - 16);
      const cx = r.left - sr.left + r.width / 2;
      const left = clamp(cx - tw / 2, 8, L.w - 8 - tw);
      tip.style.left = left + 'px';
      tip.style.setProperty('--mx-ax', clamp(cx - left, 18, tw - 18) + 'px');
    }

    function openInfo(k) {
      const S = TEXTES.sources[k];
      tip.style.setProperty('--mx-k', INK[k]);
      tipName.textContent = S.nom;
      tipDesc.innerHTML = withSub(S.desc);
      tipCo2.innerHTML = withSub(TEXTES.co2Ligne(lib.num(S.co2)));
      for (const kk of INFO_ORDER) rows[kk].classList.toggle('is-sel', kk === k);
      tip.classList.add('is-on');
      infoOpen = k;
      infoT = 0;
      placeTip(k);
      api.gesture(null);
      api.sfx.play('bubble', { pitch: 1.1 });
      api.buzz(6);
    }
    function closeInfo() {
      if (!infoOpen) return;
      infoOpen = null;
      tip.classList.remove('is-on');
    }

    ORDER.forEach((k) => {
      const { b, i } = chips[k];
      b.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        suppressClick = false;
        clearTimeout(longTimer);
        longTimer = setTimeout(() => {
          longTimer = 0;
          suppressClick = true;
          openInfo(k);
        }, 480);
      });
      const cancel = () => { clearTimeout(longTimer); longTimer = 0; };
      b.addEventListener('pointerup', cancel);
      b.addEventListener('pointercancel', cancel);
      b.addEventListener('pointerleave', cancel);
      b.addEventListener('contextmenu', (e) => e.preventDefault());
      b.addEventListener('click', () => {
        if (suppressClick) { suppressClick = false; return; }
        toggle(k);
      });
      i.addEventListener('click', () => {
        /* la tape qui vient de fermer cette même étiquette ne la rouvre pas */
        if (closedFor === k && performance.now() - closedAt < 600) return;
        openInfo(k);
      });
    });
    let closedAt = -1e9, closedFor = null;
    /* toute nouvelle tape ferme l'étiquette */
    stage.addEventListener('pointerdown', () => {
      if (!infoOpen) return;
      closedFor = infoOpen;
      closedAt = performance.now();
      closeInfo();
    }, true);
    launch.addEventListener('click', () => {
      if (phase === 'day') return;
      startDay();
    });

    /* ---------------- Rendu ---------------- */
    function tod(cDay, cDusk, cNight, a = 1) {
      if (sunE >= 0) return mix(cDusk, cDay, smooth(0, 0.3, sunE), a);
      return mix(cDusk, cNight, smooth(0, -0.22, sunE), a);
    }

    function blendLayer(set) {
      const y0 = set[0].y0, hh = set[0].hh;
      const other = sunE >= 0 ? set[0] : set[2];
      const t = sunE >= 0 ? smooth(0, 0.3, sunE) : smooth(0, -0.22, sunE);
      if (t < 0.999) ctx.drawImage(set[1], 0, y0, L.w, hh);
      if (t > 0.001) {
        ctx.globalAlpha = t;
        ctx.drawImage(other, 0, y0, L.w, hh);
        ctx.globalAlpha = 1;
      }
    }

    function drawSky() {
      const u = invLerp(-0.4, 1, sunE);
      const gr = ctx.createLinearGradient(0, 0, 0, L.base);
      gr.addColorStop(0, lib.ramp(SKY_STOPS[0], u));
      gr.addColorStop(0.55, lib.ramp(SKY_STOPS[1], u));
      gr.addColorStop(1, lib.ramp(SKY_STOPS[2], u));
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, L.w, L.consoleTop);
      if (nightW > 0.01) {
        ctx.globalAlpha = nightW;
        ctx.drawImage(layers.stars, 0, 0, L.w, L.sunH);
        ctx.globalAlpha = 1;
      }
      const s = L.s;
      /* soleil */
      if (sunE > -0.12) {
        const k = clamp((hour - RISE) / SPAN);
        const x = lerp(L.w * 0.03, L.w * 0.97, k);
        const y = L.sunH - sunE * (L.sunH - L.sunTop);
        const low = 1 - smooth(0, 0.35, sunE);
        const col = mix('#FFF3C4', '#FF9A4A', low);
        ctx.globalCompositeOperation = 'lighter';
        draw.glow(ctx, x, y, 70 * s, low > 0.5 ? '#FF8A50' : '#FFE7A8', 0.28 + low * 0.2);
        ctx.globalCompositeOperation = 'source-over';
        draw.glow(ctx, x, y, 16 * s, '#FFF6D8', 0.5);
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(x, y, 8.5 * s, 0, TAU);
        ctx.fill();
      }
      /* lune */
      if (nightW > 0.02) {
        const m = (((hour - 20) + 24) % 24) / 10;
        if (m >= 0 && m <= 1) {
          const x = lerp(L.w * 0.08, L.w * 0.92, m);
          const y = L.sunH - Math.sin(Math.PI * m) * (L.sunH - L.sunTop - 6 * s);
          ctx.globalAlpha = nightW;
          draw.glow(ctx, x, y, 30 * s, '#AFC0FF', 0.22);
          ctx.fillStyle = '#E6EBFF';
          ctx.beginPath();
          ctx.arc(x, y, 6.5 * s, 0, TAU);
          ctx.fill();
          ctx.fillStyle = 'rgba(160,172,215,0.5)';
          ctx.beginPath();
          ctx.arc(x - 2 * s, y - 1.2 * s, 1.4 * s, 0, TAU);
          ctx.arc(x + 1.8 * s, y + 1.6 * s, 1 * s, 0, TAU);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
      /* nuages (plus rapides quand il y a du vent), teintés selon l'heure */
      const set = layers.cloud;
      const toDay = sunE >= 0;
      const t = toDay ? smooth(0, 0.3, sunE) : smooth(0, -0.22, sunE);
      const other = toDay ? set[0] : set[2], aOther = toDay ? 0.8 : 0.28;
      for (const c of clouds) {
        const cw = 120 * c.sc * 1.4, ch = 52 * c.sc * 1.4;
        const x = ((c.x % (L.w + cw)) + L.w + cw) % (L.w + cw) - cw;
        if (t < 0.999) { ctx.globalAlpha = 0.62 * (1 - t); ctx.drawImage(set[1][c.k], x, c.y, cw, ch); }
        if (t > 0.001) { ctx.globalAlpha = aOther * t; ctx.drawImage(other[c.k], x, c.y, cw, ch); }
        ctx.globalAlpha = 1;
      }
    }

    function drawLake() {
      const s = L.s;
      const wy = lerp(L.lkB + 1 * s, L.lkT, water);
      if (water <= 0.002) return;
      ctx.save();
      lakePath(ctx);
      ctx.clip();
      const gr = ctx.createLinearGradient(0, wy, 0, L.lkB);
      gr.addColorStop(0, tod('#78B4E6', '#D8968E', '#2C3C78'));
      gr.addColorStop(1, tod('#2F5F98', '#4E3F70', '#141C42'));
      ctx.fillStyle = gr;
      ctx.fillRect(L.lkX0 - 2, wy, L.lkX1 - L.lkX0 + 4, L.lkB - wy + 4);
      ctx.restore();
      /* reflet à la surface */
      ctx.strokeStyle = rgba('#FFFFFF', 0.45 - nightW * 0.25);
      ctx.lineWidth = 1;
      ctx.beginPath();
      const x0 = lerp(L.lkX0, L.lkX0 + (L.lkX1 - L.lkX0) * 0.5, 1 - water) + 3 * s;
      ctx.moveTo(x0, wy + 0.5);
      ctx.lineTo(L.lkX1, wy + 0.5);
      ctx.stroke();
      const sh = (time * 8) % 16;
      ctx.strokeStyle = rgba('#FFFFFF', 0.3 - nightW * 0.15);
      for (let x = x0 + sh; x < L.lkX1 - 4 * s; x += 16 * s) {
        ctx.beginPath();
        ctx.moveTo(x, wy + 2.5 * s);
        ctx.lineTo(x + 4 * s, wy + 2.5 * s);
        ctx.stroke();
      }
    }

    function drawDynamic(dt) {
      const s = L.s;
      /* eau qui sort du barrage */
      const damOn = prod.barrage > 0;
      if (damOn) {
        ctx.strokeStyle = rgba('#FFFFFF', 0.75);
        ctx.lineWidth = 1.4 * s;
        ctx.setLineDash([2.5 * s, 4 * s]);
        ctx.lineDashOffset = -time * 28 * s;
        streamPath(ctx);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      for (const f of foam) {
        const k = f.t / f.life;
        ctx.fillStyle = rgba('#FFFFFF', 0.8 * (1 - k));
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * (0.6 + k), 0, TAU);
        ctx.fill();
      }

      /* panneaux : éteints (voile) ou brillants au soleil */
      if (panels.length) {
        if (!on.solaire) {
          ctx.fillStyle = rgba('#1F2333', 0.42);
          panelPath();
          ctx.fill();
        } else if (sunE > 0) {
          ctx.save();
          panelPath();
          ctx.clip();
          const sx = lerp(L.w * 0.0, L.w * 0.3, (time * 0.12) % 1.4);
          const gr = ctx.createLinearGradient(sx - 20 * s, 0, sx + 20 * s, 0);
          const a = 0.5 * smooth(0, 0.3, sunE);
          gr.addColorStop(0, 'rgba(255,255,255,0)');
          gr.addColorStop(0.5, `rgba(255,248,220,${a})`);
          gr.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = gr;
          ctx.fillRect(0, L.base - 30 * s, L.w * 0.4, 32 * s);
          ctx.restore();
        }
      }

      /* rotors des éoliennes */
      const target = on.eolien ? 0.8 + windNow / 36 * 6 : 0;
      rotorW += (target - rotorW) * Math.min(1, dt * (on.eolien ? 1.5 : 0.8));
      const bladeCol = tod('#F6F7FA', '#F2D3C4', '#7880AC');
      for (let i = 0; i < L.turb.length; i++) {
        const t = L.turb[i];
        rotor[i] += rotorW * dt * (1 + i * 0.07);
        ctx.save();
        ctx.translate(t.x + 0.8 * s, t.y);
        ctx.rotate(rotor[i] + t.ph);
        ctx.fillStyle = bladeCol;
        for (let k = 0; k < 3; k++) {
          ctx.rotate(TAU / 3);
          ctx.beginPath();
          ctx.moveTo(-1.1 * s, 0);
          ctx.quadraticCurveTo(-1.3 * s, -t.r * 0.45, -0.25 * s, -t.r);
          ctx.lineTo(0.35 * s, -t.r);
          ctx.quadraticCurveTo(0.9 * s, -t.r * 0.4, 1.1 * s, 0);
          ctx.closePath();
          ctx.fill();
        }
        ctx.fillStyle = tod('#D9DCE4', '#E0BFAF', '#5C648E');
        ctx.beginPath();
        ctx.arc(0, 0, 1.5 * s, 0, TAU);
        ctx.fill();
        ctx.restore();
        if (nightW > 0.05) {
          const blink = Math.sin(time * 2.6 + i) > 0.55 ? 1 : 0.18;
          draw.glow(ctx, t.x + 0.8 * s, t.y - 1.6 * s, 4 * s, '#FF3B3B', 0.9 * nightW * blink);
        }
      }

      /* panache de vapeur de la tour */
      const pIdx = nightW > 0.5 ? 1 : 0;
      for (const p of puffs) {
        const k = p.t / p.life;
        const a = Math.min(1, p.t * 4) * (1 - k) * 0.85;
        const r = p.r0 + (p.r1 - p.r0) * ease.outCubic(k);
        ctx.globalAlpha = a * (1 - nightW * 0.35);
        ctx.drawImage(layers.puff[pIdx], p.x - r, p.y - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
      /* fumée claire de la cheminée */
      for (const p of exhaust) {
        const k = p.t / p.life;
        const r = p.r0 + 8 * s * k;
        ctx.globalAlpha = Math.min(1, p.t * 4) * (1 - k) * 0.35;
        ctx.drawImage(layers.puff[pIdx], p.x - r, p.y - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
      if (prod.gaz > 0.5) draw.glow(ctx, L.stackX, L.stackTop, 6 * s, '#FF9A50', 0.25 + 0.4 * nightW);

      /* lumières de la ville */
      const occ = clamp(0.35 + 0.65 * (need - 46) / 46);
      const lightA = lerp(0.2, 1, darkW) * lerp(0.75, 1, occ);
      for (let i = 0; i < town.length; i++) {
        const b = town[i], lay = layers.town[i];
        let pw = b.pw;
        if (b.flick > 0) pw *= Math.sin(time * 70 + i) > 0 ? 1 : 0.15;
        if (pw > 0.01) {
          ctx.globalAlpha = pw * lightA;
          ctx.drawImage(lay.lit, lay.x, lay.y, lay.w, lay.h);
        }
        if (pw < 0.99 && dayW > 0.02) {
          ctx.globalAlpha = (1 - pw) * dayW * 0.8;
          ctx.drawImage(lay.dead, lay.x, lay.y, lay.w, lay.h);
        }
      }
      ctx.globalAlpha = 1;
      if (darkW > 0.05) {
        ctx.globalCompositeOperation = 'lighter';
        const r1 = 9 * s, r2 = 7 * s;
        for (const lp of lamps) {
          const a = lp.b.pw * darkW;
          if (a < 0.02) continue;
          ctx.globalAlpha = 0.45 * a;
          ctx.drawImage(layers.lamp, lp.x + 1.6 * s - r1, lp.y + 1.5 * s - r1, r1 * 2, r1 * 2);
          ctx.globalAlpha = 0.2 * a;
          ctx.drawImage(layers.lampG, lp.x + 1.6 * s - r2, L.base - 1 * s - r2, r2 * 2, r2 * 2);
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
    }

    function panelPath() {
      ctx.beginPath();
      for (const p of panels) {
        ctx.moveTo(p.pts[0], p.pts[1]);
        ctx.lineTo(p.pts[2], p.pts[3]);
        ctx.lineTo(p.pts[4], p.pts[5]);
        ctx.lineTo(p.pts[6], p.pts[7]);
        ctx.closePath();
      }
    }

    /* une molécule de CO2 : un atome de carbone entre deux atomes d'oxygène */
    function molecule(x, y, r, a, ang, cC, cO) {
      const dx = Math.cos(ang) * r * 1.55, dy = Math.sin(ang) * r * 1.55;
      ctx.globalAlpha = a;
      ctx.fillStyle = cO;
      ctx.beginPath();
      ctx.arc(x - dx, y - dy, r * 0.82, 0, TAU);
      ctx.arc(x + dx, y + dy, r * 0.82, 0, TAU);
      ctx.fill();
      ctx.fillStyle = cC;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.arc(x - r * 0.3, y - r * 0.35, r * 0.32, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    function drawMolecules() {
      if (!mols.length) return;
      const cC = tod('#4A4E5C', '#5A4E5C', '#9AA1C4');
      const cO = tod('#D9574A', '#E06A55', '#F08A7C');
      for (const m of mols) {
        const k = m.t / m.life;
        const a = Math.min(1, m.t * 3) * (k > 0.75 ? (1 - k) / 0.25 : 1) * 0.9;
        molecule(m.x, m.y, m.r, a, m.ang, cC, cO);
      }
    }

    function drawRings() {
      for (const r of rings) {
        const k = r.t / (r.big ? 1.1 : 0.7);
        ctx.strokeStyle = rgba(r.col, 0.85 * (1 - k));
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(r.x, r.y, lerp(5, (r.big ? 70 : 30) * L.s, ease.outCubic(k)), 0, TAU);
        ctx.stroke();
      }
    }

    function drawChart() {
      const con = layers.console;
      ctx.drawImage(con, 0, con.y0, L.w, con.hh);
      const { px, py, pw, ph } = L;
      const Y = (v) => py + ph - clamp(v / 118) * ph;
      const X = (i) => px + (i + 0.5) / NS * pw;
      /* aires empilées de la production */
      if (recN > 1) {
        for (let j = 0; j < 5; j++) {
          ctx.beginPath();
          for (let i = 0; i < recN; i++) {
            let cum = 0;
            for (let q = 0; q <= j; q++) cum += rec[i * 7 + q];
            if (i === 0) ctx.moveTo(X(i), Y(cum));
            else ctx.lineTo(X(i), Y(cum));
          }
          for (let i = recN - 1; i >= 0; i--) {
            let cum = 0;
            for (let q = 0; q < j; q++) cum += rec[i * 7 + q];
            ctx.lineTo(X(i), Y(cum));
          }
          ctx.closePath();
          ctx.fillStyle = rgba(COL[STACK[j]], 0.88);
          ctx.fill();
        }
        /* manque : en rouge entre la production et la consommation */
        ctx.fillStyle = 'rgba(255,93,108,0.75)';
        for (let i = 0; i < recN; i++) {
          const u = rec[i * 7 + 6];
          if (u < 0.3) continue;
          const d = rec[i * 7 + 5];
          const x = X(i) - pw / NS / 2;
          ctx.fillRect(x, Y(d), pw / NS + 0.6, Y(d - u) - Y(d));
        }
      }
      /* consommation : pointillés pour la suite de la journée */
      const cut = phase === 'idle' ? 0 : phase === 'end' ? 96 : Math.floor(dayT / JOUR * 96);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(238,240,251,0.5)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      for (let i = cut; i <= 96; i++) {
        const x = px + i / 96 * pw, y = Y(consoLine[i]);
        if (i === cut) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      if (cut > 0) {
        ctx.strokeStyle = '#EEF0FB';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i <= cut; i++) {
          const x = px + i / 96 * pw, y = Y(consoLine[i]);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      /* curseur de l'heure */
      if (phase === 'day') {
        const x = px + dayT / JOUR * pw;
        ctx.strokeStyle = 'rgba(238,240,251,0.55)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 0.5, py - 3);
        ctx.lineTo(x + 0.5, py + ph);
        ctx.stroke();
        const y = Y(need);
        ctx.fillStyle = ratio < 0.985 ? '#FF5D6C' : '#F2C230';
        ctx.beginPath();
        ctx.arc(x, y, 3.2, 0, TAU);
        ctx.fill();
      }
    }

    function render(dt) {
      /* pas besoin d'effacer : le ciel puis le pupitre recouvrent tout le canevas */
      drawSky();
      blendLayer(layers.back);
      drawLake();
      blendLayer(layers.front);
      drawDynamic(dt);
      drawMolecules();
      drawRings();
      drawChart();
    }

    /* ---------------- Mise à jour des effets ---------------- */
    function effects(dt) {
      const s = L.s;
      sunE = sunElev(hour);
      dayW = smooth(0, 0.3, sunE);
      nightW = smooth(-0.02, -0.22, sunE);
      darkW = 1 - smooth(-0.04, 0.22, sunE);
      /* nuages */
      for (const c of clouds) c.x += (RMo ? 2 : 4 + windNow * 0.55) * c.sp * s * dt;
      /* vapeur : plus la centrale est à pleine puissance, plus le panache est gros */
      if (on.nucleaire && ramp > 0.02) {
        puffAcc += dt * (1.5 + 4.5 * ramp);
        while (puffAcc > 1 && puffs.length < 28) {
          puffAcc -= 1;
          puffs.push({ x: L.towerX + (Math.random() - 0.5) * L.towerW * 0.4, y: L.towerY - L.towerH, t: 0, life: 2.8 + Math.random() * 1.6,
            r0: (5 + 3 * ramp) * s, r1: (13 + 8 * ramp) * s, vy: -(9 + 6 * ramp) * s });
        }
      }
      let j = 0;
      for (const p of puffs) {
        p.t += dt;
        if (p.t >= p.life) continue;
        p.y += p.vy * dt;
        p.x += (2 + windNow * 0.35) * s * dt;
        puffs[j++] = p;
      }
      puffs.length = j;
      /* gaz : fumée claire et molécules de CO2 */
      if (prod.gaz > 0.5) {
        exhAcc += dt * (1 + prod.gaz * 0.05);
        while (exhAcc > 1 && exhaust.length < 16) {
          exhAcc -= 1;
          exhaust.push({ x: L.stackX, y: L.stackTop - 1 * s, t: 0, life: 1.8, r0: 3 * s });
        }
        molAcc += dt * (0.6 + prod.gaz * 0.1);
        while (molAcc > 1) {
          molAcc -= 1;
          if (mols.length >= 130) mols.shift();
          mols.push({ x: L.stackX + (Math.random() - 0.5) * 3 * s, y: L.stackTop - 2 * s, vx: 0, vy: -(16 + Math.random() * 10) * s,
            t: 0, life: 20 + Math.random() * 8, r: (2.1 + Math.random() * 0.7) * s, ang: Math.random() * TAU, va: (Math.random() - 0.5) * 1.6,
            top: L.sunTop - 18 * s + Math.random() * (L.sunH - L.sunTop) * 0.6 });
        }
      }
      j = 0;
      for (const p of exhaust) {
        p.t += dt;
        if (p.t >= p.life) continue;
        p.y -= 10 * s * dt;
        p.x += (1 + windNow * 0.3) * s * dt;
        exhaust[j++] = p;
      }
      exhaust.length = j;
      j = 0;
      for (const m of mols) {
        m.t += dt;
        if (m.t >= m.life) continue;
        /* elles montent puis s'étalent dans le ciel */
        if (m.y > m.top) m.y += m.vy * dt;
        else m.vy *= 0.9;
        m.x += (2 + windNow * 0.45) * s * dt * (m.y > m.top ? 0.4 : 1);
        m.y += Math.sin(time * 1.3 + m.ang) * 2 * s * dt;
        m.ang += m.va * dt;
        if (m.x > L.w + 10) m.x -= L.w + 20;
        mols[j++] = m;
      }
      mols.length = j;
      /* écume au pied du barrage */
      if (prod.barrage > 0) {
        foamAcc += dt * 14;
        while (foamAcc > 1 && foam.length < 30) {
          foamAcc -= 1;
          foam.push({ x: L.damX + L.damBase + 8 * s + Math.random() * 3 * s, y: L.damFoot - 1 - Math.random() * 2 * s, t: 0, life: 0.6 + Math.random() * 0.4, r: (0.7 + Math.random() * 0.9) * s,
            vx: (5 + Math.random() * 7) * s, vy: -(2 + Math.random() * 6) * s });
        }
      }
      j = 0;
      for (const f of foam) {
        f.t += dt;
        if (f.t >= f.life) continue;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.vy += 30 * s * dt;
        foam[j++] = f;
      }
      foam.length = j;
      /* anneaux */
      j = 0;
      for (const r of rings) {
        r.t += dt;
        if (r.t >= (r.big ? 1.1 : 0.7)) continue;
        rings[j++] = r;
      }
      rings.length = j;
      /* ville : quels quartiers ont du courant ? */
      const frac = ratio >= 0.985 ? 1 : clamp((ratio - 0.45) / 0.55) * 0.94;
      for (const b of town) {
        const want = b.rank < frac ? 1 : 0;
        if (want === 0 && b.pw > 0.5 && b.flick <= 0 && !RMo) b.flick = 0.32;
        if (b.flick > 0) b.flick -= dt;
        b.pw += (want - b.pw) * Math.min(1, dt * (want ? 5 : 9));
      }
      if (damMsgT > 0) damMsgT -= dt;
      if (refill > 0 && phase === 'end') {
        refill = Math.max(0, refill - dt);
        water = Math.min(1, water + dt / 1.2);
        if (water >= 1) refill = 0;
      }
      if (infoOpen) {
        infoT += dt;
        if (infoT > 9) closeInfo();
      }
    }

    function updateDom(dt) {
      const ev = clamp(ratio * 0.75);
      elecShown += (ev - elecShown) * Math.min(1, dt * 8);
      fElec.style.transform = `scaleX(${elecShown.toFixed(4)})`;
      gElec.classList.toggle('is-low', ratio < 0.985);
      const cv2 = clamp(co2 / CO2_PLEIN);
      co2Shown += (cv2 - co2Shown) * Math.min(1, dt * 8);
      fCo2.style.transform = `scaleX(${co2Shown.toFixed(4)})`;
      gCo2.classList.toggle('is-warn', co2 > CO2_MAX * 0.8 && co2 <= CO2_MAX);
      gCo2.classList.toggle('is-low', co2 > CO2_MAX);
      gCo2.classList.toggle('is-fast', !RMo && co2Rate > 4000);
      /* réserve d'eau dans l'icône du barrage */
      const lv = (water * 18).toFixed(1);
      const wEl = chips.barrage.water;
      if (wEl.dataset.lv !== lv) {
        wEl.dataset.lv = lv;
        wEl.setAttribute('y', (29.5 - water * 18).toFixed(2));
        wEl.setAttribute('height', lv);
      }
      if (phase === 'day') {
        const hh = Math.floor(hour);
        let msg = TEXTES.ok;
        if (damMsgT > 0) msg = TEXTES.barrageVide;
        else if (ratio < 0.985) msg = TEXTES.manque;
        else if (on.nucleaire && ramp < 1) msg = TEXTES.demarre;
        else if (prod.gaz > 3) msg = TEXTES.gazCo2;
        const st = TEXTES.heure(hh, msg);
        if (st !== shownStatus) {
          shownStatus = st;
          api.status(st);
        }
        const pr = Math.round(dayT / JOUR * 92) / 100;
        if (pr !== shownProg) {
          shownProg = pr;
          api.progress(pr);
        }
      }
    }

    /* ---------------- Boucle ---------------- */
    api.loop((dt) => {
      time += dt;
      clock += dt;
      simulate(dt);
      effects(dt);
      updateDom(dt);
      render(dt);
    });

    function init() {
      for (const k of ORDER) {
        on[k] = false;
        refreshChip(k);
      }
      chips.barrage.wrap.classList.remove('is-empty');
      chips.barrage.b.removeAttribute('aria-disabled');
      phase = 'idle';
      dayT = 0;
      hour = H0;
      ramp = 0;
      water = 1;
      refill = 0;
      damUsed = false;
      damMsgT = 0;
      co2 = 0;
      co2Shown = 0;
      unmet = 0;
      demandSum = 0;
      causes = {};
      recN = 0;
      elecShown = 0;
      rings = [];
      puffs = [];
      exhaust = [];
      mols = [];
      foam = [];
      rotorW = 0;
      gustSeed = 7;
      makeGust(gustSeed);
      for (const b of town) { b.pw = 0; b.flick = 0; }
      closeInfo();
      clearTimeout(reGesture);
      clearTimeout(longTimer);
      suppressClick = false;
      gestureAgain = true;
      shownStatus = '';
      shownProg = -1;
      setLaunch(true, TEXTES.lancer, SUNRISE_SVG);
      showLaunchGesture();
    }

    cv.onResize((w, h) => layout(w, h));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (L.w > 1) layers.console = paintConsole(); });
    api.onReset(init);
    init();
    simulate(0);
    effects(0.016);
    updateDom(1);
    render(0.016);
  };
})();
