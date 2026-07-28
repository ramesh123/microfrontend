"use client";

import { useEffect, useState } from "react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from "recharts";

import api from "@/controllers/API/api";
import { executeApiRequestSilent } from "@/utils/exceptionHelper";
import { workflowPerformanceData as mockData } from "./mock";

async function fetchWorkflowPerformanceApi() {
    try {
        const data = await executeApiRequestSilent<(typeof mockData)[number][]>(
            () => api.get("/workflow-performance"),
            "Failed to load workflow performance",
        );
        return Array.isArray(data) && data.length > 0 ? data : null;
    } catch {
        return null;
    }
}

export function WorkflowPerformanceChart({ hideTitle1 = false }: { hideTitle1?: boolean }) {
    const [chartData, setChartData] = useState(mockData); 
    useEffect(() => {
        async function loadData() {
            const apiData = await fetchWorkflowPerformanceApi();
            if (apiData) {
                setChartData(apiData); 
            } else {
                setChartData(mockData); 
            }
        }

        loadData();
    }, []);

    return (
        <div className="rounded-lg bg-white px-0 py-1">
            {/* Header */}
            {!hideTitle1 && (
            <div className="px-5">
                <h3 className="text-base font-semibold">Workflow Run Cycle Performance</h3>
            </div>
            )}
            {/* Content */}
            <div className="pt-2 px-2">
                <div className="h-[190px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                            data={chartData}
                            margin={{ top: 5, right: 2, left: -25, bottom: 2 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />

                            <XAxis
                                dataKey="cycle"
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 12 }}
                            />

                            <YAxis
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 12 }}
                                tickFormatter={(value) => `${value / 1000}k`}
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
                                }}
                                labelStyle={{ marginBottom: 2 }}
                                itemStyle={{ padding: 0 }}
                            />

                            <Legend
                                iconType="circle"
                                iconSize={8}
                                wrapperStyle={{ fontSize: "12px", paddingTop: "2px" }}
                            />

                            <Line
                                type="monotone"
                                dataKey="loaded"
                                stroke="#3B82F6"
                                strokeWidth={2}
                                dot={false}
                                name="Loaded"
                            />

                            <Line
                                type="monotone"
                                dataKey="exceptions"
                                stroke="#EF4444"
                                strokeWidth={2}
                                dot={false}
                                name="Exceptions"
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}
