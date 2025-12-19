import { Search } from '@tanstack/react-location';
import { CellMeasurerCache } from 'react-virtualized';

export function updateSearch(
  search?: Search<unknown>,
  toUpdate?: Search<unknown>,
): Search<unknown> {
  return {
    ...search,
    ...toUpdate,
  };
}

export const createReactVirtualizedCache = (): CellMeasurerCache =>
  new CellMeasurerCache({ fixedWidth: true });
