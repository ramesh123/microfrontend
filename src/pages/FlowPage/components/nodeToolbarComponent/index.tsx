import { memo, useCallback, useMemo, useState } from "react";
import { ToolbarButton } from "./components/toolbar-button";
import { Select, SelectTrigger, SelectContentWithoutPortal, SelectItem } from "@/components/ui/select-custom";
import ShadTooltip from "@/components/common/shadTooltipComponent";
import { Button } from "@/components/ui/button";
import ToolbarSelectItem from "./toolbarSelectItem";
import ForwardedIconComponent from "@/components/common/genericIconComponent";
import { useNodeStore } from "@/stores/nodeStore";
import { useSheetStore } from "@/stores/sheetStore";
import useFlowStore from "@/stores/flowStore";
import { toast } from "sonner";
import useSourceNodes from "@/hooks/use-source-nodes";
import { saveNodeDetailsApi } from "@/controllers/API";
import { AlgoNodeData } from "@/types/flow";
import { buildReconciliationCarryOverExecutePayload, createNodeOutputWithUniqueId, getNodeOutputData, hydrateNodeOutputAfterExecution } from '@/utils/nodeDataUtils';
import { normalizeWorkflowNodeId } from "../../../../utils/workflowNodeId";
import {
  getUpstreamDisplayNameForPayload,
  shouldBuildKeyedDataframeForExcelWrite,
} from "@/utils/transformTemplate";


