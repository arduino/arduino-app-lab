import { BOARD_FQBN } from '@cloud-editor-mono/common';
import { setUserPassword as apiSetUserPassword } from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import { act, renderHook, waitFor } from '@testing-library/react';
import React, { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import TestProviderWrapper from '../../../../tests-setup';
import { useLinuxCredentials } from './linuxCredentialsContextProvider.logic';

vi.mock(
  '@cloud-editor-mono/domain/src/services/services-by-app/app-lab',
  () => ({
    isUserPasswordSet: vi.fn().mockResolvedValue(false),
    setUserPassword: vi.fn().mockResolvedValue(undefined),
  }),
);

vi.mock('../../store/boardLifecycle', () => ({
  useBoardLifecycleStore: vi.fn((selector) =>
    selector({
      boardIsReachable: true,
    }),
  ),
}));

vi.mock('../../hooks/useBoards', () => ({
  useBoards: vi.fn(() => ({
    selectedBoard: {
      fqbn: BOARD_FQBN.UNO_Q,
    },
  })),
}));

const Wrapper: React.FC<{ children: ReactNode }> = ({ children }) => (
  <TestProviderWrapper>{children}</TestProviderWrapper>
);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useLinuxCredentials - password validation', () => {
  it('sets error if password is shorter than 8 characters', async () => {
    const { result } = renderHook(() => useLinuxCredentials(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.setUserPassword('short', 'short');
    });

    await waitFor(() => {
      expect(result.current.setUserPasswordIsError).toBe(true);
      expect(result.current.userPasswordErrorMsg).toBe(
        'Fill with at least 8 characters',
      );
    });
    expect(apiSetUserPassword).not.toHaveBeenCalled();
  });

  it('sets error if password contains username', async () => {
    const { result } = renderHook(() => useLinuxCredentials(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.setUserPassword('arduino123', 'arduino123');
    });

    await waitFor(() => {
      expect(result.current.setUserPasswordIsError).toBe(true);
      expect(result.current.userPasswordErrorMsg).toBe(
        'Password must not contain the username',
      );
    });
    expect(apiSetUserPassword).not.toHaveBeenCalled();
  });

  it('sets error if password contains username (case insensitive)', async () => {
    const { result } = renderHook(() => useLinuxCredentials(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.setUserPassword('ARDUINO123', 'ARDUINO123');
    });

    await waitFor(() => {
      expect(result.current.setUserPasswordIsError).toBe(true);
      expect(result.current.userPasswordErrorMsg).toBe(
        'Password must not contain the username',
      );
    });
    expect(apiSetUserPassword).not.toHaveBeenCalled();
  });

  it('sets error if password and confirmation do not match', async () => {
    const { result } = renderHook(() => useLinuxCredentials(), {
      wrapper: Wrapper,
    });

    // >= 8 char but mismatch
    act(() => {
      result.current.setUserPassword('abcdefgh', 'abcdefgi');
    });

    await waitFor(() => {
      expect(result.current.setUserPasswordConfirmationIsError).toBe(true);
      expect(result.current.userPasswordConfirmationErrorMsg).toBe(
        "Passwords don't match",
      );
    });
    expect(apiSetUserPassword).not.toHaveBeenCalled();
  });

  it('calls apiSetUserPassword if password is valid and matches confirmation', async () => {
    const { result } = renderHook(() => useLinuxCredentials(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.setUserPassword('abcdefgh', 'abcdefgh');
    });

    await waitFor(() => {
      expect(apiSetUserPassword).toHaveBeenCalledTimes(1);
      expect(apiSetUserPassword).toHaveBeenCalledWith('abcdefgh');
      expect(result.current.setUserPasswordIsError).toBe(false);
      expect(result.current.setUserPasswordConfirmationIsError).toBe(false);
    });
  });

  it('sets error message when apiSetUserPassword fails', async () => {
    const testError = new Error('Invalid credentials');
    vi.mocked(apiSetUserPassword).mockRejectedValueOnce(testError);

    const { result } = renderHook(() => useLinuxCredentials(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.setUserPassword('abcdefgh', 'abcdefgh');
    });

    await waitFor(() => {
      expect(result.current.setUserPasswordIsError).toBe(true);
      expect(result.current.userPasswordErrorMsg).toBe('Invalid credentials');
    });
    expect(apiSetUserPassword).toHaveBeenCalledTimes(1);
  });
});
