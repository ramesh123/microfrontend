export interface TestCase {
    id: string;
    name: string;
    description: string;
    status: 'pending' | 'passed' | 'failed' | 'skipped';
    createdAt: Date;
  }
  