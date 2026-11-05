/**
 * Tests for the context menu's clipboard seam (ADR-0002).
 *
 * The editor used to import App Lab's clipboard service directly and branch on
 * `Config.APP_NAME`. Both are gone: the host injects an `EditorClipboard`, and
 * the desktop shell's "paste what was last copied here" behaviour is selected
 * by `preferInMemoryPaste` rather than by which app is running. These tests pin
 * the three paths a host can end up on — mirror, direct read, and no injection
 * at all.
 */

import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import {
  act,
  renderHook,
  RenderHookResult,
  waitFor,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ContextMenuItemIds } from '../../context-menu/contextMenu.type';
import { EditorClipboard } from '../codeEditor.type';
import { useContextMenu } from './useContextMenu';

const DOC = 'value = 1';
// Selects `value`, so a copy or cut has something to work with.
const SELECTION = { anchor: 0, head: 5 };

/**
 * A stand-in for the real view: the hook only reads `state` and dispatches, and
 * a real EditorView needs layout jsdom does not have.
 */
function makeView(doc = DOC): EditorView {
  let state = EditorState.create({ doc, selection: SELECTION });
  return {
    get state() {
      return state;
    },
    dispatch: (spec: Parameters<EditorView['dispatch']>[0]) => {
      state = state.update(spec as never).state;
    },
  } as unknown as EditorView;
}

function makeClipboard(
  overrides: Partial<EditorClipboard> = {},
): EditorClipboard {
  return {
    readText: vi.fn().mockResolvedValue(null),
    writeText: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function renderContextMenu(
  clipboard?: EditorClipboard,
  view = makeView(),
): RenderHookResult<ReturnType<typeof useContextMenu>, unknown> & {
  setCode: ReturnType<typeof vi.fn>;
  view: EditorView;
} {
  const setCode = vi.fn();
  const rendered = renderHook(() =>
    useContextMenu({
      viewInstance: view,
      setCode,
      code: view.state.doc.toString(),
      isLspEnabled: false,
      lspClients: undefined,
      currentFileExt: 'py',
      readOnly: false,
      clipboard,
    }),
  );
  return { ...rendered, setCode, view };
}

describe('useContextMenu clipboard injection', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('copies through the injected clipboard', async () => {
    const clipboard = makeClipboard();
    const { result } = renderContextMenu(clipboard);

    await act(async () => {
      await result.current.clickHandlers[ContextMenuItemIds.Copy]?.();
    });

    expect(clipboard.writeText).toHaveBeenCalledWith('value');
  });

  it('pastes from the in-memory mirror when the host prefers it', async () => {
    const clipboard = makeClipboard({ preferInMemoryPaste: true });
    const { result, view, setCode } = renderContextMenu(clipboard);

    await act(async () => {
      await result.current.clickHandlers[ContextMenuItemIds.Copy]?.();
    });
    (clipboard.readText as ReturnType<typeof vi.fn>).mockClear();

    await act(async () => {
      await result.current.clickHandlers[ContextMenuItemIds.Paste]?.();
    });

    // The mirror, not the system clipboard: no read on the paste itself.
    expect(clipboard.readText).not.toHaveBeenCalled();
    expect(view.state.doc.toString()).toBe('value = 1');
    expect(setCode).toHaveBeenCalled();
  });

  it('pastes what the host clipboard reads when it does not', async () => {
    const clipboard = makeClipboard({
      readText: vi.fn().mockResolvedValue('total'),
    });
    const { result, view } = renderContextMenu(clipboard);

    await act(async () => {
      await result.current.clickHandlers[ContextMenuItemIds.Paste]?.();
    });

    expect(clipboard.readText).toHaveBeenCalled();
    expect(view.state.doc.toString()).toBe('total = 1');
  });

  it('disables Paste when the host has nothing to paste', async () => {
    const clipboard = makeClipboard({
      readText: vi.fn().mockResolvedValue(''),
    });
    const { result } = renderContextMenu(clipboard);

    act(() => result.current.setIsOpen(true));

    await waitFor(() =>
      expect(result.current.disabledKeys).toContain(ContextMenuItemIds.Paste),
    );
  });

  it('reads the clipboard the host has now, not the one it had at the last open', async () => {
    const empty = makeClipboard({ readText: vi.fn().mockResolvedValue('') });
    const filled = makeClipboard({
      readText: vi.fn().mockResolvedValue('total'),
    });
    const view = makeView();

    const { result, rerender } = renderHook(
      ({ clipboard }: { clipboard: EditorClipboard }) =>
        useContextMenu({
          viewInstance: view,
          setCode: vi.fn(),
          code: view.state.doc.toString(),
          isLspEnabled: false,
          lspClients: undefined,
          currentFileExt: 'py',
          readOnly: false,
          clipboard,
        }),
      { initialProps: { clipboard: empty } },
    );

    act(() => result.current.setIsOpen(true));
    await waitFor(() =>
      expect(result.current.disabledKeys).toContain(ContextMenuItemIds.Paste),
    );

    act(() => result.current.setIsOpen(false));
    rerender({ clipboard: filled });
    act(() => result.current.setIsOpen(true));

    await waitFor(() =>
      expect(result.current.disabledKeys).not.toContain(
        ContextMenuItemIds.Paste,
      ),
    );
    expect(filled.readText).toHaveBeenCalled();
  });

  it('falls back to the browser clipboard when the host injects none', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText, readText: vi.fn().mockResolvedValue('') },
    });

    const { result } = renderContextMenu();

    await act(async () => {
      await result.current.clickHandlers[ContextMenuItemIds.Copy]?.();
    });

    expect(writeText).toHaveBeenCalledWith('value');
  });
});
