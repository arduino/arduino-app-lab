/**
 * Regression tests for CE-1922 and the SBC drag-and-drop failure: the
 * inline create/rename input disappeared as soon as it rendered on slow
 * devices, and moving a file by drag and drop failed on WebKitGTK with
 * "Invariant Violation: Cannot call hover while not dragging".
 *
 * Root cause of both: the row/node renderers were `useCallback` closures
 * passed to react-arborist, which mounts them as component *types*. Every
 * identity change (e.g. an unstable `selectedNode`, or `dragOverZone`
 * updating mid-drag) therefore unmounted and remounted every visible row —
 * destroying the focused create/rename input mid-edit, and detaching the
 * react-dnd drag source from the DOM mid-drag so WebKitGTK ended the drag
 * before the drop arrived.
 */
import { act, fireEvent, render } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

import FileTree from './FileTree';
import { FileTreeApi, TreeNode } from './fileTree.type';

const makeNodes = (): TreeNode[] => [
  {
    name: 'sketch',
    path: 'sketch',
    type: 'folder',
    children: [
      {
        name: 'sketch.ino',
        path: 'sketch/sketch.ino',
        type: 'file',
        extension: 'ino',
        mimeType: 'text/plain',
      },
    ],
  },
  {
    name: 'app.yaml',
    path: 'app.yaml',
    type: 'file',
    extension: 'yaml',
    mimeType: 'text/yaml',
  },
  {
    name: 'notes.md',
    path: 'notes.md',
    type: 'file',
    extension: 'md',
    mimeType: 'text/markdown',
  },
  {
    name: 'helper.py',
    path: 'helper.py',
    type: 'file',
    extension: 'py',
    mimeType: 'text/x-python',
  },
];

const baseProps = {
  height: 400,
  isReadOnly: false,
  selectedFileChange: vi.fn(),
  onFolderSelect: vi.fn(),
  renderNodeIcon: (): JSX.Element => <span />,
  onFileCreate: vi.fn(() => Promise.resolve()),
  onFileRename: vi.fn(() => Promise.resolve()),
  onFileDelete: vi.fn(() => Promise.resolve()),
  onFileMove: vi.fn(() => Promise.resolve()),
  onFolderCreate: vi.fn(() => Promise.resolve()),
  onResourceImport: vi.fn(),
  isBricksSelected: false,
  onAddBrick: vi.fn(),
  onAddSketchLibrary: vi.fn(),
};

const selectedFile = (): TreeNode => ({
  name: 'app.yaml',
  path: 'app.yaml',
  type: 'file',
  extension: 'yaml',
  mimeType: 'text/yaml',
});

