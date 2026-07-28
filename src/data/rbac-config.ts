import { User, Role, Perspective, Organization } from '@/types/rbac';

// Example users
// export const users: User[] = [
//   {
//     id: 'user-1',
//     name: 'Sarah Johnson',
//     email: 'sarah@acme.com',
//     avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face',
//     organizationIds: ['acme-inc', 'stark-industries']
//   },
//   {
//     id: 'user-2',
//     name: 'Mike Chen',
//     email: 'mike@acme.com',
//     avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
//     organizationIds: ['acme-inc']
//   },
//   {
//     id: 'user-3',
//     name: 'Emma Davis',
//     email: 'emma@stark.com',
//     avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
//     organizationIds: ['stark-industries']
//   },
//   {
//     id: 'user-4',
//     name: 'John Doe',
//     email: 'john.doe@sap-partner.com',
//     avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face',
//     organizationIds: ['sap-partner']
//   }
// ];

// Organizations configuration
export const organizations: Organization[] = [
  {
    id: 'acme-inc',
    name: 'Acme Inc.',
    logo: '/acme-logo.png',
    perspectiveIds: ['admin-dashboard', 'hr-management', 'employee-dashboard']
  },
  {
    id: 'stark-industries',
    name: 'Stark Industries',
    logo: '/stark-logo.png',
    perspectiveIds: ['finance-management', 'employee-dashboard']
  },
  {
    id: 'sap-partner',
    name: 'SAP Partner',
    logo: '/sap-logo.png',
    perspectiveIds: ['sap-validation']
  }
];


// Roles configuration (now decoupled from perspectives)
export const roles: Role[] = [
  {
    id: 'admin',
    name: 'Administrator',
    description: 'Full system access with all permissions',
  },
  {
    id: 'finance-manager',
    name: 'Finance Manager',
    description: 'Manages financial operations and reporting',
  },
  {
    id: 'hr-manager',
    name: 'HR Manager',
    description: 'Manages human resources and employee data',
  },
  {
    id: 'employee',
    name: 'Employee',
    description: 'Basic employee access to personal dashboard',
  },
  {
    id: 'sap-validator',
    name: 'SAP Validator',
    description: 'Performs validation tasks within the SAP module',
  }
];

