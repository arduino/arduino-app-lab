import { useEffect, useRef, useState } from 'react';

import { Button, ButtonType } from '../../../components-by-app/app-lab';
import { Checkbox } from '../../../essential/checkbox';
import { UseBoardUpdateLogic } from '../../settings.type';
import styles from './board-update.module.scss';

interface BoardUpdateProps {
  logic: ReturnType<UseBoardUpdateLogic>;
}

const BoardUpdate: React.FC<BoardUpdateProps> = ({
  logic,
}: BoardUpdateProps) => {
  const {
    checkBoardUpdate,
    updateCheckResult,
    isCheckingBoardUpdate,
    isStartingBoardUpdate,
    boardUpdateLogs,
    isGettingLogs,
    applyBoardUpdate,
    onlyArduino,
    setOnlyArduino,
    cleanup,
  } = logic;

  const [isAtBottom, setIsAtBottom] = useState(true);
  const logsRef = useRef<HTMLDivElement>(null);

  const packages = updateCheckResult?.updates;

  const handleScroll = (): void => {
    const el = logsRef.current;
    if (!el) return;
    const threshold = 50;
    const atBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    setIsAtBottom(atBottom);
  };

  useEffect(() => {
    // Clean up current data, logs and sse connection
    return () => {
      cleanup();
    };
  }, [cleanup]);

  useEffect(() => {
    if (isAtBottom && logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [boardUpdateLogs, isAtBottom]);

  return (
    <div className={styles['board-update']}>
      {!isGettingLogs && (
        <>
          <Button
            onClick={checkBoardUpdate}
            disabled={isCheckingBoardUpdate}
            loading={isCheckingBoardUpdate}
          >
            Check for updates
          </Button>
          <Checkbox
            isDisabled={isCheckingBoardUpdate}
            value={onlyArduino ? 'true' : 'false'}
            onChange={(value): void => setOnlyArduino(value)}
          >
            Only Arduino packages
          </Checkbox>

          {packages === null && 'No packages found'}
          {packages && packages.length > 0 && (
            <div className={styles['board-update-list-container']}>
              Packages found:
              <ul>
                {packages.map((pkg) => (
                  <li key={pkg.name}>
                    <span>{pkg.name}</span>: {pkg.from_version} →{' '}
                    {pkg.to_version}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      {packages && packages.length > 0 && (
        <Button
          onClick={applyBoardUpdate}
          disabled={isStartingBoardUpdate || isGettingLogs}
          loading={isStartingBoardUpdate}
          type={ButtonType.Primary}
        >
          Apply updates
        </Button>
      )}
      {boardUpdateLogs.length > 0 && (
        <div
          ref={logsRef}
          className={styles['board-update-logs']}
          onScroll={handleScroll}
        >
          {boardUpdateLogs.map((log, index) => (
            <div key={index}>{JSON.parse(log.data)}</div>
          ))}
        </div>
      )}
    </div>
  );
};
export default BoardUpdate;
