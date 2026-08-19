/**
 * Compact density + sidebar active colors for md-list / md-list-item.
 * Same shadow-DOM override pattern as compact-md-menu.ts.
 */
function createSheet(css: string): CSSStyleSheet | null {
  if (typeof CSSStyleSheet === "undefined") return null;
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  return sheet;
}

const compactListItemSheet = createSheet(`
  :host {
    gap: 0.25rem !important;
    border-radius: 0.375rem;
    display: flex;
    width: 100%;
    padding: 0 !important;
    background: transparent !important;
  }
  md-item {
    min-height: unset !important;
    width: 100%;
    box-sizing: border-box;
    padding: 0.2rem 0.4rem !important;
    gap: 0.35rem !important;
    font-size: 0.8125rem !important;
    line-height: 1.2rem !important;
    border-radius: inherit;
    border: none !important;
    background: transparent !important;
    box-shadow: none !important;
    transition: background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
  }
  :host([data-sidebar="menu-sub-button"]) md-item {
    padding: 0.12rem 0.25rem !important;
    font-size: 0.75rem !important;
    line-height: 1.25rem !important;
  }
  :host([data-size="lg"]) md-item {
    padding: 0.35rem 0.45rem !important;
    font-size: 0.8125rem !important;
    line-height: 1.2rem !important;
  }
  :host([data-collapsed="true"]:not([data-size="lg"])) {
    width: 2rem !important;
    height: 2rem !important;
    min-width: 2rem !important;
    min-height: 2rem !important;
  }
  :host([data-collapsed="true"]:not([data-size="lg"])) md-item {
    padding: 0 !important;
    min-height: 2rem !important;
    height: 2rem !important;
    width: 2rem !important;
    justify-content: center;
    align-items: center;
    border-radius: 0.55rem;
  }
  :host([data-collapsed="true"][data-active="true"]:not([data-size="lg"])) md-item {
    background: var(--sidebar-menu-item-active-bg) !important;
    color: var(--sidebar-menu-item-active-color) !important;
    box-shadow: var(--sidebar-menu-item-active-shadow) !important;
    font-weight: 600;
  }
  :host([data-collapsed="true"][data-size="lg"]) md-item {
    padding: 0 !important;
    justify-content: center;
    align-items: center;
  }
  :host([data-active="true"]) md-item {
    background: var(--sidebar-menu-item-active-bg) !important;
    color: var(--sidebar-menu-item-active-color) !important;
    box-shadow: var(--sidebar-menu-item-active-shadow) !important;
    font-weight: 600;
  }
  :host(:hover:not([data-active="true"])) md-item {
    background: var(--sidebar-menu-item-hover-bg) !important;
    color: var(--sidebar-menu-item-hover-color) !important;
    box-shadow: var(--sidebar-menu-item-hover-shadow) !important;
  }
  md-item[multiline] {
    min-height: unset !important;
  }
`);

const compactListSheet = createSheet(`
  :host {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0;
    background: transparent;
  }
`);

const compactDrawerModalSheet = createSheet(`
  :host {
    position: fixed !important;
    inset: 0 !important;
    z-index: 50 !important;
    pointer-events: none;
  }
  :host([opened]) {
    pointer-events: auto;
  }
  .md3-navigation-drawer-modal {
    background-color: var(--sidebar) !important;
    color: var(--sidebar-foreground) !important;
  }
`);

const compactDrawerSheet = createSheet(`
  :host {
    display: flex !important;
    width: 100% !important;
    height: 100% !important;
    min-height: 0 !important;
    --md-navigation-drawer-container-width: 100%;
    --md-navigation-drawer-container-height: 100%;
    --md-navigation-drawer-container-shape: 0;
    --md-navigation-drawer-standard-container-elevation: 0;
    --md-navigation-drawer-container-color: transparent;
  }
  .md3-navigation-drawer {
    inline-size: 100% !important;
    visibility: visible !important;
    overflow: visible !important;
    transition: none !important;
    background: transparent !important;
  }
  .md3-navigation-drawer__slot-content {
    width: 100%;
    height: 100%;
    min-height: 0;
  }
  md-elevation {
    display: none !important;
  }
`);

const compactSubListSheet = createSheet(`
  :host {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    padding: 0;
    background: transparent;
    margin-left: 0.5rem;
    padding-left: 0.35rem;
    border-left: none;
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

export function adoptCompactListItemStyles(el: Element | null) {
  adoptSheet(el, compactListItemSheet);
}

export function adoptCompactListStyles(el: Element | null) {
  adoptSheet(el, compactListSheet);
}

export function adoptCompactDrawerModalStyles(el: Element | null) {
  adoptSheet(el, compactDrawerModalSheet);
}

export function adoptCompactDrawerStyles(el: Element | null) {
  adoptSheet(el, compactDrawerSheet);
}

export function adoptCompactSubListStyles(el: Element | null) {
  adoptSheet(el, compactSubListSheet);
}
