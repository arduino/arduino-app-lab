import { getCSSVariable, setCSSVariable } from '@cloud-editor-mono/common';
import clsx from 'clsx';
import { ReactElement, useEffect, useMemo, useRef } from 'react';
import { Item, Section } from 'react-stately';

import { KeywordMap } from '../code-mirror';
import {
  ViewInstances,
  viewInstances,
} from '../code-mirror/codeMirrorViewInstances';
import { FileExt } from '../code-mirror/extensions/language/setup';
import ContextMenu from '../context-menu/ContextMenu';
import {
  ContextMenuItemIds,
  ContextMenuItemType,
} from '../context-menu/contextMenu.type';
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
  classes?: {
    container?: string;
  };
}

const CodeEditor: React.FC<CodeEditorProps> = (props: CodeEditorProps) => {
  const {
    codeEditorLogic,
    getKeywords,
    readOnlyBanner: readOnlyBannerContents,
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
    hasTabs = true,
  } = codeEditorLogic();
  const code = getCode && getCode();

  useEffect(() => {
    if (fontSize !== Number(getCSSVariable(styleVars.editorFontSize))) {
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
        readOnlyBannerRef.current.offsetHeight.toString(),
      );
    }
    return () => {
      setCSSVariable(styleVars.editorPaddingBottom, '0');
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

  const {
    clickPosition,
    containerRef,
    menuRef,
    menuProps,
    clickHandlers,
    disabledKeys,
    state,
  } = useContextMenu(
    viewInstances[ViewInstances.Editor].instance,
    setCode,
    code,
  );

  const { formatMessage } = useI18n();

  const keywords = getKeywords();

  const codeInstanceId = getCodeInstanceId && getCodeInstanceId();

  return typeof code !== 'undefined' &&
    typeof codeInstanceId !== 'undefined' &&
    !sketchDataIsLoading ? (
    <div
      ref={containerRef}
      className={clsx(styles['code-editor'], classes?.container, {
        [styles['container-without-gutter']]: !gutter,
        [styles['code-editor-with-tabs-bar']]: hasTabs,
      })}
    >
      <CodeEditorElement
        viewInstanceId={ViewInstances.Editor}
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
        classes={{
          container: styles.container,
        }}
      />
      {state.isOpen && !readOnly ? (
        <div ref={menuRef}>
          <ContextMenu
            {...menuProps}
            clickPosX={clickPosition?.clickPosX}
            clickPosY={clickPosition?.clickPosY}
            onAction={(key): void => clickHandlers[key as ContextMenuItemIds]()}
            disabledKeys={disabledKeys}
          >
            {contextMenuSections.map((section) => (
              <Section key={section.name} items={section.items}>
                {(item: ContextMenuItemType): ReactElement => {
                  const label =
                    typeof item.label === 'string'
                      ? item.label
                      : formatMessage(item.label);
                  return (
                    <Item key={item.id} textValue={label}>
                      {label}
                      <kbd>{item.shortcut}</kbd>
                    </Item>
                  );
                }}
              </Section>
            ))}
          </ContextMenu>
        </div>
      ) : null}
      {showReadOnlyBanner && readOnlyBannerContents && (
        <div className={styles['read-only-banner']} ref={readOnlyBannerRef}>
          {readOnlyBannerContents}
        </div>
      )}
    </div>
  ) : (
    <div
      className={clsx(styles['code-editor-skeleton'], {
        [styles['code-editor-skeleton-with-tabs-bar']]: hasTabs,
      })}
    >
      <Skeleton variant="rounded" count={skeletonChildren} />
    </div>
  );
};

export default CodeEditor;
