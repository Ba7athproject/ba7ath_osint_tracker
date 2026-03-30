/**
 * ============================================================================
 * shadowMemory.js — Module de Mémoire Fantôme (Shadow Memory)
 * Ba7ath OSINT Tracker v1.7 — Human-in-the-Loop NER Learning System
 * ============================================================================
 *
 * Ce module est le cœur du système d'apprentissage par correction humaine.
 * Il permet à l'investigateur de "dresser" l'IA en sauvegardant ses corrections
 * de catégorisation dans un dictionnaire persistant (IndexedDB via localforage).
 *
 * Lors des analyses NER suivantes, chaque entité détectée par DistilBERT est
 * croisée avec ce dictionnaire. Si une correspondance est trouvée (exacte ou
 * fuzzy via Levenshtein), la classification de l'IA est écrasée par celle de
 * l'utilisateur, avec un score de confiance forcé à 100%.
 *
 * ARCHITECTURE :
 * nerWorker.js (inférence brute) → nerEngine.js (applyShadowMemory) → useNerEngine.js (UI)
 *
 * RÈGLE DE PROPORTIONNALITÉ (Feedback investigateur) :
 * - Entités ≤ 4 caractères (acronymes : GCT, GAT, IDF...) → correspondance EXACTE uniquement
 * - Entités ≥ 5 caractères (noms longs : "Elbit Systems") → fuzzy matching (Levenshtein ≤ 2)
 * Cela évite les faux positifs sur les acronymes courts très fréquents en OSINT.
 * ============================================================================
 */

import localforage from 'localforage';

// ============================================================================
// CONSTANTES ET CACHE (RAM SHIELD)
// ============================================================================

/** Clé IndexedDB pour le dictionnaire d'apprentissage */
const SHADOW_MEMORY_KEY = 'ba7ath_shadow_memory';

/**
 * Seuil maximum de distance Levenshtein pour le fuzzy matching.
 * Appliqué UNIQUEMENT aux entités de 5 caractères ou plus.
 */
const LEVENSHTEIN_THRESHOLD = 2;

/**
 * Longueur minimale d'entité pour autoriser le fuzzy matching.
 * En dessous de cette longueur, seule la correspondance exacte est acceptée.
 * Protège les acronymes courts (ex: GCT ≠ GAT) contre les faux positifs.
 */
const MIN_LENGTH_FOR_FUZZY = 5;

/** * 🛡️ RAM SHIELD : Cache en mémoire vive.
 * Évite les requêtes I/O coûteuses vers IndexedDB pendant les boucles d'inférence.
 */
let ramCache = null;

// ============================================================================
// UTILITAIRE : DISTANCE DE LEVENSHTEIN
// ============================================================================

/**
 * Calcule la distance de Levenshtein entre deux chaînes de caractères.
 *
 * La distance de Levenshtein mesure le nombre minimum d'opérations
 * d'édition (insertion, suppression, substitution) nécessaires pour
 * transformer une chaîne en une autre.
 *
 * Implémentation par programmation dynamique (matrice complète).
 * Complexité : O(n*m) en temps et en espace, où n et m sont les
 * longueurs respectives des deux chaînes.
 *
 * @param {string} a - Première chaîne (entité détectée par l'IA)
 * @param {string} b - Seconde chaîne (entité dans le dictionnaire)
 * @returns {number} Distance d'édition minimale entre les deux chaînes
 *
 * @example
 * levenshteinDistance("Elbit Systems", "Elbit System")  // → 1
 * levenshteinDistance("GCT", "GAT")                      // → 1
 * levenshteinDistance("hello", "hello")                   // → 0
 */
