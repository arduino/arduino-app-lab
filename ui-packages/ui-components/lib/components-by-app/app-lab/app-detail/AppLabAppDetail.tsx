import { Duplicate } from '@cloud-editor-mono/images/assets/icons';
import {
  AiModelRequiredDialog,
  AppAction,
  AppLabEditSection,
  AppsSection,
  AppTitle,
  Button,
  ButtonAppearance,
  ButtonSize,
  ButtonVariant,
  ConfigureAppBricksDialog,
  RuntimeActions,
  SwapRunningAppDialog,
  TopBar,
  useI18n,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { DeleteTreeItemDialog } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';
import { memo } from 'react';

import styles from './app-lab-app-detail.module.scss';
import { AppLabAppDetailLogic } from './appLabAppDetail.type';
import { messages } from './messages';

interface AppLabAppDetailProps {
  appId: string;
  section: AppsSection;
  appLabAppDetailLogic: AppLabAppDetailLogic;
}

const AppLabAppDetail: React.FC<AppLabAppDetailProps> = (
  props: AppLabAppDetailProps,
) => {
  const { appLabAppDetailLogic, appId, section } = props;
  const {
    app,
    fileTree,
    configureAppBricksDialogLogic,
    swapRunningAppDialogLogic,
    aiModelRequiredDialogLogic,
    onAppAction,
    appTitleLogic,
    appLabEditSectionLogic,
    runtimeActionsLogic,
    deleteTreeItemDialogLogic,
  } = appLabAppDetailLogic(appId, section);

  const { formatMessage } = useI18n();

  return (
    <section className={styles['app-detail']}>
      <ConfigureAppBricksDialog logic={configureAppBricksDialogLogic} />
      <SwapRunningAppDialog logic={swapRunningAppDialogLogic} />
      <AiModelRequiredDialog logic={aiModelRequiredDialogLogic} />
      <DeleteTreeItemDialog logic={deleteTreeItemDialogLogic} />
      <TopBar
        pathItems={[
          section,
          <AppTitle key="app-title" appTitleLogic={appTitleLogic} />,
        ]}
      >
        <div className={styles['actions']}>
          {app?.id && (
            <RuntimeActions
              runtimeActionsLogic={runtimeActionsLogic}
              runtimeDisable={!fileTree}
            />
          )}
          {app?.example && (
            <Button
              onClick={(): void => onAppAction(AppAction.Duplicate)}
              variant={ButtonVariant.Secondary}
              appearance={ButtonAppearance.Action}
              size={ButtonSize.Small}
              Icon={Duplicate}
              title="Copy and edit app"
              classes={{
                button: styles['actions--duplicate'],
                textButtonText: styles['actions--duplicate-text'],
              }}
            >
              {formatMessage(messages.copyAndEditButton)}
            </Button>
          )}
        </div>
      </TopBar>
      <div className={clsx(styles['editor-panel'])}>
        <AppLabEditSection appLabEditSectionLogic={appLabEditSectionLogic} />
      </div>
    </section>
  );
};

export default memo(AppLabAppDetail);
