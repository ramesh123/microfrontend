import { mockTemplates } from './mockData';
import { Workflow } from '../types';

export const allMockWorkflows: Workflow[] = mockTemplates.flatMap(template => 
  template.workflows.map(workflow => ({
    ...workflow,
    templateName: template.name,
    templateId: template.id,
    tags: template.tags,
  }))
);
