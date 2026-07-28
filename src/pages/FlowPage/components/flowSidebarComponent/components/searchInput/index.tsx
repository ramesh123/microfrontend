import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function SearchInput() {
  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-sidebar-foreground/50" />
      <Input
        type="search"
        placeholder="Search..."
        className="w-full bg-sidebar-accent pl-8 rounded-md text-sidebar-foreground placeholder:text-sidebar-foreground/50 focus-visible:ring-0 h-9"
      />
    </div>
  );
}

export default SearchInput;