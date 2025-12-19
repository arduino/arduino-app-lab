import { CloseX } from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';

import { IconButton } from '../../essential/icon-button';
import { XSmall } from '../../typography';
import { AppLabSettingsItem, Section } from '../settings.type';
import styles from './panel.module.scss';

interface PanelProps<T extends AppLabSettingsItem> {
  title?: string;
  sectionLogic: Section<T>['logic'];
  renderSection: Section<T>['render'];
  onClose: () => void;
  selectedItem: AppLabSettingsItem;
  classes?: { container?: string; content?: string };
}

export function Panel<T extends AppLabSettingsItem>(
  props: PanelProps<T>,
): JSX.Element {
  const { onClose, selectedItem, classes, sectionLogic, renderSection } = props;

  return (
    <div className={clsx(styles['container'], classes?.container)}>
      <div className={styles['header']}>
        <XSmall className={styles['title']}>{selectedItem?.title}</XSmall>
        <IconButton
          Icon={CloseX}
          onPress={onClose}
          label={'close'}
          classes={{ button: styles['close-button'] }}
        />
      </div>
      <div className={styles['content']}>{renderSection(sectionLogic)}</div>
    </div>
  );
}

export default Panel;
