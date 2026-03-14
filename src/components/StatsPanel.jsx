import React, { useMemo, useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Target, GitMerge, Check, X, ChevronDown, ChevronUp, PieChart } from 'lucide-react';

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
        {/* <span className="text-[10px] uppercase tracking-tighter text-slate-400 font-bold mt-1">Check</span> */}
      </div>
    </div>
  );
};

export default function StatsPanel({ entreprises, extractedEntities, categories, setExtractedEntities }) {
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAnimate(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // === CALCULS STATISTIQUES ===
  const stats = useMemo(() => {
    const allEntities = Object.values(extractedEntities).flat();
    const annotatedCount = Object.keys(extractedEntities).length;
    const totalCount = entreprises.length;
    const coverage = totalCount > 0 ? Math.round((annotatedCount / totalCount) * 100) : 0;

    // Comptage par catégorie
    const byCategory = {};
    categories.forEach(cat => { byCategory[cat.id] = 0; });
    allEntities.forEach(e => {
      if (byCategory[e.type] !== undefined) byCategory[e.type]++;
      else byCategory[e.type] = 1;
    });

    // Top 10 entités les plus fréquentes
    const freq = {};
    allEntities.forEach(e => {
      const key = e.name;
      freq[key] = (freq[key] || 0) + 1;
    });
    const top10 = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    // Détection de doublons (insensible à la casse + similarité simple)
    const nameMap = {}; // lowercase -> [original names]
    allEntities.forEach(e => {
      // On ignore les entités marquées comme intentionnellement dupliquées
      if (e.isDuplicateIntentional) return;

      const lower = e.name.toLowerCase().trim();
      if (!nameMap[lower]) nameMap[lower] = new Set();
      nameMap[lower].add(e.name);
    });
    // Groupes de doublons : entrées avec plus d'une variante
    const duplicateGroups = Object.entries(nameMap)
      .filter(([_, variants]) => variants.size > 1)
      .map(([key, variants]) => ({
        key,
        variants: Array.from(variants),
        count: (Array.from(variants).reduce((acc, v) => acc + (freq[v] || 0), 0))
      }));

    return { allEntities, annotatedCount, totalCount, coverage, byCategory, top10, duplicateGroups };
  }, [extractedEntities, entreprises, categories]);

  const maxCatCount = Math.max(1, ...Object.values(stats.byCategory));

  // === FUSION DE DOUBLONS ===
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

  // Auto-ouvrir si des conflits apparaissent
  useEffect(() => {
    if (stats.duplicateGroups.length > 0) {
      setShowDuplicates(true);
    }
  }, [stats.duplicateGroups.length]);

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

          {/* Section 4 : Doublons potentiels (Focus pied de page) */}
          <div className="p-5 bg-slate-100/30 dark:bg-slate-900/20 border-t border-slate-200/50 dark:border-slate-700/50">
            <button
              onClick={() => setShowDuplicates(!showDuplicates)}
              className="w-full flex items-center justify-between group"
            >
              <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-slate-600 dark:group-hover:text-white transition-colors">
                <GitMerge className="w-4 h-4 text-purple-500" /> Qualité des Données
                {stats.duplicateGroups.length > 0 && (
                  <span className="bg-purple-500 text-white px-1.5 py-0.5 rounded text-[9px] animate-pulse">
                    {stats.duplicateGroups.length} Conflits
                  </span>
                )}
              </span>
              {showDuplicates ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>

            {showDuplicates && (
              <div className="mt-4 space-y-3 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                {stats.duplicateGroups.length === 0 ? (
                  <p className="text-xs text-slate-400 italic flex items-center gap-1.5 py-2">
                    <Check className="w-4 h-4 text-green-500" /> Aucune ambiguïté détectée.
                  </p>
                ) : (
                  stats.duplicateGroups.map(group => (
                    <div key={group.key} className="bg-white/80 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:shadow-md">
                      <p className="text-[10px] uppercase font-black text-slate-400 mb-2">
                        Variantes pour <span className="text-slate-700 dark:text-slate-200 inline-block bg-slate-100 dark:bg-slate-700 px-1 rounded">« {group.key} »</span> ({group.count} occurrences) :
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {group.variants.map(variant => (
                          <button
                            key={variant}
                            onClick={() => handleMerge(group, variant)}
                            className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-purple-500 hover:text-white hover:border-purple-500 transition-all font-bold"
                          >
                            Fusionner vers « {variant} »
                          </button>
                        ))}
                        <button
                          onClick={() => handleIgnoreConflict(group)}
                          className="text-[11px] px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300 transition-all font-bold"
                        >
                          Garder tels quels
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

