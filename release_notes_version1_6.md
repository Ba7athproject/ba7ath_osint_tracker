# 🚀 Release Notes — Ba7ath OSINT Tracker v1.6.0
## *Édition Spéciale : Intelligence Artificielle Souveraine & Excellence Algorithmique*

Cette version **1.6.0** marque l'aboutissement d'un cycle de développement intense débuté en v1.3. Elle fusionne une architecture de pointe pour l'IA embarquée, des algorithmes de déduplication complexes et une ergonomie pensée pour l'investigation sous haute pression.

---

## 🧠 1. IA Embarquée & Moteur NER (Souveraineté Totale)
Ba7ath intègre désormais un moteur de **Reconnaissance d'Entités Nommées (NER)** directement dans le navigateur, sans aucune dépendance serveur.
- **Modèle DistilBERT Multilingue** : Utilisation d'un modèle de 135 Mo (Xenova/distilbert-base-multilingual-cased-ner-hrl) optimisé pour l'identification des Personnes (PER), Organisations (ORG) et Lieux (LOC).
- **Architecture Web Worker** : L'IA est isolée dans un thread séparé via un Web Worker dédié (`nerWorker.js`). Cela évite le gel de l'interface utilisateur pendant les phases d'inférence lourde, garantissant une fluidité de 60 FPS lors de la saisie.
- **Souveraineté Géopolitique** : L'IA applique des règles de contexte automatique (ex: remplacement de terminologies d'occupation) pour s'aligner sur les exigences de rigueur et de souveraineté de l'investigateur.

## 🛡️ 2. "RAM Shield" : Dompter les Limites de V8
Travailler avec des modèles de Deep Learning massifs dans un navigateur a nécessité des prouesses techniques pour contourner les contraintes de mémoire de Google Chrome (V8) :
- **Injection de Header (Content-Length Hack)** : Création d'un intercepteur de téléchargement capturant les requêtes ONNX pour injecter manuellement le header `Content-Length`. Cela permet à Transformers.js d'allouer préventivement la RAM nécessaire et évite les crashs `STATUS_BREAKPOINT`.
- **Bouclier Mémoire** : Système de filtrage des "hallucinations" IA au sein du worker (chaînes vides ou répétitives) qui saturaient auparavant la RAM par accumulation de buffers.
- **Persistence Haute Capacité** : Migration complète vers **IndexedDB** pour stocker des sessions d'investigation volumineuses, libérant les 5 Mo de limite du `localStorage`.

## 🎯 3. Gestion Intelligente des Entités & Doublons
Le cœur algorithmique de Ba7ath réside dans sa capacité à traiter la donnée brute pour la rendre atomique et propre :
- **Algorithme de Déduplication (Levenshtein)** : Détection automatique des similitudes textuelles lors de l'ajout. Si une suggestion IA ou une saisie manuelle ressemble à une entité existante, un système de résolution de conflit permet de fusionner, remplacer ou marquer les doublons.
- **Mapping Sémantique Dynamique** : L'IA ne se contente pas de trouver des mots, elle les lie intelligemment à vos catégories personnalisées (ex: détection automatique des entités étatiques/militaires mappées vers "Autorité").
- **Workflow de Résolution** : Interface modale permettant de choisir le nom "maître" lors d'une fusion pour préserver la cohérence de l'export.

## 🧹 4. Intégrité "Verbatim" & Nettoyage de Sortie
La donnée OSINT doit être irréprochable pour être exploitable dans un rapport :
- **Sanitisation Downstream** : Élimination automatique des caractères invisibles, Alt-codes Windows et chaînes de contrôle (Unicode control chars) lors de l'extraction.
- **Normalisation des Jetons** : Nettoyage automatique (trim, singularisation basique, suppression des *noise words*) pour assurer des correspondances de surlignage parfaites.

## 👁️ 5. Raffinements UX v1.6 (Vision Sans Obstacle)
- **Auto-Hide Tooltips** : Les info-bulles de suggestions IA se masquent automatiquement après **1.2 secondes** pour ne plus obstruer la lecture du texte source original situé en arrière-plan.
- **Navigation "Rail-Vitesse"** : Workflow clavier expert optimisé ([Tab], [Entrée], [Échap]) permettant de valider ou rejeter des suggestions IA instantanément.

---
*Ba7ath OSINT Tracker — Vos données, votre intelligence, votre souveraineté.*
