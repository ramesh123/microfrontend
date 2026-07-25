import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { BusinessProcess, BusinessUnit, Organization } from '../types/organization';
import { Save, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Combobox } from '@/components/ui/combobox';
import { toast } from 'sonner';

interface BusinessProcessFormProps {
  onClose: () => void;
  onSave: (data: Omit<BusinessProcess, 'id'>, orgId: string) => void;
  initialData: BusinessProcess | null;
  businessUnits?: BusinessUnit[];
  organizations?: Organization[];
  selectedOrgId?: string;
}

type FormData = Omit<BusinessProcess, 'id'>;

const FormField: React.FC<{ label: string; required?: boolean; children: React.ReactNode; className?: string }> = ({ label, required, children, className }) => (
  <div className={cn("space-y-1.5 text-left", className)}>
    <label className="text-sm font-medium text-foreground">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
  </div>
);

const businessProcessOptions = [
    { value: 'Order Fulfillment', label: 'Order Fulfillment' },
    { value: 'Inventory Management', label: 'Inventory Management' },
    { value: 'Customer Support', label: 'Customer Support' },
    { value: 'Procurement', label: 'Procurement' },
    { value: 'Financial Reporting', label: 'Financial Reporting' },
];

const initialFormState: FormData = {
  businessUnitName: '',
  businessProcessName: '',
  description: '',
};

export function BusinessProcessForm({ onClose, onSave, initialData, businessUnits, organizations, selectedOrgId: initialOrgId }: BusinessProcessFormProps) {
  const [formData, setFormData] = useState<FormData>(initialFormState);
  const [selectedOrgId, setSelectedOrgId] = useState<string | undefined>(initialOrgId);

  const availableBusinessUnits = selectedOrgId ? organizations?.find(o => o.orgId === selectedOrgId)?.businessUnits || [] : businessUnits || [];

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData(initialFormState);
    }
  }, [initialData]);

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (organizations && !selectedOrgId) {
      toast.error('Please select an organization.');
      return;
    }
    const requiredFields: (keyof FormData)[] = ['businessUnitName', 'businessProcessName'];
    const missingFields = requiredFields.filter(field => !formData[field]);
    
    if (missingFields.length > 0) {
      toast.error(`Please fill in all required fields: ${missingFields.join(', ')}`);
      return;
    }
    onSave(formData, selectedOrgId!);
  };
  
  const businessUnitComboboxOptions = availableBusinessUnits.map(bu => ({ value: bu.businessUnitName, label: bu.businessUnitName }));

  return (
    <div className="bg-card border rounded-xl p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between pb-4 border-b">
        <h2 className="text-lg font-bold text-foreground">
          {initialData ? 'Edit Business Process' : 'Add New Business Process'}
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
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {organizations && (
            <FormField label="Organization" required>
                <Combobox
                    options={organizations.map(o => ({ value: o.orgId, label: o.organisationName }))}
                    value={selectedOrgId || ''}
                    onChange={(value: string) => setSelectedOrgId(value)}
                    placeholder="Select an organization..."
                />
            </FormField>
        )}
        <FormField label="Business Unit" required>
            <Combobox
                options={businessUnitComboboxOptions}
                value={formData.businessUnitName}
                onChange={(value: string) => handleInputChange('businessUnitName', value)}
                placeholder="Select a business unit..."
            />
        </FormField>
        <FormField label="Business Process" required>
            <Combobox
                options={businessProcessOptions}
                value={formData.businessProcessName}
                onChange={(value: string) => handleInputChange('businessProcessName', value)}
                placeholder="Select a business process..."
            />
        </FormField>
        <FormField label="Description" className="md:col-span-2">
            <Textarea 
                value={formData.description} 
                onChange={e => handleInputChange('description', e.target.value)} 
                className="min-h-32"
                placeholder="Enter a detailed description of the business process..."
            />
        </FormField>
      </div>
    </div>
  );
}
