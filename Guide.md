# 🛡️ Ba7ath OSINT Tracker — Guide Complet & Notes de Version

<p align="center">
  <strong>Plateforme d'Intelligence Artificielle Souveraine pour l'Investigation et l'Extraction de Données en Sources Ouvertes (OSINT).</strong><br/>
  <em>"Vos données, votre intelligence, votre souveraineté."</em>
</p>

---

## 📖 Introduction
**Ba7ath OSINT Tracker** est un outil industriel conçu pour les journalistes d'investigation, les enquêteurs et les analystes. Son objectif est de transformer des masses de données textuelles brutes (issues de fuites de données, rapports, ou réseaux sociaux) en une base de données structurée et exploitable.

L'innovation majeure de Ba7ath réside dans sa **Souveraineté Totale** : tout le traitement — y compris l'Intelligence Artificielle de Deep Learning — s'exécute localement dans votre navigateur ou application desktop. Aucune donnée ne quitte votre machine.

---

## 🚀 Guide d'Utilisation

### 1. Chargement des Données
- **Imports supportés** : Fichiers CSV (via PapaParse) et Excel (.xlsx via SheetJS).
- **Moteur de Stockage** : Utilise **IndexedDB** (`localforage`) permettant de gérer des sessions massives (milliers de sources) sans saturation.
- **Auto-restauration** : En cas de fermeture accidentelle, votre session est sauvegardée en temps réel.

### 2. Configuration du Projet
Avant d'analyser, configurez votre environnement :
- **Mapping des colonnes** : Définissez quelle colonne contient l'ID unique, le titre, et le texte (supporte plusieurs colonnes de texte fusionnées).
- **Catégories Personnalisées** : Créez vos propres types d'entitées (ex: "Navire", "Code Swift", "Milice") avec des couleurs et icônes dédiées.
- **Règles de Surbrillance** : Activez la détection visuelle automatique des majuscules, acronymes ou termes juridiques.

### 3. L'Espace d'Analyse (Workspace)
- **Extraction Manuelle** : Sélectionnez n'importe quel texte à la souris pour l'associer instantanément à une catégorie.
- **IA NER (Intelligence Artificielle)** : Activez le moteur **DistilBERT** embarqué pour identifier automatiquement les Personnes, Organisations et Lieux.
- **Shadow Memory (Apprentissage)** : Nouveauté v1.7. Le système apprend de vos corrections. Si vous changez la catégorie d'une entité suggérée, l'IA s'en souviendra pour les analyses futures.
- **Liste Rouge (Ignore List)** : Bannissez définitivement les entités parasites ou bruits de fond pour qu'elles ne soient plus jamais suggérées ou surlignées.

### 4. Audit & Qualité
Accédez au **Stats Panel** pour vérifier la propreté de vos données :
- **Détection de Variantes** : L'algorithme de Levenshtein repère les noms similaires (ex: "TOTAL SA" et "Total").
- **Fusion Intelligente** : Unifiez les doublons en un clic en choisissant le nom de référence.

### 5. Exportation & Collaboration
- **Formats JSON NER** : Prêt pour le fine-tuning de modèles de langage.
- **Formats Graphes** : Nodes/Edges pour Gephi, Neo4J ou Kumu.
- **CSV Plat/Groupé** : Pour analyse dans Excel ou Python.
- **Session Portable** : Exportez un fichier `.json` contenant absolument tout (données + travail effectué) pour le partager avec un collègue.

---

## ⌨️ Maîtrise des Raccourcis Clavier

| Touche | Action |
|--------|--------|
| `←` / `→` | Naviguer entre les documents sources |
| `Entrée` | Valider la saisie ou la suggestion IA sélectionnée |
| `Échap` | Ignorer une suggestion IA |
| `Tab` | Naviguer cycliquement dans les suggestions IA |
| `Suppr` | Bannir l'entité sélectionnée (Ajout à la Liste Rouge) |
| `Alt + 1-9` | Assigner une catégorie rapidement (pendant la saisie) |
| `?` | Afficher l'aide contextuelle |

---

## 🚀 Historique des Versions & Innovations

### v1.0 — v1.1 : Fondations
- Moteur d'extraction basique et interface React.
- Export CSV et stockage LocalStorage.

### v1.2 : L'Ère Industrielle
- Passage à **IndexedDB** pour une capacité illimitée.
- Introduction du **Dashboard Analytique** et du **Donut Chart**.
- Premier moteur d'audit de qualité et fusion de variantes.

### v1.3 : Branding & UX Premium
- Identité visuelle v1.3 (Logo Ba7ath, design State-of-the-Art).
- Nettoyage automatique des caractères spéciaux (Alt-codes Windows).
- Optimisation des Regex pour les grands jeux de données.

### v1.6 : Intelligence Artificielle Embarquée
- Intégration de **Transformers.js** avec le modèle DistilBERT multilingue.
- **RAM Shield** : Hacks techniques pour allouer préventivement la mémoire et éviter les crashs navigateurs.
- **Web Workers** : IA isolée pour garantir une interface fluide (60 FPS).
- **Auto-hide Tooltips** : Les bulles IA ne gênent plus la lecture.

---

## 🆕 Notes de Version : v1.7.0 (Dernière Mise à Jour)

Cette version majeure introduit le concept de **"Cerveau Partagé"** entre l'homme et la machine.

### 🧠 1. Shadow Memory (Apprentissage Actif)
Le moteur NER ne se contente plus de prédire, il apprend. 
- **Human-in-the-Loop** : Chaque fois que vous validez une entité avec une catégorie différente de celle suggérée par l'IA, Ba7ath mémorise cette correction. 
- **Persistance Contextuelle** : Vos corrections sont stockées localement et appliquées prioritairement lors de chaque nouvelle analyse.
- **Gestionnaire Dédié** : Visualisez le nombre de corrections apprises dans le panneau de statistiques.

### 🚫 2. La Liste Rouge (Ignore List)
Un système puissant pour éliminer le "bruit" des enquêtes complexes.
- **Bannissement Global** : Ajoutez des entités à ignorer. Elles disparaîtront instantanément de la détection Regex (surlignage rouge) et des propositions de l'IA.
- **Panel de Gestion** : Une nouvelle interface permet de rechercher, retirer (unban) ou importer/exporter vos listes de bannissement au format JSON.
- **Raccourci de Bannissement** : Utilisez la touche `Suppr` sur une suggestion IA pour l'envoyer directement en Liste Rouge.

### 🛠️ 3. Optimisations & Fiabilité
- **Correction du Crash v1.7** : Résolution d'un problème d'import d'icônes bloquant le chargement.
- **Indicateurs Visuels** : Ajout d'un badge sur l'icône Liste Rouge pour signaler la présence d'entités ignorées.
- **Performance de Déduplication** : Raffinement de l'algorithme Levenshtein pour éviter les faux positifs lors de la validation IA.

---

## 🔒 Confidentialité & Sécurité
- **Pas de Cloud** : Aucune donnée n'est envoyée à un serveur externe.
- **Inférence Locale** : Le modèle IA est téléchargé une seule fois, puis s'exécute localement.
- **Code Open Source** : Transparence totale pour les audits de sécurité.

---
*Ba7ath OSINT Tracker v1.7.0 — Conçu pour une investigation rigoureuse, transparente et souveraine.*
