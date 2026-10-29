/* Questions du quiz final de ce thème.
   enfants : pour Lya et Ertan (10 à 12 ans) ; adultes : pour Siham.
   La bonne réponse est toujours la première : le jeu mélange les réponses.
   insignes : selon la part de bonnes réponses. */
(function () {
  'use strict';

  const ENFANTS = [
    {
      q: 'Qui a découvert la radioactivité, en 1896 ?',
      a: ['Henri Becquerel', 'Albert Einstein', 'Isaac Newton'],
      why: 'Deux ans plus tard, Marie et Pierre Curie découvraient le polonium et le radium.',
    },
    {
      q: 'Qu’est-ce que la fission ?',
      a: ['Un noyau d’atome qui se casse en deux', 'Un atome qui fond comme de la glace', 'Deux planètes qui se percutent'],
      why: 'Quand un neutron frappe un noyau d’uranium, il se casse et libère de l’énergie, et d’autres neutrons.',
    },
    // source : https://www.nrc.gov/docs/ML1932/ML19326A928.pdf
    {
      q: 'Une centrale nucléaire peut-elle exploser comme une bombe atomique ?',
      a: ['Non, son combustible n’est pas fait pour ça', 'Oui, si elle chauffe trop', 'Oui, si on appuie sur le mauvais bouton'],
      why: 'Son uranium est bien trop peu concentré. Un accident grave peut abîmer le réacteur, mais jamais provoquer une explosion atomique.',
    },
    {
      q: 'À quoi servent les barres de contrôle d’un réacteur ?',
      a: ['À avaler des neutrons pour ralentir la réaction', 'À faire tourner la turbine', 'À éclairer la centrale la nuit'],
      why: 'Plus on les enfonce, plus la réaction ralentit. Tout au fond, elle s’arrête.',
    },
    {
      q: 'Que sort-il des grandes tours des centrales ?',
      a: ['De la vapeur d’eau', 'De la fumée noire', 'Des déchets radioactifs'],
      why: 'Ces tours servent à refroidir l’installation : ce nuage blanc, c’est de l’eau.',
    },
    {
      q: 'Une pastille de combustible grosse comme le bout d’un doigt produit autant d’énergie que…',
      a: ['Une tonne de charbon', 'Une allumette', 'Un seau d’eau chaude'],
      why: 'L’énergie cachée dans les noyaux d’atomes est gigantesque.',
    },
    {
      q: 'Qu’est-ce qui a provoqué l’accident de Fukushima, en 2011 ?',
      a: ['Un séisme suivi d’un tsunami', 'Un incendie de forêt', 'Une météorite'],
      why: 'Les vagues ont noyé les machines de secours qui refroidissaient les réacteurs.',
    },
    {
      q: 'Combien de réacteurs nucléaires compte la France ?',
      a: ['57', '5', '570'],
      why: 'Ils produisent environ les deux tiers de l’électricité du pays.',
    },
    {
      q: 'Les déchets les plus radioactifs représentent quelle part du volume des déchets nucléaires français ?',
      a: ['Environ 0,2 %', 'Environ la moitié', 'Presque tout'],
      why: 'Un tout petit volume, mais presque toute la radioactivité.',
    },
    {
      q: 'Où la France prévoit-elle de ranger ses déchets les plus dangereux ?',
      a: ['À 500 mètres sous terre, dans l’argile', 'Au fond de l’océan', 'Dans l’espace'],
      why: 'À Bure, dans une couche d’argile restée immobile depuis des millions d’années.',
    },
    {
      q: 'Sur toute sa vie, combien de CO2 une centrale nucléaire émet-elle pour chaque kilowattheure ?',
      a: ['À peu près autant qu’une éolienne', 'Autant qu’une centrale à charbon', 'Deux fois plus qu’une centrale à gaz'],
      why: 'C’est l’une des électricités qui émettent le moins de CO2, à égalité avec l’éolien.',
    },
    // source : https://ourworldindata.org/safest-sources-of-energy
    {
      q: 'Pour fabriquer la même quantité d’électricité, laquelle cause le moins de morts ?',
      a: ['Le nucléaire', 'Le charbon', 'Le gaz'],
      why: 'Accidents et pollution de l’air compris, le nucléaire est l’une des électricités les plus sûres. Le charbon fait des centaines de fois plus de victimes.',
    },
  ];

  const ADULTES = [
    // source : https://recherche-expertise.asnr.fr/sites/default/files/documents/actualites_presse/communiques_et_dossiers_de_presse/info_exposition_population-V2021.pdf
    // source : https://sfrp.asso.fr/wp-content/uploads/2021/11/S13-a-VIAL-E-IELSCH-G-1.pdf
    {
      q: 'En France, quelle part de la radioactivité reçue en moyenne par chacun vient des installations nucléaires ?',
      a: ['Moins de 1 %', 'Environ 15 %', 'Environ la moitié'],
      why: 'Environ 0,01 mSv sur 4,5 mSv par an. Les deux tiers viennent du radon, un gaz radioactif naturel sorti du sol, et des examens médicaux.',
    },
    // source : https://www.mpic.de/4469988/die-entdeckung-der-kernspaltung
    // source : https://www.nobelprize.org/prizes/chemistry/1944/summary/
    {
      q: 'Début 1939, qui explique la cassure du noyau d’uranium et la baptise « fission » ?',
      a: ['Lise Meitner et son neveu Otto Frisch', 'Marie et Pierre Curie', 'Enrico Fermi et son équipe'],
      why: 'Otto Hahn et Fritz Strassmann avaient observé la cassure, Meitner et Frisch l’ont expliquée. Le prix Nobel de chimie 1944 est pourtant allé à Otto Hahn seul.',
    },
    // source : https://www.ctbto.org/resources/information-material/frequently-asked-questions
    {
      q: 'Depuis Hiroshima et Nagasaki, en 1945, combien de bombes atomiques ont été utilisées dans une guerre ?',
      a: ['Aucune', 'Une, pendant la guerre de Corée', 'Une dizaine, dans divers conflits'],
      why: 'Ce sont, à ce jour, les deux seules. En revanche, plus de 2 000 essais nucléaires ont été menés entre 1945 et 1996.',
    },
    // source : https://www.edf.fr/groupe-edf/comprendre/production/nucleaire/fonctionnement-centrale-nucleaire
    {
      q: 'Dans une centrale française, l’eau qui traverse le cœur du réacteur ne va jamais à la turbine. Pourquoi ?',
      a: ['Pour garder la radioactivité enfermée', 'Elle est trop froide pour faire tourner la turbine', 'Elle sert seulement à éteindre les incendies'],
      why: 'Elle cède sa chaleur à un deuxième circuit, qui fait la vapeur. Les trois circuits d’eau, jusqu’à celui des tours, sont étanches les uns par rapport aux autres.',
    },
    // source : https://unis.unvienna.org/unis/en/pressrels/2011/unisinf398.html
    {
      q: 'Après Tchernobyl, comment des milliers d’enfants de la région ont-ils eu un cancer de la thyroïde ?',
      a: ['En buvant du lait contaminé par de l’iode radioactif', 'En jouant, des années après, dans la zone interdite', 'Par des rayons venus directement de la centrale'],
      why: 'Retombé sur l’herbe, l’iode radioactif est passé dans le lait des vaches, puis dans la thyroïde. Plus de 6 000 cas ont été recensés jusqu’en 2005, presque tous soignés avec succès.',
    },
    // source : https://world-nuclear.org/information-library/safety-and-security/safety-of-plants/fukushima-daiichi-accident
    // source : https://unis.unvienna.org/unis/en/pressrels/2021/unisous419.html
    {
      q: 'Parmi les morts liés à l’accident nucléaire de Fukushima, quelle cause l’emporte, et de loin ?',
      a: ['L’évacuation, très dure pour les personnes âgées', 'Les radiations, chez les habitants', 'Les explosions dans la centrale'],
      why: 'Les radiations ont officiellement tué un travailleur, l’évacuation plus de 2 000 personnes. L’ONU n’a constaté aucun effet des radiations sur la santé des habitants.',
    },
    // source : https://world-nuclear.org/information-library/current-and-future-generation/thorium
    {
      q: 'Quel métal, environ trois fois plus courant que l’uranium, pourrait un jour servir de combustible ?',
      a: ['Le thorium', 'Le radium', 'Le plutonium'],
      why: 'Aucune centrale ne l’utilise encore, mais la Chine et l’Inde font des essais : en 2024, la Chine en a chargé dans un petit réacteur expérimental à sels fondus.',
    },
    // source : https://www.connaissancedesenergies.org/afp/programme-depr-la-cour-des-comptes-publie-un-rapport-critique-et-recalcule-le-cout-de-flamanville-3-250114
    {
      q: 'Selon la Cour des comptes, combien a coûté l’EPR de Flamanville, prévu à 3,3 milliards d’euros ?',
      a: ['Près de 24 milliards d’euros', 'Environ 5 milliards d’euros', 'Environ 60 milliards d’euros'],
      why: 'Plus de sept fois le devis, intérêts compris. Commencé en 2007, il a été branché fin 2024 avec douze ans de retard : coûts et délais restent le point faible des nouveaux réacteurs.',
    },
    // source : https://www.osti.gov/biblio/1040918
    // source : https://www.ipcc.ch/site/assets/uploads/2018/02/ipcc_wg3_ar5_annex-iii.pdf
    {
      q: 'D’où vient l’essentiel du peu de CO2 émis par le nucléaire, sur toute sa durée de vie ?',
      a: ['De la mine et de l’enrichissement de l’uranium', 'Des panaches blancs des tours de refroidissement', 'De la fission, qui brûle l’uranium'],
      why: 'La fission ne brûle rien et les tours ne rejettent que de l’eau. Au total, environ 12 g de CO2 par kWh selon le GIEC, comme l’éolien, et environ 70 fois moins que le charbon.',
    },
    // source : https://inventaire.andra.fr/sites/default/files/pdf/andra_inventaire_national_essentiel_2026_web_2.pdf
    {
      q: 'En France, tous les déchets nucléaires de haute activité réunis occupent à peu près le volume de…',
      a: ['Deux piscines olympiques', 'Deux cents piscines olympiques', 'Vingt mille piscines olympiques'],
      why: 'Environ 4 700 m³ fin 2024 selon l’Andra, hors combustible usé, compté à part : 0,2 % du volume des déchets radioactifs, mais environ 97 % de leur radioactivité.',
    },
    // source : https://www.connaissancedesenergies.org/afp/la-centrale-nucleaire-de-zaporijjia-reconnectee-au-reseau-electrique-annonce-laeia-260908
    // source : https://newsonair.gov.in/iaea-says-ukraines-zaporizhzhia-nuclear-plant-loses-off-site-power-for-21st-time/
    {
      q: 'Pourquoi la centrale de Zaporijjia, à l’arrêt depuis 2022, inquiète-t-elle encore ?',
      a: ['Son combustible doit toujours être refroidi', 'Elle produit encore de l’électricité pour l’armée', 'Ses réacteurs pourraient redémarrer tout seuls'],
      why: 'Même à l’arrêt, son combustible continue de chauffer. Or les combats lui ont coupé l’électricité extérieure plus de vingt fois : des diesels de secours ont dû prendre le relais.',
    },
    // source : https://ourworldindata.org/safest-sources-of-energy
    {
      q: 'Pour la même électricité, accidents et pollution compris, combien de morts cause le nucléaire comparé au charbon ?',
      a: ['Des centaines de fois moins', 'Environ deux fois moins', 'Environ dix fois plus'],
      why: 'Tchernobyl et Fukushima compris, il fait 99,8 % de morts en moins que le charbon, à peu près autant que l’éolien et le solaire. Le charbon tue surtout par la pollution de l’air.',
    },
  ];

  const INSIGNES = [
    { min: 1, name: 'Physicien en chef', text: 'Un sans-faute : tu maîtrises la force de l’atome.' },
    { min: 0.8, name: 'Réacteur stable', text: 'Presque parfait : tout est sous contrôle !' },
    { min: 0.6, name: 'Neutron rapide', text: 'Tu fonces ! Encore un petit effort pour tout savoir.' },
    { min: 0.4, name: 'Électron curieux', text: 'Tu tournes autour de la bonne réponse. Rejoue pour faire mieux !' },
    { min: 0, name: 'Grain d’uranium', text: 'Tout commence par là. Relis les chapitres et retente ta chance.' },
  ];

  window.RM = window.RM || {};
  window.RM.quizData = { enfants: ENFANTS, adultes: ADULTES, insignes: INSIGNES };
})();
