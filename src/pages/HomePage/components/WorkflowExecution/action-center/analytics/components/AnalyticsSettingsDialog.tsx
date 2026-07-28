import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import ChartsListPage from '@/pages/charts/ChartsListPage';
import DashboardsListPage from '@/pages/Dashboards/DashboardListPage';
import type { AnalyticsViewProps } from '../viewTypes';

/** Keep Settings open when focus/pointer moves into portaled action menus. */
function preventDismissForPortaledMenus(event: {
  preventDefault: () => void;
  target?: EventTarget | null;
  detail?: { originalEvent?: { target?: EventTarget | null } };
}) {
  const target = event.detail?.originalEvent?.target ?? event.target;
  if (!(target instanceof Element)) return;
  if (
    target.closest(
      [
        '[data-radix-popper-content-wrapper]',
        '[data-slot="dropdown-menu-content"]',
        '[data-slot="select-content"]',
        '[data-slot="popover-content"]',
        '[role="menu"]',
        '[role="listbox"]',
        '[data-sonner-toaster]',
        '[data-sonner-toast]',
      ].join(', '),
    )
  ) {
    event.preventDefault();
  }
}

export function AnalyticsSettingsDialog({
  isSettingsDialogOpen,
  setIsSettingsDialogOpen,
  settingsActiveTab,
  setSettingsActiveTab,
  workflowName,
}: AnalyticsViewProps) {
  return (
    <>
      {/* Radix skips Overlay when modal={false}; keep a blurred backdrop for Settings. */}
      {isSettingsDialogOpen ? (
        <div
          aria-hidden
          className="fixed inset-0 z-[1290] bg-black/50 backdrop-blur-sm animate-in fade-in-0"
          onClick={() => setIsSettingsDialogOpen(false)}
        />
      ) : null}
      <Dialog modal={false} open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
        <DialogContent
          className="z-[1300] max-w-6xl max-h-[95vh] p-0 flex flex-col gap-2"
          showOverlay={false}
          onFocusOutside={(e) => e.preventDefault()}
          onInteractOutside={preventDismissForPortaledMenus}
          onPointerDownOutside={preventDismissForPortaledMenus}
        >
          <DialogHeader className="px-6 py-2 border-b">
            <DialogTitle className="text-lg font-semibold ">Settings</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden flex flex-col">
            <Tabs value={settingsActiveTab} onValueChange={setSettingsActiveTab} className="flex-1 flex flex-col gap-0 overflow-hidden">
              <TabsList className="mx-5 mt-0 mb-0 gap-0">
                <TabsTrigger value="charts">Charts</TabsTrigger>
                <TabsTrigger value="dashboards">Dashboards</TabsTrigger>
              </TabsList>
              <div className="flex-1 overflow-auto px-6 pb-0">
                <TabsContent value="charts" className="mt-0 m-0">
                  <ChartsListPage workflowName={workflowName} />
                </TabsContent>
                <TabsContent value="dashboards" className="mt-0 m-0">
                  <DashboardsListPage workflowName={workflowName} />
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
