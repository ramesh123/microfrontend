import { Plus, Minus, Expand } from 'lucide-react';
import { useReactFlow, useViewport } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

export const CustomControls = () => {
  const { zoomIn, zoomOut, fitView, zoomTo } = useReactFlow();
  const { zoom } = useViewport();

  const minZoom = 0.2;
  const maxZoom = 2.5;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-4 p-2 bg-background/90 backdrop-blur-sm rounded-lg border shadow-lg">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => zoomOut({ duration: 300 })}
          title="Zoom Out"
          className="h-8 w-8"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <Slider
          min={minZoom}
          max={maxZoom}
          step={0.05}
          value={[zoom]}
          onValueChange={(value) => zoomTo(value[0])}
          className="w-32"
          aria-label="Zoom slider"
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => zoomIn({ duration: 300 })}
          title="Zoom In"
          className="h-8 w-8"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="text-sm font-semibold text-muted-foreground w-12 text-center">
        {`${Math.round(zoom * 100)}%`}
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => fitView({ duration: 300 })}
        title="Fit View"
        className="h-8 w-8"
      >
        <Expand className="h-4 w-4" />
      </Button>
    </div>
  );
};
