import React, { useState } from 'react';
import { FileUpload } from '@/components/common/testCase/FileUpload';
import { TestCaseTable } from '@/components/common/testCase/TestCaseTable';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { parseTestCaseFile } from '@/utils/fileParser';
import { TestCase } from '@/types/testCase';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { FileText } from 'lucide-react';

function TestCaseManagement(mode: { mode?: 'view' | 'edit' }) {
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);

    try {
      toast.loading('Processing file...', { id: 'upload' });

      const parsedTestCases = await parseTestCaseFile(file);
      setTestCases(prevCases => [...prevCases, ...parsedTestCases]);

      toast.success(`Successfully uploaded ${parsedTestCases.length} test cases from ${file.name}`, {
        id: 'upload',
      });
    } catch (error) {
      toast.error('Failed to process the file. Please try again.', {
        id: 'upload',
      });
      console.error('File upload error:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSearch = (search: string) => {
    setSearchTerm(search);
  };

  const filteredTestCases = testCases.filter(testCase =>
    testCase.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    testCase.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    testCase.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSettingsClick = (testCase: TestCase) => {
    toast.info(`Opening settings for: ${testCase.name}`);
    console.log('Settings clicked for:', testCase);
  };

  const handleFlowClick = (testCase: TestCase) => {
    toast.info(`Opening flow diagram for: ${testCase.name}`);
    console.log('Flow clicked for:', testCase);
  };

  return (
    <div className="bg-gray-50">
      <div className="container mx-auto px-4 py-4 max-w-7xl">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Test Case Automation
            </CardTitle>
            <CardDescription>
              Upload test case reports and manage their execution status. Search through your test cases and access detailed settings and flow diagrams.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FileUpload
              onFileUpload={handleFileUpload}
              isUploading={isUploading}
              onSearch={handleSearch}
              mode={mode.mode}
            />

            <TestCaseTable
              testCases={filteredTestCases}
              onSettingsClick={handleSettingsClick}
              onFlowClick={handleFlowClick}
            />

            {searchTerm && filteredTestCases.length !== testCases.length && (
              <div className="mt-4 text-sm text-gray-600 bg-blue-50 p-3 rounded-md border border-blue-200">
                <strong>Search Results:</strong> Showing {filteredTestCases.length} of {testCases.length} test cases
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Toaster position="top-right" richColors />
    </div>
  );
}

export default TestCaseManagement;
