import { NavigationGroup } from '@cloud-editor-mono/images/assets/icons';
import React from 'react';

import { useI18n } from '../../../i18n/useI18n';
import { EmptyState } from '../empty-state';
import { ExamplesSection } from '../examples-section';
import { TableIcon } from '../examples-section/subcomponents/TableIcon';
import { ExamplesProps } from './examples.type';
import { messages } from './messages';

export const Examples: React.FC<ExamplesProps> = ({
  examplesLogic,
}: ExamplesProps) => {
  const { formatMessage } = useI18n();
  const { sections, isLoading, onSelectExample } = examplesLogic();

  if (!isLoading && sections.length === 0) {
    return (
      <EmptyState
        icon={<NavigationGroup />}
        title={formatMessage(messages.emptyTitle)}
        description={formatMessage(messages.emptyDescription)}
      />
    );
  }

  return (
    <>
      {sections.map((section) => (
        <ExamplesSection key={section.id}>
          <ExamplesSection.Header
            title={section.title}
            description={section.description}
            badge={
              <ExamplesSection.CountBadge
                label={formatMessage(messages.examplesCount, {
                  count: section.count,
                })}
              />
            }
          />
          {section.tables.map((table) => (
            <ExamplesSection.Table
              key={table.id}
              title={table.title}
              count={table.count}
              icon={<TableIcon icon={table.icon} />}
            >
              {table.rows.map((row) => (
                <ExamplesSection.Row
                  key={row.id}
                  title={row.title}
                  description={row.description}
                  onSelect={(): void => onSelectExample(row.id)}
                />
              ))}
            </ExamplesSection.Table>
          ))}
        </ExamplesSection>
      ))}
    </>
  );
};
