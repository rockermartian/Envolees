import React, { useState } from 'react';
import useModalDismiss from '../hooks/useModalDismiss';
import { PIN_MAX_LENGTH, PIN_MIN_LENGTH, validateNewPin } from '../domain/studentMode';

interface PinSetupModalProps {
    title: string;
    description: string;
    confirmText: string;
    onConfirm: (pin: string) => void;
    onCancel: () => void;
}

/** Définition (ou modification) du code PIN enseignant du mode élève, avec confirmation. */
const PinSetupModal: React.FC<PinSetupModalProps> = ({ title, description, confirmText, onConfirm, onCancel }) => {
    const [pin, setPin] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [error, setError] = useState<string | null>(null);
    const handleBackdropClick = useModalDismiss(onCancel, true, false); // saisie en cours : pas de fermeture au clic sur le fond

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const problem = validateNewPin(pin, confirmation);
        if (problem) setError(problem);
        else onConfirm(pin);
    };

    const digitsOnly = (value: string) => value.replace(/\D/g, '').slice(0, PIN_MAX_LENGTH);
    const inputClass = 'w-full text-center text-2xl font-mono tracking-[0.4em] p-3 bg-slate-100 dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-blue-500';

    return (
        <div className="fixed inset-0 z-[70] bg-slate-900/70 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="pin-setup-title" onClick={handleBackdropClick}>
            <form onSubmit={submit} className="bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
                <h3 id="pin-setup-title" className="text-lg font-bold text-slate-800 dark:text-zinc-100">{title}</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-zinc-300">{description}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                    {PIN_MIN_LENGTH} à {PIN_MAX_LENGTH} chiffres ; évitez les codes évidents (0000, 1234…).
                </p>
                <label className="block mt-4 text-sm font-medium text-slate-700 dark:text-zinc-300">
                    Nouveau code
                    <input type="password" inputMode="numeric" autoComplete="off" autoFocus value={pin}
                        onChange={e => { setPin(digitsOnly(e.target.value)); setError(null); }} className={`mt-1 ${inputClass}`} />
                </label>
                <label className="block mt-3 text-sm font-medium text-slate-700 dark:text-zinc-300">
                    Confirmez le code
                    <input type="password" inputMode="numeric" autoComplete="off" value={confirmation}
                        onChange={e => { setConfirmation(digitsOnly(e.target.value)); setError(null); }} className={`mt-1 ${inputClass}`} />
                </label>
                {error && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
                <div className="mt-5 flex justify-end gap-2">
                    <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-700">Annuler</button>
                    <button type="submit" className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">{confirmText}</button>
                </div>
            </form>
        </div>
    );
};

export default PinSetupModal;
