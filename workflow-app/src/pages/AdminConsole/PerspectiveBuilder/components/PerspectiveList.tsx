
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Perspective } from '@/types/rbac';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { MoreHorizontal, Eye, Pencil, Trash2, CheckCircle, PlusCircle, Settings, RefreshCw, Search } from 'lucide-react';
import ForwardedIconComponent from '@/components/common/genericIconComponent';
import { PerspectiveViewDialog } from '@/modals/PerspectiveViewDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { OrganizationSwitcher } from '@/components/OrganizationSwitcher';
import { useRbacStore } from '@/stores/useRBACStore';
import { deletePerspectiveApi } from '@/controllers/API/orchestrationApi';
import { toast } from 'sonner';
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';
import { Input } from '@/components/ui/input';

export const PerspectiveList: React.FC = () => {
  const { availablePerspectives, setActivePerspective, deletePerspective, currentOrganization } = useRbacStore();
  const navigate = useNavigate();
  const [viewingPerspective, setViewingPerspective] = useState<Perspective | null>(null);
  const [deletingPerspective, setDeletingPerspective] = useState<Perspective | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const handleSetAsMenu = (id: string) => {
    setActivePerspective(id);
    navigate('/dashboard');
  };

  const handleEdit = (id: string) => {
    console.log("Editing perspective:", id);
    // return;
    navigate(`/perspectives/${id}/edit`);
  };

  console.log("Available perspectives:", availablePerspectives);
  const filteredPerspectives =
  availablePerspectives?.filter((p) =>
    [p.name, p.description]
      .filter(Boolean)
      .some((value) =>
        value.toLowerCase().includes(searchTerm.toLowerCase())
      )
  ) ?? [];
  return (
    <>
      <Card className="gap-0 overflow-hidden border-border/70 p-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-2 border-b border-border/60 px-3 py-2 [.border-b]:pb-1">
          <div className="min-w-0">
            <div className='flex items-center gap-2'>
            <Settings className='h-4 w-4 text-primary'/>
            <CardTitle className="text-[16px] font-semibold">Perspectives</CardTitle>
            </div>
          </div>
      <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search perspectives..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 pl-8"
            />
             {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center justify-center rounded p-0.5 text-white bg-destructive hover:text-white hover:bg-destructive"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                )}
          </div>

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setSearchTerm('')}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>

          <Button asChild variant="default" className="!h-8 !px-3">
            <Link to="/perspectives/create">
              <PlusCircle className="mr-1 h-4 w-4" />
              Create Perspective
            </Link>
          </Button>
        </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="w-full overflow-x-auto">
            <Table className="w-full table-fixed">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-8 w-[28%] px-3 text-xs font-semibold">Name</TableHead>
                  <TableHead className="h-8 px-2 text-xs font-semibold">Description</TableHead>
                  <TableHead className="h-8 w-[120px] px-2 text-xs font-semibold">Menu Items</TableHead>
                  <TableHead className="h-8 w-[190px] px-2 text-right text-xs font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {
                  filteredPerspectives.length > 0
                    ? filteredPerspectives.map((p) => (
                      <TableRow key={p.id}>
                    <TableCell className="px-3 py-1.5 text-xs font-medium">
                      <div className="flex items-center gap-2">
                        <ForwardedIconComponent name={p.icon} className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{p?.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-2 py-1.5 text-xs text-muted-foreground whitespace-normal break-words">{p?.description}</TableCell>
                    <TableCell className="px-2 py-1.5">
                      <Badge variant="secondary" className="text-xs">{p?.menu_items?.length ?? 0}</Badge>
                    </TableCell>
                    <TableCell className="px-2 py-1.5 text-right">
                      <Button variant="outline" size="sm" className="mr-1 !h-8 !px-2 text-xs" onClick={() => handleSetAsMenu(p.id)}>
                        <CheckCircle className="mr-1 h-3.5 w-3.5" />
                        Set as Menu
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setViewingPerspective(p)}>
                            <Eye className="mr-2 h-4 w-4" /> View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEdit(p.id)}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeletingPerspective(p)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )) :
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                    {searchTerm
                      ? 'No matching perspectives found.'
                      : 'No perspectives found. Create a perspective to get started.'}                    </TableCell>
                  </TableRow>
                }
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {viewingPerspective && (
        <PerspectiveViewDialog
          perspective={viewingPerspective}
          isOpen={!!viewingPerspective}
          onOpenChange={() => setViewingPerspective(null)}
        />
      )}

      {deletingPerspective && (
        <AlertDialog open={!!deletingPerspective} onOpenChange={() => setDeletingPerspective(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the
                <span className="font-semibold">"{deletingPerspective.name}"</span> perspective.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => {
                const id = deletingPerspective.id;
                deletePerspective(id);
                setDeletingPerspective(null);
                void deletePerspectiveApi(id).catch((error) => {
                  toast.error(getDisplayErrorMessage(error, 'Failed to delete perspective'));
                });
              }}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
};
