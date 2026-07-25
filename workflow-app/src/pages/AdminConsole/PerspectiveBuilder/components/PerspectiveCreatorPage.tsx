import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MenuItemConfig, PermissionOption } from '@/data/sap-menu-structure';
import { ForwardedIconComponent } from '@/components/common/genericIconComponent';
import { ChevronRight, ArrowLeft, Copy, Check, Plus, Trash2, Pencil, X } from 'lucide-react';
import { toast } from 'sonner';
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { v4 as uuidv4 } from 'uuid';
import { useRbacStore } from '@/stores/useRBACStore';
import { MenuItem, Permission } from '@/types/rbac';
import { apiMenu } from '@/data/all_org';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getProjectsNamesApi, getBusinessProcessApi } from '@/controllers/API';
import { MultiSelectCombobox } from '@/components/ui/multi-select';

type SelectedPermissions = Map<string, Set<string>>;

type PerspectiveFormSnapshotInput = {
  name: string;
  description: string;
  icon: string;
  platformId: string;
  selectedProjects: (string | number)[];
  selectedBusinessProcesses: (string | number)[];
  selectedPermissions: SelectedPermissions;
  editableMenu: MenuItemConfig[];
};

const serializePerspectiveFormSnapshot = ({
  name,
  description,
  icon,
  platformId,
  selectedProjects,
  selectedBusinessProcesses,
  selectedPermissions,
  editableMenu,
}: PerspectiveFormSnapshotInput): string => {
  const permissionEntries = Array.from(selectedPermissions.entries())
    .map(([id, actions]) => [id, Array.from(actions).sort()] as const)
    .sort(([a], [b]) => a.localeCompare(b));

  return JSON.stringify({
    name,
    description,
    icon,
    platformId,
    selectedProjects: [...selectedProjects].map(String).sort(),
    selectedBusinessProcesses: [...selectedBusinessProcesses].map(String).sort(),
    permissions: permissionEntries,
    editableMenu,
  });
};

/** Compact switch for permission rows (thumb travel matches w-9 + h-4 thumb). */
const permissionSwitchClassName =
  'h-5 w-9 shrink-0 border [&>span]:h-4 [&>span]:w-4 data-[state=checked]:[&>span]:translate-x-4 data-[state=unchecked]:[&>span]:translate-x-0';

