import { ComponentNode } from '@/types/orchestration';

export const componentTree: ComponentNode[] = [
  {
    id: 'sap-dashboard',
    label: 'Dashboard',
    permissionId: 'sap-dashboard-view',
    children: [
      { id: 'sap-dashboard-view', label: 'View', permissionId: 'sap-dashboard-view' }
    ]
  },
  {
    id: 'sap-templates',
    label: 'Templates',
    permissionId: 'sap-templates-projects-view', // Representative permission
    children: [
      {
        id: 'sap-templates-projects',
        label: 'Projects',
        permissionId: 'sap-templates-projects-view',
        children: [
          { id: 'sap-templates-projects-view-action', label: 'View', permissionId: 'sap-templates-projects-view' },
          { id: 'sap-templates-projects-edit-action', label: 'Edit', permissionId: 'sap-templates-projects-edit' },
          { id: 'sap-templates-projects-delete-action', label: 'Delete', permissionId: 'sap-templates-projects-delete' }
        ]
      },
      {
        id: 'sap-templates-templates',
        label: 'Templates',
        permissionId: 'sap-templates-templates-view',
        children: [
          { id: 'sap-templates-templates-use-action', label: 'Use Template', permissionId: 'sap-templates-templates-use' },
          { id: 'sap-templates-templates-view-action', label: 'View Template', permissionId: 'sap-templates-templates-view' }
        ]
      },
      {
        id: 'sap-templates-workflows',
        label: 'All Workflow/Validation Rule',
        permissionId: 'sap-templates-workflows-view',
        children: [
          { id: 'sap-templates-workflows-create-action', label: 'Create', permissionId: 'sap-templates-workflows-create' },
          { id: 'sap-templates-workflows-delete-action', label: 'Delete', permissionId: 'sap-templates-workflows-delete' },
          { id: 'sap-templates-workflows-edit-action', label: 'Edit', permissionId: 'sap-templates-workflows-edit' },
          { id: 'sap-templates-workflows-view-action', label: 'View', permissionId: 'sap-templates-workflows-view' },
          { id: 'sap-templates-workflows-execute-action', label: 'Run/Execute', permissionId: 'sap-templates-workflows-execute' }
        ]
      }
    ]
  },
  {
    id: 'sap-connection-vault',
    label: 'Connection Vault',
    permissionId: 'sap-connections-view',
    children: [
      {
        id: 'sap-connections',
        label: 'Connections',
        permissionId: 'sap-connections-view',
        children: [
          { id: 'sap-connections-view-action', label: 'View', permissionId: 'sap-connections-view' },
          { id: 'sap-connections-create-action', label: 'Create', permissionId: 'sap-connections-create' },
          { id: 'sap-connections-edit-action', label: 'Edit', permissionId: 'sap-connections-edit' },
          { id: 'sap-connections-delete-action', label: 'Delete', permissionId: 'sap-connections-delete' }
        ]
      }
    ]
  },
  {
    id: 'sap-datasets',
    label: 'Datasets',
    permissionId: 'sap-datasets-view',
    children: [
      { id: 'sap-datasets-view-action', label: 'View', permissionId: 'sap-datasets-view' },
      { id: 'sap-datasets-create-action', label: 'Create', permissionId: 'sap-datasets-create' },
      { id: 'sap-datasets-edit-action', label: 'Edit', permissionId: 'sap-datasets-edit' },
      { id: 'sap-datasets-delete-action', label: 'Delete', permissionId: 'sap-datasets-delete' }
    ]
  },
  {
    id: 'sap-masterdata',
    label: 'MasterData',
    permissionId: 'sap-masterdata-view',
    children: [
      { id: 'sap-masterdata-view-action', label: 'View', permissionId: 'sap-masterdata-view' },
      { id: 'sap-masterdata-create-action', label: 'Create', permissionId: 'sap-masterdata-create' },
      { id: 'sap-masterdata-edit-action', label: 'Edit', permissionId: 'sap-masterdata-edit' },
      { id: 'sap-masterdata-delete-action', label: 'Delete', permissionId: 'sap-masterdata-delete' }
    ]
  },
  {
    id: 'sap-jobs',
    label: 'Jobs',
    permissionId: 'sap-jobs-view',
    children: [
      { id: 'sap-jobs-view-action', label: 'View', permissionId: 'sap-jobs-view' }
    ]
  },
  {
    id: 'sap-validationcomp',
    label: 'Validation Component',
    permissionId: 'sap-validationcomp-view',
    children: [
      { id: 'sap-validationcomp-view-action', label: 'View', permissionId: 'sap-validationcomp-view' },
      { id: 'sap-validationcomp-create-action', label: 'Create', permissionId: 'sap-validationcomp-create' },
      { id: 'sap-validationcomp-edit-action', label: 'Edit', permissionId: 'sap-validationcomp-edit' },
      { id: 'sap-validationcomp-delete-action', label: 'Delete', permissionId: 'sap-validationcomp-delete' }
    ]
  },
  {
    id: 'sap-testdesign',
    label: 'Test Design Studio',
    permissionId: 'sap-testdesign-scenariosource-view',
    children: [
      {
        id: 'sap-testdesign-scenariosource',
        label: 'Scenario Source',
        permissionId: 'sap-testdesign-scenariosource-view',
        children: [
          { id: 'sap-testdesign-scenariosource-generate-action', label: 'Generate', permissionId: 'sap-testdesign-scenariosource-generate' },
          { id: 'sap-testdesign-scenariosource-view-action', label: 'View', permissionId: 'sap-testdesign-scenariosource-view' },
          { id: 'sap-testdesign-scenariosource-download-action', label: 'Download', permissionId: 'sap-testdesign-scenariosource-download' },
          { id: 'sap-testdesign-scenariosource-delete-action', label: 'Delete', permissionId: 'sap-testdesign-scenariosource-delete' }
        ]
      }
    ]
  },
  {
    id: 'sap-testautomation',
    label: 'Test Automation',
    permissionId: 'sap-testautomation-execute',
    children: [
      { id: 'sap-testautomation-execute-action', label: 'Execute components', permissionId: 'sap-testautomation-execute' },
      { id: 'sap-testautomation-validation-action', label: 'Validation components', permissionId: 'sap-testautomation-validation' },
      { id: 'sap-testautomation-comparators-action', label: 'Comparators', permissionId: 'sap-testautomation-comparators' },
      { id: 'sap-testautomation-testcases-action', label: 'Test Cases', permissionId: 'sap-testautomation-testcases' },
      { id: 'sap-testautomation-dataconversion-action', label: 'Data Conversion components', permissionId: 'sap-testautomation-dataconversion' }
    ]
  },
  {
    id: 'sap-testexecution',
    label: 'Test Execution',
    permissionId: 'sap-testexecution-execute',
    children: [
      { id: 'sap-testexecution-createtestset-action', label: 'Create Test-Set', permissionId: 'sap-testexecution-createtestset' },
      { id: 'sap-testexecution-execute-action', label: 'Execute and validate', permissionId: 'sap-testexecution-execute' }
    ]
  }
];
