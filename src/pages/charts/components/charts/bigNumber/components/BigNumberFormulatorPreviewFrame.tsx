import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { BIG_NUMBER_CARD_RADIUS_CLASS } from '../utils/bigNumberCardColors';
import {
  getBigNumberFormulatorPreviewSize,
  type BigNumberResponsiveLayoutMode,
} from '../utils/bigNumberResponsiveScale';

type BigNumberFormulatorPreviewFrameProps = {
  mode: BigNumberResponsiveLayoutMode;
  children: ReactNode;
  className?: string;
};

/** Constrain Big Number preview to a dashboard-like card while authoring. */
export function BigNumberFormulatorPreviewFrame({
  mode,
  children,
  className,
}: BigNumberFormulatorPreviewFrameProps) {
  const { width, height } = getBigNumberFormulatorPreviewSize(mode);

  return (
    <div className={cn('flex h-full w-full min-h-0 items-start justify-start overflow-auto p-3', className)}>
      <div
        className={cn('relative shrink-0 overflow-hidden bg-transparent', BIG_NUMBER_CARD_RADIUS_CLASS)}
        style={{ width, height, maxWidth: '100%' }}
      >
        {children}
      </div>
    </div>
  );
}
