import { useState } from 'react';
import { Search, Plus, Trash2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BusinessUnit, BusinessProcess } from '../types/organization';
import { BusinessProcessForm } from './BusinessProcessForm';

interface BusinessProcessManagerProps {
  organizationName: string;
  businessUnits: BusinessUnit[];
  businessProcesses: BusinessProcess[];
  onBusinessProcessesChange: (businessProcesses: BusinessProcess[]) => void;
}

export function BusinessProcessManager({
  organizationName,
  businessUnits,
  businessProcesses,
  onBusinessProcessesChange,
}: BusinessProcessManagerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProcess, setEditingProcess] = useState<BusinessProcess | null>(null);

  const filteredProcesses = businessProcesses.filter(
    (process) =>
      process.businessProcessName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      process.businessUnitName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAdd = () => {
    setEditingProcess(null);
    setIsFormOpen(true);
  };

  const handleEdit = (process: BusinessProcess) => {
    setEditingProcess(process);
    setIsFormOpen(true);
  };

  const handleDelete = (processId: string) => {
    onBusinessProcessesChange(businessProcesses.filter((p) => p.id !== processId));
  };

  const handleSave = (processData: Omit<BusinessProcess, 'id'>) => {
    if (editingProcess) {
      onBusinessProcessesChange(
        businessProcesses.map((p) => (p.id === editingProcess.id ? { ...editingProcess, ...processData } : p))
      );
    } else {
      const newProcess: BusinessProcess = {
        id: `BP-${Date.now()}`,
        ...processData,
      };
      onBusinessProcessesChange([...businessProcesses, newProcess]);
    }
    setIsFormOpen(false);
  };

  if (isFormOpen) {
    return (
      <BusinessProcessForm
        onClose={() => setIsFormOpen(false)}
        onSave={handleSave}
        initialData={editingProcess}
        businessUnits={businessUnits}
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
              <TableHead>Client Name</TableHead>
              <TableHead>Business Unit Name</TableHead>
              <TableHead>Business Process Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProcesses.map((process) => (
              <TableRow key={process.id}>
                <TableCell className="font-medium">{organizationName}</TableCell>
                <TableCell>{process.businessUnitName}</TableCell>
                <TableCell>{process.businessProcessName}</TableCell>
                <TableCell className="max-w-xs truncate text-muted-foreground">{process.description}</TableCell>
                <TableCell>
                  <div className="flex justify-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(process)}
                      className="text-muted-foreground hover:text-primary hover:bg-primary/10 h-8 w-8"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(process.id)}
                      className="text-red-500 hover:text-red-600 hover:bg-red-500/10 h-8 w-8"
                    >
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
        <div className="text-center py-12 text-muted-foreground">
          <p>No business processes found.</p>
        </div>
      )}
    </div>
  );
}
