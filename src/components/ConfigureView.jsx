import React, { useState, useRef, useEffect } from 'react';
import { Settings, Plus, Trash2, Tag, Building2, ShieldAlert, User, MapPin, Globe, CreditCard, Activity, Box, Database, Cloud, FileText, Download, Upload } from 'lucide-react';

export default function ConfigureView({ 
  csvHeaders = [], 
  columnMapping: initialMapping = { id: '', textColumns: [], metadata: [] }, 
  categories: initialCategories = [], 
  highlightRules: initialRules = { capitals: true, acronyms: false, legal: false }, 
  onCancel, 
  onConfirm, 
  isEditing 
}) {
  // Local States for snappier UI (fixes the "frozen" issue)
  const [localMapping, setLocalMapping] = useState(initialMapping);
  const [localCategories, setLocalCategories] = useState(initialCategories);
  const [localRules, setLocalRules] = useState(initialRules);

  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('bg-slate-700');
  const [newCatIcon, setNewCatIcon] = useState('Tag');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [templateStatus, setTemplateStatus] = useState(null); // { type: 'success'|'error', msg }
  const fileInputRef = useRef(null);

  // Synchronisation avec les props (important pour le flux d'upload)
  useEffect(() => {
    setLocalMapping(initialMapping);
  }, [initialMapping]);

  useEffect(() => {
    setLocalCategories(initialCategories);
  }, [initialCategories]);

  useEffect(() => {
    setLocalRules(initialRules);
  }, [initialRules]);

  const availableIcons = {
    Tag, Building2, ShieldAlert, User, MapPin, Globe, CreditCard, Activity, Box, Database, Cloud, FileText
  };

  const IconComponent = availableIcons[newCatIcon] || Tag;

  // Handlers for local state
  const handleToggleMetadata = (header) => {
    setLocalMapping(prev => {
      const metadata = prev.metadata || [];
      if (metadata.includes(header)) {
        return { ...prev, metadata: metadata.filter(h => h !== header) };
      } else {
        return { ...prev, metadata: [...metadata, header] };
      }
    });
  };

  const handleToggleTextColumn = (header) => {
    setLocalMapping(prev => {
      const textColumns = prev.textColumns || [];
      if (textColumns.includes(header)) {
        return { ...prev, textColumns: textColumns.filter(h => h !== header) };
      } else {
        return { ...prev, textColumns: [...textColumns, header] };
      }
    });
  };

  const handleToggleRule = (key) => {
    setLocalRules(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleAddCategory = () => {
    if (!newCatName.trim()) return;
    const id = newCatName.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '_').toLowerCase();
    
    if (localCategories.some(c => c.id === id || c.name.toLowerCase() === newCatName.trim().toLowerCase())) {
      alert("Une catégorie avec ce nom existe déjà.");
      return;
    }

    setLocalCategories([
      ...localCategories,
      { id, name: newCatName.trim(), color: newCatColor, icon: newCatIcon }
    ]);
    setNewCatName('');
  };

  const handleRemoveCategory = (idToRemove) => {
    if (localCategories.length <= 1) {
      alert("Vous devez avoir au moins une catégorie.");
      return;
    }
    setLocalCategories(localCategories.filter(c => c.id !== idToRemove));
  };

  // === TEMPLATE SAVE ===
  const handleSaveTemplate = () => {
    const template = {
      _type: 'ba7ath-template',
      _version: 1,
      columnMapping: localMapping,
      categories: localCategories,
      highlightRules: localRules
    };
    const json = JSON.stringify(template, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Ba7ath_Template_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTemplateStatus({ type: 'success', msg: 'Modèle sauvegardé !' });
    setTimeout(() => setTemplateStatus(null), 3000);
  };

  // === TEMPLATE LOAD ===
  const handleLoadTemplate = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (data._type !== 'ba7ath-template') {
          setTemplateStatus({ type: 'error', msg: 'Fichier invalide : ce n\'est pas un modèle Ba7ath.' });
          setTimeout(() => setTemplateStatus(null), 4000);
          return;
        }
        if (data.columnMapping) setLocalMapping(data.columnMapping);
        if (data.categories && Array.isArray(data.categories)) setLocalCategories(data.categories);
        if (data.highlightRules) setLocalRules(data.highlightRules);
        setTemplateStatus({ type: 'success', msg: 'Modèle chargé avec succès !' });
        setTimeout(() => setTemplateStatus(null), 3000);
      } catch {
        setTemplateStatus({ type: 'error', msg: 'Erreur de lecture du fichier JSON.' });
        setTimeout(() => setTemplateStatus(null), 4000);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const colorOptions = [
    { label: 'Gris', class: 'bg-slate-700' },
    { label: 'Rouge', class: 'bg-red-600' },
    { label: 'Bleu', class: 'bg-blue-600' },
    { label: 'Vert', class: 'bg-green-600' },
    { label: 'Jaune', class: 'bg-yellow-600' },
    { label: 'Violet', class: 'bg-purple-600' },
    { label: 'Rose', class: 'bg-pink-600' },
    { label: 'Orange', class: 'bg-orange-600' }
  ];

  return (
    <div className="min-h-screen bg-animated-gradient flex flex-col items-center justify-center font-sans text-slate-900 dark:text-slate-100 p-6 pt-10 pb-20 transition-colors duration-300">
      <div className="glass-card p-8 rounded-2xl max-w-2xl w-full animate-scale-in">
        <div className="flex items-center gap-3 mb-6 border-b border-slate-200/50 dark:border-slate-700 pb-4">
          <div className="w-10 h-10 rounded-xl bg-red-600/10 dark:bg-red-500/15 flex items-center justify-center">
            <Settings className="text-red-600 dark:text-red-500 w-5 h-5" />
          </div>
          <h2 className="text-2xl font-black dark:text-white tracking-tight">Configuration du Projet</h2>
        </div>

        {/* Section 1: CSV Mapping */}
        <div className="mb-10">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800 dark:text-slate-200">
            <Database className="w-5 h-5 text-slate-500" />
            Mapping des données ({(csvHeaders || []).length} colonnes trouvées)
          </h3>
          <div className="space-y-4 bg-slate-50 dark:bg-slate-900/50 p-5 rounded-lg border border-slate-200 dark:border-slate-700">
            {/* 1. Identifiant Unique */}
            <div>
              <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
                1. Identifiant Unique (Optionnel - Auto-généré si vide)
              </label>
              <select
                value={localMapping.id || ""}
                onChange={(e) => setLocalMapping({ ...localMapping, id: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-md p-2.5 bg-white dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-red-500 outline-none transition shadow-sm"
              >
                <option value="" className="text-slate-400">-- Laisser vide pour auto-générer --</option>
                {csvHeaders.map(h => <option key={`id-${h}`} value={h} className="bg-white dark:bg-slate-700 text-slate-900 dark:text-white">{h}</option>)}
              </select>
            </div>

            {/* 2. Colonnes de texte à analyser */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
              <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">
                2. Textes à analyser (Corpus principal - Au moins 1 requis)
                <span className="block text-xs text-slate-500 dark:text-slate-400 font-normal mt-1">Cochez les colonnes contenant le texte sur lequel vous souhaitez travailler.</span>
              </label>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {csvHeaders
                  .filter(h => h !== localMapping.id)
                  .map(header => {
                    const isChecked = (localMapping.textColumns || []).includes(header);
                    return (
                      <label 
                        key={`text-${header}`} 
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${isChecked ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750'}`}
                      >
                        <div className="flex h-5 items-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleTextColumn(header)}
                            className="w-4 h-4 text-red-600 bg-slate-100 border-slate-300 rounded focus:ring-red-500 dark:focus:ring-red-600 dark:ring-offset-slate-800 focus:ring-2 dark:bg-slate-700 dark:border-slate-600 cursor-pointer"
                          />
                        </div>
                        <span className={`text-sm font-medium break-all ${isChecked ? 'text-red-900 dark:text-red-200' : 'text-slate-700 dark:text-slate-300'}`}>
                          {header}
                        </span>
                      </label>
                    );
                })}
              </div>
            </div>

            {/* Dynamic Metadata Checkboxes */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
              <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">
                3. Métadonnées de Contexte (Optionnelles)
                <span className="block text-xs text-slate-500 dark:text-slate-400 font-normal mt-1">Cochez les colonnes à afficher pendant l'analyse pour vous aider à prendre des décisions (ex: Date, Auteur...).</span>
              </label>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {csvHeaders
                  .filter(h => h !== localMapping.id && !(localMapping.textColumns || []).includes(h))
                  .map(header => {
                    const isChecked = (localMapping.metadata || []).includes(header);
                    return (
                      <label 
                        key={`meta-${header}`} 
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${isChecked ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750'}`}
                      >
                        <div className="flex h-5 items-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleMetadata(header)}
                            className="w-4 h-4 text-slate-600 bg-slate-100 border-slate-300 rounded focus:ring-slate-500 dark:focus:ring-slate-600 dark:ring-offset-slate-800 focus:ring-2 dark:bg-slate-700 dark:border-slate-600 cursor-pointer"
                          />
                        </div>
                        <span className={`text-sm font-medium break-all ${isChecked ? 'text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'}`}>
                          {header}
                        </span>
                      </label>
                    );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Highlighting Rules */}
        <div className="mb-10">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800 dark:text-slate-200">
            <Settings className="w-5 h-5 text-slate-500" />
            Règles de Détection Visuelle
          </h3>
          <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {['capitals', 'acronyms', 'legal'].map(ruleKey => {
                const labels = {
                  capitals: { title: 'Majuscules Initiales', desc: 'Surligne les mots comme "France".' },
                  acronyms: { title: 'Acronymes', desc: 'Surligne les mots courts en majuscules (ONU).' },
                  legal: { title: 'Structures Légales', desc: 'Identifie LLC, SA, Ltd, Inc, etc.' }
                };
                const isChecked = localRules[ruleKey];
                return (
                  <label key={ruleKey} className={`flex flex-col p-4 rounded-lg border cursor-pointer transition-colors ${isChecked ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700/50' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleRule(ruleKey)}
                        className="w-4 h-4 text-amber-500 rounded focus:ring-amber-500"
                      />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{labels[ruleKey].title}</span>
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 pl-6">{labels[ruleKey].desc}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Categories */}
        <div>
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800 dark:text-slate-200">
            <Tag className="w-5 h-5 text-slate-500" />
            Catégories d'Extraction (Tags)
          </h3>
          <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="flex flex-col gap-2 mb-6">
              {localCategories.map((cat, index) => {
                const CatIcon = availableIcons[cat.icon] || Tag;
                return (
                  <div key={cat.id} className="flex items-center justify-between bg-white dark:bg-slate-800 p-3 rounded-md border border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-slate-400 w-4 text-center">{index + 1}</span>
                      <div className={`p-1.5 rounded-md text-white ${cat.color}`}>
                        <CatIcon className="w-4 h-4" />
                      </div>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{cat.name}</span>
                    </div>
                    <button onClick={() => handleRemoveCategory(cat.id)} className="text-slate-400 hover:text-red-500 p-1.5 rounded transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="bg-white dark:bg-slate-800 p-4 rounded-md border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1 w-full">
                <label className="block text-xs text-slate-500 mb-1">Nom</label>
                <input 
                  type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="ex: Produit..." className="w-full border rounded-md p-2 bg-transparent dark:text-white"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Couleur</label>
                <select value={newCatColor} onChange={(e) => setNewCatColor(e.target.value)} className="border rounded-md p-2 bg-transparent dark:text-white h-10">
                  {colorOptions.map(c => <option key={c.class} value={c.class}>{c.label}</option>)}
                </select>
              </div>
              <button onClick={handleAddCategory} className="bg-slate-800 text-white h-10 px-4 rounded-md"><Plus className="w-5 h-5" /></button>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="mt-10 pt-6 border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3 mb-5">
            <button onClick={handleSaveTemplate} className="text-sm px-4 py-2 rounded-md bg-slate-100 dark:bg-slate-700 border flex items-center gap-2"><Download className="w-4 h-4"/> Sauvegarder</button>
            <button onClick={() => fileInputRef.current?.click()} className="text-sm px-4 py-2 rounded-md bg-slate-100 dark:bg-slate-700 border flex items-center gap-2"><Upload className="w-4 h-4"/> Charger</button>
            <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleLoadTemplate} />
            {templateStatus && <span className="text-sm font-medium text-green-600">{templateStatus.msg}</span>}
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={onCancel} className="px-5 py-2.5 text-slate-600 dark:text-slate-300">Annuler</button>
            <button
              onClick={() => {
                const config = { columnMapping: localMapping, categories: localCategories, highlightRules: localRules };
                if (isEditing) {
                  if (window.confirm("Voulez-vous sauvegarder ces changements dans un fichier modèle ?")) {
                    handleSaveTemplate();
                  }
                }
                onConfirm(config);
              }}
              className="bg-red-600 text-white px-8 py-2.5 rounded-md font-bold"
              disabled={!localMapping.textColumns || localMapping.textColumns.length === 0}
            >
              {isEditing ? 'Mettre à jour' : "Démarrer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
