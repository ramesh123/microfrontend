import { useTheme } from "@/context/theme";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";
import { User } from "lucide-react";
import AIimage from "@/assets/images/ai.png";
import { FaArrowCircleRight } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { useCreateNewWorkflow } from "@/hooks/use-add-flow";
import { useRbacStore } from "@/stores/useRBACStore";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type HeroStep = "input" | "asking_name";

const WORKFLOW_CATEGORIES = [
  "ELT Pipeline",
  "Data Quality",
  "Reconciliation",
  "Operations",
  "Analytics",
] as const;

const SAMPLE_PROMPTS = [
  "Read CSV, filter data, and write to PostgreSQL",
  "Read two sources a CSV and a postgres node, Join two nodes and filter data, then save to PostgreSQL",
  "Use the uploaded CSV, filter data, and save to PostgreSQL",
  "Read data from MYSQL and filter the data and write the data to Postgresql table",
];

const INPUT_MAX_LINES = 5;
const INPUT_LINE_HEIGHT_PX = 20;
const INPUT_MAX_HEIGHT_PX = INPUT_LINE_HEIGHT_PX * INPUT_MAX_LINES;

export default function Hero() {
  const { theme } = useTheme();
  const [input, setInput] = useState("");
  const [category, setCategory] = useState<string>("");
  const [typedText, setTypedText] = useState("");
  const [isCreatingWorkflow, setIsCreatingWorkflow] = useState(false);
  const [step, setStep] = useState<HeroStep>("input");
  const [initialPrompt, setInitialPrompt] = useState("");
  const [workflowNameInput, setWorkflowNameInput] = useState("");
  const placeholderText = "Let's build a new workflow";
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingStateRef = useRef({ currentIndex: 0, isDeleting: false });
  const inputTextareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustInputTextareaHeight = () => {
    const el = inputTextareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const nextHeight = Math.min(el.scrollHeight, INPUT_MAX_HEIGHT_PX);
    el.style.height = `${Math.max(nextHeight, INPUT_LINE_HEIGHT_PX)}px`;
    el.style.overflowY = el.scrollHeight > INPUT_MAX_HEIGHT_PX ? "auto" : "hidden";
  };

  useEffect(() => {
    if (input.trim()) {
      setTypedText("");
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      return;
    }
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
        typingTimeoutRef.current = setTimeout(type, 500);
      }
    };
    typingTimeoutRef.current = setTimeout(type, 500);
    return () => { if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current); };
  }, [input, placeholderText]);

  useEffect(() => {
    adjustInputTextareaHeight();
  }, [input]);

  const isDark = theme === 'dark' || theme === 'blue-dark' || theme === 'blue-dark-g' || theme === 'purple-dark' || theme === 'orange-dark';
  const navigate = useNavigate();
  const { createAndLoadWorkflow } = useCreateNewWorkflow();
  const { currentUser, currentOrganization } = useRbacStore();

  const handleBuildNow = () => {
    const userText = input.trim();
    if (!userText) return;
    const promptText = category ? `${category}: ${userText}` : userText;
    setInitialPrompt(promptText);
    setInput("");
    setStep("asking_name");
  };

  const handleWorkflowNameChange = (value: string) => {
    setWorkflowNameInput(value.replace(/[\s,]/g, ""));
  };

  const handleSubmitWorkflowName = async () => {
    const raw = workflowNameInput.trim();
    if (!raw || isCreatingWorkflow) return;

    const safeName = raw.replace(/[^a-zA-Z0-9\-_]/g, "").slice(0, 80) || "NewWorkflow";

    const workflowParams = {
      name: safeName,
      deploymentName: safeName,
      description: initialPrompt,
      type: "Data_Validation",
      org_id: currentUser?.organizationIds ?? [],
      project: "",
      businessProcesses: [],
      process_id: "",
      execution_engine: null,
      target_output: null,
      storage_engine: null,
      cycle_wise: false,
      perspective_ids: currentOrganization?.perspectiveIds ?? [],
      workflow_origin: "AI" as const,
    };

    setIsCreatingWorkflow(true);
    try {
      await createAndLoadWorkflow(workflowParams, (flowId: string) => {
        navigate(`/workflows/${flowId}`, {
          state: { openAiChat: true, initialQuestion: initialPrompt },
        });
      });
    } catch (e) {
      console.error("Failed to create workflow:", e);
    } finally {
      setIsCreatingWorkflow(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent, phase: "input" | "name") => {
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    if (phase === "input") handleBuildNow();
    else handleSubmitWorkflowName();
  };

  return (
    <main
      className={cn(
        "relative flex flex-col w-full h-full min-h-0 overflow-hidden",
        isDark
          ? "bg-gradient-to-br from-[#05070c] via-[#0b1a33] to-black text-white"
          : "bg-gradient-to-br from-blue-50 via-white to-purple-50 text-foreground"
      )}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <svg
          className={cn("absolute bottom-0 left-0 w-full h-full", isDark ? "opacity-100" : "opacity-30")}
          viewBox="0 0 1200 800"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="arcGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={isDark ? "#3b82f6" : "#60a5fa"} stopOpacity="0.1" />
              <stop offset="30%" stopColor={isDark ? "#60a5fa" : "#3b82f6"} stopOpacity="0.3" />
              <stop offset="50%" stopColor={isDark ? "#93c5fd" : "#60a5fa"} stopOpacity="0.5" />
              <stop offset="70%" stopColor={isDark ? "#60a5fa" : "#3b82f6"} stopOpacity="0.3" />
              <stop offset="100%" stopColor={isDark ? "#3b82f6" : "#60a5fa"} stopOpacity="0.1" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="4" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <path d="M 0 600 Q 300 400 600 500 T 1200 600 L 1200 800 L 0 800 Z" fill="url(#arcGradient)" filter="url(#glow)" className="animate-arc-float" />
          <path d="M 0 650 Q 350 450 650 550 T 1200 650 L 1200 800 L 0 800 Z" fill="url(#arcGradient)" fillOpacity="0.6" filter="url(#glow)" className="animate-arc-float-delay" />
        </svg>
      </div>

      <div className="flex-shrink-0 flex justify-center pt-2 sm:pt-2 md:pt-2 lg:pt-2 pb-1 sm:pb-2 md:pb-2 animate-fade-in">
        <span
          className={cn(
            "px-2.5 py-1 sm:px-3 md:px-4 rounded-full text-[10px] sm:text-xs border animate-pulse-slow",
            isDark ? "bg-white/10 border-white/20 text-white" : "bg-primary/10 border-primary/20 text-foreground"
          )}
        >
          ⚡ Introducing ASK AI
        </span>
      </div>

      <div
        className={cn(
          "flex flex-col w-full max-w-xs sm:max-w-md md:max-w-2xl lg:max-w-4xl mx-auto px-3 sm:px-4 md:px-6",
          "flex-1 min-h-0 overflow-hidden pb-3 sm:pb-4 md:pb-6 transition-all duration-200 ease-linear"
        )}
      >
        <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center min-h-0 -mt-2 sm:-mt-1">
          <div className="text-center space-y-1 sm:space-y-2 w-full px-3 sm:px-4">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold leading-tight">
              Engineering <span className="text-primary">Data</span> Enterprise 
            </h1>
            <p className={cn("text-xs sm:text-sm px-4 max-w-2xl mx-auto", isDark ? "text-white/70" : "text-muted-foreground")}>
              Design, automate, and optimize workflows with AI
            </p>
          </div>

          <div
            className={cn(
              "rounded-lg p-3 sm:p-4 border flex-shrink-0 mt-1 sm:mt-2 relative z-10 animate-input-slide-up w-full max-w-4xl mx-auto",
              isDark ? "bg-[#1a1d23] border-white/10" : "bg-white/95 backdrop-blur-sm border-slate-200 shadow-lg text-slate-800"
            )}
          >
          {step === "input" ? (
            <>
              {/* Text area on top */}
              <div className="relative w-full flex items-start mb-2">
                <textarea
                  ref={inputTextareaRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    requestAnimationFrame(adjustInputTextareaHeight);
                  }}
                  onKeyDown={(e) => handleKeyPress(e, "input")}
                  placeholder=" "
                  rows={1}
                  className={cn(
                    "w-full bg-transparent outline-none text-sm leading-5 resize-none relative z-10",
                    isDark ? "text-white" : "text-slate-800"
                  )}
                  style={{
                    minHeight: `${INPUT_LINE_HEIGHT_PX}px`,
                    maxHeight: `${INPUT_MAX_HEIGHT_PX}px`,
                  }}
                />
                {!input && (
                  <div className={cn("absolute left-0 top-0 pointer-events-none text-sm", isDark ? "text-white/40" : "text-slate-400")}>
                    {typedText}
                    <span className="animate-blink">|</span>
                  </div>
                )}
              </div>
              {/* Bottom bar: Cognito AI image + Select model | Build now */}
              <div className="flex gap-2 items-center flex-wrap">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <img src={AIimage} alt="Cognito AI" className={cn("h-8 w-8 flex-shrink-0 object-contain", isDark ? "opacity-90" : "")} />
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger
                      className={cn(
                        "w-[130px] sm:w-[150px] h-8 flex-shrink-0 border-0 outline-none shadow-none ring-0 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none",
                        isDark ? "bg-transparent text-white" : "bg-transparent text-slate-700"
                      )}
                    >
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      {WORKFLOW_CATEGORIES.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <button
                  onClick={handleBuildNow}
                  disabled={!input.trim()}
                  className={cn(
                    "bg-primary hover:bg-primary/90 transition px-3 py-1.5 rounded-full flex-shrink-0",
                    "text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed",
                    "flex items-center gap-1.5 font-medium text-sm"
                  )}
                >
                  Build now
                  <FaArrowCircleRight className="h-4 w-4" />
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <div className={cn("h-7 w-7 rounded-full flex-shrink-0 flex items-center justify-center", isDark ? "bg-white/10" : "bg-primary/10")}>
                  <User className={cn("h-3.5 w-3.5", isDark ? "text-blue-400" : "text-primary")} />
                </div>
                <div className={cn("rounded-lg px-3 py-2 text-sm", isDark ? "bg-white/5" : "bg-muted/50")}>
                  {initialPrompt}
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="h-9 w-9 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center bg-gradient-to-br from-primary to-primary/70 p-0.5">
                  <img src={AIimage} alt="Cognito AI" className="h-full w-full object-contain" />
                </div>
                <div className={cn("rounded-lg px-3 py-2 text-sm", isDark ? "bg-white/5" : "bg-muted/50")}>
                  What would you like to name this workflow?
                </div>
              </div>
              <div className="flex gap-2 items-center pt-1">
                <div className={cn("relative flex-1 overflow-hidden flex items-center rounded-lg border bg-background/50", isDark ? "border-white/20" : "border-border")}>
                    <input
                    type="text"
                    value={workflowNameInput}
                    onChange={(e) => handleWorkflowNameChange(e.target.value)}
                    onKeyDown={(e) => handleKeyPress(e, "name")}
                    placeholder="Workflow name (no spaces or commas)"
                    disabled={isCreatingWorkflow}
                    className={cn(
                      "w-full px-3 py-2 text-sm bg-transparent outline-none",
                      isDark ? "text-white placeholder:text-white/40" : "text-foreground placeholder:text-muted-foreground"
                    )}
                  />
                </div>
                <button
                  onClick={handleSubmitWorkflowName}
                  disabled={!workflowNameInput.trim() || isCreatingWorkflow}
                  className={cn(
                    "bg-primary hover:bg-primary/90 transition px-3 py-2 rounded-lg flex items-center gap-1.5 font-medium text-sm",
                    "text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  {isCreatingWorkflow ? "Creating…" : "Create"}
                  <FaArrowCircleRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
          </div>

          {/* Sample prompts – outside text area card */}
          {step === "input" && (
            <div className="w-full max-w-4xl mx-auto mt-4 relative z-10">
              <p className={cn("text-[10px] sm:text-xs font-semibold uppercase tracking-wider mb-2.5 px-1", isDark ? "text-white/50" : "text-muted-foreground")}>
                Try a sample prompt
              </p>
              <ul className="flex flex-col gap-2">
                {SAMPLE_PROMPTS.map((prompt) => (
                  <li key={prompt}>
                    <button
                      type="button"
                      onClick={() => setInput(prompt)}
                      className={cn(
                        "w-full text-left group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                        "border shadow-sm",
                        isDark
                          ? "bg-white/5 border-white/10 text-white/90 hover:bg-white/10 hover:border-primary/40 hover:shadow-md"
                          : "bg-white/80 border-slate-200/80 text-slate-800 hover:bg-primary/5 hover:border-primary/30 hover:shadow-md"
                      )}
                    >
                      <span className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center overflow-hidden bg-primary/10">
                        <img src={AIimage} alt="Cognito AI" className="h-5 w-5 object-contain" />
                      </span>
                      <span className="flex-1 text-xs sm:text-sm font-medium leading-snug pr-2">
                        {prompt}
                      </span>
                      <span className={cn(
                        "flex-shrink-0 text-[10px] sm:text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity",
                        "text-primary"
                      )}>
                        Use →
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes pulse-slow { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
        @keyframes blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0; } }
        @keyframes input-slide-up { from { opacity: 0; transform: translateY(40px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes arc-float { 0%, 100% { transform: translateY(0) translateX(0); opacity: 0.6; } 50% { transform: translateY(-20px) translateX(10px); opacity: 0.8; } }
        @keyframes arc-float-delay { 0%, 100% { transform: translateY(0) translateX(0); opacity: 0.4; } 50% { transform: translateY(-15px) translateX(-5px); opacity: 0.6; } }
        .animate-fade-in { animation: fade-in 0.5s ease-out; }
        .animate-pulse-slow { animation: pulse-slow 2s ease-in-out infinite; }
        .animate-blink { animation: blink 1s infinite; }
        .animate-input-slide-up { animation: input-slide-up 0.8s 0.5s both; }
        .animate-arc-float { animation: arc-float 8s ease-in-out infinite; }
        .animate-arc-float-delay { animation: arc-float-delay 10s ease-in-out infinite; }
      `}</style>
    </main>
  );
}
