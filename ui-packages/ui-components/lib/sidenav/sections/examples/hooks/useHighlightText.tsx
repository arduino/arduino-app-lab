import { useFilter } from 'react-aria';

import { highlightText } from '../../../../utils';

type UseHighlightText = {
  (text: string, searchQuery: string): JSX.Element;
};

export const useHighlightText: UseHighlightText = function useHighlightText(
  text: string,
  searchQuery: string,
): ReturnType<UseHighlightText> {
  const { startsWith } = useFilter({
    sensitivity: 'base',
  });

  return highlightText(text, searchQuery, startsWith);
};
