/**
 * Tests App Lab's content contributions (brick detail, markdown preview)
 * through the shared EditorPanel, exactly as AppLabEditorPanel wires them:
 * `contentRenderers={appLabContentRenderers}` + `paneExtras` packed by the
 * App Lab logic layer. These assertions preserve the pre-ADR-0002 dispatch
 * behavior, when brick/markdown were hard-coded inside EditorPanel.
 */

import { CodeEditorLogic } from '@cloud-editor-mono/ide-workbench/lib/code-editor';
import {
  EditorPanel,
  EditorPanelFile,
  EditorPanelLogic,
} from '@cloud-editor-mono/ide-workbench/lib/editor-panel';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { BrickDetailLogic, BrickDetailTabId } from '../brick-detail';
import {
  appLabContentRenderers,
  AppLabPaneExtras,
} from './appLabContentRenderers';

vi.mock('@cloud-editor-mono/ide-workbench/lib/code-editor', () => ({
  CodeEditor: ({ viewInstanceId }: { viewInstanceId: string }) => (
    <div data-testid="code-editor" data-view-instance={viewInstanceId} />
  ),
}));

vi.mock(
  '@cloud-editor-mono/ide-workbench/lib/code-mirror/codeMirrorViewInstances',
  () => ({
    ViewInstances: { Editor: 'editor', Editor2: 'editor2' },
    linkSplitEditors: vi.fn(),
    unlinkSplitEditors: vi.fn(),
  }),
);

vi.mock('../brick-detail/BrickDetail', () => ({
  default: ({
    brickId,
    selectedTab,
  }: {
    brickId: string;
    selectedTab?: string;
  }) => (
    <div
      data-testid="brick-detail"
      data-brick-id={brickId}
      data-selected-tab={selectedTab}
    />
  ),
}));

vi.mock('../markdown-reader/MarkdownReader', () => ({
  default: ({ content }: { content?: string }) => (
    <div data-testid="markdown-reader">{content}</div>
  ),
}));

vi.mock(
  '@cloud-editor-mono/ide-workbench/lib/editor-tabs-bar',
  async (importOriginal) => {
    const actual = await importOriginal<
      typeof import('@cloud-editor-mono/ide-workbench/lib/editor-tabs-bar')
    >();
    return {
      ...actual,
      EditorTabsBar: ({ panelId }: { panelId?: string }) => (
        <div data-testid={`tabs-bar-${panelId ?? 'top'}`} />
      ),
    };
  },
);

vi.mock(
  '@cloud-editor-mono/ide-workbench/lib/editor-toolbar/EditorToolbar',
  () => ({
    default: ({ isRendered }: { isRendered: boolean }) => (
      <div data-testid="editor-toolbar" data-rendered={String(isRendered)} />
    ),
  }),
);

vi.mock(
  '@cloud-editor-mono/ide-workbench/lib/editor-controls/EditorControls',
  () => ({
    default: () => <div data-testid="editor-controls" />,
  }),
);

vi.mock(
  '@cloud-editor-mono/ide-workbench/lib/editor-status',
  async (importOriginal) => {
    const actual = await importOriginal<
      typeof import('@cloud-editor-mono/ide-workbench/lib/editor-status')
    >();
    return {
      ...actual,
      EditorStatus: ({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
      ),
    };
  },
);

vi.mock('../../../essential/wrapper-title', () => ({
  WrapperTitle: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock(
  '@cloud-editor-mono/ide-workbench/lib/editor-panel/EditorSplitDropZone',
  () => ({
    default: () => null,
  }),
);

// Any icon resolves to a null-rendering stub component.
vi.mock(
  '@cloud-editor-mono/images/assets/icons',
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
  Group: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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
const stubBrickDetailLogic = (() => ({})) as unknown as BrickDetailLogic;

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
): ReturnType<typeof render> =>
  render(
    <EditorPanel
      editorPanelLogic={makeLogic(overrides)}
      getKeywords={(): undefined => undefined}
      contentRenderers={appLabContentRenderers}
    />,
  );

const brickExtras = (selectedTab?: BrickDetailTabId): AppLabPaneExtras => ({
  brickDetailLogic: stubBrickDetailLogic,
  brickSelectedTab: selectedTab,
});

describe('appLabContentRenderers through EditorPanel', () => {
  it('renders BrickDetail for a brick file when the pane extras carry brickDetailLogic', async () => {
    renderPanel({
      selectedFile: makeFile('my-brick', 'brick'),
      paneExtras: { A: brickExtras('examples') },
    });

    const brick = await screen.findByTestId('brick-detail');
    expect(brick.dataset.brickId).toBe('my-brick');
    expect(brick.dataset.selectedTab).toBe('examples');
    expect(screen.queryByTestId('code-editor')).toBeNull();
  });

  it('falls back to the CodeEditor for a brick file without brickDetailLogic', () => {
    renderPanel({ selectedFile: makeFile('my-brick', 'brick') });

    expect(screen.queryByTestId('brick-detail')).toBeNull();
    expect(screen.getAllByTestId('code-editor')).toHaveLength(1);
  });

  it('renders MarkdownReader for a markdown file in preview mode', async () => {
    renderPanel({
      selectedFile: makeFile('readme', 'md', '# hello'),
      shouldRenderMarkdown: true,
      markdownCanBeRendered: true,
    });

    expect((await screen.findByTestId('markdown-reader')).textContent).toBe(
      '# hello',
    );
    expect(screen.queryByTestId('code-editor')).toBeNull();
    expect(screen.getByTestId('editor-toolbar').dataset.rendered).toBe('true');
  });

  it('renders the CodeEditor for a markdown file in write mode', () => {
    renderPanel({
      selectedFile: makeFile('readme', 'md'),
      shouldRenderMarkdown: false,
      markdownCanBeRendered: true,
    });

    expect(screen.queryByTestId('markdown-reader')).toBeNull();
    expect(screen.getAllByTestId('code-editor')).toHaveLength(1);
  });

  it('renders pane B brick with its own extras (independent sub-tab per pane)', async () => {
    renderPanel({
      isSplit: true,
      splitPanelCodeEditorLogic: stubCodeEditorLogic,
      splitPanelTabsBarLogic: stubTabsBarLogic,
      selectedFile: makeFile('my-brick', 'brick'),
      splitPanelFileId: 'my-brick',
      splitPanelFile: makeFile('my-brick', 'brick'),
      paneExtras: { A: brickExtras('overview'), B: brickExtras('aiModels') },
    });

    const bricks = await screen.findAllByTestId('brick-detail');
    expect(bricks.map((el) => el.dataset.selectedTab)).toEqual([
      'overview',
      'aiModels',
    ]);
  });

  it('renders pane B markdown preview independently of pane A', async () => {
    renderPanel({
      isSplit: true,
      splitPanelCodeEditorLogic: stubCodeEditorLogic,
      splitPanelTabsBarLogic: stubTabsBarLogic,
      selectedFile: makeFile('readme', 'md', '# left'),
      shouldRenderMarkdown: false,
      splitPanelFileId: 'readme',
      splitPanelFile: makeFile('readme', 'md', '# right'),
      splitPanelShouldRenderMarkdown: true,
    });

    expect((await screen.findByTestId('markdown-reader')).textContent).toBe(
      '# right',
    );
    expect(
      screen.getAllByTestId('code-editor').map((el) => el.dataset.viewInstance),
    ).toEqual(['editor']);
  });
});
