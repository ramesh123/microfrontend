export interface PermissionOption {
    action: string;
    label?: string;
    description?: string;
    resource?: string;
  }
  
  export interface MenuItemConfig {
    p_id?: string;
    title: string;
    icon: string;
    path: string;
    permissions: PermissionOption[];
    children?: MenuItemConfig[];
  }
  
  export const sapMenuStructure: MenuItemConfig[] = [
    {
      p_id: 'dashboard',
      title: 'Dashboard',
      icon: 'LayoutDashboard',
      path: '/dashboard',
      permissions: [{ action: 'view', label: 'View' }],
    },
    {
      p_id: 'templates',
      title: 'Templates',
      icon: 'FolderKanban',
      path: '/templates',
      permissions: [],
      children: [
        {
          p_id: 'projects',
          title: 'Projects',
          icon: 'Briefcase',
          path: '/templates/projects',
          permissions: [
            { action: 'view', label: 'View' },
            { action: 'edit', label: 'Edit' },
            { action: 'delete', label: 'Delete' },
          ],
        },
        {
          p_id: 'templates-sub',
          title: 'Templates',
          icon: 'FileCode2',
          path: '/templates/templates',
          permissions: [
            { action: 'use', label: 'Use Template' },
            { action: 'view', label: 'View Template' },
          ],
        },
        {
          p_id: 'workflow-validation-rule',
          title: 'All Workflow/Validation Rule',
          icon: 'Workflow',
          path: '/templates/rules',
          permissions: [
            { action: 'create', label: 'Create' },
            { action: 'delete', label: 'Delete' },
            { action: 'edit', label: 'Edit' },
            { action: 'view', label: 'View' },
            { action: 'execute', label: 'Run/Execute' },
          ],
        },
      ],
    },
    {
      p_id: 'connection-vault',
      title: 'Connection Vault',
      icon: 'DatabaseZap',
      path: '/connections',
      permissions: [
        { action: 'view', label: 'View' },
        { action: 'create', label: 'Create' },
        { action: 'edit', label: 'Edit' },
        { action: 'delete', label: 'Delete' },
      ],
    },
    {
      p_id: 'datasets',
      title: 'Datasets',
      icon: 'Database',
      path: '/datasets',
      permissions: [
        { action: 'view', label: 'View' },
        { action: 'create', label: 'Create' },
        { action: 'edit', label: 'Edit' },
        { action: 'delete', label: 'Delete' },
      ],
    },
    {
      p_id: 'masterdata',
      title: 'MasterData',  
      icon: 'Album',
      path: '/masterdata',
      permissions: [
        { action: 'view', label: 'View' },
        { action: 'create', label: 'Create' },
        { action: 'edit', label: 'Edit' },
        { action: 'delete', label: 'Delete' },
      ],
    },
    {
      p_id: 'jobs',
      title: 'Jobs',
      icon: 'Clock',
      path: '/jobs',
      permissions: [{ action: 'view', label: 'View' }],
    },
    {
      p_id: 'validation-component',
      title: 'Validation Component',
      icon: 'Component',
      path: '/validation-components',
      permissions: [
        { action: 'view', label: 'View' },
        { action: 'create', label: 'Create' },
        { action: 'edit', label: 'Edit' },
        { action: 'delete', label: 'Delete' },
      ],
    },
    {
      p_id: 'test-design-studio',
      title: 'Test Design Studio',
      icon: 'Beaker',
      path: '/test-design',
      permissions: [],
      children: [
        {
          p_id: 'scenario-source',
          title: 'Scenario Source',
          icon: 'FileJson',
          path: '/test-design/scenarios',
          permissions: [
            { action: 'generate', label: 'Generate' },
            { action: 'view', label: 'View' },
            { action: 'download', label: 'Download' },
            { action: 'delete', label: 'Delete' },
          ],
        },
      ],
    },
    {
      p_id: 'test-automation',
      title: 'Test Automation',
      icon: 'Bot',
      path: '/test-automation',
      permissions: [],
      children: [
        {
          p_id: 'execute-components',
          title: 'Execute components',
          icon: 'PlayCircle',
          path: '/test-automation/execute',
          permissions: [],
        },
        {
          p_id: 'validation-components-auto',
          title: 'Validation components',
          icon: 'ShieldCheck',
          path: '/test-automation/validation',
          permissions: [],
        },
        {
          p_id: 'comparators',
          title: 'Comparators',
          icon: 'GitCompareArrows',
          path: '/test-automation/comparators',
          permissions: [],
        },
        {
          p_id: 'test-cases',
          title: 'Test Cases',
          icon: 'ClipboardList',
          path: '/test-automation/test-cases',
          permissions: [],
        },
        {
          p_id: 'data-conversion-components',
          title: 'Data Conversion components',
          icon: 'FileCog',
          path: '/test-automation/data-conversion',
          permissions: [],
        },
      ],
    },
    {
      p_id: 'test-execution',
      title: 'Test Execution',
      icon: 'Rocket',
      path: '/test-execution',
      permissions: [],
      children: [
        {
          p_id: 'create-test-set',
          title: 'Create Test-Set',
          icon: 'PlusSquare',
          path: '/test-execution/test-set',
          permissions: [],
        },
        {
          p_id: 'execute-and-validate',
          title: 'Execute and validate',
          icon: 'Play',
          path: '/test-execution/execute',
          permissions: [],
        },
      ],
    },
  ];
