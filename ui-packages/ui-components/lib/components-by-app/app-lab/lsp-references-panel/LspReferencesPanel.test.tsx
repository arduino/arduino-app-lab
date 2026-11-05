/**
 * Tests for the docked references panel.
 *
 * The panel is presentational — the result, the close and the row-open all
 * arrive as props — so every test renders it with a seeded result and asserts on
 * what rendered or which prop was called. Two behaviours are worth pinning
 * beyond "it renders": clicking a row has to ask the host to open it (which is
 * what routes it to the active editor panel), and the keyboard has to move across
 * group boundaries, since rows are grouped but Arrow keys are not.
 *
 * Assertions read the English `defaultMessage`. An IntlProvider is wrapped even
 * with no messages of its own: `useI18n`'s provider-less fallback returns
 * `defaultMessage` *without* interpolating values, which would leave the
 * accessible names reading literally "References to {symbol}".
 */

import {
  ViewInstances,
  viewInstances,
} from '@cloud-editor-mono/ide-workbench/lib/code-mirror/codeMirrorViewInstances';
import {
  LspReferenceRow,
  LspReferencesResult,
} from '@cloud-editor-mono/ide-workbench/lib/code-mirror/extensions/lsp/lsp-references/lsp-references-types';
import { EditorView } from '@codemirror/view';
import {
  fireEvent,
  render,
  RenderResult,
  screen,
} from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { afterEach, beforeAll, describe, expect, it, Mock, vi } from 'vitest';

import { LspReferencesPanel } from './LspReferencesPanel';

const MAIN_URI = 'file:///ws/main.py';
const OTHER_URI = 'file:///ws/sketch.ino';

const row = (
  fileUri: string,
  lineNumber: number,
  excerpt: string,
  matchStart = 0,
  matchEnd = 3,
): LspReferenceRow => ({
  id: `${fileUri}:${lineNumber}:${matchStart}`,
  fileUri,
  lineNumber,
  excerpt,
  matchStart,
  matchEnd,
  range: {
    start: { line: lineNumber - 1, character: matchStart },
    end: { line: lineNumber - 1, character: matchEnd },
  },
});

const makeResult = (
  overrides: Partial<LspReferencesResult> = {},
): LspReferencesResult => ({
  symbol: 'add',
  totalCount: 3,
  lspId: 'python',
  originViewInstanceId: ViewInstances.Editor,
  groups: [
    {
      fileUri: OTHER_URI,
      fileName: 'sketch.ino',
      rows: [
        row(OTHER_URI, 1, 'import { add, multiply } from "./a";', 9, 12),
        row(OTHER_URI, 3, 'const result1 = add(2, 3);', 16, 19),
      ],
    },
    {
      fileUri: MAIN_URI,
      fileName: 'main.py',
      rows: [row(MAIN_URI, 5, 'export function add(a, b)', 16, 19)],
    },
  ],
  ...overrides,
});

type Props = {
  result: LspReferencesResult;
  onClose: Mock<() => void>;
  onOpenRow: Mock<(row: LspReferenceRow) => void>;
};

const renderPanel = (
  overrides: Partial<Pick<Props, 'result'>> = {},
): { props: Props; rendered: RenderResult } => {
  const props: Props = {
    result: makeResult(),
    onClose: vi.fn(),
    onOpenRow: vi.fn(),
    ...overrides,
  };
  return {
    props,
    rendered: render(
      <IntlProvider locale="en">
        <LspReferencesPanel {...props} />
      </IntlProvider>,
    ),
  };
};

/** Elements `scrollIntoView` was called on, most recent last. */
const scrolledInto: Element[] = [];

beforeAll(() => {
  // jsdom implements no scrolling; every engine the app ships on has this.
  Element.prototype.scrollIntoView = vi.fn(function (this: Element): void {
    scrolledInto.push(this);
  });
});

/** A stand-in for an editor panel: only `focus` is consulted. */
type FakePanel = EditorView & { focus: Mock<() => void> };

const fakePanel = (): FakePanel => ({ focus: vi.fn() } as unknown as FakePanel);

const setPanels = (
  panelA: EditorView | null,
  panelB: EditorView | null,
): void => {
  viewInstances[ViewInstances.Editor].instance = panelA;
  viewInstances[ViewInstances.Editor2].instance = panelB;
};

afterEach(() => {
  setPanels(null, null);
  scrolledInto.length = 0;
});

