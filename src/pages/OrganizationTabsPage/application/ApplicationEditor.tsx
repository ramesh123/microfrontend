import { useState, useEffect } from 'react';
import { ArrowLeft, Save, AppWindow, Receipt, Star, Code } from 'lucide-react';
import api from "@/controllers/API/api";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Organization, Application, Transaction, Feature, Program } from '../types/organization';
import { Combobox, FormFieldOption } from '@/components/ui/comboboxV2';
import { cn } from '@/lib/utils';
import { TransactionManager } from './TransactionManager';
import { FeatureManager } from './FeatureManager';
import { ProgramManager } from './ProgramManager';
import ForwardedIconComponent from '@/components/common/genericIconComponent';
import { toast } from 'sonner';

interface ApplicationEditorProps {
  initialData: { app: Application; orgId: string } | null;
  organizations: Organization[];
  onSave: (appData: Application, orgId: string) => void;
  onClose: () => void;
}

// Extended Application type to include databaseType
interface ExtendedApplication extends Application {
  databaseType?: string;
}

const initialApplicationState: ExtendedApplication = {
  id: '',
  name: '',
  description: '',
  databaseType: '',
  transactions: [],
  features: [],
  programs: [],
  objects: [],
};

interface DatabaseOption {
  id: number;
  form_type: string;
  name: string;
  display_name: string;
  form_id: string;
  module: string;
  group: string;
  icon: string;
  description: string;
  enabled: boolean;
}

interface DatabaseApiResponse {
  status: boolean;
  message: string;
  data: DatabaseOption[];
}

const FormField: React.FC<{ label: string; required?: boolean; children: React.ReactNode; className?: string }> = ({ label, required, children, className }) => (
  <div className={cn("space-y-1.5 text-left", className)}>
    <label className="text-sm font-medium text-foreground">{label} {required && <span className="text-red-500">*</span>}</label>
    {children}
  </div>
);

export function ApplicationEditor({ initialData, organizations, onSave, onClose }: ApplicationEditorProps) {
  const [appData, setAppData] = useState<ExtendedApplication>(initialApplicationState);
  const [selectedOrgId, setSelectedOrgId] = useState<string | undefined>(initialData?.orgId);
  const [activeTab, setActiveTab] = useState('app-info');
  const [databaseOptions, setDatabaseOptions] = useState<FormFieldOption[]>([]);
  const [isLoadingDatabases, setIsLoadingDatabases] = useState(false);

  useEffect(() => {
    const fetchDatabaseOptions = async () => {
      setIsLoadingDatabases(true);
      try {  //form_id: "". form_type: 
        const response = await api.post<DatabaseApiResponse>('/react-forms/get-form', {
          form_id: "",
          form_type: "connection_vault",
          only_node: true,
          group: "Databases"
        });

        if (response.data.status && response.data.data) {
          const options: FormFieldOption[] = response.data.data
            .filter(db => db.enabled)
            .map(db => ({
              value: db.form_id,
              label: db.display_name,
              icon: ({ className }: { className?: string }) => (
                <ForwardedIconComponent
                  name={db.icon}
                  className={className}
                  skipFallback={true}
                />
              )
            }));
          setDatabaseOptions(options);
        }
      } catch (error) {
        console.error('Error fetching database options:', error);
        // You might want to show a toast or error message here
      } finally {
        setIsLoadingDatabases(false);
      }
    };

    fetchDatabaseOptions();
  }, []);

  useEffect(() => {
    if (initialData) {
      setAppData(initialData.app as ExtendedApplication);
    } else {
      // For a new app, generate a temporary ID
      setAppData({ ...initialApplicationState, id: `APP-${Date.now()}` });
    }
  }, [initialData]);

  const handleSave = () => {
    if (!selectedOrgId) {
      toast.error('Please select an organization.');
      return;
    }
    if (!appData.name) {
     toast.error('Application Name is required.');
      return;
    }
    if (!appData.databaseType) {
      toast.error('Database Type is required.');
      return;
    }

    // Remove databaseType from the saved data if it's not part of the original Application type
    const { databaseType, ...applicationData } = appData;
    onSave(applicationData as Application, selectedOrgId);
  };

  const handleUpdate = <K extends keyof ExtendedApplication>(key: K, value: ExtendedApplication[K]) => {
    setAppData(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h2 className="text-lg font-bold text-foreground">{initialData ? `Edit: ${appData.name}` : 'Add New Application'}</h2>
            <p className="text-sm text-muted-foreground">{initialData ? `Editing application for ${organizations.find(o => o.orgId === selectedOrgId)?.organisationName}` : 'Create a new application and its components'}</p>
          </div>
        </div>
        <Button onClick={handleSave} variant="accent"><Save className="mr-2 h-4 w-4" />Save Application</Button>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="px-4 py-3 border-b bg-muted/50">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 gap-2 bg-background p-1 rounded-full">
              <TabsTrigger value="app-info"><AppWindow className="h-4 w-4 mr-2" />Application Info</TabsTrigger>
              <TabsTrigger value="transactions"><Receipt className="h-4 w-4 mr-2" />Transactions</TabsTrigger>
              <TabsTrigger value="features"><Star className="h-4 w-4 mr-2" />Features</TabsTrigger>
              <TabsTrigger value="programs"><Code className="h-4 w-4 mr-2" />Programs</TabsTrigger>
            </TabsList>
          </div>
          <div className="p-4">
            <TabsContent value="app-info" className="space-y-4">
              <FormField label="Organization" required>
                <Combobox
                  options={organizations.map(o => ({ value: o.orgId, label: o.organisationName }))}
                  value={selectedOrgId || ''}
                  onChange={(value) => setSelectedOrgId(String(value))}
                  placeholder="Select an organization..."
                  disabled={!!initialData} // Disable for edit mode
                />
              </FormField>

              <FormField label="Database Type" required>
                <Combobox
                  options={databaseOptions}
                  value={appData.databaseType || ''}
                  onChange={(value) => handleUpdate('databaseType', String(value))}
                  placeholder="Select a database type..."
                  searchPlaceholder="Search databases..."
                  emptyText="No database found."
                  isLoading={isLoadingDatabases}
                />
              </FormField>

              <FormField label="Application Name" required>
                <Input value={appData.name} onChange={e => handleUpdate('name', e.target.value)} />
              </FormField>

              <FormField label="Description">
                <Textarea value={appData.description} onChange={e => handleUpdate('description', e.target.value)} className="min-h-32" />
              </FormField>
            </TabsContent>
            <TabsContent value="transactions">
              <TransactionManager
                transactions={appData.transactions}
                onUpdate={(newTransactions: Transaction[]) => handleUpdate('transactions', newTransactions)}
              />
            </TabsContent>
            <TabsContent value="features">
              <FeatureManager
                features={appData.features}
                onUpdate={(newFeatures: Feature[]) => handleUpdate('features', newFeatures)}
              />
            </TabsContent>
            <TabsContent value="programs">
              <ProgramManager
                programs={appData.programs}
                features={appData.features}
                onUpdate={(newPrograms: Program[]) => handleUpdate('programs', newPrograms)}
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
