import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary] Crash capturado:', error, info);
  }

  handleReload = () => {
    this.setState({ error: null });
    if (typeof window !== 'undefined') window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div
          role="alert"
          className="min-h-screen flex flex-col items-center justify-center p-6 bg-minerva-gradient text-white"
        >
          <div className="max-w-xl text-center bg-white/10 border border-white/20 rounded-2xl p-8 backdrop-blur-md">
            <AlertOctagon className="w-12 h-12 mx-auto text-minerva-red mb-4" aria-hidden />
            <h1 className="text-2xl font-bold mb-2">Algo deu errado</h1>
            <p className="text-white/70 mb-6">
              Tivemos um problema inesperado ao carregar o dashboard. A equipe técnica
              já foi notificada nos logs.
            </p>
            <pre className="text-left text-xs bg-black/30 p-4 rounded-xl overflow-auto max-h-40 mb-6">
              {this.state.error.message}
            </pre>
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-minerva-red hover:bg-minerva-red-dark rounded-xl font-medium transition-colors"
            >
              <RefreshCw className="w-4 h-4" aria-hidden />
              Recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
