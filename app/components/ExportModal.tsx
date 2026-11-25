import React, { useState, useMemo } from 'react';
import { Student, Section } from '../types';
import { promoteSection, sectionNames } from '../utils';
import Tooltip from './Tooltip';
import useModalDismiss from '../hooks/useModalDismiss';
import { toast } from '../utils/toast';
import StoredImage from '../images/StoredImage';

interface ExportModalProps {
  students: Student[];
  onClose: () => void;
  onExport: (students: Student[]) => void;
}

const XMarkIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const UserIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path fillRule="evenodd" d="M18.685 19.097A9.723 9.723 0 0021.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 003.065 7.097A9.716 9.716 0 0012 21.75a9.716 9.716 0 006.685-2.653zm-12.54-1.285A7.486 7.486 0 0112 15a7.486 7.486 0 015.855 2.812A8.224 8.224 0 0112 20.25a8.224 8.224 0 01-5.855-2.438zM15.75 9a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" clipRule="evenodd" />
    </svg>
);

const ArrowUpCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm.53 5.47a.75.75 0 00-1.06 0l-3 3a.75.75 0 101.06 1.06l1.72-1.72v5.69a.75.75 0 001.5 0v-5.69l1.72 1.72a.75.75 0 101.06-1.06l-3-3z" clipRule="evenodd" />
  </svg>
);


