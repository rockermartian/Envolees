import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye, Flag, Handshake, LifeBuoy, Pencil, Pin, PinOff, Plus, Printer, Stethoscope, Trash2, Users } from 'lucide-react';
import { Student, StudentNeed, StudentNote, StudentNoteKind } from '../types';
import { NEEDS, NOTE_KINDS, needLabel, noteKindLabel, sortNotes } from '../domain/notes';
import { formatDateFR, todayLocalISO } from '../domain/dates';
import ConfirmationModal from './ConfirmationModal';
import Tooltip from './Tooltip';

// Onglet « Suivi » de la fiche élève : besoins particuliers et notes datées (observations,
// rendez-vous, aides, à faire). Usage interne de l'enseignant : rien n'apparaît dans le livret.

interface StudentFollowUpProps {
  student: Student;
  schoolYear?: string;
  onAddNote: (note: StudentNote) => void;
  onUpdateNote: (noteId: string, changes: Partial<Omit<StudentNote, 'id'>>) => void;
  onDeleteNote: (noteId: string) => void;
  onToggleNeed: (need: StudentNeed) => void;
}

const KIND_ICONS: Record<StudentNoteKind, React.FC<{ className?: string }>> = {
  observation: Eye, parents: Users, equipe: Handshake, aide: LifeBuoy, exterieur: Stethoscope, todo: Flag,
};
const KIND_COLORS: Record<StudentNoteKind, string> = {
  observation: 'text-blue-600 bg-blue-50 dark:text-blue-300 dark:bg-blue-900/30',
  parents: 'text-violet-600 bg-violet-50 dark:text-violet-300 dark:bg-violet-900/30',
  equipe: 'text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-900/30',
  aide: 'text-teal-700 bg-teal-50 dark:text-teal-300 dark:bg-teal-900/30',
  exterieur: 'text-rose-600 bg-rose-50 dark:text-rose-300 dark:bg-rose-900/30',
  todo: 'text-red-600 bg-red-50 dark:text-red-300 dark:bg-red-900/30',
};

const longDate = (date: string) => formatDateFR(date, { day: 'numeric', month: 'long', year: 'numeric' });

// ─── Saisie d'une note (ajout ou modification) ───────────────────────────────
const NoteEditor: React.FC<{
  initial?: StudentNote;
  onSave: (values: { date: string; kind: StudentNoteKind; text: string }) => void;
  onCancel?: () => void;
}> = ({ initial, onSave, onCancel }) => {
  const [kind, setKind] = useState<StudentNoteKind>(initial?.kind ?? 'observation');
  const [date, setDate] = useState(initial?.date ?? todayLocalISO());
  const [text, setText] = useState(initial?.text ?? '');
  const canSave = text.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date);
  const save = () => {
    if (!canSave) return;
    onSave({ date, kind, text });
    if (!initial) setText('');
  };
  const idPrefix = initial ? `note-${initial.id}` : 'note-new';
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Type de note">
        {NOTE_KINDS.map(k => {
          const Icon = KIND_ICONS[k.id];
          const active = kind === k.id;
          return (
            <button
              key={k.id}
              type="button"
              aria-pressed={active}
              onClick={() => setKind(k.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${active ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-600 text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-700'}`}
            >
              <Icon className="w-3.5 h-3.5" />
              {k.short}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-slate-500 dark:text-zinc-400 -mt-1">{NOTE_KINDS.find(k => k.id === kind)?.label}</p>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-shrink-0">
          <label htmlFor={`${idPrefix}-date`} className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1">Date</label>
          <input
            id={`${idPrefix}-date`}
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="px-2 py-1.5 text-sm bg-white dark:bg-zinc-700 text-slate-900 dark:text-zinc-200 border border-slate-300 dark:border-zinc-600 rounded-md"
          />
        </div>
        <div className="flex-grow">
          <label htmlFor={`${idPrefix}-text`} className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1">Note</label>
          <textarea
            id={`${idPrefix}-text`}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); } }}
            rows={3}
            placeholder={kind === 'todo' ? 'Ex. : appeler la PMI pour le bilan de 4 ans' : 'Ce que vous avez observé, ce qui a été dit ou décidé…'}
            className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-700 text-slate-900 dark:text-zinc-200 border border-slate-300 dark:border-zinc-600 rounded-md dark:placeholder-zinc-400 resize-y"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-md">
            Annuler
          </button>
        )}
        <button
          type="button"
          onClick={save}
          disabled={!canSave}
          className="px-4 py-1.5 flex items-center gap-1.5 text-sm font-semibold text-white bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 dark:disabled:bg-zinc-600 disabled:cursor-not-allowed rounded-md"
        >
          {initial ? 'Enregistrer' : <><Plus className="w-4 h-4" /> Ajouter la note</>}
        </button>
      </div>
    </div>
  );
};

