import React, { useState, useMemo } from 'react';
import { Student, Section } from '../types';
import { promoteSection, sectionNames, sectionOrder } from '../utils';
import useModalDismiss from '../hooks/useModalDismiss';

interface PromoteModalProps {
  students: Student[];
  onClose: () => void;
  onPromote: (studentIds: string[]) => void;
}

const XMarkIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const AcademicCapIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M11.7 2.805a.75.75 0 01.6 0A60.65 60.65 0 0122.83 8.72a.75.75 0 01-.231 1.337 49.949 49.949 0 00-9.902 3.912l-.003.002-.34.18a.75.75 0 01-.707 0A50.009 50.009 0 007.5 12.174v-.224c0-.131.067-.248.172-.311a54.614 54.614 0 014.653-2.52.75.75 0 00-.65-1.352 56.129 56.129 0 00-4.78 2.589 1.858 1.858 0 00-.859 1.228 49.803 49.803 0 00-4.634-1.527.75.75 0 01-.231-1.337A60.653 60.653 0 0111.7 2.805z" />
    <path d="M13.06 15.473a48.45 48.45 0 017.666-3.282c.134 1.414.22 2.843.255 4.285a.75.75 0 01-.46.71 47.878 47.878 0 00-8.105 4.342.75.75 0 01-.832 0 47.877 47.877 0 00-8.104-4.342.75.75 0 01-.461-.71c.035-1.442.121-2.87.255-4.286A48.4 48.4 0 016 13.18v1.27a1.5 1.5 0 00-.14 2.508c-.09.38-.222.753-.397 1.11.452.213.901.434 1.346.661a6.729 6.729 0 00.551-1.608 1.5 1.5 0 00.14-2.67v-.645a48.549 48.549 0 013.44 1.668 2.25 2.25 0 002.12 0z" />
    <path d="M4.462 19.462c.42-.419.753-.89 1-1.394.453.213.902.434 1.347.661a6.743 6.743 0 01-1.286 1.794.75.75 0 11-1.06-1.06z" />
  </svg>
);

const PromoteModal: React.FC<PromoteModalProps> = ({ students, onClose, onPromote }) => {
  const promotableStudents = useMemo(
    () => students.filter(s => promoteSection(s.section) !== null),
    [students]
  );

  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(promotableStudents.map(s => s.id))
  );

  const allSelected = selectedIds.size === promotableStudents.length && promotableStudents.length > 0;

  const handleToggle = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleToggleAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(promotableStudents.map(s => s.id)));
  };

  const sortedStudents = useMemo(
    () => [...students].sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)),
    [students]
  );

  const groupedBySection = useMemo(() =>
    sectionOrder
      .map(section => ({ section, students: sortedStudents.filter(s => s.section === section) }))
      .filter(g => g.students.length > 0),
    [sortedStudents]
  );

  const handleConfirm = () => {
    if (selectedIds.size === 0) return;
    onPromote(Array.from(selectedIds));
    onClose();
  };

  const handleBackdropClick = useModalDismiss(onClose);

  return (
    <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4" aria-modal="true" role="dialog" onClick={handleBackdropClick}>
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">

        <header className="p-6 border-b border-slate-200 dark:border-zinc-700 flex justify-between items-center flex-shrink-0">
          <h2 className="text-xl font-bold text-slate-800 dark:text-zinc-200">Promouvoir les élèves</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 rounded-full" aria-label="Fermer">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </header>

        <div className="px-6 py-3 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-800 flex-shrink-0">
          <p className="text-sm text-indigo-700 dark:text-indigo-300">
            Fait passer les élèves sélectionnés à la section suivante. Les élèves en Grande Section ne peuvent pas être promus (ils passent en CP).
          </p>
        </div>

        <div className="px-6 py-4 flex-grow overflow-y-auto">
          {promotableStudents.length > 0 && (
            <div className="sticky top-0 bg-white dark:bg-zinc-800 pb-2 border-b border-slate-200 dark:border-zinc-700 mb-2">
              <label className="flex items-center space-x-3 cursor-pointer p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-700">
                <input
                  type="checkbox"
                  className="h-5 w-5 rounded border-slate-300 dark:border-zinc-600 text-indigo-600 focus:ring-indigo-500 bg-white dark:bg-zinc-700"
                  checked={allSelected}
                  onChange={handleToggleAll}
                />
                <span className="font-semibold text-slate-700 dark:text-zinc-300">Tout sélectionner / désélectionner</span>
              </label>
            </div>
          )}

          {groupedBySection.map(({ section, students: sectionStudents }) => {
            const nextSection = promoteSection(section);
            const isGS = section === Section.GS;
            return (
              <div key={section} className="mb-4">
                <div className="flex items-center gap-2 px-1 mb-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    {sectionNames[section]}
                  </span>
                  {!isGS && (
                    <>
                      <span className="text-xs text-slate-400 dark:text-zinc-500">→</span>
                      <span className="text-xs font-bold uppercase tracking-wider text-indigo-500 dark:text-indigo-400">
                        {sectionNames[nextSection!]}
                      </span>
                    </>
                  )}
                  {isGS && (
                    <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
                      Passent en CP
                    </span>
                  )}
                </div>
                <ul className="divide-y divide-slate-100 dark:divide-zinc-700/50">
                  {sectionStudents.map(student => (
                    <li key={student.id}>
                      {isGS ? (
                        <div className="flex items-center p-3 space-x-4 opacity-40 cursor-not-allowed select-none">
                          <div className="h-5 w-5 rounded border-2 border-slate-300 dark:border-zinc-600 flex-shrink-0" />
                          <span className="text-slate-700 dark:text-zinc-300">{student.lastName} {student.firstName}</span>
                        </div>
                      ) : (
                        <label className="flex items-center p-3 space-x-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-700/50 rounded-lg">
                          <input
                            type="checkbox"
                            className="h-5 w-5 rounded border-slate-300 dark:border-zinc-600 text-indigo-600 focus:ring-indigo-500 bg-white dark:bg-zinc-700 flex-shrink-0"
                            checked={selectedIds.has(student.id)}
                            onChange={() => handleToggle(student.id)}
                          />
                          <span className="text-slate-700 dark:text-zinc-300">{student.lastName} {student.firstName}</span>
                        </label>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}

          {students.length === 0 && (
            <p className="text-center text-slate-500 dark:text-zinc-400 py-8">Aucun élève dans la classe.</p>
          )}
        </div>

        <footer className="p-6 border-t border-slate-200 dark:border-zinc-700 flex justify-end items-center gap-4 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-600 font-semibold"
          >
            Annuler
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedIds.size === 0}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <AcademicCapIcon className="w-5 h-5" />
            Promouvoir ({selectedIds.size} élève{selectedIds.size > 1 ? 's' : ''})
          </button>
        </footer>

      </div>
    </div>
  );
};

export default PromoteModal;
