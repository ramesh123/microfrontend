import type { MenuItem } from '@/types/rbac';

export interface SelectableMenuItem {
  p_id: string;
  title: string;
  path: string;
  label: string;
}

export function flattenSelectableMenuItems(
  items: MenuItem[],
  parentLabel?: string,
): SelectableMenuItem[] {
  const result: SelectableMenuItem[] = [];

  for (const item of items) {
    const label = parentLabel ? `${parentLabel} › ${item.title}` : item.title;

    if (item.path && !item.hidden && !item.path.includes(':')) {
      result.push({
        p_id: item.p_id,
        title: item.title,
        path: item.path,
        label,
      });
    }

    if (item.children?.length) {
      result.push(...flattenSelectableMenuItems(item.children, label));
    }
  }

  return result;
}
