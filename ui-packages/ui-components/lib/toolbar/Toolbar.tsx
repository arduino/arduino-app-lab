import { parseArduinoFqbn } from '@cloud-editor-mono/common';
import clsx from 'clsx';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useIntersection, usePrevious } from 'react-use';

import { UNKNOWN_BOARD_NAME } from '../device-association-dialog';
import { FormatMessage, useI18n } from '../i18n/useI18n';
import { hasPermissions, RbacCapability } from '../rbac';
import { Small, XSmall } from '../typography';
import { Link } from '../typography/Link';
import { messages } from './messages';
import AssociatedDeviceButton from './sub-components/associated-device-button';
import ChromeOsDeviceSelection from './sub-components/chromeos-device-selection';
import OpenSerialMonitorButton, {
  OpenSerialMonitorButtonProps,
} from './sub-components/open-serial-monitor-button';
import styles from './toolbar.module.scss';
import {
  IotPortName,
  isPopulatedToolbarDevicesData,
  SetToolbarSelection,
  ToolbarActionBlockingReasons,
  ToolbarBusyState,
  ToolbarCommandsState,
  ToolbarItemDictionary,
  ToolbarItemIds,
  ToolbarLogic,
} from './Toolbar.type';
import {
  staticDefaultItems,
  staticIotItems,
  staticReadOnlyItems,
} from './toolbarSpec';

interface ToolbarProps {
  toolbarLogic: ToolbarLogic;
}

