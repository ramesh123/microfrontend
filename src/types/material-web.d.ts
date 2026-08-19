import type { DetailedHTMLProps, HTMLAttributes } from "react";

/**
 * @material/web ships Lit-based Web Components, not React components — it only
 * augments the DOM-level `HTMLElementTagNameMap` (see e.g.
 * node_modules/@material/web/button/filled-button.d.ts), which TypeScript's
 * JSX checker doesn't read from. Each custom element used from TSX needs its
 * own `JSX.IntrinsicElements` entry here, or `<md-filled-button>` etc. fail to
 * type-check as valid JSX.
 *
 * Props are typed loosely on purpose (known Lit reactive properties spelled
 * out, everything else falls through the index signature) rather than
 * exhaustively mirroring every component's full internal API — the adapters
 * in components/ui/* only ever use a small, well-understood slice of each
 * element's surface, and typing the rest wouldn't buy real safety here.
 */
type MdBase = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
  disabled?: boolean;
  [key: string]: unknown;
};

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "md-filled-button": MdBase;
      "md-outlined-button": MdBase;
      "md-text-button": MdBase;
      "md-elevated-button": MdBase;
      "md-filled-tonal-button": MdBase;
      "md-icon-button": MdBase;
      "md-circular-progress": MdBase;
      "md-checkbox": MdBase;
      "md-radio": MdBase;
      "md-switch": MdBase;
      "md-slider": MdBase;
      "md-divider": MdBase;
      "md-tabs": MdBase;
      "md-primary-tab": MdBase;
      "md-secondary-tab": MdBase;
      "md-menu": MdBase;
      "md-menu-item": MdBase;
      "md-sub-menu": MdBase;
      "md-dialog": MdBase;
      "md-outlined-select": MdBase;
      "md-filled-select": MdBase;
      "md-select-option": MdBase;
      "md-list": MdBase;
      "md-list-item": MdBase;
      "md-navigation-drawer-modal": MdBase & { opened?: boolean; pivot?: "start" | "end" };
      "md-navigation-drawer": MdBase & { opened?: boolean; pivot?: "start" | "end" };
      "md-outlined-segmented-button": MdBase;
      "md-outlined-segmented-button-set": MdBase;
      "md-outlined-text-field": MdBase & {
        label?: string;
        placeholder?: string;
        type?: string;
        value?: string;
        required?: boolean;
        error?: boolean;
        errorText?: string;
        supportingText?: string;
        hasTrailingIcon?: boolean;
        hasLeadingIcon?: boolean;
      };
    }
  }
}

// @types/react declares its JSX namespace as `declare module "react" { namespace
// JSX { ... } }` (see node_modules/@types/react/index.d.ts) rather than the bare
// global namespace — with "jsx": "react-jsx" that's the one actually consulted
// for IntrinsicElements, so augmenting the classic `declare global { namespace
// JSX }` alone silently has no effect. Augmenting the global namespace too costs
// nothing and covers older/mixed tooling that still reads it.
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "md-filled-button": MdBase;
      "md-outlined-button": MdBase;
      "md-text-button": MdBase;
      "md-elevated-button": MdBase;
      "md-filled-tonal-button": MdBase;
      "md-icon-button": MdBase;
      "md-circular-progress": MdBase;
      "md-checkbox": MdBase;
      "md-radio": MdBase;
      "md-switch": MdBase;
      "md-slider": MdBase;
      "md-divider": MdBase;
      "md-tabs": MdBase;
      "md-primary-tab": MdBase;
      "md-secondary-tab": MdBase;
      "md-menu": MdBase;
      "md-menu-item": MdBase;
      "md-sub-menu": MdBase;
      "md-dialog": MdBase;
      "md-outlined-select": MdBase;
      "md-filled-select": MdBase;
      "md-select-option": MdBase;
      "md-list": MdBase;
      "md-list-item": MdBase;
      "md-navigation-drawer-modal": MdBase & { opened?: boolean; pivot?: "start" | "end" };
      "md-navigation-drawer": MdBase & { opened?: boolean; pivot?: "start" | "end" };
      "md-outlined-segmented-button": MdBase;
      "md-outlined-segmented-button-set": MdBase;
      "md-outlined-text-field": MdBase & {
        label?: string;
        placeholder?: string;
        type?: string;
        value?: string;
        required?: boolean;
        error?: boolean;
        errorText?: string;
        supportingText?: string;
        hasTrailingIcon?: boolean;
        hasLeadingIcon?: boolean;
      };
    }
  }
}

export {};
