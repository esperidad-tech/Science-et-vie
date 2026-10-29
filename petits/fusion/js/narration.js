/* Textes lus à voix haute, chapitre par chapitre (Un mini-soleil pour nous sauver ? — version des petits).
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
        'Salut Naïm, salut Alicia, salut Eline ! Aujourd’hui, une grande question : un mini-soleil pour nous sauver ?',
        'Le Soleil brille grâce à un secret : la fusion. Des savants essaient de fabriquer un mini-soleil sur Terre. 3 petits jeux pour découvrir comment !',
        'Au cœur du Soleil, de minuscules grains, les noyaux d’hydrogène, se collent les uns aux autres. Ils deviennent de l’hélium, le gaz des ballons qui s’envolent, et ils font de la lumière et de la chaleur. C’est la fusion !',
        'Pour commencer, appuyez sur le cœur du Soleil pour l’allumer !',
      ],
    },
    {
      id: 'cage',
      titre: 'Une cage invisible',
      texte: [
        'Une cage invisible.',
        'Pour coller des noyaux sur Terre, il faut un gaz plus chaud que le cœur du Soleil : cent cinquante millions de degrés ! Aucune boîte ne résisterait.',
        'Alors, les savants l’enferment dans une cage invisible, faite d’aimants géants en forme d’anneau. Le gaz tourne dedans sans jamais toucher les murs.',
        'Le savais-tu ? Des pays du monde entier construisent ensemble la plus grande de ces machines, ITER, en Provence.',
      ],
    },
    {
      id: 'lasers',
      titre: 'Des lasers sur une bille',
      texte: [
        'Des lasers sur une bille.',
        'Il y a une autre idée : viser une toute petite bille avec des lasers géants. La bille est écrasée si fort que ses noyaux se collent.',
        'En deux mille vingt-deux, aux États-Unis, ça a marché : la bille a donné plus d’énergie que les lasers ne lui en avaient envoyé ! Mais pour s’allumer, les lasers avaient pris bien plus d’électricité. Il reste du travail.',
        'Le savais-tu ? Il y a 192 lasers, et la bille est plus petite qu’un grain de poivre !',
      ],
    },
    {
      id: 'promesse',
      titre: 'Et demain ?',
      texte: [
        'Et demain ?',
        'La fusion ne fait pas de C O deux, et une partie de son carburant vient de l’eau de mer. Ce serait une énergie formidable !',
        'Mais c’est très difficile. Aucune centrale à fusion n’éclaire encore nos maisons. Peut-être quand tu seras grand, et peut-être grâce à toi !',
        'Le savais-tu ? Le Soleil fait de la fusion depuis plus de 4 milliards d’années, et il en a encore pour des milliards d’années !',
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
