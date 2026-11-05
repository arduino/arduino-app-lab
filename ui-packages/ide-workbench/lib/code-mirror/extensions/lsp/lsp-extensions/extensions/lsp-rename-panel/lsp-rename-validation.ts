import { MessageDescriptor } from 'react-intl';

import { LSP_LANGS } from '../../../lsp-consts';
import { LspId } from '../../../lsp-types';
import { messages } from '../../../messages';

export interface RenameNameError {
  message: MessageDescriptor;
  values?: Record<string, string>;
}

type IdentifierSyntax = 'python' | 'cLike' | 'javascript';

const IDENTIFIER_SYNTAX_BY_LSP: Partial<Record<LspId, IdentifierSyntax>> = {
  python: 'python',
  arduino: 'cLike',
  typescript: 'javascript',
};

/**
 * Deliberately permissive: these catch the typo-level names servers reject —
 * `$` in Python, a leading digit, punctuation — while accepting anything the
 * language plausibly allows (unicode letters in Python/JS, `$` in JS). The
 * server stays the authority on the rest (keywords, collisions), and its
 * refusal is surfaced by the rename command.
 */
const IDENTIFIER_PATTERNS: Record<IdentifierSyntax, RegExp> = {
  python: /^[\p{L}_][\p{L}\p{N}_]*$/u,
  cLike: /^[A-Za-z_][A-Za-z0-9_]*$/,
  javascript: /^[\p{L}$_][\p{L}\p{N}$_]*$/u,
};

const identifierPatternForUri = (uri: string): RegExp | undefined => {
  const extension = uri.split('.').pop()?.toLowerCase();
  const lspId = extension
    ? (LSP_LANGS as Partial<Record<string, LspId>>)[extension]
    : undefined;
  const syntax = lspId ? IDENTIFIER_SYNTAX_BY_LSP[lspId] : undefined;
  return syntax ? IDENTIFIER_PATTERNS[syntax] : undefined;
};

/**
 * Validate a rename target against the identifier rules of `uri`'s language.
 * Returns the error to show, or null when the name is worth sending to the
 * server. Without it an invalid name is answered with an empty edit and the
 * rename appears to do nothing.
 */
export const validateRenameName = ({
  newName,
  uri,
}: {
  newName: string;
  uri: string;
}): RenameNameError | null => {
  if (!newName) {
    return { message: messages.renameNameRequired };
  }

  const invalidName = {
    message: messages.renameNameInvalid,
    values: { name: newName },
  };

  const pattern = identifierPatternForUri(uri);
  if (!pattern) {
    // A language we have no rule for (html/css, or a file the LSP map doesn't
    // cover): reject only names that can't work anywhere, leave the rest to
    // the server.
    return /\s/.test(newName) ? invalidName : null;
  }

  return pattern.test(newName) ? null : invalidName;
};
