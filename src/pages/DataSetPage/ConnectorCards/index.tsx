import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getNodesList } from "@/controllers/API/datasetApi";
import { Node, NodeList } from "@/types/dataset";
import { ForwardedIconComponent } from "@/components/common/genericIconComponent";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

const ConnectorNodeCard = ({ node }: { node: Node }) => {
  const navigate = useNavigate();
  const handleClick = () =>
    navigate(`/dashboard/datasets/create/${node.node_id}`);

  return (
    <div
      className="group cursor-pointer transition-all duration-200 rounded-lg border border-gray-200 bg-white hover:shadow-md hover:border-blue-300 p-3 flex flex-col items-center gap-2 max-h-[8rem] justify-center"
      onClick={handleClick}
    >
      <div className="h-[3rem] w-[5.5rem] flex items-center justify-center rounded-md bg-gray-50 group-hover:bg-blue-50 transition-colors flex-shrink-0">
        <ForwardedIconComponent
          name={node.icon}
          className="h-[3rem] w-[3rem] text-gray-600 group-hover:text-blue-600 transition-colors"
        />
      </div>
      <div className="flex flex-col items-center text-center w-full">
        <p className="font-medium text-xs text-gray-900 truncate w-full leading-tight">
          {node.display_name}
        </p>
        <p className="text-xs text-gray-500 capitalize leading-tight">
          {node.group}
        </p>
      </div>
    </div>
  );
};

const ConnectorCards = () => {
  const [nodes, setNodes] = useState<NodeList>({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    getNodesList({ group: ["Databases", "Files"] })
      .then(setNodes)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const filteredNodes = Object.entries(nodes).reduce(
    (acc, [group, nodeList]: [string, Node[]]) => {
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
    <div className="h-screen overflow-y-auto bg-gray-50">
      <div className="w-full max-w-7xl mx-auto p-4 space-y-4">
        <header className="space-y-3 bg-white p-4 rounded-lg shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex">
              <Button
                variant="ghost"
                onClick={() => navigate("/datasets")}
                className="pr-4 hover:bg-transparent"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Add Dataset
                </h1>
                <p className="text-gray-600 text-sm">
                  Select a connector to create a new dataset.
                </p>
              </div>
            </div>
            <div className="relative w-full sm:w-auto sm:min-w-[280px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search connectors..."
                className="pl-10 h-9 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </header>

        <div className="space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <Card key={i} className="shadow-sm">
                  <CardHeader className="p-0">
                    <Skeleton className="h-6 w-32" />
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3">
                      {Array.from({ length: 8 }).map((_, j) => (
                        <Skeleton
                          key={j}
                          className="h-[90px] w-full rounded-lg"
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : Object.keys(filteredNodes).length > 0 ? (
            <div className="space-y-4">
              {Object.entries(filteredNodes).map(([group, nodeList]: [string, Node[]]) => (
                <Card
                  key={group}
                  className="shadow-sm p-2 gap-2 border-gray-200"
                >
                  <CardHeader className="p-1 border-gray-100">
                    <CardTitle className="text-lg p-2 font-semibold text-gray-800">
                      {group}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-2">
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-8 gap-10">
                      {nodeList.map((node) => (
                        <ConnectorNodeCard key={node.node_id} node={node} />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-lg shadow-sm">
              <div className="max-w-md mx-auto">
                <div className="h-12 w-12 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                  <Search className="h-6 w-6 text-gray-400" />
                </div>
                <p className="font-semibold text-gray-900 mb-1">
                  No connectors found
                </p>
                <p className="text-gray-500 text-sm">
                  Try adjusting your search term.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConnectorCards;
