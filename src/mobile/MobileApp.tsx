// Interface mobile : accueil (classes de l'appareil) puis classe ouverte (élèves, validation, ateliers, plus).
import React, { useEffect, useMemo, useState } from 'react';
import { Ellipsis, ListChecks, Monitor, Redo2, Shapes, Undo2, Users } from 'lucide-react';
import { createEmptyAppData } from '../../app/fileFormat/defaults';
import { prepareForSave } from '../../app/fileFormat/fileIO';
import ClassLibrary from '../platform/ClassLibrary';
import { askName, showMessage } from '../platform/dialogs';
import { onLaterLaunch, type LaunchedFile } from '../platform/launch';
import type { ClassRecord } from '../platform/library';
import { closeClass, createAndOpenClass, describeError, importClassFile, openClass } from '../platform/session';
import { switchUi } from '../uiMode';
import MoreScreen from './MoreScreen';
import { pendingPasses } from './model';
import StudentFormSheet from './StudentFormSheet';
import StudentScreen from './StudentScreen';
import StudentsScreen from './StudentsScreen';
import { BottomNav, Btn, IconButton, SnackbarProvider, TopBar } from './ui';
import { useClassDocument, type SaveState } from './useClassDocument';
import ValidateScreen from './ValidateScreen';
import WorkshopsScreen from './WorkshopsScreen';

type Tab = 'students' | 'validate' | 'workshops' | 'more';

