import ForwardedIconComponent from "@/components/common/genericIconComponent"


export const NodeContent = () => {
  return (
    <>
      <div className="flex flex-col gap-2">
        {/* <div className="flex items-center gap-2">
          <div className="flex items-center space-x-2">
            <ForwardedIconComponent name="Rows4" className="lucide lucide-circle-check h-4 w-4" />
            <span className="font-mono text-sm text-muted-foreground">Row(s)</span>
            <span className="font-mono text-xs text-muted-foreground">453</span>
          </div>
        </div> */}
        <div className="flex items-center gap-2"> 
          {/* <div className="flex items-center space-x-2">
            <ForwardedIconComponent name="CheckCircle" className="lucide lucide-circle-check h-4 w-4 text-green-500" />
            <span className="font-mono text-sm text-green-500">Run</span>
            <span className="font-mono text-xs text-muted-foreground">23s</span>
          </div> */}

          <div className="flex items-center space-x-2">
            <ForwardedIconComponent name="Calendar" className="lucide lucide-circle-check h-4 w-4 text-blue-500" />
            <span className="font-mono text-sm text-blue-500">{"2025-05-27 3:30:00 PM"}</span>
          </div>
        </div>
      </div>
    </>
  )
}