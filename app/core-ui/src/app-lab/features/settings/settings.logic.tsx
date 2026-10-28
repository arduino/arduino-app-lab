import { BOARD_FQBN } from '@cloud-editor-mono/common';
import {
  getConnectionName,
  getHwList,
  getHwStatus,
  getIPAddress,
  getKernelVersion,
  getLinuxDistribution,
  getOSImageVersion,
  getTerminalPreference,
  isHwSupported,
  isNetworkModeEnabled,
  listCloudConnectorOrganizations,
  listTerminals,
  openLinkExternal,
  rebootBoard,
  reloadApp,
  setHwStatus,
  setNetworkMode,
  setTerminalPreference,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import { CloudConnectorOrganization } from '@cloud-editor-mono/infrastructure';
import {
  BoardExtensionsAttachDialogLogic,
  ChangePasswordDialogLogic,
  CloudConnectorConnectDialogLogic,
  CloudConnectorDisconnectDialogLogic,
  HwError,
  HwErrorCode,
  HwStatus,
  PasswordDialogError,
  PasswordDialogLogic,
  snackbar,
  UseBoardExtensionsSettingsLogic,
  UseBoardSettingsLogic,
  UseCloudConnectorSettingsLogic,
  useI18n,
  UseNetworkModeLogic,
  UseNetworkSettingsLogic,
  UsePasswordSettingsLogic,
  UseSettingsLogic,
  UseSystemSettingsLogic,
  UseTerminalSettingsLogic,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { useContext, useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { BoardScopedQuery } from '../../boardScopedQuery';
import { useIsBoard } from '../../hooks/useIsBoard';
import { useSystemProps } from '../../hooks/useSystemProps';
import { AuthContext } from '../../providers/auth/authContext';
import { BoardConfigurationContext } from '../../providers/board-configuration/boardConfigurationContext';
import { CloudConnectorContext } from '../../providers/cloud-connector/cloudConnectorContext';
import { LinuxCredentialsContext } from '../../providers/linux-credentials/linuxCredentialsContext';
import { NetworkContext } from '../../providers/network/networkContext';
import { UpdaterContext } from '../../providers/updater/updaterContext';
import { useBoardLifecycleStore } from '../../store/boardLifecycle';
import { bytesToGiB, useBoardResourcesStore } from '../../store/boardResources';
import { useNetworkSettingsDialogStore } from '../../store/networkSettingsDialog';
import { SystemPropKey } from '../../store/systemProps';
import { systemMessages } from './messages';

const toPasswordDialogError = (
  error: Error | null,
): PasswordDialogError | undefined => {
  if (!error) return undefined;
  if (!(error instanceof HwError)) return { kind: 'generic' };
  return error.code === HwErrorCode.IncorrectPassword
    ? { kind: 'password' }
    : { kind: 'generic', message: error.message };
};

export const createUseSettingsLogic = function (): UseSettingsLogic {
  return function useSettingsLogic(): ReturnType<UseSettingsLogic> {
    const { formatMessage } = useI18n();
    const queryClient = useQueryClient();
    const { data: isBoard } = useIsBoard();
    const {
      selectedConnectedBoard,
      boardIsReachable,
      needsImageUpdate,
      setBoardIsFlashing,
    } = useBoardLifecycleStore(
      useShallow((state) => ({
        selectedConnectedBoard: state.selectedConnectedBoard,
        boardIsReachable: state.boardIsReachable,
        needsImageUpdate: state.needsImageUpdate,
        setBoardIsFlashing: state.setBoardIsFlashing,
      })),
    );

    const usePasswordSettingsLogic =
      (): ReturnType<UsePasswordSettingsLogic> => {
        const [open, setOpen] = useState(false);
        const {
          setUserPassword,
          setUserPasswordIsLoading: isLoading,
          setUserPasswordConfirmationIsError: confirmationIsError,
          setUserPasswordIsError: isError,
          setUserPasswordIsSuccess: isSuccess,
          userPasswordErrorMsg: errorMsg,
          userPasswordConfirmationErrorMsg: confirmationErrorMsg,
        } = useContext(LinuxCredentialsContext);

        const changePasswordLogic: ChangePasswordDialogLogic = () => ({
          setUserPassword,
          isLoading,
          confirmationIsError,
          isError,
          isSuccess,
          errorMsg,
          confirmationErrorMsg,
          open,
          onOpenChange: setOpen,
        });

        return {
          changePasswordLogic,
          openChangePasswordDialog: () => setOpen(true),
        };
      };

    const useBoardSettingsLogic = (): ReturnType<UseBoardSettingsLogic> => {
      const resources = useBoardResourcesStore((state) => state.resources);
      const {
        keyboardLayout,
        keyboardLayouts,
        boardName,
        setBoardName,
        setKeyboardLayout,
        setBoardNameIsError,
        boardNameErrorMsg,
      } = useContext(BoardConfigurationContext);

      return {
        isBoard: !!isBoard,
        board: selectedConnectedBoard,
        boardName,
        boardResources: resources,
        keyboardLayout: keyboardLayouts.find(
          (layout) => layout.id === keyboardLayout,
        ),
        keyboardLayouts,
        bytesToGiB,
        setBoardName,
        setKeyboardLayout,
        setBoardNameIsError,
        boardNameErrorMsg,
      };
    };

    const useBoardExtensionsSettingsLogic =
      (): ReturnType<UseBoardExtensionsSettingsLogic> => {
        const [carrierEnabled, setCarrierEnabled] = useState(false);
        const [hatEnabled, setHatEnabled] = useState(false);
        // enableOnConfirm: only the toggle switches the extension on when the dialog is
        // confirmed; the "How to attach" buttons and the HAT type menu open it to inform.
        const [attachOpen, setAttachOpen] = useState<
          false | { type: 'carrier' | 'hat'; enableOnConfirm: boolean }
        >(false);
        const [passwordOpen, setPasswordOpen] = useState(false);
        const [status, setStatus] = useState<HwStatus>({
          mounts: [],
        });

        const { systemProps, upsertProp } = useSystemProps();

        // No initialData: a `false` placeholder would show the "needs a board update" banner
        // until the first answer arrives.
        const { data: hwSupported } = useQuery({
          queryKey: [BoardScopedQuery.HARDWARE_SUPPORTED],
          queryFn: async () => isHwSupported(),
          enabled: boardIsReachable,
        });

        const carrierPristine = status.mounts
          .filter((mount) => mount.kind === 'carrier')
          .every(
            (carrier) =>
              carrier.nextEnabled === carrier.currentEnabled &&
              carrier.nextDevices.every((media) =>
                carrier.currentDevices.some(
                  (currentMedia) =>
                    currentMedia.device === media.device &&
                    currentMedia.option === media.option,
                ),
              ),
          );

        const hatPristine = status.mounts
          .filter((mount) => mount.kind === 'hat')
          .every((hat) => hat.nextEnabled === hat.currentEnabled);

        const { data: hwList } = useQuery({
          queryKey: [BoardScopedQuery.HARDWARE_LIST],
          queryFn: async () => getHwList(),
          enabled: boardIsReachable && hwSupported === true,
          initialData: { mounts: [] },
        });

        const carriers = hwList.mounts
          .filter(
            (mount) =>
              mount.kind === 'carrier' &&
              mount.osSupport &&
              mount.devices.some((device) => device.osSupport),
          )
          .map((mount) => ({
            ...mount,
            devices: mount.devices.filter((device) => device.osSupport),
          }));
        const hats = hwList.mounts.filter(
          (mount) => mount.kind === 'hat' && mount.osSupport,
        );

        const { data: hwStatus } = useQuery({
          queryKey: [BoardScopedQuery.HARDWARE_STATUS],
          queryFn: async () => getHwStatus(),
          enabled: boardIsReachable && hwSupported === true,
          initialData: { mounts: [] },
        });

        useEffect(() => {
          setStatus({
            mounts: hwStatus.mounts.map((mount) => ({
              ...mount,
              nextDevices: mount.currentDevices,
              nextEnabled: mount.currentEnabled,
            })),
          });
          setCarrierEnabled(
            hwStatus.mounts.some(
              (mount) => mount.kind === 'carrier' && mount.currentEnabled,
            ),
          );
          setHatEnabled(
            hwStatus.mounts.some(
              (mount) => mount.kind === 'hat' && mount.currentEnabled,
            ),
          );
        }, [hwStatus]);

        const setEnabled = (
          isEnabled: boolean,
          type: 'carrier' | 'hat',
        ): void => {
          const setEnabled = (isEnabled: boolean): void => {
            if (type === 'carrier') {
              setCarrierEnabled(isEnabled);
            } else {
              setHatEnabled(isEnabled);
            }
          };
          setEnabled(isEnabled);

          if (isEnabled) {
            setStatus((prev) => ({
              ...prev,
              mounts: prev.mounts.map((mount) => {
                if (mount.kind !== type) return mount;

                return {
                  ...mount,
                  nextEnabled: type === 'carrier' ? true : mount.currentEnabled,
                  nextDevices: mount.currentDevices,
                };
              }),
            }));
          } else {
            setEnabled(false);
            setStatus((prev) => ({
              ...prev,
              mounts: prev.mounts.map((mount) => {
                if (mount.kind !== type) return mount;

                return {
                  ...mount,
                  nextEnabled: false,
                  nextDevices: mount.nextDevices.map((device) => ({
                    ...device,
                    option: 'none',
                  })),
                };
              }),
            }));
          }
        };

        const attachLogic: BoardExtensionsAttachDialogLogic = () => {
          const isVentunoQ =
            selectedConnectedBoard?.fqbn === BOARD_FQBN.VENTUNO_Q;

          return {
            open: attachOpen !== false,
            isHat: attachOpen !== false && attachOpen.type === 'hat',
            isVentunoQ,
            confirm: (): void => {
              if (attachOpen === false) return;
              upsertProp({
                key:
                  attachOpen.type === 'hat'
                    ? SystemPropKey.HatAcknowledged
                    : SystemPropKey.CarrierAcknowledged,
                value: 'true',
              });
              if (attachOpen.enableOnConfirm) {
                setEnabled(true, attachOpen.type);
              }
              setAttachOpen(false);
            },
            onOpenChange: () => setAttachOpen(false),
          };
        };

        const reboot = async (password: string): Promise<void> => {
          await rebootBoard(password);
          reloadApp();
        };

        const {
          error: savingHwStatusError,
          isPending: isSavingHwStatus,
          isSuccess: isSavingHwStatusSuccess,
          mutateAsync: saveHwStatus,
        } = useMutation({
          mutationFn: (password: string) => setHwStatus(status, password),
          onSuccess: async (_, password) => {
            await reboot(password);
          },
        });

        const passwordLogic: PasswordDialogLogic = () => ({
          open: passwordOpen,
          onOpenChange: setPasswordOpen,
          onConfirm: async (password: string): Promise<void> =>
            saveHwStatus(password),
          isLoading: isSavingHwStatus,
          isSuccess: isSavingHwStatusSuccess,
          error: toPasswordDialogError(savingHwStatusError),
        });

        const handleEnabledChange =
          (type: 'carrier' | 'hat') =>
          (isEnabled: boolean): void => {
            if (isEnabled) {
              if (
                (type === 'carrier' &&
                  !systemProps?.[SystemPropKey.CarrierAcknowledged]) ||
                (type === 'hat' &&
                  !systemProps?.[SystemPropKey.HatAcknowledged])
              ) {
                setAttachOpen({ type, enableOnConfirm: true });
              } else {
                setEnabled(true, type);
              }
            } else {
              setEnabled(false, type);
            }
          };

        const handleCarrierStatusChange = (
          carrierName: string,
          device: string,
          option: string,
        ): void => {
          setStatus((prev) => ({
            mounts: prev.mounts.map((carrier) => {
              if (carrier.name !== carrierName) return carrier;

              return {
                ...carrier,
                nextDevices: carrier.nextDevices.map((media) => {
                  if (media.device !== device) return media;

                  return {
                    ...media,
                    option,
                  };
                }),
              };
            }),
          }));
        };

        const handleHatStatusChange = (option: string): void => {
          if (option !== 'none') {
            const mounts = status.mounts.filter(
              (mount) => mount.kind === 'hat',
            );
            if (
              !systemProps?.[SystemPropKey.HatAcknowledged] &&
              mounts.every((mount) => !mount.nextEnabled)
            ) {
              setAttachOpen({ type: 'hat', enableOnConfirm: false });
            }
          }

          setStatus((prev) => {
            return {
              mounts: prev.mounts.map((mount) => {
                if (mount.kind !== 'hat') return mount;

                return {
                  ...mount,
                  nextEnabled: option === mount.name,
                };
              }),
            };
          });
        };

        return {
          status,
          carrierEnabled,
          carrierPristine,
          onCarrierEnabledChange: handleEnabledChange('carrier'),
          openAttachHatDialog: () =>
            setAttachOpen({ type: 'hat', enableOnConfirm: false }),
          carriers,
          hatEnabled,
          hatPristine,
          onHatEnabledChange: handleEnabledChange('hat'),
          hats,
          setHatStatus: handleHatStatusChange,
          setCarrierStatus: handleCarrierStatusChange,
          supported: hwSupported !== false,
          attachLogic,
          openAttachCarrierDialog: () =>
            setAttachOpen({ type: 'carrier', enableOnConfirm: false }),
          passwordLogic,
          openPasswordDialog: () => setPasswordOpen(true),
        };
      };

    const useNetworkModeLogic = (): ReturnType<UseNetworkModeLogic> => {
      const [open, setOpen] = useState(false);

      const { data: networkModeEnabled } = useQuery({
        queryKey: [BoardScopedQuery.NETWORK_MODE_ENABLED],
        queryFn: async () => isNetworkModeEnabled(),
        enabled: boardIsReachable,
      });

      const {
        error: networkModeError,
        isError: isNetworkModeError,
        isPending: isSettingNetworkMode,
        isSuccess: isSettingNetworkModeSuccess,
        mutateAsync: updateNetworkMode,
      } = useMutation({
        mutationFn: (prop: { enabled: boolean; password: string }) =>
          setNetworkMode(prop.enabled, prop.password),
        onSuccess: (success: boolean, variables) => {
          if (success) {
            queryClient.setQueryData(
              [BoardScopedQuery.NETWORK_MODE_ENABLED],
              variables.enabled,
            );
            snackbar({
              message: formatMessage(systemMessages.remoteAccessToggle, {
                enabled: variables.enabled ? 'enabled' : 'disabled',
              }),
              variant: 'success',
            });
          } else {
            snackbar({
              message: formatMessage(systemMessages.remoteAccessToggleError, {
                enabled: variables.enabled ? 'enabled' : 'disabled',
              }),
              variant: 'error',
            });
          }
        },
        onSettled: () => {
          queryClient.invalidateQueries({
            queryKey: [BoardScopedQuery.NETWORK_MODE_ENABLED],
          });
        },
      });

      const passwordLogic: PasswordDialogLogic = () => ({
        open,
        onOpenChange: setOpen,
        onConfirm: (password: string) =>
          updateNetworkMode({ enabled: !networkModeEnabled, password }),
        isLoading: isSettingNetworkMode,
        isSuccess: isSettingNetworkModeSuccess,
        error: isNetworkModeError
          ? (Array.isArray(networkModeError)
              ? networkModeError
              : [String(networkModeError)]
            ).some((error) => error.includes('password'))
            ? { kind: 'password' }
            : { kind: 'generic' }
          : undefined,
      });

      return {
        isNetworkModeEnabled: networkModeEnabled,
        passwordLogic,
        openPasswordDialog: () => setOpen(true),
      };
    };

    const useNetworkSettingsLogic = (): ReturnType<UseNetworkSettingsLogic> => {
      const { isConnected } = useContext(NetworkContext);
      const router = useRouter();
      // The dialog itself is rendered once, app-wide, by main; the settings
      // screen only opens it through the shared store.
      const setNetworkSettingsDialogOpen = useNetworkSettingsDialogStore(
        (state) => state.setOpen,
      );

      // Check for search params to open network dialog
      useEffect(() => {
        const search = router.state.location.search as {
          openNetworkDialog?: boolean;
        };
        if (search?.openNetworkDialog) {
          setNetworkSettingsDialogOpen(true);
        }
      }, [router, setNetworkSettingsDialogOpen]);

      const { data: selectedConnectedNetwork } = useQuery({
        queryKey: [BoardScopedQuery.CONNECTION_NAME],
        queryFn: async () => getConnectionName(),
        enabled: boardIsReachable && isConnected,
      });

      const { data: selectedConnectedIPAddress } = useQuery({
        queryKey: [BoardScopedQuery.IP_ADDRESS],
        queryFn: async () => getIPAddress(),
        enabled: boardIsReachable && isConnected,
      });

      return {
        isConnected,
        selectedConnectedNetwork,
        selectedConnectedIPAddress,
        openNetworkSettingsDialog: () => setNetworkSettingsDialogOpen(true),
      };
    };

    const useSystemSettingsLogic = (): ReturnType<UseSystemSettingsLogic> => {
      const {
        currentAppVersion,
        canStartUpdate,
        checkForUpdates,
        boardUpdates,
        newAppVersion,
        startUpdate,
      } = useContext(UpdaterContext);

      useEffect(() => {
        if (canStartUpdate) {
          checkForUpdates(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [canStartUpdate]);

      const { data: osImageVersion } = useQuery({
        queryKey: [BoardScopedQuery.OS_IMAGE_VERSION],
        queryFn: async () => getOSImageVersion(),
        enabled: boardIsReachable,
      });

      const { data: kernelVersion } = useQuery({
        queryKey: [BoardScopedQuery.KERNEL_VERSION],
        queryFn: async () => getKernelVersion(),
        enabled: boardIsReachable,
      });

      const { data: linuxDistribution } = useQuery({
        queryKey: [BoardScopedQuery.LINUX_DISTRIBUTION],
        queryFn: async () => getLinuxDistribution(),
        enabled: boardIsReachable,
      });

      const formatReleaseDate = (
        dateString: string | undefined,
      ): string | undefined => {
        if (!dateString) return undefined;

        const year = dateString.slice(0, 4);
        const month = dateString.slice(4, 6);
        const day = dateString.slice(6, 8);

        if (!year || !month || !day) return undefined;
        const date = new Date(`${year}-${month}-${day}`);
        return date.toLocaleDateString();
      };

      return {
        currentAppVersion,
        hasBoardUpdate: !!boardUpdates,
        needsImageUpdate,
        newAppVersion,
        osImageVersion,
        osReleaseDate: formatReleaseDate(osImageVersion?.split('-')[0]),
        kernelVersion,
        linuxDistribution,
        openFlasher: () => setBoardIsFlashing(true),
        startUpdate,
      };
    };

    const useCloudConnectorSettingsLogic =
      (): ReturnType<UseCloudConnectorSettingsLogic> => {
        const [connectDialogOpen, setConnectDialogOpen] = useState(false);
        const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);

        const { user, login } = useContext(AuthContext);
        const { isConnected } = useContext(NetworkContext);
        const {
          isConnecting,
          isDisconnecting,
          status,
          removeProvisioning,
          startProvisioning,
        } = useContext(CloudConnectorContext);
        const router = useRouter();

        // Check for search params to open connector dialog
        useEffect(() => {
          const search = router.state.location.search as {
            openCloudConnectorDialog?: boolean;
          };
          if (search?.openCloudConnectorDialog) {
            setConnectDialogOpen(true);
          }
        }, [router]);

        const { data: organizations } = useQuery({
          queryKey: ['cloud-connector-organizations'],
          queryFn: async () => listCloudConnectorOrganizations(),
          enabled: boardIsReachable && !!user,
        });

        const setNetworkSettingsDialogOpen = useNetworkSettingsDialogStore(
          (state) => state.setOpen,
        );

        const connectDialogLogic: CloudConnectorConnectDialogLogic = () => ({
          isConnected: !!isConnected,
          open: connectDialogOpen,
          loggedIn: !!user,
          organizations: organizations || [],
          login,
          connect: (): void => {
            setNetworkSettingsDialogOpen(true);
            setConnectDialogOpen(false);
          },
          confirmAction: (
            organization: CloudConnectorOrganization,
          ): Promise<void> => {
            setConnectDialogOpen(false);
            return startProvisioning(organization);
          },
          onOpenChange: setConnectDialogOpen,
        });

        const disconnectDialogLogic: CloudConnectorDisconnectDialogLogic =
          () => ({
            open: disconnectDialogOpen,
            loggedIn: !!user,
            login,
            confirmAction: async (): Promise<void> => {
              setDisconnectDialogOpen(false);
              await removeProvisioning();
            },
            onOpenChange: setDisconnectDialogOpen,
          });

        return {
          status,
          isConnecting,
          isDisconnecting,
          connectBoard: () => setConnectDialogOpen(true),
          connectDialogLogic,
          disconnectBoard: () => setDisconnectDialogOpen(true),
          disconnectDialogLogic,
        };
      };

    const useTerminalSettingsLogic =
      (): ReturnType<UseTerminalSettingsLogic> => {
        const { data: catalog } = useQuery({
          queryKey: ['terminal-catalog'],
          queryFn: async () => listTerminals(),
        });

        const { data: preference } = useQuery({
          queryKey: ['terminal-preference'],
          queryFn: async () => getTerminalPreference(),
        });

        const { mutateAsync: savePreference } = useMutation({
          mutationFn: async (value: string) => setTerminalPreference(value),
          onSuccess: async () => {
            await queryClient.invalidateQueries({
              queryKey: ['terminal-preference'],
            });
          },
        });

        return {
          supported: catalog?.supported ?? false,
          terminals: catalog?.terminals ?? [],
          preference: preference ?? '',
          setPreference: async (value: string): Promise<void> => {
            await savePreference(value);
          },
        };
      };

    return {
      cloudConnectorSettingsLogic: useCloudConnectorSettingsLogic,
      boardSettingsLogic: useBoardSettingsLogic,
      boardExtensionsSettingsLogic: useBoardExtensionsSettingsLogic,
      networkModeLogic: useNetworkModeLogic,
      networkSettingsLogic: useNetworkSettingsLogic,
      systemSettingsLogic: useSystemSettingsLogic,
      passwordSettingsLogic: usePasswordSettingsLogic,
      terminalSettingsLogic: useTerminalSettingsLogic,
      onOpenExternal: openLinkExternal,
    };
  };
};
