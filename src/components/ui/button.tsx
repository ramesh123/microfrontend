import { Slot } from "@/lib/slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

// Registers the custom elements used below. @material/web has no React
// bindings — importing a component module's side effects is what defines
// e.g. `<md-filled-button>` as a real DOM element (see
// node_modules/@material/web/button/filled-button.js); JSX typing for these
// tags comes from src/types/material-web.d.ts, since @material/web only
// augments the DOM-level HTMLElementTagNameMap, not JSX.IntrinsicElements.
import "@material/web/button/filled-button.js";
import "@material/web/button/filled-tonal-button.js";
import "@material/web/button/outlined-button.js";
import "@material/web/button/text-button.js";
import "@material/web/iconbutton/icon-button.js";
import "@material/web/progress/circular-progress.js";

// Kept for the asChild/unstyled path below — a Web Component can't render
// "as" an arbitrary child element the way Radix's Slot expects, so that path
// keeps the original Tailwind-classed rendering instead of a Material Web tag.
const buttonVariants = cva(
  "cursor-pointer noflow nopan nodelete nodrag inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground  hover:bg-primary-hover",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
outline:
  "border bg-background text-secondary-foreground hover:shadow-sm",
  outliner: "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",

        outlineAmber:
          "border border-accent-amber-foreground hover:bg-accent-amber",
        primary:
          "border bg-background text-secondary-foreground shadow-sm hover:shadow-sm",
          accent:
          "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 hover:opacity-95 transform hover:-translate-y-px",
          success:
          "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md shadow-green-500/20 hover:shadow-lg hover:shadow-green-500/30 hover:opacity-95 transform hover:-translate-y-px",
          info:
          "bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 hover:opacity-95 transform hover:-translate-y-px",
          warning:
          "bg-gradient-to-r from-orange-500 to-yellow-500 text-white shadow-md shadow-orange-500/20 hover:shadow-lg hover:shadow-orange-500/30 hover:opacity-95 transform hover:-translate-y-px",
        secondary:
          "border border-muted bg-muted text-secondary-foreground hover:bg-secondary-foreground/5",
        danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
        ghost:
          "text-foreground hover:bg-accent hover:text-accent-foreground disabled:!bg-transparent",
        ghostActive:
          "bg-muted text-foreground hover:bg-secondary-hover hover:text-accent-foreground",
        menu: "hover:bg-muted hover:text-accent-foreground focus:!ring-0 focus-visible:!ring-0",
        "menu-active":
          "font-semibold hover:bg-muted hover:text-accent-foreground focus-visible:!ring-offset-0",
        link: "underline-offset-4 hover:underline text-primary",
        theme:"!h-8 !w-8 shrink-0 rounded-sm bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
        disable:"!h-8 !w-8 shrink-0 rounded-sm bg-primary/40 text-white hover:bg-primary/40 hover:text-white"
      },
      size: {
        default: "h-9 py-2 px-4",
        md: "h-7 py-1.5 px-3",
        sm: "h-8 px-3 rounded-md",
        xs: "py-0.5 px-3 rounded-md",
        lg: "h-10 px-8 rounded-md",
        iconMd: "p-1.5 rounded-md",
        icon: "p-1 rounded-md",
        iconSm: "p-0.5 rounded-md",
        "node-toolbar": "py-[5px] px-[5px] rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  unstyled?: boolean;
  ignoreTitleCase?: boolean;
}

function toTitleCase(text: string) {
  return text
    ?.split(" ")
    ?.map(
      (word) => word?.charAt(0)?.toUpperCase() + word?.slice(1)?.toLowerCase(),
    )
    ?.join(" ");
}

// --- Material Web variant/size mapping ---------------------------------
// M3's button family has 5 emphasis levels (filled, filled-tonal, outlined,
// text, elevated — elevated unused here, it's meant for buttons sitting on
// top of already-colored surfaces) plus a separate icon-button element. Our
// ~20 custom variants collapse onto those 5 tags; icon-only sizes (icon,
// iconSm, iconMd, node-toolbar) render <md-icon-button> instead. Each
// variant's distinguishing color is applied as an inline CSS custom-property
// override (the mechanism @material/web components expose for per-instance
// styling — see material-web-tokens.css for the app-wide token bridge these
// build on). The original gradient fills (accent/success/info/warning) have
// no equivalent — M3's container-color token is a solid background-color,
// not a background-image — so those fall back to a representative solid
// color instead of the gradient; noted here since it's a real, deliberate
// visual simplification versus the previous MUI version, not an oversight.
type MdTag =
  | "md-filled-button"
  | "md-filled-tonal-button"
  | "md-outlined-button"
  | "md-text-button";

type Mapped = { tag: MdTag; style?: React.CSSProperties };

