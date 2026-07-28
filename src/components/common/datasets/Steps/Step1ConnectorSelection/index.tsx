// src/components/common/datasets/Steps/Step1ConnectorSelection.tsx
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { getNodesList } from "@/controllers/API/datasetApi";
import { Node, NodeList } from "@/types/dataset";
import { ForwardedIconComponent } from "@/components/common/genericIconComponent";
import DatasetStepLoading from "@/components/common/datasets/DatasetStepLoading";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

// NEW: Redesigned ConnectorNodeCard for a compact, dual-tone aesthetic
const ConnectorNodeCard = ({ node, onNodeSelect, disabled, selected }: { node: Node, onNodeSelect: (node: Node) => void, disabled?: boolean, selected?: boolean }) => {
  return (
    <div
      className={cn(
        "group transition-all duration-200 rounded-lg border bg-card",
        "flex flex-col overflow-hidden",
        disabled ? 'opacity-60 pointer-events-none' : 'cursor-pointer hover:shadow-lg hover:border-primary',
        selected ? 'ring-2 ring-primary' : ''
      )}
      onClick={() => !disabled && onNodeSelect(node)}
    >
      {/* Top Part: Larger Icon */}
      <div className="flex-grow flex items-center justify-center p-2 bg-card transition-colors duration-200 group-hover:bg-accent/50 min-h-20">
        <ForwardedIconComponent
          name={node.icon}
          className="h-10 w-10 text-muted-foreground group-hover:text-primary transition-colors"
        />
      </div>
      {/* Bottom Part: Grey-toned background for text */}
      <div className="p-2 border-t bg-muted/50 text-center">
        <p className="font-semibold text-[14px] text-foreground truncate w-full">
          {node.display_name}
        </p>
        <p className="text-xs text-muted-foreground capitalize">
          {node.group}
        </p>
      </div>
    </div>
  );
};

interface Step1ConnectorSelectionProps {
  onNodeSelect: (node: Node) => void;
  disabled?: boolean;
  initialSelectedNode?: Node | null;
}

const Step1ConnectorSelection = ({ onNodeSelect, disabled = false, initialSelectedNode = null }: Step1ConnectorSelectionProps) => {
  const [nodes, setNodes] = useState<NodeList>({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const location = useLocation();
  const isVirtualDb = /virtual[- ]?db/i.test(location.pathname);

  useEffect(() => {  
    setIsLoading(true);
    const isVirtualDb = /virtual[- ]?db/i.test(location.pathname);
    const groups = isVirtualDb ? ["Databases"] : ["Databases", "Files"];

    getNodesList({ group: groups })
      .then(setNodes)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [location.pathname]);

  const filteredNodes = Object.entries(nodes).reduce(
    (acc, [group, nodeList]) => {
      const filtered = nodeList.filter((node) =>
        node.display_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      if (filtered.length > 0) {
        acc[group] = filtered;
      }
      return acc;
    },
    {} as NodeList
  );

  return (  
    // NEW: Reduced padding and gap for a more compact layout
    <div className="h-full w-full max-w-7xl mx-auto p-4 space-y-4 overflow-y-auto">
        {/* NEW: Header and search bar on a single line */}
        <div className="flex items-center justify-between">
            <div>
              <h2 className={cn(isVirtualDb ? 'text-[16px]' : 'text-[16px]', 'font-bold text-foreground')}>Select Connector Type</h2>
              <p className="text-muted-foreground text-xs">Choose a source to create your new dataset from.</p>
            </div>
            <div className="relative w-full max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                placeholder="Search connectors..."
                className="pl-9 h-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
        </div>
        
        <div className="space-y-6 pt-2">
          {isLoading ? (
            <DatasetStepLoading message="Loading connectors..." className="min-h-[50vh] w-full" />
          ) : Object.keys(filteredNodes).length > 0 ? (
            Object.entries(filteredNodes).map(([group, nodeList]) => ( 
                // NEW: Removed heavy Card wrapper for a cleaner look
                <div key={group} className="space-y-3">
                    <h3 className="text-[16px] font-semibold px-1">{group}</h3>
                    {/* NEW: Reduced gap in the grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                      {nodeList.map((node) => (
                        <ConnectorNodeCard key={node.node_id} node={node} onNodeSelect={onNodeSelect} disabled={disabled} selected={initialSelectedNode?.node_id === node.node_id} />
                      ))}
                    </div>
                </div>
            ) )
          ) : ( 
            <div className="text-center py-16 text-muted-foreground">
                <p className="font-semibold text-lg">No connectors found</p>
                <p>Your search for "{searchTerm}" did not return any results.</p>
            </div>
          )}
        </div>
    </div>
  );
};

export default Step1ConnectorSelection;