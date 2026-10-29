# Roche mère

Un site animé, pensé pour le téléphone, qui raconte en mini-jeux l'histoire de la Terre et de la vie :
4,5 milliards d'années de dialogue entre les roches et le vivant.

C'est une adaptation libre et ludique du documentaire **« Terre, les forces du vivant »** de Matthieu Maillet
(ARTE, 2025) : [voir le film sur YouTube](https://www.youtube.com/watch?v=sD-eYTd2fpE).
Tous les dessins et les jeux sont faits en code, sans aucune image du film.

## Les chapitres

| Chapitre | Jeu | Fichier |
| --- | --- | --- |
| Poussières d'étoiles | Taper pour faire se percuter les poussières | `js/games/poussiere.js` |
| La Lune, née d'un choc | Lancer Théia à la fronde | `js/games/theia.js` |
| Refroidir, puis pleuvoir | Frotter la lave, puis faire pleuvoir | `js/games/magma.js` |
| La recette de la vie | Réunir chaleur, eau et minéraux, puis diviser les cellules | `js/games/recette.js` |
| Les fabricants d'oxygène | Faire respirer les cyanobactéries | `js/games/oxygene.js` |
| La vie, créatrice de minéraux | Trier des cartes de minéraux | `js/games/mineraux.js` |
| La vie s'attaque à la roche nue | Volcan, lichens, puis forêt | `js/games/ile.js` |
| Le plancton bâtisseur de falaises | Neige de plancton, soulèvement, érosion | `js/games/craie.js` |
| Peindre avec la roche | Atelier de peinture aux pigments minéraux | `js/games/ocre.js` |
| Le dialogue continue | L'oursin qui creuse, la poussière du Namib | `js/games/oursin.js`, `js/games/namib.js` |
| Des roches fabriquées par les humains | Retrouver les roches humaines sur la plage | `js/games/anthropocene.js` |
| Toute l'histoire en 24 heures | Faire tourner l'aiguille | `js/games/horloge.js` |
| Es-tu incollable ? | Quiz de 10 questions | `js/games/quiz.js` |

## Comment c'est construit

- `index.html` : tous les textes des chapitres.
- `css/style.css` : couleurs de chaque chapitre (une « strate » par chapitre), typographie, mise en page.
- `js/lib.js` : outils communs (dessin, gestes au doigt, sons, vibrations).
- `js/main.js` : la frise du temps en haut de l'écran, le sommaire, le son, et le lancement des jeux.
- `js/games/*.js` : un fichier par mini-jeu. Les textes de chaque jeu sont regroupés en haut du fichier.

Aucune installation : ce sont des fichiers HTML, CSS et JavaScript simples. Pour tester sur un ordinateur :

```
python3 -m http.server 8000
```

puis ouvrir http://localhost:8000.

## Mise en ligne

Le site est publié avec GitHub Pages (Settings → Pages → Deploy from a branch → `main`, dossier `/ (root)`).
