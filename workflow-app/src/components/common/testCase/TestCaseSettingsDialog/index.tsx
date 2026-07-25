import React, { useState } from 'react';
import Editor from '@monaco-editor/react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Database,
  Globe,
  FileText,
  Edit,
  ChevronRight,
  ChevronLeft,
  Upload,
  Plus,
  Trash2,
  Search,
  Key,
  CheckCircle,
  GripVertical,
  Code,
  Server,
  Play,
} from 'lucide-react';
import { TestCase } from '@/types/testCase';
import { toast } from 'sonner';

interface TestCaseSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  testCase: TestCase | null;
}

type DataFetchType = 'database' | 'api' | 'file' | 'manual';
type DatabaseApproach = 'query' | 'connection';

interface DatabaseConfig {
  approach: DatabaseApproach | null;
  // Query-based fields
  query: string;
  queryType: string;
  queryParameters: { key: string; value: string; type: string }[];
  // Connection-based fields
  dbType: string;
  host: string;
  port: string;
  dbName: string;
  username: string;
  password: string;
  schemaName: string;
  tableName: string;
  connectionString: string;
}

interface ApiConfig {
  apiKey: string;
  method: string;
  endpoint: string;
  headers: { key: string; value: string }[];
  body: string;
}

interface ManualData {
  columns: string[];
  rows: { [key: string]: string }[];
}

interface ColumnData {
  id: string;
  name: string;
  type: string;
  description: string;
}

const dataFetchOptions = [
  {
    type: 'database' as DataFetchType,
    title: 'Database',
    description: 'Connect via SQL query or connection string',
    icon: Database,
    color: 'bg-blue-100 text-blue-800',
  },
  {
    type: 'api' as DataFetchType,
    title: 'API',
    description: 'Fetch data from any REST API endpoint',
    icon: Globe,
    color: 'bg-green-100 text-green-800',
  },
  {
    type: 'file' as DataFetchType,
    title: 'File Upload',
    description: 'Import from CSV, JSON, or Excel files',
    icon: FileText,
    color: 'bg-purple-100 text-purple-800',
  },
  {
    type: 'manual' as DataFetchType,
    title: 'Manual Entry',
    description: 'Enter test data directly into a grid',
    icon: Edit,
    color: 'bg-orange-100 text-orange-800',
  },
];

const databaseApproaches = [
  {
    type: 'query' as DatabaseApproach,
    title: 'Query-Based',
    description: 'Write custom SQL queries for advanced data retrieval',
    icon: Code,
    color: 'bg-indigo-100 text-indigo-800',
    features: ['Custom SQL queries', 'Complex joins', 'Advanced filtering', 'Query parameters'],
  },
  {
    type: 'connection' as DatabaseApproach,
    title: 'Connection Details',
    description: 'Simple connection with table selection',
    icon: Server,
    color: 'bg-cyan-100 text-cyan-800',
    features: ['Easy setup', 'Table browsing', 'Auto schema detection', 'Quick configuration'],
  },
];

// Mock column data that would normally come from the data source
const mockColumns: ColumnData[] = [
  { id: '1', name: 'user_id', type: 'integer', description: 'Unique user identifier' },
  { id: '2', name: 'username', type: 'string', description: 'User login name' },
  { id: '3', name: 'email', type: 'string', description: 'User email address' },
  { id: '4', name: 'first_name', type: 'string', description: 'User first name' },
  { id: '5', name: 'last_name', type: 'string', description: 'User last name' },
  { id: '6', name: 'created_at', type: 'datetime', description: 'Account creation date' },
  { id: '7', name: 'updated_at', type: 'datetime', description: 'Last profile update' },
  { id: '8', name: 'is_active', type: 'boolean', description: 'Account status' },
  { id: '9', name: 'role', type: 'string', description: 'User role in system' },
  { id: '10', name: 'phone_number', type: 'string', description: 'Contact phone number' },
  { id: '11', name: 'address', type: 'string', description: 'User address' },
  { id: '12', name: 'department', type: 'string', description: 'User department' },
];

