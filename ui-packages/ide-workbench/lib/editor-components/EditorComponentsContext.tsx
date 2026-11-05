import { createContext, ReactNode, useContext, useMemo } from 'react';

import DefaultIconButton from './DefaultIconButton';
import { EditorComponents } from './editorComponents.type';

export const defaultEditorComponents: EditorComponents = {
  IconButton: DefaultIconButton,
};

const EditorComponentsContext = createContext<EditorComponents>(
  defaultEditorComponents,
);

interface EditorComponentsProviderProps {
  /** Keep this object stable (a module constant): a new object re-renders every consumer. */
  components?: Partial<EditorComponents>;
  children: ReactNode;
}

export const EditorComponentsProvider: React.FC<
  EditorComponentsProviderProps
> = ({ components, children }: EditorComponentsProviderProps) => {
  const value = useMemo(
    () => ({ ...defaultEditorComponents, ...components }),
    [components],
  );
  return (
    <EditorComponentsContext.Provider value={value}>
      {children}
    </EditorComponentsContext.Provider>
  );
};

export const useEditorComponents = (): EditorComponents =>
  useContext(EditorComponentsContext);
