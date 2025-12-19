import {
  CompileSketch_Response,
  Compute_Response,
} from '@cloud-editor-mono/infrastructure';

export enum UploadStatus {
  NONE,
  IN_PROG,
  DONE,
  ERROR,
}

export const extIsKeyOfCompileData = (
  ext: string,
): ext is keyof CompileSketch_Response => {
  return Boolean(ext);
};

export type UploadToPortPayload<T> = {
  sketchId: string;
  boardType: string;
  fqbn: string;
  port: T;
  sketchName: string;
  compileData: CompileSketch_Response;
  computeUploadInfo: Compute_Response;
};
