import { DeviceImage } from '@cloud-editor-mono/images/assets/app-lab-devices';
import { Edit } from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';
import { useState } from 'react';

import { Input, InputStyle } from '../../../../essential/input';
import { XSmall, XXSmall } from '../../../shared';
import { Row } from '../../settings-section/subcomponents/Row';
import { Board } from '../../setup';
import styles from '../settings.module.scss';

export interface DeviceHeaderProps {
  board?: Board;
  boardName?: string;
  fqbn?: string;
  onChange: (name: string) => void;
}

export const DeviceHeader = ({
  board,
  boardName,
  fqbn,
  onChange,
}: DeviceHeaderProps): JSX.Element => {
  const [name, setName] = useState(boardName ?? '');
  const [editing, setEditing] = useState(false);

  const resetName = (): void => {
    setName(boardName ?? '');
    setEditing(false);
  };

  const saveName = (): void => {
    onChange(name);
    setEditing(false);
  };

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
              onClick={(): void => setEditing(true)}
              onKeyUp={(): void => setEditing(true)}
            >
              <XSmall className={styles['board-name-text']} title={name}>
                {name}
              </XSmall>
              <Edit />
            </div>
            {editing && (
              <Input
                inputStyle={InputStyle.AppLab}
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                type="text"
                value={name}
                blurOnEnter={false}
                onChange={setName}
                onBlur={saveName}
                onEnter={saveName}
                onKeyDown={(e): void => {
                  if (e.key === 'Escape') {
                    resetName();
                  }
                }}
              />
            )}
          </div>
          <XXSmall className={styles['board-type']}>{board?.type}</XXSmall>
        </>
      }
      classes={{
        label: styles['device-header-label'],
        wrapper: styles['device-header'],
      }}
    >
      <DeviceImage deviceImageKey={fqbn || 'unknown'} />
    </Row>
  );
};
