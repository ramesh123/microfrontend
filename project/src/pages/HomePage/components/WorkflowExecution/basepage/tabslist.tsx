import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { teamMembersData } from "./mock";
import { WorkflowPerformanceChart } from "./workflowperformance";
import { ExceptionDistributionChart } from "./Exceptiongraph";
import { useState } from "react";
import useFlowStore from "@/stores/flowStore";
import { SummaryTable } from "../Reconcilationtab/Summary";
import FlowPage from "@/pages/FlowPage";
import ReportDownloaderPage from "../Reconcilationtab/Report";
import HistoryPage from "../historydata/history";

const scoreColorMap: { [key: string]: string } = {
    'Perfect': 'bg-green-500',
    'Good': 'bg-blue-500',
    'Average': 'bg-yellow-500',
    'Bad': 'bg-red-500',
};

const getScoreCategory = (percentage: number): string => {
    if (percentage >= 98) return 'Perfect';
    if (percentage >= 80) return 'Good';
    if (percentage >= 70) return 'Average';
    return 'Bad';
};
// const [expanded, setExpanded] = useState(false);

const tabcss = "relative px-2 pb-1 text-sm font-medium text-gray-500 data-[state=active]:text-blue-600 data-[state=active]:font-semibold bg-transparent"+
" border-none shadow-none data-[state=active]:bg-transparent data-[state=active]:border-none data-[state=active]:shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 after:absolute after:left-0 after:bottom-0 after:h-[2px] after:w-full after:bg-blue-600 after:scale-x-0 after:transition-transform after:duration-300 data-[state=active]:after:scale-x-100";

export function OperationList({
    workflowId,
    flowId,
}: {
    workflowId: string;
    flowId: string;
}) {
    const [activeTab, setActiveTab] = useState("performance");
    const currentWorkflow = useFlowStore((s) => s.currentWorkflow);
    return (
        <Card className="h-127 px-0 py-1 gap-0">
            <CardContent>
                <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val)}>
                    <TabsList className="flex gap-6 border-b pb-1 bg-white">

                        <TabsTrigger value="performance" className={tabcss}>
                            Workflow
                        </TabsTrigger>

                        <TabsTrigger value="summary" className={tabcss}>
                            Summary
                        </TabsTrigger>

                        <TabsTrigger value="reports" className={tabcss}>
                            Reports
                        </TabsTrigger>

                        <TabsTrigger value="jobs" className={tabcss}>
                            Jobs
                        </TabsTrigger>

                    </TabsList>

                    <TabsContent value="performance" className="mt-4">
                    </TabsContent>

                    <TabsContent value="summary"  className="h-[400px] overflow-y-auto mt-4">
                        <SummaryTable flowId={workflowId} />
                    </TabsContent>

                    <TabsContent value="reports">
                        <ReportDownloaderPage workflowId={workflowId} workflow={currentWorkflow} />
                    </TabsContent>
                    <TabsContent value="jobs"  className="h-[100px] overflow-y-auto overflow-x-auto  mt-4">
                        <HistoryPage flowName={flowId} />
                    </TabsContent>

                </Tabs>
            </CardContent>
        </Card>
    );
}
