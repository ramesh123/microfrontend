import { useState, useEffect } from 'react';
import { Organization, OrganizationFormData, Role, Permissions, Permission } from '@/types';
import { useNavigate } from 'react-router';

export const defaultRoles: Role[] = [
  {
    id: 'role-1',
    name: 'Admin',
    description: 'Full access to all features and settings.',
    permissions: {
      'create-organization': true,
      'edit-organization': true,
      'create-workflow': true,
      'edit-workflow': true,
      'view-analytics': true,
      'manage-settings': true,
    },
  },
  {
    id: 'role-2',
    name: 'Member',
    description: 'Can create and manage workflows, but cannot change settings.',
    permissions: {
      'create-organization': false,
      'edit-organization': false,
      'create-workflow': true,
      'edit-workflow': true,
      'view-analytics': true,
      'manage-settings': false,
    },
  },
  {
    id: 'role-3',
    name: 'Viewer',
    description: 'Can only view workflows and analytics.',
    permissions: {
      'create-organization': false,
      'edit-organization': false,
      'create-workflow': false,
      'edit-workflow': false,
      'view-analytics': true,
      'manage-settings': false,
    },
  },
];

// Ensures a role's permissions are complete by merging with defaults.
const ensureCompletePermissions = (role: Role): Role => {
  const defaultPermissionKeys = Object.keys(defaultRoles[0].permissions) as Permission[];
  const completePermissions = { ...role.permissions };

  for (const key of defaultPermissionKeys) {
    if (!(key in completePermissions)) {
      completePermissions[key] = false;
    }
  }

  const defaultRole = defaultRoles.find(dr => dr.name === role.name);
  if (!defaultRole) return { ...role, permissions: completePermissions };

  return {
    ...role,
    permissions: {
      ...defaultRole.permissions,
      ...role.permissions,
    }
  };
};


export function useOrganizations() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const savedOrgs = localStorage.getItem('organizations');
    const savedCurrentOrgId = localStorage.getItem('currentOrgId');

    let loadedOrgs: Organization[] = [];

    if (savedOrgs) {
      const parsedOrgs: Organization[] = JSON.parse(savedOrgs);

      // --- MIGRATION LOGIC ---
      const migratedOrgs = parsedOrgs.map(org => ({
        ...org,
        roles: org.roles.map(ensureCompletePermissions)
      }));
      // --- END MIGRATION LOGIC ---

      loadedOrgs = migratedOrgs;
      setOrganizations(migratedOrgs.length > 0 ? migratedOrgs : []);
    } else {
      const mockOrgs: Organization[] = [
        {
          id: '1',
          org_id: '1',
          org_name: 'Default Organization',
          description: 'Your default workspace for workflow automation',
          logo: 'https://api.dicebear.com/7.x/shapes/svg?seed=default',
          created_at: '2024-01-01',
          memberCount: 1,
          plan: 'free',
          industryType: 'Technology',
          country: 'United States',
          state: 'California',
          city: 'Los Angeles',
          email: 'default@example.com',
          roles: JSON.parse(JSON.stringify(defaultRoles)) // Deep copy
        }
      ];
      loadedOrgs = mockOrgs;
      setOrganizations(mockOrgs);
    }

    if (savedCurrentOrgId) {
      const orgToSelect = loadedOrgs.find(o => o.id === savedCurrentOrgId);
      setCurrentOrg(orgToSelect || null);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (organizations.length > 0) {
      localStorage.setItem('organizations', JSON.stringify(organizations));
    }
    if (currentOrg?.id) {
      console.log("Current Organization:", currentOrg);
      localStorage.setItem('currentOrgId', currentOrg.id);
    } else {
      localStorage.removeItem('currentOrgId');
    }
  }, [organizations, currentOrg?.id]);

  const selectOrganization = (org: Organization | null) => {
    console.log("Selected Organization:", org);
    setCurrentOrg(org);
    navigate("/dashboard");
  };

  const createOrganization = async (data: OrganizationFormData) => {
    const newOrg: Organization = {
      id: Date.now().toString(),
      name: data.name,
      description: `${data.industryType} organization in ${data.city}, ${data.state}`,
      logo: `https://api.dicebear.com/7.x/shapes/svg?seed=${data.name}`,
      created_at: new Date().toISOString(),
      memberCount: 1,
      plan: 'free',
      roles: JSON.parse(JSON.stringify(defaultRoles)), // Deep copy for new org
      ...data,
      org_id: '',
      org_name: ''
    };

    setOrganizations(prev => [...prev, newOrg]);
    return newOrg;
  };

  const updateOrganization = async (orgId: string, data: OrganizationFormData) => {
    setOrganizations(prevOrgs =>
      prevOrgs.map(org => {
        if (org.id === orgId) {
          const updatedOrg = {
            ...org,
            ...data,
            name: data.name,
            description: `${data.industryType} organization in ${data.city}, ${data.state}`,
          };
          if (currentOrg?.id === orgId) {
            setCurrentOrg(updatedOrg);
          }
          return updatedOrg;
        }
        return org;
      })
    );
  };

  const updateRolePermission = (orgId: string, roleId: string, permission: Permission, value: boolean) => {
    setOrganizations(prevOrgs =>
      prevOrgs.map(org => {
        if (org.id === orgId) {
          const updatedRoles = org.roles.map(role =>
            role.id === roleId
              ? { ...role, permissions: { ...role.permissions, [permission]: value } }
              : role
          );
          const updatedOrg = { ...org, roles: updatedRoles };

          if (currentOrg?.id === orgId) {
            setCurrentOrg(updatedOrg);
          }
          return updatedOrg;
        }
        return org;
      })
    );
  };

  const addRole = (orgId: string, roleName: string, description: string) => {
    const newRole: Role = {
      id: `role-${Date.now()}`,
      name: roleName,
      description,
      permissions: {
        'create-organization': false,
        'edit-organization': false,
        'create-workflow': false,
        'edit-workflow': false,
        'view-analytics': false,
        'manage-settings': false,
      },
    };

    setOrganizations(prevOrgs =>
      prevOrgs.map(org => {
        if (org.id === orgId) {
          const updatedRoles = [...org.roles, newRole];
          const updatedOrg = { ...org, roles: updatedRoles };

          if (currentOrg?.id === orgId) {
            setCurrentOrg(updatedOrg);
          }
          return updatedOrg;
        }
        return org;
      })
    );
  };


  return {
    organizations,
    currentOrg,
    selectOrganization,
    createOrganization,
    updateOrganization,
    updateRolePermission,
    addRole,
    isLoading
  };
}
