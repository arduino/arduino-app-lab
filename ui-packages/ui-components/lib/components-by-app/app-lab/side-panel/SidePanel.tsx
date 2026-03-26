import clsx from 'clsx';

import styles from './side-panel.module.scss';
import { SidePanelLogic } from './sidePanel.type';
import SidePanelSection from './sub-components/SidePanelSection';

interface SidePanelProps {
  sidePanelLogic: SidePanelLogic;
  classes?: React.ReactNode;
}

const SidePanel: React.FC<SidePanelProps> = (props: SidePanelProps) => {
  const { sidePanelLogic, classes } = props;

  const { sidePanelItemsBySection, visible } = sidePanelLogic();

  return visible ? (
    <div className={clsx(styles['side-panel'], classes)}>
      <nav className={styles['content']}>
        <ul className={styles['list']}>
          <SidePanelSection
            id={'top'}
            items={sidePanelItemsBySection['top']}
            classes={{
              section: styles['section'],
            }}
          />
          <div className={styles['divider']} />
          <SidePanelSection
            id={'middle'}
            items={sidePanelItemsBySection['middle']}
            classes={{
              section: styles['section'],
            }}
          />
          <div className={styles['bottom-section']}>
            <SidePanelSection
              id={'bottom'}
              items={sidePanelItemsBySection['bottom']}
              classes={{
                section: styles['section'],
              }}
            />
          </div>
        </ul>
      </nav>
    </div>
  ) : null;
};

export default SidePanel;
