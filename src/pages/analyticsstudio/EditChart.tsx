import { useEffect, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import EditChartWizard from "./createChart/EditChartWizard";

export default function AnalyticsStudioEditChart() {
  const navigate = useNavigate();
  const { chartId = "" } = useParams<{ chartId: string }>();
  const [searchParams] = useSearchParams();
  const isViewOnly = useMemo(
    () => searchParams.get("view") === "true" || searchParams.get("mode") === "view",
    [searchParams],
  );

  useEffect(() => {
    if (!chartId) {
      navigate("/analytic-studio", { replace: true });
    }
  }, [chartId, navigate]);

  if (!chartId) {
    return null;
  }

  return <EditChartWizard chartId={chartId} isViewOnly={isViewOnly} />;
}
