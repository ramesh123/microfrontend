import React, { useEffect, useRef, useState } from 'react';
import { Accordion, AccordionContent, AccordionItem } from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Organization } from '@/types/orchestration';
import { GitBranch, PlusCircle, Workflow, Edit, Trash2, Pencil } from 'lucide-react';
import { OrchestrationViewer } from './OrchestrationViewer';
import { Button } from '@/components/ui/button';
import { OrchestrationEditor } from './OrchestrationEditor';
import { cn } from '@/lib/utils';
import { useOrganizationStore } from '@/stores/organizationStore';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ForwardedIconComponent } from '@/components/common/genericIconComponent';
import { componentTree } from '@/lib/componentRegistry';
import { defaultPerspectives, defaultRoles } from '@/stores/organizationStore';
import { deleteOrganizationApi, getAllOrganizationsApi } from '@/controllers/API/orchestrationApi';
import { orchestrationNodeApi } from '@/controllers/API/orchestrationNodeApi';
import { Loader2, RefreshCw } from 'lucide-react';
import { useRbacStore } from '@/stores/useRBACStore';
import { toast } from 'sonner';
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';

export function OrchestrationSetupManager() {
  const { currentUser } = useRbacStore();

  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  // const { organizations, deleteOrganization } = useOrganizationStore();
  const [allOrganizations, setAllOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingEditData, setIsFetchingEditData] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [flowPreviewOrg, setFlowPreviewOrg] = useState<Organization | null>(null);
  const [expandedOrgId, setExpandedOrgId] = useState<string | undefined>(undefined);
  const runOnce = useRef(false)

  const handleStartCreate = () => {
    const newId = `temp-org-${Date.now()}`;
    // const blankOrg: Organization = {
    //   id: newId,
    //   name: 'New Organization Setup',
    //   createdAt: new Date().toISOString(),
    //   memberCount: 0,
    //   plan: 'free',
    //   users: [],
    //   roles: JSON.parse(JSON.stringify(defaultRoles)),
    //   perspectives: JSON.parse(JSON.stringify(defaultPerspectives)),
    //   uiStructure: JSON.parse(JSON.stringify(componentTree)),
    //   hierarchy: {
    //     id: newId,
    //     name: 'New Organization',
    //     type: 'organization',
    //     position: { x: 50, y: 50 },
    //     children: [],
    //   },
    //   unconnectedNodes: [],
    // };
    const blankOrg: any = {
      id: newId,
      // name: 'New Organization Setup',
      // createdAt: new Date().toISOString(),
      // memberCount: 0,
      // plan: 'free',
      // users: [],
      // roles: JSON.parse(JSON.stringify(defaultRoles)),
      // perspectives: JSON.parse(JSON.stringify(defaultPerspectives)),
      // uiStructure: JSON.parse(JSON.stringify(componentTree)),
      hierarchy: null, // Remove default organization node
      unconnectedNodes: [], // Start with empty canvas
    };
    setEditingOrg(blankOrg);
    setIsCreating(true);
  };

  const handleFinishEditing = () => {
    setEditingOrg(null);
    setIsCreating(false);
    // Refresh the organizations list after editing
    refreshOrganizations();
  };

  const handleEditClick = async (org: any) => {
    setIsFetchingEditData(true);
    try {
      const setupData = await orchestrationNodeApi.getOrganizationSetup(org.id);
      const fullOrgData = setupData?.data ?? setupData;
      
      // Merge hierarchy data from the setup response
      setEditingOrg({
        ...org,
        ...fullOrgData,
        hierarchy: fullOrgData.hierarchy ?? org.hierarchy,
      });
      setIsCreating(false);
    } catch (error) {
      console.error('Failed to fetch organization setup for edit:', error);
      toast.error(getDisplayErrorMessage(error, 'Failed to load organization details for editing'));
      // Fallback to original data
      setEditingOrg(org);
      setIsCreating(false);
    } finally {
      setIsFetchingEditData(false);
    }
  };

  const refreshOrganizations = async () => {
    setIsLoading(true);
    try {
      const organizations = await getAllOrganizationsApi(currentUser?.organizationIds || [], currentUser?.role);
      setAllOrganizations(organizations.data);
    } catch (error) {
      console.error('Error fetching organizations:', error);
      toast.error(getDisplayErrorMessage(error, 'Failed to load organizations'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (runOnce.current) return;
    runOnce.current = true;
    refreshOrganizations();
  }, []);

  const deleteOrganization = async (id: string) => {
    const organization = await deleteOrganizationApi(id);
    if (organization) {
      refreshOrganizations();
    }
  }

  const renderAccordionView = () => (
    <Accordion
      type="single"
      collapsible
      className="w-full space-y-2"
      value={expandedOrgId}
      onValueChange={setExpandedOrgId}
    >
      {allOrganizations.map((org) => {
        const isExpanded = expandedOrgId === org.id;
        return (
          <AccordionItem
            value={org.id}
            key={org.id}
            className="rounded-lg border border-border border-b bg-muted/30 px-2 shadow-sm transition-colors last:border-b hover:border-primary/40 hover:bg-muted/50"
          >
            <div className="flex items-center gap-2 rounded-lg py-2">
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left text-base font-semibold hover:text-primary hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  setFlowPreviewOrg(org);
                }}
              >
                {org.org_name}
              </button>
              <div className="flex shrink-0 items-center gap-1">
                {currentUser?.role === 'Admin' && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditClick(org);
                      }}
                      disabled={isFetchingEditData}
                    >
                      {isFetchingEditData ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-destructive/10"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete the organization "{org.org_name}" and all of its associated data. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteOrganization(org.id)}
                            className="bg-destructive hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
                <Button
                    size="xs"
                    variant={isExpanded ? 'destructive' : 'primary'}
                    className={`h-6 shrink-0 rounded-xl px-3 text-xs ${
                      isExpanded
                        ? 'text-white'
                        : 'bg-primary text-white hover:bg-primary/90'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedOrgId(isExpanded ? undefined : org.id);
                    }}
                  >
                    {isExpanded ? 'Close' : 'Click here'}
                  </Button>
              </div>
            </div>
            <AccordionContent className="pb-3">
              <div
                className="mt-2 h-[340px] w-full overflow-hidden rounded-md border border-border bg-background"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {isExpanded && <OrchestrationViewer organization={org} />}
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );

  const renderCardView = () => ( 
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
      {allOrganizations.map(org => ( 
        <Card
          key={org.id}
          className="h-28 border border-border bg-muted/30 p-1 shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/50 hover:shadow-md"
        >
          <CardContent className="flex h-full flex-col justify-between p-2">
            <div className="flex-1">
              <button
                type="button"
                className="mb-1 w-full truncate text-left text-xs font-medium hover:text-primary hover:underline"
                onClick={() => setFlowPreviewOrg(org)}
              >
                {org.org_name}
              </button>
              <p className="text-xs text-muted-foreground">{org.description}</p>
              <p className="text-xs text-muted-foreground">{org.created_at}</p>
            </div>
            {currentUser?.role === 'Admin' && (
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditClick(org);
                  }}
                  disabled={isFetchingEditData}
                >
                  {isFetchingEditData ? <Loader2 className="h-3 w-3 animate-spin" /> : <Pencil className="h-3 w-3" />}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 hover:bg-destructive/10"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete the organization "{org.org_name}" and all of its associated data. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteOrganization(org.id)}
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return ( 
    <>
      {editingOrg ? ( 
        <OrchestrationEditor
          key={editingOrg.id}
          initialOrganization={editingOrg}
          onClose={handleFinishEditing}
          isCreating={isCreating}
        />
      ) : (  
        <Card className="flex h-full flex-col gap-0 border-border/70 p-0 shadow-sm">
      <CardHeader className="border-b border-border/60 px-1 py-1 [.border-b]:pb-0">
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2 text-[16px] font-semibold px-2">
                  <GitBranch className="h-4 w-4 text-primary" />
                  Orchestration Setup
                </CardTitle>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <div className="inline-flex items-center justify-center rounded-lg border bg-muted p-1 h-8">
                  {["list", "grid"].map((viewType) => ( 
                    <Button
                      key={viewType}
                      unstyled
                      size="icon"
                      onClick={() => setViewMode(viewType as 'list' | 'grid')}
                      className={`group relative z-10 m-0 rounded-md aspect-square h-7 flex items-center justify-center ${
                        viewMode === viewType
                          ? "text-foreground bg-background shadow-sm"
                          : "text-muted-foreground hover:bg-background/60"
                      }`}
                    >
                      <ForwardedIconComponent
                        name={viewType === "list" ? "Menu" : "LayoutGrid"}
                        aria-hidden="false"
                        className="h-4 w-4 group-hover:text-foreground"
                      />
                    </Button>
                  ))}
                </div>
                <Button variant="primary" onClick={refreshOrganizations} disabled={isLoading} className=" !h-8 !px-2" size='icon'>
                  <RefreshCw className={cn("!h-5 w-4", isLoading && "animate-spin")} />
                </Button>
                {currentUser?.role === 'Admin' && (
                  <Button onClick={handleStartCreate} variant='default' className='!h-8 !px-2'>
                    <PlusCircle className="mr-0 h-4 w-4" />Setup
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-grow p-2 md:p-2">
            {isLoading ? (
              <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 py-10">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-sm font-medium text-foreground">Loading orchestration list…</p>
                <p className="text-xs text-muted-foreground">Fetching organization setups</p>
              </div>
            ) : allOrganizations && allOrganizations.length > 0 ? (
              viewMode === 'grid' ? renderCardView() : renderAccordionView()
            ) : (
              <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 py-10 text-center">
                <Workflow className="h-10 w-10 text-muted-foreground/50" />
                <p className="text-sm font-medium">No orchestrations found</p>
                <p className="text-xs text-muted-foreground">
                  Click Setup to build your first orchestration flow.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      
      <Dialog
        open={!!flowPreviewOrg}
        onOpenChange={(open) => {
          if (!open) setFlowPreviewOrg(null);
        }}
      >
        <DialogContent className="flex max-h-[88vh] w-[min(96vw,56rem)] max-w-[56rem] flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b px-6 py-4">
            <DialogTitle>Organization Flow: {flowPreviewOrg?.org_name}</DialogTitle>
            <DialogDescription>
              Full orchestration flow for this organization.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 px-6 py-4">
            <div className="h-[min(68vh,560px)] min-h-[360px] w-full overflow-hidden rounded-lg border border-border bg-background">
              {flowPreviewOrg && <OrchestrationViewer organization={flowPreviewOrg} />}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
