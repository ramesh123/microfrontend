import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Settings, GitBranch, FileText } from 'lucide-react';
import { TestCase } from '@/types/testCase';
import { TestCaseSettingsDialog } from '@/components/common/testCase/TestCaseSettingsDialog';
import { toast } from 'sonner';

interface TestCaseTableProps {
  testCases: TestCase[];
  onSettingsClick: (testCase: TestCase) => void;
  onFlowClick: (testCase: TestCase) => void;
}

const getStatusColor = (status: TestCase['status']) => {
  switch (status) {
    case 'passed':
      return 'bg-green-100 text-green-800 hover:bg-green-200';
    case 'failed':
      return 'bg-red-100 text-red-800 hover:bg-red-200';
    case 'pending':
      return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200';
    case 'skipped':
      return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
    default:
      return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
  }
};

export const TestCaseTable: React.FC<TestCaseTableProps> = ({
  testCases,
  onSettingsClick,
  onFlowClick,
}) => {
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [selectedTestCase, setSelectedTestCase] = useState<TestCase | null>(null);

  const handleSettingsClick = (testCase: TestCase) => {
    setSelectedTestCase(testCase);
    setSettingsDialogOpen(true);
    onSettingsClick(testCase);
  };

  const handleFlowClick = (testCase: TestCase) => {
    toast.info(`Opening flow diagram for: ${testCase.name}`);
    onFlowClick(testCase);
  };

  if (testCases.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="mx-auto h-16 w-16 text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No test cases yet</h3>
        <p className="text-gray-500 mb-4">Upload a test case report to get started</p>
        <p className="text-xs text-gray-400">
          Supported formats: JSON, CSV, XLSX, XML
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Test Cases</h3>
            <p className="text-sm text-gray-500">
              {testCases.length} test case{testCases.length !== 1 ? 's' : ''} loaded
            </p>
          </div>
        </div>
        
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[300px]">Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
                <TableHead className="w-[120px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {testCases.map((testCase) => (
                <TableRow key={testCase.id} className="hover:bg-gray-50">
                  <TableCell className="font-medium">
                    <div className="space-y-1">
                      <div className="font-semibold">{testCase.name}</div>
                      <div className="text-xs text-gray-500">
                        ID: {testCase.id}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[400px] truncate" title={testCase.description}>
                      {testCase.description}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={getStatusColor(testCase.status)}
                    >
                      {testCase.status.charAt(0).toUpperCase() + testCase.status.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="md"
                        onClick={() => handleSettingsClick(testCase)}
                        className="h-8 w-8 p-0 hover:bg-gray-100"
                        title="Settings"
                      >
                        <Settings className="h-4 w-4" />
                        <span className="sr-only">Settings</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="md"
                        onClick={() => handleFlowClick(testCase)}
                        className="h-8 w-8 p-0 hover:bg-gray-100"
                        title="Flow Diagram"
                      >
                        <GitBranch className="h-4 w-4" />
                        <span className="sr-only">Flow</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <TestCaseSettingsDialog
        open={settingsDialogOpen}
        onOpenChange={setSettingsDialogOpen}
        testCase={selectedTestCase}
      />
    </>
  );
};
