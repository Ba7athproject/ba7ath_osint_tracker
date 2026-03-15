# 🚀 Release Notes — Ba7ath OSINT Tracker v1.7.0
## *Édition "Cerveau Augmenté" : Apprentissage Interactif & Filtrage de Précision*

Cette version **1.7.0** franchit une étape cruciale dans la collaboration Humain-IA. Ba7ath n'est plus seulement un outil d'extraction passif, il devient un partenaire d'enquête qui apprend de vos décisions et vous permet de sculpter précisément votre environnement de données.

---

## 🧠 1. "Shadow Memory" : L'Apprentissage Actif (Human-in-the-Loop)
L'IA embarquée (DistilBERT) possède désormais une mémoire à long terme alimentée par vos corrections.
- **Correction Apprise** : Si vous changez la catégorie d'une suggestion IA (ex: requalifier une "ORG" en "MILICE"), l'application mémorise cette décision.
- **Priorité Sémantique** : Lors des analyses suivantes, vos corrections manuelles priment sur les prédictions du modèle original.
- **Persistance IndexedDB** : Votre dictionnaire d'apprentissage est sauvegardé localement et reste disponible même après un redémarrage.
- **Indicateur de Taille** : Un nouveau compteur dans le panneau de statistiques vous indique le nombre d'entités apprises par votre "Shadow Memory".

## 🚫 2. La "Liste Rouge" (Entity Ignore List)
Finies les suggestions répétitives et parasites (ex: "TOTAL", "SA", "Confidential").
- **Bannissement Instantané** : Un bouton "Bannir" (EyeOff) a été ajouté à la saisie manuelle et aux suggestions IA.
- **Filtrage de Source** : Toute entité en Liste Rouge est immédiatement retirée des surlignages Regex et des suggestions de l'IA.
- **Raccourci Expert** : La touche `Suppr` (Delete) permet de bannir une suggestion IA en un éclair lors de la navigation au clavier.
- **Indicateur Visuel** : Un badge rouge sur l'icône de gestion signale que des filtres sont actifs.

## 🛠️ 3. Panel de Gestion de la Liste Rouge
Une interface dédiée pour un contrôle total sur vos exclusions :
- **Recherche & Audit** : Listez et recherchez parmi vos entités bannies.
- **Restauration** : "Débannissez" (Unban) une entité si nécessaire pour la réintégrer dans les détections.
- **Import / Export JSON** : Exportez votre liste pour la partager ou importez une liste d'exclusion standard pour démarrer une nouvelle enquête proprement.

## ⚡ 4. Améliorations UX & Fiabilité
- **Audit de Performance** : Optimisation des boucles de rendu pour maintenir une fluidité totale même avec des centaines d'entités en Liste Rouge.
- **Correctif d'Initialisation** : Résolution d'un bug d'import d'icônes `lucide-react` qui pouvait bloquer le rendu du Workspace sur certains navigateurs.
- **Badging Dynamique** : Mise à jour en temps réel des compteurs de progression et de conflits après chaque opération de bannissement.

---
*Ba7ath OSINT Tracker — Pour une investigation rigoureuse, transparente et souveraine.*
