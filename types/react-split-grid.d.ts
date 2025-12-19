export {};

import { SplitOptions } from 'split-grid';

declare module 'react-split-grid' {
  export interface SplitProps {
    render?: SplitOptions['render'];
  }
}
