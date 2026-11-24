import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Student, Section, Sex, SchoolProgram, AppData, AppUISettings, TeacherConfig, SkillAcquisitionDetails, SupportGroup } from './types';
import { mergePrograms } from './utils';
import { purgeWorkshopEvents, recordAutoValidation, recordScan, setEventsOutcome } from './domain/workshops';
import useUndoRedo, { UpdateOptions } from './hooks/useUndoRedo';
import StudentList from './components/StudentList';
import StudentDetail from './components/StudentDetail';
import ClassSynthesis from './components/ClassSynthesis';
import ConfirmationModal from './components/ConfirmationModal';
import ExportModal from './components/ExportModal';
import StudentForm from './components/StudentForm';
import SkillsView from './components/SkillsView';
import LivretView from './components/LivretView';
import ReportsView from './components/ReportsView';
import WorkshopsView from './components/WorkshopsView';
import SettingsView from './components/SettingsView';
import StudentMode from './components/StudentMode';
import SaveStatusIndicator from './components/SaveStatusIndicator';
import FileMenu from './components/FileMenu';
import WindowControls from './components/WindowControls';
import WelcomeScreen from './components/WelcomeScreen';
import ExitModal from './components/ExitModal';
import MassValidationModal from './components/MassValidationModal';
import PromoteModal from './components/PromoteModal';
import Tooltip from './components/Tooltip';
import StudentImportModal, { ImportEntry, ImportDecision } from './components/StudentImportModal';
import ToastHost from './components/ToastHost';
import ErrorBoundary, { ErrorPanel } from './components/ErrorBoundary';
import PinSetupModal from './components/PinSetupModal';
import NuageModal, { NuageEntry, NuageStatus } from './components/NuageModal';
import { isPinDefined } from './domain/studentMode';
import { deleteTreeItems } from './domain/skillTree';
import { addStudent, applyMassValidation, applyStudentImport, classifyImportedStudents, deleteDomainPeriod, deleteStudent, promoteStudents, setDomainComment, setSkillDetails, setStudentComment, toggleAllLivretProcessed, toggleLivretProcessed, unmatchedSkillPrograms, updateStudentFields } from './domain/students';
import { buildStudentsArchive, readStudentsArchive } from './fileFormat/studentsArchive';
import { toast } from './utils/toast';
import { parseOpenedData, prepareForSave } from './fileFormat/fileIO';
import { createEmptyAppData } from './fileFormat/defaults';
import { todayLocalISO } from './domain/dates';

declare global {
  interface Window {
    electronAPI: {
      // Fichiers de classe : seul data.json transite ; les images restent dans le processus principal.
      openFile: () => Promise<{ dataJson: string; filePath: string } | { error: string } | null>;
      openLastFile: () => Promise<{ dataJson: string; filePath: string } | { error: string }>;
      getLastFileName: () => Promise<string | null>;
      saveFile: (dataJson: string, refs: string[]) => Promise<{ success: boolean; error?: string }>;
      saveFileAs: (dataJson: string, refs: string[], options?: { newFile?: boolean }) => Promise<{ success: boolean; path?: string; error?: string } | null>;
      putImage: (bytes: Uint8Array, mime: string) => Promise<string>;
      openBackupsFolder: () => Promise<{ success?: boolean; error?: string }>;
      // Dossier choisi dans une boîte de dialogue : l'interface ne reçoit qu'un jeton (et un libellé).
      selectDirectory: () => Promise<{ token: string; label: string } | null>;
      // Sans option : renvoie le PDF (base64). Avec dirToken + fileName : l'écrit dans ce dossier.
      generateLivretPdf: (options?: { dirToken: string; fileName: string }) => Promise<{ success: boolean; data?: string; error?: string }>;
      openImageFile: () => Promise<string | { error: string } | null>;
      showUnsavedDialog: () => Promise<number>;
      minimizeWindow: () => void;
      maximizeWindow: () => void;
      closeWindow: () => void;
      onWindowMaximized: (callback: () => void) => void;
      onWindowUnmaximized: (callback: () => void) => void;
      removeWindowMaximizeListeners: () => void;
      onCloseRequested: (callback: () => Promise<void>) => () => void;
      forceCloseApp: () => void;
      openGuide: (theme?: string) => Promise<void>;
      // Nuage (cloud de l'Éducation nationale) : voir electron/nuage.js.
      nuageStatus: () => Promise<NuageStatus>;
      nuageConnect: () => Promise<NuageStatus | { error: string; code?: string }>;
      nuageCancelConnect: () => Promise<void>;
      nuageDisconnect: () => Promise<NuageStatus>;
      nuageUpload: () => Promise<{ success: true; remotePath: string; replaced: boolean; size: number } | { error: string; code?: string }>;
      nuageList: (folder?: string) => Promise<{ folder: string; entries: NuageEntry[] } | { error: string; code?: string }>;
      nuageOpen: (remotePath: string) => Promise<{ dataJson: string; filePath: string } | { error: string; code?: string } | null>;
      onNuageProgress: (callback: (progress: { sent: number; total: number }) => void) => () => void;
      // Version web uniquement : Nuage refuse les requêtes venant d'un site, l'envoi et l'ouverture
      // passent par le navigateur (partage, onglet Nuage). Absent dans l'application Electron.
      nuageAssisted?: {
        send: () => Promise<{ message: string } | null>;
        open: () => Promise<{ dataJson: string; filePath: string } | { error: string } | null>;
      };
    };
  }
}

