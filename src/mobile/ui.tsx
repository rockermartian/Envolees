// Éléments d'interface de la version mobile (grandes cibles tactiles, zones sûres des écrans à encoche).
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ChevronLeft, X } from 'lucide-react';
import StoredImage from '../../../images/StoredImage';
import { registerToastListener, type ToastKind } from '../../../utils/toast';
import type { Student } from '../../../types';
import { initials } from './model';

// ---------------------------------------------------------------------------------------------
// Barre du haut
// ---------------------------------------------------------------------------------------------

export const TopBar: React.FC<{ title: React.ReactNode; subtitle?: React.ReactNode; onBack?: () => void; actions?: React.ReactNode }> = ({ title, subtitle, onBack, actions }) => (
    <header className="sticky top-0 z-20 bg-white/95 dark:bg-zinc-900/95 backdrop-blur border-b border-slate-200 dark:border-zinc-800" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="h-14 flex items-center gap-1 px-2">
            {onBack ? (
                <IconButton label="Retour" onClick={onBack}><ChevronLeft className="w-6 h-6" /></IconButton>
            ) : <span className="w-2" />}
            <div className="flex-1 min-w-0">
                <h1 className="font-semibold text-slate-900 dark:text-zinc-50 truncate leading-tight">{title}</h1>
                {subtitle && <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">{subtitle}</p>}
            </div>
            {actions}
        </div>
    </header>
);

export const IconButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }> = ({ label, className = '', children, ...rest }) => (
    <button type="button" aria-label={label} title={label} {...rest}
        className={`w-11 h-11 shrink-0 inline-flex items-center justify-center rounded-full text-slate-600 dark:text-zinc-300 active:bg-slate-200 dark:active:bg-zinc-700 disabled:opacity-30 ${className}`}>
        {children}
    </button>
);

// ---------------------------------------------------------------------------------------------
// Barre de navigation du bas
// ---------------------------------------------------------------------------------------------

export interface NavItem<T extends string> { id: T; label: string; icon: React.ReactNode; badge?: number }

export function BottomNav<T extends string>({ items, active, onChange }: { items: NavItem<T>[]; active: T; onChange: (id: T) => void }) {
    return (
        <nav className="fixed bottom-0 inset-x-0 z-30 bg-white dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} aria-label="Navigation principale">
            <ul className="flex">
                {items.map(item => (
                    <li key={item.id} className="flex-1">
                        <button type="button" onClick={() => onChange(item.id)} aria-current={item.id === active ? 'page' : undefined}
                            className={`w-full h-16 flex flex-col items-center justify-center gap-0.5 text-xs font-medium ${item.id === active ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-zinc-400'}`}>
                            <span className="relative">
                                {item.icon}
                                {!!item.badge && <span className="absolute -top-1.5 -right-2.5 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[11px] leading-5 text-center">{item.badge > 99 ? '99+' : item.badge}</span>}
                            </span>
                            {item.label}
                        </button>
                    </li>
                ))}
            </ul>
        </nav>
    );
}

// ---------------------------------------------------------------------------------------------
// Feuille (panneau qui monte du bas)
// ---------------------------------------------------------------------------------------------

export const Sheet: React.FC<{ title: React.ReactNode; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; full?: boolean }> = ({ title, onClose, children, footer, full }) => {
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
        window.addEventListener('keydown', onKey);
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = previous; };
    }, []);
    return (
        <div className="fixed inset-0 z-40 bg-slate-900/50 flex items-end" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div role="dialog" aria-modal="true" className={`w-full bg-white dark:bg-zinc-900 rounded-t-2xl shadow-2xl flex flex-col ${full ? 'h-[94vh]' : 'max-h-[90vh]'}`}>
                <div className="flex items-center gap-2 pl-5 pr-2 pt-2 pb-1">
                    <h2 className="flex-1 font-semibold text-lg text-slate-900 dark:text-zinc-50 py-2">{title}</h2>
                    <IconButton label="Fermer" onClick={onClose}><X className="w-5 h-5" /></IconButton>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4 overscroll-contain">{children}</div>
                {footer && <div className="px-5 pt-3 border-t border-slate-200 dark:border-zinc-800" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>{footer}</div>}
            </div>
        </div>
    );
};

// ---------------------------------------------------------------------------------------------
// Boutons, champs, éléments de liste
// ---------------------------------------------------------------------------------------------

type Tone = 'primary' | 'secondary' | 'danger' | 'success';
const TONES: Record<Tone, string> = {
    primary: 'bg-indigo-600 active:bg-indigo-700 text-white',
    secondary: 'bg-slate-100 active:bg-slate-200 text-slate-800 dark:bg-zinc-800 dark:active:bg-zinc-700 dark:text-zinc-100',
    danger: 'bg-red-50 active:bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
    success: 'bg-emerald-600 active:bg-emerald-700 text-white',
};

export const Btn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; block?: boolean }> = ({ tone = 'secondary', block, className = '', ...rest }) => (
    <button type="button" {...rest}
        className={`min-h-12 px-4 rounded-xl font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-40 ${TONES[tone]} ${block ? 'w-full' : ''} ${className}`} />
);

