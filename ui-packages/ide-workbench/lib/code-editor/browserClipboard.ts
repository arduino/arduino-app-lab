import { EditorClipboard } from './codeEditor.type';

/**
 * The fallback clipboard, used when a host injects none: the web platform's
 * own. Failures are swallowed — a clipboard read is denied whenever the
 * document isn't focused or the permission is refused, and neither is worth an
 * unhandled rejection out of a menu click.
 */
export const browserClipboard: EditorClipboard = {
  readText: async (): Promise<string | null> => {
    try {
      return await navigator.clipboard.readText();
    } catch {
      return null;
    }
  },
  writeText: async (text: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // nothing the editor can do about a refused clipboard write
    }
  },
};
