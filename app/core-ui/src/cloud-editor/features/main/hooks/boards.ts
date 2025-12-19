import { parseArduinoFqbn } from '@cloud-editor-mono/common';
import {
  BoardFlavourOptions,
  createFlavourString,
  ga4Emitter,
  isChromeOs,
  MappedPort,
} from '@cloud-editor-mono/domain';
import {
  GetBoardByFqbn_Response,
  SketchData,
} from '@cloud-editor-mono/infrastructure';
import {
  DetectedDevice,
  DetectedDevicesGroup,
  IotDevicesGroups,
  IotPortName,
  Preferences,
} from '@cloud-editor-mono/ui-components';
import {
  WebSerialBoard,
  webSerialState,
  WebSerialStateKeys,
} from '@cloud-editor-mono/web-board-communication';
import { useQueryClient } from '@tanstack/react-query';
import { uniqueId } from 'lodash';
import {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { IntlContext } from 'react-intl';
import { usePreviousDistinct } from 'react-use';

import { usePreferenceObservable } from '../../../../common/hooks/preferences';
import {
  useGetBoardByFqbn,
  useGetBoardsList,
} from '../../../../common/hooks/queries/builder';
import { useAssociateSketchToDevice } from '../../../../common/hooks/queries/create';
import { ShowThingV1Device_ResponseWithArchAndOriginalName } from '../../../../common/hooks/queries/iot';
import { useObservable } from '../../../../common/hooks/useObservable';
import {
  MappedPorts,
  SerialCommunicationContext,
} from '../../../../common/providers/serial-communication/serialCommunicationContext';
import {
  DeviceAssociationPrompts,
  DialogDataDictionary,
  DialogId,
} from '../../dialog-switch';
import {
  AltDevicePortBoardId,
  UseBoardsConfig,
  UseGetDevicesList,
} from '../main.type';
import {
  getPortSelectionChangesSubject,
  getPrevSelectedPort,
  getSelectedPort,
  portSelectionNext,
  portSelectionReset,
  resetPortSelectionSubjects,
} from '../portSelection.reactive';
import { useSketchParams } from './sketch';
import {
  ARDUINO_PACKAGER,
  ARDUINO_UNSTABLE_SERIAL_NUMBER_BOARDS,
  THIRD_PARTY_STABLE_SERIAL_NUMBER_BOARDS,
} from './utils';

type BypassAutoSelectionReason = { id: string } & (
  | {
      type: 'metadata-cleared';
      meta: string;
    }
  | {
      type: 'metadata-changed';
    }
  | {
      type: 'generic';
    }
);

export const useBoardsConfig: UseBoardsConfig = function (
  isExampleSketchRoute: boolean,
  isCreatingExampleCopy: boolean,
  modifySketchData: (newData: Partial<SketchData>) => void,
  promptBoardConfigSelection: (
    data?: DialogDataDictionary[DialogId.DeviceAssociation],
  ) => void,
  sketchId: string | null,
  initialFqbn: string | null,
  initialBoard: string | null,
  initialArchitecture: string | null,
  initialBoardType: string | null,
  isIotSketch: boolean,
  initialIotDeviceId?: string | null,
  iotDevicesGroups?: IotDevicesGroups,
): ReturnType<UseBoardsConfig> {
  const bypassAutoSelectionQuota = useRef<BypassAutoSelectionReason[]>([]);
  const waitingForUploadCompletion = useRef(false); // ** completion is upload finish + 3 seconds
  const bypassUSBPreferenceOverOTA = useRef(false);

  const {
    mappedPorts,
    updatePortInfo,
    updatedPorts,
    clearUpdatedPortInfo,
    busyPorts,
    detectBoards,
    uploadIsUploading,
    forceUpdate: forceUpdateSerialCommCtx,
  } = useContext(SerialCommunicationContext);
  const boardAutoSelection = Boolean(
    usePreferenceObservable(Preferences.BoardAutoSelection),
  );

  const { formatMessage } = useContext(IntlContext);

  // ! `usePreviousDistinct` sets a ref during render: these could get out of sync if we use concurrent mode features
  // ** the "prev refs" below are not used until metadata has loaded
  // ** this keeps it "in sync" with the agent auto-selection logic
  // ** that should consider data changes that occur after metadata has loaded
  const metadataIsLoading =
    initialFqbn === null ||
    initialBoard === null ||
    initialArchitecture === null ||
    initialBoardType === null;
  const shouldNotRecordPrevPortData =
    !isExampleSketchRoute && metadataIsLoading;
  const prevMappedPortsLength = usePreviousDistinct(
    shouldNotRecordPrevPortData ? 0 : mappedPorts?.length || 0,
  );
  const prevMappedPortIds = usePreviousDistinct(
    shouldNotRecordPrevPortData
      ? ''
      : mappedPorts
          ?.map((p) => p.portBoardId)
          .sort()
          .join('|') || '',
  );

  const [selectedPortBoardId, setSelectedPortBoardId] = useState<
    string | undefined
  >();

  const [selectedFqbn, setSelectedFqbn] = useState<string | undefined>(
    initialFqbn || undefined,
  );
  const [selectedBoard, setSelectedBoard] = useState<string | undefined>(
    initialBoard || undefined,
  );
  const [selectedArchitecture, setSelectedArchitecture] = useState<
    string | undefined
  >(initialArchitecture || undefined);

  const [includesUnknownBoard, setIncludesUnknownBoard] = useState(false);
  const [unknownBoardPortBoardIds, setUnknownBoardPortBoardIds] = useState<
    string[]
  >([]);

  const [manyBoardsMatchMetadata, setManyBoardsMatchMetadata] = useState(false);

  const [selectedDeviceAltPortBoardId, setSelectedDeviceAltPortBoardId] =
    useState<AltDevicePortBoardId>();

  const [selectedIotDeviceId, setSelectedIotDeviceId] = useState<string>();

  const [selectedBoardIsIot, setSelectedBoardIsIot] = useState(
    initialBoardType === 'cloud',
  );

  const [updatedNames, setUpdatedNames] = useState<{ [key: string]: string }>(
    {},
  );

  const [selectedBoardFlavourOptions, setSelectedBoardFlavourOptions] =
    useState<
      | BoardFlavourOptions
      | null // no flavour
      | undefined // flavour not loaded
    >(undefined);
  const [selectedFlavourString, setSelectedFlavourString] = useState<
    string | undefined | null
  >();

  const [chosenWebSerialBoard, setChosenWebSerialBoard] =
    useState<WebSerialBoard | null>(null);

  const [webSerialSupportedFqbns, setWebSerialSupportedFqbns] = useState<
    string[]
  >([]);

  const { board: selectedBoardData } = useGetBoardByFqbn(
    Boolean(selectedBoard),
    selectedFqbn && parseArduinoFqbn(selectedFqbn).baseFqbn,
  );

  const { mutateSketchWithDevice, isLoading: mutateSketchWithDeviceIsLoading } =
    useAssociateSketchToDevice();

  const clearSelection = useCallback((): void => {
    if (selectedPortBoardId && includesUnknownBoard) {
      clearUpdatedPortInfo(selectedPortBoardId);
    }

    if (
      !isIotSketch &&
      initialFqbn &&
      selectedFqbn &&
      parseArduinoFqbn(selectedFqbn).baseFqbn ===
        parseArduinoFqbn(initialFqbn).baseFqbn && // ONLY CLEAR METADATA IF THE ASSOCIATED DEVICE WAS DETACHED
      sketchId &&
      !mutateSketchWithDeviceIsLoading
    ) {
      bypassAutoSelectionQuota.current = [
        ...bypassAutoSelectionQuota.current,
        { id: uniqueId(), type: 'metadata-cleared', meta: initialFqbn },
      ];
      modifySketchData({
        fqbn: '',
        boardName: '',
        boardType: 'serial',
      });
      mutateSketchWithDevice({
        id: sketchId,
        board_fqbn: '',
        board_name: '',
        board_type: 'serial',
      });
    }

    setIncludesUnknownBoard(false);

    setSelectedPortBoardId(undefined);
    setSelectedBoard(undefined);
    setSelectedArchitecture(undefined);
    setSelectedFqbn(undefined);
    portSelectionNext(undefined);

    setSelectedBoardIsIot(false);
  }, [
    clearUpdatedPortInfo,
    includesUnknownBoard,
    initialFqbn,
    sketchId,
    isIotSketch,
    modifySketchData,
    mutateSketchWithDevice,
    mutateSketchWithDeviceIsLoading,
    selectedFqbn,
    selectedPortBoardId,
  ]);

  const setDetectedBoardAndPort = useCallback(
    (portBoardId: string, isIot?: boolean, keepFlavours?: boolean) => {
      if (!portBoardId) {
        clearSelection();
        return;
      }

      if (iotDevicesGroups && isIot) {
        const findByPortBoardId = (d: DetectedDevice): boolean =>
          d.portBoardId === portBoardId;

        const onlineDevice =
          iotDevicesGroups[DetectedDevicesGroup.Online].find(findByPortBoardId);
        const offlineDevice =
          iotDevicesGroups[DetectedDevicesGroup.Offline].find(
            findByPortBoardId,
          );
        const deviceFound = onlineDevice || offlineDevice;

        if (deviceFound) {
          const { id, fqbn, name, portName, architecture } = deviceFound;
          setSelectedPortBoardId(portBoardId);
          setSelectedBoard(name);
          setSelectedFqbn(
            keepFlavours && fqbn && selectedFlavourString
              ? fqbn + selectedFlavourString
              : fqbn,
          );
          setSelectedArchitecture(architecture);
          portSelectionNext(portName);
          setSelectedIotDeviceId(id);
          setSelectedBoardIsIot(true);

          emitBoardChangeEvent(sketchId || '', name, fqbn);
        }

        return;
      }

      if (mappedPorts && mappedPorts.length > 0) {
        const item = mappedPorts.find((port) => {
          return port.portBoardId === portBoardId;
        });

        if (item) {
          setIncludesUnknownBoard(
            unknownBoardPortBoardIds.includes(item.portBoardId),
          );

          const propagateFlavours =
            keepFlavours ||
            (selectedFqbn &&
              parseArduinoFqbn(selectedFqbn).baseFqbn === item.fqbn);

          setSelectedPortBoardId(item.portBoardId);
          setSelectedBoard(item.name);
          setSelectedFqbn(
            propagateFlavours && item.fqbn && selectedFlavourString
              ? item.fqbn + selectedFlavourString
              : item.fqbn,
          );
          setSelectedArchitecture(item.architecture);
          portSelectionNext(item.portName);
          setSelectedBoardIsIot(false);

          emitBoardChangeEvent(sketchId || '', item.name, item.fqbn);
        }
      }
    },
    [
      iotDevicesGroups,
      mappedPorts,
      clearSelection,
      selectedFlavourString,
      sketchId,
      unknownBoardPortBoardIds,
      selectedFqbn,
    ],
  );

  const changeAssociatedBoard = useCallback(
    (data: { fqbn: string; name: string; architecture: string }) => {
      if (selectedPortBoardId) {
        clearUpdatedPortInfo(selectedPortBoardId);
      }

      setSelectedFqbn(data.fqbn);
      setSelectedBoard(data.name);
      setSelectedArchitecture(data.architecture);
      setSelectedIotDeviceId(undefined);
      setSelectedDeviceAltPortBoardId(undefined);
      setSelectedBoardFlavourOptions(undefined);
      resetPortSelectionSubjects();
      setSelectedPortBoardId(undefined);
      setSelectedBoardIsIot(true);
    },
    [clearUpdatedPortInfo, selectedPortBoardId],
  );

  const switchToAltPort = useCallback((): void => {
    if (!selectedDeviceAltPortBoardId) return;

    bypassUSBPreferenceOverOTA.current = true;

    const { id, isIot } = selectedDeviceAltPortBoardId;

    setDetectedBoardAndPort(id, isIot, true);
  }, [selectedDeviceAltPortBoardId, setDetectedBoardAndPort]);

  const setDetectedUnknownBoard = useCallback(
    (
      portBoardId: string,
      fqbn: string,
      name: string,
      architecture: string,
      port: string,
    ): void => {
      updatePortInfo(portBoardId, { fqbn, name, isUnknownBoard: false });

      setIncludesUnknownBoard(true);
      setUnknownBoardPortBoardIds((prev) => [...prev, portBoardId]);

      setSelectedPortBoardId(portBoardId);
      setSelectedBoard(name);
      setSelectedFqbn(
        selectedFqbn &&
          selectedFlavourString &&
          parseArduinoFqbn(selectedFqbn).baseFqbn === fqbn
          ? fqbn + selectedFlavourString
          : fqbn,
      );
      setSelectedArchitecture(architecture);

      portSelectionNext(port);
      emitBoardChangeEvent(sketchId || '', name, fqbn);
    },
    [selectedFlavourString, selectedFqbn, sketchId, updatePortInfo],
  );

  const setUndetectedBoard = useCallback(
    (fqbn: string, name: string, architecture: string): void => {
      if (!fqbn || !name || !architecture) {
        if (!getSelectedPort()) {
          // IS DETACH OF MANUAL SELECTION
          bypassAutoSelectionQuota.current = [
            ...bypassAutoSelectionQuota.current,
            { id: uniqueId(), type: 'metadata-changed' },
          ];
        }

        clearSelection();
        return;
      }

      bypassAutoSelectionQuota.current = [
        ...bypassAutoSelectionQuota.current,
        { id: uniqueId(), type: 'metadata-changed' },
      ];

      setSelectedFqbn(fqbn);
      setSelectedBoard(name);
      setSelectedArchitecture(architecture);

      setIncludesUnknownBoard(false);

      setSelectedPortBoardId(undefined);

      setSelectedBoardIsIot(false);

      portSelectionNext(undefined);
      emitBoardChangeEvent(sketchId || '', name, fqbn);
    },
    [clearSelection, sketchId],
  );

  const selectFlavourOptionById = useCallback(
    (optionId: string, valueId: string): void => {
      if (!selectedBoardFlavourOptions) return;

      const newFlavourOptions = selectedBoardFlavourOptions.map((menu) => {
        if (menu.id === optionId) {
          return {
            ...menu,
            variants: menu.variants.map((variant) => {
              return {
                ...variant,
                selected: variant.id === valueId,
              };
            }),
          };
        }

        return menu;
      });

      setSelectedBoardFlavourOptions(newFlavourOptions);
    },
    [selectedBoardFlavourOptions],
  );

  const addGenericBypassAutoSelection = useCallback((): string => {
    const id = uniqueId();
    bypassAutoSelectionQuota.current = [
      ...bypassAutoSelectionQuota.current,
      { id, type: 'generic' },
    ];
    return id;
  }, []);

  const removeGenericBypassAutoSelection = useCallback((id: string): void => {
    bypassAutoSelectionQuota.current = bypassAutoSelectionQuota.current.filter(
      (bypass) => bypass.id !== id,
    );
  }, []);

  const setWebSerialBoardMappedPort = useCallback(() => {
    const boardPort =
      chosenWebSerialBoard &&
      findWebSerialBoardPort(chosenWebSerialBoard, mappedPorts);

    if (boardPort) {
      setSelectedFqbn(boardPort.fqbn);
      setSelectedBoard(boardPort.name);
      setSelectedArchitecture(boardPort.architecture);
      setSelectedPortBoardId(boardPort.portBoardId);
      portSelectionNext(boardPort.portName);
      setSelectedBoardIsIot(false);

      emitBoardChangeEvent(sketchId || '', boardPort.name, boardPort.fqbn);
    }
  }, [chosenWebSerialBoard, mappedPorts, sketchId]);

  const requestWebSerialBoardDetection = useCallback(async () => {
    const chosenBoard = await detectBoards();

    setChosenWebSerialBoard(chosenBoard);
  }, [detectBoards]);

  // create flavour options and mark selected items
  useEffect(() => {
    if (!selectedBoard || !selectedBoardData) {
      setSelectedArchitecture(undefined);
      setSelectedBoardFlavourOptions(undefined);
      return;
    }

    if (selectedBoardData.architecture) {
      setSelectedArchitecture(selectedBoardData.architecture);
    }

    if (!selectedBoardData.menus || selectedBoardData.menus.length === 0) {
      setSelectedBoardFlavourOptions(null);
      return;
    }

    const selectedFqbnConfig =
      initialFqbn && parseArduinoFqbn(initialFqbn).config;

    const menus: BoardFlavourOptions = selectedBoardData.menus
      .filter((m) => m.variants.length > 0)
      .map((m) => {
        const fqbnConfigItemValue =
          selectedFqbnConfig && selectedFqbnConfig?.[m.id];

        return {
          ...m,
          variants: m.variants.map((v, index) => ({
            ...v,
            selected: fqbnConfigItemValue
              ? v.id === fqbnConfigItemValue
              : index === 0,
          })),
        };
      });

    setSelectedBoardFlavourOptions(menus.length > 0 ? menus : null);
  }, [initialFqbn, selectedBoard, selectedBoardData]);

  // create `selectedFlavorString` when `selectedBoardFlavourOptions` change
  // and append it to selectedFqbn
  useEffect(() => {
    if (!selectedBoardFlavourOptions) {
      setSelectedFlavourString(selectedBoardFlavourOptions);
      setSelectedFqbn((prev) => {
        if (!prev) return prev;

        return parseArduinoFqbn(prev).baseFqbn;
      });
      return;
    }

    const flavourString = createFlavourString(selectedBoardFlavourOptions);
    setSelectedFlavourString(flavourString);
    setSelectedFqbn((prev) => {
      if (!prev) return prev;

      const enrichedFqbn = `${parseArduinoFqbn(prev).baseFqbn}${
        flavourString || ''
      }`;

      return enrichedFqbn;
    });
  }, [selectedBoardFlavourOptions]);

  useEffect(() => {
    setSelectedFqbn((prev) => {
      if (!prev) {
        setSelectedBoardIsIot(initialBoardType === 'cloud');
        return initialFqbn || undefined;
      }
      return prev;
    });
  }, [initialBoardType, initialFqbn]);

  useEffect(() => {
    setSelectedBoard((prev) => {
      if (
        !prev ||
        (initialIotDeviceId &&
          selectedIotDeviceId &&
          initialIotDeviceId === selectedIotDeviceId)
      ) {
        return initialBoard || undefined;
      }

      return prev;
    });

    setSelectedArchitecture((prev) => {
      if (!prev) {
        return initialArchitecture || undefined;
      }

      return prev;
    });
  }, [
    initialArchitecture,
    initialBoard,
    initialIotDeviceId,
    selectedIotDeviceId,
  ]);

  const queryClient = useQueryClient();

  // ** track upload status, so that from start to finish + 5 seconds
  // ** we can avoid auto-selection, the query invalidation reassigns `mappedPorts`,
  // ** to trigger auto-selection 5 seconds after the upload has finished
  useEffect(() => {
    if (uploadIsUploading) {
      waitingForUploadCompletion.current = true;

      return;
    }

    if (waitingForUploadCompletion.current) {
      // after 3 seconds clear uploadPending
      setTimeout(() => {
        waitingForUploadCompletion.current = false;
        forceUpdateSerialCommCtx({});
      }, 3000);

      return;
    }
  }, [forceUpdateSerialCommCtx, queryClient, uploadIsUploading]);

  // Agent Ports auto-selection logic
  useEffect(() => {
    if (isChromeOs) {
      return;
    }

    if (waitingForUploadCompletion.current) return;

    const metadataIsLoading =
      initialFqbn === null ||
      initialBoard === null ||
      initialArchitecture === null ||
      initialBoardType === null;
    if (
      (!isExampleSketchRoute && metadataIsLoading) ||
      (isExampleSketchRoute && isCreatingExampleCopy) ||
      !mappedPorts || // NO DETECTED DEVICES
      getSelectedPort() // USER HAS ALREADY SELECTED A PORT
    )
      return;

    const setMappedPort = (port: MappedPort, fqbn?: string): void => {
      setSelectedFqbn(fqbn || port.fqbn);
      setSelectedBoard(port.name);
      setSelectedArchitecture(port.architecture);
      setSelectedPortBoardId(port.portBoardId);
      portSelectionNext(port.portName);
      setSelectedBoardIsIot(false);

      emitBoardChangeEvent(sketchId || '', port.name, port.fqbn);
    };

    const shouldBypassAutoSelection = (port?: MappedPort): boolean => {
      // useEffect TRIGGERED BY DETACH
      if (!!getPrevSelectedPort() && typeof getSelectedPort() === 'undefined') {
        portSelectionReset();

        return true;
      }

      const clearedMetadataBypass = bypassAutoSelectionQuota.current.find(
        (bypass) =>
          bypass.type === 'metadata-cleared' && initialFqbn !== bypass.meta,
      );

      if (clearedMetadataBypass) {
        bypassAutoSelectionQuota.current =
          bypassAutoSelectionQuota.current.filter(
            (bypass) => bypass.id !== clearedMetadataBypass.id,
          );
        return true;
      }

      if (bypassAutoSelectionQuota.current.length > 0) {
        bypassAutoSelectionQuota.current.pop();
        return true;
      }

      if (
        !boardAutoSelection || // AUTO SELECTION DISABLED
        (port && (!port.fqbn || !port.name)) || // NO FQBN/NAME BUT NOT UNKNOWN
        (!!initialBoardType && initialBoardType === 'cloud') // SKETCH HAS METADATA AND `type` IS `cloud`
      )
        return true;

      return false;
    };

    if (
      initialFqbn &&
      mappedPorts.length > 1 && // DETECTED MANY DEVICES
      mappedPorts.some(
        (mp) => mp.fqbn === parseArduinoFqbn(initialFqbn).baseFqbn,
      ) // A DEVICE / DEVICES MATCH METADATA
    ) {
      if (
        mappedPorts.filter(
          (mp) => mp.fqbn === parseArduinoFqbn(initialFqbn).baseFqbn,
        ).length > 1
      ) {
        setManyBoardsMatchMetadata(true);
      } else {
        const matchingPort = mappedPorts.find(
          (mp) => mp.fqbn === parseArduinoFqbn(initialFqbn).baseFqbn,
        );

        if (
          matchingPort &&
          !prevMappedPortIds?.includes(matchingPort.portBoardId)
        ) {
          if (shouldBypassAutoSelection(matchingPort)) return;
          setMappedPort(matchingPort, initialFqbn);
        }
      }

      return;
    }

    setManyBoardsMatchMetadata(false);

    const devicesDetectedHaveIncreased =
      !prevMappedPortsLength || mappedPorts.length > prevMappedPortsLength;
    if (
      !initialFqbn && // NO METADATA
      mappedPorts.length > 1 && // DETECTED MANY DEVICES
      devicesDetectedHaveIncreased // DETECTED DEVICES HAVE INCREASED
    ) {
      if (shouldBypassAutoSelection()) return;

      promptBoardConfigSelection();

      return;
    }

    if (mappedPorts.length === 1) {
      const mappedPort = mappedPorts[0];

      if (
        !initialFqbn && // NO METADATA
        mappedPort.isUnknownBoard && // ONE UNKNOWN BOARD DETECTED
        !prevMappedPortIds?.includes(mappedPort.portBoardId) // DEVICE NOT ALREADY DETECTED
      ) {
        if (shouldBypassAutoSelection()) return;

        promptBoardConfigSelection({
          prompt: DeviceAssociationPrompts.Identify,
          meta: {
            id: mappedPort.portBoardId,
            portName: mappedPort.portName,
          },
        });

        return;
      }

      if (shouldBypassAutoSelection(mappedPort)) return;

      if (
        initialFqbn &&
        mappedPort.fqbn === parseArduinoFqbn(initialFqbn).baseFqbn && // METADATA MATCHES ONE DETECTED
        (!selectedFqbn || // USER HAS NOT ALREADY SELECTED A BOARD
          parseArduinoFqbn(selectedFqbn).baseFqbn === mappedPort.fqbn) && // USER HAS ALREADY SELECTED A BOARD AND IT MATCHES METADATA
        !prevMappedPortIds?.includes(mappedPort.portBoardId) // DEVICE NOT ALREADY DETECTED
      ) {
        setMappedPort(mappedPort, selectedFqbn);
        return;
      }

      if (
        !initialFqbn && // NO METADATA
        (!selectedFqbn || // USER HAS NOT ALREADY SELECTED A BOARD
          parseArduinoFqbn(selectedFqbn).baseFqbn === mappedPort.fqbn) && // USER HAS ALREADY SELECTED A BOARD AND IT MATCHES `selectedFqbn`
        !prevMappedPortIds?.includes(mappedPort.portBoardId) // DEVICE NOT ALREADY DETECTED
      ) {
        setMappedPort(mappedPort, selectedFqbn);
        return;
      }
    }
    // ** react-hooks/exhaustive-deps disabled to support custom comparator for selectedFqbn
    // ! dependencies need manual review whenever is useEffect is modified
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    boardAutoSelection,
    initialArchitecture,
    initialBoard,
    initialBoardType,
    initialFqbn,
    sketchId,
    isExampleSketchRoute,
    mappedPorts,
    prevMappedPortIds,
    prevMappedPortsLength,
    promptBoardConfigSelection,
    // ** `parseArduinoFqbn(selectedFqbn).baseFqbn` should be observed
    // ** instead of `selectedFqbn`, given a change in flavor string should not trigger
    // ** an auto-selection attempt
    // eslint-disable-next-line react-hooks/exhaustive-deps
    selectedFqbn && parseArduinoFqbn(selectedFqbn).baseFqbn,
    isCreatingExampleCopy,
  ]);

  // Ports disconnection logic
  useEffect(() => {
    if (waitingForUploadCompletion.current) return;

    if (
      !selectedBoardIsIot &&
      mappedPorts &&
      selectedBoard &&
      selectedPortBoardId
    ) {
      const selectedBoardIsDetected = mappedPorts.some((port) => {
        return port.portBoardId === selectedPortBoardId;
      });
      if (!selectedBoardIsDetected) {
        // we don't try to switch to "alt online IoT ports" when
        // a user disconnects, this is dealt with in another useEffect

        if (selectedDeviceAltPortBoardId)
          clearUpdatedPortInfo(selectedPortBoardId);

        const originalName = updatedNames[selectedPortBoardId];
        if (originalName) {
          setSelectedBoard(originalName);
          setUpdatedNames((prev) => {
            const { [selectedPortBoardId]: _, ...rest } = prev; //eslint-disable-line @typescript-eslint/no-unused-vars
            return rest;
          });
        }

        setSelectedPortBoardId(undefined);
        portSelectionNext(undefined);
        setSelectedDeviceAltPortBoardId(undefined);

        return;
      }
    }
  }, [
    mappedPorts,
    selectedPortBoardId,
    selectedBoard,
    selectedBoardIsIot,
    selectedDeviceAltPortBoardId,
    switchToAltPort,
    clearUpdatedPortInfo,
    updatedNames,
  ]);

  // Iot auto-selection logic
  useEffect(() => {
    if (waitingForUploadCompletion.current) return;

    const metadataIsLoading =
      initialFqbn === null ||
      initialBoard === null ||
      initialArchitecture === null ||
      initialBoardType === null;

    if (
      !boardAutoSelection ||
      (!isExampleSketchRoute && metadataIsLoading) ||
      (isExampleSketchRoute && isCreatingExampleCopy) ||
      (getSelectedPort() &&
        getSelectedPort() !== IotPortName.Online &&
        getSelectedPort() !== IotPortName.Offline) ||
      !selectedBoardIsIot ||
      !iotDevicesGroups ||
      (!!initialBoardType && initialBoardType !== 'cloud')
    )
      return;

    const match = [
      ...iotDevicesGroups[DetectedDevicesGroup.Online],
      ...iotDevicesGroups[DetectedDevicesGroup.Offline],
    ].find(
      (d) =>
        selectedFqbn &&
        d.fqbn &&
        parseArduinoFqbn(d.fqbn).baseFqbn ===
          parseArduinoFqbn(selectedFqbn).baseFqbn,
    );

    if (match) {
      setSelectedPortBoardId(match.portBoardId);
      portSelectionNext(match.portName);
      setSelectedIotDeviceId(match.id);
      setSelectedBoardIsIot(true);

      return;
    }

    clearSelection();
  }, [
    boardAutoSelection,
    clearSelection,
    isCreatingExampleCopy,
    initialArchitecture,
    initialBoard,
    initialBoardType,
    initialFqbn,
    iotDevicesGroups,
    isExampleSketchRoute,
    selectedBoardIsIot,
    selectedFqbn,
  ]);

  // Auto-select Agent port when:
  // - IoT device is offline
  // - IoT device is online but OTA upload not available
  // Auto-select IoT device when:
  // - IoT device is online or offline and not selected
  useEffect(() => {
    if (waitingForUploadCompletion.current) return;

    if (
      !mappedPorts ||
      (getSelectedPort() &&
        getSelectedPort() !== IotPortName.Offline &&
        getSelectedPort() !== IotPortName.Online) ||
      !iotDevicesGroups ||
      isChromeOs
    )
      return;

    const offlineMatch =
      iotDevicesGroups[DetectedDevicesGroup.Offline].find((d) => {
        return d.id === selectedIotDeviceId;
      }) ||
      iotDevicesGroups[DetectedDevicesGroup.Online].find((d) => {
        return d.id === selectedIotDeviceId && d.otaCompatible === false;
      });

    const onlineMatch = iotDevicesGroups[DetectedDevicesGroup.Online].find(
      (d) => {
        return d.id === selectedIotDeviceId && d.otaCompatible === true;
      },
    );

    const match = offlineMatch || onlineMatch;

    if (!match) return;

    // if we have a matching IoT device and it's not selected select it
    // online devices are selected here too, because; due to timing the same board changing ports
    // may manifest as a usb disconnection with a status that "stays" ONLINE
    if (!getSelectedPort()) {
      setSelectedPortBoardId(match.portBoardId);
      portSelectionNext(match.portName);
      setSelectedBoardIsIot(true);
      return;
    }

    if (!offlineMatch) return;

    const serialPort = findMatchingSerialPort(
      offlineMatch,
      mappedPorts,
      deviceRequiresSerialNumberCheck(offlineMatch.fqbn),
    );

    if (!serialPort) {
      return;
    }

    if (serialPort.isUnknownBoard) {
      const { baseFqbn, architecture } = parseArduinoFqbn(
        offlineMatch.fqbn || '',
      );
      setDetectedUnknownBoard(
        serialPort.portBoardId,
        baseFqbn,
        selectedBoard || '', // set current selected iot board name
        architecture,
        serialPort.portName,
      );
      setSelectedBoardIsIot(false);
      return;
    }

    setSelectedPortBoardId(serialPort.portBoardId);
    portSelectionNext(serialPort.portName);
    setSelectedBoardIsIot(false);
  }, [
    iotDevicesGroups,
    mappedPorts,
    selectedBoard,
    selectedIotDeviceId,
    setDetectedUnknownBoard,
  ]);

  // "Alt device" logic
  useLayoutEffect(() => {
    if (waitingForUploadCompletion.current) return;

    if (!selectedPortBoardId || !iotDevicesGroups) {
      setSelectedDeviceAltPortBoardId(undefined);
      return;
    }

    const iotDevices = iotDevicesGroups[DetectedDevicesGroup.Online].filter(
      (d) => d.otaCompatible,
    );

    if (iotDevices.length === 0) {
      setSelectedDeviceAltPortBoardId(undefined);
      return;
    }

    if (!mappedPorts || mappedPorts.length === 0) {
      setSelectedDeviceAltPortBoardId(undefined);
      return;
    }

    const selectedSerialBoard = mappedPorts.find(
      (p) => p.portBoardId === selectedPortBoardId,
    );
    const selectedIotDevice = iotDevices.find(
      (d) => d.portBoardId === selectedPortBoardId,
    );

    if (selectedIotDevice && selectedIotDevice.otaCompatible === false) {
      // If ota non-compatible, should select serial by default
      return;
    }

    let matchingBoard: DetectedDevice | MappedPort | undefined = undefined;

    if (selectedSerialBoard) {
      if (isChromeOs) {
        matchingBoard = iotDevices.find(
          (d) =>
            d.id === initialIotDeviceId && d.fqbn === selectedSerialBoard.fqbn,
        );
      } else {
        const _deviceHasStableSerialNumber = deviceRequiresSerialNumberCheck(
          selectedSerialBoard.fqbn,
        );
        matchingBoard = iotDevices.find((d) =>
          _deviceHasStableSerialNumber
            ? d.serialNumber === selectedSerialBoard.serialNumber
            : d.fqbn === selectedSerialBoard.fqbn,
        );
      }
    } else if (selectedIotDevice) {
      if (isChromeOs) {
        matchingBoard = chosenWebSerialBoard
          ? findWebSerialBoardPort(chosenWebSerialBoard, mappedPorts)
          : undefined;
      } else {
        matchingBoard = findMatchingSerialPort(
          selectedIotDevice,
          mappedPorts,
          deviceRequiresSerialNumberCheck(selectedIotDevice.fqbn),
        );
      }
    }

    if (matchingBoard && matchingBoard.isUnknownBoard) {
      const { baseFqbn } = parseArduinoFqbn(iotDevices[0].fqbn || '');
      updatePortInfo(matchingBoard.portBoardId, {
        fqbn: baseFqbn,
        name: selectedBoard,
        isUnknownBoard: false,
      });
      setIncludesUnknownBoard(true);
      setUnknownBoardPortBoardIds((prev) => {
        if (matchingBoard) {
          return [...prev, matchingBoard.portBoardId];
        }
        return prev;
      });
    }

    if (
      matchingBoard &&
      selectedDeviceAltPortBoardId?.id !== matchingBoard.portBoardId
    ) {
      setSelectedDeviceAltPortBoardId({
        id: matchingBoard.portBoardId,
        serialNumber: matchingBoard.serialNumber,
        isIot: Boolean(selectedSerialBoard),
      });
    }

    if (!matchingBoard) {
      setSelectedDeviceAltPortBoardId(undefined);
    }
  }, [
    chosenWebSerialBoard,
    initialIotDeviceId,
    iotDevicesGroups,
    mappedPorts,
    selectedBoard,
    selectedDeviceAltPortBoardId,
    selectedFqbn,
    selectedPortBoardId,
    setDetectedUnknownBoard,
    setUndetectedBoard,
    updatePortInfo,
  ]);

  // ** Reconcile updated fqbn with `selectedFqbn`
  // this prevents a persistent `undefined` `selectedFqbn`
  // that can be the result of the "Prefer USB over OTA"
  // `useEffect` selecting a usb port without considering
  // an updated fqbn prop set in another logic flow.
  useEffect(() => {
    if (!selectedPortBoardId || selectedFqbn) return;
    // if updated ports contains selected port, update selected port fqbn

    const updatedPort = updatedPorts.find(
      (p) => p.portBoardId === selectedPortBoardId,
    );
    if (
      updatedPort &&
      updatedPort.props.fqbn &&
      selectedFqbn !== updatedPort.props.fqbn
    ) {
      setSelectedFqbn(updatedPort.props.fqbn);
    }
  }, [updatedPorts, selectedPortBoardId, selectedFqbn]);

  // Prefer USB over OTA
  useEffect(() => {
    if (waitingForUploadCompletion.current) return;

    if (!selectedDeviceAltPortBoardId) {
      bypassUSBPreferenceOverOTA.current = false; // when an alt device is no longer available, reset the flag
      return;
    }

    const { id, isIot } = selectedDeviceAltPortBoardId;

    if (isIot) {
      return;
    }

    // if the user has not performs at least one switch, prefer USB over OTA
    if (!bypassUSBPreferenceOverOTA.current) {
      setDetectedBoardAndPort(id, isIot, true);
    }
  }, [selectedDeviceAltPortBoardId, setDetectedBoardAndPort]);

  // update serial ports with IoT device names
  useEffect(() => {
    if (!iotDevicesGroups || !mappedPorts) return;
    const iotDevices = [
      ...iotDevicesGroups[DetectedDevicesGroup.Online],
      ...iotDevicesGroups[DetectedDevicesGroup.Offline],
    ];

    for (const iotDevice of iotDevices) {
      const matchingSNPorts = mappedPorts.filter(
        (p) => p.serialNumber === iotDevice.serialNumber,
      );
      for (const mappedPort of matchingSNPorts) {
        if (iotDevice.name && iotDevice.name !== mappedPort.name) {
          updatePortInfo(mappedPort.portBoardId, { name: iotDevice.name });
        }
      }
    }
  }, [iotDevicesGroups, mappedPorts, selectedPortBoardId, updatePortInfo]);

  // update selected board name when port info has been updated
  useLayoutEffect(() => {
    if (
      !mappedPorts ||
      mappedPorts.length === 0 ||
      !selectedPortBoardId ||
      !selectedBoard
    )
      return;

    const selectedBoardInMappedPorts = mappedPorts.find(
      (p) => p.portBoardId === selectedPortBoardId,
    );

    if (!selectedBoardInMappedPorts) return;

    if (selectedBoardInMappedPorts.name !== selectedBoard) {
      let nameUpdateTraceNotRequired = false;
      if (selectedBoardInMappedPorts.name) {
        const last = selectedBoardInMappedPorts.name.split(' - ').pop();
        const name = selectedBoardInMappedPorts.name.replace(` - ${last}`, '');

        // If the following is true, the name transition was due to the addition
        // of a device name suffix, or a device name change of an iot device
        // We avoid adding this change to `updatedNames` as we want to avoid reverting
        // on USB disconnect (see `useEffect` labelled "Ports disconnection logic")
        const suffixAdded = selectedBoard === name || selectedBoard === last;
        const selectedBoardSplit = selectedBoard.split(' - ');
        const prefixChanged =
          selectedBoardSplit.length > 1 && selectedBoardSplit[1] === last;
        nameUpdateTraceNotRequired = suffixAdded || prefixChanged;
      }

      if (!nameUpdateTraceNotRequired) {
        setUpdatedNames((prev) => {
          if (prev[selectedPortBoardId]) {
            return prev;
          }
          return {
            ...prev,
            [selectedPortBoardId]: selectedBoard,
          };
        });
      }
      setSelectedBoard(selectedBoardInMappedPorts.name);
    }
  }, [mappedPorts, selectedBoard, selectedBoardIsIot, selectedPortBoardId]);

  // update selected board when a board is chosen from the web serial api on chromeos
  useEffect(() => {
    if (
      !isChromeOs ||
      !chosenWebSerialBoard ||
      !mappedPorts ||
      waitingForUploadCompletion.current
    ) {
      return;
    }

    const iotDevice = getWebSerialAssociatedIotDevice(
      chosenWebSerialBoard,
      mappedPorts,
      iotDevicesGroups,
    );

    const isOnline =
      getSelectedPort() === IotPortName.Online ||
      iotDevice?.portName === IotPortName.Online;
    const isOtaCompatible = iotDevice && iotDevice.otaCompatible;

    if (isIotSketch && isOnline && isOtaCompatible) {
      // If device is online stop here and don't set serial as the main selected port
      // because will be set as an alternative port (see alt device hook logic)
      return;
    }

    const mappedPort = mappedPorts[0];

    if (
      isIotSketch &&
      !iotDevice &&
      (!mappedPort || !mappedPort.isUnknownBoard)
    ) {
      return;
    }

    if (mappedPort && mappedPort.isUnknownBoard) {
      if (
        isIotSketch &&
        initialFqbn &&
        webSerialSupportedFqbns.includes(initialFqbn) &&
        initialBoard &&
        initialArchitecture
      ) {
        setDetectedUnknownBoard(
          mappedPort.portBoardId,
          initialFqbn,
          initialBoard,
          initialArchitecture,
          mappedPort.portName,
        );

        return;
      }

      promptBoardConfigSelection({
        prompt: DeviceAssociationPrompts.Identify,
        meta: {
          id: mappedPort.portBoardId,
          portName: mappedPort.portName,
        },
      });

      return;
    }

    setWebSerialBoardMappedPort();
  }, [
    chosenWebSerialBoard,
    formatMessage,
    initialArchitecture,
    initialBoard,
    initialFqbn,
    iotDevicesGroups,
    isIotSketch,
    mappedPorts,
    promptBoardConfigSelection,
    setDetectedUnknownBoard,
    setWebSerialBoardMappedPort,
    webSerialSupportedFqbns,
  ]);

  const updatedWebSerialSupportedFqbns =
    webSerialState[WebSerialStateKeys.SupportedFqbns];

  useEffect(() => {
    setWebSerialSupportedFqbns(updatedWebSerialSupportedFqbns);
  }, [updatedWebSerialSupportedFqbns]);

  const mapDetectedDeviceIsAssociated =
    createMapDetectedDeviceIsAssociated(selectedPortBoardId);

  const detectedDevices = mappedPorts?.map(mapDetectedDeviceIsAssociated) || [];

  const useGetDevicesList: UseGetDevicesList = function () {
    const { data: boardsListData, isLoading } = useGetBoardsList();

    const devices =
      boardsListData?.boards.map((board) => {
        const { fqbn } = board;
        return {
          ...board,
          isAssociated: Boolean(
            selectedFqbn && fqbn === parseArduinoFqbn(selectedFqbn).baseFqbn,
          ),
          ...(webSerialSupportedFqbns.includes(fqbn) && {
            webSerialSupport: true,
          }),
        };
      }) || [];

    return { devices, devicesAreLoading: isLoading };
  };

  const getDevicesListLogic = useCallback(useGetDevicesList, [
    selectedFqbn,
    webSerialSupportedFqbns,
  ]);

  const iotDevicesWithAssociationProp = iotDevicesGroups && {
    [DetectedDevicesGroup.Online]: iotDevicesGroups[
      DetectedDevicesGroup.Online
    ].map(mapDetectedDeviceIsAssociated),
    [DetectedDevicesGroup.Offline]: iotDevicesGroups[
      DetectedDevicesGroup.Offline
    ].map(mapDetectedDeviceIsAssociated),
  };

  const currentDeviceIsBusy = busyPorts.some(
    (port) => port.portName === getSelectedPort(),
  );

  const selectedPort = useObservable(getPortSelectionChangesSubject());

  return {
    setDetectedBoardAndPort,
    setDetectedUnknownBoard,
    setUndetectedBoard,
    selectedBoard,
    selectedArchitecture,
    selectedFqbn,
    selectedPort,
    selectedIotDeviceId,
    detectedDevices,
    iotDevicesWithAssociationProp,
    includesUnknownBoard,
    manyBoardsMatchMetadata,
    currentDeviceIsBusy,
    selectedBoardIsIot,
    selectedPortBoardId,
    selectedDeviceAltPortBoardId,
    switchToAltPort,
    selectedBoardFlavourOptions,
    selectedFlavourString,
    selectFlavourOptionById,
    requestWebSerialBoardDetection,
    addGenericBypassAutoSelection,
    removeGenericBypassAutoSelection,
    getDevicesListLogic,
    changeAssociatedBoard,
    selectedBoardData,
  };
};

function deviceRequiresSerialNumberCheck(fqbn = ''): boolean {
  try {
    const parsedFqbn = parseArduinoFqbn(fqbn);

    const isArduinoStable =
      parsedFqbn.packager === ARDUINO_PACKAGER &&
      !ARDUINO_UNSTABLE_SERIAL_NUMBER_BOARDS.includes(parsedFqbn.baseFqbn);

    const isThirdPartyStable = THIRD_PARTY_STABLE_SERIAL_NUMBER_BOARDS.includes(
      parsedFqbn.baseFqbn,
    );

    return isArduinoStable || isThirdPartyStable;
  } catch {
    return true;
  }
}

const findMatchingSerialPort = (
  device: DetectedDevice,
  mappedPorts: MappedPorts,
  isDeviceSerialNumberStable?: boolean,
): MappedPort | undefined => {
  let serialPort = mappedPorts.find(
    (p) => p.serialNumber && p.serialNumber === device.serialNumber,
  );

  // ** AVOID FALLBACK TO FQBN IF SERIAL NUMBER IS "STABLE"
  if (!serialPort && isDeviceSerialNumberStable) {
    return undefined;
  }

  if (!serialPort) {
    serialPort = mappedPorts.find((p) => p.fqbn === device.fqbn);
  }
  if (!serialPort) {
    // Try to assign first port only for unknown boards
    serialPort = mappedPorts.filter((p) => p.isUnknownBoard === true)[0];
  }

  return serialPort;
};

const findWebSerialBoardPort = (
  webSerialBoard: WebSerialBoard,
  mappedPorts?: MappedPorts,
): MappedPort | undefined => {
  // web serial api doesn't provide information about the port of a board, so whenever when have
  // the available ports we scan them to find the one that matches the chosen board, and set it as its port.
  // this is a workaround for the web serial api limitations and of course could be problematic
  // if the user has multiple boards of the same type connected, but at the moment with the the current
  // web serial api implementation, this is the best we can do.
  return mappedPorts?.find(
    (port) =>
      parseInt(port.vendorId, 16) === webSerialBoard?.usbVendorId &&
      parseInt(port.productId, 16) === webSerialBoard?.usbProductId,
  );
};

const getWebSerialAssociatedIotDevice = (
  webSerialBoard: WebSerialBoard,
  mappedPorts?: MappedPorts,
  iotDevicesGroups?: IotDevicesGroups,
): DetectedDevice | undefined => {
  const boardPort = findWebSerialBoardPort(webSerialBoard, mappedPorts);
  return (
    iotDevicesGroups &&
    boardPort &&
    [
      ...iotDevicesGroups[DetectedDevicesGroup.Online],
      ...iotDevicesGroups[DetectedDevicesGroup.Offline],
    ].find((d) => d.fqbn === boardPort.fqbn)
  );
};

const createMapDetectedDeviceIsAssociated = (selectedPortBoardId?: string) =>
  function mapDetectedDeviceIsAssociated(
    device: MappedPort | DetectedDevice,
  ): DetectedDevice {
    const { portBoardId } = device;
    return {
      ...device,
      isAssociated: portBoardId === selectedPortBoardId,
    };
  };

type UseDeviceMetadata = (
  sketchData?: SketchData,
  sketchBoardData?: GetBoardByFqbn_Response,
  thingDeviceDetails?: ShowThingV1Device_ResponseWithArchAndOriginalName,
  thingDeviceDetailsIsLoading?: boolean,
) => {
  fqbn: string | null;
  boardName: string | null;
  architecture: string | null;
  boardType: string | null;
  iotDeviceId?: string | null;
};

export const useDeviceMetadata: UseDeviceMetadata = function (
  sketchData?: SketchData,
  sketchBoardData?: GetBoardByFqbn_Response,
  thingDeviceDetails?: ShowThingV1Device_ResponseWithArchAndOriginalName,
  thingDeviceDetailsIsLoading?: boolean,
): ReturnType<UseDeviceMetadata> {
  const { sketchID, sketchIDIsLoading, createSketchParam } = useSketchParams();

  const sketchDataWillChangeToACopy = Boolean(
    sketchIDIsLoading ||
      (sketchID && !!sketchData && sketchID !== sketchData.id) ||
      createSketchParam,
  );

  if (sketchDataWillChangeToACopy) {
    return {
      fqbn: null,
      boardName: null,
      architecture: null,
      boardType: null,
    };
  }

  const sketchDataFqbn =
    typeof sketchData?.fqbn === 'string' ? sketchData.fqbn : null;

  const sketchDataBoardName =
    typeof sketchData?.boardName === 'string'
      ? sketchData.boardName === '' && sketchData.fqbn
        ? typeof sketchBoardData?.name === 'string'
          ? sketchBoardData?.name
          : null
        : sketchData.boardName
      : null;

  const sketchDataArchitecture =
    typeof sketchBoardData?.architecture === 'string'
      ? sketchBoardData.architecture
      : sketchData?.fqbn
      ? null
      : sketchData
      ? ''
      : null;

  const sketchDataBoardType =
    typeof sketchData?.boardType === 'string' ? sketchData.boardType : null;

  const thingDeviceDetailsFqbn =
    typeof thingDeviceDetails?.fqbn === 'string'
      ? thingDeviceDetails.fqbn
      : null;

  const thingDeviceDetailsBoardName =
    typeof thingDeviceDetails?.name === 'string'
      ? thingDeviceDetails.name
      : null;

  const thingDeviceDetailsArchitecture =
    typeof thingDeviceDetails?.architecture === 'string'
      ? thingDeviceDetails.architecture
      : null;

  return {
    fqbn: thingDeviceDetailsIsLoading
      ? null
      : thingDeviceDetailsFqbn || sketchDataFqbn,
    boardName: thingDeviceDetailsIsLoading
      ? null
      : thingDeviceDetailsBoardName || sketchDataBoardName,
    architecture: thingDeviceDetailsIsLoading
      ? null
      : thingDeviceDetailsArchitecture || sketchDataArchitecture,
    boardType: thingDeviceDetailsIsLoading
      ? null
      : thingDeviceDetailsFqbn
      ? 'cloud'
      : sketchDataBoardType,
    iotDeviceId: thingDeviceDetailsIsLoading ? null : thingDeviceDetails?.id,
  };
};

function emitBoardChangeEvent(
  sketch_id = '',
  board = '',
  fqbn = undefined as string | undefined,
): void {
  ga4Emitter({
    type: 'BOARD_CHANGE',
    payload: {
      sketch_id,
      type: JSON.stringify({
        board,
        flavour: fqbn ? parseArduinoFqbn(fqbn).config : {},
      }),
    },
  });
}
