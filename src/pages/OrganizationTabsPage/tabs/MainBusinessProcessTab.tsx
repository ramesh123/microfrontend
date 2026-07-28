import { useState } from 'react';
import { Search, Plus, Trash2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Organization, BusinessProcess } from '../types/organization';
import { BusinessProcessForm } from '../components/BusinessProcessForm';

interface MainBusinessProcessTabProps { 
  organizations: Organization[];
  onUpdateOrganizations: (orgs: Organization[]) => void;
}

export function MainBusinessProcessTab({ organizations, onUpdateOrganizations }: MainBusinessProcessTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProcess, setEditingProcess] = useState<{ process: BusinessProcess; orgId: string } | null>(null);

  const allProcesses = organizations.flatMap(org => 
    org.businessProcesses.map(process => ({ ...process, orgId: org.orgId, orgName: org.organisationName }))
  );

  const filteredProcesses = allProcesses.filter(p =>
    p.businessProcessName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.orgName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAdd = () => {
    setEditingProcess(null);
    setIsFormOpen(true);
  };

  const handleEdit = (process: BusinessProcess, orgId: string) => {
    setEditingProcess({ process, orgId });
    setIsFormOpen(true);
  };

  const handleDelete = (processId: string, orgId: string) => {
    const updatedOrgs = organizations.map(org => {
      if (org.orgId === orgId) {
        return {
          ...org,
          businessProcesses: org.businessProcesses.filter(p => p.id !== processId),
        };
      }
      return org;
    });
    onUpdateOrganizations(updatedOrgs);
  };

  const handleSave = (processData: Omit<BusinessProcess, 'id'>, orgId: string) => {
    const updatedOrgs = organizations.map(org => {
      if (org.orgId === orgId) {
        if (editingProcess) { // Update
          return {
            ...org,
            businessProcesses: org.businessProcesses.map(p => p.id === editingProcess.process.id ? { ...editingProcess.process, ...processData } : p),
          };
        } else { // Add
          const newProcess: BusinessProcess = { id: `BP-${Date.now()}`, ...processData };
          return { ...org, businessProcesses: [...org.businessProcesses, newProcess] };
        }
      }
      return org;
    });
    onUpdateOrganizations(updatedOrgs);
    setIsFormOpen(false);
  };

  if (isFormOpen) {
    return (
      <BusinessProcessForm
        onClose={() => setIsFormOpen(false)}
        onSave={handleSave}
        initialData={editingProcess?.process || null}
        organizations={organizations}
        selectedOrgId={editingProcess?.orgId}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search processes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-background focus:border-primary"
          />
        </div>
        <Button onClick={handleAdd} variant="accent" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Business Process
        </Button>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60 hover:bg-muted">
              <TableHead>Organization</TableHead>
              <TableHead>Business Unit Name</TableHead>
              <TableHead>Business Process Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProcesses.map((process) => (
              <TableRow key={process.id}>
                <TableCell className="font-medium">{process.orgName}</TableCell>
                <TableCell>{process.businessUnitName}</TableCell>
                <TableCell>{process.businessProcessName}</TableCell>
                <TableCell className="max-w-xs truncate">{process.description}</TableCell>
                <TableCell>
                  <div className="flex justify-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(process, process.orgId)} className="text-muted-foreground hover:text-primary hover:bg-primary/10 h-8 w-8">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(process.id, process.orgId)} className="text-red-500 hover:text-red-600 hover:bg-red-500/10 h-8 w-8">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {filteredProcesses.length === 0 && (
        <div className="text-center py-12 text-muted-foreground"><p>No business processes found.</p></div>
      )}
    </div>
  );
}
