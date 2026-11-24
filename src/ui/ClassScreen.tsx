// Onglet « Classe » : Nuage, fichier .envolees, programme, apparence, stockage de l'appareil.
import React, { useEffect, useState } from 'react';
import { BookOpen, Cloud, Download, FileUp, FolderOpen, HardDrive, Lock, Moon, Pencil, Share2, Sun } from 'lucide-react';
import { StudentModeSettingsRows } from './StudentModeSettings';
import { mergePrograms } from '../../core/utils';
import { askName, showMessage } from '../platform/dialogs';
import { exportClassFile, formatBytes, formatDateTime } from '../platform/exporting';
import { canLinkFiles, canShareFile, isTouchDevice, pickWithInput } from '../platform/fileAccess';
import { getClass, requestPersistentStorage, storageInfo, updateClassMeta, type ClassRecord } from '../platform/library';
import { nuageSendMessage, sendClassToNuage } from '../platform/nuageAssist';
import { describeError } from '../platform/session';
import { readProgramFile } from './programImport';
import type { ClassDocument } from './useClassDocument';
import { useSnack } from './ui';

interface Props {
    doc: ClassDocument;
    classId: string;
    className: string;
    onRenamed: (name: string) => void;
    onCloseClass: () => void;
}

const Row: React.FC<{ icon: React.ReactNode; title: string; detail?: React.ReactNode; onClick?: () => void; disabled?: boolean }> = ({ icon, title, detail, onClick, disabled }) => (
    <li>
        <button type="button" onClick={onClick} disabled={disabled || !onClick}
            className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-zinc-800/60 active:bg-slate-100 dark:active:bg-zinc-800 disabled:opacity-60 disabled:hover:bg-transparent">
            <span className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-300 inline-flex items-center justify-center shrink-0">{icon}</span>
            <span className="flex-1 min-w-0">
                <span className="block font-medium text-slate-900 dark:text-zinc-50">{title}</span>
                {detail && <span className="block text-sm text-slate-500 dark:text-zinc-400">{detail}</span>}
            </span>
        </button>
    </li>
);

const Group: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <section>
        <h2 className="px-1 mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">{title}</h2>
        <ul className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm divide-y divide-slate-100 dark:divide-zinc-800 overflow-hidden">{children}</ul>
    </section>
);

