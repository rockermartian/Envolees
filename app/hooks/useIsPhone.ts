import { useEffect, useState } from 'react';

/** Écran de téléphone : moins de 640 px de large (même limite que la variante Tailwind max-sm:). */
export const PHONE_QUERY = '(max-width: 639.98px)';

/** Vrai sur un écran de téléphone ; suit les changements (rotation, redimensionnement). */
export default function useIsPhone(): boolean {
    const [isPhone, setIsPhone] = useState(() => typeof matchMedia === 'function' && matchMedia(PHONE_QUERY).matches);
    useEffect(() => {
        if (typeof matchMedia !== 'function') return;
        const query = matchMedia(PHONE_QUERY);
        const update = () => setIsPhone(query.matches);
        update();
        query.addEventListener('change', update);
        return () => query.removeEventListener('change', update);
    }, []);
    return isPhone;
}
