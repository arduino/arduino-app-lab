import {
  type AgentWorkspace,
  onTurnEnded,
} from '@cloud-editor-mono/ai-assistant';
import { getApps } from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import { useI18n } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import { BoardScopedQuery } from '../boardScopedQuery';
import { useBoardLifecycleStore } from '../store/boardLifecycle';
import { messages } from './messages';

// The workspaces a new agent session can open in; same query key the runtime provider keeps warm, and examples get their own scoped panel later.
export const useAgentWorkspaces = (enabled: boolean): AgentWorkspace[] => {
  const { formatMessage } = useI18n();
  // Gated like every other consumer of this key: an always-on observer would re-render the layout on every app SSE event while the user is in the editor.
  const boardIsReachable = useBoardLifecycleStore(
    (state) => state.boardIsReachable,
  );
  const { data: apps } = useQuery({
    queryKey: [BoardScopedQuery.LIST_MY_APPS],
    queryFn: () => getApps({ query: {} }),
    enabled: enabled && boardIsReachable,
  });

  // A turn can create an app; only this list, not every app's own detail, is read again.
  const queryClient = useQueryClient();
  useEffect(
    () =>
      onTurnEnded(() => {
        void queryClient.invalidateQueries({
          queryKey: [BoardScopedQuery.LIST_MY_APPS],
          exact: true,
        });
      }),
    [queryClient],
  );

  return useMemo(
    () => [
      // The general workspace: no app id, the agent sees the whole board — what every session did before this existed.
      { id: '', name: formatMessage(messages.generalWorkspace), icon: '📁' },
      ...(apps ?? [])
        // Examples and releases are read-only: no agent work can land in them.
        .filter((app) => app.id && !app.example && !app.release)
        .map((app) => ({
          id: app.id as string,
          name: app.name || (app.id as string),
          icon: app.icon,
        })),
    ],
    [apps, formatMessage],
  );
};