// ─── Zone d'impression (même principe que les QR codes des ateliers) ─────────
const PRINT_ID = 'followup-print-area';
const PrintArea: React.FC<{ student: Student; notes: StudentNote[]; schoolYear?: string; filterLabel: string }> = ({ student, notes, schoolYear, filterLabel }) => (
  <div id={PRINT_ID} style={{ display: 'none', fontFamily: 'Arial, Helvetica, sans-serif', color: '#0f172a', fontSize: '10.5pt' }}>
    <h1 style={{ fontSize: '16pt', margin: '0 0 2mm' }}>Suivi de {student.firstName} {student.lastName}</h1>
    <p style={{ margin: '0 0 1mm', color: '#334155' }}>
      {student.section}{student.dob ? ` · né(e) le ${longDate(student.dob)}` : ''}{schoolYear ? ` · année ${schoolYear}` : ''}
    </p>
    {(student.needs ?? []).length > 0 && (
      <p style={{ margin: '0 0 1mm' }}><strong>Besoins particuliers :</strong> {(student.needs ?? []).map(needLabel).join(', ')}</p>
    )}
    <p style={{ margin: '0 0 4mm', color: '#64748b', fontSize: '9pt' }}>
      {filterLabel} · {notes.length} note{notes.length > 1 ? 's' : ''} · imprimé le {longDate(todayLocalISO())} · document confidentiel, usage interne
    </p>
    {notes.map(n => (
      <div key={n.id} style={{ borderTop: '0.3mm solid #cbd5e1', padding: '2.5mm 0', breakInside: 'avoid', pageBreakInside: 'avoid' }}>
        <div style={{ fontWeight: 700, marginBottom: '1mm' }}>
          {longDate(n.date)} — {noteKindLabel(n.kind)}{n.kind === 'todo' ? (n.done ? ' (fait)' : ' (à faire)') : ''}{n.pinned ? ' — épinglée' : ''}
        </div>
        <div style={{ whiteSpace: 'pre-wrap' }}>{n.text}</div>
      </div>
    ))}
  </div>
);

const printFollowUp = () => {
  const style = document.createElement('style');
  style.id = 'followup-print-override';
  style.textContent = `
    @media print {
      body > *:not(#${PRINT_ID}) { display: none !important; }
      body > #${PRINT_ID} { display: block !important; }
      @page { size: A4; margin: 15mm; }
    }`;
  document.head.appendChild(style);
  window.print();
  const cleanup = () => document.getElementById('followup-print-override')?.remove();
  window.addEventListener('afterprint', cleanup, { once: true });
  setTimeout(cleanup, 5000); // si « afterprint » n'arrive pas
};

