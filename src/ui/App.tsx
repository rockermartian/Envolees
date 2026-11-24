// Interface web d'Envolées (ordinateur et tablette) : accueil, puis classe ouverte.
import React, { useEffect, useMemo, useState } from 'react';
import { Cloud, FolderOpen, ListChecks, Plus, Redo2, School, ScanLine, Shapes, Undo2, Users } from 'lucide-react';
import { isPinDefined } from '../../core/domain/studentMode';
import { createEmptyAppData } from '../../core/fileFormat/defaults';
import { prepareForSave } from '../../core/fileFormat/fileIO';
import ClassLibrary from '../platform/ClassLibrary';
import { askName, showMessage } from '../platform/dialogs';
import { onLaterLaunch, type LaunchedFile } from '../platform/launch';
import type { ClassRecord } from '../platform/library';
import { pickClassFromNuage } from '../platform/nuageAssist';
import { closeClass, createAndOpenClass, describeError, importClassFile, openClass } from '../platform/session';
import ClassScreen from './ClassScreen';
import { pendingPasses } from './model';
import StudentFormSheet from './StudentFormSheet';
import StudentScreen from './StudentScreen';
import StudentsScreen from './StudentsScreen';
import { Btn, EmptyState, IconButton, NavBar, SnackbarProvider, TopBar } from './ui';
import { useClassDocument, type ClassDocument, type SaveState } from './useClassDocument';
import { useMediaQuery } from './useMediaQuery';
import StudentMode from './StudentMode';
import { PinSetupSheet } from './StudentModeSettings';
import ValidateScreen from './ValidateScreen';
import WorkshopsScreen from './WorkshopsScreen';

type Section = 'students' | 'validate' | 'workshops' | 'class';

