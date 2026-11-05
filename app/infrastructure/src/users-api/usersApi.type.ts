import { CamelCasedProperties } from 'type-fest';

import { ORGANIZATION_HEADER } from '../utils';
import { components } from './users-api';

type WithoutCloudEditorPrefix<T> = {
  [K in keyof T as K extends `cloudeditor${infer P}` ? P : K]: T[K];
};

export type CreateSettingsBody_UsersApi = { optin: boolean; genAi: boolean };

export type GetSettings_UsersApi = components['schemas']['Settingsget'];

export type GetSettings_Response = CamelCasedProperties<
  WithoutCloudEditorPrefix<CamelCasedProperties<GetSettings_UsersApi>>
>;

// Hand-written: users-api.d.ts predates the policies endpoint. Keys copied from GET /users/v1/policies/keys.
export type PolicyKey_UsersApi =
  | 'credential::update'
  | 'customization::create'
  | 'customization::delete'
  | 'customization::read'
  | 'customization::update'
  | 'edu-admin::add'
  | 'edu-admin::change-role'
  | 'edu-student::add'
  | 'edu-student::change-role'
  | 'edu-student::delete'
  | 'edu-teacher::add'
  | 'edu-teacher::change-role'
  | 'folder::create'
  | 'folder::delete'
  | 'folder::read'
  | 'folder::update'
  | 'iot:dashboard::create'
  | 'iot:dashboard::delete'
  | 'iot:dashboard::read'
  | 'iot:dashboard::share'
  | 'iot:dashboard::update'
  | 'iot:device::create'
  | 'iot:device::delete'
  | 'iot:device::read'
  | 'iot:device::update'
  | 'iot:sync::create'
  | 'iot:sync::delete'
  | 'iot:sync::read'
  | 'iot:sync::update'
  | 'iot:template::apply'
  | 'iot:template::create'
  | 'iot:template::delete'
  | 'iot:template::read'
  | 'iot:template::update'
  | 'iot:thing-topic::read'
  | 'iot:thing-topic::update'
  | 'iot:thing::attach'
  | 'iot:thing::create'
  | 'iot:thing::delete'
  | 'iot:thing::download'
  | 'iot:thing::read'
  | 'iot:thing::update'
  | 'iot:trigger::create'
  | 'iot:trigger::delete'
  | 'iot:trigger::read'
  | 'iot:trigger::update'
  | 'iot:usage::read'
  | 'organization-logo::create'
  | 'organization-logo::delete'
  | 'organization::delete-user'
  | 'organization::delete-user-permission'
  | 'organization::disband'
  | 'organization::get-billing'
  | 'organization::get-code'
  | 'organization::get-kits'
  | 'organization::get-members'
  | 'organization::update'
  | 'organization::update-billing'
  | 'pro-admin::add'
  | 'pro-admin::change-role'
  | 'pro-editor::add'
  | 'pro-editor::change-role'
  | 'pro-service::add'
  | 'pro-service::change-role'
  | 'pro-service::delete'
  | 'pro-viewer::add'
  | 'pro-viewer::change-role'
  | 'pro-viewer::delete'
  | 'restrictions::read'
  | 'sketch::create'
  | 'sketch::delete'
  | 'sketch::read'
  | 'sketch::update'
  | 'sketch::upload'
  | 'subscription::assign-seats'
  | 'subscription::create'
  | 'subscription::delete'
  | 'subscription::unassign-seats'
  | 'subscription::update';

export interface GetPolicies_Params {
  header: { [ORGANIZATION_HEADER]: string };
}

// A key missing from the map means denied.
export interface GetPolicies_UsersApi {
  policies: Partial<Record<PolicyKey_UsersApi, boolean>>;
}
