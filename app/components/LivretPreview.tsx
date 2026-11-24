import React, { useState, useRef, useEffect } from 'react';
import { Student, SchoolProgram, Proficiency, Sex, Skill, Domain, TeacherConfig } from '../types';
import { calculateAge, sectionNames } from '../utils';
import StoredImage from '../images/StoredImage';
import { formatDateFR } from '../domain/dates';
import { DEFAULT_CIVILITY } from '../fileFormat/defaults';

interface LivretPreviewProps {
  student: Student;
  schoolPrograms: SchoolProgram[];
  teacherConfig: TeacherConfig;
  onConfigChange: (config: TeacherConfig) => void;
  onUpdateStudentComment: (studentId: string, comment: string) => void;
  onUpdateStudentTeacher2Comment: (studentId: string, comment: string) => void;
  onUpdateStudentDirectorComment: (studentId: string, comment: string) => void;
  onUpdateStudentDomainComment: (studentId: string, domainId: string, comment: string, periodIndex: number) => void;
  onPaginatedAndReadyForExport?: (studentId: string) => void;
  isPaginating: boolean;
  setIsPaginating: (isPaginating: boolean) => void;
  zoomLevel: number;
  transformOrigin: string;
}

// --- ICONS ---
const UserIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path fillRule="evenodd" d="M18.685 19.097A9.723 9.723 0 0021.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 003.065 7.097A9.716 9.716 0 0012 21.75a9.716 9.716 0 006.685-2.653zm-12.54-1.285A7.486 7.486 0 0112 15a7.486 7.486 0 015.855 2.812A8.224 8.224 0 0112 20.25a8.224 8.224 0 01-5.855-2.438zM15.75 9a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" clipRule="evenodd" />
    </svg>
);
const SpinnerIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

// --- PAGE STRUCTURE COMPONENTS ---

const PageHeader: React.FC<{ student: Student; teacherConfig: TeacherConfig }> = React.memo(({ student, teacherConfig }) => (
    <header className="flex justify-between items-start pb-3 mb-5 border-b-2 border-slate-800 flex-shrink-0 break-inside-avoid">
        <div>
            <h1 className="text-lg font-bold text-slate-900 leading-tight">Livret de Suivi des Acquis</h1>
            {teacherConfig.schoolName && <p className="text-sm text-slate-600 mt-0.5">{teacherConfig.schoolName}</p>}
            <p className="text-xs text-slate-500 mt-0.5">Année scolaire {teacherConfig.schoolYear}</p>
        </div>
        <div className="flex items-center gap-3">
            <div className="text-right">
                <p className="text-base font-bold text-slate-800">{student.firstName} {student.lastName}</p>
                <p className="text-xs text-slate-500">
                    {student.sex === Sex.Girl ? 'Née' : 'Né'} le {formatDateFR(student.dob) || '—'}
                </p>
                <p className="text-xs text-slate-500">
                    {calculateAge(student.dob)} ans · <span className="font-semibold text-slate-600">{sectionNames[student.section]}</span>
                </p>
            </div>
            <div className="w-16 h-16 rounded-full bg-slate-100 flex-shrink-0 overflow-hidden flex items-center justify-center border border-slate-200">
                {student.photo
                    ? <StoredImage src={student.photo} alt={`${student.firstName} ${student.lastName}`} className="w-full h-full object-cover" />
                    : <UserIcon className="w-9 h-9 text-slate-400" />
                }
            </div>
        </div>
    </header>
));

