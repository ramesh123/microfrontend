

import { useEffect, useState } from "react";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from "recharts";

import api from "@/controllers/API/api";
import { executeApiRequestSilent } from "@/utils/exceptionHelper";
import { exceptionDistributionData as mockData } from "./mock";

async function fetchExceptionDistributionApi() {
    try {
        const data = await executeApiRequestSilent<(typeof mockData)[number][]>(
            () => api.get("/exception-distribution"),
            "Failed to load exception distribution",
        );
        return Array.isArray(data) && data.length > 0 ? data : null;
    } catch {
        return null;
    }
}

export function ExceptionDistributionChart({ hideTitle = false }: { hideTitle?: boolean }) {
    const [chartData, setChartData] = useState(mockData); 

    useEffect(() => {
        async function loadData() {
            const apiData = await fetchExceptionDistributionApi();

            if (apiData) {
                setChartData(apiData); 
            } else {
                setChartData(mockData); 
            }
        }

        loadData();
    }, []);

    return (
        <div className="gap-0 py-1 px-0 bg-white ">
            {/* Header */}
            {!hideTitle&& (
            <div className="py-0">
                <h3 className="text-base font-medium ml-4">Exception Count Distribution</h3>
            </div>
            )}
            {/* Content */}
            <div className="p-0">
                <div className="h-[210px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                            data={chartData}
                            margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
                        >
                            <defs>
                                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                                </linearGradient>
                            </defs>

                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis
                                dataKey="ageing"
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 12 }}
                            />
                            <YAxis
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 12 }}
                            />

                            <Tooltip
                                cursor={false}
                                contentStyle={{
                                    backgroundColor: "white",
                                    border: "1px solid #e5e7eb",
                                    borderRadius: "6px",
                                    padding: "4px 8px",
                                    fontSize: "12px",
                                    boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                                    color: "#EF4444",
                                }}
                            />

                            <Area
                                type="monotone"
                                dataKey="count"
                                stroke="#EF4444"
                                fillOpacity={1}
                                fill="url(#colorCount)"
                                name="Count"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}