interface StudentFormData {
    id: string | null;
    firstName: string;
    lastName: string;
    photo: string | null;
    dob: string;
    section: Section;
    contactEmail?: string;
    ine?: string;
    sex: Sex;
    miscInfo?: string;
}

/** Annuler / Rétablir ne touchent pas aux réglages d'interface (thème, panneaux…), hors historique. */
const keepUiSettings = (restored: AppData | null, current: AppData | null): AppData | null =>
    restored && current ? { ...restored, uiSettings: current.uiSettings } : restored;

const getInitialData = (): AppData =>
    createEmptyAppData(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

// --- ICONS ---
const MoonIcon: React.FC<{ className?: string }> = ({ className }) => ( <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" /></svg>);
const SunIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" /></svg>);
const UndoIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" /></svg>);
const RedoIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" /></svg>);


/** Nom affiché d'un fichier de classe (sans dossier ni extension). */
const fileNameOf = (filePath: string): string | null =>
    filePath.split(/[\\/]/).pop()?.replace(/\.envolees$/i, '') ?? null;

// Délai entre la dernière modification et l'enregistrement automatique.
const AUTOSAVE_DEBOUNCE_MS = 30_000;

type SaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error';
type AppTab = 'class' | 'skills' | 'livret' | 'settings' | 'workshops' | 'student_mode' | 'reports';

const App: React.FC = () => {
  // Utilisation de useUndoRedo à la place de useState pour appData
  const {
    state: appData,
    setState: setAppData,
    undo,
    redo,
    resetState,
    canUndo,
    canRedo
  } = useUndoRedo<AppData | null>(null, keepUiSettings);

  const [isDirty, setIsDirty] = useState(false);
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  // Nom du dernier fichier ouvert (son chemin reste dans le processus principal).
  const [lastFileName, setLastFileName] = useState<string | null>(null);
  useEffect(() => { window.electronAPI?.getLastFileName().then(setLastFileName).catch(() => {}); }, []);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [isFileOperationLoading, setIsFileOperationLoading] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showStudentModeConfirm, setShowStudentModeConfirm] = useState(false);
  const [showPinSetup, setShowPinSetup] = useState(false); // code PIN à définir avant le mode élève
  const [nuageMode, setNuageMode] = useState<'upload' | 'open' | null>(null);

  const [activeTab, setActiveTab] = useState<AppTab>('class');
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ studentId: string; studentName: string } | null>(null);

  const [isMassValidationOpen, setIsMassValidationOpen] = useState(false);
  const [isPromoteModalOpen, setIsPromoteModalOpen] = useState(false);

  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isStudentFormOpen, setIsStudentFormOpen] = useState(false);
  const [studentToEdit, setStudentToEdit] = useState<Student | null>(null);
  const [highlightedSkillId, setHighlightedSkillId] = useState<string | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [studentImportData, setStudentImportData] = useState<{ entries: ImportEntry[]; unmatchedPrograms: SchoolProgram[] } | null>(null);

  const studentImportRef = useRef<HTMLInputElement>(null);

  // Valeurs courantes lues par les minuteurs et les écouteurs (évite les closures périmées).
  const appDataRef = useRef(appData);
  appDataRef.current = appData;
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;
  const currentFilePathRef = useRef(currentFilePath);
  currentFilePathRef.current = currentFilePath;
  const isSavingRef = useRef(false);
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const saveQueueRef = useRef<Promise<unknown>>(Promise.resolve());

  const markDirty = () => {
    setIsDirty(true);
    setSaveStatus('unsaved');
  };

  // Annuler / Rétablir modifient les données : le fichier doit être marqué « modifié ».
  const handleUndo = () => {
    if (!canUndo) return;
    undo();
    markDirty();
  };
  const handleRedo = () => {
    if (!canRedo) return;
    redo();
    markDirty();
  };

  // Gestion des raccourcis clavier Ctrl+Z / Ctrl+Y
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeTabRef.current === 'student_mode') return; // pas d'Annuler/Rétablir pour les enfants
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
         return;
      }
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      const wantsRedo = key === 'y' || (key === 'z' && e.shiftKey);
      const wantsUndo = key === 'z' && !e.shiftKey;
      if (wantsUndo && canUndo) {
        e.preventDefault();
        undo();
        markDirty();
      } else if (wantsRedo && canRedo) {
        e.preventDefault();
        redo();
        markDirty();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, canUndo, canRedo]);


  // --- App Data Wrappers ---
  const updateAppData = (updater: (prev: AppData) => AppData, options?: UpdateOptions) => {
    setAppData((prev: AppData | null) => (prev ? updater(prev) : prev), options);
    markDirty();
  };

  // Enregistre `data` dans `path`. Les enregistrements sont mis en file : jamais deux en parallèle.
  // Le fichier n'est marqué « enregistré » que si les données n'ont pas changé pendant l'écriture.
  const doSave = async (path: string, data: AppData): Promise<boolean> => {
      if (!window.electronAPI) {
          console.warn("Electron API not available, cannot save.");
          return false;
      }
      isSavingRef.current = true;
      setSaveStatus('saving');
      try {
          const { dataJson, refs } = await prepareForSave(data);
          const result = await window.electronAPI.saveFile(dataJson, refs);
          if (!result?.success) throw new Error(result?.error || 'erreur inconnue');
          if (appDataRef.current === data) {
              setIsDirty(false);
              setSaveStatus('saved');
          } else {
              setSaveStatus('unsaved');
          }
          return true;
      } catch (error) {
          console.error('Save failed:', error);
          setSaveStatus('error');
          toast.error(`L'enregistrement a échoué : ${error instanceof Error ? error.message : String(error)}`);
          return false;
      } finally {
          isSavingRef.current = false;
      }
  };

  const performSave = (path: string, data: AppData): Promise<boolean> => {
      const run = saveQueueRef.current.then(() => doSave(path, data));
      saveQueueRef.current = run.catch(() => undefined);
      return run;
  };

  // --- Enregistrement automatique ---
  // 1) `AUTOSAVE_DEBOUNCE_MS` après la dernière modification (l'enregistrement ne fige plus l'interface) ;
  // 2) au plus tard toutes les N minutes pendant un travail continu (réglage, 0 = désactivé).
  const autoSaveMinutes = appData?.uiSettings?.autoSaveInterval ?? 5;
  const autoSave = () => {
      const data = appDataRef.current;
      const path = currentFilePathRef.current;
      if (isDirtyRef.current && path && data && !isSavingRef.current) performSave(path, data);
  };
  useEffect(() => {
    if (!(autoSaveMinutes > 0) || !isDirty) return;
    const timer = setTimeout(autoSave, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [appData, isDirty, autoSaveMinutes]);
  useEffect(() => {
    if (!(autoSaveMinutes > 0)) return;
    const timer = setInterval(autoSave, autoSaveMinutes * 60 * 1000);
    return () => clearInterval(timer);
  }, [autoSaveMinutes]);

  // --- Close Warning Logic (Custom Modal) ---
  useEffect(() => {
      if (!window.electronAPI) return;
      return window.electronAPI.onCloseRequested(async () => {
          // Mode élève : un enfant ne peut pas fermer l'application (Alt+F4…) ; il faut d'abord
          // quitter le mode élève avec le code PIN. L'accusé de réception est envoyé par le preload.
          if (activeTabRef.current === 'student_mode') return;
          if (isDirtyRef.current) {
              setShowExitModal(true);
          } else {
              window.electronAPI.forceCloseApp();
          }
      });
  }, []);

  const handleExitSave = async () => {
      const data = appDataRef.current;
      const path = currentFilePathRef.current;
      if (!data) return;
      const success = path ? await performSave(path, data) : await saveAs();
      if (success) window.electronAPI.forceCloseApp();
      // En cas d'échec ou d'annulation, la modale reste ouverte : l'utilisateur choisit.
  };

  const handleExitWithoutSave = () => {
      window.electronAPI.forceCloseApp();
  };

  const handleManualSave = () => {
      if (currentFilePath && appData) {
          performSave(currentFilePath, appData);
      } else {
          handleSaveAs();
      }
  };

  /**
   * À appeler avant de remplacer le fichier courant (Nouveau, Ouvrir).
   * Renvoie true si l'on peut continuer : rien à enregistrer, abandon volontaire,
   * ou enregistrement réussi. En cas d'échec, le fichier courant reste ouvert.
   */
  const confirmLeaveCurrentFile = async (): Promise<boolean> => {
      const data = appDataRef.current;
      if (!isDirtyRef.current || !data) return true;
      const choice = await window.electronAPI.showUnsavedDialog();
      if (choice === 2) return false; // Annuler
      if (choice === 1) return true;  // Ne pas enregistrer
      const path = currentFilePathRef.current;
      const saved = path ? await performSave(path, data) : await saveAs();
      if (!saved) toast.error("Les modifications n'ont pas été enregistrées : le fichier actuel reste ouvert.");
      return saved;
  };

  /** Charge le contenu d'un fichier lu par le processus principal. Renvoie false en cas d'échec. */
  const loadOpenedFile = async (result: { dataJson: string; filePath: string }): Promise<boolean> => {
      try {
          const data = parseOpenedData(result.dataJson);
          resetState(data);
          setCurrentFilePath(result.filePath);
          setLastFileName(fileNameOf(result.filePath));
          setSelectedStudentId(null);
          setActiveTab('class');
          setIsDirty(false);
          setSaveStatus('saved');
          return true;
      } catch (err) {
          console.error('Error parsing file:', err);
          toast.error("Les données de ce fichier sont illisibles.");
          return false;
      }
  };

  const handleNewFile = async () => {
    if (isFileOperationLoading) return;
    if (!window.electronAPI) { console.warn("Electron API unavailable"); return; }
    if (!(await confirmLeaveCurrentFile())) return;

    setIsFileOperationLoading(true);
    try {
      const initialData = getInitialData();
      const { dataJson, refs } = await prepareForSave(initialData);
      const result = await window.electronAPI.saveFileAs(dataJson, refs, { newFile: true });
      if (result?.success && result.path) {
        resetState(initialData);
        setSelectedStudentId(null);
        setCurrentFilePath(result.path);
        setLastFileName(fileNameOf(result.path));
        setIsDirty(false);
        setSaveStatus('saved');
        setActiveTab('class');
      } else if (result?.error) {
        toast.error(`Impossible de créer le fichier : ${result.error}`);
      }
    } finally {
      setIsFileOperationLoading(false);
    }
  };

  const handleOpenFileClick = async () => {
    if (isFileOperationLoading) return;
    if (!window.electronAPI) { console.warn("Electron API unavailable"); return; }
    if (!(await confirmLeaveCurrentFile())) return;

    setIsFileOperationLoading(true);
    try {
      const result = await window.electronAPI.openFile();
      if (result === null) return;

      if ('dataJson' in result) {
          await loadOpenedFile(result);
      } else if ('error' in result) {
           toast.error(`Impossible d'ouvrir le fichier : ${result.error}`);
      }
    } finally {
      setIsFileOperationLoading(false);
    }
  };

  const handleOpenLastFile = async () => {
    if (!lastFileName || isFileOperationLoading) return;
    if (!window.electronAPI) return;
    if (!(await confirmLeaveCurrentFile())) return;

    setIsFileOperationLoading(true);
    try {
      // Le chemin du dernier fichier est connu du seul processus principal.
      const result = await window.electronAPI.openLastFile();
      if ('dataJson' in result) {
        if (!(await loadOpenedFile(result))) setLastFileName(null);
      } else {
        toast.error(`Impossible d'ouvrir le dernier fichier : ${result.error}`);
        setLastFileName(null);
      }
    } finally {
      setIsFileOperationLoading(false);
    }
  };

  // « Enregistrer sous » : renvoie true si le fichier a été écrit (false si annulé ou en échec).
  const saveAs = async (): Promise<boolean> => {
    const data = appDataRef.current;
    if (!data || !window.electronAPI) return false;
    const { dataJson, refs } = await prepareForSave(data);
    const result = await window.electronAPI.saveFileAs(dataJson, refs);
    if (result?.success && result.path) {
        setCurrentFilePath(result.path);
        setLastFileName(fileNameOf(result.path));
        if (appDataRef.current === data) {
            setIsDirty(false);
            setSaveStatus('saved');
        }
        return true;
    }
    if (result?.error) toast.error(`Impossible d'enregistrer le fichier : ${result.error}`);
    return false;
  };

  const handleSaveAs = async () => {
    if (!appData || isFileOperationLoading) {
        if (!appData) toast.info("Aucune donnée à enregistrer.");
        return;
    }
    if (!window.electronAPI) { console.warn("Electron API unavailable"); return; }

    setIsFileOperationLoading(true);
    try {
      await saveAs();
    } finally {
      setIsFileOperationLoading(false);
    }
  };

  // --- Nuage ---
  // Envoi : la classe est d'abord enregistrée sur l'ordinateur (c'est ce fichier qui part dans Nuage).
  const handleNuageUpload = async () => {
    if (!appDataRef.current || isFileOperationLoading || !window.electronAPI) return;
    const data = appDataRef.current;
    const path = currentFilePathRef.current;
    const saved = !path ? await saveAs() : isDirtyRef.current ? await performSave(path, data) : true;
    if (!saved) {
      toast.info("Enregistrez d'abord la classe sur cet ordinateur pour l'envoyer vers Nuage.");
      return;
    }
    if (window.electronAPI.nuageAssisted) {
      try {
        const result = await window.electronAPI.nuageAssisted.send();
        if (result) toast.success(result.message);
      } catch (error) {
        toast.error(`Envoi vers Nuage impossible : ${error instanceof Error ? error.message : String(error)}`);
      }
      return;
    }
    setNuageMode('upload');
  };

  const handleNuageOpen = async () => {
    if (isFileOperationLoading || !window.electronAPI) return;
    if (!(await confirmLeaveCurrentFile())) return;
    if (window.electronAPI.nuageAssisted) {
      setIsFileOperationLoading(true);
      try {
        const result = await window.electronAPI.nuageAssisted.open();
        if (result && 'dataJson' in result) await loadOpenedFile(result);
        else if (result && 'error' in result) toast.error(`Impossible d'ouvrir la classe depuis Nuage : ${result.error}`);
      } finally {
        setIsFileOperationLoading(false);
      }
      return;
    }
    setNuageMode('open');
  };

  const openFromNuage = async (remotePath: string): Promise<boolean> => {
    const result = await window.electronAPI.nuageOpen(remotePath);
    if (result === null) return false; // enregistrement sur l'ordinateur annulé
    if ('dataJson' in result) return loadOpenedFile(result);
    toast.error(`Impossible d'ouvrir la classe depuis Nuage : ${result.error}`);
    return false;
  };

  const nuageModal = nuageMode && (
    <NuageModal
      mode={nuageMode}
      fileName={currentFilePath ? currentFilePath.split(/[\/]/).pop() : null}
      onClose={() => setNuageMode(null)}
      onOpenRemote={openFromNuage}
    />
  );

    const handleImportStudentsClick = () => {
        studentImportRef.current?.click();
    };

    const handleStudentFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !appData) return;
        if (event.target) event.target.value = '';
        try {
            const { students, programs } = await readStudentsArchive(await file.arrayBuffer());
            setStudentImportData({
                entries: classifyImportedStudents(appData.students, students),
                unmatchedPrograms: unmatchedSkillPrograms(appData.schoolPrograms, students, programs),
            });
        } catch (err) {
            console.error('Erreur import élèves:', err);
            toast.error("Impossible d'importer les élèves. Vérifiez le format du fichier.");
        }
    };

    const handleExportStudents = () => {
        setIsExportModalOpen(true);
    };

    const handleConfirmAndDownloadExport = async (studentsToExport: Student[]) => {
        if (!appData) return;
        if (studentsToExport.length === 0) {
            toast.info("Aucun élève à exporter.");
            setIsExportModalOpen(false);
            return;
        }
        try {
            const bytes = await buildStudentsArchive(studentsToExport, appData.schoolPrograms);
            const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/zip' }));
            const link = document.createElement('a');
            link.href = url;
            link.download = `export-eleves-${todayLocalISO()}.eleves`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            toast.success(`${studentsToExport.length} élève${studentsToExport.length > 1 ? 's' : ''} exporté${studentsToExport.length > 1 ? 's' : ''} (.eleves).`);
        } catch (err) {
            console.error('Erreur export élèves:', err);
            toast.error("Une erreur est survenue lors de l'exportation des élèves.");
        } finally {
            setIsExportModalOpen(false);
        }
    };

    const handleConfirmStudentImport = (decisions: ImportDecision[]) => {
        const counts = appData ? applyStudentImport(appData, decisions, () => crypto.randomUUID()) : { added: 0, merged: 0 };
        updateAppData(prev => applyStudentImport(prev, decisions, () => crypto.randomUUID()).data);

        if (studentImportData && studentImportData.unmatchedPrograms.length > 0) {
            const today = todayLocalISO();
            const importedProgram: SchoolProgram = {
                id: crypto.randomUUID(),
                name: `Compétences importées (${today})`,
                domains: studentImportData.unmatchedPrograms.flatMap(p => p.domains),
                enabled: true,
            };
            handleImportPrograms([importedProgram]);
        }

        setStudentImportData(null);

        const { added, merged } = counts;
        if (added + merged > 0) {
            const parts: string[] = [];
            if (added > 0) parts.push(`${added} élève${added > 1 ? 's' : ''} ajouté${added > 1 ? 's' : ''}`);
            if (merged > 0) parts.push(`${merged} mis à jour`);
            toast.success(`Import terminé : ${parts.join(', ')}.`);
        } else {
            toast.info("Import terminé : aucun élève ajouté.");
        }
    };

  // --- Theme management & Unload protection ---
  useEffect(() => {
    const root = window.document.documentElement;
    if (appData?.uiSettings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [appData?.uiSettings.theme]);

  useEffect(() => {
    setHighlightedSkillId(null);
  }, [selectedStudentId]);

  const selectedStudent = useMemo(() =>
    appData?.students.find(s => s.id === selectedStudentId),
    [appData?.students, selectedStudentId]
  );

  // --- Wrapped State Setters ---
  const setSchoolPrograms = (updater: (prev: SchoolProgram[]) => SchoolProgram[]) => updateAppData(d => ({...d, schoolPrograms: updater(d.schoolPrograms)}));
  const setTeacherConfig = (newConfig: TeacherConfig) => updateAppData(d => ({ ...d, teacherConfig: newConfig }), { coalesceKey: 'teacherConfig' });
  const setUiSettings = (newSettings: AppUISettings) => updateAppData(d => ({ ...d, uiSettings: newSettings }), { skipHistory: true });
  const setSupportGroups = (groups: SupportGroup[]) => updateAppData(d => ({ ...d, supportGroups: groups }));

  const activeSchoolPrograms = useMemo(
    () => (appData?.schoolPrograms || []).filter(p => p.enabled !== false),
    [appData?.schoolPrograms]
  );
  const handleToggleTheme = () => updateAppData(d => ({...d, uiSettings: {...d.uiSettings, theme: d.uiSettings.theme === 'light' ? 'dark' : 'light' }}), { skipHistory: true });

  const handleHighlightSkill = (skillId: string | null) => {
    if (skillId === null) {
      setHighlightedSkillId(null);
    } else {
      setHighlightedSkillId(prevId => (prevId === skillId ? null : skillId));
    }
  };

  const handleSelectStudent = (id: string) => setSelectedStudentId(id);
  const handleOpenAddForm = () => { setStudentToEdit(null); setIsStudentFormOpen(true); };
  const handleOpenEditForm = (studentId: string) => { const student = appData?.students.find(s => s.id === studentId); if (student) { setStudentToEdit(student); setIsStudentFormOpen(true); } };

  const handleSaveStudent = ({ id, ...fields }: StudentFormData) => {
    if (id) {
      updateAppData(d => updateStudentFields(d, id, fields));
    } else {
      const newId = crypto.randomUUID();
      updateAppData(d => addStudent(d, fields, newId));
      setSelectedStudentId(newId);
    }
    setIsStudentFormOpen(false);
  };

  const handleDeleteStudent = (studentId: string) => {
    const student = appData?.students.find(s => s.id === studentId);
    if (student) setDeleteConfirmation({ studentId: student.id, studentName: `${student.firstName} ${student.lastName}` });
  };

  const handleConfirmDelete = () => {
    if (deleteConfirmation) {
      const { studentId } = deleteConfirmation;
      updateAppData(d => deleteStudent(d, studentId));
      if (selectedStudentId === studentId) {
          const remainingStudents = appData?.students.filter(s => s.id !== studentId) || [];
          setSelectedStudentId(remainingStudents.length > 0 ? remainingStudents[0].id : null);
      }
      setDeleteConfirmation(null);
    }
  };

  const handleUpdateSkill = (studentId: string, skillId: string, details: SkillAcquisitionDetails) =>
    updateAppData(d => setSkillDetails(d, studentId, { [skillId]: details }));
  const handleBatchUpdateSkills = (studentId: string, updates: Record<string, SkillAcquisitionDetails>) =>
    updateAppData(d => setSkillDetails(d, studentId, updates));
  const handleUpdateStudentComment = (studentId: string, comment: string) =>
    updateAppData(d => setStudentComment(d, studentId, 'teacherComment', comment));
  const handleUpdateStudentTeacher2Comment = (studentId: string, comment: string) =>
    updateAppData(d => setStudentComment(d, studentId, 'teacher2Comment', comment));
  const handleUpdateStudentDirectorComment = (studentId: string, comment: string) =>
    updateAppData(d => setStudentComment(d, studentId, 'directorComment', comment));
  const handleUpdateStudentDomainComment = (studentId: string, domainId: string, comment: string, periodIndex: number) =>
    updateAppData(d => setDomainComment(d, studentId, domainId, periodIndex, comment));

  // Suppression d'une période de bilan (les bilans des élèves sont réalignés)
  const handleDeleteDomainPeriod = (periodIndex: number) => updateAppData(d => deleteDomainPeriod(d, periodIndex));
  const handleToggleLivretProcessed = (studentId: string) => updateAppData(d => toggleLivretProcessed(d, studentId));
  const handleToggleAllLivretProcessed = () => updateAppData(toggleAllLivretProcessed);
  const handlePromoteStudents = (studentIds: string[]) => updateAppData(d => promoteStudents(d, studentIds));

  const handleMassValidationConfirm = (result: { studentIds: string[]; skillIds: string[]; date: string; getPhoto: (sId: string, skId: string) => string | null }) => {
    // Comptes calculés sur l'état affiché ; la mise à jour est appliquée à l'état courant.
    const { granted, kept } = appData ? applyMassValidation(appData, result) : { granted: 0, kept: 0 };
    updateAppData(d => applyMassValidation(d, result).data);
    setIsMassValidationOpen(false);

    const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;
    toast.success(
      `${plural(granted, 'validation')} enregistrée${granted > 1 ? 's' : ''}` +
      (kept ? ` · ${plural(kept, 'compétence')} déjà acquise${kept > 1 ? 's' : ''}, conservée${kept > 1 ? 's' : ''} telle${kept > 1 ? 's' : ''} quelle${kept > 1 ? 's' : ''}` : '') + '.'
    );
  };
  const handleImportPrograms = (importedPrograms: SchoolProgram[]) => setSchoolPrograms(prev => mergePrograms(prev, importedPrograms));

  const TabButton: React.FC<{tabId: AppTab, children: React.ReactNode}> = ({tabId, children}) => ( <button onClick={() => setActiveTab(tabId)} className={`px-3 py-1.5 text-sm font-semibold rounded-md whitespace-nowrap transition-colors ${activeTab === tabId ? 'bg-blue-500 text-white' : 'text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700'}`}>{children}</button>);
  if (!appData) {
    return (
      <div className="h-full w-full flex flex-col bg-slate-100 dark:bg-zinc-900">
        <header style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} className="h-10 flex-shrink-0 flex justify-end items-center">
          <WindowControls />
        </header>
        <main className="flex-grow">
          <WelcomeScreen
            onNewFile={handleNewFile}
            onOpenFile={handleOpenFileClick}
            onOpenFromNuage={handleNuageOpen}
            onOpenLastFile={lastFileName ? handleOpenLastFile : undefined}
            lastFileName={lastFileName}
            isLoading={isFileOperationLoading}
          />
        </main>
        {nuageModal}
        <ToastHost />
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-slate-100 dark:bg-zinc-900 flex flex-col transition-colors duration-200">
      <input type="file" ref={studentImportRef} onChange={handleStudentFileSelected} accept=".eleves,.eleve,application/json" style={{ display: 'none' }} />
      {studentImportData && (
        <StudentImportModal
          entries={studentImportData.entries}
          unmatchedPrograms={studentImportData.unmatchedPrograms}
          onConfirm={handleConfirmStudentImport}
          onClose={() => setStudentImportData(null)}
        />
      )}
      {nuageModal}
      <ExitModal
        isOpen={showExitModal}
        onSaveAndQuit={handleExitSave}
        onQuitWithoutSaving={handleExitWithoutSave}
        onCancel={() => setShowExitModal(false)}
        isSaving={saveStatus === 'saving'}
      />

      <header inert={activeTab === 'student_mode'} style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} className="h-16 bg-white dark:bg-zinc-800 border-b border-slate-200 dark:border-zinc-700 flex-shrink-0 grid grid-cols-[auto_1fr_auto] items-center print:hidden max-lg:h-auto max-lg:py-2 max-lg:gap-y-2">
            <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties} className="flex items-center gap-4 justify-self-start pl-3">
                <h1 className="text-xl font-bold text-blue-600 dark:text-blue-400">Envolées</h1>
                <FileMenu
                    onNewFile={handleNewFile}
                    onOpenFile={handleOpenFileClick}
                    onSaveFileAs={handleSaveAs}
                    onNuageUpload={handleNuageUpload}
                    onNuageOpen={handleNuageOpen}
                    onOpenSettings={() => setActiveTab('settings')}
                    isSaveDisabled={!appData}
                    isLoading={isFileOperationLoading}
                />
                <div className="flex items-center gap-1 border-l border-slate-200 dark:border-zinc-700 pl-3 ml-2">
                  <SaveStatusIndicator status={saveStatus} onClick={handleManualSave} />
                  <div className="flex items-center gap-1 ml-2">
                    <Tooltip content="Annuler (Ctrl+Z)" position="bottom-center">
                      <button
                        onClick={handleUndo}
                        disabled={!canUndo}
                        className={`p-1.5 rounded-full transition-colors ${canUndo ? 'text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700' : 'text-slate-300 dark:text-zinc-600 cursor-not-allowed'}`}
                      >
                          <UndoIcon className="w-5 h-5" />
                      </button>
                    </Tooltip>
                    <Tooltip content="Rétablir (Ctrl+Y)" position="bottom-center">
                      <button
                        onClick={handleRedo}
                        disabled={!canRedo}
                        className={`p-1.5 rounded-full transition-colors ${canRedo ? 'text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700' : 'text-slate-300 dark:text-zinc-600 cursor-not-allowed'}`}
                      >
                          <RedoIcon className="w-5 h-5" />
                      </button>
                    </Tooltip>
                  </div>
                </div>
            </div>
            <div style={{ WebkitAppRegion: 'no-drag', scrollbarWidth: 'none' } as React.CSSProperties} className="flex items-center gap-1 justify-self-center min-w-0 max-w-full overflow-x-auto max-lg:order-last max-lg:col-span-3">
                <TabButton tabId='class'>Classe</TabButton>
                <TabButton tabId='skills'>Compétences</TabButton>
                <TabButton tabId='workshops'>Ateliers</TabButton>
                <button onClick={() => (isPinDefined(appData.teacherConfig.studentModePin) ? setShowStudentModeConfirm(true) : setShowPinSetup(true))} className={`px-3 py-1.5 text-sm font-semibold rounded-md whitespace-nowrap transition-colors ${activeTab === 'student_mode' ? 'bg-blue-500 text-white' : 'text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700'}`}>Mode Élève</button>
                <TabButton tabId='reports'>Rapports</TabButton>
                <TabButton tabId='livret'>Livret</TabButton>
            </div>
            <div className="justify-self-end flex items-center">
                <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties} className="flex items-center">
                    <Tooltip content="Changer le thème" position="bottom-center">
                        <button onClick={handleToggleTheme} className="p-2 rounded-full text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors" aria-label="Changer le thème">
                            {appData.uiSettings.theme === 'light' ? <MoonIcon className="w-5 h-5" /> : <SunIcon className="w-5 h-5" />}
                        </button>
                    </Tooltip>
                    <Tooltip content="Aide" position="bottom-center">
                        <button onClick={() => window.electronAPI?.openGuide(appData.uiSettings.theme)} className="p-2 rounded-full text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors" aria-label="Aide">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        </button>
                    </Tooltip>
                </div>
                <WindowControls />
            </div>
      </header>

      {/* Une erreur dans un onglet ou une modale n'emporte pas l'application : l'en-tête
          (Enregistrer) reste utilisable et les données restent en mémoire. */}
      <ErrorBoundary
        resetKey={activeTab}
        fallback={(error, reset) => (
          <ErrorPanel
            title="Cet écran a rencontré une erreur"
            message="Vos données sont toujours en mémoire. Enregistrez votre travail (indicateur en haut à gauche), puis réessayez ou changez d'onglet."
            error={error}
            actions={
              <button onClick={reset} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">Réessayer</button>
            }
          />
        )}
      >

      {activeTab === 'class' && (
        <div className="flex-grow flex flex-col md:flex-row min-h-0">
            <aside className="relative flex-shrink-0 h-1/3 md:h-full md:w-80 lg:w-96 w-full">
                <div className="w-full h-full">
                    <StudentList
                        students={appData.students}
                        selectedStudentId={selectedStudentId}
                        schoolPrograms={activeSchoolPrograms}
                        highlightedSkillId={highlightedSkillId}
                        onSelectStudent={handleSelectStudent}
                        onAddStudent={handleOpenAddForm}
                        onEditStudent={handleOpenEditForm}
                        onDeleteStudent={handleDeleteStudent}
                        onImportStudents={handleImportStudentsClick}
                        onExportStudents={handleExportStudents}
                        viewMode="class"
                        onOpenMassValidation={() => setIsMassValidationOpen(true)}
                        onPromoteStudents={() => setIsPromoteModalOpen(true)}
                    />
                </div>
            </aside>
            <main className="flex-grow min-w-0 bg-white dark:bg-zinc-800/50 h-2/3 md:h-full">
                {selectedStudent ? (
                <StudentDetail
                    student={selectedStudent}
                    schoolPrograms={activeSchoolPrograms}
                    onUpdateSkill={handleUpdateSkill}
                    onBatchUpdateSkills={handleBatchUpdateSkills}
                    highlightedSkillId={highlightedSkillId}
                    onHighlightSkill={handleHighlightSkill}
                    onDeselectStudent={() => setSelectedStudentId(null)}
                />
                ) : (
                <ClassSynthesis
                    students={appData.students}
                    schoolPrograms={activeSchoolPrograms}
                    supportGroups={appData.supportGroups ?? []}
                    onUpdateSupportGroups={setSupportGroups}
                />
                )}
            </main>
        </div>
      )}

      {activeTab === 'skills' && (
        <SkillsView
          programs={appData.schoolPrograms}
          setPrograms={setSchoolPrograms}
          onDeleteItems={(selection) => updateAppData(prev => deleteTreeItems(prev, selection))}
          onImportPrograms={handleImportPrograms}
        />
      )}

      {activeTab === 'livret' && (
        <div className="flex-grow min-h-0">
          <LivretView
            students={appData.students}
            selectedStudentId={selectedStudentId}
            schoolPrograms={activeSchoolPrograms}
            onSelectStudent={handleSelectStudent}
            onEditStudent={handleOpenEditForm}
            onDeleteStudent={handleDeleteStudent}
            teacherConfig={appData.teacherConfig}
            onConfigChange={setTeacherConfig}
            onUpdateStudentComment={handleUpdateStudentComment}
            onUpdateStudentTeacher2Comment={handleUpdateStudentTeacher2Comment}
            onUpdateStudentDirectorComment={handleUpdateStudentDirectorComment}
            onUpdateStudentDomainComment={handleUpdateStudentDomainComment}
            onDeleteDomainPeriod={handleDeleteDomainPeriod}
            uiSettings={appData.uiSettings}
            onUiSettingsChange={setUiSettings}
            onToggleLivretProcessed={handleToggleLivretProcessed}
            onToggleAllLivretProcessed={handleToggleAllLivretProcessed}
          />
        </div>
      )}

      {activeTab === 'settings' && (
          <div className="flex-grow min-h-0">
              <SettingsView
                settings={appData.uiSettings}
                onSettingsChange={setUiSettings}
                teacherConfig={appData.teacherConfig}
                onTeacherConfigChange={setTeacherConfig}
              />
          </div>
      )}

      {activeTab === 'workshops' && (
          <WorkshopsView
            workshops={appData.workshops}
            setWorkshops={(updater) => updateAppData(prev => ({ ...prev, workshops: typeof updater === 'function' ? updater(prev.workshops) : updater }))}
            schoolPrograms={activeSchoolPrograms}
          />
      )}

      {activeTab === 'student_mode' && (
          <StudentMode
            students={appData.students}
            teacherConfig={appData.teacherConfig}
            workshops={appData.workshops}
            onQRCodeScanned={(eventData) => updateAppData(prev =>
                eventData.type === 'auto_validation' ? recordAutoValidation(prev, eventData) : recordScan(prev, eventData)
            )}
            events={appData.workshopEvents}
            onExit={() => setActiveTab('class')}
          />
      )}

      {activeTab === 'reports' && (
          <ReportsView
            events={appData.workshopEvents}
            students={appData.students}
            workshops={appData.workshops}
            onSetOutcome={(eventIds, success) => updateAppData(prev => setEventsOutcome(prev, eventIds, success))}
            onPurgeJournal={(beforeDay) => {
                const removed = appData ? purgeWorkshopEvents(appData, beforeDay).removed : 0;
                updateAppData(prev => purgeWorkshopEvents(prev, beforeDay).data);
                toast.success(`${removed} passage${removed > 1 ? 's' : ''} supprimé${removed > 1 ? 's' : ''} du journal.`);
            }}
          />
      )}

      {isStudentFormOpen && ( <StudentForm onSave={handleSaveStudent} onClose={() => setIsStudentFormOpen(false)} studentToEdit={studentToEdit} /> )}
      {deleteConfirmation && ( <ConfirmationModal title="Confirmer la suppression" message={`Êtes-vous sûr de vouloir supprimer ${deleteConfirmation.studentName} ? Cette action est irréversible.`} onConfirm={handleConfirmDelete} onCancel={() => setDeleteConfirmation(null)} confirmText="Supprimer" /> )}
      {isExportModalOpen && appData && ( <ExportModal students={appData.students} onClose={() => setIsExportModalOpen(false)} onExport={handleConfirmAndDownloadExport} /> )}
      {showPinSetup && (
        <PinSetupModal
          title="Code PIN du mode élève"
          description="Avant la première utilisation, choisissez le code qui permettra de quitter le mode élève. Les enfants ne doivent pas le connaître."
          confirmText="Enregistrer et entrer"
          onConfirm={(pin) => {
            setTeacherConfig({ ...appData.teacherConfig, studentModePin: pin });
            setShowPinSetup(false);
            setActiveTab('student_mode');
          }}
          onCancel={() => setShowPinSetup(false)}
        />
      )}
      {showStudentModeConfirm && ( <ConfirmationModal title="Entrer en Mode Élève" message="Le mode élève est un espace plein écran dédié aux enfants. Pour quitter ce mode, le code PIN enseignant sera requis. Voulez-vous continuer ?" onConfirm={() => { setShowStudentModeConfirm(false); setActiveTab('student_mode'); }} onCancel={() => setShowStudentModeConfirm(false)} confirmText="Entrer" cancelText="Annuler" variant="primary" /> )}
      {isPromoteModalOpen && appData && (
        <PromoteModal
          students={appData.students}
          onClose={() => setIsPromoteModalOpen(false)}
          onPromote={handlePromoteStudents}
        />
      )}
      {isMassValidationOpen && appData && (
        <MassValidationModal
          students={appData.students}
          schoolPrograms={activeSchoolPrograms}
          supportGroups={appData.supportGroups ?? []}
          onConfirm={handleMassValidationConfirm}
          onClose={() => setIsMassValidationOpen(false)}
        />
      )}
      </ErrorBoundary>
      <ToastHost />
    </div>
  );
};

export default App;