import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Project, BusinessUnit, Organization } from '../types/organization';
import { Save, X, Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Combobox } from '@/components/ui/combobox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface ProjectFormProps {
  onClose: () => void;
  onSave: (data: Omit<Project, 'id'>) => void;
  initialData: Project | null;
  organizations: Omit<Organization, 'orgId' | 'location'>[];
  businessUnits: BusinessUnit[];
}

type FormData = Omit<Project, 'id'>;

const FormField: React.FC<{ label: string; required?: boolean; children: React.ReactNode; className?: string }> = ({ label, required, children, className }) => (
  <div className={cn("space-y-1.5 text-left", className)}>
    <label className="text-sm font-medium text-foreground">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
  </div>
);

const projectTypeOptions = [
    { value: 'Implementation', label: 'Implementation' },
    { value: 'Support', label: 'Support' },
    { value: 'Upgrade', label: 'Upgrade' },
    { value: 'Consulting', label: 'Consulting' },
];

const initialFormState: FormData = {
  clientName: '',
  projectName: '',
  businessUnit: '',
  projectType: '',
  startDate: undefined,
  endDate: undefined,
  description: '',
};

export function ProjectForm({ onClose, onSave, initialData, organizations, businessUnits }: ProjectFormProps) {
  const [formData, setFormData] = useState<FormData>(initialFormState);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData(initialFormState);
    }
  }, [initialData]);

  const handleInputChange = (field: keyof FormData, value: string | Date | undefined) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    const requiredFields: (keyof FormData)[] = ['clientName', 'projectName', 'projectType'];
    const missingFields = requiredFields.filter(field => !formData[field]);
    
    if (missingFields.length > 0) {
      toast.error(`Please fill in all required fields: ${missingFields.join(', ')}`);
      return;
    }
    onSave(formData);
  };
  
  const clientOptions = organizations.map(org => ({ value: org.organisationName, label: org.organisationName }));
  const businessUnitOptions = businessUnits.map(bu => ({ value: bu.businessUnitName, label: bu.businessUnitName }));

  return ( 
    <div className="bg-card border rounded-xl p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between pb-4 border-b">
        <h2 className="text-lg font-bold text-foreground">
          {initialData ? 'Edit Project' : 'Add New Project'}
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
        <FormField label="Client" required>
            <Combobox
                options={clientOptions}
                value={formData.clientName}
                onChange={(value) => handleInputChange('clientName', value)}
                placeholder="Select a client..."
            />
        </FormField>
        <FormField label="Project Name" required>
            <Input 
                value={formData.projectName} 
                onChange={e => handleInputChange('projectName', e.target.value)} 
                placeholder="Enter project name..."
            />
        </FormField>
        <FormField label="Business Unit">
            <Combobox
                options={businessUnitOptions}
                value={formData.businessUnit}
                onChange={(value) => handleInputChange('businessUnit', value)}
                placeholder="Select a business unit..."
            />
        </FormField>
        <FormField label="Project Type" required>
            <Combobox
                options={projectTypeOptions}
                value={formData.projectType}
                onChange={(value) => handleInputChange('projectType', value)}
                placeholder="Select a project type..."
            />
        </FormField>
        <FormField label="Start Date">
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        variant={"outline"}
                        className={cn("w-full justify-start text-left font-normal", !formData.startDate && "text-muted-foreground")}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.startDate ? format(formData.startDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                    <Calendar
                        mode="single"
                        selected={formData.startDate}
                        onSelect={(date) => handleInputChange('startDate', date)}
                        initialFocus
                    />
                </PopoverContent>
            </Popover>
        </FormField>
        <FormField label="End Date">
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        variant={"outline"}
                        className={cn("w-full justify-start text-left font-normal", !formData.endDate && "text-muted-foreground")}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.endDate ? format(formData.endDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                    <Calendar
                        mode="single"
                        selected={formData.endDate}
                        onSelect={(date) => handleInputChange('endDate', date)}
                        initialFocus
                    />
                </PopoverContent>
            </Popover>
        </FormField>
        <FormField label="Description" className="md:col-span-2">
            <Textarea 
                value={formData.description} 
                onChange={e => handleInputChange('description', e.target.value)} 
                className="min-h-32"
                placeholder="Enter a detailed description of the project..."
            />
        </FormField>
      </div>
    </div>
  );
}
