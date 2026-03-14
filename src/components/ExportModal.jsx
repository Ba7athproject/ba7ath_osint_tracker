import React, { useState } from 'react';
import { 
  X, FileSpreadsheet, Layers, FileJson, Share2, Download, 
  ChevronRight, Sparkles 
} from 'lucide-react';

/**
 * ExportModal — Modal d'exportation multi-format.
 * Supporte : CSV Plat, CSV Groupé, JSON NER, et Export Réseau.
 * v1.6.0 — Sécurité renforcée & Optimisation UI.
 */
export default function ExportModal({ 
  isOpen, 
  onClose, 
  entreprises = [], 
  extractedEntities = {}, 
  categories = [] 
}) {
  const [activeTab, setActiveTab] = useState(null);
  const [cleanExport, setCleanExport] = useState(true);

  // Sécurité pour les props pouvant être nulles
  const data = entreprises || [];
  const entitiesMap = extractedEntities || {};
  const cats = categories || [];

  if (!isOpen) return null;

  // === UTILITAIRES CSV ===
  const escapeCsv = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val).replace(/"/g, '""');
    return str.includes(',') || str.includes('\n') || str.includes('"') ? `"${str}"` : str;
  };

  const downloadFile = (content, filename, type) => {
    const blob = new Blob([content], { type });
    const link = document.body.appendChild(document.createElement('a'));
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    document.body.removeChild(link);
  };

  const dateTag = new Date().toISOString().split('T')[0];

  // Récupération dynamique des clés de métadonnées (Point F Audit)
  const metadataKeys = (data.length > 0 && data[0]?.metadata)
    ? Object.keys(data[0].metadata) : [];

  // === FORMAT 1 : CSV PLAT (1 ligne = 1 entité) ===
  const handleExportFlat = () => {
    if (Object.keys(entitiesMap).length === 0) {
      return alert("Aucune entité à extraire.");
    }

    let csv = 'uuid_source';
    metadataKeys.forEach(key => { csv += `,${escapeCsv(key)}`; });
    csv += ',cible_extraite,type_cible,note_contexte\n';

    Object.entries(entitiesMap).forEach(([uuid, entities]) => {
      const source = data.find(c => c.uuid === uuid);
      let prefix = escapeCsv(uuid);
      metadataKeys.forEach(key => {
        prefix += `,${escapeCsv(source?.metadata?.[key])}`;
      });

      if (Array.isArray(entities)) {
        entities.forEach(entity => {
          const isAiNote = entity.isAiSuggestion || (entity.note && entity.note.startsWith('[IA/'));
          const finalNote = cleanExport && isAiNote ? '' : (entity.note || '');
          csv += `${prefix},${escapeCsv(entity.name)},${escapeCsv(entity.type)},${escapeCsv(finalNote)}\n`;
        });
      }
    });

    downloadFile(csv, `Ba7ath_Flat_${dateTag}.csv`, 'text/csv;charset=utf-8;');
    onClose();
  };

  // === FORMAT 2 : CSV GROUPÉ (1 ligne = 1 source) ===
  const handleExportGrouped = () => {
    if (Object.keys(entitiesMap).length === 0) {
      return alert("Aucune entité à extraire.");
    }

    let csv = 'uuid_source';
    metadataKeys.forEach(key => { csv += `,${escapeCsv(key)}`; });
    cats.forEach(cat => { csv += `,${escapeCsv(cat.name)}`; });
    csv += '\n';

    Object.entries(entitiesMap).forEach(([uuid, entities]) => {
      const source = data.find(c => c.uuid === uuid);
      let row = escapeCsv(uuid);
      metadataKeys.forEach(key => {
        row += `,${escapeCsv(source?.metadata?.[key])}`;
      });

      cats.forEach(cat => {
        if (Array.isArray(entities)) {
          const matching = entities.filter(e => e.type === cat.id).map(e => e.name);
          row += `,${escapeCsv(matching.join(' ; '))}`;
        } else {
          row += ',';
        }
      });

      csv += row + '\n';
    });

    downloadFile(csv, `Ba7ath_Grouped_${dateTag}.csv`, 'text/csv;charset=utf-8;');
    onClose();
  };

  // === FORMAT 3 : JSON NER (Fine-Tuning) ===
  const handleExportJSON = () => {
    if (Object.keys(entitiesMap).length === 0) {
      return alert("Aucune entité à extraire.");
    }

    const output = Object.entries(entitiesMap).map(([uuid, entities]) => {
      const source = data.find(c => c.uuid === uuid);
      return {
        uuid,
        texts: cleanExport ? undefined : (source?.texts || []),
        metadata: source?.metadata || {},
        entities: Array.isArray(entities) ? entities.map(e => {
          const isAiNote = e.isAiSuggestion || (e.note && e.note.startsWith('[IA/'));
          return {
            name: e.name,
            type: e.type,
            note: (cleanExport && isAiNote) ? '' : (e.note || '')
          };
        }) : []
      };
    });

    downloadFile(JSON.stringify(output, null, 2), `Ba7ath_NER_${dateTag}.json`, 'application/json;charset=utf-8;');
    onClose();
  };

  // === FORMAT 4 : EXPORT RÉSEAU ===
  const handleExportNetwork = (mode) => {
    if (Object.keys(entitiesMap).length === 0) {
      return alert("Aucune entité à extraire.");
    }

    const nodesMap = new Map();
    let edgesCsv = 'Source,Target,Type,Label\n';

    Object.entries(entitiesMap).forEach(([uuid, entities]) => {
      const source = data.find(c => c.uuid === uuid);
      const sourceLabel = source?.metadata
        ? Object.values(source.metadata).filter(v => v).join(' - ') || uuid
        : uuid;
      nodesMap.set(uuid, { label: sourceLabel, type: 'Source' });

      if (Array.isArray(entities)) {
        entities.forEach(entity => {
          const entityId = `${entity.type}::${entity.name}`;
          if (!nodesMap.has(entityId)) {
            const catName = cats.find(c => c.id === entity.type)?.name || entity.type;
            nodesMap.set(entityId, { label: entity.name, type: catName });
          }
          edgesCsv += `${escapeCsv(uuid)},${escapeCsv(entityId)},${escapeCsv(entity.type)},${escapeCsv(entity.name)}\n`;
        });
      }
    });

    let nodesCsv = 'Id,Label,Type\n';
    nodesMap.forEach((val, key) => {
      nodesCsv += `${escapeCsv(key)},${escapeCsv(val.label)},${escapeCsv(val.type)}\n`;
    });

    if (mode === 'both' || mode === 'edges') {
      downloadFile(edgesCsv, `Ba7ath_Edges_${dateTag}.csv`, 'text/csv;charset=utf-8;');
    }
    if (mode === 'both' || mode === 'nodes') {
      setTimeout(() => {
        downloadFile(nodesCsv, `Ba7ath_Nodes_${dateTag}.csv`, 'text/csv;charset=utf-8;');
      }, 300);
    }
    onClose();
  };

  const formats = [
    { id: 'flat', icon: FileSpreadsheet, title: 'CSV Plat', desc: '1 ligne = 1 entité.', color: 'text-green-600', bgColor: 'bg-green-50', action: handleExportFlat },
    { id: 'grouped', icon: Layers, title: 'CSV Groupé', desc: '1 ligne = 1 source.', color: 'text-blue-600', bgColor: 'bg-blue-50', action: handleExportGrouped },
    { id: 'json', icon: FileJson, title: 'JSON (NER)', desc: 'Format Fine-Tuning.', color: 'text-amber-600', bgColor: 'bg-amber-50', action: handleExportJSON },
    { id: 'network', icon: Share2, title: 'Export Réseau', desc: 'Gephi / Neo4J / Kumu.', color: 'text-purple-600', bgColor: 'bg-purple-50', action: null }
  ];

  const entityCount = Object.values(entitiesMap).reduce((acc, arr) => acc + (arr?.length || 0), 0);
  const sourceCount = Object.keys(entitiesMap).length;

  return (
    <div className="fixed inset-0 z-99999 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative glass-card rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-scale-in">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Download className="w-5 h-5 text-red-600" /> Exporter les données
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {entityCount} entités de {sourceCount} sources
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Bascule du nettoyage IA */}
        <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4">
          <div className="flex items-center justify-between cursor-pointer" onClick={() => setCleanExport(!cleanExport)}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${cleanExport ? 'bg-purple-100 dark:bg-purple-900/40' : 'bg-slate-200 dark:bg-slate-800'}`}>
                <Sparkles className={`w-4 h-4 ${cleanExport ? 'text-purple-600 dark:text-purple-400' : 'text-slate-500'}`} />
              </div>
              <div>
                <span className="text-sm font-bold text-slate-900 dark:text-white block">Nettoyage IA Actif</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">Payload uniquement (ignore bruits IA et textes sources)</span>
              </div>
            </div>
            <div className={`w-11 h-6 rounded-full relative transition-colors ${cleanExport ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
              <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${cleanExport ? 'translate-x-5' : ''}`}></div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {formats.map(fmt => {
            const Icon = fmt.icon;
            const isNetwork = fmt.id === 'network';
            return (
              <div key={fmt.id}>
                <button
                  onClick={() => isNetwork ? setActiveTab(activeTab === 'network' ? null : 'network') : fmt.action()}
                  className={`w-full text-left p-5 rounded-xl border-2 transition-all hover:shadow-md ${activeTab === fmt.id ? fmt.bgColor : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-2.5 rounded-lg ${fmt.bgColor}`}>
                      <Icon className={`w-6 h-6 ${fmt.color}`} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-900 dark:text-white text-lg flex items-center gap-2">
                        {fmt.title}
                        {!isNetwork && <ChevronRight className="w-4 h-4 text-slate-400" />}
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{fmt.desc}</p>
                    </div>
                  </div>
                </button>
                {activeTab === 'network' && isNetwork && (
                  <div className="mt-3 ml-14 flex flex-col gap-2">
                    <button onClick={() => handleExportNetwork('both')} className="p-3 text-sm font-bold rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 hover:bg-purple-100 transition border border-purple-200">Edges + Nodes (Gephi)</button>
                    <button onClick={() => handleExportNetwork('edges')} className="p-3 text-sm font-bold rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition border border-slate-200">Edges uniquement (Kumu)</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
