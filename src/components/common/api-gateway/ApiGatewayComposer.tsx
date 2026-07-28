import { useCallback, useEffect, useMemo, useState } from "react";
import cloneDeep from "lodash/cloneDeep";
import { Copy, Download, KeyRound, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { saveNodeDetailsApi } from "@/controllers/API";
import { ApiRequestError, getDisplayErrorMessage } from "@/utils/exceptionHelper";
import useFlowStore from "@/stores/flowStore";
import {
  type ApiGatewayFormState,
  type AuthType,
  type HttpMethod,
  authSummaryLabel,
  buildPostmanCollection,
  buildRouteUrl,
  extractPathPlaceholders,
  generateAuthCredentials,
  hydrateApiGatewayFormState,
  methodBadgeClass,
  methodButtonClass,
  resolveApiGatewayUiMeta,
  serializeApiGatewayPayload,
} from "./apiGatewayPayload";

export interface ApiGatewayComposerProps {
  nodeDetailsData: any;
  onClose?: () => void;
  mode?: "view" | "edit";
}

function SectionHeader({
  step,
  title,
  description,
}: {
  step: number;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="flex h-5 min-w-5 items-center justify-center rounded bg-primary/15 px-1 text-[11px] font-semibold text-primary">
          {step}
        </span>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      {description ? (
        <p className="pl-7 text-xs text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

function SectionCard({
  step,
  title,
  description,
  children,
  className,
}: {
  step: number;
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-border/80 bg-card p-5 shadow-sm",
        className,
      )}
    >
      <SectionHeader step={step} title={title} description={description} />
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function ApiGatewayComposer({
  nodeDetailsData,
  onClose,
  mode = "edit",
}: ApiGatewayComposerProps) {
  const { id: flowIdParam } = useParams();
  const disabled = mode === "view";
  const [saving, setSaving] = useState(false);

  const template = nodeDetailsData?.data?.node?.template;
  const payload = nodeDetailsData?.data?.node?.payload;

  const uiMeta = useMemo(
    () => resolveApiGatewayUiMeta(template, nodeDetailsData?.data?.display_name),
    [template, nodeDetailsData?.data?.display_name],
  );

  const [form, setForm] = useState<ApiGatewayFormState>(() =>
    hydrateApiGatewayFormState(payload, template, uiMeta),
  );

  useEffect(() => {
    setForm(hydrateApiGatewayFormState(payload, template, uiMeta));
  }, [payload, template, uiMeta]);

  const placeholders = useMemo(() => extractPathPlaceholders(form.path), [form.path]);

  useEffect(() => {
    setForm((prev) => {
      const nextParams: Record<string, string> = {};
      for (const name of placeholders) {
        nextParams[name] = prev.path_params[name] ?? "";
      }
      const same =
        placeholders.length === Object.keys(prev.path_params).length &&
        placeholders.every((n) => prev.path_params[n] === nextParams[n]);
      if (same) return prev;
      return { ...prev, path_params: nextParams };
    });
  }, [placeholders]);

  const routeUrl = useMemo(() => buildRouteUrl(form), [form]);
  const postmanJson = useMemo(
    () => JSON.stringify(buildPostmanCollection(form), null, 2),
    [form],
  );

  const headersSummary =
    form.headers.filter((h) => h.key.trim()).length > 0
      ? `${form.headers.filter((h) => h.key.trim()).length} header(s)`
      : "—";

  const updateField = useCallback(
    <K extends keyof ApiGatewayFormState>(key: K, value: ApiGatewayFormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleSave = async () => {
    if (disabled || saving) return;
    const selected = useFlowStore.getState().getSelectedNode();
    if (!selected?.id) {
      toast.error("No node selected.");
      return;
    }

    setSaving(true);
    try {
      const finalRequestBody = cloneDeep(nodeDetailsData);
      const serialized = serializeApiGatewayPayload(form, template);
      finalRequestBody.data = finalRequestBody.data ?? {};
      finalRequestBody.data.current_node_id = selected.id;
      finalRequestBody.data.name = nodeDetailsData?.data?.display_name;
      finalRequestBody.data.flow_id =
        useFlowStore.getState().currentWorkflow?.flow_id || flowIdParam;

      if (finalRequestBody.data.node) {
        finalRequestBody.data.node.payload = {
          ...(finalRequestBody.data.node.payload ?? {}),
          ...serialized,
        };
      }

      const saveEndpoint = nodeDetailsData?.data?.node?.save_node;
      if (saveEndpoint?.module && saveEndpoint?.klass) {
        const response = await saveNodeDetailsApi(
          saveEndpoint as { module: string; klass: string },
          finalRequestBody.data,
        );
        useFlowStore.getState().updateNodeData(selected.id, response);
      } else {
        useFlowStore.getState().updateNodeData(selected.id, {
          ...selected.data,
          node: {
            ...selected.data?.node,
            payload: finalRequestBody.data.node?.payload,
          },
          saved_node: true,
        });
      }

      toast.success("API Gateway route saved.");
      onClose?.();
    } catch (error) {
      if (!(error instanceof ApiRequestError)) {
        toast.error(getDisplayErrorMessage(error, "Failed to save API Gateway route."));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateCredentials = () => {
    if (disabled || !form.auth_type || form.auth_type === "none") return;
    updateField("auth_credentials", generateAuthCredentials(form.auth_type));
    toast.success("Credentials generated.");
  };

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(postmanJson);
      toast.success("Postman collection copied.");
    } catch {
      toast.error("Could not copy to clipboard.");
    }
  };

  const handleDownloadJson = () => {
    const blob = new Blob([postmanJson], { type: "application/json" });
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    const fileBase =
      form.collection_name.trim() || form.route_name.trim() || "collection";
    a.download = `${fileBase.replace(/[^\w.-]+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(objectUrl);
  };

  const methods = uiMeta.httpMethods;
  const authOptions = uiMeta.authOptions;
  const showAuthGenerate =
    !disabled && Boolean(form.auth_type) && form.auth_type !== "none";

  return (
    <div className="min-h-0 w-full bg-muted/20 p-3 sm:p-4">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
        <div className="space-y-4">
          <SectionCard
            step={1}
            title={uiMeta.sections.endpoint.title}
            description={uiMeta.sections.endpoint.description}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {uiMeta.baseUrl?.display_name || "Base URL"}
                </Label>
                <Input
                  value={form.base_url}
                  disabled={disabled}
                  onChange={(e) => updateField("base_url", e.target.value)}
                  placeholder={uiMeta.baseUrl?.placeholder || ""}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {uiMeta.path?.display_name || "Path"}
                </Label>
                <Input
                  value={form.path}
                  disabled={disabled}
                  onChange={(e) => updateField("path", e.target.value)}
                  placeholder={uiMeta.path?.placeholder || ""}
                  className="font-mono text-sm"
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            step={2}
            title={uiMeta.sections.method.title}
            description={uiMeta.sections.method.description}
          >
            {methods.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No HTTP methods configured in the node template.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {methods.map((method) => (
                  <button
                    key={method}
                    type="button"
                    disabled={disabled}
                    onClick={() => updateField("http_method", method as HttpMethod)}
                    className={cn(
                      "rounded-md border px-4 py-2 text-sm font-semibold transition-colors",
                      methodButtonClass(method, form.http_method === method),
                    )}
                  >
                    {method}
                  </button>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            step={3}
            title={uiMeta.sections.parameters.title}
            description={uiMeta.sections.parameters.description}
          >
            <div className="space-y-4">
              {placeholders.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {uiMeta.pathParams?.display_name || "Path parameters"}
                  </p>
                  <div className="space-y-2">
                    {placeholders.map((name) => (
                      <div key={name} className="flex items-center gap-2">
                        <span className="inline-flex min-w-[88px] items-center justify-center rounded-md bg-primary/10 px-2 py-1 font-mono text-xs text-primary">
                          {`{${name}}`}
                        </span>
                        <Input
                          value={form.path_params[name] ?? ""}
                          disabled={disabled}
                          onChange={(e) =>
                            updateField("path_params", {
                              ...form.path_params,
                              [name]: e.target.value,
                            })
                          }
                          placeholder={uiMeta.pathParams?.placeholder || ""}
                          className="flex-1"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {uiMeta.queryParams?.display_name || "Query parameters"}
                </p>
                <div className="space-y-2">
                  {form.query_params.map((row, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        value={row.key}
                        disabled={disabled}
                        onChange={(e) => {
                          const next = [...form.query_params];
                          next[index] = { ...next[index], key: e.target.value };
                          updateField("query_params", next);
                        }}
                        placeholder="key"
                        className="flex-1"
                      />
                      <Input
                        value={row.value}
                        disabled={disabled}
                        onChange={(e) => {
                          const next = [...form.query_params];
                          next[index] = { ...next[index], value: e.target.value };
                          updateField("query_params", next);
                        }}
                        placeholder="value"
                        className="flex-1"
                      />
                      {!disabled && form.query_params.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0 text-muted-foreground"
                          onClick={() =>
                            updateField(
                              "query_params",
                              form.query_params.filter((_, i) => i !== index),
                            )
                          }
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                {!disabled && (
                  <Button
                    type="button"
                    variant="outline"
                    className="border-dashed"
                    onClick={() =>
                      updateField("query_params", [
                        ...form.query_params,
                        { key: "", value: "" },
                      ])
                    }
                  >
                    + Add query parameter
                  </Button>
                )}
              </div>
            </div>
          </SectionCard>

          <SectionCard
            step={4}
            title={uiMeta.sections.authentication.title}
            description={uiMeta.sections.authentication.description}
          >
            {authOptions.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No authentication options configured in the node template.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {authOptions.map((option) => {
                  const selected = form.auth_type === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => updateField("auth_type", option.id as AuthType)}
                      className={cn(
                        "rounded-lg border p-3 text-left transition-colors",
                        selected
                          ? "border-primary bg-primary/10 shadow-sm"
                          : "border-border bg-background hover:bg-muted/40",
                      )}
                    >
                      <p className="text-sm font-semibold">{option.title}</p>
                      {option.description ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {option.description}
                        </p>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
            {showAuthGenerate && form.auth_type !== "none" && (
              <Button
                type="button"
                className="mt-4"
                onClick={handleGenerateCredentials}
              >
                <KeyRound className="mr-2 h-4 w-4" />
                Generate credentials
              </Button>
            )}
            {Object.keys(form.auth_credentials).length > 0 && (
              <div className="mt-3 rounded-lg border bg-muted/30 p-3 font-mono text-xs">
                {Object.entries(form.auth_credentials).map(([k, v]) => (
                  <div key={k}>
                    <span className="text-muted-foreground">{k}: </span>
                    <span>{v}</span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            step={5}
            title={uiMeta.sections.export.title}
            description={uiMeta.sections.export.description}
          >
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={handleDownloadJson}>
                <Download className="mr-2 h-4 w-4" />
                Download collection.json
              </Button>
              <Button type="button" variant="outline" onClick={handleCopyJson}>
                <Copy className="mr-2 h-4 w-4" />
                Copy JSON
              </Button>
            </div>
            <pre className="mt-4 max-h-72 overflow-auto rounded-lg border border-border bg-muted p-4 font-mono text-xs leading-relaxed text-foreground">
              {postmanJson}
            </pre>
          </SectionCard>

          <div className="flex items-center justify-end gap-2 pb-2">
            {onClose && (
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            )}
            {!disabled && (
              <Button type="button" disabled={saving} onClick={handleSave}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save route"
                )}
              </Button>
            )}
          </div>
        </div>

        <aside className="lg:sticky lg:top-4">
          <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">{uiMeta.sections.summary.title}</h3>
              <span className="inline-flex items-center gap-1.5 text-xs text-primary">
                <span className="h-2 w-2 rounded-full bg-primary" />
                {uiMeta.sections.summary.liveLabel}
              </span>
            </div>

            <div className="mt-4 space-y-4">
              {form.http_method ? (
                <span
                  className={cn(
                    "inline-flex rounded-md border px-2 py-0.5 text-xs font-bold uppercase",
                    methodBadgeClass(form.http_method),
                  )}
                >
                  {form.http_method}
                </span>
              ) : null}

              <p className="break-all font-mono text-xs leading-relaxed text-foreground">
                {routeUrl || "—"}
              </p>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {uiMeta.headers?.display_name || "Headers"}
                </p>
                <p className="mt-1 text-sm text-foreground">{headersSummary}</p>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {uiMeta.authType?.display_name || "Auth"}
                </p>
                <p className="mt-1 text-sm text-foreground">
                  {authSummaryLabel(form.auth_type, authOptions)}
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
