/* Questions du quiz final de ce thème.
   enfants : pour Naïm et Alicia (8 ans) ; adultes : pour Siham.
   La bonne réponse est toujours la première : le jeu mélange les réponses.
   insignes : selon la part de bonnes réponses. */
(function () {
  'use strict';

  const ENFANTS = [
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
    // source : https://astrobiology.nasa.gov/news/miller-urey-revisited/
    {
      q: 'Qu’a obtenu Stanley Miller en faisant jaillir de petits éclairs dans de l’eau et des gaz ?',
      a: ['Des briques du vivant', 'Des bactéries vivantes', 'Du sel de mer'],
      why: 'Ce sont des acides aminés. Pas encore la vie, mais certaines de ses pièces, fabriquées avec de l’eau, des gaz… et de l’électricité.',
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
    // source : https://www.amnh.org/explore/videos/dinosaurs-and-fossils/150-million-years-of-dinosaur-evolution
    // source : https://www.eva.mpg.de/fileadmin/content_files/human_evolution/Homo_Sapiens_presskit/pdf/English_PressRelease_Irhoud.pdf
    {
      q: 'Qui est apparu en premier sur la Terre : les dinosaures ou les humains ?',
      a: ['Les dinosaures, bien avant nous', 'Les humains', 'Les deux en même temps'],
      why: 'Les premiers dinosaures ont environ 230 millions d’années, notre espèce environ 300 000 ans. Aucun humain n’a jamais croisé de dinosaure géant !',
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

  const ADULTES = [
    // source : https://eclipse.gsfc.nasa.gov/help/ApolloLaser.html
    {
      q: 'La Lune s’éloigne de nous d’environ 3,8 cm par an. Comment le mesure-t-on aussi finement ?',
      a: ['Au laser, sur des miroirs posés par les astronautes', 'Avec des balises GPS installées sur la Lune', 'En comparant des photos prises depuis un siècle'],
      why: 'Apollo 11 a posé le premier réflecteur en 1969. On chronomètre l’aller-retour de la lumière, environ 2,5 secondes, et on en tire la distance à quelques centimètres près.',
    },
    // source : https://www.sci.news/geology/science-jack-hills-zircon-oldest-known-fragment-earth-01779.html
    {
      q: 'Les plus vieux fragments de Terre connus sont des zircons australiens de 4,4 milliards d’années. Que suggère leur chimie ?',
      a: ['De l’eau liquide existait déjà', 'L’air était déjà riche en oxygène', 'Le Soleil brillait plus fort qu’aujourd’hui'],
      why: 'À peine 150 millions d’années après la naissance de la Terre, il y avait donc déjà de l’eau liquide, peut-être même des océans. L’oxygène, lui, n’envahira l’air que vers 2,4 milliards d’années.',
    },
    // source : https://astrobiology.nasa.gov/news/miller-urey-revisited/
    {
      q: 'En 2008, on a réanalysé des flacons de Stanley Miller, gardés plus de cinquante ans. Qu’y a-t-on trouvé ?',
      a: ['Plus de vingt acides aminés différents', 'Une contamination qui annulait tout', 'Des brins d’ADN déjà assemblés'],
      why: 'En 1953, Miller n’en avait identifié que cinq. Les flacons d’un de ses essais imitant un panache volcanique, jamais publié, en contenaient 22.',
    },
    // source : https://unsw.edu.au/newsroom/news/2017/05/oldest-evidence-of-life-on-land-found-in-3-48-billion-year-old-a
    // source : https://whc.unesco.org/en/list/578/
    {
      q: 'Sous quelle forme se présentent les plus vieilles traces sûres de vie, vieilles d’environ 3,5 milliards d’années ?',
      a: ['Des roches en couches bâties par des microbes', 'Des empreintes de méduses dans le sable', 'Des os de minuscules poissons'],
      why: 'Ce sont des stromatolithes, comme ceux du Pilbara, en Australie (3,48 milliards d’années). Il en pousse encore aujourd’hui, à Shark Bay, dans le même pays.',
    },
    // source : https://cosmosmagazine.com/earth/earth-sciences/explainer-what-is-iron-ore-made-of
    {
      q: 'D’où vient l’essentiel du minerai de fer exploité aujourd’hui ?',
      a: ['De vieilles couches de rouille dues à des microbes', 'De météorites de fer tombées sur Terre', 'Du noyau de la Terre, remonté par les volcans'],
      why: 'Ce sont les formations de fer rubané : l’oxygène des cyanobactéries a fait rouiller le fer dissous dans l’océan, qui s’est déposé en couches il y a plus de 2 milliards d’années.',
    },
    // source : https://carnegiescience.edu/news/nature-used-57-recipes-create-earths-10500-mineral-kinds
    {
      q: 'Selon le minéralogiste Robert Hazen, quelle part des minéraux connus n’aurait jamais pu se former sans la vie ?',
      a: ['Environ un tiers', 'Moins de 1 %', 'Presque tous'],
      why: 'La vie a aussi joué un rôle dans la formation de près de la moitié d’entre eux, surtout grâce à l’oxygène. Les poussières d’étoiles du début n’en comptaient qu’une douzaine.',
    },
    // source : https://blogs.egu.eu/geolog/2014/01/13/imaggeo-on-mondays-long-live-the-lichen/
    {
      q: 'Qu’est-ce qu’un lichen, ce pionnier qui s’attaque à la roche nue ?',
      a: ['L’alliance d’un champignon et d’une algue', 'Une mousse très primitive', 'Une petite fougère sans racines'],
      why: 'L’algue fabrique du sucre grâce au soleil, le champignon s’agrippe à la pierre, et leurs acides la rongent. C’est l’un des premiers pas vers un sol.',
    },
    // source : https://www.amnh.org/explore/videos/dinosaurs-and-fossils/11-questions-stegosaurus
    {
      q: 'Dans le temps, de qui le tyrannosaure était-il le plus proche ?',
      a: ['De nous, les humains', 'Du stégosaure', 'Du diplodocus'],
      why: 'Environ 66 millions d’années nous séparent de lui, contre plus de 75 millions entre lui et le stégosaure. Les dinosaures ont vécu plus de 160 millions d’années !',
    },
    // source : https://earthwise.bgs.ac.uk/index.php/Lithology_of_the_Chalk_Group_-_Flint
    {
      q: 'D’où vient surtout la silice des silex noirs alignés dans la craie d’Étretat ?',
      a: ['De squelettes d’éponges marines', 'De galets roulés par les rivières', 'De cendres de volcans lointains'],
      why: 'Dissoute dans la boue crayeuse, elle a recristallisé en rognons très durs, souvent dans d’anciens terriers. Bien plus tard, les humains en ont taillé des outils tranchants.',
    },
    // source : https://hal.archives-ouvertes.fr/hal-02431020
    {
      q: 'Comment obtenir de l’ocre rouge à partir d’ocre jaune ?',
      a: ['En la chauffant dans un feu', 'En la laissant sécher au soleil', 'En la mêlant à du charbon de bois'],
      why: 'Vers 250 à 300 °C, la goethite jaune perd son eau et devient de l’hématite rouge. Des archéologues ont trouvé des traces de chauffe volontaire sur des sites préhistoriques.',
    },
    // source : https://www.nasa.gov/missions/calipso/nasa-satellite-reveals-how-much-saharan-dust-feeds-amazons-plants
    {
      q: 'Après avoir traversé l’Atlantique, que rapporte chaque année à l’Amazonie la poussière du Sahara ?',
      a: ['Du phosphore, un engrais qui compense ses pertes', 'Du sel, qui appauvrit peu à peu ses sols', 'Du sable, qui étouffe les jeunes arbres'],
      why: 'Environ 22 000 tonnes de phosphore par an selon la NASA, à peu près ce que les pluies et les crues font perdre à la forêt. Le désert nourrit la jungle.',
    },
    // source : https://dukespace.lib.duke.edu/server/api/core/bitstreams/9b8a766b-55f1-4357-82ac-c294f24da626/content
    {
      q: 'L’humanité a coulé environ 500 milliards de tonnes de béton. Étalé sur toute la planète, cela ferait…',
      a: ['Environ 1 kg par mètre carré', 'Environ 1 g par mètre carré', 'Environ 1 tonne par mètre carré'],
      why: 'Océans compris, et plus de la moitié de ce béton a été coulée entre 1995 et 2015. Pour les géologues du futur, ce sera la signature de notre époque.',
    },
  ];

  const INSIGNES = [
    { min: 1, name: 'Roche mère', text: 'Un sans-faute. Toute l’histoire, de la poussière d’étoiles au béton.' },
    { min: 0.8, name: 'Falaise de craie', text: 'Solide, construite couche après couche. Presque parfait !' },
    { min: 0.6, name: 'Lichen pionnier', text: 'Bien accroché ! Encore un petit effort pour devenir une falaise.' },
    { min: 0.4, name: 'Cyanobactérie', text: 'Tu commences à changer l’atmosphère. Rejoue pour faire mieux !' },
    { min: 0, name: 'Grain de poussière', text: 'Tout commence par là. Relis les chapitres et retente ta chance.' },
  ];

  window.RM = window.RM || {};
  window.RM.quizData = { enfants: ENFANTS, adultes: ADULTES, insignes: INSIGNES };
})();