const MenuItemDialog: React.FC<{
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (item: Partial<MenuItemConfig>) => void;
  item?: Partial<MenuItemConfig> | null;
}> = ({ isOpen, onOpenChange, onSave, item }) => {
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState('');
  const [path, setPath] = useState('');
  const [permissions, setPermissions] = useState<PermissionOption[]>([]);

  useEffect(() => {
    if (isOpen) {
      if (item) {
        setTitle(item.title || '');
        setIcon(item.icon || '');
        setPath(item.path || '');
        setPermissions(item.permissions || []);
      } else {
        setTitle('');
        setIcon('File');
        setPath('/');
        setPermissions([]);
      }
    }
  }, [item, isOpen]);

  const handleSave = () => {
    onSave({ ...item, title, icon, path, permissions });
    onOpenChange(false);
  };

  const addPermission = () => setPermissions([...permissions, { action: '', label: '' }]);
  const removePermission = (index: number) => setPermissions(permissions.filter((_, i) => i !== index));
  const updatePermission = (index: number, field: 'action' | 'label', value: string) => {
    const newPermissions = [...permissions];
    newPermissions[index][field] = value;
    setPermissions(newPermissions);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader><DialogTitle>{item ? 'Edit' : 'Create'} Menu Item</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="name" className="text-right">Label</Label><Input id="name" value={title} onChange={(e) => setTitle(e.target.value)} className="col-span-3" /></div>
          <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="icon" className="text-right">Icon</Label><Input id="icon" value={icon} onChange={(e) => setIcon(e.target.value)} className="col-span-3" /></div>
          <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="path" className="text-right">Path</Label><Input id="path" value={path} onChange={(e) => setPath(e.target.value)} className="col-span-3" /></div>
          <div>
            <Label>Permissions</Label>
            <div className="space-y-2 mt-2">
              {permissions.map((p, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input placeholder="Action (e.g., 'view')" value={p.action} onChange={(e) => updatePermission(index, 'action', e.target.value)} />
                  <Input placeholder="Label (e.g., 'View')" value={p.label} onChange={(e) => updatePermission(index, 'label', e.target.value)} />
                  <Button variant="ghost" size="icon" onClick={() => removePermission(index)}><X className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={addPermission} className="mt-2">Add Permission</Button>
          </div>
        </div>
        <DialogFooter><Button onClick={handleSave}>Save changes</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const MenuItemNode: React.FC<{
  item: MenuItemConfig;
  selectedPermissions: SelectedPermissions;
  onPermissionChange: (itemId: string, action: string, checked: boolean) => void;
  onEdit: (item: MenuItemConfig) => void;
  onDelete: (itemId: string) => void;
  onAddChild: (parentId: string) => void;
  level: number;
}> = ({ item, selectedPermissions, onPermissionChange, onEdit, onDelete, onAddChild, level }) => {
  const itemPermissions = selectedPermissions.get(item.p_id) || new Set();
  const areAllPermissionsSelected = item?.permissions?.length > 0 && item.permissions.every(p => itemPermissions.has(p.action));
  const [isAlertOpen, setIsAlertOpen] = useState(false);

  const handleSelectAll = (checked: boolean) => item.permissions.forEach(p => onPermissionChange(item.p_id, p.action, checked));

  return (
    <div>
      <div className="flex items-center space-x-2 py-1 group/menu-item">
        <div style={{ paddingLeft: `${level * 1.25}rem` }} className="flex min-w-0 flex-1 items-center">
          {item.children && <CollapsibleTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6 -ml-1"><ChevronRight className="h-3.5 w-3.5 transition-transform duration-200 group-data-[state=open]:rotate-90" /></Button></CollapsibleTrigger>}
          {!item.children && <div className="w-3.5" />}
          <ForwardedIconComponent name={item.icon} className="ml-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="ml-1.5 flex-1 truncate text-xs font-medium">{item.title}</span>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover/menu-item:opacity-100">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onAddChild(item.p_id)}><Plus className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit(item)}><Pencil className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setIsAlertOpen(true)}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      </div>
      <div className="space-y-1 pb-1.5" style={{ paddingLeft: `${level * 1.25 + 2}rem` }}>
        {item?.permissions?.length > 0 && (
          <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/50 px-2 py-1 shadow-sm">
            <Label htmlFor={`${item.p_id}-all`} className="cursor-pointer text-[11px] font-semibold leading-none">
              Select All
            </Label>
            <Switch
              id={`${item.p_id}-all`}
              className={permissionSwitchClassName}
              checked={areAllPermissionsSelected}
              onCheckedChange={handleSelectAll}
            />
          </div>
        )}
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4">
          {item?.permissions?.map(p => (
            <div
              key={p.action}
              className="flex min-w-0 items-center justify-between gap-1.5 rounded-md border bg-background px-2 py-1 shadow-sm"
            >
              <Label
                htmlFor={`${item.p_id}-${p.action}`}
                className="cursor-pointer truncate pr-1 text-[11px] font-medium leading-tight"
              >
                {p.label}
              </Label>
              <Switch
                id={`${item.p_id}-${p.action}`}
                className={permissionSwitchClassName}
                checked={itemPermissions.has(p.action)}
                onCheckedChange={(checked) => onPermissionChange(item.p_id, p.action, checked)}
              />
            </div>
          ))}
        </div>
      </div>
      {item?.children && <CollapsibleContent>
        <div className="border-l ml-3">
          {item?.children?.map(child => <Collapsible key={child.p_id}>
            <MenuItemNode item={child} {...{ selectedPermissions, onPermissionChange, onEdit, onDelete, onAddChild, level: level + 1 }} />
          </Collapsible>)}
        </div>
      </CollapsibleContent>}
      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete "{item?.title}" and all its sub-items.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => onDelete(item.p_id)}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export const PerspectiveCreatorPage: React.FC = () => {
  const { id: perspectiveId } = useParams();
  const navigate = useNavigate();
  const { availablePerspectives, currentOrganization, createPerspective, updatePerspective, getProductGroup } = useRbacStore();
  const isEditing = Boolean(perspectiveId);

  const [step, setStep] = useState(1);
  const [platformId, setPlatformId] = useState('');
  const [productGroup, setProductGroup] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('Shield');
  const [selectedProjects, setSelectedProjects] = useState<(string | number)[]>([]);
  const [selectedBusinessProcesses, setSelectedBusinessProcesses] = useState<(string | number)[]>([]);
  const [projects, setProjects] = useState<Array<{ value: string | number, label: string, org_id: string }>>([]);
  const [businessProcesses, setBusinessProcesses] = useState<Array<{ value: string | number, label: string }>>([]);
  const subprocessOptions = [
    { value: 'sp1', label: 'SP1' },
    { value: 'sp2', label: 'SP2' },
    { value: 'sp3', label: 'SP3' },
    { value: 'sp4', label: 'SP4' },
    { value: 'sp5', label: 'SP5' }
  ];
  const [selectedPermissions, setSelectedPermissions] = useState<SelectedPermissions>(new Map());
  const [generatedJson, setGeneratedJson] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [editableMenu, setEditableMenu] = useState<MenuItemConfig[]>(() =>
    JSON.parse(JSON.stringify(apiMenu.menu_items as unknown as MenuItemConfig[])),
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<MenuItemConfig> | null>(null);
  const [editingParentId, setEditingParentId] = useState<string | null>(null);
  const [initialFormSnapshot, setInitialFormSnapshot] = useState<string | null>(null);

  useEffect(() => {

    getProductGroup().then((product_group: any) => {
      return setProductGroup(product_group);
    });

    // Fetch projects
    getProjectsNamesApi().then((response: any) => {
      if (response?.data && response.data.length > 0) {
        const options = response.data.map((project: any) => ({
          value: project.id,
          label: project.name,
          org_id: project.org_id?.[0] ?? '',
        }));
        setProjects(options);
      }
    }).catch((error) => {
      console.error('Error fetching projects:', error);
    });

    // Fetch business processes
    getBusinessProcessApi().then((response: any) => {
      if (response?.data && response.data.length > 0) {
        const options = response.data.map((bp: any) => ({
          value: bp.id,
          label: bp.business_process_name
        }));
        setBusinessProcesses(options);
      }
    }).catch((error) => {
      console.error('Error fetching business processes:', error);
    });
  }, []);
  useEffect(() => {
    if (isEditing) {
      const perspectiveToEdit = availablePerspectives.find(p => p.id.toString() === perspectiveId);
      if (perspectiveToEdit) {
        setName(perspectiveToEdit.name);
        setDescription(perspectiveToEdit.description);
        setIcon(perspectiveToEdit.icon);
        setPlatformId(perspectiveToEdit.platform);
        // Load saved projects and business processes if editing
        if (perspectiveToEdit.project_id) {
          setSelectedProjects(Array.isArray(perspectiveToEdit.project_id) ? perspectiveToEdit.project_id : [perspectiveToEdit.project_id]);
        }
        if (perspectiveToEdit.subprocess) {
          setSelectedBusinessProcesses(Array.isArray(perspectiveToEdit.subprocess) ? perspectiveToEdit.subprocess : [perspectiveToEdit.subprocess]);
        }

        const expandToConfig = (items: MenuItem[], masterStructure: MenuItemConfig[]): MenuItemConfig[] => {
          const masterMap = new Map<string, MenuItemConfig>();
          const buildMasterMap = (masterItems: MenuItemConfig[]) => {
            masterItems.forEach(item => {
              masterMap.set(item.p_id, item);
              if (item.children) buildMasterMap(item.children);
            });
          };
          buildMasterMap(masterStructure);

          const reconstruct = (currentItems: MenuItem[]): MenuItemConfig[] => {
            return currentItems?.map(currentItem => {
              const masterItem = masterMap.get(currentItem.p_id);
              const reconstructedItem: MenuItemConfig = {
                p_id: currentItem.p_id,
                title: currentItem.title,
                icon: currentItem.icon,
                path: currentItem.path,
                permissions: masterItem
                  ? masterItem.permissions?.map(p => ({ action: p.action, label: p.action.charAt(0).toUpperCase() + p.action.slice(1) })) || []
                  : currentItem.permissions?.map(p => ({ action: p.action, label: p.action.charAt(0).toUpperCase() + p.action.slice(1) })) || [],
                children: currentItem.children ? reconstruct(currentItem.children) : undefined
              };
              return reconstructedItem;
            });
          };
          return reconstruct(items);
        };

        const mergeMenus = (base: MenuItemConfig[], perspective: MenuItemConfig[]): MenuItemConfig[] => {
          const perspectiveMap = new Map(perspective?.map(item => [item.p_id, item]));
          const result: MenuItemConfig[] = perspective?.length > 0 ? [...perspective] : [...base];
          const resultIds = new Set(result.map(i => i.p_id));

          base.forEach(baseItem => {
            const perspectiveItem = perspectiveMap.get(baseItem.p_id);
            if (perspectiveItem) {
              if (baseItem.children) {
                perspectiveItem.children = mergeMenus(baseItem.children, perspectiveItem.children || []);
              }
            } else if (!resultIds.has(baseItem.p_id)) {
              result.push(baseItem);
              resultIds.add(baseItem.p_id);
            }
          });

          return result;
        };

        const expandedPerspectiveMenu = expandToConfig(perspectiveToEdit.menu_items, apiMenu.menu_items as unknown as MenuItemConfig[]);
        const finalMergedMenu = mergeMenus(JSON.parse(JSON.stringify(apiMenu.menu_items)), expandedPerspectiveMenu);
        setEditableMenu(finalMergedMenu);

        const initialPermissions = new Map<string, Set<string>>();
        const populatePermissions = (items: any[]) => {
          items?.forEach(item => {
            if (item.permissions && item.permissions.length > 0) {
              initialPermissions.set(item.p_id, new Set(item.permissions.map((p: Permission) => p.action)));
            }
            if (item.children) {
              populatePermissions(item.children);
            }
          });
        };
        populatePermissions(perspectiveToEdit.menu_items as unknown as MenuItemConfig[]);
        setSelectedPermissions(initialPermissions);

        const loadedProjects = perspectiveToEdit.project_id
          ? Array.isArray(perspectiveToEdit.project_id)
            ? perspectiveToEdit.project_id
            : [perspectiveToEdit.project_id]
          : [];
        const loadedBusinessProcesses = perspectiveToEdit.subprocess
          ? Array.isArray(perspectiveToEdit.subprocess)
            ? perspectiveToEdit.subprocess
            : [perspectiveToEdit.subprocess]
          : [];

        setInitialFormSnapshot(
          serializePerspectiveFormSnapshot({
            name: perspectiveToEdit.name,
            description: perspectiveToEdit.description,
            icon: perspectiveToEdit.icon,
            platformId: perspectiveToEdit.platform,
            selectedProjects: loadedProjects,
            selectedBusinessProcesses: loadedBusinessProcesses,
            selectedPermissions: initialPermissions,
            editableMenu: finalMergedMenu,
          }),
        );
      }
    } else {
      setEditableMenu(JSON.parse(JSON.stringify(apiMenu.menu_items as unknown as MenuItemConfig[])));
      setName('');
      setDescription('');
      setIcon('Shield');
      setPlatformId('');
      setSelectedProjects([]);
      setSelectedBusinessProcesses([]);
      setSelectedPermissions(new Map());
      setInitialFormSnapshot(null);
    }
  }, [isEditing, perspectiveId, availablePerspectives]);

  const handlePermissionChange = useCallback((itemId: string, action: string, checked: boolean) => {
    setSelectedPermissions(prev => {
      const newMap = new Map(prev);
      const permissions = new Set(newMap.get(itemId) || []);
      if (checked) permissions.add(action); else permissions.delete(action);
      if (permissions.size > 0) newMap.set(itemId, permissions); else newMap.delete(itemId);
      return newMap;
    });
  }, []);

  const findAndModify = (items: MenuItemConfig[], id: string, callback: (item: MenuItemConfig, parent: MenuItemConfig[] | null, index: number) => void): boolean => {
    for (let i = 0; i < items.length; i++) {
      if (items[i].p_id === id) { callback(items[i], null, i); return true; }
      if (items[i].children && findAndModify(items[i].children!, id, callback)) return true;
    }
    return false;
  };

  const handleSaveItem = (itemData: Partial<MenuItemConfig>) => {
    const newMenu = JSON.parse(JSON.stringify(editableMenu || []));
    if (itemData.p_id) {
      findAndModify(newMenu, itemData.p_id, (item) => Object.assign(item, itemData));
    } else {
      const newItem: MenuItemConfig = { p_id: uuidv4(), title: itemData.title || 'New', icon: itemData.icon || 'File', path: itemData.path || '/', permissions: itemData.permissions || [], children: [] };
      if (editingParentId) {
        findAndModify(newMenu, editingParentId, (item) => {
          if (!item.children) item.children = [];
          item.children.push(newItem);
        });
      } else {
        newMenu.push(newItem);
      }
    }
    setEditableMenu(newMenu);
  };

  const handleEditItem = (item: MenuItemConfig) => { setEditingItem(item); setEditingParentId(null); setIsDialogOpen(true); };
  const handleAddChildItem = (parentId: string) => { setEditingItem(null); setEditingParentId(parentId); setIsDialogOpen(true); };
  const handleAddTopLevelItem = () => { setEditingItem(null); setEditingParentId(null); setIsDialogOpen(true); };
  const handleDeleteItem = (itemId: string) => {
    const deleteRecursive = (items: MenuItemConfig[]): MenuItemConfig[] => items.filter(item => item.p_id !== itemId).map(item => ({ ...item, children: item.children ? deleteRecursive(item.children) : undefined }));
    setEditableMenu(deleteRecursive(editableMenu));
  };

  useEffect(() => {
    const buildMenu = (items: MenuItemConfig[]): any[] => items?.map(item => {
      const itemPerms = selectedPermissions.get(item.p_id);
      const children = item.children ? buildMenu(item.children) : [];
      if (!itemPerms && children.length === 0) return null;
      const finalPermissions = item?.permissions?.filter(p => itemPerms?.has(p.action)).map(p => ({ action: p.action, resource: item.p_id, label: p.label, description: p.description, action_id: p.action + '-' + item.p_id }));
      const result: any = { p_id: item.p_id, title: item.title, icon: item.icon, path: item.path, permissions: finalPermissions };
      if (children.length > 0) result.children = children;
      return result;
    }).filter(Boolean);
    const perspective = {
      p_id: name.toLowerCase().replace(/\s+/g, '-'),
      name,
      description,
      icon,
      platform: platformId,
      project_id: selectedProjects,
      subprocess: selectedBusinessProcesses,
      menu_items: buildMenu(editableMenu)
    };
    setGeneratedJson(JSON.stringify(perspective, null, 2));
  }, [name, description, icon, selectedPermissions, editableMenu, perspectiveId, selectedProjects, selectedBusinessProcesses]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedJson);
    toast.success('JSON copied to clipboard!');
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleSavePerspective = async () => {
    try {
      const perspectiveData = JSON.parse(generatedJson);
      const projectDetails = projects.find(project => project.value === selectedProjects[0])
      const params = {
        ...perspectiveData,
        perspective_ids: perspectiveData.p_id,
        org_id: currentOrganization?.org_id || projectDetails?.org_id || '',
        org_name: currentOrganization?.org_name || ''
      }
      console.log("params for creating perspective", params);

      if (perspectiveId) {
        await updatePerspective(params, perspectiveId);
        toast.success('Perspective updated successfully!');
      } else {
        await createPerspective(params);
        toast.success('Perspective created successfully!');
      }
      navigate('/perspectives');
    } catch (error) {
      console.error("Error saving perspective:", error);
      toast.error(
        getDisplayErrorMessage(
          error,
          perspectiveId ? 'Failed to update perspective' : 'Failed to create perspective',
        ),
      );
    }
  };

  const isStep1Valid = platformId && name;

  const currentFormSnapshot = useMemo(
    () =>
      serializePerspectiveFormSnapshot({
        name,
        description,
        icon,
        platformId,
        selectedProjects,
        selectedBusinessProcesses,
        selectedPermissions,
        editableMenu,
      }),
    [
      name,
      description,
      icon,
      platformId,
      selectedProjects,
      selectedBusinessProcesses,
      selectedPermissions,
      editableMenu,
    ],
  );

  const hasFormChanges =
    !isEditing || initialFormSnapshot === null || currentFormSnapshot !== initialFormSnapshot;

  return (
    <div className="flex h-full min-h-0 flex-col bg-muted/40">
      <MenuItemDialog isOpen={isDialogOpen} onOpenChange={setIsDialogOpen} onSave={handleSaveItem} item={editingItem} />
      {/* <header className="p-4 border-b bg-background flex justify-between items-center">
        <Button asChild variant="outline" size="sm"><Link to="/perspectives"><ArrowLeft className="mr-2 h-4 w-4" />Back to Perspectives</Link></Button>
        <Button onClick={handleSavePerspective}>Save Perspective</Button>
      </header> */}
      {/* <main className="p-4 md:p-6 grid gap-6 lg:grid-cols-2">
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader><CardTitle>{isEditing ? 'Edit' : 'Create'} Perspective</CardTitle><CardDescription>Define the details for your workspace perspective.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="p-name">Perspective Name</Label>
                <Input id="p-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., SAP Auditor" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-desc">Description</Label>
                <Input id="p-desc" value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g., Read-only access for auditing" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-icon">Icon Name</Label>
                <Input id="p-icon" value={icon} onChange={e => setIcon(e.target.value)} placeholder="e.g., Shield (from Lucide icons)" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div><CardTitle>Menu Permissions</CardTitle><CardDescription>Select actions to include in this perspective.</CardDescription></div>
              <Button onClick={handleAddTopLevelItem}><Plus className="mr-2 h-4 w-4" /> Add Item</Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] pr-4">{editableMenu.map(item =>
                <Collapsible key={item.p_id} className="group border-b last:border-none">
                  <MenuItemNode
                    item={item}
                    selectedPermissions={selectedPermissions}
                    onPermissionChange={handlePermissionChange}
                    onEdit={handleEditItem}
                    onDelete={handleDeleteItem}
                    onAddChild={handleAddChildItem}
                    level={0}
                  />
                </Collapsible>)}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader className="flex flex-row items-center justify-between">
              <div><CardTitle>Generated JSON</CardTitle><CardDescription>This JSON is updated in real-time.</CardDescription></div>
              <Button size="sm" onClick={copyToClipboard}>{isCopied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />} {isCopied ? 'Copied!' : 'Copy'}</Button>
            </CardHeader>
            <CardContent><ScrollArea className="h-[600px] bg-gray-900 text-white rounded-md p-4"><pre><code>{generatedJson}</code></pre></ScrollArea></CardContent>
          </Card>
        </div>
      </main> */}

      <header className="sticky top-0 z-30 flex shrink-0 items-center justify-between gap-2 border-b bg-background/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <Button asChild variant="outline" size="sm" className="!h-8 !px-2">
          <Link to="/perspectives"><ArrowLeft className="mr-0 h-4 w-4" />Back to List</Link>
        </Button>
        <div className="flex items-center gap-1">
          {step === 2 && <Button variant="outline" onClick={() => setStep(1)} className="!h-8 !px-2">Back</Button>}
          {step === 1 && <Button onClick={() => setStep(2)} disabled={!isStep1Valid} className="!h-8 !px-2">Next<ChevronRight className="ml-0 h-4 w-4" /></Button>}
          {step === 2 && (
            <Button
              onClick={handleSavePerspective}
              disabled={!hasFormChanges}
              className="!h-8 !px-2 disabled:cursor-not-allowed"
            >
              Save Perspective
            </Button>
          )}
        </div>
      </header>

      <main
        className={cn(
          "min-h-0 flex-1 p-2",
          step === 2 ? "flex flex-col overflow-hidden" : "overflow-auto",
        )}
      >
        {step === 1 && (
          <div className="mx-auto max-w-2xl">
            <Card className="gap-0 border-border/70 py-0 shadow-sm">
              <CardHeader className="border-b border-border/60 px-3 py-2 [.border-b]:pb-1">
                <CardTitle className="text-[16px] font-semibold">Step 1: Perspective Details</CardTitle>
                <CardDescription className="text-xs">Define the core details for your new perspective.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 px-3 py-3">
                <div className="space-y-2">
                  <Label htmlFor="p-platform">Platform</Label>
                  <Select value={platformId} onValueChange={setPlatformId}>
                    <SelectTrigger id="p-platform" className="w-full">
                      <SelectValue placeholder="Select a platform" />
                    </SelectTrigger>
                    <SelectContent>
                      {productGroup?.map(p => (
                        <SelectItem key={p.id} value={p.platform}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-name">Perspective Name</Label>
                  <Input id="p-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., SAP Auditor" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-project">Projects</Label>
                  <MultiSelectCombobox
                    options={projects}
                    value={selectedProjects}
                    onChange={setSelectedProjects}
                    placeholder="Select projects..."
                    searchPlaceholder="Search projects..."
                    emptyText="No projects found."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-business-process">Business Processes</Label>
                  <MultiSelectCombobox
                    options={businessProcesses}
                    value={selectedBusinessProcesses}
                    onChange={setSelectedBusinessProcesses}
                    placeholder="Select business processes..."
                    searchPlaceholder="Search business processes..."
                    emptyText="No business processes found."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-desc">Description</Label>
                  <Input id="p-desc" value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g., Read-only access for auditing" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-icon">Icon Name</Label>
                  <Input id="p-icon" value={icon} onChange={e => setIcon(e.target.value)} placeholder="e.g., Shield (from Lucide icons)" />
                </div>

              </CardContent>
            </Card>
          </div>
        )}
        {step === 2 && (
          <Card className="flex min-h-0 flex-1 flex-col gap-0 border-border/70 py-0 shadow-sm">
            <CardHeader className="flex shrink-0 flex-row items-center justify-between gap-2 border-b border-border/60 px-3 py-2 [.border-b]:pb-1">
              <div className="min-w-0">
                <CardTitle className="text-[16px] font-semibold">Step 2: Menu Permissions</CardTitle>
                <CardDescription className="text-xs">Select actions to include in this perspective.</CardDescription>
              </div>
              <Button onClick={handleAddTopLevelItem} className="!h-8 shrink-0 !px-2">
                <Plus className="mr-0 h-4 w-4" /> Add Item
              </Button>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col px-3 py-2">
              <ScrollArea className="min-h-0 flex-1 pr-2 text-xs">{editableMenu.map((item) =>
                    <Collapsible key={item.p_id} className="group border-b last:border-none">
                      <MenuItemNode
                        item={item}
                        selectedPermissions={selectedPermissions}
                        onPermissionChange={handlePermissionChange}
                        onEdit={handleEditItem}
                        onDelete={handleDeleteItem}
                        onAddChild={handleAddChildItem}
                        level={0}
                      />
                    </Collapsible>)}
              </ScrollArea>
            </CardContent>
          </Card>
            //  <div className="lg:col-span-1">
            //   <Card className="sticky top-6">
            //     <CardHeader className="flex flex-row items-center justify-between">
            //       <div><CardTitle>Generated JSON</CardTitle><CardDescription>This JSON is updated in real-time.</CardDescription></div>
            //       <Button size="sm" onClick={copyToClipboard}>{isCopied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />} {isCopied ? 'Copied!' : 'Copy'}</Button>
            //     </CardHeader>
            //     <CardContent>
            //       <ScrollArea className="h-[800px] bg-gray-900 text-white rounded-md p-4">
            //         <pre><code>{generatedJson}</code></pre>
            //       </ScrollArea>
            //     </CardContent>
            //   </Card>
            // </div> 
        )}
      </main>
    </div>
  );
};
