import React, { useState, useEffect } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import UploadView from './components/UploadView';
import ConfigureView from './components/ConfigureView';
import WorkspaceView from './components/WorkspaceView';

const LOCAL_STORAGE_KEY = 'ba7ath_osint_session_v2';

export default function ManualTagger() {
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [rawCsvData, setRawCsvData] = useState([]);
  const [configStep, setConfigStep] = useState(false);
  const [isCsvLoaded, setIsCsvLoaded] = useState(false);

  // States persistant via le localStorage
  const [session, setSession, removeSession] = useLocalStorage(LOCAL_STORAGE_KEY, {
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
    }
  });

  const [columnMapping, setColumnMapping] = useState({ id: '', textColumns: [], metadata: [] });
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

  // Restaurer depuis la session existante s'il y en a une (v2)
  useEffect(() => {
    if (!isCsvLoaded && session.entreprises && session.entreprises.length > 0) {
      if (window.confirm("Une session de travail précédente a été trouvée. Voulez-vous la restaurer ?")) {
        setIsCsvLoaded(true);
      } else {
        removeSession();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDataParsed = (headers, data, autoMap) => {
    setCsvHeaders(headers);
    setRawCsvData(data);
    setColumnMapping(autoMap);
    setConfigStep(true);
  };

  const confirmConfiguration = () => {
    if (!columnMapping.textColumns || columnMapping.textColumns.length === 0) {
      alert("Vous devez sélectionner au moins une colonne de texte à analyser.");
      return;
    }

    const formattedData = rawCsvData.map((row, idx) => {
      // Build dynamic metadata object
      const meta = {};
      if (columnMapping.metadata && columnMapping.metadata.length > 0) {
        columnMapping.metadata.forEach(key => {
          meta[key] = row[key] || "";
        });
      }

      // Build text blocks array
      const textBlocks = columnMapping.textColumns.map(col => ({
        title: col,
        content: row[col] || ""
      })).filter(block => block.content.trim() !== "");

      return {
        uuid: columnMapping.id && row[columnMapping.id] ? row[columnMapping.id] : `row-${idx}`,
        texts: textBlocks,
        metadata: meta
      };
    }).filter(c => c.texts.length > 0);

    setSession({
      entreprises: formattedData,
      currentIndex: 0,
      extractedEntities: {},
      categories: session.categories || [
        { id: 'Entreprise', name: 'Entreprise', color: 'bg-slate-700', icon: 'Building2' },
        { id: 'Autorite', name: 'Autorité', color: 'bg-red-600', icon: 'ShieldAlert' },
        { id: 'Personne', name: 'Personne', color: 'bg-blue-600', icon: 'User' }
      ],
      highlightRules: session.highlightRules || { capitals: true, acronyms: false, legal: false }
    });

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

  // Vues conditionnelles (Router simple)
  if (!isCsvLoaded && !configStep) {
    return <UploadView onDataParsed={handleDataParsed} papaLoaded={papaLoaded} />;
  }

  if (configStep) {
    return (
      <ConfigureView 
        csvHeaders={csvHeaders} 
        columnMapping={columnMapping} 
        setColumnMapping={setColumnMapping}
        categories={session.categories}
        setCategories={(newCategories) => setSession(prev => ({ ...prev, categories: typeof newCategories === 'function' ? newCategories(prev.categories) : newCategories }))}
        highlightRules={session.highlightRules || { capitals: true, acronyms: false, legal: false }}
        setHighlightRules={(rules) => setSession(prev => ({ ...prev, highlightRules: typeof rules === 'function' ? rules(prev.highlightRules || { capitals: true, acronyms: false, legal: false }) : rules }))}
        onCancel={() => setConfigStep(false)}
        onConfirm={confirmConfiguration}
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
      categories={session.categories || [
        { id: 'Entreprise', name: 'Entreprise', color: 'bg-slate-700', icon: 'Building2' },
        { id: 'Autorite', name: 'Autorité', color: 'bg-red-600', icon: 'ShieldAlert' },
        { id: 'Personne', name: 'Personne', color: 'bg-blue-600', icon: 'User' }
      ]}
      highlightRules={session.highlightRules || { capitals: true, acronyms: false, legal: false }}
      resetSession={resetSession}
    />
  );
}