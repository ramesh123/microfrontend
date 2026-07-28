import { SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu } from "@/components/ui/sidebar";
import { memo } from "react";
import { SidebarGroupProps } from "../../types";
import { BundleItem } from "../bundleItem";

export const MemoizedSidebarGroup = memo(({ items }: SidebarGroupProps) => {
  const handleItemClick = (item: any) => {
    // Handle item click (e.g., add to flow)
    console.log('Item clicked:', item);
  };

  return (
    <SidebarGroup className="p-3">
      <SidebarGroupLabel>Bundles</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {Object.entries(items).map(([category, categoryItems]) => (
            <BundleItem 
              key={category}
              category={category}
              items={categoryItems}
              onItemClick={handleItemClick}
            />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
});

MemoizedSidebarGroup.displayName = 'MemoizedSidebarGroup';