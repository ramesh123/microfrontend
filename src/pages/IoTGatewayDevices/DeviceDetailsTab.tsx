import type { ReactNode } from "react";

import { Copy, KeyRound, Loader2, Pencil, PlugZap, Trash2, UserRoundPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { ReadOnlyDetailsField } from "./DeviceDetailTabShared";

type DeviceProfileView = {
  id: string;
  name: string;
};

type DeviceDetailsTabProps = {
  assignedCustomer: string;
  name: string;
  profileName: string;
  label: string;
  assignedFirmware: string;
  assignedSoftware: string;
  isGateway: boolean;
  description: string;
  connectionState: string;
  deviceType: string;
  transportType: string;
  publicAccess: string;
  createdAt: string;
  deviceId: string;
  assignActionLabel: string;
  isEditing: boolean;
  editSubmitting: boolean;
  editName: string;
  editProfileId: string;
  editLabel: string;
  editDescription: string;
  editGateway: boolean;
  profiles: DeviceProfileView[];
  onEdit: () => void;
  onEditNameChange: (value: string) => void;
  onEditProfileChange: (value: string) => void;
  onEditLabelChange: (value: string) => void;
  onEditDescriptionChange: (value: string) => void;
  onEditGatewayChange: (value: boolean) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onAssignOrUnassign: () => void;
  onManageCredentials: () => void;
  onConnectivity: () => void;
  onCopyDeviceId: () => void;
  onDelete: () => void;
};

function EditableField({
  label,
  required = false,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/90">
        {label}
        {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </Label>
      {children}
    </div>
  );
}

export function DeviceDetailsTab({
  assignedCustomer,
  name,
  profileName,
  label,
  assignedFirmware,
  assignedSoftware,
  isGateway,
  description,
  connectionState,
  deviceType,
  transportType,
  publicAccess,
  createdAt,
  deviceId,
  assignActionLabel,
  isEditing,
  editSubmitting,
  editName,
  editProfileId,
  editLabel,
  editDescription,
  editGateway,
  profiles,
  onEdit,
  onEditNameChange,
  onEditProfileChange,
  onEditLabelChange,
  onEditDescriptionChange,
  onEditGatewayChange,
  onCancelEdit,
  onSaveEdit,
  onAssignOrUnassign,
  onManageCredentials,
  onConnectivity,
  onCopyDeviceId,
  onDelete,
}: DeviceDetailsTabProps) {
  return (
    <TabsContent value="details" className="mt-1 p-0 data-[state=active]:flex data-[state=active]:h-full data-[state=active]:flex-col">
      <Card className="overflow-hidden border-border/70 shadow-sm p-0 gap-0 flex h-full flex-col">
        <CardHeader className="gap-3 border-b border-border/60 bg-muted/20 px-3 py-2.5 [.border-b]:pb-1">
          <CardTitle className="shrink-0 whitespace-nowrap text-sm font-semibold">Device details</CardTitle>
          <CardAction className="min-w-0 max-w-full">
            <div className="flex min-w-0 justify-end overflow-x-auto">
            <div className="flex shrink-0 flex-nowrap items-center gap-1.5 whitespace-nowrap">
              {isEditing ? (
                <>
                  <Button type="button" variant="outline" size="xs" className="h-8" onClick={onCancelEdit} disabled={editSubmitting}>
                  Cancel
                  </Button>
                  <Button type="button" size="xs" className="h-8" onClick={onSaveEdit} disabled={editSubmitting}>
                    {editSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save
                  </Button>
                </>
              ) : (
                <>
                  <Button type="button" variant="outline" size="xs" className="h-7" onClick={onEdit}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                  <Button type="button" variant="outline" size="xs" className="h-7" onClick={onAssignOrUnassign}>
                    <UserRoundPlus className="mr-2 h-4 w-4" />
                    {assignActionLabel}
                  </Button>
                  <Button type="button" variant="outline" size="xs" className="h-7" onClick={onManageCredentials}>
                    <KeyRound className="mr-2 h-4 w-4" />
                    Credentials
                  </Button>
                  <Button type="button" variant="outline" size="xs" className="h-7" onClick={onConnectivity}>
                    <PlugZap className="mr-2 h-4 w-4" />
                    Connectivity
                  </Button>
                  <Button type="button" variant="outline" size="xs" className="h-7" onClick={onCopyDeviceId}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy ID
                  </Button>
                  <Button type="button" variant="destructive" size="xs" className="h-7" onClick={onDelete}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </>
              )}
            </div>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 p-0">
          <div className="h-full space-y-2 overflow-y-auto px-3 py-2.5">
           

          <ReadOnlyDetailsField label="Assigned to customer" value={assignedCustomer} />

          <div className="grid gap-2 md:grid-cols-2">
            {isEditing ? (
              <>
                <EditableField label="Name" required>
                  <Input value={editName} onChange={(e) => onEditNameChange(e.target.value)} className="h-10" />
                </EditableField>
                <EditableField label="Device profile" required>
                  <Select
                    modal={false}
                    value={editProfileId || "__none__"}
                    onValueChange={(value) => onEditProfileChange(value === "__none__" ? "" : value)}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select profile" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Select profile...</SelectItem>
                      {profiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </EditableField>
              </>
            ) : (
              <>
                <ReadOnlyDetailsField label="Name" required value={name} />
                <ReadOnlyDetailsField label="Device profile" required value={profileName} />
              </>
            )}
          </div>

          {isEditing ? (
            <EditableField label="Label">
              <Input value={editLabel} onChange={(e) => onEditLabelChange(e.target.value)} className="h-10" />
            </EditableField>
          ) : (
            <ReadOnlyDetailsField label="Label" value={label} />
          )}

          <div className="grid gap-2 md:grid-cols-2">
            <ReadOnlyDetailsField label="Assigned firmware" value={assignedFirmware} />
            <ReadOnlyDetailsField label="Assigned software" value={assignedSoftware} />
          </div>

          {isEditing ? (
            <div className="flex items-center gap-2 rounded-md border border-border/70 bg-background px-2.5 py-2 shadow-sm">
              <Checkbox checked={editGateway} onCheckedChange={(checked) => onEditGatewayChange(checked === true)} />
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Is gateway</p>
                <p className="text-xs text-muted-foreground">{editGateway ? "This device acts as a gateway." : "Standard device."}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-md border border-border/70 bg-background px-2.5 py-2 shadow-sm">
              <Checkbox checked={isGateway} disabled />
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Is gateway</p>
                <p className="text-xs text-muted-foreground">{isGateway ? "This device acts as a gateway." : "Standard device."}</p>
              </div>
            </div>
          )}

          {isEditing ? (
            <EditableField label="Description">
              <Textarea value={editDescription} onChange={(e) => onEditDescriptionChange(e.target.value)} className="min-h-[6.5rem]" />
            </EditableField>
          ) : (
            <ReadOnlyDetailsField label="Description" value={description} multiline />
          )}

          <div className="grid gap-2 border-t border-border/60 pt-2 md:grid-cols-2 xl:grid-cols-6">
            <ReadOnlyDetailsField label="Connection state" value={connectionState} className="min-w-0" />
            <ReadOnlyDetailsField label="Type" value={deviceType} className="min-w-0" />
            <ReadOnlyDetailsField label="Transport type" value={transportType} className="min-w-0" />
            <ReadOnlyDetailsField label="Public access" value={publicAccess} className="min-w-0" />
            <ReadOnlyDetailsField label="Created" value={createdAt} className="min-w-0" />
            <ReadOnlyDetailsField label="Entity id" value={deviceId} mono className="min-w-0" />
          </div>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
