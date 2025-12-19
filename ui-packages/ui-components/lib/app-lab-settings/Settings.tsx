import clsx from 'clsx';
import { useState } from 'react';
import Split from 'react-split';

import { useI18n } from '../i18n/useI18n';
import { XSmall } from '../typography';
import Item from './item/Item';
import { settingsMessages } from './messages';
import Panel from './panel/Panel';
import styles from './settings.module.scss';
import { AppLabSettingsItem, UseSettingsLogic } from './settings.type';
import { sections, settings } from './settingsSpec';

interface SettingsProps {
  settingsLogic: UseSettingsLogic;
}

const Settings: React.FC<SettingsProps> = (props: SettingsProps) => {
  const { settingsLogic } = props;
  const { contentLogicMap } = settingsLogic();

  const [selectedItem, setSelectedItem] = useState<AppLabSettingsItem>();

  const { formatMessage } = useI18n();

  return (
    <Split
      className={styles['split']}
      sizes={[70, 30]}
      minSize={400}
      expandToMin={false}
      gutterSize={20}
      gutterAlign="center"
      snapOffset={30}
      direction="horizontal"
      cursor="col-resize"
      gutter={(): HTMLElement => {
        const element = document.createElement('div');
        element.className = styles['gutter'];
        return element;
      }}
    >
      <div className={styles['split-item']}>
        {settings ? (
          <ul className={styles['settings-list']}>
            {settings.map((setting, index) =>
              setting.isEnabled ? (
                <Item
                  key={index}
                  title={setting.title}
                  subtitle={setting.subtitle}
                  isSelected={selectedItem?.id === setting.id}
                  onClick={(): void => setSelectedItem(setting)}
                />
              ) : null,
            )}
          </ul>
        ) : (
          <XSmall>{formatMessage(settingsMessages.loadingSettings)}</XSmall>
        )}
      </div>
      <div className={clsx(styles['split-item'], styles['split-item-right'])}>
        {selectedItem ? (
          <Panel
            key={selectedItem.id}
            sectionLogic={contentLogicMap[selectedItem.id]}
            renderSection={sections[selectedItem.id]}
            selectedItem={selectedItem}
            onClose={(): void => setSelectedItem(undefined)}
          />
        ) : null}
      </div>
    </Split>
  );
};
export default Settings;
