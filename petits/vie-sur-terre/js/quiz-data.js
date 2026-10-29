/* Questions du quiz final de ce thème (version des petits).
   enfants : pour Naïm, Alicia et Eline, avec trois réponses au choix ;
   adultes : pour Siham, reprises de la version complète.
   La bonne réponse est toujours la première : le jeu mélange les réponses.
   insignes : selon la part de bonnes réponses. */
(function () {
  'use strict';

  const ENFANTS = [
    { q: 'Au tout début, de quoi la Terre est-elle faite ?', a: ['De poussières d’étoiles collées ensemble', 'De nuages de coton', 'De neige et de glace'], why: 'Les poussières se sont cognées et collées : elles ont formé une boule de roche brûlante, la jeune Terre.' },
    { q: 'Au début, la Terre était…', a: ['Brûlante', 'Glacée', 'Couverte de forêts'], why: 'C’était une boule de roche brûlante. Elle a refroidi tout doucement.' },
    { q: 'Qu’est-ce qui a rempli les océans ?', a: ['La pluie, pendant très longtemps', 'Un robinet géant', 'Le lait des nuages'], why: 'Quand la Terre a refroidi, il a plu pendant très, très longtemps.' },
    { q: 'Dans l’expérience de Stanley Miller, qu’est-ce qui imite les éclairs ?', a: ['Des étincelles électriques', 'Une lampe de poche', 'Un feu de camp'], why: 'Il a fait des étincelles dans de l’eau et des gaz : de petites briques de la vie sont apparues.' },
    { q: 'Les premiers êtres vivants étaient…', a: ['Des microbes minuscules', 'Des dinosaures', 'Des chats'], why: 'Ils étaient si petits qu’on ne peut les voir qu’au microscope.' },
    { q: 'Quel gaz les microbes ont-ils fabriqué ?', a: ['L’oxygène, celui qu’on respire', 'Le gaz des ballons', 'La fumée'], why: 'En se nourrissant de la lumière du Soleil, ils rejettent de l’oxygène. Merci les microbes !' },
    { q: 'La craie des falaises est faite…', a: ['De minuscules coquilles', 'De sucre', 'De neige tassée'], why: 'Des milliards de petites coquilles d’algues se sont entassées au fond de la mer. La vie fabrique aussi des roches !' },
    { q: 'Qu’est-il arrivé aux dinosaures géants ?', a: ['Un énorme caillou de l’espace est tombé', 'Ils sont partis sur la Lune', 'Ils se sont endormis'], why: 'Un astéroïde a percuté la Terre. Les dinosaures ont disparu… sauf les oiseaux !' },
    { q: 'Quels animaux d’aujourd’hui sont des dinosaures ?', a: ['Les oiseaux', 'Les poissons', 'Les chiens'], why: 'Les oiseaux descendent des dinosaures : la poule est une cousine du tyrannosaure !' },
    { q: 'Des humains ont-ils vu des dinosaures géants ?', a: ['Non, jamais', 'Oui, souvent', 'Oui, au temps des châteaux forts'], why: 'Les humains sont arrivés bien, bien plus tard.' },
  ];

  const ADULTES = [
    { q: 'Les plus vieux fragments de Terre connus sont des zircons australiens de 4,4 milliards d’années. Que suggère leur chimie ?', a: ['De l’eau liquide existait déjà', 'L’air était déjà riche en oxygène', 'Le Soleil brillait plus fort qu’aujourd’hui'], why: 'À peine 150 millions d’années après la naissance de la Terre, il y avait donc déjà de l’eau liquide, peut-être même des océans. L’oxygène, lui, n’envahira l’air que vers 2,4 milliards d’années.' },
    { q: 'En 2008, on a réanalysé des flacons de Stanley Miller, gardés plus de cinquante ans. Qu’y a-t-on trouvé ?', a: ['Plus de vingt acides aminés différents', 'Une contamination qui annulait tout', 'Des brins d’ADN déjà assemblés'], why: 'En 1953, Miller n’en avait identifié que cinq. Les flacons d’un de ses essais imitant un panache volcanique, jamais publié, en contenaient 22.' },
    { q: 'Sous quelle forme se présentent les plus vieilles traces sûres de vie, vieilles d’environ 3,5 milliards d’années ?', a: ['Des roches en couches bâties par des microbes', 'Des empreintes de méduses dans le sable', 'Des os de minuscules poissons'], why: 'Ce sont des stromatolithes, comme ceux du Pilbara, en Australie (3,48 milliards d’années). Il en pousse encore aujourd’hui, à Shark Bay, dans le même pays.' },
    { q: 'D’où vient l’essentiel du minerai de fer exploité aujourd’hui ?', a: ['De vieilles couches de rouille dues à des microbes', 'De météorites de fer tombées sur Terre', 'Du noyau de la Terre, remonté par les volcans'], why: 'Ce sont les formations de fer rubané : l’oxygène des cyanobactéries a fait rouiller le fer dissous dans l’océan, qui s’est déposé en couches il y a plus de 2 milliards d’années.' },
    { q: 'Selon le minéralogiste Robert Hazen, quelle part des minéraux connus n’aurait jamais pu se former sans la vie ?', a: ['Environ un tiers', 'Moins de 1 %', 'Presque tous'], why: 'La vie a aussi joué un rôle dans la formation de près de la moitié d’entre eux, surtout grâce à l’oxygène. Les poussières d’étoiles du début n’en comptaient qu’une douzaine.' },
    { q: 'Dans le temps, de qui le tyrannosaure était-il le plus proche ?', a: ['De nous, les humains', 'Du stégosaure', 'Du diplodocus'], why: 'Environ 66 millions d’années nous séparent de lui, contre plus de 75 millions entre lui et le stégosaure. Les dinosaures ont vécu plus de 160 millions d’années !' },
    { q: 'D’où vient surtout la silice des silex noirs alignés dans la craie d’Étretat ?', a: ['De squelettes d’éponges marines', 'De galets roulés par les rivières', 'De cendres de volcans lointains'], why: 'Dissoute dans la boue crayeuse, elle a recristallisé en rognons très durs, souvent dans d’anciens terriers. Bien plus tard, les humains en ont taillé des outils tranchants.' },
  ];

  const INSIGNES = [
    { min: 1, name: 'Maître de la Terre', text: 'Un sans-faute ! Tu connais toute l’histoire de la Terre.' },
    { min: 0.8, name: 'Grand dinosaure', text: 'Presque parfait : quelle mémoire de géant !' },
    { min: 0.6, name: 'Microbe malin', text: 'Bien joué ! Encore un petit effort.' },
    { min: 0.4, name: 'Petite étincelle', text: 'Ça commence à briller. Rejoue pour faire mieux !' },
    { min: 0, name: 'Poussière d’étoile', text: 'Tout commence par là. Réécoute l’histoire et rejoue !' },
  ];

  window.RM.quizData = { enfants: ENFANTS, adultes: ADULTES, insignes: INSIGNES };
})();
