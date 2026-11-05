import {
  AIModelItem,
  StreamEventType,
} from '@cloud-editor-mono/infrastructure';
import { EventSourceMessage } from '@microsoft/fetch-event-source';

export type ModelDownloadEvent =
  | { event: StreamEventType.Message; message: string }
  | { event: StreamEventType.Progress; progress: number; name?: string }
  | { event: StreamEventType.Error; code?: string; message: string }
  | { event: StreamEventType.Done; model: AIModelItem };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const parsePayload = (data: string): unknown => {
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
};

export const parseSseEvent = (
  event: EventSourceMessage,
): ModelDownloadEvent | undefined => {
  if (!event.data) {
    return undefined;
  }

  const payload = parsePayload(event.data);

  switch (event.event as StreamEventType) {
    case StreamEventType.Message: {
      const message = asString(
        isRecord(payload) ? payload['message'] : payload,
      );

      return message === undefined
        ? undefined
        : { event: StreamEventType.Message, message };
    }

    case StreamEventType.Progress: {
      if (!isRecord(payload) || typeof payload['progress'] !== 'number') {
        return undefined;
      }

      return {
        event: StreamEventType.Progress,
        progress: payload['progress'],
        name: asString(payload['name']),
      };
    }

    case StreamEventType.Error: {
      if (isRecord(payload)) {
        return {
          event: StreamEventType.Error,
          code: asString(payload['code']),
          message: asString(payload['message']) ?? '',
        };
      }

      return {
        event: StreamEventType.Error,
        message: asString(payload) ?? '',
      };
    }

    case StreamEventType.Done: {
      // `done` answers with the model that was installed. A payload that is not
      // one names nothing to report: an older daemon repeats `done` per file
      // and after extraction, so only the stream close settles the outcome.
      if (!isRecord(payload)) {
        return undefined;
      }

      return {
        event: StreamEventType.Done,
        model: payload as AIModelItem,
      };
    }

    default:
      return undefined;
  }
};
