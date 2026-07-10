import { Arduino, Usb, Wifi } from '@cloud-editor-mono/images/assets/icons';
import { noBoard } from '@cloud-editor-mono/images/assets/lotties';
import { DotLottiePlayer } from '@dotlottie/react-player';
import clsx from 'clsx';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useBoardSerialTracker } from '../../../../common/utils';
import { LinuxCredentialsDialog } from '../../../../dialogs';
import { useI18n } from '../../../../i18n/useI18n';
import { Large, Small, XSmall } from '../../../../typography';
import { welcomeMessages } from '../messages';
import { Board } from '../setup.type';
import BoardCard from './BoardCard';
import BoardIcon from './BoardIcon';
import styles from './welcome.module.scss';

interface WelcomeProps {
  isLoading: boolean;
  boards: Board[];
  onSelectBoard: (board: Board) => void;
  isSelectingBoard?: boolean;
  isAutoSelectingBoard?: boolean;
  showBoardConnPswPrompt: boolean;
  onConnPswCancel: () => void;
  onConnPswSubmit: (password: string) => Promise<void>;
  isBoardConnectingOrChecking: boolean;
  connToBoardError?: string;
  selectedBoard?: Board;
  selectingBoard?: Board;
  boardSelectionStatus?:
    | 'selection-started'
    | 'conn-started'
    | 'conn-error'
    | 'conn-and-selection-done';
  setupCompleted?: boolean;
}

type GroupedBoards = {
  newBoards: Board[];
  usbBoards: Board[];
  networkBoards: Board[];
};

