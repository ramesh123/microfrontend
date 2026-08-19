/**
 * md-menu-item / md-item ship MD3 list density (56px rows, 12px padding,
 * 16px gap). Those values are hardcoded on :host and beat the public
 * --md-menu-item-* tokens, so we adopt a compact sheet into each instance's
 * open shadow root.
 */
function createSheet(css: string): CSSStyleSheet | null {
  if (typeof CSSStyleSheet === "undefined") return null;
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  return sheet;
}

const compactMenuItemSheet = createSheet(`
  :host {
    gap: 0.5rem !important;
  }
  md-item {
    min-height: unset !important;
    padding: 0.375rem 0.625rem !important;
    gap: 0.5rem !important;
    font-size: 0.875rem !important;
    line-height: 1.25rem !important;
  }
  md-item[multiline] {
    min-height: unset !important;
  }
`);

const compactMenuSheet = createSheet(`
  .menu {
    z-index: 2000 !important;
  }
  .items {
    background-color: var(--popover) !important;
    color: var(--popover-foreground);
  }
  .item-padding {
    padding-block: 0.25rem !important;
  }
`);

function adoptSheet(el: Element | null | undefined, sheet: CSSStyleSheet | null) {
  if (!el || !sheet) return;
  const apply = () => {
    const root = (el as HTMLElement).shadowRoot;
    if (!root) return;
    if (!root.adoptedStyleSheets.includes(sheet)) {
      root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
    }
  };
  if ((el as HTMLElement).shadowRoot) {
    apply();
    return;
  }
  void customElements.whenDefined(el.localName).then(apply);
}

export function adoptCompactMenuItemStyles(el: Element | null) {
  adoptSheet(el, compactMenuItemSheet);
}

export function adoptCompactMenuStyles(el: Element | null) {
  adoptSheet(el, compactMenuSheet);
}
