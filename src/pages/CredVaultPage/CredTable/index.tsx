import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MoreHorizontal, Edit, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "@/components/ui/accordion";
import { ConnectionTypeIcon } from '../ConnectionTypeIcon';

interface Connection {
  id: string;
  name: string;
  connection_type: string;
  host?: string;
  port?: string | number;
  user_name?: string;
  database_name?: string;
  /** Ingestion / API connector rows */
  group_type?: string;
  api_endpoint?: string;
  auth_type?: string;
  is_active?: boolean;
  created_at: string;
  updated_at: string;
  [key: string]: any;
}

const ACCORDION_ITEM_CLASS =
  "rounded-lg border border-border border-b bg-muted/30 px-2 shadow-sm transition-colors last:border-b hover:border-primary/40 hover:bg-muted/50";

interface ConnectionsTableProps {
  connections: {
    databases: Connection[];
    storage: Connection[];
    notifications: Connection[];
    ingestion: Connection[];
  };
  onEdit: (connection: Connection, module: string) => void;
  onDelete: (connection: Connection, module: string) => void;
}

const ConnectionsTable: React.FC<ConnectionsTableProps> = ({
  connections,
  onEdit,
  onDelete,
}) => {
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'N/A';
    }
  };

  const getStatusBadge = (isActive: boolean) => {
    return (
      <Badge
        variant={isActive ? "default" : "secondary"}
        className={isActive ? "bg-green-100 text-green-800 hover:bg-green-100" : "bg-gray-100 text-gray-800 hover:bg-gray-100"}
      >
        {isActive ? "Active" : "Inactive"}
      </Badge>
    );
  };

  const renderConnectionsTable = (connectionsList: Connection[], module: string) => {
    if (!connectionsList || connectionsList.length === 0) {
      return (
        <div className="rounded-lg border border-border bg-muted/20 p-8 text-center">
          <div className="mb-2 text-sm font-medium text-foreground">No connections found</div>
          <div className="text-xs text-muted-foreground">
            Click Connection to create your first connection
          </div>
        </div>
      );
    }

    const isIngestion = module === "ingestion";

    return (
      <div className="w-full overflow-hidden rounded-md border border-border bg-background">
        <div className="max-h-[min(420px,50vh)] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted">
              <TableRow className="h-10 border-b border-border/60 hover:bg-transparent">
                <TableHead className="font-semibold h-10">Name</TableHead>
                <TableHead className="font-semibold h-10">Type</TableHead>
                {isIngestion ? (
                  <>
                    <TableHead className="font-semibold h-10">Group type</TableHead>
                    <TableHead className="font-semibold min-w-[180px] h-10">API endpoint</TableHead>
                    <TableHead className="font-semibold h-10">Auth type</TableHead>
                  </>
                ) : (
                  <>
                    <TableHead className="font-semibold h-10">Host</TableHead>
                    <TableHead className="font-semibold h-10">Port</TableHead>
                    <TableHead className="font-semibold h-10">Username</TableHead>
                    <TableHead className="font-semibold h-10">Database</TableHead>
                  </>
                )}
                <TableHead className="font-semibold h-10">Status</TableHead>
                <TableHead className="font-semibold h-10">Updated</TableHead>
                <TableHead className="font-semibold w-[70px] h-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {connectionsList.map((connection) => (
                <TableRow key={connection.id} className="h-10 transition-colors">
                  <TableCell className="font-sm h-10 py-0">
                    {connection?.name || "N/A"}
                  </TableCell>
                  <TableCell className="h-10 py-0">
                    <div className="flex items-center gap-2">
                      <ConnectionTypeIcon
                        connectionType={connection.connection_type}
                        className="h-6 w-6"
                      />
                      <Badge variant="outline" className="text-xs font-mono">
                        {connection?.connection_type || "N/A"}
                      </Badge>
                    </div>
                  </TableCell>
                  {isIngestion ? (
                    <>
                      <TableCell className="h-10 py-0 max-w-[140px] truncatete text-sm">
                        {connection.group_type ?? "N/A"}
                      </TableCell>
                      <TableCell className="h-10 py-0 max-w-[280px] truncate text-sm" title={connection.api_endpoint}>
                        {connection.api_endpoint ?? "N/A"}
                      </TableCell>
                      <TableCell className="h-10 py-0">
                        {connection.auth_type != null && connection.auth_type !== "" ? (
                          <Badge variant="outline" className="text-xs font-mono capitalize">
                            {String(connection.auth_type)}
                          </Badge>
                        ) : (
                          "N/A"
                        )}
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell className="h-10 py-0 max-w-[150px] truncate">
                        {connection.host || "N/A"}
                      </TableCell>
                      <TableCell className="h-10 py-0">
                        {connection.port || "N/A"}
                      </TableCell>
                      <TableCell className="h-10 py-0 max-w-[120px] truncate">
                        {connection.user_name || connection.username || "N/A"}
                      </TableCell>
                      <TableCell className="h-10 py-0 max-w-[120px] truncate ">
                        {connection.database_name || connection.database || "N/A"}
                      </TableCell>
                    </>
                  )}
                  <TableCell className="h-10 py-0">
                    {getStatusBadge(connection.is_active !== false)}
                  </TableCell>
                  <TableCell className="h-10 py-0 text-sm">
                    {formatDate(connection?.updated_at)}
                  </TableCell>
                  <TableCell className="h-10 py-0">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0 ">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[140px]">
                        <DropdownMenuItem
                          onClick={() => onEdit(connection, module)}
                          className="cursor-pointer "
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onDelete(connection, module)}
                          className="cursor-pointer text-red-600  hover:text-red-700  focus:text-red-700"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  const renderAccordionSection = (
    value: string,
    label: string,
    count: number,
    list: Connection[],
    module: string,
  ) => (
    <AccordionItem value={value} className={ACCORDION_ITEM_CLASS}>
      <AccordionTrigger className="group py-2 text-base font-semibold hover:no-underline [&>svg]:hidden">
        <div className="flex w-full items-center justify-between gap-2">
          <span className="text-[15px]">
            {label} ({count})
          </span>
          <span className="hidden shrink-0 group-data-[state=closed]:inline-flex">
            <span className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground shadow-sm">
              Click here
            </span>
          </span>
          <span className="hidden shrink-0 group-data-[state=open]:inline-flex">
            <span className="rounded-full bg-destructive px-3 py-1 text-xs font-medium text-white shadow-sm">
              Close
            </span>
          </span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="pb-3">
        {renderConnectionsTable(list, module)}
      </AccordionContent>
    </AccordionItem>
  );

  return (
    <div className="w-full">
      <Accordion type="single" collapsible className="w-full space-y-2" defaultValue="databases">
        {renderAccordionSection(
          "databases",
          "Databases",
          connections.databases?.length || 0,
          connections.databases || [],
          "databases",
        )}
        {renderAccordionSection(
          "storage",
          "Storage",
          connections.storage?.length || 0,
          connections.storage || [],
          "storage",
        )}
        {renderAccordionSection(
          "notifications",
          "Notifications",
          connections.notifications?.length || 0,
          connections.notifications || [],
          "notifications",
        )}
        {renderAccordionSection(
          "ingestion",
          "Ingestion",
          connections.ingestion?.length || 0,
          connections.ingestion || [],
          "ingestion",
        )}
      </Accordion>
    </div>
  );
};

export default ConnectionsTable;
