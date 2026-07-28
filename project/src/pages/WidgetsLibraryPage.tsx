import React, { useRef, useState } from "react";
import {
  CircleAlert,
  CircleHelp,
  Gauge,
  ImagePlus,
  LayoutGrid,
  LineChart,
  Link2,
  Package,
  PanelsTopLeft,
  Type,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import WidgetBundlesTableSection from "@/pages/WidgetsLibrary/WidgetBundlesTableSection";
import WidgetsTableSection from "@/pages/WidgetsLibrary/WidgetsTableSection";
import {
  widgetsLibraryPageTabListClass,
  widgetsLibraryPageTabsClass,
  widgetsLibraryPageTabTriggerBundlesClass,
  widgetsLibraryPageTabTriggerClass,
} from "@/pages/WidgetsLibrary/widgetsLibraryClasses";
import "@/pages/WidgetsLibrary/widgetsLibraryPageTabs.css";

const CREATE_WIDGET_OPTIONS = [
  { key: "time-series", label: "Time series", icon: LineChart },
  { key: "latest-values", label: "Latest values", icon: Gauge },
  { key: "control-widget", label: "Control widget", icon: PanelsTopLeft },
  { key: "alarm-widget", label: "Alarm widget", icon: CircleAlert },
  { key: "static-widget", label: "Static widget", icon: Type },
] as const;

export default function WidgetsLibraryPage() {
  const [activeTab, setActiveTab] = useState("widgets");
  const [createWidgetDialogOpen, setCreateWidgetDialogOpen] = useState(false);
  const [createBundleDialogOpen, setCreateBundleDialogOpen] = useState(false);
  const [setBundleLinkDialogOpen, setSetBundleLinkDialogOpen] = useState(false);
  const [importWidgetDialogOpen, setImportWidgetDialogOpen] = useState(false);
  const [importBundleDialogOpen, setImportBundleDialogOpen] = useState(false);
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);
  const [selectedImportBundleFile, setSelectedImportBundleFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isBundleDragActive, setIsBundleDragActive] = useState(false);
  const [bundleTitle, setBundleTitle] = useState("");
  const [bundleDescription, setBundleDescription] = useState("");
  const [bundleScada, setBundleScada] = useState(false);
  const [bundleOrder, setBundleOrder] = useState("");
  const [bundleImageLink, setBundleImageLink] = useState("");
  const [bundleImageLinkDraft, setBundleImageLinkDraft] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const bundleFileInputRef = useRef<HTMLInputElement | null>(null);

  const resetCreateBundleForm = () => {
    setBundleTitle("");
    setBundleDescription("");
    setBundleScada(false);
    setBundleOrder("");
    setBundleImageLink("");
    setBundleImageLinkDraft("");
  };
  const handleCreateBundleDialogChange = (open: boolean) => {
    setCreateBundleDialogOpen(open);
    if (!open) {
      resetCreateBundleForm();
    }
  };
  const clearImportFile = () => {
    setSelectedImportFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };
  const handleImportDialogChange = (open: boolean) => {
    setImportWidgetDialogOpen(open);
    if (!open) {
      setIsDragActive(false);
      clearImportFile();
    }
  };
  const handleFileSelected = (file: File | null) => {
    if (!file) return;
    setSelectedImportFile(file);
    setIsDragActive(false);
  };
  const clearImportBundleFile = () => {
    setSelectedImportBundleFile(null);
    if (bundleFileInputRef.current) {
      bundleFileInputRef.current.value = "";
    }
  };
  const handleImportBundleDialogChange = (open: boolean) => {
    setImportBundleDialogOpen(open);
    if (!open) {
      setIsBundleDragActive(false);
      clearImportBundleFile();
    }
  };
  const handleBundleFileSelected = (file: File | null) => {
    if (!file) return;
    setSelectedImportBundleFile(file);
    setIsBundleDragActive(false);
  };

  return (
    <div className="w-full">
      <Tabs value={activeTab} onValueChange={setActiveTab} className={widgetsLibraryPageTabsClass}>
        <TabsList className={widgetsLibraryPageTabListClass}>
          <TabsTrigger value="widgets" className={widgetsLibraryPageTabTriggerClass}>
            <LayoutGrid className="text-muted-foreground" aria-hidden />
            Widgets
          </TabsTrigger>
          <TabsTrigger value="bundles" className={widgetsLibraryPageTabTriggerBundlesClass}>
            <Package className="text-muted-foreground" aria-hidden />
            Widgets bundles
          </TabsTrigger>
        </TabsList>

        <TabsContent value="widgets" className="mt-0 gap-0">
          <WidgetsTableSection
            onCreateNewWidget={() => setCreateWidgetDialogOpen(true)}
            onImportWidget={() => setImportWidgetDialogOpen(true)}
          />
        </TabsContent>

        <TabsContent value="bundles" className="mt-0">
          <WidgetBundlesTableSection
            onCreateNewBundle={() => setCreateBundleDialogOpen(true)}
            onImportBundle={() => setImportBundleDialogOpen(true)}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={createWidgetDialogOpen} onOpenChange={setCreateWidgetDialogOpen}>
        <DialogContent
          className="max-w-[720px] gap-0 overflow-hidden border-0 p-0"
          closeButtonClassName="right-4 top-4 h-8 w-8 rounded-full text-primary-foreground hover:bg-primary-foreground hover:text-primary focus:ring-ring"
        >
          <div className="relative bg-primary px-4 py-3.5 text-primary-foreground">
            <DialogTitle className="text-[1.05rem] font-semibold text-primary-foreground">Select widget type</DialogTitle>
            <button
              type="button"
              className="absolute right-14 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full text-primary-foreground transition-colors hover:bg-primary-foreground hover:text-primary"
              onClick={() => toast.info("Widget type help is not wired yet.")}
              aria-label="Widget type help"
            >
              <CircleHelp className="h-5 w-5" />
            </button>
          </div>

          <div className="bg-background px-4 py-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {CREATE_WIDGET_OPTIONS.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.key}
                    type="button"
                    className="flex min-h-[104px] flex-col items-center justify-center rounded-md border border-border bg-primary px-3 py-3 text-center text-primary-foreground shadow-sm transition-transform hover:-translate-y-0.5 hover:bg-accent hover:text-accent-foreground"
                    onClick={() => toast.info(`${option.label} creation is not wired yet.`)}
                  >
                    <Icon className="mb-2 h-9 w-9" strokeWidth={2.2} />
                    <span className="text-sm font-medium leading-tight">{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <DialogFooter className="border-t px-4 py-2.5">
            <Button type="button" variant="outline" onClick={() => setCreateWidgetDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createBundleDialogOpen} onOpenChange={handleCreateBundleDialogChange}>
        <DialogContent
          className="max-w-[900px] gap-0 overflow-hidden border-0 p-0"
          closeButtonClassName="right-4 top-4 h-8 w-8 rounded-full text-primary-foreground hover:bg-primary-foreground hover:text-primary focus:ring-ring"
        >
          <div className="relative bg-primary px-5 py-3.5 text-primary-foreground">
            <DialogTitle className="text-[1.05rem] font-semibold text-primary-foreground">Add widgets bundle</DialogTitle>
            <button
              type="button"
              className="absolute right-14 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full text-primary-foreground transition-colors hover:bg-primary-foreground hover:text-primary"
              onClick={() => toast.info("Widgets bundle help is not wired yet.")}
              aria-label="Widgets bundle help"
            >
              <CircleHelp className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4 bg-background px-6 py-4">
            <Input
              value={bundleTitle}
              onChange={(event) => setBundleTitle(event.target.value)}
              placeholder="Title*"
              className="h-16 rounded-none border-x-0 border-t-0 border-b bg-muted px-4 text-base shadow-none"
            />

            <div className="space-y-2.5">
              <p className="text-base font-medium text-foreground">Image preview</p>
              <div className="grid gap-2.5 md:grid-cols-[110px_1fr_1fr]">
                <div className="flex min-h-[96px] items-center justify-center rounded-md border bg-card px-3 text-center text-sm leading-snug text-muted-foreground">
                  {bundleImageLink ? (
                    <img
                      src={bundleImageLink}
                      alt="Bundle preview"
                      className="max-h-[78px] max-w-full rounded object-contain"
                    />
                  ) : (
                    "No image selected"
                  )}
                </div>
                <button
                  type="button"
                  className="flex min-h-[96px] flex-col items-center justify-center rounded-md border bg-card px-4 text-center text-primary transition-colors hover:bg-muted"
                  onClick={() => toast.info("Browse from gallery action is not wired yet.")}
                >
                  <ImagePlus className="mb-2 h-6 w-6" />
                  <span className="text-base font-medium">Browse from gallery</span>
                </button>
                <button
                  type="button"
                  className="flex min-h-[96px] flex-col items-center justify-center rounded-md border bg-card px-4 text-center text-primary transition-colors hover:bg-muted"
                  onClick={() => {
                    setBundleImageLinkDraft(bundleImageLink);
                    setSetBundleLinkDialogOpen(true);
                  }}
                >
                  <Link2 className="mb-2 h-6 w-6" />
                  <span className="text-base font-medium">Set link</span>
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Textarea
                value={bundleDescription}
                onChange={(event) => setBundleDescription(event.target.value.slice(0, 1024))}
                placeholder="Description"
                className="min-h-[88px] rounded-none border-x-0 border-t-0 border-b bg-muted px-4 py-3 text-base shadow-none"
              />
              <div className="text-right text-sm text-muted-foreground">{bundleDescription.length}/1024</div>
            </div>

            <div className="flex items-center gap-3">
              <Switch checked={bundleScada} onCheckedChange={setBundleScada} />
              <span className="text-base text-foreground">SCADA widgets bundle</span>
            </div>

            <Input
              value={bundleOrder}
              onChange={(event) => setBundleOrder(event.target.value)}
              placeholder="Order"
              className="h-14 rounded-none border-x-0 border-t-0 border-b bg-muted px-4 text-base shadow-none"
            />
          </div>

          <DialogFooter className="border-t px-5 py-3">
            <Button type="button" variant="outline" onClick={() => handleCreateBundleDialogChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!bundleTitle.trim()}
              onClick={() => toast.info("Create widgets bundle action is not wired yet.")}
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={setBundleLinkDialogOpen} onOpenChange={setSetBundleLinkDialogOpen}>
        <DialogContent className="max-w-[520px] gap-0 overflow-hidden border-0 p-0">
          <div className="bg-primary px-5 py-3.5 text-primary-foreground">
            <DialogTitle className="text-[1.05rem] font-semibold text-primary-foreground">Set image link</DialogTitle>
          </div>

          <div className="space-y-3 bg-background px-5 py-4">
            <p className="text-sm text-muted-foreground">Paste the image URL for the widgets bundle preview.</p>
            <Input
              value={bundleImageLinkDraft}
              onChange={(event) => setBundleImageLinkDraft(event.target.value)}
              placeholder="https://example.com/image.png"
              className="h-11"
            />
          </div>

          <DialogFooter className="border-t px-5 py-3">
            <Button type="button" variant="outline" onClick={() => setSetBundleLinkDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!bundleImageLinkDraft.trim()}
              onClick={() => {
                setBundleImageLink(bundleImageLinkDraft.trim());
                setSetBundleLinkDialogOpen(false);
              }}
            >
              Set link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importWidgetDialogOpen} onOpenChange={handleImportDialogChange}>
        <DialogContent
          className="max-w-[760px] gap-0 overflow-hidden border-0 p-0"
          closeButtonClassName="right-4 top-4 h-8 w-8 rounded-full text-primary-foreground hover:bg-primary-foreground hover:text-primary focus:ring-ring"
        >
          <div className="bg-primary px-5 py-4 text-primary-foreground">
            <DialogTitle className="text-[1.05rem] font-semibold text-primary-foreground">Import widget</DialogTitle>
          </div>

          <div className="space-y-3 bg-background px-5 py-5">
            <div className="space-y-2.5">
              <p className="text-base font-medium text-foreground">
                Widget file<span className="text-destructive">*</span>
              </p>

              <div
                className={cn(
                  "relative flex min-h-[128px] items-center justify-center rounded-md border-2 border-dashed bg-background px-5 text-center transition-colors",
                  isDragActive ? "border-primary bg-muted" : "border-border",
                )}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragActive(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setIsDragActive(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDragActive(false);
                  handleFileSelected(event.dataTransfer.files?.[0] ?? null);
                }}
              >
                <button
                  type="button"
                  className="absolute right-4 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  onClick={clearImportFile}
                  aria-label="Clear selected file"
                >
                  <X className="h-5 w-5" />
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={(event) => handleFileSelected(event.target.files?.[0] ?? null)}
                />

                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                  <Upload className="h-9 w-9 opacity-30" />
                  <p className="text-base">
                    Drag and drop a JSON file or{" "}
                    <button
                      type="button"
                      className="font-semibold text-primary hover:underline"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Browse file
                    </button>
                  </p>
                </div>
              </div>

              <p className="text-base font-medium text-foreground">
                {selectedImportFile ? selectedImportFile.name : "No file selected"}
              </p>
            </div>
          </div>

          <DialogFooter className="border-t px-5 py-3">
            <Button type="button" variant="outline" onClick={() => handleImportDialogChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!selectedImportFile}
              onClick={() => toast.info("Import widget action is not wired yet.")}
            >
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importBundleDialogOpen} onOpenChange={handleImportBundleDialogChange}>
        <DialogContent
          className="max-w-[760px] gap-0 overflow-hidden border-0 p-0"
          closeButtonClassName="right-4 top-4 h-8 w-8 rounded-full text-primary-foreground hover:bg-primary-foreground hover:text-primary focus:ring-ring"
        >
          <div className="bg-primary px-5 py-4 text-primary-foreground">
            <DialogTitle className="text-[1.05rem] font-semibold text-primary-foreground">Import widgets bundle</DialogTitle>
          </div>

          <div className="space-y-3 bg-background px-5 py-5">
            <div className="space-y-2.5">
              <p className="text-base font-medium text-foreground">
                Widgets bundle file<span className="text-destructive">*</span>
              </p>

              <div
                className={cn(
                  "relative flex min-h-[128px] items-center justify-center rounded-md border-2 border-dashed bg-background px-5 text-center transition-colors",
                  isBundleDragActive ? "border-primary bg-muted" : "border-border",
                )}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsBundleDragActive(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setIsBundleDragActive(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsBundleDragActive(false);
                  handleBundleFileSelected(event.dataTransfer.files?.[0] ?? null);
                }}
              >
                <button
                  type="button"
                  className="absolute right-4 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  onClick={clearImportBundleFile}
                  aria-label="Clear selected file"
                >
                  <X className="h-5 w-5" />
                </button>

                <input
                  ref={bundleFileInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={(event) => handleBundleFileSelected(event.target.files?.[0] ?? null)}
                />

                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                  <Upload className="h-9 w-9 opacity-30" />
                  <p className="text-base">
                    Drag and drop a JSON file or{" "}
                    <button
                      type="button"
                      className="font-semibold text-primary hover:underline"
                      onClick={() => bundleFileInputRef.current?.click()}
                    >
                      Browse file
                    </button>
                  </p>
                </div>
              </div>

              <p className="text-base font-medium text-foreground">
                {selectedImportBundleFile ? selectedImportBundleFile.name : "No file selected"}
              </p>
            </div>
          </div>

          <DialogFooter className="border-t px-5 py-3">
            <Button type="button" variant="outline" onClick={() => handleImportBundleDialogChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!selectedImportBundleFile}
              onClick={() => toast.info("Import widgets bundle action is not wired yet.")}
            >
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
