import '@bcmi-labs/cloud-sidebar/dist/index.css';

import {
  ArduinoLogo,
  Breadcrumbs,
  BreadcrumbsDropdown,
  BreadcrumbsDropdownItem,
  BreadcrumbsItem,
  BreadcrumbsSeparator,
  HeaderPortal,
  Scrollable,
  SidebarInfobox,
  SidebarNavigation,
  SidebarRoot,
  SpaceSelector,
  SystemStatus,
} from '@bcmi-labs/cloud-sidebar';
import { Config } from '@cloud-editor-mono/common';
import { login } from '@cloud-editor-mono/domain';
import { ArduinoLoop } from '@cloud-editor-mono/images/assets/icons';
import {
  Button,
  ButtonType,
  Skeleton,
  useI18n,
} from '@cloud-editor-mono/ui-components';
import { memo } from 'react';

import styles from './header.module.scss';
import { HeaderItemId, HeaderLogic } from './Header.type';
import { headerTitleLabels } from './headerSpec';
import { headerMessages as messages } from './messages';

interface HeaderProps {
  headerLogic: HeaderLogic;
}

const Header: React.FC<HeaderProps> = (props: HeaderProps) => {
  const { headerLogic } = props;

  const {
    user,
    isReadOnly,
    canShareToClassroom,
    readOnlyAvatarLink,
    headerItemId,
    itemName,
    itemDataIsLoading,
    headerActions,
  } = headerLogic();

  const { formatMessage } = useI18n();

  return !isReadOnly ? (
    <>
      <SidebarRoot asDialog="header">
        <SpaceSelector />
        <Scrollable>
          <SidebarNavigation />
          <SidebarInfobox />
          <ArduinoLogo />
        </Scrollable>
        <SystemStatus />
      </SidebarRoot>
      <HeaderPortal>
        {headerItemId === HeaderItemId.None ||
        !headerActions ? null : itemDataIsLoading ? (
          <div className={styles['title-skeleton']}>
            <Skeleton variant="rounded" count={1} />
          </div>
        ) : (
          <Breadcrumbs>
            <BreadcrumbsItem>
              {headerItemId !== HeaderItemId.Sketch ? (
                formatMessage(headerTitleLabels[headerItemId])
              ) : (
                <a href={`${Config.CLOUD_HOME_URL}/sketches`}>
                  {formatMessage(headerTitleLabels[headerItemId])}
                </a>
              )}
            </BreadcrumbsItem>
            <BreadcrumbsSeparator />
            <BreadcrumbsDropdown triggerContent={itemName}>
              {headerItemId === HeaderItemId.Sketch && (
                <>
                  {/* <BreadcrumbsDropdownItem>Save</BreadcrumbsDropdownItem>
                <BreadcrumbsDropdownItem>Duplicate</BreadcrumbsDropdownItem> */}
                  <BreadcrumbsDropdownItem
                    onClick={headerActions[headerItemId].Rename}
                  >
                    Rename
                  </BreadcrumbsDropdownItem>
                  <BreadcrumbsDropdownItem
                    onClick={headerActions[headerItemId].Download}
                  >
                    Download
                  </BreadcrumbsDropdownItem>
                  <BreadcrumbsDropdownItem
                    onClick={headerActions[headerItemId].Share}
                  >
                    Share Sketch
                  </BreadcrumbsDropdownItem>
                  <BreadcrumbsDropdownItem
                    onClick={headerActions[headerItemId].ShareToClassroom}
                    disabled={!canShareToClassroom}
                  >
                    Share to Google Classroom
                  </BreadcrumbsDropdownItem>
                  <BreadcrumbsDropdownItem
                    className={styles.warning}
                    onClick={headerActions[headerItemId].Delete}
                  >
                    Delete
                  </BreadcrumbsDropdownItem>
                </>
              )}
              {headerItemId === HeaderItemId.CustomLibrary && (
                <>
                  {/* <BreadcrumbsDropdownItem>Save</BreadcrumbsDropdownItem> */}
                  <BreadcrumbsDropdownItem
                    onClick={headerActions[headerItemId].Download}
                  >
                    Download
                  </BreadcrumbsDropdownItem>
                  <BreadcrumbsDropdownItem
                    className={styles.warning}
                    onClick={headerActions[headerItemId].Delete}
                  >
                    Delete
                  </BreadcrumbsDropdownItem>
                </>
              )}
              {headerItemId === HeaderItemId.Example && (
                <>
                  <BreadcrumbsDropdownItem
                    onClick={headerActions[headerItemId].CopyToSketches}
                  >
                    Save in your sketches
                  </BreadcrumbsDropdownItem>
                  <BreadcrumbsDropdownItem
                    onClick={headerActions[headerItemId].Download}
                  >
                    Download
                  </BreadcrumbsDropdownItem>
                  <BreadcrumbsDropdownItem
                    onClick={headerActions[headerItemId].Share}
                  >
                    Share
                  </BreadcrumbsDropdownItem>
                </>
              )}
            </BreadcrumbsDropdown>
          </Breadcrumbs>
        )}
      </HeaderPortal>
    </>
  ) : (
    <div className={styles['read-only-header']}>
      <div className={styles['logo-container']}>
        <ArduinoLoop />
      </div>
      <div className={styles['right-item-container']}>
        {user ? (
          user.picture ? (
            <a href={readOnlyAvatarLink} target="_blank" rel="noreferrer">
              <img
                className={styles['user-avatar']}
                src={user.picture}
                alt="User avatar"
                width="36"
                height="36"
              />
            </a>
          ) : null
        ) : user === null ? (
          <Button type={ButtonType.Tertiary} onClick={login}>
            {formatMessage(messages.signIn)}
          </Button>
        ) : null}
      </div>
    </div>
  );
};

export default memo(Header);
