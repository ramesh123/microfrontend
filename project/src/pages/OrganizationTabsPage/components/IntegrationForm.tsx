import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Integration, Organization } from '../types/organization';
import { Save, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface IntegrationFormProps {
  onClose: () => void;
  onSave: (data: Omit<Integration, 'id'>, orgId: string) => void;
  initialData: { integration: Integration; orgId: string } | null;
  organizations: Organization[];
}

type FormData = Omit<Integration, 'id'>;

const FormField: React.FC<{ label: string; required?: boolean; children: React.ReactNode; className?: string }> = ({ label, required, children, className }) => (
  <div className={cn("space-y-1.5 text-left", className)}>
    <label className="text-sm font-medium text-foreground">{label} {required && <span className="text-red-500">*</span>}</label>
    {children}
  </div>
);

const initialFormState: FormData = {
  name: '',
  source: '',
  target: '',
  mode: '',
};

const sourceTargetOptions = ['SAP', 'Salesforce', 'Workday', 'ACUMAX', 'AD', 'Oracle Fusion'];
const modeOptions = ['API', 'Middleware', 'File', 'IDOC', 'Webhook', 'API-Based'];

export function IntegrationForm({ onClose, onSave, initialData, organizations }: IntegrationFormProps) {
  const [formData, setFormData] = useState<FormData>(initialFormState);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData.integration);
    } else {
      setFormData(initialFormState);
    }
  }, [initialData]);

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    // If editing, use the existing orgId. If adding, default to the first organization.
    const orgIdToSaveTo = initialData?.orgId || organizations[0]?.orgId;

    if (!orgIdToSaveTo) {
     toast.error('No organization available to add an integration to.');
      return;
    }

    const requiredFields: (keyof FormData)[] = ['name', 'source', 'target', 'mode'];
    const missingFields = requiredFields.filter(field => !formData[field]);
    
    if (missingFields.length > 0) {
      toast.error(`Please fill in all required fields: ${missingFields.join(', ')}`);
      return;
    }
    onSave(formData, orgIdToSaveTo);
  };

  return (
    <div className="bg-card border rounded-xl p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between pb-4 border-b">
        <h2 className="text-lg font-bold text-foreground">
          {initialData ? 'Edit Integration' : 'Add New Integration'}
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
      
      <div className="space-y-4">
        <div className="space-y-4">
            <FormField label="Integration Name" required>
                <Input 
                    placeholder="Enter Integration Name" 
                    value={formData.name} 
                    onChange={e => handleInputChange('name', e.target.value)} 
                />
            </FormField>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <FormField label="Source" required>
                    <Select value={formData.source} onValueChange={value => handleInputChange('source', value)}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                            {sourceTargetOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </FormField>
                <FormField label="Target" required>
                    <Select value={formData.target} onValueChange={value => handleInputChange('target', value)}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                            {sourceTargetOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </FormField>
                <FormField label="Integration Mode" required>
                    <Select value={formData.mode} onValueChange={value => handleInputChange('mode', value)}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                            {modeOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </FormField>
            </div>
        </div>
      </div>
    </div>
  );
}
