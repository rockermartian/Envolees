// Éléments d'interface : tactiles (cibles de 44 px au moins, aucune action réservée au survol),
// utilisables aussi à la souris et au clavier.
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ChevronLeft, X } from 'lucide-react';
import StoredImage from '../../core/images/StoredImage';
import { registerToastListener, type ToastKind } from '../../core/utils/toast';
import type { Student } from '../../core/types';
import { initials } from './model';

// ---------------------------------------------------------------------------------------------
// Barre de titre d'un écran
// ---------------------------------------------------------------------------------------------

export const TopBar: React.FC<{ title: React.ReactNode; subtitle?: React.ReactNode; onBack?: () => void; actions?: React.ReactNode }> = ({ title, subtitle, onBack, actions }) => (
    <header className="sticky top-0 z-20 bg-white/95 dark:bg-zinc-900/95 backdrop-blur border-b border-slate-200 dark:border-zinc-800" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="h-16 flex items-center gap-1 px-3">
            {onBack && <IconButton label="Retour" onClick={onBack}><ChevronLeft className="w-6 h-6" /></IconButton>}
            <div className="flex-1 min-w-0 px-1">
                <h1 className="text-lg font-semibold text-slate-900 dark:text-zinc-50 truncate leading-tight">{title}</h1>
                {subtitle && <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">{subtitle}</p>}
            </div>
            {actions}
        </div>
    </header>
);

export const IconButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }> = ({ label, className = '', children, ...rest }) => (
    <button type="button" aria-label={label} title={label} {...rest}
        className={`w-11 h-11 shrink-0 inline-flex items-center justify-center rounded-full text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 active:bg-slate-200 dark:active:bg-zinc-700 disabled:opacity-30 disabled:pointer-events-none ${className}`}>
        {children}
    </button>
);

// ---------------------------------------------------------------------------------------------
// Navigation principale : rail à gauche (tablette, ordinateur), barre en bas (écran très étroit)
// ---------------------------------------------------------------------------------------------

export interface NavItem<T extends string> { id: T; label: string; icon: React.ReactNode; badge?: number }

