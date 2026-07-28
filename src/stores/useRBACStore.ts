import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import axios from 'axios';
import { User, Perspective, Organization, MenuItem, Permission } from '@/types/rbac';
import api from "@/controllers/API/api";
import { IAuthUser } from '@/types/auth';
import { allOrg, apiMenu, perspectives } from '@/data/all_org';
import { toast } from 'sonner';
import { createPerspectiveApi, getAllPerspectivesApi, getProductGroupApi, updatePerspectiveApi } from '@/controllers/API/orchestrationApi';
import { getOrganizationPerspectiveIds } from '@/controllers/API/apiService';
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';

type Theme = 'light' | 'dark' | 'system';

interface RBACState {
  users: User[];
  organizations: any[];
  perspectives: any[];
  currentUser: IAuthUser | null;
  currentOrganization: any | null;
  activePerspective: any | null;
  availableOrganizations: any[];
  availablePerspectives: any[];
  platforms: any[];
  product_group: any[];
  menu_items: MenuItem[];
  theme: Theme;
}

interface RBACActions {
  login: (data: any) => void;
  logout: () => void;
  switchOrganization: (organizationId: string) => Promise<any[]>;
  setActivePerspective: (perspectiveId: string) => void;
  unsetActivePerspective: () => void;
  createPerspective: (perspective: any) => void;
  updatePerspective: (perspective: Perspective, perspectiveId?: string) => void;
  deletePerspective: (perspectiveId: string) => void;
  hasPermission: (action: string, resource: string) => boolean;
  setTheme: (theme: Theme) => void;
  // Helper method to rehydrate data from localStorage if needed
  rehydrateFromStorage: () => void;
  getProductGroup: () => Promise<any>;
  getOrganizationPerspectives: (sessionData: any, data: any) => Promise<any>;
  apiResponse: {
    loading: boolean;
    error: { status: string; message: string };
  };
}

