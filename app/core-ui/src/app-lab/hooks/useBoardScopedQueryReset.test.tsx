import { Board } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import React, { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useBoardLifecycleStore } from '../store/boardLifecycle';
import { useBoardScopedQueryReset } from './useBoardScopedQueryReset';

const makeBoard = (overrides: Partial<Board>): Board => ({
  id: 'id',
  name: 'name',
  type: 'Arduino Uno Q',
  fqbn: 'fqbn',
  connectionType: 'USB',
  protocol: 'serial',
  serial: 'serial',
  address: '',
  ...overrides,
});

const usbA = makeBoard({ serial: 'AAA' });
const usbB = makeBoard({ serial: 'BBB' });
// Network boards commonly report an empty/unreliable serial, so identity must
// come from the IP address (see getBoardCacheId).
const netA = makeBoard({
  connectionType: 'Network',
  serial: '',
  address: '192.168.1.10',
});
const netB = makeBoard({
  connectionType: 'Network',
  serial: '',
  address: '192.168.1.11',
});

let queryClient: QueryClient;

const wrapper = ({ children }: { children: ReactNode }): JSX.Element => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

const connect = (board: Board | undefined): void => {
  act(() => {
    useBoardLifecycleStore.setState({ selectedConnectedBoard: board });
  });
};

beforeEach(() => {
  queryClient = new QueryClient();
  useBoardLifecycleStore.setState({ selectedConnectedBoard: undefined });
});

afterEach(() => {
  queryClient.clear();
  useBoardLifecycleStore.setState({ selectedConnectedBoard: undefined });
});

describe('useBoardScopedQueryReset', () => {
  const seedCaches = (): void => {
    queryClient.setQueryData(['list-my-apps'], [{ id: 'app-1' }]);
    queryClient.setQueryData(['get-brick-details', 'brick-1'], {
      id: 'brick-1',
    });
    // Not board-scoped — must survive a switch.
    queryClient.setQueryData(['boards'], [usbA, usbB]);
  };

  it('does not reset on the first board connection of the session', async () => {
    renderHook(() => useBoardScopedQueryReset(), { wrapper });
    seedCaches();

    connect(usbA);

    await waitFor(() => {
      expect(queryClient.getQueryData(['list-my-apps'])).toBeDefined();
    });
    expect(
      queryClient.getQueryData(['get-brick-details', 'brick-1']),
    ).toBeDefined();
  });

  it('resets board-scoped queries on a switch and keeps non-scoped ones', async () => {
    renderHook(() => useBoardScopedQueryReset(), { wrapper });
    connect(usbA);
    seedCaches();

    connect(usbB);

    await waitFor(() => {
      expect(queryClient.getQueryData(['list-my-apps'])).toBeUndefined();
    });
    expect(
      queryClient.getQueryData(['get-brick-details', 'brick-1']),
    ).toBeUndefined();
    expect(queryClient.getQueryData(['boards'])).toBeDefined();
  });

  it('does not reset when the same board reconnects', async () => {
    renderHook(() => useBoardScopedQueryReset(), { wrapper });
    connect(usbA);
    seedCaches();

    connect(undefined); // transient disconnect
    connect(usbA); // same board back

    // give the effect a chance to (incorrectly) fire
    await new Promise((r) => setTimeout(r, 0));
    expect(queryClient.getQueryData(['list-my-apps'])).toBeDefined();
  });

  it('resets after a disconnect then reconnect to a different board', async () => {
    renderHook(() => useBoardScopedQueryReset(), { wrapper });
    connect(usbA);
    seedCaches();

    connect(undefined);
    connect(usbB);

    await waitFor(() => {
      expect(queryClient.getQueryData(['list-my-apps'])).toBeUndefined();
    });
  });

  it('detects a switch between network boards by IP address, not serial', async () => {
    renderHook(() => useBoardScopedQueryReset(), { wrapper });
    connect(netA);
    seedCaches();

    // Both network boards report serial '' — only the address differs.
    connect(netB);

    await waitFor(() => {
      expect(queryClient.getQueryData(['list-my-apps'])).toBeUndefined();
    });
  });
});
