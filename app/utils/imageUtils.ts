import { imageStore } from '../images/imageStore';
import { toast } from './toast';

// Compression unique, à l'import : la plus grande dimension est bornée, format WebP.
// L'image n'est plus jamais ré-encodée ensuite (ni à l'enregistrement, ni à l'ouverture).
const MAX_SIDE = 600;
const QUALITY = 0.8;

const loadImage = (src: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image illisible'));
    img.src = src;
});

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> =>
    new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Encodage impossible'))), type, quality));

/**
 * Compresse une image importée (data URL ou fichier) et la range dans le magasin d'images.
 * Renvoie sa référence `img:…`, ou null si le format n'est pas lisible (message affiché) :
 * l'appelant conserve alors la valeur précédente.
 */
export async function compressImage(source: string | Blob): Promise<string | null> {
    const objectUrl = typeof source === 'string' ? null : URL.createObjectURL(source);
    try {
        const img = await loadImage(objectUrl ?? (source as string));
        const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        return await imageStore.putBlob(await canvasToBlob(canvas, 'image/webp', QUALITY));
    } catch (error) {
        console.warn('Image non importée :', error);
        toast.error("Cette image n'a pas pu être lue. Formats acceptés : JPEG, PNG, WebP (les photos HEIC d'iPhone doivent être converties).");
        return null;
    } finally {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
}

/** Range un canvas déjà dimensionné (ex. portrait recadré) dans le magasin, sans autre traitement. */
export async function storeCanvas(canvas: HTMLCanvasElement): Promise<string> {
    return imageStore.putBlob(await canvasToBlob(canvas, 'image/webp', 0.85));
}
