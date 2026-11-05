// Space between the menu and its second level.
const SUBMENU_GAP = 4;
// Kept free between the second level and the window edges.
const VIEWPORT_MARGIN = 8;
// The menu's own padding: lifting the second level by it lines its first row up with the anchor row.
const MENU_PADDING = 4;

type Box = Pick<DOMRect, 'top' | 'left'>;

interface SubmenuRects {
  menu: Box;
  row: Box;
}

// Viewport coordinates. The second level sits to the left of the menu: the menu is pinned to the
// composer's right edge, so opening to the right would run past the window. It moves up by as much
// as it would run past the window's bottom edge.
export const submenuPosition = (
  { menu, row }: SubmenuRects,
  size: { width: number; height: number },
  viewportHeight: number,
): { top: number; left: number } => ({
  top: Math.max(
    VIEWPORT_MARGIN,
    Math.min(
      row.top - MENU_PADDING,
      viewportHeight - VIEWPORT_MARGIN - size.height,
    ),
  ),
  left: Math.max(VIEWPORT_MARGIN, menu.left - SUBMENU_GAP - size.width),
});
