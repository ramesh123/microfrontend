import type { Faker } from '@faker-js/faker';
import { Organization, Transaction, ObjectItem } from '../types/organization';

const generateFieldValues = (count: number, faker: Faker) => {
  if (count === 0) return [];
  return Array.from({ length: count }, () => ({
    id: `VAL-${faker.string.uuid()}`,
    testingTechnique: faker.helpers.arrayElement(['Equivalence Class', 'Boundary Value', 'Decision Table']),
    fieldValue: faker.string.alphanumeric(5),
    lowerLimit: faker.number.int({ min: 1, max: 100 }).toString(),
    upperLimit: faker.number.int({ min: 101, max: 9999 }).toString(),
  }));
};

const generateTransactionTableFields = (count: number, faker: Faker) => {
  if (count === 0) return [];
  return Array.from({ length: count }, () => ({ //count:
    id: `FIELD-${faker.string.uuid()}`,
    name: faker.database.column().toUpperCase(),
    type: faker.helpers.arrayElement(['Text', 'Date', 'Number', 'Boolean']),
    key: faker.datatype.boolean(),
    verification: faker.datatype.boolean(),
    description: faker.lorem.words(3),
    values: generateFieldValues(faker.number.int({ min: 0, max: 5 }), faker),
  }));
};

const dd02lFields = [
  {
    id: 'FIELD-1', name: 'CHANGED_BY', type: 'Text', key: false, verification: false, description: 'Last Changed By', values: [
      {
        id: 'VAL-1',
        testingTechnique: 'Boundary Value',
        fieldValue: '2',
        lowerLimit: '100',
        upperLimit: '999',
      },
      {
        id: 'VAL-2',
        testingTechnique: 'Equivalence Class',
        fieldValue: 'ABC',
        lowerLimit: '10',
        upperLimit: '99',
      }
    ]
  },
  { id: 'FIELD-2', name: 'SQLTAB', type: 'Text', key: false, verification: false, description: 'SQL Table Name', values: [] },
  { id: 'FIELD-3', name: 'APPLCLASS', type: 'Text', key: false, verification: false, description: 'Application Class', values: [] },
  { id: 'FIELD-4', name: 'MAINTFLAG', type: 'Text', key: false, verification: false, description: 'Maintenance Flag', values: [] },
  { id: 'FIELD-5', name: 'CREATED_ON', type: 'Date', key: false, verification: true, description: 'Creation Date', values: [] },
  { id: 'FIELD-6', name: 'CREATED_BY', type: 'Text', key: false, verification: false, description: 'Created By', values: [] },
  { id: 'FIELD-7', name: 'CHANGED_ON', type: 'Date', key: false, verification: true, description: 'Last Changed Date', values: [] },
  { id: 'FIELD-8', name: 'SYSTEM_ID', type: 'Text', key: false, verification: false, description: 'System ID', values: [] },
  { id: 'FIELD-9', name: 'DEVCLASS', type: 'Text', key: false, verification: false, description: 'Development Class', values: [] },
  { id: 'FIELD-10', name: 'SIZECLASS', type: 'Text', key: false, verification: false, description: 'Size Category', values: [] },
];

const generateTransactionTables = (count: number, faker: Faker) => {
  if (count === 0) return [];
  return Array.from({ length: count }, () => ({
    id: `TBL-${faker.string.uuid()}`,
    name: faker.database.engine().toUpperCase() + faker.string.alphanumeric(4).toUpperCase(),
    type: faker.helpers.arrayElement(['Configuration', 'Master Data', 'Transactional']),
    description: faker.lorem.sentence(),
    fields: generateTransactionTableFields(faker.number.int({ min: 5, max: 15 }), faker),
  }));
};

const generateTransactions = async (count: number, faker: Faker): Promise<Transaction[]> => {
  if (count === 0) return [];
  return Array.from({ length: count }, () => ({
    id: `T-${faker.string.uuid()}`,
    name: faker.commerce.productName(),
    code: faker.string.alphanumeric(6).toUpperCase(),
    description: faker.lorem.sentence(),
    tables: generateTransactionTables(faker.number.int({ min: 0, max: 3 }), faker),
  }));
};