describe('FileTree inline edit input stability (CE-1922)', () => {
  it('keeps the same focused input when selectedNode changes identity mid-create', () => {
    vi.useFakeTimers();
    const ref = createRef<FileTreeApi>();
    const nodes = makeNodes();

    const { container, rerender } = render(
      <FileTree
        ref={ref}
        {...baseProps}
        nodes={nodes}
        selectedNode={selectedFile()}
      />,
    );

    // Enter create mode at root, like the context-menu CTA does.
    act(() => {
      ref.current!.handleFileCreate('');
    });
    // Let the deferred input focus run.
    act(() => {
      vi.advanceTimersByTime(50);
    });

    const inputBefore = container.querySelector('input');
    expect(inputBefore).not.toBeNull();
    expect(document.activeElement).toBe(inputBefore);

    fireEvent.change(inputBefore!, { target: { value: 'notes.md' } });

    // Simulate the app re-rendering with a new selectedNode object of the
    // same logical value (the multipanel churn that exposed the bug).
    rerender(
      <FileTree
        ref={ref}
        {...baseProps}
        nodes={nodes}
        selectedNode={selectedFile()}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(50);
    });

    const inputAfter = container.querySelector('input');
    expect(inputAfter).not.toBeNull();
    // The row must not be remounted: same DOM element, focus and typed
    // value preserved.
    expect(inputAfter).toBe(inputBefore);
    expect(document.activeElement).toBe(inputAfter);
    expect((inputAfter as HTMLInputElement).value).toBe('notes.md');

    vi.useRealTimers();
  });

  it('keeps the rename input and its value across unrelated re-renders', () => {
    vi.useFakeTimers();
    const ref = createRef<FileTreeApi>();
    const nodes = makeNodes();

    const { container, rerender } = render(
      <FileTree
        ref={ref}
        {...baseProps}
        nodes={nodes}
        selectedNode={selectedFile()}
      />,
    );

    // Rename shares the same isEditing -> input render path as create.
    act(() => {
      ref.current!.handleFileCreate('');
    });
    act(() => {
      vi.advanceTimersByTime(50);
    });

    const inputBefore = container.querySelector('input');
    expect(inputBefore).not.toBeNull();
    fireEvent.change(inputBefore!, { target: { value: 'helper.h' } });

    rerender(
      <FileTree
        ref={ref}
        {...baseProps}
        nodes={makeNodes()}
        selectedNode={selectedFile()}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(50);
    });

    const inputAfter = container.querySelector('input');
    expect(inputAfter).toBe(inputBefore);
    expect((inputAfter as HTMLInputElement).value).toBe('helper.h');

    vi.useRealTimers();
  });

  it('keeps row DOM nodes mounted when the drag-over zone changes mid-drag', () => {
    const ref = createRef<FileTreeApi>();
    const nodes = makeNodes();

    const { container } = render(
      <FileTree
        ref={ref}
        {...baseProps}
        nodes={nodes}
        selectedNode={selectedFile()}
      />,
    );

    const rowsBefore = Array.from(
      container.querySelectorAll('[role="treeitem"]'),
    );
    expect(rowsBefore.length).toBeGreaterThan(0);

    // Hovering a row during a drag updates `dragOverZone`. This used to
    // change the renderRow identity, remounting every row and detaching
    // the react-dnd drag source mid-drag, which made the drop fail on
    // WebKitGTK (SBC) with "Cannot call hover while not dragging".
    fireEvent.dragOver(rowsBefore[0]!);

    const rowsAfter = Array.from(
      container.querySelectorAll('[role="treeitem"]'),
    );
    expect(rowsAfter.length).toBe(rowsBefore.length);
    rowsBefore.forEach((el, i) => {
      expect(rowsAfter[i]).toBe(el);
    });
  });
});

describe('FileTree selection reconciliation on external tree change', () => {
  const rowOf = (labelEl: HTMLElement): HTMLElement => {
    const row = labelEl.closest('[role="button"]');
    if (!row) throw new Error('tree row not found');
    return row as HTMLElement;
  };
  const isSelected = (row: HTMLElement): boolean =>
    /selected/.test(row.className);

  it('lets the injected selectedNode drive the highlight after a plain click (no shadowing size-1 multi-selection)', () => {
    const selected = selectedFile(); // app.yaml

    const { getByText } = render(
      <FileTree {...baseProps} nodes={makeNodes()} selectedNode={selected} />,
    );

    // A plain click no longer seeds the internal multi-selection; in the app
    // it opens the file and the parent updates `selectedNode`. Here
    // `selectedNode` is a fixed prop, so the highlight must stay on it (app.yaml)
    // rather than jumping to the clicked row via an internal size-1 set.
    fireEvent.click(getByText('helper.py'));
    expect(isSelected(rowOf(getByText('app.yaml')))).toBe(true);
    expect(isSelected(rowOf(getByText('helper.py')))).toBe(false);
  });

  it('prunes a genuine multi-selection when one of its nodes leaves the tree', () => {
    const { getByText, queryByText, rerender } = render(
      <FileTree {...baseProps} nodes={makeNodes()} selectedNode={undefined} />,
    );

    // Build a real (size >= 2) multi-selection with cmd/ctrl-clicks.
    fireEvent.click(getByText('notes.md'), { ctrlKey: true });
    fireEvent.click(getByText('helper.py'), { ctrlKey: true });
    expect(isSelected(rowOf(getByText('notes.md')))).toBe(true);
    expect(isSelected(rowOf(getByText('helper.py')))).toBe(true);

    // helper.py is removed on disk → pruned from the multi-selection.
    rerender(
      <FileTree
        {...baseProps}
        nodes={makeNodes().filter((n) => n.path !== 'helper.py')}
        selectedNode={undefined}
      />,
    );
    expect(queryByText('helper.py')).toBeNull();
    expect(isSelected(rowOf(getByText('notes.md')))).toBe(true);

    // Recreated at the same path, it must NOT come back selected (the stale id
    // was pruned, so it is no longer a member of the multi-selection).
    rerender(
      <FileTree {...baseProps} nodes={makeNodes()} selectedNode={undefined} />,
    );
    expect(isSelected(rowOf(getByText('helper.py')))).toBe(false);
    expect(isSelected(rowOf(getByText('notes.md')))).toBe(true);
  });
});

