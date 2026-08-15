import { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FieldValue } from "../types/organization";

interface BoundaryValueDialogProps {
  isOpen: boolean;
  onClose: () => void;
  fieldValue: FieldValue | null;
}

export function BoundaryValueDialog({ isOpen, onClose, fieldValue }: BoundaryValueDialogProps) {
  const boundaryData = useMemo(() => {
    if (!fieldValue) return null;

    const lower = parseInt(fieldValue.lowerLimit, 10);
    const upper = parseInt(fieldValue.upperLimit, 10);

    if (isNaN(lower) || isNaN(upper)) return null;

    return {
      lower,
      lowerMinus1: lower - 1,
      lowerPlus1: lower + 1,
      upper,
      upperMinus1: upper - 1,
      upperPlus1: upper + 1,
    };
  }, [fieldValue]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Field Value: {fieldValue?.fieldValue}</DialogTitle>
        </DialogHeader>
        
        <div className="py-4 space-y-4">
            <h3 className="font-semibold">Boundary Values</h3>
            <div className="border rounded-lg overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead>Lower Limit</TableHead>
                            <TableHead>Lower Limit (-1)</TableHead>
                            <TableHead>Lower Limit (+1)</TableHead>
                            <TableHead>Upper Limit</TableHead>
                            <TableHead>Upper Limit (-1)</TableHead>
                            <TableHead>Upper Limit (+1)</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {boundaryData ? (
                            <TableRow>
                                <TableCell>{boundaryData.lower}</TableCell>
                                <TableCell>{boundaryData.lowerMinus1}</TableCell>
                                <TableCell>{boundaryData.lowerPlus1}</TableCell>
                                <TableCell>{boundaryData.upper}</TableCell>
                                <TableCell>{boundaryData.upperMinus1}</TableCell>
                                <TableCell>{boundaryData.upperPlus1}</TableCell>
                            </TableRow>
                        ) : (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center text-muted-foreground">
                                    No valid numeric limits to calculate boundaries.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Close</Button>
          <Button type="button" variant="accent" onClick={onClose}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
