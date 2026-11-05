/**
 * Unit tests for resolving a `textDocument/references` response into panel rows.
 *
 * The server answers with bare `{ uri, range }` pairs holding 0-based positions
 * and no text, so every visible part of a row — the line number, the excerpt,
 * and where the symbol falls inside it — is computed here. Four things are easy
 * to get wrong and invisible until someone reads the panel:
 *  - stripping indentation shifts the match offsets with it, so a nested
 *    reference would otherwise emphasise the wrong characters;
 *  - a range may span lines, and only the first is shown, so `matchEnd` has to
 *    be clamped to the excerpt rather than run past it;
 *  - locations in files the workspace never opened have no document to excerpt
 *    and must be dropped, not rendered as empty rows;
 *  - the row's `range` is what opening it selects, so it has to be resolved the
 *    same way its line number was, or the row shows one line and opens another.
 */

import { LSPPlugin, WorkspaceMapping } from '@codemirror/lsp-client';
import { Text } from '@codemirror/state';
import { describe, expect, it, vi } from 'vitest';

import { ViewInstances } from '../../../codeMirrorViewInstances';
import { CustomLspClient } from '../lsp-client/lsp-client-types';
import { toDocOffset } from '../lsp-positions';
import { LspLocation, LspRange } from '../lsp-types';
import { resolveLspReferencesResult } from './lsp-references';

const WORKSPACE_URI = 'file:///ws';
const MAIN_URI = `${WORKSPACE_URI}/main.py`;
const OTHER_URI = `${WORKSPACE_URI}/pkg/other.py`;

const range = (
  line: number,
  startChar: number,
  endChar: number,
  endLine = line,
): LspRange => ({
  start: { line, character: startChar },
  end: { line: endLine, character: endChar },
});

const location = (uri: string, at: LspRange): LspLocation => ({
  uri,
  range: at,
});

/**
 * A mapping that reads positions straight off the document, which is what the
 * real one does when nothing has been edited since the request went out.
 */
const makeMapping = (docs: Record<string, Text>): WorkspaceMapping =>
  ({
    mapPosition: (uri: string, pos: { line: number; character: number }) => {
      const doc = docs[uri];
      if (!doc) {
        throw new Error("Cannot map from a file that's not in the workspace");
      }
      const line = doc.line(pos.line + 1);
      return line.from + Math.min(pos.character, line.length);
    },
  } as unknown as WorkspaceMapping);

/**
 * A mapping standing in for the user having typed a line above the symbol while
 * the request was in flight: every position the server sent resolves one line
 * further down than it says.
 */
const makeShiftedMapping = (docs: Record<string, Text>): WorkspaceMapping =>
  ({
    mapPosition: (uri: string, pos: { line: number; character: number }) => {
      const line = docs[uri].line(pos.line + 2);
      return line.from + Math.min(pos.character, line.length);
    },
  } as unknown as WorkspaceMapping);

/**
 * A plugin whose workspace holds `docs` and nothing else — `requestFile`
 * answers null for anything absent, as the real base implementation does for a
 * file that was never opened.
 */
const makePlugin = (
  docs: Record<string, Text>,
): { plugin: LSPPlugin; client: CustomLspClient } => {
  const client = {
    workspace: {
      lspId: 'python',
      requestFile: vi.fn(async (uri: string) => {
        const doc = docs[uri];
        return doc ? { uri, doc, getView: () => null } : null;
      }),
    },
  } as unknown as CustomLspClient;
  return { plugin: { client, uri: MAIN_URI } as unknown as LSPPlugin, client };
};

const resolve = async (
  docs: Record<string, Text>,
  locations: LspLocation[],
  symbol = 'add',
): ReturnType<typeof resolveLspReferencesResult> => {
  const { plugin } = makePlugin(docs);
  return resolveLspReferencesResult({
    plugin,
    locations,
    mapping: makeMapping(docs),
    symbol,
    originViewInstanceId: ViewInstances.Editor,
  });
};

