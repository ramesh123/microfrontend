import React, { useState, useEffect, useMemo } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import api from "@/controllers/API/api";
import { executeApiRequestSilent, getDisplayErrorMessage } from "@/utils/exceptionHelper";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Search,
  RefreshCw,
  Eye,
  Loader2,
  UserRoundPen,
} from "lucide-react";
import TableWithPagination from "@/common/tableWithPagination";
import { toast } from "sonner";
import { useNavigate } from "react-router";
import { RolePreviewDialog } from "@/modals/RolePreviewModal";
import { deleteRoleApi } from "@/controllers/API";

const PAGINATION_STEPS = [10, 20, 50, 100];

function SearchClearButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center justify-center rounded p-0.5 text-white bg-destructive hover:bg-destructive"
      aria-label="Clear search"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  );
}

interface AllowedPage {
  menu_name: string;
  allowed_sub_menus: string[];
}

interface Role {
  id: number;
  name: string;
  description?: string;
  perspectives_id: string[];
  permissions?: any;
  menu_items?: any[];
  status: boolean;
  allowed_pages: AllowedPage[];
  created_at: string;
  updated_at: string;
  entity_id: string | null;
}

interface RoleFormData {
  name: string;
  description?: string;
  perspectives_id: string[];
  status: boolean;
  allowed_pages: AllowedPage[];
}

function formatAllowedPages(allowedPages: AllowedPage[]): string {
  if (!allowedPages || allowedPages.length === 0) return "No pages assigned";

  return allowedPages
    .map((page) => {
      const subMenus =
        page.allowed_sub_menus.length > 0
          ? ` (${page.allowed_sub_menus.join(", ")})`
          : "";
      return `${page.menu_name}${subMenus}`;
    })
    .join("; ");
}

