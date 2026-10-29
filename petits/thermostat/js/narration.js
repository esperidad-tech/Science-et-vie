/* Textes lus à voix haute, chapitre par chapitre (La Terre a-t-elle de la fièvre ? — version des petits).
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
        'Salut Naïm, salut Alicia, salut Eline ! Aujourd’hui, une grande question : la Terre a-t-elle de la fièvre ?',
        'Pourquoi notre planète n’est ni un glaçon, ni un four ? Et pourquoi chauffe-t-elle trop aujourd’hui ? 3 petits jeux pour comprendre.',
        'La Terre tourne autour du Soleil, juste à la bonne distance. Plus près, l’eau s’envolerait en vapeur. Plus loin, elle gèlerait. Chez nous, l’eau reste liquide : c’est pour ça que la vie peut exister !',
        'Pour commencer, faites glisser la planète pour trouver la bonne place !',
      ],
    },
    {
      id: 'serre',
      titre: 'Une couverture invisible',
      texte: [
        'Une couverture invisible.',
        'Autour de la Terre, il y a l’air. Dans l’air, un peu de gaz carbonique, le C O deux, garde la chaleur du Soleil, comme une couverture.',
        'Sans cette couverture, toute la Terre serait gelée : environ moins dix-huit degrés ! Avec trop de couverture, on aurait bien trop chaud. Il en faut juste assez.',
        'Le savais-tu ? On appelle ça l’effet de serre, comme dans les serres des jardiniers, où il fait plus chaud que dehors.',
      ],
    },
    {
      id: 'venus',
      titre: 'Vénus, la planète four',
      texte: [
        'Vénus, la planète four.',
        'Vénus est notre voisine. Elle est presque aussi grande que la Terre. Mais sa couverture de C O deux est bien trop épaisse.',
        'Résultat : il y fait plus de quatre cent soixante degrés, plus chaud que dans un four ! Chez nous, les roches et la mer gardent le carbone enfermé. C’est notre chance.',
        'Le savais-tu ? Sur Vénus, il fait si chaud que le plomb fondrait comme du beurre au soleil.',
      ],
    },
    {
      id: 'aujourdhui',
      titre: 'Et nous, aujourd’hui ?',
      texte: [
        'Et nous, aujourd’hui ?',
        'Les voitures, les avions, les usines et certains chauffages brûlent du charbon, du pétrole ou du gaz. Ça envoie beaucoup de C O deux dans l’air.',
        'La couverture s’épaissit, très vite. La Terre a un peu de fièvre : elle s’est déjà réchauffée d’un peu plus d’un degré. La bonne nouvelle : on sait quoi faire. Brûler moins, et fabriquer l’électricité avec le soleil, le vent, l’eau ou les centrales nucléaires.',
        'Le savais-tu ? Quand tu as de la fièvre, un degré de plus, c’est déjà beaucoup. Pour la Terre, c’est pareil !',
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
