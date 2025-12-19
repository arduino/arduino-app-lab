import { renderHook, waitFor } from '@bcmi-labs/cloud-editor-test';
import * as domain from '@cloud-editor-mono/domain';
import {
  CreateSketch_Response,
  GetFilesList_Response,
  GetSketches_Response,
  PostSketchFile_Response,
} from '@cloud-editor-mono/infrastructure';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import {
  BatchFile,
  useCreateDefaultSketch,
  useRetrieveBatchFileContents,
  useRetrieveFileContents,
  useRetrieveFilesList,
} from './create';
import { useRetrieveSketches } from './createShared';

const queryClient = new QueryClient();
const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

const SOME_INO_DATA = {
  name: 'mock_name',
  fullName: 'mock_name.ino',
  data: 'mock_data',
  mimetype: 'text/plain',
  content: 'some content',
  path: 'mock_ino_path',
  href: 'mock_ino_href',
  extension: 'ino',
};

const SOME_FILES_DATA: GetFilesList_Response = [
  {
    href: 'mock_href',
    mimetype: 'mock_mimetype',
    modifiedAt: 'mock_modifiedAt',
    path: 'mock_path.ino',
    name: 'mock_name',
    type: 'file',
  },
];

const MOCK_FILES_ARRAY: BatchFile[] = [
  {
    path: 'mock_path',
    name: 'mock_name',
    type: 'file',
  },
];

vi.mock('@cloud-editor-mono/domain', async () => {
  const domain = await vi.importActual<
    typeof import('@cloud-editor-mono/domain')
  >('@cloud-editor-mono/domain');

  return {
    ...domain,
    retrieveSketches: (): GetSketches_Response =>
      [{ id: '1', name: 'test' }] as GetSketches_Response,
    createSketch: (): CreateSketch_Response =>
      ({
        id: '1',
        name: 'test',
      } as CreateSketch_Response),
    retrieveFileContents: vi.fn(),
    retrieveFilesList: vi.fn(),
    saveSketchFile: (): PostSketchFile_Response => ({
      bytes: 100,
      bytesB64: 23,
    }),
  };
});

describe('createApiServiceQueries', () => {
  beforeEach(() => {
    vi.mocked(domain.retrieveFileContents).mockResolvedValue(SOME_INO_DATA);
    queryClient.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });
  describe('call useRetrieveSketches', () => {
    it('should return sketchesData', async () => {
      const { result } = renderHook(
        () => useRetrieveSketches(true, domain.retrieveSketches, 'key'),
        {
          wrapper,
        },
      );
      await waitFor(() => expect(result.current.sketchesData).toBeDefined());
    });
  });

  describe('call useCreateDefaultSketch', () => {
    describe('and it is disabled', () => {
      it('should return undefined', async () => {
        const { result } = renderHook(() => useCreateDefaultSketch(false), {
          wrapper,
        });
        await waitFor(() =>
          expect(result.current.createdSketch).toBeUndefined(),
        );
      });
    });
    describe('and it is enabled', () => {
      it('should return the created Sketch', async () => {
        const { result } = renderHook(() => useCreateDefaultSketch(true), {
          wrapper,
        });
        await waitFor(() => expect(result.current.createdSketch).toBeDefined());
      });
    });
  });

  describe('call useRetrieveFileContents', () => {
    describe('and path and/or name are not defined', () => {
      it('should return undefined', async () => {
        const { result } = renderHook(
          () => useRetrieveFileContents(true, false),
          {
            wrapper,
          },
        );
        await waitFor(() => {
          expect(result.current.fileData).toBeUndefined();
        });
        const { result: result2 } = renderHook(
          () => useRetrieveFileContents(true, false, undefined, 'some path'),
          {
            wrapper,
          },
        );
        await waitFor(() => {
          expect(result2.current.fileData).toBeUndefined();
        });
        const { result: result3 } = renderHook(
          () =>
            useRetrieveFileContents(
              true,
              false,
              undefined,
              undefined,
              'some name',
            ),
          {
            wrapper,
          },
        );
        await waitFor(() => {
          expect(result3.current.fileData).toBeUndefined();
        });
      });
    });
    describe('and path and name are both defined', () => {
      it('should return the code', async () => {
        const { result } = renderHook(
          () =>
            useRetrieveFileContents(
              true,
              false,
              undefined,
              'some path',
              'some name',
            ),
          {
            wrapper,
          },
        );
        await waitFor(() => {
          expect(result.current.fileData).toBeDefined();
        });
      });
    });
  });

  describe('useRetrieveFilesList', () => {
    beforeEach(() => {
      vi.mocked(domain.retrieveFilesList).mockResolvedValue(SOME_FILES_DATA);
    });
    describe('and it is disabled', () => {
      it('should return undefined if disabled', async () => {
        const { result } = renderHook(
          () =>
            useRetrieveFilesList(
              ['key-2'],
              false,
              false,
              undefined,
              'some_mock_path',
            ),
          {
            wrapper,
          },
        );
        await waitFor(() => {
          expect(result.current.filesList).toBeUndefined();
        });
      });

      it('should return undefined if no path is given', async () => {
        const { result } = renderHook(
          () =>
            useRetrieveFilesList(
              ['key-2'],
              true,
              false,
              undefined,
              'some_mock_path',
            ),
          {
            wrapper,
          },
        );
        await waitFor(() => {
          expect(result.current.filesList).toBeUndefined();
        });
      });
    });
    describe('and it is enabled', () => {
      const fileListKey = ['key-2'];
      it('should return the filesList', async () => {
        const { result } = renderHook(
          () =>
            useRetrieveFilesList(
              fileListKey,
              true,
              false,
              undefined,
              'some_mock_path',
            ),
          {
            wrapper,
          },
        );
        await waitFor(() => {
          expect(vi.mocked(domain.retrieveFilesList)).toHaveBeenCalled();
          expect(result.current.filesList).toBeDefined();
        });
      });
    });
  });

  describe('call useRetrieveBatchFileContents', () => {
    describe('and it is disabled', () => {
      const queryKey = ['key-2'];
      it('should return undefined if disabled', async () => {
        const { result } = renderHook(
          () => useRetrieveBatchFileContents(false, false, queryKey),
          {
            wrapper,
          },
        );
        await waitFor(() => {
          expect(result.current.filesContents).toBeUndefined();
        });
      });
      it('should return undefined if no file array is given', async () => {
        const { result } = renderHook(
          () => useRetrieveBatchFileContents(true, false, queryKey),
          {
            wrapper,
          },
        );
        await waitFor(() => {
          expect(result.current.filesContents).toBeUndefined();
        });
      });
    });
    describe('and it is enabled', () => {
      const queryKey = ['key-2'];
      it('should return fileContents', async () => {
        const { result } = renderHook(
          () =>
            useRetrieveBatchFileContents(
              true,
              false,
              queryKey,
              undefined,
              SOME_INO_DATA.path,
              MOCK_FILES_ARRAY,
            ),
          {
            wrapper,
          },
        );
        await waitFor(() => {
          expect(vi.mocked(domain.retrieveFileContents)).toHaveBeenCalled();
          expect(result.current.filesContents).toBeDefined();
        });
      });
    });
  });
});
