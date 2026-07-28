import React, { forwardRef } from 'react';
import { Workflow } from 'lucide-react';
import { cn } from '@/lib/utils';

export const WorkflowIconComponent = forwardRef<
  SVGSVGElement,
  React.PropsWithChildren<{ className?: string }>
>((props, ref) => {
  return <Workflow ref={ref} {...props} className={cn('w-6 h-6', props.className)} />;
});

export default WorkflowIconComponent;
