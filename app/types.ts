
export enum Proficiency {
  NotAcquired = 'Non acquis',
  Acquired = 'Acquis',
}

export enum Section {
  TPS = 'TPS',
  PS = 'PS',
  MS = 'MS',
  GS = 'GS'
}

export enum Sex {
  Boy = 'Garçon',
  Girl = 'Fille',
}

export enum ReferenceAge {
  Under4 = 'Moins de 4 ans',
  At4 = 'À partir de 4 ans',
  Over4 = 'À partir de 5 ans',
}

export interface Skill {
  id: string;
  name: string;
  referenceAges: ReferenceAge[];
  image?: string | null;
  description?: string;
}

export interface Domain {
  id: string;
  name: string;
  expectations: string[];
  skills: Skill[];
  subDomains: Domain[];
}

export interface SchoolProgram {
  id: string;
  name: string;
  domains: Domain[];
  enabled?: boolean;
}

export interface SkillAcquisitionDetails {
  proficiency: Proficiency;
  date?: string; // YYYY-MM-DD
  photo?: string | null; // base64 string
  section?: Section;
}

export interface StudentSkill {
  [skillId: string]: SkillAcquisitionDetails;
}

export interface StudentDomainComments {
  [domainId: string]: string[];
}

export interface DomainCommentPeriod {
  id: string;
  name: string;
  active: boolean;
}

export interface Workshop {
  id: string;
  name: string;
  description: string;
  image: string | null;
  skillIds: string[];
  isActive: boolean;
  createdAt: string;
}

export type WorkshopEventType = 'scan' | 'validation' | 'rejection' | 'auto_validation';

export interface WorkshopEvent {
  id: string;
  workshopId: string;
  studentId: string;
  timestamp: string;
  type: WorkshopEventType;
  status: 'pending' | 'processed';
  // Compétences que ce passage a réellement fait passer à « Acquis » (celles déjà acquises
  // sont ignorées). Un refus ultérieur ne retire que celles-ci.
  grantedSkillIds?: string[];
}

export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  photo: string | null;
  dob: string; // Date of birth YYYY-MM-DD
  section: Section;
  sex: Sex;
  contactEmail?: string;
  ine?: string;
  miscInfo?: string; // Informations diverses (santé, situation familiale…) — usage interne enseignant
  skills: StudentSkill;
  teacherComment?: string;
  teacher2Comment?: string;
  directorComment?: string;
  domainComments?: StudentDomainComments;
  livretProcessed?: boolean;
}

export interface AppUISettings {
    theme: 'light' | 'dark';
    livretIsStudentListCollapsed: boolean;
    livretIsConfigCollapsed: boolean;
    autoSaveInterval: number; // En minutes
    // État d'ouverture des volets de la config du livret, mémorisé par fichier.
    // Clé = identifiant du volet ; valeur = ouvert (true) / replié (false, défaut).
    livretConfigOpenSections?: Record<string, boolean>;
}

export interface SupportGroup {
  id: string;
  type: 'suggested' | 'free';
  name: string;
  maxStudents: number;
  filterIds: string[];
  studentIds: string[];
  addedStudentIds?: string[];    // suggested: manually added on top of suggestion
  excludedStudentIds?: string[]; // suggested: manually removed from suggestion
}

export interface AppData {
    version: string;
    students: Student[];
    schoolPrograms: SchoolProgram[];
    workshops: Workshop[];
    workshopEvents: WorkshopEvent[];
    teacherConfig: TeacherConfig;
    uiSettings: AppUISettings;
    supportGroups?: SupportGroup[];
}


export interface TeacherConfig {
  schoolName: string;
  teacherFirstName: string;
  teacherLastName: string;
  teacherTitle: 'Madame' | 'Monsieur';
  showTeacherFirstName: boolean;
  directorTitle?: 'Madame' | 'Monsieur';
  directorFirstName?: string;
  directorLastName?: string;
  showDirectorFirstName?: boolean;
  teacherSignature: string | null;
  teacher2Title?: 'Madame' | 'Monsieur';
  teacher2FirstName?: string;
  teacher2LastName?: string;
  showTeacher2FirstName?: boolean;
  teacher2Signature?: string | null;
  directorSignature?: string | null;
  showTeacherSignature?: boolean;
  showTeacher2Signature?: boolean;
  showParentsSignature?: boolean;
  showDirectorSignature?: boolean;
  schoolYear: string;
  showExpectations: boolean;
  showNotAcquiredSkills: boolean;
  showTeacherComment: boolean;
  showTeacher2Comment?: boolean;
  showDirectorComment?: boolean;
  showDomainComments: boolean;
  domainCommentPeriods?: DomainCommentPeriod[];
  usePeriodsForDomainComments?: boolean;
  period1Name?: string;
  period2Name?: string;
  showIntroduction: boolean;
  introduction: string;
  livretLayoutMode?: 'classic' | 'compact';
  livretDateFilterStart?: string;
  livretDateFilterEnd?: string;
  livretSkillsPerColumn?: number;
  studentModePin?: string;
  requirePinForValidation?: boolean;
  // Délai minimal (minutes) entre le 1er scan d'un atelier et le 2e (validation). 0 = aucun.
  minMinutesBetweenScans?: number;
}
