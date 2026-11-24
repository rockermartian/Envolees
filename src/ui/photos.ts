// Photos prises ou choisies sur le téléphone : compressées une fois (WebP, 600 px), comme sur ordinateur.
import { compressImage } from '../../core/utils/imageUtils';
import { pickWithInput } from '../platform/fileAccess';

/** `camera` : ouvre directement l'appareil photo (sur téléphone). Renvoie la référence de l'image, ou null. */
export async function pickPhoto(camera: boolean): Promise<string | null> {
    const file = await pickWithInput('image/*', camera ? 'environment' : undefined);
    return file ? compressImage(file) : null;
}
