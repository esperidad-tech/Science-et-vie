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
        'Salut Naïm, salut Alicia ! Aujourd’hui, une grande question : le nucléaire, c’est dangereux ?',
        'On en a eu très peur. Mais que disent vraiment les chiffres ? On mène l’enquête, de la bombe aux centrales.',
        'Au cœur de chaque atome se cache une énergie fabuleuse. Elle a d’abord servi à fabriquer des bombes, et c’est pour ça qu’elle fait si peur. Pourtant, depuis plus de soixante-dix ans, elle éclaire des villes entières en rejetant très peu de C O deux, et les chiffres montrent qu’elle fait partie des façons les plus sûres de produire de l’électricité.',
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
        'Le savais-tu ? Une centrale nucléaire ne peut pas exploser comme une bombe atomique : son uranium contient moins de cinq pour cent de la sorte d’uranium qui se casse facilement, alors qu’une bombe en demande environ quatre-vingt-dix pour cent.',
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
        'À Tchernobyl, en Ukraine, alors en Union soviétique, un essai de sécurité tourne mal dans un réacteur mal conçu. La réaction s’emballe : en quelques secondes, la puissance est multipliée par cent. Le combustible brûlant transforme l’eau d’un coup en vapeur, qui fait sauter le réacteur comme le couvercle d’une cocotte-minute géante, puis le graphite prend feu. Ce n’est pas une explosion atomique, mais la radioactivité s’envole jusque dans toute l’Europe.',
        'Une trentaine de pompiers et d’employés meurent dans les semaines qui suivent. Des milliers d’enfants de la région auront plus tard un cancer de la thyroïde, presque tous guéris, et le nombre de morts à long terme reste discuté. Selon l’Organisation mondiale de la santé, la peur des radiations, souvent plus grande que le danger réel, a aussi fait beaucoup de mal aux habitants. Aujourd’hui encore, une zone d’environ trente kilomètres autour de la centrale reste interdite. Depuis, les règles de sûreté ont été renforcées partout.',
        'Le savais-tu ? Le réacteur de Tchernobyl n’avait pas de grande enceinte de béton pour tout enfermer. Les centrales françaises en ont une.',
      ],
    },
    {
      id: 'fukushima',
      titre: 'Le tsunami et la centrale',
      texte: [
        'Le tsunami et la centrale. Le onze mars deux mille onze.',
        'Au Japon, un énorme séisme déclenche un tsunami. Des vagues de quatorze à quinze mètres passent par-dessus la digue de la centrale de Fukushima et noient les machines de secours. Sans refroidissement, le cœur de trois réacteurs fond.',
        'Le tsunami lui-même a fait environ dix-huit mille victimes. À cause de la radioactivité, plus de cent mille habitants ont dû quitter leur maison. Officiellement, les radiations ont tué un travailleur, mais l’évacuation, très dure pour beaucoup de personnes âgées, a fait plus de deux mille morts. Dix ans plus tard, les experts de l’ONU n’ont trouvé chez les habitants aucune maladie causée par les radiations. Depuis, partout dans le monde, on protège mieux les centrales contre l’eau et les pannes.',
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
        'La France compte cinquante-sept réacteurs, répartis dans dix-huit centrales. Ils produisent environ les deux tiers de son électricité, la plus grande part au monde. Résultat : en deux mille vingt-cinq, chaque kilowattheure produit en France a rejeté environ vingt grammes de C O deux. C’est environ neuf fois moins que la moyenne européenne, et plus de dix fois moins qu’en Allemagne, où le charbon et le gaz produisent encore une grande partie de l’électricité.',
        'Pourtant, pendant des années, le pays a hésité. En deux mille quinze, une loi prévoyait de faire baisser la part du nucléaire à la moitié de l’électricité. En deux mille vingt, la centrale de Fessenheim, en Alsace, a été arrêtée : ce n’est pas l’Autorité de sûreté qui l’avait demandé, c’était une décision politique. Et le dernier réacteur, à Flamanville, en Normandie, a pris douze ans de retard et coûté près de vingt-quatre milliards d’euros intérêts compris, au lieu des trois virgule trois milliards prévus.',
        'Depuis, la France a changé de cap. En deux mille vingt-trois, une loi a supprimé l’objectif de baisse. Le pays prévoit six nouveaux réacteurs, et peut-être huit autres ensuite : la décision finale est attendue fin deux mille vingt-six, et le premier pourrait démarrer en deux mille trente-huit.',
        'Le savais-tu ? Sur toute sa durée de vie, une centrale nucléaire émet à peu près aussi peu de C O deux qu’une éolienne pour chaque kilowattheure produit, et environ soixante-dix fois moins qu’une centrale à charbon.',
      ],
    },
    {
      id: 'dechets',
      titre: 'Les déchets, un problème sans solution ?',
      texte: [
        'Les déchets, un problème sans solution ?',
        'Le nucléaire produit des déchets radioactifs, mais pas tous dangereux de la même façon. La plupart sont très peu actifs : des gants, des outils, des gravats. Les plus dangereux, ceux de haute activité, ne représentent qu’une toute petite partie du volume, mais presque toute la radioactivité.',
        'Ces déchets-là doivent être isolés pendant des milliers d’années. La solution choisie : les enfermer très profond, dans une roche qui ne bouge plus. En Finlande, un stockage creusé à environ quatre cent trente mètres sous terre, Onkalo, est presque prêt à accueillir ceux des centrales : ce serait une première mondiale. L’autorité de sûreté finlandaise a donné son accord en août deux mille vingt-six ; il manque encore celui du gouvernement.',
        'En France, le projet Cigéo prévoit de les ranger à cinq cents mètres sous terre, à Bure, dans une argile vieille d’environ cent soixante millions d’années. En deux mille vingt-six, l’enquête publique a donné un avis favorable, mais le projet n’est pas encore autorisé : les premiers colis n’y descendraient pas avant deux mille cinquante environ.',
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
      titre: 'Alors, dangereux ?',
      texte: [
        'Alors, dangereux ? Ce que disent les chiffres.',
        'Pour fabriquer la même quantité d’électricité, le charbon cause environ huit cents fois plus de morts que le nucléaire, surtout à cause de la fumée qui pollue l’air. Et ce calcul compte les accidents de Tchernobyl et de Fukushima ! Le nucléaire fait partie des énergies les plus sûres, avec l’éolien et le solaire.',
        'Entre mille neuf cent soixante et onze et deux mille neuf, en remplaçant du charbon et du gaz, les centrales nucléaires du monde auraient évité environ un million huit cent mille morts dues à la pollution de l’air, selon deux chercheurs de la NASA. À l’inverse, quand l’Allemagne a fermé une partie de ses centrales après Fukushima, elle a surtout brûlé plus de charbon : selon une étude de deux mille vingt-deux, cette pollution a causé plus de mille cent morts de plus chaque année.',
        'Alors oui : si le monde avait construit plus de centrales nucléaires à la place des centrales à charbon, l’air serait plus sain et le climat se réchaufferait moins. On en a eu plus peur que nécessaire. Ce qui compte, c’est de surveiller la sûreté de très près, de ranger les déchets avec soin, et d’apprendre à construire plus vite et moins cher.',
        'Le savais-tu ? Dans une enquête célèbre de mille neuf cent quatre-vingt-sept, des Américains ont classé le nucléaire comme le plus dangereux de trente risques, devant la voiture. Les experts, eux, le mettaient au vingtième rang, et la voiture au premier !',
        'Et maintenant, Naïm, Alicia et Siham, place au quiz !',
      ],
    },
  ];

  /* Enregistrements de la voix du conteur : audio/<id>.mp3 */
  const AUDIO = {
    debut: 'audio/debut.mp3',
    origines: 'audio/origines.mp3',
    bombe: 'audio/bombe.mp3',
    centrale: 'audio/centrale.mp3',
    tchernobyl: 'audio/tchernobyl.mp3',
    fukushima: 'audio/fukushima.mp3',
    oublies: 'audio/oublies.mp3',
    france: 'audio/france.mp3',
    dechets: 'audio/dechets.mp3',
    guerre: 'audio/guerre.mp3',
    danger: 'audio/danger.mp3',
  };

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
