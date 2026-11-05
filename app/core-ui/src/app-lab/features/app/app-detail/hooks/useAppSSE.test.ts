/**
 * useAppSSE parses each SSE `message` event and appends the line separator.
 * The stream is a fake that captures the handlers the hook passes to it.
 */

import {
  EventSourceHandlers,
  MessageData,
} from '@cloud-editor-mono/infrastructure';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { LINE_SEPARATOR } from '../utils/constants';
import { AppSSEWithId, useAppSSE } from './useAppSSE';

const sendMessage = async (
  trimMessageStart: boolean | undefined,
  message: string,
): Promise<MessageData> => {
  let handlers: EventSourceHandlers | undefined;
  const appSSE: AppSSEWithId = vi.fn(async (_id, h) => {
    handlers = h;
  });
  const onMessage = vi.fn();

  const { result } = renderHook(() =>
    useAppSSE({ appSSE, onMessage, trimMessageStart }),
  );
  await act(() => result.current.connect('app-1'));

  act(() =>
    handlers?.onmessage?.({
      id: '',
      event: 'message',
      data: JSON.stringify({ id: 'main', message }),
    }),
  );

  expect(onMessage).toHaveBeenCalledTimes(1);
  return onMessage.mock.calls[0][0];
};

describe('useAppSSE', () => {
  it('trims leading whitespace by default', async () => {
    const data = await sendMessage(undefined, '   x');
    expect(data.message).toBe(`x${LINE_SEPARATOR}`);
  });

  it('keeps leading spaces and tabs when trimMessageStart is false', async () => {
    const data = await sendMessage(false, ' \t  x');
    expect(data).toEqual({ id: 'main', message: ` \t  x${LINE_SEPARATOR}` });
  });
});
