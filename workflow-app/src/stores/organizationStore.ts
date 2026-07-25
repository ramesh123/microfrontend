import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Organization, Role, Permissions, Permission, Perspective, User, ComponentNode, OrchestrationItemType, HierarchyItem } from '@/types/orchestration';
import { toast } from "sonner";
import { componentTree as defaultComponentTree } from '@/lib/componentRegistry';
import { createPerspectiveApi, deletePerspectiveApi, getAllPerspectivesApi } from '@/controllers/API/orchestrationApi';
import { useApiCrud } from '@/hooks/useOrganizationSetup';

const allPermissionKeys: Permission[] = [
  'create-organization', 'edit-organization', 'manage-roles', 'manage-perspectives', 'manage-users', 'manage-application-settings',
  'sap-dashboard-view', 'sap-templates-projects-view', 'sap-templates-projects-edit', 'sap-templates-projects-delete',
  'sap-templates-templates-use', 'sap-templates-templates-view', 'sap-templates-workflows-create', 'sap-templates-workflows-delete',
  'sap-templates-workflows-edit', 'sap-templates-workflows-view', 'sap-templates-workflows-execute', 'sap-connections-view',
  'sap-connections-create', 'sap-connections-edit', 'sap-connections-delete', 'sap-datasets-view', 'sap-datasets-create',
  'sap-datasets-edit', 'sap-datasets-delete', 'sap-masterdata-view', 'sap-masterdata-create', 'sap-masterdata-edit',
  'sap-masterdata-delete', 'sap-jobs-view', 'sap-validationcomp-view', 'sap-validationcomp-create', 'sap-validationcomp-edit',
  'sap-validationcomp-delete', 'sap-testdesign-scenariosource-generate', 'sap-testdesign-scenariosource-view',
  'sap-testdesign-scenariosource-download', 'sap-testdesign-scenariosource-delete', 'sap-testautomation-execute',
  'sap-testautomation-validation', 'sap-testautomation-comparators', 'sap-testautomation-testcases', 'sap-testautomation-dataconversion',
  'sap-testexecution-createtestset', 'sap-testexecution-execute'
];

const getDefaultPermissions = (): Permissions => { 
  const perms: Partial<Permissions> = {};
  for (const key of allPermissionKeys) { perms[key] = false; }

  const addComponentPerms = (nodes: ComponentNode[]) => {
    nodes.forEach(node => {  
      if (node.permissionId) { perms[node.permissionId] = false; }
      if (node.children) { addComponentPerms(node.children); }
    });
  };

  addComponentPerms(defaultComponentTree);
  return perms as Permissions;
};

const getFullPermissions = (): Permissions => {
  const perms = getDefaultPermissions();
  for (const key in perms) { perms[key as Permission] = true; }
  return perms;
};

const businessPermissions = { ...getDefaultPermissions(), 'sap-dashboard-view': true, 'sap-jobs-view': true };
const designerPermissions = { ...getDefaultPermissions(), 'sap-templates-workflows-create': true, 'sap-templates-workflows-edit': true, 'sap-templates-workflows-view': true, 'sap-validationcomp-create': true, 'sap-validationcomp-edit': true, 'sap-testdesign-scenariosource-generate': true };
const managerSmePermissions = { ...getDefaultPermissions(), 'sap-dashboard-view': true, 'sap-templates-workflows-execute': true, 'sap-testexecution-execute': true };

export const defaultRoles: Role[] = [
  { id: 'role-1', name: 'Admin', description: 'Full access to all features and settings.', perspectiveIds: ['perspective-admin'] },
  { id: 'role-2', name: 'Member', description: 'Can create and manage workflows.', perspectiveIds: ['perspective-member'] },
  { id: 'role-3', name: 'Viewer', description: 'Read-only access.', perspectiveIds: ['perspective-viewer'] },
  { id: 'role-4', name: 'Business', description: 'High-level overview of business processes and analytics.', perspectiveIds: ['perspective-business'] },
  { id: 'role-5', name: 'Designer', description: 'Designs and builds workflows.', perspectiveIds: ['perspective-designer'] },
  { id: 'role-6', name: 'Manager & SME', description: 'Manages processes and provides subject matter expertise.', perspectiveIds: ['perspective-manager-sme'] },
];

