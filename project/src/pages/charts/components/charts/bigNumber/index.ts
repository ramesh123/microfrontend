/** Big Number chart module — components, customize panels, and utilities. */

// Chart components
export { BigNumberChart } from './components/BigNumberChart';
export { BigNumberStreamChart } from './components/BigNumberStreamChart';
export { BigNumberPositionedBody } from './components/BigNumberPositionedBody';
export type { BigNumberPositionedBodyProps } from './components/BigNumberPositionedBody';
export { BigNumberKpiIcon } from './components/BigNumberKpiIcon';
export { ColoredSvgIcon } from './components/ColoredSvgIcon';
export { useBigNumberContainerScale } from './components/useBigNumberContainerScale';

// Customize panels
export {
  BigNumberCustomizePanel,
  defaultOptions,
  BIG_NUMBER_CUSTOMIZATION_KEYS,
  formatBigNumberValue,
  resolveBigNumberFontWeight,
} from './customize/BigNumberCustmizechart';
export type { BigNumberCustomizationOptions } from './customize/BigNumberCustmizechart';
export {
  BigNumberStreamCustomizePanel,
  defaultStreamOptions,
  BIG_NUMBER_STREAM_REFRESH_INTERVALS,
} from './customize/BigNumberStreamCustomizePanel';
export type { BigNumberStreamCustomizationOptions } from './customize/BigNumberStreamCustomizePanel';
export {
  BigNumberIconCustomizeSection,
  BigNumberContentLayoutCustomizeSection,
} from './customize/BigNumberIconLayoutCustomizeSections';
export { BigNumberPerMetricFormatSection } from './customize/BigNumberPerMetricFormatSection';
export { PaginatedCardSchemeGrid } from './customize/PaginatedCardSchemeGrid';

// Utilities
export {
  BIG_NUMBER_CARD_BORDER_RADIUS,
  BIG_NUMBER_CARD_RADIUS_CLASS,
  BIG_NUMBER_DEFAULT_WHITE,
  BIG_NUMBER_GLASS_NEUTRAL_GRADIENT,
  bigNumberCardColorSchemes,
  buildGlassGradientCss,
  buildShineGradientCss,
  getBigNumberBaseColor,
  getBigNumberSchemeByValue,
  hasExplicitBigNumberCardColor,
  normalizeBackgroundOpacity,
  resolveBigNumberCardStyle,
} from './utils/bigNumberCardColors';
export type {
  BigNumberCardBackgroundStyle,
  BigNumberCardColorScheme,
  BigNumberCardStyleResult,
} from './utils/bigNumberCardColors';
export {
  buildBigNumberCardSurfaceStyles,
  resolveBigNumberCardBorder,
  resolveBigNumberCardShadow,
} from './utils/bigNumberCardColors';
export { BigNumberCardBackgroundImageSection } from './customize/BigNumberCardBackgroundImageSection';
export { resolveKpiCardSurfaceStyle } from './utils/bigNumberKpiCardStyle';
export type { BigNumberKpiCustomizeOptions } from './utils/bigNumberKpiCustomizeTypes';
export {
  DEFAULT_KPI_ICON_SIZE_PX,
  MAX_KPI_ICON_SIZE_PX,
  MIN_KPI_ICON_SIZE_PX,
  hasKpiIconSource,
  isRasterImageSource,
  kpiIconSizeStyle,
  resolveKpiIconSizePx,
} from './utils/bigNumberKpiIconUtils';
export { getBigNumberMetricDisplay } from './utils/bigNumberMetricDisplay';
export {
  coerceBigNumberChartItems,
  isBigNumberVisualization,
  resolveBigNumberChartData,
  resolveBigNumberLayoutMode,
  splitKpiMetricDisplays,
  transformBigNumberChartData,
} from './utils/bigNumberMultiMetricData';
export type {
  BigNumberChartItem,
  BigNumberMetricConfig,
  BigNumberMetricDisplay,
} from './utils/bigNumberMultiMetricData';
export {
  BIG_NUMBER_STREAM_CUSTOMIZATION_KEYS,
  buildBigNumberStreamCustomizationPayload,
} from './utils/bigNumberStreamCustomizationPayload';
export {
  getChartRefreshIntervalSeconds,
  getBigNumberStreamRefreshIntervalSeconds,
  isAutoRefreshChart,
  useBigNumberStreamRefresh,
  type StreamChartDataSlice,
} from './utils/bigNumberStreamDashboardRefresh';
export {
  BIG_NUMBER_ELEMENT_POSITION_OPTIONS,
  DEFAULT_HEADER_POSITION,
  DEFAULT_ICON_POSITION,
  DEFAULT_VALUE_POSITION,
  elementPositionAlignClass,
  elementPositionGridClass,
  normalizeElementPosition,
  shouldUseClassicKpiLayout,
  shouldUsePositionGridLayout,
} from './utils/bigNumberStreamLayout';
export type { BigNumberElementPosition } from './utils/bigNumberStreamLayout';
export {
  BIG_NUMBER_UNIT_PRESETS,
  buildBigNumberMetricDescriptors,
  getBigNumberMetricKey,
  getBigNumberMetricLabel,
  resolveBigNumberFontPx,
  resolveBigNumberSubheaderFontPx,
  resolveBigNumberValueFontPx,
  parseTypographyPx,
  resolveMetricFormatOptions,
  resolveUnitSymbol,
  scaleFontSizeForFormattedValue,
  stepDownFooterFontPx,
} from './utils/bigNumberUnitOptions';
export type {
  BigNumberMetricDescriptor,
  BigNumberMetricFormatOptions,
} from './utils/bigNumberUnitOptions';
export {
  computeBigNumberResponsiveScale,
  scalePaddingValue,
  scalePxNumber,
  scalePxValue,
} from './utils/bigNumberResponsiveScale';
export type { BigNumberResponsiveLayoutMode } from './utils/bigNumberResponsiveScale';
export {
  applyColorToSvgMarkup,
  dataUrlToSvgText,
  getColoredSvgDataUrl,
  getSvgDisplayUrl,
  getSvgMaskUrl,
  isSvgSource,
  normalizeIconColor,
  svgTextToDataUrl,
} from './utils/svgIconColorUtils';
