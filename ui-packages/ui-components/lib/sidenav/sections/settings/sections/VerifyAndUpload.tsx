import { useContext } from 'react';

import { Radio, RadioGroup } from '../../../../essential/radio-group';
import { useI18n } from '../../../../i18n/useI18n';
import { XSmall, XXSmall } from '../../../../typography';
import { SettingsContext } from '../context/settingsContext';
import { messages } from '../messages';
import styles from '../settings.module.scss';
import { Preferences } from '../settings.type';

const VerifyAndUpload: React.FC = () => {
  const { getPreference, setPreference } = useContext(SettingsContext);
  const { formatMessage } = useI18n();

  const consoleOutput = String(getPreference(Preferences.ConsoleOutput));

  return (
    <>
      <div className={styles['setting']}>
        <XSmall bold>{formatMessage(messages.consoleVerbosity)}</XSmall>
        <div className={styles['setting__verify-and-upload']}>
          <RadioGroup
            label={formatMessage(messages.consoleVerbosity)}
            classes={{ container: styles['setting__console-verbosity'] }}
            defaultValue={consoleOutput}
            value={consoleOutput}
            onChange={(consoleOutput): void => {
              setPreference(Preferences.ConsoleOutput, consoleOutput);
            }}
          >
            <Radio
              value={formatMessage(messages.consoleVerbosityConcise)}
              classes={{
                container: styles['setting__console-verbosity-radio-container'],
                input: styles['setting__console-verbosity-radio-input'],
              }}
            >
              <XSmall>
                {formatMessage(messages.consoleVerbosityConciseOutput)}
              </XSmall>
            </Radio>
            <Radio
              value={formatMessage(messages.consoleVerbosityVerbose)}
              classes={{
                container: styles['setting__console-verbosity-radio-container'],
                input: styles['setting__console-verbosity-radio-input'],
              }}
            >
              <XSmall>
                {formatMessage(messages.consoleVerbosityVerboseOutput)}
              </XSmall>
            </Radio>
          </RadioGroup>
          <XXSmall className={styles['setting__console-verbosity-info']}>
            {formatMessage(messages.consoleVerbosityInfo)}
          </XXSmall>
        </div>
      </div>
    </>
  );
};

export default VerifyAndUpload;
