import areaPng from "@/assets/images/charts/areachart.png";
import barChartPng from "@/assets/images/charts/barchart.png";
import donutPng from "@/assets/images/charts/donut.png";
import funnelPng from "@/assets/images/charts/funnel.png";
import gaugePng from "@/assets/images/charts/gauge.png";
import linePng from "@/assets/images/charts/line.png";
import piePng from "@/assets/images/charts/pie.png";
import radarPng from "@/assets/images/charts/rader.png";
import stackedBarPng from "@/assets/images/charts/stackedbar.png";
import sunburstPng from "@/assets/images/charts/sunburst.png";
import bignumberpng from "@/assets/images/charts/bignumber.png";
import tablepng from "@/assets/images/charts/table.png";

const CHART_PREVIEW_IMAGE_BY_KEY: Record<string, string> = {
  area: areaPng,
  bar: barChartPng,
  barchart: barChartPng,
  horizontal_bar: barChartPng,
  column: barChartPng,
  combo: barChartPng,
  stacked_bar: stackedBarPng,
  stackedbar: stackedBarPng,
  line: linePng,
  timeseries: linePng,
  pie: piePng,
  donut: donutPng,
  funnel: funnelPng,
  gauge: gaugePng,
  gauge_big: gaugePng,
  big_number: bignumberpng,
  big_number_stream: bignumberpng,
  radius_pie: radarPng,
  radar: radarPng,
  rader: radarPng,
  sunburst: sunburstPng,
  table: tablepng,
  pivot_table: tablepng,
};

function normalizeChartPreviewKey(value: string) {
  return value.toLowerCase().replace(/[\s-]+/g, "_").replace(/_chart$/i, "");
}

/**
 * Returns a chart preview PNG when a mapped asset exists for the chart key/name.
 */
export function getChartPreviewImage(key: string, name?: string): string | null {
  const candidates = [key, name].filter(Boolean).map(normalizeChartPreviewKey);

  for (const candidate of candidates) {
    if (CHART_PREVIEW_IMAGE_BY_KEY[candidate]) {
      return CHART_PREVIEW_IMAGE_BY_KEY[candidate];
    }
  }

  const k = (key || "").toLowerCase();
  const n = (name || "").toLowerCase();

  if (/sunburst/.test(k) || /sunburst/.test(n)) return sunburstPng;
  if (/big_number_stream|big number stream/.test(k) || /big number stream/.test(n)) return linePng;
  if (/semi|gauge|semi-circle|gauge_big/.test(k) || /gauge/.test(n)) return gaugePng;
  if (/big|kpi|number/.test(k) || /big|kpi|number/.test(n)) return gaugePng;
  if (/stack|stacked/.test(k) || /stacked/.test(n)) return stackedBarPng;
  if (/bar|column/.test(k) || /bar/.test(n)) return barChartPng;
  if (/area/.test(k) || /area/.test(n)) return areaPng;
  if (/line|time.?series/.test(k) || /line|time.?series/.test(n)) return linePng;
  if (/funnel/.test(k) || /funnel/.test(n)) return funnelPng;
  if (/donut/.test(k) || /donut/.test(n)) return donutPng;
  if (/radius.*pie|rad_pie|radius_pie|radarpie|radar.*pie/.test(k) || /radius.*pie|radar.*pie/.test(n)) {
    return radarPng;
  }
  if (/pie/.test(k) || /pie/.test(n)) return piePng;

  return null;
}
