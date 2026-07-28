import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import api from "@/controllers/API/api";
import {
  createConnection,
  fetchConnectionById,
  fetchConnectionFormSchema,
  fetchConnectionsByType,
  resolveConnectionModule,
  updateConnection,
} from "@/controllers/API/connectionVaultApi";
import {
  executeApiRequestSilent,
  getDisplayErrorMessage,
  resolveApiErrorMessage,
} from "@/utils/exceptionHelper";
import { ArrowLeft, Database, Loader2, Pencil } from "lucide-react";
import CredDynamicForm from "../CredForm";
import { ConnectorIcon } from "../ConnectorIcon";
import {
  invalidateAgentWizardInitCache,
  mergeAgentFieldsIntoConnectionPayload,
} from "../agentApi";
import { emptyStringsToNullDeep } from "@/utils/emptyStringsToNullDeep";
import { resolveConnectionVaultActionsKlass } from "@/utils/sapNodeActions";

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

interface ConnectorConnection {
  id: number;
  name: string;
  is_active: boolean;
  connection_type: string;
  created_at: string;
  updated_at: string;
}

type CredCreateProps = {
  sourceFormId?: string;
  showBackButtonIf?: string;
};

const CredCreate: React.FC<CredCreateProps> = ({
  sourceFormId,
  showBackButtonIf = "false",
}) => {
  // let {props} = props;
  // console.log("props", sourceFormId);
  const navigate = useNavigate();
  // let selectedConnectorId = props?.props;
  const { selectedConnectorId } = useParams<{ selectedConnectorId: string }>();

  const [selectedConnector, setSelectedConnector] = useState<Connector | null>(
    null
  );
  const [connectorFormSchema, setConnectorFormSchema] =
    useState<FormSchema | null>(null);
  const [connectorConnections, setConnectorConnections] = useState<
    ConnectorConnection[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [connectorConnectionsLoading, setConnectorConnectionsLoading] =
    useState(false);
  const [connectorLoading, setConnectorLoading] = useState(true);

  const [isTesting, setIsTesting] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState<
    Record<string, boolean>
  >({});
  const [testConnectionSuccess, setTestConnectionSuccess] = useState(false);

  const stableInitialData = useMemo(() => ({}), []);
  const [editingConnection, setEditingConnection] = useState<any | null>(null);
  const [savedConnectionId, setSavedConnectionId] = useState<
    string | number | null
  >(null);

  const activeConnectionId =
    editingConnection?.id ?? savedConnectionId ?? null;

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

    if (
      (flattenedData.connection_type == null ||
        flattenedData.connection_type === "") &&
      selectedConnectorId
    ) {
      flattenedData.connection_type = selectedConnectorId;
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

    if (
      flattenedData.user_name !== undefined &&
      flattenedData.username === undefined
    ) {
      flattenedData.username = flattenedData.user_name;
    }

    for (const key of ["password", "ssh_tunnel.password"] as const) {
      if (key in flattenedData && isMaskedCredential(flattenedData[key])) {
        flattenedData[key] = "";
      }
    }

    return flattenedData;
  }, [editingConnection, selectedConnectorId]);

  useEffect(() => {
    if (selectedConnectorId) {
      initializeConnector(selectedConnectorId);
    } else {
      initializeConnector(sourceFormId);
    }
  }, [selectedConnectorId]);

  const initializeConnector = async (connectorId: string) => {
    try {
      setConnectorLoading(true);
      const schema = await fetchFormSchema(connectorId);
      if (schema) {
        setSelectedConnector({
          id: connectorId,
          name: schema.display_name,
          icon: schema.icon || connectorId,
          description: schema.description,
          display_name: schema.display_name,
          group: schema.group,
        });
      } else {
        setSelectedConnector({
          id: connectorId,
          name: connectorId.charAt(0).toUpperCase() + connectorId.slice(1),
          icon: connectorId,
          description: `${connectorId} connection`,
          display_name:
            connectorId.charAt(0).toUpperCase() + connectorId.slice(1),
        });
      }
      const module = resolveConnectionModule(schema);
      await fetchConnectorConnections(connectorId, module);
    } catch (error) {
      console.error("Error initializing connector:", error);
      toast.error(getDisplayErrorMessage(error, "Failed to load connector details"));
      navigate("/connection-vault");
    } finally {
      setConnectorLoading(false);
    }
  };

  const fetchConnectorConnections = async (
    connectorId: string,
    module = resolveConnectionModule(connectorFormSchema),
  ) => {
    try {
      setConnectorConnectionsLoading(true);
      const result = await fetchConnectionsByType(module, connectorId);
      if (result.status && result.data) {
        setConnectorConnections(result.data as ConnectorConnection[]);
      } else {
        setConnectorConnections([]);
      }
    } catch (error) {
      console.error("Error fetching connector connections:", error);
      setConnectorConnections([]);
    } finally {
      setConnectorConnectionsLoading(false);
    }
  };

  const fetchFormSchema = async (formId: string): Promise<FormSchema | null> => {
    try {
      setLoading(true);
      const schema = await fetchConnectionFormSchema(formId);
      const typed = schema ? (schema as FormSchema) : null;
      setConnectorFormSchema(typed);
      return typed;
    } catch (error) {
      console.error("Error fetching form schema:", error);
      toast.error(getDisplayErrorMessage(error, "Failed to load form schema"));
      setConnectorFormSchema(null);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleCustomAction = async (
    actionField: any,
    formData: Record<string, any>
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
        selectedConnectorId ??
        connectorFormSchema?.form_id ??
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

  const processFormDataWithParams = (
    formData: Record<string, any>,
    paramsSchema: Record<string, any>
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
            }
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

  const getStatusBadge = (isActive: boolean) => {
    return (
      <Badge variant={isActive ? "default" : "secondary"}>
        {isActive ? "Active" : "Inactive"}
      </Badge>
    );
  };

  const getFormTitle = () => {
    if (selectedConnector) {
      return `Create ${connectorFormSchema?.display_name ||
        selectedConnector.name ||
        "Connection"
        }`;
    }
    return "Connection";
  };

  const handleCancel = () => {
    navigate(-1);
  };

  if (connectorLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
          <div className="text-center">
            <div className="font-medium text-foreground">Loading connector...</div>
            <div className="text-sm text-muted-foreground">
              Preparing connector details
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedConnector) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h3 className="mb-2 text-lg font-semibold text-foreground">
            Connector not found
          </h3>
          <p className="mb-4 text-muted-foreground">
            The requested connector could not be found.
          </p>
          <Button onClick={() => navigate("/connection-vault")}>
            Back to Connection Vault
          </Button>
        </div>
      </div>
    );
  }

  const handleEdit = async (connection: ConnectorConnection) => {
    try {
      setLoading(true);
      const module = resolveConnectionModule(connectorFormSchema);
      const result = await fetchConnectionById(
        module,
        connection.id.toString(),
      );
      if (result.status && result.data && result.data.length > 0) {
        setEditingConnection(result.data[0]);
        setSavedConnectionId(connection.id);
        setTestConnectionSuccess(false);
      } else {
        toast.error(
          resolveApiErrorMessage(
            result,
            "Failed to load connection details for editing.",
          ),
        );
      }
    } catch (error) {
      console.error("Error fetching connection for edit:", error);
      toast.error(
        getDisplayErrorMessage(error, "An error occurred while preparing the edit form."),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = async (formData: Record<string, any>) => {
    if (!connectorFormSchema) return;
    if (editingConnection) {
      try {
        setIsSubmitting(true);
        const { save_connection } = connectorFormSchema;
        const apiUrl = `/${save_connection.module}/update-connection`;
        const processedData = mergeAgentFieldsIntoConnectionPayload(formData, {
          update_id: editingConnection.id?.toString() ?? "",
          ...processFormDataWithParams(formData, save_connection.params),
        });

        await updateConnection(apiUrl, processedData);
        toast.success("Connection updated successfully");
        setSavedConnectionId(editingConnection.id);
        setTestConnectionSuccess(false);
        invalidateAgentWizardInitCache(
          save_connection.module,
          String(editingConnection.id ?? ""),
          String(
            processedData.connection_type ??
              editingConnection.connection_type ??
              selectedConnectorId ??
              "",
          ),
        );
        setEditingConnection((prev) => {
          if (!prev) return prev;
          const prevConfig =
            typeof prev.connection_config === "object" && prev.connection_config != null
              ? prev.connection_config
              : {};
          return {
            ...prev,
            ...processedData,
            agent_platform: processedData.agent_platform ?? prev.agent_platform,
            agent_config: processedData.agent_config ?? prev.agent_config,
            agent_config_filename:
              processedData.agent_config_filename ?? prev.agent_config_filename,
            config_generated: processedData.config_generated ?? prev.config_generated,
            connection_config: {
              ...prevConfig,
              ...(typeof processedData.connection_config === "object" &&
              processedData.connection_config != null
                ? processedData.connection_config
                : {}),
              agent_platform: processedData.agent_platform ?? prevConfig.agent_platform,
              agent_config: processedData.agent_config ?? prevConfig.agent_config,
              agent_config_filename:
                processedData.agent_config_filename ?? prevConfig.agent_config_filename,
              config_generated:
                processedData.config_generated ?? prevConfig.config_generated,
            },
          };
        });
      } catch (error) {
        console.error("Error updating connection:", error);
        toast.error(getDisplayErrorMessage(error, "Failed to update connection"));
      } finally {
        setIsSubmitting(false);
      }
    } else {
      try {
        setIsSubmitting(true);
        const { save_connection } = connectorFormSchema;
        const apiUrl = `/${save_connection.module}/${save_connection.klass}`;
        const processedData = mergeAgentFieldsIntoConnectionPayload(
          formData,
          processFormDataWithParams(formData, save_connection.params),
        );
        const result = (await createConnection(apiUrl, processedData)) as {
          data?: { id?: string | number };
          id?: string | number;
        };
        const newId = result?.data?.id ?? result?.id;
        toast.success("Connection created successfully");
        setTestConnectionSuccess(false);

        if (newId != null) {
          const idStr = String(newId);
          setSavedConnectionId(idStr);
          try {
            const fetched = await fetchConnectionById(
              save_connection.module,
              idStr,
            );
            if (fetched?.data?.[0]) {
              setEditingConnection(fetched.data[0]);
            }
          } catch {
            // Agent wizard can still use savedConnectionId
          }
        }

        if (selectedConnectorId) {
          await fetchConnectorConnections(
            selectedConnectorId,
            save_connection.module,
          );
        }
      } catch (error) {
        console.error("Error creating connection:", error);
        toast.error(getDisplayErrorMessage(error, "Failed to create connection"));
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="flex h-svh max-h-svh min-h-0 flex-col overflow-hidden bg-background">
      <div className="z-10 shrink-0 border-b border-border bg-card px-4 pb-2 pt-0 shadow-sm">
        <div className="mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              onClick={() => navigate(-1)}
              variant="ghost"
              className="flex !h-8 items-center gap-2 !px-2 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Sources
            </Button>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center space-x-3">
              {(connectorFormSchema?.icon ?? selectedConnector?.icon) ? (
                <ConnectorIcon
                  icon={connectorFormSchema?.icon ?? selectedConnector!.icon}
                  size="lg"
                />
              ) : null}
              <div className="flex min-w-0 flex-nowrap items-center gap-2 sm:gap-3">
                <h1 className="min-w-0 shrink truncate text-[16px] font-bold text-foreground">
                  {editingConnection
                    ? `Editing '${editingConnection.name}'`
                    : getFormTitle()}
                </h1>
                {editingConnection && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 shrink-0"
                    onClick={() => {
                      setEditingConnection(null);
                      setSavedConnectionId(null);
                      setTestConnectionSuccess(false);
                    }}
                  >
                    Cancel Edit
                  </Button>
                )}
                <span className="min-w-0 flex-1 truncate border-l border-border pl-2 text-sm font-normal text-muted-foreground sm:pl-3">
                  {editingConnection
                    ? "Update the details for this connection."
                    : selectedConnector?.description}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden px-2 py-4">
        <div className="mx-auto flex h-full min-h-0 max-w-[100%]">
          <div className="grid h-full min-h-0 w-full grid-cols-12 gap-1.5">
            {/* Left side - Existing Connections */}
            <div className="col-span-4 flex min-h-0 flex-col">
              <Card className="flex h-full min-h-0 flex-col gap-0 border border-border py-0 shadow-lg">
                <CardHeader className="flex-shrink-0 space-y-0 px-4 pb-2 pt-4">
                  <CardTitle className="flex items-center gap-1.5 text-[15px] font-semibold text-card-foreground">
                    Existing Connections
                  </CardTitle>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {selectedConnector?.name} connections (
                    {connectorConnections.length})
                  </p>
                </CardHeader>
                <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                  <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
                    {connectorConnectionsLoading ? (
                      <div className="flex h-32 items-center justify-center">
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                          <span className="text-sm text-muted-foreground">
                            Loading connections...
                          </span>
                        </div>
                      </div>
                    ) : connectorConnections.length === 0 ? (
                      <div className="flex h-32 items-center justify-center">
                        <div className="text-center">
                          <Database className="mx-auto mb-2 h-12 w-12 text-muted-foreground/70" />
                          <p className="text-muted-foreground">
                            No existing connections
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground/80">
                            Create your first connection using the form
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {connectorConnections.map((connection) => (
                          <div
                            key={connection.id}
                            className={`rounded-md border p-3 transition-all ${editingConnection?.id === connection.id
                              ? "border-primary bg-accent/40 shadow-md"
                              : "border-border hover:bg-accent/20 hover:shadow-sm"
                              }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="min-w-0 flex-1">
                                <h4 className="truncate font-medium text-[14px] text-foreground">
                                  {connection.name}
                                </h4>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Created:{" "}
                                  {new Date(
                                    connection.created_at
                                  ).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="flex-shrink-0 ml-2 flex items-center gap-2">
                                {getStatusBadge(connection.is_active)}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(connection)}
                                  disabled={loading}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right side - Form */}
            <div className="col-span-8 flex min-h-0 flex-col">
              <Card className="flex h-full min-h-0 flex-col gap-0 overflow-hidden border border-border p-0 py-0 shadow-lg">
                <CardContent className="min-h-0 flex-1 overflow-hidden p-0">
                  {loading ? (
                    <div className="flex h-full items-center justify-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
                        <div className="text-center">
                          <div className="font-medium text-foreground">
                            Loading form...
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Preparing connection form for{" "}
                            {selectedConnector?.name}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : connectorFormSchema ? (
                    <div className="flex h-full min-h-0 flex-col overflow-hidden">
                      <CredDynamicForm
                        key={
                          editingConnection
                            ? editingConnection.id
                            : "create-new"
                        }
                        formSchema={connectorFormSchema}
                        onSubmit={handleFormSubmit}
                        onCancel={handleCancel}
                        initialData={
                          editingConnection ? initialEditData : stableInitialData
                        }
                        layout={3}
                        submitButtonText={
                          editingConnection
                            ? "Update Connection"
                            : "Create Connection"
                        }
                        onCustomAction={handleCustomAction}
                        isActionLoading={isActionLoading}
                        testConnectionSuccess={testConnectionSuccess}
                        onTestConnectionSuccess={setTestConnectionSuccess}
                        savedConnectionId={activeConnectionId}
                        connectionType={
                          selectedConnectorId ??
                          connectorFormSchema.form_id ??
                          ""
                        }
                        connectionTypeLabel={connectorFormSchema.display_name}
                        isEditMode={!!editingConnection}
                        isSubmitting={isSubmitting}
                      />
                    </div>
                  ) : (
                    <div className="flex h-full items-center justify-center p-6">
                      <div className="text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/15">
                          <svg
                            className="h-8 w-8 text-destructive"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                        </div>
                        <h3 className="mb-2 text-lg font-semibold text-foreground">
                          Failed to load form
                        </h3>
                        <p className="mb-4 text-muted-foreground">
                          Unable to load the connection form for{" "}
                          {selectedConnector?.name}
                        </p>
                        <Button
                          onClick={handleCancel}
                          variant="outline"
                          className="mr-2"
                        >
                          Go Back
                        </Button>
                        <Button
                          onClick={() =>
                            selectedConnectorId &&
                            initializeConnector(selectedConnectorId)
                          }
                        >
                          Try Again
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CredCreate;
