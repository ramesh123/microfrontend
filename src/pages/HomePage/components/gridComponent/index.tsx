import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { rollbackWorkflowApi } from "@/controllers/API";
import {
  ApiRequestError,
  getDisplayErrorMessage,
  resolveApiErrorMessage,
} from "@/utils/exceptionHelper";
// import { Workflow } from "@/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Lock, MoreVertical, Pencil, Trash2, Download, Play, RotateCcw } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ExecuteWorkflowDialog, ExecuteParams } from "@/pages/FlowPage/components/PageComponent/ExecuteWorkflowDialog";
import AIimage from "@/assets/images/ai.png";
import ShadTooltip from "@/components/ui/shadTooltipComponent";
import { Copy, Check } from "lucide-react";
interface WorkflowCardProps {
  workflow: any;
  onDelete: (id: number) => void;
  onNavigate: (workflow: any) => void;
  onExport: (id: number) => void;
  onExecute: (workflow: any, params: ExecuteParams) => void;
  footerDateField?: "statement_date" | "updated_at";
}

export function WorkflowCard({
  workflow,
  onDelete,
  onNavigate,
  onExport,
  onExecute,
  footerDateField = "statement_date",
}: WorkflowCardProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isExecuteDialogOpen, setIsExecuteDialogOpen] = useState(false);
  const [isRollbackDialogOpen, setIsRollbackDialogOpen] = useState(false);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const creatorInitial = workflow.created_by ? workflow.created_by.charAt(0).toUpperCase() : (workflow.name ?? workflow.display_name ?? "W").toString().charAt(0).toUpperCase();
  const [copied, setCopied] = useState(false);
  const handleNavigate = () => {
    onNavigate(workflow);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeleteDialogOpen(true);
  };

  const handleExportClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onExport(workflow.id);
  };

  const handleRollbackClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRollbackDialogOpen(true);
  };

  const confirmRollback = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRollingBack(true);
    try {
      const data = await rollbackWorkflowApi(String(workflow.flow_id));
      const status = (data as any)?.status;
      const isSuccess =
        status === "success" ||
        status === true ||
        status === "true" ||
        String(status).toLowerCase() === "ok" ||
        String(status) === "1";

      if (isSuccess) {
        toast.success((data as any)?.message || "Workflow rolled back successfully.");
      } else {
        toast.error(resolveApiErrorMessage(data, "Rollback failed."));
      }
    } catch (error: unknown) {
      console.error("Failed to rollback workflow:", error);
      if (!(error instanceof ApiRequestError)) {
        toast.error(getDisplayErrorMessage(error, "Failed to rollback workflow."));
      }
    } finally {
      setIsRollingBack(false);
      setIsRollbackDialogOpen(false);
    }
  };

  const handleExecuteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExecuteDialogOpen(true);
  };

  const handleExecuteConfirm = (params: ExecuteParams) => {
    onExecute(workflow, params);
    setIsExecuteDialogOpen(false);
  };

  const confirmDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(workflow.id);
    setIsDeleteDialogOpen(false);
  };
  const titleCase = (s = '') =>
    s.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

  const isAiOrigin =
    workflow?.workflow_origin === 'AI' ||
    String(workflow?.workflow_origin || '').toUpperCase() === 'AI';
  const businessProcessLabel = workflow?.business_process
    ? titleCase(String(workflow.business_process))
    : "—";
  const footerDateLabel = (() => {
    const d =
      footerDateField === "updated_at"
        ? workflow.updated_at ?? workflow.created_at
        : workflow.statement_date;
    if (d == null || d === "") return "—";
    const date = new Date(d);
    return Number.isNaN(date.getTime()) ? "—" : date.toISOString().split("T")[0];
  })();

  return (
    <>
      <Card
        onClick={handleNavigate}
        className="py-3 gap-2 flex h-full cursor-pointer flex-col transition-all hover:shadow-lg hover:shadow-primary/20"
      >
        <CardHeader className="px-3">
          <div className="flex items-start justify-between gap-2">
            <div className="group flex max-w-[14.3rem] flex-1 items-center gap-1">
              <ShadTooltip content={titleCase(workflow?.name)}>
                <CardTitle className="cursor-pointer truncate text-l font-semibold">
                  {titleCase(workflow?.name)}
                </CardTitle>
              </ShadTooltip>

              <div className="relative flex items-center">
                <button
                  onClick={async (e) => {
                    e.stopPropagation();

                    await navigator.clipboard.writeText(
                      titleCase(workflow?.name || "")
                    );

                    setCopied(true);

                    setTimeout(() => {
                      setCopied(false);
                    }, 2000);
                  }}
                  className="opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-foreground" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                  )}
                </button>

                {copied && (
                  <div className="absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border bg-background px-2 py-1 text-xs shadow-md animate-in fade-in zoom-in-95">
                    Copied
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              {isAiOrigin && (
                <ShadTooltip content="AI Generated">
                  <Badge
                    variant="outline"
                    className="shrink-0 gap-1 border-primary/50 px-1.5 py-0 text-[10px] font-medium text-primary"
                  >
                    <img
                      src={AIimage}
                      alt="AI"
                      className="h-3 w-3 object-contain"
                    />
                    AI
                  </Badge>
                </ShadTooltip>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className=" flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  {/* <DropdownMenuItem disabled>
                  <Pencil className="mr-2 h-4 w-4" />
                  <span>Edit</span>
                </DropdownMenuItem> */}
                  <DropdownMenuItem onClick={handleExecuteClick}>
                    <Play className="mr-2 h-4 w-4" />
                    <span>Execute</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleRollbackClick}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    <span>Rollback</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportClick}>
                    <Download className="mr-2 h-4 w-4" />
                    <span>Export</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleDeleteClick} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                    <Trash2 className="mr-2 h-4 w-4" />
                    <span>Delete</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

          </div>
          <ShadTooltip content={workflow.description || ""}>
            <CardDescription className="h-8 overflow-hidden text-ellipsis pt-1 max-w-[14rem] truncate">
              {workflow.description || ""}
            </CardDescription>
          </ShadTooltip>
        </CardHeader>
        {/* <CardContent className="flex-grow px-3">
          
        </CardContent> */}
        <CardFooter className="flex w-full items-center justify-between gap-2 px-3 text-sm text-muted-foreground">
          <div className="flex min-w-0 items-center gap-1.5">
            {workflow.locked && <Lock className="h-3 w-3 shrink-0" />}
            <ShadTooltip content={businessProcessLabel}>
              <span className="max-w-[8rem] truncate text-xs">
                {businessProcessLabel}
              </span>
            </ShadTooltip>
          </div>
          <span className="shrink-0 whitespace-nowrap tabular-nums text-xs">
            {footerDateLabel}
          </span>
        </CardFooter>
      </Card>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the workflow
              <span className="font-semibold"> "{workflow.name}"</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isRollbackDialogOpen} onOpenChange={setIsRollbackDialogOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Rollback Workflow</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to rollback the workflow
              <span className="font-semibold"> "{workflow.name}"</span>? This will revert it to its previous state.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={(e) => e.stopPropagation()} disabled={isRollingBack}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRollback}
              disabled={isRollingBack}
            >
              {isRollingBack ? "Rolling back..." : "Rollback"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ExecuteWorkflowDialog
        open={isExecuteDialogOpen}
        onOpenChange={setIsExecuteDialogOpen}
        onExecute={handleExecuteConfirm}
      />
    </>
  );
}
