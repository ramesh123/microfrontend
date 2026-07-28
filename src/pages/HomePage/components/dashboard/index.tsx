import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Library, Workflow, CheckCircle2, Percent, View, Database, Upload, X, XCircle, FileKey, FolderPlus } from "lucide-react";
import { allMockWorkflows } from "@/data/allWorkflows";
import StatCard from "../StatCard";
import PipelineListItem from "../PipelineListItem";
import DataHubActionItem from "../DataHubActionItem";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import CreateWorkflowDialog from "../CreateWorkflowDialog";
import { useAuth } from "@/context/auth/authContext";


export default function Dashboard() {
  // --- Stats Calculation ---
  const navigate = useNavigate();
  const totalWorkflows = allMockWorkflows.length;
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [activeLibraryTab, setActiveLibraryTab] = useState('templates');
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const createdThisMonth = allMockWorkflows.filter(wf => new Date(wf.createdAt) >= startOfMonth).length;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentRuns = allMockWorkflows.filter(wf => new Date(wf.lastRun) >= sevenDaysAgo);
  const successfulRuns = recentRuns.filter(wf => wf.status === 'active').length;
  const successRate = recentRuns.length > 0 ? Math.round((successfulRuns / recentRuns.length) * 100) : 100;
  const { state: authState } = useAuth();

  const handleOpenDialog = () => setCreateDialogOpen(true);
  
  const handleNavigateToWorkflows = () => {
    setCurrentPage('library');
    setActiveLibraryTab('workflows');
  };

  const handleNavigateToTemplates = () => {
    navigate('/project/templates');
  };

  const recentPipelines = [...allMockWorkflows]
    .sort((a, b) => new Date(b.lastRun).getTime() - new Date(a.lastRun).getTime())
    .slice(0, 4);

  return (
    <>
      <div className="space-y-8">
        {/* Welcome & Quick Action */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Welcome back, {authState?.authInfo?.user?.name}</h1>
            <p className="text-muted-foreground mt-1 dark:text-white">Here's a summary of your pipeline activity.</p>
          </div>
          {/* <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button size="lg" className="flex-1 sm:flex-none" onClick={handleOpenDialog}>
              <Plus className="mr-2 h-5 w-5" />
              Create Pipeline
            </Button>
            <Button size="lg" variant="outline" className="flex-1 sm:flex-none" onClick={handleNavigateToTemplates}>
              <Library className="mr-2 h-5 w-5" />
              Browse Templates
            </Button>
          </div> */}
        </div>

        {/* Pipeline Health & Activity Summary */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Workflows"
            value={totalWorkflows}
            description={`${createdThisMonth} created this month`}
            icon={Workflow}
            color="text-yellow-500"
          />
          <StatCard
            title="Success Rate"
            value={`${successRate}%`}
            description="In the last 7 days"
            icon={Percent}
            color="text-green-500"
          />
          <StatCard
            title="Successful Runs"
            value={successfulRuns}
            description="In the last 7 days"
            icon={CheckCircle2}
            color="text-blue-500"
          />
          <StatCard
            title="Failed Runs"
            value={successfulRuns}
            description="In the last 7 days"
            icon={XCircle}
            color="text-red-500"
          />
        </div>

        {/* Data Hub & Recent Activity Section */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Data Hub Card */}
          <Card>
            <CardHeader>
              <CardTitle>Data Hub</CardTitle>
              <CardDescription>Manage your datasets and master files.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-1 p-4 pt-0">
              <DataHubActionItem
                icon={FolderPlus}
                title="Create New Project"
                description="Organize your pipelines."
                onClick={() => navigate("/project/create")}
              />
              <DataHubActionItem
                icon={Database}
                title="Manage Datasets"
                description="Add, view, and configure data sources."
                onClick={() => navigate("/dashboard/connection-vault")}
              />
              <DataHubActionItem
                icon={Upload}
                title="Upload Master File"
                description="Import data from a CSV or JSON file."
                onClick={() => navigate("/dashboard/master-data")}
              />
              <DataHubActionItem
                icon={FileKey}
                title="Manage Credentials"
                description="Manage your credentials."
                onClick={() => navigate("/dashboard/credentials")}
              />
            </CardContent>
          </Card>

          {/* Recent Activity Card */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Recent list of your most recently run pipelines.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-border -mx-2">
                {recentPipelines.length > 0 ? (
                  recentPipelines.map(wf => <PipelineListItem key={wf.id} workflow={wf} onView={handleNavigateToWorkflows} />)
                ) : (
                  <p className="py-8 text-center text-muted-foreground">No recent pipeline runs.</p>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="outline" size="sm" className="w-full" onClick={handleNavigateToWorkflows}>
                <View className="mr-2 h-4 w-4" />
                View All Pipelines
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>

      <CreateWorkflowDialog 
        open={isCreateDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </>
  );
}
