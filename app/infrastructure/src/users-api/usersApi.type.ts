import { CamelCasedProperties } from 'type-fest';

import { components } from './users-api';

type WithoutCloudEditorPrefix<T> = {
  [K in keyof T as K extends `cloudeditor${infer P}` ? P : K]: T[K];
};

export type CreateSettingsBody_UsersApi = { optin: boolean; genAi: boolean };

export type GetSettings_UsersApi = components['schemas']['Settingsget'];

export type GetSettings_Response = CamelCasedProperties<
  WithoutCloudEditorPrefix<CamelCasedProperties<GetSettings_UsersApi>>
>;
