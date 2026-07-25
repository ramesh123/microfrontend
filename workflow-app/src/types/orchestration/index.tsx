export interface ComponentNode {
    id: string;
    label: string;
    permissionId: Permission; // Every node must have a permission ID
    children?: ComponentNode[];
  }
  
  export type OrchestrationItemType = 'organization' | 'businessUnit' | 'application' | 'businessProcess' | 'transaction' | 'table' | 'project';
  
  export type Permission = 
    // Core Permissions
    | 'create-organization'
    | 'edit-organization'
    | 'manage-roles'
    | 'manage-perspectives'
    | 'manage-users'
    | 'manage-application-settings'
    
    // SAP Validation Permissions
    | 'sap-dashboard-view'
    | 'sap-templates-projects-view'
    | 'sap-templates-projects-edit'
    | 'sap-templates-projects-delete'
    | 'sap-templates-templates-use'
    | 'sap-templates-templates-view'
    | 'sap-templates-workflows-create'
    | 'sap-templates-workflows-delete'
    | 'sap-templates-workflows-edit'
    | 'sap-templates-workflows-view'
    | 'sap-templates-workflows-execute'
    | 'sap-connections-view'
    | 'sap-connections-create'
    | 'sap-connections-edit'
    | 'sap-connections-delete'
    | 'sap-datasets-view'
    | 'sap-datasets-create'
    | 'sap-datasets-edit'
    | 'sap-datasets-delete'
    | 'sap-masterdata-view'
    | 'sap-masterdata-create'
    | 'sap-masterdata-edit'
    | 'sap-masterdata-delete'
    | 'sap-jobs-view'
    | 'sap-validationcomp-view'
    | 'sap-validationcomp-create'
    | 'sap-validationcomp-edit'
    | 'sap-validationcomp-delete'
    | 'sap-testdesign-scenariosource-generate'
    | 'sap-testdesign-scenariosource-view'
    | 'sap-testdesign-scenariosource-download'
    | 'sap-testdesign-scenariosource-delete'
    | 'sap-testautomation-execute'
    | 'sap-testautomation-validation'
    | 'sap-testautomation-comparators'
    | 'sap-testautomation-testcases'
    | 'sap-testautomation-dataconversion'
    | 'sap-testexecution-createtestset'
    | 'sap-testexecution-execute'
  
    // Legacy/Generic Permissions (can be phased out)
    | 'create-workflow'
    | 'edit-workflow'
    | 'view-analytics'
    | 'perspective-sap-validation-test-automation'
    | 'perspective-sap-validation-mode-setup-configure'
    | 'perspective-sap-validation-mode-setup-view'
    | 'perspective-sap-validation-execution'
    
    // Allow for dynamic permissions
    | `component-${string}`;
  
  export type Permissions = Record<Permission, boolean>;
  
  export interface Perspective {
    id?: string;
    org_id?: string[];
    perspective_ids?: string;
    name: string;
    description: string;
    permissions: Permissions;
  }
  
  export interface Role {
    id:string;
    name: string;
    description: string;
    perspectiveIds: string[];
  }
  
  export interface User {
    id: string;
    email: string;
    name: string;
    avatar?: string;
    role: string; 
  }
  
  // Generic Hierarchy Item for flexible connections
  export interface HierarchyItem {
    id: string;
    unique_id?: string;
    name: string;
    type: OrchestrationItemType;
    position: { x: number; y: number };
    children: HierarchyItem[];
  }
  
  export interface Project extends HierarchyItem {}
  export interface Table extends HierarchyItem {}
  export interface Transaction extends HierarchyItem {}
  export interface BusinessProcess extends HierarchyItem {}
  export interface Application extends HierarchyItem {}
  export interface BusinessUnit extends HierarchyItem {}
  
  export interface Organization {
    id: string;
    org_id: string;
    org_name?: string;
    name: string;
    description?: string;
    logo?: string;
    created_at: string;
    memberCount: number;
    plan: 'free' | 'pro' | 'enterprise';
    users: User[];
    roles: Role[];
    perspectives: Perspective[];
    uiStructure: ComponentNode[];
    
    // The root of the new generic hierarchy
    hierarchy: HierarchyItem; 
    
    unconnectedNodes?: HierarchyItem[]; // For nodes on canvas not yet connected
  
    // Legacy fields for form data
    industryType?: string;
    companyId?: string;
    country?: string;
    state?: string;
    city?: string;
    contact?: string;
    email?: string;
    zipcode?:string;
    address1?: string;
    address2?: string;
  }
  
  export interface OrganizationFormData {
    org_name: string;
    industryType: string;
    companyId?: string;
    country: string;
    state: string;
    city: string;
    contact?: string;
    email: string;
    zipcode?: string;
    address1?: string;
    address2?: string;
  }
  
  export interface BusinessUnitFormData {
    unit_name: string;
    businessType: string;
    unitId?: string;
    country: string;
    state: string;
    city: string;
    contact?: string;
    email: string;
    zipcode?: string;
    address1?: string;
    address2?: string;
  }
  
  export interface BusinessProcessFormData {
    business_process_name: string;
    business_process_description?: string;
  }
  
  export interface ProjectFormData {
    name: string;
    project_id?: string;
    description?: string;
    project_team?: string;
    project_type?: string;
    project_status?: boolean;
    created_by?: string;
    perspective_ids?: string;
  }
