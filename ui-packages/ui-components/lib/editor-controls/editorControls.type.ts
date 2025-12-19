export enum EditorControl {
  Fullscreen,
  Indent,
  Undo,
  Redo,
}

export interface EditorControlsHandlers {
  [EditorControl.Fullscreen]?: (...args: any[]) => any;
  [EditorControl.Indent]: (...args: any[]) => any;
  [EditorControl.Undo]: (...args: any[]) => any;
  [EditorControl.Redo]: (...args: any[]) => any;
}
