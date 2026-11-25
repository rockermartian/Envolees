import React, { useState, useMemo } from 'react';
import { Student, Section, SchoolProgram, Proficiency } from '../types';
import { calculateAge, getAgeColorClasses, sectionNames } from '../utils';
import Tooltip from './Tooltip';
import StoredImage from '../images/StoredImage';
import { needLabel, openTodoCount } from '../domain/notes';


interface StudentListProps {
  students: Student[];
  selectedStudentId: string | null;
  schoolPrograms: SchoolProgram[];
  highlightedSkillId: string | null;
  onSelectStudent: (id: string) => void;
  onAddStudent: () => void;
  onEditStudent: (id: string) => void;
  onDeleteStudent: (id: string) => void;
  onImportStudents: () => void;
  onExportStudents: () => void;
  viewMode?: 'class' | 'livret';
  onToggleLivretProcessed?: (id: string) => void;
  onToggleAllLivretProcessed?: () => void;
  onOpenMassValidation?: () => void;
  onPromoteStudents?: () => void;
  /** Téléphone : ouvre la synthèse de la classe (sur grand écran, elle s'affiche à côté de la liste). */
  onShowSynthesis?: () => void;
}

const CheckCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
    </svg>
);

const PlusIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
        <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
    </svg>
);

const UserIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path fillRule="evenodd" d="M18.685 19.097A9.723 9.723 0 0021.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 003.065 7.097A9.716 9.716 0 0012 21.75a9.716 9.716 0 006.685-2.653zm-12.54-1.285A7.486 7.486 0 0112 15a7.486 7.486 0 015.855 2.812A8.224 8.224 0 0112 20.25a8.224 8.224 0 01-5.855-2.438zM15.75 9a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" clipRule="evenodd" />
    </svg>
);

const ChevronIcon: React.FC<{ className?: string; isCollapsed: boolean }> = ({ className, isCollapsed }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`${className} transition-transform duration-200 ${isCollapsed ? '-rotate-90' : 'rotate-0'}`}>
        <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z" clipRule="evenodd" />
    </svg>
);

const TrashIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
        <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.58.22-2.365.468a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193v-.443A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
    </svg>
);

const PencilIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
    <path d="m2.695 14.762-1.262 3.155a.5.5 0 0 0 .65.65l3.155-1.262a4 4 0 0 0 1.343-.885L17.5 5.5a2.121 2.121 0 0 0-3-3L3.58 13.42a4 4 0 0 0-.885 1.343Z" />
  </svg>
);

const ImportIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>);
const ExportIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" /></svg>);
const BoltIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}><path d="M11.983 1.907a.75.75 0 00-1.292-.657l-8.5 9.5A.75.75 0 002.75 12h6.572l-1.305 6.093a.75.75 0 001.292.657l8.5-9.5A.75.75 0 0017.25 8h-6.572l1.305-6.093z" /></svg>);
const AcademicCapIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M11.7 2.805a.75.75 0 01.6 0A60.65 60.65 0 0122.83 8.72a.75.75 0 01-.231 1.337 49.949 49.949 0 00-9.902 3.912l-.003.002-.34.18a.75.75 0 01-.707 0A50.009 50.009 0 007.5 12.174v-.224c0-.131.067-.248.172-.311a54.614 54.614 0 014.653-2.52.75.75 0 00-.65-1.352 56.129 56.129 0 00-4.78 2.589 1.858 1.858 0 00-.859 1.228 49.803 49.803 0 00-4.634-1.527.75.75 0 01-.231-1.337A60.653 60.653 0 0111.7 2.805z" /><path d="M13.06 15.473a48.45 48.45 0 017.666-3.282c.134 1.414.22 2.843.255 4.285a.75.75 0 01-.46.71 47.878 47.878 0 00-8.105 4.342.75.75 0 01-.832 0 47.877 47.877 0 00-8.104-4.342.75.75 0 01-.461-.71c.035-1.442.121-2.87.255-4.286A48.4 48.4 0 016 13.18v1.27a1.5 1.5 0 00-.14 2.508c-.09.38-.222.753-.397 1.11.452.213.901.434 1.346.661a6.729 6.729 0 00.551-1.608 1.5 1.5 0 00.14-2.67v-.645a48.549 48.549 0 013.44 1.668 2.25 2.25 0 002.12 0z" /><path d="M4.462 19.462c.42-.419.753-.89 1-1.394.453.213.902.434 1.347.661a6.743 6.743 0 01-1.286 1.794.75.75 0 11-1.06-1.06z" /></svg>);

