import { ToggleOff, ToggleOn } from '@cloud-editor-mono/images/assets/icons';
import { useContext } from 'react';

import { ToggleButton } from '../../../../essential/toggle-button';
import { useI18n } from '../../../../i18n/useI18n';
import { XSmall, XXSmall } from '../../../../typography';
import { SettingsContext } from '../context/settingsContext';
import { messages } from '../messages';
import styles from '../settings.module.scss';
import { Preferences } from '../settings.type';

const Device: React.FC = () => {
  const { formatMessage } = useI18n();
  const { getPreference, setPreference } = useContext(SettingsContext);

  const boardAutoSelection = Boolean(
    getPreference(Preferences.BoardAutoSelection),
  );

  return (
    <>
      <div className={styles['setting']}>
        <XSmall bold>{formatMessage(messages.deviceSelectionSection)}</XSmall>
        <div className={styles['setting__device-selection']}>
          <XSmall>{formatMessage(messages.enableAutoSelection)}</XSmall>
          <ToggleButton
            defaultSelected={true}
            classes={{
              button: styles['setting__device-selection-toggle-button'],
            }}
            buttonOn={<ToggleOn />}
            buttonOff={<ToggleOff />}
            isSelected={boardAutoSelection}
            onChange={(isBoardAutoSelection: boolean): void => {
              setPreference(
                Preferences.BoardAutoSelection,
                isBoardAutoSelection,
              );
            }}
          />
        </div>
        <XXSmall className={styles['setting__device-selection-info']}>
          {formatMessage(messages.autoSelectionInfo)}
        </XXSmall>
      </div>
    </>
  );
};

export default Device;
