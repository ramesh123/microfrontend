"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Expand } from "lucide-react";
import { useDateFilter } from "./date";
import api from "@/controllers/API/api";
import { executeApiRequestSilent } from "@/utils/exceptionHelper";
import { buildDateFilterPayload } from "./utils/datefilter";

const emptyStats = {
    counts: { COMPLETED: 0, RUNNING: 0, PENDING: 0, FAILED: 0 },
    percentages: { COMPLETED: 0, RUNNING: 0, PENDING: 0, FAILED: 0 },
};

const statusColors: { [key: string]: string } = {
    COMPLETED: "bg-green-500",
    RUNNING: "bg-blue-500",
    PENDING: "bg-yellow-400",
    FAILED: "bg-red-500",
};

export function FlowExecStatus({ flowid2 }: { flowid2?: string }) {
    const { fromDate, toDate } = useDateFilter();
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isMaximized, setIsMaximized] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const payload = buildDateFilterPayload(flowid2, fromDate, toDate);
            const data = await executeApiRequestSilent(
                () => api.post("/flow-exec-details-log", payload),
                "Failed to load flow execution status",
            );
            setStats(data);
        } catch (err) {
            console.error(err);
            setStats(emptyStats);
        } finally {
            setLoading(false);
        }
    };

    // Fetch data when dates or flowid changes
    useEffect(() => {
        fetchData();
    }, [fromDate, toDate, flowid2]);

    // Prevent background scroll while dialog is open & close on ESC
    useEffect(() => {
        if (isMaximized) {
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
        }
    }, [isMaximized]);

    const renderBody = (compact = true) => (
        <Card className="w-full rounded-lg border-t bg-card shadow-sm hover:shadow-md transition-transform transform hover:-translate-y-0.5 focus-within:shadow-md 
                        focus-within:ring-1 focus-within:ring-ring outline-none px-0 py-0 gap-1">
            <CardHeader className="flex items-center justify-between ">
                {compact && (<CardTitle className="text-base">Flow Execution Status</CardTitle>)}
                <div className="ml-2">
                    {compact && (
                        <Button
                            aria-label="Maximize"
                            onClick={() => setIsMaximized(true)}
                            variant="ghost"
                            className="text-sm px-2 py-1 rounded hover:bg-slate-100"
                        >
                         <Expand className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </CardHeader>

            <CardContent className="">
                {loading && <p className="text-xs">Loading...</p>}

                {!loading &&
                    Object.keys(statusColors).map((key) => (
                        <div key={key} className="mb-4">
                            {/* Label + Count */}
                            <div className="flex justify-between text-xs mb-1">
                                <span>{key}</span>
                                <span className="text-muted-foreground">
                                    {stats?.counts?.[key] ?? 0} ({(stats?.percentages?.[key] ?? 0).toFixed(1)}%)
                                </span>
                            </div>

                            {/* Individual Progress Bar */}
                            <div className="h-2 w-full bg-muted rounded-full">
                                <div
                                    className={`h-2 rounded-full ${statusColors[key]}`}
                                    style={{ width: `${stats?.percentages?.[key] ?? 0}%` }}
                                ></div>
                            </div>
                        </div>
                    ))}
            </CardContent>
        </Card>
    );

    return (
        <>
            {renderBody(true)}

            {isMaximized && (
                <div
                    role="dialog"
                    aria-modal="true"
                    className="fixed inset-0 z-50 flex items-center justify-center"
                >
                    {/* overlay */}
                    <div
                        className="absolute inset-0 bg-black/50"
                        onClick={() => setIsMaximized(false)}
                    />
                    {/* content */}
                    <div className="relative z-10 max-w-4xl w-full mx-2">
                        <div className="bg-white rounded shadow-lg">
                            {/* Large header with close */}
                            <div className="flex items-center justify-between p-4 border-b">
                                <h3 className="text-lg font-medium">Flow Execution Status</h3>
                                <div className="flex items-center gap-2">
                                    <Button
                                        onClick={() => setIsMaximized(false)}
                                        aria-label="Close"
                                        variant="outline"
                                        className="px-2 py-1 rounded-lg "
                                    >
                                        Close
                                    </Button>
                                </div>
                            </div>

                            <div className="p-6">
                                {renderBody(false)}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}