const Signatures: React.FC<{ teacherConfig: TeacherConfig }> = React.memo(({ teacherConfig }) => {
    const showTeacher = teacherConfig.showTeacherSignature ?? true;
    const showTeacher2 = teacherConfig.showTeacher2Signature ?? false;
    const showParents = teacherConfig.showParentsSignature ?? true;
    const showDirector = teacherConfig.showDirectorSignature ?? true;

    if (!showTeacher && !showTeacher2 && !showParents && !showDirector) return null;

    const teacherSignatureLabel = teacherConfig.teacherTitle === 'Madame' ? "L'enseignante" : "L'enseignant";
    const teacherName = teacherConfig.showTeacherFirstName
        ? `${teacherConfig.teacherTitle} ${teacherConfig.teacherFirstName} ${teacherConfig.teacherLastName}`
        : `${teacherConfig.teacherTitle} ${teacherConfig.teacherLastName}`;

    const teacher2Civility = teacherConfig.teacher2Title ?? DEFAULT_CIVILITY;
    const teacher2SignatureLabel = teacher2Civility === 'Madame' ? "L'enseignante" : "L'enseignant";
    const teacher2Name = (teacherConfig.showTeacher2FirstName ?? true) && teacherConfig.teacher2FirstName
        ? `${teacher2Civility} ${teacherConfig.teacher2FirstName} ${teacherConfig.teacher2LastName || ''}`
        : `${teacher2Civility} ${teacherConfig.teacher2LastName || ''}`;

    const directorCivility = teacherConfig.directorTitle ?? DEFAULT_CIVILITY;
    const directorLabel = directorCivility === 'Monsieur' ? 'Le Directeur' : 'La Directrice';
    const directorDisplayName = teacherConfig.directorLastName
        ? ((teacherConfig.showDirectorFirstName ?? true) && teacherConfig.directorFirstName
            ? `${directorCivility} ${teacherConfig.directorFirstName} ${teacherConfig.directorLastName}`
            : `${directorCivility} ${teacherConfig.directorLastName}`)
        : 'Signature';

    const allFour = showTeacher && showTeacher2 && showParents && showDirector;

    const teacher1Block = showTeacher && (
        <div className="flex-1 px-2">
            <p className="font-semibold text-sm text-slate-800">{teacherSignatureLabel}</p>
            <div className="relative mt-1 h-14 flex items-center justify-center">
                {teacherConfig.teacherSignature && <StoredImage src={teacherConfig.teacherSignature} alt="Signature Enseignant" className="max-h-full max-w-full" />}
            </div>
            <div className="border-t border-slate-400 mt-1 pt-1 text-xs text-slate-600">{teacherName}</div>
        </div>
    );

    const teacher2Block = showTeacher2 && (
        <div className="flex-1 px-2">
            <p className="font-semibold text-sm text-slate-800">{teacher2SignatureLabel}</p>
            <div className="relative mt-1 h-14 flex items-center justify-center">
                {teacherConfig.teacher2Signature && <StoredImage src={teacherConfig.teacher2Signature} alt="Signature Enseignant 2" className="max-h-full max-w-full" />}
            </div>
            <div className="border-t border-slate-400 mt-1 pt-1 text-xs text-slate-600">{teacher2Name}</div>
        </div>
    );

    const parentsBlock = showParents && (
        <div className="flex-1 px-2">
            <p className="font-semibold text-sm text-slate-800">Les parents</p>
            <div className="mt-1 h-14" />
            <div className="border-t border-slate-400 mt-1 pt-1 text-xs text-slate-600">Signature des parents / responsable légal</div>
        </div>
    );

    const directorBlock = showDirector && (
        <div className="flex-1 px-2">
            <p className="font-semibold text-sm text-slate-800">{directorLabel}</p>
            <div className="relative mt-1 h-14 flex items-center justify-center">
                {teacherConfig.directorSignature && <StoredImage src={teacherConfig.directorSignature} alt="Signature Direction" className="max-h-full max-w-full" />}
            </div>
            <div className="border-t border-slate-400 mt-1 pt-1 text-xs text-slate-600">{directorDisplayName}</div>
        </div>
    );

    return (
        <section className="mt-8 pt-4 border-t-2 border-dashed border-slate-400 break-inside-avoid">
            {allFour ? (
                <>
                    <div className="flex justify-between items-start text-center gap-4 mb-8">
                        {teacher1Block}
                        {teacher2Block}
                    </div>
                    <div className="flex justify-between items-start text-center gap-4">
                        {parentsBlock}
                        {directorBlock}
                    </div>
                </>
            ) : (
                <div className="flex justify-between items-start text-center gap-4">
                    {teacher1Block}
                    {teacher2Block}
                    {parentsBlock}
                    {directorBlock}
                </div>
            )}
        </section>
    );
});

