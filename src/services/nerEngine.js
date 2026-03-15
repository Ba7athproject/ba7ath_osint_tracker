/**
 * ============================================================================
 * Proxy de service du moteur NER — Ba7ath OSINT Tracker v1.7
 * ============================================================================
 *
 * Sert de wrapper asynchrone autour de `nerWorker.js` pour éviter
 * le blocage du thread principal et les crashs STATUS_BREAKPOINT.
 *
 * [v1.7] Intégration du Shadow Memory : après réception des résultats bruts
 * du Worker, le middleware `applyShadowMemory` intercepte chaque entité et
 * croise avec le dictionnaire d'apprentissage humain avant de renvoyer
 * les suggestions au hook React.
 * ============================================================================
 */

import { applyShadowMemory } from './shadowMemory';

let worker = null;
let messageIdCounter = 0;
const pendingRequests = new Map();
let onProgressCallback = null;

let isReady = false;
let isLoading = false;

/**
 * Assure que le Web Worker est initialisé et à l'écoute des messages.
 */
function ensureWorker() {
  if (!worker) {
    // Instanciation du Web Worker dédié pour le NER
    worker = new Worker(new URL('./nerWorker.js', import.meta.url), { type: 'module' });

    worker.addEventListener('message', (event) => {
      const { type, id, result, error, data } = event.data;

      // Gestion des mises à jour de progression lors du téléchargement du modèle
      if (type === 'progress' && onProgressCallback) {
        onProgressCallback(data);
        return;
      }

      // Gestion de la résolution/rejet des requêtes Promise spécifiques
      if (pendingRequests.has(id)) {
        const { resolve, reject } = pendingRequests.get(id);
        pendingRequests.delete(id);

        if (type === 'error') {
          reject(new Error(error));
        } else {
          resolve(result);
        }
      }
    });

    worker.addEventListener('error', (err) => {
      console.error('[NER Engine Proxy] Worker Error:', err);
    });
  }
  return worker;
}

/**
 * Aide à l'envoi de messages au worker et retourne une Promise.
 */
function sendToWorker(type, payload = {}) {
  return new Promise((resolve, reject) => {
    const id = messageIdCounter++;
    pendingRequests.set(id, { resolve, reject });
    const w = ensureWorker();
    w.postMessage({ type, id, payload });
  });
}

/**
 * Chargement du modèle NER dans le worker en arrière-plan.
 */
export async function loadModel(onProgress = () => { }) {
  if (isReady) return true;
  if (isLoading) return false;

  isLoading = true;
  onProgressCallback = onProgress;

  try {
    await sendToWorker('init');
    isReady = true;
    isLoading = false;
    return true;
  } catch (error) {
    isLoading = false;
    isReady = false;

    // Diagnostic granulaire de l'échec
    let userMessage = "Erreur de chargement du modèle NER.";
    if (error.message?.includes('fetch') || !navigator.onLine) {
      userMessage = "Connexion impossible. Vérifiez votre accès internet pour le premier téléchargement du modèle.";
    } else if (error.message?.includes('WASM') || error.message?.includes('onnx') || error.message?.includes('Failed to load resource')) {
      userMessage = "Erreur WASM. Les actifs ONNX sont bloqués, inaccessibles ou hors-limite mémoire. Rechargez la page.";
    }

    console.error('[NER Engine Proxy] Model loading failed:', error);
    throw new Error(userMessage);
  }
}

/**
 * Vérification de l'état de préparation du modèle pour l'inférence.
 */
export function getModelStatus() {
  if (isReady) return 'ready';
  if (isLoading) return 'loading';
  return 'idle';
}

/**
 * Analyse de plusieurs blocs de texte (document complet) de façon asynchrone via le worker.
 *
 * [v1.7] SHADOW MEMORY MIDDLEWARE :
 * Après réception des résultats bruts du worker DistilBERT, cette fonction
 * applique le dictionnaire d'apprentissage humain (Shadow Memory) pour
 * écraser les classifications de l'IA lorsqu'une correspondance est trouvée.
 *
 * Le flux est :
 *   Worker (inférence brute) → applyShadowMemory (interception) → retour au hook
 *
 * @param {Array} textBlocks - Tableau d'objets { title, content }
 * @param {Array} appCategories - Catégories disponibles pour le mapping
 * @param {Function|null} onProgress - Callback de progression optionnel
 * @returns {Promise<Array>} Suggestions d'entités fusionnées, dédoublonnées, et corrigées
 */
export async function analyzeDocument(textBlocks, appCategories = [], onProgress = null) {
  if (!isReady) {
    throw new Error('[NER Engine Proxy] Model not loaded. Call loadModel() first.');
  }

  if (onProgress) {
    onProgressCallback = onProgress;
  }

  // Étape 1 : Délestage de l'inférence brute vers le worker DistilBERT
  const rawResults = await sendToWorker('analyzeDocument', { textBlocks, appCategories });

  // Étape 2 : INTERCEPTION — Application du dictionnaire d'apprentissage humain
  // (Shadow Memory). Cette étape croise chaque entité brute avec les corrections
  // validées par l'investigateur. Les correspondances entraînent un remplacement
  // de catégorie et un score forcé à 100%.
  try {
    const enhancedResults = await applyShadowMemory(rawResults);
    return enhancedResults;
  } catch (shadowError) {
    // Sécurité : en cas d'échec du Shadow Memory, on retourne les résultats
    // bruts de l'IA sans modification. Le pipeline NER ne doit JAMAIS crasher
    // à cause du système d'apprentissage.
    console.warn(
      '[NER Engine Proxy] ⚠️ Shadow Memory middleware failed. Raw results returned.',
      shadowError
    );
    return rawResults;
  }
}
