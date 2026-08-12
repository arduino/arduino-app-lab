import { objectEntries } from '@cloud-editor-mono/common';
import {
  autocompletion,
  Completion,
  CompletionContext,
  CompletionResult,
} from '@codemirror/autocomplete';
import { Extension } from '@codemirror/state';

import { KeywordCategory, KeywordMap } from '../../keywords/keywords.type';
import { getCompletionResult } from '../autocomplete';

const SECOND_LEVEL_KEYWORDS = {
  Bridge: {
    methods: [
      'begin',
      'is_started',
      'getRouterVersion',
      'provide',
      'provide_safe',
      'update',
      'call',
      'notify',
    ],
  },
} as const;

const completionFilter = (
  query: string,
  firstLevelKeywordEntries: [KeywordCategory, string[]][],
): Completion[] => {
  const splittedQuery = query.split('.');

  // first-level keywords
  let firstLevelKeyWordCompletions: Completion[] = [];

  if (splittedQuery.length === 1) {
    firstLevelKeyWordCompletions = firstLevelKeywordEntries.flatMap(
      ([category, keywords]) =>
        keywords
          .filter((keyword) => keyword.startsWith(query))
          .map((keyword) => {
            const completion: Completion = {
              label: keyword,
              detail: category,
              type: category,
            };
            return completion;
          }),
    );
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
                type: category,
              };
              return completion;
            }),
      );
    }
  }

  return [...firstLevelKeyWordCompletions, ...secondLevelKeyWordCompletions];
};

export const customInoAutocomplete = (keywords: KeywordMap): Extension => {
  const firstLevelKeywordEntries = objectEntries(keywords);

  return autocompletion({
    override: [
      (context: CompletionContext): CompletionResult | null => {
        return getCompletionResult(context, (query) =>
          completionFilter(query, firstLevelKeywordEntries),
        );
      },
    ],
  });
};
