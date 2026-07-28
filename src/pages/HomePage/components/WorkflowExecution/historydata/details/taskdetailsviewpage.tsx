import React, { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { TaskDetailView } from "@/pages/JobsPage/TaskDetailView";
import { FlowJob, JobsFilter } from "@/types/jobs";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export const TaskDetailViewPage: React.FC = () => {
  const [filters, setFilters] = useState<JobsFilter>({ timeRange: 'last_7_days' });
    const [selectedFlow, setSelectedFlow] = useState<FlowJob | null>(null);
  const { flowId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const locationState = location.state as (FlowJob & { returnPath?: string }) | null;
  const [flowData, setFlowData] = useState<FlowJob | null>(
    locationState || null
  );
  const [refreshKey, setRefreshKey] = useState(0); 

  const handleBack = () => {
    // Check location.state directly to get the latest returnPath
    const currentState = location.state as (FlowJob & { returnPath?: string }) | null;
    // If there's a return path (e.g., from action-centre jobs tab), navigate to it
    if (currentState?.returnPath) {
      // Navigate to the return path - this should include the workflowName and sidebar=jobs
      navigate(currentState.returnPath);
    } else if (flowData?.flow_id) {
      navigate(`/history/${flowData.flow_id}`, { state: flowData });
    } else {
      navigate(-1);
    }
  };
  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1); 
  };

  if (!flowData) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Loading flow details...
      </div>
    );
  }

  return (
    <div className="p-0 pt-0">
      <TaskDetailView key={refreshKey} flow={flowData} onBack={handleBack}  />
    </div>
  );
};
