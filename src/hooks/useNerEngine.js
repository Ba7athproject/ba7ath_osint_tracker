/**
 * ============================================================================
 * useNerEngine — Hook React pour l'intégration du moteur NER
 * Ba7ath OSINT Tracker v1.7
 * ============================================================================
 *
 * [v1.7] Intégration du Shadow Memory (Human-in-the-Loop) :
 * Ce hook expose désormais des fonctions d'apprentissage permettant à
 * l'investigateur de sauvegarder ses corrections de catégorisation.
 * Les corrections sont persistées dans IndexedDB et appliquées
 * automatiquement lors des analyses NER suivantes.
 *
 * Nouvelles fonctions exportées :
 *   - learnCorrection(entityName, forcedCategory) : sauvegarde une correction
 *   - forgetCorrection(entityName) : supprime une correction apprise
 *   - clearShadowMemory() : purge complète du dictionnaire
 *   - shadowMemorySize : nombre de corrections en mémoire (état réactif)
 * ============================================================================
 */

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { loadModel, getModelStatus, analyzeDocument } from '../services/nerEngine';
import {
  saveCorrectionToDictionary,
  removeCorrectionFromDictionary,
  clearDictionary,
  loadDictionary,
} from '../services/shadowMemory';
import {
  loadIgnoreList,
  addToIgnoreList,
  removeFromIgnoreList,
  clearIgnoreList,
  overwriteIgnoreList
} from '../services/ignoreList';

/**
 * @param {Array} categories - Catégories d'entités disponibles dans l'application
 * @returns Mise à jour de l'état du hook et actions pour la fonctionnalité NER
 */