function mapVariant(variant: ButtonProps["variant"]): Mapped {
  switch (variant) {
    case "destructive":
      return {
        tag: "md-filled-button",
        style: { "--md-filled-button-container-color": "var(--destructive)" } as React.CSSProperties,
      };
    case "outline":
    case "primary":
    case "outliner":
      return { tag: "md-outlined-button" };
    case "outlineAmber":
      return {
        tag: "md-outlined-button",
        style: {
          "--md-outlined-button-outline-color": "#d97706",
          "--md-outlined-button-label-text-color": "#d97706",
        } as React.CSSProperties,
      };
    case "accent":
      return { tag: "md-filled-button", style: { "--md-filled-button-container-color": "#3b82f6" } as React.CSSProperties };
    case "success":
      return { tag: "md-filled-button", style: { "--md-filled-button-container-color": "#16a34a" } as React.CSSProperties };
    case "info":
      return { tag: "md-filled-button", style: { "--md-filled-button-container-color": "#6366f1" } as React.CSSProperties };
    case "warning":
      return { tag: "md-filled-button", style: { "--md-filled-button-container-color": "#f97316" } as React.CSSProperties };
    case "secondary":
      // Filled-tonal is M3's own "secondary emphasis" button — a direct
      // semantic match, not a workaround.
      return { tag: "md-filled-tonal-button" };
    case "danger":
      return { tag: "md-filled-button", style: { "--md-filled-button-container-color": "#dc2626" } as React.CSSProperties };
    case "ghost":
    case "ghostActive":
    case "menu":
    case "menu-active":
    case "link":
    case "theme":
    case "disable":
      return { tag: "md-text-button" };
    case "default":
    default:
      return { tag: "md-filled-button" };
  }
}

const ICON_SIZES: NonNullable<ButtonProps["size"]>[] = ["icon", "iconSm", "iconMd", "node-toolbar"];

function mapSize(size: ButtonProps["size"]): React.CSSProperties {
  switch (size) {
    case "md":
      return { "--md-filled-button-container-height": "28px", "--md-outlined-button-container-height": "28px", "--md-text-button-container-height": "28px", "--md-filled-tonal-button-container-height": "28px" } as React.CSSProperties;
    case "sm":
      return { "--md-filled-button-container-height": "32px", "--md-outlined-button-container-height": "32px", "--md-text-button-container-height": "32px", "--md-filled-tonal-button-container-height": "32px" } as React.CSSProperties;
    case "xs":
      return { "--md-filled-button-container-height": "26px", "--md-outlined-button-container-height": "26px", "--md-text-button-container-height": "26px", "--md-filled-tonal-button-container-height": "26px" } as React.CSSProperties;
    case "lg":
      return { "--md-filled-button-container-height": "40px", "--md-outlined-button-container-height": "40px", "--md-text-button-container-height": "40px", "--md-filled-tonal-button-container-height": "40px" } as React.CSSProperties;
    case "default":
    default:
      return { "--md-filled-button-container-height": "36px", "--md-outlined-button-container-height": "36px", "--md-text-button-container-height": "36px", "--md-filled-tonal-button-container-height": "36px" } as React.CSSProperties;
  }
}

const Button = React.forwardRef<HTMLElement, ButtonProps>(
  (
    {
      className,
      variant,
      unstyled,
      size,
      loading,
      type,
      disabled,
      asChild = false,
      children,
      ignoreTitleCase = false,
      style,
      ...props
    },
    ref,
  ) => {
    let newChildren = children;
    if (typeof children === "string") {
      newChildren = ignoreTitleCase ? children : toTitleCase(children);
    }

    // Slot can't render through a Material Web custom element (it isn't a
    // bare DOM element it can merge props into), so asChild keeps the
    // original Tailwind-classed rendering path unchanged.
    if (asChild || unstyled) {
      const Comp = asChild ? Slot : "button";
      return (
        <Comp
          className={
            !unstyled
              ? buttonVariants({ variant, size, className })
              : cn(className)
          }
          style={style}
          disabled={loading || disabled}
          {...(asChild ? {} : { type: type || "button" })}
          ref={ref as React.Ref<HTMLButtonElement>}
          {...props}
        >
          {loading ? (
            <span className="relative flex items-center justify-center">
              <span className="invisible">{newChildren}</span>
              <span className="absolute inset-0 flex items-center justify-center">
                <md-circular-progress indeterminate style={{ "--md-circular-progress-size": "16px" } as React.CSSProperties} />
              </span>
            </span>
          ) : (
            newChildren
          )}
        </Comp>
      );
    }

    const isIconOnly = ICON_SIZES.includes(size ?? "default") || variant === "theme" || variant === "disable";

    if (isIconOnly) {
      return (
        <md-icon-button
          ref={ref as React.Ref<HTMLElement>}
          type={type || "button"}
          disabled={loading || disabled}
          className={cn("noflow nopan nodelete nodrag", className)}
          style={{
            ...(variant === "theme" || variant === "disable" ? { width: "32px", height: "32px" } : {}),
            ...style,
          }}
          {...(props as React.HTMLAttributes<HTMLElement>)}
        >
          {loading ? (
            <md-circular-progress indeterminate style={{ "--md-circular-progress-size": "16px" } as React.CSSProperties} />
          ) : (
            newChildren
          )}
        </md-icon-button>
      );
    }

    const { tag: Tag, style: variantStyle } = mapVariant(variant);
    const sizeStyle = mapSize(size);

    // A runtime string can't be used with <Tag> JSX syntax and still
    // type-check against JSX.IntrinsicElements (TS treats a capitalized JSX
    // tag as a component reference, not a dynamic intrinsic-element lookup),
    // so the variant-to-element choice above is rendered via createElement.
    return React.createElement(
      Tag,
      {
        ref: ref as React.Ref<HTMLElement>,
        type: type || "button",
        disabled: loading || disabled,
        className: cn("noflow nopan nodelete nodrag [&_svg]:pointer-events-none", className),
        style: { ...variantStyle, ...sizeStyle, ...style },
        ...props,
      },
      loading ? (
        <>
          <md-circular-progress
            slot="icon"
            indeterminate
            style={{ "--md-circular-progress-size": "16px" } as React.CSSProperties}
          />
          <span style={{ visibility: "hidden" }}>{newChildren}</span>
        </>
      ) : (
        newChildren
      ),
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
