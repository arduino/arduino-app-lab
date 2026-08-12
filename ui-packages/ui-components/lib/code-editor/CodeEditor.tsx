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
import { useI18n } from '../i18n/useI18n';
import { Skeleton } from '../skeleton';
import styles from './code-editor.module.scss';
import styleVars from './code-editor-variables.module.scss';
import { CodeEditorLogic, EditorBannerKind } from './codeEditor.type';
import CodeEditorElement from './CodeEditorElement';
import { useContextMenu } from './hooks/useContextMenu';

const skeletonChildren = Number(styleVars.skeletonChildren);

interface CodeEditorProps {
  codeEditorLogic: CodeEditorLogic;
  getKeywords: () => KeywordMap | undefined;
  /** Contents for a `banner` kind. Return undefined to render nothing. */
  renderBanner?: (kind: EditorBannerKind) => JSX.Element | undefined;
  viewInstanceId?: ViewInstances;
  classes?: {
    container?: string;
  };
  onFileError?: (error: Error) => void;
}

const CodeEditor: React.FC<CodeEditorProps> = (props: CodeEditorProps) => {
  const {
    codeEditorLogic,
    getKeywords,
    renderBanner,
    viewInstanceId = ViewInstances.Editor,
    classes,
    onFileError,
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
    banner,
    gutter,
    hasHeader = true,
    useScrollPastEnd = false,
    fileError,
    lspWorkspaceDir,
    isLspEnabled,
    selectFile,
    lspClients,
    filesList,
    startLSP,
    sendLspMessage,
    subscribeLspMessages,
    getLspWorkspaceFile,
    setLspFileValue,
    ensureLspFileValue,
    getActivePane,
    onLspStateChange,
  } = codeEditorLogic();
  const code = getCode?.();

  useEffect(() => {
    if (
      fontSize &&
      fontSize !== Number(getCSSVariable(styleVars.editorFontSize))
    ) {
      setCSSVariable(styleVars.editorFontSize, `${fontSize}`);
    }
  }, [fontSize]);

  const bannerRef = useRef<HTMLDivElement | null>(null);
  const bannerContents = banner ? renderBanner?.(banner) : undefined;

  useEffect(() => {
    if (bannerContents && bannerRef.current) {
      setCSSVariable(
        styleVars.editorPaddingBottom,
        (bannerRef.current.offsetHeight + 32).toString(),
      );
    }
    return () => {
      setCSSVariable(styleVars.editorPaddingBottom, '90');
    };
  }, [bannerContents]);

  useEffect(() => {
    if (fileError) {
      onFileError?.(fileError);
    }
  }, [fileError, onFileError]);

  const sortedHighlightLines = useMemo(() => {
    return highlightLines?.sort();
  }, [highlightLines]);

  const sortedErrorLines = useMemo(() => {
    return errorLines?.sort();
  }, [errorLines]);

  const gutterWithFontSize = useMemo(() => {
    return gutter && { ...gutter, fontSize };
  }, [fontSize, gutter]);

  const {
    containerRef,
    clickHandlers,
    disabledKeys,
    sections: contextMenuSections,
    setIsOpen,
  } = useContextMenu(
    viewInstances[viewInstanceId].instance,
    setCode,
    code,
    isLspEnabled,
    lspClients,
    getCodeExt?.(),
    readOnly,
  );

  const { formatMessage } = useI18n();

  const keywords = getKeywords();

  const codeInstanceId = getCodeInstanceId?.();

  return typeof code !== 'undefined' &&
    typeof codeInstanceId !== 'undefined' &&
    !sketchDataIsLoading &&
    !fileError ? (
    <div
      ref={containerRef}
      className={clsx(styles['code-editor'], classes?.container)}
    >
      <ContextMenu.Root onOpenChange={setIsOpen}>
        <ContextMenu.Trigger asChild>
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
              lspWorkspaceDir={lspWorkspaceDir}
              isLspEnabled={isLspEnabled}
              lspClients={lspClients}
              filesList={filesList}
              selectFile={selectFile}
              startLSP={startLSP}
              sendLspMessage={sendLspMessage}
              subscribeLspMessages={subscribeLspMessages}
              getLspWorkspaceFile={getLspWorkspaceFile}
              setLspFileValue={setLspFileValue}
              ensureLspFileValue={ensureLspFileValue}
              getActivePane={getActivePane}
              onLspStateChange={onLspStateChange}
            />
          </div>
        </ContextMenu.Trigger>
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
      </ContextMenu.Root>
      {bannerContents && (
        <div className={styles['code-editor-banner']} ref={bannerRef}>
          {bannerContents}
        </div>
      )}
    </div>
  ) : fileError ? null : (
    <div className={clsx(styles['code-editor-skeleton'])}>
      <Skeleton variant="rounded" count={skeletonChildren} />
    </div>
  );
};

export default CodeEditor;
