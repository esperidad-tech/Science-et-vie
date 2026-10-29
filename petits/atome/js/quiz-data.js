/* Questions du quiz final de ce thème (version des petits).
   enfants : pour Naïm, Alicia et Eline, avec trois réponses au choix ;
   adultes : pour Siham, reprises de la version complète.
   La bonne réponse est toujours la première : le jeu mélange les réponses.
   insignes : selon la part de bonnes réponses. */
(function () {
  'use strict';

  const ENFANTS = [
    { q: 'De quoi tout est-il fait ?', a: ['De minuscules atomes', 'De sable', 'De confiture'], why: 'Toi, l’air, ta table : tout est fait d’atomes, bien trop petits pour être vus.' },
    { q: 'Quels atomes casse-t-on dans une centrale nucléaire ?', a: ['Ceux de l’uranium', 'Ceux de l’or', 'Ceux du sel'], why: 'Quand un atome d’uranium casse, il libère beaucoup de chaleur : c’est la fission.' },
    { q: 'À quoi servent les barres de contrôle ?', a: ['À calmer la réaction', 'À décorer la centrale', 'À faire du feu'], why: 'Elles avalent les neutrons : on les enfonce pour ralentir, on les remonte pour accélérer.' },
    { q: 'Dans une centrale, la chaleur sert à…', a: ['Faire bouillir de l’eau', 'Cuire des gâteaux', 'Chauffer la piscine'], why: 'L’eau devient vapeur, et la vapeur fait tourner la turbine.' },
    { q: 'Qu’est-ce qui tourne grâce à la vapeur ?', a: ['La turbine', 'La cheminée', 'Le toit'], why: 'La turbine tourne, et son mouvement devient de l’électricité.' },
    { q: 'Le nuage blanc qui sort des grandes tours, c’est…', a: ['De la vapeur d’eau', 'De la fumée', 'De la poussière'], why: 'Il n’y a pas de feu dans une centrale nucléaire : c’est de l’eau qui s’évapore, comme un nuage.' },
    { q: 'Combien de boîtes enferment la radioactivité ?', a: ['Trois', 'Une', 'Dix'], why: 'Un tube de métal, une cuve d’acier et un bâtiment en béton, l’une dans l’autre.' },
    { q: 'Le nucléaire envoie-t-il beaucoup de CO2 dans l’air ?', a: ['Non, presque pas', 'Oui, énormément', 'Plus que le charbon'], why: 'C’est l’une des électricités les plus propres pour le climat.' },
    { q: 'En France, combien de lampes sont allumées grâce au nucléaire ?', a: ['Environ deux sur trois', 'Une sur cent', 'Aucune'], why: 'La France fabrique environ deux tiers de son électricité dans ses centrales nucléaires.' },
    { q: 'Une petite pastille d’uranium donne autant d’énergie que…', a: ['Une tonne de charbon', 'Une allumette', 'Une pile de télécommande'], why: 'Elle est grosse comme le bout d’un doigt, mais elle cache une énergie énorme.' },
  ];

  const ADULTES = [
    { q: 'En France, quelle part de la radioactivité reçue en moyenne par chacun vient des installations nucléaires ?', a: ['Moins de 1 %', 'Environ 15 %', 'Environ la moitié'], why: 'Environ 0,01 mSv sur 4,5 mSv par an. Les deux tiers viennent du radon, un gaz radioactif naturel sorti du sol, et des examens médicaux.' },
    { q: 'Début 1939, qui explique la cassure du noyau d’uranium et la baptise « fission » ?', a: ['Lise Meitner et son neveu Otto Frisch', 'Marie et Pierre Curie', 'Enrico Fermi et son équipe'], why: 'Otto Hahn et Fritz Strassmann avaient observé la cassure, Meitner et Frisch l’ont expliquée. Le prix Nobel de chimie 1944 est pourtant allé à Otto Hahn seul.' },
    { q: 'Dans une centrale française, l’eau qui traverse le cœur du réacteur ne va jamais à la turbine. Pourquoi ?', a: ['Pour garder la radioactivité enfermée', 'Elle est trop froide pour faire tourner la turbine', 'Elle sert seulement à éteindre les incendies'], why: 'Elle cède sa chaleur à un deuxième circuit, qui fait la vapeur. Les trois circuits d’eau, jusqu’à celui des tours, sont étanches les uns par rapport aux autres.' },
    { q: 'Après Tchernobyl, comment des milliers d’enfants de la région ont-ils eu un cancer de la thyroïde ?', a: ['En buvant du lait contaminé par de l’iode radioactif', 'En jouant, des années après, dans la zone interdite', 'Par des rayons venus directement de la centrale'], why: 'Retombé sur l’herbe, l’iode radioactif est passé dans le lait des vaches, puis dans la thyroïde. Plus de 6 000 cas ont été recensés jusqu’en 2005, presque tous soignés avec succès.' },
    { q: 'Parmi les morts liés à l’accident nucléaire de Fukushima, quelle cause l’emporte, et de loin ?', a: ['L’évacuation, très dure pour les personnes âgées', 'Les radiations, chez les habitants', 'Les explosions dans la centrale'], why: 'Les radiations ont officiellement tué un travailleur, l’évacuation plus de 2 000 personnes. L’ONU n’a constaté aucun effet des radiations sur la santé des habitants.' },
    { q: 'D’où vient l’essentiel du peu de CO2 émis par le nucléaire, sur toute sa durée de vie ?', a: ['De la mine et de l’enrichissement de l’uranium', 'Des panaches blancs des tours de refroidissement', 'De la fission, qui brûle l’uranium'], why: 'La fission ne brûle rien et les tours ne rejettent que de l’eau. Au total, environ 12 g de CO2 par kWh selon le GIEC, comme l’éolien, et environ 70 fois moins que le charbon.' },
    { q: 'En France, tous les déchets nucléaires de haute activité réunis occupent à peu près le volume de…', a: ['Deux piscines olympiques', 'Deux cents piscines olympiques', 'Vingt mille piscines olympiques'], why: 'Environ 4 700 m³ fin 2024 selon l’Andra, hors combustible usé, compté à part : 0,2 % du volume des déchets radioactifs, mais environ 97 % de leur radioactivité.' },
    { q: 'Pour la même électricité, accidents et pollution compris, combien de morts cause le nucléaire comparé au charbon ?', a: ['Des centaines de fois moins', 'Environ deux fois moins', 'Environ dix fois plus'], why: 'Tchernobyl et Fukushima compris, il fait 99,8 % de morts en moins que le charbon, à peu près autant que l’éolien et le solaire. Le charbon tue surtout par la pollution de l’air.' },
  ];

  const INSIGNES = [
    { min: 1, name: 'Pilote de centrale', text: 'Un sans-faute : tu sais faire marcher une centrale !' },
    { min: 0.8, name: 'Turbine qui tourne', text: 'Presque parfait : ça tourne à fond !' },
    { min: 0.6, name: 'Neutron rapide', text: 'Bien joué ! Encore un petit effort.' },
    { min: 0.4, name: 'Petit atome', text: 'Tu es sur la bonne voie. Rejoue pour faire mieux !' },
    { min: 0, name: 'Grain d’uranium', text: 'Tout commence par là. Réécoute l’histoire et rejoue !' },
  ];

  window.RM.quizData = { enfants: ENFANTS, adultes: ADULTES, insignes: INSIGNES };
})();
