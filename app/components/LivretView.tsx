import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { Student, SchoolProgram, AppUISettings } from '../types';
import { TeacherConfig } from '../types';
import LivretConfig from './LivretConfig';
import LivretPreview from './LivretPreview';
import AnnexePreview from './AnnexePreview';
import StudentList from './StudentList';
import BatchExportModal from './BatchExportModal';
import InfoModal from './InfoModal';
import Tooltip from './Tooltip';
import { livretFileName, safeFileName } from '../domain/fileNames';

const ChevronLeftIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
);

const ChevronRightIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
);

const MagnifyingGlassPlusIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 7.5v6m3-3h-6" />
    </svg>
);
const MagnifyingGlassMinusIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5h-6" />
    </svg>
);


interface LivretViewProps {
  students: Student[];
  selectedStudentId: string | null;
  schoolPrograms: SchoolProgram[];
  onSelectStudent: (id: string) => void;
  onEditStudent: (id: string) => void;
  onDeleteStudent: (id: string) => void;
  teacherConfig: TeacherConfig;
  onConfigChange: (config: TeacherConfig) => void;
  onUpdateStudentComment: (studentId: string, comment: string) => void;
  onUpdateStudentTeacher2Comment: (studentId: string, comment: string) => void;
  onUpdateStudentDirectorComment: (studentId: string, comment: string) => void;
  onUpdateStudentDomainComment: (studentId: string, domainId: string, comment: string, periodIndex: number) => void;
  onDeleteDomainPeriod: (periodIndex: number) => void;
  uiSettings: AppUISettings;
  onUiSettingsChange: (settings: AppUISettings) => void;
  onToggleLivretProcessed: (studentId: string) => void;
  onToggleAllLivretProcessed: () => void;
}

