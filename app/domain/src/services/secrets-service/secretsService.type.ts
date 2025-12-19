import { filefull_BuilderApi } from '@cloud-editor-mono/infrastructure';

export type SecretsFile = filefull_BuilderApi & {
  content: string;
  mimetype: string;
};