export const defaultPerspectives: Perspective[] = [
  { id: 'perspective-admin', name: 'Administrator Perspective', description: 'Grants access to all UI components.', permissions: getFullPermissions() },
  { id: 'perspective-member', name: 'Member Perspective', description: 'Standard access for team members.', permissions: { ...getDefaultPermissions(), 'sap-templates-workflows-create': true, 'sap-templates-workflows-edit': true, 'sap-templates-workflows-view': true } },
  { id: 'perspective-viewer', name: 'Viewer Perspective', description: 'Read-only access.', permissions: { ...getDefaultPermissions(), 'sap-dashboard-view': true } },
  { id: 'perspective-sap', name: 'SAP Validation', description: 'Full access to all SAP validation tasks.', permissions: getFullPermissions() },
  { id: 'perspective-business', name: 'Business Perspective', description: 'View analytics and high-level workflow status.', permissions: businessPermissions },
  { id: 'perspective-designer', name: 'Designer Perspective', description: 'Create and edit workflows.', permissions: designerPermissions },
  { id: 'perspective-manager-sme', name: 'Manager & SME Perspective', description: 'Execute workflows and view analytics.', permissions: managerSmePermissions },
];

interface OrganizationState {
  organizations: Organization[];
  currentOrgId: string | null;
  activePerspectiveId: string | null;
  isLoading: boolean;
  theme: 'light' | 'dark';
}

interface OrganizationActions {
  _hydrate: () => void;
  selectOrganization: (org: Organization | null, user: User | null) => void;
  setActivePerspective: (perspectiveId: string | null) => void;
  createOrganization: (orgData: Organization) => Promise<Organization>;
  updateOrganization: (orgData: Organization) => Promise<void>;
  deleteOrganization: (orgId: string) => void;
  addRole: (orgId: string, roleName: string, description: string) => void;
  deleteRole: (orgId: string, roleId: string) => void;
  addUser: (orgId: string, email: string, roleName: string) => void;
  updateUserRole: (orgId: string, userId: string, newRoleName: string) => void;
  createPerspective: (orgId: string, name: string, description: string) => void;
  updatePerspective: (orgId: any, updatedPerspective: Perspective) => void;
  togglePerspectiveForRole: (orgId: string, roleId: string, perspectiveId: string) => void;
  deletePerspective: (orgId: string, perspectiveId: string) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  updateFullOrganization: (orgData: Organization) => void;
}

const initialState: OrganizationState = {
  organizations: [],
  currentOrgId: null,
  activePerspectiveId: null,
  isLoading: true,
  theme: 'dark',
};

