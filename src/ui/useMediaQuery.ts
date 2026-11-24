import { useEffect, useState } from 'react';

/** Suit une requête média (ex. largeur d'écran, rotation d'une tablette). */
export function useMediaQuery(query: string): boolean {
    const [matches, setMatches] = useState(() => typeof matchMedia === 'function' && matchMedia(query).matches);
    useEffect(() => {
        const list = matchMedia(query);
        const update = () => setMatches(list.matches);
        update();
        list.addEventListener('change', update);
        return () => list.removeEventListener('change', update);
    }, [query]);
    return matches;
}
