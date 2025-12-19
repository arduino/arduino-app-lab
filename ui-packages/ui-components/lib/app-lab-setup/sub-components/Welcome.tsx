import {
  ArduinoLogo,
  BoardConnected,
  NoBoard,
  NoDevice,
  Usb,
  Wifi,
} from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';
import { useCallback, useEffect, useRef, useState } from 'react';

import { AppLabDialog } from '../../dialogs/app-lab/app-lab-dialog/AppLabDialog';
import {
  AppLabButton as Button,
  ButtonType,
} from '../../essential/app-lab-button';
import { Input } from '../../essential/input';
import { InputStyle } from '../../essential/input/input.type';
import { useI18n } from '../../i18n/useI18n';
import { Large, Small } from '../../typography';
import { welcomeMessages } from '../messages';
import { Board } from '../setup.type';
import BoardCard from './BoardCard';
import styles from './welcome.module.scss';

interface WelcomeProps {
  isLoading: boolean;
  boards: Board[];
  onSelectBoard: (board: Board) => void;
  isSelectingBoard?: boolean;
  showBoardConnPswPrompt: boolean;
  onConnPswCancel: () => void;
  onConnPswSubmit: (password: string) => Promise<void>;
  isBoardConnectingOrChecking: boolean;
  connToBoardError?: string;
}

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
  } = props;

  const { formatMessage } = useI18n();
  const [boardConnPsw, setBoardConnPsw] = useState('');

  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    passwordRef?.current?.focus();
  }, []);

  const closePasswordPrompt = useCallback((): void => {
    setBoardConnPsw('');
    onConnPswCancel();
  }, [onConnPswCancel]);

  const submitPassword = useCallback((): Promise<void> => {
    return onConnPswSubmit(boardConnPsw);
  }, [boardConnPsw, onConnPswSubmit]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent): void => {
      switch (e.key) {
        case 'Escape':
          if (!isBoardConnectingOrChecking) {
            closePasswordPrompt();
          }
          break;
        case 'Enter':
          if (boardConnPsw && !isBoardConnectingOrChecking) {
            submitPassword();
          }
          break;
      }
    },
    [
      boardConnPsw,
      closePasswordPrompt,
      isBoardConnectingOrChecking,
      submitPassword,
    ],
  );

  const description =
    boards.length > 1
      ? welcomeMessages.descriptionMultipleBoards
      : welcomeMessages.description;

  useEffect(() => {
    if (showBoardConnPswPrompt) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, showBoardConnPswPrompt]);

  return (
    <>
      {showBoardConnPswPrompt && (
        <AppLabDialog
          open={showBoardConnPswPrompt}
          title="Linux password"
          closeable={!isBoardConnectingOrChecking}
          classes={{
            root: styles['password-prompt'],
            content: styles['password-prompt-content'],
            body: styles['password-prompt-body'],
            footer: styles['password-prompt-footer'],
          }}
          onOpenChange={(isOpen): void => {
            if (!isOpen) {
              closePasswordPrompt();
            }
          }}
          footer={
            <>
              <Button
                type={ButtonType.Secondary}
                onClick={closePasswordPrompt}
                disabled={isBoardConnectingOrChecking}
              >
                Cancel
              </Button>
              <Button
                type={ButtonType.Primary}
                onClick={submitPassword}
                loading={isBoardConnectingOrChecking}
                disabled={!boardConnPsw || isBoardConnectingOrChecking}
              >
                Confirm
              </Button>
            </>
          }
        >
          <Input
            ref={passwordRef}
            inputStyle={InputStyle.AppLab}
            type="text"
            label="Username"
            value="arduino"
            disabled
            onChange={(): null => null}
            classes={{
              input: clsx([
                styles['input'],
                styles['username'],
                styles['disabled'],
              ]),
            }}
          />
          <Input
            inputStyle={InputStyle.AppLab}
            value={boardConnPsw}
            sensitive={true}
            onChange={(value): void => setBoardConnPsw(value)}
            error={connToBoardError ? new Error(connToBoardError) : undefined}
            placeholder=""
            label="Password"
            classes={{
              input: clsx([styles['input'], styles['password']]),
              inputContainer: styles['app-name-input-container'],
              error: styles['app-name-input-error'],
              inputError: styles['error-message'],
            }}
          />
        </AppLabDialog>
      )}
      <div className={styles['welcome-container']}>
        <ArduinoLogo />
        <div className={styles['welcome-content']}>
          <Large bold className={styles['welcome-title']}>
            {formatMessage(welcomeMessages.title)}
          </Large>
          {isLoading ? null : (
            <>
              <Small bold className={styles['welcome-description']}>
                {formatMessage(description)}
              </Small>
              {boards.length > 0 ? (
                <div className={styles['boards']}>
                  {boards.map((board, index) => (
                    <BoardCard
                      key={index} // temp, id is missing
                      title={board.type}
                      chip={board.connectionType}
                      onClick={(): void => onSelectBoard(board)}
                      ChipIcon={
                        board.connectionType === 'Network' ? <Wifi /> : <Usb />
                      }
                      Icon={<BoardConnected />}
                      description={board.name}
                      disabled={board.isSelecting || board.checkingStatus}
                    />
                  ))}
                </div>
              ) : (
                <BoardCard
                  title={formatMessage(welcomeMessages.connectYourBoard)}
                  description={formatMessage(
                    welcomeMessages.connectYourBoardDescription,
                  )}
                  chip={formatMessage(welcomeMessages.noDevice)}
                  ChipIcon={<NoDevice />}
                  Icon={<NoBoard />}
                />
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default Welcome;
