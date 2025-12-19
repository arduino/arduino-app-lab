import {
  GetSketchResult,
  RetrieveExampleFileContentsResult,
  RetrieveFileContentsResult,
} from '@cloud-editor-mono/domain/src/services/services-by-app/shared';
import { PostSketchFile_Response } from '@cloud-editor-mono/infrastructure';
import {
  UseMutateAsyncFunction,
  UseMutateFunction,
} from '@tanstack/react-query';

export type SaveSketchFileMutation = UseMutateAsyncFunction<
  PostSketchFile_Response | { errStatus: number } | null,
  unknown,
  { code?: string; fileId?: string; hash?: string } | undefined,
  unknown
>;

export enum SketchDataBaseQueryKey {
  GET_SKETCH_BY_ID_QUERY_KEY = 'get-sketch-by-id',
  CREATE_DEFAULT_KEY_QUERY_KEY = 'create-default-sketch',
  GET_SKETCHES_QUERY_KEY = 'get-sketches',
}

export type UseCreateSketchFromExisting = (
  onSuccess?: (sketch: GetSketchResult) => void,
) => {
  create: UseMutateFunction<
    GetSketchResult,
    unknown,
    | {
        sketchName?: string;
        sketchContent?: string;
        files?:
          | RetrieveFileContentsResult[]
          | RetrieveExampleFileContentsResult[];
      }
    | undefined,
    unknown
  >;
  isLoading: boolean;
  createdSketch?: GetSketchResult;
};
