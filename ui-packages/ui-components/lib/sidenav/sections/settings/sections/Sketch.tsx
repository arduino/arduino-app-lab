import { ToggleOff, ToggleOn } from '@cloud-editor-mono/images/assets/icons';
import { useContext } from 'react';

import { ToggleButton } from '../../../../essential/toggle-button';
import { useI18n } from '../../../../i18n/useI18n';
import { XSmall } from '../../../../typography';
import { SettingsContext } from '../context/settingsContext';
import { messages } from '../messages';
import styles from '../settings.module.scss';
import { Preferences } from '../settings.type';

const Sketch: React.FC = () => {
  const { getPreference, setPreference, saveAllFiles } =
    useContext(SettingsContext);
  const { formatMessage } = useI18n();

  const autoSave = Boolean(getPreference(Preferences.AutoSave));
  const saveOnVerifyAndUpload = Boolean(
    getPreference(Preferences.SaveOnVerifyingUploading),
  );

  return (
    <>
      <div className={styles['setting']}>
        <XSmall bold>{formatMessage(messages.savingSection)}</XSmall>
        <div className={styles['setting__saving']}>
          <XSmall>{formatMessage(messages.enableAutoSave)}</XSmall>
          <ToggleButton
            classes={{ button: styles['setting__saving-toggle-button'] }}
            buttonOn={<ToggleOn />}
            buttonOff={<ToggleOff />}
            defaultSelected={true}
            isSelected={autoSave}
            onChange={(isAutoSave: boolean): void => {
              setPreference(Preferences.AutoSave, isAutoSave);
              if (isAutoSave) {
                saveAllFiles();
              }
            }}
          />
          {!autoSave ? (
            <>
              <XSmall>{formatMessage(messages.saveOnVerifyAndUpload)}</XSmall>
              <ToggleButton
                classes={{ button: styles['setting__saving-toggle-button'] }}
                buttonOn={<ToggleOn />}
                buttonOff={<ToggleOff />}
                defaultSelected={true}
                isSelected={saveOnVerifyAndUpload}
                onChange={(isSaveOnVerifyAndUpload: boolean): void => {
                  setPreference(
                    Preferences.SaveOnVerifyingUploading,
                    isSaveOnVerifyAndUpload,
                  );
                }}
              />
            </>
          ) : null}
        </div>
      </div>
    </>
  );
};

export default Sketch;
