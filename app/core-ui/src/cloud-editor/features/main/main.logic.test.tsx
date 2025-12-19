import { assertNonNull } from '@cloud-editor-mono/common';
import * as domain from '@cloud-editor-mono/domain';
import {
  codeSubjectNext,
  DEFAULT_SKETCH_NAME,
  DEFAULT_SKETCH_USER_ID,
  defaultSketchInoContent,
  getCodeSubjectById,
  GetSketchResult,
  setCodeSubjects,
} from '@cloud-editor-mono/domain';
import {
  GetFilesList_Response,
  GetSketch_Response,
} from '@cloud-editor-mono/infrastructure';
import {
  ConsoleOutput,
  Preferences,
  PreferenceValue,
} from '@cloud-editor-mono/ui-components';
import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import { BehaviorSubject } from 'rxjs';

import TestProviderWrapper from '../../../../tests-setup';
import { getSelectedCodeObservableValue } from '../../../common/hooks/code';
import { useFiles } from '../../../common/hooks/files';
import * as preferencesHooks from '../../../common/hooks/preferences';
import { useCoreCommands } from './hooks/coreCommands';
import * as sketchHooks from './hooks/sketch';
import { useGetSketchStartUpQueries } from './hooks/startup';

const DEFAULT_SKETCH = {
  user_id: DEFAULT_SKETCH_USER_ID,
  name: DEFAULT_SKETCH_NAME,
  path: DEFAULT_SKETCH_NAME,
  ino: defaultSketchInoContent,
};

const SKETCH_BY_ID_DATA = {
  user_id: 'me',
  path: 'my_selected_sketch',
  name: 'my_selected_sketch',
  ino: 'LyoNDSovDQ12b2lkIHNldHVwKCkgew0gICAgDX0NDXZvaWQgbG9vcCgpIHsNICAgIA19DQ==',
};

const SOME_FQBN = 'arduino:avr:uno';

const SOME_PORT = 'COM1';

const SOME_FILES_DATA: GetFilesList_Response = [
  {
    href: '/mock_name/mock_name.ino',
    name: 'mock_name',
    mimetype: 'mock_mimetype',
    modifiedAt: 'mock_modifiedAt',
    path: 'mock_name/mock_name.ino',
    type: 'file',
  },
  {
    href: 'another_mock_href',
    mimetype: 'another_mock_mimetype',
    modifiedAt: 'another_mock_modifiedAt',
    path: 'mock_name/another_mock_path.h',
    name: 'another_mock_name',
    type: 'file',
  },
];

const SOME_INO_DATA = {
  ...SOME_FILES_DATA[0],
  fullName: 'mock_name.ino',
  content: 'some_content',
  data: 'some_data',
  extension: 'ino',
};
const OTHER_FILE_DATA = {
  ...SOME_FILES_DATA[1],
  fullName: 'another_mock_name.h',
  content: 'another_mock_content',
  data: 'some_data',
  extension: 'h',
};

const SOME_FILES_CONTENT = [SOME_INO_DATA, OTHER_FILE_DATA];

const SOME_COMPILE_STDOUT =
  '/usr/local/bin/arduino-cli compile --fqbn arduino:avr:uno --libraries /home/builder/opt/libraries/latest --build-cache-path /tmp --output-dir /tmp/622766469/build --build-path /tmp/arduino-build-38EF8D7DC1BEECB190A6FAB648E2F6D0  /tmp/622766469/test_2\n[info] Sketch uses 5050 bytes (15%) of program storage space. Maximum is 32256 bytes.\n[info] Global variables use 909 bytes (44%) of dynamic memory, leaving 1139 bytes for local variables. Maximum is 2048 bytes.\n';

// Some refinements to compilation unit tests must be done
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const SOME_COMPILE_RESPONSE = {
  settled: true,
  elf: 'some_elf',
  elf_url: '/v1/compile/test_2.elf',
  hex: 'some_hex',
  hex_url: '/v1/compile/test_2.hex',
  stderr: '',
  stdout: SOME_COMPILE_STDOUT,
  output: `${SOME_COMPILE_STDOUT} --`,
  failed: false,
  outputLineEnd: 3,
  errors: [
    {
      filefullname: 'mock_name',
      row: '309',
      col: '12',
    },
  ],
  warnLineStart: 2,
  warnLineEnd: 3,
};

vi.mock('../../../common/hooks/preferences', async () => {
  const preferencesHooks = await vi.importActual<
    typeof import('../../../common/hooks/preferences')
  >('../../../common/hooks/preferences');
  return {
    ...preferencesHooks,
    usePreferenceObservable: vi.fn(),
  };
});

