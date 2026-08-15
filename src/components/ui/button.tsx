import { Slot } from "@/lib/slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import MuiButton, { type ButtonProps as MuiButtonProps } from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import { cn } from "@/lib/utils";
import { cssVar } from "@/theme/colors";

// Kept for the asChild path below (Radix Slot can't render through MUI's
// Button — it isn't a plain DOM element — so asChild usage keeps the
// original Tailwind-classed rendering instead of the MUI one).
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

// --- MUI variant/size mapping -----------------------------------------
// buttonVariants' ~20 custom `variant` values don't map 1:1 onto MUI's
// variant+color axes (several are gradients or fixed-size icon toggles
// with no MUI equivalent), so each gets an explicit MUI variant/color plus
// an sx override reproducing its exact look using the same design tokens
// (cssVar.*) the rest of the theme reads from.
type MuiColor = "inherit" | "primary" | "success" | "info" | "warning" | "secondary" | "error";
type Mapped = { variant: MuiButtonProps["variant"]; color?: MuiColor; sx?: MuiButtonProps["sx"] };

const GRADIENTS: Record<string, string> = {
  accent: "linear-gradient(to right, #06b6d4, #3b82f6)",
  success: "linear-gradient(to right, #10b981, #16a34a)",
  info: "linear-gradient(to right, #3b82f6, #6366f1)",
  warning: "linear-gradient(to right, #f97316, #eab308)",
};

function mapVariant(variant: ButtonProps["variant"]): Mapped {
  switch (variant) {
    case "destructive":
      return { variant: "contained", color: "error" };
    case "outline":
    case "primary":
      return { variant: "outlined", sx: { borderColor: cssVar.border, bgcolor: cssVar.card } };
    case "outliner":
      return { variant: "outlined", sx: { bgcolor: cssVar.card } };
    case "outlineAmber":
      return { variant: "outlined", sx: { borderColor: "#d97706", color: "#d97706" } };
    case "accent":
    case "success":
    case "info":
    case "warning":
      return {
        variant: "contained",
        sx: {
          backgroundImage: GRADIENTS[variant],
          color: "#fff",
          "&:hover": { backgroundImage: GRADIENTS[variant], opacity: 0.95, transform: "translateY(-1px)" },
        },
      };
    case "secondary":
      return { variant: "outlined", sx: { bgcolor: cssVar.muted, borderColor: cssVar.muted } };
    case "danger":
      return { variant: "contained", sx: { bgcolor: "#dc2626", "&:hover": { bgcolor: "#b91c1c" } } };
    case "ghost":
      return { variant: "text" };
    case "ghostActive":
      return { variant: "text", sx: { bgcolor: cssVar.muted } };
    case "menu":
    case "menu-active":
      return { variant: "text", sx: { justifyContent: "flex-start", fontWeight: variant === "menu-active" ? 600 : 500 } };
    case "link":
      return { variant: "text", sx: { textDecoration: "underline", textUnderlineOffset: "4px", p: 0, minWidth: 0 } };
    case "theme":
    case "disable":
      return { variant: "text", sx: { height: 32, width: 32, minWidth: 32, p: 0, borderRadius: cssVar.radius } };
    case "default":
    default:
      return { variant: "contained", color: "primary" };
  }
}

function mapSize(size: ButtonProps["size"]): { sx: MuiButtonProps["sx"] } {
  switch (size) {
    case "md":
      return { sx: { height: 28, py: 0.75, px: 1.5 } };
    case "sm":
      return { sx: { height: 32, px: 1.5 } };
    case "xs":
      return { sx: { py: 0.25, px: 1.5, minHeight: 0 } };
    case "lg":
      return { sx: { height: 40, px: 4 } };
    case "iconMd":
      return { sx: { p: 0.75, minWidth: 0 } };
    case "icon":
      return { sx: { p: 0.5, minWidth: 0 } };
    case "iconSm":
      return { sx: { p: 0.25, minWidth: 0 } };
    case "node-toolbar":
      return { sx: { py: "5px", px: "5px", minWidth: 0 } };
    case "default":
    default:
      return { sx: { height: 36, py: 1, px: 2 } };
  }
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
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
      // Destructured out (and discarded): React.ButtonHTMLAttributes includes a
      // legacy `color?: string` attribute that would otherwise widen the mapped
      // MuiColor value below when spread via {...props} after `color={color}`.
      color: _htmlColorAttr,
      ...props
    },
    ref,
  ) => {
    let newChildren = children;
    if (typeof children === "string") {
      newChildren = ignoreTitleCase ? children : toTitleCase(children);
    }

    // Slot can't render through MUI's Button root (it isn't a bare DOM
    // element it can merge props into), so asChild keeps the original
    // Tailwind-classed rendering path unchanged.
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
          ref={ref}
          {...props}
        >
          {loading ? (
            <span className="relative flex items-center justify-center">
              <span className="invisible">{newChildren}</span>
              <span className="absolute inset-0 flex items-center justify-center">
                <CircularProgress size={16} color="inherit" />
              </span>
            </span>
          ) : (
            newChildren
          )}
        </Comp>
      );
    }

    const { variant: muiVariant, color, sx: variantSx } = mapVariant(variant);
    const { sx: sizeSx } = mapSize(size);

    return (
      <MuiButton
        ref={ref}
        variant={muiVariant}
        color={color}
        type={type || "button"}
        disabled={loading || disabled}
        className={cn("noflow nopan nodelete nodrag", className)}
        style={style}
        sx={[
          { "& svg": { pointerEvents: "none" } },
          ...(Array.isArray(variantSx) ? variantSx : [variantSx]),
          ...(Array.isArray(sizeSx) ? sizeSx : [sizeSx]),
        ]}
        startIcon={loading ? <CircularProgress size={14} color="inherit" /> : undefined}
        {...props}
      >
        {loading ? <span style={{ visibility: "hidden" }}>{newChildren}</span> : newChildren}
      </MuiButton>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