export function levenshteinDistance(a, b) {
  // Cas dégénérés : si l'une des chaînes est vide,
  // la distance est la longueur de l'autre
  if (!a || a.length === 0) return b ? b.length : 0;
  if (!b || b.length === 0) return a.length;

  const lenA = a.length;
  const lenB = b.length;

  // Création de la matrice (lenA+1) x (lenB+1)
  // matrix[i][j] = distance entre a[0..i-1] et b[0..j-1]
  const matrix = [];

  // Initialisation de la première colonne : transformer a[0..i-1] en chaîne vide
  for (let i = 0; i <= lenA; i++) {
    matrix[i] = [i];
  }

  // Initialisation de la première ligne : transformer chaîne vide en b[0..j-1]
  for (let j = 0; j <= lenB; j++) {
    matrix[0][j] = j;
  }

  // Remplissage de la matrice par programmation dynamique
  for (let i = 1; i <= lenA; i++) {
    for (let j = 1; j <= lenB; j++) {
      // Coût de substitution : 0 si les caractères sont identiques, 1 sinon
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;

      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // Suppression (supprimer un caractère de a)
        matrix[i][j - 1] + 1,      // Insertion (insérer un caractère dans a)
        matrix[i - 1][j - 1] + cost // Substitution (remplacer un caractère)
      );
    }
  }

  // La distance finale est dans le coin inférieur droit de la matrice
  return matrix[lenA][lenB];
}

// ============================================================================
// GESTION DU DICTIONNAIRE D'APPRENTISSAGE (CRUD IndexedDB)
// ============================================================================

/**
 * Charge le dictionnaire d'apprentissage depuis la RAM ou IndexedDB.
 *
 * Le dictionnaire est un tableau d'objets, chacun représentant une
 * correction validée par l'investigateur :
 * { entityRaw: string, forcedCategory: string, timestamp: number }
 *
 * @returns {Promise<Array>} Le dictionnaire d'apprentissage ou un tableau vide en cas d'erreur
 */
export async function loadDictionary() {
  // 🛡️ Réponse immédiate O(1) si le cache est disponible
  if (ramCache !== null) {
    return ramCache;
  }

  try {
    const dictionary = await localforage.getItem(SHADOW_MEMORY_KEY);
    // Initialisation du cache RAM
    ramCache = Array.isArray(dictionary) ? dictionary : [];
    return ramCache;
  } catch (error) {
    console.warn(
      '[Shadow Memory] ⚠️ Erreur de lecture du dictionnaire IndexedDB. ' +
      'Le système d\'apprentissage fonctionne sans persistance pour cette session.',
      error
    );
    ramCache = [];
    return ramCache;
  }
}

/**
 * Sauvegarde (ou met à jour) une correction dans le dictionnaire d'apprentissage.
 *
 * Met à jour le cache RAM instantanément pour ne pas bloquer l'inférence,
 * puis persiste les données sur IndexedDB.
 *
 * @param {string} entityRaw - Le nom brut de l'entité tel que détecté (ex: "Elbit Systems")
 * @param {string} forcedCategory - L'ID de catégorie forcée par l'utilisateur (ex: "Entreprise")
 * @returns {Promise<Array>} Le dictionnaire mis à jour
 */
export async function saveCorrectionToDictionary(entityRaw, forcedCategory) {
  try {
    const dictionary = await loadDictionary();
    const normalizedInput = entityRaw.trim().toLowerCase();

    // Recherche d'une entrée existante pour cette entité (mise à jour si trouvée)
    const existingIndex = dictionary.findIndex(
      entry => entry.entityRaw.trim().toLowerCase() === normalizedInput
    );

    const correctionEntry = {
      entityRaw: entityRaw.trim(),
      forcedCategory: forcedCategory,
      timestamp: Date.now(),
    };

    if (existingIndex !== -1) {
      // Mise à jour de l'entrée existante (l'investigateur a re-corrigé)
      dictionary[existingIndex] = correctionEntry;
      console.log(`[Shadow Memory] 🔄 Mise à jour : "${entityRaw}" → ${forcedCategory}`);
    } else {
      // Ajout d'une nouvelle entrée
      dictionary.push(correctionEntry);
      console.log(`[Shadow Memory] 💾 Nouvelle correction : "${entityRaw}" → ${forcedCategory}`);
    }

    // 1. Mise à jour immédiate du cache RAM
    ramCache = dictionary;

    // 2. Persistance dans IndexedDB
    await localforage.setItem(SHADOW_MEMORY_KEY, dictionary);
    return dictionary;
  } catch (error) {
    console.error(
      '[Shadow Memory] ❌ Erreur de sauvegarde dans IndexedDB. ' +
      'La correction ne sera pas mémorisée pour les sessions futures.',
      error
    );
    return await loadDictionary();
  }
}

