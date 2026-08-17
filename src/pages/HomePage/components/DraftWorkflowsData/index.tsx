import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { LayoutGrid, List, Search, FolderSearch, FilePlus, Loader, RefreshCw, Clock, Download, FolderGit2 } from "lucide-react";
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
import { deleteDraftWorkflowApi, getDraftWorkflowsApi, getDraftWorkflowByDraftIdApi, exportWorkflowApi, importWorkflowApi } from "@/controllers/API";
import useFlowStore from "@/stores/flowStore";
import { useRbacStore } from "@/stores/useRBACStore";
import { ensureWorkflowViewport } from "@/utils/workflowUtils";
import {
  ApiRequestError,
  getDisplayErrorMessage,
  resolveApiErrorMessage,
} from "@/utils/exceptionHelper";
import { useExecuteWorkflow } from "@/hooks/use-execute-flow";
import { ExecuteParams } from "@/pages/FlowPage/components/PageComponent/ExecuteWorkflowDialog";
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
const DEFAULT_PAGE_SIZE = 20;

const normalizeDraftWorkflow = (workflow: any) => {
  const draftId = workflow.draft_id ?? workflow.id;
  const workflowOrigin =
    workflow.workflow_origin ??
    workflow.workflow?.workflow_origin ??
    workflow.workflow_data?.workflow_origin ??
    workflow.data?.workflow_origin;

  return {
    ...workflow,
    id: workflow.id ?? draftId,
    draft_id: workflow.draft_id ?? draftId,
    name: workflow.name ?? workflow.workflow?.name,
    description: workflow.description ?? workflow.workflow?.description,
    business_process: workflow.business_process ?? workflow.workflow?.business_process,
    status: workflow.status ?? workflow.workflow?.status,
    statement_date: workflow.statement_date ?? workflow.workflow?.statement_date,
    updated_at:
      workflow.updated_at ??
      workflow.workflow?.updated_at ??
      workflow.created_at ??
      workflow.workflow?.created_at,
    locked: workflow.locked ?? workflow.workflow?.locked,
    flow_id: workflow.flow_id ?? workflow.workflow?.flow_id,
    deployment_name: workflow.deployment_name ?? workflow.workflow?.deployment_name,
    workflow_origin: workflowOrigin?.toString().trim() || "Manual",
  };
};

