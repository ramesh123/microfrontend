import { SidebarMenuButton } from "@/components/ui/sidebar";
import { NodeItem } from "../../types";
import ForwardedIconComponent from "@/components/common/genericIconComponent";

interface BundleItemProps {
  category: string;
  items: NodeItem[];
  onItemClick?: (item: NodeItem) => void;
}

export const BundleItem = ({ category, items, onItemClick }: BundleItemProps) => {
  return (
    <div className="mb-4">
      <h3 className="mb-2 text-sm font-medium text-foreground">{category}</h3>
      <div className="space-y-1">
        {items.map((item) => (
          <SidebarMenuButton
            key={item.node_id}
            title={item.display_name}
            onClick={() => onItemClick?.(item)}
            className="w-full justify-start"
          >
            <div className="flex items-center gap-2">
              <ForwardedIconComponent
                name={"Plus"}
                className="h-5 w-5"
              />
              <span>{item.display_name}</span>
            </div>
          </SidebarMenuButton>
        ))}
      </div>
    </div>
  );
};