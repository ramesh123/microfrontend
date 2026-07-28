import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, Save, Building, Globe, MapPin, Phone, Mail, Home, Edit } from 'lucide-react';
import { Organization, OrganizationFormData } from '@/types';

interface OrganizationFormDialogProps {
  trigger: React.ReactNode;
  organizationToEdit?: Organization;
  onCreateOrganization?: (data: OrganizationFormData) => Promise<void>;
  onUpdateOrganization?: (orgId: string, data: OrganizationFormData) => Promise<void>;
}

const industryTypes = [
  'Technology', 'Healthcare', 'Finance', 'Manufacturing', 'Retail', 'Education', 'Government', 'Non-profit', 'Consulting', 'Other'
];
const countries = [
  'United States', 'Canada', 'United Kingdom', 'Germany', 'France', 'Australia', 'Japan', 'India', 'Brazil', 'Algeria', 'Other'
];
const states: Record<string, string[]> = {
  'United States': ['California', 'New York', 'Texas', 'Florida', 'Illinois'],
  'Algeria': ['Ain Témouchent Province', 'Algiers', 'Oran', 'Constantine', 'Annaba'],
  'Canada': ['Ontario', 'Quebec', 'British Columbia', 'Alberta', 'Manitoba'],
  'Other': ['State 1', 'State 2', 'State 3']
};
const cities: Record<string, string[]> = {
  'Ain Témouchent Province': ['Beni Saf', 'Ain Témouchent', 'Hammam Bouhadjar'],
  'California': ['Los Angeles', 'San Francisco', 'San Diego', 'Sacramento'],
  'Ontario': ['Toronto', 'Ottawa', 'Hamilton', 'London'],
  'Other': ['City 1', 'City 2', 'City 3']
};

const getInitialFormData = (org?: Organization): OrganizationFormData => ({
  name: org?.org_name || '',
  industryType: org?.industryType || '',
  companyId: org?.companyId || '',
  country: org?.country || '',
  state: org?.state || '',
  city: org?.city || '',
  contact: org?.contact || '',
  email: org?.email || '',
  zipcode: org?.zipcode || '',
  address1: org?.address1 || '',
  address2: org?.address2 || ''
});

