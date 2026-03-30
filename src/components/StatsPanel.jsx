import React, { useMemo, useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Target, GitMerge, Check, X, ChevronDown, ChevronUp, PieChart, ShieldAlert } from 'lucide-react';

/**
 * Moteur de normalisation sémantique (Synchronisé avec WorkspaceView)
 */
const normalizeEntityName = (name) => {
  if (!name) return '';
  const noiseWords = new Set(['the', 'of', 'and', 'a', 'an', 'in', 'on', 'at', 'for', 'with', 'by', 'et', '&']);
  
  return name
    .toLowerCase()
    .trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') 
    .replace(/[.,;:"'!?(){}[\]&]/g, ' ') 
    .split(/\s+/)
    .filter(token => token.length > 0 && !noiseWords.has(token))
    .map(token => {
      if (token.length > 3 && token.endsWith('s')) {
        return token.slice(0, -1);
      }
      return token;
    })
    .sort()
    .join(' ');
};

/**
 * CircularProgress — Donut Chart SVG animé pour la couverture.
 */
const CircularProgress = ({ percentage, size = 120, strokeWidth = 10, color = "text-red-500" }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          className="text-slate-100 dark:text-slate-700/50"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          style={{ 
            strokeDashoffset: offset,
            transition: 'stroke-dashoffset 1s ease-in-out'
          }}
          strokeLinecap="round"
          className={color}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="text-2xl font-black text-slate-900 dark:text-white leading-none">{percentage}%</span>
      </div>
    </div>
  );
};

export default function StatsPanel({ entreprises, extractedEntities, categories, setExtractedEntities }) {
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [showInconsistencies, setShowInconsistencies] = useState(false);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAnimate(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // === CALCULS STATISTIQUES ET AUDIT (OPTIMISÉS) ===
  const stats = useMemo(() => {
    const allEntities = Object.values(extractedEntities).flat();
    const annotatedCount = Object.keys(extractedEntities).length;
    const totalCount = entreprises.length;
    const coverage = totalCount > 0 ? Math.round((annotatedCount / totalCount) * 100) : 0;

    const byCategory = {};
    categories.forEach(cat => { byCategory[cat.id] = 0; });
    allEntities.forEach(e => {
      if (byCategory[e.type] !== undefined) byCategory[e.type]++;
      else byCategory[e.type] = 1;
    });

    const freq = {};
    allEntities.forEach(e => {
      const key = e.name;
      freq[key] = (freq[key] || 0) + 1;
    });
    const top10 = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    // 🔍 AUDIT 0 : Base de normalisation globale
    const globalNameMap = {}; 
    allEntities.forEach(e => {
      const norm = normalizeEntityName(e.name);
      if (!norm) return;
      if (!globalNameMap[norm]) globalNameMap[norm] = new Set();
      globalNameMap[norm].add(e.name);
    });

    // 🔍 AUDIT 1 : Détection de doublons orthographiques avancés
    const duplicateGroups = Object.entries(globalNameMap)
      .filter(([_, variants]) => variants.size > 1)
      .map(([norm, variants]) => {
        const variantList = Array.from(variants);
        
        // Si l'utilisateur a cliqué sur "Garder les deux" dans le Workspace, on ignore ce groupe
        const isIntentional = allEntities.some(e => 
           e.isDuplicateIntentional && variantList.includes(e.name)
        );
        if (isIntentional) return null;

        return {
          key: variantList[0], // Le nom à afficher
          normKey: norm,       // La clé normalisée (le lien commun)
          variants: variantList,
          count: variantList.reduce((acc, v) => acc + (freq[v] || 0), 0)
        };
      }).filter(Boolean); // Retire les groupes intentionnels

    // 🔍 AUDIT 2 : Scanner d'Incohérences de Typage (Catégories conflictuelles)
    const typeMap = {}; 
    allEntities.forEach(e => {
      const norm = normalizeEntityName(e.name);
      if (!norm) return;
      if (!typeMap[norm]) typeMap[norm] = new Set();
      typeMap[norm].add(e.type);
    });

    const typeInconsistencies = Object.entries(typeMap)
      .filter(([_, types]) => types.size > 1) 
      .map(([norm, types]) => {
        const originalName = Array.from(globalNameMap[norm] || [norm])[0];
        return {
          key: originalName,
          normKey: norm, // On garde la clé normalisée pour la résolution
          types: Array.from(types),
          count: Array.from(globalNameMap[norm] || []).reduce((acc, v) => acc + (freq[v] || 0), 0)
        };
      });

    return { 
      allEntities, annotatedCount, totalCount, coverage, 
      byCategory, top10, duplicateGroups, typeInconsistencies 
    };
  }, [extractedEntities, entreprises, categories]);

  const maxCatCount = Math.max(1, ...Object.values(stats.byCategory));

  // === FUSION ORTHOGRAPHIQUE ===
  const handleMerge = (duplicateGroup, keepName) => {
    setExtractedEntities(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(uuid => {
        updated[uuid] = updated[uuid].map(entity => {
          if (duplicateGroup.variants.includes(entity.name)) {
            return { ...entity, name: keepName };
          }
          return entity;
        });
        // Dédupliquer après fusion (même uuid + même nom + même type)
        const seen = new Set();
        updated[uuid] = updated[uuid].filter(e => {
          const key = `${e.name}::${e.type}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      });
      return updated;
    });
  };

  const handleIgnoreConflict = (duplicateGroup) => {
    setExtractedEntities(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(uuid => {
        updated[uuid] = updated[uuid].map(entity => {
          if (duplicateGroup.variants.includes(entity.name)) {
            return { ...entity, isDuplicateIntentional: true };
          }
          return entity;
        });
      });
      return updated;
    });
  };

  // === RÉSOLUTION D'INCOHÉRENCE DE TYPE ===
  const handleResolveTypeInconsistency = (normKey, forcedType) => {
    setExtractedEntities(prev => {
      const updated = { ...prev };
      
      Object.keys(updated).forEach(uuid => {
        updated[uuid] = updated[uuid].map(entity => {
          // On compare via la clé normalisée pour corriger TOUTES les variantes orthographiques d'un coup
          if (normalizeEntityName(entity.name) === normKey) {
            return { ...entity, type: forcedType }; 
          }
          return entity;
        });
      });
      return updated;
    });
  };

  useEffect(() => {
    if (stats.duplicateGroups.length > 0) setShowDuplicates(true);
    if (stats.typeInconsistencies.length > 0) setShowInconsistencies(true);
  }, [stats.duplicateGroups.length, stats.typeInconsistencies.length]);

  return (
    <div className="w-full max-w-6xl glass-card rounded-2xl mb-6 overflow-hidden animate-scale-in border border-white/20 shadow-2xl">
      <div className="grid grid-cols-1 md:grid-cols-12">
        
        {/* Section 1 : Couverture (Donut Chart) */}
        <div className="md:col-span-4 p-8 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-slate-200/50 dark:border-slate-700/50 bg-slate-50/30 dark:bg-slate-800/20">
          <h3 className="font-black text-xs uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
            <Target className="w-4 h-4 text-red-500" /> Progression Tâche
          </h3>
          <CircularProgress percentage={stats.coverage} color="text-red-500" />
          <div className="mt-6 text-center">
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
              {stats.annotatedCount} <span className="text-slate-400 font-medium">/ {stats.totalCount}</span>
            </p>
            <p className="text-[10px] uppercase font-black tracking-tighter text-slate-400 mt-1">Sources Analysées</p>
          </div>
        </div>

        {/* Section 2 : Par catégorie & Top 10 */}
        <div className="md:col-span-8 p-0 flex flex-col">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 flex-1">
            {/* Par Catégorie */}
            <div className="p-6 border-b sm:border-b-0 sm:border-r border-slate-200/50 dark:border-slate-700/50">
              <h3 className="font-black text-[10px] uppercase tracking-widest text-slate-400 mb-5 flex items-center gap-2">
                <PieChart className="w-3.5 h-3.5 text-blue-500" /> Volume / Type
              </h3>
              <div className="space-y-4">
                {categories.map(cat => {
                  const count = stats.byCategory[cat.id] || 0;
                  const pct = maxCatCount > 0 ? (count / maxCatCount) * 100 : 0;
                  return (
                    <div key={cat.id} className="group">
                      <div className="flex justify-between items-center mb-1.5 px-1">
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{cat.name}</span>
                        <span className="text-xs font-black text-slate-400 group-hover:text-slate-600 dark:group-hover:text-white transition-colors">{count}</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-700/50 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`${cat.color} h-full rounded-full transition-all duration-1000 ease-out shadow-sm`}
                          style={{ width: `${animate ? Math.max(pct, 2) : 0}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top 10 */}
            <div className="p-6 bg-slate-50/10">
              <h3 className="font-black text-[10px] uppercase tracking-widest text-slate-400 mb-5 flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-amber-500" /> Hot Targets
              </h3>
              {stats.top10.length === 0 ? (
                <p className="text-xs text-slate-400 italic">En attente d'annotations...</p>
              ) : (
                <div className="space-y-2">
                  {stats.top10.slice(0, 5).map(([name, count], idx) => (
                    <div key={name} className="flex items-center justify-between text-xs p-2 rounded-lg bg-white/50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 hover:border-amber-300 dark:hover:border-amber-600/50 transition-colors shadow-sm">
                      <div className="flex items-center gap-2 truncate pr-2">
                        <span className="text-[9px] font-black text-slate-300 w-3">{idx + 1}</span>
                        <span className="font-bold text-slate-700 dark:text-slate-200 truncate" title={name}>{name}</span>
                      </div>
                      <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded font-black text-[10px] shrink-0">{count}</span>
                    </div>
                  ))}
                  {stats.top10.length > 5 && (
                    <p className="text-[9px] text-center text-slate-400">+ {stats.top10.length - 5} autres entités fréquentes</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Section 3 : Scanner d'Incohérences de Type */}
          <div className="p-5 bg-red-50/30 dark:bg-red-900/10 border-t border-red-200/50 dark:border-red-900/50">
            <button
              onClick={() => setShowInconsistencies(!showInconsistencies)}
              className="w-full flex items-center justify-between group"
            >
              <div className="flex flex-col items-start text-left">
                <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                  <ShieldAlert className={`w-4 h-4 ${stats.typeInconsistencies.length > 0 ? 'text-red-500' : 'text-slate-400'}`} /> Scanner d'Intégrité
                  {stats.typeInconsistencies.length > 0 && (
                    <span className="bg-red-500 text-white px-1.5 py-0.5 rounded text-[9px] animate-pulse">
                      {stats.typeInconsistencies.length} Erreur(s) Critique(s)
                    </span>
                  )}
                </span>
              </div>
              {showInconsistencies ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>

            {showInconsistencies && (
              <div className="mt-4 space-y-3 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                {stats.typeInconsistencies.length === 0 ? (
                  <p className="text-xs text-slate-400 italic flex items-center gap-1.5 py-2">
                    <Check className="w-4 h-4 text-green-500" /> La base de données est propre. Aucune incohérence.
                  </p>
                ) : (
                  stats.typeInconsistencies.map(inconsistency => (
                    <div key={inconsistency.normKey} className="bg-white/80 dark:bg-slate-800/80 p-3 rounded-xl border border-red-200 dark:border-red-900 shadow-sm transition-all hover:shadow-md">
                      <p className="text-[10px] uppercase font-black text-red-500 mb-2">
                        Conflit de Catégorie pour <span className="text-slate-700 dark:text-slate-200 inline-block bg-slate-100 dark:bg-slate-700 px-1 rounded">« {inconsistency.key} »</span> :
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Cette entité a été assignée à la fois comme {inconsistency.types.map(t => categories.find(c => c.id === t)?.name || t).join(' et ')}.</p>
                      
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {inconsistency.types.map(type => {
                          const catName = categories.find(c => c.id === type)?.name || type;
                          return (
                            <button
                              key={type}
                              onClick={() => handleResolveTypeInconsistency(inconsistency.normKey, type)}
                              className="text-[11px] px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all font-bold"
                            >
                              Forcer en « {catName} »
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Section 4 : Doublons Orthographiques */}
          <div className="p-5 bg-slate-100/30 dark:bg-slate-900/20 border-t border-slate-200/50 dark:border-slate-700/50">
            <button
              onClick={() => setShowDuplicates(!showDuplicates)}
              className="w-full flex items-center justify-between group"
            >
              <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-slate-600 dark:group-hover:text-white transition-colors">
                <GitMerge className="w-4 h-4 text-purple-500" /> Variantes Orthographiques
                {stats.duplicateGroups.length > 0 && (
                  <span className="bg-purple-500 text-white px-1.5 py-0.5 rounded text-[9px] animate-pulse">
                    {stats.duplicateGroups.length} Ambiguïté(s)
                  </span>
                )}
              </span>
              {showDuplicates ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>

            {showDuplicates && (
              <div className="mt-4 space-y-3 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                {stats.duplicateGroups.length === 0 ? (
                  <p className="text-xs text-slate-400 italic flex items-center gap-1.5 py-2">
                    <Check className="w-4 h-4 text-green-500" /> Aucun doublon détecté.
                  </p>
                ) : (
                  stats.duplicateGroups.map(group => (
                    <div key={group.normKey} className="bg-white/80 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:shadow-md">
                      <p className="text-[10px] uppercase font-black text-slate-400 mb-2">
                        Fusionner <span className="text-slate-700 dark:text-slate-200 inline-block bg-slate-100 dark:bg-slate-700 px-1 rounded">« {group.key} »</span> ({group.count} occurrences) :
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {group.variants.map(variant => (
                          <button
                            key={variant}
                            onClick={() => handleMerge(group, variant)}
                            className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-purple-500 hover:text-white hover:border-purple-500 transition-all font-bold"
                          >
                            Garder « {variant} »
                          </button>
                        ))}
                        <button
                          onClick={() => handleIgnoreConflict(group)}
                          className="text-[11px] px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300 transition-all font-bold"
                        >
                          Ignorer l'alerte
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}