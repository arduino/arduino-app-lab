import { FileLineScope } from '@cloud-editor-mono/common';
import { SidenavItemId } from '@cloud-editor-mono/ui-components';
import { MakeGenerics } from '@tanstack/react-location';

export const NAV_PARAM = 'nav';
export const EXAMPLE_ID_PARAM = 'eid';
export const LIBRARY_ID_PARAM = 'lid';
export const UI_MODE_PARAM = 'ui';
export const SOURCE_LIBRARY_ID_PARAM = 'slid';
export const CUSTOM_LIBRARY_ID_PARAM = 'clid';
export const CREATE_EXAMPLE_PARAM = 'createExample';
export const CREATE_SKETCH_PARAM = 'createSketch';
export const SKETCH_ID_ROUTE_PARAM = 'sketchID';
export const BYPASS_OPT_IN = 'optIn';
export const BYPASS_IOT_REDIRECT = 'bypassIotRedirect';
export const NOT_FOUND_PARAM = 'notFound';

export const NOT_FOUND_TYPES = ['Sketch', 'Example', 'Library'] as const;
export type NotFoundType = typeof NOT_FOUND_TYPES[number];

// VIEW MODE PARAMS
export const VIEW_MODE_PARAM = 'view-mode';
export const SCOPE_PARAM = 'scope';
export const HIGHLIGHT_PARAM = 'highlight';
export const HIDE_NUMBERS_PARAM = 'hide-numbers';

export const VIEW_MODE_VALUES = ['preview', 'embed', 'snippet'] as const;
export type ViewModeValue = typeof VIEW_MODE_VALUES[number];
export type HideNumbersValue = undefined;
export type ScopeValue = `L${number}-L${number}`;
export type HighlightValueItems = `L${number}` | `L${number}-L${number}`;
export type HighlightValue = string; // comma separated list of HighlightValueItems (too complex to type)

export const GEN_AI_POC = 'gen-ai-poc';

export function isViewModeValue(value: string): value is ViewModeValue {
  return VIEW_MODE_VALUES.includes(value as ViewModeValue);
}

export function isScopeValue(value: string): value is ScopeValue {
  const [start, end] = value.replaceAll('L', '').split('-');

  return !isNaN(Number(start)) && !isNaN(Number(end));
}

export function getStartEndFromScope(scope: ScopeValue): FileLineScope {
  const [start, end] = scope.replaceAll('L', '').split('-').map(Number);
  return { start, end };
}

export function isHighlightValue(value: string): value is HighlightValue {
  return value.split(',').every((item) => {
    const [start, end] = item.replaceAll('L', '').split('-');

    if (end) {
      return !isNaN(Number(start)) && !isNaN(Number(end));
    }
    return !isNaN(Number(start));
  });
}

export function getLineNumbersFromHighlightValue(
  value: HighlightValue,
): number[] {
  return [
    ...new Set(
      value.split(',').flatMap((item) => {
        const [start, end] = item.replaceAll('L', '').split('-').map(Number);

        if (end) {
          return Array.from({ length: end - start + 1 }, (_, i) => start + i);
        }
        return [start];
      }),
    ),
  ];
}

export enum UIMode {
  Fullscreen = 'fs',
}

export type SearchGenerics = MakeGenerics<{
  Search: {
    tabSelection: string; //TODO implement file selection based on this
    [NAV_PARAM]: SidenavItemId;
    [EXAMPLE_ID_PARAM]: string;
    [LIBRARY_ID_PARAM]: string;
    [SOURCE_LIBRARY_ID_PARAM]: string;
    [CUSTOM_LIBRARY_ID_PARAM]: string;
    [UI_MODE_PARAM]: UIMode;
    [CREATE_EXAMPLE_PARAM]: boolean;
    [CREATE_SKETCH_PARAM]: boolean;
    [BYPASS_OPT_IN]: boolean;
    [VIEW_MODE_PARAM]: ViewModeValue;
    [SCOPE_PARAM]: ScopeValue;
    [HIGHLIGHT_PARAM]: HighlightValue;
    [HIDE_NUMBERS_PARAM]: HideNumbersValue;
    [SKETCH_ID_ROUTE_PARAM]: string;
    [NOT_FOUND_PARAM]: NotFoundType;
    [BYPASS_IOT_REDIRECT]: boolean;
    [GEN_AI_POC]: boolean;
  };
}>;
