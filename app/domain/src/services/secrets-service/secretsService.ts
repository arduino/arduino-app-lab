import {
  filefull_BuilderApi,
  SketchSecrets,
} from '@cloud-editor-mono/infrastructure';

import { transformContentToDataByMimeType } from '../utils';
import { SecretsFile } from './secretsService.type';
import { createEmptySecretsFile, DEFAULT_SECRETS_FULL_FILENAME } from './utils';

function fillSecretsFileContent(
  file: SecretsFile,
  secrets: SketchSecrets,
): SecretsFile {
  for (const s of secrets) {
    const escapedValue = s.value
      ? s.value
          .replace(/\\/g, '\\\\')
          .replace(/\t/g, '\\t')
          .replace(/\v/g, '\\v')
          .replace(/\0/g, '\\0')
          .replace(/\f/g, '\\f')
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/'/g, "\\'")
          .replace(/"/g, '\\"')
      : '';

    file.content += `#define ${s.name} "${escapedValue}"\n`;
  }

  return file;
}

export function createBuilderSecretsFile(
  secrets: SketchSecrets,
): filefull_BuilderApi {
  const defaultFile = createEmptySecretsFile();
  const filledFile = fillSecretsFileContent(defaultFile, secrets);

  return {
    data: transformContentToDataByMimeType(
      filledFile.content,
      filledFile.mimetype,
    ),
    name: filledFile.name,
  };
}

export function injectSecretsFileInclude(
  file: filefull_BuilderApi,
  currContent: string,
  mimetype?: string,
): filefull_BuilderApi {
  const content = `#include "${DEFAULT_SECRETS_FULL_FILENAME}"\n${currContent}`;
  return {
    ...file,
    data: transformContentToDataByMimeType(content, mimetype),
  };
}
