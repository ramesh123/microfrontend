import React from 'react'

interface Props {
  parameters?: any
  className?: string
}

export default function Parameters({ parameters, className = '' }: Props) {
  const hasParams = parameters && Object.keys(parameters).length > 0

  return (
    <div className={className}>
      {hasParams ? (
        <pre className="overflow-auto whitespace-pre-wrap break-all rounded-md border bg-muted/30 p-2 font-mono text-xs">{JSON.stringify(parameters, null, 2)}</pre>
      ) : (
        <div className="text-sm text-muted-foreground text-center">No Parametrs found</div>
      )}
    </div>
  )
}
