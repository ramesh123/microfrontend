import { Handle, Position } from '@xyflow/react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { isIllustratedDeviceType, type EnergyNodeConfig } from './energyNodeConfig';
import type { EnergyNodeDeviceDetails } from './energyNodeDetails';

const portClass =
  '!h-2.5 !w-2.5 !min-h-0 !min-w-0 !rounded-[2px] !border-2 !border-sky-600 !bg-sky-400 shadow-sm transition-colors hover:!bg-sky-500';

export type WorkflowStyleNodeCardProps = {
  label: string;
  type: string;
  config: EnergyNodeConfig;
  deviceDetails?: EnergyNodeDeviceDetails;
  selected?: boolean;
  isReadOnly?: boolean;
  onDelete?: () => void;
  showHandles?: boolean;
};

export function WorkflowStyleNodeCard({
  label,
  type,
  config,
  deviceDetails,
  selected = false,
  isReadOnly = false,
  onDelete,
  showHandles = true,
}: WorkflowStyleNodeCardProps) {
  const Icon = config.icon;
  const illustrated = isIllustratedDeviceType(type, deviceDetails?.device_icon);

  return (
    <div className="group/node relative m-0 p-0">
      {showHandles ? (
        <>
          <Handle
            type="target"
            position={Position.Left}
            id="left"
            className={portClass}
            style={{ left: -6, top: '50%', transform: 'translateY(-50%)' }}
          />
          <Handle
            type="source"
            position={Position.Right}
            id="right"
            className={portClass}
            style={{ right: -6, top: '50%', transform: 'translateY(-50%)' }}
          />
          <Handle
            type="target"
            position={Position.Top}
            id="top"
            className={portClass}
            style={{ top: -6, left: '50%', transform: 'translateX(-50%)' }}
          />
          <Handle
            type="source"
            position={Position.Top}
            id="top-source"
            className={portClass}
            style={{ top: -6, left: '50%', transform: 'translateX(-50%)' }}
          />
          <Handle
            type="target"
            position={Position.Bottom}
            id="bottom"
            className={portClass}
            style={{ bottom: -6, left: '50%', transform: 'translateX(-50%)' }}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="bottom-source"
            className={portClass}
            style={{ bottom: -6, left: '50%', transform: 'translateX(-50%)' }}
          />
        </>
      ) : null}

      <div
        className={cn(
          'relative m-0 w-max max-w-[220px] overflow-hidden rounded-lg border bg-white p-0 shadow-md transition-all duration-200',
          selected
            ? 'border-sky-500 ring-2 ring-sky-500/25 shadow-lg'
            : 'border-slate-200 hover:border-slate-300 hover:shadow-lg',
        )}
      >
        <div className="relative flex items-stretch gap-1.5 p-1.5">
          <div
            className={cn(
              'flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200/80 p-1',
              illustrated ? 'bg-white' : config.iconBg,
              !illustrated && config.borderColor,
            )}
          >
            <Icon
              className={cn(
                'h-full w-full shrink-0',
                !illustrated && config.iconColor,
              )}
            />
          </div>

          <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 py-0.5 pr-1">
            <div className="flex items-center gap-1 leading-none">
              <p className="min-w-0 flex-1 truncate text-[13px] font-bold text-slate-800">{label}</p>
              {deviceDetails?.is_active !== undefined ? (
                <span
                  className={cn(
                    'shrink-0 rounded-sm px-1 py-px text-[8px] font-bold uppercase leading-none',
                    deviceDetails.is_active
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-500',
                  )}
                >
                  {deviceDetails.is_active ? 'On' : 'Off'}
                </span>
              ) : null}
            </div>

            {deviceDetails?.sub_domain ? (
              <p className="truncate text-[10px] font-medium leading-tight text-slate-600">
                {deviceDetails.sub_domain}
              </p>
            ) : null}

            {(deviceDetails?.domain || deviceDetails?.location) && (
              <p className="truncate text-[9px] leading-tight text-slate-400">
                {[deviceDetails?.domain, deviceDetails?.location].filter(Boolean).join(' · ')}
              </p>
            )}

            {deviceDetails?.device_code ? (
              <p className="truncate text-[9px] leading-tight text-slate-400">#{deviceDetails.device_code}</p>
            ) : null}

            {deviceDetails?.description ? (
              <p className="line-clamp-1 text-[9px] leading-tight text-slate-500">{deviceDetails.description}</p>
            ) : null}
          </div>

          {!isReadOnly && onDelete ? (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0.5 top-0.5 z-10 h-5 w-5 rounded-sm opacity-0 transition-opacity group-hover/node:opacity-100 hover:bg-red-50 hover:text-red-600"
              title="Delete"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          ) : null}
        </div>

        <div className={cn('h-1 w-full', config.badgeColor)} />
      </div>
    </div>
  );
}
