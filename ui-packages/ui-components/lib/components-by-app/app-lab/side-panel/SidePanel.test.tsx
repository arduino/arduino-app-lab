import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SidePanel } from './index';
import { SidePanelLogic } from './sidePanel.type';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    className,
    children,
  }: {
    to: string;
    className?: string;
    children: React.ReactNode;
  }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

const baseLogic: ReturnType<SidePanelLogic> = {
  visible: true,
  activeItemId: undefined,
  board: undefined,
  boards: [],
  onSelectBoard: vi.fn(),
  onCreateApp: vi.fn(),
  onImportApp: vi.fn(),
  user: { initials: 'AA' },
};

const renderSidePanel = (
  overrides: Partial<ReturnType<SidePanelLogic>> = {},
): ReturnType<typeof render> => {
  const sidePanelLogic: SidePanelLogic = () => ({ ...baseLogic, ...overrides });
  return render(<SidePanel sidePanelLogic={sidePanelLogic} />);
};

describe('SidePanel', () => {
  it('renders every composed Row', () => {
    renderSidePanel();

    expect(screen.getByText('Apps')).toBeInTheDocument();
    expect(screen.getByText('App Hub')).toBeInTheDocument();
    expect(screen.getByText('Resources')).toBeInTheDocument();
    expect(screen.getByText('Bricks')).toBeInTheDocument();
    // Basic Examples is hidden until its dedicated page ships
    expect(screen.queryByText('Basic Examples')).toBeNull();
  });

  it('links App Hub to /examples and Resources to /learn', () => {
    renderSidePanel();

    expect(screen.getByText('App Hub').closest('a')).toHaveAttribute(
      'href',
      '/examples',
    );
    expect(screen.getByText('Resources').closest('a')).toHaveAttribute(
      'href',
      '/learn',
    );
  });

  it('renders a link for a Row with a route', () => {
    renderSidePanel();

    expect(screen.getByText('Apps').closest('a')).toHaveAttribute(
      'href',
      '/my-apps',
    );
    expect(screen.getByText('Bricks').closest('a')).toHaveAttribute(
      'href',
      '/bricks',
    );
  });

  it('marks the active Row via aria-current, and only that Row', () => {
    renderSidePanel({ activeItemId: 'my-apps' });

    expect(screen.getByText('Apps').closest('[id="my-apps"]')).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(
      screen.getByText('App Hub').closest('[id="app-hub"]'),
    ).not.toHaveAttribute('aria-current');
  });

  it('marks App Hub active on /examples and Resources active on /learn', () => {
    const { unmount } = renderSidePanel({ activeItemId: 'examples' });
    expect(
      screen.getByText('App Hub').closest('[id="app-hub"]'),
    ).toHaveAttribute('aria-current', 'page');
    unmount();

    renderSidePanel({ activeItemId: 'learn' });
    expect(
      screen.getByText('Resources').closest('[id="resources"]'),
    ).toHaveAttribute('aria-current', 'page');
  });

  it('renders the Apps trailing create-app action', () => {
    renderSidePanel();

    expect(screen.getByLabelText('Create new app')).toBeInTheDocument();
  });

  it('collapses the accordion when its header button is clicked', () => {
    renderSidePanel();

    const header = screen.getByRole('button', { name: 'Learn and Explore' });
    expect(header).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('App Hub')).toBeInTheDocument();

    fireEvent.click(header);

    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('App Hub')).toBeNull();
  });

  it('returns null when not visible', () => {
    const { container } = renderSidePanel({ visible: false });

    expect(container).toBeEmptyDOMElement();
  });
});
