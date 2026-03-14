/**
 * useNerEngine — Hook React pour l'intégration du moteur NER
 * Ba7ath OSINT Tracker v1.6
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import { loadModel, getModelStatus, analyzeDocument } from '../services/nerEngine';

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

      // Filtrage des suggestions déjà ignorées
      const dismissed = dismissedRef.current[docUuid] || new Set();
      const filtered = results.filter(r => !dismissed.has(r.word.toLowerCase()));

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
  }, [categories]);

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
  }), [
    modelStatus, loadProgress, loadFile, errorMessage,
    initModel, analyzeDoc, getDocSuggestions,
    validateSuggestion, dismissSuggestion, dismissAll,
    MapsSuggestions, resetDismissed, clearAllSuggestions,
    suggestions, activeSuggestionIndex, analyzingDocId, analysisProgress
  ]);

  return result;
}
