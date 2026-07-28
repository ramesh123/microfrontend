import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { NodeGroup, Dataset, Template, TemplateGroup } from '@/types/nodeSideBar';
import { DraggableNodeItem } from './NodeItem';
import { DraggableDatasetItem } from './DatasetItem';
import { DraggableTemplateItem } from './TemplateItem';
import { DraggablePipelineItem, type PipelineItemType } from './PipelineItem';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Search, Loader2, PanelLeftClose, PanelLeftOpen, Boxes, Database, LayoutTemplate, Workflow, Layers, GitMerge, FolderGit2, Sparkles, ArrowLeft, MousePointer2 } from 'lucide-react';
import { nodesApi, datasetsApi } from '@/controllers/API/sideBarApi';
import { fetchProjectsApi } from '@/controllers/API';
import { useRbacStore } from '@/stores/useRBACStore';
import { useNavigate, useLocation } from 'react-router';
import { useCollapsedSelection } from '@/components/CollapsedSelectionContext';
import ShadTooltip from '@/components/common/shadTooltipComponent';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useDashboardMenu } from '@/router';
import useFlowStore from '@/stores/flowStore';
import { getMasterDataFiles } from '@/controllers/API/filesApi';

/** When Virtual DB is enabled, only these node groups are shown in the sidebar (collapsed by default). */
const normalizeGroupName = (name: string) =>
  name.toLowerCase().replace(/\s+/g, '').replace(/-/g, '').trim();

const VIRTUAL_DB_GROUPS = ['Databases', 'Files', 'Ingestion', 'Virtual DB'] as const;
const VIRTUAL_DB_GROUPS_NORMALIZED = new Set(VIRTUAL_DB_GROUPS.map(normalizeGroupName));

interface NodeLibrarySidebarProps {
  mode?: 'view' | 'edit';
  onAiClick?: () => void;
}
const mockTemplateData: TemplateGroup = {};

