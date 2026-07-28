import { useMemo, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getDisplayErrorMessage, resolveApiErrorMessage } from '@/utils/exceptionHelper';
import { Check, Clock, Copy, DatabaseZap, Download, FilePlus, FolderSearch, LayoutGrid, List, Loader, MoreVertical, Pencil, RefreshCw, Search, Trash2 } from 'lucide-react';
import AIimage from '@/assets/images/ai.png';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';

import { importWorkflowApi } from '@/controllers/API';
import { deleteVirtualDataset, getVirtualDatasetsList } from '@/controllers/API/virtualDatasetApi';
import useFlowStore from '@/stores/flowStore';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ShadTooltip from '@/components/common/shadTooltipComponent';
import { VirtualDbListTable } from '@/pages/Dashboards/VirtualDB/VirtualDbListTable';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
	ChevronLeft,
	ChevronRight,
	ChevronsLeft,
	ChevronsRight,
} from "lucide-react";
type ViewMode = 'list' | 'grid';
type SortOption = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc';

const titleCase = (s = '') =>
	s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

/** Map GET /virtual-dataset item to list row (API: numeric id + dataset_id UUID + node[]). */
function mapVirtualDatasetItem(item: any, idx: number) {
	const recordId = item?.id;
	const datasetUuid = item?.dataset_id ?? item?.datasetId;
	const routeForDetail =
		recordId != null ? String(recordId) : datasetUuid != null ? String(datasetUuid) : `vd-${idx}`;
	/** Backend id for GET /virtual-dataset/:id, delete, and update (e.g. "10"). */
	const apiRecordId = recordId != null ? String(recordId) : '';
	return {
		id: routeForDetail,
		record_id: apiRecordId,
		dataset_uuid: datasetUuid != null ? String(datasetUuid) : '',
		/** Same as record id for virtual-dataset API bodies (dataset_id + update_id). */
		dataset_id: apiRecordId,
		workflow_route_id: routeForDetail,
		name: item?.name ?? item?.display_name ?? '',
		description: item?.description ?? '',
		deployment_name: item?.deployment_name ?? '—',
		business_process: item?.business_process ?? '',
		created_at: item?.created_at,
		updated_at: item?.updated_at ?? item?.created_at,
		flow_id: item?.flow_id,
		workflow_id: item?.workflow_id,
		workflow_origin: item?.workflow_origin,
	};
}

interface VirtualDBWorkflowCardProps {
	workflow: any;
	isLoadingWorkflow: boolean;
	onEdit: (workflow: any) => void;
	onDelete: (workflow: any) => void;
}

