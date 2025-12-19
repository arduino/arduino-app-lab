import { Extension } from '@codemirror/state';
import {
  Decoration,
  DecorationSet,
  EditorView,
  MatchDecorator,
  ViewPlugin,
  ViewUpdate,
} from '@codemirror/view';

import styles from '../../../../public/shared.module.scss';
import { KeywordCategory, KeywordMap } from './keywords.type';

export const KeywordCssClass: Record<KeywordCategory, string> = {
  builtIn: 'cm-arduino-keyword-builtin',
  hints: 'cm-arduino-keyword-hints',
  literal: 'cm-arduino-keyword-literal',
  type: 'cm-arduino-keyword-type',
} as const;

export function getKeywordsPlugins(keywords: KeywordMap): Extension[] {
  const keywordsPlugins = Object.keys(keywords).map((category): Extension => {
    const cat = category as KeywordCategory;
    const keywordsMatcher = createKeywordsMatcher(keywords, cat);
    return ViewPlugin.fromClass(
      class {
        keywords: DecorationSet;
        constructor(view: EditorView) {
          this.keywords = keywordsMatcher.createDeco(view);
        }
        update(update: ViewUpdate): void {
          if (
            update.docChanged ||
            update.selectionSet ||
            update.viewportChanged
          ) {
            this.keywords = keywordsMatcher.updateDeco(update, this.keywords);
          }
        }
      },
      {
        decorations: (instance) => instance.keywords,
      },
    );
  });

  const keywordsThemePlugins = Object.keys(keywords).map(
    (category): Extension => {
      const cat = category as KeywordCategory;
      const selector = KeywordCssClass[cat];
      let color;
      switch (cat) {
        case 'builtIn':
          color = styles.editorSyntaxHighlightFunctions;
          break;
        case 'hints':
          color = styles.editorSyntaxHighlightStructures;
          break;
        case 'literal':
          color = styles.editorSyntaxHighlightVariables;
          break;
        case 'type':
          color = styles.editorSyntaxHighlightVariables;
          break;
      }
      return EditorView.baseTheme({
        // ** changed to "[class*="ͼ"]" from ":is(.ͼp, .ͼv, .ͼu, .ͼo)", as generated codemirror classes (.ͼ<...>)
        // ** are not stable: https://discuss.codemirror.net/t/why-does-cm6-use-the-character-in-class-names/2821/2
        // ** this still relies on their presence, but not their specific value,
        // TODO this is still hacky, we need to make this more reliable
        [`.${selector}, .${selector} > span[class*="ͼ"]`]: {
          color,
        },
      });
    },
  );

  keywordsPlugins.push(...keywordsThemePlugins);

  return keywordsPlugins;
}

function createKeywordsMatcher(
  keywords: KeywordMap,
  category: KeywordCategory,
): MatchDecorator {
  const categoryKeywords = keywords[category];
  const cssClass = KeywordCssClass[category];
  const regexp = new RegExp(`\\b(${categoryKeywords.join('|')})\\b`, 'g');
  return new MatchDecorator({
    regexp,
    decoration: (): Decoration => {
      return Decoration.mark({
        class: cssClass,
      });
    },
  });
}
