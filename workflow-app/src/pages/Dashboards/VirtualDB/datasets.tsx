import React, { useEffect, useState, useCallback, useRef } from "react";
import CreateDatasetStepper from '@/pages/DataSetPage/CreateDatasetStepper';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';
import CustomTableData from '@/components/ui/CustomTableData';
import { fetchConnectionGroup } from '@/controllers/API/connectionVaultApi';
import {
	createVirtualDatasetWithFallback,
	deleteVirtualDataset,
	deleteVirtualSubDataset,
	getVirtualDatasetsList,
	saveVirtualDataset,
} from '@/controllers/API/virtualDatasetApi';
import { Plus, SendHorizontal, ChevronDown, Trash2, LayoutGrid, List, Pen, MoreVertical, Database, Globe, Layers, GitBranch, Workflow } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import CognitoAIIcon from '@/assets/images/icons8-ai-64.png';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog-with-no-close';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import ConnectorCard from '@/components/ConnectorCard';
import connectorImages from '@/pages/CredVaultPage/images';
import AIimage from "@/assets/images/ai.png";
import { cn } from '@/lib/utils';

/** Resolve connector icon from connection label (e.g. "Postgres", "Snowflake") for saved dataset cards. */
function getConnectorIcon(connectionLabel: string): string {
	if (!connectionLabel) return (connectorImages as Record<string, string>)['PostgreSQL'] ?? '';
	const key = connectionLabel.trim();
	const map = connectorImages as Record<string, string>;
	if (map[key]) return map[key];
	const lower = key.toLowerCase();
	if (lower.includes('snowflake')) return map['Snowflake'] ?? map['PostgreSQL'] ?? '';
	if (lower.includes('postgres') || lower.includes('postgresql')) return map['PostgreSQL'] ?? '';
	if (lower.includes('mysql')) return map['MySQL'] ?? '';
	if (lower.includes('mssql') || lower.includes('sql server')) return map['MsSQL'] ?? '';
	if (lower.includes('bigquery')) return map['BigQuery'] ?? '';
	if (lower.includes('redshift')) return map['Redshift'] ?? '';
	if (lower.includes('oracle')) return map['Oracle'] ?? '';
	if (lower.includes('mongo')) return map['MongoDB'] ?? '';
	return map['PostgreSQL'] ?? '';
}

// Module-level guards to avoid duplicate API calls in React Strict Mode (dev)
let _hasFetchedConnections = false;
let _hasAutoFetchedSavedDatasets = false;


