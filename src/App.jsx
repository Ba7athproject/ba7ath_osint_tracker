import React, { useState, useEffect } from 'react';
import { usePersistentStorage } from './hooks/usePersistentStorage';
import UploadView from './components/UploadView';
import ConfigureView from './components/ConfigureView';
import WorkspaceView from './components/WorkspaceView';
import { Loader2 } from 'lucide-react';
import Papa from 'papaparse'; // 🔒 AJOUT : Import local pour souveraineté totale

// Rendre Papa disponible globalement pour UploadView sans le casser
window.Papa = Papa;

const LOCAL_STORAGE_KEY = 'ba7ath_osint_session_v2';

export default function ManualTagger() {
  const [configStep, setConfigStep] = useState(false);
  const [isCsvLoaded, setIsCsvLoaded] = useState(false);

  // États persistants via IndexedDB (Phase 12)
  const [session, setSession, isSessionLoaded, removeSession] = usePersistentStorage(LOCAL_STORAGE_KEY, {
    entreprises: [],
    extractedEntities: {},
    currentIndex: 0,
    categories: [
      { id: 'Entreprise', name: 'Entreprise', color: 'bg-slate-700', icon: 'Building2' },
      { id: 'Autorite', name: 'Autorité', color: 'bg-red-600', icon: 'ShieldAlert' },
      { id: 'Personne', name: 'Personne', color: 'bg-blue-600', icon: 'User' }
    ],
    highlightRules: {
      capitals: true,
      acronyms: false,
      legal: false
    },
    columnMapping: { id: '', textColumns: [], metadata: [] },
    rawCsvData: [],
    csvHeaders: []
  });

  // Migration du format de mapping (Point M - v1.6.0)
  useEffect(() => {
    if (!isSessionLoaded || !session.columnMapping) return;
    
    const mapping = session.columnMapping;
    // Condition de migration : présence de 'text' (ancien) et absence de 'textColumns' valide (nouveau)
    if (mapping.text && (!mapping.textColumns || mapping.textColumns.length === 0)) {
      console.log("Migration du format de mapping (v1.3 -> v1.7.0) en cours...");
      setSession(prev => {
        const newMapping = {
          id: prev.columnMapping.id || '',
          textColumns: [prev.columnMapping.text],
          metadata: Array.isArray(prev.columnMapping.metadata) ? prev.columnMapping.metadata : []
        };
        // Nettoyage des anciennes clés
        const { text, title, ...rest } = prev.columnMapping;
        return {
          ...prev,
          columnMapping: { ...newMapping }
        };
      });
    }
  }, [isSessionLoaded, session.columnMapping, setSession]);

  // Récupération automatique des headers si manquants (v1.6.6)
  // On priorise rawCsvData puis la reconstruction sémantique
  useEffect(() => {
    if (isSessionLoaded && session.entreprises.length > 0 && (!session.csvHeaders || session.csvHeaders.length === 0)) {
      if (session.rawCsvData && session.rawCsvData.length > 0) {
        console.log("Restauration des en-têtes depuis les données brutes...");
        setSession(prev => ({ ...prev, csvHeaders: Object.keys(prev.rawCsvData[0]) }));
      } else {
        console.log("Reconstruction sémantique des en-têtes (Schéma limité)...");
        const first = session.entreprises[0];
        const recoveredHeaders = new Set();
        if (session.columnMapping.id) recoveredHeaders.add(session.columnMapping.id);
        if (first.texts) first.texts.forEach(t => { if (t.title) recoveredHeaders.add(t.title); });
        if (first.metadata) Object.keys(first.metadata).forEach(k => recoveredHeaders.add(k));
        
        if (recoveredHeaders.size > 0) {
          setSession(prev => ({ ...prev, csvHeaders: Array.from(recoveredHeaders) }));
        }
      }
    }
  }, [isSessionLoaded, session.entreprises, session.csvHeaders, session.rawCsvData, session.columnMapping.id, setSession]);

  // 🗑️ SUPPRESSION : Le useEffect qui chargeait le script externe depuis cdnjs a été retiré.

  // Migration localStorage -> IndexedDB & Restauration
  useEffect(() => {
    if (!isSessionLoaded) return;

    // Vérification de la migration si IndexedDB est vide
    if (session.entreprises.length === 0) {
      const oldStore = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (oldStore) {
        try {
          const parsed = JSON.parse(oldStore);
          if (parsed && parsed.entreprises && parsed.entreprises.length > 0) {
            console.log("Migration de localStorage vers IndexedDB détectée...");
            setSession(parsed);
            setIsCsvLoaded(true);
            return;
          }
        } catch(e) { console.error("Erreur migration:", e); }
      }
    }

    if (!isCsvLoaded && session.entreprises && session.entreprises.length > 0) {
      if (window.confirm("Une session de travail précédente a été trouvée. Voulez-vous la restaurer ?")) {
        setIsCsvLoaded(true);
      } else {
        removeSession();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSessionLoaded]);

  // Affichage du chargement pendant l'initialisation de la DB
  if (!isSessionLoaded) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-6">
        <div className="relative">
          <img src="/app-icon.png" alt="Ba7ath Logo" className="w-24 h-24 object-contain animate-pulse" />
          <div className="absolute inset-0 rounded-full border-4 border-red-500/20 border-t-red-500 animate-spin"></div>
        </div>
        <div className="text-center">
          <h1 className="text-white text-2xl font-black tracking-tighter mb-1">BA7ATH <span className="text-red-500">OSINT</span> TRACKER</h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.2em]">v1.7.0 — Initialisation...</p>
        </div>
      </div>
    );
  }

  const handleDataParsed = (headers, data, autoMap) => {
    setSession(prev => ({ 
      ...prev, 
      csvHeaders: headers, 
      rawCsvData: data, 
      columnMapping: autoMap 
    }));
    setConfigStep(true);
  };

  const confirmConfiguration = (newConfig) => {
    const finalMapping = newConfig.columnMapping;
    const finalCategories = newConfig.categories;
    const finalRules = newConfig.highlightRules;
    const rawCsvData = session.rawCsvData;

    const formattedData = rawCsvData.map((row, idx) => {
      const meta = {};
      if (finalMapping.metadata && finalMapping.metadata.length > 0) {
        finalMapping.metadata.forEach(key => {
          meta[key] = row[key] || "";
        });
      }

      const textBlocks = finalMapping.textColumns.map(col => ({
        title: col,
        content: row[col] || ""
      })).filter(block => block.content.trim() !== "");

      return {
        uuid: finalMapping.id && row[finalMapping.id] ? row[finalMapping.id] : `row-${idx}`,
        texts: textBlocks,
        metadata: meta
      };
    }).filter(c => c.texts.length > 0);

      setSession(prev => ({
        ...prev,
        entreprises: formattedData,
        columnMapping: finalMapping,
        categories: finalCategories,
        highlightRules: finalRules,
        // CRUCIAL : Ne pas perdre les données brutes !
        rawCsvData: prev.rawCsvData,
        csvHeaders: prev.csvHeaders
      }));

    setIsCsvLoaded(true);
    setConfigStep(false);
  };

  const resetSession = () => {
    if (window.confirm("Tout effacer de façon permanente ?")) {
      removeSession();
      setIsCsvLoaded(false);
      setConfigStep(false);
    }
  };

  // === IMPORT DE SESSION (Phase 8) ===
  const handleSessionImport = (data) => {
    setSession({
      ...session,
      entreprises: data.entreprises,
      extractedEntities: data.extractedEntities,
      currentIndex: data.currentIndex || 0,
      categories: data.categories || session.categories,
      highlightRules: data.highlightRules || session.highlightRules,
      rawCsvData: data.rawCsvData || session.rawCsvData,
      csvHeaders: data.csvHeaders || session.csvHeaders,
      columnMapping: data.columnMapping || session.columnMapping
    });
    setIsCsvLoaded(true);
    setConfigStep(false);
  };

  if (!isCsvLoaded && !configStep) {
    // L'analyseur est désormais natif, on passe true par défaut.
    return <UploadView onDataParsed={handleDataParsed} papaLoaded={true} onSessionImport={handleSessionImport} />;
  }

  const handleUpdateRawData = (headers, data) => {
    setSession(prev => ({
      ...prev,
      csvHeaders: headers,
      rawCsvData: data
    }));
  };

  if (configStep) {
    return (
      <ConfigureView 
        csvHeaders={session.csvHeaders || []} 
        columnMapping={session.columnMapping} 
        categories={session.categories}
        highlightRules={session.highlightRules}
        onCancel={() => setConfigStep(false)}
        onConfirm={confirmConfiguration}
        onUpdateRawData={handleUpdateRawData}
        isEditing={isCsvLoaded}
      />
    );
  }

  return (
    <WorkspaceView 
      entreprises={session.entreprises}
      currentIndex={session.currentIndex}
      setCurrentIndex={(idx) => setSession(prev => ({ ...prev, currentIndex: typeof idx === 'function' ? idx(prev.currentIndex) : idx }))}
      extractedEntities={session.extractedEntities}
      setExtractedEntities={(newEntities) => setSession(prev => ({ ...prev, extractedEntities: typeof newEntities === 'function' ? newEntities(prev.extractedEntities) : newEntities }))}
      categories={session.categories || []}
      highlightRules={session.highlightRules || { capitals: true, acronyms: false, legal: false }}
      resetSession={resetSession}
      onOpenConfig={() => setConfigStep(true)}
    />
  );
}