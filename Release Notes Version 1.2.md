# 🚀 Release Notes — Ba7ath OSINT Tracker v1.2

Cette version majeure transforme **Ba7ath OSINT Tracker** en une plateforme de renseignement industrielle, alliant puissance de calcul locale, ergonomie avancée et outils de collaboration inédits.

---

## 💎 Innovations Majeures

### 📊 Dashboard Analytique Dynamique
Visualisez vos progrès et la structure de vos données en temps réel :
- **Tableau de bord interactif** : Suivi de la couverture globale, répartition par type d'entités (Donut Chart) et top 10 des "Hot Targets".
- **Audit de Qualité & Fusion** : Détection automatique des variantes (ex: *"TOTAL"* vs *"Total"*) avec un système d'alerte pulsante et fusion intelligente en un clic.
- **Suggestions Intelligentes** : L'interface vous suggère désormais les entités déjà connues pour garantir une base de données propre.

### 💾 Infrastructure "Big Data" (IndexedDB)
Le passage au stockage **IndexedDB** (`localforage`) change la donne :
- **Capacité quasi illimitée** : Traitez des milliers de sources sans saturation du navigateur.
- **Auto-Save & Restauration** : Reprenez votre travail exactement là où vous l'avez laissé.
- **Migration Furtive** : Transfert automatique de vos anciennes données v1.0 vers le nouveau moteur.

### ⚡ Performances & Fluidité
- **Virtualisation Textuelle** : Rendu ultra-rapide des documents de plusieurs dizaines de pages (60 FPS).
- **Memoized Regex Engine** : Détection de patterns 5 fois plus performante pour le pré-tagging.

---

## 🛠️ Personnalisation & Flexibilité Totale

### 🎨 Gestion des Catégories & Icônes
- **Système de Modèles (Templates)** : Sauvegardez vos configurations de catégories (icônes, couleurs, types) comme modèles réutilisables pour différentes enquêtes.
- **Édition à la volée** : Ajoutez ou supprimez des types d'entités avec un catalogue d'icônes Lucide intégré et une palette de couleurs OSINT dédiée.

### 📂 Configuration Multi-Sources & Métadonnées
- **Extraction Champs Multiples** : Sélectionnez plusieurs colonnes de texte de votre CSV original pour les fusionner dans une vue d'analyse unique.
- **Choix des Métadonnées** : C'est vous qui décidez quelles colonnes d'information (date, source, auteur, etc.) apparaissent dans votre espace de travail.
- **Recherche Globale** : Indexation instantanée de tous les champs pour retrouver une cible en un clin d'œil.

---

## 🤝 Collaboration & Travail d'Équipe

- **Export/Import de Session** : Exportez l'intégralité de votre environnement (données, extractions, config) dans un fichier `.json`.
- **Interopérabilité** : Partagez vos fichiers de session avec vos collègues pour une vérification croisée (Peer-Review) ou une fusion de bases de données.

---

## 🚀 Améliorations UX/UI
- **🌑 Mode Sombre Natif** : Un confort visuel total pour les enquêtes nocturnes.
- **⌨️ Raccourcis 2.0** : Utilisation de `Alt + [1-9]` pour la catégorisation sans quitter le clavier lors de la saisie.
- **📥 Moteur d'Export Graphe** : Amélioration des exports Nodes/Edges pour Neo4J, Gephi et KUMU.

---

> [!IMPORTANT]
> **Stabilité** : Cette version corrige également les erreurs de syntaxe rencontrées sur certains environnements Windows et assure un "trim" automatique des noms pour une propreté parfaite.

*Ba7ath OSINT — Par les enquêteurs, pour la justice.*
