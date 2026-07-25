import { useMemo, useState } from 'react';
import { CircuitBoard } from 'lucide-react';

import { cn } from '@/lib/utils';

import { resolveSimulationDeviceTypeVisual } from '../simulationDeviceTypeVisuals';

type DeviceTypeIconProps = {
  deviceType: string;
  className?: string;
  iconClassName?: string;
};

export function DeviceTypeIcon({ deviceType, className, iconClassName }: DeviceTypeIconProps) {
  const visual = useMemo(() => resolveSimulationDeviceTypeVisual(deviceType), [deviceType]);
  const [iconFailed, setIconFailed] = useState(false);

  return (
    <div
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/50',
        className,
      )}
      style={{ backgroundColor: `${visual.accentColor}14` }}
    >
      {!iconFailed && visual.iconUrl ? (
        <img
          src={visual.iconUrl}
          alt=""
          className={cn('h-6 w-6 object-contain dark:invert-[0.88]', iconClassName)}
          onError={() => setIconFailed(true)}
        />
      ) : (
        <CircuitBoard className="h-5 w-5 text-muted-foreground" aria-hidden />
      )}
    </div>
  );
}

export function useDeviceTypeVisual(deviceType: string) {
  return useMemo(() => resolveSimulationDeviceTypeVisual(deviceType), [deviceType]);
}
