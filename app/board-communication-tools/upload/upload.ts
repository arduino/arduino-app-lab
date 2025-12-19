import {
  extFromCommandlineString,
  State,
  StateSubjectValuePair,
} from '@cloud-editor-mono/common';
import { CompileSketch_Response } from '@cloud-editor-mono/infrastructure';

import { extIsKeyOfCompileData, UploadStatus } from './upload.type';

export const DEFAULT_UPLOAD_EXTENSION = 'bin';
export const UPLOAD_TIMEOUT = 150000;

export function uploadCompletePredicate<T extends State<T>>(
  uploadStatusKey: keyof T,
) {
  return function ([_, newValue]: StateSubjectValuePair<T>): boolean {
    if (!newValue[uploadStatusKey]) return false;

    return (
      newValue[uploadStatusKey] === UploadStatus.DONE ||
      newValue[uploadStatusKey] === UploadStatus.ERROR
    );
  };
}
export function getExtAndData(
  commandline: string,
  compileData: CompileSketch_Response,
): [string, unknown] {
  const ext = extFromCommandlineString(commandline);

  const data =
    (extIsKeyOfCompileData(ext) && compileData[ext]) ||
    compileData[DEFAULT_UPLOAD_EXTENSION];

  return [ext, data];
}
