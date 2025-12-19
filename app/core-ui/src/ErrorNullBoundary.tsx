import { Component } from 'react';

interface ErrorNullBoundaryProps {
  children: React.ReactNode;
}

interface ErrorNullBoundaryState {
  hasError: boolean;
}

const initialErrorBoundaryState: ErrorNullBoundaryState = {
  hasError: false,
};

class ErrorNullBoundary extends Component<
  ErrorNullBoundaryProps,
  ErrorNullBoundaryState
> {
  constructor(props: ErrorNullBoundaryProps) {
    super(props);
    this.state = initialErrorBoundaryState;
  }

  componentDidCatch(): void {
    this.setState({ hasError: true });
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return null;
    }

    return this.props.children;
  }
}

export default ErrorNullBoundary;
