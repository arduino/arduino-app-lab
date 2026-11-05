/**
 * Unit tests for the cloud-editor IconButton.
 *
 * Coverage:
 *  - a mouse click, Enter and Space each reach `onPress` once
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import IconButton from './IconButton';

const TestIcon: React.FC<React.SVGProps<SVGSVGElement>> = () => <svg />;

describe('IconButton', () => {
  it('calls onPress when clicked', async () => {
    const onPress = vi.fn();
    render(<IconButton label="Press" Icon={TestIcon} onPress={onPress} />);

    await userEvent.click(screen.getByRole('button'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['Enter', '{Enter}'],
    ['Space', ' '],
  ])('calls onPress once on %s', async (_, key) => {
    const onPress = vi.fn();
    render(<IconButton label="Press" Icon={TestIcon} onPress={onPress} />);

    screen.getByRole('button').focus();
    await userEvent.keyboard(key);

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
