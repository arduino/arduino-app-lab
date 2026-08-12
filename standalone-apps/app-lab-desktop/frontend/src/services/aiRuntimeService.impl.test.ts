import { beforeEach, describe, expect, it, vi } from 'vitest';

const { app, runtime } = vi.hoisted(() => {
  const eventHandlers: Record<string, (...args: unknown[]) => void> = {};
  return {
    app: {
      RuntimeStatus: vi.fn(async () => ({
        installed: true,
        version: '20.0.0',
        diskUsageBytes: 123,
      })),
      RuntimeInstall: vi.fn(async () => undefined),
      RuntimeUninstall: vi.fn(async () => undefined),
      RuntimeCancelInstall: vi.fn(async () => undefined),
    },
    runtime: {
      eventHandlers,
      EventsOn: vi.fn(
        (name: string, cb: (...args: unknown[]) => void): (() => void) => {
          eventHandlers[name] = cb;
          return (): void => {
            delete eventHandlers[name];
          };
        },
      ),
    },
  };
});

vi.mock('../../wailsjs/go/app/App', () => app);
vi.mock('../../wailsjs/runtime/runtime', () => ({
  EventsOn: runtime.EventsOn,
}));

import * as svc from './aiRuntimeService.impl.standalone';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('aiRuntimeService.impl', () => {
  it('maps RuntimeStatus fields 1:1', async () => {
    expect(await svc.status('claude')).toEqual({
      installed: true,
      version: '20.0.0',
      diskUsageBytes: 123,
    });
    expect(app.RuntimeStatus).toHaveBeenCalledWith('claude');
  });

  it('forwards install/uninstall/cancel (with the agent id) to the bindings', async () => {
    await svc.install('claude');
    await svc.uninstall('claude');
    await svc.cancel('claude');
    expect(app.RuntimeInstall).toHaveBeenCalledWith('claude');
    expect(app.RuntimeUninstall).toHaveBeenCalledWith('claude');
    expect(app.RuntimeCancelInstall).toHaveBeenCalledWith('claude');
  });

  it('forwards airuntime:progress events to the handler', () => {
    const seen: unknown[] = [];
    svc.onProgress((p) => seen.push(p));
    runtime.eventHandlers['airuntime:progress']({
      phase: 'download',
      pct: 0.5,
    });
    expect(seen).toEqual([{ phase: 'download', pct: 0.5 }]);
  });
});
