import { Extension } from '@codemirror/state';
import { tooltips } from '@codemirror/view';

// Render tooltips in document.body so they escape any ancestor with `overflow: hidden`,
// `transform`, `will-change`, or `contain: layout` that would otherwise clip the
// `position: fixed` tooltip element inside the editor layout.
export const getLspTooltipsExtension = (): Extension => {
  const tooltipsExtension = tooltips({ parent: document.body });

  return tooltipsExtension;
};
