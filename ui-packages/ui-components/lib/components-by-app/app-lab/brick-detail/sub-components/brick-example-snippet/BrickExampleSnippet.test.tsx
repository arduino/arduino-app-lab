import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { BrickExampleSnippet } from './BrickExampleSnippet';

const navigate = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
}));

const CONTENT = 'Snippet body text';

describe('BrickExampleSnippet', () => {
  it('renders the title and the content through the markdown reader', () => {
    render(
      <BrickExampleSnippet
        title="Detect in a photo"
        exampleId="example-1"
        content={CONTENT}
      />,
    );

    expect(screen.getByText('Detect in a photo')).toBeInTheDocument();
    expect(screen.getByText(CONTENT)).toBeInTheDocument();
  });

  it('navigates to the example when the link is clicked', () => {
    navigate.mockClear();
    render(
      <BrickExampleSnippet
        title="Count objects"
        exampleId="example-2"
        content={CONTENT}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /See example/ }));

    expect(navigate).toHaveBeenCalledWith({ to: '/examples/example-2' });
  });

  it('does not navigate when the header background is clicked', () => {
    navigate.mockClear();
    render(
      <BrickExampleSnippet
        title="Count objects"
        exampleId="example-3"
        content={CONTENT}
      />,
    );

    fireEvent.click(screen.getByText('Count objects'));

    expect(navigate).not.toHaveBeenCalled();
  });

  it('hides the title and the link when hideHeader is set', () => {
    render(
      <BrickExampleSnippet
        title="Detect in a photo"
        exampleId="example-4"
        content={CONTENT}
        hideHeader
      />,
    );

    expect(screen.queryByText('Detect in a photo')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /See example/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(CONTENT)).toBeInTheDocument();
  });
});