// ─── Onglet Suivi ────────────────────────────────────────────────────────────
const StudentFollowUp: React.FC<StudentFollowUpProps> = ({ student, schoolYear, onAddNote, onUpdateNote, onDeleteNote, onToggleNeed }) => {
  const [filter, setFilter] = useState<StudentNoteKind | 'all'>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<StudentNote | null>(null);

  const allNotes = student.notes ?? [];
  const notes = useMemo(() => sortNotes(filter === 'all' ? allNotes : allNotes.filter(n => n.kind === filter)), [allNotes, filter]);
  const counts = useMemo(() => {
    const c = {} as Record<StudentNoteKind, number>;
    allNotes.forEach(n => { c[n.kind] = (c[n.kind] ?? 0) + 1; });
    return c;
  }, [allNotes]);
  const needs = new Set(student.needs ?? []);
  const filterLabel = filter === 'all' ? 'Toutes les notes' : `Notes « ${noteKindLabel(filter)} »`;

  return (
    <div className="space-y-6">
      {/* Besoins particuliers */}
      <section className="p-4 bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-sm">
        <h2 className="font-bold text-slate-800 dark:text-zinc-200 mb-3">Besoins particuliers</h2>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Besoins particuliers">
          {NEEDS.map(n => {
            const active = needs.has(n.id);
            return (
              <Tooltip key={n.id} content={n.title} position="top-center">
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => onToggleNeed(n.id)}
                  className={`px-3 py-1 text-sm font-medium rounded-full border transition-colors ${active ? 'bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-900/40 dark:border-amber-700 dark:text-amber-200' : 'bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-600 text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-700'}`}
                >
                  {active ? '✓ ' : ''}{n.label}
                </button>
              </Tooltip>
            );
          })}
        </div>
      </section>

      {/* Nouvelle note */}
      <section className="p-4 bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-sm">
        <h2 className="font-bold text-slate-800 dark:text-zinc-200 mb-3">Nouvelle note</h2>
        <NoteEditor onSave={v => onAddNote({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...v })} />
      </section>

      {/* Journal */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="font-bold text-slate-800 dark:text-zinc-200">Journal de suivi</h2>
          <button
            type="button"
            onClick={printFollowUp}
            disabled={notes.length === 0 && needs.size === 0}
            className="px-3 py-1.5 flex items-center gap-1.5 text-sm font-medium bg-slate-100 hover:bg-slate-200 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-slate-700 dark:text-zinc-200 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer className="w-4 h-4" /> Imprimer
          </button>
        </div>
        {allNotes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3" role="group" aria-label="Filtrer les notes">
            {([{ id: 'all', short: 'Toutes' }, ...NOTE_KINDS] as { id: StudentNoteKind | 'all'; short: string }[]).map(k => {
              const count = k.id === 'all' ? allNotes.length : counts[k.id] ?? 0;
              if (k.id !== 'all' && count === 0) return null;
              return (
                <button
                  key={k.id}
                  type="button"
                  aria-pressed={filter === k.id}
                  onClick={() => setFilter(k.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${filter === k.id ? 'bg-slate-600 border-slate-600 text-white dark:bg-zinc-500 dark:border-zinc-500' : 'bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-600 text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-700'}`}
                >
                  {k.short} ({count})
                </button>
              );
            })}
          </div>
        )}

        {notes.length === 0 ? (
          <div className="text-center py-8 px-4 bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700">
            <p className="text-slate-500 dark:text-zinc-400 text-sm">
              {allNotes.length === 0 ? `Aucune note pour ${student.firstName}. Les notes restent internes : elles n'apparaissent pas dans le livret.` : 'Aucune note de ce type.'}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {notes.map(n => {
              const Icon = KIND_ICONS[n.kind];
              if (editingId === n.id) {
                return (
                  <li key={n.id} className="p-4 bg-white dark:bg-zinc-800 rounded-lg border-2 border-blue-300 dark:border-blue-700">
                    <NoteEditor
                      initial={n}
                      onCancel={() => setEditingId(null)}
                      onSave={v => { onUpdateNote(n.id, v); setEditingId(null); }}
                    />
                  </li>
                );
              }
              return (
                <li
                  key={n.id}
                  className={`group/note p-3 bg-white dark:bg-zinc-800 rounded-lg border ${n.pinned ? 'border-amber-300 dark:border-amber-700' : 'border-slate-200 dark:border-zinc-700'}`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`flex-shrink-0 mt-0.5 p-1.5 rounded-md ${KIND_COLORS[n.kind]}`}><Icon className="w-4 h-4" /></span>
                    <div className="flex-grow min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500 dark:text-zinc-400">
                        <span className="font-semibold text-slate-700 dark:text-zinc-200">{noteKindLabel(n.kind)}</span>
                        <span>{longDate(n.date)}</span>
                        {n.pinned && <span className="text-amber-600 dark:text-amber-400 font-medium">Épinglée</span>}
                      </div>
                      <p className={`mt-1 text-sm whitespace-pre-wrap break-words ${n.kind === 'todo' && n.done ? 'line-through text-slate-400 dark:text-zinc-500' : 'text-slate-700 dark:text-zinc-200'}`}>{n.text}</p>
                      {n.kind === 'todo' && (
                        <label className="mt-2 inline-flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-300 cursor-pointer">
                          <input type="checkbox" checked={!!n.done} onChange={() => onUpdateNote(n.id, { done: !n.done })} className="w-4 h-4 accent-green-600" />
                          Fait
                        </label>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover/note:opacity-100 group-focus-within/note:opacity-100 pointer-coarse:opacity-100 transition-opacity">
                      <Tooltip content={n.pinned ? 'Désépingler' : 'Épingler en haut'} position="top-center">
                        <button type="button" onClick={() => onUpdateNote(n.id, { pinned: !n.pinned })} className="p-1.5 rounded-md text-slate-400 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-zinc-700">
                          {n.pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                        </button>
                      </Tooltip>
                      <Tooltip content="Modifier la note" position="top-center">
                        <button type="button" onClick={() => setEditingId(n.id)} className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-zinc-700">
                          <Pencil className="w-4 h-4" />
                        </button>
                      </Tooltip>
                      <Tooltip content="Supprimer la note" position="top-center">
                        <button type="button" onClick={() => setToDelete(n)} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {createPortal(<PrintArea student={student} notes={notes} schoolYear={schoolYear} filterLabel={filterLabel} />, document.body)}
      {toDelete && (
        <ConfirmationModal
          title="Supprimer la note"
          message={`Supprimer la note « ${noteKindLabel(toDelete.kind)} » du ${longDate(toDelete.date)} ? (Annuler, Ctrl+Z, la rétablit.)`}
          confirmText="Supprimer"
          onConfirm={() => { onDeleteNote(toDelete.id); setToDelete(null); }}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
};

export default StudentFollowUp;
