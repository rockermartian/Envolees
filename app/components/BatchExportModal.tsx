import React from 'react';

interface BatchExportModalProps {
  isOpen: boolean;
  current: number;
  total: number;
  studentName: string;
}

const SpinnerIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

const BatchExportModal: React.FC<BatchExportModalProps> = ({ isOpen, current, total, studentName }) => {
  if (!isOpen) return null;

  const progressPercentage = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-[100] p-4 print-hidden" aria-modal="true" role="dialog">
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-2xl w-full max-w-md p-8 text-center">
        <SpinnerIcon className="w-12 h-12 text-blue-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-800 dark:text-zinc-200">Exportation en cours...</h2>
        <p className="text-slate-600 dark:text-zinc-400 mt-2">Veuillez patienter pendant la génération des livrets.</p>
        
        <div className="mt-6">
            <div className="flex justify-between items-center text-sm text-slate-500 dark:text-zinc-500 mb-1">
                <span>{`Élève ${current} / ${total}`}</span>
                <span className="font-medium text-slate-700 dark:text-zinc-300 truncate max-w-[200px]">{studentName}</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-zinc-700 rounded-full h-2.5">
              <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${progressPercentage}%`, transition: 'width 0.2s ease-in-out' }}></div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default BatchExportModal;