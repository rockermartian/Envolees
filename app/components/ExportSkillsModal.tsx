import React, { useMemo } from 'react';
import { SchoolProgram, Domain } from '../types';
import useModalDismiss from '../hooks/useModalDismiss';

interface ExportProgramsModalProps {
  programsToExport: SchoolProgram[];
  onClose: () => void;
  onExport: () => void;
}

const XMarkIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const ExportProgramsModal: React.FC<ExportProgramsModalProps> = ({ programsToExport, onClose, onExport }) => {
  const counts = useMemo(() => {
    let programCount = programsToExport.length;
    let domainCount = 0;
    let skillCount = 0;
    const recurse = (domains: Domain[]) => {
      domainCount += domains.length;
      for (const domain of domains) {
        skillCount += domain.skills.length;
        if (domain.subDomains) {
          recurse(domain.subDomains);
        }
      }
    };
    programsToExport.forEach(p => recurse(p.domains))
    return { programCount, domainCount, skillCount };
  }, [programsToExport]);

  const handleBackdropClick = useModalDismiss(onClose);

  return (
    <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4" aria-modal="true" role="dialog" onClick={handleBackdropClick}>
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-2xl w-full max-w-md">
        <header className="p-6 border-b border-slate-200 dark:border-zinc-700 flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-800 dark:text-zinc-200">Confirmer l'exportation</h2>
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 rounded-full" aria-label="Fermer">
                <XMarkIcon className="w-6 h-6" />
            </button>
        </header>
        
        <div className="p-6">
            <p className="text-slate-600 dark:text-zinc-300">Vous êtes sur le point d'exporter les éléments sélectionnés dans un fichier <code className="bg-slate-100 dark:bg-zinc-700 px-1 py-0.5 rounded-md text-sm">programmes-competences.competences</code> :</p>
            <ul className="list-disc list-inside mt-4 space-y-2 text-slate-800 dark:text-zinc-200">
                <li><span className="font-bold">{counts.programCount}</span> {counts.programCount > 1 ? 'programmes' : 'programme'}</li>
                <li><span className="font-bold">{counts.domainCount}</span> {counts.domainCount > 1 ? 'domaines' : 'domaine'}</li>
                <li><span className="font-bold">{counts.skillCount}</span> {counts.skillCount > 1 ? 'compétences' : 'compétence'}</li>
            </ul>
        </div>

        <footer className="p-6 border-t border-slate-200 dark:border-zinc-700 flex justify-end gap-4">
            <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-md hover:bg-slate-200 dark:hover:bg-zinc-600 font-semibold"
            >
            Annuler
            </button>
            <button
            type="button"
            onClick={onExport}
            className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-semibold"
            >
            Exporter
            </button>
        </footer>
      </div>
    </div>
  );
};

export default ExportProgramsModal;