import { Config } from '@cloud-editor-mono/common';
import { EndpointStatus, isPlayStoreApp } from '@cloud-editor-mono/domain';
import {
  DetectedDevices,
  IotPortName,
  ToolbarActionBlockingReasons,
  ToolbarLogic,
  UnpopulatedToolbarDevicesData,
} from '@cloud-editor-mono/ui-components';
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { IUseNetworkState } from 'react-use/lib/useNetworkState';

import { SerialCommunicationContext } from '../../../common/providers/serial-communication/serialCommunicationContext';
import { messages as endpointsStatusMessages } from '../main/hooks/endpointsStatus';
import { messages as networkStatusMessages } from '../main/hooks/networkStatus';
import { messages } from '../main/messages';

type CannotUploadObj = Extract<
  ReturnType<ToolbarLogic>['canUpload'],
  { value: false }
>;

export const getCanUploadObj = function (
  sketchDataIncompleteForCommands: boolean,
  thingDeviceNotFound: boolean,
  shouldCheckForOngoingOta: boolean,
  network: IUseNetworkState,
  builderStatus?: EndpointStatus,
  agentStatus?: EndpointStatus,
  selectedPort?: string,
  compileLimitExceeded?: boolean,
  isBlockedOta?: boolean,
  otaNotSupported?: boolean,
  forceDisableUpload?: boolean,
): ReturnType<ToolbarLogic>['canUpload'] {
  const agentIsAliveOrSelectionIsIot =
    agentStatus !== EndpointStatus.Down ||
    (agentStatus === EndpointStatus.Down &&
      selectedPort === IotPortName.Online);

  const canUploadValue = Boolean(
    !sketchDataIncompleteForCommands &&
      !thingDeviceNotFound &&
      !shouldCheckForOngoingOta &&
      compileLimitExceeded === false &&
      builderStatus !== EndpointStatus.Down &&
      agentIsAliveOrSelectionIsIot &&
      network.online &&
      selectedPort &&
      selectedPort !== IotPortName.Offline &&
      !isBlockedOta &&
      !otaNotSupported &&
      !forceDisableUpload,
  );

  const canUpload: ReturnType<ToolbarLogic>['canUpload'] = canUploadValue
    ? {
        value: true,
      }
    : buildCannotUploadObj(
        sketchDataIncompleteForCommands,
        thingDeviceNotFound,
        shouldCheckForOngoingOta,
        network,
        builderStatus,
        agentStatus,
        selectedPort,
        compileLimitExceeded,
        isBlockedOta,
        otaNotSupported,
        forceDisableUpload,
      );

  return canUpload;
};

const buildCannotUploadObj = (
  sketchDataIncompleteForCommands: boolean,
  thingDeviceNotFound: boolean,
  shouldCheckForOngoingOta: boolean,
  network: IUseNetworkState,
  builderStatus?: EndpointStatus,
  agentStatus?: EndpointStatus,
  selectedPort?: string,
  compileLimitExceeded?: boolean,
  isBlockedOta?: boolean,
  otaNotSupported?: boolean,
  forceDisableUpload?: boolean,
): CannotUploadObj => {
  let reason = ToolbarActionBlockingReasons.MissingInfo;

  const builderDown = builderStatus === EndpointStatus.Down;
  const agentDown = agentStatus === EndpointStatus.Down;
  const builderAndAgentDown = builderDown && agentDown;

  if (!network.online) {
    reason = ToolbarActionBlockingReasons.NoNetwork;
  } else if (thingDeviceNotFound) {
    reason = ToolbarActionBlockingReasons.IoTDeviceNotFound;
  } else if (shouldCheckForOngoingOta) {
    reason = ToolbarActionBlockingReasons.OTAInProgressUnknown;
  } else if (sketchDataIncompleteForCommands) {
    reason = ToolbarActionBlockingReasons.sketchDataIncompleteForCommands;
  } else if (otaNotSupported) {
    reason = ToolbarActionBlockingReasons.OtaIncompatible;
  } else if (compileLimitExceeded || compileLimitExceeded === undefined) {
    reason = compileLimitExceeded
      ? ToolbarActionBlockingReasons.CompileLimitExceeded
      : ToolbarActionBlockingReasons.LoadingUserRestrictions;
  } else if (isBlockedOta) {
    reason = ToolbarActionBlockingReasons.BlockedOta;
  } else if (builderAndAgentDown) {
    reason = ToolbarActionBlockingReasons.VerifyAndUploadBackendsDown;
  } else if (builderDown) {
    reason = ToolbarActionBlockingReasons.VerifyBackendDown;
  } else if (agentDown) {
    reason = ToolbarActionBlockingReasons.UploadBackendDown;
  } else if (selectedPort === IotPortName.Offline) {
    reason = ToolbarActionBlockingReasons.Offline;
  } else if (forceDisableUpload) {
    reason = ToolbarActionBlockingReasons.PortBusy;
  }

  const popover =
    reason === ToolbarActionBlockingReasons.LoadingUserRestrictions
      ? undefined
      : popoverDataMap[reason];

  return {
    value: false,
    reason,
    popover,
  };
};

