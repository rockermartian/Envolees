// Nuage (cloud de l'Éducation nationale) dans la version web : envoi et ouverture « assistés ».
//
// Un site web ne peut pas écrire directement dans Nuage : Nuage n'autorise pas les requêtes venant
// d'un autre site (pas d'en-têtes CORS ; vérifié le 24/11/2026). L'application de bureau, elle, le peut.
// Ici, l'application fait tout ce qui est possible pour que l'enseignant n'ait qu'un geste à faire :
//   - tablette : feuille de partage du système → application Nextcloud (connectée à Nuage) ;
//     ouverture : sélecteur de fichiers du système, où l'application Nextcloud apparaît ;
//   - ordinateur : téléchargement + ouverture de Nuage dans un onglet (glisser le fichier), ou
//     enregistrement direct dans le dossier Nuage synchronisé de l'ordinateur (client Nextcloud).
// Une demande d'autorisation (CORS) est adressée à apps.education.fr : voir docs/demande-nuage-cors.md.
import React from 'react';
import { NUAGE_FOLDER, NUAGE_URL } from '../../app/shared/nuageClient.js';
import { askChoice, Button, Panel, showDialog } from './dialogs';
import { canLinkFiles, canShareFile, downloadBlob, isTouchDevice, pickEnvoleesFile, pickSaveLocation, pickWithInput, shareFile, writeLinkedFile, type LinkedFileHandle } from './fileAccess';
import { exportClass, markExported } from './library';

/** Dossier Envolées de Nuage, dans un nouvel onglet. */
export const NUAGE_FILES_URL = `${NUAGE_URL}/apps/files/?dir=/${encodeURIComponent(NUAGE_FOLDER)}`;
const SYNC_PICKER = 'envolees-nuage-sync';
const HELP_KEY = 'envolees-nuage-aide-vue';

const openNuageTab = () => window.open(NUAGE_FILES_URL, '_blank', 'noopener');

const helpSeen = () => { try { return localStorage.getItem(HELP_KEY) === '1'; } catch { return false; } };
const markHelpSeen = () => { try { localStorage.setItem(HELP_KEY, '1'); } catch { /* navigation privée */ } };

export type NuageSendOutcome = 'shared' | 'downloaded' | 'saved' | 'cancelled';

const TabletSendHelp = () => (
    <div className="space-y-3 text-slate-600 dark:text-zinc-300">
        <p>La fenêtre de partage de la tablette va s'ouvrir. Choisissez <strong>Nextcloud</strong>, puis le dossier <strong>{NUAGE_FOLDER}</strong> de votre Nuage, et validez.</p>
        <p className="text-sm">Première fois ? Installez l'application <strong>Nextcloud</strong> (App Store ou Google Play), puis connectez-la avec l'adresse <strong>nuage.apps.education.fr</strong> et votre identifiant académique.</p>
    </div>
);

