interface DatasetStepLoadingProps {
  message?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'h-5 w-5 border-2',
  md: 'h-8 w-8 border-2',
  lg: 'h-10 w-10 border-[3px]',
};

const DatasetStepLoading = ({ message = 'Loading...', className = '', size = 'md' }: DatasetStepLoadingProps) => (
  <div className={`flex flex-col items-center justify-center gap-3 text-muted-foreground ${className}`}>
    <div className={`${sizeClasses[size]} border-primary border-t-transparent rounded-full animate-spin`} />
    {message ? <p className="text-sm">{message}</p> : null}
  </div>
);

export default DatasetStepLoading;
