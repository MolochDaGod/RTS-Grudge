import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback: ReactNode;
  resetKey?: string;
  label?: string;
}

interface State {
  hasError: boolean;
  failedKey: string | null;
}

export class SceneErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, failedKey: null };

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    const tag = this.props.label ?? "SceneErrorBoundary";
    console.error(`[${tag}] ${this.props.resetKey ?? ""}:`, error?.message || error);
    this.setState({ failedKey: this.props.resetKey ?? null });
  }

  componentDidUpdate(prev: Props) {
    if (
      this.state.hasError &&
      prev.resetKey !== this.props.resetKey &&
      this.state.failedKey !== this.props.resetKey
    ) {
      this.setState({ hasError: false, failedKey: null });
    }
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}
