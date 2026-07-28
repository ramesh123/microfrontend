import NodeForm from "@/components/common/node-form";
import TestCaseManagement from "@/components/common/testCase";
import DataValidation from "@/components/common/dataValidation";
import enrichColumnsFormData from "../../components/common/enrichColumns/enrichFormData.json";
import EnrichColumns from "../../components/common/enrichColumns";
import cloneDeep from "lodash/cloneDeep";
import { toast } from "sonner";
import { saveNodeDetailsApi } from "@/controllers/API";
import { ApiRequestError, getDisplayErrorMessage } from "@/utils/exceptionHelper";
import { useParams } from "react-router-dom";
import useFlowStore from "@/stores/flowStore";
import { useCallback, useEffect, useState } from "react";
import NWayValidation from "@/components/common/nway-validation";
import ReconciliationCarryOver from "@/components/common/reconciliationCarryOver";
import DataCollector from "@/components/common/dataCollector";
import NWayMatching from "@/components/common/nway-matching";
import ReportingForm from "@/components/common/reporting-form";
import MultiSourceValidation from "@/components/common/multisource-validation";
import RuleConfiguration from "@/pages/RuleConfiguration";
import CustomScripts from "@/components/common/CustomScripts";
import AdvancedVLookup from "@/components/common/advancedvlookup";
import DataEnrichment from "@/components/common/dataenrichment";
import FuzzyMatch from "@/components/common/fuzzy-match";
import { NodeChart } from "@/components/common/charts/nodechart";
import VirtualDB from "@/components/common/virtualdb";
import SubflowView from "@/components/common/subflow";
import type { SubflowSavePayload } from "@/components/common/subflow";
import SubflowEmbeddedViewer from "@/customNodes/GenericNode/components/SubflowEmbeddedViewer";
import { ScrollArea } from "@/components/ui/scroll-area";
import DataQualityReportScreen from "./DataQualityReportScreen";
import FinalReportScreen from "./FinalReportScreen";
import {
  isDeduplicationNodeId,
  isMaskingNodePage,
  normalizeWorkflowNodeId,
} from "../../utils/workflowNodeId";
import Masking from "@/components/common/masking";
import ApiGatewayComposer from "@/components/common/api-gateway";

/** True only for the static report node when `data.node_id` is missing but label is "Report" / `report`. */
function isReportNodePage(
  nodeDetailsData: { data?: any } | null | undefined,
  selectedNode: { data?: any } | null | undefined
): boolean {
  const id =
    nodeDetailsData?.data?.node_id ??
    nodeDetailsData?.data?.node?.node_id ??
    selectedNode?.data?.node_id ??
    selectedNode?.data?.node?.node_id;
  if (id === "report") return true;
  if (id != null && id !== "") return false;
  const slug = (label: string | undefined) =>
    label?.trim().toLowerCase().replace(/\s+/g, "_");
  return (
    slug(nodeDetailsData?.data?.display_name) === "report" ||
    slug(nodeDetailsData?.data?.name) === "report" ||
    slug(selectedNode?.data?.display_name) === "report"
  );
}

/** Matches Final Report node including API variants and display name fallback. */
function isFinalReportNodePage(
  nodeDetailsData: { data?: any } | null | undefined,
  selectedNode: { data?: any } | null | undefined
): boolean {
  const raw =
    nodeDetailsData?.data?.node_id ??
    nodeDetailsData?.data?.node?.node_id ??
    selectedNode?.data?.node_id ??
    selectedNode?.data?.node?.node_id;
  const id = normalizeWorkflowNodeId(raw);
  if (id === "final_report") return true;
  if (raw != null && String(raw).trim() !== "") return false;
  const slug = (label: string | undefined) =>
    label?.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return (
    slug(nodeDetailsData?.data?.display_name) === "final_report" ||
    slug(nodeDetailsData?.data?.name) === "final_report" ||
    slug(selectedNode?.data?.display_name) === "final_report"
  );
}

interface NodeDetailsPageProps {
  nodeDetailsData: any;
  onClose: () => void;
   mode?: "view" | "edit";
}


