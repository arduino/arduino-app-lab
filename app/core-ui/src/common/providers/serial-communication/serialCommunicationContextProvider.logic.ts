import {
  clearUploadResponseStream,
  getUploadConcatResponseStream,
  UploadStatus,
} from '@cloud-editor-mono/board-communication-tools';
import {
  connectToAgent,
  daemonState,
  discoverPorts,
  downloadDefaultTools,
  getAgentOS,
  setAgentDaemonState,
} from '@cloud-editor-mono/create-agent-client-ts';
import {
  addBoardInfoToPort,
  ga4Emitter,
  getAgentMetadata,
  isChromeOs,
  MappedPort,
} from '@cloud-editor-mono/domain';
import { ArduinoBuilderV2CompilationsResponse_BuilderApi } from '@cloud-editor-mono/infrastructure';
import {
  listPorts,
  requestPort,
  setWebSerialState,
  webSerialState,
  WebSerialStateKeys,
} from '@cloud-editor-mono/web-board-communication';
import { useQueries, useQuery } from '@tanstack/react-query';
import { isEqual } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useSketchParams } from '../../../cloud-editor/features/main/hooks/sketch';
import { useCompileComputeAndUpload } from '../../../common/hooks/queries/builder';
import { CompilePayload } from '../../../common/hooks/queries/builder.type';
import {
  MappedPorts,
  UseAgent,
  UseSerialCommunication,
  UseWebSerial,
} from './serialCommunicationContext';
import { createPortBoardID } from './utils';

export const useSerialCommunication: UseSerialCommunication =
  function (): ReturnType<UseSerialCommunication> {
    const [, forceUpdate] = useState({});
    const { sketchID, viewMode } = useSketchParams();

    const onUploadStart = useCallback(() => {
      ga4Emitter({
        type: 'UPLOAD',
        payload: { sketch_id: sketchID || '' },
      });
    }, [sketchID]);
    const agentEnabled = !isChromeOs;

    const {
      compileComputeAndUpload,
      uploadOutput,
      compileErrors,
      compileHasFailed,
      compilationProgress,
      compileWarnLineStart,
      compileWarnLineEnd,
      uploadOutputLineStart,
      isCompiling: uploadIsCompiling,
      isComputing: uploadIsComputing,
      isUploading: uploadIsUploading,
      reset,
      compileResultMessages,
      errorFiles,
    } = useCompileComputeAndUpload(agentEnabled, onUploadStart);

    const mappedPorts: MappedPorts = [];

    const [updatedPorts, setUpdatedPorts] = useState<
      {
        portBoardId: string;
        props: Partial<MappedPort>;
      }[]
    >([]);

    const { agentPorts } = useAgent(agentEnabled && !viewMode);
    const { webSerialPorts } = useWebSerial(agentEnabled || !!viewMode);

    const ports = agentEnabled ? agentPorts : webSerialPorts;
    const handleComputeAndUpload = useCallback(
      (
        fqbn: string,
        sketchId: string,
        boardType: string,
        port: string,
        sketchName: string,
        compilePayload: CompilePayload,
        existingCompilation?: ArduinoBuilderV2CompilationsResponse_BuilderApi,
      ) => {
        const agentOS = agentEnabled ? getAgentOS() : '';
        const compileAndComputeData = {
          compilePayload,
          computePayload: { agentOS, fqbn },
          partialUploadPayload: {
            fqbn,
            port,
            sketchName,
            sketchId,
            boardType,
          },
        };

        compileComputeAndUpload(compileAndComputeData, existingCompilation);

        ga4Emitter({
          type: 'COMPILE',
          payload: { sketch_id: sketchID || '' },
        });
      },
      [agentEnabled, compileComputeAndUpload, sketchID],
    );

    const clearUploadStream = useCallback((): void => {
      if (agentEnabled) {
        clearUploadResponseStream(setAgentDaemonState, daemonState);
      } else {
        clearUploadResponseStream(setWebSerialState, webSerialState);
      }
      reset(uploadIsCompiling);
    }, [agentEnabled, reset, uploadIsCompiling]);

    const portInfoQueries = useQueries({
      queries:
        ports?.map((port) => {
          return {
            queryKey: ['get-port-info', port.productId, port.vendorId],
            queryFn: () =>
              addBoardInfoToPort(
                { pid: port.productId, vid: port.vendorId },
                port,
              ),
            refetchOnWindowFocus: false,
          };
        }) ?? [],
    });

    const updatePortInfo = useCallback(
      (portBoardId: string, props: Partial<MappedPort>) => {
        if (!ports) return;

        const port = ports.find(
          (port) =>
            createPortBoardID(
              port.portName,
              port.productId,
              port.vendorId,
              port.serialNumber,
            ) === portBoardId,
        );
        if (!port) return;

        setUpdatedPorts((prev) => {
          const portPreviouslyUpdated = prev.find(
            (p) => p.portBoardId === portBoardId,
          );

          const updatedPort = {
            portBoardId: portPreviouslyUpdated
              ? portPreviouslyUpdated.portBoardId
              : portBoardId,
            props: portPreviouslyUpdated
              ? { ...portPreviouslyUpdated.props, ...props }
              : props,
          };

          if (
            portPreviouslyUpdated &&
            isEqual(portPreviouslyUpdated, updatedPort)
          ) {
            return prev;
          }

          return [
            ...prev.filter((p) => p.portBoardId !== portBoardId),
            updatedPort,
          ];
        });
      },
      [ports],
    );

    const clearUpdatedPortInfo = useCallback((identifier: string): void => {
      setUpdatedPorts((prev) =>
        prev?.filter((port) => port.portBoardId !== identifier),
      );
    }, []);

    // user identified an unknown board for a board, then plugged a different board
    // into the same port
    useEffect(() => {
      if (!ports) return;

      updatedPorts.forEach((port) => {
        const updatedPortWithDifferentIDs = ports.find(
          (detectedPort) =>
            port.portBoardId.includes(detectedPort.portName) &&
            (!port.portBoardId.includes(detectedPort.productId) ||
              !port.portBoardId.includes(detectedPort.vendorId)),
        );

        if (updatedPortWithDifferentIDs) {
          clearUpdatedPortInfo(port.portBoardId);
        }
      });
    }, [ports, updatedPorts, clearUpdatedPortInfo]);

    if (ports) {
      const data = portInfoQueries.map((query) => query.data);
      for (const port of ports) {
        const portDataFound = data.find(
          (item) =>
            item?.productId === port.productId &&
            item.vendorId === port.vendorId,
        );

        if (portDataFound) {
          let portData = portDataFound;
          if (
            portData.portName !== port.portName ||
            portData.serialNumber !== port.serialNumber
          ) {
            portData = { ...portData, ...port };
          }

          const portBoardId = createPortBoardID(
            portData.portName,
            portData.productId,
            portData.vendorId,
            portData.serialNumber,
          );

          const portUpdatedInfo = updatedPorts?.find(
            (port) => port.portBoardId === portBoardId,
          );

          if (portUpdatedInfo) {
            mappedPorts.push({
              ...portData,
              ...portUpdatedInfo.props,
              portBoardId,
            });
          } else {
            mappedPorts.push({ ...portData, portBoardId });
          }
        }
      }
    }

    const busyPorts = useMemo(
      () => ports?.filter((port) => port.isOpen) || [],
      [ports],
    );

    const uploadStream = agentEnabled
      ? getUploadConcatResponseStream(setAgentDaemonState, daemonState)
      : getUploadConcatResponseStream(setWebSerialState, webSerialState);

    return {
      mappedPorts,
      upload: handleComputeAndUpload,
      uploadStream,
      clearUploadStream,
      uploadIsCompiling,
      uploadIsComputing,
      uploadIsUploading,
      uploadCompilingProgress: compilationProgress,
      compileErrors,
      compileHasFailed,
      compileWarnLineStart,
      compileWarnLineEnd,
      uploadHasError: uploadOutput === UploadStatus.ERROR,
      uploadOutputLineStart,
      updatePortInfo,
      clearUpdatedPortInfo,
      busyPorts,
      detectBoards: requestPort,
      forceUpdate,
      compileResultMessages,
      errorFiles,
      updatedPorts,
    };
  };

