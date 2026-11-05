export enum EditorControl {
  Fullscreen,
  Indent,
  Undo,
  Redo,
}

export interface EditorControlsHandlers {
  [EditorControl.Fullscreen]?: () => void;
  [EditorControl.Indent]: () => void;
  [EditorControl.Undo]: () => void;
  [EditorControl.Redo]: () => void;
}
