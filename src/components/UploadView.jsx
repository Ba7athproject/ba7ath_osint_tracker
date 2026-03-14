import React, { useRef } from 'react';
import { ShieldAlert, Upload, FolderUp } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function UploadView({ onDataParsed, papaLoaded, onSessionImport }) {
  const fileInputRef = useRef(null);
  const sessionInputRef = useRef(null);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.name.endsWith('.csv')) {
      if (!papaLoaded) {
        alert("L'analyseur CSV est en cours de chargement, veuillez patienter.");
        return;
      }
      window.Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => processData(results.data)
      });
    } else if (file.name.endsWith('.xlsx')) {
      try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });
        processData(jsonData);
      } catch (error) {
        console.error("Erreur Excel: ", error);
        alert("Erreur lors de la lecture du fichier Excel.");
      }
    } else {
      alert("Format non supporté. Veuillez importer un fichier .csv ou .xlsx");
    }
  };

  const processData = (data) => {
    if (data && data.length > 0) {
      const headers = Object.keys(data[0]);
      const autoMap = {
        id: headers.find(h => h.toLowerCase().includes('uuid') || h.toLowerCase().includes('id')) || headers[0],
        textColumns: [headers.find(h => h.toLowerCase().includes('text') || h.toLowerCase().includes('desc') || h.toLowerCase().includes('detail')) || headers[1] || headers[0]].filter(Boolean),
        metadata: []
      };
      
      // Sécurité : s'assurer qu'au moins une colonne de texte est sélectionnée par défaut
      if (autoMap.textColumns.length === 0 && headers.length > 0) {
        autoMap.textColumns = [headers[0]];
      }

      onDataParsed(headers, data, autoMap);
    } else {
      alert("Le fichier semble vide ou mal formaté.");
    }
  };

  // === IMPORT DE SESSION (Phase 8) ===
  const handleSessionImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data._type !== 'ba7ath-session' || !data.entreprises || !data.extractedEntities) {
          alert("Ce fichier n'est pas une session Ba7ath valide.");
          return;
        }
        onSessionImport(data);
      } catch (err) {
        alert("Erreur lors de la lecture du fichier de session.");
        console.error(err);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  return (
    <div className="min-h-screen bg-animated-gradient flex flex-col items-center justify-center font-sans text-slate-900 dark:text-slate-100 p-6 transition-colors duration-300">
      <div className="glass-card p-10 sm:p-14 rounded-2xl max-w-lg w-full text-center animate-scale-in">
        
        {/* Bouclier Animé */}
        <div className="animate-float mb-8">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-red-600/10 dark:bg-red-500/15 flex items-center justify-center animate-pulse-glow">
            <ShieldAlert className="text-red-600 dark:text-red-500 w-10 h-10" />
          </div>
        </div>

        {/* Titre et Sous-titre */}
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white mb-3 tracking-tight animate-fade-in-up">
          Ba7ath <span className="text-red-600">OSINT</span> Tracker
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed text-sm sm:text-base animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          Outil universel d'extraction manuelle d'entités nommées (NER).
          <br />
          <span className="text-xs text-slate-400 dark:text-slate-500">Vos données restent privées et ne quittent jamais ce navigateur.</span>
        </p>

        {/* Badges des fonctionnalités */}
        <div className="flex flex-wrap justify-center gap-2 mb-8 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          {['Multi-colonnes', 'Export Réseau', 'Templates', 'Stats Live'].map(tag => (
            <span key={tag} className="px-3 py-1 text-xs font-medium rounded-full bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
              {tag}
            </span>
          ))}
        </div>

        {/* Boutons d'importation */}
        <input type="file" accept=".csv,.xlsx" onChange={handleFileUpload} ref={fileInputRef} className="hidden" />
        <input type="file" accept=".json" onChange={handleSessionImport} ref={sessionInputRef} className="hidden" />

        <div className="flex flex-col gap-3 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
          <button
            onClick={() => fileInputRef.current.click()}
            className="btn-premium w-full flex items-center justify-center gap-2.5 bg-red-600 hover:bg-red-700 text-white py-3.5 px-6 rounded-xl font-bold text-base transition shadow-lg"
          >
            <Upload className="w-5 h-5" />
            Importer (CSV ou Excel)
          </button>

          <button
            onClick={() => sessionInputRef.current.click()}
            className="w-full flex items-center justify-center gap-2.5 bg-white/70 dark:bg-slate-700/50 hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 py-3 px-6 rounded-xl font-semibold text-sm transition border border-slate-200 dark:border-slate-600"
          >
            <FolderUp className="w-4 h-4" />
            Reprendre une session (.json)
          </button>
        </div>

        {/* Version */}
        <p className="mt-6 text-xs text-slate-400 dark:text-slate-500 animate-fade-in" style={{ animationDelay: '500ms' }}>
          v1.6.0 — Fait avec ❤️ pour l'OSINT
        </p>
      </div>
    </div>
  );
}

