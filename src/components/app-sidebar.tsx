// import * as React from "react";
// import { NavUser } from "@/components/nav-user";
// import {
//   Sidebar,
//   SidebarContent,
//   SidebarFooter,
//   SidebarHeader,
//   SidebarMenu,
//   SidebarMenuButton,
//   SidebarMenuItem,
//   SidebarRail,
// } from "@/components/ui/sidebar";
// import { useAuth } from "@/context/auth/authContext";
// import { SidebarDataComponent } from "./layout/data/sidebar-data";
// import { NavGroup } from "./nav-group";
// import { useNavigate } from "react-router-dom";
// import { TeamSwitcher } from "./team-switcher";

// export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) { 
//   const navigate = useNavigate();
//   const { state: authState } = useAuth();
//   const { sidebarData } = SidebarDataComponent();
//   const userInfo = { 
//     ...sidebarData.user,
//     email: authState?.authInfo?.user["email"],
//     name:
//       authState?.authInfo?.user["first_name"] +
//       " " +
//       authState?.authInfo?.user["last_name"],
//   };

//   return (
//     <Sidebar collapsible="icon" {...props} variant="floating">
//       <SidebarHeader>
//         {/* <SidebarMenu>
//           <SidebarMenuItem>
//             <SidebarMenuButton size="lg">
//               <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
//                 <sidebarData.app.logo onClick={() => navigate("/dashboard")} className="size-4 cursor-pointer"/>
//               </div>
//               <div className="grid flex-1 text-left text-sm leading-tight">
//                 <span className="truncate font-semibold">
//                   {sidebarData?.app?.name}
//                 </span>
//                 <span className="truncate text-xs">
//                   {sidebarData?.app?.plan}
//                 </span>
//               </div>
//             </SidebarMenuButton>
//           </SidebarMenuItem>
//         </SidebarMenu> */}
//         <TeamSwitcher teams={sidebarData.teams} />
//       </SidebarHeader>
//       <SidebarContent className="!ml-0">
//         {sidebarData?.navGroups?.map((props) => (
//           <NavGroup key={props.title} {...props} />
//         ))}
//       </SidebarContent>
//       <SidebarFooter>
//         <NavUser user={userInfo} />
//       </SidebarFooter>
//       {/* <SidebarRail /> */}
//     </Sidebar>
//   );
// }


import * as React from "react";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/context/auth/authContext";
import { useRbacStore } from "@/stores/useRBACStore";
import { SidebarDataComponent } from "./layout/data/sidebar-data";
import { NavGroup } from "./nav-group";
import { ProjectsSwitcher } from "./projects-switcher";
import { CollapsedSelectionProvider, useCollapsedSelection } from '@/components/CollapsedSelectionContext'
import { ChevronLeft } from 'lucide-react'


export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { state: authState } = useAuth();
  const { currentUser, activePerspective } = useRbacStore();
  const { sidebarData } = SidebarDataComponent();
  const { state } = useSidebar()
  // Use RBAC store user info or fallback to auth context

  const userInfo = React.useMemo(() => {
    if (currentUser) {
      return {
        ...currentUser,
        email: currentUser.email || authState?.authInfo?.user?.email,
        name: currentUser.name ||
          `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() ||
          `${authState?.authInfo?.user?.first_name || ''} ${authState?.authInfo?.user?.last_name || ''}`.trim(),
        avatar: "/avatars/shadcn.jpg",
      };
    }

    // Fallback to auth context user
    return {
      ...sidebarData.user,
      email: authState?.authInfo?.user?.email,
      name: `${authState?.authInfo?.user?.first_name || ''} ${authState?.authInfo?.user?.last_name || ''}`.trim(),
    };
  }, [currentUser, authState?.authInfo?.user, sidebarData.user]);

  // Show loading or empty state if no perspective is active
  if (!activePerspective) {
    return (
      <Sidebar collapsible="icon" {...props} variant="floating">
        <SidebarHeader>
          <div className="flex items-center justify-center">
            {state !== "collapsed" && (
             <></>
            )}
          </div>

          <ProjectsSwitcher />
        </SidebarHeader>
        <SidebarContent className="!ml-0">
          <div className="flex items-center justify-center h-32 text-center px-4">
            <div className="text-sm text-muted-foreground">
              Please select a perspective to view navigation menu
            </div>
          </div>
        </SidebarContent>
        <SidebarFooter>
          <NavUser user={userInfo} />
        </SidebarFooter>
      </Sidebar>
    );
  }

  // Show navigation based on active perspective
  return (
    <CollapsedSelectionProvider>
      <SidebarWithSelection {...props} userInfo={userInfo} sidebarData={sidebarData} />
    </CollapsedSelectionProvider>
  )
}

function SidebarWithSelection({ userInfo, sidebarData, ...props }: { userInfo: any; sidebarData: any } & React.ComponentProps<typeof Sidebar>) {
  const { state } = useSidebar()
  const { selectedKey, setSelectedKey } = useCollapsedSelection()

  return (
    <Sidebar collapsible="icon" {...props} variant="floating">
      <SidebarHeader className="gap-0 relative">
        <div className="flex items-center justify-center" >
          {state === 'collapsed' && selectedKey ? (
            <div className="absolute left-2 top-2">
              <button
                aria-label="Back"
                onClick={() => setSelectedKey(null)}
                className="flex items-center gap-2 px-2 py-1 rounded hover:bg-primary/10"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
          ) : null}

          {state !== "collapsed" && (
            <></>
          )}
        </div>
        <ProjectsSwitcher />
      </SidebarHeader>
      <SidebarContent className="!ml-0">
        {sidebarData?.navGroups && sidebarData.navGroups.length > 0 ? (
          sidebarData.navGroups.map((group) => (
            <NavGroup key={group.title} {...group} />
          ))
        ) : (
          <div className="flex items-center justify-center h-32 text-center px-4">
            <div className="text-sm text-muted-foreground">
              No navigation items available for the current perspective
            </div>
          </div>
        )}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={userInfo} />
      </SidebarFooter>
      {/* <SidebarRail /> */}
    </Sidebar>
  )
}
