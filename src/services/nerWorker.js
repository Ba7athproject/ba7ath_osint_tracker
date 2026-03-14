console.log("🚀 [Ba7ath NER Worker] Initialization Shield active...");

/**
 * 1. L'intercepteur de téléchargement (Le Hack du Content-Length)
 * DOIT ÊTRE DÉFINI AVANT L'IMPORT DE TRANSFORMERS pour capturer globalThis.fetch
 */
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  // Extraction robuste de l'URL peu importe le format (string, URL object, Request object)
  let urlStr = "";
  if (typeof url === 'string') urlStr = url;
  else if (url instanceof URL) urlStr = url.href;
  else if (url && url.url) urlStr = url.url;
  else urlStr = String(url);

  // Log de debug pour voir TOUTES les requêtes du Worker
  const isHF = urlStr.includes('huggingface.co');
  if (isHF) {
    console.log(`📡 [Ba7ath Worker] Request: ${urlStr.split('/').pop()}`);
  }

  const response = await originalFetch(url, options);

  // Si on télécharge le gros fichier ONNX et que le serveur cache la taille (Audit Point B)
  if (urlStr.toLowerCase().includes('.onnx') || urlStr.toLowerCase().includes('model.js')) {
    const cl = response.headers.get('content-length');
    if (!cl || cl === '0') {
      const estimatedSize = urlStr.includes('.onnx') ? '135359829' : '1000000';
      console.warn(`🛡️ [Ba7ath] RAM Shield : INJECTION Content-Length (${Math.round(estimatedSize/1024/1024)}MB) pour : ${urlStr.split('/').pop()}`);

      const headers = new Headers(response.headers);
      headers.set('content-length', estimatedSize);
      headers.set('x-ba7ath-shield', 'active');

      const buffer = await response.arrayBuffer();
      return new Response(buffer, {
        status: response.status,
        statusText: response.statusText,
        headers: headers
      });
    }
  }
  return response;
};

/**
 * 2. Import Dynamique pour éviter le hoisting
 */
let pipeline, env;

// Modèle DistilBERT Multilingue (135 Mo) : Le meilleur compromis performance/mémoire
const MODEL_NAME = 'Xenova/distilbert-base-multilingual-cased-ner-hrl';

