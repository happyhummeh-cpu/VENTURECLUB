import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || String(error),
    };
  }

  componentDidCatch(error: any, info: any) {
    console.error('RootErrorBoundary caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-6 text-zinc-950">
          <div className="max-w-md w-full bg-white border border-zinc-200 rounded-2xl p-6 space-y-4 shadow-sm text-center">
            <h1 className="text-2xl font-editorial">The Venture Club</h1>
            <p className="text-xs text-zinc-600">
              Refreshing application view... ({this.state.errorMessage})
            </p>
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem('tvc_session_token');
                localStorage.removeItem('tvc_session_user');
                window.location.reload();
              }}
              className="px-4 py-2 text-xs font-semibold bg-zinc-950 text-white rounded-lg hover:bg-zinc-800 cursor-pointer"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>
);
