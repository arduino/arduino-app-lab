import * as domain from '@cloud-editor-mono/domain';
import {
  ArduinoBuilderBoardv3Full_BuilderApi,
  SketchData,
} from '@cloud-editor-mono/infrastructure';
import { Preferences, PreferenceValue } from '@cloud-editor-mono/ui-components';
import { renderHook, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { act } from 'react-dom/test-utils';
import { BehaviorSubject } from 'rxjs';

import TestProviderWrapper, {
  test_ReemitMappedPorts,
  test_RemoveAllMappedPorts,
} from '../../../../../tests-setup';
import * as preferencesHooks from '../../../../common/hooks/preferences';
import { portSelectionReset } from '../portSelection.reactive';
import { useBoardsConfig } from './boards';
import {
  addMkr1010MappedPort,
  addUnoMappedPort,
  addUnoTwoMappedPort,
  fqbnQueryData,
  iotDevicesGroupsEmpty,
  iotDevicesGroupsWithESP32Online,
  iotDevicesGroupsWithOneOnline,
  mockESP32,
  mockIotESP32Online,
  mockIotUnoOnline,
  mockMkrWifi1010,
  mockPromptBoardConfigSelection,
  mockUno,
  mockUnoTwo,
  promptedSelection,
  removeUnoMappedPort,
  resetPromptedSelection,
  sketchId,
} from './boards.test.utils';

vi.mock('../../../../common/hooks/preferences', async () => {
  const preferencesHooks = await vi.importActual<
    typeof import('../../../../common/hooks/preferences')
  >('../../../../common/hooks/preferences');
  return {
    ...preferencesHooks,
    usePreferenceObservable: vi.fn(),
  };
});

vi.mock('@cloud-editor-mono/domain', async () => {
  const domain = await vi.importActual<
    typeof import('@cloud-editor-mono/domain')
  >('@cloud-editor-mono/domain');

  return {
    ...domain,
    ga4Emitter: () => {
      return;
    },
    getBoardByFqbn: async ({
      fqbn,
    }: {
      fqbn: string;
    }): Promise<ArduinoBuilderBoardv3Full_BuilderApi | undefined> => {
      return fqbnQueryData[fqbn];
    },
    associateSketchWithDevice: vi.fn(),
    getPreferencesSubjectById: vi.fn(),
    getAllSupportedBoards: async (): Promise<{ boards: [] }> => {
      return { boards: [] };
    },
  };
});

describe('call useBoardsConfig: sketch route', () => {
  const boardAutoSelectionOutputSubject = new BehaviorSubject<PreferenceValue>(
    Preferences.BoardAutoSelection,
  );

  beforeAll(() => {
    vi.mocked(domain.getPreferencesSubjectById).mockResolvedValue(
      boardAutoSelectionOutputSubject,
    );
    vi.mocked(preferencesHooks.usePreferenceObservable).mockReturnValue(true);
  });

  beforeEach(() => {
    test_RemoveAllMappedPorts();
    portSelectionReset();
    resetPromptedSelection();
  });

  describe('on sketch route, regular sketch', () => {
    it('when metadata is loading, auto selection should not occur when port appears', async () => {
      const { result } = renderHook(
        () =>
          useBoardsConfig(
            false,
            false,
            (_: Partial<SketchData>) => {
              return;
            },
            mockPromptBoardConfigSelection,
            null,
            null,
            null,
            null,
            null,
            false,
            undefined,
            undefined,
          ),
        {
          wrapper: TestProviderWrapper,
        },
      );

      await waitFor(() => {
        expect(result.current.selectedFqbn).toBeUndefined();
        expect(result.current.selectedPort).toBeUndefined();
      });

      act(() => {
        addUnoMappedPort();
      });

      await waitFor(() => {
        expect(
          result.current.detectedDevices.find(
            (d) => d.portBoardId === mockUno.portBoardId,
          ),
        ).toBeTruthy();
        expect(result.current.selectedFqbn).toBeUndefined();
        expect(result.current.selectedPort).toBeUndefined();
      });
    });

    it('auto selection should not occur when a port is already selected', async () => {
      const { result } = renderHook(
        () =>
          useBoardsConfig(
            false,
            false,
            (_: Partial<SketchData>) => {
              return;
            },
            mockPromptBoardConfigSelection,
            sketchId,
            '',
            '',
            '',
            '',
            false,
            undefined,
            undefined,
          ),
        {
          wrapper: TestProviderWrapper,
        },
      );

      await waitFor(() => {
        expect(result.current.selectedFqbn).toBeUndefined();
        expect(result.current.selectedPort).toBeUndefined();
      });

      act(() => {
        addUnoMappedPort();
      });

      await waitFor(() => {
        expect(
          result.current.detectedDevices.find(
            (d) => d.portBoardId === mockUno.portBoardId,
          ),
        ).toBeTruthy();
      });

      act(() => {
        result.current.setDetectedBoardAndPort(mockUno.portBoardId);
      });

      await waitFor(() => {
        expect(result.current.selectedFqbn).toEqual(mockUno.fqbn);
        expect(result.current.selectedPort).toEqual(mockUno.portName);
      });

      act(() => {
        addMkr1010MappedPort();
      });

      await waitFor(() => {
        expect(
          result.current.detectedDevices.find(
            (d) => d.portBoardId === mockMkrWifi1010.portBoardId,
          ),
        ).toBeTruthy();
        expect(result.current.selectedFqbn).toEqual(mockUno.fqbn);
        expect(result.current.selectedPort).toEqual(mockUno.portName);
      });
    });

    it('after empty metadata is loaded, auto selection should occur when port appears', async () => {
      const { result } = renderHook(
        () =>
          useBoardsConfig(
            false,
            false,
            (_: Partial<SketchData>) => {
              return;
            },
            mockPromptBoardConfigSelection,
            sketchId,
            '',
            '',
            '',
            'serial',
            false,
            undefined,
            undefined,
          ),
        {
          wrapper: TestProviderWrapper,
        },
      );

      await waitFor(() => {
        expect(result.current.selectedFqbn).toBeUndefined();
        expect(result.current.selectedPort).toBeUndefined();
      });

      act(() => {
        addUnoMappedPort();
      });

      await waitFor(() => {
        expect(
          result.current.detectedDevices.find(
            (d) => d.portBoardId === mockUno.portBoardId,
          ),
        ).toBeTruthy();
        expect(result.current.selectedFqbn).toEqual(mockUno.fqbn);
        expect(result.current.selectedPort).toEqual(mockUno.portName);
        expect(result.current.selectedBoard).toEqual(mockUno.name);
      });
    });

    it('after empty metadata is loaded, auto selection should not occur when flavour options change', async () => {
      const { result } = renderHook(
        () =>
          useBoardsConfig(
            false,
            false,
            (_: Partial<SketchData>) => {
              return;
            },
            mockPromptBoardConfigSelection,
            sketchId,
            '',
            '',
            '',
            'serial',
            false,
            undefined,
            undefined,
          ),
        {
          wrapper: TestProviderWrapper,
        },
      );

      await waitFor(() => {
        expect(result.current.selectedFqbn).toBeUndefined();
        expect(result.current.selectedPort).toBeUndefined();
      });

      act(() => {
        result.current.setUndetectedBoard(
          mockESP32.fqbn,
          mockESP32.name,
          mockESP32.architecture,
        );
      });

      await waitFor(() => {
        expect(result.current.selectedFqbn).toEqual(
          `${mockESP32.fqbn}${result.current.selectedFlavourString}`,
        );

        expect(result.current.selectedBoardFlavourOptions).toBeTruthy();
        if (result.current.selectedBoardFlavourOptions) {
          expect(
            result.current.selectedBoardFlavourOptions[0].variants[0].selected,
          ).toBeTruthy();
        }
      });

      act(() => {
        addUnoMappedPort();
      });

      await waitFor(() => {
        expect(result.current.selectedFqbn).toEqual(
          `${mockESP32.fqbn}${result.current.selectedFlavourString}`,
        );
        expect(result.current.selectedPort).toBeUndefined();
      });

      act(() => {
        if (!result.current.selectedBoardFlavourOptions) return;
        result.current.selectFlavourOptionById(
          result.current.selectedBoardFlavourOptions[0].id,
          result.current.selectedBoardFlavourOptions[0].variants[1].id,
        );
      });

      await waitFor(() => {
        expect(result.current.selectedFqbn).toEqual(
          `${mockESP32.fqbn}${result.current.selectedFlavourString}`,
        );

        expect(result.current.selectedBoardFlavourOptions).toBeTruthy();
        if (result.current.selectedBoardFlavourOptions) {
          expect(
            result.current.selectedBoardFlavourOptions[0].variants[1].selected,
          ).toBeTruthy();
        }

        expect(result.current.selectedPort).toBeUndefined();
      });
    });

    it('after empty metadata is loaded, and selection has occurred, detach and manual selection should not corrupt auto-selection', async () => {
      const { result } = renderHook(
        () =>
          useBoardsConfig(
            false,
            false,
            (_: Partial<SketchData>) => {
              return;
            },
            mockPromptBoardConfigSelection,
            sketchId,
            '',
            '',
            '',
            'serial',
            false,
            undefined,
            undefined,
          ),
        {
          wrapper: TestProviderWrapper,
        },
      );

      await waitFor(() => {
        expect(result.current.selectedFqbn).toBeUndefined();
        expect(result.current.selectedPort).toBeUndefined();
      });

      act(() => {
        addUnoMappedPort();
      });

      await waitFor(() => {
        expect(
          result.current.detectedDevices.find(
            (d) => d.portBoardId === mockUno.portBoardId,
          ),
        ).toBeTruthy();
        expect(result.current.selectedFqbn).toEqual(mockUno.fqbn);
        expect(result.current.selectedPort).toEqual(mockUno.portName);
      });

      act(() => {
        result.current.setDetectedBoardAndPort('');
      });

      await waitFor(() => {
        expect(result.current.selectedFqbn).toBeUndefined();
        expect(result.current.selectedPort).toBeUndefined();
      });

      act(() => {
        removeUnoMappedPort();
        addUnoMappedPort();
      });

      await waitFor(() => {
        expect(
          result.current.detectedDevices.find(
            (d) => d.portBoardId === mockUno.portBoardId,
          ),
        ).toBeTruthy();
        expect(result.current.selectedFqbn).toEqual(mockUno.fqbn);
        expect(result.current.selectedPort).toEqual(mockUno.portName);
      });

      act(() => {
        result.current.setUndetectedBoard('', '', '');
      });

      await waitFor(() => {
        expect(result.current.selectedFqbn).toBeUndefined();
        expect(result.current.selectedPort).toBeUndefined();
      });

      act(() => {
        addMkr1010MappedPort();
      });

      await waitFor(() => {
        expect(
          result.current.detectedDevices.find(
            (d) => d.portBoardId === mockUno.portBoardId,
          ),
        ).toBeTruthy();
        expect(
          result.current.detectedDevices.find(
            (d) => d.portBoardId === mockMkrWifi1010.portBoardId,
          ),
        ).toBeTruthy();
        expect(promptedSelection).toBeTruthy();
      });

      act(() => {
        result.current.setUndetectedBoard(
          mockUno.fqbn,
          mockUno.name,
          mockUno.architecture,
        );
      });

      await waitFor(() => {
        expect(result.current.selectedFqbn).toEqual(mockUno.fqbn);
        expect(result.current.selectedPort).toBeUndefined();
      });
    });

    it('after empty metadata is loaded, a failing compile should not auto-select a port, successful should select matching port', async () => {
      const { result } = renderHook(
        () => {
          const [metadata, setMetadata] = useState({
            fqbn: '',
            name: '',
            architecture: '',
          });

          const result = useBoardsConfig(
            false,
            false,
            (_: Partial<SketchData>) => {
              setMetadata({
                fqbn: '',
                name: '',
                architecture: '',
              });
            },
            mockPromptBoardConfigSelection,
            sketchId,
            metadata.fqbn,
            metadata.name,
            metadata.architecture,
            'serial',
            false,
            undefined,
            undefined,
          );

          return {
            ...result,
            setMetadata,
          };
        },
        {
          wrapper: TestProviderWrapper,
        },
      );

      act(() => {
        addUnoMappedPort();
      });

      await waitFor(() => {
        expect(
          result.current.detectedDevices.find(
            (d) => d.portBoardId === mockUno.portBoardId,
          ),
        ).toBeTruthy();
        expect(result.current.selectedFqbn).toEqual(mockUno.fqbn);
        expect(result.current.selectedPort).toEqual(mockUno.portName);
      });

      act(() => {
        // first detach, as a user cannot manually select a board that is already
        // selected with a port
        result.current.setUndetectedBoard('', '', '');
      });

      await waitFor(() => {
        expect(result.current.selectedFqbn).toBeUndefined();
        expect(result.current.selectedPort).toBeUndefined();
      });

      act(() => {
        // select the detected board but without the port
        result.current.setUndetectedBoard(
          mockUno.fqbn,
          mockUno.name,
          mockUno.architecture,
        );
      });

      await waitFor(() => {
        expect(result.current.selectedFqbn).toEqual(mockUno.fqbn);
        expect(result.current.selectedPort).toBeUndefined();
      });

      // ** failing compile with Uno, no port
      act(() => {
        // simulates a failing compile, where we set the bypass flag to avoid
        // the refresh of the serialcomm context upload stream triggering
        // auto-selection
        result.current.addGenericBypassAutoSelection();
        test_ReemitMappedPorts();
      });

      await waitFor(() => {
        expect(result.current.selectedFqbn).toEqual(mockUno.fqbn);
        expect(result.current.selectedPort).toBeUndefined();
      });
      // **

      // ** successful compile with Uno, matching port
      act(() => {
        result.current.addGenericBypassAutoSelection();
        test_ReemitMappedPorts();

        // simulate a successful compile
        result.current.setMetadata({
          name: mockUno.name,
          fqbn: mockUno.fqbn,
          architecture: mockUno.architecture,
        });
      });

      await waitFor(() => {
        expect(result.current.selectedFqbn).toEqual(mockUno.fqbn);
        expect(result.current.selectedPort).toEqual(mockUno.portName);
      });
      // **

      act(() => {
        result.current.setUndetectedBoard('', '', '');
      });

      await waitFor(() => {
        expect(result.current.selectedFqbn).toBeUndefined();
        expect(result.current.selectedPort).toBeUndefined();
      });

      act(() => {
        result.current.setUndetectedBoard(
          mockMkrWifi1010.fqbn,
          mockMkrWifi1010.name,
          mockMkrWifi1010.architecture,
        );
      });

      await waitFor(() => {
        expect(result.current.selectedFqbn).toEqual(mockMkrWifi1010.fqbn);
        expect(result.current.selectedPort).toBeUndefined();
      });

      // ** successful compile with MkrWifi1010, no matching port
      act(() => {
        result.current.addGenericBypassAutoSelection();
        test_ReemitMappedPorts();

        result.current.setMetadata({
          name: mockMkrWifi1010.name,
          fqbn: mockMkrWifi1010.fqbn,
          architecture: mockMkrWifi1010.architecture,
        });
      });

      await waitFor(() => {
        expect(result.current.selectedFqbn).toEqual(mockMkrWifi1010.fqbn);
        expect(result.current.selectedPort).toBeUndefined();
      });
      // **
    });

    it('after empty metadata is loaded, user should be prompted when > 1 board appears', async () => {
      const { result } = renderHook(
        () =>
          useBoardsConfig(
            false,
            false,
            (_: Partial<SketchData>) => {
              return;
            },
            mockPromptBoardConfigSelection,
            sketchId,
            '',
            '',
            '',
            'serial',
            false,
            undefined,
            undefined,
          ),
        {
          wrapper: TestProviderWrapper,
        },
      );

      await waitFor(() => {
        expect(result.current.selectedFqbn).toBeUndefined();
        expect(result.current.selectedPort).toBeUndefined();
      });

      act(() => {
        addUnoMappedPort();
        addMkr1010MappedPort();
      });

      await waitFor(() => {
        expect(
          result.current.detectedDevices.find(
            (d) => d.portBoardId === mockUno.portBoardId,
          ),
        ).toBeTruthy();
        expect(
          result.current.detectedDevices.find(
            (d) => d.portBoardId === mockMkrWifi1010.portBoardId,
          ),
        ).toBeTruthy();
        expect(promptedSelection).toBeTruthy();
      });
    });

    it('after populated metadata is loaded, auto selection should occur when one matching board appears', async () => {
      const { result } = renderHook(
        () =>
          useBoardsConfig(
            false,
            false,
            (_: Partial<SketchData>) => {
              return;
            },
            mockPromptBoardConfigSelection,
            sketchId,
            mockMkrWifi1010.fqbn,
            mockMkrWifi1010.name,
            mockMkrWifi1010.architecture,
            'serial',
            false,
            undefined,
            undefined,
          ),
        {
          wrapper: TestProviderWrapper,
        },
      );

      await waitFor(() => {
        expect(result.current.selectedFqbn).toEqual(mockMkrWifi1010.fqbn);
        expect(result.current.selectedPort).toBeUndefined();
      });

      act(() => {
        addUnoMappedPort();
      });

      await waitFor(() => {
        expect(result.current.selectedFqbn).toEqual(mockMkrWifi1010.fqbn);
        expect(result.current.selectedPort).toBeUndefined();
      });

      act(() => {
        addMkr1010MappedPort();
      });

      await waitFor(() => {
        expect(
          result.current.detectedDevices.find(
            (d) => d.portBoardId === mockMkrWifi1010.portBoardId,
          ),
        ).toBeTruthy();
        expect(result.current.selectedFqbn).toEqual(mockMkrWifi1010.fqbn);
        expect(result.current.selectedPort).toEqual(mockMkrWifi1010.portName);
      });
    });

    it('after populated metadata is loaded, user should be prompted when > 1 matching board appears', async () => {
      const { result } = renderHook(
        () =>
          useBoardsConfig(
            false,
            false,
            (_: Partial<SketchData>) => {
              return;
            },
            mockPromptBoardConfigSelection,
            sketchId,
            mockUno.fqbn,
            mockUno.name,
            mockUno.architecture,
            'serial',
            false,
            undefined,
            undefined,
          ),
        {
          wrapper: TestProviderWrapper,
        },
      );

      await waitFor(() => {
        expect(result.current.selectedFqbn).toEqual(mockUno.fqbn);
        expect(result.current.selectedPort).toBeUndefined();
      });

      act(() => {
        addUnoMappedPort();
        addUnoTwoMappedPort();
      });

      await waitFor(() => {
        expect(
          result.current.detectedDevices.find(
            (d) => d.portBoardId === mockUno.portBoardId,
          ),
        ).toBeTruthy();
        expect(
          result.current.detectedDevices.find(
            (d) => d.portBoardId === mockUnoTwo.portBoardId,
          ),
        ).toBeTruthy();
        expect(result.current.manyBoardsMatchMetadata).toBeTruthy();
      });
    });
  });

  describe('on sketch route, iot sketch', () => {
    it('after populated metadata is loaded, auto selection should not occur when there is no matching iot board', async () => {
      const { result } = renderHook(
        () =>
          useBoardsConfig(
            false,
            false,
            (_: Partial<SketchData>) => {
              return;
            },
            mockPromptBoardConfigSelection,
            sketchId,
            iotDevicesGroupsWithOneOnline.online[0].fqbn || null,
            iotDevicesGroupsWithOneOnline.online[0].name || null,
            iotDevicesGroupsWithOneOnline.online[0].architecture || null,
            'cloud',
            true,
            iotDevicesGroupsWithOneOnline.online[0].id || null,
            iotDevicesGroupsEmpty,
          ),
        {
          wrapper: TestProviderWrapper,
        },
      );

      await waitFor(() => {
        expect(result.current.iotDevicesWithAssociationProp).toBeTruthy();
        expect(result.current.selectedFqbn).toBeUndefined();
        expect(result.current.selectedPort).toBeUndefined();
      });

      act(() => {
        addUnoMappedPort();
      });

      await waitFor(() => {
        expect(
          result.current.detectedDevices.find(
            (d) => d.portBoardId === mockUno.portBoardId,
          ),
        ).toBeTruthy();
        expect(result.current.selectedFqbn).toBeUndefined();
        expect(result.current.selectedPort).toBeUndefined();
      });
    });

    it('after populated metadata is loaded, auto selection should occur when matching iot board appears', async () => {
      const { result } = renderHook(
        () =>
          useBoardsConfig(
            false,
            false,
            (_: Partial<SketchData>) => {
              return;
            },
            mockPromptBoardConfigSelection,
            sketchId,
            iotDevicesGroupsWithOneOnline.online[0].fqbn || null,
            iotDevicesGroupsWithOneOnline.online[0].name || null,
            iotDevicesGroupsWithOneOnline.online[0].architecture || null,
            'cloud',
            true,
            iotDevicesGroupsWithOneOnline.online[0].id || null,
            iotDevicesGroupsWithOneOnline,
          ),
        {
          wrapper: TestProviderWrapper,
        },
      );

      await waitFor(() => {
        expect(result.current.iotDevicesWithAssociationProp).toBeTruthy();
        if (result.current.iotDevicesWithAssociationProp) {
          expect(
            result.current.iotDevicesWithAssociationProp.online.find(
              (d) =>
                d.portBoardId ===
                iotDevicesGroupsWithOneOnline.online[0].portBoardId,
            ),
          ).toBeTruthy();
        }
        expect(result.current.selectedFqbn).toEqual(
          iotDevicesGroupsWithOneOnline.online[0].fqbn,
        );
        expect(result.current.selectedPort).toEqual(
          iotDevicesGroupsWithOneOnline.online[0].portName,
        );
      });
    });

    it('after populated metadata is loaded, a detected online ESP32 should be selectable', async () => {
      const { result } = renderHook(
        () =>
          useBoardsConfig(
            false,
            false,
            (_: Partial<SketchData>) => {
              return;
            },
            mockPromptBoardConfigSelection,
            sketchId,
            iotDevicesGroupsWithESP32Online.online[0].fqbn || null,
            iotDevicesGroupsWithESP32Online.online[0].name || null,
            iotDevicesGroupsWithESP32Online.online[0].architecture || null,
            'cloud',
            true,
            iotDevicesGroupsWithOneOnline.online[0].id || null,
            iotDevicesGroupsWithESP32Online,
          ),
        {
          wrapper: TestProviderWrapper,
        },
      );

      await waitFor(() => {
        expect(result.current.selectedFqbn).toEqual(mockIotESP32Online.fqbn);
        expect(result.current.selectedPort).toEqual(
          mockIotESP32Online.portName,
        );
      });

      act(() => {
        result.current.setDetectedBoardAndPort('');
      });

      await waitFor(() => {
        expect(result.current.selectedFqbn).toBeUndefined();
        expect(result.current.selectedPort).toBeUndefined();
      });

      act(() => {
        result.current.setDetectedBoardAndPort(
          mockIotESP32Online.portBoardId,
          true,
        );
      });

      await waitFor(() => {
        expect(result.current.selectedBoardFlavourOptions).toBeTruthy();
        expect(result.current.selectedFqbn).toEqual(
          `${mockIotESP32Online.fqbn}${result.current.selectedFlavourString}`,
        );
        expect(result.current.selectedPort).toEqual(
          mockIotESP32Online.portName,
        );
      });
    });

    it('after populated metadata is loaded, a usb device matching iot metadata should be automatically selected, until the user switches to OTA', async () => {
      const { result } = renderHook(
        () =>
          useBoardsConfig(
            false,
            false,
            (_: Partial<SketchData>) => {
              return;
            },
            mockPromptBoardConfigSelection,
            sketchId,
            iotDevicesGroupsWithOneOnline.online[0].fqbn || null,
            iotDevicesGroupsWithOneOnline.online[0].name || null,
            iotDevicesGroupsWithOneOnline.online[0].architecture || null,
            'cloud',
            true,
            iotDevicesGroupsWithOneOnline.online[0].id || null,
            iotDevicesGroupsWithOneOnline,
          ),
        {
          wrapper: TestProviderWrapper,
        },
      );

      await waitFor(() => {
        expect(result.current.iotDevicesWithAssociationProp).toBeTruthy();
        if (result.current.iotDevicesWithAssociationProp) {
          expect(
            result.current.iotDevicesWithAssociationProp.online.find(
              (d) =>
                d.portBoardId ===
                iotDevicesGroupsWithOneOnline.online[0].portBoardId,
            ),
          ).toBeTruthy();
        }
        expect(result.current.selectedFqbn).toEqual(
          iotDevicesGroupsWithOneOnline.online[0].fqbn,
        );
        expect(result.current.selectedPort).toEqual(
          iotDevicesGroupsWithOneOnline.online[0].portName,
        );
      });

      act(() => {
        addUnoMappedPort();
      });

      await waitFor(() => {
        expect(
          result.current.detectedDevices.find(
            (d) => d.portBoardId === mockUno.portBoardId,
          ),
        ).toBeTruthy();
        expect(result.current.selectedPortBoardId).toEqual(mockUno.portBoardId);
      });

      act(() => {
        result.current.switchToAltPort();
      });

      await waitFor(() => {
        expect(result.current.selectedPortBoardId).toEqual(
          mockIotUnoOnline.portBoardId,
        );
        expect(result.current.selectedDeviceAltPortBoardId?.id).toEqual(
          mockUno.portBoardId,
        );
      });

      act(() => {
        removeUnoMappedPort();
      });

      await waitFor(() => {
        expect(result.current.selectedPortBoardId).toEqual(
          mockIotUnoOnline.portBoardId,
        );
        expect(result.current.selectedDeviceAltPortBoardId?.id).toEqual(
          undefined,
        );
      });

      act(() => {
        addUnoMappedPort();
      });

      await waitFor(() => {
        expect(result.current.selectedPortBoardId).toEqual(mockUno.portBoardId);
        expect(result.current.selectedDeviceAltPortBoardId?.id).toEqual(
          mockIotUnoOnline.portBoardId,
        );
      });
    });
  });

  describe('on example route', () => {
    it('when metadata is loading, auto selection should occur when port appears', async () => {
      const { result } = renderHook(
        () =>
          useBoardsConfig(
            true,
            false,
            (_: Partial<SketchData>) => {
              return;
            },
            mockPromptBoardConfigSelection,
            null,
            null,
            null,
            null,
            null,
            false,
            undefined,
            undefined,
          ),
        {
          wrapper: TestProviderWrapper,
        },
      );

      act(() => {
        addUnoMappedPort();
      });

      await waitFor(() => {
        expect(
          result.current.detectedDevices.find(
            (d) => d.portBoardId === mockUno.portBoardId,
          ),
        ).toBeTruthy();
        expect(result.current.selectedFqbn).toEqual(mockUno.fqbn);
        expect(result.current.selectedPort).toEqual(mockUno.portName);
      });
    });
  });
});
