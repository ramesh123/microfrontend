import { ChevronsUpDown, Plus, Eye, Command } from "lucide-react"
import { useNavigate } from "react-router-dom"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useRbacStore } from "@/stores/useRBACStore"

export function ProjectsSwitcher() {
  const navigate = useNavigate()
  const { isMobile, state } = useSidebar()
  const { availablePerspectives, activePerspective, setActivePerspective } = useRbacStore()
  const isCollapsed = state === "collapsed"

  const handlePerspectiveChange = (perspectiveId: string) => {
    // Just update the perspective - no navigation needed
    // Routes are static and always available, only sidebar menu changes
    setActivePerspective(perspectiveId)
  }

  // If no perspectives available, show placeholder
  if (!availablePerspectives || availablePerspectives.length === 0) {
    return ( 
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            disabled
            className="h-auto min-h-0 py-1.5 group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:!justify-center"
          >
            <div className="perspective-icon-tile text-white bg-sidebar-primary flex aspect-square size-7 items-center justify-center rounded-md">
              <Eye className="size-3.5 !text-white shrink-0" />
            </div>
            {!isCollapsed && (
              <div className="grid min-w-0 flex-1 text-left text-xs leading-snug">
                <span className="truncate font-medium">No Perspectives</span>
                <span className="truncate text-[0.65rem] text-muted-foreground">Please contact administrator</span>
              </div>
            )}
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  const currentPerspective = activePerspective || availablePerspectives[0]

  return (  
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="h-auto min-h-0 py-1.5 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:!justify-center"
            >
              {isCollapsed ? (
                <div
                  className="perspective-icon-tile text-white bg-sidebar-primary flex aspect-square size-7 shrink-0 items-center justify-center rounded-md"
                  aria-label={currentPerspective?.perspective_name || currentPerspective?.name || "Perspective"}
                >
                  <Command className="size-3.5 !text-white shrink-0" />
                </div>
              ) : (
                <>
                  <div className="perspective-icon-tile text-white bg-sidebar-primary flex aspect-square size-7 shrink-0 items-center justify-center rounded-md">
                    <Command className="size-3.5 !text-white shrink-0" />
                  </div>
                  <div className="grid min-w-0 flex-1 text-left text-xs leading-snug">
                    <span className="truncate font-medium">{currentPerspective?.perspective_name || currentPerspective?.name}</span>
                    <span className="truncate text-[0.65rem] text-muted-foreground">{currentPerspective?.description || "Data perspective"}</span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-3.5 shrink-0 opacity-70" />
                </>
              )}
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align={isCollapsed ? "start" : "start"}
            side={isMobile ? "bottom" : isCollapsed ? "right" : "bottom"}
            sideOffset={8}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              Perspectives
            </DropdownMenuLabel>
            
            {availablePerspectives.map((perspective, index) => {
              const perspectiveId = perspective.perspective_id || perspective.id
              const perspectiveName = perspective.perspective_name || perspective.name
              const isActive = activePerspective?.perspective_id === perspectiveId || activePerspective?.id === perspectiveId
              return (
                <DropdownMenuItem
                  key={perspectiveId}
                  onClick={() => handlePerspectiveChange(perspectiveId)}
                  className={isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground' : ''}
                >
                  <div className="flex size-6 items-center justify-center rounded-md border">
                    <Eye className="size-3.5 shrink-0" />
                  </div>
                  <div className="grid min-w-0 flex-1 text-left text-sm leading-snug">
                    <span className="truncate font-medium">{perspectiveName}</span>
                    <span className="truncate text-xs text-muted-foreground">{perspective.description || "Data perspective"}</span>
                  </div>
                  <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
                </DropdownMenuItem>
              )
            })}
            
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/perspectives/create")}>
              <div className="flex size-6 items-center justify-center rounded-md border bg-transparent ">
                <Plus className="size-4" />
              </div>
              <div className=" font-medium">Create Perspective</div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}