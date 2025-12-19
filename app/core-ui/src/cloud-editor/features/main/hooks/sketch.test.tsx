import 'fake-indexeddb/auto';

import { RetrieveFileContentsResult } from '@cloud-editor-mono/domain';
import { useMatch, useSearch } from '@tanstack/react-location';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import * as IDB from 'idb-keyval';
import { BehaviorSubject } from 'rxjs';

import { OPEN_FILES_KEY, useFiles } from '../../../../common/hooks/files';
import { SKETCH_ID_ROUTE_PARAM } from '../../../../routing/routing.type';
import { useSketchParams } from './sketch';

vi.mock('@tanstack/react-location', async (importOriginal) => {
  const actual = await importOriginal();

  return {
    ...(actual as object),
    useNavigate: vi.fn(),
    useMatch: vi.fn(),
    useSearch: vi.fn(),
    parseSearchWith: vi.fn(),
    stringifySearchWith: vi.fn(),
    ReactLocation: vi.fn(),
  };
});

describe('useSketchParams', () => {
  it('should return the sketch ID if query string parameter is present', () => {
    // @ts-expect-error no need to return the actual complete route for test purposes
    vi.mocked(useMatch).mockReturnValue({
      params: {
        [SKETCH_ID_ROUTE_PARAM]: 'mock_sketch_id',
      },
    });
    vi.mocked(useSearch).mockReturnValue({});

    const { result } = renderHook(useSketchParams);
    expect(result.current.isSketchQueried).toBe(true);
    expect(result.current.sketchID).toEqual('mock_sketch_id');
  });

  it('should return the correct boolean value if query string parameter is not present', () => {
    // @ts-expect-error no need to return the actual complete route for test purposes
    vi.mocked(useMatch).mockReturnValue({
      params: {},
    });
    vi.mocked(useSearch).mockReturnValue({});

    const { result } = renderHook(useSketchParams);
    expect(result.current.isSketchQueried).toBe(false);
    expect(result.current.sketchID).not.toBeDefined();
  });
});

const INO_FILE: RetrieveFileContentsResult = {
  name: 'AnalogReadSerial',
  fullName: 'AnalogReadSerial.ino',
  extension: 'ino',
  data: '',
  content: '// Test',
  mimetype: 'text/x-c++src; charset=utf-8',
  path: '/sketches_v2/AnalogReadSerial/AnalogReadSerial.ino',
  href: '/sketches_v2/AnalogReadSerial/AnalogReadSerial.ino',
  modifiedAt: '2025-02-21T13:54:38.116Z',
};

const OTHER_FILES_DATA: RetrieveFileContentsResult[] = [
  {
    name: 'layout',
    fullName: 'layout.png',
    extension: 'png',
    data: '',
    content: '',
    mimetype: 'image/png',
    path: '/sketches_v2/AnalogReadSerial/layout.png',
    href: '/sketches_v2/AnalogReadSerial/layout.png',
    modifiedAt: '2025-02-21T13:54:39.523Z',
  },
  {
    name: 'AnalogReadSerial',
    fullName: 'AnalogReadSerial.txt',
    extension: 'txt',
    data: '',
    content: '',
    mimetype: 'text/plain; charset=utf-8',
    path: '/sketches_v2/AnalogReadSerial/AnalogReadSerial.txt',
    href: '/sketches_v2/AnalogReadSerial/AnalogReadSerial.txt',
    modifiedAt: '2025-02-21T13:54:39.523Z',
  },
];

const ALL_FILES_DATA = [INO_FILE, ...OTHER_FILES_DATA];

