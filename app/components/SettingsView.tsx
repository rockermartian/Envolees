
import React, { useState } from 'react';
import { AppUISettings, TeacherConfig } from '../types';
import Tooltip from './Tooltip';
import PinSetupModal from './PinSetupModal';
import NuageAccountCard from './NuageAccountCard';
import { DEFAULT_MIN_MINUTES_BETWEEN_SCANS, isPinDefined } from '../domain/studentMode';

interface SettingsViewProps {
    settings: AppUISettings;
    onSettingsChange: (newSettings: AppUISettings) => void;
    teacherConfig: TeacherConfig;
    onTeacherConfigChange: (config: TeacherConfig) => void;
}

const ClockIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
);


const SettingsView: React.FC<SettingsViewProps> = ({ settings, onSettingsChange, teacherConfig, onTeacherConfigChange }) => {
    const [isPinSetupOpen, setIsPinSetupOpen] = useState(false);
    const handleChangeInterval = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = parseInt(e.target.value, 10);
        onSettingsChange({ ...settings, autoSaveInterval: val });
    };

    return (
        <div className="p-8 max-sm:p-4 h-full bg-white dark:bg-zinc-900 overflow-y-auto">
            <div className="max-w-2xl mx-auto space-y-6">
                <h1 className="text-2xl font-bold text-slate-800 dark:text-zinc-200 mb-6 border-b border-slate-200 dark:border-zinc-700 pb-4">
                    Paramètres de l'application
                </h1>

                <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-6 max-sm:p-4 border border-slate-200 dark:border-zinc-700">
                    <div className="flex items-start gap-4">
                        <div className="max-sm:hidden p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                            <ClockIcon className="w-6 h-6" />
                        </div>
                        <div className="flex-grow min-w-0">
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-zinc-200">Sauvegarde automatique</h3>
                            <p className="text-slate-500 dark:text-zinc-400 text-sm mt-1 mb-4">
                                Votre travail est enregistré automatiquement 30 secondes après chaque modification,
                                et au plus tard à la fréquence choisie si vous travaillez en continu.
                                L'enregistrement se fait en arrière-plan : vous pouvez continuer à travailler.
                            </p>

                            <div className="flex items-center gap-3 max-sm:flex-col max-sm:items-start max-sm:gap-1">
                                <label htmlFor="auto-save" className="text-sm font-medium text-slate-700 dark:text-zinc-300">
                                    Au plus tard :
                                </label>
                                <select
                                    id="auto-save"
                                    value={settings.autoSaveInterval}
                                    onChange={handleChangeInterval}
                                    className="block w-48 max-sm:w-full rounded-md border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-slate-900 dark:text-zinc-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm py-2 px-3"
                                >
                                    <option value={1}>Toutes les minutes</option>
                                    <option value={5}>Toutes les 5 minutes</option>
                                    <option value={10}>Toutes les 10 minutes</option>
                                    <option value={15}>Toutes les 15 minutes</option>
                                    <option value={30}>Toutes les 30 minutes</option>
                                    <option value={0}>Désactivé (Manuel uniquement)</option>
                                </select>
                            </div>
                            <p className="text-slate-500 dark:text-zinc-400 text-sm mt-4">
                                Copies de sécurité : avant d'être écrasé, votre fichier est copié (au plus une fois
                                toutes les 30 minutes) ; les 3 dernières copies de chaque classe sont conservées.
                            </p>
                            <button
                                type="button"
                                onClick={() => window.electronAPI?.openBackupsFolder()}
                                className="mt-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                            >
                                Ouvrir le dossier des copies de sécurité
                            </button>
                        </div>
                    </div>
                </div>

                <NuageAccountCard />

                <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-6 max-sm:p-4 border border-slate-200 dark:border-zinc-700">
                    <div className="flex items-start gap-4">
                        <div className="max-sm:hidden p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                            </svg>
                        </div>
                        <div className="flex-grow min-w-0">
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-zinc-200">Mode Élève (Code PIN)</h3>
                            <p className="text-slate-500 dark:text-zinc-400 text-sm mt-1 mb-4">
                                Code nécessaire pour quitter le mode élève (4 à 8 chiffres). Après 5 erreurs, la saisie est bloquée quelques instants.
                            </p>

                            <div className="flex flex-wrap items-center gap-3">
                                <span className="text-sm font-medium text-slate-700 dark:text-zinc-300">Code PIN :</span>
                                {isPinDefined(teacherConfig.studentModePin)
                                    ? <span className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">défini</span>
                                    : <span className="text-sm text-amber-700 dark:text-amber-400 font-medium">à définir</span>}
                                <button
                                    type="button"
                                    onClick={() => setIsPinSetupOpen(true)}
                                    className="ml-2 px-3 py-1.5 text-sm font-medium rounded-md border border-slate-300 dark:border-zinc-600 text-slate-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-700"
                                >
                                    {isPinDefined(teacherConfig.studentModePin) ? 'Modifier le code' : 'Définir le code'}
                                </button>
                            </div>
                            {isPinSetupOpen && (
                                <PinSetupModal
                                    title="Code PIN du mode élève"
                                    description="Ce code permet de quitter le mode élève (et, si l'option est active, de valider un atelier au 2e scan)."
                                    confirmText="Enregistrer"
                                    onConfirm={(pin) => { onTeacherConfigChange({ ...teacherConfig, studentModePin: pin }); setIsPinSetupOpen(false); }}
                                    onCancel={() => setIsPinSetupOpen(false)}
                                />
                            )}
                            <div className="flex items-center gap-3 mt-4">
                                <label htmlFor="scan-delay" className="text-sm font-medium text-slate-700 dark:text-zinc-300">
                                    Délai minimal entre le 1<sup>er</sup> et le 2<sup>e</sup> scan d'un atelier :
                                </label>
                                <select
                                    id="scan-delay"
                                    value={teacherConfig.minMinutesBetweenScans ?? DEFAULT_MIN_MINUTES_BETWEEN_SCANS}
                                    onChange={(e) => onTeacherConfigChange({ ...teacherConfig, minMinutesBetweenScans: parseInt(e.target.value, 10) })}
                                    className="block rounded-md border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-slate-900 dark:text-zinc-200 shadow-sm sm:text-sm py-2 px-3"
                                >
                                    <option value={0}>Aucun</option>
                                    <option value={2}>2 minutes</option>
                                    <option value={5}>5 minutes</option>
                                    <option value={10}>10 minutes</option>
                                    <option value={15}>15 minutes</option>
                                    <option value={20}>20 minutes</option>
                                </select>
                            </div>
                            <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200 dark:border-zinc-700">
                                <div>
                                    <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">Validation par code PIN</p>
                                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">Requiert le code PIN enseignant pour valider un atelier au 2ᵉ scan.</p>
                                </div>
                                <label className="flex items-center cursor-pointer ml-4">
                                    <input
                                        type="checkbox"
                                        checked={!!teacherConfig.requirePinForValidation}
                                        onChange={(e) => onTeacherConfigChange({ ...teacherConfig, requirePinForValidation: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <div className="relative w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-zinc-600 peer-checked:bg-blue-600"></div>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="fixed bottom-4 right-4 max-sm:static max-sm:pt-2 max-sm:text-center">
                  <Tooltip content="Créé par Mathilde Tripenne et James Lardeur" position="top-right" className="whitespace-nowrap">
                    <span className="text-xs font-medium text-slate-400 dark:text-zinc-500 cursor-default select-none">
                      Version {import.meta.env.VITE_APP_VERSION}
                    </span>
                  </Tooltip>
                </div>
            </div>
        </div>
    );
};

export default SettingsView;
