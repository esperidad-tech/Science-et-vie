/* Questions du quiz final de ce thème (version des petits).
   enfants : pour Naïm, Alicia et Eline, avec trois réponses au choix ;
   adultes : pour Siham, reprises de la version complète.
   La bonne réponse est toujours la première : le jeu mélange les réponses.
   insignes : selon la part de bonnes réponses. */
(function () {
  'use strict';

  const ENFANTS = [
    { q: 'Pourquoi l’eau reste-t-elle liquide sur Terre ?', a: ['La Terre est à la bonne distance du Soleil', 'La Terre touche presque le Soleil', 'La Terre est très loin du Soleil'], why: 'Plus près, l’eau s’évaporerait. Plus loin, elle gèlerait.' },
    { q: 'Qu’est-ce qui garde la Terre au chaud, comme une couverture ?', a: ['Le CO2 dans l’air', 'Les nuages en coton', 'La Lune'], why: 'Le CO2 garde une partie de la chaleur du Soleil : c’est l’effet de serre.' },
    { q: 'Sans cette couverture, il ferait…', a: ['Très froid', 'Très chaud', 'Pareil qu’aujourd’hui'], why: 'Sans effet de serre, toute la Terre serait gelée : environ −18 °C.' },
    { q: 'Quelle planète a une couverture beaucoup trop épaisse ?', a: ['Vénus', 'Mars', 'Mercure'], why: 'Sur Vénus, il fait plus de 460 °C, plus chaud que dans un four !' },
    { q: 'Sur Vénus, il fait…', a: ['Plus chaud que dans un four', 'Froid comme au pôle Nord', 'Doux comme au printemps'], why: 'Plus de 460 °C : le plomb y fondrait !' },
    { q: 'Où la Terre garde-t-elle son carbone enfermé ?', a: ['Dans les roches et la mer', 'Dans les nuages', 'Dans la Lune'], why: 'Les roches et l’océan gardent le carbone. Sans eux, la Terre deviendrait une fournaise.' },
    { q: 'Qu’est-ce qui envoie beaucoup de CO2 dans l’air aujourd’hui ?', a: ['Brûler du charbon, du pétrole et du gaz', 'Boire de l’eau', 'Faire du vélo'], why: 'Les voitures, les usines et certains chauffages brûlent du charbon, du pétrole ou du gaz.' },
    { q: 'Quand la couverture de CO2 s’épaissit, la Terre…', a: ['Se réchauffe', 'Se refroidit', 'Ne change pas'], why: 'Plus de CO2, c’est une couverture plus épaisse : la Terre a un peu de fièvre.' },
    { q: 'Laquelle fabrique de l’électricité presque sans CO2 ?', a: ['Une éolienne', 'Une centrale à charbon', 'Une centrale au pétrole'], why: 'Le vent, le soleil, l’eau des barrages et le nucléaire font de l’électricité presque sans CO2.' },
    { q: 'De combien la Terre s’est-elle déjà réchauffée ?', a: ['D’un peu plus d’un degré', 'De 50 degrés', 'Pas du tout'], why: 'Ça a l’air petit, mais pour toute la planète, c’est beaucoup !' },
  ];

  const ADULTES = [
    { q: 'Il y a 4 milliards d’années, le Soleil brillait environ 25 % moins fort. Comment la Terre gardait-elle de l’eau liquide ?', a: ['Grâce à une couverture de gaz bien plus épaisse', 'Elle tournait plus près du Soleil', 'Ses volcans chauffaient directement l’océan'], why: 'C’est le « paradoxe du jeune Soleil faible ». Plus de CO2, et peut-être de méthane, reste l’explication la plus probable, mais les chercheurs en débattent encore.' },
    { q: 'La vapeur d’eau est le premier gaz à effet de serre. Pourquoi n’est-ce pas elle qui règle le climat ?', a: ['Elle suit la température : en trop, elle retombe en pluie', 'Elle s’échappe très vite vers l’espace, sans réchauffer', 'Elle ne retient la chaleur que le jour, jamais la nuit'], why: 'Avec les nuages, elle fait environ les trois quarts de l’effet de serre, mais ne fait qu’amplifier. Le CO2, qui ne retombe pas en pluie, tient le bouton du thermostat.' },
    { q: 'Entre l’air, les océans, les êtres vivants et les roches, où se trouve l’essentiel du carbone ?', a: ['Dans les roches, surtout le calcaire', 'Dans les océans', 'Dans les forêts et les sols'], why: 'Les roches en contiennent des dizaines de milliers de fois plus que l’air, et environ 2 000 fois plus que les océans. Pourtant, c’est la petite part de l’air qui règle le climat.' },
    { q: 'Mercure est plus proche du Soleil que Vénus. Laquelle a la surface la plus chaude ?', a: ['Vénus, avec environ 465 °C', 'Mercure, de jour comme de nuit', 'Les deux, à peu près à égalité'], why: 'L’épaisse atmosphère de CO2 de Vénus garde la chaleur. Mercure, presque sans air, monte à 430 °C le jour mais tombe à −180 °C la nuit.' },
    { q: 'Comment Vénus a-t-elle perdu presque toute son eau ?', a: ['Sa vapeur s’est brisée et l’hydrogène a fui dans l’espace', 'Elle a gelé, enfouie sous ses pôles', 'Ses roches l’ont bue jusqu’à la dernière goutte'], why: 'Indice : son hydrogène contient environ 120 fois plus de deutérium que le nôtre, une forme lourde qui s’échappe moins vite. Sans eau, plus de pluie pour ronger les roches.' },
    { q: 'Comment connaît-on le CO2 de l’air d’il y a 800 000 ans ?', a: ['Par des bulles d’air piégées dans la glace', 'Par les cernes d’arbres très anciens', 'Par des mesures sur les plus vieilles roches'], why: 'En Antarctique, la neige tassée en glace emprisonne de l’air. Avant l’ère industrielle, le CO2 n’y a jamais dépassé 300 ppm ; il dépasse aujourd’hui 420 ppm.' },
    { q: 'Il y a 56 millions d’années, une énorme bouffée de carbone a réchauffé la Terre. Combien de temps pour revenir à la normale ?', a: ['Environ 200 000 ans', 'Environ 200 ans', 'Environ 20 millions d’années'], why: 'C’est le maximum thermique du Paléocène-Éocène : de 5 à 8 °C de plus. Les roches ont fini par tout réabsorber, mais à leur rythme, bien trop lent pour nous.' },
  ];

  const INSIGNES = [
    { min: 1, name: 'Docteur de la Terre', text: 'Un sans-faute : tu sais soigner la fièvre de la Terre !' },
    { min: 0.8, name: 'Volcan en éveil', text: 'Presque parfait : tu chauffes !' },
    { min: 0.6, name: 'Goutte de pluie', text: 'Bien joué ! Encore un petit effort.' },
    { min: 0.4, name: 'Flocon', text: 'Tu commences à fondre… Rejoue pour faire mieux !' },
    { min: 0, name: 'Glaçon', text: 'Tout commence par là. Réécoute l’histoire et rejoue !' },
  ];

  window.RM.quizData = { enfants: ENFANTS, adultes: ADULTES, insignes: INSIGNES };
})();
