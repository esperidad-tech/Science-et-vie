/* Textes lus à voix haute, chapitre par chapitre.
   Ce sont les mêmes que sur l'écran, écrits pour être dits : les nombres en toutes lettres,
   et un mot d'accueil pour Naïm et Alicia. Ils servent à la fois de script pour
   l'enregistrement (studio.html) et à la voix du téléphone tant qu'il n'y a pas d'enregistrement. */
(function () {
  'use strict';

  const CHAPITRES = [
    {
      id: 'debut',
      titre: 'Introduction',
      texte: [
        'Salut Naïm, salut Alicia ! Bienvenue dans Roche mère.',
        'Quatre milliards et demi d’années d’histoire entre les pierres et le vivant, à explorer du bout des doigts.',
        'Tout commence par un nuage de poussières d’étoiles qui s’agglutinent en une boule de roche brûlante. Comment ces pierres ont-elles fait naître la vie ? Et comment la vie les a-t-elle transformées à son tour ?',
        'Chaque chapitre se joue avec les doigts. Allez, on y va !',
      ],
    },
    {
      id: 'lune',
      titre: 'La Lune, née d’un choc',
      texte: [
        'La Lune, née d’un choc. Il y a environ quatre milliards et demi d’années.',
        'La jeune Terre n’est pas seule sur son orbite. Une autre planète, à peu près de la taille de Mars, fonce vers elle. Les scientifiques l’ont baptisée Théia.',
        'Le choc est gigantesque. Des morceaux des deux planètes sont projetés dans l’espace, forment un anneau autour de la Terre, puis s’agglutinent : c’est la naissance de la Lune. C’est le scénario le plus admis aujourd’hui.',
        'Le savais-tu ? La Lune s’éloigne toujours de la Terre, d’environ trois virgule huit centimètres par an. C’est à peu près la vitesse à laquelle poussent tes ongles.',
      ],
    },
    {
      id: 'pluie',
      titre: 'Refroidir, puis pleuvoir',
      texte: [
        'Refroidir, puis pleuvoir. Pendant environ trois cents millions d’années.',
        'Après le choc, la surface de la Terre est un océan de lave. Il lui faut quelque trois cents millions d’années pour refroidir et se couvrir d’une croûte de roche.',
        'Les volcans rejettent de la vapeur d’eau. Quand l’air devient assez frais, cette vapeur retombe en pluies diluviennes. Une partie de l’eau a aussi pu arriver avec des météorites. Peu à peu, les premiers océans se remplissent.',
        'Le savais-tu ? Les plus vieux morceaux de Terre connus sont de minuscules cristaux de zircon trouvés en Australie. Ils ont environ quatre virgule quatre milliards d’années, et leur chimie suggère que de l’eau liquide existait déjà.',
      ],
    },
    {
      id: 'recette',
      titre: 'La recette de la vie',
      texte: [
        'La recette de la vie. Il y a plus de trois milliards et demi d’années.',
        'Chaleur, eau liquide et minéraux : c’est de la rencontre de ces trois ingrédients que la vie a émergé. Où exactement, et comment ? C’est encore l’une des grandes énigmes de la science.',
        'Les plus vieilles traces sûres de vie ont environ trois milliards et demi d’années. Des indices plus anciens, jusqu’à trois virgule huit milliards d’années, sont encore discutés.',
        'Une piste sérieuse mène au fond des océans, vers des sources chaudes où l’eau traverse la roche brûlante et ressort chargée de minéraux. À la surface de ces minéraux, de petites molécules ont pu s’accrocher, se rencontrer et s’assembler en chaînes de plus en plus longues. Un jour, certaines se sont enfermées dans une fine enveloppe : les premières cellules.',
        'Il existe d’autres pistes : des mares chaudes qui s’assèchent et se remplissent tour à tour, des ingrédients venus de l’espace, comme les acides aminés trouvés dans des météorites, ou encore des argiles qui attirent les molécules et les rangent côte à côte.',
      ],
    },
    {
      id: 'oxygene',
      titre: 'Les fabricants d’oxygène',
      texte: [
        'Les fabricants d’oxygène. De trois milliards et demi à deux virgule quatre milliards d’années.',
        'Pendant très longtemps, la vie reste microscopique. Certains microbes, les cyanobactéries, apprennent à capter la lumière du Soleil pour fabriquer leur nourriture. Ce faisant, ils rejettent un gaz : l’oxygène.',
        'Au début, cet oxygène ne reste pas dans l’air. Il fait rouiller le fer dissous dans l’océan. La rouille coule et se dépose au fond, couche après couche. La vie vient de fabriquer une nouvelle roche.',
        'Le savais-tu ? Ces couches de rouille, appelées formations de fer rubané, fournissent aujourd’hui l’essentiel du minerai de fer. Le fer d’une casserole vient peut-être de microbes vieux de plus de deux milliards d’années.',
      ],
    },
    {
      id: 'mineraux',
      titre: 'La vie, créatrice de minéraux',
      texte: [
        'La vie, créatrice de minéraux. Depuis deux virgule quatre milliards d’années.',
        'En changeant l’air, la vie a changé les pierres. L’oxygène a réagi avec les roches et fait apparaître des milliers de minéraux nouveaux, aux couleurs souvent éclatantes.',
        'Le minéralogiste américain Robert Hazen, l’un des scientifiques du film, a fait le compte : la vie a joué un rôle dans la formation de près de la moitié des minéraux connus, et environ un tiers n’existeraient pas sans elle.',
        'Le savais-tu ? On connaît aujourd’hui plus de six mille deux cents espèces de minéraux. Dans les poussières d’étoiles qui ont formé le système solaire, on n’en compte qu’une douzaine.',
      ],
    },
    {
      id: 'ile',
      titre: 'La vie s’attaque à la roche nue',
      texte: [
        'La vie s’attaque à la roche nue. Il y a environ quatre cent soixante-dix millions d’années.',
        'Pendant des milliards d’années, les continents restent des déserts de pierre. Ils naissent et se déplacent sous l’effet de forces immenses : le volcanisme et la tectonique des plaques.',
        'Puis la vie sort de l’eau. Les lichens, alliance d’un champignon et d’une algue, s’accrochent à la roche et la rongent avec leurs acides. Ils préparent les premiers sols, où mousses, fougères puis arbres prennent racine. Ce scénario se rejoue encore sur les îles volcaniques, comme Madère.',
        'Le savais-tu ? Les premières plantes terrestres apparaissent il y a environ quatre cent soixante-dix millions d’années, les premières forêts vers trois cent quatre-vingt-dix millions d’années. Leurs racines ont creusé des sols profonds et même changé la forme des rivières.',
      ],
    },
    {
      id: 'craie',
      titre: 'Le plancton bâtisseur de falaises',
      texte: [
        'Le plancton bâtisseur de falaises. Il y a environ quatre-vingt-dix millions d’années.',
        'Au temps des dinosaures, la Normandie est sous une mer chaude. Dans l’eau flottent des milliards d’algues microscopiques, les coccolithophoridés, couvertes de minuscules plaques de calcaire.',
        'Quand elles meurent, ces plaques tombent au fond comme de la neige. Deux centimètres tous les mille ans, ce n’est rien. Mais pendant vingt millions d’années, cela fait des centaines de mètres de craie : la roche blanche des falaises d’Étretat.',
        'Le savais-tu ? Les rangées de cailloux noirs dans la craie sont du silex. Il vient surtout de la silice des éponges marines. Bien plus tard, les humains en ont fait leurs premiers outils tranchants.',
      ],
    },
    {
      id: 'ocre',
      titre: 'Peindre avec la roche',
      texte: [
        'Peindre avec la roche. Il y a des dizaines de milliers d’années.',
        'Les humains arrivent très tard dans l’histoire : notre espèce n’a qu’environ trois cent mille ans. Mais eux aussi dialoguent avec la roche. Ils taillent le silex et broient des pierres pour en faire des couleurs.',
        'L’ocre rouge et l’ocre jaune sont des oxydes de fer : de la rouille, en somme, rendue possible par l’oxygène des cyanobactéries. Le blanc vient d’argile, le noir de charbon de bois. En Namibie, des gravures et des peintures sur roche racontent la vie des chasseurs-cueilleurs, et des pierres peintes de la grotte Apollo 11 ont environ trente mille ans.',
        'Le savais-tu ? Chauffée, l’ocre jaune devient rouge : en perdant son eau, le minéral qui la colore se transforme en hématite. Les peintres de la préhistoire savaient sans doute jouer de ce changement de couleur.',
      ],
    },
    {
      id: 'aujourdhui',
      titre: 'Le dialogue continue',
      texte: [
        'Le dialogue continue. Aujourd’hui.',
        'Ce lien entre la roche et le vivant n’a jamais cessé. Sur le terrain, les chercheurs du film l’observent à l’œuvre.',
        'Sur les côtes rocheuses, certains oursins creusent leur abri dans la pierre avec leurs dents et leurs piquants. Dans le désert du Namib, le vent arrache des poussières d’argile et les emporte jusqu’à l’océan, où elles nourrissent le plancton.',
        'Le savais-tu ? Le même échange se joue à l’échelle de la planète : chaque année, les poussières du Sahara traversent l’Atlantique et apportent du phosphore, un engrais naturel, à la forêt amazonienne. À peu près autant que ce que les pluies lui font perdre.',
      ],
    },
    {
      id: 'anthropocene',
      titre: 'Des roches fabriquées par les humains',
      texte: [
        'Des roches fabriquées par les humains. Depuis le milieu du vingtième siècle.',
        'Le charbon, le pétrole et le gaz sont des restes de vie ancienne : forêts et plancton enfouis, puis transformés pendant des millions d’années. En les brûlant en deux siècles à peine, nous bouleversons un cycle dont dépendent les écosystèmes.',
        'Nous fabriquons aussi nos propres roches. Le béton recouvre villes et routes, et sur certaines plages on trouve des galets mêlés de plastique fondu. Pour les géologues du futur, ce sera la signature de notre époque. Beaucoup l’appellent l’Anthropocène, même si les géologues ont refusé en deux mille vingt-quatre d’en faire une époque officielle.',
        'Le savais-tu ? L’humanité a déjà coulé environ cinq cents milliards de tonnes de béton : de quoi en étaler un kilo sur chaque mètre carré de la planète.',
      ],
    },
    {
      id: 'horloge',
      titre: 'Toute l’histoire en 24 heures',
      texte: [
        'Toute l’histoire en vingt-quatre heures.',
        'Imagine que les quatre milliards et demi d’années de la Terre tiennent en une seule journée. La Terre naît à minuit pile. Fais tourner l’aiguille pour voir à quelle heure arrive chaque événement.',
        'Et à la fin, un petit quiz vous attend, Naïm et Alicia. Bonne chance !',
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
