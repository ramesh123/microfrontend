import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Organization, Feature } from '../types/organization';
import { Save, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface FeatureFormProps {
  onClose: () => void;
  onSave: (data: Omit<Feature, 'id'>, orgId: string, appId: string) => void;
  initialData: { feature: Feature; orgId: string; appId: string } | null;
  organizations: Organization[];
}

type FormData = Omit<Feature, 'id'>;

const FormField: React.FC<{ label: string; required?: boolean; children: React.ReactNode; className?: string }> = ({ label, required, children, className }) => (
  <div className={cn("space-y-1.5 text-left", className)}>
    <label className="text-sm font-medium text-foreground">{label} {required && <span className="text-red-500">*</span>}</label>
    {children}
  </div>
);

const initialFormState: FormData = { name: '', description: '' };

export function FeatureForm({ onClose, onSave, initialData, organizations }: FeatureFormProps) {
  const [formData, setFormData] = useState<FormData>(initialFormState);

  useEffect(() => {
    if (initialData) {
      setFormData({ name: initialData.feature.name, description: initialData.feature.description });
    } else {
      setFormData(initialFormState);
    }
  }, [initialData]);

  const handleSave = () => {
    let orgIdToSaveTo: string | undefined;
    let appIdToSaveTo: string | undefined;

    if (initialData) {
      orgIdToSaveTo = initialData.orgId;
      appIdToSaveTo = initialData.appId;
    } else {
      // Default to the first app of the first org for new features
      orgIdToSaveTo = organizations[0]?.orgId;
      appIdToSaveTo = organizations[0]?.applications[0]?.id;
    }

    if (!orgIdToSaveTo || !appIdToSaveTo) {
     toast.error('Cannot add feature: No organization or application found.');
      return;
    }
    if (!formData.name) {
      toast.error('Feature Name is required.');
      return;
    }
    onSave(formData, orgIdToSaveTo, appIdToSaveTo);
  };

  return (
    <div className="bg-card border rounded-xl p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between pb-4 border-b">
        <h2 className="text-lg font-bold text-foreground">
          {initialData ? 'Edit Feature' : 'Add New Feature'}
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
        <FormField label="Feature Name" required>
          <Input
            placeholder="Enter Feature Name"
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
