import { cn } from "@/utils/cn";
import { useContainerTheme } from "@/context/ThemeContext";

interface HeaderProps {
  appName?: string;
  className?: string;
}

export function Header({ appName = "Container App", className }: HeaderProps) {
  const { theme, toggleTheme } = useContainerTheme();

  return (
    <header
      className={cn(
        "flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4",
        className,
      )}
    >
      <span className="truncate font-semibold text-foreground">{appName}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleTheme}
          className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted"
        >
          {theme === "light" ? "Dark mode" : "Light mode"}
        </button>
      </div>
    </header>
  );
}
