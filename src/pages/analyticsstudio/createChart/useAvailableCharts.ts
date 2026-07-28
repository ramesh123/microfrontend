import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  getDashboardCharts,
  type DashboardChartComponent,
  type DashboardChartSection,
} from "@/pages/Visualization/API/chartsApi";
import { getDisplayErrorMessage } from "@/utils/exceptionHelper";

export function useAvailableCharts() {
  const [sections, setSections] = useState<DashboardChartSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCharts = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await getDashboardCharts();
        if (!response.status || !Array.isArray(response.data)) {
          throw new Error(response.message || "Failed to load chart types");
        }
        setSections(response.data.filter((section) => section.components?.length > 0));
      } catch (err) {
        const message = getDisplayErrorMessage(err, "Failed to load chart types");
        setError(message);
        toast.error(message);
        setSections([]);
      } finally {
        setIsLoading(false);
      }
    };

    void loadCharts();
  }, []);

  const allCharts = useMemo(
    () => sections.flatMap((section) => section.components),
    [sections],
  );

  const getChartById = (uniqueId?: string): DashboardChartComponent | undefined =>
    allCharts.find((chart) => chart.unique_id === uniqueId);

  return {
    sections,
    allCharts,
    isLoading,
    error,
    getChartById,
  };
}
