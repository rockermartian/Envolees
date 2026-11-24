import React, { useState } from 'react';
import { Student, SchoolProgram, Domain } from '../types';
import useModalDismiss from '../hooks/useModalDismiss';

export interface ImportEntry {
  student: Student;
  action: 'new' | 'merge_by_id' | 'potential_duplicate';
  existingId?: string;
}

export interface ImportDecision {
  student: Student;
  action: 'add' | 'merge' | 'skip';
  targetId?: string;
}

interface StudentImportModalProps {
  entries: ImportEntry[];
  unmatchedPrograms: SchoolProgram[];
  onConfirm: (decisions: ImportDecision[]) => void;
  onClose: () => void;
}

const XMarkIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const countSkillsInDomains = (domains: Domain[]): number =>
  domains.reduce((acc, d) => acc + d.skills.length + countSkillsInDomains(d.subDomains ?? []), 0);

const formatDob = (dob: string): string => {
  if (!dob) return '—';
  const parts = dob.split('-');
  if (parts.length !== 3) return dob;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

const StudentImportModal: React.FC<StudentImportModalProps> = ({ entries, unmatchedPrograms, onConfirm, onClose }) => {
  const newEntries = entries.filter(e => e.action === 'new');
  const mergeEntries = entries.filter(e => e.action === 'merge_by_id');
  const dupEntries = entries.filter(e => e.action === 'potential_duplicate');

  const [dupDecisions, setDupDecisions] = useState<Record<string, 'merge' | 'add' | 'skip'>>(() =>
    Object.fromEntries(dupEntries.map(e => [e.student.id, 'merge']))
  );

  const unmatchedSkillCount = unmatchedPrograms.reduce((acc, p) => acc + countSkillsInDomains(p.domains), 0);

  const handleConfirm = () => {
    const decisions: ImportDecision[] = entries.map(e => {
      if (e.action === 'new') return { student: e.student, action: 'add' };
      if (e.action === 'merge_by_id') return { student: e.student, action: 'merge', targetId: e.student.id };
      const dec = dupDecisions[e.student.id] ?? 'merge';
      return {
        student: e.student,
        action: dec,
        targetId: dec === 'merge' ? e.existingId : undefined,
      };
    });
    onConfirm(decisions);
  };

  // Clic fond neutralisé dès que l'utilisateur a modifié au moins un choix de doublon,
  // pour ne pas perdre sa revue en cours (le défaut est « merge »).
  const isDirty = Object.values(dupDecisions).some(d => d !== 'merge');
  const handleBackdropClick = useModalDismiss(onClose, true, !isDirty);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={handleBackdropClick}>
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-zinc-700 flex-shrink-0">
          <h2 className="text-base font-semibold text-slate-800 dark:text-zinc-100">Importer des élèves</h2>
          <button onClick={onClose} aria-label="Fermer" className="text-slate-400 hover:text-slate-600 dark:text-zinc-400 dark:hover:text-zinc-200 p-1 rounded transition-colors">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          <div className="flex flex-wrap gap-2 text-xs font-medium">
            {newEntries.length > 0 && (
              <span className="px-2.5 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                {newEntries.length} nouveau{newEntries.length > 1 ? 'x' : ''}
              </span>
            )}
            {mergeEntries.length > 0 && (
              <span className="px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full">
                {mergeEntries.length} mise{mergeEntries.length > 1 ? 's' : ''} à jour
              </span>
            )}
            {dupEntries.length > 0 && (
              <span className="px-2.5 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full">
                {dupEntries.length} doublon{dupEntries.length > 1 ? 's' : ''} potentiel{dupEntries.length > 1 ? 's' : ''}
              </span>
            )}
            {entries.length === 0 && (
              <span className="text-slate-400 dark:text-zinc-500 text-sm">Aucun élève trouvé dans le fichier.</span>
            )}
          </div>

          {(newEntries.length > 0 || mergeEntries.length > 0) && (
            <div className="text-sm text-slate-500 dark:text-zinc-400 space-y-1">
              {mergeEntries.length > 0 && (
                <p>
                  {mergeEntries.length === 1
                    ? `1 élève avec le même identifiant sera mis à jour (les acquisitions importées s'ajouteront aux existantes).`
                    : `${mergeEntries.length} élèves avec le même identifiant seront mis à jour.`}
                </p>
              )}
              {newEntries.length > 0 && (
                <p>
                  {newEntries.length === 1
                    ? `1 nouvel élève sera ajouté.`
                    : `${newEntries.length} nouveaux élèves seront ajoutés.`}
                </p>
              )}
            </div>
          )}

          {dupEntries.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-amber-600 dark:text-amber-400 mb-2">
                Doublons potentiels — même nom et date de naissance, identifiant différent
              </p>
              <div className="space-y-2">
                {dupEntries.map(e => (
                  <div key={e.student.id} className="border border-slate-200 dark:border-zinc-600 rounded-lg p-3 bg-slate-50 dark:bg-zinc-700/50">
                    <p className="text-sm font-medium text-slate-700 dark:text-zinc-200 mb-2">
                      {e.student.firstName} {e.student.lastName}
                      <span className="ml-2 text-xs text-slate-400 dark:text-zinc-400 font-normal">
                        né(e) le {formatDob(e.student.dob)}
                      </span>
                    </p>
                    <div className="flex flex-wrap gap-4 text-sm">
                      {(['merge', 'add', 'skip'] as const).map(option => (
                        <label key={option} className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name={`dup-${e.student.id}`}
                            checked={dupDecisions[e.student.id] === option}
                            onChange={() => setDupDecisions(prev => ({ ...prev, [e.student.id]: option }))}
                          />
                          <span className="text-slate-600 dark:text-zinc-300">
                            {option === 'merge' ? 'Fusionner' : option === 'add' ? 'Ajouter comme nouvel élève' : 'Ignorer'}
                          </span>
                        </label>
                      ))}
                    </div>
                    {dupDecisions[e.student.id] === 'merge' && (
                      <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1.5">
                        Les acquisitions importées s'ajouteront à celles de l'élève existant.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {unmatchedSkillCount > 0 && (
            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-3 text-sm text-indigo-700 dark:text-indigo-300">
              <span className="font-semibold">{unmatchedSkillCount} compétence{unmatchedSkillCount > 1 ? 's' : ''} inconnue{unmatchedSkillCount > 1 ? 's' : ''}</span>
              {' '}{unmatchedSkillCount > 1 ? 'dans votre programme actuel seront ajoutées' : 'dans votre programme actuel sera ajoutée'} dans un nouveau programme{' '}
              <span className="font-semibold">"Compétences importées"</span>. Vous pourrez ensuite les déplacer ou les supprimer dans l'onglet Compétences.
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-200 dark:border-zinc-700 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleConfirm}
            disabled={entries.length === 0}
            className="px-5 py-2 text-sm font-semibold bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            Confirmer l'import
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudentImportModal;
