import {
  MutableRefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

export type UsePreviewFileIdReturn = [
  string | undefined,
  (id: string | undefined) => void,
  MutableRefObject<string | undefined>,
];

/**
 * Owns the single "preview tab" id shared by pane A ([useEditorFiles]) and
 * pane B ([appLabEditorPanel]).
 *
 * The one preview tab is rendered italic and replaced in place when another
 * file is previewed. A ref mirrors the state so tab-mutating callbacks can
 * read the latest value without a stale closure. Editing a preview file
 * commits it — so once its id appears in `unsavedFileIds` the preview flag is
 * cleared.
 */
export function usePreviewFileId(
  unsavedFileIds: Set<string> | undefined,
): UsePreviewFileIdReturn {
  const [previewFileId, _setPreviewFileId] = useState<string>();
  const previewFileIdRef = useRef<string>();

  const setPreviewFileId = useCallback((id: string | undefined) => {
    _setPreviewFileId(id);
    previewFileIdRef.current = id;
  }, []);

  useEffect(() => {
    if (previewFileId && unsavedFileIds?.has(previewFileId)) {
      setPreviewFileId(undefined);
    }
  }, [unsavedFileIds, previewFileId, setPreviewFileId]);

  return [previewFileId, setPreviewFileId, previewFileIdRef];
}
