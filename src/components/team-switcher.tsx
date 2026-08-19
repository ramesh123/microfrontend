// import * as React from "react"
// import { ChevronsUpDown, Plus, Building2 } from "lucide-react"

// import {
//   DropdownMenu,
//   DropdownMenuContent,
//   DropdownMenuItem,
//   DropdownMenuLabel,
//   DropdownMenuSeparator,
//   DropdownMenuShortcut,
//   DropdownMenuTrigger,
// } from "@/components/ui/dropdown-menu"
// import {
//   SidebarMenu,
//   SidebarMenuButton,
//   SidebarMenuItem,
//   useSidebar,
// } from "@/components/ui/sidebar"
// import { useOrganizationStore } from "@/stores/organizationStore"
// import { useEffect } from "react"

// export function TeamSwitcher({
//   teams,
// }: {
//   teams: {
//     name: string
//     logo: React.ElementType
//     plan: string
//   }[]
// }) {
//   const { isMobile } = useSidebar()
//   const { currentOrgId, organizations } = useOrganizationStore()

//   // Get organizations from localStorage to check current state
//   const getApiOrganizations = React.useCallback(() => {
//     try {
//       const apiOrgsData = localStorage.getItem('api_organizations');
//       return apiOrgsData ? JSON.parse(apiOrgsData) : [];
//     } catch (e) {
//       return [];
//     }
//   }, []);

//   // Find the active team based on the current organization
//   const getCurrentTeam = React.useCallback(() => {
//     // First check if we have API organizations
//     const apiOrgs = getApiOrganizations();
//     if (apiOrgs.length > 0) {
//       // Use the first API organization
//       const firstApiOrg = apiOrgs[0];
//       return {
//         name: firstApiOrg.organization_name,
//         logo: Building2,
//         plan: "Enterprise"
//       };
//     }

//     // Fall back to organizations from store
//     if (currentOrgId && organizations.length > 0) {
//       const currentOrg = organizations.find(org => org.id === currentOrgId)
//       if (currentOrg) {
//         return {
//           name: currentOrg.name || currentOrg.org_name,
//           logo: teams[0]?.logo || Building2,
//           plan: currentOrg.plan || "Enterprise"
//         }
//       }
//     }
    
//     // Final fallback to first team
//     return teams[0] || { name: "Default Organization", logo: Building2, plan: "Enterprise" }
//   }, [currentOrgId, organizations, teams, getApiOrganizations])

//   const [activeTeam, setActiveTeam] = React.useState(getCurrentTeam())

//   // Update active team when current organization changes
//   useEffect(() => {
//     setActiveTeam(getCurrentTeam())
//   }, [getCurrentTeam])

//   if (!activeTeam) {
//     return null
//   }

//   return (
//     <SidebarMenu>
//       <SidebarMenuItem>
//         <DropdownMenu>
//           <DropdownMenuTrigger asChild>
//             <SidebarMenuButton
//               size="lg"
//               className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
//             >
//               <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
//                 <activeTeam.logo className="size-4" />
//               </div>
//               <div className="grid flex-1 text-left text-sm leading-tight">
//                 <span className="truncate font-medium">{activeTeam.name}</span>
//                 <span className="truncate text-xs">{activeTeam.plan}</span>
//               </div>
//               <ChevronsUpDown className="ml-auto" />
//             </SidebarMenuButton>
//           </DropdownMenuTrigger>
//           <DropdownMenuContent
//             className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
//             align="start"
//             side={isMobile ? "bottom" : "bottom"}
//             sideOffset={4}
//           >
//             <DropdownMenuLabel className="text-muted-foreground text-xs">
//               Organizations
//             </DropdownMenuLabel>
//             {teams.map((team, index) => {
//               const isActive = activeTeam.name === team.name
//               return (
//                 <DropdownMenuItem
//                   key={index}
//                   onClick={() => {
//                     setActiveTeam(team)
//                     // Find and select the corresponding organization
//                     const matchingOrg = organizations.find(org => 
//                       (org.name || org.org_name) === team.name
//                     )
//                     if (matchingOrg) {
//                       // Here you could trigger organization selection
//                       console.log("Selected organization:", matchingOrg)
//                     }
//                   }}
//                   className={`gap-2 p-2 ${isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground' : ''}`}
//                 >
//                   <div className="flex size-6 items-center justify-center rounded-md border">
//                     <team.logo className="size-3.5 shrink-0" />
//                   </div>
//                   {team.name}
//                   <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
//                 </DropdownMenuItem>
//               )
//             })}
//             <DropdownMenuSeparator />
//             <DropdownMenuItem className="gap-2 p-2">
//               <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
//                 <Plus className="size-4" />
//               </div>
//               <div className="text-muted-foreground font-medium">Add Organization</div>
//             </DropdownMenuItem>
//           </DropdownMenuContent>
//         </DropdownMenu>
//       </SidebarMenuItem>
//     </SidebarMenu>
//   )
// }