const LivretView: React.FC<LivretViewProps> = ({
  students,
  selectedStudentId,
  schoolPrograms,
  onSelectStudent,
  onEditStudent,
  onDeleteStudent,
  teacherConfig,
  onConfigChange,
  onUpdateStudentComment,
  onUpdateStudentTeacher2Comment,
  onUpdateStudentDirectorComment,
  onUpdateStudentDomainComment,
  onDeleteDomainPeriod,
  uiSettings,
  onUiSettingsChange,
  onToggleLivretProcessed,
  onToggleAllLivretProcessed,
}) => {
  const selectedStudent = useMemo(() => students.find(s => s.id === selectedStudentId), [students, selectedStudentId]);
  
  const { livretIsStudentListCollapsed: isStudentListCollapsed, livretIsConfigCollapsed: isConfigCollapsed } = uiSettings;

  const [batchExportState, setBatchExportState] = useState({
    active: false,
    current: 0,
    total: 0,
    studentName: '',
    directory: '',
  });
  const [infoModalState, setInfoModalState] = useState<{ isOpen: boolean; title: string; message: string } | null>(null);
  const [isPaginating, setIsPaginating] = useState(true);
  const [isSingleExporting, setIsSingleExporting] = useState(false);
  const [isAnnexMode, setIsAnnexMode] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [transformOrigin, setTransformOrigin] = useState('top center');

  const previewContainerRef = useRef<HTMLDivElement>(null);
  const isBatchExporting = useRef(false);

  const handleZoomIn = () => {
    const container = previewContainerRef.current;
    if (container) {
        const x = container.clientWidth / 2 + container.scrollLeft;
        const y = container.clientHeight / 2 + container.scrollTop;
        setTransformOrigin(`${x}px ${y}px`);
    }
    setZoomLevel(prev => Math.min(prev + 0.1, 2));
  };
  const handleZoomOut = () => {
    const container = previewContainerRef.current;
    if (container) {
        const x = container.clientWidth / 2 + container.scrollLeft;
        const y = container.clientHeight / 2 + container.scrollTop;
        setTransformOrigin(`${x}px ${y}px`);
    }
    setZoomLevel(prev => Math.max(prev - 0.1, 0.5));
  };

  useEffect(() => {
    const container = previewContainerRef.current;
    if (!container) return;

    const handleWheel = (event: WheelEvent) => {
        if (event.ctrlKey) {
            event.preventDefault();

            const rect = container.getBoundingClientRect();
            const x = event.clientX - rect.left + container.scrollLeft;
            const y = event.clientY - rect.top + container.scrollTop;
            setTransformOrigin(`${x}px ${y}px`);
            
            const zoomStep = 0.05;
            if (event.deltaY < 0) {
                setZoomLevel(prev => Math.min(prev + zoomStep, 2));
            } else {
                setZoomLevel(prev => Math.max(prev - zoomStep, 0.5));
            }
        }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
        container.removeEventListener('wheel', handleWheel);
    };
}, []);

  const handleBatchExportStart = async () => {
    const validatedStudents = students.filter(s => s.livretProcessed);

    if (validatedStudents.length === 0) {
        setInfoModalState({
            isOpen: true,
            title: "Aucun livret à exporter",
            message: "Veuillez valider au moins un élève (coche verte) avant de lancer l'exportation."
        });
        return;
    }

    // Le processus principal mémorise le dossier choisi et renvoie un jeton :
    // l'interface ne fournit ensuite que des noms de fichiers, écrits dans ce dossier uniquement.
    const directory = await window.electronAPI.selectDirectory();
    if (directory) {
        isBatchExporting.current = true;
        const sortedStudents = [...validatedStudents].sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
        const firstStudent = sortedStudents[0];
        setBatchExportState({
            active: true,
            current: 1,
            total: sortedStudents.length,
            studentName: `${firstStudent.firstName} ${firstStudent.lastName}`,
            directory: directory.token,
        });
        // Select first student to start the process
        onSelectStudent(firstStudent.id);
    }
  };

  const handleStudentReadyForExport = useCallback(async (studentId: string) => {
    if (!isBatchExporting.current || !batchExportState.active) {
        return;
    }

    const validatedStudents = students.filter(s => s.livretProcessed);
    const sortedValidatedStudents = [...validatedStudents].sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));

    const expectedStudentIndex = batchExportState.current - 1;
    if (expectedStudentIndex < 0 || expectedStudentIndex >= sortedValidatedStudents.length) {
        isBatchExporting.current = false;
        setBatchExportState({ active: false, current: 0, total: 0, studentName: '', directory: '' });
        return;
    }
    const expectedStudentId = sortedValidatedStudents[expectedStudentIndex].id;
    if (studentId !== expectedStudentId) {
        return;
    }

    const currentStudent = sortedValidatedStudents[expectedStudentIndex];
      
    try {
        // Homonymes et fichiers déjà présents : le processus principal ajoute -2, -3… (jamais d'écrasement)
        const fileName = livretFileName(currentStudent);
        const result = await window.electronAPI.generateLivretPdf({ dirToken: batchExportState.directory, fileName });
        if (!result.success) throw new Error(result.error || "Erreur d'exportation inconnue");

        const nextIndex = expectedStudentIndex + 1;

        if (nextIndex < sortedValidatedStudents.length) {
            const nextStudent = sortedValidatedStudents[nextIndex];
            setBatchExportState(prev => ({ 
                ...prev, 
                current: nextIndex + 1, 
                studentName: `${nextStudent.firstName} ${nextStudent.lastName}` 
            }));
            onSelectStudent(nextStudent.id);
        } else {
            isBatchExporting.current = false;
            setBatchExportState({ active: false, current: 0, total: 0, studentName: '', directory: '' });
            
            const count = sortedValidatedStudents.length;
            setInfoModalState({
                isOpen: true,
                title: "Exportation terminée",
                message: count === 1 ? "1 livret a été exporté." : `${count} livrets ont été exportés.`
            });
        }
    } catch (error) {
        console.error('Error during batch export for student', studentId, error);
        isBatchExporting.current = false;
        setBatchExportState({ active: false, current: 0, total: 0, studentName: '', directory: '' });
        
        let errorMsg = `Une erreur est survenue pour ${currentStudent.firstName} ${currentStudent.lastName}. Opération annulée.`;
        if (error instanceof Error) {
            errorMsg += `\nDétail: ${error.message}`;
        }
        
        setInfoModalState({
            isOpen: true,
            title: "Erreur d'exportation",
            message: errorMsg
        });
    }
  }, [batchExportState, students, onSelectStudent]);

  const handleExportAnnex = () => {
    if (isSingleExporting) return;
    setIsAnnexMode(true);
  };

  const handleAnnexReady = useCallback(async () => {
    setIsSingleExporting(true);
    try {
      const result = await window.electronAPI.generateLivretPdf();
      if (result.success && result.data) {
        const byteCharacters = atob(result.data);
        const byteArray = new Uint8Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) byteArray[i] = byteCharacters.charCodeAt(i);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = safeFileName(`annexe-attendus${teacherConfig.schoolYear ? '-' + teacherConfig.schoolYear : ''}`, 'pdf');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setInfoModalState({ isOpen: true, title: "Exportation terminée", message: "L'annexe a été exportée avec succès." });
      } else {
        throw new Error(result.error || 'Erreur inconnue lors de la génération du PDF.');
      }
    } catch (error) {
      setInfoModalState({ isOpen: true, title: "Erreur d'exportation", message: "Une erreur est survenue lors de la génération de l'annexe." });
    } finally {
      setIsAnnexMode(false);
      setIsSingleExporting(false);
    }
  }, [teacherConfig.schoolYear]);

  const handleExportSinglePDF = async () => {
    if (isSingleExporting || isPaginating || !selectedStudent) return;
    setIsSingleExporting(true);
    try {
        const result = await window.electronAPI.generateLivretPdf();
        if (result.success && result.data) {
            const base64Data = result.data;
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) { byteNumbers[i] = byteCharacters.charCodeAt(i); }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = livretFileName(selectedStudent);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            setInfoModalState({
                isOpen: true,
                title: "Exportation terminée",
                message: "Le livret a été exporté avec succès."
            });
        } else {
            throw new Error(result.error || "Erreur inconnue lors de la génération du PDF.");
        }
    } catch (error) {
        console.error("Erreur lors de la génération du PDF:", error);
        setInfoModalState({
            isOpen: true,
            title: "Erreur d'exportation",
            message: "Une erreur est survenue lors de la génération du PDF."
        });
    } finally {
        setIsSingleExporting(false);
    }
  };


  const handleToggleStudentList = () => {
    const isOpening = isStudentListCollapsed;
    const newSettings = { ...uiSettings, livretIsStudentListCollapsed: !isStudentListCollapsed };
    if (isOpening) {
        newSettings.livretIsConfigCollapsed = true;
    }
    onUiSettingsChange(newSettings);
  };

  const handleToggleConfig = () => {
      const isOpening = isConfigCollapsed;
      const newSettings = { ...uiSettings, livretIsConfigCollapsed: !isConfigCollapsed };
      if (isOpening) {
          newSettings.livretIsStudentListCollapsed = true;
      }
      onUiSettingsChange(newSettings);
  };

  return (
    <>
      <BatchExportModal 
          isOpen={batchExportState.active}
          current={batchExportState.current}
          total={batchExportState.total}
          studentName={batchExportState.studentName}
      />
       {infoModalState?.isOpen && (
            <InfoModal 
                isOpen={infoModalState.isOpen}
                title={infoModalState.title}
                message={infoModalState.message}
                onClose={() => setInfoModalState(null)}
            />
        )}
      <div className="livret-view flex h-full w-full bg-slate-100 dark:bg-zinc-900">
          {/* Student List Panel */}
          <aside className={`transition-all duration-300 flex-shrink-0 h-full ${isStudentListCollapsed ? 'w-0' : 'w-64'}`}>
              <div className={`w-full h-full transition-opacity overflow-hidden ${isStudentListCollapsed ? 'opacity-0' : 'opacity-100'}`}>
                  <StudentList
                      students={students}
                      selectedStudentId={selectedStudentId}
                      schoolPrograms={schoolPrograms}
                      highlightedSkillId={null}
                      onSelectStudent={onSelectStudent}
                      onAddStudent={() => {}}
                      onEditStudent={onEditStudent}
                      onDeleteStudent={onDeleteStudent}
                      onImportStudents={() => {}}
                      onExportStudents={() => {}}
                      viewMode="livret"
                      onToggleLivretProcessed={onToggleLivretProcessed}
                      onToggleAllLivretProcessed={onToggleAllLivretProcessed}
                  />
              </div>
          </aside>

          {/* Student List Toggle Handle */}
          <Tooltip content={isStudentListCollapsed ? "Afficher les élèves" : "Masquer les élèves"} position="right" wrapperClassName="flex-shrink-0">
          <button
              onClick={handleToggleStudentList}
              className="w-6 pointer-coarse:w-10 bg-slate-200 dark:bg-zinc-800 flex flex-col items-center justify-between gap-4 py-4 cursor-pointer group print-hidden hover:bg-slate-300 dark:hover:bg-zinc-700 transition-colors"
          >
              <span className="[writing-mode:vertical-rl] rotate-180 text-xs font-semibold text-slate-500 dark:text-zinc-400 tracking-wider uppercase select-none">Élèves</span>
              <div className="text-slate-500 dark:text-zinc-400 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                  {isStudentListCollapsed ? <ChevronRightIcon className="w-5 h-5" /> : <ChevronLeftIcon className="w-5 h-5" />}
              </div>
          </button>
          </Tooltip>

          {/* Config Panel */}
          <aside className={`transition-all duration-300 flex-shrink-0 h-full print-hidden ${isConfigCollapsed ? 'w-0' : 'w-80 lg:w-96'}`}>
              <div className={`w-full h-full transition-opacity overflow-hidden ${isConfigCollapsed ? 'opacity-0' : 'opacity-100'}`}>
                  <LivretConfig
                    config={teacherConfig}
                    onConfigChange={onConfigChange}
                    uiSettings={uiSettings}
                    onUiSettingsChange={onUiSettingsChange}
                    onDeleteDomainPeriod={onDeleteDomainPeriod}
                    onBatchExport={handleBatchExportStart}
                    onExportSingle={handleExportSinglePDF}
                    onExportAnnex={handleExportAnnex}
                    isSingleExportDisabled={!selectedStudent || isPaginating || isSingleExporting}
                  />
              </div>
          </aside>

          {/* Config Toggle Handle */}
          <Tooltip content={isConfigCollapsed ? "Afficher la configuration" : "Masquer la configuration"} position="left" wrapperClassName="flex-shrink-0">
          <button
              onClick={handleToggleConfig}
              className="w-6 pointer-coarse:w-10 bg-slate-200 dark:bg-zinc-800 flex flex-col items-center justify-between gap-4 py-4 cursor-pointer group print-hidden hover:bg-slate-300 dark:hover:bg-zinc-700 transition-colors"
          >
              <span className="[writing-mode:vertical-rl] rotate-180 text-xs font-semibold text-slate-500 dark:text-zinc-400 tracking-wider uppercase select-none">Configuration</span>
              <div className="text-slate-500 dark:text-zinc-400 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                  {isConfigCollapsed ? <ChevronRightIcon className="w-5 h-5" /> : <ChevronLeftIcon className="w-5 h-5" />}
              </div>
          </button>
          </Tooltip>
              
          {/* Preview */}
          <main className="relative flex-grow min-w-0">
                <div ref={previewContainerRef} className="print-container h-full w-full overflow-auto">
                    {isAnnexMode ? (
                        <AnnexePreview
                            teacherConfig={teacherConfig}
                            schoolPrograms={schoolPrograms}
                            onReady={handleAnnexReady}
                        />
                    ) : selectedStudent ? (
                        <LivretPreview
                        student={selectedStudent}
                        schoolPrograms={schoolPrograms}
                        teacherConfig={teacherConfig}
                        onConfigChange={onConfigChange}
                        onUpdateStudentComment={onUpdateStudentComment}
                        onUpdateStudentTeacher2Comment={onUpdateStudentTeacher2Comment}
                        onUpdateStudentDirectorComment={onUpdateStudentDirectorComment}
                        onUpdateStudentDomainComment={onUpdateStudentDomainComment}
                        onPaginatedAndReadyForExport={handleStudentReadyForExport}
                        isPaginating={isPaginating}
                        setIsPaginating={setIsPaginating}
                        zoomLevel={zoomLevel}
                        transformOrigin={transformOrigin}
                        />
                    ) : (
                        <div className="flex h-full items-center justify-center text-center p-8">
                        <div className="text-slate-500 dark:text-zinc-400">
                            <h1 className="text-2xl font-bold mb-2 text-slate-700 dark:text-zinc-300">Aucun élève sélectionné</h1>
                            <p>Veuillez sélectionner un élève pour afficher son livret.</p>
                        </div>
                        </div>
                    )}
                </div>
               {(selectedStudent || isAnnexMode) && (
                    <div className="absolute bottom-4 right-4 z-10 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm rounded-full shadow-lg flex items-center p-1 print-hidden text-slate-600 dark:text-zinc-300">
                        <div className="relative group/tooltip inline-flex">
                            <button onClick={handleZoomOut} aria-label="Dézoomer" className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-zinc-700">
                                <MagnifyingGlassMinusIcon className="w-5 h-5" />
                            </button>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1.5 bg-white dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-600 text-xs rounded-md shadow-lg opacity-0 group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100 transition-opacity duration-200 invisible group-hover/tooltip:visible group-focus-within/tooltip:visible z-50 pointer-events-none font-normal whitespace-nowrap">
                                Dézoomer (Ctrl + Molette)
                            </div>
                        </div>
                        <div className="relative group/tooltip inline-flex">
                            <button onClick={handleZoomIn} aria-label="Zoomer" className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-zinc-700">
                                <MagnifyingGlassPlusIcon className="w-5 h-5" />
                            </button>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1.5 bg-white dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-600 text-xs rounded-md shadow-lg opacity-0 group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100 transition-opacity duration-200 invisible group-hover/tooltip:visible group-focus-within/tooltip:visible z-50 pointer-events-none font-normal whitespace-nowrap">
                                Zoomer (Ctrl + Molette)
                            </div>
                        </div>
                    </div>
                )}
          </main>
      </div>
    </>
  );
};

export default LivretView;