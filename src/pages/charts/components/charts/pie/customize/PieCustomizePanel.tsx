import { PieAppearanceCustomizeSection } from './PieAppearanceCustomizeSection';
import { PieLegendCustomizeSection } from './PieLegendCustomizeSection';
import { PieFormatCustomizeSection, PieLabelsCustomizeSection } from './PieLabelsCustomizeSection';
import { PieLiveCustomizeSection } from './PieLiveCustomizeSection';
import { PieShapeCustomizeSection } from './PieShapeCustomizeSection';
import { PieCustomizePanelShell } from './pieCustomizeShared';
import { defaultOptions, type ChartCustomizationOptions } from './pieCustomizeTypes';

export type { ChartCustomizationOptions } from './pieCustomizeTypes';
export { defaultOptions };

interface ChartCustomizePanelProps {
  options: ChartCustomizationOptions;
  onOptionsChange: (options: ChartCustomizationOptions) => void;
  chartType?: string;
}

function resolvePieChartFlags(chartType?: string) {
  const isPieOrDonutChartType =
    chartType === 'Pie Chart' ||
    chartType === 'Donut Chart' ||
    (typeof chartType === 'string' && /donut|doughnut|pie/i.test(chartType) && !/radius/i.test(chartType));
  const isDonutChartType =
    chartType === 'Donut Chart' ||
    (typeof chartType === 'string' && /donut|doughnut/i.test(chartType));
  const isRadiusPieChartType =
    chartType === 'Radius Pie Chart' ||
    (typeof chartType === 'string' && /radius.*pie/i.test(chartType));
  const isPieLike = isPieOrDonutChartType || isRadiusPieChartType;

  return { isDonutChartType, isRadiusPieChartType, isPieLike };
}

export function ChartCustomizePanel({ options, onOptionsChange, chartType }: ChartCustomizePanelProps) {
  const { isDonutChartType, isRadiusPieChartType, isPieLike } = resolvePieChartFlags(chartType);
  const showValueFormat = options.labelType !== 'percentage' && options.labelType !== 'none';

  return (
    <PieCustomizePanelShell title="Chart options" description="Pie and donut chart settings">
      <PieAppearanceCustomizeSection options={options} onOptionsChange={onOptionsChange} defaultOpen />
      <PieLegendCustomizeSection
        options={options}
        onOptionsChange={onOptionsChange}
        showSideLegend={isPieLike}
      />
      <PieLabelsCustomizeSection options={options} onOptionsChange={onOptionsChange} />
      {showValueFormat ? (
        <PieFormatCustomizeSection options={options} onOptionsChange={onOptionsChange} />
      ) : null}
      {isPieLike ? (
        <>
          <PieShapeCustomizeSection
            options={options}
            onOptionsChange={onOptionsChange}
            isDonutChartType={isDonutChartType}
          />
          <PieLiveCustomizeSection
            options={options}
            onOptionsChange={onOptionsChange}
            isRadiusPieChartType={isRadiusPieChartType}
          />
        </>
      ) : null}
    </PieCustomizePanelShell>
  );
}

export const PieCustomizePanel = ChartCustomizePanel;

export { colorSchemes, ColorSchemePreview } from './pieColorSchemes';
