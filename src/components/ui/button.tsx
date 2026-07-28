import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";
import ForwardedIconComponent from "@/components/common/genericIconComponent";

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
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    let newChildren = children;
    if (typeof children === "string") {
      newChildren = ignoreTitleCase ? children : toTitleCase(children);
    }
    return (
      <>
        <Comp
          className={
            !unstyled
              ? buttonVariants({ variant, size, className })
              : cn(className)
          }
          disabled={loading || disabled}
          {...(asChild ? {} : { type: type || "button" })}
          ref={ref}
          {...props}
        >
          {loading ? (
            <span className="relative flex items-center justify-center">
              <span className="invisible">{newChildren}</span>
              <span className="absolute inset-0 flex items-center justify-center">
                <ForwardedIconComponent
                  name={"Loader2"}
                  className={"h-full w-full animate-spin"}
                />
              </span>
            </span>
          ) : (
            newChildren
          )}
        </Comp>
      </>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };

