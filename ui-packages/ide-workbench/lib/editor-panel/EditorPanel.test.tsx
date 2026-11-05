/**
 * Regression tests for EditorPanel's pane content dispatch.
 *
 * Locks in the behavior of the pre-renderer-refactor inline dispatch so the
 * PaneContentRenderer seam (ADR-0002) stays behavior-identical:
 *  - which component fills a pane per file type, in both panes
 *  - fallback to CodeEditor (Editor in pane A, Editor2 in pane B)
 *  - app-provided `contentRenderers` win over the defaults
 *  - per-pane context mapping (extras, markdown preview state)
 *  - the CodeMirror split-link only engages when both panes show the
 *    CodeEditor for the same file
 *
 * App Lab's brick/markdown renderers are covered separately in
 * components-by-app/app-lab/editor-panel/appLabContentRenderers.test.tsx.
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CodeEditorLogic } from '../code-editor';
import {
  linkSplitEditors,
  unlinkSplitEditors,
} from '../code-mirror/codeMirrorViewInstances';
import { EditorComponents, EditorIconButtonProps } from '../editor-components';
import EditorPanel from './EditorPanel';
import { EditorPanelFile, EditorPanelLogic } from './editorPanel.type';
import { PaneContentRenderer } from './paneContentRenderer';

vi.mock('../code-editor', () => ({
  CodeEditor: ({ viewInstanceId }: { viewInstanceId: string }) => (
    <div data-testid="code-editor" data-view-instance={viewInstanceId} />
  ),
}));

vi.mock('../code-mirror/codeMirrorViewInstances', () => ({
  ViewInstances: { Editor: 'editor', Editor2: 'editor2' },
  linkSplitEditors: vi.fn(),
  unlinkSplitEditors: vi.fn(),
}));

vi.mock('../editor-image/EditorImage', () => ({
  default: ({ extension }: { extension: string }) => (
    <div data-testid="editor-image" data-extension={extension} />
  ),
}));

// The stub renders one IconButton from the injected components, so the tests
// can see which implementation reached each tabs bar.
vi.mock('../editor-tabs-bar', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../editor-tabs-bar')>();
  const { useEditorComponents } = await import('../editor-components');
  return {
    ...actual,
    EditorTabsBar: ({ panelId }: { panelId?: string }) => {
      const { IconButton } = useEditorComponents();
      return (
        <div data-testid={`tabs-bar-${panelId ?? 'top'}`}>
          <IconButton label={`toggle-${panelId ?? 'top'}`} Icon={() => null} />
        </div>
      );
    },
  };
});

vi.mock('../editor-toolbar/EditorToolbar', () => ({
  default: ({ isRendered }: { isRendered: boolean }) => (
    <div data-testid="editor-toolbar" data-rendered={String(isRendered)} />
  ),
}));

vi.mock('../editor-controls/EditorControls', () => ({
  default: () => <div data-testid="editor-controls" />,
}));

vi.mock('../editor-status', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../editor-status')>();
  return {
    ...actual,
    EditorStatus: ({
      children,
      className,
    }: {
      children: React.ReactNode;
      className?: string;
    }) => <div className={className}>{children}</div>,
  };
});

vi.mock('../essential/wrapper-title', () => ({
  WrapperTitle: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock('./EditorSplitDropZone', () => ({
  default: () => null,
}));

// Any icon resolves to a null-rendering stub component.
vi.mock(
  '../assets/icons',
  () =>
    new Proxy(
      {},
      {
        get: (_target, name) =>
          name === 'then' ? undefined : (): null => null,
        has: () => true,
      },
    ),
);

vi.mock('react-resizable-panels', () => ({
  Group: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="panel-group">{children}</div>
  ),
  Panel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Separator: () => null,
}));

const makeFile = (
  id: string,
  ext: string,
  data = `content of ${id}`,
): EditorPanelFile => ({ id, ext, getData: () => data });

const stubCodeEditorLogic = (() => ({})) as unknown as CodeEditorLogic;
const stubTabsBarLogic =
  (() => ({})) as unknown as ReturnType<EditorPanelLogic>['tabsBarLogic'];

type LogicResult = ReturnType<EditorPanelLogic>;

const makeLogic = (overrides: Partial<LogicResult> = {}): EditorPanelLogic => {
  const result = {
    codeEditorLogic: stubCodeEditorLogic,
    tabsBarLogic: stubTabsBarLogic,
    isFullscreen: false,
    codeIsFormatting: false,
    hideControls: true,
    editorControlsHandlers: undefined,
    ...overrides,
  } as LogicResult;
  return () => result;
};

const renderPanel = (
  overrides: Partial<LogicResult> = {},
  contentRenderers?: PaneContentRenderer[],
  workspaceRenderers?: PaneContentRenderer[],
  components?: Partial<EditorComponents>,
): ReturnType<typeof render> =>
  render(
    <EditorPanel
      editorPanelLogic={makeLogic(overrides)}
      getKeywords={(): undefined => undefined}
      contentRenderers={contentRenderers}
      workspaceRenderers={workspaceRenderers}
      components={components}
    />,
  );

const paneACodeEditor = (): HTMLElement[] =>
  screen
    .queryAllByTestId('code-editor')
    .filter((el) => el.dataset.viewInstance === 'editor');
const paneBCodeEditor = (): HTMLElement[] =>
  screen
    .queryAllByTestId('code-editor')
    .filter((el) => el.dataset.viewInstance === 'editor2');

beforeEach(() => {
  vi.mocked(linkSplitEditors).mockClear();
  vi.mocked(unlinkSplitEditors).mockClear();
});

describe('EditorPanel pane A content dispatch', () => {
  it('renders the CodeEditor (Editor instance) for a code file', () => {
    renderPanel({ selectedFile: makeFile('sketch', 'ino') });

    expect(paneACodeEditor()).toHaveLength(1);
    expect(screen.queryByTestId('editor-image')).toBeNull();
  });

  it('renders EditorImage for a supported image extension', () => {
    renderPanel({ selectedFile: makeFile('logo', 'png') });

    expect(screen.getByTestId('editor-image').dataset.extension).toBe('png');
    expect(screen.queryByTestId('code-editor')).toBeNull();
  });

  it('maps svg to the svg+xml media extension', () => {
    renderPanel({ selectedFile: makeFile('icon', 'svg') });

    expect(screen.getByTestId('editor-image').dataset.extension).toBe(
      'svg+xml',
    );
  });

  it('shows the markdown toolbar but falls back to the CodeEditor without an injected markdown renderer', () => {
    renderPanel({
      selectedFile: makeFile('readme', 'md'),
      shouldRenderMarkdown: true,
      markdownCanBeRendered: true,
    });

    expect(screen.getByTestId('editor-toolbar').dataset.rendered).toBe('true');
    expect(paneACodeEditor()).toHaveLength(1);
  });

  it('lets a workspace renderer replace the split layout and show the top tabs bar', () => {
    const secretsProbe: PaneContentRenderer = {
      id: 'secrets-probe',
      match: ({ file, extras }) => file.ext === 'secrets' && !!extras,
      render: () => <div data-testid="secrets-workspace" />,
    };
    renderPanel(
      {
        selectedFile: makeFile('secrets', 'secrets'),
        paneExtras: { A: { anything: true } },
      },
      undefined,
      [secretsProbe],
    );

    expect(screen.getByTestId('secrets-workspace')).toBeInTheDocument();
    expect(screen.getByTestId('tabs-bar-top')).toBeInTheDocument();
    expect(screen.queryByTestId('panel-group')).toBeNull();
    expect(screen.queryByTestId('code-editor')).toBeNull();
  });

  it('falls through to the pane pipeline when no workspace renderer matches', () => {
    renderPanel({ selectedFile: makeFile('secrets', 'secrets') });

    expect(screen.queryByTestId('tabs-bar-top')).toBeNull();
    expect(screen.getByTestId('panel-group')).toBeInTheDocument();
    expect(paneACodeEditor()).toHaveLength(1);
  });
});

describe('EditorPanel contentRenderers extension seam', () => {
  const csvRenderer: PaneContentRenderer = {
    id: 'csv-table',
    match: ({ file }) => file.ext === 'csv',
    render: ({ file }) => <div data-testid="csv-table">{file.getData()}</div>,
  };

  it('renders an app-provided renderer for a file type unknown to the defaults', () => {
    renderPanel({ selectedFile: makeFile('data', 'csv', 'a,b') }, [
      csvRenderer,
    ]);

    expect(screen.getByTestId('csv-table').textContent).toBe('a,b');
    expect(screen.queryByTestId('code-editor')).toBeNull();
  });

  it('lets an app-provided renderer take precedence over a default renderer', () => {
    const pngOverride: PaneContentRenderer = {
      id: 'png-override',
      match: ({ file }) => file.ext === 'png',
      render: () => <div data-testid="png-override" />,
    };
    renderPanel({ selectedFile: makeFile('logo', 'png') }, [pngOverride]);

    expect(screen.getByTestId('png-override')).toBeInTheDocument();
    expect(screen.queryByTestId('editor-image')).toBeNull();
  });

  it('still falls back to the CodeEditor when no renderer matches', () => {
    renderPanel({ selectedFile: makeFile('main', 'py') }, [csvRenderer]);

    expect(paneACodeEditor()).toHaveLength(1);
  });

  it('forwards the pane-scoped app extras to renderers', () => {
    const extrasProbe: PaneContentRenderer = {
      id: 'extras-probe',
      match: ({ file }) => file.ext === 'probe',
      render: ({ paneId, extras }) => (
        <div data-testid={`probe-${paneId}`}>{String(extras)}</div>
      ),
    };
    renderPanel(
      {
        selectedFile: makeFile('x', 'probe'),
        isSplit: true,
        splitPanelCodeEditorLogic: stubCodeEditorLogic,
        splitPanelTabsBarLogic: stubTabsBarLogic,
        splitPanelFileId: 'y',
        splitPanelFile: makeFile('y', 'probe'),
        paneExtras: { A: 'extras-for-A', B: 'extras-for-B' },
      },
      [extrasProbe],
    );

    expect(screen.getByTestId('probe-A').textContent).toBe('extras-for-A');
    expect(screen.getByTestId('probe-B').textContent).toBe('extras-for-B');
  });
});

describe('EditorPanel components injection', () => {
  const HostIconButton: React.FC<EditorIconButtonProps> = ({
    label,
  }: EditorIconButtonProps) => (
    <span data-testid="host-icon-button">{label}</span>
  );
  const splitLogic: Partial<LogicResult> = {
    selectedFile: makeFile('a', 'ino'),
    isSplit: true,
    splitPanelCodeEditorLogic: stubCodeEditorLogic,
    splitPanelTabsBarLogic: stubTabsBarLogic,
    splitPanelFileId: 'b',
    splitPanelFile: makeFile('b', 'ino'),
  };

  it('gives the injected IconButton to the tabs bar of each pane', () => {
    renderPanel(splitLogic, undefined, undefined, {
      IconButton: HostIconButton,
    });

    const injected = screen.getAllByTestId('host-icon-button');
    expect(injected.map((el) => el.textContent)).toEqual([
      'toggle-A',
      'toggle-B',
    ]);
  });

  it("uses the package's IconButton when nothing is injected", () => {
    renderPanel(splitLogic);

    expect(screen.queryByTestId('host-icon-button')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'toggle-A' }),
    ).toBeInTheDocument();
  });
});

describe('EditorPanel split view content routing', () => {
  const splitBase: Partial<LogicResult> = {
    isSplit: true,
    splitPanelCodeEditorLogic: stubCodeEditorLogic,
    splitPanelTabsBarLogic: stubTabsBarLogic,
  };

  const previewRenderer: PaneContentRenderer = {
    id: 'md-preview',
    match: ({ file, shouldRenderMarkdown }) =>
      file.ext === 'md' && !!shouldRenderMarkdown,
    render: ({ file }) => <div data-testid="md-preview">{file.getData()}</div>,
  };

  it('renders an independent CodeEditor (Editor2) and tabs bar in pane B', () => {
    renderPanel({
      ...splitBase,
      selectedFile: makeFile('a', 'ino'),
      splitPanelFileId: 'b',
      splitPanelFile: makeFile('b', 'ino'),
    });

    expect(paneACodeEditor()).toHaveLength(1);
    expect(paneBCodeEditor()).toHaveLength(1);
    expect(screen.getByTestId('tabs-bar-A')).toBeInTheDocument();
    expect(screen.getByTestId('tabs-bar-B')).toBeInTheDocument();
  });

  it('maps splitPanelShouldRenderMarkdown to pane B independently of pane A', () => {
    renderPanel(
      {
        ...splitBase,
        selectedFile: makeFile('readme', 'md', '# left'),
        shouldRenderMarkdown: false,
        splitPanelFileId: 'readme',
        splitPanelFile: makeFile('readme', 'md', '# right'),
        splitPanelShouldRenderMarkdown: true,
      },
      [previewRenderer],
    );

    expect(paneACodeEditor()).toHaveLength(1);
    expect(paneBCodeEditor()).toHaveLength(0);
    expect(screen.getByTestId('md-preview').textContent).toBe('# right');
  });
});

describe('CodeMirror split-link management', () => {
  const previewRenderer: PaneContentRenderer = {
    id: 'md-preview',
    match: ({ file, shouldRenderMarkdown }) =>
      file.ext === 'md' && !!shouldRenderMarkdown,
    render: () => <div data-testid="md-preview" />,
  };

  it('links the editors when both panes show the CodeEditor for the same file', () => {
    renderPanel({
      isSplit: true,
      splitPanelCodeEditorLogic: stubCodeEditorLogic,
      splitPanelTabsBarLogic: stubTabsBarLogic,
      selectedFile: makeFile('same', 'ino'),
      splitPanelFileId: 'same',
      splitPanelFile: makeFile('same', 'ino'),
    });

    expect(linkSplitEditors).toHaveBeenCalledWith('editor');
  });

  it('does not link when the panes show different files', () => {
    renderPanel({
      isSplit: true,
      splitPanelCodeEditorLogic: stubCodeEditorLogic,
      splitPanelTabsBarLogic: stubTabsBarLogic,
      selectedFile: makeFile('a', 'ino'),
      splitPanelFileId: 'b',
      splitPanelFile: makeFile('b', 'ino'),
    });

    expect(linkSplitEditors).not.toHaveBeenCalled();
    expect(unlinkSplitEditors).toHaveBeenCalled();
  });

  it('does not link when one pane shows the same file through a content renderer', () => {
    renderPanel(
      {
        isSplit: true,
        splitPanelCodeEditorLogic: stubCodeEditorLogic,
        splitPanelTabsBarLogic: stubTabsBarLogic,
        selectedFile: makeFile('readme', 'md'),
        splitPanelFileId: 'readme',
        splitPanelFile: makeFile('readme', 'md'),
        splitPanelShouldRenderMarkdown: true,
      },
      [previewRenderer],
    );

    expect(linkSplitEditors).not.toHaveBeenCalled();
    expect(unlinkSplitEditors).toHaveBeenCalled();
  });

  it('unlinks when not in split view', () => {
    renderPanel({ selectedFile: makeFile('a', 'ino') });

    expect(linkSplitEditors).not.toHaveBeenCalled();
    expect(unlinkSplitEditors).toHaveBeenCalled();
  });
});
