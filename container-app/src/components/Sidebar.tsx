import { NavLink } from "react-router-dom";
import { cn } from "@/utils/cn";

export interface SidebarNavItem {
  label: string;
  path: string;
}

interface SidebarProps {
  items?: SidebarNavItem[];
  className?: string;
}

/**
 * Container-owned navigation, e.g. a picker across multiple micro-frontends
 * once more than one remote exists. workflow-app renders its own sidebar
 * internally, so this is not shown while the workflow remote is mounted
 * (see routes/AppRoutes.tsx).
 */
export function Sidebar({ items = [], className }: SidebarProps) {
  return (
    <aside
      className={cn(
        "flex w-56 shrink-0 flex-col gap-1 border-r border-sidebar-border bg-sidebar p-3",
        className,
      )}
    >
      {items.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            cn(
              "rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-muted",
              isActive && "bg-muted font-medium",
            )
          }
        >
          {item.label}
        </NavLink>
      ))}
    </aside>
  );
}