export const useOrganizationStore = create<OrganizationState & OrganizationActions>()(
  persist(
    (set, get) => ({
      ...initialState,
      _hydrate: () => { set({ isLoading: false }); },
      selectOrganization: (org, user) => {
        let activePerspectiveId = null;
        if (org && user) {
          const userRole = org.roles.find(r => r.name === user.role);
          if (userRole && userRole.perspectiveIds.length > 0) {
            activePerspectiveId = userRole.perspectiveIds[0];
          }
        }
        set({ currentOrgId: org ? org.id : null, activePerspectiveId });
      },
      setActivePerspective: (perspectiveId) => set({ activePerspectiveId: perspectiveId }),
      createOrganization: async (orgData) => {
        const newOrg = { ...orgData, id: `organization-${Date.now()}` };
        set(state => ({ organizations: [...state.organizations, newOrg] }));
        toast.success(`Organization "${newOrg.name}" created successfully!`);
        return newOrg;
      },
      updateOrganization: async (orgData) => {
        set(state => {
          const newOrgs = state.organizations.map(org => org.id === orgData.id ? orgData : org);
          toast.success(`Organization "${orgData.name}" updated successfully!`);
          return { organizations: newOrgs };
        });
      },
      deleteOrganization: (orgId) => {
        set(state => {
          const orgToDelete = state.organizations.find(o => o.id === orgId);
          if (!orgToDelete) return {};
          const newOrgs = state.organizations.filter(o => o.id !== orgId);
          toast.success(`Organization "${orgToDelete.name}" deleted successfully.`);

          if (state.currentOrgId === orgId) {
            return { organizations: newOrgs, currentOrgId: null, activePerspectiveId: null };
          }

          return { organizations: newOrgs };
        });
      },
      addRole: (orgId, roleName, description) => {
        const newRole: Role = { id: `role-${Date.now()}`, name: roleName, description, perspectiveIds: [] };
        set(state => {
          const newOrgs = JSON.parse(JSON.stringify(state.organizations));
          const org = newOrgs.find((o: Organization) => o.id === orgId);
          if (org) { org.roles.push(newRole); toast.success(`Role "${roleName}" added.`); }
          return { organizations: newOrgs };
        });
      },
      deleteRole: (orgId, roleId) => {
        set(state => {
          const newOrgs = JSON.parse(JSON.stringify(state.organizations));
          const org = newOrgs.find((o: Organization) => o.id === orgId);
          if (!org) return {};
          const roleToDelete = org.roles.find((r: Role) => r.id === roleId);
          if (!roleToDelete) return {};
          org.roles = org.roles.filter((r: Role) => r.id !== roleId);
          const viewerRole = org.roles.find((r: Role) => r.name === 'Viewer');
          if (viewerRole) { org.users.forEach((user: User) => { if (user.role === roleToDelete.name) user.role = viewerRole.name; }); }
          toast.success(`Role "${roleToDelete.name}" deleted.`);
          return { organizations: newOrgs };
        });
      },
      addUser: (orgId, email, roleName) => {
        const newUser: User = { id: `user-${Date.now()}`, email, name: email.split('@')[0], avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`, role: roleName };
        set(state => {
          const newOrgs = JSON.parse(JSON.stringify(state.organizations));
          const org = newOrgs.find((o: Organization) => o.id === orgId);
          if (org) {
            if (!org.users) org.users = [];
            org.users.push(newUser);
            org.memberCount = org.users.length;
            toast.success(`User ${email} invited as ${roleName}.`);
          }
          return { organizations: newOrgs };
        });
      },
      updateUserRole: (orgId, userId, newRoleName) => {
        set(state => {
          const newOrgs = JSON.parse(JSON.stringify(state.organizations));
          const org = newOrgs.find((o: Organization) => o.id === orgId);
          if (org) {
            const user = org.users.find((u: User) => u.id === userId);
            if (user) {
              user.role = newRoleName;
              toast.success(`Updated ${user.name}'s role to ${newRoleName}.`);
            }
          }
          return { organizations: newOrgs };
        });
      },
      createPerspective: (orgId, name, description) => {
        const newId = `perspective-${Date.now()}`;
        const newPerspective: Perspective = { perspective_ids: newId, name: name.trim(), description, permissions: getDefaultPermissions() };
        // set(state => {
        //   const newOrgs = JSON.parse(JSON.stringify(state.organizations));
        //   const org = newOrgs.find((o: Organization) => o.id === orgId);
        //   if (org) { org.perspectives.push(newPerspective); toast.success(`Perspective "${name}" created.`); }
        //   return { organizations: newOrgs };
        // });
        return newPerspective;
      },
      updatePerspective: async (org, updatedPerspective) => {
        console.log("updatedPerspective", updatedPerspective);

        let params = {
          ...updatedPerspective,
          org_id: org.id.toString(),
          org_name: org.org_name
        }

        // const res = await createApi(params);
        // console.log("response for updated perspective", res);
        // set(state => {
        //   const newOrgs = JSON.parse(JSON.stringify(state.organizations));
        //   const org = newOrgs.find((o: Organization) => o.id === orgId);
        //   if (org) { const pIndex = org.perspectives.findIndex((p: Perspective) => p.id === updatedPerspective.id); if (pIndex !== -1) { org.perspectives[pIndex] = updatedPerspective; toast.success(`Perspective "${updatedPerspective.name}" saved.`); } }
        //   return { organizations: newOrgs };
        // });
      },
      togglePerspectiveForRole: (orgId, roleId, perspectiveId) => {
        set(state => {
          const newOrgs = JSON.parse(JSON.stringify(state.organizations));
          const org = newOrgs.find((o: Organization) => o.id === orgId);
          if (!org) return {};
          const role = org.roles.find((r: Role) => r.id === roleId);
          if (!role) return {};
          const pIndex = role.perspectiveIds.indexOf(perspectiveId);
          if (pIndex > -1) { role.perspectiveIds.splice(pIndex, 1); } else { role.perspectiveIds.push(perspectiveId); }
          const pName = org.perspectives.find((p: Perspective) => p.id === perspectiveId)?.name;
          toast.success(`Updated perspectives for role "${role.name}".`);
          return { organizations: newOrgs };
        });
      },
      deletePerspective: async (orgId, perspectiveId) => {
        const res = await deletePerspectiveApi(perspectiveId);
        console.log("response for deleted perspective", res);
        // set(state => {
        //   const newOrgs = JSON.parse(JSON.stringify(state.organizations));
        //   const org = newOrgs.find((o: Organization) => o.id === orgId);
        //   if (org) {
        //     const pName = org.perspectives.find((p: Perspective) => p.id === perspectiveId)?.name;
        //     org.perspectives = org.perspectives.filter((p: Perspective) => p.id !== perspectiveId);
        //     org.roles.forEach((role: Role) => { const pIndex = role.perspectiveIds.indexOf(perspectiveId); if (pIndex > -1) { role.perspectiveIds.splice(pIndex, 1); } });
        //     toast.success(`Perspective "${pName}" deleted.`);
        //   }
        //   return { organizations: newOrgs };
        // });
      },
      setTheme: (theme) => set({ theme }),
      updateFullOrganization: (orgData) => {
        set(state => {
          const newOrgs = state.organizations.map(org => org.id === orgData.id ? orgData : org);
          return { organizations: newOrgs };
        });
      },
    }),
    {
      name: 'flowcraft-storage',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => { if (state) { state.isLoading = false; } },
      version: 17, // Bump version for new data model
      migrate: (persistedState: any, version) => {
        if (version < 17 && persistedState?.organizations) {
          persistedState.organizations.forEach((org: any) => {
            // Convert old hierarchy to new generic hierarchy
            if (!org.hierarchy) {
              const hierarchy: HierarchyItem = {
                id: org.id,
                name: org.name,
                type: 'organization',
                position: org.position || { x: 50, y: 50 },
                children: []
              };

              const convertChildren = (oldChildren: any[], type: OrchestrationItemType): HierarchyItem[] => {
                if (!oldChildren) return [];
                return oldChildren.map(child => {
                  const childType = child.id.split('-')[0] as OrchestrationItemType;
                  return {
                    ...child,
                    type: childType,
                    children: convertChildren(child.children || [], childType)
                  }
                })
              }

              // This is a simplified migration. A real one would be more complex.
              const oldHierarchyKeys = ['businessUnits', 'applications', 'businessProcesses', 'transactions', 'tables', 'projects'];
              let currentLevelItems: any[] = [hierarchy];

              oldHierarchyKeys.forEach(key => {
                const nextLevelItems: any[] = [];
                currentLevelItems.forEach(parent => {
                  if (parent[key]) {
                    parent.children.push(...convertChildren(parent[key], key.slice(0, -1) as OrchestrationItemType));
                    nextLevelItems.push(...parent.children);
                  }
                });
                currentLevelItems = nextLevelItems;
              });

              org.hierarchy = hierarchy;
              oldHierarchyKeys.forEach(key => delete org[key]);
            }
          });
        }
        return persistedState;
      },
    }
  )
);

useOrganizationStore.getState()._hydrate();