export const NodeLibrarySidebar: React.FC<NodeLibrarySidebarProps> = ({ mode = 'edit', onAiClick }) => {
  const [isCollapsed, setIsCollapsed] = useState(true);
  /** Collapsed rail: search popover open — load node library without expanding the sidebar. */
  const [searchPopoverOpen, setSearchPopoverOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('nodes');

  const [nodeData, setNodeData] = useState<NodeGroup>({});
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [templateData] = useState<TemplateGroup>(mockTemplateData);
  const [pipelines, setPipelines] = useState<PipelineItemType[]>([]);

  const [isLoading, setIsLoading] = useState({ nodes: false, datasets: false, templates: false, pipelines: false });
  const [error, setError] = useState<string | null>(null);
  const isViewMode = mode === 'view';
  const navigate = useNavigate();
  const location = useLocation();
  const dashboardMenu = useDashboardMenu();
  const { selectedKey, setSelectedKey } = useCollapsedSelection();
  const currentWorkflow = useFlowStore((s) => s.currentWorkflow);
  const { currentUser, activePerspective } = useRbacStore();
  const forceVirtualDbFromUrl = useMemo(
    () => new URLSearchParams(location.search).get('virtualdb') === '1',
    [location.search]
  );
  const virtualdbMode = forceVirtualDbFromUrl || (currentWorkflow?.virtualdb_mode ?? false);

  /** Any call to loadData() (sidebar, dataset-updated, etc.) — skip duplicate auto-fetch when opening the library. */
  const libraryLoadStartedRef = useRef(false);

  // Debug: Virtual DB mode and sidebar node filtering
  useEffect(() => {
    console.log('[SideBar] currentWorkflow?.virtualdb_mode:', currentWorkflow?.virtualdb_mode);
    console.log('[SideBar] virtualdbMode (effective):', virtualdbMode);
    console.log('[SideBar] VIRTUAL_DB_GROUPS (only these when virtualdb):', VIRTUAL_DB_GROUPS);
  }, [currentWorkflow?.virtualdb_mode, virtualdbMode]);

  const filteredMenuChildren = useMemo(() => {
    const allowed = new Set([
      'workflows',
      'connectionvault',
      'dataset',
      'master data',
      'jobs'
    ]);
    return (
      dashboardMenu?.[0]?.children?.filter((it: any) => {
        if (!it || !it.title) return false;
        const normalize = (s: string) =>
          s.toLowerCase().replace(/\s+/g, '').replace(/-/g, '').trim();

        const t = normalize(String(it.title));
        return allowed.has(t);

      }) ?? []
    );
  }, [dashboardMenu]);

  const loadData = useCallback(async () => {
    libraryLoadStartedRef.current = true;
    setIsLoading((prev) => ({ ...prev, nodes: true, datasets: true }));
    try {
      const [nodesResponse, datasetsResponse, filesResponse] = await Promise.all([
        nodesApi.getNodesList(),
        datasetsApi.getAllDatasets(),
        getMasterDataFiles({
          fields: JSON.stringify([
            "unique_id as value",
            "display_name as label",
            "file_name",
            "file_type",
            "encrypted_file_key",
            "sheet_name",
          ]),
          file_category: "dataset_icon"
        })
      ]);

      if (nodesResponse?.status && nodesResponse.data) {
        console.log('[SideBar loadData] Nodes API groups:', Object.keys(nodesResponse.data));
        setNodeData(nodesResponse.data);
      } else {
        throw new Error('Invalid node data structure');
      }
      setIsLoading(prev => ({ ...prev, nodes: false }));

      if (datasetsResponse?.data) {
        const processed = datasetsResponse.data.map(d => ({ ...d, enabled: true, display_name: d.name, id: d.id }));
        setDatasets(processed);
      } else {
        throw new Error('Invalid dataset data structure');
      }
      
      if (filesResponse?.data) {
        setFiles(filesResponse.data);
      }
      
      setIsLoading(prev => ({ ...prev, datasets: false }));

    } catch (err: any) {
      console.error("Failed to load library data:", err);
      setError(err.message || 'Failed to load data');
      setIsLoading((prev) => ({ ...prev, nodes: false, datasets: false, templates: false }));
    }
  }, []);

  /** Defer /nodes/get-nodes-list (and datasets) until the library is visible: expanded sidebar or collapsed search popover. */
  const sidebarLibraryActive =
    !isViewMode && (!isCollapsed || searchPopoverOpen);
  useEffect(() => {
    if (!sidebarLibraryActive || libraryLoadStartedRef.current) return;
    void loadData();
  }, [sidebarLibraryActive, loadData]);

  // Fetch pipeline list from flow-builder (name + id only)
  const userOrgIds = currentUser?.organizationIds ?? [];
  const activePerspectiveId = activePerspective?.perspective_id ?? (activePerspective as { id?: string })?.id;
  const pipelinesFetchedOnceRef = useRef(false);
  useEffect(() => {
    if (!sidebarLibraryActive || pipelinesFetchedOnceRef.current) return;
    pipelinesFetchedOnceRef.current = true;
    let cancelled = false;
    setIsLoading((prev) => ({ ...prev, pipelines: true }));
    fetchProjectsApi(
      {
        fields: ['name', 'id', 'flow_id'],
        org_id: userOrgIds,
        perspective_ids: activePerspectiveId ? [activePerspectiveId] : undefined,
      },
      currentUser?.role
    )
      .then((res: any) => {
        if (cancelled) return;
        const list = Array.isArray(res) ? res : res?.data ?? [];
        setPipelines(
          list.map((w: any) => ({
            id: String(w.id),
            name: w.name ?? w.display_name ?? String(w.id),
            flow_id: w.flow_id ?? undefined,
          }))
        );
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Failed to load pipelines:', err);
          setPipelines([]);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading((prev) => ({ ...prev, pipelines: false }));
      });
    return () => {
      cancelled = true;
    };
  }, [sidebarLibraryActive, userOrgIds.join(','), activePerspectiveId, currentUser?.role]);

  // Listen for dataset updates (can be triggered from dataset page)
  useEffect(() => {
    const handleDatasetUpdate = () => {
      console.log('Refreshing datasets...');
      setIsLoading(prev => ({ ...prev, datasets: true }));
      loadData();
    };

    window.addEventListener('dataset-updated', handleDatasetUpdate);
    return () => window.removeEventListener('dataset-updated', handleDatasetUpdate);
  }, [loadData]);

  const getFilteredData = (type: 'nodes' | 'datasets' | 'templates') => {
    if (type === 'nodes') {
      const allGroupNames = Object.keys(nodeData);
      const nodesSource: NodeGroup = virtualdbMode
        ? Object.fromEntries(
            Object.entries(nodeData).filter(([groupName]) => VIRTUAL_DB_GROUPS_NORMALIZED.has(normalizeGroupName(groupName)))
          )
        : nodeData;
      const shownGroupNames = Object.keys(nodesSource);
      console.log('[SideBar getFilteredData] type=nodes, virtualdbMode:', virtualdbMode, '| all groups from API:', allGroupNames, '| groups shown:', shownGroupNames);
      if (!searchQuery) return nodesSource;
      const lowercasedQuery = searchQuery.toLowerCase();
      const filtered: NodeGroup = {};
      Object.entries(nodesSource).forEach(([groupName, nodes]) => {
        const filteredNodes = nodes.filter(node => node.display_name.toLowerCase().includes(lowercasedQuery));
        if (filteredNodes.length > 0) filtered[groupName] = filteredNodes;
      });
      return filtered;
    }
    if (!searchQuery) {
      if (type === 'datasets') return datasets.reduce((acc, dataset) => {
        const key = dataset.type || 'Other';
        if (!acc[key]) acc[key] = [];
        acc[key].push(dataset);
        return acc;
      }, {} as { [key: string]: Dataset[] });
      if (type === 'templates') return templateData;
    }
    const lowercasedQuery = searchQuery.toLowerCase();
    if (type === 'datasets') {
      const filtered = datasets.filter(d => d.name.toLowerCase().includes(lowercasedQuery));
      return filtered.reduce((acc, dataset) => {
        const key = dataset.type || 'Other';
        if (!acc[key]) acc[key] = [];
        acc[key].push(dataset);
        return acc;
      }, {} as { [key: string]: Dataset[] });
    }
    if (type === 'templates') {
      const filtered: TemplateGroup = {};
      Object.entries(templateData).forEach(([categoryName, templates]) => {
        const filteredTemplates = templates.filter(template => template.name.toLowerCase().includes(lowercasedQuery));
        if (filteredTemplates.length > 0) filtered[categoryName] = filteredTemplates;
      });
      return filtered;
    }
    return {};
  };

  const renderContent = useCallback((type: 'nodes' | 'datasets' | 'templates') => {
    const data = getFilteredData(type);
    const isLoadingForType = type === 'nodes' ? isLoading.nodes : type === 'datasets' ? isLoading.datasets : isLoading.templates;

    if (isLoadingForType) {
      return <div className="flex justify-center items-center h-full pt-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
    }
    if (error && (type === 'nodes' || type === 'datasets')) {
      return <div className="text-center pt-10 text-destructive text-sm px-4">Error loading data.</div>;
    }

    const ItemComponent = type === 'nodes' ? DraggableNodeItem : type === 'datasets' ? DraggableDatasetItem : DraggableTemplateItem;
    const keyPrefix = type;

    const entries = Object.entries(data);
    if (entries.length === 0) {
      if (type === 'templates') {
        return (
          <div className="flex flex-col items-center justify-center h-full pt-10 text-center text-muted-foreground text-sm gap-2">
            <LayoutTemplate className="w-10 h-10" />
            <span>No templates available.</span>
          </div>
        );
      }
      return <div className="text-center pt-10 text-muted-foreground text-sm">No items found.</div>;
    }

    const accordionDefaultValue = type === 'nodes' && virtualdbMode ? [] : Object.keys(data);
    const filteredPipelines =
      type === 'nodes' && searchQuery
        ? pipelines.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : pipelines;

    return (
      <Accordion type="multiple" defaultValue={accordionDefaultValue} className="w-full space-y-1" key={`${keyPrefix}-${Object.keys(data).join('-')}-${virtualdbMode}`}>
        {entries.map(([groupName, items]) => (
          <AccordionItem key={`${keyPrefix}-${groupName}`} value={groupName} className="border-none">
            <AccordionTrigger className="py-1.5 px-2 text-xs font-semibold text-muted-foreground hover:bg-accent rounded-md">
              <span className="capitalize">{groupName}</span>
            </AccordionTrigger>
            <AccordionContent className="pt-1 pl-1">
              <div className="space-y-0.5">
                {(items as any[]).map((item: any) => {
                  const key = item.id ?? item.node_id;
                  if (!key) return null;
                  let iconFile;
                  if (type === 'datasets') {
                    const uniqueId = item.payload?.icon_unique_id || item.payload?.unique_id || item.node?.payload?.icon_unique_id || item.node?.payload?.unique_id;
                    const encryptedKey = item.payload?.icon_encrypted_file_key || item.payload?.encrypted_file_key || item.node?.payload?.icon_encrypted_file_key || item.node?.payload?.encrypted_file_key;
                    iconFile = files.find((file: any) => 
                      (uniqueId && (file.unique_id === uniqueId || file.value === uniqueId)) || 
                      (encryptedKey && file.encrypted_file_key === encryptedKey)
                    );
                  }
                  return <ItemComponent key={key} item={item} iconFile={iconFile} />;
                })}
              </div>

            </AccordionContent>
          </AccordionItem>
        ))}
        {type === 'nodes' && (
          <AccordionItem value="Pipeline" className="border-none">
            <AccordionTrigger className="py-1.5 px-2 text-xs font-semibold text-muted-foreground hover:bg-accent rounded-md">
              <span className="capitalize">Pipeline</span>
            </AccordionTrigger>
            <AccordionContent className="pt-1 pl-1">
              {isLoading.pipelines ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-0.5">
                  {filteredPipelines.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2 px-1">No pipelines found.</p>
                  ) : (
                    filteredPipelines.map((p) => <DraggablePipelineItem key={p.id} item={p} />)
                  )}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
    );
  }, [isLoading, error, searchQuery, nodeData, datasets, templateData, virtualdbMode, pipelines]);

  const popoverContent = (type: 'nodes' | 'datasets' | 'templates') => (
    <PopoverContent side="right" align="start" className="p-0 w-64 ml-2 bg-muted/20 dark:bg-black/20 backdrop-blur-lg border-border/50">
      <div className="relative flex-1 p-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search..."
          className="h-9 pl-9 text-sm rounded-lg bg-card"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      <ScrollArea className="h-[60vh]">
        <div className="p-1">{renderContent(type)}</div>
      </ScrollArea>
    </PopoverContent>
  );
  return (
    <aside
      className={cn(
        'h-screen flex-shrink-0 dark:bg-black/20 rounded-2xl p-1.5 px-0 flex flex-col gap-1.5 max-h-[91vh] transition-all duration-300',
        isViewMode
          ? 'w-0 overflow-hidden p-0 m-0 border-none'
          : isCollapsed
            ? 'w-12'
            : 'w-64'
      )}
    >
      {/* AI Icon */}
      {!isViewMode && onAiClick && (
        <div className="flex-shrink-0 px-1">
          {isCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onAiClick}
                  className="h-9 w-9 rounded-full flex items-center justify-center ai-pulse cursor-pointer"
                >
                  <div className="h-7 w-7 rounded-full border-2 relative overflow-hidden">
                    <div className="absolute inset-0 rounded-full animate-gradient-spin" style={{ background: 'conic-gradient(from 0deg, #6366f1, #a21caf, #6366f1 100%)' }} />
                    <div className="absolute inset-1 rounded-full bg-primary-foreground" />
                  </div>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Ask AI</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={onAiClick}
              className="w-full h-10 rounded-xl flex items-center gap-2 px-2 relative cursor-pointer"
            >
              <div className="h-7 w-7 rounded-full border-2 relative overflow-hidden flex-shrink-0 ai-pulse">
                <div className="absolute inset-0 rounded-full animate-gradient-spin" style={{ background: 'conic-gradient(from 0deg, #6366f1, #a21caf, #6366f1 100%)' }} />
                <div className="absolute inset-1 rounded-full bg-primary-foreground" />
              </div>
              <span className="text-sm font-medium">Ask AI</span>
            </button>
          )}
        </div>
      )}

      {/* AI Pulse Animation Styles */}
      <style>{`
        @keyframes ai-pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.18); }
          100% { transform: scale(1); }
        }
        .ai-pulse {
          animation: ai-pulse 1.6s cubic-bezier(.4,0,.2,1) infinite;
        }
        @keyframes gradient-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .animate-gradient-spin {
          animation: gradient-spin 2.5s linear infinite;
        }
      `}</style>

      {!isViewMode && (

        <div className="flex items-center gap-1.5 flex-shrink-0 transition-all duration-300">
         {!isCollapsed && (
          <div className="flex items-center gap-1 w-full">
            <Button
              variant="primary"
              size="icon"
              className="w-8 h-8 rounded-lg bg-muted flex-shrink-0"
              onClick={() =>
                window.dispatchEvent(new CustomEvent('workflow-back-click'))
              }
            >
              <MousePointer2 className="h-5 w-5 text-primary" />
            </Button>

            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />

              <Input
                placeholder="Search..."
                className="h-9 pl-9 pr-12 text-sm rounded-3xl bg-muted border-none focus:bg-card"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCollapsed(true)}
                className="!rounded-2xl hover:bg-muted-foreground/20 flex-shrink-0 h-7 absolute right-0 top-1/2 -translate-y-1/2 p-0"
              >
                <PanelLeftClose className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          </div>
        )}
        </div>
      )}

      {/*  Main Scrollable Section */}
      {!isViewMode && (
        <div className="flex-1 bg-secondary backdrop-blur-sm rounded-3xl py-2 px-1 flex flex-col min-h-0 overflow-hidden">
          {isCollapsed ? (
            <div className="flex flex-col items-center gap-0 py-1">
              {/* Back – triggers save/cancel/navigate popup */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-10 h-10 rounded-lg"
                    onClick={() => window.dispatchEvent(new CustomEvent('workflow-back-click'))}
                  >
                    <MousePointer2 className="!h-5 !w-5 text-primary" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>Back (Save / Cancel / Go to workflows)</p>
                </TooltipContent>
              </Tooltip>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsCollapsed(false)}
                className="w-10 h-7 !rounded-2xl hover:bg-muted-foreground/20 "
                title="Expand sidebar"
              >
                <PanelLeftOpen className="h-5 w-5 text-primary" />
              </Button>

              {/* Collapsed: Search popover */}
              <Popover onOpenChange={setSearchPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="w-10 h-10 rounded-lg ">
                    <Search className="!h-6 w-6 text-primary" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="right" align="start" className="p-0 w-60 ml-2 bg-muted/20 backdrop-blur-lg border-border/50">
                  <div className="relative p-2">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search..."
                      className=" h-9 pl-9 pr-2 text-sm rounded-3xl bg-card focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none !border-black/10"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="px-2">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                      <TabsList className="grid grid-cols-2 w-full h-8 p-0.5 bg-muted rounded-3xl mb-2">
                        <TabsTrigger value="nodes" className="h-full text-xs rounded-3xl">Nodes</TabsTrigger>
                        <TabsTrigger value="datasets" className="h-full text-xs rounded-3xl">Datasets</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                  <ScrollArea className="h-[60vh]">
                    <div className="p-1">{renderContent(activeTab as any)}</div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>

              {/* <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="w-10 h-10 rounded-lg">
                    <Workflow className="h-5 w-5 text-primary" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="right" align="start" className="p-0 w-64 ml-2 bg-muted/20 backdrop-blur-lg border-border/50">
                  <ScrollArea className="h-[78vh]">
                    <div className="p-1">{renderContent('nodes')}</div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="w-10 h-10 rounded-lg">
                    <Layers className="h-5 w-5 text-primary" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="right" align="start" className="p-0 w-64 ml-2 bg-muted/20 backdrop-blur-lg border-border/50">
                  <ScrollArea className="h-[73vh]">
                    <div className="p-1 pt-0">{renderContent('datasets')}</div>
                  </ScrollArea>
                </PopoverContent>
              </Popover> */}

              {filteredMenuChildren.map((item, idx) => {
                if (item.hide) return null;

                const ownKey = `${item.title}-${idx}`;

                // If collapsed and a parent is selected, hide all other top-level items
                if (isCollapsed && selectedKey && selectedKey !== ownKey) return null;

                if (item.children && item.children.length > 0) {
                  const open = selectedKey === ownKey;
                  return (
                    <div key={ownKey} className="flex flex-col items-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-10 h-10 rounded-lg"
                            onClick={() => setSelectedKey(open ? null : ownKey)}
                          >
                            {item.icon && React.createElement(item.icon, { className: 'h-5 w-5 text-primary' })}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <p>{item.title}</p>
                        </TooltipContent>
                      </Tooltip>

                      {open && (
                        <div className="flex flex-col mt-0 space-y-2 ">
                          {item.children.map((child, cidx) => (
                            <Tooltip key={child.title + cidx}>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  className="flex items-center justify-center w-8 h-8 "
                                  onClick={() => {
                                    // keep inline open during navigation
                                    child.path && navigate(child.path);
                                  }}
                                >
                                  <div className="flex items-center justify-center border-b-2 border-primary/30 pb-1">
                                  {child.icon ? React.createElement(child.icon, { className: 'h-4 w-4 text-primary ' }) : <span className="h-4 w-4" />}
                                  </div>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="right">
                                <p>{child.title}</p>
                              </TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <Tooltip key={item.title + idx}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-10 h-10 rounded-lg"
                        onClick={() => {
                          setSelectedKey(null);
                          item.path && navigate(item.path);
                        }}
                      >
                        {item.icon && React.createElement(item.icon, { className: 'h-5 w-5 text-primary' })}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>{item.title}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0 mx-auto w-full">
              <TabsList className="grid grid-cols-2 w-full h-8 p-0.5 bg-muted rounded-3xl flex-shrink-0">
                <TabsTrigger value="nodes" className="h-full text-xs rounded-3xl">Nodes</TabsTrigger>
                <TabsTrigger value="datasets" className="h-full text-xs rounded-3xl">Datasets</TabsTrigger>
              </TabsList>
              <ScrollArea className="flex-1 mt-1 overflow-y-auto">
                <div className="p-1">{renderContent(activeTab as any)}</div>
              </ScrollArea>
            </Tabs>
          )}
        </div>
      )}
    </aside>
  );
};
