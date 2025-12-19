import { createContext } from 'react';

import { UseReferenceLogic } from '../../../sidenav.type';

export type ReferenceContextValue = ReturnType<UseReferenceLogic>;

const referenceContextValue: ReferenceContextValue =
  {} as ReferenceContextValue;

export const ReferenceContext = createContext<ReferenceContextValue>(
  referenceContextValue,
);
