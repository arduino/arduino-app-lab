import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { requestBoardSwitch, useBoardSwitchStore } from './boardSwitchStore';
import { useChatStore } from './chatStore';

const confirm = vi.fn();

beforeEach(() => {
  confirm.mockClear();
  useChatStore.getState().reset();
  useBoardSwitchStore.setState({ pending: undefined, confirmedAt: undefined });
});

describe('requestBoardSwitch', () => {
  it('lets the switch through when no turn is running', () => {
    expect(requestBoardSwitch({ currentBoardName: 'board-a', confirm })).toBe(
      true,
    );
    expect(useBoardSwitchStore.getState().pending).toBeUndefined();
  });

  it('parks the switch while any session streams, even a background one', () => {
    useChatStore.getState().setCurrentSessionId('visible');
    useChatStore.getState().beginTurn('background');

    expect(requestBoardSwitch({ currentBoardName: 'board-a', confirm })).toBe(
      false,
    );
    expect(useBoardSwitchStore.getState().pending?.currentBoardName).toBe(
      'board-a',
    );
    // Nothing switches until the dialog is answered.
    expect(confirm).not.toHaveBeenCalled();
  });

  it('lets the switch through again once the turn ends', () => {
    useChatStore.getState().beginTurn('session');
    requestBoardSwitch({ confirm });
    useChatStore.getState().endTurn('session');

    expect(requestBoardSwitch({ confirm })).toBe(true);
  });
});

describe('confirmPending', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const park = (): void => {
    useChatStore.getState().beginTurn('session');
    requestBoardSwitch({ currentBoardName: 'board-a', confirm });
  };

  it('re-issues the parked switch and clears it', () => {
    park();
    useBoardSwitchStore.getState().confirmPending();

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(useBoardSwitchStore.getState().pending).toBeUndefined();
  });

  it('marks the teardown it causes as confirmed, one shot only', () => {
    park();
    useBoardSwitchStore.getState().confirmPending();

    expect(useBoardSwitchStore.getState().consumeConfirmed()).toBe(true);
    expect(useBoardSwitchStore.getState().consumeConfirmed()).toBe(false);
  });

  it('leaves a teardown nobody confirmed to the reconnect prompt', () => {
    expect(useBoardSwitchStore.getState().consumeConfirmed()).toBe(false);
  });

  it('expires when the confirmed switch never produced a teardown', () => {
    vi.useFakeTimers();
    park();
    useBoardSwitchStore.getState().confirmPending();
    vi.advanceTimersByTime(31_000);

    expect(useBoardSwitchStore.getState().consumeConfirmed()).toBe(false);
  });
});
