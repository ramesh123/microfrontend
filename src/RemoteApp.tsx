import "./styles/applies.css";
import "./styles/ag-theme-shadcn.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/context/theme";
import { AuthProvider } from "@/context/auth/authContext";
import { WorkflowRemoteContent } from "./router";

const queryClient = new QueryClient();

// Entry point exposed to the container host via Module Federation
// (see vite.config.ts `exposes["./WorkflowRoutes"]`). No BrowserRouter and
// no Toaster here — the host supplies routing history and its own Toaster;
// duplicating either would break navigation / double-render toasts.
//
// No ReactFlowProvider/DndProvider here either: @xyflow/react and react-dnd
// aren't in this app's federation `shared` config, and their internal
// zustand-based state ends up with its own unshared React copy under
// federation, crashing with "Cannot read properties of null (reading
// 'useRef')". Pages that actually need them (FlowPage, the flow canvas)
// will hit that same crash if reached through the remote until those
// packages are properly shared — a separate, larger problem from today's
// fix. Draft Workflows itself doesn't use either.
export default function WorkflowRemoteApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          <WorkflowRemoteContent />
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
