import { useState, useCallback } from 'react';

// Historique Annuler / Rétablir.
// Les états sont partagés par référence (jamais modifiés en place) : 50 états coûtent peu.

export const HISTORY_LIMIT = 50;
/** Deux modifications de même nature à moins de ce délai forment une seule entrée (frappe au clavier). */
export const COALESCE_MS = 2000;

export interface UpdateOptions {
  /** Modifications successives de même clé et rapprochées : une seule entrée d'historique. */
  coalesceKey?: string;
  /** Modification hors historique (réglages d'interface) : ne crée aucune entrée, ne vide pas « Rétablir ». */
  skipHistory?: boolean;
}

export interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
  lastKey?: string;
  lastTime?: number;
}

/** Applique une modification à l'historique (fonction pure, testée). */
export function pushHistory<T>(h: HistoryState<T>, next: T, options: UpdateOptions = {}, now = Date.now()): HistoryState<T> {
  if (next === h.present) return h;
  if (options.skipHistory) return { ...h, present: next };
  const coalesce = !!options.coalesceKey && options.coalesceKey === h.lastKey && h.lastTime !== undefined && now - h.lastTime < COALESCE_MS && h.past.length > 0;
  const past = coalesce ? h.past : [...h.past, h.present].slice(-HISTORY_LIMIT);
  return { past, present: next, future: [], lastKey: options.coalesceKey, lastTime: now };
}

/**
 * Annule la dernière entrée. `keep` permet de conserver une partie de l'état courant
 * (ex. réglages d'interface, hors historique).
 */
export function undoHistory<T>(h: HistoryState<T>, keep?: (restored: T, current: T) => T): HistoryState<T> {
  if (h.past.length === 0) return h;
  const previous = h.past[h.past.length - 1];
  return { past: h.past.slice(0, -1), present: keep ? keep(previous, h.present) : previous, future: [h.present, ...h.future] };
}

export function redoHistory<T>(h: HistoryState<T>, keep?: (restored: T, current: T) => T): HistoryState<T> {
  if (h.future.length === 0) return h;
  const next = h.future[0];
  return { past: [...h.past, h.present].slice(-HISTORY_LIMIT), present: keep ? keep(next, h.present) : next, future: h.future.slice(1) };
}

interface UndoRedoResult<T> {
  state: T;
  setState: (newState: T | ((prevState: T) => T), options?: UpdateOptions) => void;
  undo: () => void;
  redo: () => void;
  resetState: (newState: T) => void;
  canUndo: boolean;
  canRedo: boolean;
}

function useUndoRedo<T>(initialState: T, keep?: (restored: T, current: T) => T): UndoRedoResult<T> {
  const [history, setHistory] = useState<HistoryState<T>>({ past: [], present: initialState, future: [] });

  const setState = useCallback((newStateOrUpdater: T | ((prevState: T) => T), options?: UpdateOptions) => {
    setHistory(curr => {
      const next = typeof newStateOrUpdater === 'function'
        ? (newStateOrUpdater as (prevState: T) => T)(curr.present)
        : newStateOrUpdater;
      return pushHistory(curr, next, options);
    });
  }, []);

  const undo = useCallback(() => setHistory(curr => undoHistory(curr, keep)), [keep]);
  const redo = useCallback(() => setHistory(curr => redoHistory(curr, keep)), [keep]);
  const resetState = useCallback((newState: T) => setHistory({ past: [], present: newState, future: [] }), []);

  return {
    state: history.present,
    setState,
    undo,
    redo,
    resetState,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}

export default useUndoRedo;
