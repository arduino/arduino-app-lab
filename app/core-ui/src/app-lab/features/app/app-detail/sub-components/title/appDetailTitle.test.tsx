import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { PropsWithChildren } from 'react';
import { IntlProvider } from 'react-intl';
import { describe, expect, it, vi } from 'vitest';

// The ui-components app-lab barrel pulls in the serial monitor, which
// constructs a web worker at import time.
vi.hoisted(() => {
  globalThis.Worker = class {
    addEventListener = (): void => undefined;
    postMessage = (): void => undefined;
    terminate = (): void => undefined;
  } as unknown as typeof Worker;
});

vi.mock('@tanstack/react-router', () => ({
  useNavigate: (): (() => void) => vi.fn(),
}));
vi.mock('../../../../../routes/__root', () => ({
  DETAIL_PATH_BY_SECTION: {},
}));
vi.mock('../../../../release/releaseDialogs.logic', () => ({
  useCreateReleaseTrigger: (): {
    openCreateRelease: () => void;
    disabledReason: () => undefined;
  } => ({
    openCreateRelease: vi.fn(),
    disabledReason: (): undefined => undefined,
  }),
}));

import { useCreateAppTitleLogic } from './appDetailTitle';

const wrapper = ({ children }: PropsWithChildren): JSX.Element => (
  <QueryClientProvider client={new QueryClient()}>
    <IntlProvider locale="en">{children}</IntlProvider>
  </QueryClientProvider>
);

type TitleLogicArgs = Parameters<typeof useCreateAppTitleLogic>;

const renderTitleLogic = (
  updateApp: NonNullable<TitleLogicArgs[5]>,
): { result: { current: ReturnType<typeof useCreateAppTitleLogic> } } =>
  renderHook(
    () =>
      useCreateAppTitleLogic(
        { id: 'app-1', name: 'My App' } as TitleLogicArgs[0],
        'stopped' as TitleLogicArgs[1],
        'my-apps' as TitleLogicArgs[2],
        undefined,
        undefined,
        updateApp,
      ),
    { wrapper },
  );

describe('useCreateAppTitleLogic - rename', () => {
  it('does not rename to a name made only of spaces', async () => {
    const updateApp = vi.fn().mockResolvedValue(true);
    const { result } = renderTitleLogic(updateApp);

    act(() => result.current().onAppNameChange('   '));
    await act(() => result.current().onRenameApp());

    expect(updateApp).not.toHaveBeenCalled();
    expect(result.current().name).toBe('My App');
  });

  it('sends the trimmed name', async () => {
    const updateApp = vi.fn().mockResolvedValue(true);
    const { result } = renderTitleLogic(updateApp);

    act(() => result.current().onAppNameChange('  New Name  '));
    await act(() => result.current().onRenameApp());

    expect(updateApp).toHaveBeenCalledWith({ name: 'New Name' });
  });

  it('shows the trimmed name when only spaces were added', async () => {
    const updateApp = vi.fn().mockResolvedValue(true);
    const { result } = renderTitleLogic(updateApp);

    act(() => result.current().onAppNameChange('  My App  '));
    await act(() => result.current().onRenameApp());

    expect(updateApp).toHaveBeenCalledWith({ name: 'My App' });
    expect(result.current().name).toBe('My App');
  });
});
