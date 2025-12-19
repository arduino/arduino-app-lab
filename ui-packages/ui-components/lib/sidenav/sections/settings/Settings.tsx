import { Config } from '@cloud-editor-mono/common';

import styles from './settings.module.scss';
import SettingsContent from './SettingsContent';

export function Settings(): JSX.Element {
  return (
    <>
      <SettingsContent />
      <div className={styles.version}>{`Version: ${Config.APP_VERSION}`}</div>
    </>
  );
}
