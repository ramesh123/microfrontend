import * as React from "react";
import { adoptCompactMenuStyles } from "@/lib/compact-md-menu";
import { dismissOtherMenus, registerOpenMenu, unregisterOpenMenu } from "@/lib/md-menu-registry";

type MdMenuEl = HTMLElement & {
  open: boolean;
  show: () => void;
  close: () => void;
  skipRestoreFocus: boolean;
};

/**
 * Drive md-menu with show()/close() instead of the `open` property.
 *
 * Passing `open={...}` as a React prop fights Lit: a close animation still
 * dispatches `closed` after a newer open, and React then forces the menu shut
 * so the next trigger click is a no-op.
 */
export function useMdMenu(open: boolean, setOpen: (open: boolean) => void, menuId?: string) {
  const menuElRef = React.useRef<MdMenuEl | null>(null);
  const setOpenRef = React.useRef(setOpen);
  setOpenRef.current = setOpen;
  const menuIdRef = React.useRef(menuId);
  menuIdRef.current = menuId;

  const menuRef = React.useCallback((el: Element | null) => {
    const menu = el as MdMenuEl | null;
    adoptCompactMenuStyles(menu);
    menuElRef.current = menu;
  }, []);

  React.useEffect(() => {
    const el = menuElRef.current;
    const id = menuIdRef.current;
    if (!el) return;
    if (open) {
      if (id) {
        dismissOtherMenus(id);
        registerOpenMenu(id, el, setOpenRef.current);
      }
      el.skipRestoreFocus = false;
      if (!el.open) el.show();
    } else {
      if (id) unregisterOpenMenu(id);
      if (el.open) el.close();
    }
  }, [open]);

  const onClosing = React.useCallback(() => {
    const id = menuIdRef.current;
    if (id) unregisterOpenMenu(id);
    setOpenRef.current(false);
  }, []);

  const onClosed = React.useCallback((event: Event) => {
    const el = event.currentTarget as MdMenuEl;
    // Stale `closed` from a previous close animation — the menu was re-opened.
    if (el.open) return;
    const id = menuIdRef.current;
    if (id) unregisterOpenMenu(id);
    setOpenRef.current(false);
  }, []);

  return { menuRef, onClosing, onClosed };
}

export { dismissOtherMenus };