describe('FileTree drag selection semantics', () => {
  it('drags only the grabbed file when another file is selected with a plain click', () => {
    const onFileDragStart = vi.fn();
    const { getByText } = render(
      <FileTree
        {...baseProps}
        nodes={makeNodes()}
        selectedNode={undefined}
        onFileDragStart={onFileDragStart}
      />,
    );

    // Plain click selects notes.md (this also populates the internal
    // multi-selection set with that single entry).
    fireEvent.click(getByText('notes.md'));

    // Grabbing a different, non-selected file must drag only that file.
    fireEvent.dragStart(getByText('helper.py'));

    expect(onFileDragStart).toHaveBeenCalledTimes(1);
    const draggedNodes = onFileDragStart.mock.calls[0][0] as TreeNode[];
    expect(draggedNodes.map((n) => n.path)).toEqual(['helper.py']);
  });

  it('drags the whole multi-selection when grabbing a file that is part of it', () => {
    const onFileDragStart = vi.fn();
    const { getByText } = render(
      <FileTree
        {...baseProps}
        nodes={makeNodes()}
        selectedNode={undefined}
        onFileDragStart={onFileDragStart}
      />,
    );

    // Build a genuine multi-selection (cmd/ctrl-click each member); a plain
    // click no longer seeds the set.
    fireEvent.click(getByText('notes.md'), { ctrlKey: true });
    fireEvent.click(getByText('helper.py'), { ctrlKey: true });

    fireEvent.dragStart(getByText('helper.py'));

    expect(onFileDragStart).toHaveBeenCalledTimes(1);
    const draggedNodes = onFileDragStart.mock.calls[0][0] as TreeNode[];
    expect(draggedNodes.map((n) => n.path).sort()).toEqual([
      'helper.py',
      'notes.md',
    ]);
  });

  it('drags only the grabbed file when it is outside the multi-selection', () => {
    const onFileDragStart = vi.fn();
    const { getByText } = render(
      <FileTree
        {...baseProps}
        nodes={makeNodes()}
        selectedNode={undefined}
        onFileDragStart={onFileDragStart}
      />,
    );

    fireEvent.click(getByText('notes.md'), { ctrlKey: true });
    fireEvent.click(getByText('helper.py'), { ctrlKey: true });

    // app.yaml is not part of the cmd/ctrl selection.
    fireEvent.dragStart(getByText('app.yaml'));

    expect(onFileDragStart).toHaveBeenCalledTimes(1);
    const draggedNodes = onFileDragStart.mock.calls[0][0] as TreeNode[];
    expect(draggedNodes.map((n) => n.path)).toEqual(['app.yaml']);
  });
});

