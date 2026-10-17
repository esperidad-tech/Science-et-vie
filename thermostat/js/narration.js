/* Textes lus à voix haute, chapitre par chapitre (le thermostat de la Terre).
   Les mêmes que sur l'écran, écrits pour être dits : les nombres en toutes lettres,
   et un mot d'accueil pour Naïm et Alicia. Ils servent de script au studio d'enregistrement
   et à la voix du téléphone tant qu'il n'y a pas d'enregistrement. */
(function () {
  'use strict';

  const CHAPITRES = [
    {
      id: 'debut',
      titre: 'Introduction',
      texte: [
        'Salut Naïm, salut Alicia ! Aujourd’hui, on mène l’enquête sur le thermostat de la Terre.',
        'Pourquoi notre planète n’est-elle ni un glaçon, ni une fournaise ? La réponse se cache dans les roches.',
        'Depuis plus de quatre milliards d’années, la Terre garde de l’eau liquide à sa surface. Pourtant, le Soleil a changé, les continents ont bougé, et la planète a même gelé presque entièrement. Qu’est-ce qui l’a toujours ramenée, jusqu’ici, vers un climat où la vie est possible ?',
        'Pour commencer, place la planète à la bonne distance du Soleil.',
      ],
    },
    {
      id: 'serre',
      titre: 'La couverture invisible',
      texte: [
        'La couverture invisible.',
        'Le Soleil chauffe le sol. Le sol renvoie cette chaleur vers l’espace sous forme de rayons invisibles, les infrarouges. Certains gaz de l’air, comme la vapeur d’eau et le dioxyde de carbone, qu’on appelle aussi C O deux, en retiennent une partie : c’est l’effet de serre.',
        'Sans lui, la Terre serait une boule gelée, à moins dix-huit degrés en moyenne. Grâce à lui, il fait environ quinze degrés. L’épaisseur de cette couverture décide du climat : trop mince, on gèle ; trop épaisse, on cuit.',
        'Le savais-tu ? Il y a quatre milliards d’années, le Soleil brillait environ un quart moins fort qu’aujourd’hui. Pourtant, la Terre avait déjà de l’eau liquide. L’explication la plus probable : sa couverture de gaz était bien plus épaisse. Les chercheurs en discutent encore.',
      ],
    },
    {
      id: 'cycle',
      titre: 'Le voyage du carbone',
      texte: [
        'Le voyage du carbone.',
        'Les volcans soufflent du C O deux dans l’air. La pluie en capture un peu : elle devient très légèrement acide et ronge lentement les roches, comme le granite ou le basalte.',
        'Les rivières emportent ce qui s’est dissous jusqu’à l’océan. Là, le plancton et les coquillages s’en servent pour fabriquer leur coquille de calcaire. Quand ils meurent, le calcaire s’entasse au fond : le carbone est enfermé dans la roche. Bien plus tard, le mouvement des plaques entraîne une partie de ces roches en profondeur, et les volcans recrachent le C O deux. La boucle est bouclée.',
        'Le savais-tu ? Les montagnes de calcaire et les falaises de craie sont d’immenses réserves de carbone. Les roches de la Terre en contiennent des dizaines de milliers de fois plus que son air.',
      ],
    },
    {
      id: 'reglage',
      titre: 'Un thermostat qui se règle tout seul',
      texte: [
        'Un thermostat qui se règle tout seul.',
        'Voici le secret. Quand il fait plus chaud, il pleut davantage et les roches s’usent plus vite. Elles avalent alors plus de C O deux, la couverture s’amincit, et la Terre se refroidit.',
        'Quand il fait plus froid, c’est l’inverse : il pleut moins, les roches avalent moins de C O deux, les volcans continuent d’en souffler, et la Terre se réchauffe. Comme le thermostat d’une maison, ce mécanisme ramène toujours la température vers le milieu. Mais il est très lent : il lui faut quelques centaines de milliers d’années.',
        'Le savais-tu ? Ce mécanisme a été décrit en mille neuf cent quatre-vingt-un par trois chercheurs américains, James Walker, Paul Hays et James Kasting. On l’appelle souvent le thermostat géologique.',
      ],
    },
    {
      id: 'plaques',
      titre: 'Le tapis roulant des plaques',
      texte: [
        'Le tapis roulant des plaques.',
        'La surface de la Terre est découpée en grandes plaques qui glissent de quelques centimètres par an. Quand deux plaques se rencontrent, l’une plonge sous l’autre et entraîne avec elle les roches calcaires du fond de l’océan.',
        'En profondeur, la chaleur libère le carbone, que les volcans renvoient dans l’air. Et là où les plaques se cognent, des montagnes se dressent : de la roche toute neuve, prête à être rongée par la pluie. Sans ce tapis roulant, le thermostat finirait par s’arrêter.',
        'Le savais-tu ? La Terre est la seule planète connue où les plaques bougent ainsi. C’est peut-être l’une des raisons pour lesquelles elle est restée habitable si longtemps.',
      ],
    },
    {
      id: 'geographie',
      titre: 'Quand les continents bougent',
      texte: [
        'Quand les continents bougent.',
        'Les continents dérivent, et le climat suit. Il y a environ trente-quatre millions d’années, l’Antarctique s’est couvert de glace, surtout parce que le C O deux de l’air avait baissé. Au même moment, l’Amérique du Sud et l’Australie s’en étaient éloignées : un courant marin s’est mis à tourner tout autour du pôle Sud, comme une barrière contre les eaux chaudes, ce qui a pu aider.',
        'Autre exemple : quand l’Inde a percuté l’Asie, l’Himalaya s’est dressé. Certains chercheurs pensent que l’usure de ces immenses montagnes, arrosées par la mousson, a avalé beaucoup de C O deux et aidé la Terre à se refroidir lentement.',
        'Le savais-tu ? L’Inde avance encore vers le nord de quelques centimètres par an. L’Himalaya continue donc de se soulever.',
      ],
    },
    {
      id: 'boule',
      titre: 'La Terre boule de neige',
      texte: [
        'La Terre boule de neige. Il y a environ sept cents millions d’années.',
        'Un jour, le climat a basculé dans le froid. La glace s’est étendue des pôles jusque près de l’équateur, peut-être même jusqu’à lui. Comme elle est blanche, elle renvoie la lumière du Soleil vers l’espace : plus il y a de glace, plus il fait froid, et plus la glace avance.',
        'Comment la Terre s’en est-elle sortie ? Les volcans, eux, n’ont jamais arrêté de souffler du C O deux. Mais sous la glace, plus de pluie pour ronger les roches. Pendant des millions d’années, le C O deux s’est accumulé dans l’air, jusqu’à atteindre des dizaines, voire des centaines de fois le niveau actuel. La couverture est devenue assez épaisse pour tout faire fondre.',
        'Le savais-tu ? Après la fonte, d’épaisses couches de calcaire se sont déposées très vite par-dessus les traces des glaciers. Les géologues les appellent les carbonates de couverture, et les retrouvent sur presque tous les continents.',
      ],
    },
    {
      id: 'venus',
      titre: 'Vénus, la jumelle brûlante',
      texte: [
        'Vénus, la jumelle brûlante.',
        'Vénus a presque la même taille que la Terre. Mais sa surface atteint environ quatre cent soixante-cinq degrés, plus que Mercure, pourtant plus proche du Soleil. Assez pour faire fondre du plomb ! Son air est fait presque entièrement de C O deux, si épais qu’au sol, il pèse environ quatre-vingt-dix fois plus que le nôtre.',
        'Que s’est-il passé ? Plus proche du Soleil, Vénus a perdu presque toute son eau : la vapeur s’est cassée et l’hydrogène s’est échappé dans l’espace. Sans pluie, plus rien pour ronger les roches ; sans plaques qui bougent, pas de recyclage. Le C O deux est resté dans l’air : un thermostat en panne, bloqué sur brûlant.',
        'Le savais-tu ? La Terre a à peu près autant de C O deux que Vénus. Mais chez nous, il est enfermé dans la pierre au lieu de flotter dans l’air.',
      ],
    },
    {
      id: 'aujourdhui',
      titre: 'Trop vite pour le thermostat',
      texte: [
        'Trop vite pour le thermostat.',
        'En brûlant du charbon, du pétrole et du gaz, nous rendons à l’air, en deux siècles, du carbone que la Terre avait mis des millions d’années à enfermer. Le C O deux de l’air est passé d’environ deux cent quatre-vingts parties par million avant l’ère industrielle à environ quatre cent vingt-sept en deux mille vingt-cinq. Il monte environ cent fois plus vite qu’à la fin de la dernière glaciation.',
        'Le thermostat finira par rattraper ce surplus : les roches vont lentement l’avaler. Mais il lui faudra des centaines de milliers d’années. Il y a cinquante-six millions d’années, après une énorme libération de carbone, la Terre avait mis environ deux cent mille ans à revenir à la normale. Elle s’en remettra encore. La vraie question, c’est ce que deviendront ceux qui vivent dessus pendant tout ce temps.',
        'Le savais-tu ? Les bulles d’air piégées dans la glace de l’Antarctique racontent le C O deux des huit cent mille dernières années. Avant l’ère industrielle, il n’avait jamais dépassé trois cents parties par million.',
        'Et maintenant, Naïm et Alicia, place au quiz !',
      ],
    },
  ];

  /* Enregistrements de la voix du conteur : audio/<id>.mp3 */
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
