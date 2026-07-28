// import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
// import { v4 as uuidv4 } from 'uuid';
// import { RBACContextType, Perspective, Organization, MenuItem } from '@/types/rbac';
// import { users as initialUsers, perspectives as initialPerspectives, organizations as initialOrganizations } from '@/data/rbac-config';
// import axios from 'axios';
// import { useAuth } from './authContext';
// import { getOrganizationPerspectiveIds } from '@/controllers/API/apiService';
// import { useNavigate } from 'react-router';
// import { User } from '@/types';
// import { useApiCrud } from '@/hooks/useOrganizationSetup';
// import { createPerspectiveApi, getAllPerspectivesApi } from '@/controllers/API/orchestrationApi';

// const RBACContext = createContext<RBACContextType | undefined>(undefined);

// interface RBACProviderProps {
//   children: ReactNode;
// }

// export const RBACProvider: React.FC<RBACProviderProps> = ({ children }) => {
//   const [users] = useState<User[]>([]);
//   const [organizations, setOrganizations] = useState<Organization[]>(initialOrganizations);
//   const [perspectives, setPerspectives] = useState<Perspective[]>(initialPerspectives);

//   const [currentUser, setCurrentUser] = useState<User | null>(null);
//   const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
//   const [activePerspective, _setActivePerspective] = useState<Perspective | null>(null);

//   const [availableOrganizations, setAvailableOrganizations] = useState<Organization[]>([]);
//   const [availablePerspectives, setAvailablePerspectives] = useState<Perspective[]>([]);
//   const [userOrgandPerspectives, setUserOrgandPerspectives] = useState({
//     organizations: [],
//     perspectives: [],
//   });
//   const { dispatch } = useAuth();
//   const navigate = useNavigate();
//   const [apiResponse, setApiResponse] = useState({
//     loading: false,
//     error: { status: "", message: "" },
//   });
//   const { createApi, loadAll } = useApiCrud<Perspective>({
//     getAll: getAllPerspectivesApi,
//     createApi: createPerspectiveApi
//   });

//   // Login a user
//   const login = async (data: any): Promise<void> => {

//     try {
//       const loginResponse = await axios.post("/api/users/login", {
//         username: data.username,
//         password: data.password,
//       });

//       if (loginResponse.status === 200) {
//         try {
//           const { data: sessionData }: any = await axios.get("/api/session/me");

//           if (sessionData.is_authenticated) {
//             const userData = {
//               id: sessionData.employee_id || null,
//               email: sessionData.email,
//               first_name: sessionData.first_name,
//               last_name: sessionData.last_name,
//               is_authenticated: true,
//               permissions: data.permissions,
//               system_role: sessionData.system_role || null,
//               allowed_roles: sessionData.allowed_roles || [],
//               urdhva_role: sessionData.urdhva_role || null,
//               region: sessionData.region || [],
//               zone: sessionData.zone || [],
//               state: sessionData.state || [],
//               sales_area: sessionData.sales_area || [],
//               location_id: sessionData.location_id || [],
//               username: data.username, // Use the username from login form
//               name: sessionData.first_name + " " + sessionData.last_name,
//               role: 'Admin',
//             };

//             dispatch({
//               type: "login",
//               payload: {
//                 user: userData,
//                 token: ""
//               },
//             });

//             setCurrentUser(userData);

//             // Call organization API after successful login
//             try {
//               console.log("Calling organization API with username:", data.username);
//               const orgResponse = await getOrganizationPerspectiveIds(data.username);
//               setUserOrgandPerspectives({
//                 organizations: orgResponse.data.org_details,
//                 perspectives: orgResponse.data.perspective_details,
//               });
//               console.log("Organization API response:", orgResponse);

//               // Store the organization data in localStorage for OrganizationSelection to pick up
//               if (orgResponse.status && orgResponse.data.org_details.length > 0) {
//                 localStorage.setItem('api_organizations', JSON.stringify(orgResponse.data.org_details));
//                 localStorage.setItem('api_perspectives', JSON.stringify(orgResponse.data.perspective_details));
//               }
//             } catch (orgError) {
//               console.error("Failed to fetch organization data:", orgError);
//               // Don't block the login process if organization API fails
//             }

//             // navigate("/dashboard/flow");
//             // navigate("/dashboard");
//             navigate("/organization");
//           } else {
//             setApiResponse({
//               ...apiResponse,
//               error: { status: "401", message: "Not authenticated" },
//             });
//           }
//         } catch {
//           setApiResponse({
//             ...apiResponse,
//             error: { status: "500", message: "Session expired" },
//           });
//         }
//       } else {
//         setApiResponse({
//           ...apiResponse,
//           error: {
//             status: loginResponse.status.toString(),
//             message: "Authentication failed",
//           },
//         });
//       }
//     } catch (error) {
//       const errorMsg = axios.isAxiosError(error)
//         ? error.response?.data?.message || "Login failed"
//         : "An error occurred";
//       setApiResponse({
//         ...apiResponse,
//         error: { status: "500", message: errorMsg },
//       });
//     } finally {
//       setApiResponse((prev) => ({ ...prev, loading: false }));
//     }