/**
 * Sauvegarde (ou met à jour) un lot de corrections en une seule écriture IndexedDB.
 *
 * @param {Array<{entityRaw: string, forcedCategory: string}>} entries - Les corrections à apprendre
 * @returns {Promise<Array>} Le dictionnaire mis à jour
 */
export async function saveCorrectionsBatch(entries) {
  if (!entries || entries.length === 0) return await loadDictionary();
  
  try {
    const dictionary = await loadDictionary();
    let updatedCount = 0;
    let addedCount = 0;

    for (const { entityRaw, forcedCategory } of entries) {
      if (!entityRaw || !forcedCategory) continue;
      
      const normalizedInput = entityRaw.trim().toLowerCase();
      const existingIndex = dictionary.findIndex(
        entry => entry.entityRaw.trim().toLowerCase() === normalizedInput
      );

      const correctionEntry = {
        entityRaw: entityRaw.trim(),
        forcedCategory: forcedCategory,
        timestamp: Date.now(),
      };

      if (existingIndex !== -1) {
        dictionary[existingIndex] = correctionEntry;
        updatedCount++;
      } else {
        dictionary.push(correctionEntry);
        addedCount++;
      }
    }

    if (updatedCount > 0 || addedCount > 0) {
      // Mise à jour du cache RAM
      ramCache = dictionary;
      // Persistance disque
      await localforage.setItem(SHADOW_MEMORY_KEY, dictionary);
      console.log(`[Shadow Memory] 💾 Batch save : ${addedCount} ajouts, ${updatedCount} mises à jour.`);
    }
    
    return dictionary;
  } catch (error) {
    console.error('[Shadow Memory] ❌ Erreur de sauvegarde batch dans IndexedDB.', error);
    return await loadDictionary();
  }
}

/**
 * Supprime une correction spécifique du dictionnaire d'apprentissage.
 *
 * @param {string} entityRaw - Le nom brut de l'entité à oublier
 * @returns {Promise<Array>} Le dictionnaire mis à jour après suppression
 */
export async function removeCorrectionFromDictionary(entityRaw) {
  try {
    const dictionary = await loadDictionary();
    const normalizedInput = entityRaw.trim().toLowerCase();

    // Filtrage : on garde tout sauf l'entrée ciblée
    const filteredDictionary = dictionary.filter(
      entry => entry.entityRaw.trim().toLowerCase() !== normalizedInput
    );

    if (filteredDictionary.length < dictionary.length) {
      console.log(`[Shadow Memory] 🗑️ Correction oubliée : "${entityRaw}"`);
    } else {
      console.log(`[Shadow Memory] ℹ️ Aucune correction trouvée pour : "${entityRaw}"`);
    }

    // Mise à jour RAM et Disque
    ramCache = filteredDictionary;
    await localforage.setItem(SHADOW_MEMORY_KEY, filteredDictionary);
    
    return filteredDictionary;
  } catch (error) {
    console.error('[Shadow Memory] ❌ Erreur de suppression dans IndexedDB.', error);
    return await loadDictionary();
  }
}

/**
 * Purge complète du dictionnaire d'apprentissage.
 *
 * @returns {Promise<void>}
 */
export async function clearDictionary() {
  try {
    ramCache = [];
    await localforage.removeItem(SHADOW_MEMORY_KEY);
    console.log('[Shadow Memory] 🧹 Dictionnaire d\'apprentissage purgé.');
  } catch (error) {
    console.error('[Shadow Memory] ❌ Erreur de purge du dictionnaire IndexedDB.', error);
  }
}

// ============================================================================
// INTERCEPTEUR NER — MIDDLEWARE DE REMPLACEMENT HEURISTIQUE
// ============================================================================

