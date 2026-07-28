import { Column, DataSource } from '../types/mapping';

const createMockColumns = (count: number): Column[] => {
  const commonColumns = [
    { name: 'id', type: 'integer' },
    { name: 'created_at', type: 'timestamp' },
    { name: 'updated_at', type: 'timestamp' },
    { name: 'email', type: 'varchar(255)' },
    { name: 'name', type: 'varchar(100)' },
    { name: 'customer_id', type: 'integer' },
    { name: 'order_id', type: 'integer' },
    { name: 'amount', type: 'decimal' },
    { name: 'status', type: 'varchar(50)' },
    { name: 'txn_id', type: 'varchar(100)' },
    { name: 'value', type: 'decimal' },
    { name: 'user_id', type: 'integer' },
    { name: 'description', type: 'text' },
    { name: 'active', type: 'boolean' }
  ];

  return commonColumns.slice(0, count).map(col => ({
    ...col,
    selected: true
  }));
};

export const mockDataSources: DataSource[] = [
  {
    id: '1',
    name: 'SAP',
    type: 'mysql',
    connected: true,
    tables: [
      {
        name: 'customers',
        columns: [
          { name: 'customer_id', type: 'integer', selected: true },
          { name: 'name', type: 'varchar(100)', selected: true },
          { name: 'email', type: 'varchar(255)', selected: true },
          { name: 'created_at', type: 'timestamp', selected: true },
          { name: 'active', type: 'boolean', selected: true },
        ],
        selected: false
      },
      {
        name: 'orders',
        columns: [
          { name: 'order_id', type: 'integer', selected: true },
          { name: 'customer_id', type: 'integer', selected: true },
          { name: 'amount', type: 'decimal', selected: true },
          { name: 'status', type: 'varchar(50)', selected: true },
          { name: 'created_at', type: 'timestamp', selected: true }
        ],
        selected: false
      }
    ]
  },
  {
    id: '2',
    name: 'EWM',
    type: 'postgresql',
    connected: true,
    tables: [
      {
        name: 'user_account',
        columns: [
          { name: 'id', type: 'integer', selected: true },
          { name: 'email', type: 'varchar(255)', selected: true },
          { name: 'created_at', type: 'timestamp', selected: true }
        ],
        selected: false
      },
      {
        name: 'transaction',
        columns: [
          { name: 'txn_id', type: 'varchar(100)', selected: true },
          { name: 'value', type: 'decimal', selected: true },
          { name: 'status', type: 'varchar(50)', selected: true }
        ],
        selected: false
      }
    ]
  },
  {
    id: '3',
    name: 'ECD',
    type: 'mysql',
    connected: true,
    tables: [
      {
        name: 'settlements',
        columns: [
          { name: 'settlement_id', type: 'integer', selected: true },
          { name: 'settlement_date', type: 'date', selected: true },
          { name: 'value_date', type: 'date', selected: true },
          { name: 'status', type: 'varchar(50)', selected: true }
        ],
        selected: false
      }
    ]
  },

];

export const mockValidationResults = {
  passed: 3,
  failed: 1,
  warnings: 2
};
