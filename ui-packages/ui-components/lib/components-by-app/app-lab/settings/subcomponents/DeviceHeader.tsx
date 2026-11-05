import { DeviceImage } from '@cloud-editor-mono/images/assets/app-lab-devices';
import { Edit } from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';
import { useEffect, useState } from 'react';

import { Input, InputStyle } from '../../../../essential/input';
import { XSmall, XXSmall } from '../../../shared';
import { Row } from '../../settings-section/subcomponents/Row';
import { Board } from '../../setup';
import styles from '../settings.module.scss';

export interface DeviceHeaderProps {
  board?: Board;
  boardName?: string;
  onChange: (name: string) => void;
  isError?: boolean;
  errorMsg?: string;
}

export const DeviceHeader = ({
  board,
  boardName,
  onChange,
  isError,
  errorMsg,
}: DeviceHeaderProps): JSX.Element => {
  const [name, setName] = useState(boardName ?? '');
  const [editing, setEditing] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [hasError, setHasError] = useState<string | undefined>();
  const [wasError, setWasError] = useState(false);

  const resetName = (): void => {
    setName(boardName ?? '');
    setEditing(false);
    setJustSaved(false);
    setHasError(undefined);
    setWasError(false);
  };

  const saveName = (): void => {
    setJustSaved(true);
    onChange(name);
  };

  const handleBlur = (): void => {
    setEditing(false);
    setJustSaved(false);
  };

  const handleStartEditing = (): void => {
    setEditing(true);
    setJustSaved(false);
    setHasError(undefined);
    setWasError(false);
  };

  useEffect(() => {
    if (isError && editing) {
      setHasError(errorMsg);
      setWasError(true);
    } else if (!isError && wasError && justSaved && editing) {
      setEditing(false);
      setJustSaved(false);
      setHasError(undefined);
      setWasError(false);
    } else if (!isError) {
      setHasError(undefined);
    }
  }, [isError, editing, errorMsg, justSaved, wasError]);

  useEffect(() => {
    if (!editing) {
      setHasError(undefined);
      setWasError(false);
    }
  }, [editing]);

  return (
    <Row
      label={
        <>
          <div className={styles['board-name']}>
            <div
              role="button"
              tabIndex={0}
              className={clsx(styles['board-name-text-container'], {
                [styles['hidden']]: editing,
              })}
              onClick={handleStartEditing}
              onKeyUp={handleStartEditing}
            >
              <XSmall className={styles['board-name-text']} title={boardName}>
                {boardName}
              </XSmall>
              <Edit />
            </div>
            {editing && (
              <>
                <Input
                  inputStyle={InputStyle.AppLab}
                  outlined
                  autoFocus
                  type="text"
                  value={name}
                  blurOnEnter={false}
                  onChange={setName}
                  onBlur={handleBlur}
                  onEnter={saveName}
                  error={hasError ? new Error(hasError) : undefined}
                  classes={{
                    inputError: styles['board-name-input-error-message'],
                  }}
                  onKeyDown={(e): void => {
                    if (e.key === 'Escape') {
                      resetName();
                    }
                  }}
                />
              </>
            )}
          </div>
          <XXSmall
            className={clsx(styles['board-type'], {
              [styles['board-type-hidden']]: hasError,
            })}
          >
            {board?.type}
          </XXSmall>
        </>
      }
      classes={{
        label: styles['device-header-label'],
        wrapper: styles['device-header'],
      }}
    >
      <DeviceImage deviceImageKey={board?.fqbn || 'unknown'} />
    </Row>
  );
};