vi.mock('./hooks/utils', async () => {
  const utils = await vi.importActual<typeof import('./hooks/utils')>(
    './hooks/utils',
  );

  return {
    ...utils,
    useGetProposedSketchName: () => ({
      getProposedSketchName: () => 'mock_proposed_name',
    }),
  };
});

vi.mock('./hooks/sketch', async () => {
  const sketchHooks = await vi.importActual<typeof import('./hooks/sketch')>(
    './hooks/sketch',
  );
  return {
    ...sketchHooks,
    useSketchParams: vi.fn(),
  };
});

vi.mock('@cloud-editor-mono/domain', async () => {
  const domain = await vi.importActual<
    typeof import('@cloud-editor-mono/domain')
  >('@cloud-editor-mono/domain');

  return {
    ...domain,
    ga4Emitter: vi.fn(),
    sendAnalyticsEvent: vi.fn(),
    retrieveSketch: vi.fn(),
    retrieveSketches: vi.fn(),
    createSketch: vi.fn(),
    retrieveFileContents: vi.fn(),
    retrieveFilesList: vi.fn(),
    saveSketchFile: vi.fn(),
    createSketchCompilation: vi.fn(),
    associateSketchWithDevice: vi.fn(),
    getPreferencesSubjectById: vi.fn(),
  };
});

vi.mock('./hooks/routing', async () => {
  const routingHooks = await vi.importActual<typeof import('./hooks/routing')>(
    './hooks/routing',
  );
  return {
    ...routingHooks,
    useNotFound: vi.fn(),
    useRedirectToPreview: vi.fn(),
  };
});

vi.mock('./hooks/routingUtils', async () => {
  const routingUtils = await vi.importActual<
    typeof import('./hooks/routingUtils')
  >('./hooks/routingUtils');
  return {
    ...routingUtils,
    useNavigateToNotFound: vi.fn(),
    useNavigateToPreview: vi.fn(),
  };
});

vi.mock('../../../common/hooks/queries/create', async (importOriginal) => {
  const create = await importOriginal();
  return {
    ...(create as object),
    useCreateSketchFromExisting: () => ({
      create: vi.fn(),
      isLoading: false,
    }),
  };
});