const genericPopoverData = {
  title: messages.uploadNotAvailableAdvisoryTitle,
  message: endpointsStatusMessages.noBuilderAdvisory,
  ...(!isPlayStoreApp() && {
    link: {
      url: Config.ARDUINO_STATUS_URL,
      label: endpointsStatusMessages.checkStatus,
    },
  }),
};

const popoverDataMap: Record<
  Exclude<
    ToolbarActionBlockingReasons,
    ToolbarActionBlockingReasons.LoadingUserRestrictions
  >,
  CannotUploadObj['popover']
> = {
  [ToolbarActionBlockingReasons.NoNetwork]: {
    title: messages.uploadNotAvailableAdvisoryTitle,
    message: networkStatusMessages.noNetworkAdvisory,
  },
  [ToolbarActionBlockingReasons.CompileLimitExceeded]: {
    title: messages.compileLimitExceededAdvisoryTitle,
    message: !isPlayStoreApp()
      ? messages.compileLimitExceededAdvisory
      : messages.compileLimitExceededAdvisoryWOUpgrade,
    messageBold: messages.compileLimitExceededAdvisoryBold,
    ...(!isPlayStoreApp() && {
      link: {
        url: Config.DIGITAL_STORE_URL,
        label: messages.compileLimitExceededUpgrade,
      },
    }),
  },
  [ToolbarActionBlockingReasons.UploadBackendDown]: {
    title: messages.noAgentAdvisoryTitle,
    message: messages.noAgentAdvisoryMessage,
    ...(!isPlayStoreApp() && {
      link: {
        url: Config.ARDUINO_SUPPORT_AGENT_URL,
        label: endpointsStatusMessages.learnMore,
      },
    }),
  },
  [ToolbarActionBlockingReasons.MissingInfo]: {
    title: messages.noDeviceAdvisoryTitle,
    message: messages.noDeviceAdvisoryMessage,
  },
  [ToolbarActionBlockingReasons.VerifyBackendDown]: genericPopoverData,
  [ToolbarActionBlockingReasons.VerifyAndUploadBackendsDown]:
    genericPopoverData,
  [ToolbarActionBlockingReasons.Offline]: {
    title: messages.portOfflineAdvisoryTitle,
    message: messages.portOfflineAdvisoryMessage,
  },
  [ToolbarActionBlockingReasons.MissingIotDeviceInfo]: {
    title: messages.portOfflineAdvisoryTitle,
    message: messages.portOfflineAdvisoryMessage,
  },
  [ToolbarActionBlockingReasons.sketchDataIncompleteForCommands]: {
    title: messages.sketchDataNotCompliantAdvisoryTitle,
    message: messages.sketchDataNotCompliantAdvisoryMessage,
    ...(!isPlayStoreApp() && {
      link: {
        url: Config.SKETCH_SPEC_URL,
        label: messages.sketchDataNotCompliantReferenceLink,
      },
    }),
  },
  [ToolbarActionBlockingReasons.BlockedOta]: {
    title: messages.otaBlockedAdvisoryTitle,
    message: !isPlayStoreApp()
      ? messages.otaBlockedAdvisoryMessage
      : messages.otaBlockedAdvisoryMessageWOPlan,
    ...(!isPlayStoreApp() && {
      link: {
        url: Config.DIGITAL_STORE_URL,
        label: messages.compileLimitExceededUpgrade,
      },
    }),
  },
  [ToolbarActionBlockingReasons.OtaIncompatible]: {
    title: messages.otaIncompatibleTitle,
    message: messages.otaIncompatibleMessage,
  },
  [ToolbarActionBlockingReasons.PortBusy]: {
    title: messages.portBusyAdvisoryTitle,
    message: messages.portBusyAdvisoryMessage,
  },
  [ToolbarActionBlockingReasons.IoTDeviceNotFound]: {
    title: messages.noDeviceAssociatedTitle,
    message: messages.noDeviceAssociated,
  },
  [ToolbarActionBlockingReasons.OTAInProgressUnknown]: {
    title: messages.couldNotCheckOtaTitle,
    message: messages.couldNotCheckOta,
  },
};

