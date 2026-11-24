// Export d'une classe en fichier .envolees : partage (téléphone), enregistrement (Chrome / Edge) ou téléchargement.
import { canLinkFiles, canShareFile, downloadBlob, pickSaveLocation, shareFile, writeLinkedFile } from './fileAccess';
import { exportClass, markExported } from './library';

export type ExportOutcome = 'shared' | 'saved' | 'downloaded' | 'cancelled';

const prefersShare = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

/** Exporte la dernière version enregistrée d'une classe. */
export async function exportClassFile(id: string, how: 'auto' | 'download' | 'share' = 'auto'): Promise<ExportOutcome> {
    const { blob, fileName, name } = await exportClass(id);
    let outcome: ExportOutcome;
    if (how === 'share' || (how === 'auto' && prefersShare() && canShareFile(blob, fileName))) {
        outcome = (await shareFile(blob, fileName, name)) ? 'shared' : 'cancelled';
    } else if (how === 'auto' && canLinkFiles()) {
        const handle = await pickSaveLocation(fileName);
        if (!handle) return 'cancelled';
        await writeLinkedFile(handle, blob);
        outcome = 'saved';
    } else {
        downloadBlob(blob, fileName);
        outcome = 'downloaded';
    }
    if (outcome !== 'cancelled') await markExported(id);
    return outcome;
}

export const formatBytes = (bytes: number): string =>
    bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} Ko`
        : bytes < 1024 ** 3 ? `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0).replace('.', ',')} Mo`
        : `${(bytes / 1024 ** 3).toFixed(1).replace('.', ',')} Go`;

export const formatDateTime = (iso: string | null | undefined): string => {
    if (!iso) return '—';
    const date = new Date(iso);
    const today = new Date();
    const sameDay = date.toDateString() === today.toDateString();
    const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return sameDay ? `aujourd'hui à ${time}` : `${date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })} à ${time}`;
};
