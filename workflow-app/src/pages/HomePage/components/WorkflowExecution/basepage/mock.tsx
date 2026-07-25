import { CheckSquare, PlayCircle, AlertTriangle } from 'lucide-react';

export const statsCardsData = [
    {
        title: 'Total Validations',
        value: '1,254',
        icon: CheckSquare,
        detail: 'Total records processed today',
    },
    {
        title: 'Workflow Processes Scheduled',
        value: '1,200',
        icon: PlayCircle,
        detail: 'For today\'s execution',
    },
    {
        title: 'No. of Exceptions',
        value: '12',
        icon: AlertTriangle,
        detail: 'Requires manual review',
    },
];

export const teamMembersData = [
    { id: 1, name: 'Alena Gouse', role: 'UI Designer - UID1', avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026704d', score: 201, thisMonth: 83.45, lastMonth: 82.00 },
    { id: 2, name: 'Alan Walker', role: 'UI Designer - UID3', avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026705d', score: 223, thisMonth: 97.98, lastMonth: 61.00 },
]
export const workflowPerformanceData = [
    { cycle: 'Run 1', loaded: 4500, exceptions: 80 },
    { cycle: 'Run 2', loaded: 4800, exceptions: 95 },
    { cycle: 'Run 3', loaded: 5200, exceptions: 110 },
    { cycle: 'Run 4', loaded: 4900, exceptions: 105 },
    { cycle: 'Run 5', loaded: 5500, exceptions: 120 },
    { cycle: 'Run 6', loaded: 5300, exceptions: 115 },
];

export const exceptionDistributionData = [
    { ageing: 'Run1', count: 45 },
    { ageing: 'Run2', count: 30 },
    { ageing: 'Run3', count: 25 },
    { ageing: 'Run4', count: 18 },
    { ageing: 'Run5', count: 12 },
];
