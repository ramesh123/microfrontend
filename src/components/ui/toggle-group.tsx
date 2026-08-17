import * as React from "react";
import "@material/web/labs/segmentedbuttonset/outlined-segmented-button-set.js";
import "@material/web/labs/segmentedbutton/outlined-segmented-button.js";

// md-outlined-segmented-button-set is M3's real "toggle group" equivalent —
// same single/multi-select semantics, but it dispatches a hyphenated custom
// event (segmented-button-set-selection) that React's onXxx JSX convention
// can't address (React maps onFoo -> "foo", not arbitrary hyphenated names),
// so the set is wired up via addEventListener on a ref instead of a prop.
type ToggleGroupCtx = { type: "single" | "multiple"; value: string | string[]; toggle: (value: string) => void };
const ToggleGroupContext = React.createContext<ToggleGroupCtx | null>(null);

interface ToggleGroupProps extends Omit<React.HTMLAttributes<HTMLElement>, "value" | "defaultValue" | "onChange"> {
  type?: "single" | "multiple";
  value?: string | string[];
  defaultValue?: string | string[];
  onValueChange?: (value: string | string[]) => void;
}

const ToggleGroup = React.forwardRef<HTMLElement, ToggleGroupProps>(
  ({ type = "single", value, defaultValue, onValueChange, className, children, ...props }, forwardedRef) => {
    const innerRef = React.useRef<HTMLElement | null>(null);
    const [internal, setInternal] = React.useState(defaultValue ?? (type === "single" ? "" : []));
    const current = value !== undefined ? value : internal;

    const toggle = (itemValue: string) => {
      let next: string | string[];
      if (type === "single") {
        next = current === itemValue ? "" : itemValue;
      } else {
        const arr = Array.isArray(current) ? current : [];
        next = arr.includes(itemValue) ? arr.filter((v) => v !== itemValue) : [...arr, itemValue];
      }
      setInternal(next);
      onValueChange?.(next);
    };

    // The set's own selection event exists mainly to sync its internal
    // buttons' `selected` state — our items already derive `selected` from
    // context, so this listener only needs to exist to stop the set from
    // fighting a controlled `value` (it manages selection internally by
    // default); interaction itself is driven by each item's onClick below.
    React.useEffect(() => {
      const el = innerRef.current;
      if (!el) return;
      const handler = (e: Event) => e.stopPropagation();
      el.addEventListener("segmented-button-set-selection", handler);
      return () => el.removeEventListener("segmented-button-set-selection", handler);
    }, []);

    return (
      <ToggleGroupContext.Provider value={{ type, value: current, toggle }}>
        <md-outlined-segmented-button-set
          ref={(node: HTMLElement | null) => {
            innerRef.current = node;
            if (typeof forwardedRef === "function") forwardedRef(node);
            else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLElement | null>).current = node;
          }}
          data-slot="toggle-group"
          multiselect={type === "multiple"}
          className={className}
          {...props}
        >
          {children}
        </md-outlined-segmented-button-set>
      </ToggleGroupContext.Provider>
    );
  },
);
ToggleGroup.displayName = "ToggleGroup";

const ToggleGroupItem = React.forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement> & { value: string; disabled?: boolean }
>(({ className, children, value, ...props }, ref) => {
  const ctx = React.useContext(ToggleGroupContext);
  const selected = ctx ? (Array.isArray(ctx.value) ? ctx.value.includes(value) : ctx.value === value) : false;

  return (
    <md-outlined-segmented-button
      ref={ref}
      data-slot="toggle-group-item"
      className={className}
      selected={selected}
      onClick={() => ctx?.toggle(value)}
      {...props}
    >
      {children}
    </md-outlined-segmented-button>
  );
});
ToggleGroupItem.displayName = "ToggleGroupItem";

export { ToggleGroup, ToggleGroupItem };
