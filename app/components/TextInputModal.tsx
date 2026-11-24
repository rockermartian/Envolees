import React, { useState, useEffect } from 'react';
import useModalDismiss from '../hooks/useModalDismiss';

const XMarkIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

interface TextInputModalProps {
  title: string;
  label: string;
  initialValue?: string;
  onSave: (value: string) => void;
  onClose: () => void;
  saveText?: string;
}

const TextInputModal: React.FC<TextInputModalProps> = ({ title, label, initialValue = '', onSave, onClose, saveText = "Enregistrer" }) => {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSave(value.trim());
    }
  };

  // Clic fond neutralisé dès que la saisie diffère de la valeur initiale (perte accidentelle).
  const isDirty = value !== initialValue;
  const handleBackdropClick = useModalDismiss(onClose, true, !isDirty);

  return (
    <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4" role="dialog" aria-modal="true" onClick={handleBackdropClick}>
      <form onSubmit={handleSubmit} className="bg-white dark:bg-zinc-800 rounded-xl shadow-2xl w-full max-w-md p-8 relative">
        <button type="button" onClick={onClose} aria-label="Fermer" className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300">
          <XMarkIcon className="w-6 h-6" />
        </button>
        <h2 className="text-xl font-bold text-slate-800 dark:text-zinc-200 mb-6">{title}</h2>
        <div>
          <label htmlFor="text-input" className="block text-sm font-medium text-slate-700 dark:text-zinc-300">{label}</label>
          <input
            type="text"
            id="text-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="mt-1 block w-full px-3 py-2 bg-white dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600 rounded-md shadow-sm placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-slate-900 dark:text-zinc-200"
            required
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-4 pt-6">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-md hover:bg-slate-200 dark:hover:bg-zinc-600 font-semibold">
            Annuler
          </button>
          <button type="submit" className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-semibold">
            {saveText}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TextInputModal;