import * as React from "react";

/**
 * Drop-in replacement for @radix-ui/react-slot's Slot component. Used for
 * the `asChild` pattern throughout container/ui components — merges the
 * props passed to <Slot> onto its single child instead of rendering its
 * own wrapper element (e.g. `<Button asChild><Link>...</Link></Button>`
 * renders as an `<a>`, not a `<button><a>...</a></button>`).
 *
 * MUI has no equivalent utility (this is a Radix-specific concept), so
 * this reproduces just the merging behavior actually used in this codebase:
 * composed refs, concatenated className, merged style, and chained event
 * handlers — without pulling in the rest of Radix's Slot machinery.
 */
function composeRefs<T>(...refs: Array<React.Ref<T> | undefined>) {
  return (node: T | null) => {
    refs.forEach((ref) => {
      if (!ref) return;
      if (typeof ref === "function") ref(node);
      else (ref as React.MutableRefObject<T | null>).current = node;
    });
  };
}

type SlotProps = React.HTMLAttributes<HTMLElement> & {
  children?: React.ReactNode;
  [key: string]: unknown;
};

export const Slot = React.forwardRef<HTMLElement, SlotProps>(({ children, ...slotProps }, forwardedRef) => {
  if (!React.isValidElement(children)) {
    return null;
  }

  const child = children as React.ReactElement<Record<string, unknown>> & { ref?: React.Ref<HTMLElement> };
  const childProps = child.props ?? {};
  const merged: Record<string, unknown> = { ...slotProps, ...childProps };

  if (slotProps.className || (childProps.className as string | undefined)) {
    merged.className = [slotProps.className, childProps.className].filter(Boolean).join(" ");
  }
  if (slotProps.style || childProps.style) {
    merged.style = { ...(slotProps.style as object), ...(childProps.style as object) };
  }

  for (const key of Object.keys(slotProps)) {
    if (key.startsWith("on") && typeof slotProps[key as keyof typeof slotProps] === "function") {
      const slotHandler = slotProps[key as keyof typeof slotProps] as (...args: unknown[]) => void;
      const childHandler = childProps[key] as ((...args: unknown[]) => void) | undefined;
      merged[key] = (...args: unknown[]) => {
        slotHandler(...args);
        childHandler?.(...args);
      };
    }
  }

  return React.cloneElement(child, {
    ...merged,
    ref: forwardedRef ? composeRefs(forwardedRef, child.ref) : child.ref,
  });
});
Slot.displayName = "Slot";
