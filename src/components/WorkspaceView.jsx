import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Save, ChevronRight, ChevronLeft, Building2, ShieldAlert, User, CheckCircle2, Target, Trash2, Search, Moon, Sun, Tag, MapPin, Globe, CreditCard, Activity, Box, Database, Cloud, FileText, Download, BarChart3, Keyboard, FolderDown, X, Settings } from 'lucide-react';

import ExportModal from './ExportModal';
import StatsPanel from './StatsPanel';

// Constantes stables pour éviter les boucles de rendu infinies (Maximum update depth exceeded)
const EMPTY_ARRAY = [];
const EMPTY_OBJECT = {};
const DEFAULT_HIGHLIGHT_RULES = { capitals: true, acronyms: false, legal: false };


const availableIcons = {
  Tag, Building2, ShieldAlert, User, MapPin, Globe, CreditCard, Activity, Box, Database, Cloud, FileText
};

const normalizeEntityName = (name) => {
  if (!name) return '';
  // Noise words including conjunctions
  const noiseWords = new Set(['the', 'of', 'and', 'a', 'an', 'in', 'on', 'at', 'for', 'with', 'by', 'et', '&']);
  
  return name
    .toLowerCase()
    .trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[.,;:"'!?(){}[\]&]/g, ' ') // Replace punctuation (added &) with space
    .split(/\s+/)
    .filter(token => token.length > 0 && !noiseWords.has(token))
    .map(token => {
      // Basic singularization: remove trailing 's' if token length > 3
      if (token.length > 3 && token.endsWith('s')) {
        return token.slice(0, -1);
      }
      return token;
    })
    .sort()
    .join(' ');
};

const getLevenshteinDistance = (a, b) => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1  // deletion
          )
        );
      }
    }
  }
  return matrix[b.length][a.length];
};

const LazyTextChunk = ({ content, renderFn }) => {
  const [isVisible, setIsVisible] = useState(false);
  const chunkRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '400px' } // Charger avec une marge confortable
    );

    if (chunkRef.current) {
      observer.observe(chunkRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <p ref={chunkRef} className="mb-3 min-h-[1.4em]">
      {isVisible ? (
        renderFn(content)
      ) : (
        <span className="text-slate-300 dark:text-slate-700 select-none">
          {content.slice(0, 80)}
          &#8230;
        </span>
      )}
    </p>
  );
};