describe('useFiles', () => {
  // let useQueryMock: ReturnType<typeof vi.spyOn>;
  let queryClient: QueryClient;
  const wrapper = ({
    children,
  }: {
    children: React.ReactNode;
  }): JSX.Element => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  let props: Parameters<typeof useFiles>[0];

  const sketchSecretsFileId = 'sketch.secrets';
  const storeOpenFileNames = async (
    sketchId: string,
    items: string[],
  ): Promise<void> => {
    await IDB.update(OPEN_FILES_KEY, (prev) => ({
      ...prev,
      [sketchId]: { items },
    }));
  };

  beforeEach(async () => {
    await IDB.clear();

    queryClient = new QueryClient();
    props = {
      mainFile: undefined,
      files: undefined,
      filesAreLoading: undefined,
      filesContentLoaded: undefined,
      isLibraryRoute: undefined,
      showSketchSecretsFile: undefined,
      getUnsavedFilesSubject: () => new BehaviorSubject(new Set<string>()),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('gradually open files and select main ino', async () => {
    const { result, rerender } = renderHook(() => useFiles(props), { wrapper });

    await waitFor(() => {
      expect(result.current.editorFiles).toEqual([]);
    });

    props.mainFile = INO_FILE;
    props.files = OTHER_FILES_DATA;

    act(() => {
      rerender(props);
    });

    await waitFor(() => {
      expect(result.current.editorFiles).toHaveLength(ALL_FILES_DATA.length);
      expect(result.current.openFiles).toHaveLength(ALL_FILES_DATA.length);
      expect(result.current.selectedFile?.fileId).toEqual(INO_FILE.path);
    });
  });

  it('should open only stored files', async () => {
    const storedFile = { ...INO_FILE };
    const sketchId = 'mock_store_sketch_id';
    await storeOpenFileNames(sketchId, [storedFile.fullName]);

    props.mainFile = INO_FILE;
    props.files = OTHER_FILES_DATA;
    props.storeEntityId = sketchId;

    const { result } = renderHook(() => useFiles(props), { wrapper });

    await waitFor(() => {
      expect(result.current.openFiles).toHaveLength(1);
      expect(result.current.editorFiles).toHaveLength(ALL_FILES_DATA.length);
      expect(result.current.selectedFile?.fileId).toEqual(storedFile.path);
      expect(result.current.storedOpenFileNames).toStrictEqual([
        storedFile.fullName,
      ]);
    });
  });

  it('should select, close and open files', async () => {
    props.mainFile = INO_FILE;
    props.files = OTHER_FILES_DATA;
    props.storeEntityId = 'mock_store_sketch_id';
    props.filesContentLoaded = true;

    const { result } = renderHook(() => useFiles(props), { wrapper });

    await waitFor(() => {
      expect(result.current.openFiles).toHaveLength(3);
      expect(result.current.storedOpenFileNames).toHaveLength(3);
    });

    // Select last open file
    const lastTabFile =
      result.current.openFiles[result.current.openFiles.length - 1];
    act(() => {
      result.current.selectFile(lastTabFile.fileId);
    });

    await waitFor(() => {
      expect(result.current.selectedFile?.fileId).toEqual(lastTabFile.fileId);
    });

    const fileToClose =
      result.current.openFiles[result.current.openFiles.length - 1];
    // Expect new selected file to be the the one on the left
    const fileToBeSelected =
      result.current.openFiles[result.current.openFiles.length - 2];

    act(() => {
      result.current.closeFile(fileToClose.fileId);
    });

    await waitFor(() => {
      expect(result.current.openFiles).toHaveLength(ALL_FILES_DATA.length - 1);
      expect(result.current.storedOpenFileNames?.length).toBe(
        ALL_FILES_DATA.length - 1,
      );
      expect(result.current.storedOpenFileNames).not.toContain(
        fileToClose.fileFullName,
      );
      expect(result.current.selectedFile?.fileId).toEqual(
        fileToBeSelected.fileId,
      );
    });

    const fileToReopen = fileToClose;
    act(() => {
      result.current.selectFile(fileToReopen.fileId);
    });

    await waitFor(() => {
      expect(result.current.selectedFile?.fileId).toEqual(fileToReopen.fileId);
      expect(result.current.openFiles).toHaveLength(ALL_FILES_DATA.length);
      expect(
        result.current.openFiles.findIndex(
          (f) => f.fileId === fileToReopen.fileId,
        ),
      ).toBe(ALL_FILES_DATA.length - 1);
    });
  });

  it('should not close main ino file', async () => {
    props.mainFile = INO_FILE;
    props.files = OTHER_FILES_DATA;
    props.filesContentLoaded = true;

    const { result, rerender } = renderHook(() => useFiles(props), { wrapper });

    await waitFor(() => {
      expect(result.current.openFiles).toHaveLength(ALL_FILES_DATA.length);
    });

    act(() => {
      result.current.closeFile(INO_FILE.path);
      rerender();
    });

    await waitFor(() => {
      const inoIndex = result.current.openFiles.findIndex(
        (file) => file.fileId === INO_FILE.path,
      );
      expect(inoIndex).toBeGreaterThan(-1);
      expect(result.current.openFiles).toHaveLength(ALL_FILES_DATA.length);
    });
  });

  it('should open ino file even if not included in stored files', async () => {
    const sketchId = 'mock_store_sketch_id';
    await storeOpenFileNames(
      sketchId,
      OTHER_FILES_DATA.map((file) => file.fullName),
    );

    props.mainFile = INO_FILE;
    props.files = OTHER_FILES_DATA;
    props.filesContentLoaded = true;
    props.storeEntityId = sketchId;

    const { result } = renderHook(() => useFiles(props), { wrapper });

    await waitFor(() => {
      expect(result.current.openFiles).toHaveLength(ALL_FILES_DATA.length);

      const inoIndex = result.current.openFiles.findIndex(
        (file) => file.fileId === INO_FILE.path,
      );
      expect(inoIndex).toBeGreaterThan(-1);
    });
  });

  it('should correctly reorder open files', async () => {
    const sketchId = 'mock_store_sketch_id';
    props.mainFile = INO_FILE;
    props.files = OTHER_FILES_DATA;
    props.filesContentLoaded = true;
    props.storeEntityId = sketchId;

    const { result } = renderHook(() => useFiles(props), { wrapper });

    await waitFor(() => {
      expect(result.current.openFiles).toHaveLength(ALL_FILES_DATA.length);
    });

    const newOrder = [...OTHER_FILES_DATA, INO_FILE];
    const newOrderIds = newOrder.map((f) => f.path);
    act(() => {
      result.current.updateOpenFilesOrder(newOrderIds);
    });

    await waitFor(() => {
      expect(result.current.openFiles.map((f) => f.fileId)).toEqual(
        newOrderIds,
      );
      expect(result.current.storedOpenFileNames).toEqual(
        newOrder.map((f) => f.fullName),
      );
      expect(result.current.selectedFile?.fileId).toEqual(INO_FILE.path);
    });
  });

  it('should correctly update stored ino file if sketch is renamed', async () => {
    const sketchId = 'mock_store_sketch_id';
    await storeOpenFileNames(sketchId, [INO_FILE.fullName]);

    props.mainFile = INO_FILE;
    props.files = OTHER_FILES_DATA;
    props.filesContentLoaded = true;
    props.storeEntityId = sketchId;

    const { result } = renderHook(() => useFiles(props), { wrapper });

    await waitFor(() => {
      expect(result.current.openFiles).toHaveLength(1);
      expect(result.current.editorFiles).toHaveLength(ALL_FILES_DATA.length);
      expect(result.current.storedOpenFileNames).toHaveLength(1);
    });

    const newName = 'newName';
    act(() => {
      result.current.onSketchRename(newName);
    });

    await waitFor(() => {
      expect(result.current.storedOpenFileNames).toEqual([
        `${newName}.${INO_FILE.extension}`,
      ]);
    });
  });

  it('should open sketch secrets sketch has secrets data', async () => {
    props.mainFile = INO_FILE;
    props.files = OTHER_FILES_DATA;
    props.showSketchSecretsFile = true;
    props.filesContentLoaded = true;

    const { result } = renderHook(() => useFiles(props), { wrapper });

    await waitFor(() => {
      expect(result.current.openFiles.length).toBe(ALL_FILES_DATA.length + 1);
      expect(
        result.current.openFiles.find((f) => f.fileId === 'sketch.secrets'),
      ).toBeDefined();
    });
  });

  it('should open sketch secrets file if stored', async () => {
    const sketchId = 'mock_store_sketch_id';
    await storeOpenFileNames(sketchId, [
      INO_FILE.fullName,
      sketchSecretsFileId,
    ]);

    props.mainFile = INO_FILE;
    props.files = OTHER_FILES_DATA;
    props.storeEntityId = sketchId;
    props.filesContentLoaded = true;

    const { result } = renderHook(() => useFiles(props), { wrapper });

    await waitFor(() => {
      expect(result.current.editorFiles).toHaveLength(
        ALL_FILES_DATA.length + 1,
      );
      expect(result.current.selectedFile?.fileId).toEqual(INO_FILE.path);
      expect(result.current.openFiles.map((f) => f.fileId)).toStrictEqual([
        INO_FILE.path,
        sketchSecretsFileId,
      ]);
      expect(result.current.storedOpenFileNames).toStrictEqual([
        INO_FILE.fullName,
        sketchSecretsFileId,
      ]);
    });
  });

  it('should select, move and close sketch secrets file', async () => {
    const sketchId = 'mock_store_sketch_id';

    props.mainFile = INO_FILE;
    props.files = OTHER_FILES_DATA;
    props.storeEntityId = sketchId;
    props.filesContentLoaded = true;

    const { result, rerender } = renderHook((newProps) => useFiles(newProps), {
      wrapper,
      initialProps: props,
    });

    await waitFor(() => {
      expect(result.current.openFiles.length).toBe(ALL_FILES_DATA.length);
    });

    act(() => {
      result.current.selectFile(sketchSecretsFileId);
    });

    await waitFor(() => {
      expect(result.current.selectedFile?.fileId).toEqual(sketchSecretsFileId);
      expect(result.current.openFiles.length).toBe(ALL_FILES_DATA.length + 1);
    });

    act(() => {
      result.current.updateOpenFilesOrder([
        INO_FILE.path,
        sketchSecretsFileId,
        ...OTHER_FILES_DATA.map((f) => f.path),
      ]);
    });

    await waitFor(() => {
      expect(result.current.selectedFile?.fileId).toEqual(sketchSecretsFileId);
      expect(result.current.openFiles[1].fileId).toEqual(sketchSecretsFileId);
      expect(result.current.storedOpenFileNames?.[1]).toBe(sketchSecretsFileId);
    });

    act(() => {
      result.current.closeFile(sketchSecretsFileId);
    });

    await waitFor(() => {
      expect(
        result.current.openFiles.find((f) => f.fileId === sketchSecretsFileId),
      ).toBeUndefined();
      expect(result.current.storedOpenFileNames).not.toContain(
        sketchSecretsFileId,
      );
    });

    // Trigger reload (re-init open files).
    // This time should not open sketch secrets file since it was closed and show showSketchSecretsFile is false.
    act(() => {
      rerender({
        ...props,
        filesContentLoaded: false,
        mainFile: undefined,
        files: undefined,
      });
      rerender({ ...props });
    });

    await waitFor(() => {
      expect(result.current.editorFiles.length).toBe(ALL_FILES_DATA.length);
      expect(
        result.current.openFiles.find((f) => f.fileId === sketchSecretsFileId),
      ).toBeUndefined();
    });
  });

  it('should trigger a reload and clear selected file if filesContentLoaded is false and open files already initialized', async () => {
    const { result, rerender } = renderHook((newProps) => useFiles(newProps), {
      wrapper,
      initialProps: {
        ...props,
        mainFile: INO_FILE,
        files: OTHER_FILES_DATA,
        filesContentLoaded: true,
      } as Parameters<typeof useFiles>[0],
    });

    await waitFor(() => {
      expect(result.current.openFiles).toHaveLength(ALL_FILES_DATA.length);
    });

    act(() => {
      // Trigger reload with initial props
      rerender(props);
    });

    await waitFor(() => {
      expect(result.current.openFiles).toHaveLength(0);
      expect(result.current.selectedFile).toBeUndefined();
    });

    const newInoFile = {
      ...INO_FILE,
      path: '/sketches_v2/NewSketch/NewSketch.ino',
    };

    act(() => {
      // Trigger reload complete with new ino file
      rerender({
        ...props,
        mainFile: newInoFile,
        files: [],
        filesContentLoaded: true,
      });
    });

    await waitFor(() => {
      expect(result.current.openFiles).toHaveLength(1);
      expect(result.current.selectedFile?.fileId).toBe(newInoFile.path);
    });
  });
});