const useAgent: UseAgent = function (
  agentEnabled: boolean,
): ReturnType<UseAgent> {
  const poolForAgent = useRef(true);

  const { data: agentMetadata } = useQuery(
    ['agent-metadata'],
    getAgentMetadata,
    { enabled: agentEnabled, refetchOnWindowFocus: false },
  );
  const agentMetadataRetrieved = Boolean(agentMetadata);

  const { data: agentConnected } = useQuery(
    ['agent-connect'],
    () =>
      agentMetadata?.version
        ? connectToAgent(agentMetadata.version)
        : Promise.reject(
            new Error('Tried to connect to Agent without metadata'),
          ),
    {
      enabled: agentMetadataRetrieved,
      refetchOnWindowFocus: false,
      onSuccess() {
        poolForAgent.current = false;
      },
      ...(poolForAgent.current && {
        refetchInterval: 2000,
      }),
    },
  );
  const agentConnectedDone = Boolean(agentConnected);

  const { data: defaultDownloadsResponse } = useQuery(
    ['install-tools'],
    downloadDefaultTools,
    {
      enabled: agentConnectedDone,
      refetchOnWindowFocus: false,
    },
  );
  const defaultDownloadsDone = Boolean(defaultDownloadsResponse);

  const { data: agentPorts } = useQuery(['list-ports'], discoverPorts, {
    enabled: agentConnectedDone && defaultDownloadsDone,
    refetchInterval: 1500,
    cacheTime: 0,
  });

  return {
    agentPorts,
  };
};

const useWebSerial: UseWebSerial = function (
  agentEnabled: boolean,
): ReturnType<UseWebSerial> {
  const { data: webSerialPorts } = useQuery(['web-serial-ports'], listPorts, {
    enabled: !agentEnabled,
    refetchInterval: 1500,
    cacheTime: 0,
  });

  setWebSerialState({ [WebSerialStateKeys.Ports]: webSerialPorts });

  return {
    webSerialPorts,
  };
};
