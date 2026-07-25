export interface User {
    id: string;
    username: string;
    name: string;
    email: string;
    avatar?: string;
    organizationIds: string[];
  }
  
  export interface Organization {
    id: string;
    name: string;
    logo?: string;
    perspectiveIds: string[];
  }
  
  export interface Role {
    id: string;
    name: string;
    description?: string;
    permissions?: {
      [perspectiveId: string]: string[];
    };
  }
  
  export interface Perspective {
    id: string;
    name: string;
    description: string;
    icon: string;
    menu_items: MenuItem[];
  }
  
  export interface MenuItem {
    p_id:string;
    title: string;
    label?: string;
    icon: string;
    path: string;
    permissions: Permission[];
    children?: MenuItem[];
    badge?: string;
    description?: string;
    navOnly?: boolean;
    hidden?: boolean;
  }
  
  export interface Permission {
    action: string;
    resource: string;
  }
  
  export interface RBACContextType {
    currentUser: User | null;
    currentOrganization: Organization | null;
    activePerspective: Perspective | null;
    availableOrganizations: Organization[];
    availablePerspectives: Perspective[];
    
    login: (data: any) => void;
    logout: () => void;
    
    switchOrganization: (organizationId: string) => void;
    
    setActivePerspective: (perspectiveId: string) => void;
    unsetActivePerspective: () => void;
    
    createPerspective: (perspective: Omit<Perspective, 'id'>) => void;
    updatePerspective: (perspective: Perspective) => void;
    deletePerspective: (perspectiveId: string) => void;
    
    hasPermission: (action: string, resource: string) => boolean;
  }
  