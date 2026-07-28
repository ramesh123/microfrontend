import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type DeviceTypeData } from '@/controllers/API/energySectorApi';
import { cn } from '@/lib/utils';
import { getEnergyNodeConfig } from './energyNodeConfig';
import { deviceTypeToNodeDetails } from './energyNodeDetails';

interface EnergyNodePaletteProps {
  deviceTypes?: DeviceTypeData[];
  isLoading?: boolean;
  isUpdateMode?: boolean;
}

export function EnergyNodePalette({
  deviceTypes = [],
  isLoading = false,
  isUpdateMode = false,
}: EnergyNodePaletteProps) {
  const sortedDevices = useMemo(
    () => [...deviceTypes].sort((a, b) => a.display_order - b.display_order),
    [deviceTypes],
  );

  const onDragStart = (event: React.DragEvent, device: DeviceTypeData) => {
    const data = {
      nodeType: device.device_type,
      label: device.device_type,
      deviceDetails: deviceTypeToNodeDetails(device),
    };
    event.dataTransfer.setData('application/reactflow', JSON.stringify(data));
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <Card className="w-64 shrink-0 gap-0 overflow-hidden border-border py-0 shadow-sm">
      <CardHeader className="border-b bg-muted/30 px-3 py-2.5">
        <CardTitle className="text-sm font-bold tracking-tight">
          {isUpdateMode ? 'Update Setup' : 'New Setup'}
        </CardTitle>
        <p className="text-[11px] text-muted-foreground">Drag components onto the canvas</p>
      </CardHeader>
      <CardContent className="max-h-[calc(100vh-220px)] overflow-y-auto px-2 pb-2 pt-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <span className="text-xs text-muted-foreground">Loading assets...</span>
          </div>
        ) : sortedDevices.length === 0 ? (
          <div className="flex items-center justify-center px-3 py-8 text-center">
            <span className="text-xs text-muted-foreground">No components available for this scope.</span>
          </div>
        ) : (
          <div className="space-y-1">
            {sortedDevices.map((device) => {
              const itemConfig = getEnergyNodeConfig(device.device_type, device.device_icon);
              const Icon = itemConfig.icon;

              return (
                <div
                  key={device.id}
                  className={cn(
                    'group flex cursor-grab items-center gap-2.5 rounded-md border bg-background px-2 py-2 transition-all',
                    'hover:shadow-sm active:cursor-grabbing',
                    itemConfig.borderColor,
                    'hover:border-primary/40',
                  )}
                  onDragStart={(event) => onDragStart(event, device)}
                  draggable
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-white">
                    <Icon className="h-5 w-5 shrink-0" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{device.device_type}</p>
                    {device.description ? (
                      <p className="truncate text-[10px] text-muted-foreground">{device.description}</p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
