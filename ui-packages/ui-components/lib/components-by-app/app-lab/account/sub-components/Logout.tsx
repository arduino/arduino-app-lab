import { ArduinoUser } from '@bcmi-labs/art-auth';
import {
  OpenInNewTab,
  ThreeDots,
} from '@cloud-editor-mono/images/assets/icons';

import { DropdownMenuButton } from '../../../../essential/dropdown-menu';
import { useI18n } from '../../../../i18n/useI18n';
import { Small, XXSmall } from '../../../../typography';
import styles from '../account.module.scss';
import { messages } from '../messages';

interface LogoutProps {
  user?: ArduinoUser | null;
  logout: () => void;
}

const Logout: React.FC<LogoutProps> = (props: LogoutProps) => {
  const { user, logout } = props;

  const { formatMessage } = useI18n();

  return (
    <div className={styles['logout-container']}>
      <div className={styles['logout-content']}>
        {user?.picture && (
          <img
            className={styles['user-picture']}
            src={user.picture}
            alt={user.name || 'User'}
          />
        )}
        <div className={styles['user-details']}>
          <Small bold>{formatMessage(messages.personalInfo)}</Small>
          <div className={styles['user-info']}>
            <XXSmall>{formatMessage(messages.fullNameLabel)}</XXSmall>
            <Small className={styles['user-name']}>
              <span>{user?.given_name}</span>
              <span> {user?.family_name}</span>
            </Small>
          </div>
          <div className={styles['user-info']}>
            <XXSmall>{formatMessage(messages.emailLabel)}</XXSmall>
            <Small className={styles['user-email']}>{user?.email}</Small>
          </div>
          <div className={styles['user-info']}>
            <XXSmall>{formatMessage(messages.usernameLabel)}</XXSmall>
            <Small className={styles['user-username']}>
              {user?.preferred_username || user?.nickname}
            </Small>
          </div>
        </div>
        <DropdownMenuButton
          title={formatMessage(messages.logoutLabel)}
          sections={[
            {
              name: 'Actions',
              items: [
                {
                  id: formatMessage(messages.logoutLabel),
                  label: formatMessage(messages.logoutLabel),
                  labelPrefix: <OpenInNewTab />,
                },
              ],
            },
          ]}
          buttonChildren={<ThreeDots />}
          onAction={(key): void =>
            key === formatMessage(messages.logoutLabel) ? logout() : undefined
          }
          classes={{
            dropdownMenu: styles['dropdown-button-menu'],
            dropdownMenuButton: styles['dropdown-button'],
            dropdownMenuButtonWrapper: styles['dropdown-button-wrapper'],
            dropdownMenuItem: styles['dropdown-button-menu-item'],
          }}
        />
      </div>
    </div>
  );
};

export default Logout;
