// Onglet « Plus » : fichier de la classe, apparence, version ordinateur, stockage, aide.
import React, { useEffect, useState } from 'react';
import { BookOpen, Download, FileUp, FolderOpen, HardDrive, Monitor, Moon, Pencil, Share2, Sun } from 'lucide-react';
import { mergePrograms } from '../../../utils';
import { askName, showMessage } from '../platform/dialogs';
import { exportClassFile, formatBytes, formatDateTime } from '../platform/exporting';
import { canShareFile, pickWithInput } from '../platform/fileAccess';
import { getClass, requestPersistentStorage, storageInfo, updateClassMeta, type ClassRecord } from '../platform/library';
import { describeError } from '../platform/session';
import { switchUi } from '../uiMode';
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
        <button type="button" onClick={onClick} disabled={disabled} className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-slate-50 dark:active:bg-zinc-800 disabled:opacity-50">
            <span className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-300 inline-flex items-center justify-center shrink-0">{icon}</span>
            <span className="flex-1 min-w-0">
                <span className="block font-medium text-slate-900 dark:text-zinc-50">{title}</span>
                {detail && <span className="block text-xs text-slate-500 dark:text-zinc-400">{detail}</span>}
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

const MoreScreen: React.FC<Props> = ({ doc, classId, className, onRenamed, onCloseClass }) => {
    const snack = useSnack();
    const [record, setRecord] = useState<ClassRecord | null>(null);
    const [storage, setStorage] = useState<{ usage: number; quota: number; persisted: boolean } | null>(null);
    const [busy, setBusy] = useState(false);

    const refresh = async () => {
        setRecord((await getClass(classId)) ?? null);
        setStorage(await storageInfo());
    };
    useEffect(() => { void refresh(); }, [classId, doc.saveState]);

    const exportFile = async (how: 'auto' | 'download' | 'share') => {
        setBusy(true);
        try {
            await doc.flush();
            const outcome = await exportClassFile(classId, how);
            if (outcome === 'downloaded') snack('Fichier téléchargé (dossier Téléchargements).', { kind: 'success' });
            else if (outcome !== 'cancelled') snack('Fichier exporté.', { kind: 'success' });
            await refresh();
        } catch (error) {
            await showMessage('Exportation impossible', describeError(error));
        } finally {
            setBusy(false);
        }
    };

    const rename = async () => {
        const answer = await askName('Renommer la classe', 'Nom de la classe', className, 'Renommer');
        if (!answer) return;
        await updateClassMeta(classId, { name: answer.name });
        onRenamed(answer.name);
    };

    const importProgram = async () => {
        const file = await pickWithInput(matchMedia('(pointer: coarse)').matches ? undefined : '.competences,.json');
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
        await showMessage('Stockage', ok ? 'Le navigateur conservera les données de cet appareil, même en cas de manque de place.' : "Le navigateur n'a pas accordé la protection (elle est souvent accordée à l'application une fois installée sur l'écran d'accueil). Exportez régulièrement vos classes.");
    };

    const theme = doc.data.uiSettings.theme;
    const lastExport = record?.exportedAt;
    const modifiedSinceExport = !lastExport || (record && record.updatedAt > lastExport);
    const shareable = typeof navigator.share === 'function' && canShareFile(new Blob([]), 'x.envolees');

    return (
        <div className="px-4 pt-4 pb-28 space-y-6">
            <Group title={className}>
                <Row icon={shareable ? <Share2 className="w-5 h-5" /> : <Download className="w-5 h-5" />} disabled={busy}
                    title={shareable ? 'Partager le fichier .envolees' : 'Exporter le fichier .envolees'}
                    detail={<>Sauvegarde, ou ouverture sur ordinateur. {lastExport ? `Dernier export ${formatDateTime(lastExport)}` : 'Jamais exportée'}{modifiedSinceExport && <strong className="text-amber-600 dark:text-amber-400"> · modifiée depuis</strong>}</>}
                    onClick={() => exportFile('auto')} />
                {shareable && <Row icon={<Download className="w-5 h-5" />} title="Télécharger le fichier" disabled={busy} onClick={() => exportFile('download')} />}
                <Row icon={<Pencil className="w-5 h-5" />} title="Renommer la classe" onClick={rename} />
                <Row icon={<FileUp className="w-5 h-5" />} title="Importer un programme (.competences)" detail="Fusionné avec les programmes de la classe" onClick={importProgram} />
                <Row icon={<FolderOpen className="w-5 h-5" />} title="Changer de classe" onClick={onCloseClass} />
            </Group>

            <Group title="Affichage">
                <Row icon={theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />} title={theme === 'dark' ? 'Thème clair' : 'Thème sombre'}
                    onClick={() => doc.update(d => ({ ...d, uiSettings: { ...d.uiSettings, theme: d.uiSettings.theme === 'dark' ? 'light' : 'dark' } }), { skipHistory: true })} />
                <Row icon={<Monitor className="w-5 h-5" />} title="Version ordinateur"
                    detail="Programme, livret, ateliers, mode élève, réglages : toute l'application, pour un grand écran ou une tablette."
                    onClick={async () => { await doc.flush(); switchUi('desktop'); }} />
            </Group>

            <Group title="Cet appareil">
                <Row icon={<HardDrive className="w-5 h-5" />} title="Stockage"
                    detail={storage ? `${formatBytes(storage.usage)} utilisés · ${storage.persisted ? 'données protégées' : 'toucher pour protéger les données'}` : 'Informations indisponibles'}
                    onClick={storage && !storage.persisted ? protect : undefined} />
                <Row icon={<BookOpen className="w-5 h-5" />} title="Guide d'utilisation" onClick={() => window.open(`./guide/index.html?theme=${theme}`, '_blank', 'noopener')} />
            </Group>

            <p className="text-center text-xs text-slate-400 dark:text-zinc-500">
                Envolées {__APP_VERSION__} · version web<br />
                Les données restent sur cet appareil ; rien n'est envoyé sur Internet.
                {doc.lastError && <><br /><span className="text-red-600">Dernier enregistrement en échec : {doc.lastError}</span></>}
            </p>
        </div>
    );
};

export default MoreScreen;
