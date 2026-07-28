import { useTheme } from "@/context/theme";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  Box,
  TrendingUp,
  Network,
  Info,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  Search,
  Filter,
  Database,
  Table2,
  BarChart3,
  PieChart,
  Activity,
  Calendar,
  Tag,
  Users,
  Star,
  Clock,
  TrendingDown,
  Minus,
  Layers,
  Telescope
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface Dataset {
  id: string;
  name: string;
  description?: string;
  type: "fact" | "dimension" | "aggregate";
  tables: number;
  lastUpdated: string;
  owner: string;
  tags: string[];
}

interface Metric {
  id: string;
  name: string;
  certified: boolean;
  grain?: string;
  source?: string;
  owner?: string;
  description?: string;
  category: "sales" | "finance" | "operations" | "customer";
  trend?: "up" | "down" | "stable";
  value?: string;
  change?: string;
}

interface HierarchyNode {
  id: string;
  name: string;
  type: "zone" | "region" | "area";
  children?: HierarchyNode[];
  expanded?: boolean;
  metrics?: { count: number; primary: string };
}

interface Dimension {
  id: string;
  name: string;
  table: string;
  description: string;
  cardinality: string;
}

export default function Explore() {
  const { theme } = useTheme();
  const [selectedMetric, setSelectedMetric] = useState<Metric | null>(null);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "details" | "lineage">("overview");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [hierarchyData, setHierarchyData] = useState<HierarchyNode[]>([
    {
      id: "south",
      name: "South Zone",
      type: "zone",
      expanded: true,
      metrics: { count: 12, primary: "Revenue" },
      children: [
        {
          id: "ap",
          name: "Andhra Pradesh",
          type: "region",
          expanded: true,
          metrics: { count: 8, primary: "Sales" },
          children: [
            { id: "tenali", name: "Tenali", type: "area", metrics: { count: 5, primary: "Units Sold" } },
            { id: "guntur", name: "Guntur", type: "area", metrics: { count: 6, primary: "Revenue" } },
            { id: "vijayawada", name: "Vijayawada", type: "area", metrics: { count: 7, primary: "Market Share" } }
          ]
        },
        {
          id: "tn",
          name: "Tamil Nadu",
          type: "region",
          expanded: false,
          metrics: { count: 10, primary: "Growth" },
          children: [
            { id: "chennai", name: "Chennai", type: "area", metrics: { count: 8, primary: "Revenue" } },
            { id: "coimbatore", name: "Coimbatore", type: "area", metrics: { count: 6, primary: "Sales" } }
          ]
        }
      ]
    },
    {
      id: "north",
      name: "North Zone",
      type: "zone",
      expanded: false,
      metrics: { count: 15, primary: "Market Share" },
      children: [
        {
          id: "delhi",
          name: "Delhi NCR",
          type: "region",
          expanded: false,
          metrics: { count: 12, primary: "Revenue" },
          children: [
            { id: "delhi-central", name: "Delhi Central", type: "area", metrics: { count: 8, primary: "Sales" } },
            { id: "gurgaon", name: "Gurgaon", type: "area", metrics: { count: 7, primary: "Growth" } }
          ]
        }
      ]
    },
    {
      id: "west",
      name: "West Zone",
      type: "zone",
      expanded: false,
      metrics: { count: 18, primary: "Customer Satisfaction" },
      children: [
        {
          id: "maharashtra",
          name: "Maharashtra",
          type: "region",
          expanded: false,
          metrics: { count: 14, primary: "Revenue" },
          children: [
            { id: "mumbai", name: "Mumbai", type: "area", metrics: { count: 10, primary: "Sales Volume" } },
            { id: "pune", name: "Pune", type: "area", metrics: { count: 8, primary: "Growth Rate" } }
          ]
        }
      ]
    }
  ]);

  const isDark = theme === 'dark' || theme === 'blue-dark' || theme === 'blue-dark-g' || theme === 'purple-dark' || theme === 'orange-dark';

  const datasets: Dataset[] = [
    {
      id: "1",
      name: "Sales Area Performance",
      description: "Regional sales metrics and KPIs",
      type: "fact",
      tables: 3,
      lastUpdated: "2 hours ago",
      owner: "Sales Ops",
      tags: ["sales", "performance", "regional"]
    },
    {
      id: "2",
      name: "Target & Pace",
      description: "Sales targets and achievement tracking",
      type: "aggregate",
      tables: 2,
      lastUpdated: "5 hours ago",
      owner: "Sales Analytics",
      tags: ["targets", "goals"]
    },
    {
      id: "3",
      name: "Product Mix",
      description: "Product category distribution and performance",
      type: "fact",
      tables: 4,
      lastUpdated: "1 day ago",
      owner: "Product Team",
      tags: ["products", "categories"]
    },
    {
      id: "4",
      name: "Customer Demographics",
      description: "Customer segmentation and behavior data",
      type: "dimension",
      tables: 5,
      lastUpdated: "3 hours ago",
      owner: "Customer Insights",
      tags: ["customers", "demographics"]
    },
    {
      id: "5",
      name: "Financial Summary",
      description: "Revenue, profit, and financial KPIs",
      type: "aggregate",
      tables: 6,
      lastUpdated: "30 minutes ago",
      owner: "Finance Team",
      tags: ["finance", "revenue", "profit"]
    },
    {
      id: "6",
      name: "Operations Efficiency",
      description: "Operational metrics and efficiency indicators",
      type: "fact",
      tables: 4,
      lastUpdated: "4 hours ago",
      owner: "Operations",
      tags: ["operations", "efficiency"]
    },
  ];

  const metrics: Metric[] = [
    {
      id: "1",
      name: "Actual Sales (TMT)",
      certified: true,
      grain: "Sales Area, Month",
      source: "fact_sales_area_performance",
      owner: "Sales Ops",
      description: "Total monthly sales by sales area in TMT units",
      category: "sales",
      trend: "up",
      value: "2,450",
      change: "+12.5%"
    },
    {
      id: "2",
      name: "Sales vs Target (%)",
      certified: true,
      grain: "Sales Area, Month",
      source: "fact_sales_area_performance",
      owner: "Sales Ops",
      description: "Percentage comparison of actual sales against targets",
      category: "sales",
      trend: "down",
      value: "94.2%",
      change: "-3.2%"
    },
    {
      id: "3",
      name: "Sales Gap (TMT)",
      certified: true,
      grain: "Sales Area, Month",
      source: "fact_sales_area_performance",
      owner: "Sales Ops",
      description: "Difference between target and actual sales in TMT units",
      category: "sales",
      trend: "down",
      value: "150",
      change: "-18%"
    },
    {
      id: "4",
      name: "Revenue (₹M)",
      certified: true,
      grain: "Month, Region",
      source: "fact_financial_summary",
      owner: "Finance Team",
      description: "Total revenue in millions",
      category: "finance",
      trend: "up",
      value: "₹45.2M",
      change: "+8.3%"
    },
    {
      id: "5",
      name: "Profit Margin (%)",
      certified: true,
      grain: "Month, Product Category",
      source: "fact_financial_summary",
      owner: "Finance Team",
      description: "Net profit margin percentage",
      category: "finance",
      trend: "stable",
      value: "23.4%",
      change: "+0.5%"
    },
    {
      id: "6",
      name: "Customer Acquisition Rate",
      certified: false,
      grain: "Month, Channel",
      source: "fact_customer_metrics",
      owner: "Customer Insights",
      description: "Rate of new customer acquisition",
      category: "customer",
      trend: "up",
      value: "1,245",
      change: "+15%"
    },
    {
      id: "7",
      name: "Churn Rate (%)",
      certified: true,
      grain: "Month",
      source: "fact_customer_metrics",
      owner: "Customer Insights",
      description: "Customer churn rate percentage",
      category: "customer",
      trend: "down",
      value: "5.2%",
      change: "-1.1%"
    },
    {
      id: "8",
      name: "Order Fulfillment Time",
      certified: true,
      grain: "Day, Warehouse",
      source: "fact_operations",
      owner: "Operations",
      description: "Average time to fulfill orders in hours",
      category: "operations",
      trend: "down",
      value: "18.5h",
      change: "-2.3h"
    },
    {
      id: "9",
      name: "Inventory Turnover",
      certified: false,
      grain: "Month, Product",
      source: "fact_operations",
      owner: "Operations",
      description: "Inventory turnover ratio",
      category: "operations",
      trend: "up",
      value: "6.8x",
      change: "+0.9x"
    },
  ];

  const dimensions: Dimension[] = [
    { id: "1", name: "Sales Area", table: "dim_sales_area", description: "Geographic sales regions", cardinality: "High (500+)" },
    { id: "2", name: "Product Category", table: "dim_product", description: "Product categorization hierarchy", cardinality: "Medium (50-100)" },
    { id: "3", name: "Customer Segment", table: "dim_customer", description: "Customer segmentation attributes", cardinality: "Low (10-20)" },
    { id: "4", name: "Time Period", table: "dim_date", description: "Calendar and fiscal time dimensions", cardinality: "High (1000+)" },
    { id: "5", name: "Channel", table: "dim_channel", description: "Sales and distribution channels", cardinality: "Low (5-10)" },
  ];

  const toggleHierarchyNode = (nodeId: string, path: number[] = []) => {
    setHierarchyData(prevData => {
      const newData = JSON.parse(JSON.stringify(prevData));
      let current: HierarchyNode[] = newData;

      for (let i = 0; i < path.length - 1; i++) {
        current = current[path[i]].children || [];
      }

      if (path.length > 0) {
        const lastIndex = path[path.length - 1];
        const node = current[lastIndex];
        if (node && node.id === nodeId) {
          node.expanded = !node.expanded;
        }
      }

      return newData;
    });
  };

  const findNodePath = (nodes: HierarchyNode[], nodeId: string, currentPath: number[] = []): number[] | null => {
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].id === nodeId) {
        return [...currentPath, i];
      }
      if (nodes[i].children) {
        const result = findNodePath(nodes[i].children!, nodeId, [...currentPath, i]);
        if (result) return result;
      }
    }
    return null;
  };

  const renderHierarchyNode = (node: HierarchyNode, depth: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const colorMap = {
      zone: "bg-blue-500",
      region: "bg-green-500",
      area: "bg-cyan-500"
    };

    return (
      <div key={node.id}>
        <div
          className={cn(
            "flex items-center gap-2 py-1.5 px-2 rounded-md transition-colors cursor-pointer group",
            isDark ? "hover:bg-white/5" : "hover:bg-slate-50"
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => {
            if (hasChildren) {
              const path = findNodePath(hierarchyData, node.id);
              if (path) toggleHierarchyNode(node.id, path);
            }
          }}
        >
          {hasChildren ? (
            node.expanded ? (
              <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
            )
          ) : (
            <div className="h-3.5 w-3.5 flex-shrink-0" />
          )}
          <div className={cn("h-2 w-2 rounded-full flex-shrink-0", colorMap[node.type])} />
          <span className="text-sm font-medium flex-1">{node.name}</span>
          {node.metrics && (
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Badge variant="secondary" className={cn("text-xs px-1.5 py-0", isDark ? "bg-white/10" : "bg-slate-100")}>
                {node.metrics.count} metrics
              </Badge>
            </div>
          )}
        </div>
        {hasChildren && node.expanded && (
          <div>
            {node.children!.map((child) => renderHierarchyNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const filteredMetrics = metrics.filter(m =>
    (categoryFilter === "all" || m.category === categoryFilter) &&
    (searchQuery === "" || m.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredDatasets = datasets.filter(d =>
    searchQuery === "" || d.name.toLowerCase().includes(searchQuery.toLowerCase()) || d.tags.some(t => t.includes(searchQuery.toLowerCase()))
  );

  const getTrendIcon = (trend?: string) => {
    if (trend === "up") return <TrendingUp className="h-3.5 w-3.5 text-green-500" />;
    if (trend === "down") return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
    return <Minus className="h-3.5 w-3.5 text-yellow-500" />;
  };

  const getTypeColor = (type: string) => {
    const colors = {
      fact: isDark ? "bg-blue-500/20 text-blue-400" : "bg-blue-50 text-blue-700",
      dimension: isDark ? "bg-purple-500/20 text-purple-400" : "bg-purple-50 text-purple-700",
      aggregate: isDark ? "bg-orange-500/20 text-orange-400" : "bg-orange-50 text-orange-700"
    };
    return colors[type as keyof typeof colors] || colors.fact;
  };

  return (
    <main
      className={cn(
        "flex flex-col w-full h-full min-h-0 p-3",
        isDark ? "bg-[#05070c] text-white" : "bg-slate-50 text-foreground"
      )}
    >
      {/* Header */}
      <div className="flex-shrink-0 mb-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
             <Telescope className="h-4 w-4 text-primary"/>
            <h1 className="text-lg font-semibold">Explore</h1>
           </div>
            <p className={cn("text-xs mt-0.5", isDark ? "text-white/60" : "text-muted-foreground")}>
              Discover datasets, metrics, and semantic definitions
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className={cn(
                  "pl-8 h-8 w-64 text-sm",
                  isDark ? "bg-white/5 border-white/10" : "bg-white"
                )}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 pb-3">
          {/* Left Column - Datasets and Hierarchy */}
          <div className="lg:col-span-1 space-y-3">
            {/* Datasets Section */}
            <div
              className={cn(
                "rounded-lg border p-3",
                isDark ? "bg-[#0d1117] border-white/10" : "bg-white border-slate-200"
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <Database className={cn("h-4 w-4", isDark ? "text-orange-400" : "text-orange-600")} />
                <h2 className="text-sm font-semibold">Datasets</h2>
                <Badge variant="secondary" className={cn("ml-auto text-xs", isDark ? "bg-white/10" : "bg-slate-100")}>
                  {filteredDatasets.length}
                </Badge>
              </div>
              <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                {filteredDatasets.map((dataset) => (
                  <div
                    key={dataset.id}
                    onClick={() => setSelectedDataset(dataset)}
                    className={cn(
                      "p-2 rounded-md transition-colors cursor-pointer group",
                      selectedDataset?.id === dataset.id
                        ? isDark ? "bg-primary/20 border border-primary/30" : "bg-primary/10 border border-primary/20"
                        : isDark ? "hover:bg-white/5" : "hover:bg-slate-50"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <Table2 className="h-4 w-4 flex-shrink-0 mt-0.5 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <p className="text-xs font-medium truncate">{dataset.name}</p>
                          <Badge className={cn("text-[10px] px-1 py-0", getTypeColor(dataset.type))}>
                            {dataset.type}
                          </Badge>
                        </div>
                        <p className={cn("text-[11px] line-clamp-2 mb-1", isDark ? "text-white/50" : "text-slate-500")}>
                          {dataset.description}
                        </p>
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className={cn("flex items-center gap-1", isDark ? "text-white/40" : "text-slate-400")}>
                            <Clock className="h-3 w-3" />
                            {dataset.lastUpdated}
                          </span>
                          <span className={cn("flex items-center gap-1", isDark ? "text-white/40" : "text-slate-400")}>
                            <Users className="h-3 w-3" />
                            {dataset.owner}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Entity Hierarchy Section */}
            <div
              className={cn(
                "rounded-lg border p-3",
                isDark ? "bg-[#0d1117] border-white/10" : "bg-white border-slate-200"
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <Network className={cn("h-4 w-4", isDark ? "text-purple-400" : "text-purple-600")} />
                <h2 className="text-sm font-semibold">Entity Hierarchy</h2>
              </div>
              <p className={cn("text-xs mb-2", isDark ? "text-white/60" : "text-slate-600")}>
                <span className="font-medium">Structure:</span> Zone → Region → Sales Area
              </p>
              <div className="max-h-[400px] overflow-y-auto">
                {hierarchyData.map((node) => renderHierarchyNode(node, 0))}
              </div>
            </div>
          </div>

          {/* Middle Column - Metrics */}
          <div className="lg:col-span-1 space-y-3">
            <div
              className={cn(
                "rounded-lg border p-3",
                isDark ? "bg-[#0d1117] border-white/10" : "bg-white border-slate-200"
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className={cn("h-4 w-4", isDark ? "text-blue-400" : "text-blue-600")} />
                <h2 className="text-sm font-semibold">Metrics</h2>
                <Badge variant="secondary" className={cn("ml-auto text-xs", isDark ? "bg-white/10" : "bg-slate-100")}>
                  {filteredMetrics.length}
                </Badge>
              </div>

              {/* Category Filters */}
              <div className="flex gap-1.5 mb-3 flex-wrap">
                {["all", "sales", "finance", "customer", "operations"].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={cn(
                      "px-2 py-1 rounded-md text-xs font-medium transition-colors",
                      categoryFilter === cat
                        ? "bg-primary text-primary-foreground"
                        : isDark ? "bg-white/5 hover:bg-white/10" : "bg-slate-100 hover:bg-slate-200"
                    )}
                  >
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </button>
                ))}
              </div>

              <div className="space-y-1.5 max-h-[600px] overflow-y-auto">
                {filteredMetrics.map((metric) => (
                  <div
                    key={metric.id}
                    onClick={() => setSelectedMetric(metric)}
                    className={cn(
                      "p-2 rounded-md transition-colors cursor-pointer",
                      selectedMetric?.id === metric.id
                        ? isDark ? "bg-primary/20 border border-primary/30" : "bg-primary/10 border border-primary/20"
                        : isDark ? "hover:bg-white/5" : "hover:bg-slate-50"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <p className="text-xs font-medium">{metric.name}</p>
                          {metric.certified && (
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold">{metric.value}</span>
                          {getTrendIcon(metric.trend)}
                          <span className={cn(
                            "text-xs font-medium",
                            metric.trend === "up" ? "text-green-500" : metric.trend === "down" ? "text-red-500" : "text-yellow-500"
                          )}>
                            {metric.change}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Badge className={cn(
                            "text-[10px] px-1.5 py-0",
                            metric.category === "sales" ? "bg-blue-500/20 text-blue-400" :
                            metric.category === "finance" ? "bg-green-500/20 text-green-400" :
                            metric.category === "customer" ? "bg-purple-500/20 text-purple-400" :
                            "bg-orange-500/20 text-orange-400"
                          )}>
                            {metric.category}
                          </Badge>
                          {metric.certified && (
                            <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0", isDark ? "bg-green-500/20 text-green-400" : "bg-green-50 text-green-700")}>
                              Certified
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - Details */}
          <div className="lg:col-span-1 space-y-3">
            {/* Metric/Dataset Details */}
            {(selectedMetric || selectedDataset) && (
              <div
                className={cn(
                  "rounded-lg border p-3",
                  isDark ? "bg-[#0d1117] border-white/10" : "bg-white border-slate-200"
                )}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Info className={cn("h-4 w-4", isDark ? "text-blue-400" : "text-blue-600")} />
                  <h2 className="text-sm font-semibold">
                    {selectedMetric ? "Metric Details" : "Dataset Details"}
                  </h2>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 mb-3">
                  {["overview", "details", "lineage"].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab as any)}
                      className={cn(
                        "px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex-1",
                        activeTab === tab
                          ? "bg-primary text-primary-foreground"
                          : isDark ? "bg-white/5 hover:bg-white/10" : "bg-slate-100 hover:bg-slate-200"
                      )}
                    >
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  ))}
                </div>

                {/* Content */}
                {activeTab === "overview" && selectedMetric && (
                  <div className="space-y-3">
                    <div>
                      <p className={cn("text-xs font-medium mb-1", isDark ? "text-white/60" : "text-slate-500")}>
                        Name
                      </p>
                      <p className="text-sm font-semibold">{selectedMetric.name}</p>
                    </div>
                    {selectedMetric.description && (
                      <div>
                        <p className={cn("text-xs font-medium mb-1", isDark ? "text-white/60" : "text-slate-500")}>
                          Description
                        </p>
                        <p className="text-sm">{selectedMetric.description}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div className={cn("p-2 rounded-lg", isDark ? "bg-white/5" : "bg-slate-50")}>
                        <p className={cn("text-xs mb-1", isDark ? "text-white/60" : "text-slate-500")}>
                          Current Value
                        </p>
                        <p className="text-lg font-bold">{selectedMetric.value}</p>
                      </div>
                      <div className={cn("p-2 rounded-lg", isDark ? "bg-white/5" : "bg-slate-50")}>
                        <p className={cn("text-xs mb-1", isDark ? "text-white/60" : "text-slate-500")}>
                          Change
                        </p>
                        <div className="flex items-center gap-1">
                          {getTrendIcon(selectedMetric.trend)}
                          <p className={cn(
                            "text-lg font-bold",
                            selectedMetric.trend === "up" ? "text-green-500" : selectedMetric.trend === "down" ? "text-red-500" : "text-yellow-500"
                          )}>
                            {selectedMetric.change}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "details" && selectedMetric && (
                  <div className="space-y-2">
                    {selectedMetric.grain && (
                      <div>
                        <p className={cn("text-xs font-medium mb-1", isDark ? "text-white/60" : "text-slate-500")}>
                          Grain
                        </p>
                        <p className="text-sm">{selectedMetric.grain}</p>
                      </div>
                    )}
                    {selectedMetric.source && (
                      <div>
                        <p className={cn("text-xs font-medium mb-1", isDark ? "text-white/60" : "text-slate-500")}>
                          Source Table
                        </p>
                        <code className={cn("text-sm px-2 py-1 rounded block", isDark ? "bg-white/5" : "bg-slate-100")}>
                          {selectedMetric.source}
                        </code>
                      </div>
                    )}
                    {selectedMetric.owner && (
                      <div>
                        <p className={cn("text-xs font-medium mb-1", isDark ? "text-white/60" : "text-slate-500")}>
                          Owner
                        </p>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <p className="text-sm">{selectedMetric.owner}</p>
                        </div>
                      </div>
                    )}
                    <div>
                      <p className={cn("text-xs font-medium mb-1", isDark ? "text-white/60" : "text-slate-500")}>
                        Category
                      </p>
                      <Badge className={cn(
                        "text-xs",
                        selectedMetric.category === "sales" ? "bg-blue-500/20 text-blue-400" :
                        selectedMetric.category === "finance" ? "bg-green-500/20 text-green-400" :
                        selectedMetric.category === "customer" ? "bg-purple-500/20 text-purple-400" :
                        "bg-orange-500/20 text-orange-400"
                      )}>
                        {selectedMetric.category}
                      </Badge>
                    </div>
                  </div>
                )}

                {activeTab === "overview" && selectedDataset && (
                  <div className="space-y-3">
                    <div>
                      <p className={cn("text-xs font-medium mb-1", isDark ? "text-white/60" : "text-slate-500")}>
                        Name
                      </p>
                      <p className="text-sm font-semibold">{selectedDataset.name}</p>
                    </div>
                    <div>
                      <p className={cn("text-xs font-medium mb-1", isDark ? "text-white/60" : "text-slate-500")}>
                        Description
                      </p>
                      <p className="text-sm">{selectedDataset.description}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className={cn("text-xs mb-1", isDark ? "text-white/60" : "text-slate-500")}>
                          Type
                        </p>
                        <Badge className={getTypeColor(selectedDataset.type)}>
                          {selectedDataset.type}
                        </Badge>
                      </div>
                      <div>
                        <p className={cn("text-xs mb-1", isDark ? "text-white/60" : "text-slate-500")}>
                          Tables
                        </p>
                        <p className="text-sm font-semibold">{selectedDataset.tables}</p>
                      </div>
                    </div>
                    <div>
                      <p className={cn("text-xs font-medium mb-1", isDark ? "text-white/60" : "text-slate-500")}>
                        Tags
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {selectedDataset.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className={cn("text-xs", isDark ? "bg-white/10" : "bg-slate-100")}>
                            <Tag className="h-3 w-3 mr-1" />
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "lineage" && (
                  <div className={cn("text-center py-8", isDark ? "text-white/60" : "text-slate-500")}>
                    <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Data lineage visualization</p>
                    <p className="text-xs mt-1">Coming soon...</p>
                  </div>
                )}
              </div>
            )}

            {/* Dimensions Section */}
            <div
              className={cn(
                "rounded-lg border p-3",
                isDark ? "bg-[#0d1117] border-white/10" : "bg-white border-slate-200"
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <Layers className={cn("h-4 w-4", isDark ? "text-cyan-400" : "text-cyan-600")} />
                <h2 className="text-sm font-semibold">Dimensions</h2>
                <Badge variant="secondary" className={cn("ml-auto text-xs", isDark ? "bg-white/10" : "bg-slate-100")}>
                  {dimensions.length}
                </Badge>
              </div>
              <div className="space-y-1.5">
                {dimensions.map((dim) => (
                  <div
                    key={dim.id}
                    className={cn(
                      "p-2 rounded-md transition-colors cursor-pointer",
                      isDark ? "hover:bg-white/5" : "hover:bg-slate-50"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <PieChart className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium mb-0.5">{dim.name}</p>
                        <p className={cn("text-[11px] mb-1", isDark ? "text-white/50" : "text-slate-500")}>
                          {dim.description}
                        </p>
                        <div className="flex items-center gap-2">
                          <code className={cn("text-[10px] px-1.5 py-0.5 rounded", isDark ? "bg-white/5" : "bg-slate-100")}>
                            {dim.table}
                          </code>
                          <span className={cn("text-[10px]", isDark ? "text-white/40" : "text-slate-400")}>
                            {dim.cardinality}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
