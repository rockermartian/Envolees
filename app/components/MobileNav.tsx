import React, { useState } from 'react';
import { BookOpen, ClipboardCheck, HelpCircle, ListTree, Moon, MoreHorizontal, Puzzle, Redo2, ScanLine, Settings, Sun, Users } from 'lucide-react';
import BottomSheet, { SheetItem } from './BottomSheet';

// Navigation sur téléphone (écran de moins de 640 px) : barre d'onglets en bas de l'écran,
// à portée du pouce. Les onglets moins fréquents, le thème, l'aide et « Rétablir » sont dans « Plus ».
// Sur tablette et ordinateur, cette barre n'existe pas (sm:hidden) : les onglets restent dans l'en-tête.

export type MobileTab = 'class' | 'skills' | 'workshops' | 'reports' | 'livret' | 'settings' | 'student_mode';

interface MobileNavProps {
  activeTab: MobileTab;
  onSelectTab: (tab: MobileTab) => void;
  onStudentMode: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenGuide: () => void;
  canRedo: boolean;
  onRedo: () => void;
}

const MAIN_TABS: { id: MobileTab; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'class', label: 'Classe', icon: Users },
  { id: 'skills', label: 'Compétences', icon: ListTree },
  { id: 'workshops', label: 'Ateliers', icon: Puzzle },
  { id: 'reports', label: 'Rapports', icon: ClipboardCheck },
];

const MobileNav: React.FC<MobileNavProps> = ({ activeTab, onSelectTab, onStudentMode, theme, onToggleTheme, onOpenGuide, canRedo, onRedo }) => {
  const [moreOpen, setMoreOpen] = useState(false);
  const inMore = !MAIN_TABS.some(t => t.id === activeTab);
  const run = (action: () => void) => { setMoreOpen(false); action(); };
  const item = 'flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] tracking-tight font-medium transition-colors';

  return (
    <>
      <nav
        aria-label="Navigation principale"
        className="sm:hidden flex-shrink-0 flex bg-white dark:bg-zinc-800 border-t border-slate-200 dark:border-zinc-700 print:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {MAIN_TABS.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;
          return (
            <button key={id} onClick={() => onSelectTab(id)} aria-current={active ? 'page' : undefined}
              className={`${item} ${active ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-zinc-400'}`}>
              <Icon className="w-6 h-6" />
              <span className="truncate max-w-full">{label}</span>
            </button>
          );
        })}
        <button onClick={() => setMoreOpen(true)} aria-haspopup="dialog" aria-expanded={moreOpen}
          className={`${item} ${inMore ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-zinc-400'}`}>
          <MoreHorizontal className="w-6 h-6" />
          <span>Plus</span>
        </button>
      </nav>

      {moreOpen && (
        <BottomSheet title="Plus" onClose={() => setMoreOpen(false)}>
          <SheetItem icon={<BookOpen className="w-5 h-5" />} label="Livret" detail="Livrets de réussite, export PDF" active={activeTab === 'livret'} onClick={() => run(() => onSelectTab('livret'))} />
          <SheetItem icon={<ScanLine className="w-5 h-5" />} label="Mode Élève" detail="Les élèves scannent les QR codes des ateliers" onClick={() => run(onStudentMode)} />
          <SheetItem icon={<Settings className="w-5 h-5" />} label="Paramètres" active={activeTab === 'settings'} onClick={() => run(() => onSelectTab('settings'))} />
          <div className="my-1 border-t border-slate-200 dark:border-zinc-700" />
          <SheetItem icon={<Redo2 className="w-5 h-5" />} label="Rétablir" detail="Refaire ce qui vient d'être annulé" disabled={!canRedo} onClick={() => run(onRedo)} />
          <SheetItem
            icon={theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            label={theme === 'light' ? 'Thème sombre' : 'Thème clair'}
            onClick={() => run(onToggleTheme)}
          />
          <SheetItem icon={<HelpCircle className="w-5 h-5" />} label="Aide" detail="Guide d'utilisation" onClick={() => run(onOpenGuide)} />
        </BottomSheet>
      )}
    </>
  );
};

export default MobileNav;