const sapObjects: ObjectItem[] = [
  { id: 'OBJ-FIBL1-00242', application: 'SAP', module: 'FI', subModule: 'BL', objectType: 'Transaction', objectName: 'Bank Statement', tcode: 'FIBL1', description: 'Bank Statement' },
  { id: 'OBJ-FEBAN-00244', application: 'SAP', module: 'FI', subModule: 'BL', objectType: 'Transaction', objectName: 'Bank Statement Postprocessing', tcode: 'FEBAN', description: 'Bank Statement Postprocessing' },
  { id: 'OBJ-F-36-00196', application: 'SAP', module: 'FI', subModule: 'AR', objectType: 'Transaction', objectName: 'Bill of Exchange Payment', tcode: 'F-36', description: 'Bill of Exchange Payment' },
  { id: 'OBJ-LX03-00144', application: 'SAP', module: 'WM', subModule: 'Packing', objectType: 'Transaction', objectName: 'Bin Status Report', tcode: 'LX03', description: 'Bin Status Report' },
  { id: 'OBJ-BOBJ-00528', application: 'SAP', module: 'BI', subModule: 'BO', objectType: 'Transaction', objectName: 'BObj Launch Pad', tcode: 'BOBJ', description: 'BObj Launch Pad' },
  { id: 'OBJ-BPC10-00547', application: 'SAP', module: 'BPC', subModule: 'Reporting', objectType: 'Transaction', objectName: 'BPC Reporting', tcode: 'BPC10', description: 'BPC Reporting' },
  { id: 'OBJ-BPC10-00548', application: 'SAP', module: 'BPC', subModule: 'Planning', objectType: 'Transaction', objectName: 'BPC Reporting', tcode: 'BPC10', description: 'BPC Reporting' },
  { id: 'OBJ-BPC10-00549', application: 'SAP', module: 'BPC', subModule: 'Consolidation', objectType: 'Transaction', objectName: 'BPC Reporting', tcode: 'BPC10', description: 'BPC Reporting' },
  { id: 'OBJ-CJ39-00347', application: 'SAP', module: 'PS', subModule: 'Budget', objectType: 'Transaction', objectName: 'Budget Carryforward', tcode: 'CJ39', description: 'Budget Carryforward' },
  { id: 'OBJ-CJ3A-00348', application: 'SAP', module: 'PS', subModule: 'Budget', objectType: 'Transaction', objectName: 'Budget Line Items', tcode: 'CJ3A', description: 'Budget Line Items' },
];

