import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { LayoutGrid, List, Search, FolderSearch, FilePlus, Loader, RefreshCw, Clock, Upload, Download, GitMerge } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { WorkflowCard } from "../gridComponent";
import { WorkflowListTable } from "../listComponent"; // <-- updated import
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteNodeDetailsApi, fetchProjectsApi, getWorkflowByIdApi, exportWorkflowApi, importWorkflowApi } from "@/controllers/API";
import useFlowStore from "@/stores/flowStore";
import { useCreateNewWorkflow } from "@/hooks/use-add-flow";
import { useIdStore } from "@/stores/idStore";
import { track } from "@/customization/utils/analytics";
import { Skeleton } from "@/components/ui/skeleton";
import SkeletonGroup from "@/components/ui/skeletonGroup";
import { useRbacStore } from "@/stores/useRBACStore";
import { ensureWorkflowViewport } from "@/utils/workflowUtils";
import {
  ApiRequestError,
  getDisplayErrorMessage,
  resolveApiErrorMessage,
} from "@/utils/exceptionHelper";
import { useExecuteWorkflow } from "@/hooks/use-execute-flow";
import { ExecuteParams } from "@/pages/FlowPage/components/PageComponent/ExecuteWorkflowDialog";
import { useLocation } from "react-router-dom";
import { isRequestAborted } from "@/utils/apiAbort";
import { abortWorkflowLoadSession } from "@/utils/workflowLoadSession";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
type ViewMode = "list" | "grid";
type SortOption = "date-desc" | "date-asc" | "name-asc" | "name-desc";
const DEFAULT_PAGE_SIZE = 20

