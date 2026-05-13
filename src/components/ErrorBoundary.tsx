import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  showStack: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, showStack: false };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary] Crash capturado:', error, info);
  }

  handleReload = () => {
    this.setState({ error: null });
    if (typeof window !== 'undefined') window.location.reload();
  };

  toggleStack = () => {
    this.setState(s => ({ showStack: !s.showStack }));
  };

  render() {
    if (this.state.error) {
      const { error, showStack } = this.state;
      return (
        <div
          role="alert"
          className="relative min-h-screen flex flex-col items-center justify-center p-6 bg-[var(--bg-base)]"
        >
          <div className="relative z-10 w-full max-w-xl text-center animate-fade-in-up">
            <div className="surface-elevated rounded-3xl p-10">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 mb-5">
                <AlertOctagon className="w-6 h-6" aria-hidden />
              </div>

              <h1 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--text-primary)] mb-2">
                Algo deu errado
              </h1>
              <p className="text-[var(--text-secondary)] text-sm leading-relaxed mb-6 max-w-md mx-auto">
                Tivemos um problema inesperado ao carregar o dashboard. A equipe técnica
                já foi notificada nos logs do navegador.
              </p>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center">
                <button
                  type="button"
                  onClick={this.handleReload}
                  className="primary-btn justify-center"
                >
                  <RefreshCw className="w-4 h-4" aria-hidden />
                  Recarregar
                </button>
                <button
                  type="button"
                  onClick={this.toggleStack}
                  aria-expanded={showStack}
                  className="ghost-btn justify-center"
                >
                  {showStack ? (
                    <>
                      <ChevronUp className="w-4 h-4" aria-hidden />
                      Ocultar detalhes
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4" aria-hidden />
                      Ver detalhes técnicos
                    </>
                  )}
                </button>
              </div>

              {showStack && (
                <div className="mt-6 text-left rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] overflow-hidden">
                  <div className="px-4 py-2 border-b border-[var(--border-subtle)] text-[10px] uppercase tracking-wider-2 text-[var(--text-tertiary)] font-semibold">
                    Mensagem de erro
                  </div>
                  <pre className="px-4 py-3 text-xs text-rose-600 dark:text-rose-400 whitespace-pre-wrap break-words max-h-48 overflow-auto leading-relaxed font-mono">
                    {error.message}
                    {error.stack && '\n\n' + error.stack}
                  </pre>
                </div>
              )}
            </div>

            <p className="mt-4 text-xs text-[var(--text-tertiary)]">
              Minerva Foods · Central de Monitoramento RPA
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
