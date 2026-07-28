import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getNodeDetailsApi } from "@/controllers/API";
import { useFlowsManagerStore } from "@/stores/flowManagerStore";
import { Loader2 } from "lucide-react";
import BottomSheetSetting from "../bottomSheetSetting";
import ForwardedIconComponent from "../genericIconComponent";
import useFlowStore from "@/stores/flowStore";
import { AgGridReact } from "ag-grid-react";
import { ModuleRegistry, AllCommunityModule, themeQuartz } from 'ag-grid-community';
import { useTheme } from "@/context/theme";
import NodeDetailsPage from "@/pages/NodeDetailsPage";
import { useNodeStore } from "@/stores/nodeStore";
ModuleRegistry.registerModules([AllCommunityModule]);


const isNonEmptyObject = (obj: any) => obj && Object.keys(obj).length > 0;

interface SliderComponentProps {
  config: any;
  onClose?: () => void;
}

const BottomSheetComponent = ({ config, onClose }: SliderComponentProps) => {
  const [open, setOpen] = useState(false);
  let { selectedNode }: any = useNodeStore.getState();
  // Column Definitions: Defines & controls grid columns.
  const [colDefs, setColDefs] = useState([]);
  const [rowData, setRowData] = useState([]);
  const currentNodeId = useFlowStore.getState().current_node_id;
  let nodes = useFlowStore.getState().currentWorkflow?.data?.nodes;

  const { theme } = useTheme()


  const executedNodeData = useFlowsManagerStore((state) => state.executedNodeData);
  const { data: nodeDetailsData, isLoading } = useQuery({
    queryKey: ['nodeDetails', config?.node_id],
    queryFn: async () => {
      if (!isNonEmptyObject(config) || !config.node_id) {
        return null;
      }
      const response = await getNodeDetailsApi({ node_id: config.node_id });
      return response.data;
    },
    enabled: Boolean(config?.node_id),
  });

  useEffect(() => {
    let nodes = useFlowStore.getState().currentWorkflow?.data?.nodes;
    const nodeData: any = nodes.find((n: any) => n.id === selectedNode?.id);
    console.log("selectedNode nodes", selectedNode);
    if (nodeData?.data?.node?.output?.columns && nodeData?.data?.node?.output?.data) {
      const columns = nodeData?.data?.node?.output?.columns.map((column: any) => ({
        field: column,
        headerName: column,
      })) || [];
      setColDefs(columns);
      setRowData(nodeData?.data?.node?.output?.data);
    } else {
      setColDefs([]);
      setRowData([]);
    }

    

    // Open the sheet if we have nodeDetailsData from the initial fetch, or if executedNodeData becomes available
    if (nodeData && !open) {
      setOpen(true);      
    }
  }, [open, currentNodeId, selectedNode, nodes]);

  const agTheme = themeQuartz
  .withParams(
    {
      backgroundColor: '#FAFAFA',
      foregroundColor: '#361008CC',
      browserColorScheme: 'light',
    },
    'light-red'
  )
  .withParams(
    {
      backgroundColor: '#141516',
      foregroundColor: '#FFFFFFCC',
      browserColorScheme: 'dark',
    },
    'dark-red'
  );

  useEffect(() => {
    document.body.dataset.agThemeMode = theme === "dark" || theme === "blue-dark-g" ? "dark-red" : "light-red";
  }, [theme]);

    return (
    <Tabs defaultValue="config" className="w-full">
      <div className="flex items-center justify-between">
        <TabsList>
          <TabsTrigger value="config">
            <ForwardedIconComponent name="settings" className="w-4 h-4" />
            <span>Configuration</span>
          </TabsTrigger>
          <TabsTrigger value="data">
            <ForwardedIconComponent name="sheet" className="w-4 h-4" />Data Preview</TabsTrigger>
          <TabsTrigger value="logs">
            <ForwardedIconComponent name="logs" className="w-4 h-4" />Logs Preview</TabsTrigger>
        </TabsList>
        <BottomSheetSetting />
      </div>
      <TabsContent value="config" className="w-full overflow-auto min-h-[100px]">
        {isLoading ? (
          <div className="flex items-center justify-center h-[200px]">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : ( //className="h-4 w-4 justify-center"
          <>
            {
              selectedNode?.id ? (
                <NodeDetailsPage nodeDetailsData={selectedNode || {}} onClose={() => setOpen(false)} />
              ) : (
                <div className="flex items-center justify-center h-[200px]">
                  <div className="flex flex-col gap-4 items-center justify-center">
                    <ForwardedIconComponent name="squareDashedMousePointer" className="w-16 h-16 text-primary/30" />
                    <span className="text-muted-foreground font-normal text-lg">Please Drag Node inside the canvas to open configuration</span>
                </div>
              </div>
            )}
          </>
        )}
      </TabsContent>  
      <TabsContent value="data">
        {isLoading ? (
          <div className="flex items-center justify-center h-[300px]">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          
          <div className="h-[350px] w-full"> 
            <AgGridReact 
              theme={agTheme} 
              rowData={rowData || []} 
              columnDefs={colDefs}
              pagination={true}
              // paginationPageSize={10}
              // paginationAutoPageSize={true}
              // paginationPageSizeSelector={true}
            />
          </div>
        )}
      </TabsContent>
      <TabsContent value="logs" className="w-full overflow-auto min-h-[100px]">  
        
      </TabsContent>
    </Tabs>
  );
};


export default BottomSheetComponent;