export default function WorkspaceView({
  entreprises = EMPTY_ARRAY,
  currentIndex = 0,
  setCurrentIndex,
  extractedEntities = EMPTY_OBJECT,
  setExtractedEntities,
  categories = EMPTY_ARRAY,
  highlightRules = DEFAULT_HIGHLIGHT_RULES,
  resetSession,
  onOpenConfig
}) {
  const currentCompany = entreprises[currentIndex];

  /**
   * splitIntoParagraphs — Découpage intelligent pour la virtualisation.
   * 1. Sépare le texte sur les sauts de ligne naturels (vrais paragraphes).
   * 2. Si un paragraphe dépasse MAX_PARA_LENGTH, il est sous-découpé
   * à la frontière d'un mot (espace) pour ne jamais couper un mot.
   */
  const splitIntoParagraphs = useCallback((text, maxParaLength = 3000) => {
    if (!text) return [];
    const rawParas = text.split(/\n+/).filter((p) => p.trim().length > 0);
    const result = [];
    for (const para of rawParas) {
      if (para.length <= maxParaLength) {
        result.push(para);
      } else {
        // Sub-chunk at word boundaries
        let start = 0;
        while (start < para.length) {
          let end = start + maxParaLength;
          if (end < para.length) {
            // Walk back to the nearest space so we don't cut a word
            while (end > start && para[end] !== ' ') end--;
            if (end === start) end = start + maxParaLength; // no space found, hard cut
          }
          result.push(para.slice(start, end).trim());
          start = end + 1;
        }
      }
    }
    return result;
  }, []);

  const progress =
    entreprises.length > 0
      ? Math.round((Object.keys(extractedEntities).length / entreprises.length) * 100)
      : 0;

  const [showExportModal, setShowExportModal] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showHotkeys, setShowHotkeys] = useState(false);

  const [currentEntityName, setCurrentEntityName] = useState('');
  const defaultCategoryId = categories.length > 0 ? categories[0].id : 'Entreprise';
  const [currentEntityType, setCurrentEntityType] = useState(defaultCategoryId);
  const [currentEntityNote, setCurrentEntityNote] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  
  const [pendingConflict, setPendingConflict] = useState(null);

  const [isDarkMode, setIsDarkMode] = useState(false);
  const entityInputRef = useRef(null);
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    }
  }, []);

  const toggleDarkMode = () => {
    if (typeof document === 'undefined') return;
    if (isDarkMode) {
      document.documentElement.classList.remove('dark');
      setIsDarkMode(false);
    } else {
      document.documentElement.classList.add('dark');
      setIsDarkMode(true);
    }
  };


  useEffect(() => {
    if (!searchQuery) {
      setSearchResults(prev => prev.length === 0 ? prev : []);
      return;
    }
    const lowerQ = searchQuery.toLowerCase();
    const results = entreprises
      .filter((e) => {
        if (e.uuid && String(e.uuid).toLowerCase().includes(lowerQ)) return true;
        if (e.metadata) {
          return Object.values(e.metadata).some((val) =>
            String(val).toLowerCase().includes(lowerQ)
          );
        }
        return false;
      })
      .slice(0, 100);
    setSearchResults(results);
  }, [searchQuery, entreprises]);

  const entitySuggestions = useMemo(() => {
    if (!currentEntityName || currentEntityName.trim().length < 2) return [];
    const input = currentEntityName.trim().toLowerCase();
    const inputRaw = currentEntityName.trim();
    const inputNorm = normalizeEntityName(inputRaw);

    const allNames = new Set();
    Object.values(extractedEntities).forEach((arr) => {
      arr.forEach((e) => allNames.add(e.name));
    });

    return Array.from(allNames)
      .filter((name) => {
        const lower = name.toLowerCase();
        const norm = normalizeEntityName(name);
        
        if (lower === input) return name !== inputRaw;
        if (norm === inputNorm && inputNorm.length > 0) return name !== inputRaw;
        
        return lower.includes(input) || input.includes(lower);
      })
      .slice(0, 5);
  }, [currentEntityName, extractedEntities]);

  const totalConflictCount = useMemo(() => {
    const allEntities = Object.values(extractedEntities).flat();
    const nameMap = {};
    allEntities.forEach(e => {
      const normalized = normalizeEntityName(e.name);
      if (!normalized) return;
      if (!nameMap[normalized]) nameMap[normalized] = new Set();
      nameMap[normalized].add(e.name);
    });
    return Object.values(nameMap).filter(variants => variants.size > 1).length;
  }, [extractedEntities]);

  const currentDocDuplicates = useMemo(() => {
    if (!currentCompany || !extractedEntities[currentCompany.uuid]) return new Set();
    const entities = extractedEntities[currentCompany.uuid];
    const counts = {};
    entities.forEach(e => {
      const norm = normalizeEntityName(e.name);
      if (!norm) return;
      counts[norm] = (counts[norm] || 0) + 1;
    });
    const dupes = new Set();
    Object.entries(counts).forEach(([norm, count]) => {
      if (count > 1) dupes.add(norm);
    });
    return dupes;
  }, [currentCompany, extractedEntities]);

  const isCurrentInputDuplicate = useMemo(() => {
    if (!currentEntityName.trim() || !currentCompany) return false;
    const normInput = normalizeEntityName(currentEntityName.trim());
    if (!normInput) return false;
    const existing = extractedEntities[currentCompany.uuid] || [];
    return existing.some(e => normalizeEntityName(e.name) === normInput);
  }, [currentEntityName, currentCompany, extractedEntities]);

  const handleAddEntity = useCallback((force = false) => {
    if (!currentEntityName.trim() || !currentCompany) return;

    const cleanName = currentEntityName.trim();
    const normalizedClean = normalizeEntityName(cleanName);

    // --- PHASE 1: LOCAL SCAN (Current record) ---
    const existingInDoc = extractedEntities[currentCompany.uuid] || [];
    // Search for normalized match OR fuzzy match (distance <= 2)
    const localConflict = existingInDoc.find((e) => {
      const normE = normalizeEntityName(e.name);
      if (normE === normalizedClean) return true;
      // Fuzzy check only for reasonably long names to avoid false positives on short ones
      if (normalizedClean.length > 3 && normE.length > 3) {
        return getLevenshteinDistance(normalizedClean, normE) <= 2;
      }
      return false;
    });

    if (localConflict && !force) {
      setPendingConflict({
        newName: cleanName,
        existingEntity: localConflict,
        type: currentEntityType,
        note: currentEntityNote.trim() || '',
        scope: 'local',
        origin: 'Cet enregistrement'
      });
      return;
    }

    // --- PHASE 2: GLOBAL SCAN (Rest of the project) ---
    if (!force) {
      const globalMatch = Object.entries(extractedEntities).find(([uuid, entities]) => {
        if (uuid === currentCompany.uuid) return false;
        return entities.some(e => {
          const normE = normalizeEntityName(e.name);
          if (normE === normalizedClean) return true;
          if (normalizedClean.length > 3 && normE.length > 3) {
            return getLevenshteinDistance(normalizedClean, normE) <= 2;
          }
          return false;
        });
      });

      if (globalMatch) {
        const [originUuid, entities] = globalMatch;
        const globalConflict = entities.find(e => {
          const normE = normalizeEntityName(e.name);
          if (normE === normalizedClean) return true;
          if (normalizedClean.length > 3 && normE.length > 3) {
            return getLevenshteinDistance(normalizedClean, normE) <= 2;
          }
          return false;
        });
        
        // STRICT BYPASS: Only if the string is 100% identical (including case)
        const isStrictIdentical = globalConflict.name === cleanName;
        
        if (!isStrictIdentical) {
          setPendingConflict({
            newName: cleanName,
            existingEntity: globalConflict,
            type: currentEntityType,
            note: currentEntityNote.trim() || '',
            scope: 'global',
            origin: originUuid
          });
          return;
        }
      }
    }

    setExtractedEntities((prev) => {
      const currentList = prev[currentCompany.uuid] || [];
      return {
        ...prev,
        [currentCompany.uuid]: [
          ...currentList,
          {
            name: cleanName,
            type: currentEntityType,
            note: currentEntityNote.trim() || '',
          },
        ],
      };
    });

    setCurrentEntityName('');
    setCurrentEntityNote('');
    if (entityInputRef.current) entityInputRef.current.focus();
  }, [currentEntityName, currentCompany, currentEntityType, currentEntityNote, extractedEntities, setExtractedEntities]);

  const handleResolveConflict = (resolution) => {
    if (!pendingConflict || !currentCompany) return;

    const { newName, existingEntity, type, note, scope } = pendingConflict;

    setExtractedEntities((prev) => {
      const existingInDoc = [...(prev[currentCompany.uuid] || [])];
      const normOld = normalizeEntityName(existingEntity.name);
      
      if (resolution === 'merge-keep-old') {
        const alreadyInDoc = existingInDoc.some(e => normalizeEntityName(e.name) === normOld);
        if (!alreadyInDoc) {
          existingInDoc.push({ ...existingEntity });
        }
      } else if (resolution === 'merge-keep-new') {
        const idx = existingInDoc.findIndex(e => normalizeEntityName(e.name) === normOld);
        if (idx !== -1) {
          existingInDoc[idx] = { ...existingInDoc[idx], name: newName, type, note };
        } else {
          existingInDoc.push({ name: newName, type, note });
        }
      } else if (resolution === 'keep-both') {
        existingInDoc.push({ name: newName, type, note, isDuplicateIntentional: true });
      }

      return {
        ...prev,
        [currentCompany.uuid]: existingInDoc
      };
    });

    setPendingConflict(null);
    
    // Check for global conflicts only if we chose "keep-both" in a local context
    if (resolution === 'keep-both' && scope === 'local') {
      // Re-trigger handleAddEntity with force=true to skip local check but check global?
      // Actually, handleAddEntity(true) will just add it.
      // Better: trigger a manual check or let handleAddEntity handle it.
      // For now, let's keep it simple: if local is resolved, we are done.
    }

    setCurrentEntityName('');
    setCurrentEntityNote('');
    if (entityInputRef.current) entityInputRef.current.focus();
  };

  const handleAddEntityRef = useRef(handleAddEntity);
  const categoriesRef = useRef(categories);
  const currentIndexRef = useRef(currentIndex);
  const entreprisesRef = useRef(entreprises);
  const currentEntityTypeRef = useRef(currentEntityType);

  useEffect(() => { handleAddEntityRef.current = handleAddEntity; }, [handleAddEntity]);
  useEffect(() => { categoriesRef.current = categories; }, [categories]);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { entreprisesRef.current = entreprises; }, [entreprises]);
  useEffect(() => { currentEntityTypeRef.current = currentEntityType; }, [currentEntityType]);

  useEffect(() => {
    const blockAltCode = (e) => {
      const activeEl = document.activeElement;
      const isInEntityInput = activeEl === entityInputRef.current;
      
      if (isInEntityInput && e.altKey) {
        const isDigit = e.code.startsWith('Digit') || e.code.startsWith('Numpad') || /^[0-9]$/.test(e.key);
        if (isDigit) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      }
    };

    const handleKeyDown = (e) => {
      const activeEl = document.activeElement;
      if (!activeEl) return;

      const isInSearch = activeEl.tagName === 'INPUT' && activeEl !== entityInputRef.current;
      const isInTextArea = activeEl.tagName === 'TEXTAREA';
      const isInSelect = activeEl.tagName === 'SELECT';
      const isInEntityInput = activeEl === entityInputRef.current;

      if (isInSearch || isInTextArea || isInSelect) return;

      let digit = null;
      const digitMatch = e.code.match(/^(?:Digit|Numpad)([1-9])$/);
      if (digitMatch) {
        digit = parseInt(digitMatch[1], 10);
      } else if (!e.altKey && !e.ctrlKey && /^[1-9]$/.test(e.key)) {
        digit = parseInt(e.key, 10);
      }

      if (digit !== null && !e.ctrlKey) {
        const keyIndex = digit - 1;
        const cats = categoriesRef.current;
        
        if (keyIndex >= 0 && keyIndex < cats.length && keyIndex < 9) {
          if (isInEntityInput) {
            if (e.altKey) {
              e.preventDefault();
              e.stopImmediatePropagation();
              setCurrentEntityType(cats[keyIndex].id);
              return;
            }
          } else {
            e.preventDefault();
            e.stopImmediatePropagation();
            setCurrentEntityType(cats[keyIndex].id);
            return;
          }
        }
      }

      if (e.key === 'Enter') {
        const isBodyOrWorkspace = activeEl.tagName === 'BODY' || activeEl.closest('.workspace-container');
        if (isInEntityInput || isBodyOrWorkspace) {
          e.preventDefault();
          e.stopImmediatePropagation();
          handleAddEntityRef.current();
        }
      }

      if (!isInEntityInput && !isInTextArea) {
        if (e.key === 'ArrowRight' && currentIndexRef.current < entreprisesRef.current.length - 1) {
          e.preventDefault();
          e.stopImmediatePropagation();
          setCurrentIndex((prev) => prev + 1);
        }
        if (e.key === 'ArrowLeft' && currentIndexRef.current > 0) {
          e.preventDefault();
          e.stopImmediatePropagation();
          setCurrentIndex((prev) => prev - 1);
        }
        if (e.key === '?' || (e.shiftKey && e.key === '/')) {
          e.preventDefault();
          e.stopImmediatePropagation();
          setShowHotkeys((h) => !h);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', blockAltCode, true);
    window.addEventListener('keypress', blockAltCode, true);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', blockAltCode, true);
      window.removeEventListener('keypress', blockAltCode, true);
    };
  }, [setCurrentIndex, setShowHotkeys]);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentIndex]);

  const highlightRegexInfo = useMemo(() => {
    const regexParts = [];
    if (highlightRules.legal)
      regexParts.push(
        '(?:LLC|Ltd|Inc|SA|SARL|GmbH|Bv|Plc|PLC|Corp|Co|Group|AG|SAS|S\\.A\\.)'
      );
    if (highlightRules.acronyms) regexParts.push('[A-Z\u0410-\u042F]{2,}');
    if (highlightRules.capitals)
      regexParts.push('[A-Z\u0410-\u042F][a-zA-Z0-9.\\u0400-\u04FF-]+');

    if (regexParts.length === 0) return null;

    const source = '\\b(' + regexParts.join('|') + ')\\b';
    return {
      combinedRegex: new RegExp(source, 'g'),
      testRegex: new RegExp('^(?:' + regexParts.join('|') + ')$'),
      regexParts,
    };
  }, [highlightRules]);

  const renderHighlightedText = useCallback(
    (text) => {
      if (!text || !highlightRegexInfo) return <span>{text}</span>;

      const { combinedRegex, testRegex } = highlightRegexInfo;
      const parts = text.split(combinedRegex);

      return parts.map((part, index) => {
        if (!part) return null;

        if (testRegex.test(part) || part.match(combinedRegex)) {
          return (
            <span
              key={index}
              className="bg-red-100 text-red-900 border-b-2 border-red-300 dark:bg-red-900/30 dark:text-red-200 dark:border-red-800 font-bold px-1 rounded-sm mx-px transition-colors hover:bg-red-200 dark:hover:bg-red-800/50"
              title="Entité potentielle détectée"
            >
              {part}
            </span>
          );
        }
        return <span key={index}>{part}</span>;
      });
    },
    [highlightRegexInfo]
  );

  const handleTextSelection = () => {
    let selection = window.getSelection()?.toString() || '';

    if (selection && selection.trim().length > 0) {
      selection = selection
        .replace(/^[\s,;."'-]+|[\s,;."'-]+$/g, '')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/[\x00-\x1F\u263A\u263B\u2665\u2666\u2663\u2660\u2022\u25D8\u25CB\u25D9\u2642\u2640\u266A\u266B\u263C\u25BA\u25C4\u2115\u203C\u00B6\u00A7\u25AC\u21A8\u2191\u2193\u2192\u2190\u221F\u2194\u25B2\u25BC]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (selection.length > 0) {
        setCurrentEntityName(selection);
        if (entityInputRef.current) entityInputRef.current.focus();
      }
    }
  };

  const handleChangeEntityType = (indexToChange, newType) => {
    if (!currentCompany) return;
    setExtractedEntities((prev) => {
      const existing = prev[currentCompany.uuid] || [];
      const updated = [...existing];
      updated[indexToChange] = { ...updated[indexToChange], type: newType };
      return { ...prev, [currentCompany.uuid]: updated };
    });
  };

  const handleRemoveEntity = (indexToRemove) => {
    if (!currentCompany) return;
    setExtractedEntities((prev) => {
      const existing = prev[currentCompany.uuid] || [];
      return {
        ...prev,
        [currentCompany.uuid]: existing.filter((_, idx) => idx !== indexToRemove),
      };
    });
  };

  const handleMarkNoTarget = () => {
    if (!currentCompany) return;
    setExtractedEntities((prev) => ({ ...prev, [currentCompany.uuid]: [] }));
    handleNext();
  };

  const handleNext = () => {
    if (currentIndex < entreprises.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setCurrentEntityName('');
      setCurrentEntityNote('');
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setCurrentEntityName('');
      setCurrentEntityNote('');
    }
  };

  const handleExportSession = () => {
    const sessionData = {
      _type: 'ba7ath-session',
      _version: 1,
      _exportedAt: new Date().toISOString(),
      entreprises,
      extractedEntities,
      categories,
      highlightRules,
      currentIndex,
    };
    const json = JSON.stringify(sessionData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Ba7ath_Session_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <div className="min-h-screen bg-animated-gradient p-4 sm:p-6 font-sans text-slate-900 dark:text-slate-100 flex flex-col items-center transition-colors duration-300">
        {/* HEADER FIXE */}
        <div className="w-full max-w-6xl mb-6 sticky top-0 z-50 glass-card rounded-xl px-5 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-fade-in-up">
          <div>
            <div className="flex items-center gap-3">
              <img src="/app-icon.png" alt="Logo" className="w-10 h-10 object-contain drop-shadow-md" />
              <div>
                <h1 className="text-xl font-black flex items-center gap-2 tracking-tight leading-none uppercase">
                  BA7ATH <span className="text-red-600">OSINT</span> TRACKER
                </h1>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mt-1">
                  v1.3 — Professional Edition
                </p>
              </div>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-2 ml-13 font-medium">
              Progression : {Object.keys(extractedEntities).length} traitées sur{' '}
              {entreprises.length}
            </p>
          </div>

          <div className="relative flex-1 min-w-[200px] max-w-md group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-red-500 transition-colors" />
            <input
              type="text"
              placeholder="Rechercher par ID ou métadonnée..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 transition shadow-sm"
            />
            {searchResults.length > 0 && searchQuery && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto custom-scrollbar animate-scale-in">
                <div className="p-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 sticky top-0 z-10 flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Résultats ({searchResults.length})
                  </span>
                </div>
                {searchResults.map((result) => (
                  <button
                    key={result.uuid}
                    className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition border-b last:border-0 border-slate-100 dark:border-slate-700 flex items-center"
                    onClick={() => {
                      const idx = entreprises.findIndex((e) => e.uuid === result.uuid);
                      if (idx !== -1) setCurrentIndex(idx);
                      setSearchQuery('');
                    }}
                  >
                    <span className="font-semibold text-red-600 dark:text-red-400 mr-2 shrink-0">
                      [{result.uuid && String(result.uuid).substring(0, 6)}]
                    </span>
                    <span className="text-slate-600 dark:text-slate-300 truncate text-sm">
                      {result.metadata && Object.values(result.metadata).join(' - ')}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 sm:gap-4 flex-wrap">
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-md bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button
              onClick={() => setShowHotkeys(!showHotkeys)}
              className={`p-2 rounded-md border transition ${showHotkeys
                ? 'bg-red-600 border-red-600 text-white'
                : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
            >
              <Keyboard className="w-5 h-5" />
            </button>
            <button
              onClick={onOpenConfig}
              className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-2 rounded-md text-sm font-medium transition"
              title="Configuration du projet"
            >
              <Settings className="w-4 h-4" /> <span className="hidden sm:inline">Config</span>
            </button>
            <button
              onClick={resetSession}
              className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-900/30 text-slate-600 dark:text-slate-300 px-3 py-2 rounded-md text-sm font-medium transition"
            >
              <Trash2 className="w-4 h-4" /> <span className="hidden sm:inline">Réinit</span>
            </button>
            <button
              onClick={() => setShowStats(!showStats)}
              className={`p-2 rounded-md border transition relative ${showStats
                ? 'bg-red-600 border-red-600 text-white'
                : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
            >
              <BarChart3 className="w-5 h-5" />
              {totalConflictCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-red-600 text-[10px] font-black text-white items-center justify-center border border-white dark:border-slate-900">
                    {totalConflictCount}
                  </span>
                </span>
              )}
            </button>
            <button
              onClick={handleExportSession}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md text-sm font-medium transition shadow-sm"
            >
              <FolderDown className="w-4 h-4" /> <span className="hidden sm:inline">Session</span>
            </button>
            <button
              onClick={() => setShowExportModal(true)}
              className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium transition shadow-sm"
            >
              <Download className="w-4 h-4" /> Exporter
            </button>
          </div>
        </div>

        {/* PROGRESS BAR */}
        <div className="w-full max-w-6xl mb-6 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Progression
            </span>
            <span className="text-xs font-bold text-red-600 dark:text-red-400">{progress}%</span>
          </div>
          <div className="w-full bg-white/60 dark:bg-slate-800/60 rounded-full h-2.5 border border-slate-200 dark:border-slate-700 overflow-hidden backdrop-blur-sm">
            <div
              className="bg-linear-to-r from-red-500 to-red-600 h-full rounded-full transition-all duration-500 shrink-0"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        {/* STATS PANEL */}
        {showStats && (
          <StatsPanel
            entreprises={entreprises}
            extractedEntities={extractedEntities}
            categories={categories}
            setExtractedEntities={setExtractedEntities}
            isOpen={showStats}
            onClose={() => setShowStats(false)}
          />
        )}

        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          {/* PANNEAU GAUCHE */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="glass-card rounded-xl overflow-hidden">
              <div className="bg-slate-800 dark:bg-slate-900 p-4 flex justify-between items-center text-white">
                <h2 className="font-bold">
                  Source ({currentIndex + 1}/{entreprises.length})
                </h2>
                <span className="text-xs font-mono bg-slate-700 px-2 py-1 rounded border border-slate-600">
                  {currentCompany?.uuid}
                </span>
              </div>

              <div className="p-6">
                {currentCompany?.metadata && Object.keys(currentCompany.metadata).length > 0 && (
                  <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 border-b border-slate-100 dark:border-slate-700 pb-6">
                    {Object.entries(currentCompany.metadata).map(([key, value]) => (
                      <div key={key} className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 px-1">{key}</p>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 wrap-break-word px-1">{value ? String(value) : <span className="italic text-slate-400">Non renseigné</span>}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div
                  ref={scrollContainerRef}
                  className="flex flex-col gap-6 max-h-[50vh] overflow-y-auto pr-2"
                  onMouseUp={handleTextSelection}
                  onTouchEnd={handleTextSelection}
                >
                  {currentCompany?.texts && currentCompany.texts.map((textBlock, idx) => (
                    <div key={idx} className="bg-[#fffae6] dark:bg-amber-900/10 p-5 rounded-lg border border-[#ffe066] dark:border-amber-700/50 relative">
                      <div className="absolute top-0 left-0 bg-[#ffe066] dark:bg-amber-700 text-amber-900 dark:text-amber-100 text-xs font-bold px-3 py-1 rounded-br-lg rounded-tl-lg shadow-sm">
                        {textBlock.title}
                      </div>
                      <div className="prose prose-slate dark:prose-invert prose-lg max-w-none leading-relaxed cursor-text selection:bg-yellow-300 selection:text-slate-900 dark:selection:bg-yellow-500/80 dark:selection:text-slate-900 mt-4 h-full">
                        {splitIntoParagraphs(textBlock.content).map((para, cIdx) => (
                          <LazyTextChunk key={cIdx} content={para} renderFn={renderHighlightedText} />
                        ))}
                      </div>
                    </div>
                  ))}

                  {!currentCompany?.texts && currentCompany?.text && (
                    <div className="bg-[#fffae6] dark:bg-amber-900/10 p-5 rounded-lg border border-[#ffe066] dark:border-amber-700/50 relative">
                      <div className="prose prose-slate dark:prose-invert prose-lg max-w-none leading-relaxed cursor-text selection:bg-yellow-300 selection:text-slate-900 dark:selection:bg-yellow-500/80 dark:selection:text-slate-900 mt-4 h-full">
                        {splitIntoParagraphs(currentCompany.text).map((para, cIdx) => (
                          <LazyTextChunk key={cIdx} content={para} renderFn={renderHighlightedText} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center p-4 glass-card rounded-xl">
              <button
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 transition"
              >
                <ChevronLeft className="w-5 h-5" /> Prev
              </button>
              <span className="text-sm font-semibold text-slate-400">
                {currentIndex + 1} / {entreprises.length}
              </span>
              <button
                onClick={handleNext}
                disabled={currentIndex === entreprises.length - 1}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium bg-slate-800 dark:bg-slate-700 text-white hover:bg-slate-900 dark:hover:bg-slate-600 disabled:opacity-50 transition"
              >
                Suiv <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* PANNEAU DROIT */}
          <div className="lg:col-span-5 sticky top-[100px] flex flex-col max-h-[calc(100vh-120px)] glass-card rounded-xl overflow-hidden">
            <div className="bg-linear-to-r from-red-600 to-red-700 p-4 border-b border-red-700">
              <h2 className="font-bold text-lg text-white flex items-center gap-2">
                <ShieldAlert className="w-5 h-5" /> Entités Ciblées
              </h2>
            </div>

            <div className="p-5 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
              <div className="flex flex-col gap-3">
                <input
                  ref={entityInputRef}
                  type="text"
                  value={currentEntityName}
                  onChange={(e) => setCurrentEntityName(e.target.value.replace(/[\x00-\x1F\u263A\u263B\u2665\u2666\u2663\u2660\u2022\u25D8\u25CB\u25D9\u2642\u2640\u266A\u266B\u263C\u25BA\u25C4\u2115\u203C\u00B6\u00A7\u25AC\u21A8\u2191\u2193\u2192\u2190\u221F\u2194\u25B2\u25BC]/g, ''))}
                  placeholder="Nom de l'entité..."
                  className={`w-full px-4 py-3 text-lg font-medium border rounded-md bg-white dark:bg-slate-800 transition-all outline-none ${
                    isCurrentInputDuplicate 
                    ? 'border-amber-400 ring-2 ring-amber-400/20' 
                    : 'border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-red-500'
                  }`}
                />
                {entitySuggestions.length > 0 && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-md p-2">
                    <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mb-1">Entités similaires existantes :</p>
                    <div className="flex flex-wrap gap-1.5">
                      {entitySuggestions.map((name) => (
                        <button key={name} onClick={() => setCurrentEntityName(name)} className="text-xs px-2.5 py-1 rounded-md bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-600 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition font-medium">
                          {name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <input
                  type="text"
                  value={currentEntityNote}
                  onChange={(e) => setCurrentEntityNote(e.target.value)}
                  placeholder="Note ou Contexte (Optionnel)..."
                  className="w-full px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 focus:ring-1 focus:ring-red-500 outline-none"
                />

                <div className="flex gap-2">
                  <select
                    value={currentEntityType}
                    onChange={(e) => setCurrentEntityType(e.target.value)}
                    className="flex-1 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium border border-slate-300 dark:border-slate-600 rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-red-500"
                  >
                    {categories.map((cat, index) => (
                      <option key={cat.id} value={cat.id} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">{cat.name} [{index + 1}]</option>
                    ))}
                  </select>
                  <button onClick={handleAddEntity} className="bg-slate-800 text-white px-6 py-2 rounded-md font-bold hover:bg-slate-900 transition">Associer [Entrée]</button>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-end">
                <button onClick={handleMarkNoTarget} className="text-sm font-medium flex items-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-green-600 dark:hover:text-green-500 transition">
                  <CheckCircle2 className="w-4 h-4" /> Passer (Vide)
                </button>
              </div>
            </div>

            <div className="p-5 flex-1 overflow-y-auto bg-white dark:bg-slate-800">
              {(!currentCompany || extractedEntities[currentCompany.uuid] === undefined) ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60 mt-10">
                  <Target className="w-16 h-16 mb-3" />
                  <p className="font-medium text-center">Aucune cible saisie</p>
                </div>
              ) : extractedEntities[currentCompany.uuid].length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-green-600 dark:text-green-400 mt-10 bg-green-50 dark:bg-green-900/20 p-6 rounded-lg border border-green-100 dark:border-green-900/50">
                  <CheckCircle2 className="w-12 h-12 mb-2" />
                  <p className="font-medium text-center">Vérifié. Aucune cible pertinente.</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {extractedEntities[currentCompany.uuid].map((entity, idx) => {
                    const isDupe = currentDocDuplicates.has(normalizeEntityName(entity.name));
                    return (
                      <li key={idx} className={`flex flex-col p-3 border rounded-lg shadow-sm group transition-colors ${
                        isDupe 
                        ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/50' 
                        : 'bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600'
                      }`}>
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-slate-800 dark:text-slate-100 text-lg leading-tight">{entity.name}</p>
                              {isDupe && (
                                <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" title="Doublon dans ce document" />
                              )}
                            </div>
                            {entity.note && <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">{entity.note}</span>}
                          </div>
                          <button onClick={() => handleRemoveEntity(idx)} className="text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 p-1.5 rounded transition opacity-0 group-hover:opacity-100">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {(() => {
                          const cat = categories.find((c) => c.id === entity.type) || { name: entity.type, color: 'bg-slate-700', icon: 'Tag' };
                          const IconComp = availableIcons[cat.icon] || availableIcons.Tag;
                          return (
                            <div className="flex items-center gap-2">
                              <div className={`p-1.5 rounded text-white shrink-0 ${cat.color}`}><IconComp className="w-3 h-3" /></div>
                              <select
                                value={entity.type}
                                onChange={(e) => handleChangeEntityType(idx, e.target.value)}
                                className="text-xs uppercase tracking-wider font-bold bg-transparent dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white cursor-pointer outline-none focus:ring-2 focus:ring-red-500 rounded p-1"
                              >
                                {categories.map((c) => (
                                  <option key={c.id} value={c.id} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">{c.name}</option>
                                ))}
                              </select>
                            </div>
                          );
                        })()}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>

        <ExportModal isOpen={showExportModal} onClose={() => setShowExportModal(false)} />

        {showHotkeys && (
          <div className="fixed inset-0 z-100 flex items-center justify-center p-4" onClick={() => setShowHotkeys(false)}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>
            <div className="relative glass-card rounded-2xl p-6 max-w-md w-full animate-scale-in" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                <Keyboard className="w-5 h-5 text-red-600" /> Raccourcis Clavier
              </h3>
              <div className="space-y-2.5">
                {[
                  ['←', 'Source précédente'],
                  ['→', 'Source suivante'],
                  ['Entrée', 'Associer l’entité saisie'],
                  ['1 - 9', 'Changer de catégorie'],
                  ['?', 'Afficher / masquer cette aide'],
                ].map(([key, desc]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-300">{desc}</span>
                    <kbd className="px-2.5 py-1 text-xs font-mono font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-md border border-slate-300 dark:border-slate-600 shadow-sm">{key}</kbd>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {pendingConflict && (
          <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden animate-scale-in">
              <div className={`p-4 flex items-center justify-between text-white ${pendingConflict.scope === 'local' ? 'bg-red-600' : 'bg-amber-500'}`}>
                <div className="flex items-center gap-3">
                  <ShieldAlert className="w-6 h-6" />
                  <h3 className="font-bold text-lg">
                    {pendingConflict.scope === 'local' ? 'Doublon Détecté' : 'Similitude Détectée'}
                  </h3>
                </div>
                <span className="px-2 py-1 rounded bg-white/20 text-[10px] font-black tracking-widest uppercase">
                  {pendingConflict.scope}
                </span>
              </div>
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className={`w-2 h-2 rounded-full ${pendingConflict.scope === 'local' ? 'bg-red-500' : 'bg-amber-500'}`}></span>
                  <p className="text-slate-600 dark:text-slate-300 text-sm font-semibold uppercase tracking-tight">
                    Source: <span className="text-slate-900 dark:text-white font-bold">{pendingConflict.origin}</span>
                  </p>
                </div>
                
                <p className="text-slate-500 dark:text-slate-400 text-xs mb-6 leading-relaxed italic">
                  {pendingConflict.scope === 'local' 
                    ? "Cette entité est déjà présente dans l'enregistrement actif." 
                    : "Cette entité ressemble à une saisie existante dans un autre enregistrement du projet."}
                </p>
                <div className="space-y-4">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Entité existante :</p>
                    <p className="font-bold text-slate-900 dark:text-white">« {pendingConflict.existingEntity.name} »</p>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                    <p className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 mb-1">Nouvelle tentative :</p>
                    <p className="font-bold text-slate-900 dark:text-white">« {pendingConflict.newName} »</p>
                  </div>
                </div>
                <div className="mt-8 flex flex-col gap-2">
                  <button onClick={() => handleResolveConflict('merge-keep-old')} className="w-full py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-bold transition-colors flex items-center justify-between">
                    <span>Fusionner (Garder l'ancien nom)</span>
                    <CheckCircle2 className="w-4 h-4 text-slate-400" />
                  </button>
                  <button onClick={() => handleResolveConflict('merge-keep-new')} className="w-full py-2.5 px-4 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 text-white rounded-lg font-bold transition-colors flex items-center justify-between">
                    <span>Remplacer par le nouveau</span>
                    <Save className="w-4 h-4 text-blue-400" />
                  </button>
                  <div className="relative py-2">
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-slate-200 dark:border-slate-700"></div>
                    <span className="relative bg-white dark:bg-slate-900 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mx-auto block w-fit">ou</span>
                  </div>
                  <button onClick={() => handleResolveConflict('keep-both')} className="w-full py-2.5 px-4 bg-linear-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-lg font-bold transition-all shadow-lg shadow-red-500/20">
                    Garder les deux (Doublons)
                  </button>
                  <button onClick={() => setPendingConflict(null)} className="mt-2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors py-2 font-medium text-center">
                    Annuler l'opération
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}