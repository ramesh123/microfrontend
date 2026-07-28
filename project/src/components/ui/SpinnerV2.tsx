import React from 'react';
import Spinner from '@/components/ui/spinner';

interface SpinnerV2Props {
  label?: string;
  className?: string;
}

const SpinnerV2: React.FC<SpinnerV2Props> = ({ label = 'Loading...', className = '' }) => {
  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <Spinner className="h-6 w-6" />
      {label && (
        <span className="mt-2 text-sm text-gray-500">{label}</span>
      )}
    </div>
  );
};

export default SpinnerV2;