export function NavBar<T extends string>({ items, active, onChange, header }: { items: NavItem<T>[]; active: T; onChange: (id: T) => void; header?: React.ReactNode }) {
    return (
        <nav aria-label="Navigation principale"
            className="fixed z-30 bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 bottom-0 inset-x-0 border-t sm:inset-x-auto sm:left-0 sm:top-0 sm:w-24 sm:border-t-0 sm:border-r sm:flex sm:flex-col"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)', paddingLeft: 'env(safe-area-inset-left)' }}>
            {header && <div className="hidden sm:flex justify-center pt-4 pb-2" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}>{header}</div>}
            <ul className="flex sm:flex-col sm:gap-1 sm:px-2 sm:pt-2">
                {items.map(item => {
                    const current = item.id === active;
                    return (
                        <li key={item.id} className="flex-1 sm:flex-none">
                            <button type="button" onClick={() => onChange(item.id)} aria-current={current ? 'page' : undefined}
                                className={`w-full h-16 sm:h-[4.5rem] flex flex-col items-center justify-center gap-1 text-xs font-semibold sm:rounded-2xl ${current ? 'text-indigo-700 dark:text-indigo-300 sm:bg-indigo-50 sm:dark:bg-indigo-950/60' : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-100'}`}>
                                <span className="relative">
                                    {item.icon}
                                    {!!item.badge && <span className="absolute -top-1.5 -right-3 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[11px] leading-5 text-center">{item.badge > 99 ? '99+' : item.badge}</span>}
                                </span>
                                {item.label}
                            </button>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}

// ---------------------------------------------------------------------------------------------
// Panneau : monte du bas sur un écran étroit, fenêtre centrée sur tablette et ordinateur
// ---------------------------------------------------------------------------------------------

export const Sheet: React.FC<{ title: React.ReactNode; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; full?: boolean; wide?: boolean }> = ({ title, onClose, children, footer, full, wide }) => {
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;
    const panel = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
        window.addEventListener('keydown', onKey);
        panel.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
        return () => window.removeEventListener('keydown', onKey);
    }, []);
    return (
        <div className="fixed inset-0 z-40 bg-slate-900/50 flex items-end sm:items-center sm:justify-center sm:p-6" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div ref={panel} role="dialog" aria-modal="true"
                className={`w-full ${wide ? 'sm:max-w-3xl' : 'sm:max-w-xl'} bg-white dark:bg-zinc-900 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col ${full ? 'h-[94dvh] sm:h-[85dvh]' : 'max-h-[92dvh] sm:max-h-[85dvh]'}`}>
                <div className="flex items-center gap-2 pl-6 pr-3 pt-3 pb-1">
                    <h2 className="flex-1 font-semibold text-lg text-slate-900 dark:text-zinc-50 py-2">{title}</h2>
                    <IconButton label="Fermer" onClick={onClose}><X className="w-5 h-5" /></IconButton>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-5 overscroll-contain">{children}</div>
                {footer && <div className="px-6 pt-3 border-t border-slate-200 dark:border-zinc-800" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>{footer}</div>}
            </div>
        </div>
    );
};

// ---------------------------------------------------------------------------------------------
// Boutons, champs, listes
// ---------------------------------------------------------------------------------------------

type Tone = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
const TONES: Record<Tone, string> = {
    primary: 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white',
    secondary: 'bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-100',
    danger: 'bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
    success: 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white',
    ghost: 'text-indigo-700 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-zinc-800',
};

export const Btn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; block?: boolean }> = ({ tone = 'secondary', block, className = '', ...rest }) => (
    <button type="button" {...rest}
        className={`min-h-12 px-5 rounded-xl font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-40 disabled:pointer-events-none ${TONES[tone]} ${block ? 'w-full' : ''} ${className}`} />
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
                    className={`flex-1 min-h-11 px-2 rounded-lg text-sm font-semibold ${o.id === value ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-zinc-50 shadow-sm' : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'}`}>
                    {o.label}
                </button>
            ))}
        </div>
    );
}

export const Chip: React.FC<{ active?: boolean; onClick?: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
    <button type="button" onClick={onClick} aria-pressed={active}
        className={`shrink-0 min-h-11 px-4 rounded-full text-sm font-medium border ${active ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white dark:bg-zinc-900 border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:border-indigo-400'}`}>
        {children}
    </button>
);

export const Avatar: React.FC<{ student: Pick<Student, 'firstName' | 'lastName' | 'photo'>; size?: number }> = ({ student, size = 44 }) => (
    <span className="shrink-0 rounded-full overflow-hidden bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 inline-flex items-center justify-center font-semibold"
        style={{ width: size, height: size, fontSize: size * 0.38 }}>
        {student.photo ? <StoredImage src={student.photo} alt="" className="w-full h-full object-cover" draggable={false} /> : initials(student)}
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

export const SnackbarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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
                <div className="fixed z-50 flex justify-center pointer-events-none right-3"
                    style={{ left: 'calc(var(--rail-w) + 0.75rem)', bottom: 'calc(var(--nav-h) + 1rem + env(safe-area-inset-bottom))' }}>
                    <div role={item.kind === 'error' ? 'alert' : 'status'}
                        className={`pointer-events-auto max-w-lg w-full flex items-center gap-3 rounded-xl shadow-xl px-4 py-3 text-sm ${item.kind === 'error' ? 'bg-red-700 text-white' : 'bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900'}`}>
                        <span className="flex-1">{item.message}</span>
                        {item.action && (
                            <button type="button" className="font-bold uppercase tracking-wide text-indigo-300 dark:text-indigo-700 min-h-11 px-2"
                                onClick={() => { item.action!.run(); setItem(null); }}>{item.action.label}</button>
                        )}
                    </div>
                </div>
            )}
        </SnackContext.Provider>
    );
};