const App: React.FC<{ launchFiles: Promise<LaunchedFile[]> }> = ({ launchFiles }) => {
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

    // Fichier transmis au démarrage (application installée, double-clic sur un .envolees) : ouvert directement.
    useEffect(() => {
        void launchFiles.then(files => {
            if (files.length) void open(() => importClassFile(files[0]));
            else setBusy(false);
        });
        onLaterLaunch(files => {
            if (files.length) void showMessage('Fichier reçu', `Pour ouvrir « ${files[0].file.name} », revenez à l'accueil (Classe › Changer de classe), puis « Ouvrir un fichier ».`);
        });
    }, []);

    const createNew = async () => {
        const answer = await askName('Nouvelle classe', 'Nom de la classe', `Classe ${new Date().getFullYear()}`, 'Créer');
        if (!answer) return;
        await open(async () => {
            const data = createEmptyAppData(matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
            const { dataJson } = await prepareForSave(data);
            return (await createAndOpenClass({ name: answer.name, dataJson, images: [] })).id;
        });
    };

    return (
        <SnackbarProvider>
            {record
                ? <Workspace key={record.id} record={record} onClose={() => { closeClass(); setRecord(null); }} />
                : <Home busy={busy} onOpen={id => open(async () => id)} onImport={() => open(() => importClassFile())}
                    onNuage={() => open(async () => { const picked = await pickClassFromNuage(); return picked ? importClassFile(picked) : null; })}
                    onNew={createNew} />}
        </SnackbarProvider>
    );
};

// ---------------------------------------------------------------------------------------------
// Accueil
// ---------------------------------------------------------------------------------------------

const isIosBrowserTab = () =>
    /iPad|iPhone|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document && !(navigator as Navigator & { standalone?: boolean }).standalone && !matchMedia('(display-mode: standalone)').matches;

const Home: React.FC<{ busy: boolean; onOpen: (id: string) => void; onImport: () => void; onNuage: () => void; onNew: () => void }> = ({ busy, onOpen, onImport, onNuage, onNew }) => (
    <div className="h-full overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 pb-12" style={{ paddingTop: 'calc(2rem + env(safe-area-inset-top))' }}>
            <div className="flex items-center gap-4 mb-8">
                <img src="./icons/icon.svg" alt="" className="w-14 h-14" />
                <div>
                    <h1 className="text-3xl font-bold text-blue-600 dark:text-blue-400">Envolées</h1>
                    <p className="text-slate-500 dark:text-zinc-400">Suivi des compétences en maternelle</p>
                </div>
            </div>
            {isIosBrowserTab() && (
                <div role="note" className="mb-6 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 px-5 py-4 text-sm">
                    <strong>Sur iPad, installez Envolées</strong> : bouton Partager › « Sur l'écran d'accueil ». Sinon, Safari efface les données d'un site après 7 jours sans visite.
                </div>
            )}
            <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
                <section>
                    <h2 className="font-semibold text-slate-800 dark:text-zinc-100 mb-3">Mes classes sur cet appareil</h2>
                    <ClassLibrary busy={busy} onOpen={onOpen} onImport={onImport} />
                </section>
                <section className="space-y-3">
                    <h2 className="font-semibold text-slate-800 dark:text-zinc-100">Ouvrir ou créer</h2>
                    <Btn block tone="primary" disabled={busy} onClick={onNuage}><Cloud className="w-5 h-5" /> Ouvrir depuis Nuage</Btn>
                    <Btn block disabled={busy} onClick={onImport}><FolderOpen className="w-5 h-5" /> Ouvrir un fichier .envolees</Btn>
                    <Btn block disabled={busy} onClick={onNew}><Plus className="w-5 h-5" /> Nouvelle classe</Btn>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed pt-2">
                        Les classes de l'application Envolées pour ordinateur s'ouvrent ici telles quelles (fichier .envolees), et inversement.
                        Les données restent sur cet appareil ; Nuage, le cloud de l'Éducation nationale, sert à les sauvegarder et à les retrouver ailleurs.
                    </p>
                </section>
            </div>
        </div>
    </div>
);

// ---------------------------------------------------------------------------------------------
// Classe ouverte
// ---------------------------------------------------------------------------------------------

const SAVE_LABELS: Record<SaveState, string> = {
    saved: 'Enregistré sur cet appareil',
    pending: 'Modifications en cours…',
    saving: 'Enregistrement…',
    error: "Échec de l'enregistrement",
};

const Workspace: React.FC<{ record: ClassRecord; onClose: () => void }> = ({ record, onClose }) => {
    const doc = useClassDocument(record.dataJson);
    const [section, setSection] = useState<Section>('students');
    const [name, setName] = useState(record.name);
    const [studentMode, setStudentMode] = useState<'off' | 'pin-setup' | 'on'>('off');
    const startStudentMode = () => setStudentMode(isPinDefined(doc.data.teacherConfig.studentModePin) ? 'on' : 'pin-setup');
    const pending = useMemo(() => pendingPasses(doc.data).length, [doc.data.workshopEvents]);

    useEffect(() => { document.title = `${name} — Envolées`; return () => { document.title = 'Envolées'; }; }, [name]);

    // Ctrl+Z / Ctrl+Y (clavier d'ordinateur ou de tablette), hors champs de saisie.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (!(e.ctrlKey || e.metaKey) || (e.target as HTMLElement).closest('input, textarea, select')) return;
            const key = e.key.toLowerCase();
            if (key === 'z' && !e.shiftKey) { e.preventDefault(); doc.undo(); }
            else if (key === 'y' || (key === 'z' && e.shiftKey)) { e.preventDefault(); doc.redo(); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [doc.undo, doc.redo]);

    const undoRedo = (
        <>
            <IconButton label="Annuler (Ctrl+Z)" disabled={!doc.canUndo} onClick={doc.undo}><Undo2 className="w-5 h-5" /></IconButton>
            <IconButton label="Rétablir (Ctrl+Y)" disabled={!doc.canRedo} onClick={doc.redo}><Redo2 className="w-5 h-5" /></IconButton>
        </>
    );
    const subtitle = `${name} · ${SAVE_LABELS[doc.saveState]}`;

    return (
        <>
            <NavBar<Section> active={section} onChange={setSection}
                header={<img src="./icons/icon.svg" alt="Envolées" className="w-11 h-11" />}
                items={[
                    { id: 'students', label: 'Élèves', icon: <Users className="w-6 h-6" /> },
                    { id: 'validate', label: 'Valider', icon: <ListChecks className="w-6 h-6" /> },
                    { id: 'workshops', label: 'Ateliers', icon: <Shapes className="w-6 h-6" />, badge: pending },
                    { id: 'class', label: 'Classe', icon: <School className="w-6 h-6" /> },
                ]} />
            <main className="h-full" style={{ paddingLeft: 'var(--rail-w)', paddingBottom: 'var(--nav-h)' }}>
                {section === 'students' && <StudentsSection doc={doc} subtitle={subtitle} actions={undoRedo} />}
                {section === 'validate' && (
                    <Scroll><TopBar title="Validation groupée" subtitle={subtitle} actions={undoRedo} /><ValidateScreen doc={doc} /></Scroll>
                )}
                {section === 'workshops' && (
                    <Scroll>
                        <TopBar title="Ateliers" subtitle={subtitle} actions={<>{undoRedo}<button type="button" onClick={startStudentMode} className="ml-2 min-h-11 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold inline-flex items-center gap-2"><ScanLine className="w-5 h-5" /> Mode élève</button></>} />
                        <WorkshopsScreen doc={doc} />
                    </Scroll>
                )}
                {section === 'class' && (
                    <Scroll>
                        <TopBar title={name} subtitle={SAVE_LABELS[doc.saveState]} actions={undoRedo} />
                        <ClassScreen doc={doc} classId={record.id} className={name} onRenamed={setName} onCloseClass={async () => { await doc.flush(); onClose(); }} />
                    </Scroll>
                )}
            </main>
            {studentMode === 'pin-setup' && <PinSetupSheet doc={doc} onDone={saved => setStudentMode(saved ? 'on' : 'off')} />}
            {studentMode === 'on' && <StudentMode doc={doc} onExit={() => setStudentMode('off')} />}
        </>
    );
};

const Scroll: React.FC<{ children: React.ReactNode }> = ({ children }) => <div className="h-full overflow-y-auto">{children}</div>;

// Élèves : liste et fiche côte à côte sur grand écran ; l'une puis l'autre sur tablette en portrait.
const StudentsSection: React.FC<{ doc: ClassDocument; subtitle: string; actions: React.ReactNode }> = ({ doc, subtitle, actions }) => {
    const wide = useMediaQuery('(min-width: 1024px)');
    const [studentId, setStudentId] = useState<string | null>(null);
    const [form, setForm] = useState<{ studentId: string | null } | null>(null);
    const student = studentId ? doc.data.students.find(s => s.id === studentId) ?? null : null;
    useEffect(() => { if (studentId && !student) setStudentId(null); }, [studentId, student]);

    const list = (
        <Scroll>
            <TopBar title={`Élèves (${doc.data.students.length})`} subtitle={wide ? subtitle : subtitle}
                actions={<>{!wide && actions}<IconButton label="Ajouter un élève" onClick={() => setForm({ studentId: null })}><Plus className="w-6 h-6" /></IconButton></>} />
            <StudentsScreen data={doc.data} selectedId={wide ? studentId : null} onOpenStudent={setStudentId} onAddStudent={() => setForm({ studentId: null })} />
        </Scroll>
    );
    const detail = student && (
        <Scroll>
            <StudentScreen doc={doc} student={student} onBack={wide ? undefined : () => setStudentId(null)} onEdit={() => setForm({ studentId: student.id })} actions={actions} />
        </Scroll>
    );

    return (
        <>
            {wide ? (
                <div className="h-full grid grid-cols-[24rem_1fr]">
                    <div className="h-full border-r border-slate-200 dark:border-zinc-800 min-w-0">{list}</div>
                    <div className="h-full min-w-0">{detail ?? <EmptyState title="Choisissez un élève" icon={<Users className="w-12 h-12" />}>Sa fiche s'affiche ici : compétences par domaine, validation au toucher, photos.</EmptyState>}</div>
                </div>
            ) : (detail ?? list)}
            {form && (
                <StudentFormSheet doc={doc} student={form.studentId ? doc.data.students.find(s => s.id === form.studentId) ?? null : null}
                    onClose={() => setForm(null)} onDeleted={() => setStudentId(null)} />
            )}
        </>
    );
};

export default App;
