import React, { useState, useMemo, useEffect } from 'react';
import { WorkshopEvent, Student, Workshop, Proficiency } from '../types';
import ConfirmationModal from './ConfirmationModal';
import { CheckIcon, XIcon, ListFilterIcon, AlertCircleIcon, HistoryIcon, BookOpenIcon, UserIcon, CalendarIcon } from 'lucide-react';
import StoredImage from '../images/StoredImage';
import { localDayOf, todayLocalISO } from '../domain/dates';
import { getCurrentSchoolYear } from '../fileFormat/defaults';

interface ReportsViewProps {
  events: WorkshopEvent[];
  students: Student[];
  workshops: Workshop[];
  // Valide (true) ou refuse (false) des passages, en attente ou déjà au journal.
  // Un refus ne retire que les compétences que le passage avait lui-même validées.
  onSetOutcome: (eventIds: string[], success: boolean) => void;
  /** Supprime les passages traités antérieurs à ce jour (AAAA-MM-JJ) et les passages orphelins. */
  onPurgeJournal: (beforeDay: string) => void;
}

const JOURNAL_PAGE = 100;
/** Début de l'année scolaire en cours (15 août), proposé par défaut pour alléger le journal. */
const schoolYearStart = () => `${getCurrentSchoolYear().slice(0, 4)}-08-15`;

