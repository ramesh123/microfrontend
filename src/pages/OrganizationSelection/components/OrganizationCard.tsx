import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Organization, OrganizationFormData, Permissions } from '@/types';
import { Users, Calendar, Crown, MapPin, Building, Edit } from 'lucide-react';
import { OrganizationFormDialog } from './OrganizationFormDialog';
import ForwardedIconComponent from '@/components/common/genericIconComponent';
// import { OrganizationFormDialog } from './OrganizationFormDialog';

interface OrganizationCardProps {
  organization: Organization;
  isSelected: boolean;
  onSelect: () => void;
  permissions: Permissions | null;
  onUpdateOrganization: (orgId: string, data: OrganizationFormData) => Promise<void>;
}

export function OrganizationCard({ organization, isSelected, onSelect, permissions, onUpdateOrganization }: OrganizationCardProps) {
  const getPlanIcon = (plan: string) => {
    switch (plan) {
      case 'enterprise':
        return <Crown className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'pro':
        return 'bg-blue-500';
      case 'enterprise':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <Card className={`flex flex-col gap-3 transition-all hover:shadow-md ${isSelected ? 'ring-2 ring-primary' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Avatar>
              <AvatarImage src={organization.logo} />
              <AvatarFallback>
                <ForwardedIconComponent name="building" className="h-6 w-6" />
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-lg">{organization.org_name}</CardTitle>
              <CardDescription className="text-sm">
                {organization?.description || 'No description'}
              </CardDescription>
            </div>
          </div>
          {/* <Badge variant="secondary" className={`${getPlanColor(organization?.plan)} text-white`}>
            {getPlanIcon(organization?.plan)}
            {organization?.plan?.toUpperCase()}
          </Badge> */}
        </div>
      </CardHeader>
      <CardContent className="flex-grow">
        <div className="space-y-3">
          {organization?.industryType && (
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Building className="h-4 w-4" />
              <span>{organization?.industryType}</span>
            </div>
          )}
          {organization?.city && organization?.state && (
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{organization?.city}, {organization?.state}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1">
                <Users className="h-4 w-4" />
                <span>{organization?.memberCount} members</span>
              </div>
              <div className="flex items-center space-x-1">
                <Calendar className="h-4 w-4" />
                <span>Created {new Date(Date.parse(organization?.created_at)).getFullYear()}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button 
          onClick={onSelect}
          className="w-full"
          variant={isSelected ? "default" : "outline"}
        >
          {isSelected ? 'Selected' : 'Select'}
        </Button>
        {permissions?.['edit-organization'] && (
          <OrganizationFormDialog
            organizationToEdit={organization}
            onUpdateOrganization={onUpdateOrganization}
            trigger={
              <Button variant="secondary" size="icon" aria-label="Edit Organization">
                <Edit className="h-4 w-4" />
              </Button>
            }
          />
        )}
      </CardFooter>
    </Card>
  );
}
