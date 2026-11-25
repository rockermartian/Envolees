import React from 'react';
import { createPortal } from 'react-dom';
import useModalDismiss from '../hooks/useModalDismiss';

// Volet qui monte du bas de l'écran (téléphone) : menus, filtres, options d'affichage.
// Se ferme par Échap, un toucher sur le fond ou le bouton « Fermer ».

interface BottomSheetProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

const BottomSheet: React.FC<BottomSheetProps> = ({ title, onClose, children }) => {
  const handleBackdropClick = useModalDismiss(onClose);
  return createPortal(
    <div
      className="bottom-sheet fixed inset-0 z-[250] bg-black/50 flex flex-col justify-end print:hidden"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={handleBackdropClick}
    >
      <div
        className="bg-white dark:bg-zinc-800 rounded-t-2xl shadow-2xl max-h-[85dvh] flex flex-col"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex-shrink-0 pt-2 pb-1 flex justify-center" aria-hidden="true">
          <div className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-zinc-600" />
        </div>
        <div className="flex-shrink-0 flex items-center justify-between px-4 pb-2">
          <h2 className="text-base font-bold text-slate-800 dark:text-zinc-100">{title}</h2>
          <button onClick={onClose} className="px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-700">
            Fermer
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-2 pb-3">{children}</div>
      </div>
    </div>,
    document.body,
  );
};

/** Ligne de menu d'un volet : icône, libellé, détail facultatif. */
export const SheetItem: React.FC<{
  icon?: React.ReactNode;
  label: string;
  detail?: string;
  active?: boolean;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
}> = ({ icon, label, detail, active, disabled, danger, onClick }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    aria-current={active ? 'page' : undefined}
    className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-colors disabled:opacity-40 ${active ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : danger ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-700'}`}
  >
    {icon && <span className="w-6 h-6 flex items-center justify-center flex-shrink-0 text-slate-500 dark:text-zinc-400">{icon}</span>}
    <span className="flex-grow min-w-0">
      <span className="block font-medium">{label}</span>
      {detail && <span className="block text-xs text-slate-500 dark:text-zinc-400">{detail}</span>}
    </span>
  </button>
);

export interface PhoneAction {
  label: string;
  icon?: React.ReactNode;
  detail?: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

/**
 * Téléphone : un bouton « ⋯ » qui ouvre un volet avec les actions d'un élément (à la place de la
 * rangée d'icônes de l'ordinateur et de la tablette, qu'on masque alors avec max-sm:hidden).
 */
export const PhoneActions: React.FC<{ title: string; actions: PhoneAction[]; className?: string }> = ({ title, actions, className = '' }) => {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); setOpen(true); }}
        aria-label={`Actions : ${title}`}
        aria-haspopup="dialog"
        className={`sm:hidden p-2 rounded-md text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-700 flex-shrink-0 ${className}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" aria-hidden="true"><path d="M3 10a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM8.5 10a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM15.5 8.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" /></svg>
      </button>
      {open && (
        <BottomSheet title={title} onClose={() => setOpen(false)}>
          {actions.map(a => (
            <SheetItem
              key={a.label}
              icon={a.icon}
              label={a.label}
              detail={a.detail}
              disabled={a.disabled}
              danger={a.danger}
              onClick={() => { setOpen(false); a.onClick(); }}
            />
          ))}
        </BottomSheet>
      )}
    </>
  );
};

export default BottomSheet;
