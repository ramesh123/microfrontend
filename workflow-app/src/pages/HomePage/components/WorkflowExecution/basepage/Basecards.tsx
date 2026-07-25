import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import api, { API_BASE_URL } from "@/controllers/API/api";
import { executeApiRequestSilent } from "@/utils/exceptionHelper";
import { statsCardsData } from "./mock";

function toApiPath(url: string): string {
  if (url.startsWith(API_BASE_URL)) {
    const path = url.slice(API_BASE_URL.length);
    return path.startsWith("/") ? path : `/${path}`;
  }
  if (url.startsWith("/api/")) return url.slice(4);
  if (url.startsWith("/api")) return url.slice(4) || "/";
  return url;
}

type Stat = {
  title: string;
  value: string | number;
  icon?: React.ComponentType<any>;
  detail?: string;
  footerText?: string;
};

// Optional API props
interface StatCardsProps {
  apiUrl?: string;
  useMock?: boolean;
}

export function BaseCards({ apiUrl, useMock = false }: StatCardsProps) {
  const [stats, setStats] = useState<Stat[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchStats() {
      setLoading(true);
      try {
        if (useMock || !apiUrl) {
          // Use mock data
          setStats(statsCardsData);
        } else {
          const json = await executeApiRequestSilent<{ data: Array<Record<string, unknown>> }>(
            () => api.get(toApiPath(apiUrl)),
            "Failed to load stats",
          );
          setStats(
            (json.data ?? []).map((item: any) => ({
              title: item.title,
              value: item.value,
              icon: item.icon, // optional
              detail: item.detail,
              footerText: item.footerText,
            }))
          );
        }
      } catch (err) {
        console.error("Failed to fetch stats:", err);
        setStats(statsCardsData); // fallback to mock on error
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [apiUrl, useMock]);

  if (loading) return <div>Loading stats...</div>;

  return (
    <div className="w-full mx-auto flex flex-col gap-3">
      {stats.map((stat: Stat, index: number) => {
        const Icon = stat.icon;
        return (
          <Card
            key={index}
            role="region"
            aria-labelledby={`stat-title-${index}`}
            className="w-full rounded-lg border-t bg-card shadow-sm hover:shadow-md transition-transform transform hover:-translate-y-0.5 focus-within:shadow-md focus-within:ring-1 focus-within:ring-ring outline-none px-0 py-0 gap-0"
          >
            <CardHeader className="flex items-start justify-between gap-1 px-2 py-2 mb-0 ">
              <div className="flex items-center gap-2">
                {Icon && (
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-muted/10 text-muted-foreground">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                )}
                <div>
                  <CardTitle
                    id={`stat-title-${index}`}
                    className="text-sm font-medium leading-5 text-foreground"
                  >
                    {stat.title}
                  </CardTitle>
                  {stat.detail && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{stat.detail}</p>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="justify-center items-center flex mb-1">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-semibold text-foreground">{stat.value}</div>
                  {stat.footerText && (
                    <p className="mt-1 text-sm text-muted-foreground">{stat.footerText}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
