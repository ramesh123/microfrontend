import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building, CaseSensitive, AppWindow, GitBranch, Database, Table, FileText, Workflow, Loader2, CheckCircle2 } from 'lucide-react';
import { OrchestrationItemType, Organization } from '@/types/orchestration';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getOrganizationsApi } from '@/controllers/API/orchestrationApi';
import { cn } from '@/lib/utils';

const paletteItems: { type: OrchestrationItemType; label: string; icon: React.ElementType }[] = [
  { type: 'organization', label: 'Organization', icon: Building },
  { type: 'businessUnit', label: 'Business Unit', icon: CaseSensitive },
  { type: 'application', label: 'Application', icon: AppWindow },
  { type: 'businessProcess', label: 'Business Process', icon: GitBranch },
  { type: 'transaction', label: 'Transaction', icon: FileText },
  { type: 'table', label: 'Table', icon: Table },
  { type: 'project', label: 'Project', icon: Database },
];

interface ExistingOrganization {
  id: number;
  organization_name: string;
  industry_type: string;
  country: string;
  state: string;
  city: string;
  email: string;
  company_id: string;
  contact: string;
  zipcode: string;
  address_1: string;
  address_2: string;
  organization_description: string;
  created_at: string;
  updated_at: string;
  entity_id: string | null;
}

interface OrchestrationNodePaletteProps {
  organizations: Organization[];
  /** ID of the existing-org node already on the canvas (if any) */
  placedExistingOrgId?: number | null;
  /** True while the user is editing a node (modal open) */
  isEditMode?: boolean;
}

export function OrchestrationNodePalette({
  organizations,
  placedExistingOrgId,
  isEditMode = false,
}: OrchestrationNodePaletteProps) {
  const [existingOrgs, setExistingOrgs] = useState<ExistingOrganization[]>([]);
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(false);
  const [orgsError, setOrgsError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('new-setup');

  useEffect(() => {
    if (activeTab === 'existing-org' && existingOrgs.length === 0 && !isLoadingOrgs) {
      fetchOrganizations();
    }
  }, [activeTab]);

  const fetchOrganizations = async () => {
    setIsLoadingOrgs(true);
    setOrgsError(null);
    try {
      const res = await getOrganizationsApi();
      const list: ExistingOrganization[] = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : [];
      setExistingOrgs(list);
    } catch {
      setOrgsError('Failed to load organizations.');
    } finally {
      setIsLoadingOrgs(false);
    }
  };

  const onDragStart = (
    event: React.DragEvent,
    nodeType: string,
    isExistingOrg: boolean = false,
    orgData?: ExistingOrganization
  ) => {
    const data = {
      nodeType,
      isExistingOrg,
      orgId: orgData?.id?.toString(),
      existingOrgData: orgData
        ? {
            apiId: orgData.id,
            name: orgData.organization_name,
            industry_type: orgData.industry_type,
            country: orgData.country,
            state: orgData.state,
            city: orgData.city,
            email: orgData.email,
            company_id: orgData.company_id,
            contact: orgData.contact,
            zipcode: orgData.zipcode,
            address_1: orgData.address_1,
            address_2: orgData.address_2,
          }
        : undefined,
    };
    event.dataTransfer.setData('application/reactflow', JSON.stringify(data));
    event.dataTransfer.effectAllowed = 'move';
  };

  /** Whether any existing org is already placed on the canvas */
  const hasPlacedOrg = placedExistingOrgId != null;

  return (
    <Card className="w-60 shrink-0 gap-0 py-0">
      <CardHeader className="px-2.5 py-2">
        <CardTitle className="text-sm">Node Palette</CardTitle>
      </CardHeader>
      <CardContent className="px-2 pb-2 pt-0">
        <Tabs defaultValue="new-setup" className="gap-1" onValueChange={setActiveTab}>
          <TabsList className="grid h-8 w-full grid-cols-2 p-0.5">
            <TabsTrigger value="new-setup" className="px-1 text-xs">New Setup</TabsTrigger>
            <TabsTrigger value="existing-org" className="px-1 text-xs">Existing Org</TabsTrigger>
          </TabsList>

          {/* ── New Setup tab ── */}
          <TabsContent value="new-setup" className="mt-1.5 p-0">
            <div className="flex flex-col gap-1">
              {paletteItems.map((item) => (
                <div
                  key={item.type}
                  className="flex cursor-grab items-center gap-2 rounded-md border bg-background px-2 py-1.5 transition-colors hover:border-primary hover:bg-muted/40"
                  onDragStart={(event) => onDragStart(event, item.type)}
                  draggable
                >
                  <item.icon className="h-4 w-4 shrink-0 text-primary" />
                  <span className="text-xs font-medium">{item.label}</span>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ── Existing Org tab ── */}
          <TabsContent value="existing-org" className="mt-1.5 p-0">
            {isLoadingOrgs ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                <span className="text-xs">Loading…</span>
              </div>
            ) : orgsError ? (
              <div className="px-1 py-4 text-center">
                <p className="mb-2 text-xs text-destructive">{orgsError}</p>
                <button onClick={fetchOrganizations} className="text-xs text-primary underline underline-offset-2">
                  Retry
                </button>
              </div>
            ) : existingOrgs.length === 0 ? (
              <div className="px-1 py-6 text-center text-xs text-muted-foreground">
                <Workflow className="mx-auto mb-1.5 h-6 w-6" />
                No organisations found.
              </div>
            ) : (
              <>
                {/* Hint banner when one org is already placed */}
                {hasPlacedOrg && (
                  <div className="mb-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-[10px] leading-snug text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                    Only one organisation can be placed on the canvas at a time.
                  </div>
                )}
                {isEditMode && (
                  <div className="mb-1.5 rounded-md bg-muted/60 px-2 py-1.5 text-[10px] leading-snug text-muted-foreground">
                    Close the editor to drag a new organisation.
                  </div>
                )}
                <div className="flex max-h-[420px] flex-col gap-1 overflow-y-auto pr-0.5">
                  {existingOrgs.map((org) => {
                    const isPlaced = org.id === placedExistingOrgId;
                    const isDisabled = isEditMode || hasPlacedOrg;

                    return (
                      <div
                        key={org.id}
                        draggable={!isDisabled}
                        onDragStart={
                          isDisabled
                            ? (e) => e.preventDefault()
                            : (event) => onDragStart(event, 'organization', true, org)
                        }
                        title={
                          isEditMode
                            ? 'Close the editor first'
                            : hasPlacedOrg
                            ? 'An organisation is already placed'
                            : org.organization_name
                        }
                        className={cn(
                          'flex items-start gap-2 rounded-md border px-2 py-1.5 transition-colors',
                          isDisabled
                            ? 'cursor-not-allowed opacity-50 bg-muted/30'
                            : 'cursor-grab bg-background hover:border-primary hover:bg-muted/40',
                          isPlaced && 'border-primary/40 bg-primary/5'
                        )}
                      >
                        {isPlaced ? (
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        ) : (
                          <Building className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium leading-tight">
                            {org.organization_name}
                          </p>
                          {(org.industry_type || org.country) && (
                            <p className="truncate text-[10px] leading-tight text-muted-foreground">
                              {[org.industry_type, org.country].filter(Boolean).join(' · ')}
                            </p>
                          )}
                          {isPlaced && (
                            <p className="text-[10px] leading-tight text-primary">
                              Already on canvas
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}