describe('LspReferencesPanel', () => {
  it('groups rows under their file name', () => {
    renderPanel();

    expect(screen.getByText('References found:')).toBeInTheDocument();
    expect(screen.getByText('sketch.ino')).toBeInTheDocument();
    expect(screen.getByText('main.py')).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('shows each reference with its line number and emphasises the symbol', () => {
    renderPanel();

    expect(screen.getByText('1:')).toBeInTheDocument();
    expect(screen.getByText('5:')).toBeInTheDocument();
    // One <strong> per row, each holding the matched symbol.
    const emphasised = screen
      .getAllByRole('option')
      .map((option) => option.querySelector('strong')?.textContent);
    expect(emphasised).toEqual(['add', 'add', 'add']);
  });

  it('selects the first row so Enter opens it without an Arrow press first', () => {
    renderPanel();

    expect(screen.getAllByRole('option')[0]).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('asks the host to open a clicked row, which routes it to the active panel', () => {
    const { props } = renderPanel();

    fireEvent.click(screen.getAllByRole('option')[2]);

    expect(props.onOpenRow).toHaveBeenCalledWith(
      expect.objectContaining({ fileUri: MAIN_URI, lineNumber: 5 }),
    );
  });

  it('moves the selection across a group boundary with the arrow keys', () => {
    renderPanel();
    const list = screen.getByRole('listbox');

    // Two rows in the first group, so the third Down lands in the second.
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    fireEvent.keyDown(list, { key: 'ArrowDown' });

    expect(screen.getAllByRole('option')[2]).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  /**
   * Guards the row lookup itself. Nothing else fails if it stops finding the
   * selected row — the list still renders, the selection still moves, and only
   * a reference scrolled out of sight stays out of sight.
   */
  it('scrolls the row it just selected into view', () => {
    renderPanel();
    scrolledInto.length = 0;

    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'ArrowDown' });

    expect(scrolledInto).toContain(
      screen.getByRole('option', { selected: true }),
    );
  });

  it('stops at the ends of the list rather than wrapping', () => {
    renderPanel();
    const list = screen.getByRole('listbox');

    fireEvent.keyDown(list, { key: 'ArrowUp' });
    expect(screen.getAllByRole('option')[0]).toHaveAttribute(
      'aria-selected',
      'true',
    );

    fireEvent.keyDown(list, { key: 'End' });
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[2]).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('opens the selected row on Enter', () => {
    const { props } = renderPanel();
    const list = screen.getByRole('listbox');

    fireEvent.keyDown(list, { key: 'End' });
    fireEvent.keyDown(list, { key: 'Enter' });

    expect(props.onOpenRow).toHaveBeenCalledWith(
      expect.objectContaining({ fileUri: MAIN_URI }),
    );
  });

  it('closes on Escape', () => {
    const { props } = renderPanel();

    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });

    expect(props.onClose).toHaveBeenCalled();
  });

  it('closes from the header button', () => {
    const { props } = renderPanel();

    fireEvent.click(
      screen.getByRole('button', { name: 'Close references panel' }),
    );

    expect(props.onClose).toHaveBeenCalled();
  });

  it('names the list after the symbol searched for', () => {
    renderPanel();

    expect(screen.getByRole('listbox')).toHaveAccessibleName(
      'References to add',
    );
  });

  it('falls back to a generic name when the symbol is not known', () => {
    renderPanel({ result: makeResult({ symbol: '' }) });

    expect(screen.getByRole('listbox')).toHaveAccessibleName('References');
  });
});

/**
 * Nothing else can reach the list: it sits before the editor in tab order, and
 * Tab inside CodeMirror indents rather than moving on. Without the panel taking
 * focus, its whole keyboard model is only reachable by clicking the list's
 * empty background first.
 */
describe('LspReferencesPanel focus', () => {
  it('takes focus when a search opens it, so the arrow keys work', () => {
    renderPanel();

    expect(screen.getByRole('listbox')).toHaveFocus();
  });

  /**
   * And again for every search after it. The panel is not keyed, so a second
   * search reuses the mounted instance — focusing on mount alone would leave
   * the first search behaving differently from the rest, swapping the list out
   * under a user whose focus is still in the code.
   */
  it('takes focus again for a second search into the open panel', () => {
    const { props, rendered } = renderPanel();
    expect(screen.getByRole('listbox')).toHaveFocus();

    // The user clicked back into the editor before searching again.
    (document.activeElement as HTMLElement | null)?.blur();
    expect(screen.getByRole('listbox')).not.toHaveFocus();

    rendered.rerender(
      <IntlProvider locale="en">
        <LspReferencesPanel {...props} result={makeResult({ symbol: 'sub' })} />
      </IntlProvider>,
    );

    expect(screen.getByRole('listbox')).toHaveFocus();
  });

  /**
   * The regression: focus went to panel A unconditionally, so closing a search
   * run from the right-hand panel of a split moved the caret to the left one.
   * The origin is carried on the result rather than read off the DOM, because
   * a search started from the context menu leaves neither panel focused — the
   * menu holds focus and restores it to the trigger wrapper, not the
   * `contentDOM` that `EditorView.hasFocus` tests.
   */
  it('hands focus back to the panel the search was run from', () => {
    const panelA = fakePanel();
    const panelB = fakePanel();
    setPanels(panelA, panelB);
    const { props } = renderPanel({
      result: makeResult({ originViewInstanceId: ViewInstances.Editor2 }),
    });

    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });

    expect(props.onClose).toHaveBeenCalled();
    expect(panelB.focus).toHaveBeenCalled();
    expect(panelA.focus).not.toHaveBeenCalled();
  });

  it('does so from the header button too, not only from Escape', () => {
    const panelA = fakePanel();
    const panelB = fakePanel();
    setPanels(panelA, panelB);
    renderPanel({
      result: makeResult({ originViewInstanceId: ViewInstances.Editor2 }),
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Close references panel' }),
    );

    expect(panelB.focus).toHaveBeenCalled();
    expect(panelA.focus).not.toHaveBeenCalled();
  });

  it('focuses the panel the search was run from even when nothing has focus', () => {
    const panelA = fakePanel();
    setPanels(panelA, null);
    renderPanel();

    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });

    expect(panelA.focus).toHaveBeenCalled();
  });
});
