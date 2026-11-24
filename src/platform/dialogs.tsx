// Boîtes de dialogue de la plateforme web : elles remplacent les fenêtres natives qu'ouvre le
// processus principal Electron (choix de fichier, « Enregistrer sous », modifications non enregistrées…).
// Montées hors de #root (élément #platform-root), elles ne touchent pas à l'interface de l'application.
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

type DialogEntry = { id: number; render: (close: (value: unknown) => void) => React.ReactNode; cancelValue: unknown; resolve: (value: unknown) => void };
type Banner = { id: string; content: React.ReactNode };

let dialogs: DialogEntry[] = [];
let banners: Banner[] = [];
let progress: string | null = null;
let notify: (() => void) | null = null;
let nextId = 1;
const changed = () => notify?.();

/** Ouvre une boîte de dialogue ; la promesse est résolue par `close(valeur)` (Échap : `cancelValue`). */
export function showDialog<T>(render: (close: (value: T) => void) => React.ReactNode, cancelValue: T): Promise<T> {
    return new Promise<T>(resolve => {
        const entry: DialogEntry = {
            id: nextId++,
            render: render as DialogEntry['render'],
            cancelValue,
            resolve: value => {
                dialogs = dialogs.filter(d => d !== entry);
                changed();
                resolve(value as T);
            },
        };
        dialogs = [...dialogs, entry];
        changed();
    });
}

/** Affiche un message d'attente pendant une opération longue (ouverture d'une grosse classe…). */
export async function withProgress<T>(message: string, work: () => Promise<T>): Promise<T> {
    const previous = progress;
    progress = message;
    changed();
    try {
        return await work();
    } finally {
        progress = previous;
        changed();
    }
}

export function showBanner(id: string, content: React.ReactNode) {
    banners = [...banners.filter(b => b.id !== id), { id, content }];
    changed();
}
export function hideBanner(id: string) {
    banners = banners.filter(b => b.id !== id);
    changed();
}

const PlatformHost: React.FC = () => {
    const [, setTick] = useState(0);
    useEffect(() => {
        notify = () => setTick(t => t + 1);
        return () => { notify = null; };
    }, []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const top = dialogs[dialogs.length - 1];
            if (e.key === 'Escape' && top) {
                e.stopPropagation();
                e.preventDefault();
                top.resolve(top.cancelValue);
            }
        };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    });

    return (
        <>
            {banners.length > 0 && (
                <div className="fixed z-[600] left-1/2 -translate-x-1/2 flex flex-col gap-2 w-[min(32rem,calc(100vw-1.5rem))]" style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
                    {banners.map(b => <div key={b.id}>{b.content}</div>)}
                </div>
            )}
            {dialogs.map(d => (
                <div key={d.id} className="fixed inset-0 z-[700] bg-slate-900/50 flex items-end sm:items-center justify-center sm:p-4" onMouseDown={e => { if (e.target === e.currentTarget) d.resolve(d.cancelValue); }}>
                    {d.render(d.resolve)}
                </div>
            ))}
            {progress && (
                <div className="fixed inset-0 z-[800] bg-slate-900/40 flex items-center justify-center p-6" role="alert" aria-busy="true">
                    <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl px-6 py-5 flex items-center gap-4 text-slate-700 dark:text-zinc-200">
                        <span className="w-6 h-6 rounded-full border-[3px] border-indigo-200 border-t-indigo-600 animate-spin" aria-hidden="true" />
                        <span className="font-medium">{progress}</span>
                    </div>
                </div>
            )}
        </>
    );
};

let mounted = false;
export function mountPlatformHost() {
    if (mounted) return;
    mounted = true;
    let element = document.getElementById('platform-root');
    if (!element) {
        element = document.createElement('div');
        element.id = 'platform-root';
        element.className = 'print-hidden';
        document.body.appendChild(element);
    }
    createRoot(element).render(<PlatformHost />);
}

// ---------------------------------------------------------------------------------------------
// Éléments communs
// ---------------------------------------------------------------------------------------------

