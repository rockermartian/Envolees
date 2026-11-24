
import React from 'react';
import useModalDismiss from '../hooks/useModalDismiss';

interface ExitModalProps {
  isOpen: boolean;
  onSaveAndQuit: () => void;
  onQuitWithoutSaving: () => void;
  onCancel: () => void;
  isSaving: boolean;
}

const ExitModal: React.FC<ExitModalProps> = ({ isOpen, onSaveAndQuit, onQuitWithoutSaving, onCancel, isSaving }) => {
  // Fermeture désactivée pendant la sauvegarde pour ne pas interrompre l'écriture du fichier.
  const handleBackdropClick = useModalDismiss(onCancel, isOpen && !isSaving);
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-[300] p-4 animate-in fade-in duration-200" role="dialog" aria-modal="true" onClick={handleBackdropClick}>
      <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl w-full max-w-md p-8 text-center border border-slate-200 dark:border-zinc-700">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-zinc-200 mb-2">Voulez-vous quitter ?</h2>
        <p className="text-slate-600 dark:text-zinc-400 mb-8">
          Vous avez des modifications non enregistrées. Si vous quittez maintenant sans sauvegarder, ces changements seront perdus.
        </p>
        
        <div className="flex flex-col gap-3">
          <button
            onClick={onSaveAndQuit}
            disabled={isSaving}
            className="w-full px-4 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 font-semibold shadow-md transition-all active:scale-[0.98] flex justify-center items-center gap-2"
          >
            {isSaving ? (
                <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Sauvegarde en cours...
                </>
            ) : "Sauvegarder et Quitter"}
          </button>
          
          <button
            onClick={onQuitWithoutSaving}
            disabled={isSaving}
            className="w-full px-4 py-3 bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 text-white rounded-xl font-semibold transition-colors"
          >
            Quitter sans sauvegarder
          </button>

          <button
            onClick={onCancel}
            disabled={isSaving}
            className="w-full px-4 py-3 text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 font-medium transition-colors mt-2"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExitModal;