// --- CONTENT COMPONENTS ---

const IntroductionContent: React.FC<{ config: TeacherConfig; onConfigChange: (c: TeacherConfig) => void }> = React.memo(({ config, onConfigChange }) => {
    const [localIntroduction, setLocalIntroduction] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    useEffect(() => { setLocalIntroduction(config.introduction || ''); }, [config.introduction]);
    useEffect(() => {
        const ta = textareaRef.current;
        if (ta) { ta.style.height = 'auto'; ta.style.height = `${ta.scrollHeight}px`; }
    }, [localIntroduction]);
    const handleBlur = () => {
        if (localIntroduction !== (config.introduction || '')) onConfigChange({ ...config, introduction: localIntroduction });
    };
    return (
        <section className="mb-4 break-inside-avoid">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Introduction</h3>
            <textarea
                ref={textareaRef}
                value={localIntroduction}
                onChange={e => setLocalIntroduction(e.target.value)}
                onBlur={handleBlur}
                placeholder="Saisissez ici le texte d'introduction commun à tous les livrets..."
                style={{ minHeight: '4rem' }}
                className="w-full p-2 border border-slate-200 rounded text-sm bg-white text-slate-800 resize-none overflow-hidden print-hidden focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
            />
            <div className="hidden print:block text-sm text-slate-700 whitespace-pre-wrap min-h-[4rem] p-2 border border-slate-300 rounded">
                {config.introduction || ''}
            </div>
        </section>
    );
});

// Titre d'une appréciation d'enseignant : « Appréciation de Madame Dupont » si un nom est
// renseigné (utile pour distinguer deux enseignants), sinon libellé générique selon la civilité.
const teacherApprecLabel = (title: 'Madame' | 'Monsieur' | undefined, lastName?: string): string => {
    const civ = title === 'Monsieur' ? 'Monsieur' : 'Madame';
    const name = (lastName || '').trim();
    if (name) return `Appréciation de ${civ} ${name}`;
    return civ === 'Madame' ? "Appréciation de l'enseignante" : "Appréciation de l'enseignant";
};

const TeacherCommentContent: React.FC<{ student: Student; config: TeacherConfig; onUpdate: (s: string, c: string) => void }> = React.memo(({ student, config, onUpdate }) => {
    const [localComment, setLocalComment] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    useEffect(() => { setLocalComment(student.teacherComment || ''); }, [student.teacherComment]);
    useEffect(() => {
        const ta = textareaRef.current;
        if (ta) { ta.style.height = 'auto'; ta.style.height = `${ta.scrollHeight}px`; }
    }, [localComment]);
    const handleBlur = () => {
        if (localComment !== (student.teacherComment || '')) onUpdate(student.id, localComment);
    };
    const label = teacherApprecLabel(config.teacherTitle, config.teacherLastName);
    return (
        <section className="mt-5 break-inside-avoid">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">{label}</h3>
            <textarea
                ref={textareaRef}
                value={localComment}
                onChange={e => setLocalComment(e.target.value)}
                onBlur={handleBlur}
                placeholder="Saisissez votre appréciation générale sur le parcours de l'élève..."
                style={{ minHeight: '4rem' }}
                className="w-full p-2 border border-slate-200 rounded text-sm bg-white text-slate-800 resize-none overflow-hidden print-hidden focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
            />
            <div className="hidden print:block text-sm text-slate-700 whitespace-pre-wrap min-h-[4rem] p-2 border border-slate-300 rounded">
                {student.teacherComment || ''}
            </div>
        </section>
    );
});

