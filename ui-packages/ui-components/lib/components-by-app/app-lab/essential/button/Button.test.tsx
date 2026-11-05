import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Button } from './Button';

describe('Button', () => {
  it('ignores clicks while loading', () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Delete
      </Button>,
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(onClick).not.toHaveBeenCalled();
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('calls onClick when not loading', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Delete</Button>);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(button).toBeEnabled();
    expect(button).not.toHaveAttribute('aria-busy');
  });
});
