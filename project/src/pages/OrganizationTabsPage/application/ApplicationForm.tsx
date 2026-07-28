import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Organization, Application } from '../types/organization';
import { Save, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Combobox } from '@/components/ui/combobox';
import { toast } from 'sonner';

interface ApplicationFormProps {
  onClose: () => void;
  onSave: (data: Omit<Application, 'id' | 'transactions' | 'features' | 'programs'>, orgId: string) => void;
  initialData: Omit<Application, 'id' | 'transactions' | 'features' | 'programs'> | null;
  organizations: Organization[];
  selectedOrgId?: string;
}

type FormData = Omit<Application, 'id' | 'transactions' | 'features' | 'programs'>;

const FormField: React.FC<{ label: string; required?: boolean; children: React.ReactNode; className?: string }> = ({ label, required, children, className }) => (
  <div className={cn("space-y-1.5 text-left", className)}>
    <label className="text-sm font-medium text-foreground">{label} {required && <span className="text-red-500">*</span>}</label>
    {children}
  </div>
);

const initialFormState: FormData = { name: '', description: '', objects: [] };

export function ApplicationForm({ onClose, onSave, initialData, organizations, selectedOrgId: initialOrgId }: ApplicationFormProps) { 
  const [formData, setFormData] = useState<FormData>(initialFormState);
  const [selectedOrgId, setSelectedOrgId] = useState<string | undefined>(initialOrgId);

  useEffect(() => {
    if (initialData) setFormData(initialData);
    else setFormData(initialFormState);
  }, [initialData]);

  const handleSave = () => {
    if (!selectedOrgId) {
      toast.error('Please select an organization.');
      return;
    }
    if (!formData.name) {
     toast.error('Application Name is required.');
      return;
    }
    onSave(formData, selectedOrgId);
  };

  return ( 
    <div className="bg-card border rounded-xl p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between pb-4 border-b">
        <h2 className="text-lg font-bold text-foreground">{initialData ? 'Edit Application' : 'Add New Application'}</h2>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}><X className="mr-2 h-4 w-4" />Cancel</Button>
          <Button type="button" onClick={handleSave} variant="accent"><Save className="mr-2 h-4 w-4" />Save</Button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4">
        <FormField label="Organization" required>
          <Combobox
            options={organizations.map(o => ({ value: o.orgId, label: o.organisationName }))}
            value={selectedOrgId || ''}
            onChange={(value: string) => setSelectedOrgId(value)}
            placeholder="Select an organization..."
          />
        </FormField>
        <FormField label="Application Name" required>
          <Input value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} />
        </FormField>
        <FormField label="Description">
          <Textarea value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} className="min-h-32" />
        </FormField>
      </div>
    </div>
  );
}