const DraftWorkflowsData = () => {
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
  const setCurrentWorkflow = useFlowStore((state) => state.setCurrentWorkflow);
  const { currentUser, currentOrganization, activePerspective } = useRbacStore();
  const userOrgIds = currentUser?.organizationIds ?? [];
  const perspectiveIds = currentOrganization?.perspectiveIds ?? [];
  const activePerspectiveId = activePerspective?.perspective_id ?? activePerspective?.id ?? null;
  const { mutate: executeMutate, isPending: isExecuting } = useExecuteWorkflow();
  const [serverSort, setServerSort] =
    useState({
      field: "updated_at",
      dir: "desc",
    });

  const {
    data: draftResponse,
    isLoading,
    isError,
    error,
    isFetching,
    dataUpdatedAt,
    refetch,
    isStale,
  } = useQuery({
    queryKey: ["draft-workflows", userOrgIds.join(","), activePerspectiveId, debouncedSearchQuery, sortOption, currentPage, pageSize, serverSort.field,
      serverSort.dir],
    queryFn: () => getDraftWorkflowsApi({
      skip: currentPage,
      limit: pageSize,
      search_text: debouncedSearchQuery || undefined,
      sort: JSON.stringify({
        [serverSort.field]: serverSort.dir,
      })
    }),
    enabled: !!currentUser,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 60,
    retry: 3,
    refetchOnWindowFocus: false,
    // Ensure the API is called whenever the user opens this page (even if cached data is still "fresh").
    refetchOnMount: "always",
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

  const drafts = useMemo(() => {
    if (!draftResponse) return [];
    const res = draftResponse as any;
    const raw = res?.data ?? res;
    const arr = Array.isArray(raw) ? raw : (raw?.drafts ?? raw?.workflows ?? []);
    return Array.isArray(arr) ? arr : [];
  }, [draftResponse]);

  const getLastUpdatedTime = () => {
    if (!dataUpdatedAt || dataUpdatedAt === 0) return null;
    const date = new Date(dataUpdatedAt);
    if (isNaN(date.getTime())) return null;
    return date.toLocaleString();
  };

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
      // Same as Workflows menu: click card → load that workflow → show it on canvas. API: api/draft-flow-builder/:draft_id (not api/flow-builder/:id)
      const draftId = String(workflow.draft_id ?? workflow.id);
      if (!draftId) {
        toast.error("Draft workflow not found.");
        return;
      }
      const res = await getDraftWorkflowByDraftIdApi(draftId, { signal });
      if (signal.aborted) return;
      if (res && typeof res === "object" && (res as { status?: boolean }).status === false) {
        toast.error(resolveApiErrorMessage(res, "Failed to open draft workflow."));
        return;
      }
      // API returns full workflow at top level: { id, draft_id, data: { nodes, edges, viewport }, flow_id, name, ... }
      // Use res as workflow when it has id/draft_id/flow_id and nested data; else use res?.data for wrapped response
      const workflowData =
        res &&
          typeof res === "object" &&
          (res.id != null || res.draft_id != null || res.flow_id != null) &&
          res.data &&
          typeof res.data === "object"
          ? res
          : (res?.data ?? res);

      // Proceed whenever we have workflow-like data (draft_id, flow_id, id, or nodes) so we always show the canvas
      const hasWorkflow =
        workflowData &&
        typeof workflowData === "object" &&
        (workflowData.draft_id != null ||
          workflowData.flow_id != null ||
          workflowData.id != null ||
          (workflowData.data && (workflowData.data?.nodes || workflowData.data?.edges)));

      if (hasWorkflow) {
        const normalized = { ...workflowData, draft_id: workflowData.draft_id ?? draftId };
        console.log("Loading draft workflow (canvas first, then node data)...", "draft_id:", normalized.draft_id);
        const withVp = ensureWorkflowViewport(normalized);
        setCurrentWorkflow(withVp);
        document.cookie = `sidebar_state=false; path=/; max-age=${60 * 60 * 24 * 7}`;
        navigate(`/draft_workflows/${draftId}`, { state: { openAiChat: true } });
      } else {
        toast.error("Draft workflow not found.");
      }
    } catch (err) {
      if (isRequestAborted(err)) return;
      console.error("Failed to open workflow:", err);
      if (!(err instanceof ApiRequestError)) {
        toast.error(getDisplayErrorMessage(err, "Failed to open workflow."));
      }
    } finally {
      if (!signal.aborted) {
        setIsLoadingWorkflow(false);
      }
    }
  };

  const handleDeleteWorkflow = async (workflow: any) => {
    const flowId = workflow?.flow_id;
    if (!flowId) {
      toast.error("Flow ID missing. Cannot delete draft.");
      return;
    }
    try {
      const res = await deleteDraftWorkflowApi({ flow_id: String(flowId) });
      toast.success(
        (res as { message?: string })?.message || "Draft workflow deleted.",
      );
      queryClient.invalidateQueries({ queryKey: ["draft-workflows"] });
    } catch (err) {
      console.error("Failed to delete draft workflow:", err);
      if (!(err instanceof ApiRequestError)) {
        toast.error(getDisplayErrorMessage(err, "Delete failed."));
      }
    }
  };

  const handleExportWorkflow = async (id: number) => {
    try {
      toast.info("Exporting workflow...");
      const result = await exportWorkflowApi(String(id));
      if (result?.success) {
        toast.success(`Exported as ${result.filename}`);
      }
    } catch (err) {
      console.error("Export failed:", err);
      toast.error(getDisplayErrorMessage(err, "Export failed."));
    }
  };

  const handleExecuteWorkflow = (workflow: any, params: ExecuteParams) => {
    if (!workflow?.flow_id) {
      toast.error("Flow ID missing. Save the workflow first.");
      return;
    }
    const payload = {
      flow_name: workflow.name,
      file_name: workflow.deployment_name ?? workflow.name,
      flow_id: workflow.flow_id,
      flow_run_id: "",
      stmtdate: params.stmtdate,
      process_cycle: params.process_cycle,
      execution_number: params.exec_number,
    };
    executeMutate(payload);
  };

  const handleRefresh = () => {
    setSearchQuery("");
    setDebouncedSearchQuery("");
    setCurrentPage(0);
    setPageSize(DEFAULT_PAGE_SIZE);
    toast.info("Refreshing draft workflows...");
    refetch();
  };

  const handleImportWorkflow = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.name.endsWith(".zip")) {
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
      if (result?.status && result?.data?.length > 0) {
        toast.success(result.message || "Workflow imported.");
        const w = result.data[0];
        setCurrentWorkflow({ ...w, org_id: userOrgIds, perspective_ids: perspectiveIds });
        navigate(`/workflows/${w.id}`, { state: { openAiChat: true } });
        queryClient.invalidateQueries({ queryKey: ["draft-workflows"] });
      }
    } catch (err) {
      console.error("Import failed:", err);
      if (!(err instanceof ApiRequestError)) {
        toast.error(getDisplayErrorMessage(err, "Import failed."));
      }
    } finally {
      setIsLoadingWorkflow(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const filteredAndSorted = useMemo(() => {
    return drafts.map(normalizeDraftWorkflow);
  }, [drafts]);

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
            <FolderGit2 className="h-4 w-4 shrink-0 text-primary" />
            <h1 className="text-[16px] font-bold">
              Draft Workflows
              {!isLoading && !isFetching && drafts.length >= 0 && (
                <span className="ml-2 text-l text-muted-foreground">
                  ({(draftResponse as any)?.total || filteredAndSorted.length})
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
              placeholder="Search draft workflows..."
              className="pl-9 w-full sm:w-64 !h-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            // disabled={isLoading || isFetching}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center justify-center rounded p-0.5 text-white bg-destructive hover:text-white hover:bg-destructive"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {viewMode !== "list" && (
              <Select value={sortOption} onValueChange={(v) => setSortOption(v as SortOption)} disabled={isLoading || isFetching}>
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
                onValueChange={(v) => v && setViewMode(v as ViewMode)}
                disabled={isLoading || isFetching}
                className="h-full flex items-center gap-1"
              >
                <ToggleGroupItem value="list" className="h-7 w-7 p-0 flex items-center justify-center rounded-md data-[state=on]:bg-background">
                  <List className="h-3.5 w-3.5" />
                </ToggleGroupItem>
                <ToggleGroupItem value="grid" className="h-7 w-7 p-0 flex items-center justify-center rounded-md data-[state=on]:bg-background">
                  <LayoutGrid className="h-3.5 w-3.5" />
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            <Button onClick={handleRefresh} variant="outline" className="w-full sm:w-auto !h-8 !p-2" disabled={isLoading || isFetching} title={isStale ? "Refresh draft workflows (data may be outdated)" : "Refresh"}>
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
            <Button onClick={handleImportWorkflow} variant="outline" className="w-full sm:w-auto !h-8 !p-2" disabled={isLoading || isFetching || isLoadingWorkflow} title="Import workflow from ZIP file">
              <Download className="mr-1 h-4 w-4" />
              Import
            </Button>
            <Button onClick={handleCreateWorkflow} variant="default" className="w-full sm:w-auto !h-7.5 !p-2">
              <FilePlus className="mr-1 h-4 w-4" />
              Workflow
            </Button>
            <input ref={fileInputRef} type="file" accept=".zip" onChange={handleFileChange} style={{ display: "none" }} />
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {isError ? (
          <motion.div key="error" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col items-center justify-center text-center py-16">
            <FolderSearch className="h-24 w-24 text-red-500 mb-4" />
            <p className="text-lg font-semibold text-red-600 mb-2">Failed to Load Draft Workflows</p>
            <p className="text-muted-foreground mb-6">
              {getDisplayErrorMessage(error, "An error occurred while fetching draft workflows.")}
            </p>
            <Button onClick={handleRefresh} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </motion.div>
        ) : isLoading || isFetching || isLoadingWorkflow ? (
          <motion.div key="loading" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col items-center justify-center text-center py-16">
            <p className="text-lg font-semibold mb-2">
              {isLoadingWorkflow ? "Loading Workflow..." : isLoading ? "Loading Draft Workflows..." : "Refreshing Draft Workflows..."}
            </p>
            <p className="text-muted-foreground">
              {isLoadingWorkflow
                ? "Loading workflow and fetching all node data..."
                : isLoading
                  ? "This may take a few minutes to load all your draft workflows."
                  : "Updating with the latest draft workflow data..."}
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
                  {isLoadingWorkflow ? "Fetching node data..." : "Please wait while we fetch your draft workflow data..."}
                </p>
              </>
            )}
            {isFetching && !isLoading && !isLoadingWorkflow && dataUpdatedAt && (
              <p className="text-xs text-muted-foreground mt-4">Cached data from: {getLastUpdatedTime()}</p>
            )}
          </motion.div>
        ) : filteredAndSorted.length > 0 ? (
          viewMode === "grid" ? (
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
                  className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2"
                >
                  {filteredAndSorted.map((w) => (
                      <motion.div
                        key={w.id ?? w.flow_id}
                        variants={itemVariants}
                      >
                        <WorkflowCard
                          workflow={w}
                          footerDateField="updated_at"
                          onNavigate={handleEditWorkflow}
                          onDelete={() => handleDeleteWorkflow(w)}
                          onExport={handleExportWorkflow}
                          onExecute={handleExecuteWorkflow}
                        />
                      </motion.div>
                    ))}
                </motion.div>
              </ScrollArea>

              {/* Pagination Footer */}
              <div className="mt-4 flex items-center justify-end gap-6 border-t px-4 py-3">
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
                    Math.ceil(
                      (((draftResponse as any)?.total) || 0) /
                      pageSize
                    )
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
                      setCurrentPage((prev) =>
                        Math.max(0, prev - 1)
                      )
                    }
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={
                      currentPage >=
                      Math.ceil(
                        (((draftResponse as any)?.total) || 0) /
                        pageSize
                      ) -
                      1
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
                      Math.ceil(
                        (((draftResponse as any)?.total) || 0) /
                        pageSize
                      ) -
                      1
                    }
                    onClick={() =>
                      setCurrentPage(
                        Math.ceil(
                          (((draftResponse as any)?.total) || 0) /
                          pageSize
                        ) - 1
                      )
                    }
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="overflow-x-auto"
            >
              <WorkflowListTable
                workflows={filteredAndSorted}
                totalRows={(draftResponse as any)?.total || 0}
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
                onDelete={(id) => {
                  const workflow = filteredAndSorted.find(
                    (item) => item.id === id || item.draft_id === id,
                  );
                  if (workflow) {
                    handleDeleteWorkflow(workflow);
                  }
                }}
                onExport={handleExportWorkflow}
                onExecute={handleExecuteWorkflow}
              />
            </motion.div>
          )
        ) : (
          <motion.div key="no-results" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col items-center justify-center text-center py-16">
            <FolderSearch className="h-24 w-24 text-muted-foreground mb-4" />
            <p className="text-lg font-semibold">No Draft Workflows Found</p>
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

export default DraftWorkflowsData;