const Teacher2CommentContent: React.FC<{ student: Student; config: TeacherConfig; onUpdate: (s: string, c: string) => void }> = React.memo(({ student, config, onUpdate }) => {
    const [localComment, setLocalComment] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    useEffect(() => { setLocalComment(student.teacher2Comment || ''); }, [student.teacher2Comment]);
    useEffect(() => {
        const ta = textareaRef.current;
        if (ta) { ta.style.height = 'auto'; ta.style.height = `${ta.scrollHeight}px`; }
    }, [localComment]);
    const handleBlur = () => {
        if (localComment !== (student.teacher2Comment || '')) onUpdate(student.id, localComment);
    };
    const label = teacherApprecLabel(config.teacher2Title, config.teacher2LastName);
    return (
        <section className="mt-5 break-inside-avoid">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">{label}</h3>
            <textarea
                ref={textareaRef}
                value={localComment}
                onChange={e => setLocalComment(e.target.value)}
                onBlur={handleBlur}
                placeholder="Saisissez l'appréciation du second enseignant..."
                style={{ minHeight: '4rem' }}
                className="w-full p-2 border border-slate-200 rounded text-sm bg-white text-slate-800 resize-none overflow-hidden print-hidden focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
            />
            <div className="hidden print:block text-sm text-slate-700 whitespace-pre-wrap min-h-[4rem] p-2 border border-slate-300 rounded">
                {student.teacher2Comment || ''}
            </div>
        </section>
    );
});

const DirectorCommentContent: React.FC<{ student: Student; config: TeacherConfig; onUpdate: (s: string, c: string) => void }> = React.memo(({ student, config, onUpdate }) => {
    const [localComment, setLocalComment] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    useEffect(() => { setLocalComment(student.directorComment || ''); }, [student.directorComment]);
    useEffect(() => {
        const ta = textareaRef.current;
        if (ta) { ta.style.height = 'auto'; ta.style.height = `${ta.scrollHeight}px`; }
    }, [localComment]);
    const handleBlur = () => {
        if (localComment !== (student.directorComment || '')) onUpdate(student.id, localComment);
    };
    const dirTitleLabel = (config.directorTitle ?? DEFAULT_CIVILITY) === 'Monsieur' ? 'Le Directeur' : 'La Directrice';
    const prep = dirTitleLabel.toLowerCase().startsWith('le ')
        ? `du ${dirTitleLabel.slice(3)}`
        : `de ${dirTitleLabel}`;
    return (
        <section className="mt-5 break-inside-avoid">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Appréciation {prep}</h3>
            <textarea
                ref={textareaRef}
                value={localComment}
                onChange={e => setLocalComment(e.target.value)}
                onBlur={handleBlur}
                placeholder="Saisissez l'appréciation de la direction..."
                style={{ minHeight: '4rem' }}
                className="w-full p-2 border border-slate-200 rounded text-sm bg-white text-slate-800 resize-none overflow-hidden print-hidden focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
            />
            <div className="hidden print:block text-sm text-slate-700 whitespace-pre-wrap min-h-[4rem] p-2 border border-slate-300 rounded">
                {student.directorComment || ''}
            </div>
        </section>
    );
});

