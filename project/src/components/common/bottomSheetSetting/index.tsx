import { Button } from "@/components/ui/button"
import { Download, Settings, Share2 } from "lucide-react"
import ForwardedIconComponent from "../genericIconComponent"
import ShadTooltip from "../shadTooltipComponent"
import useFlowStore from "@/stores/flowStore"
import { useNodeStore } from "@/stores/nodeStore"
import useExecutionResultStore from "@/stores/executionResultStore"

const BottomSheetSetting = () => {
  // const { setSplitMode } = useFlowStore();
  const selectedNode = useNodeStore((state) => state.selectedNode);
  const resetResult = useExecutionResultStore((state) => state.resetResult);

  const handleResize = (type: string) => {
    if (type === 'reset') {
      // setSplitMode('reset')
    }
    if (type === 'open') {
      // setSplitMode('open')
    }
    if (type === 'close') {
      // setSplitMode('close')
    }
  }

  const handleReset = () => {
    resetResult();
  }

  return (
    <>
      {/* Action Buttons */}
      <div className="flex items-center gap-1">
        {
          selectedNode?.data?.node_id === "filter_data" && (
            <ShadTooltip content="Table Reset">
              <Button
                variant="outline"
                size="iconMd"
                className="p-1 flex items-center justify-center mr-2"
                onClick={() => handleReset()}
              >
                <ForwardedIconComponent name="refresh-ccw" className="w-4 h-4 text-zinc-500" />
              </Button>
            </ShadTooltip>
          )
        }
        {/* <ShadTooltip content="Resize Panel">
          <Button
            variant="outline"
            size="iconMd"
            onClick={() => handleResize('reset')}
            className="p-1 flex items-center justify-center 
                          rounded-lg cursor-pointer
                          hover:bg-zinc-100 dark:hover:bg-zinc-800 
                          transition-colors"
          >
            <ForwardedIconComponent name="move" className="w-4 h-4 text-zinc-500" />
          </Button>
        </ShadTooltip> */}
        {/* <ShadTooltip content="Panel Close">
          <Button
            variant="outline"
            size="iconMd"
            onClick={() => handleResize('close')}
            className="p-1 flex items-center justify-center 
                        rounded-lg cursor-pointer
                        hover:bg-zinc-100 dark:hover:bg-zinc-800 
                        transition-colors"
          >
            <ForwardedIconComponent name="panel-bottom-close" className="w-4 h-4 text-zinc-500" />
          </Button>
        </ShadTooltip> */}
        {/* <ShadTooltip content="Panel Fullscreen" side="left">
          <Button
            variant="outline"
            size="iconMd"
            onClick={() => handleResize('open')}
            className="p-1 flex items-center justify-center 
                          rounded-lg cursor-pointer
                          hover:bg-zinc-100 dark:hover:bg-zinc-800 
                          transition-colors"
          >
            <ForwardedIconComponent name="panel-bottom-open" className="w-4 h-4 text-zinc-500" />
          </Button>
        </ShadTooltip> */}
      </div>
    </>
  )
}

export default BottomSheetSetting