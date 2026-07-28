import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Organization, ObjectItem } from '../types/organization';
import { Save, X, ArrowLeft, Home, Workflow } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Combobox } from '@/components/ui/combobox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

interface ObjectFormProps {
  onClose: () => void;
  onSave: (data: Omit<ObjectItem, 'id'>, orgId: string, appId: string) => void;
  initialData: { object: ObjectItem; orgId: string; appId: string } | null;
  organizations: Organization[];
}

type FormData = Omit<ObjectItem, 'id'>;

const FormField: React.FC<{ label: string; required?: boolean; children: React.ReactNode; className?: string }> = ({ label, required, children, className }) => (
  <div className={cn("space-y-1.5 text-left", className)}>
    <label className="text-sm font-medium text-foreground">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
  </div>
);

const initialFormState: FormData = {
  application: '',
  module: '',
  subModule: '',
  objectType: 'Transaction',
  objectName: '',
  tcode: '',
  description: '',
};

const moduleOptions = [
    { value: 'FI', label: 'FI' },
    { value: 'WM', label: 'WM' },
    { value: 'BPC', label: 'BPC' },
    { value: 'PS', label: 'PS' },
    { value: 'BI', label: 'BI' },
];
const subModuleOptions = [
    { value: 'BL', label: 'BL' },
    { value: 'AR', label: 'AR' },
    { value: 'Packing', label: 'Packing' },
    { value: 'BO', label: 'BO' },
    { value: 'Reporting', label: 'Reporting' },
];
const objectTypeOptions = [
    { value: 'Transaction', label: 'Transaction' },
    { value: 'Report', label: 'Report' },
    { value: 'Configuration', label: 'Configuration' },
];
const tcodeOptions = [
    { value: 'FIBL1', label: 'FIBL1' },
    { value: 'FEBAN', label: 'FEBAN' },
    { value: 'F-36', label: 'F-36' },
    { value: 'LX03', label: 'LX03' },
    { value: 'BOBJ', label: 'BOBJ' },
];

export function ObjectForm({ onClose, onSave, initialData, organizations }: ObjectFormProps) {
  const [formData, setFormData] = useState<FormData>(initialFormState);
  const [selectedOrgId, setSelectedOrgId] = useState<string | undefined>(initialData?.orgId);
  const [selectedAppId, setSelectedAppId] = useState<string | undefined>(initialData?.appId);

  const availableApps = useMemo(() => {
    if (!selectedOrgId) return [];
    return organizations.find(o => o.orgId === selectedOrgId)?.applications || [];
  }, [selectedOrgId, organizations]);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData.object);
    } else {
      setFormData(initialFormState);
    }
  }, [initialData]);

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (!selectedOrgId || !selectedAppId) {
      toast.error('Please select an organization and application.');
      return;
    }
    const requiredFields: (keyof FormData)[] = ['objectName', 'tcode', 'module', 'subModule', 'objectType'];
    const missingFields = requiredFields.filter(field => !formData[field]);
    
    if (missingFields.length > 0) {
      toast.error(`Please fill in all required fields: ${missingFields.join(', ')}`);
      return;
    }
    
    const selectedApp = availableApps.find(app => app.id === selectedAppId);
    const dataToSave: FormData = {
      ...formData,
      application: selectedApp ? selectedApp.name : '',
    };
    
    onSave(dataToSave, selectedOrgId, selectedAppId);
  };

  return (
    <div className="bg-card border rounded-xl p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between pb-4 border-b">
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={onClose}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h2 className="text-lg font-bold text-foreground">
            {initialData ? 'Edit Object' : 'Add'}
          </h2>
        </div>
        <Button type="button" onClick={handleSave} variant="accent">
          <Save className="mr-2 h-4 w-4" />
          Save
        </Button>
      </div>
      
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <FormField label="Applications" required>
                <Combobox
                    options={availableApps.map(a => ({ value: a.id, label: a.name }))}
                    value={selectedAppId || ''}
                    onChange={(value: string) => setSelectedAppId(value)}
                    placeholder="Select application..."
                    className={initialData ? 'pointer-events-none bg-muted' : ''}
                />
            </FormField>
            <FormField label="Module" required>
                <Combobox options={moduleOptions} value={formData.module} onChange={v => handleInputChange('module', v)} placeholder="Select module..." />
            </FormField>
            <FormField label="Sub Module" required>
                <Combobox options={subModuleOptions} value={formData.subModule} onChange={v => handleInputChange('subModule', v)} placeholder="Select sub module..." />
            </FormField>
            <FormField label="Object Type" required>
                <Combobox options={objectTypeOptions} value={formData.objectType} onChange={v => handleInputChange('objectType', v)} placeholder="Select object type..." />
            </FormField>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label="TCODE" required>
                <Combobox options={tcodeOptions} value={formData.tcode} onChange={v => handleInputChange('tcode', v)} placeholder="Select TCODE..." />
            </FormField>
            <FormField label="Object Name" required>
                <Input value={formData.objectName} onChange={e => handleInputChange('objectName', e.target.value)} placeholder="Enter Object Name" />
            </FormField>
            <FormField label="Description">
                <Textarea value={formData.description} onChange={e => handleInputChange('description', e.target.value)} placeholder="Description" />
            </FormField>
        </div>
      </div>

      <Tabs defaultValue="tables" className="w-full">
        <TabsList className="bg-transparent p-0">
          <TabsTrigger value="tables" className="rounded-full data-[state=active]:bg-slate-900 data-[state=active]:text-white">Tables</TabsTrigger>
          <TabsTrigger value="business-process" className="rounded-full data-[state=active]:bg-slate-900 data-[state=active]:text-white">Business Process And Sub Process</TabsTrigger>
        </TabsList>
        <TabsContent value="tables" className="mt-4">
            <div className="flex items-center gap-2 text-primary hover:underline cursor-pointer">
                <Home className="h-4 w-4" />
                <span>Tables</span>
            </div>
        </TabsContent>
        <TabsContent value="business-process" className="mt-4">
            <div className="text-center py-12 text-muted-foreground bg-muted/30 rounded-lg border border-dashed">
                <Workflow className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                <p className="font-medium">Business Process Preview</p>
                <p className="text-sm max-w-md mx-auto">This section is under construction.</p>
            </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