const WorkflowData = () => {
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("date-desc");
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [isLoadingWorkflow, setIsLoadingWorkflow] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const listFetchAbortRef = useRef<AbortController | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [serverSort, setServerSort] =
  useState({
    field: "updated_at",
    dir: "desc",
  });
  const setCurrentWorkflow = useFlowStore((state) => state.setCurrentWorkflow);
  const currentWorkflow = useFlowStore((state) => state.currentWorkflow);
  const location = useLocation();
  const isWorkflowPage = location.pathname.startsWith("/workflows/");

  const { mutate: executeMutate, isPending: isExecuting } = useExecuteWorkflow();

  const { currentUser, currentOrganization, activePerspective } = useRbacStore();
  const userOrgIds = currentUser?.organizationIds || [];
  const perspectiveIds = currentOrganization?.perspectiveIds || [];
  const activePerspectiveId = activePerspective?.perspective_id || activePerspective?.id;

  console.log('Fetching projects for org_ids:', userOrgIds, 'User:', currentUser?.username);
  console.log('Active perspective ID:', activePerspectiveId);

  useEffect(() => () => listFetchAbortRef.current?.abort(), []);

  const handleCreateWorkflow = () => {
    navigate("/workflows/create");
  };

  const handleEditWorkflow = async (workflow: any) => {
    listFetchAbortRef.current?.abort();
    abortWorkflowLoadSession();
    const controller = new AbortController();
    listFetchAbortRef.current = controller;
    const { signal } = controller;

    setIsLoadingWorkflow(true);
    try {
      const workflowData = await getWorkflowByIdApi({ id: workflow.id }, { signal });
      if (signal.aborted) return;
      if (workflowData?.status === false) {
        toast.error(resolveApiErrorMessage(workflowData, "Workflow edit failed."));
        return;
      }
      if (workflowData.id && workflowData.updated_at) {
        console.log('Loading workflow (canvas first, then node data)...');
        console.log('Workflow flow_id:', workflowData.flow_id);
        const withVp = ensureWorkflowViewport(workflowData);
        setCurrentWorkflow(withVp);
        document.cookie = `sidebar_state=false; path=/; max-age=${60 * 60 * 24 * 7}`;
        const navigationId = workflowData.id || workflow.id;
        console.log('Navigating to workflow with database ID:', navigationId);
        navigate(`/workflows/${navigationId}`, {
          state: { openAiChat: true }
        });
      }
    } catch (error) {
      if (isRequestAborted(error)) return;
      console.error('Failed to load workflow:', error);
      if (!(error instanceof ApiRequestError)) {
        toast.error(getDisplayErrorMessage(error, "Workflow edit failed."));
      }
    } finally {
      if (!signal.aborted) {
        setIsLoadingWorkflow(false);
      }
    }
  };

  const handleDeleteWorkflow = async (id: number) => {
    try {
      const res = await deleteNodeDetailsApi(
        { module: "flow-builder", klass: "delete-workflow" },
        { workflow_id: String(id) },
      );
      toast.success(
        (res as { message?: string })?.message || "Workflow deleted successfully.",
      );
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    } catch (error) {
      console.error("Failed to delete workflow:", error);
      if (!(error instanceof ApiRequestError)) {
        toast.error(getDisplayErrorMessage(error, "Workflow delete failed."));
      }
    }
  };

  const handleExportWorkflow = async (id: number) => {
    try {
      toast.info("Exporting workflow...");
      const result = await exportWorkflowApi(String(id));
      if (result?.success) {
        toast.success(`Workflow exported successfully as ${result.filename}`);
      }
    } catch (error) {
      console.error('Failed to export workflow:', error);
      toast.error(getDisplayErrorMessage(error, "Failed to export workflow."));
    }
  };

  const handleExecuteWorkflow = (workflow: any, params: ExecuteParams) => {
    if (!workflow.flow_id) {
      toast.error("Flow ID is missing. Please save the workflow first.");
      return;
    }
    if (!workflow.name) {
      toast.error("Flow name is missing. Please save the workflow first.");
      return;
    }
    if (!workflow.deployment_name) {
      toast.error("Deployment name is missing. Please save the workflow first.");
      return;
    }
    const payload = {
      flow_name: workflow.name,
      file_name: workflow.deployment_name,
      flow_id: workflow.flow_id,
      flow_run_id: "",
      stmtdate: params.stmtdate,
      process_cycle: params.process_cycle,
      execution_number: params.exec_number,
    };
    console.log('Executing workflow with payload:', payload);
    executeMutate(payload);
  };

  const {
    data: projects,
    isLoading,
    isError,
    error,
    isFetching,
    dataUpdatedAt,
    refetch,
    isStale,
  } = useQuery({
queryKey: [
  "projects",
  "workflows",
userOrgIds.join(','), activePerspectiveId, debouncedSearchQuery, sortOption,
  currentPage,
  pageSize,
  serverSort.field,
  serverSort.dir,
],    queryFn: () => fetchProjectsApi({
      fields: [
        "name",
        "description",
        "created_at",
        "updated_at",
        "statement_date",
        "status",
        "business_process",
        "deployment_name",
        "deployment_id",
        "locked",
        "flow_id",
        "workflow_origin",
        "workflow_type",
        "execution_number",
        "process_cycle",
        "environment",
        "cycle_wise",
      ],
      org_id: userOrgIds,
      perspective_ids: activePerspectiveId ? [activePerspectiveId] : undefined,
      q: "virtualdb_mode=false",
      search_text: debouncedSearchQuery || undefined,
      skip: currentPage,
      limit: pageSize,
    sort: JSON.stringify({
    [serverSort.field]: serverSort.dir,
    })
    }, currentUser?.role),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 60,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchInterval: false,
  });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setCurrentPage(0);
  }, [debouncedSearchQuery]);

  const getLastUpdatedTime = () => {
    if (!dataUpdatedAt || dataUpdatedAt === 0) return null;
    const date = new Date(dataUpdatedAt);
    if (isNaN(date.getTime())) return null;
    return date.toLocaleString();
  };

  const handleRefresh = () => {
    setSearchQuery("");
    setDebouncedSearchQuery("");
    setCurrentPage(0);
    setPageSize(DEFAULT_PAGE_SIZE);
    toast.info("Refreshing workflows data...");
    refetch();
  };

  const handleImportWorkflow = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.zip')) {
      toast.error("Please select a ZIP file");
      return;
    }
    setIsLoadingWorkflow(true);
    try {
      toast.info("Importing workflow...");
      const result = await importWorkflowApi(file);
      if (result?.status === false) {
        toast.error(resolveApiErrorMessage(result, "Failed to import workflow."));
        return;
      }
      if (result?.status && result?.data && result.data.length > 0) {
        toast.success(result.message || `${result.data.length} workflow(s) imported successfully.`);
        const importedWorkflow = result.data[0];
        const updatedWorkflow = {
          ...importedWorkflow,
          org_id: userOrgIds,
          perspective_ids: perspectiveIds || []
        };
        setCurrentWorkflow(updatedWorkflow);
        navigate(`/workflows/${importedWorkflow.id}`, {
          state: { openAiChat: true }
        });
        queryClient.invalidateQueries({ queryKey: ["projects"] });
      }
    } catch (error) {
      console.error('Failed to import workflow:', error);
      if (!(error instanceof ApiRequestError)) {
        toast.error(getDisplayErrorMessage(error, "Failed to import workflow."));
      }
    } finally {
      setIsLoadingWorkflow(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const filteredAndSortedWorkflows = useMemo(() => {
    return projects?.data || [];
  }, [projects]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.07 } },
    exit: { opacity: 0, transition: { staggerChildren: 0.05, staggerDirection: -1 } },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 100 } },
    exit: { y: -20, opacity: 0, transition: { duration: 0.1 } },
  };

  return (
    <div className="w-full mx-auto overflow-hidden">
      {/* Header / Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-1 p-1">
        <div className="flex flex-col gap-0 self-start md:self-center">
          <div className="flex shrink-0 items-center gap-2">
            <GitMerge className="h-4 w-4 shrink-0 text-primary" />
            <h1 className="text-[16px] font-bold">
              Workflows
              {!isLoading && !isFetching && projects?.data && (
                <span className="ml-2 text-l text-muted-foreground">
                  ({projects?.total || filteredAndSortedWorkflows.length})
                </span>
              )}
            </h1>
            {(isLoading || isFetching) && (
              <div className="flex items-center gap-2">
                <Loader className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Loading...</span>
              </div>
            )}
          </div>
          {dataUpdatedAt && !isLoading && !isFetching && getLastUpdatedTime() && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Last updated: {getLastUpdatedTime()}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search workflows..."
              className="pl-9 w-full sm:w-64 !h-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
             {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center justify-center rounded p-0.5 text-white bg-destructive hover:text-white hover:bg-destructive"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                )}
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {viewMode !== "list" && (
              <Select
                value={sortOption}
                onValueChange={(value) => setSortOption(value as SortOption)}
                disabled={isLoading || isFetching}
              >
                <SelectTrigger className="w-full flex-1 sm:w-[180px] !h-8">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date-desc">Newest First</SelectItem>
                  <SelectItem value="date-asc">Oldest First</SelectItem>
                  <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                  <SelectItem value="name-desc">Name (Z-A)</SelectItem>
                </SelectContent>
              </Select>
            )}

            <div className="bg-muted p-[2px] h-8 rounded-md flex items-center">
              <ToggleGroup
                type="single"
                value={viewMode}
                onValueChange={(value) => value && setViewMode(value as ViewMode)}
                disabled={isLoading || isFetching}
                className="h-full flex items-center gap-1"
              >
                <ToggleGroupItem
                  value="list"
                  className="h-7 w-7 p-0 flex items-center justify-center rounded-md data-[state=on]:bg-background"
                >
                  <List className="h-3.5 w-3.5" />
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="grid"
                  className="h-7 w-7 p-0 flex items-center justify-center rounded-md data-[state=on]:bg-background"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <Button
              onClick={handleRefresh}
              variant="primary"
              className="w-full sm:w-auto !h-8 !p-2"
              disabled={isLoading || isFetching}
              title={`Refresh workflows data${isStale ? ' (data may be outdated)' : ''}`}
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              onClick={handleImportWorkflow}
              variant="primary"
              className="w-full sm:w-auto !h-8 !p-2"
              disabled={isLoading || isFetching || isLoadingWorkflow}
              title="Import workflow from ZIP file"
            >
              <Download className="mr-1 h-4 w-4" />
              Import
            </Button>
            <Button onClick={handleCreateWorkflow} variant="default" className="w-full sm:w-auto !h-7.5 !p-2">
              <FilePlus className="mr-1 h-4 w-4" />
              Workflow
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {isError ? (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col items-center justify-center text-center py-16"
          >
            <FolderSearch className="h-24 w-24 text-red-500 mb-4" />
            <p className="text-lg font-semibold text-red-600 mb-2">Failed to Load Workflows</p>
            <p className="text-muted-foreground mb-6">
              {getDisplayErrorMessage(error, "An error occurred while fetching workflows.")}
            </p>
            <Button onClick={handleRefresh} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </motion.div>
        ) : isLoading || isFetching || isLoadingWorkflow ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col items-center justify-center text-center py-16"
          >
            <p className="text-lg font-semibold mb-2">
              {isLoadingWorkflow ? "Loading Workflow..." : isLoading ? "Loading Workflows..." : "Refreshing Workflows..."}
            </p>
            <p className="text-muted-foreground">
              {isLoadingWorkflow
                ? "Loading workflow and fetching all node data..."
                : isLoading
                ? "This may take a few minutes to load all your workflows."
                : "Updating with the latest workflow data..."}
            </p>
            {(isLoading || isLoadingWorkflow) && (
              <>
                <div className="w-64 h-2 bg-muted rounded-full mt-6 overflow-hidden">
                  <motion.div
                    className="h-full bg-primary rounded-full"
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: isLoadingWorkflow ? 10 : 40, ease: "easeInOut" }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {isLoadingWorkflow
                    ? "Fetching node data using unique_ids and executing source nodes..."
                    : "Please wait while we fetch your workflow data..."}
                </p>
              </>
            )}
            {isFetching && !isLoading && !isLoadingWorkflow && dataUpdatedAt && (
              <p className="text-xs text-muted-foreground mt-4">
                Cached data from: {getLastUpdatedTime()}
              </p>
            )}
          </motion.div>
        ) : filteredAndSortedWorkflows.length > 0 ? (
          viewMode === "grid" ? (
            // ── Grid view (unchanged) ──────────────────────────────────────────
        <>
  <ScrollArea
    className="overflow-y-auto"
    style={{ height: "calc(100vh - 180px)" }}
  >
    <motion.div
      key="grid"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2 pb-4"
    >
      {filteredAndSortedWorkflows.map((workflow) => (
        <motion.div key={workflow.id} variants={itemVariants}>
          <WorkflowCard
            workflow={workflow}
            onNavigate={handleEditWorkflow}
            onDelete={handleDeleteWorkflow}
            onExport={handleExportWorkflow}
            onExecute={handleExecuteWorkflow}
          />
        </motion.div>
      ))}
    </motion.div>
  </ScrollArea>

<div className="flex items-center justify-end gap-4 border-t px-4 py-3">
  <div className="flex items-center gap-2">
    <span className="text-sm">Rows per page</span>

    <Select
      value={`${pageSize}`}
      onValueChange={(value) => {
        setPageSize(Number(value));
        setCurrentPage(0);
      }}
    >
      <SelectTrigger className="h-8 w-[80px]">
        <SelectValue />
      </SelectTrigger>

      <SelectContent>
        <SelectItem value="10">10</SelectItem>
        <SelectItem value="20">20</SelectItem>
        <SelectItem value="50">50</SelectItem>
        <SelectItem value="100">100</SelectItem>
      </SelectContent>
    </Select>
  </div>

  <div className="text-sm">
    Page {currentPage + 1} of{" "}
    {Math.max(
      1,
      Math.ceil((projects?.total || 0) / pageSize)
    )}
  </div>

  <div className="flex items-center gap-1">
    <Button
      variant="ghost"
      size="icon"
      disabled={currentPage === 0}
      onClick={() => setCurrentPage(0)}
    >
      <ChevronsLeft className="h-4 w-4" />
    </Button>

    <Button
      variant="ghost"
      size="icon"
      disabled={currentPage === 0}
      onClick={() =>
        setCurrentPage((prev) => Math.max(0, prev - 1))
      }
    >
      <ChevronLeft className="h-4 w-4" />
    </Button>

    <Button
      variant="ghost"
      size="icon"
      disabled={
        currentPage >=
        Math.ceil((projects?.total || 0) / pageSize) - 1
      }
      onClick={() =>
        setCurrentPage((prev) => prev + 1)
      }
    >
      <ChevronRight className="h-4 w-4" />
    </Button>

    <Button
      variant="ghost"
      size="icon"
      disabled={
        currentPage >=
        Math.ceil((projects?.total || 0) / pageSize) - 1
      }
      onClick={() =>
        setCurrentPage(
          Math.ceil((projects?.total || 0) / pageSize) - 1
        )
      }
    >
      <ChevronsRight className="h-4 w-4" />
    </Button>
  </div>
</div>
</>
          ) : (
            // ── List view → Table ──────────────────────────────────────────────
            <motion.div
              key="list"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="overflow-x-auto"
            >
              <WorkflowListTable
                workflows={filteredAndSortedWorkflows}
                totalRows={projects?.total || 0}
                currentPage={currentPage}
                pageSize={pageSize}
                loading={isFetching && !isLoading}
                 onPaginationChange={(
    page,
    limit,
    sortedColumns
  ) => {
    if (
      sortedColumns &&
      Object.keys(sortedColumns).length > 0
    ) {
      const [columnId, dir] =
        Object.entries(sortedColumns)[0];

      const sortFieldMap: Record<
        string,
        string
      > = {
        workflow: "name",
        name: "name",
        description: "description",
        deployment_name: "deployment_name",
        business_process: "business_process",
        statement_date: "statement_date",
        status: "status",
        execution_time: "updated_at",
        workflow_origin: "workflow_origin",
      };

      const apiField =
        sortFieldMap[columnId];

      if (apiField) {
        setServerSort({
          field: apiField,
          dir,
        });

        setCurrentPage(0);
        return;
      }
    }

    if (limit !== pageSize) {
      setPageSize(limit);
      setCurrentPage(0);
      return;
    }

    setCurrentPage(page);
  }}
                onNavigate={handleEditWorkflow}
                onDelete={handleDeleteWorkflow}
                onExport={handleExportWorkflow}
                onExecute={handleExecuteWorkflow}
              />
            </motion.div>
          )
        ) : (
          <motion.div
            key="no-results"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col items-center justify-center text-center py-16"
          >
            <FolderSearch className="h-24 w-24 text-muted-foreground mb-4" />
            <p className="text-lg font-semibold">No Workflows Found</p>
            <p className="text-muted-foreground mb-6">Try adjusting your search or create a new one.</p>
            <Button onClick={handleCreateWorkflow}>
              <FilePlus className="mr-2 h-4 w-4" />
              Create a Workflow
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WorkflowData;