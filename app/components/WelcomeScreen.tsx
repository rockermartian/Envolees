import React from 'react';

interface WelcomeScreenProps {
  onNewFile: () => void;
  onOpenFile: () => void;
  onOpenLastFile?: () => void;
  lastFileName?: string | null;
  isLoading?: boolean;
}

const DocumentPlusIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
);

const FolderOpenIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0A2.25 2.25 0 013.75 7.5h16.5a2.25 2.25 0 012.25 2.25m-18.75 0h18.75" />
    </svg>
);

const ArrowPathIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
);

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onNewFile, onOpenFile, onOpenLastFile, lastFileName, isLoading = false }) => {
  return (
    <div className="h-full w-full bg-slate-100 dark:bg-zinc-900 flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-blue-600 dark:text-blue-400">Bienvenue sur Envolées</h1>
        <p className="mt-2 text-lg text-slate-600 dark:text-zinc-400">Votre outil de suivi des compétences en maternelle.</p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-6">
          <button
            onClick={onNewFile}
            disabled={isLoading}
            className="group flex flex-col items-center justify-center w-52 h-40 bg-white dark:bg-zinc-800 border-2 border-dashed border-slate-300 dark:border-zinc-600 rounded-xl hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <DocumentPlusIcon className="w-16 h-16 text-slate-400 dark:text-zinc-500 group-hover:text-blue-500 transition-colors" />
            <span className="mt-2 text-lg font-semibold text-slate-700 dark:text-zinc-200">Créer une nouvelle classe</span>
            <span className="text-sm text-slate-500 dark:text-zinc-400">Commencer avec un fichier vide.</span>
          </button>
          <button
            onClick={onOpenFile}
            disabled={isLoading}
            className="group flex flex-col items-center justify-center w-52 h-40 bg-white dark:bg-zinc-800 border-2 border-dashed border-slate-300 dark:border-zinc-600 rounded-xl hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FolderOpenIcon className="w-16 h-16 text-slate-400 dark:text-zinc-500 group-hover:text-blue-500 transition-colors" />
            <span className="mt-2 text-lg font-semibold text-slate-700 dark:text-zinc-200">Ouvrir une classe</span>
             <span className="text-sm text-slate-500 dark:text-zinc-400">Charger un fichier .envolees</span>
          </button>
          {onOpenLastFile && (
            <button
              onClick={onOpenLastFile}
              disabled={isLoading}
              className="group flex flex-col items-center justify-center w-52 h-40 bg-white dark:bg-zinc-800 border-2 border-dashed border-slate-300 dark:border-zinc-600 rounded-xl hover:border-emerald-500 dark:hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowPathIcon className="w-16 h-16 text-slate-400 dark:text-zinc-500 group-hover:text-emerald-500 transition-colors" />
              <span className="mt-2 text-lg font-semibold text-slate-700 dark:text-zinc-200">Reprendre la dernière session</span>
              {lastFileName && (
                <span className="text-sm text-slate-500 dark:text-zinc-400 truncate max-w-[11rem]">{lastFileName}</span>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
