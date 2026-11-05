import { PolicyKey_UsersApi } from '@cloud-editor-mono/infrastructure';
import { useContext } from 'react';

import { AuthContext } from '../auth/authContext';

// The users-api policy also in preview; an organization denies until the policies load.
export function useUserHasPolicy(key: PolicyKey_UsersApi): boolean {
  const { isOrganizationSpace, policies } = useContext(AuthContext);

  if (!isOrganizationSpace) return true;

  return policies?.[key] === true;
}

// Preview is open to every visitor, so it grants nothing.
export function useUserHasPermission(key: PolicyKey_UsersApi): boolean {
  const { isViewMode } = useContext(AuthContext);
  const hasPolicy = useUserHasPolicy(key);

  return !isViewMode && hasPolicy;
}
