import React, { useState, useEffect, useRef } from 'react';
import { Save, ChevronRight, ChevronLeft, Building2, ShieldAlert, User, CheckCircle2, Target, Trash2, Search, Moon, Sun, Tag, MapPin, Globe, CreditCard, Activity, Box, Database, Cloud, FileText, Download } from 'lucide-react';
import ExportModal from './ExportModal';

const availableIcons = {
  Tag, Building2, ShieldAlert, User, MapPin, Globe, CreditCard, Activity, Box, Database, Cloud, FileText
};

export default function WorkspaceView({ 
  entreprises, 
  currentIndex, 
  setCurrentIndex, 
  extractedEntities, 
  setExtractedEntities, 
  categories = [], 
  highlightRules = { capitals: true, acronyms: false, legal: false },
  resetSession 
}) {
  const currentCompany = entreprises[currentIndex];
  const progress = entreprises.length > 0 ? Math.round((Object.keys(extractedEntities).length / entreprises.length) * 100) : 0;

  const [showExportModal, setShowExportModal] = useState(false);

  const [currentEntityName, setCurrentEntityName] = useState('');
  // Use the first category as the default type, fallback to a string if categories is empty (shouldn't happen)
  const defaultCategoryId = categories.length > 0 ? categories[0].id : 'Entreprise';
  const [currentEntityType, setCurrentEntityType] = useState(defaultCategoryId);
  const [currentEntityNote, setCurrentEntityNote] = useState(''); // NOUVEAU: Champ Note
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  
  const [isDarkMode, setIsDarkMode] = useState(() => document.documentElement.classList.contains('dark'));
  const entityInputRef = useRef(null);
  const scrollContainerRef = useRef(null);

  // Toggle Dark Mode
  const toggleDarkMode = () => {
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
        setSearchResults([]);
        return;
    }
    const lowerQ = searchQuery.toLowerCase();
    const results = entreprises.filter(e => {
      // Search UUID
      if (e.uuid.toLowerCase().includes(lowerQ)) return true;
      // Search inside metadata
      if (e.metadata) {
        return Object.values(e.metadata).some(val => 
          String(val).toLowerCase().includes(lowerQ)
        );
      }
      return false;
    }).slice(0, 10);
    setSearchResults(results);
  }, [searchQuery, entreprises]);

  // NOUVEAU: Raccourcis Clavier (Hotkeys)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Éviter de déclencher les hotkeys si l'utilisateur tape dans la recherche ou note
      if (document.activeElement.tagName === 'INPUT' && document.activeElement !== entityInputRef.current) return;
      if (document.activeElement.tagName === 'TEXTAREA') return;

      // Map numeric keys (1-9) to categories dynamically
      const keyIndex = parseInt(e.key) - 1;
      if (keyIndex >= 0 && keyIndex < categories.length && keyIndex < 9) {
        e.preventDefault();
        setCurrentEntityType(categories[keyIndex].id);
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddEntity();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentEntityName, currentEntityType, currentEntityNote]); 
  // Dépendances nécessaires pour que handleAddEntity ait les bonnes valeurs stockées

  // NOUVEAU: Focus Automatique en haut de contenu quand l'index change
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setCurrentEntityName('');
    setCurrentEntityNote('');
  }, [currentIndex]);
  const renderHighlightedText = (text) => {
    if (!text) return null;

    // Construire dynamiquement le regex en fonction des règles actives
    const regexParts = [];

    // 1. Structures Légales
    if (highlightRules.legal) {
      regexParts.push('(?:LLC|Ltd|Inc|SA|SARL|GmbH|Bv|Plc|PLC|Corp|Co|Group|AG|SAS|S\\.A\\.)');
    }

    // 2. Acronymes (mots tout en majuscules de 2+ lettres)
    if (highlightRules.acronyms) {
      regexParts.push('[A-Z\u0410-\u042F]{2,}');
    }

    // 3. Majuscules initiales
    if (highlightRules.capitals) {
      regexParts.push('[A-Z\u0410-\u042F][a-zA-Z0-9.\u0400-\u04FF-]+');
    }

    // Si aucune règle, retourner le texte brut
    if (regexParts.length === 0) {
      return <span>{text}</span>;
    }

    // Construire la regex finale — on utilise \b (word boundary) autour du groupe
    const source = '\\b(' + regexParts.join('|') + ')\\b';
    const combinedRegex = new RegExp(source, 'g');
    const parts = text.split(combinedRegex);

    return parts.map((part, index) => {
      if (!part) return null;

      // Re-tester si le fragment est un match
      const testRegex = new RegExp('^(?:' + regexParts.join('|') + ')$');
      if (testRegex.test(part)) {
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
  };

  const handleTextSelection = () => {
    let selection = window.getSelection().toString();
    
    if (selection && selection.trim().length > 0) {
      // Nettoyage: espaces avant/après, virgules, points-virgules, tirets en début/fin, caractères invisibles
      selection = selection
        .replace(/^[\s,;."\'\-]+|[\s,;."\'\-]+$/g, '') // Enlever ponctuation début/fin
        .replace(/[\u200B-\u200D\uFEFF]/g, '') // Enlever zero-width spaces et autres char invisibles
        .replace(/\s+/g, ' ') // Normaliser espaces multiples en un seul espace
        .trim();

      if (selection.length > 0) {
        setCurrentEntityName(selection);
        if (entityInputRef.current) entityInputRef.current.focus();
      }
    }
  };

  const handleAddEntity = () => {
    if (!currentEntityName.trim() || !currentCompany) return;

    setExtractedEntities(prev => {
      const existing = prev[currentCompany.uuid] || [];
      const cleanName = currentEntityName.trim();
      
      // Vérification casse-insensible pour éviter les doublons exacts
      if (existing.some(e => e.name.toLowerCase() === cleanName.toLowerCase())) {
        return prev;
      }

      return {
        ...prev,
        [currentCompany.uuid]: [...existing, { 
          name: cleanName, 
          type: currentEntityType,
          note: currentEntityNote.trim() || ''
        }]
      };
    });

    setCurrentEntityName('');
    setCurrentEntityNote('');
    // Focus auto back to entity input for fast tagging
    if (entityInputRef.current) entityInputRef.current.focus();
  };

  const handleChangeEntityType = (indexToChange, newType) => {
    setExtractedEntities(prev => {
      const existing = prev[currentCompany.uuid] || [];
      const updated = [...existing];
      updated[indexToChange].type = newType;
      return { ...prev, [currentCompany.uuid]: updated };
    });
  };

  const handleRemoveEntity = (indexToRemove) => {
    setExtractedEntities(prev => {
      const existing = prev[currentCompany.uuid] || [];
      return { ...prev, [currentCompany.uuid]: existing.filter((_, idx) => idx !== indexToRemove) };
    });
  };

  const handleMarkNoTarget = () => {
    if (!currentCompany) return;
    setExtractedEntities(prev => ({ ...prev, [currentCompany.uuid]: [] }));
    handleNext();
  };

  const handleNext = () => currentIndex < entreprises.length - 1 && setCurrentIndex(prev => prev + 1);
  const handlePrev = () => currentIndex > 0 && setCurrentIndex(prev => prev - 1);

  return (
    <>
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 p-4 sm:p-6 font-sans text-slate-900 dark:text-slate-100 flex flex-col items-center transition-colors duration-300">
      
      {/* HEADER FIXE */}
      <div className="w-full max-w-6xl mb-6 sticky top-0 z-50 bg-slate-100/90 dark:bg-slate-900/90 backdrop-blur-sm py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldAlert className="text-red-600 dark:text-red-500 w-6 h-6" />
            Ba7ath OSINT Tracker
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Progression : {Object.keys(extractedEntities).length} traitées sur {entreprises.length}
          </p>
        </div>

        {/* Barre de Recherche Rapide */}
        <div className="relative w-full sm:w-64">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Rechercher (Nom, ID...)" 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-sm outline-none focus:ring-2 focus:ring-red-500 transition-colors"
            />
          </div>
          {searchResults.length > 0 && (
            <div className="absolute top-full mt-2 w-full bg-white dark:bg-slate-800 rounded-md shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden z-50">
              {searchResults.map(result => (
                <button 
                  key={result.uuid} 
                  className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700 text-sm truncate last:border-0"
                  onClick={() => {
                    const idx = entreprises.findIndex(e => e.uuid === result.uuid);
                    if (idx !== -1) setCurrentIndex(idx);
                    setSearchQuery('');
                  }}
                >
                  <span className="font-semibold text-red-600 dark:text-red-400 mr-2">[{result.uuid.substring(0,6)}]</span>
                  <span className="text-slate-600 dark:text-slate-300">
                    {result.metadata && Object.values(result.metadata).join(' - ')}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2 sm:gap-4 flex-wrap">
          <button onClick={toggleDarkMode} className="p-2 rounded-md bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition">
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button onClick={resetSession} className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-900/30 text-slate-600 dark:text-slate-300 px-3 py-2 rounded-md text-sm font-medium transition" title="Effacer la mémoire">
            <Trash2 className="w-4 h-4" /> <span className="hidden sm:inline">Réinit</span>
          </button>
          <button onClick={() => setShowExportModal(true)} className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium transition shadow-sm">
            <Download className="w-4 h-4" /> Exporter
          </button>
        </div>
      </div>

      <div className="w-full max-w-6xl bg-white dark:bg-slate-800 rounded-full h-2 mb-6 border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="bg-red-600 h-full transition-all duration-300 shrink-0" style={{ width: `${progress}%` }}></div>
      </div>

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* PANNEAU GAUCHE */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="bg-slate-800 dark:bg-slate-900 p-4 flex justify-between items-center text-white">
              <h2 className="font-bold">Source ({currentIndex + 1}/{entreprises.length})</h2>
              <span className="text-xs font-mono bg-slate-700 px-2 py-1 rounded border border-slate-600">{currentCompany?.uuid}</span>
            </div>

            <div className="p-6">
              {/* Dynamic Metadata Context Panel */}
              {currentCompany?.metadata && Object.keys(currentCompany.metadata).length > 0 && (
                <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 border-b border-slate-100 dark:border-slate-700 pb-6">
                  {Object.entries(currentCompany.metadata).map(([key, value]) => (
                    <div key={key} className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 px-1">{key}</p>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 wrap-break-word px-1">
                        {value ? String(value) : <span className="italic text-slate-400">Non renseigné</span>}
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
                {currentCompany?.texts && currentCompany.texts.map((textBlock, idx) => (
                  <div key={idx} className="bg-[#fffae6] dark:bg-amber-900/10 p-5 rounded-lg border border-[#ffe066] dark:border-amber-700/50 relative">
                    <div className="absolute top-0 left-0 bg-[#ffe066] dark:bg-amber-700 text-amber-900 dark:text-amber-100 text-xs font-bold px-3 py-1 rounded-br-lg rounded-tl-lg shadow-sm">
                      {textBlock.title}
                    </div>
                    <div className="prose prose-slate dark:prose-invert prose-lg max-w-none leading-relaxed cursor-text selection:bg-yellow-300 selection:text-slate-900 dark:selection:bg-yellow-500/80 dark:selection:text-slate-900 mt-4">
                      {renderHighlightedText(textBlock.content)}
                    </div>
                  </div>
                ))}
                {(!currentCompany?.texts || currentCompany.texts.length === 0) && (
                  <div className="text-center text-slate-500 italic py-10">Aucun texte à analyser.</div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
            <button onClick={handlePrev} disabled={currentIndex === 0} className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 transition"><ChevronLeft className="w-5 h-5" /> Prev</button>
            <span className="text-sm font-semibold text-slate-400">{currentIndex + 1} / {entreprises.length}</span>
            <button onClick={handleNext} disabled={currentIndex === entreprises.length - 1} className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium bg-slate-800 dark:bg-slate-700 text-white hover:bg-slate-900 dark:hover:bg-slate-600 disabled:opacity-50 transition">Suiv <ChevronRight className="w-5 h-5" /></button>
          </div>
        </div>

        {/* PANNEAU DROIT */}
        <div className="lg:col-span-5 sticky top-[100px] flex flex-col max-h-[calc(100vh-120px)] bg-white dark:bg-slate-800 rounded-xl shadow-md border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="bg-red-600 p-4 border-b border-red-700">
            <h2 className="font-bold text-lg text-white flex items-center gap-2"><ShieldAlert className="w-5 h-5" /> Entités Ciblées</h2>
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
              <input 
                type="text" 
                value={currentEntityNote}
                onChange={e => setCurrentEntityNote(e.target.value)}
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
                    <option key={cat.id} value={cat.id} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                      {cat.name} [{index + 1}]
                    </option>
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
                  <li key={idx} className="flex flex-col p-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg shadow-sm group">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex flex-col">
                        <p className="font-bold text-slate-800 dark:text-slate-100 text-lg leading-tight">{entity.name}</p>
                        {entity.note && <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">{entity.note}</span>}
                      </div>
                      <button onClick={() => handleRemoveEntity(idx)} className="text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 p-1.5 rounded transition opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>
                    </div>

                    {/* Component resolving for icon and color dynamically */}
                    {(() => {
                      const cat = categories.find(c => c.id === entity.type) || 
                        { name: entity.type, color: 'bg-slate-700', icon: 'Tag' }; // Fallback for old/deleted categories
                      
                      // Dynamically render the icon component using our imported dictionary
                      const IconComp = availableIcons[cat.icon] || availableIcons['Tag'];

                      return (
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded text-white shrink-0 ${cat.color}`}>
                            <IconComp className="w-3 h-3" />
                          </div>
                          <select value={entity.type} onChange={(e) => handleChangeEntityType(idx, e.target.value)} className="text-xs uppercase tracking-wider font-bold bg-transparent dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white cursor-pointer outline-none focus:ring-2 focus:ring-red-500 rounded p-1">
                            {categories.map(c => (
                              <option key={c.id} value={c.id} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">{c.name}</option>
                            ))}
                            {/* Keep the current type as an option even if it was deleted from configuration */}
                            {!categories.some(c => c.id === entity.type) && (
                              <option value={entity.type} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">{entity.type} (Supprimée)</option>
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

    {/* Export Modal */}
    <ExportModal
      isOpen={showExportModal}
      onClose={() => setShowExportModal(false)}
      entreprises={entreprises}
      extractedEntities={extractedEntities}
      categories={categories}
    />
    </>
  );
}
