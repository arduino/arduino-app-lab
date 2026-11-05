import { Breadcrumb, Button, DropdownMenu } from '@bcmi-labs/art-ui/components';
import { CloudSidebar, HeaderPortal } from '@bcmi-labs/cloud-sidebar';
import { Config } from '@cloud-editor-mono/common';
import { login } from '@cloud-editor-mono/domain';
import { ArduinoLoop, CaretDown } from '@cloud-editor-mono/images/assets/icons';
import {
  Rbac,
  RbacCapability,
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
    rbac,
  } = headerLogic();

  const { formatMessage } = useI18n();

  return !isReadOnly ? (
    <>
      <CloudSidebar asHeader={true} />
      <HeaderPortal>
        {headerItemId === HeaderItemId.None ||
        !headerActions ? null : itemDataIsLoading ? (
          <div className={styles['title-skeleton']}>
            <Skeleton variant="rounded" count={1} />
          </div>
        ) : (
          <Breadcrumb.Root size="lg">
            <Breadcrumb.Item
              render={
                headerItemId === HeaderItemId.Sketch ? (
                  // eslint-disable-next-line jsx-a11y/anchor-has-content -- Breadcrumb.Item renders its children inside this anchor
                  <a
                    href={`${Config.CLOUD_HOME_URL}/sketches`}
                    className={styles['sketch-link']}
                  />
                ) : undefined
              }
            >
              {formatMessage(headerTitleLabels[headerItemId])}
            </Breadcrumb.Item>
            <Breadcrumb.Separator />
            <Breadcrumb.Item>{itemName}</Breadcrumb.Item>
            <Rbac
              permissions={
                headerItemId === HeaderItemId.Sketch
                  ? [RbacCapability.EditSketch]
                  : []
              }
              rbac={rbac}
            >
              <DropdownMenu.Root>
                <DropdownMenu.Trigger
                  render={<Breadcrumb.Item />}
                  className={styles['dropdown-trigger']}
                >
                  <CaretDown />
                </DropdownMenu.Trigger>
                <DropdownMenu.Content>
                  {headerItemId === HeaderItemId.Sketch && (
                    <>
                      <Rbac
                        permissions={[RbacCapability.EditSketch]}
                        rbac={rbac}
                      >
                        <DropdownMenu.Item
                          onClick={headerActions[headerItemId].Rename}
                        >
                          Rename
                        </DropdownMenu.Item>
                      </Rbac>
                      <DropdownMenu.Item
                        onClick={headerActions[headerItemId].Download}
                      >
                        Download
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        onClick={headerActions[headerItemId].Share}
                      >
                        Share Sketch
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        onClick={headerActions[headerItemId].ShareToClassroom}
                        disabled={!canShareToClassroom}
                      >
                        Share to Google Classroom
                      </DropdownMenu.Item>
                      <Rbac
                        permissions={[RbacCapability.DeleteSketch]}
                        rbac={rbac}
                      >
                        <DropdownMenu.Item
                          onClick={headerActions[headerItemId].Delete}
                          behaviour="destructive"
                        >
                          Delete
                        </DropdownMenu.Item>
                      </Rbac>
                    </>
                  )}
                  {headerItemId === HeaderItemId.CustomLibrary && (
                    <>
                      <DropdownMenu.Item
                        onClick={headerActions[headerItemId].Download}
                      >
                        Download
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        onClick={headerActions[headerItemId].Delete}
                        behaviour="destructive"
                      >
                        Delete
                      </DropdownMenu.Item>
                    </>
                  )}
                  {headerItemId === HeaderItemId.Example && (
                    <>
                      <Rbac
                        permissions={[RbacCapability.CreateSketch]}
                        rbac={rbac}
                      >
                        <DropdownMenu.Item
                          onClick={headerActions[headerItemId].CopyToSketches}
                        >
                          Save in your sketches
                        </DropdownMenu.Item>
                      </Rbac>
                      <DropdownMenu.Item
                        onClick={headerActions[headerItemId].Download}
                      >
                        Download
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        onClick={headerActions[headerItemId].Share}
                      >
                        Share
                      </DropdownMenu.Item>
                    </>
                  )}
                </DropdownMenu.Content>
              </DropdownMenu.Root>
            </Rbac>
          </Breadcrumb.Root>
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
          <Button variant="tertiary" onClick={login}>
            {formatMessage(messages.signIn)}
          </Button>
        ) : null}
      </div>
    </div>
  );
};

export default memo(Header);