export const generateMockOrganizations = async (): Promise<Organization[]> => {
  const { faker } = await import('@faker-js/faker');
  return [
    {
      orgId: 'CLID-1',
      organisationName: 'Pharma Distribution',
      companyId: '1000',
      email: 'contact@pharma.com',
      location: 'Abram, Texas, United States.',
      address1: '123 Pharma St, Abram, TX 75001',
      address2: '',
      country: 'United States',
      state: 'Texas',
      city: 'Abram',
      zipcode: '75001',
      countryCode: '+1',
      contact: '1234567890',
      industryTypes: ['healthcare', 'retail'],
      services: ['support', 'maintenance'],
      businessUnits: [
        {
          id: 'BU-1',
          businessUnitName: 'Supply Chain Management',
          companyCode: '8000',
          email: 'info@healthcare.com',
          country: 'United States',
          state: 'California',
          city: 'Sunnyvale',
          zipcode: '94086',
          countryCode: '+1',
          contact: '5551234567',
          address1: '123 Supply Chain Rd, Sunnyvale, CA',
          address2: ''
        }
      ],
      businessProcesses: [
        {
          id: 'BP-1',
          businessUnitName: 'Supply Chain Management',
          businessProcessName: 'Order Fulfillment',
          description: 'Process for handling customer orders from placement to delivery.'
        }
      ],
      projects: [
        {
          id: 'PROJ-1',
          clientName: 'Pharma Distribution',
          projectName: 'ERP System Upgrade',
          businessUnit: 'Supply Chain Management',
          projectType: 'Implementation',
          startDate: new Date('2024-01-15'),
          endDate: new Date('2024-12-20'),
          description: 'Upgrading the existing ERP to the latest version for improved performance.'
        }
      ],
      applications: [
        {
          id: 'APP-1',
          name: 'Inventory Management System',
          description: 'Manages stock levels, orders, and deliveries.',
          transactions: [
            {
              id: 'T-1', name: 'Stock Check', code: 'SE11', description: 'Check current stock levels.', tables: [
                { id: 'TBL-1', name: 'DD02L', type: 'Configuration', description: 'ABAP Dictionary table definitions', fields: dd02lFields },
                { id: 'TBL-2', name: 'MARA', type: 'Master Data', description: 'General Material Data', fields: await generateTransactionTableFields(8, faker) }
              ]
            },
            { id: 'T-2', name: 'Create Purchase Order', code: 'PO_CRT', description: 'Create a new purchase order.', tables: [] },
            ...await generateTransactions(20, faker)
          ],
          features: [
            { id: 'F-1', name: 'Real-time Tracking', description: 'Track inventory movement in real-time.' },
            { id: 'F-2', name: 'Low Stock Alerts', description: 'Get alerts for low stock items.' },
          ],
          programs: [
            { id: 'P-1', name: 'Weekly Inventory Report', description: 'Generates a weekly summary of inventory.', features: ['Real-time Tracking'] },
          ],
          objects: sapObjects,
        }
      ],
      integrations: [
        {
          id: 'INTID-5',
          name: 'Delivery Interface to ACUMAX',
          source: 'SAP',
          target: 'ACUMAX',
          mode: 'Middleware'
        },
        {
          id: 'INTID-6',
          name: 'Salesforce to SAP Customer Sync',
          source: 'Salesforce',
          target: 'SAP',
          mode: 'API'
        }
      ]
    },
    {
      orgId: 'CLID-2',
      organisationName: 'Hitech',
      companyId: '2000',
      email: 'info@hitech.com',
      location: 'Alhambra, California, United States.',
      address1: '456 Tech Ave, Alhambra, CA 91801',
      address2: 'Suite 100',
      country: 'United States',
      state: 'California',
      city: 'Alhambra',
      zipcode: '91801',
      countryCode: '+1',
      contact: '2345678901',
      industryTypes: ['technology', 'automotive'],
      services: ['development', 'consulting'],
      businessUnits: [],
      businessProcesses: [],
      projects: [],
      applications: [
        {
          id: 'APP-2',
          name: 'CRM Pro',
          description: 'Customer Relationship Management Tool.',
          transactions: [
            { id: 'T-3', name: 'Create Lead', code: 'LEAD_NEW', description: 'Create a new sales lead.', tables: [] },
            { id: 'T-4', name: 'Update Contact', code: 'CONT_UPD', description: 'Update contact information.', tables: [] },
            ...await generateTransactions(15, faker)
          ],
          features: [
            { id: 'F-3', name: 'Contact Management', description: 'Manage customer contact details.' },
            { id: 'F-4', name: 'Sales Pipeline', description: 'Visualize and manage sales stages.' },
          ],
          programs: [],
          objects: [],
        }
      ],
      integrations: [
        {
          id: 'INTID-7',
          name: 'Workday Employee Sync',
          source: 'Workday',
          target: 'AD',
          mode: 'File'
        }
      ]
    },
    {
      orgId: 'CLID-3',
      organisationName: 'Surgical Equipment',
      companyId: '3000',
      email: 'contact@healthcare.com',
      location: 'Aguanga, California, United States.',
      address1: '789 Medical Blvd, Aguanga, CA 92536',
      address2: '',
      country: 'United States',
      state: 'California',
      city: 'Aguanga',
      zipcode: '92536',
      countryCode: '+1',
      contact: '3456789012',
      industryTypes: ['healthcare', 'manufacturing'],
      services: ['integration', 'training'],
      businessUnits: [],
      businessProcesses: [],
      projects: [],
      applications: [
        {
          id: 'APP-3',
          name: 'Device Tracking',
          description: 'Tracks surgical equipment.',
          transactions: await generateTransactions(30, faker),
          features: [
            { id: 'F-5', name: 'Device Geolocation', description: 'Track equipment location via GPS.' },
          ],
          programs: [],
          objects: [],
        }
      ],
      integrations: []
    },
    {
      orgId: 'CLID-4',
      organisationName: 'ABC Corporation',
      companyId: '',
      email: 'info@abc.com',
      location: 'Craig, Alaska, United States.',
      address1: '321 Corp Way, Craig, AK 99921',
      address2: '',
      country: 'United States',
      state: 'Alaska',
      city: 'Craig',
      zipcode: '99921',
      countryCode: '+1',
      contact: '4567890123',
      industryTypes: ['finance'],
      services: ['consulting'],
      businessUnits: [],
      businessProcesses: [],
      projects: [],
      applications: [],
      integrations: []
    },
    {
      orgId: 'CLID-5',
      organisationName: 'Meghalaya State',
      companyId: '',
      email: 'janaiah.gera@sirobilt.com',
      location: 'Shillong, Meghalaya, India.',
      address1: 'Government Complex, Shillong, Meghalaya 793001',
      address2: '',
      country: 'India',
      state: 'Meghalaya',
      city: 'Shillong',
      zipcode: '793001',
      countryCode: '+91',
      contact: '5678901234',
      industryTypes: ['government'],
      services: [],
      businessUnits: [],
      businessProcesses: [],
      projects: [],
      applications: [],
      integrations: []
    }
  ];
};