export function OrganizationFormDialog({ trigger, organizationToEdit, onCreateOrganization, onUpdateOrganization }: OrganizationFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('organisation-info');
  const [formData, setFormData] = useState<OrganizationFormData>(getInitialFormData(organizationToEdit));

  const mode = organizationToEdit ? 'edit' : 'create';

  useEffect(() => {
    if (open) {
      setFormData(getInitialFormData(organizationToEdit));
    }
  }, [open, organizationToEdit]);

  const updateFormData = (field: keyof OrganizationFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
      ...(field === 'country' ? { state: '', city: '' } : {}),
      ...(field === 'state' ? { city: '' } : {})
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (mode === 'edit' && onUpdateOrganization && organizationToEdit) {
        await onUpdateOrganization(organizationToEdit.id, formData);
      } else if (mode === 'create' && onCreateOrganization) {
        await onCreateOrganization(formData);
      }
      setOpen(false);
      setActiveTab('organisation-info');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatesForCountry = (country: string) => states[country] || states['Other'];
  const getCitiesForState = (state: string) => cities[state] || cities['Other'];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center space-x-2">
            {mode === 'edit' ? <Edit className="h-6 w-6 text-primary" /> : <Building2 className="h-6 w-6 text-primary" />}
            <span>{mode === 'edit' ? 'Edit Organization' : 'Create New Organization'}</span>
          </DialogTitle>
          <DialogDescription>
            {mode === 'edit' ? `Updating the details for ${organizationToEdit?.org_name}.` : 'Complete the organization setup with all required information.'}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4 mb-6">
              <TabsTrigger value="organisation-info" className="data-[state=active]:bg-black data-[state=active]:text-white">Organisation Info</TabsTrigger>
              <TabsTrigger value="business-units" disabled className="opacity-50">Business Units</TabsTrigger>
              <TabsTrigger value="business-process" disabled className="opacity-50">Business Process</TabsTrigger>
              <TabsTrigger value="projects" disabled className="opacity-50">Projects</TabsTrigger>
            </TabsList>
            
            <TabsContent value="organisation-info" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="org-name" className="flex items-center space-x-1"><Building className="h-4 w-4" /><span>Organisation Name</span><span className="text-red-500">*</span></Label>
                  <Input id="org-name" placeholder="Enter Organisation name" value={formData.name} onChange={(e) => updateFormData('name', e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="industry-type" className="flex items-center space-x-1"><Globe className="h-4 w-4" /><span>Industry Type</span><span className="text-red-500">*</span></Label>
                  <Select value={formData.industryType} onValueChange={(value) => updateFormData('industryType', value)}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{industryTypes.map((type) => (<SelectItem key={type} value={type}>{type}</SelectItem>))}</SelectContent></Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-id">Company Id (In ERP System)</Label>
                  <Input id="company-id" placeholder="Enter Company ID" value={formData.companyId} onChange={(e) => updateFormData('companyId', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="country" className="flex items-center space-x-1"><Globe className="h-4 w-4" /><span>Country</span><span className="text-red-500">*</span></Label>
                  <Select value={formData.country} onValueChange={(value) => updateFormData('country', value)}><SelectTrigger><SelectValue placeholder="Select Country" /></SelectTrigger><SelectContent>{countries.map((country) => (<SelectItem key={country} value={country}>{country}</SelectItem>))}</SelectContent></Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state" className="flex items-center space-x-1"><MapPin className="h-4 w-4" /><span>State</span><span className="text-red-500">*</span></Label>
                  <Select value={formData.state} onValueChange={(value) => updateFormData('state', value)} disabled={!formData.country}><SelectTrigger><SelectValue placeholder="Select State" /></SelectTrigger><SelectContent>{formData.country && getStatesForCountry(formData.country).map((state) => (<SelectItem key={state} value={state}>{state}</SelectItem>))}</SelectContent></Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city" className="flex items-center space-x-1"><MapPin className="h-4 w-4" /><span>City</span><span className="text-red-500">*</span></Label>
                  <Select value={formData.city} onValueChange={(value) => updateFormData('city', value)} disabled={!formData.state}><SelectTrigger><SelectValue placeholder="Select City" /></SelectTrigger><SelectContent>{formData.state && getCitiesForState(formData.state).map((city) => (<SelectItem key={city} value={city}>{city}</SelectItem>))}</SelectContent></Select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="contact" className="flex items-center space-x-1"><Phone className="h-4 w-4" /><span>Contact</span></Label>
                  <div className="flex space-x-2">
                    <Select defaultValue="AQ"><SelectTrigger className="w-20"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="AQ">AQ (+)</SelectItem><SelectItem value="US">US (+1)</SelectItem><SelectItem value="UK">UK (+44)</SelectItem><SelectItem value="DZ">DZ (+213)</SelectItem></SelectContent></Select>
                    <Input id="contact" placeholder="Enter phone number" value={formData.contact} onChange={(e) => updateFormData('contact', e.target.value)} className="flex-1" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center space-x-1"><Mail className="h-4 w-4" /><span>Email</span><span className="text-red-500">*</span></Label>
                  <Input id="email" type="email" placeholder="Enter email address" value={formData.email} onChange={(e) => updateFormData('email', e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zipcode">Zipcode</Label>
                  <Input id="zipcode" placeholder="Enter zipcode" value={formData.zipcode} onChange={(e) => updateFormData('zipcode', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="address1" className="flex items-center space-x-1"><Home className="h-4 w-4" /><span>Address 1</span></Label>
                  <Textarea id="address1" placeholder="Address1" value={formData.address1} onChange={(e) => updateFormData('address1', e.target.value)} rows={4} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address2" className="flex items-center space-x-1"><Home className="h-4 w-4" /><span>Address 2</span></Label>
                  <Textarea id="address2" placeholder="Address2" value={formData.address2} onChange={(e) => updateFormData('address2', e.target.value)} rows={4} />
                </div>
              </div>
            </TabsContent>
          </Tabs>
          
          <div className="flex justify-end pt-6 border-t">
            <Button type="submit" disabled={isLoading} className="bg-green-600 hover:bg-green-700 text-white px-6">
              {isLoading ? (<><div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Saving...</>) : (<><Save className="mr-2 h-4 w-4" />Save</>)}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