describe('call useGetSketchStartUpQueries', () => {
  beforeEach(() => {
    vi.mocked(domain.retrieveFileContents).mockImplementation((path, ..._) => {
      const file = SOME_FILES_CONTENT.find((f) => f.path === path);
      if (!file) throw new Error('File not found');
      return Promise.resolve(file);
    });
    vi.mocked(domain.retrieveFilesList).mockResolvedValue(SOME_FILES_DATA);
    vi.clearAllMocks();
  });

  describe('when a sketch is requested by query string param', () => {
    beforeEach(() => {
      vi.mocked(sketchHooks.useSketchParams).mockReturnValue({
        isSketchQueried: true,
        sketchID: 'mock_sketch_id',
        sketchIDIsLoading: false,
        hideNumbers: false,
      });
    });

    describe('when the sketch is found', () => {
      it('should return the requested sketch by ID', async () => {
        vi.mocked(domain.retrieveSketch).mockResolvedValue(
          SKETCH_BY_ID_DATA as unknown as GetSketchResult,
        );

        const { result } = renderHook(
          () => useGetSketchStartUpQueries(false, false),
          {
            wrapper: TestProviderWrapper,
          },
        );

        await waitFor(() => {
          expect(vi.mocked(domain.retrieveSketch)).toHaveBeenCalled();
          expect(vi.mocked(domain.retrieveSketches)).not.toHaveBeenCalled();
          expect(vi.mocked(domain.createSketch)).not.toHaveBeenCalled();
          expect(result.current.sketchData).toEqual(SKETCH_BY_ID_DATA);
          expect(result.current.sketchData).not.toEqual(DEFAULT_SKETCH);
        });
      });
    });
  });

  it('should retrieve sketch files list: mainInoData and other files in a separated list', async () => {
    vi.mocked(domain.retrieveFileContents).mockResolvedValueOnce(SOME_INO_DATA);
    vi.mocked(domain.retrieveFileContents).mockResolvedValueOnce({
      name: 'another_mock_name',
      fullName: 'another_mock_name.h',
      data: 'another_mock_data',
      mimetype: 'text/plain',
      content: 'some_content',
      path: 'another_mock_path.h',
      href: 'another_mock_href.h',
      extension: 'h',
    });

    const { result } = renderHook(
      () => useGetSketchStartUpQueries(false, false),
      {
        wrapper: TestProviderWrapper,
      },
    );
    await waitFor(() => {
      expect(vi.mocked(domain.retrieveFilesList)).toHaveBeenCalled();
      expect(result.current.mainInoData).toEqual(SOME_INO_DATA);
      expect(result.current.files).toEqual([
        {
          name: 'another_mock_name',
          data: 'another_mock_data',
          mimetype: 'text/plain',
          content: 'some_content',
          path: 'another_mock_path.h',
          href: 'another_mock_href.h',
          extension: 'h',
          fullName: 'another_mock_name.h',
        },
      ]);
    });
  });

  it('should retrieve code', async () => {
    beforeEach(() => {
      vi.mocked(sketchHooks.useSketchParams).mockReturnValue({
        isSketchQueried: true,
        sketchID: 'mock_sketch_id',
        sketchIDIsLoading: false,
        hideNumbers: false,
      });
    });

    vi.mocked(domain.retrieveSketch).mockResolvedValue(
      SKETCH_BY_ID_DATA as unknown as GetSketchResult,
    );

    const { result } = renderHook(
      () => useGetSketchStartUpQueries(false, false),
      {
        wrapper: TestProviderWrapper,
      },
    );
    await waitFor(() => {
      expect(vi.mocked(domain.retrieveFileContents)).toHaveBeenCalled();
      expect(result.current.mainInoData).toEqual(SOME_INO_DATA);
      expect(result.current.sketchData).toEqual(SKETCH_BY_ID_DATA);
    });
  });

  describe('when file content is retrieved, a file is selected and modified', async () => {
    beforeEach(() => {
      vi.mocked(sketchHooks.useSketchParams).mockReturnValue({
        isSketchQueried: true,
        sketchID: 'mock_sketch_id',
        sketchIDIsLoading: false,
        hideNumbers: false,
      });
      vi.mocked(domain.retrieveSketch).mockResolvedValue(
        SKETCH_BY_ID_DATA as unknown as GetSketchResult,
      );
      vi.mocked(domain.saveSketchFile).mockResolvedValue({
        bytes: 1,
        bytesB64: 2,
      });
    });

    it.skip(`file content should be loaded correctly on startup & on file selection change. 
      Modifications should be reflected in code subjects and invoke a save`, async () => {
      const { result: initialResult } = renderHook(
        () => {
          const { mainInoData, files } = useGetSketchStartUpQueries(
            false,
            false,
          );

          const { selectedFile, selectFile } = useFiles({
            mainFile: mainInoData,
            files,
            filesAreLoading: false,
            filesContentLoaded: !!mainInoData && !!files?.length,
            getUnsavedFilesSubject: () =>
              new BehaviorSubject(new Set<string>()),
          });

          return {
            mainInoData,
            files,
            selectedFile,
            selectFile,
          };
        },
        {
          wrapper: TestProviderWrapper,
        },
      );

      await waitFor(() => {
        expect(initialResult.current.mainInoData).toBeDefined();
        expect(initialResult.current.selectedFile).toBeDefined();
        expect(initialResult.current.selectedFile?.fileId).toBeDefined();
      });

      const id = initialResult.current.selectedFile!.fileId!;

      const codeSubjects = domain.getCodeSubjects();
      const subject = codeSubjects.get(id);
      expect(subject?.value.value).toEqual(
        initialResult.current.mainInoData?.content,
      );

      expect(
        getSelectedCodeObservableValue(getCodeSubjectById, id)?.value,
      ).toEqual(initialResult.current.mainInoData?.content);

      // Needed for setting debounce interval to 0
      setCodeSubjects(OTHER_FILE_DATA, 0);

      const otherFile = initialResult.current.files?.find(
        (f) => f.path === OTHER_FILE_DATA.path,
      );
      expect(otherFile).toBeDefined();
      assertNonNull(otherFile);

      await waitFor(() => {
        initialResult.current.selectFile(otherFile.path);

        expect(initialResult.current.selectedFile?.fileId).toEqual(
          otherFile.path,
        );
      });

      const secondObservableValue = getSelectedCodeObservableValue(
        getCodeSubjectById,
        otherFile.path,
      )?.value;
      expect(secondObservableValue).toEqual(otherFile.content);

      const modifiedCode = otherFile.content + 'modification';
      act(() => {
        codeSubjectNext(otherFile.path, modifiedCode, async () => {
          await domain.saveSketchFile({ path: otherFile.path }, modifiedCode);
        });
      });

      await waitFor(() => {
        expect(
          getSelectedCodeObservableValue(getCodeSubjectById, otherFile.path)
            ?.value,
        ).toEqual(modifiedCode);
        expect(vi.mocked(domain.saveSketchFile)).toHaveBeenCalled();
      });
    });
  });
});

