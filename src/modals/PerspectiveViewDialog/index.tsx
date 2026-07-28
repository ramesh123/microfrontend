import React from 'react';
import { Perspective, MenuItem } from '@/types/rbac';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import ForwardedIconComponent from '@/components/common/genericIconComponent';
import { cn } from '@/lib/utils';

interface ViewPerspectiveDialogProps {
  perspective: any;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const getPermissionBadgeClass = (action: string): string => {
  const baseClass = "text-xs border";
  switch (action.toLowerCase()) {
    case 'view': case 'read': return `${baseClass} bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800`;
    case 'create': case 'generate': return `${baseClass} bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800`;
    case 'edit': case 'update': return `${baseClass} bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-800`;
    case 'delete': return `${baseClass} bg-red-100 text-red-800 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-800`;
    case 'execute': case 'run': case 'use': return `${baseClass} bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/50 dark:text-purple-300 dark:border-purple-800`;
    default: return `${baseClass} bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600`;
  }
};

const PermissionItem: React.FC<{ item: MenuItem; level: number }> = ({ item, level }) => (
  <div style={{ paddingLeft: `${level * 1.5}rem` }}>
    <div className="flex items-start space-x-3 py-2">
      <ForwardedIconComponent name={item.icon} className="h-4 w-4 mt-1 text-muted-foreground" />
      <div className="flex-1">
        <p className="font-medium">{item.title}</p>
        <div className="flex flex-wrap gap-1 mt-1">
          {item?.permissions?.map((p, i) => (
            <Badge key={i} className={cn(getPermissionBadgeClass(p.action))}>
              {p.action}
            </Badge>
          ))}
          {item?.permissions?.length === 0 && <span className="text-xs text-muted-foreground">No direct permissions</span>}
        </div>
      </div>
    </div>
    {item.children && item.children.map(child => (
      <PermissionItem key={child.p_id} item={child} level={level + 1} />
    ))}
  </div>
);

export const PerspectiveViewDialog: React.FC<ViewPerspectiveDialogProps> = ({ perspective, isOpen, onOpenChange }) => {

  console.log("perspective", perspective);
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg md:max-w-xl lg:max-w-3xl gap-2">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ForwardedIconComponent name={perspective.icon} /> {perspective.name}
          </DialogTitle>
          <DialogDescription>{perspective.description}</DialogDescription>
        </DialogHeader>
        <div className="py-0">
          <h4 className="font-semibold mb-3">Permissions Included:</h4>
          <ScrollArea className="h-96 rounded-md border p-4">
            <div className="space-y-2">
              {perspective.menu_items?.map((item: MenuItem) => (
                <PermissionItem key={item.p_id} item={item} level={0} />
              ))}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};
