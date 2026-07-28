import {faker} from "@faker-js/faker";
import { Project, Template, Workflow, JobLog, User } from '../types';

const statusOptions: Workflow['status'][] = ['active', 'inactive', 'pending', 'error'];
const categories = ['ETL', 'Analytics', 'ML Pipeline', 'Data Quality', 'Streaming', 'Batch Processing'];
const logLevels: JobLog['level'][] = ['info', 'warn', 'error', 'success'];
const projectStatuses: Project['status'][] = ['enabled', 'disabled'];

// Generate Users
export const mockUsers: User[] = Array.from({ length: 8 }, () => ({
  id: faker.string.uuid(),
  name: faker.person.fullName(),
  avatar: faker.image.avatarGitHub(),
  email: faker.internet.email(),
  role: faker.helpers.arrayElement(['admin', 'user']),
}));

export const projectTypes = [
  { id: 'pyspark', name: 'Spark/Python (PySpark)' },
  { id: 'sql', name: 'SQL Transformation' },
  { id: 'api', name: 'API Ingestion' },
];

const customTemplate: Template = {
    id: 'custom',
    name: 'Custom',
    description: 'Build a custom pipeline from scratch.',
    category: 'Custom',
    workflows: [],
    createdAt: new Date(),
    author: 'System',
    isPublic: true,
    tags: ['custom'],
    projectId: '',
    supports: 'Supports Multiple Languages'
};

// Generate Projects
export const mockProjects: Project[] = Array.from({ length: 5 }, () => {
  return {
    id: faker.string.uuid(),
    name: `${faker.company.buzzNoun()} Project`,
    description: faker.lorem.sentence(),
    ownerId: faker.helpers.arrayElement(mockUsers).id,
    templateId: faker.helpers.arrayElement([customTemplate.id, faker.string.uuid()]),
    projectType: faker.helpers.arrayElement(projectTypes).id,
    status: faker.helpers.arrayElement(projectStatuses),
    createdAt: faker.date.past({ years: 1 }),
  }
});

// Generate Workflows for a given project
const generateWorkflow = (projectId: string, templateName: string, tags: string[]): Workflow => ({
  id: faker.string.uuid(),
  name: faker.hacker.phrase().replace(/^./, (letter) => letter.toUpperCase()),
  description: faker.lorem.sentence(),
  status: faker.helpers.arrayElement(statusOptions),
  lastRun: faker.date.recent({ days: 30 }),
  createdAt: faker.date.past({ years: 1 }),
  steps: faker.number.int({ min: 3, max: 12 }),
  projectId,
  templateName,
  tags,
});

// Generate Templates for a given project
const generateTemplate = (projectId: string): Template => {
  const name = faker.company.buzzNoun();
  const tags = faker.helpers.arrayElements(['python', 'sql', 'spark', 'kafka', 'airflow', 'docker'], { min: 1, max: 3 });
  const workflows = Array.from({ length: faker.number.int({ min: 1, max: 5 }) }, () => generateWorkflow(projectId, name, tags));
  
  return {
    id: faker.string.uuid(),
    name,
    description: faker.lorem.paragraph(2),
    category: faker.helpers.arrayElement(categories),
    workflows,
    createdAt: faker.date.past({ years: 2 }),
    author: faker.person.fullName(),
    isPublic: faker.datatype.boolean(),
    tags,
    projectId,
  };
};

// Generate all templates and workflows based on projects
export const mockTemplates: Template[] = [
  customTemplate,
  ...mockProjects.flatMap(project => 
    Array.from({ length: faker.number.int({ min: 2, max: 4 }) }, () => generateTemplate(project.id))
  )
];

export const allMockWorkflows: Workflow[] = mockTemplates.flatMap(template => template.workflows);

// Generate Job Logs
export const mockJobLogs: JobLog[] = Array.from({ length: 20 }, () => {
  const randomWorkflow = faker.helpers.arrayElement(allMockWorkflows);
  const randomProject = mockProjects.find(p => p.id === randomWorkflow.projectId)!;
  return {
    id: faker.string.uuid(),
    message: faker.hacker.phrase(),
    timestamp: faker.date.recent({ days: 7 }),
    level: faker.helpers.arrayElement(logLevels),
    workflowName: randomWorkflow.name,
    projectName: randomProject.name,
  };
}).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());


// Data for Charts
export const jobExecutionsData = [
  { day: 'Mon', jobs: faker.number.int({ min: 5, max: 20 }) },
  { day: 'Tue', jobs: faker.number.int({ min: 8, max: 25 }) },
  { day: 'Wed', jobs: faker.number.int({ min: 10, max: 30 }) },
  { day: 'Thu', jobs: faker.number.int({ min: 12, max: 35 }) },
  { day: 'Fri', jobs: faker.number.int({ min: 15, max: 40 }) },
  { day: 'Sat', jobs: faker.number.int({ min: 3, max: 15 }) },
  { day: 'Sun', jobs: faker.number.int({ min: 2, max: 10 }) },
];
