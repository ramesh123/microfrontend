import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ChartsListPage from "@/pages/charts/ChartsListPage";
import DashboardsListPage from "@/pages/Dashboards/DashboardListPage";
import AnalyticsStudioSourceHub from "./AnalyticsStudioSourceHub";
import { AlignHorizontalJustifyCenter } from "lucide-react";

const AnalyticsStudioPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [view, setView] = useState<"lists" | "sources">("lists");
  const [activeTab, setActiveTab] = useState("charts");

  const locationState = location.state as {
    tab?: string;
    view?: string;
    selectedChartTypeId?: string;
  } | null;

  useEffect(() => {
    if (locationState?.view === "sources") {
      setView("sources");
    }
    const tab = locationState?.tab;
    if (tab === "charts" || tab === "dashboards") {
      setActiveTab(tab);
    }
  }, [location.state, locationState?.tab, locationState?.view]);

  const handleCreateChart = useCallback(() => {
    navigate("/analytic-studio/create-chart");
  }, [navigate]);

  const handleCreateDashboard = useCallback(() => {
    navigate("/analytic-studio/dashboards/create");
  }, [navigate]);

  const handleBackToLists = useCallback(() => {
    setView("lists");
  }, []);

  if (view === "sources") {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        <AnalyticsStudioSourceHub
          onBackToLists={handleBackToLists}
          selectedChartTypeId={locationState?.selectedChartTypeId}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* <div className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 pb-2 pt-0 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80"> */}
      <div className=" flex items-center gap-2 px-4 py-0">
        <AlignHorizontalJustifyCenter className="h-4 w-4 text-primary" />

        <p className="text-[16px] font-semibold text-foreground">Analytics Studio</p>
      </div>
      {/* </div> */}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-transparent p-0 h-auto border-b">
          <TabsTrigger
            value="charts"
            className="rounded-none border-0 border-b-2 border-transparent bg-transparent px-4 py-2 shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            Charts
          </TabsTrigger>

          <TabsTrigger
            value="dashboards"
            className="rounded-none border-0 border-b-2 border-transparent bg-transparent px-4 py-2 shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            Dashboards
          </TabsTrigger>
        </TabsList>

        <TabsContent value="charts">
          <ChartsListPage analyticsStudio onCreateNew={handleCreateChart} />
        </TabsContent>

        <TabsContent value="dashboards">
          <DashboardsListPage analyticsStudio onCreateNew={handleCreateDashboard} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AnalyticsStudioPage;