const NodeDetailsPage = ({ nodeDetailsData, onClose , mode}: NodeDetailsPageProps) => {  
  const { id } = useParams();
  let { template } = nodeDetailsData?.data?.node ?? {};
  const selectedNode = useFlowStore.getState().getSelectedNode();
  const [sourceNodes, setSourceNodes] = useState<any>([]);

  

  useEffect(() => {
    if (selectedNode?.id) {
      const sourceNode = useFlowStore.getState().getUpstreamNodes(selectedNode.id);
      setSourceNodes(sourceNode);
    }
   }, [selectedNode]);

  const initialFormValues = Object.fromEntries( 
    template
      ? Object.entries(template).map(([key, value]: any) => [
          key,
          value.value || "",
        ])
      : []
  );
  const handleReconciliationCarryOverSaveComplete = () => {
    // The ReconciliationCarryOver component handles showing the success toast.
    // We keep the sheet open by doing nothing here.
  };

  const handleDataCollectorSaveComplete = () => {
    // The DataCollector component handles showing the success toast.
    // We keep the sheet open by doing nothing here.
  };


  const [formValues, setFormValues] = useState(initialFormValues);
  const handleSheetClose = () => {
    onClose?.();
  };

  const handleSubflowSave = useCallback(async (payload: SubflowSavePayload) => {
    const finalRequestBody = cloneDeep(nodeDetailsData);
    finalRequestBody.data.current_node_id = selectedNode?.id;
    finalRequestBody.data.name = nodeDetailsData.data.display_name;
    finalRequestBody.data.flow_id = useFlowStore.getState().currentWorkflow?.flow_id || id;

    if (finalRequestBody?.data?.node) {
      finalRequestBody.data.node.payload = {
        ...finalRequestBody.data.node.payload,
        ...payload,
        key: "on-submit",
      };
    }

    const saveEndpoint = nodeDetailsData.data.node?.save_node;

    if (saveEndpoint?.module && saveEndpoint?.klass) {
      try {
        const response = await saveNodeDetailsApi(saveEndpoint, finalRequestBody?.data);
        const updatedData = {
          ...response,
          node: {
            ...response.node,
            payload: { ...finalRequestBody.data.node.payload },
          },
          saved_node: true,
          subflow_config_locked: true,
        };
        useFlowStore.getState().updateNodeData(selectedNode?.id, updatedData);
        toast.success("Subflow configuration saved successfully.");
      } catch (error) {
        if (!(error instanceof ApiRequestError)) {
          toast.error(getDisplayErrorMessage(error, "Failed to save subflow configuration."));
        }
      }
    } else {
      const updatedData = {
        ...finalRequestBody.data,
        node: {
          ...finalRequestBody.data.node,
          payload: { ...finalRequestBody.data.node.payload },
        },
        saved_node: true,
        subflow_config_locked: true,
      };
      useFlowStore.getState().updateNodeData(selectedNode?.id, updatedData);
      toast.success("Subflow configuration saved successfully.");
    }
  }, [nodeDetailsData, selectedNode, id]);

  const handleSubflowUnlock = useCallback(() => {
    if (!selectedNode?.id) return;
    useFlowStore.getState().updateNodeData(selectedNode.id, {
      ...selectedNode.data,
      subflow_config_locked: false,
    });
  }, [selectedNode]);

  const handleSubflowLock = useCallback(() => {
    if (!selectedNode?.id) return;
    useFlowStore.getState().updateNodeData(selectedNode.id, {
      ...selectedNode.data,
      subflow_config_locked: true,
    });
  }, [selectedNode]);

  /** Re-lock subflow config and close. Used when user cancels or closes without saving. */
  const handleSubflowCancel = useCallback(() => {
    if (selectedNode?.id && selectedNode?.data?.node_id === 'subflow_view') {
      useFlowStore.getState().updateNodeData(selectedNode.id, {
        ...selectedNode.data,
        subflow_config_locked: true,
      });
    }
    onClose?.();
  }, [selectedNode, onClose]);

  const handleMergeNodeSave = async (enrichData: any) => { 
    console.log('handleMergeNodeSave called with enrichData:', enrichData);
    console.log('source_extra_columns:', enrichData.source_extra_columns);
    
    const finalRequestBody = cloneDeep(nodeDetailsData);
    const updatedPayload = { 
      ...enrichData,
      key: "on-submit",
    };
    // if (updatedPayload.target_name === "{{target_name}}") {
    //     updatedPayload.target_name = "";
    // }

    if (updatedPayload.target_extra_columns === "{{target_extra_columns}}") { 
      updatedPayload.target_extra_columns = [];
    }
    
    if (finalRequestBody?.data?.node?.payload) { 
      Object.entries(finalRequestBody?.data?.node?.payload).forEach(
        ([key, value]) => { 
          if (typeof value === "string") { 
            const match = value.match(/^{{(.*?)}}$/);
            if (match) { 
              const formKey = match[1] || value; 
              if (enrichData[formKey] !== undefined) { 
                finalRequestBody.data.node.payload[key] = enrichData[formKey];
              } else {
                finalRequestBody.data.node.payload[key] = "";
              }
            }
          }
        }
      );
      
      // Also copy all enrichData fields that exist to ensure source_extra_columns is saved
      Object.keys(enrichData).forEach((key) => {
        finalRequestBody.data.node.payload[key] = enrichData[key];
      });
      
      console.log('Final payload after update:', finalRequestBody.data.node.payload);
      console.log('Final source_extra_columns:', finalRequestBody.data.node.payload.source_extra_columns);
    }

    // finalRequestBody.data.node.payload = updatedPayload
    (finalRequestBody.data.current_node_id = selectedNode?.id),
      (finalRequestBody.data.name = nodeDetailsData.data.display_name);
    finalRequestBody.data.flow_id = useFlowStore.getState().currentWorkflow?.flow_id || id;
    let targetData: any = useFlowStore.getState().getNode(enrichData.target_name);
    let sourceData: any = useFlowStore.getState().getNode(enrichData.source_name);
    targetData = targetData?.data?.node?.output?.data;
    sourceData = sourceData?.data?.node?.output?.data;
    finalRequestBody.data.node.payload['target_data'] = JSON.stringify(targetData);
    finalRequestBody.data.node.payload['source_data'] = JSON.stringify(sourceData);
    try {  // saveNodeDetailsApi is a function that saves
      const response = await saveNodeDetailsApi(  
        nodeDetailsData.data.node?.save_node,
        finalRequestBody?.data
      );

      useFlowStore.getState().updateNodeDataPreserveLabel(selectedNode?.id, response);
      toast.success("Merge node configuration saved successfully.");
    } catch (error) {
      if (!(error instanceof ApiRequestError)) {
        toast.error(getDisplayErrorMessage(error, "Failed to save merge node configuration."));
      }
    }
  };

  return ( 
    <div>
      {nodeDetailsData &&
        (nodeDetailsData.data.node_id !== "data_validation" &&
        nodeDetailsData.data.node_id !== "test_automation" &&
        nodeDetailsData.data.node_id !== "nway_validation" &&
        nodeDetailsData.data.node_id !== "nway_matching" &&
        nodeDetailsData.data.node_id !== "reconciliation_carryover" &&
        nodeDetailsData.data.node_id !== "data_collector" &&
        nodeDetailsData.data.node_id !== "reporting" &&
        nodeDetailsData.data.node_id !== "report" &&
        !isFinalReportNodePage(nodeDetailsData, selectedNode) &&
        !isReportNodePage(nodeDetailsData, selectedNode) &&
        nodeDetailsData.data.node_id !== "multisource_validation" &&
        nodeDetailsData.data.node_id !== "validation" &&
        nodeDetailsData.data.node_id !== "merge" &&
        nodeDetailsData.data.node_id !== "advanced-vlookup" &&
        nodeDetailsData.data.node_id !== "charts" &&
        nodeDetailsData.data.node_id !=="virtual_db"&& 
        nodeDetailsData.data.node_id !=="subflow_view"&&
        nodeDetailsData.data.node_id !== "pipeline_reference" &&
        nodeDetailsData.data.node_id !== "data_enrichment" &&
        nodeDetailsData.data.node_id !== "api_gateway" &&
        !isMaskingNodePage(nodeDetailsData) &&
        !isDeduplicationNodeId(nodeDetailsData.data.node_id) &&
        nodeDetailsData.data.node_id !== "custom_scripts" ? ( 
          <NodeForm
          template={nodeDetailsData.data.node?.template}
          onClose={handleSheetClose}
          nodeData={nodeDetailsData}
          saveApiEndpoint={nodeDetailsData.data.node?.save_node}
          disabled={mode === "view"}
        />
      ) : nodeDetailsData.data.node_id === "test_automation" ? (
        <TestCaseManagement mode={mode}  />
      ) : nodeDetailsData.data.node_id === "data_validation" &&
        nodeDetailsData.data.name === "Data Validation" ? (
        <div className="flex min-h-0 w-full flex-1 flex-col">
          <DataValidation mode={mode} onClose={onClose} />
        </div>
      ) : nodeDetailsData.data.node_id === "nway_validation" &&
        nodeDetailsData.data.name === "NWay Validation" ? (
        <NWayValidation  mode={mode}/>
      )  : nodeDetailsData.data.node_id === "nway_matching" &&
        nodeDetailsData.data.name === "NWay Matching" ? (
        <NWayMatching mode={mode} />
      )  : nodeDetailsData.data.node_id === "reconciliation_carryover" &&
        nodeDetailsData.data.name === "Reconciliation CarryOver" ? (
        <ReconciliationCarryOver
          nodeDetailsData={nodeDetailsData}
          onSave={handleReconciliationCarryOverSaveComplete}
          onCancel={handleSheetClose}
          flowId={id}
          mode={mode}
        />
      )  : nodeDetailsData.data.node_id === "data_collector" &&
        nodeDetailsData.data.name === "Data Collector" ? (
        <DataCollector
          nodeDetailsData={nodeDetailsData}
          onSave={handleDataCollectorSaveComplete}
          onCancel={handleSheetClose}
          flowId={id}
          mode={mode}
        />
      ) : isFinalReportNodePage(nodeDetailsData, selectedNode) ? (
        <div className="flex h-full min-h-[70vh] w-full min-w-0 flex-1 flex-col">
          <FinalReportScreen />
        </div>
      ) : nodeDetailsData.data.node_id === "report" || isReportNodePage(nodeDetailsData, selectedNode) ? (
        <div className="flex h-full min-h-[70vh] w-full min-w-0 flex-1 flex-col">
          <DataQualityReportScreen />
        </div>
      ) : nodeDetailsData.data.node_id === "reporting" ? (
        <ReportingForm
          nodeData={nodeDetailsData}
          onSave={(data) => {
            console.log('Reporting form data:', data);
            // Add save logic here
            toast.success("Reporting configuration saved successfully.");
          }}
          onCancel={handleSheetClose}
          mode={mode}
        />
      ) : nodeDetailsData.data.node_id === "multisource_validation" ? (
        <MultiSourceValidation flowId={id} />
      ) : nodeDetailsData.data.node_id === "validation" ? (
        <RuleConfiguration onClose={onClose} />
      ) : nodeDetailsData.data.node_id === "custom_scripts" ? (
        <CustomScripts />
      ) : nodeDetailsData.data.node_id === "data_enrichment" ? (
        <DataEnrichment
          nodeDetailsData={nodeDetailsData}
          onClose={handleSheetClose}
          mode={mode}
        />
      ) : nodeDetailsData.data.node_id === "api_gateway" ? (
        <ApiGatewayComposer
          nodeDetailsData={nodeDetailsData}
          onClose={handleSheetClose}
          mode={mode}
        />
      ) : isMaskingNodePage(nodeDetailsData) ? (
        <Masking
          nodeDetailsData={nodeDetailsData}
          onClose={handleSheetClose}
          mode={mode}
        />
      ) : isDeduplicationNodeId(nodeDetailsData.data.node_id) ? (
        <FuzzyMatch
          nodeDetailsData={nodeDetailsData}
          onClose={handleSheetClose}
          mode={mode}
        />
      ) : nodeDetailsData.data.node_id === "merge" ? (
          <EnrichColumns
            formData={enrichColumnsFormData}
            nodeData={nodeDetailsData}
            onSave={handleMergeNodeSave}
            onCancel={onClose}
            mode={mode}
          />
        ) : nodeDetailsData.data.node_id === "advanced-vlookup" ? (
          <AdvancedVLookup
            formData={enrichColumnsFormData}
            nodeData={nodeDetailsData}
            onSave={handleMergeNodeSave}
            onCancel={onClose}
            mode={mode}
          />
          
        ) :nodeDetailsData.data.node_id === "charts" ?(
          < NodeChart/>
        ) :nodeDetailsData.data.node_id === "virtual_db" ? (
          <VirtualDB/>
        ) : nodeDetailsData.data.node_id === "pipeline_reference" ? (
          <ScrollArea className="w-full h-[85vh] min-h-[400px]">
            <div className="w-full p-2" style={{ minHeight: '80vh' }}>
              <SubflowEmbeddedViewer
                workflowFlowId={nodeDetailsData.data.pipeline_workflow_id ?? nodeDetailsData.data.node?.payload?.pipeline_workflow_id ?? ''}
                workflowLabel={nodeDetailsData.data.display_name ?? "Pipeline"}
                loadingLabel="Loading workflow..."
                embeddedHeight="78vh"
                selectedWorkflowNodeIds={nodeDetailsData.data.node?.payload?.selectedWorkflowNodeIds ?? []}
                onSelectedNodesChange={(nodeIds) => {
                  const current = useFlowStore.getState().getSelectedNode();
                  if (!current?.id) return;
                  useFlowStore.getState().updateNodeData(current.id, {
                    node: {
                      ...current.data?.node,
                      payload: {
                        ...current.data?.node?.payload,
                        selectedWorkflowNodeIds: nodeIds,
                      },
                    },
                  });
                }}
              />
            </div>
          </ScrollArea>
        ) : nodeDetailsData.data.node_id === "subflow_view" ? (
          <SubflowView
            onSave={handleSubflowSave}
            onCancel={handleSubflowCancel}
            savedConfig={selectedNode?.data?.node?.payload}
            locked={
              !!(selectedNode?.data?.node?.payload?.selectedWorkflowId) &&
              selectedNode?.data?.subflow_config_locked !== false
            }
            onUnlock={handleSubflowUnlock}
            onLock={handleSubflowLock}
          />
         )
        :null)}

    </div>
  );

};

export default NodeDetailsPage;
