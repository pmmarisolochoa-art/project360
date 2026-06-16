import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Boundary global de la app. Si cualquier ruta o módulo lanza una excepción
 * durante render, evita la pantalla en blanco mostrando un fallback claro
 * en español con un botón para reintentar.
 *
 * IMPORTANTE: solo cubre errores de render. Promises rechazadas y errores
 * en event handlers se escapan — para eso, los try/catch de cada store
 * y servicio deben mantenerse.
 */

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-base p-6">
        <div className="max-w-md w-full surface p-8 text-center space-y-4">
          <div className="mx-auto h-14 w-14 rounded-full bg-status-danger/15 text-status-danger flex items-center justify-center">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <h1 className="heading text-xl font-semibold text-text-primary">
            Error al cargar
          </h1>
          <p className="text-sm text-text-secondary">
            Algo se rompió mientras cargábamos esta pantalla. Tu trabajo no se perdió — los datos están a salvo.
          </p>
          <div className="flex items-center gap-2 justify-center pt-2">
            <button
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 rounded-[10px] bg-accent-violet px-4 py-2 text-sm font-medium text-white hover:brightness-110 transition"
            >
              <RefreshCw className="h-4 w-4" />
              Recargar
            </button>
            <button
              onClick={this.handleReset}
              className="text-sm text-text-muted hover:text-text-secondary px-3 py-2 transition"
            >
              Intentar de nuevo
            </button>
          </div>
          {import.meta.env.DEV && (
            <details className="mt-4 text-left">
              <summary className="text-xs text-text-muted cursor-pointer">Detalle técnico (dev)</summary>
              <pre className="mt-2 text-[10px] text-text-muted bg-bg-elevated rounded p-2 overflow-auto max-h-32">
                {this.state.error.message}
                {'\n'}
                {this.state.error.stack}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}
