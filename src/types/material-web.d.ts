import type { DetailedHTMLProps, HTMLAttributes } from "react";

/**
 * @material/web ships Lit-based Web Components, not React components — it only
 * augments the DOM-level `HTMLElementTagNameMap` (see e.g.
 * node_modules/@material/web/button/filled-button.d.ts), which TypeScript's
 * JSX checker doesn't read from. Each custom element used from TSX needs its
 * own `JSX.IntrinsicElements` entry here, or `<md-filled-button>` etc. fail to
 * type-check as valid JSX. Kept intentionally minimal (button family only) —
 * extend as more @material/web elements are adopted.
 */
type MdButtonProps = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
  disabled?: boolean;
  "soft-disabled"?: boolean;
  type?: "button" | "submit" | "reset";
  value?: string;
  name?: string;
  form?: string;
  href?: string;
  target?: "_blank" | "_parent" | "_self" | "_top" | "";
  "trailing-icon"?: boolean;
};

type MdIconButtonProps = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
  disabled?: boolean;
  "soft-disabled"?: boolean;
  type?: "button" | "submit" | "reset";
  toggle?: boolean;
  selected?: boolean;
};

type MdCircularProgressProps = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
  value?: number;
  max?: number;
  indeterminate?: boolean;
  "four-color"?: boolean;
};

// @types/react declares its JSX namespace as `declare module "react" { namespace
// JSX { ... } }` (see node_modules/@types/react/index.d.ts) rather than the bare
// global namespace — with "jsx": "react-jsx" that's the one actually consulted
// for IntrinsicElements, so augmenting the classic `declare global { namespace
// JSX }` alone silently has no effect. Augmenting the global namespace too costs
// nothing and covers older/mixed tooling that still reads it.
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "md-filled-button": MdButtonProps;
      "md-outlined-button": MdButtonProps;
      "md-text-button": MdButtonProps;
      "md-elevated-button": MdButtonProps;
      "md-filled-tonal-button": MdButtonProps;
      "md-icon-button": MdIconButtonProps;
      "md-circular-progress": MdCircularProgressProps;
    }
  }
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "md-filled-button": MdButtonProps;
      "md-outlined-button": MdButtonProps;
      "md-text-button": MdButtonProps;
      "md-elevated-button": MdButtonProps;
      "md-filled-tonal-button": MdButtonProps;
      "md-icon-button": MdIconButtonProps;
      "md-circular-progress": MdCircularProgressProps;
    }
  }
}

export {};
