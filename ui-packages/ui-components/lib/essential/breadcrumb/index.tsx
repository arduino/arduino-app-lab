// ----------------------------------------------------------------------
// IMPORTED FILE
//
// This code was imported from a external library to handle private
// dependencies required for the main application to run.
// ----------------------------------------------------------------------

import { IconNavigationArrowChevronNormalRight } from '@arduino/react-icons';
import { Slot } from '@radix-ui/react-slot';
import clsx from 'clsx';
import type React from 'react';
import type { ComponentProps, ComponentPropsWithRef, ReactNode } from 'react';
import { createContext, forwardRef, useContext, useRef } from 'react';

import { useMergeRefs } from '../../common/hooks/useMergeRefs';
import { NestedSlottable } from '../../common/utils/nestedSlottable';
import { Small, XSmall, XXSmall } from '../../typography';
import styles from './index.module.scss';

/*
 * =============================================================================
 * BreadcrumbItem
 * =============================================================================
 */

const breadcrumbItemStyle = styles.BreadcrumbItem;

// actually in breadcrumb items, size are "scaled down" one time, so that xs is actually xxs, etc
const fontMap = {
  xs: XXSmall,
  sm: XSmall,
  md: Small,
};

export const BreadcrumbItem = forwardRef<
  HTMLButtonElement,
  ComponentProps<'button'> & {
    icon?: React.ReactNode;
    asChild?: boolean;
  }
>(function BreadcrumbItem(
  { className, icon, children, asChild = false, ...rest },
  ref,
) {
  const { size } = useBreadcrumbsContext();

  const Comp = asChild ? Slot : 'button';
  const Typography = fontMap[size] || Small;

  return (
    <Comp className={clsx(breadcrumbItemStyle, className)} {...rest} ref={ref}>
      <NestedSlottable child={children} asChild={asChild}>
        {(child): ReactNode => (
          <>
            {icon ? (
              <div className={styles['BreadcrumbItem-icon']}>{icon}</div>
            ) : null}
            <Typography truncate>{child}</Typography>
            {/* {variant === 'trigger' ? (
              <div className={styles['BreadcrumbItem-icon']}>
                <IconNavigationArrowCaretNormalDown
                  className={styles['BreadcrumbItem__trigger-caret']}
                />
              </div>
            ) : null} */}
          </>
        )}
      </NestedSlottable>
    </Comp>
  );
});

/*
 * =============================================================================
 * BreadcrumbItem
 * =============================================================================
 */

export const BreadcrumbItemInput = forwardRef<
  HTMLButtonElement,
  Omit<ComponentProps<typeof BreadcrumbItem>, 'children'> & {
    inputProps: ComponentPropsWithRef<'input'>;
  }
>(function BreadcrumbItemInput(
  { inputProps, onClick, className, ...rest },
  ref,
) {
  const { ref: inputRef, onKeyDown, ...inputPropsRest } = inputProps || {};

  const innerInputRef = useRef<HTMLInputElement>(null);
  const mergedRefs = useMergeRefs([innerInputRef, inputRef]);
  return (
    <BreadcrumbItem
      className={clsx(styles.BreadcrumbItemInput, className)}
      onClick={(e): void => {
        e.preventDefault();
        innerInputRef.current?.focus();
        onClick?.(e);
      }}
      {...rest}
      ref={ref}
    >
      <div className={styles['BreadcrumbItemInput--input']}>
        <input
          ref={mergedRefs}
          {...inputPropsRest}
          onInput={(e): void => {
            // Set data-value to parent
            // See: https://css-tricks.com/auto-growing-inputs-textareas/#aa-other-ideas
            e.currentTarget.parentElement?.setAttribute(
              'data-value',
              e.currentTarget.value,
            );
          }}
          onKeyDown={(e): void => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
              e.currentTarget.blur();
            }
            onKeyDown?.(e);
          }}
        />
      </div>
    </BreadcrumbItem>
  );
});

/*
 * =============================================================================
 * BreadcrumbSeparator
 * =============================================================================
 */

export const BreadcrumbSeparator = forwardRef<
  HTMLDivElement,
  ComponentProps<'div'>
>(function BreadcrumbSeparator({ className, children, ...rest }, ref) {
  return (
    <div
      aria-hidden
      ref={ref}
      className={clsx(styles.BreadcrumbSeparator, className)}
      {...rest}
    >
      {children ?? <IconNavigationArrowChevronNormalRight />}
    </div>
  );
});

/*
 * =============================================================================
 * Breadcrumbs
 * =============================================================================
 */

type BreadcrumbsContextType = {
  /**
   * The size of the BreadcrumbItems.
   * @default md
   */
  size: 'xs' | 'sm' | 'md';
};
const BreadcrumbsContext = createContext<BreadcrumbsContextType>({
  size: 'md',
});

function useBreadcrumbsContext(): BreadcrumbsContextType {
  const context = useContext(BreadcrumbsContext);

  if (!context) {
    throw new Error(
      'Breadcrumb components must be rendered within a Breadcrumbs component',
    );
  }
  return context;
}

export const Breadcrumbs = forwardRef<
  HTMLDivElement,
  ComponentProps<'nav'> & BreadcrumbsContextType
>(function Breadcrumbs({ className, children, size, ...rest }, ref) {
  return (
    <BreadcrumbsContext.Provider value={{ size }}>
      <nav
        aria-label="breadcrumbs"
        className={clsx(styles.Breadcrumbs, className)}
        {...rest}
        ref={ref}
      >
        {children}
      </nav>
    </BreadcrumbsContext.Provider>
  );
});
