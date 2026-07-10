import { getCSSVariable, setCSSVariable } from '@cloud-editor-mono/common';
import * as ContextMenu from '@radix-ui/react-context-menu';
import clsx from 'clsx';
import { useEffect, useMemo, useRef } from 'react';

import { KeywordMap } from '../code-mirror';
import {
  ViewInstances,
  viewInstances,
} from '../code-mirror/codeMirrorViewInstances';
import { FileExt } from '../code-mirror/extensions/language/setup';
import { contextMenuSections } from '../context-menu/contextMenuSpec';
import { useI18n } from '../i18n/useI18n';
import { Skeleton } from '../skeleton';
import styles from './code-editor.module.scss';
import styleVars from './code-editor-variables.module.scss';
import { CodeEditorLogic } from './codeEditor.type';
import CodeEditorElement from './CodeEditorElement';
import { useContextMenu } from './hooks/useContextMenu';

const skeletonChildren = Number(styleVars.skeletonChildren);

interface CodeEditorProps {
  codeEditorLogic: CodeEditorLogic;
  getKeywords: () => KeywordMap | undefined;
  readOnlyBanner?: JSX.Element;
  viewInstanceId?: ViewInstances;
  classes?: {
    container?: string;
  };
}

const CodeEditor: React.FC<CodeEditorProps> = (props: CodeEditorProps) => {
  const {
    codeEditorLogic,
    getKeywords,
    readOnlyBanner: readOnlyBannerContents,
    viewInstanceId = ViewInstances.Editor,
    classes,
  } = props;
  const {
    getCode,
    getCodeExt,
    getCodeInstanceId,
    getCodeLastInjectionLine,
    getFileId,
    setCode,
    sketchDataIsLoading,
    codeInstanceIds,
    errorLines,
    highlightLines,
    onReceiveViewInstance,
    fontSize,
    readOnly,
    showReadOnlyBanner,
    gutter,
    hasHeader = true,
    useScrollPastEnd = false,
  } = codeEditorLogic();
  const code = getCode && getCode();

  useEffect(() => {
    if (
      fontSize &&
      fontSize !== Number(getCSSVariable(styleVars.editorFontSize))
    ) {
      setCSSVariable(styleVars.editorFontSize, `${fontSize}`);
    }
  }, [fontSize]);

  const readOnlyBannerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (
      showReadOnlyBanner &&
      readOnlyBannerContents &&
      readOnlyBannerRef.current
    ) {
      setCSSVariable(
        styleVars.editorPaddingBottom,
        (readOnlyBannerRef.current.offsetHeight + 32).toString(),
      );
    }
    return () => {
      setCSSVariable(styleVars.editorPaddingBottom, '90');
    };
  }, [showReadOnlyBanner, readOnlyBannerContents]);

  const sortedHighlightLines = useMemo(() => {
    return highlightLines?.sort();
  }, [highlightLines]);

  const sortedErrorLines = useMemo(() => {
    return errorLines?.sort();
  }, [errorLines]);

  const gutterWithFontSize = useMemo(() => {
    return gutter && { ...gutter, fontSize };
  }, [fontSize, gutter]);

  const { containerRef, clickHandlers, disabledKeys, setIsOpen } =
    useContextMenu(viewInstances[viewInstanceId].instance, setCode, code);

  const { formatMessage } = useI18n();

  const keywords = getKeywords();

  const codeInstanceId = getCodeInstanceId && getCodeInstanceId();

  return typeof code !== 'undefined' &&
    typeof codeInstanceId !== 'undefined' &&
    !sketchDataIsLoading ? (
    <div
      ref={containerRef}
      className={clsx(styles['code-editor'], classes?.container)}
    >
      <ContextMenu.Root onOpenChange={setIsOpen}>
        <ContextMenu.Trigger asChild disabled={readOnly}>
          <div className={styles['context-menu-trigger']}>
            <CodeEditorElement
              viewInstanceId={viewInstanceId}
              valueInstanceIds={codeInstanceIds}
              getValueInstanceId={getCodeInstanceId}
              getValue={getCode}
              getExt={getCodeExt}
              getCodeLastInjectionLine={getCodeLastInjectionLine}
              getFileId={getFileId}
              onChange={setCode}
              // ** if the two below are not sorted highlighting will not work
              // ** given we rely on codemirror "ranges"
              errorLines={sortedErrorLines}
              highlightLines={sortedHighlightLines}
              keywords={keywords}
              keywordsExt={FileExt.Ino}
              onReceiveViewInstance={onReceiveViewInstance}
              readOnly={readOnly}
              gutter={gutterWithFontSize}
              hasHeader={hasHeader}
              useScrollPastEnd={useScrollPastEnd}
              classes={{ container: styles['code-editor-element'] }}
            />
          </div>
        </ContextMenu.Trigger>
        {!readOnly ? (
          <ContextMenu.Portal>
            <ContextMenu.Content className={styles['context-menu']}>
              {contextMenuSections.map((section, sectionIndex) => (
                <ContextMenu.Group key={section.name}>
                  {sectionIndex > 0 && (
                    <ContextMenu.Separator
                      className={styles['context-menu-separator']}
                    />
                  )}
                  {section.items.map((item) => {
                    const label =
                      typeof item.label === 'string'
                        ? item.label
                        : formatMessage(item.label);
                    return (
                      <ContextMenu.Item
                        key={item.id}
                        className={styles['context-menu-item']}
                        disabled={disabledKeys.includes(item.id)}
                        onSelect={(): void => clickHandlers[item.id]()}
                      >
                        {label}
                        <kbd>{item.shortcut}</kbd>
                      </ContextMenu.Item>
                    );
                  })}
                </ContextMenu.Group>
              ))}
            </ContextMenu.Content>
          </ContextMenu.Portal>
        ) : null}
      </ContextMenu.Root>
      {showReadOnlyBanner && readOnlyBannerContents && (
        <div className={styles['code-editor-banner']} ref={readOnlyBannerRef}>
          {readOnlyBannerContents}
        </div>
      )}
    </div>
  ) : (
    <div className={clsx(styles['code-editor-skeleton'])}>
      <Skeleton variant="rounded" count={skeletonChildren} />
    </div>
  );
};

export default CodeEditor;
