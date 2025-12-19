export type CloudEditorWindow = Window & { _CLOUD_EDITOR_INSTANCE_ID: string };

export function isCloudEditorWindow(
  window: Window,
): window is CloudEditorWindow {
  return '_CLOUD_EDITOR_INSTANCE_ID' in window;
}
