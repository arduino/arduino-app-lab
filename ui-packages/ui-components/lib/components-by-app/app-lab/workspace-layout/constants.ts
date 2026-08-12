// Console panel sizing.
// Forced minimum drag size, also the floor enforced on a restored stored height.
export const CONSOLE_PANEL_MIN_SIZE_PX = 200;
// Size the console shrinks to when collapsed.
export const CONSOLE_PANEL_COLLAPSED_SIZE_PX = 36;
// Cap so a restored/resized console never reads as a fake "maximized" state.
export const CONSOLE_PANEL_MAX_FRACTION = 0.8;

// Editor panel sizing. Kept small so the console can grow near-full-height,
// but must be shared with `useWorkspacePanel` so it can compute the console's
// exact maximum size (group total − editor minSize).
export const EDITOR_PANEL_MIN_SIZE_PX = 48;

// Side panel sizing.
export const SIDE_PANEL_DEFAULT_SIZE_PX = 216;
export const SIDE_PANEL_MIN_SIZE_PX = 152;
export const SIDE_PANEL_COLLAPSED_SIZE_PX = 44;
