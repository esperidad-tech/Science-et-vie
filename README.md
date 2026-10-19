# Science et vie

Des vidéos de science transformées en sites animés et en mini-jeux, pensés pour le téléphone,
pour Naïm et Alicia. Le quiz final de chaque thème se joue aussi avec Siham, qui a ses propres questions de grande.

| Thème | Dossier | D'après |
| --- | --- | --- |
| Qui a fabriqué la Terre ? L'histoire de la Terre et de la vie, des poussières d'étoiles aux dinosaures et aux humains | [`vie-sur-terre/`](vie-sur-terre/) | « Terre, les forces du vivant », ARTE, 2025 |
| La Terre a-t-elle de la fièvre ? Roches, CO2 et climat | [`thermostat/`](thermostat/) | Vidéo de Christophe Pauly, 2026 |
| Le nucléaire, c'est dangereux ? Ce qu'on croit et ce que disent les chiffres | [`atome/`](atome/) | Vidéo de Christophe Pauly, 2026 |
| Un mini-soleil pour nous sauver ? La fusion nucléaire, ses records et ses défis | [`fusion/`](fusion/) | « Fusion nucléaire, les promesses d'une énergie », ARTE, 2023 |

Chaque thème vit dans son propre dossier ; la page d'accueil (`index.html`) les liste.
Chaque thème a aussi un studio d'enregistrement (`<thème>/studio.html`) pour lire les textes avec sa propre voix.
Les lectures enregistrées vivent dans `<thème>/audio/<chapitre>.mp3` (mono, volume égalisé) ; sans fichier, c'est la voix du téléphone qui lit.
Thèmes déjà lus par Romain : `fusion/`.
Le site est en ligne sur https://esperidad-tech.github.io/Science-et-vie/ : GitHub Pages le publie depuis la branche `gh-pages`,
copie exacte de `main`. Après chaque modification, pousser les deux : `git push origin main main:gh-pages`.
