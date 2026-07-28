import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import api from "@/controllers/API/api";
import {
  deleteConnection,
  fetchConnectionById,
  fetchConnectionFormSchema,
  fetchConnectionGroup,
  updateConnection,
} from "@/controllers/API/connectionVaultApi";
import {
  executeApiRequestSilent,
  getDisplayErrorMessage,
  resolveApiErrorMessage,
} from "@/utils/exceptionHelper";
import ConnectionsTable from "./CredTable";
import CredDynamicForm from "./CredForm";
import { mergeAgentFieldsIntoConnectionPayload } from "./agentApi";
import { ConnectionTypeIcon } from "./ConnectionTypeIcon";
import { emptyStringsToNullDeep } from "@/utils/emptyStringsToNullDeep";
import { resolveConnectionVaultActionsKlass } from "@/utils/sapNodeActions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Cable, Loader2, Plus, RefreshCw } from "lucide-react";

function isMaskedCredential(value: unknown): boolean {
  if (value == null || value === "") return true;
  const s = String(value);
  return /^[*•.]+$/.test(s) || s === "__MASKED__";
}

interface Connector {
  id: string;
  name: string;
  icon: string;
  description: string;
  display_name?: string;
  group?: string;
  enabled?: boolean;
}

interface FormSchema {
  id: number;
  form_id: string;
  name: string;
  display_name: string;
  icon: string;
  description: string;
  group: string;
  enabled: boolean;
  fields: any[];
  save_connection: {
    name: string;
    klass: string;
    module: string;
    params: Record<string, any>;
  };
}

interface Connection {
  id: string;
  name: string;
  connection_type: string;
  host?: string;
  port?: string | number;
  user_name?: string;
  username?: string;
  database_name?: string;
  database?: string;
  is_active?: boolean;
  created_at: string;
  updated_at: string;
  [key: string]: any;
}

