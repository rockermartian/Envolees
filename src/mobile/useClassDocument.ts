// Classe ouverte dans l'interface mobile : données, historique (Annuler / Rétablir) et enregistrement.
//
// Pas de bouton « Enregistrer » sur téléphone : chaque modification est enregistrée dans le navigateur
// moins d'une seconde après, et immédiatement quand l'application passe en arrière-plan (un téléphone
// peut fermer un onglet caché à tout moment).
import { useCallback, useEffect, useRef, useState } from 'react';
import { parseOpenedData, prepareForSave } from '../../../fileFormat/fileIO';
import { pushHistory, redoHistory, undoHistory, type HistoryState, type UpdateOptions } from '../../../hooks/useUndoRedo';
import type { AppData } from '../../../types';
import { describeError, saveCurrentClass } from '../platform/session';

const SAVE_DELAY_MS = 700;

export type SaveState = 'saved' | 'pending' | 'saving' | 'error';

/** Annuler ne touche pas aux réglages d'interface (thème…). */
const keepUi = (restored: AppData, current: AppData): AppData => ({ ...restored, uiSettings: current.uiSettings });

export function useClassDocument(initialJson: string) {
    const [history, setHistory] = useState<HistoryState<AppData>>(() => ({ past: [], present: parseOpenedData(initialJson), future: [] }));
    const [saveState, setSaveState] = useState<SaveState>('saved');
    const [lastError, setLastError] = useState<string | null>(null);
    const data = history.present;

    const savedRef = useRef<AppData>(data);
    const latestRef = useRef<AppData>(data);
    latestRef.current = data;
    const queueRef = useRef<Promise<void>>(Promise.resolve());
    const timerRef = useRef<number | undefined>(undefined);

    /** Enregistre l'état courant s'il a changé (enregistrements mis en file, jamais en parallèle). */
    const flush = useCallback((): Promise<void> => {
        window.clearTimeout(timerRef.current);
        const run = queueRef.current.then(async () => {
            const target = latestRef.current;
            if (target === savedRef.current) return;
            setSaveState('saving');
            try {
                const { dataJson, refs } = await prepareForSave(target);
                await saveCurrentClass(dataJson, refs, false);
                savedRef.current = target;
                setLastError(null);
                setSaveState(latestRef.current === target ? 'saved' : 'pending');
            } catch (error) {
                setLastError(describeError(error));
                setSaveState('error');
            }
        });
        queueRef.current = run;
        return run;
    }, []);

    useEffect(() => {
        if (data === savedRef.current) return;
        setSaveState(s => (s === 'saving' ? s : 'pending'));
        window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => { void flush(); }, SAVE_DELAY_MS);
    }, [data, flush]);

    useEffect(() => {
        const onHide = () => { if (document.visibilityState === 'hidden') void flush(); };
        const onPageHide = () => { void flush(); };
        document.addEventListener('visibilitychange', onHide);
        window.addEventListener('pagehide', onPageHide);
        // Dernier filet : si l'enregistrement n'a pas eu lieu, le navigateur demande confirmation.
        const onBeforeUnload = (e: BeforeUnloadEvent) => {
            if (latestRef.current !== savedRef.current) { void flush(); e.preventDefault(); e.returnValue = ''; }
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => {
            document.removeEventListener('visibilitychange', onHide);
            window.removeEventListener('pagehide', onPageHide);
            window.removeEventListener('beforeunload', onBeforeUnload);
        };
    }, [flush]);

    // Thème de la classe (comme l'application de bureau).
    useEffect(() => {
        document.documentElement.classList.toggle('dark', data.uiSettings.theme === 'dark');
    }, [data.uiSettings.theme]);

    const update = useCallback((updater: (prev: AppData) => AppData, options?: UpdateOptions) => {
        setHistory(h => pushHistory(h, updater(h.present), options));
    }, []);
    const undo = useCallback(() => setHistory(h => undoHistory(h, keepUi)), []);
    const redo = useCallback(() => setHistory(h => redoHistory(h, keepUi)), []);

    return {
        data,
        update,
        undo,
        redo,
        canUndo: history.past.length > 0,
        canRedo: history.future.length > 0,
        saveState,
        lastError,
        flush,
    };
}

export type ClassDocument = ReturnType<typeof useClassDocument>;
