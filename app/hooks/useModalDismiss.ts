import React, { useEffect, useMemo, useRef } from 'react';

// Pile des modales ouvertes : seule la modale au sommet réagit à Échap,
// ce qui permet d'empiler les modales (ex. recadrage photo au-dessus de la fiche élève).
const modalStack: symbol[] = [];

/**
 * Uniformise la fermeture des modales : touche Échap + clic sur le fond.
 * Retourne le handler de clic à poser sur le conteneur plein écran (l'overlay).
 *
 * @param onClose          Callback de fermeture de la modale. Peut changer à chaque rendu : il est lu
 *                         via une ref, la modale garde donc sa place dans la pile (sinon une modale
 *                         du dessous qui se re-rend repasserait au sommet et Échap la fermerait).
 * @param enabled          Permet de désactiver toute fermeture (modale bloquante, sauvegarde en cours…).
 * @param backdropEnabled  Permet de désactiver uniquement le clic sur le fond — à passer à `false`
 *                         quand un formulaire contient des saisies, pour éviter une perte
 *                         accidentelle (Échap et les boutons X / Annuler restent actifs).
 */
const useModalDismiss = (onClose: () => void, enabled: boolean = true, backdropEnabled: boolean = true) => {
    const id = useMemo(() => Symbol('modal'), []);
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    useEffect(() => {
        if (!enabled) return;
        modalStack.push(id);
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && modalStack[modalStack.length - 1] === id) {
                onCloseRef.current();
            }
        };
        window.addEventListener('keydown', handler);
        return () => {
            window.removeEventListener('keydown', handler);
            const idx = modalStack.indexOf(id);
            if (idx !== -1) modalStack.splice(idx, 1);
        };
    }, [enabled, id]);

    // Clic sur le fond uniquement (pas sur le contenu de la modale).
    return (e: React.MouseEvent<HTMLElement>) => {
        if (enabled && backdropEnabled && e.target === e.currentTarget) onCloseRef.current();
    };
};

export default useModalDismiss;
