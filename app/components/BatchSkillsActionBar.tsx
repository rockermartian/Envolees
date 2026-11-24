import React from 'react';

interface BatchSkillsActionBarProps {
  count: number;
  onClear: () => void;
  onDelete: () => void;
  onMove: () => void;
}

const TrashIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
    <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.58.22-2.365.468a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193v-.443A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
  </svg>
);

const FolderArrowDownIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
    <path fillRule="evenodd" d="M10 9a.75.75 0 01.75.75v2.69l1.22-1.22a.75.75 0 111.06 1.06l-2.5 2.5a.75.75 0 01-1.06 0l-2.5-2.5a.75.75 0 111.06-1.06l1.22 1.22V9.75A.75.75 0 0110 9z" clipRule="evenodd" />
  </svg>
);

const BatchSkillsActionBar: React.FC<BatchSkillsActionBarProps> = ({ count, onClear, onDelete, onMove }) => {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-auto max-w-[90%] z-40 bg-white dark:bg-zinc-800 shadow-2xl rounded-xl border border-slate-200 dark:border-zinc-700 flex items-center gap-2 p-3 animate-fade-in-up print-hidden">
      <span className="text-sm font-semibold text-slate-700 dark:text-zinc-300 px-2 border-r border-slate-200 dark:border-zinc-600 mr-1">
        {count} sélectionné{count > 1 ? 's' : ''}
      </span>
      <button
        onClick={onClear}
        className="px-3 py-2 bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-md hover:bg-slate-200 dark:hover:bg-zinc-600 font-semibold text-sm"
      >
        Annuler
      </button>
      <button
        onClick={onMove}
        className="px-3 py-2 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-800/60 font-semibold text-sm flex items-center gap-2"
      >
        <FolderArrowDownIcon className="w-5 h-5" />
        Déplacer
      </button>
      <button
        onClick={onDelete}
        className="px-3 py-2 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded-md hover:bg-red-200 dark:hover:bg-red-800/60 font-semibold text-sm flex items-center gap-2"
      >
        <TrashIcon className="w-5 h-5" />
        Supprimer
      </button>
      <style>{`
        @keyframes fade-in-up {
            from { opacity: 0; transform: translate(-50%, 20px); }
            to { opacity: 1; transform: translate(-50%, 0); }
        }
        .animate-fade-in-up {
            animation: fade-in-up 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default BatchSkillsActionBar;