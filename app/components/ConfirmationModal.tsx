import React from 'react';
import useModalDismiss from '../hooks/useModalDismiss';

interface ConfirmationModalProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  /** 'danger' (rouge, défaut) pour les actions destructives ; 'primary' (bleu) pour les confirmations bénignes. */
  variant?: 'danger' | 'primary';
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ title, message, onConfirm, onCancel, confirmText = "Confirmer", cancelText = "Annuler", variant = 'danger' }) => {
  const handleBackdropClick = useModalDismiss(onCancel);

  const confirmClass = variant === 'danger'
    ? 'bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700'
    : 'bg-blue-500 hover:bg-blue-600';

  return (
    <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4" role="dialog" aria-modal="true" onClick={handleBackdropClick}>
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-2xl w-full max-w-sm p-6 text-left">
        <h3 className="text-lg font-bold text-slate-800 dark:text-zinc-200">{title}</h3>
        <p className="text-sm text-slate-600 dark:text-zinc-400 mt-2">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-md hover:bg-slate-200 dark:hover:bg-zinc-600 font-semibold">
            {cancelText}
          </button>
          <button onClick={onConfirm} className={`px-4 py-2 text-white rounded-md font-semibold ${confirmClass}`}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