describe('resolveLspReferencesResult', () => {
  it('reports the line number 1-based, as the panel shows it', async () => {
    const docs = {
      [MAIN_URI]: Text.of(['import os', '', 'add(1, 2)']),
    };
    const result = await resolve(docs, [location(MAIN_URI, range(2, 0, 3))]);

    expect(result.groups[0].rows[0].lineNumber).toBe(3);
  });

  it('strips indentation and shifts the match offsets with it', async () => {
    const docs = {
      // `add` starts at character 12 of the raw line, 4 once indented.
      [MAIN_URI]: Text.of(['def f():', '        add(1, 2)']),
    };
    const result = await resolve(docs, [location(MAIN_URI, range(1, 8, 11))]);
    const row = result.groups[0].rows[0];

    expect(row.excerpt).toBe('add(1, 2)');
    expect(row.matchStart).toBe(0);
    expect(row.matchEnd).toBe(3);
    expect(row.excerpt.slice(row.matchStart, row.matchEnd)).toBe('add');
  });

  it('clamps a range that runs past the excerpt to the end of the line', async () => {
    const docs = {
      [MAIN_URI]: Text.of(['add(', '  1,', ')']),
    };
    // A range closing on a later line — only the first is shown.
    const result = await resolve(docs, [location(MAIN_URI, range(0, 0, 1, 2))]);
    const row = result.groups[0].rows[0];

    expect(row.excerpt).toBe('add(');
    expect(row.matchEnd).toBe(row.excerpt.length);
    expect(row.matchEnd).toBeGreaterThanOrEqual(row.matchStart);
  });

  it('groups references by file and counts them all', async () => {
    const docs = {
      [MAIN_URI]: Text.of(['add(1, 2)', 'add(3, 4)']),
      [OTHER_URI]: Text.of(['from main import add']),
    };
    const result = await resolve(docs, [
      location(MAIN_URI, range(0, 0, 3)),
      location(OTHER_URI, range(0, 17, 20)),
      location(MAIN_URI, range(1, 0, 3)),
    ]);

    expect(result.groups).toHaveLength(2);
    expect(result.groups[0].rows).toHaveLength(2);
    expect(result.groups[1].rows).toHaveLength(1);
    expect(result.totalCount).toBe(3);
  });

  it('names a group by its basename', async () => {
    const docs = { [OTHER_URI]: Text.of(['add(1, 2)']) };
    const result = await resolve(docs, [location(OTHER_URI, range(0, 0, 3))]);

    expect(result.groups[0].fileName).toBe('other.py');
  });

  it('orders rows within a file by line even when the server does not', async () => {
    const docs = {
      [MAIN_URI]: Text.of(['add(1, 2)', 'x = 1', 'add(3, 4)']),
    };
    const result = await resolve(docs, [
      location(MAIN_URI, range(2, 0, 3)),
      location(MAIN_URI, range(0, 0, 3)),
    ]);

    expect(result.groups[0].rows.map((row) => row.lineNumber)).toEqual([1, 3]);
  });

  it('drops locations in files the workspace never opened', async () => {
    const docs = { [MAIN_URI]: Text.of(['add(1, 2)']) };
    const result = await resolve(docs, [
      location(MAIN_URI, range(0, 0, 3)),
      location('file:///usr/include/stdio.h', range(9, 4, 7)),
    ]);

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].fileUri).toBe(MAIN_URI);
    expect(result.totalCount).toBe(1);
  });

  it('resolves to nothing when every location is outside the workspace', async () => {
    const result = await resolve({}, [
      location('file:///usr/include/stdio.h', range(9, 4, 7)),
    ]);

    // What `lspFindAllReferences` turns into the "no references found" tooltip
    // rather than opening an empty panel.
    expect(result.totalCount).toBe(0);
    expect(result.groups).toEqual([]);
  });

  it('looks each file up once however many references it holds', async () => {
    const docs = { [MAIN_URI]: Text.of(['add(1, 2)', 'add(3, 4)']) };
    const { plugin, client } = makePlugin(docs);

    await resolveLspReferencesResult({
      plugin,
      locations: [
        location(MAIN_URI, range(0, 0, 3)),
        location(MAIN_URI, range(1, 0, 3)),
      ],
      mapping: makeMapping(docs),
      symbol: 'add',
      originViewInstanceId: ViewInstances.Editor,
    });

    expect(client.workspace.requestFile).toHaveBeenCalledTimes(1);
  });

  it('falls back to reading the document when the mapping has no snapshot', async () => {
    const docs = { [MAIN_URI]: Text.of(['  add(1, 2)']) };
    const { plugin } = makePlugin(docs);

    // A file tracked after the mapping was created — `requestFile` tracks a
    // file nobody opened from disk while the result resolves.
    const result = await resolveLspReferencesResult({
      plugin,
      locations: [location(MAIN_URI, range(0, 2, 5))],
      mapping: makeMapping({}),
      symbol: 'add',
      originViewInstanceId: ViewInstances.Editor,
    });
    const row = result.groups[0].rows[0];

    expect(row.excerpt).toBe('add(1, 2)');
    expect(row.excerpt.slice(row.matchStart, row.matchEnd)).toBe('add');
  });

  /**
   * The row's line number comes from the mapped position, so its range has to
   * as well — `lspGoToReference` reads it back with `toDocOffset`, and the two
   * disagreeing is a row that says line 2 and jumps to line 1.
   */
  it('opens at the line it displays, not at the one the server sent', async () => {
    const docs = { [MAIN_URI]: Text.of(['inserted = 1', 'add(1, 2)']) };
    const { plugin } = makePlugin(docs);

    const result = await resolveLspReferencesResult({
      plugin,
      locations: [location(MAIN_URI, range(0, 0, 3))],
      mapping: makeShiftedMapping(docs),
      symbol: 'add',
      originViewInstanceId: ViewInstances.Editor,
    });
    const row = result.groups[0].rows[0];
    const doc = docs[MAIN_URI];

    expect(row.lineNumber).toBe(2);
    expect(row.range.start.line).toBe(row.lineNumber - 1);
    expect(
      doc.sliceString(
        toDocOffset(doc, row.range.start),
        toDocOffset(doc, row.range.end),
      ),
    ).toBe('add');
  });

  /**
   * `matchStart` is an offset into the trimmed excerpt; `range` is not, and
   * measuring it from the same trimmed text would open the row short of the
   * symbol by however deeply it is nested.
   */
  it('keeps the range in document columns though the excerpt is trimmed', async () => {
    const docs = { [MAIN_URI]: Text.of(['    add(1, 2)']) };
    const result = await resolve(docs, [location(MAIN_URI, range(0, 4, 7))]);
    const row = result.groups[0].rows[0];
    const doc = docs[MAIN_URI];

    expect(row.matchStart).toBe(0);
    expect(row.range.start.character).toBe(4);
    expect(
      doc.sliceString(
        toDocOffset(doc, row.range.start),
        toDocOffset(doc, row.range.end),
      ),
    ).toBe('add');
  });

  it('gives each row an id unique within the result', async () => {
    const docs = {
      [MAIN_URI]: Text.of(['add(add(1), 2)']),
      [OTHER_URI]: Text.of(['add(1, 2)']),
    };
    const result = await resolve(docs, [
      location(MAIN_URI, range(0, 0, 3)),
      location(MAIN_URI, range(0, 4, 7)),
      location(OTHER_URI, range(0, 0, 3)),
    ]);

    const ids = result.groups.flatMap((group) =>
      group.rows.map((row) => row.id),
    );
    expect(new Set(ids).size).toBe(ids.length);
  });
});