export const TestCaseSettingsDialog: React.FC<TestCaseSettingsDialogProps> = ({
  open,
  onOpenChange,
  testCase,
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedDataType, setSelectedDataType] = useState<DataFetchType | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Column selection state
  const [searchTerm, setSearchTerm] = useState('');
  const [availableColumns, setAvailableColumns] = useState<ColumnData[]>(mockColumns);
  const [keyColumns, setKeyColumns] = useState<ColumnData[]>([]);
  const [validationColumns, setValidationColumns] = useState<ColumnData[]>([]);
  const [draggedColumn, setDraggedColumn] = useState<ColumnData | null>(null);

  // Database configuration state
  const [databaseConfig, setDatabaseConfig] = useState<DatabaseConfig>({
    approach: null,
    // Query-based
    query: 'SELECT * FROM users\nWHERE status = @status\nAND created_at > @start_date;',
    queryType: 'SELECT',
    queryParameters: [{ key: 'status', value: 'active', type: 'string' }, { key: 'start_date', value: '2024-01-01', type: 'date' }],
    // Connection-based
    dbType: 'postgresql',
    host: '',
    port: '5432',
    dbName: '',
    username: '',
    password: '',
    schemaName: '',
    tableName: '',
    connectionString: '',
  });

  // API configuration state
  const [apiConfig, setApiConfig] = useState<ApiConfig>({
    apiKey: '',
    method: 'GET',
    endpoint: '',
    headers: [{ key: '', value: '' }],
    body: '',
  });

  // Manual data state
  const [manualData, setManualData] = useState<ManualData>({
    columns: [''],
    rows: [{}],
  });

  const resetDialog = () => {
    setCurrentStep(1);
    setSelectedDataType(null);
    setSearchTerm('');
    setAvailableColumns(mockColumns);
    setKeyColumns([]);
    setValidationColumns([]);
    setDatabaseConfig({
      approach: null,
      query: 'SELECT * FROM users\nWHERE status = @status\nAND created_at > @start_date;',
      queryType: 'SELECT',
      queryParameters: [{ key: 'status', value: 'active', type: 'string' }, { key: 'start_date', value: '2024-01-01', type: 'date' }],
      dbType: 'postgresql',
      host: '',
      port: '5432',
      dbName: '',
      username: '',
      password: '',
      schemaName: '',
      tableName: '',
      connectionString: '',
    });
    setApiConfig({
      apiKey: '',
      method: 'GET',
      endpoint: '',
      headers: [{ key: '', value: '' }],
      body: '',
    });
    setManualData({
      columns: [''],
      rows: [{}],
    });
  };

  const handleClose = () => {
    resetDialog();
    onOpenChange(false);
  };

  const handleDataTypeSelect = (type: DataFetchType) => {
    setSelectedDataType(type);
    setCurrentStep(2);
  };

  const handleDatabaseApproachSelect = (approach: DatabaseApproach) => {
    setDatabaseConfig(prev => ({ ...prev, approach }));
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      if (currentStep === 2) {
        setSelectedDataType(null);
        setDatabaseConfig(prev => ({ ...prev, approach: null }));
      }
    }
  };

  const handleNext = () => {
    setCurrentStep(3);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsUploading(true);
      try {
        toast.loading('Processing file...', { id: 'file-upload' });
        // Simulate file processing
        await new Promise(resolve => setTimeout(resolve, 2000));
        toast.success(`File "${file.name}" uploaded successfully!`, {
          id: 'file-upload',
        });
        handleNext();
      } catch (error) {
        toast.error('Failed to process file', { id: 'file-upload' });
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleDatabaseSubmit = () => {
    if (databaseConfig.approach === 'query') {
      if (!databaseConfig.query.trim()) {
        toast.error('Please enter a SQL query');
        return;
      }
    } else if (databaseConfig.approach === 'connection') {
      if (!databaseConfig.host || !databaseConfig.dbName || !databaseConfig.username) {
        toast.error('Please fill in required connection fields');
        return;
      }
    }
    toast.success('Database configured successfully!');
    handleNext();
  };

  const handleApiSubmit = () => {
    if (!apiConfig.endpoint) {
      toast.error('API endpoint is required');
      return;
    }
    toast.success('API connected successfully!');
    handleNext();
  };

  const handleManualSubmit = () => {
    if (manualData.columns.filter(col => col.trim()).length === 0) {
      toast.error('Please add at least one column');
      return;
    }
    toast.success('Manual data configured successfully!');
    handleNext();
  };

  const handleFinalSubmit = () => {
    if (keyColumns.length === 0) {
      toast.error('Please select at least one key column');
      return;
    }
    if (validationColumns.length === 0) {
      toast.error('Please select at least one validation column');
      return;
    }
    toast.success('Test case configuration completed successfully!');
    handleClose();
  };

  const handleTestQuery = () => {
    toast.loading('Testing query...', { id: 'test-query' });
    // Simulate query testing
    setTimeout(() => {
      toast.success('Query executed successfully! Found 42 rows.', {
        id: 'test-query',
      });
    }, 1500);
  };

  const handleTestConnection = () => {
    toast.loading('Testing connection...', { id: 'test-connection' });
    // Simulate connection testing
    setTimeout(() => {
      toast.success('Connection successful! Database schema detected.', {
        id: 'test-connection',
      });
    }, 2000);
  };

  // Drag and drop functions
  const handleDragStart = (e: React.DragEvent, column: ColumnData, source: string) => {
    setDraggedColumn(column);
    e.dataTransfer.setData('source', source);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, target: string) => {
    e.preventDefault();
    const source = e.dataTransfer.getData('source');
    
    if (!draggedColumn || source === target) return;

    // Remove from source
    if (source === 'available') {
      setAvailableColumns(prev => prev.filter(col => col.id !== draggedColumn.id));
    } else if (source === 'key') {
      setKeyColumns(prev => prev.filter(col => col.id !== draggedColumn.id));
    } else if (source === 'validation') {
      setValidationColumns(prev => prev.filter(col => col.id !== draggedColumn.id));
    }

    // Add to target
    if (target === 'available') {
      setAvailableColumns(prev => [...prev, draggedColumn]);
    } else if (target === 'key') {
      setKeyColumns(prev => [...prev, draggedColumn]);
    } else if (target === 'validation') {
      setValidationColumns(prev => [...prev, draggedColumn]);
    }

    setDraggedColumn(null);
  };

  const addQueryParameter = () => {
    setDatabaseConfig(prev => ({
      ...prev,
      queryParameters: [...prev.queryParameters, { key: '', value: '', type: 'string' }],
    }));
  };

  const removeQueryParameter = (index: number) => {
    setDatabaseConfig(prev => ({
      ...prev,
      queryParameters: prev.queryParameters.filter((_, i) => i !== index),
    }));
  };

  const updateQueryParameter = (index: number, field: 'key' | 'value' | 'type', value: string) => {
    setDatabaseConfig(prev => ({
      ...prev,
      queryParameters: prev.queryParameters.map((param, i) =>
        i === index ? { ...param, [field]: value } : param
      ),
    }));
  };

  const addApiHeader = () => {
    setApiConfig(prev => ({
      ...prev,
      headers: [...prev.headers, { key: '', value: '' }],
    }));
  };

  const removeApiHeader = (index: number) => {
    setApiConfig(prev => ({
      ...prev,
      headers: prev.headers.filter((_, i) => i !== index),
    }));
  };

  const updateApiHeader = (index: number, field: 'key' | 'value', value: string) => {
    setApiConfig(prev => ({
      ...prev,
      headers: prev.headers.map((header, i) =>
        i === index ? { ...header, [field]: value } : header
      ),
    }));
  };

  const addManualColumn = () => {
    setManualData(prev => ({
      ...prev,
      columns: [...prev.columns, ''],
    }));
  };

  const updateManualColumn = (index: number, value: string) => {
    setManualData(prev => ({
      ...prev,
      columns: prev.columns.map((col, i) => (i === index ? value : col)),
    }));
  };

  const removeManualColumn = (index: number) => {
    setManualData(prev => ({
      columns: prev.columns.filter((_, i) => i !== index),
      rows: prev.rows.map(row => {
        const newRow = { ...row };
        delete newRow[prev.columns[index]];
        return newRow;
      }),
    }));
  };

  const addManualRow = () => {
    const newRow: { [key: string]: string } = {};
    manualData.columns.forEach(col => {
      if (col.trim()) newRow[col] = '';
    });
    setManualData(prev => ({
      ...prev,
      rows: [...prev.rows, newRow],
    }));
  };

  const updateManualCell = (rowIndex: number, column: string, value: string) => {
    setManualData(prev => ({
      ...prev,
      rows: prev.rows.map((row, i) =>
        i === rowIndex ? { ...row, [column]: value } : row
      ),
    }));
  };

  const removeManualRow = (index: number) => {
    setManualData(prev => ({
      ...prev,
      rows: prev.rows.filter((_, i) => i !== index),
    }));
  };

  const filteredColumns = availableColumns.filter(column =>
    column.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    column.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-6">
      <div className="flex items-center space-x-2">
        <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
          currentStep >= 1 ? 'bg-primary text-primary-foreground' : 'bg-gray-200 text-gray-600'
        }`}>
          1
        </div>
        <ChevronRight className={`w-4 h-4 ${currentStep >= 2 ? 'text-primary' : 'text-gray-400'}`} />
        <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
          currentStep >= 2 ? 'bg-primary text-primary-foreground' : 'bg-gray-200 text-gray-600'
        }`}>
          2
        </div>
        <ChevronRight className={`w-4 h-4 ${currentStep >= 3 ? 'text-primary' : 'text-gray-400'}`} />
        <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
          currentStep >= 3 ? 'bg-primary text-primary-foreground' : 'bg-gray-200 text-gray-600'
        }`}>
          3
        </div>
      </div>
    </div>
  );

  const renderColumnItem = (column: ColumnData, source: string) => (
    <div
      key={column.id}
      draggable
      onDragStart={(e) => handleDragStart(e, column, source)}
      className="bg-white border border-gray-200 rounded-md p-3 cursor-move hover:border-gray-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start gap-2">
        <GripVertical className="w-4 h-4 text-gray-400 mt-1 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm truncate">{column.name}</span>
            <Badge variant="outline" className="text-xs">
              {column.type}
            </Badge>
          </div>
          <p className="text-xs text-gray-600 line-clamp-2">{column.description}</p>
        </div>
      </div>
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold mb-2">Select Data Source Type</h3>
        <p className="text-gray-600">Choose how you want to configure test data for this test case</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {dataFetchOptions.map((option) => {
          const IconComponent = option.icon;
          return (
            <Card
              key={option.type}
              className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-primary/20"
              onClick={() => handleDataTypeSelect(option.type)}
            >
              <CardContent className="p-4 text-center">
                <div className={`w-10 h-10 rounded-full ${option.color} mx-auto mb-3 flex items-center justify-center`}>
                  <IconComponent className="w-5 h-5" />
                </div>
                <h4 className="font-semibold text-base mb-1">{option.title}</h4>
                <p className="text-xs text-gray-600">{option.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );

  const renderStep2 = () => {
    if (!selectedDataType) return null;

    const selectedOption = dataFetchOptions.find(opt => opt.type === selectedDataType);
    const IconComponent = selectedOption?.icon || Database;

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <div className={`w-10 h-10 rounded-full ${selectedOption?.color} flex items-center justify-center`}>
            <IconComponent className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">{selectedOption?.title} Configuration</h3>
            <p className="text-gray-600">{selectedOption?.description}</p>
          </div>
        </div>

        {selectedDataType === 'database' && renderDatabaseForm()}
        {selectedDataType === 'api' && renderApiForm()}
        {selectedDataType === 'file' && renderFileUploadForm()}
        {selectedDataType === 'manual' && renderManualForm()}
      </div>
    );
  };

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold mb-2">Select Key and Validation Columns</h3>
        <p className="text-gray-600">Drag and drop columns to categorize them for testing</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Available Columns */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-5 h-5 text-gray-600" />
            <h4 className="font-semibold">Available Columns</h4>
            <Badge variant="secondary">{filteredColumns.length}</Badge>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search columns..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-4 h-[400px] space-y-2 overflow-y-auto"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, 'available')}
          >
            {filteredColumns.length > 0 ? (
              filteredColumns.map((column) => renderColumnItem(column, 'available'))
            ) : (
              <div className="text-center text-gray-500 mt-8">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No columns found</p>
              </div>
            )}
          </div>
        </div>

        {/* Key Columns */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-3">
            <Key className="w-5 h-5 text-blue-600" />
            <h4 className="font-semibold">Key Columns</h4>
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              {keyColumns.length}
            </Badge>
          </div>
          
          <div
            className="border-2 border-dashed border-blue-300 bg-blue-50/50 rounded-lg p-4 h-[400px] space-y-2 overflow-y-auto"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, 'key')}
          >
            {keyColumns.length > 0 ? (
              keyColumns.map((column) => renderColumnItem(column, 'key'))
            ) : (
              <div className="text-center text-blue-500 mt-8">
                <Key className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Drop key columns here</p>
                <p className="text-xs text-gray-500 mt-1">
                  Columns used for identification
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Validation Columns */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <h4 className="font-semibold">Validation Columns</h4>
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              {validationColumns.length}
            </Badge>
          </div>
          
          <div
            className="border-2 border-dashed border-green-300 bg-green-50/50 rounded-lg p-4 h-[400px] space-y-2 overflow-y-auto"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, 'validation')}
          >
            {validationColumns.length > 0 ? (
              validationColumns.map((column) => renderColumnItem(column, 'validation'))
            ) : (
              <div className="text-center text-green-500 mt-8">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Drop validation columns here</p>
                <p className="text-xs text-gray-500 mt-1">
                  Columns to validate data
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={handleBack}>
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button onClick={handleFinalSubmit}>
          Complete Setup
        </Button>
      </div>
    </div>
  );

  const renderDatabaseApproachSelection = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h4 className="text-lg font-semibold mb-2">Choose Database Approach</h4>
        <p className="text-gray-600">Select how you want to configure your database connection</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {databaseApproaches.map((approach) => {
          const IconComponent = approach.icon;
          return (
            <Card
              key={approach.type}
              className={`cursor-pointer transition-all border-2 ${
                databaseConfig.approach === approach.type
                  ? 'border-primary shadow-md'
                  : 'border-gray-200 hover:border-primary/20 hover:shadow-sm'
              }`}
              onClick={() => handleDatabaseApproachSelect(approach.type)}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full ${approach.color} flex items-center justify-center`}>
                    <IconComponent className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{approach.title}</CardTitle>
                    <CardDescription>{approach.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {approach.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm text-gray-600">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );

  const renderDatabaseForm = () => {
    if (!databaseConfig.approach) {
      return renderDatabaseApproachSelection();
    }

    if (databaseConfig.approach === 'query') {
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="queryType" className="text-sm font-medium">Query Type</Label>
              <Select value={databaseConfig.queryType} onValueChange={(value) => setDatabaseConfig(prev => ({ ...prev, queryType: value }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SELECT">SELECT</SelectItem>
                  <SelectItem value="INSERT">INSERT</SelectItem>
                  <SelectItem value="UPDATE">UPDATE</SelectItem>
                  <SelectItem value="DELETE">DELETE</SelectItem>
                  <SelectItem value="STORED_PROCEDURE">Stored Procedure</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={handleTestQuery}
                className="w-full"
                disabled={!databaseConfig.query.trim()}
              >
                <Play className="w-4 h-4 mr-2" />
                Test Query
              </Button>
            </div>
          </div>

          <div>
            <Label htmlFor="query" className="text-sm font-medium">
              SQL Query <span className="text-red-500">*</span>
            </Label>
            <div className="relative mt-1 border rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 transition-shadow">
              <Editor
                height="200px"
                language="sql"
                theme="vs-dark"
                value={databaseConfig.query}
                onChange={(value) => setDatabaseConfig(prev => ({ ...prev, query: value || '' }))}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  wordWrap: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Use @parameter_name for parameterized queries
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-medium">Query Parameters</Label>
              <Button variant="outline" size="sm" onClick={addQueryParameter}>
                <Plus className="w-4 h-4 mr-1" />
                Add Parameter
              </Button>
            </div>
            <div className="space-y-2">
              {databaseConfig.queryParameters.map((param, index) => (
                <div key={index} className="grid grid-cols-4 gap-2">
                  <Input
                    placeholder="Parameter name"
                    value={param.key}
                    onChange={(e) => updateQueryParameter(index, 'key', e.target.value)}
                  />
                  <Input
                    placeholder="Value"
                    value={param.value}
                    onChange={(e) => updateQueryParameter(index, 'value', e.target.value)}
                  />
                  <Select value={param.type} onValueChange={(value) => updateQueryParameter(index, 'type', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="string">String</SelectItem>
                      <SelectItem value="integer">Integer</SelectItem>
                      <SelectItem value="date">Date</SelectItem>
                      <SelectItem value="boolean">Boolean</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeQueryParameter(index)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={handleBack}>
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button onClick={handleDatabaseSubmit}>
              Save & Next
            </Button>
          </div>
        </div>
      );
    }

    // Connection-based approach
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="dbType" className="text-sm font-medium">Database Type</Label>
            <Select value={databaseConfig.dbType} onValueChange={(value) => setDatabaseConfig(prev => ({ ...prev, dbType: value }))}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="postgresql">PostgreSQL</SelectItem>
                <SelectItem value="mysql">MySQL</SelectItem>
                <SelectItem value="mssql">SQL Server</SelectItem>
                <SelectItem value="oracle">Oracle</SelectItem>
                <SelectItem value="sqlite">SQLite</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="host" className="text-sm font-medium">
              Host <span className="text-red-500">*</span>
            </Label>
            <Input
              id="host"
              value={databaseConfig.host}
              onChange={(e) => setDatabaseConfig(prev => ({ ...prev, host: e.target.value }))}
              placeholder="localhost"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="port" className="text-sm font-medium">Port</Label>
            <Input
              id="port"
              value={databaseConfig.port}
              onChange={(e) => setDatabaseConfig(prev => ({ ...prev, port: e.target.value }))}
              placeholder="5432"
              className="mt-1"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="username" className="text-sm font-medium">
              Username <span className="text-red-500">*</span>
            </Label>
            <Input
              id="username"
              value={databaseConfig.username}
              onChange={(e) => setDatabaseConfig(prev => ({ ...prev, username: e.target.value }))}
              placeholder="database_user"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="password" className="text-sm font-medium">Password</Label>
            <Input
              id="password"
              type="password"
              value={databaseConfig.password}
              onChange={(e) => setDatabaseConfig(prev => ({ ...prev, password: e.target.value }))}
              placeholder="••••••••"
              className="mt-1"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="dbName" className="text-sm font-medium">
              Database Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="dbName"
              value={databaseConfig.dbName}
              onChange={(e) => setDatabaseConfig(prev => ({ ...prev, dbName: e.target.value }))}
              placeholder="test_database"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="schemaName" className="text-sm font-medium">Schema Name</Label>
            <Input
              id="schemaName"
              value={databaseConfig.schemaName}
              onChange={(e) => setDatabaseConfig(prev => ({ ...prev, schemaName: e.target.value }))}
              placeholder="public"
              className="mt-1"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="tableName" className="text-sm font-medium">Table Name</Label>
          <Input
            id="tableName"
            value={databaseConfig.tableName}
            onChange={(e) => setDatabaseConfig(prev => ({ ...prev, tableName: e.target.value }))}
            placeholder="users"
            className="mt-1"
          />
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Button
            variant="outline"
            onClick={handleTestConnection}
            disabled={!databaseConfig.host || !databaseConfig.dbName || !databaseConfig.username}
          >
            <Play className="w-4 h-4 mr-2" />
            Test Connection
          </Button>
          <p className="text-sm text-gray-500">
            Test your database connection before proceeding
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={handleBack}>
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button onClick={handleDatabaseSubmit}>
            Connect & Next
          </Button>
        </div>
      </div>
    );
  };

  const renderApiForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="method" className="text-sm font-medium">HTTP Method</Label>
          <Select value={apiConfig.method} onValueChange={(value) => setApiConfig(prev => ({ ...prev, method: value }))}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GET">GET</SelectItem>
              <SelectItem value="POST">POST</SelectItem>
              <SelectItem value="PUT">PUT</SelectItem>
              <SelectItem value="DELETE">DELETE</SelectItem>
              <SelectItem value="PATCH">PATCH</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="apiKey" className="text-sm font-medium">API Key</Label>
          <Input
            id="apiKey"
            type="password"
            value={apiConfig.apiKey}
            onChange={(e) => setApiConfig(prev => ({ ...prev, apiKey: e.target.value }))}
            placeholder="Enter your API key"
            className="mt-1"
          />
        </div>
      </div>
      
      <div>
        <Label htmlFor="endpoint" className="text-sm font-medium">
          API Endpoint <span className="text-red-500">*</span>
        </Label>
        <Input
          id="endpoint"
          value={apiConfig.endpoint}
          onChange={(e) => setApiConfig(prev => ({ ...prev, endpoint: e.target.value }))}
          placeholder="https://api.example.com/test-data"
          className="mt-1"
        />
      </div>
      
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm font-medium">Headers</Label>
          <Button variant="outline" size="sm" onClick={addApiHeader}>
            <Plus className="w-4 h-4 mr-1" />
            Add Header
          </Button>
        </div>
        <div className="space-y-2">
          {apiConfig.headers.map((header, index) => (
            <div key={index} className="flex gap-2">
              <Input
                placeholder="Key"
                value={header.key}
                onChange={(e) => updateApiHeader(index, 'key', e.target.value)}
                className="flex-1"
              />
              <Input
                placeholder="Value"
                value={header.value}
                onChange={(e) => updateApiHeader(index, 'value', e.target.value)}
                className="flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => removeApiHeader(index)}
                disabled={apiConfig.headers.length === 1}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
      
      {(apiConfig.method === 'POST' || apiConfig.method === 'PUT' || apiConfig.method === 'PATCH') && (
        <div>
          <Label htmlFor="body" className="text-sm font-medium">Request Body</Label>
          <Textarea
            id="body"
            value={apiConfig.body}
            onChange={(e) => setApiConfig(prev => ({ ...prev, body: e.target.value }))}
            placeholder="JSON request body"
            className="mt-1"
            rows={4}
          />
        </div>
      )}
      
      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={handleBack}>
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button onClick={handleApiSubmit}>
          Connect & Next
        </Button>
      </div>
    </div>
  );

  const renderFileUploadForm = () => (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
        <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <div className="space-y-2">
          <p className="text-lg font-medium">Drag & drop your files here</p>
          <p className="text-gray-600">or click to browse</p>
          <p className="text-sm text-gray-500">Supports CSV, JSON, XLSX, XML files</p>
        </div>
        <Input
          type="file"
          className="hidden"
          id="file-upload-settings"
          onChange={handleFileUpload}
          accept=".csv,.json,.xlsx,.xml"
          disabled={isUploading}
        />
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => document.getElementById('file-upload-settings')?.click()}
          disabled={isUploading}
        >
          {isUploading ? 'Processing...' : 'Choose File'}
        </Button>
      </div>
      
      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={handleBack}>
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
      </div>
    </div>
  );

  const renderManualForm = () => (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm font-medium">Columns</Label>
          <Button variant="outline" size="sm" onClick={addManualColumn}>
            <Plus className="w-4 h-4 mr-1" />
            Add Column
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {manualData.columns.map((column, index) => (
            <div key={index} className="flex gap-2">
              <Input
                placeholder={`Column ${index + 1}`}
                value={column}
                onChange={(e) => updateManualColumn(index, e.target.value)}
                className="flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => removeManualColumn(index)}
                disabled={manualData.columns.length === 1}
              >
                <Trash2 className="w-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
      
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm font-medium">Data Rows</Label>
          <Button variant="outline" size="sm" onClick={addManualRow}>
            <Plus className="w-4 h-4 mr-1" />
            Add Row
          </Button>
        </div>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {manualData.rows.map((row, rowIndex) => (
            <div key={rowIndex} className="flex gap-2 items-center">
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                {manualData.columns.filter(col => col.trim()).map((column) => (
                  <Input
                    key={column}
                    placeholder={column}
                    value={row[column] || ''}
                    onChange={(e) => updateManualCell(rowIndex, column, e.target.value)}
                  />
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => removeManualRow(rowIndex)}
                disabled={manualData.rows.length === 1}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
      
      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={handleBack}>
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button onClick={handleManualSubmit}>
          Continue to Column Selection
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Settings - {testCase?.name}
            {testCase && <Badge variant="secondary">{testCase.status}</Badge>}
          </DialogTitle>
          <DialogDescription>
            Configure data sources and test parameters for this test case
          </DialogDescription>
        </DialogHeader>
        
        <div className="mt-6">
          {renderStepIndicator()}
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
        </div>
      </DialogContent>
    </Dialog>
  );
};
