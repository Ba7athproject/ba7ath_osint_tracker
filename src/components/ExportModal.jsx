import React, { useState } from 'react';
import { X, FileSpreadsheet, Layers, FileJson, Share2, Download, ChevronRight } from 'lucide-react';

/**
 * ExportModal — Modal d'exportation multi-format.
 * Supporte : CSV Plat, CSV Groupé, JSON NER, et Export Réseau (Gephi/Neo4J/Kumu).
 */
export default function ExportModal({ isOpen, onClose, entreprises, extractedEntities, categories }) {
  const [activeTab, setActiveTab] = useState(null);

  if (!isOpen) return null;

  // === UTILITAIRES CSV ===
  const escapeCsv = (val) => {
    if (!val) return '';
    const str = String(val).replace(/"/g, '""');
    return str.includes(',') || str.includes('\n') || str.includes('"') ? `"${str}"` : str;
  };

  const downloadFile = (content, filename, type) => {
    const blob = new Blob([content], { type });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const dateTag = new Date().toISOString().split('T')[0];

  // Récupérer les clés de métadonnées dynamiquement
  const metadataKeys = entreprises.length > 0 && entreprises[0].metadata
    ? Object.keys(entreprises[0].metadata) : [];

  // === FORMAT 1 : CSV PLAT (1 ligne = 1 entité) ===
  const handleExportFlat = () => {
    if (Object.keys(extractedEntities).length === 0) {
      return alert("Aucune entité à exporter.");
    }

    let csv = 'uuid_source';
    metadataKeys.forEach(key => { csv += `,${escapeCsv(key)}`; });
    csv += ',cible_extraite,type_cible,note_contexte\n';

    Object.entries(extractedEntities).forEach(([uuid, entities]) => {
      const source = entreprises.find(c => c.uuid === uuid);
      let prefix = escapeCsv(uuid);
      metadataKeys.forEach(key => {
        prefix += `,${escapeCsv(source?.metadata?.[key])}`;
      });

      entities.forEach(entity => {
        csv += `${prefix},${escapeCsv(entity.name)},${escapeCsv(entity.type)},${escapeCsv(entity.note)}\n`;
      });
    });

    downloadFile(csv, `Ba7ath_Flat_${dateTag}.csv`, 'text/csv;charset=utf-8;');
    onClose();
  };

  // === FORMAT 2 : CSV GROUPÉ (1 ligne = 1 source) ===
  const handleExportGrouped = () => {
    if (Object.keys(extractedEntities).length === 0) {
      return alert("Aucune entité à exporter.");
    }

    // En-têtes : uuid, metadata..., puis une colonne par catégorie
    let csv = 'uuid_source';
    metadataKeys.forEach(key => { csv += `,${escapeCsv(key)}`; });
    categories.forEach(cat => { csv += `,${escapeCsv(cat.name)}`; });
    csv += '\n';

    Object.entries(extractedEntities).forEach(([uuid, entities]) => {
      const source = entreprises.find(c => c.uuid === uuid);
      let row = escapeCsv(uuid);
      metadataKeys.forEach(key => {
        row += `,${escapeCsv(source?.metadata?.[key])}`;
      });

      // Regrouper les entités par type de catégorie
      categories.forEach(cat => {
        const matching = entities.filter(e => e.type === cat.id).map(e => e.name);
        row += `,${escapeCsv(matching.join(' ; '))}`;
      });

      csv += row + '\n';
    });

    downloadFile(csv, `Ba7ath_Grouped_${dateTag}.csv`, 'text/csv;charset=utf-8;');
    onClose();
  };

  // === FORMAT 3 : JSON NER (Fine-Tuning) ===
  const handleExportJSON = () => {
    if (Object.keys(extractedEntities).length === 0) {
      return alert("Aucune entité à exporter.");
    }

    const output = Object.entries(extractedEntities).map(([uuid, entities]) => {
      const source = entreprises.find(c => c.uuid === uuid);
      return {
        uuid,
        texts: source?.texts || [],
        metadata: source?.metadata || {},
        entities: entities.map(e => ({
          name: e.name,
          type: e.type,
          note: e.note || ''
        }))
      };
    });

    const jsonStr = JSON.stringify(output, null, 2);
    downloadFile(jsonStr, `Ba7ath_NER_${dateTag}.json`, 'application/json;charset=utf-8;');
    onClose();
  };

  // === FORMAT 4 : EXPORT RÉSEAU (Gephi / Neo4J / Kumu) ===
  const handleExportNetwork = (mode) => {
    if (Object.keys(extractedEntities).length === 0) {
      return alert("Aucune entité à exporter.");
    }

    const nodesMap = new Map(); // Id -> { label, type }
    let edgesCsv = 'Source,Target,Type,Label\n';

    Object.entries(extractedEntities).forEach(([uuid, entities]) => {
      const source = entreprises.find(c => c.uuid === uuid);
      // Nœud source
      const sourceLabel = source?.metadata
        ? Object.values(source.metadata).filter(v => v).join(' - ') || uuid
        : uuid;
      nodesMap.set(uuid, { label: sourceLabel, type: 'Source' });

      entities.forEach(entity => {
        // Nœud entité
        const entityId = `${entity.type}::${entity.name}`;
        if (!nodesMap.has(entityId)) {
          const catName = categories.find(c => c.id === entity.type)?.name || entity.type;
          nodesMap.set(entityId, { label: entity.name, type: catName });
        }
        // Edge
        edgesCsv += `${escapeCsv(uuid)},${escapeCsv(entityId)},${escapeCsv(entity.type)},${escapeCsv(entity.name)}\n`;
      });
    });

    // Nodes CSV
    let nodesCsv = 'Id,Label,Type\n';
    nodesMap.forEach((val, key) => {
      nodesCsv += `${escapeCsv(key)},${escapeCsv(val.label)},${escapeCsv(val.type)}\n`;
    });

    if (mode === 'both' || mode === 'edges') {
      downloadFile(edgesCsv, `Ba7ath_Edges_${dateTag}.csv`, 'text/csv;charset=utf-8;');
    }
    if (mode === 'both' || mode === 'nodes') {
      // Petit délai pour que le navigateur gère les 2 téléchargements
      setTimeout(() => {
        downloadFile(nodesCsv, `Ba7ath_Nodes_${dateTag}.csv`, 'text/csv;charset=utf-8;');
      }, 300);
    }
    onClose();
  };

  // === FORMATS D'EXPORT DISPONIBLES ===
  const formats = [
    {
      id: 'flat',
      icon: FileSpreadsheet,
      title: 'CSV Plat',
      desc: '1 ligne = 1 entité. Idéal pour SQL, Excel, et l\'import en base de données.',
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/50',
      action: handleExportFlat
    },
    {
      id: 'grouped',
      icon: Layers,
      title: 'CSV Groupé',
      desc: '1 ligne = 1 source. Entités regroupées par type dans des colonnes séparées.',
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/50',
      action: handleExportGrouped
    },
    {
      id: 'json',
      icon: FileJson,
      title: 'JSON (NER)',
      desc: 'Structure JSON pour le fine-tuning de modèles NER / LLM. Texte + Entités.',
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/50',
      action: handleExportJSON
    },
    {
      id: 'network',
      icon: Share2,
      title: 'Export Réseau',
      desc: 'Fichiers Edges + Nodes pour Gephi, Neo4J, Kumu. Import direct sans nettoyage.',
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800/50',
      action: null // Handled by sub-options
    }
  ];

  const entityCount = Object.values(extractedEntities).reduce((acc, arr) => acc + arr.length, 0);
  const sourceCount = Object.keys(extractedEntities).length;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}></div>

      {/* Modal */}
      <div className="relative glass-card rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Download className="w-5 h-5 text-red-600" /> Exporter les données
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {entityCount} entités extraites de {sourceCount} sources
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {formats.map(fmt => {
            const Icon = fmt.icon;
            const isNetwork = fmt.id === 'network';
            const isExpanded = activeTab === 'network' && isNetwork;

            return (
              <div key={fmt.id}>
                <button
                  onClick={() => {
                    if (isNetwork) {
                      setActiveTab(activeTab === 'network' ? null : 'network');
                    } else {
                      fmt.action();
                    }
                  }}
                  className={`w-full text-left p-5 rounded-xl border-2 transition-all hover:shadow-md group ${activeTab === fmt.id || isExpanded ? fmt.bgColor : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-2.5 rounded-lg ${fmt.bgColor}`}>
                      <Icon className={`w-6 h-6 ${fmt.color}`} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-900 dark:text-white text-lg flex items-center gap-2">
                        {fmt.title}
                        {!isNetwork && <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition" />}
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{fmt.desc}</p>
                    </div>
                  </div>
                </button>

                {/* Sub-options pour Export Réseau */}
                {isExpanded && (
                  <div className="mt-3 ml-14 flex flex-col gap-2 animate-in fade-in">
                    <button
                      onClick={() => handleExportNetwork('both')}
                      className="flex items-center gap-3 px-4 py-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700/50 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition text-left"
                    >
                      <Share2 className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                      <div>
                        <span className="font-semibold text-sm text-purple-900 dark:text-purple-200">Edges + Nodes</span>
                        <span className="block text-xs text-purple-600 dark:text-purple-400">Télécharger les 2 fichiers CSV (recommandé pour Gephi)</span>
                      </div>
                    </button>
                    <button
                      onClick={() => handleExportNetwork('edges')}
                      className="flex items-center gap-3 px-4 py-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition text-left"
                    >
                      <Share2 className="w-4 h-4 text-slate-500 shrink-0" />
                      <div>
                        <span className="font-semibold text-sm text-slate-700 dark:text-slate-200">Edges uniquement</span>
                        <span className="block text-xs text-slate-500 dark:text-slate-400">Source → Target (compatible Kumu, Neo4J)</span>
                      </div>
                    </button>
                    <button
                      onClick={() => handleExportNetwork('nodes')}
                      className="flex items-center gap-3 px-4 py-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition text-left"
                    >
                      <Share2 className="w-4 h-4 text-slate-500 shrink-0" />
                      <div>
                        <span className="font-semibold text-sm text-slate-700 dark:text-slate-200">Nodes uniquement</span>
                        <span className="block text-xs text-slate-500 dark:text-slate-400">Liste de tous les nœuds (Id, Label, Type)</span>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 text-center">
          <p className="text-xs text-slate-400">Tous les exports sont générés localement. Aucune donnée ne quitte votre navigateur.</p>
        </div>
      </div>
    </div>
  );
}
