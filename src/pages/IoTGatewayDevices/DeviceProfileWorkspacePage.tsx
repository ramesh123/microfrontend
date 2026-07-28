import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useNavigate, useParams } from "react-router";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createDeviceProfile,
  entityIdFromTb,
  getDeviceProfileById,
  normalizeDeviceProfileRecord,
  searchDeviceProfileRuleChains,
  updateDeviceProfile,
  type DeviceInfoRecord,
  type DeviceProfileRecord,
} from "@/controllers/API/devicesApi";

import { ReadOnlyDetailsField } from "./DeviceDetailTabShared";
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';

type RuleChainOption = { id: string; name: string };

function ProfileFormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/90">
        {label}
        {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </Label>
      {children}
    </div>
  );
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function stringValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return value == null ? "" : String(value);
}

function displayValue(...values: unknown[]): string {
  for (const value of values) {
    const text = stringValue(value).trim();
    if (text) return text;
  }
  return "—";
}

function profileIdFromRecord(row: DeviceProfileRecord): string {
  return (
    entityIdFromTb(row.id) ||
    entityIdFromTb(row.deviceProfileId) ||
    entityIdFromTb(row.device_profile_id)
  );
}

function profileName(row: DeviceProfileRecord): string {
  return displayValue(row.name, row.title, row.profileName, row.profile_name, row.displayName, row.label);
}

function profileType(row: DeviceProfileRecord): string {
  return displayValue(row.type, row.profileType, row.profile_type, row.deviceType, row.device_type);
}

function profileTransportType(row: DeviceProfileRecord): string {
  const profile = objectValue(row.deviceProfile ?? row.device_profile);
  return displayValue(
    row.transportType,
    row.transport_type,
    row.transportTypeLabel,
    profile.transportType,
    profile.transport_type,
  );
}

function profileDescription(row: DeviceProfileRecord): string {
  const additionalInfo = objectValue(row.additionalInfo ?? row.additional_info);
  return stringValue(row.description ?? additionalInfo.description).trim();
}

function profileEntityType(row: DeviceProfileRecord): string {
  return displayValue(row.entityType, row.entity_type, "RULE_CHAIN");
}

function profileDefaultRuleChainId(row: DeviceProfileRecord): string {
  return (
    entityIdFromTb(row.defaultRuleChainId) ||
    entityIdFromTb(row.default_rule_chain_id) ||
    entityIdFromTb(row.defaultRuleChain)
  );
}

function profileDefaultRuleChainName(row: DeviceProfileRecord): string {
  const ruleChain = objectValue(row.defaultRuleChain ?? row.default_rule_chain);
  return displayValue(
    row.defaultRuleChainName,
    row.default_rule_chain_name,
    ruleChain.name,
    profileDefaultRuleChainId(row),
  );
}

function toRuleChainOption(row: DeviceInfoRecord): RuleChainOption | null {
  const id = entityIdFromTb(row.id) || entityIdFromTb(row.ruleChainId) || entityIdFromTb(row.rule_chain_id);
  const name = displayValue(row.name, row.title, row.label);
  return id ? { id, name } : null;
}

function extractCreatedProfileId(raw: unknown): string {
  const row = normalizeDeviceProfileRecord(raw);
  return (
    entityIdFromTb(row.id) ||
    entityIdFromTb(row.deviceProfileId) ||
    entityIdFromTb(row.device_profile_id)
  );
}

const PROFILE_TYPE_OPTIONS = ["DEFAULT"];
const TRANSPORT_TYPE_OPTIONS = ["DEFAULT", "MQTT", "HTTP", "COAP", "LWM2M", "SNMP"];
const ENTITY_TYPE_OPTIONS = ["RULE_CHAIN"];

function withCurrentOption(options: string[], current: string): string[] {
  const value = current.trim();
  return value && !options.includes(value) ? [...options, value] : options;
}

