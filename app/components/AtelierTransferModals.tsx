import React, { useMemo, useState } from 'react';
import { Workshop, SchoolProgram } from '../types';
import { createAtelierBundle, remapWorkshopSkills, ParsedAtelierBundle, BundledSkill } from '../utils/workshopBundle';
import { XIcon, PackageIcon, UploadIcon, ImageIcon, CheckIcon, AlertTriangleIcon } from 'lucide-react';
import useModalDismiss from '../hooks/useModalDismiss';
import { toast } from '../utils/toast';
import StoredImage from '../images/StoredImage';
import { safeFileName } from '../domain/fileNames';

// ═══════════════════════════════════════════════════════════════════════════
// Export
// ═══════════════════════════════════════════════════════════════════════════

export const ExportAteliersModal: React.FC<{
  workshops: Workshop[];
  schoolPrograms: SchoolProgram[];
  onClose: () => void;
}> = ({ workshops, schoolPrograms, onClose }) => {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(workshops.map(w => w.id)));
  const [isBuilding, setIsBuilding] = useState(false);

  const allSelected = selected.size === workshops.length && workshops.length > 0;

  const toggle = (id: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(workshops.map(w => w.id)));
  };

  const handleExport = async () => {
    const chosen = workshops.filter(w => selected.has(w.id));
    if (chosen.length === 0) return;

    setIsBuilding(true);
    try {
      const blob = await createAtelierBundle(chosen, schoolPrograms);
      const now = new Date();
      const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const baseName = chosen.length === 1
        ? chosen[0].name
        : `Ateliers-${chosen.length}`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = safeFileName(`${baseName}-${stamp}`, 'atelier', 'ateliers');
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`${chosen.length} atelier${chosen.length > 1 ? 's' : ''} exporté${chosen.length > 1 ? 's' : ''} dans un fichier .atelier.`);
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la création du fichier .atelier.");
    } finally {
      setIsBuilding(false);
    }
  };

  const handleBackdropClick = useModalDismiss(onClose);

  return (
    <div className="fixed inset-0 z-[220] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={handleBackdropClick}>
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-200 dark:border-zinc-700 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <PackageIcon className="w-5 h-5 text-slate-500 dark:text-zinc-400" />
            <h2 className="text-xl font-bold text-slate-800 dark:text-zinc-100">Exporter des ateliers</h2>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 rounded-full transition-colors"><XIcon className="w-5 h-5" /></button>
        </div>

        <div className="px-6 pt-4">
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            Sélectionnez les ateliers à regrouper dans un fichier <span className="font-semibold">.atelier</span> (photos et compétences liées incluses).
          </p>
        </div>

        <div className="px-6 pt-3 flex justify-between items-center">
          <span className="text-sm font-medium text-slate-700 dark:text-zinc-300">
            {selected.size} / {workshops.length} sélectionné{selected.size > 1 ? 's' : ''}
          </span>
          <button onClick={toggleAll} className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 transition-colors">
            {allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
          </button>
        </div>

        <div className="flex-grow overflow-y-auto px-6 py-3 space-y-1.5">
          {workshops.map(w => (
            <label key={w.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-700/50 cursor-pointer transition-colors">
              <input type="checkbox" checked={selected.has(w.id)} onChange={() => toggle(w.id)} className="flex-shrink-0" />
              <div className="w-10 h-10 rounded-md bg-slate-100 dark:bg-zinc-900 flex items-center justify-center overflow-hidden flex-shrink-0">
                {w.image ? <StoredImage src={w.image} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="w-4 h-4 text-slate-300 dark:text-zinc-600" />}
              </div>
              <div className="min-w-0 flex-grow">
                <p className="text-sm font-medium text-slate-800 dark:text-zinc-200 truncate">{w.name}</p>
                <p className="text-xs text-slate-400 dark:text-zinc-500">{w.skillIds.length} compétence{w.skillIds.length > 1 ? 's' : ''} liée{w.skillIds.length > 1 ? 's' : ''}</p>
              </div>
            </label>
          ))}
          {workshops.length === 0 && (
            <p className="py-10 text-center text-sm text-slate-400 dark:text-zinc-500">Aucun atelier à exporter.</p>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 dark:border-zinc-700 flex justify-end gap-3 bg-slate-50 dark:bg-zinc-800/50 rounded-b-xl">
          <button onClick={onClose} className="px-4 py-2 font-medium text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-lg transition-colors">Annuler</button>
          <button onClick={handleExport} disabled={selected.size === 0 || isBuilding} className="px-5 py-2 flex items-center gap-2 font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg shadow-sm transition-colors disabled:opacity-50">
            <PackageIcon className="w-4 h-4" /> {isBuilding ? 'Création...' : `Exporter (${selected.size})`}
          </button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Import
// ═══════════════════════════════════════════════════════════════════════════

type CollisionMode = 'copy' | 'replace';

interface ImportRow {
  workshop: Workshop;
  collision: boolean;
  skillIds: string[];
  matched: number;
  unmatched: BundledSkill[];
  included: boolean;
  mode: CollisionMode;
}

export const ImportAteliersModal: React.FC<{
  bundle: ParsedAtelierBundle;
  existingWorkshops: Workshop[];
  schoolPrograms: SchoolProgram[];
  onImport: (workshops: Workshop[]) => void;
  onClose: () => void;
}> = ({ bundle, existingWorkshops, schoolPrograms, onImport, onClose }) => {
  const existingIds = useMemo(() => new Set(existingWorkshops.map(w => w.id)), [existingWorkshops]);

  const [rows, setRows] = useState<ImportRow[]>(() =>
    bundle.workshops.map(w => {
      const remap = remapWorkshopSkills(w, bundle.skills, schoolPrograms);
      const collision = existingIds.has(w.id);
      return {
        workshop: w,
        collision,
        skillIds: remap.skillIds,
        matched: remap.matchedById + remap.matchedByName,
        unmatched: remap.unmatched,
        included: !collision, // les doublons sont décochés par défaut
        mode: 'copy',
      };
    })
  );

  const includedCount = rows.filter(r => r.included).length;

  const setRow = (id: string, patch: Partial<ImportRow>) => {
    setRows(prev => prev.map(r => (r.workshop.id === id ? { ...r, ...patch } : r)));
  };

  const handleImport = () => {
    const toImport: Workshop[] = rows
      .filter(r => r.included)
      .map(r => {
        const base: Workshop = { ...r.workshop, skillIds: r.skillIds };
        if (r.collision && r.mode === 'copy') {
          return {
            ...base,
            id: crypto.randomUUID(),
            name: `${base.name} (copie)`,
            createdAt: new Date().toISOString(),
          };
        }
        // 'replace' → conserve l'ID (écrase l'existant, QR inchangé)
        // nouveau → conserve l'ID d'origine (QR déjà imprimés valides)
        return base;
      });
    onImport(toImport);
  };

  const handleBackdropClick = useModalDismiss(onClose);

  return (
    <div className="fixed inset-0 z-[220] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={handleBackdropClick}>
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-200 dark:border-zinc-700 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <UploadIcon className="w-5 h-5 text-slate-500 dark:text-zinc-400" />
            <h2 className="text-xl font-bold text-slate-800 dark:text-zinc-100">Importer des ateliers</h2>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 rounded-full transition-colors"><XIcon className="w-5 h-5" /></button>
        </div>

        <div className="px-6 pt-4">
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            {bundle.workshops.length} atelier{bundle.workshops.length > 1 ? 's' : ''} trouvé{bundle.workshops.length > 1 ? 's' : ''} dans le fichier. Sélectionnez ceux à importer.
          </p>
        </div>

        <div className="flex-grow overflow-y-auto px-6 py-3 space-y-2">
          {rows.map(r => (
            <div key={r.workshop.id} className={`p-3 rounded-lg border transition-colors ${r.included ? 'border-blue-200 dark:border-blue-800/50 bg-blue-50/40 dark:bg-blue-900/10' : 'border-slate-200 dark:border-zinc-700'}`}>
              <div className="flex items-center gap-3">
                <input type="checkbox" checked={r.included} onChange={() => setRow(r.workshop.id, { included: !r.included })} className="flex-shrink-0" />
                <div className="w-10 h-10 rounded-md bg-slate-100 dark:bg-zinc-900 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {r.workshop.image ? <StoredImage src={r.workshop.image} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="w-4 h-4 text-slate-300 dark:text-zinc-600" />}
                </div>
                <div className="min-w-0 flex-grow">
                  <p className="text-sm font-medium text-slate-800 dark:text-zinc-200 truncate">{r.workshop.name}</p>
                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                    {r.matched > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                        <CheckIcon className="w-3 h-3" /> {r.matched} compétence{r.matched > 1 ? 's' : ''} reconnue{r.matched > 1 ? 's' : ''}
                      </span>
                    )}
                    {r.unmatched.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                        <AlertTriangleIcon className="w-3 h-3" /> {r.unmatched.length} non reconnue{r.unmatched.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
                {r.collision && (
                  <div className="flex-shrink-0 flex flex-col items-end gap-1">
                    <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Déjà présent</span>
                    <select
                      value={r.mode}
                      onChange={e => setRow(r.workshop.id, { mode: e.target.value as CollisionMode })}
                      className="text-xs bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-600 rounded-md px-1.5 py-1 text-slate-700 dark:text-zinc-200 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="copy">Importer en copie</option>
                      <option value="replace">Remplacer l'existant</option>
                    </select>
                  </div>
                )}
              </div>

              {r.unmatched.length > 0 && r.included && (
                <div className="mt-2 ml-8 text-xs text-slate-400 dark:text-zinc-500">
                  Non reliées (absentes de vos programmes) : {r.unmatched.map(u => u.name).join(', ')}
                </div>
              )}
              {r.collision && r.mode === 'copy' && r.included && (
                <div className="mt-2 ml-8 text-xs text-blue-500 dark:text-blue-400">
                  Un nouvel atelier sera créé — un nouveau QR code devra être imprimé.
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 dark:border-zinc-700 flex justify-end gap-3 bg-slate-50 dark:bg-zinc-800/50 rounded-b-xl">
          <button onClick={onClose} className="px-4 py-2 font-medium text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-lg transition-colors">Annuler</button>
          <button onClick={handleImport} disabled={includedCount === 0} className="px-5 py-2 flex items-center gap-2 font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg shadow-sm transition-colors disabled:opacity-50">
            <UploadIcon className="w-4 h-4" /> Importer ({includedCount})
          </button>
        </div>
      </div>
    </div>
  );
};
