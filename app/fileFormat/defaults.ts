import { AppData, AppUISettings, TeacherConfig } from '../types';

/** Version du schéma de données écrite dans les fichiers. */
export const DATA_VERSION = '2';

// Détermine l'année scolaire courante selon la date réelle.
// Une année scolaire N → N+1 démarre le 15 août : avant, on est encore sur N-1 → N.
export const getCurrentSchoolYear = (now = new Date()): string => {
    const year = now.getFullYear();
    const month = now.getMonth(); // 0 = janvier, 7 = août
    const day = now.getDate();
    const startYear = (month > 7 || (month === 7 && day >= 15)) ? year : year - 1;
    return `${startYear}-${startYear + 1}`;
};

/** Civilité par défaut de l'enseignant(e), de l'enseignant(e) 2 et de la direction (écran ET livret). */
export const DEFAULT_CIVILITY = 'Madame' as const;

export const createDefaultTeacherConfig = (): TeacherConfig => ({
    schoolName: '',
    teacherFirstName: '',
    teacherLastName: '',
    teacherTitle: DEFAULT_CIVILITY,
    teacher2Title: DEFAULT_CIVILITY,
    showTeacherFirstName: false,
    directorTitle: DEFAULT_CIVILITY,
    teacherSignature: null,
    directorSignature: null,
    schoolYear: getCurrentSchoolYear(),
    showExpectations: false,
    showNotAcquiredSkills: false,
    showTeacherComment: false,
    showTeacher2Comment: false,
    showDirectorComment: false,
    showDomainComments: false,
    domainCommentPeriods: [{ id: 'period-1', name: '', active: true }],
    showIntroduction: false,
    introduction: '',
    livretLayoutMode: 'classic',
    studentModePin: '', // à définir avant la première utilisation du mode élève
    minMinutesBetweenScans: 5,
});

export const createDefaultUiSettings = (theme: 'light' | 'dark' = 'light'): AppUISettings => ({
    theme,
    livretIsStudentListCollapsed: false,
    livretIsConfigCollapsed: true,
    autoSaveInterval: 5, // minutes
});

export const createEmptyAppData = (theme: 'light' | 'dark' = 'light'): AppData => ({
    version: DATA_VERSION,
    students: [],
    schoolPrograms: [],
    workshops: [],
    workshopEvents: [],
    teacherConfig: createDefaultTeacherConfig(),
    uiSettings: createDefaultUiSettings(theme),
    supportGroups: [],
});
