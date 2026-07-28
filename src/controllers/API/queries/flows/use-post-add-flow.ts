import { FlowData } from "@/types/flow";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/controllers/API/api";

interface WorkflowObject {
  updated_id: string;
  workflow_id: string;
  name: string;
  description: string;
  workflow_type: string;
  deployment_id: string;
  deployment_name: string;
  data: FlowData;
  icon: string;
  icon_bg_color: string;
  gradient: string;
  locked: boolean;
  display_name: string;
  scheduler: {
    additionalProp1: Record<string, any>;
  };
  assigned_user: string;
  assigned_role: string;
}

export const usePostAddFlow = () => {
  console.log("usePostAddFlow");
  const queryClient = useQueryClient();
  const postAddFlowFn = async (payload: WorkflowObject): Promise<WorkflowObject> => {

    console.log("payload", payload);
    try {
      const res = await api.post('/flow-builder/create-workflow', {
        name: payload.name,
        description: payload.description,
        workflow_type: payload.workflow_type,
        deployment_id: payload.deployment_id,
        deployment_name: payload.deployment_name,
        data: payload.data,
        icon: payload.icon,
        icon_bg_color: payload.icon_bg_color,
        gradient: payload.gradient,
        locked: payload.locked,
        display_name: payload.display_name,
        scheduler: payload.scheduler,
        assigned_user: payload.assigned_user,
        assigned_role: payload.assigned_role,
      });
      if (res.status === 200) {
        return res.data;
      }
    } catch (error) {
      throw error;
    }
  }

  const { mutate } = useMutation({
    mutationFn: postAddFlowFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flows"] });
    },
  });

  return {
    mutate
  }
}

