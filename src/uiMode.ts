// Choix de l'interface : ordinateur (l'application de bureau, complète) ou mobile (pensée pour le
// téléphone, en classe). Les deux partagent les mêmes classes, enregistrées dans ce navigateur.
export type UiMode = 'desktop' | 'mobile';

const STORAGE_KEY = 'envolees-ui';

const stored = (): UiMode | null => {
    try {
        const value = localStorage.getItem(STORAGE_KEY);
        return value === 'desktop' || value === 'mobile' ? value : null;
    } catch {
        return null;
    }
};

/** Petit écran (téléphone) : interface mobile par défaut ; tablette et ordinateur : interface ordinateur. */
export const autoUiMode = (): UiMode =>
    typeof matchMedia === 'function' && matchMedia('(max-width: 767px)').matches ? 'mobile' : 'desktop';

/** ?ui=mobile|desktop (raccourcis de l'application installée) > choix mémorisé > taille de l'écran. */
export function resolveUiMode(): UiMode {
    const param = new URLSearchParams(window.location.search).get('ui');
    if (param === 'desktop' || param === 'mobile') {
        try { localStorage.setItem(STORAGE_KEY, param); } catch { /* navigation privée */ }
        return param;
    }
    return stored() ?? autoUiMode();
}

/** Change d'interface (rechargement de la page ; l'interface ordinateur demande d'abord d'enregistrer). */
export function switchUi(mode: UiMode): void {
    try { localStorage.setItem(STORAGE_KEY, mode); } catch { /* navigation privée */ }
    const url = new URL(window.location.href);
    url.searchParams.delete('ui');
    window.location.assign(url.toString());
}
