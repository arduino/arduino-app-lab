/**
 * EXAMPLE EXTENSION — a complete, minimal EditorPanel content renderer.
 *
 * This is documentation-by-code for the extension seam described in
 * ../../EXTENDING.md and ADR-0002: it shows everything needed to teach
 * EditorPanel a new file type (.csv shown as a table) WITHOUT touching
 * EditorPanel itself. Copy this folder as the starting point for your own
 * renderer, then register it from your app:
 *
 *   <EditorPanel contentRenderers={[csvTableContentRenderer]} ... />
 *
 * It is intentionally NOT registered anywhere and NOT exported from the
 * library root: a real renderer belongs to the app that owns the file
 * type (see components-by-app/app-lab/editor-panel/appLabContentRenderers.tsx
 * for the production reference).
 */

import { PaneContentRenderer } from '../../paneContentRenderer';
import styles from './csv-table.module.scss';

/**
 * Naive CSV split, good enough for a teaching example. A real renderer
 * would use a proper parser (quoted fields, escapes, delimiters).
 */
const parseCsv = (raw: string): string[][] =>
  raw
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) => line.split(','));

export const csvTableContentRenderer: PaneContentRenderer = {
  // Stable, unique id. Prefix with your app/feature name.
  id: 'example-csv-table',

  // `match` decides whether this renderer handles the pane. It runs for
  // every render of every pane, so keep it cheap and side-effect free.
  // You get the full PaneContentContext: file, paneId, readOnly, extras...
  match: ({ file }) => file.ext === 'csv',

  // `render` must be a pure function of the context — no hooks in the
  // renderer itself (put stateful behavior inside the returned component
  // if you need it). Key by file.id when the content should remount on
  // file switch.
  render: ({ file, readOnly }) => {
    const [header, ...rows] = parseCsv(file.getData() ?? '');
    return (
      <div key={file.id} className={styles['csv-table-container']}>
        {readOnly && <p className={styles['csv-read-only-note']}>Read-only</p>}
        <table className={styles['csv-table']}>
          {header && (
            <thead>
              <tr>
                {header.map((cell, i) => (
                  <th key={i}>{cell}</th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td key={c}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  },
};