const Welcome: React.FC<WelcomeProps> = (props: WelcomeProps) => {
  const {
    boards,
    onSelectBoard,
    isLoading,
    showBoardConnPswPrompt,
    onConnPswCancel,
    onConnPswSubmit,
    isBoardConnectingOrChecking,
    connToBoardError,
    selectedBoard,
    selectingBoard,
    setupCompleted,
    isAutoSelectingBoard,
    boardSelectionStatus,
  } = props;

  const { formatMessage } = useI18n();
  const [newBoardSerials, setNewBoardSerials] = useState<Set<string>>(
    new Set(),
  );
  const [lastConnections, setLastConnections] = useState<Map<string, string>>(
    new Map(),
  );
  const {
    isBoardNew,
    markBoardAsUsed,
    getLastConnection,
    updateLastConnection,
  } = useBoardSerialTracker();

  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showBoardConnPswPrompt) {
      setTimeout(() => passwordRef?.current?.focus(), 10);
    }
  }, [showBoardConnPswPrompt]);

  // Check which boards are new
  useEffect(() => {
    const checkNewBoards = async (): Promise<void> => {
      if (!boards.length) return;

      const newBoardsSet = new Set<string>();

      for (const board of boards) {
        if (board.serial && (await isBoardNew(board.serial))) {
          const lastConn = await getLastConnection(board.serial);
          if (!lastConn) {
            newBoardsSet.add(board.serial);
          }
        }
      }

      setNewBoardSerials(newBoardsSet);
    };

    checkNewBoards().catch(console.error);
  }, [boards, isBoardNew, getLastConnection]);

  // Mark board as used when setup is completed
  useEffect(() => {
    const markBoardAsUsedOnSetupComplete = async (): Promise<void> => {
      if (setupCompleted && selectedBoard?.serial) {
        // Don't update if board is still loading
        const isBoardLoading =
          selectingBoard?.serial === selectedBoard.serial &&
          (boardSelectionStatus === 'selection-started' ||
            boardSelectionStatus === 'conn-started' ||
            boardSelectionStatus === 'conn-and-selection-done' ||
            selectedBoard.checkingStatus);

        if (!isBoardLoading) {
          await markBoardAsUsed(selectedBoard.serial);
          await updateLastConnection(selectedBoard.serial);
          setNewBoardSerials((prev) => {
            const newSet = new Set(prev);
            newSet.delete(selectedBoard.serial);
            return newSet;
          });
        }
      }
    };

    markBoardAsUsedOnSetupComplete().catch(console.error);
  }, [
    setupCompleted,
    selectedBoard,
    markBoardAsUsed,
    updateLastConnection,
    selectingBoard,
    boardSelectionStatus,
  ]);

  // Load last connections when boards change
  useEffect(() => {
    const loadLastConnections = async (): Promise<void> => {
      if (!boards.length) return;

      const connectionsMap = new Map<string, string>();

      for (const board of boards) {
        if (board.serial) {
          const lastConnection = await getLastConnection(board.serial);
          if (lastConnection) {
            connectionsMap.set(board.serial, lastConnection);
          }
        }
      }

      setLastConnections(connectionsMap);
    };

    loadLastConnections().catch(console.error);
  }, [boards, getLastConnection]);

  const sortBoards = useCallback(
    (boardList: Board[]): Board[] => {
      return [...boardList].sort((a, b) => {
        const aConn = lastConnections.get(a.serial);
        const bConn = lastConnections.get(b.serial);

        if (aConn && bConn) {
          return new Date(bConn).getTime() - new Date(aConn).getTime();
        }
        if (aConn && !bConn) return -1;
        if (!aConn && bConn) return 1;

        return a.name.localeCompare(b.name);
      });
    },
    [lastConnections],
  );

  const groupedBoards: GroupedBoards = useMemo(() => {
    const newBoards: Board[] = [];
    const usbBoards: Board[] = [];
    const networkBoards: Board[] = [];

    for (const board of boards) {
      if (newBoardSerials.has(board.serial)) {
        // New Network boards go to networkBoards (will be sorted to bottom)
        if (board.connectionType === 'Network') {
          networkBoards.push(board);
        } else {
          // New USB/Local boards stay in newBoards
          newBoards.push(board);
        }
      } else if (
        board.connectionType === 'USB' ||
        board.connectionType === 'Local'
      ) {
        usbBoards.push(board);
      } else if (board.connectionType === 'Network') {
        networkBoards.push(board);
      }
    }

    return {
      newBoards: sortBoards(newBoards),
      usbBoards: sortBoards(usbBoards),
      networkBoards: sortBoards(networkBoards),
    };
  }, [boards, newBoardSerials, sortBoards]);

  const isSingleBoard = boards.length === 1;
  const hasMultipleBoards = boards.length > 1;

  const closePasswordPrompt = useCallback((): void => {
    onConnPswCancel();
  }, [onConnPswCancel]);

  const linuxCredentialsDialog = {
    open: showBoardConnPswPrompt,
    onOpenChange: (isOpen: boolean): void => {
      if (!isOpen) closePasswordPrompt();
    },
    onSubmit: onConnPswSubmit,
    onCancel: closePasswordPrompt,
    isLoading: isBoardConnectingOrChecking,
    error: connToBoardError,
  };

  const handleSelectBoard = useCallback(
    (board: Board) => {
      onSelectBoard(board);
    },
    [onSelectBoard],
  );

  const renderBoardCard = (board: Board): JSX.Element => {
    const isLoading =
      selectingBoard?.serial === board.serial &&
      (boardSelectionStatus === 'selection-started' ||
        boardSelectionStatus === 'conn-started' ||
        boardSelectionStatus === 'conn-and-selection-done' ||
        board.checkingStatus);
    return (
      <BoardCard
        key={board.serial}
        isNew={newBoardSerials.has(board.serial)}
        title={board.name}
        chip={board.connectionType}
        onClick={(): void => handleSelectBoard(board)}
        ChipIcon={board.connectionType === 'Network' ? <Wifi /> : <Usb />}
        Icon={<BoardIcon board={board} />}
        description={board.type}
        lastConnection={lastConnections.get(board.serial)}
        disabled={board.checkingStatus}
        isLoading={isLoading}
        variant={isSingleBoard ? 'single' : 'multi'}
      />
    );
  };

  return (
    <>
      <LinuxCredentialsDialog logic={linuxCredentialsDialog} />

      {!isAutoSelectingBoard && (
        <div className={styles['welcome-container']}>
          <div className={styles['welcome-header']}>
            <Arduino />
            <Large bold className={styles['welcome-title']}>
              {formatMessage(welcomeMessages.title)}
            </Large>
            {!isLoading && boards.length > 0 && (
              <>
                <Small bold className={styles['welcome-subtitle']}>
                  {formatMessage(welcomeMessages.chooseBoard)}
                </Small>
                <Small className={styles['welcome-description']}>
                  {formatMessage(welcomeMessages.chooseBoardDescription)}
                </Small>
              </>
            )}
          </div>

          {!isLoading && boards.length > 0 && (
            <div
              className={clsx(styles['boards-scroll-area'], {
                [styles['boards-scroll-area--single']]: isSingleBoard,
              })}
            >
              {/* New boards */}
              {groupedBoards.newBoards.length > 0 && (
                <div className={styles['board-group']}>
                  {groupedBoards.newBoards.map(renderBoardCard)}
                </div>
              )}

              {/* USB boards */}
              {groupedBoards.usbBoards.length > 0 && (
                <div className={styles['board-group']}>
                  {hasMultipleBoards && (
                    <div className={styles['group-header']}>
                      <Usb />
                      <XSmall className={styles['group-label']}>
                        {formatMessage(welcomeMessages.availableViaUsb)}
                      </XSmall>
                      <div className={styles['group-divider']} />
                    </div>
                  )}
                  {groupedBoards.usbBoards.map(renderBoardCard)}
                </div>
              )}

              {/* Network boards */}
              {groupedBoards.networkBoards.length > 0 && (
                <div className={styles['board-group']}>
                  {hasMultipleBoards && (
                    <div className={styles['group-header']}>
                      <Wifi />
                      <XSmall className={styles['group-label']}>
                        {formatMessage(welcomeMessages.availableOnNetwork)}
                      </XSmall>
                      <div className={styles['group-divider']} />
                    </div>
                  )}
                  {groupedBoards.networkBoards.map(renderBoardCard)}
                </div>
              )}
            </div>
          )}

          {!isLoading && boards.length === 0 && (
            <div className={styles['empty-state']}>
              <span className={styles['empty-title']}>
                {formatMessage(welcomeMessages.noBoardsFound)}
              </span>
              <span className={styles['empty-description']}>
                {formatMessage(welcomeMessages.chooseBoardDescription)}
              </span>
              <DotLottiePlayer
                src={noBoard}
                autoplay
                loop
                className={styles['empty-lottie']}
              />
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default Welcome;
