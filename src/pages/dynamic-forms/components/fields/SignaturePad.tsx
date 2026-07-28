import { useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SignaturePadProps {
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  className?: string;
  variant?: 'default' | 'canvas' | 'runtime';
}

function paintCanvasBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
}

export function SignaturePad({
  value = '',
  onChange,
  disabled,
  className,
  variant = 'default',
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const skipExternalSyncRef = useRef(false);
  const compact = variant === 'canvas';

  const loadImageOntoCanvas = useCallback((dataUrl: string) => {
    const canvas = canvasRef.current;
    if (!canvas || !dataUrl) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const image = new Image();
    image.onload = () => {
      paintCanvasBackground(ctx, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    };
    image.src = dataUrl;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    paintCanvasBackground(ctx, canvas.width, canvas.height);
  }, [compact]);

  useEffect(() => {
    if (skipExternalSyncRef.current) {
      skipExternalSyncRef.current = false;
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!value) {
      paintCanvasBackground(ctx, canvas.width, canvas.height);
      return;
    }

    loadImageOntoCanvas(value);
  }, [value, loadImageOntoCanvas]);

  const getPoint = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const emitValue = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    skipExternalSyncRef.current = true;
    onChange?.(canvas.toDataURL('image/png'));
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.stopPropagation();
    event.preventDefault();
    if (disabled) return;

    const canvas = canvasRef.current;
    const point = getPoint(event.clientX, event.clientY);
    if (!canvas || !point) return;

    canvas.setPointerCapture(event.pointerId);
    drawingRef.current = true;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#111827';
    ctx.lineWidth = compact ? 1.75 : 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.stopPropagation();
    if (!drawingRef.current || disabled) return;

    const canvas = canvasRef.current;
    const point = getPoint(event.clientX, event.clientY);
    if (!canvas || !point) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.stopPropagation();
    if (!drawingRef.current) return;

    drawingRef.current = false;

    const canvas = canvasRef.current;
    if (canvas?.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }

    emitValue();
  };

  const clear = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    paintCanvasBackground(ctx, canvas.width, canvas.height);
    skipExternalSyncRef.current = true;
    onChange?.('');
  };

  return (
    <div
      className={cn('space-y-2', className)}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="overflow-hidden rounded-md border border-border bg-white">
        <canvas
          ref={canvasRef}
          width={480}
          height={compact ? 96 : 160}
          className={cn(
            'w-full touch-none bg-white',
            compact ? 'h-24 cursor-crosshair' : 'h-40 cursor-crosshair',
            disabled && 'cursor-not-allowed opacity-60',
          )}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
      </div>
      {!compact && (
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={clear}>
          Clear signature
        </Button>
      )}
      {compact && (
        <button
          type="button"
          disabled={disabled}
          onClick={clear}
          className="text-[10px] text-primary hover:underline disabled:opacity-50"
        >
          Clear
        </button>
      )}
    </div>
  );
}
