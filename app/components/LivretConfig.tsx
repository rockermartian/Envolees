import React, { useRef, useState, useEffect } from 'react';
import { TeacherConfig, AppUISettings } from '../types';
import { compressImage } from '../utils/imageUtils';
import Tooltip from './Tooltip';
import ConfirmationModal from './ConfirmationModal';
import { toast } from '../utils/toast';
import StoredImage from '../images/StoredImage';
import { DEFAULT_CIVILITY } from '../fileFormat/defaults';

const TrashIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
);

const SignatureIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M10.625 2.375a3.375 3.375 0 0 0-3.375 3.375v1.5H3.375A1.875 1.875 0 0 0 1.5 9.125v9.75A1.875 1.875 0 0 0 3.375 20.75h12A1.875 1.875 0 0 0 17.25 19v-9.75A1.875 1.875 0 0 0 15.375 7.5h-1.5v-1.5a.75.75 0 0 0-1.5 0v1.5h-1.5v-1.5a.75.75 0 0 0-1.5 0v1.5h-1.5v-1.5A3.375 3.375 0 0 0 10.625 2.375Z" />
        <path d="M19.125 11.25a.75.75 0 0 0 0 1.5h1.5a.75.75 0 0 0 0-1.5h-1.5Z" />
    </svg>
);

const EyeIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
);

const EyeSlashIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.243 4.243L6.228 6.228" />
    </svg>
);

const DocumentArrowDownIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m.75 12 3 3m0 0 3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
  </svg>
);

const FolderArrowDownIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
  </svg>
);


const DocumentTextIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
  </svg>
);

const ChevronDownIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
  </svg>
);


interface LivretConfigProps {
    config: TeacherConfig;
    onConfigChange: (config: TeacherConfig) => void;
    uiSettings: AppUISettings;
    onUiSettingsChange: (settings: AppUISettings) => void;
    onDeleteDomainPeriod: (periodIndex: number) => void;
    onBatchExport: () => void;
    onExportSingle: () => void;
    onExportAnnex: () => void;
    isSingleExportDisabled: boolean;
}

const SectionHeader: React.FC<{ title: string; open: boolean; onToggle: () => void }> = ({ title, open, onToggle }) => (
    <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between text-md font-semibold text-slate-600 dark:text-zinc-300 border-b border-slate-300 dark:border-zinc-600 pb-1"
    >
        <span>{title}</span>
        <ChevronDownIcon className={`w-4 h-4 transition-transform duration-150 ${open ? '' : '-rotate-90'}`} />
    </button>
);

