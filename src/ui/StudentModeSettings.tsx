// Réglages du mode élève : code PIN de l'enseignant, validation par l'enseignant, délai entre deux passages.
import React, { useState } from 'react';
import { DEFAULT_MIN_MINUTES_BETWEEN_SCANS, PIN_MAX_LENGTH, isPinDefined, validateNewPin } from '../../core/domain/studentMode';
import type { ClassDocument } from './useClassDocument';
import { Btn, Field, inputClass, Sheet, useSnack } from './ui';

/** Définition (ou changement) du code PIN ; `onDone(true)` une fois enregistré. */
export const PinSetupSheet: React.FC<{ doc: ClassDocument; onDone: (saved: boolean) => void }> = ({ doc, onDone }) => {
    const [pin, setPin] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [error, setError] = useState<string | null>(null);
    const save = () => {
        const problem = validateNewPin(pin, confirmation);
        if (problem) { setError(problem); return; }
        doc.update(d => ({ ...d, teacherConfig: { ...d.teacherConfig, studentModePin: pin } }));
        onDone(true);
    };
    const digits = (v: string) => v.replace(/\D/g, '').slice(0, PIN_MAX_LENGTH);
    return (
        <Sheet title="Code PIN du mode élève" onClose={() => onDone(false)}
            footer={<Btn tone="primary" block disabled={!pin || !confirmation} onClick={save}>Enregistrer</Btn>}>
            <form className="space-y-4" onSubmit={e => { e.preventDefault(); save(); }}>
                <p className="text-sm text-slate-600 dark:text-zinc-300">Ce code (4 à 8 chiffres) sert à quitter le mode élève : sans lui, un enfant ne peut pas sortir de l'écran des ateliers.</p>
                <Field label="Code"><input className={inputClass} type="password" inputMode="numeric" autoComplete="new-password" value={pin} onChange={e => { setPin(digits(e.target.value)); setError(null); }} data-autofocus /></Field>
                <Field label="Confirmation"><input className={inputClass} type="password" inputMode="numeric" autoComplete="new-password" value={confirmation} onChange={e => { setConfirmation(digits(e.target.value)); setError(null); }} /></Field>
                {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            </form>
        </Sheet>
    );
};

/** Lignes de réglage (onglet Classe). */
export const StudentModeSettingsRows: React.FC<{ doc: ClassDocument; Row: React.FC<{ icon: React.ReactNode; title: string; detail?: React.ReactNode; onClick?: () => void }>; icon: React.ReactNode }> = ({ doc, Row, icon }) => {
    const snack = useSnack();
    const [editing, setEditing] = useState(false);
    const config = doc.data.teacherConfig;
    const delay = config.minMinutesBetweenScans ?? DEFAULT_MIN_MINUTES_BETWEEN_SCANS;
    const set = (patch: Partial<typeof config>) => doc.update(d => ({ ...d, teacherConfig: { ...d.teacherConfig, ...patch } }));
    return (
        <>
            <Row icon={icon} title={isPinDefined(config.studentModePin) ? 'Changer le code PIN' : 'Définir le code PIN'}
                detail={isPinDefined(config.studentModePin) ? 'Code défini — nécessaire pour quitter le mode élève' : 'À définir avant le premier mode élève'} onClick={() => setEditing(true)} />
            <Row icon={icon} title={config.requirePinForValidation ? 'Validation par l\'enseignant : oui' : 'Validation par l\'enseignant : non'}
                detail="Au 2e passage, le code enseignant est demandé avant de valider l'atelier"
                onClick={() => set({ requirePinForValidation: !config.requirePinForValidation })} />
            <Row icon={icon} title={`Délai entre deux passages : ${delay ? `${delay} min` : 'aucun'}`}
                detail="Temps minimal entre le début et la fin d'un atelier (toucher pour changer)"
                onClick={() => { const next = [0, 2, 5, 10, 15][([0, 2, 5, 10, 15].indexOf(delay) + 1) % 5]; set({ minMinutesBetweenScans: next }); }} />
            {editing && <PinSetupSheet doc={doc} onDone={saved => { setEditing(false); if (saved) snack('Code PIN enregistré', { kind: 'success' }); }} />}
        </>
    );
};
