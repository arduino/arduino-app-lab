import { LSPPlugin, WorkspaceMapping } from '@codemirror/lsp-client';
import { Text } from '@codemirror/state';

import { ViewInstances } from '../../../codeMirrorViewInstances';
import { CustomLspClient } from '../lsp-client/lsp-client-types';
import { decodeFileUri, normalizeFileUri } from '../lsp-file-uri';
import { toDocOffset } from '../lsp-positions';
import { LspLocation, LspPosition, LspRange } from '../lsp-types';
import {
  LspReferenceFileGroup,
  LspReferenceRow,
  LspReferencesResult,
} from './lsp-references-types';

/**
 * Where an LSP position sits in `doc` right now.
 *
 * `mapPosition` carries the position through any edits made since the request
 * went out, which is what keeps a reference pointing at the right place when
 * the user typed while waiting. It throws for a file the mapping never
 * snapshotted, and that genuinely happens: `LspClientWorkspace.requestFile`
 * tracks a file nobody opened from disk while the result is resolved, after the
 * mapping was created. Fall back to reading the position straight off the
 * document in that case.
 */
const resolveOffset = ({
  mapping,
  uri,
  doc,
  pos,
  assoc,
}: {
  mapping: WorkspaceMapping;
  uri: string;
  doc: Text;
  pos: LspPosition;
  assoc: 1 | -1;
}): number => {
  try {
    const mapped = mapping.mapPosition(uri, pos, assoc);
    if (mapped !== null) {
      return mapped;
    }
  } catch {
    // Not in the mapping's snapshot — see above.
  }
  return toDocOffset(doc, pos);
};

export const fileNameFromUri = (uri: string): string => {
  const decoded = decodeFileUri(uri);
  return decoded.split('/').pop() || decoded;
};

/**
 * Turn one location into a row: its line number, that line's text, where
 * inside the text the reference falls, and the range opening the row selects.
 *
 * Every one of those is measured off the same resolved offsets, so the row
 * cannot show one line and open another.
 *
 * Indentation is stripped because the panel is a narrow column — a deeply
 * nested reference would otherwise show nothing but whitespace — so the match
 * offsets shift with it. `matchEnd` is clamped to the line: a range may span
 * several lines, and only the first is shown.
 */
const toLspReferenceRow = ({
  mapping,
  fileUri,
  doc,
  range,
}: {
  mapping: WorkspaceMapping;
  fileUri: string;
  doc: Text;
  range: LspRange;
}): LspReferenceRow => {
  const from = resolveOffset({
    mapping,
    uri: fileUri,
    doc,
    pos: range.start,
    assoc: 1,
  });
  // Never behind `from`: an edit between the request and the response can map
  // the two ends past each other, and a backwards range would select nothing.
  const to = Math.max(
    from,
    resolveOffset({
      mapping,
      uri: fileUri,
      doc,
      pos: range.end,
      assoc: -1,
    }),
  );

  const line = doc.lineAt(from);
  const endLine = doc.lineAt(to);
  const excerpt = line.text.trimStart();
  const indent = line.text.length - excerpt.length;

  const matchStart = Math.max(0, from - line.from - indent);
  const matchEnd = Math.min(
    excerpt.length,
    Math.max(matchStart, to - line.from - indent),
  );

  return {
    id: `${fileUri}:${line.number}:${matchStart}`,
    fileUri,
    lineNumber: line.number,
    excerpt,
    matchStart,
    matchEnd,
    // The resolved range, not the server's: `lineNumber` above came from the
    // mapped offset, and opening the row reads `range` back against the
    // document. Keeping the server's raw range here would let those two
    // disagree — the row saying line 12 and the click landing elsewhere —
    // whenever the mapping moved the position at all.
    range: {
      start: { line: line.number - 1, character: from - line.from },
      end: { line: endLine.number - 1, character: to - endLine.from },
    },
  };
};

/**
 * Resolve a `textDocument/references` response into the view data the panel
 * renders, grouped by file.
 *
 * This runs while the request's `WorkspaceMapping` is still alive, and that is
 * the point: the mapping and the workspace's documents are what the server's
 * bare `{ uri, range }` pairs have to be read against, and neither is reachable
 * from React. Resolving later — in the panel, at render time — would measure
 * against documents that have since moved on.
 *
 * Locations in files the workspace never opened are dropped, matching
 * @codemirror/lsp-client. In practice those are external SDK headers, which
 * have no document to take an excerpt from.
 */
export const resolveLspReferencesResult = async ({
  plugin,
  locations,
  mapping,
  symbol,
  originViewInstanceId,
}: {
  plugin: LSPPlugin;
  locations: LspLocation[];
  mapping: WorkspaceMapping;
  symbol: string;
  originViewInstanceId: ViewInstances;
}): Promise<LspReferencesResult> => {
  const client = plugin.client as CustomLspClient;

  // Group first so each file is looked up once, keeping the server's order.
  const byFile = new Map<string, LspLocation[]>();
  for (const location of locations) {
    const key = normalizeFileUri(location.uri);
    const existing = byFile.get(key);
    if (existing) {
      existing.push(location);
    } else {
      byFile.set(key, [location]);
    }
  }

  const groups: LspReferenceFileGroup[] = [];
  for (const fileLocations of byFile.values()) {
    const file = await client.workspace.requestFile(fileLocations[0].uri);
    if (!file) {
      continue;
    }
    // The open panel's document includes keystrokes not yet sent to the server;
    // `file.doc` is the server's mirror, and all there is for a file with no panel.
    const doc = file.getView()?.state.doc ?? file.doc;

    const rows = fileLocations
      .map((location) =>
        toLspReferenceRow({
          mapping,
          fileUri: file.uri,
          doc,
          range: location.range,
        }),
      )
      .sort(
        (a, b) => a.lineNumber - b.lineNumber || a.matchStart - b.matchStart,
      );

    groups.push({
      fileUri: file.uri,
      fileName: fileNameFromUri(file.uri),
      rows,
    });
  }

  return {
    symbol,
    groups,
    totalCount: groups.reduce((total, group) => total + group.rows.length, 0),
    lspId: client.workspace.lspId,
    originViewInstanceId,
  };
};
