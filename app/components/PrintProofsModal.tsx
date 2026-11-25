import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { PrinterIcon, XIcon } from 'lucide-react';
import { SchoolProgram, Section, Student } from '../types';
import { ProofPhoto, proofPhotosOf, skillIndex } from '../domain/proofPhotos';
import { formatDateFR } from '../domain/dates';
import StoredImage from '../images/StoredImage';
import useModalDismiss from '../hooks/useModalDismiss';

// Impression des photos de preuve, à découper et coller dans un cahier de suivi tenu à la main.
// Même principe que l'impression des QR codes (WorkshopsView) : aperçu A4 réduit, puis une zone
// d'impression ajoutée à <body>, seule visible à l'impression.

interface PrintProofsModalProps {
  students: Student[];
  schoolPrograms: SchoolProgram[];
  initialStudentIds: string[];
  onClose: () => void;
}

const PRINT_ID = 'proofs-print-area';
const A4_W_MM = 210;
const A4_H_MM = 297;
const MARGIN_MM = 10;
const GAP_MM = 3;
const MM_TO_PX = 96 / 25.4;
const PREVIEW_W = 520; // largeur de l'aperçu d'une page, en px
const SECTION_ORDER: Section[] = [Section.TPS, Section.PS, Section.MS, Section.GS];

const shortDate = (date?: string) => (date ? formatDateFR(date, { day: '2-digit', month: '2-digit', year: 'numeric' }) : '');
const longDate = (date: string) => formatDateFR(date, { day: 'numeric', month: 'long', year: 'numeric' });

interface Layout { size: number; showSkill: boolean; showDate: boolean; cutLines: boolean }

/** Taille du texte sous la photo (mm), proportionnelle à la photo, bornée. */
const captionMm = (size: number) => Math.min(3.2, Math.max(2.3, size * 0.055));

// ─── Une photo et sa légende (mêmes mesures en mm à l'écran et à l'impression) ──
const ProofCard: React.FC<{ p: ProofPhoto; layout: Layout }> = ({ p, layout }) => {
  const font = captionMm(layout.size);
  return (
    <div style={{
      width: `${layout.size}mm`,
      boxSizing: 'content-box',
      padding: layout.cutLines ? '1.5mm' : 0,
      border: layout.cutLines ? '0.25mm dashed #94a3b8' : 'none',
      breakInside: 'avoid',
      pageBreakInside: 'avoid',
      background: 'white',
    }}>
      <StoredImage src={p.photo} alt={p.skillName} style={{ width: '100%', height: 'auto', display: 'block' }} />
      {(layout.showSkill || layout.showDate) && (
        <div style={{ marginTop: '1mm', fontSize: `${font}mm`, lineHeight: 1.25, color: '#1e293b', fontFamily: 'Arial, Helvetica, sans-serif' }}>
          {layout.showSkill && <div style={{ fontWeight: 600, wordBreak: 'break-word' }}>{p.skillName}</div>}
          {layout.showDate && p.date && <div style={{ color: '#475569' }}>{shortDate(p.date)}</div>}
        </div>
      )}
    </div>
  );
};

interface Group { student: Student; photos: ProofPhoto[] }

/** Pages d'un élève : en-tête discret (hors des découpes), puis les photos (aperçu : les `limit` premières). */
const StudentPages: React.FC<{ group: Group; layout: Layout; period: string; limit?: number; first: boolean }> = ({ group, layout, period, limit, first }) => (
  <section style={{ breakBefore: first ? 'auto' : 'page', pageBreakBefore: first ? 'auto' : 'always', fontFamily: 'Arial, Helvetica, sans-serif' }}>
    <div style={{ fontSize: '3.2mm', color: '#475569', marginBottom: '3mm' }}>
      <strong style={{ color: '#0f172a' }}>{group.student.firstName} {group.student.lastName}</strong>
      {' · '}{group.student.section} · {group.photos.length} photo{group.photos.length > 1 ? 's' : ''}{period ? ` · ${period}` : ''}
    </div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: `${GAP_MM}mm`, alignItems: 'flex-start' }}>
      {group.photos.slice(0, limit).map(p => <ProofCard key={p.skillId} p={p} layout={layout} />)}
    </div>
    {limit !== undefined && group.photos.length > limit && (
      <div style={{ marginTop: '4mm', fontSize: '3.2mm', color: '#64748b', textAlign: 'center' }}>
        + {group.photos.length - limit} photo{group.photos.length - limit > 1 ? 's' : ''} sur les pages suivantes
      </div>
    )}
  </section>
);

