import { AppLabNetwork } from '../app-lab-settings';
import BoardConfiguration from './sections/BoardConfiguration';
import LinuxCredentials from './sections/LinuxCredentials';
import {
  AppLabSetupItem,
  AppLabSetupItemId,
  SetupSections,
} from './setup.type';

export const setupItems: AppLabSetupItem[] = [
  {
    id: AppLabSetupItemId.BoardConfiguration,
    enabled: true,
  },
  {
    id: AppLabSetupItemId.NetworkSetup,
    enabled: true,
  },
  {
    id: AppLabSetupItemId.LinuxCredentials,
    enabled: true,
  },
];

export const sections: SetupSections = {
  [AppLabSetupItemId.BoardConfiguration]: (useLogic, ref) => {
    const logic = useLogic();
    return [
      logic.setBoardConfigurationIsLoading,
      <BoardConfiguration ref={ref} logic={logic} />, // eslint-disable-line react/jsx-key
    ];
  },
  [AppLabSetupItemId.NetworkSetup]: (useLogic, ref) => {
    const logic = useLogic();
    return [
      logic.isScanning || Boolean(logic.isConnecting),
      <AppLabNetwork ref={ref} logic={logic} isSetupFlow={true} />, // eslint-disable-line react/jsx-key
    ];
  },
  [AppLabSetupItemId.LinuxCredentials]: (useLogic, ref) => {
    const logic = useLogic();
    return [
      logic.setUserPasswordIsLoading,
      <LinuxCredentials ref={ref} logic={logic} />, // eslint-disable-line react/jsx-key
    ];
  },
};
