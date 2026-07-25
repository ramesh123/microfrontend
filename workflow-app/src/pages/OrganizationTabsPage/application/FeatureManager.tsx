import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Edit, Save, X } from 'lucide-react';
import { Feature } from '../types/organization';
import { MultiSelect } from '@/components/ui/multiSelect';

interface FeatureManagerProps {
  features: Feature[];
  onUpdate: (features: Feature[]) => void;
}

const allPossibleFeatures = [
    { value: 'Real-time Tracking', label: 'Real-time Tracking' },
    { value: 'Low Stock Alerts', label: 'Low Stock Alerts' },
    { value: 'Automated Reporting', label: 'Automated Reporting' },
    { value: 'User Role Management', label: 'User Role Management' },
];

export function FeatureManager({ features, onUpdate }: FeatureManagerProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);

  const handleSave = (selectedFeatureNames: string[]) => {
    const newFeatures: Feature[] = selectedFeatureNames.map(name => ({
        id: `F-${Date.now()}-${Math.random()}`,
        name,
        description: allPossibleFeatures.find(f => f.value === name)?.label || ''
    }));
    onUpdate(newFeatures);
    setIsFormOpen(false);
  };

  const handleDelete = (featureId: string) => {
    onUpdate(features.filter(f => f.id !== featureId));
  };

  return (
    <div className="space-y-4">
      {!isFormOpen && (
        <div className="flex justify-end">
          <Button onClick={() => setIsFormOpen(true)} size="sm"><Plus className="mr-2 h-4 w-4" />Add/Edit Features</Button>
        </div>
      )}
      {isFormOpen && (
        <FeatureForm
          onClose={() => setIsFormOpen(false)}
          onSave={handleSave}
          initialData={features.map(f => f.name)}
        />
      )}
      <div className="bg-background border rounded-lg overflow-hidden">
        <Table>
          <TableHeader><TableRow><TableHead>Feature</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {features.map(feature => (
              <TableRow key={feature.id}>
                <TableCell>{feature.name}</TableCell>
                <TableCell>{feature.description}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(feature.id)} className="text-red-500"><Trash2 className="h-4 w-4" /></Button>
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
function FeatureForm({ onClose, onSave, initialData }: { onClose: () => void, onSave: (data: string[]) => void, initialData: string[] }) {
  const [selected, setSelected] = useState(initialData);

  return (
    <div className="p-4 border rounded-lg space-y-3 bg-muted/50">
      <h3 className="font-semibold">Select Features</h3>
      <MultiSelect
        options={allPossibleFeatures}
        selected={selected}
        onChange={setSelected}
        placeholder="Select features..."
      />
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={onClose}><X className="mr-2 h-4 w-4" />Cancel</Button>
        <Button size="sm" onClick={() => onSave(selected)}><Save className="mr-2 h-4 w-4" />Save Features</Button>
      </div>
    </div>
  );
}