const DatasetsTabs: React.FC = () => {
	const [initialNodeForStepper, setInitialNodeForStepper] = useState<any>(undefined);
	const [isVirtualEditMode, setIsVirtualEditMode] = useState<boolean>(false);
	const [virtualDatasetName, setVirtualDatasetName] = useState<string>('');
	const [editingVirtualDatasetId, setEditingVirtualDatasetId] = useState<any>(null);
	const [editingVirtualDatasetUuid, setEditingVirtualDatasetUuid] = useState<any>(null);
	const [editingSampleRowId, setEditingSampleRowId] = useState<any>(null);

	// Detect whether we're on the Virtual DB route
	const location = useLocation();
	const isVirtualDb = /virtual[- ]?db/i.test(location.pathname);

	// Table columns (real fields). Start with no rows — data will be loaded from the backend.
	const sampleCols = [
		{ key: 'datasetName', header: 'Dataset Name' },
		{ key: 'connection', header: 'Connection' },
		{ key: 'database', header: 'Database' },
		{ key: 'schema', header: 'Schema' },
		{ key: 'table', header: 'Table' },
	];
	const sampleColsWithActions = [...sampleCols, { key: 'actions', header: 'Actions' }];

	// Columns for the saved list include actions
	const savedCols = [...sampleCols, { key: 'actions', header: 'Actions' }];
	const [sampleData, setSampleData] = useState<any[]>([]); // no mock rows initially
	const [connectionsMap, setConnectionsMap] = useState<Record<string, string>>({});

	// Saved datasets fetched from backend (initial list view)
	const [savedData, setSavedData] = useState<any[]>([]);
	const [loadingSaved, setLoadingSaved] = useState(false);
	// When false: show saved datasets table. When true: show create-new UI (existing table + stepper).
	const [showCreateMode, setShowCreateMode] = useState(false);
	// 'list' = CustomTableData, 'grid' = ConnectorCard cards
	const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
	// create-mode tabs: 'database' shows the existing create UI; others are placeholders
	const [createTab, setCreateTab] = useState<'database' | 'add-dataset' | 'tab3' | 'tab4'>('database');

	const normalizeStepperNode = (
		rawNode: any,
		fallbackDatasetName: string = '',
		configSnapshot?: Record<string, any>,
		propertiesSnapshot: any[] = []
	) => {
		if (!rawNode) return undefined;
		const sourceNode = rawNode?.node ?? rawNode;
		const basePayload = sourceNode?.payload ? JSON.parse(JSON.stringify(sourceNode.payload)) : {};
		const mergedPayload = {
			...basePayload,
			...(configSnapshot || {}),
			name: (configSnapshot?.name ?? configSnapshot?.datasetName ?? fallbackDatasetName ?? basePayload?.name ?? '').toString(),
			columns: configSnapshot?.columns ?? basePayload?.columns ?? (propertiesSnapshot?.length ? propertiesSnapshot.map((p: any) => p?.name).filter(Boolean) : []),
			properties: propertiesSnapshot?.length ? propertiesSnapshot : (configSnapshot?.properties ?? basePayload?.properties ?? []),
		};
		return {
			node_id: rawNode?.node_id ?? sourceNode?.node_id ?? sourceNode?.icon ?? 'virtual-db',
			name: rawNode?.name ?? sourceNode?.name ?? sourceNode?.display_name ?? fallbackDatasetName ?? '',
			display_name: rawNode?.display_name ?? sourceNode?.display_name ?? sourceNode?.name ?? fallbackDatasetName ?? '',
			group: rawNode?.group ?? sourceNode?.group ?? 'Databases',
			icon: rawNode?.icon ?? sourceNode?.icon ?? '',
			description: rawNode?.description ?? sourceNode?.description ?? '',
			klass_name: rawNode?.klass_name,
			show_node: rawNode?.show_node,
			modules: rawNode?.modules,
			node: {
				...sourceNode,
				payload: mergedPayload,
			},
		};
	};

	useEffect(() => {
		if (_hasFetchedConnections) return;
		_hasFetchedConnections = true;

		const fetchConnections = async () => {
			try {
				const result = await fetchConnectionGroup('/databases/get-connections', {
					connection_id: '',
					group_type: 'databases',
				});
				if (result.status && result.data) {
					const map: Record<string, string> = {};
					(result.data as any[]).forEach((c: any) => {
						map[c.id?.toString()] = c.name ?? c.display_name ?? '';
					});
					setConnectionsMap(map);
				}
			} catch (err) {
				console.error('Failed to fetch connections', err);
			}
		};

		fetchConnections();
	}, []);

	// Fetch saved virtual datasets once connectionsMap is available (for labels)
	const fetchSavedDatasets = useCallback(async (force: boolean = false) => {
		// Only auto-fetch once on mount unless forced
		if (!force && _hasAutoFetchedSavedDatasets) return;
		if (!force) _hasAutoFetchedSavedDatasets = true;

		setLoadingSaved(true);
		try {
			const result = await getVirtualDatasetsList();
			const list = Array.isArray(result)
				? result
				: (result as { data?: unknown[] })?.data || [];
			const mapped = (list || []).map((item: any, idx: number) => {
				const node0 = (item.node && item.node[0]) ? item.node[0] : undefined;
				const payload = node0?.payload || {};
				const connectionVal = (payload.connection ?? payload.connection_id ?? payload.connectionId ?? '')?.toString();
				return {
					id: item.id ?? item.node_id ?? `${Date.now()}_${idx}`,
					datasetId: item.id ?? item.node_id ?? null,
					datasetUuid: item.dataset_id ?? null,
					sourceNodeId: item.node_id ?? node0?.node_id ?? null,
					datasetName: item.name ?? item.display_name ?? payload.name ?? '',
					connection: connectionVal,
					connectionLabel: connectionVal ? (connectionsMap[connectionVal] ?? connectionVal) : '',
					database: payload.database ?? '',
					schema: payload.schema ?? '',
					table: payload.table ?? '',
					columns: payload.columns ?? [],
					properties: payload.properties ?? [],
					nodeDetails: node0 ? { node: node0 } : null,
					nodeList: Array.isArray(item.node) ? item.node : (item.node ? [item.node] : [])
				};
			});
			setSavedData(mapped);
		} catch (err) {
			console.error('Failed to fetch saved datasets', err);
			toast.error(getDisplayErrorMessage(err, 'Failed to load virtual datasets'));
		} finally {
			setLoadingSaved(false);
		}
	}, [connectionsMap]);

	useEffect(() => {
		fetchSavedDatasets();
	}, [connectionsMap, fetchSavedDatasets]);

	// If user navigates to Virtual DB via client-side routing (no hard refresh),
	// ensure we force a fetch of the saved dataset list.
	useEffect(() => {
		if (isVirtualDb) {
			fetchSavedDatasets(true);
		}
	}, [isVirtualDb, fetchSavedDatasets]);

	// Step2 completion should no longer add rows to the table immediately.
	// The row will be added when the user clicks "Add to Table" in Step4.
	const handleStep2Complete = (config: Record<string, any>) => {
		// Intentionally no-op for updating the table here.
		// Kept for telemetry or future use if needed.
		console.log('[DatasetsTabs] Step2 completed (no table update):', config);
	};

	// Called when user clicks "Add to Table" from the Step4 preview.
	// Accept optional nodeDetails so we can remember the last-selected node.
	const handleAddToTable = (config: Record<string, any>, properties: any[] = [], nodeDetails?: any) => {
		// Use raw connection value (id) rather than its label
		const connectionVal = (config.connection ?? config.connection_id ?? config.connectionId ?? '')?.toString();
		const row = {
			id: Date.now(),
			datasetName: config.name ?? config.datasetName ?? '',
			connection: connectionVal,
			connectionLabel: connectionVal ? (connectionsMap[connectionVal] ?? connectionVal) : '',
			database: config.database ?? '',
			schema: config.schema ?? '',
			table: config.table ?? '',
			columns: config.columns ?? (properties.length ? properties.map(p => p.name).filter(Boolean) : []),
			properties: properties || [],
			configSnapshot: config || {},
			nodeDetails: nodeDetails || null
		};

		if (isVirtualEditMode) {
			const incomingSubDatasetId = nodeDetails?.node?.sub_dataset_id ?? null;
			setSampleData(prev => {
				const targetBySubDataset = incomingSubDatasetId
					? prev.find((r) => (r?.subDatasetId ?? r?.nodeDetails?.node?.sub_dataset_id ?? null) === incomingSubDatasetId)?.id
					: null;
				const targetRowId = editingSampleRowId ?? targetBySubDataset ?? prev[0]?.id ?? null;

				if (targetRowId == null) return prev;

				return prev.map((r) => {
					if (r.id !== targetRowId) return r;
					return {
						...r,
						datasetName: row.datasetName,
						connection: row.connection,
						connectionLabel: row.connectionLabel,
						database: row.database,
						schema: row.schema,
						table: row.table,
						columns: row.columns,
						properties: row.properties,
						nodeDetails: row.nodeDetails,
					};
				});
			});
			setEditingSampleRowId(null);
		} else {
			setSampleData(prev => [row, ...prev]);
		}
		// Persist last selected node for future auto-selection
		if (nodeDetails) {
			try { localStorage.setItem('lastSelectedNode', JSON.stringify(nodeDetails)); } catch (e) { /* ignore */ }
			const normalizedNode = normalizeStepperNode(nodeDetails, row.datasetName, config, properties);
			if (normalizedNode) {
				setInitialNodeForStepper(normalizedNode);
			}
		}
	};


	const [isSavingAll, setIsSavingAll] = useState(false);

	const navigate = useNavigate();

	const handleEdit = (datasetId: any) => {
		if (!datasetId) return;
		// If we're on the Virtual DB route, open create mode and preload the table
		if (isVirtualDb) {
			const found = savedData.find((d) => (d.datasetId ?? d.id) === datasetId || d.id === datasetId);
			if (found) {
				const nodeList = Array.isArray(found.nodeList) && found.nodeList.length
					? found.nodeList
					: (found.nodeDetails?.node ? [found.nodeDetails.node] : []);
				const savedNode = nodeList[0];
				const normalizedNode = savedNode ? {
					node_id: found.sourceNodeId ?? savedNode.node_id ?? savedNode.icon ?? 'virtual-db',
					name: savedNode.name ?? found.datasetName ?? '',
					display_name: savedNode.display_name ?? savedNode.name ?? found.datasetName ?? '',
					group: savedNode.group ?? 'Databases',
					icon: savedNode.icon ?? '',
					description: savedNode.description ?? '',
					node: savedNode,
				} : undefined;

				const rows = nodeList.map((n: any, i: number) => {
					const p = n?.payload || {};
					const connectionVal = (p.connection ?? p.connection_id ?? p.connectionId ?? found.connection ?? '')?.toString();
					return {
						id: `${datasetId}_${i}_${Date.now()}`,
						datasetId: found.datasetId,
						datasetUuid: found.datasetUuid ?? null,
						sourceNodeId: found.sourceNodeId,
						subDatasetId: n?.sub_dataset_id ?? null,
						datasetName: p.name ?? found.datasetName ?? '',
						connection: connectionVal,
						connectionLabel: connectionVal ? (connectionsMap[connectionVal] ?? connectionVal) : '',
						database: p.database ?? '',
						schema: p.schema ?? '',
						table: p.table ?? '',
						columns: p.columns ?? [],
						properties: p.properties ?? [],
						nodeDetails: { node: n }
					};
				});

				// In edit mode, show all payload rows for this single dataset id
				setSampleData(rows);
				setShowCreateMode(true);
				setInitialNodeForStepper(normalizedNode);
				setIsVirtualEditMode(true);
				setVirtualDatasetName((found.datasetName ?? '').toString());
				setEditingVirtualDatasetId(found.datasetId ?? found.id ?? null);
				setEditingVirtualDatasetUuid(found.datasetUuid ?? null);
				setEditingSampleRowId(rows[0]?.id ?? null);
				if (normalizedNode) {
					try { localStorage.setItem('lastSelectedNode', JSON.stringify(normalizedNode)); } catch (e) { /* ignore */ }
				}
				return;
			}
		}
		navigate(`/datasets/${datasetId}/edit`);
	};

	const handleDelete = async (datasetId: any) => {
		if (!datasetId) return;
		setPendingSampleDeleteRow(null);
		setDeletingId(datasetId);
		setDeleteDialogOpen(true);
	};

	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [deletingId, setDeletingId] = useState<any>(null);
	const [pendingSampleDeleteRow, setPendingSampleDeleteRow] = useState<any>(null);

	const handleEditSampleRow = (row: any) => {
		const savedNode = row?.nodeDetails?.node;
		if (!savedNode) return;
		const normalizedNode = {
			node_id: savedNode.node_id ?? row.sourceNodeId ?? savedNode.icon ?? 'virtual-db',
			name: savedNode.name ?? row.datasetName ?? '',
			display_name: savedNode.display_name ?? savedNode.name ?? row.datasetName ?? '',
			group: savedNode.group ?? 'Databases',
			icon: savedNode.icon ?? '',
			description: savedNode.description ?? '',
			node: savedNode,
		};
		setInitialNodeForStepper(normalizedNode);
		setIsVirtualEditMode(true);
		setShowCreateMode(true);
		setEditingSampleRowId(row?.id ?? null);
		try { localStorage.setItem('lastSelectedNode', JSON.stringify(normalizedNode)); } catch (e) { /* ignore */ }
	};

	const handleDeleteSampleRow = (row: any) => {
		setDeletingId(null);
		setPendingSampleDeleteRow(row);
		setDeleteDialogOpen(true);
	};

	const confirmDelete = async () => {
		if (!deletingId && !pendingSampleDeleteRow) return;
		setDeleteDialogOpen(false);
		if (pendingSampleDeleteRow) {
			const row = pendingSampleDeleteRow;
			const datasetIdForDelete = row?.datasetUuid ?? null;
			const subDatasetId = row?.subDatasetId ?? row?.nodeDetails?.node?.sub_dataset_id ?? null;

			// Only call the backend for sub-dataset delete when we're in edit mode
			if (isVirtualEditMode && datasetIdForDelete && subDatasetId) {
				try {
					await toast.promise(
						deleteVirtualSubDataset(
							`${datasetIdForDelete}`,
							`${subDatasetId}`,
						),
						{
							loading: 'Deleting sub dataset...',
							success: 'Sub dataset deleted',
							error: (err: unknown) =>
								getDisplayErrorMessage(err, 'Delete failed'),
						},
					);
					setSampleData((prev) => prev.filter((r) => r.id !== row.id));
					await fetchSavedDatasets(true);
				} catch (err) {
					console.error('Delete sub dataset failed', err);
				} finally {
					setPendingSampleDeleteRow(null);
				}
				return;
			}

			// Local-only row (create mode) — just remove from local state, no API call
			setSampleData((prev) => prev.filter((r) => r.id !== row.id));
			setPendingSampleDeleteRow(null);
			return;
		}

		try {
			await toast.promise(deleteVirtualDataset(`${deletingId}`), {
				loading: 'Deleting dataset...',
				success: 'Dataset deleted',
				error: (err: unknown) =>
					getDisplayErrorMessage(err, 'Delete failed'),
			});
			await fetchSavedDatasets(true);
		} catch (err) {
			console.error('Delete failed', err);
		} finally {
			setDeletingId(null);
			setPendingSampleDeleteRow(null);
		}
	};

	// List view: table columns (shared structure for saved and sample)
	const listViewColumns = [
		{ key: 'datasetName', header: 'Dataset Name', sortable: true },
		{ key: 'connectionLabel', header: 'Connection', sortable: true },
		{ key: 'database', header: 'Database', sortable: true },
		{ key: 'schema', header: 'Schema', sortable: true },
		{ key: 'table', header: 'Table', sortable: true },
		{ key: 'actions', header: 'Actions', sortable: false, align: 'right' as const, colWidth: 120 },
	];

	// Saved datasets formatted for CustomTableData (list view)
	const savedTableData = React.useMemo(() => {
		return savedData.map((d) => {
			const connectionLabel = d.connectionLabel ?? (d.connection ? (connectionsMap[d.connection] ?? d.connection) : '');
			return {
				id: d.id,
					datasetName: (
						<a
							href="#"
							onClick={(e) => { e.preventDefault(); handleEdit(d.datasetId ?? d.id); }}
							className="text-primary hover:underline cursor-pointer"
						>
							{d.datasetName}
						</a>
					),
				connectionLabel: connectionLabel || '-',
				database: d.database || '-',
				schema: d.schema || '-',
				table: d.table || '-',
				actions: (
					<div className="flex items-center ">
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" size="icon" className="h-8 w-8" aria-label="More">
									<MoreVertical className="h-4 w-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem onClick={() => handleEdit(d.datasetId)} className="text-primary focus:text-primary data-[state=open]:bg-primary/10">
									<Pen className="h-4 w-4 mr-2 text-primary" />
									Edit
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem className="text-red-500 focus:text-red-600 data-[state=open]:bg-red-100" onClick={() => handleDelete(d.datasetId)}>
									<Trash2 className="h-4 w-4 mr-2 text-red-400" />
									Delete
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				),
			};
		});
	}, [savedData, connectionsMap, handleEdit, handleDelete]);

	// Sample rows (create mode) formatted for CustomTableData (list view)
	const sampleTableData = React.useMemo(() => {
		return sampleData.map((row) => {
			const connectionLabel = row.connectionLabel ?? (row.connection ? (connectionsMap[row.connection] ?? row.connection) : '');
			return {
				id: row.id,
					datasetName: (
						<a
							href="#"
							onClick={(e) => { e.preventDefault(); handleEditSampleRow(row); }}
							className="text-primary hover:underline cursor-pointer"
						>
							{row.datasetName || '-'}
						</a>
					),
				connectionLabel: connectionLabel || '-',
				database: row.database || '-',
				schema: row.schema || '-',
				table: row.table || '-',
				actions: (
					<div className="flex items-center">
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" size="icon" className="h-8 w-8" aria-label="More">
									<MoreVertical className="h-4 w-4 " />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem onClick={() => handleEditSampleRow(row)} className="text-primary focus:text-primary data-[state=open]:bg-primary/10">
									<Pen className="h-4 w-4 mr-2 text-primary" />
									Edit
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem className="text-red-500 focus:text-red-600 data-[state=open]:bg-red-100" onClick={() => handleDeleteSampleRow(row)}>
									<Trash2 className="h-4 w-4 mr-2 text-red-400" />
									Delete
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				),
			};
		});
	}, [sampleData, connectionsMap, handleEditSampleRow, handleDeleteSampleRow]);

	const handleSaveAll = async () => {
		if (!sampleData.length) {
			toast.error('No rows to save');
			return;
		}

		const datasetNameValue = virtualDatasetName.trim();
		if (!datasetNameValue) {
			toast.error('Please enter a dataset name');
			return;
		}

		// Build nodes array from sampleData. Use lastSelectedNode as a template if available.
		let lastNodeTemplate: any = undefined;
		try { const n = localStorage.getItem('lastSelectedNode'); lastNodeTemplate = n ? JSON.parse(n) : undefined; } catch (e) { /* ignore */ }

		const nodes = sampleData.map((row) => {
			// Build payload from stored nodeDetails.template if available, otherwise use defaults
			const basePayload = row.nodeDetails?.node?.payload ? JSON.parse(JSON.stringify(row.nodeDetails.node.payload)) : {};
			const payload: any = {
				key: 'on-submit',
				mode: 'read',
				name: row.datasetName || row.name || '',
				query: '',
				table: row.table || '',
				schema: row.schema || '',
				actions: 'get_data',
				columns: row.columns || [],
				database: row.database || '',
				is_pandas: false,
				is_polars: false,
				connection: (() => {
					const num = Number(row.connection);
					return Number.isFinite(num) ? num : row.connection;
				})(),
				properties: row.properties || [],
				actions_write: 'write_data'
			};

			// Merge basePayload into payload where keys are missing
			Object.keys(basePayload || {}).forEach((k) => {
				if (payload[k] === undefined) payload[k] = basePayload[k];
			});

			// Ensure name, columns and properties from the row are applied
			payload.name = row.datasetName || payload.name;
			payload.columns = row.columns || payload.columns || [];
			payload.properties = row.properties || payload.properties || [];

			return {
				payload,
				get_data: (lastNodeTemplate && lastNodeTemplate.get_data) ? lastNodeTemplate.get_data : { klass: 'postgresql-actions', method: 'post', module: 'databases' },
				template: (lastNodeTemplate && lastNodeTemplate.template) ? lastNodeTemplate.template : {},
				save_node: (lastNodeTemplate && lastNodeTemplate.save_node) ? lastNodeTemplate.save_node : { klass: 'create-workflow-node', method: 'post', module: 'work-flow-nodes', enabled: true }
			};
		});

		const updateId = editingVirtualDatasetId ?? editingVirtualDatasetUuid ?? sampleData[0]?.datasetId ?? sampleData[0]?.datasetUuid ?? null;
		const isFileSource = lastNodeTemplate?.group === 'Files' || lastNodeTemplate?.dataset_type === 'Files' || /file|csv|parquet|json|excel|sftp|blob/i.test(String(lastNodeTemplate?.node_id ?? lastNodeTemplate?.icon ?? lastNodeTemplate?.node?.node_id ?? ''));
		const virtualdb = isFileSource
			? 'files'
			: createTab === 'database'
				? 'database_ingestion'
				: createTab === 'add-dataset'
					? 'api'
					: createTab === 'tab3'
						? 'pipeline'
						: 'dataset';
		const payload = {
			name: datasetNameValue,
			dataset_type: 'Databases',
			group: 'Databases',
			node: nodes,
			node_id: (() => {
				const candidate = lastNodeTemplate?.node_id ?? lastNodeTemplate?.nodeId ?? lastNodeTemplate?.node?.node_id;
				if (typeof candidate === 'string' && candidate.trim().length > 0) return candidate;
				if (typeof lastNodeTemplate?.icon === 'string' && lastNodeTemplate.icon.trim().length > 0) return lastNodeTemplate.icon;
				return 'virtual-db';
			})(),
			display_name: lastNodeTemplate?.display_name ?? lastNodeTemplate?.name ?? 'VirtualDB',
			klass_name: lastNodeTemplate?.klass_name ?? 'PostgresqlConnector',
			show_node: true,
			modules: lastNodeTemplate?.modules ?? 'connectors.databases.postgresql',
			icon: lastNodeTemplate?.icon ?? 'postgres-sql',
			is_dataset: true,
			virtualdb,
			...(isVirtualEditMode && updateId ? { dataset_id: `${updateId}`, update_id: `${updateId}` } : {})
		};

		setIsSavingAll(true);
		try {
			const savePromise = isVirtualEditMode
				? createVirtualDatasetWithFallback(payload)
				: saveVirtualDataset('/virtual-dataset/create-dataset', payload);

			await toast.promise(savePromise, {
				loading: isVirtualEditMode
					? 'Updating virtual dataset...'
					: 'Saving virtual dataset...',
				success: isVirtualEditMode
					? 'Virtual dataset updated'
					: 'Virtual dataset saved',
				error: (err: unknown) =>
					getDisplayErrorMessage(err, 'Save failed'),
			});
			// After successful save, show saved datasets list and refresh it
			setShowCreateMode(false);
			setSampleData([]);
			setVirtualDatasetName('');
			setInitialNodeForStepper(undefined);
			setIsVirtualEditMode(false);
			setEditingSampleRowId(null);
			setEditingVirtualDatasetId(null);
			setEditingVirtualDatasetUuid(null);
			try {
				await fetchSavedDatasets();
			} catch (e) { /* ignore */ }
			// Retry once after a short delay in case the backend needs time to persist
			setTimeout(() => { try { fetchSavedDatasets(); } catch (e) { /* ignore */ } }, 800);
		} catch (err) {
			console.error('Save failed', err);
		} finally {
			setIsSavingAll(false);
		}
	};

	let persistedInitialNode: any = undefined;
	try {
		const n = localStorage.getItem('lastSelectedNode');
		persistedInitialNode = n ? JSON.parse(n) : undefined;
	} catch (e) {
		persistedInitialNode = undefined;
	}

	const stepperInitialNode = (isVirtualEditMode || sampleData.length > 0)
		? (initialNodeForStepper ?? persistedInitialNode)
		: undefined;
	const shouldDisableNodeSelection = isVirtualEditMode || (!!stepperInitialNode && sampleData.length > 0);

	const [aiQuery, setAiQuery] = useState<string>("");
	const [inputFocused, setInputFocused] = useState(false);
	const aiInputRef = useRef<HTMLInputElement>(null);

	// Continuous typing animation for prompt text (stops when user is ready to type: focused or has value)
	const TYPING_FULL_TEXT = "Read two sources a CSV and a postgres node. Join two nodes and filter data, then save to";
	const [typingVisibleLength, setTypingVisibleLength] = useState(0);
	const [typingPhase, setTypingPhase] = useState<'typing' | 'hold' | 'deleting'>('typing');
	const typingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const isInputActive = inputFocused || (aiQuery.trim().length > 0);

	useEffect(() => {
		if (isInputActive) {
			if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
			typingIntervalRef.current = null;
			return;
		}

		const TYPING_MS = 50;
		const HOLD_MS = 2000;
		const DELETE_MS = 25;

		const run = () => {
			setTypingVisibleLength((prev) => {
				if (typingPhase === 'typing') {
					if (prev >= TYPING_FULL_TEXT.length) {
						setTypingPhase('hold');
						return prev;
					}
					return prev + 1;
				}
				if (typingPhase === 'deleting') {
					if (prev <= 0) {
						setTypingPhase('typing');
						return 0;
					}
					return prev - 1;
				}
				return prev;
			});
		};

		if (typingPhase === 'hold') {
			typingIntervalRef.current = window.setTimeout(() => setTypingPhase('deleting'), HOLD_MS) as unknown as ReturnType<typeof setInterval>;
			return () => { if (typingIntervalRef.current) clearTimeout(typingIntervalRef.current as unknown as number); };
		}

		const ms = typingPhase === 'typing' ? TYPING_MS : DELETE_MS;
		typingIntervalRef.current = setInterval(run, ms);
		return () => {
			if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
		};
	}, [typingPhase, isInputActive]);

	// Local model selector for AI queries (pipeline presets)
	const [model, setModel] = useState<string>('');
	const models = [
		{ key: 'elt', label: 'ELT Pipeline' },
		{ key: 'dq', label: 'Data Quality' },
		{ key: 'recon', label: 'Reconciliation' },
		{ key: 'ops', label: 'Operations' },
		{ key: 'analytics', label: 'Analytics' },
	];

	const aiSuggestionText = (() => {
		if (!showCreateMode) {
			return 'Start with + to create a Virtual DB dataset. Use a clear dataset name like org_domain_entity_v1 and keep source table naming consistent.';
		}

		if (!sampleData.length) {
			return 'Select connector and configure your first source. Keep connection, schema, and table aligned with your org naming standard for easier governance.';
		}

		return 'Connector is locked for consistency. For next row, update schema/table and selected properties only. Keep column names normalized (snake_case) across all rows.';
	})();

	const onAiSend = () => {
		if (!aiQuery || !aiQuery.trim()) {
			toast('Please enter a predicate or question');
			return;
		}
		// Placeholder: integrate with AI backend here. For now show a toast.
		toast.success('AI query sent');
	};

	return (
		<div className="w-full pr-2">
			{/* Line 1: Virtual DB Generator */}
			{!showCreateMode && (
				<div className="mb-2">
					<span className="text-sm font-semibold text-primary pl-1">Virtual DB Generator</span>
				</div>
			)}

			{/* Line 2: AI box */}
			{!showCreateMode && (
				<div className="flex items-center gap-2 rounded-lg border p-2 mb-3 w-full backdrop-blur-sm border-slate-200">
				<img src={AIimage} alt="Cognito AI" className={cn("h-7 w-7 flex-shrink-0 object-contain")} aria-hidden />
				<div className="relative flex-1 min-w-[120px] flex items-center h-9 rounded-md overflow-hidden">
					<Input
						ref={aiInputRef}
						value={aiQuery}
						onChange={(e) => setAiQuery(e.target.value)}
						onFocus={() => setInputFocused(true)}
						onBlur={() => setInputFocused(false)}
						placeholder={TYPING_FULL_TEXT}
						className="h-9 text-sm pr-3 pl-3 border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none bg-transparent"
						aria-label="AI query or prompt"
					/>
					{!isInputActive && (
						<div
							className="absolute inset-0 flex items-center pl-3 pr-3 pointer-events-none text-sm text-muted-foreground overflow-hidden"
							aria-hidden
						>
							<span className="truncate">
								{TYPING_FULL_TEXT.slice(0, typingVisibleLength)}
								<span className="inline-block w-0.5 h-4 bg-primary ml-0.5 animate-pulse align-middle" />
							</span>
						</div>
					)}
				</div>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<div
							className="flex items-center gap-2 h-8 min-w-[120px] max-w-[160px] px-2 rounded-md border shadow-sm cursor-pointer flex-shrink-0"
							aria-label="Select model"
							role="button"
							tabIndex={0}
						>
							<span className={`flex-1 truncate text-left text-sm ${model ? 'text-foreground' : 'text-muted-foreground'}`}>
								{model ? models.find(m => m.key === model)?.label : 'Select model'}
							</span>
							<ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
						</div>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start">
						{models.map(m => (
							<DropdownMenuItem key={m.key} onClick={() => setModel(m.key)}>
								{m.label}
							</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
				<Button variant="outline" onClick={onAiSend} size="icon" className="!h-8 !w-8 shrink-0 !border-0" aria-label="Send AI query">
					<SendHorizontal className="h-4 w-4" />
				</Button>
				</div>
			)}

			{/* Line 3: Saved Datasets title + Add button (hidden altogether in create mode) */}
			{!showCreateMode && (
				<div className="flex items-center gap-2 mb-2 justify-between">
					<h3 className="text-xl font-medium whitespace-nowrap">Virtual Databases <span className="text-muted-foreground text-sm">({savedData.length})</span></h3>
					<div className="flex items-center gap-2">
						<TooltipProvider>
							<Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'list' | 'grid')}>
								<TabsList className="border rounded-md p-0.5 !h-7">
									<TabsTrigger value="list" className="!h-6 !w-6 p-0">
										<List className="h-4 w-4" />
									</TabsTrigger>
									<TabsTrigger value="grid" className="!h-6 !w-6 p-0">
										<LayoutGrid className="h-4 w-4" />
									</TabsTrigger>
								</TabsList>
							</Tabs>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="outline"
										size="icon"
										className="!h-7 px-2 shrink-0"
										onClick={() => {
											setInitialNodeForStepper(undefined);
											setIsVirtualEditMode(false);
											setVirtualDatasetName('');
											setEditingSampleRowId(null);
											setEditingVirtualDatasetId(null);
											setEditingVirtualDatasetUuid(null);
											setSampleData([]);
											setShowCreateMode(true);
										}}
										aria-label="Add dataset"
									>
										<Plus className="h-4 w-4" />
										<span>Database</span>
									</Button>
								</TooltipTrigger>
								<TooltipContent>
									<span>Add Database</span>
								</TooltipContent>
								</Tooltip>
							</TooltipProvider>
					</div>
				</div>
			)}

			{/* Datasets list */}
			<div className="w-full">
				{!showCreateMode ? (
					<div>
						{loadingSaved ? (
							<div className="p-4 text-sm text-muted-foreground">Loading...</div>
						) : viewMode === 'list' ? (
							<div className="border rounded-md overflow-hidden">
								<CustomTableData
									data={savedTableData}
									columns={listViewColumns}
									rowKey="id"
									scrollHeightClass="max-h-[60vh]"
									emptyState={<div className="p-8 text-center text-muted-foreground">No virtual databases yet. Click + to add one.</div>}
								/>
							</div>
						) : (
							<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-1 space-y-1">
								{savedData.map((d) => {
										const connectionLabel = d.connectionLabel ?? (d.connection ? (connectionsMap[d.connection] ?? d.connection) : '');
										return (
											<a
												key={d.id}
												href="#"
												onClick={(e) => { e.preventDefault(); handleEdit(d.datasetId); }}
												className="block"
											>
												<ConnectorCard
													title={d.datasetName}
													connectionLabel={connectionLabel}
													database={d.database}
													schema={d.schema}
													table={d.table}
													iconSrc={getConnectorIcon(connectionLabel)}
													onEdit={() => handleEdit(d.datasetId)}
													onDelete={() => handleDelete(d.datasetId)}
													variant="saved"
												/>
											</a>
										);
									})}
							</div>
						)}
					</div>
					) : (
						<div className="flex flex-col min-h-[calc(100vh-10rem)]">
							<div className="flex items-center gap-2 mb-2 justify-between">
								<Tabs value={createTab} onValueChange={(v) => setCreateTab(v as any)}>
									<TabsList className="flex gap-2 items-center">
										<TabsTrigger
											value="database"
											className="flex items-center gap-2 px-3 py-1 rounded-full border bg-transparent data-[state=active]:bg-primary data-[state=active]:text-white"
										>
											<Database className="h-4 w-4" />
											<span className="text-sm font-medium">Database</span>
										</TabsTrigger>
										<TabsTrigger
											value="add-dataset"
											className="flex items-center gap-2 px-3 py-1 rounded-full border bg-transparent data-[state=active]:bg-primary data-[state=active]:text-white"
										>
											<Globe className="h-4 w-4" />
											<span className="text-sm font-medium">API</span>
										</TabsTrigger>
										<TabsTrigger
											value="tab3"
											className="flex items-center gap-2 px-3 py-1 rounded-full border bg-transparent data-[state=active]:bg-primary data-[state=active]:text-white"
										>
											<Workflow className="h-4 w-4" />
											<span className="text-sm font-medium">Pipeline</span>
										</TabsTrigger>
										<TabsTrigger
											value="tab4"
											className="flex items-center gap-2 px-3 py-1 rounded-full border bg-transparent data-[state=active]:bg-primary data-[state=active]:text-white"
										>
											<Database className="h-4 w-4 " />
											<span className="text-sm font-medium">Dataset</span>
										</TabsTrigger>
									</TabsList>
								</Tabs>
								<div className="flex items-center gap-2">
									<TooltipProvider>
										<Tooltip>
											<TooltipTrigger asChild>
												<div>
													<Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'list' | 'grid')}>
													<TabsList className="border rounded-md p-0.5 !h-7">
														<TabsTrigger value="list" className="!h-6 !w-6 p-0">
															<List className="h-4 w-4" />
														</TabsTrigger>
														<TabsTrigger value="grid" className="!h-6 !w-6 p-0">
															<LayoutGrid className="h-4 w-4" />
														</TabsTrigger>
													</TabsList>
												</Tabs>
											</div>
										</TooltipTrigger>
											<TooltipContent>
												<span>Toggle view</span>
											</TooltipContent>
										</Tooltip>
									</TooltipProvider>
								</div>
							</div>
							{/* Tab panels for create-mode */}
							{createTab === 'database' ? (
								<>
									{viewMode === 'list' ? (
										<div className="border rounded-md overflow-hidden">
											<CustomTableData
												data={sampleTableData}
												columns={listViewColumns}
												rowKey="id"
												scrollHeightClass="max-h-[40vh]"
												emptyState={<div className="p-6 text-center text-muted-foreground">No datasets added yet. Use the stepper below to add.</div>}
											/>
										</div>
									) : (
										<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-1 space-y-1">
											{sampleData.map((row) => {
													const connectionLabel = row.connectionLabel ?? (row.connection ? (connectionsMap[row.connection] ?? row.connection) : '');
													return (
														<a
															key={row.id}
															href="#"
															onClick={(e) => { e.preventDefault(); handleEditSampleRow(row); }}
															className="block"
														>
															<ConnectorCard
																title={row.datasetName}
																connectionLabel={connectionLabel || row.connection}
																database={row.database}
																schema={row.schema}
																table={row.table}
																iconSrc={getConnectorIcon(connectionLabel)}
																variant="sample"
																showFooterButtons={true}
																onEditRow={() => handleEditSampleRow(row)}
																onDeleteRow={() => handleDeleteSampleRow(row)}
															/>
														</a>
													);
												})}
										</div>
									)}
									<div className="flex items-center justify-between mt-2 px-1">
										<div className="w-full max-w-sm ">
											<label className="text-xs font-medium">Dataset Name <span className="text-red-500">*</span></label>
											<Input
												value={virtualDatasetName}
												onChange={(e) => setVirtualDatasetName(e.target.value)}
												placeholder="Enter dataset name"
												className="h-8 mt-1"
											/>
										</div>

										<Button onClick={handleSaveAll} disabled={!sampleData.length || isSavingAll} className="!h-8 text-sm">
											{isSavingAll ? (isVirtualEditMode ? 'Updating...' : 'Saving...') : (isVirtualEditMode ? 'Update Data' : 'Save')}
										</Button>
									</div>
									<div className="mt-2 flex-1 flex flex-col min-h-0">
										<CreateDatasetStepper
											isVirtualDb={true}
											onStep2Complete={handleStep2Complete}
											onAddToTable={handleAddToTable}
											isVirtualEditMode={isVirtualEditMode}
											onClose={() => {
												setShowCreateMode(false);
												setSampleData([]);
												setVirtualDatasetName('');
												setInitialNodeForStepper(undefined);
												setIsVirtualEditMode(false);
												setEditingSampleRowId(null);
												setEditingVirtualDatasetId(null);
												setEditingVirtualDatasetUuid(null);
												try { fetchSavedDatasets(true); } catch (e) { /* ignore */ }
											}}
											initialSelectedNode={stepperInitialNode}
											disableNodeSelection={shouldDisableNodeSelection}
											key={isVirtualEditMode
												? `stepper-edit-${editingSampleRowId ?? initialNodeForStepper?.node?.sub_dataset_id ?? initialNodeForStepper?.node_id ?? 'initial'}`
												: `stepper-create-${sampleData.length}`}
										/>
									</div>
								</>
							) : (
								<div className="border rounded-md p-4 min-h-[220px] flex items-center justify-center text-muted-foreground">
									Coming soon
								</div>
							)}
						</div>
				)}
			</div>

			<Dialog open={deleteDialogOpen} onOpenChange={(open) => {
				setDeleteDialogOpen(open);
				if (!open) {
					setPendingSampleDeleteRow(null);
					setDeletingId(null);
				}
			}}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{pendingSampleDeleteRow ? 'Delete sub dataset' : 'Delete dataset'}</DialogTitle>
						<DialogDescription>
							{pendingSampleDeleteRow
								? 'Are you sure you want to delete this row from the dataset? This action cannot be undone.'
								: 'Are you sure you want to delete this dataset? This action cannot be undone.'}
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="flex gap-2">
						<Button variant="outline" onClick={() => {
							setDeleteDialogOpen(false);
							setPendingSampleDeleteRow(null);
							setDeletingId(null);
						}}>Cancel</Button>
						<Button className="bg-red-400 text-white hover:bg-red-700" onClick={confirmDelete}>
							<Trash2 className="h-4 w-4 mr-2" />
							Delete
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
};

export default DatasetsTabs;

