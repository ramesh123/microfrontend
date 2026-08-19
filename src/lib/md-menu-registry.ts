type MdMenuEl = HTMLElement & {
  open: boolean;
  close: () => void;
  skipRestoreFocus: boolean;
};

type Entry = {
  el: MdMenuEl;
  setOpen: (open: boolean) => void;
};

const openMenus = new Map<string, Entry>();

export function registerOpenMenu(id: string, el: MdMenuEl, setOpen: (open: boolean) => void) {
  openMenus.set(id, { el, setOpen });
}

export function unregisterOpenMenu(id: string) {
  openMenus.delete(id);
}

/** Close every open md-menu except `exceptId`, without bouncing focus back to its trigger. */
export function dismissOtherMenus(exceptId?: string) {
  for (const [id, entry] of [...openMenus]) {
    if (id === exceptId) continue;
    entry.el.skipRestoreFocus = true;
    if (entry.el.open) entry.el.close();
    entry.setOpen(false);
    openMenus.delete(id);
  }
}