export const RolesComponent: React.FC = () => {
  const [data, setData] = useState<Role[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const navigate = useNavigate();
  const [previewingRole, setPreviewingRole] = useState<Role | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);


  // Search state
  const [searchTerm, setSearchTerm] = useState("");

  const [isRoleFormOpen, setIsRoleFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);

  // Filter data based on search term
  const filteredData = data.filter((role) => {
    if (!searchTerm.trim()) return true;

    const searchLower = searchTerm.toLowerCase();
    const allowedPagesText = formatAllowedPages(
      role.allowed_pages
    ).toLowerCase();

    return (
      role.name.toLowerCase().includes(searchLower) ||
      allowedPagesText.includes(searchLower) ||
      (role.status ? "active" : "inactive").includes(searchLower)
    );
  });

  // Fetch roles data
  const fetchRoles = async (
    showRefreshIndicator = false,
    nextPage = currentPage,
    nextPageSize = pageSize,
  ) => {
    try {
      if (showRefreshIndicator) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const skip = nextPage * nextPageSize;

      const result = await executeApiRequestSilent<{ data: Role[]; total: number }>(
        () =>
          api.get("/roles", {
            params: { skip, limit: nextPageSize },
            headers: {
              "Cache-Control": "no-cache, no-store, must-revalidate",
              Pragma: "no-cache",
              Expires: "0",
            },
          }),
        "Failed to fetch roles",
      );

      setData(result.data);
      setTotalCount(result.total);
    } catch (error) {
      console.error("Error fetching roles:", error);
      toast.error(getDisplayErrorMessage(error, "Failed to fetch roles. Please try again."));
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  };

  // Fetch role details for edit
  const fetchRoleDetails = async (roleId: number): Promise<Role | null> => {
    try {
      return await executeApiRequestSilent<Role>(
        () => api.get(`/roles/${roleId}`),
        "Failed to fetch role details",
      );
    } catch (error) {
      console.error("Error fetching role details:", error);
      toast.error(getDisplayErrorMessage(error, "Failed to fetch role details."));
      return null;
    }
  };



  const handleAddRole = () => {
    navigate("/settings/roles/modify");
    setFormMode("create");
    setSelectedRole(null);
    setIsRoleFormOpen(true);
  };

  const handleEditRole = async (role: Role) => {
    const roleDetails: any = await fetchRoleDetails(role.id);
    navigate(`/settings/roles/modify/${role.id}`, { state: { roles: roleDetails } });
    if (roleDetails) {
      setFormMode("edit");
      setSelectedRole(roleDetails);
      setIsRoleFormOpen(true);
    }
  };

  const handleDeleteRole = (role: Role) => {
    setRoleToDelete(role);
    setIsDeleteDialogOpen(true);
  };

  const handlePreviewRole = async (role: Role) => {
    setIsPreviewLoading(true);
    try {
      const roleDetails = await fetchRoleDetails(role.id);
      setPreviewingRole(roleDetails ?? role);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const confirmDeleteRole = async () => {
    if (!roleToDelete) return;

    try {
      await deleteRoleApi(roleToDelete.name);
      toast.success(`Role "${roleToDelete.name}" deleted successfully`);
      setIsDeleteDialogOpen(false);
      setRoleToDelete(null);
      // Refresh the roles list
      fetchRoles(true);
    } catch (error) {
      console.error("Error deleting role:", error);
      toast.error(getDisplayErrorMessage(error, "Failed to delete role"));
    }
  };

  const handleRefresh = () => {
    setSearchTerm("");
    setCurrentPage(0);
    setPageSize(10);
    fetchRoles(true, 0, 10);
  };

  useEffect(() => {
    fetchRoles(false, currentPage, pageSize);
  }, [currentPage, pageSize]);

  const columns = useMemo<ColumnDef<Role>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Role Name",
        size: 180,
        cell: ({ row }) => <span className="text-xs font-medium">{row.original.name}</span>,
      },
      {
        id: "status",
        header: "Status",
        size: 120,
        cell: ({ row }) => {
          const active = row.original.status;
          return (
            <div className="flex items-center gap-1.5 text-xs">
              {active ? (
                <CheckCircle className="h-3.5 w-3.5 shrink-0 text-green-500" />
              ) : (
                <XCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />
              )}
              <span className={active ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}>
                {active ? "Active" : "Inactive"}
              </span>
            </div>
          );
        },
      },
      {
        id: "allowed_pages",
        header: "Allowed Pages",
        size: 280,
        cell: ({ row }) => {
          const text = formatAllowedPages(row.original.allowed_pages);
          return (
            <span className="block max-w-xs truncate text-xs text-muted-foreground" title={text}>
              {text}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: () => (
          <div className="flex w-full justify-center px-1">
            <span className="text-xs">Actions</span>
          </div>
        ),
        size: 72,
        cell: ({ row }) => {
          const role = row.original;
          return (
            <div className="flex w-full justify-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="More options">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => void handlePreviewRole(role)} disabled={isPreviewLoading}>
                    <Eye className="mr-2 h-3.5 w-3.5" /> Preview
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleEditRole(role)}>
                    <Edit className="mr-2 h-3.5 w-3.5" /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleDeleteRole(role)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [isPreviewLoading],
  );

  return (
    <>
      <Card className="gap-0 border-border/70 p-0 shadow-sm">
      <CardHeader className="border-b border-border/60 px-1 py-1 [.border-b]:pb-0">
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-2">
      <CardTitle className="flex items-center gap-2 text-[16px] font-semibold p-1">
            <UserRoundPen className="h-4 w-4 text-primary" />
            Roles</CardTitle>
            <div className="flex shrink-0 flex-wrap items-center gap-1">
              <div className="relative w-full max-w-[11rem] sm:max-w-[12rem]">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search roles"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="!h-7.5 rounded-sm bg-background pl-8 pr-8 text-sm"
                />
                {searchTerm ? <SearchClearButton onClick={() => setSearchTerm("")} /> : null}
              </div>
              
              <Button onClick={handleAddRole} variant="default" className="!h-7.5 !px-2 gap-2">
                <Plus className="h-4 w-4" />
                <span className="ml-1 hidden sm:inline">Add Role</span>
              </Button>
              <Button
                onClick={handleRefresh}
                variant="primary"
                size="icon"
                disabled={isRefreshing || isLoading}
                className="!px-2 h-8"
                title="Refresh roles"
              >
                {isRefreshing || isLoading ? (
                  <RefreshCw className="h-!5 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-!5 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="[&_table]:text-xs [&_th]:h-8 [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-xs [&_th]:font-semibold [&_th]:normal-case [&_th]:tracking-wider [&_td]:py-1.5">
            <TableWithPagination
              key={`${searchTerm}|${pageSize}|${currentPage}`}
              data={filteredData}
              columns={columns}
              totalRows={totalCount}
              loading={isLoading || isRefreshing}
              pagination={{ steps: PAGINATION_STEPS, currentPage, pageSize }}
              paginationSummary="range"
              onChangePagination={({ currentPage: nextPage, limit }) => {
                setCurrentPage((prev) => (prev === nextPage ? prev : nextPage));
                setPageSize((prev) => (prev === limit ? prev : limit));
              }}
            />
          </div>
        </CardContent>
      </Card>
      <RolePreviewDialog
        role={previewingRole}
        isOpen={!!previewingRole}
        onOpenChange={(isOpen) => !isOpen && setPreviewingRole(null)}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the role "{roleToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRoleToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteRole}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

};
