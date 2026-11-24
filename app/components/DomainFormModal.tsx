import React, { useState, useEffect } from 'react';
import { Domain } from '../types';
import useModalDismiss from '../hooks/useModalDismiss';

const XMarkIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

interface DomainFormModalProps {
  title: string;
  domainToEdit?: Domain;
  onSave: (data: { name: string; expectations: string[] }) => void;
  onClose: () => void;
  saveText?: string;
  isSubDomain?: boolean;
}

const DomainFormModal: React.FC<DomainFormModalProps> = ({ title, domainToEdit, onSave, onClose, saveText = "Enregistrer", isSubDomain = false }) => {
  const [name, setName] = useState('');
  const [expectations, setExpectations] = useState('');

  useEffect(() => {
    if (domainToEdit) {
      setName(domainToEdit.name);
      if (!isSubDomain) {
        setExpectations((domainToEdit.expectations ?? []).join('\n'));
      } else {
        setExpectations(''); // Clear for sub-domains
      }
    } else {
      // For 'add' mode, reset fields
      setName('');
      setExpectations('');
    }
  }, [domainToEdit, isSubDomain]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      // Sous-domaine : les attendus ne sont pas éditables ici, mais ceux qui existent sont conservés (M4).
      const expectationsArray = isSubDomain
        ? (domainToEdit?.expectations ?? [])
        : expectations.split('\n').map(e => e.trim()).filter(Boolean);
      onSave({ name: name.trim(), expectations: expectationsArray });
    }
  };

  // Valeurs initiales (mêmes règles que le useEffect ci-dessus) pour détecter les saisies en cours.
  const initialName = domainToEdit?.name ?? '';
  const initialExpectations = domainToEdit && !isSubDomain ? (domainToEdit.expectations ?? []).join('\n') : '';
  const isDirty = name !== initialName || expectations !== initialExpectations;
  const handleBackdropClick = useModalDismiss(onClose, true, !isDirty);

  return (
    <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4" role="dialog" aria-modal="true" onClick={handleBackdropClick}>
      <form onSubmit={handleSubmit} className="bg-white dark:bg-zinc-800 rounded-xl shadow-2xl w-full max-w-2xl p-8 relative">
        <button type="button" onClick={onClose} aria-label="Fermer" className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300">
          <XMarkIcon className="w-6 h-6" />
        </button>
        <h2 className="text-xl font-bold text-slate-800 dark:text-zinc-200 mb-6">{title}</h2>
        <div className="space-y-6">
            <div>
              <label htmlFor="domain-name" className="block text-sm font-medium text-slate-700 dark:text-zinc-300">
                {isSubDomain ? 'Nom du sous-domaine' : 'Nom du domaine'}
              </label>
              <input
                type="text"
                id="domain-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full px-3 py-2 bg-white dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600 rounded-md shadow-sm placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-slate-900 dark:text-zinc-200"
                required
                autoFocus
              />
            </div>

            {!isSubDomain && (
              <div>
                <label htmlFor="domain-expectations" className="block text-sm font-medium text-slate-700 dark:text-zinc-300">Attendus de fin de maternelle</label>
                <textarea
                  id="domain-expectations"
                  value={expectations}
                  onChange={(e) => setExpectations(e.target.value)}
                  rows={8}
                  className="mt-1 block w-full px-3 py-2 bg-white dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600 rounded-md shadow-sm placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-slate-900 dark:text-zinc-200"
                  placeholder="Entrez un attendu par ligne..."
                />
              </div>
            )}
        </div>
        <div className="flex justify-end gap-4 pt-8">
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

export default DomainFormModal;