const ZERO_DEVICES_DATA: UnpopulatedToolbarDevicesData = { totalCount: 0 };
export const useToolbarDevicesData = function (
  detectedDevices: DetectedDevices,
  onlineIotDevices?: DetectedDevices,
  deviceAssociationDialogIsOpen?: boolean,
): {
  toolbarDevicesData: ReturnType<ToolbarLogic>['devices'];
  setSeenToolbarDevices: (ids: string[]) => void;
} {
  const { uploadIsUploading } = useContext(SerialCommunicationContext);
  const ignoreDevices = useRef(false);

  const [devicesData, setDevicesData] =
    useState<ReturnType<ToolbarLogic>['devices']>(ZERO_DEVICES_DATA);
  const [seenDevices, setSeenDevices] = useState<string[]>([]);

  const deviceIdsMemo = useMemo(() => {
    return (
      onlineIotDevices
        ? [...detectedDevices, ...onlineIotDevices]
        : detectedDevices
    ).map((d) => d.portBoardId);
  }, [detectedDevices, onlineIotDevices]);

  useEffect(() => {
    setSeenDevices((prev) => {
      return prev.some((s) => !deviceIdsMemo.includes(s))
        ? prev.filter((s) => deviceIdsMemo.includes(s))
        : prev;
    }); // REMOVE DEVICES NO LONGER DETECTED FROM SEEN
  }, [deviceIdsMemo, uploadIsUploading]);

  useEffect(() => {
    let data: ReturnType<ToolbarLogic>['devices'] = ZERO_DEVICES_DATA;

    if (uploadIsUploading) {
      ignoreDevices.current = true;
      setDevicesData(data);
      return;
    }

    if (ignoreDevices.current) {
      setTimeout(() => {
        ignoreDevices.current = false;
      }, 3000);
      setDevicesData(data);
      return;
    }

    const seen = seenDevices;

    let deviceIds = deviceIdsMemo;

    if (deviceIds.length > 0) {
      if (seen.length > 0) {
        // USER SAW PREV DETECTED DEVICES
        deviceIds = deviceIds.filter((id) => !seen.includes(id)); // REMOVE DEVICES SEEN
      }

      if (deviceIds.length === 0) {
        setDevicesData(data);
        return;
      }

      data = {
        totalCount: deviceIds.length,
        ids: deviceIds,
      };
    }

    setDevicesData(data);
  }, [deviceIdsMemo, seenDevices, uploadIsUploading]);

  useEffect(() => {
    if (deviceAssociationDialogIsOpen) {
      setSeenDevices(deviceIdsMemo);
    }
  }, [deviceAssociationDialogIsOpen, deviceIdsMemo]);

  const setDevicesSeen = useCallback((ids: string[]) => {
    setSeenDevices(ids);
  }, []);

  return {
    toolbarDevicesData: devicesData,
    setSeenToolbarDevices: setDevicesSeen,
  };
};
