// src/features/conversation/components/MessageErrorBoundary.tsx
// Keeps a single crashing message (e.g. the film player) from white-screening
// the entire app — the failure is contained and shown inline instead.
import React from "react";

type Props = {
  children: React.ReactNode;
};

type State = {
  error: Error | null;
};

export default class MessageErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("Message render crashed:", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3">
          <p className="font-medium text-red-300">Display error</p>
          <p className="mt-1 text-sm text-red-200/80">
            This message hit a rendering error and was skipped:{" "}
            {this.state.error.message}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}