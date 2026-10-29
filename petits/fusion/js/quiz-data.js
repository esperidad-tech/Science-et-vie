/* Questions du quiz final de ce thème (version des petits).
   enfants : pour Naïm, Alicia et Eline, avec trois réponses au choix ;
   adultes : pour Siham, reprises de la version complète.
   La bonne réponse est toujours la première : le jeu mélange les réponses.
   insignes : selon la part de bonnes réponses. */
(function () {
  'use strict';

  const ENFANTS = [
    { q: 'Qu’est-ce qui fait briller le Soleil ?', a: ['Des noyaux qui se collent', 'Un grand feu de bois', 'Une énorme ampoule'], why: 'Au cœur du Soleil, de minuscules noyaux se collent : c’est la fusion.' },
    { q: 'La fusion, c’est…', a: ['Coller de petits noyaux', 'Casser de gros noyaux', 'Faire fondre du chocolat'], why: 'Coller, c’est la fusion. Casser, c’est la fission des centrales d’aujourd’hui.' },
    { q: 'Pour coller des noyaux sur Terre, il faut un gaz…', a: ['Plus chaud que le cœur du Soleil', 'Froid comme un glaçon', 'Tiède comme un bain'], why: '150 millions de degrés : dix fois plus chaud que le cœur du Soleil !' },
    { q: 'Comment tient-on ce gaz brûlant ?', a: ['Avec une cage d’aimants', 'Dans une boîte en carton', 'Avec du scotch'], why: 'Des aimants géants le gardent au milieu d’un anneau, sans toucher les murs.' },
    { q: 'Quelle forme a la cage d’aimants ?', a: ['Un anneau, comme un beignet', 'Un cube', 'Une étoile'], why: 'En anneau, le gaz tourne sans fin et ne s’échappe pas par les bouts.' },
    { q: 'Comment s’appelle la grande machine construite en France ?', a: ['ITER', 'La tour Eiffel', 'Soleil 2'], why: 'Des pays du monde entier la construisent ensemble, en Provence.' },
    { q: 'Combien de lasers visent la petite bille ?', a: ['192', '2', 'Un million'], why: '192 lasers géants tirent tous en même temps.' },
    { q: 'La bille visée par les lasers est grosse comme…', a: ['Un grain de poivre', 'Un ballon de foot', 'Une maison'], why: 'Elle est minuscule : plus petite qu’un grain de poivre.' },
    { q: 'La fusion éclaire-t-elle déjà nos maisons ?', a: ['Pas encore', 'Oui, partout', 'Oui, depuis cent ans'], why: 'Les savants y travaillent. Peut-être quand tu seras grand !' },
    { q: 'D’où vient une partie du carburant de la fusion ?', a: ['De l’eau de mer', 'Du chocolat', 'Des nuages'], why: 'L’eau de mer contient du deutérium, une sorte d’hydrogène.' },
  ];

  const ADULTES = [
    { q: 'D’où vient l’énergie libérée quand quatre noyaux d’hydrogène deviennent un noyau d’hélium ?', a: ['D’un peu de masse qui disparaît', 'De l’hydrogène qui brûle dans l’oxygène', 'Du Soleil qui se tasse sous son poids'], why: 'L’hélium est environ 0,7 % plus léger que les quatre noyaux : la masse manquante devient énergie (E = mc²). Eddington l’a proposé en 1920, Bethe l’a calculé en 1939.' },
    { q: 'À masse égale, combien d’énergie la fusion libère-t-elle de plus que le charbon ou le pétrole ?', a: ['Près de 4 millions de fois plus', 'Environ 4 fois plus', 'Environ 400 fois plus'], why: 'Chiffre de l’AIEA. Une centrale de 1 000 MW consommerait 250 kg de combustible par an, contre 2,7 millions de tonnes de charbon.' },
    { q: 'Pourquoi faut-il 150 millions de degrés sur Terre, alors que le cœur du Soleil n’est qu’à 15 millions ?', a: ['Il manque la densité énorme du cœur solaire', 'Le deutérium est moins pur que l’hydrogène', 'Les aimants refroidissent sans cesse le plasma'], why: 'Dans le Soleil, la gravité serre les noyaux très fort. Sur Terre, on ne peut pas comprimer autant : on compense par une température dix fois plus haute.' },
    { q: 'Quel est l’objectif d’ITER ?', a: ['500 MW de fusion pour 50 MW de chauffage', 'Alimenter la Provence en électricité', 'Tester la fusion par lasers'], why: 'C’est le fameux Q = 10. ITER est une expérience : il ne produira pas d’électricité. Elle viendra, au mieux, avec les machines suivantes.' },
    { q: 'En 2022, le NIF a obtenu 3,15 MJ de fusion pour 2,05 MJ de laser. Pourquoi est-on encore loin d’une centrale ?', a: ['Les lasers ont pris 300 MJ sur le réseau', 'L’énergie n’était que de la lumière', 'Le résultat n’a jamais été reproduit'], why: 'Le gain porte sur la cible, pas sur l’installation, et une centrale devrait tirer environ 10 fois par seconde. Le résultat a été reproduit 11 fois jusqu’en juin 2026.' },
    { q: 'Quels déchets produirait une centrale à fusion, selon le CEA ?', a: ['Ses parois, rendues radioactives', 'Aucun déchet radioactif du tout', 'Du combustible usé, comme la fission'], why: 'Pas de déchets de haute activité : surtout des matériaux à vie courte, dont environ 5 % à vie longue. Leur radiotoxicité redescend près du niveau naturel en une centaine d’années.' },
    { q: 'Pourquoi le tritium est-il un casse-tête pour l’avenir de la fusion ?', a: ['Il est très rare et disparaît peu à peu', 'Il est toxique comme le plomb', 'On ne le trouve que sur la Lune'], why: 'Le stock mondial avoisine 20 kg et perd environ 5 % par an. Chaque centrale devra en fabriquer avec du lithium, ce qui n’a jamais été démontré à grande échelle.' },
    { q: 'Que concluent en 2024 les académies des sciences allemandes sur la fusion et le climat ?', a: ['Trop tard pour 2050, mais à poursuivre', 'Elle remplacera l’éolien dès 2035', 'Elle est impossible : à abandonner'], why: 'La plupart des experts comptent 20 à 25 ans avant une première centrale. Pour le MIT, son rôle après 2050 dépendra surtout de son prix.' },
  ];

  const INSIGNES = [
    { min: 1, name: 'Maître du Soleil', text: 'Un sans-faute : tu tiens un soleil dans ta main !' },
    { min: 0.8, name: 'Étoile brillante', text: 'Presque parfait : tu brilles !' },
    { min: 0.6, name: 'Laser géant', text: 'Bien joué ! Encore un petit effort.' },
    { min: 0.4, name: 'Petite étincelle', text: 'Ça commence à briller. Rejoue pour faire mieux !' },
    { min: 0, name: 'Grain de soleil', text: 'Tout commence par là. Réécoute l’histoire et rejoue !' },
  ];

  window.RM.quizData = { enfants: ENFANTS, adultes: ADULTES, insignes: INSIGNES };
})();