export const tabsData = [
  { id: 'org-details', label: 'Org Details' },
  { id: 'business-units', label: 'Business Units' },
  { id: 'business-process', label: 'Business Process' },
  { id: 'applications', label: 'Applications' },
  // { id: 'transactions', label: 'Transactions' },
  // { id: 'integrations', label: 'Integrations' },
  // { id: 'programs', label: 'Programs' },
  // { id: 'features', label: 'Features' },
  // { id: 'objects', label: 'Objects' },
  // { id: 'adapters', label: 'Adapters' },
  // { id: 'grabber', label: 'Grabber' },
  // { id: 'others', label: 'Others' }
];

export interface MappedTransaction {
  id: string;
  name: string;
  code: string;
}

export interface MappedSubProcess {
  id: string;
  name: string;
  transactions: MappedTransaction[];
}

export interface MappedProcess {
  id: string;
  name: string;
  subProcesses: MappedSubProcess[];
}

export const businessProcessMappingData: MappedProcess[] = [
  {
    id: 'proc-otc',
    name: 'OTC',
    subProcesses: [
      {
        id: 'sub-sales-order',
        name: 'Sales Order Creation',
        transactions: [
          { id: 't-va01', name: 'Order Create', code: 'VA01' }
        ]
      },
      {
        id: 'sub-delivery',
        name: 'Delivery Processing',
        transactions: [
          { id: 't-vl01n', name: 'Create Delivery', code: 'VL01N' },
          { id: 't-vl10g', name: 'Batch Delivery Creation', code: 'VL10G' }
        ]
      }
    ]
  },
  {
    id: 'proc-ptp',
    name: 'PTP',
    subProcesses: [
      {
        id: 'sub-purchasing',
        name: 'Purchasing',
        transactions: [
          { id: 't-me21n', name: 'Create PO', code: 'ME21N' }
        ]
      }
    ]
  },
  {
    id: 'proc-mfg',
    name: 'MANUFACTURING',
    subProcesses: [
      {
        id: 'sub-prod-exec',
        name: 'Production Execution',
        transactions: [
          { id: 't-co01', name: 'Create Production Order', code: 'CO01' },
          { id: 't-co02', name: 'Change a Production Order', code: 'CO02' }
        ]
      }
    ]
  }
];
