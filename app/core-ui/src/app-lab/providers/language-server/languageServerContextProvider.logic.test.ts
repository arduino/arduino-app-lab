import { SelectableFileData } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useLanguageServer } from './languageServerContextProvider.logic';

const sketchFile: SelectableFileData = {
  fileId: 'sketch/sketch.ino',
  fileFullName: 'sketch.ino',
  fileName: 'sketch',
  fileExtension: 'ino',
  tags: [],
};

const pythonFile: SelectableFileData = {
  fileId: 'python/main.py',
  fileFullName: 'main.py',
  fileName: 'main',
  fileExtension: 'py',
  tags: [],
};

describe('useLanguageServer', () => {
  it('resolves the LS state of the active file', () => {
    const { result } = renderHook(() => useLanguageServer());

    expect(result.current.lspId).toBeUndefined();
    expect(result.current.lspState).toEqual({ type: 'idle' });

    act(() => {
      result.current.setActiveSelectedFile(sketchFile);
      result.current.setLspStates((prev) => ({
        ...prev,
        arduino: { type: 'progress', progress: 40 },
      }));
    });

    expect(result.current.lspId).toBe('arduino');
    expect(result.current.lspState).toEqual({ type: 'progress', progress: 40 });
  });

  // The footer shows a single indicator for the active file's language server, so
  // a failed one must not follow the user to a file it does not handle: a dead
  // Arduino LS says nothing about Python.
  it('scopes a failed LS to the files it handles', () => {
    const { result } = renderHook(() => useLanguageServer());

    act(() => {
      result.current.setActiveSelectedFile(sketchFile);
      result.current.setLspStates((prev) => ({
        ...prev,
        arduino: { type: 'error', message: 'clangd never started' },
      }));
    });

    expect(result.current.lspId).toBe('arduino');
    expect(result.current.lspState).toEqual({
      type: 'error',
      message: 'clangd never started',
    });

    act(() => {
      result.current.setActiveSelectedFile(pythonFile);
    });

    expect(result.current.lspId).toBe('python');
    expect(result.current.lspState).toEqual({ type: 'idle' });

    // ...and going back to the sketch still reports it, since the failure is real.
    act(() => {
      result.current.setActiveSelectedFile(sketchFile);
    });

    expect(result.current.lspState).toEqual({
      type: 'error',
      message: 'clangd never started',
    });
  });

  it('goes back to idle on reset, so a loader interrupted by leaving the app does not stay stuck', () => {
    const { result } = renderHook(() => useLanguageServer());

    act(() => {
      result.current.setActiveSelectedFile(sketchFile);
      result.current.setLspStates((prev) => ({
        ...prev,
        arduino: { type: 'progress', progress: 40 },
      }));
    });

    act(() => {
      result.current.resetLspState();
    });

    expect(result.current.activeSelectedFile).toBeUndefined();
    expect(result.current.lspId).toBeUndefined();
    expect(result.current.lspState).toEqual({ type: 'idle' });

    // The per-LS states are cleared too, not just the active file lookup.
    act(() => {
      result.current.setActiveSelectedFile(sketchFile);
    });

    expect(result.current.lspState).toEqual({ type: 'idle' });
  });
});
