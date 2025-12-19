import { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { RefCallback, useEffect, useRef } from 'react';

import {
  FileExt,
  fileExtCodeMirrorExtensionMap,
  languageToFileExtMap,
} from '../../code-mirror/extensions/language/setup';

export type UseCodeBlockCodeMirror = (code: string) => {
  ref: RefCallback<HTMLDivElement>;
};

export function createUseCodeBlockHook(
  setup: Extension,
): (code: string, language?: string) => React.RefObject<HTMLDivElement> {
  return function useCodeMirrorCodeBlock(code: string, language = 'cpp') {
    const ref = useRef<HTMLDivElement>(null);
    const viewInstance = useRef<EditorView | null>(null);

    useEffect(() => {
      if (viewInstance.current) {
        return;
      }

      const ext = languageToFileExtMap[language] || FileExt.Other;
      const languageHighlight: Extension = fileExtCodeMirrorExtensionMap[ext];

      viewInstance.current = new EditorView({
        doc: code,
        extensions: [setup, languageHighlight],
        parent: ref.current || undefined,
      });
    }, [code, language]);

    useEffect(() => {
      return () => {
        if (viewInstance.current) {
          viewInstance.current.destroy();
          viewInstance.current = null;
        }
      };
    }, []);

    useEffect(() => {
      if (viewInstance.current) {
        if (viewInstance.current.state.doc.toString() === code) {
          return;
        }

        viewInstance.current.dispatch({
          changes: {
            from: 0,
            to: viewInstance.current.state.doc.length,
            insert: code,
          },
        });
      }
    }, [code]);

    return ref;
  };
}
