// ----------------------------------------------------------------------
// IMPORTED FILE
//
// This code was imported from a external library to handle private
// dependencies required for the main application to run.
// ----------------------------------------------------------------------

import { createContext, useContext } from 'react';

// The default context is used to render the sidebar in the docs.
// Default values are mocks; the sidebar will not work without a valid context.
export const ModalContext = createContext<{ closeable?: boolean }>({
  closeable: true,
});

export const useModalContext = (): { closeable?: boolean } => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModalContext must be used within a ModalContext');
  }
  return context;
};