export default function DeviceProfileWorkspacePage() {
  const { profileId: profileIdParam } = useParams<{ profileId: string }>();
  const navigate = useNavigate();
  const profileId = profileIdParam?.trim() ?? "";
  const isCreateMode = profileId === "new";

  const [loadingProfile, setLoadingProfile] = useState(!isCreateMode);
  const [loadedRecord, setLoadedRecord] = useState<DeviceProfileRecord | null>(null);

  const [isProfileEditing, setIsProfileEditing] = useState(isCreateMode);
  const [saveSubmitting, setSaveSubmitting] = useState(false);

  const [profileNameInput, setProfileNameInput] = useState("");
  const [profileTypeInput, setProfileTypeInput] = useState("DEFAULT");
  const [profileTransportInput, setProfileTransportInput] = useState("DEFAULT");
  const [profileDescriptionInput, setProfileDescriptionInput] = useState("");
  const [profileEntityTypeInput, setProfileEntityTypeInput] = useState("RULE_CHAIN");
  const [profileDefaultRuleChainIdInput, setProfileDefaultRuleChainIdInput] = useState("");

  const [ruleChainSearch, setRuleChainSearch] = useState("");
  const [ruleChains, setRuleChains] = useState<RuleChainOption[]>([]);
  const [ruleChainsLoading, setRuleChainsLoading] = useState(false);

  const resolvedProfileId = useMemo(() => (isCreateMode ? "" : profileId), [isCreateMode, profileId]);

  const applyRecordToForm = useCallback((row: DeviceProfileRecord) => {
    setProfileNameInput(profileName(row) === "—" ? "" : profileName(row));
    setProfileTypeInput(profileType(row) === "—" ? "DEFAULT" : profileType(row));
    setProfileTransportInput(profileTransportType(row) === "—" ? "DEFAULT" : profileTransportType(row));
    setProfileDescriptionInput(profileDescription(row));
    setProfileEntityTypeInput(profileEntityType(row) === "—" ? "RULE_CHAIN" : profileEntityType(row));
    setProfileDefaultRuleChainIdInput(profileDefaultRuleChainId(row));
  }, []);

  const loadProfile = useCallback(async () => {
    if (isCreateMode || !profileId) return;
    setLoadingProfile(true);
    try {
      const record = await getDeviceProfileById(profileId);
      setLoadedRecord(record);
      applyRecordToForm(record);
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Failed to load device profile."));
      setLoadedRecord(null);
    } finally {
      setLoadingProfile(false);
    }
  }, [applyRecordToForm, isCreateMode, profileId]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    setIsProfileEditing(isCreateMode);
    setRuleChainSearch("");
  }, [profileId, isCreateMode]);

  const loadRuleChains = useCallback(async () => {
    setRuleChainsLoading(true);
    try {
      const page = await searchDeviceProfileRuleChains({
        page_size: 100,
        page: 0,
        sort_property: "name",
        sort_order: "ASC",
        type: "",
        text_search: ruleChainSearch,
      });
      const options = (page.data ?? [])
        .map(toRuleChainOption)
        .filter((item): item is RuleChainOption => item != null);
      setRuleChains(options);
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Failed to load rule chains."));
      setRuleChains([]);
    } finally {
      setRuleChainsLoading(false);
    }
  }, [ruleChainSearch]);

  useEffect(() => {
    void loadRuleChains();
  }, [loadRuleChains]);

  const ruleChainOptions = useMemo(() => {
    const currentId = profileDefaultRuleChainIdInput.trim();
    const currentOption =
      currentId && !ruleChains.some((item) => item.id === currentId) ? [{ id: currentId, name: currentId }] : [];
    return [...currentOption, ...ruleChains];
  }, [profileDefaultRuleChainIdInput, ruleChains]);

  const typeOptions = useMemo(() => withCurrentOption(PROFILE_TYPE_OPTIONS, profileTypeInput), [profileTypeInput]);
  const transportOptions = useMemo(
    () => withCurrentOption(TRANSPORT_TYPE_OPTIONS, profileTransportInput),
    [profileTransportInput],
  );
  const entityTypeOptions = useMemo(
    () => withCurrentOption(ENTITY_TYPE_OPTIONS, profileEntityTypeInput),
    [profileEntityTypeInput],
  );

  const headerProfileTitle = useMemo(() => {
    if (isCreateMode) return "";
    const trimmed = profileNameInput.trim();
    if (trimmed) return trimmed;
    const fromRecord = profileName(loadedRecord ?? {});
    return fromRecord && fromRecord !== "—" ? fromRecord : "";
  }, [isCreateMode, profileNameInput, loadedRecord]);

  const headerProfileSubtitle = useMemo(() => {
    if (isCreateMode) return "";
    const t = profileTypeInput.trim() || profileType(loadedRecord ?? {});
    const tr = profileTransportInput.trim() || profileTransportType(loadedRecord ?? {});
    const parts = [t, tr].filter((p) => p && p !== "—");
    return parts.join(" · ");
  }, [isCreateMode, profileTypeInput, profileTransportInput, loadedRecord]);

  const displayTitle = isCreateMode
    ? "Add device profile"
    : loadingProfile && loadedRecord == null
      ? "Device profile"
      : headerProfileTitle || "Device profile";

  const cancelProfileEdit = () => {
    if (isCreateMode) {
      navigate("/iot-gateway/device-profiles");
      return;
    }
    if (loadedRecord) applyRecordToForm(loadedRecord);
    setIsProfileEditing(false);
  };

  const saveProfile = async () => {
    const name = profileNameInput.trim();
    if (!name) {
      toast.error("Profile name is required.");
      return;
    }
    setSaveSubmitting(true);
    try {
      if (isCreateMode) {
        const raw = await createDeviceProfile({
          name,
          type: profileTypeInput.trim() || "DEFAULT",
          transport_type: profileTransportInput.trim() || "DEFAULT",
          description: profileDescriptionInput.trim(),
          entity_type: profileEntityTypeInput.trim() || "RULE_CHAIN",
          default_rule_chain_id: profileDefaultRuleChainIdInput.trim(),
        });
        toast.success("Device profile created.");
        const newId = extractCreatedProfileId(raw);
        if (newId) navigate(`/iot-gateway/device-profiles/${encodeURIComponent(newId)}`, { replace: true });
        else navigate("/iot-gateway/device-profiles");
      } else {
        await updateDeviceProfile({
          device_profile_id: resolvedProfileId,
          name,
          type: profileTypeInput.trim() || "DEFAULT",
          transport_type: profileTransportInput.trim() || "DEFAULT",
          description: profileDescriptionInput.trim(),
          entity_type: profileEntityTypeInput.trim() || "RULE_CHAIN",
          default_rule_chain_id: profileDefaultRuleChainIdInput.trim(),
        });
        toast.success("Device profile updated.");
        setIsProfileEditing(false);
        await loadProfile();
      }
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Failed to save device profile."));
    } finally {
      setSaveSubmitting(false);
    }
  };

  if (!profileId) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Missing profile id.
        <Button variant="link" className="ml-1 h-auto p-0 text-sm" onClick={() => navigate("/iot-gateway/device-profiles")}>
          Back to device profiles
        </Button>
      </div>
    );
  }

  if (!isCreateMode && !loadingProfile && loadedRecord == null) {
    return (
      <div className="space-y-3 p-4">
        <p className="text-sm text-muted-foreground">This device profile could not be loaded.</p>
        <Button type="button" variant="outline" size="sm" onClick={() => navigate("/iot-gateway/device-profiles")}>
          Back to device profiles
        </Button>
      </div>
    );
  }

  const readOnlyDetails = !isCreateMode && !isProfileEditing && loadedRecord;

  return (
    <div className="w-full space-y-2 p-0 md:p-0">
      <Card className="overflow-hidden border border-border/70 bg-card p-0 gap-0 text-card-foreground shadow-sm">
        <CardContent className="p-0">
          <div className="border-border/70 bg-gradient-to-br from-primary/10 via-background to-background px-1 py-1 md:px-1">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 space-y-3">
                <div className="flex items-start gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="mt-0.5 h-6 w-9 shrink-0 rounded-full border-border/70 bg-background/90"
                    onClick={() => navigate("/iot-gateway/device-profiles")}
                    title="Back to device profiles"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="truncate text-lg font-semibold tracking-tight">{displayTitle}</CardTitle>
                      {!isCreateMode && loadingProfile ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
                    </div>  
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mx-auto w-full max-w-full px-0 pb-2 md:px-0 p-0">
        <Card className="overflow-hidden border-border/70 shadow-sm p-0 gap-0 flex flex-col">
          <CardHeader className="gap-0 border-b border-border/60 bg-muted/20 px-3 py-2.5 [.border-b]:pb-2">
            <CardTitle className="text-lg font-semibold">
              {isCreateMode
                ? "Device profile details"
                : isProfileEditing
                  ?  "Device profile details"
                  : "Device profile details"}
            </CardTitle>
            <CardAction>
              {isCreateMode ? null : readOnlyDetails ? (
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  className="h-8 gap-1.5 px-2.5"
                  title="Edit profile"
                  onClick={() => setIsProfileEditing(true)}
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </Button>
              ) : (
                <div className="flex gap-1.5">
                  <Button type="button" variant="outline" size="xs" className="h-8" onClick={cancelProfileEdit} disabled={saveSubmitting}>
                    Cancel
                  </Button>
                  <Button type="button" size="xs" className="h-8" onClick={() => void saveProfile()} disabled={saveSubmitting}>
                    {saveSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save
                  </Button>
                </div>
              )}
            </CardAction>
          </CardHeader>
          <CardContent className="px-3 py-2.5">
            {readOnlyDetails && loadedRecord ? (
              <div className="space-y-2">
                <ReadOnlyDetailsField label="Profile id" value={profileIdFromRecord(loadedRecord) || resolvedProfileId} />
                <ReadOnlyDetailsField label="Name" value={profileName(loadedRecord)} />
                <ReadOnlyDetailsField label="Type" value={profileType(loadedRecord)} />
                <ReadOnlyDetailsField label="Transport type" value={profileTransportType(loadedRecord)} />
                <ReadOnlyDetailsField label="Entity type" value={profileEntityType(loadedRecord)} />
                <ReadOnlyDetailsField label="Default rule chain" value={profileDefaultRuleChainName(loadedRecord)} />
                <ReadOnlyDetailsField label="Description" value={profileDescription(loadedRecord) || "—"} />
              </div>
            ) : (
              <div className="space-y-4">
                {isCreateMode ? (
                  <>
                    <div className="space-y-1">
                      <Label className="text-xs">
                        Name<span className="text-destructive">*</span>
                      </Label>
                      <Input
                        value={profileNameInput}
                        onChange={(e) => setProfileNameInput(e.target.value)}
                        placeholder="Profile name"
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Default rule chain</Label>
                      <Select
                        modal={false}
                        value={profileDefaultRuleChainIdInput || "__none__"}
                        onValueChange={(value) => setProfileDefaultRuleChainIdInput(value === "__none__" ? "" : value)}
                      >
                        <SelectTrigger className="h-9 w-full">
                          <SelectValue placeholder={ruleChainsLoading ? "Loading rule chains…" : "Select a rule chain"} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {ruleChainOptions.map((option) => (
                            <SelectItem key={option.id} value={option.id}>
                              {option.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-muted-foreground">Optional.</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Description</Label>
                      <Textarea
                        value={profileDescriptionInput}
                        onChange={(e) => setProfileDescriptionInput(e.target.value)}
                        rows={4}
                        placeholder="Optional"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="ghost" size="sm" onClick={() => navigate("/iot-gateway/device-profiles")}>
                        Cancel
                      </Button>
                      <Button type="button" size="sm" onClick={() => void saveProfile()} disabled={saveSubmitting}>
                        {saveSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Add
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    <ReadOnlyDetailsField label="Profile id" value={profileIdFromRecord(loadedRecord ?? {}) || resolvedProfileId} />
                    <ProfileFormField label="Name" required>
                      <Input
                        value={profileNameInput}
                        onChange={(e) => setProfileNameInput(e.target.value)}
                        placeholder="Profile name"
                        className="h-9 w-full"
                      />
                    </ProfileFormField>
                    <ProfileFormField label="Type">
                      <Select
                        modal={false}
                        value={profileTypeInput || "__empty__"}
                        onValueChange={(v) => setProfileTypeInput(v === "__empty__" ? "" : v)}
                      >
                        <SelectTrigger className="h-9 w-full">
                          <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                          {typeOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </ProfileFormField>
                    <ProfileFormField label="Transport type">
                      <Select
                        modal={false}
                        value={profileTransportInput || "__empty__"}
                        onValueChange={(v) => setProfileTransportInput(v === "__empty__" ? "" : v)}
                      >
                        <SelectTrigger className="h-9 w-full">
                          <SelectValue placeholder="Transport" />
                        </SelectTrigger>
                        <SelectContent>
                          {transportOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </ProfileFormField>
                    <ProfileFormField label="Entity type">
                      <Select
                        modal={false}
                        value={profileEntityTypeInput || "__empty__"}
                        onValueChange={(v) => setProfileEntityTypeInput(v === "__empty__" ? "" : v)}
                      >
                        <SelectTrigger className="h-9 w-full">
                          <SelectValue placeholder="Entity type" />
                        </SelectTrigger>
                        <SelectContent>
                          {entityTypeOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </ProfileFormField>
                    <ProfileFormField label="Default rule chain">
                      <Select
                        modal={false}
                        value={profileDefaultRuleChainIdInput || "__none__"}
                        onValueChange={(value) => setProfileDefaultRuleChainIdInput(value === "__none__" ? "" : value)}
                      >
                        <SelectTrigger className="h-9 w-full">
                          <SelectValue placeholder={ruleChainsLoading ? "Loading…" : "Select default rule chain"} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {ruleChainOptions.map((option) => (
                            <SelectItem key={option.id} value={option.id}>
                              {option.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        value={ruleChainSearch}
                        onChange={(e) => setRuleChainSearch(e.target.value)}
                        placeholder="Filter rule chains (optional)"
                        className="mt-1.5 h-8 text-sm"
                        aria-label="Filter rule chains"
                      />
                    </ProfileFormField>
                    <ProfileFormField label="Description">
                      <Textarea
                        value={profileDescriptionInput}
                        onChange={(e) => setProfileDescriptionInput(e.target.value)}
                        rows={4}
                        placeholder="Optional"
                        className="min-h-[6.5rem]"
                      />
                    </ProfileFormField>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