const ClassScreen: React.FC<Props> = ({ doc, classId, className, onRenamed, onCloseClass }) => {
    const snack = useSnack();
    const [record, setRecord] = useState<ClassRecord | null>(null);
    const [storage, setStorage] = useState<{ usage: number; quota: number; persisted: boolean } | null>(null);
    const [busy, setBusy] = useState(false);

    const refresh = async () => {
        setRecord((await getClass(classId)) ?? null);
        setStorage(await storageInfo());
    };
    useEffect(() => { void refresh(); }, [classId, doc.saveState]);

    /** Enregistre d'abord la classe (la version exportée est toujours la dernière). */
    const withSaved = async (work: () => Promise<void>) => {
        setBusy(true);
        try {
            await doc.flush();
            await work();
            await refresh();
        } catch (error) {
            await showMessage('Opération impossible', describeError(error));
        } finally {
            setBusy(false);
        }
    };

    const toNuage = () => withSaved(async () => {
        const message = nuageSendMessage(await sendClassToNuage(classId));
        if (message) snack(message, { kind: 'success' });
    });

    const exportFile = (how: 'auto' | 'download' | 'share') => withSaved(async () => {
        const outcome = await exportClassFile(classId, how);
        if (outcome === 'downloaded') snack('Fichier téléchargé (dossier Téléchargements).', { kind: 'success' });
        else if (outcome !== 'cancelled') snack('Fichier exporté.', { kind: 'success' });
    });

    const rename = async () => {
        const answer = await askName('Renommer la classe', 'Nom de la classe', className, 'Renommer');
        if (!answer) return;
        await updateClassMeta(classId, { name: answer.name });
        onRenamed(answer.name);
    };

    const importProgram = async () => {
        const file = await pickWithInput(isTouchDevice() ? undefined : '.competences,.json');
        if (!file) return;
        try {
            const programs = await readProgramFile(file);
            doc.update(d => ({ ...d, schoolPrograms: mergePrograms(d.schoolPrograms, programs) }));
            snack(`${programs.length} programme${programs.length > 1 ? 's' : ''} importé${programs.length > 1 ? 's' : ''}`, { kind: 'success', action: { label: 'Annuler', run: doc.undo } });
        } catch (error) {
            await showMessage('Import impossible', describeError(error));
        }
    };

    const protect = async () => {
        const ok = await requestPersistentStorage();
        await refresh();
        await showMessage('Stockage', ok ? "Le navigateur conservera les données de cet appareil, même en cas de manque de place."
            : "Le navigateur n'a pas accordé la protection (elle l'est souvent une fois l'application installée). Envoyez régulièrement vos classes vers Nuage.");
    };

    const theme = doc.data.uiSettings.theme;
    const lastExport = record?.exportedAt;
    const modifiedSinceExport = !lastExport || (!!record && record.updatedAt > lastExport);
    const shareable = isTouchDevice() && canShareFile(new Blob([]), 'x.envolees');
    const programs = doc.data.schoolPrograms;
    const skillCount = programs.reduce((n, p) => n + JSON.stringify(p.domains).split('"referenceAges"').length - 1, 0);

    return (
        <div className="px-4 sm:px-6 pt-5 pb-12 space-y-7 max-w-3xl">
            <Group title="Nuage et sauvegarde">
                <Row icon={<Cloud className="w-5 h-5" />} disabled={busy} title="Envoyer vers Nuage"
                    detail={<>Sauvegarde dans le cloud de l'Éducation nationale, pour retrouver la classe sur un autre appareil. {lastExport ? `Dernière copie ${formatDateTime(lastExport)}` : 'Jamais sauvegardée'}{modifiedSinceExport && <strong className="text-amber-600 dark:text-amber-400"> · modifiée depuis</strong>}</>}
                    onClick={toNuage} />
                {shareable
                    ? <Row icon={<Share2 className="w-5 h-5" />} title="Partager le fichier .envolees" detail="Fichiers, e-mail, autre application…" disabled={busy} onClick={() => exportFile('share')} />
                    : <Row icon={<Download className="w-5 h-5" />} title={canLinkFiles() ? 'Enregistrer une copie sur cet ordinateur…' : 'Télécharger le fichier .envolees'} disabled={busy} onClick={() => exportFile(canLinkFiles() ? 'auto' : 'download')} />}
            </Group>

            <Group title="Classe">
                <Row icon={<Pencil className="w-5 h-5" />} title="Renommer la classe" detail={className} onClick={rename} />
                <Row icon={<FileUp className="w-5 h-5" />} title="Importer un programme (.competences)"
                    detail={programs.length ? `${programs.length} programme${programs.length > 1 ? 's' : ''}, ${skillCount} compétences — l'import complète l'existant` : 'Aucun programme : importez le programme 2025 fourni avec Envolées'}
                    onClick={importProgram} />
                <Row icon={<FolderOpen className="w-5 h-5" />} title="Changer de classe" detail="Retour à l'accueil (la classe est enregistrée)" onClick={onCloseClass} />
            </Group>

            <Group title="Mode élève (tablette de la classe)">
                <StudentModeSettingsRows doc={doc} Row={Row} icon={<Lock className="w-5 h-5" />} />
            </Group>

            <Group title="Affichage">
                <Row icon={theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />} title={theme === 'dark' ? 'Thème clair' : 'Thème sombre'}
                    onClick={() => doc.update(d => ({ ...d, uiSettings: { ...d.uiSettings, theme: d.uiSettings.theme === 'dark' ? 'light' : 'dark' } }), { skipHistory: true })} />
            </Group>

            <Group title="Cet appareil">
                <Row icon={<HardDrive className="w-5 h-5" />} title="Stockage"
                    detail={storage ? `${formatBytes(storage.usage)} utilisés · ${storage.persisted ? 'données protégées' : 'toucher pour protéger les données'}` : 'Informations indisponibles'}
                    onClick={storage && !storage.persisted ? protect : undefined} />
                <Row icon={<BookOpen className="w-5 h-5" />} title="Livret, programme, ateliers et QR codes, rapports"
                    detail="Ces fonctions sont dans l'application Envolées pour ordinateur, qui ouvre les mêmes fichiers (et Nuage)." />
            </Group>

            <p className="text-center text-xs text-slate-400 dark:text-zinc-500">
                Envolées {import.meta.env.VITE_APP_VERSION} · version web<br />
                Les données restent sur cet appareil ; elles ne quittent l'appareil que si vous les envoyez (Nuage, partage, fichier).
                {doc.lastError && <><br /><span className="text-red-600">Dernier enregistrement en échec : {doc.lastError}</span></>}
            </p>
        </div>
    );
};

export default ClassScreen;
