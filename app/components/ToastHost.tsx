import React, { useState, useEffect, useCallback } from 'react';
import { ToastItem, ToastKind, registerToastListener } from '../utils/toast';

const ICONS: Record<ToastKind, React.ReactNode> = {
    success: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-emerald-500">
            <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
        </svg>
    ),
    error: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-red-500">
            <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
        </svg>
    ),
    info: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-blue-500">
            <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 0 1 .67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 1 1-.671-1.34l.041-.022ZM12 9a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
        </svg>
    ),
};

// Durée d'affichage : les erreurs restent plus longtemps.
const DURATION_MS: Record<ToastKind, number> = { success: 4000, info: 4000, error: 6000 };

const ToastHost: React.FC = () => {
    const [items, setItems] = useState<ToastItem[]>([]);

    const dismiss = useCallback((id: number) => {
        setItems(prev => prev.filter(t => t.id !== id));
    }, []);

    useEffect(() => {
        registerToastListener(item => {
            setItems(prev => [...prev, item]);
            window.setTimeout(() => dismiss(item.id), DURATION_MS[item.kind]);
        });
        return () => registerToastListener(null);
    }, [dismiss]);

    if (items.length === 0) return null;

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[400] flex flex-col items-center gap-2 pointer-events-none print-hidden" aria-live="polite">
            <style>{`
                @keyframes toast-in {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @media (prefers-reduced-motion: reduce) {
                    .toast-item { animation: none !important; }
                }
            `}</style>
            {items.map(item => (
                <div
                    key={item.id}
                    role={item.kind === 'error' ? 'alert' : 'status'}
                    className="toast-item pointer-events-auto flex items-center gap-3 max-w-md bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg shadow-lg px-4 py-3"
                    style={{ animation: 'toast-in 150ms ease-out' }}
                >
                    <span className="flex-shrink-0">{ICONS[item.kind]}</span>
                    <span className="text-sm text-slate-700 dark:text-zinc-200">{item.message}</span>
                    <button
                        type="button"
                        onClick={() => dismiss(item.id)}
                        aria-label="Fermer la notification"
                        className="flex-shrink-0 ml-1 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            ))}
        </div>
    );
};

export default ToastHost;
