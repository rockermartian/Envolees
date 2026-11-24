import React from 'react';

interface ErrorBoundaryProps {
    children: React.ReactNode;
    /** Quand cette valeur change (ex. changement d'onglet), l'erreur est oubliée et le contenu ré-affiché. */
    resetKey?: unknown;
    /** Contenu affiché à la place des enfants en cas d'erreur. */
    fallback: (error: Error, reset: () => void) => React.ReactNode;
}

interface ErrorBoundaryState {
    error: Error | null;
}

/**
 * Intercepte les erreurs de rendu de ses enfants pour éviter l'écran blanc :
 * le reste de l'application (et les données en mémoire) reste utilisable.
 */
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    state: ErrorBoundaryState = { error: null };

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('Erreur d\'affichage interceptée :', error, info.componentStack);
    }

    componentDidUpdate(prevProps: ErrorBoundaryProps) {
        if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
            this.setState({ error: null });
        }
    }

    reset = () => this.setState({ error: null });

    render() {
        if (this.state.error) return this.props.fallback(this.state.error, this.reset);
        return this.props.children;
    }
}

export default ErrorBoundary;

/** Bloc d'erreur standard (texte + détail technique repliable + actions). */
export const ErrorPanel: React.FC<{ title: string; message: string; error: Error; actions: React.ReactNode }> = ({ title, message, error, actions }) => (
    <div className="flex-grow flex items-center justify-center p-8 bg-slate-100 dark:bg-zinc-900">
        <div role="alert" className="max-w-xl w-full bg-white dark:bg-zinc-800 border border-red-200 dark:border-red-900/50 rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-red-700 dark:text-red-400">{title}</h2>
            <p className="mt-2 text-slate-700 dark:text-zinc-300">{message}</p>
            <details className="mt-4 text-sm text-slate-500 dark:text-zinc-400">
                <summary className="cursor-pointer">Détail technique</summary>
                <pre className="mt-2 whitespace-pre-wrap break-words text-xs">{error.message}</pre>
            </details>
            <div className="mt-5 flex gap-2">{actions}</div>
        </div>
    </div>
);
