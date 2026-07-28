import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { OrganizationCard } from './OrganizationCard';
import { OrganizationFormDialog } from './OrganizationFormDialog';
import { User, Organization, OrganizationFormData, Permissions } from '@/types';
import { 
  LogOut, 
  Plus,
  Building2,
  Users,
  Zap,
  Sparkles,
  Workflow
} from 'lucide-react';

interface OrganizationSelectionPageProps {
  user: User;
  organizations: Organization[];
  permissions: Permissions | null;
  onSelectOrganization: (orgId: string) => void;
  onCreateOrganization: (data: OrganizationFormData) => Promise<void>;
  onUpdateOrganization: (orgId: string, data: OrganizationFormData) => Promise<void>;
  onLogout: () => void;
}

export function OrganizationSelectionPage({ 
  user, 
  organizations, 
  permissions,
  onSelectOrganization, 
  onCreateOrganization,
  onUpdateOrganization,
  onLogout 
}: OrganizationSelectionPageProps) {

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="p-2 border-b bg-white dark:bg-gray-800 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-primary rounded-lg">
            <Workflow className="h-5 w-5 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold">Workflow Automation</h1>
        </div>
        <Button onClick={onLogout} variant="ghost">
          <LogOut className="mr-2 h-5 w-5" />
          Logout
        </Button>
      </header>
      
      <main className="p-6 sm:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-4">
            <h1 className="text-3xl font-bold tracking-tight">Welcome, {user.first_name} {user.last_name}!</h1>
            <p className="text-muted-foreground mt-1">
              Select an organization to continue or create a new one to get started.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {organizations.map((org) => {
              const userRoleInOrg = org?.roles?.find(role => role.name === user?.role);
              const permissionsForOrg = userRoleInOrg ? userRoleInOrg?.permissions : null;

              return (
                <OrganizationCard
                  key={org.id}
                  organization={org}
                  isSelected={false} // No org is "selected" on this page
                  onSelect={() => onSelectOrganization(org.org_id)}
                  permissions={permissionsForOrg}
                  onUpdateOrganization={onUpdateOrganization}
                />
              );
            })}
            
            {permissions?.['create-organization'] && (
              <OrganizationFormDialog
                onCreateOrganization={onCreateOrganization}
                trigger={
                  <Card className="cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-105 border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-purple-500/5 hover:from-primary/10 hover:to-purple-500/10 group h-full flex flex-col">
                    <CardHeader className="text-center pb-2">
                      <div className="mx-auto w-16 h-16 bg-gradient-to-br from-primary to-purple-500 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                        <Plus className="h-8 w-8 text-white" />
                      </div>
                      <CardTitle className="text-xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                        Create New Organization
                      </CardTitle>
                      <CardDescription className="text-center">
                        Start your workflow automation journey
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0 flex-grow flex flex-col justify-end">
                      {/* <div className="space-y-3">
                        <div className="flex items-center space-x-3 text-sm text-muted-foreground">
                          <div className="flex items-center justify-center w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                            <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <span>Dedicated workspace</span>
                        </div>
                        <div className="flex items-center space-x-3 text-sm text-muted-foreground">
                          <div className="flex items-center justify-center w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-full">
                            <Users className="h-4 w-4 text-green-600 dark:text-green-400" />
                          </div>
                          <span>Team collaboration</span>
                        </div>
                        <div className="flex items-center space-x-3 text-sm text-muted-foreground">
                          <div className="flex items-center justify-center w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                            <Zap className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                          </div>
                          <span>Advanced workflows</span>
                        </div>
                      </div> */}
                      <div className="mt-6 flex justify-center">
                        <div className="flex items-center space-x-2 text-primary font-medium group-hover:text-purple-600 transition-colors">
                          <Sparkles className="h-4 w-4" />
                          <span>Get Started</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                }
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
