import clsx from 'clsx';
import { useContext } from 'react';

import { Button, ButtonType } from '../../../essential/button';
import { useI18n } from '../../../i18n/useI18n';
import { XSmall, XXSmall } from '../../../typography';
import { SettingsContext } from './context/settingsContext';
import { messages } from './messages';
import styles from './settings.module.scss';
import { sections as renderSections, settingsItems } from './settingsSpec';

const SettingsContent = (): JSX.Element => {
  const { restorePreferences, handleOptOut } = useContext(SettingsContext);
  const { formatMessage } = useI18n();

  return (
    <div className={clsx(styles['settings-container'])}>
      {handleOptOut ? (
        <div className={styles['opt-out']}>
          <XXSmall>Currently on the new Cloud Editor.</XXSmall>
          <Button type={ButtonType.Tertiary} onClick={handleOptOut}>
            Revert to old editor
          </Button>
        </div>
      ) : null}
      {settingsItems.map((section) => {
        return (
          <div key={section.id} className={styles['section-container']}>
            <div className={styles['section-header']}>
              <section.Icon aria-hidden="true" />
              <XXSmall uppercase>{formatMessage(section.label)}</XXSmall>
            </div>
            <div className={styles['section']}>
              {renderSections[section.id]()}
            </div>
          </div>
        );
      })}
      <Button type={ButtonType.Tertiary} onClick={restorePreferences}>
        <XSmall bold>{formatMessage(messages.restoreSettings)}</XSmall>
      </Button>
    </div>
  );
};

export default SettingsContent;