function VirtualDBWorkflowCard({ workflow, isLoadingWorkflow, onEdit, onDelete }: VirtualDBWorkflowCardProps) {
	const handleCardClick = () => {
		if (!isLoadingWorkflow) onEdit(workflow);
	};
const [copied, setCopied] = useState(false);

	const isAiOrigin =
		workflow?.workflow_origin === 'AI' ||
		String(workflow?.workflow_origin || '').toUpperCase() === 'AI';
	const originBadgeLabel = workflow?.workflow_origin?.toString().trim() || 'Manual';
return (
  <Card
    onClick={handleCardClick}
    className="group flex h-full cursor-pointer flex-col gap-2 py-3 transition-all hover:shadow-lg hover:shadow-primary/20"
  >
    <CardHeader className="px-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
            <div className="group flex max-w-[14.3rem] flex-1 items-center gap-1">
            <ShadTooltip content={titleCase(workflow?.name ?? "")}>
              <CardTitle
                onClick={handleCardClick}
                className="cursor-pointer truncate text-l font-semibold transition-colors hover:text-primary hover:underline"
              >
                {titleCase(workflow?.name ?? "") || "-"}
              </CardTitle>
            </ShadTooltip>

            <div className="relative flex items-center">
              <button
                onClick={async (e) => {
                  e.stopPropagation();

                  await navigator.clipboard.writeText(
                    titleCase(workflow?.name || "")
                  );

                  setCopied(true);

                  setTimeout(() => {
                    setCopied(false);
                  }, 2000);
                }}
                className="opacity-0 transition-opacity duration-200 group-hover:opacity-100"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-foreground" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                )}
              </button>

              {copied && (
                <div className="absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border bg-background px-2 py-1 text-xs shadow-md animate-in fade-in zoom-in-95">
                  Copied
                </div>
              )}
            </div>
          </div>

          <CardDescription className="h-10 overflow-hidden text-ellipsis pt-4">
            {workflow?.description || ""}
          </CardDescription>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="flex-shrink-0"
              onClick={(e) => e.stopPropagation()}
              disabled={isLoadingWorkflow}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            onClick={(e) => e.stopPropagation()}
          >
            <DropdownMenuItem
              disabled={isLoadingWorkflow}
              onClick={(e) => {
                e.stopPropagation();
                onEdit(workflow);
              }}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              disabled={isLoadingWorkflow}
              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(workflow);
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </CardHeader>

    <CardFooter className="mt-auto flex items-center justify-between gap-2 px-3 text-sm text-muted-foreground">
      {isAiOrigin ? (
        <Badge
          variant="outline"
          className="max-w-[50%] gap-1 truncate border-primary/50 px-2 py-0.5 text-xs font-medium text-primary"
        >
          <img
            src={AIimage}
            alt="AI"
            className="h-3.5 w-3.5 object-contain"
          />
          AI Generated
        </Badge>
      ) : (
        <Badge
          variant="secondary"
          className="max-w-[50%] truncate"
        >
          {originBadgeLabel}
        </Badge>
      )}

      <span className="whitespace-nowrap">
        {(() => {
          const d =
            workflow?.updated_at ??
            workflow?.created_at;

          if (!d) return "—";

          const date = new Date(d);

          return Number.isNaN(date.getTime())
            ? "—"
            : format(date, "PP");
        })()}
      </span>
    </CardFooter>
  </Card>
);
}

const containerVariants = {
	hidden: { opacity: 0 },
	visible: { opacity: 1, transition: { staggerChildren: 0.07 } },
	exit: { opacity: 0, transition: { staggerChildren: 0.05, staggerDirection: -1 } },
};

const itemVariants = {
	hidden: { y: 20, opacity: 0 },
	visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 100 } },
	exit: { y: -20, opacity: 0, transition: { duration: 0.1 } },
};

const DEFAULT_PAGE_SIZE = 10;