import * as React from "react"
import { ChevronsUpDown, Plus, Building2 } from "lucide-react"

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
import { useEffect } from "react"

export function TeamSwitcher({
  teams,
}: {
  teams: {
    name: string
    logo: React.ElementType
    plan: string
  }[]
}) {
  const { isMobile } = useSidebar()
  const { 
    availableOrganizations, 
    currentOrganization, 
    switchOrganization,
    currentUser 
  } = useRbacStore()

  // Get the active team/organization
  const getCurrentTeam = React.useCallback(() => {
    // First check if we have a current organization from RBAC store
    if (currentOrganization) {
      return {
        name: currentOrganization?.org_name || "",
        logo: Building2,
        plan: "Enterprise"
      };
    }

    // Check if we have available organizations from API
    if (availableOrganizations && availableOrganizations.length > 0) {
      const firstOrg = availableOrganizations[0];
      return {
        name: firstOrg.org_name || "",
        logo: Building2,
        plan: "Enterprise"
      };
    }
    
    // Final fallback to first team from props
    return teams[0] || { name: "Default Organization", logo: Building2, plan: "Enterprise" }
  }, [currentOrganization, availableOrganizations, teams])

  const [activeTeam, setActiveTeam] = React.useState(getCurrentTeam())

  // Update active team when current organization changes
  useEffect(() => {
    setActiveTeam(getCurrentTeam())
  }, [getCurrentTeam])

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
      
      // Update local state
      setActiveTeam({
        name: selectedOrg?.org_name || selectedOrg?.name,
        logo: Building2,
        plan: "Enterprise"
      });
    }
  };

  if (!activeTeam || !currentUser) {
    return null
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                <activeTeam.logo className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{activeTeam.name}</span>
                <span className="truncate text-xs">{activeTeam.plan}</span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "bottom"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              Organizations
            </DropdownMenuLabel>
            
            {/* Render available organizations from RBAC store */}
            {availableOrganizations && availableOrganizations.length > 0 ? (
              availableOrganizations.map((org, index) => {
                const orgName = org?.org_name || org?.name;
                const orgId = org?.org_id || org?.organization_id;
                const isActive = currentOrganization && 
                  (currentOrganization?.org_id === orgId);
                
                return (
                  <DropdownMenuItem
                    key={orgId || index}
                    onClick={() => handleOrganizationSwitch(orgId, orgName)}
                    className={isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground' : ''}
                  >
                    <div className="flex size-6 items-center justify-center rounded-md border">
                      <Building2 className="size-3.5 shrink-0" />
                    </div>
                    {orgName}
                    <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
                  </DropdownMenuItem>
                )
              })
            ) : (
              // Fallback to teams prop if no organizations available
              teams.map((team, index) => {
                const isActive = activeTeam.name === team.name
                return (
                  <DropdownMenuItem
                    key={index}
                    onClick={() => setActiveTeam(team)}
                    className={isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground' : ''}
                  >
                    <div className="flex size-6 items-center justify-center rounded-md border">
                      <team.logo className="size-3.5 shrink-0" />
                    </div>
                    {team.name}
                    <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
                  </DropdownMenuItem>
                )
              })
            )}
            
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                <Plus className="size-4" />
              </div>
              <div className="text-muted-foreground font-medium">Add Organization</div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}