const PrintProofsModal: React.FC<PrintProofsModalProps> = ({ students, schoolPrograms, initialStudentIds, onClose }) => {
  const handleBackdropClick = useModalDismiss(onClose);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialStudentIds));
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [size, setSize] = useState(55);
  const [showSkill, setShowSkill] = useState(true);
  const [showDate, setShowDate] = useState(true);
  const [cutLines, setCutLines] = useState(true);
  const [printing, setPrinting] = useState(false);
  const layout: Layout = { size, showSkill, showDate, cutLines };

  const index = useMemo(() => skillIndex(schoolPrograms), [schoolPrograms]);
  const all = useMemo<Group[]>(() =>
    [...students]
      .sort((a, b) => SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section)
        || a.lastName.localeCompare(b.lastName, 'fr') || a.firstName.localeCompare(b.firstName, 'fr'))
      .map(student => ({ student, photos: proofPhotosOf(student, index, { from: from || undefined, to: to || undefined }) })),
    [students, index, from, to]);
  const groups = all.filter(g => selected.has(g.student.id) && g.photos.length > 0);
  const total = groups.reduce((n, g) => n + g.photos.length, 0);
  const period = from && to ? `du ${longDate(from)} au ${longDate(to)}` : from ? `depuis le ${longDate(from)}` : to ? `jusqu'au ${longDate(to)}` : '';

  // Estimation de la mise en page (photos supposées 4:3 ; légende de deux lignes au plus).
  const { pages, perPage } = useMemo(() => {
    const cell = size + (cutLines ? 3.5 : 0);
    const perRow = Math.max(1, Math.floor((A4_W_MM - 2 * MARGIN_MM + GAP_MM) / (cell + GAP_MM)));
    const caption = (showSkill ? 2 : 0) + (showDate ? 1 : 0);
    const rowH = size * 0.75 + (caption ? 1 + caption * captionMm(size) * 1.25 : 0) + (cutLines ? 3.5 : 0) + GAP_MM;
    const usable = A4_H_MM - 2 * MARGIN_MM - 8;
    const rowsPerPage = Math.max(1, Math.floor(usable / rowH));
    return {
      pages: groups.reduce((n, g) => n + Math.max(1, Math.ceil(Math.ceil(g.photos.length / perRow) / rowsPerPage)), 0),
      perPage: perRow * rowsPerPage,
    };
  }, [groups, size, showSkill, showDate, cutLines]);

  const toggle = (id: string) => setSelected(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  // Impression : la zone d'impression n'est créée qu'au clic (aucune image chargée avant),
  // on attend que ses photos soient décodées, puis seule cette zone est imprimée.
  useEffect(() => {
    if (!printing) return;
    let done = false;
    const style = document.createElement('style');
    const cleanup = () => {
      if (done) return;
      done = true;
      style.remove();
      setPrinting(false);
    };
    (async () => {
      const area = document.getElementById(PRINT_ID);
      await Promise.all([...(area?.querySelectorAll('img') ?? [])].map(img => img.decode().catch(() => undefined)));
      style.textContent = `
        @media print {
          body > *:not(#${PRINT_ID}) { display: none !important; }
          body > #${PRINT_ID} { display: block !important; }
          @page { size: A4; margin: ${MARGIN_MM}mm; }
        }`;
      document.head.appendChild(style);
      window.addEventListener('afterprint', cleanup, { once: true });
      window.print();
      setTimeout(cleanup, 60_000); // si « afterprint » n'arrive pas
    })();
    return () => { window.removeEventListener('afterprint', cleanup); style.remove(); };
  }, [printing]);

  const scale = PREVIEW_W / (A4_W_MM * MM_TO_PX);
  const checkbox = 'w-4 h-4 accent-blue-600';

  return (
    <>
      {printing && createPortal(
        <div id={PRINT_ID} style={{ display: 'none' }}>
          {groups.map((g, i) => <StudentPages key={g.student.id} group={g} layout={layout} period={period} first={i === 0} />)}
        </div>,
        document.body,
      )}

      <div className="fixed inset-0 z-[300] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="print-proofs-title" onClick={handleBackdropClick}>
        <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[94vh] flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="px-6 py-4 border-b border-slate-200 dark:border-zinc-700 flex justify-between items-center flex-shrink-0">
            <div className="flex items-center gap-3">
              <PrinterIcon className="w-5 h-5 text-slate-500 dark:text-zinc-400" />
              <h2 id="print-proofs-title" className="text-xl font-bold text-slate-800 dark:text-zinc-100">Imprimer les photos de preuve</h2>
            </div>
            <button onClick={onClose} aria-label="Fermer" className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 rounded-full transition-colors">
              <XIcon className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-0">
            {/* Réglages */}
            <div className="md:w-80 flex-shrink-0 border-b md:border-b-0 md:border-r border-slate-200 dark:border-zinc-700 p-5 overflow-y-auto max-h-[45vh] md:max-h-none flex flex-col gap-5">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-semibold text-slate-700 dark:text-zinc-200">Élèves</span>
                  <div className="flex gap-2 text-xs font-medium">
                    <button onClick={() => setSelected(new Set(all.filter(g => g.photos.length > 0).map(g => g.student.id)))} className="px-2 py-1 rounded text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30">Tous</button>
                    <button onClick={() => setSelected(new Set())} className="px-2 py-1 rounded text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-700">Aucun</button>
                  </div>
                </div>
                <ul className="space-y-0.5 max-h-56 overflow-y-auto pr-1" aria-label="Élèves à imprimer">
                  {all.map(({ student, photos }) => (
                    <li key={student.id}>
                      <label className={`flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-700/50 ${photos.length === 0 ? 'opacity-50' : ''}`}>
                        <input type="checkbox" className={checkbox} checked={selected.has(student.id)} onChange={() => toggle(student.id)} />
                        <span className="flex-1 truncate text-sm text-slate-700 dark:text-zinc-200">{student.firstName} {student.lastName}</span>
                        <span className="text-xs text-slate-400 dark:text-zinc-500 flex-shrink-0">{student.section} · {photos.length}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <span className="block text-sm font-semibold text-slate-700 dark:text-zinc-200 mb-1">Validées entre</span>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mb-2">Facultatif : par exemple, seulement les photos depuis le dernier collage.</p>
                <div className="flex items-center gap-2">
                  <input type="date" aria-label="Date de début" value={from} onChange={e => setFrom(e.target.value)} className="min-w-0 flex-1 px-2 py-1 text-sm bg-white dark:bg-zinc-700 text-slate-900 dark:text-zinc-200 border border-slate-300 dark:border-zinc-600 rounded-md" />
                  <span className="text-xs text-slate-400">et</span>
                  <input type="date" aria-label="Date de fin" value={to} onChange={e => setTo(e.target.value)} className="min-w-0 flex-1 px-2 py-1 text-sm bg-white dark:bg-zinc-700 text-slate-900 dark:text-zinc-200 border border-slate-300 dark:border-zinc-600 rounded-md" />
                </div>
                {(from || to) && <button onClick={() => { setFrom(''); setTo(''); }} className="mt-1 text-xs text-blue-600 dark:text-blue-400 hover:underline">Toutes les dates</button>}
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label htmlFor="proof-size" className="text-sm font-semibold text-slate-700 dark:text-zinc-200">Largeur des photos</label>
                  <span className="text-sm font-mono font-bold text-blue-600 dark:text-blue-400">{size} mm</span>
                </div>
                <input id="proof-size" type="range" min={30} max={120} step={1} value={size} onChange={e => setSize(Number(e.target.value))} className="w-full accent-blue-600 cursor-pointer" />
                <div className="flex justify-between text-xs text-slate-400 dark:text-zinc-500 mt-0.5"><span>30 mm</span><span>120 mm</span></div>
              </div>

              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold text-slate-700 dark:text-zinc-200 mb-1">Sous chaque photo</legend>
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-zinc-200 cursor-pointer">
                  <input type="checkbox" className={checkbox} checked={showSkill} onChange={e => setShowSkill(e.target.checked)} /> Nom de la compétence
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-zinc-200 cursor-pointer">
                  <input type="checkbox" className={checkbox} checked={showDate} onChange={e => setShowDate(e.target.checked)} /> Date de validation
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-zinc-200 cursor-pointer">
                  <input type="checkbox" className={checkbox} checked={cutLines} onChange={e => setCutLines(e.target.checked)} /> Traits de découpe
                </label>
              </fieldset>

              <div className="bg-slate-50 dark:bg-zinc-700/50 rounded-xl p-3.5 text-sm text-slate-600 dark:text-zinc-300">
                <span className="font-bold text-slate-800 dark:text-zinc-100">{total}</span> photo{total > 1 ? 's' : ''} ·{' '}
                <span className="font-bold text-slate-800 dark:text-zinc-100">{groups.length}</span> élève{groups.length > 1 ? 's' : ''} ·{' '}
                ≈ <span className="font-bold text-slate-800 dark:text-zinc-100">{pages}</span> page{pages > 1 ? 's' : ''}
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">Chaque élève commence sur une nouvelle page.</p>
              </div>
            </div>

            {/* Aperçu */}
            <div className="flex-1 overflow-auto bg-slate-100 dark:bg-zinc-900/50 p-6 min-w-0" aria-label="Aperçu">
              {groups.length === 0 ? (
                <p className="text-center text-sm text-slate-500 dark:text-zinc-400 mt-10">
                  {selected.size === 0 ? 'Cochez un ou plusieurs élèves.' : 'Aucune photo de preuve pour ces élèves' + (period ? ' sur cette période' : '') + '.'}
                </p>
              ) : (
                <div className="flex flex-col items-center gap-6">
                  {groups.map((g, i) => (
                    <div key={g.student.id} style={{ width: PREVIEW_W, flexShrink: 0 }}>
                      <div style={{
                        width: `${A4_W_MM}mm`,
                        minHeight: `${A4_H_MM}mm`,
                        padding: `${MARGIN_MM}mm`,
                        boxSizing: 'border-box',
                        background: 'white',
                        boxShadow: '0 8px 40px rgba(0,0,0,0.22)',
                        zoom: scale,
                      } as React.CSSProperties}>
                        {/* Aperçu : la 1re page de chaque élève (images chargées sans délai, même pour toute la classe) */}
                        <StudentPages group={g} layout={layout} period={period} limit={perPage} first={i === 0} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="px-6 py-4 border-t border-slate-200 dark:border-zinc-700 flex justify-end gap-3 flex-shrink-0 bg-slate-50 dark:bg-zinc-800/50 rounded-b-2xl">
            <button onClick={onClose} className="px-4 py-2 font-medium text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-lg transition-colors">Annuler</button>
            <button onClick={() => setPrinting(true)} disabled={total === 0 || printing} className="px-5 py-2 flex items-center gap-2 font-medium text-white bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 dark:disabled:bg-zinc-600 disabled:cursor-not-allowed rounded-lg shadow-sm transition-colors">
              <PrinterIcon className="w-4 h-4" /> {printing ? 'Préparation…' : 'Imprimer'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default PrintProofsModal;