const WorkflowDB = () => {
	const [viewMode, setViewMode] = useState<ViewMode>('grid');
	const [searchQuery, setSearchQuery] = useState('');
	const [sortOption, setSortOption] = useState<SortOption>('date-desc');
	const [currentPage, setCurrentPage] = useState(0);
	const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
	const [isLoadingWorkflow, setIsLoadingWorkflow] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const setCurrentWorkflow = useFlowStore((state) => state.setCurrentWorkflow);

	const {
		data: projects,
		isLoading,
		isFetching,
		refetch,
		dataUpdatedAt,
	} = useQuery({
		queryKey: ['virtual-dataset-list'],
		queryFn: async () => {
			const body = await getVirtualDatasetsList();
			const raw = Array.isArray(body)
				? body
				: (body as { data?: unknown })?.data;
			const list = Array.isArray(raw) ? raw : [];
			return {
				data: list.map((item: any, idx: number) =>
					mapVirtualDatasetItem(item, idx),
				),
			};
		},
		staleTime: 1000 * 60 * 10,
		refetchOnWindowFocus: false,
	});

	const getLastUpdatedTime = () => {
		if (!dataUpdatedAt || dataUpdatedAt === 0) return null;
		const date = new Date(dataUpdatedAt);
		if (isNaN(date.getTime())) return null;
		return date.toLocaleString();
	};

	const handleRefresh = () => {
		setSearchQuery('');
		setCurrentPage(0);
		setPageSize(DEFAULT_PAGE_SIZE);
		toast.info('Refreshing Virtual DB...');
		refetch();
	};

	const handleImportWorkflow = () => {
		fileInputRef.current?.click();
	};

	const handleCreateVirtualDb = () => {
		navigate('/workflows/create?virtualdb=1');
	};

	const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;
		if (!file.name.endsWith('.zip')) {
			toast.error('Please select a ZIP file');
			return;
		}
		setIsLoadingWorkflow(true);
		try {
			toast.info('Importing workflow...');
			const result = await importWorkflowApi(file);
			if (result?.status && result?.data && result.data.length > 0) {
				toast.success(result.message || `${result.data.length} workflow(s) imported successfully.`);
				const importedWorkflow = result.data[0];
				setCurrentWorkflow({ ...importedWorkflow });
				navigate(`/workflows/${importedWorkflow.id}?virtualdb=1`, { state: { openAiChat: true } });
				queryClient.invalidateQueries({ queryKey: ['virtual-dataset-list'] });
			} else {
				toast.error(resolveApiErrorMessage(result, 'Failed to import workflow.'));
			}
		} catch (error) {
			console.error('Failed to import workflow:', error);
			toast.error(getDisplayErrorMessage(error, 'Failed to import workflow.'));
		} finally {
			setIsLoadingWorkflow(false);
			if (fileInputRef.current) fileInputRef.current.value = '';
		}
	};

	const rows = useMemo(() => {
		const source = projects?.data || [];
		const filtered = source.filter((workflow: any) => {
			const q = searchQuery.toLowerCase().trim();
			if (!q) return true;
			return (
				(workflow?.name || '').toLowerCase().includes(q) ||
				(workflow?.description || '').toLowerCase().includes(q)
			);
		});
		const sorted = [...filtered].sort((a: any, b: any) => {
			switch (sortOption) {
				case 'name-asc':
					return (a.name || '').localeCompare(b.name || '');
				case 'name-desc':
					return (b.name || '').localeCompare(a.name || '');
				case 'date-asc':
					return new Date(a.created_at || a.updated_at || 0).getTime() - new Date(b.created_at || b.updated_at || 0).getTime();
				case 'date-desc':
				default:
					return new Date(b.created_at || b.updated_at || 0).getTime() - new Date(a.created_at || a.updated_at || 0).getTime();
			}
		});
		return sorted;
	}, [projects, searchQuery, sortOption]);

	const displayRows = useMemo(() => {
		const start = currentPage * pageSize;
		return rows.slice(start, start + pageSize);
	}, [rows, currentPage, pageSize]);

	const handleEdit = useCallback(
		(workflow: any) => {
			const idParam = workflow.workflow_route_id || workflow.id || workflow.workflow_id || workflow.flow_id;
			if (!idParam) {
				toast.error('Workflow ID not found');
				return;
			}
			const recordIdForApi = workflow.record_id ?? workflow.dataset_id;
			const qs = new URLSearchParams();
			qs.set('virtualdb', '1');
			if (recordIdForApi != null && String(recordIdForApi).trim() !== '') {
				const rid = String(recordIdForApi);
				qs.set('dataset_id', rid);
				qs.set('update_id', rid);
			}
			navigate(`/workflows/${idParam}?${qs.toString()}`, { state: { openAiChat: true } });
		},
		[navigate],
	);

	const handleDelete = useCallback(
		async (workflow: any) => {
			try {
				const idForApi = workflow.record_id ?? workflow.dataset_id ?? workflow.datasetId;
				if (idForApi == null || String(idForApi).trim() === '') {
					toast.error('Dataset ID not found');
					return;
				}
				await deleteVirtualDataset(String(idForApi));
				toast.success('Virtual DB deleted successfully.');
				refetch();
			} catch (error) {
				toast.error(getDisplayErrorMessage(error, 'Delete failed.'));
			}
		},
		[refetch],
	);

	return (
		<div className="w-full mx-auto py-0 px-2 md:px-2 relative">
			<div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-3">
				<div className="flex flex-col gap-1 self-start md:self-center">
					<div className="flex items-center gap-3">
						<DatabaseZap className="h-4 w-4 shrink-0 text-primary" />
						<h1 className="text-[16px] font-bold">
							Virtual DB
							{!isLoading && !isFetching && projects?.data != null && (
								<span className="ml-2 text-l text-muted-foreground">({rows.length})</span>
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
							placeholder="Search Virtual DB..."
							className="pl-9 w-full sm:w-64 !h-8"
							value={searchQuery}
							onChange={(e) => {
								setSearchQuery(e.target.value);
								setCurrentPage(0);
							}}
							disabled={isLoading || isFetching}
						/>
					</div>
					<div className="flex items-center gap-2 w-full sm:w-auto">
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
						<div className="bg-muted p-[2px] h-8 rounded-md flex items-center">
							<ToggleGroup
								type="single"
								value={viewMode}
								onValueChange={(value) => value && setViewMode(value as ViewMode)}
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
						<Button
							onClick={handleRefresh}
							variant="primary"
							className="w-full sm:w-auto !h-8 !p-2"
							disabled={isLoading || isFetching}
							title="Refresh Virtual DB"
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
						<Button onClick={handleCreateVirtualDb} variant="default" className="w-full sm:w-auto !h-7.5 !p-2">
							<FilePlus className="mr-1 h-4 w-4" />
							Virtual DB
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

			<AnimatePresence mode="wait">
				{isLoading || isFetching ? (
					<motion.div
						key="loading"
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -10 }}
						className="flex flex-col items-center justify-center text-center py-16"
					>
						<p className="text-lg font-semibold mb-2">
							{isLoadingWorkflow ? 'Loading Virtual DB...' : isLoading ? 'Loading Virtual DB...' : 'Refreshing Virtual DB...'}
						</p>
						<p className="text-muted-foreground">
							{isLoadingWorkflow ? 'Loading Virtual DB and fetching data...' : 'This may take a moment to load your Virtual DB list.'}
						</p>
					</motion.div>
				) : rows.length > 0 ? (
					viewMode === 'grid' ? (
						<>
							<ScrollArea
								key="grid"
								className="overflow-y-auto"
								style={{ height: "calc(100vh - 180px)" }}
							>
								<motion.div
									variants={containerVariants}
									initial="hidden"
									animate="visible"
									exit="exit"
									className="grid grid-cols-1 gap-2 pb-4 md:grid-cols-2 xl:grid-cols-4"
								>
									{displayRows.map((workflow: any) => (
										<motion.div key={workflow.id ?? workflow.flow_id ?? workflow.workflow_id} variants={itemVariants}>
											<VirtualDBWorkflowCard
												workflow={workflow}
												isLoadingWorkflow={isLoadingWorkflow}
												onEdit={handleEdit}
												onDelete={handleDelete}
											/>
										</motion.div>
									))}
								</motion.div>
							</ScrollArea>
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
										Math.ceil(rows.length / pageSize)
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
											Math.ceil(rows.length / pageSize) - 1
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
											Math.ceil(rows.length / pageSize) - 1
										}
										onClick={() =>
											setCurrentPage(
												Math.ceil(rows.length / pageSize) - 1
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
							<VirtualDbListTable
								workflows={displayRows}
								totalRows={rows.length}
								currentPage={currentPage}
								pageSize={pageSize}
								loading={isLoadingWorkflow}
								onPaginationChange={(page, limit) => {
									setCurrentPage(page);
									setPageSize(limit);
								}}
								onEdit={handleEdit}
								onDelete={handleDelete}
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
						<p className="text-lg font-semibold">No Virtual DB Found</p>
						<p className="text-muted-foreground mb-6">Try adjusting your search or create a new one.</p>
						<Button onClick={handleCreateVirtualDb}>
							<FilePlus className="mr-2 h-4 w-4" />
							Create a Virtual DB
						</Button>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
};

export default WorkflowDB;