const StudentList: React.FC<StudentListProps> = ({ students, selectedStudentId, schoolPrograms, highlightedSkillId, onSelectStudent, onAddStudent, onEditStudent, onDeleteStudent, onImportStudents, onExportStudents, viewMode = 'class', onToggleLivretProcessed, onToggleAllLivretProcessed, onOpenMassValidation, onPromoteStudents, onShowSynthesis }) => {
  const [collapsedSections, setCollapsedSections] = useState<Set<Section>>(new Set());



  const toggleSection = (section: Section) => {
    setCollapsedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };
  
  const handleEdit = (studentId: string) => {
      onEditStudent(studentId);
  };

  const sortedStudents = useMemo(() => 
    [...students].sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)),
    [students]
  );

  const groupedStudents = useMemo(() => 
    sortedStudents.reduce((acc, student) => {
        const section = student.section;
        if (!acc[section]) {
            acc[section] = [];
        }
        acc[section].push(student);
        return acc;
    }, {} as Record<Section, Student[]>),
    [sortedStudents]
  );

  const sectionOrder = [Section.TPS, Section.PS, Section.MS, Section.GS];

  const getStudentRowClass = (student: Student) => {
    if (highlightedSkillId) {
      const skillDetails = student.skills[highlightedSkillId];
      if (skillDetails?.proficiency === Proficiency.Acquired) {
        return 'bg-green-100 dark:bg-green-900/50 hover:bg-green-200 dark:hover:bg-green-800/60';
      }
      return 'bg-red-100 dark:bg-red-900/50 hover:bg-red-200 dark:hover:bg-red-800/60';
    }
    if (selectedStudentId === student.id) {
      return 'bg-blue-100 dark:bg-blue-900/60';
    }
    return 'hover:bg-slate-100 dark:hover:bg-zinc-700/50';
  };

  const areAllStudentsProcessed = useMemo(() => 
    viewMode === 'livret' && students.length > 0 && students.every(s => s.livretProcessed),
    [students, viewMode]
  );

  return (
    <div className="bg-slate-50 dark:bg-zinc-800 border-r border-slate-200 dark:border-zinc-700 h-full flex flex-col">
      <div className="p-3 border-b border-slate-200 dark:border-zinc-700 flex justify-between items-center flex-shrink-0 gap-2">
        <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-800 dark:text-zinc-200">Élèves</h2>
            {viewMode === 'livret' && onToggleAllLivretProcessed && students.length > 0 && (
                <Tooltip content={areAllStudentsProcessed ? "Dévalider tous les élèves" : "Valider tous les élèves"} position="bottom-center">
                    <button
                        onClick={onToggleAllLivretProcessed}
                        className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-zinc-700"
                    >
                        <CheckCircleIcon className={`w-5 h-5 transition-colors ${areAllStudentsProcessed ? 'text-green-500' : 'text-slate-400 dark:text-zinc-500'}`} />
                    </button>
                </Tooltip>
            )}
        </div>
        {viewMode === 'class' && (
            <div className="flex items-center gap-2">
                {onOpenMassValidation && students.length > 0 && (
                    <Tooltip content="Valider en masse" position="bottom-center">
                        <button
                            onClick={onOpenMassValidation}
                            className="p-2 rounded-md text-amber-600 dark:text-amber-400 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 transition-colors"
                        >
                            <BoltIcon className="w-5 h-5" />
                        </button>
                    </Tooltip>
                )}
                {onPromoteStudents && students.length > 0 && (
                    <Tooltip content="Promouvoir les élèves à la section suivante" position="bottom-center">
                        <button
                            onClick={onPromoteStudents}
                            className="p-2 rounded-md text-indigo-600 dark:text-indigo-400 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 transition-colors"
                        >
                            <AcademicCapIcon className="w-5 h-5" />
                        </button>
                    </Tooltip>
                )}
                <Tooltip content="Importer des élèves" position="bottom-center">
                    <button onClick={onImportStudents} className="p-2 rounded-md text-slate-600 dark:text-zinc-300 bg-slate-200 hover:bg-slate-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 transition-colors">
                        <ImportIcon className="w-5 h-5" />
                    </button>
                </Tooltip>
                <Tooltip content="Exporter les élèves (sélectionnés ou tous)" position="bottom-center">
                    <button onClick={onExportStudents} className="p-2 rounded-md text-slate-600 dark:text-zinc-300 bg-slate-200 hover:bg-slate-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 transition-colors">
                        <ExportIcon className="w-5 h-5" />
                    </button>
                </Tooltip>
                <Tooltip content="Ajouter un élève" position="bottom-center">
                    <button onClick={onAddStudent} className="p-2 rounded-md text-slate-600 dark:text-zinc-300 bg-slate-200 hover:bg-slate-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 transition-colors">
                        <PlusIcon className="w-5 h-5" />
                    </button>
                </Tooltip>
            </div>
        )}
      </div>
      {onShowSynthesis && students.length > 0 && (
        <button
          onClick={onShowSynthesis}
          className="sm:hidden flex-shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 dark:border-zinc-700 text-sm font-semibold text-blue-600 dark:text-blue-400 bg-white dark:bg-zinc-800"
        >
          <span>Synthèse de la classe</span>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" aria-hidden="true"><path fillRule="evenodd" d="M8.22 5.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 010-1.06z" clipRule="evenodd" /></svg>
        </button>
      )}
      <div className="flex-grow overflow-y-auto">
        {students.length === 0 ? (
          <div className="text-center p-8 text-slate-500 dark:text-zinc-400">
            <p>Aucun élève trouvé.</p>
            {viewMode === 'class' && (
              <p>Cliquez sur le '+' pour commencer.</p>
            )}
          </div>
        ) : (
          <ul>
             {sectionOrder.map(section => {
                if (!groupedStudents[section]) return null;
                const isCollapsed = collapsedSections.has(section);
                return (
                    <li key={section}>
                        <button
                          onClick={() => toggleSection(section)}
                          className="w-full flex justify-between items-center p-2 text-sm font-bold bg-slate-200 dark:bg-zinc-700/50 text-slate-600 dark:text-zinc-300 sticky top-0 z-10 hover:bg-slate-300 dark:hover:bg-zinc-700 transition-colors"
                          aria-expanded={!isCollapsed}
                        >
                          <span>{sectionNames[section]}</span>
                          <ChevronIcon className="w-5 h-5 text-slate-500 dark:text-zinc-400" isCollapsed={isCollapsed} />
                        </button>
                        {!isCollapsed && (
                          <ul>
                              {groupedStudents[section].map((student) => {
                                  const age = calculateAge(student.dob);
                                  return (
                                  <li key={student.id}>
                                      <div
                                        className={`group w-full text-left flex items-center justify-between gap-3 transition-colors duration-150 ${viewMode === 'class' ? `border-l-4 ${getAgeColorClasses(age)}` : ''} ${getStudentRowClass(student)} rounded-sm focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 dark:focus-within:ring-offset-zinc-800 ${viewMode === 'livret' ? 'p-2' : 'p-3'}`}
                                      >
                                        <div className="flex items-center gap-3 flex-grow min-w-0">
                                            {viewMode === 'livret' && onToggleLivretProcessed && (
                                                <button
                                                    onClick={() => onToggleLivretProcessed(student.id)}
                                                    className="flex-shrink-0 p-0 rounded-full hover:bg-slate-200 dark:hover:bg-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-800"
                                                    aria-label={`Marquer ${student.firstName} ${student.lastName} comme traité`}
                                                >
                                                    <CheckCircleIcon
                                                        className={`w-6 h-6 transition-colors ${
                                                            student.livretProcessed ? 'text-green-500' : 'text-slate-300 dark:text-zinc-500'
                                                        }`}
                                                    />
                                                </button>
                                            )}
                                            <div
                                                onClick={() => onSelectStudent(student.id)}
                                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectStudent(student.id); } }}
                                                role="button"
                                                tabIndex={0}
                                                className="flex items-center gap-3 flex-grow min-w-0 cursor-pointer focus:outline-none"
                                            >
                                                <div className={`rounded-full bg-slate-200 dark:bg-zinc-600 flex-shrink-0 overflow-hidden flex items-center justify-center ${viewMode === 'livret' ? 'w-8 h-8' : 'w-10 h-10'}`}>
                                                    {student.photo ? (
                                                    <StoredImage src={student.photo} alt={`${student.firstName} ${student.lastName}`} className="w-full h-full object-cover" />
                                                    ) : (
                                                    <UserIcon className={`text-slate-400 dark:text-zinc-500 ${viewMode === 'livret' ? 'w-6 h-6' : 'w-7 h-7'}`} />
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <span className={`font-semibold text-slate-700 dark:text-zinc-200 block truncate ${viewMode === 'livret' ? 'text-sm' : ''}`}>{`${student.firstName} ${student.lastName}`}</span>
                                                    {viewMode === 'class' && (
                                                        <div className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                                                            {age} ans
                                                            {(student.needs ?? []).length > 0 && (
                                                                <span className="text-amber-700 dark:text-amber-400"> · {(student.needs ?? []).map(needLabel).join(' · ')}</span>
                                                            )}
                                                            {openTodoCount(student) > 0 && (
                                                                <span className="text-red-600 dark:text-red-400 font-medium"> · ⚑ {openTodoCount(student)} à faire</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                      
                                        {viewMode === 'class' && (
                                            <div className="flex items-center flex-shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100 transition-opacity focus-within:opacity-100">
                                                <button 
                                                    onClick={() => handleEdit(student.id)} 
                                                    className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-zinc-600 text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200"
                                                    aria-label={`Modifier ${student.firstName} ${student.lastName}`}
                                                >
                                                    <PencilIcon className="w-5 h-5" />
                                                </button>
                                                <button 
                                                    onClick={() => onDeleteStudent(student.id)} 
                                                    className="p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/40 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                                    aria-label={`Supprimer ${student.firstName} ${student.lastName}`}
                                                >
                                                    <TrashIcon className="w-5 h-5" />
                                                </button>
                                            </div>
                                        )}
                                      </div>
                                  </li>
                                  )
                              })}
                          </ul>
                        )}
                    </li>
                )
             })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default StudentList;