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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Search,
  RefreshCw,
  Loader2,
  Users,
} from "lucide-react";
import TableWithPagination from "@/common/tableWithPagination";
import { UserForm, type UserFormSubmitPayload } from "./UsersForm";
import { toast } from "sonner";
import api from "@/controllers/API/api";
import { executeApiRequestSilent, getDisplayErrorMessage } from "@/utils/exceptionHelper";

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

interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  employee_id: string;
  application_id: string[];
  algo_role: string[];
  is_ad_user: boolean;
  status: boolean;
  manual_user: boolean;
  created_at: string;
  updated_at: string;
  org_id?: string[];
  perspective_id?: string[];
  perspective_ids?: string[];
}

interface UserApiResponse {
  status?: boolean;
  message?: string;
  data?: User[];
  total?: number;
}

function toastApiMessage(result: UserApiResponse, variant: "error" | "success") {
  const message = result.message?.trim();
  if (!message) return;
  if (variant === "error") {
    toast.info(message);
  } else {
    toast.success(message);
  }
}

export const UsersComponent: React.FC = () => {
  const [data, setData] = useState<User[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Search state
  const [searchTerm, setSearchTerm] = useState("");

  // Dialog states
  const [isUserFormOpen, setIsUserFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  // Filter data based on search term
  const filteredData = data.filter((user) => {
    if (!searchTerm.trim()) return true;

    const searchLower = searchTerm.toLowerCase();
    return (
      user.first_name.toLowerCase().includes(searchLower) ||
      user.last_name.toLowerCase().includes(searchLower) ||
      user.username.toLowerCase().includes(searchLower) ||
      user.email.toLowerCase().includes(searchLower) ||
      user.algo_role.some((role) => role.toLowerCase().includes(searchLower)) ||
      user.employee_id.toLowerCase().includes(searchLower)
    );
  });

  // Fetch users data
  const fetchUsers = async (
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

      const result = await executeApiRequestSilent<UserApiResponse>(
        () =>
          api.get("/users", {
            params: { skip: nextPage, limit: nextPageSize },
            headers: {
              "Cache-Control": "no-cache, no-store, must-revalidate",
              Pragma: "no-cache",
              Expires: "0",
            },
          }),
        "Failed to fetch users",
      );

      setData(result.data ?? []);
      setTotalCount(result.total ?? 0);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error(getDisplayErrorMessage(error, "Failed to fetch users"));
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  };

  // Fetch user details for edit
  const fetchUserDetails = async (userId: number): Promise<User | null> => {
    try {
      return await executeApiRequestSilent<User>(
        () => api.get(`/users/${userId}`),
        "Failed to fetch user details",
      );
    } catch (error) {
      console.error("Error fetching user details:", error);
      toast.error(getDisplayErrorMessage(error, "Failed to fetch user details"));
      return null;
    }
  };

  const extractCreatedUser = (result: unknown, username: string): User | null => {
    if (!result || typeof result !== "object") return null;
    const root = result as Record<string, unknown>;
    const candidates: unknown[] = [];
    if (Array.isArray(root.data)) candidates.push(...root.data);
    else if (root.data && typeof root.data === "object") candidates.push(root.data);
    else candidates.push(root);

    for (const item of candidates) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const id = row.id ?? row.user_id;
      if (id != null && String(row.username ?? username) === username) {
        return row as unknown as User;
      }
    }
    return null;
  };

  // Create user — keep form open in edit mode when id is returned so ACLs can be saved
  const createUser = async (userData: UserFormSubmitPayload) => {
    try {
      const result = await executeApiRequestSilent<UserApiResponse>(
        () => api.post("/users/create-user", { users_data: userData }),
        "Failed to create user",
      );

      toastApiMessage(result, "success");

      let created = extractCreatedUser(result, userData.username);
      if (!created?.id) {
        const users = await executeApiRequestSilent<UserApiResponse>(
          () => api.get("/users", { params: { skip: 0, limit: 100 } }),
          "Failed to resolve new user",
        );
        created =
          (users.data ?? []).find((u) => u.username === userData.username) ?? null;
      }

      if (created?.id) {
        const details = await fetchUserDetails(created.id);
        setFormMode("edit");
        setSelectedUser(details ?? created);
        toast.info("User created. Configure permissions, then save again if needed.");
      } else {
        setIsUserFormOpen(false);
      }

      fetchUsers();
    } catch (error) {
      console.error("Error creating user:", error);
      toast.error(getDisplayErrorMessage(error, "Failed to create user"));
    }
  };

  // Update user
  const updateUser = async (userData: UserFormSubmitPayload) => {
    try {
      const result = await executeApiRequestSilent<UserApiResponse>(
        () => api.post("/users/update-user", { users_data: userData }),
        "Failed to update user",
      );

      toastApiMessage(result, "success");
      setIsUserFormOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error(getDisplayErrorMessage(error, "Failed to update user"));
    }
  };

  // Delete user
  const deleteUser = async () => {
    if (!userToDelete) return;

    try {
      const result = await executeApiRequestSilent<UserApiResponse>(
        () => api.post("/users/delete-user", { username: userToDelete.username }),
        "Failed to delete user",
      );

      toastApiMessage(result, "success");
      setIsDeleteDialogOpen(false);
      setUserToDelete(null);
      fetchUsers();
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error(getDisplayErrorMessage(error, "Failed to delete user"));
    }
  };

  const handleAddUser = () => {
    setFormMode("create");
    setSelectedUser(null);
    setIsUserFormOpen(true);
  };

  const handleEditUser = async (user: User) => {
    const userDetails = await fetchUserDetails(user.id);
    if (userDetails) {
      setFormMode("edit");
      setSelectedUser(userDetails);
      setIsUserFormOpen(true);
    }
  };

  const handleDeleteUser = (user: User) => {
    setUserToDelete(user);
    setIsDeleteDialogOpen(true);
  };

  const handleFormSubmit = (userData: UserFormSubmitPayload) => {
    if (formMode === "create") {
      createUser(userData);
    } else {
      updateUser(userData);
    }
  };

  const handleRefresh = () => {
    setSearchTerm("");
    setCurrentPage(0);
    setPageSize(10);
    fetchUsers(true, 0, 10);
  };

  const handlePaginationChange = (page: number, limit: number) => {
    const pageSizeChanged = limit !== pageSize;
    const nextPage = pageSizeChanged ? 0 : page;

    if (pageSizeChanged) {
      setPageSize(limit);
      setCurrentPage(0);
      return;
    }

    setCurrentPage(nextPage);
  };

  // Load data on component mount and when pagination changes
  useEffect(() => {
    fetchUsers(false, currentPage, pageSize);
  }, [currentPage, pageSize]);

  const columns = useMemo<ColumnDef<User>[]>(
    () => [
      {
        accessorKey: "first_name",
        header: "First Name",
        size: 120,
        cell: ({ row }) => <span className="text-xs font-medium">{row.original.first_name}</span>,
      },
      {
        accessorKey: "last_name",
        header: "Last Name",
        size: 120,
        cell: ({ row }) => <span className="text-xs">{row.original.last_name}</span>,
      },
      {
        accessorKey: "username",
        header: "Username",
        size: 130,
        cell: ({ row }) => <span className="text-xs">{row.original.username}</span>,
      },
      {
        accessorKey: "email",
        header: "Email",
        size: 200,
        cell: ({ row }) => (
          <span className="block truncate text-xs text-muted-foreground" title={row.original.email}>
            {row.original.email}
          </span>
        ),
      },
      {
        id: "role",
        header: "Role",
        size: 140,
        cell: ({ row }) => (
          <span className="block truncate text-xs" title={row.original.algo_role.join(", ")}>
            {row.original.algo_role.join(", ")}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        size: 100,
        cell: ({ row }) => (
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
              row.original.status ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
            }`}
          >
            {row.original.status ? "Active" : "Inactive"}
          </span>
        ),
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
          const user = row.original;
          return (
            <div className="flex w-full justify-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="More options">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleEditUser(user)}>
                    <Edit className="mr-2 h-3.5 w-3.5" /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleDeleteUser(user)}
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
    [],
  );

  return (
    <Card className="gap-0 border-border/70 p-0 shadow-sm">
      <CardHeader className="border-b border-border/60 px-1 py-1 [.border-b]:pb-0">
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-2">
      <CardTitle className="flex items-center gap-2 text-[16px] font-semibold p-1">
                  <Users className="h-4 w-4 text-primary" />
                  Users
                </CardTitle>
          <div className="flex shrink-0 flex-wrap items-center gap-1">
            <div className="relative w-full max-w-[11rem] sm:max-w-[12rem]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search users"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-7.5 rounded-sm bg-background pl-8 pr-8 text-sm"
              />
              {searchTerm ? <SearchClearButton onClick={() => setSearchTerm("")} /> : null}
            </div>
            <Button
              onClick={handleRefresh}
              variant="primary"
              size="icon"
              disabled={isRefreshing || isLoading}
              className="!px-2"
              title="Refresh users"
            >
              {isRefreshing || isLoading ? (
                <RefreshCw className="!h-5 w-4 animate-spin" />
              ) : (
                <RefreshCw className="!h-5 w-4" />
              )}
            </Button>
            <Button onClick={handleAddUser} variant="default" className="!h-7.5 !px-2">
              <Plus className="h-4 w-4" />
              <span className="ml-1 hidden sm:inline">Add User</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="[&_table]:text-xs [&_th]:h-8 [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-xs [&_th]:font-semibold [&_th]:normal-case [&_th]:tracking-wider [&_td]:py-1.5">
          <TableWithPagination
            data={filteredData}
            columns={columns}
            totalRows={totalCount}
            loading={isLoading || isRefreshing}
            pagination={{ steps: PAGINATION_STEPS, currentPage, pageSize }}
            paginationSummary="range"
            onChangePagination={({ currentPage: page, limit }) => {
              handlePaginationChange(page, limit);
            }}
          />
        </div>

          {/* User Form Dialog */}
          <UserForm
            isOpen={isUserFormOpen}
            onClose={() => {
              setIsUserFormOpen(false);
              setSelectedUser(null);
            }}
            onSubmit={handleFormSubmit}
            mode={formMode}
            initialData={selectedUser}
          />

          {/* Delete Confirmation Dialog */}
          <Dialog
            open={isDeleteDialogOpen}
            onOpenChange={setIsDeleteDialogOpen}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm Deletion</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete the user "
                  {userToDelete?.username}"? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:justify-end pt-2">
                <Button
                  variant="outline"
                  onClick={() => setIsDeleteDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button variant="destructive" onClick={deleteUser}>
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
      </Dialog>
      </CardContent>
    </Card>
  );
};
