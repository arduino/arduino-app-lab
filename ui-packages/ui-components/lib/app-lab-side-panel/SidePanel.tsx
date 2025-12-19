import { Config } from '@cloud-editor-mono/common';
import { Login } from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';

import { useI18n } from '../i18n/useI18n';
import { XXXSmall } from '../typography';
import { messages } from './messages';
import styles from './side-panel.module.scss';
import { SidePanelItemId, SidePanelLogic } from './sidePanel.type';
import itemStyles from './sub-components/side-panel-item.module.scss';
import SidePanelItem from './sub-components/SidePanelItem';
import SidePanelSection from './sub-components/SidePanelSection';

interface SidePanelProps {
  sidePanelLogic: SidePanelLogic;
  classes?: React.ReactNode;
}

const SidePanel: React.FC<SidePanelProps> = (props: SidePanelProps) => {
  const { sidePanelLogic, classes } = props;

  const { sidePanelItemsBySection, activeItem, user, visible, login } =
    sidePanelLogic();

  const { formatMessage } = useI18n();

  const isLoginEnabled = false;

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
            {isLoginEnabled ? (
              <SidePanelItem
                id={SidePanelItemId.Login}
                label={
                  user ? { defaultMessage: user.name } : messages.loginLabel
                }
                Icon={user ? user.picture : undefined}
                isActive={activeItem === SidePanelItemId.Login}
                externalLink={user ? Config.ID_URL : undefined}
              >
                {!user ? (
                  <button onClick={login} className={itemStyles['button']}>
                    <div className={itemStyles['icon']}>
                      <Login />
                    </div>
                    <XXXSmall>{formatMessage(messages.loginLabel)}</XXXSmall>
                  </button>
                ) : null}
              </SidePanelItem>
            ) : null}
          </div>
        </ul>
      </nav>
    </div>
  ) : null;
};

export default SidePanel;
