import React, { useRef } from 'react';
import { ShieldAlert, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function UploadView({ onDataParsed, papaLoaded }) {
  const fileInputRef = useRef(null);

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
        title: headers.find(h => h.toLowerCase().includes('name') || h.toLowerCase().includes('titre') || h.toLowerCase().includes('entreprise')) || headers[1] || headers[0],
        text: headers.find(h => h.toLowerCase().includes('text') || h.toLowerCase().includes('desc') || h.toLowerCase().includes('detail')) || headers[2] || headers[0]
      };
      onDataParsed(headers, data, autoMap);
    } else {
      alert("Le fichier semble vide ou mal formaté.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center font-sans text-slate-900 dark:text-slate-100 p-6 transition-colors duration-300">
      <div className="bg-white dark:bg-slate-800 p-10 rounded-xl shadow-md border border-slate-200 dark:border-slate-700 max-w-lg w-full text-center">
        <ShieldAlert className="text-red-600 dark:text-red-500 w-16 h-16 mx-auto mb-6" />
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">Ba7ath OSINT Tracker</h1>
        <p className="text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
          Outil universel d'extraction manuelle (NER).
          Vos données restent privées et ne quittent jamais ce navigateur.
        </p>

        <input
          type="file"
          accept=".csv,.xlsx"
          onChange={handleFileUpload}
          ref={fileInputRef}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current.click()}
          className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white py-3 px-6 rounded-lg font-semibold transition shadow-sm"
        >
          <Upload className="w-5 h-5" />
          Importer (CSV ou Excel)
        </button>
      </div>
    </div>
  );
}