// Perspectives configuration
// export const perspectives: Perspective[] = [
//   {
//     id: 'admin-dashboard',
//     name: 'System Administration',
//     description: 'Complete system oversight and configuration',
//     icon: 'Settings',
//     menuItems: [
//       {
//         id: 'overview',
//         title: 'System Overview',
//         icon: 'BarChart3',
//         path: '/admin/overview',
//         permissions: [
//           { action: 'read', resource: 'system-metrics' },
//           { action: 'read', resource: 'user-activity' }
//         ]
//       },
//       {
//         id: 'user-management',
//         title: 'User Management',
//         icon: 'Users',
//         path: '/admin/users',
//         permissions: [
//           { action: 'create', resource: 'users' },
//           { action: 'read', resource: 'users' },
//           { action: 'update', resource: 'users' },
//           { action: 'delete', resource: 'users' }
//         ],
//         children: [
//           {
//             id: 'all-users',
//             title: 'All Users',
//             icon: 'UserCircle',
//             path: '/admin/users/all',
//             permissions: [{ action: 'read', resource: 'users' }]
//           },
//           {
//             id: 'roles-permissions',
//             title: 'Roles & Permissions',
//             icon: 'Shield',
//             path: '/admin/users/roles',
//             permissions: [{ action: 'update', resource: 'roles' }]
//           }
//         ]
//       },
//       {
//         id: 'system-settings',
//         title: 'System Settings',
//         icon: 'Cog',
//         path: '/admin/settings',
//         permissions: [
//           { action: 'read', resource: 'system-config' },
//           { action: 'update', resource: 'system-config' }
//         ]
//       }
//     ]
//   },
//   {
//     id: 'finance-management',
//     name: 'Financial Management',
//     description: 'Financial planning, reporting, and analysis',
//     icon: 'TrendingUp',
//     menuItems: [
//       {
//         id: 'finance-dashboard',
//         title: 'Finance Dashboard',
//         icon: 'PieChart',
//         path: '/finance/dashboard',
//         permissions: [{ action: 'read', resource: 'financial-data' }]
//       },
//       {
//         id: 'accounts',
//         title: 'Accounts Management',
//         icon: 'CreditCard',
//         path: '/finance/accounts',
//         permissions: [
//           { action: 'create', resource: 'accounts' },
//           { action: 'read', resource: 'accounts' },
//           { action: 'update', resource: 'accounts' }
//         ],
//         children: [
//           {
//             id: 'chart-of-accounts',
//             title: 'Chart of Accounts',
//             icon: 'List',
//             path: '/finance/accounts/chart',
//             permissions: [{ action: 'read', resource: 'accounts' }]
//           },
//           {
//             id: 'transactions',
//             title: 'Transactions',
//             icon: 'ArrowRightLeft',
//             path: '/finance/accounts/transactions',
//             permissions: [{ action: 'create', resource: 'transactions' }]
//           }
//         ]
//       },
//       {
//         id: 'reports',
//         title: 'Financial Reports',
//         icon: 'FileText',
//         path: '/finance/reports',
//         permissions: [{ action: 'read', resource: 'financial-reports' }],
//         badge: 'New'
//       },
//       {
//         id: 'budgets',
//         title: 'Budget Planning',
//         icon: 'Target',
//         path: '/finance/budgets',
//         permissions: [
//           { action: 'create', resource: 'budgets' },
//           { action: 'read', resource: 'budgets' },
//           { action: 'update', resource: 'budgets' }
//         ]
//       }
//     ]
//   },
//   {
//     id: 'hr-management',
//     name: 'Human Resources',
//     description: 'Employee management and HR operations',
//     icon: 'Users',
//     menuItems: [
//       {
//         id: 'hr-dashboard',
//         title: 'HR Dashboard',
//         icon: 'BarChart',
//         path: '/hr/dashboard',
//         permissions: [{ action: 'read', resource: 'hr-metrics' }]
//       },
//       {
//         id: 'employees',
//         title: 'Employee Management',
//         icon: 'UserCheck',
//         path: '/hr/employees',
//         permissions: [
//           { action: 'create', resource: 'employees' },
//           { action: 'read', resource: 'employees' },
//           { action: 'update', resource: 'employees' }
//         ],
//         children: [
//           {
//             id: 'employee-directory',
//             title: 'Employee Directory',
//             icon: 'Users',
//             path: '/hr/employees/directory',
//             permissions: [{ action: 'read', resource: 'employees' }]
//           },
//           {
//             id: 'onboarding',
//             title: 'Onboarding',
//             icon: 'UserPlus',
//             path: '/hr/employees/onboarding',
//             permissions: [{ action: 'create', resource: 'employees' }]
//           },
//           {
//             id: 'performance',
//             title: 'Performance Reviews',
//             icon: 'Star',
//             path: '/hr/employees/performance',
//             permissions: [{ action: 'read', resource: 'performance-reviews' }]
//           }
//         ]
//       },
//       {
//         id: 'payroll',
//         title: 'Payroll Management',
//         icon: 'Banknote',
//         path: '/hr/payroll',
//         permissions: [
//           { action: 'read', resource: 'payroll' },
//           { action: 'execute', resource: 'payroll-processing' }
//         ]
//       },
//       {
//         id: 'leave-management',
//         title: 'Leave Management',
//         icon: 'Calendar',
//         path: '/hr/leave',
//         permissions: [
//           { action: 'read', resource: 'leave-requests' },
//           { action: 'update', resource: 'leave-requests' }
//         ]
//       }
//     ]
//   },
//   {
//     id: 'employee-dashboard',
//     name: 'Employee Portal',
//     description: 'Personal dashboard and self-service tools',
//     icon: 'User',
//     menuItems: [
//       {
//         id: 'my-dashboard',
//         title: 'My Dashboard',
//         icon: 'Home',
//         path: '/employee/dashboard',
//         permissions: [{ action: 'read', resource: 'personal-dashboard' }]
//       },
//       {
//         id: 'my-profile',
//         title: 'My Profile',
//         icon: 'User',
//         path: '/employee/profile',
//         permissions: [
//           { action: 'read', resource: 'personal-profile' },
//           { action: 'update', resource: 'personal-profile' }
//         ]
//       },
//       {
//         id: 'my-leave',
//         title: 'My Leave Requests',
//         icon: 'Calendar',
//         path: '/employee/leave',
//         permissions: [
//           { action: 'create', resource: 'leave-requests' },
//           { action: 'read', resource: 'personal-leave' }
//         ]
//       },
//       {
//         id: 'my-payslips',
//         title: 'My Payslips',
//         icon: 'Receipt',
//         path: '/employee/payslips',
//         permissions: [{ action: 'read', resource: 'personal-payslips' }]
//       },
//       {
//         id: 'company-policies',
//         title: 'Company Policies',
//         icon: 'FileText',
//         path: '/employee/policies',
//         permissions: [{ action: 'read', resource: 'company-policies' }]
//       }
//     ]
//   },
//   {
//     "id": "sap-validation",
//     "name": "SAP Validation",
//     "description": "Full access to all SAP validation tools and features.",
//     "icon": "ShieldCheck",
//     "menuItems": [
//       {
//         "id": "dashboard",
//         "title": "Dashboard",
//         "icon": "LayoutDashboard",
//         "path": "/dashboard",
//         "permissions": [
//           {
//             "action": "view",
//             "resource": "dashboard"
//           }
//         ]
//       },
//       {
//         "id": "templates",
//         "title": "Templates",
//         "icon": "FolderKanban",
//         "path": "/templates",
//         "permissions": [],
//         "children": [
//           {
//             "id": "projects",
//             "title": "Projects",
//             "icon": "Briefcase",
//             "path": "/templates/projects",
//             "permissions": [
//               {
//                 "action": "view",
//                 "resource": "projects"
//               },
//               {
//                 "action": "edit",
//                 "resource": "projects"
//               },
//               {
//                 "action": "delete",
//                 "resource": "projects"
//               }
//             ]
//           },
//           {
//             "id": "templates-sub",
//             "title": "Templates",
//             "icon": "FileCode2",
//             "path": "/templates/templates",
//             "permissions": [
//               {
//                 "action": "use",
//                 "resource": "templates-sub"
//               },
//               {
//                 "action": "view",
//                 "resource": "templates-sub"
//               }
//             ]
//           },
//           {
//             "id": "workflow-validation-rule",
//             "title": "All Workflow/Validation Rule",
//             "icon": "Workflow",
//             "path": "/templates/rules",
//             "permissions": [
//               {
//                 "action": "create",
//                 "resource": "workflow-validation-rule"
//               },
//               {
//                 "action": "delete",
//                 "resource": "workflow-validation-rule"
//               },
//               {
//                 "action": "edit",
//                 "resource": "workflow-validation-rule"
//               },
//               {
//                 "action": "view",
//                 "resource": "workflow-validation-rule"
//               },
//               {
//                 "action": "execute",
//                 "resource": "workflow-validation-rule"
//               }
//             ]
//           }
//         ]
//       },
//       {
//         "id": "connection-vault",
//         "title": "Connection Vault",
//         "icon": "DatabaseZap",
//         "path": "/connections",
//         "permissions": [
//           {
//             "action": "view",
//             "resource": "connection-vault"
//           },
//           {
//             "action": "create",
//             "resource": "connection-vault"
//           },
//           {
//             "action": "edit",
//             "resource": "connection-vault"
//           },
//           {
//             "action": "delete",
//             "resource": "connection-vault"
//           }
//         ]
//       },
//       {
//         "id": "datasets",
//         "title": "Datasets",
//         "icon": "Database",
//         "path": "/datasets",
//         "permissions": [
//           {
//             "action": "view",
//             "resource": "datasets"
//           },
//           {
//             "action": "create",
//             "resource": "datasets"
//           },
//           {
//             "action": "edit",
//             "resource": "datasets"
//           },
//           {
//             "action": "delete",
//             "resource": "datasets"
//           }
//         ]
//       },
//       {
//         "id": "masterdata",
//         "title": "MasterData",
//         "icon": "Album",
//         "path": "/masterdata",
//         "permissions": [
//           {
//             "action": "view",
//             "resource": "masterdata"
//           },
//           {
//             "action": "create",
//             "resource": "masterdata"
//           },
//           {
//             "action": "edit",
//             "resource": "masterdata"
//           },
//           {
//             "action": "delete",
//             "resource": "masterdata"
//           }
//         ]
//       },
//       {
//         "id": "jobs",
//         "title": "Jobs",
//         "icon": "Clock",
//         "path": "/jobs",
//         "permissions": [
//           {
//             "action": "view",
//             "resource": "jobs"
//           }
//         ]
//       },
//       {
//         "id": "validation-component",
//         "title": "Validation Component",
//         "icon": "Component",
//         "path": "/validation-components",
//         "permissions": [
//           {
//             "action": "view",
//             "resource": "validation-component"
//           },
//           {
//             "action": "create",
//             "resource": "validation-component"
//           },
//           {
//             "action": "edit",
//             "resource": "validation-component"
//           },
//           {
//             "action": "delete",
//             "resource": "validation-component"
//           }
//         ]
//       },
//       {
//         "id": "test-design-studio",
//         "title": "Test Design Studio",
//         "icon": "Beaker",
//         "path": "/test-design",
//         "permissions": [],
//         "children": [
//           {
//             "id": "scenario-source",
//             "title": "Scenario Source",
//             "icon": "FileJson",
//             "path": "/test-design/scenarios",
//             "permissions": [
//               {
//                 "action": "generate",
//                 "resource": "scenario-source"
//               },
//               {
//                 "action": "view",
//                 "resource": "scenario-source"
//               },
//               {
//                 "action": "download",
//                 "resource": "scenario-source"
//               },
//               {
//                 "action": "delete",
//                 "resource": "scenario-source"
//               }
//             ]
//           }
//         ]
//       },
//       {
//         "id": "test-automation",
//         "title": "Test Automation",
//         "icon": "Bot",
//         "path": "/test-automation",
//         "permissions": []
//       },
//       {
//         "id": "test-execution",
//         "title": "Test Execution",
//         "icon": "Rocket",
//         "path": "/test-execution",
//         "permissions": []
//       }
//     ]
//   }
// ];
