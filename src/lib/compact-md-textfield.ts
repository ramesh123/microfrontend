/**
 * Compact density + theme bridge for md-outlined-text-field on login/forms.
 * Same adopted-stylesheet pattern as compact-md-menu.ts / compact-md-list.ts.
 */
function createSheet(css: string): CSSStyleSheet | null {
  if (typeof CSSStyleSheet === "undefined") return null;
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  return sheet;
}

const compactOutlinedTextFieldSheet = createSheet(`
  :host {
    width: 100%;
    display: block;
    --md-outlined-text-field-top-space: 8px;
    --md-outlined-text-field-bottom-space: 8px;
    --md-outlined-text-field-leading-space: 12px;
    --md-outlined-text-field-trailing-space: 12px;
    --md-outlined-text-field-with-leading-icon-leading-space: 8px;
    --md-outlined-text-field-with-trailing-icon-trailing-space: 8px;
    --md-outlined-text-field-input-text-size: 0.875rem;
    --md-outlined-text-field-input-text-line-height: 1.25rem;
    --md-outlined-text-field-label-text-size: 0.875rem;
    --md-outlined-text-field-label-text-populated-size: 0.75rem;
    --md-outlined-text-field-container-shape: 0.375rem;
    --md-outlined-text-field-outline-color: var(--border);
    --md-outlined-text-field-focus-outline-color: var(--ring);
    --md-outlined-text-field-focus-outline-width: 1px;
    --md-outlined-text-field-hover-outline-color: var(--border);
    --md-outlined-text-field-input-text-color: var(--foreground);
    --md-outlined-text-field-input-text-placeholder-color: var(--muted-foreground);
    --md-outlined-text-field-label-text-color: var(--foreground);
    --md-outlined-text-field-trailing-icon-size: 18px;
  }
  md-outlined-field {
    width: 100%;
  }
  .input {
    font-size: 0.875rem !important;
    line-height: 1.25rem !important;
  }
  md-icon-button[slot="trailing-icon"] {
    --md-icon-button-icon-size: 16px;
    width: 28px;
    height: 28px;
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

export function adoptCompactOutlinedTextFieldStyles(el: Element | null) {
  adoptSheet(el, compactOutlinedTextFieldSheet);
}
