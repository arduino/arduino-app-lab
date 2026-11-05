import { type FormatMessage } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

import { messages } from '../../../messages';
import { parseAgentError } from '../../../services';
import { formatDiskUsage } from '../../settings/RuntimePanel.logic';

// The fields Go adds to an error it sends as JSON, {"code": "...", "message": "...", ...}.
interface CodedError {
  code?: unknown;
  apps?: unknown;
  conflictingApps?: unknown;
  folders?: unknown;
  neededBytes?: unknown;
  freeBytes?: unknown;
  restarted?: unknown;
  restartFailed?: unknown;
  provider?: unknown;
  keyProvider?: unknown;
  prefix?: unknown;
  reason?: unknown;
}

const field = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const codedError = (text: string): CodedError | undefined => {
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === 'object'
      ? (parsed as CodedError)
      : undefined;
  } catch {
    return undefined;
  }
};

// What a refused switch did to the agent in use: Go stopped it and started it again as a new process, or could not.
export const switchRefusalOf = (
  text: string,
): { restarted: boolean; restartFailed: boolean } => {
  const coded = codedError(text);
  return {
    restarted: coded?.restarted === true,
    restartFailed: coded?.restartFailed === true,
  };
};

const names = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string')
    : [];

// Go leaves a size out when it could not measure it; a 0 it sends is a real one.
const size = (value: unknown): string | undefined =>
  typeof value === 'number' && value >= 0 ? formatDiskUsage(value) : undefined;

// `apps` also holds the apps whose save failed for another reason; a backend that does not send `conflictingApps` cannot tell them apart.
const conflictRefusal = (
  apps: string[],
  conflictingApps: unknown,
  formatMessage: FormatMessage,
): string => {
  const conflicting = names(conflictingApps);
  if (conflicting.length === 0) {
    return formatMessage(
      apps.length === 1
        ? messages.errorSwitchConflictingEdits
        : messages.errorSwitchConflictingEditsAmong,
      { apps: apps.join(', ') },
    );
  }
  const refusal = formatMessage(messages.errorSwitchConflictingEdits, {
    apps: conflicting.join(', '),
  });
  const others = apps.filter((app) => !conflicting.includes(app));
  return others.length > 0
    ? `${refusal} ${formatMessage(messages.errorSwitchEditsNotSavedEither, {
        apps: others.join(', '),
      })}`
    : refusal;
};

// The words for an error from the host: App Lab's own for a code it knows, else the message the error carries.
export const describeError = (
  text: string,
  formatMessage: FormatMessage,
): string => {
  const coded = codedError(text);
  const apps = names(coded?.apps);
  const folders = names(coded?.folders);
  // Go's own message says it too; these sentences replace that message, so they have to.
  const stopped = (refusal: string): string =>
    coded?.restartFailed === true
      ? `${refusal} ${formatMessage(messages.errorSwitchAgentStopped)}`
      : refusal;
  if (coded?.code === 'agent_switch_unsaved_edits' && apps.length > 0) {
    return stopped(
      formatMessage(messages.errorSwitchUnsavedEdits, {
        apps: apps.join(', '),
      }),
    );
  }
  if (coded?.code === 'agent_switch_conflicting_edits' && apps.length > 0) {
    return stopped(conflictRefusal(apps, coded.conflictingApps, formatMessage));
  }
  if (coded?.code === 'agent_switch_stranded_edits' && folders.length > 0) {
    return stopped(
      formatMessage(messages.errorSwitchStrandedEdits, {
        folders: folders.join(', '),
        count: folders.length,
      }),
    );
  }
  if (coded?.code === 'airuntime_insufficient_disk_space') {
    const needed = size(coded.neededBytes);
    const free = size(coded.freeBytes);
    // Without both sizes the sentence would have to make one up.
    return needed && free
      ? formatMessage(messages.errorDiskSpace, { needed, free })
      : formatMessage(messages.errorDiskSpaceUnknown);
  }
  const provider = field(coded?.provider);
  const reason = field(coded?.reason);
  if (coded?.code === 'provider_key_rejected' && provider) {
    return reason
      ? formatMessage(messages.errorProviderKeyRejectedSaying, {
          provider,
          reason,
        })
      : formatMessage(messages.errorProviderKeyRejected, { provider });
  }
  const keyProvider = field(coded?.keyProvider);
  if (
    coded?.code === 'provider_key_for_another_provider' &&
    provider &&
    keyProvider
  ) {
    return formatMessage(messages.errorProviderKeyForAnotherProvider, {
      provider,
      keyProvider,
    });
  }
  if (coded?.code === 'provider_key_has_spaces') {
    return formatMessage(messages.errorProviderKeyHasSpaces);
  }
  const prefix = field(coded?.prefix);
  if (coded?.code === 'provider_key_text_before' && prefix) {
    return formatMessage(messages.errorProviderKeyTextBefore, { prefix });
  }
  if (coded?.code === 'provider_key_repeated') {
    return formatMessage(messages.errorProviderKeyRepeated);
  }
  return parseAgentError(text).message;
};