export const Field: React.FC<{ label: string; children: React.ReactNode; hint?: string }> = ({ label, children, hint }) => (
    <label className="block">
        <span className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">{label}</span>
        {children}
        {hint && <span className="block text-xs text-slate-500 dark:text-zinc-400 mt-1">{hint}</span>}
    </label>
);

export const inputClass = 'w-full min-h-12 px-3 rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-base';

export const SearchInput: React.FC<{ value: string; onChange: (v: string) => void; placeholder: string }> = ({ value, onChange, placeholder }) => (
    <div className="relative">
        <input type="search" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder}
            className={`${inputClass} pl-10`} enterKeyHint="search" />
        <svg viewBox="0 0 24 24" className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
    </div>
);

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
    return (
        <div role="radiogroup" aria-label={label} className="flex p-1 rounded-xl bg-slate-200/70 dark:bg-zinc-800">
            {options.map(o => (
                <button key={o.id} type="button" role="radio" aria-checked={o.id === value} onClick={() => onChange(o.id)}
                    className={`flex-1 min-h-10 rounded-lg text-sm font-semibold ${o.id === value ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-zinc-50 shadow-sm' : 'text-slate-600 dark:text-zinc-400'}`}>
                    {o.label}
                </button>
            ))}
        </div>
    );
}

export const Chip: React.FC<{ active?: boolean; onClick?: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
    <button type="button" onClick={onClick} aria-pressed={active}
        className={`shrink-0 min-h-9 px-3.5 rounded-full text-sm font-medium border ${active ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white dark:bg-zinc-900 border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300'}`}>
        {children}
    </button>
);

export const Avatar: React.FC<{ student: Pick<Student, 'firstName' | 'lastName' | 'photo'>; size?: number }> = ({ student, size = 44 }) => (
    <span className="shrink-0 rounded-full overflow-hidden bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 inline-flex items-center justify-center font-semibold"
        style={{ width: size, height: size, fontSize: size * 0.38 }}>
        {student.photo ? <StoredImage src={student.photo} alt="" className="w-full h-full object-cover" /> : initials(student)}
    </span>
);

export const ProgressBar: React.FC<{ value: number; total: number; label?: string }> = ({ value, total, label }) => (
    <div className="h-2 rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={value}>
        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${total ? Math.round((value / total) * 100) : 0}%` }} />
    </div>
);

export const EmptyState: React.FC<{ title: string; children?: React.ReactNode; icon?: React.ReactNode }> = ({ title, children, icon }) => (
    <div className="text-center px-6 py-12 text-slate-500 dark:text-zinc-400">
        {icon && <div className="mx-auto mb-3 w-12 h-12 text-slate-300 dark:text-zinc-600">{icon}</div>}
        <p className="font-semibold text-slate-700 dark:text-zinc-200">{title}</p>
        {children && <div className="mt-2 text-sm">{children}</div>}
    </div>
);

// ---------------------------------------------------------------------------------------------
// Messages éphémères (avec « Annuler »)
// ---------------------------------------------------------------------------------------------

interface SnackItem { id: number; message: string; kind: ToastKind; action?: { label: string; run: () => void } }
type ShowSnack = (message: string, options?: { kind?: ToastKind; action?: { label: string; run: () => void } }) => void;

const SnackContext = createContext<ShowSnack>(() => undefined);
export const useSnack = () => useContext(SnackContext);

export const SnackbarProvider: React.FC<{ children: React.ReactNode; bottomOffset: number }> = ({ children, bottomOffset }) => {
    const [item, setItem] = useState<SnackItem | null>(null);
    const timer = useRef<number | undefined>(undefined);
    const show = useCallback<ShowSnack>((message, options = {}) => {
        window.clearTimeout(timer.current);
        const next = { id: Date.now(), message, kind: options.kind ?? 'info', action: options.action };
        setItem(next);
        timer.current = window.setTimeout(() => setItem(cur => (cur?.id === next.id ? null : cur)), options.action ? 6000 : options.kind === 'error' ? 8000 : 3500);
    }, []);
    // Messages des modules partagés (compression d'image, enregistrement…) : même affichage.
    useEffect(() => {
        registerToastListener(t => show(t.message, { kind: t.kind }));
        return () => registerToastListener(null);
    }, [show]);
    return (
        <SnackContext.Provider value={show}>
            {children}
            {item && (
                <div className="fixed inset-x-3 z-50 flex justify-center pointer-events-none" style={{ bottom: `calc(${bottomOffset}px + env(safe-area-inset-bottom))` }}>
                    <div role={item.kind === 'error' ? 'alert' : 'status'}
                        className={`pointer-events-auto max-w-md w-full flex items-center gap-3 rounded-xl shadow-xl px-4 py-3 text-sm ${item.kind === 'error' ? 'bg-red-700 text-white' : 'bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900'}`}>
                        <span className="flex-1">{item.message}</span>
                        {item.action && (
                            <button type="button" className="font-bold uppercase tracking-wide text-indigo-300 dark:text-indigo-700 min-h-10 px-2"
                                onClick={() => { item.action!.run(); setItem(null); }}>{item.action.label}</button>
                        )}
                    </div>
                </div>
            )}
        </SnackContext.Provider>
    );
};
