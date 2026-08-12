import {
  Claude,
  Codex,
  OpenCode,
} from '@cloud-editor-mono/images/assets/icons';
import {
  TextSize,
  useI18n,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

import { messages } from '../../messages';
import { type AgentDescriptor, type AgentId } from '../../services';
import { Text } from '../Text/Text';
import styles from './agent-card.module.scss';

// Brand glyph per agent; falls back to the name initial when absent.
const AGENT_ICONS: Partial<Record<AgentId, React.FC>> = {
  claude: Claude,
  codex: Codex,
  opencode: OpenCode,
};

export type AgentCardBadge = {
  label: string;
  kind?: 'connected' | 'coming-soon' | 'preview';
};

type AgentCardProps = {
  agent: AgentDescriptor;
  // Status pills to show after the descriptor's own ones (e.g. "CONNECTED").
  badges?: AgentCardBadge[];
  // Secondary line under the name: the description, or a status line.
  subtitle?: React.ReactNode;
  // Trailing action slot (Install/Connect/Manage… — owned by the consumer).
  action?: React.ReactNode;
  // When true, renders `children` in the expandable body below the head.
  expanded?: boolean;
  children?: React.ReactNode;
};

// Presentational shell shared by the Connect panel and the Settings "Agent"
// section: logo + name + badge + subtitle + action, with an expandable body.
// All state (expansion, actions) is owned by the consumer.
export const AgentCard: React.FC<AgentCardProps> = ({
  agent,
  badges,
  subtitle,
  action,
  expanded,
  children,
}) => {
  const { formatMessage } = useI18n();
  const Logo = AGENT_ICONS[agent.id];

  // Availability is a property of the agent itself, so the card owns those
  // pills; consumers only add status ones (they render after these).
  const allBadges: AgentCardBadge[] = [
    ...(agent.preview
      ? [{ label: formatMessage(messages.preview), kind: 'preview' as const }]
      : []),
    ...(agent.comingSoon
      ? [
          {
            label: formatMessage(messages.comingSoon),
            kind: 'coming-soon' as const,
          },
        ]
      : []),
    ...(badges ?? []),
  ];

  return (
    <div className={styles['agent']}>
      <div className={styles['agent-head']}>
        <span className={styles['agent-logo']} aria-hidden="true">
          {Logo ? <Logo /> : agent.name.charAt(0)}
        </span>
        <span className={styles['agent-text']}>
          <span className={styles['agent-name-row']}>
            <Text size={TextSize.XSmall} bold className={styles['agent-name']}>
              {agent.name}
            </Text>
            {allBadges.map((badge) => (
              <Text
                key={badge.label}
                size={TextSize.XSmall}
                className={[
                  styles['agent-badge'],
                  badge.kind && styles[`agent-badge--${badge.kind}`],
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {badge.label}
              </Text>
            ))}
          </span>
          {subtitle !== undefined && (
            <Text size={TextSize.XXSmall} className={styles['agent-desc']}>
              {subtitle}
            </Text>
          )}
        </span>
        {action}
      </div>

      {expanded && <div className={styles['agent-body']}>{children}</div>}
    </div>
  );
};

export default AgentCard;
