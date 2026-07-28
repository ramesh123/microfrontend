import { useState, useMemo, useEffect } from 'react';
import { Search, Plus, Trash2, Edit, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Organization, Program } from '../types/organization';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface ProgramsTabProps {
  organizations: Organization[];
  onUpdateOrganizations: (orgs: Organization[]) => void;
}

export function ProgramsTab({ organizations, onUpdateOrganizations }: ProgramsTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<{ program: Program; orgId: string; appId: string } | null>(null);

  const allPrograms = useMemo(() => organizations.flatMap(org =>
    org.applications.flatMap(app =>
      app.programs.map(prog => ({
        ...prog,
        orgId: org.orgId,
        orgName: org.organisationName,
        appId: app.id,
        appName: app.name,
      }))
    )
  ), [organizations]);

  const filteredPrograms = useMemo(() => allPrograms.filter(prog =>
    prog.name.toLowerCase().includes(searchTerm.toLowerCase())
  ), [allPrograms, searchTerm]);

  const handleAdd = () => {
    setEditingProgram(null);
    setIsFormOpen(true);
  };

  const handleEdit = (program: Program, orgId: string, appId: string) => {
    setEditingProgram({ program, orgId, appId });
    setIsFormOpen(true);
  };

  const handleDelete = (programId: string, orgId: string, appId: string) => {
    const updatedOrgs = organizations.map(org => {
      if (org.orgId === orgId) {
        const updatedApps = org.applications.map(app => {
          if (app.id === appId) {
            return { ...app, programs: app.programs.filter(p => p.id !== programId) };
          }
          return app;
        });
        return { ...org, applications: updatedApps };
      }
      return org;
    });
    onUpdateOrganizations(updatedOrgs);
  };

  const handleSave = (programData: Omit<Program, 'id'>, orgId: string, appId: string) => {
    const updatedOrgs = organizations.map(org => {
      if (org.orgId === orgId) {
        const updatedApps = org.applications.map(app => {
          if (app.id === appId) {
            if (editingProgram) { // Update
              const updatedProgs = app.programs.map(p => p.id === editingProgram.program.id ? { ...editingProgram.program, ...programData } : p);
              return { ...app, programs: updatedProgs };
            } else { // Add
              const newProgram: Program = { id: `P-${Date.now()}`, ...programData };
              return { ...app, programs: [...app.programs, newProgram] };
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
      <ProgramForm
        onClose={() => setIsFormOpen(false)}
        onSave={handleSave}
        initialData={editingProgram}
        organizations={organizations}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search programs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={handleAdd} variant="accent" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add
        </Button>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60 hover:bg-muted">
              <TableHead>Program Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Application</TableHead>
              <TableHead>Organization</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPrograms.map((program) => (
              <TableRow key={program.id}>
                <TableCell className="font-medium">{program.name}</TableCell>
                <TableCell className="max-w-xs truncate">{program.description}</TableCell>
                <TableCell>{program.appName}</TableCell>
                <TableCell>{program.orgName}</TableCell>
                <TableCell>
                  <div className="flex justify-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(program, program.orgId, program.appId)} className="text-muted-foreground hover:text-primary hover:bg-primary/10 h-8 w-8">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(program.id, program.orgId, program.appId)} className="text-red-500 hover:text-red-600 hover:bg-red-500/10 h-8 w-8">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {filteredPrograms.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>No programs found.</p>
        </div>
      )}
    </div>
  );
}

function ProgramForm({ onClose, onSave, initialData, organizations }: {
  onClose: () => void;
  onSave: (data: Omit<Program, 'id'>, orgId: string, appId: string) => void;
  initialData: { program: Program; orgId: string; appId: string } | null;
  organizations: Organization[];
}) {
  const [formData, setFormData] = useState<Omit<Program, 'id'>>({ name: '', description: '', features: [] });

  useEffect(() => {
    if (initialData) {
      setFormData({ name: initialData.program.name, description: initialData.program.description, features: initialData.program.features || [] });
    } else {
      setFormData({ name: '', description: '', features: [] });
    }
  }, [initialData]);

  const handleSave = () => {
    let orgIdToSaveTo: string | undefined;
    let appIdToSaveTo: string | undefined;

    if (initialData) {
      orgIdToSaveTo = initialData.orgId;
      appIdToSaveTo = initialData.appId;
    } else {
      // Default to the first app of the first org for new programs
      orgIdToSaveTo = organizations[0]?.orgId;
      appIdToSaveTo = organizations[0]?.applications[0]?.id;
    }

    if (!orgIdToSaveTo || !appIdToSaveTo) {
      toast.error('Cannot add program: No organization or application found.');
      return;
    }
    if (!formData.name) {
      toast.error('Program Name is required.');
      return;
    }
    onSave(formData, orgIdToSaveTo, appIdToSaveTo);
  };

  const FormField = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="space-y-1.5 text-left">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );

  return (
    <div className="bg-card border rounded-xl p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between pb-4 border-b">
        <h2 className="text-lg font-bold text-foreground">
          {initialData ? 'Edit Program' : 'Add New Program'}
        </h2>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} className="border-primary text-primary hover:bg-primary/10">
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} variant="accent">
            <Save className="mr-2 h-4 w-4" />
            Save
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 gap-4">
        <FormField label="Program Name">
          <Input
            placeholder="Enter Program Name"
            value={formData.name}
            onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
          />
        </FormField>
        <FormField label="Description">
          <Textarea
            placeholder="Enter Description"
            value={formData.description}
            onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
            className="min-h-32"
          />
        </FormField>
      </div>
    </div>
  );
}
