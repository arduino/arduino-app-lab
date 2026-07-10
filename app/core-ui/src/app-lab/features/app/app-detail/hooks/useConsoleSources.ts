import { ErrorData, MessageData } from '@cloud-editor-mono/infrastructure';
import {
  ConsoleLogValue,
  ConsoleSourceKey,
  ConsoleSources,
  UseConsoleSources,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { uniqueId } from 'lodash';
import { useCallback, useRef, useState } from 'react';
import { BehaviorSubject, Subject } from 'rxjs';

export const useConsoleSources: UseConsoleSources =
  function (): ReturnType<UseConsoleSources> {
    const consoleSources = useRef<Record<string, ConsoleSources>>({});
    const [consoleTabs, setConsoleTabs] = useState<
      Record<string, ConsoleSourceKey[]>
    >({});
    const [activeConsoleTab, setActiveConsoleTab] = useState<
      Record<string, ConsoleSourceKey | undefined>
    >({});

    const addConsoleSource = useCallback(
      (
        appId: string,
        key: keyof ConsoleSources,
        options?: {
          initialValue?: string;
          initialMeta?: Partial<ConsoleLogValue['meta']>;
        },
      ): void => {
        const { initialValue, initialMeta } = options || {};

        if (!consoleSources.current[appId]) {
          consoleSources.current[appId] = {};
        }

        if (!consoleSources.current[appId][key]) {
          const value = initialValue || '';

          consoleSources.current[appId][key] = {
            id: uniqueId(),
            subject: new BehaviorSubject<ConsoleLogValue>({
              value,
              meta: { id: key, ...initialMeta },
            }),
            resetSubject: new Subject<void>(),
          };

          setConsoleTabs((prev) => {
            const nextTabs = Object.keys(consoleSources.current[appId]);
            if (
              prev[appId] &&
              prev[appId].length === nextTabs.length &&
              prev[appId].every((v, i) => v === nextTabs[i])
            )
              return prev;
            return {
              ...prev,
              [appId]: nextTabs,
            };
          });
        }
      },
      [],
    );

    const appendDataToSource = useCallback(
      (
        appId: string,
        key: keyof ConsoleSources,
        data?: MessageData | ErrorData,
        createMissingKeys = false,
        meta?: Partial<ConsoleLogValue['meta']>,
      ): void => {
        const content = data?.message || '';
        const appSources = consoleSources.current[appId];

        if (!appSources || !appSources[key]) {
          return createMissingKeys
            ? addConsoleSource(appId, key, {
                initialValue: content,
                initialMeta: meta,
              })
            : undefined;
        }

        appSources[key].subject.next({
          value: content,
          meta: {
            id: key,
            ...meta,
          },
        });
      },
      [addConsoleSource],
    );

    const reset = useCallback((appId: string, keysToRetain: string[]): void => {
      const appSources = consoleSources.current[appId];
      if (!appSources) return;

      Object.keys(appSources).forEach((key) => {
        if (!keysToRetain.includes(key)) {
          delete appSources[key];
        }
      });

      setConsoleTabs((prev) => {
        const nextTabs = Object.keys(appSources);
        if (
          prev[appId] &&
          prev[appId].length === nextTabs.length &&
          prev[appId].every((v, i) => v === nextTabs[i])
        )
          return prev;
        return { ...prev, [appId]: nextTabs };
      });
      setActiveConsoleTab((prev) => {
        if (prev[appId] === undefined) return prev;
        return { ...prev, [appId]: undefined };
      });
    }, []);

    const resetAllSources = useCallback((appId?: string): void => {
      if (appId) {
        Object.values(consoleSources.current[appId] || {}).forEach((source) => {
          source.resetSubject?.next();
          source.style = undefined;
        });
      } else {
        Object.values(consoleSources.current).forEach((appSources) => {
          Object.values(appSources).forEach((source) => {
            source.resetSubject?.next();
            source.style = undefined;
          });
        });
      }
    }, []);

    const setTabForApp = useCallback(
      (appId: string, tab: ConsoleSourceKey | undefined) => {
        setActiveConsoleTab((prev) => {
          if (prev[appId] === tab) return prev;
          return { ...prev, [appId]: tab };
        });
      },
      [],
    );

    const setStyleToSource = useCallback(
      (
        appId: string,
        tab: ConsoleSourceKey | undefined,
        style?: string,
      ): void => {
        if (!tab) return;
        const source = consoleSources.current[appId]?.[tab];
        if (source) {
          source.style = style;
        }
      },
      [],
    );

    return {
      resetAllSources,
      consoleSources: consoleSources.current,
      consoleTabs,
      activeConsoleTab,
      setActiveConsoleTab: setTabForApp,
      addConsoleSource,
      appendDataToSource,
      setStyleToSource,
      reset,
    };
  };
