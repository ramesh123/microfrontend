export interface NodeItem {
  node_id: string;
  name: string;
  display_name: string;
  group: string;
  icon: string;
  description: string;
  enabled: boolean;
}

export interface NodeCategories {
  [key: string]: NodeItem[];
}

export interface SidebarGroupProps {
  items: NodeCategories;
  openCategories: string[];
  setOpenCategories: (categories: string[]) => void;
}