export const useRbacStore = create<RBACState & RBACActions>()(
  persist(
    (set, get) => ({
      users: [],
      organizations: allOrg.data.org_details,
      perspectives: perspectives,
      currentUser: null,
      currentOrganization: null,
      activePerspective: null,
      availableOrganizations: [],
      availablePerspectives: [],
      platforms: [],
      product_group: [],
      menu_items: [],
      theme: 'system',
      apiResponse: {
        loading: false,
        error: { status: "", message: "" },
      },

      setTheme: (theme: Theme) => set({ theme }),

      rehydrateFromStorage: () => {
        try {
          // Try to get data from localStorage if not in store
          const { currentUser, availableOrganizations, availablePerspectives } = get();

          if (!currentUser || availableOrganizations.length === 0) {
            const apiOrgs = localStorage.getItem('api_organizations');
            const apiPerspectives = localStorage.getItem('api_perspectives');

            if (apiOrgs && apiPerspectives) {
              set({
                availableOrganizations: JSON.parse(apiOrgs),
                availablePerspectives: JSON.parse(apiPerspectives),
              });
            }
          }
        } catch (error) {
          console.error('Error rehydrating from storage:', error);
        }
      },

      login: async (data: any): Promise<void | IAuthUser> => {
        try {
          const loginResponse = await api.post("/users/login", {
            username: data.username,
            password: data.password,
          });

          if (loginResponse.status === 200) {
            try {
              const { data: sessionData }: any = await api.get("/session/me");

              if (sessionData.is_authenticated) {
                const userData: IAuthUser = {
                  id: sessionData.employee_id || null,
                  email: sessionData.email,
                  first_name: sessionData.first_name,
                  last_name: sessionData.last_name,
                  is_authenticated: true,
                  permissions: data.permissions,
                  system_role: sessionData.system_role || null,
                  allowed_roles: sessionData.allowed_roles || [],
                  urdhva_role: sessionData.urdhva_role || null,
                  region: sessionData.region || [],
                  zone: sessionData.zone || [],
                  state: sessionData.state || [],
                  sales_area: sessionData.sales_area || [],
                  location_id: sessionData.location_id || [],
                  username: data.username,
                  name: sessionData.first_name + " " + sessionData.last_name,
                  role: sessionData?.algo_role?.[0] || 'Admin',
                  organizationIds: sessionData.org_id || [],
                  menu_items: sessionData.menu_items || [],
                } as any; // Cast to any to allow org_id property

                // Call organization API after successful login
                await get().getOrganizationPerspectives(userData, data);
                return userData;
              } else {
                set({
                  apiResponse: {
                    loading: false,
                    error: { status: "401", message: "Not authenticated" },
                  },
                });
              }
            } catch {
              set({
                apiResponse: {
                  loading: false,
                  error: { status: "500", message: "Session expired" },
                },
              });
            }
          } else {
            set({
              apiResponse: {
                loading: false,
                error: {
                  status: loginResponse.status.toString(),
                  message: "Authentication failed",
                },
              },
            });
          }
        } catch (error) {
          const status = axios.isAxiosError(error) ? error.response?.status : undefined;
          const errorMsg = getDisplayErrorMessage(error, 'Login failed');
          if (status === 502) {
            toast.error('Backend server is down. Please try again later.');
          } else {
            toast.error(errorMsg);
          }
          set({
            apiResponse: {
              loading: false,
              error: { status: String(status ?? '500'), message: errorMsg },
            },
          });
          return;
        } finally {
          set({
            apiResponse: {
              loading: false,
              error: { status: "", message: "" },
            },
          });
        }
        return get().currentUser;
      },

      logout: () => {
        // Clear localStorage
        localStorage.removeItem('api_organizations');
        localStorage.removeItem('api_perspectives');

        // Reset store
        set({
          currentUser: null,
          currentOrganization: null,
          activePerspective: null,
          availableOrganizations: [],
          availablePerspectives: [],
          menu_items: [],
        });
      },

      getOrganizationPerspectives: async (sessionData, data) => {
        const { currentUser } = get();
        // Helper to deduplicate menu items by p_id (fallback to path+title)
        const dedupeMenuItems = (items: any[] = []) => {
          const seen = new Set<string>();
          return (items || []).filter((it) => {
            const key = it?.p_id ?? `${it?.path ?? ''}::${it?.title ?? ''}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        };
        try {
          const orgResponse: any = await getOrganizationPerspectiveIds(data.username || currentUser?.username); // (allOrg as any); //
          if (orgResponse.status && orgResponse.data?.org_details?.length > 0) {
            // For non-admin users, use the first perspective from the API response
            // For admin users, they will use menu_items from sessionData
            const perspectiveDetails = orgResponse.data?.perspective_details || [];
            const firstPerspective = perspectiveDetails.length > 0 ? perspectiveDetails[0] : null;

            set({
              currentUser: sessionData,
              availableOrganizations: orgResponse.data?.org_details || [],
              menu_items: dedupeMenuItems(sessionData?.menu_items || []),
              currentOrganization: null,
              activePerspective: firstPerspective,
              availablePerspectives: perspectiveDetails,
              perspectives: perspectiveDetails,
            });
          } else {
            set({
              menu_items: dedupeMenuItems(sessionData?.menu_items || []),
              currentUser: sessionData,
              availableOrganizations: orgResponse?.data?.org_details || [],
              currentOrganization: null,
              activePerspective: null,
              availablePerspectives: orgResponse.data?.perspective_details || [],
              perspectives: orgResponse.data?.perspective_details || [],
            });
          }
        } catch (orgError) {
          console.error("Failed to fetch organization data:", orgError);
          toast.error(getDisplayErrorMessage(orgError, 'Failed to load organization data'));
        }
      },

      switchOrganization: async (organizationId: string): Promise<any[]> => {
        const { availableOrganizations, currentUser, availablePerspectives, perspectives } = get();

        if (organizationId === "*") {
          const orgResponse: any = await getOrganizationPerspectiveIds(currentUser?.username);
          set({
            ...get(),
            availableOrganizations: orgResponse.data?.org_details || [],
            availablePerspectives: orgResponse.data?.perspective_details || [],
          });
          return Promise.resolve([]);
        }

        // Look for organization in availableOrganizations (from API)
        const organization = availableOrganizations.find(o =>
          o.org_id === organizationId ||
          o.organization_id === organizationId
        );
        // if(!organization && currentUser && currentUser.role === "Admin") {
        //   organization = organizationId;
        //   return Promise.resolve([]);
        // }

        if (organization && currentUser) {
          if (currentUser.role === 'Admin' && get().activePerspective === "*") {
            const orgPerspectives = perspectives || [];
            set({
              currentOrganization: organization,
              activePerspective: orgPerspectives,
              availablePerspectives: [],
            });
            return Promise.resolve(orgPerspectives);
          }
          // Filter perspectives based on organization
          const orgPerspectives = perspectives.filter(p =>
            p.org_id === organizationId
          );

          const myPromise = new Promise<{ name: string }>((resolve) => {
            setTimeout(() => {
              resolve({ name: 'My toast' });
            }, 1000);
          });

          if (orgPerspectives.length === 0) {
            toast.error("No perspectives found for this organization. Please choose another organization.");
            // return Promise.resolve([]);
          }

          set({
            currentOrganization: organization,
            activePerspective: orgPerspectives.length > 0 ? orgPerspectives[0] : null,
            // Update available perspectives for this organization
            availablePerspectives: orgPerspectives.length > 0 ? orgPerspectives : [],
          });

          toast.promise(myPromise, {
            loading: 'Loading...',
            success: "Switched to organization: " + organization.org_name,
            error: "Failed to switch to organization: " + organization.org_name,
          });
          return Promise.resolve(orgPerspectives);
        } else {
          toast.error("Organization not found or user not authenticated");
          return Promise.resolve([]);
        }
      },

      setActivePerspective: (perspectiveId) => {
        const { availablePerspectives } = get();
        const perspective = availablePerspectives.find(p =>
          p.id === perspectiveId ||
          p.perspective_id === perspectiveId
        );
        if (perspective) {
          set({ activePerspective: perspective });
          console.log("Set active perspective:", perspective);
        }
      },

      getProductGroup: async () => {
        const productGroup = await getProductGroupApi();
        if (productGroup && productGroup?.data?.length > 0) {
          set({ product_group: productGroup?.data });
        }
        return productGroup?.data;
      },

      unsetActivePerspective: () => set({ activePerspective: null }),

      createPerspective: async (newPerspectiveData) => {
        try {
          const res = await createPerspectiveApi(newPerspectiveData);

          if (res.status === true) {
            const allPerspectives = await getAllPerspectivesApi();
            set({ ...get(), availablePerspectives: allPerspectives.data, perspectives: allPerspectives.data });
            return res;
          } else {
            throw new Error(res.message || 'Failed to create perspective');
          }
        } catch (error) {
          console.error("Error in createPerspective store:", error);
          throw error;
        }
      },

      updatePerspective: async (updatedPerspective, id) => {
        try {
          const params: any = {
            id: id,
            update_id: id,
            ...updatedPerspective
          }
          const res = await updatePerspectiveApi(params);

          if (res.status === true) {
            const allPerspectives = await getAllPerspectivesApi();
            set({ ...get(), availablePerspectives: allPerspectives.data, perspectives: allPerspectives.data });
            return res;
          } else {
            throw new Error(res.message || 'Failed to update perspective');
          }
        } catch (error) {
          console.error("Error in updatePerspective store:", error);
          throw error;
        }
      },

      deletePerspective: (perspectiveId) => {
        set(state => ({
          perspectives: state.perspectives.filter(p => p.id !== perspectiveId),
          availablePerspectives: state.availablePerspectives.filter(p => p.id !== perspectiveId),
          organizations: state.organizations.map(org => ({
            ...org,
            perspectiveIds: (org.perspectiveIds || []).filter(id => id !== perspectiveId)
          }))
        }));
      },

      hasPermission: (permissionId: string) => {
        const { currentUser, activePerspective, menu_items } = get();
        if (!currentUser?.menu_items && !activePerspective) return false;

        const getAllPermissions = (items: MenuItem[]): Permission[] => {
          return items.reduce((acc, item) => {
            if (item.permissions) {
              acc.push(...item.permissions);
            }
            if (item.children) {
              acc.push(...getAllPermissions(item.children));
            }
            return acc;
          }, [] as Permission[]);
        };

        const allPermissions: Permission[] = getAllPermissions(activePerspective?.menu_items || menu_items);

        return allPermissions.some(permission => permission.action === permissionId);
      },
    }),
    {
      name: 'rbac-store', // unique name for localStorage key
      storage: createJSONStorage(() => localStorage),
      // Specify which fields to persist
      partialize: (state) => ({
        currentUser: state.currentUser,
        currentOrganization: state.currentOrganization,
        activePerspective: state.activePerspective,
        availableOrganizations: state.availableOrganizations,
        availablePerspectives: state.availablePerspectives,
        theme: state.theme,
      }),
      // Version for migration if needed in future
      version: 1,
      // Skip hydration on SSR
      skipHydration: false,
    }
  )
);