/** Envoie la dernière version enregistrée d'une classe vers Nuage (assisté). */
export async function sendClassToNuage(classId: string): Promise<NuageSendOutcome> {
    const { blob, fileName, name } = await exportClass(classId);

    if (isTouchDevice() && canShareFile(blob, fileName)) {
        if (!helpSeen()) {
            const go = await askChoice('Envoyer vers Nuage', <TabletSendHelp />, [{ label: 'Annuler', value: false }, { label: 'Continuer', value: true, kind: 'primary' }], false);
            if (!go) return 'cancelled';
            markHelpSeen();
        }
        const shared = await shareFile(blob, fileName, name);
        if (shared) await markExported(classId);
        return shared ? 'shared' : 'cancelled';
    }

    type Choice = 'download' | 'synced' | null;
    const choice = await showDialog<Choice>(close => (
        <Panel title="Envoyer vers Nuage" footer={<Button onClick={() => close(null)}>Annuler</Button>}>
            <div className="space-y-5 text-slate-600 dark:text-zinc-300">
                <section className="space-y-2">
                    <p>Le fichier <strong className="text-slate-800 dark:text-zinc-100">{fileName}</strong> va être téléchargé, et Nuage s'ouvrir dans un nouvel onglet : faites glisser le fichier dans le dossier <strong>{NUAGE_FOLDER}</strong> (ou utilisez le bouton « + Nouveau › Envoyer un fichier »).</p>
                    <Button kind="primary" onClick={() => close('download')}>Télécharger et ouvrir Nuage</Button>
                </section>
                {canLinkFiles() && (
                    <section className="space-y-2 border-t border-slate-200 dark:border-zinc-700 pt-4">
                        <p className="text-sm">Votre Nuage est synchronisé sur cet ordinateur (client Nextcloud) ? Enregistrez directement dans son dossier <strong>{NUAGE_FOLDER}</strong> : l'envoi se fait tout seul.</p>
                        <Button onClick={() => close('synced')}>Enregistrer dans le dossier Nuage de l'ordinateur…</Button>
                    </section>
                )}
                <p className="text-xs text-slate-500 dark:text-zinc-400">Pourquoi pas d'envoi direct ? Nuage n'accepte pas encore les envois venant d'un site web. L'application Envolées pour ordinateur, elle, envoie directement.</p>
            </div>
        </Panel>
    ), null);

    if (choice === 'download') {
        downloadBlob(blob, fileName);
        openNuageTab();
        await markExported(classId);
        return 'downloaded';
    }
    if (choice === 'synced') {
        const handle = await pickSaveLocation(fileName, SYNC_PICKER);
        if (!handle) return 'cancelled';
        await writeLinkedFile(handle, blob);
        await markExported(classId);
        return 'saved';
    }
    return 'cancelled';
}

/**
 * Fait choisir une classe dans Nuage (assisté). Renvoie le fichier choisi, à importer comme
 * n'importe quel fichier .envolees, ou null.
 */
export async function pickClassFromNuage(): Promise<{ file: File; handle?: LinkedFileHandle } | null> {
    if (isTouchDevice()) {
        const go = await askChoice('Ouvrir depuis Nuage', (
            <div className="space-y-3 text-slate-600 dark:text-zinc-300">
                <p>Dans la fenêtre qui s'ouvre, choisissez l'emplacement <strong>Nextcloud</strong> (sur iPad : « Parcourir », puis Nextcloud), puis le dossier <strong>{NUAGE_FOLDER}</strong> et la classe.</p>
                <p className="text-sm">Il faut l'application <strong>Nextcloud</strong> connectée à votre Nuage (nuage.apps.education.fr).</p>
            </div>
        ), [{ label: 'Annuler', value: false }, { label: 'Choisir la classe', value: true, kind: 'primary' }], false);
        if (!go) return null;
        const file = await pickWithInput();
        return file ? { file } : null;
    }

    type Choice = 'pick' | null;
    const choice = await showDialog<Choice>(close => (
        <Panel title="Ouvrir depuis Nuage" footer={<Button onClick={() => close(null)}>Annuler</Button>}>
            <ol className="space-y-4 text-slate-600 dark:text-zinc-300 list-decimal pl-5">
                <li className="space-y-2">
                    <p>Dans Nuage, ouvrez le dossier <strong>{NUAGE_FOLDER}</strong> et téléchargez la classe (menu « … » du fichier › Télécharger).</p>
                    <Button onClick={openNuageTab}>Ouvrir Nuage dans un onglet</Button>
                </li>
                <li className="space-y-2">
                    <p>Choisissez ensuite le fichier téléchargé{canLinkFiles() ? ', ou directement la classe dans le dossier Nuage synchronisé de l\'ordinateur' : ''}.</p>
                    <Button kind="primary" onClick={() => close('pick')}>Choisir le fichier…</Button>
                </li>
            </ol>
        </Panel>
    ), null);
    if (choice !== 'pick') return null;
    return pickEnvoleesFile(SYNC_PICKER);
}

export const nuageSendMessage = (outcome: NuageSendOutcome): string | null =>
    outcome === 'shared' ? 'Classe transmise à l\'application choisie.'
        : outcome === 'saved' ? 'Classe enregistrée dans le dossier Nuage de l\'ordinateur : elle sera envoyée par le client Nextcloud.'
        : outcome === 'downloaded' ? 'Fichier téléchargé : déposez-le dans le dossier Envolées de l\'onglet Nuage.'
        : null;

