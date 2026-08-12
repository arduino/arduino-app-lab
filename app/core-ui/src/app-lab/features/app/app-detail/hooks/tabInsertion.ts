export interface ResolveNewTabInsertionParams {
  /** Current tab ids, in display order. Must not already contain `targetId`. */
  ids: string[];
  /** The id being opened as a new tab. */
  targetId: string;
  /** Explicit drop position; when omitted the tab lands after the active tab. */
  insertIndex?: number;
  /** Whether the new tab opens in preview (italic, replaceable) mode. */
  isPreview: boolean;
  /** The id currently held in preview, if any. */
  oldPreviewId?: string;
  /** The id currently selected/active, if any. */
  oldSelectedId?: string;
}

export interface ResolveNewTabInsertionResult {
  ids: string[];
  previewId: string | undefined;
}

/**
 * Pure tab-open resolver shared by pane A ([useEditorFiles]) and pane B
 * ([appLabEditorPanel]) so both panes insert new tabs and manage the single
 * preview slot identically.
 *
 * Rules (mirrored from pane A's original `selectFile`):
 *  - An existing preview tab is replaced in place — it is removed and the new
 *    tab takes its slot (adjusting an explicit `insertIndex` for the removal).
 *  - With no explicit `insertIndex`, the new tab lands right after the active
 *    tab; otherwise it is inserted at (or appended to) the requested index.
 *  - The new tab becomes the preview when `isPreview`, else preview is cleared.
 *
 * Assumes `targetId` is not already present in `ids`; callers handle the
 * already-open case (including drag-repositioning) before delegating here.
 */
export function resolveNewTabInsertion({
  ids,
  targetId,
  insertIndex,
  isPreview,
  oldPreviewId,
  oldSelectedId,
}: ResolveNewTabInsertionParams): ResolveNewTabInsertionResult {
  let nextIds = ids;
  let targetIndex =
    typeof insertIndex === 'number' && insertIndex >= 0 ? insertIndex : -1;
  let replacedPreviewIndex = -1;

  if (oldPreviewId && ids.includes(oldPreviewId)) {
    const indexOfOldPreview = ids.indexOf(oldPreviewId);
    replacedPreviewIndex = indexOfOldPreview;

    if (oldPreviewId === oldSelectedId) {
      targetIndex = indexOfOldPreview;
    } else if (targetIndex > indexOfOldPreview) {
      targetIndex -= 1;
    }

    nextIds = ids.filter((id) => id !== oldPreviewId);
  }

  if (targetIndex === -1 && oldSelectedId && nextIds.includes(oldSelectedId)) {
    targetIndex = nextIds.indexOf(oldSelectedId) + 1;
  }

  // A replaced preview yields its slot to the new tab even when the selection
  // is elsewhere — or, as with go-to-definition, stale: the LSP client captures
  // `selectFile` once, so `oldSelectedId` can name a tab that has already been
  // replaced. Without this the new tab is appended to the end and the strip
  // reorders itself under the user mid-navigation.
  if (targetIndex === -1 && replacedPreviewIndex !== -1) {
    targetIndex = replacedPreviewIndex;
  }

  const previewId = isPreview ? targetId : undefined;

  if (targetIndex !== -1 && targetIndex <= nextIds.length) {
    return {
      ids: [
        ...nextIds.slice(0, targetIndex),
        targetId,
        ...nextIds.slice(targetIndex),
      ],
      previewId,
    };
  }

  return { ids: [...nextIds, targetId], previewId };
}
