import { KeywordMap } from '@cloud-editor-mono/ui-components/lib/components-by-app/shared';
import { useQuery } from '@tanstack/react-query';

export function useKeywords(): KeywordMap | undefined {
  const { data } = useQuery(
    ['keywords'],
    () =>
      import('@cloud-editor-mono/ui-components/lib/keywords').then(
        ({ ARDUINO_KEYWORDS }) => ARDUINO_KEYWORDS,
      ),

    { refetchOnWindowFocus: false },
  );

  return data;
}