const SOVEREIGNTY_REPLACEMENTS = [
  { pattern: /\bIsraël\b/gi, replacement: "Autorité de l'occupation" },
  { pattern: /\bIsrael\b/gi, replacement: "Autorité de l'occupation" },
  { pattern: /\bisraélien\b/gi, replacement: "de l'entité sioniste" },
  { pattern: /\bisraéliens\b/gi, replacement: "de l'entité sioniste" },
  { pattern: /\bisraélienne\b/gi, replacement: "de l'entité sioniste" },
  { pattern: /\bisraéliennes\b/gi, replacement: "de l'entité sioniste" },
  { pattern: /\bisraeli\b/gi, replacement: "Zionist entity's" },
  { pattern: /\bisraelis\b/gi, replacement: "Zionist entity occupying forces" },
  { pattern: /\bisrael's\b/gi, replacement: "the occupation authority's" },
];

const SEMANTIC_ALIASES = {
  'PER': ['personne', 'individu', 'personne', 'human', 'nom'],
  'ORG': ['organisation', 'entreprise', 'société', 'company', 'organization', 'group', 'entity', 'institution'],
  'LOC': ['pays', 'lieu', 'localisation', 'location', 'place', 'city', 'ville', 'country', 'localité', 'localite', 'région', 'region', 'province', 'territoire', 'zone', 'village'],
  'MISC': ['divers', 'autre', 'miscellaneous', 'entity', 'entreprise', 'organisation']
};

let nerPipeline = null;

function applySovereigntyRules(text) {
  if (!text) return text;
  let result = text;
  for (const { pattern, replacement } of SOVEREIGNTY_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function generateEntityDescription(entityWord, entityGroup, surroundingText) {
  const typeLabels = {
    'PER': 'Personne',
    'ORG': 'Organisation',
    'LOC': 'Localisation',
    'MISC': 'Divers',
  };

  const typeLabel = typeLabels[entityGroup] || entityGroup;
  let context = '';
  if (surroundingText) {
    const idx = surroundingText.indexOf(entityWord);
    if (idx !== -1) {
      const start = Math.max(0, idx - 40);
      const end = Math.min(surroundingText.length, idx + entityWord.length + 40);
      context = surroundingText.slice(start, end).trim();
      if (start > 0) context = '…' + context;
      if (end < surroundingText.length) context = context + '…';
    }
  }

  let description = `[IA/${typeLabel}] Détecté dans le texte source.`;
  if (entityGroup === 'ORG' && isStateActor(entityWord)) {
    description = `[IA/Autorité] Détecté comme entité étatique/militaire.`;
  }

  if (context) description += ` Contexte : « ${context} »`;
  return applySovereigntyRules(description);
}

const STATE_KEYWORDS = [
  'ministry', 'ministre', 'department', 'command', 'army', 'force', 'police',
  'intelligence', 'cyber', 'security', 'defense', 'défense', 'government',
  'gouvernement', 'agency', 'agence', 'authority', 'autorité', 'division',
  'battalion', 'bataillon', 'corps', 'unit', 'unité', 'brigade', 'commandement'
];

function isStateActor(word) {
  if (!word) return false;
  const lower = word.toLowerCase();
  return STATE_KEYWORDS.some(kw => lower.includes(kw));
}

const ORG_HEURISTICS = {
  'entreprise': ['ltd', 'inc', 'corp', 'group', 'llc', 'bank', 'banka', 'company', 'société', 'sarl', 'sa', 'gmbh', 'bv', 'plc', 'co', 'holding', 'industries', 'infrastructures'],
  'organisation': ['foundation', 'ngo', 'association', 'committee', 'council', 'commission', 'union', 'fund', 'organization', 'ong', 'fondation', 'comité', 'conseil', 'agence', 'office']
};

function mapToAppCategory(entityWord, entityGroup, appCategories) {
  const wordLower = entityWord.toLowerCase();

  // 1. Heuristique Autorité (State Actors)
  if ((entityGroup === 'ORG' || entityGroup === 'MISC') && isStateActor(entityWord)) {
    const authorityMatch = appCategories.find(c =>
      c.id === 'Autorite' || c.name.toLowerCase() === 'autorité' || c.name.toLowerCase() === 'autorite'
    );
    if (authorityMatch) return authorityMatch.id;
  }

  // 2. Heuristique ORG spécifique (Entreprise vs Organisation)
  if (entityGroup === 'ORG') {
    const isCorp = ORG_HEURISTICS.entreprise.some(kw => wordLower.includes(kw));
    const isOrg = ORG_HEURISTICS.organisation.some(kw => wordLower.includes(kw));

    if (isCorp && !isOrg) {
      const match = appCategories.find(c => c.id.toLowerCase() === 'entreprise' || c.name.toLowerCase() === 'entreprise');
      if (match) return match.id;
    }
    if (isOrg && !isCorp) {
      const match = appCategories.find(c => c.id.toLowerCase() === 'organisation' || c.name.toLowerCase() === 'organisation');
      if (match) return match.id;
    }
  }

  // 3. Smart Match basé sur les alias sémantiques (Point S - v1.6.2)
  const aliases = SEMANTIC_ALIASES[entityGroup] || [];
  const smartMatch = appCategories.find(c => 
    aliases.some(alias => c.name.toLowerCase().includes(alias)) ||
    c.id.toLowerCase() === entityGroup.toLowerCase() ||
    c.name.toLowerCase() === entityGroup.toLowerCase()
  );

  if (smartMatch) return smartMatch.id;

  // 4. Dernier recours (Qualité v1.6.2) : Si aucune correspondance n'est trouvée,
  // on mappe sur la première catégorie disponible au lieu de rejeter l'entité.
  if (appCategories.length > 0) {
    const fallback = appCategories.find(c => ['divers', 'autre', 'misc'].some(kw => c.name.toLowerCase().includes(kw))) 
                   || appCategories[0];
    
    // Log silencieux pour diagnostic
    // console.debug(`[NER Worker] Fallback: ${entityWord} (${entityGroup}) -> ${fallback.id}`);
    return fallback.id;
  }

  return null;
}

async function analyzeTextWorker(text, appCategories) {
  if (!nerPipeline) throw new Error("Modèle non chargé");
  const results = await nerPipeline(text, { ignore_labels: ['O'] });
  if (!results || results.length === 0) return [];

  const aggregated = [];
  let current = null;

  for (const r of results) {
    // Seuil abaissé à 0.20 pour augmenter le rappel (Recall)
    if (r.score < 0.20) continue;
    const isO = r.entity === 'O' || r.entity_group === 'O';
    if (isO) {
      if (current) aggregated.push(current);
      current = null;
      continue;
    }

    const typeMatch = r.entity ? r.entity.match(/^[BI]-(.+)$/) : null;
    const baseType = typeMatch ? typeMatch[1] : (r.entity_group || r.entity || 'MISC');
    const isB = r.entity && r.entity.startsWith('B-');

    if (!current || isB || current.type !== baseType) {
      if (current) aggregated.push(current);
      current = { type: baseType, word: r.word || '', score: r.score, count: 1 };
    } else {
      if (r.word.startsWith('##')) current.word += r.word.slice(2);
      else if (r.word.startsWith(' ')) current.word += r.word.replace(' ', ' ');
      else current.word += (current.word.endsWith('-') ? '' : ' ') + r.word;
      current.score += r.score;
      current.count += 1;
    }
  }
  if (current) aggregated.push(current);

  return aggregated.map(agg => {
    const finalWord = agg.word.replace(/(\w)\s+([.,!?%])/g, '$1$2').replace(/\s+/g, ' ').trim();
    const suggestedCategory = mapToAppCategory(finalWord, agg.type, appCategories);
    if (!suggestedCategory) return null;

    return {
      word: finalWord,
      entity_group: agg.type,
      score: Math.round((agg.score / agg.count) * 100),
      start: 0,
      end: finalWord.length,
      suggestedCategory: suggestedCategory,
      description: generateEntityDescription(finalWord, agg.type, text),
    };
  }).filter(e => e !== null && e.word.length > 1);
}

function chunkText(text, maxWords = 300) {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return [{ text, offset: 0 }];
  const chunks = [];
  for (let i = 0; i < words.length; i += maxWords) {
    const chunkWords = words.slice(i, i + maxWords);
    const chunkText = chunkWords.join(' ');
    chunks.push({ text: chunkText, offset: text.indexOf(chunkText) });
  }
  return chunks;
}

let lastProgressTime = 0;

self.addEventListener('message', async (event) => {
  const { type, id, payload } = event.data;
  try {
    if (type === 'init') {
      if (!nerPipeline) {
        const Transformers = await import('@xenova/transformers');
        pipeline = Transformers.pipeline;
        env = Transformers.env;
        // Optimisations Vitesse (Point V - v1.6.2)
        env.backends.onnx.wasm.numThreads = 1; // Le multi-thread peut être instable en worker, mais SIMD est crucial
        env.backends.onnx.wasm.simd = true;    // SIMD booste les perfs de 2x à 4x
        env.allowLocalModels = false;
        env.useBrowserCache = true;

        nerPipeline = await pipeline('token-classification', MODEL_NAME, {
          quantized: true,
          progress_callback: (data) => {
            const now = Date.now();
            if (data.status !== 'progress' || (now - lastProgressTime > 100)) {
              lastProgressTime = now;
              self.postMessage({ type: 'progress', data });
            }
          },
        });
      }
      self.postMessage({ type: 'result', id, result: true });
    } else if (type === 'analyzeDocument') {
      const { textBlocks, appCategories } = payload;
      const allEntities = [];
      const totalBlocks = textBlocks.length;
      
      for (let i = 0; i < totalBlocks; i++) {
        const block = textBlocks[i];
        if (!block.content) continue;

        // Notification de progression
        self.postMessage({ 
          type: 'progress', 
          data: { 
            status: 'analyzing', 
            index: i + 1, 
            total: totalBlocks,
            label: block.title || `Bloc ${i + 1}`
          } 
        });

        const chunks = chunkText(block.content);
        for (const chunk of chunks) {
          const entities = await analyzeTextWorker(chunk.text, appCategories);
          allEntities.push(...entities.map(e => ({ ...e, start: e.start + chunk.offset, end: e.end + chunk.offset })));
        }
      }
      const deduped = new Map();
      for (const entity of allEntities) {
        const key = entity.word.toLowerCase();
        if (!deduped.has(key) || deduped.get(key).score < entity.score) deduped.set(key, entity);
      }
      self.postMessage({ type: 'result', id, result: Array.from(deduped.values()).sort((a, b) => b.score - a.score) });
    }
  } catch (error) {
    self.postMessage({ type: 'error', id, error: error.message });
  }
});