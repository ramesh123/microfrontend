import ForwardedIconComponent from "@/components/common/genericIconComponent";
import { Button } from "@/components/ui/button";

export function SidebarFooterComponent() {
  return (
    <>
      <div className="flex w-full flex-col gap-2 p-3">
        <div className="flex w-full items-center gap-2">
          <Button
            variant="outline"
            data-testid="sidebar-custom-component-button"
            className="flex items-center gap-2"
          >
          <ForwardedIconComponent
            name="Plus"
            className="h-4 w-4"
          />
          <span className="group-data-[state=open]/collapsible:font-semibold">
            New Custom Component
          </span>
          </Button>
        </div>
      </div>
    </>
  );
}

export default SidebarFooterComponent;