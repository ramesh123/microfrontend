"use client"

import {
  BadgeCheck,
  Bell,
  ChevronsUpDown,
  CreditCard,
  LogOut,
  Sparkles,
  Building2,
  Plus,
} from "lucide-react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useNavigate } from "react-router"
import { useRbacStore } from "@/stores/useRBACStore"
import React from "react"

export function NavUser({
  user,
}: {
  user: {
    name: string
    email: string
    avatar: string
  }
}) {
  const { isMobile, state } = useSidebar()
  const { 
    logout,
    availableOrganizations, 
    currentOrganization, 
    switchOrganization,
    currentUser 
  } = useRbacStore();

  const navigate = useNavigate();
  const isCollapsed = state === "collapsed"
  const initials = React.useMemo(() => {
    const source = user.name || user.email || currentUser?.name || ""
    const parts = source.trim().split(/\s+/).filter(Boolean)
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    return (parts[0]?.slice(0, 2) || "U").toUpperCase()
  }, [currentUser?.name, user.email, user.name])

  // Handle organization switch
  const handleOrganizationSwitch = async (orgId: string, orgName: string) => {
    // Find the organization in available organizations
    const selectedOrg = availableOrganizations.find(org => 
      org.org_id === orgId || org.organization_id === orgId
    );
    
    if (selectedOrg) {
      // Use RBAC store's switchOrganization method
      const orgPerspectives = await switchOrganization(orgId);
      if (orgPerspectives.length === 0) { // No perspectives found for this organization
        return;
      }
    }
  };

  const handleLogout = () => {
    // localStorage.removeItem("token");
    logout()
    sessionStorage.removeItem("auth");
    console.log("Logout");
    navigate("/login");
  }

  return (  
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:!justify-center"
            >
              {isCollapsed ? (
                <span className="sidebar-login-initials" aria-label={user.name || user.email}>
                  {initials}
                </span>
              ) : (
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="rounded-lg bg-sidebar-primary text-sidebar-primary-foreground text-[0.72rem] font-semibold leading-none tracking-tight">{initials}</AvatarFallback>
                </Avatar>
              )}
              {!isCollapsed && (
                <>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user.name}</span>
                    <span className="truncate text-xs">{user.email}</span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </>
              )}
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="rounded-lg bg-sidebar-primary text-sidebar-primary-foreground text-[0.72rem] font-semibold leading-none tracking-tight">{initials}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            {/* <DropdownMenuSeparator /> */}
            {/* <DropdownMenuGroup>
              <DropdownMenuItem>
                <Sparkles />
                Upgrade to Pro
              </DropdownMenuItem>
            </DropdownMenuGroup> */}
           {/* <DropdownMenuGroup>
              <DropdownMenuItem>
                <BadgeCheck />
                Account
              </DropdownMenuItem>
              <DropdownMenuItem>
                <CreditCard />
                Billing
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Bell />
                Notifications
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator /> */}
            
            {/* Organization Selection */}
            {/* {availableOrganizations && availableOrganizations.length > 0 && (
              <>
                <DropdownMenuLabel className="text-muted-foreground text-xs px-1 pt-2">
                  Organizations
                </DropdownMenuLabel>
                {availableOrganizations.map((org, index) => {
                  const orgName = org?.org_name || org?.name;
                  const orgId = org?.org_id || org?.organization_id;
                  const isActive = currentOrganization && 
                    (currentOrganization?.org_id === orgId);
                  
                  return (
                    <DropdownMenuItem
                      key={orgId || index}
                      onClick={() => handleOrganizationSwitch(orgId, orgName)}
                      className={`gap-2 p-2 ${isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground' : ''}`}
                    >
                      <Building2 className="size-4" />
                      <span className="truncate">{orgName}</span>
                    </DropdownMenuItem>
                  )
                })}
                
                <DropdownMenuItem className="gap-2 p-2">
                  <Plus className="size-4" />
                  <span className="text-muted-foreground">Add Organization</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )} */}
            
            <DropdownMenuItem onClick={() => handleLogout()}>
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
