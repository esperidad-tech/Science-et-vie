/* Questions du quiz final de ce thème.
   enfants : pour Naïm et Alicia (8 ans) ; adultes : pour Siham.
   La bonne réponse est toujours la première : le jeu mélange les réponses.
   insignes : selon la part de bonnes réponses.
   Sources : voir /tmp/…/fusion_recherche.md, § 3c (ITER, AIEA, CEA, LLNL, GOV.UK, Leopoldina…). */
(function () {
  'use strict';

  const ENFANTS = [
    { q: 'Qu’est-ce qui fait briller le Soleil ?', a: ['Des noyaux d’hydrogène qui se collent', 'Un énorme feu de bois', 'Du charbon qui brûle'], why: 'Au cœur du Soleil, des noyaux d’hydrogène se collent pour faire de l’hélium : c’est la fusion. Elle produit sa lumière et sa chaleur.' },
    { q: 'La fusion, c’est…', a: ['Coller des petits noyaux ensemble', 'Casser de gros noyaux en morceaux', 'Faire fondre de la glace'], why: 'La fusion colle de petits noyaux. Les centrales nucléaires actuelles font l’inverse : elles cassent de gros noyaux, c’est la fission.' },
    { q: 'Où trouve-t-on le deutérium, l’un des carburants de la fusion ?', a: ['Dans l’eau de mer', 'Dans le sable du désert', 'Seulement sur la Lune'], why: 'Chaque litre d’eau de mer contient 33 milligrammes de deutérium.' },
    { q: 'Comment s’appelle le gaz si chaud que les électrons quittent les noyaux ?', a: ['Le plasma', 'La vapeur', 'La fumée'], why: 'Le plasma est le quatrième état de la matière. Les éclairs et les aurores boréales sont aussi des plasmas.' },
    { q: 'Pourquoi le plasma ne touche-t-il pas les murs d’un tokamak ?', a: ['Des aimants géants le tiennent au milieu', 'Il est collé avec une colle spéciale', 'Les murs sont en glace'], why: 'De puissants aimants forment une cage invisible qui garde le plasma loin des parois.' },
    { q: 'En 1969, qu’ont utilisé les Anglais comme thermomètre pour mesurer le plasma soviétique ?', a: ['Un laser', 'Un thermomètre de cuisine', 'Une loupe'], why: 'Leur laser a mesuré environ 10 millions de degrés : les Soviétiques avaient dit vrai.' },
    { q: 'Combien de combustible JET a-t-il utilisé pour son dernier record, en 2023 ?', a: ['0,2 milligramme', '2 kilos', 'Un camion entier'], why: 'Avec seulement 0,2 milligramme, une quantité minuscule, JET a produit 69 mégajoules en 5 secondes.' },
    { q: 'Dans quel pays se construit ITER, le plus grand tokamak du monde ?', a: ['En France', 'Au Canada', 'En Australie'], why: 'ITER se construit en Provence, près de Cadarache, grâce à plus de 30 pays.' },
    { q: 'Combien de lasers le NIF utilise-t-il pour écraser sa petite bille ?', a: ['192', '2', '10 000'], why: '192 lasers géants tirent en même temps sur une bille grosse comme un grain de poivre.' },
    { q: 'Combien de temps le tokamak français WEST a-t-il gardé son plasma allumé en 2025 ?', a: ['Plus de 22 minutes', '2 secondes', '3 jours'], why: 'Le 12 février 2025, WEST a tenu 1 337 secondes : record du monde de durée pour un tokamak.' },
    { q: 'Quel carburant de la fusion est si rare qu’il faudra le fabriquer avec du lithium ?', a: ['Le tritium', 'L’eau', 'Le sable'], why: 'Il n’existe qu’une vingtaine de kilos de tritium sur Terre : les futures centrales devront le fabriquer elles-mêmes.' },
    { q: 'La fusion peut-elle sauver le climat avant 2050 ?', a: ['Non, elle arrivera trop tard pour ça', 'Oui, il y a déjà des centrales à fusion', 'Oui, ITER donne déjà de l’électricité'], why: 'Les experts pensent que les premières centrales arriveront trop tard pour 2050. D’ici là, on compte sur les énergies bas carbone qui existent déjà.' },
  ];

  const ADULTES = [
    { q: 'D’où vient l’énergie libérée quand quatre noyaux d’hydrogène deviennent un noyau d’hélium ?', a: ['D’un peu de masse qui disparaît', 'De l’hydrogène qui brûle dans l’oxygène', 'Du Soleil qui se tasse sous son poids'], why: 'L’hélium est environ 0,7 % plus léger que les quatre noyaux : la masse manquante devient énergie (E = mc²). Eddington l’a proposé en 1920, Bethe l’a calculé en 1939.' },
    { q: 'À masse égale, combien d’énergie la fusion libère-t-elle de plus que le charbon ou le pétrole ?', a: ['Près de 4 millions de fois plus', 'Environ 4 fois plus', 'Environ 400 fois plus'], why: 'Chiffre de l’AIEA. Une centrale de 1 000 MW consommerait 250 kg de combustible par an, contre 2,7 millions de tonnes de charbon.' },
    { q: 'Pourquoi faut-il 150 millions de degrés sur Terre, alors que le cœur du Soleil n’est qu’à 15 millions ?', a: ['Il manque la densité énorme du cœur solaire', 'Le deutérium est moins pur que l’hydrogène', 'Les aimants refroidissent sans cesse le plasma'], why: 'Dans le Soleil, la gravité serre les noyaux très fort. Sur Terre, on ne peut pas comprimer autant : on compense par une température dix fois plus haute.' },
    { q: 'En 1969, qu’a changé la mission britannique auprès du tokamak soviétique T-3 ?', a: ['Elle a confirmé ses 10 millions de degrés', 'Elle a prouvé que ses chiffres étaient faux', 'Elle a obtenu le premier gain d’énergie'], why: 'Mesurés au laser, les chiffres soviétiques étaient justes. Le tokamak est devenu la machine de référence : Princeton a même converti son stellarator.' },
    { q: 'Le record final de JET (69 MJ en 5 secondes, en 2023) représente l’énergie contenue dans environ…', a: ['2 litres d’essence', '2 000 litres d’essence', 'Un camion-citerne'], why: '69 MJ font environ 19 kWh, et un litre d’essence contient 31 à 32 MJ. Un exploit scientifique, mais une quantité d’énergie modeste.' },
    { q: 'Quel est l’objectif d’ITER ?', a: ['500 MW de fusion pour 50 MW de chauffage', 'Alimenter la Provence en électricité', 'Tester la fusion par lasers'], why: 'C’est le fameux Q = 10. ITER est une expérience : il ne produira pas d’électricité. Elle viendra, au mieux, avec les machines suivantes.' },
    { q: 'Selon le calendrier d’ITER publié en 2024, quand commenceront les expériences au deutérium-tritium ?', a: ['En 2039', 'En 2025', 'En 2060'], why: 'Le calendrier de 2016 visait 2035. Celui de 2024 prévoit 2034 (deutérium seul), 2036 (pleine puissance magnétique) puis 2039, avec 5 milliards d’euros de surcoût.' },
    { q: 'En 2022, le NIF a obtenu 3,15 MJ de fusion pour 2,05 MJ de laser. Pourquoi est-on encore loin d’une centrale ?', a: ['Les lasers ont pris 300 MJ sur le réseau', 'L’énergie n’était que de la lumière', 'Le résultat n’a jamais été reproduit'], why: 'Le gain porte sur la cible, pas sur l’installation, et une centrale devrait tirer environ 10 fois par seconde. Le résultat a été reproduit 11 fois jusqu’en juin 2026.' },
    { q: 'Quel est le principal avantage d’un stellarator comme Wendelstein 7-X sur un tokamak ?', a: ['Il peut en principe tourner en continu', 'Il fonctionne sans aimants', 'Il chauffe le plasma avec des lasers'], why: 'Ses 50 bobines tordues créent seules la cage magnétique, sans fort courant dans le plasma. D’où son objectif : des plasmas de 30 minutes.' },
    { q: 'Quels déchets produirait une centrale à fusion, selon le CEA ?', a: ['Ses parois, rendues radioactives', 'Aucun déchet radioactif du tout', 'Du combustible usé, comme la fission'], why: 'Pas de déchets de haute activité : surtout des matériaux à vie courte, dont environ 5 % à vie longue. Leur radiotoxicité redescend près du niveau naturel en une centaine d’années.' },
    { q: 'Pourquoi le tritium est-il un casse-tête pour l’avenir de la fusion ?', a: ['Il est très rare et disparaît peu à peu', 'Il est toxique comme le plomb', 'On ne le trouve que sur la Lune'], why: 'Le stock mondial avoisine 20 kg et perd environ 5 % par an. Chaque centrale devra en fabriquer avec du lithium, ce qui n’a jamais été démontré à grande échelle.' },
    { q: 'Que concluent en 2024 les académies des sciences allemandes sur la fusion et le climat ?', a: ['Trop tard pour 2050, mais à poursuivre', 'Elle remplacera l’éolien dès 2035', 'Elle est impossible : à abandonner'], why: 'La plupart des experts comptent 20 à 25 ans avant une première centrale. Pour le MIT, son rôle après 2050 dépendra surtout de son prix.' },
  ];

  const INSIGNES = [
    { min: 1, name: 'Maître du plasma', text: 'Un sans-faute : tu tiens un soleil dans ta main !' },
    { min: 0.8, name: 'Étoile brillante', text: 'Presque parfait : ton plasma tient bon !' },
    { min: 0.6, name: 'Noyau rapide', text: 'Tu fonces ! Encore un petit effort pour fusionner.' },
    { min: 0.4, name: 'Électron libre', text: 'Tu tournes autour de la bonne réponse. Rejoue pour faire mieux !' },
    { min: 0, name: 'Grain de deutérium', text: 'Tout commence par là. Relis les chapitres et retente ta chance.' },
  ];

  window.RM = window.RM || {};
  window.RM.quizData = { enfants: ENFANTS, adultes: ADULTES, insignes: INSIGNES };
})();
