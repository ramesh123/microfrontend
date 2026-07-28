import { ColumnType, QuickTask, Task } from "./types";


export const initialColumns: ColumnType[] = [
  { id: 'pending', title: 'PENDING', count: 12 },
  { id: 'unmatched', title: 'UNMATCHED', count: 5 },
  { id: 'matched', title: 'MATCHED', count: 22 },
  { id: 'total', title: 'TOTAL', count: 39 },
];

export const initialTasks: Task[] = [
  {
    id: 'PIP-42',
    title: 'Path should be environment variable',
    status: 'pending',
    assignee: { initials: 'AV', color: 'bg-blue-500' },
    timeAgo: '5 Days ago',
    progress: 0,
    isOverdue: true,
    overdueTime: '5 days',
  },
  {
    id: 'PIP-94',
    title: 'Integrating n8n with dbx',
    status: 'matched',
    assignee: { initials: 'NM', color: 'bg-slate-700' },
    timeAgo: '53 Mins ago',
    progress: 0,
  },
  {
    id: 'PIP-91',
    title: 'Learning Langchain',
    status: 'matched',
    assignee: { initials: 'PT', color: 'bg-indigo-500' },
    timeAgo: '1 Hr ago',
    progress: 25,
  },
  {
    id: 'PIP-87',
    title: 'Operations portal apis- Rollback and Rollback authorization apis.',
    status: 'matched',
    assignee: { initials: 'MM', color: 'bg-blue-400' },
    timeAgo: '2 Hrs ago',
    progress: 0,
  },
  {
    id: 'PIP-93',
    title: 'Work-Flow performance improvement',
    status: 'unmatched',
    assignee: { initials: 'VC', color: 'bg-emerald-500' },
    timeAgo: '54 Mins ago',
    progress: 0,
  },
  {
    id: 'PIP-92',
    title: 'Implementing the ray runner and subprocess for the workflow',
    status: 'unmatched',
    assignee: { initials: 'SK', color: 'bg-green-600' },
    timeAgo: '1 Hr ago',
    progress: 0,
  },
  {
    id: 'PIP-88',
    title: 'Implementing Force Match & Force Match Authorization APIs',
    status: 'total',
    assignee: { initials: 'MM', color: 'bg-blue-400' },
    timeAgo: '2 Hrs ago',
    progress: 100,
  },
  {
    id: 'PIP-85',
    title: 'Test all N-way match rules on the DataFusion application',
    status: 'total',
    assignee: { initials: 'VC', color: 'bg-emerald-500' },
    timeAgo: '3 Hrs ago',
    progress: 100,
  },
];

export const initialQuickTasks: QuickTask[] = [
  {
    id: 'PIP-50',
    title: 'Prefect flow generation Bugs',
    category: 'open',
    assignee: { initials: 'SK', color: 'bg-green-600' },
    timeAgo: '4 Days ago',
    isOverdue: true,
    overdueTime: '4 days',
  },
  {
    id: 'PIP-49',
    title: 'Excel file read from Amazon s3 read issue',
    category: 'open',
    assignee: { initials: 'SK', color: 'bg-green-600' },
    timeAgo: '4 Days ago',
    isOverdue: true,
    overdueTime: '4 days',
  },
  {
    id: 'PIP-40',
    title: 'Database migration for user table',
    category: 'completed',
    assignee: { initials: 'JD', color: 'bg-blue-500' },
    timeAgo: '1 Week ago',
    isCompleted: true,
  },
  {
    id: 'PIP-35',
    title: 'Update API documentation for v2 endpoints',
    category: 'accepted',
    assignee: { initials: 'AL', color: 'bg-indigo-500' },
    timeAgo: '2 Days ago',
  },
];
