import React, { useRef } from 'react';
import { 
  X, EyeOff, Trash2, Download, Upload, AlertCircle, Search, Info
} from 'lucide-react';

/**
 * IgnoreListModal — Interface de gestion de la "Liste Rouge".
 * Permet de voir, retirer, exporter et importer les entités bannies.
 */
export default function IgnoreListModal({ 
  isOpen, 
  onClose, 
  ignoreList = new Set(),
  onUnban,
  onUnbanAll,
  onImport
}) {
  const fileInputRef = useRef(null);
  const [searchTerm, setSearchTerm] = React.useState('');

  if (!isOpen) return null;

  const bannedArray = Array.from(ignoreList).sort();
  const filteredBanned = bannedArray.filter(name => 
    name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExport = () => {
    const data = JSON.stringify(bannedArray, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Ba7ath_IgnoreList_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result);
        if (Array.isArray(json)) {
          if (window.confirm(`Importer ${json.length} entités ? Cela remplacera votre liste actuelle.`)) {
            onImport(json);
          }
        } else {
          alert("Format invalide. Le fichier doit être un tableau JSON de chaînes de caractères.");
        }
      } catch (err) {
        alert("Erreur lors de la lecture du fichier JSON.");
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative glass-card rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col animate-scale-in border border-slate-200 dark:border-slate-700">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <EyeOff className="w-5 h-5 text-red-500" /> Gestion de la Liste Rouge
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {ignoreList.size} entités bannies de la détection
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tools bar */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-800 flex flex-wrap gap-3 items-center justify-between">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Rechercher une entité..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition"
            />
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleExport}
              disabled={ignoreList.size === 0}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 transition disabled:opacity-50"
            >
              <Download className="w-4 h-4" /> Exporter
            </button>
            <button 
              onClick={handleImportClick}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 transition"
            >
              <Upload className="w-4 h-4" /> Importer
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept=".json"
              />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
          {filteredBanned.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400">
              <Info className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm italic">
                {searchTerm ? "Aucun résultat pour cette recherche." : "La liste rouge est vide."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2">
              {filteredBanned.map((entity) => (
                <div 
                  key={entity} 
                  className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-750 hover:border-slate-200 dark:hover:border-slate-700 transition group"
                >
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate pr-2">
                    {entity}
                  </span>
                  <button 
                    onClick={() => onUnban(entity)}
                    className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition"
                    title="Retirer de la liste rouge"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/30">
          <button 
            onClick={() => {
              if (window.confirm("Voulez-vous vraiment vider TOUTE la liste rouge ?")) {
                onUnbanAll();
              }
            }}
            disabled={ignoreList.size === 0}
            className="text-sm text-red-500 hover:text-red-600 font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition disabled:opacity-50"
          >
            Tout vider
          </button>
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-sm hover:scale-105 active:scale-95 transition"
          >
            Fermer
          </button>
        </div>

        {/* Warning Banner */}
        {ignoreList.size > 0 && (
          <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 flex gap-2 items-center text-[11px] text-amber-700 dark:text-amber-400 rounded-b-2xl">
            <AlertCircle className="w-3 h-3 shrink-0" />
            <span>Les entités de cette liste sont ignorées par le Regex et l'IA NER. Elles ne seront plus jamais suggérées ni surlignées.</span>
          </div>
        )}
      </div>
    </div>
  );
}
