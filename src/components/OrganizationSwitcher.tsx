import React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Building, ChevronsUpDown } from 'lucide-react';
import { useRbacStore } from '@/stores/useRBACStore';

export const OrganizationSwitcher: React.FC = () => {
  const {
    availableOrganizations,
    currentOrganization,
    switchOrganization,
  } = useRbacStore();

  if (availableOrganizations.length <= 1) {
    console.log("No organizations available", availableOrganizations);
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-[200px] justify-between">
          <div className="flex items-center gap-2">
            <Building className="h-4 w-4" />
            <span className="truncate text-xs text-muted-foreground">{currentOrganization?.name || 'Select Organization'}</span>
          </div>
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[200px]">
        <DropdownMenuItem
          onClick={() => switchOrganization("*")}
        >
          <Building className="mr-2 h-4 w-4" />
          <span className="truncate text-xs text-muted-foreground">Select All</span>
        </DropdownMenuItem>
        {availableOrganizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => switchOrganization(org.org_id)}
            disabled={org.id === currentOrganization?.id}
          >
            <Building className="mr-2 h-4 w-4" />
            <span className="truncate text-xs text-muted-foreground">{org.org_name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