const LivretConfig: React.FC<LivretConfigProps> = ({ config, onConfigChange, uiSettings, onUiSettingsChange, onDeleteDomainPeriod, onBatchExport, onExportSingle, onExportAnnex, isSingleExportDisabled }) => {
    const teacherTitleLabel = config.teacherTitle === 'Madame' ? "Enseignante" : "Enseignant";
    const teacher2TitleLabel = (config.teacher2Title ?? DEFAULT_CIVILITY) === 'Madame' ? "Enseignante 2" : "Enseignant 2";
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
    const [isImportingSignature, setIsImportingSignature] = useState(false);
    // États d'ouverture des volets, mémorisés par fichier via uiSettings (repliés par défaut).
    const openSections = uiSettings.livretConfigOpenSections || {};
    const toggleSection = (key: string) => {
        onUiSettingsChange({
            ...uiSettings,
            livretConfigOpenSections: { ...openSections, [key]: !(openSections[key] ?? false) },
        });
    };
    const openMisePage = openSections.misePage ?? false;
    const openFilter = openSections.filter ?? false;
    const openDisplay = openSections.display ?? false;
    const openSchool = openSections.school ?? false;
    const openTeacher = openSections.teacher ?? false;
    const openTeacher2 = openSections.teacher2 ?? false;
    const openDirector = openSections.director ?? false;
    const [pendingDeletePeriod, setPendingDeletePeriod] = useState<number | null>(null);
    const exportMenuRef = useRef<HTMLDivElement>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        onConfigChange({ ...config, [e.target.name]: e.target.value });
    };

    const handleImportSignature = async () => {
        if (isImportingSignature) return;
        if (window.electronAPI) {
            setIsImportingSignature(true);
            try {
                const result = await window.electronAPI.openImageFile();
                if (result && typeof result === 'string') {
                    const ref = await compressImage(result); // null si illisible : on garde l'ancienne
                    if (ref) onConfigChange({ ...config, teacherSignature: ref });
                } else if (result && (result as { error: string }).error) {
                    console.error('Error opening image file:', (result as { error: string }).error);
                    toast.error("Une erreur est survenue lors de l'ouverture de l'image.");
                }
            } finally {
                setIsImportingSignature(false);
            }
        }
    };

    const removeSignature = () => {
        onConfigChange({ ...config, teacherSignature: null });
    };

    const handleImportDirectorSignature = async () => {
        if (isImportingSignature) return;
        if (window.electronAPI) {
            setIsImportingSignature(true);
            try {
                const result = await window.electronAPI.openImageFile();
                if (result && typeof result === 'string') {
                    const ref = await compressImage(result); // null si illisible : on garde l'ancienne
                    if (ref) onConfigChange({ ...config, directorSignature: ref });
                } else if (result && (result as { error: string }).error) {
                    console.error('Error opening image file:', (result as { error: string }).error);
                    toast.error("Une erreur est survenue lors de l'ouverture de l'image.");
                }
            } finally {
                setIsImportingSignature(false);
            }
        }
    };

    const removeDirectorSignature = () => {
        onConfigChange({ ...config, directorSignature: null });
    };

    const handleImportTeacher2Signature = async () => {
        if (isImportingSignature) return;
        if (window.electronAPI) {
            setIsImportingSignature(true);
            try {
                const result = await window.electronAPI.openImageFile();
                if (result && typeof result === 'string') {
                    const ref = await compressImage(result); // null si illisible : on garde l'ancienne
                    if (ref) onConfigChange({ ...config, teacher2Signature: ref });
                } else if (result && (result as { error: string }).error) {
                    console.error('Error opening image file:', (result as { error: string }).error);
                    toast.error("Une erreur est survenue lors de l'ouverture de l'image.");
                }
            } finally {
                setIsImportingSignature(false);
            }
        }
    };

    const removeTeacher2Signature = () => {
        onConfigChange({ ...config, teacher2Signature: null });
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
                setIsExportMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const layoutMode = config.livretLayoutMode || 'classic';

    return (
        <>
        <div className="bg-slate-50 dark:bg-zinc-800 border-r border-slate-200 dark:border-zinc-700 h-full flex flex-col p-4 space-y-6 overflow-y-auto">
            <h2 className="text-xl font-bold text-slate-800 dark:text-zinc-200">Configuration du Livret</h2>

            {/* Mise en page */}
            <div className="space-y-3">
                <SectionHeader title="Mise en page" open={openMisePage} onToggle={() => toggleSection('misePage')} />
                {openMisePage && (
                    <div className="text-sm space-y-3">
                        <div>
                            <div className="flex rounded-md shadow-sm">
                                <button
                                    type="button"
                                    onClick={() => onConfigChange({ ...config, livretLayoutMode: 'classic' })}
                                    className={`px-4 py-2 text-sm font-medium rounded-l-md w-1/2 transition-colors ${
                                        layoutMode === 'classic'
                                            ? 'bg-blue-600 text-white z-10 ring-1 ring-blue-600'
                                            : 'bg-white dark:bg-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-600 ring-1 ring-inset ring-slate-300 dark:ring-zinc-600'
                                    }`}
                                >
                                    Classique
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onConfigChange({ ...config, livretLayoutMode: 'compact' })}
                                    className={`-ml-px px-4 py-2 text-sm font-medium rounded-r-md w-1/2 transition-colors ${
                                        layoutMode === 'compact'
                                            ? 'bg-blue-600 text-white z-10 ring-1 ring-blue-600'
                                            : 'bg-white dark:bg-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-600 ring-1 ring-inset ring-slate-300 dark:ring-zinc-600'
                                    }`}
                                >
                                    Compacte
                                </button>
                            </div>
                        </div>
                        {layoutMode === 'classic' && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">
                                    Cartes par ligne : <span className="font-bold text-blue-600 dark:text-blue-400">{config.livretSkillsPerColumn ?? 3}</span>
                                </label>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-500 dark:text-zinc-400">1</span>
                                    <input
                                        type="range"
                                        min={1}
                                        max={5}
                                        step={1}
                                        value={config.livretSkillsPerColumn ?? 3}
                                        onChange={(e) => onConfigChange({ ...config, livretSkillsPerColumn: Number(e.target.value) })}
                                        className="flex-1 accent-blue-600"
                                    />
                                    <span className="text-xs text-slate-500 dark:text-zinc-400">5</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Filtre par période */}
            <div className="space-y-3">
                <SectionHeader title="Filtre par période" open={openFilter} onToggle={() => toggleSection('filter')} />
                {openFilter && (
                    <div className="space-y-3">
                        <p className="text-xs text-slate-500 dark:text-zinc-400">Afficher uniquement les compétences acquises entre ces deux dates.</p>
                        <div>
                            <label htmlFor="livretDateFilterStart" className="block text-sm font-medium text-slate-700 dark:text-zinc-300">Du</label>
                            <input
                                type="date"
                                id="livretDateFilterStart"
                                name="livretDateFilterStart"
                                value={config.livretDateFilterStart || ''}
                                onChange={handleChange}
                                className="mt-1 block w-full text-sm px-3 py-2 bg-white dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600 rounded-md shadow-sm text-slate-900 dark:text-zinc-200"
                            />
                        </div>
                        <div>
                            <label htmlFor="livretDateFilterEnd" className="block text-sm font-medium text-slate-700 dark:text-zinc-300">Au</label>
                            <input
                                type="date"
                                id="livretDateFilterEnd"
                                name="livretDateFilterEnd"
                                value={config.livretDateFilterEnd || ''}
                                onChange={handleChange}
                                className="mt-1 block w-full text-sm px-3 py-2 bg-white dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600 rounded-md shadow-sm text-slate-900 dark:text-zinc-200"
                            />
                        </div>
                        {(config.livretDateFilterStart || config.livretDateFilterEnd) && (
                            <button
                                type="button"
                                onClick={() => onConfigChange({ ...config, livretDateFilterStart: undefined, livretDateFilterEnd: undefined })}
                                className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium"
                            >
                                Effacer le filtre
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Options d'affichage */}
            <div className="space-y-3">
                <SectionHeader title="Options d'affichage" open={openDisplay} onToggle={() => toggleSection('display')} />
                {openDisplay && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-700 dark:text-zinc-300">Introduction commune</span>
                            <Tooltip content={config.showIntroduction ? "Masquer" : "Afficher"} position="top-center">
                                <button
                                    type="button"
                                    onClick={() => onConfigChange({ ...config, showIntroduction: !config.showIntroduction })}
                                    className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
                                >
                                    {config.showIntroduction ? (
                                        <EyeIcon className="h-5 w-5 text-green-600 dark:text-green-500" />
                                    ) : (
                                        <EyeSlashIcon className="h-5 w-5 text-red-600 dark:text-red-500" />
                                    )}
                                </button>
                            </Tooltip>
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-700 dark:text-zinc-300">Attendus en fin de maternelle par domaine</span>
                            <Tooltip content={config.showExpectations ? "Masquer" : "Afficher"} position="top-center">
                                <button
                                    type="button"
                                    onClick={() => onConfigChange({ ...config, showExpectations: !config.showExpectations })}
                                    className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
                                >
                                    {config.showExpectations ? (
                                        <EyeIcon className="h-5 w-5 text-green-600 dark:text-green-500" />
                                    ) : (
                                        <EyeSlashIcon className="h-5 w-5 text-red-600 dark:text-red-500" />
                                    )}
                                </button>
                            </Tooltip>
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-700 dark:text-zinc-300">Compétences non validées</span>
                            <Tooltip content={config.showNotAcquiredSkills ? "Masquer" : "Afficher"} position="top-center">
                                <button
                                    type="button"
                                    onClick={() => onConfigChange({ ...config, showNotAcquiredSkills: !config.showNotAcquiredSkills })}
                                    className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
                                >
                                    {config.showNotAcquiredSkills ? (
                                        <EyeIcon className="h-5 w-5 text-green-600 dark:text-green-500" />
                                    ) : (
                                        <EyeSlashIcon className="h-5 w-5 text-red-600 dark:text-red-500" />
                                    )}
                                </button>
                            </Tooltip>
                        </div>

                        <div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-700 dark:text-zinc-300">Bilans par domaine</span>
                                <Tooltip content={config.showDomainComments ? "Masquer" : "Afficher"} position="top-center">
                                    <button
                                        type="button"
                                        onClick={() => onConfigChange({ ...config, showDomainComments: !config.showDomainComments })}
                                        className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
                                    >
                                        {config.showDomainComments ? (
                                            <EyeIcon className="h-5 w-5 text-green-600 dark:text-green-500" />
                                        ) : (
                                            <EyeSlashIcon className="h-5 w-5 text-red-600 dark:text-red-500" />
                                        )}
                                    </button>
                                </Tooltip>
                            </div>

                            {config.showDomainComments && (() => {
                                const periods = config.domainCommentPeriods || [];

                                const autoName = (index: number) => `Bilan de la Période ${index + 1}`;

                                const updatePeriodName = (id: string, name: string) => {
                                    onConfigChange({ ...config, domainCommentPeriods: periods.map(p => p.id === id ? { ...p, name } : p) });
                                };
                                const togglePeriodActive = (id: string) => {
                                    onConfigChange({ ...config, domainCommentPeriods: periods.map(p => p.id === id ? { ...p, active: p.active === false } : p) });
                                };
                                const addPeriod = () => {
                                    const id = `period-${crypto.randomUUID()}`;
                                    onConfigChange({ ...config, domainCommentPeriods: [...periods, { id, name: '', active: true }] });
                                };

                                return (
                                    <div className="pl-6 mt-2 pt-2 space-y-2 border-l-2 border-slate-200 dark:border-zinc-700">
                                        <p className="text-xs text-slate-400 dark:text-zinc-500">
                                            Un champ de bilan par période sera proposé pour chaque domaine du livret. Laissez le nom vide pour utiliser le nom automatique.
                                        </p>
                                        {periods.map((period, i) => {
                                            const isActive = period.active !== false;
                                            return (
                                            <div key={period.id} className="flex items-center gap-2">
                                                <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 text-xs font-semibold">
                                                    {i + 1}
                                                </span>
                                                <div className="relative flex-1 min-w-0">
                                                    <input
                                                        type="text"
                                                        value={period.name}
                                                        onChange={e => updatePeriodName(period.id, e.target.value)}
                                                        placeholder={autoName(i)}
                                                        className="block w-full text-sm px-2 py-1.5 pr-9 bg-white dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600 rounded-md shadow-sm text-slate-900 dark:text-zinc-200"
                                                    />
                                                    <div className="group/tooltip absolute inset-y-0 right-0 flex items-center pr-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => togglePeriodActive(period.id)}
                                                            className="text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                                                        >
                                                            {isActive ? <EyeIcon className="h-5 w-5" /> : <EyeSlashIcon className="h-5 w-5" />}
                                                        </button>
                                                        <div className="absolute top-full right-0 mt-1.5 px-2.5 py-1.5 bg-white dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-600 text-xs rounded-md shadow-lg opacity-0 group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100 transition-opacity duration-200 invisible group-hover/tooltip:visible group-focus-within/tooltip:visible z-50 pointer-events-none font-normal whitespace-nowrap">
                                                            {isActive ? "Masquer cette période dans les livrets" : "Afficher cette période dans les livrets"}
                                                        </div>
                                                    </div>
                                                </div>
                                                <Tooltip content="Supprimer cette période" position="top-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => setPendingDeletePeriod(i)}
                                                        className="flex-shrink-0 p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors"
                                                    >
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                </Tooltip>
                                            </div>
                                            );
                                        })}
                                        {periods.length === 0 && (
                                            <p className="text-xs italic text-slate-400 dark:text-zinc-500">Aucune période. Ajoutez-en une ci-dessous.</p>
                                        )}
                                        <button
                                            type="button"
                                            onClick={addPeriod}
                                            className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 pt-1"
                                        >
                                            <span className="w-5 h-5 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-bold text-base leading-none">+</span>
                                            Ajouter une période
                                        </button>
                                    </div>
                                );
                            })()}
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-700 dark:text-zinc-300">Commentaire général</span>
                            <Tooltip content={config.showTeacherComment ? "Masquer" : "Afficher"} position="top-center">
                                <button
                                    type="button"
                                    onClick={() => onConfigChange({ ...config, showTeacherComment: !config.showTeacherComment })}
                                    className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
                                >
                                    {config.showTeacherComment ? (
                                        <EyeIcon className="h-5 w-5 text-green-600 dark:text-green-500" />
                                    ) : (
                                        <EyeSlashIcon className="h-5 w-5 text-red-600 dark:text-red-500" />
                                    )}
                                </button>
                            </Tooltip>
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-700 dark:text-zinc-300">Commentaire enseignant 2</span>
                            <Tooltip content={config.showTeacher2Comment ? "Masquer" : "Afficher"} position="top-center">
                                <button
                                    type="button"
                                    onClick={() => onConfigChange({ ...config, showTeacher2Comment: !config.showTeacher2Comment })}
                                    className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
                                >
                                    {config.showTeacher2Comment ? (
                                        <EyeIcon className="h-5 w-5 text-green-600 dark:text-green-500" />
                                    ) : (
                                        <EyeSlashIcon className="h-5 w-5 text-red-600 dark:text-red-500" />
                                    )}
                                </button>
                            </Tooltip>
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-700 dark:text-zinc-300">Commentaire de la Direction</span>
                            <Tooltip content={config.showDirectorComment ? "Masquer" : "Afficher"} position="top-center">
                                <button
                                    type="button"
                                    onClick={() => onConfigChange({ ...config, showDirectorComment: !config.showDirectorComment })}
                                    className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
                                >
                                    {config.showDirectorComment ? (
                                        <EyeIcon className="h-5 w-5 text-green-600 dark:text-green-500" />
                                    ) : (
                                        <EyeSlashIcon className="h-5 w-5 text-red-600 dark:text-red-500" />
                                    )}
                                </button>
                            </Tooltip>
                        </div>

                        <div className="pt-1 border-t border-slate-200 dark:border-zinc-700 space-y-3">
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Blocs de signature</p>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-700 dark:text-zinc-300">Signature enseignant(e)</span>
                                <Tooltip content={(config.showTeacherSignature ?? true) ? "Masquer" : "Afficher"} position="top-center">
                                    <button
                                        type="button"
                                        onClick={() => onConfigChange({ ...config, showTeacherSignature: !(config.showTeacherSignature ?? true) })}
                                        className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
                                    >
                                        {(config.showTeacherSignature ?? true) ? (
                                            <EyeIcon className="h-5 w-5 text-green-600 dark:text-green-500" />
                                        ) : (
                                            <EyeSlashIcon className="h-5 w-5 text-red-600 dark:text-red-500" />
                                        )}
                                    </button>
                                </Tooltip>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-700 dark:text-zinc-300">Signature du ou de la 2ᵉ enseignant(e)</span>
                                <Tooltip content={(config.showTeacher2Signature ?? false) ? "Masquer" : "Afficher"} position="top-center">
                                    <button
                                        type="button"
                                        onClick={() => onConfigChange({ ...config, showTeacher2Signature: !(config.showTeacher2Signature ?? false) })}
                                        className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
                                    >
                                        {(config.showTeacher2Signature ?? false) ? (
                                            <EyeIcon className="h-5 w-5 text-green-600 dark:text-green-500" />
                                        ) : (
                                            <EyeSlashIcon className="h-5 w-5 text-red-600 dark:text-red-500" />
                                        )}
                                    </button>
                                </Tooltip>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-700 dark:text-zinc-300">Signature parents</span>
                                <Tooltip content={(config.showParentsSignature ?? true) ? "Masquer" : "Afficher"} position="top-center">
                                    <button
                                        type="button"
                                        onClick={() => onConfigChange({ ...config, showParentsSignature: !(config.showParentsSignature ?? true) })}
                                        className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
                                    >
                                        {(config.showParentsSignature ?? true) ? (
                                            <EyeIcon className="h-5 w-5 text-green-600 dark:text-green-500" />
                                        ) : (
                                            <EyeSlashIcon className="h-5 w-5 text-red-600 dark:text-red-500" />
                                        )}
                                    </button>
                                </Tooltip>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-700 dark:text-zinc-300">Signature direction</span>
                                <Tooltip content={(config.showDirectorSignature ?? true) ? "Masquer" : "Afficher"} position="top-center">
                                    <button
                                        type="button"
                                        onClick={() => onConfigChange({ ...config, showDirectorSignature: !(config.showDirectorSignature ?? true) })}
                                        className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
                                    >
                                        {(config.showDirectorSignature ?? true) ? (
                                            <EyeIcon className="h-5 w-5 text-green-600 dark:text-green-500" />
                                        ) : (
                                            <EyeSlashIcon className="h-5 w-5 text-red-600 dark:text-red-500" />
                                        )}
                                    </button>
                                </Tooltip>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* École */}
            <div className="space-y-4">
                <SectionHeader title="École" open={openSchool} onToggle={() => toggleSection('school')} />
                {openSchool && (
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="schoolName" className="block text-sm font-medium text-slate-700 dark:text-zinc-300">Nom de l'établissement</label>
                            <input type="text" id="schoolName" name="schoolName" value={config.schoolName} onChange={handleChange} className="mt-1 block w-full text-sm px-3 py-2 bg-white dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600 rounded-md shadow-sm" placeholder="Ex: École Maternelle Les Petits Pas"/>
                        </div>
                        <div>
                            <label htmlFor="schoolYear" className="block text-sm font-medium text-slate-700 dark:text-zinc-300">Année scolaire</label>
                            <input type="text" id="schoolYear" name="schoolYear" value={config.schoolYear} onChange={handleChange} className="mt-1 block w-full text-sm px-3 py-2 bg-white dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600 rounded-md shadow-sm" placeholder="Ex: 2024-2025"/>
                        </div>
                    </div>
                )}
            </div>

            {/* Enseignant */}
            <div className="space-y-4">
                <SectionHeader title={teacherTitleLabel} open={openTeacher} onToggle={() => toggleSection('teacher')} />
                {openTeacher && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300">Civilité</label>
                            <div className="mt-2 flex gap-x-6">
                                <label className="flex items-center">
                                    <input type="radio" name="teacherTitle" value="Madame" checked={config.teacherTitle === 'Madame'} onChange={handleChange} />
                                    <span className="ml-2 text-sm text-slate-900 dark:text-zinc-300">Madame</span>
                                </label>
                                <label className="flex items-center">
                                    <input type="radio" name="teacherTitle" value="Monsieur" checked={config.teacherTitle === 'Monsieur'} onChange={handleChange} />
                                    <span className="ml-2 text-sm text-slate-900 dark:text-zinc-300">Monsieur</span>
                                </label>
                            </div>
                        </div>
                        <div>
                            <label htmlFor="teacherFirstName" className="block text-sm font-medium text-slate-700 dark:text-zinc-300">Prénom</label>
                            <div className="relative mt-1">
                                <input type="text" id="teacherFirstName" name="teacherFirstName" value={config.teacherFirstName} onChange={handleChange} className="block w-full text-sm px-3 py-2 bg-white dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600 rounded-md shadow-sm pr-10"/>
                                <div className="group/tooltip absolute inset-y-0 right-0 flex items-center pr-3">
                                    <button
                                        type="button"
                                        onClick={() => onConfigChange({ ...config, showTeacherFirstName: !config.showTeacherFirstName })}
                                        className="text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                                    >
                                        {config.showTeacherFirstName ? <EyeIcon className="h-5 w-5" /> : <EyeSlashIcon className="h-5 w-5" />}
                                    </button>
                                    <div className="absolute top-full right-0 mt-1.5 px-2.5 py-1.5 bg-white dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-600 text-xs rounded-md shadow-lg opacity-0 group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100 transition-opacity duration-200 invisible group-hover/tooltip:visible group-focus-within/tooltip:visible z-50 pointer-events-none font-normal whitespace-nowrap">
                                        {config.showTeacherFirstName ? "Masquer le prénom dans la signature" : "Afficher le prénom dans la signature"}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div>
                            <label htmlFor="teacherLastName" className="block text-sm font-medium text-slate-700 dark:text-zinc-300">Nom</label>
                            <input type="text" id="teacherLastName" name="teacherLastName" value={config.teacherLastName} onChange={handleChange} className="mt-1 block w-full text-sm px-3 py-2 bg-white dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600 rounded-md shadow-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300">Signature</label>
                            <div className="mt-1 flex items-center justify-center w-full p-4 border-2 border-slate-300 dark:border-zinc-600 border-dashed rounded-md">
                                {config.teacherSignature ? (
                                    <div className="text-center">
                                        <StoredImage src={config.teacherSignature} alt="Signature" className="max-h-20 mx-auto bg-white p-1 rounded"/>
                                        <button onClick={removeSignature} className="mt-2 text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-semibold">Supprimer</button>
                                    </div>
                                ) : (
                                    <div className="text-center">
                                        <SignatureIcon className="mx-auto h-10 w-10 text-slate-400 dark:text-zinc-500"/>
                                        <button
                                            type="button"
                                            onClick={handleImportSignature}
                                            disabled={isImportingSignature}
                                            className={`mt-2 text-sm font-semibold ${isImportingSignature ? 'text-slate-400 cursor-not-allowed' : 'text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 cursor-pointer'}`}
                                        >
                                            {isImportingSignature ? 'Importation...' : 'Importer une signature'}
                                        </button>
                                        <p className="text-xs text-slate-500 dark:text-zinc-500">Fichier image (PNG, JPG)</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Enseignant 2 — placé avant Direction */}
            <div className="space-y-4">
                <SectionHeader title={teacher2TitleLabel} open={openTeacher2} onToggle={() => toggleSection('teacher2')} />
                {openTeacher2 && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300">Civilité</label>
                            <div className="mt-2 flex gap-x-6">
                                <label className="flex items-center">
                                    <input type="radio" name="teacher2Title" value="Madame" checked={(config.teacher2Title ?? DEFAULT_CIVILITY) === 'Madame'} onChange={handleChange} />
                                    <span className="ml-2 text-sm text-slate-900 dark:text-zinc-300">Madame</span>
                                </label>
                                <label className="flex items-center">
                                    <input type="radio" name="teacher2Title" value="Monsieur" checked={(config.teacher2Title ?? DEFAULT_CIVILITY) === 'Monsieur'} onChange={handleChange} />
                                    <span className="ml-2 text-sm text-slate-900 dark:text-zinc-300">Monsieur</span>
                                </label>
                            </div>
                        </div>
                        <div>
                            <label htmlFor="teacher2FirstName" className="block text-sm font-medium text-slate-700 dark:text-zinc-300">Prénom</label>
                            <div className="relative mt-1">
                                <input type="text" id="teacher2FirstName" name="teacher2FirstName" value={config.teacher2FirstName || ''} onChange={handleChange} className="block w-full text-sm px-3 py-2 bg-white dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600 rounded-md shadow-sm pr-10"/>
                                <div className="group/tooltip absolute inset-y-0 right-0 flex items-center pr-3">
                                    <button
                                        type="button"
                                        onClick={() => onConfigChange({ ...config, showTeacher2FirstName: !(config.showTeacher2FirstName ?? true) })}
                                        className="text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                                    >
                                        {(config.showTeacher2FirstName ?? true) ? <EyeIcon className="h-5 w-5" /> : <EyeSlashIcon className="h-5 w-5" />}
                                    </button>
                                    <div className="absolute top-full right-0 mt-1.5 px-2.5 py-1.5 bg-white dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-600 text-xs rounded-md shadow-lg opacity-0 group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100 transition-opacity duration-200 invisible group-hover/tooltip:visible group-focus-within/tooltip:visible z-50 pointer-events-none font-normal whitespace-nowrap">
                                        {(config.showTeacher2FirstName ?? true) ? "Masquer le prénom dans la signature" : "Afficher le prénom dans la signature"}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div>
                            <label htmlFor="teacher2LastName" className="block text-sm font-medium text-slate-700 dark:text-zinc-300">Nom</label>
                            <input type="text" id="teacher2LastName" name="teacher2LastName" value={config.teacher2LastName || ''} onChange={handleChange} className="mt-1 block w-full text-sm px-3 py-2 bg-white dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600 rounded-md shadow-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300">Signature</label>
                            <div className="mt-1 flex items-center justify-center w-full p-4 border-2 border-slate-300 dark:border-zinc-600 border-dashed rounded-md">
                                {config.teacher2Signature ? (
                                    <div className="text-center">
                                        <StoredImage src={config.teacher2Signature} alt="Signature enseignant 2" className="max-h-20 mx-auto bg-white p-1 rounded"/>
                                        <button onClick={removeTeacher2Signature} className="mt-2 text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-semibold">Supprimer</button>
                                    </div>
                                ) : (
                                    <div className="text-center">
                                        <SignatureIcon className="mx-auto h-10 w-10 text-slate-400 dark:text-zinc-500"/>
                                        <button
                                            type="button"
                                            onClick={handleImportTeacher2Signature}
                                            disabled={isImportingSignature}
                                            className={`mt-2 text-sm font-semibold ${isImportingSignature ? 'text-slate-400 cursor-not-allowed' : 'text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 cursor-pointer'}`}
                                        >
                                            {isImportingSignature ? 'Importation...' : 'Importer une signature'}
                                        </button>
                                        <p className="text-xs text-slate-500 dark:text-zinc-500">Fichier image (PNG, JPG)</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Direction */}
            <div className="space-y-4">
                <SectionHeader title="Direction" open={openDirector} onToggle={() => toggleSection('director')} />
                {openDirector && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300">Civilité</label>
                            <div className="mt-2 flex gap-x-6">
                                <label className="flex items-center">
                                    <input type="radio" name="directorTitle" value="Madame" checked={(config.directorTitle ?? DEFAULT_CIVILITY) === 'Madame'} onChange={handleChange} />
                                    <span className="ml-2 text-sm text-slate-900 dark:text-zinc-300">Madame</span>
                                </label>
                                <label className="flex items-center">
                                    <input type="radio" name="directorTitle" value="Monsieur" checked={config.directorTitle === 'Monsieur'} onChange={handleChange} />
                                    <span className="ml-2 text-sm text-slate-900 dark:text-zinc-300">Monsieur</span>
                                </label>
                            </div>
                        </div>
                        <div>
                            <label htmlFor="directorFirstName" className="block text-sm font-medium text-slate-700 dark:text-zinc-300">Prénom</label>
                            <div className="relative mt-1">
                                <input type="text" id="directorFirstName" name="directorFirstName" value={config.directorFirstName || ''} onChange={handleChange} className="block w-full text-sm px-3 py-2 bg-white dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600 rounded-md shadow-sm pr-10"/>
                                <div className="group/tooltip absolute inset-y-0 right-0 flex items-center pr-3">
                                    <button
                                        type="button"
                                        onClick={() => onConfigChange({ ...config, showDirectorFirstName: !(config.showDirectorFirstName ?? true) })}
                                        className="text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                                    >
                                        {(config.showDirectorFirstName ?? true) ? <EyeIcon className="h-5 w-5" /> : <EyeSlashIcon className="h-5 w-5" />}
                                    </button>
                                    <div className="absolute top-full right-0 mt-1.5 px-2.5 py-1.5 bg-white dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-600 text-xs rounded-md shadow-lg opacity-0 group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100 transition-opacity duration-200 invisible group-hover/tooltip:visible group-focus-within/tooltip:visible z-50 pointer-events-none font-normal whitespace-nowrap">
                                        {(config.showDirectorFirstName ?? true) ? "Masquer le prénom dans la signature" : "Afficher le prénom dans la signature"}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div>
                            <label htmlFor="directorLastName" className="block text-sm font-medium text-slate-700 dark:text-zinc-300">Nom</label>
                            <input type="text" id="directorLastName" name="directorLastName" value={config.directorLastName || ''} onChange={handleChange} className="mt-1 block w-full text-sm px-3 py-2 bg-white dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600 rounded-md shadow-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300">Signature</label>
                            <div className="mt-1 flex items-center justify-center w-full p-4 border-2 border-slate-300 dark:border-zinc-600 border-dashed rounded-md">
                                {config.directorSignature ? (
                                    <div className="text-center">
                                        <StoredImage src={config.directorSignature} alt="Signature direction" className="max-h-20 mx-auto bg-white p-1 rounded"/>
                                        <button onClick={removeDirectorSignature} className="mt-2 text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-semibold">Supprimer</button>
                                    </div>
                                ) : (
                                    <div className="text-center">
                                        <SignatureIcon className="mx-auto h-10 w-10 text-slate-400 dark:text-zinc-500"/>
                                        <button
                                            type="button"
                                            onClick={handleImportDirectorSignature}
                                            disabled={isImportingSignature}
                                            className={`mt-2 text-sm font-semibold ${isImportingSignature ? 'text-slate-400 cursor-not-allowed' : 'text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 cursor-pointer'}`}
                                        >
                                            {isImportingSignature ? 'Importation...' : 'Importer une signature'}
                                        </button>
                                        <p className="text-xs text-slate-500 dark:text-zinc-500">Fichier image (PNG, JPG)</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Action Livrets */}
            <div className="pt-2">
                <div className="relative" ref={exportMenuRef}>
                    <button
                        onClick={() => setIsExportMenuOpen(prev => !prev)}
                        className="w-full text-center px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 font-semibold transition-colors shadow-sm flex items-center justify-center gap-2"
                    >
                        Action Livrets
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" /></svg>
                    </button>
                    {isExportMenuOpen && (
                        <div className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-zinc-700 border border-slate-200 dark:border-zinc-600 rounded-md shadow-lg z-10 overflow-hidden">
                            <button
                                onClick={() => { onExportSingle(); setIsExportMenuOpen(false); }}
                                disabled={isSingleExportDisabled}
                                className="w-full text-left flex items-center gap-3 px-4 py-3 text-sm text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed border-b border-slate-100 dark:border-zinc-600"
                            >
                                <DocumentArrowDownIcon className="w-5 h-5 flex-shrink-0" />
                                <span>Exporter ce livret</span>
                            </button>
                            <button
                                onClick={() => { onBatchExport(); setIsExportMenuOpen(false); }}
                                className="w-full text-left flex items-center gap-3 px-4 py-3 text-sm text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-600 border-b border-slate-100 dark:border-zinc-600"
                            >
                                <FolderArrowDownIcon className="w-5 h-5 flex-shrink-0" />
                                <span>Exporter les livrets validés</span>
                            </button>
                            <Tooltip content="Génère un PDF commun contenant l'introduction et les attendus en fin de maternelle par domaine. Ce document est indépendant des livrets individuels." position="top" className="whitespace-normal leading-relaxed w-80" wrapperClassName="w-full">
                                <button
                                    onClick={() => { onExportAnnex(); setIsExportMenuOpen(false); }}
                                    className="w-full text-left flex items-center gap-3 px-4 py-3 text-sm text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-600"
                                >
                                    <DocumentTextIcon className="w-5 h-5 flex-shrink-0" />
                                    <span>Exporter l'annexe commune</span>
                                </button>
                            </Tooltip>
                        </div>
                    )}
                </div>
            </div>
        </div>
        {pendingDeletePeriod !== null && (
            <ConfirmationModal
                title="Supprimer cette période"
                message="Cette période sera définitivement supprimée. Les bilans déjà rédigés pour cette période (chez tous les élèves) seront effacés et les périodes suivantes seront renumérotées. Cette action est irréversible."
                confirmText="Supprimer"
                onConfirm={() => { onDeleteDomainPeriod(pendingDeletePeriod); setPendingDeletePeriod(null); }}
                onCancel={() => setPendingDeletePeriod(null)}
            />
        )}
        </>
    );
};

export default LivretConfig;
