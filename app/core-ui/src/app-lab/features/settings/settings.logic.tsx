import {
  disableCarriers,
  enableCarriers,
  getCarriers,
  getCarriersStatus,
  getConnectionName,
  getIPAddress,
  getKernelVersion,
  getLinuxDistribution,
  getOSImageVersion,
  isNetworkModeEnabled,
  listCloudConnectorOrganizations,
  openLinkExternal,
  rebootBoard,
  reloadApp,
  setNetworkMode,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import { CloudConnectorOrganization } from '@cloud-editor-mono/infrastructure';
import {
  AttachCarrierDialogLogic,
  CarriersStatus,
  CloudConnectorConnectDialogLogic,
  CloudConnectorDisconnectDialogLogic,
  PasswordDialogLogic,
  snackbar,
  UnsupportedCarrierDialogLogic,
  UseBoardSettingsLogic,
  UseCarrierSettingsLogic,
  UseCloudConnectorSettingsLogic,
  useI18n,
  UseNetworkModeLogic,
  UseNetworkSettingsLogic,
  UsePasswordSettingsLogic,
  UseSettingsLogic,
  UseSystemSettingsLogic,
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
import { BoardResourcesContext } from '../../providers/board-resources/boardResourcesContext';
import { bytesToGiB } from '../../providers/board-resources/boardResourcesContextProvider.logic';
import { CloudConnectorContext } from '../../providers/cloud-connector/cloudConnectorContext';
import { LinuxCredentialsContext } from '../../providers/linux-credentials/linuxCredentialsContext';
import { NetworkContext } from '../../providers/network/networkContext';
import { SetupContext } from '../../providers/setup/setupContext';
import { UpdaterContext } from '../../providers/updater/updaterContext';
import { useBoardLifecycleStore } from '../../store/boardLifecycle';
import { SystemPropKey } from '../../store/systemProps';
import { systemMessages } from './messages';

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

        return {
          setUserPassword,
          isLoading,
          confirmationIsError,
          isError,
          isSuccess,
          errorMsg,
          confirmationErrorMsg,
          open,
          onOpenChange: setOpen,
          openChangePasswordDialog: () => setOpen(true),
        };
      };

    const useBoardSettingsLogic = (): ReturnType<UseBoardSettingsLogic> => {
      const { resources } = useContext(BoardResourcesContext);
      const {
        keyboardLayout,
        keyboardLayouts,
        boardName,
        setBoardName,
        setKeyboardLayout,
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
      };
    };

    const useCarrierSettingsLogic = (): ReturnType<UseCarrierSettingsLogic> => {
      const [unsupported, setUnsupported] = useState(false);
      const [unsupportedOpen, setUnsupportedOpen] = useState(false);
      const [attachOpen, setAttachOpen] = useState(false);
      const [passwordOpen, setPasswordOpen] = useState(false);
      const [status, setStatus] = useState<CarriersStatus>({ carriers: [] });

      const enabled = status.carriers.some((carrier) => carrier.nextEnabled);
      const pristine = status.carriers.every(
        (carrier) =>
          carrier.nextEnabled === carrier.currentEnabled &&
          carrier.next.every((media) =>
            carrier.current.some(
              (currentMedia) =>
                currentMedia.device === media.device &&
                currentMedia.option === media.option,
            ),
          ),
      );

      const setEnabled = (isEnabled: boolean): void => {
        setStatus((status) => ({
          ...status,
          carriers: status.carriers.map((carrier) => ({
            ...carrier,
            nextEnabled: isEnabled,
          })),
        }));
      };

      const { data: carriers } = useQuery(
        [BoardScopedQuery.CARRIERS],
        async () => getCarriers(),
        {
          enabled: boardIsReachable,
          initialData: [],
          onError: () => {
            setUnsupported(true);
          },
        },
      );

      useQuery(
        [BoardScopedQuery.CARRIERS_STATUS],
        async () => getCarriersStatus(),
        {
          enabled: boardIsReachable,
          onSuccess: (data) => {
            if (data) {
              setStatus({
                carriers: data.carriers.map((carrier) => ({
                  ...carrier,
                  next: carrier.current,
                  nextEnabled: carrier.currentEnabled,
                })),
              });
            }
          },
          onError: () => {
            setUnsupported(true);
          },
        },
      );

      const { systemProps, upsertProp } = useSystemProps();

      const { boardUpdates, startUpdate } = useContext(UpdaterContext);
      const unsupportedLogic: UnsupportedCarrierDialogLogic = () => {
        return {
          open: unsupportedOpen,
          confirm: async (): Promise<void> => {
            setUnsupportedOpen(false);
            if (boardUpdates) {
              startUpdate();
            }
          },
          onOpenChange: setUnsupportedOpen,
        };
      };

      const attachLogic: AttachCarrierDialogLogic = () => {
        return {
          open: attachOpen,
          confirm: async (remember: boolean): Promise<void> => {
            if (remember) {
              upsertProp({
                key: SystemPropKey.CarrierAcknowledged,
                value: 'true',
              });
            }
            setAttachOpen(false);
            setEnabled(true);
          },
          onOpenChange: setAttachOpen,
        };
      };

      const reboot = async (password: string): Promise<void> => {
        await rebootBoard(password);
        reloadApp();
      };

      const {
        isError: isEnablingCarriersError,
        isLoading: isEnablingCarriers,
        isSuccess: isEnablingCarriersSuccess,
        mutateAsync: setCarriers,
      } = useMutation({
        mutationFn: (password: string) => enableCarriers(status, password),
        onSuccess: async (_, password) => {
          await reboot(password);
        },
      });

      const {
        isError: isDisablingCarriersError,
        isLoading: isDisablingCarriers,
        isSuccess: isDisablingCarriersSuccess,
        mutateAsync: resetCarriers,
      } = useMutation({
        mutationFn: (password: string) => disableCarriers(carriers, password),
        onSuccess: async (_, password) => {
          await reboot(password);
        },
      });

      const passwordLogic: PasswordDialogLogic = {
        open: passwordOpen,
        onOpenChange: setPasswordOpen,
        onConfirm: async (password: string): Promise<void> =>
          enabled ? setCarriers(password) : resetCarriers(password),
        isLoading: enabled ? isEnablingCarriers : isDisablingCarriers,
        isSuccess: enabled
          ? isEnablingCarriersSuccess
          : isDisablingCarriersSuccess,
        error:
          (enabled && isEnablingCarriersError) ||
          (!enabled && isDisablingCarriersError)
            ? 'password'
            : undefined,
      };

      const handleEnabledChange = (isEnabled: boolean): void => {
        if (isEnabled) {
          if (unsupported) {
            setUnsupportedOpen(true);
          } else if (!systemProps?.[SystemPropKey.CarrierAcknowledged]) {
            setAttachOpen(true);
          } else {
            setEnabled(true);
          }
        } else {
          setEnabled(false);
        }
      };

      const handleStatusChange = (
        carrierName: string,
        device: string,
        option: string,
      ): void => {
        setStatus((prev) => ({
          carriers: prev.carriers.map((carrier) => {
            if (carrier.carrierName !== carrierName) return carrier;

            return {
              ...carrier,
              next: carrier.next.map((media) => {
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

      return {
        enabled,
        pristine,
        onEnabledChange: handleEnabledChange,
        carriers,
        status,
        setStatus: handleStatusChange,
        unsupportedLogic,
        attachLogic,
        passwordLogic,
      };
    };

    const useNetworkModeLogic = (): ReturnType<UseNetworkModeLogic> => {
      const [open, setOpen] = useState(false);

      const { data: networkModeEnabled } = useQuery(
        [BoardScopedQuery.NETWORK_MODE_ENABLED],
        async () => isNetworkModeEnabled(),
        {
          enabled: boardIsReachable,
        },
      );

      const {
        error: networkModeError,
        isError: isNetworkModeError,
        isLoading: isSettingNetworkMode,
        isSuccess: isSettingNetworkModeSuccess,
        mutateAsync: updateNetworkMode,
      } = useMutation({
        mutationFn: (prop: { enabled: boolean; password: string }) =>
          setNetworkMode(prop.enabled, prop.password),
        onSuccess: (enabled: boolean) => {
          queryClient.setQueryData(
            [BoardScopedQuery.NETWORK_MODE_ENABLED],
            enabled,
          );
          snackbar({
            message: formatMessage(systemMessages.remoteAccessToggle, {
              enabled: enabled ? 'enabled' : 'disabled',
            }),
            variant: 'success',
          });
        },
        onSettled: () => {
          queryClient.invalidateQueries([
            BoardScopedQuery.NETWORK_MODE_ENABLED,
          ]);
        },
      });

      return {
        open,
        onOpenChange: setOpen,
        isNetworkModeEnabled: networkModeEnabled,
        onConfirm: (password: string) =>
          updateNetworkMode({ enabled: !networkModeEnabled, password }),
        isLoading: isSettingNetworkMode,
        isSuccess: isSettingNetworkModeSuccess,
        error: isNetworkModeError
          ? (Array.isArray(networkModeError)
              ? networkModeError
              : [String(networkModeError)]
            ).some((error) => error.includes('password'))
            ? 'password'
            : 'generic'
          : undefined,
      };
    };

    const [networkSettingsDialogOpen, setNetworkSettingsDialogOpen] =
      useState(false);
    const useNetworkSettingsLogic = (): ReturnType<UseNetworkSettingsLogic> => {
      const networkContext = useContext(NetworkContext);
      const router = useRouter();
      const { offlineWarningOpen } = useContext(SetupContext);

      useEffect(() => {
        networkContext.setManualNetworkSetup(false);
        networkContext.setSelectedNetwork(undefined);
        networkContext.setScanningIsEnabled(networkSettingsDialogOpen);
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [networkSettingsDialogOpen]);

      useEffect(() => {
        if (networkContext.connectRequestIsSuccess) {
          setNetworkSettingsDialogOpen(false);
        }
      }, [networkContext.connectRequestIsSuccess]);

      // Close network settings dialog when offline warning opens
      useEffect(() => {
        if (offlineWarningOpen) {
          setNetworkSettingsDialogOpen(false);
        }
      }, [offlineWarningOpen]);

      // Check for search params to open network dialog
      useEffect(() => {
        const search = router.state.location.search as {
          openNetworkDialog?: boolean;
        };
        if (search?.openNetworkDialog) {
          setNetworkSettingsDialogOpen(true);
        }
      }, [router]);

      const { data: selectedConnectedNetwork } = useQuery(
        [BoardScopedQuery.CONNECTION_NAME],
        async () => getConnectionName(),
        {
          enabled: boardIsReachable && networkContext.isConnected,
        },
      );

      const { data: selectedConnectedIPAddress } = useQuery(
        [BoardScopedQuery.IP_ADDRESS],
        async () => getIPAddress(),
        {
          enabled: boardIsReachable && networkContext.isConnected,
        },
      );

      return {
        ...networkContext,
        selectedConnectedNetwork,
        selectedConnectedIPAddress,
        open: networkSettingsDialogOpen,
        onOpenChange: setNetworkSettingsDialogOpen,
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

      const { data: osImageVersion } = useQuery(
        [BoardScopedQuery.OS_IMAGE_VERSION],
        async () => getOSImageVersion(),
        {
          enabled: boardIsReachable,
        },
      );

      const { data: kernelVersion } = useQuery(
        [BoardScopedQuery.KERNEL_VERSION],
        async () => getKernelVersion(),
        {
          enabled: boardIsReachable,
        },
      );

      const { data: linuxDistribution } = useQuery(
        [BoardScopedQuery.LINUX_DISTRIBUTION],
        async () => getLinuxDistribution(),
        {
          enabled: boardIsReachable,
        },
      );

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

        const { data: organizations } = useQuery(
          ['cloud-connector-organizations'],
          async () => listCloudConnectorOrganizations(),
          {
            enabled: boardIsReachable && !!user,
          },
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

    return {
      cloudConnectorSettingsLogic: useCloudConnectorSettingsLogic,
      boardSettingsLogic: useBoardSettingsLogic,
      carrierSettingsLogic: useCarrierSettingsLogic,
      networkModeLogic: useNetworkModeLogic,
      networkSettingsLogic: useNetworkSettingsLogic,
      systemSettingsLogic: useSystemSettingsLogic,
      passwordSettingsLogic: usePasswordSettingsLogic,
      onOpenExternal: openLinkExternal,
    };
  };
};
