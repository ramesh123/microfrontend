import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { PipelineIcon } from './pipeline-icon';

export const PipelineIconComponent = forwardRef<
  SVGSVGElement,
  React.PropsWithChildren<{ className?: string }>
>((props, ref) => {
  return <PipelineIcon ref={ref} {...props} className={cn('w-6 h-6', props.className)} />;
});

export default PipelineIconComponent;