const MobileApp: React.FC<{ launchFiles: Promise<LaunchedFile[]> }> = ({ launchFiles }) => {
    const [record, setRecord] = useState<ClassRecord | null>(null);
    const [busy, setBusy] = useState(true);

    const open = async (getId: () => Promise<string | null>) => {
        setBusy(true);
        try {
            const id = await getId();
            if (id) setRecord(await openClass(id));
        } catch (error) {
            await showMessage("Impossible d'ouvrir la classe", describeError(error));
        } finally {
            setBusy(false);
        }
    };

    // Fichier transmis au démarrage (application installée) : ouvert directement.
    useEffect(() => {
        void launchFiles.then(files => {
            if (files.length) void open(() => importClassFile(files[0]));
            else setBusy(false);
        });
        onLaterLaunch(files => { if (files.length) void showMessage('Fichier reçu', `Pour ouvrir « ${files[0].file.name} », revenez à l'accueil (Plus › Changer de classe) puis ouvrez-le.`); });
    }, []);

    const createNew = async () => {
        const answer = await askName('Nouvelle classe', 'Nom de la classe', `Classe ${new Date().getFullYear()}`, 'Créer');
        if (!answer) return;
        await open(async () => {
            const data = createEmptyAppData(matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
            const { dataJson } = await prepareForSave(data);
            const created = await createAndOpenClass({ name: answer.name, dataJson, images: [] });
            return created.id;
        });
    };

    if (!record) {
        return (
            <SnackbarProvider bottomOffset={16}>
                <div className="h-full overflow-y-auto bg-slate-100 dark:bg-zinc-950">
                    <div className="max-w-xl mx-auto px-4 pb-10" style={{ paddingTop: 'calc(1.5rem + env(safe-area-inset-top))' }}>
                        <div className="flex items-center gap-3 mb-6">
                            <img src="./icons/icon.svg" alt="" className="w-12 h-12" />
                            <div>
                                <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">Envolées</h1>
                                <p className="text-sm text-slate-500 dark:text-zinc-400">Suivi des compétences en maternelle</p>
                            </div>
                        </div>
                        <h2 className="font-semibold text-slate-800 dark:text-zinc-100 mb-3">Mes classes</h2>
                        <ClassLibrary busy={busy} onOpen={id => open(async () => id)} onImport={() => open(() => importClassFile())} />
                        <div className="mt-4 grid gap-2">
                            <Btn block disabled={busy} onClick={createNew}>Nouvelle classe</Btn>
                            <Btn block onClick={() => switchUi('desktop')}><Monitor className="w-5 h-5" /> Version ordinateur</Btn>
                        </div>
                        <p className="mt-6 text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                            Pour retrouver une classe préparée sur ordinateur : exportez-la en fichier <strong>.envolees</strong> (Menu › Enregistrer sous), envoyez-la sur ce téléphone (Drive, e-mail, câble…), puis « Ouvrir un fichier .envolees ».
                            Les données restent sur cet appareil.
                        </p>
                    </div>
                </div>
            </SnackbarProvider>
        );
    }

    return (
        <SnackbarProvider bottomOffset={80}>
            <ClassWorkspace key={record.id} record={record} onClose={() => { closeClass(); setRecord(null); }} />
        </SnackbarProvider>
    );
};

const SAVE_LABELS: Record<SaveState, string> = {
    saved: 'Enregistré sur cet appareil',
    pending: 'Modifications en cours…',
    saving: 'Enregistrement…',
    error: "Échec de l'enregistrement",
};

const ClassWorkspace: React.FC<{ record: ClassRecord; onClose: () => void }> = ({ record, onClose }) => {
    const doc = useClassDocument(record.dataJson);
    const [tab, setTab] = useState<Tab>('students');
    const [studentId, setStudentId] = useState<string | null>(null);
    const [form, setForm] = useState<{ studentId: string | null } | null>(null);
    const [name, setName] = useState(record.name);
    const pending = useMemo(() => pendingPasses(doc.data).length, [doc.data.workshopEvents]);
    const student = studentId ? doc.data.students.find(s => s.id === studentId) ?? null : null;

    useEffect(() => { if (studentId && !student) setStudentId(null); }, [studentId, student]);
    useEffect(() => { document.title = `${name} — Envolées`; return () => { document.title = 'Envolées'; }; }, [name]);

    // Retour du téléphone (geste « précédent ») : ferme la fiche élève plutôt que de quitter l'application.
    useEffect(() => {
        if (!studentId) return;
        window.history.pushState({ envolees: 'student' }, '');
        const onPop = () => setStudentId(null);
        window.addEventListener('popstate', onPop);
        return () => window.removeEventListener('popstate', onPop);
    }, [studentId]);
    const closeStudent = () => { if (window.history.state?.envolees === 'student') window.history.back(); else setStudentId(null); };

    const closeClassAndFlush = async () => { await doc.flush(); onClose(); };

    const undoRedo = (
        <>
            <IconButton label="Annuler" disabled={!doc.canUndo} onClick={doc.undo}><Undo2 className="w-5 h-5" /></IconButton>
            <IconButton label="Rétablir" disabled={!doc.canRedo} onClick={doc.redo}><Redo2 className="w-5 h-5" /></IconButton>
        </>
    );

    const titles: Record<Tab, string> = { students: name, validate: 'Validation groupée', workshops: 'Ateliers', more: 'Plus' };

    return (
        <div className="h-full overflow-y-auto bg-slate-100 dark:bg-zinc-950" id="mobile-scroll">
            {student && tab === 'students' ? (
                <StudentScreen doc={doc} student={student} onBack={closeStudent} onEdit={() => setForm({ studentId: student.id })} />
            ) : (
                <>
                    <TopBar title={titles[tab]} subtitle={tab === 'students' ? `${doc.data.students.length} élève${doc.data.students.length > 1 ? 's' : ''} · ${SAVE_LABELS[doc.saveState]}` : SAVE_LABELS[doc.saveState]} actions={undoRedo} />
                    {tab === 'students' && <StudentsScreen data={doc.data} onOpenStudent={setStudentId} onAddStudent={() => setForm({ studentId: null })} />}
                    {tab === 'validate' && <ValidateScreen doc={doc} />}
                    {tab === 'workshops' && <WorkshopsScreen doc={doc} />}
                    {tab === 'more' && <MoreScreen doc={doc} classId={record.id} className={name} onRenamed={setName} onCloseClass={closeClassAndFlush} />}
                </>
            )}
            <BottomNav<Tab> active={tab} onChange={t => { setTab(t); setStudentId(null); document.getElementById('mobile-scroll')?.scrollTo(0, 0); }}
                items={[
                    { id: 'students', label: 'Élèves', icon: <Users className="w-6 h-6" /> },
                    { id: 'validate', label: 'Valider', icon: <ListChecks className="w-6 h-6" /> },
                    { id: 'workshops', label: 'Ateliers', icon: <Shapes className="w-6 h-6" />, badge: pending },
                    { id: 'more', label: 'Plus', icon: <Ellipsis className="w-6 h-6" /> },
                ]} />
            {form && (
                <StudentFormSheet doc={doc} student={form.studentId ? doc.data.students.find(s => s.id === form.studentId) ?? null : null}
                    onClose={() => setForm(null)} onDeleted={() => setStudentId(null)} />
            )}
        </div>
    );
};

export default MobileApp;
