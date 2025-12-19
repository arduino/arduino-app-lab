import { Component, ErrorInfo } from 'react';

import { ComponentContext } from './common/providers/component/componentContext';
import ErrorPage from './pages/ErrorPage';

interface ErrorPageBoundaryProps {
  children: React.ReactNode;
}

type ErrorPageBoundaryState =
  | {
      hasError: true;
      errorMsg: string;
      errorInfo: ErrorInfo;
    }
  | {
      hasError: false;
      errorMsg: undefined;
      errorInfo: undefined;
    };

const initialErrorBoundaryState: ErrorPageBoundaryState = {
  hasError: false,
  errorMsg: undefined,
  errorInfo: undefined,
};

class ErrorPageBoundary extends Component<
  ErrorPageBoundaryProps,
  ErrorPageBoundaryState
> {
  declare context: React.ContextType<typeof ComponentContext>;
  static contextType = ComponentContext;

  constructor(props: ErrorPageBoundaryProps) {
    super(props);
    this.state = initialErrorBoundaryState;
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ hasError: true, errorInfo, errorMsg: error.message });
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <ErrorPage
          errorInfo={this.state.errorInfo}
          errorMsg={this.state.errorMsg}
          profile={this.context.profile}
          profileIsLoading={this.context.profileIsLoading}
        />
      );
    }

    return this.props.children;
  }
}

export default ErrorPageBoundary;
