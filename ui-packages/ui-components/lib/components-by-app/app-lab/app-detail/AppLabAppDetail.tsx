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
  DeleteTreeItemDialog,
  panelStorageKey,
  RuntimeActions,
  SwapRunningAppDialog,
  TopBar,
  useI18n,
  useTooltip,
  useWorkspacePanel,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';
import { memo, useMemo } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';

import styles from './app-lab-app-detail.module.scss';
import {
  AgentPanelSlotProps,
  AppLabAppDetailLogic,
} from './appLabAppDetail.type';
import { messages } from './messages';

const AGENT_PANEL_ID = 'agent';
const AGENT_PANEL_MIN_SIZE_PX = 380;
const AGENT_PANEL_MAX_SIZE_PX = 800;

interface AppLabAppDetailProps {
  appId: string;
  section: AppsSection;
  appLabAppDetailLogic: AppLabAppDetailLogic;
  // Breadcrumb page-title/link override for sections that reuse another
  // section's detail route (Inspirations reuses /examples/$appId).
  breadcrumbId?: string;
  // Builds the agent side panel. A builder rather than a node because what it needs
  // (the app's name, the panel's own close) only exists once the logic has run.
  agentPanelSlot?: (props: AgentPanelSlotProps) => React.ReactNode;
}

const AppLabAppDetail: React.FC<AppLabAppDetailProps> = (
  props: AppLabAppDetailProps,
) => {
  const { appLabAppDetailLogic, appId, section, breadcrumbId, agentPanelSlot } =
    props;
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
    agentPanelVisible,
    closeAgentPanel,
    openAgentSettings,
    getAgentEditorContext,
  } = appLabAppDetailLogic(appId, section);

  const { formatMessage } = useI18n();

  const {
    props: tooltipPropsDuplicate,
    renderTooltip: renderTooltipDuplicate,
  } = useTooltip({
    content: formatMessage(messages.copyAndEditButton),
  });

  const agentPanel = useWorkspacePanel({
    storageKey: panelStorageKey(AGENT_PANEL_ID),
    defaultSize: AGENT_PANEL_MIN_SIZE_PX,
  });

  // The panel mounts and unmounts as the user toggles it, so `sizeAtMount` would reopen it at
  // whatever width the session started with. Recomputed on each open from the latest stored size.
  const getLatestAgentPanelSize = agentPanel.getLatestSize;
  const agentPanelDefaultSize = useMemo(() => {
    const latest = agentPanelVisible ? getLatestAgentPanelSize() : undefined;
    return latest ?? AGENT_PANEL_MIN_SIZE_PX;
  }, [agentPanelVisible, getLatestAgentPanelSize]);

  return (
    <section className={styles['app-detail']}>
      <ConfigureAppBricksDialog logic={configureAppBricksDialogLogic} />
      <SwapRunningAppDialog logic={swapRunningAppDialogLogic} />
      <AiModelRequiredDialog logic={aiModelRequiredDialogLogic} />
      <DeleteTreeItemDialog logic={deleteTreeItemDialogLogic} />
      <Group className={styles['layout-group']} orientation="horizontal">
        <Panel className={styles['main-panel']}>
          <div className={styles['main-column']}>
            <TopBar
              pathItems={[
                breadcrumbId ?? section,
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
                {(app?.example || app?.release) && (
                  <div {...tooltipPropsDuplicate}>
                    <Button
                      onClick={(): void => onAppAction(AppAction.Duplicate)}
                      variant={ButtonVariant.Secondary}
                      appearance={ButtonAppearance.Action}
                      size={ButtonSize.XSmall}
                      Icon={Duplicate}
                      title="Copy and edit App"
                      classes={{
                        button: styles['actions--duplicate'],
                        textButtonText: styles['actions--duplicate-text'],
                      }}
                    >
                      {formatMessage(messages.copyAndEditButton)}
                    </Button>
                    {renderTooltipDuplicate()}
                  </div>
                )}
              </div>
            </TopBar>
            <div className={clsx(styles['editor-panel'])}>
              <AppLabEditSection
                appLabEditSectionLogic={appLabEditSectionLogic}
              />
            </div>
          </div>
        </Panel>
        {agentPanelVisible && (
          <>
            <Separator className={styles['separator']} />
            <Panel
              id={AGENT_PANEL_ID}
              panelRef={agentPanel.setRef}
              className={styles['agent-panel-slot']}
              defaultSize={`${agentPanelDefaultSize}px`}
              minSize={`${AGENT_PANEL_MIN_SIZE_PX}px`}
              maxSize={`${AGENT_PANEL_MAX_SIZE_PX}px`}
              groupResizeBehavior="preserve-pixel-size"
              onResize={(): void => agentPanel.onResize()}
            >
              {agentPanelSlot?.({
                appName: app?.name ?? '',
                appId,
                onClose: closeAgentPanel,
                onSetupAgent: openAgentSettings,
                getEditorContext: getAgentEditorContext,
              })}
            </Panel>
          </>
        )}
      </Group>
    </section>
  );
};

export default memo(AppLabAppDetail);
