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
    currentIndex: 0
  });

  const [columnMapping, setColumnMapping] = useState({ id: '', title: '', text: '' });
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
    if (!columnMapping.id || !columnMapping.title || !columnMapping.text) {
      alert("Veuillez sélectionner une colonne pour chaque champ.");
      return;
    }

    const formattedData = rawCsvData.map((row, idx) => ({
      uuid: row[columnMapping.id] || `row-${idx}`,
      name: row[columnMapping.title] || "Sans Nom",
      text: row[columnMapping.text] || "Aucun texte"
    })).filter(c => c.uuid);

    setSession({
      entreprises: formattedData,
      currentIndex: 0,
      extractedEntities: {}
    });

    setIsCsvLoaded(true);
    setConfigStep(false);
  };

  const handleExportCSV = () => {
    if (Object.keys(session.extractedEntities).length === 0) {
      return alert("Aucune entité. L'exportation est annulée.");
    }

    // Ajout de la colonne note_contexte dans l'export CSV
    let csvContent = "uuid_source,nom_source,cible_extraite,type_cible,note_contexte\n";

    Object.entries(session.extractedEntities).forEach(([uuid, entities]) => {
      const source = session.entreprises.find(c => c.uuid === uuid);
      const sName = source ? source.name.replace(/"/g, '""') : "Inconnu";
      const fName = sName.includes(',') ? `"${sName}"` : sName;

      entities.forEach(entity => {
        const eName = entity.name.replace(/"/g, '""');
        const feName = eName.includes(',') ? `"${eName}"` : eName;
        
        const eNote = entity.note ? entity.note.replace(/"/g, '""') : '';
        const fNote = eNote.includes(',') || eNote.includes('\n') ? `"${eNote}"` : eNote;

        csvContent += `"${uuid}",${fName},${feName},${entity.type},${fNote}\n`;
      });
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Ba7ath_Extraction_NER_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
      handleExportCSV={handleExportCSV}
      resetSession={resetSession}
    />
  );
}