export function useNerEngine(categories = []) {
  // État du cycle de vie du modèle
  const [modelStatus, setModelStatus] = useState('idle'); // idle | loading | ready | error
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadFile, setLoadFile] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Suggestions NER, indexées par l'UUID du document
  const [suggestions, setSuggestions] = useState({});
  // Index de la suggestion actuellement focalisée (pour la navigation clavier)
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  // Ensemble des clés de suggestions ignorées (mot.toLowerCase()) par document
  const dismissedRef = useRef({});
  const [analyzingDocId, setAnalyzingDocId] = useState(null); // Suivi du document en cours d'analyse
  const [analysisProgress, setAnalysisProgress] = useState({ current: 0, total: 0, label: '' });

  // ============================================================================
  // [v1.7] SHADOW MEMORY — État réactif du dictionnaire d'apprentissage
  // ============================================================================

  /**
   * Nombre de corrections stockées dans le dictionnaire d'apprentissage.
   * Mis à jour automatiquement au montage et après chaque opération CRUD.
   * Permet à l'UI d'afficher un compteur ou un badge "X corrections apprises".
   */
  const [shadowMemorySize, setShadowMemorySize] = useState(0);

  // [v1.7] Ignore List — Entités bannies
  const [ignoreList, setIgnoreList] = useState(new Set());

  // Montage initial : Chargement Shadow Memory et Ignore List
  useEffect(() => {
    loadDictionary().then(dict => {
      setShadowMemorySize(dict.length || 0);
    }).catch(err => {
      console.warn('[useNerEngine] Impossible de charger la Shadow Memory au montage.', err);
    });

    loadIgnoreList().then(list => {
      setIgnoreList(list);
    }).catch(err => {
      console.warn('[useNerEngine] Impossible de charger la Ignore List au montage.', err);
    });
  }, []);



  /**
   * Initialisation du modèle NER (téléchargement + chargement en mémoire).
   */
  const initModel = useCallback(async () => {
    if (getModelStatus() === 'ready') {
      setModelStatus('ready');
      return true;
    }

    setModelStatus('loading');
    setLoadProgress(0);
    setErrorMessage('');

    try {
      await loadModel((progress) => {
        setLoadProgress(Math.round(progress.progress || 0));
        setLoadFile(progress.file || '');
      });
      setModelStatus('ready');
      return true;
    } catch (err) {
      setModelStatus('error');
      setErrorMessage(err.message || 'Erreur de chargement du modèle NER');
      console.error('[useNerEngine] Init failed:', err);
      return false;
    }
  }, []);

  /**
   * Exécution de l'analyse NER sur les blocs de texte d'un document.
   * @param {string} docUuid - UUID du document
   * @param {Array} textBlocks - Tableau de { title, content }
   */
  const analyzeDoc = useCallback(async (docUuid, textBlocks) => {
    if (getModelStatus() !== 'ready') {
      console.warn('[useNerEngine] Model not ready');
      return [];
    }

    setAnalyzingDocId(docUuid);

    try {
      const results = await analyzeDocument(textBlocks, categories, (prog) => {
        if (prog.status === 'analyzing') {
          setAnalysisProgress({
            current: prog.index,
            total: prog.total,
            label: prog.label
          });
        }
      });

      const dismissed = dismissedRef.current[docUuid] || new Set();
      const filtered = results.filter(r => {
        const lowerWord = r.word.trim().toLowerCase();
        return !dismissed.has(lowerWord) && !ignoreList.has(lowerWord);
      });

      setSuggestions(prev => ({
        ...prev,
        [docUuid]: filtered,
      }));

      setActiveSuggestionIndex(filtered.length > 0 ? 0 : -1);
      setAnalyzingDocId(null);
      setAnalysisProgress({ current: 0, total: 0, label: '' });

      return filtered;
    } catch (err) {
      console.error('[useNerEngine] Analysis failed:', err);
      setAnalyzingDocId(null);
      return [];
    }
  }, [categories, ignoreList]);

  /**
   * Récupération des suggestions pour un document spécifique.
   */
  const getDocSuggestions = useCallback((docUuid) => {
    return suggestions[docUuid] || [];
  }, [suggestions]);

  /**
   * Validation (acceptation) d'une suggestion à l'index `index` pour le document `docUuid`.
   * Retourne l'objet entité à ajouter.
   */
  const validateSuggestion = useCallback((docUuid, index) => {
    const docSuggestions = suggestions[docUuid];
    if (!docSuggestions || index < 0 || index >= docSuggestions.length) return null;

    const suggestion = docSuggestions[index];

    // Suppression de la liste des suggestions
    setSuggestions(prev => {
      const updated = [...(prev[docUuid] || [])];
      updated.splice(index, 1);
      return { ...prev, [docUuid]: updated };
    });

    // Déplacement de l'index actif
    setActiveSuggestionIndex(prev => {
      const remaining = (suggestions[docUuid]?.length || 0) - 1;
      if (remaining <= 0) return -1;
      return Math.min(prev, remaining - 1);
    });

    // Retourne l'objet entité pour l'appelant
    return {
      name: suggestion.word, // VERBATIM — jamais altéré
      type: suggestion.suggestedCategory,
      note: suggestion.description,
      isAiSuggestion: true,
    };
  }, [suggestions]);

  /**
   * Rejet d'une suggestion.
   */
  const dismissSuggestion = useCallback((docUuid, index) => {
    const docSuggestions = suggestions[docUuid];
    if (!docSuggestions || index < 0 || index >= docSuggestions.length) return;

    const suggestion = docSuggestions[index];

    // Suivi du rejet pour éviter qu'il ne réapparaisse lors d'une ré-analyse
    if (!dismissedRef.current[docUuid]) {
      dismissedRef.current[docUuid] = new Set();
    }
    dismissedRef.current[docUuid].add(suggestion.word.toLowerCase());

    // Suppression de la liste des suggestions
    setSuggestions(prev => {
      const updated = [...(prev[docUuid] || [])];
      updated.splice(index, 1);
      return { ...prev, [docUuid]: updated };
    });

    // Ajustement de l'index actif
    setActiveSuggestionIndex(prev => {
      const remaining = (suggestions[docUuid]?.length || 0) - 1;
      if (remaining <= 0) return -1;
      return Math.min(prev, remaining - 1);
    });
  }, [suggestions]);

  /**
   * Rejet de toutes les suggestions pour un document.
   */
  const dismissAll = useCallback((docUuid) => {
    const docSuggestions = suggestions[docUuid];
    if (!docSuggestions) return;

    // Marquage de toutes les suggestions comme ignorées
    if (!dismissedRef.current[docUuid]) {
      dismissedRef.current[docUuid] = new Set();
    }
    docSuggestions.forEach(s => dismissedRef.current[docUuid].add(s.word.toLowerCase()));

    setSuggestions(prev => ({ ...prev, [docUuid]: [] }));
    setActiveSuggestionIndex(-1);
  }, [suggestions]);

  /**
   * Navigation dans les suggestions au clavier (Audit Point A)
   */
  const MapsSuggestions = useCallback((direction, docUuid) => {
    const docSuggestions = suggestions[docUuid] || [];
    if (docSuggestions.length === 0) return;

    setActiveSuggestionIndex(prev => {
      if (direction === 'next') {
        return (prev + 1) % docSuggestions.length;
      } else {
        return prev <= 0 ? docSuggestions.length - 1 : prev - 1;
      }
    });
  }, [suggestions]);

  /**
   * Nettoyage complet des suggestions (ex: réinitialisation de session)
   */
  const clearAllSuggestions = useCallback(() => {
    setSuggestions({});
    setActiveSuggestionIndex(-1);
    dismissedRef.current = {};
  }, []);

  /**
   * Nettoyage du cache des suggestions ignorées pour un document (permet une ré-analyse).
   */
  const resetDismissed = useCallback((docUuid) => {
    if (dismissedRef.current[docUuid]) {
      delete dismissedRef.current[docUuid];
    }
  }, []);

  // ============================================================================
  // [v1.7] SHADOW MEMORY — Fonctions d'apprentissage (Human-in-the-Loop)
  // ============================================================================

  /**
   * Enregistre une correction de l'investigateur dans le dictionnaire d'apprentissage.
   *
   * Doit être appelée lorsque l'utilisateur modifie manuellement la catégorie
   * d'une entité. La prochaine fois que l'IA détectera cette entité (ou une
   * variante proche via Levenshtein), elle adoptera automatiquement la
   * catégorie de l'utilisateur avec un score de confiance de 100%.
   *
   * @param {string} entityName - Le nom brut de l'entité (ex: "Elbit Systems")
   * @param {string} forcedCategory - L'ID de la catégorie choisie par l'utilisateur
   * @returns {Promise<void>}
   *
   * @example
   *   // L'utilisateur change "Elbit Systems" de "Organisation" à "Entreprise"
   *   await learnCorrection("Elbit Systems", "Entreprise");
   *   // → Les analyses futures forceront "Elbit Systems" en "Entreprise" à 100%
   */
  const learnCorrection = useCallback(async (entityName, forcedCategory) => {
    try {
      const updatedDictionary = await saveCorrectionToDictionary(entityName, forcedCategory);
      setShadowMemorySize(updatedDictionary.length);
      console.log(
        `[useNerEngine] 🧠 Shadow Memory: correction apprise — ` +
        `"${entityName}" → ${forcedCategory} (${updatedDictionary.length} corrections en mémoire)`
      );
    } catch (error) {
      console.error('[useNerEngine] Shadow Memory learn failed:', error);
    }
  }, []);

  /**
   * Apprend un lot de corrections en une seule opération (Optimisation transition de page).
   * @param {Array<{entityRaw: string, forcedCategory: string}>} entries 
   */
  const learnCorrectionsBatch = useCallback(async (entries) => {
    if (!entries || entries.length === 0) return;
    try {
      // Import dynamique pour éviter les dépendances circulaires
      const { saveCorrectionsBatch } = await import('../services/shadowMemory.js');
      const updatedDictionary = await saveCorrectionsBatch(entries);
      setShadowMemorySize(updatedDictionary.length);
      console.log(`[useNerEngine] 🧠 Shadow Memory: Batch de ${entries.length} corrections appris.`);
    } catch (error) {
      console.error('[useNerEngine] Shadow Memory batch learn failed:', error);
    }
  }, []);

  /**
   * Oublie une correction précédemment apprise (désapprentissage).
   *
   * Utile si l'investigateur réalise qu'une correction forcée était erronée
   * et souhaite laisser l'IA classifier librement cette entité à l'avenir.
   *
   * @param {string} entityName - Le nom brut de l'entité à oublier
   * @returns {Promise<void>}
   */
  const forgetCorrection = useCallback(async (entityName) => {
    try {
      const updatedDictionary = await removeCorrectionFromDictionary(entityName);
      setShadowMemorySize(updatedDictionary.length);
      console.log(
        `[useNerEngine] 🧠 Shadow Memory: correction oubliée — ` +
        `"${entityName}" (${updatedDictionary.length} corrections en mémoire)`
      );
    } catch (error) {
      console.error('[useNerEngine] Shadow Memory forget failed:', error);
    }
  }, []);

  /**
   * Purge complète de la mémoire fantôme (Shadow Memory).
   *
   * Réinitialise toutes les corrections apprises. L'IA revient à son
   * comportement de classification de base, sans aucune surcharge humaine.
   * Usage typique : changement de sujet d'investigation ou reset de projet.
   *
   * @returns {Promise<void>}
   */
  const clearShadowMemory = useCallback(async () => {
    try {
      await clearDictionary();
      setShadowMemorySize(0);
      console.log('[useNerEngine] 🧠 Shadow Memory: dictionnaire purgé');
    } catch (error) {
      console.error('[useNerEngine] Shadow Memory clear failed:', error);
    }
  }, []);

  // ============================================================================
  // [v1.7] IGNORE LIST — Fonctions de bannissement (Liste Rouge)
  // ============================================================================

  /**
   * Ajoute une entité à la liste rouge (ignorée partout).
   * @param {string} entityName
   */
  const banEntity = useCallback(async (entityName) => {
    try {
      const newList = await addToIgnoreList(entityName);
      setIgnoreList(newList);
      
      // Nettoyage immédiat des suggestions en cours s'il y en a
      setSuggestions(prev => {
        const next = { ...prev };
        const lowerName = entityName.trim().toLowerCase();
        for (const docId in next) {
          next[docId] = next[docId].filter(s => s.word.trim().toLowerCase() !== lowerName);
        }
        return next;
      });
      // L'index actif est réinitialisé pour éviter les décalages
      setActiveSuggestionIndex(-1);
      
    } catch (error) {
      console.error('[useNerEngine] Erreur lors du bannissement:', error);
    }
  }, []);

  /**
   * Retire une entité de la liste rouge.
   * @param {string} entityName
   */
  const unbanEntity = useCallback(async (entityName) => {
    try {
      const newList = await removeFromIgnoreList(entityName);
      setIgnoreList(newList);
      console.log(`[useNerEngine] ♻️ Entité réautorisée : "${entityName}"`);
    } catch (error) {
      console.error('[useNerEngine] Erreur lors du retrait de la liste rouge:', error);
    }
  }, []);

  /**
   * Purge complète de la liste rouge.
   */
  const unbanAll = useCallback(async () => {
    try {
      await clearIgnoreList();
      setIgnoreList(new Set());
      console.log('[useNerEngine] 🧹 Liste rouge purgée.');
    } catch (error) {
      console.error('[useNerEngine] Erreur lors de la purge de la liste rouge:', error);
    }
  }, []);

  /**
   * Importe une nouvelle liste rouge (écrase l'existante).
   * @param {Array<string>} newList
   */
  const importIgnoreList = useCallback(async (newList) => {
    try {
      const finalSet = await overwriteIgnoreList(newList);
      setIgnoreList(finalSet);
      console.log(`[useNerEngine] 📥 Liste rouge importée (${finalSet.size} entités).`);
    } catch (error) {
      console.error('[useNerEngine] Erreur lors de l\'import de la liste rouge:', error);
    }
  }, []);

  const result = useMemo(() => ({
    modelStatus,
    loadProgress,
    loadFile,
    errorMessage,
    initModel,
    analyzeDoc,
    getDocSuggestions,
    validateSuggestion,
    dismissSuggestion,
    dismissAll,
    MapsSuggestions,
    resetDismissed,
    clearAllSuggestions,
    suggestions,
    activeSuggestionIndex,
    setActiveSuggestionIndex,
    analyzingDocId,
    analysisProgress,
    // [v1.7] Shadow Memory
    learnCorrection,
    learnCorrectionsBatch,
    forgetCorrection,
    clearShadowMemory,
    shadowMemorySize,
    // [v1.7] Ignore List
    ignoreList,
    banEntity,
    unbanEntity,
    unbanAll,
    importIgnoreList,
  }), [
    modelStatus, loadProgress, loadFile, errorMessage,
    initModel, analyzeDoc, getDocSuggestions,
    validateSuggestion, dismissSuggestion, dismissAll,
    MapsSuggestions, resetDismissed, clearAllSuggestions,
    suggestions, activeSuggestionIndex, analyzingDocId, analysisProgress,
    // [v1.7] Shadow Memory
    learnCorrection, learnCorrectionsBatch, forgetCorrection, clearShadowMemory, shadowMemorySize,
    // [v1.7] Ignore List
    ignoreList, banEntity, unbanEntity, unbanAll, importIgnoreList,
  ]);

  return result;
}
