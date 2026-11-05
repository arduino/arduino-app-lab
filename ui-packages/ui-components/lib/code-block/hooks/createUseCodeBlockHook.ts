import {
  customTags as tags,
  highlightStyle,
} from '@cloud-editor-mono/ide-workbench/lib/code-mirror/extensions/language/highlightStyle';
import {
  FileExt,
  fileExtCodeMirrorExtensionMap,
  languageToFileExtMap,
} from '@cloud-editor-mono/ide-workbench/lib/code-mirror/extensions/language/setup';
import { syntaxHighlighting, TagStyle } from '@codemirror/language';
import { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { RefCallback, useEffect, useRef } from 'react';

export type UseCodeBlockCodeMirror = (code: string) => {
  ref: RefCallback<HTMLDivElement>;
};

export function createUseCodeBlockHook(
  setup: Extension,
): (
  code: string,
  language?: string,
  customTags?: TagStyle[],
) => React.RefObject<HTMLDivElement> {
  return function useCodeMirrorCodeBlock(
    code: string,
    language = 'cpp',
    customTags,
  ) {
    const ref = useRef<HTMLDivElement>(null);
    const viewInstance = useRef<EditorView | null>(null);

    useEffect(() => {
      if (viewInstance.current) {
        return;
      }

      const ext = languageToFileExtMap[language] || FileExt.Other;
      const languageHighlight: Extension = fileExtCodeMirrorExtensionMap[ext];

      const customSyntaxHighlighting = customTags
        ? syntaxHighlighting(highlightStyle(customTags), {
            fallback: true,
          })
        : syntaxHighlighting(highlightStyle(tags), { fallback: true });

      viewInstance.current = new EditorView({
        doc: code,
        extensions: [setup, languageHighlight, customSyntaxHighlighting],
        parent: ref.current || undefined,
      });
    }, [code, language, customTags]);

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