describe('FileTree empty name validation', () => {
  it('does not create file with empty name', () => {
    vi.useFakeTimers();
    const ref = createRef<FileTreeApi>();
    const onFileCreate = vi.fn(() => Promise.resolve());
    const { container } = render(
      <FileTree
        ref={ref}
        {...baseProps}
        nodes={makeNodes()}
        selectedNode={selectedFile()}
        onFileCreate={onFileCreate}
      />,
    );

    act(() => {
      ref.current!.handleFileCreate('');
    });
    act(() => {
      vi.advanceTimersByTime(50);
    });

    const input = container.querySelector('input');
    expect(input).not.toBeNull();

    // Submit with empty string
    fireEvent.change(input!, { target: { value: '' } });
    fireEvent.keyDown(input!, { key: 'Enter' });

    expect(onFileCreate).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('does not create file with whitespace-only name', () => {
    vi.useFakeTimers();
    const ref = createRef<FileTreeApi>();
    const onFileCreate = vi.fn(() => Promise.resolve());
    const { container } = render(
      <FileTree
        ref={ref}
        {...baseProps}
        nodes={makeNodes()}
        selectedNode={selectedFile()}
        onFileCreate={onFileCreate}
      />,
    );

    act(() => {
      ref.current!.handleFileCreate('');
    });
    act(() => {
      vi.advanceTimersByTime(50);
    });

    const input = container.querySelector('input');
    expect(input).not.toBeNull();

    // Submit with whitespace only
    fireEvent.change(input!, { target: { value: '   ' } });
    fireEvent.keyDown(input!, { key: 'Enter' });

    expect(onFileCreate).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('trims trailing spaces rather than rejecting them', () => {
    vi.useFakeTimers();
    const ref = createRef<FileTreeApi>();
    const onFileCreate = vi.fn(() => Promise.resolve());
    const { container } = render(
      <FileTree
        ref={ref}
        {...baseProps}
        nodes={makeNodes()}
        selectedNode={selectedFile()}
        onFileCreate={onFileCreate}
      />,
    );

    act(() => {
      ref.current!.handleFileCreate('');
    });
    act(() => {
      vi.advanceTimersByTime(50);
    });

    const input = container.querySelector('input');
    expect(input).not.toBeNull();

    // Trailing whitespace is user slop, not an invalid name: it is trimmed off
    // and the trimmed name is what gets created. A trailing *dot* cannot be
    // trimmed away, so that one is rejected (covered below).
    fireEvent.change(input!, { target: { value: 'test.py  ' } });
    fireEvent.keyDown(input!, { key: 'Enter' });

    expect(onFileCreate).toHaveBeenCalledWith('test.py');

    vi.useRealTimers();
  });

  it('rejects file with Windows-invalid characters', () => {
    vi.useFakeTimers();
    const ref = createRef<FileTreeApi>();
    const onFileCreate = vi.fn(() => Promise.resolve());
    const { container } = render(
      <FileTree
        ref={ref}
        {...baseProps}
        nodes={makeNodes()}
        selectedNode={selectedFile()}
        onFileCreate={onFileCreate}
      />,
    );

    act(() => {
      ref.current!.handleFileCreate('');
    });
    act(() => {
      vi.advanceTimersByTime(50);
    });

    const input = container.querySelector('input');
    expect(input).not.toBeNull();

    // '$' and '`' expand even inside the double quotes the transports apply to
    // board paths; the rest are illegal in a name on a Windows host, which the
    // LSP workspace mirror writes to.
    const invalidChars = [
      'test$file',
      'test`file',
      '<test>',
      'test:file',
      'test"file',
      'test|file',
      'test?file',
      'test*file',
      'test\\file',
      'nested/file',
    ];
    invalidChars.forEach((invalidName) => {
      fireEvent.change(input!, { target: { value: invalidName } });
      fireEvent.keyDown(input!, { key: 'Enter' });
    });

    expect(onFileCreate).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('rejects file with Windows reserved names', () => {
    vi.useFakeTimers();
    const ref = createRef<FileTreeApi>();
    const onFileCreate = vi.fn(() => Promise.resolve());
    const { container } = render(
      <FileTree
        ref={ref}
        {...baseProps}
        nodes={makeNodes()}
        selectedNode={selectedFile()}
        onFileCreate={onFileCreate}
      />,
    );

    act(() => {
      ref.current!.handleFileCreate('');
    });
    act(() => {
      vi.advanceTimersByTime(50);
    });

    const input = container.querySelector('input');
    expect(input).not.toBeNull();

    // Test Windows reserved names
    const reservedNames = [
      'con',
      'prn',
      'aux',
      'nul',
      'com1',
      'lpt1',
      'CON',
      'con.txt',
    ];
    reservedNames.forEach((reservedName) => {
      fireEvent.change(input!, { target: { value: reservedName } });
      fireEvent.keyDown(input!, { key: 'Enter' });
    });

    expect(onFileCreate).not.toHaveBeenCalled();

    vi.useRealTimers();
  });
  const openCreateInput = (
    onFileCreate: (path: string) => Promise<void>,
    onValidationError?: () => void,
  ): HTMLInputElement => {
    const ref = createRef<FileTreeApi>();
    const { container } = render(
      <FileTree
        ref={ref}
        {...baseProps}
        nodes={makeNodes()}
        selectedNode={selectedFile()}
        onFileCreate={onFileCreate}
        onValidationError={onValidationError}
      />,
    );
    act(() => {
      ref.current!.handleFileCreate('');
    });
    act(() => {
      vi.advanceTimersByTime(50);
    });
    const input = container.querySelector('input');
    expect(input).not.toBeNull();
    return input as HTMLInputElement;
  };

  it('rejects a trailing dot, which trimming cannot remove', () => {
    vi.useFakeTimers();
    const onFileCreate = vi.fn(() => Promise.resolve());
    const input = openCreateInput(onFileCreate);

    fireEvent.change(input, { target: { value: 'test.py.' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onFileCreate).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('holds the input open on Enter so an invalid name can be corrected', () => {
    vi.useFakeTimers();
    const onFileCreate = vi.fn(() => Promise.resolve());
    const onValidationError = vi.fn();
    const input = openCreateInput(onFileCreate, onValidationError);

    fireEvent.change(input, { target: { value: 'my$file.py' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // Refused, but the typed text survives and the row says why, so the name
    // can be fixed in place instead of vanishing and starting over.
    expect(onFileCreate).not.toHaveBeenCalled();
    expect(onValidationError).toHaveBeenCalled();
    expect(input).toHaveValue('my$file.py');
    expect(input).toHaveAttribute('aria-invalid', 'true');

    fireEvent.change(input, { target: { value: 'my_file.py' } });
    expect(input).toHaveAttribute('aria-invalid', 'false');
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onFileCreate).toHaveBeenCalledWith('my_file.py');
    vi.useRealTimers();
  });

  it('cancels on blur with an invalid name rather than trapping the row', () => {
    vi.useFakeTimers();
    const onFileCreate = vi.fn(() => Promise.resolve());
    const input = openCreateInput(onFileCreate);

    fireEvent.change(input, { target: { value: 'my$file.py' } });
    // Blur is only treated as deliberate once the focus grace period has passed.
    act(() => {
      vi.advanceTimersByTime(300);
    });
    fireEvent.blur(input);

    expect(onFileCreate).not.toHaveBeenCalled();
    // Escape must not be the only way out: the row is gone, not stuck in an
    // input that can never be submitted.
    expect(document.querySelectorAll('input')).toHaveLength(0);
    vi.useRealTimers();
  });

  it('accepts names that are legal on the board and on the host', () => {
    vi.useFakeTimers();
    const onFileCreate = vi.fn(() => Promise.resolve());
    const input = openCreateInput(onFileCreate);

    fireEvent.change(input, { target: { value: 'sensor_v2-final.py' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onFileCreate).toHaveBeenCalledWith('sensor_v2-final.py');
    vi.useRealTimers();
  });

  // Spaces and most punctuation are safe: conn.ReadFile/WriteFile quote the
  // board path, so these are inert. They are also the names users actually
  // type, and rejecting them was needlessly strict.
  it.each([
    'my notes.txt',
    'notes (draft) v2.md',
    "it's mine.txt",
    'issue #12.md',
    'a&b.py',
    'a;b.py',
    'log{1}.txt',
    'log[1].txt',
  ])('accepts %j', (name) => {
    vi.useFakeTimers();
    const onFileCreate = vi.fn(() => Promise.resolve());
    const input = openCreateInput(onFileCreate);

    fireEvent.change(input, { target: { value: name } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onFileCreate).toHaveBeenCalledWith(name);
    vi.useRealTimers();
  });
});
