// Vitest setup for @bcmi-labs/app-lab-ai-assistant.
// Add global test configuration / mocks here as the test suite grows.

// jsdom has no Worker, and importing the ui-components barrel builds one at module load (the serial
// monitor's match counter), so anything reaching it — the ui/ barrel does — fails before it runs.
class NoopWorker {
  postMessage = (): void => undefined;
  terminate = (): void => undefined;
  addEventListener = (): void => undefined;
  removeEventListener = (): void => undefined;
}

globalThis.Worker ??= NoopWorker as unknown as typeof Worker;

export {};
