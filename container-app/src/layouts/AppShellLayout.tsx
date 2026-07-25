import { Outlet } from "react-router-dom";
import { Header } from "@/components/Header";
import { Sidebar, type SidebarNavItem } from "@/components/Sidebar";
import { Footer } from "@/components/Footer";

const NAV_ITEMS: SidebarNavItem[] = [{ label: "Workflow", path: "/" }];

/**
 * Full shell (Header + Sidebar + Footer + Outlet) for container-owned pages.
 * NOT used to wrap the mounted workflow-app remote — that remote ships its
 * own header/sidebar already (see routes/AppRoutes.tsx for why). This layout
 * is the pattern for the next micro-frontend that doesn't bring its own chrome.
 */
export function AppShellLayout() {
  return (
    <div className="flex h-screen w-full flex-col">
      <Header />
      <div className="flex min-h-0 flex-1">
        <Sidebar items={NAV_ITEMS} />
        <main className="min-w-0 flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
      <Footer />
    </div>
  );
}
