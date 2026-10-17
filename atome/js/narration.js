/* Textes lus à voix haute, chapitre par chapitre (la force de l'atome).
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
        'Salut Naïm, salut Alicia ! Aujourd’hui, on part à la découverte de la force de l’atome.',
        'Une énergie minuscule et gigantesque à la fois. Faut-il en avoir peur, ou compter sur elle pour le climat ?',
        'Au cœur de chaque atome se cache une énergie fabuleuse. On l’a découverte il y a un peu plus d’un siècle. Elle a servi à faire des bombes, puis à éclairer des villes entières. Elle a connu des accidents terribles, et elle produit presque sans C O deux. Alors, le nucléaire : danger ou solution ?',
        'Pour commencer, essayez de piloter un réacteur !',
      ],
    },
    {
      id: 'origines',
      titre: 'Le secret caché dans la matière',
      texte: [
        'Le secret caché dans la matière. De mille huit cent quatre-vingt-seize à mille neuf cent quarante-deux.',
        'En mille huit cent quatre-vingt-seize, le Français Henri Becquerel remarque que l’uranium émet tout seul un rayonnement invisible. Deux ans plus tard, Marie et Pierre Curie découvrent deux nouveaux éléments encore plus actifs, le polonium et le radium. On appelle ce phénomène la radioactivité.',
        'Fin mille neuf cent trente-huit, en Allemagne, Otto Hahn et Fritz Strassmann découvrent qu’un noyau d’uranium peut se casser en deux quand un neutron le frappe. Quelques semaines plus tard, Lise Meitner et Otto Frisch expliquent le phénomène et lui donnent un nom : la fission. Elle libère beaucoup d’énergie, et deux ou trois neutrons qui peuvent casser d’autres noyaux. En mille neuf cent quarante-deux, à Chicago, l’équipe d’Enrico Fermi fait fonctionner le tout premier réacteur.',
        'Le savais-tu ? Marie Curie est la première femme à avoir reçu un prix Nobel, et la seule personne récompensée dans deux sciences différentes : la physique et la chimie.',
      ],
    },
    {
      id: 'bombe',
      titre: 'Une énergie redoutable',
      texte: [
        'Une énergie redoutable. Mille neuf cent quarante-cinq.',
        'Pendant la Seconde Guerre mondiale, cette découverte sert d’abord à fabriquer une arme. En août mille neuf cent quarante-cinq, à la fin de la guerre, deux bombes atomiques américaines détruisent les villes japonaises d’Hiroshima et de Nagasaki. Plus de deux cent mille personnes en meurent, sur le coup ou dans les mois qui suivent.',
        'Même les scientifiques doivent apprendre à se méfier de cette force. À Los Alamos, aux États-Unis, deux chercheurs meurent en mille neuf cent quarante-cinq et mille neuf cent quarante-six après une erreur pendant des expériences avec le même morceau de plutonium, qu’on surnommera le cœur du démon. Après cela, ces expériences se font à distance, avec des machines.',
        'Depuis mille neuf cent quarante-cinq, plus aucune bombe atomique n’a été utilisée dans une guerre. Des traités internationaux cherchent à limiter ces armes.',
      ],
    },
    {
      id: 'centrale',
      titre: 'De l’atome à la lampe',
      texte: [
        'De l’atome à la lampe.',
        'Une centrale nucléaire, c’est une énorme bouilloire. Dans le réacteur, la fission des noyaux d’uranium chauffe de l’eau, qui fait bouillir à son tour une autre eau. La vapeur fait tourner une turbine, reliée à un alternateur, une sorte de dynamo géante : il en sort de l’électricité.',
        'Pour ralentir ou arrêter la réaction, on enfonce des barres de contrôle qui avalent les neutrons. Et ce qui sort des grandes tours, ce n’est pas de la fumée : c’est de la vapeur d’eau, qui sert à refroidir l’installation.',
        'Le savais-tu ? Une seule pastille de combustible, grosse comme le bout de ton doigt, produit à peu près autant d’énergie qu’une tonne de charbon, le poids d’une petite voiture.',
      ],
    },
    {
      id: 'tchernobyl',
      titre: 'La nuit où tout a changé',
      texte: [
        'La nuit où tout a changé. Le vingt-six avril mille neuf cent quatre-vingt-six.',
        'À Tchernobyl, en Ukraine, alors en Union soviétique, un essai de sécurité tourne mal dans un réacteur mal conçu. Une explosion et un incendie projettent de la radioactivité jusque dans toute l’Europe.',
        'Une trentaine de pompiers et d’employés meurent dans les semaines qui suivent. Des milliers d’enfants de la région auront plus tard un cancer de la thyroïde, presque tous guéris, et le nombre de morts à long terme reste discuté. Aujourd’hui encore, une zone d’environ trente kilomètres autour de la centrale reste interdite. Depuis, les règles de sûreté ont été renforcées partout.',
        'Le savais-tu ? Le réacteur de Tchernobyl n’avait pas de grande enceinte de béton pour tout enfermer. Les centrales françaises en ont une.',
      ],
    },
    {
      id: 'fukushima',
      titre: 'Le tsunami et la centrale',
      texte: [
        'Le tsunami et la centrale. Le onze mars deux mille onze.',
        'Au Japon, un énorme séisme déclenche un tsunami. Des vagues de quatorze à quinze mètres passent par-dessus la digue de la centrale de Fukushima et noient les machines de secours. Sans refroidissement, le cœur de trois réacteurs fond.',
        'Le tsunami lui-même a fait environ dix-huit mille victimes. À cause de la radioactivité, plus de cent mille habitants ont dû quitter leur maison. Officiellement, les radiations ont tué un travailleur, mais l’évacuation, très dure pour beaucoup de personnes âgées, a fait plus de deux mille morts. Depuis, partout dans le monde, on protège mieux les centrales contre l’eau et les pannes.',
        'Le savais-tu ? Après Fukushima, la France a ajouté à chaque centrale des groupes électrogènes de secours, protégés dans des bâtiments à toute épreuve.',
      ],
    },
    {
      id: 'oublies',
      titre: 'Les réacteurs qu’on a oubliés',
      texte: [
        'Les réacteurs qu’on a oubliés.',
        'Il n’existe pas qu’une seule façon de construire un réacteur. Aux États-Unis, à Oak Ridge, un petit réacteur expérimental a fonctionné de mille neuf cent soixante-cinq à mille neuf cent soixante-neuf avec un combustible liquide, dissous dans des sels fondus. D’autres rêvent d’utiliser le thorium, un métal environ trois fois plus courant que l’uranium : aucune centrale ne l’utilise encore, mais la Chine et l’Inde font des essais.',
        'En France, Superphénix, un réacteur géant dit à neutrons rapides, pouvait fabriquer une partie de son propre combustible. Souvent à l’arrêt et très contesté, il a été fermé par le gouvernement à la fin des années quatre-vingt-dix, et son successeur, Astrid, a été abandonné en deux mille dix-neuf. Certaines de ces idées reviennent aujourd’hui dans des projets de petits réacteurs.',
        'Le savais-tu ? La plupart des centrales du monde utilisent la même technique : de l’eau sous pression, qui chauffe et refroidit à la fois le cœur du réacteur.',
      ],
    },
    {
      id: 'france',
      titre: 'La France, pays du nucléaire',
      texte: [
        'La France, pays du nucléaire.',
        'La France compte cinquante-sept réacteurs, répartis dans dix-huit centrales. Ils produisent environ les deux tiers de son électricité, la plus grande part au monde.',
        'Mais construire de nouveaux réacteurs s’est révélé difficile. Le dernier, à Flamanville, en Normandie, a été commencé en deux mille sept et branché fin deux mille vingt-quatre, avec douze ans de retard. Il a coûté près de vingt-quatre milliards d’euros intérêts compris selon la Cour des comptes, au lieu des trois virgule trois milliards prévus. En deux mille vingt-deux, le gouvernement a annoncé six nouveaux réacteurs ; le premier pourrait démarrer vers deux mille trente-huit.',
        'Le savais-tu ? Sur toute sa durée de vie, une centrale nucléaire émet à peu près aussi peu de C O deux qu’une éolienne pour chaque kilowattheure produit, et environ soixante-dix fois moins qu’une centrale à charbon.',
      ],
    },
    {
      id: 'dechets',
      titre: 'Le casse-tête des déchets',
      texte: [
        'Le casse-tête des déchets.',
        'Le nucléaire produit des déchets radioactifs, mais pas tous dangereux de la même façon. La plupart sont très peu actifs : des gants, des outils, des gravats. Les plus dangereux, ceux de haute activité, ne représentent qu’une toute petite partie du volume, mais presque toute la radioactivité.',
        'Ces déchets-là doivent être isolés pendant des milliers d’années. La France prévoit de les ranger à cinq cents mètres sous terre, à Bure, dans une couche d’argile restée immobile depuis des millions d’années : c’est le projet Cigéo, pas encore autorisé. Pour certains, c’est la meilleure solution ; pour d’autres, c’est un héritage lourd laissé aux générations futures.',
        'Le savais-tu ? Les déchets de haute activité ne représentent qu’environ zéro virgule deux pour cent du volume des déchets radioactifs français, à peu près deux piscines olympiques, mais environ quatre-vingt-dix-sept pour cent de leur radioactivité.',
      ],
    },
    {
      id: 'guerre',
      titre: 'Une centrale au cœur de la guerre',
      texte: [
        'Une centrale au cœur de la guerre. Depuis deux mille vingt-deux.',
        'En Ukraine, la centrale de Zaporijjia est la plus grande d’Europe, avec six réacteurs. Depuis mars deux mille vingt-deux, elle est occupée par l’armée russe. Ses réacteurs sont à l’arrêt mais doivent toujours être refroidis, et les combats lui ont coupé l’électricité plus de vingt fois. Des experts de l’Agence internationale de l’énergie atomique vivent sur place depuis deux mille vingt-deux pour surveiller la sûreté.',
        'Une centrale n’a jamais été conçue pour se trouver sur un champ de bataille. Cette situation inquiète le monde entier.',
      ],
    },
    {
      id: 'danger',
      titre: 'Danger ou solution ?',
      texte: [
        'Danger ou solution ? À vous de vous faire une idée.',
        'Pour certains, le nucléaire est indispensable pour le climat : il produit beaucoup d’électricité, jour et nuit, presque sans C O deux. Pour d’autres, il coûte trop cher, prend trop de temps à construire, laisse des déchets pour très longtemps, et un accident ou une guerre peuvent avoir des conséquences terribles.',
        'Les deux camps ont des arguments sérieux. Les scientifiques sont d’accord sur un point : pour limiter le réchauffement, il faut arrêter de brûler du charbon, du pétrole et du gaz. La vraie question, c’est comment, et à quel prix.',
        'Le savais-tu ? En comptant les accidents et la pollution de l’air, le charbon cause des centaines de fois plus de décès que le nucléaire pour la même quantité d’électricité produite.',
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
