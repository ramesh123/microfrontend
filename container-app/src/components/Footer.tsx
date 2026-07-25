import { cn } from "@/utils/cn";

export function Footer({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        "shrink-0 border-t border-border px-4 py-2 text-xs text-muted-foreground",
        className,
      )}
    >
      © {new Date().getFullYear()} Container App
    </footer>
  );
}
