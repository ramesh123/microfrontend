import { faker } from '@faker-js/faker';
import { Template, Workflow } from '../types';

export type Operator = '=' | '!=' | '>' | '<' | '>=' | '<=';

export interface Field {
  id: string;
  name: string;
  isKey?: boolean;
  isValue?: boolean;
}

export interface Table {
  name: string;
  Fields: Field[];
}

const rawTableData = [
  {
    "TableName": "VBPA",
    "Fields": [
      { "FieldName": "VBELN", "KeyField": "Yes", "VerificationField": "Yes", "FieldId": "FLDID-0003982" },
      { "FieldName": "POSNR", "KeyField": "Yes", "VerificationField": "Yes", "FieldId": "FLDID-0003983" },
      { "FieldName": "PARVW", "KeyField": "Yes", "VerificationField": "Yes", "FieldId": "FLDID-0003984" },
      { "FieldName": "KUNNR", "KeyField": "No", "VerificationField": "Yes", "FieldId": "FLDID-0003985" },
      { "FieldName": "LIFNR", "KeyField": "No", "VerificationField": "Yes", "FieldId": "FLDID-0003986" },
      { "FieldName": "PERNR", "KeyField": "No", "VerificationField": "Yes", "FieldId": "FLDID-0003987" },
      { "FieldName": "PARNR", "KeyField": "No", "VerificationField": "Yes", "FieldId": "FLDID-0003988" },
      { "FieldName": "ADRNR", "KeyField": "No", "VerificationField": "No", "FieldId": "FLDID-0003989" }
    ]
  },
  {
    "TableName": "VBKD",
    "Fields": [
      { "FieldName": "VBELN", "KeyField": "Yes", "VerificationField": "Yes", "FieldId": "FLDID-0003971" },
      { "FieldName": "POSNR", "KeyField": "Yes", "VerificationField": "Yes", "FieldId": "FLDID-0003972" },
      { "FieldName": "ZTERM", "KeyField": "No", "VerificationField": "Yes", "FieldId": "FLDID-0003973" },
      { "FieldName": "INCO1", "KeyField": "No", "VerificationField": "Yes", "FieldId": "FLDID-0003974" },
      { "FieldName": "INCO2", "KeyField": "No", "VerificationField": "Yes", "FieldId": "FLDID-0003975" },
      { "FieldName": "WAERK", "KeyField": "No", "VerificationField": "Yes", "FieldId": "FLDID-0003976" },
      { "FieldName": "PRSDT", "KeyField": "No", "VerificationField": "Yes", "FieldId": "FLDID-0003977" },
      { "FieldName": "BSTKD", "KeyField": "No", "VerificationField": "Yes", "FieldId": "FLDID-0003978" },
      { "FieldName": "BSTDK", "KeyField": "No", "VerificationField": "Yes", "FieldId": "FLDID-0003979" },
      { "FieldName": "AKTNR", "KeyField": "No", "VerificationField": "Yes", "FieldId": "FLDID-0003981" }
    ]
  },
  {
    "TableName": "VBAP",
    "Fields": [
      { "FieldName": "VBELN", "KeyField": "Yes", "VerificationField": "Yes", "FieldId": "FLDID-0003921" },
      { "FieldName": "POSNR", "KeyField": "Yes", "VerificationField": "Yes", "FieldId": "FLDID-0003922" },
      { "FieldName": "MATNR", "KeyField": "No", "VerificationField": "Yes", "FieldId": "FLDID-0003923" },
      { "FieldName": "ARKTX", "KeyField": "No", "VerificationField": "No", "FieldId": "FLDID-0003925" },
      { "FieldName": "NETWR", "KeyField": "No", "VerificationField": "Yes", "FieldId": "FLDID-0003926" },
      { "FieldName": "WAERK", "KeyField": "No", "VerificationField": "Yes", "FieldId": "FLDID-0003927" },
      { "FieldName": "KWMENG", "KeyField": "No", "VerificationField": "Yes", "FieldId": "FLDID-0003928" },
      { "FieldName": "MEINS", "KeyField": "No", "VerificationField": "Yes", "FieldId": "FLDID-0003929" },
      { "FieldName": "WERKS", "KeyField": "No", "VerificationField": "Yes", "FieldId": "FLDID-0003930" },
      { "FieldName": "LGORT", "KeyField": "No", "VerificationField": "Yes", "FieldId": "FLDID-0003931" },
      { "FieldName": "VSTEL", "KeyField": "No", "VerificationField": "Yes", "FieldId": "FLDID-0003932" },
      { "FieldName": "ROUTE", "KeyField": "No", "VerificationField": "Yes", "FieldId": "FLDID-0003933" },
      { "FieldName": "PRCTR", "KeyField": "No", "VerificationField": "Yes", "FieldId": "FLDID-0003934" },
      { "FieldName": "KOSTL", "KeyField": "No", "VerificationField": "Yes", "FieldId": "FLDID-0003937" },
      { "FieldName": "AUFNR", "KeyField": "No", "VerificationField": "Yes", "FieldId": "FLDID-0003938" }
    ]
  },
  {
    "TableName": "VBAK",
    "Fields": [
      { "FieldName": "VBELN", "KeyField": "Yes", "VerificationField": "Yes", "FieldId": "FLDID-0003905" },
      { "FieldName": "ERDAT", "KeyField": "No", "VerificationField": "Yes", "FieldId": "FLDID-0003906" },
      { "FieldName": "ERNAM", "KeyField": "No", "VerificationField": "No", "FieldId": "FLDID-0003907" },
      { "FieldName": "VKORG", "KeyField": "No", "VerificationField": "Yes", "FieldId": "FLDID-0003908" },
      { "FieldName": "VTWEG", "KeyField": "No", "VerificationField": "Yes", "FieldId": "FLDID-0003909" },
      { "FieldName": "SPART", "KeyField": "No", "VerificationField": "Yes", "FieldId": "FLDID-0003910" },
      { "FieldName": "KUNNR", "KeyField": "No", "VerificationField": "Yes", "FieldId": "FLDID-0003911" },
      { "FieldName": "AUDAT", "KeyField": "No", "VerificationField": "Yes", "FieldId": "FLDID-0003912" },
      { "FieldName": "VBTYP", "KeyField": "No", "VerificationField": "Yes", "FieldId": "FLDID-0003914" },
      { "FieldName": "WAERK", "KeyField": "No", "VerificationField": "Yes", "FieldId": "FLDID-0003915" },
      { "FieldName": "NETWR", "KeyField": "No", "VerificationField": "Yes", "FieldId": "FLDID-0003916" },
      { "FieldName": "AUART", "KeyField": "No", "VerificationField": "Yes", "FieldId": "FLDID-0003917" },
      { "FieldName": "LIFSK", "KeyField": "No", "VerificationField": "Yes", "FieldId": "FLDID-0003918" },
      { "FieldName": "FAKSK", "KeyField": "No", "VerificationField": "Yes", "FieldId": "FLDID-0003919" },
      { "FieldName": "VKBUR", "KeyField": "No", "VerificationField": "Yes", "FieldId": "FLDID-0003920" }
    ]
  }
];

