import React from 'react';

// Erreur inattendue de l'interface : les modifications sont déjà enregistrées au fur et à mesure.
export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
    state = { error: null as Error | null };
    static getDerivedStateFromError(error: Error) { return { error }; }
    componentDidCatch(error: Error) { console.error(error); }
    render() {
        if (!this.state.error) return this.props.children;
        return (
            <div className="h-full flex items-center justify-center p-6">
                <div role="alert" className="max-w-md text-center space-y-4">
                    <h1 className="text-xl font-semibold">Envolées a rencontré une erreur</h1>
                    <p className="text-slate-600 dark:text-zinc-300">Vos modifications sont enregistrées au fur et à mesure sur cet appareil : rechargez pour reprendre.</p>
                    <p className="text-xs text-slate-400 break-words">{this.state.error.message}</p>
                    <button type="button" onClick={() => window.location.reload()} className="min-h-12 px-6 rounded-xl bg-indigo-600 text-white font-semibold">Recharger</button>
                </div>
            </div>
        );
    }
}
