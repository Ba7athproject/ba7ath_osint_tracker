import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Save, ChevronRight, ChevronLeft, Building2, ShieldAlert, User, CheckCircle2, Target, Trash2, Search, Moon, Sun, Tag, MapPin, Globe, CreditCard, Activity, Box, Database, Cloud, FileText, Download, BarChart3, Keyboard, FolderDown, X } from 'lucide-react';

import ExportModal from './ExportModal';
import StatsPanel from './StatsPanel';

// Constantes stables pour éviter les boucles de rendu infinies (Maximum update depth exceeded)
const EMPTY_ARRAY = [];
const EMPTY_OBJECT = {};
const DEFAULT_HIGHLIGHT_RULES = { capitals: true, acronyms: false, legal: false };


const availableIcons = {
  Tag, Building2, ShieldAlert, User, MapPin, Globe, CreditCard, Activity, Box, Database, Cloud, FileText
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
  resetSession
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
  // Use the first category as the default type, fallback to a string if categories is empty (shouldn't happen)
  const defaultCategoryId = categories.length > 0 ? categories[0].id : 'Entreprise';
  const [currentEntityType, setCurrentEntityType] = useState(defaultCategoryId);
  const [currentEntityNote, setCurrentEntityNote] = useState(''); // NOUVEAU: Champ Note

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  const [isDarkMode, setIsDarkMode] = useState(false);
  const entityInputRef = useRef(null);
  const scrollContainerRef = useRef(null);

  // Initialize Dark Mode correctly
  useEffect(() => {
    if (typeof document !== 'undefined') {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    }
  }, []);

  // Toggle Dark Mode
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

  // NOUVEAU: Moteur de recherche global simple
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

  // === SUGGESTIONS D'ENTITÉS (Phase 7 — Dedup) ===
  const entitySuggestions = useMemo(() => {
    if (!currentEntityName || currentEntityName.trim().length < 2) return [];
    const input = currentEntityName.trim().toLowerCase();
    const inputRaw = currentEntityName.trim();
    
    // Collecter toutes les entités uniques
    const allNames = new Set();
    Object.values(extractedEntities).forEach((arr) => {
      arr.forEach((e) => allNames.add(e.name));
    });
    
    // Filtrer les noms similaires
    return Array.from(allNames)
      .filter((name) => {
        const lower = name.toLowerCase();
        // Suggérer si inclu (ou incluant) OU si c'est le même mot mais avec une casse différente
        if (lower === input) {
            return name !== inputRaw; // C'est une variante ! (ex: "TOTAL" vs "total")
        }
        return lower.includes(input) || input.includes(lower);
      })
      .slice(0, 5);
  }, [currentEntityName, extractedEntities]);

  // === CALCUL DES CONFLITS (Header Badge) ===
  const totalConflictCount = useMemo(() => {
    const allEntities = Object.values(extractedEntities).flat();
    const nameMap = {};
    allEntities.forEach(e => {
      const lower = e.name.toLowerCase().trim();
      if (!nameMap[lower]) nameMap[lower] = new Set();
      nameMap[lower].add(e.name);
    });
    return Object.values(nameMap).filter(variants => variants.size > 1).length;
  }, [extractedEntities]);

  const handleAddEntity = useCallback(() => {
    if (!currentEntityName.trim() || !currentCompany) return;

    setExtractedEntities((prev) => {
      const cleanName = currentEntityName.trim();
      const existing = prev[currentCompany.uuid] || [];

      // Vérification casse-insensible pour éviter les doublons exacts
      if (existing.some((e) => e.name.toLowerCase() === cleanName.toLowerCase())) {
        return prev;
      }

      return {
        ...prev,
        [currentCompany.uuid]: [
          ...existing,
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
    // Focus auto back to entity input for fast tagging
    if (entityInputRef.current) entityInputRef.current.focus();
  }, [currentEntityName, currentCompany, currentEntityType, currentEntityNote, setExtractedEntities]);


  // Raccourcis Clavier (Hotkeys) - CORRIGÉS POUR L'OSINT
  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeEl = document.activeElement;
      if (!activeEl) return;

      const isInSearch = activeEl.tagName === 'INPUT' && activeEl !== entityInputRef.current;
      const isInTextArea = activeEl.tagName === 'TEXTAREA';
      const isInSelect = activeEl.tagName === 'SELECT';
      const isInEntityInput = activeEl === entityInputRef.current;

      // Bloquer tous les raccourcis dans recherche, textarea, select
      if (isInSearch || isInTextArea || isInSelect) return;

      // Raccourcis numériques (1-9) → changer de catégorie.
      const keyIndex = parseInt(e.key, 10) - 1;
      if (
        !Number.isNaN(keyIndex) &&
        keyIndex >= 0 &&
        keyIndex < categories.length &&
        keyIndex < 9
      ) {
        if (isInEntityInput) {
          // Si on tape le nom, on exige la touche Alt pour changer de catégorie (évite de bloquer la frappe des chiffres)
          if (e.altKey) {
            e.preventDefault();
            setCurrentEntityType(categories[keyIndex].id);
          }
        } else {
          e.preventDefault();
          setCurrentEntityType(categories[keyIndex].id);
        }
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddEntity();
      }
      if (e.key === 'ArrowRight' && !isInEntityInput && currentIndex < entreprises.length - 1) {
        e.preventDefault();
        setCurrentIndex((prev) => prev + 1);
      }
      if (e.key === 'ArrowLeft' && !isInEntityInput && currentIndex > 0) {
        e.preventDefault();
        setCurrentIndex((prev) => prev - 1);
      }
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setShowHotkeys((h) => !h);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, entreprises.length, categories, handleAddEntity, setCurrentIndex]);

  // NOUVEAU: Focus Automatique en haut de contenu quand l'index change
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentIndex]);

  // Moteur de Regex OSINT (Mémorisé pour la performance)
  // On ne recompile la Regex que si les règles changent, pas à chaque paragraphe
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
      // Nettoyage: espaces avant/après, virgules, points-virgules, tirets en début/fin, caractères invisibles
      selection = selection
        .replace(/^[\s,;."'-]+|[\s,;."'-]+$/g, '')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
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

  // === EXPORT SESSION (Phase 8) ===
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
            <h1 className="text-2xl font-black flex items-center gap-2 tracking-tight">
              <ShieldAlert className="text-red-600 dark:text-red-500 w-6 h-6" />
              Ba7ath <span className="text-red-600">OSINT</span>
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              Progression : {Object.keys(extractedEntities).length} traitées sur{' '}
              {entreprises.length}
            </p>
          </div>

          {/* Barre de Recherche Rapide */}
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
                  {searchResults.length >= 100 && (
                    <span className="text-[10px] text-amber-500 font-medium">Top 100</span>
                  )}
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
              title="Raccourcis clavier (?)"
            >
              <Keyboard className="w-5 h-5" />
            </button>
            <button
              onClick={resetSession}
              className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-900/30 text-slate-600 dark:text-slate-300 px-3 py-2 rounded-md text-sm font-medium transition"
              title="Effacer la mémoire"
            >
              <Trash2 className="w-4 h-4" /> <span className="hidden sm:inline">Réinit</span>
            </button>
            <button
              onClick={() => setShowStats(!showStats)}
              className={`p-2 rounded-md border transition relative ${showStats
                  ? 'bg-red-600 border-red-600 text-white'
                  : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              title="Tableau de bord"
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
              title="Sauvegarder la session complète"
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

        <div
          className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-fade-in-up"
          style={{ animationDelay: '200ms' }}
        >
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
                {currentCompany?.metadata &&
                  Object.keys(currentCompany.metadata).length > 0 && (
                    <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 border-b border-slate-100 dark:border-slate-700 pb-6">
                      {Object.entries(currentCompany.metadata).map(([key, value]) => (
                        <div
                          key={key}
                          className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700"
                        >
                          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 px-1">
                            {key}
                          </p>
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100 wrap-break-word px-1">
                            {value ? (
                              String(value)
                            ) : (
                              <span className="italic text-slate-400">Non renseigné</span>
                            )}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                <div
                  ref={scrollContainerRef}
                  className="flex flex-col gap-6 max-h-[50vh] overflow-y-auto pr-2"
                  onMouseUp={handleTextSelection}
                  onTouchEnd={handleTextSelection}
                  title="Surlignez du texte ici pour le formulaire"
                >
                  {currentCompany?.texts &&
                    currentCompany.texts.map((textBlock, idx) => (
                      <div
                        key={idx}
                        className="bg-[#fffae6] dark:bg-amber-900/10 p-5 rounded-lg border border-[#ffe066] dark:border-amber-700/50 relative"
                      >
                        <div className="absolute top-0 left-0 bg-[#ffe066] dark:bg-amber-700 text-amber-900 dark:text-amber-100 text-xs font-bold px-3 py-1 rounded-br-lg rounded-tl-lg shadow-sm">
                          {textBlock.title}
                        </div>
                        <div className="prose prose-slate dark:prose-invert prose-lg max-w-none leading-relaxed cursor-text selection:bg-yellow-300 selection:text-slate-900 dark:selection:bg-yellow-500/80 dark:selection:text-slate-900 mt-4 h-full">
                          {splitIntoParagraphs(textBlock.content).map((para, cIdx) => (
                            <LazyTextChunk
                              key={cIdx}
                              content={para}
                              renderFn={renderHighlightedText}
                            />
                          ))}
                        </div>
                      </div>
                    ))}

                  {!currentCompany?.texts && currentCompany?.text && (
                    <div className="bg-[#fffae6] dark:bg-amber-900/10 p-5 rounded-lg border border-[#ffe066] dark:border-amber-700/50 relative">
                      <div className="prose prose-slate dark:prose-invert prose-lg max-w-none leading-relaxed cursor-text selection:bg-yellow-300 selection:text-slate-900 dark:selection:bg-yellow-500/80 dark:selection:text-slate-900 mt-4 h-full">
                        {splitIntoParagraphs(currentCompany.text).map((para, cIdx) => (
                          <LazyTextChunk
                            key={cIdx}
                            content={para}
                            renderFn={renderHighlightedText}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {!currentCompany?.texts && !currentCompany?.text && (
                    <div className="text-center text-slate-500 italic py-10">
                      Aucun texte à analyser.
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
                  onChange={(e) => setCurrentEntityName(e.target.value)}
                  placeholder="Nom de l'entité..."
                  className="w-full px-4 py-3 text-lg font-medium border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 focus:ring-2 focus:ring-red-500 outline-none"
                />
                {entitySuggestions.length > 0 && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-md p-2">
                    <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mb-1">
                      Entités similaires existantes :
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {entitySuggestions.map((name) => (
                        <button
                          key={name}
                          onClick={() => setCurrentEntityName(name)}
                          className="text-xs px-2.5 py-1 rounded-md bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-600 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition font-medium"
                        >
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
                      <option
                        key={cat.id}
                        value={cat.id}
                        className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                      >
                        {cat.name} [{index + 1}]
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleAddEntity}
                    className="bg-slate-800 text-white px-6 py-2 rounded-md font-bold hover:bg-slate-900 transition"
                  >
                    Associer [Entrée]
                  </button>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-end">
                <button
                  onClick={handleMarkNoTarget}
                  className="text-sm font-medium flex items-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-green-600 dark:hover:text-green-500 transition"
                >
                  <CheckCircle2 className="w-4 h-4" /> Passer (Vide)
                </button>
              </div>
            </div>

            <div className="p-5 flex-1 overflow-y-auto bg-white dark:bg-slate-800">
              {!currentCompany || extractedEntities[currentCompany.uuid] === undefined ? (
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
                  {extractedEntities[currentCompany.uuid].map((entity, idx) => (
                    <li
                      key={idx}
                      className="flex flex-col p-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg shadow-sm group"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex flex-col">
                          <p className="font-bold text-slate-800 dark:text-slate-100 text-lg leading-tight">
                            {entity.name}
                          </p>
                          {entity.note && (
                            <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              {entity.note}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleRemoveEntity(idx)}
                          className="text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 p-1.5 rounded transition opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {(() => {
                        const cat =
                          categories.find((c) => c.id === entity.type) || {
                            name: entity.type,
                            color: 'bg-slate-700',
                            icon: 'Tag',
                          };

                        const IconComp =
                          availableIcons[cat.icon] ||
                          availableIcons.Tag;

                        return (
                          <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded text-white shrink-0 ${cat.color}`}>
                              <IconComp className="w-3 h-3" />
                            </div>
                            <select
                              value={entity.type}
                              onChange={(e) => handleChangeEntityType(idx, e.target.value)}
                              className="text-xs uppercase tracking-wider font-bold bg-transparent dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white cursor-pointer outline-none focus:ring-2 focus:ring-red-500 rounded p-1"
                            >
                              {categories.map((c) => (
                                <option
                                  key={c.id}
                                  value={c.id}
                                  className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                                >
                                  {c.name}
                                </option>
                              ))}
                              {!categories.some((c) => c.id === entity.type) && (
                                <option
                                  value={entity.type}
                                  className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                                >
                                  {entity.type} (Supprimée)
                                </option>
                              )}
                            </select>
                          </div>
                        );
                      })()}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
      />

      {showHotkeys && (
        <div
          className="fixed inset-0 z-100 flex items-center justify-center p-4"
          onClick={() => setShowHotkeys(false)}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>
          <div
            className="relative glass-card rounded-2xl p-6 max-w-md w-full animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
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
                  <kbd className="px-2.5 py-1 text-xs font-mono font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-md border border-slate-300 dark:border-slate-600 shadow-sm">
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-4 text-center">
              Les raccourcis sont désactivés quand vous tapez dans un champ de texte.
            </p>
          </div>
        </div>
      )}
    </>
  );
}