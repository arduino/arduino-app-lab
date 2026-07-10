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

    fireEvent.click(getByText('notes.md'));
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

    fireEvent.click(getByText('notes.md'));
    fireEvent.click(getByText('helper.py'), { ctrlKey: true });

    // app.yaml is not part of the cmd/ctrl selection.
    fireEvent.dragStart(getByText('app.yaml'));

    expect(onFileDragStart).toHaveBeenCalledTimes(1);
    const draggedNodes = onFileDragStart.mock.calls[0][0] as TreeNode[];
    expect(draggedNodes.map((n) => n.path)).toEqual(['app.yaml']);
  });
});
