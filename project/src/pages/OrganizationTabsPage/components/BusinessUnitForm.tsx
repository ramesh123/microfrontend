import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BusinessUnit, Organization } from '../types/organization';
import { Save, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Combobox } from '@/components/ui/combobox';
import { toast } from 'sonner';


interface BusinessUnitFormProps {
  onClose: () => void;
  onSave: (data: Omit<BusinessUnit, 'id'>, orgId: string) => void;
  initialData: BusinessUnit | null;
  organizations?: Organization[];
  selectedOrgId?: string;
}

type FormData = Omit<BusinessUnit, 'id'>;

const FormField: React.FC<{ label: string; required?: boolean; children: React.ReactNode; className?: string }> = ({ label, required, children, className }) => (
  <div className={cn("space-y-1.5 text-left", className)}>
    <label className="text-sm font-medium text-foreground">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
  </div>
);

const businessUnitOptions = ['Supply Chain Management', 'Manufacturing', 'Sales & Marketing', 'Human Resources', 'Finance'];
const countries = ['United States', 'Canada', 'United Kingdom', 'India', 'Australia', 'Germany', 'France'];
const states = ['California', 'Texas', 'New York', 'Florida', 'Illinois', 'Pennsylvania', 'Ohio', 'Meghalaya', 'Alaska'];
const cities = ['San Francisco', 'Los Angeles', 'New York', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'Abram', 'Alhambra', 'Aguanga', 'Craig', 'Shillong', 'Sunnyvale'];
const countryCodeOptions = [{ code: '+1', country: 'US' }, { code: '+44', country: 'UK' }, { code: '+91', country: 'IN' }];

const initialFormState: FormData = {
  businessUnitName: '',
  companyCode: '',
  email: '',
  country: '',
  state: '',
  city: '',
  zipcode: '',
  countryCode: '+1',
  contact: '',
  address1: '',
  address2: '',
};

export function BusinessUnitForm({ onClose, onSave, initialData, organizations, selectedOrgId: initialOrgId }: BusinessUnitFormProps) {
  const [formData, setFormData] = useState<FormData>(initialFormState);
  const [selectedOrgId, setSelectedOrgId] = useState<string | undefined>(initialOrgId);

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

    const requiredFields: (keyof FormData)[] = ['businessUnitName', 'country', 'state', 'city', 'email'];
    const missingFields = requiredFields.filter(field => !formData[field]);

    if (missingFields.length > 0) {
      toast.error(`Please fill in all required fields: ${missingFields.join(', ')}`);
      return;
    }
    onSave(formData, selectedOrgId!);
  };

  return (
    <div className="bg-card border rounded-xl p-2 sm:p-4 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b">
        <h2 className="text-lg font-bold text-foreground">
          {initialData ? 'Edit Business Unit' : 'Add New Business Unit'}
        </h2>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} variant="accent">
            <Save className="mr-2 h-4 w-4" />
            Save
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <Select value={formData.businessUnitName} onValueChange={value => handleInputChange('businessUnitName', value)}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {businessUnitOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Company Code (In ERP System)">
            <Input value={formData.companyCode} onChange={e => handleInputChange('companyCode', e.target.value)} />
          </FormField>
          <FormField label="Country" required>
            <Select value={formData.country} onValueChange={value => handleInputChange('country', value)}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {countries.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="State" required>
            <Select value={formData.state} onValueChange={value => handleInputChange('state', value)}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {states.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="City" required>
            <Select value={formData.city} onValueChange={value => handleInputChange('city', value)}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Contact">
            <div className="flex space-x-2">
              <Select value={formData.countryCode} onValueChange={v => handleInputChange('countryCode', v)}>
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {countryCodeOptions.map(o => <SelectItem key={o.code} value={o.code}>{o.code}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input placeholder="Enter phone number" value={formData.contact} onChange={e => handleInputChange('contact', e.target.value)} />
            </div>
          </FormField>
          <FormField label="Email" required>
            <Input type="email" value={formData.email} onChange={e => handleInputChange('email', e.target.value)} />
          </FormField>
          <FormField label="Zipcode">
            <Input value={formData.zipcode} onChange={e => handleInputChange('zipcode', e.target.value)} />
          </FormField>
          <FormField label="Address 1" className="md:col-span-3">
            <Textarea value={formData.address1} onChange={e => handleInputChange('address1', e.target.value)} className="h-20" />
          </FormField>
          <FormField label="Address 2" className="md:col-span-3">
            <Textarea value={formData.address2} onChange={e => handleInputChange('address2', e.target.value)} className="h-24" />
          </FormField>
        </div>
      </div>
    </div>
  );
}
