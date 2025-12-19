import { ErrorInfo, useCallback } from 'react';
import { useCopyToClipboard } from 'react-use';

import Error from '../cloud-editor/features/error/Error.feat';
import ErrorProvider from '../common/providers/ErrorProvider';
import { PageProps } from './page.type';

type ErrorPageProps = PageProps & {
  errorMsg: string;
  errorInfo: ErrorInfo;
};

const ErrorPage: React.FC<ErrorPageProps> = (props: ErrorPageProps) => {
  const { errorMsg, errorInfo, profile, profileIsLoading } = props;

  const [_, copyToClipboard] = useCopyToClipboard();

  const onClickCopyError = useCallback((): void => {
    const error = `Error message: ${errorMsg}\nStack: ${errorInfo.componentStack}`;

    copyToClipboard(error);
  }, [copyToClipboard, errorInfo.componentStack, errorMsg]);

  return (
    <ErrorProvider profile={profile} profileIsLoading={profileIsLoading}>
      <Error onClickCopyError={onClickCopyError} />
    </ErrorProvider>
  );
};

export default ErrorPage;
