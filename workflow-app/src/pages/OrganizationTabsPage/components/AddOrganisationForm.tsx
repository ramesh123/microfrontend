import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Building2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MultiSelect, MultiSelectOption } from '@/components/ui/multiSelect';
import { Organization, BusinessUnit, BusinessProcess, Project } from '../types/organization';
import { BusinessUnitManager } from './BusinessUnitManager';
import { BusinessProcessManager } from './BusinessProcessManager';
import { ProjectManager } from './ProjectManager';
import { toast } from 'sonner';

type FormData = Omit<Organization, 'orgId' | 'location'>;

interface AddOrganisationFormProps {
  onBack: () => void;
  onSave: (data: Omit<Organization, 'orgId' | 'location'>, isNew: boolean) => void;
  initialData?: Organization | null;
}

const industryOptions: MultiSelectOption[] = [
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'technology', label: 'Technology' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'finance', label: 'Finance' },
  { value: 'retail', label: 'Retail' },
  { value: 'education', label: 'Education' },
  { value: 'government', label: 'Government' },
  { value: 'non-profit', label: 'Non-Profit' },
  { value: 'telecommunications', label: 'Telecommunications' },
  { value: 'automotive', label: 'Automotive' }
];

const serviceOptions: MultiSelectOption[] = [
  { value: 'consulting', label: 'Consulting' },
  { value: 'support', label: 'Support' },
  { value: 'development', label: 'Development' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'training', label: 'Training' },
  { value: 'integration', label: 'Integration' }
];

const countries = ['United States', 'Canada', 'United Kingdom', 'India', 'Australia', 'Germany', 'France'];
const states = ['California', 'Texas', 'New York', 'Florida', 'Illinois', 'Pennsylvania', 'Ohio', 'Meghalaya', 'Alaska'];
const cities = ['San Francisco', 'Los Angeles', 'New York', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'Abram', 'Alhambra', 'Aguanga', 'Craig', 'Shillong'];
const countryCodeOptions = [{ code: '+1', country: 'US' }, { code: '+44', country: 'UK' }, { code: '+91', country: 'IN' }];

const FormField: React.FC<{
  label: string;
  required?: boolean;
  children: React.ReactNode;
}> = ({ label, required, children }) => (
  <div className="space-y-1.5 text-left">
    <label className="text-sm font-medium text-foreground">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
  </div>
);

const initialFormState: FormData = {
  organisationName: '',
  industryTypes: [],
  services: [],
  companyId: '',
  country: '',
  state: '',
  city: '',
  countryCode: '+1',
  contact: '',
  email: '',
  zipcode: '',
  address1: '',
  address2: '',
  businessUnits: [],
  businessProcesses: [],
  projects: [],
  applications: [],
  integrations: [],
};

