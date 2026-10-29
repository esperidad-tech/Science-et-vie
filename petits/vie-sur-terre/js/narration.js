/* Textes lus à voix haute, chapitre par chapitre (Qui a fabriqué la Terre ? — version des petits).
   Les mêmes que sur l'écran, écrits pour être dits, et un mot d'accueil pour Naïm, Alicia et Eline.
   Ils servent de script au studio d'enregistrement et à la voix du téléphone
   tant qu'il n'y a pas d'enregistrement. */
(function () {
  'use strict';

  const CHAPITRES = [
    {
      id: 'debut',
      titre: 'Introduction',
      texte: [
        'Salut Naïm, salut Alicia, salut Eline ! Aujourd’hui, une grande question : qui a fabriqué la Terre ?',
        'Des poussières d’étoiles, des éclairs, des microbes et des dinosaures : voici l’histoire de notre planète, en 4 petits jeux.',
        'Il y a très, très longtemps, la Terre n’existait pas. Autour du Soleil, il n’y avait qu’un grand nuage de poussières. Les poussières se sont cognées, se sont collées, et elles ont formé une boule de roche brûlante : la Terre !',
        'Pour commencer, tapez dans le nuage pour fabriquer la Terre !',
      ],
    },
    {
      id: 'eclairs',
      titre: 'Des éclairs au-dessus de la mer',
      texte: [
        'Des éclairs au-dessus de la mer.',
        'La Terre refroidit tout doucement. Puis il pleut, il pleut, pendant très longtemps : les océans se remplissent.',
        'Au-dessus de l’eau, les orages grondent. Un savant, Stanley Miller, a voulu essayer : il a mis de l’eau et des gaz dans de grands bocaux, et il a fait des étincelles, comme de petits éclairs. Et hop : de petites briques de la vie sont apparues toutes seules !',
        'Le savais-tu ? Ce n’était pas encore la vie, seulement quelques-unes de ses pièces. Comme des briques de Lego, avant de construire la maison !',
      ],
    },
    {
      id: 'oxygene',
      titre: 'Des microbes qui fabriquent l’air',
      texte: [
        'Des microbes qui fabriquent l’air.',
        'Les premiers êtres vivants sont des microbes, si petits qu’on ne peut pas les voir. Certains se nourrissent de la lumière du Soleil, comme les plantes.',
        'En même temps, ils rejettent un gaz : l’oxygène, celui que nous respirons ! Petit à petit, l’oxygène remplit la mer, puis l’air. Merci les microbes !',
        'Le savais-tu ? Les êtres vivants fabriquent aussi des roches ! La craie des falaises est faite de milliards de minuscules coquilles d’algues.',
      ],
    },
    {
      id: 'dinos',
      titre: 'Les dinosaures, puis nous',
      texte: [
        'Les dinosaures, puis nous.',
        'Bien plus tard arrivent les dinosaures. Certains sont petits comme des poules, d’autres sont des géants plus longs que deux autobus !',
        'Un jour, un énorme caillou venu de l’espace tombe sur la Terre. Les dinosaures disparaissent, sauf une famille : les oiseaux ! Les humains, eux, arrivent beaucoup, beaucoup plus tard. Aucun humain n’a jamais vu de dinosaure géant.',
        'Le savais-tu ? Les oiseaux sont les petits-enfants des dinosaures : la poule est une lointaine cousine du tyrannosaure !',
        'Et maintenant, place au petit quiz, avec Siham ! Bonne chance !',
      ],
    },
  ];

  /* Enregistrements de la voix du conteur : audio/<id du chapitre>.mp3.
     À ajouter ici quand ils existent, par exemple : debut: 'audio/debut.mp3'. */
  const AUDIO = {};

  window.RM = window.RM || {};
  window.RM.narration = {
    chapitres: CHAPITRES,
    audio: AUDIO,
    get(id) {
      const c = CHAPITRES.find((x) => x.id === id);
      return c ? c.texte.join(' ') : '';
    },
  };
})();