const CredentialsVault: React.FC = () => {
  const navigate = useNavigate();

  const [connections, setConnections] = useState<{
    databases: Connection[];
    storage: Connection[];
    notifications: Connection[];
    ingestion: Connection[];
  }>({
    databases: [],
    storage: [],
    notifications: [],
    ingestion: [],
  });

  const [showForm, setShowForm] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingConnection, setEditingConnection] = useState<Connection | null>(
    null,
  );
  const [editFormSchema, setEditFormSchema] = useState<FormSchema | null>(null);
  const [editSheetLoading, setEditSheetLoading] = useState(false);
  const [connectionsLoading, setConnectionsLoading] = useState(true);
  const formSchemaCacheRef = useRef<Map<string, FormSchema>>(new Map());

  const [isTesting, setIsTesting] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState<
    Record<string, boolean>
  >({});
  const [testConnectionSuccess, setTestConnectionSuccess] = useState(false);

  const [pendingDelete, setPendingDelete] = useState<{
    connection: Connection;
    module: string;
  } | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  useEffect(() => {
    fetchConnections();
  }, []);

  // Fetch all connections

  const fetchConnections = async () => {
    try {
      setConnectionsLoading(true);

      const applyGroup = (
        key: keyof typeof connections,
        data: Awaited<ReturnType<typeof fetchConnectionGroup>>,
      ) => {
        if (data?.status && Array.isArray(data.data)) {
          setConnections((prev) => ({
            ...prev,
            [key]: data.data as Connection[],
          }));
        }
      };

      const [databaseData, storageData, notificationsData] = await Promise.all([
        fetchConnectionGroup("/databases/get-connections", {
          connection_id: "",
          group_type: "databases",
        }),
        fetchConnectionGroup("/storage/get-connections", {
          connection_id: "",
          group_type: "storage",
        }),
        fetchConnectionGroup("/notifications/get-connections", {
          connection_id: "",
          group_type: "notifications",
        }),
      ]);

      applyGroup("databases", databaseData);
      applyGroup("storage", storageData);
      applyGroup("notifications", notificationsData);

      try {
        const ingestionData = await fetchConnectionGroup(
          "/ingestion/get-connections",
          { connection_id: "", group_type: "ingestion" },
        );
        applyGroup("ingestion", ingestionData);
      } catch (ingestionError) {
        console.error("Error fetching ingestion connections:", ingestionError);
      }
    } catch (error) {
      console.error("Error fetching connections:", error);
      toast.error(getDisplayErrorMessage(error, "Failed to load connections"));
    } finally {
      setConnectionsLoading(false);
    }
  };

  // Handle add new connection
  const handleAddNew = () => {
    navigate(`/connection-vault/connectors`);
  };

  const initialEditData = useMemo(() => {
    if (!editingConnection) {
      return {};
    }

    const flattenedData: Record<string, any> = { ...editingConnection };

    if (editingConnection.ssh_tunnel) {
      Object.entries(editingConnection.ssh_tunnel).forEach(([key, value]) => {
        flattenedData[`ssh_tunnel.${key}`] = value;
      });
    }
    if (flattenedData.user_name !== undefined) {
      flattenedData.username = flattenedData.user_name;
    }

    if (flattenedData.database_name !== undefined) {
      flattenedData.database = flattenedData.database_name;
    }
    if (flattenedData.connection_type === "postgresql") {
      flattenedData.connection_type = "postgres";
    }
    if (editingConnection.connection_config) {
      Object.entries(editingConnection.connection_config).forEach(
        ([key, value]) => {
          if (flattenedData[key] === undefined) {
            flattenedData[key] = value;
          }
        },
      );
    }

    for (const key of ["password", "ssh_tunnel.password"] as const) {
      if (key in flattenedData && isMaskedCredential(flattenedData[key])) {
        flattenedData[key] = "";
      }
    }

    return flattenedData;
  }, [editingConnection]);


  const handleCustomAction = async (
    actionField: any,
    formData: Record<string, any>,
  ) => {
    const { name: actionName, fetch: actionConfig } = actionField;
    if (
      !actionConfig ||
      !actionConfig.klass ||
      !actionConfig.module ||
      !actionConfig.params
    ) {
      toast.info("Action configuration is invalid.");
      return;
    }
    setIsActionLoading((prev) => ({ ...prev, [actionName]: true }));
    try {
      const { module, klass, params, method } = actionConfig;
      const processedPayload = processFormDataWithParams(formData, params);
      const httpMethod = (method || "POST").toUpperCase();
      const connectionType =
        formData.connection_type ??
        editingConnection?.connection_type ??
        editFormSchema?.form_id ??
        "";
      const resolvedKlass = resolveConnectionVaultActionsKlass(klass, connectionType);
      const url = `/${module}/${resolvedKlass}`;

      const result = await executeApiRequestSilent<{
        status?: boolean;
        message?: string;
      }>(
        () =>
          httpMethod === "GET"
            ? api.get(url, { params: processedPayload })
            : api.post(url, processedPayload),
        "Action failed.",
      );

      if (result?.status) {
        toast.success(result.message || "Action completed successfully!");
        if (actionName.toLowerCase().includes("test")) {
          setTestConnectionSuccess(true);
        }
      } else {
        toast.info(resolveApiErrorMessage(result, "Action failed."));
        if (actionName.toLowerCase().includes("test")) {
          setTestConnectionSuccess(false);
        }
      }
    } catch (error) {
      console.error(`Error performing action '${actionName}':`, error);
      toast.error(
        getDisplayErrorMessage(error, "An error occurred while performing the action."),
      );
      if (actionName.toLowerCase().includes("test")) {
        setTestConnectionSuccess(false);
      }
    } finally {
      setIsActionLoading((prev) => ({ ...prev, [actionName]: false }));
    }
  };

  const loadFormSchemaForEdit = async (formId: string): Promise<FormSchema | null> => {
    const cached = formSchemaCacheRef.current.get(formId);
    if (cached) return cached;

    try {
      const schema = await fetchConnectionFormSchema(formId);
      if (schema) {
        const typed = schema as FormSchema;
        formSchemaCacheRef.current.set(formId, typed);
        return typed;
      }
    } catch (error) {
      console.error("Error fetching form schema:", error);
      toast.error(getDisplayErrorMessage(error, "Failed to load form schema"));
    }
    return null;
  };

  // Handle edit connection — open sheet immediately, load data in parallel
  const handleEdit = (connection: Connection, module: string) => {
    const cachedSchema = formSchemaCacheRef.current.get(connection.connection_type) ?? null;

    setEditingConnection(connection);
    setEditFormSchema(cachedSchema);
    setTestConnectionSuccess(false);
    setShowEditDialog(true);
    setEditSheetLoading(true);

    void (async () => {
      try {
        const [connectionData, schema] = await Promise.all([
          fetchConnectionById(module, connection.id.toString()),
          cachedSchema
            ? Promise.resolve(cachedSchema)
            : loadFormSchemaForEdit(connection.connection_type),
        ]);

        if (
          !connectionData.status ||
          !connectionData.data ||
          connectionData.data.length === 0
        ) {
          toast.error(
            resolveApiErrorMessage(
              connectionData,
              "Connection details not found.",
            ),
          );
          handleEditDialogClose();
          return;
        }

        const resolvedSchema = schema ?? cachedSchema;
        if (!resolvedSchema) {
          toast.error("Could not load the form schema for this connection type.");
          handleEditDialogClose();
          return;
        }

        setEditingConnection(connectionData.data[0] as Connection);
        setEditFormSchema(resolvedSchema);
      } catch (error) {
        console.error("Error fetching connection details:", error);
        toast.error(getDisplayErrorMessage(error, "Failed to load connection details"));
        handleEditDialogClose();
      } finally {
        setEditSheetLoading(false);
      }
    })();
  };

  const handleDeleteRequest = (connection: Connection, module: string) => {
    setPendingDelete({ connection, module });
  };

  const handleDeleteDialogOpenChange = (open: boolean) => {
    if (!open && !deleteSubmitting) {
      setPendingDelete(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    const { connection, module } = pendingDelete;
    setDeleteSubmitting(true);
    try {
      await deleteConnection(module, connection.id.toString());
      toast.success("Connection deleted successfully");
      fetchConnections();
      setPendingDelete(null);
    } catch (error) {
      fetchConnections();
      console.error("Error deleting connection:", error);
      toast.error(getDisplayErrorMessage(error, "Failed to delete connection"));
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // Handle form submission for editing connection
  const handleEditFormSubmit = async (formData: Record<string, any>) => {
    if (!editingConnection || !editFormSchema) return;
    try {
      const { save_connection } = editFormSchema;
      const apiUrl = `/${save_connection.module}/update-connection`;
      const processedData = mergeAgentFieldsIntoConnectionPayload(formData, {
        update_id: editingConnection.id?.toString() ?? "",
        ...processFormDataWithParams(formData, save_connection.params),
      });
      await updateConnection(apiUrl, processedData);
      toast.success("Connection updated successfully");
      handleEditDialogClose();
    } catch (error) {
      console.error("Error updating connection:", error);
      toast.error(getDisplayErrorMessage(error, "Failed to update connection"));
    }
  };

  const processFormDataWithParams = (
    formData: Record<string, any>,
    paramsSchema: Record<string, any>,
  ) => {
    const replaceTemplates = (currentSchemaValue: any): any => {
      if (typeof currentSchemaValue === "string") {
        const pureTemplateMatch = currentSchemaValue.match(/^\{\{([^}]+)\}\}$/);
        if (pureTemplateMatch) {
          const fieldName = pureTemplateMatch[1];
          return formData.hasOwnProperty(fieldName)
            ? formData[fieldName]
            : undefined;
        } else {
          return currentSchemaValue.replace(
            /\{\{([^}]+)\}\}/g,
            (_match, fieldName) => {
              const value = formData[fieldName];
              if (value === null || value === undefined) {
                return "";
              }
              return String(value);
            },
          );
        }
      } else if (Array.isArray(currentSchemaValue)) {
        return currentSchemaValue.map(replaceTemplates);
      } else if (
        typeof currentSchemaValue === "object" &&
        currentSchemaValue !== null
      ) {
        const result: Record<string, any> = {};
        for (const [key, value] of Object.entries(currentSchemaValue)) {
          result[key] = replaceTemplates(value);
        }
        return result;
      }
      return currentSchemaValue;
    };

    return emptyStringsToNullDeep(replaceTemplates(paramsSchema));
  };

  // Close form handlers
  const handleFormClose = () => {
    setShowForm(false);
  };

  const handleEditDialogClose = () => {
    setShowEditDialog(false);
    setEditingConnection(null);
    setEditFormSchema(null);
    setEditSheetLoading(false);
  };

  // Get form title
  const getEditSheetTitle = () => {
    if (editingConnection?.name) {
      return editingConnection.name;
    }
    if (editFormSchema?.display_name) {
      return editFormSchema.display_name;
    }
    return "Connection";
  };

  const getEditSheetTypeLabel = () => {
    if (editFormSchema?.display_name) {
      return editFormSchema.display_name;
    }
    return editingConnection?.connection_type ?? "";
  };

  const editSheetConnectionType =
    editingConnection?.connection_type ?? editFormSchema?.form_id ?? "";

  // Get initial form data for editing
  const getInitialFormData = () => {
    if (editingConnection) {
      const flattenedData: Record<string, any> = { ...editingConnection };
      if (editingConnection.ssh_tunnel) {
        Object.entries(editingConnection.ssh_tunnel).forEach(([key, value]) => {
          flattenedData[`ssh_tunnel.${key}`] = value;
        });
      }
      return flattenedData;
    }
    return {};
  };

  const getStatusBadge = (isActive: boolean) => {
    return (
      <Badge
        variant={isActive ? "default" : "secondary"}
        className={
          isActive
            ? "bg-green-100 text-green-800 hover:bg-green-100"
            : "bg-gray-100 text-gray-800 hover:bg-gray-100"
        }
      >
        {isActive ? "Active" : "Inactive"}
      </Badge>
    );
  };

  const handleRefresh = () => {
    void fetchConnections();
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <Card className="flex h-full min-h-0 flex-col gap-0 border-border/70 p-0 shadow-sm">
        <CardHeader className="border-b border-border/60 px-2 py-1.5 [.border-b]:pb-1">
          <div className="flex min-h-9 flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-[16px] font-semibold leading-none">
                <Cable className="h-4 w-4 shrink-0 text-primary" />
                Connections
              </CardTitle>
              <p className="mt-1 px-0 text-xs text-muted-foreground">
                Manage your data source connections
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant="primary"
                size="icon"
                className="h-8 w-8 !px-2"
                onClick={handleRefresh}
                disabled={connectionsLoading}
                title="Refresh connections"
              >
                <RefreshCw className={cn("!h-5 w-4", connectionsLoading && "animate-spin")} />
              </Button>
              <Button
                type="button"
                onClick={handleAddNew}
                variant="default"
                className="!h-8 !px-2"
                disabled={connectionsLoading}
              >
                <Plus className="mr-1 h-4 w-4" />
                Connection
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex min-h-0 flex-1 flex-col p-2 md:p-2">
          {connectionsLoading ? (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm font-medium text-foreground">Loading connections…</p>
              <p className="text-xs text-muted-foreground">Fetching connection vault data</p>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto">
              <ConnectionsTable
                connections={connections}
                onEdit={handleEdit}
                onDelete={handleDeleteRequest}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!pendingDelete}
        onOpenChange={handleDeleteDialogOpenChange}
      >
        {pendingDelete ? (
          <DialogContent className="max-w-md gap-3 p-4 sm:max-w-md">
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="text-base">Delete connection</DialogTitle>
              <DialogDescription className="text-sm leading-snug">
                Are you sure you want to delete{" "}
                <span className="font-medium text-foreground">
                  {pendingDelete.connection.name || "this connection"}
                </span>
                ? This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                size="md"
                className="h-8 min-h-8"
                disabled={deleteSubmitting}
                onClick={() => setPendingDelete(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                size="md"
                className="h-8 min-h-8"
                disabled={deleteSubmitting}
                onClick={handleConfirmDelete}
              >
                {deleteSubmitting ? "Deleting…" : "Confirm"}
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>

      {/* Edit Sheet */}
      <Sheet
        open={showEditDialog}
        onOpenChange={(open) => {
          if (!open) handleEditDialogClose();
          else setShowEditDialog(true);
        }}
      >
        <SheetContent
          side="right"
          className="flex h-full max-w-[min(100vw-1.5rem,60rem)] flex-col gap-0 overflow-visible border-0 bg-transparent p-0 shadow-none"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-l-3xl border-l border-border/60 bg-background shadow-2xl">
          <SheetHeader className="shrink-0 border-b border-border px-4 pb-3 pt-4 text-left sm:px-5 sm:pb-4 sm:pt-5">
            <SheetTitle asChild>
              <div className="flex min-w-0 items-center gap-3">
                {editSheetConnectionType ? (
                  <ConnectionTypeIcon
                    connectionType={editSheetConnectionType}
                    className="h-7 w-7"
                  />
                ) : null}
                <span className="min-w-0 truncate text-lg font-semibold leading-tight">
                  {getEditSheetTitle()}
                </span>
                {editSheetConnectionType ? (
                  <Badge variant="outline" className="shrink-0 text-xs font-mono">
                    {getEditSheetTypeLabel()}
                  </Badge>
                ) : null}
              </div>
            </SheetTitle>
          </SheetHeader>
          <div className="relative min-h-0 flex-1 overflow-hidden">
            {editSheetLoading && !editFormSchema ? (
              <div className="flex h-full items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <div className="text-center">
                    <div className="font-medium text-foreground">Loading form...</div>
                    <div className="text-sm text-muted-foreground">
                      Preparing connection details
                    </div>
                  </div>
                </div>
              </div>
            ) : editFormSchema ? (
              <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
                {editSheetLoading ? (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : null}
                <CredDynamicForm
                  key={editingConnection?.id ?? "edit"}
                  formSchema={editFormSchema}
                  onSubmit={handleEditFormSubmit}
                  onCancel={handleEditDialogClose}
                  initialData={initialEditData}
                  layout={3}
                  submitButtonText="Update Connection"
                  onCustomAction={handleCustomAction}
                  isActionLoading={isActionLoading}
                  testConnectionSuccess={testConnectionSuccess}
                  onTestConnectionSuccess={setTestConnectionSuccess}
                  savedConnectionId={editingConnection?.id ?? null}
                  connectionType={
                    editingConnection?.connection_type ??
                    editFormSchema?.form_id ??
                    ""
                  }
                  connectionTypeLabel={editFormSchema.display_name}
                  isEditMode
                />
              </div>
            ) : (
              <div className="flex h-full items-center justify-center p-6">
                <div className="text-center">
                  <h3 className="mb-2 text-lg font-semibold text-foreground">
                    Failed to load edit form
                  </h3>
                  <p className="mb-4 text-muted-foreground">
                    Unable to load the form for editing this connection.
                  </p>
                  <Button onClick={handleEditDialogClose} variant="outline">
                    Close
                  </Button>
                </div>
              </div>
            )}
          </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default CredentialsVault;
