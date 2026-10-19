/* Textes lus à voix haute, chapitre par chapitre (un mini-soleil pour nous sauver ?).
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
        'Salut Naïm, salut Alicia ! Aujourd’hui, une grande question : peut-on fabriquer un mini-soleil pour nous sauver ?',
        'Fabriquer sur Terre le feu des étoiles, avec un carburant tiré de l’eau de mer et sans C O deux : c’est le grand pari de la fusion.',
        'Au cœur du Soleil, de minuscules noyaux se collent et libèrent une énergie fabuleuse. Depuis plus de soixante-dix ans, des savants du monde entier essaient de rallumer ce feu dans des machines. Ils ont battu des records incroyables, mais aucune centrale à fusion n’existe encore. Alors, promesse ou solution ?',
        'Pour commencer, serrez le cœur du Soleil pour l’allumer !',
      ],
    },
    {
      id: 'moteur',
      titre: 'Le moteur du Soleil',
      texte: [
        'Le moteur du Soleil. Mille neuf cent vingt.',
        'Chaque jour, le Soleil t’éclaire et te réchauffe. Mais d’où vient toute cette énergie ? En mille neuf cent vingt, un savant anglais, Arthur Eddington, a une idée de génie : le Soleil fabrique son énergie en collant ensemble de minuscules grains de matière.',
        'Ces grains s’appellent des noyaux d’atomes. Au cœur du Soleil, quatre noyaux d’hydrogène se collent pour former un noyau d’hélium, le gaz qui fait flotter les ballons. Le noyau d’hélium est un tout petit peu plus léger que les quatre noyaux de départ. Le petit morceau qui manque s’est changé en lumière et en chaleur. C’est ça, la fusion !',
        'Au cœur du Soleil, il fait environ quinze millions de degrés. Et chaque seconde, le Soleil transforme six cents millions de tonnes d’hydrogène en hélium.',
        'Le savais-tu ? Le morceau qui disparaît est minuscule : moins d’un centième du poids de départ. Et pourtant, c’est lui qui fait briller le Soleil !',
      ],
    },
    {
      id: 'noyaux',
      titre: 'Coller au lieu de casser',
      texte: [
        'Coller au lieu de casser. Mille neuf cent trente-quatre.',
        'En mille neuf cent trente-quatre, en Angleterre, l’équipe du savant Ernest Rutherford réussit pour la première fois à faire fusionner des noyaux dans un laboratoire. C’est une grande découverte, mais pas encore une machine à fabriquer de l’énergie.',
        'Attention à ne pas confondre ! Les centrales nucléaires d’aujourd’hui cassent de gros noyaux : c’est la fission. La fusion fait l’inverse : elle colle de tout petits noyaux. Pas facile : les noyaux se repoussent, un peu comme deux aimants qui ne veulent pas se coller. Il faut les lancer très, très vite pour qu’ils se touchent.',
        'Les chercheurs ont un duo préféré : le deutérium et le tritium, deux sortes d’hydrogène. En se collant, ils donnent un noyau d’hélium et un neutron, une minuscule particule qui file à toute vitesse. À poids égal, ça donne près de quatre millions de fois plus d’énergie que brûler du charbon ou du pétrole ! Et le deutérium se trouve dans l’eau de mer.',
        'Le savais-tu ? Le tritium a été découvert pendant ces expériences de mille neuf cent trente-quatre. Et dans chaque litre d’eau de mer, il y a trente-trois milligrammes de deutérium.',
      ],
    },
    {
      id: 'cage',
      titre: 'Une cage invisible',
      texte: [
        'Une cage invisible. Les années cinquante.',
        'Sur Terre, il n’y a pas l’énorme poids du Soleil pour serrer les noyaux les uns contre les autres. Alors on chauffe encore plus : environ cent cinquante millions de degrés, dix fois plus chaud que le cœur du Soleil ! À cette température, le gaz devient un plasma : les électrons se détachent des noyaux. Les éclairs et les aurores boréales sont aussi des plasmas.',
        'Aucun mur ne résiste à un plasma si chaud. Alors les savants inventent une cage invisible, faite d’aimants géants, qui tient le plasma au milieu sans qu’il touche les parois. En mille neuf cent cinquante et un, aux États-Unis, Lyman Spitzer imagine le stellarator, un anneau tout tordu. En Union soviétique, Andreï Sakharov et Igor Tamm imaginent le tokamak, un anneau en forme de beignet. Le premier tokamak s’allume vers mille neuf cent cinquante-huit.',
        'Et si quelque chose se dérègle ? Le plasma refroidit en quelques secondes et la réaction s’arrête toute seule. Pas d’emballement possible.',
        'Le savais-tu ? En mille neuf cent cinquante-cinq, le savant indien Homi Bhabha prédisait qu’on saurait maîtriser la fusion dans les vingt prochaines années. Plus de soixante-dix ans après, on cherche encore !',
      ],
    },
    {
      id: 'thermometre',
      titre: 'Le thermomètre laser',
      texte: [
        'Le thermomètre laser. Mille neuf cent soixante-neuf.',
        'En mille neuf cent soixante-huit, les savants soviétiques annoncent que leur tokamak T 3 a atteint dix millions de degrés. C’est tellement fort que c’est difficile à croire ! À cette époque, l’Est et l’Ouest se méfient l’un de l’autre : c’est la guerre froide.',
        'En mille neuf cent soixante-neuf, une équipe anglaise part à Moscou avec cinq tonnes de matériel et un laser qui sert de thermomètre. Après quatre-vingt-huit mesures, le verdict tombe : environ dix millions de degrés. Les Soviétiques avaient dit vrai !',
        'Après ça, le monde entier se met à construire des tokamaks. Aux États-Unis, les chercheurs de Princeton transforment même leur stellarator en tokamak.',
        'Le savais-tu ? Tokamak est un mot russe raccourci. Il veut dire chambre en forme d’anneau avec des bobines magnétiques.',
      ],
    },
    {
      id: 'jet',
      titre: 'JET, le champion des records',
      texte: [
        'Jet, le champion des records. De mille neuf cent quatre-vingt-trois à deux mille vingt-trois.',
        'En mille neuf cent quatre-vingt-trois, près d’Oxford, en Angleterre, l’Europe allume un grand tokamak : Jet. Pendant quarante ans, il va battre des records.',
        'En mille neuf cent quatre-vingt-dix-sept, pendant un très court instant, Jet produit environ les deux tiers de l’énergie qu’il faut pour chauffer son plasma. En deux mille vingt et un, il tient une forte production pendant cinq secondes. Et en deux mille vingt-trois, pour sa toute dernière campagne, il produit soixante-neuf mégajoules avec seulement zéro virgule deux milligramme de combustible !',
        'Fin décembre deux mille vingt-trois, Jet s’est arrêté pour de bon. Ses expériences ont servi à préparer Iter, le géant qui se construit en France.',
        'Le savais-tu ? Soixante-neuf mégajoules, c’est à peu près l’énergie contenue dans deux litres d’essence. Un super record pour la science, mais encore très loin d’une centrale électrique.',
      ],
    },
    {
      id: 'iter',
      titre: 'ITER, le géant de Provence',
      texte: [
        'Iter, le géant de Provence. Depuis deux mille six.',
        'En deux mille six, à Paris, sept partenaires signent un accord : l’Europe, la Chine, l’Inde, le Japon, la Corée du Sud, la Russie et les États-Unis. Ensemble, plus de trente pays vont construire le plus grand tokamak du monde : Iter, en Provence, tout près de Cadarache.',
        'Iter pèsera vingt-trois mille tonnes, autant que trois tours Eiffel. Son plasma montera à cent cinquante millions de degrés, alors que ses aimants géants seront refroidis à moins deux cent soixante-neuf degrés ! Son but : produire dix fois plus d’énergie de fusion qu’on en met pour chauffer le plasma. Mais Iter ne fabriquera pas d’électricité : c’est une expérience géante.',
        'Le chantier est très compliqué et a pris beaucoup de retard. Les premiers essais sont prévus en deux mille trente-quatre, et le vrai mélange deutérium-tritium en deux mille trente-neuf. En juillet deux mille vingt-six, six des neuf énormes morceaux de l’anneau étaient en place.',
        'Le savais-tu ? Chaque morceau de l’anneau pèse environ mille cent tonnes. Et il faut le poser au millimètre près !',
      ],
    },
    {
      id: 'lasers',
      titre: '192 lasers sur un grain de poivre',
      texte: [
        'Cent quatre-vingt-douze lasers sur un grain de poivre. Le cinq décembre deux mille vingt-deux.',
        'En Californie, au laboratoire NIF, on essaie une autre méthode : pas d’aimants, mais des lasers. Cent quatre-vingt-douze lasers géants tirent tous en même temps sur une bille de combustible grosse comme un grain de poivre. La bille est écrasée si fort que ses noyaux fusionnent.',
        'Le cinq décembre deux mille vingt-deux, c’est l’exploit : les lasers envoient deux virgule zéro cinq mégajoules sur la cible, et la fusion en rend trois virgule quinze. Pour la première fois, la cible donne plus d’énergie qu’elle n’en reçoit ! Jusqu’en juin deux mille vingt-six, le NIF a réussi ce tour de force onze fois, avec un record de huit virgule six mégajoules en avril deux mille vingt-cinq.',
        'Mais attention : pour allumer ses lasers, la machine a pris environ trois cents mégajoules sur le réseau électrique. Et une centrale devrait recommencer environ dix fois par seconde ! En Allemagne, Markus Roth et son entreprise Focused Energy veulent relever ce défi.',
        'Le savais-tu ? Markus Roth compare la fusion d’aujourd’hui au premier vol des frères Wright, en mille neuf cent trois : douze secondes et environ trente-sept mètres. Ce n’était pas encore un avion de ligne, mais c’était un début !',
      ],
    },
    {
      id: 'marathon',
      titre: 'Le marathon du plasma',
      texte: [
        'Le marathon du plasma. Deux mille vingt-cinq.',
        'Une centrale devra garder son plasma allumé très longtemps, pas juste quelques secondes. Alors les chercheurs font des marathons !',
        'En janvier deux mille vingt-cinq, le tokamak chinois East garde un plasma très performant pendant mille soixante-six secondes, presque dix-huit minutes. Quelques semaines plus tard, le douze février deux mille vingt-cinq, le tokamak français West, à Cadarache, tient un plasma pendant mille trois cent trente-sept secondes : plus de vingt-deux minutes, à cinquante millions de degrés ! C’est le record du monde de durée pour un tokamak.',
        'En Allemagne, le stellarator Wendelstein sept X, l’anneau tordu, peut en principe fonctionner sans s’arrêter. Il a tenu plus de huit minutes en deux mille vingt-trois et vise trente minutes.',
        'Le savais-tu ? Wendelstein sept X a cinquante bobines d’aimants tordues comme des rubans. C’est grâce à elles qu’il n’a pas besoin de s’arrêter, contrairement aux tokamaks.',
      ],
    },
    {
      id: 'cassetetes',
      titre: 'Les trois casse-têtes',
      texte: [
        'Les trois casse-têtes.',
        'Premier casse-tête : le tritium. Il est très rare : il n’en existe qu’une vingtaine de kilos sur toute la Terre. En plus, il disparaît tout seul : la moitié s’en va en douze ans. Une future centrale devra donc fabriquer son propre tritium avec du lithium, un métal léger qu’on trouve aussi dans les batteries. Iter va tester comment faire.',
        'Deuxième casse-tête : les murs. Les neutrons de la fusion bombardent les parois, les abîment et les rendent radioactives pour des dizaines d’années. Il faut inventer des matériaux plus solides : en deux mille vingt-cinq, on a commencé à construire à Grenade, en Espagne, un laboratoire spécial pour les tester.',
        'Troisième casse-tête : le temps et l’argent. Iter coûte des dizaines de milliards d’euros. Au départ, on espérait le démarrer en deux mille seize ; ce sera plutôt en deux mille trente-quatre. D’où la blague des chercheurs : la fusion, c’est dans trente ans, et ce sera toujours dans trente ans !',
        'Le savais-tu ? Un seul gramme de tritium coûte environ trente mille dollars !',
      ],
    },
    {
      id: 'promesse',
      titre: 'Une promesse pour demain',
      texte: [
        'Une promesse pour demain.',
        'Aujourd’hui, des dizaines d’entreprises veulent aller plus vite qu’Iter. Aux États-Unis, Commonwealth Fusion Systems construit Sparc, un tokamak plus petit aux aimants super puissants, et espère l’allumer en deux mille vingt-sept. Helion a promis de l’électricité à Microsoft : sa centrale doit commencer à fonctionner fin deux mille vingt-huit, mais pas à pleine puissance avant deux mille vingt-neuf ou deux mille trente. Pour l’instant, aucune centrale à fusion n’existe encore.',
        'Et le climat ? La fusion ne rejette pas de C O deux, le gaz qui réchauffe la planète. Mais selon les académies des sciences allemandes, elle arrivera trop tard pour aider avant deux mille quarante-cinq ou deux mille cinquante. Pour protéger la planète dès maintenant, il faut surtout utiliser les énergies bas carbone qui existent déjà : le soleil, le vent, l’eau des barrages et les centrales nucléaires d’aujourd’hui.',
        'Plus tard dans le siècle, quand vous serez grands, la fusion pourrait devenir une grande source d’électricité, si les chercheurs arrivent à la rendre fiable et pas trop chère. C’est une belle promesse, pas encore une solution. Et c’est peut-être l’un de vous qui trouvera la clé !',
        'Le savais-tu ? En deux mille vingt-six, soixante et onze pour cent des entreprises de fusion pensent que leur première centrale donnera de l’électricité dans les années deux mille trente. Les académies des sciences, elles, parlent plutôt de vingt à vingt-cinq ans d’attente. Qui aura raison ?',
        'Et maintenant, Naïm, Alicia et Siham, place au quiz !',
      ],
    },
  ];

  /* Enregistrements de la voix du conteur (Romain), un fichier par chapitre : audio/<id>.mp3.
     Fichiers du studio passés en mono, silences coupés, volume égalisé. */
  const AUDIO = {};
  CHAPITRES.forEach((c) => { AUDIO[c.id] = 'audio/' + c.id + '.mp3'; });

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
