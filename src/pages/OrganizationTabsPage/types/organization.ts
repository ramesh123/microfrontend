export interface FieldValue {
  id: string;
  testingTechnique: string;
  fieldValue: string;
  lowerLimit: string;
  upperLimit: string;
}

export interface BusinessUnit {
  id: string;
  businessUnitName: string;
  companyCode: string;
  email: string;
  country: string;
  state: string;
  city: string;
  zipcode: string;
  countryCode: string;
  contact: string;
  address1: string;
  address2: string;
}

export interface BusinessProcess {
  id: string;
  businessUnitName: string;
  businessProcessName:string;
  description: string;
}

export interface Project {
  id: string;
  clientName: string;
  projectName: string;
  businessUnit: string;
  projectType: string;
  startDate?: Date;
  endDate?: Date;
  description: string;
}

export interface Feature {
  id: string;
  name: string;
  description: string;
}

export interface Program {
  id: string;
  name: string;
  description: string;
  features: string[]; // Array of feature names
}

export interface TransactionTableField {
  id: string;
  name: string;
  type: string;
  key: boolean;
  verification: boolean;
  description: string;
  values: FieldValue[];
}

export interface TransactionTable {
  id: string;
  name: string;
  type: string;
  description: string;
  fields: TransactionTableField[];
}

export interface Transaction {
  id: string;
  name: string;
  code: string;
  description: string;
  tables: TransactionTable[];
}

export interface ObjectItem {
  id: string;
  application: string;
  module: string;
  subModule: string;
  objectType: string;
  objectName: string;
  tcode: string;
  description: string;
}

export interface Application {
  id: string;
  name: string;
  description: string;
  transactions: Transaction[];
  features: Feature[];
  programs: Program[];
  objects: ObjectItem[];
}

export interface Integration {
  id: string;
  name: string;
  source: string;
  target: string;
  mode: string;
}

export interface Organization {
  orgId: string;
  organisationName: string;
  companyId: string;
  email: string;
  location: string;
  address1: string;
  address2: string;
  country: string;
  state: string;
  city: string;
  zipcode: string;
  countryCode: string;
  contact: string;
  industryTypes: string[];
  services: string[];
  businessUnits: BusinessUnit[];
  businessProcesses: BusinessProcess[];
  projects: Project[];
  applications: Application[];
  integrations: Integration[];
}

export interface TabData {
  id: string;
  label: string;
  count?: number;
}