const SkillCard: React.FC<{ skill: Skill; student: Student }> = ({ skill, student }) => {
    const details = student.skills[skill.id];
    const imageToShow = details?.photo || skill.image;
    return (
        <div className="border border-slate-200 rounded bg-white p-1.5 flex flex-col gap-1 break-inside-avoid h-full">
            {imageToShow && (
                <div className="w-full h-28 bg-slate-50 rounded overflow-hidden flex items-center justify-center">
                    <StoredImage src={imageToShow} alt={`Preuve pour ${skill.name}`} className="max-w-full max-h-full object-contain" />
                </div>
            )}
            <span className="text-xs text-slate-700 font-medium text-center leading-tight px-0.5 flex-grow">{skill.name}</span>
            {details?.date && (
                <span className="text-xs text-slate-400 text-right leading-tight">
                    {formatDateFR(details.date, { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    {details.section && ` · ${details.section}`}
                </span>
            )}
        </div>
    );
};

const CompactAcquiredSkillItem: React.FC<{ skill: Skill; student: Student }> = ({ skill, student }) => {
    const details = student.skills[skill.id];
    return (
        <li className="flex items-baseline gap-2 py-0.5 break-inside-avoid">
            <span className="text-xs text-slate-700 min-w-0 break-words">{skill.name}</span>
            <span className="flex-grow border-b border-dotted border-slate-300 min-w-2"></span>
            <span className="text-xs text-slate-400 flex-shrink-0">
                {formatDateFR(details.date)}
                {details.section && ` · ${details.section}`}
            </span>
        </li>
    );
};

const NonAcquiredItem: React.FC<{ skill: Skill }> = ({ skill }) => (
    <span className="inline-flex items-center gap-1 text-xs text-slate-400 break-inside-avoid mr-3">
        <span className="inline-block w-1 h-1 bg-slate-300 rounded-full flex-shrink-0"></span>
        {skill.name}
    </span>
);

const DomainPeriodComment: React.FC<{
    domainId: string; periodIndex: number; periodName: string;
    student: Student; onUpdate: (comment: string) => void;
}> = ({ domainId, periodIndex, periodName, student, onUpdate }) => {
    const [comment, setComment] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    useEffect(() => { setComment(student.domainComments?.[domainId]?.[periodIndex] || ''); }, [student.domainComments, domainId, periodIndex]);
    useEffect(() => {
        const ref = textareaRef.current;
        if (ref) { ref.style.height = 'auto'; ref.style.height = `${ref.scrollHeight}px`; }
    }, [comment]);
    const handleBlur = () => {
        if (comment !== (student.domainComments?.[domainId]?.[periodIndex] || '')) onUpdate(comment);
    };
    return (
        <div className="mt-1.5 break-inside-avoid">
            <label className="text-xs font-medium text-slate-400">{periodName}</label>
            <textarea
                ref={textareaRef}
                value={comment}
                onChange={e => setComment(e.target.value)}
                onBlur={handleBlur}
                placeholder="Bilan..."
                style={{ minHeight: '2.5rem' }}
                className="w-full mt-0.5 p-1.5 border border-slate-200 rounded text-xs bg-white text-slate-800 resize-none overflow-hidden print-hidden focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
            <div className="hidden print:block text-xs text-slate-700 whitespace-pre-wrap min-h-[2.5rem] p-1.5 border border-slate-300 rounded">
                {student.domainComments?.[domainId]?.[periodIndex] || ''}
            </div>
        </div>
    );
};

// --- MAIN COMPONENT ---

const LivretPreview: React.FC<LivretPreviewProps> = ({
    student, schoolPrograms, teacherConfig, onConfigChange,
    onUpdateStudentComment, onUpdateStudentTeacher2Comment, onUpdateStudentDirectorComment, onUpdateStudentDomainComment,
    onPaginatedAndReadyForExport, isPaginating, setIsPaginating, zoomLevel, transformOrigin
}) => {
    const contentRef = useRef<HTMLDivElement>(null);
    const layoutMode = teacherConfig.livretLayoutMode || 'classic';

    const lastPaginatedStudentRef = useRef<string | null>(null);
    useEffect(() => {
        let cancelled = false;
        // Changement d'élève (dont l'export par lot) : pagination immédiate. Modification de la
        // configuration : on attend la fin de la frappe (sinon voile et boutons d'export clignotent
        // à chaque touche).
        const studentChanged = lastPaginatedStudentRef.current !== student.id;
        lastPaginatedStudentRef.current = student.id;
        const waitForReady = async () => {
            if (cancelled) return;
            setIsPaginating(true);
            await document.fonts.ready;
            const el = contentRef.current;
            if (el) {
                const images = Array.from(el.querySelectorAll('img')) as HTMLImageElement[];
                await Promise.all(
                    images
                        .filter(img => !img.complete)
                        .map(img => new Promise<void>(resolve => { img.onload = img.onerror = () => resolve(); }))
                );
                (Array.from(el.querySelectorAll('textarea')) as HTMLTextAreaElement[]).forEach(ta => {
                    ta.style.height = 'auto';
                    ta.style.height = `${ta.scrollHeight}px`;
                });
            }
            await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
            if (!cancelled) {
                setIsPaginating(false);
                onPaginatedAndReadyForExport?.(student.id);
            }
        };
        const timer = setTimeout(waitForReady, studentChanged ? 0 : 400);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [student.id, teacherConfig, schoolPrograms, setIsPaginating, onPaginatedAndReadyForExport]);

    const dateFilterStart = teacherConfig.livretDateFilterStart || null;
    const dateFilterEnd = teacherConfig.livretDateFilterEnd || null;
    const hasDateFilter = dateFilterStart || dateFilterEnd;

    const isInDateRange = (date?: string): boolean => {
        if (!date) return false;
        if (dateFilterStart && date < dateFilterStart) return false;
        if (dateFilterEnd && date > dateFilterEnd) return false;
        return true;
    };

    const hasContentRecursive = (domain: Domain): boolean => {
        const hasOwn = domain.skills.some(skill => {
            const details = student.skills[skill.id];
            if (details?.proficiency === Proficiency.Acquired) {
                return !hasDateFilter || isInDateRange(details.date);
            }
            return teacherConfig.showNotAcquiredSkills;
        });
        return hasOwn || (domain.subDomains || []).some(sub => hasContentRecursive(sub));
    };

    const renderDomain = (domain: Domain, level: number): React.ReactNode => {
        const allAcquired = domain.skills.filter(s => student.skills[s.id]?.proficiency === Proficiency.Acquired);
        const acquiredSkills = hasDateFilter
            ? allAcquired.filter(s => isInDateRange(student.skills[s.id]?.date))
            : allAcquired;
        const notAcquiredSkills = teacherConfig.showNotAcquiredSkills
            ? domain.skills.filter(s => student.skills[s.id]?.proficiency !== Proficiency.Acquired)
            : [];
        const hasSubContent = (domain.subDomains || []).some(sub => hasContentRecursive(sub));

        if (acquiredSkills.length === 0 && notAcquiredSkills.length === 0 && !hasSubContent) return null;

        const wrapperClass = level === 0 ? 'mt-6' : level === 1 ? 'mt-3 pl-3' : 'mt-2 pl-5';

        const headerEl = level === 0 ? (
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest pb-1.5 border-b border-slate-700">{domain.name}</h3>
        ) : level === 1 ? (
            <h4 className="text-sm font-semibold text-slate-700 border-b border-slate-200 pb-0.5">{domain.name}</h4>
        ) : (
            <h5 className="text-xs font-medium text-slate-600 italic">{domain.name}</h5>
        );

        return (
            <div key={domain.id} className={wrapperClass}>
                <div className="break-inside-avoid">{headerEl}</div>

                {level === 0 && teacherConfig.showExpectations && domain.expectations.length > 0 && (
                    <p className="text-xs text-slate-400 mt-1 break-inside-avoid leading-relaxed">
                        <span className="font-medium text-slate-500 block">Attendus en fin de maternelle :</span>
                        <span className="whitespace-pre-line">{domain.expectations.join('\n')}</span>
                    </p>
                )}

                {layoutMode === 'compact' ? (
                    acquiredSkills.length > 0 && (
                        <div className="mt-1.5">
                            <p className="text-xs font-medium text-slate-500 mb-0.5">Compétences validées</p>
                            <ul className="space-y-0">
                                {acquiredSkills.map(skill => (
                                    <CompactAcquiredSkillItem key={skill.id} skill={skill} student={student} />
                                ))}
                            </ul>
                        </div>
                    )
                ) : (
                    acquiredSkills.length > 0 && (() => {
                        const cols = teacherConfig.livretSkillsPerColumn ?? 3;
                        const colWidth = `${(100 / cols).toFixed(4)}%`;
                        return (
                            <div className="mt-2 space-y-1">
                                {Array.from({ length: Math.ceil(acquiredSkills.length / cols) }, (_, i) => (
                                    <div key={i} className="flex flex-wrap -m-0.5 break-inside-avoid">
                                        {acquiredSkills.slice(i * cols, i * cols + cols).map(skill => (
                                            <div key={skill.id} className="p-0.5" style={{ width: colWidth }}>
                                                <SkillCard skill={skill} student={student} />
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        );
                    })()
                )}

                {notAcquiredSkills.length > 0 && (
                    <div className={`break-inside-avoid ${acquiredSkills.length > 0 ? 'mt-2' : 'mt-1.5'}`}>
                        <div className="border-l-4 border-slate-300 pl-3">
                            <p className="text-xs font-semibold text-slate-500 mb-1">Compétences non validées</p>
                            <div className="flex flex-wrap">
                                {notAcquiredSkills.map(skill => <NonAcquiredItem key={skill.id} skill={skill} />)}
                            </div>
                        </div>
                    </div>
                )}

                {(domain.subDomains || []).map(sub => renderDomain(sub, level + 1))}

                {level === 0 && teacherConfig.showDomainComments && (
                    <div className="mt-2 pl-1">
                        {(teacherConfig.domainCommentPeriods || []).map((period, idx) => {
                            // Période masquée : on n'affiche pas son bilan dans le livret.
                            // L'index reste positionnel (les bilans sont stockés par index de période).
                            if (period.active === false) return null;
                            return (
                                <DomainPeriodComment
                                    key={period.id}
                                    domainId={domain.id}
                                    periodIndex={idx}
                                    periodName={period.name || `Bilan de la Période ${idx + 1}`}
                                    student={student}
                                    onUpdate={c => onUpdateStudentDomainComment(student.id, domain.id, c, idx)}
                                />
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="p-4 sm:p-6 bg-slate-200/50 dark:bg-zinc-900 print-container min-h-full">
            <div
                className="zoom-container"
                style={{ transform: `scale(${zoomLevel})`, transformOrigin, transition: 'transform 150ms ease-in-out' }}
            >
                <div ref={contentRef} className="livret-page force-light relative">
                    {isPaginating && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-10 rounded">
                            <SpinnerIcon className="w-7 h-7 text-slate-400" />
                        </div>
                    )}
                    <PageHeader student={student} teacherConfig={teacherConfig} />
                    <div className="livret-page-content">
                        {teacherConfig.showIntroduction && (
                            <IntroductionContent config={teacherConfig} onConfigChange={onConfigChange} />
                        )}
                        {schoolPrograms.map(program =>
                            program.domains.map(domain => renderDomain(domain, 0))
                        )}
                        {teacherConfig.showTeacherComment && (
                            <TeacherCommentContent student={student} config={teacherConfig} onUpdate={onUpdateStudentComment} />
                        )}
                        {teacherConfig.showTeacher2Comment && (
                            <Teacher2CommentContent student={student} config={teacherConfig} onUpdate={onUpdateStudentTeacher2Comment} />
                        )}
                        {teacherConfig.showDirectorComment && (
                            <DirectorCommentContent student={student} config={teacherConfig} onUpdate={onUpdateStudentDirectorComment} />
                        )}
                        <Signatures teacherConfig={teacherConfig} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LivretPreview;