const ExportModal: React.FC<ExportModalProps> = ({ students, onClose, onExport }) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(students.map(s => s.id)));
  const [promotedStudentIds, setPromotedStudentIds] = useState<Set<string>>(new Set());

  const handleToggleStudent = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
        // Si on désélectionne un élève, on annule aussi sa promotion
        setPromotedStudentIds(promotedPrev => {
            const newPromotedSet = new Set(promotedPrev);
            newPromotedSet.delete(id);
            return newPromotedSet;
        });
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleToggleAll = () => {
    if (selectedIds.size === students.length) {
      setSelectedIds(new Set());
      // Si on désélectionne tout, on annule toutes les promotions
      setPromotedStudentIds(new Set());
    } else {
      setSelectedIds(new Set(students.map(s => s.id)));
    }
  };

  const handleTogglePromotion = (studentId: string) => {
    setPromotedStudentIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(studentId)) {
            newSet.delete(studentId);
        } else {
            newSet.add(studentId);
        }
        return newSet;
    });
  };
  
  const handleTogglePromoteSelected = () => {
      setPromotedStudentIds(prevPromoted => {
          const newPromotedSet = new Set(prevPromoted);
          const selectedPromotable = students.filter(s => selectedIds.has(s.id) && s.section !== Section.GS);
          const allSelectedArePromoted = selectedPromotable.every(s => newPromotedSet.has(s.id));

          selectedPromotable.forEach(student => {
              if (allSelectedArePromoted) {
                  newPromotedSet.delete(student.id);
              } else {
                  newPromotedSet.add(student.id);
              }
          });
          return newPromotedSet;
      });
  };

  const sortedStudents = useMemo(() => 
    [...students].sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)),
    [students]
  );
  
  const handleExportClick = () => {
      if (selectedIds.size === 0) {
          toast.info("Veuillez sélectionner au moins un élève à exporter.");
          return;
      }
      
      const studentsToExport = students
        .filter(s => selectedIds.has(s.id))
        .map(student => {
            if (promotedStudentIds.has(student.id)) {
                const nextSection = promoteSection(student.section);
                if (nextSection) {
                    // Crée une copie de l'élève avec la section mise à jour
                    return { ...student, section: nextSection };
                }
            }
            // Retourne l'élève original si non promu
            return student;
        });

      onExport(studentsToExport);
  }

  const hasPromotableSelectedStudents = useMemo(() => {
    return students.some(s => selectedIds.has(s.id) && s.section !== Section.GS);
  }, [students, selectedIds]);

  const handleBackdropClick = useModalDismiss(onClose);

  return (
    <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4" aria-modal="true" role="dialog" onClick={handleBackdropClick}>
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <header className="p-6 border-b border-slate-200 dark:border-zinc-700 flex justify-between items-center flex-shrink-0">
            <h2 className="text-xl font-bold text-slate-800 dark:text-zinc-200">Exporter des élèves</h2>
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 rounded-full" aria-label="Fermer">
                <XMarkIcon className="w-6 h-6" />
            </button>
        </header>
        
        <div className="px-6 max-sm:px-3 py-4 flex-grow overflow-y-auto">
             <p className="text-sm text-slate-600 dark:text-zinc-300 mb-3">
               Crée un fichier <code>.eleves</code> (par exemple pour transmettre les élèves à l'enseignant(e) de l'année suivante).
               « Promouvoir » change la section <strong>dans le fichier exporté uniquement</strong> : votre classe n'est pas modifiée.
             </p>
             <div className="sticky top-0 bg-white dark:bg-zinc-800 py-2 border-b border-slate-200 dark:border-zinc-700">
                <label className="flex items-center space-x-3 cursor-pointer p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-700">
                  <input
                    type="checkbox"
                    className="h-5 w-5 rounded border-slate-300 dark:border-zinc-600 text-indigo-600 focus:ring-indigo-500 bg-white dark:bg-zinc-700"
                    checked={selectedIds.size === students.length && students.length > 0}
                    onChange={handleToggleAll}
                  />
                  <span className="font-semibold text-slate-700 dark:text-zinc-300">Tout sélectionner / désélectionner</span>
                </label>
             </div>
            <ul className="divide-y divide-slate-200 dark:divide-zinc-700">
                {sortedStudents.map(student => {
                    const nextSection = promoteSection(student.section);
                    const isPromoted = promotedStudentIds.has(student.id);
                    const isSelected = selectedIds.has(student.id);

                    let promoteButtonTitle = '';
                    if (!isSelected) {
                        promoteButtonTitle = "Sélectionnez l'élève pour le promouvoir";
                    } else if (!nextSection) {
                        promoteButtonTitle = "Élève déjà en Grande Section";
                    } else if (isPromoted) {
                        promoteButtonTitle = `Annuler la promotion en ${sectionNames[nextSection]}`;
                    } else {
                        promoteButtonTitle = `Marquer pour promotion en ${sectionNames[nextSection]}`;
                    }

                    return (
                        <li key={student.id} className={`flex items-center justify-between hover:bg-slate-50 dark:hover:bg-zinc-700/50 transition-opacity ${!isSelected ? 'opacity-50' : ''}`}>
                            <label className="flex items-center p-3 space-x-4 cursor-pointer flex-grow">
                                <input
                                    type="checkbox"
                                    className="h-5 w-5 rounded border-slate-300 dark:border-zinc-600 text-indigo-600 focus:ring-indigo-500 bg-white dark:bg-zinc-700 flex-shrink-0"
                                    checked={isSelected}
                                    onChange={() => handleToggleStudent(student.id)}
                                />
                                <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-zinc-600 flex-shrink-0 overflow-hidden flex items-center justify-center">
                                    {student.photo ? (
                                    <StoredImage src={student.photo} alt={`${student.firstName} ${student.lastName}`} className="w-full h-full object-cover" />
                                    ) : (
                                    <UserIcon className="w-7 h-7 text-slate-400 dark:text-zinc-500" />
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <span className="font-semibold text-slate-700 dark:text-zinc-200 block truncate">{`${student.firstName} ${student.lastName}`}</span>
                                    <span className="text-sm text-slate-500 dark:text-zinc-400">{sectionNames[student.section]}</span>
                                </div>
                            </label>
                            <div className="flex-shrink-0 flex justify-end pr-4 w-16">
                                <Tooltip content={promoteButtonTitle} position="top-center">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleTogglePromotion(student.id); }}
                                        disabled={!nextSection || !isSelected}
                                        className={`p-2 rounded-md transition-colors duration-150
                                            ${isPromoted
                                                ? 'bg-green-600 text-white hover:bg-green-700'
                                                : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800/60'
                                            }
                                            disabled:opacity-30 disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-zinc-700 disabled:text-slate-400 dark:disabled:text-zinc-500`}
                                    >
                                        <ArrowUpCircleIcon className="w-6 h-6" />
                                    </button>
                                </Tooltip>
                            </div>
                        </li>
                    )
                })}
            </ul>
        </div>

        <footer className="p-6 border-t border-slate-200 dark:border-zinc-700 flex justify-between items-center flex-shrink-0">
            <button
              type="button"
              onClick={handleTogglePromoteSelected}
              className="px-4 py-2 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded-md hover:bg-green-200 dark:hover:bg-green-800/60 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!hasPromotableSelectedStudents}
            >
              Promouvoir/Annuler la sélection
            </button>
            <div className="flex justify-end gap-4 max-sm:flex-wrap max-sm:gap-2">
                <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-md hover:bg-slate-200 dark:hover:bg-zinc-600 font-semibold"
                >
                Annuler
                </button>
                <button
                type="button"
                onClick={handleExportClick}
                className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-semibold disabled:bg-blue-300 dark:disabled:bg-blue-800"
                disabled={selectedIds.size === 0}
                >
                Exporter ({selectedIds.size})
                </button>
            </div>
        </footer>
      </div>
    </div>
  );
};

export default ExportModal;
