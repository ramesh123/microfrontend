import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Expand } from "lucide-react";

import { WorkflowPerformanceChart } from "./workflowperformance";
import { ExceptionDistributionChart } from "./Exceptiongraph";
import { TabType, getTabTitle } from "./utils/util";

export function TeamList() {
  const [activeTab, setActiveTab] = useState<TabType>("runcycle");
  const [isExpanded, setIsExpanded] = useState(false);
const tabcss = "relative px-2 pb-1 text-sm  hover:cursor-pointer font-medium text-gray-500 data-[state=active]:text-blue-600 data-[state=active]:font-semibold bg-white"+
"  data-[state=active]:bg-transparent data-[state=active]:border-none data-[state=active]:shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 after:absolute after:left-0 after:bottom-0 after:h-[2px] after:w-full after:bg-blue-600 after:scale-x-0 after:transition-transform after:duration-300 data-[state=active]:after:scale-x-100";
  return (
    <>
      <Card className="w-full h-75  rounded-lg border-t bg-card shadow-sm hover:shadow-md transition-transform transform hover:-translate-y-0.5 focus-within:shadow-md focus-within:ring-1 focus-within:ring-ring outline-none px-0 py-0 gap-0">
        <CardContent >
            <Tabs value={activeTab} onValueChange={(val: TabType) => setActiveTab(val)}>
                <div className="flex items-center justify-between border-b pb-1 bg-white">
              <TabsList className="flex gap-4 bg-white">
                {/* <TabsTrigger value="performance" className={tabcss}>Performance</TabsTrigger> */}
                <TabsTrigger value="runcycle" className={tabcss}>Run Cycle</TabsTrigger>
                <TabsTrigger value="exceptioncount" className={tabcss}>Exception Count</TabsTrigger>
                {/* <TabsTrigger value="feedbacks" className={tabcss}>Feedbacks</TabsTrigger> */}
              </TabsList>
              {/* Single expand button */}
            <Button
              onClick={() => setIsExpanded(true)}
              variant="ghost"
              className="ml-4"
            >
              <Expand className="h-5 w-5" />
            </Button>
              </div>

              <TabsContent value="performance">
                {/* <WorkflowPerformanceChart /> */}
              </TabsContent>
              <TabsContent value="runcycle">
                <WorkflowPerformanceChart />
              </TabsContent>
              <TabsContent value="exceptioncount">
                <ExceptionDistributionChart />
              </TabsContent>
              <TabsContent value="feedbacks">
                <div>Feedbacks Content</div>
              </TabsContent>
            </Tabs>
        </CardContent>
      </Card>

      {/* Shared Modal / Expanded Overlay */}
      {isExpanded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Dark background */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsExpanded(false)}
          />

          {/* Modal content */}
          <div className="relative z-10 w-full max-w-4xl p-4 bg-white rounded shadow-lg">
            <div className="flex justify-between items-center mb-7">
              <h3 className="text-lg font-medium px-5">{getTabTitle(activeTab)}</h3>
              <Button onClick={() => setIsExpanded(false)} variant="outline">
                Close
              </Button>
            </div>

            <div className="h-[250px] overflow-auto">
              {activeTab === "performance" && <div> performance content</div>}
              {activeTab === "runcycle" && <WorkflowPerformanceChart hideTitle1 />}
              {activeTab === "exceptioncount" &&  <ExceptionDistributionChart hideTitle />}
              {activeTab === "feedbacks" && <div>Feedbacks Content</div>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
