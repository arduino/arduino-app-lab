import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Input } from './Input';
import { InputStyle } from './input.type';

describe('Input', () => {
  it.each([InputStyle.CloudEditor, InputStyle.AppLab])(
    'shows and hides a sensitive value with the eye button (%s)',
    async (inputStyle) => {
      render(
        <Input
          inputStyle={inputStyle}
          sensitive
          value="secret"
          onChange={(): void => undefined}
        />,
      );
      const input = screen.getByDisplayValue('secret');

      await userEvent.click(screen.getByRole('button', { name: 'Show text' }));
      expect(input).toHaveAttribute('type', 'text');

      await userEvent.click(screen.getByRole('button', { name: 'Hide text' }));
      expect(input).toHaveAttribute('type', 'password');
    },
  );

  it.each([
    [false, true],
    [true, false],
  ])(
    'with errorBelow=%s, the App Lab error is inside the field: %s',
    (errorBelow, inside) => {
      const { container } = render(
        <Input
          inputStyle={InputStyle.AppLab}
          errorBelow={errorBelow}
          value=""
          error={new Error('Invalid model')}
          onChange={(): void => undefined}
        />,
      );
      const field = container.firstElementChild;

      expect(field?.contains(screen.getByText('Invalid model'))).toBe(inside);
    },
  );
});
