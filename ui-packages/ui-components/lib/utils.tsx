import { memoize } from 'lodash';

export const highlightText = memoize(
  (
    text: string,
    searchQuery: string,
    startsWith: (string: string, substring: string) => boolean,
  ): JSX.Element => {
    let matchIndex = -1;
    for (let i = 0; i < text.length; i++) {
      if (startsWith(text.slice(i), searchQuery)) {
        matchIndex = i;
        break;
      }
    }
    if (matchIndex === -1) {
      return <>{text}</>;
    }
    return (
      <>
        {text.substring(0, matchIndex)}
        <strong>
          {text.substring(matchIndex, matchIndex + searchQuery.length)}
        </strong>
        {text.substring(matchIndex + searchQuery.length)}
      </>
    );
  },
  (arg1, arg2) => arg1 + arg2,
);

export const getBackgroundIcon = (icon?: string): string => {
  return `url("data:image/svg+xml;charset=UTF-8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-size='124'>${icon}</text></svg>")`;
};

export const formatBytes = (
  bytes: number | undefined,
  decimals = 1,
): string => {
  if (bytes === undefined || bytes < 0) return 'N/A';
  if (bytes === 0) return '0 bytes';
  if (bytes < 1024) return `${bytes} byte${bytes === 1 ? '' : 's'}`;

  const k = 1024;
  const sizes = ['KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);

  return `${parseFloat(value.toFixed(decimals))} ${sizes[i - 1]}`;
};
