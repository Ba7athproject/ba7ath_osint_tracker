import React from 'react';
import { Settings } from 'lucide-react';

export default function ConfigureView({ csvHeaders, columnMapping, setColumnMapping, onCancel, onConfirm }) {
  const fields = [
    { key: 'id', label: '1. Identifiant Unique (ID/UUID)' },
    { key: 'title', label: "2. Nom / Titre de la source (ex: Nom de l'entreprise)" },
    { key: 'text', label: '3. Texte à analyser (Corpus principal)' }
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center font-sans text-slate-900 dark:text-slate-100 p-6 transition-colors duration-300">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-md border border-slate-200 dark:border-slate-700 max-w-xl w-full">
        <div className="flex items-center gap-3 mb-6 border-b border-slate-100 dark:border-slate-700 pb-4">
          <Settings className="text-red-600 dark:text-red-500 w-8 h-8" />
          <h2 className="text-2xl font-bold dark:text-white">Configuration du Dataset</h2>
        </div>

        <p className="text-slate-600 dark:text-slate-400 mb-6 text-sm">
          Faites correspondre les colonnes de votre fichier ({csvHeaders.length} détectées) avec les champs requis par l'outil d'investigation.
        </p>

        <div className="space-y-5">
          {fields.map(field => (
            <div key={field.key}>
              <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">{field.label}</label>
              <select
                value={columnMapping[field.key]}
                onChange={(e) => setColumnMapping({ ...columnMapping, [field.key]: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-md p-2 bg-slate-50 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-red-500 outline-none transition"
              >
                {csvHeaders.map(h => <option key={`${field.key}-${h}`} value={h}>{h}</option>)}
              </select>
            </div>
          ))}
        </div>

        <div className="mt-8 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md font-medium transition"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-md font-semibold transition shadow-sm"
          >
            Démarrer l'extraction
          </button>
        </div>
      </div>
    </div>
  );
}