const ReportsView: React.FC<ReportsViewProps> = ({ events, students, workshops, onSetOutcome, onPurgeJournal }) => {
  const [activeSubTab, setActiveSubTab] = useState<'pending' | 'journal'>('pending');
  const [filterStudentId, setFilterStudentId] = useState<string>('all');
  const [filterWorkshopId, setFilterWorkshopId] = useState<string>('all');
  const [filterSection, setFilterSection] = useState<string>('all');
  const [filterDate, setFilterDate] = useState<string>('');
  const [batchRequest, setBatchRequest] = useState<{ ids: string[]; success: boolean } | null>(null);
  const [journalLimit, setJournalLimit] = useState(JOURNAL_PAGE);
  const [purgeDay, setPurgeDay] = useState<string | null>(null); // non null : fenêtre d'allègement ouverte

  // Index (une recherche par ligne coûtait cher avec un long journal)
  const studentById = useMemo(() => new Map(students.map(s => [s.id, s])), [students]);
  const workshopById = useMemo(() => new Map(workshops.map(w => [w.id, w])), [workshops]);
  const getStudent = (id: string) => studentById.get(id);
  const getWorkshop = (id: string) => workshopById.get(id);

  // Les passages orphelins (élève ou atelier supprimé) ne sont ni comptés ni affichés.
  const byDateDesc = (a: WorkshopEvent, b: WorkshopEvent) => b.timestamp.localeCompare(a.timestamp);
  const liveEvents = useMemo(() => events.filter(e => studentById.has(e.studentId) && workshopById.has(e.workshopId)), [events, studentById, workshopById]);
  const pendingEvents = useMemo(() => liveEvents.filter(e => e.status === 'pending').sort(byDateDesc), [liveEvents]);
  const journalEvents = useMemo(() => liveEvents.filter(e => e.status === 'processed').sort(byDateDesc), [liveEvents]);
  const orphanCount = events.length - liveEvents.length;

  useEffect(() => { setJournalLimit(JOURNAL_PAGE); }, [filterStudentId, filterWorkshopId, filterSection, filterDate, activeSubTab]);

  const applyFilters = (evs: WorkshopEvent[]) => {
      let result = evs;
      if (filterStudentId !== 'all') result = result.filter(e => e.studentId === filterStudentId);
      if (filterWorkshopId !== 'all') result = result.filter(e => e.workshopId === filterWorkshopId);
      if (filterSection !== 'all') {
          result = result.filter(e => {
              const student = getStudent(e.studentId);
              return student?.section === filterSection;
          });
      }
      if (filterDate) result = result.filter(e => localDayOf(e.timestamp) === filterDate);
      return result;
  };

  const filteredPending = applyFilters(pendingEvents);
  const filteredJournal = applyFilters(journalEvents);
  const visibleJournal = filteredJournal.slice(0, journalLimit);
  const purgeCount = purgeDay ? journalEvents.filter(e => localDayOf(e.timestamp) < purgeDay).length + orphanCount : 0;

  const handleRefuseEvent = (event: WorkshopEvent) => onSetOutcome([event.id], false);
  const requestBatch = (evs: WorkshopEvent[], success: boolean) => setBatchRequest({ ids: evs.map(e => e.id), success });

  const formatDateTime = (isoString: string) => {
      const d = new Date(isoString);
      return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="p-6 h-full flex flex-col overflow-hidden">
      {purgeDay !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="purge-title">
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 id="purge-title" className="text-lg font-bold text-slate-800 dark:text-zinc-100">Alléger le journal</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-zinc-300">
              Supprime du journal les passages <strong>déjà traités</strong> antérieurs à la date choisie
              (et les passages d'élèves ou d'ateliers supprimés). Les compétences acquises par les élèves
              <strong> ne sont pas modifiées</strong> ; ces passages ne pourront simplement plus être refusés.
            </p>
            <label className="block mt-4 text-sm font-medium text-slate-700 dark:text-zinc-300">
              Passages antérieurs au
              <input type="date" value={purgeDay} max={todayLocalISO()} onChange={e => setPurgeDay(e.target.value)}
                className="ml-2 rounded-md border border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 px-2 py-1 dark:[color-scheme:dark]" />
            </label>
            <p className="mt-3 text-sm text-slate-500 dark:text-zinc-400">
              {purgeCount === 0 ? 'Aucun passage concerné.' : `${purgeCount} passage${purgeCount > 1 ? 's' : ''} seront supprimés.`}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setPurgeDay(null)} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-700">Annuler</button>
              <button disabled={purgeCount === 0} onClick={() => { onPurgeJournal(purgeDay); setPurgeDay(null); }}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed">Supprimer</button>
            </div>
          </div>
        </div>
      )}
      {batchRequest && (
        <ConfirmationModal
          title={batchRequest.success ? 'Valider les passages affichés' : 'Refuser les passages affichés'}
          message={batchRequest.success
            ? `${batchRequest.ids.length} passage(s) seront validés. Les compétences déjà acquises sont conservées telles quelles.`
            : `${batchRequest.ids.length} passage(s) seront refusés. Les compétences que ces passages avaient validées seront retirées.`}
          confirmText={batchRequest.success ? 'Valider' : 'Refuser'}
          variant={batchRequest.success ? 'primary' : 'danger'}
          onConfirm={() => { onSetOutcome(batchRequest.ids, batchRequest.success); setBatchRequest(null); }}
          onCancel={() => setBatchRequest(null)}
        />
      )}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
           <h2 className="text-2xl font-bold text-slate-800 dark:text-zinc-100 mb-1">Rapports des Ateliers</h2>
           <p className="text-slate-500 dark:text-zinc-400 text-sm">Visualisez et validez les passages des élèves sur les ateliers autonomes.</p>
        </div>
        
        <div className="flex p-1 bg-slate-100 dark:bg-zinc-800 rounded-lg">
           <button 
              onClick={() => setActiveSubTab('pending')} 
              className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-colors ${activeSubTab === 'pending' ? 'bg-white dark:bg-zinc-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'}`}
           >
              <AlertCircleIcon className="w-4 h-4" /> À traiter ({pendingEvents.length})
           </button>
           <button 
              onClick={() => setActiveSubTab('journal')} 
              className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-colors ${activeSubTab === 'journal' ? 'bg-white dark:bg-zinc-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'}`}
           >
              <HistoryIcon className="w-4 h-4" /> Journal
           </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-slate-200 dark:border-zinc-700 p-4 mb-6 flex flex-wrap gap-4 items-center">
         <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400 mr-2 border-r border-slate-200 dark:border-zinc-700 pr-4">
             <ListFilterIcon className="w-5 h-5" />
             <span className="font-medium text-sm">Filtres</span>
         </div>
         
         <div className="flex items-center gap-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 focus-within:ring-2 focus-within:ring-blue-500">
             <UserIcon className="w-4 h-4 text-slate-400" />
             <select value={filterStudentId} onChange={e => setFilterStudentId(e.target.value)} className="bg-transparent border-none outline-none text-sm font-medium text-slate-700 dark:text-zinc-200">
                 <option value="all" className="dark:bg-zinc-800">Tous les élèves</option>
                 {students.map(s => <option key={s.id} value={s.id} className="dark:bg-zinc-800">{s.firstName} {s.lastName}</option>)}
             </select>
         </div>

         <div className="flex items-center gap-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 focus-within:ring-2 focus-within:ring-blue-500">
             <ListFilterIcon className="w-4 h-4 text-slate-400" />
             <select value={filterSection} onChange={e => setFilterSection(e.target.value)} className="bg-transparent border-none outline-none text-sm font-medium text-slate-700 dark:text-zinc-200">
                 <option value="all" className="dark:bg-zinc-800">Toutes sections</option>
                 <option value="TPS" className="dark:bg-zinc-800">TPS</option>
                 <option value="PS" className="dark:bg-zinc-800">PS</option>
                 <option value="MS" className="dark:bg-zinc-800">MS</option>
                 <option value="GS" className="dark:bg-zinc-800">GS</option>
             </select>
         </div>

         <div className="flex items-center gap-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 focus-within:ring-2 focus-within:ring-blue-500">
             <BookOpenIcon className="w-4 h-4 text-slate-400" />
             <select value={filterWorkshopId} onChange={e => setFilterWorkshopId(e.target.value)} className="bg-transparent border-none outline-none text-sm font-medium text-slate-700 dark:text-zinc-200">
                 <option value="all" className="dark:bg-zinc-800">Tous les ateliers</option>
                 {workshops.map(w => <option key={w.id} value={w.id} className="dark:bg-zinc-800">{w.name}</option>)}
             </select>
         </div>

         <div className="flex items-center gap-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 focus-within:ring-2 focus-within:ring-blue-500">
             <CalendarIcon className="w-4 h-4 text-slate-400" />
             <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="bg-transparent border-none outline-none text-sm font-medium text-slate-700 dark:text-zinc-200 uppercase dark:[color-scheme:dark]" />
         </div>

         {(filterStudentId !== 'all' || filterWorkshopId !== 'all' || filterSection !== 'all' || filterDate) && (
            <div className="flex flex-wrap items-center gap-2 ml-auto">
                {activeSubTab === 'pending' && filteredPending.length > 0 && (
                    <>
                        <button onClick={() => requestBatch(filteredPending, true)} className="text-sm px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors shadow-sm">Valider la sélection</button>
                        <button onClick={() => requestBatch(filteredPending, false)} className="text-sm px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md font-medium transition-colors shadow-sm">Refuser la sélection</button>
                    </>
                )}
                {activeSubTab === 'journal' && filteredJournal.length > 0 && (
                    <>
                        <button onClick={() => requestBatch(filteredJournal, true)} className="text-sm px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors shadow-sm">Valider la sélection</button>
                        <button onClick={() => requestBatch(filteredJournal, false)} className="text-sm px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md font-medium transition-colors shadow-sm">Refuser la sélection</button>
                    </>
                )}
                <button onClick={() => { setFilterStudentId('all'); setFilterWorkshopId('all'); setFilterSection('all'); setFilterDate(''); }} className="text-sm text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 font-medium ml-2">Réinitialiser</button>
            </div>
         )}
      </div>

      <div className="flex-grow overflow-y-auto bg-slate-50 dark:bg-zinc-900/50 rounded-xl border border-slate-200 dark:border-zinc-700 p-1">
          {activeSubTab === 'pending' && (
              <div className="flex flex-col gap-2">
                 {filteredPending.length === 0 ? (
                     <div className="py-20 text-center flex flex-col items-center">
                         <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-4"><CheckIcon className="w-8 h-8 text-emerald-600 dark:text-emerald-400"/></div>
                         <h3 className="text-xl font-bold text-slate-800 dark:text-zinc-100">Aucun événement en attente</h3>
                         <p className="text-slate-500 dark:text-zinc-400 mt-2">Tous les scans des élèves ont été traités.</p>
                     </div>
                 ) : (
                     filteredPending.map(event => {
                         const student = getStudent(event.studentId);
                         const workshop = getWorkshop(event.workshopId);
                         if (!student || !workshop) return null;
                         
                         return (
                             <div key={event.id} className="bg-white dark:bg-zinc-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-zinc-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                 <div className="flex items-center gap-4">
                                     <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-100 dark:bg-zinc-700 flex-shrink-0">
                                         {student.photo ? <StoredImage src={student.photo} className="w-full h-full object-cover"/> : <UserIcon className="w-full h-full p-2 text-slate-300"/>}
                                     </div>
                                     <div>
                                         <p className="font-bold text-slate-800 dark:text-zinc-100 text-lg">{student.firstName} <span className="text-base font-medium opacity-60 uppercase">{student.lastName}</span></p>
                                         <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-zinc-400">
                                            <span className="bg-slate-100 dark:bg-zinc-700 px-2 py-0.5 rounded text-xs font-semibold">{workshop.name}</span>
                                            <span>•</span>
                                            <span>{formatDateTime(event.timestamp)}</span>
                                         </div>
                                         {workshop.skillIds.length > 0 && (() => {
                                             const toGrant = workshop.skillIds.filter(id => student.skills[id]?.proficiency !== Proficiency.Acquired).length;
                                             return (
                                                 <div className="mt-2 text-xs text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded inline-block">
                                                     {toGrant === 0
                                                         ? 'Compétences déjà toutes acquises'
                                                         : `${toGrant} compétence${toGrant > 1 ? 's' : ''} à valider`}
                                                 </div>
                                             );
                                         })()}
                                     </div>
                                 </div>
                                 <div className="flex items-center gap-2">
                                     <button onClick={() => handleRefuseEvent(event)} className="px-4 py-2 flex items-center gap-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 font-medium rounded-lg transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-800">
                                         <XIcon className="w-5 h-5"/> Refuser
                                     </button>
                                     <button onClick={() => onSetOutcome([event.id], true)} className="px-5 py-2 flex items-center gap-2 text-white bg-blue-600 hover:bg-blue-700 font-medium rounded-lg shadow-sm transition-colors border border-transparent">
                                         <CheckIcon className="w-5 h-5"/> Valider
                                     </button>
                                 </div>
                             </div>
                         );
                     })
                 )}
              </div>
          )}

          {activeSubTab === 'journal' && (
              <div className="overflow-x-auto">
                 <div className="flex items-center justify-between px-2 py-2 text-sm text-slate-500 dark:text-zinc-400">
                     <span>{filteredJournal.length} passage{filteredJournal.length > 1 ? 's' : ''}</span>
                     <button onClick={() => setPurgeDay(schoolYearStart())} className="font-medium text-slate-600 dark:text-zinc-300 hover:text-red-600 dark:hover:text-red-400">
                         Alléger le journal…
                     </button>
                 </div>
                 <table className="w-full text-left border-collapse">
                     <thead>
                         <tr className="bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 text-sm border-b border-slate-200 dark:border-zinc-700 sticky top-0 z-10">
                             <th className="p-4 font-semibold rounded-tl-xl">Élève</th>
                             <th className="p-4 font-semibold">Section</th>
                             <th className="p-4 font-semibold">Atelier</th>
                             <th className="p-4 font-semibold">Date & Heure</th>
                             <th className="p-4 font-semibold">Résultat</th>
                             <th className="p-4 font-semibold rounded-tr-xl">Type</th>
                         </tr>
                     </thead>
                     <tbody>
                         {filteredJournal.length === 0 ? (
                             <tr><td colSpan={6} className="p-8 text-center text-slate-500 dark:text-zinc-400">Aucun historique disponible.</td></tr>
                         ) : (
                             visibleJournal.map(event => {
                                 const student = getStudent(event.studentId);
                                 const workshop = getWorkshop(event.workshopId);
                                 if (!student || !workshop) return null;

                                 const isSuccess = event.type === 'validation' || event.type === 'auto_validation';
                                 
                                 return (
                                     <tr key={event.id} className="border-b border-slate-100 dark:border-zinc-800/50 hover:bg-white dark:hover:bg-zinc-800 transition-colors">
                                         <td className="p-4">
                                            <div className="flex items-center gap-3">
                                               <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-100 dark:bg-zinc-700 flex-shrink-0">
                                                   {student.photo ? <StoredImage src={student.photo} className="w-full h-full object-cover"/> : <UserIcon className="w-full h-full p-1.5 text-slate-300"/>}
                                               </div>
                                               <span className="font-medium text-slate-800 dark:text-zinc-200">{student.firstName}</span>
                                            </div>
                                         </td>
                                         <td className="p-4 text-slate-500 dark:text-zinc-400 font-medium text-sm">
                                            {student.section}
                                         </td>
                                         <td className="p-4 font-medium text-slate-700 dark:text-zinc-300">
                                            {workshop.name}
                                         </td>
                                         <td className="p-4 text-slate-500 dark:text-zinc-400 text-sm">
                                            {formatDateTime(event.timestamp)}
                                         </td>
                                         <td className="p-4">
                                            {isSuccess ? (
                                                <button onClick={() => onSetOutcome([event.id], false)} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors cursor-pointer">
                                                    <CheckIcon className="w-3.5 h-3.5"/> Réussi
                                                </button>
                                            ) : (
                                                <button onClick={() => onSetOutcome([event.id], true)} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors cursor-pointer">
                                                    <XIcon className="w-3.5 h-3.5"/> Refusé
                                                </button>
                                            )}
                                         </td>
                                         <td className="p-4 text-sm text-slate-500 dark:text-zinc-400">
                                            {event.type === 'auto_validation' ? 'Automatique (2ᵉ scan)' : 'Manuel'}
                                         </td>
                                     </tr>
                                 );
                             })
                         )}
                     </tbody>
                 </table>
                 {filteredJournal.length > visibleJournal.length && (
                     <div className="py-4 text-center">
                         <button onClick={() => setJournalLimit(n => n + JOURNAL_PAGE)} className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-zinc-600 text-slate-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-800">
                             Afficher {Math.min(JOURNAL_PAGE, filteredJournal.length - visibleJournal.length)} passages de plus ({filteredJournal.length - visibleJournal.length} restants)
                         </button>
                     </div>
                 )}
              </div>
          )}
      </div>
    </div>
  );
};

export default ReportsView;