describe('call useCoreCommands', () => {
  describe('when no initialSketchData is provided and no initialInoData is provided', () => {
    it("shouldn't allow compile or upload", async () => {
      const { result } = renderHook(
        () =>
          useCoreCommands(
            false,
            false,
            false,
            () => {},
            false,
            false,
            async () => {
              return { bytes: 1, bytesB64: 2 };
            },
            () => '',
            false,
            true,
            () => undefined,
            undefined,
            undefined,
            undefined,
            SOME_FQBN,
            SOME_PORT,
          ),
        {
          wrapper: TestProviderWrapper,
        },
      );
      await waitFor(() => {
        const { uploadCommand, verifyCommand, isVerifying } = result.current;
        uploadCommand();
        verifyCommand();
        expect(isVerifying).toEqual(false);
        expect(vi.mocked(domain.createSketchCompilation)).toHaveBeenCalledTimes(
          0,
        );
      });
    });
  });

  describe('when initialSketchData and initialInoData are provided', () => {
    beforeEach(() => {
      vi.mocked(domain.createSketchCompilation).mockResolvedValue({
        id: '1234',
        status: 'created',
      });
    });
    it('should allow compile and upload', async () => {
      const { result } = renderHook(
        () =>
          useCoreCommands(
            false,
            false,
            false,
            () => null,
            false,
            false,
            async () => {
              return { bytes: 1, bytesB64: 2 };
            },
            () => '',
            false,
            true,
            () => undefined,
            SOME_INO_DATA,
            DEFAULT_SKETCH as unknown as GetSketch_Response,
            undefined,
            SOME_FQBN,
            SOME_PORT,
          ),
        {
          wrapper: TestProviderWrapper,
        },
      );
      await waitFor(() => {
        const { uploadCommand, verifyCommand } = result.current;
        uploadCommand();
        verifyCommand();
        expect(
          vi.mocked(domain.createSketchCompilation),
        ).not.toHaveBeenCalled();
      });
    });
  });

  describe('initialSketchData, initialInoData and initialFilesData are provided', () => {
    beforeEach(() => {
      vi.mocked(domain.createSketchCompilation).mockResolvedValue({
        id: '1234',
        status: 'created',
      });
    });
    it('should allow to compile and upload', async () => {
      const { result } = renderHook(
        () =>
          useCoreCommands(
            false,
            false,
            false,
            () => null,
            false,
            false,
            async () => {
              return { bytes: 1, bytesB64: 2 };
            },
            () => '',
            false,
            true,
            () => undefined,
            SOME_INO_DATA,
            DEFAULT_SKETCH as unknown as GetSketch_Response,
            [SOME_INO_DATA],
            SOME_FQBN,
            SOME_PORT,
          ),
        {
          wrapper: TestProviderWrapper,
        },
      );
      await waitFor(() => {
        const { uploadCommand, verifyCommand } = result.current;
        uploadCommand();
        verifyCommand();

        expect(vi.mocked(domain.createSketchCompilation)).toHaveBeenCalled();
      });
    });
  });
});

describe('call getPreferenceObservable', async () => {
  const consoleOutputSubject = new BehaviorSubject<PreferenceValue>(
    Preferences.ConsoleOutput,
  );

  describe('call getPreferenceObservable and a preference is found', async () => {
    beforeEach(() => {
      vi.mocked(domain.getPreferencesSubjectById).mockResolvedValue(
        consoleOutputSubject,
      );
      vi.mocked(preferencesHooks.usePreferenceObservable).mockReturnValue(
        ConsoleOutput.Verbose,
      );
    });

    it('should return the preference', async () => {
      const { result } = renderHook(
        () =>
          preferencesHooks.usePreferenceObservable(Preferences.ConsoleOutput),
        {
          wrapper: TestProviderWrapper,
        },
      );
      await waitFor(() => {
        expect(result.current).toEqual(ConsoleOutput.Verbose);
      });
    });
  });

  describe('call getPreferenceObservable and no preference is subject is found', async () => {
    beforeEach(() => {
      vi.mocked(domain.getPreferencesSubjectById).mockRejectedValue(
        new Error('Preference subject not found'),
      );
    });

    it('should throw an error', async () => {
      await expect(vi.mocked(domain.getPreferencesSubjectById)).rejects.toThrow(
        new Error(`Preference subject not found`),
      );
    });
  });
});
