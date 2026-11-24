
import React, { useState, useEffect, useRef } from 'react';

interface FileMenuProps {
  onNewFile: () => void;
  onOpenFile: () => void;
  onSaveFileAs: () => void;
  onOpenSettings: () => void;
  isSaveDisabled: boolean;
  isLoading?: boolean;
}

const FileMenu: React.FC<FileMenuProps> = ({ onNewFile, onOpenFile, onSaveFileAs, onOpenSettings, isSaveDisabled, isLoading = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  const handleSelect = (action: () => void) => {
    if (isLoading) return;
    action();
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-1.5 text-sm font-semibold rounded-md transition-colors text-slate-700 dark:text-zinc-200 bg-slate-100 dark:bg-zinc-700 hover:bg-slate-200 dark:hover:bg-zinc-600"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        Menu
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-56 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-md shadow-lg z-50 py-1">
          <button
            onClick={() => handleSelect(onNewFile)}
            disabled={isLoading}
            className="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Nouvelle Classe
          </button>
          <button
            onClick={() => handleSelect(onOpenFile)}
            disabled={isLoading}
            className="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Ouvrir une Classe
          </button>
          <button
            onClick={() => handleSelect(onSaveFileAs)}
            disabled={isSaveDisabled || isLoading}
            className="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed border-b border-slate-100 dark:border-zinc-700"
          >
            Enregistrer sous...
          </button>
          <button
            onClick={() => handleSelect(onOpenSettings)}
            disabled={isLoading}
            className="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Paramètres
          </button>
        </div>
      )}
    </div>
  );
};

export default FileMenu;
