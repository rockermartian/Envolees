
import React from 'react';
import Tooltip from './Tooltip';

type SaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error';

interface SaveStatusIndicatorProps {
    status: SaveStatus;
    onClick?: () => void;
}

// Icons
const SaveIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" className={className}>
        <path d="M840-680v480q0 33-23.5 56.5T760-120H200q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h480l160 160Zm-80 34L646-760H200v560h560v-446ZM480-240q50 0 85-35t35-85q0-50-35-85t-85-35q-50 0-85 35t-35 85q0 50 35 85t85 35ZM240-560h360v-160H240v160Zm-40-86v446-560 114Z"/>
    </svg>
);
const XCircleIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" /></svg>);
const SpinnerIcon: React.FC<{ className?: string }> = ({ className }) => ( <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>);

const SaveStatusIndicator: React.FC<SaveStatusIndicatorProps> = ({ status, onClick }) => {
    let icon: React.ReactNode;
    let colorClass = 'text-slate-400 dark:text-zinc-500';
    let title = 'Prêt';
    let cursorClass = 'cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-700';

    switch (status) {
        case 'idle':
            icon = <SaveIcon className="w-5 h-5" />;
            break;
        case 'unsaved':
            icon = <SaveIcon className="w-5 h-5" />;
            title = 'Modifications non enregistrées - Cliquer pour sauvegarder';
            colorClass = 'text-red-500 dark:text-red-400';
            break;
        case 'saving':
            icon = <SpinnerIcon className="w-5 h-5" />;
            title = 'Enregistrement...';
            colorClass = 'text-slate-500 dark:text-zinc-400';
            cursorClass = 'cursor-wait';
            break;
        case 'saved':
            icon = <SaveIcon className="w-5 h-5" />;
            title = 'Tout est enregistré';
            colorClass = 'text-green-500 dark:text-green-400';
            break;
        case 'error':
            icon = <XCircleIcon className="w-5 h-5" />;
            title = 'Erreur lors de la sauvegarde';
            colorClass = 'text-red-500 dark:text-red-400';
            break;
        default:
            return <div className="w-8" />;
    }

    return (
        <Tooltip content={title} position="bottom-center">
            <button
                onClick={status !== 'saving' ? onClick : undefined}
                className={`w-8 h-8 pointer-coarse:w-10 pointer-coarse:h-10 rounded-full flex items-center justify-center transition-colors ${cursorClass}`}
                aria-label={title}
            >
                <div className={`${colorClass} transition-colors`}>
                     {icon}
                </div>
            </button>
        </Tooltip>
    );
};

export default SaveStatusIndicator;
