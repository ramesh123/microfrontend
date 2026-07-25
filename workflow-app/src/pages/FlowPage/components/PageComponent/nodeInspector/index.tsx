import { memo, useMemo } from 'react';
import useFlowStore from '@/stores/flowStore';
import { Button } from '@/components/ui/button';
import { PanelLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AlgoNodeData } from '@/types/flow';
import { Node } from '@xyflow/react';

// A small component to display a node's basic info
const NodeChip = ({ node }: { node: Node<AlgoNodeData> }) => (
  <div className="flex items-center gap-2 rounded bg-secondary px-2 py-1 text-xs">
    <div
      className="h-2 w-2 rounded-full"
      style={{ backgroundColor: node.data.groupColor }}
    />
    <span className="font-medium text-secondary-foreground">{node.data.display_name}</span>
  </div>
);

const NodeInspectorPanel = () => {
  const currentWorkflow = useFlowStore((state) => state.currentWorkflow);
  const selectedNode = useFlowStore((state) => state.getSelectedNode());
  const getUpstreamNodes = useFlowStore((state) => state.getUpstreamNodes);
  const getDownstreamNodes = useFlowStore((state) => state.getDownstreamNodes);

  const upstreamNodes = useMemo(() => 
    selectedNode ? getUpstreamNodes(selectedNode.id) : [],
    [selectedNode, getUpstreamNodes]
  );

  const downstreamNodes = useMemo(() =>
    selectedNode ? getDownstreamNodes(selectedNode.id) : [],
    [selectedNode, getDownstreamNodes]
  );

  if (!currentWorkflow) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        No workflow loaded.
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-background border-l flex flex-col">
      <div className="p-4 border-b shrink-0">
        <h2 className="text-lg font-bold text-foreground">Inspector</h2>
      </div>
      <div className="flex-1 p-4 overflow-y-scroll space-y-3">
        <div>
          <h3 className="font-bold text-base mb-2">Workflow Details</h3>
          <div className="text-xs bg-secondary p-3 rounded-md overflow-x-auto text-secondary-foreground space-y-1">
            <p><strong>Name:</strong> {currentWorkflow.name}</p>
            <p><strong>ID:</strong> {currentWorkflow.workflow_id}</p>
            <p><strong>Viewport:</strong></p>
            <ul className="pl-4">
                <li>x: {currentWorkflow.data.viewport.x.toFixed(2)}</li>
                <li>y: {currentWorkflow.data.viewport.y.toFixed(2)}</li>
                <li>zoom: {currentWorkflow.data.viewport.zoom.toFixed(2)}</li>
            </ul>
          </div>
        </div>

        {selectedNode ? (
          <>
            <div>
              <h3 className="font-bold text-base mb-2">Selected Node: {selectedNode.data.display_name}</h3>
              <pre className="text-xs bg-secondary p-3 rounded-md overflow-x-auto text-secondary-foreground">
                {JSON.stringify(selectedNode.data, null, 2)}
                {/* <br/>
                {JSON.stringify(selectedNode.data.type, null, 2)}
                <br/>
                {JSON.stringify(selectedNode.data.display_name, null, 2)}
                <br/>
                {JSON.stringify(selectedNode.data.show_node, null, 2)}
                <br/>
                {JSON.stringify(selectedNode.data.node_type, null, 2)}
                <br/>
                {JSON.stringify(selectedNode.data.groupColor, null, 2)} */}
              </pre>
            </div>
            
            <div>
              <h4 className="font-semibold text-sm mb-2">Upstream (Inputs)</h4>
              <div className="flex flex-wrap gap-2">
                {upstreamNodes.length > 0 ? (
                  upstreamNodes.map(node => <NodeChip key={node.id} node={node} />)
                ) : (
                  <p className="text-xs text-muted-foreground">No upstream nodes.</p>
                )}
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-sm mb-2">Downstream (Outputs)</h4>
              <div className="flex flex-wrap gap-2">
                {downstreamNodes.length > 0 ? (
                  downstreamNodes.map(node => <NodeChip key={node.id} node={node} />)
                ) : (
                  <p className="text-xs text-muted-foreground">No downstream nodes.</p>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="text-center text-sm text-muted-foreground mt-8">
            <p>Select a node to inspect its properties and connections.</p>
          </div>
        )}
      </div>
    </div>
  );
};


interface InspectorProps {
    isOpen: boolean;
    onToggle: () => void;
}

export const NodeInspector = memo(({ isOpen, onToggle }: InspectorProps) => {
    return (
        <aside className={cn("bg-background transition-all duration-300", isOpen ? "w-96" : "w-0")}>
            {isOpen ? (
                <NodeInspectorPanel />
            ) : null}
             <div className="absolute top-1/2 -left-4 -translate-y-1/2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onToggle}
                    className="bg-background/80 backdrop-blur-sm rounded-r-none"
                    title={isOpen ? "Close Inspector" : "Open Inspector"}
                >
                    <PanelLeft className={cn("transition-transform", isOpen && "rotate-180")} />
                </Button>
            </div>
        </aside>
    )
})

NodeInspector.displayName = 'NodeInspector';
