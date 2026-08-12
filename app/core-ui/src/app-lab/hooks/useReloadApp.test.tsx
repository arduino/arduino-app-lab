import { Board } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useReloadApp } from './useReloadApp';

// The router is only read for the current pathname (agent mode is a route) and for navigation.
let pathname = '/my-apps/app-1';
const navigate = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useNavigate: (): typeof navigate => navigate,
  useRouterState: ({
    select,
  }: {
    select: (state: { location: { pathname: string } }) => boolean;
  }): boolean => select({ location: { pathname } }),
}));

// openAppFile is used unmocked: it is import-free by design (the router instance, and with it the
// whole route tree, is only reached from ./openAppFileInEditor). No test here stashes a peek, so
// isPeekedApp reads false throughout.

const board = {
  id: 'id',
  name: 'name',
  type: 'Arduino Uno Q',
  fqbn: 'fqbn',
  connectionType: 'USB',
  protocol: 'serial',
  serial: 'AAA',
  address: '',
} as Board;

const saveAppId = vi.fn().mockResolvedValue(undefined);
const resetAppId = vi.fn().mockResolvedValue(undefined);

type ReloadProps = Parameters<typeof useReloadApp>[0];

const makeBoardsProps = (
  overrides: Partial<ReloadProps['boardsProps']> = {},
): ReloadProps['boardsProps'] =>
  ({
    selectedBoard: board,
    isAutoSelectingBoard: false,
    couldNotAutoSelectBoard: false,
    connToBoardCompleted: true,
    lastAppInfoLoaded: true,
    saveAppId,
    resetAppId,
    ...overrides,
  } as ReloadProps['boardsProps']);

const makeProps = (overrides: Partial<ReloadProps> = {}): ReloadProps => ({
  boardsProps: makeBoardsProps(),
  showRoutes: true,
  currentAppId: 'app-1',
  currentSection: 'my-apps',
  apps: [],
  lastAppInfoLoaded: true,
  ...overrides,
});

// The reset branch is gated on isInitialLoad, which the hook clears after 100ms.
const afterInitialLoad = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 150));

beforeEach(() => {
  pathname = '/my-apps/app-1';
  navigate.mockClear();
  saveAppId.mockClear();
  resetAppId.mockClear();
});

describe('useReloadApp', () => {
  describe('recording the board resume app', () => {
    it('saves the open app as the resume app', async () => {
      renderHook(() => useReloadApp(makeProps()));

      await waitFor(() => {
        expect(saveAppId).toHaveBeenCalledWith('app-1', 'my-apps');
      });
      expect(resetAppId).not.toHaveBeenCalled();
    });

    it('resets the resume app once the user leaves the app', async () => {
      const { rerender } = renderHook(
        (props: ReloadProps) => useReloadApp(props),
        { initialProps: makeProps() },
      );
      await afterInitialLoad();

      pathname = '/my-apps';
      rerender(
        makeProps({ currentAppId: undefined, currentSection: 'my-apps' }),
      );

      await waitFor(() => {
        expect(resetAppId).toHaveBeenCalled();
      });
    });

    it('keeps the resume app when entering agent mode', async () => {
      const { rerender } = renderHook(
        (props: ReloadProps) => useReloadApp(props),
        { initialProps: makeProps() },
      );
      await afterInitialLoad();

      // /ai-assistant is a sibling route with no $appId, so both go undefined.
      pathname = '/ai-assistant';
      rerender(
        makeProps({ currentAppId: undefined, currentSection: undefined }),
      );
      await afterInitialLoad();

      expect(resetAppId).not.toHaveBeenCalled();
    });
  });

  describe('resuming the saved app', () => {
    const withLastApp = (overrides: Partial<ReloadProps> = {}): ReloadProps =>
      makeProps({
        boardsProps: makeBoardsProps({
          lastAppInfo: { appId: 'app-2', section: 'my-apps' },
        }),
        currentAppId: undefined,
        currentSection: undefined,
        ...overrides,
      });

    it('navigates to the saved app on load', async () => {
      pathname = '/my-apps';
      renderHook(() => useReloadApp(withLastApp({ apps: [{ id: 'app-2' }] })));

      await waitFor(() => {
        expect(navigate).toHaveBeenCalledWith({
          to: '/my-apps/$appId',
          params: { appId: 'app-2' },
        });
      });
    });

    it('falls back to the list when the saved app no longer exists (renamed away)', async () => {
      pathname = '/my-apps';
      // app-2 was renamed (the agent minted a new id), so it's gone from the list — don't open a dead id.
      renderHook(() =>
        useReloadApp(withLastApp({ apps: [{ id: 'app-2-renamed' }] })),
      );

      await waitFor(() => {
        expect(navigate).toHaveBeenCalledWith({ to: '/my-apps' });
      });
      expect(navigate).not.toHaveBeenCalledWith({
        to: '/my-apps/$appId',
        params: { appId: 'app-2' },
      });
    });

    it('does not navigate away from agent mode', async () => {
      pathname = '/ai-assistant';
      renderHook(() => useReloadApp(withLastApp()));
      await afterInitialLoad();

      expect(navigate).not.toHaveBeenCalled();
    });
  });
});
