import { objectEntries, objectKeys } from '@cloud-editor-mono/common';
import {
  Completion,
  CompletionContext,
  CompletionResult,
} from '@codemirror/autocomplete';
import { pythonLanguage } from '@codemirror/lang-python';

import { getCompletionResult } from '../autocomplete';

const SECOND_LEVEL_KEYWORDS = {
  Bridge: {
    methods: ['notify', 'call', 'provide', 'unprovide'],
  },
} as const;

const completionFilter = (query: string): Completion[] => {
  const splittedQuery = query.split('.');

  // first-level keywords
  let firstLevelKeyWordCompletions: Completion[] = [];

  const secondLevelKeywordsKeys = objectKeys(SECOND_LEVEL_KEYWORDS);

  if (splittedQuery.length === 1) {
    firstLevelKeyWordCompletions = secondLevelKeywordsKeys
      .filter((keyword) => keyword.startsWith(query))
      .map((keyword) => {
        const completion: Completion = {
          label: keyword,
        };
        return completion;
      });
  }

  // second-level keywords
  let secondLevelKeyWordCompletions: Completion[] = [];

  if (splittedQuery.length === 2) {
    const [firstLevelQuery, secondLevelQuery] = splittedQuery;

    if (firstLevelQuery in SECOND_LEVEL_KEYWORDS) {
      const secondLevelKeywords =
        SECOND_LEVEL_KEYWORDS[
          firstLevelQuery as keyof typeof SECOND_LEVEL_KEYWORDS
        ];

      const secondLevelKeywordEntries = objectEntries(secondLevelKeywords);

      secondLevelKeyWordCompletions = secondLevelKeywordEntries.flatMap(
        ([category, keywords]) =>
          keywords
            .filter((keyword) => keyword.startsWith(secondLevelQuery))
            .map((keyword) => {
              const completion: Completion = {
                label: keyword,
                detail: category,
              };
              return completion;
            }),
      );
    } else {
      secondLevelKeyWordCompletions = [];
    }
  }

  return [...firstLevelKeyWordCompletions, ...secondLevelKeyWordCompletions];
};

const customPythonCompletionResult = (
  context: CompletionContext,
): CompletionResult | null => {
  return getCompletionResult(context, completionFilter);
};

export const customPythonAutocomplete = pythonLanguage.data.of({
  autocomplete: customPythonCompletionResult,
});
