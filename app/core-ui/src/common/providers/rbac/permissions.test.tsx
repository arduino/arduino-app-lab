import { renderHook } from '@testing-library/react';
import { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { AuthContext, AuthContextValue } from '../auth/authContext';
import { useUserHasPermission, useUserHasPolicy } from './permissions';

type Key = Parameters<typeof useUserHasPermission>[0];

function renderWithAuth(
  value: Partial<
    Pick<AuthContextValue, 'isViewMode' | 'isOrganizationSpace' | 'policies'>
  >,
  useHook: (key: Key) => boolean = useUserHasPermission,
): (key: Key) => boolean {
  const wrapper = ({ children }: { children: ReactNode }): JSX.Element => (
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
      {children}
    </AuthContext.Provider>
  );

  return (key: Key): boolean =>
    renderHook(() => useHook(key), { wrapper }).result.current;
}

describe('useUserHasPolicy', () => {
  it('returns the policy also in preview', () => {
    const has = renderWithAuth(
      {
        isViewMode: true,
        isOrganizationSpace: true,
        policies: { 'sketch::create': true, 'sketch::delete': false },
      },
      useUserHasPolicy,
    );

    expect(has('sketch::create')).toBe(true);
    expect(has('sketch::delete')).toBe(false);
  });

  it('allows everything in a private space, also in preview', () => {
    const has = renderWithAuth({ isViewMode: true }, useUserHasPolicy);

    expect(has('sketch::create')).toBe(true);
  });
});

describe('useUserHasPermission', () => {
  it('allows everything in a private space', () => {
    const can = renderWithAuth({ isOrganizationSpace: false });

    expect(can('sketch::delete')).toBe(true);
  });

  it('denies in an organization while the policies are loading', () => {
    const can = renderWithAuth({ isOrganizationSpace: true });

    expect(can('sketch::read')).toBe(false);
  });

  it('returns the value from the policies map in an organization', () => {
    const can = renderWithAuth({
      isOrganizationSpace: true,
      policies: { 'sketch::read': true, 'sketch::delete': false },
    });

    expect(can('sketch::read')).toBe(true);
    expect(can('sketch::delete')).toBe(false);
  });

  it('denies everything in preview, also in a private space', () => {
    const can = renderWithAuth({
      isViewMode: true,
      isOrganizationSpace: false,
    });

    expect(can('sketch::read')).toBe(false);
  });

  it('denies in preview even when the policies grant the key', () => {
    const can = renderWithAuth({
      isViewMode: true,
      isOrganizationSpace: true,
      policies: { 'sketch::read': true },
    });

    expect(can('sketch::read')).toBe(false);
  });

  it('denies a key missing from the policies map', () => {
    const can = renderWithAuth({
      isOrganizationSpace: true,
      policies: { 'sketch::read': true },
    });

    expect(can('sketch::upload')).toBe(false);
  });
});
