import { useState, useMemo } from 'react';
import { Search, Plus, Trash2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pagination, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, PaginationContent } from '@/components/ui/pagination';
import { Organization, ObjectItem } from '../types/organization';
import { ObjectForm } from '../components/ObjectForm';

interface ObjectsTabProps {
  organizations: Organization[];
  onUpdateOrganizations: (orgs: Organization[]) => void;
}

const ITEMS_PER_PAGE = 10;

export function ObjectsTab({ organizations, onUpdateOrganizations }: ObjectsTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [objectTypeFilter, setObjectTypeFilter] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [subModuleFilter, setSubModuleFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingObject, setEditingObject] = useState<{ object: ObjectItem; orgId: string; appId: string } | null>(null);

  const allObjects = useMemo(() => organizations.flatMap(org =>
    org.applications.flatMap(app =>
      (app.objects || []).map(obj => ({
        ...obj,
        orgId: org.orgId,
        appId: app.id,
      }))
    )
  ), [organizations]);

  const filteredObjects = useMemo(() => allObjects.filter(obj =>
    (obj.objectName.toLowerCase().includes(searchTerm.toLowerCase()) || obj.tcode.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (objectTypeFilter ? obj.objectType === objectTypeFilter : true) &&
    (moduleFilter ? obj.module === moduleFilter : true) &&
    (subModuleFilter ? obj.subModule === subModuleFilter : true)
  ), [allObjects, searchTerm, objectTypeFilter, moduleFilter, subModuleFilter]);

  const totalPages = Math.ceil(filteredObjects.length / ITEMS_PER_PAGE);
  const paginatedObjects = filteredObjects.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleAdd = () => {
    setEditingObject(null);
    setIsFormOpen(true);
  };

  const handleEdit = (obj: ObjectItem, orgId: string, appId: string) => {
    setEditingObject({ object: obj, orgId, appId });
    setIsFormOpen(true);
  };

  const handleDelete = (objectId: string, orgId: string, appId: string) => {
    const updatedOrgs = organizations.map(org => {
      if (org.orgId === orgId) {
        const updatedApps = org.applications.map(app => {
          if (app.id === appId) {
            return { ...app, objects: (app.objects || []).filter(obj => obj.id !== objectId) };
          }
          return app;
        });
        return { ...org, applications: updatedApps };
      }
      return org;
    });
    onUpdateOrganizations(updatedOrgs);
  };

  const handleSave = (objectData: Omit<ObjectItem, 'id'>, orgId: string, appId: string) => {
    const updatedOrgs = organizations.map(org => {
      if (org.orgId === orgId) {
        const updatedApps = org.applications.map(app => {
          if (app.id === appId) {
            if (editingObject) { // Update
              const updatedObjs = (app.objects || []).map(o => o.id === editingObject.object.id ? { ...editingObject.object, ...objectData } : o);
              return { ...app, objects: updatedObjs };
            } else { // Add
              const newObject: ObjectItem = { id: `OBJ-${Date.now()}`, ...objectData };
              return { ...app, objects: [...(app.objects || []), newObject] };
            }
          }
          return app;
        });
        return { ...org, applications: updatedApps };
      }
      return org;
    });
    onUpdateOrganizations(updatedOrgs);
    setIsFormOpen(false);
  };

  if (isFormOpen) {
    return (
      <ObjectForm
        onClose={() => setIsFormOpen(false)}
        onSave={handleSave}
        initialData={editingObject}
        organizations={organizations}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-3 bg-muted/60 rounded-xl border">
        <div className="flex items-center gap-2 flex-wrap w-full">
          <div className="relative flex-grow sm:flex-grow-0 sm:w-60">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
          </div>
          <Select value={objectTypeFilter} onValueChange={setObjectTypeFilter}><SelectTrigger className="w-full sm:w-[150px]"><SelectValue placeholder="Object Type" /></SelectTrigger><SelectContent><SelectItem value="Transaction">Transaction</SelectItem></SelectContent></Select>
          <Select value={moduleFilter} onValueChange={setModuleFilter}><SelectTrigger className="w-full sm:w-[150px]"><SelectValue placeholder="Module" /></SelectTrigger><SelectContent><SelectItem value="FI">FI</SelectItem><SelectItem value="WM">WM</SelectItem></SelectContent></Select>
          <Select value={subModuleFilter} onValueChange={setSubModuleFilter}><SelectTrigger className="w-full sm:w-[150px]"><SelectValue placeholder="Sub Module" /></SelectTrigger><SelectContent><SelectItem value="BL">BL</SelectItem><SelectItem value="AR">AR</SelectItem></SelectContent></Select>
          <Button variant="outline" className="bg-background border-green-500/50 text-green-600 hover:bg-green-500/10 hover:text-green-700">
            <RefreshCw className="h-4 w-4 mr-2" />
            Sync with SAP
          </Button>
        </div>
        <Button onClick={handleAdd} variant="accent" size="sm" className="w-full sm:w-auto flex-shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          Create Object
        </Button>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <Table>
          <TableHeader><TableRow className="bg-muted/60 hover:bg-muted">
            <TableHead>#ID</TableHead>
            <TableHead>Application</TableHead>
            <TableHead>Module</TableHead>
            <TableHead>SubModule</TableHead>
            <TableHead>ObjectType</TableHead>
            <TableHead>Object Name</TableHead>
            <TableHead>TCODE</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-center">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {paginatedObjects.map((obj) => (
              <TableRow key={obj.id}>
                <TableCell>{obj.id}</TableCell>
                <TableCell>{obj.application}</TableCell>
                <TableCell>{obj.module}</TableCell>
                <TableCell>{obj.subModule}</TableCell>
                <TableCell>{obj.objectType}</TableCell>
                <TableCell className="font-medium">{obj.objectName}</TableCell>
                <TableCell>{obj.tcode}</TableCell>
                <TableCell className="max-w-xs truncate">{obj.description}</TableCell>
                <TableCell>
                  <div className="flex justify-center gap-1">
                    <Button variant="accent" size="sm" className="h-8 text-xs" onClick={() => handleEdit(obj, obj.orgId, obj.appId)}>View</Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(obj.id, obj.orgId, obj.appId)} className="text-red-500 hover:text-red-600 hover:bg-red-500/10 h-8 w-8"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      
      <div className="flex justify-between items-center pt-2">
        <p className="text-sm text-muted-foreground">Showing {paginatedObjects.length} of {filteredObjects.length} objects.</p>
        <Pagination>
          <PaginationContent>
            <PaginationItem><PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); setCurrentPage(p => Math.max(1, p - 1)); }} /></PaginationItem>
            {[...Array(totalPages)].map((_, i) => (
              <PaginationItem key={i}><PaginationLink href="#" isActive={currentPage === i + 1} onClick={(e) => { e.preventDefault(); setCurrentPage(i + 1); }}>{i + 1}</PaginationLink></PaginationItem>
            ))}
            <PaginationItem><PaginationNext href="#" onClick={(e) => { e.preventDefault(); setCurrentPage(p => Math.min(totalPages, p + 1)); }} /></PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}
