
import ShadTooltip from "@/components/common/shadTooltipComponent";
import { Button } from "@/components/ui/button";
import ForwardedIconComponent from "@/components/common/genericIconComponent";
import { useSidebarStore } from "@/stores/sidebarStore";
import SearchInput from "../searchInput";

export function SidebarHeaderComponent() {
  const showConfig = false;
  const toggleSidebar = useSidebarStore((state) => state.toggleSidebar)
  return (
    <>
    <div className="flex w-full flex-col gap-2 p-2">
      <div className="flex w-full items-center gap-2">
        <Button
          onClick={toggleSidebar}
          variant="ghost"
          size="iconMd"
          data-testid="sidebar-trigger"
        >
          <ForwardedIconComponent
            name="PanelLeftClose"
            className="h-4 w-4"
          />
        </Button>
        <h3 className="flex-1 text-sm font-semibold">Components</h3>
        <div>
          <ShadTooltip content="Component settings" styleClasses="z-50">
            <Button
              variant={showConfig ? "ghostActive" : "ghost"}
              size="iconMd"
              data-testid="sidebar-options-trigger"
            >
              <ForwardedIconComponent
                name="SlidersHorizontal"
                className="h-4 w-4"
              />
            </Button>
          </ShadTooltip>
        </div>
      </div>
    </div>
    <div className="p-2">
      <SearchInput />
    </div>
    </>
  );
}

export default SidebarHeaderComponent;