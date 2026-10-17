/* Questions du quiz final de ce thème.
   enfants : pour Naïm et Alicia (8 ans) ; adultes : pour Siham.
   La bonne réponse est toujours la première : le jeu mélange les réponses.
   insignes : selon la part de bonnes réponses. */
(function () {
  'use strict';

  const ENFANTS = [
    {
      q: 'Sans effet de serre, quelle serait la température moyenne de la Terre ?',
      a: ['Environ −18 °C', 'Environ 15 °C', 'Environ 40 °C'],
      why: 'Grâce à la couverture de gaz, il fait environ 15 °C en moyenne.',
    },
    {
      q: 'Quel gaz les volcans soufflent-ils dans l’air ?',
      a: ['Du dioxyde de carbone, le CO2', 'De l’oxygène', 'De l’hélium'],
      why: 'Le CO2 épaissit la couverture invisible et réchauffe la Terre.',
    },
    {
      q: 'Que fait la pluie aux roches ?',
      a: ['Elle les ronge lentement en avalant du CO2', 'Elle les fait grandir', 'Elle les change en sable en une nuit'],
      why: 'La pluie, très légèrement acide, use les roches et emporte du carbone avec elle.',
    },
    {
      q: 'Où finit le carbone avalé par les roches ?',
      a: ['Dans le calcaire, au fond de l’océan', 'Dans les nuages', 'Sur la Lune'],
      why: 'Le plancton et les coquillages en font du calcaire, qui s’entasse au fond de la mer.',
    },
    {
      q: 'Quand il fait plus chaud, que fait le thermostat de la Terre ?',
      a: ['Il avale plus de CO2, ce qui refroidit', 'Il souffle encore plus de CO2', 'Il ne fait rien du tout'],
      why: 'Plus de chaleur, plus de pluie, plus de roches rongées : la couverture s’amincit.',
    },
    {
      q: 'Combien de temps faut-il au thermostat pour rééquilibrer le climat ?',
      a: ['Des centaines de milliers d’années', 'Une semaine', 'Une dizaine d’années'],
      why: 'C’est un mécanisme puissant, mais extrêmement lent.',
    },
    {
      q: 'Pourquoi l’Antarctique s’est-il couvert de glace il y a environ 34 millions d’années ?',
      a: ['Surtout parce que le CO2 de l’air avait baissé', 'Parce que le Soleil s’est éteint un moment', 'Parce qu’une météorite géante l’a frappé'],
      why: 'Au même moment, un courant marin s’est mis à tourner autour du pôle Sud, comme une barrière contre les eaux chaudes, ce qui a pu aider.',
    },
    {
      q: 'Comment la Terre est-elle sortie de la boule de neige ?',
      a: ['Le CO2 des volcans s’est accumulé jusqu’à tout faire fondre', 'Une comète l’a réchauffée', 'Les dinosaures ont cassé la glace'],
      why: 'Sous la glace, plus de pluie pour avaler le CO2 : il s’est entassé dans l’air pendant des millions d’années.',
    },
    {
      q: 'Pourquoi Vénus est-elle si brûlante ?',
      a: ['Sans eau pour ronger les roches, son CO2 est resté dans l’air', 'Elle tourne trop vite sur elle-même', 'Elle est plus loin du Soleil que la Terre'],
      why: 'Un thermostat en panne, bloqué sur « brûlant » : environ 465 °C.',
    },
    {
      q: 'Si la Terre sait se régler toute seule, pourquoi le réchauffement actuel est-il un problème ?',
      a: ['Le thermostat est bien trop lent pour suivre notre rythme', 'La Terre a perdu son thermostat', 'Le Soleil chauffe deux fois plus qu’avant'],
      why: 'En deux siècles, nous rendons à l’air du carbone que les roches avaient mis des millions d’années à enfermer.',
    },
  ];

  const ADULTES = [
    // source : https://arxiv.org/abs/1204.4449
    {
      q: 'Il y a 4 milliards d’années, le Soleil brillait environ 25 % moins fort. Comment la Terre gardait-elle de l’eau liquide ?',
      a: ['Grâce à une couverture de gaz bien plus épaisse', 'Elle tournait plus près du Soleil', 'Ses volcans chauffaient directement l’océan'],
      why: 'C’est le « paradoxe du jeune Soleil faible ». Plus de CO2, et peut-être de méthane, reste l’explication la plus probable, mais les chercheurs en débattent encore.',
    },
    // source : https://www.giss.nasa.gov/research/briefs/2010_lacis_01/
    {
      q: 'La vapeur d’eau est le premier gaz à effet de serre. Pourquoi n’est-ce pas elle qui règle le climat ?',
      a: ['Elle suit la température : en trop, elle retombe en pluie', 'Elle s’échappe très vite vers l’espace, sans réchauffer', 'Elle ne retient la chaleur que le jour, jamais la nuit'],
      why: 'Avec les nuages, elle fait environ les trois quarts de l’effet de serre, mais ne fait qu’amplifier. Le CO2, qui ne retombe pas en pluie, tient le bouton du thermostat.',
    },
    // source : https://meteor.geol.iastate.edu/gccourse/chem/carbon/images/Table1.html
    {
      q: 'Entre l’air, les océans, les êtres vivants et les roches, où se trouve l’essentiel du carbone ?',
      a: ['Dans les roches, surtout le calcaire', 'Dans les océans', 'Dans les forêts et les sols'],
      why: 'Les roches en contiennent des dizaines de milliers de fois plus que l’air, et environ 2 000 fois plus que les océans. Pourtant, c’est la petite part de l’air qui règle le climat.',
    },
    // source : https://science.nasa.gov/earth/earth-observatory/the-carbon-cycle/
    {
      q: 'Le thermostat des roches agit-il seulement contre la chaleur ?',
      a: ['Non : il réchauffe aussi une Terre trop froide', 'Oui : contre le froid, il ne peut rien', 'Oui : seul le Soleil peut réchauffer la Terre'],
      why: 'Quand il fait froid, il pleut moins : les roches avalent moins de CO2, mais les volcans continuent d’en souffler. Dans les deux sens, il lui faut quelques centaines de milliers d’années.',
    },
    // source : https://www.astronomy.com/science/ask-astro-how-is-earth-the-only-known-planet-with-active-plate-tectonics/
    {
      q: 'Qu’est-ce que la Terre est la seule planète connue à posséder ?',
      a: ['Des plaques qui bougent et plongent', 'Un champ magnétique', 'Des volcans'],
      why: 'Mars et Vénus ont des volcans géants, Mercure un champ magnétique, mais aucune n’a de plaques qui se recyclent comme chez nous. Ce tapis roulant entretient le thermostat.',
    },
    // source : https://www.nature.com/articles/359117a0
    {
      q: 'Selon une hypothèse, comment la formation de l’Himalaya a-t-elle aidé la Terre à se refroidir ?',
      a: ['Ses roches, rongées par la mousson, ont avalé du CO2', 'Ses volcans ont voilé le ciel de cendres', 'Ses glaciers ont refroidi l’océan Indien'],
      why: 'Des montagnes neuves offrent de la roche fraîche à ronger. Cette idée, défendue notamment par Maureen Raymo et William Ruddiman, est encore discutée.',
    },
    // source : https://escholarship.org/content/qt4qn645ch/qt4qn645ch.pdf
    {
      q: 'Une fois lancée, pourquoi la glace d’une Terre boule de neige avance-t-elle de plus en plus vite ?',
      a: ['Blanche, elle renvoie la lumière du Soleil', 'Elle aspire la chaleur des océans', 'Elle étouffe les volcans sous son poids'],
      why: 'Plus de glace, moins de lumière absorbée, donc plus de froid : un cercle vicieux. Passé un seuil, la glace a pu filer jusqu’à l’équateur, ou presque.',
    },
    // source : https://escholarship.org/content/qt4qn645ch/qt4qn645ch.pdf
    {
      q: 'Juste au-dessus des dépôts laissés par les glaciers de la Terre boule de neige, que trouvent les géologues ?',
      a: ['D’épaisses couches de calcaire', 'D’épaisses couches de charbon', 'D’épaisses couches de sel'],
      why: 'Après la fonte, l’air chargé de CO2 a rongé les roches à toute allure, et le carbone s’est redéposé au fond des mers. Ce sont les « carbonates de couverture ».',
    },
    // source : https://science.nasa.gov/mercury/facts/
    {
      q: 'Mercure est plus proche du Soleil que Vénus. Laquelle a la surface la plus chaude ?',
      a: ['Vénus, avec environ 465 °C', 'Mercure, de jour comme de nuit', 'Les deux, à peu près à égalité'],
      why: 'L’épaisse atmosphère de CO2 de Vénus garde la chaleur. Mercure, presque sans air, monte à 430 °C le jour mais tombe à −180 °C la nuit.',
    },
    // source : https://www.nature.com/articles/363428a0
    {
      q: 'Comment Vénus a-t-elle perdu presque toute son eau ?',
      a: ['Sa vapeur s’est brisée et l’hydrogène a fui dans l’espace', 'Elle a gelé, enfouie sous ses pôles', 'Ses roches l’ont bue jusqu’à la dernière goutte'],
      why: 'Indice : son hydrogène contient environ 120 fois plus de deutérium que le nôtre, une forme lourde qui s’échappe moins vite. Sans eau, plus de pluie pour ronger les roches.',
    },
    // source : https://www.ipcc.ch/report/ar6/wg1/chapter/chapter-5/
    {
      q: 'Comment connaît-on le CO2 de l’air d’il y a 800 000 ans ?',
      a: ['Par des bulles d’air piégées dans la glace', 'Par les cernes d’arbres très anciens', 'Par des mesures sur les plus vieilles roches'],
      why: 'En Antarctique, la neige tassée en glace emprisonne de l’air. Avant l’ère industrielle, le CO2 n’y a jamais dépassé 300 ppm ; il dépasse aujourd’hui 420 ppm.',
    },
    // source : https://www.annualreviews.org/doi/10.1146/annurev-earth-040610-133431
    {
      q: 'Il y a 56 millions d’années, une énorme bouffée de carbone a réchauffé la Terre. Combien de temps pour revenir à la normale ?',
      a: ['Environ 200 000 ans', 'Environ 200 ans', 'Environ 20 millions d’années'],
      why: 'C’est le maximum thermique du Paléocène-Éocène : de 5 à 8 °C de plus. Les roches ont fini par tout réabsorber, mais à leur rythme, bien trop lent pour nous.',
    },
  ];

  const INSIGNES = [
    { min: 1, name: 'Thermostat parfait', text: 'Un sans-faute : tu sais tout sur le climat de la Terre.' },
    { min: 0.8, name: 'Volcan en éveil', text: 'Presque parfait : tu chauffes !' },
    { min: 0.6, name: 'Goutte de pluie', text: 'Tu ronges les difficultés petit à petit. Encore un effort !' },
    { min: 0.4, name: 'Flocon', text: 'Tu commences à fondre… Rejoue pour faire mieux !' },
    { min: 0, name: 'Glaçon', text: 'Tout commence par là. Relis les chapitres et retente ta chance.' },
  ];

  window.RM = window.RM || {};
  window.RM.quizData = { enfants: ENFANTS, adultes: ADULTES, insignes: INSIGNES };
})();
