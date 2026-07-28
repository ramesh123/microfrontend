import { Organization, OrganizationFormData, Permissions, Role as SimpleRole } from '@/types';
import { OrganizationSelectionPage } from './components/OrganizationSelectionPage';
import { useNavigate } from 'react-router';
import { defaultRoles, useOrganizations } from '@/hooks/useOrganizations';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/auth/authContext';
import { getOrganizationPerspectiveIds } from '@/controllers/API/apiService';
import { useRbacStore } from '@/stores/useRBACStore';

const OrganizationSelection = () => { 
  const navigate = useNavigate();
  const [globalPermissions, setGlobalPermissions] = useState<Permissions | null>(null);
  const { state: authState } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [apiOrganizations, setApiOrganizations] = useState<Array<{ value: number; label: string }>>([]);
  const [apiPerspectives, setApiPerspectives] = useState<Array<{ value: number; label: string }>>([]);
  const [isLoadingOrgData, setIsLoadingOrgData] = useState(false);

  const { 
    currentOrg, 
    selectOrganization,
    createOrganization,
    updateOrganization,
    updateRolePermission,
    addRole,
    isLoading: orgsLoading
  } = useOrganizations();
  const { switchOrganization, availableOrganizations } = useRbacStore();
  const permissions = {
    'create-organization': true,
    'edit-organization': true,
    'create-workflow': true,
    'edit-workflow': true,
    'view-analytics': true,
    'manage-settings': true,
  };

  const convertApiOrgToOrganization = (
    apiOrg: any, 
    perspectives: Array<{ value: number; label: string }>
  ): Organization => {
    // Convert default roles to simple Role format
    const simpleRoles: SimpleRole[] = defaultRoles.map(role => ({
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: {} as Permissions // For now, empty permissions
    }));

    return {
      id: apiOrg?.id,
      org_id: apiOrg?.org_id,
      org_name: apiOrg?.org_name,
      description: apiOrg?.description,
      created_at: apiOrg?.created_at,
      memberCount: 1,
      plan: 'pro' as const,
      roles: simpleRoles,
      // Optional fields for extended organization data
      industryType: apiOrg?.industry_type,
      country: apiOrg?.country,
      state: apiOrg?.state,
      city: apiOrg?.city,
      email: authState?.authInfo?.user?.email || apiOrg?.email
    };
  };

  const loadOrganizationDataFromStorage = () => {
    try {
      // Try to get API organizations from localStorage first
      const apiOrgsData = localStorage.getItem('api_organizations');
      const apiPerspecData = localStorage.getItem('api_perspectives');
      
      if (apiOrgsData && apiPerspecData) {
        const apiOrganizations = JSON.parse(apiOrgsData);
        const apiPerspectives = JSON.parse(apiPerspecData);
        
        console.log("Found API organizations in localStorage:", apiOrganizations);
        setApiOrganizations(apiOrganizations);
        setApiPerspectives(apiPerspectives);
        
        // Convert API organizations to Organization format
        const apiOrgs = apiOrganizations.map((org: any) => 
          convertApiOrgToOrganization(org, apiPerspectives)
        );
        
        setOrganizations(apiOrgs);
        
        // Don't auto-select - let user choose
        console.log("Loaded API organizations:", apiOrgs);
        
        return true; // Successfully loaded API data
      }
      
      return false; // No API data found
    } catch (error) {
      console.error("Error loading API organization data:", error);
      return false;
    }
  };

  const fetchOrganizationData = async (username: string, currentOrganizations: Organization[]) => {
    setIsLoadingOrgData(true);
    try {
      const response = await getOrganizationPerspectiveIds(username);
      if (response.status) {
        setApiOrganizations(response.data.org_details);
        setApiPerspectives(response.data.perspective_details);
        
        // Store in localStorage for future use
        localStorage.setItem('api_organizations', JSON.stringify(response.data.org_details));
        localStorage.setItem('api_perspectives', JSON.stringify(response.data.perspective_details));
        
        // Convert API organizations to Organization format and combine with local ones
        const apiOrgs = response.data.org_details.map(org => 
          convertApiOrgToOrganization(org, response.data.perspective_details)
        );
        const combinedOrgs = [...currentOrganizations, ...apiOrgs];
        setOrganizations(combinedOrgs);
        
        // Don't auto-select - let user choose
        console.log("Loaded combined organizations:", combinedOrgs);
      }
    } catch (error) {
      console.error("Error fetching organization data:", error);
    } finally {
      setIsLoadingOrgData(false);
    }
  };

  useEffect(() => {
    if (authState?.authInfo?.user) {
      // First, try to load API organization data from localStorage
      const hasApiData = loadOrganizationDataFromStorage();
      
      if (!hasApiData) {
        // If no API data, try loading local organizations
        const savedOrgs = localStorage.getItem('organizations');
        let parsedOrgs: Organization[] = [];
    
        try {
          parsedOrgs = savedOrgs ? JSON.parse(savedOrgs) : [];
        } catch (e) {
          console.error("Failed to parse organizations from localStorage", e);
        }
    
        if (parsedOrgs.length > 0) {
          console.log("Using local organizations:", parsedOrgs);
          setOrganizations(parsedOrgs);
          // Don't auto-select - let user choose
        } else {
          // If no local orgs and no API data, try to fetch from API
          if (authState.authInfo.user.username) {
            fetchOrganizationData(authState.authInfo.user.username, []);
          }
        }
      }
  
      // Set global permissions based on user's default role
      const userRole = defaultRoles.find(
        role => role.name === authState?.authInfo?.user.role
      );
      if (userRole) {
        setGlobalPermissions(userRole.permissions);
      }
    }
  }, [authState?.authInfo?.user]);

  const handleCreateOrg = async (data: OrganizationFormData) => {
    const newOrg = await createOrganization(data);
    if (newOrg) {
      selectOrganization(newOrg);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("auth");
    navigate("/login");
  };

  // Create default organization if no organizations are available
  const getDisplayOrganizations = () => {
    if (organizations.length > 0) {
      return organizations;
    }
    
    // If no organizations found, create a default one
    if (!isLoadingOrgData) {
      const defaultOrg = convertApiOrgToOrganization(
        { value: 0, label: "Default Organization" },
        [{ value: 0, label: "Default Perspective" }]
      );
      return [defaultOrg];
    }
    
    return [];
  };

  const displayOrganizations = getDisplayOrganizations();

  const handleSelectOrganization = async (orgId: string) => {
    const orgPerspectives = await switchOrganization(orgId);
    console.log("Selected Organization Perspectives:", orgPerspectives);
    if (orgPerspectives.length > 0) {
      navigate("/dashboard");
    }
  };

  console.log("Available Organizations:", availableOrganizations);
  console.log("Display Organizations:", displayOrganizations);

  if (displayOrganizations.length > 0 || isLoadingOrgData) {
    return (
      <OrganizationSelectionPage
        user={authState?.authInfo?.user}
        organizations={availableOrganizations}
        permissions={permissions}
        onSelectOrganization={handleSelectOrganization}
        onCreateOrganization={handleCreateOrg}
        onUpdateOrganization={updateOrganization}
        onLogout={handleLogout}
      />
    );
  }

  // Show loading state when no organizations are available and still loading
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Loading organizations...</h2>
        <p className="text-muted-foreground">Please wait while we fetch your organization details.</p>
      </div>
    </div>
  );
}

export default OrganizationSelection;
