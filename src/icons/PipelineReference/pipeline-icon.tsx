import React from 'react';

export type PipelineIconProps = React.SVGProps<SVGSVGElement>;

/** Pipeline / workflow reference icon - connected nodes in a flow */
export const PipelineIcon: React.FC<PipelineIconProps> = (props) => (
  <svg
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="5" cy="12" r="2.5" />
    <circle cx="12" cy="12" r="2.5" />
    <circle cx="19" cy="12" r="2.5" />
    <line x1="7.5" y1="12" x2="9.5" y2="12" />
    <line x1="14.5" y1="12" x2="16.5" y2="12" />
  </svg>
);

export default PipelineIcon;