const Toolbar: React.FC<ToolbarProps> = (props: ToolbarProps) => {
  const { toolbarLogic } = props;
  const {
    selectedFqbn,
    selectedBoard,
    selectedPort,
    selectedBoardIsIot,
    isIotSketch,
    isIotComponent,
    canVerify,
    isPending,
    isCreating,
    isVerifying,
    isUploading,
    canUpload,
    rbac,
    boardsConfigIsUnknown,
    clickHandlers,
    devices = { totalCount: 0 },
    markDevicesAsSeen,
    manyPortsAvailable,
    disableBoardBubbleBadge,
    currentDeviceIsBusy,
    currentDeviceSupportsOta,
    selectedPortBoardId,
    selectedDeviceAltPortBoardId,
    switchToAltPort,
    notificationElement,
    useChromeOsDeviceAssociation,
    shareSketchLogic,
    shareToClassroomLogic,
  } = toolbarLogic();

  const selectedBoardHasAltPort = Boolean(selectedDeviceAltPortBoardId);
  const canEditSketch = hasPermissions([RbacCapability.EditSketch], rbac);
  const canUploadSketch = hasPermissions([RbacCapability.UploadSketch], rbac);
  const isDeviceReadOnly = !canUploadSketch || !canEditSketch;
  const canUpdateThing = hasPermissions([RbacCapability.UpdateThing], rbac);
  const showDownload = !canEditSketch;

  const isIotToolbar = isIotComponent || isIotSketch;

  // remove selected device/s from `devicesDataToRender`
  const devicesDataToRender = useMemo(() => {
    const data = structuredClone(devices);
    if (selectedBoard && selectedPort && isPopulatedToolbarDevicesData(data)) {
      const filteredIds = data.ids.filter(
        (id) =>
          id !== selectedPortBoardId && id !== selectedDeviceAltPortBoardId,
      );

      data.totalCount = filteredIds.length;

      data.ids = filteredIds;
    }

    return data;
  }, [
    devices,
    selectedBoard,
    selectedDeviceAltPortBoardId,
    selectedPort,
    selectedPortBoardId,
  ]);

  const canUploadValue = canUpload.value;

  const { formatMessage } = useI18n();

  const chromeOsAssociationNode = useCallback(
    (_: FormatMessage, onClick: SetToolbarSelection): JSX.Element => (
      <ChromeOsDeviceSelection
        key={`${ToolbarItemIds.AssociationNode}_info`}
        port={selectedPort}
        board={selectedBoard}
        deviceIsIot={selectedBoardIsIot}
        isIotSketch={isIotToolbar}
        boardsConfigIsUnknown={boardsConfigIsUnknown}
        manyPortsAvailable={manyPortsAvailable}
        selectedBoardHasAltPort={selectedBoardHasAltPort}
        isOtaCompatible={currentDeviceSupportsOta}
        switchToAltPort={switchToAltPort}
        onClick={onClick}
      />
    ),
    [
      boardsConfigIsUnknown,
      currentDeviceSupportsOta,
      isIotToolbar,
      manyPortsAvailable,
      selectedBoard,
      selectedBoardHasAltPort,
      selectedBoardIsIot,
      selectedPort,
      switchToAltPort,
    ],
  );

  const defaultAssociationNode = useCallback(
    (_: FormatMessage, onClick?: SetToolbarSelection): JSX.Element => (
      <AssociatedDeviceButton
        key={`${ToolbarItemIds.AssociationNode}_info`}
        board={selectedBoard || UNKNOWN_BOARD_NAME}
        port={selectedPort}
        deviceIsIot={selectedBoardIsIot}
        isIotToolbar={isIotToolbar}
        isReadOnly={isDeviceReadOnly}
        canChangeIotDevice={canUpdateThing}
        onClickDeviceChange={onClick}
        boardsConfigIsUnknown={boardsConfigIsUnknown}
        boardBubbleBadgeNumber={
          disableBoardBubbleBadge || isDeviceReadOnly
            ? 0
            : (devicesDataToRender.totalCount as number)
        }
        manyPortsAvailable={manyPortsAvailable}
        selectedBoardHasAltPort={selectedBoardHasAltPort}
        isOtaCompatible={currentDeviceSupportsOta}
        switchToAltPort={switchToAltPort}
        classes={{
          'button-container': clsx(
            styles['associated-device-info-button-container'],
            !canUploadSketch && styles['association-node-flush'],
          ),
          button: styles['associated-device-info-button'],
        }}
      />
    ),
    [
      boardsConfigIsUnknown,
      canUpdateThing,
      canUploadSketch,
      currentDeviceSupportsOta,
      devicesDataToRender.totalCount,
      disableBoardBubbleBadge,
      isDeviceReadOnly,
      isIotToolbar,
      manyPortsAvailable,
      selectedBoard,
      selectedBoardHasAltPort,
      selectedBoardIsIot,
      selectedPort,
      switchToAltPort,
    ],
  );

  const serialMonitorNode = useCallback(
    (onClick?: OpenSerialMonitorButtonProps['onClick']) =>
      onClick && (
        <OpenSerialMonitorButton
          key={`${ToolbarItemIds.OpenSerialMonitor}_info`}
          onClick={onClick}
          disabled={!selectedPort || currentDeviceIsBusy || selectedBoardIsIot}
          serialMonitorIsBusy={currentDeviceIsBusy}
        />
      ),
    [currentDeviceIsBusy, selectedBoardIsIot, selectedPort],
  );

  const staticItems = isIotToolbar
    ? staticIotItems
    : showDownload
    ? staticReadOnlyItems
    : staticDefaultItems;

  const items: ToolbarItemDictionary = {
    ...staticItems,
    [ToolbarItemIds.OpenSerialMonitor]: serialMonitorNode,
  };
  if (
    useChromeOsDeviceAssociation &&
    !isDeviceReadOnly &&
    (!isIotToolbar || (isIotToolbar && selectedFqbn))
  ) {
    items[ToolbarItemIds.AssociationNode] = chromeOsAssociationNode;
  }
  // The ChromeOS selector always opens detection, so a read-only device uses the default button.
  if ((!useChromeOsDeviceAssociation || isDeviceReadOnly) && selectedFqbn) {
    items[ToolbarItemIds.AssociationNode] = defaultAssociationNode;
  }
  if (isDeviceReadOnly && !selectedFqbn && !isIotToolbar) {
    items[ToolbarItemIds.AssociationNode] = (): JSX.Element => (
      <div
        id="association-node"
        key={ToolbarItemIds.AssociationNode}
        className={clsx(
          styles['association-node-container'],
          styles['association-node-read-only-label'],
          !canUploadSketch && styles['association-node-flush'],
        )}
      >
        <Small>{formatMessage(messages.noDeviceSelected)}</Small>
      </div>
    );
  }

  const getBusyState = (): ToolbarBusyState | undefined => {
    if (isVerifying || (isUploading.value && isUploading.phase === 'verify'))
      return ToolbarBusyState.Verifying;

    if (isCreating) return ToolbarBusyState.Creating;
    if (isPending) return ToolbarBusyState.Pending;
    if (isUploading.value) return ToolbarBusyState.Uploading;

    return undefined;
  };

  const busyState = getBusyState();

  let toolbarCommandsState = ToolbarCommandsState.canVerifyAndUpload;
  if (!canVerify && !canUploadValue) {
    toolbarCommandsState = ToolbarCommandsState.cannotVerifyOrUpload;
  } else if (!canVerify) {
    toolbarCommandsState = ToolbarCommandsState.cannotVerify;
  } else if (!canUploadValue) {
    toolbarCommandsState = ToolbarCommandsState.cannotUpload;
  } else if (isIotSketch && selectedPort === IotPortName.Offline) {
    toolbarCommandsState = ToolbarCommandsState.canProgramIot;
  }

  const renderUploadUnavailablePopover = (): JSX.Element | null => {
    return canUpload.value ||
      canUpload.reason ===
        ToolbarActionBlockingReasons.LoadingUserRestrictions ||
      !canUpload.popover ? null : (
      <div
        className={styles['upload-info-popover-container']}
        key={'toolbar-no-upload-popover'}
        role="tooltip"
      >
        <div className={clsx(styles['upload-info-popover'])}>
          <Small bold={true}>{formatMessage(canUpload.popover.title)}</Small>
          {!canUpload.popover.messageBold ? (
            <XSmall>{formatMessage(canUpload.popover.message)}</XSmall>
          ) : (
            <XSmall>
              {formatMessage(canUpload.popover.message, {
                messageBold: (
                  <XSmall bold>
                    {formatMessage(canUpload.popover.messageBold)}
                  </XSmall>
                ),
              })}
            </XSmall>
          )}
          {canUpload.popover.link ? (
            <Link
              href={canUpload.popover.link.url}
              target="_blank"
              rel="noreferrer"
              flavour={styles['upload-info-popover-link']}
            >
              {formatMessage(canUpload.popover.link.label)}
            </Link>
          ) : null}
        </div>
      </div>
    );
  };

  const intersectionRef = useRef(null);
  const intersection = useIntersection(intersectionRef, {
    root: null,
    rootMargin: '0px',
    threshold: 1,
  });
  const prevIntersection = usePrevious(intersection);

  useEffect(() => {
    if (!intersection || !prevIntersection) return;

    const hidden = intersection.intersectionRatio < 1;
    const prevSeen = !(prevIntersection.intersectionRatio < 1);
    if (hidden && prevSeen) {
      markDevicesAsSeen();
    }
  }, [intersection, markDevicesAsSeen, prevIntersection]);

  return (
    <div className={styles.toolbar}>
      <div
        id="verify-and-upload"
        className={styles['toolbar-buttons-container']}
      >
        {Object.keys(items)
          .filter(
            (
              itemId,
            ): itemId is
              | ToolbarItemIds.UploadButton
              | ToolbarItemIds.VerifyButton
              | ToolbarItemIds.CreatingButton
              | ToolbarItemIds.PendingButton =>
              (itemId === ToolbarItemIds.UploadButton && canUploadSketch) ||
              itemId === ToolbarItemIds.PendingButton ||
              itemId === ToolbarItemIds.CreatingButton ||
              (itemId === ToolbarItemIds.VerifyButton && canUploadSketch),
          )
          .map((itemId) => {
            const id = itemId;

            if (id === ToolbarItemIds.UploadButton && !canUpload.value) {
              return items[id](
                formatMessage,
                clickHandlers[id],
                busyState,
                toolbarCommandsState,
                renderUploadUnavailablePopover,
              );
            }

            if (id === ToolbarItemIds.CreatingButton) {
              return items[id](formatMessage, busyState);
            }

            if (id === ToolbarItemIds.PendingButton) {
              return items[id](
                formatMessage,
                clickHandlers[id],
                busyState,
                toolbarCommandsState,
              );
            }

            return items[id](
              formatMessage,
              clickHandlers[id],
              busyState,
              toolbarCommandsState,
            );
          })}
      </div>

      {Object.keys(items)
        .filter(
          (
            itemId,
          ): itemId is Exclude<
            ToolbarItemIds,
            | ToolbarItemIds.UploadButton
            | ToolbarItemIds.VerifyButton
            | ToolbarItemIds.CreatingButton
            | ToolbarItemIds.PendingButton
          > =>
            itemId !== ToolbarItemIds.VerifyButton &&
            itemId !== ToolbarItemIds.UploadButton &&
            itemId !== ToolbarItemIds.CreatingButton &&
            itemId !== ToolbarItemIds.PendingButton,
        )
        .map((itemId) => {
          const id = itemId;

          if (id === ToolbarItemIds.OpenSerialMonitor) {
            return items[id](clickHandlers[id]);
          }

          if (id === ToolbarItemIds.AssociationNode) {
            return items[id](
              formatMessage,
              clickHandlers[id],
              disableBoardBubbleBadge
                ? 0
                : (devicesDataToRender.totalCount as number),
              undefined,
            );
          }

          if (id === ToolbarItemIds.OpenFlavourConfig) {
            return canUploadSketch &&
              selectedFqbn &&
              Object.keys(parseArduinoFqbn(selectedFqbn).config).length > 0
              ? items[id](formatMessage, clickHandlers[id])
              : null;
          }

          if (id === ToolbarItemIds.ShareSketch) {
            return items[id](shareSketchLogic, shareToClassroomLogic);
          }

          if (
            id === ToolbarItemIds.DownloadSketch &&
            (isIotComponent || showDownload)
          ) {
            return items[id](formatMessage, clickHandlers[id]);
          }
        })}

      {notificationElement && (
        <>
          <div className={styles.divider} />
          {notificationElement}
        </>
      )}
    </div>
  );
};

export default Toolbar;
