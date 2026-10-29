# Science et vie

Des vidéos de science transformées en sites animés et en mini-jeux, pensés pour le téléphone.
Sur la page d'accueil, chacun touche son prénom :

- **Lya et Ertan** (10-12 ans) arrivent sur les versions complètes, dans les dossiers des thèmes ;
- **Eline, Naïm et Alicia** arrivent sur les versions des petits, dans `petits/` : trois ou quatre chapitres
  aux textes très simples, moins de jeux, plus courts et plus faciles, et un petit quiz.

Le prénom choisi suit l'enfant (`?joueur=lya`) : c'est lui qui guide tous les mini-jeux, et il est déjà coché au quiz.
Le quiz final se joue aussi avec Siham, qui a ses propres questions de grande.
Les joueurs de chaque site sont dans `js/site.js`, leurs prénoms et leurs visages dans `js/kids.js`
(photos pour Naïm, Alicia et Siham ; un galet à l'initiale pour Lya, Ertan et Eline, en attendant leurs photos).

| Thème | Version complète | Version des petits | D'après |
| --- | --- | --- | --- |
| Qui a fabriqué la Terre ? L'histoire de la Terre et de la vie, des poussières d'étoiles aux dinosaures et aux humains | [`vie-sur-terre/`](vie-sur-terre/) | [`petits/vie-sur-terre/`](petits/vie-sur-terre/) | « Terre, les forces du vivant », ARTE, 2025 |
| La Terre a-t-elle de la fièvre ? Roches, CO2 et climat | [`thermostat/`](thermostat/) | [`petits/thermostat/`](petits/thermostat/) | Vidéo de Christophe Pauly, 2026 |
| Le nucléaire, c'est dangereux ? Ce qu'on croit et ce que disent les chiffres | [`atome/`](atome/) | [`petits/atome/`](petits/atome/) | Vidéo de Christophe Pauly, 2026 |
| Un mini-soleil pour nous sauver ? La fusion nucléaire, ses records et ses défis | [`fusion/`](fusion/) | [`petits/fusion/`](petits/fusion/) | « Fusion nucléaire, les promesses d'une énergie », ARTE, 2023 |

Chaque site a aussi un studio d'enregistrement (`studio.html`) pour lire les textes avec sa propre voix.
Les lectures enregistrées vivent dans `<site>/audio/<chapitre>.mp3` (mono, volume égalisé) ; sans fichier, c'est la voix du téléphone qui lit.
Versions complètes déjà lues par Romain : `fusion/`, `thermostat/`, `atome/` (leurs introductions et les phrases
qui annoncent le quiz nomment encore Naïm et Alicia). Les versions des petits n'ont pas encore d'enregistrement.

Le site est en ligne sur https://esperidad-tech.github.io/Science-et-vie/ : GitHub Pages le publie depuis la branche `main`
(`gh-pages` en reste une copie). Après chaque modification : `git push origin main main:gh-pages`.