/**
 * Applique la mémoire fantôme (Shadow Memory) sur les résultats bruts du NER.
 *
 * @param {Array} entities - Tableau d'entités NER brutes du worker
 * @returns {Promise<Array>} Les entités modifiées avec les corrections de la mémoire fantôme
 */
export async function applyShadowMemory(entities) {
  // Si pas d'entités, rien à faire — court-circuit rapide
  if (!entities || entities.length === 0) return entities;

  try {
    // Lecture quasi-instantanée grâce au RAM Shield
    const dictionary = await loadDictionary();

    if (dictionary.length === 0) return entities;

    // Pré-calcul : normaliser toutes les entrées du dictionnaire pour la recherche
    const normalizedDictionary = dictionary.map(entry => ({
      ...entry,
      normalizedRaw: entry.entityRaw.trim().toLowerCase(),
    }));

    // Itération sur chaque entité détectée par l'IA
    return entities.map(entity => {
      const entityWordLower = entity.word.trim().toLowerCase();
      const entityLength = entityWordLower.length;

      // --- PHASE 1 : Recherche de correspondance EXACTE (insensible à la casse) ---
      const exactMatch = normalizedDictionary.find(
        entry => entry.normalizedRaw === entityWordLower
      );

      if (exactMatch) {
        console.log(
          `[Shadow Memory] ✅ Match EXACT : "${entity.word}" → ` +
          `catégorie forcée "${exactMatch.forcedCategory}" ` +
          `(IA avait proposé "${entity.suggestedCategory}" à ${entity.score}%)`
        );
        return {
          ...entity,
          suggestedCategory: exactMatch.forcedCategory,
          score: 100,
          shadowMemoryMatch: true,       
          shadowMemorySource: 'exact',   
          originalCategory: entity.suggestedCategory, 
          originalScore: entity.score,                
        };
      }

      // --- PHASE 2 : Recherche FUZZY (Levenshtein) ---
      // UNIQUEMENT pour les entités de 5+ caractères (protection acronymes)
      if (entityLength >= MIN_LENGTH_FOR_FUZZY) {
        let bestMatch = null;
        let bestDistance = Infinity;

        for (const entry of normalizedDictionary) {
          // 🛡️ OPTIMISATION MATHÉMATIQUE (Early Exit)
          // Si l'écart de longueur brut dépasse le seuil autorisé, il est mathématiquement 
          // impossible que la distance de Levenshtein soit valide. On économise le calcul matriciel.
          if (Math.abs(entry.normalizedRaw.length - entityLength) > LEVENSHTEIN_THRESHOLD) {
            continue;
          }

          const distance = levenshteinDistance(entityWordLower, entry.normalizedRaw);

          // Garder la meilleure correspondance sous le seuil
          if (distance <= LEVENSHTEIN_THRESHOLD && distance < bestDistance) {
            bestDistance = distance;
            bestMatch = entry;
          }

          // Optimisation : distance 0 = exact match déjà traité en Phase 1,
          // distance 1 est quasi-parfait, pas besoin de chercher plus loin
          if (bestDistance === 1) break;
        }

        if (bestMatch) {
          console.log(
            `[Shadow Memory] 🔍 Match FUZZY (distance=${bestDistance}) : ` +
            `"${entity.word}" ≈ "${bestMatch.entityRaw}" → ` +
            `catégorie forcée "${bestMatch.forcedCategory}" ` +
            `(IA avait proposé "${entity.suggestedCategory}" à ${entity.score}%)`
          );
          return {
            ...entity,
            suggestedCategory: bestMatch.forcedCategory,
            score: 100,
            shadowMemoryMatch: true,
            shadowMemorySource: 'fuzzy',
            shadowMemoryDistance: bestDistance,
            originalCategory: entity.suggestedCategory,
            originalScore: entity.score,
          };
        }
      }

      // --- Aucune correspondance : retourner l'entité inchangée ---
      return entity;
    });
  } catch (error) {
    console.error(
      '[Shadow Memory] ❌ Erreur lors de l\'application du dictionnaire. ' +
      'Résultats NER bruts retournés sans modification.',
      error
    );
    return entities;
  }
}