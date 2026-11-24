// Classe ouverte dans cet onglet (les deux interfaces passent par ici).
import React from 'react';
import { parseOpenedData } from '../../../fileFormat/fileIO';
import { toast } from '../../../utils/toast';
import { askChoice, showMessage, withProgress } from './dialogs';
import { formatDateTime } from './exporting';
import { pickEnvoleesFile, type LinkedFileHandle } from './fileAccess';
import {
    createClass, findClassByHandle, imageNamesOf, listClasses, loadClass, lockClass, readClassFile, saveClass,
    setLastClassId, updateClassMeta, writeLinkedClassFile, type ClassRecord, type LinkedWriteResult,
} from './library';

let current: { id: string; release: () => void } | null = null;

export const currentClassId = (): string | null => current?.id ?? null;

const ALREADY_OPEN = "Cette classe est déjà ouverte dans un autre onglet ou une autre fenêtre d'Envolées. Fermez-la là-bas pour l'ouvrir ici (deux onglets s'écraseraient mutuellement).";

/** Ouvre une classe du navigateur (réservée à cet onglet) et charge ses images. */
export async function openClass(id: string): Promise<ClassRecord> {
    if (current?.id !== id) {
        const release = await lockClass(id);
        if (!release) throw new Error(ALREADY_OPEN);
        current?.release();
        current = { id, release };
    }
    try {
        const record = await withProgress('Ouverture de la classe…', () => loadClass(id));
        await setLastClassId(id);
        return record;
    } catch (error) {
        closeClass();
        throw error;
    }
}

export function closeClass(): void {
    current?.release();
    current = null;
}

/** Nouvelle classe (vide ou copie), aussitôt ouverte. */
export async function createAndOpenClass(input: { name: string; dataJson: string; images: string[]; handle?: LinkedFileHandle | null }): Promise<ClassRecord> {
    const record = await createClass(input);
    return openClass(record.id);
}

const baseName = (fileName: string) => fileName.replace(/\.envolees$/i, '').trim() || 'Classe';

/**
 * Importe un fichier .envolees dans le navigateur. Renvoie l'id de la classe (null si annulé).
 * - fichier déjà lié à une classe (Chrome / Edge) : la classe reprend le contenu du fichier ;
 * - classe du même nom : l'utilisateur choisit de la remplacer ou de garder les deux.
 */
export async function importClassFile(picked?: { file: File; handle?: LinkedFileHandle } | null): Promise<string | null> {
    const chosen = picked === undefined ? await pickEnvoleesFile() : picked;
    if (!chosen) return null;
    const { file, handle } = chosen;

    const { dataJson, images } = await withProgress(`Lecture de « ${file.name} »…`, () => readClassFile(file));
    parseOpenedData(dataJson); // données illisibles : erreur avant toute création

    const stamp = new Date().toISOString();
    const linked = handle ? await findClassByHandle(handle) : null;
    if (linked) {
        if (linked.id === current?.id) throw new Error('Ce fichier est déjà ouvert.');
        await saveClass(linked.id, dataJson, images);
        await updateClassMeta(linked.id, { exportedAt: stamp, handle });
        return linked.id;
    }

    const name = baseName(file.name);
    const homonym = (await listClasses()).find(c => c.name.toLowerCase() === name.toLowerCase());
    if (homonym && homonym.id !== current?.id) {
        const choice = await askChoice<'replace' | 'new' | null>(
            'Classe déjà présente',
            React.createElement(React.Fragment, null,
                `Une classe « ${homonym.name} » existe déjà sur cet appareil (modifiée ${formatDateTime(homonym.updatedAt)}).`,
                '\n\n',
                'Remplacer : elle prend le contenu du fichier (sa version actuelle est gardée en copie de sécurité).'),
            [{ label: 'Annuler', value: null }, { label: 'Garder les deux', value: 'new' }, { label: 'Remplacer', value: 'replace', kind: 'primary' }],
            null,
        );
        if (!choice) return null;
        if (choice === 'replace') {
            await saveClass(homonym.id, dataJson, images);
            await updateClassMeta(homonym.id, { exportedAt: stamp, ...(handle ? { handle } : {}) });
            return homonym.id;
        }
    }
    const record = await createClass({ name, dataJson, images, handle: handle ?? null, exportedAt: stamp });
    return record.id;
}

let permissionHintShown = false;

/**
 * Enregistre la classe ouverte : dans le navigateur (toujours), puis dans son fichier lié s'il y en a un.
 * `userAction` : enregistrement demandé par un clic (le navigateur peut alors demander l'autorisation d'écrire).
 */
export async function saveCurrentClass(dataJson: string, refs: string[], userAction: boolean): Promise<LinkedWriteResult> {
    if (!current) throw new Error('Aucune classe ouverte.');
    const id = current.id;
    await saveClass(id, dataJson, imageNamesOf(refs));
    const linked = await writeLinkedClassFile(id, userAction);
    if (linked === 'permission-needed' && !permissionHintShown) {
        permissionHintShown = true;
        toast.info("Enregistré dans le navigateur. Pour mettre aussi à jour le fichier lié sur l'ordinateur, cliquez sur l'indicateur d'enregistrement et autorisez l'accès.");
    } else if (typeof linked === 'object') {
        toast.error(`Enregistré dans le navigateur, mais le fichier lié n'a pas pu être écrit : ${linked.error}`);
    }
    return linked;
}

/** Message d'erreur lisible (ArchiveError, quota dépassé…). */
export function describeError(error: unknown): string {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        return "L'espace de stockage de ce navigateur est plein. Supprimez des classes inutiles (après les avoir exportées) ou libérez de la place sur l'appareil.";
    }
    return error instanceof Error ? error.message : String(error);
}

export const reportError = (title: string, error: unknown) => showMessage(title, describeError(error));
