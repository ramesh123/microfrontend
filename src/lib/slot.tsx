import * as React from "react";

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
