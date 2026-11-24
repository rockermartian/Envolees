// Petit système de notifications (toasts) sans dépendance :
// n'importe quel module appelle toast.success(...) / toast.error(...) / toast.info(...),
// le composant ToastHost (monté une fois dans App) les affiche.

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastItem {
    id: number;
    kind: ToastKind;
    message: string;
}

type ToastListener = (item: ToastItem) => void;

let listener: ToastListener | null = null;
let nextId = 1;

const push = (kind: ToastKind, message: string) => {
    if (listener) {
        listener({ id: nextId++, kind, message });
    } else {
        // Aucun hôte monté (cas limite) : on garde une trace en console.
        console.warn(`[toast:${kind}]`, message);
    }
};

export const toast = {
    success: (message: string) => push('success', message),
    error: (message: string) => push('error', message),
    info: (message: string) => push('info', message),
};

export const registerToastListener = (l: ToastListener | null) => {
    listener = l;
};
