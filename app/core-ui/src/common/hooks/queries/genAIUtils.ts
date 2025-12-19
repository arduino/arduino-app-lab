import { EventSourceMessage } from '@microsoft/fetch-event-source';

export function isGenAIResponseContentTypeStream(response: Response): boolean {
  const contentType = response.headers.get('Content-Type');
  return !!contentType?.includes('text/event-stream');
}

export async function genAIResponseIsPromptToLongError(
  response: Response,
): Promise<boolean> {
  if (response.status !== 400) return false;

  try {
    const result = await response.json();
    const errorMessage = result?.err?.toLowerCase() || '';
    return (
      errorMessage.includes('text too long') ||
      errorMessage.includes('text length exceeds')
    );
  } catch (e) {
    return false;
  }
}

export function genAIResponseMaxTokensReachedError(
  message: EventSourceMessage,
): boolean {
  if (message?.event !== 'error') return false;

  const data = message.data.toLowerCase();
  return (
    data.includes('max output tokens reached') ||
    data.includes('max tokens reached') ||
    data.includes('max tokens exceeded')
  );
}
