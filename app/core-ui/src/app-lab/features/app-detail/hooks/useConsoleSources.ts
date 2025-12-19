import { ErrorData, MessageData } from '@cloud-editor-mono/infrastructure';
import {
  ConsoleLogValue,
  ConsoleSources,
  UseConsoleSources,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { uniqueId } from 'lodash';
import { useCallback, useRef, useState } from 'react';
import { BehaviorSubject, Subject } from 'rxjs';

let consoleSourcesResetSubjectInstance: Subject<void> | null = null;
const createConsoleSourcesResetSubject = (): Subject<void> => {
  if (!consoleSourcesResetSubjectInstance) {
    consoleSourcesResetSubjectInstance = new Subject<void>();
  }
  return consoleSourcesResetSubjectInstance;
};

export const useConsoleSources: UseConsoleSources =
  function (): ReturnType<UseConsoleSources> {
    const consoleSources = useRef<ConsoleSources>({});

    const [consoleTabs, setConsoleTabs] = useState<string[]>([]);
    const [activeConsoleTab, setActiveConsoleTab] = useState<
      string | undefined
    >(consoleTabs[0]);

    // To track which appId created/owns the current console sources
    const [consoleSourcesOwner, setConsoleSourcesOwner] = useState<
      string | undefined
    >();

    const consoleSourcesResetSubject = createConsoleSourcesResetSubject();

    const addConsoleSource = useCallback(
      (
        key: keyof ConsoleSources,
        options?: {
          sourcesOwnerAppId?: string;
          initialValue?: string;
          initialMeta?: Partial<ConsoleLogValue['meta']>;
        },
      ): void => {
        const { sourcesOwnerAppId, initialValue, initialMeta } = options || {};

        if (!consoleSources.current[key]) {
          const value = initialValue || '';

          consoleSources.current[key] = {
            id: uniqueId(),
            subject: new BehaviorSubject<ConsoleLogValue>({
              value,
              meta: { id: key, ...initialMeta },
            }),
          };

          setConsoleTabs(Object.keys(consoleSources.current));
          if (sourcesOwnerAppId) {
            setConsoleSourcesOwner(sourcesOwnerAppId);
          }
        }
      },
      [],
    );

    const appendDataToSource = useCallback(
      (
        key: keyof ConsoleSources,
        data?: MessageData | ErrorData,
        createMissingKeys = false,
        meta?: Partial<ConsoleLogValue['meta']>,
      ): void => {
        const content = data?.message || '';

        if (!consoleSources.current[key]) {
          return createMissingKeys
            ? addConsoleSource(key, {
                initialValue: content,
                initialMeta: meta,
              })
            : undefined;
        }

        consoleSources.current[key].subject.next({
          value: content,
          meta: {
            id: key,
            ...meta,
          },
        });
      },
      [addConsoleSource],
    );

    const reset = useCallback((keysToRetain: string[]): void => {
      Object.keys(consoleSources.current).forEach((key) => {
        if (!keysToRetain.includes(key)) {
          delete consoleSources.current[key];
        }
      });

      setConsoleTabs(Object.keys(consoleSources.current));
      setActiveConsoleTab(undefined);

      if (keysToRetain.length === 0) {
        setConsoleSourcesOwner(undefined);
      }
    }, []);

    return {
      consoleSourcesOwner,
      consoleSources: consoleSources.current,
      consoleSourcesResetSubject,
      consoleTabs,
      activeConsoleTab,
      setActiveConsoleTab,
      addConsoleSource,
      appendDataToSource,
      reset,
    };
  };
