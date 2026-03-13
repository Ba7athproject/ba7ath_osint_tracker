import React, { useState, useEffect } from 'react';
import { usePersistentStorage } from './hooks/usePersistentStorage';
import UploadView from './components/UploadView';
import ConfigureView from './components/ConfigureView';
import WorkspaceView from './components/WorkspaceView';
import { Loader2 } from 'lucide-react';

const LOCAL_STORAGE_KEY = 'ba7ath_osint_session_v2';

export default function ManualTagger() {
  const [configStep, setConfigStep] = useState(false);
  const [isCsvLoaded, setIsCsvLoaded] = useState(false);

  // States persistant via IndexedDB (Phase 12)
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

  const [papaLoaded, setPapaLoaded] = useState(false);

  // Charger PapaParse globalement
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js';
    script.async = true;
    script.onload = () => setPapaLoaded(true);
    document.body.appendChild(script);
    return () => document.body.removeChild(script);
  }, []);

  // Migration localStorage -> IndexedDB & Restauration
  useEffect(() => {
    if (!isSessionLoaded) return;

    // Check migration if IndexedDB is empty
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
          <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.2em]">v1.3 — Initialisation...</p>
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
      highlightRules: finalRules
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

  // === SESSION IMPORT (Phase 8) ===
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
    return <UploadView onDataParsed={handleDataParsed} papaLoaded={papaLoaded} onSessionImport={handleSessionImport} />;
  }

  if (configStep) {
    return (
      <ConfigureView 
        csvHeaders={session.csvHeaders || []} 
        columnMapping={session.columnMapping} 
        categories={session.categories}
        highlightRules={session.highlightRules}
        onCancel={() => setConfigStep(false)}
        onConfirm={confirmConfiguration}
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