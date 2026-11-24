import React, { useState, useEffect } from 'react';
import Tooltip from './Tooltip';

const MinimizeIcon: React.FC<{ className?: string }> = ({ className }) => (<svg aria-hidden="true" role="img" width="12" height="12" viewBox="0 0 12 12" className={className}><rect fill="currentColor" width="10" height="1" x="1" y="6"></rect></svg>);
const MaximizeIcon: React.FC<{ className?: string }> = ({ className }) => (<svg aria-hidden="true" role="img" width="12" height="12" viewBox="0 0 12 12" className={className}><rect width="9" height="9" x="1.5" y="1.5" fill="none" stroke="currentColor"></rect></svg>);
const RestoreIcon: React.FC<{ className?: string }> = ({ className }) => (<svg aria-hidden="true" role="img" width="12" height="12" viewBox="0 0 12 12" className={className}><path fill="currentColor" d="M3 9h6V3H3v6zM4 4h4v4H4V4z M2 7H1V1h6v1H2v5z"></path></svg>);
const CloseIcon: React.FC<{ className?: string }> = ({ className }) => (<svg aria-hidden="true" role="img" width="12" height="12" viewBox="0 0 12 12" className={className}><polygon fill="currentColor" fillRule="evenodd" points="11 1.576 6.583 6 11 10.424 10.424 11 6 6.583 1.576 11 1 10.424 5.417 6 1 1.576 1.576 1 6 5.417 10.424 1"></polygon></svg>);

const WindowControls: React.FC = () => {
    const [isMaximized, setIsMaximized] = useState(false);

    useEffect(() => {
        // The electronAPI is only available in the Electron context.
        // This check prevents errors when running in a standard web browser.
        if (window.electronAPI) {
            const handleMaximized = () => setIsMaximized(true);
            const handleUnmaximized = () => setIsMaximized(false);

            window.electronAPI.onWindowMaximized(handleMaximized);
            window.electronAPI.onWindowUnmaximized(handleUnmaximized);
            
            return () => {
                window.electronAPI.removeWindowMaximizeListeners();
            };
        }
    }, []);

    // If the app is not running in Electron, don't render the controls.
    if (!window.electronAPI) {
        return null;
    }

    return (
        <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties} className="flex">
            <Tooltip content="Minimiser" position="bottom-center">
                <button onClick={() => window.electronAPI.minimizeWindow()} className="px-3 py-2 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors">
                    <MinimizeIcon />
                </button>
            </Tooltip>
            <Tooltip content={isMaximized ? 'Restaurer' : 'Agrandir'} position="bottom-center">
                <button onClick={() => window.electronAPI.maximizeWindow()} className="px-3 py-2 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors">
                    {isMaximized ? <RestoreIcon /> : <MaximizeIcon />}
                </button>
            </Tooltip>
            <Tooltip content="Fermer" position="bottom-right">
                <button onClick={() => window.electronAPI.closeWindow()} className="px-3 py-2 hover:bg-red-500 hover:text-white dark:hover:bg-red-600 transition-colors">
                    <CloseIcon />
                </button>
            </Tooltip>
        </div>
    );
};

export default WindowControls;