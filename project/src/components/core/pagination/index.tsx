import React, { useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE_OPTIONS = [6, 10, 25, 50] as const;

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalCount: number;
  /** Defaults to 10. Must be one of 6, 10, 25, or 50 — other values are normalized to the first option on first render. */
  pageSize?: number;
  onPageSizeChange: (size: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({ 
  currentPage,
  totalPages,
  onPageChange,
  totalCount,
  pageSize = 10,
  onPageSizeChange
}) => {
  const resolvedPageSize = PAGE_SIZE_OPTIONS.includes(pageSize as (typeof PAGE_SIZE_OPTIONS)[number])
    ? pageSize
    : PAGE_SIZE_OPTIONS[0];

  useEffect(() => {
    if (pageSize !== resolvedPageSize) {
      onPageSizeChange(resolvedPageSize);
    }
  }, [pageSize, resolvedPageSize, onPageSizeChange]);
  const pageRange = 4;
  const startPage = Math.max(1, currentPage - Math.floor(pageRange / 2));
  const endPage = Math.min(totalPages, startPage + pageRange - 1);

  const pageBtnClass =
    "!h-8 !w-8 min-w-8 shrink-0 p-0 text-sm tabular-nums";

  const pageButtons = [];
  for (let i = startPage; i <= endPage; i++) {
    pageButtons.push(
      <Button
        key={i}
        variant={i === currentPage ? "default" : "outline"}
        onClick={() => onPageChange(i)}
        className={pageBtnClass}
      >
        {i}
      </Button>
    );
  }

  return (
    <div className="flex items-center justify-between py-0 px-0">
      <Select
        value={String(resolvedPageSize)}
        onValueChange={(value) => {
          onPageSizeChange(Number(value));
          onPageChange(1);
        }}
      >
        <SelectTrigger className="w-[8rem] !h-8">
          <SelectValue placeholder="Per page" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="6">6 per page</SelectItem>
          <SelectItem value="10">10 per page</SelectItem>
          <SelectItem value="25">25 per page</SelectItem>
          <SelectItem value="50">50 per page</SelectItem>
        </SelectContent>
      </Select>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className={`${pageBtnClass} [&_svg]:size-4`}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {startPage > 1 && (
          <>
            <Button
              variant="outline"
              className={pageBtnClass}
              onClick={() => onPageChange(1)}
            >
              1
            </Button>
            {startPage > 2 && (
              <span className="flex h-8 min-w-8 items-center justify-center px-1 text-muted-foreground">
                …
              </span>
            )}
          </>
        )}
        {pageButtons}
        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && (
              <span className="flex h-8 min-w-8 items-center justify-center px-1 text-muted-foreground">
                …
              </span>
            )}
            <Button
              variant="outline"
              className={pageBtnClass}
              onClick={() => onPageChange(totalPages)}
            >
              {totalPages}
            </Button>
          </>
        )}
        <Button
          variant="outline"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className={`${pageBtnClass} [&_svg]:size-4`}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};