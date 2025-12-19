// ----------------------------------------------------------------------
// IMPORTED FILE
//
// This code was imported from a external library to handle private
// dependencies required for the main application to run.
// ----------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
import type { DOMAttributes } from 'react';
import { cloneElement, forwardRef, isValidElement } from 'react';

/**
 * Allow nested slottables, must be used in combination with Radix's Slot component.
 *
 * Inspired by: https://github.com/radix-ui/primitives/issues/1825
 */
// ! TODO: Figure out Comp -> child props merge improvements (i.e `classnames` prop)
// TODO: https://github.com/radix-ui/primitives/blob/main/packages/react/slot/src/Slot.tsx#L60

export const NestedSlottable = forwardRef<
  HTMLElement,
  {
    asChild: boolean;
    child: React.ReactNode;
    children: (child: React.ReactNode) => React.ReactNode;
  }
>(function NestedSlottable({ asChild, child, children, ...props }, ref): any {
  // eslint-disable-next-line no-nested-ternary
  return asChild
    ? isValidElement(child)
      ? // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        cloneElement(
          child,
          { ...props, ref } as DOMAttributes<Element>,
          children(child.props.children),
        )
      : null
    : children(child);
});
