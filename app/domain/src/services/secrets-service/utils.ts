import { SecretsFile } from './secretsService.type';

export const DEFAULT_SECRETS_FULL_FILENAME = 'arduino_secrets.h';

export const createEmptySecretsFile = (): SecretsFile => ({
  name: DEFAULT_SECRETS_FULL_FILENAME,
  data: '',
  content: '',
  mimetype: 'text',
});
