/* Textes lus à voix haute, chapitre par chapitre (Le nucléaire, c’est dangereux ? — version des petits).
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
        'Salut Naïm, salut Alicia, salut Eline ! Aujourd’hui, une grande question : le nucléaire, c’est dangereux ?',
        'Une centrale nucléaire, comment ça marche ? Est-ce que c’est dangereux ? 3 petits jeux pour le découvrir.',
        'Tout est fait de minuscules grains : les atomes. Certains atomes très lourds, ceux de l’uranium, cachent une énergie énorme. Pour les casser, on leur lance une bille encore plus petite, un neutron. Ils se cassent et chauffent beaucoup : c’est la fission.',
        'Pour commencer, lancez un neutron et gardez la vitesse dans le vert !',
      ],
    },
    {
      id: 'centrale',
      titre: 'De l’atome à la lampe',
      texte: [
        'De l’atome à la lampe.',
        'Dans une centrale, la chaleur des atomes fait bouillir de l’eau. La vapeur fait tourner une grande roue, la turbine, et la turbine fabrique de l’électricité !',
        'Les grandes tours blanches ne crachent pas de fumée. Ce qui en sort, c’est de la vapeur d’eau, comme un nuage.',
        'Le savais-tu ? En France, environ deux lampes sur trois sont allumées grâce aux centrales nucléaires.',
      ],
    },
    {
      id: 'barrieres',
      titre: 'Trois boîtes pour tout enfermer',
      texte: [
        'Trois boîtes pour tout enfermer.',
        'Les atomes cassés deviennent radioactifs : ils envoient des rayons invisibles, dangereux s’ils sortent. Alors on les enferme dans trois boîtes, l’une dans l’autre : un tube de métal, une énorme cuve d’acier et un bâtiment en béton très épais.',
        'Il y a eu deux grands accidents, à Tchernobyl et à Fukushima. On en a tiré des leçons, et les centrales sont surveillées jour et nuit.',
        'Le savais-tu ? Les murs du bâtiment en béton sont épais d’environ un mètre !',
      ],
    },
    {
      id: 'danger',
      titre: 'Alors, dangereux ?',
      texte: [
        'Alors, dangereux ?',
        'Le nucléaire demande beaucoup de prudence. Mais quand on compte bien, c’est l’une des façons les plus sûres de fabriquer de l’électricité : bien plus sûre que le charbon ou le pétrole, qui polluent l’air.',
        'Et il ne fait presque pas de C O deux, le gaz qui donne de la fièvre à la Terre. Ses déchets les plus dangereux sont gardés à l’abri, et la France prépare une cachette très profonde sous la terre pour les ranger.',
        'Le savais-tu ? Une seule pastille d’uranium, grosse comme le bout de ton doigt, donne autant d’énergie qu’une tonne de charbon.',
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
