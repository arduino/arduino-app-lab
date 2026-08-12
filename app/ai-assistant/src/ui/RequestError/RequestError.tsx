import { Text } from '../Text/Text';
import styles from './request-error.module.scss';

interface RequestErrorProps {
  message: string;
  kind?: string;
  onRetry?: () => void;
}

// Scaffold for the "request failed" callout (red background); `kind` is the ACP errorKind (e.g. rate_limit) for per-error copy later.
export const RequestError: React.FC<RequestErrorProps> = ({
  message,
  kind,
  onRetry,
}: RequestErrorProps) => {
  return (
    <div className={styles['request-error']} data-kind={kind}>
      <Text className={styles['request-error-title']}>Request failed</Text>
      <Text className={styles['request-error-message']}>{message}</Text>
      {onRetry && (
        <button
          type="button"
          className={styles['request-error-retry']}
          onClick={onRetry}
        >
          Retry
        </button>
      )}
    </div>
  );
};

export default RequestError;