export const mockTables: Table[] = rawTableData.map(table => ({
  name: table.TableName,
  Fields: table.Fields.map(field => ({
    id: field.FieldId,
    name: field.FieldName,
    isKey: field.KeyField === 'Yes',
    isValue: field.VerificationField === 'Yes',
  }))
}));


export type ExpectedValueType = 'Constant' | 'Derived' | 'Global Key' | '';

export type ValidationRule = {
  id: string;
  table: string;
  field: string;
  expectedValueType: ExpectedValueType;
  expValue: string;
  checked: boolean;
  operator: Operator;
};

export const initialValidationRules: ValidationRule[] = [
  { id: '1', table: 'VBAK', field: 'VBELN', expectedValueType: 'Constant', expValue: 'ORDER_123', checked: true, operator: '=' },
  { id: '2', table: 'VBAP', field: 'MATNR', expectedValueType: 'Derived', expValue: 'VBELN', checked: true, operator: '=' },
  { id: '3', table: 'VBAP', field: 'POSNR', expectedValueType: '', expValue: '', checked: false, operator: '=' },
  { id: '4', table: 'VBKD', field: 'ZTERM', expectedValueType: 'Constant', expValue: 'Net 30', checked: true, operator: '!=' },
];


const statusOptions: Workflow['status'][] = ['active', 'inactive', 'pending', 'error'];
const categories = ['ETL', 'Analytics', 'ML Pipeline', 'Data Quality', 'Streaming', 'Batch Processing'];

const generateWorkflow = (): Workflow => ({
  id: faker.string.uuid(),
  name: faker.hacker.phrase().slice(0, 30),
  description: faker.lorem.sentence({ min: 8, max: 15 }),
  status: faker.helpers.arrayElement(statusOptions),
  lastRun: faker.date.recent({ days: 7 }),
  createdAt: faker.date.past({ years: 1 }),
  steps: faker.number.int({ min: 3, max: 12 }),
  projectId: ''
});

const generateTemplate = (): Template => {
  const workflowCount = faker.number.int({ min: 2, max: 8 });
  const workflows = Array.from({ length: workflowCount }, generateWorkflow);
  
  return {
    id: faker.string.uuid(),
    name: faker.company.buzzPhrase().slice(0, 25),
    description: faker.lorem.paragraph({ min: 2, max: 4 }),
    category: faker.helpers.arrayElement(categories),
    workflows,
    createdAt: faker.date.past({ years: 2 }),
    author: faker.person.fullName(),
    isPublic: faker.datatype.boolean(),
    tags: faker.helpers.arrayElements(['python', 'sql', 'apache-spark', 'kafka', 'airflow', 'docker', 'kubernetes'], { min: 1, max: 4 }),
    projectId: ''
  };
};

export const mockTemplates: Template[] = Array.from({ length: 12 }, generateTemplate);

export const weeklyActivityData = [
  { day: 'Mon', created: faker.number.int({ min: 5, max: 20 }), completed: faker.number.int({ min: 5, max: 20 }) },
  { day: 'Tue', created: faker.number.int({ min: 8, max: 25 }), completed: faker.number.int({ min: 8, max: 25 }) },
  { day: 'Wed', created: faker.number.int({ min: 10, max: 30 }), completed: faker.number.int({ min: 10, max: 30 }) },
  { day: 'Thu', created: faker.number.int({ min: 12, max: 35 }), completed: faker.number.int({ min: 12, max: 35 }) },
  { day: 'Fri', created: faker.number.int({ min: 15, max: 40 }), completed: faker.number.int({ min: 15, max: 40 }) },
  { day: 'Sat', created: faker.number.int({ min: 3, max: 15 }), completed: faker.number.int({ min: 3, max: 15 }) },
  { day: 'Sun', created: faker.number.int({ min: 2, max: 10 }), completed: faker.number.int({ min: 2, max: 10 }) },
];
