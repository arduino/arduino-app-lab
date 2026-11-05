import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AgentAction } from './AgentAction';

describe('AgentAction', () => {
  // An agent on free models has nothing to connect: its closed card offers Manage, which opens it.
  it('offers Manage, not Connect, for an installed agent with nothing to connect', () => {
    const onManage = vi.fn();
    render(<AgentAction installed manageOnly onManage={onManage} />);

    expect(screen.queryByText('Connect')).toBeNull();
    // A button with an icon renders its label twice.
    fireEvent.click(
      screen.getAllByText('Manage')[0].closest('button') as HTMLButtonElement,
    );
    expect(onManage).toHaveBeenCalledTimes(1);
  });

  it('offers Cancel while its card is open', () => {
    render(<AgentAction installed manageOnly cancelling />);

    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.queryByText('Manage')).toBeNull();
  });

  // Until the check answers, either offer could be wrong.
  it('offers neither Install nor Connect while the install check runs', () => {
    render(<AgentAction checking />);

    expect(screen.queryByText('Install')).toBeNull();
    expect(screen.queryByText('Connect')).toBeNull();
    expect(screen.getByText('Checking…').closest('button')).toBeDisabled();
  });

  // There is no Connect: Manage on an agent not connected yet opens its sign-in, and a turn blocks it.
  it('offers Manage that opens the sign-in for an installed agent not connected', () => {
    const onConnect = vi.fn();
    const onManage = vi.fn();
    const { rerender } = render(
      <AgentAction installed onConnect={onConnect} onManage={onManage} />,
    );
    // A button with an icon renders its label twice.
    const manage = (): HTMLButtonElement =>
      screen.getAllByText('Manage')[0].closest('button') as HTMLButtonElement;

    fireEvent.click(manage());
    expect(onConnect).toHaveBeenCalledTimes(1);
    expect(onManage).not.toHaveBeenCalled();
    expect(screen.queryByText('Connect')).toBeNull();

    rerender(
      <AgentAction
        installed
        blockedReason="a turn is running"
        onConnect={onConnect}
      />,
    );
    expect(manage()).toBeDisabled();
  });
});
