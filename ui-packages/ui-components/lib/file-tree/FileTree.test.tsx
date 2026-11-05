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
import * as ContextMenu from '@radix-ui/react-context-menu';
import { act, fireEvent, render } from '@testing-library/react';
import { createRef } from 'react';
import { NodeApi } from 'react-arborist';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { FileContextMenu } from './FileContextMenu';
import FileTree from './FileTree';
import { FileTreeApi, TreeNode } from './fileTree.type';
import { TreeContextMenu } from './TreeContextMenu';

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

const noConflict = (): Promise<{
  hasDuplicate: boolean;
  conflictType: null;
}> => Promise.resolve({ hasDuplicate: false, conflictType: null });

const baseProps = {
  height: 400,
  isReadOnly: false,
  checkPathConflict: vi.fn(noConflict),
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

  const openCreateInput = (
    onFileCreate: (path: string) => Promise<void>,
  ): HTMLInputElement => {
    const ref = createRef<FileTreeApi>();
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
    return input as HTMLInputElement;
  };

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

describe('FileTree lazy folder listing', () => {
  const unlistedNodes = (): TreeNode[] => [
    { name: 'python', path: 'python', type: 'folder', children: null },
    {
      name: 'app.yaml',
      path: 'app.yaml',
      type: 'file',
      extension: 'yaml',
      mimeType: 'text/yaml',
    },
  ];

  const nestedNodes = (): TreeNode[] => [
    {
      name: 'python',
      path: 'python',
      type: 'folder',
      children: [
        { name: 'lib', path: 'python/lib', type: 'folder', children: null },
      ],
    },
  ];

  it('reports the folder path when an unlisted folder is opened', () => {
    const onFolderExpand = vi.fn();
    const { getByText } = render(
      <FileTree
        {...baseProps}
        nodes={unlistedNodes()}
        selectedNode={undefined}
        onFolderExpand={onFolderExpand}
      />,
    );

    fireEvent.click(getByText('python'));

    expect(onFolderExpand).toHaveBeenCalledWith('python', true);
  });

  it('reports the close, so the folder stops being listed', () => {
    const onFolderExpand = vi.fn();
    const { getByText } = render(
      <FileTree
        {...baseProps}
        nodes={unlistedNodes()}
        selectedNode={undefined}
        onFolderExpand={onFolderExpand}
      />,
    );

    fireEvent.click(getByText('python'));
    fireEvent.click(getByText('python'));

    expect(onFolderExpand.mock.calls).toEqual([
      ['python', true],
      ['python', false],
    ]);
  });

  // A subfolder left open comes back open with its parent, so it has to be
  // listed again even though nothing toggled it.
  it('reports the descendants that come back open with the folder', () => {
    const onFolderExpand = vi.fn();
    const { getByText } = render(
      <FileTree
        {...baseProps}
        nodes={nestedNodes()}
        selectedNode={undefined}
        onFolderExpand={onFolderExpand}
      />,
    );

    fireEvent.click(getByText('python'));
    fireEvent.click(getByText('lib'));
    fireEvent.click(getByText('python')); // close
    onFolderExpand.mockClear();

    fireEvent.click(getByText('python')); // reopen

    expect(onFolderExpand.mock.calls).toEqual([
      ['python', true],
      ['python/lib', true],
    ]);
  });

  it('does not report a file selection as a folder open', () => {
    const onFolderExpand = vi.fn();
    const { getByText } = render(
      <FileTree
        {...baseProps}
        nodes={unlistedNodes()}
        selectedNode={undefined}
        onFolderExpand={onFolderExpand}
      />,
    );

    fireEvent.click(getByText('app.yaml'));

    expect(onFolderExpand).not.toHaveBeenCalled();
  });

  it('lists the folder a file is being created in, so the new row shows', () => {
    vi.useFakeTimers();
    const onFolderExpand = vi.fn();
    const ref = createRef<FileTreeApi>();
    render(
      <FileTree
        ref={ref}
        {...baseProps}
        nodes={unlistedNodes()}
        selectedNode={undefined}
        onFolderExpand={onFolderExpand}
      />,
    );

    act(() => {
      ref.current!.handleFileCreate('python');
    });

    expect(onFolderExpand).toHaveBeenCalledWith('python', true);
    vi.useRealTimers();
  });
});

describe('FileTree folder open state', () => {
  const folderNodes = (folderPath = 'sub'): TreeNode[] => [
    {
      name: folderPath.split('/').pop() as string,
      path: folderPath,
      type: 'folder',
      children: [
        {
          name: 'inner',
          path: `${folderPath}/inner`,
          type: 'folder',
          children: [
            {
              name: 'deep.py',
              path: `${folderPath}/inner/deep.py`,
              type: 'file',
              extension: 'py',
              mimeType: 'text/x-python',
            },
          ],
        },
        {
          name: 'main.py',
          path: `${folderPath}/main.py`,
          type: 'file',
          extension: 'py',
          mimeType: 'text/x-python',
        },
      ],
    },
  ];

  // A folder whose listing failed is dropped by the consumer; its row stayed
  // open over nothing until the user closed and reopened it by hand.
  it('closes the folder it is told to close', () => {
    const { getByText, queryByText, rerender } = render(
      <FileTree
        {...baseProps}
        nodes={folderNodes()}
        selectedNode={undefined}
      />,
    );

    fireEvent.click(getByText('sub'));
    expect(queryByText('main.py')).not.toBeNull();

    rerender(
      <FileTree
        {...baseProps}
        nodes={folderNodes()}
        selectedNode={undefined}
        closeFolder={{ path: 'sub', seq: 1 }}
      />,
    );

    expect(queryByText('main.py')).toBeNull();
    const row = getByText('sub').closest('[role="treeitem"]');
    expect(row?.getAttribute('aria-expanded')).toBe('false');
  });

  // The agent renames on the board, so the tree hears of it only from the consumer.
  it.each([
    ['reopens', true],
    ['keeps closed', false],
  ])('%s a folder renamed outside the tree', (_, wasOpen) => {
    const { getByText, queryByText, rerender } = render(
      <FileTree
        {...baseProps}
        nodes={folderNodes()}
        selectedNode={undefined}
      />,
    );
    fireEvent.click(getByText('sub'));
    fireEvent.click(getByText('inner'));
    // Closing a folder leaves its subfolder open, for when it opens again.
    if (!wasOpen) fireEvent.click(getByText('sub'));
    const renamedFolder = { from: 'sub', to: 'sub2', seq: 1 };

    rerender(
      <FileTree
        {...baseProps}
        nodes={folderNodes()}
        selectedNode={undefined}
        renamedFolder={renamedFolder}
      />,
    );
    rerender(
      <FileTree
        {...baseProps}
        nodes={folderNodes('sub2')}
        selectedNode={undefined}
        renamedFolder={renamedFolder}
      />,
    );

    expect(queryByText('main.py') !== null).toBe(wasOpen);
    const row = getByText('sub2').closest('[role="treeitem"]');
    expect(row?.getAttribute('aria-expanded')).toBe(String(wasOpen));

    if (!wasOpen) fireEvent.click(getByText('sub2'));
    expect(queryByText('deep.py')).not.toBeNull();
  });

  const renameThroughMenu = async (
    getByText: (text: string) => HTMLElement,
    folder: string,
    newName: string,
  ): Promise<void> => {
    // Radix places the menu with `DOMRect.fromRect`, which jsdom does not define: its rejection would be reported as an unhandled error.
    vi.stubGlobal('DOMRect', {
      fromRect: (rect: { x: number; y: number }) => ({
        ...rect,
        width: 0,
        height: 0,
        top: rect.y,
        bottom: rect.y,
        left: rect.x,
        right: rect.x,
      }),
    });
    fireEvent.contextMenu(getByText(folder));
    act(() => {
      vi.advanceTimersByTime(50);
    });
    fireEvent.click(getByText('Rename'));
    act(() => {
      vi.advanceTimersByTime(50);
    });

    const input = document.querySelector('input') as HTMLInputElement;
    expect(input).not.toBeNull();
    fireEvent.change(input, { target: { value: newName } });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });
  };

  // The renamed folder and its subfolders are new row ids, which react-arborist has closed.
  it('reopens a renamed folder that was open, and the subfolder open in it', async () => {
    vi.useFakeTimers();
    const onFileRename = vi.fn(() => Promise.resolve());
    const { getByText, queryByText, rerender } = render(
      <FileTree
        {...baseProps}
        nodes={folderNodes()}
        selectedNode={undefined}
        onFileRename={onFileRename}
      />,
    );

    fireEvent.click(getByText('sub'));
    fireEvent.click(getByText('inner'));
    expect(queryByText('deep.py')).not.toBeNull();

    await renameThroughMenu(getByText, 'sub', 'renamed');

    expect(onFileRename).toHaveBeenCalledWith('sub', 'renamed', 'folder');

    // The consumer reports the rename once the board has done it, then lists the folder under its new path.
    const renamedFolder = { from: 'sub', to: 'renamed', seq: 1 };
    rerender(
      <FileTree
        {...baseProps}
        nodes={folderNodes()}
        selectedNode={undefined}
        onFileRename={onFileRename}
        renamedFolder={renamedFolder}
      />,
    );
    rerender(
      <FileTree
        {...baseProps}
        nodes={folderNodes('renamed')}
        selectedNode={undefined}
        onFileRename={onFileRename}
        renamedFolder={renamedFolder}
      />,
    );

    expect(queryByText('main.py')).not.toBeNull();
    expect(queryByText('deep.py')).not.toBeNull();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  // A refused name, here one taken by a folder with an `inner` of its own, leaves no folder open that the user did not open.
  it('opens nothing for a rename the consumer does not report done', async () => {
    vi.useFakeTimers();
    const nodes = [...folderNodes('other'), ...folderNodes()];
    const onFileRename = vi.fn(() => Promise.resolve());
    const { getByText, getAllByText, rerender } = render(
      <FileTree
        {...baseProps}
        nodes={nodes}
        selectedNode={undefined}
        onFileRename={onFileRename}
      />,
    );
    fireEvent.click(getByText('sub'));
    fireEvent.click(getByText('inner'));

    await renameThroughMenu(getByText, 'sub', 'other');
    rerender(
      <FileTree
        {...baseProps}
        nodes={nodes}
        selectedNode={undefined}
        onFileRename={onFileRename}
      />,
    );

    const row = (element: HTMLElement): Element | null =>
      element.closest('[role="treeitem"]');
    expect(row(getByText('other'))?.getAttribute('aria-expanded')).toBe(
      'false',
    );
    fireEvent.click(getByText('other'));
    const [otherInner] = getAllByText('inner');
    expect(row(otherInner)?.getAttribute('aria-expanded')).toBe('false');
    expect(getAllByText('deep.py')).toHaveLength(1);
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
});

describe('FileTree drop conflict check', () => {
  const dropNodes = (): TreeNode[] => [
    { name: 'python', path: 'python', type: 'folder', children: null },
    {
      name: 'notes.md',
      path: 'notes.md',
      type: 'file',
      extension: 'md',
      mimeType: 'text/markdown',
    },
  ];

  const dropOntoPython = async (
    props: Partial<React.ComponentProps<typeof FileTree>>,
  ): Promise<void> => {
    const ref = createRef<FileTreeApi>();
    render(
      <FileTree
        ref={ref}
        {...baseProps}
        {...props}
        nodes={dropNodes()}
        selectedNode={undefined}
      />,
    );

    const tree = ref.current!;
    const dragNode = { data: dropNodes()[1] } as NodeApi<TreeNode>;
    const parentNode = {
      id: 'python',
      isOpen: true,
      data: dropNodes()[0],
      open: (): void => undefined,
    } as unknown as NodeApi<TreeNode>;

    await act(async () => {
      tree.handleDrop({ dragNodes: [dragNode], parentNode, index: 0 });
    });
  };

  // The tree only holds the folders it has listed, so a name already taken
  // inside a collapsed one is invisible to it.
  it('asks the injected check, and moves when the name is free', async () => {
    const checkPathConflict = vi.fn(noConflict);
    const onFileMove = vi.fn(() => Promise.resolve());

    await dropOntoPython({ checkPathConflict, onFileMove });

    expect(checkPathConflict).toHaveBeenCalledWith('python/notes.md', 'file');
    expect(onFileMove).toHaveBeenCalledWith(
      'notes.md',
      'python/notes.md',
      'file',
    );
  });

  it('raises the conflict dialog instead of moving when the name is taken', async () => {
    const checkPathConflict = vi.fn(() =>
      Promise.resolve({
        hasDuplicate: true,
        conflictType: 'file-file' as const,
      }),
    );
    const onFileMove = vi.fn(() => Promise.resolve());
    const onDuplicateConflict = vi.fn();

    await dropOntoPython({
      checkPathConflict,
      onFileMove,
      onDuplicateConflict,
    });

    expect(onFileMove).not.toHaveBeenCalled();
    expect(onDuplicateConflict).toHaveBeenCalledWith(
      expect.objectContaining({
        sourcePath: 'notes.md',
        targetPath: 'python/notes.md',
        conflictType: 'file-file',
      }),
    );
  });

  it('aborts the move when the check fails', async () => {
    const checkPathConflict = vi.fn(() => Promise.reject(new Error('offline')));
    const onFileMove = vi.fn(() => Promise.resolve());
    const onDuplicateConflict = vi.fn();

    await dropOntoPython({
      checkPathConflict,
      onFileMove,
      onDuplicateConflict,
    });

    expect(onFileMove).not.toHaveBeenCalled();
    expect(onDuplicateConflict).not.toHaveBeenCalled();
  });
});

describe('FileTree context menu groups', () => {
  // Radix places the menu with `DOMRect.fromRect`, which jsdom does not define,
  // and it does so after the menu opens, so the stub stays for the block.
  beforeAll(() => {
    vi.stubGlobal('DOMRect', {
      fromRect: (rect: { x: number; y: number }) => ({
        ...rect,
        width: 0,
        height: 0,
        top: rect.y,
        bottom: rect.y,
        left: rect.x,
        right: rect.x,
      }),
    });
  });
  afterAll(() => {
    vi.unstubAllGlobals();
  });

  // The open menu as labels, with '|' for each separator.
  const openMenu = (menu: JSX.Element): string[] => {
    const { getByText, unmount } = render(
      <ContextMenu.Root>
        <ContextMenu.Trigger>
          <div>trigger</div>
        </ContextMenu.Trigger>
        {menu}
      </ContextMenu.Root>,
    );
    fireEvent.contextMenu(getByText('trigger'));
    const content = document.querySelector('[role="menu"]') as HTMLElement;
    const items = Array.from(content.children).map((child) =>
      child.getAttribute('role') === 'separator'
        ? '|'
        : (child.textContent as string),
    );
    unmount();
    return items;
  };

  const treeMenuProps = {
    onCreate: () => (): void => undefined,
    onAddBrick: vi.fn(),
    onCreateBrick: vi.fn(),
    onResourceImport: vi.fn(),
  };

  it('shows Add sketch library in its own group when it is offered', () => {
    expect(
      openMenu(
        <TreeContextMenu {...treeMenuProps} onAddSketchLibrary={vi.fn()} />,
      ),
    ).toEqual([
      'Create new file',
      'Create new folder',
      '|',
      'Import file',
      'Import folder',
      '|',
      'Add sketch library',
      '|',
      'Add Brick',
      'Create new Brick',
    ]);
  });

  it('shows Add sketch folder in place of Add sketch library', () => {
    expect(
      openMenu(<TreeContextMenu {...treeMenuProps} onAddSketch={vi.fn()} />),
    ).toEqual([
      'Create new file',
      'Create new folder',
      '|',
      'Import file',
      'Import folder',
      '|',
      'Add sketch folder',
      '|',
      'Add Brick',
      'Create new Brick',
    ]);
  });

  it('drops the empty sketch group and its separator', () => {
    expect(openMenu(<TreeContextMenu {...treeMenuProps} />)).toEqual([
      'Create new file',
      'Create new folder',
      '|',
      'Import file',
      'Import folder',
      '|',
      'Add Brick',
      'Create new Brick',
    ]);
  });

  const rowMenu = (node: TreeNode): string[] =>
    openMenu(
      <FileContextMenu
        node={node}
        onRename={vi.fn()}
        onCreate={() => (): void => undefined}
        onDelete={vi.fn()}
        onResourceImport={vi.fn()}
      />,
    );

  const folderNode = (path: string): TreeNode => ({
    name: path,
    path,
    type: 'folder',
    children: [],
  });

  it('separates the three groups of a folder row', () => {
    expect(rowMenu(folderNode('assets'))).toEqual([
      'Create new file',
      'Create new folder',
      '|',
      'Import file',
      'Import folder',
      '|',
      'Rename',
      'Delete',
    ]);
  });

  it('ends the python folder menu without a separator', () => {
    expect(rowMenu(folderNode('python'))).toEqual([
      'Create new file',
      'Create new folder',
      '|',
      'Import file',
      'Import folder',
    ]);
  });

  it('shows a file row only Rename and Delete, without a separator', () => {
    expect(
      rowMenu({
        name: 'notes.md',
        path: 'notes.md',
        type: 'file',
        extension: 'md',
        mimeType: 'text/markdown',
      }),
    ).toEqual(['Rename', 'Delete']);
  });
});
