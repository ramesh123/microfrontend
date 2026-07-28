import { useCallback, useRef, useEffect } from 'react';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { ForwardedIconComponent } from "@/components/common/genericIconComponent";
import {
  Disclosure,
  DisclosureContent,
  DisclosureTrigger,
} from "@/components/ui/disclosure";
import {Badge} from "@/components/ui/badge";


const DraggableNodeItem = ({ item, onDragEnd }: { item: any; onDragEnd?: () => void }) => {
  // Add drag start handler to set data transfer
  const handleDragStart = useCallback((e: React.DragEvent<any>, 
    data: { type: string; node?: any }
  ) => {
    var crt = e.currentTarget.cloneNode(true);
    crt.style.position = "absolute";
    crt.style.width = "215px";
    crt.style.top = "-500px";
    crt.style.right = "-500px";
    crt.classList.add("cursor-grabbing");
    document.body.appendChild(crt);
    e.dataTransfer.setDragImage(crt, 0, 0);
    e.dataTransfer.setData("genericNode", JSON.stringify(item));

    const nodeData = {
      type: 'genericNode',
      data: {
        name: item.display_name,
        icon: item.icon,
        description: item.description,
        status: 'idle',
        type: 'genericNode',
        ...item,
      },
    };
    
    // Set data for HTML5 drag and drop
    e.dataTransfer.setData('genericNode', JSON.stringify(nodeData));
    e.dataTransfer.effectAllowed = 'move';
    
    // For debugging
    // console.log('Drag start:', nodeData);
  }, [item]);

  const handleDragEnd = useCallback(() => {
    if (onDragEnd) {
      onDragEnd();
    }
  }, [onDragEnd]);

  return (
    <div 
      draggable
      onDragStart={(e) => handleDragStart(e, { type: 'genericNode', node: item })}
      onDragEnd={handleDragEnd}
      className="w-full rounded-md outline-none bg-background focus-visible:ring-0"
    >
      <div className="group/draggable flex p-3 cursor-grab items-center gap-2 rounded-md bg-muted hover:bg-secondary-foreground/10">
        <div className="icon-well icon-well-sm icon-well--round shrink-0">
          <ForwardedIconComponent
            name={item.icon}
            className="h-5 w-5 text-foreground/75 dark:text-foreground/80"
          />
        </div>
        <div className="flex-1">
          <span className="text-sm font-medium">{item.display_name}</span>
        </div>
        <ForwardedIconComponent
          name="grip-vertical"
          className="h-4 w-4 shrink-0 text-muted-foreground group-hover/draggable:text-primary"
        />
      </div>
    </div>
  );
};

interface CategoryItem {
  node_id: string;
  name: string;
  display_name: string;
  group: string;
  icon: string;
  description: string;
  enabled: boolean;
}

interface CategoryData {
  [key: string]: CategoryItem[];
}

export const CategoryDisclosure = ({
  item,
  openCategories,
  setOpenCategories,
}: {
  item: CategoryData;
  openCategories: string[];
  setOpenCategories: (categories: string[]) => void;
}) => {
  const toggleCategory = (category: string) => {
    setOpenCategories(
      openCategories.includes(category)
        ? openCategories.filter((c) => c !== category)
        : [...openCategories, category]
    );
  };

  const handleDragEnd = useCallback(() => {
    // Optional: Handle any cleanup or state updates after a successful drop
    console.log('Node was dropped successfully');
  }, []);

  return (
    <div className="space-y-1">
      {Object.entries(item).map(([category, items]) => (
        <div className="group/menu-item relative" key={category}>
          <Disclosure
            open={openCategories.includes(category)}
            onOpenChange={() => toggleCategory(category)}
          >
            <DisclosureTrigger>
              <div className="w-full flex items-center justify-between my-2">
                <div className="flex items-center">
                  {openCategories.includes(category) ? (
                    <ForwardedIconComponent name="ChevronDown" className="mr-2 h-4 w-4" />
                  ) : (
                    <ForwardedIconComponent name="ChevronRight" className="mr-2 h-4 w-4" />
                  )}
                  <span>{category}</span>
                </div>
                <Badge variant="secondary" className="text-xs shadow-sm">{items.length.toString()}</Badge>
              </div>
            </DisclosureTrigger>
            <DisclosureContent>
              <div className="flex flex-col gap-1">
                {items.map((subItem) => (
                  <div className="group/menu-item relative" key={subItem.node_id}>
                    <DraggableNodeItem 
                      item={subItem} 
                      onDragEnd={handleDragEnd} 
                    />
                  </div>
                ))}
              </div>
            </DisclosureContent>
          </Disclosure>
        </div>
      ))}
    </div>
  );
};

export default CategoryDisclosure;