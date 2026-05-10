import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCcw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render shows the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // You can log this to an external service like Sentry here
    console.error("CRITICAL UI CRASH:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-950 p-6 z-9999">
          <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-2xl text-center shadow-2xl">
            <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center border border-red-500/20 mx-auto mb-6">
              <AlertTriangle className="text-red-500" size={32} />
            </div>

            <h1 className="text-xl font-black uppercase tracking-tighter text-white mb-2">
              System Failure
            </h1>
            <p className="text-xs text-gray-500 font-bold uppercase mb-8 leading-relaxed">
              The application encountered an unexpected error. Don't worry, your data is likely safe the UI just hit a snag.
            </p>

            <div className="space-y-3">
              <button
                onClick={this.handleReset}
                className="w-full bg-white text-black py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-correct transition-all flex items-center justify-center gap-2"
              >
                <RefreshCcw size={16} />
                Hard Reset
              </button>
              
              <button
                onClick={() => window.location.href = '/'}
                className="w-full bg-white/5 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest border border-white/10 hover:bg-white/10 transition-all flex items-center justify-center gap-2"
              >
                <Home size={16} />
                Return Home
              </button>
            </div>

          
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default GlobalErrorBoundary;