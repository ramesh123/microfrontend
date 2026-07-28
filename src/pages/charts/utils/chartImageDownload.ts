import { toast } from 'sonner';

interface DownloadChartImageOptions {
  chartTitle?: string;
  isBigNumberChart?: boolean;
}

export function downloadChartImageFromContainer(
  container: Element | null | undefined,
  { chartTitle = 'Chart', isBigNumberChart = false }: DownloadChartImageOptions = {},
) {
  try {
    if (isBigNumberChart) {
      const labelEl = container?.querySelector('.line-clamp-2');
      const valueEl = container?.querySelector('.tabular-nums');
      const bgOverlayEl = container?.querySelector('.pointer-events-none.absolute.inset-0') as HTMLElement | null;

      const labelText = labelEl?.textContent?.trim() || chartTitle || 'Big Number';
      const valueText = valueEl?.textContent?.trim() || 'N/A';

      let bgStyle = bgOverlayEl ? (bgOverlayEl.style.background || bgOverlayEl.style.backgroundColor) : '';
      if (!bgStyle && bgOverlayEl) {
        bgStyle = window.getComputedStyle(bgOverlayEl).background || window.getComputedStyle(bgOverlayEl).backgroundColor;
      }

      let valueColor = '#ffffff';
      let labelColor = 'rgba(255, 255, 255, 0.65)';

      if (valueEl) {
        valueColor = window.getComputedStyle(valueEl).color || '#ffffff';
      }
      if (labelEl) {
        labelColor = window.getComputedStyle(labelEl).color || 'rgba(255, 255, 255, 0.65)';
      }

      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 200;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const colors = bgStyle.match(/#[A-Fa-f0-9]{6}|#[A-Fa-f0-9]{3}|rgba?\([^)]+\)/g);
        let fillStyle: string | CanvasGradient = '#0f172a';

        if (colors && colors.length >= 3) {
          const gradient = ctx.createLinearGradient(0, 0, 400, 200);
          gradient.addColorStop(0, colors[0]);
          gradient.addColorStop(0.48, colors[1]);
          gradient.addColorStop(1, colors[2]);
          fillStyle = gradient;
        } else if (colors && colors.length === 2) {
          const gradient = ctx.createLinearGradient(0, 0, 400, 200);
          gradient.addColorStop(0, colors[0]);
          gradient.addColorStop(1, colors[1]);
          fillStyle = gradient;
        } else if (colors && colors.length === 1) {
          fillStyle = colors[0];
        } else if (bgStyle) {
          fillStyle = bgStyle;
        }

        ctx.fillStyle = fillStyle;
        ctx.fillRect(0, 0, 400, 200);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        if (valueColor !== '#ffffff' && !valueColor.includes('255')) {
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
        }
        ctx.lineWidth = 1.5;
        ctx.strokeRect(1, 1, 398, 198);
        ctx.fillStyle = labelColor;
        ctx.font = '500 14px Inter, system-ui, sans-serif';
        ctx.fillText(labelText, 24, 52);
        ctx.fillStyle = valueColor;
        ctx.font = 'bold 44px Inter, system-ui, sans-serif';
        ctx.fillText(valueText, 24, 120);

        triggerCanvasDownload(canvas, `${labelText.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_bignumber.png`);
        return;
      }
    }

    let canvas = container?.querySelector('canvas');
    if (!canvas) {
      canvas = document.querySelector('canvas');
    }
    if (!canvas) {
      toast.error('No chart canvas found to download');
      return;
    }
    triggerCanvasDownload(canvas, 'chart.png');
  } catch (error) {
    console.error('Failed to download chart image:', error);
    toast.error('Failed to download chart image');
  }
}

function triggerCanvasDownload(canvas: HTMLCanvasElement, filename: string) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  toast.success('Chart downloaded successfully');
}
