import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Edit, Save, X } from 'lucide-react';
import { Program, Feature } from '../types/organization';
import { MultiSelect } from '@/components/ui/multiSelect';
import { toast } from 'sonner';

interface ProgramManagerProps {
  programs: Program[];
  features: Feature[];
  onUpdate: (programs: Program[]) => void;
}

export function ProgramManager({ programs, features, onUpdate }: ProgramManagerProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);

  const handleSave = (programData: Omit<Program, 'id'>) => {
    if (editingProgram) {
      onUpdate(programs.map(p => p.id === editingProgram.id ? { ...editingProgram, ...programData } : p));
    } else {
      onUpdate([...programs, { id: `P-${Date.now()}`, ...programData }]);
    }
    setIsFormOpen(false);
    setEditingProgram(null);
  };

  const handleDelete = (programId: string) => {
    onUpdate(programs.filter(p => p.id !== programId));
  };

  return (
    <div className="space-y-4">
      {!isFormOpen && (
        <div className="flex justify-end">
          <Button onClick={() => { setEditingProgram(null); setIsFormOpen(true); }} size="sm"><Plus className="mr-2 h-4 w-4" />Add Program</Button>
        </div>
      )}
      {isFormOpen && (
        <ProgramForm
          onClose={() => setIsFormOpen(false)}
          onSave={handleSave}
          initialData={editingProgram}
          availableFeatures={features}
        />
      )}
      <div className="bg-background border rounded-lg overflow-hidden">
        <Table>
          <TableHeader><TableRow><TableHead>Program</TableHead><TableHead>Description</TableHead><TableHead>Features</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {programs.map(program => (
              <TableRow key={program.id}>
                <TableCell>{program.name}</TableCell>
                <TableCell>{program.description}</TableCell>
                <TableCell>{program.features.join(', ')}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => { setEditingProgram(program); setIsFormOpen(true); }}><Edit className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(program.id)} className="text-red-500"><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// Inline Form Component
function ProgramForm({ onClose, onSave, initialData, availableFeatures }: { onClose: () => void, onSave: (data: Omit<Program, 'id'>) => void, initialData: Program | null, availableFeatures: Feature[] }) {
  const [formData, setFormData] = useState({ name: '', description: '', features: [] as string[] });

  useEffect(() => {
    if (initialData) setFormData(initialData);
    else setFormData({ name: '', description: '', features: [] });
  }, [initialData]);

  const handleSave = () => {
    if (!formData.name) {
      toast.error('Program Name is required.');
      return;
    }
    onSave(formData);
  };

  const featureOptions = availableFeatures.map(f => ({ value: f.name, label: f.name }));

  return (
    <div className="p-4 border rounded-lg space-y-3 bg-muted/50">
      <h3 className="font-semibold">{initialData ? 'Edit Program' : 'Add New Program'}</h3>
      <div className="space-y-4">
        <Input placeholder="Program Name" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} />
        <Textarea placeholder="Description" value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} />
        <MultiSelect options={featureOptions} selected={formData.features} onChange={v => setFormData(p => ({...p, features: v}))} placeholder="Select features..." />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={onClose}><X className="mr-2 h-4 w-4" />Cancel</Button>
        <Button size="sm" onClick={handleSave}><Save className="mr-2 h-4 w-4" />Save</Button>
      </div>
    </div>
  );
}
