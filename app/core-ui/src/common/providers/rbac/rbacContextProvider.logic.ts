import {
  RbacCapability,
  RbacValue,
} from '@cloud-editor-mono/ui-components/lib/rbac/rbac.type';
import { useContext, useMemo } from 'react';

import { useUserHasPermission, useUserHasPolicy } from './permissions';
import { RbacContext } from './rbacContext';

export function useRbac(): RbacValue {
  return useContext(RbacContext);
}

// The only place that maps users-api policy keys to Cloud Editor UI capabilities.
export function useRbacValue(): RbacValue {
  const canUpdate = useUserHasPermission('sketch::update');
  const canCreate = useUserHasPermission('sketch::create');
  const canDelete = useUserHasPermission('sketch::delete');
  const canUpload = useUserHasPermission('sketch::upload');
  // A preview copies into the visitor's current space, so the preview rule does not apply.
  const canCopyFromPreview = useUserHasPolicy('sketch::create');
  const canUpdateThing = useUserHasPermission('iot:thing::update');

  return useMemo(
    () => ({
      [RbacCapability.EditSketch]: canUpdate,
      [RbacCapability.CreateSketch]: canCreate,
      [RbacCapability.DeleteSketch]: canDelete,
      [RbacCapability.UploadSketch]: canUpload,
      [RbacCapability.CopyFromPreview]: canCopyFromPreview,
      [RbacCapability.UpdateThing]: canUpdateThing,
    }),
    [
      canUpdate,
      canCreate,
      canDelete,
      canUpload,
      canCopyFromPreview,
      canUpdateThing,
    ],
  );
}