export function AddOrganisationForm({ onBack, onSave, initialData }: AddOrganisationFormProps) {

  const [activeTab, setActiveTab] = useState('organisation-info');
  const [formData, setFormData] = useState<FormData>(initialFormState);

  useEffect(() => {
    if (initialData) {
      setFormData({
        organisationName: initialData.organisationName,
        companyId: initialData.companyId,
        email: initialData.email,
        address1: initialData.address1,
        address2: initialData.address2,
        city: initialData.city,
        state: initialData.state,
        country: initialData.country,
        zipcode: initialData.zipcode,
        countryCode: initialData.countryCode,
        contact: initialData.contact,
        industryTypes: initialData.industryTypes || [],
        services: initialData.services || [],
        businessUnits: initialData.businessUnits || [],
        businessProcesses: initialData.businessProcesses || [],
        projects: initialData.projects || [],
        applications: initialData.applications || [],
        integrations: initialData.integrations || [],
      });
    } else {
      setFormData(initialFormState); // Reset form for new entry
    }
  }, [initialData]);

  const handleInputChange = (field: keyof Omit<FormData, 'businessUnits' | 'businessProcesses' | 'projects'>, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleBusinessUnitsChange = (newBusinessUnits: BusinessUnit[]) => {
    setFormData(prev => ({ ...prev, businessUnits: newBusinessUnits }));
  };

  const handleBusinessProcessesChange = (newBusinessProcesses: BusinessProcess[]) => {
    setFormData(prev => ({ ...prev, businessProcesses: newBusinessProcesses }));
  };

  const handleProjectsChange = (newProjects: Project[]) => {
    setFormData(prev => ({ ...prev, projects: newProjects }));
  };

  const handleSave = () => {
    const requiredFields: (keyof FormData)[] = ['organisationName', 'industryTypes', 'email'];
    const missingFields = requiredFields.filter(field => {
      const formField = !formData[field]
      return Array.isArray(formData[field]) ? formData[field].length === 0 : formField
    });

    if (missingFields.length > 0) {
      toast.error(`Please fill in all required fields: ${missingFields.join(', ')}`);
      return;
    }

    onSave(formData, !initialData);
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4">
      {/* Enhanced Header */}
      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <div className="gradient-primary relative">
          <div className="relative px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onBack}
                  className="text-black/80 dark:text-white/80"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <div className="h-6 w-px bg-white/20"></div>
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Plus className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-lg font-bold text-black dark:text-white/80">
                      {initialData ? 'View / Edit Organization' : 'Create New Organization'}
                    </h1>
                    <p className="text-blue-500 dark:text-blue-500 text-sm">
                      {initialData ? `Viewing details for ${initialData.organisationName}` : 'Set up your organization profile'}
                    </p>
                  </div>
                </div>
              </div>
              <Button
                onClick={handleSave}
                variant="accent"
                size="sm"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Organization
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Form Content */}
      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="px-4 py-3 border-b bg-muted/50">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 gap-2 bg-background p-1 rounded-full">
              <TabsTrigger
                value="organisation-info"
                className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-md"
              >
                <Building2 className="h-4 w-4 mr-2" />
                Organization Info
              </TabsTrigger>
              <TabsTrigger
                value="business-units"
                className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-md"
              >
                Business Units
              </TabsTrigger>
              <TabsTrigger
                value="business-process"
                className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-md"
              >
                Business Process
              </TabsTrigger>
              <TabsTrigger
                value="projects"
                className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-md"
              >
                Projects
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="p-4">
            <TabsContent value="organisation-info" className="space-y-6 pt-2">
              {/* Basic Information Section */}
              <div className="space-y-3">
                <h3 className="text-base font-semibold text-foreground mb-3">Basic Information</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <FormField
                    label="Organization Name"
                    required
                  >
                    <Input
                      placeholder="Enter organization name"
                      value={formData.organisationName}
                      onChange={e => handleInputChange('organisationName', e.target.value)}
                      className="bg-background focus:border-primary"
                    />
                  </FormField>

                  <FormField
                    label="Industry Types"
                    required
                  >
                    <MultiSelect
                      options={industryOptions}
                      selected={formData.industryTypes}
                      onChange={value => handleInputChange('industryTypes', value)}
                      placeholder="Select industries..."
                      maxDisplay={2}
                    />
                  </FormField>

                  <FormField
                    label="Services Offered"
                  >
                    <MultiSelect
                      options={serviceOptions}
                      selected={formData.services}
                      onChange={value => handleInputChange('services', value)}
                      placeholder="Select services..."
                      maxDisplay={2}
                    />
                  </FormField>

                  <FormField
                    label="Company ID (ERP)"
                  >
                    <Input
                      placeholder="Enter company ID"
                      value={formData.companyId}
                      onChange={e => handleInputChange('companyId', e.target.value)}
                      className="bg-background focus:border-primary"
                    />
                  </FormField>
                </div>
              </div>

              {/* Location Information Section */}
              <div className="space-y-3">
                <h3 className="text-base font-semibold text-foreground mb-3">Location Details</h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField label="Country">
                    <Select value={formData.country} onValueChange={value => handleInputChange('country', value)}>
                      <SelectTrigger className="bg-background focus:border-primary w-full">
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent>
                        {countries.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormField>

                  <FormField label="State/Province">
                    <Select value={formData.state} onValueChange={value => handleInputChange('state', value)}>
                      <SelectTrigger className="bg-background focus:border-primary w-full">
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {states.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormField>

                  <FormField label="City">
                    <Select value={formData.city} onValueChange={value => handleInputChange('city', value)}>
                      <SelectTrigger className="bg-background focus:border-primary w-full">
                        <SelectValue placeholder="Select city" />
                      </SelectTrigger>
                      <SelectContent>
                        {cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormField>
                </div>
              </div>

              {/* Contact Information Section */}
              <div className="space-y-3">
                <h3 className="text-base font-semibold text-foreground mb-3">Contact Information</h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField label="Phone Number">
                    <div className="flex space-x-2">
                      <Select value={formData.countryCode} onValueChange={v => handleInputChange('countryCode', v)}>
                        <SelectTrigger className="w-20 bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {countryCodeOptions.map(o => (
                            <SelectItem key={o.code} value={o.code}>{o.code}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="Phone number"
                        value={formData.contact}
                        onChange={e => handleInputChange('contact', e.target.value)}
                        className="flex-1 bg-background focus:border-primary"
                      />
                    </div>
                  </FormField>

                  <FormField label="Email Address" required>
                    <Input
                      type="email"
                      placeholder="Enter email address"
                      value={formData.email}
                      onChange={e => handleInputChange('email', e.target.value)}
                      className="bg-background focus:border-primary"
                    />
                  </FormField>

                  <FormField label="Postal Code">
                    <Input
                      placeholder="Enter postal code"
                      value={formData.zipcode}
                      onChange={e => handleInputChange('zipcode', e.target.value)}
                      className="bg-background focus:border-primary"
                    />
                  </FormField>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Primary Address">
                    <Textarea
                      placeholder="Enter primary address"
                      value={formData.address1}
                      onChange={e => handleInputChange('address1', e.target.value)}
                      className="min-h-24 bg-background focus:border-primary"
                    />
                  </FormField>

                  <FormField label="Secondary Address">
                    <Textarea
                      placeholder="Enter secondary address (optional)"
                      value={formData.address2}
                      onChange={e => handleInputChange('address2', e.target.value)}
                      className="min-h-24 bg-background focus:border-primary"
                    />
                  </FormField>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="business-units">
              <BusinessUnitManager
                organizationName={formData.organisationName}
                businessUnits={formData.businessUnits}
                onBusinessUnitsChange={handleBusinessUnitsChange}
              />
            </TabsContent>

            <TabsContent value="business-process">
              <BusinessProcessManager
                organizationName={formData.organisationName}
                businessUnits={formData.businessUnits}
                businessProcesses={formData.businessProcesses}
                onBusinessProcessesChange={handleBusinessProcessesChange}
              />
            </TabsContent>

            <TabsContent value="projects">
              <ProjectManager
                organizationName={formData.organisationName}
                organizations={[formData]} // Pass current org as an option for client
                businessUnits={formData.businessUnits}
                projects={formData.projects}
                onProjectsChange={handleProjectsChange}
              />
            </TabsContent>

          </div>
        </Tabs>
      </div>
    </div>
  );
}
