import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { ForwardedIconComponent } from "@/components/common/genericIconComponent";


interface SidebarItemsListProps {
  item: {
    name: string;
    items: {
      name: string;
    }[];
  }[];
}

const SidebarItemsList = ({
  item,
}: SidebarItemsListProps) => {
  return (
    <div>
      <SidebarMenu>
        {item.map((item) => (
          <SidebarMenuItem key={item.name}>
            <SidebarMenuButton asChild>
              <ForwardedIconComponent name="SquareArrowOutUpRight" />
              <span>{item.name}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </div>
  );
};

export default SidebarItemsList;
