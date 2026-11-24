import React, { useState, useMemo } from 'react';
import { SchoolProgram, Domain } from '../types';
import { getDescendantIds } from '../utils';
import useModalDismiss from '../hooks/useModalDismiss';

interface MoveElementsModalProps {
  programs: SchoolProgram[];
  itemsToMove: { id: string; type: 'skill' | 'domain' }[];
  onMove: (targetId: string) => void;
  onClose: () => void;
}

const XMarkIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const FolderIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
  </svg>
);

const FolderOpenIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
        <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1H8a3 3 0 00-3 3v1.5a1.5 1.5 0 01-3 0V6z" clipRule="evenodd" />
        <path d="M6 12a2 2 0 012-2h8a2 2 0 012 2v2a2 2 0 01-2 2H2h2a2 2 0 002-2v-2z" />
    </svg>
);

const MoveElementsModal: React.FC<MoveElementsModalProps> = ({ programs, itemsToMove, onMove, onClose }) => {
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(programs.map(p => p.id)));

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Validation logic
  const isMoveValid = useMemo(() => {
      if (!selectedTargetId) return false;
      
      // Cannot move a skill to a program (must be a domain)
      const hasSkills = itemsToMove.some(i => i.type === 'skill');
      const isTargetProgram = programs.some(p => p.id === selectedTargetId);
      
      if (hasSkills && isTargetProgram) return false;

      return true;
  }, [selectedTargetId, itemsToMove, programs]);

  // Build a set of IDs that are invalid targets (self + descendants)
  const invalidTargetIds = useMemo(() => {
      const invalid = new Set<string>();
      itemsToMove.forEach(item => {
          invalid.add(item.id);
          if (item.type === 'domain') {
              // Find the domain object to get its descendants
              const findDomain = (domains: Domain[]): Domain | undefined => {
                  for (const d of domains) {
                      if (d.id === item.id) return d;
                      const found = findDomain(d.subDomains || []);
                      if (found) return found;
                  }
                  return undefined;
              };
              
              let domainObj: Domain | undefined;
              for (const p of programs) {
                  domainObj = findDomain(p.domains);
                  if (domainObj) break;
              }
              
              if (domainObj) {
                  const descendants = getDescendantIds(domainObj);
                  descendants.forEach(id => invalid.add(id));
              }
          }
      });
      return invalid;
  }, [itemsToMove, programs]);

  const renderDomainTree = (domain: Domain, level: number) => {
      const isExpanded = expandedIds.has(domain.id);
      const isInvalid = invalidTargetIds.has(domain.id);
      const isSelected = selectedTargetId === domain.id;

      return (
          <div key={domain.id} className="select-none">
              <div 
                  className={`flex items-center py-1 px-2 rounded cursor-pointer transition-colors ${
                      isSelected 
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' 
                          : isInvalid 
                              ? 'opacity-40 cursor-not-allowed' 
                              : 'hover:bg-slate-100 dark:hover:bg-zinc-700'
                  }`}
                  style={{ paddingLeft: `${level * 1.5 + 0.5}rem` }}
                  onClick={() => !isInvalid && setSelectedTargetId(domain.id)}
              >
                  <button 
                      onClick={(e) => { e.stopPropagation(); toggleExpand(domain.id); }} 
                      className="mr-1 text-slate-400 hover:text-slate-600 dark:text-zinc-500"
                  >
                      {domain.subDomains && domain.subDomains.length > 0 ? (
                           <span className="text-xs">{isExpanded ? '▼' : '▶'}</span>
                      ) : <span className="w-3 inline-block"/>}
                  </button>
                  
                  {isExpanded ? <FolderOpenIcon className="w-5 h-5 mr-2 text-yellow-500" /> : <FolderIcon className="w-5 h-5 mr-2 text-yellow-500" />}
                  <span className="truncate text-sm">{domain.name}</span>
              </div>
              {isExpanded && domain.subDomains && (
                  <div>
                      {domain.subDomains.map(sub => renderDomainTree(sub, level + 1))}
                  </div>
              )}
          </div>
      );
  };

  const hasSkillsToMove = itemsToMove.some(i => i.type === 'skill');

  const handleBackdropClick = useModalDismiss(onClose);

  return (
    <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-[100] p-4" aria-modal="true" role="dialog" onClick={handleBackdropClick}>
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[80vh]">
        <header className="p-4 border-b border-slate-200 dark:border-zinc-700 flex justify-between items-center flex-shrink-0">
            <h2 className="text-lg font-bold text-slate-800 dark:text-zinc-200">Déplacer {itemsToMove.length} élément(s)</h2>
            <button onClick={onClose} aria-label="Fermer" className="p-1 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 rounded-full">
                <XMarkIcon className="w-6 h-6" />
            </button>
        </header>

        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 text-sm text-blue-800 dark:text-blue-200 border-b border-blue-100 dark:border-blue-800 flex-shrink-0">
            Sélectionnez le dossier de destination.
            {hasSkillsToMove && <div className="font-medium mt-1">⚠️ Les compétences ne peuvent pas être déplacées à la racine d'un programme.</div>}
        </div>

        <div className="overflow-y-auto flex-grow p-2">
             {programs.map(program => {
                 const isProgramExpanded = expandedIds.has(program.id);
                 const isSelected = selectedTargetId === program.id;
                 const isProgramInvalid = hasSkillsToMove; // Cannot put skills directly in program

                 return (
                     <div key={program.id} className="mb-2">
                         <div 
                            className={`flex items-center py-1.5 px-2 rounded cursor-pointer transition-colors font-semibold text-slate-700 dark:text-zinc-200 ${
                                isSelected 
                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' 
                                    : isProgramInvalid
                                        ? 'opacity-50 cursor-not-allowed'
                                        : 'hover:bg-slate-100 dark:hover:bg-zinc-700'
                            }`}
                            onClick={() => !isProgramInvalid && setSelectedTargetId(program.id)}
                         >
                            <button 
                                onClick={(e) => { e.stopPropagation(); toggleExpand(program.id); }} 
                                className="mr-2 text-slate-400 hover:text-slate-600 dark:text-zinc-500"
                            >
                                <span className="text-xs">{isProgramExpanded ? '▼' : '▶'}</span>
                            </button>
                            <span>{program.name}</span>
                         </div>
                         {isProgramExpanded && (
                             <div className="ml-2 border-l border-slate-200 dark:border-zinc-700 pl-1">
                                 {program.domains.map(domain => renderDomainTree(domain, 0))}
                             </div>
                         )}
                     </div>
                 )
             })}
        </div>

        <footer className="p-4 border-t border-slate-200 dark:border-zinc-700 flex justify-end gap-3 flex-shrink-0">
            <button onClick={onClose} className="px-4 py-2 bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-md hover:bg-slate-200 dark:hover:bg-zinc-600 font-semibold">
                Annuler
            </button>
            <button 
                onClick={() => selectedTargetId && onMove(selectedTargetId)}
                disabled={!isMoveValid}
                className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Déplacer
            </button>
        </footer>
      </div>
    </div>
  );
};

export default MoveElementsModal;