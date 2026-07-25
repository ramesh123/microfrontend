import { useTheme } from "@/context/theme";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles, Mic } from "lucide-react";
import { FaArrowCircleRight } from "react-icons/fa";
import AskResultView from "./AskResultView";
import {
  postQuery,
  // postChartRequest,
  getChartStatus,
  ASK_TENANT_ID,
  // ASK_DOMAIN_ID,
  ASK_QUERY_LIMIT,
  // ASK_CHART_LIMIT,
} from "@/controllers/API/askApi";
import type { AskQueryResponse, AskChartReadyResponse } from "@/controllers/API/askApi";

const PLACEHOLDER_PROMPTS = [
  "What is total LPG production by zone last week?",
  "What are the top performing regions?",
  "Compare sales vs target by region",
  "Analyze customer churn rate this quarter",
] as const;

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 30;

export default function Ask() {
  const { theme } = useTheme();
  const [input, setInput] = useState("");
  const [typedText, setTypedText] = useState("");
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingStateRef = useRef({ currentIndex: 0, isDeleting: false });

  // Result state
  const [submittedQuestion, setSubmittedQuestion] = useState<string | null>(null);
  const [queryData, setQueryData] = useState<AskQueryResponse | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<AskChartReadyResponse | null>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [showChart, setShowChart] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  // Polling refs
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const abortRef = useRef(false);

  const isDark = theme === 'dark' || theme === 'blue-dark' || theme === 'blue-dark-g' || theme === 'purple-dark' || theme === 'orange-dark';

  // Textarea auto-resize
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [input]);

  // Typing animation for placeholder
  useEffect(() => {
    if (input.trim()) {
      setTypedText("");
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      return;
    }
    const placeholderText = PLACEHOLDER_PROMPTS[currentPromptIndex];
    const type = () => {
      const state = typingStateRef.current;
      if (!state.isDeleting && state.currentIndex < placeholderText.length) {
        setTypedText(placeholderText.slice(0, state.currentIndex + 1));
        state.currentIndex++;
        typingTimeoutRef.current = setTimeout(type, 100);
      } else if (!state.isDeleting && state.currentIndex === placeholderText.length) {
        typingTimeoutRef.current = setTimeout(() => { state.isDeleting = true; type(); }, 2000);
      } else if (state.isDeleting && state.currentIndex > 0) {
        state.currentIndex--;
        setTypedText(placeholderText.slice(0, state.currentIndex));
        typingTimeoutRef.current = setTimeout(type, 50);
      } else {
        state.isDeleting = false;
        setCurrentPromptIndex((prev) => (prev + 1) % PLACEHOLDER_PROMPTS.length);
        typingTimeoutRef.current = setTimeout(type, 500);
      }
    };
    typingTimeoutRef.current = setTimeout(type, 500);
    return () => { if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current); };
  }, [input, currentPromptIndex]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      abortRef.current = true;
      if (pollingRef.current) clearTimeout(pollingRef.current);
    };
  }, []);

  const stopPolling = useCallback(() => {
    abortRef.current = true;
    if (pollingRef.current) {
      clearTimeout(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const pollChart = useCallback((chartId: string, attempt: number) => {
    if (abortRef.current || attempt >= MAX_POLL_ATTEMPTS) {
      if (attempt >= MAX_POLL_ATTEMPTS) {
        setChartLoading(false);
      }
      return;
    }

    pollingRef.current = setTimeout(async () => {
      try {
        const result = await getChartStatus(chartId);
        if (abortRef.current) return;

        if (result.status === 'ready') {
          setChartData(result as AskChartReadyResponse);
          setChartLoading(false);
        } else {
          pollChart(chartId, attempt + 1);
        }
      } catch {
        if (!abortRef.current) {
          setChartLoading(false);
        }
      }
    }, POLL_INTERVAL_MS);
  }, []);

  const handleSendMessage = useCallback(async () => {
    const userText = input.trim();
    if (!userText || queryLoading) return;

    // Stop any ongoing polling
    stopPolling();
    abortRef.current = false;

    // Reset state for new query
    setInput("");
    setSubmittedQuestion(userText);
    setQueryData(null);
    setQueryError(null);
    setChartData(null);
    setChartLoading(false);
    setShowChart(false);
    setCurrentPage(0);
    setQueryLoading(true);

    // Call /query first, then /charts after query succeeds
    postQuery({
      question: userText,
      tenant_id: ASK_TENANT_ID,
      limit: ASK_QUERY_LIMIT,
      explain: true,
    })
      .then((data) => {
        if (abortRef.current) return;
        setQueryData(data);
        setQueryLoading(false);

        // Use chart_id from /query response to poll chart status
        if (data.chart_id) {
          setChartLoading(true);
          pollChart(data.chart_id, 0);
        }

        // // POST /charts commented out — using chart_id from /query instead
        // postChartRequest({
        //   tenant_id: ASK_TENANT_ID,
        //   domain_id: ASK_DOMAIN_ID,
        //   question: userText,
        //   limit: ASK_CHART_LIMIT,
        // })
        //   .then((queued) => {
        //     if (abortRef.current) return;
        //     pollChart(queued.chart_id, 0);
        //   })
        //   .catch(() => {
        //     if (!abortRef.current) {
        //       setChartLoading(false);
        //     }
        //   });
      })
      .catch((err) => {
        if (!abortRef.current) {
          setQueryError(err?.response?.data?.detail || err?.message || 'Query failed');
          setQueryLoading(false);
        }
      });
  }, [input, queryLoading, stopPolling, pollChart]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleToggleView = useCallback(() => {
    setShowChart((prev) => !prev);
  }, []);

  const handlePageSizeChange = useCallback((newSize: number) => {   
    setPageSize(newSize);
    setCurrentPage(0);
  }, []);

  const hasResult = submittedQuestion !== null;

  return ( 
    <main
      className={cn(
        "flex flex-col w-full h-full min-h-0",
        isDark
          ? "bg-gradient-to-br from-[#05070c] via-[#0b1a33] to-black text-white"
          : "bg-gradient-to-br from-blue-50 via-white to-purple-50 text-foreground"
      )}
    >
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-border/40">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Ask
          </h1>
          <p className={cn("text-xs mt-1", isDark ? "text-white/60" : "text-muted-foreground")}>
            Ask questions to get insights from your data
          </p>
        </div>
      </div>

      {/* Input Area */}
      <div className={cn(
        "flex-shrink-0 px-4 py-3",
        hasResult && (isDark ? "border-b border-white/10" : "border-b border-slate-200")
      )}>
        <div className="max-w-6xl mx-auto">
          <div
            className={cn(
              "rounded-lg border flex items-end gap-2 p-2",
              isDark ? "bg-[#1a1d23] border-white/10" : "bg-white border-slate-200 shadow-sm"
            )}
          >
            <button
              className={cn(
                "p-2 rounded-md transition-colors flex-shrink-0",
                isDark ? "hover:bg-white/5" : "hover:bg-slate-100"
              )}
              title="Voice input"
            >
              <Mic className="h-5 w-5" />
            </button>
            <div className="relative flex-1 overflow-hidden flex items-center">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder=" "
                rows={1}
                disabled={queryLoading}
                className={cn(
                  "w-full bg-transparent outline-none text-sm resize-none max-h-32 overflow-y-auto py-2 relative z-10",
                  isDark ? "text-white" : "text-slate-800"
                )}
              />
              {!input && (
                <div className={cn(
                  "absolute left-0 top-0 py-2 pointer-events-none text-sm",
                  isDark ? "text-white/40" : "text-slate-400"
                )}>
                  {typedText}
                  <span className="animate-blink">|</span>
                </div>
              )}
            </div>
            <button
              onClick={handleSendMessage}
              disabled={!input.trim() || queryLoading}
              className={cn(
                "bg-primary hover:bg-primary/90 transition p-2 rounded-md flex-shrink-0",
                "text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              <FaArrowCircleRight className="h-5 w-5" />
            </button>
          </div>
          {!hasResult && (
            <p className={cn("text-xs mt-2 text-center", isDark ? "text-white/40" : "text-slate-400")}>
              Press Enter to send, Shift + Enter for new line
            </p>
          )}
        </div>
      </div>

      {/* Result Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
        <div className="max-w-6xl mx-auto">
          {!hasResult ? ( 
            <div className="flex flex-col items-center justify-center min-h-[350px] text-center">
              <div className={cn(
                "h-16 w-16 rounded-full flex items-center justify-center mb-4",
                isDark ? "bg-white/5" : "bg-primary/10"
              )}>
                <Sparkles className={cn("h-8 w-8", isDark ? "text-blue-400" : "text-primary")} />
              </div>
              <h2 className="text-lg font-semibold mb-2">Ask a question to get started</h2>
              <p className={cn("text-sm max-w-md", isDark ? "text-white/60" : "text-muted-foreground")}>
                Try asking about sales performance, revenue trends, or any business metrics
              </p>
              <div className="mt-6 flex flex-wrap gap-2 justify-center">
                {[
                  "What is total LPG production by zone last week?",
                  "What is total LPG production by region last week?",
                  "What is total LPG production by sales area last week?"
                ].map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => setInput(suggestion)}
                    className={cn(
                      "px-3 py-2 rounded-lg border text-sm transition-colors",
                      isDark
                        ? "bg-white/5 border-white/10 hover:bg-white/10"
                        : "bg-white border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              {/* Submitted question display */}
              <div className={cn(
                "mb-4 px-4 py-2.5 rounded-lg text-sm font-medium",
                isDark ? "bg-white/5 text-white/90" : "bg-slate-100 text-slate-800"
              )}>
                <span className={cn("text-xs font-normal mr-2", isDark ? "text-white/40" : "text-slate-400")}>Q:</span>
                {submittedQuestion}
              </div>

              {/* Result view with table/chart */}
              <AskResultView
                queryData={queryData}
                queryLoading={queryLoading}
                queryError={queryError}
                chartData={chartData}
                chartLoading={chartLoading}
                showChart={showChart}
                onToggleView={handleToggleView}
                currentPage={currentPage}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={handlePageSizeChange}
              />
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        .animate-blink {
          animation: blink 1s infinite;
        }
      `}</style>
    </main>
  );
}