export const Panel: React.FC<{ title: string; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean; labelledBy?: string }> = ({ title, children, footer, wide }) => {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const target = ref.current?.querySelector<HTMLElement>('[data-autofocus], input, button.primary');
        target?.focus();
    }, []);
    return (
        <div ref={ref} role="dialog" aria-modal="true" aria-label={title}
            className={`bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'} max-h-[92vh] flex flex-col rounded-t-2xl sm:rounded-xl shadow-2xl`}
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
            <h2 className="text-lg font-semibold px-5 pt-5 pb-3">{title}</h2>
            <div className="px-5 pb-4 overflow-y-auto min-h-0">{children}</div>
            {footer && <div className="px-5 py-4 border-t border-slate-200 dark:border-zinc-700 flex flex-wrap justify-end gap-2">{footer}</div>}
        </div>
    );
};

type ButtonKind = 'primary' | 'secondary' | 'danger' | 'ghost';
const BUTTON_CLASSES: Record<ButtonKind, string> = {
    primary: 'primary bg-indigo-600 hover:bg-indigo-700 text-white',
    secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:text-zinc-100',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    ghost: 'text-indigo-700 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-zinc-700',
};

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: ButtonKind }> = ({ kind = 'secondary', className = '', ...rest }) => (
    <button type="button" {...rest} className={`px-4 py-2.5 min-h-11 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${BUTTON_CLASSES[kind]} ${className}`} />
);

// ---------------------------------------------------------------------------------------------
// Boîtes de dialogue génériques
// ---------------------------------------------------------------------------------------------

export interface ChoiceButton<T> { label: string; value: T; kind?: ButtonKind }

export function askChoice<T>(title: string, message: React.ReactNode, buttons: ChoiceButton<T>[], cancelValue: T): Promise<T> {
    return showDialog<T>(close => (
        <Panel title={title} footer={buttons.map(b => <Button key={b.label} kind={b.kind} onClick={() => close(b.value)}>{b.label}</Button>)}>
            <div className="text-slate-600 dark:text-zinc-300 whitespace-pre-line">{message}</div>
        </Panel>
    ), cancelValue);
}

export const showMessage = (title: string, message: React.ReactNode) =>
    askChoice(title, message, [{ label: 'OK', value: true, kind: 'primary' }], true);

export const confirmAction = (title: string, message: React.ReactNode, confirmLabel: string, danger = false) =>
    askChoice(title, message, [{ label: 'Annuler', value: false }, { label: confirmLabel, value: true, kind: danger ? 'danger' : 'primary' }], false);

/** Saisie d'un nom (null si annulé). */
export function askName(title: string, label: string, initial: string, confirmLabel: string, extra?: (state: { link: boolean; setLink: (v: boolean) => void }) => React.ReactNode): Promise<{ name: string; link: boolean } | null> {
    return showDialog<{ name: string; link: boolean } | null>(close => <NameForm title={title} label={label} initial={initial} confirmLabel={confirmLabel} extra={extra} onDone={close} />, null);
}

const NameForm: React.FC<{ title: string; label: string; initial: string; confirmLabel: string; extra?: (state: { link: boolean; setLink: (v: boolean) => void }) => React.ReactNode; onDone: (v: { name: string; link: boolean } | null) => void }> = ({ title, label, initial, confirmLabel, extra, onDone }) => {
    const [name, setName] = useState(initial);
    const [link, setLink] = useState(true);
    const submit = (e?: React.FormEvent) => { e?.preventDefault(); if (name.trim()) onDone({ name: name.trim(), link }); };
    return (
        <Panel title={title} footer={<><Button onClick={() => onDone(null)}>Annuler</Button><Button kind="primary" disabled={!name.trim()} onClick={() => submit()}>{confirmLabel}</Button></>}>
            <form onSubmit={submit} className="space-y-4">
                <label className="block">
                    <span className="block text-sm font-medium mb-1">{label}</span>
                    <input value={name} onChange={e => setName(e.target.value)} maxLength={80} onFocus={e => e.target.select()}
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </label>
                {extra?.({ link, setLink })}
            </form>
        </Panel>
    );
};
