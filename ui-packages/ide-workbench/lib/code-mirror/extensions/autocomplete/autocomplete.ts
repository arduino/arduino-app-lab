import {
  Completion,
  CompletionContext,
  CompletionResult,
} from '@codemirror/autocomplete';

export const getCompletionResult = (
  context: CompletionContext,
  completionFilter: (query: string) => Completion[],
): CompletionResult | null => {
  if (context.state.readOnly) {
    return null;
  }
  const word = context.matchBefore(/[\w]+(?:\.[\w]*)?$/);

  if (!word || (word.from === word.to && !context.explicit)) {
    return null;
  }

  const doc = context.state.doc;

  const charBefore = doc.sliceString(word.from - 1, word.from);

  if (charBefore === '.') {
    let start = word.from - 2;
    while (start >= 0 && /\w/.test(doc.sliceString(start, start + 1))) {
      start--;
    }

    const prefixWord = doc.sliceString(start + 1, word.from - 1);

    if (!prefixWord) {
      return null;
    }
  }

  const completions = completionFilter(word.text);

  if (completions.length === 0) {
    return null;
  }

  const dotIndex = word.text.indexOf('.');
  const fromPos = dotIndex !== -1 ? word.from + dotIndex + 1 : word.from;

  return {
    from: fromPos,
    options: completions,
  };
};
