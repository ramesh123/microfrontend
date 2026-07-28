import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { getEnergyNodeConfig } from './energyNodeConfig';
import { WorkflowStyleNodeCard } from './WorkflowStyleNodeCard';
import type { EnergyNodeDeviceDetails } from './energyNodeDetails';

interface EnergyNodeData {
  label: string;
  type: string;
  deviceDetails?: EnergyNodeDeviceDetails;
  onDelete?: () => void;
  isReadOnly?: boolean;
}

export const EnergyNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as EnergyNodeData;
  const config = getEnergyNodeConfig(nodeData.type, nodeData.deviceDetails?.device_icon);

  return (
    <WorkflowStyleNodeCard
      label={nodeData.label}
      type={nodeData.type}
      config={config}
      deviceDetails={nodeData.deviceDetails}
      selected={selected}
      isReadOnly={nodeData.isReadOnly}
      onDelete={nodeData.onDelete}
    />
  );
});
