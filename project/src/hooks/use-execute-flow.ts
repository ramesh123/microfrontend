import { useMutation } from '@tanstack/react-query';
import api from "@/controllers/API/api";
import { toast } from 'sonner';
import { executeApiRequestSilent, getDisplayErrorMessage, resolveApiErrorMessage } from '@/utils/exceptionHelper';

interface ExecuteFlowPayload {
  flow_name: string;
  file_name: string;
  flow_id: string;
  flow_run_id?: string;
  stmtdate: string;
}

const executeFlow = async (payload: ExecuteFlowPayload) => {
  return executeApiRequestSilent(
    () => api.post('/flow-run/run-execution', payload),
    'Flow execution failed',
  );
};

export const useExecuteWorkflow = () => {
  return useMutation({
    mutationFn: executeFlow,
    onSuccess: (data) => {
      if (data?.status === false) {
        toast.error(resolveApiErrorMessage(data, "Flow execution failed."));
        return;
      }
      toast.success(data?.message || "Flow execution started successfully!");
      console.log("Execution API Response:", data);
    },
    onError: (error) => {
      toast.error(getDisplayErrorMessage(error, "Flow execution failed."));
    },
  });
};
