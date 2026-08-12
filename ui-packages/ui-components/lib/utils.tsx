import { memoize } from 'lodash-es';

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

// The soft colour wash behind a card's icon is produced by blurring the icon
// inside this SVG (feGaussianBlur), not with a CSS `filter: blur()` on the
// element. A CSS filter promotes the element to an accelerated compositing
// layer, and on WebKitGTK those layers fail to import when a page has many of
// them: they render as empty rectangles parked at the container's top-left
// corner (the "black square" on Examples, grey on brick detail). Blurring
// inside the image keeps it in the image raster, so no layer is created.
//
// Notes for anyone editing this:
//   - The payload MUST be percent-encoded. A raw `#` in `url(#blur)` would
//     terminate the data URI at the fragment and the filter would silently do
//     nothing.
//   - A CSS `filter` inside the SVG is ignored by WebKit; only feGaussianBlur
//     is honoured for SVG-as-image.
//   - stdDeviation is in SVG user units, so the effective blur scales with the
//     size the image is drawn at.

// Blur radius of the wash, in SVG user units. ~21 matches the 32px CSS blur this
// replaced, given the image is drawn at `background-size: 200%`.
const WASH_BLUR = 21;

// Opacity of the blurred wash. The CSS version was implicitly dimmed because
// blurring pulled in transparent pixels at the element's edges, letting the dark
// card background through; blurring inside the image has no such edge, so we dim
// it explicitly. Tuned so the wash reads at the same tone as before and the emoji
// drawn on top keeps its contrast — raise it for a more saturated wash, lower it
// for more contrast.
const WASH_OPACITY = 0.55;

export const getBackgroundIcon = (icon?: string): string => {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'>` +
    `<filter id='blur' x='-100%' y='-100%' width='300%' height='300%'>` +
    `<feGaussianBlur stdDeviation='${WASH_BLUR}'/>` +
    `<feComponentTransfer><feFuncA type='linear' slope='${WASH_OPACITY}'/></feComponentTransfer>` +
    `</filter>` +
    `<text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-size='124' filter='url(#blur)'>${icon}</text>` +
    `</svg>`;

  return `url("data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}")`;
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
