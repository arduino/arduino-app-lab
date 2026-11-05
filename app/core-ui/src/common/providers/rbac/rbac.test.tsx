import {
  RbacCapability,
  RbacValue,
} from '@cloud-editor-mono/ui-components/lib/rbac/rbac.type';
import { renderHook } from '@testing-library/react';
import { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { AuthContext, AuthContextValue } from '../auth/authContext';
import RbacContextProvider from './RbacContextProvider';
import { useRbac } from './rbacContextProvider.logic';

type AuthValue = Partial<
  Pick<AuthContextValue, 'isViewMode' | 'isOrganizationSpace' | 'policies'>
>;

function wrapperWithAuth(value: AuthValue) {
  return function Wrapper({ children }: { children: ReactNode }): JSX.Element {
    return (
      <AuthContext.Provider
        value={{
          userNotTargetAudience: false,
          isAuthInjected: false,
          isViewMode: false,
          isOrganizationSpace: false,
          policiesAreLoading: false,
          ...value,
        }}
      >
        <RbacContextProvider>{children}</RbacContextProvider>
      </AuthContext.Provider>
    );
  };
}

function renderRbac(value: AuthValue): RbacValue {
  return renderHook(() => useRbac(), { wrapper: wrapperWithAuth(value) }).result
    .current;
}

const SERVICE_POLICIES = {
  'sketch::read': true,
  'sketch::create': true,
  'sketch::upload': true,
};

describe('RbacContextProvider', () => {
  it('keeps the full UI in a private space', () => {
    expect(renderRbac({ isOrganizationSpace: false })).toEqual({
      [RbacCapability.EditSketch]: true,
      [RbacCapability.CreateSketch]: true,
      [RbacCapability.DeleteSketch]: true,
      [RbacCapability.UploadSketch]: true,
      [RbacCapability.CopyFromPreview]: true,
      [RbacCapability.UpdateThing]: true,
    });
  });

  it('gives a read-only role in an organization without sketch::update', () => {
    expect(
      renderRbac({ isOrganizationSpace: true, policies: SERVICE_POLICIES }),
    ).toEqual({
      [RbacCapability.EditSketch]: false,
      [RbacCapability.CreateSketch]: true,
      [RbacCapability.DeleteSketch]: false,
      [RbacCapability.UploadSketch]: true,
      [RbacCapability.CopyFromPreview]: true,
      [RbacCapability.UpdateThing]: false,
    });
  });

  it('denies upload without sketch::upload', () => {
    const rbac = renderRbac({
      isOrganizationSpace: true,
      policies: { 'sketch::read': true },
    });

    expect(rbac[RbacCapability.UploadSketch]).toBe(false);
  });

  it('grants nothing in preview except copying, also in a private space', () => {
    const { [RbacCapability.CopyFromPreview]: canCopy, ...rest } = renderRbac({
      isViewMode: true,
    });

    expect(Object.values(rest).every((granted) => !granted)).toBe(true);
    expect(canCopy).toBe(true);
  });

  it('copies from preview only with sketch::create in an organization', () => {
    const viewer = renderRbac({
      isViewMode: true,
      isOrganizationSpace: true,
      policies: { 'sketch::read': true, 'sketch::create': false },
    });
    const service = renderRbac({
      isViewMode: true,
      isOrganizationSpace: true,
      policies: SERVICE_POLICIES,
    });

    expect(viewer[RbacCapability.CopyFromPreview]).toBe(false);
    expect(service[RbacCapability.CopyFromPreview]).toBe(true);
    expect(service[RbacCapability.CreateSketch]).toBe(false);
  });

  it('denies everything in an organization while the policies are loading', () => {
    const rbac = renderRbac({ isOrganizationSpace: true });

    expect(rbac[RbacCapability.EditSketch]).toBe(false);
    expect(rbac[RbacCapability.CreateSketch]).toBe(false);
    expect(rbac[RbacCapability.UploadSketch]).toBe(false);
  });

  it('grants nothing without a provider', () => {
    const rbac = renderHook(() => useRbac()).result.current;

    expect(Object.values(rbac).every((granted) => !granted)).toBe(true);
  });
});
