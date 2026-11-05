// The engine's placeholder for a session it was never prompted in: its "New session - " label, then the moment it was made.
const PLACEHOLDER =
  /^(?:New session - )?\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?$/;

// A small model can leave its reasoning in the title it writes, with or without the opening tag.
const withoutThinking = (title: string): string =>
  title
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^[\s\S]*<\/think>/i, '')
    .replace(/<think>[\s\S]*$/i, '')
    .trim();

// Undefined for that placeholder, so a session keeps the app's own label until the engine names it.
export const titleIfNamed = (title?: string): string | undefined => {
  const text = title && withoutThinking(title);
  return text && !PLACEHOLDER.test(text) ? text : undefined;
};
