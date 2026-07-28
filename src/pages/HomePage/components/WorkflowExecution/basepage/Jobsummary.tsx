
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Expand } from "lucide-react";
import api from "@/controllers/API/api";
import { executeApiRequestSilent } from "@/utils/exceptionHelper";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Brush,
} from "recharts";

const statusColors: { [key: string]: string } = {
    COMPLETED: "#16a34a", // green-500
    RUNNING: "#3b82f6", // blue-500
    PENDING: "#f59e0b", // yellow-400
    FAILED: "#ef4444", // red-500
};
export function Jobsummary({ flowid }: { flowid?: string }) {
    const [isMaximized, setIsMaximized] = useState(false);
    const [loading, setLoading] = useState(true);
    const [seriesData, setSeriesData] = useState<any[]>([]);

    // Fetch and transform API data into timeseries per day
    useEffect(() => {
        const fetchData = async () => {
            try {
                const json = await executeApiRequestSilent<{ data?: unknown[] }>(
                    () =>
                        api.get("/flow-exec-details-log", {
                            params: {
                                fields: JSON.stringify([
                                    "job_status",
                                    "execution_date_time",
                                    "process_cycle",
                                    "execution_number",
                                ]),
                                q: `flow_id='${flowid}'`,
                            },
                        }),
                    "Failed to load job summary",
                );
                const records: any[] = json.data || [];

                // Group counts by date (YYYY-MM-DD) and status
                const map: Record<string, Record<string, number>> = {};
                const statuses = ["COMPLETED", "RUNNING", "PENDING", "FAILED"];

                records.forEach((r) => {
                    const dt = r.execution_date_time ;
                    const date = dt.split(" ")[0];
                    map[date] = map[date] || {};
                    statuses.forEach((s) => (map[date][s] = map[date][s] || 0));
                    const status = r.job_status && statuses.includes(r.job_status) ? r.job_status : "PENDING";
                    map[date][status] = (map[date][status] || 0) + 1;
                });

                // Build sorted array for chart
                const data = Object.keys(map)
                    .sort()
                    .map((date) => ({
                        date,
                        COMPLETED: map[date].COMPLETED || 0,
                        RUNNING: map[date].RUNNING || 0,
                        PENDING: map[date].PENDING || 0,
                        FAILED: map[date].FAILED || 0,
                    }));

                setSeriesData(data);
            } catch (err) {
                console.error(err);
                setSeriesData([]);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    useEffect(() => {
        if (!isMaximized) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setIsMaximized(false);
        };
        window.addEventListener("keydown", onKey);
        return () => {
            document.body.style.overflow = prev;
            window.removeEventListener("keydown", onKey);
        };
    }, [isMaximized]);

    const Chart = ({ height = 200, compact = true }: { height?: number; compact?: boolean }) => (
        <div style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={seriesData} margin={{ top: 8, right: 24, left: -20, bottom: compact ? 8 : 48 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: compact ? 10 : 12 }}   />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: compact ? 10 : 12 }} />
                    <Tooltip
                    cursor={false} 
                    contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',   // light gray border
                        borderRadius: '6px',
                        padding: '4px 8px',
                        fontSize: '12px',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                    }}
                    labelStyle={{ marginBottom: 2 }}
                    itemStyle={{ padding: 0 }}
                    />

                    <defs>
                    <filter id="shadowCompleted" x="-50%" y="-50%" width="200%" height="200%">
                        <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor={statusColors.COMPLETED} floodOpacity="1" />
                    </filter>

                    <filter id="shadowRunning" x="-50%" y="-50%" width="200%" height="200%">
                        <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor={statusColors.RUNNING} floodOpacity="1" />
                    </filter>

                    <filter id="shadowPending" x="-50%" y="-50%" width="200%" height="200%">
                        <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor={statusColors.PENDING} floodOpacity="1" />
                    </filter>

                    <filter id="shadowFailed" x="-50%" y="-50%" width="200%" height="200%">
                        <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor={statusColors.FAILED} floodOpacity="1" />
                    </filter>
                    </defs>

                    {!compact && <Legend verticalAlign="top" height={24} />}
                    {!compact && (
                        <Brush dataKey="date" height={20}  stroke="#8884d8" travellerWidth={8} startIndex={0} tickFormatter={(value) =>
                            new Date(value).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                            })
                            } />
                    )}
                    <Line type="monotone" dataKey="COMPLETED" stroke={statusColors.COMPLETED} strokeWidth={2} dot={false} filter="url(#shadowCompleted)" />
                    <Line type="monotone" dataKey="RUNNING" stroke={statusColors.RUNNING} strokeWidth={2} dot={false} filter="url(#shadowRunning)" />
                    <Line type="monotone" dataKey="PENDING" stroke={statusColors.PENDING} strokeWidth={2} dot={false} filter="url(#shadowPending)" />
                    <Line type="monotone" dataKey="FAILED" stroke={statusColors.FAILED} strokeWidth={2} dot={false} filter="url(#shadowFailed)" />

                </LineChart>
            </ResponsiveContainer>
        </div>
    );

    return (
        <>
            <Card className="w-full rounded-lg border-t bg-card shadow-sm hover:shadow-md transition-transform transform hover:-translate-y-0.5 focus-within:shadow-md 
                        focus-within:ring-1 focus-within:ring-ring outline-none px-0 py-0 gap-1">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base">Job Summary</CardTitle>

                    <div className="flex items-center gap-2">
                        {/* <Select defaultValue="all">
                            <SelectTrigger className="w-[150px] h-8">
                                <SelectValue placeholder="Select members" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Members</SelectItem>
                                <SelectItem value="you">You</SelectItem>
                            </SelectContent>
                        </Select> */}

                        <Button
                            aria-label="Maximize"
                            onClick={() => setIsMaximized(true)}
                            variant="ghost"
                            className="text-sm px-2 py-1 rounded hover:bg-slate-100"
                        >
                            <Expand className="h-4 w-4" />
                        </Button>
                    </div>
                </CardHeader>

                <CardContent>
                    {/* show the small colored labels only when maximized (hide in compact) */}
                    {!isMaximized && (
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                            <div className="flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full" style={{ background: statusColors.COMPLETED }}></span>
                                <span>Completed</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full" style={{ background: statusColors.RUNNING }}></span>
                                <span>Running</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full" style={{ background: statusColors.PENDING }}></span>
                                <span>Pending</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full" style={{ background: statusColors.FAILED }}></span>
                                <span>Failed</span>
                            </div>
                        </div>
                    )}

                    {loading && <p className="text-xs">Loading...</p>}
                    {!loading && seriesData.length === 0 && (
                        <div className="h-[200px] w-full flex items-center justify-center text-muted-foreground text-sm">
                            No data available for the selected date range
                        </div>
                    )}

                    {!loading && seriesData.length > 0 && <Chart height={200} compact={true} />}
                </CardContent>
            </Card>

            {isMaximized && (
                <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/50" onClick={() => setIsMaximized(false)} />

                    <div className="relative z-10 max-w-4xl w-full mx-4">
                        <div className="bg-white rounded shadow-lg">
                            <div className="flex items-center justify-between p-4 border-b">
                                <h3 className="text-lg font-medium">Job Summary</h3>
                                <div className="flex items-center gap-2">
                                    <Button
                                        onClick={() => setIsMaximized(false)}
                                        aria-label="Close"
                                        variant="outline"
                                        className="px-2 py-1 rounded-lg"
                                    >
                                        Close
                                    </Button>
                                </div>
                            </div>
                            <div className="p-6 min-w-4xl">
                                {!loading && seriesData.length > 0 ? (
                                    <div style={{ height: 420 }}>
                                        {/* reuse Chart with compact=false to show legend and labels */}
                                        <Chart height={420} compact={false} />
                                    </div>
                                ) : (
                                    <div className="h-[420px] w-full flex items-center justify-center text-muted-foreground text-sm">
                                        {loading ? "Loading..." : "No data available for the selected date range"}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
