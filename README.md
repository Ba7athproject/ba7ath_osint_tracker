# Ba7ath OSINT Tracker - Manual Tagger

Ba7ath OSINT Tracker est un outil universel d'extraction manuelle (NER - Named Entity Recognition) conçu pour les enquêtes en sources ouvertes (OSINT). Il permet d'importer des jeux de données, d'analyser du texte, et d'extraire rapidement des entités (Entreprises, Autorités, Personnes) avec une interface utilisateur fluide. 

Visant la sécurité et la confidentialité, toutes les données traitées via l'application restent strictement locales dans le navigateur de l'utilisateur.

## Fonctionnalités Principales

- **Importation Multi-formats :** Accepte les fichiers classiques `.csv` via PapaParse, ainsi que les tableurs Excel `.xlsx` via SheetJS.
- **Support Multilingue Avancé :** Détection automatique Regex des mots contenant des initiales majuscules latines et cyrilliques pour repérer visuellement les cibles potentielles.
- **Raccourcis Clavier (Hotkeys) :** Optimisez votre temps de qualification en utilisant `1`, `2`, `3` pour sélectionner la catégorie de l'entité, et `Entrée` pour la valider.
- **Qualificateur de Context (Note) :** Un champ optionnel de Notes pour expliquer brièvement *pourquoi* une cible a été rattachée (ex: "actionnaire majoritaire de XYZ").
- **Moteur de Recherche Intégrée :** Barre de recherche rapide dynamique pour investiguer et retrouver instantanément un terme précis parmi un document (par ID ou Nom).
- **Mode Sombre Natif :** Bouton de la barre d'outils (Toggling) pour basculer en mode sombre afin de reposer la vue en cas d'analyse prolongée.
- **Sauvegarde et Auto-focus :** Sauvegarde transparente de la session dans le Local Storage, auto-focus intuitif lors de la sélection du texte à analyser, et retour ascendant du document à chaque chargement de la source suivante.
- **Architecture Maintenable :** Code refactorisé en de multiples composants React (`UploadView`, `WorkspaceView`, `ConfigureView`) exploitant le hook personnalisé `useLocalStorage`.

## Prérequis

Pour exécuter le projet localement, assurez-vous d'avoir installé les outils suivants sur votre environnement :

- [Node.js](https://nodejs.org/) (Version 16.0 ou supérieure recommandée)
- npm (Généralement inclus avec Node.js) ou yarn / pnpm

## Installation et Lancement

1. **Cloner le dépôt et accéder au répertoire du projet :**
   ```bash
   git clone https://github.com/Ba7athproject/ba7ath_osint_tracker.git
   cd ba7ath-tagger
   ```

2. **Installer les dépendances :**
   ```bash
   npm install
   ```

3. **Démarrer le serveur de développement :**
   ```bash
   npm run dev
   ```

4. Ouvrez votre navigateur et accédez à l'URL locale (généralement `http://localhost:5173/`).

## Utilisation

1. **Chargement des Données :** À l'ouverture de l'application, importez un fichier `.csv` contenant les données à analyser.
2. **Configuration :** Indiquez au système quelles colonnes correspondent à l'Identifiant (ID/UUID), au Nom/Titre, et au Texte.
3. **Analyse et Annotation :** Lisez les textes affichés à l'écran. Sélectionnez les entités pertinentes à l'aide de votre souris.
4. **Catégorisation :** Choisissez la catégorie correspondante (Entreprise, Autorité, Personne) et ajoutez-la à la liste des cibles extraites.
5. **Exportation :** Une fois le jeu de données analysé, exportez vos résultats via le bouton "Exporter CSV" situé en haut à droite.

## Technologies Utilisées

- **React / Vite :** Base du frontend, assurant rapidité de développement et fluidité.
- **Tailwind CSS v4 :** Pour la gestion native des classes utilitaires en mode Light/Dark de manière réactive.
- **PapaParse & SheetJS (xlsx) :** Bibliothèques JavaScript de référence pour assurer la lecture des bases CSV et des classeurs Excel purement côté client.
- **Lucide React :** Pack d'icônes vectorielles légères et élégantes pour concevoir des IHM métier de qualité.

## Contribution

Les contributions sont les bienvenues ! Si vous souhaitez améliorer ce projet ou ajouter de nouvelles fonctionnalités, n'hésitez pas à :

1. Créer un *Fork* du projet.
2. Créer une branche spécifique à votre fonctionnalité (`git checkout -b feature/NouvelleFonctionnalite`).
3. Faire un *Commit* de vos modifications (`git commit -m 'Ajout d'une nouvelle fonctionnalité'`).
4. Faire un *Push* sur la branche (`git push origin feature/NouvelleFonctionnalite`).
5. Ouvrir une *Pull Request*.

## Licence

Ce projet est sous licence MIT - voir le fichier [LICENSE](./LICENSE) pour plus de détails.
