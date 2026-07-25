import areachartImg from '@/assets/images/charts/areachart.png';
import barchartImg from '@/assets/images/charts/barchart.png';
import bignumberImg from '@/assets/images/charts/bignumber.png';
import donutImg from '@/assets/images/charts/donut.png';
import funnelImg from '@/assets/images/charts/funnel.png';
import gaugeImg from '@/assets/images/charts/gauge.png';
import lineImg from '@/assets/images/charts/line.png';
import pieImg from '@/assets/images/charts/pie.png';
import radarImg from '@/assets/images/charts/rader.png';
import stackedbarImg from '@/assets/images/charts/stackedbar.png';
import sunburstImg from '@/assets/images/charts/sunburst.png';
import tableImg from '@/assets/images/charts/table.png';

const STATIC_BLOCK_VIZ = ['panel', 'text', 'label', 'image', 'alert', 'divider'] as const;

/** PNG thumbnail for a chart visualization type; null for layout/content blocks. */
export function getChartTypeImage(vizName?: string | null): string | null {
  const name = (vizName || '').toLowerCase();
  if (!name) return barchartImg;

  if (STATIC_BLOCK_VIZ.some((block) => name.includes(block))) {
    return null;
  }

  if (name.includes('stacked') && name.includes('bar')) return stackedbarImg;
  if (name.includes('sunburst')) return sunburstImg;
  if (name.includes('donut')) return donutImg;
  if (name.includes('funnel')) return funnelImg;
  if (name.includes('bignumber') || name.includes('big_number') || (name.includes('big') && name.includes('number'))) {
    return bignumberImg;
  }
  if (name.includes('sparkline') || name.includes('line')) return lineImg;
  if (name.includes('areachart') || name.includes('area')) return areachartImg;
  if (name.includes('pie') || name.includes('semi')) return pieImg;
  if (name.includes('radar') || name.includes('rader')) return radarImg;
  if (name.includes('gauge') || name.includes('radial')) return gaugeImg;
  if (name.includes('table') || name.includes('pivot')) return tableImg;
  if (name.includes('bar') || name.includes('column')) return barchartImg;
  if (name.includes('kpi') || name.includes('stat')) return bignumberImg;

  return barchartImg;
}

export function getChartTypeImageAlt(vizName?: string | null): string {
  const name = (vizName || 'chart').replace(/_/g, ' ');
  return `${name} chart`;
}
