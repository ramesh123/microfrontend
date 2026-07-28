import { useMemo, useState } from 'react';
import { Check, FolderPlus, LayoutTemplate } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useRbacStore } from '@/stores/useRBACStore';
import { flattenSelectableMenuItems } from '../../lib/menu/flatten-menu-items';
import { useDynamicFormAssignmentStore } from '../../stores/useDynamicFormAssignmentStore';

type SaveMode = 'create' | 'existing';

export interface FormMenuSaveResult {
  menuPath: string;
  menuTitle: string;
  mode: SaveMode;
  parentPath?: string | null;
}

interface FormMenuAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTitle?: string;
  onConfirm: (result: FormMenuSaveResult) => void;
}

function slugifyPathSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function FormMenuAssignmentDialog({
  open,
  onOpenChange,
  defaultTitle = 'My Form',
  onConfirm,
}: FormMenuAssignmentDialogProps) {
  const { activePerspective, currentUser, menu_items } = useRbacStore();
  const assignmentsByPath = useDynamicFormAssignmentStore((state) => state.assignmentsByPath);
  const createdMenuItems = useDynamicFormAssignmentStore((state) => state.createdMenuItems);

  const [mode, setMode] = useState<SaveMode>('create');
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [menuName, setMenuName] = useState(defaultTitle);
  const [navPath, setNavPath] = useState(`/forms/${slugifyPathSegment(defaultTitle) || 'new-form'}`);
  const [parentPath, setParentPath] = useState<string>('__root__');

  const menuOptions = useMemo(() => {
    const source = activePerspective?.menu_items?.length
      ? activePerspective.menu_items
      : currentUser?.role === 'Admin'
        ? menu_items
        : [];

    return flattenSelectableMenuItems(source ?? []).filter((item) => item.path !== '/dynamic-forms');
  }, [activePerspective?.menu_items, currentUser?.role, menu_items]);

  const parentOptions = useMemo(() => {
    const fromPerspective = menuOptions.map((item) => ({
      path: item.path,
      label: item.label,
    }));
    const fromCreated = createdMenuItems.map((item) => ({
      path: item.path,
      label: item.title,
    }));
    const seen = new Set<string>();
    return [...fromPerspective, ...fromCreated].filter((item) => {
      if (seen.has(item.path)) return false;
      seen.add(item.path);
      return true;
    });
  }, [menuOptions, createdMenuItems]);

  const resetAndClose = () => {
    onOpenChange(false);
    setSelectedPath(null);
    setMode('create');
  };

  const handleConfirm = () => {
    if (mode === 'create') {
      const title = menuName.trim();
      let path = navPath.trim();
      if (!title) {
        toast.error('Enter a menu item name');
        return;
      }
      if (!path) {
        toast.error('Enter a navigation path');
        return;
      }
      if (!path.startsWith('/')) path = `/${path}`;
      path = path.replace(/\/$/, '') || '/';

      if (path === '/dynamic-forms') {
        toast.error('Choose a different path than the form builder');
        return;
      }

      if (assignmentsByPath[path] || createdMenuItems.some((item) => item.path === path)) {
        toast.error('That path is already used — pick another navigation path');
        return;
      }

      onConfirm({
        menuPath: path,
        menuTitle: title,
        mode: 'create',
        parentPath: parentPath === '__root__' ? null : parentPath,
      });
      resetAndClose();
      return;
    }

    const selected = menuOptions.find((item) => item.path === selectedPath);
    if (!selected) return;
    onConfirm({
      menuPath: selected.path,
      menuTitle: selected.title,
      mode: 'existing',
    });
    resetAndClose();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 p-0">
        <DialogHeader className="border-b border-gray-border px-5 py-4">
          <DialogTitle>Save form to menu</DialogTitle>
          <DialogDescription>
            Create a new sidebar item (recommended), or assign to an existing tab.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-1 border-b border-gray-border px-3 pt-3">
          <button
            type="button"
            onClick={() => setMode('create')}
            className={cn(
              'rounded-t-md px-3 py-2 text-xs font-medium',
              mode === 'create'
                ? 'border border-b-0 border-gray-border bg-background text-gray-text'
                : 'text-gray-text-muted hover:text-gray-text',
            )}
          >
            Create new menu item
          </button>
          <button
            type="button"
            onClick={() => setMode('existing')}
            className={cn(
              'rounded-t-md px-3 py-2 text-xs font-medium',
              mode === 'existing'
                ? 'border border-b-0 border-gray-border bg-background text-gray-text'
                : 'text-gray-text-muted hover:text-gray-text',
            )}
          >
            Existing menu tab
          </button>
        </div>

        {mode === 'create' ? (
          <div className="space-y-3 px-5 py-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Menu item name</Label>
              <Input
                value={menuName}
                onChange={(event) => {
                  const next = event.target.value;
                  setMenuName(next);
                  const slug = slugifyPathSegment(next);
                  if (slug) setNavPath(`/forms/${slug}`);
                }}
                placeholder="Users"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Navigation path</Label>
              <Input
                value={navPath}
                onChange={(event) => setNavPath(event.target.value)}
                placeholder="/forms/users"
                className="h-9 font-mono text-xs"
              />
              <p className="text-[10px] text-gray-text-muted">
                Unique URL path for this form. Does not overwrite existing menu items.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Add under</Label>
              <Select value={parentPath} onValueChange={setParentPath}>
                <SelectTrigger className="!h-9 !text-xs">
                  <SelectValue placeholder="Top level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__root__">Top level (new group item)</SelectItem>
                  {parentOptions.map((item) => (
                    <SelectItem key={item.path} value={item.path}>
                      Under: {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : (
          <div className="max-h-[min(50vh,360px)] overflow-y-auto px-3 py-3">
            <p className="mb-2 px-2 text-[11px] text-amber-700 dark:text-amber-400">
              Assigning to an existing tab replaces that tab’s content with this form (in memory).
            </p>
            {menuOptions.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-gray-text-muted">
                No menu items available. Use “Create new menu item” instead.
              </p>
            ) : (
              <div className="space-y-1">
                {menuOptions.map((item) => {
                  const selected = selectedPath === item.path;
                  const assigned = !!assignmentsByPath[item.path];

                  return (
                    <button
                      key={`${item.p_id}-${item.path}`}
                      type="button"
                      onClick={() => setSelectedPath(item.path)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
                        selected
                          ? 'border-primary bg-primary/5'
                          : 'border-transparent hover:border-gray-border hover:bg-gray-surface/60',
                      )}
                    >
                      <div
                        className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
                          selected ? 'bg-primary/15 text-primary' : 'bg-gray-elevated text-gray-text-muted',
                        )}
                      >
                        {selected ? <Check className="h-4 w-4" /> : <LayoutTemplate className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-text">{item.label}</p>
                        <p className="truncate font-mono text-[10px] text-gray-text-muted">{item.path}</p>
                      </div>
                      {assigned && (
                        <Badge variant="secondary" className="shrink-0 text-[10px]">
                          Replaces
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="border-t border-gray-border px-5 py-4">
          <Button type="button" variant="ghost" onClick={resetAndClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={mode === 'existing' && !selectedPath}
            className="gap-1.5"
            onClick={handleConfirm}
          >
            {mode === 'create' ? (
              <>
                <FolderPlus className="h-3.5 w-3.5" />
                Create & save
              </>
            ) : (
              'Save to menu tab'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
