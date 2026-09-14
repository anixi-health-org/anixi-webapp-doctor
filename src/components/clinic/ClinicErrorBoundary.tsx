import React from 'react';

type Props = {
  children: React.ReactNode;
};

type State = {
  error: Error | null;
};

export class ClinicErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <h1 className="font-heading text-xl font-semibold text-[#1a4d4d]">This page hit a problem</h1>
        <p className="mt-2 text-sm text-[#65758b]">
          {this.state.error.message || 'Something went wrong while loading this clinic page.'}
        </p>
        <button
          type="button"
          onClick={() => this.setState({ error: null })}
          className="mt-6 rounded-full bg-anixi-green px-5 py-2.5 text-sm font-semibold text-white"
        >
          Try again
        </button>
      </div>
    );
  }
}