//     if (currentUser) {
//       // const userOrgs = organizations.filter(org => user.organizationIds.includes(org.id));
//       console.log("userOrgandPerspectives", userOrgandPerspectives);
//       setAvailableOrganizations(userOrgandPerspectives.organizations);

//       // Reset org and perspective
//       setCurrentOrganization(null);
//       _setActivePerspective(null);
//       setAvailablePerspectives([]);

//       // If user has only one org, select it automatically
//       if (userOrgandPerspectives.organizations.length === 1) {
//         switchOrganization(userOrgandPerspectives.organizations[0].id);
//       }
//     }
//   };

//   // Logout
//   const logout = (): void => {
//     setCurrentUser(null);
//     setCurrentOrganization(null);
//     _setActivePerspective(null);
//     setAvailableOrganizations([]);
//     setAvailablePerspectives([]);
//   };

//   // Switch organization
//   const switchOrganization = (organizationId: string): void => {
//     const organization = organizations.find(o => o.id === organizationId);
//     if (organization && currentUser?.organizationIds.includes(organizationId)) {
//       setCurrentOrganization(organization);
//       _setActivePerspective(null); // Always reset active perspective on org switch
//     }
//   };

//   // Update available perspectives when org or global perspectives change
//   useEffect(() => {
//     if (currentOrganization) {
//       const orgPerspectives = perspectives.filter(p => currentOrganization.perspectiveIds.includes(p.id));
//       setAvailablePerspectives(orgPerspectives);
//     } else {
//       setAvailablePerspectives([]);
//     }
//   }, [currentOrganization, perspectives]);


//   // Set a perspective as active for the main UI
//   const setActivePerspective = (perspectiveId: string): void => {
//     const perspective = availablePerspectives.find(p => p.id === perspectiveId);
//     if (perspective) {
//       _setActivePerspective(perspective);
//     }
//   };

//   // Unset the active perspective to return to the management view
//   const unsetActivePerspective = (): void => {
//     _setActivePerspective(null);
//   };

//   // --- Perspective CRUD ---
//   const createPerspective = async (newPerspectiveData: any): Promise<void> => {
//     if (!currentOrganization) return;

//     const res = await createApi(newPerspectiveData);

//     console.log("response for updated perspective", res);  
//     loadAll();
//     // const newPerspective: Perspective = {
//     //   ...newPerspectiveData,
//     //   id: uuidv4(),
//     // };
//     // Add to global list of perspectives
//     setPerspectives(prev => [...prev, res]);

//     // Add to current organization's perspective list
//     // setOrganizations(prevOrgs => prevOrgs.map(org =>
//     //   org.id === currentOrganization.id
//     //     ? { ...org, perspectiveIds: [...org.perspectiveIds, newPerspective.id] }
//     //     : org
//     // ));
//   };

//   const updatePerspective = (updatedPerspective: Perspective): void => {
//     setPerspectives(prev => prev.map(p => p.id === updatedPerspective.id ? updatedPerspective : p));
//   };

//   const deletePerspective = (perspectiveId: string): void => {
//     // Remove from global list
//     setPerspectives(prev => prev.filter(p => p.id !== perspectiveId));

//     // Remove from any organization that has it
//     setOrganizations(prevOrgs => prevOrgs.map(org => ({
//       ...org,
//       perspectiveIds: org.perspectiveIds.filter(id => id !== perspectiveId)
//     })));
//   };

//   // Check permissions
//   const hasPermission = (action: string, resource: string): boolean => {
//     if (!currentUser || !activePerspective) return false;

//     const getAllPermissions = (items: MenuItem[]): { action: string; resource: string }[] => {
//       return items.reduce((acc, item) => {
//         if (item.permissions) {
//           acc.push(...item.permissions.map(p => ({ action: p.action, resource: item.id })));
//         }
//         if (item.children) {
//           acc.push(...getAllPermissions(item.children));
//         }
//         return acc;
//       }, [] as { action: string; resource: string }[]);
//     };

//     const allPermissions = getAllPermissions(activePerspective.menuItems);

//     return allPermissions.some(
//       permission => permission.action === action && permission.resource === resource
//     );
//   };

//   const value: RBACContextType = {
//     currentUser,
//     currentOrganization,
//     activePerspective,
//     availableOrganizations,
//     availablePerspectives,
//     login,
//     logout,
//     switchOrganization,
//     setActivePerspective,
//     unsetActivePerspective,
//     createPerspective,
//     updatePerspective,
//     deletePerspective,
//     hasPermission,
//   };

//   return (
//     <RBACContext.Provider value={value}>
//       {children}
//     </RBACContext.Provider>
//   );
// };

// export const useRBAC = (): RBACContextType => {
//   const context = useContext(RBACContext);
//   if (context === undefined) {
//     throw new Error('useRBAC must be used within a RBACProvider');
//   }
//   return context;
// };
