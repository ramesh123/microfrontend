import { TestCase } from '@/types/testCase';

// Simulate parsing different file formats and extracting test case data
export const parseTestCaseFile = async (file: File): Promise<TestCase[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Mock data based on file name for demonstration
      const mockTestCases: TestCase[] = [
        {
          id: `tc-${Date.now()}-001`,
          name: `Login Functionality Test - ${file.name}`,
          description: 'Verify that users can successfully log in with valid credentials and are redirected to the dashboard',
          status: 'passed',
          createdAt: new Date(),
        },
        {
          id: `tc-${Date.now()}-002`,
          name: `User Registration Test - ${file.name}`,
          description: 'Test user registration process with valid email and password requirements',
          status: 'failed',
          createdAt: new Date(),
        },
        {
          id: `tc-${Date.now()}-003`,
          name: `Password Reset Flow - ${file.name}`,
          description: 'Verify password reset functionality sends email and allows password change',
          status: 'pending',
          createdAt: new Date(),
        },
        {
          id: `tc-${Date.now()}-004`,
          name: `Profile Update Test - ${file.name}`,
          description: 'Test updating user profile information and profile picture upload',
          status: 'skipped',
          createdAt: new Date(),
        },
        {
          id: `tc-${Date.now()}-005`,
          name: `Data Export Feature - ${file.name}`,
          description: 'Verify users can export their data in various formats (CSV, PDF, JSON)',
          status: 'passed',
          createdAt: new Date(),
        },
      ];

      resolve(mockTestCases);
    }, 1500); // Simulate file processing time
  });
};
