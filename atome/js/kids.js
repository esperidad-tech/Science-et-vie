/* Naïm et Alicia : les deux guides du site, dessinés en SVG.
   Dessins originaux inspirés des enfants (pas de photo en ligne).
   RM.kids.svg('naim' | 'alicia', { expr: 'smile' | 'wow' | 'laugh' | 'shout', frame: true }) */
(function () {
  'use strict';

  const KIDS = {
    naim: {
      name: 'Naïm',
      skin: '#C98F6C', skinShade: '#B07756', cheek: '#E2876F',
      hair: '#2A1B15', hairLight: '#4D3427',
      iris: '#3A2416',
      bg: '#8FD3E8', bgDeep: '#5DB6D4',
      cloth: '#7A2333', clothLight: '#962E42',
    },
    alicia: {
      name: 'Alicia',
      skin: '#C98A63', skinShade: '#AE714D', cheek: '#E78A72',
      hair: '#8A5530', hairDark: '#663B1C', hairLight: '#C38A52',
      iris: '#3B2617',
      bg: '#FFC4A3', bgDeep: '#F4A07C',
      cloth: '#ECDEC7', clothShade: '#D6C3A3',
    },
  };

  let uid = 0;

  /* Boucles d'Alicia : un nuage de cercles autour de la tête, jusqu'aux épaules */
  function curls(k) {
    const out = [];
    const layer = (rx, ry, cy, n, r, color, a0, a1, jitter) => {
      for (let i = 0; i < n; i++) {
        const a = a0 + (a1 - a0) * (i / (n - 1));
        const j = Math.sin(i * 12.9898) * jitter;
        const x = 60 + Math.cos(a) * (rx + j);
        const y = cy + Math.sin(a) * (ry + j);
        const rr = r + Math.cos(i * 7.31) * 1.6;
        out.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rr.toFixed(1)}" fill="${color}"/>`);
      }
    };
    /* arrière : masse sombre, plus large que la tête */
    layer(35, 38, 66, 22, 11, k.hairDark, Math.PI * 0.62, Math.PI * 2.38, 2.5);
    /* boucles qui tombent sur les épaules */
    [[27, 88, 9], [93, 88, 9], [24, 100, 8], [96, 100, 8], [31, 99, 7], [89, 99, 7]].forEach(([x, y, r]) => {
      out.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${k.hairDark}"/>`);
    });
    /* milieu : boucles plus claires */
    layer(32, 35, 62, 20, 9, k.hair, Math.PI * 0.72, Math.PI * 2.28, 2);
    [[29, 84, 7.5], [91, 84, 7.5], [27, 95, 6.5], [93, 95, 6.5]].forEach(([x, y, r]) => {
      out.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${k.hair}"/>`);
    });
    /* reflets en spirale */
    const spir = [[34, 46], [86, 46], [44, 31], [76, 31], [60, 26], [30, 64], [90, 64], [29, 84], [91, 84], [27, 96], [93, 96]];
    spir.forEach(([x, y]) => {
      out.push(`<path d="M${x - 3.2} ${y} a3.2 3.2 0 1 1 3.2 3.2" fill="none" stroke="${k.hairLight}" stroke-width="1.5" stroke-linecap="round" opacity="0.85"/>`);
    });
    return out.join('');
  }

  function eyes(k, expr, girl) {
    const L = 49, R = 71, Y = 61;
    if (expr === 'laugh') {
      return `<g fill="none" stroke="#2A1810" stroke-width="2.2" stroke-linecap="round">
        <path d="M${L - 5} ${Y + 1} Q ${L} ${Y - 4.5} ${L + 5} ${Y + 1}"/>
        <path d="M${R - 5} ${Y + 1} Q ${R} ${Y - 4.5} ${R + 5} ${Y + 1}"/></g>`;
    }
    const big = expr === 'wow' ? 1.12 : 1;
    const look = expr === 'shout' ? 1.8 : 0;
    const one = (x) => `
      <ellipse cx="${x}" cy="${Y}" rx="${(4.8 * big).toFixed(2)}" ry="${(4.3 * big).toFixed(2)}" fill="#FFFFFF"/>
      <circle cx="${x + look}" cy="${Y + 0.3}" r="${(3.1 * big).toFixed(2)}" fill="${k.iris}"/>
      <circle cx="${x + look}" cy="${Y + 0.3}" r="${(1.5 * big).toFixed(2)}" fill="#120A06"/>
      <circle cx="${x + look + 1.2}" cy="${Y - 1}" r="1.15" fill="#FFFFFF"/>`;
    const lashes = girl ? `<g stroke="#2A1810" stroke-width="1.3" stroke-linecap="round">
      <path d="M${L - 4.6} ${Y - 2.6} l-1.8 -1.6"/><path d="M${R + 4.6} ${Y - 2.6} l1.8 -1.6"/></g>` : '';
    return `<g class="kid-eyes">${one(L)}${one(R)}</g>${lashes}`;
  }

  function brows(k, expr, girl) {
    const lift = expr === 'wow' ? -2.5 : expr === 'shout' ? 0.5 : 0;
    const w = girl ? 1.7 : 2.6;
    const col = girl ? '#4A2C18' : '#22150F';
    const tilt = expr === 'shout' ? 2.2 : 0;
    return `<g fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round">
      <path d="M${43} ${53.5 + lift + tilt} Q ${49} ${50.5 + lift} ${55} ${53 + lift - tilt * 0.4}"/>
      <path d="M${65} ${53 + lift - tilt * 0.4} Q ${71} ${50.5 + lift} ${77} ${53.5 + lift + tilt}"/></g>`;
  }

  function mouth(k, expr) {
    if (expr === 'wow') {
      return `<ellipse cx="60" cy="76.5" rx="4.2" ry="5.2" fill="#5A1A1A"/>
        <ellipse cx="60" cy="79" rx="2.6" ry="1.8" fill="#D9707A"/>`;
    }
    if (expr === 'shout') {
      return `<path d="M51.5 72 Q 60 67.5 68.5 72 Q 70.5 83 60 87 Q 49.5 83 51.5 72 Z" fill="#5A1A1A"/>
        <path d="M53 72.4 Q 60 69.6 67 72.4 L 66.6 74.4 Q 60 72.6 53.4 74.4 Z" fill="#FFFFFF"/>
        <rect x="59.2" y="71" width="2.4" height="3.6" fill="#5A1A1A"/>
        <ellipse cx="60" cy="83.2" rx="5.2" ry="2.6" fill="#D9707A"/>`;
    }
    if (expr === 'laugh') {
      return `<path d="M46.5 71.5 Q 60 69.5 73.5 71.5 Q 70 86 60 86.5 Q 50 86 46.5 71.5 Z" fill="#5A1A1A"/>
        <path d="M48.5 72 Q 60 70.6 71.5 72 L 70.6 75.4 Q 60 74 49.4 75.4 Z" fill="#FFFFFF"/>
        <ellipse cx="60" cy="82.4" rx="6.6" ry="3" fill="#D9707A"/>`;
    }
    /* sourire : grand, avec la dent qui manque */
    return `<path d="M49 72 Q 60 71 71 72 Q 68.5 82.5 60 82.8 Q 51.5 82.5 49 72 Z" fill="#5A1A1A"/>
      <path d="M50.4 72.4 Q 60 71.6 69.6 72.4 L 68.8 75.4 Q 60 74.4 51.2 75.4 Z" fill="#FFFFFF"/>
      <rect x="61.2" y="72" width="2.3" height="3.4" fill="#5A1A1A"/>
      <ellipse cx="60" cy="80.2" rx="5" ry="1.9" fill="#D9707A"/>`;
  }

  /* Photos des enfants : une photo calme et une photo pleine d'énergie pour chacun.
     Le dossier peut être changé avec window.RM_KIDS_BASE ; l'aperçu Claude les fournit
     directement dans window.RM_KIDS_SRC. */
  const PHOTOS = {
    naim: { smile: 'naim-sourire', hero: 'naim-sourire', wow: 'naim-cri', laugh: 'naim-cri', shout: 'naim-cri' },
    alicia: { smile: 'alicia-sourire', hero: 'alicia-mer', wow: 'alicia-rire', laugh: 'alicia-rire', shout: 'alicia-rire' },
  };
  const BASE = window.RM_KIDS_BASE || 'img/enfants/';
  function src(file) {
    const inline = window.RM_KIDS_SRC && window.RM_KIDS_SRC[file];
    return inline || BASE + file + '.webp';
  }
  /* préchargement, pour que les changements d'expression soient instantanés */
  const preloaded = [];
  Object.values(PHOTOS).forEach((set) => {
    new Set(Object.values(set)).forEach((file) => {
      const im = new Image();
      im.decoding = 'async';
      im.src = src(file);
      preloaded.push(im);
    });
  });

  function photo(name, expr) {
    const k = KIDS[name];
    const set = PHOTOS[name];
    const file = set[expr] || set.smile;
    return `<span class="kid kid--photo kid--${name} kid--${expr}" role="img" aria-label="${k.name}" style="--kid-ring:${k.bg}">`
      + `<img src="${src(file)}" alt="" decoding="async" draggable="false"></span>`;
  }

  function svg(name, opts = {}) {
    const k = KIDS[name];
    if (!k) return '';
    if (window.RM_KIDS_DRAWN !== true && PHOTOS[name]) return photo(name, opts.expr || 'smile');
    const expr = opts.expr === 'hero' ? 'smile' : (opts.expr || 'smile');
    const frame = opts.frame !== false;
    const girl = name === 'alicia';
    const id = 'kid' + (++uid);
    const parts = [];
    parts.push(`<svg class="kid kid--${name} kid--${expr}" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${k.name}">`);
    parts.push(`<defs><clipPath id="${id}c"><path d="M60 3 C 92 2 118 26 117 60 C 116 93 92 118 59 117 C 27 116 3 92 4 59 C 5 27 29 4 60 3 Z"/></clipPath>
      <radialGradient id="${id}g" cx="0.35" cy="0.3" r="0.9"><stop offset="0" stop-color="${k.bg}"/><stop offset="1" stop-color="${k.bgDeep}"/></radialGradient></defs>`);
    parts.push(`<g clip-path="url(#${id}c)">`);
    if (frame) parts.push(`<rect width="120" height="120" fill="url(#${id}g)"/>`);

    /* cheveux de derrière (Alicia) */
    if (girl) parts.push(curls(k));

    /* buste */
    if (girl) {
      parts.push(`<path d="M8 124 C 10 104 28 95 46 93 L 74 93 C 92 95 110 104 112 124 Z" fill="${k.cloth}"/>`);
      parts.push(`<path d="M38 95 C 44 100 52 101 60 101 C 68 101 76 100 82 95 C 78 92 70 90 60 90 C 50 90 42 92 38 95 Z" fill="${k.clothShade}"/>`);
      parts.push(`<path d="M60 101 L 60 124" stroke="#3A3A3A" stroke-width="1.6"/>`);
    } else {
      parts.push(`<path d="M8 124 C 10 104 28 95 46 93 L 74 93 C 92 95 110 104 112 124 Z" fill="${k.cloth}"/>`);
      parts.push(`<path d="M46 93 C 50 99 70 99 74 93 L 71 92 C 67 96 53 96 49 92 Z" fill="${k.clothLight}"/>`);
      parts.push(`<path d="M24 110 C 30 106 36 104 40 104 M96 110 C 90 106 84 104 80 104" stroke="${k.clothLight}" stroke-width="1.4" fill="none" opacity="0.6"/>`);
    }
    /* cou */
    parts.push(`<path d="M51 80 L 51 93 Q 60 97 69 93 L 69 80 Z" fill="${k.skinShade}"/>`);
    /* oreilles */
    if (!girl) {
      parts.push(`<ellipse cx="35" cy="63" rx="4.6" ry="6.6" fill="${k.skin}"/><ellipse cx="85" cy="63" rx="4.6" ry="6.6" fill="${k.skin}"/>`);
      parts.push(`<path d="M35 60 q -2 3 0 6 M85 60 q 2 3 0 6" stroke="${k.skinShade}" stroke-width="1.2" fill="none"/>`);
    }
    /* tête */
    parts.push(`<ellipse cx="60" cy="59" rx="25" ry="27.5" fill="${k.skin}"/>`);
    /* joues */
    parts.push(`<circle cx="44" cy="71" r="5" fill="${k.cheek}" opacity="0.35"/><circle cx="76" cy="71" r="5" fill="${k.cheek}" opacity="0.35"/>`);
    parts.push(eyes(k, expr, girl));
    parts.push(brows(k, expr, girl));
    /* nez */
    parts.push(`<path d="M58 66 Q 60 70.5 62.4 67.6" fill="none" stroke="${k.skinShade}" stroke-width="1.5" stroke-linecap="round"/>`);
    parts.push(mouth(k, expr));

    /* cheveux de devant */
    if (girl) {
      parts.push(`<path d="M35 62 C 34 44 46 31 60 32 C 74 31 86 44 85 62 C 82 52 75 45.5 64 45 C 62 43.5 61 41 60 39.5 C 59 41 58 43.5 56 45 C 45 45.5 38 52 35 62 Z" fill="${k.hair}"/>`);
      parts.push(`<path d="M44 40 q 6 -5 13 -4 M76 40 q -6 -5 -13 -4" fill="none" stroke="${k.hairLight}" stroke-width="1.6" stroke-linecap="round" opacity="0.8"/>`);
      [[36, 52], [84, 52], [38, 43], [82, 43]].forEach(([x, y]) => {
        parts.push(`<circle cx="${x}" cy="${y}" r="5.5" fill="${k.hair}"/>`);
      });
    } else {
      /* cheveux ondulés et en bataille, frange sur le front */
      parts.push(`<path d="M34 67 C 27 56 27 43 33 35 Q 35 26 45 25 Q 50 18.5 59 20.5 Q 67 17.5 73.5 22.5 Q 83.5 23.5 86.5 32.5 Q 94 40 90.5 52 C 90 58.5 88 64 85.5 67 C 85.5 59 83.5 53 80.5 50 L 77.5 55 L 74.5 47.5 L 70.5 54 L 66.5 46.5 L 62.5 53 L 58.5 46.5 L 54.5 53.5 L 50.5 47.5 L 46.5 54.5 L 43 49.5 L 40 57 C 38 59 37 63 36.5 67 Z" fill="${k.hair}"/>`);
      parts.push(`<path d="M40 34 q 6 -6 14 -6 M57 25.5 q 8 -3 15 1 M75 29 q 7 3 10 10 M38 44 q 4 -6 10 -8" fill="none" stroke="${k.hairLight}" stroke-width="1.7" stroke-linecap="round" opacity="0.9"/>`);
    }
    parts.push('</g></svg>');
    return parts.join('');
  }

  window.RM = window.RM || {};
  window.RM.kids = {
    list: ['naim', 'alicia'],
    name: (n) => (KIDS[n] ? KIDS[n].name : ''),
    color: (n) => (KIDS[n] ? KIDS[n].bg : '#FFFFFF'),
    svg,
  };
})();
