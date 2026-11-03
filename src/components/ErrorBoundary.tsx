import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 text-center">
          <div className="max-w-md p-8 rounded-2xl bg-card border border-border/50 shadow-lg">
            <h2 className="text-2xl font-bold text-gradient-gold mb-3 font-heading">
              त्रुटि हुई / An unexpected error occurred
            </h2>
            <p className="text-muted-foreground mb-6 text-sm">
              पृष्ठ लोड करने में समस्या आई। कृपया पृष्ठ को पुनः लोड करें।
              <br />
              (There was a problem loading the page. Please reload.)
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-5 py-2.5 rounded-xl bg-gold text-primary-foreground font-medium hover:opacity-90 transition-opacity text-sm shadow-md"
              >
                पुनः लोड करें (Reload)
              </button>
              <button
                onClick={() => {
                  this.setState({ hasError: false });
                  window.location.href = '/tatvaarth/';
                }}
                className="px-5 py-2.5 rounded-xl bg-secondary text-secondary-foreground font-medium hover:bg-gold/20 transition-colors text-sm"
              >
                मुख्य पृष्ठ (Home)
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