export const NodeToolbarComponent = memo(({ minimized, setMinimized }: { minimized: boolean, setMinimized: (value: boolean) => void }) => {

  const sheetStore = useSheetStore((state) => state);
  const nodeStore = useNodeStore((state) => state);
  const { sourceNodes }: any = useSourceNodes();

  const handleButtonClick = () => {
    console.log("handleButtonClick");
  }

  const handleToggle = useCallback(() => {
    setMinimized(!minimized);
  }, [minimized, setMinimized]);

  const onNodeClick = useCallback((event: React.MouseEvent, node: AlgoNodeData) => {
    const nodes = useFlowStore.getState().currentWorkflow?.data?.nodes;
    const nodeData = nodes.find((n) => n.id === node?.current_node_id || n.id === node?.id);
    nodeStore.setSelectedNode(nodeData);
    useFlowStore.getState().setCurrentNodeId(nodeData?.id);
    sheetStore.setIsOpen(true);
  }, []);

  const [selectedValue, setSelectedValue] = useState(null);

  const handleSelectChange = useCallback(
    (event: string) => {
      setSelectedValue(event);
      switch (event) {
        case "save":
          break;
        case "duplicate":
          break;
        case "expand":
          setMinimized(false);
          break;
        case "minimize":
          setMinimized(true);
          break;
        case "delete":
          break;
      }
    },
    [setMinimized],
  );

  const onClickExecute = useCallback(async (event: React.MouseEvent, node: AlgoNodeData) => {
    const nodes = useFlowStore.getState().currentWorkflow?.data?.nodes;
    const currentWorkflow = useFlowStore.getState().currentWorkflow;
    const flow_id = currentWorkflow?.flow_id || '';
    const targetId = node?.current_node_id ?? node?.id;
    const nodeData: any = nodes.find((n: any) => n.id === targetId);

    // return;

    if (!nodeData?.data?.saved_node) {
      return toast.error("Node not saved. Please save the node configuration first.");
    }

    if (nodeData?.data?.saved_node) {
      let payload: any;
      const basePayload = nodeData.data.node.payload;

      // Special payload handling for the merge node
      if (nodeData.data.node_id === 'merge') {
        const sourceName = basePayload.source_name;
        const targetName = basePayload.target_name;

        // Find the full source and target nodes from the available sourceNodes
        const sourceNode = sourceNodes.find((n: any) => n.id === sourceName);
        const targetNode = sourceNodes.find((n: any) => n.id === targetName);

        // Validate that both source and target nodes have been executed and have output data or unique_id
        const sourceHasOutput = sourceNode?.data?.node?.output?.unique_id || sourceNode?.data?.node?.output?.data;
        const targetHasOutput = targetNode?.data?.node?.output?.unique_id || targetNode?.data?.node?.output?.data;
        
        if (!sourceHasOutput || !targetHasOutput) {
          toast.error("Please execute the source and target nodes first to provide data for the merge.");
          return; // Stop execution if data is missing
        }

        // Fetch actual data if using unique_id
        const sourceData = await getNodeOutputData(sourceNode, flow_id);
        const targetData = await getNodeOutputData(targetNode, flow_id);

        // Construct the specific payload for the merge action
        payload = {
          ...basePayload,
          current_node_id: targetId,
          flow_id: currentWorkflow?.flow_id,
          response_type: "json",
          source_data: JSON.stringify(sourceData),
          target_data: JSON.stringify(targetData),
        };
        // Ensure the old dataframe key is not sent to avoid confusion
        delete payload.dataframe;

      }
      else if (nodeData.data.node_id === 'concat') {
        payload = {
          ...basePayload,
          current_node_id: targetId,
          flow_id: currentWorkflow?.flow_id,
          response_type: "json",
        };
        delete payload.dataframe;
      }

      else if (nodeData?.data?.node_id === "nway_validation") {
        payload = {
          ...basePayload,
          current_node_id: targetId,
          flow_id: currentWorkflow?.flow_id,
          response_type: "json",
        };
        delete payload.dataframe;
      } else if (nodeData?.data?.node_id === "multisource_validation") {
        payload = {
          ...basePayload,
          current_node_id: targetId,
          flow_id: currentWorkflow?.flow_id,
          response_type: "json",
        };
        delete payload.dataframe;
      }
      else if (
        ["report", "final_report"].includes(normalizeWorkflowNodeId(nodeData?.data?.node_id))
      ) {
        payload = {
          ...basePayload,
          current_node_id: targetId,
          flow_id: currentWorkflow?.flow_id,
          response_type: "json",
        };
        delete payload.dataframe;
      } else if (nodeData?.data?.node_id === "reporting") {
        // For reporting nodes, use the dataframe from the node's payload (already constructed correctly)
        payload = {
          ...basePayload,
          current_node_id: targetId,
          flow_id: currentWorkflow?.flow_id,
          response_type: "json",
        };
      } else if (nodeData?.data?.node_id === "reconciliation_carryover") {
        const directUpstream = useFlowStore
          .getState()
          .getUpstreamNodes(String(targetId));
        const carryOverResult = await buildReconciliationCarryOverExecutePayload(
          basePayload,
          flow_id,
          {
            nodes: nodes ?? [],
            directUpstreamNodes: directUpstream,
            allUpstreamNodes: useFlowStore.getState().getAllUpstreamNodes(String(targetId)),
          },
        );

        if (carryOverResult.ok === false) {
          toast.error(carryOverResult.error);
          return;
        }

        payload = {
          ...carryOverResult.payload,
          current_node_id: targetId,
          flow_id: currentWorkflow?.flow_id,
        };
      } else if (
        shouldBuildKeyedDataframeForExcelWrite(
          nodeData?.data?.node_id,
          basePayload?.mode,
          useFlowStore.getState().getUpstreamNodes(String(targetId)).length
        )
      ) {
        const upstreamNodes = useFlowStore
          .getState()
          .getUpstreamNodes(String(targetId));
        const dataframeKeyed: Record<string, string> = {};
        for (const sourceNode of upstreamNodes) {
          const nodeDisplayName = getUpstreamDisplayNameForPayload(sourceNode);
          const outputData = await getNodeOutputData(sourceNode, flow_id);
          dataframeKeyed[nodeDisplayName] = JSON.stringify(outputData ?? []);
        }
        payload = {
          ...basePayload,
          current_node_id: targetId,
          flow_id: currentWorkflow?.flow_id,
          response_type: "json",
          dataframe: dataframeKeyed,
        };
      }
      else {
        // Fallback to the original logic for all other nodes
        // Fetch data if using unique_id
        const upstreamNode = sourceNodes[0];
        const sourceData = upstreamNode ? await getNodeOutputData(upstreamNode, flow_id) : [];
        payload = {
          ...basePayload,
          current_node_id: targetId,
          flow_id: currentWorkflow?.flow_id,
          response_type: "json",
          dataframe: JSON.stringify(sourceData),
        };
        if (
          nodeData.data.node_id === 'csv' &&
          String(basePayload?.mode ?? '').toLowerCase() === 'write' &&
          upstreamNode
        ) {
          const upstreamUid = upstreamNode?.data?.node?.output?.unique_id;
          if (upstreamUid) {
            payload.previous_unique_id = upstreamUid;
          }
        }
      }
      let endPoint: any = nodeData?.data?.node?.get_data || nodeData?.data?.node?.save_node;
      const isGetDataEndpoint = !!nodeData?.data?.node?.get_data;
      try {
        //wraping inside payload and adding node_id and flow_id inside the payload
        const requestBody = isGetDataEndpoint
          ? { payload: { ...payload, node_id: targetId, flow_id } }
          : { ...payload, node_id: targetId, flow_id };
        const response = await saveNodeDetailsApi(endPoint, requestBody);
        if (response.status) {
          const nodeOutput = await hydrateNodeOutputAfterExecution(
            flow_id,
            targetId.toString(),
            response
          );

          nodeData.data.node = {
            ...nodeData?.data?.node,
            output: nodeOutput,
          }
          const updatedNodes = nodes.map((n) =>
            n.id === targetId ? { ...n, data: { ...n.data, node: nodeData.data.node } } : n
          );

          // useFlowStore.getState().setNodes(updatedNodes);
          toast.success("Node executed successfully");
        } else {
          // Handle cases where the API returns a non-success status
          // toast.error(response.message || "Failed to execute node.");
        }
      } catch (error) {
        toast.error("An error occurred. Please check if the source node has been executed.");
      }
    }
  }, [sourceNodes]);

  const renderToolbarButtons = useMemo(() => {
    return (
      <>
        {
          true ? (
            <>
              <ToolbarButton
                className="text-blue-600 hover:bg-blue-400"
                icon="Settings"
                onClick={(event, data) => onNodeClick(event, data)}
                label=""
                dataTestId="node-toolbar-settings-button"
                node={nodeStore.selectedNode}
              />

              <ToolbarButton
                className="text-blue-600 hover:bg-blue-400"
                icon="play"
                onClick={(event, data) => onClickExecute(event, data)}
                label=""
                dataTestId="node-toolbar-execute-button"
              />

              <ToolbarButton
                className="text-red-500 hover:bg-red-400"
                icon="trash2"
                onClick={() => {}}
                label=""
                dataTestId="node-toolbar-delete-button"
              />

               <ToolbarButton
                className="text-green-500 hover:bg-green-400"
                icon="expand"
                onClick={() => handleToggle()}
                label=""
                dataTestId="node-toolbar-expand-button"
              />

            </>
          ) : null
        }
      </>
    )
  }, [minimized, handleToggle]);

  return (
    <>
      <div className="noflow nopan nodelete nodrag">
        <div className="toolbar-wrapper">
          {renderToolbarButtons}
          <Select
              onValueChange={handleSelectChange}
              value={selectedValue}
              onOpenChange={() => {}}
            >
              <SelectTrigger className="inline w-auto">
                <ShadTooltip content="Show More" side="top">
                  <div data-testid="more-options-modal">
                    <Button
                      className="node-toolbar-buttons !focus-visible:ring-0"
                      variant="ghost"
                      onClick={handleButtonClick}
                      size="node-toolbar"
                      asChild
                    >
                      <ForwardedIconComponent
                        name="more-vertical"
                        className="h-7 w-7 font-bold text-primary hover:bg-primary/60 hover:text-primary-foreground"
                      />
                    </Button>
                  </div>
                </ShadTooltip>
              </SelectTrigger>
              <SelectContentWithoutPortal
                className={"relative top-1 bg-background"}
              >
                <SelectItem value={"save"}>
                  <ToolbarSelectItem
                    value={"Save"}
                    icon={"SaveAll"}
                    dataTestId="save-button-modal"
                  />
                </SelectItem>

                <SelectItem value={"duplicate"}>
                  <ToolbarSelectItem
                    value={"Duplicate"}
                    icon={"Copy"}
                    dataTestId="duplicate-button-modal"
                  />
                </SelectItem>

                <SelectItem value={minimized ? "expand" : "minimize"}>
                  <ToolbarSelectItem
                    value={minimized ? "Expand" : "Minimize"}
                    icon={minimized ? "Expand" : "Minimize"}
                    dataTestId="expand-minimize-button-modal"
                  />
                </SelectItem>

                <SelectItem value={"delete"} className="focus:bg-red-400/[.20]">
                  <div className="flex text-red-500">
                    <ForwardedIconComponent
                      name="Trash2"
                      className="relative top-0.5 mr-2 h-4 w-4"
                    />{" "}
                    <span className="">Delete</span>{" "}
                  </div>
                </SelectItem>
              </SelectContentWithoutPortal>
            </Select>
        </div>
      </div>
    </>
  )
})

NodeToolbarComponent.displayName = "NodeToolbarComponent";

export default NodeToolbarComponent;