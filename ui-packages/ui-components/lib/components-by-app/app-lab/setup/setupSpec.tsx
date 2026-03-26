import { Login } from '../account';
import { Network } from '../network';
import BoardConfiguration from './sections/BoardConfiguration';
import LinuxCredentials from './sections/LinuxCredentials';
import { SetupItem, SetupItemId, SetupSections } from './setup.type';

export const setupItems: SetupItem[] = [
  {
    id: SetupItemId.BoardConfiguration,
    enabled: true,
  },
  {
    id: SetupItemId.NetworkSetup,
    enabled: true,
  },
  {
    id: SetupItemId.LinuxCredentials,
    enabled: true,
  },
  {
    id: SetupItemId.ArduinoAccount,
    enabled: true,
  },
];

export const sections: SetupSections = {
  [SetupItemId.BoardConfiguration]: (useLogic, ref, unlockAutoFlow) => {
    const logic = useLogic();
    return [
      logic.setBoardConfigurationIsLoading,
      <BoardConfiguration
        key="board-configuration"
        ref={ref}
        logic={logic}
        unlockAutoFlow={unlockAutoFlow}
      />,
    ];
  },
  [SetupItemId.NetworkSetup]: (useLogic, ref, unlockAutoFlow) => {
    const logic = useLogic();
    return [
      logic.isScanning || Boolean(logic.isConnecting),
      <Network
        key="app-lab-network"
        ref={ref}
        logic={logic}
        isSetupFlow={true}
        unlockAutoFlow={unlockAutoFlow}
      />,
    ];
  },
  [SetupItemId.LinuxCredentials]: (useLogic, ref, unlockAutoFlow) => {
    const logic = useLogic();
    return [
      logic.setUserPasswordIsLoading,
      <LinuxCredentials
        key="linux-credentials"
        ref={ref}
        logic={logic}
        unlockAutoFlow={unlockAutoFlow}
      />,
    ];
  },
  [SetupItemId.ArduinoAccount]: (useLogic, ref, _unlockAutoFlow) => {
    const logic = useLogic();
    return [
      logic.isLoginLoading,
      <Login key="app-lab-login" ref={ref} isSetupFlow={true} {...logic} />,
    ];
  },
};
