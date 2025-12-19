import { IotDevicesGroups } from '@cloud-editor-mono/ui-components';
import { useCallback, useEffect, useRef } from 'react';

import {
  refreshFilesContents,
  refreshSketch,
} from '../../../../common/hooks/queries/create';
import { ShowThingV1Device_ResponseWithArchAndOriginalName } from '../../../../common/hooks/queries/iot';
import {
  ComponentUpdateEvent,
  ComponentUpdateEventPayload,
  ComponentUpdateLogic,
} from '../../../../common/providers/component/ComponentContextProvider';

export type UseComponentUpdate = (
  useComponentUpdateLogic: ComponentUpdateLogic,
  thingDeviceDetails:
    | ShowThingV1Device_ResponseWithArchAndOriginalName
    | undefined,
  iotDevicesGroups: IotDevicesGroups | undefined,
  refreshFileList: () => void,
  refreshThingDeviceDetails: () => void,
  changeAssociatedBoard: (data: {
    fqbn: string;
    architecture: string;
    name: string;
  }) => void,
) => void;

export const useComponentUpdate: UseComponentUpdate = function (
  useComponentUpdateLogic,
  thingDeviceDetails,
  iotDevicesGroups,
  refreshFileList,
  refreshThingDeviceDetails,
  changeAssociatedBoard,
): ReturnType<UseComponentUpdate> {
  const requestDeviceChange = useRef<boolean>(false);

  const componentUpdateLogicCallback = useCallback(
    (payload: ComponentUpdateEventPayload) => {
      switch (payload.type) {
        case ComponentUpdateEvent.SketchChange:
          refreshSketch();
          break;
        case ComponentUpdateEvent.FileListChange:
          refreshFileList();
          break;
        case ComponentUpdateEvent.AssociatedDeviceChange:
          refreshSketch();
          refreshThingDeviceDetails();
          requestDeviceChange.current = true;
          break;
        case ComponentUpdateEvent.FilesContentChange: {
          const { filePaths } = payload.data;
          refreshFilesContents(filePaths);
          break;
        }
      }
    },
    [refreshFileList, refreshThingDeviceDetails],
  );

  useEffect(() => {
    if (
      requestDeviceChange.current &&
      thingDeviceDetails?.id &&
      iotDevicesGroups &&
      [...iotDevicesGroups.offline, ...iotDevicesGroups.online].find(
        (d) => d.id === thingDeviceDetails.id,
      )
    ) {
      requestDeviceChange.current = false;
      changeAssociatedBoard({
        name: thingDeviceDetails.name,
        fqbn: thingDeviceDetails.fqbn || '',
        architecture: thingDeviceDetails.architecture,
      });
    }
  }, [changeAssociatedBoard, thingDeviceDetails, iotDevicesGroups]);

  useComponentUpdateLogic(componentUpdateLogicCallback);
};
